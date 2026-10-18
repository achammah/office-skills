#!/usr/bin/env python3
"""Apply text replacements to PowerPoint presentation.

Usage:
    python replace.py <input.pptx> <replacements.json> <output.pptx>
    python replace.py <input.pptx> <output.pptx> --find TEXT --replace TEXT
                      [--find TEXT --replace TEXT ...] [--no-notes] [--allow-missing]

Mode 1, inventory JSON (template workflow). The replacements JSON has the structure
output by inventory.py. ALL text shapes ("shape-N") identified by inventory.py will have
their text cleared unless "paragraphs" is specified in the replacements for that shape.
Table-cell entries ("table-T-rRcC") change only when they are listed.
For a listed shape, each paragraph is compared with the current one:
  - same text and formatting keys: the paragraph is not touched at all;
  - only the text differs: the text is edited in place, runs and their formatting kept
    (rule below);
  - a formatting key differs (a key you leave out means "keep"): that paragraph is
    rebuilt from the JSON as before (one run);
  - a different number of paragraphs: the whole shape is rebuilt from the JSON as before.

Mode 2, find/replace. Every literal, case-sensitive occurrence of each --find is replaced
in slide text frames, table cells, grouped shapes (any depth) and speaker notes (unless
--no-notes). The same mode runs from a JSON file of the form
  {"find_replace": [{"find": "FY25", "replace": "FY26"}], "include_notes": true}
Pairs run in the order given. A match may span several runs of one paragraph; a:pPr
elements and empty nodes between runs are ignored; a match never crosses a line break
(a:br), a field (a:fld) or a paragraph. Zero matches for any --find is an error: nothing
is saved and the exit code is 1, unless --allow-missing.

Formatting rule (both modes). Replacement characters inherit, position by position, the
formatting of the characters they replace: the common prefix and suffix of the old and new
text stay in their own runs; the i-th changed character takes the run of the i-th replaced
character; when the new text is longer, the extra characters take the run of the last
replaced character; a pure insertion takes the run of the character before it (else the
one after). Runs the edit does not reach stay byte-identical; a run left with no text is
removed (unless it is the paragraph's last run). Example: "FY2"(black) + "5"(red) with
FY25 -> FY26 gives "FY2"(black) + "6"(red).

Only parts whose XML changed are rewritten in the output; every other part of the
package is copied byte for byte from the input.

Run-boundary replacement technique adapted from paper-pptx (MIT), src/pptx/edit.py.
"""

import io
import json
import sys
import tempfile
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from inventory import InventoryData, ParagraphData, extract_text_inventory
from lxml import etree
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.dml import MSO_THEME_COLOR
from pptx.enum.text import PP_ALIGN
from pptx.oxml.ns import qn
from pptx.oxml.xmlchemy import OxmlElement
from pptx.util import Pt


def clear_paragraph_bullets(paragraph):
    """Clear bullet formatting from a paragraph."""
    pPr = paragraph._element.get_or_add_pPr()

    # Remove existing bullet elements
    for child in list(pPr):
        if (
            child.tag.endswith("buChar")
            or child.tag.endswith("buNone")
            or child.tag.endswith("buAutoNum")
            or child.tag.endswith("buFont")
        ):
            pPr.remove(child)

    return pPr


def apply_paragraph_properties(paragraph, para_data: Dict[str, Any]):
    """Apply formatting properties to a paragraph."""
    # Get the text but don't set it on paragraph directly yet
    text = para_data.get("text", "")

    # Get or create paragraph properties
    pPr = clear_paragraph_bullets(paragraph)

    # Handle bullet formatting
    if para_data.get("bullet", False):
        level = para_data.get("level", 0)
        paragraph.level = level

        # Calculate font-proportional indentation
        font_size = para_data.get("font_size", 18.0)
        level_indent_emu = int((font_size * (1.6 + level * 1.6)) * 12700)
        hanging_indent_emu = int(-font_size * 0.8 * 12700)

        # Set indentation
        pPr.attrib["marL"] = str(level_indent_emu)
        pPr.attrib["indent"] = str(hanging_indent_emu)

        # Add bullet character
        buChar = OxmlElement("a:buChar")
        buChar.set("char", "•")
        pPr.append(buChar)

        # Default to left alignment for bullets if not specified
        if "alignment" not in para_data:
            paragraph.alignment = PP_ALIGN.LEFT
    else:
        # Remove indentation for non-bullet text
        pPr.attrib["marL"] = "0"
        pPr.attrib["indent"] = "0"

        # Add buNone element
        buNone = OxmlElement("a:buNone")
        pPr.insert(0, buNone)

    # Apply alignment
    if "alignment" in para_data:
        alignment_map = {
            "LEFT": PP_ALIGN.LEFT,
            "CENTER": PP_ALIGN.CENTER,
            "RIGHT": PP_ALIGN.RIGHT,
            "JUSTIFY": PP_ALIGN.JUSTIFY,
        }
        if para_data["alignment"] in alignment_map:
            paragraph.alignment = alignment_map[para_data["alignment"]]

    # Apply spacing
    if "space_before" in para_data:
        paragraph.space_before = Pt(para_data["space_before"])
    if "space_after" in para_data:
        paragraph.space_after = Pt(para_data["space_after"])
    if "line_spacing" in para_data:
        paragraph.line_spacing = Pt(para_data["line_spacing"])

    # Apply run-level formatting
    if not paragraph.runs:
        run = paragraph.add_run()
        run.text = text
    else:
        run = paragraph.runs[0]
        run.text = text

    # Apply font properties
    apply_font_properties(run, para_data)


