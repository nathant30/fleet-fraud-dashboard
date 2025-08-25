const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { validateToken, validateCompanyAccess, requireRole } = require('../middleware/auth');

const router = express.Router();

// Fuel fraud detection service functions
const fuelFraudService = {
  // Detect fuel card misuse
  async detectFuelCardMisuse(companyId, days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: transactions, error } = await supabase
      .from('fuel_transactions')
      .select(`
        *,
        vehicle:vehicles!inner(id, vehicle_number, company_id, fuel_capacity),
        driver:drivers(id, first_name, last_name, employee_id),
        trip:trips(id, start_time, end_time, distance_traveled)
      `)
      .eq('vehicle.company_id', companyId)
      .gte('transaction_date', startDate.toISOString())
      .order('transaction_date', { ascending: false });

    if (error) throw error;

    const fraudIndicators = [];
    
    // Group transactions by vehicle and analyze patterns
    const vehicleTransactions = {};
    transactions.forEach(t => {
      if (!vehicleTransactions[t.vehicle_id]) {
        vehicleTransactions[t.vehicle_id] = [];
      }
      vehicleTransactions[t.vehicle_id].push(t);
    });

    for (const vehicleId in vehicleTransactions) {
      const vTransactions = vehicleTransactions[vehicleId];
      const vehicle = vTransactions[0].vehicle;

      // Check for multiple fueling in short time period
      for (let i = 0; i < vTransactions.length - 1; i++) {
        const current = vTransactions[i];
        const next = vTransactions[i + 1];
        const timeDiff = (new Date(current.transaction_date) - new Date(next.transaction_date)) / (1000 * 60 * 60); // hours

        if (timeDiff < 2 && (current.fuel_amount + next.fuel_amount) > vehicle.fuel_capacity * 1.2) {
          fraudIndicators.push({
            type: 'rapid_multiple_fueling',
            severity: 'high',
            vehicle_id: vehicleId,
            transactions: [current.id, next.id],
            details: {
              time_difference_hours: timeDiff,
              total_fuel: current.fuel_amount + next.fuel_amount,
              vehicle_capacity: vehicle.fuel_capacity,
              reason: 'Multiple fueling transactions within 2 hours exceeding vehicle capacity'
            }
          });
        }
      }

      // Check for overfilling
      vTransactions.forEach(transaction => {
        if (transaction.fuel_amount > vehicle.fuel_capacity * 1.1) {
          fraudIndicators.push({
            type: 'overfilling',
            severity: 'medium',
            vehicle_id: vehicleId,
            transactions: [transaction.id],
            details: {
              fuel_amount: transaction.fuel_amount,
              vehicle_capacity: vehicle.fuel_capacity,
              excess_percentage: ((transaction.fuel_amount - vehicle.fuel_capacity) / vehicle.fuel_capacity * 100),
              reason: 'Fuel amount exceeds vehicle tank capacity'
            }
          });
        }
      });

      // Check for fueling without corresponding trip
      vTransactions.forEach(transaction => {
        if (!transaction.trip_id) {
          // Check if there's a trip within 24 hours of fueling
          const fuelDate = new Date(transaction.transaction_date);
          const hasNearbyTrip = vTransactions.some(t => {
            if (!t.trip?.start_time) return false;
            const tripDate = new Date(t.trip.start_time);
            const timeDiff = Math.abs(fuelDate - tripDate) / (1000 * 60 * 60); // hours
            return timeDiff <= 24;
          });

          if (!hasNearbyTrip) {
            fraudIndicators.push({
              type: 'fueling_without_trip',
              severity: 'medium',
              vehicle_id: vehicleId,
              transactions: [transaction.id],
              details: {
                fuel_amount: transaction.fuel_amount,
                transaction_date: transaction.transaction_date,
                reason: 'Fuel transaction without corresponding vehicle trip within 24 hours'
              }
            });
          }
        }
      });
    }

    return fraudIndicators;
  },

  // Detect suspicious fuel efficiency patterns
  async detectSuspiciousFuelEfficiency(companyId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: trips, error } = await supabase
      .from('trips')
      .select(`
        *,
        vehicle:vehicles!inner(id, vehicle_number, company_id, fuel_type),
        driver:drivers(id, first_name, last_name, employee_id),
        fuel_transactions(fuel_amount, fuel_cost)
      `)
      .eq('vehicle.company_id', companyId)
      .eq('status', 'completed')
      .gte('start_time', startDate.toISOString())
      .not('distance_traveled', 'is', null)
      .not('fuel_consumed', 'is', null)
      .gt('distance_traveled', 0)
      .gt('fuel_consumed', 0);

    if (error) throw error;

    const suspiciousPatterns = [];

    // Calculate baseline efficiency for each vehicle type
    const efficiencyByFuelType = {};
    trips.forEach(trip => {
      const fuelType = trip.vehicle.fuel_type;
      if (!efficiencyByFuelType[fuelType]) {
        efficiencyByFuelType[fuelType] = [];
      }
      const efficiency = trip.distance_traveled / trip.fuel_consumed;
      efficiencyByFuelType[fuelType].push(efficiency);
    });

    // Calculate average efficiency per fuel type
    const avgEfficiencyByType = {};
    for (const fuelType in efficiencyByFuelType) {
      const efficiencies = efficiencyByFuelType[fuelType];
      avgEfficiencyByType[fuelType] = efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length;
    }

    // Detect anomalies
    trips.forEach(trip => {
      const efficiency = trip.distance_traveled / trip.fuel_consumed;
      const avgEfficiency = avgEfficiencyByType[trip.vehicle.fuel_type] || 8; // Default baseline
      const efficiencyRatio = efficiency / avgEfficiency;

      // Too efficient (possible odometer tampering or fuel theft)
      if (efficiencyRatio > 2.0) {
        suspiciousPatterns.push({
          type: 'unusually_high_efficiency',
          severity: 'high',
          trip_id: trip.id,
          vehicle_id: trip.vehicle_id,
          driver_id: trip.driver_id,
          details: {
            efficiency: efficiency,
            baseline_efficiency: avgEfficiency,
            efficiency_ratio: efficiencyRatio,
            distance: trip.distance_traveled,
            fuel_consumed: trip.fuel_consumed,
            reason: 'Fuel efficiency is unusually high, possible odometer tampering or fuel theft'
          }
        });
      }

      // Too inefficient (possible fuel card misuse or vehicle issues)
      if (efficiencyRatio < 0.5) {
        suspiciousPatterns.push({
          type: 'unusually_low_efficiency',
          severity: 'medium',
          trip_id: trip.id,
          vehicle_id: trip.vehicle_id,
          driver_id: trip.driver_id,
          details: {
            efficiency: efficiency,
            baseline_efficiency: avgEfficiency,
            efficiency_ratio: efficiencyRatio,
            distance: trip.distance_traveled,
            fuel_consumed: trip.fuel_consumed,
            reason: 'Fuel efficiency is unusually low, possible fuel card misuse or vehicle maintenance needed'
          }
        });
      }
    });

    return suspiciousPatterns;
  },

  // Detect odometer tampering
  async detectOdometerTampering(companyId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select(`
        id,
        vehicle_number,
        odometer,
        trips!trips_vehicle_id_fkey(
          id,
          start_time,
          start_odometer,
          end_odometer,
          distance_traveled
        ),
        fuel_transactions(
          id,
          transaction_date,
          odometer_reading,
          fuel_amount
        )
      `)
      .eq('company_id', companyId)
      .order('trips.start_time', { ascending: true });

    if (error) throw error;

    const tamperingIndicators = [];

    vehicles.forEach(vehicle => {
      if (!vehicle.trips || vehicle.trips.length < 2) return;

      // Sort trips by start time
      const sortedTrips = vehicle.trips
        .filter(t => t.start_odometer && t.end_odometer)
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

      // Check for odometer inconsistencies
      for (let i = 0; i < sortedTrips.length - 1; i++) {
        const currentTrip = sortedTrips[i];
        const nextTrip = sortedTrips[i + 1];

        // Check if next trip's start odometer is less than current trip's end odometer
        if (nextTrip.start_odometer < currentTrip.end_odometer) {
          tamperingIndicators.push({
            type: 'odometer_rollback',
            severity: 'high',
            vehicle_id: vehicle.id,
            trip_ids: [currentTrip.id, nextTrip.id],
            details: {
              current_trip_end: currentTrip.end_odometer,
              next_trip_start: nextTrip.start_odometer,
              difference: currentTrip.end_odometer - nextTrip.start_odometer,
              time_gap: (new Date(nextTrip.start_time) - new Date(currentTrip.start_time)) / (1000 * 60 * 60 * 24), // days
              reason: 'Odometer reading decreased between trips, indicating possible tampering'
            }
          });
        }

        // Check for unrealistic odometer jumps
        const expectedOdometerIncrease = nextTrip.start_odometer - currentTrip.end_odometer;
        const timeDiff = (new Date(nextTrip.start_time) - new Date(currentTrip.start_time)) / (1000 * 60 * 60 * 24); // days
        const dailyDistance = expectedOdometerIncrease / timeDiff;

        if (dailyDistance > 1000) { // More than 1000km per day
          tamperingIndicators.push({
            type: 'unrealistic_odometer_jump',
            severity: 'medium',
            vehicle_id: vehicle.id,
            trip_ids: [currentTrip.id, nextTrip.id],
            details: {
              odometer_increase: expectedOdometerIncrease,
              time_gap_days: timeDiff,
              daily_distance: dailyDistance,
              reason: 'Unrealistic odometer increase, possible tampering or data error'
            }
          });
        }
      }

      // Check fuel transaction odometer readings against trip data
      if (vehicle.fuel_transactions) {
        vehicle.fuel_transactions.forEach(fuelTx => {
          if (!fuelTx.odometer_reading) return;

          // Find closest trip to fuel transaction
          const fuelDate = new Date(fuelTx.transaction_date);
          const closestTrip = sortedTrips.reduce((closest, trip) => {
            const tripDate = new Date(trip.start_time);
            const currentDiff = Math.abs(fuelDate - tripDate);
            const closestDiff = Math.abs(fuelDate - new Date(closest?.start_time || 0));
            return currentDiff < closestDiff ? trip : closest;
          }, null);

          if (closestTrip) {
            const timeDiff = Math.abs(fuelDate - new Date(closestTrip.start_time)) / (1000 * 60 * 60); // hours
            const odometerDiff = Math.abs(fuelTx.odometer_reading - closestTrip.start_odometer);

            // If fuel transaction is within 12 hours of trip but odometer differs significantly
            if (timeDiff < 12 && odometerDiff > 50) {
              tamperingIndicators.push({
                type: 'fuel_odometer_mismatch',
                severity: 'medium',
                vehicle_id: vehicle.id,
                fuel_transaction_id: fuelTx.id,
                trip_id: closestTrip.id,
                details: {
                  fuel_odometer: fuelTx.odometer_reading,
                  trip_odometer: closestTrip.start_odometer,
                  difference: odometerDiff,
                  time_difference_hours: timeDiff,
                  reason: 'Significant odometer difference between fuel transaction and nearby trip'
                }
              });
            }
          }
        });
      }
    });

    return tamperingIndicators;
  },

  // Calculate fuel efficiency baseline for vehicle
  async calculateVehicleBaseline(vehicleId, days = 90) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: trips, error } = await supabase
      .from('trips')
      .select('distance_traveled, fuel_consumed')
      .eq('vehicle_id', vehicleId)
      .eq('status', 'completed')
      .gte('start_time', startDate.toISOString())
      .not('distance_traveled', 'is', null)
      .not('fuel_consumed', 'is', null)
      .gt('distance_traveled', 0)
      .gt('fuel_consumed', 0);

    if (error) throw error;

    if (trips.length === 0) {
      return { efficiency: null, trips_count: 0 };
    }

    const efficiencies = trips.map(trip => trip.distance_traveled / trip.fuel_consumed);
    const avgEfficiency = efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length;
    const stdDev = Math.sqrt(efficiencies.reduce((sq, n) => sq + Math.pow(n - avgEfficiency, 2), 0) / efficiencies.length);

    return {
      efficiency: avgEfficiency,
      standard_deviation: stdDev,
      trips_count: trips.length,
      min_efficiency: Math.min(...efficiencies),
      max_efficiency: Math.max(...efficiencies)
    };
  }
};

// Validation schemas
const fuelTransactionValidation = [
  body('vehicle_id').isUUID(),
  body('driver_id').isUUID(),
  body('transaction_date').isISO8601().toDate(),
  body('fuel_amount').isFloat({ min: 0 }),
  body('fuel_cost').optional().isFloat({ min: 0 }),
  body('odometer_reading').optional().isFloat({ min: 0 }),
  body('receipt_number').optional().isLength({ min: 1 }).trim(),
  body('vendor').optional().isLength({ min: 1 }).trim(),
  body('location').optional().isObject()
];

// Get all fuel transactions for a company
router.get('/transactions', validateToken, validateCompanyAccess, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      vehicle_id, 
      driver_id,
      start_date,
      end_date,
      sort_by = 'transaction_date', 
      sort_order = 'desc' 
    } = req.query;

    const offset = (page - 1) * limit;

    let query = supabase
      .from('fuel_transactions')
      .select(`
        *,
        vehicle:vehicles!inner(id, vehicle_number, make, model, company_id),
        driver:drivers(id, first_name, last_name, employee_id),
        trip:trips(id, start_time, end_time, distance_traveled)
      `, { count: 'exact' })
      .eq('vehicle.company_id', req.userCompanyId)
      .range(offset, offset + limit - 1)
      .order(sort_by, { ascending: sort_order === 'asc' });

    // Apply filters
    if (vehicle_id) query = query.eq('vehicle_id', vehicle_id);
    if (driver_id) query = query.eq('driver_id', driver_id);
    if (start_date) query = query.gte('transaction_date', start_date);
    if (end_date) query = query.lte('transaction_date', end_date);

    const { data: transactions, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    logger.error('Get fuel transactions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch fuel transactions'
    });
  }
});

