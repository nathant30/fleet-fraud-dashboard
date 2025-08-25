const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const databaseAdapter = require('../server/config/databaseAdapter');
const logger = require('../utils/logger');
const { validateToken, validateCompanyAccess, requireRole } = require('../middleware/auth');

const router = express.Router();

// Validation schemas
const driverValidation = [
  body('employee_id').optional().isLength({ min: 1 }).trim(),
  body('first_name').isLength({ min: 1 }).trim(),
  body('last_name').isLength({ min: 1 }).trim(),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isLength({ min: 1 }).trim(),
  body('license_number').isLength({ min: 1 }).trim(),
  body('license_expiry').optional().isISO8601().toDate(),
  body('hire_date').optional().isISO8601().toDate(),
  body('status').optional().isIn(['active', 'inactive', 'suspended'])
];

const updateDriverValidation = [
  param('id').isUUID(),
  body('employee_id').optional().isLength({ min: 1 }).trim(),
  body('first_name').optional().isLength({ min: 1 }).trim(),
  body('last_name').optional().isLength({ min: 1 }).trim(),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isLength({ min: 1 }).trim(),
  body('license_number').optional().isLength({ min: 1 }).trim(),
  body('license_expiry').optional().isISO8601().toDate(),
  body('hire_date').optional().isISO8601().toDate(),
  body('status').optional().isIn(['active', 'inactive', 'suspended']),
  body('risk_score').optional().isFloat({ min: 0, max: 1 })
];

// Get all drivers for a company
router.get('/', validateToken, validateCompanyAccess, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search, sort_by = 'created_at', sort_order = 'desc' } = req.query;
    const offset = (page - 1) * limit;

    // Build conditions for database query
    const conditions = { company_id: req.userCompanyId };
    if (status) {
      conditions.status = status;
    }

    // Handle search with OR conditions (simplified for database compatibility)
    if (search) {
      conditions.search = {
        operator: 'or',
        value: `first_name.ilike.%${search}%,last_name.ilike.%${search}%,employee_id.ilike.%${search}%,email.ilike.%${search}%,license_number.ilike.%${search}%`
      };
    }

    const options = {
      limit: parseInt(limit),
      offset,
      orderBy: { column: sort_by, direction: sort_order },
      count: true
    };

    const result = await databaseAdapter.select('drivers', '*', conditions, options);
    const drivers = result.data;
    const count = result.count;

    res.json({
      success: true,
      data: drivers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    logger.error('Get drivers error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch drivers'
    });
  }
});

// Get driver by ID
router.get('/:id', validateToken, validateCompanyAccess, 
  [param('id').isUUID()],
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

      const conditions = { 
        id: req.params.id,
        company_id: req.userCompanyId 
      };

      const result = await databaseAdapter.select('drivers', '*', conditions);
      const driver = result.data && result.data.length > 0 ? result.data[0] : null;

      if (!driver) {
        return res.status(404).json({
          success: false,
          error: 'Driver not found'
        });
      }

      res.json({
        success: true,
        data: driver
      });

    } catch (error) {
      logger.error('Get driver error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch driver'
      });
    }
  }
);

// Create new driver
router.post('/', validateToken, validateCompanyAccess, driverValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const driverData = {
      ...req.body,
      company_id: req.userCompanyId
    };

    const result = await databaseAdapter.insert('drivers', driverData);
    const driver = result.data;

    logger.info('Driver created', {
      driverId: driver.id,
      employeeId: driver.employee_id,
      name: `${driver.first_name} ${driver.last_name}`,
      companyId: req.userCompanyId,
      createdBy: req.userId
    });

    res.status(201).json({
      success: true,
      message: 'Driver created successfully',
      data: driver
    });

  } catch (error) {
    logger.error('Create driver error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create driver'
    });
  }
});