def apply_font_properties(run, para_data: Dict[str, Any]):
    """Apply font properties to a text run."""
    if "bold" in para_data:
        run.font.bold = para_data["bold"]
    if "italic" in para_data:
        run.font.italic = para_data["italic"]
    if "underline" in para_data:
        run.font.underline = para_data["underline"]
    if "font_size" in para_data:
        run.font.size = Pt(para_data["font_size"])
    if "font_name" in para_data:
        run.font.name = para_data["font_name"]

    # Apply color - prefer RGB, fall back to theme_color
    if "color" in para_data:
        color_hex = para_data["color"].lstrip("#")
        if len(color_hex) == 6:
            r = int(color_hex[0:2], 16)
            g = int(color_hex[2:4], 16)
            b = int(color_hex[4:6], 16)
            run.font.color.rgb = RGBColor(r, g, b)
    elif "theme_color" in para_data:
        # Get theme color by name (e.g., "DARK_1", "ACCENT_1")
        theme_name = para_data["theme_color"]
        try:
            run.font.color.theme_color = getattr(MSO_THEME_COLOR, theme_name)
        except AttributeError:
            print(f"  WARNING: Unknown theme color name '{theme_name}'")


# --------------------------------------------------------------------------------------
# Run-preserving text model
#
# A paragraph's visible text is a list of atoms (char, run, segment): characters of a:r
# runs are editable (run = the a:r element); a:br ("\v") and a:fld characters are fixed
# (run = None). The joined chars equal python-pptx's paragraph.text. a:pPr, a:endParaRPr
# and elements without text are transparent, so html2pptx output that repeats a:pPr
# between runs still matches across runs. A text-bearing element of any other kind starts
# a new segment: matches and in-place edits never span two segments.
# --------------------------------------------------------------------------------------

_A_R = qn("a:r")
_A_BR = qn("a:br")
_A_FLD = qn("a:fld")
_A_T = qn("a:t")
_TRANSPARENT = {qn("a:pPr"), qn("a:endParaRPr")}

_P_SP = qn("p:sp")
_P_GRPSP = qn("p:grpSp")
_P_GRAPHICFRAME = qn("p:graphicFrame")
_P_TXBODY = qn("p:txBody")
_A_TBL = qn("a:tbl")
_A_TR = qn("a:tr")
_A_TC = qn("a:tc")
_A_TXBODY = qn("a:txBody")
_A_P = qn("a:p")
_MC_NS = "http://schemas.openxmlformats.org/markup-compatibility/2006"
_MC_AC = "{%s}AlternateContent" % _MC_NS
_MC_CHOICE = "{%s}Choice" % _MC_NS
_MC_FALLBACK = "{%s}Fallback" % _MC_NS

_RT_NOTES = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide"
_UNREACHED_RELTYPE_SUFFIXES = ("/chart", "/diagramData", "/diagramDrawing")


def _run_text(r) -> str:
    t = r.find(_A_T)
    return (t.text or "") if t is not None else ""


def _paragraph_atoms(p) -> List[Tuple[str, Any, int]]:
    """Return the (char, run-or-None, segment) atoms of paragraph element `p`."""
    atoms: List[Tuple[str, Any, int]] = []
    seg = 0
    for child in p:
        tag = child.tag
        if not isinstance(tag, str):  # comment or processing instruction
            continue
        if tag == _A_R:
            atoms.extend((c, child, seg) for c in _run_text(child))
        elif tag == _A_BR:
            seg += 1
            atoms.append(("\v", None, seg))
            seg += 1
        elif tag == _A_FLD:
            seg += 1
            atoms.extend((c, None, seg) for c in _run_text(child))
            seg += 1
        elif tag in _TRANSPARENT or not "".join(child.itertext()):
            continue
        else:
            seg += 1
    return atoms


