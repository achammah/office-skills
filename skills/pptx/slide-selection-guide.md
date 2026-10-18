# Slide Type Selection Guide

**MANDATORY**: Before creating any slide, use this guide to select the correct template from `examples/`.

**Scope**: This guide selects the **SLIDE TEMPLATE** (layout + structure). For choosing the chart TYPE within a data slide (bar vs line vs pie), see [`references/chart-selection-guide.md`](references/chart-selection-guide.md).

**Works for**: Single-slide requests AND full-deck composition. For the 8 most common content types, see the First Decision table in [`SKILL.md`](SKILL.md#single-slide-workflow-1-2-slides-only).

> **STOP — If this deck has 3+ slides:** Do NOT select templates and write HTML yourself. You MUST call the `Task` tool to spawn one sub-agent per slide. Call `Task(subagent_type: "general-purpose", description: "Create {slide} slide", prompt: "...")` for each slide — all in ONE response message. You are the ORCHESTRATOR. Return to SKILL.md → [Multi-Slide Presentations](SKILL.md#multi-slide-presentations-sub-agent-parallelization) for the full template.

---

## §1 How to Think About Slide Selection

Use four lenses — in priority order — to select the right template. Start from the first lens that gives you a clear answer.

### 1A. Objective-First Selection — "What am I trying to achieve?"

| Objective | Primary L1 | Typical Templates | Why |
|-----------|-----------|-------------------|-----|
| Prove a point with evidence | DATA | bar-with-callouts, line-chart, dashboard | Numbers are the evidence |
| Persuade to take action | NARRATIVE + STRUCTURE | executive-summary → bullets-standard → recommendation-table | Story arc: insight → so-what → action |
| Help choose between options | COMPARE | feature-comparison, scorecard, before-after | Side-by-side makes trade-offs visible |
| Explain how something works | EXPLAIN | operating-model, layers, hub-spoke, pillars | Visual metaphors make abstract concrete |
| Show what will happen and when | FLOW | gantt-chart, chevron-steps, phases, journey-flow | Sequence makes execution tangible |
| Provide context / set the stage | STRUCTURE | objectives, document-cover, numbered-agenda | Frame before you fill |

**Rule**: Start from the objective, not from the data. "I have revenue numbers" does not automatically mean a chart — if the objective is "convince the CFO to reallocate budget," the slide might be a recommendation-table with revenue as supporting evidence.

### 1B. Message-First Selection — "What is the ONE thing this slide says?"

Every slide has exactly one message. The message determines the template:

| Message Pattern | L1 | L2 Signal | Example |
|----------------|-----|-----------|---------|
| "X is bigger/smaller than Y" | DATA | ranking | "APAC revenue exceeds EMEA by 2.3x" |
| "X changed from A to B over time" | DATA | trend | "NPS improved from 32 to 67 since Q1" |
| "X is made up of A, B, C" | DATA | breakdown | "Cost base is 45% labor, 30% materials, 25% overhead" |
| "X and Y are correlated" | DATA | correlation | "Higher training hours correlate with lower attrition" |
| "X is performing at level Y" | DATA | performance | "3 of 5 KPIs are on track" |
| "We recommend X because Y" | NARRATIVE | text-insight | "Prioritize digital channel based on 3 factors" |
| "Client X achieved Y through Z" | NARRATIVE | case-study | "Vodafone reduced churn 18% via predictive model" |
| "The root cause is X" | NARRATIVE | diagnostic | "Three bottlenecks drive 80% of delays" |
| "Option A is better than B because..." | COMPARE | table or side-by-side | "Build vs Buy: build wins on 7 of 10 criteria" |
| "There is a gap between current and target" | COMPARE | gap | "Digital maturity scores 2.1 vs target of 4.0" |
| "The system works like this" | EXPLAIN | system or metaphor | "Our operating model has 4 layers" |
| "The process has N steps" | FLOW | step-by-step or timeline | "Implementation follows 3 phases over 18 months" |

**Test**: Write the slide title as a complete sentence with a verb. If you can't, the message is unclear — clarify before selecting a template.

### 1C. Data-First Selection — "What shape is the data I have?"

When the user provides raw data, its SHAPE determines the template:

| Data Shape | Signal | Template Direction |
|------------|--------|-------------------|
| Single number (KPI, metric) | Hero stat | `narrative-text-insight/stats.html` or `data-performance/kpi-dashboard.html` |
| List of items (no numbers) | Bullet list | `narrative-text-insight/bullets-*` |
| Items with categories + values | Bar/column chart | `data-ranking/*` |
| Time series (dates + values) | Line/area chart | `data-trend/*` |
| Parts that sum to 100% | Pie/stacked/treemap | `data-breakdown/*` |
| Two numeric variables per item | Scatter/bubble | `data-correlation/*` |
| Matrix (rows × columns, all filled) | Table or heatmap | `compare-table/*` |
| Matrix (rows × columns, checkmarks) | Check matrix | `compare-table/check-matrix.html` |
| Sequential steps with dates | Timeline/Gantt | `flow-timeline/*` |
| Sequential steps without dates | Process flow | `flow-step-by-step/*` |
| Hierarchical (parent → children) | Tree/layers/pillars | `explain-hierarchy/*` or `explain-system/layers.html` |
| Network (nodes + connections) | System diagram | `explain-system/*` |
| No data — pure concept | Framework/metaphor | `explain-metaphor/*` or `explain-framework/*` |

**Rule**: If the data has BOTH a time dimension AND a comparison dimension, default to DATA-trend (time is the primary axis). If time is secondary, use DATA-ranking with a time annotation.

### 1D. Audience-First Selection — "Who is this for?"

| Audience | Style | Template Bias | Density |
|----------|-------|---------------|---------|
| C-suite / Board | High-level, conclusion-first | dashboard, executive-summary, key-takeaways, bar-with-callouts | Low (3-5 elements per slide) |
| Working team | Detailed, evidence-rich | data-table, feature-comparison, gantt-chart, stacked-bar-chart | High (6-10 elements per slide) |
| External client (first meeting) | Polished, story-driven | document-cover → bullets-standard → pillars → recommendation-table | Medium, narrative-heavy |
| Workshop participants | Interactive, framework-oriented | objectives, 2x2-matrix, chevron-steps, categorized | Medium, action-oriented |

---

## §2 Presentation Architecture

When the user requests a full presentation (not a single slide), apply these rules.

### 2A. Minimum Deck Structure

Every presentation MUST include at minimum:

```
1. COVER            → structure-cover/document-cover.html
2. EXECUTIVE SUMMARY → structure-summary/executive-summary.html OR dashboard.html OR key-takeaways.html
3. BODY SLIDES      → (varies by content, minimum 3)
4. NEXT STEPS       → structure-next-steps/action-list.html OR recommendation-table.html
5. CLOSING          → structure-context/closing.html
```

For multi-section decks (3+ body sections), add before each section:
- `structure-cover/section-divider.html`

For decks > 10 slides, add after cover:
- `structure-agenda/numbered-agenda.html` (or `progress-highlight` for recurring meetings)

### 2B. Deck Archetypes

| Presentation Type | Slide Sequence | Total |
|-------------------|---------------|-------|
| **Strategy Recommendation** | cover → exec-summary → context/objectives → situation (2-3 DATA slides) → [divider] → complication (2-3 COMPARE/NARRATIVE slides) → [divider] → resolution (2-3 EXPLAIN/FLOW slides) → next-steps → closing | 15-20 |
| **Diagnostic / Assessment** | cover → exec-summary → objectives → [divider] → findings by area (5-8 DATA+NARRATIVE) → gap-analysis → recommendations → next-steps → closing | 12-18 |
| **Progress Update** | cover → agenda (progress-highlight) → dashboard → per-workstream (3-5 DATA/COMPARE) → risks (bullets-diagnostic) → next-steps → closing | 8-12 |
| **Board Presentation** | cover → exec-summary (1 slide only) → strategic context → performance (2-3 DATA) → key decisions (COMPARE) → next-steps → closing | 10-15 |
| **Workshop / Facilitation** | cover → objectives → agenda → per-exercise (FLOW/EXPLAIN) → synthesis (NARRATIVE) → next-steps → closing | 15-25 |
| **Client Pitch / Proposal** | cover → client context (NARRATIVE) → our approach (FLOW) → case studies → team (profile) → timeline → pricing (DATA) → next-steps → closing | 12-15 |

### 2C. Slide Count Heuristics

| Duration | Total Slides | Structural | Body | Rule |
|----------|-------------|------------|------|------|
| 5 min | 5-7 | 2 | 3-5 | 1 slide/min |
| 15 min | 8-12 | 3 | 5-9 | 1 slide/1.5 min |
| 30 min | 12-18 | 4-5 | 8-13 | 1 slide/2 min |
| 60 min | 20-30 | 6-8 | 14-22 | 1 slide/2-3 min |

### 2D. Narrative Sequencing Rules

- **Never** put 3+ DATA slides in a row without a NARRATIVE or STRUCTURE break
- **Always** follow a diagnostic/problem section with a solution/recommendation section
- **SCR arc**: Opening sections = Situation (context), Middle sections = Complication (findings/gaps), Closing sections = Resolution (recommendations/actions)
- **One message per slide**: If a slide makes two arguments, split it into two slides
- Slide titles must be **action titles** (assertions with verbs): "Revenue grew 23% driven by APAC" not "Revenue by Region"

---

## §3 Ambiguity Resolution

When the user's request doesn't clearly map to one template.

### 3A. Vague Request Decomposition

| User Says | Think | Do |
|-----------|-------|-----|
| "Make me a presentation about X" | Full deck | Pick archetype from §2B → build minimum structure → fill body slides |
| "Show me the data" | Data slide, but which L2? | Ask: trend over time? ranking across categories? parts of whole? correlation? |
| "Give me a summary" | STRUCTURE-summary | Executive audience → dashboard / Team → key-takeaways / Mixed → executive-summary |
| "Compare the options" | COMPARE, but which L2? | 2 options → side-by-side / 3+ options → table / Quantitative → scorecard / Qualitative → feature-comparison |
| "Show the timeline" | FLOW-timeline | Calendar dates → horizontal-timeline / Task durations → gantt-chart / Milestones only → milestones / Parallel tracks → swimlane |
| "Explain the framework" | EXPLAIN | Named (Porter's, SWOT) → explain-framework / Pillars → metaphor/pillars / Architecture → system / Hierarchy → hierarchy |
| "I need a one-pager" | Single dense slide | Use dashboard or exec-summary with maximum density |
| "Add an appendix" | Standalone slide | Must work without context: full title, source, self-contained data |

### 3B. Data-Driven Disambiguation

When the user provides data but no explicit template preference:

| What You See in the Data | Deciding Question | If Yes → | If No → |
|--------------------------|-------------------|----------|---------|
| Numbers over time periods | Is the trend the message? | DATA-trend (line/area) | DATA-ranking (bar chart with time as secondary) |
| Percentages that sum to 100% | Fewer than 6 segments? | pie-donut-chart | stacked-bar or treemap |
| Multiple entities with scores | Are scores on the same scale? | scorecard or heatmap | feature-comparison |
| Yes/No/Partial across categories | More than 5 categories? | check-matrix | feature-comparison |
| Ranges (min-max per category) | Is deviation from center the point? | diverging-bar-chart | range-bar-chart |
| Two numeric dimensions per item | More than 15 data points? | scatter-plot | bubble-chart (if 3rd var) or bar chart |
| Tasks with start/end dates | Parallel workstreams? | swimlane or gantt-chart | phases or milestones |
| Items in a priority/ranked order | Need to show gaps between items? | gap-bar-chart | horizontal-bar-explicit |

### 3C. Default When Truly Ambiguous

If after applying 3A and 3B you still can't decide:

| Category | Default Template | Why |
|----------|-----------------|-----|
| DATA (unknown type) | `data-ranking/bar-with-callouts.html` | Most versatile — bars + insight panel |
| NARRATIVE (unknown type) | `narrative-text-insight/bullets-standard.html` | Clean, adapts to any text content |
| COMPARE (unknown type) | `compare-table/feature-comparison.html` | Handles any # of criteria and options |
| STRUCTURE (unknown type) | `structure-summary/executive-summary.html` | Works for any structural need |
| EXPLAIN (unknown type) | `explain-system/operating-model.html` | Most flexible system diagram |
| FLOW (unknown type) | `flow-step-by-step/chevron-steps.html` | Works for any sequential content |

---

## §4 Step 1: Communication Intent → L1

What is the slide trying to do?

| Intent | L1 | Trigger Phrases | Dir | Count |
|--------|-----|-----------------|-----|-------|
| Show numbers, metrics, data | DATA | chart, graph, KPI, dashboard, metrics, trend, scatter, bubble, bar, pie, donut, waterfall, treemap, heatmap, area chart | `data-*` | 35 |
| Tell story, share insights | NARRATIVE | bullets, key points, insights, findings, case study, profile, testimonial, quote, diagnostic, root cause | `narrative-*` | 20 |
| Compare options, alternatives | COMPARE | compare, versus, vs, table, matrix, scorecard, benchmark, before/after, gap analysis, side by side, pros/cons | `compare-*` | 17 |
| Organize or navigate | STRUCTURE | cover, title page, agenda, contents, summary, takeaways, objectives, next steps, closing, divider | `structure-*` | 15 |
| Explain a concept or system | EXPLAIN | framework, pillars, hub-spoke, Venn, onion, puzzle, architecture, model, capability, ecosystem, 2x2, maturity | `explain-*` | 17 |
| Show process or sequence | FLOW | timeline, milestones, Gantt, process, steps, chevron, funnel, Sankey, swimlane, journey, phases, roadmap | `flow-*` | 16 |

**Edge case rules:**
- Data WITH text insights → DATA (chart + takeaway panel, not NARRATIVE)
- Comparing data across categories → DATA-ranking (not COMPARE, unless explicit evaluation criteria)
- Framework with data → EXPLAIN if framework is the message, DATA if the numbers are the message

---

## §5 Step 2: Visual Strategy → L2

Within each L1, pick the L2 that best matches. L3 hints are provided for subcategories with ≤5 templates.

### DATA
| L2 | When to Use | Directory |
|----|-------------|-----------|
| breakdown | Parts of a whole (stacked, waterfall, pie, treemap) | `data-breakdown/` |
| ranking | Comparing magnitudes across categories | `data-ranking/` |
| trend | Change over time (line, area, column) | `data-trend/` |
| correlation | Relationships between variables (scatter, bubble). *Choropleth for geographic. Quadrant for 2×2 positioning. Bubble if 3 variables. Scatter for 2 variables.* | `data-correlation/` |
| performance | KPI dashboards and scorecards. *KPI-dashboard for card grid with sparklines. Dashboard for table with bars + traffic lights.* | `data-performance/` |

> **Cross-reference**: For choosing the chart TYPE within a data slide (bar vs line vs scatter), see [`references/chart-selection-guide.md`](references/chart-selection-guide.md).

### NARRATIVE
| L2 | When to Use | Directory |
|----|-------------|-----------|
| text-insight | Bullet points, numbered lists, icon grids, stats | `narrative-text-insight/` |
| case-study | Real-world examples, profiles, mini-cases. *Mini-grid if multiple. Profile if person/company. C-A-R if structured. Standard for full narrative.* | `narrative-case-study/` |
| diagnostic | Root cause analysis, issue trees | `narrative-diagnostic/` |
| quotes | Testimonials, voice of customer. *Single if one featured quote. Grid if multiple.* | `narrative-quotes/` |

### COMPARE
| L2 | When to Use | Directory |
|----|-------------|-----------|
| table | Structured comparison (feature matrix, scorecard, checklist) | `compare-table/` |
| side-by-side | Visual juxtaposition. *Three-way if 3 options. Benchmark if one-vs-many. Before-after if transformation. Standard for simple A vs B.* | `compare-side-by-side/` |
| scenario | Future alternatives, what-if analysis | `compare-scenario/` |
| gap | Current vs target state | `compare-gap/` |

### STRUCTURE
| L2 | When to Use | Directory |
|----|-------------|-----------|
| cover | Title page or section divider. *Document-cover for title page. Section-divider for topic breaks.* | `structure-cover/` |
| agenda | Table of contents, progress navigation | `structure-agenda/` |
| summary | Executive summary, key takeaways. *Executive-summary for narrative. Dashboard for KPI cards. Key-takeaways for conclusions.* | `structure-summary/` |
| context | Objectives, references, closing. *Objectives for goals. References for sources. Closing for end slide.* | `structure-context/` |
| next-steps | Action items, recommendations. *Action-list for vertical list. Recommendation-table for tabular format.* | `structure-next-steps/` |

### EXPLAIN
| L2 | When to Use | Directory |
|----|-------------|-----------|
| system | Operating models, architectures, capability maps | `explain-system/` |
| metaphor | Pillars, hub-spoke, Venn, onion, puzzle. *Pillars if foundations. Hub-spoke if center-satellite. Venn if overlap. Onion if nested. Puzzle if interlocking.* | `explain-metaphor/` |
| framework | Named frameworks, maturity models. *Standard if static. Maturity-model if progressive stages.* | `explain-framework/` |
| hierarchy | Logic trees, org charts | `explain-hierarchy/` |
| matrix | 2x2 positioning matrices | `explain-matrix/` |

### FLOW
| L2 | When to Use | Directory |
|----|-------------|-----------|
| timeline | Milestones, phases, Gantt charts | `flow-timeline/` |
| step-by-step | Sequential processes, chevrons | `flow-step-by-step/` |
| value-chain | Swimlanes, journey flows | `flow-value-chain/` |
| cycle | Repeating processes, feedback loops | `flow-cycle/` |
| funnel | Conversion funnels, Sankey diagrams | `flow-funnel/` |

> **Note**: For decision trees or branching logic, use `explain-hierarchy/logic-tree.html`.

---

## §5.5 Disambiguation Questions

If multiple templates seem to fit after Step 2, use these tiebreakers. Every subcategory with 2+ templates has a disambiguation section below.

### DATA - Ranking (10 templates)
- **How many chart panels?** 1 → continue below | 2 → `dual-panel` | 4 → continue below
- **4 panels: Are all sub-charts horizontal bars?** Yes → `horizontal-bar-chart`. **Are they vertical bar charts?** Yes → `bar-small-multiples`.
- **1 panel: Need callout annotations?** Yes → `bar-with-callouts`
- **1 panel: Showing deviation from zero?** Yes → `diverging-bar-chart`
- **1 panel: Showing min-max ranges?** Yes → `range-bar-chart`
- **1 panel: Grouped multi-series bars?** Yes → `clustered-bar-chart`
- **1 panel: Highlighting gap between groups?** Yes → `gap-bar-chart`
- **1 panel: Are bars horizontal with a reference/threshold line?** Yes → `horizontal-bar-explicit`. **Are bars vertical with an insights sidebar?** Yes → `vertical-bar-chart`.

### DATA - Breakdown (8 templates)
- **Waterfall/bridge showing additions and subtractions?** Yes → **Need sidebar commentary alongside?** Yes → `waterfall-standalone`. No → `waterfall-chart`.
- **Simple part-of-whole with ≤6 segments?** Yes → `pie-donut-chart`. No → continue.
- **Hierarchical nested categories?** Yes → `treemap`. No → continue.
- **Bars normalized to 100% for proportional comparison?** Yes → `100-percent-stacked`. No → continue.
- **Multiple stacked charts in a small-multiples grid?** Yes → `stacked-small-multiples`. No → continue.
- **Need annotation callouts or map alongside the stacked chart?** Yes → `stacked-with-callouts`. No → `stacked-bar-chart`.

### DATA - Trend (11 templates)
- **Two trend charts side by side?** Yes → `dual-panel`. No → continue.
- **Multiple small trend charts in a grid?** Yes → `small-multiples`. No → continue.
- **Two-state comparison (before vs. after)?** Yes → `before-after`. No → continue.
- **Future projections with confidence bands?** Yes → `scenario-projection`. No → continue.
- **Lines indexed/rebased to 100 for relative comparison?** Yes → `indexed-line`. No → continue.
- **Combined bar and line on same axes?** Yes → `combo-bar-line`. No → continue.
- **Stacked composition over time?** As area fill → `stacked-area-chart`. As stacked bars → `stacked-trend`. No → continue.
- **Period-over-period vertical bars (not combined with line)?** Yes → `column-chart`. No → continue.
- **Need annotation callouts on the line?** Yes → `line-with-callouts`. No → `line-chart`.

### DATA - Correlation (4 templates)
- **Geographic data (regions/countries on a map)?** Yes → `choropleth-placeholder`. No → continue.
- **Need 2×2 strategic positioning with labeled quadrants?** Yes → `quadrant-plot`. No → continue.
- **Third variable encoded as bubble size?** Yes → `bubble-chart`. No → `scatter-plot`.

### DATA - Performance (2 templates)
- **KPI cards with individual mini-charts/sparklines?** Yes → `kpi-dashboard`. No (table with bars + traffic lights) → `dashboard`.

### NARRATIVE - Text Insight (13 templates)
- **Simple list of points?** → `bullets-standard` (unordered) or `bullets-numbered` (ordered)
- **Split layout with chart?** → `bullets-with-visual`
- **Paired icon-boxes + descriptions?** → `insights-standard`
- **Grid of icon tiles?** → `icon-grid` (no bullets) or `bullets-icon-grid` (with sidebar + factors)
- **Card-based with status?** → `bullets-initiative-card`
- **Hero numbers?** → `stats` (giant numbers only) or `bullets-stats` (numbers + context bullets)
- **Multi-column layout?** → `bullets-multi-column`
- **Category-grouped bullets?** → `bullets-categorized`
- **Severity/RAG indicators?** → `bullets-diagnostic`
- **Icons with category labels?** → `bullets-icon-list`

### NARRATIVE - Case Study (4 templates)
- **Multiple case studies on one slide?** Yes → `mini-grid`. No → continue.
- **Person or company profile (centered image + details + metrics)?** Yes → `profile`. No → continue.
- **Structured Context-Action-Result three-column format?** Yes → `car-format`. No → `standard`.

### NARRATIVE - Quotes (2 templates)
- **Multiple quotes on the slide?** Yes → `grid`. No → `single`.

### COMPARE - Table (11 templates)
- **Color-coded intensity/heat matrix?** Yes → `heatmap`. No → continue.
- **Matrix of logos/icons showing competitive landscape?** Yes → `logo-matrix`. No → continue.
- **Yes/Partial/No capability check matrix?** Yes → `check-matrix`. No → continue.
- **Feature-by-feature vendor/option comparison?** Yes → `feature-comparison`. No → continue.
- **KPI metrics with baseline vs. target columns?** Yes → `kpi-table`. No → continue.
- **Performance scorecard with RAG status?** Yes → **Star ratings + trend arrows?** Yes → `scorecard-standard`. No (numeric ratings) → `scorecard`.
- **Initiatives with status badges and owners?** Yes → **Rows grouped by category headers?** Yes → `categorized`. No → `initiative-list`.
- **Plain reference data (sector, org, date)?** Yes → `reference-table`. No → `data-table`.

### COMPARE - Side by Side (4 templates)
- **Comparing 3 options?** Yes → `three-way`. No → continue.
- **One option benchmarked against multiple references?** Yes → `benchmark`. No → continue.
- **Before/after transformation with change indicators?** Yes → `before-after`. No → `standard`.

### STRUCTURE - Cover (2 templates)
- **Title page of the entire document/deck?** Yes → `document-cover`. No (section break) → `section-divider`.

### STRUCTURE - Agenda (5 templates)
- **Simple list, no sub-items?** → `numbered-agenda`
- **Need "you are here" highlight?** → **Do highlighted items have their own nested sub-lists?** Yes → `with-highlight`. No (flat sub-items) → `progress-highlight`.
- **Need binder/volume indicators?** → `progress-tracker` or `table-of-contents`
- **Formal ordered sub-items (A, B, C)?** → `table-of-contents`

### STRUCTURE - Summary (3 templates)
- **KPI/metric cards summary with visual indicators?** Yes → `dashboard`. No → continue.
- **Numbered "so what" conclusions?** Yes → `key-takeaways`. No → `executive-summary`.

### STRUCTURE - Context (3 templates)
- **Closing/thank-you/disclaimer slide?** Yes → `closing`. No → continue.
- **Reference materials and source citations?** Yes → `references`. No → `objectives`.

### STRUCTURE - Next Steps (2 templates)
- **Recommendations in table format with columns (owner, timeline)?** Yes → `recommendation-table`. No → `action-list`.

### EXPLAIN - System (8 templates)
- **Geographic regions/locations?** Yes → `geographic-map`. No → continue.
- **Governance/reporting structure (org chart)?** Yes → `governance`. No → continue.
- **Stakeholder groups arranged around a center?** Yes → `stakeholder-map`. No → continue.
- **Ecosystem or partner network (interconnected nodes)?** Yes → `ecosystem-map`. No → continue.
- **Capabilities in a matrix grid (categories × clusters)?** Yes → `capability-map`. No → continue.
- **Capabilities as flexible tiles/boxes?** Yes → `capability-tiles`. No → continue.
- **Vertical layers (technology stack, architecture tiers)?** Yes → `layers`. No → `operating-model`.

### EXPLAIN - Metaphor (5 templates)
- **Overlapping concepts (2-3 circles)?** Yes → `venn-diagram`. No → continue.
- **Nested layers from core to outer?** Yes → `onion-layers`. No → continue.
- **Central concept with satellite elements?** Yes → `hub-spoke`. No → continue.
- **Interlocking pieces that form a whole?** Yes → `puzzle`. No → `pillars`.

### EXPLAIN - Framework (2 templates)
- **Shows progression through stages/maturity levels?** Yes → `maturity-model`. No → `standard`.

### FLOW - Step by Step (4 templates)
- **Steps grouped into distinct phases with separate headings?** Yes → `phased-steps`. No → continue.
- **Each step needs detailed sub-content (sub-bullets, descriptions)?** Yes → `with-details`. No → continue.
- **Steps as chevron/arrow shapes pointing right?** Yes → `chevron-steps`. No → `box-steps`.

### FLOW - Timeline (6 templates)
- **Gantt bars with durations?** → `gantt-chart`
- **Parallel workstreams?** → `swimlane`
- **Phase blocks with status?** → `phases`
- **Milestone circles + deliverable boxes?** → `milestones`
- **Current/Target state cards?** → `general-milestones`
- **Simple date-column layout?** → `horizontal-timeline`

### FLOW - Value Chain (2 templates)
- **Organized by role/function (who does what at each stage)?** Yes → `swimlane`. No (customer/user journey with pain points) → `journey-flow`.

### FLOW - Funnel (3 templates)
- **Flow distribution between categories (multiple sources to destinations)?** Yes → `sankey-diagram`. No → continue.
- **Funnel oriented vertically (wide top, narrow bottom)?** Yes → `vertical-funnel`. No → `horizontal-funnel`.

---

## §6 Step 3: Pick Template

Find the closest match in the table below and start from that HTML file. Every table has four columns: **File**, **Use When**, **Layout**, and **Avoid When**.

### DATA - Breakdown (8 templates)
| File | Use When | Layout | Avoid When |
|------|----------|--------|------------|
| `data-breakdown/stacked-bar-chart.html` | Parts of whole across categories (stacked bars + takeaway) | Two-panel: stacked bar + pie chart | Only 1 category; use pie instead |
| `data-breakdown/100-percent-stacked.html` | Proportional comparison (100% stacked bars) | Four-row grid of small stacked bar multiples | Absolute values matter more than % |
| `data-breakdown/waterfall-chart.html` | Bridge/cascade showing additions and subtractions | Full-width waterfall chart with unit label | No additive/subtractive narrative |
| `data-breakdown/stacked-with-callouts.html` | Stacked chart with annotation callouts and map | Stacked bar + world map with star callout | No geographic or annotation angle |
| `data-breakdown/stacked-small-multiples.html` | Multiple stacked charts with left legend panel | Left panel legend + right stacked bars | Fewer than 3 sub-charts |
| `data-breakdown/waterfall-standalone.html` | Full-width waterfall with sidebar commentary | Bordered waterfall chart + right sidebar | No commentary needed; use waterfall-chart |
| `data-breakdown/pie-donut-chart.html` | Simple part-of-whole (≤6 segments) | Donut chart with center text + concentric rings | More than 6 segments; use stacked or treemap |
| `data-breakdown/treemap.html` | Hierarchical part-of-whole with nested categories | Full-width treemap + red-bordered callout boxes | Flat (non-hierarchical) data |

### DATA - Ranking (10 templates)
| File | Use When | Layout | Avoid When |
|------|----------|--------|------------|
| `data-ranking/horizontal-bar-chart.html` | 2×2 small-multiples grid of horizontal bars with methodology panel | 4 sub-charts grid + right sidebar | Single chart needed; use bar-with-callouts |
| `data-ranking/bar-with-callouts.html` | Single bar chart with positioned callout annotation boxes | Left insight panel + right grouped bars | No annotations needed; use vertical-bar-chart |
| `data-ranking/clustered-bar-chart.html` | Multi-series grouped comparison with bullet context | Blue container + bullet points above bars | Single series; use horizontal-bar-explicit |
| `data-ranking/diverging-bar-chart.html` | Positive/negative sentiment or deviation from center | Left overlay panel + right grouped bars | All values are same sign |
| `data-ranking/bar-small-multiples.html` | Multiple vertical bar charts in small multiples grid with methodology | Four-quadrant small multiples + methodology | Fewer than 3 sub-charts |
| `data-ranking/vertical-bar-chart.html` | Standard vertical bar chart with insights panel | Full-width column chart + right insights | Horizontal comparison preferred; use horizontal-bar-explicit |
| `data-ranking/range-bar-chart.html` | Min-max ranges across categories | Horizontal range bars + right insights | No range data; single values only |
| `data-ranking/dual-panel.html` | Two side-by-side bar charts | Left payback chart + right overlapping callout | Only one chart needed |
| `data-ranking/horizontal-bar-explicit.html` | Single horizontal bar chart with insight panel and color-coded tiers | Horizontal bars + dashed reference line | Need vertical orientation; use vertical-bar-chart |
| `data-ranking/gap-bar-chart.html` | Bar chart highlighting gaps between groups | Two bar charts + dashed gap connector lines | No gap/comparison narrative |

### DATA - Trend (11 templates)
| File | Use When | Layout | Avoid When |
|------|----------|--------|------------|
| `data-trend/line-chart.html` | Single or multi-line time series | Multi-line trend + right insights panel | Need annotations; use line-with-callouts |
| `data-trend/line-with-callouts.html` | Line chart with annotation callouts | Line with mark points + insights panel | Clean line without annotations preferred |
| `data-trend/scenario-projection.html` | Future projections with confidence bands | Left multi-line chart + right callout boxes | Historical data only; use line-chart |
| `data-trend/indexed-line.html` | Indexed (rebased to 100) comparison | Two stacked indexed line panels vertically | Absolute values are the message |
| `data-trend/dual-panel.html` | Two trend charts side by side | Two dual-axis charts side-by-side | Only one metric to show |
| `data-trend/column-chart.html` | Period-over-period vertical bars | Single column chart + full sidebar insights | Continuous trend; use line-chart |
| `data-trend/stacked-area-chart.html` | Cumulative trend with area fill | Left stacked area chart + right data table | Composition is secondary to level |
| `data-trend/before-after.html` | Two-state comparison over time | Side-by-side period panels + bandwidth legend table | No clear two-state narrative |
| `data-trend/small-multiples.html` | Multiple small trend charts in grid | Four-quadrant grid with CAGRs labeled | Fewer than 3 series to compare |
| `data-trend/stacked-trend.html` | Stacked bars showing composition over time | Stacked bar chart + supporting data table | Composition is not the focus |
| `data-trend/combo-bar-line.html` | Combined bar and line on same axes | Left combo bar-line + data table rows | Metrics are same unit/type; use line-chart |

### DATA - Correlation (4 templates)
| File | Use When | Layout | Avoid When |
|------|----------|--------|------------|
| `data-correlation/scatter-plot.html` | Two-variable relationship | Scatter chart + trend line + overlay insight panels | Fewer than 8 data points; use bar chart |
| `data-correlation/bubble-chart.html` | Three-variable relationship (size = 3rd var) | Bubble chart + bubble-size legend | Only 2 variables; use scatter-plot |
| `data-correlation/quadrant-plot.html` | 2×2 strategic positioning with data points | 2×2 quadrant scatter + shaded highlight | No strategic quadrant framework |
| `data-correlation/choropleth-placeholder.html` | Geographic data distribution (map placeholder) | Heatmap grid + column group headers | Non-geographic data |

### DATA - Performance (2 templates)
| File | Use When | Layout | Avoid When |
|------|----------|--------|------------|
| `data-performance/dashboard.html` | Multi-KPI dashboard with embedded bars | Table with bars + traffic light indicators | Need individual sparklines; use kpi-dashboard |
| `data-performance/kpi-dashboard.html` | KPI cards with mini-charts in grid | Six-card grid with mini charts | Dense tabular format preferred; use dashboard |

### NARRATIVE - Text Insight (13 templates)
| File | Use When | Layout | Avoid When |
|------|----------|--------|------------|
| `narrative-text-insight/bullets-standard.html` | Simple single-column bullet list with optional bold lead-ins | Vertical bullet list, left-aligned | Need visual elements; use bullets-with-visual |
| `narrative-text-insight/bullets-icon-list.html` | Left category column (green labels) + right content with circular flag/logo icons per item | Left icons + right-justified bullets | No category icons available |
| `narrative-text-insight/bullets-multi-column.html` | 2-3 equal columns of bullets, each with its own header | Three-column grid with text blocks | Content doesn't split into equal columns |
| `narrative-text-insight/bullets-categorized.html` | Bullets grouped under colored category headers in a single column | Grouped sections + color-coded headers | No natural grouping exists |
| `narrative-text-insight/bullets-numbered.html` | Sequentially numbered items (1, 2, 3) with bold titles and description text | Sequential numbered list + bold numbers | Order doesn't matter; use bullets-standard |
| `narrative-text-insight/bullets-with-visual.html` | 50/50 split: bullet list on one side, ECharts chart on the other | Split panel: left image + right text | No chart/visual to include |
| `narrative-text-insight/bullets-diagnostic.html` | Findings with severity/impact indicators (RAG colors, priority tags) | Left sidebar diagnostics + right details | No severity/priority dimension |
| `narrative-text-insight/bullets-initiative-card.html` | Each initiative gets its own bordered card with owner, timeline, status | Card grid: icon + title + description | Fewer than 3 initiatives |
| `narrative-text-insight/bullets-icon-grid.html` | Left sidebar (flags/images grid + bullet list) + right content with bold key-factor bullets | Three-column grid: icons above text | No icons/flags available |
| `narrative-text-insight/bullets-stats.html` | Large stat numbers paired with contextual explanation bullets | Horizontal row: large numbers + labels | No key statistics to feature |
| `narrative-text-insight/icon-grid.html` | N-column grid of icon + label tiles — no bullets, just icon-text cells | Three-column grid: centered icons + text | Need bullets/descriptions per item |
| `narrative-text-insight/insights-standard.html` | Left column: icon boxes with labels; right column: matching description paragraphs (paired layout) | Left icon boxes + right descriptions | More than 5 insight pairs |
| `narrative-text-insight/stats.html` | Giant hero metric numbers with small labels beneath, arranged horizontally | Giant hero numbers in horizontal row | More than 4 hero numbers |

### NARRATIVE - Case Study (4 templates)
| File | Use When | Layout | Avoid When |
|------|----------|--------|------------|
| `narrative-case-study/standard.html` | Full case study with situation/action/result narrative flow | Left-to-right: image + title + body | Need structured C-A-R columns; use car-format |
| `narrative-case-study/mini-grid.html` | Multiple mini case studies in grid | Two-column: compact blocks + statistics | Only 1 case study; use standard |
| `narrative-case-study/profile.html` | Company or person profile | Centered: image + details + outcome metrics | Need narrative flow; use standard |
| `narrative-case-study/car-format.html` | Context-Action-Result structured case | Three equal columns: C-A-R framework | Freeform narrative; use standard |

### NARRATIVE - Diagnostic (1 template)
| File | Use When | Layout | Avoid When |
|------|----------|--------|------------|
| `narrative-diagnostic/root-cause.html` | Root cause analysis or issue tree | Top metrics + three-column bottleneck cards | Not a diagnostic/root cause topic |

### NARRATIVE - Quotes (2 templates)
| File | Use When | Layout | Avoid When |
|------|----------|--------|------------|
| `narrative-quotes/grid.html` | Multiple quotes in grid layout | Two-row grid: quote cards + attribution | Only 1 quote; use single |
| `narrative-quotes/single.html` | Single featured quote with supporting metrics | Large left quote + right metrics boxes | Multiple quotes needed; use grid |

### COMPARE - Table (11 templates)
| File | Use When | Layout | Avoid When |
|------|----------|--------|------------|
| `compare-table/feature-comparison.html` | Feature-by-feature vendor/option comparison | Five-column table: archetypes + features | Binary yes/no data; use check-matrix |
| `compare-table/initiative-list.html` | List of initiatives with status and ownership | Multi-column: priority badges + status + owner | Need category grouping; use categorized |
| `compare-table/scorecard.html` | Performance scorecard with RAG status (numeric ratings) | Six-column: metrics + targets + actuals + ratings | Need star ratings; use scorecard-standard |
| `compare-table/check-matrix.html` | Y/P/N capability check matrix | Four-column: categories + check marks | Need detailed descriptions; use feature-comparison |
| `compare-table/reference-table.html` | Reference data in table format | Four-column: sector + org + date + stakeholder | Comparative evaluation needed |
| `compare-table/heatmap.html` | Color-coded intensity matrix | Seven-column: background color gradients | Fewer than 3×3 matrix; use data-table |
| `compare-table/categorized.html` | Table with category grouping rows | Colored category headers + initiative groups | No natural category groupings |
| `compare-table/kpi-table.html` | KPI metrics in table with targets | Five-column: baseline vs target columns | No baseline/target pairs |
| `compare-table/logo-matrix.html` | Competitive landscape with logos/icons | Matrix: service categories × players | No logos/icons to display |
| `compare-table/data-table.html` | Plain data table | Two multi-section tables + bullet points | Evaluation/comparison needed; use feature-comparison |
| `compare-table/scorecard-standard.html` | Standard scorecard with score + trend (star ratings + trend arrows) | Five-column: pillars + score + stars + trends | No trend data; use scorecard |

### COMPARE - Side by Side (4 templates)
| File | Use When | Layout | Avoid When |
|------|----------|--------|------------|
| `compare-side-by-side/standard.html` | Two-panel comparison (current vs proposed) | Two equal panels: current vs proposed | 3+ options; use three-way or table |
| `compare-side-by-side/before-after.html` | Before/after transformation with icons | Two columns: circular icons + alternating rows | No transformation narrative |
| `compare-side-by-side/three-way.html` | Three-option comparison with status indicators | Three equal cards + status + photo placeholders | Only 2 options; use standard |
| `compare-side-by-side/benchmark.html` | Benchmark comparison with metrics | Left narrow case + right four stacked examples | Not a one-vs-many comparison |

### COMPARE - Scenario (1 template)
| File | Use When | Layout | Avoid When |
|------|----------|--------|------------|
| `compare-scenario/grid-comparison.html` | Multiple scenarios in grid with icons | Three-column: large circular icons + text | Only 2 options; use side-by-side |

### COMPARE - Gap (1 template)
| File | Use When | Layout | Avoid When |
|------|----------|--------|------------|
| `compare-gap/gap-analysis.html` | Current vs target gap analysis | Bar chart + gap annotation circles + threshold | No current/target comparison |

### STRUCTURE - Cover (2 templates)
| File | Use When | Layout | Avoid When |
|------|----------|--------|------------|
| `structure-cover/document-cover.html` | Title page for document/deck | Centered title + subtitle, full-width | Mid-deck break; use section-divider |
| `structure-cover/section-divider.html` | Section break between topics | Minimal divider: title + background | First slide of deck; use document-cover |

### STRUCTURE - Agenda (5 templates)
| File | Use When | Layout | Avoid When |
|------|----------|--------|------------|
| `structure-agenda/numbered-agenda.html` | Simple numbered agenda items — no sub-items, no highlight, no volume indicators | Numbered list items, left-aligned | Need "you are here" highlight |
| `structure-agenda/progress-highlight.html` | 3-column document outline; one sub-item highlighted via blue tint to show "you are here" | 3-column grid + blue highlight on one item | Need nested sub-lists; use with-highlight |
| `structure-agenda/progress-tracker.html` | 3-column outline with SVG binder/volume indicators showing physical deliverable scope | 3-column grid + SVG binder icons | No physical deliverable scope |
| `structure-agenda/table-of-contents.html` | 3-column outline with ordered (A, B, C) sub-items and SVG binder/volume indicators | 3-column ordered index + SVG binders | Simple flat agenda; use numbered-agenda |
| `structure-agenda/with-highlight.html` | 3-column document outline; one sub-item highlighted via blue tint with deeper nested sub-lists | 3-column grid + blue highlight + nesting | Flat sub-items only; use progress-highlight |

> **Note**: `progress-highlight` and `with-highlight` differ only in nesting depth. Use `with-highlight` when sub-items have their own sub-lists (e.g., enablers → Infrastructure, Talent, Governance). Use `progress-highlight` for flat outlines.

### STRUCTURE - Summary (3 templates)
| File | Use When | Layout | Avoid When |
|------|----------|--------|------------|
| `structure-summary/executive-summary.html` | Text-heavy structured summary (Situation, Approach, Findings, Recommendations sections) | Left-right split: summary + details | Pure metrics; use dashboard |
| `structure-summary/dashboard.html` | KPI metric cards at top + supporting detail panels below (visual + numbers) | Grid: metric cards + KPI displays | Narrative-heavy; use executive-summary |
| `structure-summary/key-takeaways.html` | Numbered "so what" conclusions — concise end-of-section takeaway items | Numbered bullet points + emphasis styling | Need full context; use executive-summary |

### STRUCTURE - Context (3 templates)
| File | Use When | Layout | Avoid When |
|------|----------|--------|------------|
| `structure-context/objectives.html` | Meeting or project objectives | Three-column panel with aligned boxes | End-of-deck slide; use closing |
| `structure-context/references.html` | Reference materials and links | Two-column bibliography + source citations | Not a references/bibliography slide |
| `structure-context/closing.html` | Closing slide / thank you | Full-width conclusion panel + bold headline | Opening objectives slide; use objectives |

### STRUCTURE - Next Steps (2 templates)
| File | Use When | Layout | Avoid When |
|------|----------|--------|------------|
| `structure-next-steps/action-list.html` | Prioritized action items | Vertical list: icons + action items | Need owner/timeline columns; use recommendation-table |
| `structure-next-steps/recommendation-table.html` | Recommendations in table format | Two-column table: recommendations | Simple vertical list sufficient; use action-list |

### EXPLAIN - System (8 templates)
| File | Use When | Layout | Avoid When |
|------|----------|--------|------------|
| `explain-system/operating-model.html` | Operating model diagram | Horizontal flow boxes + connectors + arrows | Simple vertical stack; use layers |
| `explain-system/layers.html` | Technology or architecture layers | Vertical stacked boxes: hierarchical layers | Horizontal flow needed; use operating-model |
| `explain-system/governance.html` | Governance structure | Org chart: reporting relationships | Not a reporting structure |
| `explain-system/capability-map.html` | Capability map with categories | Grid matrix: capability cluster intersections | Flexible layout needed; use capability-tiles |
| `explain-system/capability-tiles.html` | Capability tiles in grid | Flexible grid of capability boxes | Strict category × cluster matrix; use capability-map |
| `explain-system/ecosystem-map.html` | Ecosystem or partner map | Network diagram: interconnected nodes | Hierarchical; use governance or layers |
| `explain-system/geographic-map.html` | Geographic presence or coverage | Regional breakdown: geographic segments | Non-geographic data |
| `explain-system/stakeholder-map.html` | Stakeholder mapping | Circular arrangement of stakeholder groups | Not stakeholder-related |

### EXPLAIN - Metaphor (5 templates)
| File | Use When | Layout | Avoid When |
|------|----------|--------|------------|
| `explain-metaphor/pillars.html` | Strategic pillars or foundations | Four vertical pillar columns side-by-side | Overlapping concepts; use venn-diagram |
| `explain-metaphor/hub-spoke.html` | Central concept with satellite elements (conceptual/structural) | Central hub + radiating spokes outward | No clear center element |
| `explain-metaphor/venn-diagram.html` | Overlapping concepts (2-3 circles) | Three overlapping circles + intersections | No overlap between concepts |
| `explain-metaphor/onion-layers.html` | Nested layers (core to outer) | Concentric ellipses: core to outer | Not nested/layered |
| `explain-metaphor/puzzle.html` | Interlocking pieces concept | Four interlocking puzzle pieces + labels | Pieces are independent; use pillars |

### EXPLAIN - Framework (2 templates)
| File | Use When | Layout | Avoid When |
|------|----------|--------|------------|
| `explain-framework/standard.html` | Named framework (e.g., Porter's, SWOT, diagnostic tools) | Two-column: sources panel + framework chevrons | Progressive stages; use maturity-model |
| `explain-framework/maturity-model.html` | Maturity or progression model | Three-column stages + S-curve progression | Static framework; use standard |

### EXPLAIN - Hierarchy (1 template)
| File | Use When | Layout | Avoid When |
|------|----------|--------|------------|
| `explain-hierarchy/logic-tree.html` | Logic tree, decision hierarchy, or branching structure | Root node → two main category branches | Not hierarchical; use system or metaphor |

### EXPLAIN - Matrix (1 template)
| File | Use When | Layout | Avoid When |
|------|----------|--------|------------|
| `explain-matrix/2x2-matrix.html` | 2×2 strategic positioning matrix | Four-quadrant grid + axis labels + content | More than 2 axes; use correlation/quadrant-plot |

### FLOW - Timeline (6 templates)
| File | Use When | Layout | Avoid When |
|------|----------|--------|------------|
| `flow-timeline/horizontal-timeline.html` | Equal-width date columns with vertical connection lines (newspaper-style timeline) | Four horizontal phase boxes + progression | Need Gantt bars; use gantt-chart |
| `flow-timeline/milestones.html` | Gradient-line with milestone circles and deliverable callout boxes below each | Gradient line + circles + deliverable boxes | Need duration bars; use gantt-chart |
| `flow-timeline/swimlane.html` | Swimlane rows organized by TIME period columns (when things happen in parallel) | Multi-row table: activity bars across columns | By role not time; use flow-value-chain/swimlane |
| `flow-timeline/phases.html` | Chevron-connected phase blocks with color-coded status and detail lists | Four overlapping phase blocks + varying heights | No phase structure; use milestones |
| `flow-timeline/gantt-chart.html` | ECharts Gantt chart with task bars, dependencies, and time axis | Table: colored bars representing activities | Simple milestones; use milestones |
| `flow-timeline/general-milestones.html` | Current State / Near-Term / Long-Term card panels with arrows + success factors row | Three milestone boxes + arrow connectors | Need specific dates; use horizontal-timeline |

### FLOW - Step by Step (4 templates)
| File | Use When | Layout | Avoid When |
|------|----------|--------|------------|
| `flow-step-by-step/box-steps.html` | Numbered box steps (framework pillars) | Five framework pillars in horizontal row | Need chevron arrows; use chevron-steps |
| `flow-step-by-step/with-details.html` | Steps with detailed sub-content descriptions | Eight chevron steps + detailed sub-content | Simple labels only; use chevron-steps |
| `flow-step-by-step/chevron-steps.html` | Chevron arrow process flow | Four chevron-shaped steps horizontally | Need sub-content per step; use with-details |
| `flow-step-by-step/phased-steps.html` | Multi-phase process | Two phase panels + activity sections | Single phase; use chevron-steps |

### FLOW - Value Chain (2 templates)
| File | Use When | Layout | Avoid When |
|------|----------|--------|------------|
| `flow-value-chain/swimlane.html` | Swimlane rows organized by ROLE/FUNCTION with steps flowing left-to-right (who does what) | Six-column value chain stages + activity rows | Time-based parallel tracks; use flow-timeline/swimlane |
| `flow-value-chain/journey-flow.html` | Customer or user journey | Six journey stages + pain point markers | Internal process; use swimlane |

### FLOW - Cycle (1 template)
| File | Use When | Layout | Avoid When |
|------|----------|--------|------------|
| `flow-cycle/circular-flow.html` | Circular repeating process | Six chevron steps arranged in circle | Linear/non-repeating process |

### FLOW - Funnel (3 templates)
| File | Use When | Layout | Avoid When |
|------|----------|--------|------------|
| `flow-funnel/vertical-funnel.html` | Conversion funnel (wide to narrow, vertical) | Left icons + center percentages + right findings | Multi-path flow; use sankey-diagram |
| `flow-funnel/horizontal-funnel.html` | Conversion funnel (horizontal orientation) | Horizontal funnel stages left-to-right | Vertical orientation preferred; use vertical-funnel |
| `flow-funnel/sankey-diagram.html` | Flow distribution between categories | ECharts Sankey: source-to-target flow | Simple single-path funnel; use vertical-funnel |

---

## §7 Multi-Chart Slides

If the slide needs 2+ charts:

| Scenario | Solution | Template |
|----------|----------|----------|
| Two related metrics (e.g., revenue + margin) | Side-by-side dual-panel | `data-ranking/dual-panel.html` or `data-trend/dual-panel.html` |
| Different data types (bar + line) | Side-by-side dual-panel | `data-trend/dual-panel.html` |
| Small multiples (same chart type, different data slices) | Small multiples grid | `data-ranking/bar-small-multiples.html` or `data-trend/small-multiples.html` |
| 3+ charts | Split into multiple slides | One chart per slide |
| KPIs with sparklines | Dashboard grid | `data-performance/kpi-dashboard.html` |

**Rules:**
- Maximum **1 chart per panel** — never stack charts vertically in a single panel
- Never place 2 `[data-echarts]` divs inside the same `.panel` container
- For 3+ charts: use multiple slides, not cramped layouts
- If the dual-panel template doesn't fit: split into separate slides
- Note: `data-ranking/horizontal-bar-chart.html` is also a small-multiples layout (2×2 grid of horizontal bars with methodology sidebar)

> If the two charts support the **SAME message**, use dual-panel. If they support **DIFFERENT messages**, use separate slides (§1 — one message per slide).

---

## §8 Quick Reference — Common Requests

Reverse-lookup for the 15 most common requests, bypassing the full methodology:

| User Request | Template | Why |
|-------------|----------|-----|
| "Revenue/sales by region" | `data-ranking/horizontal-bar-explicit.html` | Category ranking |
| "Trend over time" | `data-trend/line-chart.html` | Time series |
| "Compare vendors" | `compare-table/feature-comparison.html` | Multi-entity matrix |
| "Market share breakdown" | `data-breakdown/pie-donut-chart.html` or `stacked-bar-chart.html` | Parts of whole |
| "Project timeline" | `flow-timeline/gantt-chart.html` or `phases.html` | Time-phased plan |
| "Strategic pillars" | `explain-metaphor/pillars.html` | Foundation visual |
| "SWOT / 2×2" | `explain-matrix/2x2-matrix.html` | Quadrant positioning |
| "KPI dashboard" | `data-performance/kpi-dashboard.html` | Multi-metric cards |
| "Customer journey" | `flow-value-chain/journey-flow.html` | Stage-based flow |
| "Executive summary" | `structure-summary/executive-summary.html` | Text synthesis |
| "Before vs after" | `compare-side-by-side/before-after.html` | Two-state comparison |
| "Root cause analysis" | `narrative-diagnostic/root-cause.html` | Issue tree |
| "Process steps" | `flow-step-by-step/chevron-steps.html` | Sequential flow |
| "Operating model" | `explain-system/operating-model.html` | System architecture |
| "Recommendations" | `structure-next-steps/recommendation-table.html` | Prioritized actions |
