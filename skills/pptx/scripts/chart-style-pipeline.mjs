/**
 * Shared McKinsey Style Pipeline Functions
 *
 * Pure data transformations extracted from render_echarts.mjs for reuse by both
 * the SVG rendering pipeline and the native PptxGenJS chart translator.
 *
 * These functions have NO ECharts or SVG dependency — they operate on plain
 * config objects and produce plain config objects.
 */

import {
    getBranding,
    getColor,
    getFont,
    getFontSize,
    getChartColors,
    getEChartsDefaults
} from '../branding/branding.mjs';

// ═══════════════════════════════════════════════════════════════════════════════
// CHART TYPE DETECTION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detect if chart is horizontal (xAxis=value, yAxis=category)
 */
export function isHorizontalChart(config) {
    const xAxis = config.xAxis;
    const yAxis = config.yAxis;
    const xAxisConfig = Array.isArray(xAxis) ? xAxis[0] : xAxis;
    const yAxisConfig = Array.isArray(yAxis) ? yAxis[0] : yAxis;
    if (!xAxisConfig || !yAxisConfig) return false;
    return xAxisConfig.type === 'value' && yAxisConfig.type === 'category';
}

/**
 * Detect if chart is diverging (bars extending from center in both directions)
 */
export function isDivergingChart(config) {
    const xAxis = config.xAxis;
    const yAxis = config.yAxis;
    const xAxisConfig = Array.isArray(xAxis) ? xAxis[0] : xAxis;
    const yAxisConfig = Array.isArray(yAxis) ? yAxis[0] : yAxis;
    if (!xAxisConfig) return false;

    const hasSymmetricRange = xAxisConfig.min !== undefined &&
                              xAxisConfig.max !== undefined &&
                              xAxisConfig.min === -xAxisConfig.max;
    if (hasSymmetricRange) return true;

    const isHorizontal = xAxisConfig.type === 'value' &&
                         yAxisConfig && yAxisConfig.type === 'category';
    if (isHorizontal && config.series && Array.isArray(config.series)) {
        for (const series of config.series) {
            if (series.type === 'bar' && Array.isArray(series.data)) {
                const hasNegative = series.data.some(d => {
                    const val = typeof d === 'object' ? d.value : d;
                    return typeof val === 'number' && val < 0;
                });
                const hasPositive = series.data.some(d => {
                    const val = typeof d === 'object' ? d.value : d;
                    return typeof val === 'number' && val > 0;
                });
                if (hasNegative && hasPositive) return true;
            }
        }
    }
    return false;
}

/**
 * Check if chart is a combo chart (has both bars and lines)
 */
export function isComboChart(config) {
    if (!config.series || !Array.isArray(config.series)) return false;
    const hasBar = config.series.some(s => s.type === 'bar');
    const hasLine = config.series.some(s => s.type === 'line');
    return hasBar && hasLine;
}

/**
 * Check if chart is a pure line/area chart (no bars)
 */
export function isPureLineChart(config) {
    if (!config.series || !Array.isArray(config.series)) return false;
    const hasLine = config.series.some(s => s.type === 'line');
    const hasBar = config.series.some(s => s.type === 'bar');
    return hasLine && !hasBar;
}

/**
 * Check if series has transparent or dashed border styling (placeholder/outline)
 */
export function isPlaceholderOrOutlineSeries(series) {
    if (!series.itemStyle) return false;
    const color = series.itemStyle.color;
    const borderType = series.itemStyle.borderType;
    if (color === 'transparent' || color === 'rgba(0,0,0,0)') return true;
    if (borderType === 'dashed' || borderType === 'dotted') return true;
    return false;
}

/**
 * Count non-placeholder series in a stack
 */
export function countVisibleStackedSeries(series, allSeries) {
    if (!series.stack) return 1;
    const stackSeries = allSeries.filter(s => s.stack === series.stack);
    return stackSeries.filter(s => !isPlaceholderOrOutlineSeries(s)).length;
}

/**
 * Check if this is the top series in a stack
 */
export function isTopOfStack(series, allSeries) {
    if (!series.stack) return true;
    const stackSeries = allSeries.filter(s => s.stack === series.stack && !isPlaceholderOrOutlineSeries(s));
    if (stackSeries.length <= 1) return true;
    return stackSeries[stackSeries.length - 1] === series;
}

/**
 * Check if series uses stacking
 */
