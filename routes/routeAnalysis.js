const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { validateToken, validateCompanyAccess, requireRole } = require('../middleware/auth');

const router = express.Router();

// Route analysis service functions
const routeAnalysisService = {
  // Calculate distance between two points using Haversine formula
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  },

  // Analyze trip efficiency
  async analyzeTripEfficiency(tripId) {
    const { data: trip, error } = await supabase
      .from('trips')
      .select(`
        *,
        vehicle:vehicles(fuel_capacity, fuel_type),
        route:routes(expected_distance, expected_duration),
        gps_tracking(location, timestamp, speed)
      `)
      .eq('id', tripId)
      .single();

    if (error) throw error;

    const analysis = {
      trip_id: tripId,
      efficiency_score: 0,
      issues: [],
      recommendations: []
    };

    // Distance efficiency
    if (trip.route?.expected_distance && trip.distance_traveled) {
      const distanceEfficiency = trip.route.expected_distance / trip.distance_traveled;
      analysis.distance_efficiency = distanceEfficiency;
      
      if (distanceEfficiency < 0.9) {
        analysis.issues.push('Significant route deviation detected');
        analysis.recommendations.push('Review route planning and driver training');
      }
    }

    // Fuel efficiency
    if (trip.fuel_consumed && trip.distance_traveled) {
      const fuelEfficiency = trip.distance_traveled / trip.fuel_consumed;
      analysis.fuel_efficiency = fuelEfficiency;
      
      if (fuelEfficiency < 5) {
        analysis.issues.push('Poor fuel efficiency detected');
        analysis.recommendations.push('Vehicle maintenance check recommended');
      }
    }

    // Speed analysis
    if (trip.gps_tracking?.length > 0) {
      const speeds = trip.gps_tracking.map(g => g.speed).filter(s => s > 0);
      if (speeds.length > 0) {
        analysis.avg_speed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
        analysis.max_speed = Math.max(...speeds);
        
        if (analysis.max_speed > 120) {
          analysis.issues.push('Speed violations detected');
          analysis.recommendations.push('Driver safety training required');
        }
      }
    }

    // Calculate overall efficiency score
    let score = 100;
    if (analysis.distance_efficiency && analysis.distance_efficiency < 0.9) score -= 20;
    if (analysis.fuel_efficiency && analysis.fuel_efficiency < 5) score -= 30;
    if (analysis.max_speed && analysis.max_speed > 120) score -= 25;
    
    analysis.efficiency_score = Math.max(0, score);

    return analysis;
  },

  // Detect route anomalies
  async detectRouteAnomalies(companyId, days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: trips, error } = await supabase
      .from('trips')
      .select(`
        *,
        vehicle:vehicles!inner(id, vehicle_number, company_id),
        driver:drivers(id, first_name, last_name),
        route:routes(expected_distance, expected_duration, waypoints),
        gps_tracking(location, timestamp, speed)
      `)
      .eq('vehicle.company_id', companyId)
      .eq('status', 'completed')
      .gte('start_time', startDate.toISOString());

    if (error) throw error;

    const anomalies = [];

    for (const trip of trips || []) {
      const analysis = {
        trip,
        anomaly_type: [],
        severity: 'low',
        details: {}
      };

      // Check for excessive distance
      if (trip.route?.expected_distance && trip.distance_traveled) {
        const distanceRatio = trip.distance_traveled / trip.route.expected_distance;
        if (distanceRatio > 1.3) {
          analysis.anomaly_type.push('excessive_distance');
          analysis.details.distance_ratio = distanceRatio;
          analysis.severity = distanceRatio > 1.5 ? 'high' : 'medium';
        }
      }

      // Check for excessive duration
      if (trip.start_time && trip.end_time && trip.route?.expected_duration) {
        const actualDuration = (new Date(trip.end_time) - new Date(trip.start_time)) / 60000; // minutes
        const durationRatio = actualDuration / trip.route.expected_duration;
        if (durationRatio > 1.3) {
          analysis.anomaly_type.push('excessive_duration');
          analysis.details.duration_ratio = durationRatio;
          if (analysis.severity === 'low') {
            analysis.severity = durationRatio > 1.5 ? 'high' : 'medium';
          }
        }
      }

      // Check for unusual speed patterns
      if (trip.gps_tracking?.length > 0) {
        const speeds = trip.gps_tracking.map(g => g.speed).filter(s => s > 0);
        if (speeds.length > 0) {
          const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
          const maxSpeed = Math.max(...speeds);
          
          if (maxSpeed > 150 || avgSpeed < 20) {
            analysis.anomaly_type.push('unusual_speed_pattern');
            analysis.details.avg_speed = avgSpeed;
            analysis.details.max_speed = maxSpeed;
            analysis.severity = 'high';
          }
        }
      }

      // Check for poor fuel efficiency
      if (trip.fuel_consumed && trip.distance_traveled) {
        const fuelEfficiency = trip.distance_traveled / trip.fuel_consumed;
        if (fuelEfficiency < 3 || fuelEfficiency > 20) {
          analysis.anomaly_type.push('unusual_fuel_consumption');
          analysis.details.fuel_efficiency = fuelEfficiency;
          if (analysis.severity === 'low') {
            analysis.severity = 'medium';
          }
        }
      }

      if (analysis.anomaly_type.length > 0) {
        anomalies.push(analysis);
      }
    }

    return anomalies;
  },

  // Generate route optimization suggestions
  async generateRouteOptimizations(companyId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: trips, error } = await supabase
      .from('trips')
      .select(`
        *,
        vehicle:vehicles!inner(id, vehicle_number, company_id),
        route:routes(id, name, expected_distance),
        start_location,
        end_location
      `)
      .eq('vehicle.company_id', companyId)
      .eq('status', 'completed')
      .gte('start_time', startDate.toISOString());

    if (error) throw error;

    const routeGroups = {};
    const optimizations = [];

    // Group trips by similar routes
    for (const trip of trips || []) {
      if (trip.route?.id) {
        if (!routeGroups[trip.route.id]) {
          routeGroups[trip.route.id] = {
            route: trip.route,
            trips: [],
            total_distance: 0,
            total_fuel: 0,
            trip_count: 0
          };
        }
        
        routeGroups[trip.route.id].trips.push(trip);
        routeGroups[trip.route.id].total_distance += trip.distance_traveled || 0;
        routeGroups[trip.route.id].total_fuel += trip.fuel_consumed || 0;
        routeGroups[trip.route.id].trip_count++;
      }
    }

    // Analyze each route group for optimization opportunities
    for (const routeId in routeGroups) {
      const group = routeGroups[routeId];
      const avgDistance = group.total_distance / group.trip_count;
      const avgFuelConsumption = group.total_fuel / group.trip_count;
      const expectedDistance = group.route.expected_distance || 0;

      const optimization = {
        route_id: routeId,
        route_name: group.route.name,
        trip_count: group.trip_count,
        avg_actual_distance: avgDistance,
        expected_distance: expectedDistance,
        avg_fuel_consumption: avgFuelConsumption,
        recommendations: []
      };

      // Distance optimization
      if (expectedDistance > 0 && avgDistance > expectedDistance * 1.1) {
        optimization.recommendations.push({
          type: 'distance_optimization',
          priority: 'high',
          description: 'Route consistently exceeds expected distance',
          potential_savings: `${((avgDistance - expectedDistance) / expectedDistance * 100).toFixed(1)}% distance reduction`,
          suggestion: 'Review and update route waypoints for optimal path'
        });
      }

      // Fuel efficiency optimization
      if (avgDistance > 0 && avgFuelConsumption > 0) {
        const fuelEfficiency = avgDistance / avgFuelConsumption;
        if (fuelEfficiency < 6) {
          optimization.recommendations.push({
            type: 'fuel_efficiency',
            priority: 'medium',
            description: 'Poor fuel efficiency detected on this route',
            current_efficiency: `${fuelEfficiency.toFixed(2)} km/L`,
            suggestion: 'Consider vehicle maintenance or driver training'
          });
        }
      }

      // Frequency optimization
      if (group.trip_count > 20) {
        optimization.recommendations.push({
          type: 'frequency_optimization',
          priority: 'low',
          description: 'High frequency route - consider consolidation opportunities',
          trip_frequency: `${group.trip_count} trips in ${days} days`,
          suggestion: 'Analyze if trips can be combined or scheduled more efficiently'
        });
      }

      if (optimization.recommendations.length > 0) {
        optimizations.push(optimization);
      }
    }

    return optimizations;
  }
};

