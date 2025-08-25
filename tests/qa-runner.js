#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class QATestRunner {
  constructor() {
    this.testResults = {
      frontend: { passed: 0, failed: 0, errors: [] },
      api: { passed: 0, failed: 0, errors: [] },
      database: { passed: 0, failed: 0, errors: [] },
      integration: { passed: 0, failed: 0, errors: [] },
      fraudDetection: { passed: 0, failed: 0, errors: [] }
    };
    
    this.coordPath = path.join(__dirname, '../.claude/coordination');
  }

  async runAllTests() {
    console.log('🚀 Starting Fleet Fraud Dashboard QA Test Suite');
    console.log('=' .repeat(60));

    try {
      await this.ensureCoordinationFiles();
      await this.updateStatus('QA Testing In Progress');

      // Run tests in parallel where possible
      const testPromises = [
        this.runFrontendTests(),
        this.runDatabaseTests(),
        this.runAPITests(),
        this.runFraudDetectionTests()
      ];

      await Promise.allSettled(testPromises);

      // Run integration tests last (they depend on other systems)
      await this.runIntegrationTests();

      await this.generateReport();
      await this.updateCoordinationFiles();

      console.log('\n✅ QA Test Suite Complete');
      
    } catch (error) {
      console.error('❌ QA Test Suite Failed:', error.message);
      await this.logError(error);
    }
  }

  async runFrontendTests() {
    console.log('\n📱 Running Frontend Accessibility Tests...');
    
    try {
      const result = await this.executeTest('npm test -- --testPathPattern=src/components', {
        env: { ...process.env, CI: 'true' }
      });

      this.testResults.frontend.passed = this.extractPassCount(result);
      console.log(`✅ Frontend tests passed: ${this.testResults.frontend.passed}`);
      
    } catch (error) {
      this.testResults.frontend.errors.push(error.message);
      console.log(`❌ Frontend tests failed: ${error.message}`);
    }
  }

  async runAPITests() {
    console.log('\n🔗 Running API Endpoint Tests...');
    
    try {
      // Start server in background for testing
      const serverProcess = spawn('node', ['server.js'], {
        env: { ...process.env, PORT: 3002, NODE_ENV: 'test' },
        detached: true
      });

      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 3000));

      const result = await this.executeTest('npm test -- tests/api.test.js');
      this.testResults.api.passed = this.extractPassCount(result);
      
      // Clean up
      process.kill(-serverProcess.pid);
      console.log(`✅ API tests passed: ${this.testResults.api.passed}`);
      
    } catch (error) {
      this.testResults.api.errors.push(error.message);
      console.log(`❌ API tests failed: ${error.message}`);
    }
  }

  async runDatabaseTests() {
    console.log('\n🗄️  Running Database Tests...');
    
    try {
      const result = await this.executeTest('npm test -- tests/database.test.js');
      this.testResults.database.passed = this.extractPassCount(result);
      console.log(`✅ Database tests passed: ${this.testResults.database.passed}`);
      
    } catch (error) {
      this.testResults.database.errors.push(error.message);
      console.log(`❌ Database tests failed: ${error.message}`);
    }
  }

  async runFraudDetectionTests() {
    console.log('\n🕵️  Running Fraud Detection Accuracy Tests...');
    
    try {
      const result = await this.executeTest('npm test -- tests/fraud-detection.test.js');
      this.testResults.fraudDetection.passed = this.extractPassCount(result);
      console.log(`✅ Fraud detection tests passed: ${this.testResults.fraudDetection.passed}`);
      
    } catch (error) {
      this.testResults.fraudDetection.errors.push(error.message);
      console.log(`❌ Fraud detection tests failed: ${error.message}`);
    }
  }

  async runIntegrationTests() {
    console.log('\n🔄 Running Integration Tests...');
    
    try {
      const result = await this.executeTest('npm test -- tests/integration.test.js');
      this.testResults.integration.passed = this.extractPassCount(result);
      console.log(`✅ Integration tests passed: ${this.testResults.integration.passed}`);
      
    } catch (error) {
      this.testResults.integration.errors.push(error.message);
      console.log(`❌ Integration tests failed: ${error.message}`);
    }
  }

  async executeTest(command, options = {}) {
    return new Promise((resolve, reject) => {
      exec(command, options, (error, stdout, stderr) => {
        if (error && !stdout.includes('pass')) {
          reject(new Error(`${error.message}\n${stderr}`));
        } else {
          resolve(stdout);
        }
      });
    });
  }

  extractPassCount(output) {
    const passMatch = output.match(/(\d+) passing/);
    return passMatch ? parseInt(passMatch[1]) : 0;
  }

  async generateReport() {
    console.log('\n📊 Generating Test Report...');
    
    const totalPassed = Object.values(this.testResults).reduce((sum, result) => sum + result.passed, 0);
    const totalErrors = Object.values(this.testResults).reduce((sum, result) => sum + result.errors.length, 0);
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: totalPassed + totalErrors,
        passed: totalPassed,
        failed: totalErrors,
        successRate: totalPassed > 0 ? ((totalPassed / (totalPassed + totalErrors)) * 100).toFixed(1) : 0
      },
      results: this.testResults,
      recommendations: this.generateRecommendations()
    };

    // Save report
    const reportPath = path.join(__dirname, '../tests/qa-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📈 Test Summary:`);
    console.log(`   Total Tests: ${report.summary.totalTests}`);
    console.log(`   Passed: ${report.summary.passed}`);
    console.log(`   Failed: ${report.summary.failed}`);
    console.log(`   Success Rate: ${report.summary.successRate}%`);
    
    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    
    Object.entries(this.testResults).forEach(([category, result]) => {
      if (result.errors.length > 0) {
        recommendations.push({
          category,
          priority: result.errors.length > 3 ? 'HIGH' : result.errors.length > 1 ? 'MEDIUM' : 'LOW',
          issue: `${result.errors.length} test failures in ${category}`,
          action: `Review and fix ${category} test failures`,
          errors: result.errors.slice(0, 3) // Top 3 errors
        });
      }
    });

    return recommendations;
  }

  async ensureCoordinationFiles() {
    const coordinationDir = this.coordPath;
    if (!fs.existsSync(coordinationDir)) {
      fs.mkdirSync(coordinationDir, { recursive: true });
    }

    const files = ['STATUS.md', 'ERRORS.md', 'HANDOFFS.md'];
    files.forEach(file => {
      const filePath = path.join(coordinationDir, file);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, `# ${file.replace('.md', '')}\n\n*File created by QA Runner*\n`);
      }
    });
  }

  async updateStatus(status) {
    const statusPath = path.join(this.coordPath, 'STATUS.md');
    let content = fs.readFileSync(statusPath, 'utf8');
    
    // Update the current status line
    content = content.replace(
      /## Current Status: .*/,
      `## Current Status: ${status}`
    );
    
    // Update timestamp
    content = content.replace(
      /\*\*Last Updated\*\*: .*/,
      `**Last Updated**: ${new Date().toISOString().split('T')[0]}`
    );
    
    fs.writeFileSync(statusPath, content);
  }

  async updateCoordinationFiles() {
    // Update ERRORS.md with test results
    const errorsPath = path.join(this.coordPath, 'ERRORS.md');
    const errorContent = this.generateErrorReport();
    fs.writeFileSync(errorsPath, errorContent);

    // Check if any handoffs need to be created
    await this.checkForHandoffs();
  }

  generateErrorReport() {
    const timestamp = new Date().toISOString();
    let content = `# Test Results and Error Report\n\n`;
    content += `## Summary\n`;
    content += `**Test Run**: QA Suite\n`;
    content += `**Date**: ${timestamp.split('T')[0]}\n`;
    content += `**Status**: ${Object.values(this.testResults).every(r => r.errors.length === 0) ? 'PASSED' : 'FAILED'}\n\n`;

    content += `## Issues Found\n\n`;

    Object.entries(this.testResults).forEach(([category, result]) => {
      content += `### ${category.charAt(0).toUpperCase() + category.slice(1)} Tests\n`;
      content += `- **Status**: ${result.errors.length === 0 ? 'PASSED' : 'FAILED'}\n`;
      content += `- **Passed**: ${result.passed}\n`;
      content += `- **Failed**: ${result.errors.length}\n`;
      
      if (result.errors.length > 0) {
        content += `- **Issues**:\n`;
        result.errors.forEach((error, index) => {
          content += `  ${index + 1}. ${error.split('\n')[0]}\n`;
        });
      }
      content += `\n`;
    });

    return content;
  }

  async checkForHandoffs() {
    const recommendations = this.generateRecommendations();
    
    if (recommendations.length === 0) return;

    const handoffsPath = path.join(this.coordPath, 'HANDOFFS.md');
    let content = fs.readFileSync(handoffsPath, 'utf8');
    
    // Add new handoffs
    recommendations.forEach(rec => {
      const handoffSection = `\n## Handoff to ${this.getTargetAgent(rec.category)}\n`;
      const handoffContent = `**Date**: ${new Date().toISOString().split('T')[0]}\n`;
      const priority = `**Priority**: ${rec.priority}\n`;
      const issueType = `**Issue Type**: ${rec.category} Test Failures\n\n`;
      const description = `### Issue Description\n${rec.issue}\n\n`;
      const resolution = `### Expected Resolution\n${rec.action}\n\n`;
      const testCase = `### Test Case to Verify Fix\nRun: \`npm test -- tests/${rec.category}.test.js\`\n\n`;
      
      content += handoffSection + handoffContent + priority + issueType + description + resolution + testCase;
    });
    
    fs.writeFileSync(handoffsPath, content);
  }

  getTargetAgent(category) {
    const agentMap = {
      frontend: 'Frontend Agent',
      api: 'Backend Agent',
      database: 'Database Agent',
      integration: 'Backend Agent',
      fraudDetection: 'Backend Agent'
    };
    
    return agentMap[category] || 'Development Agent';
  }

  async logError(error) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    };
    
    const logPath = path.join(__dirname, '../tests/qa-errors.log');
    fs.appendFileSync(logPath, JSON.stringify(errorLog) + '\n');
  }
}

// Run tests if called directly
if (require.main === module) {
  const runner = new QATestRunner();
  runner.runAllTests().catch(console.error);
}

module.exports = QATestRunner;