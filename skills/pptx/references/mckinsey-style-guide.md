# McKinsey Visual Design Standards Reference

A comprehensive guide for creating professional consulting-quality presentations following McKinsey design principles.

---

## 1. Slide Zone Structure

McKinsey slides use a consistent three-zone layout:

```
┌─────────────────────────────────────────────────────────┐
│  HEADER ZONE (~40pt min, expands for 2-line)           │
│  - Section ID: 10px, normal weight, navy               │
│  - Action Title: 18-22px, bold, navy                   │
│  - Subtitle (optional): 12px, gray                     │
├─────────────────────────────────────────────────────────┤
│  BODY ZONE (~325pt single / ~302pt two-line)           │
│  - Visual Groups (content blocks)                       │
│  - Separators between groups                            │
│  - Side padding: 6pt                                    │
├─────────────────────────────────────────────────────────┤
│  FOOTER ZONE (~30pt, y: 375-405pt)                     │
│  - Source: 9px, left-aligned, gray                     │
│  - Page number: 10px, right-aligned, gray              │
│  - Logo: bottom-right corner                            │
└─────────────────────────────────────────────────────────┘
```

### Zone Specifications

| Zone | Height | Y-Position | Content |
|------|--------|------------|---------|
| Header | ~40pt min (expands for 2-line titles) | 0-40pt+ | Section ID, Action Title, Subtitle |
| Body | ~325pt (single-line) / ~302pt (two-line) | 40pt-375pt | Visual Groups, Charts, Content |
| Footer | ~30pt (7-8%) | 375-405pt | Source, Page Number, Logo |

---

## 2. Visual Groups System

### Definition

A **visual group** is a cohesive block that functions as one unit, regardless of how many content types it contains.

### Examples of Visual Groups

- A table with embedded bars = **1 visual group** (not "text column" + "bar column")
- Two side-by-side comparison panels = **2 visual groups**
- Chart with adjacent text callout = **2 visual groups**
- Grid of KPI tiles = **1 visual group** containing sub-elements
- Integrated lever-bar-total table = **1 visual group**

### Documentation Format

```
VISUAL GROUPS:
- Group 1: [description] — position [left/center/right], ~[X]% width
- Group 2: [description] — position [left/center/right], ~[X]% width
- Separators between groups: [none / divider line / whitespace / shape (describe)]
```

### Common Visual Group Patterns

| Pattern | Visual Groups | Separators | Typical Use |
|---------|---------------|------------|-------------|
| Single element | 1 group (full width) | None | Simple charts, frameworks |
| Two-part with implication | 2 groups (e.g., 65:35) | Triangle, arrow, or bracket | Value decomposition with impact |
| Side-by-side comparison | 2 groups (50:50) | Vertical line or whitespace | Before/after, option comparison |
| Primary + context | 2 groups (70:30) | Whitespace | Chart with supporting text |
| Dashboard grid | 1 group with sub-elements | Internal grid lines | KPI displays |

---

## 3. Container/Box System

McKinsey slides heavily use containers (boxes) to organize content. These are critical structural elements.

### 3.1 Container Layout Patterns

| Layout Pattern | Description | Typical Use |
|----------------|-------------|-------------|
| Single full-width | One large box spanning ~90% width | Framing content, visual separation |
| Side-by-side (2-4) | Boxes arranged horizontally | Multi-point arguments, comparisons |
| Containers with connectors | Boxes connected by arrows/triangles | Sequential logic, cause-effect |
| Chevron containers | Arrow-shaped right edge pointing to next | Process steps, sequential flow |
| Bento grid | Asymmetric grid (like bento box) | Case studies, dashboards |
| Nested containers | Box containing smaller boxes | Hierarchical groupings |
| Stacked containers | Boxes arranged vertically | Lists, layered arguments |

### 3.2 Container Properties

#### Fill/Background

| Fill Type | Required Syntax |
|-----------|-----------------|
| White fill | "white #FFFFFF container" |
| Solid color fill | "[color] #XXXXXX container" |
| Light tint fill | "light [color] #XXXXXX container" |
| Transparent/no fill | "outlined container with [color] #XXXXXX border" |

#### Border/Outline

| Border Type | Required Syntax |
|-------------|-----------------|
| No border (default) | (omit border mention) |
| Thin border | "with thin [color] #XXXXXX border" |
| Thick border | "with thick [color] #XXXXXX border" |
| Accent border (one side) | "with [color] #XXXXXX left accent border" |

#### Shadow/Depth

| Shadow Type | Required Syntax |
|-------------|-----------------|
| No shadow (default) | (omit shadow mention) |
| Drop shadow | "with drop shadow" |
| Strong shadow | "with prominent drop shadow" |

#### Corner Style

| Corner Type | Required Syntax |
|-------------|-----------------|
| Square corners (default) | (omit) |
| Rounded corners | "with rounded corners" |
| Pill shape | "pill-shaped" |

### 3.3 Container Header Styles

| Header Style | Required Syntax |
|--------------|-----------------|
| No header | (omit header mention) |
| Color bar header | "[color] #XXXXXX header bar containing '[header:X]' in [text color]" |
| Plain text header | "plain text header '[header:X]' in [color] #XXXXXX" |
| Icon + text header | "[icon:X] in [color] followed by '[header:X]' in [color]" |
| Icon + color bar header | "[color] #XXXXXX header bar with [icon:X] and '[header:X]' in [text color]" |
| Numbered header | "[color] #XXXXXX circle containing '[number]' beside '[header:X]'" |

### 3.4 Connector Types (between containers)

| Connector Type | Required Syntax |
|----------------|-----------------|
| Arrow | "[color] #XXXXXX arrow pointing from [A] to [B]" |
| Triangle | "[color] #XXXXXX triangle between [A] and [B]" |
| Chevron/integrated | "[color] #XXXXXX chevron container pointing right" |
| Line | "[color] #XXXXXX line connecting [A] to [B]" |
| Dashed line | "dashed [color] #XXXXXX line connecting..." |
| Plus sign | "[color] #XXXXXX plus sign between containers" |
| Equals sign | "[color] #XXXXXX equals sign after final container" |

### 3.5 Container Template Examples

#### Single framing container
```html
<div style="position: absolute; left: 6pt; top: 48pt; width: calc(100% - 12pt); height: 325pt;
            background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
  <!-- Content here -->
</div>
```

#### Side-by-side containers with triangle
```html
<div class="container-group" style="display: flex; align-items: center; gap: 8pt;">
  <div style="width: 40%; background: white; padding: 16pt;">
    <div style="background: #00B0F0; padding: 8pt; color: white;">[header:input]</div>
    <!-- content -->
  </div>
  <div style="width: 0; height: 0; border-left: 20pt solid #1E3A5F;
              border-top: 15pt solid transparent; border-bottom: 15pt solid transparent;"></div>
  <div style="width: 40%; background: white; padding: 16pt;">
    <div style="background: #1E3A5F; padding: 8pt; color: white;">[header:output]</div>
    <!-- content -->
  </div>
</div>
```

#### Chevron containers
```html
<div style="display: flex;">
  <div style="width: 22%; background: #1E3A5F; padding: 12pt; color: white;
              clip-path: polygon(0 0, 85% 0, 100% 50%, 85% 100%, 0 100%);">
    Step 1
  </div>
  <div style="width: 22%; background: #1E3A5F; padding: 12pt; color: white; margin-left: -2%;
              clip-path: polygon(0 0, 85% 0, 100% 50%, 85% 100%, 0 100%, 15% 50%);">
    Step 2
  </div>
  <!-- More steps... -->
</div>
```

#### Bento grid
```html
<div style="display: grid; grid-template-columns: 60% 38%; grid-template-rows: 45% 45%; gap: 12pt;">
  <div style="grid-row: 1 / 3; background: white; border: 1px solid #D0D0D0;">Large left panel</div>
  <div style="background: white; border: 1px solid #D0D0D0;">Top-right panel</div>
  <div style="background: white; border: 1px solid #D0D0D0;">Bottom-right panel</div>
</div>
```

### 3.6 Container Rules

1. **Most McKinsey containers have NO visible border** — they rely on white fill against off-white background for definition
2. **White containers are common** — White #FFFFFF containers against off-white #F5F3EF backgrounds are the McKinsey default
3. **Full-color containers signal emphasis** — when a container is fully filled with navy, cyan, or another brand color, it typically indicates an implication, conclusion, or key takeaway
4. **Describe spatial relationships** — always note position, approximate dimensions (% width/height), and gaps between containers
5. **Headers are often the only colored element** — many containers are white with only a colored header bar at the top
6. **Chevrons vs. connectors** — if the arrow is PART of the container shape (chevron), describe it as a chevron container. If the arrow is BETWEEN separate containers, describe it as a connector

---

## 4. Full 4-Level Taxonomy

The slide taxonomy uses a 4-level hierarchy: `{L1}-{L2}-{L3}-{L4}`

Example: `data-ranking-bar-horizontal-bar-chart`

### 4.1 Level 1: Communication Intent (6 Categories)

| L1 | Purpose | Key Signal |
|----|---------|------------|
| `data` | Present quantitative evidence | Charts, KPIs, metrics |
| `narrative` | Tell stories, share insights | Bullets, quotes, case studies |
| `compare` | Evaluate options | Tables, side-by-side, scorecards |
| `structure` | Organize document | Agenda, covers, summaries |
| `explain` | Clarify concepts | Systems, frameworks, hierarchies |
| `flow` | Show processes | Timelines, steps, cycles |

### 4.2 Level 2: Visual Strategy (per L1)

#### DATA L2 Options

| L2 | Purpose |
|----|---------|
| `breakdown` | Show how a whole divides into parts |
| `ranking` | Compare magnitudes across categories |
| `trend` | Show changes over time |
| `correlation` | Show relationships between variables |
| `performance` | Display KPIs and status |

#### NARRATIVE L2 Options

| L2 | Purpose |
|----|---------|
| `text-insight` | Present written analysis |
| `case-study` | Share examples and success stories |
| `diagnostic` | Present assessment findings |
| `quotes` | Feature stakeholder voices |

#### COMPARE L2 Options

| L2 | Purpose |
|----|---------|
| `table` | Structured comparison |
| `side-by-side` | Visual juxtaposition |
| `scenario` | Compare alternatives |
| `gap` | Show current vs target |

#### STRUCTURE L2 Options

| L2 | Purpose |
|----|---------|
| `agenda` | Document navigation |
| `cover` | Opening and transitions |
| `summary` | Synthesize key messages |
| `context` | Set the stage |
| `next-steps` | Define follow-up actions |

