import React from 'react';
import { RiskBadgeProps, RiskLevel } from '@/types';
import { getRiskLevelColor, cn } from '@/utils/formatters';

/**
 * RiskBadge Component
 * 
 * A reusable component for displaying risk levels with:
 * - Color-coded badges based on risk level
 * - Optional numeric risk score display
 * - Multiple size variants
 * - Accessible design with proper ARIA labels
 * - Hover states for interactive feedback
 */
const RiskBadge: React.FC<RiskBadgeProps> = ({
  level,
  score,
  showScore = false,
  size = 'md',
  className,
}) => {
  // Risk level configuration
  const riskConfig: Record<RiskLevel, {
    label: string;
    icon: string;
    description: string;
  }> = {
    low: {
      label: 'Low Risk',
      icon: '🟢',
      description: 'Minimal fraud risk detected',
    },
    medium: {
      label: 'Medium Risk',
      icon: '🟡',
      description: 'Moderate fraud risk - monitor closely',
    },
    high: {
      label: 'High Risk',
      icon: '🟠',
      description: 'Elevated fraud risk - requires attention',
    },
    critical: {
      label: 'Critical Risk',
      icon: '🔴',
      description: 'Severe fraud risk - immediate action required',
    },
  };

  // Size variants
  const sizeVariants = {
    sm: {
      badge: 'px-2 py-1 text-xs',
      icon: 'text-xs',
      score: 'text-xs',
    },
    md: {
      badge: 'px-2.5 py-1.5 text-sm',
      icon: 'text-sm',
      score: 'text-sm',
    },
    lg: {
      badge: 'px-3 py-2 text-base',
      icon: 'text-base',
      score: 'text-base',
    },
  };

  const config = riskConfig[level];
  const sizeClasses = sizeVariants[size];
  const colorClasses = getRiskLevelColor(level);

  // Format score for display
  const formatScore = (value: number): string => {
    return value.toFixed(1);
  };

  // Get score color based on value
  const getScoreColor = (value: number): string => {
    if (value >= 80) return 'text-red-700';
    if (value >= 60) return 'text-orange-700';
    if (value >= 40) return 'text-yellow-700';
    return 'text-green-700';
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium transition-all duration-200',
        'hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50',
        colorClasses,
        sizeClasses.badge,
        className
      )}
      role="status"
      aria-label={`${config.label}${score ? ` with score ${formatScore(score)}` : ''}`}
      title={config.description}
    >
      {/* Risk Level Icon */}
      <span 
        className={cn('flex-shrink-0', sizeClasses.icon)}
        aria-hidden="true"
      >
        {config.icon}
      </span>

      {/* Risk Level Label */}
      <span className="font-medium">
        {config.label}
      </span>

      {/* Risk Score */}
      {showScore && score !== undefined && (
        <span
          className={cn(
            'ml-1 px-1.5 py-0.5 rounded-md bg-white bg-opacity-60 font-bold',
            sizeClasses.score,
            getScoreColor(score)
          )}
          aria-label={`Risk score: ${formatScore(score)} out of 100`}
        >
          {formatScore(score)}
        </span>
      )}
    </div>
  );
};

/**
 * RiskBadgeList Component
 * 
 * Helper component for displaying multiple risk badges in a list
 */
export const RiskBadgeList: React.FC<{
  risks: Array<{
    level: RiskLevel;
    score?: number;
    label?: string;
  }>;
  showScores?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ risks, showScores = false, size = 'sm', className }) => {
  if (risks.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {risks.map((risk, index) => (
        <RiskBadge
          key={`${risk.level}-${index}`}
          level={risk.level}
          score={risk.score}
          showScore={showScores}
          size={size}
        />
      ))}
    </div>
  );
};

/**
 * RiskIndicator Component
 * 
 * A more detailed risk indicator with additional context
 */
export const RiskIndicator: React.FC<{
  level: RiskLevel;
  score?: number;
  factors?: string[];
  lastUpdated?: string;
  className?: string;
}> = ({ level, score, factors, lastUpdated, className }) => {
  const colorClasses = getRiskLevelColor(level);

  return (
    <div
      className={cn(
        'p-4 rounded-lg border',
        colorClasses,
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <RiskBadge level={level} score={score} showScore={!!score} />
        {lastUpdated && (
          <span className="text-xs text-gray-500">
            Updated {lastUpdated}
          </span>
        )}
      </div>
      
      {factors && factors.length > 0 && (
        <div className="mt-3">
          <h4 className="text-sm font-medium mb-2">Risk Factors:</h4>
          <ul className="text-xs space-y-1">
            {factors.map((factor, index) => (
              <li key={index} className="flex items-center gap-2">
                <span className="w-1 h-1 bg-current rounded-full"></span>
                {factor}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default RiskBadge;