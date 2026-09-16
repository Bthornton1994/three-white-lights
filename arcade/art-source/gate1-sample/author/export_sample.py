#!/usr/bin/env python3
"""Export Gate 1 production-art sample: 160 lattice + 2x masters + layered ORA."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
SRC = HERE.parent
PKG = SRC / "package" / "sprites"
L160 = SRC / "lattice-160"
L52 = SRC / "lattice-52" / "cards"
LAYERS = SRC / "source" / "layers"
ORA = SRC / "source"
PREV = SRC / "previews"
PUBLIC = SRC.parents[1] / "public" / "sprites"

sys.path.insert(0, str(HERE))

from pixel_engine import Canvas, nn2, write_ora  # noqa: E402
from reed import (  # noqa: E402
    FACES,
    deadlift_pose,
    draw_lifter,
    draw_model_sheet,
    draw_platform,
    draw_squat_card,
    draw_title_portrait,
    draw_title_wide,
    face_stamp,
    idle_pose,
    squat_outcome,
    squat_pose,
)


def save_frame(canvas: Canvas, sheet: str, frame: int, layers: list[tuple[str, Canvas]] | None = None) -> None:
    name = f"frame-{frame:02d}.png"
    native_dir = L160 / sheet
    canvas.export_native(native_dir / name)
    canvas.export_master(PKG / sheet / name, 2)
    if layers:
        write_ora(ORA / f"{sheet}-{frame:02d}.ora", layers)
        for i, (ln, ly) in enumerate(layers):
            ly.export_native(LAYERS / sheet / f"frame-{frame:02d}-{i:02d}-{ln}.png")


def sheet_png(sheet: str, count: int, cols: int = 3, rows: int = 2) -> None:
    frames = [Image.open(PKG / sheet / f"frame-{i:02d}.png") for i in range(1, count + 1)]
    im = Image.new("RGBA", (320 * cols, 320 * rows), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        x = (i % cols) * 320
        y = (i // cols) * 320
        im.paste(fr, (x, y), fr)
    im.save(PKG / sheet / "sheet-transparent.png")


def contact_strip(paths: list[Path], dest: Path) -> None:
    ims = [Image.open(p).convert("RGBA") for p in paths]
    out = Image.new("RGBA", (320 * len(ims), 320), (16, 12, 12, 255))
    for i, im in enumerate(ims):
        out.paste(im, (i * 320, 0), im)
    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest)


def check_face_widths() -> None:
    for name, rows in FACES.items():
        for i, row in enumerate(rows):
            if len(row) != 16:
                raise SystemExit(f"face {name} row {i} width {len(row)}: {row!r}")


def main() -> None:
    check_face_widths()
    for d in (PKG, L160, L52, LAYERS, PREV, ORA):
        d.mkdir(parents=True, exist_ok=True)

    # faces preview
    faces = Canvas(120, 28)
    x = 2
    for name in ("NEUTRAL", "BRACE", "STRAIN", "EXHALE", "GRIN", "SLACK"):
        face_stamp(faces, (x, 4), name)  # type: ignore[arg-type]
        x += 19
    faces.export_master(PREV / "faces-16x20.png", 8)

    # squat light + max
    for max_eff, sheet in ((False, "squat"), (True, "squat-max")):
        for fr in range(1, 7):
            pose = squat_pose(fr, max_eff)
            c, layers = draw_lifter(pose)
            save_frame(c, sheet, fr, layers)
        sheet_png(sheet, 6)

    # deadlift light + max
    for max_eff, sheet in ((False, "deadlift"), (True, "deadlift-max")):
        for fr in range(1, 7):
            pose = deadlift_pose(fr, max_eff)
            c, layers = draw_lifter(pose)
            save_frame(c, sheet, fr, layers)
        sheet_png(sheet, 6)

    # idle
    for fr in range(1, 5):
        c, layers = draw_lifter(idle_pose(fr))
        save_frame(c, "idle", fr, layers)
    sheet_png("idle", 4, cols=4, rows=1)

    # squat outcomes
    for kind, folder in (("success", "success-squat"), ("miss", "miss-squat")):
        for max_eff, suffix in ((False, ""), (True, "-max")):
            sheet = folder + suffix
            for fr in range(1, 5):
                pose = squat_outcome(kind, fr, max_eff)
                c, layers = draw_lifter(pose)
                save_frame(c, sheet, fr, layers)
            sheet_png(sheet, 4, cols=4, rows=1)

    # cards
    for max_eff, name in ((False, "squat-light"), (True, "squat-max")):
        card = draw_squat_card(max_eff)
        card.export_native(L52 / f"{name}.png")
        card.export_master(PKG / "cards" / f"{name}.png", 2)

    # model sheet, title, platform
    ms = draw_model_sheet()
    ms.export_native(SRC / "source" / "model-sheet-native.png")
    ms.to_image().save(PKG / "model-sheet.png")
    ms.to_image().save(PKG / "identity.png")

    title = draw_title_portrait()
    nn2(title.to_image()).save(PKG / "title.png")
    nn2(title.to_image()).save(PKG / "title-portrait.png")
    wide = draw_title_wide()
    nn2(wide.to_image()).save(PKG / "title-wide.png")
    plat = draw_platform()
    nn2(plat.to_image()).save(PKG / "platform.png")

    write_ora(ORA / "squat-light-card.ora", [("card", draw_squat_card(False))])
    write_ora(ORA / "model-sheet.ora", [("sheet", ms)])

    contact_strip([PKG / "squat" / f"frame-{i:02d}.png" for i in range(1, 7)], PREV / "strip-squat-light.png")
    contact_strip([PKG / "squat-max" / f"frame-{i:02d}.png" for i in range(1, 7)], PREV / "strip-squat-max.png")
    contact_strip(
        [PKG / "deadlift" / "frame-01.png", PKG / "deadlift" / "frame-06.png"],
        PREV / "strip-deadlift-setup-lockout.png",
    )
    print("exported", PKG)


if __name__ == "__main__":
    main()
