"""160-lattice pixel canvas. No Pillow primitives as finished artwork.

Pixels are named palette entries. Construction uses scanline masks and
explicit stamps; lighting is posterized per span (16-bit cluster shading).
"""

from __future__ import annotations

import json
import zipfile
from pathlib import Path
from typing import Iterable

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
PALETTE_PATH = ROOT / "palette.json"


def load_palette() -> dict[str, tuple[int, int, int]]:
    data = json.loads(PALETTE_PATH.read_text())
    out: dict[str, tuple[int, int, int]] = {}
    for ramp in data["ramps"].values():
        for name, value in ramp.items():
            v = value.lstrip("#")
            out[name] = (int(v[0:2], 16), int(v[2:4], 16), int(v[4:6], 16))
    return out


PAL = load_palette()

Mask = list[list[bool]]
Name = str | None


class Canvas:
    def __init__(self, w: int, h: int) -> None:
        self.w = w
        self.h = h
        self.p: list[list[Name]] = [[None] * w for _ in range(h)]

    def put(self, x: int, y: int, name: Name) -> None:
        if name is None:
            return
        if 0 <= x < self.w and 0 <= y < self.h:
            self.p[y][x] = name

    def get(self, x: int, y: int) -> Name:
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.p[y][x]
        return None

    def span(self, y: int, x0: int, x1: int, name: Name) -> None:
        if x1 < x0:
            x0, x1 = x1, x0
        for x in range(x0, x1 + 1):
            self.put(x, y, name)

    def blit(self, other: Canvas, ox: int = 0, oy: int = 0) -> None:
        for y in range(other.h):
            row = other.p[y]
            for x in range(other.w):
                n = row[x]
                if n is not None:
                    self.put(x + ox, y + oy, n)

    def stamp(self, ox: int, oy: int, rows: list[str], cmap: dict[str, str], skip: str = ".") -> None:
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch == skip or ch == " ":
                    continue
                name = cmap.get(ch)
                if name:
                    self.put(ox + i, oy + j, name)

    def to_image(self) -> Image.Image:
        im = Image.new("RGBA", (self.w, self.h), (0, 0, 0, 0))
        px = im.load()
        for y in range(self.h):
            for x in range(self.w):
                n = self.p[y][x]
                if n is None:
                    continue
                rgb = PAL[n]
                px[x, y] = (rgb[0], rgb[1], rgb[2], 255)
        return im

    def export_native(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self.to_image().save(path)

    def export_master(self, path: Path, scale: int = 2) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        native = self.to_image()
        master = native.resize((self.w * scale, self.h * scale), Image.Resampling.NEAREST)
        master.save(path)

    def opaque_count(self) -> int:
        return sum(1 for y in range(self.h) for x in range(self.w) if self.p[y][x])

    def apply_patches(self, patches: Iterable[tuple[int, int, Name]]) -> None:
        for x, y, name in patches:
            self.put(x, y, name)


def empty_mask(w: int, h: int) -> Mask:
    return [[False] * w for _ in range(h)]


def or_mask(a: Mask, b: Mask) -> Mask:
    h = len(a)
    w = len(a[0])
    out = empty_mask(w, h)
    for y in range(h):
        for x in range(w):
            out[y][x] = a[y][x] or b[y][x]
    return out


def mask_from_canvas(c: Canvas) -> Mask:
    return [[c.p[y][x] is not None for x in range(c.w)] for y in range(c.h)]


def raster_poly(w: int, h: int, pts: list[tuple[float, float]]) -> Mask:
    """Even-odd scanline fill. Vertices are artist-authored, not a primitive stamp."""
    mask = empty_mask(w, h)
    if len(pts) < 3:
        return mask
    ys = [p[1] for p in pts]
    y0 = max(0, int(min(ys)))
    y1 = min(h - 1, int(max(ys)))
    n = len(pts)
    for y in range(y0, y1 + 1):
        y_scan = y + 0.5
        xs: list[float] = []
        for i in range(n):
            xA, yA = pts[i]
            xB, yB = pts[(i + 1) % n]
            if yA == yB:
                continue
            if yA > yB:
                xA, yA, xB, yB = xB, yB, xA, yA
            if y_scan < yA or y_scan >= yB:
                continue
            t = (y_scan - yA) / (yB - yA)
            xs.append(xA + t * (xB - xA))
        xs.sort()
        for i in range(0, len(xs) - 1, 2):
            xa = int(round(xs[i]))
            xb = int(round(xs[i + 1]))
            if xb < xa:
                xa, xb = xb, xa
            for x in range(max(0, xa), min(w, xb + 1)):
                mask[y][x] = True
    return mask


def raster_capsule(w: int, h: int, x0: float, y0: float, x1: float, y1: float, r0: float, r1: float) -> Mask:
    """Distance-to-segment mask used only as a construction volume, then posterized."""
    mask = empty_mask(w, h)
    dx = x1 - x0
    dy = y1 - y0
    length = (dx * dx + dy * dy) ** 0.5
    if length < 0.001:
        length = 0.001
        dx, dy = 0.0, 1.0
    rmax = max(r0, r1) + 1.5
    minx = max(0, int(min(x0, x1) - rmax))
    maxx = min(w - 1, int(max(x0, x1) + rmax))
    miny = max(0, int(min(y0, y1) - rmax))
    maxy = min(h - 1, int(max(y0, y1) + rmax))
    for y in range(miny, maxy + 1):
        for x in range(minx, maxx + 1):
            px = x + 0.5
            py = y + 0.5
            t = ((px - x0) * dx + (py - y0) * dy) / (length * length)
            t = 0.0 if t < 0.0 else 1.0 if t > 1.0 else t
            cx = x0 + t * dx
            cy = y0 + t * dy
            dist = ((px - cx) ** 2 + (py - cy) ** 2) ** 0.5
            r = r0 + t * (r1 - r0)
            if dist <= r + 0.28:
                mask[y][x] = True
    return mask


def shade_mask(
    canvas: Canvas,
    mask: Mask,
    ramp: tuple[str, str, str, str],
    lit_left: bool = True,
    rim_lit: str | None = None,
) -> None:
    """Posterize a mask into 3 plane tones + selective silhouette.

    lit / mid / shadow / contact. Lit-side silhouette uses the darkest ramp
    step, shadow-side uses OUT. Interior never uses OUT.
    """
    lit, mid, shadow, contact = ramp
    h = canvas.h
    w = canvas.w
    for y in range(h):
        xs = [x for x in range(w) if mask[y][x]]
        if not xs:
            continue
        # may be multiple spans
        spans: list[tuple[int, int]] = []
        start = xs[0]
        prev = xs[0]
        for x in xs[1:]:
            if x == prev + 1:
                prev = x
                continue
            spans.append((start, prev))
            start = x
            prev = x
        spans.append((start, prev))
        for x0, x1 in spans:
            width = x1 - x0 + 1
            for x in range(x0, x1 + 1):
                t = 0.0 if width <= 1 else (x - x0) / (width - 1)
                if not lit_left:
                    t = 1.0 - t
                if t < 0.22:
                    name = lit
                elif t < 0.58:
                    name = mid
                elif t < 0.86:
                    name = shadow
                else:
                    name = contact
                # slightly lighter top plane
                if y > 0 and not mask[y - 1][x] and t < 0.5:
                    name = lit
                canvas.put(x, y, name)
            left = x0 if lit_left else x1
            right = x1 if lit_left else x0
            canvas.put(left, y, rim_lit or contact)
            canvas.put(right, y, "OUT")


def shade_plate(canvas: Canvas, cx: int, cy: int, radius: int, ramp: tuple[str, str, str], hub: bool = True) -> None:
    """IPF plate: flat face, 3-tone lighting, 2x2 rim checker, hub. Not a gradient."""
    dark, mid, lite = ramp
    r2 = (radius + 0.2) ** 2
    for y in range(cy - radius, cy + radius + 1):
        for x in range(cx - radius, cx + radius + 1):
            dx = x - cx
            dy = y - cy
            if dx * dx + dy * dy > r2:
                continue
            # upper-left key: 10 o'clock highlight, 4-5 o'clock shadow
            score = -0.65 * dx - 0.75 * dy
            edge = abs((dx * dx + dy * dy) ** 0.5 - radius)
            if edge < 1.2:
                # 2x2 checker rim
                name = lite if ((x >> 1) + (y >> 1)) % 2 == 0 else dark
            elif score > radius * 0.35:
                name = lite
            elif score < -radius * 0.25:
                name = dark
            else:
                name = mid
            canvas.put(x, y, name)
    if hub:
        hr = max(3, radius // 6)
        for y in range(cy - hr, cy + hr + 1):
            for x in range(cx - hr, cx + hr + 1):
                if (x - cx) ** 2 + (y - cy) ** 2 <= hr * hr:
                    canvas.put(x, y, "BAR1")
        canvas.put(cx - hr // 2, cy - hr // 2, "BAR2")  # 10 o'clock glint
        canvas.put(cx + hr // 2, cy + hr // 2, "BAR0")


def draw_bar(canvas: Canvas, x0: int, x1: int, y: int, bow: int = 0, sleeve: int = 3) -> None:
    """2px shaft, BAR2 highlight, BAR1 body, BAR0 underside at sleeves. Bow at ends."""
    mid = (x0 + x1) / 2.0
    half = max(1.0, (x1 - x0) / 2.0)
    for x in range(x0, x1 + 1):
        t = abs(x - mid) / half
        by = y + int(round(bow * t * t))
        canvas.put(x, by - 1, "BAR2")
        canvas.put(x, by, "BAR1")
        if t > 0.82:
            canvas.put(x, by + 1, "BAR0")
    # sleeves
    for sx in (x0, x1 - sleeve + 1):
        for i in range(sleeve):
            canvas.put(sx + i, y - 1, "BAR2")
            canvas.put(sx + i, y, "BAR1")
            canvas.put(sx + i, y + 1, "BAR0")


def ground_shadow(canvas: Canvas, cx: int, cy: int, rx: int, ry: int) -> None:
    """Cast contact ellipse — this is a shadow, not a body primitive as the figure."""
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            nx = (x - cx) / max(rx, 1)
            ny = (y - cy) / max(ry, 1)
            if nx * nx + ny * ny <= 1.05:
                canvas.put(x, y, "SHAD")


# --- pixel fonts (explicit glyphs, not system TTF) ---

FONT5: dict[str, list[str]] = {
    "A": ["01110", "10001", "11111", "10001", "10001"],
    "B": ["11110", "10001", "11110", "10001", "11110"],
    "C": ["01111", "10000", "10000", "10000", "01111"],
    "D": ["11110", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "11110", "10000", "11111"],
    "F": ["11111", "10000", "11110", "10000", "10000"],
    "G": ["01111", "10000", "10111", "10001", "01110"],
    "H": ["10001", "10001", "11111", "10001", "10001"],
    "I": ["11111", "00100", "00100", "00100", "11111"],
    "J": ["00111", "00001", "00001", "10001", "01110"],
    "K": ["10001", "10010", "11100", "10010", "10001"],
    "L": ["10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10001", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001"],
    "O": ["01110", "10001", "10001", "10001", "01110"],
    "P": ["11110", "10001", "11110", "10000", "10000"],
    "Q": ["01110", "10001", "10001", "10011", "01111"],
    "R": ["11110", "10001", "11110", "10010", "10001"],
    "S": ["01111", "10000", "01110", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "01010", "00100"],
    "W": ["10001", "10001", "10101", "11011", "10001"],
    "X": ["10001", "01010", "00100", "01010", "10001"],
    "Y": ["10001", "01010", "00100", "00100", "00100"],
    "Z": ["11111", "00010", "00100", "01000", "11111"],
    " ": ["00000", "00000", "00000", "00000", "00000"],
    "&": ["01100", "10010", "01101", "10010", "01101"],
    "-": ["00000", "00000", "11111", "00000", "00000"],
    ".": ["00000", "00000", "00000", "00000", "00100"],
    ":": ["00000", "00100", "00000", "00100", "00000"],
    "!": ["00100", "00100", "00100", "00000", "00100"],
    "0": ["01110", "10011", "10101", "11001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00110", "01000", "11111"],
    "3": ["11110", "00001", "01110", "00001", "11110"],
    "4": ["10010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "11110", "00001", "11110"],
    "6": ["01110", "10000", "11110", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "00100"],
    "8": ["01110", "10001", "01110", "10001", "01110"],
    "9": ["01110", "10001", "01111", "00001", "01110"],
}


def text5(canvas: Canvas, x: int, y: int, s: str, color: str, shadow: str | None = None) -> None:
    cx = x
    for ch in s.upper():
        g = FONT5.get(ch, FONT5[" "])
        for j, row in enumerate(g):
            for i, bit in enumerate(row):
                if bit != "1":
                    continue
                if shadow:
                    canvas.put(cx + i + 1, y + j + 1, shadow)
                canvas.put(cx + i, y + j, color)
        cx += 6


def text5_scaled(canvas: Canvas, x: int, y: int, s: str, color: str, scale: int, shadow: str | None = None) -> None:
    cx = x
    for ch in s.upper():
        g = FONT5.get(ch, FONT5[" "])
        for j, row in enumerate(g):
            for i, bit in enumerate(row):
                if bit != "1":
                    continue
                for dy in range(scale):
                    for dx in range(scale):
                        if shadow:
                            canvas.put(cx + i * scale + dx + scale, y + j * scale + dy + scale, shadow)
                        canvas.put(cx + i * scale + dx, y + j * scale + dy, color)
        cx += 6 * scale


def write_ora(path: Path, layers: list[tuple[str, Canvas]]) -> None:
    """OpenRaster stack a human can open in Krita / Pixelorama / GIMP."""
    path.parent.mkdir(parents=True, exist_ok=True)
    w = max(c.w for _, c in layers)
    h = max(c.h for _, c in layers)
    stack_rows = []
    for i, (name, _c) in enumerate(reversed(layers)):
        stack_rows.append(
            f'    <layer name="{name}" src="data/{i:02d}-{name}.png" composite-op="svg:src-over" opacity="1.0" visibility="visible" />'
        )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<image version="0.0.1" w="{w}" h="{h}">\n'
        "  <stack>\n"
        + "\n".join(stack_rows)
        + "\n  </stack>\n</image>\n"
    )
    tmp = path.with_suffix(".ora.d")
    tmp.mkdir(parents=True, exist_ok=True)
    (tmp / "mimetype").write_text("image/openraster")
    (tmp / "stack.xml").write_text(xml)
    data = tmp / "data"
    data.mkdir(exist_ok=True)
    for i, (name, c) in enumerate(reversed(layers)):
        c.export_native(data / f"{i:02d}-{name}.png")
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.write(tmp / "mimetype", "mimetype", compress_type=zipfile.ZIP_STORED)
        zf.write(tmp / "stack.xml", "stack.xml")
        for p in sorted(data.glob("*.png")):
            zf.write(p, f"data/{p.name}")


def nn2(im: Image.Image) -> Image.Image:
    return im.resize((im.width * 2, im.height * 2), Image.Resampling.NEAREST)


def silhouette_rim(canvas: Canvas) -> None:
    """Lit-side warm rim, shadow-side OUT. Applied after compositing."""
    orig = [row[:] for row in canvas.p]
    h, w = canvas.h, canvas.w

    def empty(x: int, y: int) -> bool:
        if x < 0 or y < 0 or x >= w or y >= h:
            return True
        return orig[y][x] is None

    for y in range(h):
        for x in range(w):
            n = orig[y][x]
            if n is None:
                continue
            lit_edge = empty(x - 1, y) or empty(x, y - 1)
            sh_edge = empty(x + 1, y) or empty(x, y + 1)
            if lit_edge:
                if n.startswith("SING") or n in {"BELT", "AMB0", "AMB1"}:
                    canvas.put(x, y, "AMB2")
                elif n.startswith("SKIN") or n.startswith("FLUSH"):
                    canvas.put(x, y, "SKIN4")
                elif n.startswith("HAIR"):
                    canvas.put(x, y, "HAIR2")
                elif n.startswith("KNEE"):
                    canvas.put(x, y, "KNEE2")
                elif n.startswith("SHOE"):
                    canvas.put(x, y, "SHOE1")
            elif sh_edge:
                if n.startswith("HAIR"):
                    continue
                if n.startswith("SKIN") or n.startswith("FLUSH"):
                    canvas.put(x, y, "SKIN0")
                elif n.startswith("SING"):
                    canvas.put(x, y, "SING0")
                else:
                    canvas.put(x, y, "OUT")
