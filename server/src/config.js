import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory or current working directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  supabaseUrl: process.env.SUPABASE_URL || 'https://placeholder-project.supabase.co',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  storeBaseUrl: process.env.STORE_BASE_URL || 'https://demo.inelabteamdev.com',
  cronSecret: process.env.CRON_SECRET || 'default-cron-secret',
  scrapeConcurrency: Math.max(1, parseInt(process.env.SCRAPE_CONCURRENCY || '2', 10)),
  scrapeMaxAttempts: Math.max(1, parseInt(process.env.SCRAPE_MAX_ATTEMPTS || '6', 10)),
  navTimeoutMs: Math.max(1000, parseInt(process.env.NAV_TIMEOUT_MS || '15000', 10)),
  cycleBudgetMs: Math.max(5000, parseInt(process.env.CYCLE_BUDGET_MS || '90000', 10)),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  headed: process.env.HEADED === 'true',
};

export default config;
