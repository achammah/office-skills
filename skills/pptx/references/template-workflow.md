# Template Workflow

Workflow for adapting an existing PowerPoint template (rearrange slides, replace text).

1. **Extract text + thumbnails**: `python -m markitdown template.pptx > template-content.md` and `python scripts/thumbnail.py template.pptx`
2. **Analyze template**: Create `template-inventory.md` listing EVERY slide with index (0-based), layout code, description
3. **Create outline**: Match layout structure to content. Save `outline.md` with content AND template mapping
4. **Rearrange slides**: `python scripts/rearrange.py template.pptx working.pptx 0,34,34,50,52` (a repeated index copies the slide with its own charts; slides with SmartArt, comments or OLE objects are refused)
5. **Extract text**: `python scripts/inventory.py working.pptx text-inventory.json` (re-run after every rearrange: keys follow the current deck; table cells appear as `table-T-rRcC`)
6. **Generate replacement JSON**: Only reference shapes from inventory. All shapes cleared unless you provide `"paragraphs"`; table cells change only when listed
7. **Apply replacements**: `python scripts/replace.py working.pptx replacement-text.json output.pptx`
   - For a plain word swap (titles, tables, groups, notes, formatting kept): `python scripts/replace.py working.pptx output.pptx --find FY25 --replace FY26`. 0 matches exits 1 and writes nothing.
