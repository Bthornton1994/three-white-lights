#!/usr/bin/env python3
"""Integer-grid export for Imagine-drawn TWL sprites.

Production path (no BOX / bilinear / Lanczos / fractional scales):

  1. chroma-key the pink JPEG field
  2. crop the subject
  3. pad to the next multiple of 320 (no resampling)
  4. NEAREST down to a true 320x320 master  (factor is an integer)
  5. quantize + binary alpha on the master
  6. PRODUCTION sprite = that 320 master (not an 80 upsample)
  7. Native 80 = NEAREST 320 -> 80 (factor 4) — evidence only

BOX 320 -> 80 exists only as a comparison artifact under
evidence/visual-after/nearest-vs-box/. It is not the production package.

The engine already loads 320x320 PNGs and CSS-scales them with
image-rendering: pixelated to min(78vw, 420px). Shipping the 80-grid
upsample throws away authored clusters the 320 master still has.

Pose tables in build_sprites.py are unused by this exporter.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

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
    factor_w = padded.size[0] // native[0]
    factor_h = padded.size[1] // native[1]
    small = padded.resize(native, resample)
    q = small.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    out = q.convert("RGB").resize(runtime, Image.Resampling.NEAREST)
    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest)
    n = len(set(out.getdata()))
    print(f"{dest.name} {out.size} colors={n} resample={resample.name} pad={padded.size} factor={factor_w}x{factor_h}")
    if n > 64:
        raise SystemExit(f"QA fail {dest} {n} colors")
    return {
        "path": str(dest.relative_to(ROOT)),
        "colors": n,
        "resample": resample.name,
        "pad": list(padded.size),
        "native": list(native),
        "factor": [factor_w, factor_h],
    }


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
        rec = qa_frame(master, out_dir / stem)
        recs.append(rec)
        runtime.append(master)
        print(f"{name}/{stem} colors={rec['colors']}")
    sheet_of(runtime, cols).save(out_dir / "sheet-transparent.png")
    return recs


def export_identity() -> None:
    rgba = to_rgba(WORKING / "identity.jpg")
    save_grid("identity-single", [rgba], 1)
    src = OUT / "identity-single" / "frame-01.png"
    dest = OUT / "identity.png"
    Image.open(src).save(dest)
    (WORKING / "native-80").mkdir(parents=True, exist_ok=True)
    Image.open(WORKING / "native-80" / "identity-single" / "frame-01.png").save(WORKING / "native-80" / "identity.png")
    Image.open(WORKING / "masters-320" / "identity-single" / "frame-01.png").save(WORKING / "masters-320" / "identity.png")


def _label_bar(text: str, width: int, height: int = 28) -> Image.Image:
    bar = Image.new("RGB", (width, height), (18, 15, 12))
    draw = ImageDraw.Draw(bar)
    try:
        font = ImageFont.load_default()
    except Exception:
        font = None
    draw.text((8, 7), text, fill=(243, 197, 106), font=font)
    return bar


def opaque_thirds(im: Image.Image) -> dict[str, tuple[int, int, int, int]]:
    arr = np.array(im)
    ys, xs = np.where(arr[:, :, 3] >= 128)
    if ys.size == 0:
        return {
            "upper-bar-hands": (40, 20, 280, 140),
            "mid-thighs-chest": (40, 120, 280, 230),
            "lower-shins-plates": (20, 210, 300, 320),
        }
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    h = max(1, y1 - y0)
    t1 = y0 + h // 3
    t2 = y0 + (2 * h) // 3
    pad = 4
    x0 = max(0, x0 - pad)
    x1 = min(im.size[0], x1 + pad)
    return {
        "upper-bar-hands": (x0, max(0, y0 - pad), x1, t1),
        "mid-thighs-chest": (x0, t1, x1, t2),
        "lower-shins-plates": (x0, t2, x1, min(im.size[1], y1 + pad)),
    }


def _paste_rgba(canvas: Image.Image, im: Image.Image, xy: tuple[int, int]) -> None:
    if im.mode == "RGBA":
        canvas.paste(im, xy, im)
    else:
        canvas.paste(im, xy)


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
        ("plates", "frame-01.png", "plates"),
        ("success", "frame-01.png", "success"),
    ]
    dest_dir = EVIDENCE / "nearest-vs-box"
    dest_dir.mkdir(parents=True, exist_ok=True)
    crop_dir = dest_dir / "anatomy-crops"
    crop_dir.mkdir(parents=True, exist_ok=True)
    rows = []
    header = _label_bar("320 MASTER  |  NEAREST 80 x4  |  BOX 80 x4", MASTER * 3)
    for folder, fname, label in keys:
        master = Image.open(WORKING / "masters-320" / folder / fname).convert("RGBA")
        n80 = Image.open(WORKING / "native-80" / folder / fname).convert("RGBA")
        b80 = Image.open(EVIDENCE / "native-80-box" / folder / fname).convert("RGBA")
        n4 = n80.resize((MASTER, MASTER), Image.Resampling.NEAREST)
        b4 = b80.resize((MASTER, MASTER), Image.Resampling.NEAREST)
        row = Image.new("RGB", (MASTER * 3, MASTER + 28), (12, 10, 8))
        row.paste(_label_bar(label, MASTER * 3), (0, 0))
        _paste_rgba(row, master, (0, 28))
        _paste_rgba(row, n4, (MASTER, 28))
        _paste_rgba(row, b4, (MASTER * 2, 28))
        row.save(dest_dir / f"{label}.png")
        pair = Image.new("RGB", (NATIVE * 2, NATIVE), (12, 10, 8))
        _paste_rgba(pair, n80, (0, 0))
        _paste_rgba(pair, b80, (NATIVE, 0))
        pair.resize((NATIVE * 2 * 4, NATIVE * 4), Image.Resampling.NEAREST).save(dest_dir / f"{label}-native80.png")
        n4.save(dest_dir / f"{label}-nearest-crop.png")
        b4.save(dest_dir / f"{label}-box-crop.png")
        master.save(dest_dir / f"{label}-master.png")
        # anatomy thirds: same box on master / nearest / box
        thirds = opaque_thirds(master)
        atlas_w = 160
        atlas = Image.new("RGB", (atlas_w * 3, 22 + 110 * 3), (12, 10, 8))
        atlas.paste(_label_bar(f"{label}  master | nearest | box", atlas_w * 3, 22), (0, 0))
        for ri, (rname, box) in enumerate(thirds.items()):
            for ci, src in enumerate((master, n4, b4)):
                chip = src.crop(box).resize((atlas_w, 108), Image.Resampling.NEAREST)
                _paste_rgba(atlas, chip, (ci * atlas_w, 22 + ri * 110))
            chip_name = rname.split("-")[0]
            master.crop(box).resize((box[2] - box[0], box[3] - box[1]), Image.Resampling.NEAREST).save(
                crop_dir / f"{label}-{chip_name}-master.png"
            )
            n4.crop(box).save(crop_dir / f"{label}-{chip_name}-nearest.png")
            b4.crop(box).save(crop_dir / f"{label}-{chip_name}-box.png")
        atlas.save(crop_dir / f"{label}-atlas.png")
        rows.append(row)
    if rows:
        strip = Image.new("RGB", (MASTER * 3, 28 + (MASTER + 28) * len(rows)), (12, 10, 8))
        strip.paste(header, (0, 0))
        y = 28
        for row in rows:
            strip.paste(row, (0, y))
            y += row.size[1]
        strip.save(dest_dir / "sheet-all.png")
        (dest_dir / "COLUMNS.txt").write_text(
            "Columns left -> right: 320 MASTER | NEAREST 80 upscaled 4x | BOX 80 upscaled 4x\n"
            "All 80px exports come from the same 320x320 master with an integer factor of 4.\n"
            "Production sprites are the 320 masters, not the 80 upsample.\n"
            "anatomy-crops/ uses opaque-bbox vertical thirds: upper-bar-hands, mid-thighs-chest, lower-shins-plates.\n"
            "native80 files are NEAREST | BOX at 80, then NEAREST-enlarged 4x for inspection.\n"
        )


def rgba_stats(path: Path) -> dict:
    im = Image.open(path)
    arr = np.array(im)
    rec: dict = {"path": str(path.relative_to(ROOT)), "size": list(im.size), "mode": im.mode}
    if arr.ndim == 3 and arr.shape[2] == 4:
        a = arr[:, :, 3]
        rgb = arr[:, :, :3]
        opaque = a == 255
        rec["colors"] = len({tuple(p) for p in rgb[opaque]}) if opaque.any() else 0
        rec["semi"] = int(((a > 0) & (a < 255)).sum())
        rec["mag"] = int(chroma_fail(rgb, a).sum())
        rec["opaque"] = int(opaque.sum())
        rec["binary_alpha"] = rec["semi"] == 0
    else:
        data = list(im.convert("RGB").getdata())
        rec["colors"] = len(set(data))
        rec["semi"] = 0
        rec["mag"] = 0
        rec["binary_alpha"] = True
    rec["pass"] = rec["semi"] == 0 and rec["mag"] == 0 and rec["colors"] <= (64 if "title" in path.name or "platform" in path.name else 48)
    return rec


def export_palette_report() -> None:
    recs = []
    for path in sorted(OUT.rglob("*.png")):
        if path.name.startswith("sheet-"):
            continue
        recs.append(rgba_stats(path))
    dest = EVIDENCE / "nearest-vs-box" / "PALETTE_ALPHA.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps({"production": recs, "fail": [r for r in recs if not r["pass"]]}, indent=2))
    lines = [
        "# Palette / alpha validation — production 320 masters",
        "",
        "Binary alpha, no magenta chroma, sprite ≤48 colors, title/platform ≤64.",
        "",
        "| file | size | colors | semi | mag | pass |",
        "|---|---|---:|---:|---:|---|",
    ]
    for r in recs:
        lines.append(
            f"| `{r['path']}` | {r['size'][0]}×{r['size'][1]} | {r['colors']} | {r['semi']} | {r['mag']} | {'yes' if r['pass'] else 'NO'} |"
        )
    fails = [r for r in recs if not r["pass"]]
    lines.append("")
    lines.append(f"Failures: {len(fails)}")
    (EVIDENCE / "nearest-vs-box" / "PALETTE_ALPHA.md").write_text("\n".join(lines) + "\n")
    print(f"palette report {len(recs)} files, fails={len(fails)}")


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
    export_palette_report()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    report: dict = {
        "grids": {},
        "scenes": {},
        "method": "production = 320 master (integer pad + NEAREST). native 80 = NEAREST 4:1 evidence. BOX comparison-only.",
    }
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
