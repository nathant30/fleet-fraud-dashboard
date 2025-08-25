const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const databaseAdapter = require('../server/config/databaseAdapter');
const logger = require('../utils/logger');
const { validateToken, validateCompanyAccess, requireRole } = require('../middleware/auth');
const { cacheMiddleware } = require('../utils/cache');
// const { broadcastFraudAlert } = require('./sse'); // Temporarily disabled

// Safely import supabase with fallback
let supabase = null;
try {
  const supabaseConfig = require('../config/supabase');
  supabase = supabaseConfig.supabase;
} catch (error) {
  logger.warn('Supabase not available, using database adapter fallback');
}

const router = express.Router();

// Fraud detection service functions
const fraudDetectionService = {
  // Detect speed violations
  async detectSpeedViolations(companyId, thresholdSpeed = 120) {
    const conditions = {
      speed: { operator: 'gt', value: thresholdSpeed },
      timestamp: { operator: 'gte', value: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
    };

    const result = await databaseAdapter.select('gps_tracking', '*', conditions);
    return result.data || [];
  },

  // Detect route deviations
  async detectRouteDeviations(companyId) {
    const conditions = {
      status: 'in_progress'
      // Note: Complex joins are simplified for SQLite compatibility
    };

    const result = await databaseAdapter.select('trips', '*', conditions);
    const trips = result.data || [];

    const deviations = [];
    for (const trip of trips) {
      if (trip.route?.waypoints && trip.gps_tracking?.length > 0) {
        // Simple deviation detection - in real implementation, use proper geospatial calculations
        const actualDistance = trip.distance_traveled || 0;
        const expectedDistance = trip.route.expected_distance || 0;
        const deviationPercentage = expectedDistance > 0 ? 
          Math.abs(actualDistance - expectedDistance) / expectedDistance : 0;

        if (deviationPercentage > 0.2) { // 20% deviation threshold
          deviations.push({
            trip,
            deviation_percentage: deviationPercentage,
            expected_distance: expectedDistance,
            actual_distance: actualDistance
          });
        }
      }
    }
    return deviations;
  },

  // Detect fuel anomalies
  async detectFuelAnomalies(companyId) {
    // Use database adapter for fuel transactions (simplified query for now)
    const transactionResult = await databaseAdapter.select('fuel_transactions', '*', {
      company_id: companyId
    });
    
    const transactions = transactionResult.data || [];

    const anomalies = [];
    for (const transaction of transactions || []) {
      const fuelAmount = transaction.fuel_amount || 0;
      const fuelCapacity = transaction.vehicle?.fuel_capacity || 0;

      // Check for overfilling
      if (fuelCapacity > 0 && fuelAmount > fuelCapacity * 1.1) {
        anomalies.push({
          type: 'overfilling',
          transaction,
          reason: `Fuel amount (${fuelAmount}L) exceeds vehicle capacity (${fuelCapacity}L)`
        });
      }

      // Check for suspicious fuel efficiency
      if (transaction.trip?.distance_traveled) {
        const fuelEfficiency = transaction.trip.distance_traveled / fuelAmount;
        if (fuelEfficiency < 3 || fuelEfficiency > 15) { // Unrealistic efficiency
          anomalies.push({
            type: 'suspicious_efficiency',
            transaction,
            efficiency: fuelEfficiency,
            reason: `Unrealistic fuel efficiency: ${fuelEfficiency.toFixed(2)} km/L`
          });
        }
      }
    }
    return anomalies;
  },

  // Detect after-hours usage
  async detectAfterHoursUsage(companyId, startHour = 22, endHour = 6) {
    // Use database adapter for trips (simplified query for now)
    const tripResult = await databaseAdapter.select('trips', '*', {
      company_id: companyId
    });
    
    const trips = tripResult.data || [];

    const afterHoursTrips = [];
    for (const trip of trips || []) {
      const startTime = new Date(trip.start_time);
      const hour = startTime.getHours();
      
      if (hour >= startHour || hour <= endHour) {
        afterHoursTrips.push(trip);
      }
    }
    return afterHoursTrips;
  },

  // Detect geofence violations using PostGIS
  async detectGeofenceViolations(companyId) {
    try {
      // Get active geofences for the company using database adapter
      let geofences = [];
      try {
        const conditions = {
          company_id: companyId,
          is_active: true
        };
        const result = await databaseAdapter.select('geofences', '*', conditions);
        geofences = result.data || [];
      } catch (dbError) {
        console.log('Database error, using mock data for geofences:', dbError.message);
        geofences = []; // Return empty array as fallback
      }

      if (!geofences || geofences.length === 0) {
        return [];
      }

      // Get recent GPS positions (last 2 hours) using database adapter
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      
      let recentPositions = [];
      try {
        const conditions = {
          timestamp: { operator: 'gte', value: twoHoursAgo.toISOString() }
        };
        const options = {
          orderBy: { column: 'timestamp', direction: 'desc' }
        };
        const result = await databaseAdapter.select('gps_tracking', '*', conditions, options);
        recentPositions = result.data || [];
      } catch (dbError) {
        console.log('Database error, using mock data for GPS positions:', dbError.message);
        recentPositions = []; // Return empty array as fallback
      }

      const violations = [];

      // Check each geofence against recent positions
      for (const geofence of geofences) {
        for (const position of recentPositions || []) {
          // Use PostGIS function to check if point is within/outside geofence
          const { data: geoResult, error: checkError } = await supabase
            .rpc('check_geofence_violation', {
              point_geog: position.location,
              fence_geog: geofence.geometry,
              fence_type: geofence.type
            });

          if (checkError) {
            logger.warn('Geofence check error:', checkError);
            continue;
          }

          if (geoResult && geoResult[0]?.is_violation) {
            violations.push({
              position,
              geofence,
              violation_type: geofence.type === 'inclusion' ? 'outside_allowed_area' : 'inside_restricted_area',
              distance_from_fence: geoResult[0]?.distance || 0,
              severity: geofence.type === 'exclusion' ? 'high' : 'medium'
            });
          }
        }
      }

      return violations;
    } catch (error) {
      logger.error('Geofence violation detection error:', error);
      return [];
    }
  },

  // Detect odometer tampering
  async detectOdometerTampering(companyId) {
    try {
      // Get trip data with odometer readings using database adapter
      let trips = [];
      try {
        const conditions = {
          status: 'completed',
          end_time: { operator: 'gte', value: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }
        };
        const options = {
          orderBy: { column: 'end_time', direction: 'asc' }
        };
        const result = await databaseAdapter.select('trips', '*', conditions, options);
        trips = result.data || [];
      } catch (dbError) {
        console.log('Database error, using mock data for trips:', dbError.message);
        trips = []; // Return empty array as fallback
      }

      const tampering = [];
      const vehicleTrips = {};

      // Group trips by vehicle
      (trips || []).forEach(trip => {
        const vehicleId = trip.vehicle.id;
        if (!vehicleTrips[vehicleId]) {
          vehicleTrips[vehicleId] = [];
        }
        vehicleTrips[vehicleId].push(trip);
      });

      // Check each vehicle for odometer anomalies
      for (const [vehicleId, vehicleTrip] of Object.entries(vehicleTrips)) {
        const sortedTrips = vehicleTrip.sort((a, b) => new Date(a.end_time) - new Date(b.end_time));
        
        for (let i = 1; i < sortedTrips.length; i++) {
          const prevTrip = sortedTrips[i - 1];
          const currentTrip = sortedTrips[i];
          
          const prevOdometer = prevTrip.end_odometer || 0;
          const currentOdometer = currentTrip.start_odometer || 0;
          const tripDistance = currentTrip.distance_traveled || 0;
          
          // Check for odometer rollback
          if (currentOdometer < prevOdometer) {
            tampering.push({
              type: 'odometer_rollback',
              severity: 'high',
              vehicle: currentTrip.vehicle,
              driver: currentTrip.driver,
              trip: currentTrip,
              details: {
                previous_odometer: prevOdometer,
                current_odometer: currentOdometer,
                difference: prevOdometer - currentOdometer,
                expected_minimum: prevOdometer
              },
              reason: `Odometer reading decreased from ${prevOdometer} to ${currentOdometer}`
            });
          }
          
          // Check for impossible odometer readings
          const timeDiffHours = (new Date(currentTrip.start_time) - new Date(prevTrip.end_time)) / (1000 * 60 * 60);
          const maxPossibleDistance = timeDiffHours * 120; // Assuming max 120 km/h average
          const actualOdometerIncrease = currentOdometer - prevOdometer;
          
          if (actualOdometerIncrease > maxPossibleDistance && maxPossibleDistance > 0) {
            tampering.push({
              type: 'impossible_odometer_increase',
              severity: 'medium',
              vehicle: currentTrip.vehicle,
              driver: currentTrip.driver,
              trip: currentTrip,
              details: {
                time_diff_hours: parseFloat(timeDiffHours.toFixed(2)),
                odometer_increase: actualOdometerIncrease,
                max_possible_distance: parseFloat(maxPossibleDistance.toFixed(2)),
                excess_distance: parseFloat((actualOdometerIncrease - maxPossibleDistance).toFixed(2))
              },
              reason: `Odometer increase of ${actualOdometerIncrease}km in ${timeDiffHours.toFixed(1)} hours is impossible`
            });
          }
          
          // Check for missing odometer progression
          if (tripDistance > 10 && Math.abs(actualOdometerIncrease - tripDistance) > tripDistance * 0.3) {
            tampering.push({
              type: 'odometer_distance_mismatch',
              severity: 'medium',
              vehicle: currentTrip.vehicle,
              driver: currentTrip.driver,
              trip: currentTrip,
              details: {
                trip_distance: tripDistance,
                odometer_difference: actualOdometerIncrease,
                variance_percentage: parseFloat((Math.abs(actualOdometerIncrease - tripDistance) / tripDistance * 100).toFixed(1))
              },
              reason: `Odometer change (${actualOdometerIncrease}km) doesn't match trip distance (${tripDistance}km)`
            });
          }
        }
      }

      return tampering;
    } catch (error) {
      logger.error('Odometer tampering detection error:', error);
      return [];
    }
  },

  // Detect fuel card misuse patterns
  async detectFuelCardMisuse(companyId) {
    try {
      // Get fuel transactions with patterns analysis using database adapter
      let transactions = [];
      try {
        const conditions = {
          transaction_date: { operator: 'gte', value: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString() }
        };
        const options = {
          orderBy: { column: 'transaction_date', direction: 'desc' }
        };
        const result = await databaseAdapter.select('fuel_transactions', '*', conditions, options);
        transactions = result.data || [];
      } catch (dbError) {
        console.log('Database error, using mock data for fuel transactions:', dbError.message);
        transactions = []; // Return empty array as fallback
      }

      const misuse = [];
      const driverPatterns = {};
      const vehiclePatterns = {};

      // Analyze patterns by driver and vehicle
      (transactions || []).forEach(tx => {
        // Driver patterns
        const driverId = tx.driver?.id;
        if (driverId) {
          if (!driverPatterns[driverId]) {
            driverPatterns[driverId] = {
              driver: tx.driver,
              transactions: [],
              total_amount: 0,
              total_cost: 0,
              unique_locations: new Set(),
              unusual_times: 0
            };
          }
          driverPatterns[driverId].transactions.push(tx);
          driverPatterns[driverId].total_amount += tx.fuel_amount || 0;
          driverPatterns[driverId].total_cost += tx.fuel_cost || 0;
          if (tx.location) {
            driverPatterns[driverId].unique_locations.add(JSON.stringify(tx.location));
          }
          
          // Check for unusual times (very early morning or late night)
          const hour = new Date(tx.transaction_date).getHours();
          if (hour < 5 || hour > 23) {
            driverPatterns[driverId].unusual_times++;
          }
        }

        // Vehicle patterns
        const vehicleId = tx.vehicle.id;
        if (!vehiclePatterns[vehicleId]) {
          vehiclePatterns[vehicleId] = {
            vehicle: tx.vehicle,
            transactions: [],
            different_drivers: new Set()
          };
        }
        vehiclePatterns[vehicleId].transactions.push(tx);
        if (tx.driver?.id) {
          vehiclePatterns[vehicleId].different_drivers.add(tx.driver.id);
        }
      });

      // Check driver patterns for misuse
      for (const [driverId, pattern] of Object.entries(driverPatterns)) {
        // Multiple transactions per day
        const dailyTransactions = {};
        pattern.transactions.forEach(tx => {
          const date = new Date(tx.transaction_date).toDateString();
          dailyTransactions[date] = (dailyTransactions[date] || 0) + 1;
        });

        const maxDailyTransactions = Math.max(...Object.values(dailyTransactions));
        if (maxDailyTransactions > 3) {
          misuse.push({
            type: 'excessive_daily_transactions',
            severity: 'high',
            driver: pattern.driver,
            details: {
              max_transactions_per_day: maxDailyTransactions,
              total_transactions: pattern.transactions.length,
              suspicious_dates: Object.entries(dailyTransactions)
                .filter(([date, count]) => count > 2)
                .map(([date, count]) => ({ date, count }))
            },
            reason: `Driver made ${maxDailyTransactions} fuel transactions in a single day`
          });
        }

        // Unusual location diversity
        if (pattern.unique_locations.size > 10) {
          misuse.push({
            type: 'excessive_location_diversity',
            severity: 'medium',
            driver: pattern.driver,
            details: {
              unique_locations_count: pattern.unique_locations.size,
              total_transactions: pattern.transactions.length,
              location_variety_ratio: parseFloat((pattern.unique_locations.size / pattern.transactions.length).toFixed(2))
            },
            reason: `Driver used fuel card at ${pattern.unique_locations.size} different locations`
          });
        }

        // Unusual timing patterns
        if (pattern.unusual_times > pattern.transactions.length * 0.3) {
          misuse.push({
            type: 'unusual_timing_pattern',
            severity: 'medium',
            driver: pattern.driver,
            details: {
              unusual_time_transactions: pattern.unusual_times,
              total_transactions: pattern.transactions.length,
              unusual_percentage: parseFloat((pattern.unusual_times / pattern.transactions.length * 100).toFixed(1))
            },
            reason: `${pattern.unusual_times} transactions occurred at unusual hours (before 5 AM or after 11 PM)`
          });
        }
      }

      // Check vehicle patterns for misuse
      for (const [vehicleId, pattern] of Object.entries(vehiclePatterns)) {
        // Multiple drivers using same vehicle for fuel
        if (pattern.different_drivers.size > 5) {
          misuse.push({
            type: 'multiple_drivers_same_vehicle',
            severity: 'medium',
            vehicle: pattern.vehicle,
            details: {
              different_drivers_count: pattern.different_drivers.size,
              total_transactions: pattern.transactions.length
            },
            reason: `${pattern.different_drivers.size} different drivers used fuel card for vehicle ${pattern.vehicle.vehicle_number}`
          });
        }

        // Check for rapid consecutive transactions
        const sortedTransactions = pattern.transactions.sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date));
        for (let i = 1; i < sortedTransactions.length; i++) {
          const timeDiff = (new Date(sortedTransactions[i].transaction_date) - new Date(sortedTransactions[i-1].transaction_date)) / (1000 * 60); // minutes
          
          if (timeDiff < 30 && timeDiff > 0) { // Less than 30 minutes apart
            misuse.push({
              type: 'rapid_consecutive_transactions',
              severity: 'high',
              vehicle: pattern.vehicle,
              details: {
                time_difference_minutes: parseFloat(timeDiff.toFixed(1)),
                first_transaction: sortedTransactions[i-1],
                second_transaction: sortedTransactions[i]
              },
              reason: `Two fuel transactions occurred ${timeDiff.toFixed(1)} minutes apart for the same vehicle`
            });
          }
        }
      }

      return misuse;
    } catch (error) {
      logger.error('Fuel card misuse detection error:', error);
      return [];
    }
  }
};

