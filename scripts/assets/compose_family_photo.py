"""EXPERIMENTAL / DEVELOPMENT ONLY -- NOT USED FOR STOREFRONT PHOTOGRAPHY.

Rejected by the owner (2026-08-17, third correction round) as the approach
for storefront family photography: flat 2D text composited onto a static
photo cannot reproduce cylindrical label wrap, perspective, or the
reflections a real (or well-generated) printed label has, no matter how
precisely the text is measured and centered. Real storefront family images
now come from an external image-generation workflow -- see
docs/assets/family-photo-brief.md and public/images/products/families/README.md.

Kept in the repo for the measurement/calibration reference in the docstring
below (safe-zone coordinates, LAB/RUO clearances, no-strength-on-front
rule) and for any future experimentation, NOT as a production pipeline. Do
not wire its output into ProductCard/ProductDetail for a real page.

---

Composite a product-family name onto the blank Pepscore master vial photo.

Not AI image generation -- deterministic text compositing onto the
owner-approved master photograph (public/images/products/masters/master-vial-blank.png).
The vial, cap, lab background, and blank label are never touched; only the
family-name text layer is drawn into the label's measured product-name field.

===========================================================================
CALIBRATION SOURCE OF TRUTH (2026-08-17, second correction round): the
OWNER-APPROVED Semaglutide reference photo
(public/images/products/masters/pepscore-vial-sample-approved.png), NOT a
mathematical center of the hard safe zone. The hard safe zone answers
"where is text allowed to exist"; it does not answer "where should the
text actually sit." That second question is answered by measuring the
approved photo directly (pixel-scanned, not guessed) and reproducing its
proportions on the blank master's own, differently-proportioned label.
===========================================================================

MEASURED ON THE APPROVED REFERENCE (pepscore-vial-sample-approved.png,
1727x910, label width 378px, x 678-1056):
  - LAB text bottom edge:        y = 593
  - Semaglutide text bbox:       y 636-689 (height 54px), x 725-1003 (width 279px)
  - RESEARCH USE ONLY top edge:  y = 744
  - gap LAB-bottom -> text-top:      43px  (0.1138 x label width)
  - gap text-bottom -> RUO-top:      55px  (0.1455 x label width)
  - text height:                     54px  (0.1429 x label width)
  - text vertical center sits at 46.0% of the LAB-bottom..RUO-top field,
    i.e. ABOVE the field's pure geometric center (50%), not on it.

MEASURED ON THE BLANK MASTER (master-vial-blank.png, 1620x971):
  - label usable width (family-name band, y 600-750): ~365-372px, x approx
    639-1011, center x = 825
  - LAB text bottom edge:        y = 595
  - decorative gold rule:        y = 691-697 (NOT a safe-zone boundary --
    confirmed by the approved reference, which has no such rule at all)
  - RESEARCH USE ONLY top edge:  y = 754
  - family-name field: y in [595, 754], 159px tall

CALIBRATED PLACEMENT (scaling the approved reference's proportions onto the
blank master's own 159px field, label-width ratio 365/378 = 0.966):
  - Base calibration: 595 + 0.46 * 159 = 668 matches the approved
    reference's 46%-of-field position (confirmed independently by scaling
    its 43px top gap: 43 * 0.966 = 41.5px below LAB, landing at the same
    ~668 center for a single-line block). That is 6-7px ABOVE the field's
    pure geometric center (674.5) -- intentional, not a rounding artifact.
  - TARGET_CENTER_Y = 663, a further 5px nudge up from the 668 base
    calibration: at 668 the single-line block's bottom edge (692.5) landed
    1.5px inside the blank master's decorative gold rule (y 691-697),
    which is not a safe-zone boundary but IS a visible line the approved
    reference doesn't have -- text touching it read as sloppy. Shifting to
    663 clears the rule by ~3.5px and, as a side effect, lands the
    single-line gap-above-LAB at 43.5px -- an almost exact match to the
    approved reference's measured 43px, closer than the 668 base value.
  - Centering purely on the hard safe zone's own geometric middle (825,
    670) was the prior round's mistake, but not because the center point
    was wrong (670 vs. 663-668 is a small difference) -- the actual
    defect was an OVERSIZED font (see below). A taller glyph drawn around
    a correct center still LOOKS too high, because its top edge reaches
    further up toward LAB.

CALIBRATED FONT SIZE: the prior round used a 64pt starting tier for short
names. Measured against the approved reference's own scale (text
height / label width = 0.1429), the correct size on the blank master's
~365-368px label is ~52px tall -- not 64px. 64pt was ~23% oversized,
which is what made even a correctly-centered name look pasted too close
to LAB (a taller glyph's top edge sits higher for the same center point).
Width is the binding constraint in practice: Montserrat Bold at 52pt
renders "Semaglutide" at 349px, which leaves under 10px of margin on a
~368px label -- not the "meaningful breathing room" the owner requires.
BASE_FONT_PT = 49 is the largest size that keeps "Semaglutide" (the
longest single-word stress name) inside MAX_TEXT_WIDTH with a real
(~20px+) margin on each side, while staying within ~6% of the
height-calibrated 52pt target (close enough to read as the same visual
scale). Per the owner's explicit priority order (approved size > safe
margins > modest reduction > wrapping > further reduction), margins won
this specific tradeoff over an exact height match.

SHORT NAMES ARE NEVER ENLARGED. Every single-line family name (NAD+,
MOTS-c, PT-141, Retatrutide, Glutathione, Semaglutide, ...) renders at the
SAME BASE_FONT_PT unless it doesn't fit -- there is no more "short names
get a bigger tier" logic. Only names that don't fit at BASE_FONT_PT ever
change size, and only downward.

Font: Montserrat (Bold), SIL Open Font License, bundled at
scripts/assets/fonts/ -- see fonts/README.md.

Usage:
  python compose_family_photo.py "Semaglutide" output.png
  python compose_family_photo.py "Semaglutide" output.png --lines "CJC-1295" "Ipamorelin"
"""
import sys
import os
import argparse
from PIL import Image, ImageDraw, ImageFont

