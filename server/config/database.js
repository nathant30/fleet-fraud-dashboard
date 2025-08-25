const path = require('path');
require('dotenv').config();

const dbType = process.env.DB_TYPE || 'sqlite';

const baseConfig = {
  migrations: {
    directory: path.join(__dirname, '../../database/migrations'),
    tableName: 'knex_migrations'
  },
  seeds: {
    directory: path.join(__dirname, '../../database/seeds')
  }
};

const configurations = {
  development: {
    ...baseConfig,
    client: 'sqlite3',
    connection: {
      filename: process.env.SQLITE_DB_PATH || path.join(__dirname, '../../database/fleet_fraud.db')
    },
    useNullAsDefault: true,
    pool: {
      afterCreate: (conn, cb) => {
        // Enable foreign key constraints in SQLite
        conn.run('PRAGMA foreign_keys = ON', cb);
      }
    }
  },

  production: {
    ...baseConfig,
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    },
    pool: {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 100,
      propagateCreateError: false
    }
  },

  test: {
    ...baseConfig,
    client: 'sqlite3',
    connection: {
      filename: path.join(__dirname, '../../database/fleet_fraud_test.db')
    },
    useNullAsDefault: true,
    pool: {
      afterCreate: (conn, cb) => {
        conn.run('PRAGMA foreign_keys = ON', cb);
      }
    }
  }
};

// Determine which configuration to use based on environment
const environment = process.env.NODE_ENV || 'development';
let config;

if (dbType === 'postgresql' || environment === 'production') {
  config = configurations.production;
} else if (environment === 'test') {
  config = configurations.test;
} else {
  config = configurations.development;
}

module.exports = config;