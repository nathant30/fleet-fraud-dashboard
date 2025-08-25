const logger = require('../../utils/logger');

class QueryPerformanceLogger {
  constructor() {
    this.slowQueryThreshold = 100; // ms
    this.queryStats = new Map();
  }

  logQuery(query, duration, params = {}) {
    const queryHash = this.hashQuery(query);
    
    // Update statistics
    if (!this.queryStats.has(queryHash)) {
      this.queryStats.set(queryHash, {
        query: query.substring(0, 100) + '...',
        count: 0,
        totalTime: 0,
        maxTime: 0,
        avgTime: 0
      });
    }
    
    const stats = this.queryStats.get(queryHash);
    stats.count++;
    stats.totalTime += duration;
    stats.maxTime = Math.max(stats.maxTime, duration);
    stats.avgTime = stats.totalTime / stats.count;
    
    // Log slow queries
    if (duration > this.slowQueryThreshold) {
      logger.warn('Slow database query detected', {
        query: query.substring(0, 200),
        duration: `${duration}ms`,
        params: params,
        threshold: `${this.slowQueryThreshold}ms`
      });
    }
    
    // Log query execution for debug
    logger.debug('Database query executed', {
      query: query.substring(0, 100),
      duration: `${duration}ms`,
      params: params
    });
  }

  hashQuery(query) {
    // Simple hash for grouping similar queries
    return query
      .replace(/\d+/g, '?')
      .replace(/'[^']*'/g, '?')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  getQueryStats() {
    const sortedStats = Array.from(this.queryStats.entries())
      .sort((a, b) => b[1].totalTime - a[1].totalTime)
      .map(([hash, stats]) => ({
        queryPattern: stats.query,
        executionCount: stats.count,
        totalTimeMs: stats.totalTime,
        averageTimeMs: Math.round(stats.avgTime * 100) / 100,
        maxTimeMs: stats.maxTime
      }));
    
    return {
      totalQueries: Array.from(this.queryStats.values()).reduce((sum, stats) => sum + stats.count, 0),
      slowQueries: Array.from(this.queryStats.values()).filter(stats => stats.maxTime > this.slowQueryThreshold).length,
      queryPatterns: sortedStats
    };
  }

  resetStats() {
    this.queryStats.clear();
    logger.info('Query performance statistics reset');
  }
}

// Singleton instance
const queryLogger = new QueryPerformanceLogger();

// Knex query event wrapper
function wrapKnexWithLogging(knex) {
  knex.on('query', (queryData) => {
    const startTime = Date.now();
    
    queryData.response = queryData.response || {};
    queryData.response.then = function(onFulfilled, onRejected) {
      const duration = Date.now() - startTime;
      queryLogger.logQuery(queryData.sql, duration, queryData.bindings);
      
      return Promise.prototype.then.call(this, onFulfilled, onRejected);
    };
  });
  
  return knex;
}

module.exports = {
  queryLogger,
  wrapKnexWithLogging
};