MASTER_PATH = "public/images/products/masters/master-vial-blank.png"
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FONT_BOLD = os.path.join(_SCRIPT_DIR, "fonts", "Montserrat-Bold.ttf")
GOLD = (212, 175, 55)  # matches the site's #D4AF37 brand gold

# ---- Hard safe zone (measured on master-vial-blank.png; text may never
# leave this box, but it does NOT determine WHERE inside the box text
# sits -- see module docstring). ----
LABEL_CX = 825
LAB_BOTTOM_Y = 595
RUO_TOP_Y = 754
SAFE_ZONE_W = 365  # measured usable label width across the family-name band

# ---- Calibrated optical placement (measured off the approved Semaglutide
# reference, see module docstring). ----
TARGET_CENTER_Y = 663
MIN_GAP_ABOVE_LAB = 20   # hard-fail floor; single-line names land near ~48px
MIN_GAP_BELOW_RUO = 20   # hard-fail floor; single-line names land near ~61px

# ---- Calibrated typography (see module docstring for how these numbers
# were derived, not guessed). ----
BASE_FONT_PT = 49
MAX_TEXT_WIDTH = 330    # inset from the ~365-368px label -- real margins,
                         # not edge-to-edge
MIN_FONT_PT = 30
LINE_GAP_RATIO = 0.10    # tight, "one typography block" spacing for 2-line names

# ---- Decorative gold rule baked into the blank master (y 691-697) that
# the owner-approved reference photo does NOT have (confirmed by direct
# measurement -- see module docstring). A 2-line family name's block
# height (~90-103px) makes it geometrically impossible to sit inside the
# 159px field, clear both LAB and RUO by the minimum breathing room, AND
# dodge a rule sitting near the field's middle -- so the rule is erased
# (cloned from a clean row immediately above it, not flat-filled, so the
# label's own subtle lighting falloff is preserved) before text is drawn.
# This runs for every family, not just 2-line ones, so a single-line name
# never has to gamble on clearing the rule either -- output always
# matches the approved reference's actual (rule-free) design.
RULE_Y_TOP = 690
RULE_Y_BOTTOM = 699
RULE_CLONE_SOURCE_Y = 686


def _measure(draw, text, font):
    b = draw.textbbox((0, 0), text, font=font)
    return b[2] - b[0], b[3] - b[1], b


def _fits(draw, text, font, max_w):
    w, _h, _b = _measure(draw, text, font)
    return w <= max_w


def fit_family_name(draw, name, explicit_lines=None):
    """Returns a list of (line_text, font) tuples.

    If explicit_lines is given (owner-approved multi-line family display
    name, e.g. ["CJC-1295", "Ipamorelin"]), each line is fit independently
    then both share the SMALLER resulting size so the block reads as one
    consistent typography unit -- never an automatic wrap of a longer
    string, and never containing strength/mg text.

    Otherwise: try BASE_FONT_PT on one line; if it doesn't fit within
    MAX_TEXT_WIDTH, shrink in 1pt steps (modest reduction, priority 3);
    if it still doesn't fit at MIN_FONT_PT, wrap once at the space nearest
    the string's center (priority 4) and shrink further only if that
    2-line block still doesn't fit (priority 5)."""

    def sized(text, size):
        return ImageFont.truetype(FONT_BOLD, size)

    if explicit_lines:
        sizes = []
        for line in explicit_lines:
            size = BASE_FONT_PT
            while size > MIN_FONT_PT and not _fits(draw, line, sized(line, size), MAX_TEXT_WIDTH):
                size -= 1
            sizes.append(size)
        final_size = min(sizes)
        return [(line, sized(line, final_size)) for line in explicit_lines]

    size = BASE_FONT_PT
    f = sized(name, size)
    if _fits(draw, name, f, MAX_TEXT_WIDTH):
        return [(name, f)]

    while size > MIN_FONT_PT:
        size -= 1
        f = sized(name, size)
        if _fits(draw, name, f, MAX_TEXT_WIDTH):
            return [(name, f)]

    if " " not in name:
        return [(name, sized(name, MIN_FONT_PT))]

    spaces = [i for i, ch in enumerate(name) if ch == " "]
    best = min(spaces, key=lambda i: abs(i - len(name) / 2))
    line1, line2 = name[:best], name[best + 1:]
    return fit_family_name(draw, name, explicit_lines=[line1, line2])


