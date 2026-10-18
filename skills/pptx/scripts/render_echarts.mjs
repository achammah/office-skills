#!/usr/bin/env node
/**
 * ECharts SVG Server-Side Renderer
 *
 * Takes an ECharts configuration JSON and renders it to SVG string.
 * Uses ECharts SSR mode (no canvas/DOM dependency).
 *
 * IMPORTANT: Automatically applies branding-defined style defaults:
 * - No gridlines, axis lines, or tick marks
 * - Clean fonts from branding config
 * - Y-axis labels hidden (values shown on bars instead)
 * - Animation disabled
 *
 * Branding can be switched via PPTX_BRAND environment variable.
 * Agent configs can override any defaults by specifying them explicitly.
 *
 * Usage: node render_echarts.mjs <config.json> [width] [height]
 *
 * Input: Full ECharts configuration object (ECBasicOption)
 * Output: SVG string to stdout
 */

import * as echarts from 'echarts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import branding utilities
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic import of branding module (relative to this script)
import {
    loadBranding,
    getBranding,
    getEChartsDefaults,
    getColor,
    getFont,
    getFontSize,
    getChartColors
} from '../branding/branding.mjs';

// Import shared style pipeline functions (extracted for reuse by echarts-to-pptxgen.mjs)
import {
    isHorizontalChart,
    isDivergingChart,
    isComboChart,
    isPureLineChart,
    isPlaceholderOrOutlineSeries,
    countVisibleStackedSeries,
    isTopOfStack,
    isStackedSeries,
    stackHasPlaceholder,
    getDefaultLabelPosition,
    hasDataItemLabels,
    hasExistingRightLabels,
    gridUsesPixelValues,
    MCKINSEY_AXIS_DEFAULTS,
    CSS_VAR_TO_COLOR_PATH,
    resolveCssVariable,
    resolveAllCssVariables,
    resolveSeriesCssVariables,
    deepMerge,
    getMcKinseyDefaults,
    applyAxisArrayDefaults,
    applyDefaultLabels,
    applyColorSequence,
    applyBrandingNumberFormat,
    enforceMinimumFontSizes,
} from './chart-style-pipeline.mjs';

// Load branding configuration (defaults to 'mckinsey', can be overridden via env var)
const brandId = process.env.PPTX_BRAND || 'mckinsey';
loadBranding(brandId);

// Log ECharts version for debugging
console.error(`[echarts] version=${echarts.version || 'unknown'}`);

// Fail-fast: require ECharts 6.x+ (needed for axis breaks API)
(function checkEChartsVersion() {
    const version = echarts.version;
    if (!version) {
        console.error('[echarts] WARNING: Could not determine ECharts version. Axis breaks may not work.');
        return;
    }
    const major = parseInt(version.split('.')[0], 10);
    if (isNaN(major) || major < 6) {
        console.error(`[echarts] FATAL: ECharts ${version} detected, but 6.x+ is required for axis breaks.`);
        console.error('[echarts] To fix: cd skills/pptx && npm install echarts@latest');
        process.exit(1);
    }
})();

// ═══════════════════════════════════════════════════════════════════════════════
// CHART LABEL ALIGNMENT CONSTANTS
// Universal constants for consistent label-to-title alignment across all chart types.
// The chart title must ALWAYS align with the leftmost edge of the category labels.
// ═══════════════════════════════════════════════════════════════════════════════
const LABEL_START_X = 8;        // Labels start 8px from left edge (for horizontal charts)
const GAP_AFTER_LABELS = 8;     // Gap between labels and chart area
const MAX_LABEL_WIDTH = 150;    // Maximum width before text wrapping (in pixels)
const MAX_LABEL_LINES = 2;      // Maximum lines for wrapped text

// ═══════════════════════════════════════════════════════════════════════════════
// ANNOTATION DEFAULTS — Brand styling for graphic, markLine, markPoint, markArea
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Apply brand defaults to a single ECharts graphic element (recursive for groups).
 * NEVER overrides explicit values — only fills in missing defaults.
 */
function applyGraphicElementDefaults(el) {
    if (!el || typeof el !== 'object') return;
    el.style = el.style || {};

    if (el.type === 'text') {
        if (!el.style.font) el.style.font = `${getFontSize('dataLabel')}px ${getFont('data')}`;
        if (!el.style.fill) el.style.fill = getColor('text.body');
    }
    if (el.type === 'rect') {
        if (!el.style.stroke) el.style.stroke = getColor('secondary.blueDark');
        if (el.style.lineWidth === undefined) el.style.lineWidth = 1.5;
    }
    // Before recursing into group children, classify leader lines:
    // Lines inside callout groups (groups with both rect + line) are leader lines
    if (el.type === 'group' && el.children && Array.isArray(el.children)) {
        const hasRect = el.children.some(c => c.type === 'rect');
        const hasPolygon = el.children.some(c => c.type === 'polygon');
        if (hasRect) {
            el.children.forEach(c => {
                // Lines in groups with rect = leader lines (grey dashed)
                // EXCEPTION: lines in groups with polygon = structural indicators (delta pill)
                if (c.type === 'line' && !hasPolygon) c._isLeaderLine = true;
            });
        }
    }
    if (el.type === 'line') {
        if (!el.style.stroke) {
            el.style.stroke = el._isLeaderLine
                ? getColor('gray.dark')           // grey — visually distinct from data
                : getColor('secondary.blueDark'); // brand blue — structural lines
        }
        if (el.style.lineWidth === undefined) el.style.lineWidth = 1;
        if (!el.style.lineDash && el._isLeaderLine) el.style.lineDash = [4, 3];
    }
    // Recurse into group children
    if (el.children && Array.isArray(el.children)) {
        el.children.forEach(child => applyGraphicElementDefaults(child));
    }
}

/**
 * Apply brand defaults to markLine configuration.
 */
function applyMarkLineDefaults(markLine) {
    if (!markLine) return;
    markLine.lineStyle = markLine.lineStyle || {};
    if (!markLine.lineStyle.color) markLine.lineStyle.color = getColor('gray.dark');
    if (!markLine.lineStyle.type) markLine.lineStyle.type = 'dashed';
    if (markLine.lineStyle.width === undefined) markLine.lineStyle.width = 1.5;
    markLine.label = markLine.label || {};
    if (!markLine.label.fontFamily) markLine.label.fontFamily = getFont('data');
    if (!markLine.label.fontSize) markLine.label.fontSize = getFontSize('footnote');
    if (!markLine.label.color) markLine.label.color = getColor('text.body');
    if (markLine.label.rotate === undefined) markLine.label.rotate = 0;
    if (markLine.symbol === undefined) markLine.symbol = 'none';
    // Walk data-point labels (e.g., pill badge on vertical arrow)
    if (Array.isArray(markLine.data)) {
        markLine.data.forEach(item => {
            const points = Array.isArray(item) ? item : [item];
            points.forEach(pt => {
                if (pt && pt.label) {
                    if (pt.label.rotate === undefined) {
                        pt.label.rotate = 0;
                    }
                    // v5.0: Pill centering defaults for labels with backgroundColor
                    if (pt.label.backgroundColor) {
                        // Expand 2-value padding [top/bottom, left/right] to 4-value [t, r, b, l]
                        if (Array.isArray(pt.label.padding) && pt.label.padding.length === 2) {
                            const [tb, lr] = pt.label.padding;
                            pt.label.padding = [tb, lr, tb, lr];
                        }
                        // Set lineHeight = fontSize for single-line pills (prevents vertical drift)
                        if (pt.label.fontSize && pt.label.lineHeight === undefined) {
                            pt.label.lineHeight = pt.label.fontSize;
                        }
                        // Explicit horizontal centering
                        if (pt.label.align === undefined) {
                            pt.label.align = 'center';
                        }
                    }
                }
            });
        });
    }
}

/**
 * Apply brand defaults to markPoint configuration.
 */
function applyMarkPointDefaults(markPoint) {
    if (!markPoint) return;
    markPoint.label = markPoint.label || {};
    if (!markPoint.label.fontFamily) markPoint.label.fontFamily = getFont('data');
    if (!markPoint.label.fontSize) markPoint.label.fontSize = getFontSize('dataLabel');
    if (!markPoint.label.color) markPoint.label.color = getColor('text.body');
    if (markPoint.label.rotate === undefined) markPoint.label.rotate = 0;
}

/**
 * Apply brand defaults to markArea configuration.
 */
function applyMarkAreaDefaults(markArea) {
    if (!markArea) return;
    markArea.itemStyle = markArea.itemStyle || {};
    if (!markArea.itemStyle.color) {
        const baseColor = getColor('surface.light');
        // Apply 20% opacity via rgba conversion
        if (baseColor && baseColor.startsWith('#') && baseColor.length === 7) {
            const r = parseInt(baseColor.slice(1, 3), 16);
            const g = parseInt(baseColor.slice(3, 5), 16);
            const b = parseInt(baseColor.slice(5, 7), 16);
            markArea.itemStyle.color = `rgba(${r},${g},${b},0.2)`;
        } else {
            markArea.itemStyle.color = baseColor;
        }
    }
    if (!markArea.itemStyle.borderColor) markArea.itemStyle.borderColor = getColor('secondary.blueMedium');
    if (markArea.itemStyle.borderWidth === undefined) markArea.itemStyle.borderWidth = 1.5;
    markArea.label = markArea.label || {};
    if (!markArea.label.fontFamily) markArea.label.fontFamily = getFont('data');
    if (markArea.label.rotate === undefined) markArea.label.rotate = 0;
}

/**
 * Process $callouts directive on series — converts declarative callout
 * annotations into ECharts label + labelLayout + labelLine configuration.
 *
 * Agent writes: series[i].$callouts = [{ dataIndex, text, position, offsetX, offsetY, style, lineStyle }]
 * Pipeline generates: label.formatter, labelLayout callback, labelLine config.
 *
 * Called AFTER applyColorSequence() (CSS vars resolved) and BEFORE applyAnnotationDefaults().
 */
function processCallouts(config) {
    if (!config.series || !Array.isArray(config.series)) return config;

    config.series.forEach((series, seriesIdx) => {
        if (!series.$callouts || !Array.isArray(series.$callouts)) return;

        const callouts = [...series.$callouts];
        delete series.$callouts;

        // SSR fix: labelLayout requires renderable symbols to provide params.rect.
        // If symbol is "none", labels won't render. Use tiny invisible circles instead.
        if (series.symbol === 'none' || series.showSymbol === false) {
            series.symbol = 'circle';
            series.symbolSize = 1;
            series.showSymbol = true;
            console.error(`  [callouts] Fixed symbol: "none" → "circle" size=1 (required for labelLayout in SSR)`);
        }

        // Build a Set for fast lookup
        const calloutMap = new Map();
        callouts.forEach(c => calloutMap.set(c.dataIndex, c));

        // 1. Configure label with formatter
        series.label = series.label || {};
        series.label.show = true;
        // Store callout data for the formatter string
        // ECharts JSON config can't have real functions — use a formatter string
        // that shows text for callout indices. For non-callout points, use empty label.
        // We build a rich-text formatter approach: each callout gets its own rich style key.
        const richStyles = {};
        const defaultStyle = {
            backgroundColor: callouts[0]?.style?.backgroundColor || getColor('background.primary'),
            borderColor: callouts[0]?.style?.borderColor || getColor('primary.navy'),
            borderWidth: callouts[0]?.style?.borderWidth || 1,
            padding: callouts[0]?.style?.padding || [5, 8],
            color: callouts[0]?.style?.color || getColor('text.body'),
            fontSize: callouts[0]?.style?.fontSize || 9,
            lineHeight: callouts[0]?.style?.lineHeight || 13,
            width: callouts[0]?.style?.width || 140,
            fontFamily: getFont('body')
        };

        // Apply per-callout styles via rich text
        callouts.forEach((c, idx) => {
            const key = `callout${idx}`;
            richStyles[key] = {
                backgroundColor: c.style?.backgroundColor || defaultStyle.backgroundColor,
                borderColor: c.style?.borderColor || defaultStyle.borderColor,
                borderWidth: c.style?.borderWidth || defaultStyle.borderWidth,
                padding: c.style?.padding || defaultStyle.padding,
                color: c.style?.color || defaultStyle.color,
                fontSize: c.style?.fontSize || defaultStyle.fontSize,
                lineHeight: c.style?.lineHeight || defaultStyle.lineHeight,
                width: c.style?.width || defaultStyle.width,
                fontFamily: defaultStyle.fontFamily,
                align: 'left',
                overflow: 'break'
            };
        });

        // Build formatter function as string (ECharts evaluates it)
        // We use a direct label approach: set label per data item
        if (Array.isArray(series.data)) {
            series.data = series.data.map((item, idx) => {
                const c = calloutMap.get(idx);
                if (!c) {
                    // Non-callout point: keep original data, hide label
                    if (typeof item === 'object' && item !== null) {
                        return { ...item, label: { show: false } };
                    }
                    return { value: item, label: { show: false } };
                }
                // Callout point: attach label with styling
                const calloutIdx = callouts.indexOf(c);
                const dataObj = typeof item === 'object' && item !== null ? { ...item } : { value: item };
                dataObj.label = {
                    show: true,
                    formatter: c.text,
                    backgroundColor: richStyles[`callout${calloutIdx}`].backgroundColor,
                    borderColor: richStyles[`callout${calloutIdx}`].borderColor,
                    borderWidth: richStyles[`callout${calloutIdx}`].borderWidth,
                    padding: richStyles[`callout${calloutIdx}`].padding,
                    color: richStyles[`callout${calloutIdx}`].color,
                    fontSize: richStyles[`callout${calloutIdx}`].fontSize,
                    lineHeight: richStyles[`callout${calloutIdx}`].lineHeight,
                    width: richStyles[`callout${calloutIdx}`].width,
                    fontFamily: richStyles[`callout${calloutIdx}`].fontFamily,
                    align: 'left',
                    overflow: 'break',
                    distance: 5
                };
                return dataObj;
            });
        }

        // 2. Configure labelLayout for positioning (as string for JSON serialisation)
        // Build a lookup table for the layout callback — enriched with box dims for leader lines
        const layoutEntries = callouts.map(c => {
            const offX = c.offsetX !== undefined ? c.offsetX : (c.position === 'left' ? -200 : 160);
            const offY = c.offsetY !== undefined ? c.offsetY : 0;
            const pad = c.style?.padding || defaultStyle.padding;
            const hPad = Array.isArray(pad) ? (pad[1] || 8) : (typeof pad === 'number' ? pad : 8);
            const vPad = Array.isArray(pad) ? (pad[0] || 5) : (typeof pad === 'number' ? pad : 5);
            const contentW = c.style?.width || defaultStyle.width;
            const lh = c.style?.lineHeight || defaultStyle.lineHeight;
            const textLines = (c.text || '').split('\n').length;
            const totalW = contentW + 2 * hPad;
            const totalH = textLines * lh + 2 * vPad;
            // Warn if offsetX would likely place callout outside visible area
            if (Math.abs(offX) > 400) {
                console.warn(`  [callouts] WARNING: offsetX=${offX} on series[${seriesIdx}] ` +
                    `callout[${c.dataIndex}] — large offset may place box outside chart. ` +
                    `Ensure grid.left or grid.right is ≥170px to create callout zone.`);
            }
            // Check if grid margins are adequate for callout placement
            const gridRight = config.grid?.right;
            const gridLeft = config.grid?.left;
            if (c.position === 'left' && typeof gridLeft === 'number' && gridLeft < totalW) {
                console.warn(`  [callouts] WARNING: grid.left=${gridLeft} < callout width=${totalW}px. ` +
                    `Callout box will overlap data area. Set grid.left ≥ ${totalW + 30}px.`);
            }
            if (c.position === 'right' && typeof gridRight === 'number' && gridRight < totalW) {
                console.warn(`  [callouts] WARNING: grid.right=${gridRight} < callout width=${totalW}px. ` +
                    `Callout box will overlap data area. Set grid.right ≥ ${totalW + 30}px.`);
            }
            const lineColor = c.lineStyle?.color || getColor('gray.dark');
            const bgColor = c.style?.backgroundColor || defaultStyle.backgroundColor;
            const borderColor = c.style?.borderColor || defaultStyle.borderColor;
            return { dataIndex: c.dataIndex, position: c.position || 'left', offX, offY,
                     totalW, totalH, lineColor, bgColor, borderColor };
        });

        // Store layout data on series for SSR labelLayout callback
        series.__calloutLayout = layoutEntries;

        // ECharts SSR mode: labelLayout as a function won't serialise to JSON.
        // Instead, we set it after config is built, in the rendering phase.
        // Store the callback factory for later application.
        series._calloutLayoutFn = true;

        // 3. Disable ECharts native labelLine — SSR ignores labelLinePoints from
        //    labelLayout callbacks and draws short stubs in the wrong direction.
        //    Leader lines are drawn as graphic elements post-setOption using positions
        //    captured during the labelLayout callback (stored in __calloutPositions).
        series.labelLine = series.labelLine || {};
        series.labelLine.show = false;

        console.error(`  [callouts] Processed ${callouts.length} callout(s) on series[${seriesIdx}]`);
    });

    return config;
}

/**
 * Apply labelLayout callbacks for $callouts AFTER config is fully built.
 * Must be called just before chart.setOption() since callbacks can't serialise to JSON.
 *
 * The callback captures label + data point positions at render time and stores them
 * in config.__calloutPositions for post-setOption leader line generation.
 * This uses params.rect from labelLayout (exact symbol bounds) instead of
 * convertToPixel (which is off by symbolRadius).
 */
function applyCalloutLayoutCallbacks(config) {
    if (!config.series || !Array.isArray(config.series)) return;
    config.__calloutPositions = [];

    config.series.forEach((series) => {
        if (!series._calloutLayoutFn || !series.__calloutLayout) return;

        const entries = series.__calloutLayout;
        delete series._calloutLayoutFn;
        delete series.__calloutLayout;
        const positions = config.__calloutPositions;

        series.labelLayout = function(params) {
            const entry = entries.find(e => e.dataIndex === params.dataIndex);
            if (!entry) return {};

            const ptX = params.rect.x + params.rect.width / 2;
            const ptY = params.rect.y;
            const labelX = ptX + entry.offX;
            const labelY = ptY + entry.offY;

            // Store position data for leader line generation after setOption
            positions.push({
                labelX, labelY,
                dataPointX: ptX, dataPointY: ptY,
                position: entry.position,
                totalW: entry.totalW, totalH: entry.totalH,
                lineColor: entry.lineColor,
                bgColor: entry.bgColor, borderColor: entry.borderColor
            });

            return {
                x: labelX,
                y: labelY,
                moveOverlap: 'shiftY'
            };
        };
    });
}

/**
 * Apply brand defaults to all annotation elements in the config.
 * Covers: graphic components, markLine, markPoint, markArea.
 * Called after applyColorSequence() so CSS vars are already resolved.
 * NEVER overrides explicit values — only fills in missing defaults.
 */
function applyAnnotationDefaults(config) {
    // --- graphic elements ---
    if (config.graphic) {
        const graphics = Array.isArray(config.graphic) ? config.graphic : [config.graphic];
        // Classify top-level lines as leader lines when callout groups exist
        // (top-level lines alongside groups with rects are conceptually leader lines)
        const hasCalloutGroup = graphics.some(g =>
            g.type === 'group' && g.children && g.children.some(c => c.type === 'rect'));
        if (hasCalloutGroup) {
            graphics.forEach(g => {
                if (g.type === 'line') g._isLeaderLine = true;
            });
        }
        graphics.forEach(g => applyGraphicElementDefaults(g));
    }

    // --- series-level mark* ---
    if (config.series && Array.isArray(config.series)) {
        config.series.forEach(series => {
            if (series.markLine) applyMarkLineDefaults(series.markLine);
            if (series.markPoint) applyMarkPointDefaults(series.markPoint);
            if (series.markArea) applyMarkAreaDefaults(series.markArea);
        });

        // v5.0: Arrow gap warning — detect vertical markLine segments where the pill
        // would consume most of the visual space, making the arrow barely visible
        const yAxisConfig = Array.isArray(config.yAxis) ? config.yAxis[0] : config.yAxis;
        const yMax = yAxisConfig?.max;
        if (yMax && typeof yMax === 'number') {
            config.series.forEach((series, si) => {
                if (!series.markLine || !Array.isArray(series.markLine.data)) return;
                series.markLine.data.forEach((item, di) => {
                    if (!Array.isArray(item) || item.length !== 2) return;
                    const [p0, p1] = item;
                    if (!p0 || !p1) return;
                    // Vertical segment: both points have same xAxis
                    if (p0.xAxis !== undefined && p1.xAxis !== undefined && p0.xAxis === p1.xAxis &&
                        p0.yAxis !== undefined && p1.yAxis !== undefined) {
                        const gap = Math.abs(p0.yAxis - p1.yAxis);
                        const gapRatio = gap / yMax;
                        // Check if either point has a pill label (backgroundColor)
                        const hasPill = (p0.label && p0.label.backgroundColor) ||
                                        (p1.label && p1.label.backgroundColor);
                        const pillFontSize = (p1.label && p1.label.fontSize) || (p0.label && p0.label.fontSize) || 0;
                        if (hasPill && gapRatio < 0.25 && pillFontSize >= 12) {
                            console.warn(`  [arrow-gap] Series ${si + 1}, markLine data[${di}]: ` +
                                `Vertical segment gap is ${(gapRatio * 100).toFixed(1)}% of yAxis range ` +
                                `(${gap}/${yMax}). The arrow may be barely visible behind the pill label. ` +
                                `Consider using symbol: ["none", "none"] or increasing yAxis.max.`);
                        }
                    }
                });
            });
        }

        // v5.4: Axis dead-space warning for line/area charts.
        // When dataMin is far above axisMin, the chart has a large empty region below
        // the actual data, compressing the meaningful data into a small visual area.
        {
            const lineAreaTypes = new Set(['line', 'area']);
            const hasLineArea = config.series.some(s => lineAreaTypes.has(s.type) || (s.type === 'line'));
            if (hasLineArea) {
                const yAxisCfg = Array.isArray(config.yAxis) ? config.yAxis[0] : config.yAxis;
                const axisMin = (yAxisCfg && typeof yAxisCfg.min === 'number') ? yAxisCfg.min : 0;
                const axisMax = yAxisCfg?.max;
                if (typeof axisMax === 'number' && axisMax > axisMin) {
                    // Find minimum data value across all line/area series
                    let dataMin = Infinity;
                    config.series.forEach(s => {
                        if (s.type !== 'line' && s.type !== 'area') return;
                        if (Array.isArray(s.data)) {
                            s.data.forEach(d => {
                                const val = (typeof d === 'number') ? d :
                                            (Array.isArray(d) ? d[1] : (d && typeof d.value === 'number' ? d.value : null));
                                if (val !== null && val !== undefined && isFinite(val) && val < dataMin) {
                                    dataMin = val;
                                }
                            });
                        }
                    });
                    if (isFinite(dataMin) && dataMin > axisMin) {
                        const deadSpace = (dataMin - axisMin) / (axisMax - axisMin);
                        if (deadSpace > 0.30) {
                            console.warn(`  [axis-dead-space] yAxis dead space is ${(deadSpace * 100).toFixed(0)}%: ` +
                                `axis range ${axisMin}–${axisMax}, but data minimum is ${dataMin}. ` +
                                `${(deadSpace * 100).toFixed(0)}% of the chart area shows no data. ` +
                                `Consider setting yAxis.min closer to ${Math.floor(dataMin / 10) * 10} ` +
                                `to reduce dead space and expand the meaningful data region.`);
                        }
                    }
                }
            }
        }

        // v5.0.1: Offset bar labels that overlap vertical markLine segments.
        // When a vertical arrow/pill sits at the same xAxis position as a bar's
        // data label, nudge the label 12px to the right to prevent overlap.
        const verticalSegmentXAxes = new Set();
        config.series.forEach(series => {
            if (!series.markLine || !Array.isArray(series.markLine.data)) return;
            series.markLine.data.forEach(item => {
                if (!Array.isArray(item) || item.length !== 2) return;
                const [p0, p1] = item;
                if (p0?.xAxis !== undefined && p1?.xAxis !== undefined &&
                    p0.xAxis === p1.xAxis && p0?.yAxis !== undefined && p1?.yAxis !== undefined) {
                    verticalSegmentXAxes.add(String(p0.xAxis));
                }
            });
        });

        if (verticalSegmentXAxes.size > 0) {
            const xAxisData = (Array.isArray(config.xAxis) ? config.xAxis[0] : config.xAxis)?.data;
            if (xAxisData && Array.isArray(xAxisData)) {
                config.series.forEach(series => {
                    if (series.type !== 'bar') return;
                    const seriesLabel = series.label;
                    if (!seriesLabel || seriesLabel.show !== true) return;
                    xAxisData.forEach((cat, idx) => {
                        if (!verticalSegmentXAxes.has(String(cat))) return;
                        if (idx >= series.data.length) return;
                        const val = series.data[idx];
                        // Offset the label to the right to clear the markLine
                        if (typeof val === 'number') {
                            series.data[idx] = { value: val, label: { offset: [12, 0] } };
                        } else if (typeof val === 'object' && val !== null) {
                            if (!val.label) val.label = {};
                            if (!val.label.offset) val.label.offset = [12, 0];
                        }
                        console.warn(`  [markline-label] Offsetting bar label at xAxis="${cat}" ` +
                            `to avoid markLine vertical segment overlap`);
                    });
                });
            }
        }
    }
    return config;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA-BOUND GRAPHIC POSITIONING — Resolve $dataCoord/$lineDataCoords to pixels
// Uses chart.convertToPixel('grid', [x, y]) after setOption establishes coords.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Resolve $dataCoord and $lineDataCoords markers on graphic elements to pixel positions.
 *
 * Supported markers:
 * - $dataCoord: [x, y] on any element (typically groups) → sets left/top to pixel position
 * - $lineDataCoords: [[x1,y1], [x2,y2]] on type:"line" → sets shape endpoints
 *
 * For groups: children use relative offsets from the group's resolved position.
 * Returns metadata array for CSS variable injection by html2pptx.mjs.
 *
 * @param {Array|Object} graphics - ECharts graphic config (array or single element)
 * @param {Object} chart - ECharts chart instance (after setOption)
 * @returns {Array} Resolved coordinate metadata for html2pptx.mjs
 */
function resolveGraphicDataCoords(graphics, chart) {
    // v4.9: $dataCoord is deprecated. Emit warning but still resolve for backward compat.
    console.warn('  [dataCoord] WARNING: $dataCoord is deprecated (v4.9). ' +
        'Use markLine two-point (delta pills) or $callouts (callout boxes) instead. ' +
        'Pre-flight check 57 blocks new HTML using $dataCoord.');
    const resolved = [];

    function walk(el, parentPixel, groupIndex) {
        if (!el || typeof el !== 'object') return;

        // $dataCoord on element → resolve to left/top pixel position
        if (el.$dataCoord && Array.isArray(el.$dataCoord) && el.$dataCoord.length === 2) {
            try {
                const pixel = chart.convertToPixel('grid', el.$dataCoord);
                if (pixel && isFinite(pixel[0]) && isFinite(pixel[1])) {
                    const absX = Math.round(pixel[0]);
                    const absY = Math.round(pixel[1]);
                    if (parentPixel) {
                        el.left = absX - parentPixel.x;
                        el.top = absY - parentPixel.y;
                    } else {
                        el.left = absX;
                        el.top = absY;
                    }
                    delete el.right;
                    delete el.bottom; // avoid conflicts with left/top

                    // Capture metadata for CSS variable injection
                    const meta = {
                        index: groupIndex,
                        dataCoord: el.$dataCoord,
                        pixel: { x: absX, y: absY }
                    };
                    if (el.children) {
                        const rect = el.children.find(c => c.type === 'rect');
                        if (rect?.shape) {
                            meta.rect = {
                                width: rect.shape.width || 0,
                                height: rect.shape.height || 0,
                                offsetX: rect.x || 0,
                                offsetY: rect.y || 0
                            };
                        }
                    }
                    resolved.push(meta);
                    console.error(`  [dataCoord] graphic[${groupIndex}]: [${el.$dataCoord}] → pixel (${absX}, ${absY})`);

                    // v4.6.3: Auto-flip callout when rect extends beyond chart boundary
                    if (el.children && !parentPixel) {
                        const chartW = chart.getWidth();
                        const chartH = chart.getHeight();
                        const rect = el.children.find(c => c.type === 'rect');
                        if (rect?.shape) {
                            const rw = rect.shape.width || 0;
                            const rh = rect.shape.height || 0;
                            const rx = rect.x || 0;
                            const ry = rect.y || 0;

                            // Right-edge overflow: flip rect to LEFT of data point
                            if (absX + rx + rw > chartW - 5) {
                                rect.x = -(rx + rw);
                                el.children.filter(c => c.type === 'line').forEach(line => {
                                    if (line.shape) {
                                        line.shape.x1 = -(line.shape.x1 || 0);
                                        line.shape.x2 = -(line.shape.x2 || 0);
                                    }
                                });
                                meta.rect.offsetX = rect.x;
                                meta.flipped = 'left';
                                console.error(`  [dataCoord] Auto-flipped graphic[${groupIndex}] to LEFT (rect right edge ${absX + rx + rw}px > chart width ${chartW}px)`);
                            }

                            // Left-edge overflow: flip rect to RIGHT of data point
                            if (absX + rx < 5) {
                                rect.x = Math.abs(rx);
                                el.children.filter(c => c.type === 'line').forEach(line => {
                                    if (line.shape) {
                                        line.shape.x1 = Math.abs(line.shape.x1 || 0);
                                        line.shape.x2 = Math.abs(line.shape.x2 || 0);
                                    }
                                });
                                meta.rect.offsetX = rect.x;
                                meta.flipped = 'right';
                                console.error(`  [dataCoord] Auto-flipped graphic[${groupIndex}] to RIGHT (rect left edge ${absX + rx}px < 5px)`);
                            }

                            // Top-edge overflow: flip rect below data point
                            if (absY + ry < 5) {
                                rect.y = Math.abs(ry);
                                el.children.filter(c => c.type === 'line').forEach(line => {
                                    if (line.shape) {
                                        line.shape.y1 = -(line.shape.y1 || 0);
                                        line.shape.y2 = -(line.shape.y2 || 0);
                                    }
                                });
                                meta.rect.offsetY = rect.y;
                                meta.flipped = (meta.flipped || '') + ',down';
                                console.error(`  [dataCoord] Auto-flipped graphic[${groupIndex}] DOWN (rect top edge ${absY + ry}px < 5px)`);
                            }

                            // Bottom-edge overflow: flip rect above data point
                            if (absY + ry + rh > chartH - 5) {
                                rect.y = -(ry + rh);
                                el.children.filter(c => c.type === 'line').forEach(line => {
                                    if (line.shape) {
                                        line.shape.y1 = -(line.shape.y1 || 0);
                                        line.shape.y2 = -(line.shape.y2 || 0);
                                    }
                                });
                                meta.rect.offsetY = rect.y;
                                meta.flipped = (meta.flipped || '') + ',up';
                                console.error(`  [dataCoord] Auto-flipped graphic[${groupIndex}] UP (rect bottom edge ${absY + ry + rh}px > chart height ${chartH}px)`);
                            }
                        }
                    }
                }
            } catch (e) {
                console.error(`  [dataCoord] ERROR resolving [${el.$dataCoord}]: ${e.message}`);
            }
            delete el.$dataCoord;
        }

        // $lineDataCoords on line → resolve both endpoints to pixel positions
        if (el.type === 'line' && el.$lineDataCoords && Array.isArray(el.$lineDataCoords) && el.$lineDataCoords.length === 2) {
            try {
                const p1 = chart.convertToPixel('grid', el.$lineDataCoords[0]);
                const p2 = chart.convertToPixel('grid', el.$lineDataCoords[1]);
                if (p1 && p2 && isFinite(p1[0]) && isFinite(p1[1]) && isFinite(p2[0]) && isFinite(p2[1])) {
                    el.shape = el.shape || {};
                    const ox = parentPixel ? parentPixel.x : 0;
                    const oy = parentPixel ? parentPixel.y : 0;
                    el.shape.x1 = Math.round(p1[0]) - ox;
                    el.shape.y1 = Math.round(p1[1]) - oy;
                    el.shape.x2 = Math.round(p2[0]) - ox;
                    el.shape.y2 = Math.round(p2[1]) - oy;
                    console.error(`  [dataCoord] line: [${el.$lineDataCoords[0]}]->[${el.$lineDataCoords[1]}] → (${el.shape.x1},${el.shape.y1})-(${el.shape.x2},${el.shape.y2})`);
                }
            } catch (e) {
                console.error(`  [dataCoord] line ERROR: ${e.message}`);
            }
            delete el.$lineDataCoords;
        }

        // Recurse into children (pass resolved parent pixel for relative offsets)
        if (el.children && Array.isArray(el.children)) {
            const myPixel = (typeof el.left === 'number' && typeof el.top === 'number')
                ? { x: (parentPixel?.x || 0) + el.left, y: (parentPixel?.y || 0) + el.top }
                : parentPixel;
            el.children.forEach(c => walk(c, myPixel, groupIndex));
        }
    }

    const arr = Array.isArray(graphics) ? graphics : [graphics];
    arr.forEach((g, i) => walk(g, null, i));
    return resolved;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHART LABEL ALIGNMENT — Consistent title-to-label alignment for all chart types
// Universal rule: chart title left edge aligns with leftmost category label edge
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate label width with smart wrapping consideration
 * @param {string[]} categories - Array of category labels
 * @param {number} fontSize - Font size in pixels
 * @param {number} maxWidth - Maximum allowed width
 * @returns {number} - Calculated width in pixels
 */
function calculateSmartLabelWidth(categories, fontSize, maxWidth) {
    if (!categories || categories.length === 0) return 100;

    // Character width approximation (~0.6 for sans-serif)
    const charWidth = fontSize * 0.6;

    // Find the longest label
    const maxChars = Math.max(...categories.map(c => String(c).length));
    const naturalWidth = Math.ceil(maxChars * charWidth);

    // If natural width exceeds max, we'll wrap — return max
    // If natural width is within max, use natural width
    return Math.min(naturalWidth, maxWidth);
}

/**
 * Determine if X-axis labels should be rotated
 * @param {string[]} categories - Array of category labels
 * @param {number} fontSize - Font size in pixels
 * @param {number} chartWidth - Total chart width
 * @returns {boolean} - True if labels should be rotated
 */
function shouldRotateLabels(categories, fontSize, chartWidth) {
    if (!categories || categories.length === 0) return false;

    const charWidth = fontSize * 0.6;

    // For multi-line labels (contain \n), use the longest single LINE width
    // not the total string length — multi-line labels are displayed horizontally
    const avgLabelWidth = categories.reduce((sum, c) => {
        const lines = String(c).split('\n');
        const maxLineLen = Math.max(...lines.map(l => l.length));
        return sum + maxLineLen;
    }, 0) / categories.length * charWidth;

    const availableWidthPerLabel = chartWidth / categories.length;

    // Rotate if average label is wider than available space
    return avgLabelWidth > availableWidthPerLabel * 0.8;
}

/**
 * Smart wrap text to fit within max width
 * @param {string} text - Text to wrap
 * @param {number} maxWidth - Maximum width in pixels
 * @param {number} fontSize - Font size in pixels
 * @returns {string} - Wrapped text with \n for line breaks
 */
function smartWrap(text, maxWidth, fontSize) {
    const charWidth = fontSize * 0.6;
    const maxCharsPerLine = Math.floor(maxWidth / charWidth);

    if (text.length <= maxCharsPerLine) {
        return text;
    }

    // Try to break at word boundaries
    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = '';

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (testLine.length <= maxCharsPerLine) {
            currentLine = testLine;
        } else {
            if (currentLine) {
                lines.push(currentLine);
            }
            // If single word is too long, truncate it
            currentLine = word.length > maxCharsPerLine
                ? word.substring(0, maxCharsPerLine - 3) + '...'
                : word;
        }

        // Limit to MAX_LABEL_LINES
        if (lines.length >= MAX_LABEL_LINES - 1 && currentLine) {
            break;
        }
    }

    if (currentLine) {
        lines.push(currentLine);
    }

    return lines.slice(0, MAX_LABEL_LINES).join('\n');
}

/**
 * Configure horizontal chart label alignment (categories on Y-axis).
 * Sets containLabel: false, left-aligns Y-axis labels, and calculates grid.left.
 * Applies to: horizontal bar charts, horizontal stacked bars, diverging bars.
 *
 * @param {object} config - ECharts config object (mutated in place)
 * @param {number} chartWidth - Total chart width in pixels
 * @returns {{ gridLeft: number, titlePaddingLeft: number }}
 */
function configureHorizontalChart(config, chartWidth) {
    // CRITICAL: containLabel must be false for manual positioning
    if (!config.grid) config.grid = {};
    config.grid.containLabel = false;

    // Resolve yAxis (may be array)
    const yAxisConfig = Array.isArray(config.yAxis) ? config.yAxis[0] : config.yAxis;
    const categories = yAxisConfig?.data || [];
    const fontSize = yAxisConfig?.axisLabel?.fontSize || getFontSize('axisLabel');

    // Calculate label width with smart wrapping
    const labelWidth = calculateSmartLabelWidth(categories, fontSize, MAX_LABEL_WIDTH);

    // Set grid.left to accommodate labels
    const gridLeft = LABEL_START_X + labelWidth + GAP_AFTER_LABELS;
    config.grid.left = gridLeft;

    // Configure Y-axis labels — left-aligned
    if (!yAxisConfig) return { gridLeft, titlePaddingLeft: LABEL_START_X };
    if (!yAxisConfig.axisLabel) yAxisConfig.axisLabel = {};

    // A2: Preserve agent's explicit overflow:'break' for multi-word labels
    const agentOverflow = yAxisConfig.axisLabel.overflow;

    Object.assign(yAxisConfig.axisLabel, {
        show: yAxisConfig.axisLabel.show !== false,
        align: 'left',
        margin: gridLeft - LABEL_START_X,
        fontSize: fontSize,
        color: getColor('text.body'),
        fontFamily: getFont('data'),
        width: labelWidth,
        overflow: agentOverflow === 'break' ? 'break' : 'truncate',
        ellipsis: '...'
    });

    // A1: Default interval:0 to prevent ECharts from silently hiding labels
    if (yAxisConfig.axisLabel.interval === undefined || yAxisConfig.axisLabel.interval === null) {
        yAxisConfig.axisLabel.interval = 0;
        console.warn(`  [label-fix] Auto-set yAxis interval: 0 for ${categories.length} categories. Override with explicit interval value.`);
    }

    // Write back if array
    if (Array.isArray(config.yAxis)) {
        config.yAxis[0] = yAxisConfig;
    }

    console.error(`[label-align] Horizontal: labelWidth=${labelWidth}, gridLeft=${gridLeft}, align=left`);
    return { gridLeft, titlePaddingLeft: LABEL_START_X };
}

/**
 * Configure vertical chart label alignment (categories on X-axis).
 * Sets containLabel: false, configures X-axis labels and rotation.
 * Applies to: vertical bar charts, line charts, area charts, grouped bars.
 *
 * @param {object} config - ECharts config object (mutated in place)
 * @param {number} chartWidth - Total chart width in pixels
 * @returns {{ gridLeft: number, titlePaddingLeft: number }}
 */
function configureVerticalChart(config, chartWidth) {
    // CRITICAL: containLabel must be false for manual positioning
    if (!config.grid) config.grid = {};
    config.grid.containLabel = false;

    // Resolve xAxis (may be array)
    const xAxisConfig = Array.isArray(config.xAxis) ? config.xAxis[0] : config.xAxis;
    const categories = xAxisConfig?.data || [];
    const fontSize = xAxisConfig?.axisLabel?.fontSize || getFontSize('axisLabel');

    // For vertical charts, grid.left is where the chart area starts
    // v4.7: Respect agent's grid.left when y-axis labels are visible
    const yAxisConfig = Array.isArray(config.yAxis) ? config.yAxis[0] : config.yAxis;
    const yAxisLabelsVisible = yAxisConfig?.axisLabel?.show !== false;
    const agentGridLeft = config.grid?.left;

    if (yAxisLabelsVisible && typeof agentGridLeft === 'number' && agentGridLeft > LABEL_START_X) {
        // Agent explicitly set a larger grid.left for y-axis labels — respect it
        console.warn(`  [label-align] Vertical: Preserving agent grid.left=${agentGridLeft} (y-axis labels visible)`);
        // Don't override grid.left — keep the agent's value
    } else {
        config.grid.left = LABEL_START_X;
    }

    // Configure X-axis labels
    if (!xAxisConfig) return { gridLeft: LABEL_START_X, titlePaddingLeft: LABEL_START_X };
    if (!xAxisConfig.axisLabel) xAxisConfig.axisLabel = {};

    // Respect agent's explicit rotate value; otherwise auto-detect
    const agentRotate = xAxisConfig.axisLabel.rotate;
    const shouldRotate = shouldRotateLabels(categories, fontSize, chartWidth);
    const finalRotate = (typeof agentRotate === 'number') ? agentRotate : (shouldRotate ? 45 : 0);

    // A2: Preserve agent's explicit overflow:'break' for multi-word labels
    const agentOverflow = xAxisConfig.axisLabel.overflow;

    Object.assign(xAxisConfig.axisLabel, {
        show: xAxisConfig.axisLabel.show !== false,
        align: finalRotate !== 0 ? 'right' : 'center',
        fontSize: fontSize,
        color: getColor('text.body'),
        fontFamily: getFont('data'),
        rotate: finalRotate,
        overflow: agentOverflow === 'break' ? 'break' : 'truncate',
        ellipsis: '...'
    });

    // A1: Default interval:0 to prevent ECharts from silently hiding labels
    if (xAxisConfig.axisLabel.interval === undefined || xAxisConfig.axisLabel.interval === null) {
        xAxisConfig.axisLabel.interval = 0;
        console.warn(`  [label-fix] Auto-set xAxis interval: 0 for ${categories.length} categories. Override with explicit interval value.`);
    }

    // Write back if array
    if (Array.isArray(config.xAxis)) {
        config.xAxis[0] = xAxisConfig;
    }

    const finalGridLeft = config.grid.left ?? LABEL_START_X;
    console.error(`[label-align] Vertical: gridLeft=${finalGridLeft}, rotate=${shouldRotate ? 45 : 0}`);
    return { gridLeft: finalGridLeft, titlePaddingLeft: LABEL_START_X };
}

/**
 * Apply chart label alignment based on chart orientation.
 * Must run AFTER applyMcKinseyStyle merge and AFTER calculateRequiredGridMargins.
 * Stores _titlePaddingLeft on config for use by HTML template.
 *
 * @param {object} config - Fully merged ECharts config
 * @param {number} width - Chart width in pixels
 * @returns {object} - Config with alignment applied
 */
function applyChartLabelAlignment(config, width) {
    // Skip for chart types that don't use category axes (pie, gauge, radar, etc.)
    const hasBarOrLine = config.series && Array.isArray(config.series) &&
        config.series.some(s => s.type === 'bar' || s.type === 'line');
    if (!hasBarOrLine) return config;

    let alignmentResult;

    if (isHorizontalChart(config)) {
        alignmentResult = configureHorizontalChart(config, width);
    } else {
        alignmentResult = configureVerticalChart(config, width);
    }

    // Store title padding for HTML template use
    config._titlePaddingLeft = alignmentResult.titlePaddingLeft;

    return config;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRID MARGIN AUTO-CALC — Ensure labels are not clipped
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * For horizontal bar charts, estimate required grid.left based on longest Y-axis label.
 * For vertical bar charts with long X-axis labels, increase grid.bottom.
 * Never reduces existing values — only raises values below calculated minimums.
 */
function calculateRequiredGridMargins(config) {
    if (!config.grid) config.grid = {};

    const isHorizontalBar = config.yAxis?.type === 'category' ||
        (Array.isArray(config.yAxis) && config.yAxis.some(a => a.type === 'category'));

    const isVerticalBar = config.xAxis?.type === 'category' ||
        (Array.isArray(config.xAxis) && config.xAxis.some(a => a.type === 'category'));

    // Horizontal bar: auto-calc grid.left from longest Y-axis label
    if (isHorizontalBar) {
        const yAxis = Array.isArray(config.yAxis) ? config.yAxis.find(a => a.type === 'category') : config.yAxis;
        if (yAxis?.data && yAxis.data.length > 0) {
            const longestLabel = yAxis.data.reduce((max, label) =>
                String(label).length > String(max).length ? label : max, '');
            const fontSize = yAxis.axisLabel?.fontSize || 10;
            const requiredLeft = Math.max(100, Math.ceil(String(longestLabel).length * fontSize * 0.6 + 20));
            const currentLeft = typeof config.grid.left === 'number' ? config.grid.left : 0;
            if (currentLeft < requiredLeft) {
                console.warn(`  [grid-auto] grid.left: ${currentLeft || 'unset'} → ${requiredLeft} (label: "${String(longestLabel).substring(0, 30)}...")`);
                config.grid.left = requiredLeft;
            }
        }
        // Ensure minimum right margin for value labels
        const currentRight = typeof config.grid.right === 'number' ? config.grid.right : 0;
        if (currentRight < 60) {
            config.grid.right = 60;
        }
    }

    // Vertical bar: auto-calc grid.bottom from longest X-axis label
    if (isVerticalBar) {
        const xAxis = Array.isArray(config.xAxis) ? config.xAxis.find(a => a.type === 'category') : config.xAxis;
        if (xAxis?.data && xAxis.data.length > 0) {
            const longestLabel = xAxis.data.reduce((max, label) =>
                String(label).length > String(max).length ? label : max, '');
            if (String(longestLabel).length > 10) {
                const requiredBottom = Math.max(60, Math.ceil(String(longestLabel).length * 4 + 20));
                const currentBottom = typeof config.grid.bottom === 'number' ? config.grid.bottom : 0;
                if (currentBottom < requiredBottom) {
                    console.warn(`  [grid-auto] grid.bottom: ${currentBottom || 'unset'} → ${requiredBottom} (long x-labels)`);
                    config.grid.bottom = requiredBottom;
                }
            }
        }
    }

    return config;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO AXIS BREAKS — Compress empty space between outlier tiers
// ECharts 6.x native breaks API: yAxis.breaks = [{start, end, gap}]
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract a single numeric value from a data point.
 * Handles both plain numbers and {value: n} objects.
 * Returns null for non-numeric / missing values.
 */
function extractSingleValue(dataPoint) {
    if (dataPoint === null || dataPoint === undefined || dataPoint === '-') return null;
    if (typeof dataPoint === 'number') return isFinite(dataPoint) ? dataPoint : null;
    if (typeof dataPoint === 'object' && dataPoint.value !== undefined) {
        const v = dataPoint.value;
        if (typeof v === 'number' && isFinite(v)) return v;
        // Handle array values like [x, y]
        if (Array.isArray(v) && v.length >= 2 && typeof v[1] === 'number') return v[1];
    }
    // Handle [x, y] array data points (scatter, etc.)
    if (Array.isArray(dataPoint) && dataPoint.length >= 2 && typeof dataPoint[1] === 'number') {
        return dataPoint[1];
    }
    return null;
}

/**
 * Extract all numeric values from one series' data array.
 */
function extractSeriesValues(series) {
    if (!series.data || !Array.isArray(series.data)) return [];
    return series.data
        .map(extractSingleValue)
        .filter(v => v !== null);
}

/**
 * Detect waterfall-style stacks: stacks that contain a placeholder series
 * (transparent fill acting as an invisible base).
 * Returns a Set of stack names that are waterfall stacks.
 */
function detectWaterfallStacks(seriesArr) {
    const stacks = new Set();
    for (const s of seriesArr) {
        if (s.stack && isPlaceholderOrOutlineSeries(s)) {
            stacks.add(s.stack);
        }
    }
    return stacks;
}

/**
 * For waterfall charts, compute effective bar-top values.
 * Each bar's visible top = placeholder.data[i] + increment.data[i]
 * Returns array of effective top values.
 */
function extractWaterfallValues(seriesArr, waterfallStacks) {
    const values = [];
    for (const stackName of waterfallStacks) {
        const stackSeries = seriesArr.filter(s => s.stack === stackName);
        const placeholder = stackSeries.find(s => isPlaceholderOrOutlineSeries(s));
        const increments = stackSeries.filter(s => !isPlaceholderOrOutlineSeries(s));

        if (!placeholder || increments.length === 0) continue;

        const placeholderData = placeholder.data || [];
        for (const inc of increments) {
            const incData = inc.data || [];
            const len = Math.max(placeholderData.length, incData.length);
            for (let i = 0; i < len; i++) {
                const base = extractSingleValue(placeholderData[i]) || 0;
                const delta = extractSingleValue(incData[i]) || 0;
                const top = base + delta;
                if (isFinite(top) && top > 0) values.push(top);
            }
        }
    }
    return values;
}

/**
 * Check if any series uses the `stack` property.
 */
function hasStackedSeries(seriesArr) {
    return seriesArr.some(s => s.stack);
}

/**
 * For stacked (non-waterfall) charts, sum values per category index.
 * Each bar segment adds to the total for that category.
 * Returns array of per-category totals.
 */
function extractStackedValues(seriesArr) {
    // Group series by stack name
    const stackGroups = {};
    for (const s of seriesArr) {
        if (!s.stack || isPlaceholderOrOutlineSeries(s)) continue;
        if (s.type !== 'bar' && s.type !== 'line') continue;
        if (!stackGroups[s.stack]) stackGroups[s.stack] = [];
        stackGroups[s.stack].push(s);
    }

    const values = [];
    for (const stackName of Object.keys(stackGroups)) {
        const group = stackGroups[stackName];
        // Find max data length across all series in this stack
        const maxLen = Math.max(...group.map(s => (s.data || []).length));
        for (let i = 0; i < maxLen; i++) {
            let sum = 0;
            for (const s of group) {
                const v = extractSingleValue((s.data || [])[i]);
                if (v !== null) sum += Math.abs(v);
            }
            if (sum > 0) values.push(sum);
        }
    }
    return values;
}

/**
 * Orchestrator: extract all relevant data values from a chart config.
 * Handles simple bar, grouped bar, stacked bar, waterfall, line, combo.
 *
 * Strategy: ALWAYS collect raw individual values from every non-placeholder
 * series first (Step 1). Then, for aggregated chart types (waterfall, stacked),
 * also add the computed positions — bar-tops, stack sums (Step 2).
 *
 * This ensures computeBreaks() sees the actual data magnitudes regardless of
 * how the chart aggregates them. A waterfall whose bar-tops all cluster at
 * ~175K still exposes the raw increments (173K, 1.5K, 129, 80…) for gap
 * detection. Duplicates are harmless — computeBreaks() deduplicates via Set.
 */
function extractAllDataValues(config) {
    if (!config.series || !Array.isArray(config.series)) return [];

    const relevantSeries = config.series.filter(
        s => s.type === 'bar' || s.type === 'line'
    );
    if (relevantSeries.length === 0) return [];

    // ── Step 1: ALWAYS collect raw values from every non-placeholder series ──
    const values = [];
    for (const s of relevantSeries) {
        if (!isPlaceholderOrOutlineSeries(s)) {
            values.push(...extractSeriesValues(s).map(Math.abs));
        }
    }

    // ── Step 2: For aggregated types, ALSO add computed positions ──
    const waterfallStacks = detectWaterfallStacks(relevantSeries);

    if (waterfallStacks.size > 0) {
        values.push(...extractWaterfallValues(relevantSeries, waterfallStacks));
    } else if (hasStackedSeries(relevantSeries)) {
        values.push(...extractStackedValues(relevantSeries));
    }

    // Return only positive values (break logic works on positive range)
    return values.filter(v => v > 0);
}

/**
 * Extract per-category VISUAL bar heights for break detection.
 *
 * Unlike extractAllDataValues (which returns raw segment values from every
 * series), this returns what the viewer actually sees — the total bar height
 * at each category position:
 *   - Stacked charts → sum of all stack segments per category
 *   - Waterfall charts → bar-top positions (placeholder base + increment)
 *   - Grouped / simple → max value per category across all series
 *
 * This prevents spurious break detection from individual stack segments
 * (e.g., a segment value of 7 inside a bar whose total is 29).
 *
 * Returns array of per-category totals in chart order (NOT sorted).
 */
function extractVisualBarHeights(config) {
    if (!config.series || !Array.isArray(config.series)) return [];

    const relevantSeries = config.series.filter(
        s => (s.type === 'bar' || s.type === 'line') && !isPlaceholderOrOutlineSeries(s)
    );
    if (relevantSeries.length === 0) return [];

    // Waterfall: use bar-top positions
    const waterfallStacks = detectWaterfallStacks(
        config.series.filter(s => s.type === 'bar' || s.type === 'line')
    );
    if (waterfallStacks.size > 0) {
        return extractWaterfallValues(
            config.series.filter(s => s.type === 'bar' || s.type === 'line'),
            waterfallStacks
        );
    }

    // Stacked: sum all series per category
    if (hasStackedSeries(relevantSeries)) {
        return extractStackedValues(relevantSeries);
    }

    // Grouped / simple: max value per category across series
    const maxLen = Math.max(...relevantSeries.map(s => (s.data || []).length));
    const heights = [];
    for (let i = 0; i < maxLen; i++) {
        let maxVal = 0;
        for (const s of relevantSeries) {
            const v = extractSingleValue((s.data || [])[i]);
            if (v !== null) maxVal = Math.max(maxVal, Math.abs(v));
        }
        if (maxVal > 0) heights.push(maxVal);
    }
    return heights;
}

/**
 * Core algorithm: detect genuine outlier gaps in the data distribution.
 *
 * Takes VISUAL bar heights (per-category totals), sorts unique values
 * descending, and scans adjacent pairs for outlier gaps.
 *
 * A break is only triggered when BOTH conditions are met:
 *   1. ratio >= 3  (higher value is at least 3× the lower)
 *   2. gap >= 30% of the data range  (the gap is visually significant)
 *
 * This prevents false positives from:
 *   - Gradual declines (e.g., 100→93→57→...→7): no pair hits 3× ratio
 *   - Small absolute gaps at the bottom of the range (e.g., 14 vs 7 is
 *     only 7 units on a 0-100 axis — compressing it saves no space)
 *
 * Genuine outliers ARE detected:
 *   - [175K, 1.5K, 800]: 175K/1.5K = 116× with gap = 99.1% of range
 *   - [500, 50, 45, 40]: 500/50 = 10× with gap = 97.8% of range
 *
 * Break range: {start: lower * 1.15, end: higher * (1 - adaptiveMargin)}
 *   Margins keep bar tips and labels visible on both sides of the break.
 *
 * Returns array of {start, end, gap} objects sorted ascending by start.
 */
function computeBreaks(values) {
    if (!values || values.length < 3) return [];

    // Get unique positive values, sorted descending
    const unique = [...new Set(values)].filter(v => v > 0).sort((a, b) => b - a);
    if (unique.length < 2) return [];

    const dataRange = unique[0] - unique[unique.length - 1];
    if (dataRange <= 0) return [];

    const breaks = [];

    for (let i = 0; i < unique.length - 1; i++) {
        const higher = unique[i];
        const lower = unique[i + 1];
        const ratio = higher / lower;
        const gap = higher - lower;

        // Break conditions (BOTH must be met):
        // 1. Ratio >= 3: genuine outlier jump, not a gradual decline
        // 2. Gap >= 30% of data range: visually significant compression
        if (ratio >= 3 && gap >= dataRange * 0.3) {
            // Lower margin: fixed 15% above the lower cluster value
            // Keeps small bars fully visible with breathing room
            const breakStart = lower * 1.15;

            // Upper margin: adaptive — tighter when ratio is extreme
            //   ratio=3   → 9.5% visible above break (gentle)
            //   ratio=10  → ~4.5% visible (moderate)
            //   ratio=100+→ 2% visible (extreme — just a stub)
            const upperMarginFraction = Math.max(0.02, 0.15 / Math.log2(ratio));
            const breakEnd = higher * (1 - upperMarginFraction);

            // Only add if there's meaningful space to compress
            if (breakEnd > breakStart) {
                // Gap: scales with ratio so the torn-paper effect is prominent
                //   ratio=3 → 6%, ratio=10 → 8%, ratio=100 → 11%, ratio=1000 → 14%
                const gapPercent = Math.min(15, Math.round(5 + 3 * Math.log10(ratio)));
                breaks.push({ start: breakStart, end: breakEnd, gap: `${gapPercent}%` });
            }
        }
        // Continue scanning — do NOT break early
    }

    // Return sorted ascending by start value
    return breaks.sort((a, b) => a.start - b.start);
}

/**
 * Check agent axis overrides and determine break behavior.
 * Returns:
 *   'skip'    — agent explicitly set breaks; skip auto-detection entirely
 *   'strip'   — agent set min/max but NOT breaks; proceed with detection,
 *               and if breaks are found, remove agent's min/max
 *   'proceed' — no relevant overrides; proceed normally
 */
function getAxisOverrideAction(config, axisKey) {
    const axis = config[axisKey];
    if (!axis) return 'proceed';

    const axisConfig = Array.isArray(axis) ? axis[0] : axis;
    if (!axisConfig) return 'proceed';

    // Hard skip: agent explicitly set breaks (they know what they're doing)
    if (axisConfig.breaks) return 'skip';

    // Skip: axis type is not 'value' (breaks only work on value axes)
    if (axisConfig.type && axisConfig.type !== 'value') return 'skip';

    // Soft override: agent set min/max but NOT breaks
    // We'll proceed with detection and strip min/max if breaks are found
    if (axisConfig.min !== undefined || axisConfig.max !== undefined) return 'strip';

    return 'proceed';
}

/**
 * Inject breaks[] and breakArea styling onto the value axis.
 */
function applyBreaksToAxis(config, axisKey, breaks) {
    if (!breaks || breaks.length === 0) return config;

    const axis = config[axisKey];
    const axisConfig = Array.isArray(axis) ? axis[0] : axis;

    if (!axisConfig) return config;

    // Set breaks
    axisConfig.breaks = breaks;

    // McKinsey-style break area: subtle zigzag indicator
    axisConfig.breakArea = {
        zigzagAmplitude: 3,
        itemStyle: {
            opacity: 0.6,
            borderType: 'dashed'
        }
    };

    // Write back if it was an array
    if (Array.isArray(config[axisKey])) {
        config[axisKey][0] = axisConfig;
    } else {
        config[axisKey] = axisConfig;
    }

    return config;
}

/**
 * Entry point: Detect outlier data and apply axis breaks automatically.
 *
 * Guard clauses:
 * - No series, or no bar/line series → skip
 * - Agent set breaks/min/max on value axis → skip
 * - Axis type is log, time, category → skip
 * - Diverging chart (pos + neg values) → skip
 * - Chart has negative values → skip (v1 limitation)
 * - < 3 data points → skip
 */
function applyAutoAxisBreaks(config) {
    if (!config.series || !Array.isArray(config.series)) return config;

    // Only apply to charts with bar or line series
    const hasBarOrLine = config.series.some(
        s => s.type === 'bar' || s.type === 'line'
    );
    if (!hasBarOrLine) {
        console.error('[axis-break] Skip: no bar/line series');
        return config;
    }

    // Skip diverging charts
    if (isDivergingChart(config)) {
        console.error('[axis-break] Skip: diverging chart');
        return config;
    }

    // Determine which axis is the value axis
    const horizontal = isHorizontalChart(config);
    const valueAxisKey = horizontal ? 'xAxis' : 'yAxis';

    // Check agent axis overrides
    const overrideAction = getAxisOverrideAction(config, valueAxisKey);
    if (overrideAction === 'skip') {
        console.error('[axis-break] Skip: agent has explicit breaks on', valueAxisKey);
        return config;
    }

    // Extract per-category visual bar heights (stacked totals, not raw segments)
    const values = extractVisualBarHeights(config);
    console.error(`[axis-break] Visual bar heights (${values.length}): [${values.slice(0, 10).join(', ')}${values.length > 10 ? '...' : ''}]`);

    // Skip if any negative values (v1 limitation)
    if (values.some(v => v < 0)) {
        console.error('[axis-break] Skip: negative values found');
        return config;
    }

    // Need at least 3 data points for meaningful break detection
    if (values.length < 3) {
        console.error('[axis-break] Skip: fewer than 3 data points');
        return config;
    }

    // Compute breaks
    let breaks = computeBreaks(values);
    console.error(`[axis-break] Computed ${breaks.length} break(s):`, JSON.stringify(breaks));

    if (breaks.length === 0) return config;

    // If agent had set min/max, strip them — break system handles axis range
    if (overrideAction === 'strip') {
        const axis = config[valueAxisKey];
        const axisConfig = Array.isArray(axis) ? axis[0] : axis;
        if (axisConfig) {
            const strippedProps = [];
            if (axisConfig.min !== undefined) { delete axisConfig.min; strippedProps.push('min'); }
            if (axisConfig.max !== undefined) { delete axisConfig.max; strippedProps.push('max'); }
            if (strippedProps.length > 0) {
                console.error(`[axis-break] Stripped agent ${strippedProps.join(', ')} from ${valueAxisKey} — break system handles axis range`);
            }
        }
    }

    // Limit to 1 break for visual clarity (McKinsey style — clean, not cluttered)
    if (breaks.length > 1) {
        breaks.sort((a, b) => (b.end - b.start) - (a.end - a.start));
        breaks = [breaks[0]];
        console.error('[axis-break] Limited to largest break:', JSON.stringify(breaks));
    }

    // Apply breaks to the value axis
    config = applyBreaksToAxis(config, valueAxisKey, breaks);
    console.error('[axis-break] Applied breaks to', valueAxisKey);

    return config;
}

/**
 * Apply McKinsey style defaults to agent config
 * Agent config takes precedence - defaults only fill in missing values
 * Automatically detects chart type (horizontal, diverging) and applies appropriate defaults
 *
 * FIX 2: Don't force containLabel:true when grid uses pixel values
 */
function applyMcKinseyStyle(agentConfig, chartWidth) {
    // D1: Snapshot agent's original values for override logging
    const snapshot = {};
    const snap = (path, val) => { if (val !== undefined) snapshot[path] = val; };
    snap('grid.left', agentConfig.grid?.left);
    snap('grid.right', agentConfig.grid?.right);
    snap('grid.top', agentConfig.grid?.top);
    snap('grid.bottom', agentConfig.grid?.bottom);
    snap('grid.containLabel', agentConfig.grid?.containLabel);
    const yAxis0 = Array.isArray(agentConfig.yAxis) ? agentConfig.yAxis[0] : agentConfig.yAxis;
    const xAxis0 = Array.isArray(agentConfig.xAxis) ? agentConfig.xAxis[0] : agentConfig.xAxis;
    snap('yAxis.axisLabel.overflow', yAxis0?.axisLabel?.overflow);
    snap('yAxis.axisLabel.interval', yAxis0?.axisLabel?.interval);
    snap('xAxis.axisLabel.overflow', xAxis0?.axisLabel?.overflow);
    snap('xAxis.axisLabel.interval', xAxis0?.axisLabel?.interval);
    if (agentConfig.series) {
        agentConfig.series.forEach((s, i) => {
            if (s.label?.fontSize) snap(`series[${i}].label.fontSize`, s.label.fontSize);
        });
    }

    const defaults = getMcKinseyDefaults(agentConfig);

    // FIX 2: If agent config uses pixel values for grid, don't force containLabel
    if (agentConfig.grid && gridUsesPixelValues(agentConfig.grid)) {
        // If agent explicitly set containLabel, respect it; otherwise default to false for pixel grids
        if (agentConfig.grid.containLabel === undefined) {
            defaults.grid.containLabel = false;
        }
    }

    let result = deepMerge(defaults, agentConfig);

    // Apply defaults to axis arrays (for combo charts)
    result = applyAxisArrayDefaults(result);

    // Apply default labels to series (after merge since series is an array)
    result = applyDefaultLabels(result);

    // Apply McKinsey color sequence to series without explicit colors
    result = applyColorSequence(result);

    // Process $callouts directives on series (before annotation defaults)
    result = processCallouts(result);

    // Apply brand defaults to annotation elements (graphic, markLine, markPoint, markArea)
    result = applyAnnotationDefaults(result);

    // v5.0: Apply branding number format to value axes (space separator, etc.)
    result = applyBrandingNumberFormat(result);

    // Enforce minimum font sizes for all text elements
    result = enforceMinimumFontSizes(result);

    // Auto-calculate grid margins based on label lengths
    result = calculateRequiredGridMargins(result);

    // Apply chart label alignment (title-to-label consistency)
    result = applyChartLabelAlignment(result, chartWidth || 800);

    // Auto-detect outlier data and apply axis breaks (ECharts 6+ feature)
    result = applyAutoAxisBreaks(result);

    // D1: Log overrides — compare final values to agent's original snapshot
    const check = (path, finalVal) => {
        if (path in snapshot && snapshot[path] !== finalVal) {
            console.warn(`  [override] ${path}: ${JSON.stringify(snapshot[path])} → ${JSON.stringify(finalVal)}`);
        }
    };
    check('grid.left', result.grid?.left);
    check('grid.right', result.grid?.right);
    check('grid.top', result.grid?.top);
    check('grid.bottom', result.grid?.bottom);
    check('grid.containLabel', result.grid?.containLabel);
    const rYAxis0 = Array.isArray(result.yAxis) ? result.yAxis[0] : result.yAxis;
    const rXAxis0 = Array.isArray(result.xAxis) ? result.xAxis[0] : result.xAxis;
    check('yAxis.axisLabel.overflow', rYAxis0?.axisLabel?.overflow);
    check('yAxis.axisLabel.interval', rYAxis0?.axisLabel?.interval);
    check('xAxis.axisLabel.overflow', rXAxis0?.axisLabel?.overflow);
    check('xAxis.axisLabel.interval', rXAxis0?.axisLabel?.interval);
    if (result.series) {
        result.series.forEach((s, i) => {
            check(`series[${i}].label.fontSize`, s.label?.fontSize);
        });
    }

    return result;
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 1) {
    console.error('Usage: node render_echarts.mjs <config.json> [width] [height]');
    console.error('  config.json: Path to ECharts configuration JSON file');
    console.error('  width: Chart width in pixels (default: 800)');
    console.error('  height: Chart height in pixels (default: 400)');
    process.exit(1);
}

const configPath = args[0];
const width = parseInt(args[1]) || 800;
const height = parseInt(args[2]) || 400;

// Read and parse configuration
let config;
try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    config = JSON.parse(configContent);
} catch (e) {
    console.error(JSON.stringify({
        error: `Error reading config file: ${e.message}`,
        hint: 'Ensure the file exists and contains valid JSON'
    }));
    process.exit(1);
}

// Validate config structure
if (!config.series) {
    console.error(JSON.stringify({
        error: 'Invalid ECharts config: missing "series" property',
        hint: 'ECharts requires a "series" array with at least one chart definition. Example: {"series":[{"type":"bar","data":[1,2,3]}]}'
    }));
    process.exit(1);
}

if (!Array.isArray(config.series)) {
    console.error(JSON.stringify({
        error: 'Invalid ECharts config: "series" must be an array',
        hint: 'Wrap your series in an array: {"series":[{...}]}'
    }));
    process.exit(1);
}

if (config.series.length === 0) {
    console.error(JSON.stringify({
        error: 'Invalid ECharts config: "series" array is empty',
        hint: 'Add at least one series object: {"series":[{"type":"bar","data":[1,2,3]}]}'
    }));
    process.exit(1);
}

// Validate each series has a type
const invalidSeries = config.series.map((s, i) => ({ series: s, index: i })).filter(({ series }) => !series.type);
if (invalidSeries.length > 0) {
    const firstInvalid = invalidSeries[0];
    console.error(JSON.stringify({
        error: `Series at index ${firstInvalid.index} missing "type" property`,
        hint: 'Each series needs a type like "bar", "line", "pie", "scatter", "gauge", "radar", "treemap", "heatmap", "funnel", "sankey", etc.'
    }));
    process.exit(1);
}

// Capture agent's intended grid.bottom before applyMcKinseyStyle potentially increases it
const intendedBottom = typeof config.grid?.bottom === 'number' ? config.grid.bottom : 0;

// Apply McKinsey style defaults (pass width for label alignment calculations)
const finalConfig = applyMcKinseyStyle(config, width);

// Calculate how much grid-auto increased grid.bottom beyond agent's intent
const actualBottom = typeof finalConfig.grid?.bottom === 'number' ? finalConfig.grid.bottom : 0;
const bottomDelta = Math.max(0, actualBottom - intendedBottom);
let effectiveHeight = height + bottomDelta;

if (bottomDelta > 0) {
    console.warn(`  [grid-compensate] grid.bottom: ${intendedBottom} → ${actualBottom} (delta=${bottomDelta}), render height: ${height} → ${effectiveHeight}`);
}

// A3: Auto height compensation based on category count
// Prevents guessing cycles by deriving minimum height from data density
if (isHorizontalChart(finalConfig)) {
    const catAxis = Array.isArray(finalConfig.yAxis) ? finalConfig.yAxis[0] : finalConfig.yAxis;
    const catCount = catAxis?.data?.length || 0;
    const gridTop = finalConfig.grid?.top || 10;
    const gridBottom = finalConfig.grid?.bottom || 22;
    const minHeight = Math.max(catCount * 20, 150) + gridTop + gridBottom;
    if (catCount > 0 && effectiveHeight < minHeight) {
        console.warn(`  [height-fix] Chart height ${effectiveHeight}px insufficient for ${catCount} categories. Auto-increasing: ${effectiveHeight} → ${minHeight}px`);
        effectiveHeight = minHeight;
    }
}

// Create chart in SSR mode with SVG renderer
// Uses effectiveHeight to compensate for grid-auto bottom increases
const chart = echarts.init(null, null, {
    renderer: 'svg',
    ssr: true,
    width: width,
    height: effectiveHeight
});

// Apply $callouts labelLayout callbacks (must be done just before setOption — functions can't serialise)
applyCalloutLayoutCallbacks(finalConfig);

// Apply the configuration with McKinsey defaults merged in
chart.setOption(finalConfig);

// v4.6.1: Resolve $dataCoord/$lineDataCoords on graphic elements
// Must run AFTER setOption which establishes the coordinate system
let resolvedGraphicCoords = [];
if (finalConfig.graphic) {
    const gfxStr = JSON.stringify(finalConfig.graphic);
    if (gfxStr.includes('$dataCoord') || gfxStr.includes('$lineDataCoords')) {
        const graphics = Array.isArray(finalConfig.graphic) ? finalConfig.graphic : [finalConfig.graphic];
        resolvedGraphicCoords = resolveGraphicDataCoords(graphics, chart);
        if (resolvedGraphicCoords.length > 0) {
            chart.setOption({ graphic: graphics }); // re-render with resolved positions
            console.error(`  [dataCoord] Resolved ${resolvedGraphicCoords.length} data-bound position(s)`);
        }
    }
}

// v4.7.1-hf3: Detect annotation boxes overlapping actual chart data elements (bars, lines)
// Parses the final SVG to find annotation background paths covering bar rects or series polylines.
// Returns array of BLOCKING error strings. Empty = no overlap = chart is fine.
function detectAnnotationDataOverlap(svgString) {
    const issues = [];

    // 1. Find annotation background boxes (unique ECharts label background pattern)
    const annoBoxes = [];
    const boxRegex = /<path d="M0 0l([\d.]+) 0l0 ([\d.]+)l-[\d.]+ 0Z"[^>]*transform="translate\((-?[\d.]+) (-?[\d.]+)\)"/g;
    let m;
    while ((m = boxRegex.exec(svgString)) !== null) {
        const w = parseFloat(m[1]), h = parseFloat(m[2]);
        const x = parseFloat(m[3]), y = parseFloat(m[4]);
        if (w >= 50 && h >= 15) {  // Skip small data labels
            annoBoxes.push({ x, y, w, h });
        }
    }
    // 1b. Alternative pattern: ECharts may render label backgrounds as <rect> elements
    const rectBgRegex = /<rect [^>]*fill="(?!none)[^"]*"[^>]*>/g;
    while ((m = rectBgRegex.exec(svgString)) !== null) {
        const tag = m[0];
        const xM = tag.match(/\bx="([\d.]+)"/);
        const yM = tag.match(/\by="([\d.]+)"/);
        const wM = tag.match(/\bwidth="([\d.]+)"/);
        const hM = tag.match(/\bheight="([\d.]+)"/);
        if (xM && yM && wM && hM) {
            const rx = parseFloat(xM[1]), ry = parseFloat(yM[1]);
            const rw = parseFloat(wM[1]), rh = parseFloat(hM[1]);
            // Annotation-sized boxes (wider and shorter than bars, or matching callout dims)
            if (rw >= 100 && rh >= 25 && rw < 300) {
                const exists = annoBoxes.some(a =>
                    Math.abs(a.x - rx) < 2 && Math.abs(a.y - ry) < 2);
                if (!exists) annoBoxes.push({ x: rx, y: ry, w: rw, h: rh });
            }
        }
    }

    if (annoBoxes.length === 0) return issues;

    // 2. Find bar rects — ECharts renders bars as <rect> with fill
    const barRects = [];
    const rectRegex = /<rect [^>]*>/g;
    while ((m = rectRegex.exec(svgString)) !== null) {
        const tag = m[0];
        const xM = tag.match(/\bx="([\d.]+)"/);
        const yM = tag.match(/\by="([\d.]+)"/);
        const wM = tag.match(/\bwidth="([\d.]+)"/);
        const hM = tag.match(/\bheight="([\d.]+)"/);
        if (xM && yM && wM && hM) {
            const rx = parseFloat(xM[1]), ry = parseFloat(yM[1]);
            const rw = parseFloat(wM[1]), rh = parseFloat(hM[1]);
            // Filter: bar-sized rects (not full-width grid backgrounds, not tiny ticks)
            if (rw > 8 && rh > 8 && rw < 300 && rh < 500) {
                barRects.push({ x: rx, y: ry, w: rw, h: rh });
            }
        }
    }

    // 3. Find series lines — polyline elements with many points (series data)
    const linePoints = [];  // sampled points along lines
    const polyRegex = /<polyline[^>]*points="([^"]+)"/g;
    while ((m = polyRegex.exec(svgString)) !== null) {
        const coords = m[1].trim().split(/[\s,]+/).map(Number);
        if (coords.length >= 10) {  // At least 5 data points = real series line
            for (let i = 0; i < coords.length - 1; i += 2) {
                linePoints.push({ x: coords[i], y: coords[i + 1] });
            }
        }
    }

    // 3b. v5.0: Find data labels (text elements in the chart grid — markPoint, series labels)
    // Pattern: <text> elements with specific fill colors and positioned within the grid area
    const dataLabels = [];
    const textRegex = /<text[^>]*transform="translate\((-?[\d.]+) (-?[\d.]+)\)"[^>]*>([^<]+)<\/text>/g;
    while ((m = textRegex.exec(svgString)) !== null) {
        const tx = parseFloat(m[1]), ty = parseFloat(m[2]);
        const text = m[3].trim();
        // Filter: only short numeric-ish labels (data values, not axis labels or titles)
        if (text.length > 0 && text.length <= 10 && /[\d%.]/.test(text)) {
            // Estimate bounding box (approximate: 7px per char width, 14px height)
            const estW = text.length * 7;
            const estH = 14;
            dataLabels.push({ x: tx - estW / 2, y: ty - estH / 2, w: estW, h: estH, text });
        }
    }

    console.error(`  [annotation-overlap] Found ${annoBoxes.length} annotation box(es), ` +
        `${barRects.length} bar rect(s), ${linePoints.length} line point(s), ${dataLabels.length} data label(s)`);

    // 4. Check each annotation against data elements
    for (const anno of annoBoxes) {
        const ax1 = anno.x, ay1 = anno.y;
        const ax2 = anno.x + anno.w, ay2 = anno.y + anno.h;

        // Check overlap with bars
        let barsOverlapped = 0;
        for (const bar of barRects) {
            const overlapX = Math.max(0, Math.min(ax2, bar.x + bar.w) - Math.max(ax1, bar.x));
            const overlapY = Math.max(0, Math.min(ay2, bar.y + bar.h) - Math.max(ay1, bar.y));
            if (overlapX > 2 && overlapY > 2) barsOverlapped++;
        }

        // Check if line points fall inside annotation box
        let linePointsInside = 0;
        for (const pt of linePoints) {
            if (pt.x >= ax1 && pt.x <= ax2 && pt.y >= ay1 && pt.y <= ay2) {
                linePointsInside++;
            }
        }

        if (barsOverlapped > 0 || linePointsInside >= 2) {
            const what = barsOverlapped > 0
                ? `overlaps ${barsOverlapped} bar(s)`
                : `covers ${linePointsInside} line data point(s)`;
            issues.push(
                `[BLOCKING] [annotation-overlap] Annotation box ` +
                `(${Math.round(anno.w)}×${Math.round(anno.h)}px at ${Math.round(anno.x)},${Math.round(anno.y)}) ` +
                `${what}. Annotation boxes must NOT obscure chart data. ` +
                `FIX: Reposition the annotation to empty space within the chart grid, ` +
                `or increase grid margins to create space outside the data area. ` +
                `For $callouts: increase |offsetX| or change position direction.`
            );
        }

        // v5.0: Check overlap with data labels (WARNING, not BLOCKING)
        for (const lbl of dataLabels) {
            const lx1 = lbl.x, ly1 = lbl.y;
            const lx2 = lbl.x + lbl.w, ly2 = lbl.y + lbl.h;
            const overlapX = Math.max(0, Math.min(ax2, lx2) - Math.max(ax1, lx1));
            const overlapY = Math.max(0, Math.min(ay2, ly2) - Math.max(ay1, ly1));
            if (overlapX > 2 && overlapY > 2) {
                console.warn(`  [annotation-overlap] WARNING: Annotation box ` +
                    `(${Math.round(anno.w)}×${Math.round(anno.h)}px) overlaps data label "${lbl.text}". ` +
                    `Adjust callout offsetY to avoid hiding the label.`);
                break;  // One warning per annotation box is enough
            }
        }
    }

    return issues;
}