export function isStackedSeries(series, allSeries) {
    if (!series.stack) return false;
    return allSeries.filter(s => s.stack === series.stack).length > 1;
}

/**
 * Check if the stack contains a placeholder series
 */
export function stackHasPlaceholder(series, allSeries) {
    if (!series.stack) return false;
    const stackSeries = allSeries.filter(s => s.stack === series.stack);
    return stackSeries.some(s => isPlaceholderOrOutlineSeries(s));
}

/**
 * Get default label position based on chart type, series type, and context
 */
export function getDefaultLabelPosition(seriesType, isHorizontal, isCombo, isStacked) {
    if (seriesType === 'bar') {
        if (isHorizontal) {
            return isStacked ? 'insideRight' : 'right';
        }
        return isStacked ? 'insideTop' : 'top';
    }
    if (seriesType === 'line') {
        return 'top';
    }
    return 'top';
}

/**
 * Check if any series has data-item level label configuration
 */
export function hasDataItemLabels(series) {
    if (!Array.isArray(series.data)) return false;
    return series.data.some(d => d && typeof d === 'object' && d.label);
}

/**
 * Check if any other series has right-positioned labels
 */
export function hasExistingRightLabels(allSeries) {
    return allSeries.some(series => {
        if (series.label && series.label.position === 'right') return true;
        if (Array.isArray(series.data)) {
            return series.data.some(d =>
                d && typeof d === 'object' && d.label && d.label.position === 'right'
            );
        }
        return false;
    });
}

/**
 * Check if grid uses pixel values instead of percentages
 */
export function gridUsesPixelValues(grid) {
    if (!grid) return false;
    const positionProps = ['left', 'right', 'top', 'bottom'];
    return positionProps.some(prop => typeof grid[prop] === 'number');
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * McKinsey defaults for a single axis (value type)
 */
export const MCKINSEY_AXIS_DEFAULTS = {
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { show: false },
    axisLabel: { show: false }
};

// ═══════════════════════════════════════════════════════════════════════════════
// CSS VARIABLE RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════════

export const CSS_VAR_TO_COLOR_PATH = {
    '--brand-primary':       'primary.navy',
    '--brand-secondary':     'secondary.blueDark',
    '--brand-tertiary':      'secondary.blueMedium',
    '--brand-quaternary':    'secondary.blueLight',
    '--brand-quinary':       'secondary.bluePale',
    '--brand-accent':        'accent.gold',
    '--brand-positive':      'semantic.positive',
    '--brand-negative':      'semantic.negative',
    '--brand-warning':       'semantic.warning',
    '--brand-neutral':       'semantic.neutral',
    '--brand-gray-dark':     'gray.dark',
    '--brand-gray-medium':   'gray.medium',
    '--brand-gray-light':    'gray.light',
    '--brand-gray-silver':   'gray.silver',
    '--brand-gray-border':   'gray.border',
    '--brand-text':          'text.body',
    '--brand-text-primary':  'text.primary',
    '--brand-text-secondary':'text.secondary',
    '--brand-text-inverse':  'text.inverse',
    '--brand-bg-primary':    'background.primary',
    '--brand-bg-secondary':  'background.secondary',
    '--brand-bg-dark':       'background.dark',
    '--brand-surface-light':  'surface.light',
    '--brand-surface-muted':  'surface.muted',
    '--brand-chart-1':        'primary.navy',
    '--brand-chart-2':        'secondary.blueDark',
    '--brand-chart-3':        'secondary.blueMedium',
    '--brand-chart-4':        'secondary.blueLight',
    '--brand-chart-5':        'secondary.bluePale',
    '--brand-chart-6':        'accent.gold',
    '--brand-chart-7':        'gray.medium',
    '--brand-accent-teal':    'accent.teal',
    '--brand-accent-orange':  'accent.orange',
    '--brand-primary-logo':   'primary.logoBlue',
    '--brand-primary-deep':   'primary.deepBlue',
    '--brand-primary-vivid':  'primary.vividBlue',
};

/**
 * Resolve a CSS variable string to a hex color.
 * Returns original value if not a CSS variable.
 * Returns null if unknown (so auto-coloring kicks in).
 */
export function resolveCssVariable(colorValue) {
    if (typeof colorValue !== 'string') return colorValue;
    const match = colorValue.match(/^var\((--brand-[\w-]+)\)$/);
    if (!match) return colorValue;
    const varName = match[1];
    const colorPath = CSS_VAR_TO_COLOR_PATH[varName];
    if (!colorPath) {
        console.error(`[color] WARNING: Unknown CSS variable "${varName}" in ECharts config — removing to allow auto-coloring`);
        return null;
    }
    try {
        const resolved = getColor(colorPath);
        console.error(`[color] Resolved ${varName} → ${resolved}`);
        return resolved;
    } catch {
        console.error(`[color] WARNING: Failed to resolve "${varName}" — removing to allow auto-coloring`);
        return null;
    }
}

/**
 * Deep walk entire config and resolve all var(--brand-*) strings to hex.
 */
export function resolveAllCssVariables(obj) {
    if (typeof obj !== 'object' || obj === null) return;
    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            if (typeof obj[i] === 'string' && obj[i].startsWith('var(--brand-')) {
                const resolved = resolveCssVariable(obj[i]);
                obj[i] = resolved === null ? undefined : resolved;
            } else if (typeof obj[i] === 'object') {
                resolveAllCssVariables(obj[i]);
            }
        }
        return;
    }
    for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'string' && obj[key].startsWith('var(--brand-')) {
            const resolved = resolveCssVariable(obj[key]);
            if (resolved === null) delete obj[key];
            else obj[key] = resolved;
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            resolveAllCssVariables(obj[key]);
        }
    }
}