#### EXPLAIN L2 Options

| L2 | Purpose |
|----|---------|
| `system` | Systems/architectures |
| `metaphor` | Visual analogies |
| `framework` | Named models |
| `hierarchy` | Hierarchical relationships |
| `matrix` | 2D positioning |

#### FLOW L2 Options

| L2 | Purpose |
|----|---------|
| `timeline` | Temporal sequences |
| `step-by-step` | Sequential process steps |
| `value-chain` | Value creation flows |
| `cycle` | Cyclical processes |
| `funnel` | Filtering/narrowing |

---

## 5. Complete Chart Type Reference (45+ Types)

### 5.1 BAR FAMILY (20 types)

| Type ID | Description | Key Visual Signal | DATA TABLE Header |
|---------|-------------|-------------------|-------------------|
| `bar` | Vertical bars, all start at 0 | Bars anchor to horizontal baseline | `VERTICAL BAR DATA:` |
| `horizontal-bar` | Horizontal bars, all start at 0 | Bars anchor to vertical axis | `HORIZONTAL BAR DATA:` |
| `grouped-bar` | Vertical, multiple series side-by-side | Multiple bars per category | `CLUSTERED BAR DATA:` |
| `horizontal-grouped-bar` | Horizontal, multiple series | Multiple horizontal bars per category | `CLUSTERED BAR DATA:` |
| `stacked-bar` | Vertical, segments stacked | Colored segments touch, no gaps | `STACKED BAR DATA:` |
| `horizontal-stacked-bar` | Horizontal, segments stacked | Horizontal segments touch | `STACKED BAR DATA:` |
| `100-percent-stacked` | Stacked bars all same height | All bars reach same level | `STACKED BAR DATA:` |
| `range-bar` | Vertical, solid + range extension | Solid bar with dashed extension | `HORIZONTAL BAR DATA:` |
| `horizontal-range-bar` | Horizontal, solid + range | Horizontal with dashed extension | `HORIZONTAL BAR DATA:` |
| `diverging-bar` | Extends both directions from center | Bars go up AND down | `DIVERGING BAR DATA:` |
| `horizontal-diverging-bar` | Horizontal, both directions | Bars go left AND right | `DIVERGING BAR DATA:` |
| `gap-bar` | Target vs actual with gap | Two bars per category with gap | `GAP BAR DATA:` |
| `waterfall-variance` | Vertical floating bars (+/-) | Bars float, gaps to baseline | `WATERFALL DATA:` |
| `horizontal-waterfall-variance` | Horizontal floating bars | Horizontal bars float | `WATERFALL DATA:` |
| `waterfall-buildup` | Vertical cumulative | Connected chain, no gaps | `WATERFALL DATA:` |
| `horizontal-waterfall-buildup` | Horizontal cumulative | Horizontal cumulative chain | `WATERFALL DATA:` |
| `waterfall-variance-range` | Floating + dashed range | Floating bars with dashed extensions | `WATERFALL DATA:` |
| `horizontal-waterfall-variance-range` | Horizontal floating + range | Horizontal variant | `WATERFALL DATA:` |
| `waterfall-buildup-range` | Cumulative + range | Cumulative with dashed extensions | `WATERFALL DATA:` |
| `horizontal-waterfall-buildup-range` | Horizontal cumulative + range | Horizontal variant | `WATERFALL DATA:` |

### 5.2 LINE FAMILY (6 types)

| Type ID | Description | Key Visual Signal | DATA TABLE Header |
|---------|-------------|-------------------|-------------------|
| `line` | Single line, no fill | Clean line connecting points | `LINE CHART DATA:` |
| `multi-line` | Multiple lines | Several lines, different colors | `LINE CHART DATA:` |
| `area` | Single filled area below line | Shaded region under line | `AREA CHART DATA:` |
| `stacked-area` | Multiple stacked filled areas | Layered shaded regions | `STACKED AREA DATA:` |
| `step-line` | Right-angle connections | 90° angles, no diagonal slopes | `LINE CHART DATA:` |
| `indexed-line` | All lines start at 100 | Normalized starting point | `LINE CHART DATA:` |

### 5.3 CIRCULAR FAMILY (4 types)

| Type ID | Description | Key Visual Signal | DATA TABLE Header |
|---------|-------------|-------------------|-------------------|
| `pie` | Full circle, filled center | Solid circle divided into wedges | `PIE/DONUT DATA:` |
| `donut` | Full circle, hollow center | Ring shape with hole | `PIE/DONUT DATA:` |
| `semi-donut` | Half circle, hollow | 180° arc ring | `PIE/DONUT DATA:` |
| `nested-donut` | Multiple concentric rings | Rings within rings | `PIE/DONUT DATA:` |

### 5.4 SCATTER FAMILY (4 types)

| Type ID | Description | Key Visual Signal | DATA TABLE Header |
|---------|-------------|-------------------|-------------------|
| `scatter` | Same-size points on X-Y | Uniform dots | `SCATTER/BUBBLE DATA:` |
| `bubble` | Varying-size points | Different diameter circles | `SCATTER/BUBBLE DATA:` |
| `quadrant` | 2×2 grid divisions | Four labeled regions | `QUADRANT PLOT DATA:` |
| `dot-plot` | Categorical Y-axis | Categories on Y, values on X | `DOT PLOT DATA:` |

### 5.5 SPECIALIZED (8 types)

| Type ID | Description | Key Visual Signal | DATA TABLE Header |
|---------|-------------|-------------------|-------------------|
| `gauge` | Arc with needle | Speedometer-like arc | `GAUGE DATA:` |
| `radar` | Radial axes, polygon shape | Spider web pattern | `RADAR DATA:` |
| `treemap` | Varying-sized nested rectangles | Rectangles of different sizes | `TREEMAP DATA:` |
| `heatmap` | Equal-sized grid, color-coded | Uniform cell grid | `HEATMAP DATA:` |
| `funnel` | Narrowing trapezoids top-to-bottom | Progressively narrower | `FUNNEL DATA:` |
| `sankey` | Flowing bands between nodes | Curved ribbons | `SANKEY DATA:` |
| `gantt` | Horizontal bars on date axis | Time-based horizontal bars | `GANTT DATA:` |
| `choropleth` | Geographic map colored by data | Map shapes with color fill | `CHOROPLETH DATA:` |

### 5.6 COMBO (4 types)

| Type ID | Description | Key Visual Signal | DATA TABLE Header |
|---------|-------------|-------------------|-------------------|
| `combo-bar-line` | Simple bars + line | Bars and line together | `COMBO CHART DATA:` |
| `combo-stacked-line` | Stacked bars + line | Stacked bars with overlaid line | `COMBO CHART DATA:` |
| `combo-grouped-line` | Grouped bars + line | Grouped bars with overlaid line | `COMBO CHART DATA:` |
| `combo-area-line` | Area + line | Filled area with separate line | `COMBO CHART DATA:` |

---

## 6. DATA TABLE Formats

Each chart type requires a specific DATA TABLE format.

### HORIZONTAL BAR DATA
```
| Position | Label | Value | Left % | Right % | Color |
|----------|-------|-------|--------|---------|-------|
| 1 | [label:category_1] | [value:bar_1] | 0% | {calc}% | Navy #1E3A5F |
| 2 | [label:category_2] | [value:bar_2] | 0% | {calc}% | Gray #D0D0D0 |
```

### VERTICAL BAR DATA
```
| Position | Label | Value | Bottom % | Top % | Color |
|----------|-------|-------|----------|-------|-------|
| 1 | [label:category_1] | [value:bar_1] | 0% | {calc}% | Navy #1E3A5F |
```

### STACKED BAR DATA
```
| Stack | Segment | Label | Value | Height % | Bottom % | Color |
|-------|---------|-------|-------|----------|----------|-------|
| 1 | a | [label:seg_a] | [value:s1_a] | {calc} | 0% | Navy #1E3A5F |
| 1 | b | [label:seg_b] | [value:s1_b] | {calc} | {prev_top} | Gold #B8975C |
```

### WATERFALL DATA
```
| Position | Label | Value | Top % | Bottom % | Type | Color | Connector |
|----------|-------|-------|-------|----------|------|-------|-----------|
| 1 | [label:cat_1] | [value:bar_1] | 100% | 0% | Total | Navy #1E3A5F | — |
| 2 | [label:cat_2] | [value:bar_2] | {calc} | {calc} | Subtraction | Gray #D0D0D0 | dashed |
| 3 | [label:cat_3] | [value:bar_3] | {calc} | 0% | Remainder | Gold #B8975C | — |
```

### LINE CHART DATA
```
| Point | X Label | Y Value | X % | Y % | Marker | Color |
|-------|---------|---------|-----|-----|--------|-------|
| 1 | [label:point_1] | [value:point_1] | 0% | {calc}% | Circle | Navy #1E3A5F |
```

### PIE/DONUT DATA
```
| Segment | Label | Value | % | Start° | End° | Color |
|---------|-------|-------|---|--------|------|-------|
| 1 | [label:slice_1] | [value:slice_1] | {calc} | 0° | {calc} | Navy #1E3A5F |
```

### SCATTER/BUBBLE DATA
```
| Point | Label | X Value | Y Value | Size | X % | Y % | Quadrant | Color |
|-------|-------|---------|---------|------|-----|-----|----------|-------|
| 1 | [label:point_1] | [value:x_1] | [value:y_1] | [value:size_1] | {calc}% | {calc}% | Top-Right | Navy |
```

### FUNNEL DATA
```
| Stage | Label | Value | Top % | Bottom % | Width % | Color |
|-------|-------|-------|-------|----------|---------|-------|
| 1 | [label:stage_1] | [value:stage_1] | 0% | 25% | 100% | Navy #1E3A5F |
```

### GANTT DATA
```
| Row | Task | Start Date | End Date | Bar Start % | Bar End % | Color |
|-----|------|------------|----------|-------------|-----------|-------|
| 1 | [label:task_1] | [date:start_1] | [date:end_1] | {calc}% | {calc}% | Navy |
```

### HEATMAP DATA
```
| Row | Column | Value | Color Intensity |
|-----|--------|-------|-----------------|
| [label:row_1] | [label:col_1] | [value:r1c1] | [color based on scale] |
```

### GAUGE DATA
```
| Metric | Value | Min | Max | Position % | Arc Start° | Arc End° | Color |
|--------|-------|-----|-----|------------|------------|----------|-------|
| [label:metric] | [value:current] | [value:min] | [value:max] | {calc}% | 180° | 0° | Navy |
```

