const request = require('supertest');
const app = require('../server');

describe('API Endpoint Tests', () => {
  let server;
  
  beforeAll((done) => {
    server = app.listen(3003, done); // Use different port for testing
  });
  
  afterAll((done) => {
    server.close(done);
  });

  describe('Health Check', () => {
    it('should return system status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('Authentication', () => {
    it('should accept requests with development API key in test mode', async () => {
      const response = await request(app)
        .get('/api/vehicles')
        .set('X-API-Key', 'dev-api-key-12345-change-in-production')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });

    it('should accept requests without API key in test mode', async () => {
      const response = await request(app)
        .get('/api/vehicles')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('Fraud Detection API', () => {
    const validApiKey = process.env.API_KEY || 'test-api-key';

    it('should return fraud alerts', async () => {
      const response = await request(app)
        .get('/api/fraud/alerts')
        .set('X-API-Key', validApiKey)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBeTruthy();
      expect(response.body).toHaveProperty('pagination');
    });

    it('should return fraud statistics', async () => {
      const response = await request(app)
        .get('/api/fraud/stats')
        .set('X-API-Key', validApiKey)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('statistics');
      expect(response.body.data.statistics).toHaveProperty('total_alerts');
      expect(typeof response.body.data.statistics.total_alerts).toBe('number');
    });

    it('should trigger comprehensive fraud detection', async () => {
      const response = await request(app)
        .post('/api/fraud/detect/all')
        .set('X-API-Key', validApiKey)
        .send({ companyId: 'test-company' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(typeof response.body.data).toBe('object');
      expect(response.body.data).toHaveProperty('total_alerts_created');
    });

    it('should return fraud analytics patterns', async () => {
      const response = await request(app)
        .get('/api/fraud/analytics/patterns')
        .set('X-API-Key', validApiKey)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const validApiKey = process.env.API_KEY || 'test-api-key';
      const promises = [];

      // Make 101 requests quickly to trigger rate limit
      for (let i = 0; i < 101; i++) {
        promises.push(
          request(app)
            .get('/api/fraud/alerts')
            .set('X-API-Key', validApiKey)
        );
      }

      const responses = await Promise.all(promises);
      const rateLimited = responses.some(response => response.status === 429);
      
      expect(rateLimited).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown endpoints', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .set('X-API-Key', process.env.API_KEY || 'test-api-key')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not found');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/fraud/detect/speed')
        .set('X-API-Key', process.env.API_KEY || 'test-api-key')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('CORS Configuration', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should handle preflight requests', async () => {
      const response = await request(app)
        .options('/api/fraud/alerts')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });
  });
});