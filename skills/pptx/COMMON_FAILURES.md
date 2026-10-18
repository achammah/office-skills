# Common Slide Failures — Quick Reference

Diagnose and fix the most frequent PPTX production issues.

---

## 1. Charts Render as Black Boxes

**Symptom**: Chart area shows solid black or no visible data in the final PPTX.

**Cause**: CSS variable `var(--brand-*)` used inside `data-echarts` JSON. ECharts renders server-side in Node.js — there is no DOM, so CSS variables are not resolved. The literal string `"var(--brand-primary)"` is passed to ECharts, which renders it as black.

**Fix**: Remove all explicit color properties from `data-echarts` JSON. The auto-coloring system in `render_echarts.mjs` applies the full brand palette automatically.

```html
<!-- WRONG — renders as black box -->
<div data-echarts='{"series":[{"type":"bar","itemStyle":{"color":"var(--brand-primary)"},"data":[10,20,30]}]}'>
</div>

<!-- CORRECT — auto-coloring applies brand palette -->
<div data-echarts='{"series":[{"type":"bar","data":[10,20,30]}]}'>
</div>

<!-- ALSO CORRECT — explicit hex from brand config -->
<div data-echarts='{"series":[{"type":"bar","itemStyle":{"color":"#1E3A5F"},"data":[10,20,30]}]}'>
</div>
```

**Key rule**: `var(--brand-*)` works in HTML/CSS styles but NEVER inside `data-echarts` JSON attributes.

---

## 2. Title Cut Off at Top

**Symptom**: Title text is clipped, truncated, or overflows the title zone.

**Cause**: Action title (`<h1>`) exceeds 90 characters. The title zone is 40pt tall (min-height), which fits approximately 2 lines at 20pt font size.

**Fix**:
- Shorten the title to ≤ 90 characters (ideal: 60-80 characters for 1 line)
- Move detail to the subtitle (`<p class="subtitle">`)

```html
<!-- WRONG — 115 characters, will be clipped -->
<h1>Digital transformation initiative delivers 23% cost reduction across all business units while improving customer satisfaction scores</h1>

<!-- CORRECT — 78 characters, fits on 1-2 lines -->
<h1>Digital transformation delivers 23% cost reduction across all units</h1>
<p class="subtitle">Customer satisfaction scores also improved year-over-year</p>
```

---

## 3. Text Unreadable in Tables/Charts

**Symptom**: Text is too small to read at normal zoom level in the final PPTX.

**Cause**: Font size set below the minimum floor. Common with dense tables or charts with many labels.

**Fix**: Use the minimum font sizes below. If content doesn't fit at these sizes, reduce content — not font size.

| Element | Minimum | Recommended |
|---------|---------|-------------|
| Slide title | 16pt | 20-24pt |
| Subtitle / section header | 11pt | 14-16pt |
| Body text / bullets | 8pt | 11-14pt |
| Chart data labels | 8pt | 11-12pt |
| Axis labels / legend | 8pt | 11pt |
| Source / footnote | 6.75pt (9px) | 10pt |

**If content doesn't fit at minimum sizes**:
- Fewer bullet points (max 6 per slide)
- Shorter text / abbreviations
- Split across multiple slides
- Simpler chart (fewer data points)

---

## 3.5 Content Zone Overflow (BLOCKING ERROR)

**Symptom**: Generation fails with error `[STRICT] content-zone overflows by Npt` or warnings about content exceeding available space.

**Cause**: The `.content-zone` in HTML exceeds the available PPTX usable area. Content-zone boundaries are now strictly enforced. The HTML `.content-zone` maps 1:1 to the physical content area in PPTX (approximately 325pt with single-line title). A 3pt tolerance accounts for rendering differences between browser and PPTX engines.

**Fix — in priority order:**
1. **Reduce font sizes** (stay above minimums: title 16pt, body 8pt, footnote 6.75pt/9px)
2. **Tighten spacing** (reduce padding, margins, gaps between elements)
3. **Remove content** (only as last resort — fewer bullets, smaller tables, simpler charts)

**Key measurements:**
- Usable slide width: 708pt (was 680pt)
- Title zone min-height: 40pt with padding 12pt 6pt 8pt 6pt (was 60pt / 12pt 20pt)
- Content zone available: ~325pt for single-line title (was ~280pt)
- Content/Footer zone padding: 0 6pt (was 0 20pt)

**Prevention**: Design content to fill 70-85% of the ~325pt available space, leaving buffer for rendering tolerance.

---

## 4. Slide Looks Cramped

**Symptom**: Content feels squeezed together, insufficient whitespace, elements overlapping.

**Cause**: Too many content items on a single slide — exceeded density limits.

**Fix**: Respect the content density maximums and split content across slides:

| Element | Maximum | If Exceeded |
|---------|---------|-------------|
| Bullet points | 6 per slide | Split across slides |
| Table columns | 5-6 columns | Transpose or use 2 slides |
| Table data rows | 6 rows | Split across slides |
| KPI cards | 6 per slide | Use dashboard grid or split |
| Charts | 1 per slide | Split across slides |
| Total content items | 8 items | Prioritize and split |

**Rule of thumb**: If you need to shrink fonts below the minimums to fit content, you have too much content on the slide.

---

## 4.5 Text Overlaps Graphics or Adjacent Elements (BLOCKING ERROR)

**Symptom**: Text bleeds into adjacent SVG diagrams, labels overlap with container headers, or elements at the same z-level visually collide in the PPTX output.

**Cause**: Flex children or positioned elements exceed their allocated space. The pipeline runs recursive overlap detection (v3.7) — statically positioned text-bearing elements overlapping by >200px² triggers a **BLOCKING** error. (Intentional overlaps like annotation boxes over chart bars are excluded.)

**Fix — in priority order:**
1. **Add explicit gaps between flex children**: `gap: 8pt` on the flex container
2. **Constrain SVG/graphic width**: If SVG sits next to text, `width + gap ≤ allocated space`
3. **Use overflow: hidden** on containers to prevent bleed (but check for text clipping — see 4.6)
4. **Reduce content** if space is genuinely insufficient

| Pattern | Result |
|---------|--------|
| Two flex children with no gap | BLOCKING overlap error |
| SVG wider than its column | BLOCKING overlap error |
| `gap: 8pt` between all flex children | Passes overlap check |
| SVG `width: 45%` + text `flex: 1` with `gap: 8pt` | Clean separation |

**Key rule**: Adjacent elements must maintain >=8px gap. The pipeline checks this automatically.

---

## 4.6 Text Clipped Inside Flex Cells (WARNING)

**Symptom**: Text appears truncated or cut off within table cells, grid columns, or flex containers in the PPTX. Content is there in the HTML but not visible in the output.

**Cause**: A flex child's content exceeds its allocated height. Browser shows it (with scrolling), but PPTX clips it. The pipeline checks every flex cell for `scrollHeight > clientHeight + 8px` (v3.7) — significant overflow triggers a prominent **WARNING** with exact measurements.

**Fix — in priority order:**
1. **Reduce font size** (respect minimums: body 9px, footnote 9px)
2. **Shorten text** (abbreviate, remove words)
3. **Increase container height** (reduce other elements to make room)
4. **NEVER use `overflow: hidden`** on text containers — it masks the problem

```html
<!-- WRONG — text will be clipped -->
<div style="flex: 1; height: 80pt; overflow: hidden;">
  <p style="font-size: 11px;">Long paragraph that exceeds 80pt height...</p>
</div>

<!-- CORRECT — let content define height, use flex:1 -->
<div style="flex: 1;">
  <p style="font-size: 10px; line-height: 1.35;">Text that fits naturally</p>
</div>
```

---

## 5. Colors Not Matching Brand

**Symptom**: Colors in the slide don't match the expected brand palette.

**Cause**: Either hardcoded hex values that don't match the brand config, or CSS variables used in the wrong context.

**Fix**:
- **In HTML/CSS styles**: Always use `var(--brand-*)` — these are resolved by the rendering pipeline
- **In `data-echarts` JSON**: NEVER use `var(--brand-*)` — omit colors entirely (auto-coloring applies brand palette) or use hex values from the brand config
- **In rasterized images**: Use hex values matching the brand config

```css
/* CORRECT — CSS variables in styles */
.panel { background: var(--brand-bg-secondary); }
p { color: var(--brand-text); }
```

```json
// CORRECT — No explicit colors in ECharts (auto-coloring applies brand palette)
{"series": [{"type": "bar", "data": [10, 20, 30]}]}

// CORRECT — Hex values from brand config in ECharts
{"series": [{"type": "bar", "itemStyle": {"color": "#1E3A5F"}, "data": [10, 20, 30]}]}
```

---

## 6. Chart Labels Cropped or Missing

**Symptom**: Bar chart values are cut off, invisible, or extending beyond chart boundaries.

**Cause**: ECharts grid margins too small. Default `containLabel: true` often fails with explicit label positioning.

**Fix**: Use explicit grid margins:
```json
"grid": {"left": 100, "right": 60, "top": 30, "bottom": 40, "containLabel": false}
```

For horizontal bars:
- `left: 100` minimum (Y-axis category labels)
- `right: 60` minimum (value labels)

Use per-data-point labels with conditional positioning:
- Large values (>50% of max): `position: 'insideRight', color: '#fff'`
- Small values: `position: 'right', color: '#333'`

---

## 7. Chart Has No Title or Legend

**Symptom**: Viewer cannot understand what chart bars/lines represent.

**Cause**: No explicit title element. ECharts legend component insufficient for PPTX.

**Fix**: ALWAYS add `<p>` element immediately before chart:
```html
<p style="font-size: 11px; font-weight: bold; color: var(--brand-primary); margin: 0 0 8pt 0;">
  Profit by Client ($)
</p>
<div data-echarts='...'></div>
```

---

## 8. Visual Imbalance — Content Too Small or Too Large

**Symptom**: Content looks cramped OR tiny with excessive whitespace.

**Cause**: Not filling 70-85% of available space.

**Fix**:
- Target 70-85% fill of allocated zone
- If cramped: reduce items or split slides
- If sparse: increase font sizes and padding proportionally
- Tables: min 11px body, 12px headers, 8-12px cell padding

---

## 8.5 Overflow Resolution Priority

**Symptom**: Content overflows content-zone. Agent removes content (columns, verbatims, text) as first fix, resulting in sparse slides with lost information.

**Cause**: No established resolution order. Agent defaults to content deletion because it's the most obvious fix.

**Fix — resolve overflow in this priority order:**

### Priority 1: Resize containers to fill available space
- Check: Is there whitespace below/beside content in the generated slide?
- If yes → the problem is container sizing, not content volume
- Use `flex: 1` on container divs to fill available vertical space
- Increase chart heights if whitespace exists below charts
- Let flex containers expand rather than using fixed heights

### Priority 1b: Rearrange spatial positions
- Move overlapping elements: increase gap between text boxes, shift content down into empty space below, change flex direction from row to column if panel is narrow
- Check if a text box can simply be moved to avoid overlap
- Adjust absolute/relative positioning to eliminate collisions before resizing fonts or content

### Priority 1c: Change split ratio
- If a panel's content overflows but the adjacent panel has whitespace, change the split (e.g., 65:35 → 55:45 or 50:50)
- Recalculate both panels' content fit after the ratio change
- This is cheaper than reducing content — you're redistributing space, not losing information

### Priority 2: Reduce font size proportionally (stay above minimums)
- If body text is 14px → try 12px → try 11px (minimum 8pt/~10.7px body)
- If table text is 12px → try 11px → try 10px
- Title can reduce from 24px toward 16pt minimum
- Order: reduce largest fonts first (titles before body before labels)
- This often recovers 10-30pt of space

### Priority 3: Reduce padding proportionally
- Table cell padding: 8pt → 6pt (saves ~2pt per row)
- Panel padding: 16pt → 12pt → 10pt
- Gap between elements: 12pt → 10pt → 8pt
- Combined, this often recovers 15-40pt

