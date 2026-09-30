import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { TEXTURE_FORMAT as FORMAT } from './interfaceTuning';

const textureCache = new Map<string, Promise<HTMLCanvasElement>>();

/** Decode chroma-keyed source textures at render time; source PNGs stay intact. */
function texture(src: string): Promise<HTMLCanvasElement> {
  let pending = textureCache.get(src);
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const surface = document.createElement('canvas');
      surface.width = img.naturalWidth; surface.height = img.naturalHeight;
      const context = surface.getContext('2d');
      if (!context) { reject(new Error('Canvas unavailable')); return; }
      context.drawImage(img, 0, 0);
      const pixels = context.getImageData(0, 0, surface.width, surface.height);
      for (let n = 0; n < pixels.data.length; n += FORMAT.RGBA_STRIDE) {
        const r = pixels.data[n]!, g = pixels.data[n + 1]!, b = pixels.data[n + 2]!;
        // Fuchsia key varies slightly across the generated source sheets.
        const keyed = r > FORMAT.KEY_RED_MIN && b > FORMAT.KEY_BLUE_MIN && g < Math.min(r, b) * FORMAT.KEY_GREEN_RATIO_MAX && b / r > FORMAT.KEY_BLUE_RED_RATIO_MIN;
        if (keyed) pixels.data[n + FORMAT.ALPHA_CHANNEL] = 0;
      }
      context.putImageData(pixels, 0, 0);
      resolve(surface);
    };
    img.onerror = () => { textureCache.delete(src); reject(new Error('Artwork unavailable')); };
    img.src = src;
  });
  textureCache.set(src, pending);
  return pending;
}

export function Art({ src, label = '', className, style }: { src: string; label?: string; className?: string; style?: CSSProperties }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true; setFailed(false);
    texture(src).then(surface => {
      if (!active || !canvas.current) return;
      canvas.current.width = surface.width; canvas.current.height = surface.height;
      canvas.current.getContext('2d')?.drawImage(surface, 0, 0);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [src]);
  if (failed) return <span className={className} style={style}>{label}</span>;
  return <canvas ref={canvas} className={className} style={style} role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true} />;
}
