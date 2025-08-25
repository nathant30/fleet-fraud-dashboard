#!/usr/bin/env node

const { db, testConnection } = require('../config/connection');

async function runSeeds() {
  console.log('🌱 Starting database seeding...');
  
  try {
    // Test connection first
    const isConnected = await testConnection();
    if (!isConnected) {
      console.error('❌ Cannot connect to database. Exiting.');
      process.exit(1);
    }

    // Run seeds
    const seedFiles = await db.seed.run();
    
    if (seedFiles.length === 0) {
      console.log('✅ No seed files to run');
    } else {
      console.log('✅ Seeds completed:');
      seedFiles.forEach(file => {
        console.log(`  - ${file}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

// Handle CLI usage
if (require.main === module) {
  runSeeds();
}

module.exports = { runSeeds };