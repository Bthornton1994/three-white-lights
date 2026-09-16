"""Evidence crop for the critic finding that the matte removed the near-side outer blue plate on the light frame.
Left plate stack region of the reference vs the delivered frame, 2x nearest, over a checker."""
from PIL import Image, ImageDraw

ROOT = '/tmp/claude-0/-home-user-three-white-lights/92b70b66-ad87-5297-884b-486c8b55fc05/scratchpad'
box = (0, 150, 200, 400)
ref = Image.open(f'{ROOT}/host/ref-squat-light.png').convert('RGBA').crop(box)
out = Image.open(f'{ROOT}/proof/out/frames/squat-03-hole-light.png').convert('RGBA').crop(box)
refm = Image.open(f'{ROOT}/host/ref-squat-max.png').convert('RGBA').crop((100, 300, 500, 420))
outm = Image.open(f'{ROOT}/proof/out/frames/squat-03-hole-max-binary-alpha.png').convert('RGBA').crop((100, 300, 500, 420))
panels = [(ref.resize((400, 500), Image.NEAREST), 'reference light, left stack (blue 20 kg outermost)'),
          (out.resize((400, 500), Image.NEAREST), 'delivered light frame: outer blue plate lost by the matte'),
          (refm.resize((800, 240), Image.NEAREST), 'reference max, hips'),
          (outm.resize((800, 240), Image.NEAREST), 'delivered max (binary alpha): navy backdrop patches at hips, chalk lost')]
pad, cap = 16, 30
W = pad + sum(p.width + pad for p, _ in panels); H = pad + 36 + 500 + cap + pad
s = Image.new('RGB', (W, H), '#1a1a1e'); d = ImageDraw.Draw(s)
d.text((pad, pad), 'Matting defects found by the independent critics (2x nearest magnification)', fill='#efe6da')
x = pad
for p, capt in panels:
    for cy in range(pad + 36, pad + 36 + p.height, 16):
        for cx in range(x, x + p.width, 16):
            c = '#3a3a40' if ((cx - x) // 16 + (cy - pad - 36) // 16) % 2 else '#2c2c32'
            d.rectangle([cx, cy, min(cx + 15, x + p.width - 1), min(cy + 15, pad + 36 + p.height - 1)], fill=c)
    s.paste(p, (x, pad + 36), p)
    d.text((x, pad + 36 + 500 + 6), capt, fill='#efe6da')
    x += p.width + pad
out_path = f'{ROOT}/proof/out/evidence/critic-defects.png'
s.save(out_path); print('wrote', out_path, s.size)
