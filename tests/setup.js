// Node.js environment setup for API tests

// Add TextEncoder/TextDecoder polyfills for Node.js
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Additional polyfills for crypto-related libraries
if (!global.crypto) {
  const crypto = require('crypto');
  global.crypto = {
    getRandomValues: (arr) => {
      return crypto.randomFillSync(arr);
    },
    subtle: crypto.webcrypto?.subtle
  };
}

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.PORT = '3004'; // Different port for testing to avoid conflicts
process.env.API_SECRET_KEY = 'test-api-secret-key';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Mock Supabase for testing (since we don't have real credentials)
process.env.DB_TYPE = 'sqlite';
process.env.SQLITE_DB_PATH = './database/fleet_fraud_test.db';

// Set test timeout
jest.setTimeout(45000);