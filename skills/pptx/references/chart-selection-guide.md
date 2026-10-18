# Chart Selection Guide

This guide helps you select the right chart type for your data visualization needs. It covers 45+ supported chart types organized by family, with decision trees and discriminator questions.

---

## Implementation Quick Reference

**CRITICAL:** Before creating any chart, understand which implementation method to use:

### pptxgenjs Built-in Charts (editable in PowerPoint)
Use `slide.addChart()` for these chart types - they remain editable after export:
- **BAR** (vertical and horizontal)
- **LINE**
- **PIE**
- **DOUGHNUT**
- **AREA**
- **SCATTER**
- **BUBBLE**
- **RADAR**

### ECharts Required (rendered as image)
Use `data-echarts` attribute for these chart types - they are NOT available in pptxgenjs:
- **Bar variants:** waterfall, diverging_bar, histogram, bullet, gantt, tornado, radial_bar
- **Circular variants:** sunburst, half_donut
- **Specialized:** heatmap, treemap, funnel, gauge, sankey, marimekko, box_plot
- **Complex:** connected_scatter, any chart with custom styling beyond pptxgenjs defaults

---

## Quick Reference: Chart Type by Data Purpose

| Your Data Shows... | Chart Family | Recommended Types |
|-------------------|--------------|-------------------|
| Values across categories | Bar | vertical_bar, horizontal_bar, grouped_bar |
| Change over time | Line | line, multi_line, area |
| Parts of a whole | Circular | pie, donut (≤6 segments) |
| Correlation between variables | Scatter | scatter, bubble, quadrant |
| Cumulative impact/bridge | Specialized | waterfall, funnel |
| Matrix/grid data | Specialized | heatmap, gantt |
| Distribution of values | Bar | histogram, box_plot |
| Ranking/comparison | Bar | horizontal_bar (sorted), bullet |
| Performance vs target | Specialized | bullet, gauge |
| Flow/process | Specialized | sankey, funnel |

---

## Chart Families and Types

### Bar Family (20 types)

| Type | Use When | Key Visual Feature | Implementation |
|------|----------|-------------------|----------------|
| `vertical_bar` | Comparing discrete categories | Bars grow UP from baseline | pptxgenjs OR ECharts |
| `horizontal_bar` | Long category names, >7 categories | Bars grow RIGHT from baseline | pptxgenjs OR ECharts |
| `grouped_bar` | Comparing sub-categories side by side | Multiple bars per group with gaps | pptxgenjs OR ECharts |
| `stacked_bar` | Part-to-whole over categories | Bars stacked on same baseline | pptxgenjs OR ECharts |
| `100%_stacked_bar` | Comparing proportions across categories | All bars same total height | pptxgenjs OR ECharts |
| `diverging_bar` | Positive/negative values, sentiment | Bars extend LEFT and RIGHT from center | **ECharts ONLY** |
| `waterfall` | Cumulative impact, bridge analysis | Floating bars showing incremental change | **ECharts ONLY** |
| `histogram` | Distribution, frequency | Bars touch (no gaps), continuous data | **ECharts ONLY** |
| `gantt` | Project timeline, task scheduling | Horizontal bars positioned by time | **ECharts ONLY** |
| `bullet` | Performance vs target | Nested bars with reference markers | **ECharts ONLY** |
| `lollipop` | Emphasizing values with minimal ink | Dot on stick from baseline | **ECharts ONLY** |
| `pyramid` | Age distribution, demographic | Mirrored horizontal bars | **ECharts ONLY** |
| `tornado` | Sensitivity analysis | Centered diverging horizontal bars | **ECharts ONLY** |
| `range_bar` | Min-max ranges | Bars showing span from min to max | **ECharts ONLY** |
| `progress_bar` | Completion percentage | Filled portion of total bar | **ECharts ONLY** |
| `overlapping_bar` | Comparing two values per category | Semi-transparent overlaid bars | **ECharts ONLY** |
| `spine` | Part-to-whole comparison | 100% stacked horizontal bar | **ECharts ONLY** |
| `pictogram_bar` | Engaging infographics | Icons/shapes instead of bars | **ECharts ONLY** |
| `radial_bar` | Circular ranking | Bars arranged in circle | **ECharts ONLY** |
| `benchmark_bar` | Value vs benchmark | Bar with reference line marker | **ECharts ONLY** |

### Line Family (6 types)

