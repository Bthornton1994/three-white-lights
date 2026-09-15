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
SCALE = 4
CW = 80
CH = 80

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

    def disc(self, cx: int, cy: int, r: int, mid: tuple[int, int, int], hi: tuple[int, int, int] | None = None) -> None:
        hi = hi or mid
        for y in range(cy - r, cy + r + 1):
            for x in range(cx - r, cx + r + 1):
                if (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r:
                    self.set(x, y, hi if x - cx + (y - cy) < -r // 3 else mid)

    def oval(self, cx: int, cy: int, rx: int, ry: int, mid: tuple[int, int, int], hi: tuple[int, int, int] | None = None) -> None:
        hi = hi or mid
        rx = max(1, rx)
        ry = max(1, ry)
        for y in range(cy - ry, cy + ry + 1):
            for x in range(cx - rx, cx + rx + 1):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
                    self.set(x, y, hi if (x - cx) / rx + (y - cy) / ry < -0.35 else mid)

    def thick(self, x0: int, y0: int, x1: int, y1: int, r: int, mid: tuple[int, int, int], hi: tuple[int, int, int] | None = None) -> None:
        hi = hi or mid
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(steps + 1):
            x = x0 + (x1 - x0) * i // steps
            y = y0 + (y1 - y0) * i // steps
            self.disc(x, y, r, mid, hi)

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


def head_profile(c: C, x: int, y: int, mode: str = "ok") -> None:
    # Face stays readable; hair is a back/top cap, not a blob.
    c.oval(x + 5, y + 7, 5, 6, SKIN1, SKIN2)
    c.rect(x + 1, y + 2, 7, 5, HAIR0)
    c.rect(x + 2, y + 1, 6, 2, HAIR1)
    c.set(x + 1, y + 6, HAIR1)  # ear
    c.set(x + 8, y + 6, SKIN0)  # eye
    c.set(x + 9, y + 7, SKIN0)  # nose
    if mode == "strain":
        c.rect(x + 6, y + 9, 3, 1, SKIN0)
        c.set(x + 7, y + 5, SKIN0)
        c.set(x + 8, y + 5, SKIN0)
    elif mode == "miss":
        c.rect(x + 6, y + 10, 3, 1, SKIN0)
    else:
        c.set(x + 8, y + 10, SKIN0)
    c.rect(x + 4, y + 12, 4, 3, SKIN1)


def head_front(c: C, x: int, y: int, mode: str = "ok") -> None:
    c.oval(x + 5, y + 7, 5, 6, SKIN1, SKIN2)
    c.rect(x + 2, y + 1, 7, 4, HAIR0)
    c.rect(x + 3, y + 1, 5, 2, HAIR1)
    c.set(x + 3, y + 6, SKIN0)
    c.set(x + 7, y + 6, SKIN0)
    c.set(x + 5, y + 8, SKIN0)
    if mode == "strain":
        c.rect(x + 3, y + 9, 5, 1, SKIN0)
    else:
        c.rect(x + 4, y + 10, 3, 1, SKIN0)
    c.rect(x + 4, y + 12, 3, 3, SKIN1)


def shoe(c: C, x: int, y: int, facing: int = 1) -> None:
    if facing >= 0:
        c.rect(x, y + 1, 11, 4, SHOE0)
        c.rect(x + 1, y, 7, 3, SHOE1)
        c.rect(x + 7, y + 2, 5, 3, SHOE0)
        c.rect(x, y + 4, 11, 2, OUTLINE)
        c.rect(x + 2, y + 3, 3, 1, AMBER0)
    else:
        c.rect(x, y + 1, 11, 4, SHOE0)
        c.rect(x + 3, y, 7, 3, SHOE1)
        c.rect(x, y + 2, 5, 3, SHOE0)
        c.rect(x, y + 4, 11, 2, OUTLINE)
        c.rect(x + 6, y + 3, 3, 1, AMBER0)


def shoe_front(c: C, x: int, y: int) -> None:
    c.rect(x, y + 1, 9, 4, SHOE0)
    c.rect(x + 1, y, 7, 3, SHOE1)
    c.rect(x, y + 4, 9, 2, OUTLINE)
    c.rect(x + 3, y + 3, 3, 1, AMBER0)


def hand(c: C, x: int, y: int) -> None:
    c.rect(x, y, 4, 4, CHALK)
    c.set(x + 1, y + 1, SKIN2)


def singlet(c: C, x: int, y: int, w: int, h: int) -> None:
    c.rect(x, y, w, h, SING1)
    c.rect(x + 1, y, w - 2, 3, SING2)
    c.rect(x + 1, y + h - 4, w - 2, 4, SING0)
    for yy in range(y + 2, y + h - 2):
        c.set(x + w - 2, yy, AMBER1 if yy % 2 == 0 else AMBER2)
    # straps
    c.rect(x + 2, y - 2, 3, 3, SING1)
    c.rect(x + w - 5, y - 2, 3, 3, SING1)


def belt(c: C, x: int, y: int, w: int) -> None:
    c.rect(x, y, w, 3, BELT)
    c.rect(x + w // 2 - 2, y, 4, 3, BUCKLE)


def plate(c: C, cx: int, cy: int, r: int, color: tuple[int, int, int]) -> None:
    c.disc(cx, cy, r, BLACKP, STEEL)
    # color wedge on the facing rim
    for y in range(cy - r + 1, cy + r):
        for x in range(cx + r - 3, cx + r + 1):
            if (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r:
                c.set(x, y, color)
    c.disc(cx, cy, 2, BAR0, BAR1)


def bar(c: C, x0: int, x1: int, y: int, loaded: str = "meet") -> None:
    c.rect(x0, y - 1, x1 - x0, 3, BAR0)
    c.rect(x0, y, x1 - x0, 1, BAR1)
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


def lifter_stand(c: C, x: int, y: int, mode: str = "ok", arms: str = "down") -> None:
    # y is foot line. Character ~54px tall.
    hip_y = y - 22
    sh_y = y - 40
    # far leg / arm first — thicker thighs so the body reads heavy
    c.thick(x - 3, hip_y, x - 6, y - 10, 4, SKIN1, SKIN0)
    c.thick(x - 6, y - 10, x - 7, y - 2, 3, SKIN1, SKIN0)
    shoe(c, x - 13, y - 2, -1)
    if arms == "down":
        c.thick(x - 7, sh_y + 2, x - 10, sh_y + 18, 2, SKIN1, SKIN0)
        hand(c, x - 12, sh_y + 18)
    elif arms == "rack":
        c.thick(x - 7, sh_y + 2, x - 14, sh_y + 10, 2, SKIN1, SKIN0)
        hand(c, x - 16, sh_y + 8)
    elif arms == "up":
        c.thick(x - 7, sh_y + 2, x - 12, sh_y - 10, 2, SKIN1, SKIN2)
        hand(c, x - 14, sh_y - 13)
    # torso
    singlet(c, x - 8, sh_y, 16, 20)
    belt(c, x - 8, hip_y - 1, 16)
    # near leg
    c.thick(x + 3, hip_y, x + 6, y - 10, 4, SKIN1, SKIN2)
    c.thick(x + 6, y - 10, x + 6, y - 2, 3, SKIN1, SKIN2)
    shoe(c, x + 2, y - 2, 1)
    # knee wrap
    c.rect(x + 4, y - 12, 5, 2, AMBER0)
    # near arm
    if arms == "down":
        c.thick(x + 7, sh_y + 2, x + 10, sh_y + 18, 2, SKIN1, SKIN2)
        hand(c, x + 9, sh_y + 18)
    elif arms == "rack":
        c.thick(x + 7, sh_y + 2, x + 14, sh_y + 10, 2, SKIN1, SKIN2)
        hand(c, x + 14, sh_y + 8)
    elif arms == "up":
        c.thick(x + 7, sh_y + 2, x + 12, sh_y - 10, 2, SKIN1, SKIN2)
        hand(c, x + 11, sh_y - 13)
    elif arms == "out":
        c.thick(x + 7, sh_y + 2, x + 16, sh_y + 8, 2, SKIN1, SKIN2)
        hand(c, x + 16, sh_y + 6)
        c.thick(x - 7, sh_y + 2, x - 16, sh_y + 8, 2, SKIN1, SKIN0)
        hand(c, x - 19, sh_y + 6)
    head_profile(c, x - 4, sh_y - 14, "strain" if mode == "strain" else "miss" if mode == "miss" else "ok")


def squat(c: C, phase: int) -> None:
    # 0 walkout, 1 quarter, 2 hole, 3 drive, 4 rise, 5 lock
    drop = [0, 8, 16, 11, 5, 0][phase]
    wide = [2, 5, 8, 6, 3, 2][phase]
    x, foot = 40, 74
    hip_y = foot - 22 + drop
    sh_y = foot - 40 + drop
    # bar on back — distinctive squat cue
    bar(c, 12, 68, sh_y - 4)
    # far leg — hole pose keeps thighs closer to horizontal
    c.thick(x - 3, hip_y, x - 6 - wide, foot - 12, 4, SKIN1, SKIN0)
    c.thick(x - 6 - wide, foot - 12, x - 7 - wide // 2, foot - 2, 3, SKIN1, SKIN0)
    shoe(c, x - 15 - wide // 2, foot - 2, -1)
    # near leg
    c.thick(x + 3, hip_y, x + 8 + wide, foot - 12, 4, SKIN1, SKIN2)
    c.thick(x + 8 + wide, foot - 12, x + 7 + wide // 2, foot - 2, 3, SKIN1, SKIN2)
    shoe(c, x + 3 + wide // 2, foot - 2, 1)
    c.rect(x + 6 + wide, foot - 14, 5, 2, AMBER0)
    singlet(c, x - 8, sh_y, 16, 18)
    belt(c, x - 8, hip_y, 16)
    # rack elbows
    c.thick(x - 7, sh_y + 3, x - 14, sh_y + 9, 2, SKIN1, SKIN0)
    hand(c, x - 16, sh_y + 7)
    c.thick(x + 7, sh_y + 3, x + 14, sh_y + 9, 2, SKIN1, SKIN2)
    hand(c, x + 14, sh_y + 7)
    head_profile(c, x - 4, sh_y - 14, "strain" if phase in (2, 3) else "ok")


def deadlift(c: C, phase: int) -> None:
    # 0 setup, 1 break, 2 knee, 3 thigh, 4 high, 5 lock. Lock is standing, not setup.
    x, foot = 40, 74
    # bar rises; setup bar is at the shoes
    # lockout holds at the hips, not a clean to the shoulders
    bar_y = [68, 60, 54, 50, 48, 46][phase]
    hip_y = [58, 56, 54, 52, 52, 52][phase]
    sh_x = [50, 48, 44, 42, 40, 40][phase]
    sh_y = [42, 38, 34, 32, 32, 34][phase]
    hinge = phase <= 2
    bar(c, 10, 70, bar_y)
    # legs — more vertical as we lock
    c.thick(x - 4, hip_y, x - 6, foot - 10, 4, SKIN1, SKIN0)
    c.thick(x - 6, foot - 10, x - 7, foot - 2, 3, SKIN1, SKIN0)
    shoe(c, x - 14, foot - 2, -1)
    c.thick(x + 2, hip_y, x + 5, foot - 10, 4, SKIN1, SKIN2)
    c.thick(x + 5, foot - 10, x + 6, foot - 2, 3, SKIN1, SKIN2)
    shoe(c, x + 2, foot - 2, 1)
    # hinged vs upright torso
    tw, th = 15, 16
    singlet(c, sh_x - 7, sh_y, tw, th)
    belt(c, x - 8, hip_y - 1, 16)
    # straight arms to the bar
    c.thick(sh_x - 6, sh_y + 4, 28, bar_y, 2, SKIN1, SKIN0)
    c.thick(sh_x + 6, sh_y + 4, 50, bar_y, 2, SKIN1, SKIN2)
    hand(c, 26, bar_y - 1)
    hand(c, 49, bar_y - 1)
    head_x = sh_x + (6 if hinge else -3)
    head_y = sh_y - (10 if hinge else 14)
    # keep mid-pull head on canvas
    head_x = min(max(head_x, 2), 64)
    head_y = min(max(head_y, 1), 60)
    head_profile(c, head_x, head_y, "strain" if phase in (1, 2, 3) else "ok")


def bench(c: C, phase: int) -> None:
    bar_y = [22, 28, 34, 30, 26, 20][phase]
    # rack
    c.rect(8, 16, 4, 50, IRON2)
    c.rect(68, 16, 4, 50, IRON2)
    c.rect(6, 64, 8, 4, IRON1)
    c.rect(66, 64, 8, 4, IRON1)
    c.rect(8, 24, 6, 3, IRON3)
    c.rect(66, 24, 6, 3, IRON3)
    # bench pad + upright
    c.rect(16, 46, 48, 6, IRON2)
    c.rect(18, 44, 44, 3, IRON3)
    c.rect(36, 52, 6, 16, IRON1)
    c.rect(30, 66, 18, 4, IRON2)
    # body
    c.thick(22, 42, 58, 42, 4, SING1, SING2)
    c.rect(36, 40, 2, 8, AMBER1)
    belt(c, 34, 44, 10)
    # legs off the end
    c.thick(56, 44, 66, 54, 3, SKIN1, SKIN0)
    c.thick(66, 54, 68, 68, 2, SKIN1, SKIN0)
    shoe_front(c, 64, 66)
    c.thick(54, 44, 62, 56, 3, SKIN1, SKIN2)
    c.thick(62, 56, 64, 68, 2, SKIN1, SKIN2)
    shoe_front(c, 60, 66)
    # arms
    c.thick(26, 40, 24, bar_y, 2, SKIN1, SKIN2)
    c.thick(48, 40, 54, bar_y, 2, SKIN1, SKIN2)
    hand(c, 22, bar_y - 1)
    hand(c, 53, bar_y - 1)
    bar(c, 12, 68, bar_y)
    head_front(c, 12, 32, "strain" if phase in (2, 3, 4) else "ok")


def idle(c: C, i: int) -> None:
    lifter_stand(c, 40, 74, "ok", "down")
    # 2px breath: shift singlet highlight
    if i % 2:
        c.rect(33, 34, 12, 1, SING2)


def success(c: C, i: int) -> None:
    arms = ["out", "out", "up", "up"][i]
    lifter_stand(c, 40, 74, "ok", arms)
    if i >= 2:
        for pt in ((58, 16), (61, 14), (63, 17), (56, 13), (60, 12)):
            c.set(*pt, CHALK)


def miss(c: C, i: int) -> None:
    # somber step-back, not a joke game-over
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
    # lamp
    c.rect(w // 2 - 1, 8, 2, 10, STEEL)
    c.oval(w // 2, 20, 6, 3, AMBER1, AMBER2)
    # staged wash, not a hard triangle or grain spray
    for y in range(22, 130):
        half = 18 + (y - 22) // 2
        for x in range(w // 2 - half, w // 2 + half + 1):
            if 0 <= x < w and (x + y) % 2 == 0 and (x + 2 * y) % 5 != 0:
                if c.get(x, y) in (BRICK0, BRICK1, BRICK2, IRON0):
                    c.set(x, y, AMBER0 if abs(x - w // 2) < half // 3 and y % 3 == 0 else IRON2)
    c.rect(0, 112, w, h - 112, IRON1)
    # wood platform
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
    # plate tree
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
    # judge lights
    c.rect(68, 18, 24, 8, IRON1)
    for x in (72, 80, 88):
        c.disc(x, 22, 3, CHALK, TAPE)
    # amber lamp + staged wash (dither, not film grain)
    c.rect(28, 10, 2, 18, STEEL)
    c.oval(29, 30, 5, 3, AMBER1, AMBER2)
    for y in range(32, 168):
        half = 10 + (y - 32) // 2
        for x in range(20, min(w - 1, 29 + half)):
            dx = abs(x - (29 + half // 3))
            if dx <= half and (x + y) % 2 == 0 and (x * 2 + y) % 5 != 0:
                if c.get(x, y) in (BRICK0, BRICK1, BRICK2, IRON0):
                    c.set(x, y, AMBER0 if dx < half // 2 and y % 3 == 0 else IRON2)
    # floor + platform
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
    # plate tree
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


if __name__ == "__main__":
    main()
