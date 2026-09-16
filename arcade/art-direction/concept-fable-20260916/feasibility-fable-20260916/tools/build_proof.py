"""Assemble the bounded proof set from the chosen matting candidate (u2net + alpha matting).

Produces, under proof/out/:
  frames/squat-03-hole-light.png, frames/squat-03-hole-max.png   RGBA, source resolution
  cards/card-squat-light.png, cards/card-squat-max.png          RGBA square crops (source res, not 52-lattice)
  source/*.xcf                                                  layered GIMP sources (figure+alpha, reference, mask)
  evidence/*.png                                                before/after and comparison sheets
  measurements.json                                             alpha stats and pixel-integrity checks
No new figure pixels are drawn anywhere: the RGB of every opaque pixel is checked against the reference.
"""
import json, os, shutil, subprocess
import numpy as np
from PIL import Image, ImageDraw

ROOT = '/tmp/claude-0/-home-user-three-white-lights/92b70b66-ad87-5297-884b-486c8b55fc05/scratchpad'
SRC = {'light': f'{ROOT}/host/ref-squat-light.png', 'max': f'{ROOT}/host/ref-squat-max.png'}
MATTE = f'{ROOT}/proof/matte/u2net-am'
OUT = f'{ROOT}/proof/out'
CARD_BOX = (128, 150, 508, 530)  # waist-up, bar off both edges, plates cropped by edges, belt at bottom
CARD_TEMPLATE = f'{ROOT}/refs/card-52-composition-squat.png'
for d in ('frames', 'cards', 'source', 'evidence'):
    os.makedirs(f'{OUT}/{d}', exist_ok=True)

meas = {}