| Type | Use When | Key Visual Feature | Implementation |
|------|----------|-------------------|----------------|
| `line` | Single trend over time | Connected points, no fill | pptxgenjs OR ECharts |
| `multi_line` | Comparing multiple trends | Multiple lines, different colors | pptxgenjs OR ECharts |
| `area` | Emphasizing volume/magnitude | Filled area below line | pptxgenjs OR ECharts |
| `stacked_area` | Cumulative trends | Stacked filled areas | pptxgenjs OR ECharts |
| `100%_stacked_area` | Proportion trends over time | Stacked areas totaling 100% | pptxgenjs OR ECharts |
| `slope` | Before/after comparison | Two points connected by line | **ECharts ONLY** |

### Circular Family (4 types)

| Type | Use When | Key Visual Feature | Implementation |
|------|----------|-------------------|----------------|
| `pie` | Part-to-whole, ≤6 segments | Filled circle divided into wedges | pptxgenjs OR ECharts |
| `donut` | Part-to-whole with center metric | Ring with empty center | pptxgenjs OR ECharts |
| `half_donut` | Gauge-style progress | Semi-circle arc | **ECharts ONLY** |
| `sunburst` | Hierarchical part-to-whole | Nested concentric rings | **ECharts ONLY** |

### Scatter Family (4 types)

| Type | Use When | Key Visual Feature | Implementation |
|------|----------|-------------------|----------------|
| `scatter` | Correlation between 2 variables | Unconnected points on X-Y grid | pptxgenjs OR ECharts |
| `bubble` | 3-variable comparison (X, Y, size) | Varying-sized circles | pptxgenjs OR ECharts |
| `quadrant` | Strategic positioning (2x2 matrix) | Grid divided into 4 zones | **ECharts ONLY** |
| `connected_scatter` | Path through X-Y space over time | Points connected in sequence | **ECharts ONLY** |

### Specialized (8 types)

| Type | Use When | Key Visual Feature | Implementation |
|------|----------|-------------------|----------------|
| `heatmap` | Matrix data, intensity visualization | Color-coded grid cells | **ECharts ONLY** |
| `treemap` | Hierarchical part-to-whole | Nested rectangles by size | **ECharts ONLY** |
| `funnel` | Conversion/filtering process | Progressively narrower sections | **ECharts ONLY** |
| `gauge` | Single value vs scale | Dial/meter display | **ECharts ONLY** |
| `sankey` | Flow quantities between stages | Curved bands showing flow | **ECharts ONLY** |
| `marimekko` | Part-to-whole with varying totals | Variable-width stacked bars | **ECharts ONLY** |
| `box_plot` | Statistical distribution | Box with whiskers showing quartiles | **ECharts ONLY** |
| `sparkline` | Inline trend indicator | Minimal line chart without axes | **ECharts ONLY** |

### Combo (4 types)

| Type | Use When | Key Visual Feature | Implementation |
|------|----------|-------------------|----------------|
| `combo_bar_line` | Bars + trend line | Bars with overlaid line | pptxgenjs OR ECharts |
| `pareto` | 80/20 analysis | Sorted bars + cumulative line | **ECharts ONLY** |
| `dual_axis` | Two different scales | Left and right Y-axes | pptxgenjs OR ECharts |
| `benchmark_bar` | Actual vs target | Bar with marker line | **ECharts ONLY** |

---

## Decision Tree: Selecting the Right Chart

### Level 0: What's the Primary Purpose?

```
What is the main communication goal?
│
├─► COMPARE values → Go to Bar Family
├─► Show TREND over time → Go to Line Family
├─► Show PARTS of a whole → Go to Circular/Stacked
├─► Show RELATIONSHIP/correlation → Go to Scatter Family
├─► Show DISTRIBUTION → Histogram or Box Plot
├─► Show FLOW/process → Funnel, Sankey, Waterfall
└─► Show PERFORMANCE vs target → Bullet, Gauge
```

### Level 1: Family Selection

**BAR FAMILY indicators:**
- Discrete categories on one axis
- Comparing magnitudes
- Showing ranking
- Rectangular shapes aligned to baseline

**LINE FAMILY indicators:**
- Continuous X-axis (usually time)
- Connected data points
- Trend/change emphasis
- May have filled area below

**CIRCULAR FAMILY indicators:**
- Part-to-whole relationship
- Limited categories (≤6 recommended)
- Percentage breakdown
- Arc or wedge shapes

**SCATTER FAMILY indicators:**
- Two quantitative variables
- Looking for correlation/pattern
- No inherent ordering
- Individual data points matter

