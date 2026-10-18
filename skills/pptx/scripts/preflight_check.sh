#!/bin/bash
# Pre-flight dependency check for PPTX skill — Auto-Repair Mode
# Run this BEFORE creating any presentation.
# Usage: bash scripts/preflight_check.sh
# ALL dependencies are auto-installed. No flags needed.
# Exit code: 0 = all OK, 1 = some dependencies could not be installed

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

echo "=== PPTX Skill Pre-Flight Check (auto-repair) ==="
echo ""

# ── OS Detection ──────────────────────────────────────────────
OS="unknown"
case "$(uname -s)" in
  Darwin*) OS="macos" ;;
  Linux*)  OS="linux" ;;
esac
echo "Platform: $OS"
echo ""

PASS_COUNT=0
FAIL_COUNT=0
TOTAL_CHECKS=9

pass() { echo "  -> PASS"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo "  -> FAIL: $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

# ── 1. Node.js (>=18) ────────────────────────────────────────
echo "[1/$TOTAL_CHECKS] Node.js (>=18)..."
if command -v node >/dev/null 2>&1; then
  NODE_VERSION=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VERSION" -ge 18 ] 2>/dev/null; then
    echo "  Found: $(node -v)"
    pass
  else
    echo "  Found: $(node -v) — too old (need >=18)"
    fail "Node.js >=18 required. Install from https://nodejs.org/"
  fi
else
  fail "Node.js not found. Install from https://nodejs.org/"
fi

# ── 2. npm ────────────────────────────────────────────────────
echo "[2/$TOTAL_CHECKS] npm..."
if command -v npm >/dev/null 2>&1; then
  echo "  Found: npm $(npm -v 2>/dev/null)"
  pass
else
  fail "npm not found. Install Node.js from https://nodejs.org/"
fi

# ── 3. Node packages ─────────────────────────────────────────
echo "[3/$TOTAL_CHECKS] Node packages (pptxgenjs, playwright, sharp, echarts, jsdom)..."
if node -e "require('pptxgenjs'); require('playwright'); require('sharp'); require('echarts'); require('jsdom');" 2>/dev/null; then
  echo "  All present"
  pass
else
  echo "  Missing — installing..."
  npm install --force 2>&1 | tail -5 || true
  if node -e "require('pptxgenjs'); require('playwright'); require('sharp'); require('echarts'); require('jsdom');" 2>/dev/null; then
    echo "  Installed successfully"
    pass
  else
    fail "Could not install Node packages. Run: cd skills/pptx && npm install --force"
  fi
fi

# ── 4. Playwright Chromium ────────────────────────────────────
echo "[4/$TOTAL_CHECKS] Playwright Chromium..."
PLAYWRIGHT_OK=0
# Check default location
if node -e "
const { chromium } = require('playwright');
const fs = require('fs');
const execPath = chromium.executablePath();
if (fs.existsSync(execPath)) process.exit(0); else process.exit(1);
" 2>/dev/null; then
  PLAYWRIGHT_OK=1
# Check local node_modules
elif PLAYWRIGHT_BROWSERS_PATH=0 node -e "
const { chromium } = require('playwright');
const fs = require('fs');
const execPath = chromium.executablePath();
if (fs.existsSync(execPath)) process.exit(0); else process.exit(1);
" 2>/dev/null; then
  PLAYWRIGHT_OK=1
  echo "  Found in local node_modules"
fi

if [ $PLAYWRIGHT_OK -eq 1 ]; then
  pass
else
  echo "  Missing — installing..."
  # Try global cache first (works without env var at runtime)
  if npx playwright install chromium 2>/dev/null; then
    echo "  Installed to global cache"
    pass
  else
    # Fallback: install locally alongside node_modules
    if PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium 2>/dev/null; then
      echo "  Installed locally"
      pass
    else
      fail "Could not install Playwright Chromium. Run: npx playwright install chromium"
    fi
  fi
fi

# ── 5. Python 3 (>=3.8) ──────────────────────────────────────
echo "[5/$TOTAL_CHECKS] Python 3 (>=3.8)..."
if command -v python3 >/dev/null 2>&1; then
  PY_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null)
  PY_MINOR=$(echo "$PY_VERSION" | cut -d. -f2)
  if [ "$PY_MINOR" -ge 8 ] 2>/dev/null; then
    echo "  Found: Python $PY_VERSION"
    pass
  else
    echo "  Found: Python $PY_VERSION — too old (need >=3.8)"
    fail "Python >=3.8 required"
  fi
else
  fail "Python 3 not found"
fi

# ── 6. pip + python-pptx + Pillow ────────────────────────────
echo "[6/$TOTAL_CHECKS] pip + python-pptx + Pillow..."

# Discover a working pip command
PIP_CMD=""
if command -v pip3 >/dev/null 2>&1; then
  PIP_CMD="pip3"
elif python3 -m pip --version >/dev/null 2>&1; then
  PIP_CMD="python3 -m pip"
else
  echo "  pip not found — bootstrapping..."
  # Strategy 1 (Linux): apt-get install python3-pip (most reliable on Debian/Ubuntu)
  if [ "$OS" = "linux" ]; then
    echo "  Trying: sudo apt-get install -y python3-pip..."
    sudo apt-get update --allow-insecure-repositories -qq 2>/dev/null || true
    sudo apt-get install -y python3-pip --allow-unauthenticated 2>&1 | tail -3 || true
    if command -v pip3 >/dev/null 2>&1; then
      PIP_CMD="pip3"
      echo "  Installed via apt-get"
    elif python3 -m pip --version >/dev/null 2>&1; then
      PIP_CMD="python3 -m pip"
      echo "  Installed via apt-get"
    fi
  fi
  # Strategy 2: ensurepip (works on systems with python3-venv)
  if [ -z "$PIP_CMD" ]; then
    echo "  Trying: python3 -m ensurepip..."
    if python3 -m ensurepip --upgrade 2>/dev/null; then
      if python3 -m pip --version >/dev/null 2>&1; then
        PIP_CMD="python3 -m pip"
        echo "  Bootstrapped via ensurepip"
      fi
    fi
  fi
  # Strategy 3: download get-pip.py with SSL workarounds
  if [ -z "$PIP_CMD" ]; then
    echo "  Trying: get-pip.py download..."
    GET_PIP_URL="https://bootstrap.pypa.io/get-pip.py"
    GET_PIP_PATH="/tmp/get-pip.py"
    DOWNLOADED=0
    # Try wget (no cert check for sandboxed envs — Issue 2 SSL fix)
    if command -v wget >/dev/null 2>&1; then
      echo "    wget..."
      if wget --no-check-certificate -q -O "$GET_PIP_PATH" "$GET_PIP_URL" 2>/dev/null; then
        DOWNLOADED=1
      fi
    fi
    # Try curl
    if [ $DOWNLOADED -eq 0 ] && command -v curl >/dev/null 2>&1; then
      echo "    curl..."
      if curl -sSL -o "$GET_PIP_PATH" "$GET_PIP_URL" 2>/dev/null; then
        DOWNLOADED=1
      fi
    fi
    # Try curl --insecure (SSL fallback)
    if [ $DOWNLOADED -eq 0 ] && command -v curl >/dev/null 2>&1; then
      echo "    curl --insecure..."
      if curl -sSL --insecure -o "$GET_PIP_PATH" "$GET_PIP_URL" 2>/dev/null; then
        DOWNLOADED=1
      fi
    fi
    if [ $DOWNLOADED -eq 1 ]; then
      python3 "$GET_PIP_PATH" --user 2>/dev/null || python3 "$GET_PIP_PATH" 2>/dev/null || true
      if python3 -m pip --version >/dev/null 2>&1; then
        PIP_CMD="python3 -m pip"
        echo "  Bootstrapped via get-pip.py"
      fi
    else
      echo "  All download methods failed (wget/curl)"
    fi
  fi
  # Strategy 4 (macOS): brew install python includes pip
  if [ -z "$PIP_CMD" ] && [ "$OS" = "macos" ] && command -v brew >/dev/null 2>&1; then
    echo "  Trying: brew install python3..."
    brew install python3 2>&1 | tail -3 || true
    if command -v pip3 >/dev/null 2>&1; then
      PIP_CMD="pip3"
      echo "  Installed via brew"
    fi
  fi
fi

if [ -z "$PIP_CMD" ]; then
  # Last resort: check if python-pptx + Pillow are already installed despite no pip
  if python3 -c "import pptx; from PIL import Image" 2>/dev/null; then
    echo "  pip not found, but python-pptx + Pillow already available"
    pass
  else
    fail "Could not find or bootstrap pip. On Linux try: sudo apt-get install -y python3-pip"
  fi
else
  echo "  Using: $PIP_CMD"
  # Check python-pptx + Pillow
  if python3 -c "import pptx; from PIL import Image" 2>/dev/null; then
    echo "  python-pptx + Pillow present"
    pass
  else
    echo "  Installing python-pptx + Pillow..."
    # Try normal install, fall back to --user, fall back to --break-system-packages (PEP 668)
    $PIP_CMD install python-pptx Pillow 2>&1 | tail -3 || \
      $PIP_CMD install --user python-pptx Pillow 2>&1 | tail -3 || \
      $PIP_CMD install --break-system-packages python-pptx Pillow 2>&1 | tail -3 || true
    if python3 -c "import pptx; from PIL import Image" 2>/dev/null; then
      echo "  Installed successfully"
      pass
    else
      fail "Could not install python-pptx + Pillow. Run: $PIP_CMD install python-pptx Pillow"
    fi
  fi
fi

