import React, { useState, useEffect } from 'react';

interface Vehicle {
  id: string;
  licensePlate: string;
  driverId: string;
  driverName: string;
  status: 'active' | 'inactive' | 'maintenance';
  location: string;
  lastUpdate: string;
  fuelLevel: number;
  mileage: number;
  alerts: number;
}

interface Driver {
  id: string;
  name: string;
  licenseNumber: string;
  status: 'active' | 'inactive' | 'suspended';
  vehicleId: string;
  violations: number;
  performanceScore: number;
}

interface Route {
  id: string;
  name: string;
  origin: string;
  destination: string;
  distance: number;
  estimatedTime: string;
  driverId: string;
  status: 'planned' | 'in_progress' | 'completed';
  riskLevel: 'low' | 'medium' | 'high';
}

const FleetManagerWorkingDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [message, setMessage] = useState('');

  // Sample data
  useEffect(() => {
    const sampleVehicles: Vehicle[] = [
      {
        id: '1',
        licensePlate: 'ABC-123',
        driverId: '1',
        driverName: 'John Smith',
        status: 'active',
        location: 'San Francisco, CA',
        lastUpdate: new Date().toLocaleString(),
        fuelLevel: 85,
        mileage: 45230,
        alerts: 0
      },
      {
        id: '2',
        licensePlate: 'XYZ-789',
        driverId: '2',
        driverName: 'Sarah Johnson',
        status: 'maintenance',
        location: 'Oakland, CA',
        lastUpdate: new Date(Date.now() - 3600000).toLocaleString(),
        fuelLevel: 20,
        mileage: 67890,
        alerts: 2
      }
    ];

    const sampleDrivers: Driver[] = [
      {
        id: '1',
        name: 'John Smith',
        licenseNumber: 'D1234567',
        status: 'active',
        vehicleId: '1',
        violations: 0,
        performanceScore: 95
      },
      {
        id: '2',
        name: 'Sarah Johnson',
        licenseNumber: 'D7654321',
        status: 'active',
        vehicleId: '2',
        violations: 1,
        performanceScore: 87
      }
    ];

    const sampleRoutes: Route[] = [
      {
        id: '1',
        name: 'Route SF-LA',
        origin: 'San Francisco, CA',
        destination: 'Los Angeles, CA',
        distance: 380,
        estimatedTime: '6h 30m',
        driverId: '1',
        status: 'in_progress',
        riskLevel: 'low'
      }
    ];

    setVehicles(sampleVehicles);
    setDrivers(sampleDrivers);
    setRoutes(sampleRoutes);
  }, []);

  const handleAddVehicle = async () => {
    const newVehicle: Vehicle = {
      id: Date.now().toString(),
      licensePlate: 'NEW-001',
      driverId: '0',
      driverName: 'Unassigned',
      status: 'inactive',
      location: 'Fleet Depot',
      lastUpdate: new Date().toLocaleString(),
      fuelLevel: 100,
      mileage: 0,
      alerts: 0
    };
    
    try {
      const response = await fetch('http://localhost:3001/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVehicle)
      });
      
      if (response.ok) {
        setVehicles([...vehicles, newVehicle]);
        setMessage(`Vehicle ${newVehicle.licensePlate} added successfully!`);
      }
    } catch (error) {
      // Fallback to local state if API unavailable
      setVehicles([...vehicles, newVehicle]);
      setMessage(`Vehicle ${newVehicle.licensePlate} added locally (API unavailable)`);
    }
    
    setTimeout(() => setMessage(''), 3000);
    setShowAddVehicle(false);
  };

  const handleVehicleStatusChange = (vehicleId: string, newStatus: Vehicle['status']) => {
    setVehicles(vehicles.map(v => 
      v.id === vehicleId ? { ...v, status: newStatus, lastUpdate: new Date().toLocaleString() } : v
    ));
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              🚛
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Vehicles</p>
              <p className="text-2xl font-semibold text-gray-900">{vehicles.filter(v => v.status === 'active').length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              👨‍💼
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Drivers</p>
              <p className="text-2xl font-semibold text-gray-900">{drivers.filter(d => d.status === 'active').length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
              ⚠️
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Alerts</p>
              <p className="text-2xl font-semibold text-gray-900">{vehicles.reduce((sum, v) => sum + v.alerts, 0)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600">
              🛣️
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Routes</p>
              <p className="text-2xl font-semibold text-gray-900">{routes.filter(r => r.status === 'in_progress').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Recent Fleet Activity</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div className="flex items-center">
                <span className="text-green-500">✅</span>
                <span className="ml-3 text-sm text-gray-900">Vehicle ABC-123 started route to Los Angeles</span>
              </div>
              <span className="text-xs text-gray-500">2 minutes ago</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div className="flex items-center">
                <span className="text-yellow-500">⚠️</span>
                <span className="ml-3 text-sm text-gray-900">Low fuel alert for vehicle XYZ-789</span>
              </div>
              <span className="text-xs text-gray-500">15 minutes ago</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center">
                <span className="text-blue-500">🔧</span>
                <span className="ml-3 text-sm text-gray-900">Maintenance scheduled for vehicle XYZ-789</span>
              </div>
              <span className="text-xs text-gray-500">1 hour ago</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderVehicles = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Vehicle Management</h2>
        <button
          onClick={() => setShowAddVehicle(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Add Vehicle
        </button>
      </div>

      {showAddVehicle && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium mb-4">Add New Vehicle</h3>
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="License Plate"
              className="border border-gray-300 rounded-md px-3 py-2"
            />
            <select className="border border-gray-300 rounded-md px-3 py-2">
              <option>Select Driver</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleAddVehicle}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
            >
              Add Vehicle
            </button>
            <button
              onClick={() => setShowAddVehicle(false)}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fuel</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {vehicles.map((vehicle) => (
              <tr key={vehicle.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {vehicle.licensePlate}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {vehicle.driverName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    value={vehicle.status}
                    onChange={(e) => handleVehicleStatusChange(vehicle.id, e.target.value as Vehicle['status'])}
                    className={`text-sm rounded-full px-3 py-1 border-0 ${
                      vehicle.status === 'active' ? 'bg-green-100 text-green-800' :
                      vehicle.status === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {vehicle.location}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="flex items-center">
                    <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                      <div 
                        className={`h-2 rounded-full ${vehicle.fuelLevel > 50 ? 'bg-green-600' : vehicle.fuelLevel > 20 ? 'bg-yellow-600' : 'bg-red-600'}`}
                        style={{ width: `${vehicle.fuelLevel}%` }}
                      />
                    </div>
                    <span className="text-xs">{vehicle.fuelLevel}%</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => setSelectedVehicle(vehicle)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderRoutes = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Route Management</h2>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
          Plan New Route
        </button>
      </div>

      <div className="bg-white rounded-lg shadow border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Origin - Destination</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk Level</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {routes.map((route) => (
              <tr key={route.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {route.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {route.origin} → {route.destination}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {drivers.find(d => d.id === route.driverId)?.name || 'Unassigned'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    route.status === 'completed' ? 'bg-green-100 text-green-800' :
                    route.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {route.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    route.riskLevel === 'low' ? 'bg-green-100 text-green-800' :
                    route.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {route.riskLevel}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button className="text-blue-600 hover:text-blue-900 mr-3">
                    Track
                  </button>
                  <button className="text-green-600 hover:text-green-900">
                    Optimize
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center">
              <span className="text-white font-bold text-sm">🚛</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Fleet Management Dashboard</h1>
              <p className="text-sm text-gray-500">Monitor and manage your fleet operations</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-gray-600 text-sm font-medium">LR</span>
              </div>
              <div className="hidden md:block">
                <div className="text-sm font-medium text-gray-900">Lisa Rodriguez</div>
                <div className="text-xs text-gray-500">Fleet Manager</div>
              </div>
            </div>
            <button className="bg-red-500 text-white px-3 py-1 rounded text-sm">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <nav className="px-6">
          <div className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'vehicles', label: 'Vehicles', icon: '🚛' },
              { id: 'drivers', label: 'Drivers', icon: '👨‍💼' },
              { id: 'routes', label: 'Routes', icon: '🗺️' },
              { id: 'maintenance', label: 'Maintenance', icon: '🔧' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <main className="p-6">
        {/* Message Display */}
        {message && (
          <div style={{
            background: '#dbeafe',
            border: '1px solid #3b82f6',
            borderRadius: '6px',
            padding: '1rem',
            marginBottom: '1.5rem',
            color: '#1e40af'
          }}>
            {message}
          </div>
        )}
        
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'vehicles' && renderVehicles()}
        {activeTab === 'routes' && renderRoutes()}
        {activeTab === 'drivers' && (
          <div className="bg-white p-8 rounded-lg shadow border text-center">
            <h2 className="text-xl font-semibold mb-4">Driver Management</h2>
            <p className="text-gray-600 mb-6">Manage driver profiles, performance, and assignments</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {drivers.map(driver => (
                <div key={driver.id} className="border rounded-lg p-4">
                  <h3 className="font-semibold">{driver.name}</h3>
                  <p className="text-sm text-gray-600">License: {driver.licenseNumber}</p>
                  <p className="text-sm">Score: {driver.performanceScore}%</p>
                  <p className="text-sm">Violations: {driver.violations}</p>
                  <button className="mt-2 bg-blue-500 text-white px-3 py-1 rounded text-sm">
                    View Profile
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab === 'maintenance' && (
          <div className="bg-white p-8 rounded-lg shadow border text-center">
            <h2 className="text-xl font-semibold mb-4">Maintenance Management</h2>
            <p className="text-gray-600 mb-6">Track vehicle maintenance schedules and history</p>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 border rounded">
                <div>
                  <h3 className="font-medium">Vehicle XYZ-789</h3>
                  <p className="text-sm text-gray-600">Oil change due in 500 miles</p>
                </div>
                <button className="bg-yellow-500 text-white px-3 py-1 rounded">
                  Schedule
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Vehicle Details Modal */}
      {selectedVehicle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Vehicle Details</h2>
            <div className="space-y-3">
              <p><strong>License Plate:</strong> {selectedVehicle.licensePlate}</p>
              <p><strong>Driver:</strong> {selectedVehicle.driverName}</p>
              <p><strong>Status:</strong> {selectedVehicle.status}</p>
              <p><strong>Location:</strong> {selectedVehicle.location}</p>
              <p><strong>Fuel Level:</strong> {selectedVehicle.fuelLevel}%</p>
              <p><strong>Mileage:</strong> {selectedVehicle.mileage.toLocaleString()} miles</p>
              <p><strong>Last Update:</strong> {selectedVehicle.lastUpdate}</p>
            </div>
            <button
              onClick={() => setSelectedVehicle(null)}
              className="mt-4 bg-gray-500 text-white px-4 py-2 rounded w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FleetManagerWorkingDashboard;