### Level 2: Primary Discriminators

#### Within Bar Family

```
Where does each bar START?
│
├─► All start at 0 (baseline)
│   └─► Are there multiple bars per category?
│       ├─► No → vertical_bar or horizontal_bar
│       └─► Yes, side by side → grouped_bar
│
├─► Start where previous bar ends (stacked)
│   └─► All columns same height?
│       ├─► No → stacked_bar
│       └─► Yes (100%) → 100%_stacked_bar
│
├─► Start at center, grow both directions
│   └─► diverging_bar (or tornado if horizontal)
│
└─► Float at varying heights
    └─► waterfall
```

```
Do the bars touch (no gaps)?
├─► Yes → histogram (continuous data)
└─► No → bar chart (categorical data)
```

#### Within Line Family

```
Is the area below the line filled?
│
├─► No → line or multi_line
│   └─► How many lines?
│       ├─► One → line
│       └─► Multiple → multi_line
│
└─► Yes → area chart family
    └─► Are areas stacked?
        ├─► No → area
        ├─► Yes, variable total → stacked_area
        └─► Yes, always 100% → 100%_stacked_area
```

#### Within Circular Family

```
Is the center empty or filled?
│
├─► Filled (wedges meet at center) → pie
├─► Empty (ring shape) → donut
└─► Only half circle → half_donut
```

#### Within Scatter Family

```
Are the points different sizes?
│
├─► No, same size → scatter
└─► Yes, varying sizes → bubble
```

```
Is there a 2x2 grid overlay?
├─► Yes → quadrant
└─► No → scatter or bubble
```

### Level 3: Secondary Tests

**For bar charts:**
- More than 7 categories? → Consider horizontal_bar
- Showing ranking? → Sort bars by value
- Negative values? → diverging_bar or waterfall
- Part-to-whole? → stacked_bar or 100%_stacked

**For line charts:**
- Emphasizing magnitude? → area chart
- Multiple series? → multi_line (use distinct colors)
- Cumulative total? → stacked_area

**For circular charts:**
- More than 6 segments? → Use bar chart instead
- Need center metric? → donut
- Progress/completion? → half_donut or gauge

---

## Visual Discriminator Questions

Use these questions to identify chart type from visual inspection:

### 1. "Where does each bar START?"

| Starting Position | Chart Type |
|------------------|------------|
| All at 0 (bottom/left) | vertical_bar, horizontal_bar, grouped_bar |
| Where previous ends | stacked_bar, 100%_stacked_bar |
| At center line | diverging_bar, tornado |
| Floating (varies) | waterfall |
| At time position | gantt |

### 2. "Is the area below the line filled?"

| Fill Status | Chart Type |
|-------------|------------|
| No fill | line, multi_line |
| Solid fill | area |
| Stacked fills | stacked_area, 100%_stacked_area |

### 3. "Is the center empty or filled?"

| Center | Chart Type |
|--------|------------|
| Filled (wedges meet) | pie |
| Empty (ring) | donut |
| Half ring | half_donut |
| Nested rings | sunburst |

### 4. "Are bars grouped or touching?"

| Spacing | Chart Type |
|---------|------------|
| Gaps between all bars | bar (categorical) |
| Multiple bars per group with internal gaps | grouped_bar |
| Bars touch (no gaps) | histogram (continuous) |

### 5. "Are data points connected?"

| Connection | Chart Type |
|------------|------------|
| Connected in sequence | line, area |
| Not connected | scatter, bubble |
| Connected by time order | connected_scatter |

### 6. "Do bars float (not anchored to baseline)?"

| Anchoring | Chart Type |
|-----------|------------|
| All anchored to baseline | standard bar charts |
| Floating intermediates, anchored endpoints | waterfall |
| Positioned by time | gantt |

---

## Common Chart Selection Mistakes

### Mistake 1: Using pie for >6 categories
**Problem:** Hard to compare small wedges
**Solution:** Use horizontal_bar (sorted) instead

### Mistake 2: Using line for categorical data
**Problem:** Implies continuity between discrete categories
**Solution:** Use bar chart for categorical X-axis

### Mistake 3: Using 3D charts
**Problem:** Distorts perception of values
**Solution:** Always use 2D charts

### Mistake 4: Using dual Y-axis when scales are incompatible
**Problem:** Can mislead by implying correlation
**Solution:** Use separate charts or normalize data

### Mistake 5: Using stacked bar when order matters
**Problem:** Hard to compare non-baseline segments
**Solution:** Use grouped_bar or small multiples

