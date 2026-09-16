#!/usr/bin/env python3
"""Validate a delivered hand-pixel package against PRODUCTION_SPEC.md.

This encodes the mechanical half of the spec so a human artist can self-check
before handoff and Independent QA can re-run the same checks on the exact SHA.
It cannot judge craft. A package that passes here has cleared hygiene only.

Checks:
    * every frame in production-frame-list.csv exists
    * masters are 320x320 RGBA, cards 104x104 RGBA
    * binary alpha (no semi-transparent fringe)
    * every opaque pixel is a palette colour (palette/iron-amber-v2.json)
    * per-frame colour budget (<= 40 masters, <= 16 cards)
    * 2x lattice integrity: every 2x2 block is uniform (proves a 160/52 lattice export,
      i.e. no sub-lattice detail, no resampling)
    * nothing drawn below master row 318; standing sheets touch the ground band
    * deadlift setup != lockout (frame-01 vs frame-06 silhouette delta)
    * light != max for frames 01/03/06 of each lift
    * per-lift, per-effort success and miss sheets exist (no shared miss sheet)

Usage:
    python3 validate_package.py PACKAGE_DIR [--csv production-frame-list.csv] [--json report.json]
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

import warnings

from PIL import Image

warnings.filterwarnings("ignore", category=DeprecationWarning)

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DEFAULT_CSV = ROOT / "production-frame-list.csv"
PALETTE = ROOT / "palette" / "iron-amber-v2.json"

MASTER = 320
CARD = 104
MASTER_MAX_COLORS = 40
CARD_MAX_COLORS = 16
GROUND_BAND = (296, 318)          # master rows where shoe bottoms / shadow must land
DEADLIFT_LOCK_DELTA = 2500        # matches arcade/scripts/check_sprites.py
LIGHT_MAX_DELTA = 900


def palette_rgb() -> set[tuple[int, int, int]]:
    data = json.loads(PALETTE.read_text())
    out: set[tuple[int, int, int]] = set()
    for colors in data["ramps"].values():
        for value in colors.values():
            v = value.lstrip("#")
            out.add(tuple(int(v[i : i + 2], 16) for i in (0, 2, 4)))  # type: ignore[arg-type]
    return out


def pixels(im: Image.Image) -> list[tuple[int, int, int, int]]:
    return list(im.convert("RGBA").getdata())


def lattice_ok(im: Image.Image) -> bool:
    px = im.convert("RGBA").load()
    for y in range(0, im.height, 2):
        for x in range(0, im.width, 2):
            p = px[x, y]
            if px[x + 1, y] != p or px[x, y + 1] != p or px[x + 1, y + 1] != p:
                return False
    return True


def silhouette_delta(a: Path, b: Path) -> int:
    da, db = pixels(Image.open(a)), pixels(Image.open(b))
    return sum(1 for pa, pb in zip(da, db, strict=True) if pa != pb)


def check_image(path: Path, size: int, max_colors: int, pal: set[tuple[int, int, int]], problems: list[str], standing: bool) -> None:
    im = Image.open(path)
    if im.mode != "RGBA":
        problems.append(f"{path}: mode {im.mode}, want RGBA")
        im = im.convert("RGBA")
    if im.size != (size, size):
        problems.append(f"{path}: size {im.size}, want {size}x{size}")
        return
    data = pixels(im)
    if any(0 < a < 255 for *_rgb, a in data):
        problems.append(f"{path}: semi-transparent pixels (alpha must be 0 or 255)")
    colors = {(r, g, b) for r, g, b, a in data if a}
    if len(colors) > max_colors:
        problems.append(f"{path}: {len(colors)} colours, budget {max_colors}")
    off = colors - pal
    if off:
        sample = ", ".join("#%02X%02X%02X" % c for c in sorted(off)[:4])
        problems.append(f"{path}: {len(off)} colours not in palette (e.g. {sample})")
    if not lattice_ok(im):
        problems.append(f"{path}: not a clean 2x lattice export (found sub-2px detail)")
    alpha = im.split()[3]
    bbox = alpha.getbbox()
    if bbox and bbox[3] - 1 > 318 and size == MASTER:
        problems.append(f"{path}: pixels below row 318 (bottom {bbox[3] - 1})")
    if standing and bbox and not (GROUND_BAND[0] <= bbox[3] - 1 <= GROUND_BAND[1]):
        problems.append(f"{path}: standing sheet bottom row {bbox[3] - 1} outside ground band {GROUND_BAND}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("package", type=Path)
    ap.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    ap.add_argument("--json", type=Path, default=None)
    args = ap.parse_args()

    pal = palette_rgb()
    problems: list[str] = []
    rows = list(csv.DictReader(args.csv.open()))
    seen_sheets: set[str] = set()
    for row in rows:
        rel = row["export_path"].lstrip("/").removeprefix("sprites/")
        path = args.package / rel
        if not path.exists():
            problems.append(f"missing {path}")
            continue
        is_card = row["sheet"] == "cards"
        standing = row["ground_contact"] == "yes"
        check_image(path, CARD if is_card else MASTER, CARD_MAX_COLORS if is_card else MASTER_MAX_COLORS, pal, problems, standing)
        seen_sheets.add(row["sheet"])

    dl = args.package / "deadlift"
    if (dl / "frame-01.png").exists() and (dl / "frame-06.png").exists():
        d = silhouette_delta(dl / "frame-01.png", dl / "frame-06.png")
        if d < DEADLIFT_LOCK_DELTA:
            problems.append(f"deadlift lockout too close to setup (delta {d} < {DEADLIFT_LOCK_DELTA})")
    for lift in ("squat", "bench", "deadlift"):
        for frame in ("frame-01.png", "frame-03.png", "frame-06.png"):
            a, b = args.package / lift / frame, args.package / f"{lift}-max" / frame
            if a.exists() and b.exists():
                d = silhouette_delta(a, b)
                if d < LIGHT_MAX_DELTA:
                    problems.append(f"{lift} {frame}: light/max too similar (delta {d} < {LIGHT_MAX_DELTA})")
        for outcome in ("success", "miss"):
            for effort in ("", "-max"):
                sheet = f"{outcome}-{lift}{effort}"
                if sheet not in seen_sheets:
                    problems.append(f"no per-lift outcome sheet {sheet}/ (shared outcome sheets are not accepted)")

    report = {"package": str(args.package), "frames_listed": len(rows), "problems": problems, "hygiene_pass": not problems,
              "note": "hygiene only — craft verdict belongs to Independent QA"}
    if args.json:
        args.json.write_text(json.dumps(report, indent=2))
    for p in problems:
        print("FAIL", p)
    print(f"{len(rows)} frames listed; {len(problems)} problems; hygiene {'PASS' if not problems else 'FAIL'} (not a craft verdict)")
    raise SystemExit(1 if problems else 0)


if __name__ == "__main__":
    main()
