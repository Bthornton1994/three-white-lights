#!/usr/bin/env python3
"""Import pass-4 Imagine lockout / identity / title into 320 masters.

Does not touch squat or bench production frames.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

from index_drawn_sprites import (
    EVIDENCE,
    MASTER,
    OUT,
    SCENE_COLORS,
    SPRITE_COLORS,
    WORKING,
    make_master,
    qa_frame,
    save_grid,
    sheet_of,
    split_grid,
    to_rgba,
)

ROOT = Path(__file__).resolve().parents[1]


def export_title_master(raw: Path, dest: Path) -> dict:
    """Quantize in place. No downsample — title is a 16:9 scene master."""
    im = Image.open(raw).convert("RGB")
    q = im.quantize(colors=SCENE_COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    out = q.convert("RGB")
    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest)
    n = len(set(out.getdata()))
    rec = {"path": str(dest.relative_to(ROOT)), "size": list(out.size), "colors": n, "resample": "none"}
    if n > 64:
        raise SystemExit(f"title colors {n}")
    print(f"title {out.size} colors={n}")
    return rec


def overwrite_lockout(folder: str, lock_jpeg: Path) -> None:
    master = make_master(to_rgba(lock_jpeg))
    stem = "frame-06.png"
    master_dir = WORKING / "masters-320" / folder
    master_dir.mkdir(parents=True, exist_ok=True)
    master.save(master_dir / stem)
    rec = qa_frame(master, OUT / folder / stem)
    print(f"lockout overlay {folder}/{stem} colors={rec['colors']}")


def rebuild_sheet(name: str, count: int, cols: int) -> None:
    frames = [Image.open(OUT / name / f"frame-{i:02d}.png") for i in range(1, count + 1)]
    sheet_of(frames, cols).save(OUT / name / "sheet-transparent.png")


def main() -> None:
    report: dict = {"pass": "pass4-lockout-identity-title"}
    grids = {
        "deadlift": ("deadlift-light.jpg", 2, 3),
        "deadlift-max": ("deadlift-max.jpg", 2, 3),
        "idle": ("idle.jpg", 2, 2),
        "success": ("success.jpg", 2, 2),
        "miss": ("miss.jpg", 2, 2),
    }
    for name, (fname, rows, cols) in grids.items():
        cells = split_grid(to_rgba(WORKING / fname), rows, cols)
        report[name] = save_grid(name, cells, cols)
    overwrite_lockout("deadlift", WORKING / "lockout-light.jpg")
    overwrite_lockout("deadlift-max", WORKING / "lockout-max.jpg")
    rebuild_sheet("deadlift", 6, 3)
    rebuild_sheet("deadlift-max", 6, 3)

    ident = Image.open(OUT / "idle" / "frame-01.png")
    ident.save(OUT / "identity.png")
    (WORKING / "masters-320").mkdir(parents=True, exist_ok=True)
    Image.open(WORKING / "masters-320" / "idle" / "frame-01.png").save(WORKING / "masters-320" / "identity.png")

    report["title"] = export_title_master(WORKING / "title.jpg", OUT / "title.png")
    Image.open(OUT / "title.png").save(EVIDENCE / "title.png")
    (WORKING / "pass4-report.json").write_text(json.dumps(report, indent=2))
    print("pass4 index ok")


if __name__ == "__main__":
    main()
