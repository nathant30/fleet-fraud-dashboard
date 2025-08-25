const knex = require('knex');
const config = require('./database');

// Create the database connection
const db = knex(config);

// Test the connection
const testConnection = async () => {
  try {
    await db.raw('SELECT 1');
    console.log(`✅ Database connection successful (${config.client})`);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

// Graceful shutdown
const closeConnection = async () => {
  try {
    await db.destroy();
    console.log('📴 Database connection closed');
  } catch (error) {
    console.error('Error closing database connection:', error.message);
  }
};

// Handle process termination
process.on('SIGINT', async () => {
  await closeConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeConnection();
  process.exit(0);
});

module.exports = {
  db,
  testConnection,
  closeConnection
};