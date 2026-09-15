#!/usr/bin/env python3
"""Integer-grid export for Imagine-drawn TWL sprites.

Production path (no BOX / bilinear / Lanczos / fractional scales):

  1. chroma-key the pink JPEG field
  2. crop the subject
  3. pad to the next multiple of 320 (no resampling)
  4. NEAREST down to a true 320x320 master  (factor is an integer)
  5. quantize + binary alpha on the master
  6. NEAREST 320 -> 80 for the native export  (factor 4)
  7. NEAREST 80 -> 320 for the runtime PNG     (factor 4)

BOX 320 -> 80 exists only as a comparison artifact under
evidence/visual-after/nearest-vs-box/. It is not the production package.

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
EVIDENCE = ROOT / "evidence" / "visual-after"
MASTER = 320
NATIVE = 80
SCALE = 4
SPRITE_COLORS = 44
SCENE_COLORS = 60

assert MASTER % NATIVE == 0
assert (NATIVE * SCALE) == MASTER


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


def crop_subject(cell: Image.Image, pad: int = 4) -> Image.Image:
    arr = np.array(cell)
    opaque = arr[:, :, 3] >= 24
    if not opaque.any():
        return Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    ys, xs = np.where(opaque)
    box = (
        max(0, int(xs.min()) - pad),
        max(0, int(ys.min()) - pad),
        min(cell.size[0], int(xs.max()) + pad + 1),
        min(cell.size[1], int(ys.max()) + pad + 1),
    )
    return cell.crop(box)


def pad_square_multiple(im: Image.Image, multiple: int) -> Image.Image:
    """Pad (no resample) so width=height=k*multiple."""
    w, h = im.size
    side = multiple
    need = max(w, h)
    while side < need:
        side += multiple
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    ox = (side - w) // 2
    oy = side - h
    canvas.paste(im, (ox, oy), im)
    return canvas


def nearest_divisible(src: Image.Image, size: int) -> Image.Image:
    if src.size[0] != src.size[1]:
        raise SystemExit(f"master pad is not square: {src.size}")
    if src.size[0] % size != 0:
        raise SystemExit(f"{src.size} does not divide {size}")
    factor = src.size[0] // size
    if factor < 1:
        raise SystemExit("export factor < 1")
    if src.size == (size, size):
        return src
    return src.resize((size, size), Image.Resampling.NEAREST)


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


def make_master(cell: Image.Image) -> Image.Image:
    cropped = crop_subject(cell)
    padded = pad_square_multiple(cropped, MASTER)
    return quantize_binary(nearest_divisible(padded, MASTER), SPRITE_COLORS)


def down_80(master: Image.Image, resample: Image.Resampling) -> Image.Image:
    if master.size != (MASTER, MASTER):
        raise SystemExit(f"master {master.size} is not {MASTER}x{MASTER}")
    small = master.resize((NATIVE, NATIVE), resample)
    if resample != Image.Resampling.NEAREST:
        small = quantize_binary(small, SPRITE_COLORS)
    else:
        pix = np.array(small)
        pix[:, :, 3] = np.where(pix[:, :, 3] >= 128, 255, 0)
        small = Image.fromarray(pix, "RGBA")
    return small


def qa_frame(im: Image.Image, dest: Path, color_cap: int = 48) -> dict:
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest)
    arr = np.array(im)
    colors = {tuple(p[:3]) for p in arr.reshape(-1, 4) if p[3] == 255}
    semi = int(((arr[:, :, 3] > 0) & (arr[:, :, 3] < 255)).sum())
    mag = int(chroma_fail(arr[:, :, :3], arr[:, :, 3]).sum())
    rec = {"path": str(dest.relative_to(ROOT)), "size": list(im.size), "colors": len(colors), "semi": semi, "mag": mag}
    if semi or mag or len(colors) > color_cap:
        raise SystemExit(f"QA fail {dest} {rec}")
    return rec


def sheet_of(frames: list[Image.Image], cols: int) -> Image.Image:
    w, h = frames[0].size
    rows = (len(frames) + cols - 1) // cols
    out = Image.new("RGBA", (w * cols, h * rows), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        out.paste(fr, ((i % cols) * w, (i // cols) * h), fr)
    return out


def pad_rect_multiple(im: Image.Image, step_w: int, step_h: int, fill: tuple[int, int, int]) -> Image.Image:
    w, h = im.size
    nw = ((w + step_w - 1) // step_w) * step_w
    nh = ((h + step_h - 1) // step_h) * step_h
    canvas = Image.new("RGB", (nw, nh), fill)
    canvas.paste(im, ((nw - w) // 2, (nh - h) // 2))
    return canvas


def export_scene(raw: Path, dest: Path, runtime: tuple[int, int], colors: int, resample: Image.Resampling) -> dict:
    native = (runtime[0] // SCALE, runtime[1] // SCALE)
    im = Image.open(raw).convert("RGB")
    padded = pad_rect_multiple(im, native[0], native[1], (20, 17, 15))
    if padded.size[0] % native[0] or padded.size[1] % native[1]:
        raise SystemExit(f"scene pad {padded.size} not divisible by {native}")
    small = padded.resize(native, resample)
    q = small.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    out = q.convert("RGB").resize(runtime, Image.Resampling.NEAREST)
    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest)
    n = len(set(out.getdata()))
    print(f"{dest.name} {out.size} colors={n} resample={resample.name}")
    if n > 64:
        raise SystemExit(f"QA fail {dest} {n} colors")
    return {"path": str(dest.relative_to(ROOT)), "colors": n, "resample": resample.name, "pad": list(padded.size)}


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


def save_grid(name: str, cells: list[Image.Image], cols: int) -> list[dict]:
    recs = []
    runtime: list[Image.Image] = []
    master_dir = WORKING / "masters-320" / name
    near_dir = WORKING / "native-80" / name
    box_dir = EVIDENCE / "native-80-box" / name
    master_dir.mkdir(parents=True, exist_ok=True)
    near_dir.mkdir(parents=True, exist_ok=True)
    box_dir.mkdir(parents=True, exist_ok=True)
    out_dir = OUT / name
    out_dir.mkdir(parents=True, exist_ok=True)
    for i, cell in enumerate(cells):
        master = make_master(cell)
        near80 = down_80(master, Image.Resampling.NEAREST)
        box80 = down_80(master, Image.Resampling.BOX)
        stem = f"frame-{i + 1:02d}.png"
        master.save(master_dir / stem)
        qa_frame(near80, near_dir / stem)
        qa_frame(box80, box_dir / stem)
        runtime_im = near80.resize((MASTER, MASTER), Image.Resampling.NEAREST)
        rec = qa_frame(runtime_im, out_dir / stem)
        recs.append(rec)
        runtime.append(runtime_im)
        print(f"{name}/{stem} colors={rec['colors']}")
    sheet_of(runtime, cols).save(out_dir / "sheet-transparent.png")
    return recs


def export_identity() -> None:
    rgba = to_rgba(WORKING / "identity.jpg")
    save_grid("identity-single", [rgba], 1)
    # identity lives at package root, not identity-single/
    src = OUT / "identity-single" / "frame-01.png"
    dest = OUT / "identity.png"
    Image.open(src).save(dest)
    (WORKING / "native-80").mkdir(parents=True, exist_ok=True)
    Image.open(WORKING / "native-80" / "identity-single" / "frame-01.png").save(WORKING / "native-80" / "identity.png")
    Image.open(WORKING / "masters-320" / "identity-single" / "frame-01.png").save(WORKING / "masters-320" / "identity.png")


def comparison_sheet() -> None:
    keys = [
        ("squat", "frame-01.png", "squat-walkout"),
        ("squat", "frame-03.png", "squat-hole"),
        ("squat", "frame-06.png", "squat-lockout"),
        ("squat-max", "frame-03.png", "squat-hole-max"),
        ("bench", "frame-03.png", "bench-pause"),
        ("bench-max", "frame-03.png", "bench-pause-max"),
        ("deadlift", "frame-01.png", "deadlift-setup"),
        ("deadlift", "frame-06.png", "deadlift-lockout"),
        ("deadlift-max", "frame-01.png", "deadlift-setup-max"),
        ("idle", "frame-01.png", "idle"),
    ]
    dest_dir = EVIDENCE / "nearest-vs-box"
    dest_dir.mkdir(parents=True, exist_ok=True)
    rows = []
    for folder, fname, label in keys:
        n80 = Image.open(WORKING / "native-80" / folder / fname).convert("RGBA")
        b80 = Image.open(EVIDENCE / "native-80-box" / folder / fname).convert("RGBA")
        n4 = n80.resize((MASTER, MASTER), Image.Resampling.NEAREST)
        b4 = b80.resize((MASTER, MASTER), Image.Resampling.NEAREST)
        row = Image.new("RGB", (MASTER * 4, MASTER), (12, 10, 8))
        row.paste(n80.resize((MASTER, MASTER), Image.Resampling.NEAREST), (0, 0), n80.resize((MASTER, MASTER), Image.Resampling.NEAREST))
        row.paste(b80.resize((MASTER, MASTER), Image.Resampling.NEAREST), (MASTER, 0), b80.resize((MASTER, MASTER), Image.Resampling.NEAREST))
        row.paste(n4, (MASTER * 2, 0), n4)
        row.paste(b4, (MASTER * 3, 0), b4)
        row.save(dest_dir / f"{label}.png")
        # native 80 pair
        pair = Image.new("RGB", (NATIVE * 2, NATIVE), (12, 10, 8))
        pair.paste(n80, (0, 0), n80)
        pair.paste(b80, (NATIVE, 0), b80)
        pair.resize((NATIVE * 2 * 4, NATIVE * 4), Image.Resampling.NEAREST).save(dest_dir / f"{label}-native80.png")
        rows.append(row)
        # contact crops from 4x nearest vs box (thighs / hands / plates)
        def crop_band(im: Image.Image, box: tuple[int, int, int, int], name: str) -> None:
            im.crop(box).save(dest_dir / name)

        crop_band(n4, (80, 40, 240, 280), f"{label}-nearest-crop.png")
        crop_band(b4, (80, 40, 240, 280), f"{label}-box-crop.png")
    if rows:
        strip = Image.new("RGB", (MASTER * 4, MASTER * len(rows)), (12, 10, 8))
        for i, row in enumerate(rows):
            strip.paste(row, (0, i * MASTER))
        strip.save(dest_dir / "sheet-all.png")
        (dest_dir / "COLUMNS.txt").write_text(
            "Columns left -> right: NEAREST 80 upscaled 4x | BOX 80 upscaled 4x | "
            "NEAREST 80 native-enlarged | BOX 80 native-enlarged\n"
            "All 80px exports come from the same 320x320 master.\n"
        )


def export_evidence() -> None:
    before = EVIDENCE / "before-79f2baa"
    for name in MANIFEST:
        dest = EVIDENCE / "native-80" / name
        src = WORKING / "native-80" / name
        if src.exists():
            dest.mkdir(parents=True, exist_ok=True)
            for p in src.glob("frame-*.png"):
                Image.open(p).save(dest / p.name)
    ident = WORKING / "native-80" / "identity.png"
    if ident.exists():
        (EVIDENCE / "native-80").mkdir(parents=True, exist_ok=True)
        Image.open(ident).save(EVIDENCE / "native-80" / "identity.png")

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
                paste_pair(old, new, EVIDENCE / dest_name)

    trio = Image.new("RGB", (960, 320), (0, 0, 0))
    for i, (folder, fname) in enumerate((("squat", "frame-03.png"), ("bench", "frame-03.png"), ("deadlift", "frame-01.png"))):
        spr = Image.open(OUT / folder / fname).convert("RGBA")
        trio.paste(spr, (i * 320, 0), spr)
    trio.save(EVIDENCE / "three-lift-silhouettes.png")

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
    compare.save(EVIDENCE / "light-vs-max.png")
    Image.open(OUT / "title.png").save(EVIDENCE / "title.png")
    Image.open(OUT / "platform.png").save(EVIDENCE / "platform.png")
    comparison_sheet()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    report: dict = {"grids": {}, "scenes": {}, "method": "NEAREST 320->80 factor 4 from padded integer master"}
    export_identity()
    for name, (fname, rows, cols) in MANIFEST.items():
        raw = WORKING / fname
        if not raw.exists():
            raise SystemExit(f"missing working sheet {raw}")
        cells = split_grid(to_rgba(raw), rows, cols)
        report["grids"][name] = save_grid(name, cells, cols)
    report["scenes"]["title"] = export_scene(
        WORKING / "title.jpg", OUT / "title.png", (640, 896), SCENE_COLORS, Image.Resampling.NEAREST
    )
    report["scenes"]["platform"] = export_scene(
        WORKING / "platform.jpg", OUT / "platform.png", (1280, 720), SCENE_COLORS, Image.Resampling.NEAREST
    )
    # BOX scene comparison only
    export_scene(
        WORKING / "title.jpg",
        EVIDENCE / "nearest-vs-box" / "title-box.png",
        (640, 896),
        SCENE_COLORS,
        Image.Resampling.BOX,
    )
    export_scene(
        WORKING / "platform.jpg",
        EVIDENCE / "nearest-vs-box" / "platform-box.png",
        (1280, 720),
        SCENE_COLORS,
        Image.Resampling.BOX,
    )
    for jpeg in (OUT / "title.jpg", OUT / "platform.jpg"):
        if jpeg.exists():
            jpeg.unlink()
    # drop the identity-single runtime folder; identity.png is the public file
    ident_dir = OUT / "identity-single"
    if ident_dir.exists():
        for p in ident_dir.glob("*"):
            p.unlink()
        ident_dir.rmdir()
    (WORKING / "index-report.json").write_text(json.dumps(report, indent=2))
    export_evidence()
    print("index ok")


if __name__ == "__main__":
    main()