// $callouts leader lines — draw as graphic elements using positions captured during labelLayout.
// Uses SVG parsing (primary) with approximation fallback for actual box bounds.
// This replaces the old convertToPixel approach which was off by symbolRadius.
if (finalConfig.__calloutPositions && finalConfig.__calloutPositions.length > 0) {
    // Render SVG once to extract actual callout box bounds
    const probeSvg = chart.renderToSVGString();
    const leaderGraphics = [];

    for (const pos of finalConfig.__calloutPositions) {
        let boxW = pos.totalW;  // fallback: approximation (exact for standard configs)
        let boxH = pos.totalH;
        let boxX = pos.labelX;
        let boxY = pos.labelY;

        // Primary: parse SVG for actual box path at this position (±3px tolerance)
        // ECharts renders label backgrounds as: <path d="M0 0l{W} 0l0 {H}l-{W} 0Z" transform="translate({X} {Y})"
        const svgBoxRegex = new RegExp(
            '<path d="M0 0l([\\d.]+) 0l0 ([\\d.]+)l-[\\d.]+ 0Z"[^>]*transform="translate\\(([\\d.]+) ([\\d.]+)\\)"',
            'g'
        );
        let match;
        while ((match = svgBoxRegex.exec(probeSvg)) !== null) {
            const sx = parseFloat(match[3]), sy = parseFloat(match[4]);
            if (Math.abs(sx - pos.labelX) < 3 && Math.abs(sy - pos.labelY) < 3) {
                boxW = parseFloat(match[1]);
                boxH = parseFloat(match[2]);
                boxX = sx;
                boxY = sy;
                break;
            }
        }

        // Leader line: from box edge (nearest to data point) to data point center
        const lineStartX = pos.position === 'left' ? boxX + boxW : boxX;
        const lineStartY = boxY + boxH / 2;
        leaderGraphics.push({
            type: 'line',
            shape: { x1: lineStartX, y1: lineStartY, x2: pos.dataPointX, y2: pos.dataPointY },
            style: { stroke: pos.lineColor, lineWidth: 1, lineDash: [4, 3] },
            z: 100, silent: true
        });
    }

    if (leaderGraphics.length > 0) {
        const existing = Array.isArray(finalConfig.graphic) ? finalConfig.graphic :
                         (finalConfig.graphic ? [finalConfig.graphic] : []);
        chart.setOption({ graphic: [...existing, ...leaderGraphics] });
        console.error(`  [callouts] Added ${leaderGraphics.length} leader line(s) via graphic elements (SVG-parsed bounds)`);
    }
    delete finalConfig.__calloutPositions;
}

