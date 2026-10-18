#!/usr/bin/env node

/**
 * detect_metadata.cjs — Auto-detect layout pattern metadata for HTML templates.
 *
 * Analyzes each HTML file in examples/ and determines the appropriate
 * data-layout attribute based on category defaults and content analysis.
 *
 * Usage:
 *   node scripts/detect_metadata.cjs --dry-run   # Report what would be applied
 *   node scripts/detect_metadata.cjs --apply      # Apply metadata to all templates
 *   node scripts/detect_metadata.cjs --json       # JSON output for review
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// ── Category → Default Pattern Mapping ──
const CATEGORY_DEFAULTS = {
  'data-breakdown':       { layout: 'chart-with-insights', slideType: null },
  'data-ranking':         { layout: 'chart-with-insights', slideType: null },
  'data-trend':           { layout: 'chart-with-insights', slideType: null },
  'data-correlation':     { layout: 'chart-with-insights', slideType: null },
  'data-performance':     { layout: 'kpi-grid',            slideType: null },
  'narrative-text-insight': { layout: 'text-insight',      slideType: null },
  'narrative-case-study':   { layout: 'text-insight',      slideType: null },
  'narrative-diagnostic':   { layout: 'diagram',           slideType: null },
  'narrative-quotes':       { layout: 'text-insight',      slideType: null },
  'compare-table':        { layout: 'comparison-grid',     slideType: null },
  'compare-side-by-side': { layout: 'side-by-side',        slideType: null },
  'compare-scenario':     { layout: 'side-by-side',        slideType: null },
  'compare-gap':          { layout: 'side-by-side',        slideType: null },
  'structure-cover':      { layout: 'hero-cover',          slideType: 'structural' },
  'structure-agenda':     { layout: 'numbered-items',      slideType: 'structural' },
  'structure-summary':    { layout: 'full-container',      slideType: 'structural' },
  'structure-context':    { layout: 'full-container',      slideType: 'structural' },
  'structure-next-steps': { layout: 'action-table',        slideType: 'structural' },
  'explain-system':       { layout: 'diagram',             slideType: null },
  'explain-metaphor':     { layout: 'diagram',             slideType: null },
  'explain-framework':    { layout: 'diagram',             slideType: null },
  'explain-hierarchy':    { layout: 'diagram',             slideType: null },
  'explain-matrix':       { layout: 'diagram',             slideType: null },
  'flow-timeline':        { layout: 'process-flow',        slideType: null },
  'flow-step-by-step':    { layout: 'process-flow',        slideType: null },
  'flow-value-chain':     { layout: 'process-flow',        slideType: null },
  'flow-cycle':           { layout: 'process-flow',        slideType: null },
  'flow-funnel':          { layout: 'process-flow',        slideType: null },
  'flow-branching':       { layout: 'process-flow',        slideType: null },
};

// ── Per-template overrides ──
const TEMPLATE_OVERRIDES = {
  'structure-summary/dashboard.html': 'kpi-grid',
};

/**
 * Analyze HTML content to detect the best layout pattern.
 */
