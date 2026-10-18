# paper-docx / paper-pptx / paper-xlsx vs python-docx / python-pptx / openpyxl

Benchmark run 2026-10-16 on macOS arm64, Python 3.12.13, lxml 6.1.3.
Forks (PyPI latest that day): paper-docx 0.2.1 · paper-pptx 0.2.1 · paper-xlsx 0.2.2.
Upstream: python-docx 1.2.0 · python-pptx 1.0.2 · openpyxl 3.1.5.

> Evidence note: the raw result files (CSVs, renders, harness scripts) were lost on 2026-10-18
> when a temp-folder cleanup removed the working directory. Every number below was read from
> those files and recorded at the time in the project log; see "Reproducing" to regenerate them.

## Verdict

| Library | Verdict | Why, in one line |
|---|---|---|
| paper-xlsx | **Adopt** for editing existing workbooks | openpyxl damaged 19 of 20 real files on a one-cell edit; paper-xlsx kept 16 clean, 2 minor, 1 refused safely |
| paper-pptx | **Do not adopt; port its techniques** | Slide clone keeps charts where our script lost them, but its text replace failed 5 of 5 agent runs and found 0 matches on our decks |
| paper-docx | **Skip for now** | No fidelity gain on 20 files; agents failed 4 of 5 text-box edits with it vs 0 of 5 without |

Creating new files: identical in all three (same object model; pptx renders 0 pixels different).
Speed: the forks are never faster; at worst about 0.1 s slower per file. No vendor speed claim reproduced.

## The corpus

60 real files from Apache POI test-data (20 per format, Apache-2.0), picked for features: charts,
pivots, images, OLE embeddings, data validation, conditional formatting, comments, tracked
changes, footnotes, text boxes, content controls, SmartArt, notes, groups. No fuzz files. The
forks' own fixtures were not used for scoring. File list: `corpus.md`.

## M3 Edit fidelity (the forks' main claim)

One minimal edit per file (one cell / one text run), then save. Package diff before/after
(part list + canonical XML compare), plus a no-edit round trip. 240 rows, 540 validity rows.

| Format | Original library: clean / damaged / refused / crash | Fork: clean / damaged / refused / crash |
|---|---|---|
| docx (20) | 20 / 0 / 0 / 0 | 20 / 0 / 0 / 0 |
| pptx (20) | 19 / 1 / 0 / 0 | 19 / 0 / 1 / 0 |
| xlsx (20) | 0 / 19 / 0 / 1 | 16 / 2 / 1 / 1 |

- **xlsx:** openpyxl dropped 159 package parts without Pillow, 97 with Pillow. Lost even with
  Pillow: charts, OLE embeddings, customXml, xmlMaps, connections, comments, printer settings,
  conditional formatting, 379 cached formula values. Example: one cell edit on
  `ConditionalFormattingSamples.xlsx` dropped 87 parts (29 with Pillow).
- **The xlsx gain is preserve mode.** paper-xlsx with `preserve=False` drops exactly the same
  parts as openpyxl.
- **paper-xlsx weak spots:** 2 files had cached formula values cleared plus `fullCalcOnLoad` set
  (Excel recalculates on open); `picture.xlsx` crashes all libraries with a plain `TypeError`
  (not a typed refusal); a pivot workbook is refused at save (stale pivot cache), by design.
- **pptx:** python-pptx broke `with_japanese.pptx` (4 relationship ids removed while the slide
  still points to them; validator: "will cause the document to appear corrupt"). paper-pptx
  refuses that file at load with a typed error.
- **docx:** python-docx lost nothing on these 20 files.
- **Without Pillow, openpyxl drops images silently** (no warning). paper-xlsx keeps them either way.

## M4 Agent cost

Headless Claude Code (claude-sonnet-5-5, `--safe-mode`), 6 edit tasks, 5 runs per task per
library, 60 runs, $3.59 total. Same prompt both arms; the paper arm also gets the fork's
additions doc (the realistic setup). A stdlib-only verifier per task, proven to fail on the
input and on a broken output, and to pass on a reference solution.

| Task | Original: success, median $ | Fork: success, median $ |
|---|---|---|
| D1 tracked redline across split runs | 5/5, 0.0536 | 5/5, 0.0524 |
| D2 replace text in a text box + footnote | 5/5, 0.0569 | **1/5**, 0.0802 |
| P1 FY25→FY26 in tables, groups, notes | 4/5, 0.0339 | **0/5** |
| P2 clone a chart slide, change clone data | 5/5, 0.0666 | 5/5, 0.0998 |
| X1 edit input in a model with chart, validation, image | 5/5*, 0.0508 | 5/5, 0.0534 |
| X2 append a row to a named table | 5/5, 0.0475 | 5/5, 0.0501 |
| **Total** | **29/30, $1.57** | **21/30, $2.01** |

Median cost is over successful runs only.
- *X1 original: 4 of 5 agents refused to use openpyxl and patched the XML with `zipfile`,
  saying openpyxl drops charts. Only 1 run used openpyxl. With paper-xlsx, 5 of 5 used the library.
- P1 fork failures: `replace_text` merges a split "FY2"+"5" run, so the new "6" loses its colour.
- D2 fork failures: `replace_all` leaves the old text in the text box's VML fallback copy.

## M1 Runtime + memory

10 timed repeats per case, fresh process each, arms interleaved. A difference counts only if
medians differ >10% and p10–p90 ranges do not overlap. 426 rows.

