#!/usr/bin/env python3
"""Regenerate the non-art concept artifacts for concept-fable-20260916.

Produces palette exports, lattice/grid templates, safe-zone diagrams, a
proportion diagram, and banner-stamped copies of the AI concept references.

Nothing this script writes is sprite art. Every output is a palette file,
a guide grid, a labelled box diagram, or a stamped copy of a reference image.
The live game does not load anything under arcade/art-direction/.

Usage:
    python3 make_concept_artifacts.py [--ai-src DIR]
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
PALETTE_JSON = ROOT / "palette" / "iron-amber-v2.json"

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf",
]

# Runtime geometry measured in the running app at 50b07c89 (see CONCEPT_REPORT.md).
LATTICE = 160          # authoring lattice (1 art px = 2 master px)
MASTER = 320           # exported master canvas
GROUND_Y = 152         # lattice row: bottom of the shoes
SHADOW_ROWS = (150, 158)
DESKTOP_CLIP_ROWS = 26  # lattice rows hidden on the 1280x800 attempts screen (52 master px)
STANDING_HEAD_TOP = 26
BAR_ON_BACK_Y = 50
CARD_LATTICE = 52
CARD_EXPORT = 104


def font(size: int) -> ImageFont.ImageFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def hex_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def load_palette() -> tuple[dict, list[tuple[str, str, str]]]:
    data = json.loads(PALETTE_JSON.read_text())
    entries: list[tuple[str, str, str]] = []
    for ramp, colors in data["ramps"].items():
        for name, value in colors.items():
            entries.append((ramp, name, value))
    return data, entries


def write_gpl(entries: list[tuple[str, str, str]]) -> Path:
    out = ROOT / "palette" / "iron-amber-v2.gpl"
    lines = [
        "GIMP Palette",
        "Name: Iron & Amber v2 (concept, proposed)",
        "Columns: 8",
        "# CONCEPT ONLY. Loads in Aseprite / LibreSprite / Pixelorama / GIMP / Krita.",
    ]
    for ramp, name, value in entries:
        r, g, b = hex_rgb(value)
        lines.append(f"{r:3d} {g:3d} {b:3d}\t{name} ({ramp})")
    out.write_text("\n".join(lines) + "\n")
    return out


def write_swatches(data: dict, entries: list[tuple[str, str, str]]) -> Path:
    out = ROOT / "palette" / "iron-amber-v2-swatches.png"
    ramps = list(data["ramps"].items())
    cell, pad, label_w = 44, 6, 190
    max_len = max(len(c) for _, c in ramps)
    width = label_w + max_len * (cell + pad) + pad
    height = 40 + len(ramps) * (cell + pad) + 30
    im = Image.new("RGB", (width, height), (24, 22, 22))
    d = ImageDraw.Draw(im)
    f_small, f_title = font(11), font(14)
    d.text((pad, 10), "IRON & AMBER v2 — PROPOSED CONCEPT PALETTE (not adopted by the live game)", fill=(230, 220, 200), font=f_title)
    y = 40
    for ramp, colors in ramps:
        d.text((pad, y + cell // 2 - 6), ramp, fill=(200, 190, 170), font=f_small)
        x = label_w
        for name, value in colors.items():
            d.rectangle([x, y, x + cell, y + cell], fill=hex_rgb(value), outline=(60, 56, 56))
            d.text((x + 2, y + cell - 12), name, fill=(255, 255, 255) if sum(hex_rgb(value)) < 380 else (0, 0, 0), font=font(9))
            x += cell + pad
        y += cell + pad
    d.text((pad, height - 22), f"{len(entries)} entries. Per sprite frame <= 40, per card <= 16, per scene <= 64. Binary alpha.", fill=(160, 150, 140), font=f_small)
    im.save(out)
    return out


def master_lattice_guide() -> Path:
    out = ROOT / "templates" / "master-320-lattice-guide.png"
    im = Image.new("RGBA", (MASTER, MASTER), (18, 16, 16, 255))
    d = ImageDraw.Draw(im)
    # 8-lattice (16 master) grid
    for i in range(0, MASTER + 1, 16):
        c = (44, 40, 40, 255) if (i // 16) % 2 else (34, 31, 31, 255)
        d.line([(i, 0), (i, MASTER)], fill=c)
        d.line([(0, i), (MASTER, i)], fill=c)
    # center line
    d.line([(MASTER // 2, 0), (MASTER // 2, MASTER)], fill=(80, 70, 60, 255))
    # shadow band and ground line
    d.rectangle([0, SHADOW_ROWS[0] * 2, MASTER, SHADOW_ROWS[1] * 2], fill=(30, 26, 30, 255))
    d.line([(0, GROUND_Y * 2), (MASTER, GROUND_Y * 2)], fill=(217, 139, 43, 255), width=2)
    # desktop attempts-screen clip band
    d.rectangle([0, 0, MASTER, DESKTOP_CLIP_ROWS * 2], fill=(90, 30, 30, 255))
    # standing head-top and bar-on-back lines
    d.line([(0, STANDING_HEAD_TOP * 2), (MASTER, STANDING_HEAD_TOP * 2)], fill=(240, 200, 120, 255))
    d.line([(26, BAR_ON_BACK_Y * 2), (MASTER - 26, BAR_ON_BACK_Y * 2)], fill=(196, 196, 206, 255), width=4)
    # 3/4 bar span guides (35 deg camera): x 13..147 lattice
    d.line([(26, 0), (26, MASTER)], fill=(70, 70, 90, 255))
    d.line([(MASTER - 26, 0), (MASTER - 26, MASTER)], fill=(70, 70, 90, 255))
    f = font(10)
    d.text((4, 4), "CLIPPED on 1280x800 attempts screen (top 52 px)", fill=(255, 200, 200, 255), font=f)
    d.text((4, STANDING_HEAD_TOP * 2 + 2), "standing head-top y=52 (lattice 26)", fill=(240, 200, 120, 255), font=f)
    d.text((4, BAR_ON_BACK_Y * 2 + 6), "low-bar on rear delts y=100 (lattice 50); bar span x 26..294", fill=(196, 196, 206, 255), font=f)
    d.text((4, GROUND_Y * 2 - 14), "GROUND y=304 (lattice 152)", fill=(217, 139, 43, 255), font=f)
    d.text((4, SHADOW_ROWS[1] * 2 + 2), "shadow rows 300..316; nothing below 318", fill=(150, 140, 140, 255), font=f)
    d.text((4, MASTER - 14), "320 master = 160 lattice x2 nearest. GUIDE, NOT ART.", fill=(120, 110, 110, 255), font=f)
    im.save(out)
    return out


def card_composition_diagrams() -> list[Path]:
    """Flat labelled boxes describing where masses go in each 52-lattice card."""
    scale = 8
    outs: list[Path] = []
    specs = {
        "squat": [
            ("head", (20, 3, 32, 15), (176, 112, 76)),
            ("bar across traps (full width, plates cropped by edges)", (0, 15, 52, 18), (196, 196, 206)),
            ("near plate stack (cropped)", (0, 8, 9, 26), (184, 38, 42)),
            ("far plate stack (cropped)", (44, 9, 52, 25), (184, 38, 42)),
            ("shoulders / arms up to bar", (6, 18, 46, 30), (176, 112, 76)),
            ("singlet + amber chevron", (16, 24, 36, 44), (38, 38, 51)),
            ("belt / buckle (bottom edge)", (14, 44, 38, 49), (14, 11, 10)),
        ],
        "bench": [
            ("rack upright", (3, 4, 7, 40), (80, 80, 96)),
            ("far plate stack (small)", (6, 8, 14, 20), (184, 38, 42)),
            ("head lying, 3/4, eyes up", (12, 14, 24, 24), (176, 112, 76)),
            ("bar (diagonal, foreshortened)", (10, 18, 48, 21), (196, 196, 206)),
            ("chest / arms pressing", (20, 20, 40, 32), (176, 112, 76)),
            ("bench pad (diagonal)", (10, 28, 46, 40), (46, 43, 50)),
            ("near plate stack (LARGE)", (34, 22, 52, 48), (184, 38, 42)),
            ("foot planted", (40, 44, 48, 51), (44, 42, 42)),
        ],
        "deadlift": [
            ("head, chin up", (21, 1, 31, 12), (176, 112, 76)),
            ("shoulders back, arms straight", (10, 12, 42, 36), (176, 112, 76)),
            ("singlet + chevron", (18, 14, 34, 32), (38, 38, 51)),
            ("belt", (17, 30, 35, 34), (14, 11, 10)),
            ("bar at upper thigh (full width)", (0, 38, 52, 41), (196, 196, 206)),
            ("near plates (cropped)", (0, 30, 8, 52), (184, 38, 42)),
            ("far plates (cropped)", (45, 31, 52, 51), (184, 38, 42)),
            ("thighs / knee sleeves (cropped at bottom)", (16, 41, 36, 52), (124, 46, 38)),
        ],
    }
    f = font(11)
    for lift, boxes in specs.items():
        w = CARD_LATTICE * scale + 560
        h = CARD_LATTICE * scale + 40
        im = Image.new("RGB", (w, h), (18, 16, 16))
        d = ImageDraw.Draw(im)
        ox, oy = 10, 30
        d.text((ox, 6), f"{lift.upper()} CARD — 52-lattice COMPOSITION DIAGRAM (boxes, not art). Export 2x = 104.", fill=(230, 220, 200), font=f)
        for i in range(0, CARD_LATTICE + 1, 4):
            c = (40, 36, 36)
            d.line([(ox + i * scale, oy), (ox + i * scale, oy + CARD_LATTICE * scale)], fill=c)
            d.line([(ox, oy + i * scale), (ox + CARD_LATTICE * scale, oy + i * scale)], fill=c)
        for n, (label, (x0, y0, x1, y1), color) in enumerate(boxes):
            d.rectangle([ox + x0 * scale, oy + y0 * scale, ox + x1 * scale, oy + y1 * scale], fill=color, outline=(0, 0, 0))
            d.text((ox + x0 * scale + 2, oy + y0 * scale + 1), str(n + 1), fill=(255, 255, 255), font=f)
            d.text((ox + CARD_LATTICE * scale + 14, oy + n * 18), f"{n + 1}. {label} — lattice ({x0},{y0})-({x1},{y1})", fill=(200, 190, 170), font=f)
        d.rectangle([ox, oy, ox + CARD_LATTICE * scale, oy + CARD_LATTICE * scale], outline=(217, 139, 43))
        out = ROOT / "templates" / f"card-52-composition-{lift}.png"
        im.save(out)
        outs.append(out)
    return outs


def cover_visible(master_w: int, master_h: int, view_w: int, view_h: int, pos_y: float) -> tuple[int, int, int, int]:
    """Visible master rect under CSS object-fit: cover; object-position: center pos_y."""
    scale = max(view_w / master_w, view_h / master_h)
    vis_w, vis_h = view_w / scale, view_h / scale
    x0 = (master_w - vis_w) / 2
    y0 = (master_h - vis_h) * pos_y
    return int(x0), int(y0), int(x0 + vis_w), int(y0 + vis_h)


def title_safe_zones() -> list[Path]:
    outs: list[Path] = []
    cases = {
        "portrait": (1008, 1792, 0.42, [(390, 844), (360, 800), (430, 932), (768, 1024)], "title.png (< 860px wide)"),
        "wide": (1792, 1008, 0.5, [(1280, 800), (1440, 900), (1920, 1080), (2560, 1080), (1024, 1366)], "title-wide.png (>= 860px wide)"),
    }
    f = font(12)
    for name, (mw, mh, pos_y, views, label) in cases.items():
        safe = [0, 0, mw, mh]
        rects = []
        for vw, vh in views:
            r = cover_visible(mw, mh, vw, vh, pos_y)
            rects.append(((vw, vh), r))
            safe = [max(safe[0], r[0]), max(safe[1], r[1]), min(safe[2], r[2]), min(safe[3], r[3])]
        s = 0.5
        im = Image.new("RGB", (int(mw * s), int(mh * s)), (26, 22, 22))
        d = ImageDraw.Draw(im)
        colors = [(120, 60, 60), (60, 120, 60), (60, 60, 140), (140, 120, 40), (140, 60, 140)]
        for i, ((vw, vh), r) in enumerate(rects):
            d.rectangle([r[0] * s, r[1] * s, r[2] * s, r[3] * s], outline=colors[i % len(colors)], width=2)
            d.text((r[0] * s + 4, r[1] * s + 4 + i * 14), f"{vw}x{vh} visible", fill=colors[i % len(colors)], font=f)
        d.rectangle([safe[0] * s, safe[1] * s, safe[2] * s, safe[3] * s], outline=(245, 200, 108), width=3)
        # veil: bottom 42%..100% darkens; copy sits at the bottom
        d.rectangle([0, mh * 0.55 * s, mw * s, mh * s], outline=(200, 80, 80), width=1)
        d.text((8, mh * 0.55 * s + 4), "below this line: title veil darkens + UI copy/button. Keep hero content above.", fill=(220, 120, 120), font=f)
        d.text((8, 8), f"{label} — SAFE ZONE DIAGRAM (amber box = intersection of all listed viewports)", fill=(240, 230, 210), font=f)
        d.text((8, 26), f"master {mw}x{mh}; safe x {safe[0]}..{safe[2]}, y {safe[1]}..{safe[3]}", fill=(245, 200, 108), font=f)
        out = ROOT / "templates" / f"title-{name}-safe-zone.png"
        im.save(out)
        outs.append(out)
        print(f"  {name} safe zone: x {safe[0]}..{safe[2]}, y {safe[1]}..{safe[3]}")
    return outs


def proportion_guide() -> Path:
    """Head-unit ruler + labelled mass boxes for Reed Hale standing at 160 lattice."""
    scale = 3
    im = Image.new("RGB", (LATTICE * scale + 440, LATTICE * scale), (18, 16, 16))
    d = ImageDraw.Draw(im)
    f = font(11)
    cx = 80
    boxes = [
        ("hair wedge / head 16w x 20h", (cx - 8, 26, cx + 8, 46), (176, 112, 76)),
        ("neck (short) 10w x 4h", (cx - 5, 46, cx + 5, 50), (122, 70, 52)),
        ("shoulders / traps 52w", (cx - 26, 50, cx + 26, 62), (176, 112, 76)),
        ("torso (singlet) 40w, chevron at y 66..76", (cx - 20, 62, cx + 20, 90), (38, 38, 51)),
        ("belt 4h at y 90..94", (cx - 20, 90, cx + 20, 94), (14, 11, 10)),
        ("hips 36w", (cx - 18, 94, cx + 18, 104), (38, 38, 51)),
        ("thighs 18w each, gap 4", (cx - 20, 104, cx + 20, 124), (176, 112, 76)),
        ("knee sleeves y 120..134", (cx - 20, 120, cx + 20, 134), (124, 46, 38)),
        ("shins 12w each", (cx - 18, 134, cx + 18, 148), (176, 112, 76)),
        ("shoes 14w x 4h, ground y=152", (cx - 22, 148, cx + 22, 152), (44, 42, 42)),
    ]
    for i in range(0, LATTICE + 1, 8):
        d.line([(0, i * scale), (LATTICE * scale, i * scale)], fill=(36, 32, 32))
        d.line([(i * scale, 0), (i * scale, LATTICE * scale)], fill=(36, 32, 32))
    d.rectangle([0, 0, LATTICE * scale, DESKTOP_CLIP_ROWS * scale], fill=(70, 26, 26))
    for n, (label, (x0, y0, x1, y1), color) in enumerate(boxes):
        d.rectangle([x0 * scale, y0 * scale, x1 * scale, y1 * scale], fill=color, outline=(0, 0, 0))
        d.text((LATTICE * scale + 10, 10 + n * 18), f"{n + 1}. {label}", fill=(200, 190, 170), font=f)
        d.text((x0 * scale + 2, y0 * scale), str(n + 1), fill=(255, 255, 255), font=font(9))
    # head-unit ruler: 20 px heads from 26 to 152 => 6.3 heads
    for k in range(7):
        y = (26 + k * 20) * scale
        d.line([(140 * scale, y), (152 * scale, y)], fill=(217, 139, 43))
        d.text((141 * scale, y + 1), f"{k}", fill=(217, 139, 43), font=font(9))
    d.line([(0, GROUND_Y * scale), (LATTICE * scale, GROUND_Y * scale)], fill=(217, 139, 43), width=2)
    d.text((LATTICE * scale + 10, 10 + len(boxes) * 18 + 8), "standing height 126 lattice = 6.3 heads of 20", fill=(217, 139, 43), font=f)
    d.text((LATTICE * scale + 10, 10 + len(boxes) * 18 + 26), "shoulder 2.6 heads; hip 1.8 heads; shown FRONT-ON;", fill=(160, 150, 140), font=f)
    d.text((LATTICE * scale + 10, 10 + len(boxes) * 18 + 44), "stage camera is 3/4 (35 deg) — masses foreshorten.", fill=(160, 150, 140), font=f)
    d.text((LATTICE * scale + 10, 10 + len(boxes) * 18 + 70), "PROPORTION DIAGRAM. Boxes, not art.", fill=(120, 110, 110), font=f)
    d.text((4, 4), "red band = clipped on 1280x800 attempts screen", fill=(255, 190, 190), font=f)
    out = ROOT / "templates" / "proportion-guide-160.png"
    im.save(out)
    return out


def stamp_ai_refs(src_dir: Path) -> list[Path]:
    banner = "AI-GENERATED CONCEPT REFERENCE  ·  NOT PRODUCTION ART  ·  DO NOT TRACE  ·  concept-fable-20260916"
    outs: list[Path] = []
    for src in sorted(src_dir.glob("ai-ref-*.png")):
        im = Image.open(src).convert("RGB")
        bar_h = 34
        out_im = Image.new("RGB", (im.width, im.height + bar_h), (120, 24, 24))
        out_im.paste(im, (0, bar_h))
        d = ImageDraw.Draw(out_im)
        f = font(15)
        tw = d.textlength(banner, font=f)
        d.text(((im.width - tw) / 2, 8), banner, fill=(255, 235, 235), font=f)
        out = ROOT / "reference-ai" / (src.stem.upper() + ".png")
        # 256-colour quantise keeps the repo light; these are references, not masters.
        out_im.quantize(256, method=Image.Quantize.MEDIANCUT).save(out, optimize=True)
        outs.append(out)
    return outs


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ai-src", type=Path, default=None, help="directory holding ai-ref-*.png to stamp and copy")
    args = ap.parse_args()
    data, entries = load_palette()
    print("palette:", write_gpl(entries), write_swatches(data, entries))
    print("template:", master_lattice_guide())
    for p in card_composition_diagrams():
        print("template:", p)
    print("title safe zones:")
    for p in title_safe_zones():
        print("template:", p)
    print("template:", proportion_guide())
    if args.ai_src:
        for p in stamp_ai_refs(args.ai_src):
            print("reference:", p)


if __name__ == "__main__":
    main()
