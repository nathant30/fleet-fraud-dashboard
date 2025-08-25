import React from 'react';
import { KPICardProps } from '@/types';
import { 
  formatKPIValue, 
  calculatePercentageChange, 
  getKPIStatusColor,
  cn 
} from '@/utils/formatters';

/**
 * KPICard Component
 * 
 * A reusable component for displaying key performance indicators with:
 * - Current value with proper formatting
 * - Change indicator with percentage and trend
 * - Status-based color coding
 * - Loading state
 * - Click handler for drill-down functionality
 * - Responsive design
 * - Accessibility features
 */
const KPICard: React.FC<KPICardProps> = ({
  data,
  loading = false,
  onClick,
  className,
}) => {
  const {
    title,
    value,
    previousValue,
    change,
    changeType,
    description,
    status = 'good',
    target,
  } = data;

  // Calculate percentage change if not provided
  const percentageChange = change ?? (
    previousValue && typeof value === 'number' && typeof previousValue === 'number'
      ? calculatePercentageChange(value, previousValue)
      : 0
  );

  // Determine change direction
  const changeDirection = changeType ?? (
    percentageChange > 0 ? 'increase' : 
    percentageChange < 0 ? 'decrease' : 'neutral'
  );

  // Get appropriate colors for status
  const statusColors = getKPIStatusColor(status);

  // Format the main value
  const formattedValue = formatKPIValue(data);

  // Determine if the card is interactive
  const isInteractive = !!onClick;

  if (loading) {
    return (
      <div className={cn(
        'bg-white rounded-lg border border-gray-200 p-6 shadow-sm',
        'animate-pulse',
        className
      )}>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/4"></div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-white rounded-lg border border-gray-200 p-6 shadow-sm transition-all duration-200',
        statusColors,
        isInteractive && 'cursor-pointer hover:shadow-md hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50',
        className
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={isInteractive ? `View details for ${title}` : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600 truncate">
          {title}
        </h3>
        {status !== 'good' && (
          <div className="flex-shrink-0">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-current bg-opacity-10">
              {status === 'warning' ? '⚠️' : '🔴'}
            </span>
          </div>
        )}
      </div>

      {/* Main Value */}
      <div className="mb-2">
        <p className="text-2xl font-bold text-gray-900">
          {formattedValue}
        </p>
      </div>

      {/* Change Indicator */}
      {(percentageChange !== 0 || changeDirection !== 'neutral') && (
        <div className="flex items-center mb-2">
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
              changeDirection === 'increase' && 'bg-green-100 text-green-800',
              changeDirection === 'decrease' && 'bg-red-100 text-red-800',
              changeDirection === 'neutral' && 'bg-gray-100 text-gray-800'
            )}
          >
            {changeDirection === 'increase' && '↗️'}
            {changeDirection === 'decrease' && '↘️'}
            {changeDirection === 'neutral' && '→'}
            {Math.abs(percentageChange).toFixed(1)}%
          </span>
          {previousValue && (
            <span className="text-xs text-gray-500 ml-2">
              vs. previous period
            </span>
          )}
        </div>
      )}

      {/* Target Progress */}
      {target && typeof value === 'number' && (
        <div className="mb-2">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Progress to target</span>
            <span>{Math.min(100, (value / target) * 100).toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                value >= target ? 'bg-green-500' : 'bg-blue-500'
              )}
              style={{
                width: `${Math.min(100, (value / target) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Description */}
      {description && (
        <p className="text-xs text-gray-500 mt-2">
          {description}
        </p>
      )}
    </div>
  );
};

export default KPICard;