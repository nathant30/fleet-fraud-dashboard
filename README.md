# Fleet Fraud Dashboard

A comprehensive React dashboard for monitoring and analyzing fleet fraud risk in real-time. Built with TypeScript, Tailwind CSS, and modern React patterns.

## Features

- **Real-time KPI Monitoring**: Display key performance indicators with change tracking and target progress
- **Risk Assessment**: Visual risk level indicators with color-coded badges and scores
- **Driver Management**: Comprehensive data table with sorting, filtering, and pagination
- **Responsive Design**: Works seamlessly across desktop, tablet, and mobile devices
- **Accessibility**: WCAG compliant with proper ARIA labels and keyboard navigation
- **TypeScript**: Full type safety and excellent developer experience

## Components

### KPICard

A versatile component for displaying key performance indicators with rich formatting and interaction capabilities.

#### Features
- Multiple value formats (number, currency, percentage)
- Change indicators with trend visualization
- Target progress tracking
- Status-based color coding
- Loading states
- Click handlers for drill-down functionality

#### Usage

```tsx
import { KPICard } from '@/components';

const kpiData = {
  id: 'fraud-alerts',
  title: 'Fraud Alerts',
  value: 23,
  previousValue: 31,
  format: 'number',
  description: 'Active fraud investigations',
  status: 'warning',
};

<KPICard 
  data={kpiData}
  onClick={() => console.log('KPI clicked')}
  className="shadow-lg"
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `KPIData` | - | KPI data object (required) |
| `loading` | `boolean` | `false` | Show loading state |
| `onClick` | `() => void` | - | Click handler for interaction |
| `className` | `string` | - | Additional CSS classes |

### RiskBadge

A component for displaying risk levels with visual indicators and optional numeric scores.

#### Features
- Color-coded risk levels (low, medium, high, critical)
- Optional risk score display
- Multiple size variants
- Accessible design with proper ARIA labels
- Hover states and interactions

#### Usage

```tsx
import { RiskBadge } from '@/components';

<RiskBadge 
  level="high"
  score={78.5}
  showScore={true}
  size="lg"
/>

// Multiple risk badges
import { RiskBadgeList } from '@/components';

<RiskBadgeList 
  risks={[
    { level: 'low', score: 15 },
    { level: 'medium', score: 45 },
    { level: 'high', score: 78 }
  ]}
  showScores={true}
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `level` | `RiskLevel` | - | Risk level (required) |
| `score` | `number` | - | Numeric risk score |
| `showScore` | `boolean` | `false` | Display risk score |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Badge size |
| `className` | `string` | - | Additional CSS classes |

### DriverTable

A comprehensive data table component for displaying and managing driver information.

#### Features
- Sortable columns with visual indicators
- Search and filtering capabilities
- Pagination with configurable page sizes
- Row selection and interaction
- Responsive design with horizontal scrolling
- Loading states and empty state handling
- Accessibility with proper table semantics

#### Usage

```tsx
import { DriverTable } from '@/components';

const drivers = [
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
  // ... more drivers
];

<DriverTable
  drivers={drivers}
  onDriverSelect={(driver) => console.log('Selected:', driver)}
  onSort={(field, direction) => console.log('Sort:', field, direction)}
  pageSize={10}
  className="shadow-lg"
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `drivers` | `Driver[]` | - | Array of driver data (required) |
| `loading` | `boolean` | `false` | Show loading state |
| `onDriverSelect` | `(driver: Driver) => void` | - | Driver selection handler |
| `onSort` | `(field: keyof Driver, direction: 'asc' \| 'desc') => void` | - | Sort handler |
| `onFilter` | `(filters: Partial<Driver>) => void` | - | Filter handler |
| `sortField` | `keyof Driver` | - | Current sort field |
| `sortDirection` | `'asc' \| 'desc'` | - | Current sort direction |
| `pageSize` | `number` | `10` | Number of rows per page |
| `className` | `string` | - | Additional CSS classes |

## Type Definitions

### Core Types

```typescript
interface Driver {
  id: string;
  name: string;
  licenseNumber: string;
  vehicleId: string;
  email: string;
  phone: string;
  hireDate: string;
  status: 'active' | 'inactive' | 'suspended';
  riskLevel: RiskLevel;
  totalMiles: number;
  violations: number;
  lastActivity: string;
  fraudScore: number;
}

