const { createClient } = require('@supabase/supabase-js');
const knex = require('knex');
const path = require('path');
const logger = require('../utils/logger');

// Database configuration based on environment
let db = null;
let supabase = null;

// SQLite configuration
const sqliteConfig = {
  client: 'sqlite3',
  connection: {
    filename: process.env.SQLITE_DB_PATH || './database/fleet_fraud.db'
  },
  useNullAsDefault: true,
  migrations: {
    directory: './database/migrations'
  },
  seeds: {
    directory: './database/seeds'
  }
};

// Initialize database connection
async function initializeDatabase() {
  try {
    const dbType = process.env.DB_TYPE || 'sqlite';
    
    if (dbType === 'sqlite') {
      logger.info('Initializing SQLite database connection...');
      db = knex(sqliteConfig);
      
      // Test SQLite connection
      await db.raw('SELECT 1');
      logger.info('SQLite database connection established');
      return { db, supabase: null };
      
    } else if (dbType === 'supabase' && process.env.SUPABASE_URL) {
      logger.info('Initializing Supabase connection...');
      
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
      supabase = createClient(process.env.SUPABASE_URL, supabaseKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: false,
          detectSessionInUrl: false
        }
      });
      
      // Test Supabase connection
      const { data, error } = await supabase.from('companies').select('count').limit(1);
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      logger.info('Supabase connection established');
      return { db: null, supabase };
      
    } else {
      logger.warn('No valid database configuration found, falling back to SQLite');
      db = knex(sqliteConfig);
      await db.raw('SELECT 1');
      logger.info('SQLite fallback connection established');
      return { db, supabase: null };
    }
    
  } catch (error) {
    logger.error('Database initialization failed:', error.message);
    
    // Fallback to SQLite if other connections fail
    if (!db) {
      try {
        logger.info('Falling back to SQLite database...');
        db = knex(sqliteConfig);
        await db.raw('SELECT 1');
        logger.info('SQLite fallback connection established');
        return { db, supabase: null };
      } catch (sqliteError) {
        logger.error('SQLite fallback failed:', sqliteError.message);
        throw new Error('All database connection attempts failed');
      }
    }
  }
}

// Generic database query wrapper
class DatabaseAdapter {
  constructor(db, supabase) {
    this.db = db;
    this.supabase = supabase;
    this.isSupabase = !!supabase;
  }

  // Generic select method
  async select(table, options = {}) {
    try {
      if (this.isSupabase) {
        let query = this.supabase.from(table).select(options.select || '*');
        
        if (options.where) {
          Object.entries(options.where).forEach(([key, value]) => {
            query = query.eq(key, value);
          });
        }
        
        if (options.limit) query = query.limit(options.limit);
        if (options.offset) query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
        if (options.orderBy) query = query.order(options.orderBy.column, { ascending: options.orderBy.direction === 'asc' });
        
        const { data, error } = await query;
        if (error) throw error;
        return data;
        
      } else {
        let query = this.db(table);
        
        if (options.select && options.select !== '*') {
          query = query.select(options.select.split(', '));
        }
        
        if (options.where) {
          query = query.where(options.where);
        }
        
        if (options.limit) query = query.limit(options.limit);
        if (options.offset) query = query.offset(options.offset);
        if (options.orderBy) query = query.orderBy(options.orderBy.column, options.orderBy.direction || 'asc');
        
        return await query;
      }
    } catch (error) {
      logger.error(`Database select error for table ${table}:`, error.message);
      throw error;
    }
  }

  // Generic insert method
  async insert(table, data) {
    try {
      if (this.isSupabase) {
        const { data: result, error } = await this.supabase.from(table).insert(data).select();
        if (error) throw error;
        return result;
      } else {
        const [id] = await this.db(table).insert(data);
        const inserted = await this.db(table).where('id', id).first();
        return inserted;
      }
    } catch (error) {
      logger.error(`Database insert error for table ${table}:`, error.message);
      throw error;
    }
  }

  // Generic update method
  async update(table, id, data) {
    try {
      if (this.isSupabase) {
        const { data: result, error } = await this.supabase.from(table).update(data).eq('id', id).select();
        if (error) throw error;
        return result[0];
      } else {
        await this.db(table).where('id', id).update(data);
        return await this.db(table).where('id', id).first();
      }
    } catch (error) {
      logger.error(`Database update error for table ${table}:`, error.message);
      throw error;
    }
  }

  // Generic delete method
  async delete(table, id) {
    try {
      if (this.isSupabase) {
        const { error } = await this.supabase.from(table).delete().eq('id', id);
        if (error) throw error;
        return true;
      } else {
        const count = await this.db(table).where('id', id).del();
        return count > 0;
      }
    } catch (error) {
      logger.error(`Database delete error for table ${table}:`, error.message);
      throw error;
    }
  }

  // Raw query method
  async raw(query, params = []) {
    try {
      if (this.isSupabase) {
        const { data, error } = await this.supabase.rpc('execute_sql', { query, params });
        if (error) throw error;
        return data;
      } else {
        return await this.db.raw(query, params);
      }
    } catch (error) {
      logger.error('Database raw query error:', error.message);
      throw error;
    }
  }
}

// Export functions
let databaseAdapter = null;

const getDatabase = async () => {
  if (!databaseAdapter) {
    const { db, supabase } = await initializeDatabase();
    databaseAdapter = new DatabaseAdapter(db, supabase);
  }
  return databaseAdapter;
};

module.exports = {
  initializeDatabase,
  getDatabase,
  DatabaseAdapter
};