// v4.7.1-hf3: General annotation-over-data detection (bars, lines)
// Runs on the FINAL SVG after all rendering is complete (leader lines, graphics, etc.)
const finalSvgForOverlap = chart.renderToSVGString();
const overlapIssues = detectAnnotationDataOverlap(finalSvgForOverlap);
for (const issue of overlapIssues) {
    console.error(`  ${issue}`);
}

// Extract actual content bounding box via zrender storage traversal
const zr = chart.getZr();
let contentBounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
zr.storage.traverse((el) => {
    if (el.getBoundingRect) {
        const rect = el.getBoundingRect().clone();
        if (el.transform) { rect.applyTransform(el.transform); }
        contentBounds.minX = Math.min(contentBounds.minX, rect.x);
        contentBounds.minY = Math.min(contentBounds.minY, rect.y);
        contentBounds.maxX = Math.max(contentBounds.maxX, rect.x + rect.width);
        contentBounds.maxY = Math.max(contentBounds.maxY, rect.y + rect.height);
    }
});

// A4: Label count verification — count rendered labels vs expected categories
const isHoriz = isHorizontalChart(finalConfig);
const categoryAxis = isHoriz
    ? (Array.isArray(finalConfig.yAxis) ? finalConfig.yAxis[0] : finalConfig.yAxis)
    : (Array.isArray(finalConfig.xAxis) ? finalConfig.xAxis[0] : finalConfig.xAxis);
