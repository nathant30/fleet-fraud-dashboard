// Global setup for API tests
module.exports = async () => {
  console.log('🔧 Setting up API tests environment...');
  
  // Ensure test database directory exists
  const fs = require('fs');
  const path = require('path');
  
  const dbDir = path.dirname('./database/fleet_fraud_test.db');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  console.log('✅ API test environment ready');
};