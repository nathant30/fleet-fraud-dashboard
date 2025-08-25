module.exports = {
  // Test environment for Node.js API tests
  testEnvironment: 'node',
  
  // Test file patterns for API tests only
  testMatch: [
    '<rootDir>/tests/api.test.js',
    '<rootDir>/tests/integration.test.js',
    '<rootDir>/tests/database.test.js',
    '<rootDir>/tests/fraud-detection.test.js'
  ],
  
  // Setup for Node.js environment
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Transform files
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/build/',
    '<rootDir>/src/' // Ignore frontend tests
  ],
  
  // Coverage configuration for backend
  collectCoverageFrom: [
    'server.js',
    'routes/**/*.js',
    'middleware/**/*.js',
    'config/**/*.js',
    'utils/**/*.js',
    '!**/*.test.js',
    '!**/*.spec.js'
  ],
  
  // Module file extensions
  moduleFileExtensions: ['js', 'json', 'node'],
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Timeout
  testTimeout: 30000,
  
  // Global setup/teardown
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js'
};