### QUADRANT PLOT DATA
```
| Point | Label | X Value | Y Value | Quadrant | Color |
|-------|-------|---------|---------|----------|-------|
| 1 | [label:point_1] | [value:x_1] | [value:y_1] | Top-Right | Navy #1E3A5F |
QUADRANT LABELS: Top-Right: [label:TR], Top-Left: [label:TL], Bottom-Right: [label:BR], Bottom-Left: [label:BL]
```

### SANKEY DATA
```
| Flow | Source | Target | Value | Width % | Color |
|------|--------|--------|-------|---------|-------|
| 1 | [label:source_1] | [label:target_1] | [value:flow_1] | {calc}% | Navy |
```

### TREEMAP DATA
```
| Level | Parent | Label | Value | Percentage | Color |
|-------|--------|-------|-------|------------|-------|
| 1 | — | [label:cat_1] | [value:cat_1] | [value:pct_1]% | Navy |
| 2 | [label:cat_1] | [label:sub_1a] | [value:sub_1a] | [value:pct_1a]% | Navy (light) |
```

---

## 7. VISUAL MECHANICS Format

After each DATA TABLE, specify VISUAL MECHANICS:

```
VISUAL MECHANICS:
- Chart type: [The actual chart type — e.g., "Horizontal bar chart"]
- Orientation: [Horizontal / Vertical / Inverted]
- Baseline: [Where bars anchor — 0%, center, floating from previous]
- Bar behavior: [All start at 0 / Segments stacked / Cumulative (waterfall)]
- Argument proven: [COMPOSITION / COMPARISON / TREND / etc.]
- How argument is shown: [Explain how the visual proves the argument]
- Connectors: [Guide lines if any — dashed gray #D0D0D0, solid, none]
- Labels: [Placement — inside bar, outside bar, below axis, at data point]
- Special features: [Range extensions, TOTAL row treatment, etc.]
```

---

## 8. McKinsey Color Palette

```css
:root {
  /* Navy - Primary text and dark elements */
  --mck-navy: #1E3A5F;

  /* Blues - Chart fills, from dark to light */
  --mck-blue-dark: #2E75B6;
  --mck-blue-medium: #5B9BD5;
  --mck-blue-light: #A8C8E8;
  --mck-blue-pale: #D6E6F4;

  /* Grays - Borders, secondary text, backgrounds */
  --mck-gray-dark: #666666;
  --mck-gray-medium: #D0D0D0;
  --mck-gray-light: #F5F3EF;
  --mck-white: #FFFFFF;

  /* Accent colors (use sparingly) */
  --mck-green: #2E7D32;
  --mck-red: #C62828;
  --mck-gold: #B8975C;
}
```

### Standard Palette Reference

| Role | Name | Hex | Usage |
|------|------|-----|-------|
| Primary | Navy | `#1E3A5F` | Titles, headers, primary data |
| Secondary | Gray | `#D0D0D0` | Supporting data, dividers |
| Accent | Gold | `#B8975C` | Highlights, callouts |
| Background | Off-white | `#F5F3EF` | Slide background |
| Text | Dark Gray | `#666666` | Body text, labels |

### Special Applications

| Application | Colors |
|-------------|--------|
| Waterfall | Total=Navy #1E3A5F, Addition=Navy #1E3A5F, Subtraction=Gray #D0D0D0, Remainder=Gold #B8975C |
| Two-Tone | Primary share=Gold #B8975C, Remainder=Gray #D0D0D0 |
| Harvey balls | Navy #1E3A5F fill on Off-white #F5F3EF |
| Text on navy | Off-white #F5F3EF |
| Text on gold | Navy #1E3A5F |
| Multi-series | Series 1=Navy #1E3A5F, Series 2=Gold #B8975C, Series 3=Gray #D0D0D0 |

---

## 9. Typography System

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Section ID | 10px | Normal | Navy #1E3A5F |
| Action Title | 16-24pt | Bold | Navy #1E3A5F |
| Panel Header | 14-16px | Bold | Navy #1E3A5F |
| Panel Subtitle | 11-12px | Normal | Dark Gray #666666 |
| Data Values | 8-14pt | Bold | Navy #1E3A5F |
| Category Labels | 10-12px | Normal | Navy #1E3A5F |
| Axis Labels | 10px | Normal | Dark Gray #666666 |
| Source/Footer | 6.75-10pt | Normal | Dark Gray #666666 |
| Page Number | 10px | Normal | Dark Gray #666666 |

---

## 10. Spacing System (4pt Base)

```css
:root {
  --spacing-xs: 4pt;   /* Tight spacing */
  --spacing-sm: 8pt;   /* Small gaps */
  --spacing-md: 12pt;  /* Medium padding */
  --spacing-lg: 16pt;  /* Large padding */
  --spacing-xl: 20pt;  /* Section spacing */
  --spacing-xxl: 40pt; /* Major sections */
}
```

---

## 11. Chart Styling Rules

- **Baseline**: All bar charts MUST have 2px navy baseline at y=0
- **Value Labels**: ABOVE bars (not inside)
- **Category Labels**: BELOW baseline
- **Scaling**: `barHeight = (value / maxValue) * availableHeight`
- **Gridlines**: None (clean aesthetic)
- **Legends**: Minimize - use direct labels on data when possible
- **Font**: Only web-safe fonts (Arial, Helvetica, etc.)

---

## 12. 5-Second Quality Test

| Test | Method | Pass Criteria |
|------|--------|---------------|
| Squint Test | Squint at slide | Shapes/masses readable |
| Color Test | Check palette | Consistent hue/saturation |
| Direction Test | Check orientation | Bars/lines correct direction |
| Proportion Test | Compare elements | Correct relative sizes |
| Density Test | Overall weight | Appropriate visual balance |

---

## 13. Argument Types

| Argument Type | What It Proves | Visual Signals | REQUIRED L1-L2 |
|---------------|----------------|----------------|----------------|
| `MAGNITUDE` | X is big/significant | Single big number, KPI card, stat callout | `data-performance`, `narrative-text-insight` |
| `COMPARISON` | X is bigger/better than Y | Side-by-side bars, comparison table, benchmark | `data-ranking`, `compare-side-by-side` |
| `COMPOSITION` | X = A + B + C (parts to whole) | Stacked bars, waterfall, pie/donut, treemap | `data-breakdown` (REQUIRED) |
| `CHANGE_OVER_TIME` | X is growing/declining over time | Line chart, before/after, time-series columns | `data-trend` |
| `DISTRIBUTION` | X varies across categories/segments | Heatmap, histogram, geographic map | `data-correlation`, `data-ranking` |
| `CORRELATION_CAUSATION` | X correlates with/causes Y | Scatter plot, bubble chart, quadrant plot | `data-correlation` |
| `PROCESS_SEQUENCE` | First X, then Y, then Z | Timeline, chevrons, funnel, Gantt | `flow-timeline`, `flow-step-by-step` |
| `FRAMEWORK_STRUCTURE` | X has N components/dimensions | Framework diagram, matrix, pillars, org chart | `explain-framework`, `explain-matrix` |

---

## 14. Common Named Slide Patterns

### Value Decomposition Table
- **Structure**: Three-column layout showing items contributing to total value
- **Classification**: `data-breakdown-stacked-bar-value-decomposition-table`
- **Recognition signals**: Title mentions "value at stake", TOTAL row with stacked segments, right column has "Impact" header

### Horizontal Waterfall Bridge
- **Structure**: Floating bars showing cumulative change from start to end
- **Classification**: `data-breakdown-waterfall-*`
- **Recognition signals**: Title mentions "bridge", "buildup", bars float with connectors

### Comparison Bar Chart
- **Structure**: Independent bars for ranking
- **Classification**: `data-ranking-bar-*`
- **Recognition signals**: All bars start at 0, no stacked TOTAL row

### Framework Pillars
- **Structure**: Vertical elements representing strategic components
- **Classification**: `explain-framework-pillars`
- **Recognition signals**: Vertical rectangles, often 3-5 components with foundation layer

### Process Chevrons
- **Structure**: Sequential flow showing steps
- **Classification**: `flow-step-by-step-*`
- **Recognition signals**: Chevron shapes, sequential numbering, left-to-right flow

### KPI Dashboard
- **Structure**: Multiple large numbers showing key metrics
- **Classification**: `data-performance-kpi-*`
- **Recognition signals**: Large prominent numbers, metric labels, grid arrangement

---

## 15. Visual Text Treatments

| Treatment | How to Identify | Required Syntax |
|-----------|-----------------|-----------------|
| PLAIN TEXT | Text with no visible background | "plain text '[placeholder]' in [color] #XXXXXX" |
| TEXT ON BAR | Text sitting on a solid color stripe | "'[placeholder]' in [text color] #XXXXXX on [bar color] #XXXXXX bar" |
| TEXT IN PILL | Text inside rounded rectangle | "[fill color] #XXXXXX pill containing '[placeholder]' in [text color] #XXXXXX" |
| TEXT IN BOX | Text inside rectangular container | "[fill color] #XXXXXX box containing '[placeholder]' in [text color] #XXXXXX" |
| TEXT IN BADGE | Text inside small marker | "[fill color] #XXXXXX badge containing '[placeholder]' in [text color] #XXXXXX" |
| TEXT IN CELL | Text inside table cell | "cell containing '[placeholder]' in [text color] #XXXXXX" |
| ICON | Standalone symbol | "[icon:name] in [color] #XXXXXX" |
| ICON + PLAIN TEXT | Icon adjacent to text | "[icon:name] in [color] #XXXXXX followed by plain text '[placeholder]' in [color]" |

---

## 16. Category Grouping Indicators

### Category Marker Styles

| Style | Description |
|-------|-------------|
| Square/badge | Letter inside colored square |
| Circle | Letter inside circle |
| Text only | Bold or colored letter without shape |
| Tab | Letter in tab-like shape |

### Connector Types

| Connector | Description |
|-----------|-------------|
| Bracket | Curly brace connecting parent to children |
| Triangle/chevron | Arrow shape pointing from parent toward children |
| Vertical line | Line running down beside grouped items |
| Indentation only | Children indented under parent, no explicit connector |
| Row span | Parent cell visually spans multiple child rows |
| Color band | Colored stripe or background grouping items |
| Proximity | No connector — grouping implied by vertical proximity |

---

## 17. Placeholder System

### Placeholder Categories

