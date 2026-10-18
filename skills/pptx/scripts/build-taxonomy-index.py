#!/usr/bin/env python3
"""
Build taxonomy-index.json from 2,438 McKinsey slide JSON metadata files.

Maps each slide's taxonomy_id to its PNG path and visual description,
grouped by template folder (L1-L2) and template name (L4).

Output format:
{
  "data-ranking/horizontal-bar-chart": [
    {"pngPath": "/.../slide-05.png", "visual_description": "...", "taxonomy_id": "..."},
    ...
  ],
  ...
}

Usage:
    python3 scripts/build-taxonomy-index.py
"""

import json
import os
import sys
from pathlib import Path

# Paths
SLIDES_ROOT = Path(os.environ.get("SLIDES_ROOT", "NewFullSlidesPictures_v2"))
SKILLS_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_PATH = SKILLS_ROOT / "taxonomy-index.json"

def main():
    print(f"Scanning {SLIDES_ROOT} for JSON metadata files...")

    json_files = list(SLIDES_ROOT.rglob("*.json"))
    print(f"Found {len(json_files)} JSON files")

    index = {}  # key: "folder/template" -> list of slide entries
    skipped = 0
    errors = 0

    for jf in sorted(json_files):
        try:
            with open(jf, 'r') as f:
                data = json.load(f)
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            errors += 1
            continue

        taxonomy_id = data.get("taxonomy_id")
        category_path = data.get("category_path", [])
        visual_description = data.get("visual_description", "")

        if not taxonomy_id or len(category_path) < 2:
            skipped += 1
            continue

        # Build folder key: L1-L2 (e.g., "data-trend")
        folder_key = f"{category_path[0]}-{category_path[1]}"

        # Build template name: L4 if available, else L3
        if len(category_path) >= 4:
            template_name = category_path[3]
        elif len(category_path) >= 3:
            template_name = category_path[2]
        else:
            template_name = "unknown"

        # Full key: "folder/template" (e.g., "data-trend/multi-line")
        full_key = f"{folder_key}/{template_name}"

        # Find corresponding PNG
        png_path = jf.with_suffix(".png")
        if not png_path.exists():
            # Try common naming patterns
            stem = jf.stem
            parent = jf.parent
            png_candidates = list(parent.glob(f"{stem}*.png"))
            if png_candidates:
                png_path = png_candidates[0]
            else:
                skipped += 1
                continue

        entry = {
            "pngPath": str(png_path),
            "visual_description": visual_description[:500],  # Truncate for size
            "taxonomy_id": taxonomy_id,
            "source_json": str(jf),
        }

        if full_key not in index:
            index[full_key] = []
        index[full_key].append(entry)

    # Sort entries within each key by PNG path for determinism
    for key in index:
        index[key].sort(key=lambda e: e["pngPath"])

    # Write output
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(index, f, indent=2)

    # Summary
    total_entries = sum(len(v) for v in index.values())
    print(f"\n=== Taxonomy Index Built ===")
    print(f"Total entries: {total_entries}")
    print(f"Unique template keys: {len(index)}")
    print(f"Skipped (no taxonomy/PNG): {skipped}")
    print(f"Errors (bad JSON): {errors}")
    print(f"Output: {OUTPUT_PATH}")

    # Show top keys by count
    print(f"\nTop 20 template keys by slide count:")
    for key, entries in sorted(index.items(), key=lambda x: -len(x[1]))[:20]:
        print(f"  {key}: {len(entries)} slides")

    # Show all unique folder prefixes
    folders = sorted(set(k.split('/')[0] for k in index.keys()))
    print(f"\nUnique folders ({len(folders)}):")
    for f in folders:
        count = sum(len(v) for k, v in index.items() if k.startswith(f + '/'))
        print(f"  {f}: {count} slides")

if __name__ == "__main__":
    main()