def _erase_decorative_rule(im):
    """Clone a clean row over the blank master's decorative gold rule so
    generated output matches the approved reference, which has no such
    rule. Column-wise clone (not a flat fill) preserves the label's own
    faint lighting falloff instead of leaving a visibly flat patch."""
    source_row = im.crop((0, RULE_CLONE_SOURCE_Y, im.width, RULE_CLONE_SOURCE_Y + 1))
    for y in range(RULE_Y_TOP, RULE_Y_BOTTOM):
        im.paste(source_row, (0, y))


def compose(family_name: str, output_path: str, explicit_lines=None) -> dict:
    im = Image.open(MASTER_PATH).convert("RGB")
    _erase_decorative_rule(im)
    draw = ImageDraw.Draw(im)
    lines = fit_family_name(draw, family_name, explicit_lines=explicit_lines)

    def line_h(text, font):
        return _measure(draw, text, font)[1]

    line_gap = lines[0][1].size * LINE_GAP_RATIO
    heights = [line_h(t, f) for t, f in lines]
    total_h = sum(heights) + line_gap * max(0, len(lines) - 1)

    # Clamped placement: start from the calibrated optical center, then
    # enforce the hard minimum breathing room against LAB/RUO. If a block
    # is tall enough that both minimums can't hold at once, shrink instead
    # of letting it collide (owner: "breathing room is required, not
    # merely fitting inside the hard boundary").
    font_size = lines[0][1].size
    while True:
        top = TARGET_CENTER_Y - total_h / 2
        bottom = TARGET_CENTER_Y + total_h / 2
        if top < LAB_BOTTOM_Y + MIN_GAP_ABOVE_LAB:
            shift = (LAB_BOTTOM_Y + MIN_GAP_ABOVE_LAB) - top
            top += shift
            bottom += shift
        if bottom > RUO_TOP_Y - MIN_GAP_BELOW_RUO:
            shift = bottom - (RUO_TOP_Y - MIN_GAP_BELOW_RUO)
            top -= shift
            bottom -= shift
        if top >= LAB_BOTTOM_Y + MIN_GAP_ABOVE_LAB and font_size > MIN_FONT_PT:
            break
        if font_size <= MIN_FONT_PT:
            break
        # Both minimums can't be satisfied simultaneously at this size --
        # shrink every line by 1pt (keeping them uniform) and retry.
        font_size -= 1
        new_lines = []
        for text, _f in lines:
            new_lines.append((text, ImageFont.truetype(FONT_BOLD, font_size)))
        lines = new_lines
        line_gap = font_size * LINE_GAP_RATIO
        heights = [line_h(t, f) for t, f in lines]
        total_h = sum(heights) + line_gap * max(0, len(lines) - 1)

    cursor_y = top
    for text, font in lines:
        w, h, bbox = _measure(draw, text, font)
        x = LABEL_CX - w / 2 - bbox[0]
        y = cursor_y - bbox[1]
        draw.text((x, y), text, font=font, fill=GOLD)
        cursor_y += h + line_gap

    im.save(output_path)
    gap_above = round(top - LAB_BOTTOM_Y, 1)
    gap_below = round(RUO_TOP_Y - bottom, 1)
    return {
        "lines": [t for t, _ in lines],
        "font_size_pt": lines[0][1].size,
        "line_count": len(lines),
        "block_top": round(top, 1),
        "block_bottom": round(bottom, 1),
        "block_center_y": round((top + bottom) / 2, 1),
        "block_height_px": round(total_h, 1),
        "text_width_px": round(max(_measure(draw, t, f)[0] for t, f in lines), 1),
        "max_text_width": MAX_TEXT_WIDTH,
        "gap_above_lab_px": gap_above,
        "gap_below_ruo_px": gap_below,
        "fits_without_clipping": top >= LAB_BOTTOM_Y and bottom <= RUO_TOP_Y,
        "meets_min_breathing_room": gap_above >= MIN_GAP_ABOVE_LAB and gap_below >= MIN_GAP_BELOW_RUO,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("family_name")
    parser.add_argument("output_path")
    parser.add_argument("--lines", nargs="+", default=None, help="Explicit multi-line family display (e.g. CJC blends)")
    args = parser.parse_args()
    report = compose(args.family_name, args.output_path, explicit_lines=args.lines)
    print(f"Wrote {args.output_path}: {report}")
