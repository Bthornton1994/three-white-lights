#!/usr/bin/env python3
"""Render a candidate sprite package at the sizes the arcade actually draws it.

Runtime geometry (measured in the running app at 50b07c89, see CONCEPT_REPORT.md):

    stage lifter  390x844 phone   -> 273x273 CSS px (320 master * 0.853, non-integer)
    stage lifter  1280x800 desktop -> 400x400 CSS px (320 master * 1.25,  non-integer)
    lift card     390x844 phone   -> 104x104 drawn inside a 162x104 box (1:1 of the 104 export)
    lift card     1280x800 desktop -> 190x190 (104 export * 1.827, non-integer)

`image-rendering: pixelated` means nearest-neighbour, so the non-integer cases
produce uneven pixel widths. This harness shows exactly that, plus a "squint"
pass (box-downscale to 1/4 and back) that approximates how the silhouette
reads at arm's length on a phone.

Usage:
    python3 preview_harness.py PACKAGE_DIR OUT_DIR

PACKAGE_DIR layout (same as arcade/public/sprites):
    <sheet>/frame-NN.png   320x320 RGBA masters
    cards/<lift>-<effort>.png   104x104 RGBA cards
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

STAGE_PHONE = 273
STAGE_DESKTOP = 400
CARD_PHONE = 104
CARD_DESKTOP = 190
BG = (24, 20, 18, 255)


def label(im: Image.Image, text: str) -> Image.Image:
    out = Image.new("RGBA", (im.width, im.height + 16), BG)
    out.paste(im, (0, 16), im)
    ImageDraw.Draw(out).text((2, 2), text, fill=(220, 200, 160, 255), font=ImageFont.load_default())
    return out


def squint(im: Image.Image) -> Image.Image:
    small = im.resize((max(1, im.width // 4), max(1, im.height // 4)), Image.Resampling.BOX)
    return small.resize(im.size, Image.Resampling.NEAREST)


def row(tiles: list[Image.Image]) -> Image.Image:
    w = sum(t.width for t in tiles) + 8 * (len(tiles) + 1)
    h = max(t.height for t in tiles) + 16
    out = Image.new("RGBA", (w, h), BG)
    x = 8
    for t in tiles:
        out.paste(t, (x, 8), t)
        x += t.width + 8
    return out


def stage_sheet(frame: Path) -> Image.Image:
    im = Image.open(frame).convert("RGBA")
    tiles = [
        label(im, f"{frame.parent.name}/{frame.name} 320 master"),
        label(im.resize((STAGE_PHONE, STAGE_PHONE), Image.Resampling.NEAREST), f"phone stage {STAGE_PHONE}"),
        label(im.resize((STAGE_DESKTOP, STAGE_DESKTOP), Image.Resampling.NEAREST), f"desktop stage {STAGE_DESKTOP}"),
        label(squint(im.resize((STAGE_PHONE, STAGE_PHONE), Image.Resampling.NEAREST)), "squint (phone)"),
    ]
    return row(tiles)


def card_sheet(card: Path) -> Image.Image:
    im = Image.open(card).convert("RGBA")
    tiles = [
        label(im, f"{card.name} {im.width} export"),
        label(im.resize((CARD_PHONE, CARD_PHONE), Image.Resampling.NEAREST), f"phone card {CARD_PHONE}"),
        label(im.resize((CARD_DESKTOP, CARD_DESKTOP), Image.Resampling.NEAREST), f"desktop card {CARD_DESKTOP} (non-integer)"),
        label(squint(im.resize((CARD_PHONE, CARD_PHONE), Image.Resampling.NEAREST)), "squint (phone)"),
    ]
    return row(tiles)


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    pkg, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    n = 0
    for frame in sorted(pkg.glob("*/frame-*.png")):
        stage_sheet(frame).save(out / f"stage-{frame.parent.name}-{frame.stem}.png")
        n += 1
    for card in sorted((pkg / "cards").glob("*.png")) if (pkg / "cards").exists() else []:
        card_sheet(card).save(out / f"card-{card.stem}.png")
        n += 1
    print(f"wrote {n} preview sheets to {out}")


if __name__ == "__main__":
    main()
