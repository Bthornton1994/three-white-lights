"""Run several rembg matting models on the two Fable squat-hole panels and record alpha stats.
Figure pixels are the original reference raster; only alpha is added. No mask is used as art."""
import os, time, json, sys
from PIL import Image
import numpy as np
from rembg import remove, new_session
IN = {'light': 'host/ref-squat-light.png', 'max': 'host/ref-squat-max.png'}
MODELS = ['isnet-anime', 'isnet-general-use', 'u2net', 'u2net_human_seg', 'silueta']
OUT = 'proof/matte'; stats = {}
for m in MODELS:
    try:
        t0 = time.time(); sess = new_session(m); print(f'[{m}] session ready in {time.time()-t0:.1f}s', flush=True)
    except Exception as e:
        print(f'[{m}] session FAILED: {type(e).__name__}: {str(e)[:200]}', flush=True); continue
    for variant, kw in (('plain', {}), ('am', dict(alpha_matting=True, alpha_matting_foreground_threshold=240,
                                                   alpha_matting_background_threshold=15, alpha_matting_erode_size=8))):
        for k, p in IN.items():
            try:
                img = Image.open(p).convert('RGB'); t0 = time.time()
                out = remove(img, session=sess, **kw); dt = time.time() - t0
                d = f'{OUT}/{m}-{variant}'; os.makedirs(d, exist_ok=True); out.save(f'{d}/{k}.png')
                a = np.asarray(out.getchannel('A'))
                stats[f'{m}-{variant}/{k}'] = dict(sec=round(dt, 1), opaque=int((a == 255).sum()), semi=int(((a > 0) & (a < 255)).sum()), transparent=int((a == 0).sum()))
                print(f'[{m}-{variant}] {k}: {dt:.1f}s opaque={stats[f"{m}-{variant}/{k}"]["opaque"]} semi={stats[f"{m}-{variant}/{k}"]["semi"]}', flush=True)
            except Exception as e:
                print(f'[{m}-{variant}] {k} FAILED: {type(e).__name__}: {str(e)[:200]}', flush=True)
json.dump(stats, open(f'{OUT}/stats.json', 'w'), indent=1); print('DONE', flush=True)
