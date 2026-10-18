# PPTX Skill Branding System

Single source of truth for all design tokens (colors, fonts, spacing) in the PPTX skill.

## Overview

The branding system centralizes all visual design specifications in JSON configuration files, allowing:
- **Consistent styling** across all charts, tables, and slide elements
- **Easy brand switching** by creating new JSON config files
- **Modular architecture** where scripts import branding values instead of hardcoding them

## Quick Reference: Semantic CSS Variables

Use these `var(--brand-*)` variables in HTML/CSS for common UI patterns:

| Use Case | CSS Variable | McKinsey Default |
|----------|-------------|-----------------|
| Positive / success / growth | `var(--brand-positive)` | #2E7D32 |
| Negative / error / decline | `var(--brand-negative)` | #C62828 |
| Warning / caution | `var(--brand-warning)` | #F3C13A |
| Accent / highlight | `var(--brand-accent)` | #E87722 |
| Primary brand | `var(--brand-primary)` | #1E3A5F |
| Secondary elements | `var(--brand-secondary)` | #2E75B6 |
| Body text | `var(--brand-text)` | #333333 |
| White text on dark bg | `var(--brand-text-inverse)` | #FFFFFF |
| Light surface/panel | `var(--brand-surface-light)` | (brand-dependent) |
| Muted background | `var(--brand-surface-muted)` | (brand-dependent) |

**NEVER use**: `#4CAF50`, `#EF5350`, `#FFC107`, `#FF6600`, or any other memorized web-standard hex colors. These are NOT brand colors.

## Directory Structure

```
branding/
├── mckinsey.json    # McKinsey brand configuration (default)
├── branding.mjs     # Loader module with utility functions
└── README.md        # This documentation
```

## Quick Start

### In Node.js Scripts (ESM)

```javascript
import {
  loadBranding,
  getColor,
  getFont,
  getFontSize,
  getEChartsDefaults
} from './branding/branding.mjs';

// Load default (McKinsey) branding
loadBranding();

// Or load a specific brand
loadBranding('custom');

// Access colors using dot notation
const navy = getColor('primary.navy');        // '#1E3A5F'
const bodyColor = getColor('text.body');      // '#333333'
const positive = getColor('semantic.positive'); // '#2E7D32'

// Access fonts
const dataFont = getFont('data');     // 'Arial, Helvetica, sans-serif'
const headingFont = getFont('heading'); // 'Georgia, Times New Roman, serif'

// Access font sizes (returns number in points)
const labelSize = getFontSize('dataLabel');  // 12
const axisSize = getFontSize('axisLabel');   // 11

// Get ECharts option defaults (grid, axis styling, etc.)
const defaults = getEChartsDefaults();
```

### In Browser (CSS Variables)

The `preview.js` script automatically injects CSS variables when loaded:

```html
<!-- CSS variables are automatically available -->
<style>
  .title {
    color: var(--mck-navy);
    font-family: var(--mck-font-heading);
  }
  .body-text {
    color: var(--mck-text-body);
    font-family: var(--mck-font-body);
  }
  .highlight {
    background: var(--mck-blue-light);
  }
  .positive { color: var(--mck-green); }
  .negative { color: var(--mck-red); }
</style>
```

## Switching Brands

### Create a New Brand

1. Copy the default configuration:
   ```bash
   cp mckinsey.json acme.json
   ```

2. Edit `acme.json` with your brand's colors, fonts, etc.

3. Use the new brand in scripts:
   ```javascript
   loadBranding('acme');
   ```

### Environment Variable

Override the default brand at runtime:

```bash
PPTX_BRAND=acme node scripts/render_echarts.mjs config.json
```

## Available Functions

| Function | Description | Example |
|----------|-------------|---------|
| `loadBranding(brandId)` | Load a brand config | `loadBranding('mckinsey')` |
| `getBranding()` | Get current branding object | `getBranding().colors.primary.navy` |
| `getColor(path)` | Get color by dot-path | `getColor('primary.navy')` → `'#1E3A5F'` |
| `getFont(type)` | Get font family | `getFont('data')` → `'Arial, ...'` |
| `getFontSize(element, variant)` | Get font size in pt | `getFontSize('dataLabel')` → `12` |
| `getChartColors()` | Get chart color sequence | `['#1E3A5F', '#2E75B6', ...]` |
| `getChartColor(index)` | Get color by index | `getChartColor(0)` → `'#1E3A5F'` |
| `getEChartsDefaults()` | Get ECharts option defaults | `{ animation: false, grid: {...} }` |
| `getWaterfallColors()` | Get waterfall chart colors | `{ total, addition, subtraction }` |
| `getSemanticColors()` | Get positive/negative colors | `{ positive, negative, warning }` |
| `getSlideDimensions()` | Get slide size | `{ width: 720, height: 405 }` |
| `getSlideZones()` | Get header/body/footer zones | `{ header, body, footer }` |
| `getTableStyles()` | Get table styling | Header/row/border styles |
| `getCSSVariables()` | Get all CSS variables | `{ '--mck-navy': '#1E3A5F', ... }` |
| `generateCSSRoot()` | Generate CSS :root block | `:root { --mck-navy: #1E3A5F; ... }` |

