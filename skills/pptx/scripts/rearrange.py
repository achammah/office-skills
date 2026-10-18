#!/usr/bin/env python3
"""
Rearrange PowerPoint slides based on a sequence of indices.

Usage:
    python rearrange.py template.pptx output.pptx 0,34,34,50,52

This will create output.pptx using slides from template.pptx in the specified order.
Slides can be repeated (e.g., 34 appears twice).
"""

import argparse
import random
import re
import shutil
import sys
import uuid
from copy import deepcopy
from pathlib import Path

from pptx import Presentation
from pptx.opc.constants import CONTENT_TYPE as CT
from pptx.opc.constants import RELATIONSHIP_TYPE as RT
from pptx.opc.package import XmlPart
from pptx.opc.packuri import PackURI
from pptx.parts.slide import SlidePart

# Chart-safe clone and delete: technique ported from paper-pptx (MIT),
# src/pptx/slideops.py and Slides.delete in src/pptx/slide.py.
_R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
_A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
_P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
_P14_NS = "http://schemas.microsoft.com/office/powerpoint/2010/main"
_A16_NS = "http://schemas.microsoft.com/office/drawing/2014/main"
_CHART_STYLE = "http://schemas.microsoft.com/office/2011/relationships/chartStyle"
_CHART_COLOR_STYLE = (
    "http://schemas.microsoft.com/office/2011/relationships/chartColorStyle"
)

# Media parts are immutable blobs: the copy shares them with the source.
_SHARED_MEDIA = frozenset([RT.IMAGE, RT.MEDIA, RT.VIDEO, RT.AUDIO])
# A chart is copied with these children (each must be a leaf part).
_CHART_CHILDREN = frozenset([RT.PACKAGE, _CHART_STYLE, _CHART_COLOR_STYLE])
# Elements whose only job is to point at another slide; a delete may remove them.
_SLIDE_LINK_TAGS = frozenset(
    ["{%s}hlinkClick" % _A_NS, "{%s}hlinkHover" % _A_NS, "{%s}sld" % _P_NS]
)


