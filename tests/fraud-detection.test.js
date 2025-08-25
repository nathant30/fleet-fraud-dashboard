const request = require('supertest');
const app = require('../server');

describe('Fraud Detection Accuracy Tests', () => {
  const validApiKey = process.env.API_KEY || 'test-api-key';

  describe('Speed Violation Detection', () => {
    it('should detect high-severity speed violations', async () => {
      const testData = {
        vehicleId: 'VH-TEST-001',
        speed: 95,
        speedLimit: 55,
        timestamp: new Date().toISOString(),
        location: { lat: 40.7128, lng: -74.0060 }
      };

      const response = await request(app)
        .post('/api/fraud/detect/speed')
        .set('X-API-Key', validApiKey)
        .send(testData)
        .expect(200);

      expect(response.body.isViolation).toBe(true);
      expect(response.body.severity).toBe('high');
      expect(response.body.excessSpeed).toBe(40);
    });

    it('should not flag minor speed violations', async () => {
      const testData = {
        vehicleId: 'VH-TEST-002',
        speed: 62,
        speedLimit: 55,
        timestamp: new Date().toISOString(),
        location: { lat: 40.7128, lng: -74.0060 }
      };

      const response = await request(app)
        .post('/api/fraud/detect/speed')
        .set('X-API-Key', validApiKey)
        .send(testData)
        .expect(200);

      // Minor violations (< 15 mph over) should be low severity or ignored
      expect(response.body.isViolation).toBe(false);
    });

    it('should detect critical speed violations', async () => {
      const testData = {
        vehicleId: 'VH-TEST-003',
        speed: 120,
        speedLimit: 65,
        timestamp: new Date().toISOString(),
        location: { lat: 40.7128, lng: -74.0060 }
      };

      const response = await request(app)
        .post('/api/fraud/detect/speed')
        .set('X-API-Key', validApiKey)
        .send(testData)
        .expect(200);

      expect(response.body.isViolation).toBe(true);
      expect(response.body.severity).toBe('critical');
      expect(response.body.excessSpeed).toBe(55);
    });
  });

  describe('Route Deviation Detection', () => {
    it('should detect significant route deviations', async () => {
      const testData = {
        vehicleId: 'VH-TEST-004',
        plannedRoute: [
          { lat: 40.7128, lng: -74.0060 },
          { lat: 40.7589, lng: -73.9851 }
        ],
        actualRoute: [
          { lat: 40.7128, lng: -74.0060 },
          { lat: 40.6892, lng: -74.0445 }, // Significant deviation
          { lat: 40.7589, lng: -73.9851 }
        ],
        timestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/fraud/detect/route')
        .set('X-API-Key', validApiKey)
        .send(testData)
        .expect(200);

      expect(response.body.deviationDetected).toBe(true);
      expect(response.body.deviationPercentage).toBeGreaterThan(20);
    });

    it('should allow minor route adjustments', async () => {
      const testData = {
        vehicleId: 'VH-TEST-005',
        plannedRoute: [
          { lat: 40.7128, lng: -74.0060 },
          { lat: 40.7589, lng: -73.9851 }
        ],
        actualRoute: [
          { lat: 40.7128, lng: -74.0060 },
          { lat: 40.7200, lng: -74.0000 }, // Minor deviation
          { lat: 40.7589, lng: -73.9851 }
        ],
        timestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/fraud/detect/route')
        .set('X-API-Key', validApiKey)
        .send(testData)
        .expect(200);

      expect(response.body.deviationDetected).toBe(false);
      expect(response.body.deviationPercentage).toBeLessThan(20);
    });
  });

  describe('Fuel Anomaly Detection', () => {
    it('should detect overfilling attempts', async () => {
      const testData = {
        vehicleId: 'VH-TEST-006',
        fuelAmount: 120,
        tankCapacity: 80,
        currentFuelLevel: 75,
        timestamp: new Date().toISOString(),
        location: { lat: 40.7128, lng: -74.0060 }
      };

      const response = await request(app)
        .post('/api/fraud/detect/fuel')
        .set('X-API-Key', validApiKey)
        .send(testData)
        .expect(200);

      expect(response.body.anomalyDetected).toBe(true);
      expect(response.body.anomalyType).toBe('overfilling');
      expect(response.body.excessAmount).toBe(40);
    });

    it('should detect unusual fuel efficiency patterns', async () => {
      const testData = {
        vehicleId: 'VH-TEST-007',
        distance: 100,
        fuelConsumed: 50, // Extremely poor efficiency
        historicalEfficiency: 8.5, // MPG
        vehicleType: 'sedan',
        timestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/fraud/detect/fuel-efficiency')
        .set('X-API-Key', validApiKey)
        .send(testData)
        .expect(200);

      expect(response.body.anomalyDetected).toBe(true);
      expect(response.body.anomalyType).toBe('poor_efficiency');
      expect(response.body.calculatedMPG).toBeLessThan(3);
    });

    it('should allow normal fuel consumption', async () => {
      const testData = {
        vehicleId: 'VH-TEST-008',
        fuelAmount: 45,
        tankCapacity: 80,
        currentFuelLevel: 20,
        timestamp: new Date().toISOString(),
        location: { lat: 40.7128, lng: -74.0060 }
      };

      const response = await request(app)
        .post('/api/fraud/detect/fuel')
        .set('X-API-Key', validApiKey)
        .send(testData)
        .expect(200);

      expect(response.body.anomalyDetected).toBe(false);
    });
  });

  describe('After-Hours Usage Detection', () => {
    it('should detect unauthorized after-hours usage', async () => {
      const afterHoursTime = new Date();
      afterHoursTime.setHours(2, 30, 0); // 2:30 AM

      const testData = {
        vehicleId: 'VH-TEST-009',
        driverId: 'DR-TEST-001',
        timestamp: afterHoursTime.toISOString(),
        location: { lat: 40.7128, lng: -74.0060 },
        authorizedHours: { start: '06:00', end: '22:00' }
      };

      const response = await request(app)
        .post('/api/fraud/detect/after-hours')
        .set('X-API-Key', validApiKey)
        .send(testData)
        .expect(200);

      expect(response.body.violationDetected).toBe(true);
      expect(response.body.violationType).toBe('after_hours');
    });

    it('should allow emergency or authorized after-hours use', async () => {
      const afterHoursTime = new Date();
      afterHoursTime.setHours(23, 30, 0); // 11:30 PM

      const testData = {
        vehicleId: 'VH-TEST-010',
        driverId: 'DR-TEST-002',
        timestamp: afterHoursTime.toISOString(),
        location: { lat: 40.7128, lng: -74.0060 },
        emergencyOverride: true
      };

      const response = await request(app)
        .post('/api/fraud/detect/after-hours')
        .set('X-API-Key', validApiKey)
        .send(testData)
        .expect(200);

      expect(response.body.violationDetected).toBe(false);
    });
  });

  describe('Odometer Tampering Detection', () => {
    it('should detect odometer rollbacks', async () => {
      const testData = {
        vehicleId: 'VH-TEST-011',
        currentOdometer: 98500,
        previousOdometer: 99200,
        timeDifference: 24, // 24 hours
        timestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/fraud/detect/odometer')
        .set('X-API-Key', validApiKey)
        .send(testData)
        .expect(200);

      expect(response.body.tamperingDetected).toBe(true);
      expect(response.body.tamperingType).toBe('rollback');
      expect(response.body.discrepancy).toBe(-700);
    });

    it('should detect impossible mileage increases', async () => {
      const testData = {
        vehicleId: 'VH-TEST-012',
        currentOdometer: 100500,
        previousOdometer: 100000,
        timeDifference: 1, // 1 hour
        timestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/fraud/detect/odometer')
        .set('X-API-Key', validApiKey)
        .send(testData)
        .expect(200);

      expect(response.body.tamperingDetected).toBe(true);
      expect(response.body.tamperingType).toBe('impossible_increase');
      expect(response.body.calculatedSpeed).toBeGreaterThan(400); // 500 mph is impossible
    });

    it('should allow normal odometer progression', async () => {
      const testData = {
        vehicleId: 'VH-TEST-013',
        currentOdometer: 100150,
        previousOdometer: 100000,
        timeDifference: 168, // 1 week
        timestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/fraud/detect/odometer')
        .set('X-API-Key', validApiKey)
        .send(testData)
        .expect(200);

      expect(response.body.tamperingDetected).toBe(false);
    });
  });

  describe('Comprehensive Fraud Analysis', () => {
    it('should calculate accurate fraud scores', async () => {
      const testData = {
        companyId: 'COMP-TEST-001',
        driverId: 'DR-TEST-014',
        vehicleId: 'VH-TEST-014',
        analysisWindow: '30d'
      };

      const response = await request(app)
        .post('/api/fraud/analyze/comprehensive')
        .set('X-API-Key', validApiKey)
        .send(testData)
        .expect(200);

      expect(response.body).toHaveProperty('fraudScore');
      expect(response.body).toHaveProperty('riskLevel');
      expect(response.body).toHaveProperty('detectedPatterns');
      
      expect(typeof response.body.fraudScore).toBe('number');
      expect(response.body.fraudScore).toBeGreaterThanOrEqual(0);
      expect(response.body.fraudScore).toBeLessThanOrEqual(100);
      
      expect(['low', 'medium', 'high', 'critical']).toContain(response.body.riskLevel);
    });

    it('should identify fraud pattern clusters', async () => {
      const response = await request(app)
        .get('/api/fraud/analytics/patterns')
        .set('X-API-Key', validApiKey)
        .query({
          companyId: 'COMP-TEST-001',
          timeframe: '7d'
        })
        .expect(200);

      expect(response.body).toHaveProperty('patterns');
      expect(Array.isArray(response.body.patterns)).toBe(true);
      
      if (response.body.patterns.length > 0) {
        response.body.patterns.forEach(pattern => {
          expect(pattern).toHaveProperty('type');
          expect(pattern).toHaveProperty('frequency');
          expect(pattern).toHaveProperty('severity');
        });
      }
    });
  });

  describe('False Positive Prevention', () => {
    it('should not flag legitimate business activities', async () => {
      const testData = {
        vehicleId: 'VH-TEST-015',
        activities: [
          {
            type: 'maintenance',
            location: { lat: 40.7128, lng: -74.0060 },
            timestamp: new Date().toISOString(),
            authorized: true
          },
          {
            type: 'fuel_purchase',
            amount: 45,
            location: { lat: 40.7200, lng: -74.0100 },
            timestamp: new Date().toISOString(),
            receipt: 'RCP-12345'
          }
        ]
      };

      const response = await request(app)
        .post('/api/fraud/validate/activities')
        .set('X-API-Key', validApiKey)
        .send(testData)
        .expect(200);

      expect(response.body.legitimateActivities).toBe(true);
      expect(response.body.flaggedActivities).toHaveLength(0);
    });

    it('should consider historical context in fraud detection', async () => {
      const testData = {
        driverId: 'DR-TEST-015',
        currentBehavior: {
          avgSpeed: 45,
          routeDeviation: 15,
          fuelEfficiency: 28
        },
        historicalProfile: {
          avgSpeed: 42,
          routeDeviation: 12,
          fuelEfficiency: 30,
          violations: 0,
          yearsOfService: 5
        }
      };

      const response = await request(app)
        .post('/api/fraud/analyze/behavioral')
        .set('X-API-Key', validApiKey)
        .send(testData)
        .expect(200);

      expect(response.body.anomalyScore).toBeLessThan(30); // Should be low for experienced driver
      expect(response.body.adjustedForHistory).toBe(true);
    });
  });
});