#!/usr/bin/env node

// Robust dependency loading — gives clear error if invoked incorrectly
let fs, path, JSDOM;
try {
  fs = require('fs');
  path = require('path');
  ({ JSDOM } = require('jsdom'));
} catch (e) {
  console.error('\n══════════════════════════════════════════════════════');
  console.error('  ERROR: Cannot load dependencies.');
  console.error('');
  console.error('  Run from the skills/pptx directory:');
  console.error('    node scripts/validate_html.cjs <files...>');
  console.error('');
  console.error('  If jsdom is not installed:');
  console.error('    cd skills/pptx && npm install');
  console.error('══════════════════════════════════════════════════════\n');
  process.exit(1);
}

// Build brand hex→token lookup map using the CANONICAL token names from render_echarts.mjs
// These are the exact var(--brand-*) names the pipeline resolves.
let brandHexToToken = {};
try {
  const brandingPath = path.resolve(__dirname, '..', 'branding', 'mckinsey.json');
  const branding = JSON.parse(fs.readFileSync(brandingPath, 'utf-8'));
  // Canonical mapping: hex → preferred var(--brand-*) token
  // Matches the cssVariableMap in render_echarts.mjs
  const canonicalMap = {
    'primary.navy':       '--brand-primary',
    'primary.logoBlue':   '--brand-primary-logo',
    'primary.deepBlue':   '--brand-primary-deep',
    'primary.vividBlue':  '--brand-primary-vivid',
    'secondary.blueDark': '--brand-secondary',
    'secondary.blueMedium': '--brand-tertiary',
    'secondary.blueLight': '--brand-quaternary',
    'secondary.bluePale': '--brand-quinary',
    'gray.dark':          '--brand-gray-dark',
    'gray.medium':        '--brand-gray-medium',
    'gray.light':         '--brand-gray-light',
    'gray.silver':        '--brand-gray-silver',
    'gray.border':        '--brand-gray-border',
    'text.primary':       '--brand-text-primary',
    'text.body':          '--brand-text',
    'text.secondary':     '--brand-text-secondary',
    'text.inverse':       '--brand-text-inverse',
    'background.primary': '--brand-bg-primary',
    'background.secondary': '--brand-bg-secondary',
    'background.dark':    '--brand-bg-dark',
    'surface.light':      '--brand-surface-light',
    'surface.muted':      '--brand-surface-muted',
    'semantic.positive':  '--brand-positive',
    'semantic.negative':  '--brand-negative',
    'semantic.warning':   '--brand-warning',
    'semantic.neutral':   '--brand-neutral',
    'accent.gold':        '--brand-accent',
    'accent.teal':        '--brand-accent-teal',
    'accent.orange':      '--brand-accent-orange',
  };
  // Resolve each color path to its hex value and build reverse map
  function getColor(pathStr) {
    return pathStr.split('.').reduce((o, k) => o && o[k], branding.colors);
  }
  for (const [colorPath, varName] of Object.entries(canonicalMap)) {
    const hex = getColor(colorPath);
    if (hex && typeof hex === 'string') {
      brandHexToToken[hex.toUpperCase()] = `var(${varName})`;
    }
  }
} catch (e) {
  // Branding not found — check 60 will be skipped silently
}

