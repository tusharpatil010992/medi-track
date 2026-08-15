# Development Rules & Frontend Guidelines

Frontend development rules, theme system, and coding patterns that must be followed consistently across Medi-Track.

---

## Frontend Stack

**Required:**
- Material UI (MUI) v5+ for components
- TypeScript (strict mode)
- React 19+
- Next.js 15+ (App Router)

**NOT Allowed:**
- Tailwind CSS
- Custom CSS-in-JS beyond MUI
- Separate CSS libraries
- Component libraries other than MUI

**File Styles:**
- MUI `sx` prop for styling
- CSS Modules only for page-specific overrides (minimal)
- No inline styles

---

## Theme System

### MUI Theme Structure

Create centralized theme configuration:

```typescript
// themes/lightTheme.ts
import { createTheme } from '@mui/material/styles';

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
    success: { main: '#2e7d32' },
    warning: { main: '#f57c00' },
    error: { main: '#d32f2f' },
    info: { main: '#0288d1' },
    background: { default: '#fafafa', paper: '#ffffff' },
    text: { primary: '#000000', secondary: '#666666' },
  },
  typography: { fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif' },
  shape: { borderRadius: 8 },
});

// themes/darkTheme.ts - mirror with dark adjustments
export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#90caf9' },
    // ... rest of dark theme
  },
});
```

### Apply Theme Globally

```typescript
// app/layout.tsx
import { ThemeProvider } from '@mui/material/styles';
import { lightTheme, darkTheme } from '@/themes';

export default function RootLayout({ children }) {
  const isDark = useSystemDarkMode();
  return (
    <ThemeProvider theme={isDark ? darkTheme : lightTheme}>
      {children}
    </ThemeProvider>
  );
}
```

---

## Color Palette

### Primary Colors
- **Primary Blue:** `#1976d2` (actions, links, focus)
- **Primary Dark:** `#1565c0` (hover states)
- **Primary Light:** `#42a5f5` (disabled/light)

### Status Colors
- **Success Green:** `#2e7d32` (completed, approved)
- **Warning Orange:** `#f57c00` (pending, attention)
- **Error Red:** `#d32f2f` (errors, cancelled)
- **Info Blue:** `#0288d1` (informational)

### Semantic Colors
- Appointment: Info Blue
- Consultation: Primary Blue
- Prescribed: Success Green
- Cancelled: Error Red
- Draft: Warning Orange
- Completed: Success Green

### Neutrals
- Borders: `#e0e0e0` (light), `#424242` (dark)
- Backgrounds: `#fafafa` (light), `#121212` (dark)
- Text Primary: `#000000` (light), `#ffffff` (dark)
- Text Secondary: `#666666` (light), `#b0b0b0` (dark)

**Rule:** Always use theme color names, never hardcode hex values:
```typescript
// Good
<Box sx={{ bgcolor: 'primary.main', color: 'text.primary' }} />

// Bad
<Box sx={{ bgcolor: '#1976d2', color: '#000000' }} />
```

---

## Typography Scale

```typescript
h1: { fontSize: '32px', fontWeight: 700 }    // Page titles
h2: { fontSize: '28px', fontWeight: 700 }    // Section headers
h3: { fontSize: '24px', fontWeight: 600 }    // Subsection headers
h4: { fontSize: '20px', fontWeight: 600 }    // Component headers
h5: { fontSize: '16px', fontWeight: 600 }    // Labels
h6: { fontSize: '14px', fontWeight: 600 }    // Small labels
body1: { fontSize: '16px', fontWeight: 400 } // Body text
body2: { fontSize: '14px', fontWeight: 400 } // Secondary text
caption: { fontSize: '12px', fontWeight: 400 } // Helper text
overline: { fontSize: '11px', fontWeight: 600 } // Tags/badges
```

**Usage Rules:**
- `h1`: Page titles only
- `h2`: Major sections
- `h3`: Subsections
- `h4`: Component sections
- `h5`: Form labels, table headers
- `body1`: Standard body text
- `body2`: Secondary information
- `caption`: Helper text, hints
- `overline`: Tags, badges, status

**Never hardcode font sizes. Use theme typography.**

---

## Spacing System

**Base Unit:** 8px

**Scale:**
- `xs`: 4px (0.5 unit)
- `sm`: 8px (1 unit)
- `md`: 16px (2 units)
- `lg`: 24px (3 units)
- `xl`: 32px (4 units)
- `xxl`: 48px (6 units)

**Usage:**
```typescript
<Box sx={{
  p: 2,        // padding: 16px
  mb: 3,       // margin-bottom: 24px
  gap: 1,      // gap: 8px (flex/grid)
}}>
```

