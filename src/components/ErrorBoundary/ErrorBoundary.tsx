import React, { Component, ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  showDetails?: boolean;
}

/**
 * ErrorBoundary Component
 * 
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing.
 * 
 * Features:
 * - Graceful error handling for API failures
 * - Custom fallback UI
 * - Error reporting
 * - Development-friendly error details
 * - Retry functionality
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });

    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, you might want to send error to monitoring service
    // logErrorToService(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-[200px] flex items-center justify-center p-6 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-center max-w-md">
            <div className="text-red-400 text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              Something went wrong
            </h3>
            <p className="text-red-600 mb-4">
              We encountered an unexpected error. Please try refreshing the page.
            </p>
            
            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                aria-label="Retry the failed operation"
              >
                Try Again
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors ml-3"
                aria-label="Refresh the entire page"
              >
                Refresh Page
              </button>
            </div>

            {/* Show error details in development */}
            {this.props.showDetails && this.state.error && process.env.NODE_ENV === 'development' && (
              <details className="mt-4 text-left bg-white p-4 rounded border">
                <summary className="text-red-800 font-medium cursor-pointer">
                  Error Details (Development)
                </summary>
                <div className="mt-2 text-sm text-gray-700">
                  <p className="font-semibold text-red-700">Error:</p>
                  <p className="font-mono text-xs bg-gray-100 p-2 rounded mb-2">
                    {this.state.error.toString()}
                  </p>
                  
                  {this.state.errorInfo && (
                    <>
                      <p className="font-semibold text-red-700">Component Stack:</p>
                      <pre className="font-mono text-xs bg-gray-100 p-2 rounded whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * APIErrorBoundary - Specialized boundary for API-related errors
 */
export const APIErrorBoundary: React.FC<{
  children: ReactNode;
  apiName?: string;
  onRetry?: () => void;
}> = ({ children, apiName = 'API', onRetry }) => (
  <ErrorBoundary
    fallback={
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-yellow-800">
              {apiName} Temporarily Unavailable
            </h3>
            <p className="text-sm text-yellow-700 mt-1">
              We're having trouble connecting to our servers. Using cached data for now.
            </p>
          </div>
          {onRetry && (
            <div className="ml-4">
              <button
                onClick={onRetry}
                className="text-yellow-600 hover:text-yellow-500 text-sm font-medium"
                aria-label={`Retry ${apiName} connection`}
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    }
    showDetails={true}
  >
    {children}
  </ErrorBoundary>
);

/**
 * ComponentErrorBoundary - Lightweight boundary for individual components
 */
export const ComponentErrorBoundary: React.FC<{
  children: ReactNode;
  componentName: string;
}> = ({ children, componentName }) => (
  <ErrorBoundary
    fallback={
      <div className="p-4 bg-gray-50 border border-gray-200 rounded text-center">
        <p className="text-gray-600 text-sm">
          {componentName} is temporarily unavailable
        </p>
        <button
          onClick={() => window.location.reload()}
          className="text-blue-600 hover:text-blue-500 text-sm mt-2"
          aria-label={`Refresh page to reload ${componentName}`}
        >
          Refresh to try again
        </button>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);

export default ErrorBoundary;