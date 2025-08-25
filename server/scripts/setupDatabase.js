#!/usr/bin/env node

const databaseAdapter = require('../config/databaseAdapter');
const { runMigrations } = require('./migrate');
const { runSeeds } = require('./seed');
const logger = require('../../utils/logger');

async function setupDatabase() {
  console.log('🔧 Fleet Fraud Dashboard - Database Setup');
  console.log('==========================================');
  
  try {
    const clientType = databaseAdapter.getClientType();
    console.log(`📊 Database Client: ${clientType}`);
    
    // Test connection
    console.log('🔍 Testing database connection...');
    const isConnected = await databaseAdapter.testConnection();
    
    if (!isConnected) {
      console.error('❌ Database connection failed. Please check your configuration.');
      process.exit(1);
    }
    
    if (clientType === 'supabase') {
      console.log('✅ Supabase connection successful');
      console.log('ℹ️  For Supabase setup, please ensure your database has the required tables.');
      console.log('ℹ️  You can create them using the Supabase dashboard or SQL editor.');
      console.log('ℹ️  SQL schema file available at: database/schema.sql');
      console.log('ℹ️  Or use the SQL commands from the schema file in your Supabase SQL editor.');
      
      // Test if main tables exist
      await testSupabaseTables();
      
    } else {
      console.log('✅ Local database connection successful');
      console.log('🔄 Running migrations for local development...');
      
      // Run migrations for local SQLite/PostgreSQL
      await runMigrations();
      
      console.log('🌱 Running seeds for sample data...');
      await runSeeds();
    }
    
    console.log('✅ Database setup completed successfully!');
    console.log('🚀 You can now start the server with: npm run dev');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

async function testSupabaseTables() {
  console.log('🔍 Testing Supabase table access...');
  
  const tables = ['users', 'companies', 'vehicles', 'drivers', 'insurance_policies', 'insurance_claims'];
  const tableStatus = {};
  
  for (const table of tables) {
    try {
      const result = await databaseAdapter.select(table, 'id', {}, { limit: 1 });
      tableStatus[table] = '✅ Accessible';
    } catch (error) {
      if (error.code === 'PGRST116' || error.message.includes('relation') || error.message.includes('does not exist')) {
        tableStatus[table] = '❌ Missing';
      } else if (error.code === '42501' || error.message.includes('permission')) {
        tableStatus[table] = '⚠️  Permission denied';
      } else {
        tableStatus[table] = `❓ Unknown error: ${error.message}`;
      }
    }
  }
  
  console.log('\n📋 Table Status:');
  Object.entries(tableStatus).forEach(([table, status]) => {
    console.log(`   ${table}: ${status}`);
  });
  
  const missingTables = Object.entries(tableStatus)
    .filter(([table, status]) => status.includes('❌'))
    .map(([table]) => table);
  
  if (missingTables.length > 0) {
    console.log(`\n⚠️  Missing tables detected: ${missingTables.join(', ')}`);
    console.log('📄 Please create these tables in your Supabase database using the schema file.');
    console.log('📂 Schema file location: database/schema.sql');
  } else {
    console.log('\n✅ All required tables are accessible!');
  }
}

// Handle CLI usage
if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase };