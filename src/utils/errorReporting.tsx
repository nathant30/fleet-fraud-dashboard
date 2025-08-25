/**
 * Error Reporting Utility
 * 
 * Provides centralized error logging and monitoring for the Fleet Fraud Dashboard
 * with support for different environments and error severity levels.
 */
import React from 'react';

interface ErrorReport {
  error: Error;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  component?: string;
  timestamp: string;
  userAgent?: string;
  url?: string;
}

interface ErrorReportingConfig {
  enableConsoleLogging: boolean;
  enableRemoteLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  remoteEndpoint?: string;
  apiKey?: string;
  maxRetries?: number;
}

class ErrorReportingService {
  private config: ErrorReportingConfig;
  private sessionId: string;

  constructor(config: Partial<ErrorReportingConfig> = {}) {
    this.config = {
      enableConsoleLogging: true,
      enableRemoteLogging: false,
      logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'error',
      maxRetries: 3,
      ...config,
    };

    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private shouldLog(severity: ErrorReport['severity']): boolean {
    const severityLevels = { debug: 0, info: 1, warn: 2, error: 3 };
    const configLevel = severityLevels[this.config.logLevel];
    
    const errorLevel = severity === 'low' ? 1 : 
                      severity === 'medium' ? 2 : 
                      severity === 'high' ? 3 : 4;
                      
    return errorLevel >= configLevel;
  }

  private formatErrorForConsole(report: ErrorReport): void {
    const timestamp = new Date(report.timestamp).toLocaleTimeString();
    const prefix = `[${timestamp}] Fleet Dashboard Error (${report.severity.toUpperCase()})`;
    
    console.group(`🚨 ${prefix}`);
    console.error('Error:', report.error.message);
    console.error('Stack:', report.error.stack);
    
    if (report.component) {
      console.info('Component:', report.component);
    }
    
    if (report.context && Object.keys(report.context).length > 0) {
      console.info('Context:', report.context);
    }
    
    console.info('Session ID:', report.sessionId);
    console.groupEnd();
  }

  private async sendToRemote(report: ErrorReport, retryCount = 0): Promise<void> {
    if (!this.config.enableRemoteLogging || !this.config.remoteEndpoint) {
      return;
    }

    try {
      const response = await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
        },
        body: JSON.stringify(report),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (networkError) {
      if (retryCount < (this.config.maxRetries || 3)) {
        setTimeout(() => {
          this.sendToRemote(report, retryCount + 1);
        }, Math.pow(2, retryCount) * 1000); // Exponential backoff
      } else {
        console.warn('Failed to send error report after retries:', networkError);
      }
    }
  }

  /**
   * Report an error with context information
   */
  public async reportError(
    error: Error,
    severity: ErrorReport['severity'] = 'medium',
    options: {
      component?: string;
      context?: Record<string, any>;
      userId?: string;
    } = {}
  ): Promise<void> {
    if (!this.shouldLog(severity)) {
      return;
    }

    const report: ErrorReport = {
      error,
      severity,
      context: options.context,
      userId: options.userId,
      sessionId: this.sessionId,
      component: options.component,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    };

    // Console logging
    if (this.config.enableConsoleLogging) {
      this.formatErrorForConsole(report);
    }

    // Remote logging
    await this.sendToRemote(report);
  }

  /**
   * Report API errors with additional context
   */
  public async reportAPIError(
    error: Error,
    apiEndpoint: string,
    requestData?: any,
    responseStatus?: number
  ): Promise<void> {
    const severity: ErrorReport['severity'] = responseStatus && responseStatus >= 500 ? 'high' : 'medium';
    
    await this.reportError(error, severity, {
      component: 'API',
      context: {
        endpoint: apiEndpoint,
        requestData: requestData ? JSON.stringify(requestData) : undefined,
        responseStatus,
        type: 'API_ERROR',
      },
    });
  }

  /**
   * Report component errors from error boundaries
   */
  public async reportComponentError(
    error: Error,
    errorInfo: React.ErrorInfo,
    componentName: string
  ): Promise<void> {
    await this.reportError(error, 'high', {
      component: componentName,
      context: {
        componentStack: errorInfo.componentStack,
        type: 'COMPONENT_ERROR',
      },
    });
  }

  /**
   * Report performance issues
   */
  public async reportPerformanceIssue(
    metricName: string,
    value: number,
    threshold: number,
    component?: string
  ): Promise<void> {
    const error = new Error(`Performance threshold exceeded: ${metricName} (${value}ms > ${threshold}ms)`);
    
    await this.reportError(error, 'low', {
      component: component || 'Performance Monitor',
      context: {
        metricName,
        value,
        threshold,
        type: 'PERFORMANCE_ISSUE',
      },
    });
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<ErrorReportingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current session ID
   */
  public getSessionId(): string {
    return this.sessionId;
  }
}

// Global instance
export const errorReporter = new ErrorReportingService({
  enableConsoleLogging: true,
  enableRemoteLogging: process.env.NODE_ENV === 'production',
  remoteEndpoint: process.env.REACT_APP_ERROR_REPORTING_ENDPOINT,
  apiKey: process.env.REACT_APP_ERROR_REPORTING_KEY,
});

/**
 * React Hook for error reporting in functional components
 */
export const useErrorReporting = () => {
  const reportError = (
    error: Error,
    severity: ErrorReport['severity'] = 'medium',
    context?: Record<string, any>
  ) => {
    errorReporter.reportError(error, severity, { context });
  };

  const reportAPIError = (
    error: Error,
    endpoint: string,
    requestData?: any,
    responseStatus?: number
  ) => {
    errorReporter.reportAPIError(error, endpoint, requestData, responseStatus);
  };

  return { reportError, reportAPIError };
};

/**
 * Higher-order component for automatic error reporting
 * Note: Requires ErrorBoundary to be imported where this HOC is used
 */
export const withErrorReporting = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName: string
) => {
  const ComponentWithErrorReporting = (props: P) => {
    // handleError function would be used with ErrorBoundary
    // const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    //   errorReporter.reportComponentError(error, errorInfo, componentName);
    // };

    // This HOC should be used with ErrorBoundary imported at the usage site
    console.warn(`withErrorReporting: Remember to wrap ${componentName} with ErrorBoundary`);
    
    return <WrappedComponent {...props} />;
  };

  ComponentWithErrorReporting.displayName = `withErrorReporting(${componentName})`;
  return ComponentWithErrorReporting;
};

// Export types for external use
export type { ErrorReportingConfig, ErrorReport };