### Mistake 6: Using area chart for small datasets
**Problem:** Over-emphasizes small variations
**Solution:** Use line chart for <10 data points

---

## Chart Type by Data Scenario

### Comparing values across categories
- **Few categories (<7):** vertical_bar
- **Many categories (>7):** horizontal_bar (sorted)
- **Sub-categories:** grouped_bar
- **Part-to-whole:** stacked_bar

### Showing change over time
- **Single trend:** line
- **Multiple trends:** multi_line
- **Emphasize volume:** area
- **Cumulative:** stacked_area

### Part-to-whole relationships
- **Simple (≤6 parts):** pie or donut
- **Over categories:** stacked_bar or 100%_stacked_bar
- **Hierarchical:** treemap or sunburst
- **With varying totals:** marimekko

### Showing correlations
- **Two variables:** scatter
- **Three variables:** bubble (size = 3rd variable)
- **Strategic positioning:** quadrant (2x2 matrix)

### Showing distributions
- **Frequency:** histogram
- **Statistics:** box_plot
- **Comparison:** overlapped histograms

### Showing flow/process
- **Conversion funnel:** funnel
- **Cumulative bridge:** waterfall
- **Flow between stages:** sankey

### Performance metrics
- **Actual vs target:** bullet
- **Single metric:** gauge
- **Multiple metrics grid:** heatmap

---

## McKinsey-Style Chart Formatting

### Color Palette
```
Primary:    #1E3A5F (Navy)
Secondary:  #2E75B6 (Dark Blue)
            #5B9BD5 (Medium Blue)
            #A8C8E8 (Light Blue)
            #D6E6F4 (Pale Blue)

Accent:     #4CAF50 (Green - positive)
            #2E7D32 (Dark Green)
            #EF5350 (Red - negative)
            #C62828 (Dark Red)

Neutral:    #666666 (Dark Gray - text)
            #D0D0D0 (Medium Gray - gridlines)
            #F5F3EF (Light Gray - background)
```

### Typography
| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Chart title | 14-16px | Bold | Navy |
| Subtitle/source | 10-11px | Normal | Gray |
| Value labels | 12-14px | Bold | Navy |
| Axis labels | 10-12px | Normal | Navy |
| Footnotes | 9px | Normal | Gray |

### Baseline Rule
**CRITICAL:** All bar charts MUST have a visible baseline:
- Position: y=0
- Weight: 2px
- Color: Navy (#1E3A5F)

### Scaling Formula
```
barHeight = (value / maxValue) * availableHeight
```

For bar charts with all-positive values, max scale should be ~110% of highest value to provide headroom.

---

## ECharts Type Mapping

When using `data-echarts`, map your chart type to ECharts series type:

| Chart Type | ECharts `series.type` |
|------------|----------------------|
| vertical_bar | `bar` |
| horizontal_bar | `bar` + `xAxis`/`yAxis` swap |
| stacked_bar | `bar` + `stack: 'total'` |
| line | `line` |
| area | `line` + `areaStyle: {}` |
| pie | `pie` |
| donut | `pie` + `radius: ['40%', '70%']` |
| scatter | `scatter` |
| bubble | `scatter` + `symbolSize` function |
| heatmap | `heatmap` |
| funnel | `funnel` |
| gauge | `gauge` |
| treemap | `treemap` |
| sankey | `sankey` |

---

## Quick Decision Flowchart

```
START: What's your data about?
│
├─► Comparing categories
│   ├─► Few categories → vertical_bar
│   ├─► Many categories → horizontal_bar
│   ├─► Sub-categories → grouped_bar
│   └─► Part-to-whole → stacked_bar
│
├─► Trend over time
│   ├─► Single series → line
│   ├─► Multiple series → multi_line
│   └─► Emphasize volume → area
│
├─► Parts of a whole
│   ├─► ≤6 parts → pie or donut
│   ├─► Hierarchy → treemap
│   └─► Over categories → stacked_bar
│
├─► Correlation
│   ├─► 2 variables → scatter
│   ├─► 3 variables → bubble
│   └─► Strategic matrix → quadrant
│
├─► Distribution
│   ├─► Frequency → histogram
│   └─► Statistics → box_plot
│
└─► Process/Flow
    ├─► Conversion → funnel
    ├─► Bridge → waterfall
    └─► Multi-path → sankey
```

---

*Reference: This guide is based on the 45+ chart types supported by the pptx skill's data visualization capabilities.*
