const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { validateToken, sensitiveOperationLimit } = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
  body('firstName').isLength({ min: 1 }).trim(),
  body('lastName').isLength({ min: 1 }).trim(),
  body('companyName').isLength({ min: 1 }).trim()
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 1 })
];

// Register new user and company
router.post('/register', registerValidation, async (req, res) => {
  try {
    // Check if Supabase is available for authentication
    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: 'Authentication service unavailable',
        message: 'Authentication requires Supabase configuration. Please configure Supabase environment variables.'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password, firstName, lastName, companyName, phone } = req.body;

    // Check if user already exists
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const userExists = existingUser.users.some(user => user.email === email);

    if (userExists) {
      return res.status(400).json({
        success: false,
        error: 'User already exists'
      });
    }

    // Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName
      }
    });

    if (authError) {
      throw authError;
    }

    // Create company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert([{
        name: companyName,
        email: email,
        phone: phone
      }])
      .select()
      .single();

    if (companyError) {
      // Cleanup: delete auth user if company creation fails
      await supabase.auth.admin.deleteUser(authUser.user.id);
      throw companyError;
    }

    // Create user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert([{
        user_id: authUser.user.id,
        company_id: company.id,
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone: phone,
        role: 'admin'
      }]);

    if (profileError) {
      // Cleanup: delete auth user and company if profile creation fails
      await supabase.auth.admin.deleteUser(authUser.user.id);
      await supabase.from('companies').delete().eq('id', company.id);
      throw profileError;
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        sub: authUser.user.id,
        email: authUser.user.email,
        company_id: company.id,
        role: 'admin'
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    logger.info('User registered successfully', {
      userId: authUser.user.id,
      email,
      companyId: company.id
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: authUser.user.id,
          email: authUser.user.email,
          firstName,
          lastName
        },
        company: {
          id: company.id,
          name: company.name
        },
        token
      }
    });

  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed',
      message: error.message
    });
  }
});

// Login user
router.post('/login', loginValidation, async (req, res) => {
  try {
    // Check if Supabase is available for authentication
    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: 'Authentication service unavailable',
        message: 'Authentication requires Supabase configuration. Please configure Supabase environment variables.'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password } = req.body;

    // Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      logger.warn('Login attempt failed', {
        email,
        error: authError.message,
        ip: req.ip
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Get user profile and company info
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select(`
        *,
        companies:company_id (
          id,
          name,
          email
        )
      `)
      .eq('user_id', authData.user.id)
      .single();

    if (profileError) {
      throw profileError;
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        sub: authData.user.id,
        email: authData.user.email,
        company_id: profile.company_id,
        role: profile.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    logger.info('User logged in successfully', {
      userId: authData.user.id,
      email,
      companyId: profile.company_id
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: authData.user.id,
          email: authData.user.email,
          firstName: profile.first_name,
          lastName: profile.last_name,
          role: profile.role
        },
        company: profile.companies,
        token
      }
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
      message: error.message
    });
  }
});

// Refresh token
router.post('/refresh', validateToken, async (req, res) => {
  try {
    // Get updated user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select(`
        *,
        companies:company_id (
          id,
          name,
          email
        )
      `)
      .eq('user_id', req.userId)
      .single();

    if (profileError) {
      throw profileError;
    }

    // Generate new JWT token
    const token = jwt.sign(
      { 
        sub: req.userId,
        email: profile.email,
        company_id: profile.company_id,
        role: profile.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        user: {
          id: req.userId,
          email: profile.email,
          firstName: profile.first_name,
          lastName: profile.last_name,
          role: profile.role
        },
        company: profile.companies,
        token
      }
    });

  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Token refresh failed'
    });
  }
});

// Logout (optional - mainly for logging purposes)
router.post('/logout', validateToken, async (req, res) => {
  try {
    logger.info('User logged out', {
      userId: req.userId,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

// Change password
router.post('/change-password', 
  validateToken, 
  sensitiveOperationLimit,
  [
    body('currentPassword').isLength({ min: 1 }),
    body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { currentPassword, newPassword } = req.body;

      // Update password in Supabase Auth
      const { error } = await supabase.auth.admin.updateUserById(req.userId, {
        password: newPassword
      });

      if (error) {
        throw error;
      }

      logger.info('Password changed successfully', {
        userId: req.userId,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      logger.error('Password change error:', error);
      res.status(500).json({
        success: false,
        error: 'Password change failed'
      });
    }
  }
);

// Get current user profile
router.get('/profile', validateToken, async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select(`
        *,
        companies:company_id (
          id,
          name,
          email,
          phone,
          address
        )
      `)
      .eq('user_id', req.userId)
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: {
        user: {
          id: req.userId,
          email: profile.email,
          firstName: profile.first_name,
          lastName: profile.last_name,
          phone: profile.phone,
          role: profile.role
        },
        company: profile.companies
      }
    });

  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user profile'
    });
  }
});

module.exports = router;