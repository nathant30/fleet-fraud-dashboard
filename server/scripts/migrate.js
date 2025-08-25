#!/usr/bin/env node

const { db, testConnection } = require('../config/connection');

async function runMigrations() {
  console.log('🔄 Starting database migrations...');
  
  try {
    // Test connection first
    const isConnected = await testConnection();
    if (!isConnected) {
      console.error('❌ Cannot connect to database. Exiting.');
      process.exit(1);
    }

    // Run migrations
    const [batchNo, migrationFiles] = await db.migrate.latest();
    
    if (migrationFiles.length === 0) {
      console.log('✅ Database is already up to date');
    } else {
      console.log(`✅ Batch ${batchNo} migrations completed:`);
      migrationFiles.forEach(file => {
        console.log(`  - ${file}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

// Handle CLI usage
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };