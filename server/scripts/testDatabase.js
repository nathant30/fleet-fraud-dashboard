#!/usr/bin/env node

const databaseAdapter = require('../config/databaseAdapter');

async function testDatabaseOperations() {
  console.log('🧪 Testing Database Operations');
  console.log('==============================');
  
  try {
    const clientType = databaseAdapter.getClientType();
    console.log(`📊 Database Client: ${clientType}`);
    
    // Test connection
    console.log('🔍 Testing connection...');
    const isConnected = await databaseAdapter.testConnection();
    
    if (!isConnected) {
      console.error('❌ Database connection failed');
      process.exit(1);
    }
    
    console.log('✅ Connection successful');
    
    // Test basic operations
    console.log('\n🔍 Testing basic operations...');
    
    // Test count
    const userCount = await databaseAdapter.count('users');
    console.log(`👥 Users count: ${userCount.count}`);
    
    const companyCount = await databaseAdapter.count('companies');
    console.log(`🏢 Companies count: ${companyCount.count}`);
    
    const vehicleCount = await databaseAdapter.count('vehicles');
    console.log(`🚛 Vehicles count: ${vehicleCount.count}`);
    
    const claimCount = await databaseAdapter.count('insurance_claims');
    console.log(`📋 Claims count: ${claimCount.count}`);
    
    // Test select with conditions
    console.log('\n🔍 Testing select operations...');
    
    const activeVehicles = await databaseAdapter.select('vehicles', '*', { status: 'active' });
    console.log(`🟢 Active vehicles: ${activeVehicles.data.length}`);
    
    const fraudClaims = await databaseAdapter.select('insurance_claims', '*', { fraud_flag: true });
    console.log(`🚨 Fraud claims: ${fraudClaims.data.length}`);
    
    // Test complex query
    const highRiskDrivers = await databaseAdapter.select('drivers', '*', { 
      risk_score: { operator: 'gt', value: 5.0 } 
    });
    console.log(`⚠️  High risk drivers: ${highRiskDrivers.data.length}`);
    
    console.log('\n✅ All database operations successful!');
    console.log('🎉 Database is properly configured and functional');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle CLI usage
if (require.main === module) {
  testDatabaseOperations();
}

module.exports = { testDatabaseOperations };