---
name: xlsx
description: "Comprehensive spreadsheet creation, editing, and analysis with support for formulas, formatting, data analysis, and visualization. Uses paper-xlsx (a preserving fork of openpyxl, imported as openpyxl) so edits keep charts, images, OLE objects, comments and every other part. When Claude needs to work with spreadsheets (.xlsx, .xlsm, .csv, .tsv, etc) for: (1) Creating new spreadsheets with formulas and formatting, (2) Reading or analyzing data, (3) Modify existing spreadsheets while preserving formulas, (4) Data analysis and visualization in spreadsheets, or (5) Recalculating formulas"
license: MIT. LICENSE.txt has complete terms
---

# Dependencies

## Required Python Packages

```bash
pip uninstall -y openpyxl
pip install paper-xlsx pandas pillow
python -m paper_xlsx_doctor
```

| Package | Purpose |
|---------|---------|
| `paper-xlsx` | Read/write Excel files, styling, formulas. Fork of openpyxl, imported as `openpyxl`; edits keep every untouched part |
| `pandas` | Data analysis, reading Excel into DataFrames |
| `pillow` | Image API. paper-xlsx keeps images without it, but `Image()` then raises `ImportError` and `replace_image` raises `TargetNotFoundError` |

- **Never install `openpyxl` and `paper-xlsx` together** (both own `openpyxl`). The doctor prints `OK`, or `FAIL` with the fix. Stock openpyxl drops charts, OLE objects, comments and cached values on a one-cell edit.

## System Dependencies

**LibreOffice** (required for formula recalculation):
- macOS: `brew install --cask libreoffice`
- Ubuntu/Debian: `sudo apt install libreoffice`
- `recalc.py` finds `soffice` on PATH, or at `/Applications/LibreOffice.app` on macOS

---

# Environment Setup

## First-Time Setup

1. **Install Python packages:**
   ```bash
   pip uninstall -y openpyxl
   pip install paper-xlsx pandas pillow
   ```

2. **Install LibreOffice (for formula recalculation):**
   - macOS: `brew install --cask libreoffice`
   - Linux: `sudo apt install libreoffice`

3. **Verify installation:**
   ```bash
   python -m paper_xlsx_doctor
   python -c "import pandas; print('pandas OK')"
   python -c "from openpyxl import oracle; print(oracle.find_soffice())"
   ```
   The last line prints the LibreOffice path, or `None` when it is missing.

## When LibreOffice is Unavailable

If LibreOffice cannot be installed (e.g., containerized environments):
- **Formulas will NOT be recalculated** - the file will contain formulas but show stale/zero values
- Warn the user that formulas need manual recalculation when opened in Excel
- Consider using computed values instead of formulas for critical outputs

---

# Requirements for Outputs

## All Excel files