def _apply_edits(p, atoms, edits: List[Tuple[int, int, str]]) -> bool:
    """Apply sorted, non-overlapping (start, end, new_text) edits to `p`'s runs.

    Every [start, end) range must cover editable atoms of one segment (callers check).
    Implements the formatting rule in the module docstring. Returns True if any run's
    text changed.
    """
    runs = [child for child in p if child.tag == _A_R]
    new_text: Dict[int, List[str]] = {id(r): [] for r in runs}

    def keep(span):
        for ch, run, _ in span:
            if run is not None:
                new_text[id(run)].append(ch)

    pos = 0
    for start, end, new in edits:
        keep(atoms[pos:start])
        old = "".join(ch for ch, _, _ in atoms[start:end])
        shortest = min(len(old), len(new))
        k = 0
        while k < shortest and old[k] == new[k]:
            k += 1
        m = 0
        while m < shortest - k and old[len(old) - 1 - m] == new[len(new) - 1 - m]:
            m += 1
        keep(atoms[start : start + k])
        replaced = atoms[start + k : end - m]
        inserted = new[k : len(new) - m]
        if replaced:
            owners = [run for _, run, _ in replaced]
        else:
            before = start + k - 1
            if before >= 0 and atoms[before][1] is not None:
                owners = [atoms[before][1]]
            else:
                owners = [atoms[start + k][1]]
        for i, ch in enumerate(inserted):
            new_text[id(owners[min(i, len(owners) - 1)])].append(ch)
        keep(atoms[end - m : end])
        pos = end
    keep(atoms[pos:])

    changed = False
    emptied = []
    for r in runs:
        text = "".join(new_text[id(r)])
        if text == _run_text(r):
            continue
        changed = True
        t = r.find(_A_T)
        if t is None:
            t = etree.SubElement(r, _A_T)
        t.text = text
        if text == "":
            emptied.append(r)
    for r in emptied:
        if sum(1 for child in p if child.tag == _A_R) > 1:
            p.remove(r)
    return changed


def _check_text(name: str, value: str) -> None:
    """Refuse text that cannot sit inside one a:t (line breaks, XML control characters)."""
    if not isinstance(value, str):
        raise ValueError(f"{name} must be a string, got {value!r}")
    if any(ch in value for ch in "\n\r\v"):
        raise ValueError(
            f"{name} must not contain line breaks (a match never crosses a line break or a "
            f"paragraph): {value!r}"
        )
    if any(ch < " " and ch != "\t" for ch in value):
        raise ValueError(f"{name} contains control characters not allowed in XML: {value!r}")


def _find_edits(atoms, find: str, replace: str) -> List[Tuple[int, int, str]]:
    """Non-overlapping left-to-right matches of `find` inside each editable segment."""
    edits = []
    i, n = 0, len(atoms)
    while i < n:
        if atoms[i][1] is None:
            i += 1
            continue
        seg = atoms[i][2]
        j = i
        while j < n and atoms[j][1] is not None and atoms[j][2] == seg:
            j += 1
        text = "".join(ch for ch, _, _ in atoms[i:j])
        pos = 0
        while True:
            k = text.find(find, pos)
            if k == -1:
                break
            edits.append((i + k, i + k + len(find), replace))
            pos = k + len(find)
        i = j
    return edits


def _rewrite_paragraph_text(p, new_full: str) -> bool:
    """Change paragraph `p`'s text to `new_full` keeping runs; False if not possible in place.

    One contiguous edit (common prefix/suffix kept). Not possible when the changed span
    crosses a line break or field, or the new text holds a line break / control character.
    """
    atoms = _paragraph_atoms(p)
    old_full = "".join(ch for ch, _, _ in atoms)
    if old_full == new_full:
        return True
    shortest = min(len(old_full), len(new_full))
    k = 0
    while k < shortest and old_full[k] == new_full[k]:
        k += 1
    m = 0
    while m < shortest - k and old_full[len(old_full) - 1 - m] == new_full[len(new_full) - 1 - m]:
        m += 1
    start, end = k, len(old_full) - m
    inserted = new_full[k : len(new_full) - m]
    if any(ch < " " and ch != "\t" for ch in inserted):
        return False
    span = atoms[start:end]
    if span:
        if any(run is None for _, run, _ in span) or len({seg for _, _, seg in span}) > 1:
            return False
    else:
        before_ok = start > 0 and atoms[start - 1][1] is not None
        after_ok = start < len(atoms) and atoms[start][1] is not None
        if not (before_ok or after_ok):
            return False
    _apply_edits(p, atoms, [(start, end, inserted)])
    return True


