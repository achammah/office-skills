#!/usr/bin/env node
/**
 * Update HTML examples to use CSS variables from branding system
 *
 * This script updates hardcoded colors in HTML/CSS to use CSS variables,
 * while leaving ECharts JSON configs unchanged (they're processed server-side).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const examplesDir = path.join(__dirname, '..', 'examples');

// CSS replacements (HTML/CSS styling only, NOT ECharts JSON)
const cssReplacements = [
    // Body background
    { from: /background:\s*#F5F3EF/gi, to: 'background: var(--mck-gray-light)' },
    // Font family
    { from: /font-family:\s*Arial,\s*sans-serif/gi, to: 'font-family: var(--mck-font-data)' },
    // H1 title color (in inline styles, not data-echarts)
    { from: /(<h1[^>]*style="[^"]*?)color:\s*#1E3A5F/gi, to: '$1color: var(--mck-navy)' },
    // Subtitle/footnote gray color (in p tags, not data-echarts)
    { from: /(<p[^>]*style="[^"]*?)color:\s*#666(?!666)/gi, to: '$1color: var(--mck-gray-dark)' },
    // Border colors in container divs (not data-echarts)
    { from: /border:\s*1px\s+solid\s+#E0E0E0/gi, to: 'border: 1px solid var(--mck-gray-border)' },
];

// Get all HTML files recursively
function getHtmlFiles(dir) {
    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...getHtmlFiles(fullPath));
        } else if (entry.name.endsWith('.html')) {
            files.push(fullPath);
        }
    }
    return files;
}

// Process a single HTML file
function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Apply CSS replacements
    for (const { from, to } of cssReplacements) {
        const newContent = content.replace(from, to);
        if (newContent !== content) {
            content = newContent;
            modified = true;
        }
    }

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        return true;
    }
    return false;
}

// Main
console.log('Updating HTML examples to use CSS variables...\n');

const htmlFiles = getHtmlFiles(examplesDir);
let updatedCount = 0;

for (const file of htmlFiles) {
    const relativePath = path.relative(examplesDir, file);
    if (processFile(file)) {
        console.log(`✓ Updated: ${relativePath}`);
        updatedCount++;
    } else {
        console.log(`  Skipped (no changes): ${relativePath}`);
    }
}

console.log(`\n${updatedCount} of ${htmlFiles.length} files updated.`);
