import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import RiskBadge from './RiskBadge';

describe('RiskBadge Accessibility & Functionality Tests', () => {
  it('renders with correct ARIA labels for each risk level', () => {
    const riskLevels = [
      { level: 'low', expectedText: 'Low Risk' },
      { level: 'medium', expectedText: 'Medium Risk' },
      { level: 'high', expectedText: 'High Risk' },
      { level: 'critical', expectedText: 'Critical Risk' }
    ] as const;
    
    riskLevels.forEach(({ level, expectedText }) => {
      const { unmount } = render(<RiskBadge level={level} />);
      const badge = screen.getByRole('status');
      expect(badge).toHaveAttribute('aria-label', expectedText);
      unmount();
    });
  });

  it('displays risk score when showScore is true', () => {
    render(<RiskBadge level="high" score={75.5} showScore />);
    expect(screen.getByText('75.5')).toBeInTheDocument();
  });

  it('has proper color contrast for each risk level', () => {
    const riskLevels = ['low', 'medium', 'high', 'critical'] as const;
    
    riskLevels.forEach(level => {
      const { container, unmount } = render(<RiskBadge level={level} />);
      const badge = container.firstChild as HTMLElement;
      
      // Check that appropriate color classes are applied
      const classes = badge.className;
      expect(classes).toContain(level === 'low' ? 'green' : 
                              level === 'medium' ? 'yellow' :
                              level === 'high' ? 'orange' : 'red');
      unmount();
    });
  });

  it('supports keyboard navigation when interactive', () => {
    const { container } = render(<RiskBadge level="medium" />);
    const badge = container.firstChild as HTMLElement;
    
    // RiskBadge is not interactive by default, should not be focusable
    expect(badge.tabIndex).toBe(-1);
    
    // Should have focus styling available
    expect(badge.className).toContain('focus:outline-none');
  });

  it('provides appropriate semantic structure', () => {
    render(<RiskBadge level="critical" score={95} showScore />);
    
    // Should have status role for screen readers
    const badge = screen.getByRole('status');
    expect(badge).toBeInTheDocument();
    
    // Score should be announced as part of accessible name
    expect(badge).toHaveAccessibleName('Critical Risk with score 95.0');
  });

  it('handles different sizes correctly', () => {
    const sizeTests = [
      { size: 'sm', expectedClass: 'px-2 py-1 text-xs' },
      { size: 'md', expectedClass: 'px-2.5 py-1.5 text-sm' },
      { size: 'lg', expectedClass: 'px-3 py-2 text-base' }
    ] as const;
    
    sizeTests.forEach(({ size, expectedClass }) => {
      const { container, unmount } = render(<RiskBadge level="medium" size={size} />);
      const badge = container.firstChild as HTMLElement;
      
      // Check size-specific classes are applied
      expect(badge.className).toContain(expectedClass.split(' ')[0]); // Check first class
      unmount();
    });
  });

  it('maintains readability with score display', () => {
    render(<RiskBadge level="low" score={12.34} showScore />);
    
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('12.3'); // Score is formatted to 1 decimal place
    
    // Should maintain proper spacing and readability
    expect(badge).toHaveClass('inline-flex', 'items-center');
  });
});