interface KPIData {
  id: string;
  title: string;
  value: number | string;
  previousValue?: number | string;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  unit?: string;
  format?: 'number' | 'currency' | 'percentage';
  description?: string;
  trend?: number[];
  target?: number;
  status?: 'good' | 'warning' | 'danger';
}

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
```

## Styling and Theming

The components use Tailwind CSS for styling with a comprehensive design system:

### Color Palette
- **Primary**: Blue tones for main actions and highlights
- **Success**: Green tones for positive states and low risk
- **Warning**: Yellow/orange tones for medium risk and warnings
- **Danger**: Red tones for high risk and critical states
- **Neutral**: Gray tones for secondary content and borders

### Responsive Breakpoints
- **sm**: 640px and up
- **md**: 768px and up
- **lg**: 1024px and up
- **xl**: 1280px and up
- **2xl**: 1536px and up

### Accessibility Features
- WCAG 2.1 AA compliant color contrast ratios
- Keyboard navigation support
- Screen reader compatible ARIA labels
- Focus management and indicators
- Reduced motion support

## Development

### Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm start
   ```

3. **Run tests**:
   ```bash
   npm test
   ```

4. **Build for production**:
   ```bash
   npm run build
   ```

### Project Structure

```
src/
├── components/           # React components
│   ├── KPICard/         # KPI display component
│   ├── RiskBadge/       # Risk level indicator
│   ├── DriverTable/     # Driver data table
│   └── index.ts         # Component exports
├── types/               # TypeScript type definitions
├── utils/               # Utility functions and formatters
├── App.tsx              # Main application component
├── index.tsx            # React entry point
└── index.css            # Global styles and Tailwind imports
```

### Testing

The project includes comprehensive test coverage using Jest and React Testing Library:

- **Unit tests**: Component behavior and rendering
- **Integration tests**: Component interactions
- **Accessibility tests**: ARIA labels and keyboard navigation

Run tests with:
```bash
npm test
```

### Performance Considerations

- **Code splitting**: Components are designed for lazy loading
- **Memoization**: Expensive calculations are cached
- **Virtualization**: Large data sets can be virtualized
- **Optimistic updates**: UI updates before API responses

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing

1. Follow the existing code style and patterns
2. Add tests for new components and features
3. Ensure accessibility compliance
4. Update documentation for API changes

## License

MIT License - see LICENSE file for details

## Real-time Integration

The components are designed to work with real-time data updates:

```tsx
// Example WebSocket integration
useEffect(() => {
  const ws = new WebSocket('ws://localhost:8080');
  
  ws.onmessage = (event) => {
    const update = JSON.parse(event.data);
    
    if (update.type === 'driver_update') {
      setDrivers(prev => prev.map(driver => 
        driver.id === update.data.id ? { ...driver, ...update.data } : driver
      ));
    }
    
    if (update.type === 'kpi_update') {
      setKpis(prev => prev.map(kpi => 
        kpi.id === update.data.id ? { ...kpi, ...update.data } : kpi
      ));
    }
  };
  
  return () => ws.close();
}, []);
```

## API Integration

Components work with RESTful APIs and can be integrated with various backend services:

```tsx
// Example API service
const apiService = {
  async getDrivers(): Promise<Driver[]> {
    const response = await fetch('/api/drivers');
    return response.json();
  },
  
  async getKPIs(): Promise<KPIData[]> {
    const response = await fetch('/api/kpis');
    return response.json();
  },
  
  async updateDriver(id: string, data: Partial<Driver>): Promise<Driver> {
    const response = await fetch(`/api/drivers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },
};
```

This dashboard provides a solid foundation for fleet fraud monitoring with scalable, maintainable components that can be extended and customized for specific business needs.