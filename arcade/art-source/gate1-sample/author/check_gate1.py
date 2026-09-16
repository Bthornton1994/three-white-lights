#!/usr/bin/env python3
"""Hygiene check for the Gate 1 sample files only (not the full 94-row package)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
PKG = HERE.parent / "package" / "sprites"
PAL = json.loads((HERE.parent / "palette.json").read_text())

PAL_RGB = set()
for ramp in PAL["ramps"].values():
    for value in ramp.values():
        v = value.lstrip("#")
        PAL_RGB.add(tuple(int(v[i : i + 2], 16) for i in (0, 2, 4)))


def lattice_ok(im: Image.Image) -> bool:
    px = im.convert("RGBA").load()
    for y in range(0, im.height, 2):
        for x in range(0, im.width, 2):
            p = px[x, y]
            if px[x + 1, y] != p or px[x, y + 1] != p or px[x + 1, y + 1] != p:
                return False
    return True


def check(path: Path, size: tuple[int, int] | None, max_colors: int, lattice: bool) -> list[str]:
    problems: list[str] = []
    im = Image.open(path).convert("RGBA")
    if size and im.size != size:
        problems.append(f"{path.name}: size {im.size} want {size}")
    data = list(im.getdata())
    if any(0 < a < 255 for *_r, a in data):
        problems.append(f"{path.name}: semi-transparent pixels")
    colors = {(r, g, b) for r, g, b, a in data if a}
    if len(colors) > max_colors:
        problems.append(f"{path.name}: {len(colors)} colours > {max_colors}")
    off = colors - PAL_RGB
    if off:
        sample = ", ".join("#%02X%02X%02X" % c for c in sorted(off)[:4])
        problems.append(f"{path.name}: {len(off)} off-palette ({sample})")
    if lattice and not lattice_ok(im):
        problems.append(f"{path.name}: not a clean 2x lattice")
    return problems


def sil_delta(a: Path, b: Path) -> int:
    da, db = list(Image.open(a).convert("RGBA").getdata()), list(Image.open(b).convert("RGBA").getdata())
    return sum(1 for pa, pb in zip(da, db, strict=True) if pa != pb)


def main() -> None:
    problems: list[str] = []
    for sheet in ("squat", "squat-max", "deadlift", "deadlift-max"):
        for i in range(1, 7):
            problems += check(PKG / sheet / f"frame-{i:02d}.png", (320, 320), 40, True)
    for i in range(1, 5):
        problems += check(PKG / "idle" / f"frame-{i:02d}.png", (320, 320), 40, True)
    for name in ("success-squat", "success-squat-max", "miss-squat", "miss-squat-max"):
        for i in range(1, 5):
            problems += check(PKG / name / f"frame-{i:02d}.png", (320, 320), 40, True)
    for name in ("squat-light.png", "squat-max.png"):
        problems += check(PKG / "cards" / name, (104, 104), 16, True)
    problems += check(PKG / "title.png", (1008, 1792), 64, True)
    problems += check(PKG / "title-wide.png", (1792, 1008), 64, True)
    problems += check(PKG / "platform.png", (1280, 720), 64, True)

    d = sil_delta(PKG / "deadlift" / "frame-01.png", PKG / "deadlift" / "frame-06.png")
    if d < 2500:
        problems.append(f"deadlift setup/lockout delta {d} < 2500")
    else:
        print(f"deadlift setup/lockout delta {d}")
    lm = sil_delta(PKG / "squat" / "frame-03.png", PKG / "squat-max" / "frame-03.png")
    if lm < 900:
        problems.append(f"squat hole light/max delta {lm} < 900")
    else:
        print(f"squat hole light/max delta {lm}")

    for p in problems:
        print("FAIL", p)
    print(f"{len(problems)} problems; hygiene {'PASS' if not problems else 'FAIL'} (not a craft verdict)")
    raise SystemExit(1 if problems else 0)


if __name__ == "__main__":
    main()
