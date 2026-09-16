#!/usr/bin/env python3
"""Copy Gate 1 sample masters into arcade/public/sprites and add per-lift outcomes."""

from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
PKG = Path(__file__).resolve().parents[1] / "package" / "sprites"
PUB = ROOT / "public" / "sprites"


def copytree_overwrite(src: Path, dst: Path) -> None:
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)


def copy_file(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def sheet(folder: Path, count: int, cols: int = 4, rows: int = 1) -> None:
    frames = [Image.open(folder / f"frame-{i:02d}.png") for i in range(1, count + 1)]
    im = Image.new("RGBA", (320 * cols, 320 * rows), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        im.paste(fr, ((i % cols) * 320, (i // cols) * 320), fr)
    im.save(folder / "sheet-transparent.png")


def copy_frames(src_dir: Path, dst_dir: Path, mapping: list[str]) -> None:
    dst_dir.mkdir(parents=True, exist_ok=True)
    for i, name in enumerate(mapping, start=1):
        shutil.copy2(src_dir / name, dst_dir / f"frame-{i:02d}.png")
    sheet(dst_dir, len(mapping))


def main() -> None:
    for sheet_name in (
        "squat",
        "squat-max",
        "deadlift",
        "deadlift-max",
        "idle",
        "success-squat",
        "success-squat-max",
        "miss-squat",
        "miss-squat-max",
    ):
        copytree_overwrite(PKG / sheet_name, PUB / sheet_name)

    for name in ("squat-light.png", "squat-max.png"):
        copy_file(PKG / "cards" / name, PUB / "cards" / name)

    for name in ("title.png", "title-wide.png", "title-portrait.png", "platform.png", "model-sheet.png", "identity.png"):
        copy_file(PKG / name, PUB / name)

    # Bench outcomes: lift-correct copies of existing bench art (not Gate 1 redraws).
    for effort, src in (("", PUB / "bench"), ("-max", PUB / "bench-max")):
        copy_frames(src, PUB / f"success-bench{effort}", ["frame-06.png", "frame-06.png", "frame-05.png", "frame-04.png"])
        copy_frames(src, PUB / f"miss-bench{effort}", ["frame-04.png", "frame-03.png", "frame-02.png", "frame-01.png"])

    # Deadlift outcomes from the new Gate 1 deadlift sheets.
    for effort, src in (("", PUB / "deadlift"), ("-max", PUB / "deadlift-max")):
        copy_frames(src, PUB / f"success-deadlift{effort}", ["frame-06.png", "frame-06.png", "frame-05.png", "frame-04.png"])
        copy_frames(src, PUB / f"miss-deadlift{effort}", ["frame-03.png", "frame-02.png", "frame-01.png", "frame-01.png"])

    plates = PUB / "plates"
    if plates.exists():
        shutil.rmtree(plates)

    # Keep legacy shared folders pointing at squat so old paths 404-safe if anything still links them.
    copytree_overwrite(PUB / "success-squat", PUB / "success")
    copytree_overwrite(PUB / "miss-squat", PUB / "miss")
    print("integrated into", PUB)


if __name__ == "__main__":
    main()
