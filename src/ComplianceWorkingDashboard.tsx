import React, { useState, useEffect } from 'react';

interface MLModel {
  id: string;
  name: string;
  type: 'fraud_detection' | 'pattern_analysis' | 'risk_assessment';
  status: 'active' | 'training' | 'inactive';
  accuracy: number;
  lastTrained: string;
  version: string;
  predictions: number;
}

interface AIResult {
  id: string;
  timestamp: string;
  modelId: string;
  modelName: string;
  inputData: any;
  prediction: string;
  confidence: number;
  riskScore: number;
  factors: string[];
}

interface CompliancePolicy {
  id: string;
  name: string;
  category: 'fraud_detection' | 'data_privacy' | 'operational' | 'security';
  description: string;
  rules: PolicyRule[];
  status: 'active' | 'draft' | 'archived';
  lastModified: string;
  createdBy: string;
  appliedToModels: string[];
}

interface PolicyRule {
  id: string;
  condition: string;
  action: string;
  priority: number;
  enabled: boolean;
}

const ComplianceWorkingDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [mlModels, setMLModels] = useState<MLModel[]>([]);
  const [aiResults, setAIResults] = useState<AIResult[]>([]);
  const [policies, setPolicies] = useState<CompliancePolicy[]>([]);
  const [selectedModel, setSelectedModel] = useState<MLModel | null>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<CompliancePolicy | null>(null);
  const [showPolicyEditor, setShowPolicyEditor] = useState(false);
  const [showRulesViewer, setShowRulesViewer] = useState(false);
  const [selectedPolicyForRules, setSelectedPolicyForRules] = useState<CompliancePolicy | null>(null);
  const [showModelDetails, setShowModelDetails] = useState(false);
  const [currentUser] = useState({ name: 'Alex Rivera', role: 'Compliance Officer', id: 'CO-001' });
  const [message, setMessage] = useState('');
  const [newPolicy, setNewPolicy] = useState({
    name: '',
    category: 'fraud_detection' as const,
    description: '',
    rules: [] as PolicyRule[],
    selectedModels: [] as string[],
    triggerRetraining: true
  });
  const [showModelSelector, setShowModelSelector] = useState(false);

  // Initialize sample data
  useEffect(() => {
    const sampleModels: MLModel[] = [
      {
        id: '1',
        name: 'Rideshare Fare Manipulation Detector',
        type: 'fraud_detection',
        status: 'active',
        accuracy: 98.4,
        lastTrained: '2024-12-20',
        version: '4.1.2',
        predictions: 87340
      },
      {
        id: '2',
        name: 'Driver Identity Verification Engine',
        type: 'fraud_detection',
        status: 'active',
        accuracy: 96.8,
        lastTrained: '2024-12-18',
        version: '3.7.1',
        predictions: 52180
      },
      {
        id: '3',
        name: 'Route Fraud Pattern Analyzer',
        type: 'pattern_analysis',
        status: 'active',
        accuracy: 94.2,
        lastTrained: '2024-12-19',
        version: '2.9.5',
        predictions: 41760
      },
      {
        id: '4',
        name: 'Payment Card Skimming Detector',
        type: 'fraud_detection',
        status: 'active',
        accuracy: 99.1,
        lastTrained: '2024-12-21',
        version: '5.2.0',
        predictions: 73920
      },
      {
        id: '5',
        name: 'Surge Pricing Abuse Monitor',
        type: 'fraud_detection',
        status: 'training',
        accuracy: 97.3,
        lastTrained: '2024-12-15',
        version: '3.1.0-beta',
        predictions: 29480
      },
      {
        id: '6',
        name: 'Fake Rider Account Classifier',
        type: 'pattern_analysis',
        status: 'active',
        accuracy: 95.6,
        lastTrained: '2024-12-17',
        version: '4.0.3',
        predictions: 38720
      },
      {
        id: '7',
        name: 'Driver Rating Manipulation Scanner',
        type: 'fraud_detection',
        status: 'active',
        accuracy: 93.8,
        lastTrained: '2024-12-16',
        version: '2.4.7',
        predictions: 15650
      },
      {
        id: '8',
        name: 'GPS Spoofing Detection System',
        type: 'fraud_detection',
        status: 'active',
        accuracy: 98.9,
        lastTrained: '2024-12-20',
        version: '6.1.1',
        predictions: 91240
      }
    ];

    const sampleResults: AIResult[] = [
      {
        id: '1',
        timestamp: new Date().toISOString(),
        modelId: '1',
        modelName: 'Rideshare Fare Manipulation Detector',
        inputData: { fareAmount: 127.50, actualDistance: 8.2, reportedDistance: 15.7, surgeMultiplier: 2.1 },
        prediction: 'Fare Manipulation Detected',
        confidence: 0.96,
        riskScore: 9.1,
        factors: ['Inflated distance reported', 'Unusual route patterns', 'Excessive surge pricing', 'GPS coordinate inconsistencies']
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        modelId: '2',
        modelName: 'Driver Identity Verification Engine',
        inputData: { driverId: 'DRV-4829', photoMatch: 0.43, licenseStatus: 'expired', accountAge: 2 },
        prediction: 'Identity Fraud - Account Takeover',
        confidence: 0.93,
        riskScore: 8.7,
        factors: ['Low photo similarity score', 'Expired license', 'Recent account activity change', 'Unusual driving patterns']
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        modelId: '8',
        modelName: 'GPS Spoofing Detection System',
        inputData: { rideId: 'RIDE-7823', gpsJumps: 7, speedAnomaly: 180, locationAccuracy: 'low' },
        prediction: 'GPS Spoofing Attack',
        confidence: 0.98,
        riskScore: 9.5,
        factors: ['Multiple GPS coordinate jumps', 'Impossible speed detected', 'Location accuracy manipulation', 'Route reconstruction failed']
      },
      {
        id: '4',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        modelId: '4',
        modelName: 'Payment Card Skimming Detector',
        inputData: { cardId: 'CC-9847', transactionLocation: 'vehicle', fraudScore: 0.87, timePattern: 'suspicious' },
        prediction: 'Card Skimming in Vehicle',
        confidence: 0.94,
        riskScore: 8.9,
        factors: ['In-vehicle card reader anomaly', 'Multiple failed authentication attempts', 'Unusual payment processing time', 'Driver device modification detected']
      },
      {
        id: '5',
        timestamp: new Date(Date.now() - 10800000).toISOString(),
        modelId: '6',
        modelName: 'Fake Rider Account Classifier',
        inputData: { riderId: 'USR-3741', accountAge: 0.5, paymentMethods: 0, rideFrequency: 12 },
        prediction: 'Fake Rider Account',
        confidence: 0.91,
        riskScore: 8.2,
        factors: ['New account with high ride frequency', 'No verified payment methods', 'Suspicious registration pattern', 'Bot-like behavior detected']
      },
      {
        id: '6',
        timestamp: new Date(Date.now() - 14400000).toISOString(),
        modelId: '5',
        modelName: 'Surge Pricing Abuse Monitor',
        inputData: { driverId: 'DRV-1094', surgeRequests: 8, locationPattern: 'circular', timeSpan: 45 },
        prediction: 'Surge Pricing Manipulation',
        confidence: 0.89,
        riskScore: 7.6,
        factors: ['Artificial demand creation', 'Coordinated driver behavior', 'Circular driving patterns', 'Rapid surge activation']
      }
    ];

    const samplePolicies: CompliancePolicy[] = [
      {
        id: '1',
        name: 'Rideshare Fare Manipulation Prevention',
        category: 'fraud_detection',
        description: 'Comprehensive policy for detecting fare inflation, route manipulation, and surge pricing abuse in rideshare operations',
        rules: [
          {
            id: 'r1',
            condition: 'reportedDistance > actualDistance * 1.3',
            action: 'FLAG_DISTANCE_INFLATION',
            priority: 1,
            enabled: true
          },
          {
            id: 'r2',
            condition: 'fareAmount > expectedFare * 2.0 AND surgeMultiplier < 1.5',
            action: 'ALERT_FARE_MANIPULATION',
            priority: 1,
            enabled: true
          },
          {
            id: 'r3',
            condition: 'routeDeviation > 40% AND waitTime > 10min',
            action: 'INVESTIGATE_ROUTE_FRAUD',
            priority: 2,
            enabled: true
          }
        ],
        status: 'active',
        lastModified: '2024-12-20',
        createdBy: 'Rideshare Fraud Unit',
        appliedToModels: ['1', '3']
      },
      {
        id: '2',
        name: 'Driver Identity Verification Protocol',
        category: 'fraud_detection',
        description: 'Strict identity verification to prevent account takeovers, impersonation, and unauthorized driver access',
        rules: [
          {
            id: 'r4',
            condition: 'photoMatchScore < 0.7',
            action: 'REQUIRE_IDENTITY_REVERIFICATION',
            priority: 1,
            enabled: true
          },
          {
            id: 'r5',
            condition: 'licenseStatus == "expired" OR licenseStatus == "suspended"',
            action: 'IMMEDIATELY_SUSPEND_DRIVER',
            priority: 1,
            enabled: true
          },
          {
            id: 'r6',
            condition: 'drivingPatternChange > 0.8 AND accountRecentlyAccessed == true',
            action: 'FLAG_POTENTIAL_ACCOUNT_TAKEOVER',
            priority: 1,
            enabled: true
          }
        ],
        status: 'active',
        lastModified: '2024-12-21',
        createdBy: 'Driver Safety & Compliance Team',
        appliedToModels: ['2']
      },
      {
        id: '3',
        name: 'GPS Spoofing and Location Fraud Detection',
        category: 'fraud_detection',
        description: 'Advanced detection of GPS manipulation, location spoofing, and coordinate falsification in rideshare trips',
        rules: [
          {
            id: 'r7',
            condition: 'gpsJumpCount > 5 AND jumpDistance > 1000m',
            action: 'BLOCK_TRIP_AND_INVESTIGATE',
            priority: 1,
            enabled: true
          },
          {
            id: 'r8',
            condition: 'averageSpeed > 200kph AND tripType == "city"',
            action: 'FLAG_GPS_SPOOFING',
            priority: 1,
            enabled: true
          },
          {
            id: 'r9',
            condition: 'locationAccuracy == "low" AND fareAmount > avgFare * 1.5',
            action: 'REQUIRE_GPS_VERIFICATION',
            priority: 2,
            enabled: true
          }
        ],
        status: 'active',
        lastModified: '2024-12-19',
        createdBy: 'Location Intelligence Team',
        appliedToModels: ['8', '3']
      },
      {
        id: '4',
        name: 'Payment Card Security in Vehicles',
        category: 'fraud_detection',
        description: 'Protection against card skimming, payment fraud, and unauthorized card reader modifications in rideshare vehicles',
        rules: [
          {
            id: 'r10',
            condition: 'cardReaderAnomaly == true',
            action: 'IMMEDIATELY_DISABLE_PAYMENT_SYSTEM',
            priority: 1,
            enabled: true
          },
          {
            id: 'r11',
            condition: 'paymentProcessingTime > 15sec AND cardPresent == true',
            action: 'FLAG_POTENTIAL_SKIMMING',
            priority: 1,
            enabled: true
          },
          {
            id: 'r12',
            condition: 'multipleFailedCardAttempts > 3 AND deviceModification == detected',
            action: 'SUSPEND_VEHICLE_PAYMENTS',
            priority: 1,
            enabled: true
          }
        ],
        status: 'active',
        lastModified: '2024-12-18',
        createdBy: 'Payment Security Division',
        appliedToModels: ['4']
      },
      {
        id: '5',
        name: 'Fake Account and Rating Manipulation Prevention',
        category: 'fraud_detection',
        description: 'Detection of fake rider/driver accounts, rating manipulation, and coordinated fraud networks',
        rules: [
          {
            id: 'r13',
            condition: 'accountAge < 7days AND rideFrequency > 20',
            action: 'FLAG_SUSPICIOUS_ACCOUNT_ACTIVITY',
            priority: 1,
            enabled: true
          },
          {
            id: 'r14',
            condition: 'ratingPattern == "artificial" OR ratingManipulation == detected',
            action: 'RESET_RATINGS_AND_INVESTIGATE',
            priority: 2,
            enabled: true
          },
          {
            id: 'r15',
            condition: 'paymentMethodsCount == 0 AND accountAge > 30days',
            action: 'REQUIRE_PAYMENT_VERIFICATION',
            priority: 2,
            enabled: true
          }
        ],
        status: 'active',
        lastModified: '2024-12-17',
        createdBy: 'Account Integrity Team',
        appliedToModels: ['6', '7']
      },
      {
        id: '6',
        name: 'Surge Pricing Abuse and Market Manipulation',
        category: 'fraud_detection',
        description: 'Prevention of artificial demand creation, coordinated surge manipulation, and pricing fraud',
        rules: [
          {
            id: 'r16',
            condition: 'surgeRequests > 10 AND driverMovementPattern == "circular"',
            action: 'FLAG_ARTIFICIAL_SURGE_CREATION',
            priority: 1,
            enabled: true
          },
          {
            id: 'r17',
            condition: 'coordinatedDriverBehavior == true AND surgeActivation == rapid',
            action: 'INVESTIGATE_MARKET_MANIPULATION',
            priority: 1,
            enabled: true
          },
          {
            id: 'r18',
            condition: 'surgeMultiplier > 5.0 AND demandJustification == insufficient',
            action: 'CAP_SURGE_AND_REVIEW',
            priority: 2,
            enabled: true
          }
        ],
        status: 'active',
        lastModified: '2024-12-16',
        createdBy: 'Market Integrity Division',
        appliedToModels: ['5']
      },
      {
        id: '7',
        name: 'Rideshare Data Privacy and Security',
        category: 'data_privacy',
        description: 'Comprehensive data protection for rider/driver personal information, trip data, and payment details',
        rules: [
          {
            id: 'r19',
            condition: 'dataType == "trip_history" OR dataType == "location_data"',
            action: 'ENCRYPT_AND_ANONYMIZE',
            priority: 1,
            enabled: true
          },
          {
            id: 'r20',
            condition: 'unauthorizedDataAccess == attempted AND userRole != "authorized_analyst"',
            action: 'BLOCK_ACCESS_AND_ALERT_SECURITY',
            priority: 1,
            enabled: true
          },
          {
            id: 'r21',
            condition: 'dataRetentionPeriod > 365days AND dataCategory == "personal_identifiable"',
            action: 'INITIATE_DATA_PURGE_PROCESS',
            priority: 2,
            enabled: true
          }
        ],
        status: 'active',
        lastModified: '2024-12-15',
        createdBy: 'Privacy & Data Protection Office',
        appliedToModels: ['1', '2', '3', '4', '5', '6', '7', '8']
      }
    ];

    setMLModels(sampleModels);
    setAIResults(sampleResults);
    setPolicies(samplePolicies);
  }, []);

  const handleCreatePolicy = async () => {
    if (!newPolicy.name || !newPolicy.description) {
      setMessage('Please fill in all required fields');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (newPolicy.selectedModels.length === 0) {
      setMessage('Please select at least one ML model to apply this policy');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const policyToCreate: CompliancePolicy = {
      id: Date.now().toString(),
      name: newPolicy.name,
      category: newPolicy.category,
      description: newPolicy.description,
      rules: newPolicy.rules.length > 0 ? newPolicy.rules : [
        {
          id: 'default_rule',
          condition: 'Apply standard fraud detection rules',
          action: 'EVALUATE_AND_FLAG',
          priority: 1,
          enabled: true
        }
      ],
      status: 'active',
      lastModified: new Date().toISOString(),
      createdBy: currentUser.name,
      appliedToModels: newPolicy.selectedModels
    };

    try {
      const response = await fetch('http://localhost:3001/api/compliance/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policyToCreate)
      });

      if (response.ok) {
        setPolicies([policyToCreate, ...policies]);
        
        // Apply policy to selected models and trigger retraining if requested
        if (newPolicy.triggerRetraining) {
          await applyPolicyToModels(policyToCreate.id, newPolicy.selectedModels);
        }
        
        setMessage(`✅ Policy "${policyToCreate.name}" created by ${currentUser.name} and applied to ${newPolicy.selectedModels.length} model(s)!`);
      }
    } catch (error) {
      setPolicies([policyToCreate, ...policies]);
      
      if (newPolicy.triggerRetraining) {
        await applyPolicyToModels(policyToCreate.id, newPolicy.selectedModels);
      }
      
      setMessage(`✅ Policy "${policyToCreate.name}" created by ${currentUser.name} locally and applied to models (API unavailable)`);
    }

    setTimeout(() => setMessage(''), 5000);
    setShowPolicyEditor(false);
    setNewPolicy({ name: '', category: 'fraud_detection', description: '', rules: [], selectedModels: [], triggerRetraining: true });
  };

  const applyPolicyToModels = async (policyId: string, modelIds: string[]) => {
    const updatedModels = mlModels.map(model => {
      if (modelIds.includes(model.id)) {
        return {
          ...model,
          status: 'training' as const,
          lastTrained: new Date().toISOString().split('T')[0]
        };
      }
      return model;
    });
    
    setMLModels(updatedModels);
    
    // Simulate API calls to retrain models with new policy
    for (const modelId of modelIds) {
      try {
        await fetch(`http://localhost:3001/api/ml/models/${modelId}/apply-policy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ policyId, autoRetrain: true })
        });
      } catch (error) {
        console.log('Policy applied locally (API unavailable)');
      }
    }
    
    // Simulate training completion after a few seconds
    setTimeout(() => {
      setMLModels(models => models.map(model => 
        modelIds.includes(model.id) 
          ? { ...model, status: 'active', accuracy: Math.min(99.9, model.accuracy + Math.random() * 2) }
          : model
      ));
      setMessage(`Models retrained successfully with new policy! Average accuracy improved.`);
      setTimeout(() => setMessage(''), 3000);
    }, 3000);
  };

  const toggleModelSelection = (modelId: string) => {
    setNewPolicy(prev => ({
      ...prev,
      selectedModels: prev.selectedModels.includes(modelId)
        ? prev.selectedModels.filter(id => id !== modelId)
        : [...prev.selectedModels, modelId]
    }));
  };

  const addNewRuleToPolicy = () => {
    const newRule: PolicyRule = {
      id: `rule_${Date.now()}`,
      condition: '',
      action: '',
      priority: newPolicy.rules.length + 1,
      enabled: true
    };
    
    setNewPolicy(prev => ({
      ...prev,
      rules: [...prev.rules, newRule]
    }));
  };

  const updatePolicyRule = (ruleId: string, field: keyof PolicyRule, value: any) => {
    setNewPolicy(prev => ({
      ...prev,
      rules: prev.rules.map(rule => 
        rule.id === ruleId ? { ...rule, [field]: value } : rule
      )
    }));
  };

  const removePolicyRule = (ruleId: string) => {
    setNewPolicy(prev => ({
      ...prev,
      rules: prev.rules.filter(rule => rule.id !== ruleId)
    }));
  };

  const handleRetrainModel = async (modelId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/ml/models/${modelId}/retrain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        setMLModels(models => models.map(m => 
          m.id === modelId ? { ...m, status: 'training', lastTrained: new Date().toISOString().split('T')[0] } : m
        ));
        setMessage('Rideshare fraud detection model retraining started successfully!');
      }
    } catch (error) {
      setMLModels(models => models.map(m => 
        m.id === modelId ? { ...m, status: 'training', lastTrained: new Date().toISOString().split('T')[0] } : m
      ));
      setMessage('Rideshare fraud detection model retraining started locally (API unavailable)');
    }

    setTimeout(() => setMessage(''), 3000);
  };

  const handleDeployNewModel = async () => {
    const newModel: MLModel = {
      id: Date.now().toString(),
      name: 'Advanced Rideshare Fraud Detector',
      type: 'fraud_detection',
      status: 'training',
      accuracy: 0,
      lastTrained: new Date().toISOString().split('T')[0],
      version: '1.0.0-beta',
      predictions: 0
    };

    try {
      const response = await fetch('http://localhost:3001/api/ml/models/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newModel)
      });

      if (response.ok) {
        setMLModels([newModel, ...mlModels]);
        setMessage('New rideshare fraud detection model deployment started!');
      }
    } catch (error) {
      setMLModels([newModel, ...mlModels]);
      setMessage('New rideshare fraud detection model deployed locally (API unavailable)');
    }

    setTimeout(() => setMessage(''), 3000);
  };

  const handleScheduleTraining = async (modelId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/ml/models/${modelId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule: 'daily', time: '02:00' })
      });

      if (response.ok) {
        setMessage('Training scheduled successfully for daily at 2:00 AM!');
      }
    } catch (error) {
      setMessage('Training scheduled locally (API unavailable)');
    }

    setTimeout(() => setMessage(''), 3000);
  };

  const handleViewRules = (policy: CompliancePolicy) => {
    setSelectedPolicyForRules(policy);
    setShowRulesViewer(true);
  };

  const handleSaveRulesChanges = () => {
    if (selectedPolicyForRules) {
      setPolicies(policies.map(p => p.id === selectedPolicyForRules.id ? selectedPolicyForRules : p));
      setMessage(`Rules updated successfully for policy: ${selectedPolicyForRules.name}`);
      setTimeout(() => setMessage(''), 3000);
      setShowRulesViewer(false);
      setSelectedPolicyForRules(null);
    }
  };

  const updateRuleInViewer = (ruleId: string, field: keyof PolicyRule, value: any) => {
    if (selectedPolicyForRules) {
      setSelectedPolicyForRules({
        ...selectedPolicyForRules,
        rules: selectedPolicyForRules.rules.map(rule => 
          rule.id === ruleId ? { ...rule, [field]: value } : rule
        )
      });
    }
  };

  const addRuleToViewer = () => {
    if (selectedPolicyForRules) {
      const newRule: PolicyRule = {
        id: `rule_${Date.now()}`,
        condition: '',
        action: '',
        priority: selectedPolicyForRules.rules.length + 1,
        enabled: true
      };
      setSelectedPolicyForRules({
        ...selectedPolicyForRules,
        rules: [...selectedPolicyForRules.rules, newRule]
      });
    }
  };

  const removeRuleFromViewer = (ruleId: string) => {
    if (selectedPolicyForRules) {
      setSelectedPolicyForRules({
        ...selectedPolicyForRules,
        rules: selectedPolicyForRules.rules.filter(rule => rule.id !== ruleId)
      });
    }
  };

  const handleAddNewRule = (policyId: string) => {
    const newRule: PolicyRule = {
      id: `rule_${Date.now()}`,
      condition: 'amount > 10000',
      action: 'REQUIRE_MANUAL_REVIEW',
      priority: (selectedPolicy?.rules.length || 0) + 1,
      enabled: true
    };

    if (selectedPolicy) {
      setSelectedPolicy({
        ...selectedPolicy,
        rules: [...selectedPolicy.rules, newRule]
      });
      setMessage('New rideshare fraud detection rule added!');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleLogout = () => {
    setMessage('Logging out...');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              🤖
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active ML Models</p>
              <p className="text-2xl font-semibold text-gray-900">{mlModels.filter(m => m.status === 'active').length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              📊
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Avg Model Accuracy</p>
              <p className="text-2xl font-semibold text-gray-900">
                {Math.round(mlModels.reduce((sum, m) => sum + m.accuracy, 0) / mlModels.length)}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600">
              📋
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Policies</p>
              <p className="text-2xl font-semibold text-gray-900">{policies.filter(p => p.status === 'active').length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
              ⚡
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Predictions</p>
              <p className="text-2xl font-semibold text-gray-900">
                {mlModels.reduce((sum, m) => sum + m.predictions, 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Policy Training Status */}
      <div className="bg-white rounded-lg shadow border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">🤖 AI/ML Policy Learning Status</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-blue-50 p-4 rounded">
              <div className="flex items-center justify-between">
                <span className="font-medium text-blue-800">Active Policy Training</span>
                <span className="text-xl text-blue-600">{policies.filter(p => p.appliedToModels.length > 0).length}</span>
              </div>
              <p className="text-xs text-blue-600 mt-1">Policies currently training models</p>
            </div>
            <div className="bg-green-50 p-4 rounded">
              <div className="flex items-center justify-between">
                <span className="font-medium text-green-800">Models Learning</span>
                <span className="text-xl text-green-600">{mlModels.filter(m => m.status === 'training').length}</span>
              </div>
              <p className="text-xs text-green-600 mt-1">Models currently being retrained</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <h3 className="font-medium text-gray-800">Recent Policy Applications</h3>
            {policies.slice(0, 3).map(policy => (
              <div key={policy.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{policy.name}</span>
                    {policy.appliedToModels.length > 0 && (
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                        ✓ Applied to {policy.appliedToModels.length} models
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600">{policy.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{new Date(policy.lastModified).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent AI Results */}
      <div className="bg-white rounded-lg shadow border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Recent AI Predictions</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {aiResults.slice(0, 5).map((result) => (
              <div key={result.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold">{result.modelName}</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      result.confidence >= 0.8 ? 'bg-green-100 text-green-800' :
                      result.confidence >= 0.6 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {Math.round(result.confidence * 100)}% confident
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{result.prediction}</p>
                  <p className="text-xs text-gray-500">Risk Score: {result.riskScore}/10</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{new Date(result.timestamp).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderMLModels = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">ML Model Management</h2>
        <button 
          onClick={handleDeployNewModel}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Deploy New Rideshare Fraud Model
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mlModels.map((model) => (
          <div key={model.id} className="bg-white rounded-lg shadow border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{model.name}</h3>
              <span className={`px-2 py-1 rounded text-xs ${
                model.status === 'active' ? 'bg-green-100 text-green-800' :
                model.status === 'training' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {model.status}
              </span>
            </div>
            
            <div className="space-y-2 mb-4">
              <p className="text-sm"><span className="font-medium">Type:</span> {model.type.replace('_', ' ')}</p>
              <p className="text-sm"><span className="font-medium">Accuracy:</span> {model.accuracy}%</p>
              <p className="text-sm"><span className="font-medium">Version:</span> {model.version}</p>
              <p className="text-sm"><span className="font-medium">Predictions:</span> {model.predictions.toLocaleString()}</p>
              <p className="text-sm"><span className="font-medium">Last Trained:</span> {model.lastTrained}</p>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => handleRetrainModel(model.id)}
                className="flex-1 bg-blue-500 text-white px-3 py-2 rounded text-sm hover:bg-blue-600"
                disabled={model.status === 'training'}
              >
                {model.status === 'training' ? 'Training...' : 'Retrain'}
              </button>
              <button 
                onClick={() => {
                  setSelectedModel(model);
                  setShowModelDetails(true);
                }}
                className="flex-1 bg-gray-500 text-white px-3 py-2 rounded text-sm hover:bg-gray-600"
              >
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPolicies = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Compliance Policies</h2>
        <button
          onClick={() => setShowPolicyEditor(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Create Policy
        </button>
      </div>

      {showPolicyEditor && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium mb-4">Create New Rideshare Fraud Policy</h3>
          
          {/* Basic Policy Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Policy Name</label>
              <input
                type="text"
                value={newPolicy.name}
                onChange={(e) => setNewPolicy({ ...newPolicy, name: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="e.g., Advanced Driver Identity Verification"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={newPolicy.category}
                onChange={(e) => setNewPolicy({ ...newPolicy, category: e.target.value as any })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="fraud_detection">Fraud Detection</option>
                <option value="data_privacy">Data Privacy</option>
                <option value="operational">Operational</option>
                <option value="security">Security</option>
              </select>
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={newPolicy.description}
              onChange={(e) => setNewPolicy({ ...newPolicy, description: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={3}
              placeholder="Describe what rideshare fraud patterns this policy should detect..."
            />
          </div>
          
          {/* Model Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Apply to ML Models</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 border border-gray-300 rounded-md max-h-40 overflow-y-auto">
              {mlModels.map(model => (
                <label key={model.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={newPolicy.selectedModels.includes(model.id)}
                    onChange={() => toggleModelSelection(model.id)}
                    className="rounded"
                  />
                  <span className="text-sm">{model.name}</span>
                </label>
              ))}
            </div>
            {newPolicy.selectedModels.length > 0 && (
              <p className="text-xs text-green-600 mt-1">
                Selected {newPolicy.selectedModels.length} model(s) for training
              </p>
            )}
          </div>
          
          {/* Policy Rules */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">Policy Rules</label>
              <button
                onClick={addNewRuleToPolicy}
                className="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600"
              >
                Add Rule
              </button>
            </div>
            <div className="space-y-3 max-h-40 overflow-y-auto">
              {newPolicy.rules.map((rule, index) => (
                <div key={rule.id} className="border rounded p-3 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Condition (e.g., fareAmount > expectedFare * 2.0)"
                      value={rule.condition}
                      onChange={(e) => updatePolicyRule(rule.id, 'condition', e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Action (e.g., REQUIRE_MANUAL_REVIEW)"
                      value={rule.action}
                      onChange={(e) => updatePolicyRule(rule.id, 'action', e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <label className="flex items-center text-xs">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={(e) => updatePolicyRule(rule.id, 'enabled', e.target.checked)}
                        className="mr-1"
                      />
                      Enabled
                    </label>
                    <button
                      onClick={() => removePolicyRule(rule.id)}
                      className="text-red-500 text-xs hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* AI/ML Training Options */}
          <div className="mb-4 p-3 bg-blue-50 rounded">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={newPolicy.triggerRetraining}
                onChange={(e) => setNewPolicy({ ...newPolicy, triggerRetraining: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm font-medium text-blue-800">🤖 Automatically retrain selected AI/ML models with this policy</span>
            </label>
            <p className="text-xs text-blue-600 mt-1 ml-6">
              Models will learn from this policy and improve their rideshare fraud detection capabilities
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleCreatePolicy}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
              disabled={newPolicy.selectedModels.length === 0}
            >
              Create Policy & Train Models
            </button>
            <button
              onClick={() => {
                setShowPolicyEditor(false);
                setNewPolicy({ name: '', category: 'fraud_detection', description: '', rules: [], selectedModels: [], triggerRetraining: true });
              }}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {policies.map((policy) => (
          <div key={policy.id} className="bg-white rounded-lg shadow border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{policy.name}</h3>
              <span className={`px-2 py-1 rounded text-xs ${
                policy.status === 'active' ? 'bg-green-100 text-green-800' :
                policy.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {policy.status}
              </span>
            </div>
            
            <div className="space-y-2 mb-4">
              <p className="text-sm"><span className="font-medium">Category:</span> {policy.category.replace('_', ' ')}</p>
              <p className="text-sm"><span className="font-medium">Rules:</span> {policy.rules.length} active</p>
              <p className="text-sm"><span className="font-medium">Applied to:</span> {policy.appliedToModels.length} models</p>
              <p className="text-sm"><span className="font-medium">Modified:</span> {new Date(policy.lastModified).toLocaleDateString()}</p>
            </div>

            <p className="text-sm text-gray-600 mb-4">{policy.description}</p>

            <div className="flex gap-2">
              <button 
                onClick={() => setSelectedPolicy(policy)}
                className="flex-1 bg-blue-500 text-white px-3 py-2 rounded text-sm hover:bg-blue-600"
              >
                Edit Policy
              </button>
              <button 
                onClick={() => handleViewRules(policy)}
                className="flex-1 bg-gray-500 text-white px-3 py-2 rounded text-sm hover:bg-gray-600"
              >
                View & Edit Rules
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-indigo-600 rounded-md flex items-center justify-center">
              <span className="text-white font-bold text-sm">🤖</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">🚗 Rideshare Fraud AI/ML Compliance Dashboard</h1>
              <p className="text-sm text-gray-500">Advanced ML models for rideshare fraud detection, driver verification, and passenger protection</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-gray-600 text-sm font-medium">CO</span>
              </div>
              <div className="hidden md:block">
                <div className="text-sm font-medium text-gray-900">{currentUser.name}</div>
                <div className="text-xs text-gray-500">{currentUser.role}</div>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
            >
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
              { id: 'models', label: 'ML Models', icon: '🤖' },
              { id: 'results', label: 'AI Results', icon: '📈' },
              { id: 'policies', label: 'Policies', icon: '📋' },
              { id: 'training', label: 'Model Training', icon: '🎯' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
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
        {activeTab === 'models' && renderMLModels()}
        {activeTab === 'policies' && renderPolicies()}
        {activeTab === 'results' && (
          <div className="bg-white p-8 rounded-lg shadow border">
            <h2 className="text-xl font-semibold mb-4">AI Prediction Results</h2>
            <div className="space-y-4">
              {aiResults.map(result => (
                <div key={result.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold">{result.modelName}</h3>
                    <span className="text-xs text-gray-500">{new Date(result.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-sm font-medium mb-2">Prediction: {result.prediction}</p>
                  <p className="text-sm mb-2">Confidence: {Math.round(result.confidence * 100)}% | Risk Score: {result.riskScore}/10</p>
                  <div className="text-xs text-gray-600">
                    <strong>Factors:</strong> {result.factors.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab === 'training' && (
          <div className="space-y-6">
            {/* Policy-to-Model Training Section */}
            <div className="bg-white p-6 rounded-lg shadow border">
              <h2 className="text-xl font-semibold mb-4">🤖 AI/ML Model Training Center</h2>
              <p className="text-sm text-gray-600 mb-6">
                Train models with new policies to improve financial fraud detection capabilities
              </p>
              
              {/* Policy Application Status */}
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">Active Policy Applications</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {policies.filter(p => p.appliedToModels.length > 0).map(policy => (
                    <div key={policy.id} className="border rounded p-4 bg-blue-50">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-blue-800">{policy.name}</h4>
                        <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">
                          {policy.appliedToModels.length} models
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{policy.description}</p>
                      <div className="text-xs text-gray-500">
                        <strong>Applied to:</strong> {policy.appliedToModels.map(modelId => {
                          const model = mlModels.find(m => m.id === modelId);
                          return model?.name;
                        }).filter(Boolean).join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Individual Model Training */}
              <h3 className="text-lg font-medium mb-3">Individual Model Training</h3>
              <div className="space-y-4">
                {mlModels.map(model => {
                  const appliedPolicies = policies.filter(p => p.appliedToModels.includes(model.id));
                  return (
                    <div key={model.id} className="border rounded p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium">{model.name}</h3>
                            <span className={`px-2 py-1 rounded text-xs ${
                              model.status === 'active' ? 'bg-green-100 text-green-800' :
                              model.status === 'training' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {model.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">Current Accuracy: {model.accuracy.toFixed(1)}%</p>
                          <div className="text-xs text-gray-500 mt-1">
                            <strong>Learning from {appliedPolicies.length} policies:</strong> {appliedPolicies.map(p => p.name).join(', ')}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRetrainModel(model.id)}
                            className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                            disabled={model.status === 'training'}
                          >
                            {model.status === 'training' ? 'Training...' : 'Retrain Model'}
                          </button>
                          <button 
                            onClick={() => handleScheduleTraining(model.id)}
                            className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                          >
                            Schedule Training
                          </button>
                        </div>
                      </div>
                      
                      {/* Training Progress Simulation */}
                      {model.status === 'training' && (
                        <div className="mt-3 p-3 bg-yellow-50 rounded">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-yellow-800">📊 Training in Progress</span>
                            <span className="text-xs text-yellow-600">Learning from {appliedPolicies.length} policies</span>
                          </div>
                          <div className="w-full bg-yellow-200 rounded-full h-2">
                            <div className="bg-yellow-600 h-2 rounded-full" style={{width: '75%'}}></div>
                          </div>
                          <p className="text-xs text-yellow-600 mt-1">Analyzing patterns and updating fraud detection algorithms...</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Bulk Training Actions */}
              <div className="mt-6 p-4 bg-gray-50 rounded">
                <h3 className="font-medium mb-3">Bulk Training Operations</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (confirm(`🚀 Retrain ALL ${mlModels.length} Models?\n\nThis will retrain all rideshare fraud detection models simultaneously with the latest policies and data.\n\n⚠️ All models will be temporarily unavailable during training.\n\nEstimated time: 15-30 minutes\n\nProceed with bulk retraining?`)) {
                        mlModels.forEach(model => handleRetrainModel(model.id));
                        setMessage(`🔄 Bulk retraining started for all ${mlModels.length} models!`);
                        setTimeout(() => setMessage(''), 4000);
                      }
                    }}
                    className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
                  >
                    Retrain All Models
                  </button>
                  <button
                    onClick={() => {
                      const time = prompt('🌙 Schedule Nightly Training\n\nEnter training time (24-hour format):', '02:00');
                      if (time) {
                        setMessage(`🕐 All ${mlModels.length} models scheduled for nightly retraining at ${time} with latest policies!`);
                        setTimeout(() => setMessage(''), 4000);
                      }
                    }}
                    className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                  >
                    Schedule Nightly Training
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Model Details Modal */}
      {selectedModel && showModelDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 max-h-90vh overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">🤖 {selectedModel.name}</h2>
              <span className={`px-3 py-1 rounded text-sm ${
                selectedModel.status === 'active' ? 'bg-green-100 text-green-800' :
                selectedModel.status === 'training' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {selectedModel.status.toUpperCase()}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-3">
                <h3 className="font-medium text-lg mb-3">Model Information</h3>
                <p><strong>Type:</strong> {selectedModel.type.replace('_', ' ').toUpperCase()}</p>
                <p><strong>Accuracy:</strong> <span className="text-green-600 font-semibold">{selectedModel.accuracy.toFixed(1)}%</span></p>
                <p><strong>Version:</strong> {selectedModel.version}</p>
                <p><strong>Total Predictions:</strong> {selectedModel.predictions.toLocaleString()}</p>
                <p><strong>Last Trained:</strong> {selectedModel.lastTrained}</p>
              </div>
              
              <div>
                <h3 className="font-medium text-lg mb-3">Performance Metrics</h3>
                <div className="bg-blue-50 p-4 rounded">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between">
                      <span>Precision:</span>
                      <span className="font-semibold">{(Math.random() * 5 + 92).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Recall:</span>
                      <span className="font-semibold">{(Math.random() * 5 + 89).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>F1-Score:</span>
                      <span className="font-semibold">{(Math.random() * 5 + 90).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>AUC-ROC:</span>
                      <span className="font-semibold">0.{(Math.random() * 10 + 90).toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Applied Policies */}
            <div className="mb-6">
              <h3 className="font-medium text-lg mb-3">Applied Policies</h3>
              <div className="space-y-2">
                {policies.filter(p => p.appliedToModels.includes(selectedModel.id)).map(policy => (
                  <div key={policy.id} className="flex items-center justify-between p-3 bg-green-50 rounded">
                    <div>
                      <span className="font-medium text-green-800">{policy.name}</span>
                      <p className="text-xs text-green-600">{policy.rules.length} rules active</p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedPolicy(policy);
                        setShowModelDetails(false);
                      }}
                      className="text-green-600 text-xs hover:text-green-800"
                    >
                      View Policy →
                    </button>
                  </div>
                ))}
                {policies.filter(p => p.appliedToModels.includes(selectedModel.id)).length === 0 && (
                  <p className="text-gray-500 text-sm italic">No policies currently applied to this model</p>
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => handleRetrainModel(selectedModel.id)}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                disabled={selectedModel.status === 'training'}
              >
                {selectedModel.status === 'training' ? 'Training...' : 'Retrain Model'}
              </button>
              <button
                onClick={() => {
                  setSelectedModel(null);
                  setShowModelDetails(false);
                }}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Policy Details Modal */}
      {selectedPolicy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 max-h-90vh overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Edit Policy: {selectedPolicy.name}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Policy Name</label>
                <input 
                  type="text" 
                  value={selectedPolicy.name}
                  className="w-full border rounded px-3 py-2"
                  onChange={(e) => setSelectedPolicy({...selectedPolicy, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea 
                  value={selectedPolicy.description}
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                  onChange={(e) => setSelectedPolicy({...selectedPolicy, description: e.target.value})}
                />
              </div>
              <div>
                <h3 className="font-medium mb-2">Policy Rules:</h3>
                <div className="space-y-2">
                  {selectedPolicy.rules.map(rule => (
                    <div key={rule.id} className="border rounded p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">Rule {rule.priority}</span>
                        <label className="flex items-center">
                          <input type="checkbox" checked={rule.enabled} className="mr-2" />
                          Enabled
                        </label>
                      </div>
                      <p className="text-sm"><strong>Condition:</strong> {rule.condition}</p>
                      <p className="text-sm"><strong>Action:</strong> {rule.action}</p>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => handleAddNewRule(selectedPolicy.id)}
                  className="mt-2 bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                >
                  Add New Rideshare Rule
                </button>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  if (confirm(`💾 Save Policy Changes?\n\nPolicy: ${selectedPolicy.name}\nRules: ${selectedPolicy.rules.length}\nApplied to: ${selectedPolicy.appliedToModels.length} model(s)\n\nThis will update the policy and may trigger model retraining.\n\nSave changes?`)) {
                    setPolicies(policies.map(p => p.id === selectedPolicy.id ? selectedPolicy : p));
                    setMessage(`✅ Policy "${selectedPolicy.name}" updated successfully by ${currentUser.name}!`);
                    setTimeout(() => setMessage(''), 3000);
                    setSelectedPolicy(null);
                  }
                }}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                💾 Save Changes
              </button>
              <button
                onClick={() => setSelectedPolicy(null)}
                className="bg-gray-500 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules Viewer/Editor Modal */}
      {selectedPolicyForRules && showRulesViewer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-90vh overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">📜 Rules Editor: {selectedPolicyForRules.name}</h2>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs ${
                  selectedPolicyForRules.status === 'active' ? 'bg-green-100 text-green-800' :
                  selectedPolicyForRules.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {selectedPolicyForRules.status.toUpperCase()}
                </span>
              </div>
            </div>
            
            <div className="mb-6 p-4 bg-blue-50 rounded">
              <p className="text-sm text-blue-800"><strong>Description:</strong> {selectedPolicyForRules.description}</p>
              <p className="text-xs text-blue-600 mt-1">
                <strong>Created by:</strong> {selectedPolicyForRules.createdBy} | 
                <strong>Last Modified:</strong> {new Date(selectedPolicyForRules.lastModified).toLocaleDateString()} |
                <strong>Applied to:</strong> {selectedPolicyForRules.appliedToModels.length} model(s)
              </p>
            </div>
            
            {/* Rules List */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Policy Rules ({selectedPolicyForRules.rules.length})</h3>
                <button
                  onClick={addRuleToViewer}
                  className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                >
                  + Add New Rule
                </button>
              </div>
              
              <div className="space-y-4 max-h-60 overflow-y-auto">
                {selectedPolicyForRules.rules.map((rule, index) => (
                  <div key={rule.id} className="border rounded p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-sm">Rule {index + 1} (Priority: {rule.priority})</span>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center text-xs">
                          <input
                            type="checkbox"
                            checked={rule.enabled}
                            onChange={(e) => updateRuleInViewer(rule.id, 'enabled', e.target.checked)}
                            className="mr-1"
                          />
                          Enabled
                        </label>
                        <button
                          onClick={() => removeRuleFromViewer(rule.id)}
                          className="text-red-500 text-xs hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Condition</label>
                        <input
                          type="text"
                          value={rule.condition}
                          onChange={(e) => updateRuleInViewer(rule.id, 'condition', e.target.value)}
                          className="w-full border rounded px-2 py-1 text-sm"
                          placeholder="e.g., fareAmount > expectedFare * 2.0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Action</label>
                        <select
                          value={rule.action}
                          onChange={(e) => updateRuleInViewer(rule.id, 'action', e.target.value)}
                          className="w-full border rounded px-2 py-1 text-sm"
                        >
                          <option value="">Select Action...</option>
                          <option value="ALERT_HIGH_PRIORITY">High Priority Alert</option>
                          <option value="ALERT_MEDIUM_PRIORITY">Medium Priority Alert</option>
                          <option value="REQUIRE_MANUAL_REVIEW">Require Manual Review</option>
                          <option value="BLOCK_TRANSACTION">Block Transaction</option>
                          <option value="FLAG_FOR_INVESTIGATION">Flag for Investigation</option>
                          <option value="SUSPEND_ACCOUNT">Suspend Account</option>
                          <option value="REQUIRE_VERIFICATION">Require Verification</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <label className="text-xs">
                        Priority:
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={rule.priority}
                          onChange={(e) => updateRuleInViewer(rule.id, 'priority', parseInt(e.target.value))}
                          className="ml-1 w-16 border rounded px-1 py-0.5 text-xs"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Applied Models */}
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2">Applied to Models</h3>
              <div className="flex flex-wrap gap-2">
                {selectedPolicyForRules.appliedToModels.map(modelId => {
                  const model = mlModels.find(m => m.id === modelId);
                  return model ? (
                    <span key={modelId} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                      {model.name}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleSaveRulesChanges}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                ✅ Save Changes
              </button>
              <button
                onClick={() => {
                  setShowRulesViewer(false);
                  setSelectedPolicyForRules(null);
                }}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplianceWorkingDashboard;