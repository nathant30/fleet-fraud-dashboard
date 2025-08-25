// Core types for Fleet Fraud Dashboard
import { ReactNode } from 'react';

export interface Driver {
  id: string;
  name: string;
  licenseNumber: string;
  vehicleId: string;
  email: string;
  phone: string;
  hireDate: string;
  status: 'active' | 'inactive' | 'suspended';
  riskLevel: RiskLevel;
  totalMiles: number;
  violations: number;
  lastActivity: string;
  fraudScore: number;
}

export interface KPIData {
  id: string;
  title: string;
  value: number | string;
  previousValue?: number | string;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  unit?: string;
  format?: 'number' | 'currency' | 'percentage';
  description?: string;
  trend?: number[];
  target?: number;
  status?: 'good' | 'warning' | 'danger';
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskBadgeProps {
  level: RiskLevel;
  score?: number;
  showScore?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export interface KPICardProps {
  data: KPIData;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

export interface DriverTableProps {
  drivers: Driver[];
  loading?: boolean;
  onDriverSelect?: (driver: Driver) => void;
  onSort?: (field: keyof Driver, direction: 'asc' | 'desc') => void;
  onFilter?: (filters: Partial<Driver>) => void;
  sortField?: keyof Driver;
  sortDirection?: 'asc' | 'desc';
  pageSize?: number;
  className?: string;
}

export interface TableColumn<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: any, item: T) => ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export interface FilterConfig {
  field: string;
  value: any;
  operator: 'equals' | 'contains' | 'greater' | 'less';
}

// Utility types for API responses
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  total?: number;
  page?: number;
  pageSize?: number;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

// Real-time update types
export interface RealtimeEvent<T> {
  type: 'insert' | 'update' | 'delete';
  table: string;
  data: T;
  timestamp: string;
}

export interface DashboardState {
  drivers: Driver[];
  kpis: KPIData[];
  loading: boolean;
  error?: string;
  filters: FilterConfig[];
  sort: SortConfig | null;
}

// Backend API types
export interface FraudAlert {
  id: string;
  type: 'speed_violation' | 'route_deviation' | 'fuel_anomaly' | 'unauthorized_usage' | 'suspicious_location' | 'odometer_tampering' | 'fuel_card_misuse' | 'after_hours_usage';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  title: string;
  description: string;
  vehicle_id?: string;
  driver_id?: string;
  trip_id?: string;
  fuel_transaction_id?: string;
  details?: Record<string, any>;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  assigned_to?: string;
  resolution_notes?: string;
  vehicle?: {
    id: string;
    vehicle_number: string;
    make: string;
    model: string;
  };
  driver?: {
    id: string;
    first_name: string;
    last_name: string;
    employee_id?: string;
  };
}

export interface FraudStats {
  period: string;
  statistics: {
    total_alerts: number;
    by_type: Record<string, number>;
    by_severity: Record<string, number>;
    by_status: Record<string, number>;
    trends: Record<string, { total: number; by_type: Record<string, number> }>;
  };
}

export interface BackendDriver {
  id: string;
  employee_id?: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  license_number: string;
  license_expiry?: string;
  hire_date?: string;
  status: 'active' | 'inactive' | 'suspended';
  risk_score?: number;
  company_id: string;
  created_at: string;
  updated_at: string;
  current_trip?: {
    id: string;
    status: string;
    start_time: string;
    vehicle: {
      vehicle_number: string;
      make: string;
      model: string;
    };
  };
  recent_fraud_alerts?: Array<{
    id: string;
    type: string;
    severity: string;
    created_at: string;
  }>;
}

export interface SSEMessage {
  type: 'connection_established' | 'heartbeat' | 'fraud_alert' | 'system_message';
  message?: string;
  data?: FraudAlert | any;
  timestamp: string;
  connection_id?: string;
}

// Utility functions for type conversion
export interface TypeConverters {
  backendDriverToDriver: (backendDriver: BackendDriver) => Driver;
  fraudStatsToKPIs: (stats: FraudStats) => KPIData[];
}