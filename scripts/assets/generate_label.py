"""Generate a print-ready wraparound vial label (2026-08-17 asset
architecture sprint). Produces:
  - a vector PDF master (reportlab -- true vector, not rasterized text)
  - a 600 DPI PNG raster preview (Pillow)
  - a clock-guide PNG (raster preview only, guides never appear in the
    PDF/print master)

Clock geometry (owner spec): flat label width represents the vial
circumference. 0%/100% = 6 o'clock (back seam, where the two ends meet
physically). 50% = 12 o'clock (front, PEPSCORE/LAB/family panel). 75% = 3
o'clock (strength/concentration panel). Front and strength panels are given
explicit, non-overlapping horizontal bands (not just a center point) so
long family names and the strength stack never collide.

Font path note: FONT_BOLD/FONT_REGULAR point at Windows system fonts.
This script is a local offline generation tool run manually -- it never
executes as part of the Next.js build or Vercel deployment, only its
static PNG/PDF *output* is committed -- so this is a dev-machine
portability note, not a production risk. Flagged in the Stage A report.

Usage:
  python generate_label.py "Semaglutide" "30mg" 3 out_basename
  python generate_label.py "NAD+" "500mg" 10 out_basename
"""
import sys
import os
import re
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.pdfbase.pdfmetrics import stringWidth
from PIL import Image, ImageDraw, ImageFont

GOLD = (212, 175, 55)
GOLD_HEX = "#D4AF37"
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)

FONT_BOLD = "C:/Windows/Fonts/segoeuib.ttf"
FONT_REGULAR = "C:/Windows/Fonts/segoeui.ttf"

DPI = 600

SIZE_DIMENSIONS_IN = {
    3: (1.75, 0.75),
    10: (2.5, 1.25),
}


def concentration_text(strength: str, vial_ml: int):
    m = re.match(r"^([\d.]+)\s*mg$", strength.strip(), re.IGNORECASE)
    if not m:
        return None
    value = float(m.group(1))
    conc = value / vial_ml
    conc_str = f"{conc:.1f}".rstrip("0").rstrip(".") if conc != int(conc) else str(int(conc))
    return f"{strength} / {vial_ml}mL", f"({conc_str}mg/mL)"