# --------------------------------------------------------------------------------------
# Traversal: every text body a reader can see on a slide or notes slide
# --------------------------------------------------------------------------------------


def _iter_text_bodies(container, in_fallback: bool = False):
    """Yield (txBody, in_fallback) for p:sp text, grouped shapes (recursive) and table
    cells. Both branches of mc:AlternateContent are visited so they stay in step;
    bodies inside mc:Fallback are flagged."""
    for child in container:
        tag = child.tag
        if tag == _P_SP:
            txBody = child.find(_P_TXBODY)
            if txBody is not None:
                yield txBody, in_fallback
        elif tag == _P_GRPSP:
            yield from _iter_text_bodies(child, in_fallback)
        elif tag == _P_GRAPHICFRAME:
            tbl = child.find(".//" + _A_TBL)
            if tbl is None:
                continue
            for tr in tbl.findall(_A_TR):
                for tc in tr.findall(_A_TC):
                    txBody = tc.find(_A_TXBODY)
                    if txBody is not None:
                        yield txBody, in_fallback
        elif tag == _MC_AC:
            for branch in child:
                if branch.tag == _MC_CHOICE:
                    yield from _iter_text_bodies(branch, in_fallback)
                elif branch.tag == _MC_FALLBACK:
                    yield from _iter_text_bodies(branch, True)


def _iter_story_parts(prs, include_notes: bool):
    """Yield (part, spTree) for each slide and, if asked, each existing notes slide.

    Uses has_notes_slide first: slide.notes_slide would create a notes slide."""
    for slide in prs.slides:
        yield slide.part, slide.shapes._spTree
        if include_notes and slide.has_notes_slide:
            yield slide.notes_slide.part, slide.notes_slide.shapes._spTree


def _snapshot(prs) -> Dict[str, bytes]:
    """Serialized XML of every slide and notes part, to find which parts an edit changed."""
    snap = {}
    for part, _ in _iter_story_parts(prs, include_notes=True):
        snap[str(part.partname)] = etree.tostring(part._element)
    return snap


def _changed_parts(prs, before: Dict[str, bytes]) -> Dict[str, Any]:
    changed = {}
    for part, _ in _iter_story_parts(prs, include_notes=True):
        name = str(part.partname)
        if etree.tostring(part._element) != before.get(name):
            changed[name] = part
    return changed


def patch_save(input_path: str, changed: Dict[str, Any], output_path: str) -> None:
    """Write `output_path` as a copy of `input_path` with only the `changed` parts
    re-serialized; every other ZIP member keeps its original bytes."""
    with zipfile.ZipFile(input_path) as zin:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as zout:
            for info in zin.infolist():
                partname = "/" + info.filename
                if partname in changed:
                    zout.writestr(info, changed[partname].blob)
                else:
                    zout.writestr(info, zin.read(info))
    Path(output_path).write_bytes(buffer.getvalue())


def _visible_text_count(xml_bytes: bytes, find: str) -> int:
    """Occurrences of `find` in the paragraphs / cached values of a chart or SmartArt part."""
    root = etree.fromstring(xml_bytes)
    total = 0
    for p in root.iter(_A_P):
        total += "".join(ch for ch, _, _ in _paragraph_atoms(p)).count(find)
    for v in root.iter("{http://schemas.openxmlformats.org/drawingml/2006/chart}v"):
        total += (v.text or "").count(find)
    return total


def _unreached(prs, find: str) -> List[str]:
    """Chart and SmartArt parts (not edited by this script) whose text contains `find`."""
    hits = []
    seen = set()
    for slide in prs.slides:
        for rel in slide.part.rels.values():
            if rel.is_external or not rel.reltype.endswith(_UNREACHED_RELTYPE_SUFFIXES):
                continue
            part = rel.target_part
            name = str(part.partname)
            if name in seen:
                continue
            seen.add(name)
            try:
                if _visible_text_count(part.blob, find):
                    hits.append(name)
            except etree.XMLSyntaxError:
                continue
    return hits