/**
 * Resolve CSS variables in a series' color properties.
 */
export function resolveSeriesCssVariables(series) {
    if (series.itemStyle?.color) {
        series.itemStyle.color = resolveCssVariable(series.itemStyle.color);
        if (series.itemStyle.color === null) {
            delete series.itemStyle.color;
            if (Object.keys(series.itemStyle).length === 0) {
                delete series.itemStyle;
            }
        }
    }
    if (series.lineStyle?.color) {
        series.lineStyle.color = resolveCssVariable(series.lineStyle.color);
        if (series.lineStyle.color === null) {
            delete series.lineStyle.color;
            if (Object.keys(series.lineStyle).length === 0) {
                delete series.lineStyle;
            }
        }
    }
    if (series.areaStyle?.color) {
        series.areaStyle.color = resolveCssVariable(series.areaStyle.color);
        if (series.areaStyle.color === null) {
            delete series.areaStyle.color;
            if (Object.keys(series.areaStyle).length === 0) {
                delete series.areaStyle;
            }
        }
    }
    if (series.data && Array.isArray(series.data)) {
        series.data.forEach((item) => {
            if (item && typeof item === 'object' && item.itemStyle?.color) {
                item.itemStyle.color = resolveCssVariable(item.itemStyle.color);
                if (item.itemStyle.color === null) {
                    delete item.itemStyle.color;
                    if (Object.keys(item.itemStyle).length === 0) {
                        delete item.itemStyle;
                    }
                }
            }
        });
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORE PIPELINE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Deep merge helper — agent config overrides defaults.
 * Arrays are NOT merged, they are replaced entirely.
 */
export function deepMerge(target, source) {
    if (source === null || source === undefined) {
        return target;
    }
    if (target === null || target === undefined) {
        return source;
    }

    const result = { ...target };

    for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            const sourceVal = source[key];
            const targetVal = target[key];

            if (Array.isArray(sourceVal)) {
                result[key] = sourceVal;
            } else if (sourceVal && typeof sourceVal === 'object' &&
                     targetVal && typeof targetVal === 'object' &&
                     !Array.isArray(targetVal)) {
                result[key] = deepMerge(targetVal, sourceVal);
            } else {
                result[key] = sourceVal;
            }
        }
    }

    return result;
}

/**
 * Get McKinsey defaults adjusted for chart type
 */
export function getMcKinseyDefaults(config) {
    const defaults = JSON.parse(JSON.stringify(getEChartsDefaults()));

    if (isHorizontalChart(config)) {
        defaults.xAxis.axisLabel = { show: false };
        defaults.yAxis.axisLabel = {
            show: true,
            fontSize: getFontSize('axisLabel'),
            color: getColor('text.body'),
            fontFamily: getFont('data')
        };
    }

    if (isDivergingChart(config)) {
        defaults.yAxis.axisLine = {
            show: true,
            onZero: true,
            lineStyle: { color: getColor('gray.dark'), width: 1 }
        };
    }

    return defaults;
}

/**
 * Apply McKinsey defaults to axis arrays (for combo charts)
 */
