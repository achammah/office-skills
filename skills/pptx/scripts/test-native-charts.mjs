#!/usr/bin/env node
/**
 * Native Charts Comparison Test Harness
 *
 * For each test case, generates two PPTX files:
 *   1. *_native.pptx  — native PptxGenJS charts (new behavior)
 *   2. *_raster.pptx  — rasterized SVG→PNG charts (existing behavior)
 *
 * Also generates synthetic test charts guaranteed to be translatable.
 *
 * Usage:
 *   node scripts/test-native-charts.mjs                     # Run all
 *   node scripts/test-native-charts.mjs --only clustered-bar # Run one
 *   node scripts/test-native-charts.mjs --synthetic-only     # Synthetics only
 *   node scripts/test-native-charts.mjs --dirs data-ranking,data-correlation  # Specific dirs
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const OUTPUT_DIR = path.join(ROOT, 'test-output', 'native-charts');

// ═══════════════════════════════════════════════════════════════════════════════
// CLI ARGUMENT PARSING
// ═══════════════════════════════════════════════════════════════════════════════

const args = process.argv.slice(2);
const onlyFilter = args.find(a => a.startsWith('--only='))?.split('=')[1]
    || (args.indexOf('--only') !== -1 ? args[args.indexOf('--only') + 1] : null);
const syntheticOnly = args.includes('--synthetic-only');
const dirsArg = args.find(a => a.startsWith('--dirs='))?.split('=')[1];
const defaultDirs = ['data-ranking', 'data-breakdown', 'data-trend', 'data-correlation', 'compare-gap'];
const targetDirs = dirsArg ? dirsArg.split(',') : defaultDirs;

// ═══════════════════════════════════════════════════════════════════════════════
// SYNTHETIC TEST CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

const SYNTHETIC_CHARTS = [
    {
        name: 'synthetic-bar',
        description: 'Simple vertical bar (3 categories, 2 series)',
        html: `<!DOCTYPE html>
<html><head><style>
body { width: 960px; height: 540px; margin: 0; font-family: Arial, sans-serif; }
.slide { width: 960px; height: 540px; position: relative; }
h1 { font-size: 20px; padding: 20px 30px 0; margin: 0; }
.chart { position: absolute; left: 60px; top: 80px; width: 500px; height: 350px; }
</style></head><body><div class="slide">
<h1>Synthetic Bar Chart Test</h1>
<div class="chart" data-echarts='${JSON.stringify({
            series: [
                { type: "bar", data: [120, 200, 150], name: "Revenue" },
                { type: "bar", data: [80, 150, 100], name: "Profit" }
            ],
            xAxis: { type: "category", data: ["Q1", "Q2", "Q3"] },
            yAxis: { type: "value" }
        })}'></div>
</div></body></html>`
    },
    {
        name: 'synthetic-line',
        description: 'Category line chart (6 months, 2 lines)',
        html: `<!DOCTYPE html>
<html><head><style>
body { width: 960px; height: 540px; margin: 0; font-family: Arial, sans-serif; }
.slide { width: 960px; height: 540px; position: relative; }
h1 { font-size: 20px; padding: 20px 30px 0; margin: 0; }
.chart { position: absolute; left: 60px; top: 80px; width: 500px; height: 350px; }
</style></head><body><div class="slide">
<h1>Synthetic Line Chart Test</h1>
<div class="chart" data-echarts='${JSON.stringify({
            series: [
                { type: "line", data: [10, 22, 18, 35, 28, 42], name: "Actual", showSymbol: false, lineStyle: { width: 2.5 } },
                { type: "line", data: [15, 20, 25, 30, 35, 40], name: "Target", showSymbol: false, lineStyle: { width: 2, type: "dashed" } }
            ],
            xAxis: { type: "category", data: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"] },
            yAxis: { type: "value" },
            legend: { show: true, bottom: 0 }
        })}'></div>
</div></body></html>`
    },
    {
        name: 'synthetic-donut',
        description: 'Donut chart (4 slices)',
        html: `<!DOCTYPE html>
<html><head><style>
body { width: 960px; height: 540px; margin: 0; font-family: Arial, sans-serif; }
.slide { width: 960px; height: 540px; position: relative; }
h1 { font-size: 20px; padding: 20px 30px 0; margin: 0; }
.chart { position: absolute; left: 180px; top: 80px; width: 400px; height: 380px; }
</style></head><body><div class="slide">
<h1>Synthetic Donut Chart Test</h1>
<div class="chart" data-echarts='${JSON.stringify({
            series: [{
                type: "pie",
                radius: ["35%", "65%"],
                data: [
                    { value: 45, name: "Direct" },
                    { value: 28, name: "Indirect" },
                    { value: 18, name: "Referral" },
                    { value: 9, name: "Other" }
                ],
                label: { show: true, position: "outside" }
            }]
        })}'></div>
</div></body></html>`
    },
    {
        name: 'synthetic-scatter',
        description: 'Scatter chart (16 data points, value axes)',
        html: `<!DOCTYPE html>
<html><head><style>
body { width: 960px; height: 540px; margin: 0; font-family: Arial, sans-serif; }
.slide { width: 960px; height: 540px; position: relative; }
h1 { font-size: 20px; padding: 20px 30px 0; margin: 0; }
.chart { position: absolute; left: 60px; top: 80px; width: 500px; height: 350px; }
</style></head><body><div class="slide">
<h1>Synthetic Scatter Chart Test</h1>
<div class="chart" data-echarts='${JSON.stringify({
            series: [{
                type: "scatter",
                symbolSize: 8,
                data: [
                    [10, 8.04], [8, 6.95], [13, 7.58], [9, 8.81],
                    [11, 8.33], [14, 9.96], [6, 7.24], [4, 4.26],
                    [12, 10.84], [7, 4.82], [5, 5.68], [15, 12.1],
                    [3, 2.5], [16, 13.2], [2, 1.8], [17, 14.5]
                ],
                name: "Observations",
                itemStyle: { color: "var(--brand-primary)" }
            }],
            xAxis: {
                type: "value", min: 0, max: 20,
                axisLabel: { show: true, fontSize: 10, color: "var(--brand-text)" },
                axisLine: { show: true, lineStyle: { color: "var(--brand-gray-dark)" } },
                splitLine: { show: true, lineStyle: { color: "var(--brand-gray-border)", type: "solid", width: 0.5 } }
            },
            yAxis: {
                type: "value", min: 0, max: 16,
                axisLabel: { show: true, fontSize: 10, color: "var(--brand-text)" },
                axisLine: { show: true, lineStyle: { color: "var(--brand-gray-dark)" } },
                splitLine: { show: true, lineStyle: { color: "var(--brand-gray-border)", type: "solid", width: 0.5 } }
            },
            legend: { show: false },
            tooltip: { show: false }
        })}'></div>
</div></body></html>`
    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════════════════════════

function ensureOutputDir() {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
}

function runHtml2Pptx(htmlPath, outputPath, extraEnv = {}) {
    const cliPath = path.join(ROOT, 'scripts', 'html2pptx-cli.mjs');
    const env = { ...process.env, PPTX_SKIP_FLEX_CHECK: '1', ...extraEnv };
    try {
        const result = execSync(
            `node "${cliPath}" "${htmlPath}" -o "${outputPath}" --skip-validation`,
            { encoding: 'utf8', timeout: 120000, env, cwd: ROOT }
        );
        return { success: true, output: result };
    } catch (e) {
        // Combine stdout + stderr so native chart logs are visible even on validation errors
        const combined = [e.stdout, e.stderr, e.message].filter(Boolean).join('\n');
        return { success: false, output: combined };
    }
}

function collectExampleHtmlFiles() {
    const files = [];
    for (const dir of targetDirs) {
        const dirPath = path.join(ROOT, 'examples', dir);
        if (!fs.existsSync(dirPath)) continue;
        const htmlFiles = fs.readdirSync(dirPath).filter(f => f.endsWith('.html'));
        for (const f of htmlFiles) {
            files.push({
                name: f.replace('.html', ''),
                path: path.join(dirPath, f),
                dir,
            });
        }
    }
    return files;
}

async function main() {
    ensureOutputDir();
    console.log(`\n${'═'.repeat(70)}`);
    console.log('  NATIVE CHARTS COMPARISON TEST HARNESS');
    console.log(`${'═'.repeat(70)}\n`);
    console.log(`Output directory: ${OUTPUT_DIR}\n`);

    const report = [];

    // ── Real examples ──────────────────────────────────────────
    if (!syntheticOnly) {
        const examples = collectExampleHtmlFiles();
        const filtered = onlyFilter
            ? examples.filter(e => e.name.includes(onlyFilter))
            : examples;

        console.log(`Found ${filtered.length} example HTML file(s) from: ${targetDirs.join(', ')}\n`);

        for (const ex of filtered) {
            const label = `${ex.dir}/${ex.name}`;
            console.log(`── ${label} ${'─'.repeat(Math.max(0, 55 - label.length))}`);

            // Native (default behavior)
            const nativePath = path.join(OUTPUT_DIR, `${ex.name}_native.pptx`);
            const nativeRun = runHtml2Pptx(ex.path, nativePath);

            // Extract native chart info from output
            const nativeChartMatch = nativeRun.output?.match(/\[native-chart\] Chart #\d+: using native (\w+)/g) || [];
            const fallbackMatch = nativeRun.output?.match(/\[native-chart\] Fallback: (.+)/g) || [];
            const rasterMatch = nativeRun.output?.match(/Chart #\d+ rendered successfully/g) || [];

            const entry = {
                name: label,
                nativeSuccess: nativeRun.success,
                nativeCharts: nativeChartMatch.length,
                fallbacks: fallbackMatch.map(m => m.replace('[native-chart] Fallback: ', '')),
                rasterCharts: rasterMatch.length,
            };

            if (nativeChartMatch.length > 0) {
                console.log(`  ✓ NATIVE: ${nativeChartMatch.length} chart(s) translated`);
                nativeChartMatch.forEach(m => console.log(`    ${m}`));
            }
            if (fallbackMatch.length > 0) {
                console.log(`  ↩ FALLBACK: ${fallbackMatch.length} chart(s) rasterized`);
                fallbackMatch.forEach(m => console.log(`    ${m.replace('[native-chart] ', '')}`));
            }
            if (rasterMatch.length > 0) {
                console.log(`  ▪ RASTER: ${rasterMatch.length} chart(s) via SVG→PNG`);
            }
            if (!nativeRun.success) {
                console.log(`  ✗ ERROR: ${nativeRun.output?.split('\n').pop()}`);
            }

            // Raster-only (for side-by-side comparison)
            if (nativeChartMatch.length > 0) {
                const rasterPath = path.join(OUTPUT_DIR, `${ex.name}_raster.pptx`);
                const rasterRun = runHtml2Pptx(ex.path, rasterPath, { PPTX_NATIVE_CHARTS: 'off' });
                if (rasterRun.success) {
                    console.log(`  ▪ RASTER-ONLY: Written ${ex.name}_raster.pptx (for comparison)`);
                } else {
                    console.log(`  ✗ RASTER-ONLY ERROR: ${rasterRun.output?.split('\n').pop()}`);
                }
            }

            report.push(entry);
            console.log('');
        }
    }

    // ── Synthetic tests ────────────────────────────────────────
    console.log(`\n── Synthetic Test Charts ${'─'.repeat(45)}\n`);

    for (const synth of SYNTHETIC_CHARTS) {
        if (onlyFilter && !synth.name.includes(onlyFilter)) continue;

        console.log(`── ${synth.name}: ${synth.description}`);

        // Write temp HTML
        const tmpHtml = path.join(OUTPUT_DIR, `${synth.name}.html`);
        fs.writeFileSync(tmpHtml, synth.html);

        // Generate native
        const nativePath = path.join(OUTPUT_DIR, `${synth.name}_native.pptx`);
        const nativeRun = runHtml2Pptx(tmpHtml, nativePath);

        const nativeChartMatch = nativeRun.output?.match(/\[native-chart\] Chart #\d+: using native (\w+)/g) || [];

        if (nativeChartMatch.length > 0) {
            console.log(`  ✓ NATIVE: ${nativeChartMatch.join(', ')}`);
        }
        if (!nativeRun.success) {
            console.log(`  ✗ ERROR: ${nativeRun.output?.split('\n').pop()}`);
        } else {
            console.log(`  ✓ Written: ${synth.name}_native.pptx`);
        }

        // Generate raster-only for comparison
        if (nativeChartMatch.length > 0) {
            const rasterPath = path.join(OUTPUT_DIR, `${synth.name}_raster.pptx`);
            const rasterRun = runHtml2Pptx(tmpHtml, rasterPath, { PPTX_NATIVE_CHARTS: 'off' });
            if (rasterRun.success) {
                console.log(`  ▪ RASTER-ONLY: Written ${synth.name}_raster.pptx`);
            }
        }

        // Clean up temp HTML
        try { fs.unlinkSync(tmpHtml); } catch { /* ok */ }

        report.push({
            name: `synthetic/${synth.name}`,
            nativeSuccess: nativeRun.success,
            nativeCharts: nativeChartMatch.length,
            fallbacks: [],
            rasterCharts: 0,
        });
        console.log('');
    }

    // ── Summary report ─────────────────────────────────────────
    console.log(`\n${'═'.repeat(70)}`);
    console.log('  SUMMARY');
    console.log(`${'═'.repeat(70)}\n`);

    const totalNative = report.reduce((s, r) => s + r.nativeCharts, 0);
    const totalRaster = report.reduce((s, r) => s + r.rasterCharts, 0);
    const totalFallback = report.reduce((s, r) => s + r.fallbacks.length, 0);
    const totalErrors = report.filter(r => !r.nativeSuccess).length;

    console.log(`  Native charts:    ${totalNative}`);
    console.log(`  Raster charts:    ${totalRaster}`);
    console.log(`  Fallbacks:        ${totalFallback}`);
    console.log(`  Errors:           ${totalErrors}`);
    console.log('');

    // List fallback reasons
    if (totalFallback > 0) {
        console.log('  Fallback reasons:');
        const reasons = {};
        for (const r of report) {
            for (const f of r.fallbacks) {
                reasons[f] = (reasons[f] || 0) + 1;
            }
        }
        for (const [reason, count] of Object.entries(reasons)) {
            console.log(`    ${count}× ${reason}`);
        }
        console.log('');
    }

    // Write report file
    const reportPath = path.join(OUTPUT_DIR, 'comparison-report.txt');
    const reportLines = [
        `Native Charts Comparison Report`,
        `Generated: ${new Date().toISOString()}`,
        ``,
        `SUMMARY`,
        `  Native charts: ${totalNative}`,
        `  Raster charts: ${totalRaster}`,
        `  Fallbacks:     ${totalFallback}`,
        `  Errors:        ${totalErrors}`,
        ``,
        `DETAILS`,
        ...report.map(r => {
            const status = r.nativeSuccess ? 'OK' : 'ERROR';
            const native = r.nativeCharts > 0 ? `${r.nativeCharts} native` : '';
            const raster = r.rasterCharts > 0 ? `${r.rasterCharts} raster` : '';
            const fallback = r.fallbacks.length > 0 ? `fallback: ${r.fallbacks.join('; ')}` : '';
            return `  [${status}] ${r.name}: ${[native, raster, fallback].filter(Boolean).join(', ')}`;
        }),
    ];
    fs.writeFileSync(reportPath, reportLines.join('\n'));
    console.log(`Report written to: ${reportPath}`);

    // List output files
    console.log(`\nOutput files:`);
    const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.pptx'));
    files.forEach(f => console.log(`  ${f}`));

    console.log(`\n${'═'.repeat(70)}`);
    console.log('  Open *_native.pptx in PowerPoint → click chart → should be editable');
    console.log(`${'═'.repeat(70)}\n`);
}

main().catch(e => {
    console.error('Fatal:', e.message);
    process.exit(1);
});
