const path = require('path');
// Point to the echarts in the pptx scripts node_modules
const scriptsDir = path.join(__dirname, '..');
const echarts = require(path.join(scriptsDir, 'node_modules', 'echarts'));

const config = {
  xAxis: { type: 'category', data: ['A','B','C','D','E','F'] },
  yAxis: { type: 'value', min: 0, max: 3000 },
  series: [{ type: 'line', data: [
    { value: 800, label: { show: false } },
    { value: 1200, label: { show: false } },
    { value: 1500, label: {
      show: true, formatter: 'Callout text\nsecond line',
      backgroundColor: '#FFFFFF', borderColor: '#1E3A5F', borderWidth: 1,
      padding: [5, 8], color: '#333', fontSize: 10, lineHeight: 13, width: 130, align: 'left', overflow: 'break'
    }},
    { value: 1800, label: { show: false } },
    { value: 2200, label: { show: false } },
    { value: 2800, label: { show: false } }
  ], symbol: 'circle', symbolSize: 6,
    labelLayout: function(params) {
      if (params.dataIndex === 2) {
        return { x: params.rect.x - 180, y: params.rect.y - 20 };
      }
      return {};
    }
  }]
};

const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 800, height: 400 });
chart.setOption(config);
const svg = chart.renderToSVGString();

// Find callout box path
const pathPattern = /<path d="M0 0l([\d.]+) 0l0 ([\d.]+)l-([\d.]+) 0Z" transform="translate\(([\d.]+) ([\d.]+)\)" fill="#FFFFFF"/g;
let match;
while ((match = pathPattern.exec(svg)) !== null) {
  console.log('SVG callout box:', { w: parseFloat(match[1]), h: parseFloat(match[2]), x: parseFloat(match[4]), y: parseFloat(match[5]) });
}

// Compare with convertToPixel
const pt = chart.convertToPixel('grid', [2, 1500]);
console.log('convertToPixel data point:', { x: pt[0], y: pt[1] });

// Approximation
const contentW = 130, hPad = 8, vPad = 5, lh = 13, lines = 2;
console.log('Approximated box:', { w: contentW + 2*hPad, h: lines*lh + 2*vPad });
