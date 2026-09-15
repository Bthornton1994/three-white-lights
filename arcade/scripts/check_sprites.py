#!/usr/bin/env python3
"""Fail if the arcade sprite package regresses into fringe, chroma, or JPEG grain."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SPRITES = ROOT / "public" / "sprites"


def check_rgba(path: Path) -> None:
    im = Image.open(path)
    if im.mode != "RGBA":
        raise SystemExit(f"{path}: expected RGBA, got {im.mode}")
    data = list(im.getdata())
    semi = sum(1 for _r, _g, _b, a in data if 0 < a < 255)
    mag = sum(1 for r, g, b, a in data if a > 0 and r > 170 and b > 150 and g < 130)
    colors = {(r, g, b) for r, g, b, a in data if a > 0}
    if semi:
        raise SystemExit(f"{path}: {semi} semi-transparent fringe pixels")
    if mag:
        raise SystemExit(f"{path}: {mag} magenta/purple chroma pixels")
    if len(colors) > 48:
        raise SystemExit(f"{path}: {len(colors)} unique colors (want <= 48 for 16-bit)")


def main() -> None:
    frames = list(SPRITES.glob("*/*.png"))
    if len(frames) < 30:
        raise SystemExit(f"missing sprite frames: found {len(frames)}")
    for path in frames:
        if path.name.startswith("sheet-"):
            continue
        check_rgba(path)
    for name in ("title.png", "platform.png"):
        path = SPRITES / name
        if not path.exists():
            raise SystemExit(f"missing {name}")
        if path.suffix.lower() != ".png":
            raise SystemExit(f"{name} must be PNG, not JPEG")
        im = Image.open(path)
        colors = len(set(im.convert("RGB").getdata()))
        if colors > 64:
            raise SystemExit(f"{path}: {colors} unique colors (noisy title/platform)")
    for jpeg in (SPRITES / "title.jpg", SPRITES / "platform.jpg"):
        if jpeg.exists():
            raise SystemExit(f"stale noisy JPEG still present: {jpeg}")
    setup = (SPRITES / "deadlift" / "frame-01.png").read_bytes()
    lock = (SPRITES / "deadlift" / "frame-06.png").read_bytes()
    if setup == lock:
        raise SystemExit("deadlift lockout rewound to setup")
    if silhouette_delta(SPRITES / "deadlift" / "frame-01.png", SPRITES / "deadlift" / "frame-06.png") < 2500:
        raise SystemExit("deadlift lockout silhouette is too close to setup")
    for lift in ("squat", "bench", "deadlift"):
        light_dir = SPRITES / lift
        max_dir = SPRITES / f"{lift}-max"
        if not max_dir.exists():
            raise SystemExit(f"missing maximal sheet {max_dir}")
        for frame in ("frame-01.png", "frame-03.png", "frame-06.png"):
            light = (light_dir / frame).read_bytes()
            heavy = (max_dir / frame).read_bytes()
            if light == heavy:
                raise SystemExit(f"{lift} {frame} is identical for light and max")
            if silhouette_delta(light_dir / frame, max_dir / frame) < 900:
                raise SystemExit(f"{lift} {frame} light/max silhouettes are too similar")
    print("sprite QA ok")


def silhouette_delta(a: Path, b: Path) -> int:
    ia = Image.open(a).convert("RGBA")
    ib = Image.open(b).convert("RGBA")
    da = list(ia.getdata())
    db = list(ib.getdata())
    return sum(1 for pa, pb in zip(da, db, strict=True) if pa != pb)


if __name__ == "__main__":
    main()
