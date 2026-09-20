import { createClient } from '@supabase/supabase-js';
import config from '../config.js';
import logger from '../utils/logger.js';

let supabaseClient = null;

export const getSupabaseClient = () => {
  if (!supabaseClient) {
    if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
      logger.warn('Supabase URL or Service Role Key missing in environment. Database operations may fail.');
    }

    supabaseClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey || 'placeholder-key', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseClient;
};

// Allow injecting a mock client for testing
export const setSupabaseClient = (client) => {
  supabaseClient = client;
};

// Proxy delegates dynamically to current supabaseClient
export const supabase = new Proxy({}, {
  get(target, prop) {
    const client = getSupabaseClient();
    const value = client[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

export default supabase;