// Validation schemas
const routeValidation = [
  body('name').isLength({ min: 1 }).trim(),
  body('description').optional().isLength({ min: 1 }).trim(),
  body('start_location').isLength({ min: 1 }).trim(),
  body('end_location').isLength({ min: 1 }).trim(),
  body('expected_distance').optional().isFloat({ min: 0 }),
  body('expected_duration').optional().isInt({ min: 0 }),
  body('waypoints').optional().isArray()
];

// Get all routes for a company
router.get('/', validateToken, validateCompanyAccess, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, is_active, sort_by = 'created_at', sort_order = 'desc' } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('routes')
      .select(`
        *,
        trip_count:trips(count),
        recent_trips:trips(
          id,
          start_time,
          distance_traveled,
          fuel_consumed,
          vehicle:vehicles(vehicle_number)
        )
      `, { count: 'exact' })
      .eq('company_id', req.userCompanyId)
      .range(offset, offset + limit - 1)
      .order(sort_by, { ascending: sort_order === 'asc' });

    if (search) {
      query = query.or(`name.ilike.%${search}%,start_location.ilike.%${search}%,end_location.ilike.%${search}%`);
    }

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    const { data: routes, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: routes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    logger.error('Get routes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch routes'
    });
  }
});

// Get route by ID
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

      const { data: route, error } = await supabase
        .from('routes')
        .select(`
          *,
          trips(
            id,
            start_time,
            end_time,
            distance_traveled,
            fuel_consumed,
            status,
            vehicle:vehicles(id, vehicle_number),
            driver:drivers(id, first_name, last_name)
          )
        `)
        .eq('id', req.params.id)
        .eq('company_id', req.userCompanyId)
        .single();

      if (error && error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Route not found'
        });
      }

      if (error) {
        throw error;
      }

      res.json({
        success: true,
        data: route
      });

    } catch (error) {
      logger.error('Get route error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch route'
      });
    }
  }
);