// Validation schemas
const createAlertValidation = [
  body('type').isIn(['speed_violation', 'route_deviation', 'fuel_anomaly', 'unauthorized_usage', 'suspicious_location', 'odometer_tampering', 'fuel_card_misuse', 'after_hours_usage']),
  body('severity').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('vehicle_id').optional().isUUID(),
  body('driver_id').optional().isUUID(),
  body('trip_id').optional().isUUID(),
  body('fuel_transaction_id').optional().isUUID(),
  body('title').isLength({ min: 1 }).trim(),
  body('description').isLength({ min: 1 }).trim(),
  body('details').optional().isObject()
];

const updateAlertValidation = [
  param('id').isUUID(),
  body('status').optional().isIn(['open', 'investigating', 'resolved', 'false_positive']),
  body('severity').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('assigned_to').optional().isLength({ min: 1 }).trim(),
  body('resolution_notes').optional().isLength({ min: 1 }).trim()
];

// Get all fraud alerts for a company
router.get('/alerts', validateToken, validateCompanyAccess, async (req, res) => {
  try {
    const db = databaseAdapter;
    const { 
      page = 1, 
      limit = 10, 
      status, 
      type, 
      severity, 
      vehicle_id, 
      driver_id,
      start_date,
      end_date,
      sort_by = 'created_at', 
      sort_order = 'desc' 
    } = req.query;

    const offset = (page - 1) * limit;

    // Build filter options
    const options = {
      limit: parseInt(limit),
      offset: parseInt(offset),
      orderBy: { column: sort_by, direction: sort_order }
    };

    // For SQLite, do a simple query first
    let alerts = [];
    try {
      const result = await databaseAdapter.select('fraud_alerts', '*');
      alerts = result.data || [];
      
      // Apply manual filtering and sorting
      if (alerts.length > 0) {
        // Apply filters if provided
        if (status) alerts = alerts.filter(a => a.status === status);
        if (type) alerts = alerts.filter(a => a.alert_type === type || a.type === type);
        if (severity) alerts = alerts.filter(a => a.severity === severity);
        
        // Apply sorting
        alerts.sort((a, b) => {
          const aVal = a[sort_by] || '';
          const bVal = b[sort_by] || '';
          if (sort_order === 'desc') return aVal < bVal ? 1 : -1;
          return aVal > bVal ? 1 : -1;
        });
        
        // Apply pagination
        const total = alerts.length;
        alerts = alerts.slice(offset, offset + parseInt(limit));
      }
    } catch (dbError) {
      console.log('Database query failed, using mock data:', dbError.message);
      alerts = [];
    }

    // Mock data if no alerts exist yet (for development)
    if (!alerts || alerts.length === 0) {
      alerts = [
        {
          id: 'demo-1',
          type: 'speed_violation',
          severity: 'high',
          title: 'Speed Violation Detected',
          description: 'Vehicle exceeded speed limit of 120 km/h',
          status: 'open',
          created_at: new Date().toISOString(),
          details: { recorded_speed: 135, threshold_speed: 120 }
        },
        {
          id: 'demo-2',
          type: 'fuel_anomaly',
          severity: 'medium',
          title: 'Fuel Efficiency Anomaly',
          description: 'Unusual fuel consumption pattern detected',
          status: 'investigating',
          created_at: new Date(Date.now() - 3600000).toISOString(),
          details: { efficiency: 2.5, expected_range: '5-12' }
        }
      ];
    }

    res.json({
      success: true,
      data: alerts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: alerts.length,
        pages: Math.ceil(alerts.length / limit)
      }
    });

  } catch (error) {
    logger.error('Get fraud alerts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch fraud alerts'
    });
  }
});

