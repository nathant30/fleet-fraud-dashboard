-- Fleet Fraud Detection Database Schema
-- This schema is designed for PostgreSQL (Supabase)

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Companies/Organizations table
CREATE TABLE IF NOT EXISTS companies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Drivers table
CREATE TABLE IF NOT EXISTS drivers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    employee_id VARCHAR(100) UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50),
    license_number VARCHAR(100) UNIQUE NOT NULL,
    license_expiry DATE,
    hire_date DATE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    risk_score DECIMAL(3,2) DEFAULT 0.00 CHECK (risk_score >= 0 AND risk_score <= 1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    vehicle_number VARCHAR(100) UNIQUE NOT NULL,
    make VARCHAR(100),
    model VARCHAR(100),
    year INTEGER,
    vin VARCHAR(17) UNIQUE,
    license_plate VARCHAR(20) UNIQUE,
    fuel_type VARCHAR(50) DEFAULT 'diesel' CHECK (fuel_type IN ('diesel', 'gasoline', 'electric', 'hybrid')),
    fuel_capacity DECIMAL(8,2),
    odometer DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
    gps_device_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Routes table (predefined routes)
CREATE TABLE IF NOT EXISTS routes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_location TEXT NOT NULL,
    end_location TEXT NOT NULL,
    expected_distance DECIMAL(8,2), -- in kilometers
    expected_duration INTEGER, -- in minutes
    waypoints JSONB, -- Array of lat/lng waypoints
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trips table (actual trips taken)
CREATE TABLE IF NOT EXISTS trips (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
    route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    start_location GEOGRAPHY(POINT),
    end_location GEOGRAPHY(POINT),
    start_odometer DECIMAL(10,2),
    end_odometer DECIMAL(10,2),
    distance_traveled DECIMAL(8,2),
    fuel_consumed DECIMAL(8,2),
    status VARCHAR(50) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GPS tracking data
CREATE TABLE IF NOT EXISTS gps_tracking (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    location GEOGRAPHY(POINT) NOT NULL,
    speed DECIMAL(5,2), -- km/h
    heading DECIMAL(5,2), -- degrees
    altitude DECIMAL(8,2), -- meters
    accuracy DECIMAL(5,2), -- meters
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fuel transactions table
CREATE TABLE IF NOT EXISTS fuel_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
    trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    location GEOGRAPHY(POINT),
    fuel_amount DECIMAL(8,2) NOT NULL, -- liters
    fuel_cost DECIMAL(10,2), -- currency amount
    odometer_reading DECIMAL(10,2),
    receipt_number VARCHAR(100),
    vendor VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fraud alerts table
CREATE TABLE IF NOT EXISTS fraud_alerts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    type VARCHAR(100) NOT NULL CHECK (type IN (
        'speed_violation', 'route_deviation', 'fuel_anomaly', 
        'unauthorized_usage', 'suspicious_location', 'odometer_tampering',
        'fuel_card_misuse', 'after_hours_usage'
    )),
    severity VARCHAR(50) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
    trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
    fuel_transaction_id UUID REFERENCES fuel_transactions(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    details JSONB, -- Additional alert-specific data
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive')),
    risk_score DECIMAL(3,2) DEFAULT 0.50 CHECK (risk_score >= 0 AND risk_score <= 1),
    assigned_to VARCHAR(255),
    resolution_notes TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Maintenance records table
CREATE TABLE IF NOT EXISTS maintenance_records (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL CHECK (type IN ('scheduled', 'repair', 'inspection', 'other')),
    description TEXT NOT NULL,
    cost DECIMAL(10,2),
    odometer_reading DECIMAL(10,2),
    maintenance_date DATE NOT NULL,
    next_maintenance_date DATE,
    vendor VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Geofences table (for defining restricted/monitored areas)
CREATE TABLE IF NOT EXISTS geofences (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) DEFAULT 'inclusion' CHECK (type IN ('inclusion', 'exclusion')),
    geometry GEOGRAPHY(POLYGON) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_drivers_company_id ON drivers(company_id);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_company_id ON vehicles(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle_id ON trips(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_start_time ON trips(start_time);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_trip_id ON gps_tracking(trip_id);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_vehicle_id ON gps_tracking(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_timestamp ON gps_tracking(timestamp);
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_vehicle_id ON fuel_transactions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_date ON fuel_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_type ON fraud_alerts(type);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_severity ON fraud_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_status ON fraud_alerts(status);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_created_at ON fraud_alerts(created_at);

-- Spatial indexes
CREATE INDEX IF NOT EXISTS idx_gps_tracking_location ON gps_tracking USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_geofences_geometry ON geofences USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_trips_start_location ON trips USING GIST(start_location);
CREATE INDEX IF NOT EXISTS idx_trips_end_location ON trips USING GIST(end_location);

-- Row Level Security (RLS) policies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofences ENABLE ROW LEVEL SECURITY;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trips FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fraud_alerts_updated_at BEFORE UPDATE ON fraud_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_geofences_updated_at BEFORE UPDATE ON geofences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fraud alert webhooks table for real-time notifications
CREATE TABLE IF NOT EXISTS fraud_alert_webhooks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    webhook_url TEXT NOT NULL,
    event_types JSONB NOT NULL, -- Array of event types to listen for
    is_active BOOLEAN DEFAULT true,
    secret_key TEXT NOT NULL, -- For webhook signature verification
    created_by UUID, -- Reference to user who created the webhook
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS for webhooks table
ALTER TABLE fraud_alert_webhooks ENABLE ROW LEVEL SECURITY;

-- Apply updated_at trigger to webhooks table
CREATE TRIGGER update_fraud_alert_webhooks_updated_at BEFORE UPDATE ON fraud_alert_webhooks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- User profiles table for authentication integration
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE, -- Reference to Supabase auth.users
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255) UNIQUE,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'analyst', 'user')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS for user profiles table
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Apply updated_at trigger to user profiles table
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- User roles table for role-based access control
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'manager', 'analyst', 'user', 'viewer')),
    granted_by UUID, -- Reference to user who granted the role
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- Add RLS for user roles table
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- PostGIS function for geofence violation checking
CREATE OR REPLACE FUNCTION check_geofence_violation(
    point_geog GEOGRAPHY,
    fence_geog GEOGRAPHY,
    fence_type TEXT
)
RETURNS TABLE(
    is_violation BOOLEAN,
    distance DOUBLE PRECISION
) AS $$
BEGIN
    IF fence_type = 'inclusion' THEN
        -- For inclusion zones, violation is being outside the fence
        RETURN QUERY
        SELECT 
            NOT ST_Contains(fence_geog::geometry, point_geog::geometry) as is_violation,
            CASE 
                WHEN ST_Contains(fence_geog::geometry, point_geog::geometry) THEN 0
                ELSE ST_Distance(fence_geog, point_geog)
            END as distance;
    ELSE
        -- For exclusion zones, violation is being inside the fence
        RETURN QUERY
        SELECT 
            ST_Contains(fence_geog::geometry, point_geog::geometry) as is_violation,
            CASE 
                WHEN ST_Contains(fence_geog::geometry, point_geog::geometry) THEN 0
                ELSE ST_Distance(fence_geog, point_geog)
            END as distance;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate driver behavior score
CREATE OR REPLACE FUNCTION calculate_driver_behavior_score(
    driver_uuid UUID,
    period_days INTEGER DEFAULT 30
)
RETURNS TABLE(
    driver_id UUID,
    behavior_score DECIMAL(3,2),
    speed_violations INTEGER,
    route_deviations INTEGER,
    fuel_anomalies INTEGER,
    total_trips INTEGER,
    total_distance DECIMAL(10,2)
) AS $$
DECLARE
    start_date TIMESTAMP := NOW() - (period_days || ' days')::INTERVAL;
BEGIN
    RETURN QUERY
    WITH driver_stats AS (
        SELECT 
            d.id,
            COUNT(DISTINCT t.id) as trip_count,
            SUM(t.distance_traveled) as distance_sum,
            COUNT(CASE WHEN fa.type = 'speed_violation' THEN 1 END) as speed_count,
            COUNT(CASE WHEN fa.type = 'route_deviation' THEN 1 END) as route_count,
            COUNT(CASE WHEN fa.type = 'fuel_anomaly' THEN 1 END) as fuel_count
        FROM drivers d
        LEFT JOIN trips t ON t.driver_id = d.id AND t.start_time >= start_date
        LEFT JOIN fraud_alerts fa ON fa.driver_id = d.id AND fa.created_at >= start_date
        WHERE d.id = driver_uuid
        GROUP BY d.id
    )
    SELECT 
        ds.id,
        GREATEST(0.0, LEAST(1.0, 
            1.0 - (
                (ds.speed_count::DECIMAL / GREATEST(ds.trip_count, 1) * 0.4) +
                (ds.route_count::DECIMAL / GREATEST(ds.trip_count, 1) * 0.3) +
                (ds.fuel_count::DECIMAL / GREATEST(ds.trip_count, 1) * 0.3)
            )
        ))::DECIMAL(3,2),
        ds.speed_count::INTEGER,
        ds.route_count::INTEGER,
        ds.fuel_count::INTEGER,
        ds.trip_count::INTEGER,
        COALESCE(ds.distance_sum, 0)::DECIMAL(10,2)
    FROM driver_stats ds;
END;
$$ LANGUAGE plpgsql;

-- Add indexes for the new tables
CREATE INDEX IF NOT EXISTS idx_fraud_alert_webhooks_company_id ON fraud_alert_webhooks(company_id);
CREATE INDEX IF NOT EXISTS idx_fraud_alert_webhooks_is_active ON fraud_alert_webhooks(is_active);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_id ON user_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_is_active ON user_roles(is_active);