### Priority 4: Reduce content (LAST RESORT)
- Only after priorities 1-3 are exhausted
- Prefer shortening text over removing entire elements
- NEVER cut verbatim customer quotes — these carry the user's voice
- NEVER remove table columns if data fits with smaller padding/font

### Priority 5: Split into multiple slides
- Only if content is substantive, essential, AND priorities 1-4 insufficient
- Better to have two well-filled slides than lose content

**Anti-pattern**: Seeing "overflow by 27pt" and immediately deleting content. Always check if the slide has whitespace first — if it does, resize containers.

**Goal**: Slides should fill 70-85% of content-zone. Empty space after fixing overflow is as much a problem as the overflow itself.

---

## 9. Title Misaligned (No Top Margin)

**Symptom**: Titles on slides 2+ are pushed up against top edge while slide 1 has proper spacing.

**Cause**: Browser default margins on h1 elements not reset.

**Fix**: Always include in h1 style:
```html
<h1 style="margin: 0; line-height: 1.3; font-size: 22px; ...">
```

---

## 10. Chart Axis Labels Invisible

**Symptom**: Bar chart renders with visible bars but Y-axis or X-axis category labels are blank/missing.

**Cause**:
- `grid.left` / `grid.bottom` too small — labels are rendered but clipped outside visible area
- `axisLabel.show: false` explicitly hiding labels
- `xAxis.data` or `yAxis.data` array missing entirely (ECharts has nothing to render)

**Fix**:
- Ensure `yAxis.data` (horizontal bars) or `xAxis.data` (vertical bars) contains the category labels
- For horizontal bars: `grid.left >= 100` (auto-calculated by `calculateRequiredGridMargins()`)
- For vertical bars with long labels: `grid.bottom >= 60`
- The pipeline now auto-enforces these via `render_echarts.mjs`

---

## 11. Overlapping Text Boxes

**Symptom**: Content areas render on top of each other — text from one section obscures another.

**Cause**:
- Absolute positioning without collision awareness
- Content exceeding allocated zone space (content-zone overflow)
- Too many elements in a flex container without proper sizing

**Fix**:
- Prefer flexbox layouts over absolute positioning
- Reduce content density (max 6 bullets, 6 table rows, 1-2 charts per slide)
- Use the overlap detection in `html2pptx.mjs` (warns at >100px² overlap)
- In strict mode (`PPTX_STRICT=true`), overlaps block generation

---

## 12. Text Too Small to Read

**Symptom**: Labels, legends, body text, or footnotes are illegible in the final PPTX.

**Cause**: Font sizes below the hard minimum. Common confusion: **10px ≈ 7.5pt** — agents often set `font-size: 10px` thinking it's 10pt, but it renders much smaller.

**Fix**:
- Hard minimum: **9px (≈6.75pt)** for ALL text including footer-zone
- Body text: minimum 8pt (≈10.7px)
- Title text: minimum 16pt (≈21.3px)
- `validate_html.cjs` now warns on inline `font-size < 9px`
- `render_echarts.mjs` `enforceMinimumFontSizes()` auto-raises ECharts text elements
- When in doubt, use px not pt (the HTML is rendered in a browser context)

---

## 13. Chart Without Legend (Multi-Series)

**Symptom**: Multiple colored bars, lines, or pie slices with no way to identify which is which.

**Cause**: No `legend` component in ECharts config for multi-series charts.

**Fix**:
- Add `legend: { show: true, data: [...seriesNames], textStyle: { fontSize: 11 } }`
- Or add a descriptive `<p>` title above the chart that explains the color mapping
- For pie charts: must have either `legend` OR `series[].label.show: true`
- `validate_html.cjs` now errors on multi-series charts without legend

---

## 14. Playwright Browser Not Found (After Installation)

**Symptom**: `browserType.launch: Executable doesn't exist at ~/.cache/ms-playwright/chromium...` even though `npx playwright install chromium` succeeded.

