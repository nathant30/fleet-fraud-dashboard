const logger = require('./logger');

/**
 * Simple in-memory cache with TTL (Time To Live)
 * Useful for caching API responses to reduce database load
 */
class SimpleCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  /**
   * Set a value in cache with TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds (default 5 minutes)
   */
  set(key, value, ttl = 300000) {
    // Clear existing timer if key exists
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Store the value
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    });

    // Set expiration timer
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl);

    this.timers.set(key, timer);
    
    logger.debug(`Cache SET: ${key} (TTL: ${ttl}ms)`);
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null if not found/expired
   */
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      logger.debug(`Cache MISS: ${key}`);
      return null;
    }

    // Check if expired (double check)
    if (Date.now() - item.timestamp > item.ttl) {
      this.delete(key);
      logger.debug(`Cache EXPIRED: ${key}`);
      return null;
    }

    logger.debug(`Cache HIT: ${key}`);
    return item.value;
  }

  /**
   * Delete a value from cache
   * @param {string} key - Cache key
   */
  delete(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    
    const existed = this.cache.delete(key);
    if (existed) {
      logger.debug(`Cache DELETE: ${key}`);
    }
  }

  /**
   * Clear all cache entries
   */
  clear() {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    
    this.timers.clear();
    this.cache.clear();
    logger.debug('Cache CLEARED');
  }

  /**
   * Get cache statistics
   * @returns {object} Cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      memoryUsage: this._estimateMemoryUsage()
    };
  }

  /**
   * Estimate memory usage (rough approximation)
   * @private
   */
  _estimateMemoryUsage() {
    let size = 0;
    for (const [key, value] of this.cache) {
      size += key.length * 2; // String characters are 2 bytes each
      size += JSON.stringify(value.value).length * 2; // Rough JSON size
      size += 32; // Overhead for timestamp, ttl, etc.
    }
    return `${Math.round(size / 1024)}KB`;
  }
}

// Create global cache instance
const cache = new SimpleCache();

// Cache middleware for Express routes
const cacheMiddleware = (ttl = 300000) => {
  return (req, res, next) => {
    // Create cache key based on URL and query parameters
    const cacheKey = req.originalUrl || req.url;
    
    // Try to get cached response
    const cachedResponse = cache.get(cacheKey);
    
    if (cachedResponse) {
      // Return cached response
      return res.json(cachedResponse);
    }

    // Override res.json to cache the response
    const originalJson = res.json;
    res.json = function(data) {
      // Cache successful responses only
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(cacheKey, data, ttl);
      }
      
      // Call original json method
      return originalJson.call(this, data);
    };

    next();
  };
};

module.exports = {
  cache,
  cacheMiddleware
};