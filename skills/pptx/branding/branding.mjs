#!/usr/bin/env node
/**
 * Branding Configuration Loader (v2)
 *
 * Loads branding configuration from JSON files and provides utilities
 * for accessing colors, typography, and other design tokens.
 *
 * v2 Enhancement: Adds generateInjectableCSS() for runtime CSS injection
 * in the html2pptx conversion pipeline.
 *
 * Usage:
 *   import { loadBranding, getBranding, getColor, getFont, generateInjectableCSS } from './branding/branding.mjs';
 *
 *   // Load a specific brand (defaults to 'mckinsey')
 *   const brand = loadBranding('mckinsey');
 *
 *   // Or use the singleton pattern
 *   const color = getColor('primary.navy');  // Returns '#1E3A5F'
 *   const font = getFont('heading');         // Returns 'Georgia, Times New Roman, serif'
 *
 *   // Generate CSS for runtime injection
 *   const css = generateInjectableCSS({ includeHelpers: true });
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Singleton cache for loaded branding
let currentBranding = null;
let currentBrandId = null;

/**
 * Load branding configuration from JSON file
 * @param {string} brandId - Brand identifier (e.g., 'mckinsey', 'custom')
 * @returns {object} Branding configuration object
 */
export function loadBranding(brandId = 'mckinsey') {
    if (currentBrandId === brandId && currentBranding) {
        return currentBranding;
    }

    const brandingPath = path.join(__dirname, `${brandId}.json`);

    if (!fs.existsSync(brandingPath)) {
        throw new Error(`Branding configuration not found: ${brandingPath}\nAvailable brands: ${listAvailableBrands().join(', ')}`);
    }

    try {
        const content = fs.readFileSync(brandingPath, 'utf8');
        currentBranding = JSON.parse(content);
        currentBrandId = brandId;
        return currentBranding;
    } catch (e) {
        throw new Error(`Error loading branding '${brandId}': ${e.message}`);
    }
}

/**
 * Get the currently loaded branding (loads mckinsey if none loaded)
 * @returns {object} Current branding configuration
 */
export function getBranding() {
    if (!currentBranding) {
        loadBranding('mckinsey');
    }
    return currentBranding;
}

/**
 * List all available branding configurations
 * @returns {string[]} Array of brand IDs
 */
export function listAvailableBrands() {
    const files = fs.readdirSync(__dirname);
    return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
}

/**
 * Get a nested value from an object using dot notation
 * @param {object} obj - Object to search
 * @param {string} path - Dot-notated path (e.g., 'colors.primary.navy')
 * @returns {any} Value at path or undefined
 */
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
}

/**
 * Get a color from the current branding
 * @param {string} colorPath - Dot-notated path (e.g., 'primary.navy', 'semantic.positive')
 * @returns {string} Hex color code
 */
export function getColor(colorPath) {
    const branding = getBranding();
    const color = getNestedValue(branding.colors, colorPath);
    if (!color) {
        throw new Error(`Color not found: ${colorPath}`);
    }
    return color;
}

/**
 * Get a font family from the current branding
 * @param {string} fontType - Font type ('heading', 'body', 'data', 'code')
 * @returns {string} CSS font-family string
 */
export function getFont(fontType) {
    const branding = getBranding();
    const font = branding.typography?.families?.[fontType];
    if (!font) {
        throw new Error(`Font type not found: ${fontType}`);
    }
    return font;
}

/**
 * Get font size from the current branding
 * @param {string} element - Element type (e.g., 'actionTitle', 'body', 'dataLabel')
 * @param {string} variant - Size variant ('min', 'max', 'default')
 * @returns {number} Font size in points
 */
export function getFontSize(element, variant = 'default') {
    const branding = getBranding();
    const sizeConfig = branding.typography?.sizes?.[element];
    if (!sizeConfig) {
        throw new Error(`Font size not found for element: ${element}`);
    }
    return sizeConfig[variant] || sizeConfig.default;
}

/**
 * Get the chart color sequence for the current branding
 * @returns {string[]} Array of hex color codes
 */
export function getChartColors() {
    const branding = getBranding();
    return branding.colorSequence?.charts || [];
}

/**
 * Get a specific color from the chart sequence
 * @param {number} index - Zero-based index
 * @returns {string} Hex color code
 */
export function getChartColor(index) {
    const colors = getChartColors();
    return colors[index % colors.length];
}

/**
 * Get spacing value from the current branding
 * @param {string} size - Size name ('xs', 'sm', 'md', 'lg', 'xl', 'xxl')
 * @returns {number} Spacing value in base units
 */
export function getSpacing(size) {
    const branding = getBranding();
    return branding.spacing?.scale?.[size] || branding.spacing?.base || 4;
}

/**
 * Get CSS variables object for the current branding
 * @returns {object} Object with CSS variable names as keys
 */
