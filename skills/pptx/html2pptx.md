# HTML to PowerPoint Guide

Convert HTML slides to PowerPoint presentations with accurate positioning using the `html2pptx.mjs` library.

## Table of Contents

1. [Creating HTML Slides](#creating-html-slides)
2. [Using the html2pptx Library](#using-the-html2pptx-library)
3. [Using PptxGenJS](#using-pptxgenjs)

**Before writing HTML**: Complete the [`preflight-checklist.md`](preflight-checklist.md) for each slide.

> **MULTI-SLIDE WARNING (3+ slides):** If you are the main agent and this deck has 3+ slides, you should NOT be reading this file to write HTML yourself. Call the Task tool to spawn sub-agents — one per slide. See SKILL.md → [Multi-Slide Presentations](SKILL.md#multi-slide-presentations-sub-agent-parallelization). Each sub-agent reads this file for its own slide.

> **⚠️ CONTENT OVERFLOW is the #1 production failure.** Before writing any HTML, estimate your content height using the [Overflow Prevention Formula](#overflow-prevention-formula) below. Target ≤325pt for single-line titles, ≤302pt for two-line titles.

---

## Creating HTML Slides

### Slide Type Declaration

For structural slides (covers, dividers, agendas, executive summaries, next-steps, closing), add `data-slide-type="structural"` to `<body>`:

```html
<body class="brand-slide" data-slide-type="structural">
```

This skips validation checks that don't apply to structural slides: underfill (<70% fill), hierarchy inversion, bullet marker enforcement, content density limits, per-panel fill. **Omit for body/data slides** — they need full validation.

**Which slides are "structural"?** Any slide from `slide-selection-guide.md` categories: `structure-cover`, `structure-context`, `structure-summary`, `structure-agenda`, `structure-next-steps`.

### Layout Pattern Declaration

Copy the `data-layout` attribute from the example template you're adapting. This enables conditional validation:

| Pattern | When to Use | What Validator Checks |
|---------|-------------|----------------------|
| `chart-with-insights` | Chart + adjacent text/callout panel | ECharts required, insights panel required |
| `chart-standalone` | Chart fills content zone, no sidebar | ECharts required |
| `kpi-grid` | Grid of metric/KPI cards | Multiple card panels expected |
| `full-container` | Single container fills content zone | Dominant bordered container expected |
| `hero-cover` | Cover page / section divider | Fill checks skipped, large title expected |
| `numbered-items` | Agenda / ordered list | Number markers expected |
| `action-table` | Action items / recommendations | Table/grid structure expected |
| `comparison-grid` | Feature comparison matrix | Table/grid required |
| `side-by-side` | Parallel comparison panels | Consistent panel structure expected |
| `text-insight` | Bullet-heavy narrative | Bullet lists expected |
| `diagram` | Visual explanation with shapes | SVG elements expected |
| `process-flow` | Sequential steps with connectors | SVG connectors expected |

### Critical HTML Rules (MUST READ)

These rules apply to ALL HTML slides. Violations cause conversion failures or poor output.

1. **All text in proper tags**: `<p>`, `<h1>`-`<h6>`, `<li>`, `<th>`, `<td>`. Text directly in `<div>` will NOT appear in the PPTX.
2. **No CSS gradients**: `linear-gradient()`, `radial-gradient()`, `conic-gradient()` are not supported.
3. **No background on text elements**: Never set `background` or `background-color` on `<p>`, `<span>`, headings. Use a wrapper `<div>`.
4. **Body dimensions**: 720pt × 405pt (16:9). Content must fit within these bounds.
5. **Font sizes**: Use `pt` units. Minimum readable: 9pt. Titles: 18-22pt. Body: 11-14pt.
6. **Colors**: Use `var(--brand-*)` CSS variables via `class="brand-slide"`. Never hardcode hex values.
7. **Charts**: Use `<div data-echarts='{ JSON }' style="width: X; height: Y">` for ALL charts. Never build charts with HTML/CSS divs.
8. **Styled containers (pills, badges, status indicators)**: Even when a `<div>` has background/border styling, ALL text inside it must be wrapped in `<p>` tags. A styled `<div>` with bare text will fail validation.
9. **No CSS variables in ECharts JSON**: `var(--brand-*)` inside `data-echarts` attributes will NOT be resolved — ECharts renders server-side in Node.js without DOM. Omit colors to use auto-coloring, or use hex values.

10. **Zone structure**: Use `.title-zone`, `.content-zone`, `.footer-zone` divs for layout.

11. **Slide type selection — MANDATORY**: Consult [`slide-selection-guide.md`](slide-selection-guide.md) BEFORE writing HTML. Every new slide MUST start from the closest matching example in `examples/`.

    **IF YOU WROTE HTML WITHOUT READING AN EXAMPLE FILE, DELETE IT AND START OVER.** The `examples/` folder is the source of truth, not the inline snippets in this document.

12. **No hardcoded hex colors**: Use `var(--brand-*)` CSS variables. Common mistakes:

    | Semantic Intent | WRONG (memorized hex) | CORRECT |
    |-----------------|----------------------|---------|
    | Positive / success / growth | `#4CAF50`, `#00C853`, `#66BB6A` | `var(--brand-positive)` |
    | Negative / error / decline | `#EF5350`, `#FF5252`, `#F44336` | `var(--brand-negative)` |
    | Warning / caution | `#FFC107`, `#FF9800`, `#FFB300` | `var(--brand-warning)` |
    | Accent / highlight / CTA | `#FF6600`, `#FF5722`, `#E91E63` | `var(--brand-accent)` |
    | Primary blue | `#2196F3`, `#1976D2`, `#0D47A1` | `var(--brand-primary)` |
    | Neutral / gray | `#9E9E9E`, `#757575`, `#BDBDBD` | `var(--brand-gray-medium)` |

    These Material Design / Bootstrap colors trigger replacement warnings and produce wrong brand colors in the final PPTX.

**Validation will fail if:**
- Text is placed directly inside a `<div>` without a `<p>`, `<h1>`-`<h6>`, or `<li>` wrapper
- A `<p>` tag starts with a bullet symbol (`●`, `•`, `▶`, `✓`, `★`, `→`)
- `background` or `background-color` is set on a `<p>`, `<span>`, or heading tag
- CSS gradients (`linear-gradient`, `radial-gradient`, `conic-gradient`) are used anywhere
- Content overflows the 720pt × 405pt body dimensions

### Pipeline Override Reference

The rendering pipeline automatically modifies certain values. These overrides are **logged** in console output (`[override]` prefix). Design with them in mind:

| What | Pipeline Does | When | How to Work With It |
|---|---|---|---|
| `grid.left` | Increases to fit label widths | Horizontal bar charts | Set `grid.left` ≥ your longest label width. Pipeline only increases, never decreases |
| `grid.containLabel` | Forced to `false` | All charts | Don't rely on `containLabel` — set explicit grid margins |
| `axisLabel.overflow` | Defaults to `'truncate'` | Horizontal bar charts | Pipeline **preserves** `'break'` if you set it explicitly. Use `'break'` for multi-word labels |
| `axisLabel.interval` | Defaults to `0` (show all) | All category axes | Pipeline auto-sets `interval: 0` to prevent hidden labels. Override with explicit `interval` value if needed |
| `label.fontSize` | Minimum 10pt (7pt for inside-bar) | All charts | Don't use fonts smaller than 10pt for external labels |
| Non-brand colors | Replaced with brand palette | All slides | Use `var(--brand-*)` in CSS; use brand hex codes in ECharts data |
| Chart height | Auto-increased for dense data | Horizontal bars with many categories | Minimum = `max(categories × 20, 150) + grid.top + grid.bottom` pixels |

**Chart grid CSS variables**: After rendering, the pipeline injects CSS custom properties for each chart: `--chart-0-grid-left-pct`, `--chart-0-grid-right-pct`, `--chart-0-grid-top`, `--chart-0-grid-bottom`. Use these to align adjacent HTML elements (annotations, arrows, callouts) with chart grid boundaries instead of hardcoded margins.

### CSS PPTX Survival Reference

The pipeline auto-scans for unsupported CSS (scanner B1). If you use them, you get a **BLOCKING error** with a fix suggestion. Avoid these at authoring time:

| CSS Property | Browser | PPTX | Alternative |
|---|---|---|---|
| `border-radius` | Yes | Uniform only | SVG for complex rounded shapes |
| `box-shadow` | Yes | Outer only | Inset shadows → use border or gradient PNG |
| `clip-path` | Yes | **NO** | SVG `<polygon>` or `<path>` |
| `::before` / `::after` | Yes | **NO** | Real DOM elements (`<span>`, `<div>`) |
| `filter` (blur, drop-shadow) | Yes | **NO** | `box-shadow` for drop-shadow effects |
| `backdrop-filter` | Yes | **NO** | Remove or use semi-transparent overlay div |
| `linear-gradient` on divs | Yes | **NO** | Rasterize to PNG or use solid color steps |
| `position: sticky` | Yes | **NO** | `position: absolute` or `static` |
| `overflow: hidden` (clipping content) | Yes | Content lost | Resize container or restructure layout |
| CSS transforms on text | Yes | **NO** | `writing-mode` or SVG rotated text |

**Safe CSS** (works reliably in PPTX): `border`, `background-color`, `padding`, `margin`, `font-*`, `color`, `text-align`, `display: flex`, `position: absolute/relative`, `width`, `height`, `opacity`, `line-height`, `box-shadow` (outer).

### Overflow Prevention

**Content-zone overflow = BLOCKING ERROR** (with 3pt tolerance for Chromium/PPTX rendering differences). Body height overflow = info log only. Width overflow at body level still blocks.

**HTML zone boundaries = PPTX boundaries.** The converter uses getBoundingClientRect() which maps 1:1 to PPTX inches (px ÷ 96). Content that overflows .content-zone in the browser WILL overflow in PPTX.

Content that overflows the 720×405pt body is **REJECTED** by the converter. Common causes and fixes:

| Cause | Fix |
|-------|-----|
| Chart too tall | Reduce to ≤325pt (full-width single-line title) or ≤302pt (two-line title) |
| Too many bullets | Max 6-8 per slide; split across slides |
| Absolute positioning past bounds | Stay within 6pt→714pt (x), 40pt→365pt (y, single-line title) |
| Large padding/margins | Use 8-12pt, not 16-20pt |
| Stacked content (chart below text) | Use side-by-side layout |
| Multiple charts vertically | Use grid layout or split slides |
| Font sizes too large | Title ≤24pt, body ≤16pt, source ≤10pt |

### Overflow Resolution Priority

When the converter reports overflow, do NOT immediately cut content. Follow this order:

1. **Resize containers** — If the generated slide has whitespace, the problem is container sizing, not content volume. Use `flex: 1` on container divs to fill available space.
2. **Reduce font sizes** — Body text 14px → 12px → 11px → 10px (minimum). Title 24px → 22px → 20px (minimum). Reduce largest fonts first.
3. **Reduce padding** — Table cells: 8pt → 6pt. Panels: 16pt → 12pt → 10pt. Gaps: 12pt → 8pt.
4. **Reduce content** — Last resort. Prefer shortening over removing. Preserve verbatim quotes and data columns.
5. **Split slides** — Only if all content is essential and steps 1-4 insufficient.

**Common mistake**: Seeing "overflow by 27pt" and immediately deleting content or table columns. Often the fix is `font-size: 10px` + `padding: 6pt` which recovers 30-50pt.

### Chart Label Alignment System

The PPTX skill implements consistent label alignment across all chart types.

**How it works:**
1. `render_echarts.mjs` calculates label positions based on chart orientation
2. `containLabel: false` is set to enable manual positioning
3. Labels are aligned to start at a consistent X position (8px from left)
4. Chart titles use matching `padding-left` to align with labels

**For horizontal bar charts:**
- Y-axis labels are left-aligned
- `margin` is calculated so labels start at x=8
- Title uses `padding-left: 8px`

**For vertical charts:**
- X-axis labels are centered under bars
- `grid.left` determines where the chart area starts
- Title uses `padding-left` matching `grid.left`

**Text wrapping:**
- Labels exceeding 150px width are wrapped (max 2 lines)
- Word boundaries are preferred for wrapping
- Truncation with `...` if still too long
- X-axis labels rotated 45° if they would overlap

### McKinsey Text Styling

**4-Tier Typography System** — Every slide uses exactly 4 font-size tiers:

| Tier | Role | Size | CSS |
|------|------|------|-----|
| T1 | Slide title | 16-22px | `font-size: 20px; font-weight: bold;` |
| T2 | Panel/chart headers | 11-14px | `font-size: 12px; font-weight: bold;` |
| T3 | Body text, bullets | 9-11px | `font-size: 11px;` |
| T4 | Source, footnotes | 9px | `font-size: 9px;` |

Maximum 4 distinct font sizes per slide. Body font range: 8pt-14pt. `validate_html.cjs` will error if exceeded.

**Selective Bolding Pattern** — Insight bullets use bold lead-in with brand-primary color:

```html
<ul style="list-style: none; padding: 0; margin: 0;">
  <li style="font-size: 11px; margin-bottom: 6pt; line-height: 1.4;">
    <strong style="color: var(--brand-primary);">Revenue grew 23%</strong>
    driven by expansion in three new markets and improved pricing strategy
  </li>
  <li style="font-size: 11px; margin-bottom: 6pt; line-height: 1.4;">
    <strong style="color: var(--brand-primary);">Customer retention at 94%</strong>
    up from 87% last year due to loyalty program improvements
  </li>
</ul>
```

The bold portion (2-5 words) states the insight; the remaining text provides context.

**Em-dash prohibition** — Never use em-dashes (—). Replace with colons, semicolons, or split into two sentences. `validate_html.cjs` will error on any em-dash character.

### Content Fill Guidelines

Target 70-85% fill of the content zone (~325pt available with single-line title):

| Fill % | Height | Verdict | Action |
|--------|--------|---------|--------|
| < 50% | < 163pt | SPARSE | Add content, increase fonts/padding |
| 50-65% | 163-211pt | UNDERFILLED | Increase font sizes toward recommended |
| 65-85% | 211-276pt | TARGET | Ideal range |
| 85-95% | 276-309pt | FULL | Acceptable, monitor for overflow |
| > 95% | > 309pt | OVERFILLED | Reduce padding/fonts, or split |

`validate_html.cjs` warns when estimated height < 210pt (underfill detection).

**Safe bounds for absolute positioning:**
- Usable width: `708pt` (6pt padding each side)
- Title zone: first `~40pt` of height (single-line) / `~63pt` (two-line)
- Content zone: `40pt` to `365pt` (~325pt available single-line, ~302pt two-line)
- Footer zone: last `30pt` of height

### Overflow Prevention Formula

To check if content will fit before generating:

```
Available height = ~325pt (single-line title) / ~302pt (two-line title)

Your content height =
  + Sum of element heights (font-size in pt × line-height)
  + Container padding (top + bottom per container)
  + Margins (margin-top + margin-bottom per element)
  + Flex/grid gaps (gap × number of gaps)
  + Chart heights (as specified in style="height: Xpt")

If content height > 325pt → WILL OVERFLOW (single-line title)
If content height > 302pt → WILL OVERFLOW (two-line title)
```

### Common Layout Patterns — Safe Sizing

**KPI Dashboard (6 cards, 2 rows with sparklines):**
```
Top row (3 cards):
  Padding: 12pt × 2 = 24pt
  Label:   10px ≈ 12pt
  Value:   28px ≈ 35pt
  Subtitle:10px ≈ 12pt
  Chart:   55pt
  ─────────────────────
  Per card: ~138pt

Bottom row (3 cards):
  Padding: 10pt × 2 = 20pt
  Label:   10px ≈ 12pt
  Value:   18px ≈ 22pt
  ─────────────────────
  Per card: ~54pt

Gap between rows: 10pt

Total: 138 + 10 + 54 = 202pt ✅ (fits in 325pt)
```

**Two-Column (65% chart + 35% insights):**
```
Chart panel:
  Padding: 16pt × 2 = 32pt
  Chart title: 11pt + 8pt margin = 19pt
  Chart:       220pt
  ─────────────────────
  Total: ~271pt ✅

Insights panel:
  Padding: 16pt × 2 = 32pt
  Header:  13pt + 12pt margin = 25pt
  4 bullets: 4 × (12pt × 1.6 + 8pt margin) ≈ 108pt
  ─────────────────────
  Total: ~165pt ✅
```

**Single chart with callout box below:**
```
Chart title: 11pt + 8pt = 19pt
Chart:       200pt
Gap:         12pt
Callout:     10pt padding × 2 + 11pt text = 31pt
─────────────────────
Total: ~262pt ✅ (fits in 325pt)
```

Every HTML slide must include proper body dimensions:

### Layout Dimensions

- **16:9** (default): `width: 720pt; height: 405pt`
- **4:3**: `width: 720pt; height: 540pt`
- **16:10**: `width: 720pt; height: 450pt`

### Supported Elements

- `<p>`, `<h1>`-`<h6>` - Text with styling
- `<ul>`, `<ol>` - Lists (never use manual bullets •, -, *)
- `<table>` - Tables with headers and data (native PowerPoint tables)
- `<b>`, `<strong>` - Bold text (inline formatting)
- `<i>`, `<em>` - Italic text (inline formatting)
- `<u>` - Underlined text (inline formatting)
- `<span>` - Inline formatting with CSS styles (bold, italic, underline, color)
- `<br>` - Line breaks
- `<div>` with bg/border - Becomes shape
- `<img>` - Images
- `class="placeholder"` - Reserved space for charts (returns `{ id, x, y, w, h }`)

### Critical Text Rules

**ALL text MUST be inside `<p>`, `<h1>`-`<h6>`, `<ul>`, or `<ol>` tags:**
- ✅ Correct: `<div><p>Text here</p></div>`
- ❌ Wrong: `<div>Text here</div>` - **Text will NOT appear in PowerPoint**
- ❌ Wrong: `<span>Text</span>` - **Text will NOT appear in PowerPoint**
- Text in `<div>` or `<span>` without a text tag will be silently ignored

**NEVER use manual bullet symbols (•, -, *, etc.)** - Use `<ul>` or `<ol>` lists instead

**ONLY use web-safe fonts that are universally available:**
- ✅ Web-safe fonts: `Arial`, `Helvetica`, `Times New Roman`, `Georgia`, `Courier New`, `Verdana`, `Tahoma`, `Trebuchet MS`, `Impact`, `Comic Sans MS`
- ❌ Wrong: `'Segoe UI'`, `'SF Pro'`, `'Roboto'`, custom fonts - **Might cause rendering issues**

### Styling

- Use `display: flex` on body to prevent margin collapse from breaking overflow validation
- Use `margin` for spacing (padding included in size)
- Inline formatting: Use `<b>`, `<i>`, `<u>` tags OR `<span>` with CSS styles
  - `<span>` supports: `font-weight: bold`, `font-style: italic`, `text-decoration: underline`, `color`
  - `<span>` does NOT support: `margin`, `padding` (not supported in PowerPoint text runs)
  - Example: `<span style="font-weight: bold; color: var(--brand-primary);">Bold text</span>`
- Flexbox works - positions calculated from rendered layout
- Use `var(--brand-*)` CSS variables for colors (with `class="brand-slide"` on body). Hex colors with `#` prefix also work for overrides.
- **Text alignment**: Use CSS `text-align` (`center`, `right`, etc.) when needed as a hint to PptxGenJS for text formatting if text lengths are slightly off

### Shape Styling (DIV elements only)

**IMPORTANT: Backgrounds, borders, and shadows only work on `<div>` elements, NOT on text elements (`<p>`, `<h1>`-`<h6>`, `<ul>`, `<ol>`)**

- **Backgrounds**: CSS `background` or `background-color` on `<div>` elements only
  - Example: `<div style="background: var(--brand-bg-secondary);">` - Creates a shape with background
- **Borders**: CSS `border` on `<div>` elements converts to PowerPoint shape borders
  - Supports uniform borders: `border: 2px solid var(--brand-gray-medium)`
  - Supports partial borders: `border-left`, `border-right`, `border-top`, `border-bottom` (rendered as line shapes)
  - Example: `<div style="border-left: 8pt solid var(--brand-accent);">`
- **Border radius**: CSS `border-radius` on `<div>` elements for rounded corners
  - `border-radius: 50%` or higher creates circular shape
  - Percentages <50% calculated relative to shape's smaller dimension
  - Supports px and pt units (e.g., `border-radius: 8pt;`, `border-radius: 12px;`)
  - Example: `<div style="border-radius: 25%;">` on 100x200px box = 25% of 100px = 25px radius
- **Box shadows**: CSS `box-shadow` on `<div>` elements converts to PowerPoint shadows
  - Supports outer shadows only (inset shadows are ignored to prevent corruption)
  - Example: `<div style="box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.3);">`
  - Note: Inset/inner shadows are not supported by PowerPoint and will be skipped

### Pill/Badge Pattern (Status Indicators)

When creating colored pills, badges, or status indicators (e.g., "On track", "At risk", RAG status dots), the text **must** be inside a `<p>` tag within the styled `<div>`. A styled `<div>` with bare text will fail validation.

**Correct:**
```html
<!-- Status pill with text in <p> -->
<div style="display: inline-block; background: var(--brand-positive); border-radius: 4pt; padding: 2pt 8pt;">
  <p style="margin: 0; color: var(--brand-text-inverse); font-size: 10px; font-weight: bold;">On track</p>
</div>

<!-- Circular badge with text in <p> -->
<div style="width: 28pt; height: 28pt; border-radius: 50%; background: var(--brand-positive); display: flex; align-items: center; justify-content: center;">
  <p style="margin: 0; font-size: 11px; font-weight: bold; color: var(--brand-text-inverse);">Done</p>
</div>
```

**Wrong — will fail validation:**
```html
<!-- WRONG: bare text in styled div -->
<div style="background: var(--brand-positive); border-radius: 4pt; padding: 2pt 8pt;">On track</div>

<!-- WRONG: bullet symbol starting <p> text -->
<p style="color: var(--brand-positive);">● On track</p>
```

**Key rules for pills/badges:**
- Always wrap text in `<p>` inside the styled `<div>`
- Use descriptive text labels ("Green", "On track", "Done") instead of symbols (`●`, `✓`, `▶`)
- Set `margin: 0` on the inner `<p>` to avoid extra spacing
- See `examples/compare-table/scorecard.html` and `examples/structure-agenda/progress-tracker.html` for working examples

### Table Styling

HTML `<table>` elements are converted to native PowerPoint tables with full styling support.

**Supported CSS properties:**
- `background-color` on `<th>`, `<td>`, or `<tr>` - Cell/row fill color
- `color` - Text color
- `font-weight: bold` - Bold text
- `font-size` - Font size
- `text-align` - Horizontal alignment (left, center, right)
- `border` - Table and cell borders

**Supported HTML attributes:**
- `colspan` - Merge cells horizontally
- `rowspan` - Merge cells vertically

**Example:**
```html
<table style="width: 100%; border-collapse: collapse;">
  <tr>
    <th style="background: var(--brand-primary); color: var(--brand-text-inverse); padding: 8pt;">Metric</th>
    <th style="background: var(--brand-primary); color: var(--brand-text-inverse); padding: 8pt;">Value</th>
  </tr>
  <tr>
    <td style="border-bottom: 1px solid var(--brand-gray-medium); padding: 8pt;">Revenue</td>
    <td style="border-bottom: 1px solid var(--brand-gray-medium); padding: 8pt;">$1.2M</td>
  </tr>
  <tr style="background: var(--brand-bg-secondary);">
    <td style="padding: 8pt;">Growth</td>
    <td style="padding: 8pt; font-weight: bold; color: var(--brand-positive);">+15%</td>
  </tr>
</table>
```

**Notes:**
- Row-level backgrounds (`<tr style="background: ...">`) inherit to cells
- Nested tables are not supported
- Tables are positioned based on their location in the HTML layout

### Icons & Gradients

- **CRITICAL: Never use CSS gradients (`linear-gradient`, `radial-gradient`)** - They don't convert to PowerPoint
- **ALWAYS create gradient/icon PNGs FIRST using Sharp, then reference in HTML**
- For gradients: Rasterize SVG to PNG background images
- For icons: Rasterize react-icons SVG to PNG images
- All visual effects must be pre-rendered as raster images before HTML rendering

**Rasterizing Icons with Sharp:**

```javascript
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const sharp = require('sharp');
const { FaHome } = require('react-icons/fa');

async function rasterizeIconPng(IconComponent, color, size = "256", filename) {
  const svgString = ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color: `#${color}`, size: size })
  );

  // Convert SVG to PNG using Sharp
  await sharp(Buffer.from(svgString))
    .png()
    .toFile(filename);

  return filename;
}

// Usage: Rasterize icon before using in HTML
const iconPath = await rasterizeIconPng(FaHome, "4472c4", "256", "home-icon.png");
// Then reference in HTML: <img src="home-icon.png" style="width: 40pt; height: 40pt;">
```

**Rasterizing Gradients with Sharp:**

```javascript
const sharp = require('sharp');

async function createGradientBackground(filename) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="562.5">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#COLOR1"/>
        <stop offset="100%" style="stop-color:#COLOR2"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
  </svg>`;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(filename);

  return filename;
}

// Usage: Create gradient background before HTML
const bgPath = await createGradientBackground("gradient-bg.png");
// Then in HTML: <body style="background-image: url('gradient-bg.png');">
```

---

## Lightweight HTML Mode

PPTX v2 automatically injects brand styling, eliminating the need for repetitive CSS definitions in each slide.

### Before (v1) - Heavy CSS Required

Every slide needed 50+ lines of CSS variables and class definitions:

```html
<style>
:root {
  --mck-navy: #1E3A5F;
  --mck-blue-dark: #2E75B6;
  /* ... 15+ more variables */
}
html { background: #ffffff; }
body {
  width: 720pt; height: 405pt; margin: 0;
  background: var(--mck-gray-light);
  font-family: Arial, sans-serif;
  display: flex; flex-direction: column;
}
.title-zone { min-height: 40pt; padding: 12pt 6pt 8pt 6pt; display: flex; /* ... */ }
.section-id { font-size: 10px; color: var(--mck-navy); margin: 0 0 4pt 0; }
.action-title { font-size: 20px; font-weight: bold; color: var(--mck-navy); margin: 0; }
/* ... 25+ more class definitions */
</style>
```

### After (v2) - Minimal HTML

Just use the semantic classes—styling is injected at runtime:

```html
<!DOCTYPE html>
<html>
<head><title>Q4 Results</title></head>
<body class="brand-slide">
  <div class="title-zone">
    <p class="section-id">1.0</p>
    <h1 class="slide-title">Revenue grew 18% driven by enterprise segment</h1>
  </div>
  <div class="content-zone">
    <div class="panel" style="padding: 16pt;">
      <p style="font-size: 32px; color: var(--brand-primary);">$4.2B</p>
      <p class="text-positive">↑ 18% YoY</p>
    </div>
  </div>
  <div class="footer-zone">
    <p class="source">Source: Q4 Financial Report</p>
  </div>
</body>
</html>
```

### What Gets Injected

When `html2pptx.mjs` processes your HTML, it automatically injects:

**1. CSS Variables (~25 variables):**

All `--brand-*` variables are populated from the active brand config (see `branding/README.md`):

```css
:root {
  /* Brand colors (primary through quinary) */
  --brand-primary: ...;
  --brand-secondary: ...;
  --brand-tertiary: ...;
  --brand-quaternary: ...;
  --brand-quinary: ...;
  --brand-accent: ...;

  /* Semantic colors */
  --brand-positive: ...;
  --brand-negative: ...;
  --brand-warning: ...;
  --brand-neutral: ...;

  /* Gray palette */
  --brand-gray-dark: ...;
  --brand-gray-medium: ...;
  --brand-gray-light: ...;
  --brand-gray-silver: ...;
  --brand-gray-border: ...;

  /* Text colors */
  --brand-text: ...;
  --brand-text-primary: ...;
  --brand-text-secondary: ...;
  --brand-text-inverse: ...;

  /* Background colors */
  --brand-bg-primary: ...;
  --brand-bg-secondary: ...;
  --brand-bg-dark: ...;

  /* Typography */
  --brand-font-data: ...;
  --brand-font-body: ...;
  --brand-font-heading: ...;

  /* Dimensions */
  --slide-width: 720pt;
  --slide-height: 405pt;
}
```

**2. Optional Helper Classes:**
```css
/* Base slide setup */
.brand-slide {
  width: var(--slide-width);
  height: var(--slide-height);
  margin: 0; padding: 0;
  background: var(--brand-gray-light);
  font-family: var(--brand-font-data);
  position: relative;
  display: flex; flex-direction: column;
  box-sizing: border-box;
}

/* Three-zone layout */
.title-zone { min-height: 40pt; padding: 12pt 6pt 8pt 6pt; display: flex; flex-direction: column; justify-content: center; flex-shrink: 0; }
.content-zone { flex: 1; padding: 0 6pt; display: flex; flex-direction: column; min-height: 0; }
.footer-zone { height: 30pt; padding: 0 6pt; display: flex; align-items: center; justify-content: space-between; }

/* Text styling */
.slide-title { color: var(--brand-primary); font-size: 20px; font-weight: bold; font-family: var(--brand-font-heading); margin: 0; }
.slide-subtitle { color: var(--brand-gray-dark); font-size: 11px; margin: 4pt 0 0 0; }
.section-id { color: var(--brand-primary); font-size: 10px; margin: 0 0 4pt 0; }
.source { color: var(--brand-gray-dark); font-size: 9px; margin: 0; }
.page-num { color: var(--brand-gray-dark); font-size: 9px; margin: 0; }

/* Container */
.panel { background: var(--brand-bg-primary); border: 1px solid var(--brand-gray-border); box-sizing: border-box; }

/* Semantic text colors */
.text-positive { color: var(--brand-positive); }
.text-negative { color: var(--brand-negative); }
.text-warning { color: var(--brand-warning); }
.text-accent { color: var(--brand-accent); }
.text-primary { color: var(--brand-primary); }
.text-secondary { color: var(--brand-text-secondary); }
.text-inverse { color: var(--brand-text-inverse); }

/* Background variants */
.bg-primary { background: var(--brand-primary); }
.bg-secondary { background: var(--brand-secondary); }
.bg-light { background: var(--brand-gray-light); }
.bg-white { background: var(--brand-bg-primary); }
.bg-dark { background: var(--brand-bg-dark); }
```

### Flexibility Preserved

**What IS injected (colors/fonts):**
- CSS variables for brand colors, typography, dimensions
- Optional utility classes for common patterns

**What is NOT injected (layouts):**
- Fixed positioning (left: 20pt, top: 15pt)
- Rigid zone heights as requirements
- Prescriptive grid layouts
- Mandatory component structures

You control all positioning and layout.

### Custom Overrides

Your explicit styles always win due to CSS specificity:

```html
<!-- Brand primary is set by config but you can override -->
<div style="background: #FF0000; color: white;">
  <p>This is red, not the brand primary color</p>
</div>
```

### Mixing Modes

Use helper classes where convenient, custom CSS where needed:

```html
<body class="brand-slide">
  <!-- Uses helper class for title zone -->
  <div class="title-zone">
    <h1 class="slide-title">Standard Title</h1>
  </div>

  <!-- Custom layout in content zone -->
  <div style="position: absolute; left: 50pt; top: 80pt; width: 300pt;">
    <p style="font-size: 24px; color: var(--brand-accent);">Custom positioned content</p>
  </div>
</body>
```

---

### Example (Lightweight Mode)

```html
<!DOCTYPE html>
<html>
<head><title>Example Slide</title></head>
<body class="brand-slide">
  <div class="title-zone">
    <h1 class="slide-title">Recipe Title</h1>
  </div>
  <div class="content-zone">
    <div class="panel" style="padding: 16pt; flex: 1;">
      <ul>
        <li><b>Item:</b> Description</li>
      </ul>
      <p>Text with <b>bold</b>, <i>italic</i>, <u>underline</u>.</p>
      <div id="chart" class="placeholder" style="width: 350pt; height: 200pt;"></div>

      <!-- Text MUST be in <p> tags -->
      <div style="background: var(--brand-secondary); padding: 20pt;
        border-radius: 12pt; box-shadow: 3px 3px 10px rgba(0, 0, 0, 0.25);">
        <p style="color: var(--brand-text-inverse);">5</p>
      </div>
    </div>
  </div>
  <div class="footer-zone">
    <p class="source">Source: Example data</p>
  </div>
</body>
</html>
```

## Using the html2pptx Library

### Dependencies

These libraries have been globally installed and are available to use:
- `pptxgenjs`
- `playwright`
- `sharp`
- `echarts` (must be **6.x** for axis breaks — the renderer enforces this and exits with a fatal error if < 6.x. Verify: `node -e "import('echarts').then(e => console.log(e.version))"`, upgrade: `npm install echarts@latest`)

### Import Syntax

**IMPORTANT:** The html2pptx library uses a DEFAULT export, not named exports.

```javascript
// ✅ CORRECT - From workspace/ directory (where generation scripts are created)
import pptxgen from 'pptxgenjs';
import html2pptx from '../scripts/html2pptx.mjs';

// ✅ CORRECT - From skill root directory
import html2pptx from './scripts/html2pptx.mjs';

// ❌ WRONG - Named import (will fail with "does not provide an export named 'html2pptx'")
import { html2pptx } from './scripts/html2pptx.mjs';
```

**Note:** The `render_echarts.mjs` script is a CLI tool only - it cannot be imported as a module. Use the `data-echarts` HTML attribute instead, which html2pptx processes automatically.

### Basic Usage

```javascript
// ES Modules (recommended for .mjs files)
// Use ../scripts/ from workspace/, or ./scripts/ from skill root
import pptxgen from 'pptxgenjs';
import html2pptx from '../scripts/html2pptx.mjs';  // from workspace/

// Note: old CJS .js files were removed in v4.9.1. Use ESM .mjs imports only.

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_16x9';  // Must match HTML body dimensions

const { slide, placeholders } = await html2pptx('slide1.html', pptx);

// Add chart to placeholder area
if (placeholders.length > 0) {
    slide.addChart(pptx.charts.LINE, chartData, placeholders[0]);
}

await pptx.writeFile('output.pptx');
```

### API Reference

#### Function Signature
```javascript
await html2pptx(htmlFile, pres, options)
```

#### Parameters
- `htmlFile` (string): Path to HTML file (absolute or relative)
- `pres` (pptxgen): PptxGenJS presentation instance with layout already set
- `options` (object, optional):
  - `tmpDir` (string): Temporary directory for generated files (default: `process.env.TMPDIR || '/tmp'`)
  - `slide` (object): Existing slide to reuse (default: creates new slide)

#### Returns
```javascript
{
    slide: pptxgenSlide,           // The created/updated slide
    placeholders: [                 // Array of placeholder positions
        { id: string, x: number, y: number, w: number, h: number },
        ...
    ]
}
```

### Validation

The library automatically validates and collects all errors before throwing:

1. **HTML dimensions must match presentation layout** - Reports dimension mismatches
2. **Content-zone overflow is a BLOCKING ERROR** - Reports overflow with exact measurements (3pt tolerance for rendering differences). Body-level height overflow is informational only.
3. **CSS gradients** - Reports unsupported gradient usage
4. **Text element styling** - Reports backgrounds/borders/shadows on text elements (only allowed on divs)

**All validation errors are collected and reported together** in a single error message, allowing you to fix all issues at once instead of one at a time.

### Working with Placeholders

```javascript
const { slide, placeholders } = await html2pptx('slide.html', pptx);

// Use first placeholder
slide.addChart(pptx.charts.BAR, data, placeholders[0]);

// Find by ID
const chartArea = placeholders.find(p => p.id === 'chart-area');
slide.addChart(pptx.charts.LINE, data, chartArea);
```

### Complete Example

```javascript
const pptxgen = require('pptxgenjs');
const html2pptx = require('./html2pptx');

async function createPresentation() {
    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'Your Name';
    pptx.title = 'My Presentation';

    // Slide 1: Title
    const { slide: slide1 } = await html2pptx('slides/title.html', pptx);

    // Slide 2: Content with chart
    const { slide: slide2, placeholders } = await html2pptx('slides/data.html', pptx);

    const chartData = [{
        name: 'Sales',
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        values: [4500, 5500, 6200, 7100]
    }];

    slide2.addChart(pptx.charts.BAR, chartData, {
        ...placeholders[0],
        showTitle: true,
        title: 'Quarterly Sales',
        showCatAxisTitle: true,
        catAxisTitle: 'Quarter',
        showValAxisTitle: true,
        valAxisTitle: 'Sales ($000s)'
    });

    // Save
    await pptx.writeFile({ fileName: 'presentation.pptx' });
    console.log('Presentation created successfully!');
}

createPresentation().catch(console.error);
```

## Using PptxGenJS

After converting HTML to slides with `html2pptx`, you'll use PptxGenJS to add dynamic content like charts, images, and additional elements.

### ⚠️ Critical Rules

#### Colors
- **NEVER use `#` prefix** with hex colors in PptxGenJS - causes file corruption
- ✅ Correct: `color: "FF0000"`, `fill: { color: "0066CC" }`
- ❌ Wrong: `color: "#FF0000"` (breaks document)

### Adding Images

Always calculate aspect ratios from actual image dimensions:

```javascript
// Get image dimensions: identify image.png | grep -o '[0-9]* x [0-9]*'
const imgWidth = 1860, imgHeight = 1519;  // From actual file
const aspectRatio = imgWidth / imgHeight;

const h = 3;  // Max height
const w = h * aspectRatio;
const x = (10 - w) / 2;  // Center on 16:9 slide

slide.addImage({ path: "chart.png", x, y: 1.5, w, h });
```

### Adding Text

```javascript
// Rich text with formatting
slide.addText([
    { text: "Bold ", options: { bold: true } },
    { text: "Italic ", options: { italic: true } },
    { text: "Normal" }
], {
    x: 1, y: 2, w: 8, h: 1
});
```

### Adding Shapes

```javascript
// Rectangle
slide.addShape(pptx.shapes.RECTANGLE, {
    x: 1, y: 1, w: 3, h: 2,
    fill: { color: "4472C4" },
    line: { color: "000000", width: 2 }
});

// Circle
slide.addShape(pptx.shapes.OVAL, {
    x: 5, y: 1, w: 2, h: 2,
    fill: { color: "ED7D31" }
});

// Rounded rectangle
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 1, y: 4, w: 3, h: 1.5,
    fill: { color: "70AD47" },
    rectRadius: 0.2
});
```

### Adding Charts

**Required for most charts:** Axis labels using `catAxisTitle` (category) and `valAxisTitle` (value).

**Chart Data Format:**
- Use **single series with all labels** for simple bar/line charts
- Each series creates a separate legend entry
- Labels array defines X-axis values

**Time Series Data - Choose Correct Granularity:**
- **< 30 days**: Use daily grouping (e.g., "10-01", "10-02") - avoid monthly aggregation that creates single-point charts
- **30-365 days**: Use monthly grouping (e.g., "2024-01", "2024-02")
- **> 365 days**: Use yearly grouping (e.g., "2023", "2024")
- **Validate**: Charts with only 1 data point likely indicate incorrect aggregation for the time period

```javascript
const { slide, placeholders } = await html2pptx('slide.html', pptx);

// CORRECT: Single series with all labels
slide.addChart(pptx.charts.BAR, [{
    name: "Sales 2024",
    labels: ["Q1", "Q2", "Q3", "Q4"],
    values: [4500, 5500, 6200, 7100]
}], {
    ...placeholders[0],  // Use placeholder position
    barDir: 'col',       // 'col' = vertical bars, 'bar' = horizontal
    showTitle: true,
    title: 'Quarterly Sales',
    showLegend: false,   // No legend needed for single series
    // Required axis labels
    showCatAxisTitle: true,
    catAxisTitle: 'Quarter',
    showValAxisTitle: true,
    valAxisTitle: 'Sales ($000s)',
    // Optional: Control scaling (adjust min based on data range for better visualization)
    valAxisMaxVal: 8000,
    valAxisMinVal: 0,  // Use 0 for counts/amounts; for clustered data (e.g., 4500-7100), consider starting closer to min value
    valAxisMajorUnit: 2000,  // Control y-axis label spacing to prevent crowding
    catAxisLabelRotate: 45,  // Rotate labels if crowded
    dataLabelPosition: 'outEnd',
    dataLabelColor: '000000',
    // Use single color for single-series charts
    chartColors: ["4472C4"]  // All bars same color
});
```

#### Scatter Chart

**IMPORTANT**: Scatter chart data format is unusual - first series contains X-axis values, subsequent series contain Y-values:

```javascript
// Prepare data
const data1 = [{ x: 10, y: 20 }, { x: 15, y: 25 }, { x: 20, y: 30 }];
const data2 = [{ x: 12, y: 18 }, { x: 18, y: 22 }];

const allXValues = [...data1.map(d => d.x), ...data2.map(d => d.x)];

slide.addChart(pptx.charts.SCATTER, [
    { name: 'X-Axis', values: allXValues },  // First series = X values
    { name: 'Series 1', values: data1.map(d => d.y) },  // Y values only
    { name: 'Series 2', values: data2.map(d => d.y) }   // Y values only
], {
    x: 1, y: 1, w: 8, h: 4,
    lineSize: 0,  // 0 = no connecting lines
    lineDataSymbol: 'circle',
    lineDataSymbolSize: 6,
    showCatAxisTitle: true,
    catAxisTitle: 'X Axis',
    showValAxisTitle: true,
    valAxisTitle: 'Y Axis',
    chartColors: ["4472C4", "ED7D31"]
});
```

#### Line Chart

```javascript
slide.addChart(pptx.charts.LINE, [{
    name: "Temperature",
    labels: ["Jan", "Feb", "Mar", "Apr"],
    values: [32, 35, 42, 55]
}], {
    x: 1, y: 1, w: 8, h: 4,
    lineSize: 4,
    lineSmooth: true,
    // Required axis labels
    showCatAxisTitle: true,
    catAxisTitle: 'Month',
    showValAxisTitle: true,
    valAxisTitle: 'Temperature (°F)',
    // Optional: Y-axis range (set min based on data range for better visualization)
    valAxisMinVal: 0,     // For ranges starting at 0 (counts, percentages, etc.)
    valAxisMaxVal: 60,
    valAxisMajorUnit: 20,  // Control y-axis label spacing to prevent crowding (e.g., 10, 20, 25)
    // valAxisMinVal: 30,  // PREFERRED: For data clustered in a range (e.g., 32-55 or ratings 3-5), start axis closer to min value to show variation
    // Optional: Chart colors
    chartColors: ["4472C4", "ED7D31", "A5A5A5"]
});
```

#### Pie Chart (No Axis Labels Required)

**CRITICAL**: Pie charts require a **single data series** with all categories in the `labels` array and corresponding values in the `values` array.

```javascript
slide.addChart(pptx.charts.PIE, [{
    name: "Market Share",
    labels: ["Product A", "Product B", "Other"],  // All categories in one array
    values: [35, 45, 20]  // All values in one array
}], {
    x: 2, y: 1, w: 6, h: 4,
    showPercent: true,
    showLegend: true,
    legendPos: 'r',  // right
    chartColors: ["4472C4", "ED7D31", "A5A5A5"]
});
```

#### Multiple Data Series

```javascript
slide.addChart(pptx.charts.LINE, [
    {
        name: "Product A",
        labels: ["Q1", "Q2", "Q3", "Q4"],
        values: [10, 20, 30, 40]
    },
    {
        name: "Product B",
        labels: ["Q1", "Q2", "Q3", "Q4"],
        values: [15, 25, 20, 35]
    }
], {
    x: 1, y: 1, w: 8, h: 4,
    showCatAxisTitle: true,
    catAxisTitle: 'Quarter',
    showValAxisTitle: true,
    valAxisTitle: 'Revenue ($M)'
});
```

### Chart Colors

**CRITICAL**: Use hex colors **without** the `#` prefix - including `#` causes file corruption.

**Align chart colors with your chosen design palette**, ensuring sufficient contrast and distinctiveness for data visualization. Adjust colors for:
- Strong contrast between adjacent series
- Readability against slide backgrounds
- Accessibility (avoid red-green only combinations)

```javascript
// Example: Ocean palette-inspired chart colors (adjusted for contrast)
const chartColors = ["16A085", "FF6B9D", "2C3E50", "F39C12", "9B59B6"];

// Single-series chart: Use one color for all bars/points
slide.addChart(pptx.charts.BAR, [{
    name: "Sales",
    labels: ["Q1", "Q2", "Q3", "Q4"],
    values: [4500, 5500, 6200, 7100]
}], {
    ...placeholders[0],
    chartColors: ["16A085"],  // All bars same color
    showLegend: false
});

// Multi-series chart: Each series gets a different color
slide.addChart(pptx.charts.LINE, [
    { name: "Product A", labels: ["Q1", "Q2", "Q3"], values: [10, 20, 30] },
    { name: "Product B", labels: ["Q1", "Q2", "Q3"], values: [15, 25, 20] }
], {
    ...placeholders[0],
    chartColors: ["16A085", "FF6B9D"]  // One color per series
});
```

### Adding Tables

Tables can be added with basic or advanced formatting:

#### Basic Table

```javascript
slide.addTable([
    ["Header 1", "Header 2", "Header 3"],
    ["Row 1, Col 1", "Row 1, Col 2", "Row 1, Col 3"],
    ["Row 2, Col 1", "Row 2, Col 2", "Row 2, Col 3"]
], {
    x: 0.5,
    y: 1,
    w: 9,
    h: 3,
    border: { pt: 1, color: "999999" },
    fill: { color: "F1F1F1" }
});
```

#### Table with Custom Formatting

```javascript
const tableData = [
    // Header row with custom styling
    [
        { text: "Product", options: { fill: { color: "4472C4" }, color: "FFFFFF", bold: true } },
        { text: "Revenue", options: { fill: { color: "4472C4" }, color: "FFFFFF", bold: true } },
        { text: "Growth", options: { fill: { color: "4472C4" }, color: "FFFFFF", bold: true } }
    ],
    // Data rows
    ["Product A", "$50M", "+15%"],
    ["Product B", "$35M", "+22%"],
    ["Product C", "$28M", "+8%"]
];

slide.addTable(tableData, {
    x: 1,
    y: 1.5,
    w: 8,
    h: 3,
    colW: [3, 2.5, 2.5],  // Column widths
    rowH: [0.5, 0.6, 0.6, 0.6],  // Row heights
    border: { pt: 1, color: "CCCCCC" },
    align: "center",
    valign: "middle",
    fontSize: 14
});
```

#### Table with Merged Cells

```javascript
const mergedTableData = [
    [
        { text: "Q1 Results", options: { colspan: 3, fill: { color: "4472C4" }, color: "FFFFFF", bold: true } }
    ],
    ["Product", "Sales", "Market Share"],
    ["Product A", "$25M", "35%"],
    ["Product B", "$18M", "25%"]
];

slide.addTable(mergedTableData, {
    x: 1,
    y: 1,
    w: 8,
    h: 2.5,
    colW: [3, 2.5, 2.5],
    border: { pt: 1, color: "DDDDDD" }
});
```

### Table Options

Common table options:
- `x, y, w, h` - Position and size
- `colW` - Array of column widths (in inches)
- `rowH` - Array of row heights (in inches)
- `border` - Border style: `{ pt: 1, color: "999999" }`
- `fill` - Background color (no # prefix)
- `align` - Text alignment: "left", "center", "right"
- `valign` - Vertical alignment: "top", "middle", "bottom"
- `fontSize` - Text size
- `autoPage` - Auto-create new slides if content overflows

---

## Slide Templates (Brand-Agnostic)

Ready-to-use HTML templates using Lightweight HTML Mode. All templates use `class="brand-slide"` for automatic brand styling.

### Base Slide Template

All slides follow this three-zone structure with brand classes:

```html
<!DOCTYPE html>
<html>
<head><title>Slide Title</title></head>
<body class="brand-slide">
  <div class="title-zone">
    <p class="section-id">Section 1.0</p>
    <h1 class="slide-title">Action-oriented title that states the key insight</h1>
  </div>
  <div class="content-zone">
    <!-- Main content here -->
  </div>
  <div class="footer-zone">
    <p class="source">Source: Analysis</p>
    <p class="page-num">1</p>
  </div>
</body>
</html>
```

No `<style>` block, no `:root` variables, no hex colors needed — everything is auto-injected.

### Layout Selection (Decide BEFORE Writing HTML)

Before writing any HTML, determine the correct layout pattern. You MUST read the matching example file from `examples/` — do not write HTML from scratch. **This is the first decision to make — not the chart type.**

| User Request Contains... | Use This Layout | Example Directory |
|--------------------------|----------------|-------------------|
| Chart + insights/takeaways/bullets | **Chart + Takeaway Box (65:35)** | `examples/data-ranking/bar-with-callouts.html` |
| Chart + data table/breakdown | Chart + Table (60:40) | `examples/data-breakdown/stacked-bar-chart.html` |
| Chart only (no text) | Full-width chart (100%) | `examples/data-breakdown/waterfall-standalone.html` |
| Multiple KPIs/metrics | Dashboard grid | `examples/data-performance/kpi-dashboard.html` |
| Process/steps/methodology | Chevron flow | `examples/flow-step-by-step/chevron-steps.html` |
| Before -> After comparison | Two panels + connector | `examples/compare-side-by-side/before-after.html` |
| 2x2 strategic matrix | Quadrant matrix | `examples/explain-matrix/2x2-matrix.html` |
| Qualitative insights only | Structured bullets / pillars | `examples/narrative-text-insight/bullets-standard.html` |

📖 **Full template index**: See [`slide-selection-guide.md`](slide-selection-guide.md) for all 122 templates organized by the McKinsey slide taxonomy.

**Default rule:** If unsure, use **Chart + Takeaway Box (65:35)**. It works for 80% of consulting slides.

**Implementation pattern for 65:35 layout:**
```html
<div class="content-zone">
  <div style="display: flex; gap: 16pt; width: 100%; align-items: stretch;">
    <div class="panel" style="flex: 65; padding: 16pt;">
      <!-- Chart with data-echarts at width: 100%; height: 260pt -->
    </div>
    <div class="panel" style="flex: 35; padding: 16pt; background: var(--brand-gray-light);">
      <!-- Key Insights heading + bullet list -->
    </div>
  </div>
</div>
```

📖 **Layout examples**: See `examples/` for 122 ready-to-use templates. Consult [`slide-selection-guide.md`](slide-selection-guide.md) to pick the right template.

---

### STOP — Read an Example Before Writing HTML

The inline templates below are **simplified reference snippets only**. They lack proper spacing, edge-case handling, and the full zone structure that production slides require.

**Before writing ANY HTML, you MUST:**
1. Open and read [`slide-selection-guide.md`](slide-selection-guide.md)
2. Match your content to a slide category (DATA, NARRATIVE, COMPARE, STRUCTURE, EXPLAIN, FLOW)
3. Find the specific template file in `examples/[category]/[filename].html`
4. Read that example file completely
5. **Adapt the example** — copy it and modify the content

The `examples/` folder contains 122 production-ready templates. The inline snippets below are for quick reference only — never use them as your starting point.

---

### Chart Templates (Full-Width)

The templates below are for **full-width single-chart** slides (Pattern 1). For chart + text combinations, use the layout patterns above.

### Vertical Bar Chart (ECharts)

```html
<div class="content-zone">
  <div class="panel" style="flex: 1; padding: 16pt;">
    <p style="font-size: 14px; font-weight: bold; color: var(--brand-primary); margin: 0 0 12pt 0;">Revenue by Quarter ($M)</p>
    <div data-echarts='{"xAxis":{"type":"category","data":["Q1","Q2","Q3","Q4"]},"yAxis":{"type":"value"},"series":[{"type":"bar","data":[32,28,35,42]}]}' style="width: 100%; height: 260pt;"></div>
  </div>
</div>
```

### Horizontal Bar Chart (ECharts)

```html
<div class="content-zone">
  <div class="panel" style="flex: 1; padding: 16pt;">
    <p style="font-size: 14px; font-weight: bold; color: var(--brand-primary); margin: 0 0 16pt 0;">Market Share by Segment</p>
    <div data-echarts='{"yAxis":{"type":"category","data":["Consumer","SMB","Mid-Market","Enterprise"]},"xAxis":{"type":"value"},"series":[{"type":"bar","data":[18,32,48,65]}]}' style="width: 100%; height: 260pt;"></div>
  </div>
</div>
```

### Waterfall Chart (ECharts)

```html
<div class="content-zone">
  <div class="panel" style="flex: 1; padding: 16pt;">
    <p style="font-size: 14px; font-weight: bold; color: var(--brand-primary); margin: 0 0 12pt 0;">Revenue Bridge FY23→FY24 ($M)</p>
    <div data-echarts='{"xAxis":{"type":"category","data":["FY23","New Sales","Churn","FY24"]},"yAxis":{"type":"value"},"series":[{"type":"bar","stack":"total","itemStyle":{"color":"transparent"},"data":[0,100,125,0]},{"type":"bar","stack":"total","data":[{"value":100},{"value":25,"itemStyle":{"color":"var(--brand-positive)"}},{"value":-10,"itemStyle":{"color":"var(--brand-negative)"}},{"value":115}]}]}' style="width: 100%; height: 260pt;"></div>
  </div>
</div>
```

> **Note**: For waterfall charts, explicit colors are needed for positive/negative segments. Use `var(--brand-positive)` and `var(--brand-negative)`. The ECharts renderer will resolve these from the brand config.

### KPI Dashboard

```html
<div class="content-zone">
  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12pt; width: 100%;">
    <div class="panel" style="padding: 16pt;">
      <p style="font-size: 10px; color: var(--brand-gray-dark); margin: 0 0 8pt 0;">REVENUE</p>
      <p style="font-size: 28px; font-weight: bold; color: var(--brand-primary); margin: 0;">$4.2B</p>
      <p class="text-positive" style="font-size: 11px; margin: 8pt 0 0 0;">▲ 12% YoY</p>
    </div>
    <div class="panel" style="padding: 16pt;">
      <p style="font-size: 10px; color: var(--brand-gray-dark); margin: 0 0 8pt 0;">EBITDA MARGIN</p>
      <p style="font-size: 28px; font-weight: bold; color: var(--brand-primary); margin: 0;">24.5%</p>
      <p class="text-positive" style="font-size: 11px; margin: 8pt 0 0 0;">▲ 2.3pp</p>
    </div>
    <div class="panel" style="padding: 16pt;">
      <p style="font-size: 10px; color: var(--brand-gray-dark); margin: 0 0 8pt 0;">CUSTOMERS</p>
      <p style="font-size: 28px; font-weight: bold; color: var(--brand-primary); margin: 0;">2,847</p>
      <p class="text-negative" style="font-size: 11px; margin: 8pt 0 0 0;">▼ 3% QoQ</p>
    </div>
    <div class="panel" style="padding: 16pt;">
      <p style="font-size: 10px; color: var(--brand-gray-dark); margin: 0 0 8pt 0;">NPS SCORE</p>
      <p style="font-size: 28px; font-weight: bold; color: var(--brand-primary); margin: 0;">72</p>
      <p style="font-size: 11px; color: var(--brand-gray-dark); margin: 8pt 0 0 0;">— Flat</p>
    </div>
  </div>
</div>
```

### Framework Pillars

```html
<div class="content-zone">
  <div style="display: flex; gap: 16pt; width: 100%;">
    <div class="panel" style="flex: 1;">
      <div style="background: var(--brand-primary); padding: 12pt;">
        <p style="font-size: 14px; font-weight: bold; color: var(--brand-text-inverse); margin: 0; text-align: center;">Strategy</p>
      </div>
      <div style="padding: 16pt;">
        <ul style="margin: 0; padding-left: 16pt; font-size: 11px; color: var(--brand-text);">
          <li style="margin-bottom: 8pt;">Market positioning</li>
          <li style="margin-bottom: 8pt;">Growth priorities</li>
          <li style="margin-bottom: 8pt;">Competitive moats</li>
          <li>Portfolio optimization</li>
        </ul>
      </div>
    </div>
    <div class="panel" style="flex: 1;">
      <div style="background: var(--brand-secondary); padding: 12pt;">
        <p style="font-size: 14px; font-weight: bold; color: var(--brand-text-inverse); margin: 0; text-align: center;">Operations</p>
      </div>
      <div style="padding: 16pt;">
        <ul style="margin: 0; padding-left: 16pt; font-size: 11px; color: var(--brand-text);">
          <li style="margin-bottom: 8pt;">Process excellence</li>
          <li style="margin-bottom: 8pt;">Cost optimization</li>
          <li style="margin-bottom: 8pt;">Quality management</li>
          <li>Supply chain</li>
        </ul>
      </div>
    </div>
    <div class="panel" style="flex: 1;">
      <div style="background: var(--brand-tertiary); padding: 12pt;">
        <p style="font-size: 14px; font-weight: bold; color: var(--brand-text-inverse); margin: 0; text-align: center;">Technology</p>
      </div>
      <div style="padding: 16pt;">
        <ul style="margin: 0; padding-left: 16pt; font-size: 11px; color: var(--brand-text);">
          <li style="margin-bottom: 8pt;">Digital transformation</li>
          <li style="margin-bottom: 8pt;">Data & analytics</li>
          <li style="margin-bottom: 8pt;">Automation</li>
          <li>Cloud infrastructure</li>
        </ul>
      </div>
    </div>
    <div class="panel" style="flex: 1;">
      <div style="background: var(--brand-accent); padding: 12pt;">
        <p style="font-size: 14px; font-weight: bold; color: var(--brand-text-inverse); margin: 0; text-align: center;">Organization</p>
      </div>
      <div style="padding: 16pt;">
        <ul style="margin: 0; padding-left: 16pt; font-size: 11px; color: var(--brand-text);">
          <li style="margin-bottom: 8pt;">Talent strategy</li>
          <li style="margin-bottom: 8pt;">Culture & values</li>
          <li style="margin-bottom: 8pt;">Governance</li>
          <li>Change management</li>
        </ul>
      </div>
    </div>
  </div>
</div>
```

### Chevron Process

> **PIPELINE LIMITATION**: `clip-path: polygon()` is NOT preserved in PPTX output.
> Chevrons rendered via clip-path will appear as plain rectangles.
> Use the **SVG polygon overlay technique** instead — see `preflight-checklist.md` (VSD section, Pipeline Implementation subsection).

```html
<div class="content-zone" style="align-items: center;">
  <div style="display: flex; width: 100%;">
    <div style="flex: 1; background: var(--brand-primary); padding: 20pt 30pt 20pt 20pt; color: var(--brand-text-inverse);
                clip-path: polygon(0 0, 90% 0, 100% 50%, 90% 100%, 0 100%);">
      <p style="font-size: 11px; margin: 0 0 4pt 0; opacity: 0.8;">STEP 1</p>
      <p style="font-size: 14px; font-weight: bold; margin: 0;">Diagnose</p>
      <p style="font-size: 10px; margin: 8pt 0 0 0; opacity: 0.9;">Assess current state</p>
    </div>
    <div style="flex: 1; background: var(--brand-secondary); padding: 20pt 30pt 20pt 30pt; color: var(--brand-text-inverse); margin-left: -15pt;
                clip-path: polygon(0 0, 90% 0, 100% 50%, 90% 100%, 0 100%, 10% 50%);">
      <p style="font-size: 11px; margin: 0 0 4pt 0; opacity: 0.8;">STEP 2</p>
      <p style="font-size: 14px; font-weight: bold; margin: 0;">Design</p>
      <p style="font-size: 10px; margin: 8pt 0 0 0; opacity: 0.9;">Define target model</p>
    </div>
    <div style="flex: 1; background: var(--brand-tertiary); padding: 20pt 30pt 20pt 30pt; color: var(--brand-text-inverse); margin-left: -15pt;
                clip-path: polygon(0 0, 90% 0, 100% 50%, 90% 100%, 0 100%, 10% 50%);">
      <p style="font-size: 11px; margin: 0 0 4pt 0; opacity: 0.8;">STEP 3</p>
      <p style="font-size: 14px; font-weight: bold; margin: 0;">Deliver</p>
      <p style="font-size: 10px; margin: 8pt 0 0 0; opacity: 0.9;">Execute transformation</p>
    </div>
    <div style="flex: 1; background: var(--brand-quaternary); padding: 20pt 20pt 20pt 30pt; color: var(--brand-primary); margin-left: -15pt;
                clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 10% 50%);">
      <p style="font-size: 11px; margin: 0 0 4pt 0; opacity: 0.7;">STEP 4</p>
      <p style="font-size: 14px; font-weight: bold; margin: 0;">Sustain</p>
      <p style="font-size: 10px; margin: 8pt 0 0 0; opacity: 0.8;">Embed capabilities</p>
    </div>
  </div>
</div>
```

### 2x2 Matrix

```html
<div class="content-zone">
  <div class="panel" style="flex: 1; padding: 16pt;">
    <p style="font-size: 14px; font-weight: bold; color: var(--brand-primary); margin: 0 0 16pt 0;">Strategic Priority Matrix</p>
    <div style="display: flex; height: 220pt;">
      <div style="width: 30pt; display: flex; align-items: center; justify-content: center;">
        <p style="font-size: 11px; color: var(--brand-gray-dark); margin: 0; transform: rotate(-90deg); white-space: nowrap;">Impact →</p>
      </div>
      <div style="flex: 1; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 2pt;">
        <div style="background: var(--brand-bg-secondary); padding: 12pt; display: flex; flex-direction: column; justify-content: center; align-items: center;">
          <p style="font-size: 12px; font-weight: bold; color: var(--brand-positive); margin: 0;">Quick Wins</p>
          <p style="font-size: 10px; color: var(--brand-gray-dark); margin: 4pt 0 0 0;">High impact, low effort</p>
        </div>
        <div style="background: var(--brand-bg-secondary); padding: 12pt; display: flex; flex-direction: column; justify-content: center; align-items: center;">
          <p style="font-size: 12px; font-weight: bold; color: var(--brand-secondary); margin: 0;">Major Projects</p>
          <p style="font-size: 10px; color: var(--brand-gray-dark); margin: 4pt 0 0 0;">High impact, high effort</p>
        </div>
        <div style="background: var(--brand-bg-secondary); padding: 12pt; display: flex; flex-direction: column; justify-content: center; align-items: center;">
          <p style="font-size: 12px; font-weight: bold; color: var(--brand-accent); margin: 0;">Fill-ins</p>
          <p style="font-size: 10px; color: var(--brand-gray-dark); margin: 4pt 0 0 0;">Low impact, low effort</p>
        </div>
        <div style="background: var(--brand-bg-secondary); padding: 12pt; display: flex; flex-direction: column; justify-content: center; align-items: center;">
          <p style="font-size: 12px; font-weight: bold; color: var(--brand-negative); margin: 0;">Avoid</p>
          <p style="font-size: 10px; color: var(--brand-gray-dark); margin: 4pt 0 0 0;">Low impact, high effort</p>
        </div>
      </div>
    </div>
    <p style="font-size: 11px; color: var(--brand-gray-dark); margin: 8pt 0 0 30pt; text-align: center;">Effort →</p>
  </div>
</div>
```

### Container with Triangle Connector

```html
<div class="content-zone">
  <div class="panel" style="flex: 2;">
    <div style="background: var(--brand-tertiary); padding: 10pt;">
      <p style="font-size: 12px; font-weight: bold; color: var(--brand-text-inverse); margin: 0;">Current State</p>
    </div>
    <div style="padding: 16pt;">
      <ul style="margin: 0; padding-left: 16pt; font-size: 11px; color: var(--brand-text);">
        <li style="margin-bottom: 6pt;">Manual processes</li>
        <li style="margin-bottom: 6pt;">Siloed data</li>
        <li>Legacy systems</li>
      </ul>
    </div>
  </div>
  <div style="display: flex; align-items: center; padding: 0 8pt;">
    <div style="width: 0; height: 0; border-left: 25pt solid var(--brand-primary);
                border-top: 20pt solid transparent; border-bottom: 20pt solid transparent;"></div>
  </div>
  <div class="panel" style="flex: 2;">
    <div style="background: var(--brand-primary); padding: 10pt;">
      <p style="font-size: 12px; font-weight: bold; color: var(--brand-text-inverse); margin: 0;">Target State</p>
    </div>
    <div style="padding: 16pt;">
      <ul style="margin: 0; padding-left: 16pt; font-size: 11px; color: var(--brand-text);">
        <li style="margin-bottom: 6pt;">Automated workflows</li>
        <li style="margin-bottom: 6pt;">Integrated platform</li>
        <li>Cloud-native architecture</li>
      </ul>
    </div>
  </div>
</div>
```

### Using ECharts for Data Visualization (REQUIRED for All Charts)

**MANDATORY**: Use `data-echarts` for ALL charts. The attribute triggers server-side rendering with automatic brand styling:

```html
<div class="content-zone">
  <div data-echarts='{
    "xAxis": {"type": "category", "data": ["Q1", "Q2", "Q3", "Q4"]},
    "yAxis": {"type": "value"},
    "series": [{"type": "bar", "data": [32, 28, 35, 42]}]
  }' style="flex: 1; height: 250pt; background: white;"></div>
</div>
```

The ECharts renderer (`render_echarts.mjs`) automatically applies:
- No gridlines (clean aesthetic)
- Labels above bars
- Brand color baseline
- Brand color palette (from active brand config)
- Professional typography

**CRITICAL — CSS variables do NOT work in `data-echarts` JSON:**

```html
<!-- WRONG — renders as black box (CSS variables not resolved in Node.js SSR) -->
<div data-echarts='{"series":[{"type":"bar","itemStyle":{"color":"var(--brand-primary)"},"data":[10,20,30]}]}'></div>

<!-- CORRECT — auto-coloring applies brand palette -->
<div data-echarts='{"series":[{"type":"bar","data":[10,20,30]}]}'></div>

<!-- CORRECT — explicit hex from brand config -->
<div data-echarts='{"series":[{"type":"bar","itemStyle":{"color":"#1E3A5F"},"data":[10,20,30]}]}'></div>
```

ECharts is rendered server-side via Node.js (no DOM). CSS variables are HTML/CSS constructs that do not exist in the ECharts rendering context. The auto-coloring system applies the full brand palette when no explicit colors are set.

📖 **Full reference**: See [`references/mckinsey-style-guide.md`](references/mckinsey-style-guide.md) for complete design specifications including 45+ chart types, DATA TABLE formats, and visual mechanics.

📖 **Examples**: See the `examples/` folder for 122 ready-to-use templates covering all slide types. Consult [`slide-selection-guide.md`](slide-selection-guide.md) for the complete index.

---

### ECharts: How It Works

The `data-echarts` attribute triggers server-side chart rendering:

```
HTML with data-echarts
    ↓ Playwright extracts JSON config + dimensions
    ↓ render_echarts.mjs applies brand styling
    ↓ ECharts SSR mode renders to SVG
    ↓ Sharp converts SVG to PNG (2x resolution)
    ↓ PNG injected back into HTML as <img>
    ↓ PptxGenJS embeds image in slide
```

**Key Limitations:**
- Charts become **static images** (not editable in PowerPoint)
- Config must be **pure JSON** - no JavaScript functions
- Large charts may take several seconds to render

---

### ECharts: Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Chart renders as black box | CSS variable (`var(--brand-*)`) used in ECharts JSON | Remove explicit colors (auto-coloring applies brand palette) or use hex values |
| `SyntaxError: Unexpected token` | JavaScript in JSON | Pre-calculate all values; no functions |
| `ENOENT: .png not found` | Rendering failed silently | Check echarts package installed; validate config |
| `missing "series" property` | Config structure wrong | Add series array: `{"series":[...]}` |
| `missing "type" property` | Series missing type | Every series needs `"type": "bar"` etc. |
| Chart looks wrong | Config structure issue | Test config at echarts.apache.org/examples |

---

### ECharts: JSON-Only Constraint

**CRITICAL**: The `data-echarts` attribute must contain **pure JSON**. JavaScript functions are NOT allowed.

**❌ WRONG - JavaScript function:**
```javascript
"symbolSize": function(data) { return Math.sqrt(data[2]); }
```

**✅ CORRECT - Pre-calculated values:**
```json
{"value": [100, 92288], "symbolSize": 45}
```

For bubble charts, scatter plots, or any chart with dynamic sizing:
1. Calculate sizes in your JavaScript/Python before building the config
2. Include the calculated `symbolSize` directly in each data point

**Example - Bubble Chart with Pre-calculated Sizes:**
```json
{
  "xAxis": {"type": "value", "name": "Market Share %"},
  "yAxis": {"type": "value", "name": "Growth Rate %"},
  "series": [{
    "type": "scatter",
    "data": [
      {"value": [85, 25], "symbolSize": 60, "name": "Product A"},
      {"value": [45, 35], "symbolSize": 40, "name": "Product B"},
      {"value": [25, -5], "symbolSize": 25, "name": "Product C"}
    ],
    "label": {"show": true, "formatter": "{b}", "position": "right"}
  }]
}
```

---

### ECharts: Automatic Brand Styling

The `render_echarts.mjs` script automatically applies professional defaults:

**Visual Defaults:**
- No gridlines (clean aesthetic)
- No axis lines or ticks
- Labels positioned on data (not legends)
- Arial font, 11px size
- Contained grid with smart margins

**Smart Label Positioning:**
| Chart Type | Label Position |
|------------|----------------|
| Vertical bars | Above bars |
| Horizontal bars | Right of bars |
| Stacked bars | Inside (white text) |
| Line/Area | No auto-labels |
| Waterfall | Outside (avoids placeholders) |

**7 Built-in Edge Case Fixes:**
1. Skips labels on series with custom data-item labels
2. Respects pixel-based grid positioning
3. Avoids label collisions on horizontal charts
4. Skips transparent/placeholder series
5. Uses outside labels for waterfall charts
6. Doesn't clutter line charts with labels
7. Only labels top segment of 3+ stacked bars

**Override defaults** by explicitly setting properties in your config.

**Axis range: Do NOT set `min`/`max` on value axes.**
The auto axis-break system detects outlier data and compresses empty space. If you set `yAxis.max: 200000`, the break system will strip it when breaks are detected. To explicitly control breaks, set `yAxis.breaks` directly.

Safe to override on value axes: `axisLabel.fontSize`, `axisLabel.formatter`, `axisLabel.rotate`, `name`, `nameTextStyle`, `splitLine`, `axisTick`, `axisLine`.

---

## Chart Authoring Reference

### Chart Orientation Rules (All Chart Types)

| Chart Family | Default Orientation | Use Horizontal When... |
|-------------|--------------------|-----------------------|
| Bar (simple, grouped, stacked) | Vertical (categories on X) | Labels are long, >8 categories, or ranking/comparison emphasis |
| Waterfall | Vertical (categories on X) | >6 categories or very long labels |
| Diverging bar | Horizontal (categories on Y) | Always horizontal (reads naturally left-to-right) |
| Line / Area | Horizontal time axis | Always — time flows left to right |
| Pie / Donut | N/A | N/A — circular layout |
| Scatter / Bubble | Standard X-Y | Always — Cartesian coordinates |
| Funnel | Vertical (wide at top) | Horizontal only if space demands |
| Heatmap | X = columns, Y = rows | Match data's natural grid orientation |

**"Horizontal bar" means:** `yAxis: { type: "category" }`, `xAxis: { type: "value" }`, bars extend RIGHTWARD. Set `yAxis.inverse: true` for top-to-bottom. Label position: `"right"` or `"inside"` (never `"top"`). "Horizontal" does NOT mean bars grow downward.

### Value Axis Range (IMPORTANT)

**Do NOT set `yAxis.min`, `yAxis.max`, `xAxis.min`, or `xAxis.max` on value axes.** The auto axis-break system manages range automatically. Setting `min`/`max` manually prevents axis breaks. **Exception:** `min`/`max` on category axes or gauge `min`/`max` (series-level) are fine.

### Chart Container Sizing (All Chart Types)

ECharts charts render as PNG at the EXACT dimensions in the `style` attribute. Maximize size for sharpness.

| Layout | Chart Width | Chart Height |
|--------|------------|-------------|
| Full-width (single chart) | `680pt` or `100%` | `260-280pt` |
| Two-column (chart + text) | `380-420pt` | `260pt` |
| Square (1:1 aspect) | `260pt` | `260pt` |

**Rules:** Fill the available container. For flex layouts, use `width: 100%`. Chart height should fill content zone (~315pt minus text). Bigger = sharper (2× resolution).

### Chart Summary Elements (All Chart Types)

Every chart should include appropriate summary or contextual elements:

| Chart Type | Required Summary Element |
|-----------|------------------------|
| **Waterfall** | Total/summary bar as last category (placeholder=0, value=accumulated total) |
| **Stacked bar** | Total label at top of each stack |
| **100% stacked bar** | Percentage labels for each segment |
| **Pie / Donut** | Total value in center (donut) or as subtitle; "Other" segment if >5 slices |
| **Funnel** | Conversion rate labels between stages |
| **Line (multi-series)** | Direct labels at line endpoints (not just legend) |
| **Grouped bar** | No stacking totals needed — label individual bars |
| **Scatter** | Quadrant labels or trend line if pattern exists |
| **Gauge** | Target marker / threshold indicator |
| **Heatmap** | Scale legend showing value range |
| **Treemap** | Parent labels visible; leaf labels if space permits |
| **Table** | Total/summary row at bottom |

**Rule:** If a chart type has a natural "summary" (total, conversion, average), include it.

### ECharts Label Sizing (All Chart Types)

Always set `fontSize` explicitly in ECharts config. Defaults are optimized for web, not presentations.

| Label Type | Minimum | Recommended | ECharts Property |
|-----------|---------|-------------|-----------------|
| Data value labels | 10 | 12 | `series[].label.fontSize` |
| Axis labels | 10 | 11 | `xAxis.axisLabel.fontSize` / `yAxis.axisLabel.fontSize` |
| Axis name/title | 11 | 12 | `xAxis.nameTextStyle.fontSize` |
| Legend text | 10 | 11 | `legend.textStyle.fontSize` |
| Pie/donut/gauge/treemap | 10 | 11-18 | `series[].label.fontSize` / `series[].detail.fontSize` |

**Rule:** Default is typically 12px (≈9pt) — the absolute minimum. Explicitly set all label sizes ≥10.

### Chart Mandatory Requirements (All Charts)

**1. Explicit Chart Title** — Every chart MUST have a `<p>` title above the `data-echarts` div.

**2. Safe Grid Margins (Horizontal Bars)** — Minimum: `"grid": {"left": 100, "right": 60, "top": 30, "bottom": 40, "containLabel": false}`. `containLabel` must always be `false`.

**3. Per-Data-Point Labels with Conditional Positioning** — Bar charts MUST use per-data-point labels:
```javascript
data: values.map(v => ({
  value: v,
  label: { show: true, fontSize: 10,
    position: v > maxValue * 0.5 ? 'insideRight' : 'right',
    color: v > maxValue * 0.5 ? '#fff' : '#333' }
}))
```

**Anti-Patterns (NEVER DO):** `containLabel: true` with explicit positioning. Series-level `label: {show: true}` for bars. Relying on default fontSize. No title/legend.

Full chart requirements with code examples: [`preflight-checklist.md`](preflight-checklist.md).

### Layout Tips & Visual Groups

| Pattern | Groups | Width Ratio | Example |
|---------|--------|-------------|---------|
| Primary + context | 2 | 65:35 or 70:30 | Chart + takeaway box |
| Side-by-side comparison | 2 | 50:50 | Before/After |
| Three-column | 3 | 33:33:33 | Three pillars |
| Dashboard | 4-6 | Grid | KPI cards |

**Rules:**
- **Two-column layout (65:35) is the DEFAULT** for chart + text combinations. Use `display: flex` with `flex: 65` and `flex: 35`.
- **Full-width** is for chart-only or text-only slides
- **NEVER vertically stack** a chart below/above text — causes overflow and poor readability
- Maximum 4 visual groups per slide

### Professional Presentations Quick Reference

- **Slide zones**: Header (0-60pt), Content (60-375pt), Footer (375-405pt)
- **Colors**: Use brand CSS variables — see branding/README.md
- **Typography**: 18-22pt bold titles, 12-14pt data values, 9pt footnotes
- **Spacing**: 4pt base unit (8pt small gaps, 12pt medium, 16pt large, 20pt sections)
- **Charts**: Use `data-echarts` for all charts. 2px baseline, values above bars, no gridlines (auto-applied)

See [`slide-selection-guide.md`](slide-selection-guide.md) for the slide taxonomy (DATA, NARRATIVE, COMPARE, STRUCTURE, EXPLAIN, FLOW).

---

## Post-Generation Validation Workflow (MANDATORY)

After running your generation script, you MUST NOT deliver the file until completing ALL steps:

### Step 1: Review console output
- Check for color replacement warnings ("Replaced non-brand color")
- Check for ECharts rendering errors
- If warnings found: investigate and fix source HTML before proceeding

### Step 2: Generate thumbnails immediately
```bash
python scripts/thumbnail.py output.pptx workspace/thumbnails --cols 4
```
- This is NOT optional — if it fails, fix dependencies and re-run
- Verify the thumbnail image file was created

### Step 3: Systematic per-slide inspection
Read the thumbnail image and check EACH slide for:

| Check | Pass criteria |
|-------|--------------|
| Title readable and fits? | No clipping, ≤ 2 lines, readable at zoom |
| Chart renders correctly? | Data visible, not blank/black, axis labels present |
| Data labels visible? | All numbers readable, no overlapping |
| Colors correct? | Brand palette, sufficient contrast |
| Text not overflowing? | No truncation at edges |
| Footer present? | Source + page number visible |
| Layout balanced? | Adequate whitespace, panels proportional |

### Step 4: Document and fix issues
- State findings per slide: "Slide N: [observations]"
- Fix any issues in HTML source → regenerate PPTX → re-thumbnail → re-inspect
- Repeat until all slides pass

### Step 5: Delivery attestation
Before delivering, state:
> "I have completed visual validation of all [N] slides. Each slide was checked for: title fit, chart rendering, data labels, colors, text overflow, footer presence, and layout balance. Issues found and resolved: [list or 'none']. The presentation is ready for delivery."

**The presentation is INCOMPLETE until all steps are done. The validation loop is mandatory:**

```
GENERATE → THUMBNAIL → INSPECT → [FIX if needed] → REGENERATE → THUMBNAIL → INSPECT → ... → DELIVER
```

---

## Chart Annotations (ECharts)

---

### 1. Annotation Decision Tree

**Consult this FIRST when deciding how to build any annotation.**

```
Need to annotate a chart?
├─ Delta/comparison pill between levels → markLine two-point mode (§3)
├─ Callout box with leader line to data → $callouts on series (§4)
├─ Data label at specific point → markPoint (native ECharts)
├─ Reference line at threshold → markLine single-point (native ECharts)
├─ Highlight region → markArea (native ECharts)
├─ Formatted label with badges → rich text label (§7)
└─ Custom decorative shape (not data) → graphic + percentage positioning (§5)
```

| Annotation Type | Technique | Section | Example |
|----------------|-----------|---------|---------|
| **Delta pill** (% change between levels) | `markLine` two-point mode | §3 | "-40%" pill with arrow between bars |
| **Callout box** (leader line to data) | `$callouts` on series | §4 | Observation box pointing to peak |
| **Data value** (total, %) | `markPoint` / series `label` / invisible top series | — | "42M" above bar |
| **Reference line** | `markLine` single-point | — | Dashed threshold at y=47 |
| **Highlight region** | `markArea` | — | Blue band over bar range |
| **Formatted label** | rich text `label` with `rich` | §7 | Colored badge |
| **Custom decorative shape** | `graphic` + percentage positioning | §5 | Logo, bracket, decorative element |

**KEY RULE (v4.7.1)**: Delta pills and callout boxes use NATIVE ECharts features.
Do NOT use `graphic` groups or HTML overlay divs for these — use markLine two-point (§3) or $callouts (§4).

---

### 2. Callout Box Pattern (LEGACY — use $callouts §4 for new work)

```html
<!-- Container with position:relative to hold chart + text overlay -->
<div style="position: relative;">
  <!-- Chart: box outline + leader line rendered inside ECharts -->
  <div data-echarts='{
    "series": [{ "type": "bar", "data": [120, 200, 150, 80, 70, 110, 130] }],
    "xAxis": { "type": "category", "data": ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"] },
    "yAxis": { "type": "value" },
    "graphic": [{
      "type": "group",
      "left": "62%",
      "top": "10%",
      "children": [
        { "type": "rect",
          "shape": { "width": 130, "height": 55 },
          "style": { "fill": "var(--brand-bg-primary)",
                     "stroke": "var(--brand-secondary)", "lineWidth": 1.5 } },
        { "type": "line",
          "shape": { "x1": 65, "y1": 55, "x2": 65, "y2": 120 },
          "style": { "stroke": "var(--brand-secondary)", "lineWidth": 1 } }
      ]
    }]
  }' style="width: 100%; height: 250pt;"></div>

  <!-- Text overlay: positioned to fill the ECharts-rendered callout box -->
  <div style="position: absolute; top: 10%; left: 62%; width: 130pt; padding: 6pt;">
    <p style="margin: 0; font-size: 9px; color: var(--brand-text);">
      <strong>Revenue declined</strong> significantly due to market contraction
    </p>
  </div>
</div>
```

**Why this works:**
- Leader line is in ECharts coordinates — always connects to the right data point
- Box outline is in ECharts — part of chart image, consistent rendering
- Text is HTML — full formatting (bold, bullets, wrapping)
- In PPTX: chart image shows empty box + line, text element overlays it

**LEADER LINE STYLING** (applied automatically by `render_echarts.mjs`):
- stroke: `var(--brand-gray-dark)` — grey, NOT same as box border
- lineDash: `[4, 3]` — dashed, NOT solid
- lineWidth: 1 — thinner than box border (1.5)

WRONG: same stroke as rect border → line blends into box, confuses with chart data
CORRECT: grey dashed → clearly an annotation connector, not chart data

NOTE: This applies to lines in callout groups (groups with both rect + line).
Lines inside delta pill groups (groups with rect + line + polygon) are structural indicators, not leader lines — they keep brand-secondary styling.

---

### 3. markLine Delta Pill Pattern (v4.7.1 — PREFERRED for delta pills)

Use markLine's two-point syntax for delta pills showing % change between data levels.
The library handles ALL positioning from data coordinates — zero pixel math.

#### Full JSON Example

```json
{
  "series": [{
    "type": "bar",
    "data": [62, 58, 54, 48, 38, 31, 31],
    "markLine": {
      "symbol": ["none", "none"],
      "data": [
        [
          {"xAxis": "2006", "yAxis": 62},
          {"xAxis": "2012", "yAxis": 62}
        ],
        [
          {"xAxis": "2012", "yAxis": 62, "symbol": "none"},
          {"xAxis": "2012", "yAxis": 31, "symbol": "arrow",
            "label": {
              "formatter": "-40%",
              "backgroundColor": "var(--brand-surface-light)",
              "borderRadius": 12,
              "padding": [4, 10],
              "color": "var(--brand-primary)",
              "fontSize": 13,
              "fontWeight": "bold",
              "position": "middle"
            }
          }
        ]
      ],
      "lineStyle": {"color": "var(--brand-primary)", "type": "dashed", "width": 1.5}
    }
  }],
  "xAxis": {"type": "category", "data": ["2006","2007","2008","2009","2010","2011","2012"]},
  "yAxis": {"type": "value"}
}
```

#### How It Works

Two markLine data pairs (each pair is an array of two points):

1. **Horizontal reference line**: `[{xAxis: "2006", yAxis: 62}, {xAxis: "2012", yAxis: 62}]`
   - Draws a dashed line from the first bar's top to the last bar's x-position
   - Shows the "before" level

2. **Vertical arrow with pill**: `[{xAxis: "2012", yAxis: 62}, {xAxis: "2012", yAxis: 31, symbol: "arrow", label: {...}}]`
   - Draws a vertical dashed line from top level down to bottom level
   - `symbol: "arrow"` on the end point draws a directional arrow
   - `label` with `position: "middle"` places the pill centered on the vertical segment
   - `backgroundColor`, `borderRadius`, `padding` create the pill appearance

#### Reference Line Geometry Rules

**RULE A — Connect to the arrow (anti-disconnect):**

Horizontal lines MUST connect to the vertical arrow. The horizontal reference line's end-point xAxis value must match the vertical arrow's xAxis value. This creates a cohesive bracket shape. A disconnected line (ending before the arrow) looks broken.

```
WRONG:  Upper line "08"→"09", vertical arrow at "2012"
         ─ ─ ─          ↓   (disconnected — 3 separate annotations)

RIGHT:  Upper line "08"→"2012", vertical arrow at "2012"
         ─ ─ ─ ─ ─ ─ ─ ─┐
                    -40% │↓  (connected — single cohesive bracket)
```

**RULE B — Don't overshoot bars (anti-overshoot):**

Horizontal lines must NOT extend past bars whose values differ significantly from the reference level. The start xAxis should be the first bar whose value is AT or NEAR the reference level. Extending the line over bars that are well above/below the reference level creates an unclean look — the line cuts through the body of those bars.

```
WRONG:  Line at y=50, starting at "07" (value=60)
        The line cuts through bar "07" at the 50-mark — unclean

RIGHT:  Line at y=50, starting at "08" (value=47, close to 50)
        The line is near the top of bar "08" — clean

RULE OF THUMB: If |bar_value - reference_level| > 15% of yAxis range,
don't include that bar under the reference line.
```

#### Two-Level Delta Bracket

When the inspiration shows BOTH a "before" level and an "after" level as horizontal lines (not just the arrow dropping to bar tops), use THREE markLine data pairs:

```
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐   pair 1: upper line at "before" level
                       -40% │↓  pair 3: vertical arrow with pill
            ─ ─ ─ ─ ─ ─ ─ ─ ┘   pair 2: lower line at "after" level
```

```json
{
  "markLine": {
    "symbol": ["none", "none"],
    "data": [
      [
        {"xAxis": "08", "yAxis": 50},
        {"xAxis": "2012", "yAxis": 50}
      ],
      [
        {"xAxis": "10", "yAxis": 30},
        {"xAxis": "2012", "yAxis": 30}
      ],
      [
        {"xAxis": "2012", "yAxis": 50, "symbol": "none"},
        {"xAxis": "2012", "yAxis": 30, "symbol": "arrow",
          "label": {
            "formatter": "-40%",
            "backgroundColor": "var(--brand-surface-light)",
            "borderRadius": 10,
            "padding": [4, 10, 4, 10],
            "color": "var(--brand-primary)",
            "fontSize": 13,
            "fontWeight": "bold",
            "lineHeight": 13,
            "align": "center",
            "position": "middle"
          }
        }
      ]
    ],
    "lineStyle": {"color": "var(--brand-gray-dark)", "type": "dashed", "width": 1.5}
  }
}
```

**KEY RULES for two-level brackets:**
1. BOTH horizontal lines must end at the same xAxis as the vertical arrow
2. The upper line starts where the "before" values begin; the lower line starts where the "after" values begin
3. **Vertical arrow endpoints = horizontal line yAxis values, NOT bar data values.** If upper line is at y=50 and lower line is at y=30, the arrow must go from y=50 to y=30 — NOT to a bar value like y=31. This ensures the pill is perfectly centered between the lines.
4. `yAxis.max` must be set explicitly high enough that the upper line and pill don't get clipped
5. **Bar label auto-offset**: The pipeline automatically offsets bar data labels at the same xAxis position as a vertical markLine segment (12px to the right) to prevent overlap with the pill. If you need different positioning, set the label offset explicitly on that data point.

#### Minimum Gap for Arrow

For the arrow symbol to be clearly visible, the vertical gap between the two endpoints must be large enough that the pill doesn't consume the entire space.

```
arrow_gap_ratio = (upperY - lowerY) / yAxis.max

If arrow_gap_ratio < 0.25 AND pill fontSize ≥ 12:
  → Remove arrow: use symbol: ["none", "none"] on the vertical segment
  → The dashed line + pill alone clearly communicate the delta
  → OR: Increase yAxis.max to create more vertical space

If arrow_gap_ratio ≥ 0.25:
  → Arrow is fine, keep symbol: ["none", "arrow"]
```

A tiny arrow nub below a large pill adds clutter, not clarity. When in doubt, remove the arrow.

#### Pill Label Styling

For clean pill labels, follow these rules:

1. **Use 4-value padding**: `[4, 10, 4, 10]` (top, right, bottom, left) — NOT shorthand `[4, 10]`. Explicit symmetric padding prevents vertical text drift.
2. **Set lineHeight = fontSize**: For single-line pills, `lineHeight` should equal `fontSize` (e.g., both 13). Prevents extra whitespace above/below text.
3. **Set align: "center"**: Explicit horizontal centering.
4. **borderRadius ≤ pill height / 2**: For a perfect pill shape, `borderRadius` ≤ `(fontSize + padding_top + padding_bottom) / 2`. E.g., fontSize 13 + padding 4+4 = 21px → borderRadius ≤ 10.

The pipeline auto-applies `align: "center"`, expands 2-value padding to 4-value, and sets `lineHeight = fontSize` on pill-style labels (those with `backgroundColor`).

#### Choosing Values

| Property | How to Set |
|----------|-----------|
| `xAxis` (horizontal) | Start: first bar AT or NEAR the reference level. **End: MUST match the vertical arrow's xAxis** (typically the last bar) |
| `yAxis` (horizontal) | The "before" or "higher" value level |
| `xAxis` (vertical) | The category where the arrow should appear (typically last bar) |
| `yAxis` start (vertical) | The higher value |
| `yAxis` end (vertical) | The lower value |
| `symbol: "arrow"` | Put on the endpoint in the direction of change |
| `label.formatter` | The delta text, e.g., "-40%", "+25%", "2.5x" |

#### Label Rotation Guard

The pipeline auto-applies `rotate: 0` to all markLine, markPoint, and markArea labels by default
(v4.9.1). Text stays horizontal unless you explicitly set a non-zero `rotate` value.

If rotation still occurs despite the auto-default (e.g. ECharts overrides in edge cases),
ensure the vertical segment spans at least 15-20% of the y-axis range.

```
WRONG:  yAxis: 47 → yAxis: 31  (gap of 16 in a 0-62 range = 26% → OK)
WRONG:  yAxis: 47 → yAxis: 42  (gap of 5 in a 0-62 range = 8% → label WILL rotate)
```

If the gap is too small, place the pill label on the HORIZONTAL reference line instead
(`position: "middle"` on the horizontal pair) or use a separate markPoint for the pill.

#### Troubleshooting: markLine Pill Rotates 90°

The pipeline sets `rotate: 0` on all markLine labels by default (v4.9.1). If the pill still
rotates despite this (edge case):

1. **Check yAxis.max**: If not set explicitly, ECharts auto-ranges. A yAxis that
   auto-ranges to max=200 when data is 62→31 makes the gap 31/200=15.5% (borderline).
   FIX: Set `"max": 75` (or nearest round number above your highest value) explicitly.

2. **Check vertical segment xAxis values**: Both endpoints of the vertical segment
   MUST have the SAME xAxis category. If they differ, ECharts draws a diagonal line
   (not vertical), making the label fit awkwardly.
   WRONG: `{xAxis: "2011", yAxis: 62} → {xAxis: "2012", yAxis: 31}` (diagonal)
   CORRECT: `{xAxis: "2012", yAxis: 62} → {xAxis: "2012", yAxis: 31}` (vertical)

3. **Check horizontal line span**: See "Reference Line Geometry Rules" above — horizontal lines must connect to the vertical arrow and must not overshoot bars.

**NEVER switch to graphic groups as a workaround.** markLine two-point is the
correct and ONLY technique for delta pills. If it doesn't work on first attempt,
fix the coordinates — don't change the technique. Graphic groups with manual
positioning cause drift, lack auto-positioning, and are blocked by check 57.

#### Pipeline Compatibility

`applyMarkLineDefaults()` in render_echarts.mjs:
- Fills MISSING fontFamily, fontSize, color, `rotate: 0` on markLine.label
- Also walks `markLine.data[*][*].label` to set `rotate: 0` on data-point labels
- NEVER touches backgroundColor, borderRadius, padding, fontWeight
- SAFE for pill-styled labels — your styling is preserved

All `var(--brand-*)` tokens are resolved by `resolveAllCssVariables()` before rendering.

---

### 4. $callouts Pattern for Callout Boxes (v4.7.1 — PREFERRED for callouts)

Use `$callouts` on a series to create callout boxes with leader lines pointing to data.
The pipeline generates `label`, `labelLayout`, and `labelLine` configuration automatically.

#### Full JSON Example

```json
{
  "series": [{
    "type": "line",
    "data": [100, 110, 130, 100, 300, 1800, 800],
    "$callouts": [
      {
        "dataIndex": 5,
        "text": "Peak of prices caused\nby export quotas reduction",
        "position": "left",
        "offsetX": -200
      },
      {
        "dataIndex": 6,
        "text": "Drop in 2012 as a result\nof demand decrease due to\nunsustainably high prices",
        "position": "left",
        "offsetX": -200,
        "offsetY": 20
      }
    ]
  }],
  "xAxis": {"type": "category", "data": ["2006","2007","2008","2009","2010","2011","2012"]},
  "yAxis": {"type": "value"}
}
```

#### Schema Reference

| Property | Required | Default | Description |
|----------|----------|---------|-------------|
| `dataIndex` | Yes | — | Which data point to annotate (0-based index into series.data) |
| `text` | Yes | — | Callout text. Use `\n` for line breaks |
| `position` | Yes | — | `"left"` or `"right"` — which side of the data point |
| `offsetX` | No | -200 (left) / +160 (right) | Horizontal pixel offset from data point |
| `offsetY` | No | 0 | Vertical pixel offset from data point |
| `style` | No | brand defaults | Label style overrides: `{backgroundColor, borderColor, borderWidth, padding, color, fontSize, lineHeight, width}` |
| `lineStyle` | No | grey dashed | Leader line overrides: `{color, type, width}` |

**IMPORTANT**: `$callouts` uses `labelLayout` which requires renderable symbols.
If your series has `symbol: "none"` or `showSymbol: false`, the pipeline
auto-converts to `symbol: "circle", symbolSize: 1` (invisible 1px dots). This
is handled automatically — you don't need to change your symbol config. But be
aware: if labels don't appear, check the console for the `[callouts] Fixed symbol`
message confirming the conversion happened.

#### How the Pipeline Processes It

`processCallouts()` in render_echarts.mjs:

1. **Fixes `symbol: "none"`**: If the series has `symbol: "none"` or `showSymbol: false`, converts to `symbol: "circle", symbolSize: 1`. This is REQUIRED because ECharts SSR mode needs renderable symbol elements to provide `params.rect` in `labelLayout` callbacks. Without symbols, labels silently don't render — no error, just invisible.
2. **Reads** `$callouts` from series, then **deletes** it (not passed to ECharts)
3. **Creates per-data-item labels**: Each callout dataIndex gets a styled label with the text; all other points get `label: { show: false }`
3. **Creates `labelLayout` callback**: Uses `params.rect` (ECharts provides pixel bounding box of each data point) to calculate box position + `labelLinePoints` for leader line + `moveOverlap: 'shiftY'` for collision avoidance
4. **Creates `labelLine`**: Dashed grey leader line connecting label box to data point

#### When to Use left vs right

| Data Point Position | Use `position` | Why |
|---------------------|---------------|-----|
| Right half of chart (high index) | `"left"` | Box goes into empty space on the left |
| Left half of chart (low index) | `"right"` | Box goes into empty space on the right |
| Middle of chart | Match inspiration | Use whichever side has more empty space |

#### POSITIONING RULE: No Annotation-Over-Data (v4.7.1-hf3)

Callout boxes must NOT cover chart data (bars, lines, areas).
The pipeline SVG-parses the rendered chart and emits **BLOCKING errors** when annotation
backgrounds overlap actual data elements. Annotations in empty grid space are fine.

**Best placement strategy:**
1. FIRST check where data IS and IS NOT in the chart grid
2. Position callouts in EMPTY SPACE within the grid (preferred) or outside the grid
3. If callouts go right of data: set `grid.right` large enough (≥170px), use positive `offsetX`
4. If data fills the whole grid: use negative `offsetX` to position left of data area
5. NEVER use trial-and-error — the APA Annotation Table (§3.5D) prevents this

**If you get `[annotation-overlap]`:**
- Increase `|offsetX|` to move the box further from the data point
- Change `position` direction (left↔right) to move box to emptier side
- Increase `grid.right` or `grid.left` to create more space outside the data area

#### $callouts Positioning — Step-by-Step (MANDATORY)

Before writing $callouts, follow these steps IN ORDER:

**STEP 1 — Create callout zones by increasing grid margins:**
- Callouts to the LEFT of data → set `grid.left` ≥ (callout box width + 30px)
  - Default callout width = 140px → `grid.left` ≥ 170
- Callouts to the RIGHT of data → set `grid.right` ≥ (callout box width + 30px)
  - Default callout width = 140px → `grid.right` ≥ 170
- This is a PREREQUISITE, not optional. Without adequate margins, offsetX pushes
  boxes into the data area regardless of value.

**STEP 2 — Calculate offsetX from grid dimensions:**
- For `position: "left"`: `offsetX` ≈ -(chart_pixel_width - grid.right)
  - This places the box at the left edge of the chart, in the grid.left margin
  - Example: 454px chart, grid.right=40 → offsetX ≈ -414 (too far — reduce)
  - Better: grid.left=170, offsetX = -(170 + 20) = -190
- For `position: "right"`: `offsetX` ≈ +(grid.right - 20)
  - This places the box in the grid.right margin area

**STEP 3 — Verify no overlap:**
- Check which data indices have high values — callouts should NOT be at the same
  y-level as high data values in the area where the box will land
- Use `offsetY` to shift boxes vertically if needed

**Common mistake**: Increasing |offsetX| without increasing grid margins. An
offsetX of -350 on a 454px chart pushes the box to x=-104 (outside chart entirely).
The box is clipped or invisible. FIX: Increase grid.left/right FIRST, THEN set
offsetX to place the box in the margin area.

#### Callout Placement: Overlay vs Margin

Look at the inspiration to decide WHERE callout boxes should sit:

**Overlay placement** (callout sits ON the chart data area):
- The inspiration shows callout boxes overlapping the chart line/bars
- Use `grid.right: 50-80` (normal margin) + `$callouts` with `position: right, offsetX: 10-40`
- The callout box will overlap data — this is intentional and matches inspiration
- Make sure leader lines are still visible

**Margin placement** (callout sits OUTSIDE the data area):
- The inspiration shows callout boxes in a clear empty zone to the right/left of data
- Use `grid.right: ≥170` (wide margin) + `$callouts` with `position: right, offsetX: 20-60`
- The data area shrinks to make room for callouts

**How to decide**: Look at where the callout boxes are in the inspiration relative to the chart data. If they overlap bars/lines → overlay. If they're in clear space beside the data → margin. Default to what the inspiration shows.

---

### 5. Graphic Component Reference

#### Element Types

| Type | Shape Properties | Style Properties |
|------|-----------------|-----------------|
| `rect` | `shape: { x, y, width, height, r }` | `fill`, `stroke`, `lineWidth` |
| `circle` | `shape: { cx, cy, r }` | `fill`, `stroke`, `lineWidth` |
| `line` | `shape: { x1, y1, x2, y2 }` | `stroke`, `lineWidth`, `lineDash` |
| `text` | — | `text`, `font`, `fill`, `textAlign`, `textVerticalAlign` |
| `polygon` | `shape: { points: [[x,y],...] }` | `fill`, `stroke` |
| `polyline` | `shape: { points: [[x,y],...] }` | `stroke`, `lineWidth` |
| `arc` | `shape: { cx, cy, r, startAngle, endAngle }` | `fill`, `stroke` |
| `group` | — | Containers: use `children: [...]` |

#### Positioning

- **Percentage**: `left: '60%'`, `top: '10%'` — container-relative, imprecise, NOT data-aware
- **Pixel**: `x: 200`, `y: 50` — absolute from chart origin (manual, fragile)
- Groups position all children relative to group origin

#### Group Nesting

```json
{
  "type": "group",
  "left": "62%",
  "top": "10%",
  "children": [
    { "type": "rect", "shape": { "width": 130, "height": 55 },
      "style": { "fill": "var(--brand-bg-primary)", "stroke": "var(--brand-secondary)" } },
    { "type": "text", "style": { "text": "-40%", "x": 65, "y": 27,
      "textAlign": "center", "textVerticalAlign": "middle",
      "font": "bold 10px Arial", "fill": "var(--brand-primary)" } }
  ]
}
```

**IMPORTANT**: Text `fill` in graphic elements MUST be hex values, not `var(--brand-*)`. CSS variables are NOT resolved in graphic component properties. Use hex from branding/mckinsey.json.

WRONG: `{ type: 'text', style: { fill: 'var(--brand-primary)', text: 'CAGR 5%' } }`
RIGHT: `{ type: 'text', style: { fill: '#002B5C', text: 'CAGR 5%' } }`

#### Brand Defaults (Applied Automatically)

`render_echarts.mjs` applies these defaults to graphic elements without explicit styling:
- `text`: font = brand data font + dataLabel size, fill = brand text color
- `rect`: stroke = brand secondary blue, lineWidth = 1.5
- `line` (structural): stroke = brand secondary blue, lineWidth = 1
- `line` (leader — in callout groups with rect): stroke = grey (`gray.dark`), lineDash = [4, 3], lineWidth = 1
- Top-level lines alongside callout groups are also classified as leader lines

---

### 6. Custom Series (renderItem)

For shapes that must align precisely with data coordinates:

```json
{
  "type": "custom",
  "renderItem": "function(params, api) { var start = api.coord([api.value(0), api.value(1)]); var size = api.size([1, api.value(1)]); return { type: 'rect', shape: { x: start[0] - size[0]/2, y: start[1], width: size[0], height: size[1] }, style: api.style() }; }",
  "data": [[0, 100], [1, 200], [2, 150]],
  "encode": { "x": 0, "y": 1 }
}
```

Key APIs:
- `api.coord([x, y])` — convert data values to pixel position
- `api.size([xSpan, ySpan])` — convert data range to pixel size
- Return `{ type: 'group', children: [...] }` for composite shapes

---

### 7. Rich Text Labels

Use the `rich` property for inline formatted fragments within labels:

```json
{
  "label": {
    "show": true,
    "formatter": "{value|{c}} {badge|+12%}",
    "rich": {
      "value": {
        "fontSize": 11,
        "fontFamily": "Arial",
        "color": "var(--brand-text)"
      },
      "badge": {
        "fontSize": 9,
        "backgroundColor": "var(--brand-positive)",
        "color": "#FFFFFF",
        "borderRadius": 8,
        "padding": [2, 6, 2, 6]
      }
    }
  }
}
```

Use cases: pills, badges, colored text within labels.

---

### 8. Label Collision Avoidance

ECharts provides built-in label overlap handling:

```json
{
  "labelLayout": {
    "hideOverlap": true
  }
}
```

Or shift labels vertically to avoid overlap:

```json
{
  "labelLayout": {
    "moveOverlap": "shiftY"
  }
}
```

---

### 9. Recipe Patterns

#### Threshold Band (markArea + markLine)

```json
{
  "markLine": {
    "data": [{ "yAxis": 47 }],
    "lineStyle": { "type": "dashed", "color": "var(--brand-gray-dark)" },
    "label": { "formatter": "Target: 47", "position": "insideEndTop" },
    "symbol": "none"
  },
  "markArea": {
    "data": [[{ "yAxis": 40 }, { "yAxis": 54 }]],
    "itemStyle": { "color": "rgba(218,227,243,0.2)", "borderColor": "var(--brand-tertiary)" }
  }
}
```

#### KPI Badge (graphic rect + text)

```json
{
  "graphic": [{
    "type": "group", "right": "5%", "top": "5%",
    "children": [
      { "type": "rect", "shape": { "width": 80, "height": 30, "r": 4 },
        "style": { "fill": "var(--brand-primary)" } },
      { "type": "text", "style": { "text": "42M", "x": 40, "y": 15,
        "textAlign": "center", "textVerticalAlign": "middle",
        "font": "bold 14px Arial", "fill": "#FFFFFF" } }
    ]
  }]
}
```

#### Annotation Arrow (graphic line + polygon)

For arrows that connect elements (NOT inside delta pill groups):

```json
{
  "graphic": [{
    "type": "group", "left": "50%", "top": "40%",
    "children": [
      { "type": "line", "shape": { "x1": 0, "y1": 0, "x2": 60, "y2": 0 },
        "style": { "stroke": "var(--brand-gray-dark)", "lineWidth": 1.5,
                   "lineDash": [4, 3] } },
      { "type": "polygon", "shape": { "points": [[55,-4],[65,0],[55,4]] },
        "style": { "fill": "var(--brand-gray-dark)" } }
    ]
  }]
}
```

NOTE: This group has polygon, so `render_echarts.mjs` won't auto-apply leader line defaults. Set grey dashed explicitly if this is a connector arrow (not a delta pill indicator).

---

### 10. Number Formatting on Axes

Match the inspiration's number format. The branding config (`branding/mckinsey.json`) specifies default formatting:
- `numberFormat.thousandsSeparator`: space (" ") for McKinsey brand

#### Custom Axis Formatter

Use `axisLabel.formatter` to control number display:

```json
{
  "yAxis": {
    "axisLabel": {
      "formatter": "{value}"
    }
  }
}
```

The pipeline auto-applies the branding thousand separator when no explicit formatter is set.
For manual control:

| Format | Formatter | Example |
|--------|-----------|---------|
| Space separator | `function(v) { return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }` | 2 000 |
| No separator | `"{value}"` | 2000 |
| With unit | `function(v) { return v + '%'; }` | 45% |

**NOTE**: Match the inspiration exactly. If the inspiration shows "2 000" (space), use space. If it shows "2,000" (comma), use comma.

---

### Color Rules for Chart Annotations (Summary)

- **HTML/CSS**: always use `var(--brand-*)`
- **`data-echarts` JSON**: always use hex (e.g., `#1E3A5F`)
- **`graphic` component**: always use hex
- **SVG fill/stroke attributes**: always use hex
- CSS variables are NOT resolved inside ECharts JSON or graphic element properties
