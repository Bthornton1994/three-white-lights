import { FEEL } from "../feel";

export type PixelBuffer = {
  w: number;
  h: number;
  data: Uint32Array;
};

export function createBuffer(w = FEEL.STAGE_W, h = FEEL.STAGE_H): PixelBuffer {
  return { w, h, data: new Uint32Array(w * h) };
}

export function clear(buf: PixelBuffer, color: number): void {
  buf.data.fill(color);
}

export function pset(buf: PixelBuffer, x: number, y: number, color: number): void {
  if (x < 0 || y < 0 || x >= buf.w || y >= buf.h) {
    return;
  }
  buf.data[(y | 0) * buf.w + (x | 0)] = color;
}

export function fillRect(
  buf: PixelBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
): void {
  const x0 = Math.max(0, x | 0);
  const y0 = Math.max(0, y | 0);
  const x1 = Math.min(buf.w, (x | 0) + (w | 0));
  const y1 = Math.min(buf.h, (y | 0) + (h | 0));
  for (let yy = y0; yy < y1; yy += 1) {
    const row = yy * buf.w;
    for (let xx = x0; xx < x1; xx += 1) {
      buf.data[row + xx] = color;
    }
  }
}

export function hline(buf: PixelBuffer, x: number, y: number, w: number, color: number): void {
  fillRect(buf, x, y, w, 1, color);
}

export function vline(buf: PixelBuffer, x: number, y: number, h: number, color: number): void {
  fillRect(buf, x, y, 1, h, color);
}

export function fillCircle(
  buf: PixelBuffer,
  cx: number,
  cy: number,
  r: number,
  color: number,
): void {
  const r2 = r * r;
  for (let y = -r; y <= r; y += 1) {
    for (let x = -r; x <= r; x += 1) {
      if (x * x + y * y <= r2) {
        pset(buf, cx + x, cy + y, color);
      }
    }
  }
}

export function blitToCanvas(buf: PixelBuffer, canvas: HTMLCanvasElement, scale: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  canvas.width = buf.w * scale;
  canvas.height = buf.h * scale;
  const image = ctx.createImageData(buf.w, buf.h);
  const px = image.data;
  for (let i = 0; i < buf.data.length; i += 1) {
    const c = buf.data[i] ?? 0;
    const o = i * 4;
    px[o] = c & 0xff;
    px[o + 1] = (c >> 8) & 0xff;
    px[o + 2] = (c >> 16) & 0xff;
    px[o + 3] = (c >> 24) & 0xff;
  }
  const off = document.createElement("canvas");
  off.width = buf.w;
  off.height = buf.h;
  const offCtx = off.getContext("2d");
  if (!offCtx) {
    return;
  }
  offCtx.putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
}

export function bufferToDataUrl(buf: PixelBuffer, scale: number): string {
  const canvas = document.createElement("canvas");
  blitToCanvas(buf, canvas, scale);
  return canvas.toDataURL("image/png");
}