// Update driver
router.put('/:id', validateToken, validateCompanyAccess, updateDriverValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    // Check if driver exists and belongs to company
    const conditions = { 
      id: req.params.id,
      company_id: req.userCompanyId 
    };
    
    const existingResult = await databaseAdapter.select('drivers', 'id', conditions);
    const existingDriver = existingResult.data && existingResult.data.length > 0 ? existingResult.data[0] : null;

    if (!existingDriver) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found'
      });
    }

    const result = await databaseAdapter.update('drivers', req.body, conditions);
    const driver = result.data;

    logger.info('Driver updated', {
      driverId: driver.id,
      employeeId: driver.employee_id,
      name: `${driver.first_name} ${driver.last_name}`,
      companyId: req.userCompanyId,
      updatedBy: req.userId
    });

    res.json({
      success: true,
      message: 'Driver updated successfully',
      data: driver
    });

  } catch (error) {
    logger.error('Update driver error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update driver'
    });
  }
});

// Delete driver
router.delete('/:id', 
  validateToken, 
  validateCompanyAccess, 
  requireRole(['admin', 'manager']),
  [param('id').isUUID()],
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

      // Check if driver has active trips
      const tripConditions = {
        driver_id: req.params.id,
        status: 'in_progress'
      };
      
      const tripResult = await databaseAdapter.select('trips', 'id', tripConditions);
      const activeTrips = tripResult.data || [];

      if (activeTrips.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete driver with active trips'
        });
      }

      const deleteConditions = {
        id: req.params.id,
        company_id: req.userCompanyId
      };
      
      await databaseAdapter.delete('drivers', deleteConditions);

      logger.info('Driver deleted', {
        driverId: req.params.id,
        companyId: req.userCompanyId,
        deletedBy: req.userId
      });

      res.json({
        success: true,
        message: 'Driver deleted successfully'
      });

    } catch (error) {
      logger.error('Delete driver error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete driver'
      });
    }
  }
);

// Get driver statistics
router.get('/:id/stats', validateToken, validateCompanyAccess,
  [param('id').isUUID()],
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

      const { days = 30 } = req.query;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get driver basic info
      const driverConditions = {
        id: req.params.id,
        company_id: req.userCompanyId
      };
      
      const driverResult = await databaseAdapter.select('drivers', 'id, employee_id, first_name, last_name, risk_score', driverConditions);
      const driver = driverResult.data && driverResult.data.length > 0 ? driverResult.data[0] : null;

      if (!driver) {
        return res.status(404).json({
          success: false,
          error: 'Driver not found'
        });
      }

      // Get trip statistics
      const tripConditions = {
        driver_id: req.params.id,
        status: 'completed',
        start_time: { operator: 'gte', value: startDate.toISOString() }
      };
      
      const tripResult = await databaseAdapter.select('trips', 'distance_traveled, fuel_consumed, start_time, end_time', tripConditions);
      const tripStats = tripResult.data || [];

      // Get fraud alert count
      const fraudConditions = {
        driver_id: req.params.id,
        created_at: { operator: 'gte', value: startDate.toISOString() }
      };
      
      const fraudResult = await databaseAdapter.count('fraud_alerts', fraudConditions);
      const fraudAlertCount = fraudResult.count || 0;

      // Calculate statistics
      const totalTrips = tripStats.length;
      const totalDistance = tripStats.reduce((sum, trip) => sum + (trip.distance_traveled || 0), 0);
      const totalFuelConsumed = tripStats.reduce((sum, trip) => sum + (trip.fuel_consumed || 0), 0);
      const avgFuelEfficiency = totalDistance > 0 && totalFuelConsumed > 0 ? 
        (totalDistance / totalFuelConsumed) : 0;

      // Calculate total driving hours
      const totalDrivingHours = tripStats.reduce((sum, trip) => {
        if (trip.start_time && trip.end_time) {
          const duration = new Date(trip.end_time) - new Date(trip.start_time);
          return sum + (duration / (1000 * 60 * 60)); // Convert to hours
        }
        return sum;
      }, 0);

      res.json({
        success: true,
        data: {
          driver: {
            id: driver.id,
            employee_id: driver.employee_id,
            name: `${driver.first_name} ${driver.last_name}`,
            risk_score: driver.risk_score
          },
          period: `${days} days`,
          statistics: {
            total_trips: totalTrips,
            total_distance: parseFloat(totalDistance.toFixed(2)),
            total_fuel_consumed: parseFloat(totalFuelConsumed.toFixed(2)),
            total_driving_hours: parseFloat(totalDrivingHours.toFixed(2)),
            avg_fuel_efficiency: parseFloat(avgFuelEfficiency.toFixed(2)),
            fraud_alerts: fraudAlertCount || 0
          }
        }
      });

    } catch (error) {
      logger.error('Get driver stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch driver statistics'
      });
    }
  }
);

