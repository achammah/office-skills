#!/usr/bin/env node
/**
 * Batch QA Pipeline — validate, generate PPTX, create reference thumbnails
 *
 * For each examples/**\/*.html:
 *   1. Validate with validate_html.cjs
 *   2. Generate PPTX via html2pptx
 *   3. Generate single-slide thumbnail via thumbnail.py
 *   4. Copy thumbnail as <template>_reference.png alongside the HTML
 *
 * Usage:
 *   node scripts/batch_qa.mjs                  # process all templates
 *   node scripts/batch_qa.mjs --folder data-trend  # process one folder
 *   node scripts/batch_qa.mjs --skip-validation     # skip HTML validation step
 */

import { execSync, spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Import validator (CJS module)
const require2 = createRequire(import.meta.url);
const { validateSlideHTML } = require2('./validate_html.cjs');

// Parse CLI args
const args = process.argv.slice(2);
let folderFilter = null;
let skipValidation = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--folder' && args[i + 1]) {
    folderFilter = args[i + 1];
    i++;
  }
  if (args[i] === '--skip-validation') skipValidation = true;
}

// Output directories
const QA_OUTPUT = path.join(ROOT, 'qa-output');

// Ensure output dir exists
fs.mkdirSync(QA_OUTPUT, { recursive: true });

// Find all HTML template files
function findTemplates() {
  const examplesDir = path.join(ROOT, 'examples');
  const folders = fs.readdirSync(examplesDir).filter(f =>
    fs.statSync(path.join(examplesDir, f)).isDirectory()
  ).sort();

  const templates = [];
  for (const folder of folders) {
    if (folderFilter && folder !== folderFilter) continue;
    const folderPath = path.join(examplesDir, folder);
    const htmlFiles = fs.readdirSync(folderPath)
      .filter(f => f.endsWith('.html'))
      .sort();
    for (const htmlFile of htmlFiles) {
      templates.push({
        folder,
        name: path.basename(htmlFile, '.html'),
        htmlPath: path.join(folderPath, htmlFile),
        folderPath,
      });
    }
  }
  return templates;
}

// Validate a single template
function validate(template) {
  try {
    const result = validateSlideHTML(template.htmlPath);
    return {
      errors: result.errors || [],
      warnings: result.warnings || [],
    };
  } catch (e) {
    return { errors: [`Validation crashed: ${e.message}`], warnings: [] };
  }
}

// Generate PPTX for a single template
function generatePptx(template) {
  const outDir = path.join(QA_OUTPUT, template.folder);
  fs.mkdirSync(outDir, { recursive: true });
  const pptxPath = path.join(outDir, `${template.name}.pptx`);

  const cliScript = path.join(__dirname, 'html2pptx-cli.mjs');
  const result = spawnSync('node', [cliScript, template.htmlPath, pptxPath], {
    cwd: ROOT,
    timeout: 120000, // 2 min per file
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, NODE_PATH: path.join(ROOT, 'node_modules'), PPTX_STRICT: 'false' },
  });

  const stdout = result.stdout ? result.stdout.toString() : '';
  const stderr = result.stderr ? result.stderr.toString() : '';

  if (result.status !== 0) {
    return { success: false, pptxPath: null, output: stderr || stdout, consoleOutput: stdout + stderr };
  }
  if (!fs.existsSync(pptxPath)) {
    return { success: false, pptxPath: null, output: 'PPTX file not created', consoleOutput: stdout + stderr };
  }
  return { success: true, pptxPath, output: stdout, consoleOutput: stdout + stderr };
}

// Generate full-size PNG export and copy as reference PNG
function generateThumbnail(template, pptxPath) {
  const thumbnailScript = path.join(__dirname, 'thumbnail.py');
  const tmpPrefix = path.join(QA_OUTPUT, template.folder, `${template.name}_export`);

  // Add LibreOffice to PATH for soffice command (macOS)
  const thumbEnv = { ...process.env };
  const libreOfficePath = '/Applications/LibreOffice.app/Contents/MacOS';
  if (fs.existsSync(libreOfficePath)) {
    thumbEnv.PATH = `${libreOfficePath}:${thumbEnv.PATH || ''}`;
  }

  // Use --full-size for high-res PNG export (200 DPI, lossless PNG)
  const result = spawnSync('python3', [thumbnailScript, pptxPath, tmpPrefix, '--full-size', '--dpi', '200'], {
    cwd: path.join(__dirname),  // thumbnail.py imports inventory.py from same dir
    timeout: 60000,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: thumbEnv,
  });

  // Full-size mode outputs: {prefix}-slide-001.png
  const exportPath = `${tmpPrefix}-slide-001.png`;
  if (result.status !== 0 || !fs.existsSync(exportPath)) {
    const stderr = result.stderr ? result.stderr.toString() : '';
    return { success: false, error: stderr || 'PNG export failed' };
  }

  // Copy as _reference.png alongside HTML (full-size, high-res PNG)
  const refPath = path.join(template.folderPath, `${template.name}_reference.png`);
  fs.copyFileSync(exportPath, refPath);

  return { success: true, refPath };
}

// Main pipeline
async function main() {
  const templates = findTemplates();
  console.log(`\n=== Batch QA Pipeline ===`);
  console.log(`Templates found: ${templates.length}`);
  if (folderFilter) console.log(`Folder filter: ${folderFilter}`);
  console.log('');

  const results = {
    total: templates.length,
    validationPassed: 0,
    validationFailed: 0,
    validationSkipped: 0,
    generationPassed: 0,
    generationFailed: 0,
    thumbnailPassed: 0,
    thumbnailFailed: 0,
    files: [],
  };

  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    const progress = `[${i + 1}/${templates.length}]`;
    const label = `${t.folder}/${t.name}`;

    // Step 1: Validate
    let validationResult = { errors: [], warnings: [] };
    if (!skipValidation) {
      validationResult = validate(t);
      if (validationResult.errors.length > 0) {
        console.log(`${progress} ${label} \u2014 VALIDATION FAILED (${validationResult.errors.length} errors)`);
        validationResult.errors.forEach(e => console.log(`         \u2717 ${e}`));
        results.validationFailed++;
        results.files.push({
          template: label,
          status: 'validation_failed',
          errors: validationResult.errors,
          warnings: validationResult.warnings,
        });
        continue;
      }
      results.validationPassed++;
    } else {
      results.validationSkipped++;
    }

    // Step 2: Generate PPTX
    const genResult = generatePptx(t);
    if (!genResult.success) {
      console.log(`${progress} ${label} \u2014 GENERATION FAILED`);
      console.log(`         \u2717 ${genResult.output.split('\n')[0]}`);
      results.generationFailed++;
      results.files.push({
        template: label,
        status: 'generation_failed',
        error: genResult.output,
        warnings: validationResult.warnings,
        consoleOutput: genResult.consoleOutput,
      });
      continue;
    }
    results.generationPassed++;

    // Step 3: Generate thumbnail + reference PNG
    const thumbResult = generateThumbnail(t, genResult.pptxPath);
    if (!thumbResult.success) {
      console.log(`${progress} ${label} \u2014 THUMBNAIL FAILED`);
      console.log(`         \u2717 ${thumbResult.error.split('\n')[0]}`);
      results.thumbnailFailed++;
      results.files.push({
        template: label,
        status: 'thumbnail_failed',
        error: thumbResult.error,
        warnings: validationResult.warnings,
        consoleOutput: genResult.consoleOutput,
      });
      continue;
    }
    results.thumbnailPassed++;

    // Check for color warnings in console output
    const colorWarnings = (genResult.consoleOutput || '').split('\n')
      .filter(line => line.includes('Replaced non-brand color'));
    const overflowWarnings = (genResult.consoleOutput || '').split('\n')
      .filter(line => line.includes('[overflow]'));

    const statusIcon = (colorWarnings.length > 0 || overflowWarnings.length > 0) ? '\u26A0' : '\u2713';
    console.log(`${progress} ${label} \u2014 ${statusIcon} OK \u2192 ${thumbResult.refPath}`);
    if (colorWarnings.length > 0) {
      console.log(`         \u26A0 ${colorWarnings.length} color replacement warnings`);
    }
    if (overflowWarnings.length > 0) {
      console.log(`         \u26A0 ${overflowWarnings.length} overflow warnings`);
    }

    results.files.push({
      template: label,
      status: 'success',
      pptxPath: genResult.pptxPath,
      refPath: thumbResult.refPath,
      warnings: validationResult.warnings,
      colorWarnings: colorWarnings.length,
      overflowWarnings: overflowWarnings.length,
      consoleOutput: genResult.consoleOutput,
    });
  }

  // Summary
  console.log(`\n=== Summary ===`);
  console.log(`Total templates:     ${results.total}`);
  if (!skipValidation) {
    console.log(`Validation passed:   ${results.validationPassed}`);
    console.log(`Validation failed:   ${results.validationFailed}`);
  }
  console.log(`Generation passed:   ${results.generationPassed}`);
  console.log(`Generation failed:   ${results.generationFailed}`);
  console.log(`Thumbnails created:  ${results.thumbnailPassed}`);
  console.log(`Thumbnail failed:    ${results.thumbnailFailed}`);

  // Count files with warnings
  const withColorWarnings = results.files.filter(f => f.colorWarnings > 0).length;
  const withOverflowWarnings = results.files.filter(f => f.overflowWarnings > 0).length;
  if (withColorWarnings > 0) console.log(`\u26A0 Color warnings:   ${withColorWarnings} files`);
  if (withOverflowWarnings > 0) console.log(`\u26A0 Overflow warnings: ${withOverflowWarnings} files`);

  // Write summary JSON
  const summaryPath = path.join(QA_OUTPUT, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));
  console.log(`\nSummary saved to: ${summaryPath}`);

  // Exit with error code if any failures
  const totalFailures = results.validationFailed + results.generationFailed + results.thumbnailFailed;
  if (totalFailures > 0) {
    console.log(`\n\u2717 ${totalFailures} failures \u2014 review above output`);
    process.exit(1);
  }
  console.log(`\n\u2713 All ${results.total} templates processed successfully`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
