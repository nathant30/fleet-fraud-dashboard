const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');

// Validate API key for general API access
const validateApiKey = async (req, res, next) => {
  try {
    // Development bypass for testing
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      const devApiKey = req.headers['x-api-key'];
      if (devApiKey === 'dev-api-key-12345-change-in-production' || 
          devApiKey === 'test-api-key' || 
          !devApiKey) {
        return next();
      }
    }

    const apiKey = req.headers['x-api-key'] || req.headers.authorization?.replace('Bearer ', '');
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required'
      });
    }

    // In a production environment, you would validate this against a database
    // For now, we'll check against environment variable
    if (apiKey !== process.env.API_SECRET_KEY) {
      logger.warn('Invalid API key attempt', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl
      });
      
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    next();
  } catch (error) {
    logger.error('API key validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
};

// Validate JWT token for authenticated user operations
const validateToken = async (req, res, next) => {
  try {
    // Development bypass for testing
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token || token === 'dev-token-for-development' || token === 'test-token') {
        // Set development defaults
        req.user = { id: 'dev-user-1', email: 'dev@test.com' };
        req.userId = 'dev-user-1';
        req.userCompanyId = 'dev-company-1';
        return next();
      }
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // If Supabase is configured, validate with Supabase
    if (supabase) {
      try {
        const { data: user, error } = await supabase.auth.getUser(token);
        
        if (error || !user) {
          return res.status(401).json({
            success: false,
            error: 'Invalid or expired token'
          });
        }
        req.user = user;
      } catch (supabaseError) {
        logger.warn('Supabase auth check failed, using JWT only', { error: supabaseError.message });
        // Fall back to JWT-only validation
        req.user = { id: decoded.sub, email: decoded.email };
      }
    } else {
      // No Supabase configured, use JWT only (development mode)
      req.user = { id: decoded.sub, email: decoded.email || 'dev@test.com' };
    }

    req.userId = decoded.sub;
    req.userCompanyId = decoded.company_id || 'dev-company-1'; // Fallback for development
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    logger.error('Token validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
};

// Check if user has required role/permission
const requireRole = (requiredRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // In development/test mode, assign admin role for testing
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        req.userRoles = ['admin', 'manager', 'user'];
        return next();
      }

      // Get user roles from database (only in production with Supabase)
      if (supabase) {
        const { data: userRoles, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', req.userId);

        if (error) {
          throw error;
        }

        const userRoleList = userRoles.map(r => r.role);
      } else {
        // Fallback for non-Supabase environments
        const userRoleList = ['admin', 'manager'];
      }
      const hasRequiredRole = requiredRoles.some(role => userRoleList.includes(role));

      if (!hasRequiredRole) {
        logger.warn('Insufficient permissions', {
          userId: req.userId,
          requiredRoles,
          userRoles: userRoleList,
          endpoint: req.originalUrl
        });

        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      req.userRoles = userRoleList;
      next();
    } catch (error) {
      logger.error('Role validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Authorization error'
      });
    }
  };
};

// Rate limiting for sensitive operations
const sensitiveOperationLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs for sensitive operations
  message: {
    error: 'Too many sensitive operations, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Optional authentication (for endpoints that work with or without auth)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { data: user, error } = await supabase.auth.getUser(token);
      
      if (!error && user) {
        req.user = user;
        req.userId = decoded.sub;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};

// Company access control - ensure user can only access their company's data
const validateCompanyAccess = async (req, res, next) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // If company ID is already set (from token validation), use it
    if (req.userCompanyId) {
      // If company_id is provided in request, validate it matches user's company
      const requestedCompanyId = req.params.company_id || req.body.company_id || req.query.company_id;
      
      if (requestedCompanyId && requestedCompanyId !== req.userCompanyId) {
        logger.warn('Unauthorized company access attempt', {
          userId: req.userId,
          userCompanyId: req.userCompanyId,
          requestedCompanyId,
          endpoint: req.originalUrl
        });

        return res.status(403).json({
          success: false,
          error: 'Unauthorized access to company data'
        });
      }

      return next();
    }

    // If Supabase is available, get user's company ID from database
    if (supabase) {
      try {
        const { data: userData, error } = await supabase
          .from('user_profiles')
          .select('company_id')
          .eq('user_id', req.userId)
          .single();

        if (error || !userData) {
          // Fallback to development company
          req.userCompanyId = 'dev-company-1';
          logger.warn('Using fallback company ID for development', { userId: req.userId });
        } else {
          req.userCompanyId = userData.company_id;
        }
      } catch (supabaseError) {
        logger.warn('Supabase company lookup failed, using fallback', { error: supabaseError.message });
        req.userCompanyId = 'dev-company-1';
      }
    } else {
      // No Supabase, use development fallback
      req.userCompanyId = 'dev-company-1';
    }

    // Validate requested company matches user's company
    const requestedCompanyId = req.params.company_id || req.body.company_id || req.query.company_id;
    
    if (requestedCompanyId && requestedCompanyId !== req.userCompanyId) {
      logger.warn('Unauthorized company access attempt', {
        userId: req.userId,
        userCompanyId: req.userCompanyId,
        requestedCompanyId,
        endpoint: req.originalUrl
      });

      return res.status(403).json({
        success: false,
        error: 'Unauthorized access to company data'
      });
    }

    next();
  } catch (error) {
    logger.error('Company access validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Authorization error'
    });
  }
};

module.exports = {
  validateApiKey,
  validateToken,
  requireRole,
  sensitiveOperationLimit,
  optionalAuth,
  validateCompanyAccess
};