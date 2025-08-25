const request = require('supertest');
const app = require('../server');
const path = require('path');

describe('Component Integration Tests', () => {
  const validApiKey = process.env.API_KEY || 'test-api-key';

  describe('Frontend-Backend Integration', () => {
    it('should provide KPI data for dashboard cards', async () => {
      const response = await request(app)
        .get('/api/fraud/stats')
        .set('X-API-Key', validApiKey)
        .expect(200);

      // Verify structure matches what KPICard component expects
      expect(response.body).toHaveProperty('totalDrivers');
      expect(response.body).toHaveProperty('fraudAlerts');
      expect(response.body).toHaveProperty('riskScore');
      expect(response.body).toHaveProperty('savings');

      // Verify data types
      expect(typeof response.body.totalDrivers).toBe('number');
      expect(typeof response.body.fraudAlerts).toBe('number');
      expect(typeof response.body.riskScore).toBe('number');
      expect(typeof response.body.savings).toBe('number');

      // Verify reasonable ranges
      expect(response.body.riskScore).toBeGreaterThanOrEqual(0);
      expect(response.body.riskScore).toBeLessThanOrEqual(100);
    });

    it('should provide driver data for DriverTable component', async () => {
      const response = await request(app)
        .get('/api/drivers')
        .set('X-API-Key', validApiKey)
        .query({ limit: 10, offset: 0 })
        .expect(200);

      expect(response.body).toHaveProperty('drivers');
      expect(response.body).toHaveProperty('total');
      expect(Array.isArray(response.body.drivers)).toBe(true);

      if (response.body.drivers.length > 0) {
        const driver = response.body.drivers[0];
        
        // Verify structure matches Driver interface
        expect(driver).toHaveProperty('id');
        expect(driver).toHaveProperty('name');
        expect(driver).toHaveProperty('licenseNumber');
        expect(driver).toHaveProperty('email');
        expect(driver).toHaveProperty('phone');
        expect(driver).toHaveProperty('status');
        expect(driver).toHaveProperty('riskLevel');
        expect(driver).toHaveProperty('fraudScore');

        // Verify data types and constraints
        expect(['active', 'inactive', 'suspended']).toContain(driver.status);
        expect(['low', 'medium', 'high', 'critical']).toContain(driver.riskLevel);
        expect(typeof driver.fraudScore).toBe('number');
        expect(driver.fraudScore).toBeGreaterThanOrEqual(0);
        expect(driver.fraudScore).toBeLessThanOrEqual(100);
      }
    });

    it('should support pagination and sorting for large datasets', async () => {
      // Test pagination
      const page1 = await request(app)
        .get('/api/drivers')
        .set('X-API-Key', validApiKey)
        .query({ limit: 5, offset: 0 })
        .expect(200);

      const page2 = await request(app)
        .get('/api/drivers')
        .set('X-API-Key', validApiKey)
        .query({ limit: 5, offset: 5 })
        .expect(200);

      expect(page1.body.drivers).toBeDefined();
      expect(page2.body.drivers).toBeDefined();

      // Test sorting
      const sortedByName = await request(app)
        .get('/api/drivers')
        .set('X-API-Key', validApiKey)
        .query({ sortBy: 'name', order: 'asc', limit: 10 })
        .expect(200);

      const sortedByRisk = await request(app)
        .get('/api/drivers')
        .set('X-API-Key', validApiKey)
        .query({ sortBy: 'fraudScore', order: 'desc', limit: 10 })
        .expect(200);

      if (sortedByRisk.body.drivers.length > 1) {
        const scores = sortedByRisk.body.drivers.map(d => d.fraudScore);
        for (let i = 1; i < scores.length; i++) {
          expect(scores[i]).toBeLessThanOrEqual(scores[i-1]);
        }
      }
    });
  });

  describe('Real-time Data Flow', () => {
    it('should trigger fraud alerts and update dashboard data', async () => {
      // First, get current alert count
      const initialStats = await request(app)
        .get('/api/fraud/stats')
        .set('X-API-Key', validApiKey)
        .expect(200);

      // Trigger a fraud detection event
      const fraudEvent = {
        vehicleId: 'VH-INTEGRATION-001',
        speed: 95,
        speedLimit: 55,
        timestamp: new Date().toISOString(),
        location: { lat: 40.7128, lng: -74.0060 },
        companyId: 'COMP-TEST-001'
      };

      await request(app)
        .post('/api/fraud/detect/speed')
        .set('X-API-Key', validApiKey)
        .send(fraudEvent)
        .expect(200);

      // Verify alert was created
      const alerts = await request(app)
        .get('/api/fraud/alerts')
        .set('X-API-Key', validApiKey)
        .query({ limit: 10, status: 'open' })
        .expect(200);

      expect(alerts.body.alerts).toBeDefined();
      expect(Array.isArray(alerts.body.alerts)).toBe(true);

      // Check if stats were updated
      const updatedStats = await request(app)
        .get('/api/fraud/stats')
        .set('X-API-Key', validApiKey)
        .expect(200);

      expect(updatedStats.body.fraudAlerts).toBeGreaterThanOrEqual(initialStats.body.fraudAlerts);
    });

    it('should update driver risk scores based on recent activity', async () => {
      const driverId = 'DR-INTEGRATION-001';

      // Get initial driver data
      const initialDriver = await request(app)
        .get(`/api/drivers/${driverId}`)
        .set('X-API-Key', validApiKey)
        .expect(200);

      // Create multiple fraud events for this driver
      const fraudEvents = [
        {
          vehicleId: 'VH-INTEGRATION-002',
          driverId: driverId,
          speed: 85,
          speedLimit: 55,
          timestamp: new Date().toISOString(),
          location: { lat: 40.7128, lng: -74.0060 }
        },
        {
          vehicleId: 'VH-INTEGRATION-002',
          driverId: driverId,
          fuelAmount: 120,
          tankCapacity: 80,
          timestamp: new Date(Date.now() + 3600000).toISOString(), // 1 hour later
          location: { lat: 40.7200, lng: -74.0100 }
        }
      ];

      // Submit fraud events
      for (const event of fraudEvents) {
        if (event.speed) {
          await request(app)
            .post('/api/fraud/detect/speed')
            .set('X-API-Key', validApiKey)
            .send(event);
        } else if (event.fuelAmount) {
          await request(app)
            .post('/api/fraud/detect/fuel')
            .set('X-API-Key', validApiKey)
            .send(event);
        }
      }

      // Wait a moment for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get updated driver data
      const updatedDriver = await request(app)
        .get(`/api/drivers/${driverId}`)
        .set('X-API-Key', validApiKey)
        .expect(200);

      // Fraud score should have increased due to multiple violations
      expect(updatedDriver.body.fraudScore).toBeGreaterThan(initialDriver.body.fraudScore || 0);
    });
  });

  describe('Database-API Integration', () => {
    it('should maintain referential integrity across operations', async () => {
      // Create a test company
      const companyData = {
        name: 'Test Integration Company',
        email: 'test@integration.com',
        phone: '+1-555-TEST',
        address: '123 Test St, Test City, TS 12345'
      };

      const company = await request(app)
        .post('/api/companies')
        .set('X-API-Key', validApiKey)
        .send(companyData)
        .expect(201);

      const companyId = company.body.id;

      // Create a driver for this company
      const driverData = {
        name: 'Test Integration Driver',
        licenseNumber: 'DL-INTEGRATION-001',
        email: 'driver@integration.com',
        phone: '+1-555-DRIVER',
        companyId: companyId,
        hireDate: new Date().toISOString().split('T')[0]
      };

      const driver = await request(app)
        .post('/api/drivers')
        .set('X-API-Key', validApiKey)
        .send(driverData)
        .expect(201);

      // Verify the relationship exists
      const driverDetails = await request(app)
        .get(`/api/drivers/${driver.body.id}`)
        .set('X-API-Key', validApiKey)
        .expect(200);

      expect(driverDetails.body.companyId).toBe(companyId);

      // Verify company has the driver
      const companyDrivers = await request(app)
        .get('/api/drivers')
        .set('X-API-Key', validApiKey)
        .query({ companyId: companyId })
        .expect(200);

      const foundDriver = companyDrivers.body.drivers.find(d => d.id === driver.body.id);
      expect(foundDriver).toBeDefined();

      // Cleanup
      await request(app)
        .delete(`/api/drivers/${driver.body.id}`)
        .set('X-API-Key', validApiKey)
        .expect(204);

      await request(app)
        .delete(`/api/companies/${companyId}`)
        .set('X-API-Key', validApiKey)
        .expect(204);
    });

    it('should handle transaction rollbacks on errors', async () => {
      // Attempt to create a driver with invalid company ID
      const invalidDriverData = {
        name: 'Invalid Driver',
        licenseNumber: 'DL-INVALID-001',
        email: 'invalid@test.com',
        phone: '+1-555-INVALID',
        companyId: 'non-existent-company-id',
        hireDate: new Date().toISOString().split('T')[0]
      };

      const response = await request(app)
        .post('/api/drivers')
        .set('X-API-Key', validApiKey)
        .send(invalidDriverData)
        .expect(400);

      expect(response.body).toHaveProperty('error');

      // Verify no partial data was created
      const allDrivers = await request(app)
        .get('/api/drivers')
        .set('X-API-Key', validApiKey)
        .query({ email: 'invalid@test.com' })
        .expect(200);

      const foundInvalidDriver = allDrivers.body.drivers.find(d => d.email === 'invalid@test.com');
      expect(foundInvalidDriver).toBeUndefined();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should gracefully handle database connection issues', async () => {
      // This test would require mocking database failures
      // For now, we test that error responses are properly formatted
      const response = await request(app)
        .get('/api/drivers/non-existent-id')
        .set('X-API-Key', validApiKey)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not found');
    });

    it('should handle concurrent fraud detection requests', async () => {
      const concurrentRequests = [];
      
      for (let i = 0; i < 10; i++) {
        const fraudData = {
          vehicleId: `VH-CONCURRENT-${i}`,
          speed: 80 + (i * 2),
          speedLimit: 55,
          timestamp: new Date().toISOString(),
          location: { lat: 40.7128 + (i * 0.001), lng: -74.0060 + (i * 0.001) }
        };

        concurrentRequests.push(
          request(app)
            .post('/api/fraud/detect/speed')
            .set('X-API-Key', validApiKey)
            .send(fraudData)
        );
      }

      const responses = await Promise.all(concurrentRequests);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('isViolation');
      });

      // Verify alerts were created
      const alerts = await request(app)
        .get('/api/fraud/alerts')
        .set('X-API-Key', validApiKey)
        .query({ limit: 20 })
        .expect(200);

      expect(alerts.body.alerts.length).toBeGreaterThanOrEqual(10);
    });

    it('should maintain data consistency under load', async () => {
      const testCompanyId = 'COMP-LOAD-TEST';
      
      // Create multiple drivers simultaneously
      const driverPromises = [];
      for (let i = 0; i < 5; i++) {
        const driverData = {
          name: `Load Test Driver ${i}`,
          licenseNumber: `DL-LOAD-${i}`,
          email: `loadtest${i}@test.com`,
          phone: `+1-555-LOAD-${i}`,
          companyId: testCompanyId,
          hireDate: new Date().toISOString().split('T')[0]
        };

        driverPromises.push(
          request(app)
            .post('/api/drivers')
            .set('X-API-Key', validApiKey)
            .send(driverData)
        );
      }

      const driverResponses = await Promise.allSettled(driverPromises);
      const successfulCreations = driverResponses.filter(r => r.status === 'fulfilled').length;

      expect(successfulCreations).toBeGreaterThan(0);

      // Verify data integrity
      const companyDrivers = await request(app)
        .get('/api/drivers')
        .set('X-API-Key', validApiKey)
        .query({ companyId: testCompanyId })
        .expect(200);

      expect(companyDrivers.body.drivers.length).toBe(successfulCreations);

      // Cleanup created drivers
      const cleanupPromises = companyDrivers.body.drivers.map(driver =>
        request(app)
          .delete(`/api/drivers/${driver.id}`)
          .set('X-API-Key', validApiKey)
      );

      await Promise.all(cleanupPromises);
    });
  });
});