#!/usr/bin/env node
/**
 * Strips explicit itemStyle.color from ECharts configs in HTML files.
 * This allows the automatic color sequencing from branding to take effect.
 *
 * Only removes simple itemStyle.color definitions - preserves:
 * - Semantic colors (for waterfall charts with transparent/positive/negative)
 * - Data-item level colors
 * - Complex itemStyle configurations with other properties
 *
 * Usage: node strip-explicit-colors.mjs [directory]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// McKinsey color palette that should be removed (let auto-coloring apply)
const COLORS_TO_REMOVE = [
    '#1E3A5F',  // Navy (primary)
    '#2E75B6',  // Blue dark
    '#5B9BD5',  // Blue medium
    '#A8C8E8',  // Blue light
    '#D6E6F4',  // Blue pale
    '#B8975C',  // Gold
    '#D0D0D0',  // Gray medium
];

/**
 * Remove simple itemStyle.color from a series object string
 * Preserves the structure but removes the color property
 */
function stripColorFromSeries(configStr) {
    // Pattern to match "itemStyle": {"color": "#XXXXXX"} or similar
    // This is a simplified approach - we'll parse and rebuild

    try {
        const config = JSON.parse(configStr);

        if (config.series && Array.isArray(config.series)) {
            config.series = config.series.map(series => {
                if (series.itemStyle && series.itemStyle.color) {
                    const color = series.itemStyle.color;

                    // Only remove if it's a simple color from our palette
                    if (COLORS_TO_REMOVE.includes(color.toUpperCase()) ||
                        COLORS_TO_REMOVE.includes(color)) {

                        // If itemStyle only has color, remove the whole itemStyle
                        if (Object.keys(series.itemStyle).length === 1) {
                            delete series.itemStyle;
                        } else {
                            // Otherwise just remove the color
                            delete series.itemStyle.color;
                        }
                    }
                }
                return series;
            });
        }

        return JSON.stringify(config);
    } catch (e) {
        // If parsing fails, return original
        console.warn(`  Warning: Could not parse config, skipping color stripping`);
        return configStr;
    }
}

/**
 * Process a single HTML file
 */
function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Find all data-echarts attributes
    const regex = /data-echarts='([^']+)'/g;
    let match;
    const replacements = [];

    while ((match = regex.exec(content)) !== null) {
        const originalConfig = match[1];
        const strippedConfig = stripColorFromSeries(originalConfig);

        if (strippedConfig !== originalConfig) {
            replacements.push({
                original: match[0],
                replacement: `data-echarts='${strippedConfig}'`
            });
            modified = true;
        }
    }

    // Apply replacements
    for (const r of replacements) {
        content = content.replace(r.original, r.replacement);
    }

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
    }

    return modified;
}

/**
 * Process a directory of HTML files
 */
function processDirectory(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    let modified = 0;
    let unchanged = 0;

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            const result = processDirectory(fullPath);
            modified += result.modified;
            unchanged += result.unchanged;
        } else if (entry.isFile() && entry.name.endsWith('.html')) {
            console.log(`Processing: ${entry.name}`);
            if (processFile(fullPath)) {
                console.log(`  ✓ Colors stripped`);
                modified++;
            } else {
                console.log(`  - No changes needed`);
                unchanged++;
            }
        }
    }

    return { modified, unchanged };
}

// Main execution
const examplesDir = process.argv[2] || path.join(__dirname, '..', 'examples');

console.log(`Stripping explicit colors in: ${examplesDir}\n`);

const result = processDirectory(examplesDir);

console.log(`\nComplete:`);
console.log(`  Modified: ${result.modified} files`);
console.log(`  Unchanged: ${result.unchanged} files`);
