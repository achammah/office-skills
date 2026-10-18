#!/usr/bin/env node
/**
 * Batch converts example HTML files from heavy format to lightweight format.
 *
 * Heavy format uses:
 * - <style> block with --mck-* variables
 * - Absolute positioning (position: absolute; left: 20pt; ...)
 * - Script tags for preview.js
 *
 * Lightweight format uses:
 * - class="brand-slide" on body
 * - Zone classes (.title-zone, .content-zone, .footer-zone)
 * - --brand-* CSS variables (injected at runtime)
 * - No <style> block needed
 *
 * Usage: node convert-examples-to-lightweight.mjs [directory]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Regular expressions for parsing
const TITLE_REGEX = /<h1[^>]*>([^<]+)<\/h1>/i;
const SUBTITLE_REGEX = /<p[^>]*style="[^"]*font-size:\s*11px[^"]*"[^>]*>([^<]+)<\/p>/i;
const SOURCE_REGEX = /<p[^>]*style="[^"]*font-size:\s*9px[^"]*"[^>]*>([^<]+)<\/p>/i;
const ECHARTS_REGEX = /<div\s+data-echarts='([^']+)'[^>]*style="[^"]*width:\s*([^;]+);\s*height:\s*([^;]+)[^"]*"[^>]*>/g;
const STYLE_BLOCK_REGEX = /<style>[\s\S]*?<\/style>\s*/gi;
const SCRIPT_TAGS_REGEX = /<script[^>]*>[\s\S]*?<\/script>\s*/gi;
const PREVIEW_SCRIPT_REGEX = /<script\s+src="[^"]*preview\.js"[^>]*>\s*<\/script>\s*/gi;

/**
 * Extract chart dimensions from style attribute
 */
function extractChartDimensions(styleAttr) {
    const widthMatch = styleAttr.match(/width:\s*([^;]+)/);
    const heightMatch = styleAttr.match(/height:\s*([^;]+)/);
    return {
        width: widthMatch ? widthMatch[1].trim() : '100%',
        height: heightMatch ? heightMatch[1].trim() : '250pt'
    };
}

/**
 * Convert a single HTML file from heavy to lightweight format
 */
function convertFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');

    // Extract title
    const titleMatch = content.match(TITLE_REGEX);
    const title = titleMatch ? titleMatch[1].replace('Example: ', '') : 'Chart Example';

    // Extract subtitle
    const subtitleMatch = content.match(SUBTITLE_REGEX);
    const subtitle = subtitleMatch ? subtitleMatch[1] : '';

    // Extract source
    const sourceMatch = content.match(SOURCE_REGEX);
    const source = sourceMatch ? sourceMatch[1] : 'Source: Example data';

    // Extract ECharts configurations
    const echartsMatches = [];
    let match;
    const echartsRegex = /<div\s+data-echarts='([^']+)'[^>]*style="([^"]*)"[^>]*>/g;
    while ((match = echartsRegex.exec(content)) !== null) {
        const styleAttr = match[2];
        const dims = extractChartDimensions(styleAttr);
        // Remove explicit colors from the config (let auto-coloring take over)
        let config = match[1];
        // Keep the original config but don't strip colors - the auto-color will only apply if no color is set
        echartsMatches.push({
            config: config,
            width: dims.width,
            height: dims.height
        });
    }

    // Build lightweight HTML
    let lightweightHtml = `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
</head>
<body class="brand-slide">
  <div class="title-zone">
    <h1 class="slide-title">${title}</h1>`;

    if (subtitle) {
        lightweightHtml += `
    <p class="slide-subtitle">${subtitle}</p>`;
    }

    lightweightHtml += `
  </div>

  <div class="content-zone">`;

    // Add charts
    if (echartsMatches.length === 1) {
        const chart = echartsMatches[0];
        lightweightHtml += `
    <div class="panel" style="flex: 1; padding: 16pt;">
      <div data-echarts='${chart.config}' style="width: 100%; height: 250pt;"></div>
    </div>`;
    } else if (echartsMatches.length > 1) {
        // Multiple charts - use grid layout
        lightweightHtml += `
    <div style="display: grid; grid-template-columns: repeat(${Math.min(echartsMatches.length, 2)}, 1fr); gap: 16pt; width: 100%;">`;
        for (const chart of echartsMatches) {
            lightweightHtml += `
      <div class="panel" style="padding: 16pt;">
        <div data-echarts='${chart.config}' style="width: 100%; height: 200pt;"></div>
      </div>`;
        }
        lightweightHtml += `
    </div>`;
    }

    lightweightHtml += `
  </div>

  <div class="footer-zone">
    <p class="source">${source}</p>
  </div>
</body>
</html>
`;

    return lightweightHtml;
}

/**
 * Process a directory of HTML files
 */
function processDirectory(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    let converted = 0;
    let skipped = 0;

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            // Skip lightweight directory
            if (entry.name === 'lightweight') {
                console.log(`Skipping lightweight directory: ${entry.name}`);
                continue;
            }
            const result = processDirectory(fullPath);
            converted += result.converted;
            skipped += result.skipped;
        } else if (entry.isFile() && entry.name.endsWith('.html')) {
            const content = fs.readFileSync(fullPath, 'utf8');

            // Check if already converted (has class="brand-slide")
            if (content.includes('class="brand-slide"')) {
                console.log(`Already converted: ${entry.name}`);
                skipped++;
                continue;
            }

            console.log(`Converting: ${fullPath}`);
            try {
                const converted = convertFile(fullPath);
                fs.writeFileSync(fullPath, converted, 'utf8');
                console.log(`  ✓ Converted successfully`);
            } catch (e) {
                console.error(`  ✗ Error: ${e.message}`);
            }
            converted++;
        }
    }

    return { converted, skipped };
}

// Main execution
const examplesDir = process.argv[2] || path.join(__dirname, '..', 'examples');

console.log(`Converting examples in: ${examplesDir}\n`);

const result = processDirectory(examplesDir);

console.log(`\nConversion complete:`);
console.log(`  Converted: ${result.converted} files`);
console.log(`  Skipped: ${result.skipped} files (already converted)`);