// Get drivers with expiring licenses
router.get('/licenses/expiring', validateToken, validateCompanyAccess, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(days));

    const conditions = {
      company_id: req.userCompanyId,
      status: 'active',
      license_expiry: {
        operator: 'lte',
        value: futureDate.toISOString().split('T')[0]
      }
    };

    const options = {
      orderBy: { column: 'license_expiry', direction: 'asc' }
    };

    const result = await databaseAdapter.select('drivers', 'id, employee_id, first_name, last_name, license_number, license_expiry, email, phone', conditions, options);
    const drivers = result.data || [];

    res.json({
      success: true,
      data: drivers,
      message: `Found ${drivers.length} drivers with licenses expiring in the next ${days} days`
    });

  } catch (error) {
    logger.error('Get expiring licenses error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch drivers with expiring licenses'
    });
  }
});

// Update driver risk score
router.patch('/:id/risk-score', 
  validateToken, 
  validateCompanyAccess,
  requireRole(['admin', 'manager']),
  [
    param('id').isUUID(),
    body('risk_score').isFloat({ min: 0, max: 1 }),
    body('reason').optional().isLength({ min: 1 }).trim()
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

      const { risk_score, reason } = req.body;

      const conditions = {
        id: req.params.id,
        company_id: req.userCompanyId
      };

      const result = await databaseAdapter.update('drivers', { risk_score }, conditions, true);
      const driver = result.data;

      if (!driver) {
        return res.status(404).json({
          success: false,
          error: 'Driver not found'
        });
      }

      logger.info('Driver risk score updated', {
        driverId: driver.id,
        employeeId: driver.employee_id,
        oldRiskScore: req.body.risk_score,
        newRiskScore: risk_score,
        reason,
        updatedBy: req.userId
      });

      res.json({
        success: true,
        message: 'Driver risk score updated successfully',
        data: driver
      });

    } catch (error) {
      logger.error('Update driver risk score error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update driver risk score'
      });
    }
  }
);

// Bulk update driver status
router.patch('/bulk-status', 
  validateToken, 
  validateCompanyAccess,
  requireRole(['admin', 'manager']),
  [
    body('driver_ids').isArray().notEmpty(),
    body('driver_ids.*').isUUID(),
    body('status').isIn(['active', 'inactive', 'suspended'])
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

      const { driver_ids, status } = req.body;

      const conditions = {
        id: driver_ids,
        company_id: req.userCompanyId
      };

      const result = await databaseAdapter.update('drivers', { status }, conditions, true);
      const updatedDrivers = result.data;

      logger.info('Bulk driver status update', {
        driverIds: driver_ids,
        status,
        companyId: req.userCompanyId,
        updatedBy: req.userId,
        updatedCount: updatedDrivers.length
      });

      res.json({
        success: true,
        message: `${updatedDrivers.length} drivers updated successfully`,
        data: updatedDrivers
      });

    } catch (error) {
      logger.error('Bulk update driver status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update driver status'
      });
    }
  }
);

module.exports = router;