def render_png(family_name: str, strength: str, vial_ml: int, out_path: str, guides: bool):
    w_in, h_in = SIZE_DIMENSIONS_IN[vial_ml]
    w_px, h_px = int(round(w_in * DPI)), int(round(h_in * DPI))
    im = Image.new("RGB", (w_px, h_px), BLACK)
    draw = ImageDraw.Draw(im)

    # Non-overlapping horizontal bands. Front panel (12 o'clock, ~50%)
    # occupies the left-center majority; strength panel (3 o'clock, ~75%)
    # is a narrower band to its right, with a clear gap between them.
    front_cx = w_px * 0.46
    front_max_w = w_px * 0.50
    strength_cx = w_px * 0.83
    strength_max_w = w_px * 0.28

    def fit(text, max_w, start_size, min_size, bold=True):
        path = FONT_BOLD if bold else FONT_REGULAR
        size = start_size
        while size >= min_size:
            f = ImageFont.truetype(path, size)
            bbox = draw.textbbox((0, 0), text, font=f)
            if bbox[2] - bbox[0] <= max_w:
                return f
            size -= 1
        return ImageFont.truetype(path, min_size)

    def fit_family(text, max_w, start_size, min_size, bold=True):
        """Single line if it fits at min_size; otherwise wraps to 2 lines
        at the nearest space to center and fits each line independently.
        Fixes real overflow/collision for long compound names (e.g. the
        CJC-1295 + Ipamorelin canonical blend) that a single shrinking
        line can't solve without going below min_size."""
        f = fit(text, max_w, start_size, min_size, bold)
        bbox = draw.textbbox((0, 0), text, font=f)
        if bbox[2] - bbox[0] <= max_w or " " not in text:
            return [(text, f)]
        spaces = [i for i, ch in enumerate(text) if ch == " "]
        best = min(spaces, key=lambda i: abs(i - len(text) / 2))
        line1, line2 = text[:best], text[best + 1 :]
        f1 = fit(line1, max_w, start_size, min_size, bold)
        f2 = fit(line2, max_w, start_size, min_size, bold)
        return [(line1, f1), (line2, f2)]

    def draw_centered(cx, top_y, text, font, fill):
        bbox = draw.textbbox((0, 0), text, font=font)
        w = bbox[2] - bbox[0]
        draw.text((cx - w / 2 - bbox[0], top_y - bbox[1]), text, font=font, fill=fill)
        return bbox[3] - bbox[1]  # glyph height, for cursor advance

    # ---- Front panel: two passes -- first choose fonts and measure glyph
    # heights (no drawing), then vertically center the whole 5-line block
    # within the label height before actually drawing. Uses the full
    # available height instead of leaving it mostly empty below a
    # top-anchored block, which is what was making the RUO line
    # needlessly tiny in the first layout pass. ----
    line_gap = h_px * 0.035

    f_pepscore = fit("PEPSCORE", front_max_w, max(int(h_px * 0.22), 10), max(int(h_px * 0.09), 8))
    f_lab = fit("LAB", front_max_w, max(int(h_px * 0.14), 8), max(int(h_px * 0.07), 7))
    family_lines = fit_family(family_name, front_max_w, max(int(h_px * 0.20), 10), max(int(h_px * 0.06), 8))
    f_ruo = fit("NOT FOR HUMAN CONSUMPTION", front_max_w, max(int(h_px * 0.075), 7), max(int(h_px * 0.045), 6))

    def gh_of(text, font):
        b = draw.textbbox((0, 0), text, font=font)
        return b[3] - b[1]

    h_pepscore = gh_of("PEPSCORE", f_pepscore)
    h_lab = gh_of("LAB", f_lab)
    family_heights = [gh_of(t, f) for t, f in family_lines]
    h_family_block = sum(family_heights) + line_gap * 0.5 * max(0, len(family_lines) - 1)
    h_ruo1 = gh_of("RESEARCH USE ONLY", f_ruo)
    h_ruo2 = gh_of("NOT FOR HUMAN CONSUMPTION", f_ruo)

    total_block_h = h_pepscore + line_gap + h_lab + line_gap + h_family_block + line_gap * 1.3 + h_ruo1 + line_gap * 0.6 + h_ruo2
    cursor_y = h_px / 2 - total_block_h / 2

    gh = draw_centered(front_cx, cursor_y, "PEPSCORE", f_pepscore, WHITE)
    cursor_y += gh + line_gap

    gh = draw_centered(front_cx, cursor_y, "LAB", f_lab, GOLD)
    cursor_y += gh + line_gap

    for i, (text, font) in enumerate(family_lines):
        gh = draw_centered(front_cx, cursor_y, text, font, GOLD)
        cursor_y += gh + (line_gap * 0.5 if i < len(family_lines) - 1 else line_gap * 1.3)

    gh = draw_centered(front_cx, cursor_y, "RESEARCH USE ONLY", f_ruo, WHITE)
    cursor_y += gh + line_gap * 0.6
    draw_centered(front_cx, cursor_y, "NOT FOR HUMAN CONSUMPTION", f_ruo, WHITE)

    # ---- Strength panel: vertically centered as a 2-line stack, entirely
    # within its own band, never touching the front panel's text. ----
    conc = concentration_text(strength, vial_ml)
    if conc:
        line1, line2 = conc
        f1 = fit(line1, strength_max_w, max(int(h_px * 0.16), 10), max(int(h_px * 0.05), 8))
        f2 = fit(line2, strength_max_w, max(int(h_px * 0.09), 8), max(int(h_px * 0.04), 7))
        b1 = draw.textbbox((0, 0), line1, font=f1)
        h1 = b1[3] - b1[1]
        b2 = draw.textbbox((0, 0), line2, font=f2)
        h2 = b2[3] - b2[1]
        total_h = h1 + line_gap * 0.6 + h2
        start_y = h_px / 2 - total_h / 2
        draw_centered(strength_cx, start_y, line1, f1, GOLD)
        draw_centered(strength_cx, start_y + h1 + line_gap * 0.6, line2, f2, WHITE)

    if guides:
        for frac in [0.0, 0.25, 0.50, 0.75, 1.0]:
            x = w_px * frac
            draw.line([(x, 0), (x, h_px)], fill=(255, 0, 0), width=2)

    im.save(out_path, dpi=(DPI, DPI))
    return w_px, h_px, {
        "pepscore_pt": round(f_pepscore.size * 72 / DPI, 2),
        "lab_pt": round(f_lab.size * 72 / DPI, 2),
        "family_pt": round(min(f.size for _, f in family_lines) * 72 / DPI, 2),
        "family_lines": len(family_lines),
        "ruo_pt": round(f_ruo.size * 72 / DPI, 2),
    }


