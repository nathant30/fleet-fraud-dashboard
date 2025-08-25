import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import KPICard from './KPICard';
import { KPIData } from '@/types';

const mockKPIData: KPIData = {
  id: 'test-kpi',
  title: 'Test KPI',
  value: 1234,
  previousValue: 1000,
  format: 'number',
  unit: 'units',
  description: 'A test KPI for unit testing',
  status: 'good',
};

describe('KPICard', () => {
  it('renders KPI data correctly', () => {
    render(<KPICard data={mockKPIData} />);
    
    expect(screen.getByText('Test KPI')).toBeInTheDocument();
    expect(screen.getByText('1,234 units')).toBeInTheDocument();
    expect(screen.getByText('A test KPI for unit testing')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    const { container } = render(<KPICard data={mockKPIData} loading={true} />);
    
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const mockOnClick = jest.fn();
    render(<KPICard data={mockKPIData} onClick={mockOnClick} />);
    
    const card = screen.getByRole('button');
    fireEvent.click(card);
    
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('displays percentage change correctly', () => {
    render(<KPICard data={mockKPIData} />);
    
    // Should show 23.4% increase (1234 vs 1000)
    expect(screen.getByText(/23\.4%/)).toBeInTheDocument();
  });

  it('shows target progress when target is provided', () => {
    const dataWithTarget = { ...mockKPIData, target: 2000 };
    render(<KPICard data={dataWithTarget} />);
    
    expect(screen.getByText('Progress to target')).toBeInTheDocument();
    expect(screen.getByText('62%')).toBeInTheDocument(); // 1234/2000 = 61.7%
  });

  it('applies custom className', () => {
    const { container } = render(<KPICard data={mockKPIData} className="custom-class" />);
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('handles keyboard navigation', () => {
    const mockOnClick = jest.fn();
    render(<KPICard data={mockKPIData} onClick={mockOnClick} />);
    
    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: 'Enter' });
    
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });
});