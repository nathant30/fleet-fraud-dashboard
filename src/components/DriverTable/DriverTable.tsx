import React, { useState, useMemo } from 'react';
import { Driver, DriverTableProps, TableColumn } from '@/types';
import RiskBadge from '@/components/RiskBadge';
import { formatDate, formatRelativeTime, cn } from '@/utils/formatters';

/**
 * DriverTable Component
 * 
 * A comprehensive data table for displaying driver information with:
 * - Sortable columns
 * - Filtering capabilities
 * - Pagination
 * - Row selection
 * - Responsive design
 * - Loading states
 * - Accessibility features
 */
const DriverTable: React.FC<DriverTableProps> = ({
  drivers,
  loading = false,
  onDriverSelect,
  onSort,
  // onFilter, // Unused parameter
  sortField,
  sortDirection,
  pageSize = 10,
  className,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');

  // Define table columns
  const columns: TableColumn<Driver>[] = useMemo(() => [
    {
      key: 'name',
      label: 'Driver Name',
      sortable: true,
      render: (value: string, driver: Driver) => (
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0 h-10 w-10">
            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-sm font-medium text-gray-700">
                {value.split(' ').map(n => n[0]).join('').toUpperCase()}
              </span>
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">{value}</div>
            <div className="text-sm text-gray-500">{driver.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'licenseNumber',
      label: 'License #',
      sortable: true,
      render: (value: string) => (
        <span className="text-sm font-mono text-gray-900">{value}</span>
      ),
    },
    {
      key: 'vehicleId',
      label: 'Vehicle',
      sortable: true,
      render: (value: string) => (
        <span className="text-sm text-gray-900">{value}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value: string) => {
        const statusColors = {
          active: 'bg-green-100 text-green-800',
          inactive: 'bg-gray-100 text-gray-800',
          suspended: 'bg-red-100 text-red-800',
        };
        return (
          <span className={cn(
            'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
            statusColors[value as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'
          )}>
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </span>
        );
      },
    },
    {
      key: 'riskLevel',
      label: 'Risk Level',
      sortable: true,
      render: (_value: string, driver: Driver) => (
        <RiskBadge 
          level={driver.riskLevel} 
          score={driver.fraudScore}
          showScore={true}
          size="sm"
        />
      ),
    },
    {
      key: 'totalMiles',
      label: 'Total Miles',
      sortable: true,
      align: 'right',
      render: (value: number) => (
        <span className="text-sm text-gray-900">
          {value.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'violations',
      label: 'Violations',
      sortable: true,
      align: 'center',
      render: (value: number) => (
        <span className={cn(
          'inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded-full',
          value > 5 ? 'bg-red-100 text-red-800' :
          value > 2 ? 'bg-yellow-100 text-yellow-800' :
          'bg-green-100 text-green-800'
        )}>
          {value}
        </span>
      ),
    },
    {
      key: 'lastActivity',
      label: 'Last Activity',
      sortable: true,
      render: (value: string) => (
        <div className="text-sm text-gray-900">
          <div>{formatDate(value)}</div>
          <div className="text-xs text-gray-500">{formatRelativeTime(value)}</div>
        </div>
      ),
    },
  ], []);

  // Filter and sort data
  const filteredAndSortedDrivers = useMemo(() => {
    let filtered = drivers.filter(driver => {
      // Search filter
      const matchesSearch = searchTerm === '' || 
        driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        driver.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        driver.licenseNumber.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Status filter
      const matchesStatus = statusFilter === 'all' || driver.status === statusFilter;
      
      // Risk filter
      const matchesRisk = riskFilter === 'all' || driver.riskLevel === riskFilter;
      
      return matchesSearch && matchesStatus && matchesRisk;
    });

    // Sort if sort config is provided
    if (sortField && sortDirection) {
      filtered.sort((a, b) => {
        const aValue = a[sortField];
        const bValue = b[sortField];
        
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [drivers, searchTerm, statusFilter, riskFilter, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedDrivers.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedDrivers = filteredAndSortedDrivers.slice(startIndex, startIndex + pageSize);

  // Handle sort
  const handleSort = (field: keyof Driver) => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort?.(field, newDirection);
  };

  // Handle row click
  const handleRowClick = (driver: Driver) => {
    onDriverSelect?.(driver);
  };

  // Loading state
  if (loading) {
    return (
      <div className={cn('bg-white rounded-lg border border-gray-200 overflow-hidden', className)}>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="flex space-x-4 mb-4">
              <div className="h-10 bg-gray-200 rounded w-1/4"></div>
              <div className="h-10 bg-gray-200 rounded w-1/6"></div>
              <div className="h-10 bg-gray-200 rounded w-1/6"></div>
            </div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex space-x-4 py-3">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                <div className="h-4 bg-gray-200 rounded w-1/6"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 overflow-hidden', className)}>
      {/* Header with filters */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Drivers ({filteredAndSortedDrivers.length})
          </h2>
          
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <input
              type="text"
              placeholder="Search drivers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            
            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
            
            {/* Risk filter */}
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Risk Levels</option>
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
              <option value="critical">Critical Risk</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={cn(
                    'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
                    column.sortable && 'cursor-pointer hover:bg-gray-100',
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right'
                  )}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center gap-1">
                    {column.label}
                    {column.sortable && (
                      <span className="text-gray-400">
                        {sortField === column.key ? (
                          sortDirection === 'asc' ? '↑' : '↓'
                        ) : '↕'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedDrivers.map((driver) => (
              <tr
                key={driver.id}
                className={cn(
                  'hover:bg-gray-50 transition-colors duration-150',
                  onDriverSelect && 'cursor-pointer'
                )}
                onClick={() => handleRowClick(driver)}
              >
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className={cn(
                      'px-6 py-4 whitespace-nowrap',
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right'
                    )}
                  >
                    {column.render ? 
                      column.render(driver[column.key], driver) : 
                      String(driver[column.key])
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {startIndex + 1} to {Math.min(startIndex + pageSize, filteredAndSortedDrivers.length)} of {filteredAndSortedDrivers.length} results
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {filteredAndSortedDrivers.length === 0 && !loading && (
        <div className="p-12 text-center">
          <div className="text-gray-400 text-lg mb-2">📋</div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No drivers found</h3>
          <p className="text-gray-500">
            {searchTerm || statusFilter !== 'all' || riskFilter !== 'all' 
              ? 'Try adjusting your filters to see more results.'
              : 'Get started by adding some drivers to your fleet.'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default DriverTable;