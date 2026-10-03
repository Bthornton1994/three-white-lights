export async function shareResultsCard(node: HTMLElement, filename: string): Promise<void> {
  const { toPng } = await importCanvas();
  const dataUrl = await toPng(node);
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

async function importCanvas(): Promise<{ toPng: (node: HTMLElement) => Promise<string> }> {
  return {
    toPng: async (node: HTMLElement) => {
      const canvas = document.createElement("canvas");
      const width = Math.max(320, node.offsetWidth);
      const height = Math.max(240, node.offsetHeight);
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("canvas unavailable");
      }
      ctx.scale(2, 2);
      ctx.fillStyle = "#f3ead8";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#1c120e";
      ctx.font = "16px Palatino, serif";
      const text = node.innerText;
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      let y = 28;
      for (const line of lines) {
        ctx.fillText(line.slice(0, 48), 16, y);
        y += 22;
      }
      return canvas.toDataURL("image/png");
    },
  };
}