| Priority | Condition | Category | Format |
|----------|-----------|----------|--------|
| 1 | Main slide headline | `title` | `[title:action]` |
| 2 | Column/row/panel header | `header` | `[header:column_1]` |
| 3 | Chart axis/category/legend label | `label` | `[label:category_1]` |
| 4 | Body text (bullets, paragraphs) | `body` | `[body:bullet_1]` |
| 5 | Annotation/callout | `callout` | `[callout:text_1]` |
| 6 | Numeric/data value | `value` | `[value:pct_1]` |
| 7 | Source/footnote | `source` | `[source:citation]` |
| 8 | Simple vector symbol | `icon` | `[icon:checkmark]` |
| 9 | Photo/logo | `image` | `[image:headshot_1]` |
| 10 | Metadata | `meta` | `[meta:slide_number]` |

### Value Format Prefixes

| Prefix | Format | Example |
|--------|--------|---------|
| `pct` | Percentage | `[value:pct_1]` → 45% |
| `curr` | Currency | `[value:curr_revenue]` → $2.3M |
| `mult` | Multiplier | `[value:mult_1]` → 8x |
| `count` | Integer | `[value:count_total]` → 2,500 |
| `ratio` | Ratio | `[value:ratio_1]` → 3:1 |
| `delta` | Change | `[value:delta_yoy]` → +15% |
| `range` | Range | `[value:range_1]` → 65-82% |

---

## 18. HTML Template Examples

### Base McKinsey Slide Template
```html
<!DOCTYPE html>
<html>
<head>
<style>
:root {
  --mck-navy: #1E3A5F;
  --mck-blue-dark: #2E75B6;
  --mck-blue-medium: #5B9BD5;
  --mck-blue-light: #A8C8E8;
  --mck-gray-dark: #666666;
  --mck-gray-medium: #D0D0D0;
  --mck-gray-light: #F5F3EF;
}
body {
  width: 720pt; height: 405pt; margin: 0; padding: 0;
  background: var(--mck-gray-light);
  font-family: Arial, sans-serif;
}
.title-zone { min-height: 40pt; padding: 12pt 6pt 8pt 6pt; }
.section-id { font-size: 10px; color: var(--mck-navy); margin-bottom: 4pt; }
.action-title { font-size: 20px; font-weight: bold; color: var(--mck-navy); margin: 0; }
.content-zone { height: 325pt; padding: 0 6pt; }
.footer-zone {
  height: 30pt; padding: 0 6pt;
  display: flex; justify-content: space-between; align-items: center;
}
.source { font-size: 9px; color: var(--mck-gray-dark); }
.page-num { font-size: 10px; color: var(--mck-gray-dark); }
</style>
</head>
<body>
  <div class="title-zone">
    <p class="section-id">Section 1.0</p>
    <h1 class="action-title">Action-oriented title that states the key insight</h1>
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

### Vertical Bar Chart Template
```html
<div style="padding: 15pt;">
  <!-- Value labels above bars -->
  <div style="display: flex; justify-content: space-around; padding: 0 10pt; margin-bottom: 4pt;">
    <p style="width: 50pt; font-size: 13px; font-weight: bold; color: #1E3A5F; text-align: center;">$32B</p>
    <p style="width: 50pt; font-size: 13px; font-weight: bold; color: #1E3A5F; text-align: center;">$28B</p>
    <p style="width: 50pt; font-size: 13px; font-weight: bold; color: #1E3A5F; text-align: center;">$22B</p>
    <p style="width: 50pt; font-size: 13px; font-weight: bold; color: #1E3A5F; text-align: center;">$18B</p>
  </div>

  <!-- Chart area with baseline -->
  <div style="display: flex; align-items: flex-end; justify-content: space-around;
              height: 130pt; border-bottom: 2px solid #1E3A5F; padding: 0 10pt;">
    <div style="width: 40pt; height: 110pt; background: #2E75B6;"></div>
    <div style="width: 40pt; height: 95pt; background: #5B9BD5;"></div>
    <div style="width: 40pt; height: 75pt; background: #A8C8E8;"></div>
    <div style="width: 40pt; height: 60pt; background: #D0D0D0;"></div>
  </div>

  <!-- Category labels below baseline -->
  <div style="display: flex; justify-content: space-around; padding: 0 10pt; margin-top: 8pt;">
    <p style="width: 50pt; font-size: 11px; color: #1E3A5F; text-align: center;">Category 1</p>
    <p style="width: 50pt; font-size: 11px; color: #1E3A5F; text-align: center;">Category 2</p>
    <p style="width: 50pt; font-size: 11px; color: #1E3A5F; text-align: center;">Category 3</p>
    <p style="width: 50pt; font-size: 11px; color: #1E3A5F; text-align: center;">Category 4</p>
  </div>
</div>
```

### Horizontal Bar Chart Template
```html
<div style="padding: 15pt;">
  <!-- Each row: label + bar + value -->
  <div style="display: flex; align-items: center; margin-bottom: 12pt;">
    <p style="width: 100pt; font-size: 11px; color: #1E3A5F; text-align: right; padding-right: 12pt;">Category 1</p>
    <div style="flex: 1; height: 24pt; background: #F5F3EF; position: relative;">
      <div style="width: 85%; height: 100%; background: #1E3A5F;"></div>
    </div>
    <p style="width: 50pt; font-size: 13px; font-weight: bold; color: #1E3A5F; text-align: left; padding-left: 8pt;">$32B</p>
  </div>

  <div style="display: flex; align-items: center; margin-bottom: 12pt;">
    <p style="width: 100pt; font-size: 11px; color: #1E3A5F; text-align: right; padding-right: 12pt;">Category 2</p>
    <div style="flex: 1; height: 24pt; background: #F5F3EF; position: relative;">
      <div style="width: 70%; height: 100%; background: #2E75B6;"></div>
    </div>
    <p style="width: 50pt; font-size: 13px; font-weight: bold; color: #1E3A5F; text-align: left; padding-left: 8pt;">$28B</p>
  </div>

  <div style="display: flex; align-items: center; margin-bottom: 12pt;">
    <p style="width: 100pt; font-size: 11px; color: #1E3A5F; text-align: right; padding-right: 12pt;">Category 3</p>
    <div style="flex: 1; height: 24pt; background: #F5F3EF; position: relative;">
      <div style="width: 55%; height: 100%; background: #D0D0D0;"></div>
    </div>
    <p style="width: 50pt; font-size: 13px; font-weight: bold; color: #1E3A5F; text-align: left; padding-left: 8pt;">$22B</p>
  </div>
</div>
```

### Waterfall Chart Template
```html
<div style="position: relative; height: 200pt; padding: 20pt;">
  <!-- Bars positioned absolutely -->
  <div style="position: absolute; left: 50pt; bottom: 30pt; width: 60pt; height: 150pt; background: #1E3A5F;"></div>
  <div style="position: absolute; left: 130pt; bottom: 110pt; width: 60pt; height: 40pt; background: #D0D0D0;"></div>
  <div style="position: absolute; left: 210pt; bottom: 85pt; width: 60pt; height: 25pt; background: #D0D0D0;"></div>
  <div style="position: absolute; left: 290pt; bottom: 30pt; width: 60pt; height: 55pt; background: #B8975C;"></div>

  <!-- Connectors (dashed lines) -->
  <div style="position: absolute; left: 110pt; top: 40pt; width: 20pt; border-top: 1px dashed #666666;"></div>
  <div style="position: absolute; left: 190pt; top: 80pt; width: 20pt; border-top: 1px dashed #666666;"></div>
  <div style="position: absolute; left: 270pt; top: 105pt; width: 20pt; border-top: 1px dashed #666666;"></div>

  <!-- Baseline -->
  <div style="position: absolute; left: 30pt; bottom: 30pt; right: 30pt; border-top: 2px solid #1E3A5F;"></div>

  <!-- Labels below baseline -->
  <div style="position: absolute; left: 50pt; bottom: 10pt; width: 60pt; text-align: center; font-size: 10px; color: #666666;">Start</div>
  <div style="position: absolute; left: 130pt; bottom: 10pt; width: 60pt; text-align: center; font-size: 10px; color: #666666;">Factor 1</div>
  <div style="position: absolute; left: 210pt; bottom: 10pt; width: 60pt; text-align: center; font-size: 10px; color: #666666;">Factor 2</div>
  <div style="position: absolute; left: 290pt; bottom: 10pt; width: 60pt; text-align: center; font-size: 10px; color: #666666;">End</div>
</div>
```

### Pie/Donut Chart Template (using SVG)
```html
<svg viewBox="0 0 200 200" style="width: 150pt; height: 150pt;">
  <!-- Donut segments using stroke-dasharray -->
  <circle cx="100" cy="100" r="70" fill="none" stroke="#1E3A5F" stroke-width="30"
          stroke-dasharray="154 286" stroke-dashoffset="0" transform="rotate(-90 100 100)"/>
  <circle cx="100" cy="100" r="70" fill="none" stroke="#B8975C" stroke-width="30"
          stroke-dasharray="88 352" stroke-dashoffset="-154" transform="rotate(-90 100 100)"/>
  <circle cx="100" cy="100" r="70" fill="none" stroke="#D0D0D0" stroke-width="30"
          stroke-dasharray="66 374" stroke-dashoffset="-242" transform="rotate(-90 100 100)"/>
  <circle cx="100" cy="100" r="70" fill="none" stroke="#666666" stroke-width="30"
          stroke-dasharray="132 308" stroke-dashoffset="-308" transform="rotate(-90 100 100)"/>
</svg>
```

### 2x2 Matrix Template
```html
<div style="position: relative; width: 280pt; height: 200pt; margin: 20pt auto;">
  <!-- Quadrant grid -->
  <div style="position: absolute; left: 50%; top: 0; bottom: 0; border-left: 1px solid #D0D0D0;"></div>
  <div style="position: absolute; top: 50%; left: 0; right: 0; border-top: 1px solid #D0D0D0;"></div>

  <!-- Quadrant labels -->
  <div style="position: absolute; top: 25%; left: 25%; transform: translate(-50%, -50%);
              font-size: 11px; color: #1E3A5F; text-align: center; font-weight: bold;">
    Low Priority
  </div>
  <div style="position: absolute; top: 25%; left: 75%; transform: translate(-50%, -50%);
              font-size: 11px; color: #1E3A5F; text-align: center; font-weight: bold;">
    Quick Wins
  </div>
  <div style="position: absolute; top: 75%; left: 25%; transform: translate(-50%, -50%);
              font-size: 11px; color: #1E3A5F; text-align: center; font-weight: bold;">
    Major Projects
  </div>
  <div style="position: absolute; top: 75%; left: 75%; transform: translate(-50%, -50%);
              font-size: 11px; color: #1E3A5F; text-align: center; font-weight: bold;">
    Strategic Bets
  </div>

  <!-- Axis labels -->
  <div style="position: absolute; bottom: -20pt; left: 50%; transform: translateX(-50%);
              font-size: 10px; color: #666666;">Impact →</div>
  <div style="position: absolute; left: -30pt; top: 50%; transform: translateY(-50%) rotate(-90deg);
              font-size: 10px; color: #666666;">Effort →</div>
