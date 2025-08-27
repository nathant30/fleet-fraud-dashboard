import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

interface FraudAlert {
  id: string;
  timestamp: string;
  severity: 'high' | 'medium' | 'low';
  type: string;
  vehicleId: string;
  description: string;
  confidence: number;
  status: 'active' | 'investigating' | 'resolved';
}

interface DetectionResult {
  fraudProbability: number;
  riskLevel: 'high' | 'medium' | 'low';
  factors: string[];
  recommendations: string[];
}

interface FraudEvent {
  id: string;
  timestamp: string;
  type: 'fare_manipulation' | 'identity_fraud' | 'gps_spoofing' | 'payment_fraud' | 'rating_manipulation';
  severity: 'critical' | 'high' | 'medium' | 'low';
  vehicleId: string;
  driverId: string;
  riderId?: string;
  description: string;
  confidence: number;
  riskScore: number;
  location: { lat: number; lng: number };
  amount?: number;
  status: 'detected' | 'investigating' | 'resolved' | 'false_positive';
}

interface FraudInsights {
  totalEvents: number;
  eventsToday: number;
  topFraudTypes: Array<{ type: string; count: number; trend: number }>;
  riskDistribution: { critical: number; high: number; medium: number; low: number };
  averageResponseTime: number;
  detectionAccuracy: number;
  falsePositiveRate: number;
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  user: string;
  details: string;
  system?: string;
}

interface HighRiskDriver {
  id: string;
  name: string;
  licenseNumber: string;
  riskScore: number;
  riskLevel: 'critical' | 'high' | 'medium';
  totalIncidents: number;
  recentIncidents: number;
  accountAge: number;
  verificationStatus: 'verified' | 'pending' | 'failed';
  riskFactors: string[];
  flaggedBehaviors: string[];
  lastActivity: string;
  vehicleId?: string;
  profileImage?: string;
}

interface HighRiskCustomer {
  id: string;
  name: string;
  email: string;
  riskScore: number;
  riskLevel: 'critical' | 'high' | 'medium';
  totalComplaints: number;
  recentComplaints: number;
  accountAge: number;
  paymentIssues: number;
  riskFactors: string[];
  flaggedBehaviors: string[];
  lastActivity: string;
  profileImage?: string;
}