**Cause**: Browser was installed with `PLAYWRIGHT_BROWSERS_PATH=0` (stores in `node_modules/playwright-core/.local-browsers/`) but runtime looks in `~/.cache/ms-playwright/` (default path). This mismatch means the install succeeds but the browser isn't found at launch time.

**Fix**:
- `html2pptx.mjs` now auto-detects local browsers in `node_modules/playwright-core/.local-browsers/` — just run `node workspace/create_slide.mjs` normally
- If auto-detection fails, set the env var explicitly: `PLAYWRIGHT_BROWSERS_PATH=0 node workspace/create_slide.mjs`
- To install to the default location (no env var needed at runtime): `npx playwright install chromium` (without `PLAYWRIGHT_BROWSERS_PATH=0`)
- Run `bash scripts/preflight_check.sh --install` to handle installation automatically

---

## 15. Wrong Import Path for html2pptx.mjs

**Symptom**: `ERR_MODULE_NOT_FOUND` when running the generation script.

**Cause**: Import path is relative to the script location. Scripts in `workspace/` need `../scripts/html2pptx.mjs`, not `./scripts/html2pptx.mjs`.

**Fix**:
```javascript
// From workspace/ (where generation scripts are created):
import html2pptx from '../scripts/html2pptx.mjs';

// From skill root:
import html2pptx from './scripts/html2pptx.mjs';
```

---

## 16. Hardcoded "Standard Web" Colors Instead of Brand Variables

**Symptom**: Generation succeeds but console shows multiple warnings:
```
WARNING: N non-brand color(s) were replaced
Colors found: #4CAF50, #EF5350, #FFC107
To fix: Use var(--brand-*) CSS variables in HTML
```

**Cause**: Agent used memorized Material Design / Bootstrap hex colors instead of consulting the brand variable reference. Common offenders:
- `#4CAF50` (Material green) instead of `var(--brand-positive)`
- `#EF5350` (Material red) instead of `var(--brand-negative)`
- `#FFC107` (Material amber) instead of `var(--brand-warning)`
- `#FF6600` / `#FF5722` instead of `var(--brand-accent)`

**Why this happens**: LLMs memorize common hex values from web development training data. When told "use green for positive," the model reaches for `#4CAF50` rather than looking up the brand's actual green (`--brand-positive` = `#2E7D32`).

**Fix**:
```html
<!-- WRONG -->
<div style="background: #4CAF50; color: white;">Growth</div>
<div style="color: #EF5350;">Decline</div>

<!-- CORRECT -->
<div style="background: var(--brand-positive); color: var(--brand-text-inverse);">Growth</div>
<div style="color: var(--brand-negative);">Decline</div>
```

**Prevention**: Before generating PPTX, verify no hex colors remain in HTML:
```bash
grep -oE '#[0-9A-Fa-f]{3,8}' workspace/*.html | grep -v '<!--'
```
If any results appear, replace with the appropriate `var(--brand-*)` variable.

**CRITICAL**: Color replacement warnings mean the HTML is WRONG. The auto-replacement is a safety net, not intended behavior. Do NOT dismiss these warnings — go back and fix the HTML, then regenerate with zero warnings.

---

## 17. Chart Labels Not Aligned with Title

**Symptom**: Chart title and category labels don't form a cohesive visual block. Labels appear to "float" separately from the title. In horizontal bar charts, Y-axis labels are right-aligned instead of left-aligned.

**Root Cause**: `containLabel: true` in grid configuration, or missing `align: 'left'` for horizontal bar charts. ECharts default right-aligns Y-axis labels so they end at the same position — the opposite of what McKinsey style requires.

**Fix**:
1. Set `grid.containLabel: false`
2. For horizontal charts: Set `yAxis.axisLabel.align: 'left'`
3. For chart titles: Use `padding-left: 8px` to match label start position

**Prevention**: The `render_echarts.mjs` defaults now handle this automatically via `applyChartLabelAlignment()`. If you override grid or axisLabel settings, ensure you maintain:
- `containLabel: false`
- Proper `align` settings
- Matching title `padding-left`