</div>
```

### Chevron Process Template
```html
<div style="display: flex; align-items: center; gap: 0; padding: 20pt;">
  <!-- Step 1: First chevron (no left notch) -->
  <div style="position: relative; width: 120pt; height: 60pt; background: #1E3A5F;
              clip-path: polygon(0 0, 85% 0, 100% 50%, 85% 100%, 0 100%);">
    <span style="position: absolute; top: 50%; left: 40%; transform: translate(-50%, -50%);
                 color: white; font-size: 12px; font-weight: bold;">Step 1</span>
  </div>

  <!-- Step 2: Middle chevron (with left notch) -->
  <div style="position: relative; width: 120pt; height: 60pt; background: #2E75B6; margin-left: -15pt;
              clip-path: polygon(0 0, 85% 0, 100% 50%, 85% 100%, 0 100%, 15% 50%);">
    <span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                 color: white; font-size: 12px; font-weight: bold;">Step 2</span>
  </div>

  <!-- Step 3: Middle chevron -->
  <div style="position: relative; width: 120pt; height: 60pt; background: #5B9BD5; margin-left: -15pt;
              clip-path: polygon(0 0, 85% 0, 100% 50%, 85% 100%, 0 100%, 15% 50%);">
    <span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                 color: white; font-size: 12px; font-weight: bold;">Step 3</span>
  </div>

  <!-- Step 4: Last chevron -->
  <div style="position: relative; width: 120pt; height: 60pt; background: #A8C8E8; margin-left: -15pt;
              clip-path: polygon(0 0, 85% 0, 100% 50%, 85% 100%, 0 100%, 15% 50%);">
    <span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                 color: #1E3A5F; font-size: 12px; font-weight: bold;">Step 4</span>
  </div>
</div>
```

### KPI Dashboard Template
```html
<div style="display: flex; justify-content: space-around; padding: 20pt;">
  <!-- KPI Card 1 -->
  <div style="width: 140pt; padding: 16pt; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <p style="font-size: 10px; color: #666666; margin-bottom: 8pt; text-transform: uppercase;">Revenue</p>
    <p style="font-size: 32px; font-weight: bold; color: #1E3A5F; margin: 0;">$42.5M</p>
    <p style="font-size: 11px; color: #2E7D32; margin-top: 8pt;">↑ 12% YoY</p>
  </div>

  <!-- KPI Card 2 -->
  <div style="width: 140pt; padding: 16pt; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <p style="font-size: 10px; color: #666666; margin-bottom: 8pt; text-transform: uppercase;">Customers</p>
    <p style="font-size: 32px; font-weight: bold; color: #1E3A5F; margin: 0;">2,847</p>
    <p style="font-size: 11px; color: #2E7D32; margin-top: 8pt;">↑ 8% YoY</p>
  </div>

  <!-- KPI Card 3 -->
  <div style="width: 140pt; padding: 16pt; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <p style="font-size: 10px; color: #666666; margin-bottom: 8pt; text-transform: uppercase;">NPS Score</p>
    <p style="font-size: 32px; font-weight: bold; color: #1E3A5F; margin: 0;">72</p>
    <p style="font-size: 11px; color: #C62828; margin-top: 8pt;">↓ 3 pts</p>
  </div>
</div>
```

### Framework Pillars Template
```html
<div style="padding: 20pt;">
  <!-- Pillars -->
  <div style="display: flex; justify-content: center; gap: 12pt; margin-bottom: 12pt;">
    <div style="width: 120pt; height: 180pt; background: #1E3A5F; display: flex; flex-direction: column;
                align-items: center; justify-content: center; padding: 12pt;">
      <p style="color: white; font-size: 14px; font-weight: bold; text-align: center;">Pillar 1</p>
      <p style="color: #A8C8E8; font-size: 10px; text-align: center; margin-top: 8pt;">Description text here</p>
    </div>
    <div style="width: 120pt; height: 180pt; background: #2E75B6; display: flex; flex-direction: column;
                align-items: center; justify-content: center; padding: 12pt;">
      <p style="color: white; font-size: 14px; font-weight: bold; text-align: center;">Pillar 2</p>
      <p style="color: #D6E6F4; font-size: 10px; text-align: center; margin-top: 8pt;">Description text here</p>
    </div>
    <div style="width: 120pt; height: 180pt; background: #5B9BD5; display: flex; flex-direction: column;
                align-items: center; justify-content: center; padding: 12pt;">
      <p style="color: white; font-size: 14px; font-weight: bold; text-align: center;">Pillar 3</p>
      <p style="color: white; font-size: 10px; text-align: center; margin-top: 8pt;">Description text here</p>
    </div>
    <div style="width: 120pt; height: 180pt; background: #A8C8E8; display: flex; flex-direction: column;
                align-items: center; justify-content: center; padding: 12pt;">
      <p style="color: #1E3A5F; font-size: 14px; font-weight: bold; text-align: center;">Pillar 4</p>
      <p style="color: #1E3A5F; font-size: 10px; text-align: center; margin-top: 8pt;">Description text here</p>
    </div>
  </div>

  <!-- Foundation bar -->
  <div style="width: 100%; height: 40pt; background: #D0D0D0; display: flex; align-items: center;
              justify-content: center;">
    <p style="color: #1E3A5F; font-size: 14px; font-weight: bold;">Foundation Element</p>
  </div>
</div>
```

### Funnel Chart Template
```html
<div style="display: flex; flex-direction: column; align-items: center; gap: 4pt; padding: 20pt;">
  <!-- Stage 1: Widest -->
  <div style="width: 100%; height: 40pt; background: #1E3A5F; display: flex; align-items: center;
              justify-content: space-between; padding: 0 16pt;
              clip-path: polygon(0 0, 100% 0, 95% 100%, 5% 100%);">
    <span style="color: white; font-size: 12px;">Awareness</span>
    <span style="color: white; font-size: 14px; font-weight: bold;">10,000</span>
  </div>

  <!-- Stage 2 -->
  <div style="width: 85%; height: 40pt; background: #2E75B6; display: flex; align-items: center;
              justify-content: space-between; padding: 0 16pt;
              clip-path: polygon(3% 0, 97% 0, 92% 100%, 8% 100%);">
    <span style="color: white; font-size: 12px;">Interest</span>
    <span style="color: white; font-size: 14px; font-weight: bold;">5,200</span>
  </div>

  <!-- Stage 3 -->
  <div style="width: 65%; height: 40pt; background: #5B9BD5; display: flex; align-items: center;
              justify-content: space-between; padding: 0 16pt;
              clip-path: polygon(5% 0, 95% 0, 88% 100%, 12% 100%);">
    <span style="color: white; font-size: 12px;">Consideration</span>
    <span style="color: white; font-size: 14px; font-weight: bold;">2,100</span>
  </div>

  <!-- Stage 4: Narrowest -->
  <div style="width: 40%; height: 40pt; background: #B8975C; display: flex; align-items: center;
              justify-content: space-between; padding: 0 16pt;
              clip-path: polygon(8% 0, 92% 0, 85% 100%, 15% 100%);">
    <span style="color: white; font-size: 12px;">Conversion</span>
    <span style="color: white; font-size: 14px; font-weight: bold;">840</span>
  </div>
</div>
```

---

## 19. Heatmap Template

```html
<div style="padding: 20pt;">
  <!-- Column headers -->
  <div style="display: flex; margin-left: 80pt; margin-bottom: 4pt;">
    <div style="width: 60pt; text-align: center; font-size: 10px; color: #666666;">Q1</div>
    <div style="width: 60pt; text-align: center; font-size: 10px; color: #666666;">Q2</div>
    <div style="width: 60pt; text-align: center; font-size: 10px; color: #666666;">Q3</div>
    <div style="width: 60pt; text-align: center; font-size: 10px; color: #666666;">Q4</div>
  </div>

  <!-- Row 1 -->
  <div style="display: flex; align-items: center; margin-bottom: 2pt;">
    <div style="width: 80pt; text-align: right; padding-right: 8pt; font-size: 10px; color: #666666;">Region A</div>
    <div style="width: 60pt; height: 40pt; background: #1E3A5F; display: flex; align-items: center; justify-content: center;">
      <span style="color: white; font-size: 11px; font-weight: bold;">92%</span>
    </div>
    <div style="width: 60pt; height: 40pt; background: #2E75B6; display: flex; align-items: center; justify-content: center;">
      <span style="color: white; font-size: 11px; font-weight: bold;">85%</span>
    </div>
    <div style="width: 60pt; height: 40pt; background: #5B9BD5; display: flex; align-items: center; justify-content: center;">
      <span style="color: white; font-size: 11px; font-weight: bold;">78%</span>
    </div>
    <div style="width: 60pt; height: 40pt; background: #A8C8E8; display: flex; align-items: center; justify-content: center;">
      <span style="color: #1E3A5F; font-size: 11px; font-weight: bold;">65%</span>
    </div>
  </div>

  <!-- Row 2 -->
  <div style="display: flex; align-items: center; margin-bottom: 2pt;">
    <div style="width: 80pt; text-align: right; padding-right: 8pt; font-size: 10px; color: #666666;">Region B</div>
    <div style="width: 60pt; height: 40pt; background: #5B9BD5; display: flex; align-items: center; justify-content: center;">
      <span style="color: white; font-size: 11px; font-weight: bold;">75%</span>
    </div>
    <div style="width: 60pt; height: 40pt; background: #1E3A5F; display: flex; align-items: center; justify-content: center;">
      <span style="color: white; font-size: 11px; font-weight: bold;">88%</span>
    </div>
    <div style="width: 60pt; height: 40pt; background: #2E75B6; display: flex; align-items: center; justify-content: center;">
      <span style="color: white; font-size: 11px; font-weight: bold;">82%</span>
    </div>
    <div style="width: 60pt; height: 40pt; background: #5B9BD5; display: flex; align-items: center; justify-content: center;">
      <span style="color: white; font-size: 11px; font-weight: bold;">71%</span>
    </div>
  </div>
</div>
```

---

## 20. Gantt Chart Template

```html
<div style="padding: 20pt;">
  <!-- Header with months -->
  <div style="display: flex; margin-left: 120pt; margin-bottom: 8pt; border-bottom: 1px solid #D0D0D0;">
    <div style="width: 60pt; text-align: center; font-size: 10px; color: #666666; padding: 4pt 0;">Jan</div>
    <div style="width: 60pt; text-align: center; font-size: 10px; color: #666666; padding: 4pt 0;">Feb</div>
    <div style="width: 60pt; text-align: center; font-size: 10px; color: #666666; padding: 4pt 0;">Mar</div>
    <div style="width: 60pt; text-align: center; font-size: 10px; color: #666666; padding: 4pt 0;">Apr</div>
    <div style="width: 60pt; text-align: center; font-size: 10px; color: #666666; padding: 4pt 0;">May</div>
    <div style="width: 60pt; text-align: center; font-size: 10px; color: #666666; padding: 4pt 0;">Jun</div>
  </div>

  <!-- Task 1 -->
  <div style="display: flex; align-items: center; height: 32pt; margin-bottom: 4pt;">
    <div style="width: 120pt; font-size: 11px; color: #1E3A5F; padding-right: 8pt;">Task 1</div>
    <div style="flex: 1; position: relative; height: 20pt; background: #F5F3EF;">
      <div style="position: absolute; left: 0; width: 120pt; height: 100%; background: #1E3A5F;"></div>
    </div>
  </div>

  <!-- Task 2 -->
  <div style="display: flex; align-items: center; height: 32pt; margin-bottom: 4pt;">
    <div style="width: 120pt; font-size: 11px; color: #1E3A5F; padding-right: 8pt;">Task 2</div>
    <div style="flex: 1; position: relative; height: 20pt; background: #F5F3EF;">
      <div style="position: absolute; left: 60pt; width: 180pt; height: 100%; background: #2E75B6;"></div>
    </div>
  </div>

  <!-- Task 3 -->
  <div style="display: flex; align-items: center; height: 32pt; margin-bottom: 4pt;">
    <div style="width: 120pt; font-size: 11px; color: #1E3A5F; padding-right: 8pt;">Task 3</div>
    <div style="flex: 1; position: relative; height: 20pt; background: #F5F3EF;">
      <div style="position: absolute; left: 180pt; width: 120pt; height: 100%; background: #5B9BD5;"></div>
    </div>
  </div>

  <!-- Task 4 -->
  <div style="display: flex; align-items: center; height: 32pt; margin-bottom: 4pt;">
    <div style="width: 120pt; font-size: 11px; color: #1E3A5F; padding-right: 8pt;">Task 4</div>
    <div style="flex: 1; position: relative; height: 20pt; background: #F5F3EF;">
      <div style="position: absolute; left: 240pt; width: 120pt; height: 100%; background: #B8975C;"></div>
    </div>
  </div>
</div>
```

---

## 21. Content Density Standards by Slide Type

McKinsey slides are content-HEAVY. Empty-feeling slides are unacceptable. The following density targets define fill expectations per slide type.

### Density Targets

| Slide Type | Fill Target | Containers | Example |
|------------|-------------|------------|---------|
| Data (chart + sidebar) | 80-92% | 3-4 | Chart container + insights sidebar + bottom bar + callout |
| Framework/Pillars | 80-90% | 3-5 columns | N header-bar columns with dense body text |
| Text-Insight/Phase | 80-90% | 3-4 bands | Category labels + bullet content + framing container |
| Case Study | 85-92% | 3-5 | Sidebar + table rows + photos/metrics |
| Recommendation List | 85-92% | 2-3 | Sidebar + numbered table + badge |
| Comparison Table | 75-85% | 2-3 | Full-width table + annotation arrow |
| Agenda/Contents | 30-40% | 2 | Sidebar + agenda list (intentionally sparse) |
| Cover | 50-60% right area | 2 | Brand strip + title/metadata |

### How to Judge Density

- If you can describe the slide's content in one sentence, it is too sparse.
- A good McKinsey content slide requires 3-5 sentences to fully describe.
- Every content slide should have AT LEAST: (a) a titled container or chart, (b) supporting text/bullets/sidebar with insights, (c) annotations, callouts, or labels providing additional context.
- If a template feels empty, add: callout annotations, methodology notes, numbered badges, category labels, insight bars, or supporting bullets. McKinsey slides ALWAYS have layers of information.
- Minimum containers per content slide: 2. Typical: 3-4.

### Intentionally Sparse Slides

Agenda/Contents slides (30-40% fill) and Cover slides (50-60% fill) are the ONLY exceptions to the high-density rule. These slides are functional (navigation/introduction), not informational. Their sparseness is deliberate and communicates professionalism and orientation.

### Content Height Estimation

- Charts: use their explicit `height` style value (typically 110-250pt).
- Bullets: ~18pt per bullet.
- Table rows: ~20pt per row + 30pt for headers.
- Container padding: ~24pt per container (panels, callouts, cards).
- If estimated height exceeds ~325pt, resize containers with `flex: 1`, reduce fonts toward 9px minimum, reduce padding, reduce content, or split into multiple slides.
- If estimated height is below ~215pt (~66% fill), the slide is underfilled. Increase content density.

---

## 22. Bold-Keyword Pattern (THE McKinsey Text Treatment)

The Bold-Keyword Pattern is THE defining McKinsey text treatment. It appears on virtually every content slide. This is the single most recognizable element of McKinsey slide design.

### Core Rules

- First 3-8 words of every bullet are wrapped in `<strong>` (bolded) in brand-primary color. The rest is regular weight.
- This creates scannable text: readers catch key terms without reading every word.
- The bold portion functions as a "mini-headline" for each bullet point.

### HTML Example

```html
<ul style="font-size: 10pt; line-height: 1.5; color: var(--brand-primary);">
  <li><strong>Improved insulation</strong> and shifting from incandescent to CFLs drives 45% of residential savings</li>
  <li><strong>Commercial HVAC upgrades</strong> account for 30% of potential reduction through more efficient cooling systems</li>
  <li><strong>Industrial process optimization</strong> represents the largest single opportunity at $2.3B annual value</li>
</ul>
```

### Double-Bold (Optional Enhancement)

Within the regular-weight portion of a bullet, additionally bold 1-2 key terms for extra emphasis. Use sparingly -- maximum 2 double-bold terms per bullet.

```html
<li><strong>Residential sector</strong> drives largest share through improved <strong>insulation</strong> and more efficient <strong>appliances</strong></li>
```

### Bullet Formatting Rules

- **Length**: 1-3 lines per bullet. Never single-word bullets. Never paragraph-length bullets (>4 lines).
- **Count per panel**: 3-5 bullets ideal. Maximum 6 per panel.
- **Markers**: use default `<ul>` disc markers or filled squares via CSS. No custom icons as markers.
- **Sub-bullets**: indented, dash markers, 1px smaller font than parent. Used for examples or supporting details.
- **No prose paragraphs** on content slides. ALWAYS use bullets with bold lead-ins. The only exception: a single introductory sentence above a bullet list.
- **Prefer sentence fragments** over full sentences: "**Improved insulation** and shifting from incandescent to CFLs" not "The key driver is improved insulation and the shift from incandescent lighting to compact fluorescent lamps."

### Text Inside Chart Containers

- Chart title labels: bold, 11-14px, navy. Describe what the chart shows + units. Example: "UK electricity demand, 2030, TWh". NOT a repeated action title.
- Axis labels: >=9px. Category labels: >=10px.
- Data labels on bars/points: bold, >=10px, white on dark fills, navy on light fills.

---

## 23. Four Container Types (Detailed Architecture)

Containers are the fundamental building blocks of McKinsey slides. Every piece of content lives inside a visually defined container. **EVERY container must be visibly bounded** -- a container with no visual boundary (no border, no background, no header bar) is invisible and unacceptable.

### Type 1: Header-Bar Container

Colored background bar with white bold text as section title. White body area below the bar containing the actual content.

- **Colors**: `var(--brand-secondary)` cyan, `var(--brand-primary)` navy, or custom dark color.
- **Used for**: chart panel titles, sidebar section headers, column headers in frameworks.

```html
<div style="border: 2px solid var(--brand-secondary); border-radius: 2pt; overflow: hidden;">
  <div style="background: var(--brand-secondary); color: var(--brand-text-inverse); padding: 10pt 14pt; font-weight: bold; font-size: 11pt;">Section Title</div>
  <div style="padding: 16pt; background: var(--brand-bg-primary);">
    <!-- Content here -->
  </div>
</div>
```

### Type 2: Bordered Container

2px solid border with optional 2pt border-radius.

- **Border color**: `var(--brand-secondary)` or `var(--brand-primary)`.
- **Used for**: outer frames wrapping chart+sidebar, card layouts, callout boxes.

```html
<div style="border: 2px solid var(--brand-secondary); border-radius: 2pt; padding: 16pt;">
  <!-- Content here -->
</div>
```

### Type 3: Background-Fill Container

Light colored background filling the content area.

- **Colors**: `var(--brand-surface-light)` #DAE3F3, `var(--brand-bg-primary)` white, or `var(--brand-bg-secondary)` #F5F3EF.
- **Used for**: category labels, highlight bars, metric badges, chart backgrounds.

```html
<div style="background: var(--brand-surface-light); padding: 10pt 14pt;">
  <!-- Content here -->
</div>
```

### Type 4: Sidebar Container

Full-height colored strip on left edge.

- **Width**: 8-25% of content area.
- **Colors**: `var(--brand-primary)` navy or `var(--brand-bg-dark)` deep blue.
- **Used for**: entity labels (city names, theme names), decorative brand elements, merged-cell effect.

```html
<div style="display: flex; gap: 0;">
  <div style="width: 60pt; background: var(--brand-primary); color: var(--brand-text-inverse); padding: 14pt; font-weight: bold; display: flex; align-items: center; justify-content: center;">
    Label
  </div>
  <div style="flex: 1; padding: 14pt;">
    <!-- Content here -->
  </div>
