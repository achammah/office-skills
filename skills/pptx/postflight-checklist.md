# Post-Flight Checklist — Before Delivering Any Presentation

Complete this checklist AFTER generating the PPTX and BEFORE delivering. If any box is unchecked, STOP and complete it.

## 1. Generation Verification
- [ ] PPTX file created successfully (no errors in console output)
- [ ] File size is reasonable (not 0 bytes, not suspiciously small)

## 1.5 Console Output Review

Review the generation console output before proceeding to rendered PNGs:

### Blocking Issues (must fix before proceeding)
- [ ] No `FATAL:` or `Error:` messages in output
- [ ] No `[STRICT]` blocking errors (if using `PPTX_STRICT=true`)

### Color Warnings — HARD STOP
- [ ] **ZERO** `Replaced non-brand color` warnings in output?
  - **If ANY warnings appear → STOP. The task is NOT complete.**
  - Go back to the HTML and replace every hardcoded hex with `var(--brand-*)` variables
  - Common culprits: `#4CAF50`→`var(--brand-positive)`, `#EF5350`→`var(--brand-negative)`, `#FFC107`→`var(--brand-warning)`, `#FF6600`→`var(--brand-accent)`
  - Regenerate and verify ZERO color warnings before proceeding
  - The auto-replacement is a safety net — it does NOT produce correct brand colors
  - **Do NOT rationalize warnings as "expected" or "acceptable fallback"**

### Overflow Warnings — BLOCKING ERROR
- [ ] No `[overflow] content-zone overflows` warnings?
  - **< 3pt**: Within tolerance — verify in rendered PNGs
  - **> 3pt**: BLOCKING ERROR — must fix before delivery
  - Fix priority: (1) reduce font sizes, (2) tighten spacing, (3) remove content
  - Content-zone overflow is now enforced as a hard error (3pt tolerance)

### Chart Warnings
- [ ] No `grid.right too small` or `grid.left too small` warnings?
  - **If present**: Axis or value labels may be cropped — check rendered PNGs carefully
- [ ] No `[BLOCKING] [label-count]` errors?
  - **If present**: ECharts is hiding category labels. The pipeline auto-sets `interval: 0`, but if labels still don't render, the chart height is too small — increase it or reduce label font size
- [ ] Review `[override]` log lines — do any overrides explain unexpected output?
  - These are informational, not blocking, but help diagnose spatial issues
  - **For EACH override, ask**: Does this affect elements I positioned relative to the chart grid?
  - Common overrides to watch:
    - `grid.left` increased → annotation/callout left margins may need adjustment
    - `grid.right` increased → right-side annotations may shift
    - `containLabel: false` → labels extend outside grid boundaries
  - If overrides changed grid boundaries, verify chart-adjacent elements still align

### CSS Survival Warnings
- [ ] No `[BLOCKING] [css-survival]` errors?
  - **If present**: HTML uses CSS properties that produce visible output in browser but are **completely lost** in PPTX
  - Each error includes the fix (e.g., "Use SVG `<polygon>` instead of `clip-path`")
  - See [`html2pptx.md`](html2pptx.md) for CSS survival rules and workarounds

## 1.6 Completeness Gate (HARD STOP)

Before proceeding to rendered PNGs, verify element counts match between your source data and your HTML. This catches missing elements that are invisible in code review but obvious in rendered PNGs.

**For chart slides:**
- [ ] Count of data points in source data = count of bars/points/segments in `data-echarts` series
- [ ] Count of category labels in `yAxis.data` or `xAxis.data` = count of data items
- [ ] Check `[label-count]` in console — `expected` = `rendered`?

**For text/bullet slides:**
- [ ] Count of bullet points in source content = count of `<li>` elements in HTML
- [ ] No `<li>` items hidden by `overflow: hidden` or `max-height`

**For table slides:**
- [ ] Count of rows in source data = count of `<tr>` elements (excluding header)
- [ ] Count of columns in source = count of `<th>` / `<td>` per row

**For SVG/flow/framework slides:**
- [ ] Count of steps/nodes in source = count of SVG shapes or flow-step divs
- [ ] All shape labels are real text (not embedded in rasterized images)

**Rule**: If ANY count mismatches → HARD STOP. Fix before generating rendered PNGs. A slide with missing elements is fundamentally wrong — cosmetic tweaks cannot fix it.

## 2. Slide PNG Generation
- [ ] Full-size PNGs generated with `python scripts/thumbnail.py [pptx] [output_dir] --full-size --dpi 200`
- [ ] Per-slide PNG file exists (e.g., `{prefix}-slide-001.png`) and is readable
- [ ] PNG is full-size (dimensions ~1900×1070 at 200 DPI, NOT 300px-wide grid)

## 3. Per-Slide Inspection
For EACH slide, verify:

