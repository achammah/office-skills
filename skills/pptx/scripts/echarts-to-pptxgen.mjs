/**
 * ECharts → PptxGenJS Native Chart Translator
 *
 * Converts ECharts configuration objects into PptxGenJS addChart() parameters,
 * enabling native, editable charts in PowerPoint instead of rasterized images.
 *
 * For unsupported chart types/patterns, returns null so the existing
 * SVG→PNG rasterization pipeline runs unchanged.
 *
 * Supports: bar (vertical/horizontal/stacked), line, area, pie, donut,
 * scatter, bubble, combo (bar+line), radar
 */

import {
    loadBranding,
    getBranding,
    getColor,
    getFont,
    getFontSize,
    getChartColors,
} from '../branding/branding.mjs';

import {
    getMcKinseyDefaults,
    deepMerge,
    applyAxisArrayDefaults,
    applyDefaultLabels,
    applyColorSequence,
    applyBrandingNumberFormat,
    enforceMinimumFontSizes,
    isHorizontalChart,
    isComboChart,
    isPlaceholderOrOutlineSeries,
    gridUsesPixelValues,
    resolveAllCssVariables,
} from './chart-style-pipeline.mjs';

// ═══════════════════════════════════════════════════════════════════════════════
// SMART MULTILINE LABEL UTILITY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Estimate text width in points for a given string and font size.
 * Uses average character width ratio for proportional fonts (Arial/Helvetica).
 * @param {string} text - The text to measure
 * @param {number} fontSizePt - Font size in points
 * @param {boolean} [bold=false] - Whether bold
 * @returns {number} Estimated width in points
 */
function estimateTextWidthPt(text, fontSizePt, bold = false) {
    // Average char width ≈ 0.55× font size for proportional fonts (Arial)
    // Digits and punctuation are narrower (~0.5×), uppercase wider (~0.65×)
    const AVG_CHAR_WIDTH = 0.55;
    const width = text.length * fontSizePt * AVG_CHAR_WIDTH;
    return bold ? width * 1.05 : width;
}

/**
 * Estimate the available width (in pt) for a data label inside or above a bar.
 * Uses chart config (numCategories, barWidth%) and container dims.
 * @param {object} config - ECharts config
 * @param {object} [dims] - { width, height } in px of the chart container
 * @param {string} [position='inside'] - Label position ('inside'→bar width, 'top'→slot width)
 * @returns {number} Available width in points (72pt = 1 inch)
 */
function estimateLabelAvailableWidthPt(config, dims, position = 'inside') {
    const xAxis = Array.isArray(config.xAxis) ? config.xAxis[0] : config.xAxis;
    const yAxis = Array.isArray(config.yAxis) ? config.yAxis[0] : config.yAxis;
    // For horizontal bars, categories are on yAxis
    const catAxis = (yAxis?.type === 'category') ? yAxis : xAxis;
    const numCats = catAxis?.data?.length || 1;

    // Find barWidth percentage (default 60%)
    let barWidthPct = 60;
    for (const s of config.series || []) {
        if (s.type === 'bar' && s.barWidth) {
            barWidthPct = parseFloat(String(s.barWidth));
            break;
        }
    }

    // Estimate plot width in px from grid + container dims
    const grid = Array.isArray(config.grid) ? config.grid[0] : (config.grid || {});
    const containerW = dims?.width || 576; // default ~6 inches
    const parseGridVal = (v) => {
        if (v === undefined || v === null) return 0;
        if (typeof v === 'number') return v;
        const s = String(v);
        if (s.includes('%')) return (parseFloat(s) / 100) * containerW;
        return parseFloat(s) || 0;
    };
    const gridLeft = parseGridVal(grid.left) || 40;
    const gridRight = parseGridVal(grid.right) || 40;
    const plotWidthPx = containerW - gridLeft - gridRight;

    const slotWidthPx = plotWidthPx / numCats;
    const barWidthPx = slotWidthPx * (barWidthPct / 100);

    // Convert to points (1px ≈ 0.75pt)
    const PT_PER_PX = 0.75;
    const relevantWidthPx = (position === 'inside' || position === 'ctr') ? barWidthPx : slotWidthPx;
    return relevantWidthPx * PT_PER_PX;
}

/**
 * Smart multiline label text: join all \n-split parts, then only re-break
 * if the resulting single line is too wide for the available space.
 * Original \n positions are treated as "suggested break points."
 *
 * @param {string} rawText - Original text (may contain \n)
 * @param {number} fontSizePt - Font size in points
 * @param {number} availableWidthPt - Available width in points
 * @param {boolean} [bold=false] - Whether bold
 * @returns {string} Text with \n only where needed for width
 */