</div>
```

### Container Rules

- **Nesting**: containers frequently nest 2-3 levels deep. Example: bordered outer container > header-bar panel inside > background-fill labels inside that.
- **Spacing**: 10-20pt gap between adjacent containers. Never butted edge-to-edge without padding.
- **Fill**: every container should be 70-95% filled with content. If >30% whitespace, add content or shrink the container.
- **Visibility**: EVERY container must be visibly bounded by at least one of: border, background color, or header bar. An invisible container is not a container.

---

## 24. Brand Color Palette (Tier System)

ALL templates use the same palette. No template-specific colors. No deviations.

### Tier 1: Always Safe (Core Brand)

These colors are used on every slide without exception.

| CSS Variable | Hex | Usage |
|-------------|-----|-------|
| `var(--brand-primary)` | #1E3A5F | Titles, headers, primary chart bars, sidebar backgrounds, primary text |
| `var(--brand-secondary)` | #2E75B6 | Panel header bars, callout borders, container borders |
| `var(--brand-surface-light)` | #DAE3F3 | Secondary chart bars, container backgrounds, highlight bars, label fills |
| `var(--brand-bg-primary)` | #FFFFFF | Main slide background, panel body backgrounds, text on dark containers |
| `var(--brand-bg-secondary)` | #F5F3EF | Alternate light background for secondary panels |
| `var(--brand-text-inverse)` | #FFFFFF | White text on dark containers |
| `var(--brand-gray-dark)` | #666666 | Footnotes, captions, separators, secondary text |
| `var(--brand-gray-medium)` | #D0D0D0 | Borders, dividers, badge outlines |
| `var(--brand-gray-light)` | #F5F3EF | Slide body background (set on `.brand-slide`) |

### Tier 2: Inspiration-Matching (Extended Palette)

Available CSS variables for specific use cases -- use when the design calls for additional differentiation.

| CSS Variable | Hex | Usage |
|-------------|-----|-------|
| `var(--brand-tertiary)` | — | 3rd-level chart series or category differentiation |
| `var(--brand-quaternary)` | — | 4th series in complex charts |
| `var(--brand-quinary)` | — | 5th series in complex charts |
| `var(--brand-warning)` | #F3C13A | Caution states, interim targets |
| `var(--brand-accent)` | #E87722 | Strong emphasis, transformation targets (orange) |
| `var(--brand-neutral)` | #A2AAAD | Neutral/baseline indicators |
| `var(--brand-surface-muted)` | #F2F2F2 | Subtle background differentiation |
| `var(--brand-gray-silver)` | #C0C5C9 | Secondary borders, muted separators |
| `var(--brand-gray-border)` | #E0E0E0 | Light borders |

### Tier 3: Restricted (Semantic Colors)

Use sparingly -- maximum 1-2 instances per slide.

| CSS Variable | Hex | Usage |
|-------------|-----|-------|
| `var(--brand-positive)` | #2E7D32 | Positive values, growth indicators |
| `var(--brand-negative)` | #C62828 | Negative values, decline indicators, emphasis callouts |
| `var(--brand-accent)` | #B8975C | Gold accent, special emphasis only |

### Color Format Rules by Context

| Context | Format | Example |
|---------|--------|---------|
| HTML/CSS inline styles | CSS Variables | `color: var(--brand-primary)` |
| `data-echarts` JSON attributes | HEX values only | `"color": "#1E3A5F"` |
| SVG elements | HEX values | `stroke="#1E3A5F"` |

**CRITICAL**: Never hardcode hex colors in HTML/CSS -- always use `var(--brand-*)`. Only use hex inside `data-echarts` JSON attributes. Never use Material Design colors (#4CAF50, #EF5350, etc.). CSS variables inside `data-echarts` JSON render as BLACK in the chart renderer.

### Chart Color Sequence

For ECharts JSON, use HEX values in this order: `["#1E3A5F", "#2E75B6", "#5B9BD5", "#A8C8E8", "#D6E6F4", "#B8975C", "#D0D0D0"]`

### Stepped Color Progression (No CSS Gradients)

Use discrete solid background fills with progressively darker/lighter brand colors to visually communicate advancement in phase/maturity diagrams.

- **Intensity steps**: `var(--brand-secondary-pale)` to `var(--brand-secondary-light)` to `var(--brand-secondary)` to `var(--brand-primary)` (left-to-right or bottom-to-top)
- **Semantic steps**: `var(--brand-accent)` (orange, current state) to `var(--brand-warning)` (gold, transition) to `var(--brand-positive)` (green, target state)
- Apply as solid `background-color` on phase boxes, timeline segments, or step containers -- one color per discrete element
- Never use CSS gradients. Maintain consistent progression direction across the slide.

---

## 25. Slide Pattern Templates (A through H)

### Pattern A: Data Slide (Chart + Sidebar)

Data slides show quantitative information (charts, graphs) alongside qualitative interpretation (insights, takeaways). The two MUST always appear together.

**Mandatory Two-Zone Layout:**

```
+--------------------------------------------------+
| Title Zone: Action title + subtitle               |
+--------------------------------------------------+
| Chart Area (~65%)    | Insights Sidebar (~35%)    |
|                      | [Header bar: "Key insights"]|
| [Chart title label]  | [Bold-keyword bullets]      |
| [Chart with labels]  |                             |
| [Callout annotations]| [Header bar: "Comments"]    |
|                      | [Additional bullets]         |
+--------------------------------------------------+
| Footer: Source | Page                              |
+--------------------------------------------------+
```

**Chart area requirements:**
- ~65% width. Contains titled chart container with header bar or bold label, chart with `data-echarts`, callout annotations.
- **Above-chart exhibit title (mandatory):** Every chart MUST have an above-chart exhibit title -- a label positioned directly above the chart within the content zone. This is DISTINCT from the action title in the title zone. Content: what the chart shows + units of measure + time period. Example: "Improvement in per capita GDP by year of birth -- Indexed to 100". Format: bold 11-14pt, navy, left-aligned.
- Chart content fill: 85-90% of container. Bars/lines fill 60-90% of chart area. Annotations, labels, and callouts fill remaining whitespace.

**Insights sidebar requirements:**
- ~35% width. Contains 1-2 stacked header-bar containers.
- First panel: "Key insights" or "Key takeaways" header. Contains 3-5 bold-keyword bullets interpreting the chart data.
- Optional second panel: "Comments", "Methodology", or "Assumptions" header. Contains 2-3 bullets with context.

**Assisting columns:**
- Supplementary data columns adjacent to the main chart reinforcing the takeaway.
- Common patterns: growth/change column (+20%, +360%), multiplier/index column (2.54x, 1.96x), category label column.
- Each column MUST have its own exhibit title. Values: bold, 10-12pt, color-coded (navy neutral, green positive, red negative).

**Optional bottom bar:**
- Full-width bar spanning both chart area and sidebar.
- Background: `var(--brand-surface-light)` or `var(--brand-primary)`.
- Content: single synthesis sentence tying chart data and sidebar insights together.

### Pattern B: Framework / Pillars

Framework slides present N parallel concepts, phases, or pillars in equal-width columns.

```
+--------------------------------------------------+
| Title Zone: Descriptive title                     |
+--------------------------------------------------+
| Col 1 (~25%)  | Col 2 (~25%) | Col 3 (~25%) | Col 4 (~25%) |
| [Header bar]  | [Header bar] | [Header bar]  | [Header bar] |
| [Body text]   | [Body text]  | [Body text]   | [Body text]  |
+--------------------------------------------------+
| Footer: Source | Page                              |
+--------------------------------------------------+
```

- 3-5 equal-width columns. Use `display: flex; gap: 10-14pt;` with equal `flex: 1` per column.
- Each column is a header-bar container: dark background header (navy/custom), white bold text 10-11pt.
- All header bars MUST be top-aligned (same height start, use `min-height` to equalize).
- Body: white background, 9-10pt text with bold lead-in pattern.
- Columns read left-to-right as a process flow. Consider numbered columns or arrow indicators between them.
- Content fills 80-90% of body height.

### Pattern C: Text-Insight / Phase

Text-insight slides present categorized information in horizontal bands, with each band representing a phase, time period, or theme.

```
+--------------------------------------------------+
| Title Zone: Badge + Action title                  |
+--------------------------------------------------+
| [Optional: Framing container with overview text]  |
+--------------------------------------------------+
| [Label: Phase 1] | Bullet content for Phase 1     |
| - - - - - - - - - - - - - - - - - - - - - - - - -|
| [Label: Phase 2] | Bullet content for Phase 2     |
| - - - - - - - - - - - - - - - - - - - - - - - - -|
| [Label: Phase 3] | Bullet content for Phase 3     |
+--------------------------------------------------+
| Footer: Source | Page                              |
+--------------------------------------------------+
```

- 3-5 horizontal bands separated by dashed lines (1px gray).
- Each band: left label column (~15% width, background-fill, bold navy 11-12pt) + right content area (~85%, bold-keyword bullets).
- Optional framing container above bands with overview context.
- Optional aspiration bar: full-width colored bar below title zone with bold label + statement text.
- Content fills 80-90% of body height.

### Pattern D: Case Study

Case study slides present real-world examples with structured data and visual evidence. They are ALWAYS structured (table or card layout), never prose paragraphs.

**Variant D1: Metrics + Narrative**

```
+--------------------------------------------------+
| Context Label + Logo                              |
+--------------------------------------------------+
| Metrics Column (~50%)  | Narrative Column (~50%)  |
| [Metric row 1]         | [Bold intro paragraph]   |
| [Circle] [Description] | [Bullet points]          |
| [Metric row 2]         | [Photo placeholder]       |
+--------------------------------------------------+
| Footer: Source | Page                              |
+--------------------------------------------------+
```

- Metrics column: 3-5 rows, each with bold category label (12pt navy) + metric circle (36px diameter, cyan, white bold number) + description text.
- Narrative column: bold introductory paragraph + 2-4 bold-keyword bullets + optional photo placeholder.

**Variant D2: Sidebar + Structured Table + Photos**

- Sidebar (Type 4 container): full-height navy strip with entity label.
- Table: 3-4 data columns (implications, description, photos) with 3-5 rows.
- Target density: 88-92% fill.

### Pattern E: Recommendation List

Recommendation slides present numbered action items in a structured table format.

```
+--------------------------------------------------+
| Title Zone: Action title + "Hypothesis" badge     |
+--------------------------------------------------+
| Sidebar  | # | Recommendation | From    | To     |
| (~12%)   | 1 | [Reco 1]       | [From]  | [To]   |
|          | - - - - - - - - - - - - - - - - - - - - |
|          | 2 | [Reco 2]       | [From]  | [To]   |
|          | - - - - - - - - - - - - - - - - - - - - |
|          | 3 | [Reco 3]       | [From]  | [To]   |
+--------------------------------------------------+
| Footer: Source | Page                              |
+--------------------------------------------------+
```

- Column headers: bold 11-12pt, underlined with solid blue line 2px.
- Columns: `#` (~5%) | `Recommendation` (~40%, bold text) | `From` (~22%) | `To` (~22%).
- 5-8 numbered rows separated by dashed gray lines.
- Numbers: bold 14pt blue/navy. Recommendation text: bold lead-in 10-11pt.
- Target density: 85-92% fill.

