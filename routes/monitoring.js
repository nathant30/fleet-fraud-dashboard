const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const databaseAdapter = require('../server/config/databaseAdapter');
const logger = require('../utils/logger');
const { validateToken, validateCompanyAccess, requireRole } = require('../middleware/auth');

const router = express.Router();

// Real-time monitoring service functions
const monitoringService = {
  // Get active vehicles with live status
  async getActiveVehicles(companyId) {
    const conditions = {
      company_id: companyId,
      status: 'active'
    };

    const result = await databaseAdapter.select('vehicles', 'id, vehicle_number, make, model, status', conditions);
    const vehicles = result.data || [];

    return vehicles;
  },

  // Get real-time alerts for active monitoring
  async getActiveAlerts(companyId, severityLevel = 'medium') {
    const severityOrder = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
    const minSeverity = severityOrder[severityLevel] || 2;

    const conditions = {
      status: 'open',
      created_at: { operator: 'gte', value: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
    };

    const options = {
      orderBy: { column: 'created_at', direction: 'desc' }
    };

    const result = await databaseAdapter.select('fraud_alerts', 'id, type, severity, title, description, created_at, status', conditions, options);
    const alerts = result.data || [];

    // Filter by severity
    return alerts.filter(alert => 
      severityOrder[alert.severity] >= minSeverity
    );
  },

  // Get live vehicle tracking data
  async getLiveVehicleData(vehicleId, minutes = 60) {
    const startTime = new Date(Date.now() - minutes * 60 * 1000);

    const conditions = {
      vehicle_id: vehicleId,
      timestamp: { operator: 'gte', value: startTime.toISOString() }
    };

    const options = {
      orderBy: { column: 'timestamp', direction: 'asc' }
    };

    const result = await databaseAdapter.select('gps_tracking', 'location, speed, heading, timestamp', conditions, options);
    const gpsData = result.data || [];

    return gpsData;
  },

  // Check for real-time violations
  async checkRealTimeViolations(companyId) {
    const currentTime = new Date();
    const tenMinutesAgo = new Date(currentTime.getTime() - 10 * 60 * 1000);

    // Get recent GPS data for company vehicles
    const gpsConditions = {
      timestamp: { operator: 'gte', value: tenMinutesAgo.toISOString() }
    };

    const gpsOptions = {
      orderBy: { column: 'timestamp', direction: 'desc' }
    };

    const gpsResult = await databaseAdapter.select('gps_tracking', '*', gpsConditions, gpsOptions);
    const gpsData = gpsResult.data || [];

    const violations = [];
    const speedThreshold = parseFloat(process.env.FRAUD_THRESHOLD_SPEED) || 120;

    // Check for speed violations
    gpsData.forEach(gps => {
      if (gps.speed > speedThreshold) {
        violations.push({
          type: 'speed_violation',
          severity: gps.speed > speedThreshold * 1.2 ? 'critical' : 'high',
          vehicle_id: gps.vehicle_id,
          details: {
            current_speed: gps.speed,
            threshold: speedThreshold,
            location: gps.location,
            timestamp: gps.timestamp
          }
        });
      }
    });

    return violations;
  },

  // Get fleet overview statistics
  async getFleetOverview(companyId) {
    // Get active vehicles count
    const { count: activeVehicles, error: vehicleError } = await supabase
      .from('vehicles')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'active');

    if (vehicleError) throw vehicleError;

    // Get active trips count
    const { count: activeTrips, error: tripError } = await supabase
      .from('trips')
      .select(`
        *,
        vehicle:vehicles!inner(company_id)
      `, { count: 'exact', head: true })
      .eq('status', 'in_progress')
      .eq('vehicle.company_id', companyId);

    if (tripError) throw tripError;

    // Get open alerts count
    const { count: openAlerts, error: alertError } = await supabase
      .from('fraud_alerts')
      .select(`
        *,
        vehicle:vehicles!inner(company_id)
      `, { count: 'exact', head: true })
      .eq('status', 'open')
      .eq('vehicle.company_id', companyId);

    if (alertError) throw alertError;

    // Get today's fuel transactions
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: todayFuel, error: fuelError } = await supabase
      .from('fuel_transactions')
      .select(`
        fuel_amount,
        fuel_cost,
        vehicle:vehicles!inner(company_id)
      `)
      .eq('vehicle.company_id', companyId)
      .gte('transaction_date', today.toISOString());

    if (fuelError) throw fuelError;

    const totalFuelToday = (todayFuel || []).reduce((sum, tx) => sum + (tx.fuel_amount || 0), 0);
    const totalCostToday = (todayFuel || []).reduce((sum, tx) => sum + (tx.fuel_cost || 0), 0);

    return {
      active_vehicles: activeVehicles || 0,
      active_trips: activeTrips || 0,
      open_alerts: openAlerts || 0,
      today_fuel_transactions: (todayFuel || []).length,
      today_fuel_amount: parseFloat(totalFuelToday.toFixed(2)),
      today_fuel_cost: parseFloat(totalCostToday.toFixed(2))
    };
  },

  // Get geofence violations
  async checkGeofenceViolations(companyId) {
    // Get active geofences
    const { data: geofences, error: geoError } = await supabase
      .from('geofences')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true);

    if (geoError) throw geoError;

    // Get recent GPS positions
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const { data: recentPositions, error: posError } = await supabase
      .from('gps_tracking')
      .select(`
        *,
        trip:trips!inner(
          id,
          vehicle:vehicles!inner(id, vehicle_number, company_id),
          driver:drivers(id, first_name, last_name)
        )
      `)
      .eq('trip.vehicle.company_id', companyId)
      .gte('timestamp', fiveMinutesAgo.toISOString());

    if (posError) throw posError;

    const violations = [];

    // Check each position against geofences
    // Note: This is a simplified check. In production, use PostGIS functions
    (recentPositions || []).forEach(position => {
      // For demo purposes, we'll just flag if there are positions but no geofence checking
      // In production, implement proper geospatial queries
      if (geofences && geofences.length > 0) {
        // Placeholder for geofence violation logic
        // Real implementation would use ST_Contains or ST_Within PostGIS functions
      }
    });

    return violations;
  }
};