function analyzeContent(document) {
  const analysis = {};

  // Count ECharts elements
  const echartsEls = document.querySelectorAll('[data-echarts]');
  analysis.chartCount = echartsEls.length;

  // Count tables
  analysis.tableCount = document.querySelectorAll('table').length;

  // Count grid-like flex rows (3+ uniformly-structured children)
  let gridRowCount = 0;
  document.querySelectorAll('[style*="display: flex"], [style*="display:flex"]').forEach(row => {
    const s = row.getAttribute('style') || '';
    if (/flex-direction\s*:\s*column/i.test(s)) return;
    if (row.children.length >= 3) gridRowCount++;
  });
  analysis.gridRowCount = gridRowCount;

  // Count significant SVGs (area > 500px²)
  let significantSvgCount = 0;
  document.querySelectorAll('svg').forEach(svg => {
    const style = svg.getAttribute('style') || '';
    const w = parseFloat(svg.getAttribute('width') || (style.match(/width\s*:\s*(\d+)/) || [])[1] || '0');
    const h = parseFloat(svg.getAttribute('height') || (style.match(/height\s*:\s*(\d+)/) || [])[1] || '0');
    if (w * h > 500) significantSvgCount++;
  });
  analysis.significantSvgCount = significantSvgCount;

  // Count content-zone flex-row children (panel count)
  const contentZone = document.querySelector('.content-zone');
  analysis.panelCount = 0;
  if (contentZone) {
    // Find first-level flex row in content zone
    const flexRows = contentZone.querySelectorAll('[style*="display: flex"], [style*="display:flex"]');
    flexRows.forEach(row => {
      const s = row.getAttribute('style') || '';
      if (/flex-direction\s*:\s*column/i.test(s)) return;
      // Check if this is a direct child or near-direct child of content-zone
      let parent = row.parentElement;
      let depth = 0;
      while (parent && parent !== contentZone && depth < 2) {
        parent = parent.parentElement;
        depth++;
      }
      if (parent === contentZone) {
        analysis.panelCount = Math.max(analysis.panelCount, row.children.length);
      }
    });
  }

  // Check for single dominant bordered container (full-container pattern)
  analysis.hasDominantContainer = false;
  if (contentZone) {
    const children = Array.from(contentZone.children);
    for (const child of children) {
      const cs = child.getAttribute('style') || '';
      const hasBorder = /border\s*:/i.test(cs);
      const hasFlex1 = /flex\s*:\s*1/i.test(cs);
      if (hasBorder && hasFlex1) {
        analysis.hasDominantContainer = true;
        break;
      }
    }
    // Also check one level deeper (column wrapper)
    if (!analysis.hasDominantContainer && children.length === 1) {
      const wrapper = children[0];
      for (const child of wrapper.children) {
        const cs = child.getAttribute('style') || '';
        const hasBorder = /border\s*:/i.test(cs);
        const hasFlex1 = /flex\s*:\s*1/i.test(cs);
        if (hasBorder && hasFlex1) {
          analysis.hasDominantContainer = true;
          break;
        }
      }
    }
  }

  // Check for numbered/ordered items
  analysis.hasNumberedItems = false;
  const olElements = document.querySelectorAll('ol');
  if (olElements.length > 0) analysis.hasNumberedItems = true;
  // Also check for manual numbering patterns (divs with number text like "01", "1.", etc.)
  document.querySelectorAll('[style*="font-size"]').forEach(el => {
    const text = el.textContent.trim();
    if (/^(0[1-9]|[1-9]\d?)\.?$/.test(text)) analysis.hasNumberedItems = true;
  });

  return analysis;
}

/**
 * Determine the best layout pattern for a template.
 */
function detectLayout(filePath, document) {
  // Extract L2 category from file path
  const examplesDir = path.resolve(__dirname, '..', 'examples');
  const relPath = path.relative(examplesDir, filePath);
  const parts = relPath.split(path.sep);
  const category = parts[0]; // e.g., "data-ranking"
  const fileName = parts.slice(1).join('/'); // e.g., "bar-with-callouts.html"
  const templateKey = `${category}/${fileName}`;

  // Check for per-template override first
  if (TEMPLATE_OVERRIDES[templateKey]) {
    return {
      filePath: relPath,
      category,
      detectedLayout: TEMPLATE_OVERRIDES[templateKey],
      categoryDefault: CATEGORY_DEFAULTS[category]?.layout || 'unknown',
      override: 'template-override',
      confidence: 'high',
    };
  }

  const categoryDef = CATEGORY_DEFAULTS[category];
  if (!categoryDef) {
    return {
      filePath: relPath,
      category,
      detectedLayout: null,
      categoryDefault: 'unknown',
      override: 'no-mapping',
      confidence: 'low',
    };
  }

  const analysis = analyzeContent(document);
  let detectedLayout = categoryDef.layout;
  let override = 'category-default';
  let confidence = 'high';

  // Content-based overrides
  // Chart categories: check if chart has sidebar or not
  if (categoryDef.layout === 'chart-with-insights') {
    if (analysis.chartCount === 0) {
      // No charts found — use category default anyway (template SHOULD have charts)
      confidence = 'medium';
    } else if (analysis.panelCount < 2) {
      // Chart exists but no side-by-side panel → chart-standalone
      detectedLayout = 'chart-standalone';
      override = 'content-detected';
      confidence = 'high';
    }
  }

  // structure-summary/dashboard → kpi-grid override
  if (category === 'structure-summary' && analysis.chartCount > 0) {
    detectedLayout = 'kpi-grid';
    override = 'content-detected';
  }

  return {
    filePath: relPath,
    category,
    detectedLayout,
    categoryDefault: categoryDef.layout,
    slideType: categoryDef.slideType,
    override,
    confidence,
    analysis,
  };
}