const expectedLabels = categoryAxis?.data?.length || 0;
let renderedLabelCount = 0;

if (expectedLabels > 0) {
    const gridLeft = finalConfig.grid?.left || 0;
    const gridBottom = finalConfig.grid?.bottom || 0;
    zr.storage.traverse((el) => {
        if (el.type === 'text' && el.style?.text) {
            const rect = el.getBoundingRect().clone();
            if (el.transform) { rect.applyTransform(el.transform); }
            // For horizontal charts: labels are left of grid area
            // For vertical charts: labels are below the grid area
            if (isHoriz && rect.x < gridLeft) {
                renderedLabelCount++;
            } else if (!isHoriz && rect.y > (effectiveHeight - gridBottom - 10)) {
                renderedLabelCount++;
            }
        }
    });

    if (renderedLabelCount < expectedLabels) {
        console.error(`  [BLOCKING] [label-count] Expected ${expectedLabels} category labels, only ${renderedLabelCount} rendered. ECharts is hiding labels. Set "interval": 0 in axisLabel config.`);
    }
}

// C1: Extract final grid values for CSS variable injection by html2pptx.mjs
const finalGrid = {
    left: finalConfig.grid?.left || 0,
    right: finalConfig.grid?.right || 0,
    top: finalConfig.grid?.top || 0,
    bottom: finalConfig.grid?.bottom || 0
};

