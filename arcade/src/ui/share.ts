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

function collectCssText(): string {
  const parts: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        parts.push(rule.cssText);
      }
    } catch {
      // Skip unreadable sheets (cross-origin).
    }
  }
  return parts.join("\n");
}

/** SVG snapshot of the on-screen sheet — used by share and tests. */
export function cardNodeToSvg(node: HTMLElement): string {
  const width = Math.max(320, Math.ceil(node.offsetWidth || node.scrollWidth || 320));
  const height = Math.max(240, Math.ceil(node.offsetHeight || node.scrollHeight || 240));
  const css = collectCssText().replace(/]]>/g, "");
  const markup = node.outerHTML;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<foreignObject x="0" y="0" width="${width}" height="${height}">`,
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;margin:0;">`,
    `<style>${css}</style>`,
    markup,
    `</div></foreignObject></svg>`,
  ].join("");
}

export async function cardNodeToPng(node: HTMLElement): Promise<string> {
  const width = Math.max(320, Math.ceil(node.offsetWidth || node.scrollWidth || 320));
  const height = Math.max(240, Math.ceil(node.offsetHeight || node.scrollHeight || 240));
  const svg = cardNodeToSvg(node);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("canvas unavailable");
    }
    ctx.fillStyle = "#f3ead8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("card snapshot failed"));
    image.src = url;
  });
}
