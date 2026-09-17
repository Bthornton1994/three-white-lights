import { FEEL, LIFT_COPY } from "../feel.ts";
import { SHARE_BACKDROP, SHARE_PORTRAIT } from "../illustrated/assets.ts";
import type { ArcadeMeet, AttemptOutcome, JudgeColor } from "../math/types.ts";

export function lightGlyph(color: JudgeColor): string {
  if (color === "white") return "○";
  if (color === "red") return "●";
  return "·";
}

export function judgeLightGlyphs(lights: AttemptOutcome["lights"]): string {
  return lights.map(lightGlyph).join(" ");
}

export function shareAttemptRight(outcome: AttemptOutcome): string {
  const mark = outcome.made ? outcome.weightKg.toFixed(1) : `${outcome.weightKg.toFixed(1)} x`;
  return `${mark} ${judgeLightGlyphs(outcome.lights)} · RPE ${outcome.impliedRpe.toFixed(1)}`;
}

export function shareCardRows(meet: ArcadeMeet): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ["Lifter", FEEL.LIFTER_NAME],
    ["Bodyweight", `${FEEL.BODYWEIGHT_KG}.0 kg`],
    ["Lift", LIFT_COPY[meet.lift].name],
  ];
  for (const outcome of meet.outcomes) {
    rows.push([`A${outcome.attempt}`, shareAttemptRight(outcome)]);
  }
  rows.push(
    ["Best", `${meet.bestKg.toFixed(1)} kg`],
    ["DOTS", meet.dots.toFixed(2)],
    ["Weight", String(meet.breakdown.weight)],
    ["Execution", String(meet.breakdown.execution)],
    ["Streak", String(meet.breakdown.streak)],
    ["Score", String(meet.breakdown.total)],
  );
  return rows;
}

export type ShareDrawContext = {
  fillStyle: string | CanvasGradient | CanvasPattern;
  font: string;
  globalAlpha?: number;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
  measureText(text: string): { width: number };
  drawImage?(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void;
  save?(): void;
  restore?(): void;
};

export type ShareCanvas = {
  width: number;
  height: number;
  getContext(id: "2d"): ShareDrawContext | null;
};

export type ShareArt = {
  backdrop: CanvasImageSource;
  portrait?: CanvasImageSource;
};

function line(
  ctx: ShareDrawContext,
  left: string,
  right: string,
  y: number,
  wide: number,
): void {
  ctx.fillText(left, 48, y);
  const w = ctx.measureText(right).width;
  ctx.fillText(right, wide - 48 - w, y);
}

export function createShareCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  return canvas;
}

export function drawResultsCard(
  meet: ArcadeMeet,
  canvas: ShareCanvas = createShareCanvas(),
  art?: ShareArt,
): ShareCanvas {
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }
  if (art?.backdrop && ctx.drawImage) {
    ctx.drawImage(art.backdrop, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(20, 17, 15, 0.58)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = "#14110f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.fillStyle = "#f3e6c8";
  ctx.fillRect(40, 40, canvas.width - 80, canvas.height - 80);
  ctx.fillStyle = "#1a1510";
  ctx.fillRect(64, 64, canvas.width - 128, 8);
  if (art?.portrait && ctx.drawImage) {
    ctx.drawImage(art.portrait, 64, 92, canvas.width - 128, 220);
    ctx.fillStyle = "#1a1510";
    ctx.font = "600 22px 'Barlow Condensed', sans-serif";
    ctx.fillText("ILLUSTRATED STILL · NOT A DEDICATED CARD", 72, 328);
  }
  ctx.fillStyle = "#1a1510";
  ctx.font = "600 28px 'Barlow Condensed', sans-serif";
  const headerY = art?.portrait ? 372 : 116;
  ctx.fillText(FEEL.FEDERATION, 72, headerY);
  ctx.font = "600 42px 'Source Serif 4', serif";
  ctx.fillText(FEEL.MEET_NAME, 72, headerY + 56);
  ctx.fillRect(72, headerY + 76, canvas.width - 144, 2);

  ctx.font = "500 32px 'Source Serif 4', serif";
  let y = headerY + 138;
  const rows = shareCardRows(meet);
  for (const [left, right] of rows) {
    line(ctx, left, right, y, canvas.width);
    y += 56;
  }
  ctx.fillRect(72, y + 8, canvas.width - 144, 2);
  ctx.font = "600 48px 'Barlow Condensed', sans-serif";
  line(
    ctx,
    meet.bombed ? "BOMB-OUT" : "TOTAL",
    meet.bombed ? "0 kg" : `${meet.totalKg.toFixed(1)} kg`,
    y + 80,
    canvas.width,
  );
  ctx.font = "600 22px 'Barlow Condensed', sans-serif";
  ctx.fillText("ILLUSTRATED DIRECT-USE · NOT PRODUCTION ART", 72, canvas.height - 72);
  return canvas;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`still failed to load: ${src}`));
    img.src = src;
  });
}

async function loadShareArt(): Promise<ShareArt | undefined> {
  try {
    const [backdrop, portrait] = await Promise.all([
      loadImage(SHARE_BACKDROP.src),
      loadImage(SHARE_PORTRAIT.src),
    ]);
    return { backdrop, portrait };
  } catch {
    return undefined;
  }
}

async function canvasToBlob(canvas: ShareCanvas): Promise<Blob | null> {
  const blobable = canvas as ShareCanvas & {
    toBlob?: (callback: (blob: Blob | null) => void, type?: string) => void;
  };
  return new Promise((resolve) => {
    if (typeof blobable.toBlob !== "function") {
      resolve(null);
      return;
    }
    blobable.toBlob((b) => resolve(b), "image/png");
  });
}

function triggerDownload(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "iron-amber-arcade-card.png";
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadResultsCard(meet: ArcadeMeet): Promise<void> {
  const art = await loadShareArt();
  const canvas = drawResultsCard(meet, createShareCanvas(), art);
  const blob = await canvasToBlob(canvas);
  if (blob) {
    triggerDownload(blob);
  }
}

export async function shareResultsCard(meet: ArcadeMeet): Promise<void> {
  const art = await loadShareArt();
  const canvas = drawResultsCard(meet, createShareCanvas(), art);
  const blob = await canvasToBlob(canvas);
  if (!blob) {
    return;
  }
  const file = new File([blob], "iron-amber-arcade-card.png", { type: "image/png" });
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };
  if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
    try {
      await nav.share({
        files: [file],
        title: FEEL.TITLE,
        text: `${LIFT_COPY[meet.lift].name} ${meet.totalKg.toFixed(1)} kg`,
      });
      return;
    } catch {
      // fall through to download
    }
  }
  triggerDownload(blob);
}
