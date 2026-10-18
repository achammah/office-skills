/**
 * html2pptx - Convert HTML slide to pptxgenjs slide with positioned elements (v2)
 *
 * v2 ENHANCEMENT: Automatically injects brand CSS variables and optional helper
 * classes at runtime, enabling lightweight HTML authoring without heavy inline CSS.
 *
 * USAGE:
 *   import pptxgen from 'pptxgenjs';
 *   import html2pptx from './html2pptx.mjs';
 *
 *   const pptx = new pptxgen();
 *   pptx.layout = 'LAYOUT_16x9';  // Must match HTML body dimensions
 *
 *   const { slide, placeholders } = await html2pptx('slide.html', pptx);
 *   slide.addChart(pptx.charts.LINE, data, placeholders[0]);
 *
 *   await pptx.writeFile('output.pptx');
 *
 * FEATURES:
 *   - Converts HTML to PowerPoint with accurate positioning
 *   - Supports text, images, shapes, and bullet lists
 *   - Extracts placeholder elements (class="placeholder") with positions
 *   - Handles CSS gradients, borders, and margins
 *   - [v2] Injects brand CSS variables automatically
 *   - [v2] Optional helper classes (.brand-slide, .slide-title, etc.)
 *
 * ENVIRONMENT:
 *   - PPTX_BRAND: Brand config to use (default: 'mckinsey')
 *   - PPTX_INJECT_HELPERS: Set to '0' or 'false' to disable helper classes
 *
 * VALIDATION:
 *   - Uses body width/height from HTML for viewport sizing
 *   - Throws error if HTML dimensions don't match presentation layout
 *   - Throws error if content overflows body (with overflow details)
 *
 * RETURNS:
 *   { slide, placeholders } where placeholders is an array of { id, x, y, w, h }
 */

import { chromium } from 'playwright';
import { execSync, spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import JSZip from 'jszip';
import { fileURLToPath } from 'url';

// v2: Import branding for CSS injection
import { loadBranding, generateInjectableCSS, getBranding, getChartColors, getColor } from '../branding/branding.mjs';

// v6: Import native chart translator
import { translateChart, createAnnotationOverlayConfig } from './echarts-to-pptxgen.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PT_PER_PX = 0.75;
const PX_PER_IN = 96;
const EMU_PER_IN = 914400;

// v2: Load brand configuration
const brandId = process.env.PPTX_BRAND || 'mckinsey';
loadBranding(brandId);

// v2: Generate injectable CSS (with or without helpers)
const includeHelpers = process.env.PPTX_INJECT_HELPERS !== '0' &&
                       process.env.PPTX_INJECT_HELPERS !== 'false';
const brandCSS = generateInjectableCSS({ includeHelpers });

// v3: Strict mode — convert warnings to blocking errors
const STRICT_MODE = process.env.PPTX_STRICT === 'true';

// Helper: Render ECharts config to SVG using render_echarts.mjs
// Returns { svg, logs } — logs is the stderr output from the renderer (debug info)
function renderEChartsToSVG(config, width, height) {
  const configPath = path.join(process.env.TMPDIR || '/tmp', `echarts_${Date.now()}_${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(configPath, JSON.stringify(config));

  try {
    const scriptPath = path.join(__dirname, 'render_echarts.mjs');
    const proc = spawnSync('node', [scriptPath, configPath, String(width), String(height)], {
      encoding: 'utf8',
      timeout: 30000
    });

    const logs = (proc.stderr || '').trim();
    const stdout = (proc.stdout || '').trim();

    if (proc.status !== 0) {
      throw new Error(`render_echarts.mjs exited with code ${proc.status}\n  stderr: ${logs}\n  stdout: ${stdout}`);
    }

    // Parse chart metadata from structured stderr output (grid-auto compensation info)
    let chartMeta = null;
    for (const line of logs.split('\n')) {
      if (line.includes('__chartMeta')) {
        try { chartMeta = JSON.parse(line); } catch (e) {}
      }
    }

    // Check if render_echarts.mjs returned a structured error (JSON object with "error" key)
    if (stdout.startsWith('{') && stdout.includes('"error"')) {
      try {
        const errorObj = JSON.parse(stdout);
        if (errorObj.error) {
          throw new Error(`${errorObj.error}\n  Hint: ${errorObj.hint || 'Check your ECharts configuration'}`);
        }
      } catch (parseErr) {
        // If it's not valid JSON, it might be an SVG starting with a quirky character - let it through
        if (parseErr instanceof SyntaxError) {
          return { svg: stdout, logs, chartMeta };
        }
        throw parseErr;
      }
    }

    return { svg: stdout, logs, chartMeta };
  } finally {
    try { fs.unlinkSync(configPath); } catch (e) {}
  }
}

// v5.1: Parse annotation texts from ECharts SVG for native PPTX text extraction.
// ONLY extracts text elements that belong to annotations (pill labels, callout text)
// by matching their transform attribute to annotation shape transforms.
// Shapes, lines, axis labels, data labels all stay in the rasterized PNG.
// Returns { groups: [...], annotationTransforms: Set } where each group has texts + shapeBBox
function parseChartAnnotations(svgString) {
  // Step 1: Find annotation shapes — paths WITHOUT ecmeta_, WITH fill, WITH transform, NO dasharray
  // These are pill backgrounds and callout box backgrounds
  const annotationTransforms = new Set();
  const shapesByTransform = new Map();

  // Step 1a: Find annotation <path> shapes (pill backgrounds via SVG path d=)
  const pathRegex = /<path [^>]*>(?:<\/path>)?/g;
  let pm;
  while ((pm = pathRegex.exec(svgString)) !== null) {
    const tag = pm[0];
    if (tag.includes('ecmeta_')) continue;           // Skip data paths (bars, arrows)
    if (!tag.includes('transform=')) continue;        // Skip clipPath paths (no transform)
    if (tag.includes('stroke-dasharray')) continue;   // Skip dashed lines

    const fillM = tag.match(/fill="([^"]+)"/);
    if (!fillM || fillM[1] === 'none') continue;

    const dM = tag.match(/\bd="([^"]+)"/);
    if (!dM) continue;

    const trM = tag.match(/transform="translate\(([^)]+)\)"/);
    if (!trM) continue;

    const bbox = getPathBBox(dM[1]);
    if (!bbox || bbox.w === 0 || bbox.h === 0) continue;

    const trParts = trM[1].trim().split(/[\s,]+/).map(Number);
    if (trParts.length < 2) continue;
    const transformX = trParts[0];
    const transformY = trParts[1] || 0;

    const transformKey = trM[1].trim();
    annotationTransforms.add(transformKey);
    shapesByTransform.set(transformKey, {
      x: transformX + bbox.x,
      y: transformY + bbox.y,
      w: bbox.w,
      h: bbox.h,
      transformX, transformY
    });
  }

  // Step 1b: Find annotation <rect> shapes (markLine label backgrounds, rounded-rect pills)
  // ECharts renders backgroundColor labels as <rect> with optional rx/ry for border-radius
  const rectRegex = /<rect [^>]*(?:\/>|>(?:<\/rect>)?)/g;
  let rm;
  while ((rm = rectRegex.exec(svgString)) !== null) {
    const tag = rm[0];
    if (tag.includes('ecmeta_')) continue;
    if (!tag.includes('transform=')) continue;

    const fillM = tag.match(/fill="([^"]+)"/);
    if (!fillM || fillM[1] === 'none' || fillM[1] === 'transparent') continue;

    const trM = tag.match(/transform="translate\(([^)]+)\)"/);
    if (!trM) continue;

    const xM = tag.match(/\bx="(-?[\d.]+)"/);
    const yM = tag.match(/\by="(-?[\d.]+)"/);
    const wM = tag.match(/\bwidth="([\d.]+)"/);
    const hM = tag.match(/\bheight="([\d.]+)"/);
    if (!wM || !hM) continue;

    const rx = parseFloat(xM?.[1] || 0);
    const ry = parseFloat(yM?.[1] || 0);
    const rw = parseFloat(wM[1]);
    const rh = parseFloat(hM[1]);
    if (rw === 0 || rh === 0) continue;

    const trParts = trM[1].trim().split(/[\s,]+/).map(Number);
    if (trParts.length < 2) continue;
    const transformX = trParts[0];
    const transformY = trParts[1] || 0;

    const transformKey = trM[1].trim();
    annotationTransforms.add(transformKey);
    if (!shapesByTransform.has(transformKey)) {
      shapesByTransform.set(transformKey, {
        x: transformX + rx,
        y: transformY + ry,
        w: rw,
        h: rh,
        transformX, transformY
      });
    }
  }

  if (annotationTransforms.size === 0) return { groups: [], annotationTransforms };

  // Step 2: Find text elements whose transform matches an annotation shape
  const textsByTransform = new Map();
  const textRegex = /<text[^>]*>((?:(?!<\/text>).)*)<\/text>/gs;
  let tm;
  while ((tm = textRegex.exec(svgString)) !== null) {
    const tag = tm[0];
    const inner = tm[1];

    const trM = tag.match(/transform="translate\(([^)]+)\)"/);
    if (!trM) continue;
    const transformKey = trM[1].trim();
    if (!annotationTransforms.has(transformKey)) continue; // Not an annotation text

    const fsM = tag.match(/font-size:\s*([\d.]+)px/);
    const fontSize = fsM ? parseFloat(fsM[1]) : 10;
    const fontWeight = /font-weight:\s*bold/.test(tag) ? 'bold' : 'normal';
    const fillM = tag.match(/fill="([^"]+)"/);
    const fill = fillM ? fillM[1] : '#333333';
    const taM = tag.match(/text-anchor="([^"]+)"/);
    const textAnchor = taM ? taM[1] : 'start';

    const yM = tag.match(/\by="(-?[\d.]+)"/);
    const yOff = yM ? parseFloat(yM[1]) : 0;

    const textContent = inner.replace(/<[^>]+>/g, '').trim();
    if (!textContent) continue;

    if (!textsByTransform.has(transformKey)) textsByTransform.set(transformKey, []);
    textsByTransform.get(transformKey).push({
      text: textContent, yOff, fontSize, fontWeight, fill, textAnchor
    });
  }

  // Step 3: Build annotation groups — one per transform (one text box per annotation)
  const groups = [];
  for (const [transformKey, texts] of textsByTransform) {
    const shapeBBox = shapesByTransform.get(transformKey);
    if (!shapeBBox) continue;

    // Sort texts by y offset to maintain reading order
    texts.sort((a, b) => a.yOff - b.yOff);

    groups.push({ texts, shapeBBox, transformKey });
  }

  return { groups, annotationTransforms };
}

// Convert SVG fill values (named colors, rgb(), hex) to 6-digit hex for PptxGenJS.
function svgFillToHex(fill) {
  if (!fill) return '333333';
  let s = fill.trim();

  // Named SVG/CSS colors
  const NAMED = {
    white: 'FFFFFF', black: '000000', red: 'FF0000', green: '008000', blue: '0000FF',
    yellow: 'FFFF00', orange: 'FFA500', gray: '808080', grey: '808080', navy: '000080',
    transparent: 'FFFFFF', silver: 'C0C0C0', purple: '800080', teal: '008080',
    maroon: '800000', aqua: '00FFFF', fuchsia: 'FF00FF', lime: '00FF00', olive: '808000',
  };
  if (NAMED[s.toLowerCase()]) return NAMED[s.toLowerCase()];

  // rgb(r,g,b) or rgba(r,g,b,a)
  const rgbM = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbM) {
    const hex = (c) => Math.min(255, parseInt(c)).toString(16).padStart(2, '0');
    return (hex(rgbM[1]) + hex(rgbM[2]) + hex(rgbM[3])).toUpperCase();
  }

  // Strip '#' and expand 3-digit hex
  s = s.replace('#', '');
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  if (/^[0-9a-fA-F]{6}$/.test(s)) return s.toUpperCase();

  return '333333'; // fallback
}

// v7: Parse ALL <text> elements from annotation overlay SVG as data label candidates.
// Unlike parseChartAnnotations (which only extracts texts with matching pill/callout shapes),
// this extracts every <text> element — data labels, total labels, and any other text.
// Returns array of { text, x, y, fontSize, fontWeight, fill }.
function parseOverlayDataLabels(svgString) {
  const labels = [];
  const textRegex = /<text[^>]*>((?:(?!<\/text>).)*)<\/text>/gs;
  let m;
  while ((m = textRegex.exec(svgString)) !== null) {
    const tag = m[0];
    const inner = m[1];
    const textContent = inner.replace(/<[^>]+>/g, '').trim();
    if (!textContent) continue;

    // Extract position from transform="translate(x,y)" or translate(x y)
    let x = 0, y = 0;
    const trM = tag.match(/transform="translate\(([^)]+)\)"/);
    if (trM) {
      const parts = trM[1].trim().split(/[\s,]+/).map(Number);
      x = parts[0] || 0;
      y = parts[1] || 0;
    }

    // Add explicit x/y attributes if present (they offset from the transform)
    const xAttr = tag.match(/\bx="(-?[\d.]+)"/);
    const yAttr = tag.match(/\by="(-?[\d.]+)"/);
    if (xAttr) x += parseFloat(xAttr[1]);
    if (yAttr) y += parseFloat(yAttr[1]);

    // Extract styling
    const fsM = tag.match(/font-size:\s*([\d.]+)px/) || tag.match(/font-size="([\d.]+)"/);
    const fontSize = fsM ? parseFloat(fsM[1]) : 12;
    const fontWeight = /font-weight:\s*bold/.test(tag) || /font-weight="bold"/.test(tag) ? 'bold' : 'normal';
    const fontStyle = /font-style:\s*italic/.test(tag) || /font-style="italic"/.test(tag) ? 'italic' : 'normal';
    const fillM = tag.match(/fill="([^"]+)"/);
    const fill = fillM ? fillM[1] : '#333333';
    const taM = tag.match(/text-anchor="([^"]+)"/);
    const textAnchor = taM ? taM[1] : 'start';

    labels.push({ text: textContent, x, y, fontSize, fontWeight, fontStyle, fill, textAnchor });
  }
  return labels;
}

// v7: Strip ALL <text> elements from SVG (for PNG that should only contain shapes/lines).
function stripAllTextsFromSVG(svgString) {
  return svgString.replace(/<text[^>]*>(?:(?!<\/text>).)*<\/text>/gs, '').replace(/\n{3,}/g, '\n');
}

// v7: Check if an SVG contains any visible non-text graphical elements.
// Returns true if there are paths, rects, circles, lines, polygons, or images
// (i.e., something worth rasterizing to PNG beyond just text).
function svgHasNonTextGraphics(svgString) {
  // Strip <defs>, <clipPath>, <style> sections — these are definitions, not visible
  const stripped = svgString
    .replace(/<defs>[\s\S]*?<\/defs>/g, '')
    .replace(/<clipPath[\s\S]*?<\/clipPath>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '');
  // Check for visible graphical elements
  return /<(path|rect|circle|ellipse|line|polyline|polygon|image)\s/i.test(stripped);
}

// v5.1: Arc-aware SVG path bounding box calculator
// Handles M, L, H, V, A commands. Returns { x, y, w, h } relative to path origin.
function getPathBBox(d) {
  // Case-sensitive regex — lowercase = relative, uppercase = absolute
  const commands = d.match(/[MLHVCSQTAZmlhvcsqtaz][^MLHVCSQTAZmlhvcsqtaz]*/g);
  if (!commands) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let cx = 0, cy = 0;

  const update = () => {
    minX = Math.min(minX, cx); maxX = Math.max(maxX, cx);
    minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
  };

  for (const cmd of commands) {
    const type = cmd[0];
    const nums = cmd.slice(1).trim().match(/-?[\d.]+/g);
    const vals = nums ? nums.map(Number) : [];

    switch (type) {
      case 'M': case 'L':
        for (let i = 0; i < vals.length - 1; i += 2) {
          cx = vals[i]; cy = vals[i + 1]; update();
        }
        break;
      case 'm': case 'l':
        for (let i = 0; i < vals.length - 1; i += 2) {
          cx += vals[i]; cy += vals[i + 1]; update();
        }
        break;
      case 'H': cx = vals[0]; update(); break;
      case 'h': cx += vals[0]; update(); break;
      case 'V': cy = vals[0]; update(); break;
      case 'v': cy += vals[0]; update(); break;
      case 'A':
        for (let i = 0; i < vals.length - 1; i += 7) {
          cx = vals[i + 5]; cy = vals[i + 6]; update();
        }
        break;
      case 'a':
        for (let i = 0; i < vals.length - 1; i += 7) {
          cx += vals[i + 5]; cy += vals[i + 6]; update();
        }
        break;
      case 'Z': case 'z': break;
      default:
        if (vals.length >= 2) {
          const isRel = type === type.toLowerCase();
          if (isRel) { cx += vals[vals.length - 2]; cy += vals[vals.length - 1]; }
          else { cx = vals[vals.length - 2]; cy = vals[vals.length - 1]; }
          update();
        }
        break;
    }
  }

  if (minX === Infinity) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// v5.1: Strip ONLY annotation text elements from SVG for data-only chart PNG.
// Shapes, lines, axis labels, data labels all remain — only matched annotation texts removed.
function stripAnnotationTextsFromSVG(svgString, annotationTransforms) {
  if (!annotationTransforms || annotationTransforms.size === 0) return svgString;

  return svgString.replace(/<text[^>]*>(?:(?!<\/text>).)*<\/text>/gs, (match) => {
    const trM = match.match(/transform="translate\(([^)]+)\)"/);
    if (!trM) return match;
    if (annotationTransforms.has(trM[1].trim())) return ''; // Strip annotation text
    return match; // Keep all other text (axis labels, data labels)
  }).replace(/\n{3,}/g, '\n');
}

// v5.1: Add annotation texts as native PPTX text boxes (crisp, selectable, editable).
// Only text is extracted — shapes, lines, axis labels, data labels stay rasterized in PNG.
// Each annotation (pill, callout) becomes one text box positioned over the rasterized shape.
function addChartAnnotations(chartPNGs, slideData, targetSlide, pres) {
  for (const chart of chartPNGs) {
    if (!chart.annotations || chart.annotations.length === 0) continue;

    // Find this chart's position on the slide by matching PNG path
    const chartImage = slideData.elements.find(el =>
      el.type === 'image' && el.src && el.src.includes(path.basename(chart.pngPath))
    );
    if (!chartImage) {
      console.warn(`  [chart-annotations] Could not find chart #${chart.index} image on slide`);
      continue;
    }

    const { x: cx, y: cy, w: cw, h: ch } = chartImage.position; // inches
    const svgW = chart.width;  // pixels
    const svgH = chart.height; // pixels

    // Coordinate mapping: SVG px → PPTX inches
    const mapX = (svgX) => cx + (svgX / svgW) * cw;
    const mapY = (svgY) => cy + (svgY / svgH) * ch;
    const mapW = (sw) => (sw / svgW) * cw;
    const mapH = (sh) => (sh / svgH) * ch;

    const brandFont = (getBranding()?.typography?.families?.data || 'Arial').split(',')[0].trim();
    let textCount = 0;

    for (const group of chart.annotations) {
      const { texts, shapeBBox } = group;
      if (texts.length === 0) continue;

      // Position text box at the shape's location (shape stays in rasterized PNG)
      const boxX = mapX(shapeBBox.x);
      const boxY = mapY(shapeBBox.y);
      const boxW = mapW(shapeBBox.w);
      const boxH = mapH(shapeBBox.h);

      const t = texts[0]; // Use first text's style for the box
      const fontSize = t.fontSize * PT_PER_PX; // px → pt

      if (texts.length === 1) {
        // Single-line annotation (pill label like "-40%")
        targetSlide.addText(t.text, {
          x: boxX, y: boxY, w: boxW, h: boxH,
          fontSize, fontFace: brandFont,
          color: (t.fill || '000000').replace('#', ''),
          bold: t.fontWeight === 'bold',
          valign: 'middle', align: 'center',
          margin: 0, inset: 0
        });
      } else {
        // Multi-line annotation (callout box)
        const combinedText = texts.map(line => line.text).join('\n');
        targetSlide.addText(combinedText, {
          x: boxX, y: boxY, w: boxW, h: boxH,
          fontSize, fontFace: brandFont,
          color: (t.fill || '000000').replace('#', ''),
          bold: t.fontWeight === 'bold',
          valign: 'top', align: 'left',
          margin: [0.05, 0.06, 0.05, 0.06], // ~5px top/bottom, ~6px left/right
          lineSpacingMultiple: 1.0,
          inset: 0
        });
      }
      textCount++;
    }

    if (textCount > 0) {
      console.log(`  [chart-annotations] Chart #${chart.index}: added ${textCount} native text box(es)`);
    }
  }
}

// Apply safe chart defaults to prevent label cropping
function applySafeChartDefaults(config) {
  const isHorizontalBar = config.yAxis?.type === 'category' ||
    (Array.isArray(config.yAxis) && config.yAxis.some(y => y.type === 'category'));

  if (!config.grid) config.grid = {};

  if (isHorizontalBar) {
    config.grid.left = Math.max(config.grid.left || 0, 100);
    config.grid.right = Math.max(config.grid.right || 0, 60);
  } else {
    config.grid.left = Math.max(config.grid.left || 0, 50);
    config.grid.right = Math.max(config.grid.right || 0, 30);
  }
  config.grid.top = Math.max(config.grid.top || 0, 30);
  config.grid.bottom = Math.max(config.grid.bottom || 0, 40);
  config.grid.containLabel = false;

  // Enforce minimum font sizes — inside labels use min 7, others use min 10
  const MIN_INSIDE = 7;
  const MIN_DEFAULT = 10;
  if (config.series) {
    config.series.forEach(series => {
      const isInsideLabel = series.label && series.label.position === 'inside';
      const seriesMin = isInsideLabel ? MIN_INSIDE : MIN_DEFAULT;
      if (series.label) {
        series.label.fontSize = Math.max(series.label.fontSize || MIN_DEFAULT, seriesMin);
      }
      if (Array.isArray(series.data)) {
        series.data.forEach(item => {
          if (typeof item === 'object' && item.label) {
            const itemIsInside = (item.label.position === 'inside') || isInsideLabel;
            const itemMin = itemIsInside ? MIN_INSIDE : MIN_DEFAULT;
            item.label.fontSize = Math.max(item.label.fontSize || MIN_DEFAULT, itemMin);
          }
        });
      }
    });
  }

  return config;
}

function validateChartConfig(config, chartIndex) {
  const warnings = [];
  const isHorizontalBar = config.yAxis?.type === 'category';

  if (isHorizontalBar) {
    if ((config.grid?.left || 0) < 100) {
      warnings.push(`Chart ${chartIndex}: grid.left=${config.grid?.left || 'unset'} too small for horizontal bars (need >=100)`);
    }
    if ((config.grid?.right || 0) < 60) {
      warnings.push(`Chart ${chartIndex}: grid.right=${config.grid?.right || 'unset'} too small for labels (need >=60)`);
    }
  }

  if (config.series?.some(s => s.label && !s.label.fontSize)) {
    warnings.push(`Chart ${chartIndex}: label.fontSize not set, will default to 10`);
  }

  if (warnings.length > 0) {
    warnings.forEach(w => console.warn(`  [chart-validate] ${w}`));
    if (STRICT_MODE) {
      throw new Error(`[STRICT] Chart validation failed:\n${warnings.join('\n')}`);
    }
  }

  return warnings;
}

// Helper: Get body dimensions and check for overflow
async function getBodyDimensions(page) {
  const bodyDimensions = await page.evaluate(() => {
    const body = document.body;
    const style = window.getComputedStyle(body);

    return {
      width: parseFloat(style.width),
      height: parseFloat(style.height),
      scrollWidth: body.scrollWidth,
      scrollHeight: body.scrollHeight
    };
  });

  const errors = [];
  const widthOverflowPx = Math.max(0, bodyDimensions.scrollWidth - bodyDimensions.width - 1);
  const heightOverflowPx = Math.max(0, bodyDimensions.scrollHeight - bodyDimensions.height - 1);

  const widthOverflowPt = widthOverflowPx * PT_PER_PX;
  const heightOverflowPt = heightOverflowPx * PT_PER_PX;

  if (widthOverflowPt > 0 || heightOverflowPt > 0) {
    const directions = [];
    if (widthOverflowPt > 0) directions.push(`${widthOverflowPt.toFixed(1)}pt horizontally`);
    if (heightOverflowPt > 0) directions.push(`${heightOverflowPt.toFixed(1)}pt vertically`);
    const reminder = heightOverflowPt > 0 ? ' (Remember: leave 0.5" margin at bottom of slide)' : '';
    // Width overflow at body level = blocking error (hard layout failure).
    // Height overflow at body level = info only (content-zone check is the
    // authoritative boundary; body edge is too late to be useful).
    if (widthOverflowPt > 0) {
      errors.push(`HTML content overflows body by ${directions.join(' and ')}${reminder}`);
    } else {
      console.log(`  [body-overflow] ${directions.join(' and ')}${reminder}`);
    }
  }

  return { ...bodyDimensions, errors };
}

// v3.7: Deep overlap detection — ONLY flags unintentional static-flow overlaps
// Excludes 11 intentional overlap patterns (annotations, positioned labels, badges, etc.)
async function detectOverlappingElements(page, slideId) {
  const overlaps = await page.evaluate(() => {
    const results = [];

    function checkStaticSiblings(parent) {
      const children = Array.from(parent.children).filter(el => {
        const s = window.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') return false;
        if (el.getBoundingClientRect().width < 5) return false;

        // EXCLUDE intentional positioning patterns:
        if (s.position === 'fixed') return false;
        if (s.position === 'absolute') {
          // Only exclude absolute elements that are intentional overlays:
          if (parseInt(s.zIndex) > 0) return false;          // explicitly layered
          if (parseFloat(s.opacity) < 1) return false;       // transparent overlay
          if (el.closest('[data-echarts]')) return false;     // ECharts labels
          const rect = el.getBoundingClientRect();
          if (rect.width * rect.height < 3600) return false; // small markers (<60px²)
          // Include — will check for overlap with other absolute siblings below
        }
        if (parseInt(s.zIndex) > 0) return false;
        if (parseFloat(s.opacity) < 1) return false;
        // Only exclude SVGs inside chart containers — standalone SVGs must still be checked for text overlap
        if ((el.tagName === 'SVG' || el.closest('svg')) && el.closest('[data-echarts], [class*="chart"]')) return false;
        if (s.display === 'inline-block') return false;
        if (el.getBoundingClientRect().width < 25) return false;

        // Exclude if parent uses position: relative with absolute children
        const parentStyle = window.getComputedStyle(parent);
        if (parentStyle.position === 'relative') {
          const hasAbsChildren = Array.from(parent.children).some(c =>
            window.getComputedStyle(c).position === 'absolute'
          );
          if (hasAbsChildren) return false;
        }

        return true;
      });

      // Only check pairs of static siblings
      const rects = children.map(el => ({
        tag: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''),
        rect: el.getBoundingClientRect(),
        hasText: el.textContent.trim().length > 5
      }));

      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          if (!rects[i].hasText && !rects[j].hasText) continue;

          const a = rects[i].rect, b = rects[j].rect;
          const overlapX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
          const overlapY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          const overlapArea = overlapX * overlapY;
          if (overlapArea > 200) {
            results.push(`"${rects[i].tag}" and "${rects[j].tag}" overlap by ${Math.round(overlapArea)}px² (static siblings)`);
          }
        }
      }

      // Recurse ONE level into flex containers
      children.forEach(child => {
        const cs = window.getComputedStyle(child);
        if ((cs.display === 'flex' || cs.display === 'inline-flex') && child.children.length >= 2) {
          checkStaticSiblings(child);
        }
      });

      // v4.0: Check absolute-positioned siblings for overlap
      const absChildren = Array.from(parent.children).filter(el => {
        const s = window.getComputedStyle(el);
        if (s.position !== 'absolute') return false;
        if (s.display === 'none' || s.visibility === 'hidden') return false;
        if (parseInt(s.zIndex) > 0) return false;
        if (parseFloat(s.opacity) < 1) return false;
        if (el.closest('[data-echarts]')) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width * rect.height < 3600) return false;
        return el.textContent.trim().length > 5; // only check text-bearing elements
      });

      if (absChildren.length >= 2) {
        const absRects = absChildren.map(el => ({
          tag: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''),
          rect: el.getBoundingClientRect()
        }));
        for (let i = 0; i < absRects.length; i++) {
          for (let j = i + 1; j < absRects.length; j++) {
            const a = absRects[i].rect, b = absRects[j].rect;
            const overlapX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
            const overlapY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
            const overlapArea = overlapX * overlapY;
            if (overlapArea > 200) {
              results.push(`"${absRects[i].tag}" and "${absRects[j].tag}" overlap by ${Math.round(overlapArea)}px² (absolute-positioned siblings)`);
            }
          }
        }
      }
    }

    const contentZone = document.querySelector('.content-zone');
    if (contentZone) checkStaticSiblings(contentZone);
    return results;
  });

  if (overlaps.length > 0) {
    console.warn(`\n${'═'.repeat(60)}`);
    console.warn(`  ❌ OVERLAP ERROR — GENERATION BLOCKED`);
    console.warn(`  ${overlaps.length} element(s) overlap in normal document flow.`);
    overlaps.forEach(o => console.warn(`    → ${o}`));
    console.warn(`\n  ACTION REQUIRED — do ALL of the following in your HTML:`);
    console.warn(`    1. Add gap: 8pt to EVERY flex container that has 2+ children`);
    console.warn(`    2. If an SVG sits next to text, set SVG width ≤ 50% (not 60%+)`);
    console.warn(`    3. Check that no element's width exceeds its parent column`);
    console.warn(`    4. Re-run validation after fixing — generation will not proceed until 0 overlaps`);
    console.warn(`${'═'.repeat(60)}\n`);
    throw new Error(`[BLOCKING] ${slideId}: ${overlaps.length} static-flow overlap(s) detected. Add gap:8pt to flex containers and constrain element widths. See console for exact elements.`);
  }

  return overlaps;
}

// Content-zone overflow check — BLOCKING ERROR
// The .content-zone boundary in HTML maps 1:1 to the PPTX usable area
// (via getBoundingClientRect() → pxToInch()). Content that overflows
// .content-zone WILL overflow in the final PPTX.
// Tolerances: 4px (~3pt) height, 2px (~1.5pt) width — accounts for
// Chromium vs PowerPoint font rendering differences.
async function checkContentOverflow(page, slideId) {
  const overflow = await page.evaluate(() => {
    const contentZone = document.querySelector('.content-zone');
    if (!contentZone) return null;
    const scrollH = contentZone.scrollHeight;
    const clientH = contentZone.clientHeight;
    const scrollW = contentZone.scrollWidth;
    const clientW = contentZone.clientWidth;
    const heightOverflow = scrollH > clientH + 4 ? scrollH - clientH : 0;
    const widthOverflow = scrollW > clientW + 2 ? scrollW - clientW : 0;
    if (heightOverflow > 0 || widthOverflow > 0) {
      return { scrollH, clientH, scrollW, clientW, heightOverflow, widthOverflow };
    }
    return null;
  });

  const errors = [];
  if (overflow) {
    if (overflow.widthOverflow > 0) {
      const pt = (overflow.widthOverflow * PT_PER_PX).toFixed(1);
      let msg = `${slideId}: Content zone overflows by ${pt}pt horizontally (${overflow.scrollW}px content vs ${overflow.clientW}px available). Reduce content width or check padding.`;
      // v4.6.3: Check if charts with data-bound overlays are present
      const hasChartOverlays = await page.evaluate(() =>
        !!document.querySelector('[data-echarts-png]') && !!document.querySelector('[style*="var(--gfx-"]'));
      if (hasChartOverlays) {
        msg += `\n  TIP: Hybrid callout overlay may extend past chart edge.` +
          ` Use $callouts with adequate grid margins (grid.left/grid.right ≥170px) instead.` +
          ` For markLine pills: check yAxis range and coordinates.`;
      }
      errors.push(msg);
    }
    if (overflow.heightOverflow > 0) {
      const pt = (overflow.heightOverflow * PT_PER_PX).toFixed(1);
      errors.push(`${slideId}: Content zone overflows by ${pt}pt vertically (${overflow.scrollH}px content vs ${overflow.clientH}px available). Reduce content, shrink fonts, or tighten spacing.`);
    }
  }
  return errors;
}

