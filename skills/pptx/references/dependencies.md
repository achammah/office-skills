# Dependencies & Environment Setup

**Auto-install**: `bash scripts/preflight_check.sh` installs everything automatically. No flags needed.

## Required Packages (auto-installed by preflight_check.sh)

- **markitdown**: `pip install "markitdown[pptx]"` (text extraction)
- **pptxgenjs**: `npm install pptxgenjs` (presentation creation)
- **playwright**: `npm install playwright` (HTML rendering)
- **react-icons**: `npm install react-icons react react-dom` (icons)
- **sharp**: `npm install sharp@0.33 --force` (image processing — use 0.33)
- **echarts**: `npm install echarts` (server-side chart rendering)
- **LibreOffice**: macOS: `brew install --cask libreoffice` / Linux: `sudo apt-get install -y libreoffice-impress`
- **Poppler**: macOS: `brew install poppler` / Linux: `sudo apt-get install -y poppler-utils`
- **defusedxml**: `pip install defusedxml` (secure XML parsing)
- **python-pptx**: `pip install python-pptx` (Python PPTX manipulation)

## First-Time Setup

**macOS:**
```bash
pip install "markitdown[pptx]" defusedxml python-pptx
cd skills/pptx && npm install pptxgenjs playwright sharp@0.33 echarts --force
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium
brew install --cask libreoffice && brew install poppler
```

**Linux (Ubuntu/Debian):**
```bash
pip install "markitdown[pptx]" defusedxml python-pptx
cd skills/pptx && npm install pptxgenjs playwright sharp@0.33 echarts --force
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium
sudo apt-get update && sudo apt-get install -y libreoffice-impress poppler-utils
```

## Verify Installation

```bash
node -e "require('pptxgenjs'); require('playwright'); require('sharp'); require('echarts'); console.log('All npm OK')"
python -c "import markitdown; import defusedxml; import pptx; print('All pip OK')"
which soffice && which pdftoppm && echo "System tools OK"
```