## CLI Usage

The branding module can be run directly for testing:

```bash
# Show brand info
node branding.mjs

# List available brands
node branding.mjs list

# Print color palette
node branding.mjs colors

# Print typography
node branding.mjs typography

# Generate CSS variables
node branding.mjs css

# Get ECharts defaults
node branding.mjs echarts

# Use specific brand
node branding.mjs colors acme
```

## Color Path Reference

Use these paths with `getColor()`:

### Primary Colors
- `primary.navy` - #1E3A5F (main brand color)
- `primary.logoBlue` - #24477F
- `primary.deepBlue` - #132B4D
- `primary.vividBlue` - #005EB8

### Secondary Blues
- `secondary.blueDark` - #2E75B6
- `secondary.blueMedium` - #5B9BD5
- `secondary.blueLight` - #A8C8E8
- `secondary.bluePale` - #D6E6F4

### Grays
- `gray.dark` - #666666
- `gray.medium` - #D0D0D0
- `gray.light` - #F5F3EF
- `gray.silver` - #C0C5C9
- `gray.border` - #E0E0E0

### Semantic Colors
- `semantic.positive` - #2E7D32 (green)
- `semantic.negative` - #C62828 (red)
- `semantic.warning` - #F3C13A (yellow)
- `semantic.neutral` - #A2AAAD

### Accent Colors
- `accent.gold` - #B8975C
- `accent.teal` - #00A0AF
- `accent.orange` - #E87722

### Text Colors
- `text.primary` - #222222
- `text.body` - #333333
- `text.secondary` - #666666
- `text.inverse` - #FFFFFF

### Background Colors
- `background.primary` - #FFFFFF
- `background.secondary` - #F5F3EF
- `background.dark` - #132B4D

## CSS Variables Reference

These variables are injected by `preview.js` for browser use:

| Variable | Value | Usage |
|----------|-------|-------|
| `--mck-navy` | #1E3A5F | Primary color, totals |
| `--mck-blue-dark` | #2E75B6 | Secondary series |
| `--mck-blue-medium` | #5B9BD5 | Tertiary series |
| `--mck-blue-light` | #A8C8E8 | Fourth series |
| `--mck-blue-pale` | #D6E6F4 | Fifth series |
| `--mck-gold` | #B8975C | Accent, highlights |
| `--mck-gray-medium` | #D0D0D0 | De-emphasis |
| `--mck-gray-light` | #F5F3EF | Background |
| `--mck-green` | #2E7D32 | Positive values |
| `--mck-red` | #C62828 | Negative values |
| `--mck-text-body` | #333333 | Body text |
| `--mck-font-data` | Arial... | Data/chart font |
| `--mck-font-heading` | Georgia... | Heading font |

## Configuration Schema

The brand JSON file should contain these sections:

```json
{
  "id": "brand-id",
  "name": "Brand Display Name",
  "version": "1.0",
  "description": "Brand description",

  "colors": {
    "primary": { ... },
    "secondary": { ... },
    "gray": { ... },
    "semantic": { ... },
    "accent": { ... },
    "text": { ... },
    "background": { ... }
  },

  "colorSequence": {
    "charts": ["#color1", "#color2", ...],
    "waterfall": { "total": "...", "addition": "...", ... }
  },

  "typography": {
    "families": { "heading": "...", "body": "...", "data": "..." },
    "sizes": { "dataLabel": { "default": 12 }, ... },
    "weights": { "normal": 400, "bold": 700 }
  },

  "spacing": {
    "base": 4,
    "scale": { "xs": 4, "sm": 8, "md": 12, ... }
  },

  "slide": {
    "dimensions": { "width": 720, "height": 405 },
    "zones": { "header": {...}, "body": {...}, "footer": {...} }
  },

  "charts": { ... },
  "tables": { ... },
  "cssVariables": { ... }
}
```

## Integration Points

The branding system is used by:

1. **render_echarts.mjs** - Server-side chart rendering with McKinsey defaults
2. **preview.js** - Browser-side CSS variable injection
3. **HTML examples** - Can use CSS variables for styling

## Best Practices

1. **Always use branding functions** instead of hardcoding colors
2. **Use semantic color names** (`getColor('semantic.positive')`) for context-appropriate colors
3. **Test with CLI** before using in scripts: `node branding.mjs colors`
4. **Document new brands** with their intended use case
5. **Keep CSS variables synced** when modifying mckinsey.json
