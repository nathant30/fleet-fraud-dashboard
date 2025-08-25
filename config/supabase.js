const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

// Check if Supabase environment variables are available
const hasSupabaseConfig = process.env.SUPABASE_URL && 
  (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

if (!hasSupabaseConfig) {
  logger.info('Supabase configuration not found. Using local database instead.');
} else {
  logger.info('Supabase configuration detected');
}

// Create Supabase client - prefer service role key for backend operations
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = hasSupabaseConfig ? createClient(
  process.env.SUPABASE_URL,
  supabaseKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        'x-application-name': 'fleet-fraud-dashboard'
      }
    },
    // Use service role if available for bypassing RLS in backend operations
    db: {
      schema: 'public'
    }
  }
) : null;

// Create Supabase admin client for administrative operations
const supabaseAdmin = (hasSupabaseConfig && process.env.SUPABASE_SERVICE_ROLE_KEY) 
  ? createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          headers: {
            'x-application-name': 'fleet-fraud-dashboard-admin'
          }
        }
      }
    )
  : null;

// Test connection function
const testConnection = async () => {
  if (!hasSupabaseConfig || !supabase) {
    logger.info('Supabase not configured, skipping connection test');
    return false;
  }
  
  try {
    const { data, error } = await supabase.from('vehicles').select('count').limit(1);
    if (error && error.code !== 'PGRST116') { // PGRST116 is "relation does not exist"
      throw error;
    }
    logger.info('Supabase connection successful');
    return true;
  } catch (error) {
    logger.error('Supabase connection failed:', error.message);
    return false;
  }
};

// Initialize connection on startup only if configured
if (hasSupabaseConfig) {
  testConnection();
}

module.exports = {
  supabase,
  supabaseAdmin,
  testConnection
};