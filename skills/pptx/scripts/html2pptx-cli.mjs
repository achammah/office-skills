#!/usr/bin/env node
/**
 * html2pptx CLI — Convert one or more HTML slides to a single PPTX.
 *
 * Usage:
 *   Single slide (legacy):  node html2pptx-cli.mjs slide.html output.pptx
 *   Multi-slide:            node html2pptx-cli.mjs s1.html s2.html s3.html -o output.pptx
 *   Skip validation:        node html2pptx-cli.mjs s1.html -o out.pptx --skip-validation
 *
 * Automatic pipeline (runs in order):
 *   1. Pre-validate each HTML via validate_html.cjs (unless --skip-validation)
 *   2. Generate multi-slide PPTX via html2pptx.mjs
 *   3. Postflight: file check, thumbnails, overview grid, console analysis, element counts
 */

import pptxgen from 'pptxgenjs';
import html2pptx, { cleanupTempFiles, patchBulletColors, patchChartLabels } from './html2pptx.mjs';
import path from 'path';
import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const skillRoot = path.resolve(__dirname, '..');

// ── Section 1: Argument Parsing ──────────────────────────────

const rawArgs = process.argv.slice(2);

if (rawArgs.length === 0) {
  console.error(`
html2pptx CLI — Convert HTML slides to PPTX

Usage:
  Single slide:   node html2pptx-cli.mjs slide.html output.pptx
  Multi-slide:    node html2pptx-cli.mjs s1.html s2.html -o output.pptx

Options:
  -o <file.pptx>      Output file (required for multi-slide)
  --skip-validation    Skip HTML pre-validation
`);
  process.exit(1);
}

let htmlFiles = [];
let outputFile = null;
let skipValidation = false;

// Parse flags
const positional = [];
for (let i = 0; i < rawArgs.length; i++) {
  if (rawArgs[i] === '-o' && i + 1 < rawArgs.length) {
    outputFile = rawArgs[++i];
  } else if (rawArgs[i] === '--skip-validation') {
    skipValidation = true;
  } else {
    positional.push(rawArgs[i]);
  }
}

// Auto-detect legacy mode: exactly 2 positional args, no -o flag, 2nd ends in .pptx
if (!outputFile && positional.length === 2 && positional[1].endsWith('.pptx')) {
  htmlFiles = [positional[0]];
  outputFile = positional[1];
} else if (outputFile) {
  htmlFiles = positional;
} else {
  // No -o flag, and not legacy mode
  if (positional.length === 1) {
    console.error('Error: No output file specified. Use: node html2pptx-cli.mjs slide.html -o output.pptx');
  } else {
    console.error('Error: Use -o to specify output file. Example: node html2pptx-cli.mjs s1.html s2.html -o output.pptx');
  }
  process.exit(1);
}

// Validate inputs
if (htmlFiles.length === 0) {
  console.error('Error: No HTML files specified.');
  process.exit(1);
}
if (!outputFile.endsWith('.pptx')) {
  console.error(`Error: Output file must end in .pptx (got: ${outputFile})`);
  process.exit(1);
}
for (const f of htmlFiles) {
  if (!fs.existsSync(f)) {
    console.error(`Error: HTML file not found: ${f}`);
    process.exit(1);
  }
}

console.log(`html2pptx CLI — ${htmlFiles.length} slide(s) → ${outputFile}`);
console.log('');

// ── Section 2: Auto-Validation ───────────────────────────────

const validatorPath = path.join(__dirname, 'validate_html.cjs');

// Priority map for top-5 error selection (lower = fix first)
const PRIORITY = {
  // Tier 1: STRUCTURAL (fix first — these break the slide skeleton)
  'SKELETON': 1, 'PSEUDO': 1, 'NESTED-LIST': 1, 'FLEX-STACK': 1,
  // Tier 2: CONTENT (fix second — these affect readability)
  'HIERARCHY': 2, 'CONTAINER': 2, 'TAKEAWAY': 2, 'BULLET': 2, 'BULLET-CONSISTENCY': 2,
  // Tier 3: OVERFLOW/DENSITY (fix third — these affect layout fit)
  'HORIZONTAL-FILL': 3, 'FLEX-OVERFLOW': 3,
  // Tier 4: STYLE (fix fourth — visual polish)
  'COLOR': 4, 'COLOR-MAP': 4, 'HARDCODED-HEX': 4, 'SEPARATOR': 4, 'STANDARD': 4,
  // Tier 5: LAYOUT-AWARE (fix last — these are layout-specific)
  'CHART-METHOD': 5, 'CHART-INSIGHTS-PANEL': 5, 'TABLE-REQUIRED': 5, 'SVG-REQUIRED': 5,
};

if (!skipValidation && fs.existsSync(validatorPath)) {
  console.log('── Pre-Validation ──────────────────────────────');

  // 1. Run validator with --json on each file, collect structured results
  const allResults = [];
  for (const htmlFile of htmlFiles) {
    const result = spawnSync('node', [validatorPath, '--json', htmlFile], {
      encoding: 'utf8', timeout: 30000, cwd: skillRoot,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    try {
      const parsed = JSON.parse(result.stdout);
      allResults.push(...parsed);
    } catch {
      // Fallback: validator didn't produce JSON — treat as error
      allResults.push({ file: htmlFile, errors: [{ tag: 'PARSE', message: 'Validator output not parseable', fix: null }], warnings: [], errorCount: 1, warningCount: 0 });
    }
  }

  // 2. Flatten all errors with priority
  const allErrors = [];
  for (const r of allResults) {
    for (const e of r.errors) {
      const prio = PRIORITY[e.tag] || (e.message && e.message.toLowerCase().includes('content height') ? 3 : 3);
      allErrors.push({ ...e, file: path.basename(r.file), priority: prio });
    }
  }
  const allWarnings = [];
  for (const r of allResults) {
    for (const w of r.warnings) {
      allWarnings.push({ ...w, file: path.basename(r.file) });
    }
  }

  // 3. Load state file
  const workspaceDir = path.dirname(path.resolve(htmlFiles[0]));
  const stateFile = path.join(workspaceDir, '.validation-state.json');
  let state = { runCount: 0, errors: {}, previousRunErrorKeys: [] };
  try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch {}
  state.runCount++;

  // 4. Generate error keys, update state
  const currentErrorKeys = new Set();
  for (const e of allErrors) {
    const key = `${e.file}:[${e.tag}]:${e.message.slice(0,80).replace(/\d+/g,'N')}`;
    currentErrorKeys.add(key);
    if (state.errors[key]) {
      state.errors[key].lastSeenRun = state.runCount;
      state.errors[key].attempts++;
      state.errors[key].message = e.message;
    } else {
      state.errors[key] = {
        tag: e.tag, file: e.file, message: e.message, fix: e.fix,
        firstSeenRun: state.runCount, lastSeenRun: state.runCount, attempts: 1
      };
    }
  }

  // 5. Progress diff (only on run 2+)
  if (state.runCount > 1 && state.previousRunErrorKeys.length > 0) {
    const prevKeys = new Set(state.previousRunErrorKeys);
    const fixed = [...prevKeys].filter(k => !currentErrorKeys.has(k));
    const remaining = [...prevKeys].filter(k => currentErrorKeys.has(k));
    const newErrors = [...currentErrorKeys].filter(k => !prevKeys.has(k));
    console.log('');
    console.log('── Progress (vs previous run) ──────────────────');
    console.log(`  Fixed:     ${fixed.length} error(s)`);
    console.log(`  Remaining: ${remaining.length} error(s)`);
    console.log(`  New:       ${newErrors.length} error(s) ${newErrors.length > 0 ? '(possible regressions from fixes)' : ''}`);
    console.log(`  Overall: ${state.previousRunErrorKeys.length} -> ${allErrors.length} errors`);
    console.log('');
  }

  // 6. Sort by priority, show TOP 5 only
  allErrors.sort((a, b) => a.priority - b.priority);
  const top5 = allErrors.slice(0, 5);
  const remainingCount = allErrors.length - top5.length;

  if (allErrors.length > 0) {
    console.log(`── Top ${Math.min(5, allErrors.length)} Errors (of ${allErrors.length} total) ──`);
    for (const e of top5) {
      const key = `${e.file}:[${e.tag}]:${e.message.slice(0,80).replace(/\d+/g,'N')}`;
      const attempts = state.errors[key]?.attempts || 1;
      const attemptLabel = attempts >= 5 ? ` [${attempts} attempts — qualifies for --skip-validation]` : ` [attempt ${attempts}/5]`;
      console.log(`  ${e.file}: [${e.tag}] ${e.message}${attemptLabel}`);
      if (e.fix) console.log(`    FIX: ${e.fix}`);
    }
    if (remainingCount > 0) {
      console.log(`  ...and ${remainingCount} more error(s). Fix these ${top5.length} first, then re-run.`);
    }
    console.log('');

    // 7. Print ready-to-use TodoWrite call
    console.log('── Suggested TodoWrite call (copy and execute) ──');
    const todoEntries = top5.map(e => {
      const fixNote = e.fix ? ` FIX: ${e.fix}` : '';
      return `  { content: "[${e.tag}] ${e.file}: ${e.message.replace(/"/g, '\\"')}${fixNote.replace(/"/g, '\\"')}", status: "pending", activeForm: "Fixing ${e.tag} error on ${e.file}" }`;
    });
    console.log(`TodoWrite(todos=[`);
    console.log(todoEntries.join(',\n'));
    console.log(`])`);
    console.log('');
  }

  // Show warnings summary (non-blocking)
  if (allWarnings.length > 0) {
    console.log(`  ${allWarnings.length} warning(s) (non-blocking).`);
    console.log('');
  }

  // 8. Save state
  state.previousRunErrorKeys = [...currentErrorKeys];
  state.lastRunTimestamp = new Date().toISOString();
  // Clean up state entries that are no longer seen
  for (const key of Object.keys(state.errors)) {
    if (!currentErrorKeys.has(key) && state.errors[key].lastSeenRun < state.runCount) {
      delete state.errors[key];
    }
  }
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

  // 9. Fail or pass
  if (allErrors.length > 0) {
    console.error(`Validation FAILED — ${allErrors.length} error(s) across ${allResults.filter(r => r.errorCount > 0).length} file(s).`);
    console.error('Fix the top 5 errors shown above, then re-run. Do NOT use --skip-validation');
    console.error('unless the error has 5+ attempts with different approaches (see attempt counter above).');
    console.error('Structural slides (cover, agenda, summary, closing): add data-slide-type="structural" to <body> to skip inapplicable checks.');
    process.exit(1);
  }

  console.log('  All files passed validation.');
  console.log('');
} else if (skipValidation) {
  console.warn('VALIDATION SKIPPED via --skip-validation.');
  console.warn('  Pre-conditions for using this flag:');
  console.warn('  1. All errors logged in TodoWrite with fix attempts documented');
  console.warn('  2. 5+ fix attempts on persistent errors with different approaches');
  console.warn('  3. Persistent errors confirmed as false positives');
  console.warn('  If these conditions are NOT met, remove --skip-validation and fix the errors.');
  console.log('');
}

// ── Section 3: Multi-Slide PPTX Generation ───────────────────

async function main() {
  try {
    console.log('── Generation ──────────────────────────────────');

    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'Claude Code';
    if (htmlFiles.length === 1) {
      pptx.title = path.basename(htmlFiles[0], '.html');
    }

    const allTempFiles = [];
    const capturedWarnings = [];
    const perSlideInfo = [];
    const allChartPatches = [];

    // Capture console.warn during generation
    const originalWarn = console.warn;
    console.warn = (...args) => {
      const msg = args.map(a => String(a)).join(' ');
      capturedWarnings.push(msg);
      originalWarn.apply(console, args);
    };

    for (let i = 0; i < htmlFiles.length; i++) {
      const htmlFile = htmlFiles[i];
      const slideNum = i + 1;
      const prefix = outputFile.replace(/\.pptx$/i, '');
      const screenshotPath = `${prefix}-slide-${String(slideNum).padStart(3, '0')}-html-preview.png`;

      console.log(`  Slide ${slideNum}/${htmlFiles.length}: ${path.basename(htmlFile)}`);

      const { slide, placeholders, tempFiles, chartPatches } = await html2pptx(htmlFile, pptx, {
        screenshotPath
      });

      allTempFiles.push(...(tempFiles || []));
      if (chartPatches) allChartPatches.push(...chartPatches);

      // Count elements in HTML for postflight
      const htmlContent = fs.readFileSync(htmlFile, 'utf8');
      perSlideInfo.push({
        file: htmlFile,
        screenshotPath,
        charts: (htmlContent.match(/data-echarts/g) || []).length,
        bullets: (htmlContent.match(/<li[\s>]/g) || []).length,
        tableRows: (htmlContent.match(/<tr[\s>]/g) || []).length,
        svgs: (htmlContent.match(/<svg[\s>]/g) || []).length,
        images: (htmlContent.match(/<img[\s>]/g) || []).length,
        placeholders: placeholders.length
      });
    }

    // Restore console.warn
    console.warn = originalWarn;

    console.log('  Writing PPTX...');
    await pptx.writeFile({ fileName: outputFile });

    // Patch bullet colors
    await patchBulletColors(outputFile);

    // Patch chart labels (rotation, multi-line, font size, font stacks, line spacing)
    await patchChartLabels(outputFile, allChartPatches);

    console.log('  Cleaning up temp files...');
    cleanupTempFiles(allTempFiles);

    console.log('');

    // ── Section 4: Built-in Postflight ─────────────────────────

    console.log('── Postflight ──────────────────────────────────');

    // 4a: File verification
    let postflightIssues = 0;
    if (fs.existsSync(outputFile)) {
      const stats = fs.statSync(outputFile);
      if (stats.size > 0) {
        console.log(`  [file] ${outputFile} — ${(stats.size / 1024).toFixed(1)} KB — PASS`);
      } else {
        console.log(`  [file] ${outputFile} — EMPTY — FAIL`);
        postflightIssues++;
      }
    } else {
      console.log(`  [file] ${outputFile} — NOT FOUND — FAIL`);
      postflightIssues++;
    }

    // 4b: Per-slide thumbnails via thumbnail.py
    const thumbnailScript = path.join(__dirname, 'thumbnail.py');
    const prefix = outputFile.replace(/\.pptx$/i, '');
    let thumbnailsGenerated = false;

    if (fs.existsSync(thumbnailScript)) {
      try {
        const thumbCmd = `python3 "${thumbnailScript}" --full-size --dpi 200 "${outputFile}" "${prefix}"`;
        spawnSync('python3', [thumbnailScript, '--full-size', '--dpi', '200', outputFile, prefix], {
          encoding: 'utf8',
          timeout: 60000,
          cwd: __dirname,
          env: { ...process.env, PATH: '/Applications/LibreOffice.app/Contents/MacOS:' + process.env.PATH },
          stdio: ['pipe', 'pipe', 'pipe']
        });

        // Check if thumbnails were created
        const firstThumb = `${prefix}-slide-001.png`;
        if (fs.existsSync(firstThumb)) {
          thumbnailsGenerated = true;
          const thumbCount = htmlFiles.length;
          console.log(`  [thumbnails] ${thumbCount} slide thumbnail(s) generated — PASS`);
          for (let i = 1; i <= thumbCount; i++) {
            const thumbPath = `${prefix}-slide-${String(i).padStart(3, '0')}.png`;
            if (fs.existsSync(thumbPath)) {
              const absThumbPath = path.resolve(thumbPath);
              console.log(`    ▸ READ: ${absThumbPath}`);
            }
          }
        } else {
          console.log('  [thumbnails] Generation failed (LibreOffice may be unavailable) — WARN');
        }
      } catch (e) {
        console.log(`  [thumbnails] Generation failed: ${e.message} — WARN`);
      }
    } else {
      console.log('  [thumbnails] thumbnail.py not found — WARN');
    }

    // 4c: Combined overview grid via Sharp (when 2+ slides with thumbnails)
    if (thumbnailsGenerated && htmlFiles.length >= 2) {
      try {
        const sharp = (await import('sharp')).default;
        const maxCols = 4;
        const thumbWidth = 480;
        const padding = 10;

        const thumbPaths = [];
        for (let i = 1; i <= htmlFiles.length; i++) {
          const tp = `${prefix}-slide-${String(i).padStart(3, '0')}.png`;
          if (fs.existsSync(tp)) thumbPaths.push(tp);
        }

        if (thumbPaths.length >= 2) {
          // Read first thumbnail to get aspect ratio
          const firstMeta = await sharp(thumbPaths[0]).metadata();
          const aspect = firstMeta.height / firstMeta.width;
          const thumbHeight = Math.round(thumbWidth * aspect);

          const cols = Math.min(maxCols, thumbPaths.length);
          const rows = Math.ceil(thumbPaths.length / cols);
          const gridWidth = cols * thumbWidth + (cols + 1) * padding;
          const gridHeight = rows * thumbHeight + (rows + 1) * padding;

          // Resize all thumbnails
          const composites = [];
          for (let i = 0; i < thumbPaths.length; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const resized = await sharp(thumbPaths[i])
              .resize(thumbWidth, thumbHeight, { fit: 'fill' })
              .toBuffer();
            composites.push({
              input: resized,
              left: padding + col * (thumbWidth + padding),
              top: padding + row * (thumbHeight + padding)
            });
          }

          const gridPath = `${prefix}-overview-grid.png`;
          await sharp({
            create: {
              width: gridWidth,
              height: gridHeight,
              channels: 4,
              background: { r: 255, g: 255, b: 255, alpha: 1 }
            }
          })
            .composite(composites)
            .png()
            .toFile(gridPath);

          console.log(`  [grid] Overview grid: ${path.basename(gridPath)} — PASS`);
        }
      } catch (e) {
        console.log(`  [grid] Could not create overview grid: ${e.message} — WARN`);
      }
    }

    // 4d: Console output analysis
    console.log('');
    console.log('  ── Console Analysis ──');

    const colorWarnings = capturedWarnings.filter(w => w.includes('Replaced non-brand color'));
    const overflowWarnings = capturedWarnings.filter(w =>
      w.includes('[overflow]') || w.includes('content-zone overflows')
    );
    const cssWarnings = capturedWarnings.filter(w => w.includes('[BLOCKING] [css-survival]'));
    const errors = capturedWarnings.filter(w => w.includes('FATAL:') || w.includes('Error:'));
    const overrides = capturedWarnings.filter(w => w.includes('[override]'));

    let hasHardStop = false;

    if (colorWarnings.length > 0) {
      console.log(`  [colors] ${colorWarnings.length} non-brand color replacement(s) — HARD STOP`);
      colorWarnings.forEach(w => console.log(`    ${w}`));
      hasHardStop = true;
      postflightIssues++;
    } else {
      console.log('  [colors] Brand compliance — PASS');
    }

    if (overflowWarnings.length > 0) {
      console.log(`  [overflow] ${overflowWarnings.length} overflow warning(s) — WARN`);
      overflowWarnings.forEach(w => console.log(`    ${w}`));
    } else {
      console.log('  [overflow] No overflow — PASS');
    }

    if (cssWarnings.length > 0) {
      console.log(`  [css-survival] ${cssWarnings.length} CSS survival issue(s) — WARN`);
      postflightIssues++;
    } else {
      console.log('  [css-survival] CSS survival — PASS');
    }

    if (errors.length > 0) {
      console.log(`  [errors] ${errors.length} error(s) — FAIL`);
      errors.forEach(w => console.log(`    ${w}`));
      postflightIssues++;
    } else {
      console.log('  [errors] No errors — PASS');
    }

    if (overrides.length > 0) {
      console.log(`  [overrides] ${overrides.length} override(s) — INFO`);
    }

    // 4e: Element count summary
    console.log('');
    console.log('  ── Element Counts ──');
    for (let i = 0; i < perSlideInfo.length; i++) {
      const info = perSlideInfo[i];
      console.log(`  Slide ${i + 1} (${path.basename(info.file)}): ` +
        `${info.charts} chart(s), ${info.bullets} bullet(s), ` +
        `${info.tableRows} row(s), ${info.svgs} SVG(s), ${info.images} image(s)`);
    }

    // Final summary
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    if (postflightIssues === 0 && !hasHardStop) {
      console.log(`\u2713 READY FOR REVIEW — ${htmlFiles.length} slide(s) in ${outputFile}`);
    } else {
      console.log(`\u2717 ISSUES FOUND (${postflightIssues}) — Review postflight report above`);
    }
    console.log('═══════════════════════════════════════════════════');

    // Output files summary
    console.log('');
    console.log('Output files:');
    console.log(`  PPTX:       ${path.resolve(outputFile)}`);
    for (let i = 0; i < perSlideInfo.length; i++) {
      const slideNum = i + 1;
      const thumbPath = `${prefix}-slide-${String(slideNum).padStart(3, '0')}.png`;
      if (fs.existsSync(thumbPath)) {
        console.log(`  Thumbnail:  ${path.resolve(thumbPath)}`);
      }
      if (fs.existsSync(perSlideInfo[i].screenshotPath)) {
        console.log(`  HTML preview: ${path.resolve(perSlideInfo[i].screenshotPath)}`);
      }
    }
    const gridPath = `${prefix}-overview-grid.png`;
    if (fs.existsSync(gridPath)) {
      console.log(`  Grid:       ${path.resolve(gridPath)}`);
    }

    console.log('');
    console.log('⚠️  VISUAL INSPECTION REQUIRED: Use the Read tool to open EACH thumbnail PNG listed above.');
    console.log('    Do NOT skip this step. Do NOT declare done without reading every thumbnail.');

    // Exit with error if hard stop issues
    if (hasHardStop) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`\u2717 Error: ${error.message}`);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

main();
