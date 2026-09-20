const formatTimestamp = () => new Date().toISOString();

export const logger = {
  info: (message, meta = {}) => {
    console.log(JSON.stringify({ timestamp: formatTimestamp(), level: 'info', message, ...meta }));
  },
  warn: (message, meta = {}) => {
    console.warn(JSON.stringify({ timestamp: formatTimestamp(), level: 'warn', message, ...meta }));
  },
  error: (message, meta = {}) => {
    console.error(JSON.stringify({ timestamp: formatTimestamp(), level: 'error', message, ...meta }));
  },
  debug: (message, meta = {}) => {
    if (process.env.DEBUG) {
      console.log(JSON.stringify({ timestamp: formatTimestamp(), level: 'debug', message, ...meta }));
    }
  },
};

export default logger;
