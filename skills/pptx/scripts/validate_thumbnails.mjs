#!/usr/bin/env node
/**
 * validate_thumbnails.mjs — Automated visual regression checks for PPTX thumbnails
 *
 * Checks:
 * 1. Black-box detection: mostly-black image → possible chart rendering failure
 * 2. Empty-slide detection: mostly-white image → possible empty/missing content
 * 3. Low color variance: uniform image → possible missing content or broken render
 *
 * Usage:
 *   node scripts/validate_thumbnails.mjs <thumbnail1.png> [thumbnail2.png] ...
 *
 * Exit codes:
 *   0 = all checks passed
 *   1 = critical issues found
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

async function validateThumbnail(filePath) {
  const issues = [];
  const warnings = [];

  if (!fs.existsSync(filePath)) {
    issues.push(`File not found: ${filePath}`);
    return { filePath, issues, warnings };
  }

  const stats = await sharp(filePath).stats();
  const channels = stats.channels; // array of { min, max, sum, squaresSum, mean, stdev, ... }

  // 1. Black-box detection: channel means < 30 → mostly black
  const darkChannels = channels.filter(c => c.mean < 30);
  if (darkChannels.length >= channels.length * 0.5) {
    issues.push(`Mostly BLACK (channel means: ${channels.map(c => c.mean.toFixed(0)).join(', ')}) — possible chart rendering failure (CSS var in ECharts?)`);
  }

  // 2. Empty-slide detection: all channel means > 240 → mostly white
  const brightChannels = channels.filter(c => c.mean > 240);
  if (brightChannels.length >= Math.min(3, channels.length)) {
    issues.push(`Mostly WHITE (channel means: ${channels.map(c => c.mean.toFixed(0)).join(', ')}) — possible empty slide or missing content`);
  }

  // 3. Low color variance: average stdev < 20 → very uniform
  const avgStdev = channels.reduce((sum, c) => sum + c.stdev, 0) / channels.length;
  if (avgStdev < 20) {
    warnings.push(`Low color variance (avg stdev: ${avgStdev.toFixed(1)}) — possible missing content or broken render`);
  }

  return { filePath, issues, warnings };
}

// CLI
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: node scripts/validate_thumbnails.mjs <thumbnail1.png> [thumbnail2.png] ...');
  process.exit(0);
}

let hasIssues = false;

for (const file of args) {
  const result = await validateThumbnail(file);
  const name = path.basename(result.filePath);

  if (result.issues.length > 0) {
    console.log(`\n  FAIL: ${name}`);
    result.issues.forEach(i => console.log(`    [CRITICAL] ${i}`));
    hasIssues = true;
  }

  if (result.warnings.length > 0) {
    if (result.issues.length === 0) console.log(`\n  WARN: ${name}`);
    result.warnings.forEach(w => console.log(`    [WARNING] ${w}`));
  }

  if (result.issues.length === 0 && result.warnings.length === 0) {
    console.log(`  PASS: ${name}`);
  }
}

process.exit(hasIssues ? 1 : 0);
