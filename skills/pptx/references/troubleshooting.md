# Troubleshooting

Common errors and visual issue diagnosis for the PPTX pipeline.

## Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `require is not defined in ES module scope` | CommonJS in ESM context | Use `.mjs` versions: `html2pptx.mjs`, `render_echarts.mjs`, `crop_image.mjs` |
| `Cannot find module 'pptxgenjs'` | npm packages not installed | `cd skills/pptx && npm install pptxgenjs playwright sharp echarts` |
| `No module named 'pptx'` | python-pptx missing | `pip install python-pptx` |
| `No such file: 'soffice'` | LibreOffice missing | macOS: `brew install --cask libreoffice` / Linux: `sudo apt-get install -y libreoffice-impress` |
| GPG key errors during `apt-get` | Missing PPA signing key (Daytona) | `sudo apt-get update --allow-insecure-repositories && sudo apt-get install -y libreoffice-impress poppler-utils` |
| `No such file: 'pdftoppm'` | Poppler missing | `sudo apt-get install -y poppler-utils` or `brew install poppler` |
| LibreOffice headless fails silently | Missing display/fonts | `soffice --headless --convert-to pdf ...` / Install: `sudo apt-get install -y fonts-liberation fonts-dejavu` |
| `ECharts rendering failed` | echarts not installed or config error | `npm install echarts` and validate JSON |
| `Playwright browser not found` | Chromium not installed | `npx playwright install chromium` or `PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium` |
| Daytona `--with-deps` GPG error | Stale yarn repo key | Skip `--with-deps`: `npx playwright install chromium`. System deps: `sudo apt-get update --allow-insecure-repositories && sudo apt-get install -y libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libgbm1 --allow-unauthenticated` |
| Thumbnail generation fails | LibreOffice or Poppler missing | Install both, verify: `which soffice && which pdftoppm` |
| `thumbnail.py` fails silently | python-pptx or Pillow missing | `pip install python-pptx Pillow` |

## ECharts Troubleshooting

**Verify deps**: `node scripts/check-deps.mjs`

**Test config independently**: `echo '{"series":[{"type":"bar","data":[1,2,3]}]}' > test.json && node scripts/render_echarts.mjs test.json 400 300 > test.svg`

| Error | Cause | Solution |
|-------|-------|----------|
| `not valid JSON` | JavaScript function in config | Pre-calculate all values — no `function()` allowed |
| `missing "series"` | Wrong config structure | Add: `{"series":[...]}` |
| `missing "type"` | Series has no type | Add: `{"type":"bar","data":[...]}` |
| `PNG not created` | Dependencies missing | `node scripts/check-deps.mjs` |
| Chart looks wrong | Config error | Test at https://echarts.apache.org/examples/ |
| No axis break on outliers | ECharts < 6.x or < 3 data points | Verify `[echarts] version=6.x`. Fix: `npm install echarts@latest` |

**JSON-Only Rule**: `data-echarts` must be pure JSON. No `function()`. Use pre-calculated values.

## Visual Issue Diagnosis

| Symptom | Fix |
|---------|-----|
| Chart blank/black/missing | Validate `data-echarts` JSON. Check container dimensions. Remove `var(--brand-*)` from JSON |
| Colors wrong/unexpected | Check console for replacement warnings. Verify `class="brand-slide"`. Use `var(--brand-*)` in CSS |
| Text cut off/overflowing | Title ≤ 90 chars. Body text ≥ 11pt. Max 6 bullets. Adjust flex ratios |
| Layout unbalanced/cramped | Adjust flex ratios. Gap 16pt between panels. Padding 16pt inside. Split if needed |
| Footer/source missing | Verify `<div class="footer-zone">` with `<p class="source">` and `<p class="page-num">` |
