#!/usr/bin/env python3
"""Author the Iron & Amber Arcade 16-bit sprite package.

Native character canvas is 80x80, then nearest-neighbor 4x.
Palette is SNES/Genesis-sized. Alpha is binary. No chroma key.
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

# Craft constants — tuned by hand later. Not feel / judging.
HEAD_W = 16
HEAD_H = 12
LIMB_THIGH = 5
LIMB_CALF = 3
LIMB_ARM = 3
LIMB_STRAIN_BONUS = 1
BELT_H = 4
WRAP_H = 3
SQUAT_STRAIN = frozenset({2, 3, 5})
BENCH_STRAIN = frozenset({2, 3, 4})
DEAD_STRAIN = frozenset({1, 2, 3, 5})
SQUAT_DROP = (0, 6, 12, 8, 4, 0)
SQUAT_WIDE = (4, 7, 12, 9, 5, 4)
SQUAT_LEAN = (0, 2, 5, 3, 1, 0)
DEAD_BAR_Y = (69, 61, 55, 50, 47, 45)
DEAD_HIP_Y = (60, 58, 56, 54, 53, 52)
DEAD_SH_X = (52, 49, 46, 43, 41, 38)
DEAD_SH_Y = (44, 40, 36, 33, 32, 30)
BENCH_BAR_Y = (20, 28, 38, 32, 26, 18)

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
}

# Profile facing right: chunky SNES features (2px eye / mouth / ear / nose).
PROFILE_OK = [
    "   hhhhhhhh    ",
    "  hhHHHHHHhh   ",
    " hhHHSSSSSLss  ",
    "ehHSSSEElSSSs  ",
    "eeHSSSDSSSSnL  ",
    " eSSSSSSSSSss  ",
    "  SSSSSSmmSSs  ",
    "  sSSSSSSSSS   ",
    "   SSSSSSS     ",
    "    nSSSn      ",
    "    nSSSn      ",
]
PROFILE_STRAIN = [
    "   hhhhhhhh    ",
    "  hhHHHHHHhh   ",
    " hhHHBBSSSLss  ",
    "ehHSBllfFSSSs  ",
    "eeHFFfDSSSSnL  ",
    " eSSFfSTTTTTs  ",
    "  SSFmTTTTTm   ",
    "  sFFfSSSSSS   ",
    "   FSSSSfF     ",
    "    nVVVn      ",
    "    nSSSn      ",
]
PROFILE_MISS = [
    "   hhhhhhhh    ",
    "  hhHHHHHHhh   ",
    " hhHHBBSSSLss  ",
    "ehHSSSBBlSSSs  ",
    "eeHSSSDSSSSnL  ",
    " eSSSSSSSSSss  ",
    "  SSSSS  mmSs  ",
    "  sSSSSSSSSS   ",
    "   SSSSSSS     ",
    "    nSSSn      ",
    "    nSSSn      ",
]
PROFILE_GRIN = [
    "   hhhhhhhh    ",
    "  hhHHHHHHhh   ",
    " hhHHSSSSSLss  ",
    "ehHSSSEElSSSs  ",
    "eeHSSSDSSSSnL  ",
    " eSSSSSSSSSss  ",
    "  SSSSTTmmTTs  ",
    "  sSSSSSSSSS   ",
    "   SSSSSSS     ",
    "    nSSSn      ",
    "    nSSSn      ",
]
FRONT_OK = [
    "   hhhhhhhhh   ",
    "  hhHHHHHHHhh  ",
    " hHHSSSSSSSHHh ",
    "ehSSEElSSEElSse",
    "eeSSSSsDNsSSSse",
    " hSSSSSSmmSSSs ",
    "  SSSSSSSSSSS  ",
    "   sSSSSSSSs   ",
    "    nnnnnnn    ",
]
FRONT_STRAIN = [
    "   hhhhhhhhh   ",
    "  hhHHHHHHHhh  ",
    " hHHBBsssBBHHh ",
    "ehSFBllSSBllFse",
    "eeSFfSsDNsFfSse",
    " hSSSTTTTTTSSs ",
    "  SSFmTTTTmFS  ",
    "   FSSSSSSfF   ",
    "    nVVnnVV    ",
]


class C:
    def __init__(self, w: int, h: int) -> None:
        self.w = w
        self.h = h
        self.p = [[None for _ in range(w)] for _ in range(h)]

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

    def shade_pick(
        self,
        x: int,
        y: int,
        lit: float,
        dark: tuple[int, int, int],
        mid: tuple[int, int, int],
        light: tuple[int, int, int],
    ) -> tuple[int, int, int]:
        dith = 0.42 if ((x ^ y) & 1) else 0.0
        val = lit + dith
        if val > 0.38:
            return light
        if val < -0.12:
            return dark
        if val > 0.12:
            return light if (x + y) % 2 == 0 else mid
        if val < 0.08:
            return dark if (x + y) % 2 == 0 else mid
        return mid

    def disc(self, cx: int, cy: int, r: int, mid: tuple[int, int, int], hi: tuple[int, int, int] | None = None) -> None:
        self.shade_disc(cx, cy, r, mid, mid, hi or mid)

    def shade_disc(
        self,
        cx: int,
        cy: int,
        r: int,
        dark: tuple[int, int, int],
        mid: tuple[int, int, int],
        light: tuple[int, int, int],
    ) -> None:
        for y in range(cy - r, cy + r + 1):
            for x in range(cx - r, cx + r + 1):
                dx, dy = x - cx, y - cy
                if dx * dx + dy * dy <= r * r:
                    if r <= 1:
                        self.set(x, y, mid)
                        continue
                    lit = (-dx - dy) / float(r)
                    self.set(x, y, self.shade_pick(x, y, lit, dark, mid, light))

    def oval(self, cx: int, cy: int, rx: int, ry: int, mid: tuple[int, int, int], hi: tuple[int, int, int] | None = None) -> None:
        self.shade_oval(cx, cy, rx, ry, mid, mid, hi or mid)

    def shade_oval(
        self,
        cx: int,
        cy: int,
        rx: int,
        ry: int,
        dark: tuple[int, int, int],
        mid: tuple[int, int, int],
        light: tuple[int, int, int],
    ) -> None:
        rx = max(1, rx)
        ry = max(1, ry)
        for y in range(cy - ry, cy + ry + 1):
            for x in range(cx - rx, cx + rx + 1):
                u = (x - cx) / rx
                v = (y - cy) / ry
                if u * u + v * v <= 1.0:
                    self.set(x, y, self.shade_pick(x, y, -u - v, dark, mid, light))

    def thick(self, x0: int, y0: int, x1: int, y1: int, r: int, mid: tuple[int, int, int], hi: tuple[int, int, int] | None = None) -> None:
        hi = hi or mid
        self.shade_thick(x0, y0, x1, y1, r, mid, mid, hi)

    def shade_thick(
        self,
        x0: int,
        y0: int,
        x1: int,
        y1: int,
        r: int,
        dark: tuple[int, int, int],
        mid: tuple[int, int, int],
        light: tuple[int, int, int],
    ) -> None:
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(steps + 1):
            x = x0 + (x1 - x0) * i // steps
            y = y0 + (y1 - y0) * i // steps
            self.shade_disc(x, y, r, dark, mid, light)

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
    # Keep droplets attached to the skull so they outline as sweat, not floaters.
    c.set(x, y, CHALK)
    c.set(x, y + 1, CHALK)
    c.set(x + 1, y + 1, CHALK)


def head_profile(c: C, x: int, y: int, mode: str = "ok") -> None:
    rows = {
        "ok": PROFILE_OK,
        "strain": PROFILE_STRAIN,
        "miss": PROFILE_MISS,
        "grin": PROFILE_GRIN,
    }.get(mode, PROFILE_OK)
    dark, mid, light = (FLUSH0, SKIN1, SKIN2) if mode == "strain" else (SKIN0, SKIN1, SKIN2)
    c.shade_oval(x + 8, y + 6, 5, 5, dark, mid, light)
    c.stamp(x, y, rows, FACE_PAL)
    if mode == "strain":
        sweat(c, x + 14, y + 1)


def head_front(c: C, x: int, y: int, mode: str = "ok") -> None:
    rows = FRONT_STRAIN if mode == "strain" else FRONT_OK
    dark, mid, light = (FLUSH0, SKIN1, SKIN2) if mode == "strain" else (SKIN0, SKIN1, SKIN2)
    c.shade_oval(x + 8, y + 5, 6, 5, dark, mid, light)
    c.stamp(x, y, rows, FACE_PAL)
    if mode == "strain":
        sweat(c, x + 15, y)


def shoe(c: C, x: int, y: int, facing: int = 1) -> None:
    if facing >= 0:
        c.rect(x, y + 1, 12, 4, SHOE0)
        c.rect(x + 1, y, 8, 3, SHOE1)
        c.rect(x + 8, y + 2, 5, 3, SHOE0)
        c.rect(x, y + 4, 12, 2, OUTLINE)
        c.rect(x + 1, y + 3, 3, 2, IRON1)  # raised heel
        c.rect(x + 3, y + 3, 3, 1, AMBER0)
        c.set(x + 6, y + 1, STEEL)
    else:
        c.rect(x, y + 1, 12, 4, SHOE0)
        c.rect(x + 3, y, 8, 3, SHOE1)
        c.rect(x, y + 2, 5, 3, SHOE0)
        c.rect(x, y + 4, 12, 2, OUTLINE)
        c.rect(x + 8, y + 3, 3, 2, IRON1)
        c.rect(x + 6, y + 3, 3, 1, AMBER0)
        c.set(x + 5, y + 1, STEEL)


def shoe_front(c: C, x: int, y: int) -> None:
    c.rect(x, y + 1, 10, 4, SHOE0)
    c.rect(x + 1, y, 8, 3, SHOE1)
    c.rect(x, y + 4, 10, 2, OUTLINE)
    c.rect(x + 3, y + 3, 4, 1, AMBER0)
    c.rect(x + 1, y + 3, 2, 2, IRON1)


def wrap(c: C, x: int, y: int, w: int, h: int = WRAP_H) -> None:
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if yy == y:
                c.set(xx, yy, TAPE if (xx + yy) & 1 else AMBER2)
            elif yy == y + h - 1:
                c.set(xx, yy, AMBER0)
            else:
                c.set(xx, yy, AMBER1 if (xx + yy) & 1 else TAPE)


def hand(c: C, x: int, y: int) -> None:
    wrap(c, x - 1, y + 1, 3, 3)
    c.rect(x, y, 5, 4, CHALK)
    c.set(x + 1, y + 1, SKIN2)
    c.set(x + 3, y + 1, SKIN1)
    c.set(x + 2, y + 2, SKIN0)
    c.set(x + 4, y, SKIN2)


def singlet(c: C, x: int, y: int, w: int, h: int, strain: bool = False) -> None:
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            t = (yy - y) / max(h - 1, 1)
            edge = xx <= x + 1 or xx >= x + w - 2
            fold = ((xx + 2 * yy) % 5 == 0) and yy > y + 2
            if strain and (xx + yy) % 4 == 0 and yy > y + 4:
                fold = True
            if t < 0.22:
                col = SING2 if ((xx ^ yy) & 1) or xx < x + w // 2 else SING1
            elif t > 0.68 or edge:
                col = SING0 if not ((xx + yy) & 1) else SING1
            else:
                col = SING2 if xx < x + 4 and (xx + yy) & 1 else SING1
            if fold:
                col = SING0
            c.set(xx, yy, col)
    for yy in range(y + 2, y + h - 2):
        c.set(x + w - 2, yy, AMBER1 if yy % 2 == 0 else AMBER2)
        c.set(x + w - 3, yy, AMBER0 if yy % 2 else AMBER1)
    c.rect(x + 4, y - 2, 2, 3, SING2)
    c.rect(x + w - 6, y - 2, 2, 3, SING2)
    neck = max(3, w - 10)
    c.rect(x + (w - neck) // 2, y, neck, 1, SKIN1)
    if strain:
        c.rect(x + 3, y + h // 3, w - 6, 1, SING0)


def belt(c: C, x: int, y: int, w: int, cinch: bool = False) -> None:
    h = BELT_H if cinch else 3
    c.rect(x, y, w, h, BELT)
    for xx in range(x + 1, x + w - 1, 3):
        c.set(xx, y + 1, IRON1)
    c.rect(x + w // 2 - 2, y, 5, h, BUCKLE)
    c.rect(x + w // 2 - 1, y + 1, 3, max(1, h - 2), AMBER1)
    if cinch:
        c.rect(x, y, 1, h, OUTLINE)
        c.rect(x + w - 1, y, 1, h, OUTLINE)


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
    c.shade_disc(cx, cy, hub, STEEL, BAR0, BAR1)
    for y in range(cy - r + 1, cy + r):
        for x in range(cx + r - 4, cx + r + 1):
            d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy)
            if inner * inner < d2 <= r * r:
                c.set(x, y, color)


def bar(c: C, x0: int, x1: int, y: int, loaded: str = "meet") -> None:
    c.rect(x0, y - 1, x1 - x0, 3, BAR0)
    c.rect(x0, y, x1 - x0, 1, BAR1)
    for x in range(x0 + 10, x1 - 10, 2):
        c.set(x, y - 1, STEEL)
    stack = {
        "meet": [(10, RED), (8, BLUE), (6, YELLOW)],
        "light": [(8, BLUE), (6, YELLOW), (5, GREEN)],
    }[loaded]
    ox = 0
    for r, col in stack:
        plate(c, x0 - 2 - ox, y, r, col)
        plate(c, x1 + 2 + ox, y, r, col)
        ox += 3
    c.rect(x0 + 1, y - 2, 2, 5, BAR1)
    c.rect(x1 - 3, y - 2, 2, 5, BAR1)


def skin_tones(strain: bool) -> tuple[tuple[int, int, int], tuple[int, int, int], tuple[int, int, int]]:
    if strain:
        return FLUSH0, SKIN1, SKIN3
    return SKIN0, SKIN1, SKIN2


def lifter_stand(c: C, x: int, y: int, mode: str = "ok", arms: str = "down") -> None:
    hip_y = y - 22
    sh_y = y - 40
    strain = mode == "strain"
    dark, mid, light = skin_tones(strain)
    far_d, far_m, far_l = SKIN0, SKIN1, SKIN0
    r_th = LIMB_THIGH + (LIMB_STRAIN_BONUS if strain else 0)
    r_arm = LIMB_ARM + (1 if strain else 0)
    c.shade_thick(x - 3, hip_y, x - 6, y - 10, r_th, far_d, far_m, far_l)
    c.shade_thick(x - 6, y - 10, x - 7, y - 2, LIMB_CALF, far_d, far_m, far_l)
    shoe(c, x - 14, y - 2, -1)
    wrap(c, x - 9, y - 13, 6)
    if arms == "down":
        c.shade_thick(x - 7, sh_y + 2, x - 10, sh_y + 18, r_arm, far_d, far_m, far_l)
        hand(c, x - 12, sh_y + 18)
    elif arms == "rack":
        c.shade_thick(x - 7, sh_y + 2, x - 14, sh_y + 10, r_arm, far_d, far_m, far_l)
        hand(c, x - 16, sh_y + 8)
    elif arms == "up":
        c.shade_thick(x - 7, sh_y + 2, x - 12, sh_y - 10, r_arm, far_d, mid, light)
        hand(c, x - 14, sh_y - 13)
    singlet(c, x - 9, sh_y, 18, 20, strain)
    belt(c, x - 9, hip_y - 1, 18, strain)
    c.shade_thick(x + 3, hip_y, x + 6, y - 10, r_th, dark, mid, light)
    c.shade_thick(x + 6, y - 10, x + 6, y - 2, LIMB_CALF, dark, mid, light)
    shoe(c, x + 2, y - 2, 1)
    wrap(c, x + 4, y - 13, 6)
    if arms == "down":
        c.shade_thick(x + 7, sh_y + 2, x + 10, sh_y + 18, r_arm, dark, mid, light)
        hand(c, x + 9, sh_y + 18)
    elif arms == "rack":
        c.shade_thick(x + 7, sh_y + 2, x + 14, sh_y + 10, r_arm, dark, mid, light)
        hand(c, x + 14, sh_y + 8)
    elif arms == "up":
        c.shade_thick(x + 7, sh_y + 2, x + 12, sh_y - 10, r_arm, dark, mid, light)
        hand(c, x + 11, sh_y - 13)
    elif arms == "out":
        c.shade_thick(x + 7, sh_y + 2, x + 16, sh_y + 8, r_arm, dark, mid, light)
        hand(c, x + 16, sh_y + 6)
        c.shade_thick(x - 7, sh_y + 2, x - 16, sh_y + 8, r_arm, far_d, far_m, far_l)
        hand(c, x - 19, sh_y + 6)
    face = "strain" if strain else "miss" if mode == "miss" else "grin" if mode == "grin" else "ok"
    head_profile(c, x - 5, sh_y - 13, face)


def squat(c: C, phase: int) -> None:
    drop = SQUAT_DROP[phase]
    wide = SQUAT_WIDE[phase]
    lean = SQUAT_LEAN[phase]
    x, foot = 40, 74
    hip_y = foot - 22 + drop
    sh_y = foot - 42 + drop + lean
    sh_x = x + lean
    hip_x = x - lean // 2
    strain = phase in SQUAT_STRAIN
    dark, mid, light = skin_tones(strain)
    far_d, far_m, far_l = SKIN0, SKIN1, SKIN0
    r_th = LIMB_THIGH + (LIMB_STRAIN_BONUS if strain else 0)
    r_arm = LIMB_ARM + (1 if strain else 0)
    bar(c, 10, 70, sh_y - 2)
    knee_y = foot - 14 + drop // 5
    c.shade_thick(hip_x - 3, hip_y, hip_x - 6 - wide, knee_y, r_th, far_d, far_m, far_l)
    c.shade_thick(hip_x - 6 - wide, knee_y, hip_x - 7 - wide // 2, foot - 2, LIMB_CALF, far_d, far_m, far_l)
    shoe(c, hip_x - 16 - wide // 2, foot - 2, -1)
    wrap(c, hip_x - 8 - wide, knee_y - 1, 6)
    c.shade_thick(hip_x + 3, hip_y, hip_x + 8 + wide, knee_y, r_th, dark, mid, light)
    c.shade_thick(hip_x + 8 + wide, knee_y, hip_x + 7 + wide // 2, foot - 2, LIMB_CALF, dark, mid, light)
    shoe(c, hip_x + 3 + wide // 2, foot - 2, 1)
    wrap(c, hip_x + 6 + wide, knee_y - 1, 6)
    singlet(c, sh_x - 9, sh_y, 18, 18, strain)
    belt(c, hip_x - 9, hip_y, 18, strain)
    c.shade_thick(sh_x - 7, sh_y + 3, sh_x - 14, sh_y + 9, r_arm, far_d, far_m, far_l)
    hand(c, sh_x - 16, sh_y + 7)
    c.shade_thick(sh_x + 7, sh_y + 3, sh_x + 14, sh_y + 9, r_arm, dark, mid, light)
    hand(c, sh_x + 14, sh_y + 7)
    if strain:
        c.shade_thick(sh_x - 2, sh_y + 12, sh_x + 2, hip_y - 2, 3, dark, mid, light)
    head_profile(c, sh_x - 5, sh_y - 13, "strain" if strain else "ok")


def deadlift(c: C, phase: int) -> None:
    x, foot = 40, 74
    bar_y = DEAD_BAR_Y[phase]
    hip_y = DEAD_HIP_Y[phase]
    sh_x = DEAD_SH_X[phase]
    sh_y = DEAD_SH_Y[phase]
    hinge = phase <= 2
    strain = phase in DEAD_STRAIN
    dark, mid, light = skin_tones(strain)
    far_d, far_m, far_l = SKIN0, SKIN1, SKIN0
    r_th = LIMB_THIGH + (LIMB_STRAIN_BONUS if strain else 0)
    r_arm = LIMB_ARM + (1 if strain else 0)
    bar(c, 10, 70, bar_y)
    c.shade_thick(x - 4, hip_y, x - 6, foot - 10, r_th, far_d, far_m, far_l)
    c.shade_thick(x - 6, foot - 10, x - 7, foot - 2, LIMB_CALF, far_d, far_m, far_l)
    shoe(c, x - 15, foot - 2, -1)
    wrap(c, x - 9, foot - 14, 6)
    c.shade_thick(x + 2, hip_y, x + 5, foot - 10, r_th, dark, mid, light)
    c.shade_thick(x + 5, foot - 10, x + 6, foot - 2, LIMB_CALF, dark, mid, light)
    shoe(c, x + 2, foot - 2, 1)
    wrap(c, x + 3, foot - 14, 6)
    tw = 18 if strain else 16
    th = 16
    singlet(c, sh_x - tw // 2, sh_y, tw, th, strain)
    belt(c, x - 9, hip_y - 1, 18, strain)
    c.shade_thick(sh_x - 6, sh_y + 4, 28, bar_y, r_arm, far_d, far_m, far_l)
    c.shade_thick(sh_x + 6, sh_y + 4, 50, bar_y, r_arm, dark, mid, light)
    hand(c, 26, bar_y - 1)
    hand(c, 49, bar_y - 1)
    head_x = sh_x + (3 if hinge else -5)
    head_y = sh_y - (11 if hinge else 13)
    head_x = min(max(head_x, 1), CW - HEAD_W - 1)
    head_y = min(max(head_y, 1), CH - HEAD_H - 4)
    neck_x1 = head_x + 7
    neck_y1 = head_y + HEAD_H - 2
    c.shade_thick(sh_x + 3, sh_y + 1, neck_x1, neck_y1, 3, dark, mid, light)
    head_profile(c, head_x, head_y, "strain" if strain else "ok")


def bench(c: C, phase: int) -> None:
    bar_y = BENCH_BAR_Y[phase]
    strain = phase in BENCH_STRAIN
    dark, mid, light = skin_tones(strain)
    c.rect(8, 16, 4, 50, IRON2)
    c.rect(68, 16, 4, 50, IRON2)
    c.rect(6, 64, 8, 4, IRON1)
    c.rect(66, 64, 8, 4, IRON1)
    c.rect(8, 24, 6, 3, IRON3)
    c.rect(66, 24, 6, 3, IRON3)
    c.rect(16, 46, 48, 6, IRON2)
    c.rect(18, 44, 44, 3, IRON3)
    c.rect(36, 52, 6, 16, IRON1)
    c.rect(30, 66, 18, 4, IRON2)
    # torso on pad — singlet folds + belt, not a sausage
    for xx in range(22, 58):
        for yy in range(38, 46):
            t = (xx - 22) / 36.0
            fold = strain and (xx + yy) % 5 == 0
            if t < 0.15 or t > 0.8:
                col = SING0 if (xx + yy) & 1 else SING1
            else:
                col = SING2 if (xx ^ yy) & 1 else SING1
            if fold:
                col = SING0
            c.set(xx, yy, col)
    c.rect(36, 37, 3, 10, AMBER1)
    c.set(37, 38, AMBER2)
    belt(c, 33, 43, 12, strain)
    c.shade_thick(56, 44, 66, 54, 3, SKIN0, SKIN1, SKIN0)
    c.shade_thick(66, 54, 68, 68, 2, SKIN0, SKIN1, SKIN0)
    shoe_front(c, 64, 66)
    wrap(c, 63, 52, 5)
    c.shade_thick(54, 44, 62, 56, 3, dark, mid, light)
    c.shade_thick(62, 56, 64, 68, 2, dark, mid, light)
    shoe_front(c, 60, 66)
    wrap(c, 59, 54, 5)
    r_arm = LIMB_ARM + (1 if strain else 0)
    c.shade_thick(26, 40, 24, bar_y, r_arm, dark, mid, light)
    c.shade_thick(48, 40, 54, bar_y, r_arm, dark, mid, light)
    hand(c, 22, bar_y - 1)
    hand(c, 53, bar_y - 1)
    c.shade_thick(22, 38, 18, 36, 3, dark, mid, light)
    bar(c, 12, 68, bar_y)
    # Face on top of the pad, to the right of the left plate stack.
    head_front(c, 16, 31, "strain" if strain else "ok")


def idle(c: C, i: int) -> None:
    lifter_stand(c, 40, 74, "ok", "down")
    if i % 2:
        c.rect(33, 34, 12, 1, SING2)


def success(c: C, i: int) -> None:
    arms = ["out", "out", "up", "up"][i]
    lifter_stand(c, 40, 74, "grin", arms)
    if i >= 2:
        for pt in ((58, 16), (61, 14), (63, 17), (56, 13), (60, 12)):
            c.set(*pt, CHALK)


def miss(c: C, i: int) -> None:
    x = 40 + i
    lifter_stand(c, x, 74, "miss", "down")
    c.rect(x - 2, 22, 8, 1, HAIR0)


def plates_prop(c: C, i: int) -> None:
    c.rect(38, 12, 4, 56, IRON2)
    c.rect(28, 66, 24, 4, IRON1)
    cols = [RED, BLUE, YELLOW, GREEN, CHALK, STEEL]
    for n, y in enumerate((20, 32, 44, 56)):
        plate(c, 32, y, 8 - n, cols[(i + n) % 6])
        plate(c, 48, y, 8 - n, cols[(i + n + 2) % 6])


def platform_scene(w: int = 320, h: int = 180) -> C:
    c = C(w, h)
    c.fill(IRON0)
    for y in range(8, 112, 8):
        stagger = 8 if (y // 8) % 2 else 0
        for x in range(-8 + stagger, w + 8, 16):
            col = BRICK1 if ((x // 16) + (y // 8)) % 2 == 0 else BRICK0
            if ((x // 16) + y) % 7 == 0:
                col = BRICK2
            c.rect(x, y, 15, 7, col)
    c.rect(0, 0, w, 8, IRON1)
    c.rect(24, 0, 3, 112, IRON2)
    c.rect(w - 28, 0, 3, 112, IRON2)
    c.rect(w // 2 - 1, 8, 2, 10, STEEL)
    c.oval(w // 2, 20, 6, 3, AMBER1, AMBER2)
    for y in range(22, 130):
        half = 18 + (y - 22) // 2
        for x in range(w // 2 - half, w // 2 + half + 1):
            if 0 <= x < w and (x + y) % 2 == 0 and (x + 2 * y) % 5 != 0:
                if c.get(x, y) in (BRICK0, BRICK1, BRICK2, IRON0):
                    c.set(x, y, AMBER0 if abs(x - w // 2) < half // 3 and y % 3 == 0 else IRON2)
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
    c.oval(30, 150, 7, 3, IRON3, CHALK)
    return c


def title_scene() -> C:
    w, h = 160, 224
    c = C(w, h)
    c.fill(IRON0)
    for y in range(0, 150, 8):
        stagger = 8 if (y // 8) % 2 else 0
        for x in range(-8 + stagger, w + 8, 16):
            col = BRICK1 if ((x // 16) + (y // 8)) % 2 == 0 else BRICK0
            c.rect(x, y, 15, 7, col)
    c.rect(0, 0, w, 7, IRON1)
    c.rect(18, 0, 3, 150, IRON2)
    c.rect(w - 22, 0, 3, 150, IRON2)
    c.rect(68, 18, 24, 8, IRON1)
    for x in (72, 80, 88):
        c.disc(x, 22, 3, CHALK, TAPE)
    c.rect(28, 10, 2, 18, STEEL)
    c.oval(29, 30, 5, 3, AMBER1, AMBER2)
    for y in range(32, 168):
        half = 10 + (y - 32) // 2
        for x in range(20, min(w - 1, 29 + half)):
            dx = abs(x - (29 + half // 3))
            if dx <= half and (x + y) % 2 == 0 and (x * 2 + y) % 5 != 0:
                if c.get(x, y) in (BRICK0, BRICK1, BRICK2, IRON0):
                    c.set(x, y, AMBER0 if dx < half // 2 and y % 3 == 0 else IRON2)
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
    bar(c, 46, 114, 188, "light")
    c.rect(142, 96, 3, 56, STEEL)
    for i, col in enumerate((RED, BLUE, YELLOW, GREEN)):
        plate(c, 144, 106 + i * 12, 6, col)
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


def export_evidence() -> None:
    if not EVIDENCE.exists():
        return
    for name in ("squat", "bench", "deadlift", "idle", "success", "miss"):
        dest_dir = EVIDENCE / "sprites" / name
        dest_dir.mkdir(parents=True, exist_ok=True)
        for src in (OUT / name).glob("frame-*.png"):
            Image.open(src).save(dest_dir / src.name)
        sheet_src = OUT / name / "sheet-transparent.png"
        if sheet_src.exists() and name in ("squat", "bench", "deadlift"):
            Image.open(sheet_src).save(EVIDENCE / f"{name}-sheet.png")
    iron = Image.new("RGB", (320, 320), IRON0)
    keys = [
        ("squat", "frame-03.png", "squat-hole"),
        ("bench", "frame-03.png", "bench-pause"),
        ("deadlift", "frame-01.png", "deadlift-setup"),
        ("deadlift", "frame-06.png", "deadlift-lockout"),
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
    for name in ("title.png", "platform.png"):
        src = OUT / name
        if src.exists():
            Image.open(src).save(EVIDENCE / name)


def main() -> None:
    packs = {
        "squat": squat,
        "bench": bench,
        "deadlift": deadlift,
        "idle": idle,
        "success": success,
        "miss": miss,
        "plates": plates_prop,
    }
    counts = {"squat": 6, "bench": 6, "deadlift": 6, "idle": 4, "success": 4, "miss": 4, "plates": 6}
    for name, drawer in packs.items():
        frames = []
        for i in range(counts[name]):
            canvas = C(CW, CH)
            drawer(canvas, i)
            dest = OUT / name / f"frame-{i + 1:02d}.png"
            save_sprite(dest, canvas)
            s = qa(dest)
            print(f"{name}/frame-{i + 1:02d} semi={s['semi']} mag={s['mag']} colors={s['colors']}")
            if s["semi"] or s["mag"]:
                raise SystemExit(f"QA fail {dest} {s}")
            frames.append(Image.open(dest))
        sheet(frames, 3 if counts[name] == 6 else 2).save(OUT / name / "sheet-transparent.png")

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