@dataclass
class ReplaceReport:
    """Outcome of replace_text()."""

    counts: Dict[str, int] = field(default_factory=dict)  # find -> occurrences replaced
    fallback_counts: Dict[str, int] = field(default_factory=dict)  # in mc:Fallback copies
    unreached: Dict[str, List[str]] = field(default_factory=dict)  # find -> chart/SmartArt parts
    paragraphs_changed: int = 0
    changed_parts: Dict[str, Any] = field(default_factory=dict)  # partname -> part

    @property
    def total(self) -> int:
        return sum(self.counts.values())

    @property
    def missing(self) -> List[str]:
        return [find for find, n in self.counts.items() if n == 0]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "counts": dict(self.counts),
            "total": self.total,
            "missing": self.missing,
            "fallback_counts": dict(self.fallback_counts),
            "unreached": dict(self.unreached),
            "paragraphs_changed": self.paragraphs_changed,
            "changed_parts": sorted(self.changed_parts),
        }


def replace_text(
    prs, pairs: List[Tuple[str, str]], include_notes: bool = True
) -> ReplaceReport:
    """Replace each literal `find` with its `replace` across `prs`, keeping formatting.

    Pairs run in order. Traversal: slide text frames, table cells, grouped shapes (any
    depth), mc:AlternateContent branches and, with include_notes, speaker notes. Returns a
    ReplaceReport; a count of 0 means the text was not found (the caller decides).
    """
    for find, repl in pairs:
        _check_text("find", find)
        _check_text("replace", repl)
        if not find:
            raise ValueError("find must be a non-empty string")

    report = ReplaceReport()
    before = _snapshot(prs)
    changed_paragraphs: Dict[int, Any] = {}  # id -> element (the reference keeps the id unique)
    for find, repl in pairs:
        count = fallback = 0
        for _, spTree in _iter_story_parts(prs, include_notes):
            for txBody, in_fallback in _iter_text_bodies(spTree):
                for p in txBody.findall(_A_P):
                    atoms = _paragraph_atoms(p)
                    edits = _find_edits(atoms, find, repl)
                    if not edits:
                        continue
                    if _apply_edits(p, atoms, edits):
                        changed_paragraphs[id(p)] = p
                    if in_fallback:
                        fallback += len(edits)
                    else:
                        count += len(edits)
        report.counts[find] = report.counts.get(find, 0) + count
        report.fallback_counts[find] = report.fallback_counts.get(find, 0) + fallback
        hits = _unreached(prs, find)
        if hits:
            report.unreached[find] = hits
    report.paragraphs_changed = len(changed_paragraphs)
    report.changed_parts = _changed_parts(prs, before)
    return report


def _overflow_worsened(before: InventoryData, after_path: Path) -> List[str]:
    original = detect_frame_overflow(before)
    updated = detect_frame_overflow(extract_text_inventory(after_path))
    errors = []
    for slide_key, shape_overflows in updated.items():
        for shape_key, new_overflow in shape_overflows.items():
            old = original.get(slide_key, {}).get(shape_key, 0.0)
            if new_overflow > old + 0.01:  # Small tolerance for rounding
                errors.append(
                    f'{slide_key}/{shape_key}: overflow worsened by {new_overflow - old:.2f}" '
                    f'(was {old:.2f}", now {new_overflow:.2f}")'
                )
    return errors


