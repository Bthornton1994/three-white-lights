"""Build a layered GIMP .xcf source with headless GIMP 2.10 (script-fu batch mode).
Layers: figure (original raster + alpha) over the untouched reference panel, plus a saved
selection channel holding the figure alpha as an editable mask.
Usage: python3 make_xcf.py <bg.png> <fg_rgba.png> <out.xcf>
"""
import os, subprocess, sys

bg, fg, out = (os.path.abspath(p) for p in sys.argv[1:4])
scm = f'''(let* ((img (car (gimp-file-load RUN-NONINTERACTIVE "{bg}" "{bg}")))
              (bgl (car (gimp-image-get-active-layer img)))
              (fgl (car (gimp-file-load-layer RUN-NONINTERACTIVE img "{fg}"))))
   (gimp-item-set-name bgl "reference panel (AI-REF-04, banner cropped)")
   (gimp-image-insert-layer img fgl 0 0)
   (gimp-item-set-name fgl "figure (original raster + alpha)")
   (gimp-image-select-item img CHANNEL-OP-REPLACE fgl)
   (let* ((ch (car (gimp-selection-save img)))) (gimp-item-set-name ch "figure alpha (editable mask)"))
   (gimp-selection-none img)
   (gimp-xcf-save 0 img fgl "{out}" "{out}")
   (gimp-quit 0))'''
r = subprocess.run(['gimp', '-i', '-d', '-f', '-b', scm], capture_output=True, text=True, timeout=300)
err = [l for l in (r.stdout + r.stderr).splitlines() if l.strip() and not any(k in l.lower() for k in ('gegl', 'babl', 'glib'))]
print('\n'.join(err[-5:]))
if os.path.exists(out):
    print('wrote', out, os.path.getsize(out), 'bytes')
    chk = f'''(let* ((img (car (gimp-file-load RUN-NONINTERACTIVE "{out}" "{out}")))
                   (n (car (gimp-image-get-layers img))) (c (car (gimp-image-get-channels img))))
              (gimp-message (string-append "verify layers=" (number->string n) " channels=" (number->string c)))
              (gimp-quit 0))'''
    v = subprocess.run(['gimp', '-i', '-d', '-f', '-b', chk], capture_output=True, text=True, timeout=300)
    print('\n'.join(l for l in (v.stdout + v.stderr).splitlines() if 'verify' in l))
else:
    print('XCF not written'); sys.exit(1)
