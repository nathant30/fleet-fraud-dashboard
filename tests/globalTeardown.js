// Global teardown for API tests
module.exports = async () => {
  console.log('🧹 Cleaning up API tests environment...');
  
  // Clean up test database if needed
  const fs = require('fs');
  const testDbPath = './database/fleet_fraud_test.db';
  
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
      console.log('🗑️  Test database cleaned up');
    } catch (error) {
      console.warn('⚠️  Could not clean up test database:', error.message);
    }
  }
  
  console.log('✅ API test cleanup complete');
};