// Create new route
router.post('/', validateToken, validateCompanyAccess, routeValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const routeData = {
      ...req.body,
      company_id: req.userCompanyId
    };

    const { data: route, error } = await supabase
      .from('routes')
      .insert([routeData])
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info('Route created', {
      routeId: route.id,
      routeName: route.name,
      companyId: req.userCompanyId,
      createdBy: req.userId
    });

    res.status(201).json({
      success: true,
      message: 'Route created successfully',
      data: route
    });

  } catch (error) {
    logger.error('Create route error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create route'
    });
  }
});

// Update route
router.put('/:id', validateToken, validateCompanyAccess,
  [param('id').isUUID(), ...routeValidation.map(v => v.optional())],
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

      const { data: route, error } = await supabase
        .from('routes')
        .update(req.body)
        .eq('id', req.params.id)
        .eq('company_id', req.userCompanyId)
        .select()
        .single();

      if (error && error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Route not found'
        });
      }

      if (error) {
        throw error;
      }

      logger.info('Route updated', {
        routeId: route.id,
        routeName: route.name,
        companyId: req.userCompanyId,
        updatedBy: req.userId
      });

      res.json({
        success: true,
        message: 'Route updated successfully',
        data: route
      });

    } catch (error) {
      logger.error('Update route error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update route'
      });
    }
  }
);

// Analyze trip efficiency
router.get('/trips/:tripId/analysis', validateToken, validateCompanyAccess,
  [param('tripId').isUUID()],
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

      // Verify trip belongs to company
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .select(`
          id,
          vehicle:vehicles!inner(company_id)
        `)
        .eq('id', req.params.tripId)
        .eq('vehicle.company_id', req.userCompanyId)
        .single();

      if (tripError && tripError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Trip not found'
        });
      }

      if (tripError) {
        throw tripError;
      }

      const analysis = await routeAnalysisService.analyzeTripEfficiency(req.params.tripId);

      res.json({
        success: true,
        data: analysis
      });

    } catch (error) {
      logger.error('Trip analysis error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze trip'
      });
    }
  }
);