// v3.7: Detect text overflow in individual flex cells (WARNING)
async function detectFlexCellOverflow(page, slideId) {
  const overflows = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('*').forEach(el => {
      const s = window.getComputedStyle(el);
      if (s.display !== 'flex' && s.display !== 'inline-flex') return;

      Array.from(el.children).forEach(child => {
        if (child.textContent.trim().length < 20) return;
        const cs = window.getComputedStyle(child);
        if (cs.textOverflow === 'ellipsis') return;

        const scrollH = child.scrollHeight;
        const clientH = child.clientHeight;
        const overflow = scrollH - clientH;
        if (overflow > 8) {
          const tag = child.tagName.toLowerCase() + (child.className ? '.' + String(child.className).split(' ')[0] : '');
          const text = child.textContent.trim().substring(0, 40);
          results.push(`${tag} ("${text}...") overflows by ${overflow}px (${scrollH}px content in ${clientH}px cell)`);
        }
      });
    });
    return results;
  });

  if (overflows.length > 0) {
    console.warn(`\n${'═'.repeat(60)}`);
    console.warn(`  ⚠️  TEXT CLIPPING — ${overflows.length} flex cell(s) will be CROPPED in the PPTX`);
    overflows.forEach(o => console.warn(`    → ${o}`));
    console.warn(`\n  ACTION REQUIRED — fix EACH clipped cell in your HTML:`);
    console.warn(`    1. REDUCE font-size by 1-2px on the text inside the overflowing cell`);
    console.warn(`    2. If still overflowing, SHORTEN the text (abbreviate, cut words)`);
    console.warn(`    3. NEVER add overflow:hidden — that hides the problem, not fixes it`);
    console.warn(`    4. NEVER set a fixed height on text containers — use flex:1 instead`);
    console.warn(`  The PPTX will CROP this text. Fix it now or accept truncated output.`);
    console.warn(`${'═'.repeat(60)}\n`);
  }
  return overflows;
}

// v3.7: Measure annotation box positions relative to chart area (WARNING)
async function measureAnnotationPositions(page, slideId) {
  const measurements = await page.evaluate(() => {
    const results = [];
    const annotations = document.querySelectorAll('[style*="position: absolute"], [style*="position:absolute"], [data-annotation]');
    if (annotations.length === 0) return results;

    const chartAreas = document.querySelectorAll('svg, [data-echarts], [style*="height"][style*="background"]');

    annotations.forEach(ann => {
      const annRect = ann.getBoundingClientRect();
      const annText = ann.textContent.trim().substring(0, 30);
      if (!annText || annRect.width < 10) return;

      chartAreas.forEach(chart => {
        const chartRect = chart.getBoundingClientRect();
        const horizontalOverlap = Math.max(0, Math.min(annRect.right, chartRect.right) - Math.max(annRect.left, chartRect.left));
        const verticalOverlap = Math.max(0, Math.min(annRect.bottom, chartRect.bottom) - Math.max(annRect.top, chartRect.top));

        if (horizontalOverlap > 20 && verticalOverlap === 0) {
          const gap = annRect.top > chartRect.bottom ? annRect.top - chartRect.bottom : chartRect.top - annRect.bottom;
          results.push(`MOVE annotation "${annText}" — it is ${Math.round(gap)}px BELOW the chart but should OVERLAP the bars. ` +
            `Set position:absolute on the annotation and place it INSIDE the chart container div (not after it). ` +
            `Use top/left to position it over the specific bars it labels.`);
        }
      });
    });
    return results;
  });

  if (measurements.length > 0) {
    console.warn(`\n${'═'.repeat(60)}`);
    console.warn(`  ⚠️  ANNOTATION PLACEMENT — ${measurements.length} annotation(s) are DETACHED from their chart`);
    measurements.forEach(m => console.warn(`    → ${m}`));
    console.warn(`\n  ACTION REQUIRED:`);
    console.warn(`    1. Move each annotation div INSIDE the chart's container div`);
    console.warn(`    2. Use position:absolute with top/left to place it OVER the bars it labels`);
    console.warn(`    3. The annotation box must visually OVERLAP the chart bars, not sit below them`);
    console.warn(`${'═'.repeat(60)}\n`);
  }
  return measurements;
}

// Helper: Validate dimensions match presentation layout
function validateDimensions(bodyDimensions, pres) {
  const errors = [];
  const widthInches = bodyDimensions.width / PX_PER_IN;
  const heightInches = bodyDimensions.height / PX_PER_IN;

  if (pres.presLayout) {
    const layoutWidth = pres.presLayout.width / EMU_PER_IN;
    const layoutHeight = pres.presLayout.height / EMU_PER_IN;

    if (Math.abs(layoutWidth - widthInches) > 0.1 || Math.abs(layoutHeight - heightInches) > 0.1) {
      errors.push(
        `HTML dimensions (${widthInches.toFixed(1)}" × ${heightInches.toFixed(1)}") ` +
        `don't match presentation layout (${layoutWidth.toFixed(1)}" × ${layoutHeight.toFixed(1)}")`
      );
    }
  }
  return errors;
}

function validateTextBoxPosition(slideData, bodyDimensions) {
  const errors = [];
  const slideHeightInches = bodyDimensions.height / PX_PER_IN;
  const minBottomMargin = 0.5; // 0.5 inches from bottom

  for (const el of slideData.elements) {
    // Check text elements (p, h1-h6, list)
    if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'list'].includes(el.type)) {
      const fontSize = el.style?.fontSize || 0;
      const bottomEdge = el.position.y + el.position.h;
      const distanceFromBottom = slideHeightInches - bottomEdge;

      if (fontSize > 12 && distanceFromBottom < minBottomMargin) {
        const getText = () => {
          if (typeof el.text === 'string') return el.text;
          if (Array.isArray(el.text)) return el.text.find(t => t.text)?.text || '';
          if (Array.isArray(el.items)) return el.items.find(item => item.text)?.text || '';
          return '';
        };
        const textPrefix = getText().substring(0, 50) + (getText().length > 50 ? '...' : '');

        errors.push(
          `Text box "${textPrefix}" ends too close to bottom edge ` +
          `(${distanceFromBottom.toFixed(2)}" from bottom, minimum ${minBottomMargin}" required)`
        );
      }
    }
  }

  return errors;
}

/**
 * B1: Scan for CSS properties that are lost in PPTX conversion.
 * Catches clip-path, backdrop-filter, filter, ::before/::after, position:sticky,
 * and overflow:hidden with clipped content.
 * Returns array of {element, property, value, fix, severity} objects.
 */
async function scanUnsupportedCSS(page, slideId) {
  const issues = await page.evaluate(() => {
    const results = [];
    const contentZone = document.querySelector('.content-zone');
    if (!contentZone) return results;
    const allElements = contentZone.querySelectorAll('*');

    allElements.forEach(el => {
      const computed = window.getComputedStyle(el);
      const tag = el.tagName.toLowerCase();
      const cls = el.className ? String(el.className).split(' ')[0] : '';
      const id = `<${tag}${cls ? '.' + cls : ''}>`;

      // clip-path — LOST in PPTX
      if (computed.clipPath && computed.clipPath !== 'none') {
        results.push({ element: id, property: 'clip-path', value: computed.clipPath,
          fix: 'Use SVG <polygon> or <path> overlay instead', severity: 'BLOCKING' });
      }

      // backdrop-filter — LOST
      if (computed.backdropFilter && computed.backdropFilter !== 'none') {
        results.push({ element: id, property: 'backdrop-filter', value: computed.backdropFilter,
          fix: 'Remove — not reproducible in PPTX', severity: 'BLOCKING' });
      }

      // filter (non-none) — LOST
      if (computed.filter && computed.filter !== 'none') {
        results.push({ element: id, property: 'filter', value: computed.filter,
          fix: 'Use box-shadow for drop-shadow effects, or remove', severity: 'BLOCKING' });
      }

      // position: sticky — LOST
      if (computed.position === 'sticky') {
        results.push({ element: id, property: 'position', value: 'sticky',
          fix: 'Use position: absolute or static', severity: 'WARNING' });
      }

      // ::before / ::after with visible content
      try {
        const before = window.getComputedStyle(el, '::before');
        if (before.content && before.content !== 'none' && before.content !== '""' && before.content !== "''") {
          results.push({ element: id, property: '::before', value: before.content,
            fix: 'Replace with real DOM element', severity: 'BLOCKING' });
        }
        const after = window.getComputedStyle(el, '::after');
        if (after.content && after.content !== 'none' && after.content !== '""' && after.content !== "''") {
          results.push({ element: id, property: '::after', value: after.content,
            fix: 'Replace with real DOM element', severity: 'BLOCKING' });
        }
      } catch (e) { /* pseudo-element access can fail silently */ }

      // overflow: hidden with actual content clipping
      if (computed.overflow === 'hidden' || computed.overflowX === 'hidden' || computed.overflowY === 'hidden') {
        if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) {
          results.push({ element: id, property: 'overflow:hidden (clipping content)',
            value: `${el.scrollWidth}x${el.scrollHeight} content in ${el.clientWidth}x${el.clientHeight} box`,
            fix: 'Content is being clipped — increase container size or reduce content', severity: 'WARNING' });
        }
      }
    });

    return results;
  });

  const errors = [];
  if (issues.length > 0) {
    issues.forEach(issue => {
      const msg = `${slideId}: ${issue.element} uses ${issue.property}: ${issue.value} — LOST in PPTX. Fix: ${issue.fix}`;
      if (issue.severity === 'BLOCKING') {
        errors.push(msg);
        console.error(`  [BLOCKING] [css-survival] ${msg}`);
      } else {
        console.warn(`  [css-survival] ${msg}`);
      }
    });
  }

  return errors;
}

/**
 * C2: Measure content density — how much of the content-zone is actually filled.
 * Returns fill percentage and emits a warning if too sparse (<85%) or too full (>95%).
 * McKinsey standard: content should fill 85-95% of the content-zone.
 */
async function measureContentDensity(page, slideId) {
  const density = await page.evaluate(() => {
    const contentZone = document.querySelector('.content-zone');
    if (!contentZone) return null;

    const zoneRect = contentZone.getBoundingClientRect();
    const children = Array.from(contentZone.children);
    if (children.length === 0) return null;

    let contentMinY = Infinity, contentMaxY = -Infinity;
    children.forEach(child => {
      const r = child.getBoundingClientRect();
      if (r.height > 0) {
        contentMinY = Math.min(contentMinY, r.top);
        contentMaxY = Math.max(contentMaxY, r.bottom);
      }
    });

    if (contentMinY === Infinity) return null;

    const contentHeight = contentMaxY - contentMinY;
    const zoneHeight = zoneRect.height;
    const fillPct = Math.round(contentHeight / zoneHeight * 100);

    return { contentHeight: Math.round(contentHeight), zoneHeight: Math.round(zoneHeight), fillPct };
  });

  if (density) {
    if (density.fillPct < 85) {
      console.warn(`  [density] ${slideId}: Content fills ${density.fillPct}% of content-zone (${density.contentHeight}px of ${density.zoneHeight}px). McKinsey standard: 85-95%. Consider: increase font sizes, add spacing, or add content.`);
    } else if (density.fillPct > 95) {
      console.warn(`  [density] ${slideId}: Content fills ${density.fillPct}% of content-zone (${density.contentHeight}px of ${density.zoneHeight}px). Risk of overflow — consider: reduce content or shrink fonts.`);
    }
  }

  return density;
}

/**
 * C3: Measure horizontal fill — for each horizontal flex row inside the content-zone,
 * check whether its children's content spans a reasonable fraction of the row width.
 * Warns when content is clustered on one side with large empty space on the other.
 * General principle: multi-column layouts should fill their container horizontally.
 */
async function measureHorizontalFill(page, slideId) {
  const panels = await page.evaluate(() => {
    const results = [];
    const contentZone = document.querySelector('.content-zone');
    if (!contentZone) return results;
    // Check ALL flex rows inside content-zone, at any nesting depth
    contentZone.querySelectorAll('*').forEach((panel, i) => {
      const style = window.getComputedStyle(panel);
      if (style.display !== 'flex' || style.flexDirection === 'column') return;
      const panelRect = panel.getBoundingClientRect();
      if (panelRect.width < 100) return; // skip tiny containers
      const children = Array.from(panel.children);
      if (children.length < 3) return; // multi-column rows only
      let contentLeft = Infinity, contentRight = 0;
      children.forEach(child => {
        const cr = child.getBoundingClientRect();
        if (cr.width > 5) {
          contentLeft = Math.min(contentLeft, cr.left);
          contentRight = Math.max(contentRight, cr.right);
        }
      });
      if (contentLeft === Infinity) return;
      const contentWidth = contentRight - contentLeft;
      const fillPct = Math.round(contentWidth / panelRect.width * 100);
      if (fillPct < 70) {
        results.push({ fillPct, contentWidth: Math.round(contentWidth), panelWidth: Math.round(panelRect.width) });
      }
    });
    return results;
  });
  panels.forEach(p => {
    console.warn(`  [horizontal-fill] ${slideId}: Flex row content fills only ${p.fillPct}% of row width (${p.contentWidth}px of ${p.panelWidth}px). Use flex proportions instead of fixed widths to fill the container.`);
  });
}

// Helper: Add background to slide
async function addBackground(slideData, targetSlide, tmpDir) {
  if (slideData.background.type === 'image' && slideData.background.path) {
    let imagePath = slideData.background.path.startsWith('file://')
      ? slideData.background.path.replace('file://', '')
      : slideData.background.path;
    targetSlide.background = { path: imagePath };
  } else if (slideData.background.type === 'color' && slideData.background.value) {
    targetSlide.background = { color: slideData.background.value };
  }
}

// Helper: Add elements to slide
function addElements(slideData, targetSlide, pres) {
  for (const el of slideData.elements) {
    if (el.type === 'image') {
      let imagePath = el.src.startsWith('file://') ? el.src.replace('file://', '') : el.src;
      targetSlide.addImage({
        path: imagePath,
        x: el.position.x,
        y: el.position.y,
        w: el.position.w,
        h: el.position.h
      });
    } else if (el.type === 'line') {
      targetSlide.addShape(pres.ShapeType.line, {
        x: el.x1,
        y: el.y1,
        w: el.x2 - el.x1,
        h: el.y2 - el.y1,
        line: { color: el.color, width: el.width, dashType: el.dashType || 'solid' }
      });
    } else if (el.type === 'shape') {
      // Determine shape type: use native shape from data-shape, or rect/roundRect
      let shapeType;
      if (el.shape.shapeType && pres.ShapeType[el.shape.shapeType]) {
        // Use native PptxGenJS shape type (chevron, triangle, diamond, pentagon, etc.)
        shapeType = pres.ShapeType[el.shape.shapeType];
      } else if (el.shape.rectRadius > 0) {
        shapeType = pres.ShapeType.roundRect;
      } else {
        shapeType = pres.ShapeType.rect;
      }

      const shapeOptions = {
        x: el.position.x,
        y: el.position.y,
        w: el.position.w,
        h: el.position.h,
        shape: shapeType
      };

      if (el.shape.fill) {
        shapeOptions.fill = { color: el.shape.fill };
        if (el.shape.transparency != null) shapeOptions.fill.transparency = el.shape.transparency;
      }
      if (el.shape.line) {
        shapeOptions.line = {
          color: el.shape.line.color,
          width: el.shape.line.width,
          dashType: el.shape.line.dashType || 'solid'
        };
      }
      if (el.shape.rectRadius > 0) shapeOptions.rectRadius = el.shape.rectRadius;
      if (el.shape.shadow) shapeOptions.shadow = el.shape.shadow;

      // Apply text styling for pill/badge shapes (SPAN elements with backgrounds)
      if (el.textStyle) {
        shapeOptions.fontSize = el.textStyle.fontSize;
        shapeOptions.fontFace = el.textStyle.fontFace;
        shapeOptions.color = el.textStyle.color;
        shapeOptions.bold = el.textStyle.bold;
        shapeOptions.align = el.textStyle.align || 'center';
        shapeOptions.valign = el.textStyle.valign || 'middle';
      }

      targetSlide.addText(el.text || '', shapeOptions);
    } else if (el.type === 'table') {
      // Convert rows to PptxGenJS format (Fix A6: pass all per-cell properties)
      const tableRows = el.rows.map(row =>
        row.map(cell => {
          const cellOpts = {
            color: cell.options.color,
            bold: cell.options.bold,
            align: cell.options.align,
            valign: cell.options.valign,
            fontSize: cell.options.fontSize
          };
          // Only add fill if it exists
          if (cell.options.fill) cellOpts.fill = cell.options.fill;
          if (cell.options.colspan) cellOpts.colspan = cell.options.colspan;
          if (cell.options.rowspan) cellOpts.rowspan = cell.options.rowspan;
          // Fix A6: per-cell margin, border, fontFace
          if (cell.options.margin) cellOpts.margin = cell.options.margin;
          if (cell.options.border) cellOpts.border = cell.options.border;
          if (cell.options.fontFace) cellOpts.fontFace = cell.options.fontFace;
          return { text: cell.text, options: cellOpts };
        })
      );

      // Fix B2: Smart h constraint — dense tables (≥20 rows, avgRowH < 0.2")
      const tableOpts = {
        x: el.position.x,
        y: el.position.y,
        w: el.position.w,
        autoPage: false,
        colW: el.style.colW,
        rowH: el.style.rowH,
        fontFace: el.style.fontFace
      };

      const rowCount = el.style.rowH?.length || 1;
      const avgRowH = el.position.h / rowCount;
      const SLIDE_H = 5.625; // 16:9 slide height in inches

      if (rowCount >= 20 && avgRowH < 0.2) {
        // Dense table: PowerPoint treats row heights as MINIMUMS and expands rows
        // to fit content (font metrics + margins). To prevent overflow:
        // 1. Minimize cell margins to near-zero (reduces expansion pressure)
        // 2. Use browser row heights (don't scale up — leave headroom for PPT expansion)
        // 3. Set h to available height so PPT has room to expand within bounds
        tableRows.forEach(row => {
          row.forEach(cell => {
            // Near-zero margins in inches (PptxGenJS inch2Emu path)
            cell.options.margin = [0, 0.007, 0, 0.007]; // ~0.5pt side margins
          });
        });
        // Keep original browser row heights — don't scale up
        tableOpts.rowH = el.style.rowH;
        // Set h to available height, giving PPT room to expand rows without overflowing
        const availableH = SLIDE_H - el.position.y - 0.05;
        tableOpts.h = availableH;
      } else {
        tableOpts.h = el.position.h;
      }

      targetSlide.addTable(tableRows, tableOpts);

      // Fix B1c: Render overlay elements (images/shapes) that PptxGenJS table cells can't contain
      // Overlay positions are stored relative to their parent cell. Compute absolute PPTX
      // positions using the table position + cumulative row heights and column widths.
      if (el.overlays && el.overlays.length > 0) {
        const colW = el.style.colW || [];
        const rowH = tableOpts.rowH || el.style.rowH || [];

        el.overlays.forEach(overlay => {
          // Compute cell's absolute position in PPTX
          let cellX = el.position.x;
          for (let c = 0; c < overlay.cellCol && c < colW.length; c++) cellX += colW[c];
          let cellY = el.position.y;
          for (let r = 0; r < overlay.cellRow && r < rowH.length; r++) cellY += rowH[r];

          const absX = cellX + overlay.relPosition.x;
          const absY = cellY + overlay.relPosition.y;

          if (overlay.type === 'image') {
            let imagePath = overlay.src.startsWith('file://') ? overlay.src.replace('file://', '') : overlay.src;
            targetSlide.addImage({
              path: imagePath,
              x: absX,
              y: absY,
              w: overlay.relPosition.w,
              h: overlay.relPosition.h
            });
          } else if (overlay.type === 'shape') {
            const shapeOpts = {
              x: absX,
              y: absY,
              w: overlay.relPosition.w,
              h: overlay.relPosition.h
            };
            if (overlay.fill) shapeOpts.fill = { color: overlay.fill };
            if (overlay.border) {
              shapeOpts.line = {
                color: overlay.border.color,
                width: overlay.border.width
              };
            }
            if (overlay.rectRadius > 0) shapeOpts.rectRadius = overlay.rectRadius;
            targetSlide.addShape(pres.ShapeType.rect, shapeOpts);
          }
        });
      }
    } else if (el.type === 'list') {
      const listOptions = {
        x: el.position.x,
        y: el.position.y,
        w: el.position.w,
        h: el.position.h,
        fontSize: el.style.fontSize,
        fontFace: el.style.fontFace,
        color: el.style.color,
        align: el.style.align,
        valign: 'top',
        lineSpacing: el.style.lineSpacing,
        paraSpaceBefore: el.style.paraSpaceBefore,
        paraSpaceAfter: el.style.paraSpaceAfter,
        margin: el.style.margin,
        inset: 0  // v3.9 Fix A1: Remove default PowerPoint internal padding (matches regular text at line 782)
      };
      if (el.style.margin) listOptions.margin = el.style.margin;
      targetSlide.addText(el.items, listOptions);
    } else {
      // Check if text is single-line (height suggests one line)
      const lineHeight = el.style.lineSpacing || el.style.fontSize * 1.2;
      const isSingleLine = el.position.h <= lineHeight * 1.5;

      let adjustedX = el.position.x;
      let adjustedW = el.position.w;

      // Make single-line text 2% wider to account for underestimate
      if (isSingleLine) {
        const widthIncrease = el.position.w * 0.02;
        const align = el.style.align;

        if (align === 'center') {
          // Center: expand both sides
          adjustedX = el.position.x - (widthIncrease / 2);
          adjustedW = el.position.w + widthIncrease;
        } else if (align === 'right') {
          // Right: expand to the left
          adjustedX = el.position.x - widthIncrease;
          adjustedW = el.position.w + widthIncrease;
        } else {
          // Left (default): expand to the right
          adjustedW = el.position.w + widthIncrease;
        }
      }

      const textOptions = {
        x: adjustedX,
        y: el.position.y,
        w: adjustedW,
        h: el.position.h,
        fontSize: el.style.fontSize,
        fontFace: el.style.fontFace,
        color: el.style.color,
        bold: el.style.bold,
        italic: el.style.italic,
        underline: el.style.underline,
        valign: 'top',
        lineSpacing: el.style.lineSpacing,
        paraSpaceBefore: el.style.paraSpaceBefore,
        paraSpaceAfter: el.style.paraSpaceAfter,
        inset: 0  // Remove default PowerPoint internal padding
      };

      if (el.style.align) textOptions.align = el.style.align;
      if (el.style.margin) textOptions.margin = el.style.margin;
      if (el.style.rotate !== undefined) textOptions.rotate = el.style.rotate;
      if (el.style.transparency !== null && el.style.transparency !== undefined) textOptions.transparency = el.style.transparency;

      targetSlide.addText(el.text, textOptions);
    }
  }
}