export function applyAxisArrayDefaults(config) {
    if (Array.isArray(config.yAxis)) {
        config.yAxis = config.yAxis.map(axis => {
            if (axis.type === 'value' || !axis.type) {
                return deepMerge(MCKINSEY_AXIS_DEFAULTS, axis);
            }
            return axis;
        });
    }

    if (Array.isArray(config.xAxis)) {
        config.xAxis = config.xAxis.map(axis => {
            if (axis.type === 'value') {
                return deepMerge(MCKINSEY_AXIS_DEFAULTS, axis);
            }
            return axis;
        });
    }

    return config;
}

/**
 * Apply default data labels to series if not specified.
 * McKinsey style: values shown directly on data points.
 */
export function applyDefaultLabels(config) {
    if (!config.series || !Array.isArray(config.series)) {
        return config;
    }

    const isHorizontal = isHorizontalChart(config);
    const isCombo = isComboChart(config);
    const isPureLine = isPureLineChart(config);
    const existingRightLabels = hasExistingRightLabels(config.series);

    config.series = config.series.map(series => {
        if (series.label) {
            return series;
        }
        if (hasDataItemLabels(series)) {
            return series;
        }
        if (isPlaceholderOrOutlineSeries(series)) {
            return series;
        }
        if (isPureLine && series.type === 'line') {
            return series;
        }

        if (series.type === 'bar' || series.type === 'line') {
            const isStacked = isStackedSeries(series, config.series);
            const hasPlaceholder = stackHasPlaceholder(series, config.series);
            const visibleStackCount = countVisibleStackedSeries(series, config.series);

            if (isStacked && visibleStackCount >= 3 && !isTopOfStack(series, config.series)) {
                return series;
            }

            let position = getDefaultLabelPosition(series.type, isHorizontal, isCombo, isStacked);

            if (hasPlaceholder && position.startsWith('inside')) {
                position = isHorizontal ? 'right' : 'top';
            }

            if (isHorizontal && position === 'right' && existingRightLabels) {
                position = 'insideRight';
            }

            const isInsidePosition = position.startsWith('inside');
            const labelColor = isInsidePosition ? getColor('text.inverse') : getColor('text.body');

            return {
                ...series,
                label: {
                    show: true,
                    position: position,
                    fontSize: getFontSize('dataLabel'),
                    color: labelColor,
                    fontFamily: getFont('data')
                }
            };
        }

        return series;
    });

    return config;
}

/**
 * Apply McKinsey color sequence to chart series.
 */
export function applyColorSequence(config) {
    const colors = getChartColors();

    resolveAllCssVariables(config);

    if (config.series && Array.isArray(config.series)) {
        config.series.forEach((series) => {
            resolveSeriesCssVariables(series);
        });
    }

    if (!config.color) {
        config.color = colors;
    }

    if (config.series && Array.isArray(config.series)) {
        config.series.forEach((series, index) => {
            if (series.itemStyle?.color) {
                return;
            }
            if (isPlaceholderOrOutlineSeries(series)) {
                return;
            }
            if (series.type === 'pie' || series.type === 'funnel' || series.type === 'treemap') {
                return;
            }
            if (series.type === 'gauge') {
                if (!series.progress?.itemStyle?.color && !series.itemStyle?.color) {
                    series.itemStyle = series.itemStyle || {};
                    series.itemStyle.color = colors[0];
                }
                return;
            }

            series.itemStyle = series.itemStyle || {};
            series.itemStyle.color = colors[index % colors.length];
        });
    }

    return config;
}

/**
 * Apply branding number format to value axes.
 */
export function applyBrandingNumberFormat(config) {
    const branding = getBranding();
    const sep = branding?.numberFormat?.thousandsSeparator;
    if (!sep) return config;

    const applyToAxis = (axisConf) => {
        if (!axisConf) return;
        const axes = Array.isArray(axisConf) ? axisConf : [axisConf];
        axes.forEach(axis => {
            if (axis.type !== 'value') return;
            if (!axis.axisLabel) axis.axisLabel = {};
            if (axis.axisLabel.formatter) return;
            if (axis.axisLabel.show === false) return;
            axis.axisLabel.formatter = function(value) {
                if (typeof value !== 'number') return value;
                const isNeg = value < 0;
                const abs = Math.abs(value);
                const parts = abs.toString().split('.');
                parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, sep);
                return (isNeg ? '-' : '') + parts.join('.');
            };
            console.warn(`  [number-format] Applied branding thousandsSeparator="${sep}" to value axis`);
        });
    };

    applyToAxis(config.yAxis);
    applyToAxis(config.xAxis);
    return config;
}