def checker(draw, x, y, w, h):
    for cy in range(y, y + h, 16):
        for cx in range(x, x + w, 16):
            c = '#3a3a40' if ((cx - x) // 16 + (cy - y) // 16) % 2 else '#2c2c32'
            draw.rectangle([cx, cy, min(cx + 15, x + w - 1), min(cy + 15, y + h - 1)], fill=c)


def sheet(panels, out, title=None, scale=1.0):
    """panels: list of (PIL image, caption, over_checker: bool)"""
    pad, cap = 16, 30
    ims = []
    for im, capt, chk in panels:
        if scale != 1.0:
            im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
        ims.append((im, capt, chk))
    h = max(im.height for im, _, _ in ims)
    W = pad + sum(im.width + pad for im, _, _ in ims)
    H = pad + (36 if title else 0) + h + cap + pad
    s = Image.new('RGB', (W, H), '#1a1a1e'); d = ImageDraw.Draw(s)
    y0 = pad + (36 if title else 0)
    if title:
        d.text((pad, pad), title, fill='#efe6da')
    x = pad
    for im, capt, chk in ims:
        if chk:
            checker(d, x, y0, im.width, im.height)
        if im.mode == 'RGBA':
            s.paste(im, (x, y0), im)
        else:
            s.paste(im.convert('RGB'), (x, y0))
        d.text((x, y0 + h + 6), capt, fill='#efe6da')
        x += im.width + pad
    s.save(out); print('wrote', os.path.relpath(out, ROOT), s.size)


frames = {}
for k in ('light', 'max'):
    src = Image.open(SRC[k]).convert('RGB'); m0 = Image.open(f'{MATTE}/{k}.png').convert('RGBA')
    assert src.size == m0.size, (src.size, m0.size)
    # Take ONLY the alpha from the matting pass. pymatting's foreground estimation rewrites RGB
    # (measured: ~69% of opaque pixels changed, 229 -> 2201 unique colours), which would degrade
    # the reference raster. Figure pixels must stay the untouched Fable pixels.
    alpha = m0.getchannel('A')
    m = src.copy().convert('RGBA'); m.putalpha(alpha)
    # Hygiene: zero the (invisible) RGB under fully transparent pixels. Changes no visible pixel;
    # some viewers ignore the alpha channel when transparent pixels carry colour.
    def clean(img):
        arr = np.asarray(img).copy(); arr[arr[:, :, 3] == 0, 0:3] = 0; return Image.fromarray(arr, 'RGBA')
    m = clean(m)
    dst = f'{OUT}/frames/squat-03-hole-{k}.png'; m.save(dst); frames[k] = m
    # Binary-alpha variant for PRODUCTION_SPEC.md §2 (alpha 0 or 255 only): threshold at 128, RGB untouched.
    ab = alpha.point(lambda v: 255 if v >= 128 else 0)
    mb = src.copy().convert('RGBA'); mb.putalpha(ab); clean(mb).save(f'{OUT}/frames/squat-03-hole-{k}-binary-alpha.png')
    abn = np.asarray(ab)
    meas[f'frame-{k}-binary-alpha'] = {'opaque_px': int((abn == 255).sum()), 'semi_px': 0, 'transparent_px': int((abn == 0).sum())}
    a = np.asarray(m.getchannel('A')); rgb_out = np.asarray(m.convert('RGB')).astype(int); rgb_src = np.asarray(src).astype(int)
    opaque = a == 255; semi = (a > 0) & (a < 255)
    diff = np.abs(rgb_out - rgb_src).sum(axis=2)
    bbox = m.getchannel('A').point(lambda v: 255 if v > 0 else 0).getbbox()
    meas[f'frame-{k}'] = {
        'size': m.size, 'opaque_px': int(opaque.sum()), 'semi_px': int(semi.sum()), 'transparent_px': int((a == 0).sum()),
        'opaque_px_with_rgb_changed': int((diff[opaque] > 0).sum()),
        'semi_px_with_rgb_changed': int((diff[semi] > 0).sum()),
        'opaque_bbox': bbox, 'unique_colours_out_opaque': int(len(np.unique(rgb_out[opaque], axis=0))),
        'unique_colours_src_same_region': int(len(np.unique(rgb_src[opaque], axis=0))),
    }
    print(k, meas[f'frame-{k}'])
    # before/after evidence
    sheet([(src, f'BEFORE  reference panel AI-REF-04 ({k}), banner cropped, otherwise untouched', False),
           (m, f'AFTER   same raster + alpha (rembg u2net + alpha matting); over checker', True)],
          f'{OUT}/evidence/before-after-{k}.png', title=f'Squat frame 3 (hole), {k} effort: reference vs transparent PNG')

# light vs max
sheet([(frames['light'], 'light: 1 red + 1 blue per side, bar straight, calm face', True),
       (frames['max'], 'max: 4 red per side, bar bows, flushed strain face, chalk puff', True)],
      f'{OUT}/evidence/light-vs-max.png', title='Effort contrast on the hole frame (both are the Fable reference raster)')

# cards
cards = {}
for k in ('light', 'max'):
    c = frames[k].crop(CARD_BOX); dst = f'{OUT}/cards/card-squat-{k}.png'; c.save(dst); cards[k] = c
    a = np.asarray(c.getchannel('A'))
    meas[f'card-{k}'] = {'size': c.size, 'box': CARD_BOX, 'opaque_px': int((a == 255).sum()), 'semi_px': int(((a > 0) & (a < 255)).sum())}
prev = Image.open(SRC['light']).convert('RGB'); ImageDraw.Draw(prev).rectangle(CARD_BOX, outline='#FFD000', width=3)
tmpl = Image.open(CARD_TEMPLATE).convert('RGB')
sheet([(prev, 'card crop box on the light frame', False), (cards['light'], 'card-squat-light.png (source res, RGBA)', True),
       (cards['max'], 'card-squat-max.png', True), (tmpl.resize((tmpl.width // 2, tmpl.height // 2), Image.LANCZOS), 'PR #71 card composition diagram (boxes, not art)', False)],
      f'{OUT}/evidence/card.png', title='Lift card composition (crop of the hole frame; NOT a 52-lattice card)')

# matting candidates (copied from the comparison pass)
for k in ('light', 'max'):
    shutil.copy(f'{ROOT}/proof/matte/compare-{k}.png', f'{OUT}/evidence/matting-candidates-{k}.png')
    shutil.copy(f'{ROOT}/proof/matte/zoom-feet-{k}.png', f'{OUT}/evidence/matting-feet-zoom-{k}.png')
# edge zoom on the chosen matte: head/bar and near shoe at 2x nearest (no resampling of art; magnification only)
for k in ('light', 'max'):
    m = frames[k]
    head = m.crop((220, 170, 420, 320)).resize((400, 300), Image.NEAREST)
    shoe = m.crop((150, 500, 350, 640)).resize((400, 280), Image.NEAREST)
    plate = m.crop((0, 180, 200, 380)).resize((400, 400), Image.NEAREST)
    sheet([(head, 'head + bar, 2x nearest', True), (shoe, 'near shoe, 2x nearest', True), (plate, 'near plate stack, 2x nearest', True)],
          f'{OUT}/evidence/edge-zoom-{k}.png', title=f'Alpha edge inspection, {k} (u2net + alpha matting)')

# layered sources via headless GIMP
for k in ('light', 'max'):
    r = subprocess.run(['python3', f'{ROOT}/tools/make_xcf.py', SRC[k], f'{OUT}/frames/squat-03-hole-{k}.png', f'{OUT}/source/squat-03-hole-{k}.xcf'],
                       capture_output=True, text=True, timeout=600)
    print(r.stdout.strip().splitlines()[-2:], r.returncode)
# card sources: background = same crop of the reference
for k in ('light', 'max'):
    bgc = f'{ROOT}/proof/card-bg-{k}.png'; Image.open(SRC[k]).convert('RGB').crop(CARD_BOX).save(bgc)
    r = subprocess.run(['python3', f'{ROOT}/tools/make_xcf.py', bgc, f'{OUT}/cards/card-squat-{k}.png', f'{OUT}/source/card-squat-{k}.xcf'],
                       capture_output=True, text=True, timeout=600)
    print(r.stdout.strip().splitlines()[-2:], r.returncode)

subprocess.run(['python3', f'{ROOT}/tools/plate_loss_evidence.py'], check=True)
meas['matting'] = {'tool': 'rembg 2.0.84 (MIT) model u2net (Apache-2.0 weights from github.com/danielgatis/rembg releases), alpha_matting=True (pymatting), fg_thr=240 bg_thr=15 erode=8',
                   'candidates_tried': ['isnet-anime', 'isnet-general-use', 'u2net', 'u2net_human_seg', 'silueta'], 'variants': ['plain', 'alpha matting']}
json.dump(meas, open(f'{OUT}/measurements.json', 'w'), indent=1)
print(json.dumps(meas, indent=1))
for dp, _, fs in os.walk(OUT):
    for f in sorted(fs):
        p = os.path.join(dp, f); print(f'{os.path.getsize(p):>9} {os.path.relpath(p, OUT)}')