// Helper: Extract slide data from HTML page
async function extractSlideData(page) {
  return await page.evaluate(() => {
    const PT_PER_PX = 0.75;
    const PX_PER_IN = 96;

    // Fonts that are single-weight and should not have bold applied
    // (applying bold causes PowerPoint to use faux bold which makes text wider)
    const SINGLE_WEIGHT_FONTS = ['impact'];

    // Helper: Check if a font should skip bold formatting
    const shouldSkipBold = (fontFamily) => {
      if (!fontFamily) return false;
      const normalizedFont = fontFamily.toLowerCase().replace(/['"]/g, '').split(',')[0].trim();
      return SINGLE_WEIGHT_FONTS.includes(normalizedFont);
    };

    // Unit conversion helpers
    const pxToInch = (px) => px / PX_PER_IN;
    const pxToPoints = (pxStr) => parseFloat(pxStr) * PT_PER_PX;
    const rgbToHex = (rgbStr) => {
      // Handle transparent backgrounds by defaulting to white
      if (rgbStr === 'rgba(0, 0, 0, 0)' || rgbStr === 'transparent') return 'FFFFFF';

      const match = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return 'FFFFFF';
      return match.slice(1).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
    };

    const extractAlpha = (rgbStr) => {
      const match = rgbStr.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
      if (!match || !match[4]) return null;
      const alpha = parseFloat(match[4]);
      return Math.round((1 - alpha) * 100);
    };

    const applyTextTransform = (text, textTransform) => {
      if (textTransform === 'uppercase') return text.toUpperCase();
      if (textTransform === 'lowercase') return text.toLowerCase();
      if (textTransform === 'capitalize') {
        return text.replace(/\b\w/g, c => c.toUpperCase());
      }
      return text;
    };

    // Extract rotation angle from CSS transform and writing-mode
    const getRotation = (transform, writingMode) => {
      let angle = 0;

      // Handle writing-mode first
      // PowerPoint: 90° = text rotated 90° clockwise (reads top to bottom, letters upright)
      // PowerPoint: 270° = text rotated 270° clockwise (reads bottom to top, letters upright)
      if (writingMode === 'vertical-rl') {
        // vertical-rl alone = text reads top to bottom = 90° in PowerPoint
        angle = 90;
      } else if (writingMode === 'vertical-lr') {
        // vertical-lr alone = text reads bottom to top = 270° in PowerPoint
        angle = 270;
      }

      // Then add any transform rotation
      if (transform && transform !== 'none') {
        // Try to match rotate() function
        const rotateMatch = transform.match(/rotate\((-?\d+(?:\.\d+)?)deg\)/);
        if (rotateMatch) {
          angle += parseFloat(rotateMatch[1]);
        } else {
          // Browser may compute as matrix - extract rotation from matrix
          const matrixMatch = transform.match(/matrix\(([^)]+)\)/);
          if (matrixMatch) {
            const values = matrixMatch[1].split(',').map(parseFloat);
            // matrix(a, b, c, d, e, f) where rotation = atan2(b, a)
            const matrixAngle = Math.atan2(values[1], values[0]) * (180 / Math.PI);
            angle += Math.round(matrixAngle);
          }
        }
      }

      // Normalize to 0-359 range
      angle = angle % 360;
      if (angle < 0) angle += 360;

      return angle === 0 ? null : angle;
    };

    // Get position/dimensions accounting for rotation
    const getPositionAndSize = (el, rect, rotation) => {
      if (rotation === null) {
        return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
      }

      // For 90° or 270° rotations, swap width and height
      // because PowerPoint applies rotation to the original (unrotated) box
      const isVertical = rotation === 90 || rotation === 270;

      if (isVertical) {
        // The browser shows us the rotated dimensions (tall box for vertical text)
        // But PowerPoint needs the pre-rotation dimensions (wide box that will be rotated)
        // So we swap: browser's height becomes PPT's width, browser's width becomes PPT's height
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        return {
          x: centerX - rect.height / 2,
          y: centerY - rect.width / 2,
          w: rect.height,
          h: rect.width
        };
      }

      // For other rotations, use element's offset dimensions
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      return {
        x: centerX - el.offsetWidth / 2,
        y: centerY - el.offsetHeight / 2,
        w: el.offsetWidth,
        h: el.offsetHeight
      };
    };

    // Parse CSS box-shadow into PptxGenJS shadow properties
    const parseBoxShadow = (boxShadow) => {
      if (!boxShadow || boxShadow === 'none') return null;

      // Browser computed style format: "rgba(0, 0, 0, 0.3) 2px 2px 8px 0px [inset]"
      // CSS format: "[inset] 2px 2px 8px 0px rgba(0, 0, 0, 0.3)"

      const insetMatch = boxShadow.match(/inset/);

      // IMPORTANT: PptxGenJS/PowerPoint doesn't properly support inset shadows
      // Only process outer shadows to avoid file corruption
      if (insetMatch) return null;

      // Extract color first (rgba or rgb at start)
      const colorMatch = boxShadow.match(/rgba?\([^)]+\)/);

      // Extract numeric values (handles both px and pt units)
      const parts = boxShadow.match(/([-\d.]+)(px|pt)/g);

      if (!parts || parts.length < 2) return null;

      const offsetX = parseFloat(parts[0]);
      const offsetY = parseFloat(parts[1]);
      const blur = parts.length > 2 ? parseFloat(parts[2]) : 0;

      // Calculate angle from offsets (in degrees, 0 = right, 90 = down)
      let angle = 0;
      if (offsetX !== 0 || offsetY !== 0) {
        angle = Math.atan2(offsetY, offsetX) * (180 / Math.PI);
        if (angle < 0) angle += 360;
      }

      // Calculate offset distance (hypotenuse)
      const offset = Math.sqrt(offsetX * offsetX + offsetY * offsetY) * PT_PER_PX;

      // Extract opacity from rgba
      let opacity = 0.5;
      if (colorMatch) {
        const opacityMatch = colorMatch[0].match(/[\d.]+\)$/);
        if (opacityMatch) {
          opacity = parseFloat(opacityMatch[0].replace(')', ''));
        }
      }

      return {
        type: 'outer',
        angle: Math.round(angle),
        blur: blur * 0.75, // Convert to points
        color: colorMatch ? rgbToHex(colorMatch[0]) : '000000',
        offset: offset,
        opacity
      };
    };

    // Parse inline formatting tags (<b>, <i>, <u>, <strong>, <em>, <span>, <sup>, <sub>) into text runs
    const parseInlineFormatting = (element, baseOptions = {}, runs = [], baseTextTransform = (x) => x) => {
      let prevNodeIsText = false;

      element.childNodes.forEach((node) => {
        let textTransform = baseTextTransform;

        const isText = node.nodeType === Node.TEXT_NODE || node.tagName === 'BR';
        if (isText) {
          const text = node.tagName === 'BR' ? '\n' : textTransform(node.textContent.replace(/\s+/g, ' '));
          const prevRun = runs[runs.length - 1];
          if (prevNodeIsText && prevRun) {
            prevRun.text += text;
          } else {
            runs.push({ text, options: { ...baseOptions } });
          }

        } else if (node.nodeType === Node.ELEMENT_NODE && node.textContent.trim()) {
          const options = { ...baseOptions };
          const computed = window.getComputedStyle(node);

          // Handle inline elements with computed styles
          if (node.tagName === 'SPAN' || node.tagName === 'B' || node.tagName === 'STRONG' || node.tagName === 'I' || node.tagName === 'EM' || node.tagName === 'U' || node.tagName === 'SUP' || node.tagName === 'SUB') {
            const isBold = computed.fontWeight === 'bold' || parseInt(computed.fontWeight) >= 600;
            if (isBold && !shouldSkipBold(computed.fontFamily)) options.bold = true;
            if (computed.fontStyle === 'italic') options.italic = true;
            if (computed.textDecoration && computed.textDecoration.includes('underline')) options.underline = true;
            if (computed.color && computed.color !== 'rgb(0, 0, 0)') {
              options.color = rgbToHex(computed.color);
              const transparency = extractAlpha(computed.color);
              if (transparency !== null) options.transparency = transparency;
            }
            if (computed.fontSize) options.fontSize = pxToPoints(computed.fontSize);
            if (node.tagName === 'SUP') options.superscript = true;
            if (node.tagName === 'SUB') options.subscript = true;

            // Apply text-transform on the span element itself
            if (computed.textTransform && computed.textTransform !== 'none') {
              const transformStr = computed.textTransform;
              textTransform = (text) => applyTextTransform(text, transformStr);
            }

            // Validate: Check for margins on inline elements
            if (computed.marginLeft && parseFloat(computed.marginLeft) > 0) {
              errors.push(`Inline element <${node.tagName.toLowerCase()}> has margin-left which is not supported in PowerPoint. Remove margin from inline elements.`);
            }
            if (computed.marginRight && parseFloat(computed.marginRight) > 0) {
              errors.push(`Inline element <${node.tagName.toLowerCase()}> has margin-right which is not supported in PowerPoint. Remove margin from inline elements.`);
            }
            if (computed.marginTop && parseFloat(computed.marginTop) > 0) {
              errors.push(`Inline element <${node.tagName.toLowerCase()}> has margin-top which is not supported in PowerPoint. Remove margin from inline elements.`);
            }
            if (computed.marginBottom && parseFloat(computed.marginBottom) > 0) {
              errors.push(`Inline element <${node.tagName.toLowerCase()}> has margin-bottom which is not supported in PowerPoint. Remove margin from inline elements.`);
            }

            // Recursively process the child node. This will flatten nested spans into multiple runs.
            parseInlineFormatting(node, options, runs, textTransform);
          }
        }

        prevNodeIsText = isText;
      });

      // Trim leading space from first run and trailing space from last run
      if (runs.length > 0) {
        runs[0].text = runs[0].text.replace(/^\s+/, '');
        runs[runs.length - 1].text = runs[runs.length - 1].text.replace(/\s+$/, '');
      }

      return runs.filter(r => r.text.length > 0);
    };

    // Extract background from body (image or color)
    const body = document.body;
    const bodyStyle = window.getComputedStyle(body);
    const bgImage = bodyStyle.backgroundImage;
    const bgColor = bodyStyle.backgroundColor;

    // Collect validation errors
    const errors = [];

    // Validate: Check for CSS gradients
    if (bgImage && (bgImage.includes('linear-gradient') || bgImage.includes('radial-gradient'))) {
      errors.push(
        'CSS gradients are not supported. Use Sharp to rasterize gradients as PNG images first, ' +
        'then reference with background-image: url(\'gradient.png\')'
      );
    }

    let background;
    if (bgImage && bgImage !== 'none') {
      // Extract URL from url("...") or url(...)
      const urlMatch = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
      if (urlMatch) {
        background = {
          type: 'image',
          path: urlMatch[1]
        };
      } else {
        background = {
          type: 'color',
          value: rgbToHex(bgColor)
        };
      }
    } else {
      background = {
        type: 'color',
        value: rgbToHex(bgColor)
      };
    }

    // Process all elements
    const elements = [];
    const placeholders = [];
    const textTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI'];
    const tableTags = ['TABLE', 'TR', 'TH', 'TD', 'THEAD', 'TBODY', 'TFOOT'];
    const processed = new Set();

    document.querySelectorAll('*').forEach((el) => {
      if (processed.has(el)) return;

      // Skip table child elements - they are processed when TABLE is encountered
      if (tableTags.includes(el.tagName) && el.tagName !== 'TABLE') return;

      // Validate text elements don't have backgrounds, borders, or shadows
      if (textTags.includes(el.tagName)) {
        const computed = window.getComputedStyle(el);
        const hasBg = computed.backgroundColor && computed.backgroundColor !== 'rgba(0, 0, 0, 0)';
        const hasBorder = (computed.borderWidth && parseFloat(computed.borderWidth) > 0) ||
                          (computed.borderTopWidth && parseFloat(computed.borderTopWidth) > 0) ||
                          (computed.borderRightWidth && parseFloat(computed.borderRightWidth) > 0) ||
                          (computed.borderBottomWidth && parseFloat(computed.borderBottomWidth) > 0) ||
                          (computed.borderLeftWidth && parseFloat(computed.borderLeftWidth) > 0);
        const hasShadow = computed.boxShadow && computed.boxShadow !== 'none';

        if (hasBg || hasBorder || hasShadow) {
          errors.push(
            `Text element <${el.tagName.toLowerCase()}> has ${hasBg ? 'background' : hasBorder ? 'border' : 'shadow'}. ` +
            'Backgrounds, borders, and shadows are only supported on <div> elements, not text elements.'
          );
          return;
        }
      }

      // Extract placeholder elements (for charts, etc.)
      const elClassName = typeof el.className === 'string' ? el.className : (el.className?.baseVal || '');
      if (elClassName && elClassName.includes('placeholder')) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          errors.push(
            `Placeholder "${el.id || 'unnamed'}" has ${rect.width === 0 ? 'width: 0' : 'height: 0'}. Check the layout CSS.`
          );
        } else {
          placeholders.push({
            id: el.id || `placeholder-${placeholders.length}`,
            x: pxToInch(rect.left),
            y: pxToInch(rect.top),
            w: pxToInch(rect.width),
            h: pxToInch(rect.height)
          });
        }
        processed.add(el);
        return;
      }

      // Extract images
      if (el.tagName === 'IMG') {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const isChartOverlay = el.hasAttribute('data-chart-overlay');
          elements.push({
            type: 'image',
            src: el.src,
            position: {
              x: pxToInch(rect.left),
              y: pxToInch(rect.top),
              w: pxToInch(rect.width),
              h: pxToInch(rect.height)
            },
            chartOverlay: isChartOverlay || undefined
          });
          processed.add(el);
          return;
        }
      }

      // Extract DIVs and SPANs with backgrounds/borders as shapes
      // SPANs with backgrounds are treated as pill/badge shapes
      const isContainer = (el.tagName === 'DIV' || el.tagName === 'SPAN') && !textTags.includes(el.tagName);
      if (isContainer) {
        const computed = window.getComputedStyle(el);
        const hasBg = computed.backgroundColor && computed.backgroundColor !== 'rgba(0, 0, 0, 0)';

        // Check for data-shape attribute for native PptxGenJS shapes
        const dataShape = el.getAttribute('data-shape');

        // Validate: Check for unwrapped text content in DIV (but allow in SPAN for pills/badges)
        if (el.tagName === 'DIV') {
          for (const node of el.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
              const text = node.textContent.trim();
              if (text) {
                errors.push(
                  `DIV element contains unwrapped text "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}". ` +
                  'All text must be wrapped in <p>, <h1>-<h6>, <ul>, or <ol> tags to appear in PowerPoint.'
                );
              }
            }
          }
        }

        // Check for background images on shapes
        const bgImage = computed.backgroundImage;
        if (bgImage && bgImage !== 'none') {
          errors.push(
            'Background images on DIV elements are not supported. ' +
            'Use solid colors or borders for shapes, or use slide.addImage() in PptxGenJS to layer images.'
          );
          return;
        }

        // Check for borders - both uniform and partial
        const borderTop = computed.borderTopWidth;
        const borderRight = computed.borderRightWidth;
        const borderBottom = computed.borderBottomWidth;
        const borderLeft = computed.borderLeftWidth;
        const borders = [borderTop, borderRight, borderBottom, borderLeft].map(b => parseFloat(b) || 0);
        const hasBorder = borders.some(b => b > 0);
        const hasUniformBorder = hasBorder && borders.every(b => b === borders[0]);
        const borderLines = [];

        // R3: Detect separator-like elements (thin divs with single border, no text)
        const elHeight = parseFloat(computed.height) || 0;
        const isSeparator = elHeight < 5 && !el.textContent.trim() && hasBorder;
        let separatorAutoFixed = false;
        let separatorMarginFixed = false;

        // R4: Auto-fix separator margin if < 12pt (~16px)
        if (isSeparator) {
          const marginTop = parseFloat(computed.marginTop) || 0;
          const marginBottom = parseFloat(computed.marginBottom) || 0;
          const minMarginPx = 16; // ~12pt
          if (marginTop < minMarginPx || marginBottom < minMarginPx) {
            el.style.marginTop = Math.max(marginTop, minMarginPx) + 'px';
            el.style.marginBottom = Math.max(marginBottom, minMarginPx) + 'px';
            separatorMarginFixed = true;
          }
        }

        if (hasBorder && !hasUniformBorder) {
          const rect = el.getBoundingClientRect();
          const x = pxToInch(rect.left);
          const y = pxToInch(rect.top);
          const w = pxToInch(rect.width);
          const h = pxToInch(rect.height);

          // Collect lines to add after shape (inset by half the line width to center on edge)
          // Helper to map border style to dashType (auto-fixes solid separators to dashed)
          const getDashType = (style) => {
            if (style === 'dashed') return 'dash';
            if (style === 'dotted') return 'sysDot';
            // McKinsey standard: separator lines must be dashed, not solid
            if (isSeparator && style === 'solid') {
              separatorAutoFixed = true;
              return 'dash';
            }
            return 'solid';
          };

          if (parseFloat(borderTop) > 0) {
            const widthPt = pxToPoints(borderTop);
            const inset = (widthPt / 72) / 2; // Convert points to inches, then half
            borderLines.push({
              type: 'line',
              x1: x, y1: y + inset, x2: x + w, y2: y + inset,
              width: widthPt,
              color: rgbToHex(computed.borderTopColor),
              dashType: getDashType(computed.borderTopStyle)
            });
          }
          if (parseFloat(borderRight) > 0) {
            const widthPt = pxToPoints(borderRight);
            const inset = (widthPt / 72) / 2;
            borderLines.push({
              type: 'line',
              x1: x + w - inset, y1: y, x2: x + w - inset, y2: y + h,
              width: widthPt,
              color: rgbToHex(computed.borderRightColor),
              dashType: getDashType(computed.borderRightStyle)
            });
          }
          if (parseFloat(borderBottom) > 0) {
            const widthPt = pxToPoints(borderBottom);
            const inset = (widthPt / 72) / 2;
            borderLines.push({
              type: 'line',
              x1: x, y1: y + h - inset, x2: x + w, y2: y + h - inset,
              width: widthPt,
              color: rgbToHex(computed.borderBottomColor),
              dashType: getDashType(computed.borderBottomStyle)
            });
          }
          if (parseFloat(borderLeft) > 0) {
            const widthPt = pxToPoints(borderLeft);
            const inset = (widthPt / 72) / 2;
            borderLines.push({
              type: 'line',
              x1: x + inset, y1: y, x2: x + inset, y2: y + h,
              width: widthPt,
              color: rgbToHex(computed.borderLeftColor),
              dashType: getDashType(computed.borderLeftStyle)
            });
          }
        }

        if (hasBg || hasBorder || dataShape) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const shadow = parseBoxShadow(computed.boxShadow);
            const isChartOverlay = el.hasAttribute('data-chart-overlay');

            // Only add shape if there's background or uniform border or data-shape
            if (hasBg || hasUniformBorder || dataShape) {
              // For SPAN elements with background, extract text and include in shape
              // This handles pill/badge elements
              let shapeText = '';
              let textStyle = {};
              if (el.tagName === 'SPAN' && hasBg) {
                shapeText = el.textContent.trim();
                textStyle = {
                  fontSize: pxToPoints(computed.fontSize),
                  fontFace: computed.fontFamily.split(',')[0].replace(/['"]/g, '').trim(),
                  color: rgbToHex(computed.color),
                  bold: computed.fontWeight === 'bold' || parseInt(computed.fontWeight) >= 600,
                  align: 'center',
                  valign: 'middle'
                };
                // Mark all children as processed to avoid duplicate text
                el.querySelectorAll('*').forEach(child => processed.add(child));
              }

              // Helper to get dashType for uniform borders
              const getUniformDashType = () => {
                const style = computed.borderStyle;
                if (style === 'dashed') return 'dash';
                if (style === 'dotted') return 'sysDot';
                return 'solid';
              };

              elements.push({
                type: 'shape',
                text: shapeText,  // Shape only for DIV, text included for SPAN
                textStyle: Object.keys(textStyle).length > 0 ? textStyle : null,
                position: {
                  x: pxToInch(rect.left),
                  y: pxToInch(rect.top),
                  w: pxToInch(rect.width),
                  h: pxToInch(rect.height)
                },
                shape: {
                  shapeType: dataShape || null,  // Native PptxGenJS shape type (chevron, triangle, etc.)
                  fill: hasBg ? rgbToHex(computed.backgroundColor) : null,
                  transparency: (() => {
                    let t = hasBg ? extractAlpha(computed.backgroundColor) : null;
                    const cssOpacity = parseFloat(computed.opacity);
                    if (cssOpacity < 1) {
                      // CSS opacity 0.12 → 88% transparent in PptxGenJS
                      const opacityT = Math.round((1 - cssOpacity) * 100);
                      t = t != null ? Math.round((1 - (1 - t / 100) * cssOpacity) * 100) : opacityT;
                    }
                    return t;
                  })(),
                  line: hasUniformBorder ? {
                    color: rgbToHex(computed.borderColor),
                    width: pxToPoints(computed.borderWidth),
                    dashType: getUniformDashType()
                  } : null,
                  // Convert border-radius to rectRadius (in inches)
                  // % values: 50%+ = circle (1), <50% = percentage of min dimension
                  // pt values: divide by 72 (72pt = 1 inch)
                  // px values: divide by 96 (96px = 1 inch)
                  rectRadius: (() => {
                    const radius = computed.borderRadius;
                    const radiusValue = parseFloat(radius);
                    if (radiusValue === 0) return 0;

                    if (radius.includes('%')) {
                      if (radiusValue >= 50) return 1;
                      // Calculate percentage of smaller dimension
                      const minDim = Math.min(rect.width, rect.height);
                      return (radiusValue / 100) * pxToInch(minDim);
                    }

                    if (radius.includes('pt')) return radiusValue / 72;
                    return radiusValue / PX_PER_IN;
                  })(),
                  shadow: shadow
                },
                chartOverlay: isChartOverlay || undefined
              });
            }

            // Add partial border lines (tag separator auto-fixes for warning output)
            if (separatorAutoFixed && borderLines.length > 0) {
              borderLines[0].separatorAutoFixed = true;
            }
            if (separatorMarginFixed && borderLines.length > 0) {
              borderLines[0].separatorMarginFixed = true;
            }
            if (isChartOverlay) {
              borderLines.forEach(bl => bl.chartOverlay = true);
            }
            elements.push(...borderLines);

            processed.add(el);
            return;
          }
        }
      }

      // Extract bullet lists as single text block
      if (el.tagName === 'UL' || el.tagName === 'OL') {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const liElements = Array.from(el.querySelectorAll(':scope > li'));  // v3.9 Fix A4: direct children only, nested <ul> processed separately
        const items = [];
        const ulComputed = window.getComputedStyle(el);
        const ulPaddingLeftPt = pxToPoints(ulComputed.paddingLeft);

        // v3.8: Per-li bullet indentation with character preservation
        // Compute per-li padding-left for individual bullet indent control
        const liPaddings = liElements.map(li => pxToPoints(window.getComputedStyle(li).paddingLeft));
        const positivePaddings = liPaddings.filter(p => p > 0);
        const basePaddingLeft = positivePaddings.length > 0 ? Math.min(...positivePaddings) : 0;
        // Text box margin: use half of ul padding (backward compat for ul with non-zero padding)
        const marginLeft = ulPaddingLeftPt * 0.5;

        liElements.forEach((li, idx) => {
          const isLast = idx === liElements.length - 1;
          let runs = parseInlineFormatting(li, { breakLine: false });
          // Clean manual bullet markers — includes en-dash/em-dash for sub-bullets
          const bulletChars = /^[•\-\*▪▸■□►◆◇○●–—]\s*$/;
          const bulletPrefix = /^[•\-\*▪▸■□►◆◇○●–—]\s*/;

          // v3.8: Detect original bullet character before removing it
          let detectedBulletChar = null;
          for (const r of runs) {
            if (bulletChars.test(r.text)) {
              detectedBulletChar = r.text.trim();
              break;
            }
          }
          if (!detectedBulletChar && runs.length > 0) {
            const prefixMatch = runs[0].text.match(bulletPrefix);
            if (prefixMatch) {
              detectedBulletChar = prefixMatch[0].trim();
            }
          }

          // Remove runs that are ONLY a bullet marker (from absolutely-positioned spans)
          runs = runs.filter(r => !bulletChars.test(r.text));
          // Also strip bullet prefix from first remaining run + trim leading whitespace
          if (runs.length > 0) {
            runs[0].text = runs[0].text.replace(bulletPrefix, '').replace(/^\s+/, '');

            // v3.8: Build bullet options with original character and per-li indent
            const liPaddingLeftPt = liPaddings[idx];
            const isSubBullet = basePaddingLeft > 0 && liPaddingLeftPt > basePaddingLeft * 1.3;

            // Hanging indent: 70% of base padding, minimum 5pt (avoids falsy 0)
            const bulletIndent = Math.max(basePaddingLeft > 0 ? basePaddingLeft * 0.7 : 14, 8);  // v3.9 Fix A2: 14pt default, 8pt min (was 5/5)

            // Use characterCode (preferred over deprecated code) with 4-digit hex
            const charCode = detectedBulletChar
              ? detectedBulletChar.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')
              : '2022'; // Default bullet •

            const bulletOpts = {
              characterCode: charCode,
              indent: bulletIndent
            };

            // v4.2: Bullet color inheritance — set bullet marker color to match text color.
            // Without this, PptxGenJS defaults bullet markers to black, which is invisible
            // on dark backgrounds (e.g., navy takeaway boxes).
            const liComputed = window.getComputedStyle(li);
            const liColor = liComputed.color;
            if (liColor) {
              const rgbMatch = liColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
              if (rgbMatch) {
                bulletOpts.color = [rgbMatch[1], rgbMatch[2], rgbMatch[3]]
                  .map(v => parseInt(v).toString(16).padStart(2, '0')).join('');
              }
            }

            runs[0].options.bullet = bulletOpts;
            runs[0].options.marL = 0;  // v3.9 Fix A3: prevent PptxGenJS default left margin

            // v3.9 Fix A5: Support 3+ indentation levels (proportional to padding depth)
            if (basePaddingLeft > 0 && liPaddingLeftPt > basePaddingLeft) {
              const indentRatio = liPaddingLeftPt / basePaddingLeft;
              runs[0].options.indentLevel = Math.min(Math.floor(indentRatio), 4);
            }

            // v3.9 Fix A6: Per-<li> paraSpaceAfter (each bullet gets its own spacing)
            const itemSpaceAfter = pxToPoints(liComputed.marginBottom);
            runs[runs.length - 1].options.paraSpaceAfter = itemSpaceAfter;
          }
          // Set breakLine on last run
          if (runs.length > 0 && !isLast) {
            runs[runs.length - 1].options.breakLine = true;
          }
          items.push(...runs);
        });

        const computed = window.getComputedStyle(liElements[0] || el);
        const isChartOverlay = el.hasAttribute('data-chart-overlay');

        elements.push({
          type: 'list',
          items: items,
          position: {
            x: pxToInch(rect.left),
            y: pxToInch(rect.top),
            w: pxToInch(rect.width),
            h: pxToInch(rect.height)
          },
          style: {
            fontSize: pxToPoints(computed.fontSize),
            fontFace: computed.fontFamily.split(',')[0].replace(/['"]/g, '').trim(),
            color: rgbToHex(computed.color),
            transparency: extractAlpha(computed.color),
            align: computed.textAlign === 'start' ? 'left' : computed.textAlign,
            lineSpacing: computed.lineHeight && computed.lineHeight !== 'normal' ? pxToPoints(computed.lineHeight) : null,
            paraSpaceBefore: 0,
            paraSpaceAfter: pxToPoints(computed.marginBottom),
            // PptxGenJS margin array is [left, right, bottom, top]
            margin: [marginLeft, 0, 0, 0]
          },
          chartOverlay: isChartOverlay || undefined
        });

        liElements.forEach(li => processed.add(li));
        processed.add(el);
        return;
      }

      // Extract tables
      if (el.tagName === 'TABLE') {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        // Helper: parse a single CSS border side from computed style
        const parseBorderSide = (computed, side) => {
          const width = parseFloat(computed[`border${side}Width`]) || 0;
          if (width === 0) return { type: 'none' };
          const style = computed[`border${side}Style`];
          if (style === 'none' || style === 'hidden') return { type: 'none' };
          const color = rgbToHex(computed[`border${side}Color`]);
          return {
            pt: width * PT_PER_PX,
            color: color,
            type: style === 'dashed' ? 'dash' : style === 'dotted' ? 'sysDot' : 'solid'
          };
        };

        // Helper: detect leading bullet character in runs and convert to PptxGenJS bullet
        const detectAndConvertBullets = (runs) => {
          if (runs.length === 0) return;
          const bulletChars = /^[•\-\*▪▸■□►◆◇○●–—]\s*$/;
          const bulletPrefix = /^[•\-\*▪▸■□►◆◇○●–—]\s*/;

          // Case A: first run IS a standalone bullet character (e.g., <span>■</span>)
          if (bulletChars.test(runs[0].text)) {
            const char = runs[0].text.trim();
            const charCode = char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
            runs.splice(0, 1); // Remove the bullet-only run
            if (runs.length > 0) {
              runs[0].text = runs[0].text.replace(/^\s+/, '');
              runs[0].options.bullet = { characterCode: charCode, indent: 9 };
            }
            return;
          }

          // Case B: first run STARTS with a bullet character
          const m = runs[0].text.match(bulletPrefix);
          if (m) {
            const char = m[0].trim();
            const charCode = char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
            runs[0].text = runs[0].text.replace(bulletPrefix, '').replace(/^\s+/, '');
            runs[0].options.bullet = { characterCode: charCode, indent: 9 };
          }
        };

        // Helper: extract rich cell content preserving lists, paragraphs, and inline formatting
        const extractCellContent = (cell) => {
          // 1. Check for <ul>/<ol> inside cell → extract as bullet list items (KEEP EXISTING)
          const list = cell.querySelector('ul, ol');
          if (list) {
            const items = Array.from(list.querySelectorAll(':scope > li'));
            const runs = [];
            items.forEach((li, idx) => {
              const isLast = idx === items.length - 1;
              // Pass <li>'s computed fontSize/color as base options so text nodes
              // inherit the correct size (not the <td>'s potentially different size)
              const liComputed = window.getComputedStyle(li);
              const liBaseOpts = {};
              if (liComputed.fontSize) liBaseOpts.fontSize = pxToPoints(liComputed.fontSize);
              if (liComputed.color) liBaseOpts.color = rgbToHex(liComputed.color);
              const liIsBold = liComputed.fontWeight === 'bold' || parseInt(liComputed.fontWeight) >= 600;
              if (liIsBold) liBaseOpts.bold = true;
              let liRuns = parseInlineFormatting(li, liBaseOpts);
              const bulletChars = /^[•\-\*▪▸■□►◆◇○●–—]\s*$/;
              const bulletPrefix = /^[•\-\*▪▸■□►◆◇○●–—]\s*/;
              let detectedChar = null;
              for (const r of liRuns) {
                if (bulletChars.test(r.text)) { detectedChar = r.text.trim(); break; }
              }
              if (!detectedChar && liRuns.length > 0) {
                const m = liRuns[0].text.match(bulletPrefix);
                if (m) detectedChar = m[0].trim();
              }
              liRuns = liRuns.filter(r => !bulletChars.test(r.text));
              if (liRuns.length > 0) {
                liRuns[0].text = liRuns[0].text.replace(bulletPrefix, '').replace(/^\s+/, '');
                const charCode = detectedChar
                  ? detectedChar.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')
                  : '25A0'; // ■ default for table cell bullets
                liRuns[0].options.bullet = { characterCode: charCode, indent: 9 };
                if (!isLast) liRuns[liRuns.length - 1].options.breakLine = true;
              }
              runs.push(...liRuns);
            });
            return runs.length > 0 ? runs : cell.textContent.trim();
          }

          // 2. Check for <p> elements (1 or more) — MUST come before generic inline check
          const paragraphs = Array.from(cell.querySelectorAll(':scope > p'));
          if (paragraphs.length > 0) {
            const runs = [];
            paragraphs.forEach((p, idx) => {
              const isLast = idx === paragraphs.length - 1;
              // Pass <p>'s computed fontSize/color as base options so text nodes
              // inherit the correct size (not the <td>'s potentially different size)
              const pComputed = window.getComputedStyle(p);
              const baseOpts = {};
              if (pComputed.fontSize) baseOpts.fontSize = pxToPoints(pComputed.fontSize);
              if (pComputed.color) baseOpts.color = rgbToHex(pComputed.color);
              const isBold = pComputed.fontWeight === 'bold' || parseInt(pComputed.fontWeight) >= 600;
              if (isBold) baseOpts.bold = true;
              const pRuns = parseInlineFormatting(p, baseOpts);
              if (pRuns.length > 0) {
                // Detect bullets within this paragraph
                detectAndConvertBullets(pRuns);
                if (!isLast) pRuns[pRuns.length - 1].options.breakLine = true;
              }
              runs.push(...pRuns);
            });
            return runs.length > 0 ? runs : cell.textContent.trim();
          }

          // 3. No <p> wrapper — check for inline formatting directly in cell
          //    (e.g., <th>Flow value<sup>1</sup></th>)
          const hasFormatting = cell.querySelector('strong, b, em, i, u, span, sup, sub');
          if (hasFormatting) {
            const runs = parseInlineFormatting(cell, {});
            if (runs.length > 0) {
              detectAndConvertBullets(runs);
              return runs;
            }
            return cell.textContent.trim();
          }

          // 4. Fallback: plain text
          return cell.textContent.trim();
        };

        const rows = [];
        const colWidths = [];
        const rowHeights = [];

        // Process each row
        const trElements = Array.from(el.querySelectorAll('tr'));
        trElements.forEach((tr, rowIdx) => {
          const rowCells = [];
          const cells = Array.from(tr.querySelectorAll('th, td'));
          const trComputed = window.getComputedStyle(tr);
          const trBgColor = trComputed.backgroundColor;
          const hasRowBg = trBgColor && trBgColor !== 'rgba(0, 0, 0, 0)';

          cells.forEach((cell, colIdx) => {
            const cellComputed = window.getComputedStyle(cell);
            const cellRect = cell.getBoundingClientRect();

            // Cell background: use cell's own bg, or inherit from row if cell is transparent
            let cellBgColor = cellComputed.backgroundColor;
            if (cellBgColor === 'rgba(0, 0, 0, 0)' && hasRowBg) {
              cellBgColor = trBgColor;
            }

            // Fix A1: Rich text extraction preserving lists, paragraphs, inline formatting
            const cellContent = extractCellContent(cell);

            // Fix A3: Cell vertical-align from CSS
            const vAlign = cellComputed.verticalAlign;

            // Extract cell styling
            const cellData = {
              text: cellContent,
              options: {
                fill: cellBgColor !== 'rgba(0, 0, 0, 0)' ? { color: rgbToHex(cellBgColor) } : null,
                color: rgbToHex(cellComputed.color),
                bold: (typeof cellContent === 'string') && (cellComputed.fontWeight === 'bold' || parseInt(cellComputed.fontWeight) >= 600),
                align: cellComputed.textAlign === 'start' ? 'left' : cellComputed.textAlign,
                valign: vAlign === 'top' ? 'top' : vAlign === 'bottom' ? 'bottom' : 'middle',
                fontSize: pxToPoints(cellComputed.fontSize),
                // Fix A7: Per-cell font face
                fontFace: cellComputed.fontFamily.split(',')[0].replace(/['"]/g, '').trim()
              }
            };

            // Fix A2: Cell padding → PptxGenJS margin [top, right, bottom, left]
            // NOTE: PptxGenJS has a broken heuristic (line ~5321 in pptxgen.es.js):
            //   if margin[0] >= 1 → treats values as POINTS (valToPts)
            //   if margin[0] < 1  → treats values as INCHES (inch2Emu)
            // When padding-top is 0, all margins get treated as inches (3pt → 3 inches!).
            // Fix: convert points to inches (÷72) so inch2Emu always produces correct EMU.
            const pTop = parseFloat(cellComputed.paddingTop) * PT_PER_PX || 0;
            const pRight = parseFloat(cellComputed.paddingRight) * PT_PER_PX || 0;
            const pBottom = parseFloat(cellComputed.paddingBottom) * PT_PER_PX || 0;
            const pLeft = parseFloat(cellComputed.paddingLeft) * PT_PER_PX || 0;
            cellData.options.margin = [pTop / 72, pRight / 72, pBottom / 72, pLeft / 72];

            // Fix A4: Per-cell border as TRBL array [top, right, bottom, left]
            const bTop = parseBorderSide(cellComputed, 'Top');
            const bRight = parseBorderSide(cellComputed, 'Right');
            let bBottom = parseBorderSide(cellComputed, 'Bottom');
            const bLeft = parseBorderSide(cellComputed, 'Left');

            // Also check <tr> border-bottom and propagate to cells
            const trBorderBottom = parseBorderSide(trComputed, 'Bottom');
            if (trBorderBottom.type !== 'none' && bBottom.type === 'none') {
              bBottom = trBorderBottom;
            }
            // Also check <tr> border-top and propagate to cells
            let bTopFinal = bTop;
            const trBorderTop = parseBorderSide(trComputed, 'Top');
            if (trBorderTop.type !== 'none' && bTop.type === 'none') {
              bTopFinal = trBorderTop;
            }

            cellData.options.border = [bTopFinal, bRight, bBottom, bLeft];

            // Handle colspan/rowspan
            const colspan = cell.getAttribute('colspan');
            const rowspan = cell.getAttribute('rowspan');
            if (colspan) cellData.options.colspan = parseInt(colspan);
            if (rowspan) cellData.options.rowspan = parseInt(rowspan);

            // Fix B1: Detect non-text overlay elements inside cell (images, styled divs)
            // PptxGenJS table cells are text-only — these will be rendered as slide overlays
            // Positions are stored RELATIVE to the cell so we can compute correct PPTX positions
            const cellOverlays = [];

            // Detect <img> elements inside cell (includes rasterized SVGs)
            const cellImgs = cell.querySelectorAll('img');
            cellImgs.forEach(img => {
              const imgRect = img.getBoundingClientRect();
              if (imgRect.width > 0 && imgRect.height > 0) {
                cellOverlays.push({
                  type: 'image',
                  src: img.src,
                  relPosition: {
                    x: pxToInch(imgRect.left - cellRect.left),
                    y: pxToInch(imgRect.top - cellRect.top),
                    w: pxToInch(imgRect.width),
                    h: pxToInch(imgRect.height)
                  },
                  cellRow: rowIdx,
                  cellCol: colIdx
                });
              }
            });

            // Detect styled <div> elements inside cell (background/border boxes)
            const cellDivs = cell.querySelectorAll('div');
            cellDivs.forEach(div => {
              const divComputed = window.getComputedStyle(div);
              const divRect = div.getBoundingClientRect();
              const hasBg = divComputed.backgroundColor && divComputed.backgroundColor !== 'rgba(0, 0, 0, 0)';
              const hasBorder = parseFloat(divComputed.borderWidth) > 0;
              if ((hasBg || hasBorder) && divRect.width > 0 && divRect.height > 0) {
                cellOverlays.push({
                  type: 'shape',
                  relPosition: {
                    x: pxToInch(divRect.left - cellRect.left),
                    y: pxToInch(divRect.top - cellRect.top),
                    w: pxToInch(divRect.width),
                    h: pxToInch(divRect.height)
                  },
                  cellRow: rowIdx,
                  cellCol: colIdx,
                  fill: hasBg ? rgbToHex(divComputed.backgroundColor) : null,
                  border: hasBorder ? {
                    color: rgbToHex(divComputed.borderColor),
                    width: pxToPoints(divComputed.borderWidth)
                  } : null,
                  rectRadius: parseFloat(divComputed.borderRadius) * PT_PER_PX || 0
                });
              }
            });

            // Add overlays to cell data; force valign top so text doesn't overlap overlays
            if (cellOverlays.length > 0) {
              cellData.overlays = cellOverlays;
              cellData.options.valign = 'top';
            }

            rowCells.push(cellData);
          });

          rows.push(rowCells);
          rowHeights.push(pxToInch(tr.getBoundingClientRect().height));
        });

        // Fix B3a: Normalize rowH to sum exactly to table height (prevents rounding accumulation)
        const totalRowH = rowHeights.reduce((a, b) => a + b, 0);
        if (totalRowH > 0 && rect.height > 0) {
          const targetH = pxToInch(rect.height);
          const scale = targetH / totalRowH;
          for (let i = 0; i < rowHeights.length; i++) {
            rowHeights[i] *= scale;
          }
        }

        // Fix B3b: Compensate for spacer row expansion
        // PowerPoint/LibreOffice expand tiny spacer rows to ~0.17" minimum.
        // Solution: set spacer rows to minimum, then SHRINK content rows to absorb
        // the expected expansion (so total stays within h constraint).
        const MIN_SPACER_H = 0.01; // What we specify
        const EXPECTED_SPACER_H = 0.20; // What PowerPoint/LibreOffice actually renders
        const spacerIndices = [];
        const contentIndices = [];
        let expectedExpansion = 0;

        rows.forEach((rowCells, rowIdx) => {
          const allEmpty = rowCells.every(cell => {
            const text = typeof cell.text === 'string' ? cell.text : '';
            return text.trim() === '';
          });
          if (allEmpty && rowHeights[rowIdx] < 0.1) { // < 0.1 inch = spacer row
            spacerIndices.push(rowIdx);
            rowCells.forEach(cell => {
              cell.options.fontSize = 1;
              cell.options.margin = [0, 0, 0, 0];
            });
            expectedExpansion += EXPECTED_SPACER_H - MIN_SPACER_H;
            rowHeights[rowIdx] = MIN_SPACER_H;
          } else {
            contentIndices.push(rowIdx);
          }
        });

        // Shrink content rows to absorb expected spacer expansion
        if (expectedExpansion > 0 && contentIndices.length > 0) {
          const contentTotal = contentIndices.reduce((s, i) => s + rowHeights[i], 0);
          if (contentTotal > expectedExpansion) {
            const shrinkFactor = (contentTotal - expectedExpansion) / contentTotal;
            contentIndices.forEach(i => {
              rowHeights[i] *= shrinkFactor;
            });
          }
        }

        // Fix B1b: Collect overlays from cells into table-level array
        const tableOverlays = [];
        rows.forEach(row => {
          row.forEach(cell => {
            if (cell.overlays) {
              tableOverlays.push(...cell.overlays);
              delete cell.overlays; // Don't send to PptxGenJS
            }
          });
        });

        // Fix A8: Find best row for column widths (most cells, no colspans)
        let bestRow = null;
        let maxCols = 0;
        trElements.forEach((tr, idx) => {
          const cells = Array.from(tr.querySelectorAll('th, td'));
          const hasColspan = cells.some(c => c.getAttribute('colspan'));
          if (!hasColspan && cells.length > maxCols) {
            maxCols = cells.length;
            bestRow = tr;
          }
        });
        // Fallback to first row if no row without colspans
        if (!bestRow && trElements.length > 0) {
          bestRow = trElements[0];
        }
        if (bestRow) {
          Array.from(bestRow.querySelectorAll('th, td')).forEach(cell => {
            colWidths.push(pxToInch(cell.getBoundingClientRect().width));
          });
        }

        // Extract table-level styling
        const tableComputed = window.getComputedStyle(el);

        elements.push({
          type: 'table',
          rows: rows,
          position: {
            x: pxToInch(rect.left),
            y: pxToInch(rect.top),
            w: pxToInch(rect.width),
            h: pxToInch(rect.height)
          },
          style: {
            colW: colWidths,
            rowH: rowHeights,
            fontFace: tableComputed.fontFamily.split(',')[0].replace(/['"]/g, '').trim()
          },
          overlays: tableOverlays.length > 0 ? tableOverlays : undefined
        });

        // Mark all child elements as processed (use '*' to include <p>, <span>, etc. inside cells — prevents duplicate rendering)
        el.querySelectorAll('*').forEach(child => processed.add(child));
        processed.add(el);
        return;
      }

      // Extract text elements (P, H1, H2, etc.)
      if (!textTags.includes(el.tagName)) return;

      const rect = el.getBoundingClientRect();
      const text = el.textContent.trim();
      if (rect.width === 0 || rect.height === 0 || !text) return;

      // Validate: Check for manual bullet symbols in text elements (not in lists)
      if (el.tagName !== 'LI' && /^[•\-\*▪▸○●◆◇■□]\s/.test(text.trimStart())) {
        errors.push(
          `Text element <${el.tagName.toLowerCase()}> starts with bullet symbol "${text.substring(0, 20)}...". ` +
          'Use <ul> or <ol> lists instead of manual bullet symbols.'
        );
        return;
      }

      const computed = window.getComputedStyle(el);
      const rotation = getRotation(computed.transform, computed.writingMode);
      const { x, y, w, h } = getPositionAndSize(el, rect, rotation);

      const baseStyle = {
        fontSize: pxToPoints(computed.fontSize),
        fontFace: computed.fontFamily.split(',')[0].replace(/['"]/g, '').trim(),
        color: rgbToHex(computed.color),
        align: computed.textAlign === 'start' ? 'left' : computed.textAlign,
        lineSpacing: pxToPoints(computed.lineHeight),
        paraSpaceBefore: pxToPoints(computed.marginTop),
        paraSpaceAfter: pxToPoints(computed.marginBottom),
        // PptxGenJS margin array is [left, right, bottom, top] (not [top, right, bottom, left] as documented)
        margin: [
          pxToPoints(computed.paddingLeft),
          pxToPoints(computed.paddingRight),
          pxToPoints(computed.paddingBottom),
          pxToPoints(computed.paddingTop)
        ]
      };

      const transparency = extractAlpha(computed.color);
      if (transparency !== null) baseStyle.transparency = transparency;

      if (rotation !== null) baseStyle.rotate = rotation;

      const isChartOverlay = el.hasAttribute('data-chart-overlay');
      const hasFormatting = el.querySelector('b, i, u, strong, em, span, br, sup, sub');

      if (hasFormatting) {
        // Text with inline formatting
        const transformStr = computed.textTransform;
        const runs = parseInlineFormatting(el, {}, [], (str) => applyTextTransform(str, transformStr));

        // Adjust lineSpacing based on largest fontSize in runs
        const adjustedStyle = { ...baseStyle };
        if (adjustedStyle.lineSpacing) {
          const maxFontSize = Math.max(
            adjustedStyle.fontSize,
            ...runs.map(r => r.options?.fontSize || 0)
          );
          if (maxFontSize > adjustedStyle.fontSize) {
            const lineHeightMultiplier = adjustedStyle.lineSpacing / adjustedStyle.fontSize;
            adjustedStyle.lineSpacing = maxFontSize * lineHeightMultiplier;
          }
        }

        elements.push({
          type: el.tagName.toLowerCase(),
          text: runs,
          position: { x: pxToInch(x), y: pxToInch(y), w: pxToInch(w), h: pxToInch(h) },
          style: adjustedStyle,
          chartOverlay: isChartOverlay || undefined
        });
      } else {
        // Plain text - inherit CSS formatting
        const textTransform = computed.textTransform;
        const transformedText = applyTextTransform(text, textTransform);

        const isBold = computed.fontWeight === 'bold' || parseInt(computed.fontWeight) >= 600;

        elements.push({
          type: el.tagName.toLowerCase(),
          text: transformedText,
          position: { x: pxToInch(x), y: pxToInch(y), w: pxToInch(w), h: pxToInch(h) },
          style: {
            ...baseStyle,
            bold: isBold && !shouldSkipBold(computed.fontFamily),
            italic: computed.fontStyle === 'italic',
            underline: computed.textDecoration.includes('underline')
          },
          chartOverlay: isChartOverlay || undefined
        });
      }

      processed.add(el);
    });

    // ── Smart merge: consecutive <p> elements that form a single value ──────
    // When sibling <p> elements share the same style, x position, and width,
    // and their combined text is short enough for the container width,
    // merge them into a single text element (single line).
    // This handles cases like <p>193-</p><p>220</p> → "193-220" on one line.
    const AVG_CHAR_WIDTH = 0.55; // ratio of char width to font size (pt)
    const merged = [];
    let i = 0;
    while (i < elements.length) {
      const el = elements[i];
      // Only merge plain text <p> elements (string text, not rich text arrays)
      if (el.type === 'p' && typeof el.text === 'string' && !el.chartOverlay) {
        // Collect consecutive <p> elements with matching style and position
        const group = [el];
        let j = i + 1;
        while (j < elements.length) {
          const next = elements[j];
          if (next.type !== 'p' || typeof next.text !== 'string' || next.chartOverlay) break;
          // Same font size, color, alignment, x position, width (within tolerance)
          const sameStyle = (
            Math.abs((next.style?.fontSize || 0) - (el.style?.fontSize || 0)) < 0.5 &&
            next.style?.color === el.style?.color &&
            next.style?.fontFace === el.style?.fontFace &&
            next.style?.align === el.style?.align
          );
          const sameX = Math.abs((next.position?.x || 0) - (el.position?.x || 0)) < 0.02;
          const sameW = Math.abs((next.position?.w || 0) - (el.position?.w || 0)) < 0.05;
          // Vertically adjacent (next starts near where current group ends)
          const groupBottom = group[group.length - 1].position.y + group[group.length - 1].position.h;
          const verticallyAdjacent = Math.abs(next.position.y - groupBottom) < 0.05;
          if (sameStyle && sameX && sameW && verticallyAdjacent) {
            group.push(next);
            j++;
          } else {
            break;
          }
        }

        if (group.length > 1) {
          // Check if combined text fits in single line
          const combinedText = group.map(g => g.text).join('');
          const fontSizePt = el.style?.fontSize || 9;
          const isBold = el.style?.bold;
          const textWidthPt = combinedText.length * fontSizePt * AVG_CHAR_WIDTH * (isBold ? 1.05 : 1);
          const containerWidthPt = (el.position?.w || 1) * 72; // inches to pt

          // Only merge if each individual fragment is short (≤12 chars).
          // Longer fragments are likely intentional separate paragraphs (headers, descriptions).
          const allFragmentsShort = group.every(g => g.text.length <= 12);

          if (allFragmentsShort && textWidthPt <= containerWidthPt) {
            // Merge into single element — mark for bar-width alignment
            const firstPos = group[0].position;
            const lastPos = group[group.length - 1].position;
            const centerX = firstPos.x + firstPos.w / 2;
            merged.push({
              ...el,
              text: combinedText,
              position: {
                x: firstPos.x,
                y: firstPos.y,
                w: firstPos.w,
                h: (lastPos.y + lastPos.h) - firstPos.y,
              },
              _merged: true,
              _mergedCenterX: centerX,
            });
            i = j;
            continue;
          }
        }
      }
      merged.push(el);
      i++;
    }

    return { background, elements: merged, placeholders, errors };
  });
}

/**
 * v2: Inject brand CSS into page before extracting slide data
 * This enables lightweight HTML authoring without heavy inline CSS
 */
async function injectBrandCSS(page) {
  await page.evaluate((css) => {
    const style = document.createElement('style');
    style.id = 'brand-injection-v2';
    style.textContent = css;
    // Insert at beginning of head so it can be overridden by page styles
    document.head.insertBefore(style, document.head.firstChild);
  }, brandCSS);
}

/**
 * v2.1: Replace non-brand colors with closest McKinsey palette match.
 * Uses mckinsey.json as single source of truth via branding.mjs exports.
 * @param {Page} page - Playwright page object
 * @returns {Promise<{count: number, replacements: Array<{original: string, replacement: string}>}>}
 */
async function replaceNonBrandColors(page) {
  const branding = getBranding();

  // Build allowed colors list from branding config (single source of truth)
  const allowedColors = new Set();

  // Add all colors from the branding config color sections
  const colorSections = ['primary', 'secondary', 'gray', 'semantic', 'accent', 'text', 'background'];
  for (const section of colorSections) {
    const sectionColors = branding.colors[section];
    if (sectionColors) {
      for (const color of Object.values(sectionColors)) {
        allowedColors.add(color.toUpperCase());
      }
    }
  }

  // Add chart color sequence
  const chartColors = getChartColors();
  for (const color of chartColors) {
    allowedColors.add(color.toUpperCase());
  }

  // Also allow pure white/black/transparent
  allowedColors.add('#FFFFFF');
  allowedColors.add('#000000');

  const allowedArray = Array.from(allowedColors);

  const replacements = await page.evaluate(({ allowed }) => {
    // Helper: Parse hex to RGB
    function hexToRgb(hex) {
      const h = hex.replace('#', '');
      return {
        r: parseInt(h.substring(0, 2), 16),
        g: parseInt(h.substring(2, 4), 16),
        b: parseInt(h.substring(4, 6), 16)
      };
    }

    // Helper: Calculate color distance (Euclidean in RGB space)
    function colorDistance(c1, c2) {
      const rgb1 = hexToRgb(c1);
      const rgb2 = hexToRgb(c2);
      return Math.sqrt(
        Math.pow(rgb1.r - rgb2.r, 2) +
        Math.pow(rgb1.g - rgb2.g, 2) +
        Math.pow(rgb1.b - rgb2.b, 2)
      );
    }

    // Helper: Find closest allowed color
    function findClosestColor(targetColor, allowedColors) {
      let closest = allowedColors[0];
      let minDistance = Infinity;

      for (const color of allowedColors) {
        const dist = colorDistance(targetColor, color);
        if (dist < minDistance) {
          minDistance = dist;
          closest = color;
        }
      }

      return closest;
    }

    const replaced = [];

    document.querySelectorAll('[style]').forEach(el => {
      const style = el.getAttribute('style');
      const hexPattern = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g;
      let newStyle = style;
      let match;

      while ((match = hexPattern.exec(style)) !== null) {
        const color = match[0].toUpperCase();
        // Normalize 3-char hex to 6-char
        const normalizedColor = color.length === 4
          ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
          : color;

        if (!allowed.includes(normalizedColor)) {
          const closestColor = findClosestColor(normalizedColor, allowed);
          newStyle = newStyle.replace(match[0], closestColor);
          replaced.push({ original: match[0], replacement: closestColor });
        }
      }

      if (newStyle !== style) {
        el.setAttribute('style', newStyle);
      }
    });

    // Also scan SVG presentation attributes (fill, stroke)
    document.querySelectorAll('svg [fill], svg [stroke]').forEach(el => {
      ['fill', 'stroke'].forEach(attr => {
        const val = el.getAttribute(attr);
        if (!val || val === 'none' || val === 'transparent' || val === 'white'
            || val === 'black' || val.startsWith('url(') || val.startsWith('var(')) return;

        const color = val.trim().toUpperCase();
        const normalizedColor = color.length === 4
          ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
          : color;

        if (normalizedColor.startsWith('#') && !allowed.includes(normalizedColor)) {
          const closestColor = findClosestColor(normalizedColor, allowed);
          el.setAttribute(attr, closestColor);
          replaced.push({ original: val, replacement: closestColor });
        }
      });
    });

    return replaced;
  }, { allowed: allowedArray });

  // Log per-occurrence warnings
  for (const { original, replacement } of replacements) {
    console.warn(`  [color] Replaced ${original} → ${replacement}`);
  }

  // Prominent summary if any replacements occurred
  if (replacements.length > 0) {
    const uniqueOriginals = [...new Set(replacements.map(r => r.original))];
    console.warn(`\n${'═'.repeat(60)}`);
    console.warn(`  WARNING: ${replacements.length} non-brand color(s) were replaced`);
    console.warn(`  Colors found: ${uniqueOriginals.join(', ')}`);
    console.warn(`  To fix: Use var(--brand-*) CSS variables in HTML`);
    console.warn(`  For custom brand: Create branding/{name}.json, use PPTX_BRAND={name}`);
    console.warn(`${'═'.repeat(60)}\n`);

    if (STRICT_MODE) {
      throw new Error(
        `[STRICT] Non-brand colors detected: ${uniqueOriginals.join(', ')}. ` +
        `Use var(--brand-*) CSS variables or create a custom brand config. ` +
        `To bypass: run without PPTX_STRICT=true`
      );
    }
  }

  return { count: replacements.length, replacements };
}

/**
 * Convert an HTML slide file to a PptxGenJS slide with positioned elements.
 *
 * @param {string} htmlFile - Path to the HTML file
 * @param {import('pptxgenjs')} pres - PptxGenJS presentation instance
 * @param {Object} [options]
 * @param {string} [options.tmpDir] - Temp directory for intermediate files
 * @param {Object} [options.slide] - Existing slide to add to (creates new if null)
 * @returns {Promise<{slide: Object, placeholders: Array, tempFiles: string[]}>}
 *   - slide: The PptxGenJS slide object
 *   - placeholders: Array of placeholder positions for chart overlays
 *   - tempFiles: Array of temp file paths — caller MUST call cleanupTempFiles(tempFiles)
 *     AFTER pptx.writeFile() completes (PptxGenJS reads image paths lazily)
 */
async function html2pptx(htmlFile, pres, options = {}) {
  const {
    tmpDir = process.env.TMPDIR || '/tmp',
    slide = null,
    screenshotPath = null  // v5.1: optional path for preview screenshot with charts visible
  } = options;

  try {
    // Auto-detect local Playwright browser installation (installed by preflight_check.sh)
    // Fixes mismatch: PLAYWRIGHT_BROWSERS_PATH=0 installs to node_modules/.local-browsers
    // but without that env var, Playwright looks in ~/.cache/ms-playwright/
    if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
      const localBrowsers = path.join(__dirname, '..', 'node_modules', 'playwright-core', '.local-browsers');
      if (fs.existsSync(localBrowsers)) {
        process.env.PLAYWRIGHT_BROWSERS_PATH = localBrowsers;
      }
    }

    // Try Chrome on macOS first, fall back to bundled Chromium
    let browser;
    try {
      const launchOptions = { env: { TMPDIR: tmpDir } };
      if (process.platform === 'darwin') {
        launchOptions.channel = 'chrome';
      }
      browser = await chromium.launch(launchOptions);
    } catch (chromeError) {
      try {
        // Fallback: launch bundled Chromium without channel
        browser = await chromium.launch({ env: { TMPDIR: tmpDir } });
      } catch (chromiumError) {
        throw new Error(
          'Could not launch browser. Run: PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium\n' +
          `  Chrome error: ${chromeError.message}\n` +
          `  Chromium error: ${chromiumError.message}`
        );
      }
    }

    let bodyDimensions;
    let slideData;
    let contentOverflowErrors;
    let cssSurvivalErrors;
    let chartPNGs = []; // v5.1: hoisted for addChartAnnotations access after browser.close()
    let nativeCharts = []; // v6: hoisted for native chart placement after browser.close()

    const filePath = path.isAbsolute(htmlFile) ? htmlFile : path.join(process.cwd(), htmlFile);
    const validationErrors = [];

    let tempFiles = []; // Track temp files for cleanup

    try {
      const page = await browser.newPage();
      await page.goto(`file://${filePath}`);

      // v2: Inject brand CSS variables and helper classes before processing
      await injectBrandCSS(page);

      // v2.1: Replace any non-brand colors with McKinsey palette
      const colorResult = await replaceNonBrandColors(page);
      if (colorResult.count > 0) {
        console.log(`Replaced ${colorResult.count} non-brand color(s) with McKinsey palette`);
      }

      // v3.5: Tier 3 (semantic) color usage detection — warn at runtime
      const htmlContentForTier3 = fs.readFileSync(filePath, 'utf-8');
      const tier3Vars = ['--brand-negative', '--brand-warning', '--brand-positive'];
      const tier3Found = [];
      for (const varName of tier3Vars) {
        const escaped = varName.replace(/-/g, '\\-');
        const matches = htmlContentForTier3.match(new RegExp(escaped, 'g'));
        if (matches) tier3Found.push({ name: varName, count: matches.length });
      }
      if (tier3Found.length > 0) {
        console.warn(`\n${'═'.repeat(60)}`);
        console.warn(`  [color-tier] Tier 3 RESTRICTED color(s) detected:`);
        tier3Found.forEach(({ name, count }) => {
          console.warn(`    ${name}: ${count} occurrence(s)`);
        });
        console.warn(`  Tier 3 = status/sentiment ONLY. Not for decoration or badges.`);
        console.warn(`  If inspiration doesn't show these colors, replace with Tier 1.`);
        console.warn(`${'═'.repeat(60)}\n`);
      }

      // Pre-render ECharts elements to SVG and inject back into page
      const chartConfigs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('[data-echarts]')).map((el, i) => {
          const rect = el.getBoundingClientRect();
          const raw = el.getAttribute('data-echarts');
          // v6: Stamp each element with its original index for reliable lookup
          // after native chart elements are removed from DOM
          el.setAttribute('data-chart-index', String(i));
          let config;
          let parseError = null;
          try {
            config = JSON.parse(raw);
          } catch (e) {
            parseError = { message: e.message, preview: raw.substring(0, 200) };
            config = null;
          }
          return {
            index: i,
            config,
            parseError,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            // v6: Capture position for native chart placement
            x: rect.x,
            y: rect.y
          };
        });
      });

      // Check for JSON parse errors
      const parseErrors = chartConfigs.filter(c => c.parseError);
      if (parseErrors.length > 0) {
        parseErrors.forEach(c => {
          validationErrors.push(
            `ECharts config #${c.index} is not valid JSON: ${c.parseError.message}\n` +
            `  Config preview: ${c.parseError.preview}...\n` +
            `  Common causes: JavaScript functions (use pre-calculated values), trailing commas, unquoted keys`
          );
        });
      }

      // Render each chart to SVG and convert to PNG for PPTX compatibility
      // chartPNGs is declared in outer scope (line ~2318) for addChartAnnotations access
      const chartMetas = []; // C1: Collect chart metadata for CSS variable injection
      // nativeCharts declared in outer scope (v6) for native chart placement after browser.close()
      const validCharts = chartConfigs.filter(c => !c.parseError);
      if (validCharts.length > 0) {
        console.log(`[html2pptx] Found ${validCharts.length} ECharts chart(s) to render`);
      }
      for (const chart of chartConfigs) {
        // Skip charts with parse errors (already reported above)
        if (chart.parseError) continue;

        try {
          // Summarize what the chart contains
          const seriesTypes = (chart.config.series || []).map(s => s.type).join(', ');
          const dataCount = (chart.config.series || []).reduce((sum, s) => sum + (s.data || []).length, 0);
          console.log(`[html2pptx] Rendering chart #${chart.index}: ${chart.width}x${chart.height}px, series=[${seriesTypes}], ${dataCount} data points`);

          // Validate and apply safe defaults
          const chartWarnings = validateChartConfig(chart.config, chart.index);
          chartWarnings.forEach(w => console.log(`[html2pptx] WARNING: ${w}`));

          // Capture original grid values before applySafeChartDefaults mutates them
          chart.originalContainLabel = chart.config.grid?.containLabel;
          chart.originalGridBottom = typeof chart.config.grid?.bottom === 'number'
            ? chart.config.grid.bottom : 0;
          chart.originalGridTop = typeof chart.config.grid?.top === 'number'
            ? chart.config.grid.top : 0;

          applySafeChartDefaults(chart.config);

          // v6: Try native PptxGenJS chart translation (skip if PPTX_NATIVE_CHARTS=off)
          const nativeResult = process.env.PPTX_NATIVE_CHARTS !== 'off'
            ? translateChart(chart.config, pres, { width: chart.width, height: chart.height })
            : null;
          if (nativeResult) {
            console.log(`  [native-chart] Chart #${chart.index}: using native ${nativeResult.isCombo ? 'COMBO' : (typeof nativeResult.chartType === 'string' ? nativeResult.chartType.toUpperCase() : 'CHART')}`);

            // If chart has annotations, render annotation-only overlay PNG
            let annotations = null;       // text annotations (pills/callout boxes)
            let annotationPngPath = null;  // full annotation overlay PNG
            let overlayDataLabels = null;  // v7: extracted data label text elements
            if (nativeResult.hasAnnotations && !nativeResult.waterfallMeta) {
              try {
                // Create annotation-only config (hides data, keeps markLine/markPoint/labels/graphic)
                // Skip for waterfall with waterfallMeta — labels/lines rendered as computed shapes
                const overlayConfig = createAnnotationOverlayConfig(chart.config);

                // Align overlay grid with native chart's MARGIN_SCALE'd layout.
                // PptxGenJS uses layoutTarget="inner" and renders axis labels outside the plot area,
                // so extractLayout() applies MARGIN_SCALE=0.5 to left/right/bottom margins.
                // The overlay must use the same scaled grid so markLine/labels align with native bars.
                // Align overlay grid with native chart's layout scaling.
                // Uses the same formula as extractLayout(): subtract a fixed label reserve
                // from each margin, capped at 50%. Chart-agnostic — large margins retain
                // more of their value, small margins stay near 0.5.
                // Skip when chart has hidden labels (skipMarginScale) — no label space to compensate.
                if (!nativeResult.skipMarginScale) {
                  const PPTX_LABEL_RESERVE = 10;
                  const marginScale = (m) => Math.max(1 - PPTX_LABEL_RESERVE / Math.max(m, 1), 0.5);
                  if (overlayConfig.grid && !Array.isArray(overlayConfig.grid)) {
                    const g = overlayConfig.grid;
                    if (typeof g.left === 'number') g.left = Math.round(g.left * marginScale(g.left));
                    if (typeof g.right === 'number') g.right = Math.round(g.right * marginScale(g.right));
                    if (typeof g.bottom === 'number') g.bottom = Math.round(g.bottom * marginScale(g.bottom));
                    // top stays as-is (legend/title padding, not axis label space)
                  }
                }

                const { svg } = renderEChartsToSVG(overlayConfig, chart.width, chart.height);

                if (svg && svg.length > 50 && svg.includes('<svg')) {
                  // v7: Extract ALL text elements as data labels for native text box placement
                  // v8: Skip when OOXML <c:dLbl> injection handles data labels natively
                  if (!nativeResult.nativeLabels?.length) {
                    const dataLabels = parseOverlayDataLabels(svg);
                    if (dataLabels.length > 0) {
                      overlayDataLabels = dataLabels;
                    }
                  }

                  // v7: Strip text from SVG — data labels become native text boxes.
                  // Only render the remaining graphical elements (lines, shapes) to PNG.
                  const svgWithoutText = stripAllTextsFromSVG(svg);
                  const hasGraphics = svgHasNonTextGraphics(svgWithoutText);

                  if (hasGraphics) {
                    // Render text-stripped SVG to transparent PNG (shapes/lines only)
                    const overlayPng = await sharp(Buffer.from(svgWithoutText))
                      .resize(chart.width * 2, chart.height * 2)
                      .png()
                      .toBuffer();

                    const overlayPath = path.join(tmpDir, `annotation_overlay_${Date.now()}_${chart.index}.png`);
                    fs.writeFileSync(overlayPath, overlayPng);
                    tempFiles.push(overlayPath);
                    annotationPngPath = overlayPath;
                  } else if (dataLabels.length > 0) {
                    // overlay contained only text — no PNG needed
                  } else {
                    // No text extracted and no graphics — render full SVG as before
                    const overlayPng = await sharp(Buffer.from(svg))
                      .resize(chart.width * 2, chart.height * 2)
                      .png()
                      .toBuffer();

                    const overlayPath = path.join(tmpDir, `annotation_overlay_${Date.now()}_${chart.index}.png`);
                    fs.writeFileSync(overlayPath, overlayPng);
                    tempFiles.push(overlayPath);
                    annotationPngPath = overlayPath;
                  }
                }

                // Also extract text annotations for native text boxes (pills, callout boxes)
                const { groups } = parseChartAnnotations(svg);
                if (groups.length > 0) annotations = groups;
              } catch (e) {
                console.warn(`  [native-chart] Annotation overlay failed: ${e.message}`);
              }
            }

            nativeCharts.push({
              index: chart.index,
              result: nativeResult,
              width: chart.width,
              height: chart.height,
              x: chart.x,
              y: chart.y,
              annotations,
              annotationPngPath,
              overlayDataLabels,  // v7: extracted text elements for native text boxes
              nativeLabels: nativeResult.nativeLabels,  // v8: per-item labels for OOXML injection
              rawCategoryLabels: nativeResult.rawCategoryLabels,
              axisLabelStyle: nativeResult.axisLabelStyle,
              originalContainLabel: chart.originalContainLabel,
              originalGridBottom: chart.originalGridBottom,
              originalGridTop: chart.originalGridTop,
              overlayGrid: {
                left: chart.config.grid?.left || 0,
                right: chart.config.grid?.right || 0,
                top: chart.config.grid?.top || 0,
                bottom: chart.config.grid?.bottom || 0,
              },
              config: chart.config,  // Full ECharts config for bar-width alignment
            });
            continue; // Skip SVG → PNG pipeline for this chart
          }

          const { svg, logs, chartMeta } = renderEChartsToSVG(chart.config, chart.width, chart.height);

          // Validate SVG output — catch empty/invalid drawings before PNG conversion
          if (!svg || svg.length < 50 || !svg.includes('<svg')) {
            validationErrors.push(
              `ECharts chart #${chart.index}: produced empty/invalid SVG (${svg ? svg.length : 0} bytes).\n` +
              `  Check your data-echarts config — series may be empty or config may be invalid.`
            );
            continue;
          }

          // Print renderer debug logs (ECharts version, axis-break decisions, etc.)
          if (logs) {
            for (const line of logs.split('\n')) {
              // Skip the raw JSON metadata line (already parsed into chartMeta)
              if (line.includes('__chartMeta')) continue;
              if (line.trim()) console.log(`  ${line}`);
            }
          }

          // v5.1: Parse annotation texts from SVG for native PPTX text extraction
          const { groups: annotationGroups, annotationTransforms } = parseChartAnnotations(svg);

          // v5.1: Strip only annotation texts from SVG (shapes/lines/labels stay rasterized)
          let svgForPng = svg;
          if (annotationGroups.length > 0) {
            svgForPng = stripAnnotationTextsFromSVG(svg, annotationTransforms);
            const totalTexts = annotationGroups.reduce((sum, g) => sum + g.texts.length, 0);
            console.log(`  [chart-annotations] Found ${annotationGroups.length} annotation(s) with ${totalTexts} text line(s) — will extract as native PPTX text`);
          }

          // Convert SVG to PNG using sharp
          // If grid-auto compensation was applied, render at effective (larger) height then crop
          let pngBuffer;
          try {
            const renderHeight = chartMeta?.effectiveHeight || chart.height;
            pngBuffer = await sharp(Buffer.from(svgForPng))
              .resize(chart.width * 2, renderHeight * 2) // 2x for better quality
              .png()
              .toBuffer();

            // Crop to original dimensions if chart was enlarged for grid-auto compensation
            if (chartMeta && chartMeta.bottomDelta > 0) {
              console.log(`  [grid-compensate] Cropping ${chartMeta.bottomDelta}px excess bottom margin (${renderHeight} → ${chart.height}px)`);
              pngBuffer = await sharp(pngBuffer)
                .extract({ left: 0, top: 0, width: chart.width * 2, height: chart.height * 2 })
                .png()
                .toBuffer();
            }
          } catch (sharpError) {
            validationErrors.push(
              `ECharts chart #${chart.index}: PNG conversion failed - ${sharpError.message}\n` +
              `  This may indicate an invalid SVG was generated. Check your ECharts config.`
            );
            continue; // Skip this chart but continue with others
          }

          // Write PNG to temp file (PptxGenJS needs file paths, not data URLs)
          const tempPngPath = path.join(tmpDir, `echarts_${Date.now()}_${chart.index}.png`);
          fs.writeFileSync(tempPngPath, pngBuffer);
          tempFiles.push(tempPngPath);

          chartPNGs.push({
            index: chart.index,
            pngPath: tempPngPath,
            width: chart.width,
            height: chart.height,
            annotations: annotationGroups.length > 0 ? annotationGroups : null  // v5.1
          });
          // C1: Store chart metadata for CSS variable injection
          if (chartMeta) {
            chartMetas.push({ index: chart.index, meta: chartMeta, width: chart.width });
          }
          console.log(`[html2pptx] Chart #${chart.index} rendered successfully (SVG ${svg.length} bytes → PNG)`);
        } catch (e) {
          validationErrors.push(`ECharts rendering failed for chart ${chart.index}: ${e.message}`);
        }
      }

      // v6: Remove native chart elements from DOM (they'll be added as PptxGenJS charts later)
      // Native chart elements are removed from the DOM. HTML overlays (callout boxes,
      // legends) that use position:absolute inside the chart wrapper are tagged with
      // data-chart-overlay and placed AFTER the chart in PPTX for correct z-ordering.
      if (nativeCharts.length > 0) {
        const nativeIndices = nativeCharts.map(nc => nc.index);
        await page.evaluate((indices) => {
          const elements = document.querySelectorAll('[data-echarts]');
          const toRemove = [];
          elements.forEach((el, i) => {
            if (indices.includes(i)) toRemove.push(el);
          });
          toRemove.forEach(el => {
            const spacer = document.createElement('div');
            const cs = window.getComputedStyle(el);
            spacer.style.width = el.style.width || el.offsetWidth + 'px';
            spacer.style.height = el.style.height || el.offsetHeight + 'px';
            spacer.style.position = cs.position;
            spacer.style.left = cs.left;
            spacer.style.top = cs.top;
            spacer.style.margin = cs.margin;
            spacer.style.display = cs.display;
            spacer.style.boxSizing = cs.boxSizing;
            spacer.style.overflow = 'hidden';
            spacer.style.visibility = 'hidden';
            spacer.setAttribute('data-native-chart', 'true');
            spacer.setAttribute('data-chart-index', el.getAttribute('data-chart-index'));
            el.parentNode.replaceChild(spacer, el);
          });
        }, nativeIndices);
        console.log(`[html2pptx] ${nativeCharts.length} chart(s) will use native PptxGenJS rendering`);

        // Render native chart preview PNGs (for HTML screenshot only)
        for (const nc of nativeCharts) {
          const chart = chartConfigs.find(c => c.index === nc.index);
          if (!chart?.config) continue;
          try {
            const { svg, chartMeta: previewMeta } = renderEChartsToSVG(chart.config, nc.width, nc.height);
            if (svg && svg.length > 50) {
              const previewPng = await sharp(Buffer.from(svg))
                .resize(nc.width * 2, nc.height * 2)
                .png()
                .toBuffer();
              const previewPath = path.join(tmpDir, `native_preview_${Date.now()}_${nc.index}.png`);
              fs.writeFileSync(previewPath, previewPng);
              tempFiles.push(previewPath);
              nc.previewPngPath = previewPath;
            }
            // v9: Capture resolved plot area for accurate PptxGenJS layout override
            if (previewMeta?.resolvedPlotArea) {
              nc.resolvedPlotArea = previewMeta.resolvedPlotArea;
            }
          } catch (e) {
            console.warn(`  [native-chart] Chart #${nc.index}: preview PNG render failed: ${e.message}`);
          }
        }
      }

      // Inject PNGs back into page as images
      // Skip PNG injection for native charts — they use addChart() instead
      const nativeIndicesSet = new Set(nativeCharts.map(nc => nc.index));
      if (chartPNGs.length > 0) {
        await page.evaluate(({ pngs, nativeIdxs }) => {
          const skipSet = new Set(nativeIdxs);
          pngs.forEach(({ index, pngPath, width, height }) => {
            if (skipSet.has(index)) return; // native chart handles this
            // v6: Use data-chart-index for reliable lookup after native chart removal
            const el = document.querySelector(`[data-chart-index="${index}"]`);
            if (!el) return;

            // Create img with file path (will be resolved later)
            const img = document.createElement('img');
            img.src = pngPath;
            img.setAttribute('data-echarts-png', 'true');
            // v6: Preserve chart index for downstream lookups
            img.setAttribute('data-chart-index', String(index));

            // Copy positioning styles
            const computed = window.getComputedStyle(el);
            img.style.position = computed.position;
            img.style.left = computed.left;
            img.style.top = computed.top;
            img.style.width = width + 'px';
            img.style.height = height + 'px';

            el.parentNode.replaceChild(img, el);
          });
        }, { pngs: chartPNGs, nativeIdxs: [...nativeIndicesSet] });

        // Verify all chart images were injected successfully
        const injectedCount = await page.evaluate(() =>
          document.querySelectorAll('img[data-echarts-png]').length
        );
        if (injectedCount !== chartPNGs.length) {
          console.warn(`  [CHART-INJECT] WARNING: Expected ${chartPNGs.length} chart image(s) but only ${injectedCount} injected into DOM.`);
        }
      }

      // C1: Inject chart grid values as CSS custom properties for HTML alignment
      if (chartMetas.length > 0) {
        await page.evaluate((metas) => {
          const style = document.documentElement.style;
          metas.forEach(({ index, meta, width }) => {
            if (meta.grid) {
              const g = meta.grid;
              style.setProperty(`--chart-${index}-grid-left`, `${g.left}px`);
              style.setProperty(`--chart-${index}-grid-left-pct`, `${(g.left / width * 100).toFixed(1)}%`);
              style.setProperty(`--chart-${index}-grid-right`, `${g.right}px`);
              style.setProperty(`--chart-${index}-grid-right-pct`, `${(g.right / width * 100).toFixed(1)}%`);
              style.setProperty(`--chart-${index}-grid-top`, `${g.top}px`);
              style.setProperty(`--chart-${index}-grid-bottom`, `${g.bottom}px`);
            }
          });

          // v4.6.1: Inject resolved graphic coordinates as scoped CSS variables
          metas.forEach(({ index, meta }) => {
            if (meta.resolvedGraphicCoords && meta.resolvedGraphicCoords.length > 0) {
              // v6: Use data-chart-index for reliable lookup after native chart removal
              const chartEl = document.querySelector(`img[data-echarts-png][data-chart-index="${index}"]`)
                            || document.querySelector(`[data-chart-index="${index}"]`);
              const parent = chartEl ? (chartEl.closest('[style*="position: relative"]') || chartEl.parentElement) : null;
              if (parent) {
                meta.resolvedGraphicCoords.forEach((gc, gi) => {
                  parent.style.setProperty(`--gfx-${gi}-x`, `${gc.pixel.x}px`);
                  parent.style.setProperty(`--gfx-${gi}-y`, `${gc.pixel.y}px`);
                  if (gc.rect) {
                    parent.style.setProperty(`--gfx-${gi}-w`, `${gc.rect.width}px`);
                    parent.style.setProperty(`--gfx-${gi}-h`, `${gc.rect.height}px`);
                    parent.style.setProperty(`--gfx-${gi}-ox`, `${gc.rect.offsetX}px`);
                    parent.style.setProperty(`--gfx-${gi}-oy`, `${gc.rect.offsetY}px`);
                  }
                });
              }
            }
          });
        }, chartMetas);
      }

      // --- Inline SVG Rasterization ---
      // Collect all <svg> elements, resolve CSS variables, rasterize to PNG, inject back as <img>
      const svgElements = await page.evaluate(() => {
        const svgs = Array.from(document.querySelectorAll('svg'));
        return svgs.map((svg, i) => {
          const rect = svg.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return null;

          // Get computed styles to resolve CSS variables used in SVG fills/strokes
          const computedStyle = window.getComputedStyle(svg);

          // Build a map of CSS variable values from the document root and svg context
          const cssVarMap = {};
          const rootStyle = window.getComputedStyle(document.documentElement);
          const bodyStyle = window.getComputedStyle(document.body);
          // Collect all --brand-* variables
          for (const sheet of document.styleSheets) {
            try {
              for (const rule of sheet.cssRules) {
                if (rule.style) {
                  for (let j = 0; j < rule.style.length; j++) {
                    const prop = rule.style[j];
                    if (prop.startsWith('--')) {
                      // Resolve the variable value from computed style
                      const resolved = rootStyle.getPropertyValue(prop).trim() || bodyStyle.getPropertyValue(prop).trim();
                      if (resolved) cssVarMap[prop] = resolved;
                    }
                  }
                }
              }
            } catch (e) { /* cross-origin stylesheet */ }
          }

          // Get the SVG outerHTML
          let svgHTML = svg.outerHTML;

          // Replace all var(--xxx) references with resolved values
          svgHTML = svgHTML.replace(/var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,\s*([^)]+))?\)/g, (match, varName, fallback) => {
            return cssVarMap[varName] || fallback || match;
          });

          // Ensure SVG has xmlns for standalone rendering
          if (!svgHTML.includes('xmlns=')) {
            svgHTML = svgHTML.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
          }

          // Always set explicit pixel width/height for standalone rasterization.
          // Remove any % or pt-based width/height from style, and set XML attributes.
          svgHTML = svgHTML.replace(/(<svg[^>]*)\bwidth\s*=\s*"[^"]*"/i, '$1');
          svgHTML = svgHTML.replace(/(<svg[^>]*)\bheight\s*=\s*"[^"]*"/i, '$1');
          // Remove width/height from inline style (e.g., style="width: 100%; height: 100%")
          svgHTML = svgHTML.replace(/(<svg[^>]*style="[^"]*?)width\s*:\s*[^;"]+;?/gi, '$1');
          svgHTML = svgHTML.replace(/(<svg[^>]*style="[^"]*?)height\s*:\s*[^;"]+;?/gi, '$1');
          svgHTML = svgHTML.replace('<svg', `<svg width="${Math.round(rect.width)}" height="${Math.round(rect.height)}"`);
          // Ensure viewBox is set for proper scaling
          if (!svgHTML.includes('viewBox')) {
            svgHTML = svgHTML.replace('<svg', `<svg viewBox="0 0 ${Math.round(rect.width)} ${Math.round(rect.height)}"`);
          }

          // Copy positioning from computed style (including margins for layout fidelity)
          const position = computedStyle.position;
          const left = computedStyle.left;
          const top = computedStyle.top;
          const marginLeft = computedStyle.marginLeft;
          const marginTop = computedStyle.marginTop;
          const marginRight = computedStyle.marginRight;
          const marginBottom = computedStyle.marginBottom;

          return {
            index: i,
            svgHTML,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            position,
            left,
            top,
            marginLeft, marginTop, marginRight, marginBottom
          };
        }).filter(Boolean);
      });

      // Rasterize SVGs to PNG and inject back
      const svgPNGs = [];
      if (svgElements.length > 0) {
        console.log(`[html2pptx] Found ${svgElements.length} inline SVG(s) to rasterize`);
      }
      for (const svg of svgElements) {
        try {
          // Cap scale factor so rasterized PNG stays under Sharp's 32767px limit
          const MAX_PX = 32000; // leave margin below 32767
          let scale = 2; // default 2x for crisp output
          if (svg.width * scale > MAX_PX || svg.height * scale > MAX_PX) {
            scale = Math.min(MAX_PX / svg.width, MAX_PX / svg.height);
            console.log(`[html2pptx] SVG #${svg.index}: capping scale to ${scale.toFixed(2)}x (${svg.width}x${svg.height}px)`);
          }
          const pngBuffer = await sharp(Buffer.from(svg.svgHTML))
            .resize(Math.round(svg.width * scale), Math.round(svg.height * scale))
            .png()
            .toBuffer();

          const tempPngPath = path.join(tmpDir, `svg_${Date.now()}_${svg.index}.png`);
          fs.writeFileSync(tempPngPath, pngBuffer);
          tempFiles.push(tempPngPath);

          svgPNGs.push({
            index: svg.index,
            pngPath: tempPngPath,
            width: svg.width,
            height: svg.height,
            position: svg.position,
            left: svg.left,
            top: svg.top,
            marginLeft: svg.marginLeft,
            marginTop: svg.marginTop,
            marginRight: svg.marginRight,
            marginBottom: svg.marginBottom
          });
          console.log(`[html2pptx] SVG #${svg.index} rasterized (${svg.width}x${svg.height}px -> PNG)`);
        } catch (e) {
          console.warn(`[html2pptx] WARNING: SVG #${svg.index} rasterization failed: ${e.message}`);
        }
      }

      // Inject SVG PNGs back into page as images
      if (svgPNGs.length > 0) {
        await page.evaluate((pngs) => {
          const svgs = document.querySelectorAll('svg');
          pngs.forEach(({ index, pngPath, width, height, position, left, top,
                         marginLeft, marginTop, marginRight, marginBottom }) => {
            const svg = svgs[index];
            if (!svg) return;

            const img = document.createElement('img');
            img.src = pngPath;
            img.setAttribute('data-svg-png', 'true');
            img.style.position = position;
            img.style.left = left;
            img.style.top = top;
            img.style.width = width + 'px';
            img.style.height = height + 'px';
            img.style.display = 'block';
            // Preserve margins so getBoundingClientRect() returns the correct position
            if (marginLeft && marginLeft !== '0px') img.style.marginLeft = marginLeft;
            if (marginTop && marginTop !== '0px') img.style.marginTop = marginTop;
            if (marginRight && marginRight !== '0px') img.style.marginRight = marginRight;
            if (marginBottom && marginBottom !== '0px') img.style.marginBottom = marginBottom;

            svg.parentNode.replaceChild(img, svg);
          });
        }, svgPNGs);
      }

      // Tag HTML elements that should render ON TOP of native charts
      // Only foreground elements (z-index > 0) go on top; background elements
      // (z-index: 0 or auto, e.g. highlight zones) stay behind the chart.
      if (nativeCharts.length > 0) {
        await page.evaluate(() => {
          document.querySelectorAll('[data-native-chart]').forEach(spacer => {
            const parent = spacer.parentElement;
            if (!parent) return;
            for (const child of parent.children) {
              if (child === spacer) continue;
              if (child.hasAttribute('data-native-chart')) continue;
              const cs = window.getComputedStyle(child);
              const pos = cs.position;
              if (pos === 'absolute' || pos === 'fixed') {
                const zIndex = parseInt(cs.zIndex);
                // Only mark as overlay if z-index is explicitly positive (foreground)
                if (zIndex > 0) {
                  child.setAttribute('data-chart-overlay', 'true');
                  child.querySelectorAll('*').forEach(d => d.setAttribute('data-chart-overlay', 'true'));
                }
              }
            }
          });
        });
      }

      bodyDimensions = await getBodyDimensions(page);

      // v3: Run overlap detection + v4: content-zone overflow (blocking)
      await detectOverlappingElements(page, htmlFile);
      contentOverflowErrors = await checkContentOverflow(page, htmlFile);
      const flexOverflows = await detectFlexCellOverflow(page, htmlFile);  // v3.7: per-cell overflow
      // v4.6.1: Promote significant flex overflow to BLOCKING ERROR
      // Skip when native charts are active — ECharts containers get replaced by PptxGenJS,
      // so their measured overflow doesn't affect the final PPTX output.
      const nativeChartsActive = process.env.PPTX_NATIVE_CHARTS !== 'off';
      if (flexOverflows && flexOverflows.length > 0 && !nativeChartsActive && !process.env.PPTX_SKIP_FLEX_CHECK) {
        const significant = flexOverflows.filter(o => {
          const m = o.match(/overflows by (\d+)px/);
          return m && parseInt(m[1]) > 15;
        });
        if (significant.length > 0) {
          validationErrors.push(
            `[FLEX-OVERFLOW] ${significant.length} flex cell(s) overflow by >15px — text WILL be cropped in PPTX.\n` +
            significant.map(o => `  → ${o}`).join('\n') +
            `\n  FIX: Reduce font-size, shorten text, or restructure layout. Do NOT use flex:1 on chart rows when non-flex siblings contain text.` +
            `\n  NOTE: For chart panels with transparent spacer text, reduce the chart row height instead of shrinking fonts.`
          );
        }
      }

      // B1: Scan for CSS properties that don't survive PPTX conversion
      cssSurvivalErrors = await scanUnsupportedCSS(page, htmlFile);

      // C2: Measure content density (warning only — not blocking)
      await measureContentDensity(page, htmlFile);
      await measureHorizontalFill(page, htmlFile);  // v5.3: horizontal fill (warning)

      // [panel-underfill] — Per-panel vertical fill check
      const panelFills = await page.evaluate(() => {
        const results = [];
        const contentZone = document.querySelector('.content-zone');
        if (!contentZone) return results;

        const flexRows = contentZone.querySelectorAll('[style*="display: flex"], [style*="display:flex"]');
        flexRows.forEach((row, ri) => {
          const style = row.getAttribute('style') || '';
          if (/flex-direction\s*:\s*column/i.test(style)) return;

          Array.from(row.children).forEach((panel, pi) => {
            const panelH = panel.offsetHeight;
            if (panelH < 50) return; // skip tiny elements

            // Measure content height (sum of children heights)
            let contentH = 0;
            Array.from(panel.children).forEach(child => {
              contentH += child.offsetHeight;
            });

            const fillPct = panelH > 0 ? Math.round((contentH / panelH) * 100) : 100;
            if (fillPct < 70) {
              results.push({ row: ri + 1, panel: pi + 1, fill: fillPct, panelH, contentH });
            }
          });
        });
        return results;
      });

      if (panelFills && panelFills.length > 0) {
        panelFills.forEach(({ row, panel, fill, panelH, contentH }) => {
          console.warn(`  [panel-underfill] Row ${row}, Panel ${panel}: content fills only ${fill}% of panel height (${contentH}px content / ${panelH}px panel). Target: 70-95%.`);
        });
      }

      // [font-count] — Detect too many distinct font sizes
      const fontSizeCount = await page.evaluate(() => {
        const sizes = new Set();
        document.querySelectorAll('*').forEach(el => {
          const computed = window.getComputedStyle(el);
          const fs = parseFloat(computed.fontSize);
          if (fs > 0 && el.textContent.trim().length > 0) {
            sizes.add(Math.round(fs * 10) / 10); // round to 1 decimal
          }
        });
        return sizes.size;
      });

      if (fontSizeCount > 4) {
        console.warn(`  [font-count] ${fontSizeCount} distinct font sizes detected on slide (max recommended: 4 — 20px title + 2 body sizes + 9px source).`);
      }

      // [non-brand-color] — Detect non-brand hex colors in inline styles
      {
        const branding = getBranding();
        const brandColors = new Set(['#FFFFFF', '#000000']);

        // Build brand color set from branding config (single source of truth)
        const colorSections = ['primary', 'secondary', 'gray', 'semantic', 'accent', 'text', 'background'];
        for (const section of colorSections) {
          const sectionColors = branding?.colors?.[section];
          if (sectionColors) {
            for (const color of Object.values(sectionColors)) {
              if (typeof color === 'string') brandColors.add(color.toUpperCase());
            }
          }
        }
        // Add chart color sequence
        const chartColors = getChartColors();
        for (const color of chartColors) {
          brandColors.add(color.toUpperCase());
        }

        const brandColorArray = Array.from(brandColors);

        const nonBrandColors = await page.evaluate((allowed) => {
          const allowedSet = new Set(allowed);
          const found = [];
          document.querySelectorAll('[style*="#"]').forEach(el => {
            const style = el.getAttribute('style') || '';
            const hexes = style.match(/#[0-9a-fA-F]{6}\b/g);
            if (hexes) {
              hexes.forEach(hex => {
                const upper = hex.toUpperCase();
                if (!allowedSet.has(upper) && !found.includes(upper)) {
                  found.push(upper);
                }
              });
            }
          });
          return found.slice(0, 5); // limit to first 5 unique
        }, brandColorArray);

        if (nonBrandColors && nonBrandColors.length > 0) {
          console.warn(`  [non-brand-color] ${nonBrandColors.length} non-brand hex color(s) found in inline styles: ${nonBrandColors.join(', ')}. Use var(--brand-*) tokens instead.`);
        }
      }

      await measureAnnotationPositions(page, htmlFile);  // v3.7: annotation placement (warning)

      await page.setViewportSize({
        width: Math.round(bodyDimensions.width),
        height: Math.round(bodyDimensions.height)
      });

      // Temporarily inject native chart preview PNGs for screenshot
      const nativePreviewData = nativeCharts
        .filter(nc => nc.previewPngPath)
        .map(nc => ({ index: nc.index, pngPath: nc.previewPngPath, width: nc.width, height: nc.height }));

      if (nativePreviewData.length > 0) {
        await page.evaluate((previews) => {
          previews.forEach(({ index, pngPath, width, height }) => {
            const spacer = document.querySelector(`[data-native-chart][data-chart-index="${index}"]`);
            if (!spacer) return;
            const img = document.createElement('img');
            img.src = pngPath;
            img.setAttribute('data-native-preview', 'true');
            img.style.width = width + 'px';
            img.style.height = height + 'px';
            img.style.display = 'block';
            spacer.parentNode.insertBefore(img, spacer);
          });
        }, nativePreviewData);
      }

      // Fix B2: Take preview screenshot AFTER viewport resize (correct dimensions)
      if (screenshotPath) {
        try {
          await page.screenshot({ path: screenshotPath, type: 'png' });
          console.log(`  [preview] HTML screenshot: ${screenshotPath}`);
        } catch (e) {
          console.warn(`  [preview] Screenshot failed: ${e.message}`);
        }
      }

      // Remove native chart preview PNGs after screenshot
      if (nativePreviewData.length > 0) {
        await page.evaluate(() => {
          document.querySelectorAll('[data-native-preview]').forEach(el => el.remove());
        });
      }

      slideData = await extractSlideData(page);
    } finally {
      await browser.close();
      // NOTE: Do NOT clean up temp files here — PptxGenJS reads image paths
      // lazily at writeFile() time. Caller must clean up via cleanupTempFiles().
    }

    // v3.4: McKinsey style warnings — table borders, bullet spacing, separator lines
    if (slideData && slideData.elements) {
      // R2: Bullet spacing warning (paragraph-like bullets)
      for (const el of slideData.elements) {
        if (el.type === 'list' && el.style) {
          const marginBottomPt = el.style.paraSpaceAfter || 0;
          const lineSpacingPt = el.style.lineSpacing || 0;
          const fontSizePt = el.style.fontSize || 10;
          const lineHeightRatio = lineSpacingPt > 0 ? (lineSpacingPt / fontSizePt) : 0;
          if (marginBottomPt > 12 || (lineHeightRatio > 1.55 && lineSpacingPt > 0)) {
            console.warn(`  [bullet-style] Bullet spacing is paragraph-like (margin-bottom: ${marginBottomPt.toFixed(1)}pt, line-height ratio: ${lineHeightRatio.toFixed(2)})`);
            console.warn(`    McKinsey: margin-bottom 6-8pt, line-height 1.35-1.45. Fix <li> margin-bottom and line-height in HTML.`);
          }
        }
      }

      // R3: Separator solid line warnings (thin divs with solid borders → auto-fixed to dashed)
      const separatorsFixed = slideData.elements.filter(el => el.type === 'line' && el.separatorAutoFixed);
      if (separatorsFixed.length > 0) {
        console.warn(`  [separator-style] ${separatorsFixed.length} solid separator line(s) auto-fixed to dashed`);
        console.warn(`    McKinsey standard: border-bottom: 1px dashed var(--brand-gray-medium). Fix border-style in HTML.`);
      }

      // R4: Separator margin auto-fix warnings
      const separatorsMarginFixed = slideData.elements.filter(el => el.type === 'line' && el.separatorMarginFixed);
      if (separatorsMarginFixed.length > 0) {
        console.warn(`  [separator-margin] ${separatorsMarginFixed.length} separator(s) had margin < 12pt — auto-fixed`);
        console.warn(`    Fix in HTML: Use margin: 12pt 0 (or larger) on dashed separator divs.`);
      }

      // v3.5: Structural element summary (for cross-version comparison)
      const typeCount = {};
      for (const el of slideData.elements) {
        typeCount[el.type] = (typeCount[el.type] || 0) + 1;
      }
      const structSummary = Object.entries(typeCount).map(([t, c]) => `${c} ${t}(s)`).join(', ');
      console.log(`  [STRUCTURE] PPTX elements: ${structSummary}`);
    }

    // Collect all validation errors
    if (bodyDimensions.errors && bodyDimensions.errors.length > 0) {
      validationErrors.push(...bodyDimensions.errors);
    }

    if (contentOverflowErrors && contentOverflowErrors.length > 0) {
      validationErrors.push(...contentOverflowErrors);
    }

    // B1: CSS survival errors (BLOCKING — these properties produce visible output in browser but nothing in PPTX)
    if (cssSurvivalErrors && cssSurvivalErrors.length > 0) {
      validationErrors.push(...cssSurvivalErrors);
    }

    const dimensionErrors = validateDimensions(bodyDimensions, pres);
    if (dimensionErrors.length > 0) {
      validationErrors.push(...dimensionErrors);
    }

    const textBoxPositionErrors = validateTextBoxPosition(slideData, bodyDimensions);
    if (textBoxPositionErrors.length > 0) {
      validationErrors.push(...textBoxPositionErrors);
    }

    if (slideData.errors && slideData.errors.length > 0) {
      validationErrors.push(...slideData.errors);
    }

    // Throw all errors at once if any exist
    if (validationErrors.length > 0) {
      const errorMessage = validationErrors.length === 1
        ? validationErrors[0]
        : `Multiple validation errors found:\n${validationErrors.map((e, i) => `  ${i + 1}. ${e}`).join('\n')}`;
      throw new Error(errorMessage);
    }

    const targetSlide = slide || pres.addSlide();

    await addBackground(slideData, targetSlide, tmpDir);

    // Split elements: base (behind charts) vs overlays (in front of charts)
    const overlayEls = slideData.elements.filter(e => e.chartOverlay);
    const baseEls = slideData.elements.filter(e => !e.chartOverlay);

    // Align text boxes above native charts to match bar widths
    if (nativeCharts.length > 0) {
      const DPI = 96;
      for (const el of baseEls) {
        // Apply to merged elements AND small text elements (totals above bars)
        const isMerged = !!el._merged;
        const isSmallText = !isMerged && el.text && el.text.length <= 20 && el.position && /\d/.test(el.text);
        if (!isMerged && !isSmallText) continue;
        // Find the native chart this text is positioned above
        for (const nc of nativeCharts) {
          const chartX = nc.x / DPI;
          const chartY = nc.y / DPI;
          const chartW = nc.width / DPI;
          const elBottom = el.position.y + el.position.h;
          // Text is above the chart if its bottom edge is near the chart top
          const isAboveChart = elBottom <= chartY + 0.15 && elBottom >= chartY - 0.3;
          const centerX = isMerged ? el._mergedCenterX : (el.position.x + el.position.w / 2);
          const isHorizontallyOver = centerX >= chartX && centerX <= chartX + chartW;
          if (!isAboveChart || !isHorizontallyOver || !nc.result?.options) continue;

          // Use the native chart's layout to compute bar positions
          const layout = nc.result.options.layout || { x: 0, y: 0, w: 1, h: 1 };
          const plotLeft = chartX + layout.x * chartW;
          const plotWidth = layout.w * chartW;
          const numCats = nc.rawCategoryLabels?.length || nc.result.data?.[0]?.labels?.length || 1;
          const slotWidth = plotWidth / numCats;

          // Get barWidth percentage from ECharts config
          let barWidthPct = 60;
          if (nc.config?.series) {
            for (const s of nc.config.series) {
              if (s.type === 'bar' && s.barWidth) {
                barWidthPct = parseFloat(String(s.barWidth));
                break;
              }
            }
          }
          const barWidth = slotWidth * (barWidthPct / 100);

          // Skip alignment if text already spans multiple bar slots (likely a title/header, not a per-bar label)
          if (el.position.w > slotWidth * 1.5) break;

          // Find which category slot this text's center falls in
          const relX = centerX - plotLeft;
          const catIndex = Math.floor(relX / slotWidth);
          if (catIndex >= 0 && catIndex < numCats) {
            const barCenterX = plotLeft + (catIndex + 0.5) * slotWidth;
            el.position.x = barCenterX - barWidth / 2;
            el.position.w = barWidth;
          }
          break;
        }
      }
    }

    // Add base elements behind native charts
    slideData.elements = baseEls;
    addElements(slideData, targetSlide, pres);

    // v5.1: Add annotation texts as native PPTX text boxes (crisp, selectable)
    if (chartPNGs.length > 0) {
      addChartAnnotations(chartPNGs, slideData, targetSlide, pres);
    }

    // v6: Add native PptxGenJS charts at the captured positions
    if (nativeCharts.length > 0) {
      const DPI = 96; // HTML px to inches conversion
      for (const nc of nativeCharts) {
        const posX = nc.x / DPI;
        const posY = nc.y / DPI;
        const posW = nc.width / DPI;
        const posH = nc.height / DPI;

        try {
          const chartOpts = {
            ...nc.result.options,
            x: posX,
            y: posY,
            w: posW,
            h: posH,
          };

          targetSlide.addChart(nc.result.chartType, nc.result.data, chartOpts);

          // PptxGenJS bug workaround: combo charts set opts._type to the array,
          // but createExcelWorksheet only handles _type === 'scatter' (string).
          // When all combo sub-charts are scatter, patch _type to 'scatter'.
          if (Array.isArray(nc.result.chartType) &&
              nc.result.chartType.every(ct => ct.type === 'scatter')) {
            chartOpts._type = 'scatter';
          }

          // Detect if markLines will be rendered natively (skip overlay for those)
          // Covers both 2-point arrays and single-point objects ({yAxis:N}, {xAxis:N})
          // Only count straight markLines (no curveness) — curved ones can't be drawn
          // natively and must remain in the overlay PNG.
          // Curveness can be set at top-level (markLine.lineStyle.curveness) or per-entry.
          const hasNativeMarkLines = (nc.config?.series || []).some(
            s => s.markLine?.data?.some(d => {
              if (Array.isArray(d) && d.length === 2) {
                // 2-point array: check both top-level and per-entry curveness
                const topCurve = s.markLine?.lineStyle?.curveness;
                const entryCurve = d[0]?.curveness ?? d[1]?.curveness;
                return !topCurve && !entryCurve;
              }
              if (!Array.isArray(d) && typeof d === 'object') {
                return d.yAxis !== undefined || d.xAxis !== undefined || d.coord !== undefined;
              }
              return false;
            })
          );

          // Add annotation overlay PNG (markLines, total labels, graphic overlays)
          // Skip overlay when markLines or $callouts are rendered natively — prevents
          // duplicate pointer lines (ECharts overlay PNG contains its own pointer lines)
          const hasNativeCallouts = !!(nc.result?.savedCallouts?.length);
          // Skip overlay for horizontal bars — catAx line handles zero separator natively
          const skipOverlayForHorizBar = nc.result?.barDir === 'bar';
          // Detect ECharts graphic elements (bracket lines, arrows, text annotations)
          // These can ONLY be rendered via the overlay PNG — force overlay placement.
          // ECharts accepts `graphic` as either an array or a single object.
          const graphicConf = nc.config?.graphic;
          const hasGraphicElements = graphicConf && (
            (Array.isArray(graphicConf) && graphicConf.length > 0) ||
            (!Array.isArray(graphicConf) && typeof graphicConf === 'object')
          );
          // Check if ALL graphic elements are text-only. When true, the text has already
          // been extracted as overlayDataLabels and the overlay PNG only contains redundant
          // markArea/markLine graphics that are rendered natively — skip overlay to avoid doubling.
          const isAllGraphicText = hasGraphicElements && (() => {
            const items = Array.isArray(graphicConf) ? graphicConf : [graphicConf];
            const checkText = (g) => g.type === 'text' ||
              (g.type === 'group' && (g.children || []).every(c => checkText(c)));
            return items.every(g => checkText(g));
          })();
          // Place overlay when no skip conditions apply, OR when non-text graphic elements require it
          const placeOverlayPng = nc.annotationPngPath && (
            (!hasNativeMarkLines && !hasNativeCallouts && !skipOverlayForHorizBar) ||
            (hasGraphicElements && !isAllGraphicText)
          );
          if (placeOverlayPng) {
            targetSlide.addImage({
              path: nc.annotationPngPath,
              x: posX, y: posY, w: posW, h: posH,
            });
            console.log(`  [native-chart] Chart #${nc.index}: annotation overlay image placed${hasGraphicElements ? ' (forced — graphic elements)' : ''}`);
          } else if (nc.annotationPngPath) {
            const reason = skipOverlayForHorizBar ? 'horizontal bar (catAx line)' : (hasNativeMarkLines ? 'markLines' : '$callouts');
            console.log(`  [native-chart] Chart #${nc.index}: overlay PNG skipped — ${reason} rendered natively`);
          }

          // ── Shared chart coordinate setup ──
          // Computed once, used by all annotation rendering blocks (markLines, callouts,
          // waterfall labels, bubble labels, overlay data labels).
          const chartLayout = nc.result?.options?.layout || { x: 0, y: 0, w: 1, h: 1 };
          const plotLeft   = posX + chartLayout.x * posW;
          const plotTop    = posY + chartLayout.y * posH;
          const plotWidth  = chartLayout.w * posW;
          const plotHeight = chartLayout.h * posH;
          const plotRight  = plotLeft + plotWidth;
          const plotBottom = plotTop + plotHeight;
          const brandFont  = (getBranding()?.typography?.families?.data || 'Arial').split(',')[0].trim();

          const xAxisConf = Array.isArray(nc.config?.xAxis) ? nc.config.xAxis[0] : nc.config?.xAxis;
          const yAxisConf = Array.isArray(nc.config?.yAxis) ? nc.config.yAxis[0] : nc.config?.yAxis;
          const nativeOpts = nc.result?.options || {};
          const isHorizBar = nc.result?.barDir === 'bar';

          // Category axis
          const categoryLabels = (xAxisConf?.data || nc.rawCategoryLabels || []).map(String);
          const categoryCount  = categoryLabels.length || 1;
          const slotWidth      = plotWidth / categoryCount;

          // ── Horizontal bar: overlay category axis labels as left-aligned text boxes ──
          // With tickLblPos="low", PowerPoint sizes each label's bounding box to its
          // text width, causing inconsistent left-alignment between single-line and
          // multi-line labels. Fix: hide native labels (tickLblPos="none" in chart XML
          // patch) and add uniformly-positioned text boxes — all share the same X and
          // width, guaranteeing consistent left alignment.
          if (isHorizBar && nc.rawCategoryLabels?.length > 0) {
            const catLabels = nc.rawCategoryLabels;
            const catCount = catLabels.length;
            const slotH = plotHeight / catCount;
            const PT_PER_PX = 0.75;
            const labelFontPt = (nc.axisLabelStyle?.fontSize || 11) * PT_PER_PX;
            const labelColor = (nc.axisLabelStyle?.color || '#333333').replace('#', '');
            const labelBold = nc.axisLabelStyle?.fontWeight === 'bold';

            // Box spans from chart left edge to just before the plot area
            const boxX = posX;
            const boxW = Math.max(plotLeft - posX - 0.03, 0.3); // 0.03" gap before bars

            // Detect inverse (maxMin) orientation — flips category 0 to top
            const horizIsInverse = nativeOpts.catAxisOrientation === 'maxMin';

            for (let i = 0; i < catCount; i++) {
              // PptxGenJS default: category 0 at bottom. With maxMin: category 0 at top.
              const catCenterY = horizIsInverse
                ? plotTop + (i + 0.5) * slotH
                : plotTop + plotHeight - (i + 0.5) * slotH;
              const boxH = Math.min(slotH * 0.95, 0.5); // cap height for readability
              const boxY = catCenterY - boxH / 2;

              targetSlide.addText(catLabels[i].replace(/\n/g, '\n'), {
                x: boxX, y: boxY, w: boxW, h: boxH,
                fontSize: labelFontPt,
                fontFace: brandFont,
                color: labelColor,
                bold: labelBold,
                align: 'left',
                valign: 'middle',
                margin: 0,
                lineSpacingMultiple: 0.7,
              });
            }
            console.log(`  [native-chart] Chart #${nc.index}: added ${catCount} axis label text box(es) for horizontal bar`);
          }

          // Value axis range (prefer native chart options > explicit config > data range)
          let allChartValues = [];
          for (const s of (nc.result?.data || [])) {
            if (s.values) allChartValues.push(...s.values.filter(v => v != null));
          }
          // For stacked charts, compute cumulative totals per category for correct Y range
          const isStacked = nc.config?.series?.some(s => s.stack);
          let effectiveMaxVal = Math.max(...allChartValues, 1);
          if (isStacked && (nc.result?.data?.length || 0) > 1) {
            const numCats = nc.result.data[0]?.values?.length || 0;
            for (let c = 0; c < numCats; c++) {
              let cumSum = 0;
              for (const s of nc.result.data) {
                cumSum += (s.values?.[c] ?? 0);
              }
              effectiveMaxVal = Math.max(effectiveMaxVal, cumSum);
            }
          }
          const yMax = nativeOpts.valAxisMaxVal ?? yAxisConf?.max ?? effectiveMaxVal;
          const yMin = nativeOpts.valAxisMinVal ?? yAxisConf?.min ?? Math.min(...allChartValues, 0);

          // ── PptxGenJS coordinate correction constants ──
          // PptxGenJS with layoutTarget:"inner" adds internal padding within the plot area.
          // These proportional offsets align overlay shapes with native chart elements.
          // Expressed as fractions of chart dimensions → scale for any chart size.
          const chartType = nc.result?.chartType;
          const isAreaChart = chartType === 'area';
          const PPTX_X_PAD     = posW * 0.047;  // rightward shift (aligns with bar centers / data dots)
          const PPTX_Y_PAD     = isAreaChart ? 0.0 : 0.02; // area charts: no Y nudge (tighter fit)
          const PPTX_Y_SCALE   = isAreaChart ? 1.0 : 1.08; // area charts: no Y stretch (exact axis match)
          const PPTX_ARROW_PAD = posW * 0.039;  // extra X shift for arrows and pointer-line tips

          // ── Shared coordinate mappers ──
          // Convert ECharts category/value → PPTX absolute position (inches)
          const getCatX = (catLabel) => {
            const idx = categoryLabels.indexOf(String(catLabel));
            return idx >= 0 ? plotLeft + (idx + 0.5) * slotWidth + PPTX_X_PAD : null;
          };
          const getValY = (val) => {
            if (typeof val !== 'number') return null;
            const ratio = yMax !== yMin ? (val - yMin) / (yMax - yMin) : 0.5;
            return plotTop + plotHeight * (1 - ratio * PPTX_Y_SCALE) + PPTX_Y_PAD;
          };

          // Value-axis X mapper for scatter/bubble/quadrant charts (both axes are value-type)
          // Uses uncorrected mapping (no PPTX_X_PAD) — scatter data points are positioned
          // directly on value axes without the category-axis offset correction.
          const xIsValue = xAxisConf?.type === 'value';
          const xMin = nativeOpts?.catAxisMinVal ?? xAxisConf?.min ?? 0;
          const xMax = nativeOpts?.catAxisMaxVal ?? xAxisConf?.max ?? 100;
          const getValX = xIsValue ? (val) => {
            if (typeof val !== 'number') return null;
            const ratio = xMax !== xMin ? (val - xMin) / (xMax - xMin) : 0.5;
            return plotLeft + plotWidth * ratio;
          } : null;
          // Uncorrected Y mapper for scatter/value-axis charts (no PPTX_Y_SCALE/Y_PAD)
          const getValYDirect = (val) => {
            if (typeof val !== 'number') return null;
            const ratio = yMax !== yMin ? (val - yMin) / (yMax - yMin) : 0.5;
            return plotTop + plotHeight * (1 - ratio);
          };

          // CSS variable resolver (var(--brand-*) → hex)
          const _cssVarCache = (() => {
            const css = generateInjectableCSS();
            const map = {};
            for (const line of css.split('\n')) {
              const mv = line.match(/(--brand-[\w-]+):\s*(.+?)\s*;?\s*$/);
              if (mv) map[mv[1]] = mv[2];
            }
            return map;
          })();
          const resolveCssColor = (c) => {
            if (!c || typeof c !== 'string') return c;
            const m = c.match(/^var\((--brand-[\w-]+)\)$/);
            if (!m) return c;
            return _cssVarCache[m[1]] || '#333333';
          };

          // Add annotation text boxes if present (pills, callout boxes)
          // Always add when annotations exist — the overlay PNG has its text stripped
          // by stripAllTextsFromSVG(), so annotation text must be re-added as native text boxes
          // regardless of whether overlay PNG is placed or markLines are rendered natively.
          // Skip only when $callouts handle annotation text (savedCallouts).
          if (nc.annotations && nc.annotations.length > 0 && !nc.result?.savedCallouts?.length) {
            for (const group of nc.annotations) {
              const { texts, shapeBBox } = group;
              if (texts.length === 0) continue;

              const boxX = posX + (shapeBBox.x / nc.width) * posW;
              const boxY = posY + (shapeBBox.y / nc.height) * posH;
              const boxW = (shapeBBox.w / nc.width) * posW;
              const boxH = (shapeBBox.h / nc.height) * posH;

              const t = texts[0];
              const fontSize = t.fontSize * PT_PER_PX;

              if (texts.length === 1) {
                targetSlide.addText(t.text, {
                  x: boxX, y: boxY, w: boxW, h: boxH,
                  fontSize, fontFace: brandFont,
                  color: (t.fill || '000000').replace('#', ''),
                  bold: t.fontWeight === 'bold',
                  valign: 'middle', align: 'center',
                  margin: 0, inset: 0
                });
              } else {
                const combinedText = texts.map(line => line.text).join('\n');
                targetSlide.addText(combinedText, {
                  x: boxX, y: boxY, w: boxW, h: boxH,
                  fontSize, fontFace: brandFont,
                  color: (t.fill || '000000').replace('#', ''),
                  bold: t.fontWeight === 'bold',
                  valign: 'top', align: 'left',
                  margin: [0.05, 0.06, 0.05, 0.06],
                  lineSpacingMultiple: 1.0,
                  inset: 0
                });
              }
            }
            console.log(`  [native-chart] Chart #${nc.index}: added ${nc.annotations.length} annotation text box(es) — texts: ${nc.annotations.map(g => `"${g.texts.map(t=>t.text).join(' ').substring(0,30)}"`).join(', ')}`);
          }

          // v7: Place overlay data labels as native PPTX text boxes (crisp, selectable, editable).
          // These were extracted from the annotation overlay SVG and stripped from the PNG.
          if (nc.overlayDataLabels && nc.overlayDataLabels.length > 0 && !(nc.nativeLabels?.length > 0)) {
            // Plot-area-aware mapping: ECharts grid defines the plot area within the canvas.
            // SVG label coords are relative to full canvas, but we need to account for
            // the grid margins to correctly position labels over the chart plot area.
            const grid = nc.overlayGrid || { left: 0, right: 0, top: 0, bottom: 0 };
            const parseGridVal = (v) => typeof v === 'number' ? v : (parseFloat(String(v)) || 0);
            const gLeft = parseGridVal(grid.left);
            const gRight = parseGridVal(grid.right);
            const gTop = parseGridVal(grid.top);
            const gBottom = parseGridVal(grid.bottom);

            // Deduplicate: skip labels already present in chart annotations or native markPoints
            const annotationTexts = new Set();
            if (nc.annotations) {
              for (const group of nc.annotations) {
                for (const t of (group.texts || [])) annotationTexts.add(t.text);
              }
            }
            // Also skip markPoint label text rendered natively
            for (const series of (nc.config?.series || [])) {
              for (const mp of (series.markPoint?.data || [])) {
                if (mp.label?.formatter) {
                  // Add each line of multi-line formatter to avoid partial matches
                  annotationTexts.add(mp.label.formatter);
                  for (const line of mp.label.formatter.split('\n')) annotationTexts.add(line.trim());
                }
              }
            }

            // Also skip axis name/title text — ECharts renders these as rotated SVG text
            // which the overlay extractor picks up as horizontal fragments.
            // PptxGenJS renders axis titles natively via catAxisTitle/valAxisTitle.
            if (xAxisConf?.name) {
              annotationTexts.add(xAxisConf.name);
              for (const word of xAxisConf.name.split(/\s+/)) annotationTexts.add(word);
              // Add multi-word substrings (rotated text breaks into fragments)
              for (const line of xAxisConf.name.split('\n')) annotationTexts.add(line.trim());
            }
            if (yAxisConf?.name) {
              annotationTexts.add(yAxisConf.name);
              for (const word of yAxisConf.name.split(/\s+/)) annotationTexts.add(word);
              for (const line of yAxisConf.name.split('\n')) annotationTexts.add(line.trim());
            }

            // Build set of axis labels to filter out (these are already rendered by native chart)
            const axisLabelSet = new Set();
            if (xAxisConf?.data) {
              for (const d of xAxisConf.data) axisLabelSet.add(String(d).trim());
            }
            if (yAxisConf) {
              const yMin = yAxisConf.min ?? 0;
              const yMax = yAxisConf.max ?? 100;
              const interval = yAxisConf.interval ?? ((yMax - yMin) / 5);
              if (interval > 0) {
                for (let v = yMin; v <= yMax + 0.001; v += interval) {
                  axisLabelSet.add(String(Math.round(v * 100) / 100));
                }
              }
            }
            if (xAxisConf?.type === 'value') {
              const xMin = xAxisConf.min ?? 0;
              const xMax = xAxisConf.max ?? 100;
              const xInterval = xAxisConf.interval ?? ((xMax - xMin) / 5);
              if (xInterval > 0) {
                for (let v = xMin; v <= xMax + 0.001; v += xInterval) {
                  axisLabelSet.add(String(Math.round(v * 100) / 100));
                }
              }
            }

            let addedCount = 0;

            for (const label of nc.overlayDataLabels) {
              if (annotationTexts.has(label.text)) continue; // avoid duplicate text boxes
              if (axisLabelSet.has(label.text.trim())) continue; // skip axis labels (native chart renders them)
              const fontSize = label.fontSize * PT_PER_PX;

              // Map SVG pixel coordinates → PPTX inches relative to chart position.
              // Size the box based on text content — short data labels use a compact box,
              // long annotation text (from ECharts graphic elements) uses a wider box.
              const charWidthPt = fontSize * 0.6; // approximate char width at given font size
              const textWidthIn = label.text.length * charWidthPt / 72;
              const boxW = Math.min(Math.max(textWidthIn + 0.1, 0.4), posW * 0.7);
              const boxH = Math.max(fontSize * 1.6 / 72, 0.18);

              // Position based on SVG text anchor — 'start' aligns left from x,
              // 'middle' centers on x, 'end' aligns right to x.
              const svgXInches = posX + (label.x / nc.width) * posW;
              let lX;
              if (label.textAnchor === 'middle') {
                lX = svgXInches - boxW / 2;
              } else if (label.textAnchor === 'end') {
                lX = svgXInches - boxW;
              } else { // 'start' (default)
                lX = svgXInches;
              }
              // SVG y is the text baseline. Offset up by ~1.2× font height to get top of box.
              const lY = posY + ((label.y - label.fontSize * 1.2) / nc.height) * posH;
              const align = label.textAnchor === 'middle' ? 'center' :
                            label.textAnchor === 'end' ? 'right' : 'left';

              // Convert SVG fill to 6-digit hex for PptxGenJS
              let color = svgFillToHex(label.fill || '#333333');

              targetSlide.addText(label.text, {
                x: lX, y: lY, w: boxW, h: boxH,
                fontSize, fontFace: brandFont,
                color,
                bold: label.fontWeight === 'bold',
                italic: label.fontStyle === 'italic',
                valign: 'middle',
                align,
                margin: 0, inset: 0,
              });
              addedCount++;
            }
            if (addedCount > 0) console.log(`  [native-chart] Chart #${nc.index}: added ${addedCount} data label text box(es)`);
          }

          // Waterfall: render labels as text boxes + connectors as dashed lines
          // Positions computed from data values + chart layout → guaranteed alignment.
          // Supports both vertical bars (default) and horizontal bars (wm.isHorizontal).
          if (nc.result?.waterfallMeta) {
            const wm = nc.result.waterfallMeta;
            const wmValMax = wm.yAxisMax;
            const wmValMin = wm.yAxisMin || 0;
            const valRange = wmValMax - wmValMin;
            const wmIsHoriz = !!wm.isHorizontal;

            // Use consistent font size across all waterfall labels (pick the most common)
            const fsCounts = {};
            for (const l of wm.labels) fsCounts[l.fontSize] = (fsCounts[l.fontSize] || 0) + 1;
            const consistentFs = Number(Object.entries(fsCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 10);

            if (wmIsHoriz) {
              // ── HORIZONTAL waterfall: categories on Y-axis, values on X-axis ──
              const catCount = categoryLabels.length || 1;
              const slotH = plotHeight / catCount;
              // catAxisOrientation: 'maxMin' (inverse) flips category 0 to the TOP
              const wmIsInverse = !!wm.isInverse;

              // Place value labels to the right of each bar
              for (const label of wm.labels) {
                // PptxGenJS default: category 0 at bottom. With maxMin: category 0 at top.
                const cy = wmIsInverse
                  ? plotTop + (label.categoryIndex + 0.5) * slotH
                  : plotTop + plotHeight - (label.categoryIndex + 0.5) * slotH;
                const barTopRatio = (label.barTop - wmValMin) / valRange;
                const barTopX = plotLeft + plotWidth * barTopRatio;

                const labelText = label.text;
                const fontSize = consistentFs * PT_PER_PX;
                const boxH = (fontSize * 1.6) / 72;
                const boxW = 0.5;

                const lX = barTopX + 0.04; // right of bar end
                const lY = cy - boxH / 2;

                const color = (label.color === 'white' || label.color === '#FFFFFF' || label.color === '#ffffff')
                  ? svgFillToHex('#333333')
                  : svgFillToHex(label.color || '#333333');

                targetSlide.addText(labelText, {
                  x: lX, y: lY, w: boxW, h: boxH,
                  fontSize, fontFace: brandFont, color,
                  bold: label.fontWeight === 'bold',
                  valign: 'middle',
                  align: 'left',
                  margin: 0, inset: 0,
                });
              }

              // Draw dashed connector lines (vertical, between adjacent bars)
              for (const conn of wm.connectors) {
                const xRatio = (conn.yValue - wmValMin) / valRange;
                const lineX = plotLeft + plotWidth * xRatio;
                const barHalfH = slotH * 0.275;
                // from-bar center to to-bar center (vertical line)
                const fromCY = wmIsInverse
                  ? plotTop + (conn.fromIndex + 0.5) * slotH
                  : plotTop + plotHeight - (conn.fromIndex + 0.5) * slotH;
                const toCY = wmIsInverse
                  ? plotTop + (conn.toIndex + 0.5) * slotH
                  : plotTop + plotHeight - (conn.toIndex + 0.5) * slotH;
                const lineTopY = Math.min(fromCY, toCY) + barHalfH;
                const lineBotY = Math.max(fromCY, toCY) - barHalfH;

                targetSlide.addShape(pres.ShapeType.line, {
                  x: lineX,
                  y: lineTopY,
                  w: 0.001,
                  h: lineBotY - lineTopY,
                  line: { color: '999999', width: 0.75, dashType: 'dash' },
                });
              }
            } else {
              // ── VERTICAL waterfall: categories on X-axis, values on Y-axis ──
              // Place value labels above each bar
              for (const label of wm.labels) {
                const cx = plotLeft + (label.categoryIndex + 0.5) * slotWidth;
                const barTopRatio = (label.barTop - wmValMin) / valRange;
                const barTopY = plotTop + plotHeight * (1 - barTopRatio);

                const labelText = label.text;
                const numLines = (labelText.match(/\n/g) || []).length + 1;

                const fontSize = consistentFs * PT_PER_PX;
                const boxH = (fontSize * 1.6 * numLines) / 72;
                const boxW = Math.max(slotWidth * 0.9, 0.4);

                const lX = cx - boxW / 2;
                const lY = barTopY - boxH - 0.01;

                const color = (label.color === 'white' || label.color === '#FFFFFF' || label.color === '#ffffff')
                  ? svgFillToHex('#333333')
                  : svgFillToHex(label.color || '#333333');

                targetSlide.addText(labelText, {
                  x: lX, y: lY, w: boxW, h: boxH,
                  fontSize, fontFace: brandFont, color,
                  bold: label.fontWeight === 'bold',
                  valign: 'middle',
                  align: 'center',
                  margin: 0, inset: 0,
                });
              }

              // Draw dashed connector lines (horizontal, between adjacent bars)
              for (const conn of wm.connectors) {
                const yRatio = (conn.yValue - wmValMin) / valRange;
                const lineY = plotTop + plotHeight * (1 - yRatio);
                const barHalfWidth = slotWidth * 0.275;
                const lineStartX = plotLeft + (conn.fromIndex + 0.5) * slotWidth + barHalfWidth;
                const lineEndX = plotLeft + (conn.toIndex + 0.5) * slotWidth - barHalfWidth;

                targetSlide.addShape(pres.ShapeType.line, {
                  x: lineStartX,
                  y: lineY,
                  w: lineEndX - lineStartX,
                  h: 0,
                  line: { color: '999999', width: 0.75, dashType: 'dash' },
                });
              }
            }
            console.log(`  [native-chart] Chart #${nc.index}: added ${wm.labels.length} waterfall label text box(es) + ${wm.connectors.length} connector(s) [${wmIsHoriz ? 'horizontal' : 'vertical'}]`);
          }

          // Render $callouts as positioned text boxes over native chart
          if (nc.result?.savedCallouts?.length) {
            const CALLOUT_FONT_SIZE = 6;     // pt: compact text for margin fit
            const CALLOUT_OFFSET    = 0.08;  // inches: push callout boxes right of plotRight
            const CALLOUT_MARGIN    = 0.04;  // inches: gap at container edge
            const containerBottom = posY + posH;

            for (const sc of nc.result.savedCallouts) {
              const seriesData = nc.config?.series?.[sc.seriesIdx]?.data || [];

              for (const callout of sc.callouts) {
                const dataIndex = callout.dataIndex ?? 0;
                const offsetY = (callout.offsetY ?? 0) / PX_PER_IN;

                const rawVal = seriesData[dataIndex];
                const dataValue = typeof rawVal === 'number' ? rawVal : (rawVal?.value ?? callout.value ?? 0);

                const dataPointY = getValY(dataValue) ?? (plotTop + plotHeight * 0.5);
                const dataPointX = plotLeft + (dataIndex + 0.5) * slotWidth;

                const chartLeft = posX;
                const chartRight = posX + posW;

                let calloutX, calloutW;
                if (callout.position === 'right') {
                  calloutX = plotRight + CALLOUT_OFFSET;
                  calloutW = chartRight - calloutX - CALLOUT_MARGIN;
                } else if (callout.position === 'left') {
                  calloutW = plotLeft - chartLeft - CALLOUT_MARGIN;
                  calloutX = chartLeft + CALLOUT_MARGIN;
                } else {
                  calloutW = callout.style?.width ? callout.style.width / PX_PER_IN : 1.5;
                  calloutX = dataPointX - calloutW / 2;
                }
                calloutW = Math.max(calloutW, 0.5);

                // Calculate height based on text wrapping at final width
                const charW = CALLOUT_FONT_SIZE * 0.0068;
                const effectiveW = calloutW - 8 / 72;
                const charsPerLine = Math.max(Math.floor(effectiveW / charW), 8);
                let physicalLines = 0;
                for (const srcLine of (callout.text || '').split('\n')) {
                  physicalLines += Math.max(1, Math.ceil(srcLine.length / charsPerLine));
                }
                const lineH = CALLOUT_FONT_SIZE / 72 * 1.15; // line height matching PPTX rendering
                const marginV = 6 / 72; // vertical margin (3pt top + 3pt bottom)
                const calloutH = Math.max(physicalLines * lineH + marginV + 0.02, 0.25);

                // Vertical position: centered on data point Y + offset
                let calloutY = dataPointY + offsetY - calloutH / 2;

                // Clamp within container boundaries (allows extending below plot into margin)
                if (calloutX + calloutW > chartRight) calloutW = chartRight - calloutX;
                if (calloutX < chartLeft) calloutX = chartLeft;
                if (calloutY + calloutH > containerBottom) calloutY = containerBottom - calloutH;
                if (calloutY < posY) calloutY = posY;

                targetSlide.addText(callout.text || '', {
                  x: calloutX, y: calloutY,
                  w: calloutW, h: calloutH,
                  fontSize: CALLOUT_FONT_SIZE, fontFace: brandFont, color: '333333',
                  valign: 'top', align: 'left',
                  fill: { color: 'FFFFFF' },
                  line: { color: 'BBBBBB', width: 0.5, dashType: 'dash' },
                  margin: [3, 4, 3, 4],
                });

                // Draw dashed pointer line from callout edge to data point dot
                const ptrTargetX = dataPointX + PPTX_ARROW_PAD;
                const ptrTargetY = dataPointY;
                const lineStartX = callout.position === 'right' ? calloutX : calloutX + calloutW;
                const lineStartY = calloutY + calloutH / 2;
                targetSlide.addShape(pres.ShapeType.line, {
                  x: Math.min(ptrTargetX, lineStartX),
                  y: Math.min(ptrTargetY, lineStartY),
                  w: Math.abs(ptrTargetX - lineStartX) || 0.01,
                  h: Math.abs(ptrTargetY - lineStartY) || 0.01,
                  line: { color: 'BBBBBB', width: 0.5, dashType: 'dash' },
                  flipH: ptrTargetX < lineStartX,
                  flipV: ptrTargetY < lineStartY,
                });
              }
            }
            console.log(`  [native-chart] Chart #${nc.index}: added ${nc.result.savedCallouts.reduce((a, c) => a + c.callouts.length, 0)} $callout text box(es)`);
          }

          // Render markLines as native PPTX shapes (dashed lines + arrows + labels)
          // This replaces the overlay PNG approach for markLines, ensuring perfect alignment
          // with native chart bars since both use the same coordinate system.
          // Skip for waterfall charts — connectors are already drawn by waterfallMeta above.
          // Skip when overlay PNG is placed — it already contains the ECharts-rendered markLines.
          let nativeMarkLineCount = 0;
          if (nc.config?.series && !nc.result?.waterfallMeta && !placeOverlayPng) {
            for (const series of nc.config.series) {
              if (!series.markLine?.data?.length) continue;
              const mlStyle = series.markLine.lineStyle || {};
              const defaultColor = svgFillToHex(resolveCssColor(mlStyle.color) || '#999999');
              const defaultDash = mlStyle.type === 'dashed' ? 'dash' : (mlStyle.type === 'dotted' ? 'dot' : 'solid');
              const defaultWidth = mlStyle.width ?? 1;

              for (const mlData of series.markLine.data) {
                // ── Single-point markLines: { yAxis: N } or { xAxis: N } ──
                // These render as horizontal or vertical reference lines across the plot
                if (!Array.isArray(mlData) && typeof mlData === 'object') {
                  // Skip xAxis:0 markLines for horizontal bars — the native catAx line
                  // at autoZero already renders this separator
                  if (isHorizBar && mlData.xAxis === 0) continue;

                  const itemStyle = mlData.lineStyle || {};
                  const color = svgFillToHex(resolveCssColor(itemStyle.color || mlStyle.color) || '#999999');
                  const dash = (itemStyle.type || mlStyle.type) === 'dashed' ? 'dash' :
                               (itemStyle.type || mlStyle.type) === 'dotted' ? 'dot' : defaultDash;
                  const width = itemStyle.width ?? defaultWidth;

                  if (mlData.yAxis !== undefined) {
                    // Use uncorrected Y for scatter/value-axis charts
                    const lineY = xIsValue ? getValYDirect(mlData.yAxis) : getValY(mlData.yAxis);
                    if (lineY != null) {
                      targetSlide.addShape(pres.ShapeType.line, {
                        x: plotLeft, y: lineY, w: plotWidth, h: 0,
                        line: { color, width, dashType: dash },
                      });
                      nativeMarkLineCount++;
                    }
                  } else if (mlData.xAxis !== undefined) {
                    const lineX = typeof mlData.xAxis === 'number' && getValX
                      ? getValX(mlData.xAxis)
                      : getCatX(mlData.xAxis);
                    if (lineX != null) {
                      targetSlide.addShape(pres.ShapeType.line, {
                        x: lineX, y: plotTop, w: 0.001, h: plotHeight,
                        line: { color, width, dashType: dash },
                      });
                      nativeMarkLineCount++;
                    }
                  }
                  continue;
                }

                if (!Array.isArray(mlData) || mlData.length !== 2) continue;
                const [start, end] = mlData;

                // Support both xAxis/yAxis and coord formats
                // For scatter charts (value X axis), use getValX (uncorrected); for category charts, use getCatX.
                const resolveX = (val) => {
                  if (typeof val === 'number' && getValX) return getValX(val);
                  return getCatX(val);
                };
                // Use uncorrected Y for coord-based markLines on scatter/value-axis charts
                const resolveY = xIsValue ? getValYDirect : getValY;
                let x1 = start.coord ? resolveX(start.coord[0]) : getCatX(start.xAxis);
                const y1 = start.coord ? resolveY(start.coord[1]) : getValY(start.yAxis);
                let x2 = end.coord ? resolveX(end.coord[0]) : getCatX(end.xAxis);
                const y2 = end.coord ? resolveY(end.coord[1]) : getValY(end.yAxis);
                if (x1 == null || y1 == null || x2 == null || y2 == null) continue;

                // Shift vertical arrows right; extend horizontal end-points to meet arrow
                const isVertical = Math.abs(x2 - x1) < 0.001;
                const isHorizontal = Math.abs(y2 - y1) < 0.001;
                // Skip vertical markLines for horizontal bars — the native catAx line
                // at autoZero handles the separator, so overlay shapes are redundant.
                if (isVertical && isHorizBar) continue;
                if (isVertical) {
                  x1 += PPTX_ARROW_PAD;
                  x2 += PPTX_ARROW_PAD;
                } else if (isHorizontal) {
                  x2 += PPTX_ARROW_PAD;
                }

                // Draw the dashed line
                // For horizontal lines (same y), h must be 0 to avoid angling
                // For vertical lines (same x), w must be ~0 (small positive for shape)
                const dw = Math.abs(x2 - x1);
                const dh = Math.abs(y2 - y1);
                const lineOpts = {
                  x: Math.min(x1, x2),
                  y: Math.min(y1, y2),
                  w: dw < 0.001 ? 0.001 : dw,
                  h: dh < 0.001 ? 0 : dh,
                  line: { color: defaultColor, width: defaultWidth, dashType: defaultDash },
                };
                if (x2 < x1) lineOpts.flipH = true;
                if (y2 < y1) lineOpts.flipV = true;
                // Arrow on end point
                if (end.symbol === 'arrow') {
                  lineOpts.line.endArrowType = 'triangle';
                }
                targetSlide.addShape(pres.ShapeType.line, lineOpts);
                nativeMarkLineCount++;

                // Render label if present on either point
                const labelConfig = end.label || start.label;
                if (labelConfig && labelConfig.formatter) {
                  const labelText = labelConfig.formatter;
                  // Use chart body font size (series label fontSize) for visual consistency,
                  // not markLine's own fontSize which can be oversized as an overlay
                  const bodyFontPx = series.label?.fontSize || 11;
                  const labelFs = bodyFontPx * PT_PER_PX;
                  const labelColor = svgFillToHex(resolveCssColor(labelConfig.color) || '#333333');
                  const bgColor = labelConfig.backgroundColor ? svgFillToHex(resolveCssColor(labelConfig.backgroundColor)) : null;
                  const midX = (x1 + x2) / 2;
                  const midY = (y1 + y2) / 2;
                  // Size pill to text: width based on character count, height based on font size
                  const charWidthPt = labelFs * 0.65; // approximate character width
                  const boxW = Math.max(labelText.length * charWidthPt / 72 + 0.08, 0.35);
                  const boxH = Math.max(labelFs * 2.0 / 72, 0.18);
                  // Position pill centered on arrow line
                  const lX = midX - boxW / 2;
                  const lY = midY - boxH / 2;
                  // Pill background: use roundRect shape for true oval corners
                  if (bgColor) {
                    targetSlide.addShape(pres.ShapeType.roundRect, {
                      x: lX, y: lY, w: boxW, h: boxH,
                      fill: bgColor,
                      rectRadius: boxH / 2, // half-height = full pill shape
                      line: { type: 'none' },
                    });
                  }
                  // Label text on top
                  targetSlide.addText(labelText, {
                    x: lX, y: lY, w: boxW, h: boxH,
                    fontSize: labelFs, fontFace: brandFont,
                    color: labelColor,
                    bold: labelConfig.fontWeight === 'bold',
                    valign: 'middle', align: 'center',
                    margin: 0, inset: 0,
                  });
                }
              }
            }
            if (nativeMarkLineCount > 0) {
              console.log(`  [native-chart] Chart #${nc.index}: rendered ${nativeMarkLineCount} native markLine(s)`);
            }
          }

          // ── markPoint: render positioned annotation boxes (dashed-border callouts, etc.) ──
          // ECharts markPoint creates positioned shapes with text labels at data coordinates.
          // Native renderer: convert to PPTX shapes (rect/roundRect) + text boxes.
          let nativeMarkPointCount = 0;
          if (nc.config?.series && !placeOverlayPng) {
            const PT_PER_PX_MP = 0.75;
            // Helper: resolve markPoint X coord — supports both label strings and numeric indices
            // Note: no PPTX_X_PAD for markPoints — they use exact ECharts coordinates
            const getMpX = (xCoord) => {
              if (getValX) return getValX(xCoord);
              // For category axis, coord can be a numeric index or a label string
              if (typeof xCoord === 'number' && categoryLabels.length > 0) {
                const idx = Math.round(xCoord);
                if (idx >= 0 && idx < categoryLabels.length) {
                  return plotLeft + (idx + 0.5) * slotWidth;
                }
              }
              return getCatX(xCoord);
            };
            for (const series of nc.config.series) {
              if (!series.markPoint?.data?.length) continue;
              for (const mp of series.markPoint.data) {
                if (!mp.coord || mp.coord.length < 2) continue;
                const cx = getMpX(mp.coord[0]);
                const cy = xIsValue ? getValYDirect(mp.coord[1]) : getValY(mp.coord[1]);
                if (cx == null || cy == null) continue;

                // Compute box size from symbolSize (px → inches)
                const symSize = mp.symbolSize != null ? mp.symbolSize : [60, 30];
                const boxWPx = Array.isArray(symSize) ? symSize[0] : symSize;
                const boxHPx = Array.isArray(symSize) ? symSize[1] : symSize;
                let boxW = boxWPx / 96; // px to inches (96 DPI)
                let boxH = boxHPx / 96;

                // When symbolSize is 0, the marker is invisible — auto-size from label text
                const lbl = mp.label;
                const isInvisibleMarker = boxW < 0.05 && boxH < 0.05;
                if (isInvisibleMarker && lbl?.show && lbl.formatter) {
                  const lblFs = (lbl.fontSize || 10) * PT_PER_PX_MP;
                  const lines = lbl.formatter.split('\n');
                  const maxLineLen = Math.max(...lines.map(l => l.length));
                  // Compact sizing: just enough for the text content
                  boxW = Math.max(maxLineLen * lblFs * 0.62 / 72 + 0.08, 1.2);
                  boxH = Math.max(lines.length * (lbl.lineHeight || lblFs * 1.3) / 72 + 0.05, 0.35);
                }

                let boxX = cx - boxW / 2;
                let boxY = cy - boxH / 2;

                // Clamp to chart boundaries
                const chartRight = posX + posW;
                const chartBottom = posY + posH;
                if (boxX + boxW > chartRight) boxX = chartRight - boxW - 0.02;
                if (boxX < posX) boxX = posX + 0.02;
                if (boxY + boxH > chartBottom) boxY = chartBottom - boxH - 0.02;
                if (boxY < posY) boxY = posY + 0.02;

                // Shape style — only draw if symbolSize > 0 (visible marker)
                const ist = mp.itemStyle || {};
                const fillColor = ist.color ? svgFillToHex(resolveCssColor(ist.color)) : null;
                const borderColor = ist.borderColor ? svgFillToHex(resolveCssColor(ist.borderColor)) : null;
                const borderWidth = ist.borderWidth ?? 1;
                const dashMap = { 'dashed': 'dash', 'dotted': 'dot', 'solid': 'solid' };
                const borderDash = dashMap[ist.borderType || 'solid'] || 'solid';

                if (boxWPx > 0 && boxHPx > 0) {
                  const shapeOpts = {
                    x: boxX, y: boxY, w: boxW, h: boxH,
                  };
                  if (fillColor) shapeOpts.fill = { color: fillColor };
                  if (borderColor) {
                    shapeOpts.line = { color: borderColor, width: borderWidth, dashType: borderDash };
                  }
                  targetSlide.addShape(pres.ShapeType.rect, shapeOpts);
                }

                // Draw the label text
                if (lbl?.show && lbl.formatter) {
                  const lblFs = (lbl.fontSize || 10) * PT_PER_PX_MP;
                  const lblColor = svgFillToHex(resolveCssColor(lbl.color) || '#333333');
                  targetSlide.addText(lbl.formatter.replace(/\\n/g, '\n'), {
                    x: boxX, y: boxY, w: boxW, h: boxH,
                    fontSize: lblFs, fontFace: brandFont,
                    color: lblColor,
                    bold: lbl.fontWeight === 'bold',
                    valign: 'middle', align: 'center',
                    margin: 0, lineSpacingMultiple: lbl.lineHeight ? lbl.lineHeight / (lbl.fontSize || 10) : 1.0,
                  });
                }
                nativeMarkPointCount++;
              }
            }
            if (nativeMarkPointCount > 0) {
              console.log(`  [native-chart] Chart #${nc.index}: rendered ${nativeMarkPointCount} native markPoint(s)`);
            }
          }

          // Scatter chart: render markArea fills as native shapes (quadrant backgrounds, zones)
          if (nc.result?.scatterMarkArea?.length) {
            const bxMin = xAxisConf?.min ?? 0;
            const bxMax = xAxisConf?.max ?? 100;
            const byMin = yAxisConf?.min ?? 0;
            const byMax = yAxisConf?.max ?? 100;
            const bxRange = bxMax - bxMin || 1;
            const byRange = byMax - byMin || 1;

            for (const area of nc.result.scatterMarkArea) {
              const ax1 = plotLeft + ((area.x1 - bxMin) / bxRange) * plotWidth;
              const ax2 = plotLeft + ((area.x2 - bxMin) / bxRange) * plotWidth;
              const ay1 = plotTop + (1 - (area.y2 - byMin) / byRange) * plotHeight;
              const ay2 = plotTop + (1 - (area.y1 - byMin) / byRange) * plotHeight;
              const aW = Math.abs(ax2 - ax1);
              const aH = Math.abs(ay2 - ay1);
              const aX = Math.min(ax1, ax2);
              const aY = Math.min(ay1, ay2);

              // Parse rgba color string
              let fillColor = 'D0D0D0';
              let fillAlpha = 15;
              const rgbaMatch = area.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
              if (rgbaMatch) {
                const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, '0');
                const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, '0');
                const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, '0');
                fillColor = `${r}${g}${b}`.toUpperCase();
                fillAlpha = rgbaMatch[4] ? Math.round(parseFloat(rgbaMatch[4]) * 100) : 100;
              }

              targetSlide.addShape(pres.ShapeType.rect, {
                x: aX, y: aY, w: aW, h: aH,
                fill: { color: fillColor, transparency: 100 - fillAlpha },
                line: { color: fillColor, width: 0, transparency: 100 },
              });
            }
            console.log(`  [native-chart] Chart #${nc.index}: rendered ${nc.result.scatterMarkArea.length} markArea fill(s)`);
          }

          // Scatter chart: render axis titles as text boxes (PptxGenJS scatter ignores catAxisTitle)
          if (nc.result?.scatterAxisTitles) {
            const titles = nc.result.scatterAxisTitles;
            if (titles.x) {
              // X-axis title: centered below plot area
              const xTitleFs = titles.x.fontSize || 9;
              const xTitleH = xTitleFs * 2.2 / 72;
              const xTitleY = plotBottom + 0.06;
              targetSlide.addText(titles.x.text, {
                x: plotLeft, y: xTitleY, w: plotWidth, h: xTitleH,
                fontSize: xTitleFs, fontFace: brandFont,
                bold: titles.x.bold || false,
                italic: titles.x.italic || false,
                color: svgFillToHex(titles.x.color || '333333'),
                align: 'center', valign: 'top',
                margin: 0, inset: 0,
              });
            }
            if (titles.y) {
              // Y-axis title: rotated 270° (text reads bottom-to-top) on left of plot area.
              // PptxGenJS rotate=270 rotates around the unrotated box center.
              // After rotation: visual width = unrotated h, visual height = unrotated w.
              // Calculate desired visual center, then derive unrotated (x, y, w, h).
              const yTitleFs = titles.y.fontSize || 6.75;
              const textLines = (titles.y.text.match(/\n/g) || []).length + 1;
              const visualW = (yTitleFs * 1.5 * textLines) / 72 + 0.1; // visual width (thin, horizontal)
              const visualH = plotHeight * 0.65; // visual height (tall, vertical extent)
              // Desired visual center: just left of plot border, vertically centered
              const vcx = plotLeft - visualW / 2 - 0.04;
              const vcy = plotTop + plotHeight / 2;
              // Unrotated box: w = visualH, h = visualW (swapped due to 270° rotation)
              const yTitleW = visualH;
              const yTitleH = visualW;
              // Center of unrotated box must equal desired visual center
              const yTitleX = vcx - yTitleW / 2;
              const yTitleY = vcy - yTitleH / 2;
              targetSlide.addText(titles.y.text, {
                x: yTitleX, y: yTitleY, w: yTitleW, h: yTitleH,
                fontSize: yTitleFs, fontFace: brandFont,
                bold: titles.y.bold || false,
                italic: titles.y.italic || false,
                color: svgFillToHex(titles.y.color || '333333'),
                align: 'center', valign: 'middle',
                margin: 0, inset: 0,
                rotate: 270,
              });
            }
            console.log(`  [native-chart] Chart #${nc.index}: added scatter axis title(s)`);
          }

          // Bubble chart: render data labels as text boxes positioned by data coordinates
          if (nc.result?.bubbleLabels?.length) {
            // Bubble/scatter charts use their own axis ranges (not shared category/value range)
            const bxMin = xAxisConf?.min ?? 0;
            const bxMax = xAxisConf?.max ?? 100;
            const byMin = yAxisConf?.min ?? 0;
            const byMax = yAxisConf?.max ?? 100;
            const bxRange = bxMax - bxMin || 1;
            const byRange = byMax - byMin || 1;

            for (const bl of nc.result.bubbleLabels) {
              const cx = plotLeft + ((bl.x - bxMin) / bxRange) * plotWidth;
              const cy = plotTop + (1 - (bl.y - byMin) / byRange) * plotHeight;

              const fs = (bl.fontSize || 7) * PT_PER_PX;
              const lines = bl.text.split('\n').length;
              const boxH = (fs * 1.4 * lines) / 72;
              const boxW = Math.max(bl.text.length * fs * 0.6 / 72, 0.6);

              // Offset based on label position relative to bubble/dot center
              let lX, lY;
              const bubbleR = (bl.size || 10) * 0.3 / PX_PER_IN; // approximate bubble radius in inches
              if (bl.position === 'right') {
                lX = cx + bubbleR + 0.02;
                lY = cy - boxH / 2;
              } else if (bl.position === 'left') {
                lX = cx - bubbleR - boxW - 0.02;
                lY = cy - boxH / 2;
              } else if (bl.position === 'bottom') {
                lX = cx - boxW / 2;
                lY = cy + bubbleR + 0.01;
              } else {
                // default: top
                lX = cx - boxW / 2;
                lY = cy - bubbleR - boxH - 0.01;
              }

              // Clamp label position to stay within the chart area (prevent edge clipping)
              if (lY + boxH > plotBottom) lY = plotBottom - boxH;
              if (lY < plotTop) lY = plotTop;
              if (lX + boxW > plotRight) lX = plotRight - boxW;
              if (lX < posX) lX = posX;

              targetSlide.addText(bl.text, {
                x: lX, y: lY, w: boxW, h: boxH,
                fontSize: fs, fontFace: brandFont,
                bold: bl.fontWeight === 'bold',
                color: svgFillToHex(bl.color || '#333333'),
                valign: 'middle',
                align: bl.position === 'left' ? 'right' : bl.position === 'right' ? 'left' : 'center',
                margin: 0, inset: 0,
              });
            }
            console.log(`  [native-chart] Chart #${nc.index}: added ${nc.result.bubbleLabels.length} bubble label text box(es)`);
          }

        } catch (e) {
          console.error(`  [native-chart] Chart #${nc.index}: placement failed: ${e.message}\n${e.stack}`);
          validationErrors.push(`Native chart #${nc.index} placement failed: ${e.message}`);
        }
      }
    }

    // When containLabel was originally true, PowerPoint compresses the plot area
    // upward to fit tall multi-line axis labels. Shift bottom-half overlays UP
    // by the label block height so they follow the bars.
    if (overlayEls.length > 0 && nativeCharts.length > 0) {
      const DPI = 96;
      for (const nc of nativeCharts) {
        if (!nc.originalContainLabel) continue;
        if (!nc.rawCategoryLabels?.length) continue;

        // Compute max lines across all category labels
        let maxLines = 1;
        for (const label of nc.rawCategoryLabels) {
          const lines = label.split('\n').length;
          if (lines > maxLines) maxLines = lines;
        }
        if (maxLines <= 1) continue; // single-line labels don't cause compression

        const fontSize = nc.axisLabelStyle?.fontSize || 11;
        const lineHeight = nc.axisLabelStyle?.lineHeight || Math.ceil(fontSize * 1.3);
        const shiftPx = maxLines * lineHeight;
        const shiftIn = shiftPx / DPI;

        // Only shift overlays in the bottom half of the chart frame
        const chartY = nc.y / DPI;
        const chartH = nc.height / DPI;
        const chartMidY = chartY + chartH / 2;

        for (const el of overlayEls) {
          const elY = el.position?.y ?? el.y1;
          if (elY == null || elY < chartMidY) continue; // skip top-half overlays (legends)

          if (el.position?.y != null) el.position.y -= shiftIn;
          if (el.y1 != null) el.y1 -= shiftIn;
          if (el.y2 != null) el.y2 -= shiftIn;
        }
      }
    }

    // Add HTML overlay elements ON TOP of native charts (callouts, legends with position:absolute)
    if (overlayEls.length > 0) {
      slideData.elements = overlayEls;
      addElements(slideData, targetSlide, pres);
      console.log(`  [chart-overlay] ${overlayEls.length} HTML overlay element(s) placed above native chart(s)`);
    }

    // DIAGNOSTIC: Log overlay-to-chart alignment data for hypothesis testing
    if (overlayEls.length > 0 && nativeCharts.length > 0) {
      const DPI = 96;
      for (const nc of nativeCharts) {
        const chartY = nc.y / DPI;
        const chartH = nc.height / DPI;
        const layout = nc.result?.options?.layout || {};

        // PPTX plot area positions (inches from slide top)
        const plotTop = chartY + (layout.y || 0) * chartH;
        const plotBottom = chartY + ((layout.y || 0) + (layout.h || 1)) * chartH;
        const plotHeight = plotBottom - plotTop;

        // Original grid values
        const ogBottom = nc.originalGridBottom || 0;
        const ogContainLabel = nc.originalContainLabel;
        const pptxBottom = nc.overlayGrid?.bottom || 0;

      }
    }

    // Restore full elements array
    slideData.elements = [...baseEls, ...overlayEls];

    // Collect chart patch data for post-processing chart XML
    const chartPatches = nativeCharts
        .filter(nc => nc.rawCategoryLabels?.length > 0 || nc.nativeLabels?.length > 0 || nc.result?.perPointStyles?.length > 0 || nc.result?.dashedSeriesIndices?.length > 0 || nc.result?.noFillSeriesIndices?.length > 0 || nc.result?.noLineSeriesIndices?.length > 0 || nc.result?.options?.dataLabelPosition || nc.result?.scatterSeriesMeta?.length > 0 || nc.result?.hideXAxisLabels || nc.result?.hideYAxisLabels)
        .map(nc => ({
            rawLabels: nc.result?.waterfallMeta ? [] : nc.rawCategoryLabels,
            axisLabelStyle: nc.axisLabelStyle,
            nativeLabels: nc.nativeLabels,
            perPointStyles: nc.result?.perPointStyles,
            dashedSeriesIndices: nc.result?.dashedSeriesIndices,
            noFillSeriesIndices: nc.result?.noFillSeriesIndices,
            noLineSeriesIndices: nc.result?.noLineSeriesIndices,
            barDir: nc.result?.barDir,
            dataLabelPosition: nc.result?.options?.dataLabelPosition,
            scatterSeriesMeta: nc.result?.scatterSeriesMeta,
            hideXAxisLabels: nc.result?.hideXAxisLabels,
            hideYAxisLabels: nc.result?.hideYAxisLabels,
        }));

    return { slide: targetSlide, placeholders: slideData.placeholders, tempFiles, screenshotPath, chartPatches };
  } catch (error) {
    if (!error.message.startsWith(htmlFile)) {
      throw new Error(`${htmlFile}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Clean up temporary files created during html2pptx conversion.
 * Call this AFTER pptx.writeFile() completes — PptxGenJS reads image paths lazily.
 *
 * @param {string[]} tempFiles - Array of temp file paths from html2pptx() return value
 */
export function cleanupTempFiles(tempFiles) {
  if (!tempFiles) return;
  for (const f of tempFiles) {
    try { fs.unlinkSync(f); } catch (e) { /* already cleaned up */ }
  }
}

/**
 * v5.0.1: Patch bullet colors in PPTX.
 *
 * PptxGenJS accepts bullet.color in its API but never generates <a:buClr> in
 * the OOXML output (the property is dead code). Without <a:buClr>, bullet
 * markers default to the theme's tx1 color (black), which is invisible on
 * dark backgrounds (e.g., navy takeaway boxes).
 *
 * This post-processes the PPTX ZIP to inject <a:buClr> elements derived from
 * each paragraph's first text run color. Only patches non-black bullets.
 *
 * @param {string} pptxPath - Path to the PPTX file to patch (modified in-place)
 */
export async function patchBulletColors(pptxPath) {
  const data = fs.readFileSync(pptxPath);
  const zip = await JSZip.loadAsync(data);
  let patched = 0;

  for (const [name, file] of Object.entries(zip.files)) {
    if (!name.match(/^ppt\/slides\/slide\d+\.xml$/)) continue;
    let xml = await file.async('string');
    let modified = false;

    // Split into paragraphs and process each
    const paragraphs = xml.split(/<\/a:p>/);
    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i];
      // Skip if no custom bullet or already has buClr
      if (!para.includes('<a:buChar ') || para.includes('<a:buClr')) continue;

      // Find the first run's text color: <a:solidFill><a:srgbClr val="XXXXXX"/></a:solidFill>
      const colorMatch = para.match(/<a:r>.*?<a:rPr[^>]*>.*?<a:solidFill>\s*<a:srgbClr val="([A-Fa-f0-9]{6})"\/>\s*<\/a:solidFill>/s);
      if (!colorMatch || colorMatch[1].toUpperCase() === '000000') continue;

      const color = colorMatch[1].toUpperCase();
      // Inject <a:buClr> before <a:buSzPct> (OOXML schema order: buClr → buSz → buChar)
      paragraphs[i] = para.replace(
        /(<a:buSzPct[^/]*\/>)/,
        `<a:buClr><a:srgbClr val="${color}"/></a:buClr>$1`
      );
      patched++;
      modified = true;
    }

    if (modified) {
      zip.file(name, paragraphs.join('</a:p>'));
    }
  }

  if (patched > 0) {
    const output = await zip.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync(pptxPath, output);
    console.warn(`  [bullet-color] Patched ${patched} bullet color(s) in PPTX`);
  }
}

/**
 * Post-process PPTX chart XML to fix text properties that PptxGenJS can't set.
 *
 * Fixes:
 *   A. X-axis label rotation forced to 0° (PptxGenJS treats 0 as falsy → skips it)
 *   B. Multi-line category labels via &#xA; line breaks in <c:v> elements
 *   C. Font size correction (ECharts px → OOXML hundredths-of-point)
 *   D. Font stack normalization ("Arial, Helvetica, sans-serif" → "Arial")
 *   G. Line spacing for tight multi-line labels
 *
 * @param {string} pptxPath - Path to the PPTX file to patch (modified in-place)
 * @param {Array<{rawLabels: string[], axisLabelStyle: object}>} chartPatches - Per-chart patch data
 */
export async function patchChartLabels(pptxPath, chartPatches) {
  if (!chartPatches || chartPatches.length === 0) return;

  const data = fs.readFileSync(pptxPath);
  const zip = await JSZip.loadAsync(data);
  let totalPatched = 0;

  // Collect all chart XML files
  const chartFiles = Object.keys(zip.files).filter(name => name.match(/^ppt\/charts\/chart\d+\.xml$/));
  if (chartFiles.length === 0) return;

  for (let ci = 0; ci < chartFiles.length; ci++) {
    const chartFile = chartFiles[ci];
    const patch = chartPatches[ci]; // Match chart file to patch data by index
    if (!patch) continue;

    let xml = await zip.files[chartFile].async('string');
    let modified = false;

    // ── PptxGenJS bug fix: Remove orphaned series axis ID reference ──
    // PptxGenJS always writes 3 axId values (cat, val, series) into bar/line charts,
    // but only defines <c:serAx> for BAR3D charts. The orphaned third axId
    // (val="2094734556") causes OOXML validation errors → PowerPoint repair dialog.
    // Fix: strip the series axId reference when no <c:serAx> is defined.
    if (!xml.includes('<c:serAx>')) {
      const before = xml;
      xml = xml.replace(/<c:axId val="2094734556"\/>/g, '');
      if (xml !== before) {
        modified = true;
        totalPatched++;
      }
    }

    // ── Issue D: Normalize font stacks globally ──
    // Replace typeface="Arial, Helvetica, sans-serif" → typeface="Arial"
    const fontStackRegex = /typeface="([^"]*,[^"]*)"/g;
    xml = xml.replace(fontStackRegex, (match, fontStack) => {
      const firstFont = fontStack.split(',')[0].trim();
      totalPatched++;
      modified = true;
      return `typeface="${firstFont}"`;
    });

    // ── Issue B: Replace collapsed single-line labels with multi-line &#xA; ──
    if (patch.rawLabels && patch.rawLabels.length > 0) {
      for (const rawLabel of patch.rawLabels) {
        if (!rawLabel.includes('\n')) continue;
        // The collapsed version (what PptxGenJS wrote) has \n replaced with spaces
        const collapsed = rawLabel.replace(/\n/g, ' ').trim()
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        // The multi-line version uses &#xA; for XML line breaks
        // XML-encode BEFORE inserting &#xA; so & in &#xA; doesn't become &amp;#xA;
        const multiLine = rawLabel
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/\n/g, '&#xA;').trim();
        // Replace in <c:v> elements
        const escaped = collapsed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const labelRegex = new RegExp(`(<c:v>)${escaped}(</c:v>)`, 'g');
        const before = xml;
        xml = xml.replace(labelRegex, `$1${multiLine}$2`);
        if (xml !== before) {
          totalPatched++;
          modified = true;
        }
      }
    }

    // ── Issue H: Convert multiLvlStrRef → strRef for correct multi-line labels ──
    // PptxGenJS generates <c:multiLvlStrRef> for labels containing \n, creating
    // separate <c:lvl> elements for each line. PowerPoint displays these as
    // hierarchical axis levels, causing "..." truncation. Fix: merge all levels
    // back into single <c:strRef>/<c:strCache> entries with &#xA; line breaks.
    const multiLvlRegex = /<c:multiLvlStrRef>\s*<c:f>([^<]*)<\/c:f>\s*<c:multiLvlStrCache>\s*<c:ptCount val="(\d+)"\/>([\s\S]*?)<\/c:multiLvlStrCache>\s*<\/c:multiLvlStrRef>/g;
    xml = xml.replace(multiLvlRegex, (match, formula, ptCount, lvlContent) => {
      // Parse ALL levels: level 0 = bottom line, level 1 = line above, etc.
      const lvlRegex = /<c:lvl>([\s\S]*?)<\/c:lvl>/g;
      const levels = []; // levels[0] = bottom line, levels[1] = line above, ...
      let lvlMatch;
      while ((lvlMatch = lvlRegex.exec(lvlContent)) !== null) {
        const pts = {};
        const ptRegex = /<c:pt idx="(\d+)">\s*<c:v>([\s\S]*?)<\/c:v>\s*<\/c:pt>/g;
        let ptMatch;
        while ((ptMatch = ptRegex.exec(lvlMatch[1])) !== null) {
          pts[ptMatch[1]] = ptMatch[2];
        }
        levels.push(pts);
      }

      // Merge: for each index, combine text from highest level to lowest (top→bottom)
      // with &#xA; separator to produce the full multi-line label
      const mergedPts = [];
      const count = parseInt(ptCount, 10);
      for (let idx = 0; idx < count; idx++) {
        const lines = [];
        // Iterate levels in reverse (highest level = topmost line first)
        for (let lvl = levels.length - 1; lvl >= 0; lvl--) {
          if (levels[lvl][idx] !== undefined) {
            lines.push(levels[lvl][idx]);
          }
        }
        if (lines.length > 0) {
          mergedPts.push(`<c:pt idx="${idx}"><c:v>${lines.join('&#xA;')}</c:v></c:pt>`);
        }
      }

      modified = true;
      totalPatched++;
      // Use strLit (no formula) so PowerPoint reads values directly with &#xA; line breaks
      // strRef with a formula pointing to a non-existent embedded sheet can cause
      // PowerPoint to ignore the cached &#xA; and truncate labels with "..."
      return `<c:strLit><c:ptCount val="${ptCount}"/>${mergedPts.join('')}</c:strLit>`;
    });

    // ── Issue A: Fix catAx bodyPr to force rotation=0 and wrap=square ──
    // Find <c:catAx> section and fix <a:bodyPr/> within its <c:txPr>
    const catAxRegex = /(<c:catAx>)([\s\S]*?)(<\/c:catAx>)/g;
    xml = xml.replace(catAxRegex, (match, open, inner, close) => {
      let patched = inner;

      // Fix bodyPr: rotation=0, wrap=square, vertOverflow=overflow to prevent "..." truncation
      // of multi-line labels. Zero insets maximize usable space for label text.
      const bodyPrAttrs = 'rot="0" wrap="square" anchor="t" anchorCtr="0" vertOverflow="overflow" lIns="0" tIns="0" rIns="0" bIns="0"';
      patched = patched.replace(
        /<a:bodyPr[^>]*\/>/g,
        `<a:bodyPr ${bodyPrAttrs}/>`
      );
      patched = patched.replace(
        /<a:bodyPr([^>]*)>([\s\S]*?)<\/a:bodyPr>/g,
        `<a:bodyPr ${bodyPrAttrs}/>`
      );

      // ── Issue C: Fix font size in catAx (ECharts px → OOXML hundredths-of-point) ──
      if (patch.axisLabelStyle?.fontSize) {
        const pxSize = patch.axisLabelStyle.fontSize;
        const ptSize = pxSize * 0.75; // px → pt
        const ooxmlSize = Math.round(ptSize * 100); // pt → hundredths of point
        patched = patched.replace(
          /(<a:defRPr[^>]*)\bsz="(\d+)"/g,
          `$1sz="${ooxmlSize}"`
        );
      }

      // ── Issue G: Tighten line spacing for multi-line axis labels ──
      // Replace PptxGenJS's default point-based spacing with 80% single-space.
      // Combined with vertOverflow="overflow" on bodyPr, this keeps &#xA; line breaks
      // visible while reducing overlap between adjacent category labels.
      // Only apply to charts that actually have multi-line labels — single-line labels
      // (line/scatter/area charts) get unnecessarily tight spacing otherwise.
      const hasMultiLineLabels = (patch.rawLabels || []).some(l => l.includes('\n'));
      if (hasMultiLineLabels) {
        patched = patched.replace(
          /<a:lnSpc><a:spcPts val="\d+"\/><\/a:lnSpc>/g,
          '<a:lnSpc><a:spcPct val="80000"/></a:lnSpc>'
        );
      }

      // ── Horizontal bars: hide native axis labels (overlay text boxes handle them) ──
      // With tickLblPos="low", PowerPoint gives each label its own bounding box sized
      // to text width → inconsistent left-alignment. Setting "none" hides native labels;
      // uniformly-positioned text boxes added during slide generation provide consistent
      // left alignment for both single-line and multi-line labels.
      if (patch.barDir === 'bar') {
        patched = patched.replace(
          /<c:tickLblPos val="[^"]*"\/>/,
          '<c:tickLblPos val="none"/>'
        );
        // Enable catAx line at the zero crossing — makes the separator part of the
        // native chart so it moves with layout. Replaces overlay markLine shapes.
        patched = patched.replace(
          /(<a:ln[^>]*>)<a:noFill\/>/,
          '$1<a:solidFill><a:srgbClr val="666666"/></a:solidFill>'
        );
      }

      if (patched !== inner) {
        totalPatched++;
        modified = true;
      }
      return open + patched + close;
    });

    // ── Issue C (valAx): Fix value axis font size (ECharts px → OOXML hundredths-of-point) ──
    if (patch.axisLabelStyle?.fontSize) {
      const ooxmlSize = Math.round(patch.axisLabelStyle.fontSize * 0.75 * 100);
      xml = xml.replace(/(<c:valAx>)([\s\S]*?)(<\/c:valAx>)/g, (match, open, inner, close) => {
        const fixed = inner.replace(
          /(<a:defRPr[^>]*)\bsz="(\d+)"/g,
          `$1sz="${ooxmlSize}"`
        );
        if (fixed !== inner) { totalPatched++; modified = true; }
        return open + fixed + close;
      });
    }

    // NOTE: dLblPos for doughnut charts — PptxGenJS ignores dataLabelPosition for
    // doughnut charts. OOXML injection of <c:dLblPos> causes PowerPoint repair dialog.
    // Labels remain inside the ring. External labels with leader lines not yet supported.

    // ── Inject <c:dLbl> for native data labels (segments + totals) ──
    if (patch.nativeLabels && patch.nativeLabels.length > 0) {
      for (const entry of patch.nativeLabels) {
        const serIdx = entry.seriesIdx;

        // Find <c:ser> with <c:idx val="N"/> and its <c:dLbls> section
        const serRegex = new RegExp(
          `(<c:ser>\\s*<c:idx val="${serIdx}"/>` +
          `[\\s\\S]*?)(<c:dLbls>)([\\s\\S]*?)(</c:dLbls>)`,
          ''
        );

        // Series-level style override: replace <c:txPr> in <c:dLbls> for contrast colors
        if (entry.seriesStyle) {
          const style = entry.seriesStyle;
          const sz = Math.round(style.fontSize * 100);
          const bold = style.fontWeight === 'bold' ? ' b="1"' : '';
          const newTxPr = `<c:txPr><a:bodyPr/><a:lstStyle/>`
            + `<a:p><a:pPr><a:defRPr sz="${sz}"${bold}>`
            + `<a:solidFill><a:srgbClr val="${style.color}"/></a:solidFill>`
            + `<a:latin typeface="${style.fontFace}"/>`
            + `</a:defRPr></a:pPr></a:p></c:txPr>`;
          xml = xml.replace(serRegex, (match, serBefore, dLblsOpen, dLblsContent, dLblsClose) => {
            let patched = dLblsContent.replace(/<c:txPr>[\s\S]*?<\/c:txPr>/, newTxPr);
            if (!patched.includes('<c:txPr>')) patched = newTxPr + patched;
            modified = true;
            totalPatched++;
            return serBefore + dLblsOpen + patched + dLblsClose;
          });
        }

        // Per-point label injection
        if (entry.labels && entry.labels.length > 0) {
          xml = xml.replace(serRegex, (match, serBefore, dLblsOpen, dLblsContent, dLblsClose) => {
            // Remove existing <c:dLbl> entries for indexes we're about to inject
            // to prevent duplicate entries (OOXML schema violation → PowerPoint repair)
            let cleanedContent = dLblsContent;
            for (const label of entry.labels) {
              const removeRegex = new RegExp(
                `<c:dLbl>\\s*<c:idx val="${label.pointIdx}"/>[\\s\\S]*?</c:dLbl>`, 'g'
              );
              cleanedContent = cleanedContent.replace(removeRegex, '');
            }
            let injected = '';

            for (const label of entry.labels) {
              if (label.suppress) {
                // Suppress label entirely using <c:delete> (OOXML standard way)
                injected += `<c:dLbl><c:idx val="${label.pointIdx}"/>`
                  + `<c:delete val="1"/>`
                  + `</c:dLbl>`;
                continue;
              }

              // Font size: ECharts uses px, OOXML uses hundredths-of-point (Pt(10) → sz="1000")
              // px → pt: multiply by 0.75 (1px ≈ 0.75pt at 96 DPI)
              const sz = Math.round(label.fontSize * 75);
              const bold = label.fontWeight === 'bold' ? ' b="1"' : '';

              let txBlock = '';
              if (label.text) {
                // Custom text label — matches python-pptx <c:dLbl> reference exactly.
                // No lang=, no dirty=, no endParaRPr — these cause PowerPoint repair.
                // Supports multiline: split on \n, emit <a:br/> between runs.
                const rPr = `<a:rPr sz="${sz}"${bold}>`
                  + `<a:solidFill><a:srgbClr val="${label.color}"/></a:solidFill>`
                  + `<a:latin typeface="${label.fontFace}"/></a:rPr>`;

                if (label.text.includes('\n')) {
                  const lines = label.text.split('\n');
                  const runs = lines.map((line, li) => {
                    let run = `<a:r>${rPr}<a:t>${line}</a:t></a:r>`;
                    if (li < lines.length - 1) {
                      run += `<a:br>${rPr}</a:br>`;
                    }
                    return run;
                  }).join('');
                  txBlock = `<c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p>${runs}</a:p></c:rich></c:tx>`;
                } else {
                  txBlock = `<c:tx><c:rich><a:bodyPr/><a:lstStyle/>`
                    + `<a:p><a:r>${rPr}<a:t>${label.text}</a:t></a:r>`
                    + `</a:p></c:rich></c:tx>`;
                }
              } else {
                // Segment label: show native value with styling override
                txBlock = `<c:numFmt formatCode="#,##0" sourceLinked="0"/>`
                  + `<c:txPr><a:bodyPr/><a:lstStyle/>`
                  + `<a:p><a:pPr><a:defRPr sz="${sz}"${bold}>`
                  + `<a:solidFill><a:srgbClr val="${label.color}"/></a:solidFill>`
                  + `<a:latin typeface="${label.fontFace}"/>`
                  + `</a:defRPr></a:pPr></a:p>`
                  + `</c:txPr>`;
              }

              // Position override (e.g. outEnd for phantom total labels above stack)
              const posBlock = label.dLblPos ? `<c:dLblPos val="${label.dLblPos}"/>` : '';

              // <c:layout/> is required by PowerPoint for custom text <c:dLbl> entries.
              // <c:showVal> must be "0" when <c:tx> provides custom text (avoids repair).
              injected += `<c:dLbl><c:idx val="${label.pointIdx}"/>`
                + `<c:layout/>`
                + txBlock
                + posBlock
                + `<c:showLegendKey val="0"/>`
                + `<c:showVal val="${label.text ? '0' : (label.showVal ? '1' : '0')}"/>`
                + `<c:showCatName val="0"/><c:showSerName val="0"/>`
                + `<c:showPercent val="0"/><c:showBubbleSize val="0"/>`
                + `</c:dLbl>`;
            }

            modified = true;
            totalPatched++;
            return serBefore + dLblsOpen + injected + cleanedContent + dLblsClose;
          });
        }

        // For total series: make fill transparent
        if (entry.isTotal) {
          const fillRegex = new RegExp(
            `(<c:ser>\\s*<c:idx val="${serIdx}"/>[\\s\\S]*?)(<c:spPr>)[\\s\\S]*?(</c:spPr>)`,
            ''
          );
          xml = xml.replace(fillRegex, (m, before, spPrOpen, spPrClose) => {
            modified = true;
            return before + '<c:spPr><a:noFill/></c:spPr>';
          });
        }
      }
    }

    // ── Per-point fill & border overrides via <c:dPt> ──
    if (patch.perPointStyles?.length) {
      for (const entry of patch.perPointStyles) {
        const serIdx = entry.seriesIdx;

        // Build <c:dPt> block for all points in this series
        let dPtBlock = '';
        for (const pt of entry.points) {
          let spPr = '';
          if (pt.fillColor) {
            spPr += `<a:solidFill><a:srgbClr val="${pt.fillColor}"/></a:solidFill>`;
          }
          if (pt.dashedBorder) {
            spPr += `<a:ln w="${pt.dashedBorder.widthEmu}">`
              + `<a:solidFill><a:srgbClr val="${pt.dashedBorder.color}"/></a:solidFill>`
              + `<a:prstDash val="dash"/>`
              + `</a:ln>`;
          }
          if (spPr) {
            dPtBlock += `<c:dPt><c:idx val="${pt.pointIdx}"/>`
              + `<c:invertIfNegative val="0"/>`
              + `<c:spPr>${spPr}</c:spPr></c:dPt>`;
          }
        }

        if (!dPtBlock) continue;

        // Insert <c:dPt> elements inside the matching <c:ser>, before <c:dLbls> (OOXML schema order: dPt* before dLbls)
        // Fallback: before <c:cat> or <c:val> if no <c:dLbls>
        const serRegex = new RegExp(
          `(<c:ser>\\s*<c:idx val="${serIdx}"/>[\\s\\S]*?)((?:<c:dLbls>|<c:cat>|<c:val>))`,
          ''
        );
        xml = xml.replace(serRegex, (match, serBefore, nextTag) => {
          modified = true;
          totalPatched++;
          return serBefore + dPtBlock + nextTag;
        });
      }
    }

    // ── Dashed-outline series: replace fill with noFill + dashed border ──
    if (patch.dashedSeriesIndices?.length) {
      for (const serIdx of patch.dashedSeriesIndices) {
        const fillRegex = new RegExp(
          `(<c:ser>\\s*<c:idx val="${serIdx}"/>[\\s\\S]*?)(<c:spPr>)[\\s\\S]*?(</c:spPr>)`,
          ''
        );
        xml = xml.replace(fillRegex, (m, before, spPrOpen, spPrClose) => {
          modified = true;
          totalPatched++;
          return before + '<c:spPr><a:noFill/><a:ln w="19050"><a:solidFill><a:srgbClr val="666666"/></a:solidFill><a:prstDash val="dash"/></a:ln></c:spPr>';
        });
      }
    }

    // ── Waterfall base series: replace fill with noFill (transparent bars) ──
    if (patch.noFillSeriesIndices?.length) {
      for (const serIdx of patch.noFillSeriesIndices) {
        const fillRegex = new RegExp(
          `(<c:ser>\\s*<c:idx val="${serIdx}"/>[\\s\\S]*?)(<c:spPr>)[\\s\\S]*?(</c:spPr>)`,
          ''
        );
        xml = xml.replace(fillRegex, (m, before, spPrOpen, spPrClose) => {
          modified = true;
          totalPatched++;
          return before + '<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>';
        });
      }
    }

    // ── Scatter combo: remove connecting lines from scatter-only series ──
    // PptxGenJS combo charts ignore per-entry lineSize:0 for SCATTER type.
    // Fix by replacing the <a:ln> in each scatter series' <c:spPr> with <a:noFill/>.
    if (patch.noLineSeriesIndices?.length) {
      for (const serIdx of patch.noLineSeriesIndices) {
        const lnRegex = new RegExp(
          `(<c:ser>\\s*<c:idx val="${serIdx}"/>[\\s\\S]*?<c:spPr>[\\s\\S]*?)(<a:ln[^/]*>)[\\s\\S]*?(</a:ln>)`,
          ''
        );
        xml = xml.replace(lnRegex, (m, before, lnOpen, lnClose) => {
          modified = true;
          totalPatched++;
          return before + '<a:ln><a:noFill/></a:ln>';
        });
      }
    }

    // ── Scatter series full rebuild: replace PptxGenJS scaffold with correct per-series data ──
    // PptxGenJS scatter combo creates 2N series (X+Y per entry) with shared X column,
    // completely scrambling multi-series XY data. We rebuild all <c:ser> blocks from metadata.
    if (patch.scatterSeriesMeta?.length > 0) {
      const scatterMatch = xml.match(/(<c:scatterChart>)([\s\S]*?)(<\/c:scatterChart>)/);
      if (scatterMatch) {
        const [fullMatch, openTag, innerBlock, closeTag] = scatterMatch;
        // Keep non-series content (scatterStyle, varyColors, axId refs)
        const keepParts = [];
        // Extract scatterStyle, varyColors
        const styleMatch = innerBlock.match(/<c:scatterStyle[^/]*\/>/);
        const varyMatch = innerBlock.match(/<c:varyColors[^/]*\/>/);
        // Use "line" style (no markers) when all series hide symbols
        const allHidden = patch.scatterSeriesMeta.every(m => !m.showSymbol);
        keepParts.push(allHidden ? '<c:scatterStyle val="line"/>' : (styleMatch?.[0] || '<c:scatterStyle val="lineMarker"/>'));
        keepParts.push(varyMatch?.[0] || '<c:varyColors val="0"/>');

        // Build new <c:ser> blocks from metadata
        for (let si = 0; si < patch.scatterSeriesMeta.length; si++) {
          const m = patch.scatterSeriesMeta[si];
          const xPts = m.xValues.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('');
          const yPts = m.yValues.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('');
          const markerSize = m.markerSize || 6;
          const alphaXml = (m.opacity != null && m.opacity < 1)
            ? `<a:alpha val="${Math.round(m.opacity * 100000)}"/>`
            : '';
          const markerXml = m.showSymbol
            ? `<c:marker><c:symbol val="circle"/><c:size val="${markerSize}"/>` +
              `<c:spPr><a:solidFill><a:srgbClr val="${m.color}">${alphaXml}</a:srgbClr></a:solidFill></c:spPr>` +
              `</c:marker>`
            : `<c:marker><c:symbol val="none"/></c:marker>`;

          // Series shape: scatter dots get no connecting line; trend lines get visible stroke
          const spPrXml = m.lineWidthEmu === 0
            ? `<c:spPr><a:ln><a:noFill/></a:ln><a:effectLst/></c:spPr>`
            : `<c:spPr>` +
                `<a:ln w="${m.lineWidthEmu}" cap="flat">` +
                  `<a:solidFill><a:srgbClr val="${m.color}"/></a:solidFill>` +
                  `<a:prstDash val="${m.dash}"/>` +
                  `<a:round/>` +
                `</a:ln>` +
                `<a:effectLst/>` +
              `</c:spPr>`;

          keepParts.push(
            `<c:ser>` +
              `<c:idx val="${si}"/>` +
              `<c:order val="${si}"/>` +
              `<c:tx><c:strRef><c:f></c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${m.name.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</c:v></c:pt></c:strCache></c:strRef></c:tx>` +
              spPrXml +
              markerXml +
              `<c:xVal><c:numRef><c:f></c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${m.xValues.length}"/>${xPts}</c:numCache></c:numRef></c:xVal>` +
              `<c:yVal><c:numRef><c:f></c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${m.yValues.length}"/>${yPts}</c:numCache></c:numRef></c:yVal>` +
              `<c:smooth val="0"/>` +
            `</c:ser>`
          );
        }

        // Preserve axId references from original block
        const axIdMatches = innerBlock.match(/<c:axId[^/]*\/>/g) || [];
        keepParts.push(...axIdMatches);

        xml = xml.replace(fullMatch, openTag + keepParts.join('') + closeTag);
        modified = true;
        totalPatched++;
        console.log(`  [chart-patch] Rebuilt scatter chart: ${patch.scatterSeriesMeta.length} series (${patch.scatterSeriesMeta.filter(m => m.dash !== 'solid').length} dashed)`);

        // Rebuild the embedded Excel workbook to match the new series data.
        // PptxGenJS only wrote scaffold data (2 columns) — we need all series.
        const relsFile = chartFile.replace('charts/', 'charts/_rels/') + '.rels';
        const relsXml = zip.files[relsFile] ? await zip.files[relsFile].async('string') : '';
        const wbMatch = relsXml.match(/Target="([^"]*Microsoft_Excel[^"]*)"/);
        if (wbMatch) {
          const wbRelPath = wbMatch[1].replace(/^\.\.\//, 'ppt/');
          const wbZipEntry = zip.files[wbRelPath];
          if (wbZipEntry) {
            try {
              const wbZip = await JSZip.loadAsync(await wbZipEntry.async('arraybuffer'));
              // Build new sheet1.xml with all series data (paired X,Y columns)
              const meta = patch.scatterSeriesMeta;
              const maxRows = Math.max(...meta.map(m => m.xValues.length));
              // Column layout: A=X1, B=Y1, C=X2, D=Y2, ...
              // Support >26 columns (AA, AB, etc.) for charts with 14+ series
              const colName = (idx) => {
                let name = '';
                let n = idx;
                while (n >= 0) {
                  name = String.fromCharCode(65 + (n % 26)) + name;
                  n = Math.floor(n / 26) - 1;
                }
                return name;
              };
              const lastCol = colName(meta.length * 2 - 1);
              let sheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
                `<dimension ref="A1:${lastCol}${maxRows + 1}"/>` +
                '<sheetData>';
              // Header row with series names
              sheetXml += '<row r="1">';
              for (let s = 0; s < meta.length; s++) {
                const xCol = colName(s * 2);
                const yCol = colName(s * 2 + 1);
                sheetXml += `<c r="${xCol}1" t="inlineStr"><is><t>X</t></is></c>`;
                sheetXml += `<c r="${yCol}1" t="inlineStr"><is><t>${meta[s].name.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</t></is></c>`;
              }
              sheetXml += '</row>';
              // Data rows
              for (let r = 0; r < maxRows; r++) {
                sheetXml += `<row r="${r + 2}">`;
                for (let s = 0; s < meta.length; s++) {
                  const xCol = colName(s * 2);
                  const yCol = colName(s * 2 + 1);
                  if (r < meta[s].xValues.length) {
                    sheetXml += `<c r="${xCol}${r + 2}"><v>${meta[s].xValues[r]}</v></c>`;
                    sheetXml += `<c r="${yCol}${r + 2}"><v>${meta[s].yValues[r]}</v></c>`;
                  }
                }
                sheetXml += '</row>';
              }
              sheetXml += '</sheetData></worksheet>';
              wbZip.file('xl/worksheets/sheet1.xml', sheetXml);
              // Remove sharedStrings if present (we use inlineStr instead)
              if (wbZip.files['xl/sharedStrings.xml']) {
                wbZip.remove('xl/sharedStrings.xml');
              }
              const newWb = await wbZip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
              zip.file(wbRelPath, newWb);
              console.log(`  [chart-patch] Rebuilt embedded workbook: ${meta.length} series × ${maxRows} rows`);
            } catch (wbErr) {
              console.warn(`  [chart-patch] Workbook rebuild failed: ${wbErr.message}`);
            }
          }
        }
      }
    }

    // ── Scatter/bubble/quadrant: hide axis labels while keeping lines + ticks visible ──
    // PptxGenJS has no "labels only hidden" option — catAxisHidden hides everything.
    // Fix: patch <c:tickLblPos> to "none" on the target axis elements.
    // Scatter/bubble charts have two <c:valAx> elements. The one whose <c:axId> matches the
    // second axId in <c:scatterChart>/<c:bubbleChart> is the Y-axis; the first match is the X-axis.
    if (patch.hideXAxisLabels || patch.hideYAxisLabels) {
      const scatterAxIds = [];
      // Look for axis IDs in both scatter and bubble chart elements
      const scAxMatch = xml.match(/<c:scatterChart>[\s\S]*?<\/c:scatterChart>/) ||
                        xml.match(/<c:bubbleChart>[\s\S]*?<\/c:bubbleChart>/);
      if (scAxMatch) {
        const axIdMatches = scAxMatch[0].match(/<c:axId val="(\d+)"\/>/g) || [];
        for (const m of axIdMatches) {
          const val = m.match(/val="(\d+)"/)?.[1];
          if (val) scatterAxIds.push(val);
        }
      }
      // scatterAxIds[0] = X-axis axId, scatterAxIds[1] = Y-axis axId
      const hideAxIds = new Set();
      if (patch.hideXAxisLabels && scatterAxIds[0]) hideAxIds.add(scatterAxIds[0]);
      if (patch.hideYAxisLabels && scatterAxIds[1]) hideAxIds.add(scatterAxIds[1]);

      if (hideAxIds.size > 0) {
        // Find each <c:valAx> block and check if its axId should have labels hidden
        xml = xml.replace(/(<c:valAx>)([\s\S]*?)(<\/c:valAx>)/g, (match, open, inner, close) => {
          const axIdMatch = inner.match(/<c:axId val="(\d+)"\/>/);
          if (axIdMatch && hideAxIds.has(axIdMatch[1])) {
            // Replace tickLblPos with "none" to hide labels
            const patched = inner.replace(
              /<c:tickLblPos val="[^"]*"\/>/,
              '<c:tickLblPos val="none"/>'
            );
            if (patched !== inner) {
              modified = true;
              totalPatched++;
            }
            return open + patched + close;
          }
          return match;
        });
      }
    }

    // ── OOXML Validator: detect patterns that cause PowerPoint repair ──
    const validationErrors = validateChartXml(xml, chartFile);
    if (validationErrors.length > 0) {
      // Auto-fix what we can, hard-fail on what we can't
      for (const err of validationErrors) {
        if (err.fix) {
          const before = xml;
          xml = err.fix(xml);
          if (xml !== before) {
            modified = true;
            totalPatched++;
            console.warn(`  [chart-validate] ${chartFile}: AUTO-FIXED: ${err.message}`);
          }
        } else {
          console.error(`  [chart-validate] ${chartFile}: UNFIXABLE: ${err.message}`);
        }
      }
    }

    if (modified) {
      zip.file(chartFile, xml);
    }
  }

  if (totalPatched > 0) {
    const output = await zip.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync(pptxPath, output);
    console.log(`  [chart-patch] Patched ${totalPatched} chart XML issue(s) in PPTX`);
  }
}

