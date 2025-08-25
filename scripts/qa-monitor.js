#!/usr/bin/env node

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

class ContinuousQAMonitor {
  constructor() {
    this.intervalMs = 60000; // 1 minute
    this.healthCheckInterval = null;
    this.testInterval = null;
    this.alertThreshold = 3; // Alert after 3 consecutive failures
    this.consecutiveFailures = 0;
    
    this.coordPath = path.join(__dirname, '../.claude/coordination');
    this.logPath = path.join(__dirname, '../logs/qa-monitor.log');
  }

  start() {
    console.log('🔍 Starting Continuous QA Monitor...');
    
    // Immediate health check
    this.performHealthCheck();
    
    // Schedule regular health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.intervalMs);
    
    // Run full test suite every 10 minutes
    this.testInterval = setInterval(() => {
      this.runTestSuite();
    }, 10 * 60 * 1000);
    
    // Handle shutdown gracefully
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
    
    console.log('✅ QA Monitor active - checking system every minute');
  }

  async performHealthCheck() {
    const timestamp = new Date().toISOString();
    
    try {
      const serverStatus = await this.checkServerHealth();
      const apiStatus = await this.checkApiEndpoints();
      
      const status = {
        timestamp,
        server: serverStatus,
        api: apiStatus,
        overall: serverStatus.healthy && apiStatus.healthy ? 'HEALTHY' : 'DEGRADED'
      };
      
      if (status.overall === 'HEALTHY') {
        this.consecutiveFailures = 0;
        console.log(`✅ [${timestamp}] System Health: GOOD`);
      } else {
        this.consecutiveFailures++;
        console.log(`⚠️  [${timestamp}] System Health: DEGRADED (${this.consecutiveFailures} consecutive)`);
        
        if (this.consecutiveFailures >= this.alertThreshold) {
          await this.triggerAlert(status);
        }
      }
      
      await this.updateStatusFile(status);
      
    } catch (error) {
      console.error(`❌ [${timestamp}] Health check failed:`, error.message);
      await this.logError('health_check_error', error);
    }
  }

  async checkServerHealth() {
    return new Promise((resolve) => {
      const req = http.get('http://localhost:3001/health', { timeout: 5000 }, (res) => {
        let data = '';
        
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve({
              healthy: res.statusCode === 200,
              status: res.statusCode,
              uptime: result.uptime || 0,
              environment: result.environment || 'unknown'
            });
          } catch (parseError) {
            resolve({
              healthy: false,
              error: 'Invalid JSON response',
              status: res.statusCode
            });
          }
        });
      });
      
