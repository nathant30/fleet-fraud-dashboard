const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const databaseAdapter = require('../server/config/databaseAdapter');
const logger = require('../utils/logger');
const { validateToken, validateCompanyAccess, requireRole } = require('../middleware/auth');

const router = express.Router();

// Validation schemas
const vehicleValidation = [
  body('vehicle_number').isLength({ min: 1 }).trim(),
  body('make').optional().isLength({ min: 1 }).trim(),
  body('model').optional().isLength({ min: 1 }).trim(),
  body('year').optional().isInt({ min: 1900, max: new Date().getFullYear() + 1 }),
  body('vin').optional().isLength({ min: 17, max: 17 }).trim(),
  body('license_plate').optional().isLength({ min: 1 }).trim(),
  body('fuel_type').optional().isIn(['diesel', 'gasoline', 'electric', 'hybrid']),
  body('fuel_capacity').optional().isFloat({ min: 0 }),
  body('status').optional().isIn(['active', 'maintenance', 'inactive']),
  body('gps_device_id').optional().isLength({ min: 1 }).trim()
];

const updateVehicleValidation = [
  param('id').isUUID(),
  body('vehicle_number').optional().isLength({ min: 1 }).trim(),
  body('make').optional().isLength({ min: 1 }).trim(),
  body('model').optional().isLength({ min: 1 }).trim(),
  body('year').optional().isInt({ min: 1900, max: new Date().getFullYear() + 1 }),
  body('vin').optional().isLength({ min: 17, max: 17 }).trim(),
  body('license_plate').optional().isLength({ min: 1 }).trim(),
  body('fuel_type').optional().isIn(['diesel', 'gasoline', 'electric', 'hybrid']),
  body('fuel_capacity').optional().isFloat({ min: 0 }),
  body('odometer').optional().isFloat({ min: 0 }),
  body('status').optional().isIn(['active', 'maintenance', 'inactive']),
  body('gps_device_id').optional().isLength({ min: 1 }).trim()
];

// Get all vehicles for a company
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
        value: `vehicle_number.ilike.%${search}%,make.ilike.%${search}%,model.ilike.%${search}%,license_plate.ilike.%${search}%`
      };
    }

    const options = {
      limit: parseInt(limit),
      offset,
      orderBy: { column: sort_by, direction: sort_order },
      count: true
    };

    const result = await databaseAdapter.select('vehicles', '*', conditions, options);
    const vehicles = result.data;
    const count = result.count;

    res.json({
      success: true,
      data: vehicles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    logger.error('Get vehicles error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vehicles'
    });
  }
});

// Get vehicle by ID
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

      const result = await databaseAdapter.select('vehicles', '*', conditions);
      const vehicle = result.data && result.data.length > 0 ? result.data[0] : null;

      if (!vehicle) {
        return res.status(404).json({
          success: false,
          error: 'Vehicle not found'
        });
      }

      res.json({
        success: true,
        data: vehicle
      });

    } catch (error) {
      logger.error('Get vehicle error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch vehicle'
      });
    }
  }
);

// Create new vehicle
router.post('/', validateToken, validateCompanyAccess, vehicleValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const vehicleData = {
      ...req.body,
      company_id: req.userCompanyId
    };

    const result = await databaseAdapter.insert('vehicles', vehicleData);
    const vehicle = result.data;

    logger.info('Vehicle created', {
      vehicleId: vehicle.id,
      vehicleNumber: vehicle.vehicle_number,
      companyId: req.userCompanyId,
      createdBy: req.userId
    });

    res.status(201).json({
      success: true,
      message: 'Vehicle created successfully',
      data: vehicle
    });

  } catch (error) {
    logger.error('Create vehicle error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create vehicle'
    });
  }
});

