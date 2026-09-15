#!/usr/bin/env python3
"""Author the Iron & Amber Arcade 16-bit sprite package.

Native character canvas is 80x80, then nearest-neighbor 4x.
Palette is SNES/Genesis-sized. Alpha is binary. No chroma key.

Craft notes (visual only — not feel / judging):
- Limbs are banded cylinders, not radial clay sausages.
- Quads, delts, and traps are separate volumes.
- Light vs max attempts use different pose tables and plate stacks.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "sprites"
EVIDENCE = ROOT / "evidence" / "visual-after"
SCALE = 4
CW = 80
CH = 80

# --- palette (SNES-sized; no magenta/purple chroma) ---
OUTLINE = (12, 10, 8)
IRON0 = (20, 17, 15)
IRON1 = (42, 34, 28)
IRON2 = (74, 58, 46)
IRON3 = (110, 88, 68)
AMBER0 = (138, 74, 24)
AMBER1 = (212, 137, 42)
AMBER2 = (243, 197, 106)
SKIN0 = (92, 56, 38)
SKIN1 = (176, 114, 76)
SKIN2 = (222, 164, 114)
SKIN3 = (240, 198, 150)
FLUSH0 = (124, 58, 42)
FLUSH1 = (156, 78, 54)
HAIR0 = (36, 26, 20)
HAIR1 = (68, 48, 34)
SING0 = (28, 26, 34)
SING1 = (52, 48, 62)
SING2 = (86, 80, 98)
BELT = (16, 14, 12)
BUCKLE = (196, 168, 88)
SHOE0 = (22, 20, 20)
SHOE1 = (48, 44, 44)
CHALK = (236, 230, 218)
BAR0 = (112, 112, 120)
BAR1 = (196, 196, 204)
STEEL = (70, 70, 78)
RED = (176, 40, 36)
BLUE = (40, 72, 160)
YELLOW = (212, 176, 40)
GREEN = (36, 124, 60)
BLACKP = (28, 28, 32)
WOOD0 = (92, 62, 34)
WOOD1 = (138, 96, 52)
WOOD2 = (176, 132, 78)
TAPE = (232, 224, 204)
BRICK0 = (46, 30, 26)
BRICK1 = (64, 42, 34)
BRICK2 = (82, 54, 42)
CROWD0 = (34, 26, 24)
CROWD1 = (56, 40, 34)

# Craft constants — visual only. Tuned by hand later. Not feel / judging.
HEAD_W = 16
HEAD_H = 13
LIMB_THIGH = 5
LIMB_CALF = 4
LIMB_ARM = 3
LIMB_STRAIN_BONUS = 1
MAX_MASS_BONUS = 0
BELT_H = 4
WRAP_H = 3

SQUAT_STRAIN = {"light": frozenset({2, 3}), "max": frozenset({1, 2, 3, 4, 5})}
BENCH_STRAIN = {"light": frozenset({2, 3}), "max": frozenset({1, 2, 3, 4, 5})}
DEAD_STRAIN = {"light": frozenset({1, 2}), "max": frozenset({0, 1, 2, 3, 4})}

SQUAT_DROP = {
    "light": (0, 5, 10, 7, 3, 0),
    "max": (1, 7, 12, 9, 5, 1),
}
SQUAT_WIDE = {
    "light": (4, 6, 10, 8, 5, 4),
    "max": (5, 8, 11, 9, 6, 5),
}
SQUAT_LEAN = {
    "light": (0, 1, 3, 2, 1, 0),
    "max": (1, 3, 5, 4, 2, 1),
}
DEAD_BAR_Y = {
    "light": (68, 60, 54, 49, 46, 44),
    "max": (70, 64, 58, 52, 48, 44),
}
DEAD_HIP_Y = {
    "light": (58, 56, 54, 52, 51, 50),
    "max": (62, 60, 57, 54, 52, 49),
}
DEAD_SH_X = {
    "light": (50, 47, 44, 41, 39, 37),
    "max": (52, 50, 47, 43, 40, 37),
}
DEAD_SH_Y = {
    "light": (42, 38, 34, 32, 31, 29),
    "max": (46, 42, 38, 34, 32, 28),
}
BENCH_BAR_Y = {
    "light": (20, 28, 36, 30, 24, 18),
    "max": (22, 32, 42, 36, 28, 17),
}
BENCH_ARCH = {
    "light": (0, 1, 1, 1, 0, 0),
    "max": (1, 2, 3, 2, 1, 0),
}

PLATE_LOADS = {
    "light": [(7, GREEN), (6, YELLOW)],
    "meet": [(9, RED), (7, BLUE), (6, YELLOW)],
    "max": [(10, RED), (9, RED), (8, BLUE), (6, YELLOW)],
}

FACE_PAL = {
    "H": HAIR0,
    "h": HAIR1,
    "S": SKIN1,
    "s": SKIN2,
    "L": SKIN3,
    "D": SKIN0,
    "F": FLUSH1,
    "f": FLUSH0,
    "E": CHALK,
    "l": HAIR0,
    "n": SKIN0,
    "m": HAIR0,
    "T": CHALK,
    "e": SKIN1,
    "V": FLUSH0,
    "B": HAIR0,
    "W": CHALK,
    "o": SKIN0,
}

PROFILE_OK = [
    "   hhhhhhhh    ",
    "  hhHHHHHHhh   ",
    " hhHHSLLSSShh  ",
    "ehHSSEElDSSSs  ",
    "eeHSSSo nSSnL  ",
    " eSSSSSSSSSss  ",
    "  SSSSmmmmSSs  ",
    "  sSSSSSSSSS   ",
    "   sSSSSSSs    ",
    "    nSSSn      ",
    "    nSSSn      ",
    "     nnn       ",
]
PROFILE_STRAIN = [
    "   hhhhhhhh    ",
    "  hhHHHHHHhh   ",
    " hhHHBBLLSShh  ",
    "ehHSBllfFDSSs  ",
    "eeHFFfo nSSnL  ",
    " eSSFfSTTTTTs  ",
    "  SSFmWWWWWm   ",
    "  sFFfSSSSSS   ",
    "   FSSSSfF     ",
    "    nVVVn      ",
    "    nSSSn      ",
    "     nnn       ",
]
PROFILE_MISS = [
    "   hhhhhhhh    ",
    "  hhHHHHHHhh   ",
    " hhHHBBLLSShh  ",
    "ehHSSSBBlSSSs  ",
    "eeHSSSo nSSnL  ",
    " eSSSSSSSSSss  ",
    "  SSSS    mSs  ",
    "  sSSSSSSSSS   ",
    "   sSSSSSSs    ",
    "    nSSSn      ",
    "    nSSSn      ",
    "     nnn       ",
]
PROFILE_GRIN = [
    "   hhhhhhhh    ",
    "  hhHHHHHHhh   ",
    " hhHHSLLSSShh  ",
    "ehHSSEElDSSSs  ",
    "eeHSSSo nSSnL  ",
    " eSSSSSSSSSss  ",
    "  SSSSTTmmTTs  ",
    "  sSSSSSSSSS   ",
    "   sSSSSSSs    ",
    "    nSSSn      ",
    "    nSSSn      ",
    "     nnn       ",
]
FRONT_OK = [
    "   hhhhhhhhh   ",
    "  hhHHHHHHHhh  ",
    " hHHSLLLLSSHHh ",
    "ehSSEElSSEElSse",
    "eeSSSSsoNsSSSse",
    " hSSSSmmmmSSSs ",
    "  sSSSSSSSSSs  ",
    "   sSSSSSSSs   ",
    "    nnnnnnn    ",
    "     nnnnn     ",
]
FRONT_STRAIN = [
    "   hhhhhhhhh   ",
    "  hhHHHHHHHhh  ",
    " hHHBBLLLBBHHh ",
    "ehSFBllSSBllFse",
    "eeSFfSsoNsFfSse",
    " hSSSTWWWWTSSs ",
    "  SSFmWWWWmFS  ",
    "   FSSSSSSfF   ",
    "    nVVnnVV    ",
    "     nnnnn     ",
]


class C:
    def __init__(self, w: int, h: int) -> None:
        self.w = w
        self.h = h
        self.p: list[list[tuple[int, int, int] | None]] = [[None for _ in range(w)] for _ in range(h)]

    def ok(self, x: int, y: int) -> bool:
        return 0 <= x < self.w and 0 <= y < self.h

    def set(self, x: int, y: int, col: tuple[int, int, int] | None) -> None:
        if col is None or not self.ok(x, y):
            return
        self.p[y][x] = col

    def get(self, x: int, y: int) -> tuple[int, int, int] | None:
        return self.p[y][x] if self.ok(x, y) else None

    def fill(self, col: tuple[int, int, int]) -> None:
        for y in range(self.h):
            for x in range(self.w):
                self.p[y][x] = col

    def rect(self, x: int, y: int, w: int, h: int, col: tuple[int, int, int]) -> None:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.set(xx, yy, col)

    def stamp(self, x: int, y: int, rows: list[str], pal: dict[str, tuple[int, int, int]]) -> None:
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                col = pal.get(ch)
                if col is not None:
                    self.set(x + i, y + j, col)

    def band(self, x: int, y: int, u: float, dark: tuple[int, int, int], mid: tuple[int, int, int], light: tuple[int, int, int]) -> tuple[int, int, int]:
        dith = ((x ^ y) & 1) == 0
        if u > 0.34:
            return light if not (u < 0.42 and dith) else mid
        if u < -0.34:
            return dark if not (u > -0.42 and dith) else mid
        return mid

    def disc(self, cx: int, cy: int, r: int, mid: tuple[int, int, int], hi: tuple[int, int, int] | None = None) -> None:
        self.banded_disc(cx, cy, r, mid, mid, hi or mid)

    def banded_disc(self, cx: int, cy: int, r: int, dark: tuple[int, int, int], mid: tuple[int, int, int], light: tuple[int, int, int]) -> None:
        for y in range(cy - r, cy + r + 1):
            for x in range(cx - r, cx + r + 1):
                dx, dy = x - cx, y - cy
                if dx * dx + dy * dy <= r * r:
                    if r <= 1:
                        self.set(x, y, mid)
                        continue
                    u = (-dx - dy) / float(r)
                    self.set(x, y, self.band(x, y, u, dark, mid, light))

    def banded_oval(self, cx: int, cy: int, rx: int, ry: int, dark: tuple[int, int, int], mid: tuple[int, int, int], light: tuple[int, int, int]) -> None:
        rx = max(1, rx)
        ry = max(1, ry)
        for y in range(cy - ry, cy + ry + 1):
            for x in range(cx - rx, cx + rx + 1):
                u = (x - cx) / rx
                v = (y - cy) / ry
                if u * u + v * v <= 1.0:
                    self.set(x, y, self.band(x, y, -u - v, dark, mid, light))

    def banded_capsule(
        self,
        x0: int,
        y0: int,
        x1: int,
        y1: int,
        r: int,
        dark: tuple[int, int, int],
        mid: tuple[int, int, int],
        light: tuple[int, int, int],
        cap_start: bool = True,
        cap_end: bool = True,
    ) -> None:
        r = max(1, r)
        dx = x1 - x0
        dy = y1 - y0
        length = max((dx * dx + dy * dy) ** 0.5, 1.0)
        nx, ny = -dy / length, dx / length
        minx = min(x0, x1) - r - 1
        maxx = max(x0, x1) + r + 1
        miny = min(y0, y1) - r - 1
        maxy = max(y0, y1) + r + 1
        for y in range(miny, maxy + 1):
            for x in range(minx, maxx + 1):
                t = ((x - x0) * dx + (y - y0) * dy) / (length * length)
                px = x - (x0 + dx * (0 if t < 0 else 1 if t > 1 else t))
                py = y - (y0 + dy * (0 if t < 0 else 1 if t > 1 else t))
                if t < 0:
                    if not cap_start or px * px + py * py > r * r:
                        continue
                elif t > 1:
                    if not cap_end or px * px + py * py > r * r:
                        continue
                elif px * px + py * py > r * r:
                    continue
                cyl = (px * nx + py * ny) / r
                self.set(x, y, self.band(x, y, cyl + (-px - py) / (r * 4), dark, mid, light))

    def banded_trap(
        self,
        top_x: int,
        top_y: int,
        top_w: int,
        bot_x: int,
        bot_y: int,
        bot_w: int,
        dark: tuple[int, int, int],
        mid: tuple[int, int, int],
        light: tuple[int, int, int],
    ) -> None:
        if bot_y < top_y:
            top_y, bot_y = bot_y, top_y
            top_x, bot_x = bot_x, top_x
            top_w, bot_w = bot_w, top_w
        span = max(bot_y - top_y, 1)
        for y in range(top_y, bot_y + 1):
            t = (y - top_y) / span
            cx = int(round(top_x + (bot_x - top_x) * t))
            w = max(3, int(round(top_w + (bot_w - top_w) * t)))
            left = cx - w // 2
            for x in range(left, left + w):
                u = 0.5 if w <= 1 else (x - left) / (w - 1)
                shade = 0.7 - u * 1.4
                self.set(x, y, self.band(x, y, shade, dark, mid, light))

    def outline(self) -> None:
        marks: list[tuple[int, int]] = []
        for y in range(self.h):
            for x in range(self.w):
                if self.p[y][x] is not None:
                    continue
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if self.ok(nx, ny) and self.p[ny][nx] is not None:
                        marks.append((x, y))
                        break
        for x, y in marks:
            self.p[y][x] = OUTLINE

    def image(self, scale: int = SCALE) -> Image.Image:
        im = Image.new("RGBA", (self.w, self.h), (0, 0, 0, 0))
        pix = im.load()
        assert pix is not None
        for y in range(self.h):
            for x in range(self.w):
                col = self.p[y][x]
                if col is not None:
                    pix[x, y] = (col[0], col[1], col[2], 255)
        if scale != 1:
            im = im.resize((self.w * scale, self.h * scale), Image.NEAREST)
        return im


def sweat(c: C, x: int, y: int) -> None:
    c.set(x, y, CHALK)
    c.set(x, y + 1, CHALK)
    c.set(x + 1, y + 1, CHALK)


def chalk_puff(c: C, x: int, y: int) -> None:
    for px, py in ((0, 0), (1, -1), (2, 0), (1, 1), (-1, 0), (3, -1), (0, -2)):
        c.set(x + px, y + py, CHALK if (px + py) & 1 == 0 else TAPE)


def head_profile(c: C, x: int, y: int, mode: str = "ok") -> None:
    rows = {
        "ok": PROFILE_OK,
        "strain": PROFILE_STRAIN,
        "miss": PROFILE_MISS,
        "grin": PROFILE_GRIN,
    }.get(mode, PROFILE_OK)
    dark, mid, light = (FLUSH0, SKIN1, SKIN2) if mode == "strain" else (SKIN0, SKIN1, SKIN2)
    c.banded_oval(x + 8, y + 6, 6, 6, dark, mid, light)
    c.stamp(x, y, rows, FACE_PAL)
    if mode == "strain":
        sweat(c, x + 14, y + 1)
        sweat(c, x + 2, y + 3)


def head_front(c: C, x: int, y: int, mode: str = "ok") -> None:
    rows = FRONT_STRAIN if mode == "strain" else FRONT_OK
    dark, mid, light = (FLUSH0, SKIN1, SKIN2) if mode == "strain" else (SKIN0, SKIN1, SKIN2)
    c.banded_oval(x + 8, y + 5, 7, 6, dark, mid, light)
    c.stamp(x, y, rows, FACE_PAL)
    if mode == "strain":
        sweat(c, x + 15, y)
        sweat(c, x + 1, y + 2)


def shoe(c: C, x: int, y: int, facing: int = 1) -> None:
    if facing >= 0:
        c.rect(x, y + 1, 13, 4, SHOE0)
        c.rect(x + 1, y, 9, 3, SHOE1)
        c.rect(x + 9, y + 2, 5, 3, SHOE0)
        c.rect(x, y + 4, 13, 2, OUTLINE)
        c.rect(x + 1, y + 3, 3, 2, IRON1)
        c.rect(x + 4, y + 3, 3, 1, AMBER0)
        c.set(x + 7, y + 1, STEEL)
        c.set(x + 5, y + 1, BAR1)
    else:
        c.rect(x, y + 1, 13, 4, SHOE0)
        c.rect(x + 3, y, 9, 3, SHOE1)
        c.rect(x, y + 2, 5, 3, SHOE0)
        c.rect(x, y + 4, 13, 2, OUTLINE)
        c.rect(x + 9, y + 3, 3, 2, IRON1)
        c.rect(x + 6, y + 3, 3, 1, AMBER0)
        c.set(x + 5, y + 1, STEEL)
        c.set(x + 7, y + 1, BAR1)


def shoe_front(c: C, x: int, y: int) -> None:
    c.rect(x, y + 1, 11, 4, SHOE0)
    c.rect(x + 1, y, 9, 3, SHOE1)
    c.rect(x, y + 4, 11, 2, OUTLINE)
    c.rect(x + 3, y + 3, 4, 1, AMBER0)
    c.rect(x + 1, y + 3, 2, 2, IRON1)
    c.set(x + 5, y + 1, STEEL)


def wrap(c: C, x: int, y: int, w: int, h: int = WRAP_H) -> None:
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if yy == y:
                c.set(xx, yy, TAPE if (xx + yy) & 1 else AMBER2)
            elif yy == y + h - 1:
                c.set(xx, yy, AMBER0)
            else:
                c.set(xx, yy, AMBER1 if (xx + yy) & 1 else TAPE)


def sleeve(c: C, x: int, y: int, w: int, h: int = 5) -> None:
    c.rect(x, y, w, h, SING0)
    c.rect(x + 1, y + 1, max(1, w - 2), h - 2, SING1)
    c.rect(x, y + h - 1, w, 1, AMBER0)


def hand(c: C, x: int, y: int, grip: bool = False) -> None:
    wrap(c, x, y + 2, 3, 2)
    c.rect(x, y, 4, 3, SKIN1)
    c.set(x + 1, y + 1, SKIN2)
    c.set(x + 3, y, SKIN2)
    c.set(x + 2, y + 2, SKIN0)
    if grip:
        c.set(x + 1, y - 1, SKIN1)
        c.set(x + 2, y - 1, CHALK)
        c.set(x + 3, y - 1, SKIN0)
    else:
        c.set(x + 4, y + 1, SKIN2)
        c.set(x + 3, y + 2, CHALK)


def singlet(
    c: C,
    top_x: int,
    top_y: int,
    top_w: int,
    bot_x: int,
    bot_y: int,
    bot_w: int,
    strain: bool = False,
) -> None:
    c.banded_trap(top_x, top_y, top_w, bot_x, bot_y, bot_w, SING0, SING1, SING2)
    span = max(bot_y - top_y, 1)
    for y in range(top_y, bot_y + 1):
        t = (y - top_y) / span
        cx = int(round(top_x + (bot_x - top_x) * t))
        w = max(3, int(round(top_w + (bot_w - top_w) * t)))
        c.set(cx + w // 2 - 1, y, AMBER1 if y % 2 == 0 else AMBER2)
        c.set(cx + w // 2 - 2, y, AMBER0)
        if strain and (y + cx) % 4 == 0:
            c.set(cx - 1, y, SING0)
            c.set(cx, y, SING0)
    strap_w = 2
    c.rect(top_x - top_w // 2 + 3, top_y - 3, strap_w, 4, SING2)
    c.rect(top_x + top_w // 2 - 5, top_y - 3, strap_w, 4, SING2)
    neck = max(3, top_w - 10)
    c.rect(top_x - neck // 2, top_y, neck, 1, SKIN1)
    if strain:
        c.rect(top_x - 3, top_y + span // 3, 6, 1, SING0)


def belt(c: C, x: int, y: int, w: int, cinch: bool = False) -> None:
    h = BELT_H if cinch else 3
    c.rect(x, y, w, h, BELT)
    for xx in range(x + 1, x + w - 1, 2):
        c.set(xx, y + 1, IRON1)
        if h > 3:
            c.set(xx + 1, y + 2, IRON2)
    c.rect(x + w // 2 - 2, y, 5, h, BUCKLE)
    c.rect(x + w // 2 - 1, y + 1, 3, max(1, h - 2), AMBER1)
    if cinch:
        c.rect(x, y, 1, h, OUTLINE)
        c.rect(x + w - 1, y, 1, h, OUTLINE)
        c.rect(x + 2, y - 1, w - 4, 1, IRON0)


def plate(c: C, cx: int, cy: int, r: int, color: tuple[int, int, int]) -> None:
    inner = max(1, r - 2)
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy)
            if d2 > r * r:
                continue
            if d2 > inner * inner:
                c.set(x, y, color if not ((x ^ y) & 1) else STEEL)
            else:
                lit = (-(x - cx) - (y - cy)) / float(max(r, 1))
                if lit > 0.45:
                    c.set(x, y, STEEL if (x + y) & 1 else BLACKP)
                elif lit < -0.3:
                    c.set(x, y, IRON0)
                else:
                    c.set(x, y, BLACKP)
    hub = max(2, r // 3)
    c.banded_disc(cx, cy, hub, STEEL, BAR0, BAR1)
    for y in range(cy - r + 1, cy + r):
        for x in range(cx + r - 4, cx + r + 1):
            d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy)
            if inner * inner < d2 <= r * r:
                c.set(x, y, color)


def bar(c: C, x0: int, x1: int, y: int, loaded: str = "meet", bend: int = 0) -> None:
    if bend:
        mid = (x0 + x1) // 2
        for x in range(x0, x1 + 1):
            t = abs(x - mid) / max((x1 - x0) / 2, 1)
            yy = y + int(round(bend * (1 - t * t)))
            c.set(x, yy - 1, BAR0)
            c.set(x, yy, BAR1)
            c.set(x, yy + 1, BAR0)
            if 10 < x < x1 - 10 and x % 2 == 0:
                c.set(x, yy - 1, STEEL)
    else:
        c.rect(x0, y - 1, x1 - x0, 3, BAR0)
        c.rect(x0, y, x1 - x0, 1, BAR1)
        for x in range(x0 + 10, x1 - 10, 2):
            c.set(x, y - 1, STEEL)
    stack = PLATE_LOADS[loaded]
    ox = 0
    for r, col in stack:
        plate(c, x0 - 2 - ox, y + (bend if bend else 0) // 2, r, col)
        plate(c, x1 + 2 + ox, y + (bend if bend else 0) // 2, r, col)
        ox += max(3, r // 3 + 2)
    c.rect(x0 + 1, y - 2, 2, 5, BAR1)
    c.rect(x1 - 3, y - 2, 2, 5, BAR1)


def skin_tones(strain: bool) -> tuple[tuple[int, int, int], tuple[int, int, int], tuple[int, int, int]]:
    if strain:
        return FLUSH0, SKIN1, SKIN3
    return SKIN0, SKIN1, SKIN2


def mass(load: str, strain: bool, base: int) -> int:
    extra = (MAX_MASS_BONUS if load == "max" else 0) + (LIMB_STRAIN_BONUS if strain else 0)
    return base + extra


def traps(c: C, sh_x: int, sh_y: int, dark: tuple[int, int, int], mid: tuple[int, int, int], light: tuple[int, int, int], wide: bool) -> None:
    rx = 7 if wide else 5
    c.banded_oval(sh_x, sh_y + 1, rx, 3, dark, mid, light)


def delts(
    c: C,
    sh_x: int,
    sh_y: int,
    dark: tuple[int, int, int],
    mid: tuple[int, int, int],
    light: tuple[int, int, int],
    far_d: tuple[int, int, int],
    far_m: tuple[int, int, int],
    far_l: tuple[int, int, int],
    bulky: bool,
) -> None:
    r = 4 if bulky else 3
    c.banded_disc(sh_x - 7, sh_y + 3, r, far_d, far_m, far_l)
    c.banded_disc(sh_x + 7, sh_y + 3, r, dark, mid, light)


def quad_bulge(c: C, x: int, y: int, dark: tuple[int, int, int], mid: tuple[int, int, int], light: tuple[int, int, int], bulky: bool) -> None:
    c.banded_oval(x, y, 4 if bulky else 3, 5 if bulky else 4, dark, mid, light)


def lifter_stand(c: C, x: int, y: int, mode: str = "ok", arms: str = "down") -> None:
    hip_y = y - 24
    sh_y = y - 42
    strain = mode == "strain"
    dark, mid, light = skin_tones(strain)
    far_d, far_m, far_l = SKIN0, SKIN1, SKIN0
    r_th = mass("light", strain, LIMB_THIGH)
    r_arm = mass("light", strain, LIMB_ARM)
    c.banded_capsule(x - 4, hip_y + 2, x - 7, y - 11, r_th, far_d, far_m, far_l, False, True)
    c.banded_capsule(x - 7, y - 11, x - 8, y - 2, LIMB_CALF, far_d, far_m, far_l, False, True)
    shoe(c, x - 16, y - 2, -1)
    sleeve(c, x - 10, y - 14, 7)
    wrap(c, x - 9, y - 8, 6)
    c.banded_capsule(x + 4, hip_y + 2, x + 7, y - 11, r_th, dark, mid, light, False, True)
    quad_bulge(c, x + 7, hip_y + 8, dark, mid, light, strain)
    c.banded_capsule(x + 7, y - 11, x + 7, y - 2, LIMB_CALF, dark, mid, light, False, True)
    shoe(c, x + 2, y - 2, 1)
    sleeve(c, x + 4, y - 14, 7)
    wrap(c, x + 5, y - 8, 6)
    singlet(c, x, sh_y, 18, x, hip_y, 14, strain)
    traps(c, x, sh_y, dark, mid, light, False)
    delts(c, x, sh_y, dark, mid, light, far_d, far_m, far_l, strain)
    belt(c, x - 8, hip_y - 1, 16, strain)
    if arms == "down":
        c.banded_capsule(x - 8, sh_y + 4, x - 11, sh_y + 20, r_arm, far_d, far_m, far_l, False, True)
        hand(c, x - 13, sh_y + 19)
        c.banded_capsule(x + 8, sh_y + 4, x + 11, sh_y + 20, r_arm, dark, mid, light, False, True)
        hand(c, x + 10, sh_y + 19)
    elif arms == "rack":
        c.banded_capsule(x - 8, sh_y + 4, x - 15, sh_y + 11, r_arm, far_d, far_m, far_l, False, True)
        hand(c, x - 17, sh_y + 9, True)
        c.banded_capsule(x + 8, sh_y + 4, x + 15, sh_y + 11, r_arm, dark, mid, light, False, True)
        hand(c, x + 15, sh_y + 9, True)
    elif arms == "up":
        c.banded_capsule(x - 8, sh_y + 4, x - 13, sh_y - 11, r_arm, far_d, mid, light, False, True)
        hand(c, x - 15, sh_y - 14)
        c.banded_capsule(x + 8, sh_y + 4, x + 13, sh_y - 11, r_arm, dark, mid, light, False, True)
        hand(c, x + 12, sh_y - 14)
    elif arms == "out":
        c.banded_capsule(x + 8, sh_y + 4, x + 17, sh_y + 8, r_arm, dark, mid, light, False, True)
        hand(c, x + 17, sh_y + 6)
        c.banded_capsule(x - 8, sh_y + 4, x - 17, sh_y + 8, r_arm, far_d, far_m, far_l, False, True)
        hand(c, x - 20, sh_y + 6)
    face = "strain" if strain else "miss" if mode == "miss" else "grin" if mode == "grin" else "ok"
    c.banded_capsule(x, sh_y, x + 1, sh_y - 3, 2, dark, mid, light, False, False)
    head_profile(c, x - 5, sh_y - 15, face)


def squat(c: C, phase: int, load: str = "light") -> None:
    drop = SQUAT_DROP[load][phase]
    wide = SQUAT_WIDE[load][phase]
    lean = SQUAT_LEAN[load][phase]
    x, foot = 40, 74
    hip_y = foot - 24 + drop
    sh_y = foot - 44 + drop + lean
    sh_x = x + lean
    hip_x = x - lean // 2
    strain = phase in SQUAT_STRAIN[load]
    dark, mid, light = skin_tones(strain)
    far_d, far_m, far_l = SKIN0, SKIN1, SKIN0
    r_th = mass(load, strain, LIMB_THIGH)
    r_arm = mass(load, strain, LIMB_ARM)
    bend = 2 if load == "max" and phase in (2, 3) else 0
    bar(c, 8, 72, sh_y - 3, "max" if load == "max" else "light", bend)
    knee_y = foot - 15 + drop // 5
    c.banded_capsule(hip_x - 4, hip_y + 2, hip_x - 7 - wide, knee_y, r_th, far_d, far_m, far_l, False, True)
    c.banded_capsule(hip_x - 7 - wide, knee_y, hip_x - 8 - wide // 2, foot - 2, LIMB_CALF, far_d, far_m, far_l, False, True)
    shoe(c, hip_x - 17 - wide // 2, foot - 2, -1)
    sleeve(c, hip_x - 10 - wide, knee_y - 2, 8)
    wrap(c, hip_x - 9 - wide, knee_y + 3, 6)
    c.banded_capsule(hip_x + 4, hip_y + 2, hip_x + 9 + wide, knee_y, r_th, dark, mid, light, False, True)
    quad_bulge(c, hip_x + 7 + wide // 2, (hip_y + knee_y) // 2 + 1, dark, mid, light, load == "max" or strain)
    c.banded_capsule(hip_x + 9 + wide, knee_y, hip_x + 8 + wide // 2, foot - 2, LIMB_CALF, dark, mid, light, False, True)
    shoe(c, hip_x + 3 + wide // 2, foot - 2, 1)
    sleeve(c, hip_x + 6 + wide, knee_y - 2, 8)
    wrap(c, hip_x + 7 + wide, knee_y + 3, 6)
    tw = 20 if load == "max" else 18
    bw = 16 if load == "max" else 14
    singlet(c, sh_x, sh_y, tw, hip_x, hip_y, bw, strain)
    traps(c, sh_x, sh_y, dark, mid, light, load == "max")
    delts(c, sh_x, sh_y, dark, mid, light, far_d, far_m, far_l, load == "max" or strain)
    belt(c, hip_x - 8, hip_y, 16, strain or load == "max")
    c.banded_capsule(sh_x - 8, sh_y + 5, sh_x - 15, sh_y + 10, r_arm, far_d, far_m, far_l, False, True)
    hand(c, sh_x - 17, sh_y + 8, True)
    c.banded_capsule(sh_x + 8, sh_y + 5, sh_x + 15, sh_y + 10, r_arm, dark, mid, light, False, True)
    hand(c, sh_x + 15, sh_y + 8, True)
    if load == "max" and phase in (2, 3):
        chalk_puff(c, sh_x + 16, sh_y + 2)
        chalk_puff(c, sh_x - 18, sh_y + 4)
    c.banded_capsule(sh_x, sh_y, sh_x + 1, sh_y - 3, 2, dark, mid, light, False, False)
    head_profile(c, sh_x - 5, sh_y - 15, "strain" if strain else "ok")


def deadlift(c: C, phase: int, load: str = "light") -> None:
    x, foot = 40, 74
    bar_y = DEAD_BAR_Y[load][phase]
    hip_y = DEAD_HIP_Y[load][phase]
    sh_x = DEAD_SH_X[load][phase]
    sh_y = DEAD_SH_Y[load][phase]
    hinge = phase <= 2
    strain = phase in DEAD_STRAIN[load]
    dark, mid, light = skin_tones(strain)
    far_d, far_m, far_l = SKIN0, SKIN1, SKIN0
    r_th = mass(load, strain, LIMB_THIGH)
    r_arm = mass(load, strain, LIMB_ARM)
    bend = 3 if load == "max" and phase <= 3 else 0
    bar(c, 8, 72, bar_y, "max" if load == "max" else "light", bend)
    c.banded_capsule(x - 5, hip_y + 2, x - 7, foot - 11, r_th, far_d, far_m, far_l, False, True)
    c.banded_capsule(x - 7, foot - 11, x - 8, foot - 2, LIMB_CALF, far_d, far_m, far_l, False, True)
    shoe(c, x - 16, foot - 2, -1)
    sleeve(c, x - 10, foot - 16, 7)
    wrap(c, x - 9, foot - 10, 6)
    c.banded_capsule(x + 3, hip_y + 2, x + 6, foot - 11, r_th, dark, mid, light, False, True)
    quad_bulge(c, x + 7, hip_y + 7, dark, mid, light, load == "max" or strain)
    c.banded_capsule(x + 6, foot - 11, x + 7, foot - 2, LIMB_CALF, dark, mid, light, False, True)
    shoe(c, x + 2, foot - 2, 1)
    sleeve(c, x + 4, foot - 16, 7)
    wrap(c, x + 5, foot - 10, 6)
    tw = 18 if load == "max" else 16
    singlet(c, sh_x, sh_y, tw, x, hip_y, 14, strain)
    traps(c, sh_x, sh_y, dark, mid, light, load == "max")
    delts(c, sh_x, sh_y, dark, mid, light, far_d, far_m, far_l, load == "max" or strain)
    belt(c, x - 8, hip_y - 1, 16, strain or load == "max")
    c.banded_capsule(sh_x - 6, sh_y + 6, 26, bar_y, r_arm, far_d, far_m, far_l, False, True)
    c.banded_capsule(sh_x + 6, sh_y + 6, 52, bar_y, r_arm, dark, mid, light, False, True)
    hand(c, 24, bar_y - 1, True)
    hand(c, 51, bar_y - 1, True)
    head_x = sh_x + (1 if hinge else -5)
    head_y = sh_y - (13 if hinge else 15)
    head_x = min(max(head_x, 1), CW - HEAD_W - 1)
    head_y = min(max(head_y, 1), CH - HEAD_H - 4)
    c.banded_capsule(sh_x + 1, sh_y, head_x + 7, head_y + HEAD_H - 1, 2, dark, mid, light, False, False)
    if load == "max" and phase in (1, 2, 3):
        chalk_puff(c, 22, bar_y - 6)
        chalk_puff(c, 54, bar_y - 5)
    head_profile(c, head_x, head_y, "strain" if strain else "ok")


def bench(c: C, phase: int, load: str = "light") -> None:
    bar_y = BENCH_BAR_Y[load][phase]
    arch = BENCH_ARCH[load][phase]
    strain = phase in BENCH_STRAIN[load]
    dark, mid, light = skin_tones(strain)
    c.rect(7, 14, 5, 52, IRON2)
    c.rect(68, 14, 5, 52, IRON2)
    c.rect(5, 64, 9, 4, IRON1)
    c.rect(66, 64, 9, 4, IRON1)
    c.rect(7, 22, 7, 3, IRON3)
    c.rect(66, 22, 7, 3, IRON3)
    c.rect(16, 46 - arch, 48, 7, IRON2)
    c.rect(18, 44 - arch, 44, 3, IRON3)
    c.rect(36, 52 - arch, 7, 16, IRON1)
    c.rect(29, 66, 20, 4, IRON2)
    torso_y = 38 - arch
    for xx in range(20, 58):
        for yy in range(torso_y, torso_y + 9):
            t = (xx - 20) / 38.0
            fold = strain and (xx + yy) % 5 == 0
            if t < 0.18:
                col = SING2 if (xx + yy) & 1 else SING1
            elif t > 0.78:
                col = SING0 if (xx + yy) & 1 else SING1
            else:
                col = SING2 if (xx ^ yy) & 1 else SING1
            if fold:
                col = SING0
            c.set(xx, yy, col)
    c.rect(20, torso_y - 1, 2, 6, SING2)
    c.rect(54, torso_y - 1, 2, 6, SING2)
    c.rect(36, torso_y - 1, 3, 10, AMBER1)
    c.set(37, torso_y + 1, AMBER2)
    belt(c, 32, torso_y + 6, 14, strain or load == "max")
    c.banded_capsule(56, 44, 66, 54, 4, SKIN0, SKIN1, SKIN0)
    c.banded_capsule(66, 54, 68, 68, 3, SKIN0, SKIN1, SKIN0)
    shoe_front(c, 64, 66)
    sleeve(c, 63, 51, 6)
    wrap(c, 63, 57, 5)
    c.banded_capsule(54, 44, 62, 56, 4, dark, mid, light)
    c.banded_capsule(62, 56, 64, 68, 3, dark, mid, light)
    shoe_front(c, 60, 66)
    sleeve(c, 59, 53, 6)
    wrap(c, 59, 59, 5)
    r_arm = mass(load, strain, LIMB_ARM)
    flare = 2 if load == "max" and phase in (2, 3) else 0
    c.banded_capsule(26, 40, 22 - flare, bar_y, r_arm, dark, mid, light)
    c.banded_capsule(48, 40, 56 + flare, bar_y, r_arm, dark, mid, light)
    c.banded_disc(24, 38, 3, dark, mid, light)
    c.banded_disc(50, 38, 3, dark, mid, light)
    hand(c, 20 - flare, bar_y - 1, True)
    hand(c, 54 + flare, bar_y - 1, True)
    c.banded_capsule(22, 38, 18, 35, 3, dark, mid, light)
    bend = 2 if load == "max" and phase in (2, 3) else 0
    bar(c, 10, 70, bar_y, "max" if load == "max" else "light", bend)
    if load == "max" and phase in (2, 3):
        chalk_puff(c, 28, bar_y - 5)
    head_front(c, 24, 28 - arch, "strain" if strain else "ok")


def idle(c: C, i: int) -> None:
    lifter_stand(c, 40, 74, "ok", "down")
    if i % 2:
        c.rect(32, 33, 14, 1, SING2)


def success(c: C, i: int) -> None:
    arms = ["out", "out", "up", "up"][i]
    lifter_stand(c, 40, 74, "grin", arms)
    if i >= 2:
        for pt in ((58, 16), (61, 14), (63, 17), (56, 13), (60, 12), (64, 15)):
            c.set(*pt, CHALK)


def miss(c: C, i: int) -> None:
    x = 40 + i
    lifter_stand(c, x, 74, "miss", "down")
    c.rect(x - 2, 20, 8, 1, HAIR0)


def plates_prop(c: C, i: int) -> None:
    c.rect(38, 12, 4, 56, IRON2)
    c.rect(28, 66, 24, 4, IRON1)
    cols = [RED, BLUE, YELLOW, GREEN, CHALK, STEEL]
    for n, y in enumerate((20, 32, 44, 56)):
        plate(c, 32, y, 8 - n, cols[(i + n) % 6])
        plate(c, 48, y, 8 - n, cols[(i + n + 2) % 6])


def crowd_figure(c: C, x: int, y: int, shade: tuple[int, int, int]) -> None:
    c.banded_oval(x, y, 4, 4, CROWD0, shade, IRON3)
    c.rect(x - 5, y + 4, 11, 10, shade)
    c.rect(x - 6, y + 6, 4, 6, CROWD0)
    c.rect(x + 3, y + 6, 4, 6, CROWD0)
    if (x + y) % 3 == 0:
        c.set(x - 1, y + 1, AMBER0)


def crowd_bank(c: C, y: int, w: int, rows: int = 2) -> None:
    for row in range(rows):
        yy = y + row * 7
        stagger = 5 if row % 2 else 0
        for i, x in enumerate(range(6 + stagger, w - 8, 9)):
            shade = CROWD1 if (i + row) % 2 == 0 else CROWD0
            crowd_figure(c, x, yy, shade)


def platform_scene(w: int = 320, h: int = 180) -> C:
    c = C(w, h)
    c.fill(IRON0)
    for y in range(8, 104, 8):
        stagger = 8 if (y // 8) % 2 else 0
        for x in range(-8 + stagger, w + 8, 16):
            col = BRICK1 if ((x // 16) + (y // 8)) % 2 == 0 else BRICK0
            if ((x // 16) + y) % 7 == 0:
                col = BRICK2
            c.rect(x, y, 15, 7, col)
    c.rect(0, 0, w, 8, IRON1)
    c.rect(24, 0, 3, 104, IRON2)
    c.rect(w - 28, 0, 3, 104, IRON2)
    c.rect(w // 2 - 1, 8, 2, 10, STEEL)
    c.banded_oval(w // 2, 20, 6, 3, AMBER0, AMBER1, AMBER2)
    for y in range(22, 120):
        half = 18 + (y - 22) // 2
        for x in range(w // 2 - half, w // 2 + half + 1):
            if 0 <= x < w and (x + y) % 2 == 0 and (x + 2 * y) % 5 != 0:
                if c.get(x, y) in (BRICK0, BRICK1, BRICK2, IRON0):
                    c.set(x, y, AMBER0 if abs(x - w // 2) < half // 3 and y % 3 == 0 else IRON2)
    crowd_bank(c, 86, w, 3)
    c.rect(0, 112, w, h - 112, IRON1)
    c.rect(50, 124, w - 100, 36, WOOD0)
    for y in range(126, 158, 2):
        for x in range(52, w - 52, 2):
            if (x // 2 + y // 2) % 3 == 0:
                c.set(x, y, WOOD1)
            elif (x + y) % 11 == 0:
                c.set(x, y, WOOD2)
    c.rect(58, 130, w - 116, 2, TAPE)
    c.rect(58, 152, w - 116, 2, TAPE)
    c.rect(58, 130, 2, 24, TAPE)
    c.rect(w - 60, 130, 2, 24, TAPE)
    c.rect(w - 36, 68, 3, 50, STEEL)
    for i, col in enumerate((RED, BLUE, YELLOW, GREEN)):
        plate(c, w - 34, 76 + i * 11, 7, col)
    c.rect(18, 118, 28, 10, IRON2)
    for i, col in enumerate((CHALK, CHALK, CHALK)):
        c.banded_disc(26 + i * 8, 122, 3, IRON1, col, TAPE)
    c.banded_oval(30, 150, 7, 3, IRON2, IRON3, CHALK)
    return c


def title_scene() -> C:
    w, h = 160, 224
    c = C(w, h)
    c.fill(IRON0)
    for y in range(0, 142, 8):
        stagger = 8 if (y // 8) % 2 else 0
        for x in range(-8 + stagger, w + 8, 16):
            col = BRICK1 if ((x // 16) + (y // 8)) % 2 == 0 else BRICK0
            c.rect(x, y, 15, 7, col)
    c.rect(0, 0, w, 7, IRON1)
    c.rect(18, 0, 3, 142, IRON2)
    c.rect(w - 22, 0, 3, 142, IRON2)
    c.rect(48, 10, 64, 12, IRON1)
    c.rect(50, 12, 60, 8, BELT)
    for x, col in ((62, CHALK), (80, CHALK), (98, CHALK)):
        c.banded_disc(x, 16, 3, IRON2, col, TAPE)
    c.rect(28, 8, 2, 18, STEEL)
    c.banded_oval(29, 28, 5, 3, AMBER0, AMBER1, AMBER2)
    for y in range(30, 160):
        half = 10 + (y - 30) // 2
        for x in range(20, min(w - 1, 29 + half)):
            dx = abs(x - (29 + half // 3))
            if dx <= half and (x + y) % 2 == 0 and (x * 2 + y) % 5 != 0:
                if c.get(x, y) in (BRICK0, BRICK1, BRICK2, IRON0):
                    c.set(x, y, AMBER0 if dx < half // 2 and y % 3 == 0 else IRON2)
    crowd_bank(c, 118, w, 3)
    c.rect(0, 150, w, h - 150, IRON1)
    c.rect(18, 168, 124, 40, WOOD0)
    for y in range(170, 206, 2):
        for x in range(20, 140, 2):
            if (x + y) % 4 == 0:
                c.set(x, y, WOOD1)
    c.rect(28, 176, 104, 2, TAPE)
    c.rect(28, 198, 104, 2, TAPE)
    c.rect(28, 176, 2, 24, TAPE)
    c.rect(130, 176, 2, 24, TAPE)
    bar(c, 46, 114, 188, "max")
    c.rect(142, 88, 3, 64, STEEL)
    for i, col in enumerate((RED, BLUE, YELLOW, GREEN)):
        plate(c, 144, 98 + i * 12, 6, col)
    return c


def save_sprite(path: Path, canvas: C) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.outline()
    canvas.image(SCALE).save(path)


def save_scene(path: Path, canvas: C, scale: int = 4) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im = canvas.image(scale)
    bg = Image.new("RGB", im.size, IRON0)
    bg.paste(im, mask=im.split()[3])
    bg.save(path)


def sheet(frames: list[Image.Image], cols: int) -> Image.Image:
    w, h = frames[0].size
    rows = (len(frames) + cols - 1) // cols
    out = Image.new("RGBA", (w * cols, h * rows), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        out.paste(fr, ((i % cols) * w, (i // cols) * h), fr)
    return out


def qa(path: Path) -> dict[str, int]:
    im = Image.open(path).convert("RGBA")
    data = list(im.getdata())
    return {
        "semi": sum(1 for _r, _g, _b, a in data if 0 < a < 255),
        "mag": sum(1 for r, g, b, a in data if a > 0 and r > 170 and b > 150 and g < 130),
        "colors": len({(r, g, b) for r, g, b, a in data if a > 0}),
    }


def write_pack(name: str, drawer, count: int) -> list[Image.Image]:
    frames: list[Image.Image] = []
    for i in range(count):
        canvas = C(CW, CH)
        drawer(canvas, i)
        dest = OUT / name / f"frame-{i + 1:02d}.png"
        save_sprite(dest, canvas)
        s = qa(dest)
        print(f"{name}/frame-{i + 1:02d} semi={s['semi']} mag={s['mag']} colors={s['colors']}")
        if s["semi"] or s["mag"]:
            raise SystemExit(f"QA fail {dest} {s}")
        if s["colors"] > 48:
            raise SystemExit(f"QA fail {dest} too many colors {s}")
        frames.append(Image.open(dest))
    sheet(frames, 3 if count == 6 else 2).save(OUT / name / "sheet-transparent.png")
    return frames


def export_evidence() -> None:
    if not EVIDENCE.exists():
        return
    for name in ("squat", "bench", "deadlift", "squat-max", "bench-max", "deadlift-max", "idle", "success", "miss"):
        dest_dir = EVIDENCE / "sprites" / name
        dest_dir.mkdir(parents=True, exist_ok=True)
        for src in (OUT / name).glob("frame-*.png"):
            Image.open(src).save(dest_dir / src.name)
        sheet_src = OUT / name / "sheet-transparent.png"
        if sheet_src.exists() and name in ("squat", "bench", "deadlift", "squat-max", "bench-max", "deadlift-max"):
            Image.open(sheet_src).save(EVIDENCE / f"{name}-sheet.png")
    iron = Image.new("RGB", (320, 320), IRON0)
    keys = [
        ("squat", "frame-03.png", "squat-hole"),
        ("squat-max", "frame-03.png", "squat-hole-max"),
        ("bench", "frame-03.png", "bench-pause"),
        ("bench-max", "frame-03.png", "bench-pause-max"),
        ("deadlift", "frame-01.png", "deadlift-setup"),
        ("deadlift-max", "frame-01.png", "deadlift-setup-max"),
        ("deadlift", "frame-06.png", "deadlift-lockout"),
        ("deadlift-max", "frame-06.png", "deadlift-lockout-max"),
        ("idle", "frame-01.png", "idle-01"),
        ("success", "frame-01.png", "success-01"),
        ("success", "frame-04.png", "success-04"),
        ("miss", "frame-01.png", "miss-01"),
    ]
    comp_dir = EVIDENCE / "composites"
    comp_dir.mkdir(parents=True, exist_ok=True)
    for folder, fname, stem in keys:
        spr = Image.open(OUT / folder / fname).convert("RGBA")
        on_iron = iron.copy()
        on_iron.paste(spr, (0, 0), spr)
        on_iron.save(comp_dir / f"{stem}-on-iron.png")
        zoom = on_iron.crop((80, 40, 240, 240)).resize((320, 400), Image.NEAREST)
        zoom.save(comp_dir / f"{stem}-edge-zoom.png")
    trio = Image.new("RGB", (960, 320), (0, 0, 0))
    for i, (folder, fname) in enumerate((("squat", "frame-03.png"), ("bench", "frame-03.png"), ("deadlift", "frame-01.png"))):
        spr = Image.open(OUT / folder / fname).convert("RGBA")
        trio.paste(spr, (i * 320, 0), spr)
    trio.save(EVIDENCE / "three-lift-silhouettes.png")
    compare = Image.new("RGB", (960, 640), (0, 0, 0))
    pairs = (
        ("squat", "squat-max", "frame-03.png"),
        ("bench", "bench-max", "frame-03.png"),
        ("deadlift", "deadlift-max", "frame-01.png"),
    )
    for i, (light, heavy, fname) in enumerate(pairs):
        a = Image.open(OUT / light / fname).convert("RGBA")
        b = Image.open(OUT / heavy / fname).convert("RGBA")
        compare.paste(a, (i * 320, 0), a)
        compare.paste(b, (i * 320, 320), b)
    compare.save(EVIDENCE / "light-vs-max.png")
    for name in ("title.png", "platform.png"):
        src = OUT / name
        if src.exists():
            Image.open(src).save(EVIDENCE / name)


def main() -> None:
    write_pack("squat", lambda c, i: squat(c, i, "light"), 6)
    write_pack("squat-max", lambda c, i: squat(c, i, "max"), 6)
    write_pack("bench", lambda c, i: bench(c, i, "light"), 6)
    write_pack("bench-max", lambda c, i: bench(c, i, "max"), 6)
    write_pack("deadlift", lambda c, i: deadlift(c, i, "light"), 6)
    write_pack("deadlift-max", lambda c, i: deadlift(c, i, "max"), 6)
    write_pack("idle", idle, 4)
    write_pack("success", success, 4)
    write_pack("miss", miss, 4)
    write_pack("plates", plates_prop, 6)

    ident = C(CW, CH)
    idle(ident, 0)
    save_sprite(OUT / "identity.png", ident)
    save_scene(OUT / "platform.png", platform_scene(), 4)
    save_scene(OUT / "title.png", title_scene(), 4)
    for jpeg in (OUT / "title.jpg", OUT / "platform.jpg"):
        if jpeg.exists():
            jpeg.unlink()
    export_evidence()


if __name__ == "__main__":
    main()