// Get fleet overview dashboard
router.get('/dashboard', validateToken, validateCompanyAccess, async (req, res) => {
  try {
    const overview = await monitoringService.getFleetOverview(req.userCompanyId);
    const activeVehicles = await monitoringService.getActiveVehicles(req.userCompanyId);
    const activeAlerts = await monitoringService.getActiveAlerts(req.userCompanyId);
    const recentViolations = await monitoringService.checkRealTimeViolations(req.userCompanyId);

    res.json({
      success: true,
      data: {
        overview,
        active_vehicles: activeVehicles.slice(0, 10), // Limit to 10 for dashboard
        recent_alerts: activeAlerts.slice(0, 5), // Limit to 5 for dashboard
        real_time_violations: recentViolations
      }
    });

  } catch (error) {
    logger.error('Get monitoring dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch monitoring dashboard'
    });
  }
});

// Get active vehicles with real-time status
router.get('/vehicles/active', validateToken, validateCompanyAccess, async (req, res) => {
  try {
    const vehicles = await monitoringService.getActiveVehicles(req.userCompanyId);

    res.json({
      success: true,
      data: vehicles
    });

  } catch (error) {
    logger.error('Get active vehicles error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active vehicles'
    });
  }
});

// Get live vehicle tracking data
router.get('/vehicles/:vehicleId/live', validateToken, validateCompanyAccess,
  [param('vehicleId').isUUID()],
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

      // Verify vehicle belongs to company
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('id, vehicle_number')
        .eq('id', req.params.vehicleId)
        .eq('company_id', req.userCompanyId)
        .single();

      if (vehicleError && vehicleError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Vehicle not found'
        });
      }

      if (vehicleError) {
        throw vehicleError;
      }

      const { minutes = 60 } = req.query;
      const liveData = await monitoringService.getLiveVehicleData(req.params.vehicleId, parseInt(minutes));

      res.json({
        success: true,
        data: {
          vehicle: {
            id: vehicle.id,
            vehicle_number: vehicle.vehicle_number
          },
          tracking_data: liveData,
          period_minutes: parseInt(minutes)
        }
      });

    } catch (error) {
      logger.error('Get live vehicle data error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch live vehicle data'
      });
    }
  }
);