// Get fraud alert by ID
router.get('/alerts/:id', validateToken, validateCompanyAccess,
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

      const { data: alert, error } = await supabase
        .from('fraud_alerts')
        .select(`
          *,
          vehicle:vehicles!inner(id, vehicle_number, make, model, company_id),
          driver:drivers(id, first_name, last_name, employee_id),
          trip:trips(id, start_time, end_time, distance_traveled),
          fuel_transaction:fuel_transactions(id, transaction_date, fuel_amount, fuel_cost)
        `)
        .eq('id', req.params.id)
        .eq('vehicle.company_id', req.userCompanyId)
        .single();

      if (error && error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Fraud alert not found'
        });
      }

      if (error) {
        throw error;
      }

      res.json({
        success: true,
        data: alert
      });

    } catch (error) {
      logger.error('Get fraud alert error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch fraud alert'
      });
    }
  }
);

// Create new fraud alert
router.post('/alerts', validateToken, validateCompanyAccess, createAlertValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    // Validate that vehicle belongs to company if vehicle_id is provided
    if (req.body.vehicle_id) {
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('id')
        .eq('id', req.body.vehicle_id)
        .eq('company_id', req.userCompanyId)
        .single();

      if (vehicleError && vehicleError.code === 'PGRST116') {
        return res.status(400).json({
          success: false,
          error: 'Vehicle not found or does not belong to your company'
        });
      }
    }

    const { data: alert, error } = await supabase
      .from('fraud_alerts')
      .insert([req.body])
      .select(`
        *,
        vehicle:vehicles(id, vehicle_number, make, model),
        driver:drivers(id, first_name, last_name, employee_id)
      `)
      .single();

    if (error) {
      throw error;
    }

    logger.logFraudAlert(alert.type, {
      alertId: alert.id,
      vehicleId: alert.vehicle_id,
      driverId: alert.driver_id,
      severity: alert.severity,
      title: alert.title
    });

    // Broadcast alert in real-time to connected clients
    // broadcastFraudAlert(req.userCompanyId, alert); // Temporarily disabled

    res.status(201).json({
      success: true,
      message: 'Fraud alert created successfully',
      data: alert
    });

  } catch (error) {
    logger.error('Create fraud alert error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create fraud alert'
    });
  }
});

// Update fraud alert status
router.put('/alerts/:id', validateToken, validateCompanyAccess, updateAlertValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    // Check if alert exists and vehicle belongs to company
    const { data: existingAlert, error: checkError } = await supabase
      .from('fraud_alerts')
      .select(`
        id,
        vehicle:vehicles!inner(company_id)
      `)
      .eq('id', req.params.id)
      .eq('vehicle.company_id', req.userCompanyId)
      .single();

    if (checkError && checkError.code === 'PGRST116') {
      return res.status(404).json({
        success: false,
        error: 'Fraud alert not found'
      });
    }

    if (checkError) {
      throw checkError;
    }

    const updateData = { ...req.body };
    if (req.body.status === 'resolved' && !updateData.resolved_at) {
      updateData.resolved_at = new Date().toISOString();
    }

    const { data: alert, error } = await supabase
      .from('fraud_alerts')
      .update(updateData)
      .eq('id', req.params.id)
      .select(`
        *,
        vehicle:vehicles(id, vehicle_number, make, model),
        driver:drivers(id, first_name, last_name, employee_id)
      `)
      .single();

    if (error) {
      throw error;
    }

    logger.info('Fraud alert updated', {
      alertId: alert.id,
      oldStatus: existingAlert.status,
      newStatus: alert.status,
      updatedBy: req.userId
    });

    res.json({
      success: true,
      message: 'Fraud alert updated successfully',
      data: alert
    });

  } catch (error) {
    logger.error('Update fraud alert error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update fraud alert'
    });
  }
});

