#!/usr/bin/env node

const { db, testConnection } = require('../config/connection');

async function resetDatabase() {
  console.log('🔄 Resetting database...');
  
  try {
    // Test connection first
    const isConnected = await testConnection();
    if (!isConnected) {
      console.error('❌ Cannot connect to database. Exiting.');
      process.exit(1);
    }

    // Rollback all migrations
    console.log('📦 Rolling back migrations...');
    await db.migrate.rollback();
    
    // Run migrations again
    console.log('🔄 Running fresh migrations...');
    const [batchNo, migrationFiles] = await db.migrate.latest();
    
    console.log(`✅ Database reset complete. Batch ${batchNo} migrations applied:`);
    migrationFiles.forEach(file => {
      console.log(`  - ${file}`);
    });
    
    // Run seeds if they exist
    try {
      console.log('🌱 Running seeds...');
      const seedFiles = await db.seed.run();
      if (seedFiles.length > 0) {
        console.log('✅ Seeds applied:');
        seedFiles.forEach(file => {
          console.log(`  - ${file}`);
        });
      }
    } catch (seedError) {
      console.log('ℹ️  No seeds to run or seeds failed:', seedError.message);
    }
    
  } catch (error) {
    console.error('❌ Database reset failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

// Handle CLI usage
if (require.main === module) {
  resetDatabase();
}

module.exports = { resetDatabase };