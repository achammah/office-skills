#!/bin/bash
# Verify all pptx skill dependencies are installed

echo "=== PPTX Skill Setup Verification ==="
echo ""

# Check npm packages
echo "NPM Packages:"
for pkg in pptxgenjs playwright sharp echarts; do
    if node -e "require('$pkg')" 2>/dev/null; then
        echo "  ✓ $pkg"
    else
        echo "  ✗ $pkg - run: npm install $pkg"
    fi
done

echo ""
echo "Python Packages:"
for pkg in pptx PIL defusedxml; do
    if python3 -c "import $pkg" 2>/dev/null; then
        echo "  ✓ $pkg"
    else
        case $pkg in
            pptx) echo "  ✗ python-pptx - run: pip install python-pptx" ;;
            PIL) echo "  ✗ Pillow - run: pip install Pillow" ;;
            *) echo "  ✗ $pkg - run: pip install $pkg" ;;
        esac
    fi
done

echo ""
echo "System Tools:"
for tool in soffice pdftoppm; do
    if which $tool >/dev/null 2>&1; then
        echo "  ✓ $tool"
    else
        echo "  ✗ $tool - run: brew install libreoffice poppler (macOS)"
    fi
done

echo ""
echo "Playwright Browser:"
if npx playwright install --dry-run chromium 2>&1 | grep -q "already installed"; then
    echo "  ✓ chromium"
else
    echo "  ✗ chromium - run: npx playwright install chromium"
fi

echo ""
echo "=== Verification Complete ==="