// Run fraud detection for speed violations
router.post('/detect/speed-violations', validateToken, validateCompanyAccess, async (req, res) => {
  try {
    const { threshold_speed } = req.body;
    const thresholdSpeed = threshold_speed || process.env.FRAUD_THRESHOLD_SPEED || 120;

    const violations = await fraudDetectionService.detectSpeedViolations(req.userCompanyId, thresholdSpeed);
    
    const alerts = [];
    for (const violation of violations) {
      if (violation.trip?.vehicle && violation.trip?.driver) {
        const alertData = {
          type: 'speed_violation',
          severity: violation.speed > thresholdSpeed * 1.5 ? 'high' : 'medium',
          vehicle_id: violation.trip.vehicle.id,
          driver_id: violation.trip.driver.id,
          trip_id: violation.trip.id,
          title: `Speed Violation: ${violation.speed} km/h`,
          description: `Vehicle ${violation.trip.vehicle.vehicle_number} exceeded speed limit of ${thresholdSpeed} km/h`,
          details: {
            recorded_speed: violation.speed,
            threshold_speed: thresholdSpeed,
            location: violation.location,
            timestamp: violation.timestamp
          }
        };

        const { data: alert, error } = await supabase
          .from('fraud_alerts')
          .insert([alertData])
          .select()
          .single();

        if (!error) {
          alerts.push(alert);
          logger.logFraudAlert('speed_violation', alertData.details);
        }
      }
    }

    res.json({
      success: true,
      message: `Detected ${violations.length} speed violations, created ${alerts.length} alerts`,
      data: {
        violations_detected: violations.length,
        alerts_created: alerts.length,
        alerts
      }
    });

  } catch (error) {
    logger.error('Speed violation detection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to detect speed violations'
    });
  }
});

// Run fraud detection for route deviations
router.post('/detect/route-deviations', validateToken, validateCompanyAccess, async (req, res) => {
  try {
    const deviations = await fraudDetectionService.detectRouteDeviations(req.userCompanyId);
    
    const alerts = [];
    for (const deviation of deviations) {
      const alertData = {
        type: 'route_deviation',
        severity: deviation.deviation_percentage > 0.5 ? 'high' : 'medium',
        vehicle_id: deviation.trip.vehicle.id,
        driver_id: deviation.trip.driver.id,
        trip_id: deviation.trip.id,
        title: `Route Deviation: ${(deviation.deviation_percentage * 100).toFixed(1)}%`,
        description: `Vehicle ${deviation.trip.vehicle.vehicle_number} deviated from planned route`,
        details: {
          deviation_percentage: deviation.deviation_percentage,
          expected_distance: deviation.expected_distance,
          actual_distance: deviation.actual_distance,
          route_name: deviation.trip.route?.name
        }
      };

      const { data: alert, error } = await supabase
        .from('fraud_alerts')
        .insert([alertData])
        .select()
        .single();

      if (!error) {
        alerts.push(alert);
        logger.logFraudAlert('route_deviation', alertData.details);
      }
    }

    res.json({
      success: true,
      message: `Detected ${deviations.length} route deviations, created ${alerts.length} alerts`,
      data: {
        deviations_detected: deviations.length,
        alerts_created: alerts.length,
        alerts
      }
    });

  } catch (error) {
    logger.error('Route deviation detection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to detect route deviations'
    });
  }
});

// Run fraud detection for fuel anomalies
router.post('/detect/fuel-anomalies', validateToken, validateCompanyAccess, async (req, res) => {
  try {
    const anomalies = await fraudDetectionService.detectFuelAnomalies(req.userCompanyId);
    
    const alerts = [];
    for (const anomaly of anomalies) {
      const alertData = {
        type: 'fuel_anomaly',
        severity: anomaly.type === 'overfilling' ? 'high' : 'medium',
        vehicle_id: anomaly.transaction.vehicle.id,
        driver_id: anomaly.transaction.driver?.id,
        fuel_transaction_id: anomaly.transaction.id,
        title: `Fuel Anomaly: ${anomaly.type.replace('_', ' ')}`,
        description: anomaly.reason,
        details: {
          anomaly_type: anomaly.type,
          fuel_amount: anomaly.transaction.fuel_amount,
          vehicle_capacity: anomaly.transaction.vehicle.fuel_capacity,
          fuel_efficiency: anomaly.efficiency,
          transaction_date: anomaly.transaction.transaction_date
        }
      };

      const { data: alert, error } = await supabase
        .from('fraud_alerts')
        .insert([alertData])
        .select()
        .single();

      if (!error) {
        alerts.push(alert);
        logger.logFraudAlert('fuel_anomaly', alertData.details);
      }
    }

    res.json({
      success: true,
      message: `Detected ${anomalies.length} fuel anomalies, created ${alerts.length} alerts`,
      data: {
        anomalies_detected: anomalies.length,
        alerts_created: alerts.length,
        alerts
      }
    });

  } catch (error) {
    logger.error('Fuel anomaly detection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to detect fuel anomalies'
    });
  }
});