### Zero Formula Errors
- Every Excel model MUST be delivered with ZERO formula errors (#REF!, #DIV/0!, #VALUE!, #N/A, #NAME?)

### Preserve Existing Templates (when updating templates)
- Study and EXACTLY match existing format, style, and conventions when modifying files
- Never impose standardized formatting on files with established patterns
- Existing template conventions ALWAYS override these guidelines

## Financial models

### Color Coding Standards
Unless otherwise stated by the user or existing template

#### Industry-Standard Color Conventions
- **Blue text (RGB: 0,0,255)**: Hardcoded inputs, and numbers users will change for scenarios
- **Black text (RGB: 0,0,0)**: ALL formulas and calculations
- **Green text (RGB: 0,128,0)**: Links pulling from other worksheets within same workbook
- **Red text (RGB: 255,0,0)**: External links to other files
- **Yellow background (RGB: 255,255,0)**: Key assumptions needing attention or cells that need to be updated

### Number Formatting Standards

#### Required Format Rules
- **Years**: Format as text strings (e.g., "2024" not "2,024")
- **Currency**: Use $#,##0 format; ALWAYS specify units in headers ("Revenue ($mm)")
- **Zeros**: Use number formatting to make all zeros "-", including percentages (e.g., "$#,##0;($#,##0);-")
- **Percentages**: Default to 0.0% format (one decimal)
- **Multiples**: Format as 0.0x for valuation multiples (EV/EBITDA, P/E)
- **Negative numbers**: Use parentheses (123) not minus -123

### Formula Construction Rules

#### Assumptions Placement
- Place ALL assumptions (growth rates, margins, multiples, etc.) in separate assumption cells
- Use cell references instead of hardcoded values in formulas
- Example: Use =B5*(1+$B$6) instead of =B5*1.05

#### Formula Error Prevention
- Verify all cell references are correct
- Check for off-by-one errors in ranges
- Ensure consistent formulas across all projection periods
- Test with edge cases (zero values, negative numbers)
- Verify no unintended circular references

#### Documentation Requirements for Hardcodes
- Comment or in cells beside (if end of table). Format: "Source: [System/Document], [Date], [Specific Reference], [URL if applicable]"
- Examples:
  - "Source: Company 10-K, FY2024, Page 45, Revenue Note, [SEC EDGAR URL]"
  - "Source: Company 10-Q, Q2 2025, Exhibit 99.1, [SEC EDGAR URL]"
  - "Source: Bloomberg Terminal, 8/15/2025, AAPL US Equity"
  - "Source: FactSet, 8/20/2025, Consensus Estimates Screen"

# XLSX creation, editing, and analysis

## Overview

A user may ask you to create, edit, or analyze the contents of an .xlsx file. You have different tools and workflows available for different tasks.

## Important Requirements

**LibreOffice Required for Formula Recalculation**: You can assume LibreOffice is installed for recalculating formula values using the `recalc.py` script. The script uses its own temporary LibreOffice profile on every run; no setup step

## Reading and analyzing data

### Data analysis with pandas
For data analysis, visualization, and basic operations, use **pandas** which provides powerful data manipulation capabilities:

```python
import pandas as pd

# Read Excel
df = pd.read_excel('file.xlsx')  # Default: first sheet
all_sheets = pd.read_excel('file.xlsx', sheet_name=None)  # All sheets as dict

# Analyze
df.head()      # Preview data
df.info()      # Column info
df.describe()  # Statistics

# Write Excel
df.to_excel('output.xlsx', index=False)
```

## Excel File Workflows

## CRITICAL: Use Formulas, Not Hardcoded Values

**Always use Excel formulas instead of calculating values in Python and hardcoding them.** This ensures the spreadsheet remains dynamic and updateable.

### ❌ WRONG - Hardcoding Calculated Values
```python
# Bad: Calculating in Python and hardcoding result
total = df['Sales'].sum()
sheet['B10'] = total  # Hardcodes 5000

# Bad: Computing growth rate in Python
growth = (df.iloc[-1]['Revenue'] - df.iloc[0]['Revenue']) / df.iloc[0]['Revenue']
sheet['C5'] = growth  # Hardcodes 0.15

# Bad: Python calculation for average
avg = sum(values) / len(values)
sheet['D20'] = avg  # Hardcodes 42.5
```

### ✅ CORRECT - Using Excel Formulas
```python
# Good: Let Excel calculate the sum
sheet['B10'] = '=SUM(B2:B9)'

# Good: Growth rate as Excel formula
sheet['C5'] = '=(C4-C2)/C2'

# Good: Average using Excel function
sheet['D20'] = '=AVERAGE(D2:D19)'
```

This applies to ALL calculations - totals, percentages, ratios, differences, etc. The spreadsheet should be able to recalculate when source data changes.

## Common Workflow
1. **Choose tool**: pandas for data, openpyxl (paper-xlsx) for formulas/formatting and for ANY edit of an existing file. Never round-trip an existing file through `pd.to_excel`: it writes a new file without the original's charts and formatting
2. **Create/Load**: Create new workbook or load existing file
3. **Modify**: Add/edit data, formulas, and formatting
4. **Save**: Write to file. For an existing file: `receipt = wb.save(path, receipt=True)` and check the receipt
5. **Recalculate formulas (MANDATORY IF USING FORMULAS)**: Use the recalc.py script
   ```bash
   python recalc.py output.xlsx
   ```
6. **Verify and fix any errors**: 
   - The script returns JSON with error details
   - If `status` is `errors_found`, check `error_summary` for specific error types and locations
   - Fix the identified errors and recalculate again
   - Common errors to fix:
     - `#REF!`: Invalid cell references
     - `#DIV/0!`: Division by zero
     - `#VALUE!`: Wrong data type in formula
     - `#NAME?`: Unrecognized formula name

### Creating new Excel files

New-workbook creation is the same as stock openpyxl: same API, same cells, styles and parts (only XML namespace placement differs).

```python
# Using openpyxl for formulas and formatting
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

wb = Workbook()
sheet = wb.active

# Add data
sheet['A1'] = 'Hello'
sheet['B1'] = 'World'
sheet.append(['Row', 'of', 'data'])

# Add formula
sheet['B2'] = '=SUM(A1:A10)'

# Formatting
sheet['A1'].font = Font(bold=True, color='FF0000')
sheet['A1'].fill = PatternFill('solid', start_color='FFFF00')
sheet['A1'].alignment = Alignment(horizontal='center')

# Column width
sheet.column_dimensions['A'].width = 20

wb.save('output.xlsx')
```

### Editing existing Excel files

`load_workbook` opens existing files in **preserve mode** by default: a save patches the parts your edits touch and copies every other part unchanged. An edit it cannot save faithfully raises `PaperRefusal` and writes nothing.

```python
from openpyxl import load_workbook
from openpyxl.errors import PaperRefusal

wb = load_workbook('existing.xlsx')
sheet = wb.active  # or wb['SheetName'] for specific sheet

for sheet_name in wb.sheetnames:
    print(f"Sheet: {sheet_name}")

sheet['B2'] = 20
sheet.insert_rows(12)  # Formulas, tables and chart ranges below shift with it
wb.create_sheet('NewSheet')['A1'] = 'Data'

try:
    receipt = wb.save('modified.xlsx', receipt=True)
except PaperRefusal as e:
    print(f"Refused ({type(e).__name__}, {e.kind}): {e}")  # Tell the user; nothing was written
else:
    print(receipt.to_dict()['parts_changed'])   # Only the parts you meant to touch
    print(receipt.to_dict()['derived_effects'])  # e.g. formula caches removed, recalc requested
```

Rules:
- **Call `save()` once per load.** It plans and validates before writing. `wb.validate()` runs the same plan without writing; use it only as a dry run on a load you will not save. On a workbook with a chart, a second plan on the same load (validate then save, save twice, save after a refusal) raises a false "chart ... was modified" refusal. Reload the file first.
- **Read the receipt**: `parts_changed`, `parts_added`, `parts_removed` should list only what you meant to change. Anything in `parts_removed` is a red flag: tell the user.
- **`PaperRefusal` is final.** Report it to the user with its message. Never retry with `preserve=False` (that is stock openpyxl and drops parts), never patch the XML or ZIP by hand.
- **`data_only=True`** reads cached values. Saving that load is refused (edited cells would lose their formulas). Only with `allow_formula_loss=True` does it save, and then only the edited cells lose formulas.
- `read_only=True` and `preserve=False` use the stock openpyxl path: no preservation.

**Known effects of preserve mode:**
- **Formula caches**: when an edit changes a value a formula reads (or the formula text), save clears that formula's cached value and sets `fullCalcOnLoad` so Excel recalculates on open. Until `recalc.py` runs, pandas and `data_only=True` read those cells as empty. Run `recalc.py` after every edit that touches formula inputs.
- **Pivot tables**: editing a pivot's source range is refused (`kind='stale-pivot-cache'`). If the user wants the edit, request a refresh in Excel: `wb.set_pivot_refresh_on_load(pivots=['Sheet!PivotName'])` before `save()` (example below). Headless readers still see the old pivot values until Excel opens the file.
- Some files fail to load with a plain `TypeError` (non-standard styles). Report it; do not fall back to another library.

### Preserve-mode helpers

Each needs preserve mode. Per the fork's contract each completes or raises `PaperRefusal`.

```python
from openpyxl import load_workbook
from openpyxl.preserve import copy_format, scan_errors, diff_workbooks

wb = load_workbook('existing.xlsx')
ws = wb['Data']

ws.append_table_row('Sales', {'Month': 'Apr', 'Units': 11, 'Price': 3.0})  # Expands table "Sales"; a list works too
ws.replace_image('F10', 'new_logo.png')        # Image anchored at F10; keeps its anchor
ws._charts[0].repoint(0, "'Data'!$C$2:$C$5")  # Series 0 of the first chart now plots C2:C5
copy_format(ws, 'A1', 'B1:D1')                 # Font, fill, border, alignment, number format; not values
print(wb.search('Total'))                      # [{'address': 'Data!D1', 'match': 'Total', 'kind': 'value'}, ...]
print(ws.allowed_values('G1'))                 # List-validation choices, e.g. ['EU', 'US', 'APAC']; None if none
print(scan_errors(wb))                         # Error operands in formulas + cached error values; no calculation
wb.save('modified.xlsx')

print(diff_workbooks('existing.xlsx', 'modified.xlsx').to_dict()['changed'])  # Cell-level before/after
```

Pivot source edit (refused without the refresh request):

```python
from openpyxl import load_workbook

wb = load_workbook('pivot.xlsx')
wb['Tabelle1']['B2'] = 5  # A cell inside the pivot's source range
wb.set_pivot_refresh_on_load(pivots=['Tabelle2!PivotTable1', 'Tabelle3!PivotTable1'])  # Sheet-qualify duplicate names
receipt = wb.save('pivot_edited.xlsx', receipt=True)  # derived_effects lists 'excel_refresh_on_open'
```

## Recalculating formulas

Excel files created or modified by openpyxl contain formulas as strings but not calculated values. Use the provided `recalc.py` script to recalculate formulas.

**Location:** The script is at `.claude/skills/xlsx/recalc.py` (NOT in a scripts/ subfolder)

**Requirements:**
- paper-xlsx must be installed
- LibreOffice must be installed (on PATH, or `/Applications/LibreOffice.app` on macOS)

**Usage:**
```bash
# The script is in the xlsx skill root folder (NOT in a scripts/ subfolder)
python /path/to/.claude/skills/xlsx/recalc.py <excel_file> [timeout_seconds]
```

**Example:**
```bash
python /home/user/.claude/skills/xlsx/recalc.py output.xlsx 30
```

**If LibreOffice is unavailable:**
The recalc.py script returns `{"error": "LibreOffice not found ..."}`. In this case:
1. The Excel file will still be created with formulas
2. Formulas will calculate when opened in Excel
3. Warn the user that values may show as 0 until opened in Excel

The script:
- Recalculates a temporary copy (paper-xlsx `openpyxl.oracle`) and writes the computed values into the ORIGINAL file; other parts stay unchanged. Excel still recalculates on open
- Scans ALL cells for Excel errors (#REF!, #DIV/0!, etc.)
- Returns JSON with detailed error locations and counts
- Works on both Linux and macOS
- Never writes an error value: where LibreOffice gets an error, the cell keeps Excel's last saved value
- With stock openpyxl it falls back to the old LibreOffice re-save (can drop charts, images, OLE objects): `"method": "legacy-libreoffice-resave"` plus a `warning`. Install paper-xlsx and tell the user

## Formula Verification Checklist

Quick checks to ensure formulas work correctly:

### Essential Verification
- [ ] **Test 2-3 sample references**: Verify they pull correct values before building full model
- [ ] **Column mapping**: Confirm Excel columns match (e.g., column 64 = BL, not BK)
- [ ] **Row offset**: Remember Excel rows are 1-indexed (DataFrame row 5 = Excel row 6)

### Common Pitfalls
- [ ] **NaN handling**: Check for null values with `pd.notna()`
- [ ] **Far-right columns**: FY data often in columns 50+ 
- [ ] **Multiple matches**: Search all occurrences, not just first
- [ ] **Division by zero**: Check denominators before using `/` in formulas (#DIV/0!)
- [ ] **Wrong references**: Verify all cell references point to intended cells (#REF!)
- [ ] **Cross-sheet references**: Use correct format (Sheet1!A1) for linking sheets

### Formula Testing Strategy
- [ ] **Start small**: Test formulas on 2-3 cells before applying broadly
- [ ] **Verify dependencies**: Check all cells referenced in formulas exist
- [ ] **Test edge cases**: Include zero, negative, and very large values

### Interpreting recalc.py Output
The script returns JSON with error details:
```json
{
  "status": "success",           // or "errors_found"
  "total_errors": 0,              // Total error count
  "total_formulas": 42,           // Number of formulas in file
  "error_summary": {              // {} when no errors
    "#REF!": {
      "count": 2,
      "locations": ["Sheet1!B5", "Sheet1!C10"]
    }
  },
  "method": "paper-oracle",       // or "legacy-libreoffice-resave" (see above)
  "cells_written": 40             // Computed values written into the file
}
```
- An `error` key instead means nothing was recalculated; the file is unchanged. Tell the user the message.
- LibreOffice is not Excel. An error on a structured table reference (`Table1[Column]`, `[#This Row]`) can be a LibreOffice limitation: compare with the value Excel cached (`load_workbook(path, data_only=True)`) before rewriting the formula.

## Best Practices

### Library Selection
- **pandas**: Best for data analysis, bulk operations, and simple data export
- **openpyxl (paper-xlsx)**: Best for complex formatting, formulas, Excel-specific features, and every edit of an existing file

### Working with openpyxl
- Cell indices are 1-based (row=1, column=1 refers to cell A1)
- Use `data_only=True` to read calculated values: `load_workbook('file.xlsx', data_only=True)`
- **Warning**: Do not save a `data_only=True` load. paper-xlsx refuses it; `allow_formula_loss=True` replaces the edited cells' formulas with values
- For large files: Use `read_only=True` for reading (stock path, no preservation) or `write_only=True` for writing
- Formulas are preserved but not evaluated - use recalc.py to update values

### Working with pandas
- Specify data types to avoid inference issues: `pd.read_excel('file.xlsx', dtype={'id': str})`
- For large files, read specific columns: `pd.read_excel('file.xlsx', usecols=['A', 'C', 'E'])`
- Handle dates properly: `pd.read_excel('file.xlsx', parse_dates=['date_column'])`

## Code Style Guidelines
**IMPORTANT**: When generating Python code for Excel operations:
- Write minimal, concise Python code without unnecessary comments
- Avoid verbose variable names and redundant operations
- Avoid unnecessary print statements

**For Excel files themselves**:
- Add comments to cells with complex formulas or important assumptions
- Document data sources for hardcoded values
- Include notes for key calculations and model sections

---

# Troubleshooting

## Common Errors

### `ModuleNotFoundError: No module named 'openpyxl'`
**Cause:** paper-xlsx not installed
**Fix:** `pip install paper-xlsx` (the import name stays `openpyxl`)

### `paper-xlsx-doctor: FAIL: paper-xlsx and openpyxl are both installed`
**Cause:** stock openpyxl installed next to paper-xlsx
**Fix:** `python -m pip uninstall -y openpyxl paper-xlsx && python -m pip install --force-reinstall paper-xlsx`

### `ModuleNotFoundError: No module named 'pandas'`
**Cause:** pandas package not installed
**Fix:** `pip install pandas`

### `UnsupportedStructureError: chart 0 on sheet '...' was modified, but its serializer does not represent the changed property`
**Cause:** a second save plan on the same load (`validate()` then `save()`, or a second `save()`)
**Fix:** reload the file, redo the edits, call `save()` once

### recalc.py returns `{"error": "LibreOffice not found ..."}`
**Cause:** LibreOffice not installed
**Fix:**
- macOS: `brew install --cask libreoffice`
- Linux: `sudo apt install libreoffice`
- Verify with: `python -c "from openpyxl import oracle; print(oracle.find_soffice())"`

### `can't open file 'scripts/recalc.py': No such file`
**Cause:** Wrong path - recalc.py is in the skill root, not in scripts/ subfolder
**Fix:** Use `/path/to/.claude/skills/xlsx/recalc.py` (no scripts/ folder)

### Formulas showing 0 or stale values
**Cause:** Formula recalculation didn't run or failed (preserve-mode edits clear the cached values of affected formulas)
**Fix:**
1. Run recalc.py: `python /path/to/skills/xlsx/recalc.py yourfile.xlsx`
2. Or open in Excel/LibreOffice and press Ctrl+Shift+F9 to force recalculation
3. If LibreOffice unavailable, inform user that formulas calculate when opened in Excel
