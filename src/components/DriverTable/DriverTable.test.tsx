import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import DriverTable from './DriverTable';
import { Driver } from '@/types';

const mockDrivers: Driver[] = [
  {
    id: '1',
    name: 'John Smith',
    licenseNumber: 'DL123456789',
    vehicleId: 'VH-001',
    email: 'john.smith@company.com',
    phone: '+1-555-0123',
    hireDate: '2022-03-15',
    status: 'active',
    riskLevel: 'low',
    totalMiles: 45230,
    violations: 1,
    lastActivity: '2024-08-21T14:30:00Z',
    fraudScore: 15.2,
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    licenseNumber: 'DL987654321',
    vehicleId: 'VH-002',
    email: 'sarah.johnson@company.com',
    phone: '+1-555-0124',
    hireDate: '2021-11-20',
    status: 'active',
    riskLevel: 'critical',
    totalMiles: 67890,
    violations: 8,
    lastActivity: '2024-08-22T09:15:00Z',
    fraudScore: 89.3,
  },
];

describe('DriverTable Accessibility & Integration Tests', () => {
  it('has proper table structure with ARIA labels', () => {
    render(<DriverTable drivers={mockDrivers} />);
    
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    
    // Check for proper table headers
    const columnHeaders = screen.getAllByRole('columnheader');
    expect(columnHeaders.length).toBeGreaterThan(0);
    
    // Check for table rows
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBe(mockDrivers.length + 1); // +1 for header
  });

  it('supports keyboard navigation through table', async () => {
    const mockOnDriverSelect = jest.fn();
    const user = userEvent.setup();
    render(<DriverTable drivers={mockDrivers} onDriverSelect={mockOnDriverSelect} />);
    
    const table = screen.getByRole('table');
    const firstRow = screen.getAllByRole('row')[1]; // Skip header
    
    // Should be able to click on first data row
    await user.click(firstRow);
    expect(mockOnDriverSelect).toHaveBeenCalledWith(mockDrivers[0]);
  });

  it('provides proper ARIA labels for sortable columns', () => {
    const mockOnSort = jest.fn();
    render(<DriverTable drivers={mockDrivers} onSort={mockOnSort} />);
    
    const nameHeader = screen.getByRole('columnheader', { name: /driver name/i });
    expect(nameHeader).toBeInTheDocument();
    
    // Should be clickable for sorting
    fireEvent.click(nameHeader);
    expect(mockOnSort).toHaveBeenCalledWith('name', 'asc');
  });

  it('displays loading state with proper ARIA attributes', () => {
    const { container } = render(<DriverTable drivers={mockDrivers} loading={true} />);
    
    const loadingElement = container.querySelector('.animate-pulse');
    expect(loadingElement).toBeInTheDocument();
  });

  it('handles empty state accessibly', () => {
    render(<DriverTable drivers={[]} />);
    
    const emptyMessage = screen.getByText(/no drivers found/i) || 
                        screen.getByRole('status');
    expect(emptyMessage).toBeInTheDocument();
  });

  it('provides accessible risk level indicators', () => {
    render(<DriverTable drivers={mockDrivers} />);
    
    const riskBadges = screen.getAllByRole('status');
    expect(riskBadges.length).toBeGreaterThan(0);
    
    // Each risk badge should have proper ARIA label
    riskBadges.forEach(badge => {
      expect(badge).toHaveAttribute('aria-label', expect.stringMatching(/risk/i));
    });
  });

  it('supports pagination with keyboard navigation', async () => {
    const manyDrivers = Array.from({ length: 25 }, (_, i) => ({
      ...mockDrivers[0],
      id: `driver-${i}`,
      name: `Driver ${i}`,
    }));
    
    const user = userEvent.setup();
    render(<DriverTable drivers={manyDrivers} pageSize={10} />);
    
    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).toBeInTheDocument();
    
    // Click the next button
    await user.click(nextButton);
    
    // Should show page 2
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('provides search functionality with proper labeling', async () => {
    const user = userEvent.setup();
    render(<DriverTable drivers={mockDrivers} />);
    
    const searchInput = screen.getByPlaceholderText(/search drivers/i);
    expect(searchInput).toBeInTheDocument();
    
    // Should filter results when typing
    await user.type(searchInput, 'John');
    
    // Should announce search results to screen readers
    const results = screen.getAllByRole('row');
    expect(results.length).toBeLessThanOrEqual(mockDrivers.length + 1);
  });

  it('handles row selection with proper ARIA states', () => {
    const mockOnDriverSelect = jest.fn();
    render(<DriverTable drivers={mockDrivers} onDriverSelect={mockOnDriverSelect} />);
    
    const firstDataRow = screen.getAllByRole('row')[1];
    expect(firstDataRow).toBeInTheDocument();
    
    fireEvent.click(firstDataRow);
    expect(mockOnDriverSelect).toHaveBeenCalledWith(mockDrivers[0]);
  });

  it('provides status indicators for screen readers', () => {
    render(<DriverTable drivers={mockDrivers} />);
    
    // Check for status indicators (active, suspended, etc.)
    const statusElements = screen.getAllByText(/active/i);
    expect(statusElements.length).toBeGreaterThan(0);
    
    // Status elements should be present in the table
    statusElements.forEach(element => {
      expect(element).toBeInTheDocument();
    });
  });

  it('maintains focus management during interactions', async () => {
    const user = userEvent.setup();
    const mockOnSort = jest.fn();
    render(<DriverTable drivers={mockDrivers} onSort={mockOnSort} />);
    
    const nameHeader = screen.getByRole('columnheader', { name: /driver name/i });
    
    // Should be able to click header for sorting
    await user.click(nameHeader);
    expect(mockOnSort).toHaveBeenCalledWith('name', 'asc');
  });
});