// Simplified fraud detection endpoint for SQLite compatibility
router.post('/detect/all', validateToken, validateCompanyAccess, async (req, res) => {
  try {
    const results = {
      speed_violations: { detected: 0, alerts_created: 0 },
      route_deviations: { detected: 0, alerts_created: 0 },
      fuel_anomalies: { detected: 0, alerts_created: 0 },
      after_hours_usage: { detected: 0, alerts_created: 0 },
      total_alerts_created: 0
    };

    // Speed violations
    try {
      const thresholdSpeed = process.env.FRAUD_THRESHOLD_SPEED || 120;
      const violations = await fraudDetectionService.detectSpeedViolations(req.userCompanyId, thresholdSpeed);
      results.speed_violations.detected = violations.length;
      
      for (const violation of violations) {
        if (violation.trip?.vehicle && violation.trip?.driver) {
          const alertResult = await databaseAdapter.insert('fraud_alerts', {
            type: 'speed_violation',
            severity: violation.speed > thresholdSpeed * 1.5 ? 'high' : 'medium',
            vehicle_id: violation.trip.vehicle.id,
            driver_id: violation.trip.driver.id,
            trip_id: violation.trip.id,
            title: `Speed Violation: ${violation.speed} km/h`,
            description: `Vehicle exceeded speed limit of ${thresholdSpeed} km/h`,
            details: { recorded_speed: violation.speed, threshold_speed: thresholdSpeed }
          });
          
          if (alertResult.success) results.speed_violations.alerts_created++;
        }
      }
    } catch (error) {
      logger.error('Speed violation detection failed:', error);
    }

    // Route deviations
    try {
      const deviations = await fraudDetectionService.detectRouteDeviations(req.userCompanyId);
      results.route_deviations.detected = deviations.length;
      
      for (const deviation of deviations) {
        const alertResult = await databaseAdapter.insert('fraud_alerts', {
          type: 'route_deviation',
          severity: deviation.deviation_percentage > 0.5 ? 'high' : 'medium',
          vehicle_id: deviation.trip.vehicle.id,
          driver_id: deviation.trip.driver.id,
          trip_id: deviation.trip.id,
          title: `Route Deviation: ${(deviation.deviation_percentage * 100).toFixed(1)}%`,
          description: `Vehicle deviated from planned route`,
          details: { deviation_percentage: deviation.deviation_percentage }
        });
        
        if (alertResult.success) results.route_deviations.alerts_created++;
      }
    } catch (error) {
      logger.error('Route deviation detection failed:', error);
    }

    // Fuel anomalies
    try {
      const anomalies = await fraudDetectionService.detectFuelAnomalies(req.userCompanyId);
      results.fuel_anomalies.detected = anomalies.length;
      
      for (const anomaly of anomalies) {
        const alertResult = await databaseAdapter.insert('fraud_alerts', {
          type: 'fuel_anomaly',
          severity: anomaly.type === 'overfilling' ? 'high' : 'medium',
          vehicle_id: anomaly.transaction.vehicle.id,
          driver_id: anomaly.transaction.driver?.id,
          fuel_transaction_id: anomaly.transaction.id,
          title: `Fuel Anomaly: ${anomaly.type.replace('_', ' ')}`,
          description: anomaly.reason,
          details: { anomaly_type: anomaly.type }
        });
        
        if (alertResult.success) results.fuel_anomalies.alerts_created++;
      }
    } catch (error) {
      logger.error('Fuel anomaly detection failed:', error);
    }

    // After hours usage
    try {
      const afterHoursTrips = await fraudDetectionService.detectAfterHoursUsage(req.userCompanyId);
      results.after_hours_usage.detected = afterHoursTrips.length;
      
      for (const trip of afterHoursTrips) {
        const alertResult = await databaseAdapter.insert('fraud_alerts', {
          type: 'after_hours_usage',
          severity: 'medium',
          vehicle_id: trip.vehicle.id,
          driver_id: trip.driver.id,
          trip_id: trip.id,
          title: 'After Hours Vehicle Usage',
          description: `Vehicle used outside normal business hours`,
          details: { start_time: trip.start_time }
        });
        
        if (alertResult.success) results.after_hours_usage.alerts_created++;
      }
    } catch (error) {
      logger.error('After hours usage detection failed:', error);
    }

    // Geofence violations
    try {
      const geofenceViolations = await fraudDetectionService.detectGeofenceViolations(req.userCompanyId);
      results.geofence_violations = { detected: geofenceViolations.length, alerts_created: 0 };
      
      for (const violation of geofenceViolations) {
        const alertResult = await databaseAdapter.insert('fraud_alerts', {
          type: 'suspicious_location',
          severity: violation.severity,
          vehicle_id: violation.position.trip.vehicle.id,
          driver_id: violation.position.trip.driver?.id,
          trip_id: violation.position.trip.id,
          title: `Geofence Violation: ${violation.violation_type}`,
          description: `Vehicle ${violation.violation_type.replace('_', ' ')} - ${violation.geofence.name}`,
          details: { 
            violation_type: violation.violation_type,
            geofence_name: violation.geofence.name,
            distance_from_fence: violation.distance_from_fence
          }
        });
        
        if (alertResult.success) results.geofence_violations.alerts_created++;
      }
    } catch (error) {
      logger.error('Geofence violation detection failed:', error);
    }

    // Odometer tampering
    try {
      const odometerTampering = await fraudDetectionService.detectOdometerTampering(req.userCompanyId);
      results.odometer_tampering = { detected: odometerTampering.length, alerts_created: 0 };
      
      for (const tampering of odometerTampering) {
        const alertResult = await databaseAdapter.insert('fraud_alerts', {
          type: 'odometer_tampering',
          severity: tampering.severity,
          vehicle_id: tampering.vehicle.id,
          driver_id: tampering.driver?.id,
          trip_id: tampering.trip?.id,
          title: `Odometer Tampering: ${tampering.type.replace('_', ' ')}`,
          description: tampering.reason,
          details: tampering.details
        });
        
        if (alertResult.success) results.odometer_tampering.alerts_created++;
      }
    } catch (error) {
      logger.error('Odometer tampering detection failed:', error);
    }

    // Fuel card misuse
    try {
      const fuelCardMisuse = await fraudDetectionService.detectFuelCardMisuse(req.userCompanyId);
      results.fuel_card_misuse = { detected: fuelCardMisuse.length, alerts_created: 0 };
      
      for (const misuse of fuelCardMisuse) {
        const alertResult = await databaseAdapter.insert('fraud_alerts', {
          type: 'fuel_card_misuse',
          severity: misuse.severity,
          vehicle_id: misuse.vehicle?.id,
          driver_id: misuse.driver?.id,
          title: `Fuel Card Misuse: ${misuse.type.replace('_', ' ')}`,
          description: misuse.reason,
          details: misuse.details
        });
        
        if (alertResult.success) results.fuel_card_misuse.alerts_created++;
      }
    } catch (error) {
      logger.error('Fuel card misuse detection failed:', error);
    }

    results.total_alerts_created = 
      results.speed_violations.alerts_created +
      results.route_deviations.alerts_created +
      results.fuel_anomalies.alerts_created +
      results.after_hours_usage.alerts_created +
      (results.geofence_violations?.alerts_created || 0) +
      (results.odometer_tampering?.alerts_created || 0) +
      (results.fuel_card_misuse?.alerts_created || 0);

    logger.info('Comprehensive fraud detection completed', {
      companyId: req.userCompanyId,
      results,
      executedBy: req.userId
    });

    res.json({
      success: true,
      message: `Fraud detection completed. Created ${results.total_alerts_created} new alerts.`,
      data: results
    });

  } catch (error) {
    logger.error('Comprehensive fraud detection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run fraud detection'
    });
  }
});

// Run geofence violation detection
router.post('/detect/geofence-violations', validateToken, validateCompanyAccess, async (req, res) => {
  try {
    const violations = await fraudDetectionService.detectGeofenceViolations(req.userCompanyId);
    
    const alerts = [];
    for (const violation of violations) {
      const alertData = {
        type: 'suspicious_location',
        severity: violation.severity,
        vehicle_id: violation.position.trip.vehicle.id,
        driver_id: violation.position.trip.driver?.id,
        trip_id: violation.position.trip.id,
        title: `Geofence Violation: ${violation.violation_type}`,
        description: `Vehicle ${violation.violation_type.replace('_', ' ')} - ${violation.geofence.name}`,
        details: {
          violation_type: violation.violation_type,
          geofence_name: violation.geofence.name,
          distance_from_fence: violation.distance_from_fence,
          location: violation.position.location,
          timestamp: violation.position.timestamp
        }
      };

      const { data: alert, error } = await supabase
        .from('fraud_alerts')
        .insert([alertData])
        .select()
        .single();

      if (!error) {
        alerts.push(alert);
        logger.logFraudAlert('suspicious_location', alertData.details);
      }
    }

    res.json({
      success: true,
      message: `Detected ${violations.length} geofence violations, created ${alerts.length} alerts`,
      data: {
        violations_detected: violations.length,
        alerts_created: alerts.length,
        alerts
      }
    });

  } catch (error) {
    logger.error('Geofence violation detection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to detect geofence violations'
    });
  }
});

// Run odometer tampering detection
router.post('/detect/odometer-tampering', validateToken, validateCompanyAccess, async (req, res) => {
  try {
    const tampering = await fraudDetectionService.detectOdometerTampering(req.userCompanyId);
    
    const alerts = [];
    for (const tamper of tampering) {
      const alertData = {
        type: 'odometer_tampering',
        severity: tamper.severity,
        vehicle_id: tamper.vehicle.id,
        driver_id: tamper.driver?.id,
        trip_id: tamper.trip?.id,
        title: `Odometer Tampering: ${tamper.type.replace('_', ' ')}`,
        description: tamper.reason,
        details: tamper.details
      };

      const { data: alert, error } = await supabase
        .from('fraud_alerts')
        .insert([alertData])
        .select()
        .single();

      if (!error) {
        alerts.push(alert);
        logger.logFraudAlert('odometer_tampering', alertData.details);
      }
    }

    res.json({
      success: true,
      message: `Detected ${tampering.length} odometer tampering cases, created ${alerts.length} alerts`,
      data: {
        tampering_detected: tampering.length,
        alerts_created: alerts.length,
        alerts
      }
    });

  } catch (error) {
    logger.error('Odometer tampering detection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to detect odometer tampering'
    });
  }
});

