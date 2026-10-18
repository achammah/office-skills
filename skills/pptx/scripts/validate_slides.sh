#!/usr/bin/env bash
# validate_slides.sh — Generate thumbnail grid for visual validation
#
# Usage: bash scripts/validate_slides.sh <pptx_file> <output_dir>
#
# Prerequisites:
#   - LibreOffice (soffice) — for PPTX → PDF conversion
#   - Poppler (pdftoppm) — for PDF → PNG conversion
#   - Python 3 + python-pptx — for thumbnail grid generation
#
# See SKILL.md Dependencies section for installation instructions.

set -euo pipefail

PPTX="${1:?Usage: bash scripts/validate_slides.sh <pptx_file> <output_dir>}"
OUTDIR="${2:?Usage: bash scripts/validate_slides.sh <pptx_file> <output_dir>}"

# ── Check dependencies ──
MISSING=()
for cmd in soffice pdftoppm python3; do
    if ! command -v "$cmd" &>/dev/null; then
        MISSING+=("$cmd")
    fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
    echo "ERROR: Missing required tools: ${MISSING[*]}" >&2
    echo "" >&2
    echo "Install them:" >&2
    for cmd in "${MISSING[@]}"; do
        case "$cmd" in
            soffice)
                echo "  LibreOffice: brew install --cask libreoffice (macOS) or sudo apt-get install -y libreoffice-impress (Linux)" >&2
                ;;
            pdftoppm)
                echo "  Poppler: brew install poppler (macOS) or sudo apt-get install -y poppler-utils (Linux)" >&2
                ;;
            python3)
                echo "  Python 3: https://www.python.org/downloads/" >&2
                ;;
        esac
    done
    echo "" >&2
    echo "See SKILL.md Dependencies section for full setup instructions." >&2
    exit 1
fi

# ── Check input file exists ──
if [ ! -f "$PPTX" ]; then
    echo "ERROR: File not found: $PPTX" >&2
    exit 1
fi

# ── Generate thumbnails ──
mkdir -p "$OUTDIR"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Generating thumbnails for: $PPTX"
python3 "$SCRIPT_DIR/thumbnail.py" "$PPTX" "$OUTDIR" --cols 4

echo ""
echo "Thumbnails saved to: $OUTDIR"
echo ""
echo "Inspect EVERY slide for:"
echo "  - Black box charts (ECharts rendering failure — see COMMON_FAILURES.md #1)"
echo "  - Text cutoff (title too long or content overflow — see COMMON_FAILURES.md #2)"
echo "  - Unreadable text (font size below minimum — see COMMON_FAILURES.md #3)"
echo "  - Cramped layout (too much content — see COMMON_FAILURES.md #4)"
echo "  - Text overlap or contrast issues"
echo ""
echo "If issues found: fix HTML source → regenerate PPTX → re-run this script"