def main():
    parser = argparse.ArgumentParser(
        description="Rearrange PowerPoint slides based on a sequence of indices.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python rearrange.py template.pptx output.pptx 0,34,34,50,52
    Creates output.pptx using slides 0, 34 (twice), 50, and 52 from template.pptx

  python rearrange.py template.pptx output.pptx 5,3,1,2,4
    Creates output.pptx with slides reordered as specified

Note: Slide indices are 0-based (first slide is 0, second is 1, etc.)
        """,
    )

    parser.add_argument("template", help="Path to template PPTX file")
    parser.add_argument("output", help="Path for output PPTX file")
    parser.add_argument(
        "sequence", help="Comma-separated sequence of slide indices (0-based)"
    )

    args = parser.parse_args()

    # Parse the slide sequence
    try:
        slide_sequence = [int(x.strip()) for x in args.sequence.split(",")]
    except ValueError:
        print(
            "Error: Invalid sequence format. Use comma-separated integers (e.g., 0,34,34,50,52)"
        )
        sys.exit(1)

    # Check template exists
    template_path = Path(args.template)
    if not template_path.exists():
        print(f"Error: Template file not found: {args.template}")
        sys.exit(1)

    # Create output directory if needed
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        rearrange_presentation(template_path, output_path, slide_sequence)
    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Error processing presentation: {e}")
        sys.exit(1)


def duplicate_slide(pres, index):
    """Duplicate a slide in the presentation and append the copy at the end.

    The copy owns new chart parts (with their embedded workbooks and chart
    style parts) and a new notes slide; layout and media parts are shared.
    Raises ValueError, before anything changes, when the slide holds a
    relationship type that cannot be copied safely (OLE objects, SmartArt,
    comments, ActiveX controls, tags, ...).
    """
    source = pres.slides[index]
    source_part = source.part
    package = source_part.package
    plan = _clone_plan(source_part)

    # New parts stay unreachable until the new slide is related, so the
    # package cannot see them: `taken` reserves every partname we assign.
    taken = {str(part.partname) for part in package.iter_parts()}
    new_part = SlidePart(
        _allocate_partname("/ppt/slides/slide%d.xml", taken),
        CT.PML_SLIDE,
        package,
        deepcopy(source_part._element),
    )
    _refresh_identities(new_part._element)

    rId_map = {}
    for old_rId, action, rel in plan:
        if action == "external":
            rId_map[old_rId] = new_part.rels.get_or_add_ext_rel(
                rel.reltype, rel.target_ref
            )
        elif action == "share":
            rId_map[old_rId] = new_part.relate_to(rel.target_part, rel.reltype)
        elif action == "chart":
            rId_map[old_rId] = new_part.relate_to(
                _copy_chart_part(rel.target_part, taken), rel.reltype
            )
        elif action == "notes":
            rId_map[old_rId] = new_part.relate_to(
                _copy_notes_part(rel.target_part, new_part, taken), rel.reltype
            )
    _rewrite_r_references(new_part._element, rId_map)

    rId = pres.part.relate_to(new_part, RT.SLIDE)
    sldId = pres.slides._sldIdLst.add_sldId(rId)
    _enroll_in_section(pres.part._element, source.slide_id, sldId.id)
    return new_part.slide


def delete_slide(pres, index):
    """Delete a slide from the presentation.

    Removes its p:sldId entry, its entries in p14 section lists and custom
    shows, and the presentation relationship. Parts no longer reachable (the
    slide, its notes slide, charts only it used) are not written on save.
    Links from other slides to the deleted slide are removed (the linked
    text or shape stays). Raises ValueError, before anything changes, when
    another part still needs the slide in a way that cannot be removed.
    """
    sldIdLst = pres.slides._sldIdLst
    sldId = sldIdLst[index]
    slide_id, rId = sldId.id, sldId.rId
    target = pres.part.related_part(rId)
    package = pres.part.package

    notes_parts = {
        rel.target_part
        for rel in target.rels.values()
        if not rel.is_external and rel.reltype == RT.NOTES_SLIDE
    }
    for notes_part in notes_parts:
        if any(
            owner is not target for owner, _ in _inbound(package, notes_part)
        ):
            raise ValueError(
                "cannot delete slide %d: its notes slide is shared with another part"
                % index
            )

    # Every other relationship to the slide (e.g. a hyperlink from another
    # slide) must be removable, or the deleted slide would still be saved.
    aliases = [
        (owner, alias_rId)
        for owner, alias_rId in _inbound(package, target)
        if not (owner is pres.part and alias_rId == rId) and owner not in notes_parts
    ]
    for owner, alias_rId in aliases:
        refs = _r_reference_elements(owner._element, alias_rId)
        if not isinstance(owner, XmlPart) or any(
            el.tag not in _SLIDE_LINK_TAGS for el in refs
        ):
            raise ValueError(
                "cannot delete slide %d: part %s refers to it in a way that cannot be"
                " removed safely" % (index, owner.partname)
            )

    # presentation.xml may name the slide only in p:sldIdLst and custom shows
    show_sld = "{%s}sld" % _P_NS
    for el in _r_reference_elements(pres.part._element, rId):
        if el is not sldId and el.tag != show_sld:
            raise ValueError(
                "cannot delete slide %d: presentation.xml refers to %s in <%s>"
                % (index, rId, el.tag)
            )

    for owner, alias_rId in aliases:
        for el in _r_reference_elements(owner._element, alias_rId):
            el.getparent().remove(el)
        owner.drop_rel(alias_rId)

    sldIdLst.remove(sldId)
    _remove_from_id_lists(pres.part._element, slide_id, rId)
    pres.part.drop_rel(rId)


def _clone_plan(source_part):
    """Return [(rId, action, rel)] for every slide relationship, or raise.

    Validates the whole graph to be copied (charts and notes included)
    before any part is created, so a refusal leaves the deck untouched.
    """
    plan, unsupported = [], []
    for rId in sorted(source_part.rels, key=_rId_sort_key):
        rel = source_part.rels[rId]
        if rel.is_external:
            plan.append((rId, "external", rel))
        elif rel.reltype in _SHARED_MEDIA or rel.reltype in (RT.SLIDE_LAYOUT, RT.SLIDE):
            plan.append((rId, "share", rel))  # RT.SLIDE: a link to another slide
        elif rel.reltype == RT.CHART:
            _check_chart(rel.target_part)
            plan.append((rId, "chart", rel))
        elif rel.reltype == RT.NOTES_SLIDE:
            _check_notes(rel.target_part)
            plan.append((rId, "notes", rel))
        else:
            unsupported.append(rel.reltype.rsplit("/", 1)[-1])
    if unsupported:
        raise ValueError(
            "cannot duplicate slide %s: it holds relationship types this script"
            " does not copy safely: %s"
            % (source_part.partname, ", ".join(sorted(set(unsupported))))
        )
    return plan


def _check_chart(chart_part):
    for rel in chart_part.rels.values():
        if rel.is_external:
            continue
        if rel.reltype not in _CHART_CHILDREN:
            raise ValueError(
                "cannot duplicate chart %s: unsupported child relationship %s"
                % (chart_part.partname, rel.reltype.rsplit("/", 1)[-1])
            )
        if any(not r.is_external for r in rel.target_part.rels.values()):
            raise ValueError(
                "cannot duplicate chart %s: child part %s has relationships of its own"
                % (chart_part.partname, rel.target_part.partname)
            )


def _check_notes(notes_part):
    allowed = _SHARED_MEDIA | {RT.NOTES_MASTER, RT.SLIDE}
    for rel in notes_part.rels.values():
        if not rel.is_external and rel.reltype not in allowed:
            raise ValueError(
                "cannot duplicate notes slide %s: unsupported relationship %s"
                % (notes_part.partname, rel.reltype.rsplit("/", 1)[-1])
            )


def _copy_chart_part(chart_part, taken):
    """Deep-copy a chart part with its embedded workbook and style parts."""
    new_chart = _copy_leaf_part(chart_part, taken)
    rId_map = {}
    for rId in sorted(chart_part.rels, key=_rId_sort_key):
        rel = chart_part.rels[rId]
        if rel.is_external:
            rId_map[rId] = new_chart.rels.get_or_add_ext_rel(rel.reltype, rel.target_ref)
        else:
            rId_map[rId] = new_chart.relate_to(
                _copy_leaf_part(rel.target_part, taken), rel.reltype
            )
    _rewrite_r_references(new_chart._element, rId_map)
    return new_chart


def _copy_notes_part(notes_part, new_slide_part, taken):
    """Deep-copy a notes slide, related to the notes master and the new slide."""
    new_notes = _copy_leaf_part(notes_part, taken)
    rId_map = {}
    for rId in sorted(notes_part.rels, key=_rId_sort_key):
        rel = notes_part.rels[rId]
        if rel.is_external:
            rId_map[rId] = new_notes.rels.get_or_add_ext_rel(rel.reltype, rel.target_ref)
        elif rel.reltype == RT.SLIDE:
            rId_map[rId] = new_notes.relate_to(new_slide_part, RT.SLIDE)
        else:  # notes master and media are shared
            rId_map[rId] = new_notes.relate_to(rel.target_part, rel.reltype)
    _rewrite_r_references(new_notes._element, rId_map)
    _refresh_identities(new_notes._element)
    return new_notes


def _copy_leaf_part(part, taken):
    """Return a new part of the same class, same content, fresh partname."""
    partname = _allocate_partname(_partname_template(str(part.partname)), taken)
    if isinstance(part, XmlPart):
        return type(part)(
            partname, part.content_type, part.package, deepcopy(part._element)
        )
    return type(part)(partname, part.content_type, part.package, part.blob)


def _partname_template(partname):
    """Turn /ppt/charts/chart3.xml into /ppt/charts/chart%d.xml."""
    template, n = re.subn(r"[0-9]+(?=\.[^.]+$)", "%d", partname, count=1)
    if n == 0:
        stem, dot, ext = partname.rpartition(".")
        template = "%s%%d%s%s" % (stem, dot, ext)
    return template


def _allocate_partname(template, taken):
    index = 1
    while template % index in taken:
        index += 1
    taken.add(template % index)
    return PackURI(template % index)


def _rewrite_r_references(root, rId_map):
    """Rewrite every r-namespace attribute in `root` per `rId_map`."""
    prefix = "{%s}" % _R_NS
    for el in root.iter():
        for name, value in el.attrib.items():
            if name.startswith(prefix) and value in rId_map:
                el.set(name, rId_map[value])


def _r_reference_elements(root, rId):
    prefix = "{%s}" % _R_NS
    return [
        el
        for el in root.iter()
        if any(n.startswith(prefix) and v == rId for n, v in el.attrib.items())
    ]


def _refresh_identities(root):
    """Give the copy fresh a16 creation ids, field ids and p14 creation id."""
    guid_map = {}

    def fresh(old):
        key = old.lower()
        if key not in guid_map:
            guid_map[key] = "{%s}" % str(uuid.uuid4()).upper()
        return guid_map[key]

    for el in root.iter():
        if el.tag == "{%s}creationId" % _A16_NS and el.get("id"):
            el.set("id", fresh(el.get("id")))
        elif el.tag == "{%s}fld" % _A_NS and el.get("id"):
            el.set("id", "{%s}" % str(uuid.uuid4()).upper())
        elif el.tag == "{%s}creationId" % _P14_NS and el.get("val"):
            el.set("val", str(random.randint(1, 2**32 - 1)))
    # connector and predecessor refs follow the remapped creation ids
    for el in root.iter("{%s}cxnDERefs" % _A16_NS, "{%s}predDERef" % _A16_NS):
        for attr in ("st", "end", "pred"):
            value = el.get(attr)
            if value and value.lower() in guid_map:
                el.set(attr, guid_map[value.lower()])


def _inbound(package, target_part):
    """Every reachable internal relationship [(owner_part, rId)] to `target_part`."""
    found = []
    for owner in package.iter_parts():
        for rId, rel in owner.rels.items():
            if not rel.is_external and rel.target_part is target_part:
                found.append((owner, rId))
    return found


def _enroll_in_section(presentation_elm, source_slide_id, new_slide_id):
    """Put the copy in the source slide's p14 section, right after it."""
    for entry in presentation_elm.iter("{%s}sldId" % _P14_NS):
        if entry.get("id") == str(source_slide_id):
            entry.addnext(
                entry.makeelement("{%s}sldId" % _P14_NS, {"id": str(new_slide_id)})
            )
            return


def _remove_from_id_lists(presentation_elm, slide_id, rId):
    """Drop a deleted slide from p14 section lists and custom shows."""
    for entry in list(presentation_elm.iter("{%s}sldId" % _P14_NS)):
        if entry.get("id") == str(slide_id):
            entry.getparent().remove(entry)
    for show_sld in list(
        presentation_elm.iterfind(".//{%s}custShowLst//{%s}sld" % (_P_NS, _P_NS))
    ):
        if show_sld.get("{%s}id" % _R_NS) == rId:
            show_sld.getparent().remove(show_sld)


def _rId_sort_key(rId):
    match = re.fullmatch(r"rId([0-9]+)", rId)
    return (0, int(match.group(1))) if match else (1, rId)


def reorder_slides(pres, slide_index, target_index):
    """Move a slide from one position to another."""
    slides = pres.slides._sldIdLst

    # Remove slide element from current position
    slide_element = slides[slide_index]
    slides.remove(slide_element)

    # Insert at target position
    slides.insert(target_index, slide_element)


def rearrange_presentation(template_path, output_path, slide_sequence):
    """
    Create a new presentation with slides from template in specified order.

    Args:
        template_path: Path to template PPTX file
        output_path: Path for output PPTX file
        slide_sequence: List of slide indices (0-based) to include
    """
    # Copy template to preserve dimensions and theme
    if template_path != output_path:
        shutil.copy2(template_path, output_path)
        prs = Presentation(output_path)
    else:
        prs = Presentation(template_path)

    total_slides = len(prs.slides)

    # Validate indices
    for idx in slide_sequence:
        if idx < 0 or idx >= total_slides:
            raise ValueError(f"Slide index {idx} out of range (0-{total_slides - 1})")

    # Track original slides and their duplicates
    slide_map = []  # List of actual slide indices for final presentation
    duplicated = {}  # Track duplicates: original_idx -> [duplicate_indices]

    # Step 1: DUPLICATE repeated slides
    print(f"Processing {len(slide_sequence)} slides from template...")
    for i, template_idx in enumerate(slide_sequence):
        if template_idx in duplicated and duplicated[template_idx]:
            # Already duplicated this slide, use the duplicate
            slide_map.append(duplicated[template_idx].pop(0))
            print(f"  [{i}] Using duplicate of slide {template_idx}")
        elif slide_sequence.count(template_idx) > 1 and template_idx not in duplicated:
            # First occurrence of a repeated slide - create duplicates
            slide_map.append(template_idx)
            duplicates = []
            count = slide_sequence.count(template_idx) - 1
            print(
                f"  [{i}] Using original slide {template_idx}, creating {count} duplicate(s)"
            )
            for _ in range(count):
                duplicate_slide(prs, template_idx)
                duplicates.append(len(prs.slides) - 1)
            duplicated[template_idx] = duplicates
        else:
            # Unique slide or first occurrence already handled, use original
            slide_map.append(template_idx)
            print(f"  [{i}] Using original slide {template_idx}")

    # Step 2: DELETE unwanted slides (work backwards)
    slides_to_keep = set(slide_map)
    print(f"\nDeleting {len(prs.slides) - len(slides_to_keep)} unused slides...")
    for i in range(len(prs.slides) - 1, -1, -1):
        if i not in slides_to_keep:
            delete_slide(prs, i)
            # Update slide_map indices after deletion
            slide_map = [idx - 1 if idx > i else idx for idx in slide_map]

    # Step 3: REORDER to final sequence
    print(f"Reordering {len(slide_map)} slides to final sequence...")
    for target_pos in range(len(slide_map)):
        # Find which slide should be at target_pos
        current_pos = slide_map[target_pos]
        if current_pos != target_pos:
            reorder_slides(prs, current_pos, target_pos)
            # Update slide_map: the move shifts other slides
            for i in range(len(slide_map)):
                if slide_map[i] > current_pos and slide_map[i] <= target_pos:
                    slide_map[i] -= 1
                elif slide_map[i] < current_pos and slide_map[i] >= target_pos:
                    slide_map[i] += 1
            slide_map[target_pos] = target_pos

    # Save the presentation
    prs.save(output_path)
    print(f"\nSaved rearranged presentation to: {output_path}")
    print(f"Final presentation has {len(prs.slides)} slides")


if __name__ == "__main__":
    main()