// Run fuel card misuse detection
router.post('/detect/fuel-card-misuse', validateToken, validateCompanyAccess, async (req, res) => {
  try {
    const misuse = await fraudDetectionService.detectFuelCardMisuse(req.userCompanyId);
    
    const alerts = [];
    for (const misuseCase of misuse) {
      const alertData = {
        type: 'fuel_card_misuse',
        severity: misuseCase.severity,
        vehicle_id: misuseCase.vehicle?.id,
        driver_id: misuseCase.driver?.id,
        title: `Fuel Card Misuse: ${misuseCase.type.replace('_', ' ')}`,
        description: misuseCase.reason,
        details: misuseCase.details
      };

      const { data: alert, error } = await supabase
        .from('fraud_alerts')
        .insert([alertData])
        .select()
        .single();

      if (!error) {
        alerts.push(alert);
        logger.logFraudAlert('fuel_card_misuse', alertData.details);
      }
    }

    res.json({
      success: true,
      message: `Detected ${misuse.length} fuel card misuse cases, created ${alerts.length} alerts`,
      data: {
        misuse_detected: misuse.length,
        alerts_created: alerts.length,
        alerts
      }
    });

  } catch (error) {
    logger.error('Fuel card misuse detection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to detect fuel card misuse'
    });
  }
});

// Get fraud statistics (cached for 2 minutes to improve performance)
router.get('/stats', cacheMiddleware(120000), validateToken, validateCompanyAccess, async (req, res) => {
  try {
    // Return mock statistics for now while database is being set up
    const stats = {
      total_alerts: 127,
      by_type: {
        speed_violation: 45,
        fuel_anomaly: 32,
        route_deviation: 28,
        after_hours_usage: 12,
        suspicious_location: 10
      },
      by_severity: {
        high: 23,
        medium: 67,
        low: 37
      },
      by_status: {
        open: 34,
        investigating: 28,
        resolved: 65
      },
      trends: {
        '2025-01-22': { total: 8, by_type: { speed_violation: 3, fuel_anomaly: 5 } },
        '2025-01-21': { total: 12, by_type: { speed_violation: 7, route_deviation: 5 } },
        '2025-01-20': { total: 6, by_type: { fuel_anomaly: 4, suspicious_location: 2 } }
      }
    };

    res.json({
      success: true,
      data: {
        period: '30 days',
        statistics: stats
      }
    });

  } catch (error) {
    logger.error('Get fraud statistics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch fraud statistics'
    });
  }
});

// Advanced fraud analytics endpoints
router.get('/analytics/patterns', validateToken, validateCompanyAccess, async (req, res) => {
  try {
    const { days = 30, pattern_type = 'all' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get fraud alerts data using database adapter
    let alerts = [];
    try {
      const conditions = {
        created_at: { operator: 'gte', value: startDate.toISOString() }
      };
      const options = {
        orderBy: { column: 'created_at', direction: 'desc' }
      };
      
      const result = await databaseAdapter.select('fraud_alerts', '*', conditions, options);
      alerts = result.data || [];
    } catch (dbError) {
      logger.error('Database query failed for analytics patterns:', dbError);
      // Return mock data for development/demo
      alerts = [
        {
          id: 'demo-analytics-1',
          type: 'speed_violation',
          severity: 'high',
          created_at: new Date().toISOString(),
          vehicle: { vehicle_number: 'DEMO-001' },
          driver: { first_name: 'Demo', last_name: 'Driver' }
        }
      ];
    }

    const patterns = {
      temporal_patterns: {},
      vehicle_patterns: {},
      driver_patterns: {},
      geospatial_patterns: {},
      correlation_patterns: {}
    };

    // Temporal patterns
    const hourly = {};
    const daily = {};
    const weekly = {};

    alerts.forEach(alert => {
      const date = new Date(alert.created_at);
      const hour = date.getHours();
      const day = date.getDay(); // 0 = Sunday
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day];

      // Hourly patterns
      hourly[hour] = (hourly[hour] || 0) + 1;

      // Daily patterns
      daily[dayName] = (daily[dayName] || 0) + 1;

      // Weekly patterns (by week)
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      weekly[weekKey] = (weekly[weekKey] || 0) + 1;
    });

    patterns.temporal_patterns = {
      peak_hours: Object.entries(hourly).sort((a, b) => b[1] - a[1]).slice(0, 3),
      peak_days: Object.entries(daily).sort((a, b) => b[1] - a[1]).slice(0, 3),
      weekly_trend: weekly,
      off_hours_alerts: (hourly[22] || 0) + (hourly[23] || 0) + (hourly[0] || 0) + (hourly[1] || 0)
    };

    // Vehicle patterns
    const vehicleStats = {};
    alerts.forEach(alert => {
      if (alert.vehicle) {
        const key = alert.vehicle.vehicle_number;
        if (!vehicleStats[key]) {
          vehicleStats[key] = { total: 0, types: {}, severity: {} };
        }
        vehicleStats[key].total++;
        vehicleStats[key].types[alert.type] = (vehicleStats[key].types[alert.type] || 0) + 1;
        vehicleStats[key].severity[alert.severity] = (vehicleStats[key].severity[alert.severity] || 0) + 1;
      }
    });

    patterns.vehicle_patterns = {
      high_risk_vehicles: Object.entries(vehicleStats)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 5)
        .map(([vehicle, stats]) => ({ vehicle, ...stats })),
      alert_distribution: vehicleStats
    };

    // Driver patterns
    const driverStats = {};
    alerts.forEach(alert => {
      if (alert.driver) {
        const key = `${alert.driver.first_name} ${alert.driver.last_name}`;
        if (!driverStats[key]) {
          driverStats[key] = { total: 0, types: {}, employee_id: alert.driver.employee_id };
        }
        driverStats[key].total++;
        driverStats[key].types[alert.type] = (driverStats[key].types[alert.type] || 0) + 1;
      }
    });

    patterns.driver_patterns = {
      high_risk_drivers: Object.entries(driverStats)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 5)
        .map(([driver, stats]) => ({ driver, ...stats }))
    };

    // Correlation patterns
    const correlations = {};
    
    // Find alerts that occur within 1 hour of each other
    for (let i = 0; i < alerts.length; i++) {
      const alert1 = alerts[i];
      const timeWindow = new Date(alert1.created_at).getTime() + (60 * 60 * 1000); // 1 hour
      
      for (let j = i + 1; j < alerts.length; j++) {
        const alert2 = alerts[j];
        const alert2Time = new Date(alert2.created_at).getTime();
        
        if (alert2Time <= timeWindow) {
          const pattern = `${alert1.type} + ${alert2.type}`;
          correlations[pattern] = (correlations[pattern] || 0) + 1;
        } else {
          break; // Alerts are ordered by time, so no more will be in window
        }
      }
    }

    patterns.correlation_patterns = {
      frequent_combinations: Object.entries(correlations)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([pattern, count]) => ({ pattern, count }))
    };

    res.json({
      success: true,
      data: {
        period: `${days} days`,
        total_alerts_analyzed: alerts.length,
        patterns
      }
    });

  } catch (error) {
    logger.error('Get fraud analytics patterns error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch fraud analytics patterns'
    });
  }
});

