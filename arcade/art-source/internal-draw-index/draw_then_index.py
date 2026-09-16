#!/usr/bin/env python3
"""Draw-then-index studio for Three White Lights: Iron & Amber Arcade.

Pipeline (this sprint):
  1. Hand-place 2D pixel clusters (octagon stamps, scanline polygons, ASCII
     identity tiles). Not a 3D/mesh pack. Not Imagine. Not Grok-as-final.
  2. Lock face/hair/beard to discrete stamps so identity cannot drift.
  3. Index every sprite to the documented palette and binary alpha.
  4. Author card compositions at 52x52 (2x -> 104), not downsampled 320s.

Native stage lattice is 160x160, nearest-neighbor 2x to 320 masters.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "sprites"
SRC = Path(__file__).resolve().parent
MASTER = 320
NATIVE = 160
SCALE = MASTER // NATIVE
CARD_NATIVE = 52
CARD_SIZE = 104
SHEET_COLS, SHEET_ROWS = 3, 2

# --- locked palette (also palette.json) ---
OUTL = (16, 12, 10)
SHAD = (10, 8, 8)
SKIN0 = (96, 58, 40)
SKIN1 = (168, 108, 72)
SKIN2 = (212, 154, 106)
SKIN3 = (236, 188, 140)
FLUSH0 = (140, 64, 48)
FLUSH1 = (176, 84, 62)
HAIR0 = (28, 20, 16)
HAIR1 = (52, 36, 28)
HAIR2 = (78, 56, 42)
SING0 = (22, 20, 26)
SING1 = (40, 38, 50)
SING2 = (70, 66, 82)
AMB0 = (132, 70, 22)
AMB1 = (212, 137, 42)
AMB2 = (243, 197, 106)
BELT = (18, 14, 12)
BUCK = (196, 164, 84)
SHOE0 = (24, 22, 22)
SHOE1 = (52, 48, 46)
CHALK = (210, 204, 196)
WRAP = (228, 220, 204)
BAR0 = (88, 88, 96)
BAR1 = (168, 168, 176)
BAR2 = (214, 214, 220)
RED = (176, 40, 36)
RED2 = (120, 28, 26)
BLU = (40, 72, 160)
BLU2 = (28, 48, 110)
YEL = (204, 168, 36)
GRN = (36, 116, 56)
BLK = (28, 28, 32)
WHT = (236, 230, 218)
WOOD0 = (86, 56, 32)
WOOD1 = (130, 90, 50)
WOOD2 = (168, 124, 72)
MOUTH = (96, 36, 36)
STEEL = (64, 64, 72)
KNEE = (120, 52, 36)
KNEE2 = (86, 36, 28)
BRICK0 = (46, 30, 26)
BRICK1 = (64, 42, 34)
BRICK2 = (82, 54, 42)
FLOOR0 = (42, 38, 36)
FLOOR1 = (58, 52, 48)
BEAM = (26, 22, 20)
GLOW = (247, 243, 234)
CROWD0 = (34, 26, 24)
CROWD1 = (56, 40, 36)

SPRITE_PALETTE = [
    OUTL, SHAD, SKIN0, SKIN1, SKIN2, SKIN3, FLUSH0, FLUSH1,
    HAIR0, HAIR1, HAIR2, SING0, SING1, SING2, AMB0, AMB1, AMB2,
    BELT, BUCK, SHOE0, SHOE1, CHALK, WRAP, BAR0, BAR1, BAR2,
    RED, RED2, BLU, BLU2, YEL, GRN, BLK, WHT, WOOD0, WOOD1, WOOD2,
    MOUTH, STEEL, KNEE, KNEE2,
]
SCENE_EXTRA = [BRICK0, BRICK1, BRICK2, FLOOR0, FLOOR1, BEAM, GLOW, CROWD0, CROWD1]
SCENE_PALETTE = SPRITE_PALETTE + SCENE_EXTRA

FACE_PAL = {
    "H": HAIR0, "h": HAIR1, "k": HAIR2,
    "D": SKIN0, "S": SKIN1, "s": SKIN2, "L": SKIN3,
    "F": FLUSH1, "f": FLUSH0,
    "B": HAIR0, "b": HAIR1,
    "E": WHT, "P": HAIR0, "M": MOUTH, "T": WHT, "W": WHT,
    "n": SKIN0, "J": SKIN0, "o": SKIN0, "a": HAIR1, "u": STEEL,
}

# Fictional athlete Reed Hale: high-and-tight, straight hairline with a
# 1px temporal notch, boxed beard connected through the mustache, heavy brow.
# 3/4 facing RIGHT. Hair mass on the LEFT (back of head). Locked across sheets.
FACE_OK = [
    "   HHHHHHHHhhhh     ",
    "  HhHHHHHHHHHhhh    ",
    " HkHHHHHLLLLHHhh    ",
    " hHHHsSSSSSSLkHh    ",
    " hhHsSSSSSSSSsHh    ",
    " hhSSSS E sSSSsH    ",
    " hsSSSS P  SSSSb    ",
    " DsSSSSsssSSSSBb    ",
    " DsSSo  n SSSBbb    ",
    " DsSSSSSSSSSSBbb    ",
    " DbSS MMMM SSBbb    ",
    " DbSSSSSSSSSSBbb    ",
    "  bBBBBBBBBBBbb     ",
    "   bBBBBBBBBbb      ",
    "    nJJJJJJn        ",
    "     nnnnnn         ",
    "      nnnn          ",
    "      nnnn          ",
]
FACE_STRAIN = [
    "   HHHHHHHHhhhh     ",
    "  HhHHHHHHHHHhhh    ",
    " HkHHHHBBLLBHHhh    ",
    " hHHHFBBLLBBFkHh    ",
    " hhHFSSSBBSSSfHh    ",
    " hhFSSS E fSSSfH    ",
    " hsFSS  P  SSSfb    ",
    " DfSSSSsssSSSFbb    ",
    " DfSFo  n FSSBbb    ",
    " DfSSSSSSSSSSBbb    ",
    " DbSS TTTT SSBbb    ",
    " DbFSSSSSSSSFBbb    ",
    "  bBBBBBBBBBBbb     ",
    "   bBBBBBBBBbb      ",
    "    nJJJJJJn        ",
    "     nnnnnn         ",
    "      nnnn          ",
    "      nnnn          ",
]
FACE_DOWN = [
    "   HHHHHHHHhhhh     ",
    "  HhHHHHHHHHHhhh    ",
    " HkHHHHHHHHHHHhh    ",
    " hHHHLLLLHHHHHHh    ",
    " hhHsSSSSSSSSkHh    ",
    " hhSSSSSSSSSSsHh    ",
    " hsSSS E sSSSSb     ",
    " DsSSSS P SSSBbb    ",
    " DsSSo  n SSSBbb    ",
    " DsSSSSSSSSSSBbb    ",
    " DbSS MMMM SSBbb    ",
    " DbSSSSSSSSSSBbb    ",
    "  bBBBBBBBBBBbb     ",
    "   bBBBBBBBBbb      ",
    "    nJJJJJJn        ",
    "     nnnnnn         ",
    "      nnnn          ",
    "      nnnn          ",
]
FACE_GRIN = [
    "   HHHHHHHHhhhh     ",
    "  HhHHHHHHHHHhhh    ",
    " HkHHHHHLLLLHHhh    ",
    " hHHHsSSSSSSLkHh    ",
    " hhHsSSSSSSSSsHh    ",
    " hhSSSS E sSSSsH    ",
    " hsSSSS P  SSSSb    ",
    " DsSSSSsssSSSSBb    ",
    " DsSSo  n SSSBbb    ",
    " DsSSSSSSSSSSBbb    ",
    " DbSS TMMT SSBbb    ",
    " DbSSSSSSSSSSBbb    ",
    "  bBBBBBBBBBBbb     ",
    "   bBBBBBBBBbb      ",
    "    nJJJJJJn        ",
    "     nnnnnn         ",
    "      nnnn          ",
    "      nnnn          ",
]
FACE_MISS = [
    "   HHHHHHHHhhhh     ",
    "  HhHHHHHHHHHhhh    ",
    " HkHHHHHLLLLHHhh    ",
    " hHHHsSSSSSSLkHh    ",
    " hhHsSSSSSSSSsHh    ",
    " hhSSS      SSsH    ",
    " hsSSS      SSSb    ",
    " DsSSSSsssSSSSBb    ",
    " DsSSo  n SSSBbb    ",
    " DsSSSSSSSSSSBbb    ",
    " DbSS MMMM SSBbb    ",
    " DbSSSSSSSSSSBbb    ",
    "  bBBBBBBBBBBbb     ",
    "   bBBBBBBBBbb      ",
    "    nJJJJJJn        ",
    "     nnnnnn         ",
    "      nnnn          ",
    "      nnnn          ",
]
FACE_FRONT = [
    "    HHHHHHHHHH      ",
    "   HhHHHHHHHHHh     ",
    "  HkHHHLLLLHHHHh    ",
    "  hHHsSSSSSSSsHh    ",
    "  hhSSSSEESSSSsh    ",
    "  hsSSS PP SSSs     ",
    "   sSSSssssSSSs     ",
    "   sSSo nn oSSs     ",
    "   sSSSSSSSSSSs     ",
    "   nSS MMMM SSn     ",
    "   nSSSSSSSSSSn     ",
    "    BBBBBBBBBB      ",
    "    bBBBBBBBBb      ",
    "     nJJJJJJn       ",
    "      nnnnnn        ",
    "       nnnn         ",
    "       nnnn         ",
]
FACES = {
    "ok": FACE_OK,
    "strain": FACE_STRAIN,
    "down": FACE_DOWN,
    "grin": FACE_GRIN,
    "miss": FACE_MISS,
    "front": FACE_FRONT,
}

SHOE_HEEL = [
    "   CCCCCCC      ",
    "  CkkkkkkCC     ",
    " K##########    ",
    "K############   ",
    "##############  ",
    "##############  ",
    " ###      ###   ",
    "  ##      ##    ",
]
SHOE_FLAT = [
    "  CCCCCCCC      ",
    " CkkkkkkkkC     ",
    "K###########    ",
    "#############   ",
    "#############   ",
    " ###     ###    ",
    "  ##     ##     ",
]
SHOE_PAL = {"#": SHOE0, "K": SHOE1, "k": SHOE1, "C": CHALK}
HAND_GRIP = [
    "  sSS  ",
    " sSSSS ",
    " DSSSSD",
    " DsSSsD",
    "  DDD  ",
]
HAND_FIST = [
    "  sSS ",
    " sSSSS",
    " DSSSS",
    " DsSsD",
    "  DD  ",
]
HAND_PAL = {"S": SKIN1, "s": SKIN2, "D": SKIN0}

FONT3 = {
    "A": ["010", "101", "111", "101", "101"],
    "B": ["110", "101", "110", "101", "110"],
    "C": ["011", "100", "100", "100", "011"],
    "D": ["110", "101", "101", "101", "110"],
    "E": ["111", "100", "110", "100", "111"],
    "F": ["111", "100", "110", "100", "100"],
    "G": ["011", "100", "101", "101", "011"],
    "H": ["101", "101", "111", "101", "101"],
    "I": ["111", "010", "010", "010", "111"],
    "K": ["101", "101", "110", "101", "101"],
    "L": ["100", "100", "100", "100", "111"],
    "M": ["101", "111", "111", "101", "101"],
    "N": ["101", "111", "111", "101", "101"],
    "O": ["010", "101", "101", "101", "010"],
    "P": ["110", "101", "110", "100", "100"],
    "Q": ["010", "101", "101", "111", "001"],
    "V": ["101", "101", "101", "101", "010"],
    "R": ["110", "101", "110", "101", "101"],
    "S": ["011", "100", "010", "001", "110"],
    "T": ["111", "010", "010", "010", "010"],
    "U": ["101", "101", "101", "101", "011"],
    "W": ["101", "101", "111", "111", "101"],
    "X": ["101", "101", "010", "101", "101"],
    "Y": ["101", "101", "010", "010", "010"],
    " ": ["000", "000", "000", "000", "000"],
    "&": ["010", "101", "010", "101", "010"],
    "-": ["000", "000", "111", "000", "000"],
}


class Pix:
    def __init__(self, w: int, h: int) -> None:
        self.w = w
        self.h = h
        self.p: list[list[tuple[int, int, int] | None]] = [[None] * w for _ in range(h)]

    def ok(self, x: int, y: int) -> bool:
        return 0 <= x < self.w and 0 <= y < self.h

    def set(self, x: int, y: int, col: tuple[int, int, int] | None) -> None:
        if col is None or not self.ok(int(x), int(y)):
            return
        self.p[int(y)][int(x)] = col

    def get(self, x: int, y: int) -> tuple[int, int, int] | None:
        return self.p[y][x] if self.ok(x, y) else None

    def fill(self, col: tuple[int, int, int]) -> None:
        for y in range(self.h):
            for x in range(self.w):
                self.p[y][x] = col

    def stamp(self, x: int, y: int, rows: list[str], pal: dict[str, tuple[int, int, int]], scale: int = 1) -> None:
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                col = pal.get(ch)
                if col is None:
                    continue
                for dy in range(scale):
                    for dx in range(scale):
                        self.set(x + i * scale + dx, y + j * scale + dy, col)

    def oct(self, cx: float, cy: float, r: float, col: tuple[int, int, int]) -> None:
        rr = max(1, int(round(r)))
        for dy in range(-rr, rr + 1):
            for dx in range(-rr, rr + 1):
                adx, ady = abs(dx), abs(dy)
                if adx + ady <= rr + rr // 2 and adx <= rr and ady <= rr:
                    self.set(int(round(cx)) + dx, int(round(cy)) + dy, col)

    def fill_poly(self, pts: list[tuple[float, float]], col: tuple[int, int, int]) -> None:
        if len(pts) < 3:
            return
        im = Image.new("1", (self.w, self.h), 0)
        d = ImageDraw.Draw(im)
        d.polygon([(int(round(x)), int(round(y))) for x, y in pts], fill=1)
        pix = im.load()
        for y in range(self.h):
            for x in range(self.w):
                if pix[x, y]:
                    self.set(x, y, col)

    def ellipse(self, cx: float, cy: float, rx: float, ry: float, col: tuple[int, int, int]) -> None:
        im = Image.new("1", (self.w, self.h), 0)
        d = ImageDraw.Draw(im)
        x0, y0 = int(round(cx - rx)), int(round(cy - ry))
        x1, y1 = int(round(cx + rx)), int(round(cy + ry))
        d.ellipse([x0, y0, x1, y1], fill=1)
        pix = im.load()
        for y in range(max(0, y0), min(self.h, y1 + 1)):
            for x in range(max(0, x0), min(self.w, x1 + 1)):
                if pix[x, y]:
                    self.set(x, y, col)

    def limb(
        self,
        x0: float,
        y0: float,
        x1: float,
        y1: float,
        r0: float,
        r1: float,
        cols: tuple[tuple[int, int, int], tuple[int, int, int], tuple[int, int, int]],
    ) -> None:
        length = max(1.0, ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5)
        steps = int(length) + 2
        for i in range(steps + 1):
            t = i / steps
            x = x0 + (x1 - x0) * t
            y = y0 + (y1 - y0) * t
            r = r0 + (r1 - r0) * t
            self.oct(x, y, r, cols[0])
            self.oct(x - r * 0.28, y - r * 0.32, max(1.0, r * 0.72), cols[1])
            self.oct(x - r * 0.45, y - r * 0.5, max(1.0, r * 0.32), cols[2])

    def outline(self, col: tuple[int, int, int] = OUTL) -> None:
        marks: list[tuple[int, int]] = []
        for y in range(self.h):
            for x in range(self.w):
                if self.p[y][x] is None:
                    continue
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    nx, ny = x + dx, y + dy
                    if not self.ok(nx, ny) or self.p[ny][nx] is None:
                        marks.append((x, y))
                        break
        for x, y in marks:
            self.p[y][x] = col

    def text(self, x: int, y: int, msg: str, col: tuple[int, int, int]) -> None:
        cx = x
        for ch in msg.upper():
            glyph = FONT3.get(ch, FONT3[" "])
            for j, row in enumerate(glyph):
                for i, bit in enumerate(row):
                    if bit == "1":
                        self.set(cx + i, y + j, col)
            cx += 4

    def to_image(self, palette: list[tuple[int, int, int]]) -> Image.Image:
        im = Image.new("RGBA", (self.w, self.h), (0, 0, 0, 0))
        px = im.load()
        lut: dict[tuple[int, int, int], tuple[int, int, int]] = {c: c for c in palette}
        for y in range(self.h):
            for x in range(self.w):
                col = self.p[y][x]
                if col is None:
                    continue
                nearest = lut.get(col)
                if nearest is None:
                    nearest = min(
                        palette,
                        key=lambda c: (c[0] - col[0]) ** 2 + (c[1] - col[1]) ** 2 + (c[2] - col[2]) ** 2,
                    )
                    lut[col] = nearest
                px[x, y] = (*nearest, 255)
        return im


def nn(im: Image.Image, factor: int) -> Image.Image:
    return im.resize((im.width * factor, im.height * factor), Image.Resampling.NEAREST)


def binary_index(im: Image.Image, palette: list[tuple[int, int, int]]) -> Image.Image:
    src = im.convert("RGBA")
    out = Image.new("RGBA", src.size, (0, 0, 0, 0))
    sp = src.load()
    op = out.load()
    lut: dict[tuple[int, int, int], tuple[int, int, int]] = {}
    for y in range(src.height):
        for x in range(src.width):
            r, g, b, a = sp[x, y]
            if a < 128:
                continue
            key = (r, g, b)
            nearest = lut.get(key)
            if nearest is None:
                nearest = min(palette, key=lambda c: (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2)
                lut[key] = nearest
            if nearest[0] > 170 and nearest[2] > 150 and nearest[1] < 130:
                continue
            op[x, y] = (*nearest, 255)
    return out


def save_png(path: Path, im: Image.Image, palette: list[tuple[int, int, int]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    binary_index(im, palette).save(path)


def shadow(p: Pix, cx: float, cy: float, rx: float, ry: float) -> None:
    p.ellipse(cx, cy, rx, ry, SHAD)


def shoe(p: Pix, x: int, y: int, heel: bool, flip: bool = False) -> None:
    rows = SHOE_HEEL if heel else SHOE_FLAT
    if flip:
        rows = [row[::-1] for row in rows]
    p.stamp(x, y, rows, SHOE_PAL)


def chevron(p: Pix, cx: int, cy: int) -> None:
    pts = [(cx, cy), (cx - 5, cy + 7), (cx - 2, cy + 7), (cx, cy + 4), (cx + 2, cy + 7), (cx + 5, cy + 7)]
    p.fill_poly(pts, AMB1)
    p.set(cx, cy + 1, AMB2)


def belt_band(p: Pix, x0: int, y: int, x1: int) -> None:
    for x in range(x0, x1 + 1):
        for dy in range(6):
            p.set(x, y + dy, BELT)
        p.set(x, y, AMB0)
        p.set(x, y + 5, AMB0)
    bx = x0 + int((x1 - x0) * 0.62)
    for dy in range(1, 5):
        for dx in range(-3, 4):
            p.set(bx + dx, y + dy, BUCK)
    p.set(bx, y + 2, AMB2)


def sleeve(p: Pix, x: int, y: int, w: int, h: int) -> None:
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            p.set(xx, yy, KNEE if (yy - y) % 3 else KNEE2)


def plate_disc(p: Pix, cx: float, cy: float, rx: float, ry: float, face: tuple[int, int, int], rim: tuple[int, int, int]) -> None:
    p.ellipse(cx, cy, rx, ry, rim)
    p.ellipse(cx, cy, max(3, rx - 2), max(2, ry - 2), face)
    p.ellipse(cx, cy, max(2, rx * 0.22), max(2, ry * 0.22), STEEL)
    p.set(int(round(cx)), int(round(cy)), BAR1)


def plate_stack(p: Pix, cx: float, cy: float, effort: str, near: bool) -> None:
    if effort == "max":
        load = [(RED, RED2, 4), (RED, RED2, 4), (BLU, BLU2, 3), (YEL, AMB0, 3)]
    else:
        load = [(YEL, AMB0, 3), (GRN, (24, 80, 40), 3)]
    scale = 1.05 if near else 0.72
    step = -5 if near else 5
    ox = 0.0
    for face, rim, thick in load:
        rx, ry = 17 * scale, 11 * scale
        for i in range(thick):
            plate_disc(p, cx + ox, cy + i, rx, ry, face if i == 0 else rim, rim)
        ox += step * scale
    p.oct(cx + ox + (-2 if near else 2), cy, 3 * scale, STEEL)
    p.oct(cx + ox + (-2 if near else 2), cy, 2 * scale, BAR1)


def barbell(p: Pix, x0: float, x1: float, y: float) -> None:
    yi = int(round(y))
    x0i, x1i = int(round(min(x0, x1))), int(round(max(x0, x1)))
    for x in range(x0i, x1i + 1):
        p.set(x, yi - 1, BAR0)
        p.set(x, yi, BAR1)
        p.set(x, yi + 1, BAR2 if (x // 3) % 2 == 0 else BAR1)
        p.set(x, yi + 2, BAR0)


def torso(
    p: Pix,
    pelvis: tuple[float, float],
    chest: tuple[float, float],
    ls: tuple[float, float],
    rs: tuple[float, float],
    lh: tuple[float, float],
    rh: tuple[float, float],
    mass: float,
) -> None:
    cx, cy = chest
    px, py = pelvis
    trap_l = (ls[0] - 2 * mass, ls[1] - 4)
    trap_r = (rs[0] + 2 * mass, rs[1] - 3)
    rib_l = (cx - 16 - 3 * mass, cy + 6)
    rib_r = (cx + 14 + 3 * mass, cy + 7)
    waist_l = (px - 11 - mass, py - 2)
    waist_r = (px + 11 + mass, py - 1)
    hip_l = (lh[0] - 4, lh[1] + 4)
    hip_r = (rh[0] + 4, rh[1] + 4)
    p.fill_poly([trap_l, trap_r, rib_r, waist_r, hip_r, hip_l, waist_l, rib_l], SING1)
    p.fill_poly([trap_l, (cx - 2, cy - 8), rib_l, waist_l], SING2)
    p.fill_poly([rib_r, waist_r, hip_r, (px + 8, py + 6)], SING0)
    p.oct(ls[0], ls[1] - 2, 7 + mass, SKIN1)
    p.oct(ls[0] - 2, ls[1] - 4, 4 + mass, SKIN2)
    p.oct(rs[0], rs[1] - 1, 6 + mass, SKIN0)
    p.oct(rs[0] - 1, rs[1] - 3, 3, SKIN1)
    chevron(p, int(cx), int(cy - 2))
    belt_band(p, int(waist_l[0]) + 2, int(py - 1), int(waist_r[0]) - 2)


def draw_lifter(p: Pix, pose: dict, effort: str, lift: str) -> None:
    mass = 1.6 if effort == "max" else 0.4
    skin = (FLUSH0, SKIN1, SKIN2) if effort == "max" or pose.get("face") == "strain" else (SKIN0, SKIN1, SKIN2)
    fl, fr = pose["l_foot"], pose["r_foot"]
    lk, rk = pose["l_knee"], pose["r_knee"]
    lh, rh = pose["l_hip"], pose["r_hip"]
    pelvis = pose["pelvis"]
    chest = pose["chest"]
    ls, rs = pose["l_sh"], pose["r_sh"]
    le, re = pose["l_elb"], pose["r_elb"]
    lha, rha = pose["l_hand"], pose["r_hand"]
    bar_y = pose["bar_y"]
    bar_x0, bar_x1 = pose["bar_x"]
    hx, hy = pose["head"]
    heel = lift == "squat"
    show_bar = pose.get("bar", True)
    show_bench = pose.get("bench")

    shadow(p, (fl[0] + fr[0]) / 2, max(fl[1], fr[1]) + 4, 28 + 6 * mass, 7)

    if show_bench:
        bx, by, bw, bh = show_bench
        p.fill_poly([(bx, by), (bx + bw, by - 10), (bx + bw, by - 10 + bh), (bx, by + bh)], WOOD1)
        p.fill_poly([(bx, by), (bx + bw * 0.4, by - 4), (bx + bw * 0.4, by - 4 + bh), (bx, by + bh)], WOOD2)
        p.fill_poly([(bx, by + bh), (bx + bw, by - 10 + bh), (bx + bw, by - 6 + bh + 10), (bx + 6, by + bh + 14)], WOOD0)
        for ux in (bx + 8, bx + bw - 18):
            for y in range(int(by) - 52, int(by) + 8):
                p.set(int(ux), y, STEEL)
                p.set(int(ux) + 4, y, BAR0)
            p.oct(ux + 2, by - 8, 4, BAR1)

    if show_bar:
        plate_stack(p, bar_x1 + 6, bar_y, effort, near=False)

    p.limb(rh[0], rh[1], rk[0], rk[1], 9 + mass, 7 + mass, (SKIN0, SKIN1, SKIN2))
    p.limb(rk[0], rk[1], fr[0], fr[1] - 8, 6 + mass, 5, (SKIN0, SKIN1, SKIN2))
    sleeve(p, int(rk[0]) - 6, int(rk[1]) - 4, 12, 11)
    if lift != "bench":
        shoe(p, int(fr[0]) - 4, int(fr[1]) - 8, heel)

    torso(p, pelvis, chest, ls, rs, lh, rh, mass)

    p.limb(lh[0], lh[1], lk[0], lk[1], 10 + mass, 8 + mass, skin)
    p.limb(lk[0], lk[1], fl[0], fl[1] - 8, 7 + mass, 5.5, skin)
    sleeve(p, int(lk[0]) - 7, int(lk[1]) - 5, 14, 12)
    if lift != "bench":
        shoe(p, int(fl[0]) - 10, int(fl[1]) - 8, heel, flip=True)
    else:
        shoe(p, int(fl[0]) - 8, int(fl[1]) - 8, False, flip=True)
        shoe(p, int(fr[0]) - 2, int(fr[1]) - 8, False)

    # Quad / calf clusters (pixel blobs, not extra mesh).
    p.oct((lh[0] + lk[0]) / 2 - 2, (lh[1] + lk[1]) / 2, 8 + mass, skin[1])
    p.oct((lh[0] + lk[0]) / 2 - 4, (lh[1] + lk[1]) / 2 - 2, 4, skin[2])
    p.oct((lk[0] + fl[0]) / 2, (lk[1] + fl[1]) / 2, 6, skin[0])

    p.limb(rs[0], rs[1], re[0], re[1], 6 + mass, 5, (SKIN0, SKIN1, SKIN2))
    p.limb(re[0], re[1], rha[0], rha[1], 5, 4.2, (SKIN0, SKIN1, SKIN2))
    if lift == "bench":
        for dx in range(-2, 6):
            p.set(int(rha[0]) + dx, int(rha[1]) + 2, WRAP)

    p.limb(ls[0], ls[1], le[0], le[1], 7 + mass, 5.5, skin)
    p.limb(le[0], le[1], lha[0], lha[1], 5.5, 4.5, skin)
    if lift == "bench":
        for dx in range(-2, 6):
            p.set(int(lha[0]) + dx, int(lha[1]) + 2, WRAP)

    p.oct(hx + 16, hy + 32, 6, SKIN0)
    p.oct(hx + 14, hy + 30, 4, SKIN1)
    p.oct(hx + 16, hy + 28, 3, SKIN2)

    if show_bar and lift != "squat":
        barbell(p, bar_x0, bar_x1, bar_y)
        p.stamp(int(lha[0]) - 4, int(lha[1]) - 3, HAND_GRIP, HAND_PAL, 2)
        p.stamp(int(rha[0]) - 4, int(rha[1]) - 3, HAND_GRIP, HAND_PAL, 2)
        plate_stack(p, bar_x0 - 8, bar_y, effort, near=True)
    elif show_bar:
        barbell(p, bar_x0, bar_x1, bar_y)
        plate_stack(p, bar_x0 - 8, bar_y, effort, near=True)

    if pose.get("fist"):
        p.stamp(int(lha[0]) - 4, int(lha[1]) - 4, HAND_FIST, HAND_PAL, 2)
        p.stamp(int(rha[0]) - 4, int(rha[1]) - 4, HAND_FIST, HAND_PAL, 2)

    p.outline(OUTL)

    # Identity lock: 2x face stamp after outline so hairline/beard cannot drift or get eaten.
    p.stamp(int(hx), int(hy), FACES[pose["face"]], FACE_PAL, 2)
    if show_bar and lift == "squat":
        p.stamp(int(lha[0]) - 4, int(lha[1]) - 3, HAND_GRIP, HAND_PAL, 2)
        p.stamp(int(rha[0]) - 4, int(rha[1]) - 3, HAND_GRIP, HAND_PAL, 2)


def lerp_pose(a: dict, b: dict, t: float) -> dict:
    out = dict(a)
    for key, val in a.items():
        if key in ("face", "bar", "bench", "fist"):
            continue
        other = b[key]
        if isinstance(val, tuple) and val and isinstance(val[0], (int, float)):
            out[key] = tuple(val[i] + (other[i] - val[i]) * t for i in range(len(val)))
        elif isinstance(val, (int, float)):
            out[key] = val + (other - val) * t
    out["face"] = b["face"] if t > 0.55 else a["face"]
    if "bench" in a:
        out["bench"] = a["bench"]
    out["bar"] = a.get("bar", True)
    out["fist"] = a.get("fist", False)
    return out


def squat_keys(effort: str) -> tuple[dict, dict, dict]:
    wide = 6 if effort == "max" else 0
    drop = 8 if effort == "max" else 0
    setup = {
        "l_foot": (56 - wide, 147), "r_foot": (104 + wide, 147),
        "l_knee": (60 - wide, 116), "r_knee": (100 + wide, 116),
        "l_hip": (64, 90), "r_hip": (96, 90),
        "pelvis": (80, 88), "chest": (80, 54),
        "l_sh": (56, 46), "r_sh": (104, 48),
        "l_elb": (44, 58), "r_elb": (116, 60),
        "l_hand": (40, 44), "r_hand": (120, 46),
        "head": (70, 4), "face": "ok",
        "bar_y": 38, "bar_x": (36, 124), "bar": True,
    }
    hole = {
        "l_foot": (54 - wide, 147), "r_foot": (106 + wide, 147),
        "l_knee": (46 - wide, 108), "r_knee": (114 + wide, 108),
        "l_hip": (62, 118 + drop), "r_hip": (98, 118 + drop),
        "pelvis": (80, 116 + drop), "chest": (76, 78 + drop),
        "l_sh": (52, 70 + drop), "r_sh": (100, 72 + drop),
        "l_elb": (40, 78 + drop), "r_elb": (118, 80 + drop),
        "l_hand": (36, 64 + drop), "r_hand": (122, 66 + drop),
        "head": (72, 26 + drop), "face": "strain" if effort == "max" else "down",
        "bar_y": 62 + drop, "bar_x": (32, 128), "bar": True,
    }
    lock = {
        "l_foot": (56 - wide, 147), "r_foot": (104 + wide, 147),
        "l_knee": (62 - wide, 114), "r_knee": (98 + wide, 114),
        "l_hip": (66, 88), "r_hip": (94, 88),
        "pelvis": (80, 86), "chest": (80, 50),
        "l_sh": (56, 42), "r_sh": (104, 44),
        "l_elb": (44, 54), "r_elb": (116, 56),
        "l_hand": (40, 40), "r_hand": (120, 42),
        "head": (70, 2), "face": "ok",
        "bar_y": 36, "bar_x": (36, 124), "bar": True,
    }
    return setup, hole, lock


def squat_pose(frame: int, effort: str) -> dict:
    setup, hole, lock = squat_keys(effort)
    if frame <= 2:
        pose = lerp_pose(setup, hole, frame / 2)
    else:
        pose = lerp_pose(hole, lock, (frame - 2) / 3)
    if frame == 2:
        pose["face"] = "strain" if effort == "max" else "down"
    if frame == 5:
        pose["face"] = "ok"
    return pose


def bench_pose(frame: int, effort: str) -> dict:
    sink = 8 if effort == "max" else 0
    bar = [56, 66, 78 + sink, 70, 60, 50][frame]
    arch = [0, 1, 3 + (2 if effort == "max" else 0), 2, 1, 0][frame]
    if effort == "max" and frame in (2, 3, 4):
        face = "strain"
    elif frame in (0, 5):
        face = "ok"
    else:
        face = "down"
    return {
        "l_foot": (118, 147), "r_foot": (132, 138),
        "l_knee": (112, 124), "r_knee": (128, 118),
        "l_hip": (108, 102 - arch), "r_hip": (122, 98 - arch),
        "pelvis": (110, 100 - arch), "chest": (78, 86 - arch),
        "l_sh": (64, 80 - arch), "r_sh": (96, 76 - arch),
        "l_elb": (58, bar + 10), "r_elb": (104, bar + 8),
        "l_hand": (62, bar), "r_hand": (98, bar),
        "head": (24, 40 - arch), "face": face,
        "bar_y": bar, "bar_x": (40, 120), "bar": True,
        "bench": (36, 98, 108, 18),
    }


def deadlift_pose(frame: int, effort: str) -> dict:
    rounded = 6 if effort == "max" else 0
    hip = [106 + rounded, 102 + rounded, 98, 92, 88, 84][frame]
    head_y = [48 + rounded, 36 + rounded // 2, 24, 14, 8, 4][frame]
    bar = [138, 128, 118, 110, 104, 98][frame]
    knee = [124, 122, 120, 118, 116, 114][frame]
    chest_y = [82 + rounded, 74 + rounded // 2, 66, 58, 52, 48][frame]
    sh_y = chest_y - 8
    faces = ["down", "down", "strain" if effort == "max" else "down", "strain" if effort == "max" else "ok", "ok", "ok"]
    return {
        "l_foot": (62, 147), "r_foot": (98, 147),
        "l_knee": (64, knee), "r_knee": (96, knee),
        "l_hip": (60, hip), "r_hip": (92, hip),
        "pelvis": (78, hip - 2), "chest": (76, chest_y),
        "l_sh": (58, sh_y), "r_sh": (98, sh_y + 2),
        "l_elb": (60, (sh_y + bar) / 2), "r_elb": (96, (sh_y + bar) / 2 + 1),
        "l_hand": (64, bar), "r_hand": (94, bar),
        "head": (70, head_y), "face": faces[frame],
        "bar_y": bar, "bar_x": (40, 120), "bar": True,
    }


def idle_pose(frame: int) -> dict:
    b = frame % 2
    return {
        "l_foot": (60, 147), "r_foot": (100, 147),
        "l_knee": (64, 116), "r_knee": (96, 116),
        "l_hip": (66, 90), "r_hip": (94, 90),
        "pelvis": (80, 88), "chest": (80, 54 - b),
        "l_sh": (56, 48 - b), "r_sh": (104, 50 - b),
        "l_elb": (50, 74), "r_elb": (110, 76),
        "l_hand": (52, 96), "r_hand": (108, 98),
        "head": (70, 4 - b), "face": "ok",
        "bar_y": 90, "bar_x": (40, 120), "bar": False, "fist": False,
    }


def success_pose(frame: int) -> dict:
    raise_arm = [0, 8, 18, 22][frame]
    return {
        "l_foot": (58, 147), "r_foot": (102, 147),
        "l_knee": (62, 116), "r_knee": (98, 116),
        "l_hip": (66, 90), "r_hip": (94, 90),
        "pelvis": (80, 88), "chest": (80, 52),
        "l_sh": (54, 44), "r_sh": (106, 46),
        "l_elb": (46, 36 - raise_arm // 2), "r_elb": (118, 58),
        "l_hand": (50, 18 - raise_arm), "r_hand": (122, 64),
        "head": (70, 2), "face": "grin",
        "bar_y": 90, "bar_x": (40, 120), "bar": False, "fist": True,
    }


def miss_pose(frame: int) -> dict:
    sink = [0, 4, 8, 10][frame]
    return {
        "l_foot": (62, 147), "r_foot": (98, 147),
        "l_knee": (64, 122 + sink // 2), "r_knee": (96, 122 + sink // 2),
        "l_hip": (60, 104 + sink), "r_hip": (92, 104 + sink),
        "pelvis": (78, 102 + sink), "chest": (74, 78 + sink),
        "l_sh": (56, 70 + sink), "r_sh": (98, 72 + sink),
        "l_elb": (58, 100 + sink), "r_elb": (96, 102 + sink),
        "l_hand": (62, 128 + sink // 2), "r_hand": (94, 128 + sink // 2),
        "head": (70, 28 + sink), "face": "miss",
        "bar_y": 138, "bar_x": (40, 120), "bar": True,
    }


def render_stage(lift: str, frame: int, effort: str) -> Pix:
    p = Pix(NATIVE, NATIVE)
    if lift == "squat":
        draw_lifter(p, squat_pose(frame, effort), effort, "squat")
    elif lift == "bench":
        draw_lifter(p, bench_pose(frame, effort), effort, "bench")
    else:
        draw_lifter(p, deadlift_pose(frame, effort), effort, "deadlift")
    return p


def render_emote(kind: str, frame: int) -> Pix:
    p = Pix(NATIVE, NATIVE)
    if kind == "idle":
        draw_lifter(p, idle_pose(frame), "light", "idle")
    elif kind == "success":
        draw_lifter(p, success_pose(frame), "light", "idle")
    else:
        draw_lifter(p, miss_pose(frame), "light", "deadlift")
    return p


def crop_to_card(src: Pix, dst: Pix, x0: int, y0: int, x1: int, y1: int) -> None:
    dw, dh = dst.w, dst.h
    sw, sh = max(1, x1 - x0), max(1, y1 - y0)
    for y in range(dh):
        sy = y0 + int(y * sh / dh)
        for x in range(dw):
            sx = x0 + int(x * sw / dw)
            col = src.get(sx, sy)
            dst.set(x, y, col if col is not None else (20, 17, 15))
    dst.outline(OUTL)


def render_card(lift: str, effort: str) -> Pix:
    p = Pix(CARD_NATIVE, CARD_NATIVE)
    p.fill((20, 17, 15))
    p.fill_poly([(0, 40), (51, 40), (51, 51), (0, 51)], WOOD0)
    p.fill_poly([(4, 42), (47, 42), (47, 50), (4, 50)], WOOD1)
    q = Pix(NATIVE, NATIVE)
    if lift == "squat":
        draw_lifter(q, squat_pose(2, effort), effort, "squat")
        crop_to_card(q, p, 16, 4, 144, 132)
    elif lift == "bench":
        draw_lifter(q, bench_pose(2, effort), effort, "bench")
        crop_to_card(q, p, 8, 20, 148, 130)
    else:
        draw_lifter(q, deadlift_pose(5, effort), effort, "deadlift")
        crop_to_card(q, p, 6, 0, 154, 150)
    return p


def render_identity() -> Pix:
    p = Pix(NATIVE, NATIVE)
    draw_lifter(p, idle_pose(0), "light", "idle")
    return p


def blit(dst: Pix, src: Pix, ox: int, oy: int) -> None:
    for y in range(src.h):
        for x in range(src.w):
            col = src.get(x, y)
            if col:
                dst.set(ox + x, oy + y, col)


def render_model_sheet() -> Pix:
    p = Pix(480, 320)
    p.fill((20, 17, 15))
    p.text(12, 8, "REED HALE", AMB1)
    p.text(12, 16, "FICTIONAL ATHLETE", CHALK)
    x = 12
    for name in ("ok", "strain", "down", "grin", "miss", "front"):
        p.stamp(x, 28, FACES[name], FACE_PAL, 2)
        p.text(x, 62, name[:4].upper(), AMB2)
        x += 44
    px = 12
    for col in SPRITE_PALETTE:
        for dy in range(8):
            for dx in range(6):
                p.set(px + dx, 96 + dy, col)
        px += 8
    p.text(12, 108, "LOCKED PALETTE", CHALK)
    for i, (lift, frame, effort, label) in enumerate((
        ("squat", 2, "light", "SQUAT HOLE"),
        ("bench", 2, "light", "BENCH PAUSE"),
        ("deadlift", 5, "light", "DL LOCK"),
        ("deadlift", 0, "light", "DL SETUP"),
        ("squat", 2, "max", "SQUAT MAX"),
        ("bench", 2, "max", "BENCH MAX"),
    )):
        q = render_stage(lift, frame, effort)
        ox = 8 + (i % 3) * 156
        oy = 124 + (i // 3) * 96
        for y in range(90):
            for x in range(150):
                sx, sy = 5 + int(x * NATIVE / 150), 10 + int(y * NATIVE / 90)
                col = q.get(sx, sy)
                if col:
                    p.set(ox + x, oy + y, col)
        p.text(ox, oy - 8, label, AMB1)
    p.text(12, 310, "NO REAL LIKENESS - NO TRACE - DRAW THEN INDEX", CHALK)
    return p


def gym_backdrop(p: Pix, w: int, h: int, spotlight: bool = True) -> None:
    p.fill(BEAM)
    for y in range(0, int(h * 0.62), 6):
        for x in range(0, w, 10):
            col = BRICK0 if ((x // 10) + (y // 6)) % 2 == 0 else BRICK1
            for dy in range(5):
                for dx in range(9):
                    p.set(x + dx, y + dy, col)
    by = int(h * 0.38)
    for row in range(5):
        for x in range(8, w - 8, 6):
            p.set(x, by + row * 5, CROWD0 if row % 2 == 0 else CROWD1)
            p.set(x + 1, by + row * 5, CROWD1)
    fy = int(h * 0.62)
    for y in range(fy, h):
        for x in range(w):
            p.set(x, y, FLOOR0 if ((x // 8) + (y // 6)) % 2 == 0 else FLOOR1)
    px0, px1 = int(w * 0.18), int(w * 0.82)
    py0, py1 = int(h * 0.68), int(h * 0.92)
    p.fill_poly([(px0, py0), (px1, py0), (px1 + 8, py1), (px0 - 8, py1)], WOOD0)
    p.fill_poly([(px0 + 6, py0 + 4), (px1 - 6, py0 + 4), (px1, py1 - 6), (px0, py1 - 6)], WOOD1)
    for x in range(px0 + 8, px1 - 8):
        p.set(x, py0 + 8, AMB2)
        p.set(x, py1 - 10, AMB2)
    if spotlight:
        cx, cy = w // 2, int(h * 0.08)
        for i in range(18, 0, -1):
            p.oct(cx, cy, i, AMB0 if i > 10 else (AMB1 if i > 4 else AMB2))
        p.oct(cx, cy, 3, GLOW)
    ly = int(h * 0.12)
    lx = w // 2
    for dx in (-18, 0, 18):
        p.oct(lx + dx, ly, 5, STEEL)
        p.oct(lx + dx, ly, 3, GLOW)
    p.text(8, 4, "THREE WHITE LIGHTS", GLOW)
    p.text(8, 12, "IRON & AMBER", AMB1)


def render_title_portrait() -> Pix:
    p = Pix(252, 448)
    gym_backdrop(p, 252, 448)
    blit(p, render_identity(), 46, 168)
    return p


def render_title_wide() -> Pix:
    p = Pix(448, 252)
    gym_backdrop(p, 448, 252)
    blit(p, render_identity(), 24, 70)
    return p


def render_platform() -> Pix:
    p = Pix(320, 180)
    gym_backdrop(p, 320, 180, spotlight=True)
    return p


def sheet_from(frames: list[Image.Image]) -> Image.Image:
    w, h = frames[0].size
    sheet = Image.new("RGBA", (w * SHEET_COLS, h * SHEET_ROWS), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        c, r = i % SHEET_COLS, i // SHEET_COLS
        sheet.paste(fr, (c * w, r * h))
    return sheet


def export_all() -> dict:
    report: dict = {"native": NATIVE, "master": MASTER, "card": CARD_SIZE, "frames": []}
    working = SRC / "working-160"
    masters = SRC / "masters-320"
    cards = SRC / "cards-104"
    index_rows: list[list[str]] = [["lift", "effort", "frame", "state", "path"]]

    def dump_stage(rel: str, pix: Pix, lift: str, effort: str, frame: int, state: str) -> Image.Image:
        native = pix.to_image(SPRITE_PALETTE)
        master = nn(native, SCALE)
        save_png(working / rel, native, SPRITE_PALETTE)
        save_png(masters / rel, master, SPRITE_PALETTE)
        save_png(OUT / rel, master, SPRITE_PALETTE)
        index_rows.append([lift, effort, str(frame + 1), state, f"/sprites/{rel}"])
        report["frames"].append(rel)
        return master

    squat_states = ["setup", "descend", "hole", "drive", "almost", "lockout"]
    bench_states = ["setup", "lower", "pause", "press", "almost", "lockout"]
    dead_states = ["setup", "break", "knee", "mid", "almost", "lockout"]

    for lift, states in (("squat", squat_states), ("bench", bench_states), ("deadlift", dead_states)):
        for effort, folder in (("light", lift), ("max", f"{lift}-max")):
            exported: list[Image.Image] = []
            for i, state in enumerate(states):
                pix = render_stage(lift, i, effort)
                im = dump_stage(f"{folder}/frame-{i+1:02d}.png", pix, lift, effort, i, state)
                exported.append(im)
            sheet = sheet_from(exported)
            save_png(OUT / folder / "sheet-transparent.png", sheet, SPRITE_PALETTE)
            save_png(masters / folder / "sheet-transparent.png", sheet, SPRITE_PALETTE)

    for kind, n in (("idle", 4), ("success", 4), ("miss", 4)):
        exported = []
        for i in range(n):
            pix = render_emote(kind, i)
            im = dump_stage(f"{kind}/frame-{i+1:02d}.png", pix, kind, "light", i, kind)
            exported.append(im)
        extra = exported + exported[:2]
        save_png(OUT / kind / "sheet-transparent.png", sheet_from(extra), SPRITE_PALETTE)

    ident = nn(render_identity().to_image(SPRITE_PALETTE), SCALE)
    save_png(OUT / "identity.png", ident, SPRITE_PALETTE)
    save_png(masters / "identity.png", ident, SPRITE_PALETTE)

    for lift in ("squat", "bench", "deadlift"):
        for effort in ("light", "max"):
            pix = render_card(lift, effort)
            card = nn(pix.to_image(SPRITE_PALETTE), CARD_SIZE // CARD_NATIVE)
            name = f"{lift}-{effort}.png"
            save_png(cards / name, card, SPRITE_PALETTE)
            save_png(OUT / "cards" / name, card, SPRITE_PALETTE)
            index_rows.append([lift, effort, "card", "card", f"/sprites/cards/{name}"])

    sheet = render_model_sheet().to_image(SCENE_PALETTE)
    save_png(SRC / "model-sheet.png", sheet, SCENE_PALETTE)
    save_png(OUT / "model-sheet.png", sheet, SCENE_PALETTE)

    title = nn(render_title_portrait().to_image(SCENE_PALETTE), 4)
    wide = nn(render_title_wide().to_image(SCENE_PALETTE), 4)
    plat = nn(render_platform().to_image(SCENE_PALETTE), 4)
    save_png(OUT / "title.png", title, SCENE_PALETTE)
    save_png(OUT / "title-portrait.png", title, SCENE_PALETTE)
    save_png(OUT / "title-wide.png", wide, SCENE_PALETTE)
    save_png(OUT / "platform.png", plat, SCENE_PALETTE)

    with (SRC / "frame-index.csv").open("w", newline="") as f:
        csv.writer(f).writerows(index_rows)

    report["sprite_colors"] = len(SPRITE_PALETTE)
    report["scene_colors"] = len(SCENE_PALETTE)
    (SRC / "export-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


if __name__ == "__main__":
    print(json.dumps(export_all(), indent=2))