/**
 * Apply data-layout to an HTML file's <body> tag.
 */
function applyMetadata(filePath, layout) {
  let html = fs.readFileSync(filePath, 'utf-8');

  // Match the <body> tag
  const bodyRegex = /(<body\s[^>]*?)>/i;
  const match = html.match(bodyRegex);
  if (!match) {
    // Try bare <body>
    const bareBody = /<body>/i;
    if (bareBody.test(html)) {
      html = html.replace(bareBody, `<body data-layout="${layout}">`);
    } else {
      return false;
    }
  } else {
    const bodyTag = match[1];
    // Remove existing data-layout if present
    const cleaned = bodyTag.replace(/\s*data-layout="[^"]*"/gi, '');
    html = html.replace(match[0], `${cleaned} data-layout="${layout}">`);
  }

  fs.writeFileSync(filePath, html, 'utf-8');
  return true;
}

// ── CLI ──
function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || '--dry-run';

  const examplesDir = path.resolve(__dirname, '..', 'examples');

  // Find all HTML files
  function findHTMLFiles(dir) {
    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...findHTMLFiles(fullPath));
      } else if (entry.name.endsWith('.html')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const htmlFiles = findHTMLFiles(examplesDir).sort();
  const results = [];

  for (const filePath of htmlFiles) {
    const html = fs.readFileSync(filePath, 'utf-8');
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const result = detectLayout(filePath, document);
    results.push(result);
  }

  if (mode === '--json') {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (mode === '--dry-run') {
    console.log(`\nLayout Pattern Detection — Dry Run`);
    console.log(`${'='.repeat(70)}\n`);
    console.log(`Found ${results.length} HTML templates\n`);

    // Group by pattern
    const byPattern = {};
    for (const r of results) {
      const key = r.detectedLayout || 'UNMAPPED';
      if (!byPattern[key]) byPattern[key] = [];
      byPattern[key].push(r);
    }

    for (const [pattern, files] of Object.entries(byPattern).sort()) {
      console.log(`\n  ${pattern} (${files.length} templates):`);
      for (const f of files) {
        const overrideTag = f.override !== 'category-default' ? ` [${f.override}]` : '';
        console.log(`    ${f.filePath}${overrideTag}`);
      }
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`Total: ${results.length} templates`);
    console.log(`Patterns: ${Object.keys(byPattern).length} distinct layouts\n`);
    return;
  }

  if (mode === '--apply') {
    console.log(`\nApplying layout metadata to ${results.length} templates...\n`);
    let applied = 0;
    let skipped = 0;
    let failed = 0;

    for (const r of results) {
      const fullPath = path.join(examplesDir, r.filePath);
      if (!r.detectedLayout) {
        console.log(`  SKIP: ${r.filePath} (no layout detected)`);
        skipped++;
        continue;
      }
      const success = applyMetadata(fullPath, r.detectedLayout);
      if (success) {
        console.log(`  OK: ${r.filePath} → data-layout="${r.detectedLayout}"`);
        applied++;
      } else {
        console.log(`  FAIL: ${r.filePath} (could not find <body> tag)`);
        failed++;
      }
    }

    console.log(`\nDone: ${applied} applied, ${skipped} skipped, ${failed} failed\n`);
    return;
  }

  console.error(`Unknown mode: ${mode}. Use --dry-run, --apply, or --json`);
  process.exit(1);
}

main();
