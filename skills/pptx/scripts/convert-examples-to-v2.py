#!/usr/bin/env python3
"""
Convert all HTML examples from v1 (--mck-* variables, no brand-slide)
to v2 (brand-slide class, --brand-* variables, no script tags).

Changes applied:
1. Remove <style> blocks with --mck-* variable references
2. Add class="brand-slide" to <body>
3. Replace --mck-* CSS variables with --brand-* equivalents in inline styles
4. Remove <script> tags (preview.js and CDN echarts)
5. Keep data-echarts hex colors as-is (auto-colored by renderer)
6. Keep absolute positioning (converter handles it fine)
7. Fix text directly in <div> (wrap in <p> tags)
"""

import os
import re
import sys

EXAMPLES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'examples')

# CSS variable mapping: --mck-* -> --brand-*
MCK_TO_BRAND = {
    '--mck-navy': '--brand-primary',
    '--mck-blue-dark': '--brand-secondary',
    '--mck-blue-medium': '--brand-tertiary',
    '--mck-blue-light': '--brand-quaternary',
    '--mck-blue-pale': '--brand-quinary',
    '--mck-gold': '--brand-accent',
    '--mck-gray-dark': '--brand-text-secondary',
    '--mck-gray-medium': '--brand-gray-medium',
    '--mck-gray-light': '--brand-bg-secondary',
    '--mck-gray-silver': '--brand-gray-silver',
    '--mck-gray-border': '--brand-gray-border',
    '--mck-font-data': '--brand-font-data',
    '--mck-font-body': '--brand-font-body',
    '--mck-font-heading': '--brand-font-heading',
}

def convert_file(filepath):
    """Convert a single HTML file from v1 to v2 format."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # 1. Remove <style> block entirely
    content = re.sub(r'\s*<style>[\s\S]*?</style>\s*', '\n', content)

    # 2. Add class="brand-slide" to <body> (if not already present)
    if 'class="brand-slide"' not in content:
        content = content.replace('<body>', '<body class="brand-slide">')

    # 3. Replace --mck-* variables with --brand-* in inline styles (NOT inside data-echarts)
    for mck_var, brand_var in MCK_TO_BRAND.items():
        # Replace var(--mck-*) references in inline styles
        content = content.replace(f'var({mck_var})', f'var({brand_var})')

    # 4. Remove <script> tags
    content = re.sub(r'\s*<script[^>]*>[\s\S]*?</script>', '', content)

    # 5. Fix text directly in <div> — find divs with text content that's not in a tag
    # Pattern: <div style="...">BARE TEXT</div>
    # This is a targeted fix for known patterns like "BEFORE (2023)" labels
    def fix_bare_text_in_div(match):
        full_match = match.group(0)
        # Check if the content between > and </div> has bare text (no child tags)
        inner_match = re.search(r'>([^<]+)</div>', full_match)
        if inner_match:
            text = inner_match.group(1).strip()
            if text and not text.startswith('<!--'):
                # Wrap the text in a <p> tag, preserving the div's style
                return full_match.replace(f'>{text}</div>', f'><p style="margin: 0;">{text}</p></div>')
        return full_match

    # Match divs with style that contain bare text
    content = re.sub(
        r'<div\s+style="[^"]*">[^<]+</div>',
        fix_bare_text_in_div,
        content
    )

    # 6. Clean up excessive whitespace from removals
    content = re.sub(r'\n{3,}', '\n\n', content)

    # Check if anything changed
    if content == original:
        return False

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return True


def main():
    examples_dir = sys.argv[1] if len(sys.argv) > 1 else EXAMPLES_DIR

    print(f"Converting examples in: {examples_dir}\n")

    html_files = []
    for root, dirs, files in os.walk(examples_dir):
        for f in sorted(files):
            if f.endswith('.html') and f != 'preview.js':
                html_files.append(os.path.join(root, f))

    converted = 0
    skipped = 0
    errors = 0

    for filepath in sorted(html_files):
        relpath = os.path.relpath(filepath, examples_dir)
        try:
            if convert_file(filepath):
                print(f"  ✓ Converted: {relpath}")
                converted += 1
            else:
                print(f"  · Skipped (no changes needed): {relpath}")
                skipped += 1
        except Exception as e:
            print(f"  ✗ Error: {relpath} — {e}")
            errors += 1

    print(f"\nConversion complete:")
    print(f"  Converted: {converted}")
    print(f"  Skipped:   {skipped}")
    print(f"  Errors:    {errors}")
    print(f"  Total:     {len(html_files)} files")


if __name__ == '__main__':
    main()