/**
 * Enforce minimum font sizes for all text elements.
 */
export function enforceMinimumFontSizes(config) {
    const MIN_AXIS_LABEL = 10;
    const MIN_AXIS_NAME = 11;
    const MIN_LEGEND = 10;
    const MIN_SERIES_LABEL = 10;
    const MIN_INSIDE_LABEL = 7;

    function enforceAxis(axis) {
        if (!axis) return;
        const axes = Array.isArray(axis) ? axis : [axis];
        axes.forEach(a => {
            if (a.axisLabel) {
                if (!a.axisLabel.fontSize || a.axisLabel.fontSize < MIN_AXIS_LABEL) {
                    const old = a.axisLabel.fontSize;
                    a.axisLabel.fontSize = MIN_AXIS_LABEL;
                    if (old) console.warn(`  [font-enforce] axisLabel.fontSize: ${old} → ${MIN_AXIS_LABEL}`);
                }
            }
            if (a.nameTextStyle) {
                if (!a.nameTextStyle.fontSize || a.nameTextStyle.fontSize < MIN_AXIS_NAME) {
                    const old = a.nameTextStyle.fontSize;
                    a.nameTextStyle.fontSize = MIN_AXIS_NAME;
                    if (old) console.warn(`  [font-enforce] nameTextStyle.fontSize: ${old} → ${MIN_AXIS_NAME}`);
                }
            }
        });
    }

    enforceAxis(config.xAxis);
    enforceAxis(config.yAxis);

    if (config.legend) {
        const legends = Array.isArray(config.legend) ? config.legend : [config.legend];
        legends.forEach(leg => {
            if (!leg.textStyle) leg.textStyle = {};
            if (!leg.textStyle.fontSize || leg.textStyle.fontSize < MIN_LEGEND) {
                const old = leg.textStyle.fontSize;
                leg.textStyle.fontSize = MIN_LEGEND;
                if (old) console.warn(`  [font-enforce] legend.textStyle.fontSize: ${old} → ${MIN_LEGEND}`);
            }
        });
    }

    if (config.series && Array.isArray(config.series)) {
        config.series.forEach((series, si) => {
            const isInsideLabel = series.label && series.label.position === 'inside';
            const seriesMin = isInsideLabel ? MIN_INSIDE_LABEL : MIN_SERIES_LABEL;
            if (series.label && series.label.fontSize && series.label.fontSize < seriesMin) {
                console.warn(`  [font-enforce] series[${si}].label.fontSize: ${series.label.fontSize} → ${seriesMin}`);
                series.label.fontSize = seriesMin;
            }
            if (Array.isArray(series.data)) {
                series.data.forEach((item, di) => {
                    if (typeof item === 'object' && item?.label?.fontSize && item.label.fontSize < MIN_SERIES_LABEL) {
                        const itemIsInside = item.label.position === 'inside' || isInsideLabel;
                        const itemMin = itemIsInside ? MIN_INSIDE_LABEL : MIN_SERIES_LABEL;
                        if (item.label.fontSize < itemMin) {
                            console.warn(`  [font-enforce] series[${si}].data[${di}].label.fontSize: ${item.label.fontSize} → ${itemMin}`);
                            item.label.fontSize = itemMin;
                        }
                    }
                });
            }
        });
    }

    // Graphic text elements
    const MIN_GRAPHIC_TEXT = 9;
    function enforceGraphicFontSize(el) {
        if (!el || typeof el !== 'object') return;
        if (el.type === 'text' && el.style?.font) {
            const fontMatch = el.style.font.match(/(\d+(?:\.\d+)?)\s*px/);
            if (fontMatch) {
                const size = parseFloat(fontMatch[1]);
                if (size < MIN_GRAPHIC_TEXT) {
                    console.warn(`  [font-enforce] graphic text.font: ${size}px → ${MIN_GRAPHIC_TEXT}px`);
                    el.style.font = el.style.font.replace(/(\d+(?:\.\d+)?)\s*px/, `${MIN_GRAPHIC_TEXT}px`);
                }
            }
        }
        if (el.children && Array.isArray(el.children)) {
            el.children.forEach(child => enforceGraphicFontSize(child));
        }
    }
    if (config.graphic) {
        const graphics = Array.isArray(config.graphic) ? config.graphic : [config.graphic];
        graphics.forEach(g => enforceGraphicFontSize(g));
    }

    return config;
}
