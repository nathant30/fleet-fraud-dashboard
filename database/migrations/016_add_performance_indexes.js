/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.raw(`
    -- Performance indexes for fraud detection queries
    
    -- Driver performance indexes
    CREATE INDEX IF NOT EXISTS idx_drivers_company_status ON drivers(company_id, status);
    CREATE INDEX IF NOT EXISTS idx_drivers_risk_score ON drivers(risk_score DESC);
    
    -- Vehicle performance indexes  
    CREATE INDEX IF NOT EXISTS idx_vehicles_company_status ON vehicles(company_id, status);
    CREATE INDEX IF NOT EXISTS idx_vehicles_company_type ON vehicles(company_id, fuel_type);
    
    -- Trip performance indexes for fraud detection
    CREATE INDEX IF NOT EXISTS idx_trips_driver_date ON trips(driver_id, start_time DESC);
    CREATE INDEX IF NOT EXISTS idx_trips_vehicle_date ON trips(vehicle_id, start_time DESC);
    CREATE INDEX IF NOT EXISTS idx_trips_status_date ON trips(status, start_time DESC);
    CREATE INDEX IF NOT EXISTS idx_trips_distance ON trips(distance_traveled DESC);
    CREATE INDEX IF NOT EXISTS idx_trips_fuel_consumption ON trips(fuel_consumed DESC);
    
    -- GPS tracking performance indexes
    CREATE INDEX IF NOT EXISTS idx_gps_vehicle_timestamp ON gps_tracking(vehicle_id, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_gps_trip_timestamp ON gps_tracking(trip_id, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_gps_speed_violations ON gps_tracking(speed DESC) WHERE speed > 80;
    
    -- Fuel transaction performance indexes
    CREATE INDEX IF NOT EXISTS idx_fuel_vehicle_date ON fuel_transactions(vehicle_id, transaction_date DESC);
    CREATE INDEX IF NOT EXISTS idx_fuel_driver_date ON fuel_transactions(driver_id, transaction_date DESC);
    CREATE INDEX IF NOT EXISTS idx_fuel_amount_anomaly ON fuel_transactions(fuel_amount DESC);
    CREATE INDEX IF NOT EXISTS idx_fuel_cost_analysis ON fuel_transactions(fuel_cost DESC, transaction_date DESC);
    
    -- Fraud alert performance indexes
    CREATE INDEX IF NOT EXISTS idx_fraud_alerts_driver_severity ON fraud_alerts(alert_type, severity, entity_id);
    CREATE INDEX IF NOT EXISTS idx_fraud_alerts_date_status ON fraud_alerts(created_at DESC, status);
    CREATE INDEX IF NOT EXISTS idx_fraud_alerts_risk_score ON fraud_alerts(risk_score DESC);
    
    -- Route optimization indexes
    CREATE INDEX IF NOT EXISTS idx_routes_company_active ON routes(company_id, is_active);
    CREATE INDEX IF NOT EXISTS idx_routes_distance ON routes(expected_distance);
    
    -- Geofence performance indexes
    CREATE INDEX IF NOT EXISTS idx_geofences_company_active ON geofences(company_id, is_active, type);
    
    -- Composite indexes for common fraud detection queries
    CREATE INDEX IF NOT EXISTS idx_trips_fraud_analysis ON trips(vehicle_id, driver_id, start_time DESC, status);
    CREATE INDEX IF NOT EXISTS idx_fuel_fraud_pattern ON fuel_transactions(vehicle_id, driver_id, transaction_date DESC, fuel_amount);
    CREATE INDEX IF NOT EXISTS idx_driver_vehicle_lookup ON drivers(id) INCLUDE (first_name, last_name, license_number, risk_score);
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.raw(`
    -- Drop performance indexes
    DROP INDEX IF EXISTS idx_drivers_company_status;
    DROP INDEX IF EXISTS idx_drivers_risk_score;
    DROP INDEX IF EXISTS idx_vehicles_company_status;
    DROP INDEX IF EXISTS idx_vehicles_company_type;
    DROP INDEX IF EXISTS idx_trips_driver_date;
    DROP INDEX IF EXISTS idx_trips_vehicle_date;
    DROP INDEX IF EXISTS idx_trips_status_date;
    DROP INDEX IF EXISTS idx_trips_distance;
    DROP INDEX IF EXISTS idx_trips_fuel_consumption;
    DROP INDEX IF EXISTS idx_gps_vehicle_timestamp;
    DROP INDEX IF EXISTS idx_gps_trip_timestamp;
    DROP INDEX IF EXISTS idx_gps_speed_violations;
    DROP INDEX IF EXISTS idx_fuel_vehicle_date;
    DROP INDEX IF EXISTS idx_fuel_driver_date;
    DROP INDEX IF EXISTS idx_fuel_amount_anomaly;
    DROP INDEX IF EXISTS idx_fuel_cost_analysis;
    DROP INDEX IF EXISTS idx_fraud_alerts_driver_severity;
    DROP INDEX IF EXISTS idx_fraud_alerts_date_status;
    DROP INDEX IF EXISTS idx_fraud_alerts_risk_score;
    DROP INDEX IF EXISTS idx_routes_company_active;
    DROP INDEX IF EXISTS idx_routes_distance;
    DROP INDEX IF EXISTS idx_geofences_company_active;
    DROP INDEX IF EXISTS idx_trips_fraud_analysis;
    DROP INDEX IF EXISTS idx_fuel_fraud_pattern;
    DROP INDEX IF EXISTS idx_driver_vehicle_lookup;
  `);
};