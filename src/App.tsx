import React, { useState, useEffect } from 'react';
import { 
  KPICard, 
  RiskBadge, 
  DriverTable, 
  KPICardSkeleton, 
  DriverTableSkeleton,
  APIErrorBoundary,
  ComponentErrorBoundary 
} from '@/components';
import { Driver, KPIData, RiskLevel, BackendDriver, SSEMessage } from '@/types';
import { FraudDetectionAPI, SSEService } from '@/utils/api';
import { backendDriverToDriver, fraudStatsToKPIs } from '@/utils/converters';

// Sample data for demonstration
const mockKPIData: KPIData[] = [
  {
    id: 'total-drivers',
    title: 'Total Drivers',
    value: 1247,
    previousValue: 1198,
    format: 'number',
    description: 'Active drivers in fleet',
    status: 'good',
  },
  {
    id: 'fraud-alerts',
    title: 'Fraud Alerts',
    value: 23,
    previousValue: 31,
    format: 'number',
    description: 'Active fraud investigations',
    status: 'warning',
  },
  {
    id: 'risk-score',
    title: 'Average Risk Score',
    value: 34.5,
    previousValue: 38.2,
    format: 'number',
    unit: '/100',
    description: 'Fleet-wide fraud risk assessment',
    status: 'good',
    target: 30,
  },
  {
    id: 'savings',
    title: 'Fraud Prevention Savings',
    value: 45230,
    previousValue: 38940,
    format: 'currency',
    description: 'Estimated savings this month',
    status: 'good',
  },
];

const mockDrivers: Driver[] = [
  {
    id: '1',
    name: 'John Smith',
    licenseNumber: 'DL123456789',
    vehicleId: 'VH-001',
    email: 'john.smith@company.com',
    phone: '+1-555-0123',
    hireDate: '2022-03-15',
    status: 'active',
    riskLevel: 'low',
    totalMiles: 45230,
    violations: 1,
    lastActivity: '2024-08-21T14:30:00Z',
    fraudScore: 15.2,
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    licenseNumber: 'DL987654321',
    vehicleId: 'VH-002',
    email: 'sarah.johnson@company.com',
    phone: '+1-555-0124',
    hireDate: '2021-11-20',
    status: 'active',
    riskLevel: 'medium',
    totalMiles: 67890,
    violations: 3,
    lastActivity: '2024-08-22T09:15:00Z',
    fraudScore: 52.8,
  },
  {
    id: '3',
    name: 'Mike Wilson',
    licenseNumber: 'DL456789123',
    vehicleId: 'VH-003',
    email: 'mike.wilson@company.com',
    phone: '+1-555-0125',
    hireDate: '2023-01-10',
    status: 'suspended',
    riskLevel: 'critical',
    totalMiles: 23450,
    violations: 8,
    lastActivity: '2024-08-20T16:45:00Z',
    fraudScore: 89.3,
  },
  {
    id: '4',
    name: 'Emily Davis',
    licenseNumber: 'DL789123456',
    vehicleId: 'VH-004',
    email: 'emily.davis@company.com',
    phone: '+1-555-0126',
    hireDate: '2022-07-03',
    status: 'active',
    riskLevel: 'high',
    totalMiles: 56780,
    violations: 5,
    lastActivity: '2024-08-22T11:20:00Z',
    fraudScore: 71.5,
  },
  {
    id: '5',
    name: 'Robert Brown',
    licenseNumber: 'DL321654987',
    vehicleId: 'VH-005',
    email: 'robert.brown@company.com',
    phone: '+1-555-0127',
    hireDate: '2023-05-18',
    status: 'active',
    riskLevel: 'low',
    totalMiles: 12340,
    violations: 0,
    lastActivity: '2024-08-22T13:10:00Z',
    fraudScore: 8.7,
  },
];