// v9: Extract resolved plot area using convertToPixel (accounts for containLabel expansion).
// Raw grid values understate the real margins when containLabel: true — ECharts expands
// the grid to fit axis labels. convertToPixel gives the actual pixel bounds.
let resolvedPlotArea = null;
try {
    const topLeft = chart.convertToPixel('grid', [0, 0]);
    const model = chart.getModel();
    const gridModel = model.getComponent('grid', 0);
    if (gridModel) {
        const gridRect = gridModel.coordinateSystem.getRect();
        resolvedPlotArea = {
            left: Math.round(gridRect.x),
            top: Math.round(gridRect.y),
            right: Math.round(width - gridRect.x - gridRect.width),
            bottom: Math.round(effectiveHeight - gridRect.y - gridRect.height),
            width: Math.round(gridRect.width),
            height: Math.round(gridRect.height),
        };
        console.error(`  [resolved-plot-area] left=${resolvedPlotArea.left} top=${resolvedPlotArea.top} right=${resolvedPlotArea.right} bottom=${resolvedPlotArea.bottom} (${resolvedPlotArea.width}×${resolvedPlotArea.height}px)`);
    }
} catch (e) {
    console.error(`  [resolved-plot-area] Could not extract: ${e.message}`);
}

// Output chart metadata to stderr for html2pptx.mjs to parse
console.error(JSON.stringify({
    __chartMeta: true,
    originalHeight: height,
    effectiveHeight: effectiveHeight,
    bottomDelta: bottomDelta,
    contentBounds: {
        minX: Math.floor(contentBounds.minX),
        minY: Math.floor(contentBounds.minY),
        maxX: Math.ceil(contentBounds.maxX),
        maxY: Math.ceil(contentBounds.maxY)
    },
    grid: finalGrid,
    resolvedPlotArea: resolvedPlotArea,
    labelCount: { expected: expectedLabels, rendered: renderedLabelCount },
    resolvedGraphicCoords: resolvedGraphicCoords  // v4.6.1: data-bound positions
}));

// Render to SVG string
const svgString = chart.renderToSVGString();

// Clean up
chart.dispose();

// Output SVG to stdout
console.log(svgString);