// Get real-time alerts
router.get('/alerts/active', validateToken, validateCompanyAccess, async (req, res) => {
  try {
    const { severity = 'medium' } = req.query;
    const alerts = await monitoringService.getActiveAlerts(req.userCompanyId, severity);

    res.json({
      success: true,
      data: alerts
    });

  } catch (error) {
    logger.error('Get active alerts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active alerts'
    });
  }
});

// Check for real-time violations
router.get('/violations/check', validateToken, validateCompanyAccess, async (req, res) => {
  try {
    const violations = await monitoringService.checkRealTimeViolations(req.userCompanyId);

    res.json({
      success: true,
      data: {
        violations_count: violations.length,
        violations
      }
    });

  } catch (error) {
    logger.error('Check real-time violations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check real-time violations'
    });
  }
});

// Submit GPS tracking data
router.post('/gps/track', validateToken, validateCompanyAccess,
  [
    body('trip_id').isUUID(),
    body('vehicle_id').isUUID(),
    body('location').isObject(),
    body('location.lat').isFloat({ min: -90, max: 90 }),
    body('location.lng').isFloat({ min: -180, max: 180 }),
    body('speed').optional().isFloat({ min: 0 }),
    body('heading').optional().isFloat({ min: 0, max: 360 }),
    body('altitude').optional().isFloat(),
    body('accuracy').optional().isFloat({ min: 0 })
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

      // Verify vehicle belongs to company
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('id, company_id')
        .eq('id', req.body.vehicle_id)
        .eq('company_id', req.userCompanyId)
        .single();

      if (vehicleError) {
        return res.status(400).json({
          success: false,
          error: 'Vehicle not found or does not belong to your company'
        });
      }

      // Verify trip exists and is active
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .select('id, status')
        .eq('id', req.body.trip_id)
        .eq('vehicle_id', req.body.vehicle_id)
        .single();

      if (tripError) {
        return res.status(400).json({
          success: false,
          error: 'Trip not found or does not match vehicle'
        });
      }

      if (trip.status !== 'in_progress') {
        return res.status(400).json({
          success: false,
          error: 'Trip is not active'
        });
      }

      // Format location for PostGIS
      const locationPoint = `POINT(${req.body.location.lng} ${req.body.location.lat})`;

      const gpsData = {
        trip_id: req.body.trip_id,
        vehicle_id: req.body.vehicle_id,
        timestamp: new Date().toISOString(),
        location: locationPoint,
        speed: req.body.speed || null,
        heading: req.body.heading || null,
        altitude: req.body.altitude || null,
        accuracy: req.body.accuracy || null
      };

      const { data: tracking, error } = await supabase
        .from('gps_tracking')
        .insert([gpsData])
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Check for real-time violations with this new data point
      if (req.body.speed && req.body.speed > (process.env.FRAUD_THRESHOLD_SPEED || 120)) {
        // Create speed violation alert
        const alertData = {
          type: 'speed_violation',
          severity: req.body.speed > (process.env.FRAUD_THRESHOLD_SPEED || 120) * 1.2 ? 'critical' : 'high',
          vehicle_id: req.body.vehicle_id,
          trip_id: req.body.trip_id,
          title: `Real-time Speed Violation: ${req.body.speed} km/h`,
          description: `Vehicle exceeded speed limit in real-time`,
          details: {
            recorded_speed: req.body.speed,
            threshold_speed: process.env.FRAUD_THRESHOLD_SPEED || 120,
            location: req.body.location,
            timestamp: gpsData.timestamp
          }
        };

        // Insert alert (non-blocking)
        supabase.from('fraud_alerts').insert([alertData]).then(() => {
          logger.logFraudAlert('speed_violation', alertData.details);
        });
      }

      res.status(201).json({
        success: true,
        message: 'GPS tracking data recorded successfully',
        data: tracking
      });

    } catch (error) {
      logger.error('Submit GPS tracking error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit GPS tracking data'
      });
    }
  }
);

