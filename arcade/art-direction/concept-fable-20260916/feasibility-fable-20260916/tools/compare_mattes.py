"""Contact sheet of matting candidates over a checkerboard, one row per frame, with alpha stats.
Figure pixels are the untouched reference raster; only alpha differs between candidates."""
import json, os, sys
from PIL import Image, ImageDraw

ROOT = '/tmp/claude-0/-home-user-three-white-lights/92b70b66-ad87-5297-884b-486c8b55fc05/scratchpad'
MATTE = f'{ROOT}/proof/matte'
stats = json.load(open(f'{MATTE}/stats.json'))
variants = sorted(d for d in os.listdir(MATTE) if os.path.isdir(f'{MATTE}/{d}'))
frames = ['light', 'max']
cell_w, cell_h, pad, cap = 318, 360, 10, 30


def checker(draw, x, y, w, h):
    for cy in range(y, y + h, 16):
        for cx in range(x, x + w, 16):
            c = '#3a3a40' if ((cx - x) // 16 + (cy - y) // 16) % 2 else '#2c2c32'
            draw.rectangle([cx, cy, min(cx + 15, x + w - 1), min(cy + 15, y + h - 1)], fill=c)


for frame in frames:
    cols = len(variants)
    W = pad + cols * (cell_w + pad)
    H = pad + cell_h + cap + pad
    sheet = Image.new('RGB', (W, H), '#1a1a1e')
    d = ImageDraw.Draw(sheet)
    for i, v in enumerate(variants):
        x = pad + i * (cell_w + pad); y = pad
        checker(d, x, y, cell_w, cell_h)
        im = Image.open(f'{MATTE}/{v}/{frame}.png').convert('RGBA')
        im = im.resize((cell_w, cell_h), Image.LANCZOS)
        sheet.paste(im, (x, y), im)
        s = stats.get(f'{v}/{frame}', {})
        d.text((x, y + cell_h + 6), f'{v}  semi={s.get("semi","?")}', fill='#efe6da')
    out = f'{MATTE}/compare-{frame}.png'
    sheet.save(out); print('wrote', out, sheet.size)

# zoomed feet/near-shoe crops (the known failure area) for the light frame
zoom_box = (150, 470, 470, 640)  # x0,y0,x1,y1 in source coords (636x720)
cols = len(variants); zw, zh = zoom_box[2] - zoom_box[0], zoom_box[3] - zoom_box[1]
for frame in frames:
    W = pad + cols * (zw + pad); H = pad + zh + cap + pad
    sheet = Image.new('RGB', (W, H), '#1a1a1e'); d = ImageDraw.Draw(sheet)
    for i, v in enumerate(variants):
        x = pad + i * (zw + pad); y = pad
        checker(d, x, y, zw, zh)
        im = Image.open(f'{MATTE}/{v}/{frame}.png').convert('RGBA').crop(zoom_box)
        sheet.paste(im, (x, y), im)
        d.text((x, y + zh + 6), v, fill='#efe6da')
    out = f'{MATTE}/zoom-feet-{frame}.png'
    sheet.save(out); print('wrote', out, sheet.size)