| Check | What to look for | Pass/Fail |
|-------|-----------------|-----------|
| Title aligned? | Title has proper top margin, not pushed against edge | |
| Title font size? | ≥16pt (≥21px), allows 2-line wrap if needed | |
| Chart has title? | Descriptive `<p>` above chart (metric + units) | |
| Chart renders correctly? | Not blank/black, data visible, axis labels present | |
| Chart labels visible? | All value labels fully visible, not cropped | |
| Chart label positioning? | Large=insideRight/white, small=right/dark | |
| Grid margins sufficient? | Horizontal bars: left≥100, right≥60 | |
| Data labels visible? | All numbers/text readable, not overlapping | |
| Colors correct? | Brand Tier 1 colors used. Any Tier 3 (red/amber/green) must match inspiration explicitly. Check console for `[color-tier]` warnings. | |
| Content fills 85-95%? | McKinsey standard — not too sparse, not overflowing | |
| Horizontal fill? | For EACH panel: do content columns fill ≥70% of the panel's width? Content clustered on one side with empty space on the other = FAIL. Use flex:N proportions instead of fixed width:Npt for multi-column layouts. | |
| Title-legend clearance? | If legend is in title zone: does title text overlap/touch the legend? If title wraps to 2+ lines, is there enough horizontal space? position:absolute legend with multi-line title = FAIL. Legend below title on a separate line = FAIL (must be at same vertical level). Fix: h1 max-width:75%, legend min-width:140pt, title-zone flex-wrap:nowrap. | |
| No overlapping elements? | All boxes, tables, charts have clear separation | |
| Text not overflowing? | No truncation at panel/slide edges | |
| Footer/source present? | Source citation + page number visible | |
| Layout balanced? | Adequate whitespace, no cramped areas | |
| Axis labels visible? | All category labels readable, not clipped | |
| Axis scale matches inspiration? | yAxis min/max/interval produce the same number of gridlines as the inspiration? Extra gridlines not in inspiration = FAIL. Data compressed into a fraction of the chart area = FAIL. Dead space > 25% on line/area charts = FAIL (set yAxis.min closer to data minimum). Check console for `[axis-dead-space]` warnings. | |
| Legend present? | Multi-series charts have visible legend | |
| Text >= 9px? | No text below 9px (6.75pt) minimum floor | |
| Subtitle visible? | If present, subtitle not hidden/clipped | |
| Panel borders visible? | Panel elements distinguishable from background | |
| Callout box readable? | Take-away boxes use `.callout` (navy bg + white text) | |
| Title follows standard? | 20px, Georgia, navy — matches slide_standardisation.md Section 1 | |
| Font units correct? | All font sizes in px (not pt) | |
| Footer format? | "Nexus | N" with source line | |
| Container box present? | For EACH panel: if inspiration shows border/enclosure, container is present. Missing container = FAIL. | |
| Annotation enclosure? | For chart annotations: each annotation box TIGHTLY ENCLOSES its target bars (boundary flush ±4pt, not oversized). Highlight shapes linking categories across bars are PRESENT (not omitted). Observations remain SPATIALLY CONNECTED to their data (not moved to disconnected box). Callouts do NOT obscure chart data. | |
| Spatial links precise? | For EVERY element that points to, encloses, or connects to another element: does it TOUCH its target? Leader lines reach data points? Reference lines align with bar edges? Highlight boxes snugly cover their target bars? Connectors bridge their zones? Approximate = FAIL. | |
| Container Box complete? | Every Container Box has BOTH border AND shaded header bar. Border without header = FAIL. | |
| Header bar heights equal? | Multi-panel layouts: ALL Container Box headers must have identical height (same padding + min-height). Mismatched heights = FAIL. | |
| Header bar never removed? | Removing a Container Box header bar is NEVER a valid fix. If header looks wrong, fix its styling — do not delete it. | |
| Text padding? | No text touching or within 2pt of any container/box border. Minimum 4pt padding on all sides. | |
| Bullet formatting? | Bullets grouped with 6-8pt spacing (NOT 16pt). line-height 1.35-1.45. Items >5 lines = paragraphs, not bullets. Text has visible hanging indent past bullet marker. NOT spread with space-between. |
| Sub-bullet markers? | Nested sub-bullets use en-dash (&#8211;), NOT same marker as parent. 1px smaller font. 12pt indent from parent text edge. | |
| Table borders correct? | McKinsey tables: dashed row separators, NO solid cell outlines, NO full grid borders. Header row: 2px solid bottom. | |
| Row headers styled? | Matrix/grid row labels: colored rectangle (navy bg, white text), NOT plain text in cell. | |
| Column alignment? | Column headers share EXACT same left/right edges as content below. Markers between columns centered PRECISELY on boundary (not offset). Time/label text centered within columns with equal left/right margins. Table row borders align with adjacent box edges (trace horizontal line from border — must hit box edge). ANY misalignment > 2pt = FAIL. For Container Boxes with multi-column headers: header sub-columns aligned with body sub-columns? Header using space-between when body uses flex:7/flex:3 = MISALIGNMENT. | |
| Separator standard? | Section separators must be 1px dashed gray. No zigzags, no solid lines, no colored decorative separators. | |
| SVG shape fidelity? | Non-rectangular shapes (triangles, curves) must use SVG, not CSS approximations. Triangles=polygon, curves=path. |
| SVG quality faithful? | For EACH SVG element: compare against inspiration. Are ALL shapes present? Are interlocking joints complete (notch + protrusion)? Is the style (gradient vs flat, thickness, curvature) matching the inspiration — not simplified? SVG that "looks lazy" compared to inspiration = FAIL. | |
| Annotation fill match? | Annotation box fill (FILLED/OUTLINED) must match inspiration. Do NOT default to OUTLINED. | |
| Structural element count? | Compare `[STRUCTURE]` output from pre-flight with previous version. ANY count decrease = BLOCKING REGRESSION. Column headers, row headers, Container Box headers, SVG shapes must ALL persist across iterations. | |
| Separator spacing adequate? | Check console for `[separator-margin]` warnings. All separators must have ≥12pt margin. Text touching/overlapping a separator = FAIL. | |
| Element clearance? | Adjacent positioned elements have ≥8px gap. SVG graphics don't overflow into text columns. Annotation boxes sit below container headers. No overlapping elements at same z-level. | |
| Language consistent? | All text in same language as inspiration. No English headings on French slides (or vice versa). Check console for `[LANGUAGE]` warnings. | |
| Annotation fills consistent? | All annotation boxes of same type use identical fill color/opacity/border. No inconsistent shading between peer boxes. | |
| Data labels ON chart? | Totals, growth %, deltas positioned ON the chart (aligned with bars/segments), not floating disconnected. Labels rendered by ECharts (markPoint, invisible series label), not HTML overlays. | |
| Leader lines connect? | Each leader line touches BOTH callout box edge AND specific data point. Lines ending in empty space = FAIL. Missing lines when callouts exist = FAIL. N callouts near a chart = N leader lines. | |
| SVG spans container? | Spanning SVGs (staircases, timelines, wave patterns) fill container width. SVG stopping short (fixed pt/px width in fluid container) = FAIL. | |
| Labels close to data? | Numeric labels (totals, deltas, %) positioned within 5% of their data point. Label floating far from its bar/segment = FAIL. | |
| All inspiration elements present? | Count major elements in inspiration (containers, charts, annotations, connections, badges, leader lines). Same count in output? Missing = FAIL. | |
| Annotations integrated? | Leader lines and callout box outlines part of chart image (ECharts graphic). Text overlays positioned on rendered boxes. No floating HTML leader lines. No position:absolute numeric labels on charts. |
| Annotation precision? | markLine pills: horizontal + vertical lines connect to correct data levels. $callouts boxes: leader lines point to correct data index, box text matches annotation intent. markPoint labels: positioned near correct data point. | |
| Container coverage? | Scan every flex sibling in content-zone. Any sibling with 2+ content elements (p, ul, li, h3) and NO border = free-floating content. Must be wrapped in Container Box or Takeaway Box. | |
| Proportional sizing? | For ANY visual where size represents data (bar heights, column widths, area sizes): does the SIZE RATIO match the DATA RATIO (±15%)? Equal-sized visuals for unequal data = FAIL. This applies BOTH to side-by-side elements (column widths) AND to stacked elements (segment heights). Measure the actual rendered ratio and compare to the data ratio. | |
| Pill/callout color mapping? | For each callout pill/oval referencing a data category: does its border/fill color match that category's legend color? All pills same color when referencing different categories = FAIL. |
| Positioned element spot-check | 3 random absolute/margin-offset elements measured, ΔX/ΔY ≤7% | BLOCKING if >7% |
| Translation Standardization | All TS-1 to TS-14 items checked (§17.5). No logos, no non-brand colors on key shapes, containers present, fonts standardized, dashed separators. | BLOCKING if any violation | |
| Overlay clearance? | For arrows, brackets, gradient overlays running alongside content rows: does the overlay run BETWEEN rows (dedicated column or gap) or THROUGH them (collision)? Overlay colliding with adjacent pills, labels, or text = FAIL. | |
| Text line count? | For each category label, short text element, and annotation: does it use the same number of lines as in the inspiration? Text wrapping to 2+ more lines than inspiration = FAIL. Widen the column, reduce font, or abbreviate. | |

Document findings per slide:
- "Slide N: [specific observations]"
- "Issue: [description]" or "All checks pass"

**MANDATORY**: After completing the Per-Slide Inspection table above, run the 5-Pass Multi-Pass Image Comparison Protocol (see Visual Validation Protocol section below, §5). The per-slide table is a quick scan; the 5-pass protocol is the thorough validation. For chart slides, the 5-pass protocol catches issues invisible in a quick scan: labels far from data, missing leader lines, overlapping callouts, SVGs not spanning containers.

### Content Fill Check

If a slide looks sparse (significant whitespace after fixing overflow):
- You over-corrected — the overflow fix removed too much
- Go back and restore content, then use container resizing / font reduction instead
- Use `flex: 1` on panels to fill available vertical space
- Increase font sizes and padding to fill 85-95% of content-zone
- Regenerate and re-verify

**Content Fill Ranges (McKinsey Standard):**

| Fill % | Estimated Height | Verdict | Action |
|--------|-----------------|---------|--------|
| < 70% | < 228pt | SPARSE | Add content, increase fonts/padding, or consolidate with another slide |
| 70-85% | 228-276pt | UNDERFILLED | Increase font sizes, add spacing/padding |
| 85-95% | 276-309pt | TARGET | McKinsey standard — no action needed |
| 95-100% | 309-325pt | FULL | Acceptable — monitor for overflow |
| > 100% | > 325pt | OVERFILLED | BLOCKING — reduce content, fonts, or split slide |

**Note**: Based on ~325pt available content zone (single-line title). Adjust for multi-line titles.

**Rule**: A slide with visible whitespace is equally wrong as a slide with overflow. Both require correction before delivery.

### Per-Panel Fill Check (Multi-Panel Layouts)

For slides with 2+ panels (e.g., chart + takeaway, chart + bullets):

- [ ] For EACH panel: content fills ≥70% of panel's vertical space. A panel with 3 bullets
      in the top 40% and 60% empty below = FAIL. Either increase font sizes/spacing, add
      vertical centering, or reduce the panel's flex proportion.
- [ ] No panel has >40% contiguous empty vertical space
- [ ] If a panel is underfilled:
  - Increase body font toward top of tier range (11px not 9px)
  - Increase line-height and bullet spacing
  - Narrow the panel (e.g., 32% → 25%) to force text wrapping
  - Add internal padding
  - A panel full of whitespace FAILS regardless of overall slide density
- [ ] Compare each panel's fill independently — a full chart panel does NOT compensate for an empty text panel

**Per-panel measurement formula**: `(last_content_bottom - first_content_top) / panel_height >= 0.70`. Each panel in a multi-column layout MUST individually meet the 70% threshold. One panel at 90% + another at 40% = FAIL (even if overall is 65%).
- [ ] For EACH panel: content fills ≥70% of panel's **horizontal** space — measured as the total width of content columns divided by panel width. Columns with fixed widths totaling <50% of panel width = FAIL. Switch to flex:N proportions.
- [ ] For EACH panel: if content only fills left half with right half empty, panel is TOO WIDE — narrow it or add content
- [ ] When chart + text panels are side-by-side: text panel should be as visually dense as chart panel. An empty text panel next to a full chart = FAIL.

### Typography Consistency Check

For EACH slide, verify:
- [ ] At most 4 distinct font sizes used
- [ ] Sizes match the 4-tier system: T1 (16-22px), T2 (11-14px), T3 (9-11px), T4 (9px)
- [ ] No em-dashes (—) in any text
- [ ] Bullet points use selective bolding (first 2-5 words bold in brand-primary)

## 4. Issue Resolution
- [ ] All identified issues documented
- [ ] HTML source corrected for each issue
- [ ] PPTX regenerated after fixes
- [ ] Rendered PNGs regenerated after fixes
- [ ] Re-validation completed (repeat section 3)

## 4.5 Completion Gate (MANDATORY)

**CANNOT declare slide complete until ALL gates pass:**

### Gate 1: Identity (all elements present)
- [ ] Element count matches: data points, text blocks, shapes, annotations
- [ ] **Per-panel container check**: For EACH panel/column, container treatment matches inspiration (border, header bar, fill)
- [ ] No panels missing their border/enclosure when inspiration shows one
- [ ] No elements hidden by overflow, clipping, or z-index

### Gate 2: Spatial (correct positions)
- [ ] Proportions match inspiration (±5% tolerance)
- [ ] Alignment axes verified
- [ ] Chart annotations align with grid boundaries

### Gate 3: Style (correct appearance)
- [ ] Fill treatment correct (transparent vs opaque vs shaded)
- [ ] Stroke/border correct (color, width, style)
- [ ] Container patterns correct (header bars present where needed)
- [ ] Font sizes within correct tiers

### Gate 4: Console (no blocking issues)
- [ ] No `[BLOCKING]` errors
- [ ] All `[override]` logs reviewed and acceptable
- [ ] No `[css-survival]` warnings unaddressed
- [ ] Content density ≥85%

**If ANY gate fails, the slide is NOT complete. Fix before proceeding.**

**Self-Score Completion Gate**: Weighted score >=8.5 with all dimensions >=7. If not met, iterate. See Visual Validation Protocol section below, §8.

## 5. Delivery Attestation
- [ ] State: "I have completed visual validation of all [N] slides. Each slide was checked for: title fit, chart rendering, data labels, colors, text overflow, footer presence, and layout balance. Issues found and resolved: [list or 'none']. The presentation is ready for delivery."

## Common Issues Quick Reference

| Visual Problem | Likely Cause | Fix |
|---------------|-------------|-----|
| Chart is blank or black | `var(--brand-*)` in ECharts JSON | Remove colors or use hex (see `COMMON_FAILURES.md` #1) |
| Title clipped | > 90 characters | Shorten title, move detail to subtitle |
| Text unreadable | Font < 11pt body / 10pt labels | Increase font size, reduce content |
| Content overflow | Content exceeds ~325pt zone | Reduce fonts (min: title 16pt, body 8pt, footnote 9px), tighten spacing, or remove content |
| Cramped layout | Too many items | Max 6 bullets, 6 rows, 1 chart per slide |
| Colors wrong | Missing `class="brand-slide"` or hardcoded hex | Use `var(--brand-*)` in CSS, omit in ECharts |
| Footer missing | No `footer-zone` div | Add `<div class="footer-zone">` with source + page number |

---

## STRINGENT VISUAL VALIDATION (MANDATORY AFTER PNG GENERATION)

This checklist MUST be completed AFTER generating rendered PNGs and BEFORE delivering.

### Per-Slide Deep Inspection

For EACH slide rendered PNG, verify:

**Zone Integrity:**
- [ ] Title is in header zone with proper top margin
- [ ] Content is in body zone, not overflowing
- [ ] Footer/source is visible and not cut off

**Chart Verification (if slide has charts):**
- [ ] Chart has visible title above it describing what it shows
- [ ] ALL data labels are fully visible (not cropped at ANY edge)
- [ ] Labels have proper contrast (white on dark, dark on light)
- [ ] Y-axis category labels are not truncated
- [ ] Values are readable at rendered PNG size
- [ ] Chart title LEFT EDGE aligns with category labels LEFT EDGE
- [ ] Horizontal bars: Y-axis labels are LEFT-aligned (form a clean left column)
- [ ] Vertical bars: X-axis labels centered, title aligns with chart left edge
- [ ] Long labels wrapped (max 2 lines) or truncated with `...`, not cut off
- [ ] Labels don't consume more than 40% of chart width

**Table Verification (if slide has tables):**
- [ ] Table does not overlap with other content
- [ ] All rows are visible (not cut off at bottom)
- [ ] Text is readable, not cramped
- [ ] Header row is distinguishable

**Visual Balance:**
- [ ] Content fills 85-95% of available space (McKinsey standard)
- [ ] No excessive whitespace
- [ ] No cramped/overflowing areas
- [ ] Font sizes appear consistent across slide

**FORM Validation (Fix F1.2):**

For EACH annotation, callout, or container element, verify:
- [ ] **Fill treatment correct?** Compare rendered PNG to inspiration:
  - Transparent boxes → bars/content visible through them?
  - Opaque boxes → underlying content appropriately hidden?
  - Shaded backgrounds → correct color tone?
- [ ] **Stroke/border correct?** Color, width, and style match inspiration?
- [ ] **Container pattern correct?**
  - Elements with headers → have header bar with shaded background?
  - Takeaway boxes → dark navy background with white text?
  - Plain bordered containers → border only, no header?
- [ ] **Layering correct?** Elements that should overlap do so in the right order?

**Alignment Axes Check:**

Identify the 2-3 dominant alignment axes in the inspiration, then verify they exist in your output:

- [ ] **Vertical axes**: Title left-edge, content left-edge, and footer left-edge all align? (Most slides share a single left margin axis)
- [ ] **For chart + annotation slides**: Do callout/annotation elements align with the chart grid? (Use `--chart-N-grid-*` CSS variables, not hardcoded margins)
- [ ] **For multi-column layouts**: Are column widths proportionally correct? (Not just "roughly equal" — measure against inspiration ratios)
- [ ] **For flow/step diagrams**: Are steps evenly spaced? Do connector lines meet step boundaries cleanly?
- [ ] **Horizontal axes**: Do elements that should share a baseline actually share one? (e.g., chart title and callout text at same vertical position)

**Proportional relationship check** (measure from rendered PNG, NOT from code):
- What fraction of slide width does each major element occupy?
- What fraction of content height does each zone use?
- Do these fractions match the inspiration within ~5% tolerance?

### After-Fix Re-Verification

If ANY issue is found and fixed:
1. Regenerate the PPTX
2. Regenerate rendered PNGs
3. Re-verify the SPECIFIC issue is resolved
4. Re-run this entire checklist

### Chart Alignment — Quick Visual Test

For each chart, perform this 3-second visual test:

1. **The Ruler Test**: Imagine placing a ruler vertically at the left edge of the chart title.
   - Does the ruler also touch the left edge of the first category label?
   - If YES → PASS
   - If NO → FAIL (labels are misaligned)

2. **The Column Test** (for horizontal bar charts only):
   - Do all category labels form a clean left column (like names in a list)?
   - If YES → PASS (left-aligned)
   - If they form a ragged left edge but clean right edge → FAIL (right-aligned)

3. **The Squint Test**: Squint at the chart.
   - Does the title + labels area look like one cohesive block?
   - If YES → PASS
   - If the title looks disconnected from the labels → FAIL

**NEVER claim "validation passed" without visible rendered PNG evidence.**

---

## Visual Validation Protocol (MANDATORY for Phase 7)

This section is the comprehensive visual validation methodology, used during Phase 7 of the pipeline after all structural postflight checks (Sections 1-5 above) are complete. It provides the systematic VSD-based comparison framework that transforms subjective "looks good" assessments into measurable, evidence-based validation. Every slide that has a Visual Specification Document (VSD) must be validated through this protocol before delivery.

**The VSD is the source of truth.** Compare the thumbnail against the VSD — never against the HTML source code. What matters is what the viewer sees in the rendered output.

**When to apply**: Every slide that went through the preflight-checklist.md (VSD section) and has a VSD. Run this AFTER generating the thumbnail, BEFORE declaring the slide complete.

### 1. Per-VSD-Item Validation (Shape by Shape)

For EACH shape in the VSD, fill in a validation table comparing VSD specification against rendered thumbnail.

#### 1.1 Shape Construction & Visual Skin Validation

For EACH shape S-## / VS-##, verify at minimum these 6 properties:

| VSD Ref | Property | VSD Expected | Thumbnail Actual | Match? |
|---------|----------|-------------|-----------------|--------|
| `S-01` | Base primitive | `rectangle` | (observe) | |
| `S-01` | Edge morphology | `modified: top-right notched 10x10pt` | (observe) | |
| `S-01` | Dimensions (approx) | `240pt x 25pt` | (observe) | |
| `VS-01` | Fill color | `#1E3A5F (solid)` | (observe) | |
| `VS-01` | Stroke | `none` | (observe) | |
| `VS-01` | Classification | `FILLED` | (observe) | |

**Minimum 6 rows per shape.** This is non-negotiable. Shapes with modified edges, gradients, or effects require additional rows.

Additional rows for complex shapes:

| VSD Ref | Property | VSD Expected | Thumbnail Actual | Match? |
|---------|----------|-------------|-----------------|--------|
| `VS-01` | Fill type | `solid` (not gradient) | (observe) | |
| `VS-01` | Fill opacity | `1.0` | (observe) | |
| `VS-01` | Stroke alignment | `inside` | (observe) | |
| `VS-01` | Effects | `drop-shadow 2px 2px 4px rgba(0,0,0,0.2)` | (observe) | |

#### 1.2 Composite Assembly Validation

For EACH composite CS-##, verify:

| VSD Ref | Property | VSD Expected | Thumbnail Actual | Match? |
|---------|----------|-------------|-----------------|--------|
| `CS-01` | All primitives visible | `S-03 (rect) + S-04 (cutout) + S-05 (fill)` | (observe all 3) | |
| `CS-01` | Assembly method | `interlocking` | (observe connection) | |
| `CS-01` | Edge interaction | `Notch on right of S-03 filled by protrusion S-05` | (observe junction) | |
| `CS-01` | Z-index order | `S-03 back > S-04 mid > S-05 front` | (observe layering) | |
| `CS-01` | Connection seamless | `No gap at junction, colors match` | (observe junction) | |
| `CS-01` | Visual effect | `Puzzle-piece interlock` | (observe overall) | |

#### 1.3 Scale & Repetition Validation

For EACH SC-## entry:

| VSD Ref | Property | VSD Expected | Thumbnail Actual | Match? |
|---------|----------|-------------|-----------------|--------|
| `SC-01` | Repetition count | `6 columns` | (count in thumbnail) | |
| `SC-01` | Sizing consistency | `All equal width` | (observe widths) | |
| `SC-02` | Aspect lock | `1:1 (circle)` | (observe: circular or elliptical?) | |

#### 1.4 Pipeline Compatibility Check

Before proceeding to visual validation, verify implementation technique compatibility:

| Check | Method | Pass/Fail |
|-------|--------|-----------|
| No `clip-path` in HTML | Search for `clip-path` | |
| No CSS gradients | Search for `linear-gradient`, `radial-gradient` | |
| No CSS filters/transforms on shapes | Search for `filter:`, `backdrop-filter`, `transform:` (except inside SVG) | |
| No `background-image: url()` | Search for `background-image` | |
| No pseudo-elements for shapes | Search for `::before`, `::after` | |
| All non-rect shapes use inline SVG | Each non-rectangular shape is an `<svg>` element | |
| No `<ol>/<li>` auto-numbering | Search for `<ol>`, `<li>` | |
| Technique matches IMP-## | Each shape built with the technique from VSD | |

**If ANY check fails**: STOP. Fix the technique first. A shape built with incompatible CSS will look correct in the browser but be wrong in PPTX.

### 2. Relationship & Spacing Validation

#### 2.1 Adjacency & Interlocking

For EACH R-## adjacency/interlocking entry in the VSD:

| R-## Ref | Element A | Element B | Expected | Thumbnail Actual | Match? |
|----------|-----------|-----------|----------|-----------------|--------|
| `R-01` | `E-03` | `E-04` | `interlock-right-to-left, seamless` | (observe junction) | |
| `R-02` | `E-01` | `E-02` | `abutting, shared 1px border` | (observe gap) | |

**For interlocking relationships:** Zoom into the junction area specifically. Check:
- Is the notch visible?
- Does the protrusion fill the notch completely?
- Are there any gaps or seams at the junction?
- Are the colors correct at the junction (protrusion color matches its parent shape, not the notched shape)?

#### 2.2 Nesting & Containment

For EACH parent-child relationship in R-## 7.2:

| Parent | Children | Expected Arrangement | Thumbnail Actual | Match? |
|--------|----------|---------------------|-----------------|--------|
| `E-10` | `E-11, E-12` | `Stacked vertical, both centered within circle` | (observe) | |

Verify:
- Are ALL listed children visible inside the parent?
- Is the arrangement correct (stacked vs side-by-side)?
- Does the nesting description match? ("centered within", "left-aligned with 4pt inset", etc.)

#### 2.3 Alignment Axes

For EACH alignment axis A-## in the VSD:

**Test method:** Mentally draw (or physically trace) a straight line along the axis. Do ALL listed elements align on that line?

| Axis | Type | Elements | Aligned in Thumbnail? |
|------|------|----------|----------------------|
| `A-01` | vertical | `E-01 left, E-07 left, E-13 left` | (observe) |
| `A-02` | horizontal | `E-01 top, E-02 top, E-03 top` | (observe) |
| `A-03` | vertical-center | `E-10 center, E-16 center` | (observe) |

**Common alignment failures:**
- Flow indicators (circles, arrows) not centered under their content columns
- Headers not aligned with content below them
- Interlocking elements shifted by a few pixels after edge modification
- Column headers must share the same left/right edges as their content columns. A header bar that extends beyond or falls short of its column = MAJOR.
- Markers positioned between columns (milestones, triangles, dividers) must be centered on the column boundary, not offset to one side.

**CRITICAL alignment checks:**

- **Table-border-to-box alignment**: When a slide has table/grid rows with row headers on the left, the HORIZONTAL BORDERS of each row MUST visually align with the TOP and BOTTOM edges of the corresponding left-side box. A border that is 2pt higher or lower than the box edge = BLOCKING misalignment. Test: trace a horizontal line from each row border — does it hit the box edge precisely?

- **Column text centering**: Text labels above columns (timing labels, header text) MUST be CENTERED within their column boundaries, with EQUAL spacing on both sides. Inconsistent left/right margins around column labels = FAIL. Test: for each column label, measure (visually) the gap to the left column edge and right column edge — they should be equal.

- **Marker semantic positioning**: Milestone markers (triangles, diamonds, dots) placed on a timeline or between columns indicate a SPECIFIC position in time/space. The marker must be centered on the BOUNDARY between the columns it separates — not offset to one side. A marker placed at 40% of a column instead of 50% (boundary) CHANGES THE MEANING. Test: is each marker centered on the column boundary line?

#### 2.4 Padding & Margins

Visually estimate internal padding and external margins in the thumbnail. Compare against VSD R-## 7.3 and 7.4 values:

| Container/Element | Side | VSD Value | Thumbnail Estimate | Match? |
|-------------------|------|-----------|-------------------|--------|
| `E-01` | top padding | `4pt` | (estimate) | |
| `E-01` | left margin | `0` | (estimate) | |

Exact pixel measurement isn't required — look for obvious discrepancies (e.g., VSD says 4pt padding but thumbnail shows nearly zero, or VSD says 0 margin but thumbnail shows visible gap).

#### 2.5 Annotation-to-Data Spatial Validation

For EACH annotation that has an `annotates-group`, `labels`, or `brackets` relationship in the VSD:

| R-## Ref | Annotation | Target Elements | Boundary Rule (VSD) | Thumbnail Observation | Match? |
|----------|-----------|----------------|---------------------|----------------------|--------|
| `R-20` | "Augmentation des volumes LDA" | Bars 2-3 | Box encompasses bars 2-3 | (describe what you see: does the box LEFT edge align with bar 2 left? RIGHT edge with bar 3 right? Does the box ENCLOSE the bars?) | |

**Spatial intent validation rules:**
- `annotates-group`: The annotation box boundaries MUST encompass all target elements. A box that floats NEAR its targets but doesn't enclose them = BLOCKING.
- `labels`: The label must be adjacent to or inside its target element. Not floating in empty space.
- `brackets`: The bracket must span the full width/height of the grouped elements.
- Enclosure must include the COMPLETE visual unit: bar segment + value label + any associated annotation text. A box that encloses the bar but cuts off the value label = BLOCKING.
- Annotation box fill treatment must match the inspiration: FILLED (colored background) if inspiration shows shading, OUTLINED (transparent + border) if inspiration shows only borders. Mismatched fill treatment = BLOCKING.

**Measurement approach (not "near" or "roughly"):**
- Describe the annotation's LEFT edge position relative to its leftmost target element
- Describe the annotation's RIGHT edge position relative to its rightmost target element
- Describe the annotation's TOP/BOTTOM edges relative to its target elements
- Any edge that is >7% off from its target = BLOCKING

**Highlight shape presence check:**
- If the VSD documents highlight shapes (E-## with `annotates-group` relationship) that visually link data across bars/segments, count these shapes in the thumbnail. Missing highlight shape = BLOCKING.
- Highlight shapes must be SNUGLY sized: boundary flush with target elements (+/-4pt), not oversized rectangles covering broad chart areas.

**Spatial relationship precision (ALL linked elements):**
- For EACH element that points to, encloses, brackets, or connects to another element:
  - The spatial link must be PRECISE — endpoints touch targets, boundaries enclose targets, connectors bridge zones
  - Example: a leader line from a callout box to a chart bar — the line endpoint MUST touch the bar edge, not stop 10pt short
  - Example: reference lines showing a % change between bars — both endpoints must align with the EXACT top edges of their respective bars
  - Example: a highlight polygon over chart bars — the polygon must be snugly positioned using the chart's grid coordinates, not guessed positions
  - A spatial relationship that is "close but not touching" = FAIL. Precision matters because approximate links are ambiguous.

**No chart obstruction check:**
- For EACH callout/annotation overlaying a chart area: can ALL chart data (bars, labels, values) still be read? If any data is obscured = BLOCKING.

### 3. Typography & Content Validation

#### 3.1 Per-Text Validation

For EACH TYP-## entry in the VSD, verify:

| TYP Ref | Property | VSD Expected | Thumbnail Actual | Match? |
|---------|----------|-------------|-----------------|--------|
| `TYP-01` | Content | `"Pre-Audit"` | (read text) | |
| `TYP-01` | H-alignment | `center` | (observe) | |
| `TYP-01` | V-alignment | `middle` | (observe) | |
| `TYP-01` | Approx size | `9px bold` | (observe relative size) | |
| `TYP-01` | Color | `white (#FFFFFF)` | (observe) | |

#### 3.2 Role-Group Consistency

Group TYP-## entries by their role tier. Within each tier, ALL elements MUST appear the same size in the thumbnail:

| Tier | Elements | Expected Size | Consistent in Thumbnail? |
|------|----------|---------------|-------------------------|
| T2 (header) | `TYP-02, TYP-03, TYP-04` | all 9px | (observe) |
| T3 (body) | `TYP-05 through TYP-10` | all 7px | (observe) |

If any element within a tier appears noticeably larger or smaller than its peers, that's a BLOCKING failure.

#### 3.3 Size Ratios

Compute visible size ratios between tiers in the thumbnail. Compare against VSD expectations:

| Ratio | VSD Expected | Thumbnail Observed | Match? |
|-------|-------------|-------------------|--------|
| T1:T2 | 2:1 (18px vs 9px) | (estimate) | |
| T2:T3 | 1.3:1 (9px vs 7px) | (estimate) | |

### 4. Quality Patterns (P01-P25 + McKinsey Patterns)

These patterns apply to ALL slides with VSD validation. Check each applicable pattern.

#### Shape & Framework Patterns

**P01 — Shape Cohesion**
When multiple shapes form a unified diagram (flow, matrix, ring, chain), they MUST look like ONE cohesive visual element — not separate pieces arranged together. Shape width, thickness, spacing, and curvature must be consistent.
- **Check**: Do shapes form a unified diagram with correct proportions?

**P02 — Text Bounding Containment**
If text is inside a filled shape, the ENTIRE rendered text bounding box must be visually contained within the shape boundary. Measure text-to-shape area ratio and compare against design.
- **Check**: For EACH text inside a shape — is the bounding box contained? Does ratio match?

**P03 — Connector Endpoints**
Each end of a connector may use a different style (dot, bar, arrow, flat). Check BOTH endpoints independently. Endpoints must align with their target elements.
- **Check**: Do connector endpoints match style AND align with targets?

**P04 — Font Size Proportionality**
Text-to-shape size ratios must match the design. If center text fills 25% of a ring's interior in the design but 60% in the output, that's BLOCKING.
- **Check**: For EACH text — does rendered size relative to container match?

**P05 — Text Readability**
All text must be fully readable: no overlapping with shape borders, no clipping by containers, no text-on-text collisions.
- **Check**: Is every piece of text fully readable with no overlaps?
- **Element layering check**: For EACH element that spans across or near text content (SVG lines, decorative strokes, diagonal indicators, connector paths): verify NO text is obscured. Text must always be fully readable. If a spanning element crosses text, the text needs a background mask or the element must be layered behind. Any element obscuring text = BLOCKING.

**P06 — Element-by-Element Text**
For EVERY text element: verify content matches, relative position matches, line count matches, no collision with neighbors, text doesn't extend beyond shape.
- **Check**: For EACH text — content, position, line count, separation all match?

**P07 — Text Centering in Segments**
In segmented shapes (arc segments, chain steps, grid cells), text must be centered within its SPECIFIC segment — not the overall shape. Text near a segment boundary/junction is almost certainly mispositioned.
- **Check**: For EACH text in a segmented shape — is it at geometric center of its segment?

**P08 — Cross-Boundary Connector Alignment**
When connectors span from SVG to HTML (different coordinate systems), verify alignment in the RENDERED thumbnail, not in source coordinates.
- **Check**: Do connectors visually align with targets in the rendered output?

**P09 — Shape-Content Proportionality**
Shapes containing text must be sized to comfortably contain all text lines. If text fills >70% of shape width or height, the shape may be too small.
- **Check**: For EACH text inside a shape — does the shape have enough interior space?

**P10 — Visual Connection Continuity**
Connector lines bridging from SVG to HTML containers must appear as ONE continuous line. SVG rasterization clips content outside viewBox bounds — `overflow="visible"` has NO EFFECT on rasterized output.
- **Check**: Do connector lines visually bridge across container boundaries without gaps?

**P11 — Font-Size Role Consistency**
All text serving the SAME visual role must use IDENTICAL font-size. Never vary font-size within a role to accommodate dense content.
- **Check**: Within each role group — is font-size identical across ALL instances?

**P12 — Connector Attachment Correctness**
A connector's attachment point (dot/anchor) must be ON the element it annotates — not on an adjacent element or boundary.
- **Check**: For EACH connector — does the dot sit on the correct element?

**P13 — Connector-Text Alignment**
When connectors bridge to side text panels, the connector endpoint must be vertically aligned with the CENTER of its target text block. Compute bar y-% vs text block y-% — any mismatch >5% is BLOCKING.
- **Check**: Is each connector bar aligned with its text block center?

**P14 — Fill vs Stroke Fidelity**
Match the EXACT fill/stroke treatment from the design. Solid-filled (colored interior) is visually distinct from outlined (white interior + colored stroke). Swapping these is a BLOCKING failure.
- **Check**: For EACH shape — does fill/stroke treatment match? (This overlaps with Section 1.1 VS-## classification check — verify BOTH)

**P15 — Flow Indicator Column Alignment**
Flow indicators (circles, arrows, step numbers) at slide edges must align with content columns. Preferred: use the SAME layout mechanism (flex row) for indicators and content columns.
- **Check**: Is each flow indicator centered under its column?

#### Structure & Container Patterns

**P16 — Container Box with Header Bar**
Every Container Box must have BOTH a border AND a shaded header bar with a descriptive title. A bordered panel without a header bar is an INCOMPLETE Container Box and FAILS. Only Takeaway Boxes (dark background) skip the header.
- **Check**: Does every bordered panel have its header bar? Is the header bar shaded with a descriptive title?

**P17 — Chart Orientation**
Vertical vs horizontal bars must match the design.
- **Check**: Are bars going the correct direction?

**P18 — Chart Fills Container**
Bars/lines must fill the container. No large empty areas. Tallest bar near top, bars spanning full width.
- **Check**: Does the chart fill at least 80% of its container?

**P19 — Panel Proportions**
Sidebar/panel width ratios must match design within ~5%.
- **Check**: Do panel width ratios match?

**P20 — Takeaway Box**
Must use dark navy background with white text, visually distinct darker header, bold-keyword bullets. Text must fill the box.
- **Check**: Takeaway box styling and content density correct?

#### Data Patterns

**P21 — Values Match**
Every bar height, label, percentage must match the design data.
- **Check**: Do all data values match?

**P22 — Colors Match**
Series colors must use correct brand palette. Additionally: if `--brand-negative` (red), `--brand-warning` (amber), or `--brand-positive` (green) appear in the output, verify each is present in the inspiration image. Agent-invented accent colors = BLOCKING.
- **Check**: Do chart element colors match? Are any Tier 3 (red/amber/green) colors used without inspiration justification?

**P23 — Chart Labels Readable**
Labels inside segments must not overlap or spill outside. Minimum fontSize 7 for inside-segment labels.
- **Check**: Are all chart labels readable and contained?

#### Overall Quality Patterns

**P24 — Content Density**
No large empty white areas not present in the design. Text should fill containers.
- **Check**: Does content density match?
- Also check HORIZONTAL balance: each panel should use its full width. A panel where content clusters on the left with the right half empty = FAIL. Narrow the panel or expand content to fill.

**P25 — No Extra or Missing Elements**
No elements in output that aren't in design, and no design elements missing from output.
- **Check**: Element inventory matches between design and output?

#### McKinsey Styling Patterns

**P-CONNECT — Section-to-Description Connection**
When a slide has a visual element (chart, diagram, flow) paired with separate description panels, each description must be visually connected to its section via aligned column boundaries, connector lines, or shared labels. A description that floats without connection = BLOCKING.
- **Check**: Can you draw a vertical line from each description panel to the visual section it describes? Do boundaries align?

**P-TABLE — McKinsey Table Styling**
Tables/grids must follow McKinsey standard: dashed row separators (NOT solid cell outlines), optional light column backgrounds, colored row header labels (navy bg, white text). A table with full solid cell outlines = BLOCKING.
- **Check**: Does the table use dashed row separators? Are row headers colored rectangles? Are there NO solid cell outlines?

**P-SVG — SVG Shape Fidelity**
Non-rectangular shapes classified as Category 2 (polygon) or Category 3 (path) in the VSD must be implemented with SVG, not CSS approximations. Triangles rendered as rectangles = BLOCKING. Curves rendered as angular polylines = MAJOR.
- **Check**: For each non-rectangular shape, does the implementation use the SVG technique from its VSD IMP-## entry?
- Additionally: if inspiration shows N distinct overlapping shapes (e.g., 3 S-curves), count SVG elements in output. Count < N = shapes were collapsed = BLOCKING.
- Also: if inspiration shapes have gradients conveying depth/3D, output must use SVG `<linearGradient>`/`<radialGradient>`. Flat fills replacing gradients = MAJOR.
- Also: for shapes with curves/arcs, verify the direction matches VSD `Curve direction` field. A concave-up curve rendered as convex-up = BLOCKING.
- **Style regression check**: Compare SVG style between current and previous iterations. If v(N) had gradient fills, rounded paths, and detailed geometry, but v(N+1) uses flat fills and simplified rectangles — that is BLOCKING SVG style regression, even if shape COUNT is preserved. Style fidelity matters as much as structural presence.

**P-CLEAR — Element Clearance**
Adjacent positioned elements must maintain >=8px gap. Common violations:
- SVG diagrams overflowing into the first content column
- Annotation boxes overlapping container header bars
- Text labels overlapping with graphic elements
- Bottom-zone elements overlapping with sidebar labels
For each pair of adjacent elements, verify visible separation in the thumbnail.

**P-STRUCT — Structural Element Preservation**
Between iterations, the pre-flight validator outputs a `[STRUCTURE]` element inventory. Compare the current version's counts against the previous version's counts. If ANY count decreased without intentional removal, structural elements were dropped = BLOCKING regression. This is the most common iteration failure mode (agent accidentally removes headers, row labels, or SVG shapes while fixing a different issue).
- **Check**: Is the [STRUCTURE] count for EACH element type >= the previous version's count?

### 5. Multi-Pass Image Comparison Protocol (5 Passes)

After generating a thumbnail, compare it against the inspiration PNG using this structured 5-pass process. Each pass has a specific focus. ALL 5 passes are mandatory — agents cannot skip passes or combine them. Single-pass comparison causes tunnel vision (fixating on one issue while missing others).

#### Pass 1: ELEMENT INVENTORY (What exists?)

**Focus**: Count every visual element in BOTH images. Missing or extra elements = BLOCKING.

For EACH category below, count in inspiration AND in output:

| Category | Inspiration Count | Output Count | Match? |
|----------|------------------|-------------|--------|
| Container Boxes (bordered panels) | | | |
| Takeaway Boxes (dark panels) | | | |
| Chart(s) | | | |
| Data labels on chart (totals, values) | | | |
| Annotation/callout boxes | | | |
| Leader lines (callout -> data) | | | |
| Reference lines (markLine thresholds) | | | |
| Highlight regions (markArea) | | | |
| Connector lines (dashed vertical) | | | |
| Arrows/chevrons between panels | | | |
| SVG shapes (funnels, staircases, etc.) | | | |
| Bullet lists | | | |
| Headers/titles | | | |
| Badges/pills/ovals | | | |
| Footnotes/sources | | | |
| Free-floating content (bare flex siblings) | | | |

**Rules**:
- ANY count mismatch = BLOCKING (maps to Rules 33, 38; Tests 2, 10, 12; P25)
- "0 leader lines" when inspiration shows 3 = BLOCKING (maps to Rule 34, Test 10)
- "0 Container Boxes" when inspiration shows 2 = BLOCKING (maps to Rules 11, 17; P16)
- Free-floating content siblings (div with 2+ content elements but no border/container) = BLOCKING (maps to Rule 11)
- Don't count embedded ECharts elements (bars, axes) — those are verified in Pass 5

#### Pass 2: POSITION & ALIGNMENT (Where is everything?)

**Focus**: Measure positions of all elements using PVG 10x10% grid. Deviations > 7% = BLOCKING.

For EACH positioned element (annotations, callouts, badges, pills, SVG shapes, labels, milestones):

| Element | Insp. X% | Insp. Y% | Output X% | Output Y% | DeltaX | DeltaY | Verdict |
|---------|----------|----------|-----------|-----------|--------|--------|---------|
| (each) | | | | | | | PASS/BLOCKING |

**Also check alignment axes** (maps to Test 5, Section 2.3):
- Trace vertical ruler from title left edge -> does it hit content left edges?
- Trace horizontal ruler across panel tops -> are they level?
- Column headers aligned with content below?
- Markers centered on column boundaries?

**Header-body column alignment check:**

For Container Boxes with multi-column headers:

| Header Sub-Column | Body Column Below | Left Edges Aligned? |
|---|---|---|
| (each header section) | (corresponding body area) | YES/NO |

Trace vertical line from each header sub-column's left edge. Does it hit the body column's left edge? Misalignment > 5% of container width = BLOCKING.

**Title-legend clearance:**
- For slides with legend in the title zone: title text overlaps legend? Gap < 10pt? = BLOCKING
- Multi-line title with position:absolute legend = almost always collides — BLOCKING
- Legend on a separate line BELOW the title (not at same height) = BLOCKING even if no overlap. Fix: h1 max-width:75%, legend min-width:140pt, title-zone flex-wrap:nowrap

**Rules**:
- DeltaX or DeltaY > 7% = BLOCKING (maps to Rule 42; Test 13)
- Misaligned columns/headers = BLOCKING (maps to postflight "Column alignment" row)
- Labels far from their data (e.g., total "42M" floating 20% away from bar top) = BLOCKING (maps to Rule 32)

**Proportional sizing check** (maps to Phase 1 Proportional Observation):

For every side-by-side comparison in the output (columns, bar groups, panels representing different data magnitudes):

| Element Pair | Inspiration Ratio | Output Ratio | Match (+/-10%)? |
|-------------|------------------|-------------|-----------------|
| (e.g., Column A vs Column B) | ~4:1 | (measure widths) | |
| (e.g., Bar X vs Bar Y) | ~60% height | (measure) | |
| (e.g., Stacked bar totals) | (from data) | (measure) | |

- Equal-width flex:1 for unequal data magnitudes = BLOCKING
- Data-aligned annotations positioned with flex space-around instead of explicit positioning = BLOCKING
- Labels/values aligned alongside data elements must match the CENTER of their corresponding data element (not evenly spaced) = required
- This applies to: growth values beside bar segments, category labels beside stacked bars, annotations beside chart elements, timing labels alongside timeline phases

**Text line-count comparison:**

For every short text element (labels, category names, annotations), compare line count:

| Text Element | Inspiration Lines | Output Lines | Match (+/-1)? |
|---|---|---|---|
| (each label) | (count) | (count) | |

- Output text wrapping to 2+ more lines than inspiration = BLOCKING (column too narrow or font too large)
- This catches "crowded" / "cramped" output that is content-correct but visually wrong

#### Position Verification Grid (PVG) — Used in Pass 2

MANDATORY for Phase 7 (visual validation) for EVERY positioned element — annotations, badges, milestones, callouts, pills, floating labels.

**STEP 1 — GRID: Overlay a 10x10% grid**

Mentally divide the inspiration into a 10x10 percentage grid:
- X-axis: 0%, 10%, 20%, ..., 100% (left to right)
- Y-axis: 0%, 10%, 20%, ..., 100% (top to bottom)

Apply the grid to the element's CONTAINER (panel, chart area, content zone) — not the full slide. A pill inside a left panel is measured as % of that panel.

**STEP 2 — MAP: Record inspiration position**

For each positioned element, record:
- Element name
- Container (what it's inside)
- X position as % of container width
- Y position as % of container height
- WHAT it references (which data point, boundary, or landmark)

**STEP 3 — MEASURE: Record output position**

Same measurements for the generated thumbnail.

**STEP 4 — COMPARE: Produce the Position Verification Table**

You MUST produce this table during Phase 7 validation. It is MANDATORY.

```
POSITION VERIFICATION TABLE:
| Element | Container | Inspiration X% | Inspiration Y% | Output X% | Output Y% | DeltaX | DeltaY | Verdict |
|---------|-----------|----------------|----------------|-----------|-----------|--------|--------|---------|
| -40% pill | Left panel | 65% | 35% | 95% | 10% | 30% | 25% | BLOCKING |
| Callout box 1 | Right panel | 70% | 20% | 90% | 15% | 20% | 5% | BLOCKING |
| Milestone 1 | Content zone | 33% | 95% | 15% | 95% | 18% | 0% | BLOCKING |
```

**VERDICT RULES:**

| Max(DeltaX, DeltaY) | Verdict | Action |
|---|---|---|
| <= 5% | PASS | No action |
| 6-7% | MINOR | Fix if possible, document if not |
| > 7% | BLOCKING | MUST fix before declaring PASS |

PVG table is MANDATORY for EVERY positioned element (absolute, flex-offset, margin-offset). Missing PVG row = BLOCKING.

**REFERENCE BINDING: What does each element point to?**

For annotations, you MUST also document what the element REFERENCES:
- "The -40% pill references the decline BETWEEN bar 4 and bar 5"
- "The milestone references the phase transition at the column 1/2 boundary"

If the element is at the wrong position, it references the WRONG data — this is a semantic error, not just a visual one.

**ITERATION CORRECTION — How to reposition an element**

When the PVG table shows a BLOCKING deviation, follow this correction protocol:

**STEP A — COMPUTE DELTA**: From the PVG table, calculate the needed move:

```
POSITION CORRECTION LOG (add to iteration summary):
| Element | Current X% | Target X% | DeltaX | CSS Property to Change | New Value |
|---------|-----------|-----------|--------|----------------------|-----------|
| -40% pill | 95% | 65% | -30% | left (or right->left conversion) | left: 65% (remove right: 10pt) |
| Milestone 1 | 15% | 33% | +18% | left margin or flex positioning | Place at column boundary |
```

**STEP B — POSITIONING STRATEGY** (by element type):

| Element Type | Positioning Approach | How to Achieve Target X% |
|---|---|---|
| Annotation pill on chart | Use ECharts `markPoint` with `coord: [x, y]` in data coordinates | Compute x from bar index: `coord: [barIndex, value]` |
| Callout box beside chart | Use `position: absolute; left: [X]%` relative to chart container | X% from PVG table directly maps to CSS left |
| Milestone on timeline | Use flex layout with explicit `margin-left` | `margin-left: calc(X% - halfWidth)` of content zone |
| Badge/label on panel | Use `position: absolute` within panel, with `left: X%; top: Y%` | X%, Y% from PVG table |
| Reference line | Use ECharts `markLine` with exact data coordinates | `markLine.data: [{ xAxis: value }]` — never CSS position |

**STEP C — VERIFY**: After correction, re-measure the element's position as a % of its container. Fill a new row in the PVG table. If DeltaX or DeltaY still >7%, iterate again.

**STEP D — CROSS-ITERATION TRACKING**: Maintain a running PVG table across iterations:

```
POSITION TRACKING (cumulative across iterations):
| Element | v1 X% | v2 X% | v3 X% | Target X% | Latest DeltaX | Status |
|---------|-------|-------|-------|-----------|---------------|--------|
| -40% pill | 95% | 70% | 65% | 65% | 0% | FIXED in v3 |
| Milestone 1 | 15% | 30% | 33% | 33% | 0% | FIXED in v3 |
```

This prevents regression — if v2 fixes a position but v3 breaks it again, the cumulative table makes the regression immediately visible.

#### Pass 3: STYLE & COLOR (How does everything look?)

**Focus**: Zone-by-zone color audit, fill/stroke classification, container treatments.

**Step A — Zone backgrounds** (maps to Test 4):

| Zone | Inspiration Background | Output Background | Match? |
|------|----------------------|-------------------|--------|
| Title zone | | | |
| Each panel | | | |
| Each header bar | | | |
| Takeaway box | | | |
| Footer | | | |

**Step B — Fill/Stroke classification** (maps to P14, Test 1):

| Element | Inspiration Treatment | Output Treatment | Match? |
|---------|---------------------|-----------------|--------|
| (each Container Box) | FILLED / OUTLINED / BORDER+HEADER | | |
| (each annotation) | FILLED / OUTLINED | | |
| (each shape) | FILLED / GRADIENT / OUTLINED | | |

**Step C — Color consistency** (maps to Rules 28, 35, 39; Check 40; P22):

| Element | Referenced Data Color | Element Color | Match? |
|---------|---------------------|--------------|--------|
| (each annotation/pill/badge referencing data) | | | |

**Pill/callout-to-category color mapping** (maps to Rules 35, 39):

For each callout pill, oval, or badge that references a specific data category:

| Pill/Callout | References Category | Category Legend Color | Pill Border/Fill Color | Match? |
|-------------|--------------------|--------------------|----------------------|--------|
| (each pill) | (which data series) | (hex from legend) | (hex from rendered) | |

- All pills uniform color when referencing different categories = BLOCKING
- Pill color must match the SPECIFIC category it references, not just any brand color
- Cross-reference against your Phase 1 Color Assignment Table. For EACH row in that table, verify the rendered color matches the expected color. Any mismatch = BLOCKING.

**Step D — Font tier audit** (maps to Rules 8, 13; Check 14; P11):
- Count distinct font sizes visible. More than 4 = BLOCKING.
- Same-role elements (all body text, all headers) appear same size?

**Step E — Line style transitions:**
- For each line series: does the solid/dashed transition point match the inspiration?
- Series that should transition (e.g., actual->forecast) but are entirely solid or entirely dashed = BLOCKING
- Transition appears at the correct X position? Verify against Phase 1 inventory.

#### Pass 4: SPATIAL RELATIONSHIPS (How do things connect?)

**Focus**: Leader lines touch targets, annotations enclose bars, callouts don't overlap data, SVGs span containers.

**Step A — Leader line endpoints** (maps to Rules 34, 38; P03, P10, P12):

| Leader Line | Callout End Touches? | Data End Touches? | Clean/Straight? | Verdict |
|-------------|---------------------|------------------|-----------------|---------|
| (each line) | YES/NO | YES/NO | YES/NO | PASS/BLOCKING |

**Step B — Annotation enclosure** (maps to Rule 16, 32; Test 9; Section 2.5):

| Annotation | Target Bars/Segments | Encloses Targets? | Snug (+/-4pt)? | Verdict |
|-----------|---------------------|-------------------|---------------|---------|
| (each) | | YES/NO | YES/NO | PASS/BLOCKING |

**Step C — Chart obstruction** (maps to Rule 36; P05):

| Overlay Element | Overlaps Chart Data? | All Data Readable? | Verdict |
|----------------|---------------------|-------------------|---------|
| (each callout/annotation on chart) | YES/NO | YES/NO | PASS/BLOCKING |

**Step D — SVG spanning** (maps to Rule 46; Check 50):

| SVG Element | Inspiration Width (% of container) | Output Width (% of container) | Match? |
|------------|-----------------------------------|------------------------------|--------|
| (each spanning SVG) | | | |

**Step E — Container completeness** (maps to Rules 11, 17; P16):

| Panel | Has Border? | Has Header Bar? | Header Has Text? | Verdict |
|-------|------------|----------------|-----------------|---------|
| (each panel in multi-panel layout) | YES/NO | YES/NO | YES/NO | PASS/BLOCKING |

**Step F — Overlay clearance** (maps to Rules 29, 36):

For each overlay element (arrow, bracket, gradient) that runs alongside content rows:

| Overlay | Runs Between | Row Above | Row Below | Collides? | Verdict |
|---------|-------------|-----------|-----------|-----------|---------|
| (each arrow/bracket) | (which rows) | (element above) | (element below) | YES/NO | PASS/BLOCKING |

- Overlay running THROUGH a pill/label/text row = BLOCKING
- Must run in dedicated narrow column or gap BETWEEN content rows
- Minimum clearance: >=6px from nearest content element

#### Pass 5: DATA FIDELITY (Is the data correct?)

**Focus**: Values match inspiration, labels are ON chart, chart orientation correct.

**Step A — Data values** (maps to P21):

| Data Point | Inspiration Value | Output Value | Match? |
|-----------|------------------|-------------|--------|
| (each bar height, label, percentage) | | | |

**Step B — Data label placement** (maps to Rule 37, 45; P23):

| Label | Content | On Chart (ECharts)? | Position Matches Inspiration? | Verdict |
|-------|---------|--------------------|-----------------------------|---------|
| (each total, %, value) | "42M", "-40%", etc. | YES/NO | YES/NO | PASS/BLOCKING |

**Step C — Chart structure** (maps to P17, P18):
- Bar orientation matches (vertical vs horizontal)?
- Chart fills container VERTICALLY (no large empty areas above/below)?
- Chart body fills container HORIZONTALLY (columns span >=70% of container width)?
- Each side panel fills >=70% vertically (not just top-loaded with bottom empty)?
- yAxis gridline count matches inspiration? 14 gridlines when inspiration shows 10 = FAIL
- Data fills the chart's vertical plotting area (not compressed into top portion)?
- Axis dead space < 25%? Large empty region below data on line/area charts = FAIL. Set yAxis.min closer to data minimum.
- Legend present for multi-series?
- Axis labels visible and readable?

#### Multi-Pass Completion Rule

Agent MUST produce ALL 5 pass tables before declaring any verdict. If ANY table has a BLOCKING entry, the agent MUST iterate. Declaring PASS without completing all 5 passes = INVALID VALIDATION (see Section 7 invalidation criteria below).

#### Rule-to-Image-Test Mapping

This table maps all 52 rules to their validation method. Rules tagged "IMAGE" must be validated in the Multi-Pass Protocol. Rules tagged "HTML-ONLY" are fully validated by pre-flight checks.

| Rule | Description | Type | Image Pass | Specific Check |
|------|-------------|------|------------|----------------|
| 1 | Must run Phase 7 | Process | N/A | Process compliance |
| 2 | VSD comparison tables | Process | N/A | Process compliance |
| 3 | Run adversarial tests | Process | N/A | Process compliance |
| 4 | Zero rationalization | Process | N/A | ARP compliance |
| 5 | Fix all issues per iteration | Process | N/A | Process compliance |
| 6 | Content density 85-100% | IMAGE | Pass 5C | Chart fills container, panels filled |
| 7 | Footer format | HTML-ONLY | N/A | Check 7 |
| 8 | Font sizes in px, max 4 | BOTH | Pass 3D | Count visible font sizes |
| 9 | Zero non-brand color warnings | HTML-ONLY | N/A | Console output |
| 10 | Transparent vs opaque | IMAGE | Pass 3B | Fill treatment verification |
| 11 | Every panel has Container/Takeaway | IMAGE | Pass 4E | Container completeness table |
| 12 | Panel fill >=85% | IMAGE | Pass 5C | Visual fill assessment |
| 13 | Font tier defaults | HTML-ONLY | N/A | CSS values |
| 14 | Issue regression tracking | IMAGE | All passes | Compare across iterations |
| 15 | Spatial validation specific | IMAGE | Pass 2 | PVG position table |
| 16 | Annotations enclose/bracket bars | IMAGE | Pass 4B | Annotation enclosure table |
| 17 | Container Box: border + header | IMAGE | Pass 4E | Container completeness table |
| 18 | Text padding >=4pt | IMAGE | Pass 2 | Visual padding estimate |
| 19 | No space-between on bullets | HTML-ONLY | N/A | CSS property |
| 20 | Table: dashed separators | BOTH | Pass 3B | Separator style visible |
| 21 | Separator: 1px dashed gray | BOTH | Pass 3B | Separator style visible |
| 22 | SVG fidelity (concave/convex) | IMAGE | Pass 1 + Test 14 | Shape outline audit |
| 23 | Annotation fill matches inspiration | IMAGE | Pass 3B | Fill classification table |
| 24 | Never remove header bar | HTML-ONLY | N/A | HTML structure |
| 25 | Section-description connection | IMAGE | Pass 4A | Leader line / alignment check |
| 26 | Sub-bullet en-dash | HTML-ONLY | N/A | HTML marker |
| 27 | Header height equalization | IMAGE | Pass 2 | Horizontal alignment ruler |
| 28 | Color tier discipline | BOTH | Pass 3C | Color consistency table |
| 29 | Element clearance >=8px | IMAGE | Pass 4C | Obstruction check |
| 30 | Language consistency | HTML-ONLY | N/A | Text analysis |
| 31 | Annotation fill consistency | IMAGE | Pass 3B | All same-type boxes same fill |
| 32 | Annotation spatial integrity | IMAGE | Pass 4B | Enclosure + snug sizing |
| 33 | Inspiration faithfulness | IMAGE | Pass 1 | Element inventory |
| 34 | Spatial link precision | IMAGE | Pass 4A | Leader line endpoints |
| 35 | Color consistency (annotation = data) | IMAGE | Pass 3C | Color match table |
| 36 | Element layering (no obstruction) | IMAGE | Pass 4C | Chart obstruction table |
| 37 | ECharts native annotations | BOTH | Pass 5B | Labels on chart |
| 38 | Every connection in VSD + HTML | IMAGE | Pass 1 | Connection count |
| 39 | Annotation border matches data color | IMAGE | Pass 3C | Color match table |
| 40 | No shape approximation | IMAGE | Pass 1 + Test 11 | Shape type fidelity |
| 41 | Implementation matches SDD | IMAGE | Test 14 | Edge count audit |
| 42 | PVG DeltaX/DeltaY <=7% | IMAGE | Pass 2 | Position verification table |
| 43 | ARP banned phrases | Process | N/A | ARP compliance |
| 44 | Sibling bullet consistency | HTML-ONLY | N/A | HTML structure |
| 45 | ECharts annotations (expanded) | BOTH | Pass 5B + Test 19 | Annotation audit table |
| 46 | SVG percentage width | BOTH | Pass 4D | SVG spanning table |
| 47 | Zero hardcoded colors | HTML-ONLY | N/A | HTML structure |
| 48 | Callout leader lines in ECharts | BOTH | Test 19 | Annotation audit table |
| 49 | Red color verification | IMAGE | Pass 3 | Color inventory |
| 50 | Data-bound graphic positioning | BOTH | Test 19 | Annotation audit table (Data-Bound? column) |
| 51 | Flex column stacking | HTML-ONLY | N/A | Pre-flight check 53 |
| 52 | Overlay dimension matching | BOTH | Test 19 | Annotation audit table (Overlay Aligned? column) |

**Key stat**: 35 of 52 rules (67%) require IMAGE validation. Pre-flight HTML checks alone cannot validate them.

### 6. Adversarial Self-Checks (24 Tests)

After completing Sections 1-5, you MUST run ALL 24 adversarial tests. These are specifically designed to catch errors that standard comparison misses.

#### Test 1: Opposite Properties
For each FILLED shape in the VSD, mentally swap it to OUTLINED (white fill + colored stroke). Would the thumbnail look different? If not, you may have gotten fill/stroke wrong. Do the same in reverse for OUTLINED shapes.

#### Test 2: Missing Primitive
For each composite CS-## in the VSD, count the number of primitive shapes listed. Now count the number of distinct visual primitives in that area of the thumbnail. Do the counts match? A missing primitive often means a cutout triangle or overlay is absent.

#### Test 3: Connection Test
Zoom into EVERY junction between adjacent shapes in the thumbnail. For each junction:
- Is there a visible gap or seam?
- Are the colors correct on both sides of the junction?
- For interlocking joints: does the protrusion seamlessly fill the notch?

#### Test 4: Zone Background Color Audit (MANDATORY — most common failure mode)

**Step A — Zone backgrounds:** For EACH panel/zone in the slide, fill in this table:

| Zone | Inspiration Background | Output Background | Match? |
|------|----------------------|-------------------|--------|
| Left panel | (describe: white/dark navy/light blue/etc.) | (observe in thumbnail) | |
| Right panel | (describe) | (observe) | |
| Header bars | (describe) | (observe) | |
| Content areas | (describe) | (observe) | |

ANY zone background mismatch = BLOCKING. A dark navy panel rendered as light blue/grey/white is the #1 most common failure. Check EVERY zone.

**Step B — Accent elements:** Verify badges, numbered circles, arrows, flow indicators:

| Element | Inspiration Color | Output Color | Match? |
|---------|------------------|-------------|--------|
| (each accent element) | (describe) | (observe) | |

Accent elements should use brand-primary/secondary, NOT grey — unless the inspiration explicitly uses grey for that specific element AND it's a background/separator, not an accent.

**Step C — Color inventory:** List every distinct color visible in the thumbnail. Compare against the CLR-## or COLORS table in the VSD. Any color in the thumbnail not in the VSD = issue. Any VSD color not in the thumbnail = issue.

#### Test 5: Alignment Grid
Trace vertical lines from the top of each column header straight down through the entire slide. Do ALL elements in that column align on these lines? Now trace horizontal lines across. Misalignment of flow indicators under content columns is the most common failure here.

#### Test 6: Layer Count
For each composite shape, count the number of visible layers (visual depth) in the thumbnail. Compare against the CS-## z-index order in the VSD. If VSD says 3 layers but you only see 2, a layer is hidden or merged incorrectly.

#### Test 7: Edge Morphology Test
For each shape with modified edges (notched, protruding, chamfered) in the VSD:
1. Is the modification visible in the thumbnail?
2. If it interlocks with an adjacent element, is the interlock working correctly?
3. Are the colors at the junction point correct (protrusion should match its parent shape, not the shape it protrudes into)?

#### Test 8: Padding Symmetry
For each container with documented padding in R-## 7.3:
- Compare top padding vs bottom padding — if VSD says they're equal, do they look equal?
- Compare left padding vs right padding — same check
- If the thumbnail shows obviously asymmetric padding where the VSD specifies symmetric, that's a misalignment issue.

#### Test 9: Annotation-Data Alignment (for chart/data slides)

For EACH annotation box or label overlay on the slide:
1. What data does this annotation describe? (read the annotation text)
2. Which chart elements (bars, segments, points) represent that data?
3. Does the annotation box VISUALLY ENCLOSE or BRACKET those specific elements?
4. If you removed the annotation, would the viewer lose information about which bars it refers to?

If the annotation "floats near" its target bars but doesn't enclose/bracket them, it FAILS — even if a human could guess which bars it refers to. The annotation's spatial relationship to its data must be EXPLICIT and UNAMBIGUOUS in the rendered output.

#### Test 10: Connection Inventory Audit (MANDATORY)
Count connections documented in VSD (IMP-05 connection inventory). Count connection elements visible in the generated thumbnail (lines, arrows, brackets, leader lines, dashed connectors). If VSD says N connections but thumbnail shows fewer than N, this is BLOCKING.

For each connection in IMP-05:
1. Is the connection visible in the thumbnail?
2. Does its TYPE match (dashed vertical, arrow, leader line, etc.)?
3. Does it connect the correct source and target elements?
4. Is it positioned correctly (aligned connectors match diagram elements, not evenly distributed)?

Missing connections = BLOCKING. Misaligned connections = MAJOR.

#### Test 11: Shape Type Fidelity (MANDATORY)
For every complex shape in the VSD (anything described as radial, circular, stepped, funnel, pyramid, staircase, hub-spoke, or similar):
1. Identify the shape TYPE in the VSD description
2. Identify the shape TYPE in the generated thumbnail
3. Do they match?

| VSD Shape Type | Generated Shape | Verdict |
|---------------|----------------|---------|
| "radial diagram with 5 sections" | rectangular 2x2 grid | BLOCKING — different shape type |
| "ascending stepped line with 3 steps" | flat horizontal line | BLOCKING — shape distortion |
| "funnel with 3 filter plates" | funnel with 3 plates | PASS |

The shape TYPE must match, not just approximate the layout. A fundamentally different geometric structure = BLOCKING regardless of how well other elements are rendered.

#### Test 12: Element Count Audit (MANDATORY)

Compare your Phase 1 ELEMENT COUNT against the final thumbnail:
1. Retrieve your Phase 1 element count: `N lines, M arrows, P shapes, Q connections, R annotations`
2. Count lines, arrows, shapes, connections, and annotations in the thumbnail
3. If Phase 1 said "2 reference lines" but thumbnail shows 1, this is BLOCKING — you dropped an element
4. If Phase 1 said "3 leader lines from callout to data" but thumbnail shows 0, this is BLOCKING — connections are missing
5. If Phase 1 said "1 chevron arrow BETWEEN panels" but the arrow is INSIDE a panel, this is BLOCKING — misplaced element

| Phase 1 Count | Thumbnail Count | Verdict |
|--------------|----------------|---------|
| 2 reference lines | 1 reference line | BLOCKING — dropped element |
| 3 leader lines | 0 leader lines | BLOCKING — missing connections |
| 1 arrow between panels | 1 arrow inside panel | BLOCKING — misplaced element |
| 7 growth ovals | 7 growth ovals | PASS |

Every element counted in Phase 1 must be accounted for in the thumbnail. Missing = BLOCKING.

#### Test 13: Position Verification Grid (MANDATORY for slides with positioned elements)

For EVERY annotation, badge, milestone, callout, pill, or floating label:

1. In the INSPIRATION: estimate the element's position as X% and Y% of its container
2. In the THUMBNAIL: estimate the same element's position as X% and Y% of its container
3. Compute DeltaX = |inspiration_X - output_X| and DeltaY = |inspiration_Y - output_Y|
4. Fill in the Position Verification Table:

| Element | Container | Insp. X% | Insp. Y% | Output X% | Output Y% | DeltaX | DeltaY | Verdict |
|---------|-----------|----------|----------|-----------|-----------|--------|--------|---------|
| (each element) | (its container) | | | | | | | PASS/BLOCKING |

**Verdict**: Max(DeltaX, DeltaY) > 7% = BLOCKING. The element is at the WRONG POSITION and must be moved.

Also verify REFERENCE BINDING: does the element still point to the same data/landmark?
A pill that was between bars 4-5 in the inspiration but is now above bar 1 references
DIFFERENT DATA — this is a semantic error, not just a position error.

#### Test 14: Shape Outline Audit (MANDATORY for slides with non-rectangular shapes)

For EVERY shape that was classified as Category 2-5 in the SDD Shape Decomposition Table:

1. Retrieve the edge counts from the SDD table (straight edges, curved edges, vertices)
2. In the THUMBNAIL: count the visible edges of the rendered shape
3. Compare:

| Shape | SDD Straight | SDD Curved | Thumbnail Straight | Thumbnail Curved | Match? |
|-------|-------------|-----------|-------------------|-----------------|--------|
| (each shape) | | | | | PASS/BLOCKING |

**Verdict**: If the thumbnail shape has FEWER curved edges than the SDD table specifies,
the shape was simplified — BLOCKING. If a Category 3 shape (curved) renders with all
straight edges (Category 1/2), the implementation is WRONG.

Common failures this catches:
- Rectangle-with-arc-cutout rendered as plain rectangle (missing arc = 0 curved vs 1 curved)
- Stepped polyline rendered as flat line (missing vertices)
- Tapered polygon rendered as rectangle (all parallel sides vs non-parallel)

#### Test 15: Chart Overlay Obstruction (MANDATORY for chart slides)

For EACH callout/annotation positioned near a chart:

| Element | Position (beside/above/ON TOP) | Overlaps data? | Data readable? | Verdict |
|---------|-------------------------------|---------------|----------------|---------|
| (each) | | YES/NO | YES/NO | PASS/BLOCKING |

- Callouts ON TOP of chart bars = BLOCKING
- Compare against inspiration: if callouts are to the SIDE in inspiration, they must be to the SIDE in output
- If an annotation overlaps chart data and obscures any bars/labels = BLOCKING

#### Test 16: Leader Line Endpoint Accuracy (MANDATORY when callouts reference chart data)

For EACH leader line:

| Line | Callout end touches box? | Data end touches data point? | Both touch? | Clean? | Verdict |
|------|-------------------------|----------------------------|-------------|--------|---------|
| (each) | YES/NO | YES/NO | YES/NO | YES/NO | PASS/BLOCKING |

- BOTH endpoints must touch targets. "Close but not touching" = BLOCKING.
- N callouts near a chart = N leader lines required. Missing lines = BLOCKING.
- Lines ending in empty space (not touching any data point) = BLOCKING.

#### Test 17: Data Label Placement (MANDATORY for charts with totals/deltas)

For EACH numeric label on/near a chart:

| Label | Content | Inspiration position | Output position | ON chart (ECharts)? | Verdict |
|-------|---------|---------------------|-----------------|---------------------|---------|
| (each) | "42M", "-40%" | (above bar / inside segment) | (describe) | YES/NO | PASS/BLOCKING |

- Totals above stacked bars must be centered above their bar (ECharts invisible series)
- Labels as HTML position:absolute divs instead of ECharts native = BLOCKING
- Labels disconnected from chart data (>5% away from target) = BLOCKING

#### Test 18: SVG Container Span (MANDATORY for spanning SVG elements)

For EACH spanning SVG (staircases, timelines, wave patterns):

| SVG | Inspiration width (% container) | Output width (% container) | Fills? | Verdict |
|-----|--------------------------------|---------------------------|--------|---------|
| (each) | | | YES/NO | PASS/BLOCKING |

- SVG stopping short of container (fixed pt/px width in fluid parent) = BLOCKING
- Compare: does the SVG visually fill the same proportion of its container as in the inspiration?

#### Test 19: ECharts-Native Annotation Audit (MANDATORY for chart slides)

For EACH annotation element on a chart slide:

| Annotation | In Chart Image? | Leader Line In Chart? | Technique | Data-Bound? | Overlay Aligned? | Verdict |
|-----------|----------------|----------------------|-----------|-------------|-----------------|---------|
| (each) | YES/NO | YES/NO/N/A | markLine/markPoint/$callouts/graphic | native/percentage | YES/NO/N/A | PASS/BLOCKING |

- Leader lines as separate HTML/SVG elements (not in chart image) = BLOCKING
- Numeric data labels as HTML position:absolute overlays = BLOCKING
- Callout box outlines as HTML borders instead of ECharts graphic = WARNING (suggest improvement)
- Reference lines missing from chart (only in HTML) = BLOCKING
- All annotations should use `var(--brand-*)` tokens, not hardcoded hex
- Percentage positioning for data-referencing annotations = WARNING (suggest markLine, $callouts, or markPoint)
- Unit mismatch (pt overlay on px graphic) = BLOCKING — overlay must use px matching graphic rect

#### Test 20: Translation Compliance
Verify no logos/brand marks, no decorative clip art, no non-brand colors on key shapes, containers present on all content panels, standard separators (1px dashed). Any violation = MAJOR.

#### Test 21: Positioned Element Spot-Check
Pick 3 random positioned elements (absolute, margin-offset). Measure their X% and Y% positions. Verify <=7% deviation from inspiration. Any >7% = BLOCKING.

#### Test 22: Per-Panel Fill
Measure each panel individually (not just overall). Each panel must fill >=70% vertical height. Measure: (last_content_bottom - first_content_top) / panel_height >= 0.70. Any panel <70% = MAJOR.

#### Test 23: CSS Variable Validity
Scan all var(--brand-*) references in HTML. Every variable must be from the valid set in the COMPLETE VALID CSS VARIABLES table. Any undefined variable = BLOCKING.

#### Test 24: SVG Faithfulness
Compare every SVG element against inspiration. Check: curve shapes (not straight-line approximations), proportions (viewBox aspect ratio), sizing relative to container, gradient treatment. Any crude approximation = MAJOR.

#### Anti-Rationalization Protocol (ARP)

MANDATORY for Phase 7 (visual validation). Run this protocol for EVERY difference between inspiration and output BEFORE classifying it as non-blocking.

**PRE-STEP — TEST BEFORE ACCEPT (also applies during implementation)**

This rule fires DURING implementation (Phases 3-5), not just at validation time.

**If you consider accepting ANY technical limitation — STOP and follow these 3 steps:**

1. **STATE** the limitation clearly: "I believe [X] doesn't work because [reason]."
2. **TEST** it: actually run the pipeline with the attempted fix. Do NOT skip this step.
3. **ONLY THEN** decide whether it's a real limitation or a false belief.

**Common false limitations agents accept without testing:**
- "ECharts doesn't support setting yAxis min > 0" -> FALSE. `yAxis: { min: 90 }` works perfectly.
- "ECharts can't do solid->dashed transitions in one series" -> FALSE. Use visualMap or split into two series.
- "I can't use var(--brand-accent-orange) because it doesn't resolve" -> FALSE after v5.4 (all accent vars now resolve).
- "This annotation technique doesn't work" -> Usually the config is wrong, not the technique.

**If you write "unavoidable limitation" or "inherent constraint" without having TESTED it, you are rationalizing per ARP. Guard #8 enforces this.**

**STEP 1 — BANNED PHRASES**

The following phrases are NEVER valid justifications. If you find yourself writing any of these, STOP — you are rationalizing.

| Banned Phrase | Why It's Banned | Required Replacement |
|---|---|---|
| "acceptable given pipeline limitations" | Must cite SPECIFIC item from Pipeline Limitations Table | "Pipeline limitation: [property] from table row [N]. Alternative [X] attempted. Result: [describe]" |
| "inherent to this design" | The inspiration doesn't have this issue | "The inspiration shows [X]. My output shows [Y]. Delta = [measurement]." |
| "minor (pipeline constraint)" | "Minor" is not a valid severity | "Deviation of [N]% — BLOCKING per PVG Protocol" OR "Proven limitation: [table ref]" |
| "close enough" | Measure the deviation | "Position delta: [N]%. Per PVG, this is [PASS/BLOCKING]." |
| "acceptable variation" | Nothing is "acceptable" without proof | "Deviation: [specific measurement]. Cause: [specific reason]." |
| "I think this looks fine" | Not evidence-based | "Per PVG table: DeltaX=[N]%, DeltaY=[M]%. Per SDD table: edge count matches. PASS." |
| "matches the inspiration" (when used to skip a structural rule) | Structural rules (11, 17, 35, 47) are ABSOLUTE. Inspiration appearance does not override them. | "Rule 11 requires a container. I will add a Takeaway Box even though the inspiration shows no visible border." |

**HIERARCHY RULE**: Measured evidence (PVG percentages, SDD edge counts) outranks visual impression. If your measurement says BLOCKING but your eye says "looks fine", the measurement wins.

**STEP 2 — CONSTRAINT PROOF**

If you believe a difference is caused by a pipeline limitation, provide ALL 4 of these:
1. **Property name**: Which CSS property from Pipeline Limitations Table (VSD section 6.1)?
2. **Table alternative**: What does the table recommend instead?
3. **Attempt evidence**: Show that you TRIED the alternative
4. **Result**: Why the alternative STILL doesn't match

If ANY of the 4 is missing, it's NOT a proven limitation. It's a fixable issue.

**STEP 3 — MEASURABLE DESCRIPTION**

Every difference MUST be described in measurable terms.

| WRONG (vague) | CORRECT (measurable) |
|---|---|
| "callout boxes are slightly off" | "callout box 1: x=90% in output vs x=70% in inspiration — DeltaX=20%" |
| "shape doesn't quite match" | "inspiration: 3 straight + 1 arc edge. Output: 4 straight + 0 arc. Missing arc." |
| "colors are close" | "inspiration annotation border: #5B9BD5. Output border: #1E3A5F. Different hex." |
| "position looks about right" | "milestone at x=15% of container. Inspiration at x=33%. DeltaX=18%." |

**STEP 4 — BINARY VERDICT**

After Steps 1-3, classify the difference:

| Verdict | Criteria | Action |
|---|---|---|
| **FIXABLE** | No proven pipeline limitation OR alternative not attempted | MUST fix before PASS |
| **PROVEN LIMITATION** | All 4 constraint proof fields filled + alternative attempted and failed | Document with exact constraint name. Move on. |

There is NO middle ground. "Probably a limitation" = FIXABLE until proven otherwise.

**ARP STOPPING CONDITION**

You may declare PASS only when:
- All SDD table entries have matching Categories in output
- All PVG table entries show DeltaX <= 7% and DeltaY <= 7%
- All ARP verdicts are either FIXABLE+FIXED or PROVEN LIMITATION
- Zero BANNED PHRASES appear in your validation text

**ARP ITERATION CORRECTION — Tracking issues across versions**

Issues don't disappear between iterations. When you find an issue in v(N), it MUST be explicitly re-verified in v(N+1). The ARP Issue Tracker enforces this:

**STEP A — LOG**: When ARP classifies an issue as FIXABLE, add it to the tracker:

```
ARP ISSUE TRACKER (maintained across all iterations):
| # | Issue (measurable) | Found In | ARP Verdict | Fix Applied In | Verified Fixed In | Status |
|---|--------------------|----------|-------------|---------------|------------------|--------|
| 1 | Shape 2: 4 straight edges, should be 3+1 arc (SDD mismatch) | v1 | FIXABLE | v2 (replaced div with SVG path) | v2 (Test 14: 3 straight + 1 arc) | CLOSED |
| 2 | Pill at x=95%, should be x=65% (PVG DeltaX=30%) | v1 | FIXABLE | v2 (changed right:10pt to left:65%) | v2 (PVG: DeltaX=0%) | CLOSED |
| 3 | 3D depth missing from funnel | v1 | FIXABLE | v2 (added gradient fills) | v2 (visual: gradients visible) | CLOSED |
| 4 | Callout box text unreadable | v2 | FIXABLE | — | — | OPEN |
```

**STEP B — RE-VERIFY**: In each new iteration, scan ALL OPEN rows in the tracker. For each row where "Fix Applied In" is the current version:
- Re-run the relevant check (SDD Test 14, PVG Test 13, visual comparison)
- If fixed: fill "Verified Fixed In" and set Status = CLOSED
- If NOT fixed: keep Status = OPEN and describe what's still wrong

**STEP C — REGRESSION CHECK**: For ALL CLOSED rows, spot-check that the fix hasn't regressed. If a CLOSED issue reappears, reopen it with a new "Found In" version.

**ARP PASS CONDITION**: You may ONLY declare PASS when:
- ALL rows in the ARP Issue Tracker have Status = CLOSED
- ALL CLOSED rows have been spot-checked for regression in the current iteration
- ZERO new issues were found in the current iteration's validation

If any row is OPEN, you are NOT done. Iterate again.

### 7. Fix List Generation

#### Severity Levels

| Severity | Definition | Examples |
|----------|-----------|---------|
| `BLOCKING` | Wrong identity, missing elements, broken assembly | Wrong fill/stroke classification, missing composite primitive, gap at interlocking junction, missing element |
| `MAJOR` | Wrong visual properties, significant misalignment | Wrong color, wrong proportions, alignment off >3pt, wrong edge morphology |
| `MINOR` | Small discrepancies within tolerance | Spacing off by 1-2pt, font size off by 1pt, slight color shade difference |

#### Fix Entry Format

| # | VSD Ref | Expected | Actual | Severity | Root Cause | Fix | Verify |
|---|---------|----------|--------|----------|-----------|-----|--------|
| 1 | `VS-10` | `OUTLINED (white fill + #2E75B6 stroke)` | `FILLED (#2E75B6 fill)` | BLOCKING | Wrong CSS: used `background: #2E75B6` instead of `background: white; border: 2px solid #2E75B6` | Change fill to white, add 2px solid stroke | Re-render, verify white interior and colored border visible |
| 2 | `CS-01` | `Seamless interlock at junction` | `Visible 1px gap at junction` | BLOCKING | Fill triangle SVG not overlapping enough | Increase SVG width from 10 to 14pt, extend quadrilateral 4pt into parent shape | Re-render, verify no gap at junction |

#### Fix Ordering Priority

Apply fixes in this order (most impactful first):

1. **Shape identity** — fill/stroke classification (FILLED vs OUTLINED)
2. **Edge morphology** — notches, protrusions, interlocking joints
3. **Spatial relationships** — adjacency, nesting, containment
4. **Proportions and dimensions** — shape sizes, aspect ratios
5. **Colors** — fill colors, stroke colors, text colors
6. **Typography** — font sizes, alignment, weight
7. **Spacing** — padding, margins, gutters

#### After Fixes

1. Re-generate the thumbnail
2. Re-run this ENTIRE validation checklist from Section 1
3. Do NOT skip sections on re-validation — fixes can introduce new issues
4. Maximum 3 full validation cycles before escalating

### 8. Score Calculation (Self-Scoring Gate)

After completing all adversarial tests, calculate the weighted quality score.

#### Score Table Template

| Dimension | Weight | Issues Found | Deductions | Raw Score | Weighted |
|-----------|--------|-------------|------------|-----------|----------|
| D1 Structural (25%) | 0.25 | ___ MINOR, ___ MAJOR, ___ BLOCKING | -1xM, -2xJ, -4xB | /10 | |
| D2 Spatial (20%) | 0.20 | ___ MINOR, ___ MAJOR, ___ BLOCKING | -1xM, -2xJ, -4xB | /10 | |
| D3 Color (15%) | 0.15 | ___ MINOR, ___ MAJOR, ___ BLOCKING | -1xM, -2xJ, -4xB | /10 | |
| D4 Density (15%) | 0.15 | ___ MINOR, ___ MAJOR, ___ BLOCKING | -1xM, -2xJ, -4xB | /10 | |
| D5 Data (15%) | 0.15 | ___ MINOR, ___ MAJOR, ___ BLOCKING | -1xM, -2xJ, -4xB | /10 | |
| D6 Typography (10%) | 0.10 | ___ MINOR, ___ MAJOR, ___ BLOCKING | -1xM, -2xJ, -4xB | /10 | |
| **TOTAL** | 1.00 | | | | **/10** |

#### Dimension Definitions

- **D1 Structural (25%)**: Element count match, shape fidelity, container accuracy, connection count
- **D2 Spatial (20%)**: PVG deviations, proportions, alignment, positioned element accuracy
- **D3 Color (15%)**: Brand palette compliance, undefined var detection, annotation-data color match
- **D4 Density (15%)**: Overall fill 85-95%, per-panel >=70%, no >40% contiguous empty zones
- **D5 Data (15%)**: All values correct, labels present, text verbatim from inspiration
- **D6 Typography (10%)**: Tier compliance (max 4 sizes), hierarchy, bold-keyword pattern, px units

#### Pass/Fail Rules

- **Weighted score >=8.5** AND **all dimensions >=7** = PASS
- **Weighted score <8.5** = MUST iterate (fix highest-impact issues first)
- **Any dimension <7** = MUST iterate on that dimension regardless of overall score
- **Any BLOCKING issue** = automatic dimension score <=6

### 9. Invalidation Criteria

**Your validation is INVALID if ANY of these are true:**

- No VSD exists for this slide (you must produce one via the preflight-checklist.md (VSD section) first)
- VSD has blank mandatory fields (validation without a complete spec is meaningless)
- Your validation table has fewer than (shape_count x 6) rows in Section 1
- You skipped Section 2 (relationship & spacing validation)
- You skipped Section 6 (adversarial self-checks)
- You found 0 issues without completing ALL 24 adversarial tests
- You compared the thumbnail against the HTML source instead of the VSD
- You did not group typography by role tier in Section 3.2
- You did not trace alignment axes across the thumbnail in Section 2.3
- You did not verify edge morphology at every junction in Adversarial Test 7
- You marked items as "MATCH" without observable evidence (e.g., "looks fine" without specifying what you observed)
- You assessed groups instead of individual elements (e.g., "shapes look OK" instead of checking each shape S-## individually)
- You found an issue in a previous iteration that was not explicitly re-verified in the current iteration's validation. Issues do not disappear by themselves — if v3 identified "annotation boxes don't enclose bars," v4 validation MUST re-check this specific issue and either confirm it's fixed or list it as still open.
- Your validation text contains any ARP banned phrase ("acceptable given pipeline limitations", "inherent to this design", "close enough", etc.) without the required replacement per ARP Step 1. Banned phrases invalidate the entire validation.
- You have positioned elements (annotations, badges, milestones) but did not produce a PVG Position Verification Table in Test 13.
- You have non-rectangular shapes but did not produce an SDD Shape Outline Audit in Test 14.
- Your ARP Issue Tracker has OPEN rows but you declared PASS.
- You have chart slides but did not complete ALL 5 passes of the Multi-Pass Image Comparison Protocol (Section 5 above).
- You have callout boxes near charts but did not run Test 15 (overlay obstruction) and Test 16 (leader lines).
- You have numeric labels on charts but did not run Test 17 (data label placement).
- You have spanning SVG elements but did not run Test 18 (SVG container span).
- Your Pass 1 Element Inventory table is missing or has fewer rows than the number of element categories.
- Your Pass 2 Position Verification table is missing or has fewer rows than the number of positioned elements.
- You found a MAJOR or BLOCKING issue in any Phase 7 check (PVG, SDD, Multi-Pass, adversarial test) but declared PASS without fixing it or proving it is a pipeline limitation per ARP Step 2 (all 4 constraint proof fields filled).

### 10. How to Use This Protocol

```
1. Generate the thumbnail (HTML -> PPTX -> PNG pipeline)
2. Open the thumbnail AND the VSD side by side
3. Complete Section 1: validate every shape, composite, and scale constraint
4. Complete Section 2: validate every relationship, alignment axis, padding/margin
5. Complete Section 3: validate every text element, role group, size ratio
6. Scan Section 4: check each applicable quality pattern (P01-P25 + McKinsey patterns)
7. Run Section 5: Multi-Pass Image Comparison Protocol (ALL 5 passes, mandatory)
8. Run Section 6: ALL 24 adversarial tests (mandatory, no skipping)
9. If issues found: create fix list (Section 7), apply fixes, re-generate, re-validate
10. Before declaring "done": verify Section 9 invalidation criteria are all clear
11. Calculate self-score using Section 8 Score Calculation template
```