// Get fleet performance metrics
router.get('/metrics/performance', validateToken, validateCompanyAccess, async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Get trip performance metrics
    const { data: tripMetrics, error: tripError } = await supabase
      .from('trips')
      .select(`
        distance_traveled,
        fuel_consumed,
        start_time,
        end_time,
        vehicle:vehicles!inner(company_id, fuel_type)
      `)
      .eq('vehicle.company_id', req.userCompanyId)
      .eq('status', 'completed')
      .gte('start_time', startTime.toISOString());

    if (tripError) throw tripError;

    // Get fuel transactions
    const { data: fuelMetrics, error: fuelError } = await supabase
      .from('fuel_transactions')
      .select(`
        fuel_amount,
        fuel_cost,
        transaction_date,
        vehicle:vehicles!inner(company_id)
      `)
      .eq('vehicle.company_id', req.userCompanyId)
      .gte('transaction_date', startTime.toISOString());

    if (fuelError) throw fuelError;

    // Calculate metrics
    const totalDistance = (tripMetrics || []).reduce((sum, trip) => sum + (trip.distance_traveled || 0), 0);
    const totalFuelConsumed = (tripMetrics || []).reduce((sum, trip) => sum + (trip.fuel_consumed || 0), 0);
    const totalFuelPurchased = (fuelMetrics || []).reduce((sum, tx) => sum + (tx.fuel_amount || 0), 0);
    const totalFuelCost = (fuelMetrics || []).reduce((sum, tx) => sum + (tx.fuel_cost || 0), 0);

    const avgFuelEfficiency = totalFuelConsumed > 0 ? totalDistance / totalFuelConsumed : 0;
    const costPerKm = totalDistance > 0 ? totalFuelCost / totalDistance : 0;

    // Calculate trip duration metrics
    const totalTripDuration = (tripMetrics || []).reduce((sum, trip) => {
      if (trip.start_time && trip.end_time) {
        return sum + (new Date(trip.end_time) - new Date(trip.start_time));
      }
      return sum;
    }, 0) / (1000 * 60 * 60); // Convert to hours

    res.json({
      success: true,
      data: {
        period_hours: parseInt(hours),
        metrics: {
          total_trips: (tripMetrics || []).length,
          total_distance_km: parseFloat(totalDistance.toFixed(2)),
          total_fuel_consumed_l: parseFloat(totalFuelConsumed.toFixed(2)),
          total_fuel_purchased_l: parseFloat(totalFuelPurchased.toFixed(2)),
          total_fuel_cost: parseFloat(totalFuelCost.toFixed(2)),
          avg_fuel_efficiency_kmpl: parseFloat(avgFuelEfficiency.toFixed(2)),
          cost_per_km: parseFloat(costPerKm.toFixed(2)),
          total_driving_hours: parseFloat(totalTripDuration.toFixed(2)),
          fuel_variance_l: parseFloat((totalFuelPurchased - totalFuelConsumed).toFixed(2))
        }
      }
    });

  } catch (error) {
    logger.error('Get performance metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch performance metrics'
    });
  }
});

// Get vehicle status summary
router.get('/vehicles/status', validateToken, validateCompanyAccess, async (req, res) => {
  try {
    const { data: statusCounts, error } = await supabase
      .from('vehicles')
      .select('status')
      .eq('company_id', req.userCompanyId);

    if (error) throw error;

    const summary = {
      active: 0,
      maintenance: 0,
      inactive: 0,
      total: 0
    };

    (statusCounts || []).forEach(vehicle => {
      summary[vehicle.status] = (summary[vehicle.status] || 0) + 1;
      summary.total++;
    });

    // Get vehicles currently on trips
    const { count: vehiclesOnTrips, error: tripError } = await supabase
      .from('trips')
      .select(`
        vehicle_id,
        vehicle:vehicles!inner(company_id)
      `, { count: 'exact', head: true })
      .eq('status', 'in_progress')
      .eq('vehicle.company_id', req.userCompanyId);

    if (tripError) throw tripError;

    summary.on_trip = vehiclesOnTrips || 0;
    summary.available = summary.active - summary.on_trip;

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    logger.error('Get vehicle status summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vehicle status summary'
    });
  }
});

module.exports = router;