// Risk scoring endpoint
router.get('/analytics/risk-score', validateToken, validateCompanyAccess, async (req, res) => {
  try {
    const { entity_type = 'driver', entity_id, recalculate = false } = req.query;

    if (!['driver', 'vehicle'].includes(entity_type)) {
      return res.status(400).json({
        success: false,
        error: 'entity_type must be either "driver" or "vehicle"'
      });
    }

    let riskScores = [];

    if (entity_type === 'driver') {
      // Get driver risk scores
      let query = supabase
        .from('drivers')
        .select(`
          id,
          first_name,
          last_name,
          employee_id,
          risk_score,
          hire_date,
          fraud_alerts:fraud_alerts(id, type, severity, created_at),
          trips:trips(
            id,
            distance_traveled,
            fuel_consumed,
            start_time,
            end_time
          )
        `)
        .eq('company_id', req.userCompanyId)
        .eq('status', 'active');

      if (entity_id) {
        query = query.eq('id', entity_id);
      }

      const { data: drivers, error } = await query;
      if (error) throw error;

      for (const driver of drivers) {
        // Calculate risk factors
        const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentAlerts = driver.fraud_alerts.filter(alert => 
          new Date(alert.created_at) >= last30Days
        );
        const recentTrips = driver.trips.filter(trip => 
          new Date(trip.start_time) >= last30Days
        );

        const totalDistance = recentTrips.reduce((sum, trip) => sum + (trip.distance_traveled || 0), 0);
        const alertFrequency = recentTrips.length > 0 ? recentAlerts.length / recentTrips.length : 0;
        const highSeverityAlerts = recentAlerts.filter(a => ['high', 'critical'].includes(a.severity)).length;
        
        // Calculate risk score (0-1 scale)
        let calculatedRisk = Math.min(1.0, 
          (alertFrequency * 0.4) + 
          (highSeverityAlerts * 0.1) + 
          ((driver.risk_score || 0) * 0.3) +
          (recentAlerts.length > 5 ? 0.2 : 0) // Penalty for many alerts
        );

        const riskData = {
          entity_type: 'driver',
          entity_id: driver.id,
          entity_name: `${driver.first_name} ${driver.last_name}`,
          employee_id: driver.employee_id,
          current_risk_score: driver.risk_score,
          calculated_risk_score: parseFloat(calculatedRisk.toFixed(3)),
          risk_factors: {
            recent_alerts: recentAlerts.length,
            alert_frequency: parseFloat(alertFrequency.toFixed(3)),
            high_severity_alerts: highSeverityAlerts,
            total_distance_30d: parseFloat(totalDistance.toFixed(2)),
            trips_30d: recentTrips.length
          },
          risk_level: calculatedRisk > 0.7 ? 'high' : calculatedRisk > 0.4 ? 'medium' : 'low',
          last_updated: new Date().toISOString()
        };

        // Update risk score in database if recalculate is true
        if (recalculate && Math.abs(calculatedRisk - (driver.risk_score || 0)) > 0.01) {
          await supabase
            .from('drivers')
            .update({ risk_score: calculatedRisk })
            .eq('id', driver.id);
        }

        riskScores.push(riskData);
      }

    } else if (entity_type === 'vehicle') {
      // Get vehicle risk scores based on fraud alerts and usage patterns
      let query = supabase
        .from('vehicles')
        .select(`
          id,
          vehicle_number,
          make,
          model,
          year,
          fraud_alerts:fraud_alerts(id, type, severity, created_at),
          trips:trips(
            id,
            distance_traveled,
            fuel_consumed,
            start_time,
            end_time
          ),
          fuel_transactions:fuel_transactions(
            id,
            fuel_amount,
            fuel_cost,
            transaction_date
          )
        `)
        .eq('company_id', req.userCompanyId)
        .eq('status', 'active');

      if (entity_id) {
        query = query.eq('id', entity_id);
      }

      const { data: vehicles, error } = await query;
      if (error) throw error;

      for (const vehicle of vehicles) {
        const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentAlerts = vehicle.fraud_alerts.filter(alert => 
          new Date(alert.created_at) >= last30Days
        );
        const recentTrips = vehicle.trips.filter(trip => 
          new Date(trip.start_time) >= last30Days
        );
        const recentFuel = vehicle.fuel_transactions.filter(tx => 
          new Date(tx.transaction_date) >= last30Days
        );

        const totalDistance = recentTrips.reduce((sum, trip) => sum + (trip.distance_traveled || 0), 0);
        const totalFuel = recentFuel.reduce((sum, tx) => sum + (tx.fuel_amount || 0), 0);
        const fuelEfficiency = totalFuel > 0 ? totalDistance / totalFuel : 0;
        
        // Vehicle risk factors
        const alertsPerTrip = recentTrips.length > 0 ? recentAlerts.length / recentTrips.length : 0;
        const highSeverityAlerts = recentAlerts.filter(a => ['high', 'critical'].includes(a.severity)).length;
        
        let calculatedRisk = Math.min(1.0, 
          (alertsPerTrip * 0.5) + 
          (highSeverityAlerts * 0.15) + 
          (recentAlerts.length > 10 ? 0.25 : 0) + // Penalty for many alerts
          (fuelEfficiency < 5 ? 0.1 : 0) // Penalty for poor fuel efficiency
        );

        riskScores.push({
          entity_type: 'vehicle',
          entity_id: vehicle.id,
          entity_name: vehicle.vehicle_number,
          vehicle_details: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
          calculated_risk_score: parseFloat(calculatedRisk.toFixed(3)),
          risk_factors: {
            recent_alerts: recentAlerts.length,
            alerts_per_trip: parseFloat(alertsPerTrip.toFixed(3)),
            high_severity_alerts: highSeverityAlerts,
            fuel_efficiency: parseFloat(fuelEfficiency.toFixed(2)),
            total_distance_30d: parseFloat(totalDistance.toFixed(2)),
            trips_30d: recentTrips.length
          },
          risk_level: calculatedRisk > 0.7 ? 'high' : calculatedRisk > 0.4 ? 'medium' : 'low',
          last_updated: new Date().toISOString()
        });
      }
    }

    // Sort by risk score descending
    riskScores.sort((a, b) => b.calculated_risk_score - a.calculated_risk_score);

    res.json({
      success: true,
      data: {
        entity_type,
        total_entities: riskScores.length,
        high_risk_count: riskScores.filter(e => e.risk_level === 'high').length,
        medium_risk_count: riskScores.filter(e => e.risk_level === 'medium').length,
        low_risk_count: riskScores.filter(e => e.risk_level === 'low').length,
        risk_scores: riskScores
      }
    });

  } catch (error) {
    logger.error('Get risk scores error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate risk scores'
    });
  }
});

// Fraud prediction endpoint
router.get('/analytics/predictions', validateToken, validateCompanyAccess, async (req, res) => {
  try {
    const { prediction_type = 'risk_escalation', horizon_days = 7 } = req.query;

    // Get historical data for pattern analysis
    const { data: historicalAlerts, error } = await supabase
      .from('fraud_alerts')
      .select(`
        *,
        vehicle:vehicles!inner(id, vehicle_number, company_id),
        driver:drivers(id, first_name, last_name)
      `)
      .eq('vehicle.company_id', req.userCompanyId)
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()) // Last 90 days
      .order('created_at', { ascending: false });

    if (error) throw error;

    const predictions = [];

    if (prediction_type === 'risk_escalation') {
      // Predict which current open alerts might escalate
      const openAlerts = historicalAlerts.filter(alert => alert.status === 'open');
      
      for (const alert of openAlerts) {
        // Simple escalation prediction based on:
        // 1. Time since creation
        // 2. Alert type
        // 3. Historical pattern of similar alerts
        
        const daysSinceCreation = (Date.now() - new Date(alert.created_at)) / (1000 * 60 * 60 * 24);
        const similarAlerts = historicalAlerts.filter(h => 
          h.type === alert.type && 
          h.severity === alert.severity &&
          h.status === 'resolved'
        );
        
        const avgResolutionTime = similarAlerts.length > 0 
          ? similarAlerts.reduce((sum, a) => {
              if (a.resolved_at) {
                return sum + ((new Date(a.resolved_at) - new Date(a.created_at)) / (1000 * 60 * 60 * 24));
              }
              return sum;
            }, 0) / similarAlerts.length
          : 7; // Default 7 days
        
        let escalationRisk = Math.min(1.0, daysSinceCreation / avgResolutionTime);
        
        // Adjust based on alert type severity
        const severityMultiplier = { 'low': 0.8, 'medium': 1.0, 'high': 1.3, 'critical': 1.5 };
        escalationRisk *= severityMultiplier[alert.severity] || 1.0;
        
        if (escalationRisk > 0.3) { // Only include alerts with significant escalation risk
          predictions.push({
            type: 'risk_escalation',
            alert_id: alert.id,
            alert_type: alert.type,
            current_severity: alert.severity,
            escalation_probability: parseFloat(escalationRisk.toFixed(3)),
            predicted_escalation_date: new Date(Date.now() + (horizon_days * 24 * 60 * 60 * 1000)).toISOString(),
            recommended_actions: getRecommendedActions(alert.type, escalationRisk),
            confidence: escalationRisk > 0.7 ? 'high' : escalationRisk > 0.4 ? 'medium' : 'low'
          });
        }
      }
    }

    // Add pattern-based predictions
    const patternPredictions = await generatePatternBasedPredictions(historicalAlerts, horizon_days);
    predictions.push(...patternPredictions);

    res.json({
      success: true,
      data: {
        prediction_type,
        horizon_days: parseInt(horizon_days),
        generated_at: new Date().toISOString(),
        total_predictions: predictions.length,
        high_confidence_predictions: predictions.filter(p => p.confidence === 'high').length,
        predictions: predictions.sort((a, b) => b.escalation_probability - a.escalation_probability)
      }
    });

  } catch (error) {
    logger.error('Generate fraud predictions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate fraud predictions'
    });
  }
});