function smartLabelText(rawText, fontSizePt, availableWidthPt, bold = false) {
    if (!rawText || !rawText.includes('\n')) return rawText || '';

    // Join lines: dash-newline → dash (keeps "20-\n25" → "20-25"),
    // other newlines → space (keeps "17\n3" → "17 3", not "173")
    const flat = rawText.replace(/-\n/g, '-').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    const flatWidth = estimateTextWidthPt(flat, fontSizePt, bold);

    // If single line fits → use single line
    if (flatWidth <= availableWidthPt) return flat;

    // Doesn't fit → restore original line breaks
    return rawText;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if an ECharts config can be translated to a native PptxGenJS chart.
 * @param {object} echartsConfig - Raw ECharts config (CSS vars intact)
 * @returns {{ supported: boolean, reason?: string }}
 */
export function canTranslate(echartsConfig) {
    if (!echartsConfig || !echartsConfig.series || !Array.isArray(echartsConfig.series)) {
        return { supported: false, reason: 'No series array' };
    }
    if (echartsConfig.series.length === 0) {
        return { supported: false, reason: 'Empty series array' };
    }

    const series = echartsConfig.series;
    const types = new Set(series.map(s => s.type).filter(Boolean));

    // ── Global unsupported patterns ──────────────────────────────────

    // Annotations (markLine, markPoint, markArea, graphic) are ALLOWED —
    // they are extracted from SVG and overlaid as text boxes by html2pptx.mjs.
    // Visual annotation elements (lines, shaded areas) are lost but the chart
    // itself becomes editable. hasChartAnnotations() flags them for overlay.

    // Mixed scatter + line/bar → allow only when all line series are simple trend lines
    if (types.has('scatter') && (types.has('line') || types.has('bar'))) {
        const lineSeries = series.filter(s => s.type === 'line');
        const allTrendLines = lineSeries.every(s =>
            s.showSymbol === false && !s.areaStyle && !s.stack
        );
        if (!allTrendLines) {
            return { supported: false, reason: 'Mixed scatter + line/bar (complex line series)' };
        }
    }

    // Unsupported chart types
    for (const s of series) {
        const type = s.type;
        if (type && !['bar', 'line', 'pie', 'scatter', 'radar'].includes(type)) {
            return { supported: false, reason: `Unsupported series type: ${type}` };
        }
    }

    // ── Per-series unsupported patterns ──────────────────────────────

    for (const s of series) {
        // Transparent placeholder series (total labels) are ALLOWED —
        // they are filtered out by isPlaceholderOrOutlineSeries() during data extraction,
        // and their labels are rendered in the annotation overlay PNG.

        // Dashed border bars: only reject series-level dashed on pure decoration (no data)
        // Per-item dashed borders are handled via <c:dPt> OOXML injection
        if (s.itemStyle?.borderType === 'dashed' && !(Array.isArray(s.data) && s.data.length > 0)) {
            return { supported: false, reason: 'Dashed border series (outline-only, no data)' };
        }

        // Gap values ("-" and "") are now mapped to null in extractValues() — no longer rejected

        // $callouts directive — stripped before native translation (rendered as overlay text boxes)

        // Per-item label formatters — only reject complex ones (newlines, rich text, functions)
        // Simple static strings ("92", "$761 (30%)", "2,904") are OK — PptxGenJS shows raw values
        if (Array.isArray(s.data)) {
            for (const d of s.data) {
                if (d && typeof d === 'object' && d.label?.formatter) {
                    const f = d.label.formatter;
                    if (typeof f === 'function') {
                        return { supported: false, reason: 'Per-item function formatter present' };
                    }
                    if (typeof f === 'string' && (f.includes('{a|') || f.includes('{b|') || f.includes('{rich'))) {
                        return { supported: false, reason: 'Per-item rich text formatter present' };
                    }
                }
            }
        }

        // Series-level complex formatter (not just {c} or {b} or {d}%)
        if (s.label?.formatter && typeof s.label.formatter === 'string') {
            const f = s.label.formatter;
            // Catch newlines (actual \n char), rich text tags, or non-standard placeholders
            if (f.includes('{a|') || f.includes('{b|') || f.includes('{rich')) {
                return { supported: false, reason: 'Complex series label formatter (rich text)' };
            }
        }
    }

    // Per-item colors/positions are now handled via <c:dPt> OOXML injection
    // and per-point <c:dLbl> with <c:dLblPos>. No longer a rejection reason.

    // ── Line chart specific checks ─────────────────────────────────────

    // Mixed line dash styles are supported via combo chart API (per-entry lineDash)
    // — handled in buildLineChart()

    // ── Pie/donut specific checks ────────────────────────────────────

    if (types.has('pie')) {
        const pieSeries = series.filter(s => s.type === 'pie');
        // Multiple pie series (nested pies) → raster
        if (pieSeries.length > 1) {
            return { supported: false, reason: 'Multiple pie series (nested)' };
        }
        // Per-item label formatters on pie — only reject complex ones
        const pie = pieSeries[0];
        if (pie?.data) {
            for (const d of pie.data) {
                if (d?.label?.formatter) {
                    const f = d.label.formatter;
                    if (typeof f === 'function') {
                        return { supported: false, reason: 'Pie with function formatter' };
                    }
                    if (typeof f === 'string' && (f.includes('{a|') || f.includes('{rich'))) {
                        return { supported: false, reason: 'Pie with rich text formatter' };
                    }
                }
            }
        }
    }

    return { supported: true };
}

/**
 * Translate an ECharts config into PptxGenJS addChart() parameters.
 * Returns null if the chart cannot be natively translated.
 *
 * @param {object} echartsConfig - Raw ECharts config (CSS vars intact)
 * @param {object} pres - PptxGenJS presentation instance (for pres.charts.* constants)
 * @param {object} [dims] - Optional { width, height } in pixels for grid→layout mapping
 * @returns {{ chartType, data, options, hasAnnotations } | null}
 */
export function translateChart(echartsConfig, pres, dims) {
    if (!pres || !pres.charts) {
        console.error('[native-chart] ERROR: pres.charts not available');
        return null;
    }

    // Deep copy to avoid mutating the original
    const config = JSON.parse(JSON.stringify(echartsConfig));

    // Strip $callouts for native translation — will be rendered as overlay text boxes
    const savedCallouts = [];
    for (const s of config.series || []) {
      if (s.$callouts) {
        savedCallouts.push({ seriesIdx: config.series.indexOf(s), callouts: s.$callouts });
        delete s.$callouts;
      }
    }

    // Run McKinsey style pipeline (steps 1-5, 8, 9)
    applyMcKinseyStyleForNative(config);

    // Check translatability after style pipeline (colors resolved, labels added)
    const check = canTranslate(config);
    if (!check.supported) {
        console.log(`  [native-chart] Fallback: ${check.reason}`);
        return null;
    }

    // Detect chart type
    const detection = detectChartType(config);
    if (!detection) {
        console.log('  [native-chart] Fallback: could not detect chart type');
        return null;
    }

    // Check for annotations (markLine, markPoint, markArea, graphic)
    const hasAnnotations = hasChartAnnotations(config);

    // Extract data and options based on chart type
    let result;
    try {
        if (detection.combo && detection.type === 'scatter-line-combo') {
            result = buildScatterLineCombo(config, pres);
        } else if (detection.combo) {
            result = buildComboChart(config, pres, detection, dims);
        } else {
            switch (detection.type) {
                case 'bar':
                    result = buildBarChart(config, pres, detection, dims);
                    break;
                case 'line':
                    result = buildLineChart(config, pres, detection);
                    break;
                case 'area':
                    result = buildAreaChart(config, pres, detection);
                    break;
                case 'pie':
                    result = buildPieChart(config, pres, detection);
                    break;
                case 'doughnut':
                    result = buildDoughnutChart(config, pres, detection);
                    break;
                case 'scatter':
                    result = buildScatterChart(config, pres, detection);
                    break;
                case 'bubble':
                    result = buildBubbleChart(config, pres, detection);
                    break;
                case 'radar':
                    result = buildRadarChart(config, pres, detection);
                    break;
                default:
                    console.log(`  [native-chart] Fallback: unsupported type "${detection.type}"`);
                    return null;
            }
        }
    } catch (e) {
        console.error(`  [native-chart] Translation error: ${e.message}`);
        return null;
    }

    if (!result) return null;

    // Apply grid → PptxGenJS layout mapping (plot area position)
    if (dims?.width && dims?.height) {
        const layoutOpts = extractLayout(config, dims.width, dims.height, detection);
        if (layoutOpts.layout) {
            // For charts with BOTH axis labels hidden (e.g., scatter quadrant plots),
            // PptxGenJS doesn't reserve space for labels, so the marginScale correction
            // in extractLayout overcorrects. Use the original unscaled layout instead.
            const bothLabelsHidden = result.hideXAxisLabels && result.hideYAxisLabels;
            if (bothLabelsHidden && layoutOpts.originalLayout) {
                result.options.layout = layoutOpts.originalLayout;
                result.skipMarginScale = true;
            } else {
                result.options.layout = layoutOpts.layout;
            }
        }
        if (layoutOpts.originalLayout) {
            result.originalLayout = layoutOpts.originalLayout;
        }
    }

    // Mark as having annotations if $callouts were stripped (need overlay text boxes)
    const hasCallouts = savedCallouts.length > 0;

    return {
        ...result,
        barDir: result.options?.barDir,
        hasAnnotations: hasAnnotations || hasCallouts,
        rawCategoryLabels: extractRawCategoryLabels(config),
        axisLabelStyle: extractAxisLabelStyle(config),
        nativeLabels: result.phantomTotalIdx != null
            ? extractStackedBarLabels(config, result.options.chartColors, result.phantomTotalIdx, result.phantomTotalTexts)
            : (result.noFillSeriesIndices?.length > 0 && !result.waterfallMeta)
                ? []
                : (result.waterfallMeta)
                    ? []
                    : extractAllLabels(config, dims),
        perPointStyles: extractPerPointStyles(config),
        dashedSeriesIndices: result.dashedSeriesIndices || [],
        savedCallouts: hasCallouts ? savedCallouts : null,
        waterfallMeta: result.waterfallMeta || null,
    };
}

/**
 * Strip '#' prefix from hex color for PptxGenJS.
 * @param {string} hex - Color like "#1E3A5F" or "1E3A5F"
 * @returns {string} - Color without '#'
 */
const NAMED_COLORS = {
    white: 'FFFFFF', black: '000000', red: 'FF0000', green: '008000', blue: '0000FF',
    yellow: 'FFFF00', orange: 'FFA500', gray: '808080', grey: '808080',
    transparent: 'FFFFFF', navy: '000080', silver: 'C0C0C0',
};
export function toPptxColor(hex) {
    if (!hex || typeof hex !== 'string') return '333333';
    const named = NAMED_COLORS[hex.toLowerCase()];
    if (named) return named;
    return hex.replace(/^#/, '');
}

/**
 * Resolve any ECharts color (string, gradient object) to a PptxGenJS hex.
 * Gradients → uses the last colorStop as representative solid color.
 */
function resolveColorToHex(color) {
    if (!color) return null;
    if (typeof color === 'string') return toPptxColor(color);
    // Gradient object — use last colorStop
    if (color.colorStops && Array.isArray(color.colorStops) && color.colorStops.length > 0) {
        return toPptxColor(color.colorStops[color.colorStops.length - 1].color);
    }
    return null;
}

/**
 * Choose white or dark label color based on background luminance (WCAG).
 * Returns PptxGenJS color (no '#' prefix).
 * @param {string} bgHex - Background color like "#1E3A5F" or "1E3A5F"
 * @returns {string} - 'FFFFFF' for dark backgrounds, '333333' for light
 */
function contrastLabelColor(bgHex) {
    const hex = String(bgHex || '333333').replace(/^#/, '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    const lum = 0.2126 * (r <= 0.03928 ? r / 12.92 : ((r + 0.055) / 1.055) ** 2.4)
              + 0.7152 * (g <= 0.03928 ? g / 12.92 : ((g + 0.055) / 1.055) ** 2.4)
              + 0.0722 * (b <= 0.03928 ? b / 12.92 : ((b + 0.055) / 1.055) ** 2.4);
    return lum < 0.4 ? 'FFFFFF' : '333333';
}

/**
 * Calculate a non-zero phantom segment value that provides visual separation
 * between the topmost segment label and the total label above the stack.
 * ~15% of tallest stack height per 7.5pt of font size.
 */
function computePhantomPadding(config, data, fontSize) {
    const numCats = data[0]?.values?.length || 0;
    let maxStack = 0;
    for (let cat = 0; cat < numCats; cat++) {
        let stack = 0;
        for (const s of data) stack += (s.values[cat] || 0);
        if (stack > maxStack) maxStack = stack;
    }
    // Get the effective value axis range for the floor calculation
    const yAxis = Array.isArray(config.yAxis) ? config.yAxis[0] : config.yAxis;
    const xAxis = Array.isArray(config.xAxis) ? config.xAxis[0] : config.xAxis;
    const valAxis = (yAxis?.type === 'value' || (!yAxis?.type && xAxis?.type === 'category')) ? yAxis : xAxis;
    const valMax = valAxis?.max || Math.ceil(maxStack * 1.15);
    const valRange = valMax - (valAxis?.min || 0);
    // Phantom bar must be tall enough to contain the total label text.
    // Labels default to 'ctr' positioning (centered in phantom segment),
    // so phantom must be ~2× label height for text to clear the bar top.
    // Floor: 18% of value range ensures comfortable label margin.
    const fontFactor = (fontSize || 7.5) / 7.5;
    const floorPadding = Math.ceil(valRange * 0.18 * fontFactor);
    const scaledPadding = Math.ceil(maxStack * 0.10 * fontFactor);
    return Math.max(floorPadding, scaledPadding, 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MCKINSEY STYLE PIPELINE FOR NATIVE CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Apply the relevant McKinsey style steps for native chart translation.
 * Steps replicated: 1 (defaults), 2 (merge), 3 (axis arrays), 4 (auto-labels),
 * 5 (colors), 8 (number format), 9 (font minimums).
 * Skipped: 6 (callouts), 7 (annotations), 10 (grid margins), 11 (label alignment),
 * 12 (axis breaks), 13 (layout callbacks).
 */
function applyMcKinseyStyleForNative(config) {
    // Ensure branding is loaded
    try { loadBranding(process.env.PPTX_BRAND || 'mckinsey'); } catch { /* already loaded */ }

    const defaults = getMcKinseyDefaults(config);

    // FIX 2: pixel grid → don't force containLabel
    if (config.grid && gridUsesPixelValues(config.grid)) {
        if (config.grid.containLabel === undefined) {
            defaults.grid.containLabel = false;
        }
    }

    // Step 2: Deep merge defaults with agent config
    const merged = deepMerge(defaults, config);
    Object.assign(config, merged);

    // Step 3: Axis array defaults
    applyAxisArrayDefaults(config);

    // Step 4: Auto-add data labels
    applyDefaultLabels(config);

    // Step 5: Color sequence + CSS variable resolution
    applyColorSequence(config);

    // Step 8: Number format
    applyBrandingNumberFormat(config);

    // Step 9: Font minimums — SKIPPED for native charts.
    // enforceMinimumFontSizes() bumps axis labels below 10pt up to 10pt, which is
    // needed for raster SVG screenshots but counterproductive for native PowerPoint
    // charts where text is vector and perfectly readable at 9pt or smaller.  Larger
    // font + many labels → PowerPoint auto-rotates and truncates with "...".
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHART TYPE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detect chart type from ECharts config.
 * @returns {{ type, orientation?, stacking?, combo? } | null}
 */
function detectChartType(config) {
    const series = config.series;
    if (!series || series.length === 0) return null;

    const types = new Set(series.map(s => s.type).filter(Boolean));

    // Combo chart: has both bar and line
    if (types.has('bar') && types.has('line')) {
        return {
            type: 'combo',
            combo: true,
            orientation: isHorizontalChart(config) ? 'horizontal' : 'vertical',
            stacking: series.some(s => s.stack) ? 'stacked' : 'clustered',
        };
    }

    // Radar
    if (types.has('radar')) {
        return { type: 'radar' };
    }

    // Pie / Doughnut
    if (types.has('pie')) {
        const pieSeries = series.find(s => s.type === 'pie');
        const radius = pieSeries?.radius;
        if (Array.isArray(radius) && radius.length === 2) {
            const inner = parseFloat(String(radius[0]));
            if (inner > 0) {
                return { type: 'doughnut', holeSize: inner };
            }
        }
        return { type: 'pie' };
    }

    // Scatter + line trend combo
    if (types.has('scatter') && types.has('line')) {
        return { type: 'scatter-line-combo', combo: true };
    }

    // Scatter / Bubble
    if (types.has('scatter')) {
        // Bubble if data has 3 elements, or per-point symbolSize on object data
        const scatterSeries = series.find(s => s.type === 'scatter');
        const hasSizes = scatterSeries?.data?.some(d =>
            (Array.isArray(d) && d.length >= 3) ||
            (d && typeof d === 'object' && !Array.isArray(d) && d.symbolSize !== undefined)
        );
        if (hasSizes) {
            return { type: 'bubble' };
        }
        return { type: 'scatter' };
    }

    // Line / Area
    if (types.has('line')) {
        const hasArea = series.some(s => s.type === 'line' && s.areaStyle && !isAreaMaskSeries(s));
        if (hasArea) {
            return {
                type: 'area',
                stacking: series.some(s => s.stack) ? 'stacked' : null,
            };
        }
        return { type: 'line' };
    }

    // Bar
    if (types.has('bar')) {
        return {
            type: 'bar',
            orientation: isHorizontalChart(config) ? 'horizontal' : 'vertical',
            stacking: series.some(s => s.stack) ? 'stacked' : 'clustered',
        };
    }

    return null;
}

/**
 * Check if config has annotations that need an overlay layer.
 * Detects: markLine, markPoint, markArea, graphic overlays,
 * and transparent placeholder series with visible labels (total labels above stacked bars).
 */
function hasChartAnnotations(config) {
    if (config.graphic) return true;
    for (const s of config.series || []) {
        if (s.markLine || s.markPoint || s.markArea) return true;
    }
    // Mixed label styles across series are now handled natively via per-point
    // OOXML <c:dLbl> injection (extractAllLabels + patchChartLabels).
    // No longer need annotation overlay just for label styling.
    return false;
}

/**
 * Check if a series has visible data labels (series-level or per-item).
 */
function hasVisibleLabels(series) {
    if (series.label?.show === true) return true;
    if (Array.isArray(series.data)) {
        for (const d of series.data) {
            if (d && typeof d === 'object' && d.label?.show === true) return true;
        }
    }
    return false;
}

/**
 * Detect area-mask series: line series used only for area fill bands (shaded regions).
 * These have areaStyle but invisible/zero-width lines — the line is purely structural,
 * only the shaded area between upper/lower bound matters.
 * These are rendered in annotation overlay PNG, not as native chart series.
 */
function isAreaMaskSeries(s) {
    if (!s.areaStyle) return false;
    // Stacked area series with hidden borders are NOT masks — they're real data bands
    if (s.stack) return false;
    if (s.lineStyle?.width === 0 || s.lineStyle?.opacity === 0) return true;
    if (s.areaStyle?.color === 'white' || s.areaStyle?.color === '#FFFFFF' || s.areaStyle?.color === '#ffffff') return true;
    return false;
}

/**
 * Detect per-item static formatters that can't be rendered natively.
 * Static string formatters like "92" or "$761" replace the raw value —
 * PptxGenJS can only show the actual numeric value, not arbitrary text.
 */
function hasPerItemStaticFormatters(config) {
    for (const s of config.series || []) {
        if (isPlaceholderOrOutlineSeries(s)) continue;
        if (Array.isArray(s.data)) {
            for (const d of s.data) {
                if (d && typeof d === 'object' && d.label?.formatter && typeof d.label.formatter === 'string') {
                    // Static string formatter like "92" or "$761" — not a template like "{c}"
                    if (!d.label.formatter.includes('{')) return true;
                }
            }
        }
    }
    return false;
}

/**
 * Extract formatter totals from the series with per-item static formatters.
 * Returns an array of text strings (one per category), or null if none found.
 */
function collectFormatterTotals(config, dims) {
    const availW = estimateLabelAvailableWidthPt(config, dims, 'top');
    for (const s of config.series || []) {
        if (s.type !== 'bar' || isPlaceholderOrOutlineSeries(s)) continue;
        if (!Array.isArray(s.data)) continue;
        const texts = s.data.map(d => {
            if (d && typeof d === 'object' && d.label?.formatter && typeof d.label.formatter === 'string') {
                const fontSize = d.label.fontSize || s.label?.fontSize || 10;
                const bold = (d.label.fontWeight || s.label?.fontWeight || '') === 'bold';
                return smartLabelText(d.label.formatter, fontSize, availW, bold);
            }
            return '';
        });
        if (texts.some(t => t !== '')) return texts;
    }
    return null;
}

/**
 * Detect mixed label styles across visible series.
 * PptxGenJS data labels are chart-level (one fontSize, color, position for all series).
 * When series have different label styles, delegate to annotation overlay for fidelity.
 */
function detectMixedLabelStyles(config) {
    const labelProps = [];
    for (const s of config.series || []) {
        if (isPlaceholderOrOutlineSeries(s)) continue;
        if (s.label?.show === true) {
            labelProps.push({
                fontSize: s.label.fontSize,
                color: s.label.color,
                position: s.label.position,
            });
        }
    }
    if (labelProps.length <= 1) return false;
    return (
        new Set(labelProps.map(l => l.fontSize)).size > 1 ||
        new Set(labelProps.map(l => l.color)).size > 1 ||
        new Set(labelProps.map(l => l.position)).size > 1
    );
}

/**
 * Create an ECharts config that renders ONLY annotations (no data visualization).
 * Used to produce a transparent PNG overlay for native charts.
 *
 * Keeps: markLine, markPoint, markArea, graphic, transparent series labels
 * Hides: all visible data bars/lines/areas, axes, gridlines, legend
 */
export function createAnnotationOverlayConfig(echartsConfig) {
    const config = JSON.parse(JSON.stringify(echartsConfig));

    // Hide all axes
    const hideAxis = (axis) => {
        if (!axis) return;
        const axes = Array.isArray(axis) ? axis : [axis];
        for (const ax of axes) {
            ax.axisLabel = { ...ax.axisLabel, show: false };
            ax.axisLine = { ...ax.axisLine, show: false };
            ax.axisTick = { ...ax.axisTick, show: false };
            ax.splitLine = { ...ax.splitLine, show: false };
            ax.axisPointer = { show: false };
        }
        return axes.length === 1 ? axes[0] : axes;
    };
    if (config.xAxis) config.xAxis = hideAxis(config.xAxis);
    if (config.yAxis) config.yAxis = hideAxis(config.yAxis);

    // Hide legend
    if (config.legend) {
        if (Array.isArray(config.legend)) {
            config.legend.forEach(l => l.show = false);
        } else {
            config.legend.show = false;
        }
    }

    // Hide tooltip
    config.tooltip = { show: false };

    // Hide title
    if (config.title) {
        if (Array.isArray(config.title)) {
            config.title.forEach(t => t.show = false);
        } else {
            config.title.show = false;
        }
    }

    // Detect if the annotation overlay must render ALL labels (both data labels
    // and total labels) because native PptxGenJS labels are disabled to prevent
    // duplication. This applies when: placeholder series have labels, per-item
    // static formatters exist, or label styles differ across series.
    const hasPlaceholderLabels = (config.series || []).some(
        s => isPlaceholderOrOutlineSeries(s) && hasVisibleLabels(s)
    );
    const hasPerItemFormatters = hasPerItemStaticFormatters(config);
    const hasMixedLabels = detectMixedLabelStyles(config);

    // Detect waterfall: placeholder base + visible step series sharing a stack,
    // with per-item static formatters. Labels delegated to overlay system.
    const visibleStacks = new Set();
    for (const s of config.series || []) {
        if (s.type === 'bar' && !isPlaceholderOrOutlineSeries(s) && s.stack)
            visibleStacks.add(s.stack);
    }
    const isWaterfall = (config.series || []).some(
        s => s.type === 'bar' && isPlaceholderOrOutlineSeries(s) && !hasVisibleLabels(s)
            && s.stack && visibleStacks.has(s.stack)
    );
    const shouldKeepWaterfallLabels = isWaterfall && hasPerItemFormatters;
    // hasPlaceholderLabels and hasPerItemFormatters → handled by <c:dLbl> injection
    const shouldKeepAllLabels = hasMixedLabels || shouldKeepWaterfallLabels;

    // Process each series
    for (const s of config.series || []) {
        if (isPlaceholderOrOutlineSeries(s) && hasVisibleLabels(s)) {
            // KEEP transparent placeholder series with labels (total labels) —
            // they're already invisible bars, just keep the labels visible
            continue;
        }

        // Hide ALL data visualization for visible series
        if (s.type === 'bar') {
            s.itemStyle = { ...s.itemStyle, color: 'transparent', borderWidth: 0 };
            if (shouldKeepAllLabels) {
                // KEEP data labels visible — the overlay renders ALL labels
                // (native labels are disabled to prevent duplication)
            } else {
                s.label = { show: false };
            }
            // Clear per-item visualization but keep labels if overlay handles them
            if (Array.isArray(s.data)) {
                s.data = s.data.map(d => {
                    if (d && typeof d === 'object') {
                        const updates = { itemStyle: { ...d.itemStyle, color: 'transparent', borderWidth: 0 } };
                        if (!shouldKeepAllLabels) {
                            updates.label = { show: false };
                        }
                        return { ...d, ...updates };
                    }
                    return d;
                });
            }
        } else if (s.type === 'line') {
            s.lineStyle = { ...s.lineStyle, opacity: 0, width: 0 };
            s.itemStyle = { ...s.itemStyle, opacity: 0 };
            s.areaStyle = s.areaStyle ? { ...s.areaStyle, opacity: 0 } : undefined;
            if (!shouldKeepAllLabels) {
                s.label = { show: false };
            }
            s.showSymbol = false;
        } else if (s.type === 'pie') {
            s.itemStyle = { ...s.itemStyle, color: 'transparent', borderWidth: 0 };
            s.label = { show: false };
            s.labelLine = { show: false };
        } else if (s.type === 'scatter') {
            // Use symbolSize: 1 (near-invisible) instead of 0 — ECharts may skip
            // rendering markLine/markArea when symbolSize is exactly 0
            s.symbolSize = 1;
            s.itemStyle = { ...s.itemStyle, opacity: 0 };
            s.label = { show: false };
        }

        // Keep markLine, markPoint, markArea — they ARE the annotations
        // (no changes needed, they stay as-is)
    }

    // Keep graphic overlays (no changes needed)

    // Transparent background
    config.backgroundColor = 'transparent';

    return config;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY / LABEL EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract category labels from the category axis.
 */
function extractCategoryLabels(config) {
    const xAxis = Array.isArray(config.xAxis) ? config.xAxis[0] : config.xAxis;
    const yAxis = Array.isArray(config.yAxis) ? config.yAxis[0] : config.yAxis;

    let raw;
    if (xAxis?.type === 'category' && xAxis.data) {
        raw = xAxis.data.map(String);
    } else if (yAxis?.type === 'category' && yAxis.data) {
        raw = yAxis.data.map(String);
    } else {
        // Fallback: extract from first series data
        const firstSeries = config.series?.[0];
        if (firstSeries?.data && Array.isArray(firstSeries.data)) {
            if (firstSeries.data[0] && typeof firstSeries.data[0] === 'object' && firstSeries.data[0].name) {
                raw = firstSeries.data.map(d => String(d.name || ''));
            }
        }
    }

    if (!raw || raw.length === 0) return [];

    // Clean up labels for PptxGenJS: ECharts supports multi-line labels via "\n",
    // but PowerPoint's native chart axis labels don't wrap the same way.  Multi-line
    // labels cause PowerPoint to auto-rotate (45°) and truncate with "...".
    // Fix: de-hyphenate ("direc-\ntory" → "directory") then collapse \n to space.
    return raw.map(label => {
        return label
            .replace(/-\n/g, '')   // de-hyphenate: "direc-\ntory" → "directory"
            .replace(/\n/g, ' ')   // collapse remaining newlines to space
            .trim();
    });
}

/**
 * Extract raw category labels preserving \n (for chart XML post-processing).
 * Unlike extractCategoryLabels() which collapses newlines to spaces,
 * this preserves line breaks so patchChartLabels() can inject them as &#xA;.
 */
function extractRawCategoryLabels(config) {
    const xAxis = Array.isArray(config.xAxis) ? config.xAxis[0] : config.xAxis;
    const yAxis = Array.isArray(config.yAxis) ? config.yAxis[0] : config.yAxis;
    let raw;
    if (xAxis?.type === 'category' && xAxis.data) raw = xAxis.data.map(String);
    else if (yAxis?.type === 'category' && yAxis.data) raw = yAxis.data.map(String);
    if (!raw || raw.length === 0) return [];
    // De-hyphenate but preserve remaining \n for multi-line rendering
    return raw.map(label => label.replace(/-\n/g, '').trim());
}

/**
 * Extract axis label styling for chart XML post-processing.
 * Used by patchChartLabels() to set correct fontSize, lineHeight, etc. in OOXML.
 */
function extractAxisLabelStyle(config) {
    const xAxis = Array.isArray(config.xAxis) ? config.xAxis[0] : config.xAxis;
    const yAxis = Array.isArray(config.yAxis) ? config.yAxis[0] : config.yAxis;
    const catAxis = (xAxis?.type === 'category') ? xAxis : (yAxis?.type === 'category') ? yAxis : null;
    const al = catAxis?.axisLabel || {};
    return {
        fontSize: al.fontSize || 11,
        lineHeight: al.lineHeight || null,
        fontWeight: al.fontWeight || 'normal',
        color: al.color || '#333333',
    };
}

/**
 * Extract all per-item labels for OOXML <c:dLbl> injection.
 * Returns label data for both segment labels (with styling) and total labels (with text).
 * pptxSeriesIdx tracks the series index matching <c:ser><c:idx val="N"/> in chart XML.
 */
function extractAllLabels(config, dims) {
    const result = [];
    const series = config.series || [];
    const branding = getBranding();
    const brandFont = (branding.typography?.families?.data || 'Arial').split(',')[0].trim();
    const brandLabelColor = branding.charts?.labels?.color || branding.colors?.primary?.navy || '#1E3A5F';
    let pptxSeriesIdx = 0;

    // Detect stacks with visible series (for waterfall base tracking)
    const visibleStacks = new Set();
    for (const s of series) {
        if (s.type === 'bar' && !isPlaceholderOrOutlineSeries(s) && s.stack)
            visibleStacks.add(s.stack);
    }
    // Detect waterfall stacks (placeholder base + visible steps sharing a stack)
    const waterfallStacks = new Set();
    for (const s of series) {
        if (s.type === 'bar' && isPlaceholderOrOutlineSeries(s) && !hasVisibleLabels(s) && s.stack && visibleStacks.has(s.stack)) {
            waterfallStacks.add(s.stack);
        }
    }

    for (const s of series) {
        if (s.type !== 'bar') continue;
        const isPlaceholder = isPlaceholderOrOutlineSeries(s);
        if (isPlaceholder && !hasVisibleLabels(s)) {
            // Waterfall base occupies a pptxSeriesIdx slot (it's in the data)
            if (s.stack && visibleStacks.has(s.stack)) pptxSeriesIdx++;
            continue;
        }
        // Skip non-placeholder series without any per-item labels
        if (!isPlaceholder && !hasVisibleLabels(s)) { pptxSeriesIdx++; continue; }

        const isWaterfallStep = s.stack && waterfallStacks.has(s.stack);
        const labels = [];
        if (Array.isArray(s.data)) {
            for (let i = 0; i < s.data.length; i++) {
                const d = s.data[i];
                // Check per-item show OR inherit from series-level show
                const isObj = d && typeof d === 'object';
                const hasItemLabel = isObj && d.label?.show === true;
                const itemHidden = isObj && d.label?.show === false;
                const inheritsLabel = !hasItemLabel && !itemHidden && s.label?.show === true;
                if (hasItemLabel || inheritsLabel) {
                    const lbl = isObj ? { ...s.label, ...d.label } : { ...s.label };
                    const formatter = lbl.formatter;
                    const isStaticFormatter = typeof formatter === 'string' && !formatter.includes('{');

                    const pos = lbl.position || s.label?.position || 'top';
                    // NOTE: Per-point <c:dLblPos> inside <c:dLbl> with custom <c:tx><c:rich>
                    // text causes PowerPoint repair dialog. Rely on series-level <c:dLblPos>
                    // (set by PptxGenJS via dataLabelPosition option) for positioning instead.
                    const lblFontSize = lbl.fontSize || s.label?.fontSize || 12;
                    const lblBold = (lbl.fontWeight || s.label?.fontWeight || 'bold') === 'bold';
                    const posType = (pos === 'inside' || pos.startsWith('inside')) ? 'inside' : 'top';
                    const availW = estimateLabelAvailableWidthPt(config, dims, posType);
                    labels.push({
                        pointIdx: i,
                        // Static formatter: smart multiline — single line if fits, else keep breaks.
                        // No formatter: show native value (unless placeholder → suppress).
                        text: isStaticFormatter ? smartLabelText(formatter, lblFontSize, availW, lblBold) : null,
                        showVal: !isStaticFormatter && !isPlaceholder,
                        fontSize: lblFontSize,
                        fontWeight: lbl.fontWeight || s.label?.fontWeight || 'bold',
                        color: toPptxColor(lbl.color || s.label?.color || brandLabelColor),
                        fontFace: brandFont,
                        position: pos,
                        // dLblPos omitted — series-level positioning only (avoids repair)
                    });
                } else if (isPlaceholder) {
                    // Total point without label — suppress the "0"
                    labels.push({ pointIdx: i, text: null, showVal: false, suppress: true });
                }
            }
        }

        if (labels.length > 0) {
            result.push({ seriesIdx: pptxSeriesIdx, labels, isTotal: isPlaceholder });
        }
        pptxSeriesIdx++;
    }

    return result;
}

/**
 * Extract per-data-point visual overrides for OOXML <c:dPt> injection.
 * Covers: fill color, border style (dashed/solid), border color/width, label position.
 */
function extractPerPointStyles(config) {
    const result = [];
    let pptxSeriesIdx = 0;

    // Detect stacks with visible series (for waterfall base tracking)
    const visibleStacks = new Set();
    for (const s of config.series || []) {
        if (s.type === 'bar' && !isPlaceholderOrOutlineSeries(s) && s.stack)
            visibleStacks.add(s.stack);
    }

    for (const s of config.series || []) {
        if (s.type !== 'bar') continue;
        if (isPlaceholderOrOutlineSeries(s) && !hasVisibleLabels(s)) {
            // Waterfall base occupies a pptxSeriesIdx slot (it's in the data)
            if (s.stack && visibleStacks.has(s.stack)) pptxSeriesIdx++;
            continue;
        }

        const points = [];
        if (Array.isArray(s.data)) {
            for (let i = 0; i < s.data.length; i++) {
                const d = s.data[i];
                if (!d || typeof d !== 'object') continue;

                const pt = { pointIdx: i };

                // Per-point fill color (resolveColorToHex handles gradient objects)
                if (d.itemStyle?.color) {
                    pt.fillColor = resolveColorToHex(d.itemStyle.color);
                }

                // Per-point dashed border
                if (d.itemStyle?.borderType === 'dashed' && d.itemStyle?.borderColor) {
                    pt.dashedBorder = {
                        color: toPptxColor(d.itemStyle.borderColor),
                        widthEmu: Math.round((d.itemStyle.borderWidth || 1) * 12700),
                    };
                }

                // Per-point label position override (stacked bar: ctr, inBase, inEnd only)
                if (d.label?.position) {
                    const posMap = {
                        left: 'inEnd', right: 'inEnd', top: 'inEnd', bottom: 'inBase',
                        inside: 'ctr', insideLeft: 'ctr', insideRight: 'ctr',
                        insideTop: 'inEnd', insideBottom: 'inBase', outside: 'inEnd',
                    };
                    pt.labelPos = posMap[d.label.position] || null;
                }

                if (pt.fillColor || pt.dashedBorder || pt.labelPos) {
                    points.push(pt);
                }
            }
        }

        if (points.length > 0) {
            result.push({ seriesIdx: pptxSeriesIdx, points });
        }
        pptxSeriesIdx++;
    }
    return result;
}

/**
 * Extract labels for ALL series in a phantom-total stacked bar chart.
 * - Real series: emit seriesStyle for per-series <c:txPr> replacement (contrast colors)
 * - Phantom series: emit per-point custom text labels with dLblPos: 'outEnd'
 *
 * @param {object} config - ECharts config (post-pipeline)
 * @param {string[]} chartColors - PptxGenJS chartColors array (hex without '#')
 * @param {number} phantomSeriesIdx - Index of the phantom series in the data array
 * @param {string[]} totalTexts - Array of total label texts (one per category)
 * @returns {Array} - Label entries for OOXML injection
 */
function extractStackedBarLabels(config, chartColors, phantomSeriesIdx, totalTexts) {
    const branding = getBranding();
    const brandFont = (branding.typography?.families?.data || 'Arial').split(',')[0].trim();
    const brandLabelColor = toPptxColor(branding.charts?.labels?.color || branding.colors?.primary?.navy || '#1E3A5F');

    // Resolve font style from first formatter label (single source of truth)
    let fontSize = 10, fontWeight = 'bold';
    for (const s of config.series || []) {
        if (s.type !== 'bar' || isPlaceholderOrOutlineSeries(s)) continue;
        if (!Array.isArray(s.data)) continue;
        for (const d of s.data) {
            if (d && typeof d === 'object' && d.label?.formatter) {
                fontSize = d.label.fontSize || fontSize;
                fontWeight = d.label.fontWeight || fontWeight;
                break;
            }
        }
        break;
    }
    fontSize = fontSize * 0.75; // px → pt conversion (ECharts px to PowerPoint pt)

    const result = [];
    let pptxSeriesIdx = 0;

    for (const s of config.series || []) {
        if (s.type !== 'bar') continue;
        if (isPlaceholderOrOutlineSeries(s) && !hasVisibleLabels(s)) continue;
        if (pptxSeriesIdx === phantomSeriesIdx) { pptxSeriesIdx++; continue; } // skip phantom here

        // Real series: emit seriesStyle with contrast color
        const seriesColor = chartColors[pptxSeriesIdx] || '333333';
        result.push({
            seriesIdx: pptxSeriesIdx,
            seriesStyle: {
                color: contrastLabelColor(seriesColor),
                fontSize,
                fontWeight,
                fontFace: brandFont,
            },
            labels: [], // no per-point overrides needed
        });
        pptxSeriesIdx++;
    }

    // Phantom series: per-point custom text labels
    const phantomLabels = [];
    for (let i = 0; i < totalTexts.length; i++) {
        if (totalTexts[i]) {
            phantomLabels.push({
                pointIdx: i, text: totalTexts[i],
                fontSize, fontWeight, color: brandLabelColor,
                fontFace: brandFont,
                // Position at bottom of phantom bar = top of real data stack.
                // 'inBase' anchors the label at the inner edge of the phantom segment,
                // so total labels sit right above the colored bars regardless of phantom height.
                dLblPos: 'inBase',
            });
        } else {
            phantomLabels.push({ pointIdx: i, text: null, showVal: false, suppress: true });
        }
    }
    result.push({ seriesIdx: phantomSeriesIdx, labels: phantomLabels, isTotal: true });

    return result;
}

/**
 * Extract labels for waterfall charts with phantom spacer.
 * - Base series (transparent): all labels suppressed
 * - Step series: "inside*" labels stay (e.g. totals with white text); "top"/"outside" labels suppressed
 * - Spacer series (transparent, on top): carries "top"/"outside" labels above the bars
 */
function extractWaterfallLabels(config, chartColors, spacerIdx, dims) {
    const branding = getBranding();
    const brandFont = (branding.typography?.families?.data || 'Arial').split(',')[0].trim();
    const brandLabelColor = toPptxColor(branding.charts?.labels?.color || branding.colors?.primary?.navy || '#1E3A5F');
    const series = config.series || [];

    const result = [];
    let pptxSeriesIdx = 0;
    let spacerLabels = []; // accumulated across all step series

    // Detect stacks with visible series
    const visibleStacks = new Set();
    for (const s of series) {
        if (s.type === 'bar' && !isPlaceholderOrOutlineSeries(s) && s.stack)
            visibleStacks.add(s.stack);
    }

    for (const s of series) {
        if (s.type !== 'bar') continue;
        const isPlaceholder = isPlaceholderOrOutlineSeries(s);
        if (isPlaceholder && !hasVisibleLabels(s)) {
            if (s.stack && visibleStacks.has(s.stack)) pptxSeriesIdx++;
            continue;
        }

        // This is the step series — split labels between step and spacer
        const stepLabels = [];
        const numPoints = Array.isArray(s.data) ? s.data.length : 0;

        for (let i = 0; i < numPoints; i++) {
            const d = s.data[i];
            if (d && typeof d === 'object' && d.label?.show === true) {
                const lbl = d.label;
                const formatter = lbl.formatter;
                const isStaticFormatter = typeof formatter === 'string' && !formatter.includes('{');
                const pos = lbl.position || s.label?.position || 'top';
                const isInsidePosition = pos.startsWith('inside');

                const lblFontSize = lbl.fontSize || s.label?.fontSize || 10;
                const lblBold = (lbl.fontWeight || s.label?.fontWeight || 'bold') === 'bold';
                const posType = isInsidePosition ? 'inside' : 'top';
                const availW = estimateLabelAvailableWidthPt(config, dims, posType);
                const labelData = {
                    pointIdx: i,
                    text: isStaticFormatter ? smartLabelText(formatter, lblFontSize, availW, lblBold) : null,
                    showVal: !isStaticFormatter,
                    fontSize: lblFontSize,
                    fontWeight: lbl.fontWeight || s.label?.fontWeight || 'bold',
                    color: toPptxColor(lbl.color || s.label?.color || brandLabelColor),
                    fontFace: brandFont,
                };

                if (isInsidePosition) {
                    // Keep on step series (inside the bar, e.g. total bar with white text)
                    stepLabels.push({ ...labelData, dLblPos: 'inEnd' });
                    spacerLabels.push({ pointIdx: i, suppress: true });
                } else {
                    // Move to spacer (above the bar)
                    spacerLabels.push(labelData);
                    stepLabels.push({ pointIdx: i, suppress: true });
                }
            } else {
                // No label — suppress on both
                stepLabels.push({ pointIdx: i, suppress: true });
                spacerLabels.push({ pointIdx: i, suppress: true });
            }
        }

        if (stepLabels.length > 0) {
            result.push({ seriesIdx: pptxSeriesIdx, labels: stepLabels });
        }
        pptxSeriesIdx++;
    }

    // Spacer series: carries labels moved from step (positioned above bars)
    result.push({ seriesIdx: spacerIdx, labels: spacerLabels });

    return result;
}

/**
 * Extract numeric values from a series' data array.
 * Handles both [value, ...] and [{ value: v }, ...] formats.
 */
function extractValues(seriesData) {
    if (!Array.isArray(seriesData)) return [];
    return seriesData.map(d => {
        if (d === null || d === undefined) return null;  // null = gap
        if (d === '-' || d === '') return null;           // ECharts gap markers → null
        if (typeof d === 'number') return d;
        if (typeof d === 'object') {
            if (d.value === null || d.value === '-' || d.value === '') return null;
            if (d.value !== undefined) return d.value;
        }
        return 0;
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLE EXTRACTION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get standard defaults from branding, for base PptxGenJS options.
 */
function getStandardDefaults() {
    const branding = getBranding();
    const chartLabels = branding.charts?.labels || {};
    const chartAxis = branding.charts?.axis || {};
    const dataFont = branding.typography?.families?.data || 'Arial, sans-serif';

    return {
        catAxisLabelFontSize: chartLabels.fontSize || 11,
        catAxisLabelFontFace: dataFont,
        catAxisLabelColor: toPptxColor(chartLabels.color || '#333333'),
        catAxisLineShow: false,
        catAxisMajorTickMark: 'none',
        catGridLine: { style: 'none' },

        valAxisLabelFontSize: chartLabels.fontSize || 11,
        valAxisLabelFontFace: dataFont,
        valAxisLabelColor: toPptxColor(chartLabels.color || '#333333'),
        valAxisLineShow: false,
        valAxisMajorTickMark: 'none',
        valAxisHidden: true,
        valGridLine: {
            style: 'solid',
            color: toPptxColor(chartAxis.gridlineColor || '#E0E0E0'),
            size: chartAxis.gridlineWidth || 0.5,
        },

        showValue: false,
        dataLabelFontSize: chartLabels.fontSize || 11,
        dataLabelFontFace: dataFont,
        dataLabelColor: toPptxColor(chartLabels.color || '#333333'),

        showLegend: false,
    };
}

/**
 * Extract chart colors from config series.
 */
function extractChartColors(config) {
    const colors = [];
    const defaultColors = getChartColors();

    for (const s of config.series) {
        if (s.type === 'pie') {
            // Pie: per-item colors
            if (Array.isArray(s.data)) {
                for (const d of s.data) {
                    if (typeof d === 'object' && d.itemStyle?.color) {
                        colors.push(toPptxColor(d.itemStyle.color));
                    } else {
                        colors.push(toPptxColor(defaultColors[colors.length % defaultColors.length] || '#4472C4'));
                    }
                }
            }
            return colors;
        }

        // Placeholder series (total labels): white color — zero-height bar, color irrelevant
        if (isPlaceholderOrOutlineSeries(s)) {
            colors.push('FFFFFF');
            continue;
        }

        if (s.itemStyle?.color) {
            colors.push(resolveColorToHex(s.itemStyle.color) || toPptxColor(defaultColors[colors.length % defaultColors.length] || '#4472C4'));
        } else {
            colors.push(toPptxColor(defaultColors[colors.length % defaultColors.length] || '#4472C4'));
        }
    }

    return colors;
}

/**
 * Map ECharts splitLine to PptxGenJS gridLine.
 */
function mapGridLine(splitLine) {
    if (!splitLine?.show) return { style: 'none' };
    const ls = splitLine.lineStyle || {};
    return {
        style: ls.type === 'dashed' ? 'dash' : 'solid',
        color: toPptxColor(ls.color || '#E0E0E0'),
        size: ls.width || 0.5,
    };
}

/**
 * Extract axis options from ECharts config.
 */
function extractAxisOptions(config) {
    const opts = {};
    const xAxis = Array.isArray(config.xAxis) ? config.xAxis[0] : config.xAxis;
    const yAxis = Array.isArray(config.yAxis) ? config.yAxis[0] : config.yAxis;
    const isHoriz = isHorizontalChart(config);

    // Category axis
    const catAxis = isHoriz ? yAxis : xAxis;
    // Value axis
    const valAxis = isHoriz ? xAxis : yAxis;

    if (catAxis) {
        if (catAxis.show === false) {
            opts.catAxisHidden = true;
        } else {
            opts.catAxisHidden = false;
            if (catAxis.axisLabel) {
                if (catAxis.axisLabel.fontSize) opts.catAxisLabelFontSize = catAxis.axisLabel.fontSize * 0.75; // px → pt
                if (catAxis.axisLabel.fontWeight === 'bold') opts.catAxisLabelFontBold = true;
                if (catAxis.axisLabel.color) opts.catAxisLabelColor = toPptxColor(catAxis.axisLabel.color);
                if (catAxis.axisLabel.fontFamily) opts.catAxisLabelFontFace = catAxis.axisLabel.fontFamily;
                if (catAxis.axisLabel.rotate != null) opts.catAxisLabelRotate = catAxis.axisLabel.rotate;
                if (catAxis.axisLabel.interval != null && typeof catAxis.axisLabel.interval === 'number') {
                    opts.catAxisLabelFrequency = catAxis.axisLabel.interval + 1;
                }
                if (catAxis.axisLabel.show === false) opts.catAxisHidden = true;
            }
            if (catAxis.inverse === true) opts.catAxisOrientation = 'maxMin';
            if (catAxis.axisLine?.show === true) {
                opts.catAxisLineShow = true;
                if (catAxis.axisLine.lineStyle?.color) {
                    opts.catAxisLineColor = toPptxColor(catAxis.axisLine.lineStyle.color);
                }
                if (catAxis.axisLine.lineStyle?.width) {
                    opts.catAxisLineSize = catAxis.axisLine.lineStyle.width;
                }
                if (catAxis.axisLine.lineStyle?.type) {
                    const styleMap = { solid: 'solid', dashed: 'dash', dotted: 'dot' };
                    opts.catAxisLineStyle = styleMap[catAxis.axisLine.lineStyle.type] || 'solid';
                }
            } else if (catAxis.axisLine?.show === false) {
                opts.catAxisLineShow = false;
            }
            if (catAxis.axisTick?.show === false) {
                opts.catAxisMajorTickMark = 'none';
            }
            if (catAxis.splitLine) {
                opts.catGridLine = mapGridLine(catAxis.splitLine);
            }
        }
    }

    if (valAxis) {
        // Scale properties must be set regardless of axis visibility
        if (valAxis.min !== undefined) opts.valAxisMinVal = valAxis.min;
        if (valAxis.max !== undefined) opts.valAxisMaxVal = valAxis.max;
        if (valAxis.interval !== undefined) opts.valAxisMajorUnit = valAxis.interval;
        if (valAxis.inverse === true) opts.valAxisOrientation = 'maxMin';

        if (valAxis.show === false) {
            opts.valAxisHidden = true;
        } else {
            if (valAxis.axisLabel) {
                if (valAxis.axisLabel.show === false) {
                    opts.valAxisHidden = true;
                } else {
                    opts.valAxisHidden = false;
                    if (valAxis.axisLabel.fontSize) opts.valAxisLabelFontSize = valAxis.axisLabel.fontSize * 0.75; // px → pt
                    if (valAxis.axisLabel.color) opts.valAxisLabelColor = toPptxColor(valAxis.axisLabel.color);
                    if (valAxis.axisLabel.fontFamily) opts.valAxisLabelFontFace = valAxis.axisLabel.fontFamily;
                    if (valAxis.axisLabel.fontWeight === 'bold') opts.valAxisLabelFontBold = true;

                    // Value axis formatter → PptxGenJS numFmt
                    if (typeof valAxis.axisLabel.formatter === 'string') {
                        const fmt = valAxis.axisLabel.formatter;
                        if (fmt === '{value}%' || fmt === '{value} %') {
                            // Use 0.##"%" to support decimal intervals (e.g., 2.5%)
                            opts.valAxisLabelFormatCode = '0.##"%"';
                        } else if (fmt === '{value}k' || fmt === '{value}K') {
                            opts.valAxisLabelFormatCode = '#,##0,"k"';
                        } else if (fmt === '${value}' || fmt === '{value}$') {
                            opts.valAxisLabelFormatCode = '$#,##0';
                        }
                    }
                }
            }
            if (valAxis.axisLine?.show === true) {
                opts.valAxisLineShow = true;
                if (valAxis.axisLine.lineStyle?.color) {
                    opts.valAxisLineColor = toPptxColor(valAxis.axisLine.lineStyle.color);
                }
                if (valAxis.axisLine.lineStyle?.width) {
                    opts.valAxisLineSize = valAxis.axisLine.lineStyle.width;
                }
                if (valAxis.axisLine.lineStyle?.type) {
                    const styleMap = { solid: 'solid', dashed: 'dash', dotted: 'dot' };
                    opts.valAxisLineStyle = styleMap[valAxis.axisLine.lineStyle.type] || 'solid';
                }
            } else if (valAxis.axisLine?.show === false) {
                opts.valAxisLineShow = false;
            }
            if (valAxis.axisTick?.show === false) {
                opts.valAxisMajorTickMark = 'none';
            }
            if (valAxis.splitLine) {
                opts.valGridLine = mapGridLine(valAxis.splitLine);
            }
        }
    }

    // Auto-determine value axis format code based on interval
    if (!opts.valAxisLabelFormatCode && valAxis) {
        const interval = valAxis.interval;
        if (interval !== undefined) {
            if (interval % 1 !== 0) {
                // Fractional interval (e.g. 0.5) — show one decimal
                opts.valAxisLabelFormatCode = '0.0';
            } else {
                // Integer interval — show integers only (no decimals)
                opts.valAxisLabelFormatCode = '0';
            }
        }
    }

    // Check branding for thousands separator → apply format code
    try {
        const branding = getBranding();
        const sep = branding?.numberFormat?.thousandsSeparator;
        if (sep && !opts.valAxisLabelFormatCode) {
            opts.valAxisLabelFormatCode = '#,##0';
        }
    } catch { /* branding not loaded */ }

    return opts;
}

/**
 * Extract data label options from ECharts config.
 * Checks ALL series (not just first) — the McKinsey pipeline may add labels
 * to individual series via applyDefaultLabels().
 */
function extractDataLabels(config) {
    const opts = {};
    if (!config.series || !Array.isArray(config.series)) return opts;

    // Find the first series with label.show: true
    let label = null;
    for (const s of config.series) {
        if (s.label?.show === true) {
            label = s.label;
            break;
        }
    }

    // Also check per-item data labels (some charts set labels on data items)
    if (!label) {
        for (const s of config.series) {
            if (Array.isArray(s.data)) {
                for (const d of s.data) {
                    if (d && typeof d === 'object' && d.label?.show === true) {
                        label = d.label;
                        break;
                    }
                }
            }
            if (label) break;
        }
    }

    if (!label) return opts;

    opts.showValue = true;
    if (label.fontSize) opts.dataLabelFontSize = label.fontSize * 0.75; // px → pt
    if (label.fontWeight === 'bold') opts.dataLabelFontBold = true;
    if (label.color) opts.dataLabelColor = toPptxColor(label.color);
    if (label.fontFamily) opts.dataLabelFontFace = label.fontFamily;

    // Position mapping
    const posMap = {
        'top': 't',
        'inside': 'ctr',
        'insideTop': 'ctr',
        'insideRight': 'ctr',
        'outside': 'outEnd',
        'bottom': 'b',
        'left': 'l',
        'right': 'r',
    };
    if (label.position && posMap[label.position]) {
        opts.dataLabelPosition = posMap[label.position];
    }

    // Formatter handling
    if (typeof label.formatter === 'string') {
        const f = label.formatter;
        if (f.includes('{d}')) {
            opts.showPercent = true;
            opts.showValue = false;
            opts.dataLabelFormatCode = '0"%"';
        } else if (f === '{b}') {
            opts.showLabel = true;
            opts.showValue = false;
        } else if (f === '{c}%' || f === '{c} %') {
            opts.dataLabelFormatCode = '0"%"';
        } else if (f === '${c}' || f === '{c}$') {
            opts.dataLabelFormatCode = '$#,##0';
        }
    }

    return opts;
}

/**
 * Extract legend options from ECharts config.
 */
function extractLegendOptions(config) {
    const opts = {};
    if (!config.legend) return opts;

    const legend = Array.isArray(config.legend) ? config.legend[0] : config.legend;
    if (legend.show === false) {
        opts.showLegend = false;
        return opts;
    }
    if (legend.show === true) {
        opts.showLegend = true;
    }

    // Position
    if (legend.bottom !== undefined) opts.legendPos = 'b';
    else if (legend.top !== undefined) opts.legendPos = 't';
    else if (legend.left !== undefined) opts.legendPos = 'l';
    else if (legend.right !== undefined) opts.legendPos = 'r';

    if (legend.textStyle?.fontSize) opts.legendFontSize = legend.textStyle.fontSize * 0.75; // px → pt
    if (legend.textStyle?.color) opts.legendColor = toPptxColor(legend.textStyle.color);
    if (legend.textStyle?.fontFamily) opts.legendFontFace = legend.textStyle.fontFamily;

    return opts;
}

/**
 * Calculate barGapWidthPct from ECharts barWidth.
 */
function calcBarGap(config) {
    // Find barWidth from first bar series or top-level
    let barWidth = null;
    for (const s of config.series) {
        if (s.type === 'bar' && s.barWidth) {
            barWidth = s.barWidth;
            break;
        }
    }
    if (!barWidth && config.barWidth) barWidth = config.barWidth;
    if (!barWidth) return undefined;

    const pct = parseFloat(String(barWidth));
    if (isNaN(pct) || pct <= 0) return undefined;

    return Math.round((100 / pct - 1) * 100);
}

/**
 * Extract PptxGenJS plotArea layout from ECharts grid config.
 * Maps grid.left/right/top/bottom (pixel offsets) to proportional plotArea coords
 * so the native chart's plot area matches the ECharts positioning.
 */
/**
 * Estimate the height (in px) of the bottom axis labels from the chart config.
 * Used to compensate for containLabel:true → false transitions, where labels
 * that were INSIDE the grid boundary move OUTSIDE the plot area.
 */
export function estimateBottomAxisLabelHeight(config) {
    const xAxis = Array.isArray(config.xAxis) ? config.xAxis[0] : config.xAxis;
    if (!xAxis?.data || xAxis.type !== 'category') return 0;

    const fontSize = xAxis.axisLabel?.fontSize || 12;
    const lineHeight = xAxis.axisLabel?.lineHeight || Math.ceil(fontSize * 1.3);

    // Find max number of lines in category labels
    let maxLines = 1;
    for (const label of xAxis.data) {
        const text = typeof label === 'string' ? label : (label?.value != null ? String(label.value) : String(label));
        const lines = text.split('\n').length;
        if (lines > maxLines) maxLines = lines;
    }

    // Total: text lines + 2 lines worth of padding (tick gap, axis line, spacing)
    return (maxLines + 2) * lineHeight;
}

function extractLayout(config, width, height, detection) {
    const grid = config.grid || {};
    // Only apply if at least one grid property is set
    if (!grid.left && !grid.right && !grid.top && !grid.bottom) return {};

    const parseVal = (v) => {
        if (v === undefined || v === null) return 0;
        if (typeof v === 'number') return v;
        const s = String(v);
        // Skip percentage values — only handle pixel values
        if (s.includes('%')) return NaN;
        return parseFloat(s) || 0;
    };

    let left = parseVal(grid.left);
    let right = parseVal(grid.right);
    let top = parseVal(grid.top);
    let bottom = parseVal(grid.bottom);

    // When legend is at the bottom, add extra space so it doesn't overlap x-axis labels
    const legend = Array.isArray(config.legend) ? config.legend[0] : config.legend;
    if (legend?.show !== false && legend?.bottom !== undefined) {
        const legendFontPx = legend?.textStyle?.fontSize || 11;
        bottom += legendFontPx * 2; // ~2 lines for legend height + gap
    }

    // If any value is NaN (percentage), skip layout mapping
    if (isNaN(left) || isNaN(right) || isNaN(top) || isNaN(bottom)) return {};

    // Only apply if values are meaningful (at least one non-zero)
    if (left === 0 && right === 0 && top === 0 && bottom === 0) return {};

    // Capture original (unscaled) layout for overlay repositioning
    const originalLayout = {
        x: left / width,
        y: top / height,
        w: (width - left - right) / width,
        h: (height - top - bottom) / height,
    };

    // Grid margins include ECharts axis label space (from applySafeChartDefaults
    // and configureVertical/HorizontalChart). PptxGenJS layout uses layoutTarget="inner"
    // and renders labels OUTSIDE the plot area. Subtract the approximate pixel space
    // PptxGenJS reserves for axis labels to avoid double-counting, capped at 50%.
    // This is chart-agnostic: large margins (e.g. horizontal bar category labels ~166px)
    // retain ~88% of their value, while small margins (e.g. vertical bar y-axis ~50px)
    // stay near 50% — matching the empirically-tuned behavior.
    const PPTX_LABEL_RESERVE = 10; // ~px PptxGenJS reserves for axis labels outside layout
    const marginScale = (margin) => Math.max(1 - PPTX_LABEL_RESERVE / Math.max(margin, 1), 0.5);
    const sLeft = left * marginScale(left);
    const sRight = right * marginScale(right);
    const sBottom = bottom * marginScale(bottom);
    // top usually small (legend/title padding), keep as-is

    return {
        layout: {
            x: sLeft / width,
            y: top / height,
            w: (width - sLeft - sRight) / width,
            h: (height - top - sBottom) / height,
        },
        originalLayout
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHART BUILDERS
// ═══════════════════════════════════════════════════════════════════════════════

function buildBarChart(config, pres, detection, dims) {
    const labels = extractCategoryLabels(config);
    if (labels.length === 0) return null;

    // Detect stacks that have visible (non-placeholder) series — for waterfall base inclusion
    const visibleStacks = new Set();
    for (const s of config.series) {
        if (s.type === 'bar' && !isPlaceholderOrOutlineSeries(s) && s.stack)
            visibleStacks.add(s.stack);
    }

    // Build data array, including waterfall placeholder bases for stacking
    const noFillSeriesIndices = [];
    const data = [];
    for (const s of config.series) {
        if (s.type !== 'bar') continue;
        const isPlaceholder = isPlaceholderOrOutlineSeries(s);

        if (isPlaceholder && !hasVisibleLabels(s)) {
            // Include if waterfall base (shares stack with visible series)
            if (s.stack && visibleStacks.has(s.stack)) {
                noFillSeriesIndices.push(data.length);
                data.push({ name: s.name || 'Series', labels, values: extractValues(s.data) });
            }
            // else: standalone placeholder without labels → skip
            continue;
        }

        data.push({ name: s.name || 'Series', labels, values: extractValues(s.data) });
    }

    if (data.length === 0) return null;

    const defaults = getStandardDefaults();
    const axisOpts = extractAxisOptions(config);
    const labelOpts = extractDataLabels(config);
    const legendOpts = extractLegendOptions(config);
    const chartColors = extractChartColors(config);

    const barGap = calcBarGap(config);

    // Detect 100% stacked bars: all category totals sum to ~100
    let isPercentStacked = false;
    if (detection.stacking === 'stacked' && data.length > 0) {
        const numCats = data[0].values.length;
        isPercentStacked = numCats > 0;
        for (let c = 0; c < numCats; c++) {
            let total = 0;
            for (const d of data) total += Math.abs(d.values[c] || 0);
            if (Math.abs(total - 100) > 2) { isPercentStacked = false; break; }
        }
    }

    const barGrouping = isPercentStacked ? 'percentStacked'
        : detection.stacking === 'stacked' ? 'stacked' : 'clustered';

    const options = {
        ...defaults,
        ...axisOpts,
        ...labelOpts,
        ...legendOpts,
        chartColors,
        barDir: detection.orientation === 'horizontal' ? 'bar' : 'col',
        barGrouping,
    };

    if (barGap !== undefined) {
        options.barGapWidthPct = barGap;
    }

    // Detect label scenarios that require annotation overlay delegation:
    // - Placeholder series with visible labels (total labels above stacked bars)
    // - Per-item static formatters ("92", "$761") that PptxGenJS can't render
    // - Mixed label styles across series (PptxGenJS labels are chart-level)
    const hasPlaceholderLabels = config.series.some(
        s => isPlaceholderOrOutlineSeries(s) && hasVisibleLabels(s)
    );
    const hasPerItemFormatters = hasPerItemStaticFormatters(config);
    const hasMixedLabels = detectMixedLabelStyles(config);

    // Phantom-segment approach for stacked bars with formatter-based totals:
    // 1. PptxGenJS showValue:true → shows native segment values inside each bar
    // 2. Phantom transparent segment (value=0) added on top → carries total labels
    // 3. OOXML injection only on phantom series → custom text totals
    // 4. Zero-hiding format code → hides "0" from phantom + zero-valued real segments
    let phantomTotalIdx = null;
    let phantomTotalTexts = null;
    let waterfallSpacerIdx = null;
    let waterfallMeta = null;
    const isWaterfall = noFillSeriesIndices.length > 0;
    // Count how many visible bar series have per-item static formatters.
    // Phantom total only makes sense when ONE series has formatters (the "total" series).
    // When MULTIPLE series have per-segment formatters, use extractAllLabels instead.
    const seriesWithFormatters = (config.series || []).filter(s =>
        s.type === 'bar' && !isPlaceholderOrOutlineSeries(s) && Array.isArray(s.data) &&
        s.data.some(d => d && typeof d === 'object' && d.label?.formatter &&
            typeof d.label.formatter === 'string' && !d.label.formatter.includes('{'))
    );
    const usePhantomTotal = hasPerItemFormatters && detection.stacking === 'stacked' && !hasPlaceholderLabels && !isWaterfall && seriesWithFormatters.length <= 1;

    // When usePhantomTotal is false but a pre-existing phantom series exists
    // (transparent/noFill with labels, values ≈ 0), apply computed padding so
    // total labels don't overlap the bar tops in native PowerPoint charts.
    if (!usePhantomTotal && detection.stacking === 'stacked' && hasPlaceholderLabels) {
        let phantomDataIdx = -1;
        let configIdx = 0;
        for (let di = 0; di < data.length; di++) {
            // Find the data entry corresponding to a placeholder series
            const s = config.series.filter(s => s.type === 'bar')[di];
            if (s && isPlaceholderOrOutlineSeries(s) && hasVisibleLabels(s)) {
                // Detect placeholder values: 0, null, undefined, or tiny values (1-2)
                // used as minimal phantom spacers for total labels
                const allTiny = data[di].values.every(v => v == null || Math.abs(v) <= 2);
                if (allTiny) { phantomDataIdx = di; break; }
            }
        }
        if (phantomDataIdx >= 0) {
            // Resolve label font size from the phantom series formatter labels
            let labelFontSize = 10;
            for (const s of config.series || []) {
                if (!isPlaceholderOrOutlineSeries(s) || s.type !== 'bar') continue;
                if (!Array.isArray(s.data)) continue;
                for (const d of s.data) {
                    if (d && typeof d === 'object' && d.label?.formatter && d.label.fontSize) {
                        labelFontSize = d.label.fontSize; break;
                    }
                }
            }
            labelFontSize = labelFontSize * 0.75; // px → pt
            // Compute padding excluding the phantom series itself
            const dataWithoutPhantom = data.filter((_, i) => i !== phantomDataIdx);
            const phantomValue = computePhantomPadding(config, dataWithoutPhantom, labelFontSize);
            data[phantomDataIdx].values = data[phantomDataIdx].values.map(() => phantomValue);
            // NOTE: Do NOT push to noFillSeriesIndices — that would suppress all labels
            // via the dispatch at line 370. The transparent color is already in chartColors.

            // Adjust valAxisMaxVal so inflated phantom + bars fit within the chart
            const yAxisConf = Array.isArray(config.yAxis) ? config.yAxis[0] : config.yAxis;
            let maxStackWithPhantom = 0;
            for (let cat = 0; cat < (data[0]?.values?.length || 0); cat++) {
                let stack = 0;
                for (const s of data) stack += (s.values[cat] || 0);
                maxStackWithPhantom = Math.max(maxStackWithPhantom, stack);
            }
            const currentMax = yAxisConf?.max || options.valAxisMaxVal || maxStackWithPhantom;
            if (maxStackWithPhantom > currentMax * 0.95) {
                options.valAxisMaxVal = Math.ceil(maxStackWithPhantom * 1.05);
            }
        }
    }

    if (usePhantomTotal) {
        phantomTotalTexts = collectFormatterTotals(config, dims);
    }

    if (usePhantomTotal && phantomTotalTexts) {
        // Resolve font size from formatter labels (single source of truth)
        let labelFontSize = 10;
        for (const s of config.series || []) {
            if (s.type !== 'bar' || isPlaceholderOrOutlineSeries(s)) continue;
            if (!Array.isArray(s.data)) continue;
            for (const d of s.data) {
                if (d && typeof d === 'object' && d.label?.formatter && d.label.fontSize) {
                    labelFontSize = d.label.fontSize; break;
                }
            }
            break;
        }
        labelFontSize = labelFontSize * 0.75; // px → pt conversion (ECharts px to PowerPoint pt)

        // Calculate phantom padding for label separation
        const phantomValue = computePhantomPadding(config, data, labelFontSize);
        data.push({ name: '', labels, values: Array(labels.length).fill(phantomValue) });
        chartColors.push('FFFFFF');
        phantomTotalIdx = data.length - 1;

        // Adjust yAxisMax if not explicitly set to ensure phantom + label fit
        const yAxis = Array.isArray(config.yAxis) ? config.yAxis[0] : config.yAxis;
        if (!yAxis?.max) {
            let maxStack = 0;
            const numCats = labels.length;
            for (let cat = 0; cat < numCats; cat++) {
                let stack = 0;
                for (const s of data) stack += (s.values[cat] || 0);
                maxStack = Math.max(maxStack, stack);
            }
            options.valAxisMaxVal = Math.ceil(maxStack * 1.08);
        }

        // Enable native segment values with consistent styling
        options.showValue = true;
        options.dataLabelPosition = 'ctr';
        options.dataLabelFormatCode = '#,##0;-#,##0;" "'; // hide zeros
        options.dataLabelFontSize = labelFontSize;
        options.dataLabelFontBold = true;
        options.dataLabelColor = '333333'; // safe default; OOXML overrides per-series
    } else if (isWaterfall && hasPerItemFormatters) {
        // Waterfall labels & connectors: compute positions from data values.
        // Rendered as native PPTX text boxes + line shapes in html2pptx.mjs,
        // using the same layout coordinate system as the native chart bars.
        // This eliminates overlay PNG coordinate mismatch entirely.
        options.showValue = false;
        options.showLabel = false;
        options.dataLabelFormatCode = ' ';

        const baseSeries = config.series.find(s => s.type === 'bar' && isPlaceholderOrOutlineSeries(s) && s.stack);
        const stepSeries = config.series.find(s => s.type === 'bar' && !isPlaceholderOrOutlineSeries(s) && s.stack);
        if (baseSeries && stepSeries) {
            // For horizontal bars, the VALUE axis is xAxis; for vertical bars, it's yAxis
            const isHoriz = detection.orientation === 'horizontal';
            const valAxisConf = isHoriz
                ? (Array.isArray(config.xAxis) ? config.xAxis[0] : config.xAxis)
                : (Array.isArray(config.yAxis) ? config.yAxis[0] : config.yAxis);
            const baseData = (baseSeries.data || []).map(d => typeof d === 'object' ? (d.value ?? 0) : (d ?? 0));
            const stepData = (stepSeries.data || []).map(d => typeof d === 'object' ? (d.value ?? 0) : (d ?? 0));

            const availW = estimateLabelAvailableWidthPt(config, dims, 'top');
            const wLabels = [];
            for (let i = 0; i < stepData.length; i++) {
                const item = stepSeries.data[i];
                const itemObj = typeof item === 'object' ? item : {};
                const lbl = itemObj.label || {};
                if (!lbl.show && !lbl.formatter) continue;
                const rawText = lbl.formatter || String(stepData[i]);
                const lblFontSize = lbl.fontSize || 10;
                const lblBold = (lbl.fontWeight || 'normal') === 'bold';
                wLabels.push({
                    categoryIndex: i,
                    barTop: baseData[i] + stepData[i],
                    barBase: baseData[i],
                    text: smartLabelText(rawText, lblFontSize, availW, lblBold),
                    fontSize: lblFontSize,
                    fontWeight: lbl.fontWeight || 'normal',
                    color: lbl.color || '#333333',
                    position: lbl.position || 'top',
                });
            }

            const wConnectors = [];
            if (stepSeries.markLine?.data) {
                // Normalize category names for matching (extractCategoryLabels
                // de-hyphenates and collapses \n to space, but markLine xAxis
                // values use the original names with \n)
                const normalize = s => String(s).replace(/-\n/g, '').replace(/\n/g, ' ').trim();
                const normalizedCats = labels.map(normalize);
                for (const lineData of stepSeries.markLine.data) {
                    if (Array.isArray(lineData) && lineData.length === 2) {
                        const fromNorm = normalize(lineData[0].xAxis);
                        const toNorm = normalize(lineData[1].xAxis);
                        const fromIdx = normalizedCats.indexOf(fromNorm);
                        const toIdx = normalizedCats.indexOf(toNorm);
                        wConnectors.push({
                            yValue: lineData[0].yAxis,
                            fromIndex: fromIdx >= 0 ? fromIdx : 0,
                            toIndex: toIdx >= 0 ? toIdx : 0,
                        });
                    }
                }
            }

            // Auto-generate connectors for any missing adjacent pairs
            // (fills gaps when explicit markLine connectors don't cover all pairs)
            if (baseData.length > 1) {
                const coveredPairs = new Set(wConnectors.map(c => `${c.fromIndex}-${c.toIndex}`));
                for (let i = 0; i < baseData.length - 1; i++) {
                    if (coveredPairs.has(`${i}-${i + 1}`)) continue;

                    const iTop = baseData[i] + stepData[i];
                    const iBot = baseData[i];
                    const jTop = baseData[i + 1] + stepData[i + 1];
                    const jBot = baseData[i + 1];

                    // Find the shared y-value between adjacent bars (closest matching endpoints)
                    const pairs = [
                        { y: (iTop + jTop) / 2, diff: Math.abs(iTop - jTop) },
                        { y: (iTop + jBot) / 2, diff: Math.abs(iTop - jBot) },
                        { y: (iBot + jTop) / 2, diff: Math.abs(iBot - jTop) },
                        { y: (iBot + jBot) / 2, diff: Math.abs(iBot - jBot) },
                    ];
                    const best = pairs.reduce((a, b) => a.diff < b.diff ? a : b);

                    wConnectors.push({
                        yValue: best.y,
                        fromIndex: i,
                        toIndex: i + 1,
                    });
                }
            }

            // Detect category axis inverse (top-to-bottom for horizontal bars)
            const catAxisConf = isHoriz
                ? (Array.isArray(config.yAxis) ? config.yAxis[0] : config.yAxis)
                : (Array.isArray(config.xAxis) ? config.xAxis[0] : config.xAxis);
            waterfallMeta = {
                yAxisMax: valAxisConf?.max || Math.max(...stepData.map((v, i) => baseData[i] + v)),
                yAxisMin: valAxisConf?.min || 0,
                labels: wLabels,
                connectors: wConnectors,
                isHorizontal: isHoriz,
                isInverse: catAxisConf?.inverse === true,
            };
        }
    } else if (hasPlaceholderLabels || hasPerItemFormatters || hasMixedLabels) {
        options.showValue = false;
        options.showLabel = false;
        options.dataLabelFormatCode = ' ';  // Safety: suppress any leaked labels
    }

    return {
        chartType: pres.charts.BAR,
        data,
        options,
        phantomTotalIdx,
        phantomTotalTexts,
        noFillSeriesIndices,
        waterfallSpacerIdx,
        waterfallMeta,
    };
}

function buildLineChart(config, pres, detection) {
    const labels = extractCategoryLabels(config);
    // Filter out area-mask series (shaded band fills) — rendered in annotation overlay PNG
    const lineSeries = config.series.filter(s => s.type === 'line' && !isAreaMaskSeries(s));

    if (labels.length === 0) {
        // Value-value axis: detect [[x,y]] data → build as SCATTER combo
        const firstSeries = lineSeries[0];
        const isXYData = Array.isArray(firstSeries?.data?.[0]) && firstSeries.data[0].length >= 2;

        if (isXYData) {
            const defaults = getStandardDefaults();
            const axisOpts = extractAxisOptions(config);
            const labelOpts = extractDataLabels(config);
            const legendOpts = extractLegendOptions(config);
            const options = { ...defaults, ...axisOpts, ...labelOpts, ...legendOpts };
            return buildLineAsScatter(config, pres, lineSeries, options);
        }

        console.log('  [native-chart] Fallback: no category labels and no [[x,y]] data');
        return null;
    }
    const data = lineSeries.map(s => ({
        name: s.name || 'Series',
        labels,
        values: extractValues(s.data),
    }));

    if (data.length === 0) return null;

    const defaults = getStandardDefaults();
    const axisOpts = extractAxisOptions(config);
    const labelOpts = extractDataLabels(config);
    const legendOpts = extractLegendOptions(config);
    const chartColors = extractChartColors(config);

    const options = {
        ...defaults,
        ...axisOpts,
        ...labelOpts,
        ...legendOpts,
        chartColors,
    };

    // Detect label scenarios that require annotation overlay delegation
    const hasPlaceholderLabels = config.series.some(
        s => isPlaceholderOrOutlineSeries(s) && hasVisibleLabels(s)
    );
    const hasPerItemFormatters = hasPerItemStaticFormatters(config);
    const hasMixedLabels = detectMixedLabelStyles(config);
    if (hasPlaceholderLabels || hasPerItemFormatters) {
        options.showValue = false;
        options.showLabel = false;
        options.dataLabelFormatCode = ' ';  // Safety: suppress any leaked labels
    }
    // For mixed label positions on line charts: still show values at default position
    // (PptxGenJS can only set one global position, but showing at "top" is better than hiding all)

    // Check for mixed line dash styles → use combo chart API for per-group lineDash
    const dashMap = { 'solid': 'solid', 'dashed': 'dash', 'dotted': 'sysDot' };
    const dashGroups = new Map(); // dashStyle → [{ series, dataEntry }]

    for (let i = 0; i < lineSeries.length; i++) {
        const s = lineSeries[i];
        const dash = dashMap[s.lineStyle?.type || 'solid'] || 'solid';
        if (!dashGroups.has(dash)) dashGroups.set(dash, []);
        dashGroups.get(dash).push({ series: s, dataEntry: data[i] });
    }

    if (dashGroups.size > 1) {
        // Build combo chart with separate LINE entries per dash style
        const defaultColors = getChartColors();
        const regroupedColors = [];
        const chartTypeArray = [];

        for (const [dash, group] of dashGroups) {
            const groupData = group.map(g => g.dataEntry);
            const firstInGroup = group[0].series;

            // Collect colors for this group's series
            for (const g of group) {
                const color = g.series.itemStyle?.color || g.series.lineStyle?.color;
                if (color) {
                    regroupedColors.push(toPptxColor(color));
                } else {
                    regroupedColors.push(toPptxColor(defaultColors[regroupedColors.length % defaultColors.length] || '#4472C4'));
                }
            }

            chartTypeArray.push({
                type: pres.charts.LINE,
                data: groupData,
                options: {
                    lineDash: dash,
                    lineSize: firstInGroup.lineStyle?.width || 2,
                    lineDataSymbol: firstInGroup.showSymbol === false ? 'none' : (firstInGroup.symbol || 'none'),
                },
            });
        }

        options.chartColors = regroupedColors;

        return {
            chartType: chartTypeArray,
            data: null,
            options,
            isCombo: true,
        };
    }

    // Single dash style — standard LINE chart with line-specific options
    const firstLine = lineSeries[0];
    if (firstLine?.lineStyle?.width) options.lineSize = firstLine.lineStyle.width;
    if (firstLine?.smooth) options.lineSmooth = true;

    if (firstLine?.lineStyle?.type) {
        options.lineDash = dashMap[firstLine.lineStyle.type] || 'solid';
    }

    if (firstLine?.showSymbol === false) {
        options.lineDataSymbol = 'none';
    } else if (firstLine?.symbol) {
        options.lineDataSymbol = firstLine.symbol;
    }
    if (firstLine?.symbolSize) {
        options.lineDataSymbolSize = firstLine.symbolSize;
    }

    return {
        chartType: pres.charts.LINE,
        data,
        options,
    };
}

function buildAreaChart(config, pres, detection) {
    const labels = extractCategoryLabels(config);
    if (labels.length === 0) return null;

    // Filter out area-mask series (shaded band fills) — rendered in annotation overlay PNG
    const data = config.series
        .filter(s => s.type === 'line' && !isAreaMaskSeries(s))
        .map(s => ({
            name: s.name || 'Series',
            labels,
            values: extractValues(s.data),
        }));

    if (data.length === 0) return null;

    const defaults = getStandardDefaults();
    const axisOpts = extractAxisOptions(config);
    const labelOpts = extractDataLabels(config);
    const legendOpts = extractLegendOptions(config);
    const chartColors = extractChartColors(config);

    // Area opacity
    const firstArea = config.series.find(s => s.type === 'line' && s.areaStyle);
    let opacity = undefined;
    if (firstArea?.areaStyle?.opacity !== undefined) {
        opacity = Math.round(firstArea.areaStyle.opacity * 100);
    }

    const options = {
        ...defaults,
        ...axisOpts,
        ...labelOpts,
        ...legendOpts,
        chartColors,
    };

    if (opacity !== undefined) {
        options.chartColorsOpacity = opacity;
    }

    if (detection.stacking === 'stacked') {
        options.barGrouping = 'stacked';
        // For stacked charts with markPoint annotations, set explicit axis max
        // so PptxGenJS and the markPoint coordinate mapper use the same Y range
        if (!options.valAxisMaxVal) {
            const numCats = data[0]?.values?.length || 0;
            let stackedMax = 0;
            for (let c = 0; c < numCats; c++) {
                let sum = 0;
                for (const d of data) sum += Math.abs(d.values?.[c] ?? 0);
                stackedMax = Math.max(stackedMax, sum);
            }
            if (stackedMax > 0) options.valAxisMaxVal = stackedMax;
        }
    }

    // Detect label scenarios that require annotation overlay delegation
    const hasPlaceholderLabels = config.series.some(
        s => isPlaceholderOrOutlineSeries(s) && hasVisibleLabels(s)
    );
    const hasPerItemFormatters = hasPerItemStaticFormatters(config);
    const hasMixedLabels = detectMixedLabelStyles(config);
    if (hasPlaceholderLabels || hasPerItemFormatters || hasMixedLabels) {
        options.showValue = false;
        options.showLabel = false;
        options.dataLabelFormatCode = ' ';  // Safety: suppress any leaked labels
    }

    return {
        chartType: pres.charts.AREA,
        data,
        options,
    };
}

function buildPieChart(config, pres, detection) {
    const pieSeries = config.series.find(s => s.type === 'pie');
    if (!pieSeries?.data || !Array.isArray(pieSeries.data)) return null;

    const labels = pieSeries.data.map(d => String(d.name || ''));
    const values = pieSeries.data.map(d => (typeof d === 'object' ? d.value : d) || 0);

    const data = [{ name: pieSeries.name || 'Data', labels, values }];

    const defaults = getStandardDefaults();
    const legendOpts = extractLegendOptions(config);
    const chartColors = extractChartColors(config);

    const options = {
        ...defaults,
        showLegend: false,
        ...legendOpts,
        chartColors,
    };

    // Pie/donut label handling — ECharts defaults to category names, not values
    const label = pieSeries.label;

    // Check for per-item static formatters (e.g., data[i].label.formatter = "151")
    // These are typically comma-formatted values — use showValue with number format
    const hasPiePerItemFormatters = pieSeries.data.some(d =>
        d && typeof d === 'object' && d.label?.formatter &&
        typeof d.label.formatter === 'string' && !d.label.formatter.includes('{')
    );

    if (hasPiePerItemFormatters) {
        // Per-item formatters are comma-formatted values → use native showValue
        options.showValue = true;
        options.dataLabelFormatCode = '#,##0';
        // Show legend so categories are identifiable (values alone aren't enough)
        options.showLegend = true;
        options.legendPos = 'b';
    } else if (label?.show === true || label?.show === undefined) {
        const formatter = label?.formatter;
        if (typeof formatter === 'string') {
            if (formatter.includes('{d}')) {
                options.showPercent = true;
            } else if (formatter.includes('{c}')) {
                options.showValue = true;
            } else if (formatter.includes('{b}') || !formatter.includes('{')) {
                options.showLabel = true;
            }
        } else {
            // No formatter: ECharts pie default is category name ({b})
            options.showLabel = true;
        }
    }

    if (label?.show !== false) {
        if (label?.fontSize) options.dataLabelFontSize = label.fontSize * 0.75; // px → pt
        if (label?.color) options.dataLabelColor = toPptxColor(label.color);
        if (label?.fontFamily) options.dataLabelFontFace = label.fontFamily;
        if (label?.fontWeight === 'bold') options.dataLabelFontBold = true;

        // Label position — PptxGenJS ignores dataLabelPosition for doughnut charts
        // and OOXML injection of <c:dLblPos> causes PowerPoint repair for doughnut.
        // Only set for PIE (not doughnut) — doughnut defaults to inside.
        if (label?.position === 'inside') {
            options.dataLabelPosition = 'ctr';
        }
    }

    return {
        chartType: pres.charts.PIE,
        data,
        options,
    };
}

function buildDoughnutChart(config, pres, detection) {
    const result = buildPieChart(config, pres, detection);
    if (!result) return null;

    result.chartType = pres.charts.DOUGHNUT;
    result.options.holeSize = detection.holeSize || 50;

    return result;
}

function buildScatterChart(config, pres, detection) {
    const scatterSeries = config.series.filter(s => s.type === 'scatter');
    if (scatterSeries.length === 0) return null;

    // Extract x,y points from each series
    const seriesPoints = scatterSeries.map(s => {
        const points = [];
        for (const point of (s.data || [])) {
            if (Array.isArray(point)) {
                points.push({ x: point[0], y: point[1] });
            } else if (point && typeof point === 'object') {
                const v = point.value || [point[0], point[1]];
                points.push({ x: v[0], y: v[1] });
            }
        }
        return { name: s.name || 'Series', points };
    });

    // Build unified X-axis: concatenate all X values across all series.
    // Each series' Y values are null-padded so its points align with its own X values.
    // This ensures multi-series scatter charts plot each point at its correct (x,y).
    const allX = [];
    for (const sp of seriesPoints) {
        for (const p of sp.points) allX.push(p.x);
    }

    const data = [{ name: 'X-Axis', values: allX }];
    let offset = 0;
    for (let i = 0; i < seriesPoints.length; i++) {
        const sp = seriesPoints[i];
        const yVals = new Array(allX.length).fill(null);
        for (let j = 0; j < sp.points.length; j++) {
            yVals[offset + j] = sp.points[j].y;
        }
        data.push({ name: sp.name, values: yVals });
        offset += sp.points.length;
    }
    const first = scatterSeries[0];

    const defaults = getStandardDefaults();
    const axisOpts = extractAxisOptions(config);
    const chartColors = extractChartColors(config);
    const legendOpts = extractLegendOptions(config);

    // Scatter symbol size from ECharts config (default 6pt)
    const symbolSize = first.symbolSize || 6;

    // Scatter x-axis min/max (extractAxisOptions doesn't set catAxisMinVal/MaxVal)
    const xAxis = Array.isArray(config.xAxis) ? config.xAxis[0] : config.xAxis;

    const yAxis = Array.isArray(config.yAxis) ? config.yAxis[0] : config.yAxis;

    // For scatter charts: axis LABELS may be hidden while axis LINES stay visible.
    // PptxGenJS's catAxisHidden hides everything (line+ticks+labels), so we keep axes
    // visible and track label-hidden state for OOXML patching (tickLblPos="none").
    const hideXLabels = xAxis?.axisLabel?.show === false;
    const hideYLabels = yAxis?.axisLabel?.show === false;

    // Scale ECharts symbolSize (diameter in CSS px) to PptxGenJS marker size (pt)
    const markerSize = typeof symbolSize === 'number'
        ? Math.max(2, Math.round(symbolSize * 0.55))
        : 6;

    const options = {
        ...defaults,
        ...axisOpts,
        ...legendOpts,
        chartColors,
        // Keep axes visible (for line + ticks), label hiding is done via OOXML patch
        valAxisHidden: false,
        catAxisHidden: false,
        // CRITICAL: PptxGenJS SCATTER connects points with lines by default
        // Must suppress lines and show dots only
        lineSize: 0,
        lineDataSymbol: 'circle',
        lineDataSymbolSize: markerSize,
    };

    // When axis labels are hidden, also make axis lines and ticks invisible.
    // The grid border (from overlay PNG) provides the chart box outline.
    // Axis titles are rendered as separate text boxes, not via PptxGenJS axis titles.
    if (hideXLabels) {
        options.catAxisLineShow = false;
        options.catAxisMajorTickMark = 'none';
        options.catAxisMinorTickMark = 'none';
    }
    if (hideYLabels) {
        options.valAxisLineShow = false;
        options.valAxisMajorTickMark = 'none';
        options.valAxisMinorTickMark = 'none';
    }

    // Scatter-specific: catAxis min/max (not set by extractAxisOptions for category axes)
    if (xAxis?.min !== undefined) options.catAxisMinVal = xAxis.min;
    if (xAxis?.max !== undefined) options.catAxisMaxVal = xAxis.max;

    // Axis titles for scatter charts: PptxGenJS scatter uses two <c:valAx> (no <c:catAx>),
    // so catAxisTitle is silently ignored. Pass titles as metadata for text box rendering.
    const axisTitles = {};
    if (xAxis?.name) {
        axisTitles.x = {
            text: xAxis.name,
            color: toPptxColor(xAxis.nameTextStyle?.color || '#333333'),
            fontSize: (xAxis.nameTextStyle?.fontSize || 10) * 0.75,
            bold: xAxis.nameTextStyle?.fontWeight === 'bold',
            italic: xAxis.nameTextStyle?.fontStyle === 'italic',
        };
    }
    if (yAxis?.name) {
        axisTitles.y = {
            text: yAxis.name,  // keep \n line breaks for text box rendering
            color: toPptxColor(yAxis.nameTextStyle?.color || '#333333'),
            fontSize: (yAxis.nameTextStyle?.fontSize || 10) * 0.75,
            bold: yAxis.nameTextStyle?.fontWeight === 'bold',
            italic: yAxis.nameTextStyle?.fontStyle === 'italic',
        };
    }

    // Extract markArea data for native rendering (quadrant fills, background zones)
    const markAreaData = [];
    for (const s of scatterSeries) {
        if (!s.markArea?.data?.length) continue;
        for (const pair of s.markArea.data) {
            if (!Array.isArray(pair) || pair.length !== 2) continue;
            const [p1, p2] = pair;
            markAreaData.push({
                x1: p1.xAxis ?? xAxis?.min ?? 0,
                y1: p1.yAxis ?? yAxis?.min ?? 0,
                x2: p2.xAxis ?? xAxis?.max ?? 100,
                y2: p2.yAxis ?? yAxis?.max ?? 100,
                color: p2.itemStyle?.color || p1.itemStyle?.color || 'rgba(200,200,200,0.15)',
            });
        }
    }

    // Extract scatter point labels (country names, etc.) as positioned text boxes
    // Reuses bubbleLabels mechanism in html2pptx.mjs for rendering
    const scatterLabels = [];
    for (const s of scatterSeries) {
        const label = s.label;
        if (!label?.show) continue;
        const sSymbolSize = s.symbolSize || symbolSize;
        for (const point of (s.data || [])) {
            if (!point || typeof point !== 'object') continue;
            const v = point.value || [point[0], point[1]];
            const name = point.name || '';
            if (!name) continue;
            // Resolve label text from formatter
            let text = name;
            if (typeof label.formatter === 'string') {
                text = label.formatter.replace('{b}', name).replace('{c}', String(v[1]));
            }
            const ptLabel = point.label || {};
            scatterLabels.push({
                x: v[0], y: v[1],
                size: sSymbolSize,
                text,
                position: ptLabel.position || label.position || 'right',
                fontSize: ptLabel.fontSize || label.fontSize || 10,
                fontWeight: ptLabel.fontWeight || label.fontWeight || 'normal',
                color: ptLabel.color || label.color || '#333333',
            });
        }
    }

    return {
        chartType: pres.charts.SCATTER,
        data,
        options,
        bubbleLabels: scatterLabels.length > 0 ? scatterLabels : null,
        // Flags for OOXML patching: hide axis labels while keeping lines/ticks visible
        hideXAxisLabels: hideXLabels || false,
        hideYAxisLabels: hideYLabels || false,
        // Scatter-specific metadata for text box rendering (not PptxGenJS options)
        scatterAxisTitles: (axisTitles.x || axisTitles.y) ? axisTitles : null,
        scatterMarkArea: markAreaData.length > 0 ? markAreaData : null,
    };
}

function buildBubbleChart(config, pres, detection) {
    const scatterSeries = config.series.filter(s => s.type === 'scatter');
    if (scatterSeries.length === 0) return null;

    // Extract points + labels from each series
    const seriesPoints = scatterSeries.map(s => {
        const points = [];
        const seriesLabel = s.label || {};
        for (const d of (s.data || [])) {
            let x, y, size, label = null;
            if (Array.isArray(d)) {
                x = d[0]; y = d[1]; size = d[2] || 1;
            } else if (d && typeof d === 'object') {
                const v = d.value || [0, 0];
                x = v[0]; y = v[1]; size = d.symbolSize || v[2] || 1;
                // Extract label from per-point or series-level config
                const lbl = d.label || {};
                const show = lbl.show !== undefined ? lbl.show : seriesLabel.show;
                if (show !== false && (lbl.formatter || seriesLabel.formatter)) {
                    const formatter = lbl.formatter || seriesLabel.formatter;
                    if (typeof formatter === 'string' && !formatter.includes('{')) {
                        label = {
                            text: formatter.replace(/-\n/g, '-').replace(/\n/g, ' ').trim(),
                            position: lbl.position || seriesLabel.position || 'top',
                            fontSize: lbl.fontSize || seriesLabel.fontSize || 10,
                            color: lbl.color || seriesLabel.color || '#333333',
                        };
                    }
                }
            }
            if (x !== undefined && y !== undefined) points.push({ x, y, size, label });
        }
        return { name: s.name || 'Series', points };
    });

    // Scale factor: ECharts symbolSize is pixel diameter; PptxGenJS sizes are relative.
    // Scale down to avoid oversized bubbles (empirically ~0.3× matches ECharts visual)
    const BUBBLE_SCALE = 0.3;

    // Build unified X-axis: all x values across all series (in order)
    const allX = [];
    const bubbleLabels = [];
    for (const sp of seriesPoints) {
        for (const p of sp.points) {
            allX.push(p.x);
            if (p.label) {
                bubbleLabels.push({ x: p.x, y: p.y, size: p.size, ...p.label });
            }
        }
    }

    // Build PptxGenJS BUBBLE data: shared X-axis + per-series Y + sizes with null padding
    const data = [{ name: 'X-Axis', values: allX }];
    let offset = 0;
    for (const sp of seriesPoints) {
        const yVals = new Array(allX.length).fill(null);
        const sizeVals = new Array(allX.length).fill(null);
        for (let i = 0; i < sp.points.length; i++) {
            yVals[offset + i] = sp.points[i].y;
            sizeVals[offset + i] = Math.round(sp.points[i].size * BUBBLE_SCALE);
        }
        data.push({ name: sp.name, values: yVals, sizes: sizeVals });
        offset += sp.points.length;
    }

    const defaults = getStandardDefaults();
    const axisOpts = extractAxisOptions(config);
    const chartColors = extractChartColors(config);
    const legendOpts = extractLegendOptions(config);

    const xAxis = Array.isArray(config.xAxis) ? config.xAxis[0] : config.xAxis;
    const yAxis = Array.isArray(config.yAxis) ? config.yAxis[0] : config.yAxis;

    // Detect hidden axis labels (same pattern as buildScatterChart)
    const hideXLabels = xAxis?.axisLabel?.show === false;
    const hideYLabels = yAxis?.axisLabel?.show === false;

    const options = {
        ...defaults,
        ...axisOpts,
        ...legendOpts,
        chartColors,
        valAxisHidden: false,
        catAxisHidden: false,
    };

    // When axis labels are hidden, also hide axis lines and ticks
    if (hideXLabels) {
        options.catAxisLineShow = false;
        options.catAxisMajorTickMark = 'none';
        options.catAxisMinorTickMark = 'none';
    }
    if (hideYLabels) {
        options.valAxisLineShow = false;
        options.valAxisMajorTickMark = 'none';
        options.valAxisMinorTickMark = 'none';
    }

    // Bubble-specific: axis min/max
    if (xAxis?.min !== undefined) options.catAxisMinVal = xAxis.min;
    if (xAxis?.max !== undefined) options.catAxisMaxVal = xAxis.max;

    return {
        chartType: pres.charts.BUBBLE,
        data,
        options,
        bubbleLabels: bubbleLabels.length > 0 ? bubbleLabels : null,
        hideXAxisLabels: hideXLabels || false,
        hideYAxisLabels: hideYLabels || false,
    };
}

function buildRadarChart(config, pres, detection) {
    const radarSeries = config.series.filter(s => s.type === 'radar');
    if (radarSeries.length === 0) return null;

    // Radar indicator names as labels
    const radar = config.radar || {};
    const indicators = radar.indicator || [];
    const labels = indicators.map(ind => ind.name || ind.text || '');

    const data = radarSeries.map(s => {
        const values = s.data?.[0]?.value || s.data || [];
        return {
            name: s.data?.[0]?.name || s.name || 'Series',
            labels,
            values: Array.isArray(values) ? values : [],
        };
    });

    const defaults = getStandardDefaults();
    const chartColors = extractChartColors(config);

    const options = {
        showLegend: false,
        chartColors,
        radarStyle: 'standard',
    };

    return {
        chartType: pres.charts.RADAR,
        data,
        options,
    };
}

function buildComboChart(config, pres, detection, dims) {
    const labels = extractCategoryLabels(config);
    if (labels.length === 0) return null;

    // Include dashed-border series with data (they get OOXML patching for noFill + dashed border)
    const barSeries = config.series.filter(s => s.type === 'bar' &&
        (!isPlaceholderOrOutlineSeries(s) || (s.itemStyle?.borderType === 'dashed' && Array.isArray(s.data) && s.data.length > 0))
    );
    const lineSeries = config.series.filter(s => s.type === 'line');

    if (barSeries.length === 0 && lineSeries.length === 0) return null;

    const defaults = getStandardDefaults();
    const axisOpts = extractAxisOptions(config);
    const labelOpts = extractDataLabels(config);
    const legendOpts = extractLegendOptions(config);

    // Collect all colors
    const allColors = [];
    const defaultColors = getChartColors();
    let colorIdx = 0;
    const dashedSeriesIndices = [];

    // Build combo chart array
    const chartTypeArray = [];

    if (barSeries.length > 0) {
        const barColors = [];
        const barData = barSeries.map((s, idx) => {
            const isDashed = isPlaceholderOrOutlineSeries(s) && s.itemStyle?.borderType === 'dashed';
            if (isDashed) {
                barColors.push('FFFFFF'); // white fill — OOXML will patch to noFill + dashed
                dashedSeriesIndices.push(colorIdx);
            } else {
                const color = s.itemStyle?.color || defaultColors[colorIdx % defaultColors.length];
                barColors.push(toPptxColor(color));
            }
            allColors.push(barColors[barColors.length - 1]);
            colorIdx++;
            return {
                name: s.name || 'Bar Series',
                labels,
                values: extractValues(s.data),
            };
        });

        chartTypeArray.push({
            type: pres.charts.BAR,
            data: barData,
            options: {
                barDir: detection.orientation === 'horizontal' ? 'bar' : 'col',
                barGrouping: detection.stacking === 'stacked' ? 'stacked' : 'clustered',
                chartColors: barColors,
            },
        });
    }

    if (lineSeries.length > 0) {
        // Group line series by dash style (same pattern as buildLineChart's dashGroups)
        // so solid and dashed lines render with distinct line styles in the combo chart
        const dashMap = { 'solid': 'solid', 'dashed': 'dash', 'dotted': 'sysDot' };
        const lineDashGroups = new Map();
        for (const s of lineSeries) {
            const dash = dashMap[s.lineStyle?.type || 'solid'] || 'solid';
            if (!lineDashGroups.has(dash)) lineDashGroups.set(dash, []);
            lineDashGroups.get(dash).push(s);
        }

        for (const [dash, group] of lineDashGroups) {
            const groupColors = [];
            const groupData = group.map(s => {
                const color = s.itemStyle?.color || s.lineStyle?.color || defaultColors[colorIdx % defaultColors.length];
                groupColors.push(toPptxColor(color));
                allColors.push(groupColors[groupColors.length - 1]);
                colorIdx++;
                return {
                    name: s.name || 'Line Series',
                    labels,
                    values: extractValues(s.data),
                };
            });

            const firstInGroup = group[0];
            const lineOpts = {
                secondaryValAxis: true,
                secondaryValAxisHidden: firstInGroup?.yAxisIndex !== undefined ? false : true,
                lineDash: dash,
                lineSize: firstInGroup?.lineStyle?.width || 2,
                lineDataSymbol: firstInGroup?.showSymbol === false ? 'none' : (firstInGroup?.symbol || 'circle'),
                chartColors: groupColors,
            };
            if (firstInGroup?.symbolSize) lineOpts.lineDataSymbolSize = firstInGroup.symbolSize;

            chartTypeArray.push({
                type: pres.charts.LINE,
                data: groupData,
                options: lineOpts,
            });
        }
    }

    const options = {
        ...defaults,
        ...axisOpts,
        ...labelOpts,
        ...legendOpts,
        chartColors: allColors,
    };

    // PptxGenJS combo API: addChart(chartTypeArray, null, sharedOpts)
    // chartTypeArray items already contain { type, data, options }
    return {
        chartType: chartTypeArray,
        data: null,
        options,
        isCombo: true,
        dashedSeriesIndices,
    };
}

/**
 * Build line series with [[x,y]] data as a SCATTER combo chart.
 * Each series gets its own SCATTER entry to avoid PptxGenJS's shared-X-values constraint.
 * Lines are drawn by setting lineSize > 0 and lineDataSymbol = 'none'.
 */
function buildLineAsScatter(config, pres, lineSeries, baseOptions) {
    // OOXML prstDash: 'sysDash' gives shorter dashes (3:1) closer to ECharts "dashed" look
    const prstDashMap = { 'solid': 'solid', 'dashed': 'sysDash', 'dotted': 'sysDot' };
    const PT_PER_PX = 0.75;  // ECharts lineStyle.width is in CSS px; OOXML needs pt
    const defaultColors = getChartColors();
    // Full per-series metadata — we'll rebuild all <c:ser> in OOXML post-processing
    // because PptxGenJS combo scatter creates 2N series (X+Y per entry) with shared X column.
    const scatterSeriesMeta = [];

    for (let i = 0; i < lineSeries.length; i++) {
        const s = lineSeries[i];
        const xValues = [];
        const yValues = [];

        if (Array.isArray(s.data)) {
            for (const point of s.data) {
                if (Array.isArray(point)) {
                    xValues.push(point[0]);
                    yValues.push(point[1]);
                } else if (point && typeof point === 'object') {
                    const v = point.value || [point[0], point[1]];
                    xValues.push(v[0]);
                    yValues.push(v[1]);
                }
            }
        }

        if (xValues.length === 0) continue;

        const seriesName = s.name || `Series ${i + 1}`;
        const color = toPptxColor(s.itemStyle?.color || s.lineStyle?.color || defaultColors[i % defaultColors.length] || '#4472C4');
        const lineWidthPx = s.lineStyle?.width || 2;
        const showSymbol = s.showSymbol !== false && s.symbol !== 'none';

        scatterSeriesMeta.push({
            name: seriesName,
            color,
            dash: prstDashMap[s.lineStyle?.type || 'solid'] || 'solid',
            lineWidthEmu: Math.round(lineWidthPx * PT_PER_PX * 12700),
            showSymbol,
            xValues: [...xValues],
            yValues: [...yValues],
        });
    }

    if (scatterSeriesMeta.length === 0) return null;

    // Build a SINGLE scatter chart as scaffold — PptxGenJS creates the axes/grid/layout.
    // We'll replace all <c:ser> blocks in OOXML post-processing with correct per-series data.
    const longestSeries = scatterSeriesMeta.reduce((a, b) => a.xValues.length > b.xValues.length ? a : b);
    const scaffoldData = [
        { name: 'X', values: longestSeries.xValues },
        { name: longestSeries.name, values: longestSeries.yValues },
    ];

    baseOptions.chartColors = scatterSeriesMeta.map(m => m.color);
    baseOptions.catAxisHidden = false;
    baseOptions.valAxisHidden = false;
    baseOptions.lineDataSymbol = 'none';
    baseOptions.lineDataSymbolSize = 0;

    // Apply axis bounds from config
    const xAxis = Array.isArray(config.xAxis) ? config.xAxis[0] : config.xAxis;
    const yAxis = Array.isArray(config.yAxis) ? config.yAxis[0] : config.yAxis;
    if (xAxis?.min !== undefined) baseOptions.catAxisMinVal = xAxis.min;
    if (xAxis?.max !== undefined) baseOptions.catAxisMaxVal = xAxis.max;
    if (yAxis?.min !== undefined) baseOptions.valAxisMinVal = yAxis.min;
    if (yAxis?.max !== undefined) baseOptions.valAxisMaxVal = yAxis.max;

    // Axis lines
    if (xAxis?.axisLine?.show) baseOptions.catAxisLineShow = true;
    if (yAxis?.axisLine?.show) baseOptions.valAxisLineShow = true;

    // Gridlines
    if (xAxis?.splitLine?.show) {
        baseOptions.catGridLine = mapGridLine(xAxis.splitLine);
    }
    if (yAxis?.splitLine?.show) {
        baseOptions.valGridLine = mapGridLine(yAxis.splitLine);
    }

    return {
        chartType: pres.charts.SCATTER,
        data: scaffoldData,
        options: baseOptions,
        scatterSeriesMeta,  // full rebuild in OOXML post-processing
    };
}

/**
 * Build scatter + line trend combo: scatter dots with trend/reference lines.
 * Uses scatterSeriesMeta for full OOXML rebuild (same approach as buildLineAsScatter)
 * because PptxGenJS combo scatter shares X values across series, scrambling coordinates.
 */
function buildScatterLineCombo(config, pres) {
    const prstDashMap = { 'solid': 'solid', 'dashed': 'sysDash', 'dotted': 'sysDot' };
    const PT_PER_PX = 0.75;
    const defaultColors = getChartColors();
    const scatterSeriesMeta = [];

    const defaults = getStandardDefaults();
    const axisOpts = extractAxisOptions(config);
    const legendOpts = extractLegendOptions(config);

    let colorIdx = 0;
    for (const s of config.series || []) {
        const data = s.data || [];
        const xValues = [], yValues = [];

        for (const pt of data) {
            if (Array.isArray(pt)) {
                xValues.push(pt[0]);
                yValues.push(pt[1]);
            } else if (pt && typeof pt === 'object' && pt.value) {
                xValues.push(pt.value[0]);
                yValues.push(pt.value[1]);
            } else if (pt && typeof pt === 'object') {
                xValues.push(pt[0]);
                yValues.push(pt[1]);
            }
        }

        if (xValues.length === 0) continue;

        const color = toPptxColor(
            s.itemStyle?.color || s.lineStyle?.color || defaultColors[colorIdx % defaultColors.length] || '4472C4'
        );
        colorIdx++;

        if (s.type === 'scatter') {
            const symbolSize = typeof s.symbolSize === 'number' ? s.symbolSize : 8;
            // Map ECharts symbolSize (diameter in px) to OOXML marker size (2–72 pt)
            const markerSize = Math.max(2, Math.min(72, Math.round(symbolSize * 0.6)));
            const opacity = s.itemStyle?.opacity ?? 1;

            scatterSeriesMeta.push({
                name: s.name || `Scatter ${colorIdx}`,
                color,
                dash: 'solid',
                lineWidthEmu: 0, // no connecting line — dots only
                showSymbol: true,
                markerSize,
                opacity,
                xValues: [...xValues],
                yValues: [...yValues],
            });
        } else if (s.type === 'line') {
            const lineWidthPx = s.lineStyle?.width || 2;
            scatterSeriesMeta.push({
                name: s.name || `Line ${colorIdx}`,
                color,
                dash: prstDashMap[s.lineStyle?.type || 'solid'] || 'solid',
                lineWidthEmu: Math.round(lineWidthPx * PT_PER_PX * 12700),
                showSymbol: s.showSymbol !== false && s.symbol !== 'none',
                xValues: [...xValues],
                yValues: [...yValues],
            });
        }
    }

    if (scatterSeriesMeta.length === 0) return null;

    // Build scaffold data from longest series — PptxGenJS creates axes/grid/layout,
    // then OOXML post-processing replaces all <c:ser> blocks with correct per-series data.
    const longestSeries = scatterSeriesMeta.reduce((a, b) => a.xValues.length > b.xValues.length ? a : b);
    const scaffoldData = [
        { name: 'X', values: longestSeries.xValues },
        { name: longestSeries.name, values: longestSeries.yValues },
    ];

    const options = {
        ...defaults,
        ...axisOpts,
        ...legendOpts,
        chartColors: scatterSeriesMeta.map(m => m.color),
        catAxisHidden: false,
        valAxisHidden: false,
    };

    // Apply axis bounds
    const xAxis = Array.isArray(config.xAxis) ? config.xAxis[0] : config.xAxis;
    const yAxis = Array.isArray(config.yAxis) ? config.yAxis[0] : config.yAxis;
    if (xAxis?.min !== undefined) options.catAxisMinVal = xAxis.min;
    if (xAxis?.max !== undefined) options.catAxisMaxVal = xAxis.max;
    if (yAxis?.min !== undefined) options.valAxisMinVal = yAxis.min;
    if (yAxis?.max !== undefined) options.valAxisMaxVal = yAxis.max;

    // Axis lines
    if (xAxis?.axisLine?.show) options.catAxisLineShow = true;
    if (yAxis?.axisLine?.show) options.valAxisLineShow = true;

    // Gridlines
    if (xAxis?.splitLine?.show) options.catGridLine = mapGridLine(xAxis.splitLine);
    if (yAxis?.splitLine?.show) options.valGridLine = mapGridLine(yAxis.splitLine);

    return {
        chartType: pres.charts.SCATTER,
        data: scaffoldData,
        options,
        scatterSeriesMeta,  // full rebuild in OOXML post-processing
    };
}
