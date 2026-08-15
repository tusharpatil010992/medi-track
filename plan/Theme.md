# Frontend Development & Theme Guidelines

Frontend development rules, theme system, and design patterns that must be followed consistently across the Medi-Track application.

---

## 1. UI Framework & Styling

**Stack:**
- Material UI (MUI) v5+ for components
- TypeScript for type safety
- No Tailwind (use MUI's `sx` prop or `styled`)
- CSS Modules only for page-specific overrides (minimal use)
- No custom CSS-in-JS libraries beyond MUI

**Design Philosophy:**
- Material Design 3 principles
- Clean, professional medical UI
- High contrast for accessibility
- Consistent spacing and typography
- No shadows-heavy design; flat where appropriate for medical context

---

## 2. Theme Configuration

**MUI Theme Structure**
```typescript
// themes/lightTheme.ts
export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1976d2' },      // Primary action color
    secondary: { main: '#dc004e' },    // Secondary action color
    success: { main: '#2e7d32' },      // Success states
    warning: { main: '#f57c00' },      // Warnings
    error: { main: '#d32f2f' },        // Errors
    info: { main: '#0288d1' },         // Info messages
    background: { default: '#fafafa', paper: '#ffffff' },
    text: { primary: '#000000', secondary: '#666666' },
  },
  typography: { fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif' },
  shape: { borderRadius: 8 },
});

// themes/darkTheme.ts - mirror light theme with dark mode adjustments
```

**Apply Theme:**
```typescript
// app/layout.tsx
import { ThemeProvider } from '@mui/material/styles';
import { lightTheme, darkTheme } from '@/themes';

export default function RootLayout({ children }) {
  const isDark = useSystemDarkMode(); // User preference
  return (
    <ThemeProvider theme={isDark ? darkTheme : lightTheme}>
      {children}
    </ThemeProvider>
  );
}
```

**Do NOT:**
- Override theme inline in every component
- Use hex colors directly in components
- Define custom colors outside the theme
- Create multiple theme files for different sections

---

## 3. Color Palette

**Primary Colors:**
- Primary Blue: `#1976d2` (actions, links, focus states)
- Primary Dark: `#1565c0` (hover states)
- Primary Light: `#42a5f5` (disabled/light backgrounds)

**Status Colors (Fixed across light/dark):**
- Success Green: `#2e7d32` (approved, completed)
- Warning Orange: `#f57c00` (pending, attention needed)
- Error Red: `#d32f2f` (errors, cancellations, failures)
- Info Blue: `#0288d1` (informational messages)

**Semantic Colors:**
- Appointment: Info Blue
- Consultation: Primary Blue
- Prescribed Medicine: Success Green
- Cancelled: Error Red
- Draft: Warning Orange
- Completed: Success Green

**Neutrals:**
- Borders: `#e0e0e0` (light mode), `#424242` (dark mode)
- Backgrounds: `#fafafa` (light), `#121212` (dark)
- Text Primary: `#000000` (light), `#ffffff` (dark)
- Text Secondary: `#666666` (light), `#b0b0b0` (dark)
- Disabled: `#cccccc` (light), `#424242` (dark)

**Do NOT:**
- Use colors directly from design files; map through theme palette
- Create custom color variants per page
- Use color names like "orange" or "blue"; use semantic names like "primary" or "success"

---

## 4. Typography

**Font Family:**
- Primary: Roboto (via Google Fonts)
- Fallback: Helvetica, Arial, sans-serif

**Type Scale:**
```typescript
{
  h1: { fontSize: '32px', fontWeight: 700, lineHeight: 1.2 },     // Page titles
  h2: { fontSize: '28px', fontWeight: 700, lineHeight: 1.3 },     // Section headers
  h3: { fontSize: '24px', fontWeight: 600, lineHeight: 1.4 },     // Subsection headers
  h4: { fontSize: '20px', fontWeight: 600, lineHeight: 1.4 },     // Component headers
  h5: { fontSize: '16px', fontWeight: 600, lineHeight: 1.5 },     // Labels
  h6: { fontSize: '14px', fontWeight: 600, lineHeight: 1.5 },     // Small labels
  body1: { fontSize: '16px', fontWeight: 400, lineHeight: 1.6 },  // Body text
  body2: { fontSize: '14px', fontWeight: 400, lineHeight: 1.6 },  // Secondary body
  caption: { fontSize: '12px', fontWeight: 400, lineHeight: 1.5 }, // Helper text
  overline: { fontSize: '11px', fontWeight: 600, lineHeight: 1.6, textTransform: 'uppercase' }, // Tags/labels
}
```

**Usage Rules:**
- `h1`: Page titles only
- `h2`: Major section headers
- `h3`: Subsection headers
- `h4`: Component section headers
- `h5`: Form labels, table headers
- `body1`: Standard body text, descriptions
- `body2`: Secondary information, secondary text
- `caption`: Helper text, hints, meta information
- `overline`: Tags, badges, status labels

**Do NOT:**
- Use hardcoded font sizes
- Mix font families
- Use `<strong>` or `<b>` directly; use `fontWeight: 600` via `sx`
- Create custom font sizes not in the type scale

---

## 5. Spacing System

**Base Unit:** 8px

**Spacing Scale:**
```
xs: 4px   (0.5 unit)
sm: 8px   (1 unit)
md: 16px  (2 units)
lg: 24px  (3 units)
xl: 32px  (4 units)
xxl: 48px (6 units)
```

**Usage Examples:**
```typescript
<Box sx={{ 
  p: 2,              // padding: 16px (md)
  mb: 3,             // margin-bottom: 24px (lg)
  gap: 1,            // gap: 8px (sm) - for flex/grid
}}>
```

**Margin/Padding Rules:**
- Between sections: `lg` (24px)
- Between components: `md` (16px)
- Within components: `sm` (8px)
- Form field spacing: `md` (16px) vertically

**Do NOT:**
- Use arbitrary spacing values like `px: 15` or `mb: 20`
- Mix spacing units (use either theme scale or MUI spacing array)

---

## 6. Shadows & Elevation

**Elevation Levels:**
- `elevation0`: Flat (borders only)
- `elevation1`: Cards, slight hover states
- `elevation2`: Modals, dropdowns
- `elevation3`: Important modals, popovers
- `elevation8+`: Floating action buttons, drawer overlays

**Application:**
```typescript
{
  elevation1: 'box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12)',
  elevation2: 'box-shadow: 0 3px 6px rgba(0, 0, 0, 0.16)',
  elevation3: 'box-shadow: 0 10px 20px rgba(0, 0, 0, 0.19)',
}
```

**Usage:**
- Cards/panels: `elevation1`
- Hovered cards: `elevation2`
- Modals/dialogs: `elevation2`
- Persistent drawers: `elevation0` (use border)
- Floating action buttons: `elevation8`

**Do NOT:**
- Create custom shadow values
- Use `box-shadow` directly; use MUI elevation
- Use heavy shadows on content-heavy pages

---

## 7. Border & Radius

**Border Radius:**
- Buttons: `borderRadius: 8px` (or `theme.shape.borderRadius`)
- Cards: `borderRadius: 8px`
- Inputs: `borderRadius: 4px` (compact)
- Modals: `borderRadius: 8px`

**Borders:**
- Default border color: `theme.palette.divider`
- Border width: `1px` (never thicker)
- Hover border: Same color, increase opacity (not width)

**Do NOT:**
- Use circular buttons for non-icon actions (`borderRadius: '50%'` only for avatars/icon buttons)
- Create varied radius values per component

---

## 8. Icons

**Icon Library:** Material Design Icons (MUI Icons)

**Usage:**
```typescript
import ClinicsIcon from '@mui/icons-material/LocalHospital';

<IconButton>
  <ClinicsIcon />
</IconButton>
```

**Icon Sizes:**
- Buttons: 24px (default)
- Headers: 32px
- Navigation: 24px
- Inline: 20px
- Large UI: 40px

**Do NOT:**
- Use external icon libraries (Font Awesome, Feather, etc.)
- Use emoji as icons
- Create custom SVG icons for standard UI actions
- Resize icons arbitrarily; stick to 4px increments (16, 20, 24, 32, 40)

**Icon Color:**
- Use `color="primary"`, `color="secondary"`, `color="success"`, etc.
- Never hardcode icon colors

---

## 9. Buttons

**Button Variants:**
```typescript
// Contained (primary action)
<Button variant="contained" color="primary">Save</Button>

// Outlined (secondary action)
<Button variant="outlined" color="primary">Cancel</Button>

// Text (tertiary action)
<Button variant="text" color="primary">Learn More</Button>

// Icon button
<IconButton color="primary"><EditIcon /></IconButton>
```

**Button States:**
- Normal: Full color
- Hover: Slightly darker shade
- Disabled: Grayed out, cursor not-allowed
- Loading: Spinner inside, disabled state

**Sizing:**
- Large: `size="large"` (h=48px)
- Medium: `size="medium"` (h=36px, default)
- Small: `size="small"` (h=32px)

**Button Spacing:**
- Between buttons: `gap: 1` (8px) in a flex row
- Button width: Auto (content-based), not 100% unless explicitly full-width input
- Sticky actions: Fixed at bottom with padding

**Do NOT:**
- Create custom button styles
- Use different color variants arbitrarily
- Use `disabled` without visual feedback
- Make buttons 100% width unless form-related

---

## 10. Forms & Inputs

**Text Inputs:**
```typescript
<TextField
  label="Patient Name"
  variant="outlined"         // Always "outlined" (modern MUI style)
  fullWidth                  // For form context
  size="medium"              // Default
  placeholder="Full name"    // Optional hint
  error={hasError}           // Red border + error message
  helperText="Error message"
/>
```

**Form Layout:**
- Vertical stacking (one input per row on mobile, potentially 2-col on desktop)
- Label above input (not placeholder-only)
- Helper text below input for hints
- Error messages below input in red
- Required indicator: `*` after label (not in placeholder)

**Form Spacing:**
- Between inputs: `mb: 2` (16px)
- Between sections: `mb: 3` (24px)
- Form container padding: `p: 3` (24px)

**Select/Dropdown:**
```typescript
<FormControl fullWidth>
  <InputLabel>Appointment Status</InputLabel>
  <Select value={status} onChange={handleChange}>
    <MenuItem value="SCHEDULED">Scheduled</MenuItem>
    <MenuItem value="COMPLETED">Completed</MenuItem>
  </Select>
</FormControl>
```

**Checkboxes & Radios:**
- Checkbox: For multiple selections (multi-select list)
- Radio: For single selection from a list
- Always pair with FormControlLabel for better UX
- Use `FormGroup` to group checkboxes

**Do NOT:**
- Use inline form elements (inputs next to labels)
- Use placeholder-only labels
- Create custom input components; use MUI TextField
- Mix input variants on the same page

---

## 11. Tables

**Table Structure:**
```typescript
<TableContainer>
  <Table>
    <TableHead>
      <TableRow>
        <TableCell>Patient Name</TableCell>
        <TableCell>Appointment Date</TableCell>
        <TableCell align="right">Status</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {rows.map(row => (
        <TableRow key={row.id} hover>
          <TableCell>{row.name}</TableCell>
          <TableCell>{row.date}</TableCell>
          <TableCell align="right"><Chip label={row.status} /></TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</TableContainer>
```

**Table Features:**
- Striped rows (via `TableRow` background on alternate rows)
- Hover effect on rows (light background on hover)
- Sortable headers (arrow icon when sorted)
- Pagination (bottom toolbar with page control)
- Checkbox selection (first column for bulk actions)
- Column alignment: Left for text, right for numbers/actions

**Table Headers:**
- Bold text
- Slightly darker background
- Sticky header on scroll

**Row Actions:**
- Icon buttons on the right (3 dots = more actions)
- Inline quick actions (edit, delete) for common tasks
- Hover-reveal secondary actions

**Responsive Behavior:**
- Desktop: Full table with all columns
- Tablet: Hide non-essential columns, stack important ones
- Mobile: Horizontal scroll or card view per row

**Do NOT:**
- Use `<table>` HTML elements directly; use MUI Table component
- Create custom table styling
- Mix striped and non-striped tables
- Make tables full-width if not needed

---

## 12. Cards & Panels

**Card Structure:**
```typescript
<Card>
  <CardHeader
    title="Consultation Summary"
    avatar={<Avatar>{initials}</Avatar>}
  />
  <CardContent>
    {/* Main content */}
  </CardContent>
  <CardActions>
    <Button>Action 1</Button>
    <Button>Action 2</Button>
  </CardActions>
</Card>
```

**Card Usage:**
- Dashboard summaries: Cards with key metrics
- List items: Cards for each item in a list
- Section containers: Cards to group related content
- Modal content: Use Dialog, not custom card

**Card Styles:**
- Elevation: `elevation1` (default)
- Hover elevation: `elevation2`
- Border: Optional thin border for emphasis
- Spacing inside: `p: 2` (16px)

**Do NOT:**
- Create custom card components; use MUI Card
- Nest cards deeply
- Use cards for simple content grouping (use Box/Stack instead)

---

## 13. Modals & Dialogs

**Dialog Structure:**
```typescript
<Dialog open={open} onClose={handleClose} maxWidth="sm">
  <DialogTitle>Confirm Action</DialogTitle>
  <DialogContent>
    <Typography>Are you sure?</Typography>
  </DialogContent>
  <DialogActions>
    <Button variant="text" onClick={handleClose}>Cancel</Button>
    <Button variant="contained" color="error" onClick={handleConfirm}>Delete</Button>
  </DialogActions>
</Dialog>
```

**Dialog Types:**
- Confirmation: Simple yes/no
- Alert: Informational, one action
- Form: Multi-field input
- Selection: Choose from list

**Dialog Rules:**
- Single title (use `DialogTitle`)
- Clear content area (use `DialogContent`)
- Action buttons at bottom (use `DialogActions`)
- Max width: `sm` (600px) for most, `md` (960px) for complex forms
- Always have a close button (X in header or Cancel button)

**Backdrop:**
- Blur/dim background behind dialog
- Click outside to dismiss (unless critical confirmation)

**Do NOT:**
- Create custom modal components; use MUI Dialog
- Nest dialogs (avoid dialog inside dialog)
- Use dialogs for complex multi-step workflows (use separate pages instead)
- Put scrollable content inside Dialog; let it scroll naturally

---

## 14. Notifications & Alerts

**Alert Component:**
```typescript
<Alert severity="success">Operation completed successfully</Alert>
<Alert severity="warning">Please review before submitting</Alert>
<Alert severity="error">Failed to save changes</Alert>
<Alert severity="info">New update available</Alert>
```

**Severity Mapping:**
- `success`: Operation succeeded
- `warning`: Caution, review needed
- `error`: Operation failed
- `info`: Informational, no action needed

**Toast Notifications (Snackbar):**
```typescript
<Snackbar open={open} autoHideDuration={6000} onClose={handleClose}>
  <Alert severity="success">Saved successfully</Alert>
</Snackbar>
```

**Toast Rules:**
- Bottom-right corner position
- Auto-dismiss after 6 seconds (success), persist for errors
- Stack multiple toasts vertically
- Only show one critical toast at a time

**Alert Placement:**
- Page-top: Critical alerts (errors blocking workflow)
- Inline: Validation errors below form fields
- Toast: Transient success messages
- Modal: Confirmation before destructive actions

**Do NOT:**
- Show too many alerts on one page (max 2-3 visible)
- Use alerts for loading states (use spinners instead)
- Create custom notification components; use Alert + Snackbar

---

## 15. Loading States

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

<Box>
  <Skeleton variant="text" width="60%" />
  <Skeleton variant="rectangular" width="100%" height={40} sx={{ mt: 1 }} />
</Box>
```

**Button Loading:**
```typescript
<Button disabled={isLoading} startIcon={isLoading ? <CircularProgress size={20} /> : <SaveIcon />}>
  {isLoading ? 'Saving...' : 'Save'}
</Button>
```

**Loading Best Practices:**
- Show spinners for data fetches
- Show skeleton for content structure visibility
- Keep buttons enabled with loading indicator (optional: disable to prevent re-clicks)
- Show progress for long operations (file upload, export)
- Never show empty state during loading

**Do NOT:**
- Use loading overlays that block the entire page (unless truly necessary)
- Show multiple spinners on the same component
- Add animations beyond built-in MUI spinner

---

## 16. Empty & Error States

**Empty State:**
```typescript
<Box sx={{ textAlign: 'center', py: 8 }}>
  <SearchIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
  <Typography variant="h6" color="text.secondary">No patients found</Typography>
  <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
    Try adjusting your search criteria
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
  <Button variant="contained" sx={{ mt: 2 }} onClick={retry}>Retry</Button>
</Box>
```

**Empty State Rules:**
- Icon (optional but recommended)
- Heading explaining why empty
- Optional secondary message
- Optional action (e.g., "Create first patient")

**Error State Rules:**
- Error icon or alert style
- Clear error message
- Optional retry/help actions
- No raw error stack traces to users

**Do NOT:**
- Show completely blank page when empty
- Hide error messages
- Use error states to show validation messages (use form-level feedback)

---

## 17. Responsive Design

**Breakpoints:**
```typescript
{
  xs: 0,      // mobile
  sm: 600px,  // tablet
  md: 960px,  // small laptop
  lg: 1280px, // desktop
  xl: 1920px, // large desktop
}
```

**Responsive Grid:**
```typescript
<Grid container spacing={2}>
  <Grid item xs={12} sm={6} md={4}>Card 1</Grid>
  <Grid item xs={12} sm={6} md={4}>Card 2</Grid>
  <Grid item xs={12} sm={6} md={4}>Card 3</Grid>
</Grid>
```

**Mobile-First Approach:**
- Design for mobile first
- Progressively add complexity for larger screens
- Hide non-essential elements on mobile

**Navigation:**
- Mobile: Hamburger menu (Drawer)
- Tablet/Desktop: Sidebar navigation

**Forms:**
- Mobile: Single column, full-width inputs
- Tablet: 1-2 columns
- Desktop: 2-3 columns

**Tables:**
- Mobile: Card view or horizontal scroll
- Tablet: Condensed table or card view
- Desktop: Full table with all columns

**Do NOT:**
- Use `display: 'none'` excessively; design for each breakpoint
- Create mobile-specific pages; use responsive components
- Use hardcoded pixel widths; use MUI's Grid and `sx` responsive props

---

## 18. Accessibility (a11y)

**WCAG 2.1 AA Compliance:**
- Color contrast ratio ≥ 4.5:1 for text
- Color contrast ratio ≥ 3:1 for UI components
- Keyboard navigation (Tab, Enter, Escape)
- Screen reader friendly (semantic HTML, ARIA labels)

**Common Practices:**
```typescript
// Proper label association
<TextField label="Email" />

// Icon buttons need aria-label
<IconButton aria-label="delete">
  <DeleteIcon />
</IconButton>

// Lists should be semantic
<ul>
  {items.map(item => <li key={item.id}>{item.name}</li>)}
</ul>

// Links need meaningful text
<Link href="/patients">View all patients</Link> // Good
<Link href="/patients">Click here</Link>       // Bad
```

**Do NOT:**
- Use color alone to convey information (add icons/text)
- Skip heading hierarchy (don't jump from h1 to h3)
- Use `<button>` without `onClick` handler
- Create invisible-to-screen-reader content (hidden with `display: none`)

---

## 19. Dark Mode

**Implementation:**
```typescript
const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
const theme = useMemo(
  () => (prefersDarkMode ? darkTheme : lightTheme),
  [prefersDarkMode]
);
```

**Dark Mode Colors:**
- Backgrounds: Darker (near-black to avoid eye strain)
- Text: Lighter (white to high-contrast gray)
- Surfaces: Elevated slightly from background
- Accent colors: Same as light mode (no desaturation)

**Testing:**
- Test all pages in both light and dark modes
- Ensure contrast ratios are met in both modes
- Check images/icons for visibility

**Do NOT:**
- Create dark mode via CSS filter inversion
- Use fully white text on dark backgrounds (use slightly dimmed white)
- Skip testing dark mode

---

## 20. Component Library & Reusability

**Common Reusable Components:**

1. **StatusChip** - Display status with color
```typescript
<StatusChip status="COMPLETED" />
<StatusChip status="SCHEDULED" />
```

2. **PatientCard** - Display patient summary
```typescript
<PatientCard patient={patient} onClick={handleSelect} />
```

3. **DataTable** - Reusable table with sorting/pagination
```typescript
<DataTable columns={columns} data={data} onRowClick={handleRow} />
```

4. **FormLayout** - Standard form wrapper
```typescript
<FormLayout title="New Patient" onSubmit={handleSubmit}>
  {/* form fields */}
</FormLayout>
```

5. **EmptyState** - Empty result display
```typescript
<EmptyState icon={SearchIcon} title="No results" action={<Button>Add New</Button>} />
```

6. **ActionMenu** - Row action dropdown
```typescript
<ActionMenu actions={[
  { label: 'Edit', icon: <EditIcon />, onClick: handleEdit },
  { label: 'Delete', icon: <DeleteIcon />, onClick: handleDelete },
]} />
```

**Component Guidelines:**
- Create components in `src/components/` by feature/domain
- Export from index files for cleaner imports
- Use TypeScript interfaces for props
- Document props with JSDoc
- Keep components focused (single responsibility)
- Composition over inheritance

**Do NOT:**
- Create duplicate components
- Make components overly generic
- Prop-drill more than 2 levels deep (use Context for deeper)

---

## 21. Layout Components

**Standard Page Layout:**
```typescript
<Box sx={{ display: 'flex', minHeight: '100vh' }}>
  {/* Sidebar Navigation */}
  <Box sx={{ width: 240, bgcolor: 'background.paper' }}>
    <Navigation />
  </Box>
  
  {/* Main Content */}
  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
    {/* Header */}
    <AppBar position="sticky">
      <Toolbar>
        <Typography variant="h5">Page Title</Typography>
      </Toolbar>
    </AppBar>
    
    {/* Content */}
    <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
      <PageContent />
    </Box>
    
    {/* Footer (optional) */}
    <Box sx={{ p: 2, bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider' }}>
      Footer content
    </Box>
  </Box>
</Box>
```

**Container Sizing:**
- Content max-width: 1200px (lg)
- Form max-width: 600px (sm)
- Modal max-width: 600px (sm), 960px (md)

---

## 22. Development Workflow

**File Organization:**
```
src/
├── components/
│   ├── common/              # Shared components (Button, Card, etc. - mostly MUI)
│   ├── layout/              # Page layout components (Header, Sidebar, etc.)
│   ├── [feature]/           # Feature-specific components
│   │   ├── PatientCard.tsx
│   │   ├── PatientForm.tsx
│   │   └── index.ts
│   └── index.ts             # Central export

├── features/                # Business logic by feature
│   ├── [feature]/
│   │   ├── hooks/           # Custom hooks
│   │   ├── utils/           # Utilities
│   │   ├── types.ts         # Types/interfaces
│   │   └── api.ts           # API calls

├── themes/                  # Theme configuration
│   ├── lightTheme.ts
│   ├── darkTheme.ts
│   └── index.ts

├── styles/                  # Global styles (minimal)
│   ├── globals.css          # Reset, fonts, base styles
│   └── variables.css        # CSS custom properties (optional)
```

**CSS Naming (if using CSS Modules):**
- BEM convention: `block__element--modifier`
- Example: `.card__header--dark`
- Keep specificity low

**Import Order:**
```typescript
// 1. React/Next imports
import React, { useState } from 'react';

// 2. Third-party UI library
import { Box, Button, Card } from '@mui/material';

// 3. Project components
import { PatientCard } from '@/components';

// 4. Project features/hooks
import { usePatient } from '@/features/patients/hooks';

// 5. Types
import type { Patient } from '@/features/patients/types';
```

---

## 23. Style Property Order

**When using `sx` prop, follow this order:**
```typescript
sx={{
  // Display
  display: 'flex',
  
  // Position
  position: 'relative',
  top: 0,
  
  // Box model (width, height, padding, margin)
  width: '100%',
  height: 'auto',
  p: 2,
  m: 1,
  
  // Flex properties
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
  boxShadow: 1,
  
  // Interactions
  '&:hover': { bgcolor: 'primary.light' },
  '&:active': { bgcolor: 'primary.dark' },
  
  // Responsive
  '@media (max-width: 600px)': {
    p: 1,
  }
}}
```

---

## 24. Testing UI Components

**Component Tests Should Cover:**
- Rendering with default props
- Rendering with different prop combinations
- User interactions (click, type, etc.)
- Accessibility (keyboard navigation, labels)
- Responsive behavior

**Example:**
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

## 25. Performance Considerations

**Optimization Rules:**
- Use `React.memo()` for expensive components that receive props
- Use `useCallback()` for event handlers passed as props
- Lazy-load pages with `dynamic()` from Next.js
- Image optimization: Use `next/image` with proper sizes
- Virtualization: Use MUI DataGrid for large lists (not standard Table)

**Avoid:**
- Inline function definitions in JSX
- Creating objects/arrays in JSX
- Unnecessary re-renders

**Example:**
```typescript
const PatientRow = React.memo(({ patient, onEdit }) => (
  <TableRow>
    <TableCell>{patient.name}</TableCell>
    <TableCell align="right">
      <IconButton onClick={() => onEdit(patient.id)}>
        <EditIcon />
      </IconButton>
    </TableCell>
  </TableRow>
));
```

---

## Summary

**Golden Rules:**
1. Use MUI for all UI components
2. Follow Material Design 3 principles
3. Use theme tokens, never hardcoded colors
4. Write responsive code from the start
5. Keep accessibility in mind
6. Test in light and dark modes
7. Reuse components, minimize custom CSS
8. Keep components focused and composable
9. No secrets or sensitive data in UI
10. Maintain consistency across all screens
