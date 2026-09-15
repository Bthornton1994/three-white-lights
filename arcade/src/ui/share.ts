export async function shareResultsCard(node: HTMLElement, filename: string): Promise<void> {
  const dataUrl = await cardNodeToPng(node);
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    await nav.share({
      title: "Three White Lights: Iron & Amber Arcade",
      files: [file],
    });
    return;
  }
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

const CLEAR = new Set(["", "transparent", "rgba(0, 0, 0, 0)"]);

/**
 * Paint the live scoresheet into a PNG. SVG foreignObject taints the canvas
 * in Chromium, so this walks computed layout instead of dumping innerText.
 */
export async function cardNodeToPng(node: HTMLElement): Promise<string> {
  const box = node.getBoundingClientRect();
  const width = Math.max(320, Math.ceil(box.width || node.offsetWidth || 320));
  const height = Math.max(240, Math.ceil(box.height || node.offsetHeight || 240));
  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("canvas unavailable");
  }
  ctx.scale(2, 2);
  ctx.fillStyle = "#f3ead8";
  ctx.fillRect(0, 0, width, height);
  paintElement(ctx, node, box.left, box.top);
  return canvas.toDataURL("image/png");
}

export function paintElement(
  ctx: CanvasRenderingContext2D,
  el: Element,
  originX: number,
  originY: number,
): void {
  const r = el.getBoundingClientRect();
  const x = r.left - originX;
  const y = r.top - originY;
  const style = getComputedStyle(el);
  const bg = style.backgroundColor;
  if (bg && !CLEAR.has(bg)) {
    ctx.fillStyle = bg;
    if (el.tagName === "I") {
      ctx.beginPath();
      ctx.arc(x + r.width / 2, y + r.height / 2, Math.max(1, r.width / 2), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(x, y, r.width, r.height);
    }
  }
  const borderW = Number.parseFloat(style.borderTopWidth);
  if (borderW > 0 && style.borderTopStyle !== "none") {
    ctx.strokeStyle = style.borderTopColor;
    ctx.lineWidth = borderW;
    if (el.tagName === "I") {
      ctx.beginPath();
      ctx.arc(
        x + r.width / 2,
        y + r.height / 2,
        Math.max(0.5, r.width / 2 - borderW / 2),
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    } else {
      ctx.strokeRect(x + borderW / 2, y + borderW / 2, r.width - borderW, r.height - borderW);
    }
  }
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      paintElement(ctx, child as Element, originX, originY);
    } else if (child.nodeType === Node.TEXT_NODE) {
      const raw = child.textContent ?? "";
      if (!raw.trim()) {
        continue;
      }
      const range = document.createRange();
      range.selectNodeContents(child);
      const tr = range.getBoundingClientRect();
      ctx.fillStyle = style.color;
      ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      ctx.textBaseline = "top";
      let painted = raw.replace(/\s+/g, " ").trim();
      if (style.textTransform === "uppercase") {
        painted = painted.toUpperCase();
      }
      ctx.fillText(painted, tr.left - originX, tr.top - originY);
    }
  }
}
