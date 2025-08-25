const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { validateToken, validateCompanyAccess, requireRole } = require('../middleware/auth');

const router = express.Router();

// Report generation service functions
const reportService = {
  // Generate fraud summary report
  async generateFraudSummaryReport(companyId, startDate, endDate) {
    const { data: alerts, error } = await supabase
      .from('fraud_alerts')
      .select(`
        *,
        vehicle:vehicles!inner(id, vehicle_number, make, model, company_id),
        driver:drivers(id, first_name, last_name, employee_id),
        trip:trips(id, start_time, end_time, distance_traveled),
        fuel_transaction:fuel_transactions(id, transaction_date, fuel_amount, fuel_cost)
      `)
      .eq('vehicle.company_id', companyId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Aggregate statistics
    const stats = {
      total_alerts: alerts.length,
      by_type: {},
      by_severity: {},
      by_status: {},
      by_vehicle: {},
      by_driver: {},
      estimated_losses: 0,
      resolved_percentage: 0
    };

    alerts.forEach(alert => {
      // Count by type
      stats.by_type[alert.type] = (stats.by_type[alert.type] || 0) + 1;
      
      // Count by severity
      stats.by_severity[alert.severity] = (stats.by_severity[alert.severity] || 0) + 1;
      
      // Count by status
      stats.by_status[alert.status] = (stats.by_status[alert.status] || 0) + 1;
      
      // Count by vehicle
      if (alert.vehicle) {
        const vehicleKey = alert.vehicle.vehicle_number;
        stats.by_vehicle[vehicleKey] = (stats.by_vehicle[vehicleKey] || 0) + 1;
      }
      
      // Count by driver
      if (alert.driver) {
        const driverKey = `${alert.driver.first_name} ${alert.driver.last_name}`;
        stats.by_driver[driverKey] = (stats.by_driver[driverKey] || 0) + 1;
      }
      
      // Estimate losses based on alert type and details
      if (alert.details) {
        switch (alert.type) {
          case 'fuel_anomaly':
            if (alert.fuel_transaction?.fuel_cost) {
              stats.estimated_losses += parseFloat(alert.fuel_transaction.fuel_cost);
            }
            break;
          case 'speed_violation':
            stats.estimated_losses += 50; // Estimated cost for speed violations
            break;
          case 'route_deviation':
            if (alert.trip?.distance_traveled) {
              stats.estimated_losses += alert.trip.distance_traveled * 0.5; // Fuel cost estimate
            }
            break;
        }
      }
    });

    // Calculate resolved percentage
    const resolvedCount = stats.by_status['resolved'] || 0;
    stats.resolved_percentage = stats.total_alerts > 0 
      ? ((resolvedCount / stats.total_alerts) * 100).toFixed(1)
      : 0;

    return {
      period: { start_date: startDate, end_date: endDate },
      statistics: stats,
      alerts: alerts.slice(0, 50) // Limit to 50 most recent for detailed view
    };
  },

  // Generate driver risk report
  async generateDriverRiskReport(companyId, startDate, endDate) {
    const { data: driverData, error } = await supabase
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
          end_time,
          gps_violations:gps_tracking(speed)
        )
      `)
      .eq('company_id', companyId)
      .eq('status', 'active');

    if (error) throw error;

    // Calculate risk metrics for each driver
    const driverRisks = driverData.map(driver => {
      const alertsInPeriod = (driver.fraud_alerts || []).filter(alert => 
        new Date(alert.created_at) >= new Date(startDate) && 
        new Date(alert.created_at) <= new Date(endDate)
      );

      const tripsInPeriod = (driver.trips || []).filter(trip => 
        new Date(trip.start_time) >= new Date(startDate) && 
        new Date(trip.start_time) <= new Date(endDate)
      );

      const totalDistance = tripsInPeriod.reduce((sum, trip) => sum + (trip.distance_traveled || 0), 0);
      const totalFuel = tripsInPeriod.reduce((sum, trip) => sum + (trip.fuel_consumed || 0), 0);
      
      // Calculate metrics
      const alertsPerTrip = tripsInPeriod.length > 0 ? alertsInPeriod.length / tripsInPeriod.length : 0;
      const fuelEfficiency = totalFuel > 0 ? totalDistance / totalFuel : 0;
      
      // Risk scoring factors
      let riskFactors = {
        alert_frequency: alertsPerTrip,
        high_severity_alerts: alertsInPeriod.filter(a => ['high', 'critical'].includes(a.severity)).length,
        fuel_efficiency_variance: 0, // Placeholder for fuel efficiency analysis
        speed_violations: 0 // Placeholder for speed violation analysis
      };

      // Calculate composite risk score
      let calculatedRisk = Math.min(1.0, 
        (riskFactors.alert_frequency * 0.4) + 
        (riskFactors.high_severity_alerts * 0.1) + 
        (driver.risk_score || 0) * 0.5
      );

      return {
        driver: {
          id: driver.id,
          name: `${driver.first_name} ${driver.last_name}`,
          employee_id: driver.employee_id,
          hire_date: driver.hire_date
        },
        metrics: {
          total_trips: tripsInPeriod.length,
          total_distance: parseFloat(totalDistance.toFixed(2)),
          total_alerts: alertsInPeriod.length,
          alert_frequency: parseFloat(alertsPerTrip.toFixed(3)),
          fuel_efficiency: parseFloat(fuelEfficiency.toFixed(2)),
          risk_score: parseFloat(calculatedRisk.toFixed(3))
        },
        risk_factors: riskFactors,
        recent_alerts: alertsInPeriod.slice(0, 5)
      };
    });

    // Sort by risk score descending
    driverRisks.sort((a, b) => b.metrics.risk_score - a.metrics.risk_score);

    return {
      period: { start_date: startDate, end_date: endDate },
      total_drivers: driverRisks.length,
      high_risk_drivers: driverRisks.filter(d => d.metrics.risk_score > 0.7).length,
      drivers: driverRisks
    };
  },

  // Generate vehicle performance and fraud report
  async generateVehicleReport(companyId, startDate, endDate) {
    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select(`
        id,
        vehicle_number,
        make,
        model,
        year,
        fuel_capacity,
        status,
        trips:trips(
          id,
          distance_traveled,
          fuel_consumed,
          start_time,
          end_time,
          fraud_alerts:fraud_alerts(id, type, severity)
        ),
        fuel_transactions:fuel_transactions(
          id,
          fuel_amount,
          fuel_cost,
          transaction_date
        ),
        maintenance_records:maintenance_records(
          id,
          cost,
          maintenance_date,
          type
        )
      `)
      .eq('company_id', companyId);

    if (error) throw error;

    const vehicleReports = vehicles.map(vehicle => {
      // Filter data by period
      const tripsInPeriod = (vehicle.trips || []).filter(trip => 
        new Date(trip.start_time) >= new Date(startDate) && 
        new Date(trip.start_time) <= new Date(endDate)
      );

      const fuelInPeriod = (vehicle.fuel_transactions || []).filter(tx => 
        new Date(tx.transaction_date) >= new Date(startDate) && 
        new Date(tx.transaction_date) <= new Date(endDate)
      );

      const maintenanceInPeriod = (vehicle.maintenance_records || []).filter(record => 
        new Date(record.maintenance_date) >= new Date(startDate) && 
        new Date(record.maintenance_date) <= new Date(endDate)
      );

      // Calculate metrics
      const totalDistance = tripsInPeriod.reduce((sum, trip) => sum + (trip.distance_traveled || 0), 0);
      const totalFuelConsumed = tripsInPeriod.reduce((sum, trip) => sum + (trip.fuel_consumed || 0), 0);
      const totalFuelPurchased = fuelInPeriod.reduce((sum, tx) => sum + (tx.fuel_amount || 0), 0);
      const totalFuelCost = fuelInPeriod.reduce((sum, tx) => sum + (tx.fuel_cost || 0), 0);
      const totalMaintenanceCost = maintenanceInPeriod.reduce((sum, record) => sum + (record.cost || 0), 0);

      // Get all fraud alerts for all trips
      const allAlerts = tripsInPeriod.flatMap(trip => trip.fraud_alerts || []);

      const fuelEfficiency = totalFuelConsumed > 0 ? totalDistance / totalFuelConsumed : 0;
      const fuelVariance = totalFuelPurchased - totalFuelConsumed;
      const costPerKm = totalDistance > 0 ? (totalFuelCost + totalMaintenanceCost) / totalDistance : 0;

      return {
        vehicle: {
          id: vehicle.id,
          vehicle_number: vehicle.vehicle_number,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          status: vehicle.status
        },
        metrics: {
          total_trips: tripsInPeriod.length,
          total_distance: parseFloat(totalDistance.toFixed(2)),
          total_fuel_consumed: parseFloat(totalFuelConsumed.toFixed(2)),
          total_fuel_purchased: parseFloat(totalFuelPurchased.toFixed(2)),
          fuel_variance: parseFloat(fuelVariance.toFixed(2)),
          fuel_efficiency: parseFloat(fuelEfficiency.toFixed(2)),
          total_fuel_cost: parseFloat(totalFuelCost.toFixed(2)),
          total_maintenance_cost: parseFloat(totalMaintenanceCost.toFixed(2)),
          cost_per_km: parseFloat(costPerKm.toFixed(2)),
          fraud_alerts_count: allAlerts.length
        },
        alerts_by_type: allAlerts.reduce((acc, alert) => {
          acc[alert.type] = (acc[alert.type] || 0) + 1;
          return acc;
        }, {}),
        recent_alerts: allAlerts.slice(0, 5)
      };
    });

    // Sort by fraud alerts count descending
    vehicleReports.sort((a, b) => b.metrics.fraud_alerts_count - a.metrics.fraud_alerts_count);

    return {
      period: { start_date: startDate, end_date: endDate },
      total_vehicles: vehicleReports.length,
      vehicles: vehicleReports
    };
  },

  // Generate financial impact report
  async generateFinancialImpactReport(companyId, startDate, endDate) {
    // Get fuel transactions
    const { data: fuelTransactions, error: fuelError } = await supabase
      .from('fuel_transactions')
      .select(`
        fuel_amount,
        fuel_cost,
        transaction_date,
        vehicle:vehicles!inner(company_id),
        fraud_alerts:fraud_alerts(id, type, severity)
      `)
      .eq('vehicle.company_id', companyId)
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate);

    if (fuelError) throw fuelError;

    // Get maintenance costs
    const { data: maintenanceRecords, error: maintenanceError } = await supabase
      .from('maintenance_records')
      .select(`
        cost,
        maintenance_date,
        type,
        vehicle:vehicles!inner(company_id)
      `)
      .eq('vehicle.company_id', companyId)
      .gte('maintenance_date', startDate)
      .lte('maintenance_date', endDate);

    if (maintenanceError) throw maintenanceError;

    // Get fraud alerts with estimated impacts
    const { data: fraudAlerts, error: alertError } = await supabase
      .from('fraud_alerts')
      .select(`
        type,
        severity,
        details,
        created_at,
        vehicle:vehicles!inner(company_id),
        fuel_transaction:fuel_transactions(fuel_cost),
        trip:trips(distance_traveled)
      `)
      .eq('vehicle.company_id', companyId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (alertError) throw alertError;

    // Calculate financial metrics
    const totalFuelCost = fuelTransactions.reduce((sum, tx) => sum + (tx.fuel_cost || 0), 0);
    const totalMaintenanceCost = maintenanceRecords.reduce((sum, record) => sum + (record.cost || 0), 0);
    
    // Estimate fraud-related losses
    let estimatedFraudLosses = 0;
    let preventedLosses = 0;

    fraudAlerts.forEach(alert => {
      switch (alert.type) {
        case 'fuel_anomaly':
          if (alert.fuel_transaction?.fuel_cost) {
            estimatedFraudLosses += alert.fuel_transaction.fuel_cost * 0.8; // 80% of suspicious transaction
          }
          break;
        case 'speed_violation':
          estimatedFraudLosses += 75; // Estimated cost (fuel waste, wear, fines)
          break;
        case 'route_deviation':
          if (alert.trip?.distance_traveled) {
            estimatedFraudLosses += alert.trip.distance_traveled * 0.8; // Extra fuel cost
          }
          break;
        case 'unauthorized_usage':
          estimatedFraudLosses += 100; // Base cost for unauthorized usage
          break;
        case 'after_hours_usage':
          estimatedFraudLosses += 50; // Overtime and fuel costs
          break;
      }

      // Calculate prevented losses (alerts that were resolved)
      if (alert.status === 'resolved') {
        preventedLosses += estimatedFraudLosses * 0.6; // Assume 60% of potential loss was prevented
      }
    });

    // Calculate monthly trends
    const monthlyData = {};
    fuelTransactions.forEach(tx => {
      const month = new Date(tx.transaction_date).toISOString().substring(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = { fuel_cost: 0, fraud_alerts: 0, estimated_losses: 0 };
      }
      monthlyData[month].fuel_cost += tx.fuel_cost || 0;
    });

    fraudAlerts.forEach(alert => {
      const month = new Date(alert.created_at).toISOString().substring(0, 7);
      if (monthlyData[month]) {
        monthlyData[month].fraud_alerts += 1;
        monthlyData[month].estimated_losses += 50; // Base estimate
      }
    });

    return {
      period: { start_date: startDate, end_date: endDate },
      financial_summary: {
        total_fuel_cost: parseFloat(totalFuelCost.toFixed(2)),
        total_maintenance_cost: parseFloat(totalMaintenanceCost.toFixed(2)),
        estimated_fraud_losses: parseFloat(estimatedFraudLosses.toFixed(2)),
        prevented_losses: parseFloat(preventedLosses.toFixed(2)),
        total_operational_cost: parseFloat((totalFuelCost + totalMaintenanceCost).toFixed(2)),
        fraud_loss_percentage: totalFuelCost > 0 ? 
          parseFloat(((estimatedFraudLosses / totalFuelCost) * 100).toFixed(2)) : 0,
        roi_fraud_detection: preventedLosses > 0 ? 
          parseFloat(((preventedLosses - estimatedFraudLosses) / estimatedFraudLosses * 100).toFixed(2)) : 0
      },
      breakdown: {
        fuel_transactions_count: fuelTransactions.length,
        maintenance_records_count: maintenanceRecords.length,
        fraud_alerts_count: fraudAlerts.length,
        high_severity_alerts: fraudAlerts.filter(a => ['high', 'critical'].includes(a.severity)).length
      },
      monthly_trends: Object.keys(monthlyData).sort().map(month => ({
        month,
        ...monthlyData[month]
      }))
    };
  }
};

// Generate fraud summary report
router.get('/fraud-summary', validateToken, validateCompanyAccess,
  [
    query('start_date').isISO8601().toDate(),
    query('end_date').isISO8601().toDate(),
    query('format').optional().isIn(['json', 'csv'])
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

      const { start_date, end_date, format = 'json' } = req.query;
      
      const report = await reportService.generateFraudSummaryReport(
        req.userCompanyId, 
        start_date.toISOString(), 
        end_date.toISOString()
      );

      if (format === 'csv') {
        // Convert to CSV format
        const csv = convertToCSV(report.alerts, [
          'type', 'severity', 'status', 'title', 'created_at',
          'vehicle.vehicle_number', 'driver.first_name', 'driver.last_name'
        ]);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=fraud-summary.csv');
        return res.send(csv);
      }

      res.json({
        success: true,
        data: report
      });

    } catch (error) {
      logger.error('Generate fraud summary report error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate fraud summary report'
      });
    }
  }
);

// Generate driver risk report
router.get('/driver-risk', validateToken, validateCompanyAccess,
  [
    query('start_date').isISO8601().toDate(),
    query('end_date').isISO8601().toDate(),
    query('min_risk_score').optional().isFloat({ min: 0, max: 1 })
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

      const { start_date, end_date, min_risk_score } = req.query;
      
      let report = await reportService.generateDriverRiskReport(
        req.userCompanyId, 
        start_date.toISOString(), 
        end_date.toISOString()
      );

      // Filter by minimum risk score if provided
      if (min_risk_score) {
        report.drivers = report.drivers.filter(d => d.metrics.risk_score >= parseFloat(min_risk_score));
      }

      res.json({
        success: true,
        data: report
      });

    } catch (error) {
      logger.error('Generate driver risk report error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate driver risk report'
      });
    }
  }
);

// Generate vehicle performance report
router.get('/vehicle-performance', validateToken, validateCompanyAccess,
  [
    query('start_date').isISO8601().toDate(),
    query('end_date').isISO8601().toDate(),
    query('vehicle_id').optional().isUUID()
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

      const { start_date, end_date, vehicle_id } = req.query;
      
      let report = await reportService.generateVehicleReport(
        req.userCompanyId, 
        start_date.toISOString(), 
        end_date.toISOString()
      );

      // Filter by specific vehicle if provided
      if (vehicle_id) {
        report.vehicles = report.vehicles.filter(v => v.vehicle.id === vehicle_id);
      }

      res.json({
        success: true,
        data: report
      });

    } catch (error) {
      logger.error('Generate vehicle performance report error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate vehicle performance report'
      });
    }
  }
);

// Generate financial impact report
router.get('/financial-impact', validateToken, validateCompanyAccess,
  [
    query('start_date').isISO8601().toDate(),
    query('end_date').isISO8601().toDate()
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

      const { start_date, end_date } = req.query;
      
      const report = await reportService.generateFinancialImpactReport(
        req.userCompanyId, 
        start_date.toISOString(), 
        end_date.toISOString()
      );

      res.json({
        success: true,
        data: report
      });

    } catch (error) {
      logger.error('Generate financial impact report error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate financial impact report'
      });
    }
  }
);

// Get available report types
router.get('/types', validateToken, validateCompanyAccess, async (req, res) => {
  try {
    const reportTypes = [
      {
        id: 'fraud-summary',
        name: 'Fraud Summary Report',
        description: 'Comprehensive overview of all fraud alerts and statistics',
        parameters: ['start_date', 'end_date', 'format'],
        formats: ['json', 'csv']
      },
      {
        id: 'driver-risk',
        name: 'Driver Risk Assessment',
        description: 'Risk analysis and scoring for all drivers',
        parameters: ['start_date', 'end_date', 'min_risk_score'],
        formats: ['json']
      },
      {
        id: 'vehicle-performance',
        name: 'Vehicle Performance and Fraud',
        description: 'Performance metrics and fraud incidents by vehicle',
        parameters: ['start_date', 'end_date', 'vehicle_id'],
        formats: ['json']
      },
      {
        id: 'financial-impact',
        name: 'Financial Impact Analysis',
        description: 'Cost analysis of fraud detection and prevention',
        parameters: ['start_date', 'end_date'],
        formats: ['json']
      }
    ];

    res.json({
      success: true,
      data: reportTypes
    });

  } catch (error) {
    logger.error('Get report types error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch report types'
    });
  }
});

// Helper function to convert data to CSV
function convertToCSV(data, fields) {
  if (!data || data.length === 0) return '';
  
  const headers = fields.join(',');
  const rows = data.map(item => {
    return fields.map(field => {
      const value = field.split('.').reduce((obj, key) => obj?.[key], item);
      return `"${(value || '').toString().replace(/"/g, '""')}"`;
    }).join(',');
  });
  
  return [headers, ...rows].join('\n');
}

module.exports = router;