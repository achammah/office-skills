#!/usr/bin/env node
/**
 * Verifies all PPTX skill dependencies are installed and working
 * Run: node scripts/check-deps.mjs
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const checks = [
  {
    name: 'pptxgenjs',
    test: () => {
      const PptxGenJS = require('pptxgenjs');
      if (!PptxGenJS) throw new Error('Module loaded but undefined');
    }
  },
  {
    name: 'playwright',
    test: async () => {
      const { chromium } = await import('playwright');
      const browser = await chromium.launch({ headless: true });
      await browser.close();
    }
  },
  {
    name: 'sharp',
    test: async () => {
      const sharp = (await import('sharp')).default;
      // Test actual functionality with minimal SVG
      await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect fill="red" width="10" height="10"/></svg>'))
        .png()
        .toBuffer();
    }
  },
  {
    name: 'echarts',
    test: async () => {
      const echarts = await import('echarts');
      // Verify version is 6.x+
      const ver = echarts.version || 'unknown';
      const major = parseInt(ver.split('.')[0], 10);
      if (isNaN(major) || major < 6) {
        throw new Error(`ECharts ${ver} detected, need 6.x+. Run: npm install echarts@latest`);
      }
      // Test SSR rendering capability
      const chart = echarts.init(null, null, {
        renderer: 'svg',
        ssr: true,
        width: 100,
        height: 100
      });
      chart.setOption({
        xAxis: { type: 'category', data: ['A', 'B', 'C'] },
        yAxis: { type: 'value' },
        series: [{ type: 'bar', data: [1, 2, 3] }]
      });
      const svg = chart.renderToSVGString();
      chart.dispose();
      if (!svg.includes('<svg')) throw new Error('SVG rendering failed');
    }
  }
];

async function runChecks() {
  console.log('PPTX Skill Dependency Check\n');
  console.log('='.repeat(40));

  let allPassed = true;
  const results = [];

  for (const { name, test } of checks) {
    process.stdout.write(`  Checking ${name}... `);
    try {
      await test();
      console.log('✓');
      results.push({ name, status: 'ok' });
    } catch (e) {
      console.log(`✗`);
      console.log(`    Error: ${e.message}`);
      results.push({ name, status: 'failed', error: e.message });
      allPassed = false;
    }
  }

  console.log('='.repeat(40));

  if (allPassed) {
    console.log('\n✓ All dependencies OK!\n');
    console.log('You can now use html2pptx.mjs with ECharts support.');
  } else {
    console.log('\n✗ Some dependencies missing or broken.\n');
    console.log('To fix, run:');
    console.log('  npm install pptxgenjs playwright sharp echarts');
    console.log('  npx playwright install chromium\n');
  }

  process.exit(allPassed ? 0 : 1);
}

runChecks().catch(e => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