**Visual diagnosis**:
```
WRONG (right-aligned):                CORRECT (left-aligned):
      Title: Top Performers           Title: Top Performers
            Shop A ████ 4.8           Shop A      ████ 4.8
       Long Shop B ███ 4.5            Long Shop B ███ 4.5
          Shop C   ██ 4.2             Shop C      ██ 4.2
                                      ↑ Title and labels align here
```

---

## 18. Typography Inconsistency (Too Many Font Sizes)

**Symptom**: Slide looks visually chaotic — text sizes vary without clear hierarchy. Title is 24px, subtitles are 16px, body is 13px, labels are 10px, footnotes are 8px — 5+ distinct sizes on one slide.

**Cause**: No established typography tier system. Agent picks "reasonable" sizes per element without checking consistency across the slide.

**Fix**: Use the 4-tier typography system — maximum 4 distinct font sizes per slide:

| Tier | Role | Size Range |
|------|------|-----------|
| T1 — Title | `<h1>` slide title | 16-22px |
| T2 — Header | Panel headers, chart titles, section labels | 11-14px |
| T3 — Body | Bullets, table cells, paragraphs | 9-11px |
| T4 — Footnote | Source, footnotes, axis labels | 9px |

```html
<!-- WRONG — 6 distinct sizes, no clear hierarchy -->
<h1 style="font-size: 24px;">Title</h1>
<p style="font-size: 16px;">Subtitle</p>
<p style="font-size: 13px;">Body text</p>
<p style="font-size: 10px;">Label</p>
<p style="font-size: 8px;">Footnote</p>

<!-- CORRECT — 4 tiers, clear hierarchy -->
<h1 style="font-size: 22px;">Title</h1>
<p style="font-size: 12px; font-weight: bold;">Panel Header</p>
<p style="font-size: 11px;">Body text and bullets</p>
<p style="font-size: 9px;">Source: Company analysis</p>
```

**Prevention**: `validate_html.cjs` now errors on >4 distinct font sizes and warns on non-standard tier values.

---

## 19. Em-Dashes in Text

**Symptom**: Text contains em-dash characters (—) which render inconsistently across fonts and platforms, and don't match McKinsey style.

**Cause**: LLM training data includes em-dashes from web content. Agent generates phrases like "Revenue — up 23% — exceeded targets" or "Key finding — market share grew."

**Fix**: Replace all em-dashes with appropriate punctuation:

| Pattern | Replace With |
|---------|-------------|
| "X — Y" (parenthetical) | "X: Y" or split into two sentences |
| "A — B — C" (list-like) | Use actual bullet points |
| "Result — 23%" | "Result: 23%" |

```html
<!-- WRONG -->
<p>Revenue — driven by pricing — grew 23%</p>

<!-- CORRECT -->
<p>Revenue grew 23%, driven by pricing improvements</p>
<!-- or -->
<li><strong style="color: var(--brand-primary);">Revenue grew 23%</strong> driven by pricing improvements</li>
```

**Prevention**: `validate_html.cjs` now errors on any em-dash (U+2014) in body text or ECharts JSON.

---

## 20. Missing Container Around Panel

**Symptom**: A panel of content (bullets, metrics, text) appears as floating text without visual enclosure, while the inspiration shows it inside a bordered container, box, or region with a header bar.

**Cause**: Agent focused on content elements (bars, labels, bullets) and skipped the panel's wrapper. Common in multi-column layouts where one panel (usually the chart) gets a Container Box but the other panel (bullets, insights) is left unwrapped.

**Fix**: Before writing HTML, create a Layout Blueprint (see `preflight-checklist.md` (VSD section)). For EACH panel in the layout, explicitly document:
- Has border in inspiration? → Add border in HTML
- Has header bar? → Add header bar div
- Fill treatment? → Match in CSS

```html
<!-- WRONG — right panel has no container -->
<div style="flex: 30; display: flex; flex-direction: column;">
  <ul>...</ul>
</div>

<!-- CORRECT — right panel has matching container treatment -->
<div style="flex: 30; border: 1.5px solid var(--brand-surface-light); padding: 10pt;">
  <ul>...</ul>
</div>
```