const App: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [kpis, setKpis] = useState<KPIData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<keyof Driver>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [sseService] = useState(() => new SSEService());
  const [realtimeAlerts, setRealtimeAlerts] = useState<any[]>([]);

  // Load initial data from backend
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Load fraud statistics for KPIs
        const statsResponse = await FraudDetectionAPI.getFraudStats(30);
        if (statsResponse.success && statsResponse.data) {
          const kpiData = fraudStatsToKPIs(statsResponse.data);
          setKpis(kpiData);
        } else {
          console.warn('Failed to load fraud stats:', statsResponse.message);
          // Fallback to mock data for demo
          setKpis(mockKPIData);
        }

        // Load drivers data
        const driversResponse = await FraudDetectionAPI.getDrivers({
          limit: 100, // Load more drivers initially
          sort_by: 'first_name',
          sort_order: 'asc'
        });

        if (driversResponse.success && driversResponse.data) {
          const convertedDrivers = driversResponse.data.map((backendDriver: BackendDriver) => 
            backendDriverToDriver(backendDriver)
          );
          setDrivers(convertedDrivers);
        } else {
          console.warn('Failed to load drivers:', driversResponse.message);
          // Fallback to mock data for demo
          setDrivers(mockDrivers);
        }

      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load data from backend. Using demo data.');
        // Fallback to mock data
        setKpis(mockKPIData);
        setDrivers(mockDrivers);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Setup real-time SSE connection
  useEffect(() => {
    // Set up SSE event listeners
    sseService.on('connection', (data) => {
      console.log('SSE Connection status:', data.status);
    });

    sseService.on('fraud_alert', (data: SSEMessage) => {
      console.log('New fraud alert received:', data.data);
      if (data.data) {
        setRealtimeAlerts(prev => [data.data, ...prev.slice(0, 9)]); // Keep last 10 alerts
        
        // Update KPI for fraud alerts count
        setKpis(prev => prev.map(kpi => 
          kpi.id === 'fraud-alerts' 
            ? { ...kpi, value: (kpi.value as number) + 1 }
            : kpi
        ));
      }
    });

    sseService.on('error', (error) => {
      console.error('SSE Error:', error);
    });

    // Connect to SSE
    sseService.connect();

    // Cleanup on unmount
    return () => {
      sseService.disconnect();
    };
  }, [sseService]);

  // Refresh data periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        // Refresh KPI data every 5 minutes
        const statsResponse = await FraudDetectionAPI.getFraudStats(30);
        if (statsResponse.success && statsResponse.data) {
          const kpiData = fraudStatsToKPIs(statsResponse.data);
          setKpis(kpiData);
        }
      } catch (err) {
        console.warn('Error refreshing KPI data:', err);
      }
    }, 300000); // 5 minutes

    return () => clearInterval(interval);
  }, []);

  const handleDriverSelect = (driver: Driver) => {
    console.log('Selected driver:', driver);
    // Here you would typically navigate to a driver detail page or open a modal
    alert(`Selected driver: ${driver.name}`);
  };

  const handleSort = async (field: keyof Driver, direction: 'asc' | 'desc') => {
    setSortField(field);
    setSortDirection(direction);
    
    // For now, sort locally. In production, you'd call the API with sort parameters
    const sorted = [...drivers].sort((a, b) => {
      const aValue = a[field];
      const bValue = b[field];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    setDrivers(sorted);
  };

  const handleKPIClick = (kpi: KPIData) => {
    console.log('KPI clicked:', kpi);
    // Here you would typically drill down into the KPI details
    alert(`Viewing details for: ${kpi.title}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-4 sm:py-6 space-y-4 sm:space-y-0">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">
                Fleet Fraud Dashboard
              </h1>
              <p className="mt-1 text-sm text-gray-500 hidden sm:block">
                Monitor and analyze fleet fraud risk in real-time
              </p>
              <p className="mt-1 text-xs text-gray-500 sm:hidden">
                Real-time fraud monitoring
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  sseService.getStatus() === 'connected' ? 'bg-green-500' : 
                  sseService.getStatus() === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                }`}></div>
                <span className="text-xs sm:text-sm text-gray-600">
                  {sseService.getStatus() === 'connected' ? 'Live' : 
                   sseService.getStatus() === 'connecting' ? 'Connecting...' : 'Offline'}
                </span>
              </div>
              <RiskBadge level="medium" score={34.5} showScore size="sm" className="sm:hidden" />
              <RiskBadge level="medium" score={34.5} showScore size="md" className="hidden sm:inline-flex" />
              {realtimeAlerts.length > 0 && (
                <div className="flex items-center space-x-1 px-2 sm:px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs sm:text-sm">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="hidden sm:inline">
                    {realtimeAlerts.length} new alert{realtimeAlerts.length !== 1 ? 's' : ''}
                  </span>
                  <span className="sm:hidden">
                    {realtimeAlerts.length} alert{realtimeAlerts.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-8xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-8">
        {/* Error notification */}
        {error && (
          <div className="mb-6 p-4 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded-md">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm">{error}</p>
              </div>
              <div className="ml-auto">
                <button
                  onClick={() => setError(null)}
                  className="text-yellow-600 hover:text-yellow-500"
                >
                  <span className="sr-only">Dismiss</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Real-time alerts banner */}
        {realtimeAlerts.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-red-800">New Fraud Alerts</h3>
                <div className="mt-2 text-sm text-red-700">
                  <div className="space-y-1">
                    {realtimeAlerts.slice(0, 3).map((alert, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span>{alert.title || 'New fraud alert detected'}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          alert.severity === 'critical' ? 'bg-red-200 text-red-800' :
                          alert.severity === 'high' ? 'bg-orange-200 text-orange-800' :
                          'bg-yellow-200 text-yellow-800'
                        }`}>
                          {alert.severity || 'medium'}
                        </span>
                      </div>
                    ))}
                    {realtimeAlerts.length > 3 && (
                      <div className="text-xs text-red-600">
                        +{realtimeAlerts.length - 3} more alerts
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="ml-4">
                <button
                  onClick={() => setRealtimeAlerts([])}
                  className="text-red-600 hover:text-red-500 text-sm"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}
        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          {loading ? (
            // Enhanced loading state with skeleton cards
            [...Array(4)].map((_, index) => (
              <KPICardSkeleton key={`skeleton-${index}`} className="transform hover:scale-105 transition-transform duration-200" />
            ))
          ) : (
            kpis.map((kpi) => (
              <APIErrorBoundary key={kpi.id} apiName="KPI Data">
                <KPICard
                  data={kpi}
                  loading={false}
                  onClick={() => handleKPIClick(kpi)}
                  className="transform hover:scale-105 transition-transform duration-200"
                />
              </APIErrorBoundary>
            ))
          )}
        </div>

        {/* Risk Level Examples */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Risk Level Examples
          </h2>
          <div className="flex flex-wrap gap-4">
            {(['low', 'medium', 'high', 'critical'] as RiskLevel[]).map((level) => (
              <RiskBadge
                key={level}
                level={level}
                score={level === 'low' ? 15 : level === 'medium' ? 45 : level === 'high' ? 75 : 95}
                showScore
                size="lg"
              />
            ))}
          </div>
        </div>

        {/* Driver Table */}
        <div className="mb-8">
          {loading ? (
            <DriverTableSkeleton rows={8} className="shadow-lg" />
          ) : (
            <ComponentErrorBoundary componentName="Driver Table">
              <DriverTable
                drivers={drivers}
                loading={false}
                onDriverSelect={handleDriverSelect}
                onSort={handleSort}
                sortField={sortField}
                sortDirection={sortDirection}
                pageSize={10}
                className="shadow-lg"
              />
            </ComponentErrorBoundary>
          )}
        </div>

        {/* Footer */}
        <footer className="text-center text-sm text-gray-500 py-8 border-t border-gray-200">
          <p>Fleet Fraud Dashboard - Real-time fraud detection and prevention</p>
          <p className="mt-1">
            Built with React, TypeScript, and Tailwind CSS
          </p>
        </footer>
      </main>
    </div>
  );
};

export default App;