def apply_find_replace(
    pptx_file: str,
    pairs: List[Tuple[str, str]],
    output_file: str,
    include_notes: bool = True,
    allow_missing: bool = False,
) -> ReplaceReport:
    """Find/replace mode: replace, report counts, refuse to save on 0 matches."""
    prs = Presentation(pptx_file)
    inventory = extract_text_inventory(Path(pptx_file), prs)
    report = replace_text(prs, pairs, include_notes=include_notes)

    print("Replacements:")
    for find, repl in pairs:
        line = f"  {find!r} -> {repl!r}: {report.counts.get(find, 0)}"
        if report.fallback_counts.get(find):
            line += f" (+{report.fallback_counts[find]} in mc:Fallback copies)"
        print(line)
    for find, parts in report.unreached.items():
        print(f"  WARNING: {find!r} also appears in {', '.join(parts)} (charts/SmartArt are not edited)")

    if report.missing:
        names = ", ".join(repr(f) for f in report.missing)
        if not allow_missing:
            print(f"\nERROR: 0 matches for {names}. Nothing saved.")
            print("Check the text with: python inventory.py <input.pptx> <output.json>")
            print("(use --allow-missing to save the other replacements anyway)")
            raise ValueError(f"0 matches for {names}")
        print(f"\nWARNING: 0 matches for {names} (--allow-missing: saving anyway)")

    with tempfile.NamedTemporaryFile(suffix=".pptx", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        patch_save(pptx_file, report.changed_parts, str(tmp_path))
        for error in _overflow_worsened(inventory, tmp_path):
            print(f"  WARNING: text overflow: {error}")
        Path(output_file).write_bytes(tmp_path.read_bytes())
    finally:
        tmp_path.unlink()

    print(f"Saved updated presentation to: {output_file}")
    print(f"  - Replacements: {report.total}")
    print(f"  - Paragraphs changed: {report.paragraphs_changed}")
    print(f"  - Parts changed: {', '.join(sorted(report.changed_parts)) or 'none'}")
    return report


def detect_frame_overflow(inventory: InventoryData) -> Dict[str, Dict[str, float]]:
    """Detect text overflow in shapes (text exceeding shape bounds).

    Returns dict of slide_key -> shape_key -> overflow_inches.
    Only includes shapes that have text overflow.
    """
    overflow_map = {}

    for slide_key, shapes_dict in inventory.items():
        for shape_key, shape_data in shapes_dict.items():
            # Check for frame overflow (text exceeding shape bounds)
            if shape_data.frame_overflow_bottom is not None:
                if slide_key not in overflow_map:
                    overflow_map[slide_key] = {}
                overflow_map[slide_key][shape_key] = shape_data.frame_overflow_bottom

    return overflow_map


def validate_replacements(inventory: InventoryData, replacements: Dict) -> List[str]:
    """Validate that all shapes in replacements exist in inventory.

    Returns list of error messages.
    """
    errors = []

    for slide_key, shapes_data in replacements.items():
        if not slide_key.startswith("slide-"):
            continue

        # Check if slide exists
        if slide_key not in inventory:
            errors.append(f"Slide '{slide_key}' not found in inventory")
            continue

        # Check each shape
        for shape_key in shapes_data.keys():
            if shape_key not in inventory[slide_key]:
                # Find shapes without replacements defined and show their content
                unused_with_content = []
                for k in inventory[slide_key].keys():
                    if k not in shapes_data:
                        shape_data = inventory[slide_key][k]
                        # Get text from paragraphs as preview
                        paragraphs = shape_data.paragraphs
                        if paragraphs and paragraphs[0].text:
                            first_text = paragraphs[0].text[:50]
                            if len(paragraphs[0].text) > 50:
                                first_text += "..."
                            unused_with_content.append(f"{k} ('{first_text}')")
                        else:
                            unused_with_content.append(k)

                errors.append(
                    f"Shape '{shape_key}' not found on '{slide_key}'. "
                    f"Shapes without replacements: {', '.join(sorted(unused_with_content)) if unused_with_content else 'none'}"
                )

    return errors


def check_duplicate_keys(pairs):
    """Check for duplicate keys when loading JSON."""
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate key found in JSON: '{key}'")
        result[key] = value
    return result


# Inventory omits these keys when they hold their default value
_PARAGRAPH_DEFAULTS = {"bullet": False, "level": 0}


def _format_changes(old: Dict[str, Any], new: Dict[str, Any]) -> List[str]:
    """Formatting keys present in `new` whose value differs from the current paragraph."""
    changes = []
    for key, value in new.items():
        if key == "text":
            continue
        current = old.get(key, _PARAGRAPH_DEFAULTS.get(key))
        if value != current:
            changes.append(key)
    return changes


def _rebuild_paragraph(paragraph, para_data: Dict[str, Any]) -> None:
    """Legacy rebuild of one paragraph: content removed, one run written from the JSON."""
    p = paragraph._p
    for child in list(p.content_children):
        p.remove(child)
    apply_paragraph_properties(paragraph, para_data)


def _apply_shape_paragraphs(text_frame, new_paragraphs: List[Dict[str, Any]], stats) -> None:
    """Apply one shape's "paragraphs" with the least change (see module docstring)."""
    current = [p for p in text_frame.paragraphs if p.text.strip()]
    if len(current) != len(new_paragraphs):
        # Paragraph count changed: rebuild the whole text frame from the JSON
        text_frame.clear()  # type: ignore
        for i, para_data in enumerate(new_paragraphs):
            p = text_frame.paragraphs[0] if i == 0 else text_frame.add_paragraph()
            apply_paragraph_properties(p, para_data)
        stats["shapes_rebuilt"] += 1
        return

    for paragraph, new in zip(current, new_paragraphs):
        old = ParagraphData(paragraph).to_dict()
        format_changes = _format_changes(old, new)
        new_text = new.get("text", old["text"])
        if format_changes:
            _rebuild_paragraph(paragraph, {**old, **new})
            stats["paragraphs_rebuilt"] += 1
            continue
        if new_text == old["text"]:
            stats["paragraphs_unchanged"] += 1
            continue
        full = paragraph.text
        lead = full[: len(full) - len(full.lstrip())]
        trail = full[len(full.rstrip()) :]
        if _rewrite_paragraph_text(paragraph._p, lead + new_text + trail):
            stats["paragraphs_edited"] += 1
        else:
            _rebuild_paragraph(paragraph, {**old, **new})
            stats["paragraphs_rebuilt"] += 1


def apply_replacements(pptx_file: str, json_file: str, output_file: str):
    """Apply text replacements from JSON to PowerPoint presentation."""

    # Load replacement data with duplicate key detection
    with open(json_file, "r") as f:
        replacements = json.load(f, object_pairs_hook=check_duplicate_keys)

    if "find_replace" in replacements:
        if any(k.startswith("slide-") for k in replacements):
            raise ValueError('Use either "find_replace" or slide keys in one JSON, not both')
        pairs = [(item["find"], item["replace"]) for item in replacements["find_replace"]]
        apply_find_replace(
            pptx_file,
            pairs,
            output_file,
            include_notes=replacements.get("include_notes", True),
            allow_missing=replacements.get("allow_missing", False),
        )
        return

    # Load presentation
    prs = Presentation(pptx_file)

    # Get inventory of all text shapes (returns ShapeData objects)
    # Pass prs to use same Presentation instance (inventory reads without changing it)
    inventory = extract_text_inventory(Path(pptx_file), prs)

    # Detect text overflow in original presentation
    original_overflow = detect_frame_overflow(inventory)
    original_warnings = {
        (slide_key, shape_key): set(shape_data.warnings)
        for slide_key, shapes_dict in inventory.items()
        for shape_key, shape_data in shapes_dict.items()
    }

    # Validate replacements
    errors = validate_replacements(inventory, replacements)
    if errors:
        print("ERROR: Invalid shapes in replacement JSON:")
        for error in errors:
            print(f"  - {error}")
        print("\nPlease check the inventory and update your replacement JSON.")
        print(
            "You can regenerate the inventory with: python inventory.py <input.pptx> <output.json>"
        )
        raise ValueError(f"Found {len(errors)} validation error(s)")

    before = _snapshot(prs)

    # Track statistics
    shapes_processed = 0
    shapes_cleared = 0
    shapes_replaced = 0
    stats = {
        "paragraphs_unchanged": 0,
        "paragraphs_edited": 0,
        "paragraphs_rebuilt": 0,
        "shapes_rebuilt": 0,
    }

    # Process each slide from inventory
    for slide_key, shapes_dict in inventory.items():
        if not slide_key.startswith("slide-"):
            continue

        slide_index = int(slide_key.split("-")[1])

        if slide_index >= len(prs.slides):
            print(f"Warning: Slide {slide_index} not found")
            continue

        # Process each shape from inventory
        for shape_key, shape_data in shapes_dict.items():
            shapes_processed += 1

            # Get the shape directly from ShapeData
            shape = shape_data.shape
            if not shape:
                print(f"Warning: {shape_key} has no shape reference")
                continue

            # ShapeData already validates text_frame in __init__
            text_frame = shape.text_frame  # type: ignore

            replacement_shape_data = replacements.get(slide_key, {}).get(shape_key)
            if replacement_shape_data is None and shape_data.table_cell is not None:
                continue  # table cells change only when listed

            if replacement_shape_data is None or "paragraphs" not in replacement_shape_data:
                text_frame.clear()  # type: ignore
                shapes_cleared += 1
                continue

            shapes_replaced += 1
            _apply_shape_paragraphs(text_frame, replacement_shape_data["paragraphs"], stats)

    changed = _changed_parts(prs, before)

    # Check for issues after replacements on the file that will be saved
    with tempfile.NamedTemporaryFile(suffix=".pptx", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        patch_save(pptx_file, changed, str(tmp_path))
        updated_inventory = extract_text_inventory(tmp_path)
        updated_overflow = detect_frame_overflow(updated_inventory)

        # Check if any text overflow got worse
        overflow_errors = []
        for slide_key, shape_overflows in updated_overflow.items():
            for shape_key, new_overflow in shape_overflows.items():
                # Get original overflow (0 if there was no overflow before)
                original = original_overflow.get(slide_key, {}).get(shape_key, 0.0)

                # Error if overflow increased
                if new_overflow > original + 0.01:  # Small tolerance for rounding
                    increase = new_overflow - original
                    overflow_errors.append(
                        f'{slide_key}/{shape_key}: overflow worsened by {increase:.2f}" '
                        f'(was {original:.2f}", now {new_overflow:.2f}")'
                    )

        # Collect warnings the replacement introduced (warnings already in the input are
        # not counted: untouched text is no longer rewritten)
        warnings = []
        for slide_key, shapes_dict in updated_inventory.items():
            for shape_key, shape_data in shapes_dict.items():
                known = original_warnings.get((slide_key, shape_key), set())
                for warning in shape_data.warnings:
                    if warning not in known:
                        warnings.append(f"{slide_key}/{shape_key}: {warning}")

        # Fail if there are any issues
        if overflow_errors or warnings:
            print("\nERROR: Issues detected in replacement output:")
            if overflow_errors:
                print("\nText overflow worsened:")
                for error in overflow_errors:
                    print(f"  - {error}")
            if warnings:
                print("\nFormatting warnings:")
                for warning in warnings:
                    print(f"  - {warning}")
            print("\nPlease fix these issues before saving.")
            raise ValueError(
                f"Found {len(overflow_errors)} overflow error(s) and {len(warnings)} warning(s)"
            )

        # Save the presentation
        Path(output_file).write_bytes(tmp_path.read_bytes())
    finally:
        tmp_path.unlink()  # Clean up temp file

    # Report results
    print(f"Saved updated presentation to: {output_file}")
    print(f"Processed {len(prs.slides)} slides")
    print(f"  - Shapes processed: {shapes_processed}")
    print(f"  - Shapes cleared: {shapes_cleared}")
    print(f"  - Shapes replaced: {shapes_replaced}")
    print(f"  - Paragraphs unchanged: {stats['paragraphs_unchanged']}")
    print(f"  - Paragraphs edited in place: {stats['paragraphs_edited']}")
    print(f"  - Paragraphs rebuilt: {stats['paragraphs_rebuilt']}")
    print(f"  - Shapes rebuilt (paragraph count changed): {stats['shapes_rebuilt']}")
    print(f"  - Parts changed: {', '.join(sorted(changed)) or 'none'}")


def _parse_find_args(argv: List[str]) -> Optional[Dict[str, Any]]:
    """Parse the find/replace CLI form; None if argv is the 3-argument JSON form."""
    if "--find" not in argv:
        return None
    positional: List[str] = []
    pairs: List[Tuple[str, str]] = []
    pending: Optional[str] = None
    include_notes, allow_missing = True, False
    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg in ("--find", "--replace"):
            if i + 1 >= len(argv):
                raise ValueError(f"{arg} needs a value")
            value = argv[i + 1]
            if arg == "--find":
                if pending is not None:
                    raise ValueError(f"--find {pending!r} has no --replace")
                pending = value
            else:
                if pending is None:
                    raise ValueError("--replace must follow a --find")
                pairs.append((pending, value))
                pending = None
            i += 2
            continue
        if arg == "--no-notes":
            include_notes = False
        elif arg == "--allow-missing":
            allow_missing = True
        elif arg.startswith("--"):
            raise ValueError(f"Unknown option {arg}")
        else:
            positional.append(arg)
        i += 1
    if pending is not None:
        raise ValueError(f"--find {pending!r} has no --replace")
    if len(positional) != 2 or not pairs:
        raise ValueError("Expected: <input.pptx> <output.pptx> --find TEXT --replace TEXT")
    return {
        "input": positional[0],
        "output": positional[1],
        "pairs": pairs,
        "include_notes": include_notes,
        "allow_missing": allow_missing,
    }


def main():
    """Main entry point for command-line usage."""
    try:
        find_args = _parse_find_args(sys.argv[1:])
    except ValueError as e:
        print(f"Error: {e}")
        print(__doc__)
        sys.exit(1)

    if find_args is not None:
        if not Path(find_args["input"]).exists():
            print(f"Error: Input file '{find_args['input']}' not found")
            sys.exit(1)
        try:
            apply_find_replace(
                find_args["input"],
                find_args["pairs"],
                find_args["output"],
                include_notes=find_args["include_notes"],
                allow_missing=find_args["allow_missing"],
            )
        except Exception as e:
            print(f"Error applying replacements: {e}")
            sys.exit(1)
        return

    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(1)

    input_pptx = Path(sys.argv[1])
    replacements_json = Path(sys.argv[2])
    output_pptx = Path(sys.argv[3])

    if not input_pptx.exists():
        print(f"Error: Input file '{input_pptx}' not found")
        sys.exit(1)

    if not replacements_json.exists():
        print(f"Error: Replacements JSON file '{replacements_json}' not found")
        sys.exit(1)

    try:
        apply_replacements(str(input_pptx), str(replacements_json), str(output_pptx))
    except Exception as e:
        print(f"Error applying replacements: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
