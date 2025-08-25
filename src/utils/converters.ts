// Type conversion utilities for Fleet Fraud Dashboard
import { Driver, KPIData, RiskLevel, BackendDriver, FraudStats } from '@/types';

// Convert backend driver to frontend driver format
export function backendDriverToDriver(backendDriver: BackendDriver): Driver {
  // Determine risk level based on risk_score
  let riskLevel: RiskLevel = 'low';
  if (backendDriver.risk_score) {
    if (backendDriver.risk_score >= 0.7) {
      riskLevel = 'critical';
    } else if (backendDriver.risk_score >= 0.5) {
      riskLevel = 'high';
    } else if (backendDriver.risk_score >= 0.3) {
      riskLevel = 'medium';
    }
  } else if (backendDriver.recent_fraud_alerts && backendDriver.recent_fraud_alerts.length > 0) {
    // If no risk_score, determine from recent alerts
    const highSeverityAlerts = backendDriver.recent_fraud_alerts.filter(
      alert => ['high', 'critical'].includes(alert.severity)
    );
    if (highSeverityAlerts.length > 2) {
      riskLevel = 'high';
    } else if (backendDriver.recent_fraud_alerts.length > 3) {
      riskLevel = 'medium';
    }
  }

  return {
    id: backendDriver.id,
    name: `${backendDriver.first_name} ${backendDriver.last_name}`,
    licenseNumber: backendDriver.license_number,
    vehicleId: backendDriver.current_trip?.vehicle?.vehicle_number || 'N/A',
    email: backendDriver.email || '',
    phone: backendDriver.phone || '',
    hireDate: backendDriver.hire_date || backendDriver.created_at,
    status: backendDriver.status,
    riskLevel,
    totalMiles: 0, // This would need to be calculated from trips
    violations: backendDriver.recent_fraud_alerts?.length || 0,
    lastActivity: backendDriver.updated_at,
    fraudScore: backendDriver.risk_score ? backendDriver.risk_score * 100 : 0,
  };
}

// Convert fraud stats to KPI data format
export function fraudStatsToKPIs(stats: FraudStats): KPIData[] {
  const kpis: KPIData[] = [];

  // Total fraud alerts KPI
  kpis.push({
    id: 'fraud-alerts',
    title: 'Fraud Alerts',
    value: stats.statistics.total_alerts,
    previousValue: getPreviousPeriodValue(stats.statistics.trends, 'total_alerts'),
    format: 'number',
    description: 'Total fraud alerts detected',
    status: stats.statistics.total_alerts > 50 ? 'danger' : stats.statistics.total_alerts > 20 ? 'warning' : 'good',
  });

  // High severity alerts
  const highSeverityCount = (stats.statistics.by_severity.high || 0) + (stats.statistics.by_severity.critical || 0);
  kpis.push({
    id: 'high-severity-alerts',
    title: 'High Risk Alerts',
    value: highSeverityCount,
    previousValue: getPreviousPeriodValue(stats.statistics.trends, 'high_severity'),
    format: 'number',
    description: 'Critical and high severity fraud alerts',
    status: highSeverityCount > 10 ? 'danger' : highSeverityCount > 5 ? 'warning' : 'good',
  });

  // Open alerts
  const openAlerts = stats.statistics.by_status.open || 0;
  kpis.push({
    id: 'open-alerts',
    title: 'Open Alerts',
    value: openAlerts,
    previousValue: getPreviousPeriodValue(stats.statistics.trends, 'open_alerts'),
    format: 'number',
    description: 'Alerts requiring investigation',
    status: openAlerts > 20 ? 'danger' : openAlerts > 10 ? 'warning' : 'good',
  });

  // Resolution rate
  const resolvedAlerts = stats.statistics.by_status.resolved || 0;
  const resolutionRate = stats.statistics.total_alerts > 0 
    ? (resolvedAlerts / stats.statistics.total_alerts) * 100 
    : 0;
  
  kpis.push({
    id: 'resolution-rate',
    title: 'Resolution Rate',
    value: resolutionRate,
    previousValue: getPreviousPeriodValue(stats.statistics.trends, 'resolution_rate'),
    format: 'percentage',
    description: 'Percentage of alerts resolved',
    status: resolutionRate > 80 ? 'good' : resolutionRate > 60 ? 'warning' : 'danger',
    target: 85,
  });

  return kpis;
}

// Helper function to calculate previous period values from trends
function getPreviousPeriodValue(trends: Record<string, any>, metric: string): number {
  // Simple implementation - in a real scenario, you'd compare current vs previous period
  const trendDates = Object.keys(trends).sort();
  if (trendDates.length < 2) return 0;

  const currentPeriod = trends[trendDates[trendDates.length - 1]];
  const previousPeriod = trends[trendDates[trendDates.length - 2]];

  switch (metric) {
    case 'total_alerts':
      return previousPeriod.total || 0;
    case 'high_severity':
      return (previousPeriod.by_type?.high || 0) + (previousPeriod.by_type?.critical || 0);
    default:
      return 0;
  }
}

// Calculate fraud trend for risk scoring
export function calculateFraudTrend(alerts: Array<{ created_at: string; severity: string }>): number[] {
  // Create a 7-day trend array
  const trend: number[] = new Array(7).fill(0);
  const now = new Date();

  alerts.forEach(alert => {
    const alertDate = new Date(alert.created_at);
    const daysDiff = Math.floor((now.getTime() - alertDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff >= 0 && daysDiff < 7) {
      // Weight alerts by severity
      const weight = alert.severity === 'critical' ? 3 : alert.severity === 'high' ? 2 : 1;
      trend[6 - daysDiff] += weight; // Reverse order to show recent first
    }
  });

  return trend;
}

// Format alert type for display
export function formatAlertType(type: string): string {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Get risk level from score
export function getRiskLevelFromScore(score: number): RiskLevel {
  if (score >= 70) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

// Calculate percentage change
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

// Format time ago
export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  
  return date.toLocaleDateString();
}

// Validate API response
export function isValidApiResponse<T>(response: any): response is { success: boolean; data: T } {
  return response && typeof response.success === 'boolean';
}

export default {
  backendDriverToDriver,
  fraudStatsToKPIs,
  calculateFraudTrend,
  formatAlertType,
  getRiskLevelFromScore,
  calculatePercentageChange,
  formatTimeAgo,
  isValidApiResponse,
};