// Update vehicle
router.put('/:id', validateToken, validateCompanyAccess, updateVehicleValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    // Check if vehicle exists and belongs to company
    const conditions = { 
      id: req.params.id,
      company_id: req.userCompanyId 
    };
    
    const existingResult = await databaseAdapter.select('vehicles', 'id', conditions);
    const existingVehicle = existingResult.data && existingResult.data.length > 0 ? existingResult.data[0] : null;

    if (!existingVehicle) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
      });
    }

    const result = await databaseAdapter.update('vehicles', req.body, conditions);
    const vehicle = result.data;

    logger.info('Vehicle updated', {
      vehicleId: vehicle.id,
      vehicleNumber: vehicle.vehicle_number,
      companyId: req.userCompanyId,
      updatedBy: req.userId
    });

    res.json({
      success: true,
      message: 'Vehicle updated successfully',
      data: vehicle
    });

  } catch (error) {
    logger.error('Update vehicle error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update vehicle'
    });
  }
});

// Delete vehicle
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

      // Check if vehicle has active trips
      const tripConditions = {
        vehicle_id: req.params.id,
        status: 'in_progress'
      };
      
      const tripResult = await databaseAdapter.select('trips', 'id', tripConditions);
      const activeTrips = tripResult.data || [];

      if (activeTrips.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete vehicle with active trips'
        });
      }

      const deleteConditions = {
        id: req.params.id,
        company_id: req.userCompanyId
      };
      
      await databaseAdapter.delete('vehicles', deleteConditions);

      logger.info('Vehicle deleted', {
        vehicleId: req.params.id,
        companyId: req.userCompanyId,
        deletedBy: req.userId
      });

      res.json({
        success: true,
        message: 'Vehicle deleted successfully'
      });

    } catch (error) {
      logger.error('Delete vehicle error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete vehicle'
      });
    }
  }
);

// Get vehicle statistics
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

      // Get vehicle basic info
      const vehicleConditions = {
        id: req.params.id,
        company_id: req.userCompanyId
      };
      
      const vehicleResult = await databaseAdapter.select('vehicles', 'id, vehicle_number, odometer', vehicleConditions);
      const vehicle = vehicleResult.data && vehicleResult.data.length > 0 ? vehicleResult.data[0] : null;

      if (!vehicle) {
        return res.status(404).json({
          success: false,
          error: 'Vehicle not found'
        });
      }

      // Get trip statistics
      const tripConditions = {
        vehicle_id: req.params.id,
        status: 'completed',
        start_time: { operator: 'gte', value: startDate.toISOString() }
      };
      
      const tripResult = await databaseAdapter.select('trips', 'distance_traveled, fuel_consumed', tripConditions);
      const tripStats = tripResult.data || [];

      // Get fraud alert count
      const fraudConditions = {
        vehicle_id: req.params.id,
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

      res.json({
        success: true,
        data: {
          vehicle: {
            id: vehicle.id,
            vehicle_number: vehicle.vehicle_number,
            current_odometer: vehicle.odometer
          },
          period: `${days} days`,
          statistics: {
            total_trips: totalTrips,
            total_distance: parseFloat(totalDistance.toFixed(2)),
            total_fuel_consumed: parseFloat(totalFuelConsumed.toFixed(2)),
            avg_fuel_efficiency: parseFloat(avgFuelEfficiency.toFixed(2)),
            fraud_alerts: fraudAlertCount || 0
          }
        }
      });

    } catch (error) {
      logger.error('Get vehicle stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch vehicle statistics'
      });
    }
  }
);

// Bulk update vehicle status
router.patch('/bulk-status', 
  validateToken, 
  validateCompanyAccess,
  requireRole(['admin', 'manager']),
  [
    body('vehicle_ids').isArray().notEmpty(),
    body('vehicle_ids.*').isUUID(),
    body('status').isIn(['active', 'maintenance', 'inactive'])
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

      const { vehicle_ids, status } = req.body;

      const conditions = {
        id: vehicle_ids,
        company_id: req.userCompanyId
      };

      const result = await databaseAdapter.update('vehicles', { status }, conditions, true);
      const updatedVehicles = result.data;

      logger.info('Bulk vehicle status update', {
        vehicleIds: vehicle_ids,
        status,
        companyId: req.userCompanyId,
        updatedBy: req.userId,
        updatedCount: updatedVehicles.length
      });

      res.json({
        success: true,
        message: `${updatedVehicles.length} vehicles updated successfully`,
        data: updatedVehicles
      });

    } catch (error) {
      logger.error('Bulk update vehicle status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update vehicle status'
      });
    }
  }
);

module.exports = router;