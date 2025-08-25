// API utility service for Fleet Fraud Dashboard
import { ApiResponse, ApiError } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002/api';

export class ApiService {
  private static baseURL = API_BASE_URL;
  
  // Generic API request method
  private static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-api-key': 'dev-api-key-12345-change-in-production', // For development only
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZXYtdXNlci0xMjM0NSIsImVtYWlsIjoiZGV2QHRlc3QuY29tIiwiY29tcGFueV9pZCI6ImRldi1jb21wYW55LTEiLCJpYXQiOjE3NTU4NDkxMTQsImV4cCI6MTc1NTkzNTUxNH0.bkrYrdeCrzsb9Q4rxAoIVYRM09JDlg4gQCH9rlmMBM0', // Valid development JWT
    };

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // Keep default error message if response is not JSON
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Transform backend response to match our ApiResponse interface
      return {
        data: data.data || data,
        success: data.success !== false, // Default to true unless explicitly false
        message: data.message,
        total: data.pagination?.total || data.total,
        page: data.pagination?.page || data.page,
        pageSize: data.pagination?.limit || data.pageSize,
      };
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      
      // Return error in ApiResponse format
      return {
        data: null as any,
        success: false,
        message: error instanceof Error ? error.message : 'Unknown API error',
      };
    }
  }

  // GET request
  static async get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    const url = params ? `${endpoint}?${new URLSearchParams(params).toString()}` : endpoint;
    return this.request<T>(url, { method: 'GET' });
  }

  // POST request
  static async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // PUT request
  static async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // PATCH request
  static async patch<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // DELETE request
  static async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // Set authorization token for authenticated requests
  static setAuthToken(token: string) {
    this.baseURL = API_BASE_URL;
    // In production, you would store and use the token in headers
    // For now, we'll assume the backend is running without authentication
  }
}

// Specific API methods for the Fleet Fraud Dashboard
export class FraudDetectionAPI {
  // Get fraud statistics for KPI cards
  static async getFraudStats(days: number = 30): Promise<ApiResponse<any>> {
    return ApiService.get('/fraud/stats', { days });
  }

  // Get fraud alerts
  static async getFraudAlerts(params?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    severity?: string;
  }): Promise<ApiResponse<any[]>> {
    return ApiService.get('/fraud/alerts', params);
  }

  // Get driver list
  static async getDrivers(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }): Promise<ApiResponse<any[]>> {
    return ApiService.get('/drivers', params);
  }

  // Get specific driver details
  static async getDriver(id: string): Promise<ApiResponse<any>> {
    return ApiService.get(`/drivers/${id}`);
  }

  // Test fraud detection endpoints
  static async runFraudDetection(type: 'all' | 'speed-violations' | 'fuel-anomalies'): Promise<ApiResponse<any>> {
    return ApiService.post(`/fraud/detect/${type}`);
  }
}

// Server-Sent Events utility for real-time alerts
export class SSEService {
  private eventSource: EventSource | null = null;
  private listeners: Map<string, ((data: any) => void)[]> = new Map();

  constructor(private endpoint: string = '/sse/alerts/stream') {}

  connect(): void {
    if (this.eventSource) {
      this.disconnect();
    }

    // SSE doesn't support custom headers, so we pass auth via query params
    const apiKey = encodeURIComponent('dev-api-key-12345-change-in-production');
    const token = encodeURIComponent('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZXYtdXNlci0xMjM0NSIsImVtYWlsIjoiZGV2QHRlc3QuY29tIiwiY29tcGFueV9pZCI6ImRldi1jb21wYW55LTEiLCJpYXQiOjE3NTU4NDkxMTQsImV4cCI6MTc1NTkzNTUxNH0.bkrYrdeCrzsb9Q4rxAoIVYRM09JDlg4gQCH9rlmMBM0');
    const url = `${API_BASE_URL}${this.endpoint}?apikey=${apiKey}&token=${token}`;
    console.log('Connecting to SSE:', url);

    try {
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        console.log('SSE connection established');
        this.emit('connection', { status: 'connected' });
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('SSE message received:', data);
          
          // Emit specific event types
          this.emit(data.type || 'message', data);
          
          // Emit generic data event
          this.emit('data', data);
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        this.emit('error', { error: 'Connection error' });
        
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          if (this.eventSource?.readyState === EventSource.CLOSED) {
            console.log('Attempting to reconnect SSE...');
            this.connect();
          }
        }, 5000);
      };

    } catch (error) {
      console.error('Failed to establish SSE connection:', error);
      this.emit('error', { error: 'Failed to connect' });
    }
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.emit('connection', { status: 'disconnected' });
      console.log('SSE connection closed');
    }
  }

  // Add event listener
  on(eventType: string, callback: (data: any) => void): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);
  }

  // Remove event listener
  off(eventType: string, callback: (data: any) => void): void {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Emit event to listeners
  private emit(eventType: string, data: any): void {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in SSE event callback for ${eventType}:`, error);
        }
      });
    }
  }

  // Get connection status
  getStatus(): string {
    if (!this.eventSource) return 'disconnected';
    
    switch (this.eventSource.readyState) {
      case EventSource.CONNECTING: return 'connecting';
      case EventSource.OPEN: return 'connected';
      case EventSource.CLOSED: return 'disconnected';
      default: return 'unknown';
    }
  }
}

export default ApiService;