const FraudAnalystDashboard: React.FC = () => {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [fraudEvents, setFraudEvents] = useState<FraudEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('insights');
  const [isPolling, setIsPolling] = useState(true);
  const [lastEventTime, setLastEventTime] = useState(Date.now());
  const [fraudInsights, setFraudInsights] = useState<FraudInsights>({
    totalEvents: 15847,
    eventsToday: 342,
    topFraudTypes: [
      { type: 'Fare Manipulation', count: 127, trend: 12 },
      { type: 'GPS Spoofing', count: 89, trend: -5 },
      { type: 'Identity Fraud', count: 67, trend: 8 },
      { type: 'Payment Fraud', count: 45, trend: 3 },
      { type: 'Rating Manipulation', count: 14, trend: -2 }
    ],
    riskDistribution: { critical: 23, high: 87, medium: 156, low: 76 },
    averageResponseTime: 2.3,
    detectionAccuracy: 97.8,
    falsePositiveRate: 2.1
  });
  const [tripsAffected] = useState(8347);
  const [selectedEvent, setSelectedEvent] = useState<FraudEvent | null>(null);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [highRiskDrivers, setHighRiskDrivers] = useState<HighRiskDriver[]>([]);
  const [highRiskCustomers, setHighRiskCustomers] = useState<HighRiskCustomer[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<HighRiskDriver | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<HighRiskCustomer | null>(null);
  const [showDriverProfile, setShowDriverProfile] = useState(false);
  const [showCustomerProfile, setShowCustomerProfile] = useState(false);
  const [showSuspendWalletModal, setShowSuspendWalletModal] = useState(false);
  const [suspendWalletType, setSuspendWalletType] = useState<'driver' | 'customer'>('driver');
  const [suspendWalletTarget, setSuspendWalletTarget] = useState<HighRiskDriver | HighRiskCustomer | null>(null);
  const [showMetricModal, setShowMetricModal] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<string>('');
  const [selectedDateRange, setSelectedDateRange] = useState('today');
  const [showFraudTypeDetail, setShowFraudTypeDetail] = useState(false);
  const [selectedFraudType, setSelectedFraudType] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [showLocationPanel, setShowLocationPanel] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<any>(null);
  const [isolatedDrivers, setIsolatedDrivers] = useState<any[]>([]);
  const [isolatedCustomers, setIsolatedCustomers] = useState<any[]>([]);
  const [showIsolatedEntities, setShowIsolatedEntities] = useState(false);

  // Settings state
  const [settingsTab, setSettingsTab] = useState('api');
  const [apiSettings, setApiSettings] = useState({
    fraudDetectionApi: {
      enabled: true,
      endpoint: 'https://api.fleetfraud.com/v1/detection',
      apiKey: '',
      timeout: 30000,
      retryAttempts: 3,
      status: 'disconnected' as 'connected' | 'disconnected' | 'error'
    },
    driverApi: {
      enabled: true,
      endpoint: 'https://api.fleetfraud.com/v1/drivers',
      apiKey: '',
      syncInterval: 300000,
      status: 'disconnected' as 'connected' | 'disconnected' | 'error'
    },
    customerApi: {
      enabled: true,
      endpoint: 'https://api.fleetfraud.com/v1/customers',
      apiKey: '',
      syncInterval: 600000,
      status: 'disconnected' as 'connected' | 'disconnected' | 'error'
    },
    locationApi: {
      enabled: true,
      endpoint: 'https://api.fleetfraud.com/v1/locations',
      apiKey: '',
      syncInterval: 120000,
      status: 'disconnected' as 'connected' | 'disconnected' | 'error'
    }
  });
  const [notificationSettings, setNotificationSettings] = useState({
    emailAlerts: true,
    slackIntegration: false,
    slackWebhook: '',
    criticalThreshold: 8.5,
    highThreshold: 6.0,
    realTimeAlerts: true,
    dailyReports: true,
    weeklyReports: false
  });
  const [systemSettings, setSystemSettings] = useState({
    autoRefreshInterval: 30,
    dataRetentionDays: 90,
    maxEventsDisplay: 100,
    enableGeoBlocking: false,
    debugMode: false,
    logLevel: 'info' as 'debug' | 'info' | 'warn' | 'error'
  });

  // Test data for demonstration
  const mockAlerts: FraudAlert[] = [
    {
      id: '1',
      timestamp: new Date().toISOString(),
      severity: 'high',
      type: 'Speed Violation',
      vehicleId: 'FLT-001',
      description: 'Vehicle exceeded speed limit by 40% on Highway 101',
      confidence: 0.95,
      status: 'active'
    },
    {
      id: '2', 
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      severity: 'medium',
      type: 'Route Deviation',
      vehicleId: 'FLT-002',
      description: 'Unauthorized route deviation detected',
      confidence: 0.78,
      status: 'investigating'
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      severity: 'low',
      type: 'Fuel Anomaly',
      vehicleId: 'FLT-003',
      description: 'Unusual fuel consumption pattern',
      confidence: 0.65,
      status: 'resolved'
    }
  ];

  useEffect(() => {
    checkApiStatus();
    loadMockAlerts();
    generateInitialEvents();
    generateHighRiskProfiles();
    
    // Start polling for new fraud events every 3 seconds
    const pollingInterval = setInterval(() => {
      if (isPolling) {
        pollForNewEvents();
      }
    }, 3000);
    
    // Generate random fraud events every 5-15 seconds
    const eventInterval = setInterval(() => {
      if (isPolling) {
        generateNewFraudEvent();
      }
    }, Math.random() * 10000 + 5000);
    
    return () => {
      clearInterval(pollingInterval);
      clearInterval(eventInterval);
    };
  }, [isPolling]);
  
  // Mock data for Philippine regions and fraud clusters
  const philippineRegions = [
    {
      id: 'metro_manila',
      name: 'Metro Manila',
      coordinates: { lat: 14.5995, lng: 120.9842 },
      fraudLevel: 'critical',
      totalFraudIncidents: 2847,
      activeClusters: 15,
      riskScore: 9.2
    },
    {
      id: 'cebu',
      name: 'Cebu',
      coordinates: { lat: 10.3157, lng: 123.8854 },
      fraudLevel: 'high',
      totalFraudIncidents: 1234,
      activeClusters: 8,
      riskScore: 7.8
    },
    {
      id: 'boracay',
      name: 'Boracay',
      coordinates: { lat: 11.9674, lng: 121.9248 },
      fraudLevel: 'high',
      totalFraudIncidents: 892,
      activeClusters: 6,
      riskScore: 7.3
    },
    {
      id: 'bataan',
      name: 'Bataan',
      coordinates: { lat: 14.6417, lng: 120.4818 },
      fraudLevel: 'medium',
      totalFraudIncidents: 456,
      activeClusters: 4,
      riskScore: 6.1
    }
  ];

  const fraudClusters = {
    metro_manila: [
      {
        id: 'mm_cluster_1',
        name: 'Makati Business District',
        coordinates: { lat: 14.5547, lng: 121.0244 },
        hexId: 'h3_8c283082c6a5fff',
        fraudTypes: ['fare_manipulation', 'gps_spoofing'],
        riskLevel: 'critical',
        fraudCount: 347,
        affectedDrivers: 23,
        affectedCustomers: 89,
        driverHubs: ['Hub_MKT_01', 'Hub_MKT_02']
      },
      {
        id: 'mm_cluster_2',
        name: 'Quezon City North',
        coordinates: { lat: 14.6760, lng: 121.0437 },
        hexId: 'h3_8c283082c6b7fff',
        fraudTypes: ['identity_fraud', 'payment_fraud'],
        riskLevel: 'high',
        fraudCount: 234,
        affectedDrivers: 18,
        affectedCustomers: 67,
        driverHubs: ['Hub_QC_01']
      },
      {
        id: 'mm_cluster_3',
        name: 'Manila Bay Area',
        coordinates: { lat: 14.5794, lng: 120.9721 },
        hexId: 'h3_8c283082c6c9fff',
        fraudTypes: ['rating_manipulation', 'fare_manipulation'],
        riskLevel: 'high',
        fraudCount: 189,
        affectedDrivers: 15,
        affectedCustomers: 54,
        driverHubs: ['Hub_MNL_01', 'Hub_MNL_02']
      }
    ],
    cebu: [
      {
        id: 'cebu_cluster_1',
        name: 'Cebu IT Park',
        coordinates: { lat: 10.3270, lng: 123.9061 },
        hexId: 'h3_8c194d82b6a5fff',
        fraudTypes: ['fare_manipulation', 'identity_fraud'],
        riskLevel: 'high',
        fraudCount: 156,
        affectedDrivers: 12,
        affectedCustomers: 43,
        driverHubs: ['Hub_CEB_01']
      }
    ],
    boracay: [
      {
        id: 'boracay_cluster_1',
        name: 'White Beach Station',
        coordinates: { lat: 11.9703, lng: 121.9227 },
        hexId: 'h3_8c1a4d82b6a5fff',
        fraudTypes: ['payment_fraud', 'gps_spoofing'],
        riskLevel: 'high',
        fraudCount: 123,
        affectedDrivers: 9,
        affectedCustomers: 38,
        driverHubs: ['Hub_BOR_01']
      }
    ],
    bataan: [
      {
        id: 'bataan_cluster_1',
        name: 'Balanga City Center',
        coordinates: { lat: 14.6765, lng: 120.5363 },
        hexId: 'h3_8c284d82b6a5fff',
        fraudTypes: ['fare_manipulation'],
        riskLevel: 'medium',
        fraudCount: 87,
        affectedDrivers: 7,
        affectedCustomers: 24,
        driverHubs: ['Hub_BAT_01']
      }
    ]
  };

  const generateHighRiskProfiles = () => {
    const mockDrivers: HighRiskDriver[] = [
      {
        id: 'DRV-7734',
        name: 'Marcus Rodriguez',
        licenseNumber: 'DL-4829374',
        riskScore: 9.2,
        riskLevel: 'critical',
        totalIncidents: 47,
        recentIncidents: 12,
        accountAge: 8.5,
        verificationStatus: 'failed',
        riskFactors: [
          'Multiple identity verification failures',
          'Frequent route manipulation',
          'Abnormal fare collection patterns',
          'GPS spoofing detected 8 times',
          'Customer complaints about overcharging'
        ],
        flaggedBehaviors: [
          'Consistently takes longer routes',
          'Manipulates wait times',
          'Uses fake GPS locations',
          'Multiple failed photo verification'
        ],
        lastActivity: '2024-12-27T14:30:00Z',
        vehicleId: 'RSH-4892'
      },
      {
        id: 'DRV-4471',
        name: 'James Chen',
        licenseNumber: 'DL-2847163',
        riskScore: 8.7,
        riskLevel: 'high',
        totalIncidents: 23,
        recentIncidents: 7,
        accountAge: 3.2,
        verificationStatus: 'pending',
        riskFactors: [
          'Recent surge pricing manipulation',
          'Coordinated with other drivers for artificial demand',
          'Frequent off-platform payments',
          'Unusual activity patterns'
        ],
        flaggedBehaviors: [
          'Circular driving patterns to create surge',
          'Requests cash payments frequently',
          'Cancels rides after surge ends'
        ],
        lastActivity: '2024-12-27T16:45:00Z',
        vehicleId: 'RSH-2183'
      },
      {
        id: 'DRV-8821',
        name: 'Sofia Petrov',
        licenseNumber: 'DL-9384756',
        riskScore: 7.9,
        riskLevel: 'high',
        totalIncidents: 19,
        recentIncidents: 5,
        accountAge: 6.1,
        verificationStatus: 'verified',
        riskFactors: [
          'Rating manipulation attempts',
          'Inconsistent driver photo verification',
          'Frequent passenger disputes',
          'Unusual pickup/dropoff patterns'
        ],
        flaggedBehaviors: [
          'Uses multiple accounts',
          'Asks passengers to rate before trip ends',
          'Frequent location discrepancies'
        ],
        lastActivity: '2024-12-27T12:15:00Z',
        vehicleId: 'RSH-7756'
      }
    ];
    
    const mockCustomers: HighRiskCustomer[] = [
      {
        id: 'USR-2847',
        name: 'David Thompson',
        email: 'david.t.suspicious@email.com',
        riskScore: 8.9,
        riskLevel: 'critical',
        totalComplaints: 34,
        recentComplaints: 11,
        accountAge: 2.1,
        paymentIssues: 18,
        riskFactors: [
          'Multiple payment fraud attempts',
          'Frequent false driver reports',
          'Account sharing detected',
          'Abnormal ride patterns',
          'Coordinated with high-risk drivers'
        ],
        flaggedBehaviors: [
          'Reports drivers falsely for refunds',
          'Uses stolen payment methods',
          'Books rides to investigate driver locations',
          'Creates fake accounts'
        ],
        lastActivity: '2024-12-27T15:20:00Z'
      },
      {
        id: 'USR-9374',
        name: 'Emma Wilson',
        email: 'e.wilson.rider@email.com',
        riskScore: 7.3,
        riskLevel: 'high',
        totalComplaints: 16,
        recentComplaints: 6,
        accountAge: 4.3,
        paymentIssues: 9,
        riskFactors: [
          'Pattern of disputing legitimate charges',
          'Frequently changes payment methods',
          'Reports missing items excessively',
          'Inconsistent pickup locations'
        ],
        flaggedBehaviors: [
          'Claims driver took wrong route for refunds',
          'Reports false safety concerns',
          'Uses promotional codes fraudulently'
        ],
        lastActivity: '2024-12-27T13:45:00Z'
      },
      {
        id: 'USR-5829',
        name: 'Robert Kim',
        email: 'robert.k.customer@email.com',
        riskScore: 6.8,
        riskLevel: 'medium',
        totalComplaints: 12,
        recentComplaints: 4,
        accountAge: 7.2,
        paymentIssues: 5,
        riskFactors: [
          'Occasional payment disputes',
          'Rides to unusual locations',
          'Late night activity patterns',
          'Multiple device logins'
        ],
        flaggedBehaviors: [
          'Books rides to remote locations',
          'Frequently modifies destinations mid-trip',
          'Uses account from multiple devices'
        ],
        lastActivity: '2024-12-27T11:30:00Z'
      }
    ];
    
    setHighRiskDrivers(mockDrivers);
    setHighRiskCustomers(mockCustomers);
  };
  
  const generateEventAuditTrail = (event: FraudEvent): AuditLogEntry[] => {
    return [
      {
        id: 'audit_1',
        timestamp: event.timestamp,
        action: 'Fraud Event Detected',
        user: 'AI Detection System',
        details: `${event.type.replace('_', ' ')} detected with ${(event.confidence * 100).toFixed(0)}% confidence`,
        system: 'FraudDetectionEngine v4.2'
      },
      {
        id: 'audit_2',
        timestamp: new Date(new Date(event.timestamp).getTime() + 1000).toISOString(),
        action: 'Risk Assessment',
        user: 'Risk Analysis Module',
        details: `Risk score calculated: ${event.riskScore.toFixed(1)}/10 based on behavioral patterns`,
        system: 'RiskScoringEngine v2.1'
      },
      {
        id: 'audit_3',
        timestamp: new Date(new Date(event.timestamp).getTime() + 2000).toISOString(),
        action: 'Pattern Matching',
        user: 'ML Pattern Recognition',
        details: 'Cross-referenced with known fraud patterns and historical data',
        system: 'PatternMatchingAI v3.0'
      },
      {
        id: 'audit_4',
        timestamp: new Date(new Date(event.timestamp).getTime() + 3000).toISOString(),
        action: 'Alert Generated',
        user: 'Alert Management System',
        details: `Alert priority set to ${event.severity} based on risk assessment`,
        system: 'AlertManager v1.8'
      },
      {
        id: 'audit_5',
        timestamp: new Date(new Date(event.timestamp).getTime() + 4000).toISOString(),
        action: 'Notification Sent',
        user: 'Notification Service',
        details: 'Real-time notification sent to fraud analysis team',
        system: 'NotificationEngine v2.3'
      }
    ];
  };
  
  const openEventDetails = (event: FraudEvent) => {
    setSelectedEvent(event);
    setShowEventDetails(true);
  };
  
  const openDriverProfile = (driver: HighRiskDriver) => {
    setSelectedDriver(driver);
    setShowDriverProfile(true);
  };
  
  const openCustomerProfile = (customer: HighRiskCustomer) => {
    setSelectedCustomer(customer);
    setShowCustomerProfile(true);
  };
  
  const openSuspendWalletModal = (type: 'driver' | 'customer', target: HighRiskDriver | HighRiskCustomer) => {
    setSuspendWalletType(type);
    setSuspendWalletTarget(target);
    setShowSuspendWalletModal(true);
  };
  
  const handleSuspendWallet = (duration: string) => {
    const targetName = suspendWalletType === 'driver' ? (suspendWalletTarget as HighRiskDriver)?.name : (suspendWalletTarget as HighRiskCustomer)?.name;
    setMessage(`💼 Wallet withdrawals suspended for ${targetName} - Duration: ${duration}`);
    setShowSuspendWalletModal(false);
    setTimeout(() => setMessage(''), 4000);
  };
  
  const openMetricModal = (metric: string) => {
    setSelectedMetric(metric);
    setShowMetricModal(true);
  };
  
  const openFraudTypeDetail = (fraudType: string) => {
    setSelectedFraudType(fraudType);
    setShowFraudTypeDetail(true);
  };
  
  const handleRegionClick = (regionId: string) => {
    setSelectedRegion(regionId);
    setShowLocationPanel(false);
  };
  
  const handleClusterClick = (cluster: any) => {
    setSelectedCluster(cluster);
    setShowLocationPanel(true);
  };
  
  const getRegionColor = (fraudLevel: string) => {
    switch (fraudLevel) {
      case 'critical': return { bg: '#dc2626', opacity: 0.8 };
      case 'high': return { bg: '#f59e0b', opacity: 0.7 };
      case 'medium': return { bg: '#10b981', opacity: 0.6 };
      default: return { bg: '#6b7280', opacity: 0.5 };
    }
  };
  
  const formatFraudType = (type: string) => {
    return type.replace('_', ' ').split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };
  
  const handleIsolateDrivers = (cluster: any) => {
    const clusterDrivers = highRiskDrivers.slice(0, cluster.affectedDrivers).map(driver => ({
      ...driver,
      isolatedFrom: cluster.name,
      isolatedAt: new Date().toISOString(),
      isolationReason: cluster.fraudTypes.join(', '),
      status: 'isolated',
      actions: []
    }));
    
    setIsolatedDrivers(prev => [...prev, ...clusterDrivers]);
    setMessage(`🔍 Isolated ${cluster.affectedDrivers} drivers from ${cluster.name} cluster`);
    setTimeout(() => setMessage(''), 4000);
  };
  
  const handleIsolateCustomers = (cluster: any) => {
    const clusterCustomers = highRiskCustomers.slice(0, cluster.affectedCustomers).map(customer => ({
      ...customer,
      isolatedFrom: cluster.name,
      isolatedAt: new Date().toISOString(),
      isolationReason: cluster.fraudTypes.join(', '),
      status: 'isolated',
      actions: []
    }));
    
    setIsolatedCustomers(prev => [...prev, ...clusterCustomers]);
    setMessage(`👥 Isolated ${cluster.affectedCustomers} customers from ${cluster.name} cluster`);
    setTimeout(() => setMessage(''), 4000);
  };
  
  const performEntityAction = (entityType: 'driver' | 'customer', entityId: string, action: string) => {
    const timestamp = new Date().toISOString();
    const actionDescription = `${action} executed at ${new Date(timestamp).toLocaleString()}`;
    
    if (entityType === 'driver') {
      setIsolatedDrivers(prev => prev.map(driver => 
        driver.id === entityId 
          ? { ...driver, actions: [...driver.actions, { action, timestamp, description: actionDescription }] }
          : driver
      ));
    } else {
      setIsolatedCustomers(prev => prev.map(customer => 
        customer.id === entityId 
          ? { ...customer, actions: [...customer.actions, { action, timestamp, description: actionDescription }] }
          : customer
      ));
    }
    
    setMessage(`✅ ${action} applied to ${entityType} ${entityId}`);
    setTimeout(() => setMessage(''), 3000);
  };
  
  const getMetricModalContent = (metric: string) => {
    switch (metric) {
      case 'detection_accuracy':
        return {
          title: '🎯 AI Detection Accuracy',
          content: `Current accuracy: ${fraudInsights.detectionAccuracy}%\n\nOur ML algorithms achieve industry-leading accuracy through:\n• Neural network pattern recognition\n• Real-time behavioral analysis\n• Historical fraud pattern matching\n• GPS and location anomaly detection\n\nAccuracy is measured against verified fraud cases over the past 30 days.`
        };
      case 'events_today':
        return {
          title: '📊 Events Today (Live)',
          content: `Current count: ${fraudInsights.eventsToday.toLocaleString()}\n\nLive event monitoring includes:\n• Real-time fraud detection alerts\n• GPS anomaly notifications\n• Payment processing violations\n• Driver behavior irregularities\n• Customer complaint patterns\n\nEvents are processed in real-time with sub-second latency.`
        };
      case 'response_time':
        return {
          title: '⚡ Average Response Time',
          content: `Current response time: ${fraudInsights.averageResponseTime}s\n\nResponse time includes:\n• Event detection processing\n• Risk assessment calculation\n• Alert generation and routing\n• Notification delivery\n• Dashboard updates\n\nSystem maintains <3s response time SLA across all fraud detection operations.`
        };
      case 'critical_alerts':
        return {
          title: '🚨 Critical Alerts',
          content: `Active critical alerts: ${fraudInsights.riskDistribution.critical}\n\nCritical alerts include:\n• Account takeover attempts\n• Large-scale fare manipulation\n• GPS spoofing networks\n• Payment fraud schemes\n• Identity verification failures\n\nCritical alerts require immediate investigation within 15 minutes.`
        };
      case 'false_positive':
        return {
          title: '❌ False Positive Rate',
          content: `Current rate: ${fraudInsights.falsePositiveRate}%\n\nFalse positive optimization:\n• Machine learning model refinement\n• Historical pattern analysis\n• Behavioral context consideration\n• Multi-factor verification\n• Continuous model training\n\nTarget: <2% false positive rate for optimal user experience.`
        };
      case 'total_events':
        return {
          title: '📈 Total Events Processed',
          content: `Total processed: ${fraudInsights.totalEvents.toLocaleString()}\n\nComprehensive fraud monitoring:\n• All rideshare transactions analyzed\n• Driver behavior tracking\n• Customer pattern monitoring\n• Payment processing oversight\n• GPS and route validation\n\nSystem processes 50M+ events daily across the platform.`
        };
      case 'trips_affected':
        return {
          title: '🚗 Trips Affected by Fraud',
          content: `Affected trips: ${tripsAffected.toLocaleString()}\n\nFraud impact analysis:\n• Trips involving detected fraud incidents\n• Customer experience disruptions\n• Driver behavior violations\n• Payment processing irregularities\n• Route manipulation occurrences\n\nRepresents actual trips impacted by confirmed fraud incidents, affecting both drivers and passengers.`
        };
      default:
        return { title: 'Metric Details', content: 'Detailed information about this metric.' };
    }
  };
  
  const generateInitialEvents = () => {
    const initialEvents: FraudEvent[] = [
      {
        id: 'evt_001',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        type: 'fare_manipulation',
        severity: 'high',
        vehicleId: 'RSH-4892',
        driverId: 'DRV-7734',
        riderId: 'USR-2847',
        description: 'Driver extended route artificially to inflate fare by 47%',
        confidence: 0.94,
        riskScore: 8.7,
        location: { lat: 37.7749, lng: -122.4194 },
        amount: 73.50,
        status: 'detected'
      },
      {
        id: 'evt_002',
        timestamp: new Date(Date.now() - 600000).toISOString(),
        type: 'gps_spoofing',
        severity: 'critical',
        vehicleId: 'RSH-2183',
        driverId: 'DRV-4471',
        description: 'GPS manipulation detected - impossible speed and location jumps',
        confidence: 0.98,
        riskScore: 9.3,
        location: { lat: 37.7849, lng: -122.4094 },
        status: 'investigating'
      },
      {
        id: 'evt_003',
        timestamp: new Date(Date.now() - 900000).toISOString(),
        type: 'identity_fraud',
        severity: 'high',
        vehicleId: 'RSH-7756',
        driverId: 'DRV-8821',
        description: 'Driver photo mismatch detected - possible account takeover',
        confidence: 0.89,
        riskScore: 8.1,
        location: { lat: 37.7649, lng: -122.4294 },
        status: 'resolved'
      }
    ];
    setFraudEvents(initialEvents);
  };
  
  const generateNewFraudEvent = () => {
    const eventTypes: FraudEvent['type'][] = ['fare_manipulation', 'identity_fraud', 'gps_spoofing', 'payment_fraud', 'rating_manipulation'];
    const severities: FraudEvent['severity'][] = ['critical', 'high', 'medium', 'low'];
    const descriptions = {
      fare_manipulation: [
        'Excessive route deviation to inflate fare',
        'Artificial surge pricing manipulation detected',
        'Wait time inflation for higher charges',
        'Distance reporting inconsistencies found'
      ],
      identity_fraud: [
        'Driver photo verification failed',
        'Account takeover attempt detected',
        'License mismatch with registered driver',
        'Biometric verification anomaly'
      ],
      gps_spoofing: [
        'Impossible speed detected between coordinates',
        'GPS coordinate jumps indicate manipulation',
        'Location accuracy tampering detected',
        'Route reconstruction failed due to GPS anomalies'
      ],
      payment_fraud: [
        'Card skimming device detected in vehicle',
        'Multiple payment failures with different cards',
        'Unauthorized charge attempts',
        'Payment processing anomaly detected'
      ],
      rating_manipulation: [
        'Coordinated fake rating pattern detected',
        'Rating bot activity identified',
        'Artificial rating inflation attempt',
        'Review manipulation network detected'
      ]
    };
    
    const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const severity = severities[Math.floor(Math.random() * severities.length)];
    const vehicleId = `RSH-${Math.floor(Math.random() * 9000) + 1000}`;
    const driverId = `DRV-${Math.floor(Math.random() * 9000) + 1000}`;
    
    const newEvent: FraudEvent = {
      id: `evt_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type,
      severity,
      vehicleId,
      driverId,
      riderId: Math.random() > 0.3 ? `USR-${Math.floor(Math.random() * 9000) + 1000}` : undefined,
      description: descriptions[type][Math.floor(Math.random() * descriptions[type].length)],
      confidence: Math.random() * 0.3 + 0.7,
      riskScore: Math.random() * 4 + 6,
      location: {
        lat: 37.7749 + (Math.random() - 0.5) * 0.1,
        lng: -122.4194 + (Math.random() - 0.5) * 0.1
      },
      amount: type === 'fare_manipulation' || type === 'payment_fraud' ? Math.random() * 150 + 20 : undefined,
      status: 'detected'
    };
    
    setFraudEvents(prev => [newEvent, ...prev.slice(0, 49)]); // Keep last 50 events
    setLastEventTime(Date.now());
    
    // Update insights
    setFraudInsights(prev => ({
      ...prev,
      eventsToday: prev.eventsToday + 1,
      totalEvents: prev.totalEvents + 1
    }));
  };
  
  const pollForNewEvents = async () => {
    try {
      // Simulate API polling
      if (Math.random() > 0.7) { // 30% chance of new events on each poll
        generateNewFraudEvent();
      }
    } catch (error) {
      console.log('Polling error:', error);
    }
  };

  const checkApiStatus = async () => {
    try {
      const response = await fetch('http://localhost:3001/health');
      if (response.ok) {
        setApiStatus('online');
      } else {
        setApiStatus('offline');
      }
    } catch (error) {
      setApiStatus('offline');
    }
  };

  const loadMockAlerts = () => {
    setAlerts(mockAlerts);
  };

  const runFraudDetection = async () => {
    setIsLoading(true);
    
    // Simulate API call to fraud detection
    const mockDetection = async () => {
      return new Promise<DetectionResult>((resolve) => {
        setTimeout(() => {
          resolve({
            fraudProbability: Math.random() * 0.3 + 0.7, // 70-100%
            riskLevel: Math.random() > 0.5 ? 'high' : 'medium',
            factors: [
              'Speed pattern analysis',
              'Route deviation detection',
              'Historical behavior comparison',
              'Geofence violation'
            ],
            recommendations: [
              'Immediate investigation required',
              'Contact driver for verification',
              'Review vehicle maintenance logs',
              'Implement additional monitoring'
            ]
          });
        }, 2000);
      });
    };

    try {
      // Try real API first
      if (apiStatus === 'online') {
        try {
          const response = await fetch('http://localhost:3001/api/fraud/detect/speed', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': 'demo-api-key'
            },
            body: JSON.stringify({
              vehicleId: 'DEMO-001',
              speed: 85,
              speedLimit: 55,
              timestamp: new Date().toISOString(),
              location: { lat: 37.7749, lng: -122.4194 }
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            setDetectionResult({
              fraudProbability: data.fraudProbability || 0.85,
              riskLevel: data.riskLevel || 'high',
              factors: data.factors || ['Real API detection'],
              recommendations: data.recommendations || ['API-based recommendation']
            });
          } else {
            throw new Error('API call failed');
          }
        } catch (apiError) {
          // Fall back to mock data
          const result = await mockDetection();
          setDetectionResult(result);
        }
      } else {
        // Use mock data if API is offline
        const result = await mockDetection();
        setDetectionResult(result);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'high': return { bg: '#fef2f2', border: '#ef4444', text: '#dc2626' };
      case 'medium': return { bg: '#fffbeb', border: '#f59e0b', text: '#d97706' };
      case 'low': return { bg: '#f0fdf4', border: '#10b981', text: '#059669' };
      default: return { bg: '#f9fafb', border: '#6b7280', text: '#374151' };
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getEventColor = (severity: string) => {
    switch (severity) {
      case 'critical': return { bg: '#fef2f2', border: '#dc2626', text: '#dc2626', icon: '🚨' };
      case 'high': return { bg: '#fef3c7', border: '#f59e0b', text: '#d97706', icon: '⚠️' };
      case 'medium': return { bg: '#ecfccb', border: '#84cc16', text: '#65a30d', icon: '⚡' };
      case 'low': return { bg: '#f0fdf4', border: '#10b981', text: '#059669', icon: '📋' };
      default: return { bg: '#f9fafb', border: '#6b7280', text: '#374151', icon: '📊' };
    }
  };
  
  const renderInsightsTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Real-time Status & Key Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1rem' }}>
        <div 
          onClick={() => openMetricModal('detection_accuracy')}
          style={{ 
            background: 'white', 
            padding: '1rem', 
            borderRadius: '10px', 
            border: '1px solid #e5e7eb', 
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)', 
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            ':hover': { transform: 'translateY(-2px)' }
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '1.25rem' }}>🎯</div>
            <div style={{ 
              background: fraudInsights.detectionAccuracy > 95 ? '#10b981' : '#f59e0b', 
              color: 'white', 
              padding: '0.2rem 0.4rem', 
              borderRadius: '8px', 
              fontSize: '0.65rem', 
              fontWeight: '600' 
            }}>
              {fraudInsights.detectionAccuracy > 95 ? 'EXCELLENT' : 'GOOD'}
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '0.25rem' }}>{fraudInsights.detectionAccuracy}%</div>
          <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>AI Detection Accuracy</div>
        </div>

        <div 
          onClick={() => openMetricModal('events_today')}
          style={{ 
            background: 'white', 
            padding: '1rem', 
            borderRadius: '10px', 
            border: '1px solid #e5e7eb', 
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)', 
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '1.25rem' }}>📊</div>
            <div style={{ 
              background: fraudInsights.eventsToday > 300 ? '#dc2626' : fraudInsights.eventsToday > 150 ? '#f59e0b' : '#10b981',
              width: '6px', 
              height: '6px', 
              borderRadius: '50%',
              animation: isPolling ? 'pulse 2s infinite' : 'none'
            }}></div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '0.25rem' }}>{fraudInsights.eventsToday.toLocaleString()}</div>
          <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>Events Today (Live)</div>
        </div>

        <div 
          onClick={() => openMetricModal('response_time')}
          style={{ 
            background: 'white', 
            padding: '1rem', 
            borderRadius: '10px', 
            border: '1px solid #e5e7eb', 
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)', 
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '1.25rem' }}>⚡</div>
            <div style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: '600' }}>FAST</div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '0.25rem' }}>{fraudInsights.averageResponseTime}s</div>
          <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>Avg Response Time</div>
        </div>

        <div 
          onClick={() => openMetricModal('critical_alerts')}
          style={{ 
            background: 'white', 
            padding: '1rem', 
            borderRadius: '10px', 
            border: '1px solid #e5e7eb', 
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)', 
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '1.25rem' }}>🚨</div>
            <div style={{ fontSize: '0.65rem', color: fraudInsights.riskDistribution.critical > 20 ? '#dc2626' : '#10b981', fontWeight: '600' }}>
              {fraudInsights.riskDistribution.critical > 20 ? 'HIGH' : 'LOW'}
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#dc2626', marginBottom: '0.25rem' }}>{fraudInsights.riskDistribution.critical}</div>
          <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>Critical Alerts</div>
        </div>

        <div 
          onClick={() => openMetricModal('false_positive')}
          style={{ 
            background: 'white', 
            padding: '1rem', 
            borderRadius: '10px', 
            border: '1px solid #e5e7eb', 
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)', 
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '1.25rem' }}>❌</div>
            <div style={{ fontSize: '0.65rem', color: fraudInsights.falsePositiveRate < 3 ? '#10b981' : '#f59e0b', fontWeight: '600' }}>
              {fraudInsights.falsePositiveRate < 3 ? 'OPTIMAL' : 'FAIR'}
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '0.25rem' }}>{fraudInsights.falsePositiveRate}%</div>
          <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>False Positive Rate</div>
        </div>

        <div 
          onClick={() => openMetricModal('total_events')}
          style={{ 
            background: 'white', 
            padding: '1rem', 
            borderRadius: '10px', 
            border: '1px solid #e5e7eb', 
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)', 
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '1.25rem' }}>📈</div>
            <div style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: '600' }}>TOTAL</div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '0.25rem' }}>{fraudInsights.totalEvents.toLocaleString()}</div>
          <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>Total Events Processed</div>
        </div>

        <div 
          onClick={() => openMetricModal('trips_affected')}
          style={{ 
            background: 'white', 
            padding: '1rem', 
            borderRadius: '10px', 
            border: '1px solid #e5e7eb', 
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)', 
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '1.25rem' }}>🚗</div>
            <div style={{ fontSize: '0.65rem', color: tripsAffected > 8000 ? '#dc2626' : tripsAffected > 5000 ? '#f59e0b' : '#10b981', fontWeight: '600' }}>
              {tripsAffected > 8000 ? 'HIGH' : tripsAffected > 5000 ? 'MEDIUM' : 'LOW'}
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '0.25rem' }}>{tripsAffected.toLocaleString()}</div>
          <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>Trips Affected</div>
        </div>
      </div>

      {/* AI Detection Engine Status */}
      <div style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
        padding: '2rem', 
        borderRadius: '16px', 
        color: 'white',
        boxShadow: '0 10px 25px rgba(0,0,0,0.15)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🤖 AI Detection Engine
            <div style={{ 
              background: apiStatus === 'online' ? '#10b981' : '#ef4444', 
              width: '12px', 
              height: '12px', 
              borderRadius: '50%',
              animation: 'pulse 2s infinite'
            }}></div>
          </h2>
          <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
            {apiStatus === 'online' ? '🟢 Live Detection Active' : '🔴 Demo Mode Active'}
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2rem', alignItems: 'center' }}>
          <div>
            <p style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', opacity: 0.95 }}>
              Advanced ML algorithms continuously monitor rideshare transactions for fraud patterns, GPS anomalies, and suspicious driver behavior.
            </p>
            <div style={{ display: 'flex', gap: '2rem', fontSize: '0.9rem', opacity: 0.9 }}>
              <span>🧠 Neural Network: Active</span>
              <span>🔍 Pattern Recognition: Running</span>
              <span>⚡ Real-time Processing: {isPolling ? 'ON' : 'OFF'}</span>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={runFraudDetection}
              disabled={isLoading}
              style={{
                background: isLoading ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.15)',
                color: 'white',
                border: '2px solid rgba(255,255,255,0.3)',
                padding: '1rem 2rem',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.2s ease'
              }}
            >
              {isLoading ? '🔄 Analyzing...' : '🔍 Run Deep Analysis'}
            </button>
          </div>
        </div>

        {detectionResult && (
          <div style={{ 
            background: 'rgba(255,255,255,0.15)', 
            padding: '1.5rem', 
            borderRadius: '12px',
            marginTop: '1.5rem',
            backdropFilter: 'blur(10px)'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: '600' }}>
              🎯 Latest Detection Results
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div>
                <p style={{ margin: '0.5rem 0', fontSize: '0.95rem' }}>
                  <strong>Fraud Probability:</strong> {(detectionResult.fraudProbability * 100).toFixed(1)}%
                </p>
                <p style={{ margin: '0.5rem 0', fontSize: '0.95rem' }}>
                  <strong>Risk Level:</strong> 
                  <span style={{ 
                    background: detectionResult.riskLevel === 'high' ? '#dc2626' : '#f59e0b',
                    color: 'white',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    marginLeft: '0.5rem'
                  }}>
                    {detectionResult.riskLevel.toUpperCase()}
                  </span>
                </p>
              </div>
              <div>
                <p style={{ margin: '0.5rem 0', fontSize: '0.95rem' }}>
                  <strong>Key Factors:</strong> {detectionResult.factors.slice(0, 2).join(', ')}
                </p>
                <p style={{ margin: '0.5rem 0', fontSize: '0.95rem' }}>
                  <strong>Recommendation:</strong> {detectionResult.recommendations[0]}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        {/* Top Fraud Types */}
        <div style={{ background: 'white', padding: '2rem', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📈 Top Fraud Types
              <div style={{ fontSize: '0.75rem', background: '#fef3c7', color: '#92400e', padding: '0.25rem 0.5rem', borderRadius: '12px' }}>
                TRENDING
              </div>
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: '500' }}>Period:</label>
              <select
                value={selectedDateRange}
                onChange={(e) => setSelectedDateRange(e.target.value)}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  padding: '0.5rem',
                  fontSize: '0.85rem',
                  color: '#374151',
                  cursor: 'pointer'
                }}
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {fraudInsights.topFraudTypes.map((fraud, index) => (
              <div 
                key={fraud.type} 
                onClick={() => openFraudTypeDetail(fraud.type)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '1.25rem', 
                  background: index === 0 ? '#fef3c7' : '#f8fafc', 
                  borderRadius: '12px',
                  border: index === 0 ? '2px solid #f59e0b' : '1px solid #e5e7eb',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ 
                    background: index === 0 ? '#f59e0b' : '#6b7280', 
                    color: 'white', 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontSize: '0.9rem',
                    fontWeight: 'bold'
                  }}>
                    {index + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', color: '#1f2937', fontSize: '1rem' }}>{fraud.type}</div>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{fraud.count} incidents detected</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ 
                    color: fraud.trend > 0 ? '#dc2626' : '#10b981', 
                    fontWeight: '700',
                    fontSize: '1.1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}>
                    {fraud.trend > 0 ? '↗️' : '↘️'} {Math.abs(fraud.trend)}%
                  </span>
                  <div style={{ 
                    background: '#3b82f6', 
                    color: 'white', 
                    padding: '0.4rem 0.8rem', 
                    borderRadius: '6px', 
                    fontSize: '0.75rem', 
                    fontWeight: '600' 
                  }}>
                    VIEW DETAILS
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Risk Distribution */}
        <div style={{ background: 'white', padding: '2rem', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem', color: '#1f2937' }}>🎭 Risk Distribution</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ textAlign: 'center', padding: '1.25rem', background: '#fef2f2', borderRadius: '12px', border: '2px solid #dc2626' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🚨</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc2626', marginBottom: '0.25rem' }}>{fraudInsights.riskDistribution.critical}</div>
              <div style={{ color: '#374151', fontSize: '0.9rem', fontWeight: '600' }}>Critical Threats</div>
            </div>
            <div style={{ textAlign: 'center', padding: '1.25rem', background: '#fef3c7', borderRadius: '12px', border: '1px solid #f59e0b' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#d97706', marginBottom: '0.25rem' }}>{fraudInsights.riskDistribution.high}</div>
              <div style={{ color: '#374151', fontSize: '0.85rem' }}>High Risk</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ textAlign: 'center', padding: '1rem', background: '#ecfccb', borderRadius: '8px' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>⚡</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#65a30d' }}>{fraudInsights.riskDistribution.medium}</div>
                <div style={{ color: '#374151', fontSize: '0.75rem' }}>Medium</div>
              </div>
              <div style={{ textAlign: 'center', padding: '1rem', background: '#f0fdf4', borderRadius: '8px' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>📋</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#059669' }}>{fraudInsights.riskDistribution.low}</div>
                <div style={{ color: '#374151', fontSize: '0.75rem' }}>Low</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Alerts Summary */}
      <div style={{ background: 'white', padding: '2rem', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>
            🚨 Recent Critical Alerts
          </h3>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            Last updated: {new Date(lastEventTime).toLocaleTimeString()}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {fraudEvents.slice(0, 3).map((event) => {
            const colors = getEventColor(event.severity);
            return (
              <div key={event.id} style={{
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: '12px',
                padding: '1.25rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }} onClick={() => openEventDetails(event)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>{colors.icon}</span>
                      <span style={{ 
                        background: colors.border,
                        color: 'white',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: '600'
                      }}>
                        {event.severity.toUpperCase()}
                      </span>
                      <span style={{ color: colors.text, fontWeight: '600', fontSize: '0.95rem' }}>
                        {event.type.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <p style={{ color: '#374151', margin: '0.5rem 0', fontSize: '0.9rem' }}>{event.description}</p>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                      <span>🚗 {event.vehicleId}</span>
                      <span>🎯 {(event.confidence * 100).toFixed(0)}% confidence</span>
                      <span>🕐 {formatTimestamp(event.timestamp)}</span>
                    </div>
                  </div>
                  <button
                    style={{
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    📋 Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
  

// Interactive Fraud Map - NO REFRESH, STABLE BASE
const MapComponent = () => {
  const [heatmapEnabled, setHeatmapEnabled] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Static fraud data that never changes
  const FRAUD_LOCATIONS = [
    { lat: 14.5995, lng: 120.9842, incidents: 770, region: 'Metro Manila', riskLevel: 'CRITICAL', color: '#dc2626' },
    { lat: 10.3157, lng: 123.8854, incidents: 156, region: 'Cebu', riskLevel: 'CRITICAL', color: '#dc2626' },
    { lat: 11.9674, lng: 121.9248, incidents: 123, region: 'Boracay', riskLevel: 'HIGH', color: '#f59e0b' },
    { lat: 14.6417, lng: 120.4818, incidents: 87, region: 'Bataan', riskLevel: 'MEDIUM', color: '#10b981' }
  ];

  // Initialize Google Maps with fallback
  useEffect(() => {
    let mounted = true;

    const initializeMap = async () => {
      const mapElement = document.getElementById('fraud-map');
      if (!mapElement) return;

      try {
        // Try Google Maps first
        const loader = new Loader({
          apiKey: 'AIzaSyBFPGX8Qh8ZqZ0mYoU7Jy3K9Y8S6rB_2Xw', // Public demo key
          version: 'weekly',
          libraries: ['visualization']
        });

        await loader.load();
        
        if (!mounted) return;

        const map = new google.maps.Map(mapElement, {
          center: { lat: 12.8797, lng: 121.7740 },
          zoom: 6,
          styles: [
            { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#d3d3d3' }] },
            { featureType: 'transit', stylers: [{ color: '#808080' }, { visibility: 'off' }] }
          ],
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true
        });

        // Add fraud markers
        FRAUD_LOCATIONS.forEach((location) => {
          const marker = new google.maps.Marker({
            position: { lat: location.lat, lng: location.lng },
            map: map,
            title: location.region,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: location.color,
              fillOpacity: 0.8,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: Math.max(15, Math.min(30, location.incidents / 30))
            }
          });

          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div style="padding: 10px; min-width: 200px;">
                <h3 style="margin: 0 0 10px 0; color: #1f2937;">${location.region}</h3>
                <div style="display: flex; flex-direction: column; gap: 5px;">
                  <div><strong>Risk Level:</strong> <span style="color: ${location.color};">${location.riskLevel}</span></div>
                  <div><strong>Incidents:</strong> ${location.incidents}</div>
                  <div><strong>Trend:</strong> <span style="color: ${location.incidents > 200 ? '#ef4444' : '#10b981'};">↑ ${location.incidents > 200 ? '+15%' : '+5%'}</span></div>
                </div>
              </div>
            `
          });

          marker.addListener('click', () => {
            infoWindow.open(map, marker);
          });
        });

        // Add heatmap if enabled
        if (heatmapEnabled) {
          const heatmapData = FRAUD_LOCATIONS.map(location => ({
            location: new google.maps.LatLng(location.lat, location.lng),
            weight: location.incidents / 100
          }));

          const heatmap = new google.maps.visualization.HeatmapLayer({
            data: heatmapData,
            map: map,
            radius: 50,
            opacity: 0.6
          });

          heatmap.set('gradient', [
            'rgba(0, 255, 255, 0)', 'rgba(0, 255, 255, 1)', 'rgba(0, 191, 255, 1)',
            'rgba(0, 127, 255, 1)', 'rgba(0, 63, 255, 1)', 'rgba(0, 0, 255, 1)',
            'rgba(63, 0, 191, 1)', 'rgba(127, 0, 127, 1)', 'rgba(191, 0, 63, 1)', 'rgba(255, 0, 0, 1)'
          ]);
        }

        setMapLoaded(true);

      } catch (error) {
        console.error('Google Maps failed, using fallback:', error);
        
        // Fallback: Custom SVG-based map
        if (mapElement && mounted) {
          mapElement.innerHTML = `
            <div style="position: relative; width: 100%; height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; overflow: hidden;">
              <!-- Philippines Map Background -->
              <svg viewBox="0 0 400 300" style="width: 100%; height: 100%; position: absolute;">
                <defs>
                  <linearGradient id="waterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#4f46e5;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#7c3aed;stop-opacity:1" />
                  </linearGradient>
                </defs>
                
                <!-- Water/Ocean -->
                <rect width="400" height="300" fill="url(#waterGrad)" />
                
                <!-- Philippines Landmass (simplified) -->
                <path d="M180 80 L200 70 L220 80 L240 90 L250 110 L260 130 L250 150 L240 170 L220 180 L200 190 L180 200 L160 190 L150 170 L160 150 L170 130 L180 110 Z" fill="#22c55e" opacity="0.8" />
                <path d="M280 100 L300 95 L320 105 L330 125 L325 145 L310 160 L295 155 L285 140 L280 120 Z" fill="#22c55e" opacity="0.8" />
                <path d="M120 140 L140 135 L155 145 L160 165 L150 185 L130 190 L115 180 L110 160 Z" fill="#22c55e" opacity="0.8" />
              </svg>
              
              <!-- Fraud Hotspots -->
              ${FRAUD_LOCATIONS.map((location, index) => `
                <div style="
                  position: absolute;
                  left: ${50 + (index * 20)}%;
                  top: ${30 + (index * 15)}%;
                  width: ${Math.max(20, location.incidents / 40)}px;
                  height: ${Math.max(20, location.incidents / 40)}px;
                  background: ${location.color};
                  border-radius: 50%;
                  border: 2px solid white;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: white;
                  font-size: 12px;
                  font-weight: bold;
                  cursor: pointer;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                  animation: pulse-${index} 2s infinite;
                " title="${location.region}: ${location.incidents} incidents">
                  ${location.incidents}
                </div>
              `).join('')}
              
              <!-- Legend -->
              <div style="
                position: absolute;
                bottom: 20px;
                left: 20px;
                background: rgba(255, 255, 255, 0.95);
                padding: 15px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                font-size: 14px;
              ">
                <div style="font-weight: bold; margin-bottom: 8px; color: #1f2937;">🚨 Fraud Risk Levels</div>
                <div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
                  <div style="width: 12px; height: 12px; background: #dc2626; border-radius: 50%;"></div>
                  <span style="color: #1f2937;">Critical (500+ incidents)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
                  <div style="width: 12px; height: 12px; background: #f59e0b; border-radius: 50%;"></div>
                  <span style="color: #1f2937;">High (100-499 incidents)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
                  <div style="width: 12px; height: 12px; background: #10b981; border-radius: 50%;"></div>
                  <span style="color: #1f2937;">Medium (<100 incidents)</span>
                </div>
              </div>

              <!-- Heatmap Overlay (if enabled) -->
              ${heatmapEnabled ? `
                <div style="
                  position: absolute;
                  top: 0;
                  left: 0;
                  width: 100%;
                  height: 100%;
                  background: radial-gradient(circle at 60% 40%, rgba(220, 38, 38, 0.3) 0%, transparent 50%),
                              radial-gradient(circle at 75% 65%, rgba(220, 38, 38, 0.2) 0%, transparent 40%),
                              radial-gradient(circle at 45% 75%, rgba(245, 158, 11, 0.25) 0%, transparent 35%),
                              radial-gradient(circle at 55% 85%, rgba(16, 185, 129, 0.2) 0%, transparent 30%);
                  pointer-events: none;
                "></div>
              ` : ''}
              
              <style>
                @keyframes pulse-0 { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
                @keyframes pulse-1 { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }
                @keyframes pulse-2 { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
                @keyframes pulse-3 { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
              </style>
            </div>
          `;
        }
        setMapLoaded(true);
      }
    };

    initializeMap();

    return () => {
      mounted = false;
    };
  }, []); // Run only once

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      {/* Heatmap Toggle */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: 1000,
        background: 'white',
        padding: '8px 12px',
        borderRadius: '6px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={heatmapEnabled}
            onChange={(e) => setHeatmapEnabled(e.target.checked)}
            style={{ margin: 0 }}
          />
          🔥 Heatmap
        </label>
      </div>

      {/* Map Container */}
      <div 
        id="fraud-map"
        style={{ 
          height: '100%', 
          width: '100%', 
          borderRadius: '16px',
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb'
        }} 
      />

      {/* Loading State */}
      {!mapLoaded && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '16px'
        }}>
          <div style={{ textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', animation: 'spin 2s linear infinite' }}>🌍</div>
            <div style={{ fontSize: '16px', fontWeight: '500' }}>Loading Fraud Map...</div>
            <div style={{ fontSize: '14px', marginTop: '8px' }}>Initializing secure connection</div>
          </div>
        </div>
      )}
    </div>
  );
};

  const GoogleMapsSection = ({ fraudClusters, handleClusterClick }: any) => (
    <div style={{ display: 'flex', gap: '2rem', height: '80vh' }}>
      {/* Main Map Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Map Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>
            🗺️ High Risk Locations - Philippines
          </h2>
        </div>
        
        {/* Google Maps Container */}
        <div style={{ 
          flex: 1, 
          background: 'white', 
          borderRadius: '16px', 
          border: '1px solid #e5e7eb',
          overflow: 'hidden'
        }}>
          <MapComponent />
        </div>
      </div>

      {/* Regional Summary Panel */}
      <div style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e5e7eb' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem' }}>
            📊 Regional Overview
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Object.entries(fraudClusters).map(([region, clusters]) => {
              const totalIncidents = clusters.reduce((sum: number, c: any) => sum + c.fraudCount, 0);
              const riskLevel = totalIncidents > 50 ? 'critical' : totalIncidents > 30 ? 'high' : 'medium';
              const riskColor = riskLevel === 'critical' ? '#dc2626' : riskLevel === 'high' ? '#f59e0b' : '#10b981';
              
              return (
                <div 
                  key={region}
                  onClick={() => handleClusterClick(clusters[0])}
                  style={{ 
                    padding: '0.75rem', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.borderColor = riskColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: '500', textTransform: 'capitalize' }}>
                      {region.replace('_', ' ')}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 'bold', color: riskColor }}>
                        {totalIncidents}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: riskColor, fontWeight: '600' }}>
                        {riskLevel.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '2rem', minHeight: '100vh', background: '#f9fafb' }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
            🕵️ Fraud Detection Analytics
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                background: isPolling ? '#10b981' : '#ef4444',
                animation: isPolling ? 'pulse 2s infinite' : 'none'
              }}></div>
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                {isPolling ? 'Live Streaming' : 'Offline'}
              </span>
            </div>
            <button
              onClick={() => setIsPolling(!isPolling)}
              style={{
                background: isPolling ? '#ef4444' : '#10b981',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
            >
              {isPolling ? '⏸️ Pause' : '▶️ Resume'}
            </button>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div style={{ marginBottom: '2rem', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', gap: '2rem' }}>
            {[
              { id: 'insights', label: 'Fraud Insights', icon: '🔍' },
              { id: 'events', label: 'Event Stream', icon: '🌊' },
              { id: 'drivers', label: 'High Risk Drivers', icon: '🚨' },
              { id: 'customers', label: 'High Risk Customers', icon: '⚠️' },
              { id: 'locations', label: 'High Risk Locations', icon: '🗺️' },
              { id: 'isolated', label: `Isolated Entities ${isolatedDrivers.length + isolatedCustomers.length > 0 ? `(${isolatedDrivers.length + isolatedCustomers.length})` : ''}`, icon: '🔒' },
              { id: 'settings', label: 'Settings', icon: '⚙️' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '1rem 0.5rem',
                  borderBottom: activeTab === tab.id ? '3px solid #3b82f6' : '3px solid transparent',
                  color: activeTab === tab.id ? '#3b82f6' : '#6b7280',
                  fontWeight: activeTab === tab.id ? '600' : '400',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

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
        
        {/* Tab Content */}
        {activeTab === 'insights' && renderInsightsTab()}
        
        {activeTab === 'drivers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                🚨 High Risk Drivers
              </h2>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                {highRiskDrivers.length} drivers flagged
              </div>
            </div>
            
            {/* Drivers List Table */}
            <div style={{ 
              background: 'white', 
              borderRadius: '12px', 
              border: '1px solid #e5e7eb',
              overflow: 'hidden'
            }}>
              {/* Table Header */}
              <div style={{ 
                background: '#f8fafc', 
                padding: '1rem 1.5rem', 
                borderBottom: '1px solid #e5e7eb',
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
                gap: '1rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#374151'
              }}>
                <div>Driver Details</div>
                <div style={{ textAlign: 'center' }}>Risk Score</div>
                <div style={{ textAlign: 'center' }}>Total Incidents</div>
                <div style={{ textAlign: 'center' }}>Recent (30d)</div>
                <div style={{ textAlign: 'center' }}>Status</div>
                <div style={{ textAlign: 'center' }}>Last Active</div>
              </div>
              
              {/* Table Rows */}
              {highRiskDrivers
                .sort((a, b) => b.riskScore - a.riskScore) // Sort by risk score descending
                .map((driver, index) => {
                  const riskColor = driver.riskLevel === 'critical' ? '#dc2626' : driver.riskLevel === 'high' ? '#d97706' : '#65a30d';
                  const riskBg = driver.riskLevel === 'critical' ? '#fef2f2' : driver.riskLevel === 'high' ? '#fef3c7' : '#ecfccb';
                  
                  return (
                    <div 
                      key={driver.id} 
                      style={{ 
                        padding: '1.25rem 1.5rem', 
                        borderBottom: index === highRiskDrivers.length - 1 ? 'none' : '1px solid #f3f4f6',
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
                        gap: '1rem',
                        alignItems: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        ':hover': { backgroundColor: '#f9fafb' }
                      }}
                      onClick={() => openDriverProfile(driver)}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {/* Driver Details */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ 
                          width: '48px', 
                          height: '48px', 
                          borderRadius: '50%', 
                          background: riskBg,
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontSize: '1.25rem'
                        }}>
                          🚗
                        </div>
                        <div>
                          <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.25rem' }}>
                            {driver.name}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                            {driver.id}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                            License: {driver.licenseNumber}
                          </div>
                        </div>
                      </div>
                      
                      {/* Risk Score */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ 
                          display: 'inline-block',
                          background: riskColor, 
                          color: 'white', 
                          padding: '0.375rem 0.75rem', 
                          borderRadius: '20px', 
                          fontSize: '0.875rem', 
                          fontWeight: '700',
                          marginBottom: '0.25rem'
                        }}>
                          {driver.riskScore.toFixed(1)}/10
                        </div>
                        <div style={{ fontSize: '0.75rem', color: riskColor, fontWeight: '600' }}>
                          {driver.riskLevel.toUpperCase()}
                        </div>
                      </div>
                      
                      {/* Total Incidents */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>
                          {driver.totalIncidents}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          incidents
                        </div>
                      </div>
                      
                      {/* Recent Incidents */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#dc2626' }}>
                          {driver.recentIncidents}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          this month
                        </div>
                      </div>
                      
                      {/* Verification Status */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ 
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: driver.verificationStatus === 'verified' ? '#10b981' : driver.verificationStatus === 'pending' ? '#d97706' : '#dc2626'
                        }}>
                          {driver.verificationStatus === 'verified' ? '✅ Verified' : driver.verificationStatus === 'pending' ? '⏳ Pending' : '❌ Failed'}
                        </div>
                      </div>
                      
                      {/* Last Activity */}
                      <div style={{ textAlign: 'center', fontSize: '0.875rem', color: '#6b7280' }}>
                        {new Date(driver.lastActivity).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
            
            {/* Quick Stats Summary */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '1rem',
              marginTop: '1rem'
            }}>
              <div style={{ 
                background: 'white', 
                padding: '1.5rem', 
                borderRadius: '12px', 
                border: '1px solid #e5e7eb',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc2626', marginBottom: '0.5rem' }}>
                  {highRiskDrivers.filter(d => d.riskLevel === 'critical').length}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Critical Risk Drivers</div>
              </div>
              
              <div style={{ 
                background: 'white', 
                padding: '1.5rem', 
                borderRadius: '12px', 
                border: '1px solid #e5e7eb',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#d97706', marginBottom: '0.5rem' }}>
                  {highRiskDrivers.filter(d => d.riskLevel === 'high').length}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>High Risk Drivers</div>
              </div>
              
              <div style={{ 
                background: 'white', 
                padding: '1.5rem', 
                borderRadius: '12px', 
                border: '1px solid #e5e7eb',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '0.5rem' }}>
                  {highRiskDrivers.filter(d => d.verificationStatus === 'failed').length}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Failed Verification</div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'customers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                ⚠️ High Risk Customers
              </h2>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                {highRiskCustomers.length} customers flagged
              </div>
            </div>
            
            {/* Customers List Table */}
            <div style={{ 
              background: 'white', 
              borderRadius: '12px', 
              border: '1px solid #e5e7eb',
              overflow: 'hidden'
            }}>
              {/* Table Header */}
              <div style={{ 
                background: '#f8fafc', 
                padding: '1rem 1.5rem', 
                borderBottom: '1px solid #e5e7eb',
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
                gap: '1rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#374151'
              }}>
                <div>Customer Details</div>
                <div style={{ textAlign: 'center' }}>Risk Score</div>
                <div style={{ textAlign: 'center' }}>Complaints</div>
                <div style={{ textAlign: 'center' }}>Payment Issues</div>
                <div style={{ textAlign: 'center' }}>Account Age</div>
                <div style={{ textAlign: 'center' }}>Last Active</div>
              </div>
              
              {/* Table Rows */}
              {highRiskCustomers
                .sort((a, b) => b.riskScore - a.riskScore) // Sort by risk score descending
                .map((customer, index) => {
                  const riskColor = customer.riskLevel === 'critical' ? '#dc2626' : customer.riskLevel === 'high' ? '#d97706' : '#65a30d';
                  const riskBg = customer.riskLevel === 'critical' ? '#fef2f2' : customer.riskLevel === 'high' ? '#fef3c7' : '#ecfccb';
                  
                  return (
                    <div 
                      key={customer.id} 
                      style={{ 
                        padding: '1.25rem 1.5rem', 
                        borderBottom: index === highRiskCustomers.length - 1 ? 'none' : '1px solid #f3f4f6',
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
                        gap: '1rem',
                        alignItems: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onClick={() => openCustomerProfile(customer)}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {/* Customer Details */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ 
                          width: '48px', 
                          height: '48px', 
                          borderRadius: '50%', 
                          background: riskBg,
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontSize: '1.25rem'
                        }}>
                          👤
                        </div>
                        <div>
                          <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.25rem' }}>
                            {customer.name}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                            {customer.id}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                            {customer.email}
                          </div>
                        </div>
                      </div>
                      
                      {/* Risk Score */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ 
                          display: 'inline-block',
                          background: riskColor, 
                          color: 'white', 
                          padding: '0.375rem 0.75rem', 
                          borderRadius: '20px', 
                          fontSize: '0.875rem', 
                          fontWeight: '700',
                          marginBottom: '0.25rem'
                        }}>
                          {customer.riskScore.toFixed(1)}/10
                        </div>
                        <div style={{ fontSize: '0.75rem', color: riskColor, fontWeight: '600' }}>
                          {customer.riskLevel.toUpperCase()}
                        </div>
                      </div>
                      
                      {/* Total Complaints */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>
                          {customer.totalComplaints}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          complaints
                        </div>
                      </div>
                      
                      {/* Payment Issues */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#dc2626' }}>
                          {customer.paymentIssues}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          issues
                        </div>
                      </div>
                      
                      {/* Account Age */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937' }}>
                          {customer.accountAge.toFixed(1)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          months
                        </div>
                      </div>
                      
                      {/* Last Activity */}
                      <div style={{ textAlign: 'center', fontSize: '0.875rem', color: '#6b7280' }}>
                        {new Date(customer.lastActivity).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
            
            {/* Quick Stats Summary */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '1rem',
              marginTop: '1rem'
            }}>
              <div style={{ 
                background: 'white', 
                padding: '1.5rem', 
                borderRadius: '12px', 
                border: '1px solid #e5e7eb',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc2626', marginBottom: '0.5rem' }}>
                  {highRiskCustomers.filter(c => c.riskLevel === 'critical').length}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Critical Risk Customers</div>
              </div>
              
              <div style={{ 
                background: 'white', 
                padding: '1.5rem', 
                borderRadius: '12px', 
                border: '1px solid #e5e7eb',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#d97706', marginBottom: '0.5rem' }}>
                  {highRiskCustomers.filter(c => c.riskLevel === 'high').length}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>High Risk Customers</div>
              </div>
              
              <div style={{ 
                background: 'white', 
                padding: '1.5rem', 
                borderRadius: '12px', 
                border: '1px solid #e5e7eb',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '0.5rem' }}>
                  {Math.round(highRiskCustomers.reduce((sum, c) => sum + c.accountAge, 0) / highRiskCustomers.length * 10) / 10}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Avg Account Age (months)</div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'locations' && (
          <GoogleMapsSection 
            fraudClusters={fraudClusters} 
            handleClusterClick={handleClusterClick} 
          />
        )}

        {activeTab === 'isolated' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                🔒 Isolated Entities Management
              </h2>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ fontSize: '0.9rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ background: '#dc2626', color: 'white', padding: '0.25rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem' }}>
                    {isolatedDrivers.length}
                  </span>
                  Drivers
                </div>
                <div style={{ fontSize: '0.9rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ background: '#f59e0b', color: 'white', padding: '0.25rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem' }}>
                    {isolatedCustomers.length}
                  </span>
                  Customers
                </div>
              </div>
            </div>

            {isolatedDrivers.length === 0 && isolatedCustomers.length === 0 && (
              <div style={{ 
                background: 'white', 
                borderRadius: '16px', 
                padding: '3rem',
                border: '1px solid #e5e7eb',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.5rem' }}>
                  No Isolated Entities
                </h3>
                <p style={{ color: '#6b7280', margin: 0 }}>
                  Use the High Risk Locations tab to isolate drivers and customers from fraud clusters.
                </p>
              </div>
            )}

            {/* Isolated Drivers Section */}
            {isolatedDrivers.length > 0 && (
              <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', border: '1px solid #e5e7eb' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  🚨 Isolated Drivers ({isolatedDrivers.length})
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                  {isolatedDrivers.map((driver) => (
                    <div key={driver.id} style={{ 
                      background: '#fef2f2', 
                      border: '2px solid #dc2626', 
                      borderRadius: '12px', 
                      padding: '1.5rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                        <div>
                          <h4 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>{driver.name}</h4>
                          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: '0.25rem 0' }}>{driver.id}</p>
                          <div style={{ fontSize: '0.8rem', color: '#374151', marginTop: '0.5rem' }}>
                            <div><strong>Isolated From:</strong> {driver.isolatedFrom}</div>
                            <div><strong>Reason:</strong> {driver.isolationReason}</div>
                            <div><strong>Risk Score:</strong> {driver.riskScore.toFixed(1)}/10</div>
                          </div>
                        </div>
                        <div style={{ 
                          background: driver.status === 'isolated' ? '#dc2626' : '#10b981',
                          color: 'white',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '600'
                        }}>
                          {driver.status?.toUpperCase() || 'ISOLATED'}
                        </div>
                      </div>
                      
                      {/* Action History */}
                      {driver.actions?.length > 0 && (
                        <div style={{ marginBottom: '1rem', background: 'white', padding: '1rem', borderRadius: '8px' }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>Action History:</div>
                          {driver.actions.slice(-2).map((action: any, index: number) => (
                            <div key={index} style={{ fontSize: '0.8rem', color: '#374151', marginBottom: '0.25rem' }}>
                              • {action.description}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Action Buttons */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <button
                          onClick={() => performEntityAction('driver', driver.id, 'Suspend Account')}
                          style={{
                            background: '#dc2626',
                            color: 'white',
                            border: 'none',
                            padding: '0.6rem',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          🚫 Suspend Account
                        </button>
                        <button
                          onClick={() => performEntityAction('driver', driver.id, 'Restrict Earnings')}
                          style={{
                            background: '#f59e0b',
                            color: 'white',
                            border: 'none',
                            padding: '0.6rem',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          💰 Restrict Earnings
                        </button>
                        <button
                          onClick={() => performEntityAction('driver', driver.id, 'Require Re-verification')}
                          style={{
                            background: '#8b5cf6',
                            color: 'white',
                            border: 'none',
                            padding: '0.6rem',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          🗺️ Re-verification
                        </button>
                        <button
                          onClick={() => performEntityAction('driver', driver.id, 'Start Investigation')}
                          style={{
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            padding: '0.6rem',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          🔍 Investigation
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Isolated Customers Section */}
            {isolatedCustomers.length > 0 && (
              <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', border: '1px solid #e5e7eb' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  ⚠️ Isolated Customers ({isolatedCustomers.length})
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                  {isolatedCustomers.map((customer) => (
                    <div key={customer.id} style={{ 
                      background: '#fef3c7', 
                      border: '2px solid #f59e0b', 
                      borderRadius: '12px', 
                      padding: '1.5rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                        <div>
                          <h4 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>{customer.name}</h4>
                          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: '0.25rem 0' }}>{customer.id}</p>
                          <div style={{ fontSize: '0.8rem', color: '#374151', marginTop: '0.5rem' }}>
                            <div><strong>Isolated From:</strong> {customer.isolatedFrom}</div>
                            <div><strong>Reason:</strong> {customer.isolationReason}</div>
                            <div><strong>Risk Score:</strong> {customer.riskScore.toFixed(1)}/10</div>
                          </div>
                        </div>
                        <div style={{ 
                          background: customer.status === 'isolated' ? '#f59e0b' : '#10b981',
                          color: 'white',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '600'
                        }}>
                          {customer.status?.toUpperCase() || 'ISOLATED'}
                        </div>
                      </div>
                      
                      {/* Action History */}
                      {customer.actions?.length > 0 && (
                        <div style={{ marginBottom: '1rem', background: 'white', padding: '1rem', borderRadius: '8px' }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>Action History:</div>
                          {customer.actions.slice(-2).map((action: any, index: number) => (
                            <div key={index} style={{ fontSize: '0.8rem', color: '#374151', marginBottom: '0.25rem' }}>
                              • {action.description}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Action Buttons */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <button
                          onClick={() => performEntityAction('customer', customer.id, 'Suspend Account')}
                          style={{
                            background: '#dc2626',
                            color: 'white',
                            border: 'none',
                            padding: '0.6rem',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          🚫 Suspend Account
                        </button>
                        <button
                          onClick={() => performEntityAction('customer', customer.id, 'Restrict Payments')}
                          style={{
                            background: '#f59e0b',
                            color: 'white',
                            border: 'none',
                            padding: '0.6rem',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          💳 Restrict Payments
                        </button>
                        <button
                          onClick={() => performEntityAction('customer', customer.id, 'Require Identity Verification')}
                          style={{
                            background: '#8b5cf6',
                            color: 'white',
                            border: 'none',
                            padding: '0.6rem',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          🆔 ID Verification
                        </button>
                        <button
                          onClick={() => performEntityAction('customer', customer.id, 'Start Investigation')}
                          style={{
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            padding: '0.6rem',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          🔍 Investigation
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'events' && (
          <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                🌊 Real-time Fraud Event Stream
              </h2>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                Last update: {new Date(lastEventTime).toLocaleTimeString()}
              </div>
            </div>
            
            <div style={{ maxHeight: '600px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {fraudEvents.map((event) => {
                const colors = getEventColor(event.severity);
                return (
                  <div key={event.id} style={{
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    padding: '1rem',
                    animation: Date.now() - new Date(event.timestamp).getTime() < 5000 ? 'fadeIn 0.5s ease-in' : 'none'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '1.2rem' }}>{colors.icon}</span>
                          <span style={{ 
                            background: colors.border,
                            color: 'white',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: '600'
                          }}>
                            {event.severity.toUpperCase()}
                          </span>
                          <span style={{ color: colors.text, fontWeight: '600' }}>
                            {event.type.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <p style={{ color: '#374151', margin: '0.5rem 0' }}>{event.description}</p>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280', display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                          <span>🚗 {event.vehicleId}</span>
                          <span>👨‍✈️ {event.driverId}</span>
                          {event.riderId && <span>👤 {event.riderId}</span>}
                          {event.amount && <span>💰 ${event.amount.toFixed(2)}</span>}
                          <span>🎯 {(event.confidence * 100).toFixed(0)}% confidence</span>
                          <span>⚠️ {event.riskScore.toFixed(1)}/10 risk</span>
                          <span>🕐 {formatTimestamp(event.timestamp)}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                        <button
                          style={{
                            background: '#6b7280',
                            color: 'white',
                            border: 'none',
                            padding: '0.5rem 1rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                          onClick={() => openEventDetails(event)}
                        >
                          📋 Details
                        </button>
                        <button
                          style={{
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            padding: '0.5rem 1rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            setFraudEvents(events => events.map(e => 
                              e.id === event.id ? { ...e, status: 'investigating' } : e
                            ));
                            setMessage(`🔍 Started investigating ${event.type} for ${event.vehicleId}`);
                            setTimeout(() => setMessage(''), 3000);
                          }}
                        >
                          Investigate
                        </button>
                        <button
                          style={{
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            padding: '0.5rem 1rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            setFraudEvents(events => events.map(e => 
                              e.id === event.id ? { ...e, status: 'resolved' } : e
                            ));
                            setMessage(`✅ Resolved ${event.type} for ${event.vehicleId}`);
                            setTimeout(() => setMessage(''), 3000);
                          }}
                        >
                          Resolve
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                ⚙️ System Settings
              </h2>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                Internal Tool Configuration
              </div>
            </div>

            {/* Settings Navigation */}
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '1rem' }}>
              {[
                { id: 'api', label: 'API Connections', icon: '🔗' },
                { id: 'notifications', label: 'Notifications', icon: '🔔' },
                { id: 'system', label: 'System', icon: '⚙️' },
                { id: 'users', label: 'User Management', icon: '👥' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSettingsTab(tab.id)}
                  style={{
                    background: settingsTab === tab.id ? '#3b82f6' : 'transparent',
                    color: settingsTab === tab.id ? 'white' : '#6b7280',
                    border: settingsTab === tab.id ? 'none' : '1px solid #e5e7eb',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* API Connections Tab */}
            {settingsTab === 'api' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '1.5rem' }}>
                    🔗 API Endpoint Configuration
                  </h3>
                  
                  {/* API Connection Cards */}
                  <div style={{ display: 'grid', gap: '1.5rem' }}>
                    {Object.entries(apiSettings).map(([key, api]) => (
                      <div key={key} style={{ 
                        border: '1px solid #e5e7eb', 
                        borderRadius: '8px', 
                        padding: '1.5rem',
                        background: '#f9fafb'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <h4 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                            {key.replace('Api', '').charAt(0).toUpperCase() + key.replace('Api', '').slice(1)} API
                          </h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: api.status === 'connected' ? '#10b981' : api.status === 'error' ? '#dc2626' : '#6b7280'
                            }}></div>
                            <span style={{ 
                              fontSize: '0.875rem', 
                              color: api.status === 'connected' ? '#10b981' : api.status === 'error' ? '#dc2626' : '#6b7280',
                              fontWeight: '600'
                            }}>
                              {api.status.charAt(0).toUpperCase() + api.status.slice(1)}
                            </span>
                          </div>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                              Endpoint URL
                            </label>
                            <input
                              type="text"
                              value={api.endpoint}
                              onChange={(e) => setApiSettings(prev => ({
                                ...prev,
                                [key]: { ...prev[key as keyof typeof prev], endpoint: e.target.value }
                              }))}
                              style={{ 
                                width: '100%', 
                                padding: '0.75rem', 
                                border: '1px solid #d1d5db', 
                                borderRadius: '6px',
                                fontSize: '0.875rem'
                              }}
                              placeholder="Enter API endpoint"
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                              API Key
                            </label>
                            <input
                              type="password"
                              value={api.apiKey}
                              onChange={(e) => setApiSettings(prev => ({
                                ...prev,
                                [key]: { ...prev[key as keyof typeof prev], apiKey: e.target.value }
                              }))}
                              style={{ 
                                width: '100%', 
                                padding: '0.75rem', 
                                border: '1px solid #d1d5db', 
                                borderRadius: '6px',
                                fontSize: '0.875rem'
                              }}
                              placeholder="Enter API key"
                            />
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                              <input
                                type="checkbox"
                                checked={api.enabled}
                                onChange={(e) => setApiSettings(prev => ({
                                  ...prev,
                                  [key]: { ...prev[key as keyof typeof prev], enabled: e.target.checked }
                                }))}
                              />
                              Enabled
                            </label>
                            {key !== 'fraudDetectionApi' && (
                              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                Sync: {api.syncInterval / 1000}s
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={() => {
                                // Test API connection
                                setApiSettings(prev => ({
                                  ...prev,
                                  [key]: { ...prev[key as keyof typeof prev], status: 'connected' }
                                }));
                                setMessage(`✅ ${key} connection successful`);
                                setTimeout(() => setMessage(''), 3000);
                              }}
                              style={{
                                background: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                padding: '0.5rem 1rem',
                                borderRadius: '6px',
                                fontSize: '0.875rem',
                                cursor: 'pointer'
                              }}
                            >
                              Test Connection
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Data Sync Status */}
                <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '1.5rem' }}>
                    📊 Data Synchronization Status
                  </h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div style={{ textAlign: 'center', padding: '1rem', background: '#f0fdf4', borderRadius: '8px' }}>
                      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#16a34a' }}>2.3k</div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Active Drivers</div>
                      <div style={{ fontSize: '0.75rem', color: '#10b981' }}>Last sync: 2m ago</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '1rem', background: '#eff6ff', borderRadius: '8px' }}>
                      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2563eb' }}>15.7k</div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Active Customers</div>
                      <div style={{ fontSize: '0.75rem', color: '#3b82f6' }}>Last sync: 5m ago</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '1rem', background: '#fef3c7', borderRadius: '8px' }}>
                      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#d97706' }}>847</div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Live Events/hr</div>
                      <div style={{ fontSize: '0.75rem', color: '#f59e0b' }}>Streaming</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {settingsTab === 'notifications' && (
              <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '1.5rem' }}>
                  🔔 Alert & Notification Settings
                </h3>
                
                <div style={{ display: 'grid', gap: '2rem' }}>
                  {/* Alert Thresholds */}
                  <div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem' }}>
                      Risk Score Thresholds
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                          Critical Threshold (0-10)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.1"
                          value={notificationSettings.criticalThreshold}
                          onChange={(e) => setNotificationSettings(prev => ({
                            ...prev,
                            criticalThreshold: parseFloat(e.target.value)
                          }))}
                          style={{ 
                            width: '100%', 
                            padding: '0.75rem', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '6px' 
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                          High Threshold (0-10)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.1"
                          value={notificationSettings.highThreshold}
                          onChange={(e) => setNotificationSettings(prev => ({
                            ...prev,
                            highThreshold: parseFloat(e.target.value)
                          }))}
                          style={{ 
                            width: '100%', 
                            padding: '0.75rem', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '6px' 
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notification Methods */}
                  <div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem' }}>
                      Notification Methods
                    </h4>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                        <input
                          type="checkbox"
                          checked={notificationSettings.emailAlerts}
                          onChange={(e) => setNotificationSettings(prev => ({
                            ...prev,
                            emailAlerts: e.target.checked
                          }))}
                        />
                        📧 Email Alerts (Critical incidents)
                      </label>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1rem', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                          <input
                            type="checkbox"
                            checked={notificationSettings.slackIntegration}
                            onChange={(e) => setNotificationSettings(prev => ({
                              ...prev,
                              slackIntegration: e.target.checked
                            }))}
                          />
                          💬 Slack Integration
                        </label>
                        <input
                          type="text"
                          placeholder="Slack webhook URL"
                          value={notificationSettings.slackWebhook}
                          onChange={(e) => setNotificationSettings(prev => ({
                            ...prev,
                            slackWebhook: e.target.value
                          }))}
                          style={{ 
                            padding: '0.75rem', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '6px',
                            fontSize: '0.875rem'
                          }}
                        />
                      </div>
                      
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                        <input
                          type="checkbox"
                          checked={notificationSettings.realTimeAlerts}
                          onChange={(e) => setNotificationSettings(prev => ({
                            ...prev,
                            realTimeAlerts: e.target.checked
                          }))}
                        />
                        ⚡ Real-time Browser Notifications
                      </label>
                    </div>
                  </div>

                  {/* Report Settings */}
                  <div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem' }}>
                      Automated Reports
                    </h4>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                        <input
                          type="checkbox"
                          checked={notificationSettings.dailyReports}
                          onChange={(e) => setNotificationSettings(prev => ({
                            ...prev,
                            dailyReports: e.target.checked
                          }))}
                        />
                        📊 Daily Fraud Summary Reports
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                        <input
                          type="checkbox"
                          checked={notificationSettings.weeklyReports}
                          onChange={(e) => setNotificationSettings(prev => ({
                            ...prev,
                            weeklyReports: e.target.checked
                          }))}
                        />
                        📈 Weekly Trend Analysis Reports
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* System Tab */}
            {settingsTab === 'system' && (
              <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '1.5rem' }}>
                  ⚙️ System Configuration
                </h3>
                
                <div style={{ display: 'grid', gap: '2rem' }}>
                  {/* Performance Settings */}
                  <div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem' }}>
                      Performance Settings
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                          Auto Refresh Interval (seconds)
                        </label>
                        <select
                          value={systemSettings.autoRefreshInterval}
                          onChange={(e) => setSystemSettings(prev => ({
                            ...prev,
                            autoRefreshInterval: parseInt(e.target.value)
                          }))}
                          style={{ 
                            width: '100%', 
                            padding: '0.75rem', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '6px' 
                          }}
                        >
                          <option value={15}>15 seconds</option>
                          <option value={30}>30 seconds</option>
                          <option value={60}>1 minute</option>
                          <option value={300}>5 minutes</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                          Max Events Display
                        </label>
                        <input
                          type="number"
                          min="50"
                          max="1000"
                          step="50"
                          value={systemSettings.maxEventsDisplay}
                          onChange={(e) => setSystemSettings(prev => ({
                            ...prev,
                            maxEventsDisplay: parseInt(e.target.value)
                          }))}
                          style={{ 
                            width: '100%', 
                            padding: '0.75rem', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '6px' 
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Security Settings */}
                  <div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem' }}>
                      Security & Privacy
                    </h4>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                          Data Retention Period (days)
                        </label>
                        <select
                          value={systemSettings.dataRetentionDays}
                          onChange={(e) => setSystemSettings(prev => ({
                            ...prev,
                            dataRetentionDays: parseInt(e.target.value)
                          }))}
                          style={{ 
                            width: '100%', 
                            padding: '0.75rem', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '6px' 
                          }}
                        >
                          <option value={30}>30 days</option>
                          <option value={90}>90 days</option>
                          <option value={180}>6 months</option>
                          <option value={365}>1 year</option>
                        </select>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                        <input
                          type="checkbox"
                          checked={systemSettings.enableGeoBlocking}
                          onChange={(e) => setSystemSettings(prev => ({
                            ...prev,
                            enableGeoBlocking: e.target.checked
                          }))}
                        />
                        🌍 Enable Geographic Risk Blocking
                      </label>
                    </div>
                  </div>

                  {/* Debug Settings */}
                  <div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem' }}>
                      Development & Debug
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                          Log Level
                        </label>
                        <select
                          value={systemSettings.logLevel}
                          onChange={(e) => setSystemSettings(prev => ({
                            ...prev,
                            logLevel: e.target.value as 'debug' | 'info' | 'warn' | 'error'
                          }))}
                          style={{ 
                            width: '100%', 
                            padding: '0.75rem', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '6px' 
                          }}
                        >
                          <option value="error">Error</option>
                          <option value="warn">Warning</option>
                          <option value="info">Info</option>
                          <option value="debug">Debug</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'end' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                          <input
                            type="checkbox"
                            checked={systemSettings.debugMode}
                            onChange={(e) => setSystemSettings(prev => ({
                              ...prev,
                              debugMode: e.target.checked
                            }))}
                          />
                          🐛 Enable Debug Mode
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* User Management Tab */}
            {settingsTab === 'users' && (
              <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                    👥 User Management
                  </h3>
                  <button
                    style={{
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      padding: '0.75rem 1rem',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    ➕ Add User
                  </button>
                </div>
                
                {/* User List */}
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {[
                    { name: 'Sarah Johnson', role: 'super_admin', email: 'sarah@company.com', status: 'active', lastActive: '2 minutes ago' },
                    { name: 'Mike Chen', role: 'fraud_analyst', email: 'mike@company.com', status: 'active', lastActive: '5 minutes ago' },
                    { name: 'Lisa Rodriguez', role: 'fleet_manager', email: 'lisa@company.com', status: 'inactive', lastActive: '2 hours ago' },
                    { name: 'David Kim', role: 'auditor', email: 'david@company.com', status: 'active', lastActive: '1 hour ago' }
                  ].map((user, index) => (
                    <div key={index} style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', 
                      gap: '1rem', 
                      alignItems: 'center',
                      padding: '1rem', 
                      border: '1px solid #e5e7eb', 
                      borderRadius: '8px' 
                    }}>
                      <div>
                        <div style={{ fontWeight: '600', color: '#1f2937' }}>{user.name}</div>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{user.email}</div>
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {user.role.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </div>
                      <div>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '20px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          backgroundColor: user.status === 'active' ? '#ecfccb' : '#fef2f2',
                          color: user.status === 'active' ? '#65a30d' : '#dc2626'
                        }}>
                          {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {user.lastActive}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        Access: All
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          style={{
                            background: '#f59e0b',
                            color: 'white',
                            border: 'none',
                            padding: '0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          Edit
                        </button>
                        <button
                          style={{
                            background: '#dc2626',
                            color: 'white',
                            border: 'none',
                            padding: '0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Permission Matrix */}
                <div style={{ marginTop: '2rem' }}>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem' }}>
                    Role Permissions Matrix
                  </h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc' }}>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Permission</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Super Admin</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Fraud Analyst</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Fleet Manager</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Auditor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ['View Dashboard', '✅', '✅', '✅', '✅'],
                          ['Investigate Events', '✅', '✅', '❌', '✅'],
                          ['Isolate Entities', '✅', '✅', '❌', '❌'],
                          ['Modify Settings', '✅', '❌', '❌', '❌'],
                          ['User Management', '✅', '❌', '❌', '❌'],
                          ['Export Data', '✅', '✅', '✅', '✅'],
                          ['API Configuration', '✅', '❌', '❌', '❌']
                        ].map(([permission, ...roles], index) => (
                          <tr key={index}>
                            <td style={{ padding: '0.75rem', borderBottom: '1px solid #f3f4f6', fontWeight: '500' }}>
                              {permission}
                            </td>
                            {roles.map((role, roleIndex) => (
                              <td key={roleIndex} style={{ 
                                padding: '0.75rem', 
                                textAlign: 'center', 
                                borderBottom: '1px solid #f3f4f6',
                                fontSize: '1.2rem'
                              }}>
                                {role}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Save Settings Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button
                onClick={() => {
                  setMessage('💾 Settings saved successfully');
                  setTimeout(() => setMessage(''), 3000);
                }}
                style={{
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 2rem',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                💾 Save All Settings
              </button>
            </div>
          </div>
        )}
        
      </div>
      
      {/* Event Details Modal */}
      {selectedEvent && showEventDetails && (
        <div style={{ 
          position: 'fixed', 
          inset: '0', 
          background: 'rgba(0, 0, 0, 0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 50
        }}>
          <div style={{ 
            background: 'white', 
            borderRadius: '12px', 
            padding: '2rem', 
            maxWidth: '800px', 
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                📋 Event Details: {selectedEvent.id}
              </h2>
              <button
                onClick={() => setShowEventDetails(false)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  fontSize: '1.5rem', 
                  cursor: 'pointer', 
                  color: '#6b7280' 
                }}
              >
                ✕
              </button>
            </div>
            
            {/* Event Summary */}
            <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem' }}>Event Information</h3>
                  <div style={{ space: '0.5rem' }}>
                    <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}><strong>Type:</strong> {selectedEvent.type.replace('_', ' ').toUpperCase()}</p>
                    <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}><strong>Severity:</strong> <span style={{ color: getEventColor(selectedEvent.severity).text }}>{selectedEvent.severity.toUpperCase()}</span></p>
                    <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}><strong>Vehicle:</strong> {selectedEvent.vehicleId}</p>
                    <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}><strong>Driver:</strong> {selectedEvent.driverId}</p>
                    {selectedEvent.riderId && <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}><strong>Rider:</strong> {selectedEvent.riderId}</p>}
                    {selectedEvent.amount && <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}><strong>Amount:</strong> ${selectedEvent.amount.toFixed(2)}</p>}
                  </div>
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem' }}>Risk Assessment</h3>
                  <div style={{ space: '0.5rem' }}>
                    <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}><strong>Confidence:</strong> {(selectedEvent.confidence * 100).toFixed(1)}%</p>
                    <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}><strong>Risk Score:</strong> {selectedEvent.riskScore.toFixed(1)}/10</p>
                    <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}><strong>Location:</strong> {selectedEvent.location.lat.toFixed(4)}, {selectedEvent.location.lng.toFixed(4)}</p>
                    <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}><strong>Status:</strong> {selectedEvent.status.toUpperCase()}</p>
                    <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}><strong>Detected:</strong> {formatTimestamp(selectedEvent.timestamp)}</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Why This Happened */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem' }}>
                🔍 Why This Event Was Detected
              </h3>
              <div style={{ background: '#fef3c7', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #d97706' }}>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#92400e' }}>
                  <strong>Event Description:</strong> {selectedEvent.description}
                </p>
                <div style={{ fontSize: '0.85rem', color: '#92400e' }}>
                  <strong>Detection Reasons:</strong>
                  <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                    {selectedEvent.type === 'fare_manipulation' && [
                      'Route taken was 47% longer than optimal path',
                      'Wait time artificially extended by 12 minutes',
                      'Driver disabled GPS tracking for 3 minutes during trip',
                      'Fare calculation exceeded normal variance by 340%'
                    ].map((reason, index) => (
                      <li key={index} style={{ marginBottom: '0.25rem' }}>{reason}</li>
                    ))}
                    {selectedEvent.type === 'gps_spoofing' && [
                      'Vehicle appeared to jump 2.3 miles instantly',
                      'Speed readings showed impossible acceleration',
                      'GPS coordinates inconsistent with road network',
                      'Location accuracy dropped to 0 meters multiple times'
                    ].map((reason, index) => (
                      <li key={index} style={{ marginBottom: '0.25rem' }}>{reason}</li>
                    ))}
                    {selectedEvent.type === 'identity_fraud' && [
                      'Driver photo verification failed with 43% match',
                      'Biometric patterns inconsistent with account history',
                      'Driving behavior significantly different from baseline',
                      'Account accessed from new device and location'
                    ].map((reason, index) => (
                      <li key={index} style={{ marginBottom: '0.25rem' }}>{reason}</li>
                    ))}
                    {selectedEvent.type === 'payment_fraud' && [
                      'Card reader hardware modification detected',
                      'Multiple payment failures with different cards',
                      'Transaction processing time exceeded normal range',
                      'Unusual payment device behavior logged'
                    ].map((reason, index) => (
                      <li key={index} style={{ marginBottom: '0.25rem' }}>{reason}</li>
                    ))}
                    {selectedEvent.type === 'rating_manipulation' && [
                      'Coordinated rating pattern with other accounts',
                      'Rating submitted before trip completion',
                      'IP address linked to known rating farms',
                      'Behavioral pattern matches bot activity'
                    ].map((reason, index) => (
                      <li key={index} style={{ marginBottom: '0.25rem' }}>{reason}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            
            {/* Audit Trail */}
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem' }}>
                📜 Audit Trail
              </h3>
              <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '1rem' }}>
                {generateEventAuditTrail(selectedEvent).map((entry, index) => (
                  <div key={entry.id} style={{ 
                    display: 'flex', 
                    alignItems: 'start', 
                    gap: '1rem',
                    marginBottom: index < generateEventAuditTrail(selectedEvent).length - 1 ? '1.5rem' : '0',
                    paddingBottom: index < generateEventAuditTrail(selectedEvent).length - 1 ? '1rem' : '0',
                    borderBottom: index < generateEventAuditTrail(selectedEvent).length - 1 ? '1px solid #e5e7eb' : 'none'
                  }}>
                    <div style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      background: '#3b82f6',
                      marginTop: '0.5rem'
                    }}></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.25rem' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>{entry.action}</h4>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{formatTimestamp(entry.timestamp)}</span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: '#374151', margin: '0.25rem 0' }}>{entry.details}</p>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#6b7280' }}>
                        <span><strong>User:</strong> {entry.user}</span>
                        {entry.system && <span><strong>System:</strong> {entry.system}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Driver Profile Modal */}
      {selectedDriver && showDriverProfile && (
        <div style={{ 
          position: 'fixed', 
          inset: '0', 
          background: 'rgba(0, 0, 0, 0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 50
        }}>
          <div style={{ 
            background: 'white', 
            borderRadius: '12px', 
            padding: '2rem', 
            maxWidth: '900px', 
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                🚨 High Risk Driver Profile
              </h2>
              <button
                onClick={() => setShowDriverProfile(false)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  fontSize: '1.5rem', 
                  cursor: 'pointer', 
                  color: '#6b7280' 
                }}
              >
                ✕
              </button>
            </div>
            
            {/* Driver Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', marginBottom: '2rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  width: '120px', 
                  height: '120px', 
                  borderRadius: '50%', 
                  background: selectedDriver.riskLevel === 'critical' ? '#fef2f2' : '#fef3c7',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: '3rem',
                  margin: '0 auto 1rem auto'
                }}>
                  🚗
                </div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: '600', color: '#1f2937', margin: '0 0 0.5rem 0' }}>{selectedDriver.name}</h3>
                <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: '0.25rem 0' }}>{selectedDriver.id}</p>
                <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0 }}>License: {selectedDriver.licenseNumber}</p>
              </div>
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ textAlign: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: selectedDriver.riskLevel === 'critical' ? '#dc2626' : '#d97706' }}>
                      {selectedDriver.riskScore.toFixed(1)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Risk Score</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>{selectedDriver.totalIncidents}</div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Total Incidents</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#dc2626' }}>{selectedDriver.recentIncidents}</div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Recent (30d)</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}><strong>Account Age:</strong> {selectedDriver.accountAge.toFixed(1)} months</p>
                    <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}><strong>Vehicle ID:</strong> {selectedDriver.vehicleId || 'N/A'}</p>
                  </div>
                  <div>
                    <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}><strong>Verification:</strong> 
                      <span style={{ 
                        color: selectedDriver.verificationStatus === 'verified' ? '#10b981' : selectedDriver.verificationStatus === 'pending' ? '#d97706' : '#dc2626',
                        marginLeft: '0.5rem'
                      }}>
                        {selectedDriver.verificationStatus === 'verified' ? '✅ Verified' : selectedDriver.verificationStatus === 'pending' ? '⏳ Pending' : '❌ Failed'}
                      </span>
                    </p>
                    <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}><strong>Last Activity:</strong> {new Date(selectedDriver.lastActivity).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Risk Factors */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem' }}>
                ⚠️ Why This Driver is High Risk
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#dc2626', marginBottom: '0.5rem' }}>Risk Factors</h4>
                  <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.85rem', color: '#374151' }}>
                    {selectedDriver.riskFactors.map((factor, index) => (
                      <li key={index} style={{ marginBottom: '0.5rem' }}>{factor}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#d97706', marginBottom: '0.5rem' }}>Flagged Behaviors</h4>
                  <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.85rem', color: '#374151' }}>
                    {selectedDriver.flaggedBehaviors.map((behavior, index) => (
                      <li key={index} style={{ marginBottom: '0.5rem' }}>{behavior}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button 
                onClick={() => {
                  setMessage(`🚫 Driver ${selectedDriver.name} has been suspended from the platform`);
                  setShowDriverProfile(false);
                  setTimeout(() => setMessage(''), 4000);
                }}
                style={{ 
                  background: '#dc2626', 
                  color: 'white', 
                  border: 'none', 
                  padding: '0.75rem 1.5rem', 
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                🚫 Suspend Driver
              </button>
              <button 
                onClick={() => openSuspendWalletModal('driver', selectedDriver)}
                style={{ 
                  background: '#f59e0b', 
                  color: 'white', 
                  border: 'none', 
                  padding: '0.75rem 1.5rem', 
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                💼 Suspend Wallet Withdrawals
              </button>
              <button 
                onClick={() => {
                  setMessage(`🗺️ Re-verification required for driver ${selectedDriver.name} - Photo ID and license verification initiated`);
                  setShowDriverProfile(false);
                  setTimeout(() => setMessage(''), 4000);
                }}
                style={{ 
                  background: '#d97706', 
                  color: 'white', 
                  border: 'none', 
                  padding: '0.75rem 1.5rem', 
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                🗺️ Require Re-verification
              </button>
              <button 
                onClick={() => {
                  setMessage(`🔍 Full investigation opened for driver ${selectedDriver.name} - Case #INV-${Date.now().toString().slice(-6)} created`);
                  setShowDriverProfile(false);
                  setTimeout(() => setMessage(''), 4000);
                }}
                style={{ 
                  background: '#3b82f6', 
                  color: 'white', 
                  border: 'none', 
                  padding: '0.75rem 1.5rem', 
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                🔍 Investigate Further
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Customer Profile Modal */}
      {selectedCustomer && showCustomerProfile && (
        <div style={{ 
          position: 'fixed', 
          inset: '0', 
          background: 'rgba(0, 0, 0, 0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 50
        }}>
          <div style={{ 
            background: 'white', 
            borderRadius: '12px', 
            padding: '2rem', 
            maxWidth: '900px', 
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                ⚠️ High Risk Customer Profile
              </h2>
              <button
                onClick={() => setShowCustomerProfile(false)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  fontSize: '1.5rem', 
                  cursor: 'pointer', 
                  color: '#6b7280' 
                }}
              >
                ✕
              </button>
            </div>
            
            {/* Customer Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', marginBottom: '2rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  width: '120px', 
                  height: '120px', 
                  borderRadius: '50%', 
                  background: selectedCustomer.riskLevel === 'critical' ? '#fef2f2' : selectedCustomer.riskLevel === 'high' ? '#fef3c7' : '#ecfccb',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: '3rem',
                  margin: '0 auto 1rem auto'
                }}>
                  👤
                </div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: '600', color: '#1f2937', margin: '0 0 0.5rem 0' }}>{selectedCustomer.name}</h3>
                <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: '0.25rem 0' }}>{selectedCustomer.id}</p>
                <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0 }}>{selectedCustomer.email}</p>
              </div>
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ textAlign: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: selectedCustomer.riskLevel === 'critical' ? '#dc2626' : selectedCustomer.riskLevel === 'high' ? '#d97706' : '#65a30d' }}>
                      {selectedCustomer.riskScore.toFixed(1)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Risk Score</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>{selectedCustomer.totalComplaints}</div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Total Complaints</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#dc2626' }}>{selectedCustomer.paymentIssues}</div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Payment Issues</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}><strong>Account Age:</strong> {selectedCustomer.accountAge.toFixed(1)} months</p>
                    <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}><strong>Recent Complaints:</strong> {selectedCustomer.recentComplaints} (30d)</p>
                  </div>
                  <div>
                    <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}><strong>Last Activity:</strong> {new Date(selectedCustomer.lastActivity).toLocaleDateString()}</p>
                    <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}><strong>Payment Issues:</strong> {selectedCustomer.paymentIssues}</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Risk Factors */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem' }}>
                ⚠️ Why This Customer is High Risk
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#dc2626', marginBottom: '0.5rem' }}>Risk Factors</h4>
                  <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.85rem', color: '#374151' }}>
                    {selectedCustomer.riskFactors.map((factor, index) => (
                      <li key={index} style={{ marginBottom: '0.5rem' }}>{factor}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#d97706', marginBottom: '0.5rem' }}>Flagged Behaviors</h4>
                  <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.85rem', color: '#374151' }}>
                    {selectedCustomer.flaggedBehaviors.map((behavior, index) => (
                      <li key={index} style={{ marginBottom: '0.5rem' }}>{behavior}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button 
                onClick={() => {
                  setMessage(`🚫 Customer account for ${selectedCustomer.name} has been suspended`);
                  setShowCustomerProfile(false);
                  setTimeout(() => setMessage(''), 4000);
                }}
                style={{ 
                  background: '#dc2626', 
                  color: 'white', 
                  border: 'none', 
                  padding: '0.75rem 1.5rem', 
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                🚫 Suspend Account
              </button>
              <button 
                onClick={() => openSuspendWalletModal('customer', selectedCustomer)}
                style={{ 
                  background: '#f59e0b', 
                  color: 'white', 
                  border: 'none', 
                  padding: '0.75rem 1.5rem', 
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                💼 Suspend Wallet Withdrawals
              </button>
              <button 
                onClick={() => {
                  setMessage(`💳 Payment methods restricted for customer ${selectedCustomer.name} - New payment verification required`);
                  setShowCustomerProfile(false);
                  setTimeout(() => setMessage(''), 4000);
                }}
                style={{ 
                  background: '#d97706', 
                  color: 'white', 
                  border: 'none', 
                  padding: '0.75rem 1.5rem', 
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                💳 Restrict Payment Methods
              </button>
              <button 
                onClick={() => {
                  setMessage(`🔍 Full investigation opened for customer ${selectedCustomer.name} - Case #CUS-${Date.now().toString().slice(-6)} created`);
                  setShowCustomerProfile(false);
                  setTimeout(() => setMessage(''), 4000);
                }}
                style={{ 
                  background: '#3b82f6', 
                  color: 'white', 
                  border: 'none', 
                  padding: '0.75rem 1.5rem', 
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                🔍 Investigate Further
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Suspend Wallet Withdrawals Modal */}
      {showSuspendWalletModal && suspendWalletTarget && (
        <div style={{ 
          position: 'fixed', 
          inset: '0', 
          background: 'rgba(0, 0, 0, 0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 60
        }}>
          <div style={{ 
            background: 'white', 
            borderRadius: '16px', 
            padding: '2rem', 
            maxWidth: '500px', 
            width: '90%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1f2937', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                💼 Suspend Wallet Withdrawals
              </h2>
              <button
                onClick={() => setShowSuspendWalletModal(false)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  fontSize: '1.5rem', 
                  cursor: 'pointer', 
                  color: '#6b7280' 
                }}
              >
                ✕
              </button>
            </div>
            
            {/* Target Information */}
            <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ 
                  width: '50px', 
                  height: '50px', 
                  borderRadius: '50%', 
                  background: suspendWalletType === 'driver' ? '#fef3c7' : '#ecfccb',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: '1.5rem'
                }}>
                  {suspendWalletType === 'driver' ? '🚗' : '👤'}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                    {suspendWalletType === 'driver' ? (suspendWalletTarget as HighRiskDriver).name : (suspendWalletTarget as HighRiskCustomer).name}
                  </h3>
                  <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: '0.25rem 0' }}>
                    {suspendWalletType === 'driver' ? 'High Risk Driver' : 'High Risk Customer'}
                  </p>
                </div>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#374151' }}>
                <p style={{ margin: '0.5rem 0' }}>
                  <strong>Risk Score:</strong> {suspendWalletType === 'driver' ? (suspendWalletTarget as HighRiskDriver).riskScore.toFixed(1) : (suspendWalletTarget as HighRiskCustomer).riskScore.toFixed(1)}/10
                </p>
                <p style={{ margin: '0.5rem 0' }}>
                  <strong>ID:</strong> {suspendWalletType === 'driver' ? (suspendWalletTarget as HighRiskDriver).id : (suspendWalletTarget as HighRiskCustomer).id}
                </p>
              </div>
            </div>
            
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem' }}>
                ⏰ Select Suspension Duration
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '1.5rem' }}>
                Choose how long to suspend wallet withdrawals for this {suspendWalletType}. This action will prevent them from withdrawing earnings while allowing continued platform access.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <button
                  onClick={() => handleSuspendWallet('24 hours')}
                  style={{
                    background: '#fef3c7',
                    border: '2px solid #f59e0b',
                    color: '#92400e',
                    padding: '1rem',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    textAlign: 'left',
                    transition: 'all 0.2s ease'
                  }}
                >
                  ⏰ 24 Hours
                  <div style={{ fontSize: '0.8rem', fontWeight: '400', marginTop: '0.25rem' }}>
                    Temporary suspension for minor violations
                  </div>
                </button>
                
                <button
                  onClick={() => handleSuspendWallet('72 hours')}
                  style={{
                    background: '#fef2f2',
                    border: '2px solid #f59e0b',
                    color: '#92400e',
                    padding: '1rem',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    textAlign: 'left',
                    transition: 'all 0.2s ease'
                  }}
                >
                  ⏱️ 72 Hours
                  <div style={{ fontSize: '0.8rem', fontWeight: '400', marginTop: '0.25rem' }}>
                    Extended suspension for moderate violations
                  </div>
                </button>
                
                <button
                  onClick={() => handleSuspendWallet('Until investigation complete')}
                  style={{
                    background: '#fef2f2',
                    border: '2px solid #dc2626',
                    color: '#dc2626',
                    padding: '1rem',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    textAlign: 'left',
                    transition: 'all 0.2s ease'
                  }}
                >
                  🔒 Until Investigation Complete
                  <div style={{ fontSize: '0.8rem', fontWeight: '400', marginTop: '0.25rem' }}>
                    Indefinite suspension pending full investigation
                  </div>
                </button>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button
                onClick={() => setShowSuspendWalletModal(false)}
                style={{
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Metric Detail Modal */}
      {showMetricModal && (
        <div style={{ 
          position: 'fixed', 
          inset: '0', 
          background: 'rgba(0, 0, 0, 0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 60
        }}>
          <div style={{ 
            background: 'white', 
            borderRadius: '16px', 
            padding: '2rem', 
            maxWidth: '600px', 
            width: '90%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                {getMetricModalContent(selectedMetric).title}
              </h2>
              <button
                onClick={() => setShowMetricModal(false)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  fontSize: '1.5rem', 
                  cursor: 'pointer', 
                  color: '#6b7280' 
                }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ background: '#f8fafc', padding: '2rem', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <pre style={{ 
                fontSize: '0.95rem', 
                color: '#374151', 
                lineHeight: '1.6', 
                margin: 0, 
                whiteSpace: 'pre-wrap',
                fontFamily: 'Inter, sans-serif'
              }}>
                {getMetricModalContent(selectedMetric).content}
              </pre>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
              <button
                onClick={() => setShowMetricModal(false)}
                style={{
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '500'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Fraud Type Detail Modal */}
      {showFraudTypeDetail && (
        <div style={{ 
          position: 'fixed', 
          inset: '0', 
          background: 'rgba(0, 0, 0, 0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 60
        }}>
          <div style={{ 
            background: 'white', 
            borderRadius: '16px', 
            padding: '2rem', 
            maxWidth: '1200px', 
            width: '95%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1f2937', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📈 {selectedFraudType} - Detailed Analysis
              </h2>
              <button
                onClick={() => setShowFraudTypeDetail(false)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  fontSize: '1.5rem', 
                  cursor: 'pointer', 
                  color: '#6b7280' 
                }}
              >
                ✕
              </button>
            </div>
            
            {/* Fraud Type Overview */}
            <div style={{ background: '#f8fafc', padding: '2rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '2rem', marginBottom: '1.5rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc2626' }}>
                    {fraudInsights.topFraudTypes.find(f => f.type === selectedFraudType)?.count || 0}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Total Incidents</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>
                    {fraudInsights.topFraudTypes.find(f => f.type === selectedFraudType)?.trend || 0}%
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Trend Change</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>94%</div>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Detection Rate</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>$12.4K</div>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Avg Loss per Incident</div>
                </div>
              </div>
              <p style={{ fontSize: '0.9rem', color: '#374151', margin: 0 }}>
                {selectedFraudType === 'Fare Manipulation' && 'Drivers artificially inflate fares through route manipulation, wait time extensions, and surge pricing abuse.'}
                {selectedFraudType === 'GPS Spoofing' && 'Use of GPS manipulation tools to fake locations, create false surge areas, and manipulate trip distances.'}
                {selectedFraudType === 'Identity Fraud' && 'Account takeover attempts, fake driver verification, and use of stolen or fraudulent identification documents.'}
                {selectedFraudType === 'Payment Fraud' && 'Credit card fraud, stolen payment methods, and unauthorized charge attempts on customer accounts.'}
                {selectedFraudType === 'Rating Manipulation' && 'Coordinated efforts to artificially inflate driver ratings using bot networks and fake accounts.'}
              </p>
            </div>
            
            {/* High Risk Perpetrators */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem' }}>
                  🚨 High Risk Drivers (This Fraud Type)
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '400px', overflow: 'auto' }}>
                  {highRiskDrivers.slice(0, 3).map((driver) => (
                    <div key={driver.id} style={{ 
                      background: 'white', 
                      border: '2px solid #dc2626',
                      borderRadius: '12px', 
                      padding: '1rem',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      setShowFraudTypeDetail(false);
                      openDriverProfile(driver);
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                        <div style={{ 
                          width: '40px', 
                          height: '40px', 
                          borderRadius: '50%', 
                          background: '#fef2f2',
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontSize: '1.2rem'
                        }}>
                          🚗
                        </div>
                        <div>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>{driver.name}</h4>
                          <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0.25rem 0' }}>{driver.id}</p>
                        </div>
                        <div style={{ marginLeft: 'auto' }}>
                          <div style={{ 
                            background: '#dc2626', 
                            color: 'white', 
                            padding: '0.25rem 0.5rem', 
                            borderRadius: '12px', 
                            fontSize: '0.7rem', 
                            fontWeight: '600'
                          }}>
                            {driver.riskScore.toFixed(1)}/10
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#374151' }}>
                        <strong>Recent Activity:</strong> {driver.recentIncidents} incidents in 30 days
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                        Primary Risk: {driver.riskFactors[0]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem' }}>
                  ⚠️ High Risk Customers (This Fraud Type)
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '400px', overflow: 'auto' }}>
                  {highRiskCustomers.slice(0, 3).map((customer) => (
                    <div key={customer.id} style={{ 
                      background: 'white', 
                      border: '2px solid #d97706',
                      borderRadius: '12px', 
                      padding: '1rem',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      setShowFraudTypeDetail(false);
                      openCustomerProfile(customer);
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                        <div style={{ 
                          width: '40px', 
                          height: '40px', 
                          borderRadius: '50%', 
                          background: '#fef3c7',
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontSize: '1.2rem'
                        }}>
                          👤
                        </div>
                        <div>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>{customer.name}</h4>
                          <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0.25rem 0' }}>{customer.id}</p>
                        </div>
                        <div style={{ marginLeft: 'auto' }}>
                          <div style={{ 
                            background: '#d97706', 
                            color: 'white', 
                            padding: '0.25rem 0.5rem', 
                            borderRadius: '12px', 
                            fontSize: '0.7rem', 
                            fontWeight: '600'
                          }}>
                            {customer.riskScore.toFixed(1)}/10
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#374151' }}>
                        <strong>Recent Activity:</strong> {customer.recentComplaints} complaints in 30 days
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                        Primary Risk: {customer.riskFactors[0]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FraudAnalystDashboard;