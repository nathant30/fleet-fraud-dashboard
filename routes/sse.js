const express = require('express');
const { validateToken, validateApiKey } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Store active SSE connections
const sseConnections = new Map();

// Server-Sent Events endpoint for real-time fraud alerts
router.get('/alerts/stream', async (req, res) => {
  // Manual authentication for SSE since EventSource doesn't support custom headers
  try {
    const apiKey = req.query.apikey || req.headers['x-api-key'];
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    
    // Validate API key
    if (!apiKey || apiKey !== process.env.API_SECRET_KEY) {
      return res.status(401).json({ error: 'Invalid or missing API key' });
    }

    // Validate JWT token
    if (!token) {
      return res.status(401).json({ error: 'Invalid or missing token' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const companyId = decoded.company_id || 'dev-company-1';
    const userId = decoded.sub;
    const connectionId = `${userId}_${Date.now()}`;

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*',
      'Access-Control-Allow-Credentials': 'true'
    });

    // Initial connection message
    res.write(`data: ${JSON.stringify({
      type: 'connection_established',
      message: 'Real-time fraud alerts stream connected',
      timestamp: new Date().toISOString(),
      connection_id: connectionId
    })}\\n\\n`);

    // Store connection
    sseConnections.set(connectionId, {
      res,
      companyId,
      userId,
      connectedAt: new Date(),
      lastHeartbeat: new Date()
    });

    logger.info('SSE connection established', {
      connectionId,
      companyId,
      userId,
      totalConnections: sseConnections.size
    });

    // Keep connection alive with heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      if (sseConnections.has(connectionId)) {
        try {
          res.write(`data: ${JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString()
          })}\\n\\n`);
          
          sseConnections.get(connectionId).lastHeartbeat = new Date();
        } catch (error) {
          logger.warn('SSE heartbeat failed', { connectionId, error: error.message });
          cleanup();
        }
      } else {
        clearInterval(heartbeat);
      }
    }, 30000);

    // Cleanup function
    const cleanup = () => {
      clearInterval(heartbeat);
      sseConnections.delete(connectionId);
      
      logger.info('SSE connection closed', {
        connectionId,
        totalConnections: sseConnections.size
      });
      
      try {
        res.end();
      } catch (error) {
        // Connection already closed
      }
    };

    // Handle client disconnect
    req.on('close', cleanup);
    req.on('aborted', cleanup);
    
    // Handle connection errors
    res.on('error', (error) => {
      logger.warn('SSE connection error', { connectionId, error: error.message });
      cleanup();
    });

  } catch (error) {
    logger.error('SSE authentication error:', error);
    res.status(401).json({
      error: 'Authentication failed',
      message: error.message
    });
  }
});

// Send fraud alert to all connected clients for a company
function broadcastFraudAlert(companyId, alertData) {
  const connectionsToRemove = [];
  
  sseConnections.forEach((connection, connectionId) => {
    if (connection.companyId === companyId) {
      try {
        const eventData = {
          type: 'fraud_alert',
          data: alertData,
          timestamp: new Date().toISOString()
        };

        connection.res.write(`data: ${JSON.stringify(eventData)}\\n\\n`);
        
        logger.info('Fraud alert broadcasted', {
          connectionId,
          companyId,
          alertType: alertData.type,
          alertId: alertData.id
        });
      } catch (error) {
        logger.warn('Failed to broadcast to connection', {
          connectionId,
          error: error.message
        });
        connectionsToRemove.push(connectionId);
      }
    }
  });

  // Clean up failed connections
  connectionsToRemove.forEach(connectionId => {
    sseConnections.delete(connectionId);
  });
}

// Send system notification to all connected clients for a company
function broadcastSystemMessage(companyId, messageType, message, data = {}) {
  const connectionsToRemove = [];
  
  sseConnections.forEach((connection, connectionId) => {
    if (connection.companyId === companyId) {
      try {
        const eventData = {
          type: messageType,
          message,
          data,
          timestamp: new Date().toISOString()
        };

        connection.res.write(`data: ${JSON.stringify(eventData)}\\n\\n`);
        
        logger.info('System message broadcasted', {
          connectionId,
          companyId,
          messageType
        });
      } catch (error) {
        logger.warn('Failed to broadcast system message', {
          connectionId,
          error: error.message
        });
        connectionsToRemove.push(connectionId);
      }
    }
  });

  // Clean up failed connections
  connectionsToRemove.forEach(connectionId => {
    sseConnections.delete(connectionId);
  });
}

// Get connection stats endpoint
router.get('/stats', validateToken, validateApiKey, (req, res) => {
  const companyId = req.userCompanyId;
  const companyConnections = Array.from(sseConnections.values())
    .filter(conn => conn.companyId === companyId);

  const stats = {
    total_connections: sseConnections.size,
    company_connections: companyConnections.length,
    active_users: [...new Set(companyConnections.map(c => c.userId))].length,
    oldest_connection: companyConnections.length > 0 
      ? Math.min(...companyConnections.map(c => c.connectedAt.getTime()))
      : null,
    newest_connection: companyConnections.length > 0
      ? Math.max(...companyConnections.map(c => c.connectedAt.getTime()))
      : null
  };

  if (stats.oldest_connection) {
    stats.oldest_connection = new Date(stats.oldest_connection).toISOString();
  }
  if (stats.newest_connection) {
    stats.newest_connection = new Date(stats.newest_connection).toISOString();
  }

  res.json({
    success: true,
    data: stats
  });
});

// Test endpoint to manually trigger alert broadcast
router.post('/test/broadcast', validateToken, validateApiKey, (req, res) => {
  const { alert_type = 'test_alert', message = 'Test fraud alert' } = req.body;
  const companyId = req.userCompanyId;

  const testAlert = {
    id: `test_${Date.now()}`,
    type: alert_type,
    severity: 'medium',
    title: 'Test Alert',
    description: message,
    vehicle: {
      id: 'test-vehicle',
      vehicle_number: 'TEST-001'
    },
    driver: {
      id: 'test-driver',
      name: 'Test Driver'
    },
    created_at: new Date().toISOString(),
    status: 'open'
  };

  broadcastFraudAlert(companyId, testAlert);

  res.json({
    success: true,
    message: 'Test alert broadcasted successfully',
    data: {
      connections_notified: Array.from(sseConnections.values())
        .filter(conn => conn.companyId === companyId).length,
      alert: testAlert
    }
  });
});

// Clean up stale connections (run periodically)
function cleanupStaleConnections() {
  const now = new Date();
  const staleThreshold = 5 * 60 * 1000; // 5 minutes
  const connectionsToRemove = [];

  sseConnections.forEach((connection, connectionId) => {
    const timeSinceHeartbeat = now.getTime() - connection.lastHeartbeat.getTime();
    if (timeSinceHeartbeat > staleThreshold) {
      connectionsToRemove.push(connectionId);
    }
  });

  connectionsToRemove.forEach(connectionId => {
    logger.info('Removing stale SSE connection', { connectionId });
    const connection = sseConnections.get(connectionId);
    if (connection) {
      try {
        connection.res.end();
      } catch (error) {
        // Connection already closed
      }
      sseConnections.delete(connectionId);
    }
  });

  if (connectionsToRemove.length > 0) {
    logger.info('Cleaned up stale SSE connections', {
      removed: connectionsToRemove.length,
      remaining: sseConnections.size
    });
  }
}

// Run cleanup every 2 minutes
setInterval(cleanupStaleConnections, 2 * 60 * 1000);

module.exports = {
  router,
  broadcastFraudAlert,
  broadcastSystemMessage,
  getActiveConnections: () => sseConnections.size
};