### Pattern F: Comparison Table

Comparison slides present options, scenarios, or archetypes in a table with left-to-right progression.

```
+--------------------------------------------------+
| Title Zone: Descriptive title                     |
+--------------------------------------------------+
| [Optional: annotation arrow spanning columns]     |
+--------------------------------------------------+
|          | Option 1 | Option 2 | Option 3 | ...  |
| [Row 1]  | [cell]   | [cell]   | [cell]   |      |
| [Row 2]  | [cell]   | [cell]   | [cell]   |      |
| [Row 3]  | [cell]   | [cell]   | [cell]   |      |
+--------------------------------------------------+
| Footer: Source | Page                              |
+--------------------------------------------------+
```

- First column: row labels/categories. Bold 10-11pt navy.
- Remaining columns: options. Headers in colored cells (navy background, white text).
- No vertical cell borders. Clean open design with row separators only.
- Left-to-right progression tells evolution or comparison story.
- Highlighted column for recommended option: cyan border or highlight.
- Target density: 75-85% fill.

### Pattern G: Agenda / Contents (Intentionally Sparse)

Agenda slides are FUNCTIONAL (navigation), not informational. They are intentionally sparse.

```
+--------------------------------------------------+
| Two-Tone   | "Contents"                           |
| Sidebar    |                                       |
| (~25%)     | > [Current Section] (highlighted)     |
|            |   Section 2                           |
| [Navy      |   Section 3                           |
|  top]      |   Section 4                           |
| [Light     |                                       |
|  bottom]   |                                       |
+--------------------------------------------------+
| Footer: Source | Page                              |
+--------------------------------------------------+
```

- Sidebar (~25%): two-tone design (navy top, light bottom). No text -- purely decorative/brand.
- Content area: "Contents" heading in bold navy 20px. 3-8 agenda items.
- Current section: highlighted with light blue background bar, bold navy 14pt.
- Other sections: regular weight navy 14pt, no background.
- Target density: 30-40% fill. This is INTENTIONAL. Scannable in <3 seconds.

### Pattern H: Cover

Cover slides introduce the document. Clean, professional, minimal.

```
+--------------------------------------------------+
| Brand Strip   | Title (very large, bold, navy)     |
| (~25-30%)     | Client / Organization Name          |
|               | Document Type                      |
| [Solid navy   | Date                                |
|  or two-tone] | CONFIDENTIAL AND PROPRIETARY       |
|               | [Firm logo placeholder]             |
+--------------------------------------------------+
```

- Brand strip (~25-30%): solid navy or two-tone navy/light. Full height. NOT a photo strip.
- Content area (~70-75%): white background. Title 28-36px bold navy (dominant element). Client name, document type, date, confidentiality notice stacked below.
- Target density: 50-60% fill in right content area. Generous whitespace is intentional.

---

## 26. Complex Diagram Patterns

### 26.1 Framework / Matrix Diagrams

**Maturity Model / Progression Layout:**
- Horizontal timeline showing phases with progressive visual treatment.
- Curved connecting arrows between phase boxes. Each phase: time label + activity description.
- Swim lane rows for different categories (activities, tools, milestones).
- Stepped color progression: lighter brand colors for early phases to darker for mature (discrete solid fills, no CSS gradients).
- 4-6 phases typical; use `display: flex` with equal-width phase columns.

**2x2 Matrix Layout:**
- Four-quadrant grid with axis labels on two dimensions.
- Rotated Y-axis label on left margin, X-axis label along bottom.
- Quadrant content: bullets, icons, or descriptions per quadrant.
- Optional: gray-out one quadrant as "out of scope" (use `opacity: 0.3` or light gray fill with "Not in scope" label).
- Use `display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr;` for equal quadrants.

### 26.2 Concentric / Layered Diagrams

**Concentric Circles / Onion Layers Layout:**
- Multiple rings radiating from center, each representing a concept layer.
- Center ring: core concept (darkest color `var(--brand-primary)`, bold label).
- Outer rings: progressively lighter (`var(--brand-secondary)` to `var(--brand-surface-light)`), peripheral concepts.
- Labels positioned along or outside each ring. Maximum 4-5 rings before readability degrades.
- HTML approach: nested `<div>` elements with `border-radius: 50%`, centered with `display: flex; align-items: center; justify-content: center;`.
- Each ring uses a discrete solid `background-color` -- no CSS gradients.

### 26.3 Hub-and-Spoke Diagrams

- Hub: large circle or rectangle containing core concept, `var(--brand-primary)` background, white bold text.
- Spokes: lines radiating to equidistant satellite boxes.
- Color-code satellites by category with legend.
- Terminal icons (via `icon-placeholder` comments) at spoke endpoints add scannability.
- HTML approach: central container with `position: relative`, satellite containers positioned with `position: absolute` around it, connecting lines via thin bordered divs.
- Used for: platform ecosystems, organizational structures, service models.

### 26.4 Process Flow Diagrams

**Circular / Cyclic Flow:**
- Continuous cycle showing numbered steps in circular path.
- Central label anchors the cycle. Curved arrows create flow direction.
- Explanatory bullets positioned outside circle with connector lines.
- 4-6 steps typical. Each step: numbered circle + label + brief description.

**Sankey / Quantitative Flow:**
- Flowing ribbons of varying widths representing quantitative flows between categories.
- Stream width proportional to volume/value. Color coding by source category.
- Labels include category names AND numerical values.
- Used for: energy flows, budget allocation, customer journeys, supply chains.

**Funnel Diagrams:**
- Progressive narrowing showing filtering/qualification stages.
- Left: visual funnel with stepped solid fills (one brand color per stage, darkest at top to lightest at bottom).
- Right: structured table with details per stage. Connecting lines link funnel segments to table rows.
- No CSS gradients -- each funnel segment is a separate `<div>` with distinct solid background color.

### 26.5 Timeline and Gantt Patterns

**Multi-Track Timelines:**
- Parallel swim lanes showing different categories evolving simultaneously.
- Each swim lane: labeled row header + horizontal bar segments on a shared time axis.
- Current-to-future comparison: left section "Current situation" + right section showing phased milestones.
- Calendar/schedule matrix: row headers = meeting types, column headers = months, triangle markers = occurrences.
- Milestone markers: triangle/diamond shapes at key decision points on Gantt bars.
- Phase grouping boxes: dotted-border rectangles grouping related events across tracks.

### 26.6 Stakeholder / Ecosystem Maps

- Entities as labeled boxes/circles positioned to show proximity/relationships.
- Connecting lines: solid for strong relationships, dashed for weak/indirect.
- Group containers: dashed borders grouping related entities.
- Size of entity element may reflect relative importance.
- Color-code entity categories: `var(--brand-primary)` for primary actors, `var(--brand-secondary)` for secondary, `var(--brand-surface-light)` for peripheral.

### 26.7 Governance / Hierarchy Tiers

**Three-Tier Hierarchy Layout:**
- Three horizontal bands showing organizational tiers.
- Each tier: "Who" (left column) + "Does" (center column) + "Frequency" (right column).
- Color coding: darkest `var(--brand-primary)` at top tier, `var(--brand-secondary)` middle, `var(--brand-surface-light)` bottom.
- Vertical connecting lines between tiers showing escalation paths.
- Bottom annotation explaining escalation/reporting flow.
- Use `display: flex; flex-direction: column;` with three band rows, each containing a 3-column grid.

### 26.8 Capability Tiles

**Categorical Grid / Capability Tiles Layout:**
- Grouped tiles showing inventory of capabilities, features, or initiatives.
- Two-tier hierarchy: category containers with individual tiles inside.
- Tiles: title + one-line description, numbered for priority (01, 02...).
- Stepped color coding: `var(--brand-primary)` navy (high priority) to `var(--brand-secondary)` (medium) to `var(--brand-gray-silver)` (lower priority) -- discrete solid fills per tile.
- Nested borders: thick outer border (`2px solid var(--brand-primary)`) for category, inner borders (`1px solid var(--brand-gray-medium)`) for items.
- HTML approach: outer `<div>` per category with header bar, inner `display: grid` or `flex-wrap: wrap` for tiles.

---

## 27. Prohibited Patterns

The following patterns are strictly forbidden in all McKinsey-style templates. Each entry includes what NOT to do and the correct alternative.

| Never Do | Do Instead | Reason |
|----------|------------|--------|
| Em-dashes (U+2014 `---`) | Colon, semicolon, or split into two sentences | Em-dashes cause rendering issues and are not McKinsey style |
| CSS variables inside `data-echarts` JSON | Always use hex values: `"color": "#1E3A5F"` | CSS variables render as BLACK in the ECharts renderer |
| Invisible containers (no border, no background, no header bar) | Every container must have at least one of: border, background color, or header bar | Content needs visible structure to be scannable |
| Prose paragraphs on content slides | Always use bullets with bold lead-ins | McKinsey slides are scannable, not readable |
| Single-word bullets | Every bullet must be a meaningful phrase (1-3 lines) | Single words waste space and communicate nothing |
| More than 4 distinct font sizes per slide | Use the 4-tier system: T1 Title, T2 Header, T3 Body, T4 Footnote | Visual consistency requires typographic discipline |
| Template-specific colors or Material Design colors | All templates share the same brand palette via `var(--brand-*)` | Brand consistency is non-negotiable |
| Data charts without insights | Every data chart MUST have an accompanying insights sidebar or panel | Charts without interpretation are just decoration |
| Empty-feeling content slides | Content slides must fill 80-92% of body height | McKinsey slides are information-dense by design |

### Allowed Exception: Scope Exclusion

To show excluded scope on framework/matrix slides, gray out the excluded area with `opacity: 0.3` or a light gray fill, and add a text label: "Not in scope" or "Outside scope of this document." This is an intentional design pattern, not a prohibited empty area.

---

*This reference guide provides comprehensive standards for creating McKinsey-quality presentations. For implementation details, see the html2pptx.md documentation.*