**Prevention**: Gate 1 (Identity) now explicitly checks container treatment per-panel. Run the Layout Blueprint step before coding.

---

## 21. Chart Title Duplicated by Container Header

**Symptom**: The rendered slide has TWO titles for the chart: the Container Box header bar AND a separate `<p>` chart title inside the body. The inspiration only has one (the header bar).

**Cause**: `validate_html.cjs` requires a `<p>` title immediately before every `data-echarts` div. When the chart is inside a Container Box whose header bar already serves as the chart title, the agent adds a redundant title to satisfy the validator.

**Fix**: If the chart is inside a Container Box with a header bar that describes the chart (metric + units), the header bar IS the chart title. To satisfy the validator, add a minimal `<p>` that matches the header content or serves as a unit description:

```html
<!-- Header bar already has "Revenue by Region" -->
<div style="background: var(--brand-surface-light); padding: 8pt 14pt;">
  <p style="margin: 0; font-size: 11px; font-weight: bold; color: var(--brand-primary);">Revenue by Region</p>
  <p style="margin: 2pt 0 0 0; font-size: 9px; color: var(--brand-gray-dark);">USD millions</p>
</div>
<div style="flex: 1; padding: 6pt;">
  <!-- Minimal chart title to satisfy validator — matches header context -->
  <p style="margin: 0 0 4pt 0; font-size: 9px; color: var(--brand-gray-dark);">USD millions</p>
  <div data-echarts='...'></div>
</div>
```

**Rule**: Never add a chart title that duplicates the Container Box header. Check the inspiration — if it only has the header, keep the inline title minimal.

---

## 26. Body Text Larger Than Container Header (BLOCKING ERROR)

**Symptom**: Pre-flight validator blocks with `[HIERARCHY] Body text font-size (Npx) is LARGER than container header (Mpx)`.

**Cause**: Annotation text, body paragraphs, or callout labels inside a Container Box use a larger font-size than the Container Box header. This inverts the visual hierarchy — body text should never dominate the header.

**Fix**:
- Reduce body text font-size to T3 (9-11px)
- Ensure Container Box header is T2 (11-14px)
- Header MUST always be visually dominant over body text

```html
<!-- WRONG — body text (14px) larger than header (11px) -->
<div style="background: var(--brand-surface-light); padding: 8pt 14pt;">
  <p style="font-size: 11px; font-weight: bold;">Header</p>
</div>
<div style="padding: 6pt;">
  <p style="font-size: 14px;">Annotation text that is too large</p>
</div>

<!-- CORRECT — header (12px) larger than body (10px) -->
<div style="background: var(--brand-surface-light); padding: 8pt 14pt;">
  <p style="font-size: 12px; font-weight: bold;">Header</p>
</div>
<div style="padding: 6pt;">
  <p style="font-size: 10px;">Annotation text at proper size</p>
</div>
```

---

## 27. CSS Overlay Misalignment on Charts

**Symptom**: Dashed reference lines, callout labels, or highlight regions placed using CSS `position: absolute` with percentage values don't align with the chart data they reference.

**Cause**: CSS percentage positioning (e.g., `top: 36%`) is relative to the HTML container, NOT to the ECharts chart grid. The chart grid has its own margins (`grid.left`, `grid.top`, etc.), so CSS percentages don't correspond to chart data coordinates.

**Fix**: Use ECharts native annotation features instead of CSS overlays:

| What You Need | Use This | Not This |
|---------------|----------|----------|
| Horizontal reference line | `markLine: { data: [{ yAxis: 47 }] }` | `<div style="position: absolute; top: 36%;">` |
| Callout at data point | `markPoint: { data: [{ coord: [4, 50] }] }` | `<div style="position: absolute; left: 60%; top: 40%;">` |
| Highlight region | `markArea: { data: [[{xAxis: 'A'}, {xAxis: 'C'}]] }` | `<div style="position: absolute; left: 13%; width: 25%;">` |

See `slide_standardisation.md` Section 15 for complete ECharts annotation patterns with code examples.
