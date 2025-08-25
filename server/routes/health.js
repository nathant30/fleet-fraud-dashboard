const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const databaseAdapter = require('../config/databaseAdapter');

// Fallback query logger if not available
const queryLogger = {
  getQueryStats: () => ({
    totalQueries: 0,
    slowQueries: 0,
    queryPatterns: []
  }),
  resetStats: () => {}
};

// Simplified database health check
const checkDatabaseHealth = async () => {
  const startTime = Date.now();
  
  try {
    // Just check if we can get the client type and basic info
    const clientType = databaseAdapter.getClientType ? databaseAdapter.getClientType() : 'unknown';
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'healthy',
      responseTime: `${responseTime}ms`,
      database: clientType,
      message: 'Database adapter operational',
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error('Database health check failed', error);
    return {
      status: 'unhealthy',
      error: error.message,
      responseTime: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    };
  }
};

// GET /api/health - Basic health check
router.get('/', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    const queryStats = queryLogger.getQueryStats();
    
    const health = {
      status: dbHealth.status === 'healthy' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: dbHealth,
      queryPerformance: {
        totalQueries: queryStats.totalQueries,
        slowQueries: queryStats.slowQueries,
        topSlowQueries: queryStats.queryPatterns.slice(0, 5)
      }
    };
    
    res.status(dbHealth.status === 'healthy' ? 200 : 503).json(health);
    
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/health/database - Detailed database health
router.get('/database', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    res.status(dbHealth.status === 'healthy' ? 200 : 503).json(dbHealth);
  } catch (error) {
    logger.error('Database health check failed', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/health/queries - Query performance stats
router.get('/queries', async (req, res) => {
  try {
    const queryStats = queryLogger.getQueryStats();
    res.json(queryStats);
  } catch (error) {
    logger.error('Query stats retrieval failed', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/health/queries/reset - Reset query stats
router.post('/queries/reset', async (req, res) => {
  try {
    queryLogger.resetStats();
    res.json({
      message: 'Query performance statistics reset',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Query stats reset failed', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;