export function getCSSVariables() {
    const branding = getBranding();
    return branding.cssVariables || {};
}

/**
 * Generate CSS :root block with all branding variables
 * @returns {string} CSS string with :root variables
 */
export function generateCSSRoot() {
    const vars = getCSSVariables();
    const lines = Object.entries(vars).map(([key, value]) => `  ${key}: ${value};`);
    return `:root {\n${lines.join('\n')}\n}`;
}

/**
 * Generate brand CSS variables for runtime injection
 * Uses --brand-* naming convention for brand-agnostic styling
 * @returns {string} CSS string with :root block containing brand variables
 */
function generateBrandCSSVariables() {
    const branding = getBranding();
    const vars = [];

    // Primary colors
    vars.push(`--brand-primary: ${branding.colors?.primary?.navy || '#1E3A5F'}`);
    vars.push(`--brand-secondary: ${branding.colors?.secondary?.blueDark || '#2E75B6'}`);
    vars.push(`--brand-tertiary: ${branding.colors?.secondary?.blueMedium || '#5B9BD5'}`);
    vars.push(`--brand-quaternary: ${branding.colors?.secondary?.blueLight || '#A8C8E8'}`);
    vars.push(`--brand-quinary: ${branding.colors?.secondary?.bluePale || '#D6E6F4'}`);

    // v3.9 Fix B1: Chart color sequence (all 7 for data series)
    vars.push(`--brand-chart-1: ${branding.colors?.primary?.navy || '#1E3A5F'}`);
    vars.push(`--brand-chart-2: ${branding.colors?.secondary?.blueDark || '#2E75B6'}`);
    vars.push(`--brand-chart-3: ${branding.colors?.secondary?.blueMedium || '#5B9BD5'}`);
    vars.push(`--brand-chart-4: ${branding.colors?.secondary?.blueLight || '#A8C8E8'}`);
    vars.push(`--brand-chart-5: ${branding.colors?.secondary?.bluePale || '#D6E6F4'}`);
    vars.push(`--brand-chart-6: ${branding.colors?.accent?.gold || '#B8975C'}`);
    vars.push(`--brand-chart-7: ${branding.colors?.gray?.medium || '#D0D0D0'}`);

    // Accent colors
    vars.push(`--brand-accent: ${branding.colors?.accent?.gold || '#B8975C'}`);
    // Accent teal/orange — available for chart data series, line colors, and annotations.
    // Usage guidance in slide_standardisation.md §4 Tier 2: only when inspiration shows them.
    vars.push(`--brand-accent-teal: ${branding.colors?.accent?.teal || '#00A0AF'}`);
    vars.push(`--brand-accent-orange: ${branding.colors?.accent?.orange || '#E87722'}`);

    // Semantic colors
    vars.push(`--brand-positive: ${branding.colors?.semantic?.positive || '#2E7D32'}`);
    vars.push(`--brand-negative: ${branding.colors?.semantic?.negative || '#C62828'}`);
    vars.push(`--brand-warning: ${branding.colors?.semantic?.warning || '#F3C13A'}`);
    vars.push(`--brand-neutral: ${branding.colors?.semantic?.neutral || '#A2AAAD'}`);

    // Gray palette
    vars.push(`--brand-gray-dark: ${branding.colors?.gray?.dark || '#666666'}`);
    vars.push(`--brand-gray-medium: ${branding.colors?.gray?.medium || '#D0D0D0'}`);
    vars.push(`--brand-gray-light: ${branding.colors?.gray?.light || '#F5F3EF'}`);
    vars.push(`--brand-gray-silver: ${branding.colors?.gray?.silver || '#C0C5C9'}`);
    vars.push(`--brand-gray-border: ${branding.colors?.gray?.border || '#E0E0E0'}`);

    // Text colors
    vars.push(`--brand-text: ${branding.colors?.text?.body || '#333333'}`);
    vars.push(`--brand-text-primary: ${branding.colors?.text?.primary || '#222222'}`);
    vars.push(`--brand-text-secondary: ${branding.colors?.text?.secondary || '#666666'}`);
    vars.push(`--brand-text-inverse: ${branding.colors?.text?.inverse || '#FFFFFF'}`);

    // Background colors
    vars.push(`--brand-bg-primary: ${branding.colors?.background?.primary || '#FFFFFF'}`);
    vars.push(`--brand-bg-secondary: ${branding.colors?.background?.secondary || '#F5F3EF'}`);
    vars.push(`--brand-bg-dark: ${branding.colors?.background?.dark || '#132B4D'}`);

    // Surface colors (panel/section tints)
    vars.push(`--brand-surface-light: ${branding.colors?.surface?.light || '#DAE3F3'}`);
    vars.push(`--brand-surface-muted: ${branding.colors?.surface?.muted || '#F2F2F2'}`);

    // Typography
    vars.push(`--brand-font-data: ${branding.typography?.families?.data || 'Arial, Helvetica, sans-serif'}`);
    vars.push(`--brand-font-body: ${branding.typography?.families?.body || 'Arial, Helvetica, sans-serif'}`);
    vars.push(`--brand-font-heading: ${branding.typography?.families?.heading || 'Georgia, Times New Roman, serif'}`);

    // Slide dimensions (reference)
    const dims = branding.slide?.dimensions || { width: 720, height: 405 };
    vars.push(`--slide-width: ${dims.width}pt`);
    vars.push(`--slide-height: ${dims.height}pt`);

    return `:root {\n  ${vars.join(';\n  ')};\n}\n`;
}

