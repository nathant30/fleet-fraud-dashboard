import React, { useState } from 'react';
import FraudAnalystDashboard from './FraudAnalystDashboard';
import SuperAdminWorkingDashboard from './SuperAdminWorkingDashboard';
import FleetManagerWorkingDashboard from './FleetManagerWorkingDashboard';
import AuditorWorkingDashboard from './AuditorWorkingDashboard';
import ComplianceWorkingDashboard from './ComplianceWorkingDashboard';

// Simple Authentication Context
interface User {
  id: string;
  email: string;
  role: 'super_admin' | 'fraud_analyst' | 'fleet_manager' | 'auditor' | 'compliance';
  name: string;
}

const WorkingApp: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('fraud_analyst');

  const demoUsers: Record<string, User> = {
    super_admin: {
      id: '1',
      email: 'admin@fleetfraud.com',
      role: 'super_admin',
      name: 'Sarah Johnson'
    },
    fraud_analyst: {
      id: '2',
      email: 'analyst@fleetfraud.com',
      role: 'fraud_analyst',
      name: 'Mike Chen'
    },
    fleet_manager: {
      id: '3',
      email: 'manager@fleetfraud.com',
      role: 'fleet_manager',
      name: 'Lisa Rodriguez'
    },
    auditor: {
      id: '4',
      email: 'auditor@fleetfraud.com',
      role: 'auditor',
      name: 'David Kim'
    },
    compliance: {
      id: '5',
      email: 'compliance@fleetfraud.com',
      role: 'compliance',
      name: 'Alex Rivera'
    }
  };

  const handleLogin = () => {
    setUser(demoUsers[selectedRole]);
  };

  const handleLogout = () => {
    setUser(null);
  };

  // Show role-specific working dashboards
  if (user && user.role === 'fraud_analyst') {
    return <FraudAnalystDashboard />;
  }
  
  if (user && user.role === 'super_admin') {
    return <SuperAdminWorkingDashboard />;
  }
  
  if (user && user.role === 'fleet_manager') {
    return <FleetManagerWorkingDashboard />;
  }
  
  if (user && user.role === 'auditor') {
    return <AuditorWorkingDashboard />;
  }
  
  if (user && user.role === 'compliance') {
    return <ComplianceWorkingDashboard />;
  }

  if (!user) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ 
          background: 'white', 
          padding: '3rem', 
          borderRadius: '12px', 
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxWidth: '400px',
          width: '100%'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ color: '#1f2937', fontSize: '2rem', fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>
              🛡️ Fleet Fraud Detection
            </h1>
            <p style={{ color: '#6b7280', margin: '0' }}>Enterprise Security Platform</p>
          </div>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', color: '#374151', fontWeight: '500', marginBottom: '0.5rem' }}>
              Select Role to Demo:
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '1rem'
              }}
            >
              <option value="super_admin">🔧 Super Admin</option>
              <option value="fraud_analyst">🕵️ Fraud Analyst</option>
              <option value="fleet_manager">🚛 Fleet Manager</option>
              <option value="auditor">📋 Auditor</option>
              <option value="compliance">📋 Compliance</option>
            </select>
          </div>

          <button
            onClick={handleLogin}
            style={{
              width: '100%',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '0.75rem',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Access Dashboard
          </button>
        </div>
      </div>
    );
  }

  // This should not be reached since all roles have working dashboards
  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <h1>Error: Unknown user role</h1>
        <p>Role: {user?.role}</p>
        <button onClick={handleLogout} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>
          Logout
        </button>
      </div>
    </div>
  );
};


export default WorkingApp;