def render_pdf(family_name: str, strength: str, vial_ml: int, out_path: str):
    w_in, h_in = SIZE_DIMENSIONS_IN[vial_ml]
    W, H = w_in * inch, h_in * inch
    c = canvas.Canvas(out_path, pagesize=(W, H))
    c.setFillColorRGB(0, 0, 0)
    c.rect(0, 0, W, H, fill=1, stroke=0)

    front_x = W * 0.46
    front_max_w = W * 0.50
    strength_x = W * 0.83
    strength_max_w = W * 0.28

    def fit_size(text, max_w_pt, start, min_size, bold):
        font = "Helvetica-Bold" if bold else "Helvetica"
        size = start
        while size >= min_size:
            if stringWidth(text, font, size) <= max_w_pt:
                return size, font
            size -= 0.5
        return min_size, font

    def fit_family_size(text, max_w_pt, start, min_size, bold):
        """Mirrors render_png's fit_family: wraps to 2 lines at the
        nearest-to-center space if it still overflows at min_size."""
        size, font = fit_size(text, max_w_pt, start, min_size, bold)
        if stringWidth(text, font, size) <= max_w_pt or " " not in text:
            return [(text, size, font)]
        spaces = [i for i, ch in enumerate(text) if ch == " "]
        best = min(spaces, key=lambda i: abs(i - len(text) / 2))
        line1, line2 = text[:best], text[best + 1 :]
        s1, f1 = fit_size(line1, max_w_pt, start, min_size, bold)
        s2, f2 = fit_size(line2, max_w_pt, start, min_size, bold)
        return [(line1, s1, f1), (line2, s2, f2)]

    line_gap = H * 0.035

    # Two passes, same reasoning as render_png: measure first, then
    # vertically center the whole block instead of top-anchoring it.
    pepscore_pt, pepscore_font = fit_size("PEPSCORE", front_max_w, H * 0.22, H * 0.09, True)
    lab_pt, lab_font = fit_size("LAB", front_max_w, H * 0.14, H * 0.07, True)
    family_lines = fit_family_size(family_name, front_max_w, H * 0.20, H * 0.06, True)
    ruo_pt, ruo_font = fit_size("NOT FOR HUMAN CONSUMPTION", front_max_w, H * 0.075, H * 0.045, False)

    gh_pepscore = pepscore_pt * 0.9
    gh_lab = lab_pt * 0.9
    family_ghs = [s * 0.9 for _, s, _ in family_lines]
    gh_family_block = sum(family_ghs) + line_gap * 0.5 * max(0, len(family_lines) - 1)
    gh_ruo = ruo_pt * 0.9

    total_block_h = gh_pepscore + line_gap + gh_lab + line_gap + gh_family_block + line_gap * 1.3 + gh_ruo + line_gap * 0.6 + gh_ruo
    cursor_y_from_top = H / 2 - total_block_h / 2

    c.setFont(pepscore_font, pepscore_pt)
    c.setFillColorRGB(1, 1, 1)
    y = H - cursor_y_from_top - pepscore_pt * 0.72
    c.drawCentredString(front_x, y, "PEPSCORE")
    cursor_y_from_top += gh_pepscore + line_gap

    c.setFont(lab_font, lab_pt)
    c.setFillColor(GOLD_HEX)
    y = H - cursor_y_from_top - lab_pt * 0.72
    c.drawCentredString(front_x, y, "LAB")
    cursor_y_from_top += gh_lab + line_gap

    c.setFillColor(GOLD_HEX)
    for i, (text, size, font) in enumerate(family_lines):
        c.setFont(font, size)
        y = H - cursor_y_from_top - size * 0.72
        c.drawCentredString(front_x, y, text)
        cursor_y_from_top += size * 0.9 + (line_gap * 0.5 if i < len(family_lines) - 1 else line_gap * 1.3)

    c.setFont(ruo_font, ruo_pt)
    c.setFillColorRGB(1, 1, 1)
    y = H - cursor_y_from_top - ruo_pt * 0.72
    c.drawCentredString(front_x, y, "RESEARCH USE ONLY")
    cursor_y_from_top += gh_ruo + line_gap * 0.6
    y = H - cursor_y_from_top - ruo_pt * 0.72
    c.drawCentredString(front_x, y, "NOT FOR HUMAN CONSUMPTION")

    conc = concentration_text(strength, vial_ml)
    if conc:
        line1, line2 = conc
        l1_pt, l1_font = fit_size(line1, strength_max_w, H * 0.16, H * 0.05, True)
        l2_pt, l2_font = fit_size(line2, strength_max_w, H * 0.09, H * 0.04, False)
        total_h = l1_pt * 0.9 + line_gap * 0.6 + l2_pt * 0.9
        start_from_top = H / 2 - total_h / 2
        c.setFont(l1_font, l1_pt)
        c.setFillColor(GOLD_HEX)
        y = H - start_from_top - l1_pt * 0.72
        c.drawCentredString(strength_x, y, line1)
        c.setFont(l2_font, l2_pt)
        c.setFillColorRGB(1, 1, 1)
        y = H - (start_from_top + l1_pt * 0.9 + line_gap * 0.6) - l2_pt * 0.72
        c.drawCentredString(strength_x, y, line2)

    c.showPage()
    c.save()


if __name__ == "__main__":
    if len(sys.argv) != 5:
        print('Usage: python generate_label.py "Family Name" "30mg" 3 out_basename')
        sys.exit(1)
    family, strength, vial_ml, basename = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
    os.makedirs(os.path.dirname(basename) or ".", exist_ok=True)
    w, h, font_report = render_png(family, strength, vial_ml, basename + "_preview.png", guides=False)
    render_png(family, strength, vial_ml, basename + "_guides.png", guides=True)
    render_pdf(family, strength, vial_ml, basename + ".pdf")
    print(f"{basename}: {w}x{h}px @ {DPI}dpi, fonts(pt)={font_report}")