/**
 * Generate optional helper classes for common slide elements
 * These use low specificity so they can be easily overridden
 * @returns {string} CSS string with helper class definitions
 */
function generateHelperClasses() {
    return `
/* ============================
   PPTX v2 - Optional Helper Classes
   Use these for convenience; override with inline styles as needed
   ============================ */

/* Base slide setup - OPTIONAL */
.brand-slide {
  width: var(--slide-width);
  height: var(--slide-height);
  margin: 0;
  padding: 0;
  background: var(--brand-gray-light);
  font-family: var(--brand-font-data);
  position: relative;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

/* Zone containers - OPTIONAL */
.title-zone {
  min-height: 40pt;
  padding: 12pt 6pt 8pt 6pt;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  flex-shrink: 0;
}

.content-zone {
  flex: 1;
  padding: 0 6pt;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.footer-zone {
  height: 30pt;
  padding: 0 6pt;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

/* Title styling - OPTIONAL */
.slide-title {
  color: var(--brand-primary);
  font-size: 22px;
  font-weight: bold;
  font-family: var(--brand-font-heading);
  margin: 0;
  line-height: 1.3;
}

.slide-subtitle {
  color: var(--brand-gray-dark);
  font-size: 11px;
  margin: 4pt 0 0 0;
}

.section-id {
  color: var(--brand-primary);
  font-size: 10px;
  margin: 0 0 4pt 0;
  font-weight: normal;
}

/* Footer elements - OPTIONAL */
.source {
  color: var(--brand-gray-dark);
  font-size: 9px;
  margin: 0;
}

.page-num {
  color: var(--brand-gray-dark);
  font-size: 9px;
  margin: 0;
}

/* Chart container with title - OPTIONAL */
.chart-container {
  padding: 8pt 0;
}
.chart-container > p:first-child {
  font-size: 11px;
  font-weight: bold;
  color: var(--brand-primary);
  margin: 0 0 8pt 0;
}

/* Container with border - OPTIONAL */
.panel {
  background: var(--brand-bg-primary);
  border: 1px solid var(--brand-gray-border);
  box-sizing: border-box;
}

/* Take-away / callout box — uses primary brand color with white text */
.callout {
  background: var(--brand-primary);
  color: var(--brand-text-inverse);
  padding: 10pt 14pt;
  box-sizing: border-box;
}
.callout strong,
.callout b {
  color: var(--brand-text-inverse);
}
.callout p {
  color: var(--brand-text-inverse);
  margin: 0;
}

/* Semantic text colors - OPTIONAL */
.text-positive { color: var(--brand-positive); }
.text-negative { color: var(--brand-negative); }
.text-warning { color: var(--brand-warning); }
.text-accent { color: var(--brand-accent); }
.text-primary { color: var(--brand-primary); }
.text-secondary { color: var(--brand-text-secondary); }
.text-inverse { color: var(--brand-text-inverse); }

/* Background variants - OPTIONAL */
.bg-primary { background: var(--brand-primary); }
.bg-secondary { background: var(--brand-secondary); }
.bg-light { background: var(--brand-gray-light); }
.bg-white { background: var(--brand-bg-primary); }
.bg-dark { background: var(--brand-bg-dark); }
`;
}

/**
 * Generate CSS to inject into HTML before rendering.
 * Only injects variables and optional helper classes.
 * Does NOT enforce rigid layouts - positioning remains flexible.
 *
 * @param {object} options - Configuration options
 * @param {boolean} options.includeHelpers - Include optional helper classes (default: true)
 * @returns {string} CSS string ready for injection
 */
export function generateInjectableCSS(options = {}) {
    const { includeHelpers = true } = options;

    let css = generateBrandCSSVariables();

    if (includeHelpers) {
        css += generateHelperClasses();
    }

    return css;
}

/**
 * Get McKinsey-style defaults for ECharts
 * These are the same defaults used in render_echarts.mjs but derived from branding config.
 *
 * NOTE: containLabel is set to true here as a safe default, but render_echarts.mjs
 * overrides it to false per chart type via applyChartLabelAlignment() for precise
 * label positioning and title-to-label alignment. Do not rely on this default
 * for manual label positioning.
 *
 * @returns {object} ECharts option defaults
 */
