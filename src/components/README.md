# Fleet Fraud Dashboard Components

## Overview
This directory contains all React components for the Fleet Fraud Dashboard. Components are built with TypeScript, Tailwind CSS, and follow accessibility best practices.

## Core Components

### KPICard
**Location:** `./KPICard/KPICard.tsx`  
**Purpose:** Displays key performance indicators with trend analysis

**Features:**
- Real-time data display with formatting (numbers, currency, percentages)
- Trend indicators with percentage changes
- Target progress bars
- Status-based color coding (good, warning, danger)
- Interactive click handlers for drill-down
- Loading states with skeleton UI
- Accessibility compliance

**Usage:**
```tsx
<KPICard
  data={{
    id: 'fraud-alerts',
    title: 'Fraud Alerts',
    value: 23,
    previousValue: 31,
    format: 'number',
    status: 'warning'
  }}
  loading={false}
  onClick={() => console.log('KPI clicked')}
/>
```

### RiskBadge
**Location:** `./RiskBadge/RiskBadge.tsx`  
**Purpose:** Visual risk level indicators with color coding

**Features:**
- Risk levels: low, medium, high, critical
- Optional numeric score display
- Multiple size variants (sm, md, lg)
- Color-coded backgrounds and text
- ARIA labels for screen readers
- Hover states and focus management

**Usage:**
```tsx
<RiskBadge 
  level="high" 
  score={75.5} 
  showScore 
  size="md"
/>
```

**Variants:**
- `RiskBadgeList`: Display multiple risk badges
- `RiskIndicator`: Enhanced badge with additional context

### DriverTable
**Location:** `./DriverTable/DriverTable.tsx`  
**Purpose:** Comprehensive data table for driver management

**Features:**
- Sortable columns with visual indicators
- Search functionality across multiple fields
- Filter controls (status, risk level)
- Pagination with configurable page size
- Row selection and interaction
- Loading states with skeleton UI
- Empty states with helpful messaging
- Accessibility compliance (ARIA labels, keyboard navigation)

**Usage:**
```tsx
<DriverTable
  drivers={driverData}
  loading={false}
  onDriverSelect={(driver) => console.log(driver)}
  onSort={(field, direction) => handleSort(field, direction)}
  sortField="name"
  sortDirection="asc"
  pageSize={10}
/>
```

## Enhanced UX Components

### LoadingSkeleton
**Location:** `./LoadingSkeleton/LoadingSkeleton.tsx`  
**Purpose:** Professional loading states during API calls

**Features:**
- Multiple variants: card, table, list, text, avatar
- Animated pulse effects
- Configurable row counts
- Responsive design
- Customizable styling

**Variants:**
- `KPICardSkeleton`: Specialized for KPI cards
- `DriverTableSkeleton`: Specialized for data tables
- `AlertListSkeleton`: Specialized for alert lists

**Usage:**
```tsx
// Basic skeleton
<LoadingSkeleton variant="text" rows={3} />

// Specialized skeletons
<KPICardSkeleton />
<DriverTableSkeleton rows={5} />
<AlertListSkeleton items={3} />
```

### ErrorBoundary
**Location:** `./ErrorBoundary/ErrorBoundary.tsx`  
**Purpose:** Graceful error handling with recovery options

**Features:**
- Catches JavaScript errors in component tree
- Custom fallback UI options
- Retry functionality
- Development-friendly error details
- Error reporting integration points
- Accessibility compliant error messages

**Variants:**
- `APIErrorBoundary`: Specialized for API failures
- `ComponentErrorBoundary`: Lightweight individual component protection

**Usage:**
```tsx
// Basic error boundary
<ErrorBoundary fallback={<CustomFallback />}>
  <MyComponent />
</ErrorBoundary>

// API-specific error boundary
<APIErrorBoundary apiName="Fraud Stats" onRetry={handleRetry}>
  <KPICard data={fraudData} />
</APIErrorBoundary>

// Component-specific error boundary
<ComponentErrorBoundary componentName="Driver Table">
  <DriverTable drivers={drivers} />
</ComponentErrorBoundary>
```

## Design System

### Color Scheme
- **Risk Levels:**
  - Low: Green (`bg-green-100 text-green-800`)
  - Medium: Yellow (`bg-yellow-100 text-yellow-800`)
  - High: Orange (`bg-orange-100 text-orange-800`)
  - Critical: Red (`bg-red-100 text-red-800`)

- **Status Indicators:**
  - Good: Green tones
  - Warning: Yellow/Orange tones
  - Danger: Red tones

### Typography
- **Headers:** `text-lg font-semibold text-gray-900`
- **Body:** `text-sm text-gray-700`
- **Captions:** `text-xs text-gray-500`
- **Interactive:** `text-blue-600 hover:text-blue-500`

### Spacing
- **Component Padding:** `p-4` to `p-6`
- **Element Gaps:** `gap-2` to `gap-6`
- **Margin Bottom:** `mb-4` to `mb-8`

## Accessibility Features

### ARIA Support
- Proper `role` attributes
- Descriptive `aria-label` properties
- `aria-expanded` for interactive elements
- `aria-sort` for sortable columns

### Keyboard Navigation
- Tab order management
- Enter/Space key handlers
- Focus indicators
- Skip links where appropriate

### Screen Reader Support
- Descriptive text alternatives
- Status announcements
- Progress indicators
- Error message clarity

## Testing

### Test Configuration
- Jest with jsdom environment
- React Testing Library
- Accessibility testing with @testing-library/jest-dom
- TypeScript support

### Test Coverage
- Unit tests for all components
- Integration tests for complex interactions
- Accessibility compliance testing
- Error boundary testing

### Running Tests
```bash
npm run test:frontend  # Run all frontend component tests
npm run test:coverage  # Run with coverage report
```

## Performance Considerations

### Bundle Optimization
- Tree shaking compatible exports
- Lazy loading for large components
- CSS-in-JS with Tailwind purging
- TypeScript compilation optimization

### Runtime Performance
- React.memo for expensive renders
- Proper dependency arrays in hooks
- Efficient event handlers
- Optimized re-render patterns

## Development Guidelines

### Component Structure
```
ComponentName/
├── ComponentName.tsx      # Main component
├── ComponentName.test.tsx # Tests
└── index.ts              # Export
```

### Code Style
- TypeScript for type safety
- Functional components with hooks
- Props interfaces defined separately
- Descriptive component and prop names
- JSDoc comments for complex components

### Error Handling
- Always wrap risky operations in try-catch
- Provide meaningful error messages
- Use error boundaries for component isolation
- Implement retry logic where appropriate

## Future Enhancements

### Planned Features
- Dark mode support
- Advanced filtering options
- Real-time WebSocket integration
- Enhanced mobile responsiveness
- Internationalization (i18n)

### Performance Improvements
- Virtual scrolling for large tables
- Image lazy loading
- Component code splitting
- Service worker caching

---

*This documentation is maintained by the Frontend Agent and updated with each component enhancement.*