**Spacing Rules:**
- Between sections: `lg` (24px)
- Between components: `md` (16px)
- Within components: `sm` (8px)
- Form fields: `md` (16px) vertically

---

## Shadows & Elevation

**Use MUI elevation levels:**
- `elevation0`: Flat (borders only)
- `elevation1`: Cards, light hover
- `elevation2`: Modals, dropdowns
- `elevation3`: Important modals, popovers
- `elevation8+`: FABs, overlays

**Application:**
- Cards/panels: `elevation1`
- Hovered cards: `elevation2`
- Modals: `elevation2`
- Persistent drawers: `elevation0` (use border)
- Floating buttons: `elevation8`

---

## Border & Radius

**Border Radius:**
- Buttons: `borderRadius: 8px`
- Cards: `borderRadius: 8px`
- Inputs: `borderRadius: 4px`
- Modals: `borderRadius: 8px`

**Borders:**
- Default color: `theme.palette.divider`
- Width: `1px` (never thicker)
- Hover: Same color, increase opacity (not width)

---

## Icons

**Library:** Material Design Icons (MUI Icons)

```typescript
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

<IconButton><EditIcon /></IconButton>
```

**Sizes:**
- Buttons: 24px (default)
- Headers: 32px
- Navigation: 24px
- Inline: 20px
- Large UI: 40px

**Rules:**
- No external icon libraries
- No emoji as icons
- No custom SVG for standard actions
- Use color names: `color="primary"`, `color="error"`, etc.

---

## Buttons

**Variants:**
```typescript
// Primary action
<Button variant="contained" color="primary">Save</Button>

// Secondary action
<Button variant="outlined" color="primary">Cancel</Button>

// Tertiary action
<Button variant="text" color="primary">Learn More</Button>

// Icon button
<IconButton color="primary"><EditIcon /></IconButton>
```

**Sizes:**
- Large: `size="large"` (48px)
- Medium: `size="medium"` (36px, default)
- Small: `size="small"` (32px)

**States:**
- Normal: Full color
- Hover: Darker shade
- Disabled: Grayed out
- Loading: Spinner, disabled

**Spacing:**
- Between buttons: `gap: 1` (8px)
- Button width: Auto (content-based)
- Full-width: Only for forms

---

## Forms & Inputs

**Text Inputs:**
```typescript
<TextField
  label="Patient Name"
  variant="outlined"     // Always outlined
  fullWidth              // In forms
  size="medium"          // Default
  placeholder="Hint"
  error={hasError}
  helperText="Error message"
/>
```

**Layout:**
- Vertical stacking (one per row)
- Label above input
- Helper text below
- Error below in red
- Required: `*` after label

**Spacing:**
- Between inputs: `mb: 2` (16px)
- Between sections: `mb: 3` (24px)
- Form padding: `p: 3` (24px)

**Select/Dropdown:**
```typescript
<FormControl fullWidth>
  <InputLabel>Status</InputLabel>
  <Select value={status} onChange={handleChange}>
    <MenuItem value="ACTIVE">Active</MenuItem>
    <MenuItem value="INACTIVE">Inactive</MenuItem>
  </Select>
</FormControl>
```

**Checkboxes & Radios:**
- Checkbox: Multiple selections
- Radio: Single selection
- Always use `FormControlLabel`
- Use `FormGroup` for groups

**Never:**
- Use inline forms
- Placeholder-only labels
- Mix input variants
- Create custom inputs

---

## Tables

**Structure:**
```typescript
<TableContainer>
  <Table>
    <TableHead>
      <TableRow>
        <TableCell>Name</TableCell>
        <TableCell>Status</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {rows.map(row => (
        <TableRow key={row.id} hover>
          <TableCell>{row.name}</TableCell>
          <TableCell><Chip label={row.status} /></TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</TableContainer>
```

**Features:**
- Striped rows (alternate backgrounds)
- Hover effects
- Sortable headers (arrow icon)
- Pagination (bottom toolbar)
- Checkbox selection (bulk actions)
- Right-aligned numbers/actions

**Responsive:**
- Desktop: Full table, all columns
- Tablet: Hide non-essential columns
- Mobile: Card view or horizontal scroll

---

## Cards & Panels

**Structure:**
```typescript
<Card>
  <CardHeader title="Title" avatar={<Avatar />} />
  <CardContent>{/* Main content */}</CardContent>
  <CardActions>
    <Button>Action</Button>
  </CardActions>
</Card>
```

**Usage:**
- Dashboard summaries
- List items
- Section containers

**Styling:**
- Elevation: `elevation1`
- Hover: `elevation2`
- Border: Optional thin border
- Padding: `p: 2` (16px)

---

## Modals & Dialogs