export function getEChartsDefaults() {
    const branding = getBranding();
    const colors = branding.colors;
    const typography = branding.typography;
    const charts = branding.charts;

    return {
        animation: false,
        grid: {
            left: "3%",
            right: "4%",
            top: "10%",
            bottom: "10%",
            containLabel: true  // Overridden to false per chart type by render_echarts.mjs
        },
        xAxis: {
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { show: charts?.axis?.showGridlines || false },
            axisLabel: {
                fontSize: charts?.labels?.fontSize || 11,
                color: colors?.text?.body || "#333",
                fontFamily: typography?.families?.data || "Arial, sans-serif"
            }
        },
        yAxis: {
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { show: false }
        }
    };
}

/**
 * Get waterfall chart colors from branding
 * @returns {object} Object with total, addition, subtraction, remainder colors
 */
export function getWaterfallColors() {
    const branding = getBranding();
    return branding.colorSequence?.waterfall || {
        total: branding.colors?.primary?.navy || '#1E3A5F',
        addition: branding.colors?.primary?.navy || '#1E3A5F',
        subtraction: branding.colors?.gray?.medium || '#D0D0D0',
        remainder: branding.colors?.accent?.gold || '#B8975C'
    };
}

/**
 * Get semantic colors (positive/negative/warning/neutral)
 * @returns {object} Object with semantic color values
 */
export function getSemanticColors() {
    const branding = getBranding();
    return branding.colors?.semantic || {
        positive: '#2E7D32',
        negative: '#C62828',
        warning: '#F3C13A',
        neutral: '#A2AAAD'
    };
}

/**
 * Get slide dimensions from branding
 * @returns {object} Object with width, height, unit
 */
export function getSlideDimensions() {
    const branding = getBranding();
    return branding.slide?.dimensions || { width: 720, height: 405, unit: 'pt' };
}

/**
 * Get slide zone specifications
 * @returns {object} Object with header, body, footer zones
 */
export function getSlideZones() {
    const branding = getBranding();
    return branding.slide?.zones || {
        header: { height: 60, yStart: 0, yEnd: 60 },
        body: { height: 315, yStart: 60, yEnd: 375 },
        footer: { height: 30, yStart: 375, yEnd: 405 }
    };
}

/**
 * Get table styling from branding
 * @returns {object} Table styling configuration
 */
export function getTableStyles() {
    const branding = getBranding();
    return branding.tables || {};
}

/**
 * Validate a color value against branding
 * @param {string} color - Hex color to validate
 * @returns {boolean} True if color exists in branding palette
 */
export function isValidBrandColor(color) {
    const branding = getBranding();
    const allColors = JSON.stringify(branding.colors);
    return allColors.includes(color.toUpperCase()) || allColors.includes(color.toLowerCase());
}

// Export branding configuration directly for convenience
export { currentBranding as branding };

// CLI support: if run directly, output branding info
if (process.argv[1] && process.argv[1].includes('branding.mjs')) {
    const args = process.argv.slice(2);
    const command = args[0];
    const brandId = args[1] || 'mckinsey';

    try {
        const branding = loadBranding(brandId);

        switch (command) {
            case 'colors':
                console.log(JSON.stringify(branding.colors, null, 2));
                break;
            case 'typography':
                console.log(JSON.stringify(branding.typography, null, 2));
                break;
            case 'css':
                console.log(generateCSSRoot());
                break;
            case 'injectable':
                console.log(generateInjectableCSS({ includeHelpers: true }));
                break;
            case 'variables':
                console.log(generateBrandCSSVariables());
                break;
            case 'helpers':
                console.log(generateHelperClasses());
                break;
            case 'echarts':
                console.log(JSON.stringify(getEChartsDefaults(), null, 2));
                break;
            case 'list':
                console.log('Available brands:', listAvailableBrands().join(', '));
                break;
            default:
                console.log(`Brand: ${branding.name} (${branding.id})`);
                console.log(`Version: ${branding.version}`);
                console.log(`Description: ${branding.description}`);
                console.log('\nCommands:');
                console.log('  node branding.mjs colors [brand]     - Print color palette');
                console.log('  node branding.mjs typography [brand] - Print typography');
                console.log('  node branding.mjs css [brand]        - Generate legacy CSS variables');
                console.log('  node branding.mjs injectable [brand] - Generate injectable CSS (v2)');
                console.log('  node branding.mjs variables [brand]  - Generate brand CSS variables only');
                console.log('  node branding.mjs helpers            - Generate helper classes only');
                console.log('  node branding.mjs echarts [brand]    - Get ECharts defaults');
                console.log('  node branding.mjs list               - List available brands');
        }
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}