# ── 7. LibreOffice ────────────────────────────────────────────
echo "[7/$TOTAL_CHECKS] LibreOffice (soffice)..."
SOFFICE_FOUND=0

# Check PATH first
if command -v soffice >/dev/null 2>&1; then
  SOFFICE_FOUND=1
  echo "  Found in PATH: $(which soffice)"
fi

# macOS: check common app location not in PATH
if [ $SOFFICE_FOUND -eq 0 ] && [ "$OS" = "macos" ]; then
  MACOS_SOFFICE="/Applications/LibreOffice.app/Contents/MacOS/soffice"
  if [ -x "$MACOS_SOFFICE" ]; then
    SOFFICE_FOUND=1
    echo "  Found at $MACOS_SOFFICE (not in PATH)"
  fi
fi

if [ $SOFFICE_FOUND -eq 1 ]; then
  pass
else
  echo "  Missing — attempting install..."
  INSTALLED=0
  if [ "$OS" = "macos" ]; then
    if command -v brew >/dev/null 2>&1; then
      echo "  Running: brew install --cask libreoffice"
      brew install --cask libreoffice 2>&1 | tail -3 || true
      if command -v soffice >/dev/null 2>&1 || [ -x "/Applications/LibreOffice.app/Contents/MacOS/soffice" ]; then
        INSTALLED=1
      fi
    else
      echo "  Homebrew not available — cannot auto-install on macOS"
    fi
  elif [ "$OS" = "linux" ]; then
    echo "  Running: sudo apt-get install -y libreoffice-impress"
    sudo apt-get update --allow-insecure-repositories 2>/dev/null || true
    sudo apt-get install -y libreoffice-impress --allow-unauthenticated 2>&1 | tail -3 || true
    if command -v soffice >/dev/null 2>&1; then
      INSTALLED=1
    fi
  fi
  if [ $INSTALLED -eq 1 ]; then
    echo "  Installed successfully"
    pass
  else
    fail "Could not install LibreOffice. Thumbnails will not work."
  fi
fi

# ── 8. Poppler (pdftoppm) ────────────────────────────────────
echo "[8/$TOTAL_CHECKS] Poppler (pdftoppm)..."
if command -v pdftoppm >/dev/null 2>&1; then
  echo "  Found: $(which pdftoppm)"
  pass
else
  echo "  Missing — attempting install..."
  INSTALLED=0
  if [ "$OS" = "macos" ]; then
    if command -v brew >/dev/null 2>&1; then
      echo "  Running: brew install poppler"
      brew install poppler 2>&1 | tail -3 || true
      if command -v pdftoppm >/dev/null 2>&1; then
        INSTALLED=1
      fi
    else
      echo "  Homebrew not available — cannot auto-install on macOS"
    fi
  elif [ "$OS" = "linux" ]; then
    echo "  Running: sudo apt-get install -y poppler-utils"
    sudo apt-get update --allow-insecure-repositories 2>/dev/null || true
    sudo apt-get install -y poppler-utils --allow-unauthenticated 2>&1 | tail -3 || true
    if command -v pdftoppm >/dev/null 2>&1; then
      INSTALLED=1
    fi
  fi
  if [ $INSTALLED -eq 1 ]; then
    echo "  Installed successfully"
    pass
  else
    fail "Could not install Poppler. Thumbnails will not work."
  fi
fi

# ── 9. markitdown + defusedxml ────────────────────────────────
echo "[9/$TOTAL_CHECKS] markitdown + defusedxml..."
if python3 -c "import markitdown; import defusedxml" 2>/dev/null; then
  echo "  All present"
  pass
else
  if [ -n "$PIP_CMD" ]; then
    echo "  Installing..."
    $PIP_CMD install "markitdown[pptx]" defusedxml 2>&1 | tail -3 || \
      $PIP_CMD install --user "markitdown[pptx]" defusedxml 2>&1 | tail -3 || \
      $PIP_CMD install --break-system-packages "markitdown[pptx]" defusedxml 2>&1 | tail -3 || true
    if python3 -c "import markitdown; import defusedxml" 2>/dev/null; then
      echo "  Installed successfully"
      pass
    else
      fail "Could not install markitdown + defusedxml"
    fi
  else
    fail "pip not available — cannot install markitdown + defusedxml"
  fi
fi

# ── Summary ───────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
echo "  Results: $PASS_COUNT/$TOTAL_CHECKS passed, $FAIL_COUNT/$TOTAL_CHECKS failed"
echo "═══════════════════════════════════════════════════"

if [ $FAIL_COUNT -eq 0 ]; then
  echo "=== ALL CHECKS PASSED — Ready to create presentations ==="
  exit 0
else
  echo "=== $FAIL_COUNT DEPENDENCY ISSUE(S) — Review failures above ==="
  echo "Thumbnail generation requires LibreOffice and Poppler."
  exit 1
fi
