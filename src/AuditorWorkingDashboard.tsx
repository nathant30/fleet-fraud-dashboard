import React, { useState, useEffect } from 'react';

interface ComplianceMetric {
  id: string;
  category: string;
  name: string;
  value: number;
  target: number;
  status: 'compliant' | 'warning' | 'non_compliant';
  lastUpdated: string;
}

interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  entity: string;
  details: string;
  riskLevel: 'low' | 'medium' | 'high';
}

interface ComplianceReport {
  id: string;
  name: string;
  type: 'monthly' | 'quarterly' | 'annual' | 'custom';
  status: 'draft' | 'pending' | 'approved' | 'published';
  createdBy: string;
  createdDate: string;
  complianceScore: number;
}

const AuditorWorkingDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [metrics, setMetrics] = useState<ComplianceMetric[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [reports, setReports] = useState<ComplianceReport[]>([]);
  const [showNewReport, setShowNewReport] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ComplianceReport | null>(null);
  const [message, setMessage] = useState('');

  // Sample data initialization
  useEffect(() => {
    const sampleMetrics: ComplianceMetric[] = [
      {
        id: '1',
        category: 'SOC 2',
        name: 'Access Control',
        value: 98,
        target: 95,
        status: 'compliant',
        lastUpdated: new Date().toLocaleString()
      },
      {
        id: '2',
        category: 'GDPR',
        name: 'Data Privacy',
        value: 92,
        target: 95,
        status: 'warning',
        lastUpdated: new Date(Date.now() - 3600000).toLocaleString()
      },
      {
        id: '3',
        category: 'ISO 27001',
        name: 'Information Security',
        value: 88,
        target: 90,
        status: 'warning',
        lastUpdated: new Date().toLocaleString()
      },
      {
        id: '4',
        category: 'PCI DSS',
        name: 'Payment Security',
        value: 96,
        target: 95,
        status: 'compliant',
        lastUpdated: new Date().toLocaleString()
      }
    ];

    const sampleAuditLogs: AuditLog[] = [
      {
        id: '1',
        timestamp: new Date().toLocaleString(),
        user: 'Sarah Johnson',
        action: 'User Login',
        entity: 'Authentication System',
        details: 'Successful admin login from IP 192.168.1.100',
        riskLevel: 'low'
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 1800000).toLocaleString(),
        user: 'Mike Chen',
        action: 'Data Export',
        entity: 'Fraud Cases',
        details: 'Exported 150 fraud case records',
        riskLevel: 'medium'
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 3600000).toLocaleString(),
        user: 'Lisa Rodriguez',
        action: 'Configuration Change',
        entity: 'Fleet Settings',
        details: 'Updated vehicle tracking parameters',
        riskLevel: 'medium'
      },
      {
        id: '4',
        timestamp: new Date(Date.now() - 7200000).toLocaleString(),
        user: 'System',
        action: 'Failed Login Attempt',
        entity: 'Authentication System',
        details: 'Multiple failed login attempts from IP 203.0.113.45',
        riskLevel: 'high'
      }
    ];

    const sampleReports: ComplianceReport[] = [
      {
        id: '1',
        name: 'Q4 2024 SOC 2 Report',
        type: 'quarterly',
        status: 'published',
        createdBy: 'David Kim',
        createdDate: '2024-12-01',
        complianceScore: 94
      },
      {
        id: '2',
        name: 'November GDPR Compliance',
        type: 'monthly',
        status: 'approved',
        createdBy: 'David Kim',
        createdDate: '2024-11-30',
        complianceScore: 92
      },
      {
        id: '3',
        name: 'Annual Security Assessment',
        type: 'annual',
        status: 'draft',
        createdBy: 'David Kim',
        createdDate: '2024-12-15',
        complianceScore: 89
      }
    ];

    setMetrics(sampleMetrics);
    setAuditLogs(sampleAuditLogs);
    setReports(sampleReports);
  }, []);

  const handleCreateReport = async () => {
    const newReport: ComplianceReport = {
      id: Date.now().toString(),
      name: 'New Compliance Report',
      type: 'custom',
      status: 'draft',
      createdBy: 'David Kim',
      createdDate: new Date().toISOString().split('T')[0],
      complianceScore: 0
    };
    
    try {
      const response = await fetch('http://localhost:3001/api/compliance/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReport)
      });
      
      if (response.ok) {
        setReports([newReport, ...reports]);
        setMessage(`Report "${newReport.name}" created successfully!`);
      }
    } catch (error) {
      // Fallback to local state if API unavailable
      setReports([newReport, ...reports]);
      setMessage(`Report "${newReport.name}" created locally (API unavailable)`);
    }
    
    setTimeout(() => setMessage(''), 3000);
    setShowNewReport(false);
  };

  const handleReportStatusChange = (reportId: string, newStatus: ComplianceReport['status']) => {
    setReports(reports.map(r => 
      r.id === reportId ? { ...r, status: newStatus } : r
    ));
  };

  const exportAuditLogs = () => {
    const csvContent = [
      ['Timestamp', 'User', 'Action', 'Entity', 'Details', 'Risk Level'],
      ...auditLogs.map(log => [
        log.timestamp,
        log.user,
        log.action,
        log.entity,
        log.details,
        log.riskLevel
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Compliance Score Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              ✅
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Overall Compliance</p>
              <p className="text-2xl font-semibold text-gray-900">
                {Math.round(metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length)}%
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              📋
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Reports</p>
              <p className="text-2xl font-semibold text-gray-900">{reports.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
              ⚠️
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Warnings</p>
              <p className="text-2xl font-semibold text-gray-900">
                {metrics.filter(m => m.status === 'warning').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-red-100 text-red-600">
              🚨
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">High Risk Events</p>
              <p className="text-2xl font-semibold text-gray-900">
                {auditLogs.filter(log => log.riskLevel === 'high').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Compliance Metrics Chart */}
      <div className="bg-white rounded-lg shadow border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Compliance Metrics</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {metrics.map((metric) => (
              <div key={metric.id} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {metric.category} - {metric.name}
                    </span>
                    <span className="text-sm text-gray-500">
                      {metric.value}% (Target: {metric.target}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        metric.status === 'compliant' ? 'bg-green-600' :
                        metric.status === 'warning' ? 'bg-yellow-600' :
                        'bg-red-600'
                      }`}
                      style={{ width: `${Math.min(metric.value, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="ml-4">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    metric.status === 'compliant' ? 'bg-green-100 text-green-800' :
                    metric.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {metric.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderReports = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Compliance Reports</h2>
        <button
          onClick={() => setShowNewReport(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Create Report
        </button>
      </div>

      {showNewReport && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium mb-4">Create New Report</h3>
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Report Name"
              className="border border-gray-300 rounded-md px-3 py-2"
            />
            <select className="border border-gray-300 rounded-md px-3 py-2">
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleCreateReport}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
            >
              Create Report
            </button>
            <button
              onClick={() => setShowNewReport(false)}
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Report Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Compliance Score</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {reports.map((report) => (
              <tr key={report.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {report.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                  {report.type}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    value={report.status}
                    onChange={(e) => handleReportStatusChange(report.id, e.target.value as ComplianceReport['status'])}
                    className={`text-sm rounded-full px-3 py-1 border-0 ${
                      report.status === 'published' ? 'bg-green-100 text-green-800' :
                      report.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                      report.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <option value="draft">Draft</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="published">Published</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="flex items-center">
                    <span className="mr-2">{report.complianceScore}%</span>
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          report.complianceScore >= 90 ? 'bg-green-600' :
                          report.complianceScore >= 75 ? 'bg-yellow-600' :
                          'bg-red-600'
                        }`}
                        style={{ width: `${report.complianceScore}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {report.createdDate}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => setSelectedReport(report)}
                    className="text-blue-600 hover:text-blue-900 mr-3"
                  >
                    View
                  </button>
                  <button className="text-green-600 hover:text-green-900">
                    Export
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderAuditLogs = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Audit Trail</h2>
        <button
          onClick={exportAuditLogs}
          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
        >
          Export Logs
        </button>
      </div>

      <div className="bg-white rounded-lg shadow border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk Level</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {auditLogs.map((log) => (
              <tr key={log.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {log.timestamp}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {log.user}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {log.action}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {log.entity}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    log.riskLevel === 'low' ? 'bg-green-100 text-green-800' :
                    log.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {log.riskLevel}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  <div className="max-w-xs truncate" title={log.details}>
                    {log.details}
                  </div>
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
            <div className="w-8 h-8 bg-purple-600 rounded-md flex items-center justify-center">
              <span className="text-white font-bold text-sm">📋</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Compliance & Audit Dashboard</h1>
              <p className="text-sm text-gray-500">Monitor compliance metrics and audit trails</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-gray-600 text-sm font-medium">DK</span>
              </div>
              <div className="hidden md:block">
                <div className="text-sm font-medium text-gray-900">David Kim</div>
                <div className="text-xs text-gray-500">Compliance Auditor</div>
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
              { id: 'metrics', label: 'Compliance Metrics', icon: '📈' },
              { id: 'reports', label: 'Reports', icon: '📋' },
              { id: 'audit', label: 'Audit Trail', icon: '📝' },
              { id: 'risk', label: 'Risk Assessment', icon: '⚖️' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-600'
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
        {activeTab === 'reports' && renderReports()}
        {activeTab === 'audit' && renderAuditLogs()}
        {activeTab === 'metrics' && (
          <div className="bg-white p-8 rounded-lg shadow border">
            <h2 className="text-xl font-semibold mb-4">Detailed Compliance Metrics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {metrics.map(metric => (
                <div key={metric.id} className="border rounded-lg p-4">
                  <h3 className="font-semibold text-lg">{metric.category}</h3>
                  <p className="text-gray-600">{metric.name}</p>
                  <div className="mt-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Current: {metric.value}%</span>
                      <span>Target: {metric.target}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full ${
                          metric.status === 'compliant' ? 'bg-green-600' :
                          metric.status === 'warning' ? 'bg-yellow-600' :
                          'bg-red-600'
                        }`}
                        style={{ width: `${Math.min(metric.value, 100)}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Updated: {metric.lastUpdated}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab === 'risk' && (
          <div className="bg-white p-8 rounded-lg shadow border">
            <h2 className="text-xl font-semibold mb-4">Risk Assessment</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 border rounded">
                <div>
                  <h3 className="font-medium">Data Privacy Risk</h3>
                  <p className="text-sm text-gray-600">GDPR compliance below target threshold</p>
                </div>
                <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm">Medium</span>
              </div>
              <div className="flex justify-between items-center p-4 border rounded">
                <div>
                  <h3 className="font-medium">Security Control Risk</h3>
                  <p className="text-sm text-gray-600">Some ISO 27001 controls need attention</p>
                </div>
                <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm">Medium</span>
              </div>
              <div className="flex justify-between items-center p-4 border rounded">
                <div>
                  <h3 className="font-medium">Failed Login Risk</h3>
                  <p className="text-sm text-gray-600">Multiple failed attempts detected</p>
                </div>
                <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm">High</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Report Details Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Report Details</h2>
            <div className="space-y-3">
              <p><strong>Name:</strong> {selectedReport.name}</p>
              <p><strong>Type:</strong> {selectedReport.type}</p>
              <p><strong>Status:</strong> {selectedReport.status}</p>
              <p><strong>Compliance Score:</strong> {selectedReport.complianceScore}%</p>
              <p><strong>Created By:</strong> {selectedReport.createdBy}</p>
              <p><strong>Created Date:</strong> {selectedReport.createdDate}</p>
              <div className="mt-6 p-4 bg-gray-50 rounded">
                <h3 className="font-medium mb-2">Report Summary:</h3>
                <p className="text-sm text-gray-600">
                  This {selectedReport.type} compliance report covers key regulatory requirements 
                  and organizational compliance metrics. Overall compliance score of {selectedReport.complianceScore}% 
                  indicates {selectedReport.complianceScore >= 90 ? 'excellent' : 
                           selectedReport.complianceScore >= 75 ? 'good' : 'needs improvement'} 
                  compliance status.
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedReport(null)}
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

export default AuditorWorkingDashboard;