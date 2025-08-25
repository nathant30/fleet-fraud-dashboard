const { supabase, supabaseAdmin } = require('../../config/supabase');
const { db } = require('./connection');
const logger = require('../../utils/logger');

// Environment detection
const isUsingSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY;
const isUsingSQLite = process.env.DB_TYPE === 'sqlite' || (!isUsingSupabase && !process.env.DATABASE_URL);

class DatabaseAdapter {
  constructor() {
    // Force SQLite when Supabase client is null, regardless of environment detection
    const actualSupabaseAvailable = isUsingSupabase && supabase !== null;
    this.client = actualSupabaseAvailable ? 'supabase' : (isUsingSQLite ? 'sqlite' : 'postgresql');
    logger.info(`Database adapter initialized with client: ${this.client} (Supabase available: ${actualSupabaseAvailable})`);
  }

  // Generic select method
  async select(table, columns = '*', conditions = {}, options = {}) {
    try {
      if (this.client === 'supabase') {
        return await this._supabaseSelect(table, columns, conditions, options);
      } else {
        return await this._knexSelect(table, columns, conditions, options);
      }
    } catch (error) {
      logger.error(`Database select error on ${table}:`, error);
      throw error;
    }
  }

  // Generic insert method
  async insert(table, data, returning = true) {
    try {
      if (this.client === 'supabase') {
        return await this._supabaseInsert(table, data, returning);
      } else {
        return await this._knexInsert(table, data, returning);
      }
    } catch (error) {
      logger.error(`Database insert error on ${table}:`, error);
      throw error;
    }
  }

  // Generic update method
  async update(table, data, conditions, returning = true) {
    try {
      if (this.client === 'supabase') {
        return await this._supabaseUpdate(table, data, conditions, returning);
      } else {
        return await this._knexUpdate(table, data, conditions, returning);
      }
    } catch (error) {
      logger.error(`Database update error on ${table}:`, error);
      throw error;
    }
  }

  // Generic delete method
  async delete(table, conditions) {
    try {
      if (this.client === 'supabase') {
        return await this._supabaseDelete(table, conditions);
      } else {
        return await this._knexDelete(table, conditions);
      }
    } catch (error) {
      logger.error(`Database delete error on ${table}:`, error);
      throw error;
    }
  }

  // Count method
  async count(table, conditions = {}) {
    try {
      if (this.client === 'supabase') {
        return await this._supabaseCount(table, conditions);
      } else {
        return await this._knexCount(table, conditions);
      }
    } catch (error) {
      logger.error(`Database count error on ${table}:`, error);
      throw error;
    }
  }