**Structure:**
```typescript
<Dialog open={open} onClose={handleClose} maxWidth="sm">
  <DialogTitle>Confirm Action</DialogTitle>
  <DialogContent>Content here</DialogContent>
  <DialogActions>
    <Button onClick={handleClose}>Cancel</Button>
    <Button onClick={handleConfirm}>Confirm</Button>
  </DialogActions>
</Dialog>
```

**Types:**
- Confirmation: Yes/no
- Alert: One action
- Form: Multi-field
- Selection: Choose from list

**Rules:**
- Single title
- Clear content
- Actions at bottom
- Max width: `sm` (600px) or `md` (960px)
- Always have close option

**Never:**
- Create custom modals
- Nest dialogs
- Use for complex workflows
- Allow scrollable body overflow

---

## Notifications & Alerts

**Alert:**
```typescript
<Alert severity="success">Success message</Alert>
<Alert severity="warning">Warning message</Alert>
<Alert severity="error">Error message</Alert>
<Alert severity="info">Info message</Alert>
```

**Severity Mapping:**
- `success`: Operation succeeded
- `warning`: Caution, review needed
- `error`: Operation failed
- `info`: Informational only

**Toast (Snackbar):**
```typescript
<Snackbar open={open} autoHideDuration={6000} onClose={handleClose}>
  <Alert severity="success">Saved successfully</Alert>
</Snackbar>
```

**Placement:**
- Page-top: Critical alerts
- Inline: Validation errors
- Toast: Transient success messages
- Modal: Destructive confirmations

**Rules:**
- Max 2-3 visible alerts
- Auto-dismiss: 6s for success, persistent for errors
- Stack toasts vertically

---

## Loading States

**Page Loading:**
```typescript
{isLoading ? (
  <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
    <CircularProgress />
  </Box>
) : (
  <Content />
)}
```

**Skeleton Loading:**
```typescript
import Skeleton from '@mui/lab/Skeleton';
<Skeleton variant="text" width="60%" />
<Skeleton variant="rectangular" width="100%" height={40} />
```

**Button Loading:**
```typescript
<Button 
  disabled={isLoading}
  startIcon={isLoading ? <CircularProgress size={20} /> : <SaveIcon />}
>
  {isLoading ? 'Saving...' : 'Save'}
</Button>
```

**Best Practices:**
- Show spinners for data fetches
- Show skeleton for content structure
- Keep buttons enabled with indicator (prevent re-click)
- Show progress for long operations
- Never show empty state during loading

---

## Empty & Error States

**Empty State:**
```typescript
<Box sx={{ textAlign: 'center', py: 8 }}>
  <SearchIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
  <Typography variant="h6" color="text.secondary">
    No patients found
  </Typography>
  <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
    Try adjusting your search
  </Typography>
</Box>
```

**Error State:**
```typescript
<Box sx={{ textAlign: 'center', py: 8 }}>
  <ErrorIcon sx={{ fontSize: 60, color: 'error.main', mb: 2 }} />
  <Typography variant="h6">Failed to load data</Typography>
  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
    {errorMessage}
  </Typography>
  <Button variant="contained" sx={{ mt: 2 }} onClick={retry}>
    Retry
  </Button>
</Box>
```

**Rules:**
- Icon (optional but recommended)
- Heading explaining state
- Optional secondary message
- Optional action (create, retry)
- No raw error stack traces

---

## Responsive Design

**Breakpoints:**
```
xs: 0        // mobile
sm: 600px    // tablet
md: 960px    // small laptop
lg: 1280px   // desktop
xl: 1920px   // large desktop
```

**Grid System:**
```typescript
<Grid container spacing={2}>
  <Grid item xs={12} sm={6} md={4}>Card 1</Grid>
  <Grid item xs={12} sm={6} md={4}>Card 2</Grid>
  <Grid item xs={12} sm={6} md={4}>Card 3</Grid>
</Grid>
```

**Mobile-First:**
- Design for mobile first
- Progressively enhance for larger screens
- Hide non-essential elements on mobile

**Navigation:**
- Mobile: Hamburger menu (Drawer)
- Tablet/Desktop: Sidebar

**Forms:**
- Mobile: Single column, full-width
- Tablet: 1-2 columns
- Desktop: 2-3 columns

**Tables:**
- Mobile: Card view or scroll
- Tablet: Condensed
- Desktop: Full table

---

## Accessibility (WCAG 2.1 AA)

**Color Contrast:**
- Text: ≥ 4.5:1 ratio
- UI components: ≥ 3:1 ratio

**Keyboard Navigation:**
- Tab through elements
- Enter/Space to activate
- Escape to close modals

**Screen Readers:**
- Semantic HTML
- ARIA labels on icons
- Meaningful link text

