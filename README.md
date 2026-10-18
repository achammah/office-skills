# office-skills

Agent skills for editing Excel and PowerPoint files without silent damage.

- `skills/xlsx/` runs on **[paper-xlsx](https://pypi.org/project/paper-xlsx/) 0.2.2**, a preserving fork of openpyxl.
  One cell edit with stock openpyxl damaged 19 of 20 real workbooks in our benchmark; paper-xlsx kept 16 clean.
- `skills/pptx/` stays on **python-pptx 1.0.2**, with chart-safe slide copy/delete and
  formatting-safe text replace ported from [paper-pptx](https://github.com/paper-instruments/paper-pptx).
- `benchmark/REPORT.md`: the comparison of paper-docx / paper-pptx / paper-xlsx against
  python-docx / python-pptx / openpyxl that drove these choices (60 real files, 60 agent runs).

## Install

xlsx skill (never install `openpyxl` and `paper-xlsx` together; both own the `openpyxl` import):

```bash
pip uninstall -y openpyxl
pip install paper-xlsx pandas pillow
python -m paper_xlsx_doctor
```

pptx skill:

```bash
pip install python-pptx
cd skills/pptx && npm install   # html2pptx deck creation
```

Both skills use LibreOffice (`soffice`) headless for recalculation, rendering and checks.

## Key changes versus the earlier skills

| Skill | Change | Measured result |
|---|---|---|
| xlsx | Edits in paper-xlsx preserve mode, with edit receipts and typed refusals | Charts, OLE, comments, conditional formatting kept |
| xlsx | `recalc.py` uses `openpyxl.oracle.recalc` | 0 parts dropped where the old LibreOffice save dropped 7 |
| pptx | `rearrange.py` duplicate copies charts + workbooks | The old script lost the chart on the copy |
| pptx | `replace.py` find/replace across runs, tables, groups, notes | A task paper-pptx failed 5/5 passes 12/12 |
| pptx | `inventory.py` sees table cells and grouped shapes | 51 paragraphs found instead of 23 |
| pptx | Validator accepts absolute relationship targets and sections | Valid decks no longer false-fail |

## Licence

MIT, see `LICENSE`. Third-party notices: `THIRD_PARTY_NOTICES.md`.
