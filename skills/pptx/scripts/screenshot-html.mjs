#!/usr/bin/env node
/**
 * screenshot-html.mjs — Take a PNG screenshot of an HTML slide
 *
 * Uses Playwright to render the HTML with brand CSS injected (same as html2pptx.mjs).
 * No LibreOffice dependency — works anywhere Playwright is available.
 *
 * Usage: node scripts/screenshot-html.mjs <input.html> <output.png>
 */

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadBranding, generateInjectableCSS } from '../branding/branding.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node scripts/screenshot-html.mjs <input.html> <output.png>');
  process.exit(1);
}

const [htmlFile, outputFile] = args;
const htmlPath = path.resolve(htmlFile);

// Load brand CSS (same as html2pptx.mjs)
const brandId = process.env.PPTX_BRAND || 'mckinsey';
loadBranding(brandId);
const brandCSS = generateInjectableCSS({ includeHelpers: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 2,
  });

  await page.goto(`file://${htmlPath}`);

  // Inject brand CSS (same as html2pptx.mjs injectBrandCSS)
  await page.evaluate((css) => {
    const style = document.createElement('style');
    style.id = 'brand-injection-v2';
    style.textContent = css;
    document.head.insertBefore(style, document.head.firstChild);
  }, brandCSS);

  // Warn about blank chart areas (charts are rendered during PPTX generation, not in HTML)
  const chartCount = await page.evaluate(() =>
    document.querySelectorAll('[data-echarts]').length
  );
  if (chartCount > 0) {
    console.log(`Note: Found ${chartCount} chart placeholder(s) — these appear blank in HTML screenshots. Charts are rendered during PPTX generation.`);
  }

  // Wait for fonts and rendering to settle
  await page.waitForTimeout(500);

  await page.screenshot({ path: path.resolve(outputFile), fullPage: false });
  await browser.close();

  console.log(`✓ Screenshot saved: ${outputFile}`);
}

main().catch(err => {
  console.error(`✗ Screenshot failed: ${err.message}`);
  process.exit(1);
});