      req.on('error', (error) => {
        resolve({
          healthy: false,
          error: error.message,
          status: 'CONNECTION_FAILED'
        });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({
          healthy: false,
          error: 'Request timeout',
          status: 'TIMEOUT'
        });
      });
    });
  }

  async checkApiEndpoints() {
    const endpoints = [
      { path: '/health', requiresAuth: false },
      { path: '/api/fraud/stats', requiresAuth: true },
      { path: '/api/vehicles', requiresAuth: true }
    ];
    
    const results = await Promise.all(endpoints.map(endpoint => this.checkEndpoint(endpoint)));
    
    const healthyCount = results.filter(r => r.healthy).length;
    const totalCount = results.length;
    
    return {
      healthy: healthyCount === totalCount,
      endpoints: results,
      healthyCount,
      totalCount,
      healthRatio: (healthyCount / totalCount * 100).toFixed(1) + '%'
    };
  }

  async checkEndpoint({ path, requiresAuth }) {
    return new Promise((resolve) => {
      const options = {
        hostname: 'localhost',
        port: 3001,
        path: path,
        method: 'GET',
        timeout: 5000,
        headers: {}
      };
      
      if (requiresAuth) {
        options.headers['X-API-Key'] = 'dev-api-key-12345-change-in-production';
      }
      
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          const expectedStatus = requiresAuth ? 401 : 200; // 401 means auth working, 200 means endpoint working
          const healthy = requiresAuth ? 
            (res.statusCode === 401 || res.statusCode === 200) : 
            res.statusCode === 200;
            
          resolve({
            path,
            healthy,
            status: res.statusCode,
            requiresAuth,
            responseSize: data.length
          });
        });
      });
      
      req.on('error', (error) => {
        resolve({
          path,
          healthy: false,
          error: error.message,
          requiresAuth
        });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({
          path,
          healthy: false,
          error: 'Request timeout',
          requiresAuth
        });
      });
      
      req.end();
    });
  }

  async runTestSuite() {
    console.log('🧪 Running automated test suite...');
    
    try {
      // Run frontend tests
      const frontendResults = await this.runTests('test:frontend');
      
      // Log results
      await this.logTestResults('frontend', frontendResults);
      
      console.log(`📊 Frontend Tests: ${frontendResults.success ? 'PASSED' : 'FAILED'}`);
      
    } catch (error) {
      console.error('❌ Test suite execution failed:', error.message);
      await this.logError('test_suite_error', error);
    }
  }

  async runTests(scriptName) {
    return new Promise((resolve) => {
      const child = spawn('npm', ['run', scriptName], {
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe'
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => stdout += data);
      child.stderr.on('data', (data) => stderr += data);
      
      child.on('close', (code) => {
        const success = code === 0;
        const passedMatch = stdout.match(/(\\d+) passing/);
        const failedMatch = stdout.match(/(\\d+) failing/);
        
        resolve({
          success,
          code,
          passed: passedMatch ? parseInt(passedMatch[1]) : 0,
          failed: failedMatch ? parseInt(failedMatch[1]) : 0,
          stdout: stdout.slice(-1000), // Last 1000 chars
          stderr: stderr.slice(-1000)
        });
      });
    });
  }

  async updateStatusFile(status) {
    try {
      const statusPath = path.join(this.coordPath, 'STATUS.md');
      let content = fs.readFileSync(statusPath, 'utf8');
      
      // Update QA Agent status
      const qaStatus = status.overall === 'HEALTHY' ? '✅ MONITORING' : '⚠️ DEGRADED';
      content = content.replace(
        /\*\*QA Agent\*\*: .*/,
        `**QA Agent**: ${qaStatus} - Last Check: ${status.timestamp.split('T')[1].split('.')[0]}`
      );
      
      fs.writeFileSync(statusPath, content);
    } catch (error) {
      console.warn('Failed to update status file:', error.message);
    }
  }

  async triggerAlert(status) {
    console.log('🚨 ALERT: System degradation detected!');
    
    const alertData = {
      timestamp: new Date().toISOString(),
      consecutiveFailures: this.consecutiveFailures,
      serverHealth: status.server.healthy,
      apiHealth: status.api.healthy,
      details: status
    };
    
    // Write alert to handoffs file
    const handoffsPath = path.join(this.coordPath, 'HANDOFFS.md');
    const alertSection = `
## 🚨 QA ALERT: System Degradation Detected
**Date**: ${new Date().toISOString().split('T')[0]}
**Priority**: HIGH
**Issue Type**: System Health Degradation

### Issue Description
Continuous QA monitoring detected ${this.consecutiveFailures} consecutive health check failures.

**System Status:**
- Server Health: ${status.server.healthy ? '✅ HEALTHY' : '❌ DEGRADED'}
- API Health: ${status.api.healthy ? '✅ HEALTHY' : '❌ DEGRADED'}
- API Success Rate: ${status.api.healthRatio}

### Immediate Actions Required
1. Check server logs for error patterns
2. Verify API endpoint availability
3. Run full diagnostic test suite
4. Investigate resource utilization

### Test Case to Verify Fix
Run: \`npm run test:qa\` and verify all systems return to healthy status.

---

`;
    
    try {
      let handoffsContent = fs.readFileSync(handoffsPath, 'utf8');
      handoffsContent = alertSection + handoffsContent;
      fs.writeFileSync(handoffsPath, handoffsContent);
    } catch (error) {
      console.error('Failed to write alert to handoffs:', error.message);
    }
    
    await this.logError('system_alert', new Error(JSON.stringify(alertData)));
  }

  async logTestResults(category, results) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      category,
      success: results.success,
      passed: results.passed,
      failed: results.failed,
      code: results.code
    };
    
    try {
      fs.appendFileSync(this.logPath, JSON.stringify(logEntry) + '\\n');
    } catch (error) {
      console.warn('Failed to write test results to log:', error.message);
    }
  }

  async logError(type, error) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type,
      error: error.message,
      stack: error.stack
    };
    
    try {
      fs.appendFileSync(this.logPath, JSON.stringify(logEntry) + '\\n');
    } catch (error) {
      console.warn('Failed to write error to log:', error.message);
    }
  }

  shutdown() {
    console.log('\\n🛑 Shutting down QA Monitor...');
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.testInterval) {
      clearInterval(this.testInterval);
    }
    
    console.log('✅ QA Monitor shutdown complete');
    process.exit(0);
  }
}

// Start monitor if called directly
if (require.main === module) {
  const monitor = new ContinuousQAMonitor();
  monitor.start();
}

module.exports = ContinuousQAMonitor;