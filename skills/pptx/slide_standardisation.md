# Slide Standardisation Guide

Every HTML slide must use these patterns. The gold standard is `examples/data-ranking/vertical-bar-chart.html`.

---

## 0. Slide Skeleton (MANDATORY — start every slide from this)

```html
<!DOCTYPE html>
<html>
<head><title>Descriptive Slide Title</title></head>
<body class="brand-slide">
  <div class="title-zone">
    <h1 style="margin: 0; font-size: 20px; font-weight: bold; color: var(--brand-primary); font-family: var(--brand-font-heading);">Action title goes here</h1>
  </div>
  <div class="content-zone">
    <!-- Main content here -->
  </div>
  <div class="footer-zone">
    <p class="source">SOURCE: Team analysis</p>
    <p class="page-num">Nexus | 1</p>
  </div>
</body>
</html>
```

What `class="brand-slide"` gives you automatically:
- Slide dimensions (960×540pt at proper aspect ratio)
- All `var(--brand-*)` CSS variables (colors, fonts, spacing)
- Default font-family, background color, flex column layout
- The `.title-zone`, `.content-zone`, `.footer-zone` classes with proper padding/sizing

What you MUST NOT put on `<body>`:
- `width` or `height` (dimensions come from the class)
- `font-family` (comes from the class)
- `margin` or `padding` (comes from the class)
- No `<style>` blocks with `:root {}` (variables are injected by the pipeline)

Optional title-zone additions:
- Section ID above h1: `<p style="margin: 0 0 2pt 0; font-size: 10px; font-weight: bold; color: var(--brand-gray-dark); text-transform: uppercase; letter-spacing: 0.5px;">SECTION NAME</p>`
- Tag badge (e.g. ESTIMATION): `<div style="position: absolute; top: 8pt; right: 14pt; ...">` (requires `style="position: relative;"` on title-zone div)

### CSS Features That Do NOT Survive PPTX Conversion

The html2pptx pipeline renders HTML via Playwright then extracts elements to PptxGenJS. These CSS features are silently dropped — your HTML will look correct in a browser but BROKEN in the PPTX:

| CSS Feature | Pipeline Behavior | Use Instead |
|------------|-------------------|-------------|
| `::before` / `::after` | Silently dropped — content disappears | Real `<span>` or `<div>` elements |
| `clip-path` | Not rendered | SVG `<path>` with explicit coords |
| `linear-gradient()` | Not rendered | SVG `<linearGradient>` or solid fills |
| `transform: rotate/skew` | Not rendered | Pre-rotated SVG coordinates |
| `box-shadow` | Not rendered | Skip |
| `text-shadow` | Not rendered | Skip |
| `filter: blur/drop-shadow` | Not rendered | Skip |

The pre-flight validator (check 56) catches `::before`/`::after` in `<style>` blocks. Other forbidden features are caught at PPTX generation time — but by then you've wasted an iteration. Avoid them from the start.

---

## 1. Title Zone

Every slide's title zone must follow this pattern:

```html
<div class="title-zone">
  <h1 style="margin: 0; font-size: 20px; font-weight: bold; color: var(--brand-primary); font-family: var(--brand-font-heading);">Action title goes here</h1>
  <p style="margin: 4pt 0 0 0; font-size: 11px; color: var(--brand-gray-dark);">Optional subtitle / units description</p>
</div>
```

Rules:
- H1: 20px, bold, `var(--brand-primary)`, `var(--brand-font-heading)` (Georgia)
- Subtitle: 11px, `var(--brand-gray-dark)`
- No decorative elements (colored bars, icons) around the title — keep it clean
- If the slide needs a color legend in the title area:

```html
<div style="display: flex; gap: 24pt; align-items: center; margin-top: 4pt;">
  <div style="display: flex; align-items: center; gap: 6pt;">
    <div style="width: 20pt; height: 12pt; background: var(--brand-accent);"></div>
    <p style="margin: 0; font-size: 9px;">Legend label</p>
  </div>
</div>
```

**Title + Legend coexistence**: When the inspiration shows a legend BESIDE the title
(same horizontal level, not below), use flex layout — NOT `position: absolute`:

```html
<!-- Title-zone with side-by-side title + legend -->
<div class="title-zone" style="display: flex; flex-direction: row; flex-wrap: nowrap; justify-content: space-between; align-items: flex-start;">
  <h1 style="margin: 0; font-size: 20px; font-weight: bold; color: var(--brand-primary); font-family: var(--brand-font-heading); max-width: 75%; padding-right: 20pt;">Title text here — even long titles that wrap to two lines stay within 75% width</h1>
  <div style="flex-shrink: 0; min-width: 140pt; display: flex; flex-direction: column; gap: 3pt; align-items: flex-end;">
    <!-- legend items -->
    <div style="display: flex; align-items: center; gap: 6pt;">
      <div style="width: 24pt; border-top: 2px solid var(--brand-gray-dark);"></div>
      <p style="margin: 0; font-size: 9px;">Actual</p>
    </div>
  </div>
</div>
```

Rules:
- NEVER use `position: absolute` for legend when title wraps to 2+ lines — it WILL collide
- Title-zone: `flex-direction: row` (CRITICAL — the `.title-zone` class defaults to `column`; you MUST override it) + `flex-wrap: nowrap` — legend must NEVER wrap to a second line below the title
- Title h1: `max-width: 75%` — hard cap prevents title from claiming all available width. Title wraps WITHIN its 75% allocation, not by pushing the legend away
- Legend container: `flex-shrink: 0; min-width: 140pt` — guarantees space for legend items
- Add `padding-right: 20pt` on h1 to create gap between title and legend
- Legend must be at the SAME vertical level as the title — legend on a separate line below = FAIL

## 2. Container Box

Wrap the main chart/content area in a bordered container with a colored header bar.

```html
<div style="border: 1.5px solid var(--brand-surface-light); position: relative; overflow: hidden; display: flex; flex-direction: column;">
  <!-- Header bar -->
  <div style="background: var(--brand-surface-light); padding: 8pt 14pt;">
    <p style="margin: 0; font-size: 11px; font-weight: bold; color: var(--brand-primary);">Exhibit Title</p>
    <p style="margin: 2pt 0 0 0; font-size: 9px; color: var(--brand-gray-dark);">Units, description</p>
  </div>
  <!-- Body -->
  <div style="flex: 1; position: relative; padding: 6pt;">
    <!-- Charts, tables, etc. -->
  </div>
</div>
```

Rules:
- Border color MUST match header bar background (`var(--brand-surface-light)`)
- Always include `overflow: hidden`
- If an overlay box needs to straddle the border, set `width: 85%` on the container
- Container Box is ALWAYS: border + header bar. A border without a header bar is an INCOMPLETE Container Box.
- Every bordered panel with white/transparent background MUST have the shaded header bar with a descriptive title.
- Only Takeaway Boxes (Section 3, dark background) skip the header bar.
- Container boxes MUST have a VISIBLE border or background differentiation. A container without visual boundaries looks "uncontained" even if structurally correct. Minimum visibility: `border: 1.5px solid var(--brand-surface-light)` OR distinct background color on header bar.

### Header Bar Equalization (Multi-Panel Layouts)

When multiple Container Boxes appear side-by-side:
- ALL header bars MUST use identical padding (standard: `8pt 14pt`)
- ALL headers MUST have same visual height — use `min-height` to equalize
- If one header has 2 lines and another has 1, set `min-height` on ALL to match tallest
- Mismatched header heights across side-by-side panels = FAIL

### Multi-Column Container Box Headers

When a Container Box body has sub-columns (e.g., chart area + annotation column), the
header MUST use the SAME flex proportions so text aligns with the body columns below.

```html
<!-- Body uses flex:7 (chart) + flex:3 (annotations) -->
<div style="flex: 1; display: flex; gap: 8pt;">
  <div style="flex: 7;"><!-- chart --></div>
  <div style="flex: 3;"><!-- year labels + pills --></div>
</div>

<!-- Header MUST mirror this split -->
<div style="background: var(--brand-surface-light); padding: 6pt 14pt; display: flex; gap: 8pt;">
  <div style="flex: 7;">
    <p style="margin: 0; font-size: 11px; font-weight: bold; color: var(--brand-primary);">Chart Title</p>
    <p style="margin: 2pt 0 0 0; font-size: 9px; color: var(--brand-gray-dark);">Subtitle</p>
  </div>
  <div style="flex: 3; display: flex; gap: 14pt;">
    <p style="margin: 0; font-size: 9px; font-weight: bold; color: var(--brand-primary);">Birth year</p>
    <div>
      <p style="margin: 0; font-size: 9px; font-weight: bold; color: var(--brand-primary);">40-year growth</p>
    </div>
  </div>
</div>
```

Rules:
- The header's right-side columns MUST vertically align with the body's right-side columns
- Use the SAME flex ratios or explicit widths in BOTH header and body
- WRONG: `justify-content: space-between` in header when body uses flex:7 + flex:3
- Test: trace a vertical line from "Birth year" in header — it must hit the year labels in the body

## 3. Takeaway / Insights Box

Dark navy background, white text. Used for key takeaways, "identified as not relevant" boxes, etc.

```html
<div style="background: var(--brand-primary); padding: 14pt; border-radius: 3pt;">
  <p style="margin: 0 0 6pt 0; font-size: 11px; font-weight: bold; color: white;">Key takeaways</p>
  <div style="height: 1.5pt; background: white; margin-bottom: 8pt;"></div>
  <ul style="margin: 0; padding-left: 14pt; list-style: none;">
    <li style="margin-bottom: 6pt; font-size: 9px; color: white; position: relative; padding-left: 10pt;">
      <span style="position: absolute; left: 0;">&#9632;</span>
      <strong>Bold lead-in</strong> rest of the insight text
    </li>
  </ul>
</div>
```