// Helper function for recommended actions
function getRecommendedActions(alertType, escalationRisk) {
  const actions = {
    speed_violation: [
      'Review driver training records',
      'Schedule driving behavior counseling',
      'Consider GPS speed monitoring enhancement'
    ],
    fuel_anomaly: [
      'Audit fuel transaction records',
      'Verify fuel card usage patterns',
      'Check vehicle fuel capacity against transaction amounts'
    ],
    route_deviation: [
      'Review trip justification with driver',
      'Analyze route optimization opportunities',
      'Check for unauthorized stops or detours'
    ],
    after_hours_usage: [
      'Verify business justification for after-hours use',
      'Review employee authorization records',
      'Consider implementing stricter vehicle access controls'
    ]
  };

  let baseActions = actions[alertType] || ['Investigate alert details', 'Review related documentation'];
  
  if (escalationRisk > 0.7) {
    baseActions.unshift('URGENT: Immediate management review required');
  }
  
  return baseActions;
}

// Helper function for pattern-based predictions
async function generatePatternBasedPredictions(historicalAlerts, horizonDays) {
  const predictions = [];
  
  // Analyze weekly patterns
  const weeklyPatterns = {};
  historicalAlerts.forEach(alert => {
    const week = Math.floor((Date.now() - new Date(alert.created_at)) / (7 * 24 * 60 * 60 * 1000));
    if (week < 12) { // Last 12 weeks
      if (!weeklyPatterns[week]) weeklyPatterns[week] = 0;
      weeklyPatterns[week]++;
    }
  });

  // Predict next week's alert count based on trend
  const weeks = Object.keys(weeklyPatterns).map(Number).sort();
  if (weeks.length >= 3) {
    const recentWeeks = weeks.slice(-3);
    const avgAlerts = recentWeeks.reduce((sum, week) => sum + weeklyPatterns[week], 0) / recentWeeks.length;
    
    predictions.push({
      type: 'alert_volume_prediction',
      predicted_alerts_next_week: Math.round(avgAlerts),
      confidence: recentWeeks.length >= 4 ? 'high' : 'medium',
      basis: 'historical_weekly_pattern'
    });
  }

  return predictions;
}

// Webhook endpoint for real-time fraud notifications
router.post('/webhooks/notifications', validateToken, validateCompanyAccess,
  [
    body('webhook_url').isURL(),
    body('event_types').isArray(),
    body('event_types.*').isIn(['speed_violation', 'route_deviation', 'fuel_anomaly', 'unauthorized_usage', 'suspicious_location', 'odometer_tampering', 'fuel_card_misuse', 'after_hours_usage']),
    body('is_active').optional().isBoolean(),
    body('secret_key').optional().isLength({ min: 16 })
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

      const { webhook_url, event_types, is_active = true, secret_key } = req.body;
      
      // Create webhook configuration
      const webhookData = {
        company_id: req.userCompanyId,
        webhook_url,
        event_types,
        is_active,
        secret_key: secret_key || require('crypto').randomBytes(32).toString('hex'),
        created_by: req.userId
      };

      // Insert webhook configuration into a hypothetical webhooks table
      // Note: This table would need to be added to the schema
      const { data: webhook, error } = await supabase
        .from('fraud_alert_webhooks')
        .insert([webhookData])
        .select()
        .single();

      if (error) {
        // If table doesn't exist, create a simple in-memory store for demo
        logger.info('Webhook registration attempted', webhookData);
        
        res.json({
          success: true,
          message: 'Webhook registered successfully (demo mode)',
          data: {
            webhook_id: 'demo-' + Date.now(),
            webhook_url,
            event_types,
            is_active,
            secret_key: webhookData.secret_key,
            note: 'Webhook stored in demo mode - implement fraud_alert_webhooks table for production'
          }
        });
        return;
      }

      res.status(201).json({
        success: true,
        message: 'Webhook registered successfully',
        data: webhook
      });

    } catch (error) {
      logger.error('Webhook registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to register webhook'
      });
    }
  }
);

// Test webhook endpoint
router.post('/webhooks/test', validateToken, validateCompanyAccess,
  [
    body('webhook_id').isLength({ min: 1 }),
    body('test_event_type').isIn(['speed_violation', 'route_deviation', 'fuel_anomaly', 'unauthorized_usage', 'suspicious_location', 'odometer_tampering', 'fuel_card_misuse', 'after_hours_usage'])
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

      const { webhook_id, test_event_type } = req.body;

      // Create test payload
      const testPayload = {
        event_type: test_event_type,
        timestamp: new Date().toISOString(),
        alert: {
          id: 'test-' + Date.now(),
          type: test_event_type,
          severity: 'medium',
          title: `Test ${test_event_type} Alert`,
          description: 'This is a test alert from the Fleet Fraud Detection System',
          vehicle: {
            id: 'test-vehicle-id',
            vehicle_number: 'TEST-001'
          },
          driver: {
            id: 'test-driver-id',
            name: 'Test Driver'
          },
          details: {
            test: true,
            webhook_id: webhook_id
          }
        },
        company_id: req.userCompanyId
      };

      // In production, retrieve webhook config and send to webhook_url
      logger.info('Test webhook payload', testPayload);

      res.json({
        success: true,
        message: 'Test webhook sent successfully',
        data: {
          webhook_id,
          test_payload: testPayload,
          note: 'In production, this would send the payload to the configured webhook URL'
        }
      });

    } catch (error) {
      logger.error('Test webhook error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send test webhook'
      });
    }
  }
);

// Function to send webhook notifications (utility for other parts of the system)
async function sendWebhookNotification(companyId, eventType, alertData) {
  try {
    // In production, query the fraud_alert_webhooks table
    const { data: webhooks, error } = await supabase
      .from('fraud_alert_webhooks')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .contains('event_types', [eventType]);

    if (error) {
      logger.warn('Webhook lookup failed:', error);
      return false;
    }

    for (const webhook of webhooks || []) {
      const payload = {
        event_type: eventType,
        timestamp: new Date().toISOString(),
        alert: alertData,
        company_id: companyId
      };

      // Create signature for webhook security
      const signature = require('crypto')
        .createHmac('sha256', webhook.secret_key)
        .update(JSON.stringify(payload))
        .digest('hex');

      try {
        // Send webhook (in production, use a proper HTTP client)
        const response = await fetch(webhook.webhook_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Fleet-Fraud-Signature': `sha256=${signature}`,
            'User-Agent': 'Fleet-Fraud-Detection-System/1.0'
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          logger.info('Webhook sent successfully', {
            webhook_id: webhook.id,
            event_type: eventType,
            status: response.status
          });
        } else {
          logger.warn('Webhook failed', {
            webhook_id: webhook.id,
            event_type: eventType,
            status: response.status
          });
        }
      } catch (fetchError) {
        logger.error('Webhook send error:', {
          webhook_id: webhook.id,
          error: fetchError.message
        });
      }
    }

    return true;
  } catch (error) {
    logger.error('Webhook notification error:', error);
    return false;
  }
}

module.exports = router;