**Best Practices:**
```typescript
// Proper labels
<TextField label="Email" />

// Icon button aria-label
<IconButton aria-label="delete"><DeleteIcon /></IconButton>

// Semantic lists
<ul>
  {items.map(item => <li key={item.id}>{item.name}</li>)}
</ul>

// Meaningful links
<Link href="/patients">View all patients</Link>
```

**Never:**
- Use color alone to convey info
- Skip heading hierarchy
- Use `button` without handler
- Hide content from screen readers

---

## Dark Mode

**Implementation:**
```typescript
const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
const theme = useMemo(
  () => prefersDarkMode ? darkTheme : lightTheme,
  [prefersDarkMode]
);
```

**Colors:**
- Backgrounds: Dark (near-black)
- Text: Light (white to high-contrast gray)
- Surfaces: Elevated from background
- Accents: Same as light mode

**Testing:**
- Test all pages in both modes
- Verify contrast ratios
- Check image/icon visibility

---

## Component Guidelines

### Reusable Components
1. **StatusChip** - Display status with color
2. **PatientCard** - Patient summary
3. **DataTable** - Reusable table
4. **FormLayout** - Form wrapper
5. **EmptyState** - Empty result display
6. **ActionMenu** - Row action dropdown
7. **LoadingState** - Loading indicator
8. **ErrorState** - Error display

### Creating Components
- Focus on single responsibility
- Use TypeScript interfaces for props
- Document props with JSDoc
- Composition over inheritance
- Keep logic out of UI components

**File Organization:**
```
src/components/
├── common/              # Shared (Button, Card, etc.)
├── layout/              # Page layout
├── [feature]/           # Feature-specific
│   ├── FeatureCard.tsx
│   ├── FeatureForm.tsx
│   └── index.ts
```

---

## Import Order

```typescript
// 1. React/Next
import React, { useState } from 'react';

// 2. Third-party UI
import { Box, Button } from '@mui/material';

// 3. Project components
import { PatientCard } from '@/components';

// 4. Project features/hooks
import { usePatient } from '@/features/patients/hooks';

// 5. Types
import type { Patient } from '@/features/patients/types';
```

---

## sx Prop Property Order

```typescript
sx={{
  // Display
  display: 'flex',
  
  // Position
  position: 'relative',
  
  // Box model
  width: '100%',
  p: 2,
  m: 1,
  
  // Flex
  flexDirection: 'column',
  gap: 2,
  
  // Colors
  bgcolor: 'primary.main',
  color: 'text.primary',
  
  // Text
  fontSize: '16px',
  fontWeight: 600,
  
  // Borders & shadows
  border: '1px solid',
  borderColor: 'divider',
  
  // Interactions
  '&:hover': { bgcolor: 'primary.light' },
  
  // Responsive
  '@media (max-width: 600px)': { p: 1 }
}}
```

---

## Performance Optimization

**Use `React.memo()`** for expensive components:
```typescript
const PatientRow = React.memo(({ patient, onEdit }) => (
  <TableRow>
    <TableCell>{patient.name}</TableCell>
    <TableCell>
      <IconButton onClick={() => onEdit(patient.id)}>
        <EditIcon />
      </IconButton>
    </TableCell>
  </TableRow>
));
```

**Use `useCallback()`** for event handlers:
```typescript
const handleEdit = useCallback((patientId) => {
  // Handle edit
}, []);
```

**Lazy-load pages:**
```typescript
const PatientPage = dynamic(() => import('./PatientPage'), {
  loading: () => <LoadingState />,
});
```

**Avoid:**
- Inline function definitions in JSX
- Creating objects/arrays in JSX
- Unnecessary re-renders

---

## Testing Components

```typescript
describe('PatientCard', () => {
  it('renders patient information', () => {
    render(<PatientCard patient={mockPatient} />);
    expect(screen.getByText(mockPatient.name)).toBeInTheDocument();
  });
  
  it('calls onClick handler when clicked', () => {
    const onClick = jest.fn();
    render(<PatientCard patient={mockPatient} onClick={onClick} />);
    userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });
});
```

---

## Golden Rules

1. ✅ Use MUI for all components
2. ✅ Follow Material Design 3
3. ✅ Use theme tokens (never hardcoded colors)
4. ✅ Responsive from start
5. ✅ Consider accessibility
6. ✅ Test light and dark modes
7. ✅ Reuse components
8. ✅ Keep components focused
9. ✅ No secrets in UI
10. ✅ Maintain consistency

---

## Never Do These Things

❌ Hardcode colors/values  
❌ Create custom button/card components  
❌ Use Tailwind or other CSS frameworks  
❌ Build forms without validation  
❌ Skip dark mode testing  
❌ Ignore responsive design  
❌ Use `any` type in TypeScript  
❌ Commit secrets or API keys  
❌ Create complex state management initially  
❌ Skip server-side authorization checks
