#!/usr/bin/env python3
"""Build before/after evidence for the internal draw-then-index sprint."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SPR = ROOT / "public" / "sprites"
BASE = ROOT / "evidence" / "internal-draw-index-1151569" / "baseline"
OUT = ROOT / "evidence" / "internal-draw-index-sprint"
IRON = (20, 17, 15, 255)
INK = (244, 239, 228, 255)
AMB = (212, 137, 42, 255)


def nn(im: Image.Image, size: tuple[int, int]) -> Image.Image:
    return im.resize(size, Image.Resampling.NEAREST)


def load(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def panel(im: Image.Image, bg: tuple[int, int, int, int] = IRON) -> Image.Image:
    canvas = Image.new("RGBA", im.size, bg)
    canvas.alpha_composite(im)
    return canvas


def label(im: Image.Image, text: str) -> Image.Image:
    out = im.copy()
    d = ImageDraw.Draw(out)
    d.rectangle((0, 0, out.width, 18), fill=(12, 10, 8, 220))
    d.text((6, 3), text, fill=AMB)
    return out


def grid(cells: list[Image.Image], cols: int, pad: int = 8) -> Image.Image:
    w, h = cells[0].size
    rows = (len(cells) + cols - 1) // cols
    canvas = Image.new("RGBA", (cols * (w + pad) + pad, rows * (h + pad) + pad), IRON)
    for i, cell in enumerate(cells):
        c, r = i % cols, i // cols
        canvas.paste(cell, (pad + c * (w + pad), pad + r * (h + pad)))
    return canvas


def stage_scale(im: Image.Image, width: int) -> Image.Image:
    h = int(im.height * (width / im.width))
    return nn(im, (width, h))


def main() -> None:
    after = OUT / "after"
    after.mkdir(parents=True, exist_ok=True)
    (after / "source-320").mkdir(exist_ok=True)
    (after / "cards-104").mkdir(exist_ok=True)
    (after / "stage-scale").mkdir(exist_ok=True)

    lifts = ("squat", "bench", "deadlift")
    heroes = {
        "squat": "frame-03.png",
        "bench": "frame-03.png",
        "deadlift": "frame-06.png",
    }

    source_cells = []
    card_cells = []
    light_max = []
    stage_phone = []
    stage_desk = []

    for lift in lifts:
        for effort, folder in (("light", lift), ("max", f"{lift}-max")):
            src = load(SPR / folder / heroes[lift])
            src.save(after / "source-320" / f"{lift}-{effort}-320.png")
            source_cells.append(label(panel(src), f"{lift} {effort} 320"))
            st_p = panel(stage_scale(src, 273), IRON)
            st_d = panel(stage_scale(src, 400), IRON)
            st_p.save(after / "stage-scale" / f"{lift}-{effort}-phone273.png")
            st_d.save(after / "stage-scale" / f"{lift}-{effort}-desktop400.png")
            stage_phone.append(label(st_p, f"{lift} {effort} stage~273"))
            stage_desk.append(label(st_d, f"{lift} {effort} stage~400"))
            light_max.append(label(panel(src), f"{lift} {effort}"))

        card = load(SPR / "cards" / f"{lift}-light.png")
        card_m = load(SPR / "cards" / f"{lift}-max.png")
        card.save(after / "cards-104" / f"{lift}-light.png")
        card_m.save(after / "cards-104" / f"{lift}-max.png")
        card_cells.append(label(panel(card), f"{lift} card light 104"))
        card_cells.append(label(panel(card_m), f"{lift} card max 104"))

    grid(source_cells, 3).save(after / "contact-320-heroes.png")
    grid(card_cells, 2).save(after / "contact-cards-104.png")
    grid(light_max, 2).save(after / "contact-light-vs-max.png")
    grid(stage_phone, 3).save(after / "contact-stage-phone.png")
    grid(stage_desk, 3).save(after / "contact-stage-desktop.png")

    # Sequence strips (no hitch proof for deadlift)
    for lift, n in (("squat", 6), ("bench", 6), ("deadlift", 6)):
        frames = [label(panel(load(SPR / lift / f"frame-{i:02d}.png")), f"{lift} f{i}") for i in range(1, n + 1)]
        grid(frames, 6).save(after / f"strip-{lift}-light.png")
        frames = [label(panel(load(SPR / f"{lift}-max" / f"frame-{i:02d}.png")), f"{lift} max f{i}") for i in range(1, n + 1)]
        grid(frames, 6).save(after / f"strip-{lift}-max.png")

    load(SPR / "identity.png").save(after / "identity-320.png")
    load(ROOT / "art-source" / "internal-draw-index" / "model-sheet.png").save(after / "model-sheet.png")
    nn(load(SPR / "title.png"), (390, 844)).save(after / "title-390x844-cover-approx.png")
    nn(load(SPR / "title-wide.png"), (1280, 800)).save(after / "title-wide-1280x800-cover-approx.png")

    # Before/after at 104 and 320
    ba = OUT / "before-after"
    ba.mkdir(parents=True, exist_ok=True)
    pairs = [
        ("squat-light", BASE / "source-320" / "squat" / "frame-03.png", SPR / "squat" / "frame-03.png"),
        ("bench-light", BASE / "source-320" / "bench" / "frame-03.png", SPR / "bench" / "frame-03.png"),
        ("deadlift-lock", BASE / "source-320" / "deadlift" / "frame-06.png", SPR / "deadlift" / "frame-06.png"),
        ("deadlift-setup", BASE / "source-320" / "deadlift" / "frame-01.png", SPR / "deadlift" / "frame-01.png"),
        ("idle", BASE / "source-320" / "idle" / "frame-01.png", SPR / "idle" / "frame-01.png"),
    ]
    for name, bpath, apath in pairs:
        b = panel(load(bpath))
        a = panel(load(apath))
        row = Image.new("RGBA", (b.width * 2 + 24, b.height + 24), IRON)
        row.paste(label(b, f"{name} BEFORE 1151569"), (8, 8))
        row.paste(label(a, f"{name} AFTER draw-index"), (b.width + 16, 8))
        row.save(ba / f"{name}-320.png")
        row104 = Image.new("RGBA", (104 * 2 + 24, 104 + 24), IRON)
        row104.paste(label(panel(nn(load(bpath), (104, 104))), f"{name} before crushed"), (8, 8))
        row104.paste(label(panel(nn(load(apath) if "card" not in name else load(apath), (104, 104))), f"{name} after"), (112, 8))
        row104.save(ba / f"{name}-104.png")

    # Dedicated card before (crushed 320) vs after (authored 104)
    for lift in lifts:
        b = load(BASE / "cards-from-stage" / f"{lift}-light-104-nearest.png")
        a = load(SPR / "cards" / f"{lift}-light.png")
        row = Image.new("RGBA", (104 * 2 + 24, 104 + 24), IRON)
        row.paste(label(panel(b), f"{lift} card BEFORE crush"), (8, 8))
        row.paste(label(panel(a), f"{lift} card AFTER authored"), (112, 8))
        row.save(ba / f"{lift}-card-104.png")

    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