Rules:
- Background: `var(--brand-primary)` (#1E3A5F) — NEVER lighter blues
- All text: white
- White separator line below title
- Bold-keyword pattern on every bullet
- Multiple takeaways/insights MUST use bullet point formatting (`<ul>` + `<li>`), NEVER plain `<p>` paragraphs. If a takeaway box has 3+ insights, they must be bulleted with the bold-keyword pattern.

### Bullet Margin from Container Border

Bullet lists inside Container Boxes or Takeaway Boxes need sufficient clearance from borders:
- Container body padding: minimum `8pt 10pt` (vertical horizontal)
- Bullet marker position: `left: 0` relative to padding start — NOT absolute to container
- If using `position: absolute; left: 0` for marker spans, the `<li>` padding-left must be >= 14pt to prevent marker clipping at container border
- WRONG: `<li style="padding-left: 8pt;">` with `<span style="position: absolute; left: 0;">` — marker may clip border
- CORRECT: `<li style="padding-left: 14pt;">` with `<span style="position: absolute; left: 0;">` — sufficient clearance

### Hierarchical Bullets (Flat Structure)

**IMPORTANT**: Nested `<ul>` inside `<li>` elements are silently dropped in PPTX rendering. PptxGenJS does not support true nested lists — sub-bullets overlap parent bullets, making text unreadable.

**Use a FLAT `<ul>` with visual hierarchy** achieved through different markers, font sizes, and indentation:

```html
<ul style="margin: 0; padding-left: 0; list-style: none;">
  <!-- Level 1: Main bullet (■ marker, 10px font, 14pt indent) -->
  <li style="margin-bottom: 6pt; font-size: 10px; color: white; position: relative; padding-left: 14pt; line-height: 1.35;">
    <span style="position: absolute; left: 0;">&#9632;</span>
    Main point with supporting detail:
  </li>
  <!-- Level 2: Sub-bullet (– marker, 9px font, 26pt indent) -->
  <li style="margin-bottom: 3pt; font-size: 9px; color: white; position: relative; padding-left: 26pt; line-height: 1.35;">
    <span style="position: absolute; left: 14pt;">&#8211;</span>
    Sub-point (indented, smaller font, dash marker)
  </li>
  <li style="margin-bottom: 3pt; font-size: 9px; color: white; position: relative; padding-left: 26pt; line-height: 1.35;">
    <span style="position: absolute; left: 14pt;">&#8211;</span>
    Another sub-point under the same main bullet
  </li>
  <!-- Level 1: Next main bullet -->
  <li style="margin-bottom: 0pt; font-size: 10px; color: white; position: relative; padding-left: 14pt; line-height: 1.35;">
    <span style="position: absolute; left: 0;">&#9632;</span>
    Second main point
  </li>
</ul>
```

**How the visual hierarchy works:**

| Level | Marker | Font Size | padding-left | Marker Position |
|-------|--------|-----------|-------------|-----------------|
| 1 (Main) | ■ (`&#9632;`) | 10px | 14pt | `left: 0` |
| 2 (Sub) | – (`&#8211;`) | 9px | 26pt | `left: 14pt` |

**WRONG** — Nested list (breaks in PPTX):
```html
<ul>
  <li>Main point
    <ul>
      <li>Sub-point</li>
    </ul>
  </li>
</ul>
```

**RIGHT** — Flat list with visual hierarchy (works in PPTX):
```html
<ul style="list-style: none;">
  <li style="padding-left: 14pt;">■ Main point</li>
  <li style="padding-left: 26pt; font-size: 9px;">– Sub-point</li>
</ul>
```

## 4. Colors

### Brand Token Standardization — Zero Hardcoded Colors

ALL visual elements MUST use `var(--brand-*)` CSS variable tokens. NEVER hardcode hex color values.

| Element Type | Correct | Wrong |
|-------------|---------|-------|
| Funnel stages | `var(--brand-primary)` through `var(--brand-quaternary)` | `#D0D0D0`, `#A2AAAD`, `#C0C5C9` |
| Process boxes | `var(--brand-primary)` fill, `var(--brand-secondary)` border | `#1E3A5F`, `#2E75B6` |
| Decorative borders | `var(--brand-surface-light)` or `var(--brand-gray-border)` | `var(--brand-negative)` for non-semantic use |
| Chart annotations | `var(--brand-secondary)` stroke, `var(--brand-bg-primary)` fill | `#2E75B6`, `#FFFFFF` |
| Text | `var(--brand-text)`, `var(--brand-text-primary)` | `#333333`, `#222222` |

**Rules:**
- `--brand-primary` through `--brand-quinary` for key shapes (primary palette gradient)
- `--brand-gray-*` ONLY for backgrounds, borders, subtle elements
- `--brand-negative` ONLY for semantic negative indicators (losses, declines)
- When inspiration uses grey for key shapes → UPGRADE to `--brand-primary/secondary/tertiary`
- When inspiration uses red decoratively → REPLACE with `--brand-surface-light` or `--brand-gray-border`

**In HTML/CSS**: Always use `var(--brand-*)` variables.

**In `data-echarts` JSON**: Use `var(--brand-*)` tokens — `render_echarts.mjs` resolves them to hex at render time. You may also use hex directly.

**In SVG `fill`/`stroke` attributes**: Use hex from `branding/mckinsey.json`. CSS custom properties (`var()`) are not supported in SVG presentation attributes.

**SVG colors MUST come from the brand palette** defined in `branding/mckinsey.json`. Generic grays (#888, #A0A0A0, #B8B8B8, etc.) are NOT brand colors — map them to the closest brand color from the JSON.

The pipeline enforces SVG colors at BOTH pre-flight (validate_html.cjs reads branding JSON) AND runtime (html2pptx.mjs auto-replaces off-brand colors). Off-brand SVG fill colors = error.

**All valid hex colors and CSS variables are defined in `branding/mckinsey.json`.** Refer to that file for the authoritative color palette.

### Color Tiers (Usage Restrictions)

| Tier | CSS Variables | When to Use |
|------|-------------|-------------|
| **Tier 1: Always safe** | `--brand-primary`, `--brand-secondary`, `--brand-tertiary`, `--brand-surface-light`, `--brand-text`, `--brand-gray-dark`, `--brand-gray-medium`, `--brand-bg-secondary` | Default palette. Use freely for all elements. |
| **Tier 2: Inspiration-only** | `--brand-accent` (gold), `--brand-accent-teal` (teal), `--brand-accent-orange` (orange) | Only if the inspiration explicitly shows accent/emphasis colors. Common in chart data series. |
| **Tier 3: Restricted** | `--brand-negative` (red), `--brand-warning` (amber), `--brand-positive` (green) | **ONLY** for explicit status/sentiment indicators visible in the inspiration. NEVER for decoration, badges, or borders. Pre-flight and runtime both flag these. |

If you need emphasis but the inspiration doesn't use Tier 2/3 colors:
- Strong emphasis → `--brand-primary` (navy)
- Subtle emphasis → `--brand-gray-dark`
- Visual hierarchy → font weight (bold) or size increase

For ECharts and SVG, look up the hex values from `branding/mckinsey.json` → `colors` and `colorSequence.charts`.

### Chart Color Sequence (for data series)

When a chart, stacked bar, or grouped visual has multiple categories, use the full chart sequence:

| Index | CSS Variable | Hex | Also known as |
|-------|-------------|-----|--------------|
| 1 | `var(--brand-chart-1)` | #1E3A5F | `--brand-primary` (navy) |
| 2 | `var(--brand-chart-2)` | #2E75B6 | `--brand-secondary` |
| 3 | `var(--brand-chart-3)` | #5B9BD5 | `--brand-tertiary` |
| 4 | `var(--brand-chart-4)` | #A8C8E8 | `--brand-quaternary` |
| 5 | `var(--brand-chart-5)` | #D6E6F4 | `--brand-quinary` |
| 6 | `var(--brand-chart-6)` | #B8975C | `--brand-accent` (gold) |
| 7 | `var(--brand-chart-7)` | #D0D0D0 | `--brand-gray-medium` |

Use `--brand-chart-N` in CSS for data series. In `data-echarts` JSON and SVG attributes, use the hex values directly. The tier restrictions above apply to UI elements — chart data series may use ALL 7 colors freely.

**>7 categories**: If a chart has more than 7 categories, use lighter/darker variants of existing colors (e.g., `rgba(30,58,95,0.7)` for 70% navy). NEVER reuse the same color for different categories — each category must be visually distinct.

### Highlight & Overlay Elements

When the inspiration shows colored regions, polygon overlays, brackets, or shaded areas over chart data:

**These are NOT decorations — they carry analytical meaning.** Each highlight element visually GROUPS related data elements and MUST be reproduced.

**CORRECT**: Absolute-positioned `<div>` with semi-transparent background (`rgba(...)` or `opacity: 0.15`) placed precisely over the target elements.

**WRONG**: Omitting highlight overlays and replacing them with text-only callout boxes. The overlay IS the annotation.

**WRONG**: Adding decorative elements (zigzag lines, wave patterns, ornamental shapes) that are NOT in the inspiration.

### Color Consistency Between Related Elements

When an annotation element (badge, pill, label, highlight overlay) references a specific data element (bar segment, line series, pie slice):

- The annotation MUST use the SAME color as its referenced data element (or a contrasting outline of that color on white background)
- NEVER use a single uniform color for all annotations when the underlying data uses different colors per category — this BREAKS the visual link
- Example: if a stacked bar has 4 segments in navy/blue-dark/blue-medium/blue-light, the growth percentage pills next to each segment must match: navy pill → navy segment, blue-dark pill → blue-dark segment
- This rule applies to ALL visual elements that create data-to-annotation relationships: badges, pills, circles, ovals, brackets, highlight boxes

### Annotation-to-Data Color Mapping

When an annotation box, badge, or callout references a specific chart category or data series, its border or fill color MUST match the color of that series:

- Example: If "Individual" segment uses #1E3A5F, the annotation about "Individual dental" MUST have `border: 2px solid #1E3A5F`
- Uniform color for all annotations when data uses different colors = FAIL
- Each annotation's color must visually link it to its referenced data element — the viewer should instantly know which data the annotation describes by color alone
- This applies to: bordered callout boxes, pill badges, highlight overlays, circle markers, bracket shapes

### Shape Fill Color Preferences

For KEY DIAGRAM SHAPES (funnels, pyramids, circles, flow shapes):
- Primary shape fill: `var(--brand-primary)` or `var(--brand-secondary)` — BLUE tones
- Use gradients (`linearGradient`) for 3D depth: lighter `--brand-secondary` → darker `--brand-primary`
- Reserve grey (`var(--brand-gray-*)`) for BACKGROUNDS and NEUTRAL elements only
- A funnel/pyramid/key shape in grey looks washed out — use brand blues

For SECONDARY/SUPPORTING shapes:
- Grey is acceptable for backgrounds, separator areas, neutral containers
- White/surface-light for content areas inside shapes

### SVG Color Usage

**WRONG** (CSS variables in SVG presentation attributes — WILL NOT RENDER):
```html
<rect fill="var(--brand-primary)" stroke="var(--brand-gray-dark)">
```

**RIGHT** (hex values from branding/mckinsey.json):
```html
<rect fill="#002B5C" stroke="#4A4A4A">
```

CSS variables work ONLY in the `style` attribute: `<rect style="fill: var(--brand-primary)">`.

### COMPLETE VALID CSS VARIABLES

These are the ONLY valid `var(--brand-*)` tokens. Any other `--brand-*` name will resolve to nothing.

| Token | Category | Hex |
|-------|----------|-----|
| `--brand-primary` | Primary Navy | #002B5C |
| `--brand-primary-logo` | Primary Logo Blue | #0057B8 |
| `--brand-primary-deep` | Primary Deep | #001A33 |
| `--brand-primary-vivid` | Primary Vivid | #0066CC |
| `--brand-secondary` | Secondary Dark Blue | #004B87 |
| `--brand-tertiary` | Secondary Medium Blue | #4A90D9 |
| `--brand-quaternary` | Secondary Light Blue | #8CB4E0 |
| `--brand-quinary` | Secondary Pale Blue | #C6DAF0 |
| `--brand-gray-dark` | Gray Dark | #4A4A4A |
| `--brand-gray-medium` | Gray Medium | #9B9B9B |
| `--brand-gray-light` | Gray Light | #D4D4D4 |
| `--brand-gray-silver` | Gray Silver | #E8E8E8 |
| `--brand-gray-border` | Gray Border | #CCCCCC |
| `--brand-text-primary` | Text Primary | #002B5C |
| `--brand-text` | Text Body | #333333 |
| `--brand-text-secondary` | Text Secondary | #666666 |
| `--brand-text-inverse` | Text Inverse | #FFFFFF |
| `--brand-bg-primary` | Background Primary | #FFFFFF |
| `--brand-bg-secondary` | Background Secondary | #F5F5F5 |
| `--brand-bg-dark` | Background Dark | #002B5C |
| `--brand-surface-light` | Surface Light | #F0F4F8 |
| `--brand-surface-muted` | Surface Muted | #E1E8EF |
| `--brand-positive` | Semantic Positive (Tier 3) | #2E7D32 |
| `--brand-negative` | Semantic Negative (Tier 3) | #C62828 |
| `--brand-warning` | Semantic Warning (Tier 3) | #EF6C00 |
| `--brand-neutral` | Semantic Neutral (Tier 3) | #1565C0 |
| `--brand-accent` | Accent Gold (Tier 2) | #B8860B |
| `--brand-accent-teal` | Accent Teal (Tier 2) | #00796B |
| `--brand-accent-orange` | Accent Orange (Tier 2) | #E65100 |
| `--brand-font-heading` | Font (not color) | Georgia, serif |
| `--brand-font-body` | Font (not color) | Arial, sans-serif |

**Do NOT invent variable names.** Using `--brand-secondary-medium`, `--brand-secondary-pale`, `--brand-secondary-light` etc. will result in invisible elements.

## 5. Typography

| Tier | Size | Weight | Color | Use |
|------|------|--------|-------|-----|
| T1 | 20px | bold | `var(--brand-primary)` | Slide title (H1) |
| T2 | 11px | bold | `var(--brand-primary)` | Exhibit titles, headers |
| T3 | 9-10px | normal | `var(--brand-text)` | Body, bullets, labels |
| T4 | 9px | normal | `var(--brand-gray-dark)` | Source, footnotes |

- Bold-keyword pattern: first 3-8 words of every bullet in `<strong>`
- Font: `var(--brand-font-heading)` for H1, `var(--brand-font-body)` for everything else

**Simple font-size rule**: Aim for max 4 distinct font sizes per slide: 20px title, up to 2 body sizes (9-11px), 9px source/footnote. When in doubt, use fewer sizes.

**Font sizing defaults**: Default to MIDDLE of tier range (T1:20px, T2:12px, T3:10px, T4:9px). Reduce toward minimum only if overflow. Increase only if whitespace >15%.

**Topic sentences**: Bold paragraph above each bullet group stating the "so what".

**No orphan text**: Every text block inside a container. **Alignment**: text left-aligned, containers centered with `align-items: stretch`.

**Max line length**: Use columns/sidebars/70-30 layouts — never full 10" width.

**Hard Rules:**
- Font sizes MUST use `px` units. NEVER use `pt` for font sizes — `pt` renders differently across browsers and causes inconsistent PPTX output.
- No text element may be smaller than 9px (except inside `data-echarts` JSON where ECharts controls sizing).
- Body text MUST use `var(--brand-text)` (#333333). Do NOT use `var(--brand-text-primary)` (#222222) for body — it is reserved for large display text.

## 6. Speech Bubble Callouts

```html
<!-- SVG stroke hex: look up branding/mckinsey.json → colors.semantic.neutral -->
<div style="position: absolute; left: Xpt; top: Ypt; width: Wpt; z-index: 10;">
  <div style="background: white; border: 1px solid var(--brand-gray-medium); border-radius: 4pt; padding: 8pt 10pt; border-bottom-color: white;">
    <p style="margin: 0; font-size: 9px; color: var(--brand-primary); line-height: 1.35;">Text</p>
  </div>
  <svg width="24" height="14" viewBox="0 0 24 14" style="margin-left: Mpt; margin-top: -1pt; display: block;">
    <path d="M0,0 L12,14 L24,0" fill="white" stroke="{semantic.neutral hex from branding JSON}" stroke-width="1" stroke-linejoin="round"/>
    <line x1="0" y1="0" x2="24" y2="0" stroke="white" stroke-width="2"/>
  </svg>
</div>
```

## 7. Footer

```html
<div class="footer-zone">
  <p class="source">Source: Description</p>
  <p class="page-num">Nexus | 1</p>
</div>
```

Rules:
- Source line: always include `<p class="source">` even if empty
- Page number: always use `Nexus | N` format, NEVER just a bare number

## 8. Spacing

- Gap between flex panels: `gap: 14pt`
- Container internal padding: `6pt`
- Header bar padding: `8pt 14pt`
- Bullet spacing: `margin-bottom: 6pt`
- Title to content: `margin: 0` (zones handle padding)
- Minimum internal padding: ANY element with a visible border or background that contains text must have ≥4pt padding on ALL sides. Text touching a border = FAIL.
- **Element clearance**: Adjacent positioned elements (siblings using `position: absolute/relative` with explicit offsets, or flex siblings) must maintain a minimum **8px gap** from all sibling elements. Overlapping positioned elements = FAIL. When SVG graphics sit beside a content column, the SVG width + gap must not exceed the allocated space — SVG overflow into adjacent columns = FAIL.
- For overlapping annotation boxes on charts: annotation top must be ≥6px below any container header bar. Annotation labels must be fully inside the annotation box (no protruding above/below).

**FLEX:1 STACKING RULE**: In a `flex-direction:column` container, NEVER combine `flex:1` children (chart panels) with non-flex text siblings (takeaway boxes). `flex:1` consumes ALL remaining space, squeezing text to zero height.

```html
<!-- WRONG: flex:1 squeezes takeaway to 0px -->
<div style="display:flex; flex-direction:column; height:400pt;">
  <div style="flex:1"> charts </div>
  <div> takeaway text </div>               <!-- squeezed to 0px! -->
</div>

<!-- CORRECT: protect text with min-height -->
<div style="display:flex; flex-direction:column; height:400pt;">
  <div style="flex:1"> charts </div>
  <div style="min-height:50pt"> takeaway text </div>
</div>

<!-- ALSO CORRECT: use explicit heights for all children -->
<div style="display:flex; flex-direction:column; height:400pt;">
  <div style="height:340pt"> charts </div>
  <div style="height:60pt"> takeaway text </div>
</div>
```

Pre-flight check 53 blocks `flex:1` stacking. Runtime check promotes >15px overflow to BLOCKING ERROR.

### Overlap Prevention — WRONG vs CORRECT

```html
<!-- WRONG: SVG and text in flex row with no gap → OVERLAP (BLOCKING ERROR) -->
<div style="display: flex;">
  <svg style="width: 60%;" ...></svg>
  <div style="flex: 1;"><p>Text content</p></div>
</div>

<!-- CORRECT: explicit gap prevents overlap -->
<div style="display: flex; gap: 8pt;">
  <svg style="width: 55%;" ...></svg>
  <div style="flex: 1;"><p>Text content</p></div>
</div>

<!-- WRONG: annotation box overlapping container header → FAIL -->
<div style="position: absolute; top: 0;">Annotation</div>

<!-- CORRECT: annotation starts below header (≥6px gap) -->
<div style="position: absolute; top: 35pt;">Annotation</div>
```

The pipeline detects static-flow overlaps automatically. Add `gap: 8pt` to ALL flex containers with 2+ children.

- Bullet list grouping: NEVER use `justify-content: space-between` or `space-around` to spread bullets. Bullets must be grouped together with consistent `margin-bottom` spacing (6-8pt between items).
- If bullet items have significant space between them (>2x normal line-height), add a visual separator: `border-top: 1px dashed var(--brand-gray-dark); margin: 8pt 0;` between items.
- To fill panel space without spreading bullets: increase font size, increase line-height, narrow the panel, or increase padding — never spread the bullets.
- Bullet line-height: 1.35-1.45 (not higher — 1.55 creates too much internal space, making items look like paragraphs)
- Bullet margin-bottom: 6-8pt between items (not 16pt — generous spacing makes items look like separate paragraphs, not a list)
- If bullet text wraps to 5+ lines, it's a paragraph — use bold lead-in + numbered format, or use dashed separators between items. Do NOT put a bullet marker on a full paragraph.

### Sub-Bullets (Nested / Secondary Points)

When a bullet has supporting sub-points, render them as nested sub-bullets:

```html
<li style="font-size: 10px; margin-bottom: 6pt; padding-left: 14pt; position: relative;">
  <span style="position: absolute; left: 0;">&#9632;</span>
  <strong>Main point</strong> with supporting detail
  <ul style="list-style: none; padding: 0; margin: 4pt 0 0 0;">
    <li style="font-size: 9px; margin-bottom: 3pt; padding-left: 12pt; position: relative;">
      <span style="position: absolute; left: 0;">&#8211;</span>
      Sub-point with en-dash marker
    </li>
  </ul>
</li>
```

Rules:
- Sub-bullet marker: en-dash `&#8211;` (NEVER same marker as parent — visual hierarchy requires different shapes)
- Font size: 1px smaller than parent bullet
- Indent: 12pt left padding from parent text edge
- Spacing: 3-4pt between sub-bullets (tighter than parent 6pt)

### Consistent Positioning for Aligned Labels

When labels, timing text, or annotations sit alongside repeating elements (columns, rows, curve segments):
- ALL corresponding labels MUST share the SAME vertical (or horizontal) position.
- Use a single CSS `top` or `bottom` value applied to ALL, not per-element y-offsets.
- Example: if timing labels sit below 3 curves, ALL 3 must have the same `top` value, even if the curves have different heights — use the lowest curve's bottom + consistent gap.
- Labels at inconsistent positions = MAJOR misalignment.

## 9. Tables & Grids

McKinsey tables NEVER use full cell outlines or solid grid borders.

### Structural Requirements (MANDATORY)

- Column headers are MANDATORY structural elements — they define what each column represents.
- A table or grid layout WITHOUT its column header row = INCOMPLETE. Never omit headers.
- Row headers (if present in inspiration) MUST use consistent sizing across ALL rows: same width, same padding, same font size. Inconsistent row header sizes = visual chaos.
- Headers MUST persist across ALL iterations. Removing headers = BLOCKING REGRESSION.
- The pre-flight `[STRUCTURE]` inventory counts headers — compare between versions.
- Gradient indicator shapes (e.g., "High → Low intensity" arrows): If the inspiration shows a non-rectangular gradient shape (triangles meeting in middle, tapered arrows, wedge shapes), implement as SVG with `<linearGradient>`, NOT as a CSS rectangle with `background: linear-gradient(...)`. CSS rectangles cannot produce non-rectangular shapes. This follows the same principle as Rule 22 (SVG shape fidelity).

### Row Separation
- Between rows: `border-bottom: 1px dashed var(--brand-gray-medium)` — dashed, gray, subtle
- Header row bottom: `border-bottom: 2px solid var(--brand-primary)` — heavier, solid, distinct
- NEVER use solid borders on all cells — this creates a spreadsheet look, not a McKinsey look

### Column Separation
- Preferred: light colored background per column (alternating `var(--brand-surface-light)` / transparent)
- Alternative: no column borders at all — let whitespace separate columns
- If text is too close between columns: use a container per column with internal padding
- NEVER use solid vertical lines between columns

### Row Header Labels (Sidebar Pattern)
When a grid/matrix has row labels (entity names, categories, themes), style them as colored sidebar rectangles:

```html
<div style="background: var(--brand-primary); padding: 8pt 10pt; display: flex; align-items: center;">
  <p style="margin: 0; font-size: 10px; font-weight: bold; color: white;">Label</p>
</div>
```

Rules:
- Background: `var(--brand-primary)` (navy) for primary labels, `var(--brand-secondary)` for secondary
- Text: white, bold, centered vertically
- Width: 8-15% of content area or 60-80pt fixed
- The row header color should be consistent across all rows (same color = same visual weight)

### Column Header Labels
- Background: `var(--brand-surface-light)` or gradient simulation
- Text: bold, `var(--brand-primary)`
- Must align precisely with the column content below (same left/right edges)

**Box-model alignment**: When header and content use fixed widths, total width including padding must match. If header has `width: 72pt; padding: 8pt 6pt`, padding is INSIDE by default — visual width is 72pt but usable content is narrower. Fix:
- Use `box-sizing: border-box` on fixed-width elements with padding
- OR use identical padding values on header and content
- OR use flex-based proportional widths instead of fixed widths

### Complete Grid Row Reference Pattern

Use this as a copy-paste template for grid/matrix layouts:

```html
<!-- REFERENCE: Complete grid row with colored row-header + alternating column backgrounds -->
<div style="display: flex; border-bottom: 1px dashed var(--brand-gray-medium);">
  <!-- Row header: colored rectangle, white text -->
  <div style="width: 80pt; min-width: 80pt; background: var(--brand-primary); display: flex; align-items: center; padding: 6pt 8pt;">
    <p style="margin: 0; font-size: 10px; font-weight: bold; color: white; line-height: 1.3;">Row Label</p>
  </div>
  <!-- Content columns: alternating backgrounds, NO vertical borders -->
  <div style="flex: 1; padding: 5pt 8pt; background: var(--brand-surface-light);">
    <p style="margin: 0; font-size: 9px; line-height: 1.35;">Column 1 content</p>
  </div>
  <div style="flex: 1; padding: 5pt 8pt;">
    <p style="margin: 0; font-size: 9px; line-height: 1.35;">Column 2 content</p>
  </div>
  <div style="flex: 1; padding: 5pt 8pt; background: var(--brand-surface-light);">
    <p style="margin: 0; font-size: 9px; line-height: 1.35;">Column 3 content</p>
  </div>
</div>
```

### Row Header ↔ Content Alignment

When a slide has row labels on the left and a content grid to the right, use row-based layout (each row = ONE flex container holding both sidebar label AND content columns):

**CORRECT** — Single-row layout (guaranteed alignment):
```html
<div style="display: flex; border-bottom: 1px dashed var(--brand-gray-medium);">
  <div style="width: 80pt; background: var(--brand-primary); padding: 5pt 8pt;">
    <p style="color: white; font-weight: bold;">Row Label</p>
  </div>
  <div style="flex: 1; padding: 4pt 8pt;">Content col 1</div>
  <div style="flex: 1; padding: 4pt 8pt;">Content col 2</div>
</div>
```

**WRONG** — Split-column layout (sidebar and content as separate flex columns that try to match heights via flex ratios). These DRIFT in PPTX because borders, padding, and rounding accumulate differently in each column.

**FORBIDDEN patterns** (pre-flight checks flag these):
- `border-left: 1px dashed ...` on grid cells — use column backgrounds instead
- `border-right: 1px solid ...` on grid cells — no vertical borders at all
- Row header without `background` — must be colored rectangle, not plain text
- Row header with dark text on light background — must be white text on brand-primary

### Common Grid Mistakes (BLOCKING)

The pre-flight validator catches these automatically. Fix them in HTML before generating.

| Mistake | What You Wrote | What You Should Write | Error |
|---------|---------------|----------------------|-------|
| Plain text row header | `<div style="padding: 8pt;"><p>Label</p></div>` | `<div style="background: var(--brand-primary); padding: 8pt;"><p style="color: white; font-weight: bold;">Label</p></div>` | `[TABLE] Grid row header has no background` (BLOCKING) |
| Vertical borders on cells | `border-left: 1px dashed gray` | Remove border-left/right entirely. Use `background: var(--brand-surface-light)` on alternating columns | `[TABLE] Grid row has N children with vertical borders` |
| Grey row headers | `background: var(--brand-gray-light)` | `background: var(--brand-primary)` with `color: white` | Visual: wrong, should be colored |
| Thin squeezed cells | `padding: 2pt` | `padding: 5pt 8pt` minimum | Text touches borders |

## 10. Separators

| Property | Required Value | WRONG Value | Error |
|----------|---------------|-------------|-------|
| Border width | `1px` | `2px`, `3px`, any > 1px | `[SEPARATOR] border-width Npx (max 1px)` (BLOCKING if > 3px) |
| Border style | `dashed` | `solid` (auto-fixed to dashed at runtime) | Warning + auto-fix |
| Border color | `var(--brand-gray-medium)` | `var(--brand-primary)`, `var(--brand-text)`, any dark color | `[SEPARATOR] uses dark color` (WARNING) |
| Margin | `≥12pt` on both sides | `6pt`, `4pt`, any < 12pt | Warning + auto-fix |

```html
<!-- CORRECT -->
<div style="border-bottom: 1px dashed var(--brand-gray-medium); margin: 12pt 0;"></div>

<!-- WRONG — thick dark separator (BLOCKING ERROR if > 3px) -->
<div style="border-bottom: 3px solid var(--brand-primary); margin: 4pt 0;"></div>
```

Rules:
- ALWAYS dashed, NEVER solid (solid lines are for structural borders, not separators)
- Color: subtle grey ONLY — dark colors make separators look like structural borders
- Separators are visual breathing room, not visual emphasis
- If the inspiration shows a non-standard separator (zigzag, wavy, colored thick bar), replace it with the standard dashed line — McKinsey standardization overrides decorative inspiration elements
- Exception: if the separator carries specific meaning (e.g., a colored band indicating a phase transition), reproduce it faithfully

## 11. SVG Shape Standards

### Multi-Shape Fidelity
- Multi-shape diagrams: If the inspiration shows N distinct shapes (3 overlapping curves, 5 concentric circles, 4 stacked chevrons), the output MUST contain exactly N SVG elements. Collapsing N shapes into 1 simplified shape = BLOCKING identity error.
- Each distinct curve MUST be a separate `<path>` element. A single `<line>` is NEVER acceptable for multiple curved `<path>` elements.

### Curve Direction (Concavity)
- A curve that dips downward (∪ valley / concave-up) ≠ one that rises upward (∩ hill / convex-up).
- Match the EXACT direction from the inspiration. Document it in VSD as `concave-up` or `convex-up`.
- In SVG: verify quadratic/cubic bezier control points produce the documented direction.
- If the VSD says `concave-up` but your path renders as `convex-up`, flip the control point y-coordinates.
- Wrong curve direction = BLOCKING identity error (same severity as wrong shape count).

### Depth / 3D Effects
- If inspiration shows 3D-style shapes (gradients, shadows, perspective tapering), reproduce with SVG `<linearGradient>` or `<radialGradient>`. Flat single-color fill ≠ gradient depth.
- Example pattern (use hex values from `branding/mckinsey.json`):
  ```html
  <defs>
    <linearGradient id="depth-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="{brand-secondary hex from branding JSON}"/>
      <stop offset="100%" stop-color="{brand-primary hex from branding JSON}"/>
    </linearGradient>
  </defs>
  <path d="..." fill="url(#depth-grad)"/>
  ```
- For 3D diagrams (funnels, pyramids, cones): use lighter-to-darker gradient per face, brand palette colors from branding JSON, subtle stroke boundaries.

### Stepped/Ascending Lines
For ascending stepped lines (staircase pattern with horizontal + vertical segments):
- viewBox height MUST be ≥ 40% of viewBox width for steps to be visible
- Each step's vertical segment MUST be ≥ 15% of total viewBox height
- Use `<polyline>` or `<path>` with explicit L commands for horizontal and vertical segments
- WRONG: `viewBox="0 0 600 18"` → steps collapse to flat line (18 is 3% of 600)
- CORRECT: `viewBox="0 0 600 120"` → steps clearly visible as ascending staircase (120 is 20% of 600)
- If phase labels should ASCEND with the line, position each label at the step's y-coordinate
- Use `stroke-width: 2.5` or thicker so the line is clearly visible against the background

**SVG Faithfulness**: SVGs must be as faithful as possible to the inspiration shape. Use curve commands (C/S/Q/A) for organic shapes, `linearGradient` for gradient fills, correct `viewBox` proportions. Study the inspiration in great detail before writing SVG code. Straight-line approximation of curves = BLOCKING.

## 12. Visual Connection Elements

Every visual connection in the inspiration MUST be reproduced. If the inspiration shows a line connecting A to B, your HTML must have an SVG `<line>` or CSS border element connecting them. Omitting connections = FAIL.

### 8 Connection Types

| Type | Use Case | When Required |
|------|----------|---------------|
| **A: Dashed vertical connector** | Linking diagram zone to description zone below | Process diagram + description, funnel + descriptions |
| **B: Arrow connector** | Linking two panels or showing flow direction | Chevron/arrow BETWEEN panels (not inside) |
| **C: Leader line** | Connecting callout box to chart data point | Callout annotations near chart data |
| **D: Reference line** | Threshold/average across chart | Dashed horizontal/vertical reference lines |
| **E: Aligned connector** | Connector aligned to specific diagram elements | Funnel-to-description alignment, element-specific links |
| **F: Annotation bracket** | Grouping bars/elements under a label | Stacked-bar segment grouping, category brackets |
| **G: Gradient ribbon** | Diagonal colored band linking chart segment to insight panel | Data-breakdown slides with side insight panels |
| **H: Extended leader line** | Long line from callout box to distant data point | Callouts positioned far from their data reference |

### Type A — Dashed Vertical Connector

```html
<!-- CORRECT: Vertical dashed connectors linking diagram columns to description columns -->
<div style="display: flex;">
  <div style="flex: 1; display: flex; justify-content: center;">
    <div style="width: 0; height: 12pt; border-left: 1.5px dashed var(--brand-gray-medium);"></div>
  </div>
  <div style="flex: 1; display: flex; justify-content: center;">
    <div style="width: 0; height: 12pt; border-left: 1.5px dashed var(--brand-gray-medium);"></div>
  </div>
</div>

<!-- WRONG: No connectors between diagram and description zones -->
```

### Type B — Arrow Connector (Between Panels)

```html
<!-- CORRECT: SVG arrow BETWEEN two panels, not inside either panel -->
<div style="display: flex; align-items: center; gap: 8pt;">
  <div style="flex: 1;"><!-- Left panel --></div>
  <svg width="30" height="40" viewBox="0 0 30 40">
    <polygon points="0,0 30,20 0,40" fill="#A2AAAD"/>
  </svg>
  <div style="flex: 1;"><!-- Right panel --></div>
</div>

<!-- WRONG: Arrow SVG nested INSIDE a panel row — it's not a connector if it's inside content -->
```

**COMMON MISTAKE**: Nesting the arrow/chevron inside one of the panels. The arrow MUST be a sibling of both panels in the flex container — NOT a child of either panel. See rule 38 in sub-agent-instructions.md.

### Type C — Leader Line (Callout to Data)

```html
<!-- CORRECT: SVG line connecting a callout box to its chart data point -->
<svg style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5;">
  <line x1="180" y1="60" x2="280" y2="120" stroke="#A2AAAD" stroke-width="1.5" stroke-dasharray="4,3"/>
</svg>

<!-- WRONG: Callout box floating near data with NO line connecting them -->
```

**NOTE**: This is COMPATIBLE with rule 37 in sub-agent-instructions.md. Rule 37 bans CSS `position:absolute` DIVs on charts — it does NOT ban SVG `<line>`/`<path>` overlays. SVG leader lines are REQUIRED when the inspiration shows connections between callout boxes and chart data.

### Type D — Reference Line (Use ECharts markLine)

```js
// CORRECT: Use ECharts markLine — tracks chart coordinates automatically
markLine: {
  data: [{ yAxis: 47 }],
  lineStyle: { type: 'dashed', color: '#A2AAAD', width: 1.5 },
  label: { show: false },
  symbol: 'none'
}

// WRONG: CSS position:absolute div overlay — doesn't track chart coordinates
// <div style="position: absolute; top: 36%; border-top: 1px dashed gray;"></div>
```

### Type E — Aligned Connector

When connectors bridge a diagram zone (like a funnel) to description boxes, the connectors MUST align with the diagram's internal elements — NOT be evenly distributed. Calculate connector positions from the diagram's element coordinates.

```html
<!-- CORRECT: Connectors positioned to match funnel plate positions -->
<div style="display: flex; position: relative;">
  <div style="position: absolute; left: 170px;"><div style="width: 0; height: 14pt; border-left: 1.5px dashed var(--brand-gray-medium);"></div></div>
  <div style="position: absolute; left: 310px;"><div style="width: 0; height: 14pt; border-left: 1.5px dashed var(--brand-gray-medium);"></div></div>
  <div style="position: absolute; left: 430px;"><div style="width: 0; height: 14pt; border-left: 1.5px dashed var(--brand-gray-medium);"></div></div>
</div>

<!-- WRONG: Evenly-distributed flex:1 connectors that don't match diagram positions -->
```

### Type F — Annotation Bracket

```html
<!-- CORRECT: SVG bracket grouping chart segments with a label -->
<svg style="position: absolute; left: 120px; top: 30px; width: 80px; height: 60px;">
  <path d="M0,0 L0,55 L80,55 L80,0" fill="none" stroke="#1E3A5F" stroke-width="1.5"/>
  <text x="40" y="48" text-anchor="middle" font-size="9" fill="#1E3A5F">Category group</text>
</svg>

<!-- WRONG: No visual grouping — annotation just floats near target segments -->
```

### Type G — Gradient Ribbon Connector (Chart Segment to Insight Panel)

When a data-breakdown slide has a stacked bar chart on the left and insight panels on the right, the inspiration may show diagonal colored bands (gradient ribbons) linking each bar segment to its corresponding insight panel. These are NOT decorative — they carry the segment-to-insight mapping.

```html
<!-- CORRECT: SVG gradient ribbon connecting chart area to insight panel -->
<svg style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2;">
  <defs>
    <linearGradient id="ribbon-1" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#1E3A5F" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#1E3A5F" stop-opacity="0.03"/>
    </linearGradient>
  </defs>
  <!-- Polygon from bar segment right edge to panel left edge -->
  <polygon points="barRight,segTop barRight,segBottom panelLeft,panelTop panelLeft,panelBottom"
           fill="url(#ribbon-1)"/>
</svg>

<!-- WRONG: No visual link between chart segments and insight panels -->
```

Rules:
- Each ribbon's color MUST match the bar segment it connects (same hex)
- Use `linearGradient` from 15% opacity to 3% opacity (visible but not overwhelming)
- The SVG MUST use `pointer-events: none` to not interfere with chart interaction
- Ribbon is an SVG overlay on the Container Box — allowed per rule 37 exception (no text content in the SVG)

### Type H — Extended Leader Line (Callout to Distant Data)

When a callout box is positioned far from the chart data it references, the leader line MUST span the full distance. A short stub line (25px) that doesn't reach the data is NOT a leader line.

```html
<!-- CORRECT: Leader line spans from callout box edge to actual data point -->
<svg viewBox="0 0 340 175" style="position: absolute; ...">
  <line x1="245" y1="15" x2="230" y2="28" stroke="#A2AAAD" stroke-width="1.5" stroke-dasharray="4,3"/>
</svg>

<!-- WRONG: Stub line only 25px long — doesn't reach from callout to data -->
<svg viewBox="0 0 340 175" ...>
  <line x1="175" y1="42" x2="200" y2="28" ... />   <!-- 25px is NOT a leader line -->
</svg>
```

Rules:
- Minimum leader line length: 30% of chart width, OR direct endpoint-to-data connection
- Line MUST start from the callout box's nearest edge and end at (or very near) the data point
- If the callout is at x=280 and the data is at x=150, the line goes from ~280 to ~150 — not 25px
- Use `stroke-dasharray="4,3"` for dashed style (matching Type C conventions)

### Callout Box Leader Line Requirement

When observation callout boxes appear adjacent to a chart, each callout MUST have a leader line (Type C) connecting it to the specific chart data it references. N callout boxes = N leader lines. Leader lines are NOT optional — even when callout text mentions data labels by name. The viewer needs the visual link to see WHICH data the callout describes.

- WRONG: 3 callout boxes floating next to chart with no lines connecting them to data points
- CORRECT: 3 callout boxes, each with a dashed leader line from box edge to the specific bar/segment it references

### Connection Rules

- One connector per column correspondence (Type A)
- Style: `border-left: 1.5px dashed var(--brand-gray-medium)` for CSS connectors, `stroke-dasharray="4,3"` for SVG
- Connectors are structural elements — dropping them between iterations = BLOCKING REGRESSION
- The pre-flight validator counts connectors in `[STRUCTURE]` and flags missing connectors via check 29
- Every connection in the inspiration must appear in the VSD connection inventory (IMP-05) AND in the HTML
- Gradient ribbons (Type G) are SVG overlays — they are compatible with rule 37 because they contain no text
- Extended leader lines (Type H) must span the full distance — a short stub is NOT a connection

## 13. Language Consistency

All text on a slide must be in the same language as the inspiration content.

- If the inspiration is in French, ALL generated text must be in French — including standard headings like "Insights" (→ "Points clés"), "Key Takeaways" (→ "Points à retenir"), "Source" (→ "Source"), "Next Steps" (→ "Prochaines étapes").
- If the inspiration is in English, all text must be in English.
- The pre-flight validator flags common English headings on French slides.
- Mixed-language slides = FAIL (unless the inspiration intentionally mixes languages, e.g., technical terms).

## 14. Color Selection for Sidebars and Labels

When the inspiration shows colored sidebar boxes, icon containers, or category labels:

| Inspiration Shows | Use | DON'T Use |
|-------------------|-----|-----------|
| Dark/colored sidebar (navy, teal, dark blue) | `var(--brand-primary)` or `var(--brand-secondary)` | `var(--brand-gray-*)` — grey sidebars look washed out |
| Light background panel | `var(--brand-surface-light)` | `var(--brand-gray-light)` — too visible |
| Icon/badge container | `var(--brand-primary)` with white content | Grey with dark content |
| Category label (row header) | `var(--brand-primary)` white bold text | Plain text without background |

**The pre-flight validator BLOCKS generation when >=3 grey sidebar containers and 0 brand-primary containers are detected.** If the inspiration shows colored boxes, yours must be colored too.

## 15. ECharts Annotation Patterns

Chart annotations (reference lines, callout labels, highlight regions) MUST use ECharts native features. NEVER use CSS `position:absolute` divs overlaying a chart — CSS overlays DON'T track chart coordinates and WILL misalign.

### 15.1 Reference/Threshold Lines (markLine)

Use `markLine` for horizontal or vertical reference lines — they track chart coordinates automatically.

```js
// CORRECT: ECharts markLine — aligns with chart data automatically
markLine: {
  data: [{ yAxis: 47 }],
  lineStyle: { type: 'dashed', color: '#A2AAAD', width: 1.5 },
  label: { show: false },
  symbol: 'none'
}
```

```html
<!-- WRONG: CSS div overlay — top:36% does NOT correspond to yAxis=47 -->
<div style="position: absolute; top: 36%; left: 20%; width: 38%; border-top: 1px dashed gray;"></div>
```

**Multiple reference lines**: If you need TWO reference lines (e.g., showing a delta/percentage difference between two values), create TWO entries in `markLine.data`. See §15.6 below.

### 15.2 Callout Labels (markPoint)

Use `markPoint` to anchor labels to specific data points.

```js
// CORRECT: markPoint anchored to exact data coordinate
markPoint: {
  data: [{ coord: [4, 50], value: '-40%', symbol: 'pin', symbolSize: 30 }],
  label: { show: true, fontSize: 10, fontWeight: 'bold' }
}
```

### 15.3 Highlight Regions (markArea)

Use `markArea` for background annotation boxes over chart data ranges.

```js
// CORRECT: markArea highlights a range in chart coordinates
markArea: {
  data: [[{ xAxis: 'Perte' }, { xAxis: 'Gain' }]],
  itemStyle: { color: 'rgba(218,227,243,0.15)', borderColor: '#5B9BD5', borderWidth: 1.5 }
}
```

```html
<!-- WRONG: position:absolute HTML divs overlaying chart — they overlap and misalign -->
<div style="position: absolute; left: 13%; top: 40%; width: 25%; background: rgba(218,227,243,0.3); border: 1px solid #5B9BD5;">...</div>
```

**markArea Width Precision**: markArea extends from the LEFT edge of the first category to the RIGHT edge of the last category. For single-bar highlights, use the same category for start and end (`[{ xAxis: 'Bar2' }, { xAxis: 'Bar2' }]`). A markArea wider than its target bars breaks the annotation-to-data relationship — the highlight must snugly cover ONLY the bars it references.

### 15.4 Stacked Bar Label Placement

| Segment Height | Label Strategy |
|----------------|---------------|
| > 30px | `position: "inside"` — label inside the segment |
| 15-30px | `position: "inside"` with `fontSize: 9` |
| < 15px | Suppress label on tiny segments. Use `position: "top"` on topmost series ONLY for total |
| Total values | Place ABOVE the bar using a dedicated invisible series or `markPoint` at bar top |

```js
// CORRECT: Conditional label placement based on segment size
series: [{
  type: 'bar', stack: 'total',
  label: {
    show: true, position: 'inside', fontSize: 10,
    formatter: (params) => params.value > 5 ? params.value : ''  // hide if too small
  }
}]
```

**Total Values Above Stacked Bars**: When the inspiration shows total values centered above each stacked bar, use an invisible top series — NEVER HTML `position:absolute` divs:

```js
// CORRECT: Invisible series for total labels above stacked bars
{
  type: 'bar', stack: 'total',
  data: [42, 45, 48, 50],
  itemStyle: { color: 'transparent', borderWidth: 0 },
  label: { show: true, position: 'top', fontSize: 11,
           fontWeight: 'bold', color: '#333333',
           formatter: (params) => params.value + 'M' },
  emphasis: { disabled: true }, tooltip: { show: false }
}
```

```html
<!-- WRONG: HTML overlays for total labels — don't track chart coordinates -->
<div style="position: absolute; top: 10pt; left: 80pt; font-size: 11px; font-weight: bold;">42M</div>
<div style="position: absolute; top: 8pt; left: 180pt; font-size: 11px; font-weight: bold;">45M</div>
```

The invisible series approach ensures totals are always centered above their bar and move correctly when the chart resizes. The pre-flight validator (check 48) blocks HTML numeric labels on charts.

### 15.5 Fallback: When ECharts Native Annotations Are Insufficient

When markArea text is UNREADABLE (common with: narrow single-bar boxes, long text in non-English languages, overlapping labels), use a HYBRID approach:

1. Keep the `markArea` for the VISUAL HIGHLIGHT (background fill + border) — but set `label: { show: false }` to hide the ECharts-rendered text
2. Place the annotation TEXT in an HTML div OUTSIDE the chart's `data-echarts` container
3. Position the HTML div below or beside the chart, aligned to the annotation region
4. If needed, connect the HTML text to the chart annotation with an SVG leader line (§12 Type C)

This hybrid approach gives you: (a) chart-coordinate-aligned highlighting via markArea, (b) fully readable text via HTML, (c) spatial connection via SVG line.

```html
<!-- CORRECT: Hybrid approach — markArea for visual, HTML for readable text -->
<div style="position: relative;">
  <div data-echarts='{"series":[{"markArea":{"data":[[{"xAxis":"Bar2"},{"xAxis":"Bar3"}]],"itemStyle":{"color":"rgba(218,227,243,0.3)","borderColor":"#5B9BD5"},"label":{"show":false}}}]}'>
  </div>
  <!-- Annotation text below the chart, aligned to markArea region -->
  <div style="display: flex; margin-top: 4pt;">
    <div style="flex: 1;"></div>
    <div style="flex: 1; font-size: 9px; color: var(--brand-primary); text-align: center;">
      Annotation label text here — fully readable
    </div>
    <div style="flex: 1;"></div>
  </div>
</div>
```

```html
<!-- WRONG: Accepting clipped/unreadable markArea labels as "platform constraint" -->
<!-- WRONG: Reducing font to 7-8px to fit inside narrow markArea boxes -->
```

### 15.6 Multiple Reference Lines (Showing Deltas)

When the inspiration shows a DELTA (percentage difference between two values), this requires TWO `markLine` entries — one at each value:

```js
// CORRECT: Two reference lines showing a -40% delta
markLine: {
  data: [
    { yAxis: 62, name: 'High' },
    { yAxis: 30, name: 'Low' }
  ],
  lineStyle: { type: 'dashed', color: '#A2AAAD', width: 1.5 },
  label: { show: false },
  symbol: 'none'
}
```

Add an annotation div showing the delta value (e.g., "-40%") positioned between the two lines. Use an SVG double-headed arrow between the lines if the inspiration shows one.

```
WRONG: Only creating ONE reference line when the inspiration shows TWO
CORRECT: Creating one markLine entry per reference line, each at the correct yAxis value
```

### 15.7 Annotation Spatial Binding (Position Relative to Data)

Annotations (pills, callout boxes, highlight regions) MUST be positioned relative to the
chart data they reference — NOT at arbitrary absolute positions.

**WRONG** — hardcoded absolute position:
```css
/* Pill placed at arbitrary position — doesn't track chart data */
position: absolute; right: 10pt; top: 28pt;
```

**CORRECT** — position derived from data reference:
```css
/* Pill positioned between bars 4 and 5:
   left = grid.left + (4.5 / barCount) * chartWidth
   top = midpoint between bar4.top and bar5.top */
position: absolute; left: calc(65%); top: calc(35%);
```

**SPATIAL BINDING RULE**: For each annotation, you MUST be able to answer:
1. WHAT data does this annotation reference? (e.g., "decline between bar 4 and bar 5")
2. WHERE is that data in the chart grid? (e.g., "x=65% of chart width, y=35% of chart height")
3. Does my annotation position MATCH that location? (e.g., "my annotation is at x=65%, y=35% — YES")

If you cannot answer all 3, the annotation is not spatially bound — it's floating. Floating annotations will be caught by PVG Protocol (rule 42) as BLOCKING.

**Position calculation approach for ECharts**:
- Get grid margins: `grid.left`, `grid.right`, `grid.top`, `grid.bottom`
- Chart content area = total width − grid.left − grid.right
- Bar N position = grid.left + (N / totalBars) × chartContentArea
- Y position for value V = grid.top + (1 − V/maxValue) × chartContentHeight

### 15.8 Growth Column Layout Pattern (for Stacked Bar Charts)

When a stacked bar chart needs growth percentage indicators beside each segment, use a structured flex column BESIDE the chart — NEVER `position: absolute` divs overlaying it. CSS overlays don't track chart coordinates and misalign at different render sizes.

```html
<!-- CORRECT: Growth indicators in a structured flex column BESIDE the chart -->
<!-- ALL columns use flex:N proportions — fills container width automatically -->
<div style="display: flex; gap: 4pt; flex: 1;">
  <!-- Labels column -->
  <div style="flex: 2.5; min-width: 50pt; display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 20pt;">
    <p style="margin: 0; font-size: 9px;">Category A</p>
    <p style="margin: 0; font-size: 9px;">Category B</p>
  </div>
  <!-- Bar 1 -->
  <div style="flex: 2; display: flex; flex-direction: column; justify-content: flex-end; align-items: center;">
    <div style="width: 100%; display: flex; flex-direction: column;">
      <div style="background: var(--brand-primary); height: 40pt;"><!-- segment --></div>
      <div style="background: var(--brand-secondary); height: 30pt;"><!-- segment --></div>
    </div>
    <p style="margin: 2pt 0 0 0; font-size: 9px; font-weight: bold;">2010</p>
  </div>
  <!-- Bar 2 -->
  <div style="flex: 2; display: flex; flex-direction: column; justify-content: flex-end; align-items: center;">
    <!-- same pattern -->
  </div>
  <!-- Growth column: flex column aligned to bar segments -->
  <div style="flex: 3; display: flex; flex-direction: column; padding-bottom: 20pt;">
    <p style="margin: 0 0 4pt 0; font-size: 9px; text-align: center;">Percent growth</p>
    <!-- Values positioned to align with segment centers — NOT space-around -->
    <div style="flex: 1; position: relative;">
      <div style="position: absolute; top: 10%; text-align: center; width: 100%;">+20</div>
      <div style="position: absolute; top: 25%; text-align: center; width: 100%;"><span style="background: var(--brand-primary); border-radius: 10pt; padding: 1pt 8pt; color: white; font-weight: bold;">+460%</span></div>
      <!-- ... each value at position matching its segment center ... -->
    </div>
  </div>
</div>
```

```html
<!-- WRONG: Fixed widths leave massive empty space -->
<div style="display: flex; gap: 4pt;">
  <div style="width: 56pt;"><!-- labels --></div>
  <div style="width: 44pt;"><!-- bar 1 --></div>
  <div style="width: 44pt;"><!-- bar 2 --></div>
  <div style="width: 70pt;"><!-- growth --></div>
  <!-- Total: 214pt in a 612pt container = 35% fill = WRONG -->
</div>
```

```html
<!-- WRONG: Growth ovals as position:absolute divs overlaying chart -->
<div style="position: absolute; right: 10pt; top: 20pt; z-index: 5;">  <!-- BAD -->
  <div style="border: 1.5px solid #1E3A5F; border-radius: 50%;">+20%</div>
</div>
```

Rules:
- Each growth value MUST align vertically with the CENTER of its corresponding bar segment
- Use `position: absolute; top: N%` on each value, where N% matches the segment's vertical center
- WRONG: `justify-content: space-around` — distributes evenly regardless of segment positions
- WRONG: `justify-content: space-between` — same problem
- WRONG: `justify-content: flex-end` with equal gap — spaces evenly from the bottom
- CORRECT: Position each value so it sits at the same vertical level as the middle of its bar segment
- Each growth oval's border/fill color MUST match the chart segment it references
- Filled ovals (background color, white text) for key highlights; outlined ovals for others
- `padding-bottom` on the growth column should match the chart's bottom margin
- Total labels (173, 193-220) should use ECharts `markPoint` on the topmost series, NOT CSS overlays
- This pattern is enforced by check 48 — `position:absolute` divs with text inside chart containers are BLOCKED (EXCEPTION: hybrid overlays using `var(--gfx-N-x/y)` positioning are exempt)

### Category Label Alignment (for CSS div stacked bars)

When a label column sits beside stacked bars, each label must align vertically with the
CENTER of its corresponding bar segment — NOT evenly spaced with uniform line-height.

```html
<!-- WRONG: Uniform line-height doesn't match segment positions -->
<div style="display: flex; flex-direction: column;">
  <p style="line-height: 1.6;">Individual</p>
  <p style="line-height: 1.6;">Medicare</p>
  <p style="line-height: 1.6;">Medicaid</p>
</div>

<!-- CORRECT: Each label positioned at its segment's vertical center -->
<div style="position: relative; flex: 2.5;">
  <p style="position: absolute; top: 5%; margin: 0; font-size: 9px;">Individual</p>
  <p style="position: absolute; top: 25%; margin: 0; font-size: 9px;">Medicare</p>
  <p style="position: absolute; top: 42%; margin: 0; font-size: 9px;">Medicaid</p>
  <!-- top% calculated from segment center positions in the bar -->
</div>
```

Rules:
- Each label's vertical center must match the vertical center of its bar segment
- Use `position: absolute; top: N%` where N% is calculated from the segment's position in the bar
- WRONG: uniform `line-height` on all labels — this evenly distributes them regardless of segment sizes

### 15.9 Chart Annotations — Delta Pills & Callout Boxes (v4.7.1)

**Use NATIVE ECharts features for delta pills and callout boxes.** Do NOT use `graphic` groups
or HTML overlay divs — they cause auto-flip cascades, dual-move drift, and DETACHED warnings.

#### DELTA PILLS → markLine Two-Point Mode

Use markLine's two-point syntax. Two data pairs: (1) horizontal reference line, (2) vertical arrow with pill label.

```json
"markLine": {
  "symbol": ["none", "none"],
  "data": [
    [{"xAxis": "2006", "yAxis": 62}, {"xAxis": "2012", "yAxis": 62}],
    [{"xAxis": "2012", "yAxis": 62, "symbol": "none"},
     {"xAxis": "2012", "yAxis": 31, "symbol": "arrow",
       "label": {"formatter": "-40%", "backgroundColor": "var(--brand-surface-light)",
                 "borderRadius": 12, "padding": [4, 10], "color": "var(--brand-primary)",
                 "fontSize": 13, "fontWeight": "bold", "position": "middle"}}]
  ],
  "lineStyle": {"color": "var(--brand-primary)", "type": "dashed", "width": 1.5}
}
```

Full pattern details: `html2pptx.md` (Chart Annotations section) §3.

#### CALLOUT BOXES → $callouts on Series

Add `$callouts` array to series. Pipeline generates label + labelLayout + labelLine automatically.

```json
"series": [{
  "type": "line",
  "data": [100, 110, 130, 100, 300, 1800, 800],
  "$callouts": [
    {"dataIndex": 5, "text": "Peak caused by\nexport quotas", "position": "left", "offsetX": -200},
    {"dataIndex": 6, "text": "Drop from demand\ndecrease", "position": "left", "offsetX": -200, "offsetY": 20}
  ]
}]
```

Full schema + pipeline details: `html2pptx.md` (Chart Annotations section) §4.

**GRID MARGIN PREREQUISITE**: When using $callouts, you MUST first increase
grid margins to create a callout zone:
- `position: "left"` → set `grid.left ≥ 170` (callout zone on left side)
- `position: "right"` → set `grid.right ≥ 170` (callout zone on right side)
Without adequate margins, offsetX pushes boxes INTO the data area or OUTSIDE
the chart entirely. This is the #1 cause of callout-data overlap.

All colors as `var(--brand-*)` — `render_echarts.mjs` resolves automatically.

See §3.5D (APA framework) in `sub-agent-instructions.md` for the mandatory Annotation Table.

### 15.10 Custom Series for Data-Driven Annotations

Use `custom` series with `renderItem` for shapes that must align precisely with data coordinates:

```json
{
  "type": "custom",
  "renderItem": "function(params, api) { ... }",
  "data": [...],
  "encode": { "x": 0, "y": 1 }
}
```

Key APIs:
- `api.coord([x, y])` — convert data values to pixel position
- `api.size([xSpan, ySpan])` — convert data range to pixel size
- Return `{ type: 'group', children: [...] }` for composite shapes

Use `var(--brand-*)` for all colors in renderItem return values.

### 15.11 Rich Text Labels

Use the `rich` property on labels for inline formatted fragments (pills, badges):

```json
{
  "label": {
    "formatter": "{value|{c}} {badge|+12%}",
    "rich": {
      "value": { "fontSize": 11, "color": "var(--brand-text)" },
      "badge": { "fontSize": 9, "backgroundColor": "var(--brand-positive)",
                 "color": "#FFFFFF", "borderRadius": 8, "padding": [2, 6, 2, 6] }
    }
  }
}
```

### 15.12 Label Collision Avoidance

Use ECharts built-in label overlap handling:

- `labelLayout: { hideOverlap: true }` — auto-hide overlapping labels
- `labelLayout: { moveOverlap: 'shiftY' }` — shift labels vertically to avoid overlap

### 15.13 Annotation Decision Tree (Quick Reference)

| Annotation Type | Technique (v4.7.1) | Example |
|----------------|-------------------|---------|
| Data value (total, %) | `markPoint` / series `label` / invisible top series | "42M" above bar |
| Reference line | `markLine` single-point | Dashed threshold at y=47 |
| Highlight region | `markArea` | Blue band over bar range |
| **Callout box** | **`$callouts` on series** (pipeline generates label + labelLayout + labelLine) | Box pointing to data |
| **Delta pill** | **`markLine` two-point mode** (horiz line + vertical arrow with pill label) | "-40%" pill with arrow |
| Formatted label | rich text `label` with `rich` | Colored badge |
| Custom decorative shape | `graphic` + percentage positioning | Logo, bracket |

**KEY RULE**: Delta pills and callout boxes use NATIVE ECharts features. See §15.9 + `html2pptx.md` (Chart Annotations section) §3-§4.

### 15.14 Chart Panel Structure (Standard Pattern)

Every chart panel follows this structure — a bordered container with a header bar and a flex-column chart body:

```html
<div style="flex: 1; border: 1.5px solid var(--brand-surface-light); display: flex; flex-direction: column; overflow: hidden;">
  <!-- Header bar (fixed height) -->
  <div style="background: var(--brand-surface-light); padding: 6pt 14pt; min-height: 32pt; display: flex; flex-direction: column; justify-content: center;">
    <p style="margin: 0; font-size: 11px; font-weight: bold; color: var(--brand-primary);">Chart Title</p>
    <p style="margin: 2pt 0 0 0; font-size: 9px; color: var(--brand-gray-dark);">Unit label</p>
  </div>
  <!-- Chart body (takes remaining space) -->
  <div style="flex: 1; position: relative; padding: 0pt 6pt; display: flex; flex-direction: column;">
    <p style="margin: 0; font-size: 9px; color: transparent;">Accessible chart description</p>
    <div data-echarts='{...}' style="width: 100%; flex: 1;"></div>
  </div>
</div>
```

Key rules:
- The **transparent `<p>`** is an accessibility spacer — invisible but provides a text fallback. Check 53 exempts transparent text from FLEX-STACK validation.
- The **`data-echarts` div** uses `flex: 1` to fill remaining height.
- The **header bar** uses `min-height: 32pt` so it doesn't get squeezed.
- The **outer container** uses `overflow: hidden` to clip any excess.
- **Chart sizing**: The `data-echarts` div should ALWAYS use `flex: 1`. Prefer `flex: 1` for the parent container too. Use explicit height on the parent ONLY when multiple charts need precise height ratios. NEVER set explicit height on the data-echarts div directly.
- If charts overflow, reduce the parent row height — do NOT shrink fonts.

### 15.15 Line Style Transitions (Solid → Dashed)

When a series transitions from solid to dashed (e.g., actual data → forecast), implement it
as **two separate series sharing one overlapping data point** at the transition boundary:

```json
{
  "series": [
    {
      "name": "Series A (actual)",
      "type": "line",
      "data": [100, 110, 125, 135],
      "lineStyle": { "type": "solid", "width": 2 },
      "color": "var(--brand-primary)",
      "showSymbol": false
    },
    {
      "name": "Series A (forecast)",
      "type": "line",
      "data": [null, null, null, 135, 150, 163],
      "lineStyle": { "type": "dashed", "width": 2 },
      "color": "var(--brand-primary)",
      "showSymbol": false
    }
  ]
}
```

Key rules:
- The **last data point** of the solid series and the **first non-null data point** of the dashed series must be the SAME value at the SAME xAxis position. This creates a seamless visual join.
- Use `null` padding in the dashed series for positions before the transition.
- Both series share the SAME `color` so they appear as one continuous line.
- Set `showSymbol: false` on both (unless the inspiration shows data point markers).
- The legend should show only ONE entry per visual line. Use the same `name` for both series, or hide one from the legend with `legendHoverLink: false` + omit from legend data.

**Alternative: visualMap approach** (for simple cases):

```json
{
  "visualMap": {
    "show": false,
    "dimension": 0,
    "pieces": [
      { "gte": 0, "lt": 3, "lineStyle": { "type": "solid" } },
      { "gte": 3, "lineStyle": { "type": "dashed" } }
    ]
  }
}
```

The split-series approach is preferred because it's more explicit and works reliably with all ECharts features (markLine, markPoint, labels).

## 16. Quick Reference: Boilerplate Templates

These templates are MANDATORY when the corresponding pattern is needed. Copy-paste exactly, then customize content.

### 16.1 Title + Legend Side-by-Side (see §1 for details)

```html
<div class="title-zone" style="display: flex; flex-direction: row; flex-wrap: nowrap; justify-content: space-between; align-items: flex-start;">
  <h1 style="margin: 0; font-size: 20px; font-weight: bold; color: var(--brand-primary); font-family: var(--brand-font-heading); max-width: 75%; padding-right: 20pt;">Title text here</h1>
  <div style="flex-shrink: 0; min-width: 140pt; display: flex; flex-direction: column; gap: 3pt; align-items: flex-end;">
    <!-- Legend items here -->
  </div>
</div>
```

### 16.2 Hierarchical Bullets (see §3 for details)

```html
<ul style="margin: 0; padding-left: 0; list-style: none;">
  <li style="margin-bottom: 6pt; font-size: 10px; position: relative; padding-left: 14pt;">
    <span style="position: absolute; left: 0;">&#9632;</span><strong>Bold lead</strong> rest of text</li>
  <li style="margin-bottom: 3pt; font-size: 9px; position: relative; padding-left: 26pt;">
    <span style="position: absolute; left: 14pt;">&#8211;</span>Sub-point text here</li>
</ul>
```

### 16.3 Chart Panel with Transparent Spacer (see §15.14 for details)

```html
<div style="flex: 1; position: relative; padding: 0pt 6pt; display: flex; flex-direction: column;">
  <p style="margin: 0; font-size: 9px; color: transparent;">Chart description for spacing</p>
  <div data-echarts='{ "series": [...] }' style="width: 100%; flex: 1;"></div>
</div>
```

### 16.4 Takeaway Box with Bullets (see §3 for details)

```html
<div style="background: var(--brand-primary); padding: 14pt; border-radius: 3pt;">
  <p style="margin: 0 0 6pt 0; font-size: 11px; font-weight: bold; color: white;">Key takeaways</p>
  <div style="height: 1.5pt; background: white; margin-bottom: 8pt;"></div>
  <ul style="margin: 0; padding-left: 14pt; list-style: none;">
    <li style="margin-bottom: 6pt; font-size: 9px; color: white; position: relative; padding-left: 10pt;">
      <span style="position: absolute; left: 0;">&#9632;</span><strong>Bold lead</strong> rest of text</li>
  </ul>
</div>
```

### 16.5 Grid Row with Colored Sidebar (see §9 for details)

```html
<div style="display: flex; border-bottom: 1px dashed var(--brand-gray-medium);">
  <div style="width: 80pt; background: var(--brand-primary); display: flex; align-items: center; padding: 6pt 8pt;">
    <p style="margin: 0; font-size: 10px; font-weight: bold; color: white;">Row Label</p>
  </div>
  <div style="flex: 1; padding: 5pt 8pt;">
    <p style="margin: 0; font-size: 9px; color: var(--brand-text);">Content here</p>
  </div>
</div>
```

## 17. Translation Override Rules (Inspiration → Standard)

When translating an inspiration image into HTML, McKinsey standardization ALWAYS takes precedence over the inspiration's visual treatment. This table lists every case where the standard overrides what the inspiration shows.

### 17.1 Elements to REMOVE

| Inspiration Element | Action | Rationale |
|-------------------|--------|-----------|
| Company logos / brand marks | REMOVE entirely | Copyright + brand compliance |
| Proprietary icons / clip art | REMOVE or replace with colored geometric shape (circle/square) + text label | Cannot reproduce faithfully |
| Stock photos / images | Replace with colored placeholder div: `background: var(--brand-surface-light); display: flex; align-items: center; justify-content: center;` with descriptive text | Copyright |
| Decorative clip art / illustrations | REMOVE. If structural purpose (illustrating a concept), replace with simple geometric SVG | Simplification |
| Watermarks / confidential stamps | REMOVE entirely | Not applicable |
| QR codes / barcodes | REMOVE entirely | Non-functional |

### 17.2 Colors to OVERRIDE

| Inspiration Color | Replace With | Rule |
|------------------|-------------|------|
| Arbitrary grays on KEY shapes (funnels, pyramids, flow boxes) | `var(--brand-primary)` or `var(--brand-secondary)` | §4: Key shapes in brand blues, not gray |
| Red used decoratively (NOT for negative data) | `var(--brand-surface-light)` or `var(--brand-gray-border)` | §4 Tier 3: red ONLY for negative sentiment |
| Green used decoratively (NOT for positive data) | `var(--brand-secondary)` or `var(--brand-tertiary)` | §4 Tier 3: green ONLY for positive sentiment |
| Orange/yellow decorative | `var(--brand-accent)` (gold) if Tier 2 justified, else `var(--brand-gray-dark)` | §4 Tier 2 |
| Non-brand grays (#888, #A0A0A0, #B8B8B8) | Closest brand gray: `var(--brand-gray-dark)`, `var(--brand-gray-medium)`, `var(--brand-surface-light)` | §4: All colors from brand palette |
| Hardcoded hex in CSS | `var(--brand-*)` token | §4: Zero hardcoded colors |

### 17.3 Structure to STANDARDIZE

| Inspiration Shows | Replace With |
|------------------|-------------|
| No border/container around content | ADD Container Box (§2): border + header bar |
| Solid cell borders on table | Dashed row separators + alternating column backgrounds (§9) |
| Thick/colored separator lines | 1px dashed `var(--brand-gray-medium)` (§10) |
| Nested bullet lists | Flat hierarchical list with visual indentation (§3, §16.2) |
| Plain text row headers | Colored sidebar pattern: `background: var(--brand-primary); color: white; font-weight: bold;` (§9, §16.5) |
| Gradient backgrounds / box-shadow / text-shadow | REMOVE (§0 Forbidden CSS) |
| Non-standard footer format | `Nexus | N` format (§7) |
| Zigzag / wavy / ornamental lines | Standard separator OR remove entirely (§10) |

### 17.4 Typography to STANDARDIZE

| Inspiration Shows | Replace With |
|------------------|-------------|
| Any font (Arial, Calibri, Times, custom) | `var(--brand-font-heading)` for H1, `var(--brand-font-body)` for all else |
| Title not 20px bold | 20px bold Georgia `var(--brand-primary)` |
| More than 2 body font sizes | Reduce to max 2 sizes from 9-11px range |
| Source/footnote not 9px | 9px `var(--brand-gray-dark)` |
| Font sizes in pt units | Convert to px |
| Bold everywhere or bold nowhere | Bold-keyword pattern: first 3-8 words of each bullet bold |

### 17.5 Translation Audit Checklist (Phase 1)

Before writing HTML, scan the inspiration and check each item:

| # | Check | Override Needed? | Notes |
|---|-------|-----------------|-------|
| TS-1 | Any logos/brand marks visible? | Remove | |
| TS-2 | Any decorative clip art/photos? | Remove/placeholder | |
| TS-3 | Any non-brand colors on key shapes? | Upgrade to brand | |
| TS-4 | Are content panels missing borders? | Add Container Box | |
| TS-5 | Any non-standard fonts visible? | Replace with brand | |
| TS-6 | Any solid table cell borders? | Dashed rows + alt columns | |
| TS-7 | Any thick/colored separators? | 1px dashed gray | |
| TS-8 | Any nested bullet lists needed? | Flat hierarchical | |
| TS-9 | Any decorative zigzag/wave lines? | Remove or standard sep | |
| TS-10 | Any plain text row headers? | Colored sidebar | |
| TS-11 | Red/green used non-semantically? | Replace per §4 Tier 3 | |
| TS-12 | Any gray key shapes? | Brand blues | |
| TS-13 | Any forbidden CSS (gradient, shadow)? | Remove | |
| TS-14 | Footer format non-standard? | McKinsey format | |
