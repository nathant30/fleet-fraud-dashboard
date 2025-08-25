import React from 'react';
import { cn } from '@/utils/formatters';

interface LoadingSkeletonProps {
  className?: string;
  variant?: 'card' | 'table' | 'list' | 'text' | 'avatar';
  rows?: number;
  animated?: boolean;
}

/**
 * LoadingSkeleton Component
 * 
 * Provides smooth loading states for different UI elements:
 * - Card variant for KPI cards and dashboards
 * - Table variant for data tables
 * - List variant for lists and feeds
 * - Text variant for text content
 * - Avatar variant for profile pictures
 */
const LoadingSkeleton: React.FC<LoadingSkeletonProps> = React.memo(({
  className,
  variant = 'text',
  rows = 1,
  animated = true,
}) => {
  const baseClasses = cn(
    'bg-gray-200 rounded',
    animated && 'animate-pulse',
    className
  );

  const renderCardSkeleton = () => (
    <div className={cn('p-6 bg-white rounded-lg border border-gray-200', className)}>
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        <div className="h-3 bg-gray-200 rounded w-1/4"></div>
        <div className="h-2 bg-gray-200 rounded w-full"></div>
      </div>
    </div>
  );

  const renderTableSkeleton = () => (
    <div className={cn('space-y-3', className)}>
      {/* Header skeleton */}
      <div className="flex space-x-4 p-4 bg-gray-50 rounded">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-4 bg-gray-200 rounded flex-1"></div>
        ))}
      </div>
      
      {/* Rows skeleton */}
      {[...Array(rows)].map((_, rowIndex) => (
        <div key={rowIndex} className="flex space-x-4 p-4 bg-white border-b">
          <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/6"></div>
          </div>
          <div className="h-4 bg-gray-200 rounded w-16"></div>
          <div className="h-6 w-20 bg-gray-200 rounded-full"></div>
          <div className="h-4 bg-gray-200 rounded w-12"></div>
          <div className="h-4 bg-gray-200 rounded w-24"></div>
        </div>
      ))}
    </div>
  );

  const renderListSkeleton = () => (
    <div className={cn('space-y-3', className)}>
      {[...Array(rows)].map((_, index) => (
        <div key={index} className="flex items-center space-x-3 p-3 bg-white rounded-lg border">
          <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
          <div className="h-6 w-16 bg-gray-200 rounded-full"></div>
        </div>
      ))}
    </div>
  );

  const renderTextSkeleton = () => (
    <div className={cn('space-y-2', className)}>
      {[...Array(rows)].map((_, index) => (
        <div
          key={index}
          className={cn(
            baseClasses,
            'h-4',
            index === rows - 1 ? 'w-3/4' : 'w-full'
          )}
        ></div>
      ))}
    </div>
  );

  const renderAvatarSkeleton = () => (
    <div className={cn('h-10 w-10 bg-gray-200 rounded-full', animated && 'animate-pulse', className)}></div>
  );

  switch (variant) {
    case 'card':
      return renderCardSkeleton();
    case 'table':
      return renderTableSkeleton();
    case 'list':
      return renderListSkeleton();
    case 'avatar':
      return renderAvatarSkeleton();
    case 'text':
    default:
      return renderTextSkeleton();
  }
});

/**
 * KPICardSkeleton - Specialized skeleton for KPI cards
 */
export const KPICardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <LoadingSkeleton variant="card" className={className} />
);

/**
 * DriverTableSkeleton - Specialized skeleton for driver table
 */
export const DriverTableSkeleton: React.FC<{ rows?: number; className?: string }> = ({ 
  rows = 5, 
  className 
}) => (
  <div className={cn('bg-white rounded-lg border border-gray-200 overflow-hidden', className)}>
    <LoadingSkeleton variant="table" rows={rows} />
  </div>
);

/**
 * AlertListSkeleton - Specialized skeleton for alert lists
 */
export const AlertListSkeleton: React.FC<{ items?: number; className?: string }> = ({ 
  items = 3, 
  className 
}) => (
  <LoadingSkeleton variant="list" rows={items} className={className} />
);

export default LoadingSkeleton;