// Detect route anomalies
router.get('/anomalies/detect', validateToken, validateCompanyAccess, async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const anomalies = await routeAnalysisService.detectRouteAnomalies(req.userCompanyId, parseInt(days));

    res.json({
      success: true,
      data: {
        period: `${days} days`,
        anomalies_detected: anomalies.length,
        anomalies
      }
    });

  } catch (error) {
    logger.error('Route anomaly detection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to detect route anomalies'
    });
  }
});

// Get route optimization suggestions
router.get('/optimizations/suggestions', validateToken, validateCompanyAccess, async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const optimizations = await routeAnalysisService.generateRouteOptimizations(req.userCompanyId, parseInt(days));

    res.json({
      success: true,
      data: {
        period: `${days} days`,
        routes_analyzed: optimizations.length,
        optimizations
      }
    });

  } catch (error) {
    logger.error('Route optimization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate route optimizations'
    });
  }
});

// Get route performance statistics
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

      // Get route basic info
      const { data: route, error: routeError } = await supabase
        .from('routes')
        .select('id, name, expected_distance, expected_duration')
        .eq('id', req.params.id)
        .eq('company_id', req.userCompanyId)
        .single();

      if (routeError && routeError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Route not found'
        });
      }

      if (routeError) {
        throw routeError;
      }

      // Get trip statistics for this route
      const { data: trips, error: tripsError } = await supabase
        .from('trips')
        .select('distance_traveled, fuel_consumed, start_time, end_time')
        .eq('route_id', req.params.id)
        .eq('status', 'completed')
        .gte('start_time', startDate.toISOString());

      if (tripsError) {
        throw tripsError;
      }

      // Calculate statistics
      const totalTrips = trips.length;
      const totalDistance = trips.reduce((sum, trip) => sum + (trip.distance_traveled || 0), 0);
      const totalFuel = trips.reduce((sum, trip) => sum + (trip.fuel_consumed || 0), 0);
      const avgDistance = totalTrips > 0 ? totalDistance / totalTrips : 0;
      const avgFuelConsumption = totalTrips > 0 ? totalFuel / totalTrips : 0;
      const avgFuelEfficiency = totalFuel > 0 ? totalDistance / totalFuel : 0;

      // Calculate average duration
      const totalDuration = trips.reduce((sum, trip) => {
        if (trip.start_time && trip.end_time) {
          return sum + (new Date(trip.end_time) - new Date(trip.start_time));
        }
        return sum;
      }, 0);
      const avgDuration = totalTrips > 0 ? totalDuration / totalTrips / 60000 : 0; // in minutes

      // Calculate efficiency metrics
      const distanceVariance = route.expected_distance > 0 ? 
        ((avgDistance - route.expected_distance) / route.expected_distance * 100) : 0;
      const durationVariance = route.expected_duration > 0 ? 
        ((avgDuration - route.expected_duration) / route.expected_duration * 100) : 0;

      res.json({
        success: true,
        data: {
          route: {
            id: route.id,
            name: route.name,
            expected_distance: route.expected_distance,
            expected_duration: route.expected_duration
          },
          period: `${days} days`,
          statistics: {
            total_trips: totalTrips,
            avg_distance: parseFloat(avgDistance.toFixed(2)),
            avg_duration_minutes: parseFloat(avgDuration.toFixed(2)),
            avg_fuel_consumption: parseFloat(avgFuelConsumption.toFixed(2)),
            avg_fuel_efficiency: parseFloat(avgFuelEfficiency.toFixed(2)),
            distance_variance_percent: parseFloat(distanceVariance.toFixed(2)),
            duration_variance_percent: parseFloat(durationVariance.toFixed(2))
          }
        }
      });

    } catch (error) {
      logger.error('Get route stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch route statistics'
      });
    }
  }
);

module.exports = router;