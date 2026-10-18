# Pre-Flight Checklist — Before Creating Any Slide

Complete ALL items before writing HTML. If any box is unchecked, STOP and complete it.

> **3+ slides in total?** You should be a sub-agent right now — not the main orchestrator. If you are the main agent reading this for a multi-slide deck and have NOT yet called the Task tool, STOP. Go back to SKILL.md → [Multi-Slide Presentations](SKILL.md#multi-slide-presentations-sub-agent-parallelization). You MUST spawn sub-agents, not write slides yourself.

## Brand Identification (FIRST STEP)

- [ ] Is this for a specific company or generic/internal?
- [ ] If company-specific: does `branding/{company}.json` exist?
  - **YES** → Note brand ID: _________, will use `PPTX_BRAND={id}` at generation time
  - **NO** → Create brand config (copy `branding/mckinsey.json` as template, replace colors) or use default McKinsey brand
- [ ] All HTML will use `var(--brand-*)` CSS variables — NEVER hardcoded hex colors
  - [ ] No `#4CAF50` or similar green hex → use `var(--brand-positive)`
  - [ ] No `#EF5350` or similar red hex → use `var(--brand-negative)`
  - [ ] No `#FFC107` or similar amber hex → use `var(--brand-warning)`
  - [ ] No `#FF6600` or similar orange hex → use `var(--brand-accent)`
  - [ ] No `#2196F3` or similar blue hex → use `var(--brand-primary)`
  - [ ] Self-check: search your HTML for `#` followed by hex digits — if found, replace with `var(--brand-*)` variables
  - Auto-replacement exists as a safety net but produces WRONG colors — do not rely on it
- [ ] In `data-echarts` JSON: omit color properties (auto-coloring) or use hex values from the brand config

## Template Selection
- [ ] I read `slide-selection-guide.md`
- [ ] I identified the slide category: ____________ (DATA / NARRATIVE / COMPARE / STRUCTURE / EXPLAIN / FLOW)
- [ ] I identified the specific template: `examples/____________/____________.html`
- [ ] I read the example HTML file completely
- [ ] I am adapting that example (not creating from scratch)

## Pattern Quick Reference

Before writing HTML, identify which pattern applies:

| Element Type | Pattern | Reference |
|--------------|---------|-----------|
| Container with title/header | Container Box with header bar | `slide_standardisation.md` Section 2 |
| Takeaway/insight panel (dark bg) | Takeaway Box (navy + white text) | `slide_standardisation.md` Section 3 |
| Takeaway panel (light bg) | Container Box with header | `slide_standardisation.md` Section 2 |
| Chart annotation (on data points) | ECharts markPoint/markLine | ECharts docs |
| Chart annotation (around chart) | HTML overlay divs (position: absolute) | `waterfall-chart.html` example |
| Transparent annotation box | `background: transparent`, border-only | `waterfall-chart.html` example |
| Opaque callout box | `background: white`, border + shadow | `bar-with-callouts.html` example |

## Standardisation Compliance
- [ ] I read `slide_standardisation.md`
- [ ] Title zone follows Section 1 pattern (20px, bold, `var(--brand-primary)`, `var(--brand-font-heading)`)
- [ ] All font sizes use `px` units (never `pt`)
- [ ] Footer uses `Nexus | N` format with source line
- [ ] For EACH panel/column in the layout: if the inspiration shows a border, header bar, or visual enclosure, a Container Box (Section 2 pattern) is used. If unsure, default to Container Box.
- [ ] Chart title requirement: if the chart is inside a Container Box with a header bar that describes the chart, the header bar counts as the chart title. Add a minimal `<p>` title to satisfy the validator (can match the header text).

## Dependency Verification
- [ ] I ran `bash scripts/preflight_check.sh` and ALL checks passed
- [ ] LibreOffice is installed (`which soffice` returns a path)
- [ ] Poppler is installed (`which pdftoppm` returns a path)

## Content Limits
- [ ] Action titles are ≤ 90 characters each
- [ ] No slide exceeds content density limits (max 6 bullets, 6 table rows, 5 columns, 1 chart)
- [ ] All font sizes meet minimum requirements (see table below)
- [ ] No `var(--brand-*)` used inside `data-echarts` JSON attributes (causes black-box rendering)
- [ ] No em-dashes (—) anywhere in text or ECharts JSON — use colons, semicolons, or separate sentences

## Content Height Estimation (BEFORE writing HTML)

For each slide, estimate total content height BEFORE coding:

```
Available: ~325pt single-line title / ~302pt two-line title (content zone)

Your estimate:
  Charts:    ___ charts × ___pt each = ___pt
  Bullets:   ___ items × 18pt        = ___pt
  Tables:    ___ rows × 20pt + 30pt header = ___pt
  Padding:   ___ containers × 24pt   = ___pt
  Gaps:      ___ gaps × 10pt         = ___pt
                                TOTAL = ___pt
```

- [ ] Total estimated height ≤ 325pt (single-line) or ≤ 302pt (two-line) for each slide
- [ ] If exceeds: reduce content, split into multiple slides, or use side-by-side layout
- [ ] Content must fit within .content-zone — this is the actual PPTX boundary
- [ ] See `html2pptx.md` → "Overflow Prevention Formula" for detailed height math

## Chart Requirements (MANDATORY for All Charts)

### Every chart MUST have:
- [ ] Explicit `<p>` title element immediately above `data-echarts` div
- [ ] Title describes: metric name + units (e.g., "Profit by Client ($)")

### Horizontal bar charts MUST have:
- [ ] `grid.left: 100` minimum
- [ ] `grid.right: 60` minimum
- [ ] `grid.top: 30, grid.bottom: 40` minimum
- [ ] `containLabel: false`

### All chart labels MUST have:
- [ ] `fontSize: 10` minimum (never rely on defaults)
- [ ] Per-data-point labels (not series-level) for bar charts
- [ ] Conditional positioning:
  - Large values: `position: 'insideRight', color: '#fff'`
  - Small values: `position: 'right', color: '#333'`

### Chart Anti-Patterns (NEVER DO):
- Using `containLabel: true` with explicit label positioning
- Series-level labels for bar charts
- Relying on ECharts default fontSize
- No title/legend explaining what chart shows

## Font Size Requirements (HARD FLOOR — never go below)

| Element | Minimum | Recommended |
|---------|---------|-------------|
| Slide title | 16pt | 22-24pt |
| Subtitle / section header | 14pt | 16-18pt |
| Body text / bullets | 8pt | 12-14pt |
| Chart data labels | 10pt | 11-12pt |
| Chart title (p above chart) | 11px | 11-12px |
| Axis labels / legend | 10pt | 11pt |
| Source / footnote | 6.75pt (9px) | 10pt |

**If content overflows, resolve in this priority order:**
1. Resize containers to fill available space (use `flex: 1`, increase heights)
2. Reduce font size toward minimums (14px → 12px → 11px → 10px is valid)
3. Reduce padding proportionally (8pt → 6pt cell padding, 16pt → 10pt panels)
4. Reduce content (LAST RESORT — preserve verbatim quotes and data columns)
5. Split into multiple slides (only if content is essential and steps 1-4 insufficient)

The rule "reduce content not font size" applies ONLY when fonts are already AT the minimum. If fonts are ABOVE minimum (e.g., 14px body), reducing toward 10px is valid before cutting any content.

## 4-Tier Typography System (MANDATORY)

Every slide MUST use exactly these 4 tiers. Maximum 4 distinct font sizes per slide.

| Tier | Role | Size Range | CSS Example |
|------|------|-----------|-------------|
| T1 — Title | Slide title (`<h1>`) | 16-22px | `font-size: 22px;` |
| T2 — Header | Panel headers, chart titles, section labels | 11-14px | `font-size: 12px; font-weight: bold;` |
| T3 — Body | Bullet text, table cells, paragraph text | 9-11px | `font-size: 11px;` |
| T4 — Footnote | Source citations, footnotes, axis labels | 9px | `font-size: 9px;` |

- [ ] Each slide uses at most 4 distinct font sizes
- [ ] Each font size maps to one of T1-T4
- [ ] No "in-between" sizes (e.g., 16px, 18px for body text)
- [ ] Consistent tier sizes across all slides in the deck

## McKinsey Writing Style (Bullet Points)

Insight panels and narrative slides MUST use structured bullets with selective bolding:

```html
<ul style="list-style: none; padding: 0; margin: 0;">
  <li style="font-size: 11px; margin-bottom: 6pt; line-height: 1.4;">
    <strong style="color: var(--brand-primary);">Revenue grew 23%</strong>
    driven by expansion in three new markets and improved pricing strategy
  </li>
</ul>
```

- [ ] Bullet points use selective bolding (first 2-5 words in `var(--brand-primary)`)
- [ ] Bold text states the insight; remaining text provides context
- [ ] No walls of prose — use bullets for all insight/narrative content
- [ ] Maximum 6 bullets per panel

## Title Length Limits
- Maximum: 90 characters (or 2 lines at 20pt)
- Ideal: 60-80 characters (fits on 1 line)
- If too long: shorten wording or move detail to subtitle

## Common Mistakes This Prevents

| Mistake | What Happens | Prevention |
|---------|-------------|------------|
| Skipping slide-selection-guide.md | Wrong template chosen or custom HTML from scratch | Template Selection checklist |
| Not reading the example file | Missing proper spacing, zone structure, edge cases | Template Selection checklist |
| Creating HTML from scratch | Poor layout, overflow issues, validation failures | Template Selection checklist |
| Using inline snippets as starting point | Missing full structure (title-zone, footer-zone, source) | Template Selection checklist |
| Using CSS variables in ECharts JSON | Charts render as black boxes | Content Limits checklist |
| Title exceeding 90 characters | Title clipped by title zone | Content Limits checklist |
| Font size below minimums | Unreadable text in final PPTX | Font Size table |
| Too many items on one slide | Cramped, unreadable layout | Content density checklist |

## After Generation — Postflight Validation

After generating the PPTX, complete the **[`postflight-checklist.md`](postflight-checklist.md)** before delivering.
This is a separate, mandatory checklist for per-slide inspection and delivery sign-off.

---

## Visual Specification Document (VSD)

**When to create**: Before writing HTML for any complex slide (flows, SVG, frameworks, multi-panel data).
**When to skip**: Simple slides (basic bullets, single chart + takeaway) can use VSD-LITE instead.

### VSD-LITE (For Simple Slides)

Use this format when the slide is a standard chart with adjacent text/bullets. Do NOT write the full 11-section VSD for these slides.

```
## VSD-LITE: [slide name]

### 1. LAYOUT
[ASCII blueprint with panel widths in % — e.g., |--- chart 68% ---|--- bullets 32% ---|]

### 2. ELEMENTS
| # | Element | Type | Container | Count |
|---|---------|------|-----------|-------|
| 1 | ... | chart/text/shape | ContainerBox/TakeawayBox/none | N |

### 3. COLORS
| Element | CSS Variable | Hex |
|---------|-------------|-----|
| ... | var(--brand-*) | #XXXXXX |

### 3B. ZONE BACKGROUNDS (mandatory)
| Zone/Panel | Inspiration Background | CSS Implementation |
|-----------|----------------------|-------------------|
| Left panel | white | background: white (default) |
| Right panel | dark navy | background: var(--brand-primary); color: white |
| Header bars | light grey-blue | background: var(--brand-surface-light) |

Every panel background MUST match the inspiration. A dark panel rendered light = BLOCKING.

### 3C. SPATIAL LAYOUT (mandatory for framework/matrix/hub-spoke slides)
For slides with spatial arrangements (quadrants, rings, matrices, hub-spoke), draw an
ASCII spatial diagram showing how elements are arranged relative to each other:

```
+---Process efficiency---+---Efficiency mgmt---+
|                        |                      |
+------------+-----------+----------------------+
             | Voice of Customer  |
             | (center circle)    |
+------------+-----------+----------------------+
|                        |                      |
+---Mindsets/behaviors---+---Organization/Skills-+
```

This spatial arrangement MUST be reproduced exactly. Do NOT flatten a 2D spatial
layout into a linear list of boxes. If the inspiration shows a 2x2 grid around a
center element, the output MUST have a 2x2 grid around a center element.

### 4. TYPOGRAPHY
| Element | Tier | Size | Weight |
|---------|------|------|--------|
| ... | T1/T2/T3/T4 | Npx | normal/bold |

### 5. TODO (ordered implementation steps)
1. Build 3-zone skeleton
2. ...

### 6. RELATIONSHIPS (annotation-to-data mapping)
| Annotation | Target Elements | Spatial Intent | Boundary Rule |
|-----------|----------------|----------------|---------------|
| "Label X" | Bars N-M | annotates-group | Box encloses bars N through M |
```

### Full VSD Template (For Complex Slides)

## Section 1: Global Geometry — Coordinate System & Grid (G-##)

**Design Variable Category: Global Geometry (Parent)**

Establish the overall coordinate system and spatial structure before cataloging individual elements.

#### Mandatory Fields

| Field | Description | Example |
|-------|-------------|---------|
| Coordinate origin | Where (0,0) is for the layout | `top-left of content-zone` |
| Bounding box | Total available area (w x h) | `720pt x 325pt` |
| Grid logic | Columns, rows, proportions | `6 equal columns, 3 horizontal bands` |
| Primary axis | Main flow direction | `left-to-right` |
| Rotation/orientation | Any global rotation | `none` |

#### Must Produce

**1.1 ASCII zone diagram** — show all regions with approximate proportions:

```
+------------------------------------------------------------------+
| G-01: Phase Header Band (full width x 25pt)                      |
|  [Pre-Audit] [Preparation] | [Audit...] | [Post audit...]       |
+------------------------------------------------------------------+
| G-02: Column Header Band (full width x 15pt)                     |
|  [col1] [col2] | [col3] [col4] | [col5] [col6]                 |
+------------------------------------------------------------------+
| G-03: Content Band (full width x ~250pt)                         |
|  [content columns with bullet lists...]                          |
+------------------------------------------------------------------+
| G-04: Flow Strip (full width x 35pt)                             |
|  (1) --- (2) --- (3) --- (4) --- (5) --- (6)                    |
+------------------------------------------------------------------+
```

**1.2 Zone table:**

| Zone ID | Name | x | y | Width | Height | Contents |
|---------|------|---|---|-------|--------|----------|
| `G-01` | Phase header band | 0 | 0 | 100% | 25pt | Phase grouping headers |
| `G-02` | Column header band | 0 | 25pt | 100% | 15pt | Individual column headers |
| ... | ... | ... | ... | ... | ... | ... |

**1.3 Grid overlay:**

| Axis | Divisions | Sizes | Gutter |
|------|-----------|-------|--------|
| Horizontal | 6 columns | equal (flex: 1) | 0pt (shared 1px borders) |
| Vertical | 4 bands | 25pt, 15pt, ~250pt, 35pt | 0pt |

---

## Section 2: Element Registry (E-##)

Complete inventory of EVERY visual element visible in the design.

#### Mandatory Fields per Element

| Field | Description | Example |
|-------|-------------|---------|
| ID | Unique identifier | `E-01` |
| Name | Descriptive name | `"Pre-Audit" phase header` |
| Type | Primitive type from vocabulary | `rectangle` |
| Parent zone | Which G-## zone | `G-01` |
| Bounding box | x, y, width, height (relative to parent) | `x:0, y:0, w:240pt, h:25pt` |
| Visual role | Function in the design | `phase grouping header` |
| Has children | Sub-elements it contains | `yes: text label "Pre-Audit"` |

#### Type Vocabulary

`rectangle`, `rounded-rectangle`, `circle`, `outlined-circle`, `filled-circle`, `triangle`, `polygon`, `arc`, `ring`, `chevron`, `arrow`, `connector`, `dashed-line`, `solid-line`, `text-block`, `icon`, `badge`, `composite-shape`, `modified-rectangle`

#### Completion Gate

1. Count all E-## entries
2. Re-scan the design visually and count elements independently
3. If counts differ, you missed elements — go back and find them
4. Pay special attention to: decorative shapes (triangles, arrows), connectors between sections, background elements, borders that function as visual elements

---

## Section 3: Shape Construction (S-##)

**Design Variable Category: Shape Construction (Child)**

For EACH primitive shape (not composites — those are CS-##), document ALL construction properties.

#### Mandatory Fields per Shape

| Field | Description | Example |
|-------|-------------|---------|
| ID | Unique ref | `S-01` |
| Element ref | Which E-## | `E-03` |
| Base primitive | Geometric form | `rectangle` |
| Edge morphology | `straight` / `rounded` / `modified` | `modified` |
| Edge details | Per-edge description | `top: straight, right: notched, bottom: straight, left: straight` |
| Modified edges | If modified: type, dimensions, direction | `top-right corner: triangular cutout, 10x10pt, pointing down-right` |
| Dimensions | Width x height | `120pt x 25pt` |
| Aspect ratio | w:h | `4.8:1` |
| Corner radius | For rounded edges | `0` (sharp) |
| Geometry/vertices | Polygon points, arc parameters | `rect: n/a` or `triangle: "0,0 10,0 10,10"` |
| Rotation | Degrees from default | `0deg` |
| Curve direction | For arcs/curves: `concave-up` (valley) / `convex-up` (hill) / `S-curve` / `n/a` | `concave-up` |

#### Edge Morphology Vocabulary

| Term | Definition | Visual |
|------|-----------|--------|
| `straight` | Unmodified straight edge | Standard rectangle edge |
| `rounded` | Uniform corner radius on all corners | Rounded rectangle |
| `rounded-selective` | Specific corners rounded (specify which) | `top-left: 4pt, top-right: 4pt, others: 0` |
| `notched` | Material removed from edge (concave) | Triangle cut from corner, scallop indent |
| `protruding` | Material added beyond edge (convex) | Triangle extending from edge, tab protrusion |
| `chamfered` | Angled corner cut (straight, not curved) | 45-degree corner slice |
| `scalloped` | Curved indentation along edge | Decorative wave-cut edge |
| `curved-concave` | Arc that dips downward (valley shape, opens upward) | ∪ shape |
| `curved-convex` | Arc that rises upward (hill shape, opens downward) | ∩ shape |

#### Why Edge Morphology Matters

Interlocking shapes ARE edge modifications:
- A "white triangle cutout" at a corner = `notched` edge (concave, material removed)
- A "colored fill triangle" extending from an adjacent shape = `protruding` edge (convex, material added)
- The notch on Shape A + the protrusion on Shape B = interlocking joint

Documenting edge morphology FORCES you to recognize these modifications before coding, rather than discovering them after 5+ iterations.

#### Critical Shape Type Test

For any shape that is NOT a simple rectangle or circle, describe its TYPE explicitly: "radial diagram with N sections", "ascending stepped line with N steps", "funnel with N filter plates". During Phase 3 (HTML authoring), if you cannot implement this exact shape type in SVG, STOP and try harder — do NOT approximate with a different shape type.

- A radial diagram approximated as a rectangular grid = BLOCKING identity error
- A stepped ascending line rendered as a flat line = BLOCKING identity error
- A circular flow rendered as a linear sequence = BLOCKING identity error

This is the highest-priority shape check. Shape TYPE must match before shape details (colors, sizes) are validated.

#### SVG Reproduction Quality Standard

All SVG elements must be FAITHFUL, HIGH-QUALITY reproductions of the inspiration:

1. **No simplification** — recreate what you see. Do NOT substitute HTML divs for SVG shapes, or replace complex paths with simple rectangles.
2. **Interlocking shapes** (arrow boxes with white cutouts, puzzle-piece joints) — decompose per Section 5 (Composite Assembly). Every notch and protrusion gets its own S-## entry.
3. **Style preservation across iterations** — the SVG style from v1 MUST be maintained in v2, v3, etc. If v1 used gradient fills and detailed path commands, v2 cannot "simplify" to flat rectangles. Compare your VSD VS-## entries between versions — style regression = BLOCKING.
4. **Study existing examples** — before drawing ANY SVG, look at successful examples (`flow-cycle/circular-flow.html` for complex arc paths, `data-ranking/vertical-bar-chart.html` for speech bubbles with pointer tips).

---

## Section 4: Visual Skin (VS-##)

**Design Variable Category: Visual Styles (Skin)**

For EACH shape S-##, document ALL visual styling properties.

#### Mandatory Fields per Shape

| Field | Description | Example |
|-------|-------------|---------|
| ID | Unique ref | `VS-01` |
| Shape ref | Which S-## | `S-01` |
| Fill color | Exact hex or `none` | `#1E3A5F` |
| Fill type | `solid` / `linear-gradient` / `radial-gradient` / `none` | `solid` |
| Fill gradient | If gradient: angle + color stops | `n/a` |
| Fill opacity | 0.0 to 1.0 | `1.0` |
| Stroke color | Exact hex or `none` | `none` |
| Stroke weight | px or pt | `0` |
| Stroke alignment | `inside` / `centered` / `outside` | `n/a` |
| Stroke style | `solid` / `dashed` / `dotted` | `n/a` |
| Classification | `FILLED` / `OUTLINED` / `HYBRID` | `FILLED` |
| Effects | Shadow, glow, blur, etc. | `none` |
| Shadow details | offset-x, offset-y, blur, spread, color | `n/a` |

#### Classification Rules (STRICT)

| Classification | Definition | Visual Test |
|---------------|-----------|-------------|
| `FILLED` | Has fill color. No visible stroke, or stroke same color as fill | Interior is colored, edges blend with fill |
| `OUTLINED` | Transparent or white fill + visible colored stroke | Interior is white/empty, colored border visible |
| `HYBRID` | Fill color AND visible stroke of DIFFERENT color | Colored interior with contrasting border |

#### Rules

- Fill and stroke colors MUST be exact hex values. NEVER use vague terms: "blue", "dark", "approximately", "same as X"
- Every shape gets a classification. This is the #1 source of reproduction errors (e.g., rendering FILLED circles when the design shows OUTLINED circles)
- If stroke alignment is visible (thick strokes), specify whether it grows `inside`, `centered`, or `outside` the path boundary

---

## Section 5: Composite Assembly (CS-##)

For each element composed of multiple primitive shapes.

#### Mandatory Fields per Composite

| Field | Description | Example |
|-------|-------------|---------|
| ID | Unique ref | `CS-01` |
| Element ref | Which E-## | `E-05` |
| Name | Descriptive | `Interlocking phase header` |
| Primitives | List of S-## IDs | `S-03 (rect body) + S-04 (white cutout triangle) + S-05 (colored fill triangle)` |
| Assembly method | How primitives combine | `interlocking` |
| Edge interaction | How modified edges create the effect | `S-03 has notched top-right (S-04 cuts white triangle). S-05 protrudes from adjacent shape's left edge INTO the notch.` |
| Connection technique | CSS/SVG implementation | `S-04: absolute SVG at top-right. S-05: absolute SVG at left:-10pt with 4pt overlap.` |
| Z-index order | Back to front | `S-03 (back) > S-04 (mid, subtractive) > S-05 (front, additive)` |
| Visual effect | What the viewer perceives | `Adjacent shapes appear to puzzle-piece together` |

#### Assembly Method Vocabulary

| Method | Definition |
|--------|-----------|
| `overlay` | Shapes stacked at same position, different z-index |
| `adjacent` | Side by side with visible gap |
| `abutting` | Touching edge-to-edge, zero gap |
| `nested` | Child shape fully inside parent shape |
| `interlocking` | Complementary edge modifications (notch + protrusion) that fit together |
| `stacked` | Shapes layered vertically (not overlapping, but above/below) |

#### Edge Interaction Documentation

For interlocking composites, you MUST document:
1. Which shape has the notch (concave modification)
2. Which shape has the protrusion (convex modification)
3. The exact overlap distance (how far the protrusion extends into the adjacent shape)
4. The color of each primitive at the junction
5. The z-index that makes the visual effect work

#### Boolean Shape Operations (Composite Construction Logic)

When decomposing Category 5 composites, identify HOW the sub-shapes combine:

| Operation | Visual Signal | Geometric Result | SVG Technique |
|---|---|---|---|
| **Addition** (A + B) | Shape A placed on top of Shape B. Both fully visible. | Union of areas | Separate SVG elements, positioned via CSS |
| **Subtraction** (A − B) | Shape A with a region "cut away" matching Shape B's outline | A minus B overlap region | SVG `<path>` with cutout, or white-fill SVG overlay (Cat 4) |
| **Intersection** (A ∩ B) | Only the overlapping region of A and B is visible | Overlap region only | SVG `<clipPath>` (use sparingly — test pipeline survival) |

**Decision tree for composite construction**:

1. Look at the composite shape. Can you identify a "base shape" (the largest piece)?
2. Are there regions MISSING from the base? → **Subtraction**. Identify what was cut away.
3. Are there extra shapes ADDED on top of the base? → **Addition**. Identify each addition.
4. Is the result SMALLER than either input shape? → **Intersection**. Rare in slide designs.

**Worked example — "Rectangle with quarter-circle cutout" (from standard framework slide)**:

| Step | Analysis |
|---|---|
| Base shape | Rectangle (4 straight edges, 4 vertices, Cat 1) |
| Missing region | Quarter-circle at one corner |
| Boolean operation | Subtraction: rectangle − quarter-circle |
| Result shape | 3 straight edges + 1 arc edge → Cat 3 |
| Implementation | SVG `<path>` with M (moveto), L (lineto), A (arc), Z (close) |
| Path commands | `M 0,0 L W,0 L W,H-r A r,r 0 0,1 W-r,H L 0,H Z` (bottom-right cutout) |

**Key insight**: A shape that LOOKS like a rectangle but has one curved corner is NOT Category 1 — it's Category 3. The SDD Protocol (Step 1 edge counting) catches this.

---

## Section 6: Pipeline Implementation Guide (IMP-##)

**Design Variable Category: Pipeline Implementation (Constraint)**

The HTML-to-PPTX pipeline silently drops certain CSS properties. This section teaches principles for choosing implementation techniques that survive conversion — not an exhaustive dictionary of shapes, but a decision framework that works for any shape.

#### 6.1 Pipeline Limitations Table (CSS Survival)

The hard constraint. If ANY CSS property from the ✗ column appears in your implementation, STOP and use the alternative.

| CSS Property | Browser | PPTX | Alternative |
|-------------|---------|------|-------------|
| `clip-path` (all forms) | ✓ | ✗ LOST | SVG polygon/path overlay |
| `linear-gradient()` / `radial-gradient()` | ✓ | ✗ LOST | Solid color, or SVG `<linearGradient>` |
| `backdrop-filter` | ✓ | ✗ LOST | Avoid |
| `filter` (blur, drop-shadow) | ✓ | ✗ LOST | `box-shadow` (outer only) |
| `transform` (rotate, skew, scale) | ✓ | ✗ LOST | SVG `transform` attribute, or pre-transformed coordinates |
| `background-image: url()` | ✓ | ✗ LOST | `<img>` tag |
| `::before` / `::after` | ✓ | ✗ NOT RENDERED | Real DOM elements |
| `<ol>/<li>` auto-numbering | ✓ | ✗ bullets only | Manual `<p>` with number prefix |
| `background-color` | ✓ | ✓ | — |
| `border` (all variants) | ✓ | ✓ | — |
| `border-radius` | ✓ | ✓ | — |
| `box-shadow` | ✓ | ✓ (outer) | — |
| `display: flex` | ✓ | ✓ | — |
| `position` (absolute/relative) | ✓ | ✓ | — |
| `width, height, padding, margin` | ✓ | ✓ | — |
| Font styling, `text-align` | ✓ | ✓ | — |
| Inline `<svg>` | ✓ | ✓ (rasterized 2x) | **Universal fallback for all non-CSS shapes** |

#### 6.2 Shape Construction Categories

Every shape falls into one of these categories based on its geometric properties. The categories are **open and extensible** — any new shape you encounter fits one of these. Classify shapes by asking about their geometric properties, not by looking up specific shape names.

**Category 1: CSS-Native Shapes**
*Test*: Can the shape be fully described by a rectangular box + border-radius + border + background-color?

If yes → build with CSS `<div>` only. No SVG needed.

Includes: rectangles, rounded rectangles, circles (`border-radius: 50%` on square), pills/capsules, outlined shapes (transparent bg + colored border), bars, progress bars, accent strips, dashed border boxes, drop shadows.

**Category 2: SVG Polygon Shapes**
*Test*: Is the shape non-rectangular with ALL straight edges?

If yes → use inline SVG `<polygon points="...">` with explicit coordinates.

Includes but not limited to: triangles, trapezoids, pentagons, diamonds, stars, arrows, chevrons (standalone), parallelograms, hexagons, any N-sided straight-edged polygon.

```html
<svg viewBox="0 0 W H" width="Wpt" height="Hpt">
  <polygon points="x1,y1 x2,y2 x3,y3 ..." fill="COLOR"/>
</svg>
```

**Category 3: SVG Path Shapes**
*Test*: Does the shape have curved edges, arcs, or complex contours?

If yes → use inline SVG `<path d="...">` with appropriate commands (A for arcs, C/Q for bezier curves, L for lines).

Includes but not limited to: pie/donut arc segments, gauge arcs, curved arrows, brackets/braces, flow ribbons, puzzle piece contours, geographic outlines, area chart fills, any shape with curves.

For donut/gauge arcs, `<circle>` with `stroke-dasharray` + `stroke-dashoffset` is a simpler alternative to path arcs.

**Category 4: SVG Overlay on CSS Rectangle (White Mask Technique)**
*Test*: Is the shape fundamentally a rectangle with material removed from edges (notches, arrow points, angled cuts)?

If yes → use a CSS `<div>` (background color, overflow: hidden) + absolutely positioned SVG elements with white `fill` to mask away the edges.

This is the technique for interlocking shapes, chevron chains, and any shape that is "a colored rectangle with parts visually cut away."

```html
<div style="background: COLOR; position: relative; overflow: hidden;">
  <!-- Content -->
  <svg viewBox="0 0 W 2" preserveAspectRatio="none"
       style="position: absolute; top: 0; right: 0; width: Wpt; height: 100%;">
    <polygon points="..." fill="white"/>
  </svg>
</div>
```

Key attributes: `preserveAspectRatio="none"` + `height: 100%` to stretch SVG to container height.

**Category 5: Composite Shapes (assembled from multiple primitives)**
*Test*: Is the shape too complex to be a single element from Categories 1-4?

If yes → **decompose it into primitives**, each of which IS a Category 1-4 element. Then assemble using CSS positioning (flexbox, absolute positioning, grid).

The decomposition principle:
1. Identify the visual primitives (what basic geometric pieces make up this shape?)
2. Classify each primitive into Category 1-4
3. Choose the implementation technique for each primitive independently
4. Assemble using CSS layout (flex, grid, position)
5. Verify no ✗ CSS is used in any primitive

**Examples of composite decomposition:**

| Complex Shape | Decomposition | Technique per Primitive |
|--------------|---------------|----------------------|
| Chevron chain (interlocking) | N colored divs (Cat 1) + white SVG overlays on edges (Cat 4) | CSS divs with `gap: 0`, SVG arrow/notch overlays |
| Hub-spoke diagram | Center circle (Cat 1) + radiating lines (Cat 3: SVG lines) + outer circles (Cat 1) | CSS circles + SVG `<line>` elements |
| Funnel with labels | Stacked trapezoids (Cat 2: SVG polygons) + text overlays (Cat 1: CSS divs) | SVG polygons + absolutely positioned text divs |
| Timeline with milestones | Horizontal bar (Cat 1) + triangle markers (Cat 2) + label boxes (Cat 1) + connectors (Cat 3) | CSS bar + SVG triangles + CSS rounded divs + SVG lines |
| Waterfall chart | Floating bars (Cat 1: positioned CSS divs) + bridge connectors (Cat 3: SVG lines) | CSS divs with calc'd top + SVG lines |
| Dashed line + arrowhead | Dashed border (Cat 1: CSS `border-top: dashed`) + triangle tip (Cat 2: SVG polygon) | Flexbox row: CSS div + SVG element |
| Donut chart with center text | Arc segments (Cat 3: SVG circle+dasharray) + center label (Cat 1: CSS div) | SVG ring overlaid with absolutely positioned CSS text div |
| Maturity model (stair-step) | Stair path (Cat 3: SVG path with L commands) + level labels (Cat 1: CSS divs) + arrow (Cat 2: SVG polygon) | SVG for stair outline + CSS for labels |
| Pillar diagram | Column bodies (Cat 1: CSS tall divs) + top cap bar (Cat 1: CSS div) + base platform (Cat 1: CSS div) | Pure CSS flexbox layout |
| Venn diagram | Overlapping circles (Cat 3: SVG circles with fill-opacity) + intersection labels (Cat 1: CSS divs) | SVG circles + positioned CSS text |
| Radial diagram (circle + sectors) | Center circle (Cat 3) + 4 sector shapes (Cat 3: rect − quarter-arc each) | SVG `<circle>` + 4 SVG `<path>` elements with arc commands |
| Tapered/wedge bar | Non-parallel-sided polygon (Cat 2) | SVG `<polygon points="x1,y1 x2,y2 x3,y3 x4,y4">` |

**The table above is illustrative, not exhaustive.** Any complex shape you encounter can be decomposed using the same principle. If a primitive doesn't fit Categories 1-4, that's a signal the decomposition isn't granular enough — break it down further.

#### 6.3 Connection Inventory (IMP-05)

For EVERY visual connection visible in the inspiration (lines, arrows, brackets, leader lines, reference lines, gradient ribbons), document:

| Field | Description | Example |
|-------|-------------|---------|
| Connection type | A-H from §12 of slide_standardisation.md | `Type C: Leader line` |
| Source element | Element the connection starts from | `Callout box E-20` |
| Target element | Element the connection points to | `Bar segment at x=280` |
| Line style | Dashed/solid, color, width | `dashed, #A2AAAD, 1.5px` |
| Positioning method | CSS/SVG/ECharts technique | `SVG <line> in absolute-positioned SVG overlay` |

**Count total connections.** This count MUST match the number of connection elements in the HTML. If the inspiration shows 4 connections, the HTML must have 4 connection elements. Missing connections = FAIL.

#### 6.3b Pattern Recognition (IMP-06)

Before finalizing the connection inventory, scan for these OFTEN-MISSED visual patterns. Agents frequently fail to recognize these because they don't match familiar shapes:

| You See In Inspiration | What It Is | Connection Type | How To Build |
|------------------------|---------|-----------------|-------------|
| Colored diagonal bands from chart to side panel | Gradient ribbon connectors | Type G | SVG polygon with linearGradient fill |
| Two horizontal dashed lines with label/pill between them | Delta annotation | Type D × 2 + markPoint | 2 markLine entries + markPoint for pill |
| Line from callout box to chart data point | Leader line | Type C / Type H | SVG `<line>` with full span (NOT a 25px stub) |
| Arrow/chevron between two panels | Flow connector | Type B | SVG as flex SIBLING (not inside either panel) |
| Vertical dashed lines between diagram and description | Zone connector | Type A | CSS border-left in flex center |
| Bracket grouping chart segments | Annotation bracket | Type F | SVG `<path>` overlay |
| Column of ovals/circles beside a chart | Growth indicators | NOT a connection — use §15.8 | Structured flex column BESIDE chart |

**RECOGNITION GATE**: If the inspiration has a stacked bar chart with insight panels, ASK:
1. Are there colored bands or ribbons between chart and panels? → Add Type G connections
2. Are there growth percentages near the chart? → Count as annotations, use §15.8 flex column
3. Do callout lines actually REACH from box to data? → Verify line length (Type H)

If you cannot answer these questions, re-examine the inspiration more carefully.

#### 6.4 Mandatory IMP-## Entry

For EACH composite CS-## and each non-rectangular shape S-## in the VSD, add an IMP-## entry:

| Field | Description | Example |
|-------|-------------|---------|
| ID | `IMP-01` | |
| Shape ref | CS-## or S-## | `CS-01` |
| Category | 1-5 from 6.2 | `Category 4 (SVG overlay on CSS rect)` |
| Primitives (if Cat 5) | List decomposed parts + their categories | `Cat 1 div + Cat 4 right-arrow SVG + Cat 4 left-notch SVG` |
| Pipeline check | Confirm no ✗ CSS from 6.1 | `No clip-path, no gradient — PASS` |

---

## Section 7: Positional Relationships & Spacing (R-##)

**Design Variable Category: Positional Relationships & Spacing**

#### 7.1 Inter-Element Spacing (Gutters)

| Element A | Element B | Gap type | Distance | Direction |
|-----------|-----------|----------|----------|-----------|
| `E-01` | `E-02` | gutter | `0pt (shared 1px border)` | horizontal |
| `E-07` | `E-08` | gutter | `0pt (shared 1px border)` | horizontal |

#### 7.2 Nesting Logic (Parent-Child Containment)

| Parent | Children | Arrangement | Nesting Description |
|--------|----------|-------------|---------------------|
| `E-10` | `E-11, E-12` | stacked vertical | `E-11 (number) centered above E-12 (label), both centered within circle E-10` |
| `E-01` | `E-15` | centered | `Text "Pre-Audit" centered horizontally and vertically within header rectangle` |

Nesting descriptions MUST use precise spatial language:
- "head of A sits flush inside tail of B"
- "centered within parent, 4pt inset from all edges"
- "left-aligned to parent's inner edge with 6pt left padding"
- "top-aligned, spanning full parent width minus 8pt horizontal padding"

#### 7.3 Padding (Internal Spacing)

Space between a container's edge and its child content.

| Container | Top | Right | Bottom | Left |
|-----------|-----|-------|--------|------|
| `E-01` | `4pt` | `6pt` | `4pt` | `6pt` |
| `E-07` | `4pt` | `4pt` | `4pt` | `4pt` |

#### 7.4 Margins (External Spacing)

Space between an element's outer edge and its neighboring elements.

| Element | Top | Right | Bottom | Left |
|---------|-----|-------|--------|------|
| `E-01` | `0` | `0 (shared border)` | `0` | `0` |

Use `0` explicitly if there is no margin. Never leave blank.

#### 7.5 Alignment Axes

| Axis ID | Type | Elements Sharing This Axis |
|---------|------|---------------------------|
| `A-01` | vertical | `E-01 left edge, E-07 left edge, E-13 left edge` |
| `A-02` | horizontal | `E-01 top, E-02 top, E-03 top` |
| `A-03` | vertical-center | `E-10 center, E-16 center (circle centered under column)` |

#### 7.5b Marker & Milestone Positions (Semantic Precision)

For timeline/roadmap slides with milestone markers:

| Marker Position | Position Rule | Semantic Meaning |
|----------------|--------------|-----------------|
| Between columns | Centered on column boundary (50% of gap) | Transition point between phases |
| At column start | Left edge of column | Beginning of phase |
| At column end | Right edge of column | End of phase |

Document the EXACT position of each marker as a fraction of the column it relates to. A marker at "between month 3 and month 6" is at the boundary — placing it inside month 3's column changes the meaning. Wrong marker placement = BLOCKING semantic error.

#### 7.6 Adjacency & Interlocking Relationships

| Element A | Element B | Relationship | Detail |
|-----------|-----------|-------------|--------|
| `E-03` | `E-04` | `interlock-right-to-left` | `Right edge of E-03 has notch; left edge of E-04 has protrusion filling that notch` |
| `E-01` | `E-02` | `abutting` | `Shared 1px border, no gap` |
| `E-13` | `E-14` | `connected-by-line` | `Dashed horizontal line connects circle E-13 to circle E-14` |

#### Relationship Vocabulary

| Relationship | Definition |
|-------------|-----------|
| `adjacent` | Side by side with visible gap |
| `abutting` | Touching, zero gap (may share border) |
| `interlock-{direction}` | Complementary edge modifications that mesh (specify direction: right-to-left, top-to-bottom, etc.) |
| `overlap` | One element partially covers another (specify overlap distance in pt) |
| `contain` | One element fully inside another |
| `connected-by-line` | Joined by a connector element (line, arrow, dashed line) |
| `aligned-{axis}` | Share an alignment line (vertical or horizontal) |
| `centered-within` | Centered inside a parent element |
| `annotates-group` | Element visually labels/annotates a group of other elements. Its boundaries should encompass or bracket the target elements. Document which elements it annotates. |
| `labels` | Element is a text label for a specific element. Should be positioned adjacent to or inside its target. |
| `brackets` | Element visually groups elements with a bracket, brace, or connecting line. Should span the full width/height of the grouped elements. |

#### Annotation-to-Data Mapping (for chart slides)

When a slide has annotations that label chart elements (bars, segments, groups), document the mapping explicitly:

| Annotation | Target Elements | Spatial Intent | Boundary Rule |
|-----------|----------------|----------------|---------------|
| `E-20` "Augmentation des volumes LDA" | Bars 2-3 (Perte Wallonie, Gain Flandre) | `annotates-group` | Box left edge = bar 2 left edge. Box right edge = bar 3 right edge. Box encompasses bars + labels. |

This mapping is MANDATORY for chart annotation slides. Without it, you cannot validate whether annotations are correctly positioned.

#### Annotation Spatial Rules (MANDATORY for chart slides)

1. **Highlight shapes** (polygons, brackets, shaded regions that visually link data across bars/segments): Each highlight shape MUST be a separate E-## entry with its own S-##, VS-##, and R-## entries. These are NOT optional decorations — they carry analytical meaning. Missing highlight shape = BLOCKING.

2. **Snug sizing**: Annotation/highlight boxes must TIGHTLY encompass their target elements + labels. The box boundary should be flush with the outermost target element edges (±4pt padding). An oversized box that covers half the chart = WRONG. A box that precisely frames its 2-3 target bars = CORRECT.

3. **Spatial connection**: Annotations MUST remain spatially connected to their target data. Moving an inline observation to a disconnected box elsewhere on the slide BREAKS the annotation-to-data relationship documented in R-##. If the inspiration shows an annotation NEXT TO specific bars, your output must show it NEXT TO those same bars.

4. **No chart obstruction**: Callout/annotation boxes must NOT overlay chart data areas such that data becomes unreadable. Position callouts OUTSIDE the chart grid area, or use semi-transparent backgrounds (opacity ≤ 0.15) if overlapping is unavoidable.

5. **Overlay positioning precision**: When placing overlays on charts (ECharts or SVG),
   calculate positions from the chart's coordinate system. For ECharts: account for
   `grid.left`, `grid.right`, `grid.top`, `grid.bottom` margins. A highlight at "bar N"
   must be positioned at `grid.left + (barIndex × barWidth)` relative to the chart wrapper —
   not at an estimated absolute position. Imprecise overlay positioning misrepresents data.

---

## Section 8: Color Map (CLR-##)

#### Color Table

| ID | Hex | CSS Variable | Usage Types | Used By (VS-## refs) |
|----|-----|-------------|-------------|---------------------|
| `CLR-01` | `#1E3A5F` | `var(--brand-primary)` | fill, text | `VS-01, VS-03, VS-07` |
| `CLR-02` | `#2E75B6` | `var(--brand-surface-light)` | fill, stroke, text | `VS-02, VS-04, VS-10` |
| `CLR-03` | `#FFFFFF` | n/a | fill | `VS-05, VS-06 (cutout shapes)` |
| `CLR-04` | `#333333` | `var(--gray-dark)` | text | `TYP-05, TYP-06` |

#### Gradient Definitions (if any)

| Gradient ID | Type | Angle | Stops |
|-------------|------|-------|-------|
| `GRD-01` | linear | 90deg | `#1E3A5F 0%, #2E75B6 100%` |

#### Rules

- Every color that appears in ANY VS-## entry MUST appear in this table
- Every CLR-## MUST list ALL VS-## entries that use it (cross-reference check)
- Hex values must be exact. No "approximately" or "similar to"
- If a color maps to a CSS brand variable, note both the hex AND the variable name

---

## Section 9: Typography & Content (TYP-##)

**Design Variable Category: Content & Typography (Sub-Children)**

#### Per Text Element

| Field | Description | Example |
|-------|-------------|---------|
| ID | Unique ref | `TYP-01` |
| Element ref | Which E-## | `E-15` |
| Content | Exact text | `"Pre-Audit"` |
| Font family | CSS font-family | `Arial, sans-serif` |
| Font size | px or pt | `9px` |
| Font weight | `normal` / `bold` / numeric | `bold` |
| Color | CLR-## ref + hex | `CLR-03 (#FFFFFF)` |
| H-alignment | `left` / `center` / `right` | `center` |
| V-alignment | `top` / `middle` / `bottom` | `middle` |
| Line height | Multiplier or px | `1.2` |
| Role tier | T1 / T2 / T3 / T4 | `T2 (header)` |

**H-alignment and V-alignment are SEPARATE fields.** A text element can be `center` horizontally but `top` vertically. Always specify both.

#### Iconography (if present)

| Icon ID | Type | Size | Relative To | Container |
|---------|------|------|-------------|-----------|
| `ICO-01` | checkmark | 12px | 60% of badge height | `circle badge E-20` |

#### Role Group Verification

Group all TYP-## entries by role tier:

| Tier | Elements | Font Size | Consistent? |
|------|----------|-----------|-------------|
| T1 (title) | `TYP-01` | 18px | yes (1 element) |
| T2 (header) | `TYP-02, TYP-03, TYP-04` | all 9px | yes |
| T3 (body) | `TYP-05 through TYP-10` | all 7px | yes |

**Within each tier, ALL elements MUST use the same font-size.** Cross-tier ratios should match the design (e.g., T1:T2 = 2:1).

---

## Section 10: Scale & Constraints (SC-##)

**Design Variable Category: Logic of Scale (Behavior)**

#### Per Element

| Element | Sizing Mode | Repetition | Aspect Lock | Constraint Notes |
|---------|-------------|------------|-------------|-----------------|
| `E-01` | `proportional (flex: 1)` | `6 columns` | no | All 6 columns equal width, height fills band |
| `E-10` | `fixed (30pt x 30pt)` | `6 circles` | yes (1:1) | Must remain circular, never elliptical |
| `S-04` | `fixed (10pt x 10pt)` | `5 instances` | yes (1:1) | One per interlocking joint, size locked |

#### SVG ViewBox Sizing Rule

SVG `viewBox` dimensions must give enough space for the shape content to be visible:

- A stepped line with 3 steps needs viewBox height >= 3x the step size
- A curve with amplitude A needs viewBox height >= 2A
- If viewBox height is too small, vertical features collapse to a flat line

Example: An ascending stair-step line with 3 steps of 15pt each needs `viewBox="0 0 600 60"` minimum — NOT `viewBox="0 0 600 18"` (which would flatten the steps).

#### Sizing Modes

| Mode | Definition |
|------|-----------|
| `fixed` | Exact px/pt dimensions, does not change |
| `proportional` | Percentage or flex-based, scales with parent |
| `min-max` | Has minimum and maximum bounds |
| `content-driven` | Sized by its text/content (e.g., auto-height) |

#### Repetition Patterns

For repeated elements, document:
- **Count**: How many instances
- **Spacing pattern**: Equal spacing, varying spacing, or specific distances
- **Identical properties**: Which properties are the same across all instances (size, color, shape)
- **Varying properties**: Which properties differ (content text, specific colors)

Example: "6 content columns: all same width (flex: 1), same header height (15pt), varying content height (auto), same border style (1px solid #ccc)"

---

## Section 11: VSD Summary & Generation TODO

#### 11.1 Cross-Reference Verification

Before coding, verify ALL cross-references are complete:

- [ ] Every E-## has a corresponding S-## (shape) or CS-## (composite)
- [ ] Every S-## has a corresponding VS-## (visual skin)
- [ ] Every element containing text has a TYP-## entry
- [ ] Every adjacent element pair has an R-## relationship entry
- [ ] Every color in any VS-## appears in the CLR-## table
- [ ] Every CLR-## lists ALL shapes that use it
- [ ] Element count in E-## registry matches independent visual re-count
- [ ] Every CS-## lists ALL its primitive S-## refs
- [ ] Every container in R-## 7.3 has padding values (use `0` if none)
- [ ] Every element in R-## 7.4 has margin values (use `0` if none)
- [ ] At least one alignment axis documented in R-## 7.5
- [ ] Every annotation element has an R-## entry documenting which elements it `annotates-group`, `labels`, or `brackets`
- [ ] Every CS-## and non-rectangular S-## has an IMP-## entry (Section 6.3)
- [ ] Every IMP-## cites a Category from Section 6.2 and uses ONLY ✓ CSS from Section 6.1

#### 11.2 Generation TODO List

Convert the VSD into a numbered implementation checklist. Each TODO references specific VSD IDs:

```
1. Create global layout grid per G-01: 6 columns, 4 bands (25pt + 15pt + ~250pt + 35pt)
2. Build zone G-01: phase header band with 3 phase groups
3. Build shape S-01 per VS-01: rectangle, FILLED #1E3A5F, spanning columns 1-2
4. Add edge modification per S-01: notched top-right corner (S-04: white triangle 10x10pt)
5. Build fill protrusion S-05 per VS-05: colored triangle #1E3A5F extending from left edge of next phase group
6. Assemble composite CS-01: S-01 + S-04 + S-05 per interlocking assembly method
7. Position per R-01: E-01 abuts E-02 with shared border, aligned on axis A-02
8. Add text TYP-01: "Pre-Audit" centered (H+V) within E-01, 9px bold white
...
```

#### 11.3 Completion Gate

**The VSD is INVALID and you MUST NOT proceed to coding if ANY of these are true:**

- Any mandatory field in any section table is blank or contains vague terms ("blue", "approximately", "same as")
- Element count in registry doesn't match independent visual re-count
- Any shape S-## has no corresponding VS-## entry
- Any adjacent element pair has no R-## relationship entry
- Any composite CS-## has fewer primitives listed than visible in the design
- No alignment axes documented in R-## 7.5
- Padding or margin fields left blank (use `0` for none, never leave empty)
- Any CLR-## hex value is approximate rather than exact
- Edge morphology not documented for shapes with modified edges
- Cross-reference verification (11.1) has unchecked items
- Any CS-## or non-rectangular S-## is missing an IMP-## entry (Section 6.3)
- Any IMP-## uses a CSS property from the ✗ column in the Pipeline Limitations Table (Section 6.1)
- Any Category 5 (composite) IMP-## is missing per-primitive category decomposition
- A shape implementation technique was not verified against Section 6.1 before full slide coding
- Any shape with curved edges (arcs, bezier paths) missing a Curve direction field

**After generation**, use the Visual Validation Protocol section below in postflight-checklist.md to validate the rendered thumbnail against this VSD.

---

### Annotation Positioning Algorithm (APA)

**When to use**: Before writing ANY chart annotation in `data-echarts` config.

APA prevents trial-and-error positioning by using NATIVE ECharts features
that auto-position from data coordinates. Zero pixel math required.

#### STEP 1 — CLASSIFY THE ANNOTATION

| Type | Visual Pattern | Technique | How to Build |
|------|---------------|-----------|-------------|
| **Delta pill** | Rounded pill showing % change between two levels | `markLine` two-point mode | Two markLine pairs: horizontal + vertical with pill label. See §3 in `html2pptx.md (Chart Annotations section)` |
| **Callout box** | Box with leader line pointing to data | `$callouts` on series | Declarative array on series. Pipeline generates label + labelLayout + labelLine. See §4 in `html2pptx.md (Chart Annotations section)` |
| **Data label** | Number/% near a data point | `markPoint` or series `label` | Native ECharts |
| **Reference line** | Horizontal/vertical dashed line at a threshold | `markLine` | Native ECharts |
| **Highlight region** | Shaded area behind bars/lines | `markArea` | Native ECharts |
| **Custom decorative shape** | Non-data shape (logo, bracket, etc.) | `graphic` + percentage positioning | §5 in `html2pptx.md (Chart Annotations section)` |

**CRITICAL**: Delta pills and callout boxes use NATIVE ECharts features (markLine / $callouts).
Do NOT use `graphic` groups for these. Do NOT use HTML overlay divs.

#### STEP 2 — BUILD THE ANNOTATION

**A. Delta pill (markLine two-point mode):**

Use two markLine data pairs: (1) horizontal reference line, (2) vertical arrow with pill label.

```json
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
```

How to choose values:
- Horizontal line: `xAxis`/`yAxis` = start and end category + the value level
- Vertical arrow: `xAxis` = the category where arrow sits, `yAxis` = from top level to bottom level
- `position: "middle"` centers the pill label on the vertical segment
- Pipeline auto-resolves `var(--brand-*)` — use brand tokens, not hex

**B. Callout box ($callouts on series):**

Add `$callouts` array to the series object. Pipeline generates everything.

```json
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
      "text": "Drop in 2012 as a result\nof demand decrease",
      "position": "left",
      "offsetX": -200,
      "offsetY": 20
    }
  ]
}]
```

Schema: `dataIndex` (required), `text` (required), `position` ("left"/"right", required),
`offsetX` (default: -200 for left, +160 for right), `offsetY` (default: 0),
`style` (optional overrides: backgroundColor, borderColor, borderWidth, padding, color, fontSize, lineHeight, width),
`lineStyle` (optional: color, type, width for leader line).

**$callouts positioning — CRITICAL (rule 57):** Before setting offsetX, identify where data is sparse:
- Line charts with peaks: place callouts in troughs (away from high values)
- Bar charts: place callouts above bars or in gaps between categories
- When space is needed outside data: increase `grid.right`/`grid.left` ≥ 170px
- The pipeline detects annotations covering data and emits BLOCKING errors

**C. Other annotations**: Use `markPoint`, `markLine`, `markArea` directly — they are native ECharts.

**D. Custom decorative shapes** (not attached to data): Use `graphic` + percentage positioning (§5 in html2pptx.md (Chart Annotations section)).

#### STEP 3 — GUARDS

Before writing any chart config with annotations:

1. **Axis break guard**: For line charts with wide data ranges (max > 5× min non-zero value),
   ALWAYS add `"breaks": []` to the yAxis to prevent auto-axis-break distorting annotation positions.

2. **JSON formatter warning**: ECharts config is JSON — formatters must be strings (`"{value}"`),
   NOT JavaScript function expressions. The pipeline handles function callbacks internally.

3. **No graphic for pills/callouts**: If you find yourself writing `"graphic": [{ "type": "group", ... }]`
   for a delta pill or callout box, STOP. Use markLine two-point or $callouts instead.

4. **markLine pill rotation guard**: The pipeline auto-applies `rotate: 0` to all markLine,
   markPoint, and markArea labels by default — text stays horizontal. If rotation still occurs
   (e.g. agent explicitly overrides with a non-zero rotate), the vertical markLine segment that
   carries the pill label must span at least 15-20% of the y-axis range. For small gaps, put
   the pill label on the horizontal line instead.

5. **$callouts symbol guard (handled by pipeline)**: `$callouts` uses `labelLayout` which
   requires renderable symbols. The pipeline auto-converts `symbol: "none"` to `symbol: "circle",
   symbolSize: 1`. You do NOT need to handle this — just write `symbol: "none"` if you want and
   the pipeline fixes it. But be aware: if you use `$callouts`, the chart will have tiny
   1px dots at data points (usually invisible).

6. **Technique fallback protocol**: If markLine label rotates or $callouts boxes
   overlap after the first attempt, DO NOT switch to a different technique:
   - markLine rotation → fix coordinates/yAxis range (see §3 troubleshooting in
     html2pptx.md (Chart Annotations section)).
   - $callouts overlap → increase grid margins FIRST, then adjust offsetX
     (see §4 positioning guide in html2pptx.md (Chart Annotations section)).
   - If 3 iterations of the SAME technique don't resolve it, the issue is in
     your DATA VALUES or GRID CONFIG, not the technique itself.

7. **Decoration guard**: Before writing ANY of these ECharts properties, verify they appear in the inspiration. If the inspiration doesn't show them, do NOT add them:
   - `areaStyle` (shaded fill under line/area charts)
   - `smooth: true` (curved lines instead of angular)
   - `shadowBlur` / `shadowColor` (drop shadows on elements)
   - `emphasis` effects (hover state styling — invisible in PPTX anyway)
   - `label.show: true` on series when inspiration shows no data labels
   - Extra `markLine` / `markArea` not visible in inspiration

   If you are not sure whether the inspiration shows it, it probably doesn't. Match the inspiration EXACTLY — no more, no less.

8. **Hypothesis testing guard**: Before accepting ANY technical limitation during implementation
   (Phases 3-5), you MUST have TESTED it by running the pipeline. Statements like "I believe X
   doesn't work" or "X is not supported" without a test run = rationalization per ARP Pre-Step.
   - WRONG: "ECharts doesn't support min:90, so I'll keep the 0-270 range with dead space."
     (Never tested — min:90 works fine and eliminates 33% dead space.)
   - WRONG: "I can't split this series into solid+dashed, so I'll make it all dashed."
     (Never tested — two overlapping series with shared data point works.)
   - RIGHT: "I tried min:90 and the chart renders correctly. Dead space reduced from 40% to 5%."
   - RIGHT: "I split series into actual (solid) + forecast (dashed) with shared point at year 6. Both render correctly."

   **Trigger**: Any time you write "doesn't work", "not supported", "can't be done", "unavoidable",
   or "limitation" about a technical approach — Guard #8 fires. TEST IT FIRST.

#### STEP 4 — MANDATORY ANNOTATION TABLE

Before writing the data-echarts JSON, fill in this table for EVERY annotation:

```
ANNOTATION TABLE:
| # | Type | Describes | Technique | Key Values | Notes |
|---|------|-----------|-----------|------------|-------|
| 1 | Delta pill | -40% change | markLine two-point | horiz: 2006→2012 at y=62, vert: y=62→31 at x=2012 | Pill label at middle of vertical |
| 2 | Callout | Peak at year 11 | $callouts | dataIndex=5, position=left, offsetX=-200 | Leader line auto-generated |
| 3 | Reference line | Target threshold | markLine single | yAxis: 47, label: "Target" | Standard markLine |
```

This table replaces the old spatial budget check. Native ECharts features handle positioning
from data coordinates — no pixel math, no edge overflow, no auto-flip needed.