/**
 * Validate chart OOXML for patterns known to cause PowerPoint "repair" dialogs.
 * Returns an array of { message, severity, fix? } objects.
 * If `fix` is provided, it's a function (xml) => fixedXml that auto-repairs the issue.
 *
 * Known bad patterns (discovered through iterative testing):
 *   V1. Orphaned axis ID — chart group references <c:axId> with no matching axis definition
 *   V2. <c:dLblPos> inside per-point <c:dLbl> with custom <c:tx><c:rich> text
 *   V3. <c:dLblPos> anywhere inside <c:pieChart> or <c:doughnutChart> sections
 *   V4. Duplicate <c:dLblPos> in a single <c:dLbls> block (PptxGenJS + injection conflict)
 *   V5. <c:barChart grouping="stacked"> with <c:dLblPos val="t"> (top not valid for stacked)
 */
function validateChartXml(xml, fileName) {
  const errors = [];

  // ── V1: Orphaned axis IDs ──
  // Collect all axis IDs defined by axis elements, grouped by type
  const definedAxIds = new Set();
  const axByType = { cat: null, val: null, ser: null, date: null };
  const axDefRegex = /<c:(catAx|valAx|serAx|dateAx)>\s*<c:axId val="(\d+)"\/>/g;
  let m;
  while ((m = axDefRegex.exec(xml)) !== null) {
    definedAxIds.add(m[2]);
    const typeKey = m[1].replace('Ax', '');
    if (!axByType[typeKey]) axByType[typeKey] = m[2]; // keep first (primary) of each type
  }
  // Collect all axis IDs referenced by chart groups
  const chartGroupRegex = /<c:(?:barChart|lineChart|pieChart|doughnutChart|areaChart|scatterChart|radarChart|bubbleChart)>([\s\S]*?)<\/c:(?:barChart|lineChart|pieChart|doughnutChart|areaChart|scatterChart|radarChart|bubbleChart)>/g;
  while ((m = chartGroupRegex.exec(xml)) !== null) {
    const groupContent = m[0];
    const refRegex = /<c:axId val="(\d+)"\/>/g;
    const refs = [];
    let refMatch;
    while ((refMatch = refRegex.exec(groupContent)) !== null) {
      refs.push(refMatch[1]);
    }
    for (let ri = 0; ri < refs.length; ri++) {
      const refId = refs[ri];
      if (!definedAxIds.has(refId)) {
        // Determine replacement: in chart groups, axIds are ordered [catAx, valAx, serAx?]
        // Second reference is typically valAx → replace with primary valAx
        const replacementId = ri === 0 ? axByType.cat : (ri === 1 ? axByType.val : null);
        const axIdLiteral = refId;
        if (replacementId) {
          errors.push({
            message: `Orphaned axis reference <c:axId val="${axIdLiteral}"/> — replacing with primary axis ${replacementId}`,
            severity: 'error',
            fix: (x) => x.replace(new RegExp(`<c:axId val="${axIdLiteral}"/>`, 'g'), `<c:axId val="${replacementId}"/>`),
          });
        } else {
          errors.push({
            message: `Orphaned axis reference <c:axId val="${axIdLiteral}"/> — removing (no matching axis type found)`,
            severity: 'error',
            fix: (x) => x.replace(new RegExp(`<c:axId val="${axIdLiteral}"/>`, 'g'), ''),
          });
        }
      }
    }
  }

  // ── V2: <c:dLblPos> inside per-point <c:dLbl> with custom rich text ──
  // Per-point <c:dLbl> entries that have BOTH <c:tx><c:rich> AND <c:dLblPos> cause repair
  const perPointDLblRegex = /<c:dLbl>([\s\S]*?)<\/c:dLbl>/g;
  while ((m = perPointDLblRegex.exec(xml)) !== null) {
    const dLblContent = m[1];
    if (dLblContent.includes('<c:rich>') && dLblContent.includes('<c:dLblPos')) {
      errors.push({
        message: 'Per-point <c:dLbl> has both <c:tx><c:rich> and <c:dLblPos> — causes repair',
        severity: 'error',
        fix: (x) => x.replace(/<c:dLbl>([\s\S]*?)<\/c:dLbl>/g, (match, inner) => {
          if (inner.includes('<c:rich>') && inner.includes('<c:dLblPos')) {
            return '<c:dLbl>' + inner.replace(/<c:dLblPos val="[^"]*"\/>/g, '') + '</c:dLbl>';
          }
          return match;
        }),
      });
      break; // One fix handles all instances
    }
  }

  // ── V3: <c:dLblPos> inside pie/doughnut chart sections ──
  const pieDonutRegex = /<c:(?:pieChart|doughnutChart)>([\s\S]*?)<\/c:(?:pieChart|doughnutChart)>/g;
  while ((m = pieDonutRegex.exec(xml)) !== null) {
    const section = m[0];
    if (section.includes('<c:dLblPos')) {
      errors.push({
        message: '<c:dLblPos> found inside pie/doughnut chart — causes repair for all position values',
        severity: 'error',
        fix: (x) => x.replace(
          /(<c:(?:pieChart|doughnutChart)>)([\s\S]*?)(<\/c:(?:pieChart|doughnutChart)>)/g,
          (match, open, inner, close) => open + inner.replace(/<c:dLblPos val="[^"]*"\/>/g, '') + close
        ),
      });
      break;
    }
  }

  // ── V4: Duplicate <c:dLblPos> in a single <c:dLbls> block ──
  const dLblsRegex = /<c:dLbls>([\s\S]*?)<\/c:dLbls>/g;
  while ((m = dLblsRegex.exec(xml)) !== null) {
    const dLblsContent = m[1];
    const posMatches = dLblsContent.match(/<c:dLblPos val="[^"]*"\/>/g);
    if (posMatches && posMatches.length > 1) {
      errors.push({
        message: `Duplicate <c:dLblPos> in <c:dLbls> block (${posMatches.length} occurrences)`,
        severity: 'error',
        fix: (x) => x.replace(/<c:dLbls>([\s\S]*?)<\/c:dLbls>/g, (match, inner) => {
          const poses = inner.match(/<c:dLblPos val="[^"]*"\/>/g);
          if (poses && poses.length > 1) {
            // Keep only the first occurrence
            let first = true;
            return '<c:dLbls>' + inner.replace(/<c:dLblPos val="[^"]*"\/>/g, (p) => {
              if (first) { first = false; return p; }
              return '';
            }) + '</c:dLbls>';
          }
          return match;
        }),
      });
      break;
    }
  }

  // ── V5: stacked bar with dLblPos="t" (top) — invalid for stacked bars ──
  const stackedBarRegex = /<c:barChart>[\s\S]*?<c:grouping val="stacked"\/>[\s\S]*?<\/c:barChart>/g;
  while ((m = stackedBarRegex.exec(xml)) !== null) {
    const barSection = m[0];
    // Check series-level <c:dLbls> for dLblPos="t"
    if (barSection.includes('<c:dLblPos val="t"/>')) {
      errors.push({
        message: 'Stacked bar chart has <c:dLblPos val="t"/> — "top" is invalid for stacked bars, use "ctr" or remove',
        severity: 'warning',
        fix: (x) => x.replace(
          /(<c:barChart>[\s\S]*?<c:grouping val="stacked"\/>[\s\S]*?<\/c:barChart>)/g,
          (barMatch) => barMatch.replace(/<c:dLblPos val="t"\/>/g, '<c:dLblPos val="ctr"/>')
        ),
      });
      break;
    }
  }

  // ── V6: Scatter chart integrity — ptCount vs actual points, numLit rejection ──
  const scatterChartRegex = /<c:scatterChart>([\s\S]*?)<\/c:scatterChart>/g;
  while ((m = scatterChartRegex.exec(xml)) !== null) {
    const scatterBlock = m[1];

    // V6a: <c:numLit> inside scatter charts causes PowerPoint repair
    if (scatterBlock.includes('<c:numLit>')) {
      errors.push({
        message: '<c:numLit> found inside scatterChart — PowerPoint requires <c:numRef> with <c:numCache>',
        severity: 'error',
        fix: (x) => x.replace(
          /(<c:scatterChart>)([\s\S]*?)(<\/c:scatterChart>)/g,
          (match, open, inner, close) => {
            // Convert numLit → numRef wrapping the cache content
            let fixed = inner
              .replace(/<c:numLit>/g, '<c:numRef><c:f></c:f><c:numCache>')
              .replace(/<\/c:numLit>/g, '</c:numCache></c:numRef>');
            return open + fixed + close;
          }
        ),
      });
      break;
    }

    // V6b: ptCount mismatch — declared count must match actual <c:pt> elements
    const serRegex = /<c:ser>([\s\S]*?)<\/c:ser>/g;
    let serMatch;
    while ((serMatch = serRegex.exec(scatterBlock)) !== null) {
      const serContent = serMatch[1];
      // Check xVal and yVal blocks
      for (const axis of ['xVal', 'yVal']) {
        const axisMatch = serContent.match(new RegExp(`<c:${axis}>[\\s\\S]*?<c:ptCount val="(\\d+)"/>[\\s\\S]*?</c:${axis}>`));
        if (axisMatch) {
          const declaredCount = parseInt(axisMatch[1], 10);
          const actualPts = (axisMatch[0].match(/<c:pt idx="/g) || []).length;
          if (declaredCount !== actualPts) {
            errors.push({
              message: `Scatter series ${axis} ptCount mismatch: declared=${declaredCount}, actual=${actualPts}`,
              severity: 'warning',
              // Auto-fix by updating ptCount to match actual points
              fix: (x) => {
                // Find and fix all ptCount mismatches in scatter charts
                return x.replace(
                  /(<c:(?:xVal|yVal)>[\s\S]*?<c:ptCount val=")(\d+)("\/>[^]*?<\/c:(?:xVal|yVal)>)/g,
                  (ptMatch, before, count, after) => {
                    const realCount = (ptMatch.match(/<c:pt idx="/g) || []).length;
                    return before + realCount + after;
                  }
                );
              },
            });
            break;
          }
        }
      }
    }

    // V6c: scatter chart must have exactly 2 axis definitions (valAx + valAx)
    // Missing axes cause PowerPoint repair
    const scatterAxCount = (scatterBlock.match(/<c:axId/g) || []).length;
    if (scatterAxCount < 2) {
      errors.push({
        message: `Scatter chart has ${scatterAxCount} axis reference(s) — needs exactly 2 (X + Y value axes)`,
        severity: 'error',
        // No auto-fix — this is a structural issue that needs investigation
      });
    }
  }

  return errors;
}

export default html2pptx;

// ── Auto-redirect guard ──────────────────────────────────────
// Detect direct execution: if someone runs `node html2pptx.mjs ...`
// (which is a library, not a CLI), redirect transparently to html2pptx-cli.mjs.
const _invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : null;
const _thisFile = fileURLToPath(import.meta.url);

if (_invokedFile === _thisFile) {
  const userArgs = process.argv.slice(2);
  const cliPath = path.join(path.dirname(_thisFile), 'html2pptx-cli.mjs');

  if (userArgs.length === 0) {
    console.error('┌─────────────────────────────────────────────────────────┐');
    console.error('│  html2pptx.mjs is a LIBRARY module, not a CLI.         │');
    console.error('│                                                         │');
    console.error('│  Use the CLI instead:                                   │');
    console.error('│    node scripts/html2pptx-cli.mjs slide.html out.pptx  │');
    console.error('│                                                         │');
    console.error('│  Or for multi-slide:                                    │');
    console.error('│    node scripts/html2pptx-cli.mjs s1.html s2.html \\    │');
    console.error('│      -o output.pptx                                     │');
    console.error('└─────────────────────────────────────────────────────────┘');
    process.exit(1);
  }

  // Forward to CLI transparently
  console.warn('[redirect] html2pptx.mjs is a library. Forwarding to html2pptx-cli.mjs...');
  try {
    execSync(
      `node ${JSON.stringify(cliPath)} ${userArgs.map(a => JSON.stringify(a)).join(' ')}`,
      { stdio: 'inherit', cwd: process.cwd() }
    );
  } catch (e) {
    // execSync throws on non-zero exit — propagate the exit code
    process.exit(e.status || 1);
  }
  process.exit(0);
}