// Create fuel transaction
router.post('/transactions', validateToken, validateCompanyAccess, fuelTransactionValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    // Verify vehicle and driver belong to company
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

    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('id, company_id')
      .eq('id', req.body.driver_id)
      .eq('company_id', req.userCompanyId)
      .single();

    if (driverError) {
      return res.status(400).json({
        success: false,
        error: 'Driver not found or does not belong to your company'
      });
    }

    const { data: transaction, error } = await supabase
      .from('fuel_transactions')
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

    logger.info('Fuel transaction created', {
      transactionId: transaction.id,
      vehicleId: transaction.vehicle_id,
      driverId: transaction.driver_id,
      fuelAmount: transaction.fuel_amount,
      createdBy: req.userId
    });

    res.status(201).json({
      success: true,
      message: 'Fuel transaction created successfully',
      data: transaction
    });

  } catch (error) {
    logger.error('Create fuel transaction error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create fuel transaction'
    });
  }
});

// Detect fuel card misuse
router.post('/detect/card-misuse', validateToken, validateCompanyAccess, async (req, res) => {
  try {
    const { days = 7 } = req.body;

    const fraudIndicators = await fuelFraudService.detectFuelCardMisuse(req.userCompanyId, days);

    // Create fraud alerts for detected indicators
    const alerts = [];
    for (const indicator of fraudIndicators) {
      const alertData = {
        type: 'fuel_card_misuse',
        severity: indicator.severity,
        vehicle_id: indicator.vehicle_id,
        title: `Fuel Card Misuse: ${indicator.type.replace('_', ' ')}`,
        description: indicator.details.reason,
        details: indicator.details
      };

      const { data: alert, error } = await supabase
        .from('fraud_alerts')
        .insert([alertData])
        .select()
        .single();

      if (!error) {
        alerts.push(alert);
        logger.logFraudAlert('fuel_card_misuse', indicator.details);
      }
    }

    res.json({
      success: true,
      message: `Detected ${fraudIndicators.length} fuel card misuse indicators, created ${alerts.length} alerts`,
      data: {
        indicators_detected: fraudIndicators.length,
        alerts_created: alerts.length,
        indicators: fraudIndicators
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

// Detect suspicious fuel efficiency
router.post('/detect/efficiency-anomalies', validateToken, validateCompanyAccess, async (req, res) => {
  try {
    const { days = 30 } = req.body;

    const suspiciousPatterns = await fuelFraudService.detectSuspiciousFuelEfficiency(req.userCompanyId, days);

    // Create fraud alerts for suspicious patterns
    const alerts = [];
    for (const pattern of suspiciousPatterns) {
      const alertData = {
        type: 'fuel_anomaly',
        severity: pattern.severity,
        vehicle_id: pattern.vehicle_id,
        driver_id: pattern.driver_id,
        trip_id: pattern.trip_id,
        title: `Fuel Efficiency Anomaly: ${pattern.type.replace('_', ' ')}`,
        description: pattern.details.reason,
        details: pattern.details
      };

      const { data: alert, error } = await supabase
        .from('fraud_alerts')
        .insert([alertData])
        .select()
        .single();

      if (!error) {
        alerts.push(alert);
        logger.logFraudAlert('fuel_anomaly', pattern.details);
      }
    }

    res.json({
      success: true,
      message: `Detected ${suspiciousPatterns.length} fuel efficiency anomalies, created ${alerts.length} alerts`,
      data: {
        anomalies_detected: suspiciousPatterns.length,
        alerts_created: alerts.length,
        patterns: suspiciousPatterns
      }
    });

  } catch (error) {
    logger.error('Fuel efficiency anomaly detection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to detect fuel efficiency anomalies'
    });
  }
});

// Detect odometer tampering
router.post('/detect/odometer-tampering', validateToken, validateCompanyAccess, async (req, res) => {
  try {
    const { days = 30 } = req.body;

    const tamperingIndicators = await fuelFraudService.detectOdometerTampering(req.userCompanyId, days);

    // Create fraud alerts for tampering indicators
    const alerts = [];
    for (const indicator of tamperingIndicators) {
      const alertData = {
        type: 'odometer_tampering',
        severity: indicator.severity,
        vehicle_id: indicator.vehicle_id,
        title: `Odometer Tampering: ${indicator.type.replace('_', ' ')}`,
        description: indicator.details.reason,
        details: indicator.details
      };

      const { data: alert, error } = await supabase
        .from('fraud_alerts')
        .insert([alertData])
        .select()
        .single();

      if (!error) {
        alerts.push(alert);
        logger.logFraudAlert('odometer_tampering', indicator.details);
      }
    }

    res.json({
      success: true,
      message: `Detected ${tamperingIndicators.length} odometer tampering indicators, created ${alerts.length} alerts`,
      data: {
        indicators_detected: tamperingIndicators.length,
        alerts_created: alerts.length,
        indicators: tamperingIndicators
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

// Get vehicle fuel efficiency baseline
router.get('/vehicles/:vehicleId/baseline', validateToken, validateCompanyAccess,
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

      const { days = 90 } = req.query;
      const baseline = await fuelFraudService.calculateVehicleBaseline(req.params.vehicleId, parseInt(days));

      res.json({
        success: true,
        data: {
          vehicle: {
            id: vehicle.id,
            vehicle_number: vehicle.vehicle_number
          },
          period_days: parseInt(days),
          baseline
        }
      });

    } catch (error) {
      logger.error('Get vehicle baseline error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate vehicle baseline'
      });
    }
  }
);

// Get fuel consumption statistics
router.get('/stats', validateToken, validateCompanyAccess, async (req, res) => {
  try {
    const { days = 30, vehicle_id } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let transactionQuery = supabase
      .from('fuel_transactions')
      .select(`
        fuel_amount,
        fuel_cost,
        transaction_date,
        vehicle:vehicles!inner(id, company_id, fuel_type)
      `)
      .eq('vehicle.company_id', req.userCompanyId)
      .gte('transaction_date', startDate.toISOString());

    if (vehicle_id) {
      transactionQuery = transactionQuery.eq('vehicle_id', vehicle_id);
    }

    const { data: transactions, error: txError } = await transactionQuery;
    if (txError) throw txError;

    let tripQuery = supabase
      .from('trips')
      .select(`
        distance_traveled,
        fuel_consumed,
        vehicle:vehicles!inner(id, company_id, fuel_type)
      `)
      .eq('vehicle.company_id', req.userCompanyId)
      .eq('status', 'completed')
      .gte('start_time', startDate.toISOString())
      .not('fuel_consumed', 'is', null)
      .gt('fuel_consumed', 0);

    if (vehicle_id) {
      tripQuery = tripQuery.eq('vehicle_id', vehicle_id);
    }

    const { data: trips, error: tripError } = await tripQuery;
    if (tripError) throw tripError;

    // Calculate statistics
    const totalFuelPurchased = transactions.reduce((sum, tx) => sum + (tx.fuel_amount || 0), 0);
    const totalFuelCost = transactions.reduce((sum, tx) => sum + (tx.fuel_cost || 0), 0);
    const totalFuelConsumed = trips.reduce((sum, trip) => sum + (trip.fuel_consumed || 0), 0);
    const totalDistance = trips.reduce((sum, trip) => sum + (trip.distance_traveled || 0), 0);

    const avgFuelEfficiency = totalFuelConsumed > 0 ? totalDistance / totalFuelConsumed : 0;
    const avgFuelCostPerLiter = totalFuelPurchased > 0 ? totalFuelCost / totalFuelPurchased : 0;

    // Group by fuel type
    const byFuelType = {};
    transactions.forEach(tx => {
      const fuelType = tx.vehicle.fuel_type;
      if (!byFuelType[fuelType]) {
        byFuelType[fuelType] = { purchased: 0, cost: 0, transactions: 0 };
      }
      byFuelType[fuelType].purchased += tx.fuel_amount || 0;
      byFuelType[fuelType].cost += tx.fuel_cost || 0;
      byFuelType[fuelType].transactions++;
    });

    trips.forEach(trip => {
      const fuelType = trip.vehicle.fuel_type;
      if (!byFuelType[fuelType]) {
        byFuelType[fuelType] = { consumed: 0, distance: 0, trips: 0 };
      }
      if (!byFuelType[fuelType].consumed) byFuelType[fuelType].consumed = 0;
      if (!byFuelType[fuelType].distance) byFuelType[fuelType].distance = 0;
      if (!byFuelType[fuelType].trips) byFuelType[fuelType].trips = 0;
      
      byFuelType[fuelType].consumed += trip.fuel_consumed || 0;
      byFuelType[fuelType].distance += trip.distance_traveled || 0;
      byFuelType[fuelType].trips++;
    });

    res.json({
      success: true,
      data: {
        period: `${days} days`,
        summary: {
          total_fuel_purchased: parseFloat(totalFuelPurchased.toFixed(2)),
          total_fuel_consumed: parseFloat(totalFuelConsumed.toFixed(2)),
          total_fuel_cost: parseFloat(totalFuelCost.toFixed(2)),
          total_distance: parseFloat(totalDistance.toFixed(2)),
          avg_fuel_efficiency: parseFloat(avgFuelEfficiency.toFixed(2)),
          avg_cost_per_liter: parseFloat(avgFuelCostPerLiter.toFixed(2)),
          fuel_variance: parseFloat((totalFuelPurchased - totalFuelConsumed).toFixed(2))
        },
        by_fuel_type: byFuelType
      }
    });

  } catch (error) {
    logger.error('Get fuel statistics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch fuel statistics'
    });
  }
});

module.exports = router;