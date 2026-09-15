#!/usr/bin/env python3
"""Index Imagine-drawn working sheets into the 80x80 SNES delivery package.

This is the production path for PR #69's draw-then-index pass.
Raw art is Imagine pixel-art sheets (JPEG/PNG). This script does NOT draw
anatomy. It only:

  1. chroma-keys the pink/magenta field (JPEG never hits exact #FF00FF)
  2. splits the grid
  3. crops each subject
  4. BOX-downsamples into an 80x80 canvas, feet toward the bottom
  5. quantizes opaque pixels (no dither) and forces binary alpha
  6. nearest-neighbor 4x to the 320x320 runtime frames

Pose tables in build_sprites.py are unused by this exporter.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "sprites"
WORKING = ROOT / "evidence" / "art-source"
NATIVE = 80
SCALE = 4
SPRITE_COLORS = 44
SCENE_COLORS = 60


def key_pink(rgb: np.ndarray) -> np.ndarray:
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    return (r > 140) & (g < 130) & (b > 55) & ((r - g) > 28)


def chroma_fail(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    return (alpha > 0) & (r > 170) & (b > 150) & (g < 130)


def to_rgba(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGB")
    arr = np.array(im)
    mask = key_pink(arr)
    alpha = np.where(mask, 0, 255).astype(np.uint8)
    return Image.fromarray(np.dstack([arr, alpha]), "RGBA")


def split_grid(im: Image.Image, rows: int, cols: int) -> list[Image.Image]:
    w, h = im.size
    cw, ch = w // cols, h // rows
    cells: list[Image.Image] = []
    for r in range(rows):
        for c in range(cols):
            cells.append(im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)))
    return cells


def fit_native(cell: Image.Image, size: int = NATIVE) -> Image.Image:
    arr = np.array(cell)
    alpha = arr[:, :, 3]
    opaque = alpha >= 24
    if not opaque.any():
        return Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ys, xs = np.where(opaque)
    pad = 4
    box = (
        max(0, int(xs.min()) - pad),
        max(0, int(ys.min()) - pad),
        min(cell.size[0], int(xs.max()) + pad + 1),
        min(cell.size[1], int(ys.max()) + pad + 1),
    )
    cropped = cell.crop(box)
    cw, ch = cropped.size
    # Integer BOX snap preserves chunky clusters better than a fractional BOX to 80.
    factor = max(1, min(cw, ch) // size)
    snapped = cropped.resize((max(1, cw // factor), max(1, ch // factor)), Image.Resampling.BOX)
    sw, sh = snapped.size
    scale = min((size - 2) / max(sw, 1), (size - 2) / max(sh, 1))
    nw = max(1, int(round(sw * scale)))
    nh = max(1, int(round(sh * scale)))
    small = snapped.resize((nw, nh), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(small, ((size - nw) // 2, size - nh - 1), small)
    return canvas


def quantize_binary(im: Image.Image, colors: int) -> Image.Image:
    pix = np.array(im)
    pix[:, :, 3] = np.where(pix[:, :, 3] >= 128, 255, 0)
    rgb = Image.new("RGB", im.size, (255, 0, 255))
    tmp = Image.fromarray(pix, "RGBA")
    rgb.paste(tmp.convert("RGB"), mask=tmp.split()[3])
    q = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    out = np.array(q.convert("RGB"))
    alpha = pix[:, :, 3]
    alpha = np.where(chroma_fail(out, alpha), 0, alpha)
    mag = (out[:, :, 0] > 200) & (out[:, :, 2] > 200) & (out[:, :, 1] < 40)
    alpha = np.where(mag, 0, alpha)
    return Image.fromarray(np.dstack([out, alpha]), "RGBA")


def export_frame(im80: Image.Image, dest: Path) -> dict:
    dest.parent.mkdir(parents=True, exist_ok=True)
    scaled = im80.resize((NATIVE * SCALE, NATIVE * SCALE), Image.Resampling.NEAREST)
    scaled.save(dest)
    arr = np.array(scaled)
    opaque = arr[:, :, 3] == 255
    colors = {tuple(p[:3]) for p in arr.reshape(-1, 4) if p[3] == 255}
    semi = int(((arr[:, :, 3] > 0) & (arr[:, :, 3] < 255)).sum())
    mag = int(chroma_fail(arr[:, :, :3], arr[:, :, 3]).sum())
    rec = {"path": str(dest.relative_to(ROOT)), "colors": len(colors), "semi": semi, "mag": mag}
    if semi or mag or len(colors) > 48:
        raise SystemExit(f"QA fail {dest} {rec}")
    return rec


def sheet_of(frames: list[Image.Image], cols: int) -> Image.Image:
    w, h = frames[0].size
    rows = (len(frames) + cols - 1) // cols
    out = Image.new("RGBA", (w * cols, h * rows), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        out.paste(fr, ((i % cols) * w, (i // cols) * h), fr)
    return out


def export_grid(raw: Path, name: str, rows: int, cols: int) -> list[dict]:
    working = to_rgba(raw)
    cells = split_grid(working, rows, cols)
    recs = []
    runtime: list[Image.Image] = []
    native_dir = WORKING / "native-80" / name
    native_dir.mkdir(parents=True, exist_ok=True)
    for i, cell in enumerate(cells):
        im80 = quantize_binary(fit_native(cell), SPRITE_COLORS)
        im80.save(native_dir / f"frame-{i + 1:02d}.png")
        dest = OUT / name / f"frame-{i + 1:02d}.png"
        recs.append(export_frame(im80, dest))
        runtime.append(Image.open(dest))
        print(f"{name}/frame-{i + 1:02d} colors={recs[-1]['colors']}")
    sheet_of(runtime, cols).save(OUT / name / "sheet-transparent.png")
    return recs


def export_scene(raw: Path, dest: Path, size: tuple[int, int], colors: int) -> dict:
    im = Image.open(raw).convert("RGB")
    # Snap to the native scene grid, then 4x nearest so the palette stays indexed.
    native = (size[0] // SCALE, size[1] // SCALE)
    small = im.resize(native, Image.Resampling.BOX)
    q = small.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    out = q.convert("RGB").resize(size, Image.Resampling.NEAREST)
    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest)
    n = len(set(out.getdata()))
    print(f"{dest.name} {out.size} colors={n}")
    if n > 64:
        raise SystemExit(f"QA fail {dest} {n} colors")
    return {"path": str(dest.relative_to(ROOT)), "colors": n}


MANIFEST = {
    "squat": ("squat-light.jpg", 2, 3),
    "squat-max": ("squat-max.jpg", 2, 3),
    "bench": ("bench-light.jpg", 2, 3),
    "bench-max": ("bench-max.jpg", 2, 3),
    "deadlift": ("deadlift-light.jpg", 2, 3),
    "deadlift-max": ("deadlift-max.jpg", 2, 3),
    "idle": ("idle.jpg", 2, 2),
    "success": ("success.jpg", 2, 2),
    "miss": ("miss.jpg", 2, 2),
    "plates": ("plates.jpg", 2, 3),
}


def copy_identity() -> None:
    raw = WORKING / "identity.jpg"
    rgba = to_rgba(raw)
    im80 = quantize_binary(fit_native(rgba), SPRITE_COLORS)
    (WORKING / "native-80").mkdir(parents=True, exist_ok=True)
    im80.save(WORKING / "native-80" / "identity.png")
    export_frame(im80, OUT / "identity.png")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    report: dict = {"grids": {}, "scenes": {}}
    copy_identity()
    for name, (fname, rows, cols) in MANIFEST.items():
        raw = WORKING / fname
        if not raw.exists():
            raise SystemExit(f"missing working sheet {raw}")
        report["grids"][name] = export_grid(raw, name, rows, cols)
    report["scenes"]["title"] = export_scene(WORKING / "title.jpg", OUT / "title.png", (640, 896), SCENE_COLORS)
    report["scenes"]["platform"] = export_scene(
        WORKING / "platform.jpg", OUT / "platform.png", (1280, 720), SCENE_COLORS
    )
    for jpeg in (OUT / "title.jpg", OUT / "platform.jpg"):
        if jpeg.exists():
            jpeg.unlink()
    (WORKING / "index-report.json").write_text(json.dumps(report, indent=2))
    export_evidence()
    print("index ok")


def export_evidence() -> None:
    ev = ROOT / "evidence" / "visual-after"
    ev.mkdir(parents=True, exist_ok=True)
    before = ev / "before-79f2baa"
    # native 80 copies
    for name in list(MANIFEST) + []:
        dest = ev / "native-80" / name
        src = WORKING / "native-80" / name
        if src.exists():
            dest.mkdir(parents=True, exist_ok=True)
            for p in src.glob("frame-*.png"):
                Image.open(p).save(dest / p.name)
    ident = WORKING / "native-80" / "identity.png"
    if ident.exists():
        (ev / "native-80").mkdir(parents=True, exist_ok=True)
        Image.open(ident).save(ev / "native-80" / "identity.png")

    def paste_pair(left: Path, right: Path, dest: Path) -> None:
        a = Image.open(left).convert("RGBA")
        b = Image.open(right).convert("RGBA")
        w, h = max(a.size[0], b.size[0]), max(a.size[1], b.size[1])
        canvas = Image.new("RGB", (w * 2, h), (12, 10, 8))
        canvas.paste(a, (0, 0), a if a.mode == "RGBA" else None)
        canvas.paste(b, (w, 0), b if b.mode == "RGBA" else None)
        dest.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(dest)

    pairs = [
        ("squat-frame-03.png", OUT / "squat" / "frame-03.png", "before-after-squat-hole.png"),
        ("squat-max-frame-03.png", OUT / "squat-max" / "frame-03.png", "before-after-squat-hole-max.png"),
        ("bench-frame-03.png", OUT / "bench" / "frame-03.png", "before-after-bench-pause.png"),
        ("deadlift-frame-01.png", OUT / "deadlift" / "frame-01.png", "before-after-deadlift-setup.png"),
        ("deadlift-frame-06.png", OUT / "deadlift" / "frame-06.png", "before-after-deadlift-lockout.png"),
        ("title.png", OUT / "title.png", "before-after-title.png"),
        ("idle-frame-01.png", OUT / "idle" / "frame-01.png", "before-after-idle.png"),
    ]
    if before.exists():
        for old_name, new, dest_name in pairs:
            old = before / old_name
            if old.exists() and Path(new).exists():
                paste_pair(old, new, ev / dest_name)

    trio = Image.new("RGB", (960, 320), (0, 0, 0))
    for i, (folder, fname) in enumerate((("squat", "frame-03.png"), ("bench", "frame-03.png"), ("deadlift", "frame-01.png"))):
        spr = Image.open(OUT / folder / fname).convert("RGBA")
        trio.paste(spr, (i * 320, 0), spr)
    trio.save(ev / "three-lift-silhouettes.png")

    compare = Image.new("RGB", (960, 640), (0, 0, 0))
    for i, (light, heavy, fname) in enumerate((
        ("squat", "squat-max", "frame-03.png"),
        ("bench", "bench-max", "frame-03.png"),
        ("deadlift", "deadlift-max", "frame-01.png"),
    )):
        a = Image.open(OUT / light / fname).convert("RGBA")
        b = Image.open(OUT / heavy / fname).convert("RGBA")
        compare.paste(a, (i * 320, 0), a)
        compare.paste(b, (i * 320, 320), b)
    compare.save(ev / "light-vs-max.png")
    Image.open(OUT / "title.png").save(ev / "title.png")
    Image.open(OUT / "platform.png").save(ev / "platform.png")


if __name__ == "__main__":
    main()