  // Supabase implementation methods
  async _supabaseSelect(table, columns, conditions, options) {
    if (!supabase) {
      logger.warn('Supabase client not available, falling back to SQLite');
      return await this._knexSelect(table, columns, conditions, options);
    }
    let query = supabase.from(table);
    
    if (columns !== '*') {
      query = query.select(columns, { count: options.count || 'exact' });
    } else {
      query = query.select('*', { count: options.count || 'exact' });
    }

    // Apply conditions
    Object.entries(conditions).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        query = query.in(key, value);
      } else if (typeof value === 'object' && value.operator) {
        switch (value.operator) {
          case 'gt':
            query = query.gt(key, value.value);
            break;
          case 'gte':
            query = query.gte(key, value.value);
            break;
          case 'lt':
            query = query.lt(key, value.value);
            break;
          case 'lte':
            query = query.lte(key, value.value);
            break;
          case 'like':
            query = query.ilike(key, `%${value.value}%`);
            break;
          case 'or':
            query = query.or(value.value);
            break;
          default:
            query = query.eq(key, value.value);
        }
      } else {
        query = query.eq(key, value);
      }
    });

    // Apply options
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      const limit = options.limit || 10;
      query = query.range(options.offset, options.offset + limit - 1);
    }
    if (options.orderBy) {
      const { column, direction = 'asc' } = options.orderBy;
      query = query.order(column, { ascending: direction === 'asc' });
    }

    const { data, error, count } = await query;
    
    if (error) {
      throw error;
    }

    return {
      data: data || [],
      count: count || 0,
      success: true
    };
  }

  async _supabaseInsert(table, data, returning) {
    if (!supabase) {
      logger.warn('Supabase client not available, falling back to SQLite');
      return await this._knexInsert(table, data, returning);
    }
    let query = supabase.from(table).insert(data);
    
    if (returning) {
      query = query.select();
    }

    const { data: result, error } = await query;
    
    if (error) {
      throw error;
    }

    return {
      data: Array.isArray(data) ? result : (result && result[0]),
      success: true
    };
  }

  async _supabaseUpdate(table, data, conditions, returning) {
    if (!supabase) {
      logger.warn('Supabase client not available, falling back to SQLite');
      return await this._knexUpdate(table, data, conditions, returning);
    }
    let query = supabase.from(table).update(data);

    // Apply conditions
    Object.entries(conditions).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    if (returning) {
      query = query.select();
    }

    const { data: result, error } = await query;
    
    if (error) {
      throw error;
    }

    return {
      data: result,
      success: true
    };
  }

  async _supabaseDelete(table, conditions) {
    if (!supabase) {
      logger.warn('Supabase client not available, falling back to SQLite');
      return await this._knexDelete(table, conditions);
    }
    let query = supabase.from(table).delete();

    // Apply conditions
    Object.entries(conditions).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { error } = await query;
    
    if (error) {
      throw error;
    }

    return { success: true };
  }

  async _supabaseCount(table, conditions) {
    if (!supabase) {
      logger.warn('Supabase client not available, falling back to SQLite');
      return await this._knexCount(table, conditions);
    }
    let query = supabase.from(table).select('*', { count: 'exact', head: true });

    // Apply conditions
    Object.entries(conditions).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { count, error } = await query;
    
    if (error) {
      throw error;
    }

    return { count: count || 0, success: true };
  }

  // Knex implementation methods
  async _knexSelect(table, columns, conditions, options) {
    // Debug parameter validation
    if (typeof columns === 'object' && columns !== null && !Array.isArray(columns)) {
      logger.error(`Invalid columns parameter for table ${table}:`, { columns, conditions, options });
      // If columns is an object (likely options), use '*' as columns and shift parameters
      if (columns.limit || columns.offset || columns.orderBy) {
        logger.warn('Detected options object in columns position, correcting parameters');
        options = conditions || {};
        conditions = columns;
        columns = '*';
      }
    }
    
    let query = db(table);

    if (columns !== '*') {
      query = query.select(columns);
    } else {
      query = query.select('*');
    }

    // Apply conditions
    Object.entries(conditions).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        query = query.whereIn(key, value);
      } else if (typeof value === 'object' && value.operator) {
        switch (value.operator) {
          case 'gt':
            query = query.where(key, '>', value.value);
            break;
          case 'gte':
            query = query.where(key, '>=', value.value);
            break;
          case 'lt':
            query = query.where(key, '<', value.value);
            break;
          case 'lte':
            query = query.where(key, '<=', value.value);
            break;
          case 'like':
            query = query.where(key, 'like', `%${value.value}%`);
            break;
          default:
            query = query.where(key, value.value);
        }
      } else {
        query = query.where(key, value);
      }
    });

    // Apply options
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.offset(options.offset);
    }
    if (options.orderBy) {
      const { column, direction = 'asc' } = options.orderBy;
      query = query.orderBy(column, direction);
    }

    const data = await query;
    
    // Get count if needed
    let count = 0;
    if (options.count) {
      const countQuery = db(table).count('* as count');
      Object.entries(conditions).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          countQuery.whereIn(key, value);
        } else {
          countQuery.where(key, value);
        }
      });
      const countResult = await countQuery.first();
      count = parseInt(countResult.count);
    }

    return {
      data: data || [],
      count,
      success: true
    };
  }

  async _knexInsert(table, data, returning) {
    const query = db(table).insert(data);
    
    if (returning) {
      query.returning('*');
    }

    const result = await query;
    
    return {
      data: Array.isArray(data) ? result : result[0],
      success: true
    };
  }

  async _knexUpdate(table, data, conditions, returning) {
    let query = db(table).update(data);

    // Apply conditions
    Object.entries(conditions).forEach(([key, value]) => {
      query = query.where(key, value);
    });

    if (returning) {
      query = query.returning('*');
    }

    const result = await query;
    
    return {
      data: result,
      success: true
    };
  }

  async _knexDelete(table, conditions) {
    let query = db(table).delete();

    // Apply conditions
    Object.entries(conditions).forEach(([key, value]) => {
      query = query.where(key, value);
    });

    await query;
    
    return { success: true };
  }

  async _knexCount(table, conditions) {
    let query = db(table).count('* as count');

    // Apply conditions
    Object.entries(conditions).forEach(([key, value]) => {
      query = query.where(key, value);
    });

    const result = await query.first();
    
    return { 
      count: parseInt(result.count), 
      success: true 
    };
  }

  // Test connection method
  async testConnection() {
    try {
      if (this.client === 'supabase') {
        if (!supabase) {
          logger.warn('Supabase client not available, falling back to SQLite');
          return false;
        }
        const { data, error } = await supabase.from('users').select('count').limit(1);
        if (error && error.code !== 'PGRST116') {
          throw error;
        }
        logger.info('Supabase connection successful');
        return true;
      } else {
        await db.raw('SELECT 1');
        logger.info(`Database connection successful (${this.client})`);
        return true;
      }
    } catch (error) {
      logger.error('Database connection failed:', error);
      return false;
    }
  }

  // Get client type
  getClientType() {
    return this.client;
  }
}

module.exports = new DatabaseAdapter();