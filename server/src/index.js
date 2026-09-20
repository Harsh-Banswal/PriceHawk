/**
 * @file index.js
 * @description Main Express application entry point.
 *
 * Configures:
 * - Helmet for HTTP security headers
 * - CORS restricted to CLIENT_ORIGIN
 * - Structured request logging (method, path, status, duration)
 * - GET /healthz health check
 * - Routes: /api/search, /api/products, /api/cron
 * - JSON error handler that never leaks stack traces
 * - Graceful browser and server shutdown
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './config.js';
import logger from './utils/logger.js';
import { closeBrowser } from './scraper/browser.js';
// Reloaded with dynamic HEADED mode and .env watcher

import searchRoutes, { getFullCatalog } from './routes/search.js';
import productsRoutes from './routes/products.js';
import cronRoutes from './routes/cron.js';
import scrapeRoutes from './routes/scrape.js';

const app = express();

// Security middleware
app.use(helmet());

// CORS restricted to CLIENT_ORIGIN
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. server-to-server, curl, tests)
      if (!origin) return callback(null, true);

      if (origin === config.clientOrigin) {
        return callback(null, true);
      }

      logger.warn(`CORS blocked request from unauthorized origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Structured request logging with duration, method, path, status
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      path: req.originalUrl || req.path,
      status: res.statusCode,
      durationMs: duration,
    });
  });
  next();
});

// Health check endpoints
app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'price-tracker-server',
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'price-tracker-server',
  });
});

// API Routes
app.use('/api/search', searchRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/scrape', scrapeRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'NotFound',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// JSON error handler that NEVER leaks stack traces
app.use((err, req, res, next) => {
  // Stack trace is recorded internally in server logs only
  logger.error('Unhandled request error:', {
    message: err.message,
    method: req.method,
    path: req.originalUrl,
    stack: err.stack,
  });

  const statusCode = err.status || err.statusCode || (err.message === 'Not allowed by CORS' ? 403 : 500);

  // Return clean JSON without any stack trace
  res.status(statusCode).json({
    error: err.name || 'Error',
    message: err.message || 'An unexpected error occurred',
  });
});

// Start server (use port 0 in test environment to avoid port collisions with running dev server)
const isTestEnv =
  process.env.NODE_ENV === 'test' ||
  process.execArgv.some((arg) => arg.includes('--test')) ||
  process.argv.some((arg) => arg.includes('test') || arg.includes('tests'));

const listenPort = isTestEnv ? 0 : config.port;

const server = app.listen(listenPort, async () => {
  const actualPort = server.address()?.port || listenPort;
  logger.info(`Price tracker server running on port ${actualPort} (Node ${process.version})`);
  logger.info(`Client Origin: ${config.clientOrigin}`);
  logger.info(`Store Base URL: ${config.storeBaseUrl}`);

  // Start continuous background price monitoring and auto-retry daemon in non-test mode
  if (!isTestEnv) {
    const { startAutoScraper } = await import('./scheduler/autoScraper.js');
    startAutoScraper(8000); // initial check after 8s, then every 3 minutes
  }
});

// Graceful shutdown handling
const handleShutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  if (!isTestEnv) {
    const { stopAutoScraper } = await import('./scheduler/autoScraper.js');
    stopAutoScraper();
  }
  server.close(async () => {
    logger.info('HTTP server closed.');
    await closeBrowser();
    logger.info('Chromium browser closed. Exiting process.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

export { app, server };
export default app;