- Create (docx, pptx, xlsx): no difference.
- pptx load/edit: no difference on 19 files.
- docx: fork slower on 2/20 loads and 6/20 edits; median gap about 0.1 s (import 0.078 s vs 0.112 s).
- xlsx without Pillow: fork slower on 1/19 loads, 2/19 edits. With Pillow: no difference on any
  file. Preserve mode costs about 0.08 s per load and 0.13 s per edit.
- Peak memory: fork +2.8% to +14.7%.
- `patch_save` is slower than plain save (docx 0.248 vs 0.203 s; pptx 0.350 vs 0.191 s).
  `save(receipt=True)` costs nothing measurable.

## M2 Validity

All 718 delivered outputs (runtime 238, fidelity 462, pptx quality 18) reopen with their own
library and convert to PDF in LibreOffice. Refused or crashed runs deliver no file (18 rows).
OOXML schema check (docx/pptx): new errors only in python-pptx's `with_japanese.pptx` output.
MS Office was not driven (headless-only rule).

## M5 pptx quality, on our own skill

- Creation: 11 slides, 0 different pixels, 73 parts each.
- Our old `rearrange.py` duplicated a chart slide **without its chart** (the copy's chart link
  pointed at the layout); our old validator still passed the file. paper-pptx `Slides.clone`
  copies chart + workbook; the original stays byte-identical.
- Our old `replace.py` rewrote 151–162 unrelated paragraphs per deck and flattened bold/bullets.
  paper-pptx `replace_text` changes only the target, but finds 0 matches on html2pptx decks
  because our pipeline writes `a:pPr` between runs; it reports 0 as success.
- `replace_data_safe` refuses our charts (empty series name from pptxgenjs).
- Deck creation (html2pptx, JavaScript) and thumbnails are outside paper-pptx's reach.

## What we shipped from this

- **xlsx skill on paper-xlsx 0.2.2:** preserve-mode editing, edit receipts, refusal handling,
  helper APIs, a "save once per load" rule (fork bug 7 below). `recalc.py` now uses
  `openpyxl.oracle.recalc`: 0 parts dropped on `WithEmbeded.xlsx` where the old LibreOffice save
  dropped 7 (2 OLE, 2 EMF, 2 VML, printer settings), and Excel's cached values are kept where
  LibreOffice wrongly reported `#VALUE!`/`#N/A` on table formulas. All 13 code examples in
  SKILL.md run in a fresh install.
- **pptx skill stays on python-pptx, with paper-pptx's techniques ported (MIT, attributed):**
  - `rearrange.py`: duplicate copies charts with their workbooks and style parts; delete leaves
    no orphan parts and keeps sections consistent; unsafe slides are refused. 60 checks pass.
  - `replace.py`: find/replace across runs and across `a:pPr`, each new character keeps the
    formatting of the one it replaces, covers tables, groups and notes, 0 matches is an error.
    The P1 task that paper-pptx failed 5/5 passes 12/12. 167 checks pass.
  - `inventory.py`: table cells and correct group positions; reading no longer edits the deck.
  - Validator: absolute relationship targets and section slide lists no longer false-fail.

## Bugs to report to paper-instruments

1. paper-pptx `replace_text` merges split runs; replacement takes the start run's formatting.
2. paper-pptx `replace_text` stops at `a:pPr` between runs and returns 0 replacements as success.
3. paper-pptx `replace_data_safe` refuses a series with an empty name.
4. paper-docx `replace_all` / `Span.replace` leave old text in the VML fallback of a text box.
5. paper-xlsx clears unrelated cached formula values on an empty-cell edit (StructuredReferences.xlsx).
6. paper-xlsx raises a plain `TypeError` on a non-standard styles attribute (picture.xlsx), not a `PaperRefusal`.
7. paper-xlsx: on a workbook with a chart, a second save plan on one load (validate then save,
   save twice) raises a false "chart ... was modified" refusal (WithChart, WithThreeCharts,
   SimpleScatterChart, simple-monthly-budget).

## Vendor claims vs evidence

- No test in the three fork repos runs the original libraries. Only paper-xlsx reproduces
  upstream damage (row inserts, VBA loss, data_only formula loss).
- Speed claims ("2.8–3.0x" pptx batch, "235x" xlsx copy) are in code comments only. Our runs
  show no speed gain.
- "Verified in PowerPoint/Word" claims have no artifact in the repos.

## Limits

One machine, noisy (p90 often 2–4× p10). One model for agent runs. MS Office not driven.
20 files per format. Agent tasks are edit tasks; creation was not agent-tested.
Raw result files lost after the run (see the note at the top).

## Reproducing

1. Download the 60 files in `corpus.md` from Apache POI `test-data`.
2. Build two venvs per format, never both distributions in one: upstream (`python-docx==1.2.0`,
   `python-pptx==1.0.2`, `openpyxl==3.1.5`) and fork (`paper-docx==0.2.1`, `paper-pptx==0.2.1`,
   `paper-xlsx==0.2.2`); add `pillow` to both xlsx venvs for the Pillow condition.
3. Fidelity: load, change the first text run / first plain cell, save (fork: preserve mode,
   `patch_save` for docx/pptx); compare part lists and canonical XML before/after.
4. Validity: reopen, LibreOffice headless PDF export, OOXML XSD check.