function validateSlideHTML(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const errors = [];
  const warnings = [];

  // Detect slide type — structural slides have relaxed validation
  const body = document.querySelector('body');
  const slideType = (body && body.getAttribute('data-slide-type')) || 'content';
  const isStructural = slideType === 'structural';

  // Detect layout pattern — enables conditional validation checks
  const dataLayout = (body && body.getAttribute('data-layout')) || '';
  const isChartLayout = dataLayout.startsWith('chart-');
  const isHeroCover = dataLayout === 'hero-cover';

  // 1. Chart title check
  const charts = document.querySelectorAll('[data-echarts]');
  charts.forEach((chart, i) => {
    const prevSibling = chart.previousElementSibling;
    if (!prevSibling || !['P', 'H3', 'H4', 'H5'].includes(prevSibling.tagName)) {
      errors.push(`Chart ${i + 1}: Missing title element. Add <p> describing what chart shows.`);
    }
  });

  // 2. Grid margin check
  charts.forEach((chart, i) => {
    try {
      const config = JSON.parse(chart.getAttribute('data-echarts'));
      const isHorizontalBar = config.yAxis?.type === 'category';

      if (isHorizontalBar) {
        if ((config.grid?.left || 0) < 100) {
          warnings.push(`Chart ${i + 1}: grid.left=${config.grid?.left || 'unset'} (need >=100 for horizontal bars)`);
        }
        if ((config.grid?.right || 0) < 60) {
          warnings.push(`Chart ${i + 1}: grid.right=${config.grid?.right || 'unset'} (need >=60 for labels)`);
        }
      }

      // 3. Font size check
      config.series?.forEach((series, si) => {
        if (series.label?.fontSize && series.label.fontSize < 10) {
          errors.push(`Chart ${i + 1}, Series ${si + 1}: label.fontSize=${series.label.fontSize} (must be >=10)`);
        }
        if (Array.isArray(series.data)) {
          series.data.forEach((item, di) => {
            if (typeof item === 'object' && item.label?.fontSize && item.label.fontSize < 10) {
              errors.push(`Chart ${i + 1}, Data ${di + 1}: label.fontSize=${item.label.fontSize} (must be >=10)`);
            }
          });
        }
      });
    } catch (e) {
      errors.push(`Chart ${i + 1}: Invalid JSON in data-echarts`);
    }
  });

  // 4. Title margin check
  const titles = document.querySelectorAll('h1');
  titles.forEach((title, i) => {
    const style = title.getAttribute('style') || '';
    if (!style.includes('margin')) {
      warnings.push(`Title ${i + 1}: Missing margin:0 in style (may cause alignment issues)`);
    }
  });

  // 5. Title length check
  titles.forEach((title, i) => {
    const text = title.textContent.trim();
    if (text.length > 90) {
      errors.push(`Title ${i + 1}: ${text.length} chars (max 90 — will not fit on 2 lines)`);
    } else if (text.length > 80) {
      warnings.push(`Title ${i + 1}: ${text.length} chars (ideal <80)`);
    }
  });

  // 6. Title-zone overflow prediction
  const titleZone = document.querySelector('.title-zone');
  if (titleZone) {
    const h1 = titleZone.querySelector('h1');
    const subtitle = titleZone.querySelector('.subtitle, .slide-subtitle, p');
    if (h1 && subtitle) {
      const len = h1.textContent.trim().length;
      if (len > 70) {
        warnings.push(`Title zone: ${len}-char title + subtitle may overflow. Shorten title to <70 chars.`);
      }
    }
  }

  // 7. Content density check (skip for structural slides AND hero-cover layouts)
  const bullets = document.querySelectorAll('li');
  if (!isStructural && !isHeroCover) {
    if (bullets.length > 15) {
      errors.push(`Content density: ${bullets.length} bullets (max 15 — multi-panel layouts have 3-5 per panel)`);
    }
    const tableRows = document.querySelectorAll('tr');
    if (tableRows.length > 12) {
      errors.push(`Content density: ${tableRows.length - 1} data rows (max 12 — multiple small tables allowed)`);
    }
    if (charts.length > 2) {
      errors.push(`Content density: ${charts.length} charts (max 2 per slide). Use dual-panel or split slides.`);
    }
  }

  // 8. Chart axis labels & legends
  charts.forEach((chart, i) => {
    try {
      const config = JSON.parse(chart.getAttribute('data-echarts'));
      // Horizontal bar: must have yAxis.data
      if (config.yAxis?.type === 'category') {
        if (!config.yAxis.data || config.yAxis.data.length === 0) {
          errors.push(`Chart ${i + 1}: Horizontal bar missing yAxis.data (category labels)`);
        }
      }
      // Vertical bar: must have xAxis.data
      if (config.xAxis?.type === 'category') {
        if (!config.xAxis.data || config.xAxis.data.length === 0) {
          errors.push(`Chart ${i + 1}: Vertical bar missing xAxis.data (category labels)`);
        }
      }
      // Multi-series: must have legend
      if (config.series?.length > 1 && !config.legend) {
        errors.push(`Chart ${i + 1}: Multi-series chart missing legend component`);
      }
      // Pie: must have legend OR labels
      if (config.series?.some(s => s.type === 'pie')) {
        const hasLegend = config.legend && config.legend.show !== false;
        const hasLabels = config.series.some(s => s.type === 'pie' && s.label?.show !== false);
        if (!hasLegend && !hasLabels) {
          errors.push(`Chart ${i + 1}: Pie chart must have legend OR visible labels`);
        }
      }
    } catch (e) { /* JSON error caught by existing check */ }
  });

  // 9. CSS variables in data-echarts
  // NOTE: var(--brand-*) IS allowed in data-echarts — render_echarts.mjs resolves them.
  // Only flag non-brand CSS variables which won't be resolved.
  charts.forEach((chart, i) => {
    const raw = chart.getAttribute('data-echarts');
    // Match var(--...) but exclude var(--brand-*) which render_echarts.mjs resolves
    const nonBrandVars = raw.match(/var\(--(?!brand-)[^)]+\)/g);
    if (nonBrandVars && nonBrandVars.length > 0) {
      errors.push(`Chart ${i + 1}: Contains non-brand CSS variable ${nonBrandVars[0]} which renders as BLACK. Use var(--brand-*) or hex.`);
    }
  });

  // 10. Font size floor in inline styles
  document.querySelectorAll('[style]').forEach(el => {
    const style = el.getAttribute('style');
    const match = style.match(/font-size:\s*(\d+(?:\.\d+)?)\s*px/);
    if (match) {
      const size = parseFloat(match[1]);
      if (size < 9 && !el.closest('.footer-zone')) {
        warnings.push(`Element <${el.tagName.toLowerCase()}>: font-size ${size}px (~${(size * 0.75).toFixed(1)}pt) — below 9px minimum`);
      }
    }
  });

  // 11. Per-panel chart limit (max 1 chart per .panel)
  const panels = document.querySelectorAll('.panel');
  panels.forEach((panel, i) => {
    const panelCharts = panel.querySelectorAll('[data-echarts]');
    if (panelCharts.length > 1) {
      errors.push(`Panel ${i + 1}: ${panelCharts.length} charts stacked in one panel (max 1). Use dual-panel template or split slides.`);
    }
  });

  // 12. Content height estimation (flex-layout aware)
  const bodyZone = document.querySelector('.content-zone, .body-zone')
    || document.querySelector('body');
  let estimatedHeight = 0;
  if (bodyZone) {
    // Helper: estimate height of a DOM subtree
    function estimateSubtreeHeight(root) {
      let h = 0;
      root.querySelectorAll('[data-echarts]').forEach(chart => {
        const style = chart.getAttribute('style') || '';
        const hMatch = style.match(/height:\s*(\d+(?:\.\d+)?)\s*pt/);
        h += hMatch ? parseFloat(hMatch[1]) : 200;
      });
      h += root.querySelectorAll('li').length * 18;
      const rowCount = root.querySelectorAll('tr').length;
      if (rowCount > 0) h += rowCount * 20 + 30;
      // Padding for containers (excluding the root itself)
      const containers = root.querySelectorAll('.panel, .callout, .card');
      h += containers.length * 24;
      return h;
    }

    // Detect TOP-LEVEL flex row containers (side-by-side panels)
    // Only process flex rows that are NOT nested inside another flex row
    const flexContainers = bodyZone.querySelectorAll('[style*="display: flex"], [style*="display:flex"]');
    estimatedHeight = 0;
    const handledElements = new Set();
    const processedFlexes = new Set();

    flexContainers.forEach(flex => {
      const style = flex.getAttribute('style') || '';
      // Only handle row-direction flex (default or explicit row)
      if (style.includes('flex-direction: column') || style.includes('flex-direction:column')) return;

      // Skip if this flex row is a descendant of an already-processed flex row
      let isNested = false;
      let ancestor = flex.parentElement;
      while (ancestor && ancestor !== bodyZone) {
        if (processedFlexes.has(ancestor)) { isNested = true; break; }
        ancestor = ancestor.parentElement;
      }
      if (isNested) return;

      // Side-by-side: take max height of children
      let maxChildHeight = 0;
      for (const child of flex.children) {
        const childH = estimateSubtreeHeight(child);
        maxChildHeight = Math.max(maxChildHeight, childH);
        handledElements.add(child);
      }
      estimatedHeight += maxChildHeight;
      handledElements.add(flex);
      processedFlexes.add(flex);
    });

    // Determine walk target — if bodyZone has a single flex-column child wrapper, walk its children instead
    let walkTarget = bodyZone;
    if (bodyZone.children.length === 1) {
      const onlyChild = bodyZone.children[0];
      const cs = (onlyChild.getAttribute('style') || '');
      if (cs.includes('flex-direction: column') || cs.includes('flex-direction:column')) {
        walkTarget = onlyChild;
      }
    }

    // Add non-flex content that wasn't inside a flex container
    if (handledElements.size === 0) {
      // No flex layout detected — fall back to sum-all approach
      estimatedHeight = estimateSubtreeHeight(bodyZone);
    } else {
      // Walk direct children — add any not already handled by flex-row processing
      for (const child of walkTarget.children) {
        if (!handledElements.has(child)) {
          let childH = estimateSubtreeHeight(child);
          // estimateSubtreeHeight misses text-only elements — add basic estimate
          if (childH === 0) {
            const text = (child.textContent || '').trim();
            if (text.length > 0) {
              const lines = Math.max(1, Math.ceil(text.length / 60));
              childH = lines * 14 + 16;  // ~14pt per line + padding
            }
          }
          estimatedHeight += childH;
        }
      }
    }

    if (estimatedHeight > 370) {
      errors.push(`Content height estimated at ~${Math.round(estimatedHeight)}pt (max ~325pt usable). Fix priority: (1) resize containers with flex:1, (2) reduce fonts toward 9px min, (3) reduce padding, (4) reduce content, (5) split slides.`);
    } else if (estimatedHeight > 325) {
      warnings.push(`Content height estimated at ~${Math.round(estimatedHeight)}pt (close to ~325pt limit). Check: can containers resize to fill space? Can fonts reduce toward 9px minimum?`);
    }
  }

  // 13. Em-dash prohibition (— U+2014)
  const bodyText = document.body ? document.body.textContent : '';
  if (bodyText.includes('\u2014')) {
    errors.push('Text contains em-dash (\u2014). Replace with colon, semicolon, or split into two sentences.');
  }
  charts.forEach((chart, i) => {
    const raw = chart.getAttribute('data-echarts');
    if (raw.includes('\u2014')) {
      errors.push(`Chart ${i + 1}: data-echarts JSON contains em-dash (\u2014). Replace with hyphen or colon.`);
    }
  });

  // 14. Typography tier consistency (max 4 distinct font sizes per slide)
  const fontSizes = new Set();
  document.querySelectorAll('[style]').forEach(el => {
    const style = el.getAttribute('style');
    const match = style.match(/font-size:\s*(\d+(?:\.\d+)?)\s*px/);
    if (match) fontSizes.add(parseFloat(match[1]));
  });
  if (fontSizes.size > 4) {
    const sorted = [...fontSizes].sort((a, b) => b - a);
    const msg = `Typography: ${fontSizes.size} distinct font sizes found (max 4). Sizes: ${sorted.join(', ')}px. Use 4-tier system: T1 title (16-22px), T2 header (11-14px), T3 body (9-11px), T4 footnote (9px).`;
    if (isStructural) {
      warnings.push(msg);
    } else {
      errors.push(msg);
    }
  }
  // Warn on non-standard tier sizes
  const standardTiers = [9, 10, 10.67, 11, 12, 13, 14, 16, 18, 20, 22, 24];
  fontSizes.forEach(size => {
    if (!standardTiers.includes(size) && size > 9) {
      warnings.push(`Typography: font-size ${size}px is non-standard. Standard tiers: T1 (16-22px), T2 (11-14px), T3 (9-11px), T4 (9px).`);
    }
  });

  // 15. Underfill detection (content too sparse) — tiered: ERROR <70%, WARNING <85%
  // Skip for structural slides AND hero-cover layouts — they have intentionally sparse content
  // For chart-standalone, lower threshold to 60%
  if (!isStructural && !isHeroCover) {
    const underfillErrorThreshold = dataLayout === 'chart-standalone' ? 195 : 228;  // 60% or 70% of 325
    const underfillErrorPct = dataLayout === 'chart-standalone' ? 60 : 70;
    if (bodyZone && estimatedHeight > 0 && estimatedHeight < underfillErrorThreshold) {
      errors.push(`Content height ~${Math.round(estimatedHeight)}pt (${Math.round(estimatedHeight / 325 * 100)}% fill — below ${underfillErrorPct}% minimum). BLOCKING: increase chart heights, font sizes, or padding to fill ≥${underfillErrorPct}% of ~325pt content zone.`);
    } else if (bodyZone && estimatedHeight > 0 && estimatedHeight < 276) {  // 85% of 325
      warnings.push(`Content height ~${Math.round(estimatedHeight)}pt (${Math.round(estimatedHeight / 325 * 100)}% fill). Target 85-95%.`);
    }
  }

  // 16. McKinsey bullet style check (warn on prose-heavy panels without bullets)
  const contentPanels = document.querySelectorAll('.panel, .content-zone > div');
  contentPanels.forEach((panel, i) => {
    const paragraphs = panel.querySelectorAll('p');
    const bulletLists = panel.querySelectorAll('ul, ol');
    const chartCount = panel.querySelectorAll('[data-echarts]').length;
    const tableCount = panel.querySelectorAll('table').length;
    // Only check text-heavy panels (no charts or tables, 3+ paragraphs, no bullet lists)
    if (chartCount === 0 && tableCount === 0 && paragraphs.length >= 3 && bulletLists.length === 0) {
      let longParas = 0;
      paragraphs.forEach(p => {
        if (p.textContent.trim().length > 80) longParas++;
      });
      if (longParas >= 2) {
        warnings.push(`Panel ${i + 1}: ${longParas} long paragraphs without bullet structure. Consider using <ul> with selective bolding for McKinsey style.`);
      }
    }
  });

  // 17. Table solid border detection (McKinsey style)
  const tables = document.querySelectorAll('table');
  tables.forEach((table, i) => {
    const firstCell = table.querySelector('th, td');
    if (firstCell) {
      const cellStyle = firstCell.getAttribute('style') || '';
      const tableStyle = table.getAttribute('style') || '';
      // Check for solid borders on cells or table with border-collapse
      const hasSolidCellBorder = /border[^:]*:\s*\d+\s*(px|pt)\s+solid/i.test(cellStyle);
      const hasBorderCollapse = /border-collapse\s*:\s*collapse/i.test(tableStyle);
      if (hasSolidCellBorder || hasBorderCollapse) {
        warnings.push(`Table ${i + 1}: Solid cell borders detected. McKinsey standard: use border-bottom: 1px dashed var(--brand-gray-medium) on <tr> elements, remove all cell borders. See slide_standardisation.md Section 9.`);
      }
    }
  });

  // 18. Bullet list container spacing (space-between detection)
  const allBulletLists = document.querySelectorAll('ul, ol');
  allBulletLists.forEach((list, i) => {
    const parent = list.parentElement;
    if (parent) {
      const parentStyle = parent.getAttribute('style') || '';
      if (/justify-content\s*:\s*space-between/i.test(parentStyle)) {
        errors.push(`Bullet list ${i + 1}: Parent uses justify-content:space-between — bullets will be artificially spread across panel. Remove space-between; use consistent margin-bottom on <li> elements.`);
      }
    }
  });

  // 19. Solid separator line detection
  document.querySelectorAll('div, hr').forEach((el) => {
    const style = el.getAttribute('style') || '';
    const hasText = el.textContent.trim().length > 0;
    const hasBorderOnly = /border-(top|bottom)\s*:\s*\d+\s*(px|pt)\s+solid/i.test(style);
    const isLikelySeparator = !hasText && el.children.length === 0 && hasBorderOnly;
    if (isLikelySeparator) {
      warnings.push(`Solid separator line detected (${el.tagName}). McKinsey standard: border-bottom: 1px dashed var(--brand-gray-medium). Change border-style from solid to dashed.`);
    }
  });

  // 20. Container Box header height consistency in flex rows
  const flexRows = document.querySelectorAll('[style*="display: flex"], [style*="display:flex"]');
  flexRows.forEach((flexRow, i) => {
    const style = flexRow.getAttribute('style') || '';
    if (/flex-direction\s*:\s*column/i.test(style)) return;
    const containerHeaders = [];
    for (const child of flexRow.children) {
      const childStyle = child.getAttribute('style') || '';
      if (/border/.test(childStyle)) {
        const firstChild = child.firstElementChild;
        if (firstChild) {
          const fcStyle = firstChild.getAttribute('style') || '';
          if (/background/.test(fcStyle) && /padding/.test(fcStyle)) {
            containerHeaders.push(fcStyle);
          }
        }
      }
    }
    if (containerHeaders.length >= 2) {
      const paddings = containerHeaders.map(s => {
        const m = s.match(/padding:\s*([^;]+)/);
        return m ? m[1].trim() : 'unset';
      });
      const unique = [...new Set(paddings)];
      if (unique.length > 1) {
        warnings.push(`Flex row ${i + 1}: Container Box headers have mismatched padding (${unique.join(' vs ')}). Use identical padding for visual alignment.`);
      }
    }
  });

  // 21. SVG fill/stroke color enforcement (colors loaded from branding JSON)
  const brandHexSet = new Set(['#FFFFFF', '#000000']);
  try {
    const brandPath = require('path').join(__dirname, '..', 'branding', 'mckinsey.json');
    const brandConfig = JSON.parse(fs.readFileSync(brandPath, 'utf-8'));
    const colorSections = ['primary', 'secondary', 'gray', 'semantic', 'accent', 'text', 'background', 'surface'];
    for (const section of colorSections) {
      const sectionColors = brandConfig.colors?.[section];
      if (sectionColors) {
        for (const color of Object.values(sectionColors)) {
          brandHexSet.add(color.toUpperCase());
        }
      }
    }
    if (brandConfig.colorSequence?.charts) {
      for (const color of brandConfig.colorSequence.charts) {
        brandHexSet.add(color.toUpperCase());
      }
    }
  } catch (e) {
    // If branding file not found, fall back gracefully — skip this check
    warnings.push('SVG color check: Could not load branding/mckinsey.json — skipping SVG color enforcement.');
  }
  document.querySelectorAll('svg [fill], svg [stroke]').forEach(el => {
    ['fill', 'stroke'].forEach(attr => {
      const val = el.getAttribute(attr);
      if (!val) return;
      const v = val.trim().toLowerCase();
      if (['none', 'transparent', 'white', 'black', 'currentcolor', 'inherit', ''].includes(v)) return;
      if (v.startsWith('url(') || v.startsWith('var(')) return;
      const hex = v.toUpperCase();
      const norm = hex.length === 4
        ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
        : hex;
      if (norm.startsWith('#') && !brandHexSet.has(norm)) {
        if (attr === 'fill') {
          warnings.push(`SVG <${el.tagName}>: fill="${val}" is not a brand color. Use brand hex from slide_standardisation.md Section 4.`);
        } else {
          warnings.push(`SVG <${el.tagName}>: stroke="${val}" is not a brand color. Use brand hex.`);
        }
      }
    });
  });

  // 22. Title zone decoration check
  const titleZoneCheck = document.querySelector('.title-zone');
  if (titleZoneCheck) {
    titleZoneCheck.querySelectorAll('div').forEach(div => {
      if (div.classList.contains('title-zone')) return;
      const ds = div.getAttribute('style') || '';
      const hasBg = /background\s*:/.test(ds);
      const widthMatch = ds.match(/width\s*:\s*(\d+)(pt|px)/);
      const noText = div.textContent.trim().length < 3;
      // Skip thin accent lines (≤3px) used in tag badges (e.g. ESTIMATION)
      const isAccentLine = widthMatch && parseInt(widthMatch[1]) <= 3;
      if (hasBg && widthMatch && noText && !isAccentLine) {
        errors.push('Title zone: Decorative colored element detected. BLOCKING — No decorative bars/icons in title zone. REMOVE the decorative element. See slide_standardisation.md Section 1.');
      }
    });
  }

  // 23. Tier 3 (semantic) color usage detection
  const tier3Vars = [
    { name: '--brand-negative', display: 'RED' },
    { name: '--brand-warning', display: 'AMBER' },
    { name: '--brand-positive', display: 'GREEN' }
  ];
  tier3Vars.forEach(({ name, display }) => {
    const escaped = name.replace(/[-]/g, '\\-');
    const count = (html.match(new RegExp(escaped, 'g')) || []).length;
    if (count > 0) {
      warnings.push(`[COLOR-TIER] Tier 3 color ${name} (${display}) used ${count} time(s). ` +
        `Tier 3 is RESTRICTED — only for explicit status/sentiment visible in inspiration. ` +
        `If inspiration doesn't show ${display}, replace with Tier 1 (--brand-primary or --brand-gray-dark).`);
    }
  });

  // 24. Structural element inventory (cross-version regression detection)
  const structureCounts = {};

  // Count Container Box patterns (border div → first child with background+padding = header)
  let containerBoxCount = 0;
  document.querySelectorAll('[style]').forEach(el => {
    const s = el.getAttribute('style') || '';
    if (!/border/.test(s)) return;
    const first = el.firstElementChild;
    if (first) {
      const fs = first.getAttribute('style') || '';
      if (/background/.test(fs) && /padding/.test(fs)) containerBoxCount++;
    }
  });
  if (containerBoxCount > 0) structureCounts['Container Box headers'] = containerBoxCount;

  // Count SVG elements (shapes, diagrams)
  const svgCount = document.querySelectorAll('svg').length;
  if (svgCount > 0) structureCounts['SVG elements'] = svgCount;

  // Count distinct flex rows with 3+ children (potential table/grid structures)
  let gridRowCount = 0;
  document.querySelectorAll('[style*="display: flex"], [style*="display:flex"]').forEach(row => {
    const s = row.getAttribute('style') || '';
    if (!/flex-direction\s*:\s*column/i.test(s) && row.children.length >= 3) gridRowCount++;
  });
  if (gridRowCount > 0) structureCounts['grid/table rows (3+ columns)'] = gridRowCount;

  // Count dashed separators
  let separatorCount = 0;
  document.querySelectorAll('div').forEach(div => {
    const s = div.getAttribute('style') || '';
    if (/border-(?:bottom|top)\s*:.*dashed/.test(s) && div.textContent.trim().length === 0) separatorCount++;
  });
  if (separatorCount > 0) structureCounts['dashed separators'] = separatorCount;

  // Count connector elements (dashed vertical/horizontal lines linking zones)
  let connectorCount = 0;
  document.querySelectorAll('div').forEach(div => {
    const s = div.getAttribute('style') || '';
    // Connectors: dashed border-left (vertical) with no/minimal text, narrow width
    if (/border-left\s*:.*dashed/.test(s) && div.textContent.trim().length === 0) {
      const widthMatch = s.match(/width\s*:\s*(\d+)/i);
      const heightMatch = s.match(/height\s*:\s*(\d+)/i);
      if (widthMatch && parseFloat(widthMatch[1]) <= 2) connectorCount++;
      else if (heightMatch) connectorCount++; // has explicit height = likely connector
    }
  });
  if (connectorCount > 0) structureCounts['connector lines'] = connectorCount;

  // Count bold header text blocks (T2 tier: 11-14px bold)
  let headerTextCount = 0;
  document.querySelectorAll('p, h3, h4, h5').forEach(el => {
    const s = el.getAttribute('style') || '';
    if (/font-weight\s*:\s*bold/i.test(s) && /font-size\s*:\s*(1[1-4])px/i.test(s)) headerTextCount++;
  });
  if (headerTextCount > 0) structureCounts['header text blocks (T2)'] = headerTextCount;

  // Output summary
  const structParts = Object.entries(structureCounts).map(([k, v]) => `${v} ${k}`);
  if (structParts.length > 0) {
    warnings.push(`[STRUCTURE] Element inventory: ${structParts.join(', ')}. ` +
      `Compare with previous version — any count DECREASE = potential regression.`);
  }

  // 25. Separator margin minimum (12pt)
  document.querySelectorAll('div').forEach(div => {
    const s = div.getAttribute('style') || '';
    // Match separators: dashed border + empty/minimal text
    if (!/border-(?:bottom|top)\s*:.*dashed/.test(s)) return;
    if (div.textContent.trim().length > 3) return;

    // Parse margin shorthand: margin: Xpt, margin: Xpt Ypt, margin: T R B L
    const marginMatch = s.match(/(?:^|;)\s*margin\s*:\s*([^;]+)/i);
    if (marginMatch) {
      const parts = marginMatch[1].trim().split(/\s+/);
      const topMargin = parseFloat(parts[0]) || 0;
      const bottomMargin = parts.length >= 3 ? (parseFloat(parts[2]) || 0) : topMargin;
      if (topMargin < 12 || bottomMargin < 12) {
        warnings.push(`Separator has margin ${marginMatch[1].trim()}. Minimum: 12pt on both sides. ` +
          `Text may overlap. Fix: margin: 12pt 0`);
      }
    }

    // Also check margin-top / margin-bottom individually
    const mt = s.match(/margin-top\s*:\s*(\d+)(pt|px)/i);
    const mb = s.match(/margin-bottom\s*:\s*(\d+)(pt|px)/i);
    if (mt && parseFloat(mt[1]) < 12) {
      warnings.push(`Separator margin-top: ${mt[1]}${mt[2]} (minimum 12pt). Text may overlap.`);
    }
    if (mb && parseFloat(mb[1]) < 12) {
      warnings.push(`Separator margin-bottom: ${mb[1]}${mb[2]} (minimum 12pt). Text may overlap.`);
    }
  });

  // 26. Grid row-header styling enforcement
  // Detect flex-based grid rows where first child looks like a row header but lacks colored background
  document.querySelectorAll('[style*="display: flex"], [style*="display:flex"]').forEach(row => {
    const s = row.getAttribute('style') || '';
    // Skip column-direction containers and rows with < 2 children
    if (/flex-direction\s*:\s*column/i.test(s) || row.children.length < 2) return;

    const firstChild = row.firstElementChild;
    if (!firstChild) return;
    const fcs = firstChild.getAttribute('style') || '';

    // Heuristic: first child is a row header if it has a narrow explicit width (< 120pt/px)
    const widthMatch = fcs.match(/(?:^|;)\s*width\s*:\s*(\d+)(pt|px)/i);
    if (!widthMatch) return;
    const widthVal = parseFloat(widthMatch[1]);
    const widthUnit = widthMatch[2].toLowerCase();
    const effectiveWidth = widthUnit === 'pt' ? widthVal : widthVal * 0.75;
    if (effectiveWidth > 120) return; // Not a narrow row-header

    // Check if this row header has background color
    const hasBackground = /background(?:-color)?\s*:/i.test(fcs) && !/transparent/i.test(fcs);
    if (!hasBackground) {
      const textContent = firstChild.textContent.trim().substring(0, 30);
      warnings.push(`[TABLE] Row header "${textContent}..." has NO background color. ` +
        `Consider adding: background: var(--brand-primary); color: white; font-weight: bold; padding: 5pt 8pt; ` +
        `Row headers are typically colored rectangles in McKinsey style.`);
    }
  });

  // 27. Grid column border detection (should use backgrounds, not borders)
  document.querySelectorAll('[style*="display: flex"], [style*="display:flex"]').forEach(row => {
    const s = row.getAttribute('style') || '';
    if (/flex-direction\s*:\s*column/i.test(s) || row.children.length < 3) return;

    let verticalBorderCount = 0;
    Array.from(row.children).forEach(child => {
      const cs = child.getAttribute('style') || '';
      if (/border-(?:left|right)\s*:\s*\d+px\s+(?:dashed|solid)/i.test(cs)) {
        verticalBorderCount++;
      }
    });

    if (verticalBorderCount >= 2) {
      warnings.push(`[TABLE] Grid row has ${verticalBorderCount} children with vertical borders. ` +
        `Per Section 9: use alternating light column backgrounds instead of vertical border lines. ` +
        `Remove border-left/border-right from grid cells. Use background: var(--brand-surface-light) on alternate columns.`);
    }
  });

  // 28. Language consistency detection
  const allText = document.body ? document.body.textContent : '';
  const frenchIndicators = (allText.match(/\b(le|la|les|des|du|une|un|pour|dans|avec|sur|est|sont|cette|par|aux|nous|vous|leur|entre|depuis|notre|cette|ces|peut|fait|tout|mais|qui|que|ont)\b/gi) || []).length;
  const englishIndicators = (allText.match(/\b(the|is|are|and|for|with|this|that|from|have|has|can|will|our|their|been|were|was|not|but|all|they|which|would|there|what|about|each|she|him|into|more)\b/gi) || []).length;

  if (frenchIndicators > 10 && englishIndicators > 5) {
    const dominantLang = frenchIndicators > englishIndicators ? 'French' : 'English';
    const ratio = Math.min(frenchIndicators, englishIndicators) / Math.max(frenchIndicators, englishIndicators);
    if (ratio > 0.15 && ratio < 0.85) {
      // Likely mixed — check headings specifically
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, p[style*="font-weight: bold"], p[style*="font-weight:bold"]');
      headings.forEach(h => {
        const ht = h.textContent.trim();
        // Common English headings on French slides
        if (dominantLang === 'French' && /^(Insights|Key Takeaways|Overview|Summary|Source|Next Steps)$/i.test(ht)) {
          warnings.push(`[LANGUAGE] Heading "${ht}" appears to be English on a predominantly French slide. ` +
            `Translate to match the slide language (e.g., "Insights" → "Points clés", "Key Takeaways" → "Points à retenir").`);
        }
      });
    }
  }

  // 29. Connector presence detection for multi-zone layouts (PROMINENT WARNING)
  const bodyTextLower = (bodyText || '').toLowerCase();
  // v3.9 Fix C2: Broadened connector detection — keyword pairs + structural matching
  const keywordPaired =
    (bodyTextLower.includes('processus') && bodyTextLower.includes('description')) ||
    (bodyTextLower.includes('process') && bodyTextLower.includes('description')) ||
    (bodyTextLower.includes('diagram') && bodyTextLower.includes('detail')) ||
    (bodyTextLower.includes('diagramme') && bodyTextLower.includes('description'));

  // Also detect: 2+ flex rows with ≥3 children and matching column counts (paired grid zones)
  const allFlexRows = Array.from(document.querySelectorAll('[style*="display: flex"], [style*="display:flex"]'))
    .filter(r => {
      const rs = r.getAttribute('style') || '';
      return !/flex-direction\s*:\s*column/i.test(rs) && r.children.length >= 3;
    });
  let structuralPaired = false;
  if (allFlexRows.length >= 2) {
    const firstRowCols = allFlexRows[0].children.length;
    structuralPaired = allFlexRows.slice(1).some(r => r.children.length === firstRowCols);
  }

  const hasPairedZoneLabels = keywordPaired || structuralPaired;

  if (hasPairedZoneLabels && connectorCount === 0) {
    warnings.push(
      `[CONNECTOR] Paired zones detected but no connector lines found. ` +
      `If your slide has a diagram zone paired with a description zone, add vertical dashed connector lines between them. ` +
      `Use: <div style="width:0; height:12pt; border-left:1.5px dashed var(--brand-gray-medium);"></div>`
    );
  }

  // 30. Grey overuse on sidebar/label containers
  let greyContainerCount = 0;
  let primaryContainerCount = 0;
  document.querySelectorAll('[style]').forEach(el => {
    const s = el.getAttribute('style') || '';
    const hasBackground = /background(?:-color)?\s*:/i.test(s);
    if (!hasBackground) return;
    const isContainer = el.textContent.trim().length > 0 && el.textContent.trim().length < 50;
    if (!isContainer) return;

    const widthMatch = s.match(/width\s*:\s*(\d+)(pt|px|%)/i);
    if (!widthMatch) return;
    const widthVal = parseFloat(widthMatch[1]);
    if (widthMatch[2] === '%' || widthVal > 200) return;

    if (/--brand-gray|#[89abcdef]{6}|grey|gray|#ccc|#ddd|#eee/i.test(s)) {
      greyContainerCount++;
    }
    if (/--brand-primary|--brand-secondary|#00205[bB]|#005EB8/i.test(s)) {
      primaryContainerCount++;
    }
  });

  if (greyContainerCount >= 3 && primaryContainerCount === 0) {
    warnings.push(
      `[COLOR] ${greyContainerCount} sidebar/label containers use GREY backgrounds — 0 use brand colors. ` +
      `Consider using var(--brand-primary) or var(--brand-secondary) with color: white for key labels.`
    );
  }

  // 31. SVG complexity check — detect oversimplified SVGs
  document.querySelectorAll('svg').forEach((svg, i) => {
    const paths = svg.querySelectorAll('path, polygon, polyline');
    const rects = svg.querySelectorAll('rect');
    const circles = svg.querySelectorAll('circle, ellipse');
    const texts = svg.querySelectorAll('text');
    const totalShapes = paths.length + rects.length + circles.length;

    const svgStyle = svg.getAttribute('style') || '';
    const svgWidth = svg.getAttribute('width') || (svgStyle.match(/width\s*:\s*(\d+)/) || [])[1] || '0';
    const svgHeight = svg.getAttribute('height') || (svgStyle.match(/height\s*:\s*(\d+)/) || [])[1] || '0';
    const area = parseFloat(svgWidth) * parseFloat(svgHeight);

    if (area > 10000 && totalShapes < 3) {
      warnings.push(
        `[SVG] ⚠️  SVG ${i + 1} is LARGE (${svgWidth}×${svgHeight}) but has only ${totalShapes} shape(s) — likely OVERSIMPLIFIED.\n` +
        `  COMPARE your SVG to the inspiration image RIGHT NOW.\n` +
        `  If the inspiration shows a complex diagram (funnel, staircase, flowchart, multi-step process):\n` +
        `    → Your SVG MUST have enough <path>, <polygon>, <rect> elements to represent each visual step\n` +
        `    → A funnel needs multiple trapezoid shapes, a staircase needs multiple step rectangles\n` +
        `    → ${totalShapes} shapes is almost certainly NOT enough. ADD the missing shapes.`
      );
    }

    if (texts.length === 0 && area > 5000) {
      warnings.push(
        `[SVG] ⚠️  SVG ${i + 1} has NO <text> elements but is large enough to contain labels.\n` +
        `  If the inspiration's diagram has text labels embedded in it:\n` +
        `    → ADD <text> elements inside the SVG for each label\n` +
        `    → Use font-family, font-size, fill attributes on <text>\n` +
        `    → SVG <text> renders crisply in PPTX — HTML text overlaid on SVG does NOT.`
      );
    }
  });

  // 32. Heavy separator detection
  document.querySelectorAll('div, hr').forEach(el => {
    const s = el.getAttribute('style') || '';
    if (el.textContent.trim().length > 0) return;
    if (el.children.length > 0) return;

    const borderMatch = s.match(/border-(?:top|bottom)\s*:\s*(\d+)px\s+(solid|dashed)\s+(.*?)(?:;|$)/i);
    if (!borderMatch) return;

    const width = parseInt(borderMatch[1]);
    const color = borderMatch[3].trim();

    if (width > 3) {
      errors.push(
        `[SEPARATOR] ❌ FIX THIS: Separator has border-width: ${width}px — this is TOO THICK.\n` +
        `  CHANGE the border to: border-bottom: 1px dashed var(--brand-gray-medium);\n` +
        `  McKinsey separators are ALWAYS thin (1px) and subtle. ${width}px looks like a structural border, not a separator.\n` +
        `  Generation is BLOCKED until fixed.`
      );
    }

    if (/var\(--brand-(?:primary|secondary|text|negative)\)|#[0-4]/i.test(color)) {
      warnings.push(
        `[SEPARATOR] ⚠️  Separator uses DARK color "${color}" — separators should be SUBTLE.\n` +
        `  CHANGE the border color to: var(--brand-gray-medium)\n` +
        `  WRONG:   border-bottom: 1px dashed var(--brand-primary)   → too prominent\n` +
        `  CORRECT: border-bottom: 1px dashed var(--brand-gray-medium) → subtle, professional\n` +
        `  Separators provide visual breathing room — they should NOT draw attention.`
      );
    }
  });

  // 33. Bullet spacing cap — detect over-spaced bullets
  document.querySelectorAll('li').forEach(li => {
    const s = li.getAttribute('style') || '';
    const mbMatch = s.match(/margin-bottom\s*:\s*(\d+)(pt|px)/i);
    const pbMatch = s.match(/padding-bottom\s*:\s*(\d+)(pt|px)/i);

    const mbVal = mbMatch ? parseFloat(mbMatch[1]) : 0;
    const pbVal = pbMatch ? parseFloat(pbMatch[1]) : 0;
    const mbPt = mbMatch && mbMatch[2] === 'px' ? mbVal * 0.75 : mbVal;
    const pbPt = pbMatch && pbMatch[2] === 'px' ? pbVal * 0.75 : pbVal;

    if (mbPt > 12) {
      warnings.push(
        `[SPACING] ⚠️  <li> has margin-bottom: ${mbMatch[1]}${mbMatch[2]} (${mbPt.toFixed(0)}pt) — TOO MUCH space between bullets.\n` +
        `  CHANGE to: margin-bottom: 6pt (or 8pt max for wide-spaced layouts)\n` +
        `  Bullets must be GROUPED TOGETHER, not spread across the panel.\n` +
        `  If you need to fill vertical space, increase font-size or line-height — NOT margin.`
      );
    }
    if (pbPt > 10) {
      warnings.push(
        `[SPACING] ⚠️  <li> has padding-bottom: ${pbMatch[1]}${pbMatch[2]} (${pbPt.toFixed(0)}pt) — TOO MUCH internal padding.\n` +
        `  CHANGE to: padding-bottom: 4pt (or 6pt max)\n` +
        `  Bullet items should be compact. Use font-size and line-height to fill space, not padding.`
      );
    }
  });

  // 34. v3.9 Fix C: Flex container gap detection
  document.querySelectorAll('[style*="display: flex"], [style*="display:flex"]').forEach((flex) => {
    const s = flex.getAttribute('style') || '';
    if (/flex-direction\s*:\s*column/i.test(s)) return;
    if (/\bgap\s*:/i.test(s)) return;
    const visibleChildren = Array.from(flex.children).filter(c => {
      const cs = c.getAttribute('style') || '';
      return !/display\s*:\s*none/i.test(cs);
    });
    if (visibleChildren.length < 2) return;
    const hasInternalSpacing = visibleChildren.some(c => {
      const cs = c.getAttribute('style') || '';
      return /margin-(?:left|right)\s*:\s*[1-9]/i.test(cs);
    });
    if (hasInternalSpacing) return;
    warnings.push(
      `[SPACING] Flex row has ${visibleChildren.length} children but no explicit gap. ` +
      `ADD gap: 8pt to prevent element overlap in PPTX.`
    );
  });

  // 35. v3.9 Fix H1: Container font hierarchy check (skip for structural slides)
  if (!isStructural) {
    document.querySelectorAll('[style*="border"]').forEach((container) => {
      const first = container.firstElementChild;
      if (!first) return;
      const fcs = first.getAttribute('style') || '';
      if (!/background/.test(fcs) || !/padding/.test(fcs)) return;
      const headerEl = first.querySelector('p, h3, h4, h5') || first;
      const hs = headerEl.getAttribute('style') || '';
      const headerMatch = hs.match(/font-size:\s*(\d+(?:\.\d+)?)\s*px/);
      if (!headerMatch) return;
      const headerSize = parseFloat(headerMatch[1]);
      let maxBodySize = 0;
      Array.from(container.children).slice(1).forEach(child => {
        child.querySelectorAll('[style*="font-size"]').forEach(el => {
          const elStyle = el.getAttribute('style') || '';
          const m = elStyle.match(/font-size:\s*(\d+(?:\.\d+)?)\s*px/);
          if (m) maxBodySize = Math.max(maxBodySize, parseFloat(m[1]));
        });
      });
      if (maxBodySize > 0 && maxBodySize > headerSize) {
        errors.push(
          `[HIERARCHY] ❌ Body text font-size (${maxBodySize}px) is LARGER than container header (${headerSize}px) — hierarchy inverted. ` +
          `REDUCE body font-size to be SMALLER than header. Header=T2 (11-14px), Body=T3 (9-11px). ` +
          `Generation is BLOCKED until fixed.`
        );
      }
    });
  }

  // 36. v3.9 Fix H2: Takeaway box bullet formatting
  document.querySelectorAll('[style*="background"]').forEach(el => {
    const s = el.getAttribute('style') || '';
    if (!/--brand-primary|#1[eE]3[aA]5[fF]/i.test(s)) return;
    const paragraphs = el.querySelectorAll('p');
    const bulletLists = el.querySelectorAll('ul, ol');
    if (paragraphs.length >= 3 && bulletLists.length === 0) {
      errors.push(
        `[TAKEAWAY] ❌ Dark container has ${paragraphs.length} paragraphs but no bullet list (<ul>). ` +
        `WRAP insights in <ul> with <li> elements. Use bold-keyword pattern. NEVER use plain <p> for multiple insights. ` +
        `Generation is BLOCKED until fixed.`
      );
    }
  });

  // 37. v3.9 Fix J1: Title zone styling compliance
  document.querySelectorAll('h1').forEach((h1) => {
    const s = h1.getAttribute('style') || '';
    if (!/--brand-primary/i.test(s) && !/color:\s*#1[eE]3[aA]5[fF]/i.test(s)) {
      warnings.push(
        `[STANDARD] Title <h1> missing brand-primary color. ` +
        `ADD: color: var(--brand-primary) per slide_standardisation.md Section 1.`
      );
    }
    if (!/--brand-font-heading|[Gg]eorgia/i.test(s)) {
      warnings.push(
        `[STANDARD] Title <h1> missing heading font (Georgia). ` +
        `ADD: font-family: var(--brand-font-heading) per slide_standardisation.md Section 1.`
      );
    }
    const sizeMatch = s.match(/font-size:\s*(\d+)px/);
    if (sizeMatch && (parseInt(sizeMatch[1]) < 16 || parseInt(sizeMatch[1]) > 24)) {
      warnings.push(
        `[STANDARD] Title font-size ${sizeMatch[1]}px outside T1 range (16-22px). ` +
        `Standard: font-size: 20px per slide_standardisation.md Section 1.`
      );
    }
  });

  // 38. Decorative SVG pattern detection
  document.querySelectorAll('svg').forEach((svg) => {
    const paths = svg.querySelectorAll('path');
    paths.forEach(path => {
      const d = path.getAttribute('d') || '';
      const lCommands = d.match(/[Ll]\s*[-\d.]+[\s,]+[-\d.]+/g);
      if (lCommands && lCommands.length >= 6) {
        const yValues = lCommands.map(cmd => {
          const parts = cmd.replace(/[Ll]\s*/, '').split(/[\s,]+/);
          return parseFloat(parts[1]);
        });
        let alternations = 0;
        for (let i = 1; i < yValues.length; i++) {
          if ((yValues[i] > 0 && yValues[i-1] < 0) || (yValues[i] < 0 && yValues[i-1] > 0)) {
            alternations++;
          }
        }
        if (alternations >= 3) {
          warnings.push(
            `[DECORATION] SVG path appears to be a zigzag/wavy decorative element (${alternations} alternations). ` +
            `REMOVE IT — decorative elements not in the inspiration are FORBIDDEN. ` +
            `Per rule 21: NEVER invent decorative separators. Use 1px dashed var(--brand-gray-medium).`
          );
        }
      }
    });
  });

  // 39. v4.4 BROADENED: Multi-panel Container Box enforcement
  // v4.2 only searched 2 levels deep (body > div, body > div > div).
  // Now searches ALL descendant flex row containers.
  const allFlexForContainerCheck = document.querySelectorAll('[style*="display: flex"], [style*="display:flex"]');
  allFlexForContainerCheck.forEach(flex => {
    const s = flex.getAttribute('style') || '';
    if (/flex-direction\s*:\s*column/i.test(s)) return;

    // Skip if inside a Container Box already (any ancestor has border)
    let parentEl = flex.parentElement;
    let insideContainer = false;
    let parentDepth = 0;
    while (parentEl && parentDepth < 4) {
      const ps = parentEl.getAttribute('style') || '';
      if (/border\s*:/i.test(ps) && !/border-bottom\s*:.*dashed/i.test(ps)) {
        insideContainer = true;
        break;
      }
      parentEl = parentEl.parentElement;
      parentDepth++;
    }
    if (insideContainer) return;

    const children = Array.from(flex.children).filter(c => {
      const cs = c.getAttribute('style') || '';
      return !/display\s*:\s*none/i.test(cs);
    });
    if (children.length < 2) return;

    children.forEach((child, idx) => {
      const cs = child.getAttribute('style') || '';
      // Skip if already a Container Box (has border), Takeaway Box (dark bg), or has background
      if (/border\s*:/i.test(cs) || /--brand-primary|#1[eE]3[aA]5[fF]/i.test(cs)) return;
      if (/background/i.test(cs)) return;
      // Skip narrow elements (separators, connectors)
      if (/width\s*:\s*[0-3]p/i.test(cs)) return;
      // Skip SVG-only elements
      if (child.tagName === 'SVG') return;
      // Check if panel has significant content (5+ text/list elements)
      const contentElements = child.querySelectorAll('p, ul, ol, li, h3, h4, h5, div[style*="font-size"]');
      if (contentElements.length >= 5) {
        // When data-layout="chart-with-insights", more confidently require container box on text panel
        if (dataLayout === 'chart-with-insights') {
          errors.push(
            `[CONTAINER] Panel ${idx + 1} in chart-with-insights layout has ${contentElements.length} content elements but no Container Box (no border). ` +
            `ADD: border: 1.5px solid var(--brand-surface-light) and a shaded header bar. chart-with-insights requires structured text panels.`
          );
        } else {
          warnings.push(
            `[CONTAINER] Panel ${idx + 1} in flex layout has ${contentElements.length} content elements but no Container Box (no border). ` +
            `Consider adding: border: 1.5px solid var(--brand-surface-light) and a shaded header bar for visual structure.`
          );
        }
      }
    });
  });

  // 40. v4.2 Fix: Annotation-data color consistency (REWRITTEN)
  // v4.0/v4.1 bug: `uniqueColors.size === 1` only catches ALL-SAME colors.
  // 2 colors for 3 annotations passes — but the color MAPPING is still wrong.
  // v4.2: Cross-reference annotation border colors against chart data colors.

  // Helper: normalize color strings for comparison
  function normalizeColor(c) {
    if (!c) return '';
    c = c.trim().toLowerCase();
    // Expand 3-char hex to 6-char
    if (/^#[0-9a-f]{3}$/i.test(c)) {
      c = `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
    }
    return c;
  }

  // Strategy A: Check annotations near ECharts containers
  const chartContainers = document.querySelectorAll('[data-echarts]');
  chartContainers.forEach((chart, ci) => {
    const parent = chart.parentElement;
    if (!parent) return;

    // Extract chart series colors from data-echarts JSON
    const chartColors = new Set();
    try {
      const config = JSON.parse(chart.getAttribute('data-echarts'));
      (config.series || []).forEach(s => {
        if (s.itemStyle?.color) chartColors.add(normalizeColor(s.itemStyle.color));
        if (s.color) chartColors.add(normalizeColor(s.color));
        if (Array.isArray(s.data)) {
          s.data.forEach(d => {
            if (typeof d === 'object' && d.itemStyle?.color) chartColors.add(normalizeColor(d.itemStyle.color));
          });
        }
      });
      // Also check colorSequence on the option level
      if (Array.isArray(config.color)) {
        config.color.forEach(c => chartColors.add(normalizeColor(c)));
      }
    } catch (e) { /* JSON error caught elsewhere */ }

    // Find nearby annotation boxes (bordered elements with short text)
    const annotations = [];
    const searchRoot = parent.parentElement || parent;
    searchRoot.querySelectorAll('[style*="border"]').forEach(el => {
      if (el === chart || el.contains(chart) || chart.contains(el)) return;
      const s = el.getAttribute('style') || '';
      const text = el.textContent.trim();
      if (text.length > 0 && text.length < 120 && /border\s*:/.test(s)) {
        const borderColorMatch = s.match(/border\s*:\s*[\d.]+px\s+\w+\s+(.*?)(?:;|$)/i);
        if (borderColorMatch) {
          annotations.push({ color: normalizeColor(borderColorMatch[1]), text: text.substring(0, 40) });
        }
      }
    });

    if (annotations.length >= 2) {
      // Check 1: All annotations same color (original check, still valid)
      const uniqueAnnotColors = new Set(annotations.map(a => a.color));
      if (uniqueAnnotColors.size === 1) {
        errors.push(
          `[COLOR] ❌ ${annotations.length} annotation boxes near Chart ${ci + 1} all use the SAME border color.\n` +
          `  Each annotation's border color MUST match the color of the chart series it references.\n` +
          `  Uniform color for all annotations = WRONG when data uses different colors per category.\n` +
          `  MATCH each annotation's border to its data series color. Generation is BLOCKED.\n` +
          `  See slide_standardisation.md §4 "Annotation-to-Data Color Mapping".`
        );
      }

      // Check 2: Annotation border colors must exist in chart data colors
      if (chartColors.size > 0) {
        annotations.forEach(ann => {
          if (ann.color && !ann.color.includes('var(') && !chartColors.has(ann.color)) {
            errors.push(
              `[COLOR] ❌ Annotation "${ann.text}" has border color ${ann.color} which is NOT in the chart data colors.\n` +
              `  Chart colors: ${[...chartColors].join(', ')}\n` +
              `  MATCH the annotation border to the chart series it references. Generation is BLOCKED.`
            );
          }
        });
      }
    }
  });

  // Strategy B: Check annotations near HTML stacked bars (non-ECharts)
  // Detect flex containers with align-items:flex-end (stacked bar pattern)
  document.querySelectorAll('[style*="flex-end"]').forEach(barContainer => {
    const s = barContainer.getAttribute('style') || '';
    if (!/align-items\s*:\s*flex-end/i.test(s)) return;
    const bars = Array.from(barContainer.children).filter(c => {
      const cs = c.getAttribute('style') || '';
      return /flex-direction\s*:\s*column/i.test(cs) || c.children.length >= 2;
    });
    if (bars.length < 2) return;

    // Extract segment colors from bars
    const barColors = new Set();
    bars.forEach(bar => {
      bar.querySelectorAll('[style*="background"]').forEach(seg => {
        const segS = seg.getAttribute('style') || '';
        const bgMatch = segS.match(/background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8})/i);
        if (bgMatch) barColors.add(normalizeColor(bgMatch[1]));
      });
    });

    // Find nearby annotation elements (border-radius pills, bordered boxes)
    const searchRoot = barContainer.parentElement || barContainer;
    const annotations = [];
    searchRoot.querySelectorAll('[style*="border"]').forEach(el => {
      if (barContainer.contains(el)) return;
      const elS = el.getAttribute('style') || '';
      const text = el.textContent.trim();
      if (text.length > 0 && text.length < 80 && /border\s*:/.test(elS)) {
        const borderMatch = elS.match(/border\s*:\s*[\d.]+px\s+\w+\s+(#[0-9a-fA-F]{3,8})/i);
        if (borderMatch) {
          annotations.push({ color: normalizeColor(borderMatch[1]), text: text.substring(0, 40) });
        }
      }
    });

    if (annotations.length >= 2 && barColors.size > 0) {
      annotations.forEach(ann => {
        if (ann.color && !barColors.has(ann.color)) {
          errors.push(
            `[COLOR] ❌ Annotation "${ann.text}" has border color ${ann.color} which does NOT match any bar segment color.\n` +
            `  Bar segment colors: ${[...barColors].join(', ')}\n` +
            `  MATCH the annotation border to the bar segment it references. Generation is BLOCKED.`
          );
        }
      });
      // v4.4: Also check if all annotations use same color when bars have multiple
      const uniqueAnnotColors = new Set(annotations.map(a => a.color));
      if (uniqueAnnotColors.size === 1 && barColors.size > 1) {
        errors.push(
          `[COLOR-MAP] ❌ All ${annotations.length} annotations use the SAME border color ` +
          `but the bars have ${barColors.size} different segment colors.\n` +
          `  Each annotation MUST use the color of the bar segment it references.\n` +
          `  Bar colors: ${[...barColors].join(', ')}\n` +
          `  MAP each annotation to its target segment and use that segment's color.`
        );
      }
    }
  });

  // 41. v4.0 Fix G-E: Empty Container Box header detection
  document.querySelectorAll('[style*="border"]').forEach((container) => {
    const first = container.firstElementChild;
    if (!first) return;
    const fcs = first.getAttribute('style') || '';
    if (!/background/.test(fcs) || !/padding/.test(fcs)) return;
    // This is a Container Box header — check if it has meaningful text
    const headerText = first.textContent.trim();
    if (headerText.length === 0 || headerText === '.' || /^\s+$/.test(headerText)) {
      errors.push(
        `[CONTAINER] ❌ Container Box header is EMPTY or has invisible text ("${headerText || '(empty)'}"). ` +
        `ADD a descriptive title. Every Container Box MUST have a meaningful header. ` +
        `Generation is BLOCKED until fixed.`
      );
    }
    // Also detect color-matched-to-background text (invisible text trick)
    const headerEls = first.querySelectorAll('p, span, h3, h4, h5');
    headerEls.forEach(hEl => {
      const hs = hEl.getAttribute('style') || '';
      const textContent = hEl.textContent.trim();
      if (textContent.length <= 1) return; // Already caught above
      // Check if text color matches background color (invisible text)
      const colorMatch = hs.match(/(?:^|;)\s*color\s*:\s*(.*?)(?:;|$)/i);
      if (colorMatch) {
        const textColor = colorMatch[1].trim().toLowerCase();
        const bgMatch = fcs.match(/background(?:-color)?\s*:\s*(.*?)(?:;|$)/i);
        if (bgMatch) {
          const bgColor = bgMatch[1].trim().toLowerCase();
          if (textColor === bgColor || (textColor.includes('surface-light') && bgColor.includes('surface-light'))) {
            errors.push(
              `[CONTAINER] ❌ Container Box header has text color matching background — text is INVISIBLE. ` +
              `Change text color to var(--brand-primary) and write a descriptive title. Generation is BLOCKED.`
            );
          }
        }
      }
    });
  });

  // 42. v4.0 Fix G-F: SVG ViewBox aspect ratio check
  document.querySelectorAll('svg[viewBox]').forEach((svg, i) => {
    const vb = svg.getAttribute('viewBox');
    if (!vb) return;
    const parts = vb.split(/[\s,]+/).map(Number);
    if (parts.length < 4) return;
    const vbWidth = parts[2];
    const vbHeight = parts[3];
    if (vbWidth <= 0 || vbHeight <= 0) return;
    const vbRatio = vbWidth / vbHeight;
    // Get rendered dimensions
    const svgStyle = svg.getAttribute('style') || '';
    const renderedWidth = svg.getAttribute('width') || (svgStyle.match(/width\s*:\s*(\d+)/) || [])[1];
    const renderedHeight = svg.getAttribute('height') || (svgStyle.match(/height\s*:\s*(\d+)/) || [])[1];
    if (!renderedWidth || !renderedHeight) return;
    const rw = parseFloat(renderedWidth);
    const rh = parseFloat(renderedHeight);
    if (rw <= 0 || rh <= 0) return;
    // Check if viewBox is extremely shallow (height < 5% of width) — content will be flattened
    if (vbHeight < vbWidth * 0.05 && vbHeight < 30) {
      warnings.push(
        `[SVG] ⚠️  SVG ${i + 1} has extremely shallow viewBox (${vbWidth}×${vbHeight}). ` +
        `Content with vertical features (steps, curves, bars) will appear as a FLAT LINE. ` +
        `CHECK that the rendered shape matches inspiration. If it shows steps or jumps, increase viewBox height.`
      );
    }
    // Check extreme aspect ratio distortion (>3:1 difference between viewBox and rendered)
    const renderedRatio = rw / rh;
    const distortion = Math.max(vbRatio / renderedRatio, renderedRatio / vbRatio);
    if (distortion > 3) {
      warnings.push(
        `[SVG] ⚠️  SVG ${i + 1} viewBox aspect ratio (${vbRatio.toFixed(1)}:1) differs ${distortion.toFixed(1)}x from rendered dimensions. ` +
        `Your SVG content may be distorted/flattened. CHECK that the rendered shape matches inspiration.`
      );
    }
  });

  // 43. v4.0 Fix G-F: Element count vs structural inventory audit
  // Compare the number of top-level content elements against a reasonable expectation
  const contentZoneCheck = document.querySelector('.content-zone');
  if (contentZoneCheck) {
    // Count top-level content elements (direct children with visible content)
    let topLevelContentCount = 0;
    const countContentElements = (el) => {
      Array.from(el.children).forEach(child => {
        const cs = child.getAttribute('style') || '';
        if (/display\s*:\s*none/i.test(cs)) return;
        const hasText = child.textContent.trim().length > 0;
        const hasChart = child.querySelector('[data-echarts]') !== null;
        const hasSVG = child.querySelector('svg') !== null || child.tagName === 'SVG';
        if (hasText || hasChart || hasSVG) topLevelContentCount++;
      });
    };
    countContentElements(contentZoneCheck);
    // If structural inventory exists, compare
    const structTotal = Object.values(structureCounts).reduce((a, b) => a + b, 0);
    if (structTotal > 0 && topLevelContentCount > structTotal + 5) {
      warnings.push(
        `[FIDELITY] HTML has ${topLevelContentCount} top-level content elements but structural inventory accounts for ${structTotal}. ` +
        `AUDIT: trace every element back to the inspiration. Remove anything you invented that is not in the inspiration image.`
      );
    }
  }

  // 44. v4.4 BROADENED: Bullet marker presence in list-style:none containers
  // Only fires when 2+ items have substantive text (>20 chars) — skips legends, icon labels, tag lists.
  // Skip for structural slides (covers, agendas, summaries) — they may use custom list styling.
  if (!isStructural) {
    document.querySelectorAll('ul').forEach(ul => {
      const ulStyle = ul.getAttribute('style') || '';
      const hasListStyleNone = /list-style\s*:\s*none/i.test(ulStyle);
      if (!hasListStyleNone) return; // Browser default bullets will render
      const items = ul.querySelectorAll('li');
      // Count substantive items (real bullet content, not short legend labels)
      let substantiveCount = 0;
      items.forEach(li => {
        if (li.textContent.trim().length > 20) substantiveCount++;
      });
      if (substantiveCount < 2) return; // Skip legends, icon grids, tag lists
      let missingCount = 0;
      items.forEach((li, idx) => {
        // Only check substantive items
        if (li.textContent.trim().length <= 20) return;
        const liHTML = li.innerHTML;
        // Check for manual marker: &#9632; (■), &#8211; (–), &#8212; (—), or positioned span marker
        const hasManualMarker = /&#9632;|&#8211;|&#8212;|■|–|—/.test(liHTML) ||
          /position\s*:\s*absolute/.test(liHTML);
        if (!hasManualMarker) {
          missingCount++;
          if (missingCount <= 2) { // Report first 2, then summarize
            errors.push(
              `[BULLET] ❌ <ul list-style:none> item ${idx + 1} has NO manual marker span.\n` +
              `  ADD: <span style="position: absolute; left: 0;">&#9632;</span>\n` +
              `  Or use list-style: disc/square instead of list-style: none.\n` +
              `  Invisible bullets = FAIL. Generation is BLOCKED.`
            );
          }
        }
      });
      if (missingCount > 2) {
        errors.push(
          `[BULLET] ❌ ${missingCount} total items in <ul list-style:none> missing markers. Fix ALL items.`
        );
      }
    });
  }

  // 45. v4.5: Chart-adjacent text panel must have Container Box
  // When a flex row contains a chart AND a text panel, the text panel should be wrapped
  // in a Container Box (border + header) or Takeaway Box (dark bg). Bare text panels
  // floating next to charts look uncontained.
  // v5.1: Skip if the flex row is already INSIDE a Container Box (visual grouping rule —
  // chart + annotation area share one container, no need for separate containers).
  charts.forEach((chart, ci) => {
    // Walk up to nearest flex-row ancestor
    let flexParent = chart.parentElement;
    let depth = 0;
    while (flexParent && depth < 5) {
      const fps = flexParent.getAttribute('style') || '';
      if (/display\s*:\s*flex/i.test(fps) && !/flex-direction\s*:\s*column/i.test(fps)) break;
      flexParent = flexParent.parentElement;
      depth++;
    }
    if (!flexParent || depth >= 5) return;

    // v5.1: Skip if this flex row is inside a Container Box (bordered ancestor)
    let ancestor = flexParent.parentElement;
    let insideContainer = false;
    while (ancestor && ancestor !== document.body) {
      const as = ancestor.getAttribute('style') || '';
      if (/border\s*:/i.test(as) && !/border-bottom\s*:.*dashed/i.test(as)) {
        insideContainer = true;
        break;
      }
      ancestor = ancestor.parentElement;
    }
    if (insideContainer) return;

    // Find the chart's direct child in the flex container
    let chartChild = chart;
    while (chartChild.parentElement !== flexParent) {
      chartChild = chartChild.parentElement;
      if (!chartChild) return;
    }

    // Check each sibling that does NOT contain the chart
    Array.from(flexParent.children).forEach((sibling, si) => {
      if (sibling === chartChild || sibling.contains(chart) || chart.contains(sibling)) return;
      const ss = sibling.getAttribute('style') || '';
      // Skip if already has border (Container Box)
      if (/border\s*:/i.test(ss) && !/border-bottom\s*:.*dashed/i.test(ss)) return;
      // Skip if dark background (Takeaway Box)
      if (/--brand-primary|#1[eE]3[aA]5[fF]/i.test(ss)) return;
      // Skip if has opaque background (already styled) — transparent/none/inherit don't count
      if (/background/i.test(ss) && !/transparent|none|inherit|initial|unset/i.test(ss)) return;
      // Skip SVGs
      if (sibling.tagName === 'SVG') return;
      // Skip narrow elements (≤30pt width)
      const wMatch = ss.match(/width\s*:\s*(\d+)(pt|px)/i);
      if (wMatch && parseFloat(wMatch[1]) <= 30) return;
      // Count content elements — chart-with-insights layout enforces at threshold 1 (stricter)
      const contentEls = sibling.querySelectorAll('p, li, h3, h4, h5');
      const containerThreshold = dataLayout === 'chart-with-insights' ? 1 : 2;
      if (contentEls.length >= containerThreshold) {
        errors.push(
          `[CONTAINER] ❌ Panel ${si + 1} adjacent to Chart ${ci + 1} has ${contentEls.length} content elements but NO Container Box.\n` +
          `  Text panels beside charts MUST be wrapped in a Container Box (border + header bar) or Takeaway Box.\n` +
          `  ADD: border: 1.5px solid var(--brand-surface-light) and a shaded header bar.\n` +
          `  See slide_standardisation.md Section 2. Generation is BLOCKED.`
        );
      }
    });
  });

  // 46. v4.2: SVG overlay coordinate warning
  // SVGs with position:absolute and percentage dimensions but pixel coordinates
  // (and no viewBox) produce meaningless rendering.
  document.querySelectorAll('svg').forEach((svg, i) => {
    const s = svg.getAttribute('style') || '';
    const hasAbsolute = /position\s*:\s*absolute/i.test(s);
    if (!hasAbsolute) return;

    const hasPercentDims = /%/.test(s.match(/width\s*:\s*([^;]+)/)?.[1] || '') ||
                           /%/.test(s.match(/height\s*:\s*([^;]+)/)?.[1] || '');
    if (!hasPercentDims) return;

    const hasViewBox = svg.hasAttribute('viewBox');
    if (hasViewBox) return;

    // Check for line/path elements with coordinates > 10 (likely pixel coords)
    const lines = svg.querySelectorAll('line, path');
    let hasLargeCoords = false;
    lines.forEach(el => {
      ['x1', 'y1', 'x2', 'y2'].forEach(attr => {
        const val = parseFloat(el.getAttribute(attr) || '0');
        if (val > 10) hasLargeCoords = true;
      });
      const d = el.getAttribute('d') || '';
      const numbers = d.match(/\d+/g) || [];
      if (numbers.some(n => parseInt(n) > 10)) hasLargeCoords = true;
    });

    if (hasLargeCoords) {
      warnings.push(
        `[SVG] ⚠️  SVG overlay ${i + 1} uses position:absolute with percentage dimensions but has pixel coordinates WITHOUT a viewBox.\n` +
        `  ADD viewBox="0 0 W H" where W and H match the chart container's pixel dimensions.\n` +
        `  Without viewBox, pixel coordinates in a percentage-sized SVG produce MEANINGLESS rendering.\n` +
        `  Example: If container is 600×300, use viewBox="0 0 600 300".`
      );
    }
  });

  // 47. v4.3: Sibling style consistency in flex containers
  // Detect when one sibling in a group is missing a style that the majority have
  document.querySelectorAll('[style*="display: flex"], [style*="display:flex"]').forEach((flex, fi) => {
    const s = flex.getAttribute('style') || '';
    if (/flex-direction\s*:\s*column/i.test(s)) return;

    // Skip grid/table rows — alternating column backgrounds are intentional (§9)
    if (/border-bottom\s*:.*dashed/i.test(s)) return;
    // Also skip if parent has dashed border (row inside a grid structure)
    const flexParent = flex.parentElement;
    if (flexParent) {
      const ps = flexParent.getAttribute('style') || '';
      if (/border-bottom\s*:.*dashed/i.test(ps)) return;
    }

    const children = Array.from(flex.children).filter(c => {
      const cs = c.getAttribute('style') || '';
      return c.tagName === 'DIV' && !/display\s*:\s*none/i.test(cs);
    });
    if (children.length < 3) return;

    // Skip if children use flex:1 uniformly (grid column pattern — alternating bg is intentional)
    const flexOneCount = children.filter(c => {
      const cs = c.getAttribute('style') || '';
      return /flex\s*:\s*1/i.test(cs);
    }).length;
    if (flexOneCount >= children.length - 1 && children.length >= 4) return;

    // Check key style properties across siblings
    const properties = ['background', 'border', 'border-radius'];
    properties.forEach(prop => {
      let hasCount = 0;
      let missingIndices = [];

      children.forEach((child, idx) => {
        const cs = child.getAttribute('style') || '';
        // Skip narrow elements (separators, connectors, arrows)
        const widthMatch = cs.match(/width\s*:\s*(\d+)/i);
        if (widthMatch && parseFloat(widthMatch[1]) <= 10) return;
        // Skip elements that are likely structural (SVG containers, etc)
        if (child.querySelector('svg') && child.querySelectorAll('p, ul, li, h3, h4').length === 0) return;

        const hasProp = new RegExp(prop + '(?:-color)?\\s*:', 'i').test(cs);
        if (hasProp) {
          hasCount++;
        } else {
          // Only flag if this child has significant content
          const contentEls = child.querySelectorAll('p, ul, ol, li, h3, h4, h5');
          if (contentEls.length >= 2) {
            missingIndices.push(idx + 1);
          }
        }
      });

      // If majority have the property but some content-bearing siblings don't
      if (hasCount >= 2 && missingIndices.length > 0 && hasCount > missingIndices.length) {
        missingIndices.forEach(idx => {
          warnings.push(
            `[SIBLING] ⚠️  Flex container: div ${idx} of ${children.length} is MISSING "${prop}" ` +
            `that ${hasCount} siblings have.\n` +
            `  FIX: Add matching ${prop} style to div ${idx} for visual consistency.\n` +
            `  Siblings in the same flex row should share the same visual treatment (background, border, border-radius).`
          );
        });
      }
    });
  });

  // 48. v4.5: Numeric data labels as HTML position:absolute overlays on charts
  // Short numeric text (totals, growth %, deltas) placed as absolute-positioned divs
  // on chart containers should use ECharts native features instead (markPoint, label).
  charts.forEach((chart, ci) => {
    const chartParent = chart.parentElement;
    if (!chartParent) return;
    // Search the chart's container for absolute-positioned descendant divs
    const searchRoot = chartParent;
    searchRoot.querySelectorAll('[style*="position"]').forEach(el => {
      if (el === chart || chart.contains(el)) return;
      const es = el.getAttribute('style') || '';
      if (!/position\s*:\s*absolute/i.test(es)) return;
      // Skip hybrid overlays using $dataCoord CSS vars (intentional data-bound overlays)
      if (/var\(--gfx-/i.test(es)) return;
      // Skip SVGs
      if (el.tagName === 'SVG' || el.querySelector('svg')) return;
      const text = el.textContent.trim();
      // Skip empty or long text (long text is likely callout content, not a data label)
      if (!text || text.length > 15) return;
      // Check if text matches numeric data label pattern: optional sign/currency, digits, optional unit
      const isNumericLabel = /^[+\-±]?\$?€?£?\s?\d[\d,.\s]*[%MKBmkb€£¥]?\s*$/.test(text);
      if (isNumericLabel) {
        errors.push(
          `[ECHARTS] ❌ Numeric label "${text}" is an HTML position:absolute div overlaying Chart ${ci + 1}.\n` +
          `  Data labels (totals, growth %, deltas) MUST use ECharts native features:\n` +
          `  - markPoint: { data: [{ coord: [x, y], value: '${text}' }] }\n` +
          `  - Invisible top series with label: { show: true, position: 'top' }\n` +
          `  - For callout boxes: use $callouts on series (see echarts_annotation_guide.md §4)\n` +
          `  CSS overlays DON'T track chart coordinates and WILL misalign.\n` +
          `  See slide_standardisation.md §15.2/§15.4/§15.9. Generation is BLOCKED.`
        );
      }
    });
  });

  // 49. v4.4: Sibling panels must use CONSISTENT bullet formatting
  // Catches: box 1 uses ■ markers, box 2 uses list-style:square, box 3 has no markers
  document.querySelectorAll('[style*="display: flex"], [style*="display:flex"]').forEach(flex => {
    const s = flex.getAttribute('style') || '';
    if (/flex-direction\s*:\s*column/i.test(s)) return;

    const children = Array.from(flex.children).filter(c => c.tagName === 'DIV');
    if (children.length < 2) return;

    const bulletStyles = [];
    children.forEach((child, idx) => {
      const uls = child.querySelectorAll('ul');
      if (uls.length === 0) return;
      uls.forEach(ul => {
        const ulStyle = ul.getAttribute('style') || '';
        const hasListStyleNone = /list-style\s*:\s*none/i.test(ulStyle);
        const hasListStyleSquare = /list-style\s*:\s*(square|disc)/i.test(ulStyle);
        const items = ul.querySelectorAll('li');
        let hasManualMarkers = false;
        items.forEach(li => {
          if (/&#9632;|&#8211;|&#8212;|■|–|—/.test(li.innerHTML) || /position\s*:\s*absolute/.test(li.innerHTML)) {
            hasManualMarkers = true;
          }
        });
        bulletStyles.push({
          panelIdx: idx + 1,
          method: hasManualMarkers ? 'manual' : hasListStyleSquare ? 'list-style' : hasListStyleNone ? 'none' : 'default'
        });
      });
    });

    if (bulletStyles.length < 2) return;
    const methods = [...new Set(bulletStyles.map(b => b.method))];
    if (methods.length > 1 && methods.includes('none')) {
      const nonePanels = bulletStyles.filter(b => b.method === 'none').map(b => `panel ${b.panelIdx}`);
      errors.push(
        `[BULLET-CONSISTENCY] ❌ Sibling panels use INCONSISTENT bullet formatting.\n` +
        `  ${nonePanels.join(', ')} have NO bullet markers while siblings do.\n` +
        `  FIX: Use manual ■ markers (&#9632; spans) consistently in ALL sibling panels.\n` +
        `  NEVER mix list-style:square (ignored by pipeline) with manual markers.`
      );
    }
  });

  // 50. v4.5: SVG fixed pt/px width in fluid container
  // SVGs with fixed pt/px widths inside fluid parents (flex:1, width:N%, no explicit width)
  // won't span their container. Should use width="100%" + viewBox.
  document.querySelectorAll('svg').forEach((svg, i) => {
    const widthAttr = svg.getAttribute('width') || '';
    // Check for pt or px in width attribute
    const fixedWidthMatch = widthAttr.match(/^(\d+(?:\.\d+)?)\s*(pt|px)$/i);
    if (!fixedWidthMatch) return;
    const fixedWidth = parseFloat(fixedWidthMatch[1]);
    // Skip small icons (≤100)
    if (fixedWidth <= 100) return;

    // Check if parent has fluid sizing
    const parent = svg.parentElement;
    if (!parent) return;
    const ps = parent.getAttribute('style') || '';
    const hasFluidSizing =
      /flex\s*:\s*1/i.test(ps) ||
      /width\s*:\s*\d+%/i.test(ps) ||
      (!(/width\s*:\s*\d+\s*(pt|px)/i.test(ps)) && /display\s*:\s*flex/i.test(ps));

    if (hasFluidSizing) {
      warnings.push(
        `[SVG] ⚠️  SVG ${i + 1} has fixed width="${widthAttr}" but parent uses fluid sizing (${
          /flex\s*:\s*1/i.test(ps) ? 'flex:1' : /width\s*:\s*\d+%/i.test(ps) ? 'percentage width' : 'flex container'
        }).\n` +
        `  The SVG will NOT span its container — it will render at fixed ${widthAttr}.\n` +
        `  CHANGE to: width="100%" with viewBox preserving aspect ratio.\n` +
        `  Example: <svg width="100%" viewBox="0 0 ${Math.round(fixedWidth)} HEIGHT" preserveAspectRatio="xMidYMid meet">`
      );
    }
  });

  // 51. v4.6: Callout-style divs on charts — suggest ECharts graphic
  // Find position:absolute divs inside chart containers that have border styling
  // and short text (callout boxes). Skip SVGs, empty, and numeric labels (check 48).
  charts.forEach((chart, ci) => {
    const chartParent = chart.parentElement;
    if (!chartParent) return;
    chartParent.querySelectorAll('[style*="position"]').forEach(el => {
      if (el === chart || chart.contains(el)) return;
      const es = el.getAttribute('style') || '';
      if (!/position\s*:\s*absolute/i.test(es)) return;
      // Skip SVGs
      if (el.tagName === 'SVG' || el.querySelector('svg')) return;
      const text = el.textContent.trim();
      // Skip empty or very long text
      if (!text || text.length > 40) return;
      // Skip numeric labels (already caught by check 48)
      if (/^[+\-±]?\$?€?£?\s?\d[\d,.\s]*[%MKBmkb€£¥]?\s*$/.test(text)) return;
      // Check if has border styling (callout box pattern)
      if (/border\s*:/i.test(es)) {
        warnings.push(
          `[CALLOUT] ⚠ Callout-style div "${text.substring(0, 25)}..." is HTML position:absolute on Chart ${ci + 1}.\n` +
          `  Use $callouts on the series instead — pipeline generates label + labelLayout + labelLine.\n` +
          `  Pattern: series.$callouts = [{ dataIndex, text, position, offsetX }]\n` +
          `  No HTML overlay divs needed — callout text is native ECharts label.\n` +
          `  See echarts_annotation_guide.md §4 and slide_standardisation.md §15.9.`
        );
      }
    });
  });

  // 52. v4.6: Red/brand-negative color triggers verification
  // Scan all elements for usage of brand-negative color (#C62828 or var(--brand-negative))
  const redPatterns = [/#C62828/gi, /var\(--brand-negative\)/gi];
  let redOccurrences = [];

  // Check inline styles
  document.querySelectorAll('[style]').forEach(el => {
    const s = el.getAttribute('style') || '';
    for (const pat of redPatterns) {
      pat.lastIndex = 0;
      if (pat.test(s)) {
        redOccurrences.push({ tag: el.tagName.toLowerCase(), source: 'style' });
        break;
      }
    }
  });

  // Check SVG fill/stroke attributes
  document.querySelectorAll('svg [fill], svg [stroke]').forEach(el => {
    ['fill', 'stroke'].forEach(attr => {
      const val = (el.getAttribute(attr) || '').trim();
      if (/^#C62828$/i.test(val)) {
        redOccurrences.push({ tag: `svg ${el.tagName.toLowerCase()}`, source: attr });
      }
    });
  });
  // Check SVG stop-color
  document.querySelectorAll('svg stop').forEach(el => {
    const sc = (el.getAttribute('stop-color') || '').trim();
    if (/^#C62828$/i.test(sc)) {
      redOccurrences.push({ tag: 'svg stop', source: 'stop-color' });
    }
  });

  // Check data-echarts JSON content
  charts.forEach((chart, ci) => {
    const raw = chart.getAttribute('data-echarts') || '';
    if (/#C62828/i.test(raw) || /--brand-negative/.test(raw)) {
      redOccurrences.push({ tag: `chart ${ci + 1} data-echarts`, source: 'echarts config' });
    }
  });

  // Report each occurrence
  redOccurrences.forEach(occ => {
    warnings.push(
      `[COLOR] ⚠ Red semantic color (--brand-negative / #C62828) detected on <${occ.tag}> via ${occ.source}.\n` +
      `  Red is ONLY for semantic negative indicators (losses, declines, errors).\n` +
      `  VERIFY: Is this red color present in the inspiration image?\n` +
      `  If NOT in inspiration → replace with var(--brand-surface-light) or var(--brand-gray-border).\n` +
      `  If YES in inspiration → confirm it represents a genuine negative/loss indicator.`
    );
  });

  // 53. v4.6.1: flex:1 stacking — flex column with flex:1 child squeezes non-flex text siblings
  document.querySelectorAll('[style*="flex-direction"]').forEach((flex, fi) => {
    const fs = flex.getAttribute('style') || '';
    if (!/flex-direction\s*:\s*column/i.test(fs)) return;
    if (!/display\s*:\s*flex/i.test(fs)) return;
    const children = Array.from(flex.children);
    if (children.length < 2) return;
    let hasFlex1 = false;
    const squeezed = [];
    children.forEach((child, ci) => {
      const cs = child.getAttribute('style') || '';
      if (/flex\s*:\s*1\b/i.test(cs)) { hasFlex1 = true; return; }
      const hasText = child.textContent.trim().length > 20;
      const hasFixedH = /(?:min-)?height\s*:\s*\d+/i.test(cs);
      const isTransparent = /color\s*:\s*transparent/i.test(cs);
      if (hasText && !hasFixedH && !isTransparent) squeezed.push({ ci, text: child.textContent.trim().substring(0, 40) });
    });
    if (hasFlex1 && squeezed.length > 0) {
      squeezed.forEach(s => {
        errors.push(`[FLEX-STACK] Flex column has flex:1 child + non-flex text sibling (child ${s.ci + 1}: "${s.text}..."). ` +
          `flex:1 consumes ALL space, squeezing text to zero height. FIX: add min-height to text sibling OR remove flex:1 and use explicit heights.`);
      });
    }
  });

  // 54. Body must have class="brand-slide"
  const bodyEl54 = document.querySelector('body');
  if (bodyEl54) {
    const bodyClass = bodyEl54.getAttribute('class') || '';
    if (!bodyClass.includes('brand-slide')) {
      errors.push(`[SKELETON] <body> is missing class="brand-slide". Add class="brand-slide" to <body>. ` +
        `This injects slide dimensions (960×540pt), fonts, and all var(--brand-*) CSS variables automatically. ` +
        `See slide_standardisation.md §0.`);
    }

    // 55. Body must NOT have inline width/height
    const bodyStyle = bodyEl54.getAttribute('style') || '';
    if (/\bwidth\s*:/i.test(bodyStyle) || /\bheight\s*:/i.test(bodyStyle)) {
      errors.push(`[SKELETON] <body> has explicit width/height in style attribute. Remove them. ` +
        `Use class="brand-slide" instead — pipeline sets dimensions automatically. ` +
        `WRONG: <body style="width: 1280px; height: 720px"> ` +
        `CORRECT: <body class="brand-slide">`);
    }
  }

  // 56. No ::before/::after pseudo-elements in <style> blocks
  const styleElements = document.querySelectorAll('style');
  styleElements.forEach((styleEl, i) => {
    const cssText = styleEl.textContent || '';
    if (/::before|::after/.test(cssText)) {
      errors.push(`[PSEUDO] <style> block ${i + 1} uses ::before or ::after pseudo-elements. ` +
        `These are NOT rendered in PPTX — content will silently disappear. ` +
        `Use real DOM elements (<span>, <div>) instead. See slide_standardisation.md §0 FORBIDDEN CSS.`);
    }
  });

  // 57. No $dataCoord or $lineDataCoords in graphic elements
  // These properties are unsupported for new HTML — use markLine, $callouts, markPoint instead.
  charts.forEach((chart, ci) => {
    const raw = chart.getAttribute('data-echarts');
    if (!raw) return;
    let config;
    try { config = JSON.parse(raw); } catch { return; }
    const graphics = Array.isArray(config.graphic) ? config.graphic : config.graphic ? [config.graphic] : [];
    function walkGraphic(obj, path) {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        obj.forEach((item, i) => walkGraphic(item, `${path}[${i}]`));
        return;
      }
      if ('$dataCoord' in obj) {
        errors.push(
          `[GRAPHIC] ❌ Unsupported property '$dataCoord' on ${path} in Chart ${ci + 1}.\n` +
          `  Use markLine two-point for delta pills (§3 in echarts_annotation_guide.md),\n` +
          `  $callouts for callout boxes (§4), or markPoint for data labels.\n` +
          `  Generation is BLOCKED.`
        );
      }
      if ('$lineDataCoords' in obj) {
        errors.push(
          `[GRAPHIC] ❌ Unsupported property '$lineDataCoords' on ${path} in Chart ${ci + 1}.\n` +
          `  Use markLine two-point for delta pills (§3 in echarts_annotation_guide.md),\n` +
          `  $callouts for callout boxes (§4), or markPoint for data labels.\n` +
          `  Generation is BLOCKED.`
        );
      }
      if (Array.isArray(obj.children)) {
        obj.children.forEach((child, i) => walkGraphic(child, `${path}.children[${i}]`));
      }
    }
    graphics.forEach((g, gi) => walkGraphic(g, `graphic[${gi}]`));
  });

  // 58. $callouts require adequate grid margins
  charts.forEach((chart, ci) => {
    const raw = chart.getAttribute('data-echarts');
    if (!raw) return;
    let config;
    try { config = JSON.parse(raw); } catch { return; }
    const seriesList = Array.isArray(config.series) ? config.series : config.series ? [config.series] : [];
    seriesList.forEach((s, si) => {
      if (!s.$callouts || !Array.isArray(s.$callouts)) return;
      const grid = config.grid || {};
      s.$callouts.forEach(callout => {
        const pos = callout.position || 'right';
        if (pos === 'right') {
          const gridRight = typeof grid.right === 'number' ? grid.right : parseInt(grid.right) || 20;
          if (gridRight < 150) {
            errors.push(`[CALLOUT-MARGIN] Chart ${ci + 1}, series ${si + 1}: has $callouts with position="right" but grid.right is only ${gridRight}px. ` +
              `Callout boxes need ≥150px of margin space. Set grid.right ≥ 170.`);
          }
        } else if (pos === 'left') {
          const gridLeft = typeof grid.left === 'number' ? grid.left : parseInt(grid.left) || 20;
          if (gridLeft < 150) {
            errors.push(`[CALLOUT-MARGIN] Chart ${ci + 1}, series ${si + 1}: has $callouts with position="left" but grid.left is only ${gridLeft}px. ` +
              `Callout boxes need ≥150px of margin space. Set grid.left ≥ 170.`);
          }
        }
      });
    });
  });

  // 59. No nested lists (<ul>/<ol> inside <li>)
  const nestedLists = document.querySelectorAll('li > ul, li > ol');
  if (nestedLists.length > 0) {
    errors.push(`[NESTED-LIST] Found ${nestedLists.length} nested list(s) (<ul>/<ol> inside <li>). ` +
      `Nested lists are silently dropped in PPTX — sub-bullets overlap parent bullets. ` +
      `Use a flat <ul> with visual hierarchy (different markers ■/–, font sizes, padding-left). ` +
      `See slide_standardisation.md §3.`);
  }

  // 60. No hardcoded hex colors in data-echarts configs (deduplicated per chart)
  if (Object.keys(brandHexToToken).length > 0) {
    charts.forEach((chart, ci) => {
      const raw = chart.getAttribute('data-echarts');
      if (!raw) return;
      const hexPattern = /#[0-9a-fA-F]{6}\b/g;
      const seenHex = new Set();
      let match;
      while ((match = hexPattern.exec(raw)) !== null) {
        const hex = match[0].toUpperCase();
        if (seenHex.has(hex)) continue;
        seenHex.add(hex);
        const token = brandHexToToken[hex];
        if (token) {
          errors.push(`[HARDCODED-HEX] Chart ${ci + 1}: contains hardcoded hex color "${match[0]}". ` +
            `Use brand token ${token} instead. ALL colors in data-echarts configs must use var(--brand-*) tokens — ` +
            `render_echarts.mjs resolves them automatically.`);
        } else {
          warnings.push(`[HARDCODED-HEX] Chart ${ci + 1}: contains hex color "${match[0]}" which has no known brand equivalent. ` +
            `Verify no brand token exists for this color.`);
        }
      }
    });
  }

  // 61. Fixed-width-only flex rows — horizontal fill risk
  // General principle: multi-column layouts should use flex proportions, not fixed widths.
  // Fixed widths don't scale to the container and can leave large horizontal gaps.
  const contentZoneEl = document.querySelector('.content-zone');
  if (contentZoneEl) {
    contentZoneEl.querySelectorAll('*').forEach((el) => {
      const s = el.getAttribute('style') || '';
      if (!/display\s*:\s*flex/i.test(s)) return;
      if (/flex-direction\s*:\s*column/i.test(s)) return; // skip column layouts
      const children = Array.from(el.children);
      if (children.length < 3) return; // need 3+ children to be a multi-column row
      let fixedCount = 0, flexCount = 0, totalFixedPt = 0;
      children.forEach(child => {
        const cs = child.getAttribute('style') || '';
        const wMatch = cs.match(/(?:^|;)\s*width\s*:\s*(\d+)\s*pt/i);
        const fMatch = cs.match(/(?:^|;)\s*flex\s*:\s*\d/i);
        if (wMatch) { fixedCount++; totalFixedPt += parseInt(wMatch[1]); }
        if (fMatch) flexCount++;
      });
      // Only warn when ALL children use fixed widths (no flex children) and total is
      // between 100-400pt. Below 100pt = tiny utility elements (icons, badges, chevrons).
      if (fixedCount >= 3 && flexCount === 0 && totalFixedPt >= 100 && totalFixedPt < 400) {
        warnings.push(
          `[HORIZONTAL-FILL] Flex row has ${fixedCount} children ALL using fixed widths ` +
          `(total: ${totalFixedPt}pt). This likely leaves empty horizontal space.\n` +
          `  Use flex proportions (flex:N) instead of fixed widths (width:Npt) so columns ` +
          `scale to fill the container. See slide_standardisation.md §15.8.`
        );
      }
    });
  }

  // 62. Absolute-positioned elements in title-zone — collision risk with wrapping content
  // General principle: position:absolute in a zone with text that can wrap = collision risk.
  const titleZoneAbs = document.querySelector('.title-zone');
  if (titleZoneAbs) {
    const absChildren = Array.from(titleZoneAbs.querySelectorAll('[style*="position"]')).filter(el => {
      const s = el.getAttribute('style') || '';
      return /position\s*:\s*absolute/i.test(s);
    });
    if (absChildren.length > 0) {
      const h1Abs = titleZoneAbs.querySelector('h1');
      if (h1Abs) {
        const titleText = h1Abs.textContent.trim();
        // Warn when title is long enough to potentially wrap alongside absolute elements
        if (titleText.length > 50) {
          warnings.push(
            `[TITLE-COLLISION] Title zone has ${absChildren.length} absolute-positioned ` +
            `element(s) and a title of ${titleText.length} chars. Long titles that wrap to ` +
            `multiple lines WILL collide with absolute-positioned elements (legends, badges).\n` +
            `  Use flex layout instead: title-zone with display:flex, title with flex:1, ` +
            `adjacent element with flex-shrink:0. See slide_standardisation.md §1.`
          );
        }
      }
    }
  }

  // ── Check 63: LEGEND-WRAP ──
  // When title-zone uses display:flex and contains h1 + sibling div (legend), verify:
  //   1. flex-direction: row is EXPLICITLY set (class default is column)
  //   2. h1 has max-width
  // Without both, legend WILL wrap below title.
  {
    const titleZones = document.querySelectorAll('.title-zone, [class*="title"]');
    titleZones.forEach(tz => {
      const style = tz.getAttribute('style') || '';
      if (!style.includes('display') || !style.includes('flex')) return;
      // If inline style explicitly sets flex-direction: column, this is intentional stacking
      if (/flex-direction\s*:\s*column/.test(style)) return;

      const h1 = tz.querySelector('h1');
      if (!h1) return;

      // Check if there's a sibling element after h1 (legend container)
      const siblings = Array.from(tz.children).filter(el => el !== h1 && el.tagName !== 'P');
      if (siblings.length === 0) return;

      const titleText = h1.textContent.trim();
      const h1Style = h1.getAttribute('style') || '';
      const issues = [];

      // Check 1: flex-direction: row must be EXPLICIT (class .title-zone defaults to column)
      if (!/flex-direction\s*:\s*row/.test(style)) {
        issues.push('title-zone missing flex-direction:row (class default is column — legend will stack below title)');
      }

      // Check 2: h1 must have max-width to cap title width
      if (!h1Style.includes('max-width')) {
        issues.push('h1 lacks max-width (long titles will push legend away)');
      }

      if (issues.length > 0) {
        warnings.push(
          `[LEGEND-WRAP] Title-zone has flex layout with h1 (${titleText.length} chars) + ` +
          `legend sibling:\n` +
          issues.map(i => `  - ${i}`).join('\n') + `\n` +
          `  Fix: add flex-direction:row; flex-wrap:nowrap to title-zone, ` +
          `max-width:75% to h1, min-width:140pt to legend. See slide_standardisation.md §1.`
        );
      }
    });
  }

  // ── Check 64: PER-PANEL-FILL ──
  // Rule 12 mandates ≥70% fill per panel, but check 15 only measures OVERALL fill.
  // This check measures each panel INDIVIDUALLY.
  // Skip for structural slides (covers, agendas, summaries) — they have intentionally sparse content.
  const contentZonePPF = document.querySelector('.content-zone');
  if (contentZonePPF && !isStructural) {
    // Find top-level flex row containers (side-by-side panels)
    const topFlexRows = Array.from(contentZonePPF.querySelectorAll('[style*="display: flex"], [style*="display:flex"]')).filter(el => {
      const s = el.getAttribute('style') || '';
      if (/flex-direction\s*:\s*column/i.test(s)) return false;
      // Must be a DIRECT child of content-zone (depth 0) or inside one flex-direction:column wrapper (depth 1)
      // Deeper flex rows are table rows / grid rows — not layout panels
      let parent = el.parentElement;
      let depth = 0;
      while (parent && parent !== contentZonePPF && depth < 2) { parent = parent.parentElement; depth++; }
      return parent === contentZonePPF && depth <= 1;
    });

    // Estimate available height per row: 680pt (content zone) / number of top rows
    const availablePerRow = topFlexRows.length > 0 ? Math.round(680 / topFlexRows.length) : 300;

    let ppfUnderfilled = [];
    topFlexRows.forEach((row, ri) => {
      const children = Array.from(row.children);
      if (children.length < 2) return; // need at least 2 panels
      if (children.length > 4) return; // >4 children = grid/table row, not layout panels

      // Only check rows where at least one child has flex:N — indicates primary layout columns
      const hasFlexChild = children.some(c => /flex\s*:\s*\d/i.test(c.getAttribute('style') || ''));
      if (!hasFlexChild) return;

      // Use max(200, availablePerRow) to avoid flagging short rows in multi-row layouts
      const availableH = Math.max(200, availablePerRow);

      children.forEach((panel, pi) => {
        const ps = panel.getAttribute('style') || '';
        // Skip narrow fixed-width elements (labels, sidebars <100pt)
        const wMatch = ps.match(/width\s*:\s*(\d+)\s*pt/i);
        if (wMatch && parseInt(wMatch[1]) < 100) return;

        // Estimate content height within this panel
        let contentH = 0;
        const panelCharts = panel.querySelectorAll('[data-echarts]');
        panelCharts.forEach(c => { contentH += 180; }); // charts take ~180pt
        contentH += panel.querySelectorAll('li').length * 16;
        contentH += panel.querySelectorAll('tr').length * 18;
        const panelParas = panel.querySelectorAll('p');
        panelParas.forEach(p => {
          const text = p.textContent.trim();
          if (text.length > 0) contentH += Math.max(1, Math.ceil(text.length / 60)) * 14;
        });
        // Count containers (header + padding)
        const containers = panel.querySelectorAll('[style*="border"]');
        let containerPadding = 0;
        containers.forEach(c => {
          const cs = c.getAttribute('style') || '';
          if (/background/.test(cs) && /padding/.test(cs)) containerPadding += 30;
        });
        contentH += containerPadding;

        const fillPct = (contentH / availableH) * 100;

        if (contentH > 0 && fillPct < 70 && panelCharts.length === 0) {
          ppfUnderfilled.push({ panel: pi + 1, row: ri + 1, contentH: Math.round(contentH), availH: availableH, pct: Math.round(fillPct) });
        }
      });
    });
    // Emit ONE summary warning (not per-panel) — JSDOM estimation is approximate
    if (ppfUnderfilled.length > 0) {
      const worst = ppfUnderfilled.reduce((a, b) => a.pct < b.pct ? a : b);
      warnings.push(
        `[PER-PANEL-FILL] ${ppfUnderfilled.length} panel(s) estimated below 70% vertical fill. ` +
        `Worst: Panel ${worst.panel} in row ${worst.row} (~${worst.pct}% of ~${worst.availH}pt).\n` +
        `  Fix: increase font sizes, padding/spacing, or add content. See Rule 12.\n` +
        `  Note: JSDOM estimate — runtime [panel-underfill] in html2pptx.mjs uses Playwright for precise measurement.`
      );
    }
  }

  // ── Check 65: SVG-VAR-ATTRIBUTE ──
  // CSS custom properties work in inline SVG (modern browsers/Playwright) but NOT in standalone SVG files.
  // Since our pipeline always uses inline SVG, this is a low-priority advisory — emit ONE summary per file.
  {
    let svgVarCount = 0;
    document.querySelectorAll('svg *').forEach(el => {
      ['fill', 'stroke'].forEach(attr => {
        const val = el.getAttribute(attr);
        if (val && /var\s*\(/.test(val)) svgVarCount++;
      });
    });
    if (svgVarCount > 0) {
      warnings.push(
        `[SVG-VAR-ATTRIBUTE] ${svgVarCount} SVG element(s) use var(--brand-*) in fill/stroke attributes. ` +
        `Hex values from branding/mckinsey.json are preferred for maximum PPTX compatibility.`
      );
    }
  }

  // ── Check 66: UNDEFINED-CSS-VAR ──
  // Build the set of ALL valid --brand-* variable names from the canonical map
  const validBrandVars = new Set(Object.values(brandHexToToken).map(v => {
    const m = v.match(/var\((--brand-[^)]+)\)/);
    return m ? m[1] : null;
  }).filter(Boolean));
  // Also add ALL valid vars from branding.mjs generateInjectableCSS() that aren't in hex map
  [
    // Fonts
    '--brand-font-heading', '--brand-font-body', '--brand-font-data',
    // Chart sequence
    '--brand-chart-1', '--brand-chart-2', '--brand-chart-3', '--brand-chart-4',
    '--brand-chart-5', '--brand-chart-6', '--brand-chart-7',
    // Tier colors (some may already be in hex map, Set handles duplicates)
    '--brand-primary', '--brand-secondary', '--brand-tertiary', '--brand-quaternary', '--brand-quinary',
    '--brand-accent', '--brand-accent-teal', '--brand-accent-orange',
    '--brand-positive', '--brand-negative', '--brand-warning', '--brand-neutral',
    '--brand-gray-dark', '--brand-gray-medium', '--brand-gray-light', '--brand-gray-silver', '--brand-gray-border',
    '--brand-text', '--brand-text-primary', '--brand-text-secondary', '--brand-text-inverse',
    '--brand-bg-primary', '--brand-bg-secondary', '--brand-bg-dark',
    '--brand-surface-light', '--brand-surface-muted',
    // Common aliases used in existing correct HTML files
    '--brand-text-body',         // alias for --brand-text
    '--brand-border',            // alias for --brand-gray-border
    '--brand-secondary-blue',    // alias for --brand-secondary
    '--brand-accent-light',      // lighter accent variant
    '--brand-accent-gold',       // alias for --brand-accent
    '--brand-blue-light',        // alias for --brand-quaternary
    '--brand-gray-dk',           // alias for --brand-gray-dark
    '--brand-gray-md',           // alias for --brand-gray-medium
    '--brand-surface-lgt',       // alias for --brand-surface-light
    '--brand-secondary-light',   // alias for --brand-quaternary
    '--brand-secondary-medium',  // alias for --brand-tertiary
    '--brand-secondary-pale',    // alias for --brand-quinary
    '--brand-semantic-neutral',  // alias for --brand-neutral
  ].forEach(v => validBrandVars.add(v));

  if (validBrandVars.size > 0) {
    document.querySelectorAll('[style]').forEach(el => {
      const style = el.getAttribute('style') || '';
      const varRefs = style.matchAll(/var\(\s*(--brand-[a-zA-Z0-9-]+)\s*(?:,\s*[^)]+)?\)/g);
      for (const match of varRefs) {
        const varName = match[1];
        if (!validBrandVars.has(varName)) {
          // Find closest match for suggestion
          let closest = '';
          let minDist = Infinity;
          for (const valid of validBrandVars) {
            // Simple prefix match
            const common = [...varName].filter((c, i) => valid[i] === c).length;
            const dist = Math.max(varName.length, valid.length) - common;
            if (dist < minDist) { minDist = dist; closest = valid; }
          }
          // WARNING (not ERROR): some var aliases resolve at runtime via CSS inheritance
          warnings.push(
            `[UNDEFINED-CSS-VAR] Element <${el.tagName.toLowerCase()}>: var(${varName}) is not a recognized brand variable.\n` +
            (closest ? `  Did you mean: var(${closest})?` : '')
          );
        }
      }
    });

    // Also check inside data-echarts JSON for undefined var() references
    charts.forEach((chart, ci) => {
      const raw = chart.getAttribute('data-echarts') || '';
      const varRefs = raw.matchAll(/var\(\s*(--brand-[a-zA-Z0-9-]+)\s*(?:,\s*[^)]+)?\)/g);
      for (const match of varRefs) {
        const varName = match[1];
        if (!validBrandVars.has(varName)) {
          warnings.push(
            `[UNDEFINED-CSS-VAR] Chart ${ci + 1}: data-echarts contains unrecognized variable var(${varName}).\n` +
            `  Prefer a known brand token from slide_standardisation.md §4.`
          );
        }
      }
    });
  }

  // ── Check 67: HEADER-BODY-FLEX-MISMATCH ──
  // When a Container Box body uses flex children with flex:N ratios, the header
  // should mirror those ratios so columns align visually.
  document.querySelectorAll('[style]').forEach(el => {
    const s = el.getAttribute('style') || '';
    if (!/border/.test(s)) return;
    const children = Array.from(el.children);
    if (children.length < 2) return;

    // First child = header (has background + padding)
    const header = children[0];
    const headerStyle = header.getAttribute('style') || '';
    if (!(/background/.test(headerStyle) && /padding/.test(headerStyle))) return;

    // Remaining children = body content. Find the first flex-row child
    let bodyFlexRow = null;
    for (let i = 1; i < children.length; i++) {
      const cs = children[i].getAttribute('style') || '';
      if (/display\s*:\s*flex/i.test(cs) && !/flex-direction\s*:\s*column/i.test(cs)) {
        bodyFlexRow = children[i];
        break;
      }
    }
    // Also check if the body content itself has a flex row
    if (!bodyFlexRow) {
      for (let i = 1; i < children.length; i++) {
        const inner = children[i].querySelector('[style*="display: flex"], [style*="display:flex"]');
        if (inner) {
          const is = inner.getAttribute('style') || '';
          if (!/flex-direction\s*:\s*column/i.test(is)) {
            bodyFlexRow = inner;
            break;
          }
        }
      }
    }
    if (!bodyFlexRow) return;

    // Extract flex ratios from body row children
    const bodyChildren = Array.from(bodyFlexRow.children);
    if (bodyChildren.length < 2) return;
    const bodyFlexRatios = bodyChildren.map(c => {
      const cs = c.getAttribute('style') || '';
      const fm = cs.match(/(?:^|;)\s*flex\s*:\s*(\d+)/i);
      return fm ? parseInt(fm[1]) : 0;
    });
    // Only check if body uses flex ratios (at least 2 children with flex:N)
    const flexChildCount = bodyFlexRatios.filter(r => r > 0).length;
    if (flexChildCount < 2) return;

    // Check if header is a flex row with matching ratios
    const headerIsFlex = /display\s*:\s*flex/i.test(headerStyle) && !/flex-direction\s*:\s*column/i.test(headerStyle);
    if (!headerIsFlex) {
      warnings.push(
        `[HEADER-BODY-FLEX-MISMATCH] Container Box header is not a flex row, but body uses ` +
        `flex ratios [${bodyFlexRatios.join(':')}]. Header columns won't align with body columns.\n` +
        `  Fix: make header a flex row with matching flex:N ratios (e.g., same [${bodyFlexRatios.join(':')}] pattern). See §2.`
      );
    }
  });

  // ── Check 68: NON-BRAND-HEX-IN-STYLE ──
  // Translation Override Rule TS-3: All colors must use var(--brand-*) tokens.
  if (Object.keys(brandHexToToken).length > 0) {
    document.querySelectorAll('[style]').forEach(el => {
      // Skip data-echarts elements (handled by check 60)
      if (el.hasAttribute('data-echarts')) return;
      const style = el.getAttribute('style') || '';
      const hexPattern = /#[0-9a-fA-F]{6}\b/g;
      let match;
      while ((match = hexPattern.exec(style)) !== null) {
        const hex = match[0].toUpperCase();
        // Allow common non-brand colors that are always valid
        if (['#FFFFFF', '#000000'].includes(hex)) continue;
        const token = brandHexToToken[hex];
        if (token) {
          warnings.push(
            `[NON-BRAND-HEX] <${el.tagName.toLowerCase()}>: hardcoded hex ${match[0]} in inline style. ` +
            `Use brand token ${token} instead. See §4 Translation Override Rules §17.`
          );
        } else if (!brandHexSet.has(hex)) {
          warnings.push(
            `[NON-BRAND-HEX] <${el.tagName.toLowerCase()}>: non-brand color ${match[0]} in inline style. ` +
            `No brand equivalent found — verify this color is necessary or replace with closest brand token.`
          );
        }
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // LAYOUT-AWARE CHECKS (69-76) — conditional on data-layout attribute
  // ═══════════════════════════════════════════════════════════════════

  // ── Check 69: CHART-METHOD — Chart slides must use ECharts [ERROR] ──
  if (isChartLayout) {
    const chartDivs = document.querySelectorAll('[data-echarts]');
    if (chartDivs.length === 0) {
      errors.push(
        `[CHART-METHOD] ❌ Template expects chart(s) (data-layout="${dataLayout}") but no <div data-echarts> found.\n` +
        `  All charts MUST use ECharts — never build charts with HTML/CSS divs.\n` +
        `  ADD: <div data-echarts='{ ... }' style="width:100%; height:Npt"></div>\n` +
        `  Generation is BLOCKED.`
      );
    }
  }
  // Always run: HTML-div-chart impostor detection (regardless of metadata)
  {
    const contentZoneImpostor = document.querySelector('.content-zone');
    if (contentZoneImpostor) {
      const flexRowsImpostor = contentZoneImpostor.querySelectorAll('[style*="display: flex"], [style*="display:flex"]');
      flexRowsImpostor.forEach(row => {
        const rs = row.getAttribute('style') || '';
        if (/flex-direction\s*:\s*column/i.test(rs)) return;
        const kids = Array.from(row.children);
        if (kids.length < 3) return;
        // Check if 3+ siblings ALL have background-color, height, and short text (bar chart pattern)
        let barLikeCount = 0;
        kids.forEach(kid => {
          const ks = kid.getAttribute('style') || '';
          const hasBg = /background(?:-color)?\s*:/i.test(ks);
          const hasHeight = /height\s*:\s*\d+\s*(%|pt|px)/i.test(ks);
          const shortText = kid.textContent.trim().length < 10;
          if (hasBg && hasHeight && shortText) barLikeCount++;
        });
        if (barLikeCount >= 3) {
          const slideHasEcharts = document.querySelectorAll('[data-echarts]').length > 0;
          if (!slideHasEcharts) {
            errors.push(
              `[CHART-METHOD] ❌ Detected HTML/CSS bar-chart pattern (${barLikeCount} colored divs with height + background).\n` +
              `  Use <div data-echarts='...'> instead — HTML div charts produce broken/invisible charts in PPTX.\n` +
              `  Generation is BLOCKED.`
            );
          }
        }
      });
    }
  }

  // ── Check 70: CHART-INSIGHTS-PANEL — Chart slides must have adjacent text panel [ERROR] ──
  if (dataLayout === 'chart-with-insights') {
    const contentZone70 = document.querySelector('.content-zone');
    if (contentZone70) {
      // Find the first flex-row (display:flex, flex-direction:row) in content-zone
      let foundAdjacentPanel = false;
      const flexRows70 = contentZone70.querySelectorAll('[style*="display: flex"], [style*="display:flex"]');
      for (const row of flexRows70) {
        const rs = row.getAttribute('style') || '';
        if (/flex-direction\s*:\s*column/i.test(rs)) continue;
        const kids = Array.from(row.children);
        if (kids.length >= 2) {
          // Check if at least one child has a chart and at least one other has text content
          const hasChart = kids.some(k => k.querySelector('[data-echarts]') || k.hasAttribute('data-echarts'));
          const hasTextPanel = kids.some(k => {
            if (k.querySelector('[data-echarts]') || k.hasAttribute('data-echarts')) return false;
            const textEls = k.querySelectorAll('p, li, h3, h4, h5');
            return textEls.length >= 1;
          });
          if (hasChart && hasTextPanel) { foundAdjacentPanel = true; break; }
          // Also accept: 2+ panels without chart but text panel exists (chart may be deeper)
          if (kids.length >= 2) { foundAdjacentPanel = true; break; }
        }
      }
      if (!foundAdjacentPanel) {
        errors.push(
          `[CHART-INSIGHTS-PANEL] ❌ chart-with-insights layout requires chart panel + text/insights panel side by side.\n` +
          `  Content-zone should have a flex-row with ≥2 children (chart + callout/takeaway).\n` +
          `  ADD a callout container, takeaway box, or bullet panel adjacent to the chart.`
        );
      }
    }
  }

  // ── Check 71: TABLE-REQUIRED — Comparison/action slides must have table [WARNING] ──
  if (dataLayout === 'comparison-grid' || dataLayout === 'action-table') {
    const tablesCheck71 = document.querySelectorAll('table');
    // Also count grid-like flex rows (3+ uniformly-structured children)
    let gridRows71 = 0;
    const contentZone71 = document.querySelector('.content-zone');
    if (contentZone71) {
      contentZone71.querySelectorAll('[style*="display: flex"], [style*="display:flex"]').forEach(row => {
        const rs = row.getAttribute('style') || '';
        if (/flex-direction\s*:\s*column/i.test(rs)) return;
        if (row.children.length >= 3) gridRows71++;
      });
    }
    if (tablesCheck71.length === 0 && gridRows71 === 0) {
      warnings.push(
        `[TABLE-REQUIRED] Template expects tabular/grid layout (data-layout="${dataLayout}") but no <table> or grid rows found.\n` +
        `  Add a <table> or flex-based grid with 3+ columns for ${dataLayout === 'comparison-grid' ? 'comparison' : 'action items'}.`
      );
    }
  }

  // ── Check 72: SVG-REQUIRED — Diagram/flow slides should have SVG [WARNING] ──
  if (dataLayout === 'diagram' || dataLayout === 'process-flow') {
    const svgs72 = document.querySelectorAll('svg');
    let significantSvgs = 0;
    svgs72.forEach(svg => {
      const style = svg.getAttribute('style') || '';
      const w = parseFloat(svg.getAttribute('width') || (style.match(/width\s*:\s*(\d+)/) || [])[1] || '0');
      const h = parseFloat(svg.getAttribute('height') || (style.match(/height\s*:\s*(\d+)/) || [])[1] || '0');
      if (w * h > 500) significantSvgs++;
    });
    if (significantSvgs === 0) {
      warnings.push(
        `[SVG-REQUIRED] Template expects SVG diagram/connector elements (data-layout="${dataLayout}") but none found.\n` +
        `  Use <svg> for arrows, shapes, flowcharts — not HTML/CSS divs.\n` +
        `  Even simple connectors and step shapes should use SVG for PPTX fidelity.`
      );
    }
  }

  // ── Check 73: FULL-CONTAINER-FILL — Full-container slides should fill content-zone [WARNING] ──
  if (dataLayout === 'full-container') {
    const contentZone73 = document.querySelector('.content-zone');
    if (contentZone73) {
      let hasDominantContainer = false;
      // Check direct children for a bordered container with flex:1 or large height
      const walkChildren = (parent) => {
        for (const child of parent.children) {
          const cs = child.getAttribute('style') || '';
          const hasBorder = /border\s*:/i.test(cs);
          const hasFlex1 = /flex\s*:\s*1/i.test(cs);
          if (hasBorder && hasFlex1) { hasDominantContainer = true; return; }
        }
      };
      walkChildren(contentZone73);
      // Also check one level deeper (flex-column wrapper)
      if (!hasDominantContainer && contentZone73.children.length === 1) {
        walkChildren(contentZone73.children[0]);
      }
      if (!hasDominantContainer) {
        warnings.push(
          `[FULL-CONTAINER-FILL] full-container layout expects a single bordered container filling the content-zone.\n` +
          `  ADD a Container Box with flex:1 and border that spans the full area.`
        );
      }
    }
  }

  // ── Check 74: HERO-COVER-RULES — Cover slides have relaxed fill, large title [WARNING] ──
  if (isHeroCover) {
    const h1s74 = document.querySelectorAll('h1');
    h1s74.forEach(h1 => {
      const style = h1.getAttribute('style') || '';
      const sizeMatch = style.match(/font-size:\s*(\d+(?:\.\d+)?)\s*px/);
      if (sizeMatch && parseFloat(sizeMatch[1]) < 22) {
        warnings.push(
          `[HERO-COVER-RULES] Cover/divider slide has h1 font-size ${sizeMatch[1]}px — typically use large display titles (22-44px).`
        );
      }
    });
  }

  // ── Check 75: PANEL-CONSISTENCY — Side-by-side panels should be structurally consistent [WARNING] ──
  if (dataLayout === 'side-by-side') {
    const contentZone75 = document.querySelector('.content-zone');
    if (contentZone75) {
      const flexRows75 = contentZone75.querySelectorAll('[style*="display: flex"], [style*="display:flex"]');
      for (const row of flexRows75) {
        const rs = row.getAttribute('style') || '';
        if (/flex-direction\s*:\s*column/i.test(rs)) continue;
        const kids = Array.from(row.children).filter(c => {
          const cs = c.getAttribute('style') || '';
          return !/display\s*:\s*none/i.test(cs) && c.tagName === 'DIV';
        });
        if (kids.length < 2 || kids.length > 4) continue;

        // Compare structural properties across siblings
        const borderStates = kids.map(k => /border\s*:/i.test(k.getAttribute('style') || ''));
        const headerStates = kids.map(k => {
          const first = k.firstElementChild;
          if (!first) return false;
          const fs = first.getAttribute('style') || '';
          return /background/.test(fs) && /padding/.test(fs);
        });

        const allBorders = borderStates.every(b => b);
        const noBorders = borderStates.every(b => !b);
        const bordersConsistent = allBorders || noBorders;

        const allHeaders = headerStates.every(h => h);
        const noHeaders = headerStates.every(h => !h);
        const headersConsistent = allHeaders || noHeaders;

        if (!bordersConsistent || !headersConsistent) {
          const issues = [];
          if (!bordersConsistent) issues.push('borders');
          if (!headersConsistent) issues.push('header bars');
          warnings.push(
            `[PANEL-CONSISTENCY] side-by-side panels have inconsistent structure (${issues.join(', ')}).\n` +
            `  All panels should have matching visual treatment — either ALL have borders/headers or NONE do.`
          );
          break; // One warning per slide is enough
        }
      }
    }
  }

  // ── Check 76: META-VALIDATE — Metadata consistency check [WARNING] ──
  if (dataLayout) {
    // hero-cover should also have data-slide-type="structural"
    if (isHeroCover && !isStructural) {
      warnings.push(
        `[META-VALIDATE] hero-cover layout should also have data-slide-type="structural" on <body>.\n` +
        `  ADD: data-slide-type="structural" to skip inapplicable content checks.`
      );
    }
    // Chart layouts + structural is unusual
    if (isChartLayout && isStructural) {
      warnings.push(
        `[META-VALIDATE] Structural slides don't normally have charts — data-layout="${dataLayout}" with data-slide-type="structural" is unusual.\n` +
        `  Verify data-layout is correct, or remove data-slide-type="structural".`
      );
    }
  }

  return { errors, warnings };
}

// Helper: parse a validation message string into structured { tag, message, fix }
function parseMessage(str) {
  const tagMatch = str.match(/^\[([A-Z_-]+)\]/);
  const tag = tagMatch ? tagMatch[1] : 'GENERAL';
  const lines = str.split('\n');
  const message = lines[0].replace(/^\[[A-Z_-]+\]\s*[❌⚠️]*\s*/, '').trim();
  const fix = lines.slice(1).map(l => l.trim()).filter(l => l && !l.startsWith('See ')).join(' ') || null;
  return { tag, message, fix };
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');
  const fileArgs = args.filter(a => a !== '--json');
  let hasErrors = false;

  if (fileArgs.length === 0) {
    console.log('Usage: node scripts/validate_html.cjs [--json] <slide1.html> [slide2.html] ...');
    process.exit(0);
  }

  if (jsonMode) {
    // Structured JSON output to stdout
    const results = [];
    for (const htmlPath of fileArgs) {
      if (!fs.existsSync(htmlPath)) {
        results.push({ file: htmlPath, errors: [{ tag: 'FILE', message: `File not found: ${htmlPath}`, fix: null }], warnings: [], errorCount: 1, warningCount: 0 });
        hasErrors = true;
        continue;
      }
      const { errors, warnings } = validateSlideHTML(htmlPath);
      const parsedErrors = errors.map(e => parseMessage(e));
      const parsedWarnings = warnings.map(w => parseMessage(w));
      results.push({
        file: htmlPath,
        errors: parsedErrors,
        warnings: parsedWarnings,
        errorCount: parsedErrors.length,
        warningCount: parsedWarnings.length
      });
      if (parsedErrors.length > 0) hasErrors = true;
    }
    process.stdout.write(JSON.stringify(results, null, 2));
    process.exit(hasErrors ? 1 : 0);
  }

  // Default: plain text output (unchanged behavior)
  fileArgs.forEach(htmlPath => {
    if (!fs.existsSync(htmlPath)) {
      console.error(`File not found: ${htmlPath}`);
      return;
    }

    console.log(`\nValidating: ${htmlPath}`);
    const { errors, warnings } = validateSlideHTML(htmlPath);

    if (warnings.length > 0) {
      console.log('  WARNINGS:');
      warnings.forEach(w => console.log(`   - ${w}`));
    }

    if (errors.length > 0) {
      console.log('  ERRORS:');
      errors.forEach(e => console.log(`   - ${e}`));
      hasErrors = true;
    }

    if (errors.length === 0 && warnings.length === 0) {
      console.log('  PASS');
    }
  });

  process.exit(hasErrors ? 1 : 0);
}

module.exports = { validateSlideHTML };
