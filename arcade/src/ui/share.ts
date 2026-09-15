import { FEEL, LIFT_COPY } from "../feel.ts";
import type { ArcadeMeet } from "../math/types.ts";

function line(
  ctx: CanvasRenderingContext2D,
  left: string,
  right: string,
  y: number,
  wide: number,
): void {
  ctx.fillText(left, 48, y);
  const w = ctx.measureText(right).width;
  ctx.fillText(right, wide - 48 - w, y);
}

export function drawResultsCard(meet: ArcadeMeet): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }
  ctx.fillStyle = "#f3e6c8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1a1510";
  ctx.fillRect(40, 40, canvas.width - 80, 8);
  ctx.font = "600 28px 'Barlow Condensed', sans-serif";
  ctx.fillText(FEEL.FEDERATION, 48, 92);
  ctx.font = "600 42px 'Source Serif 4', serif";
  ctx.fillText(FEEL.MEET_NAME, 48, 148);
  ctx.fillRect(48, 168, canvas.width - 96, 2);

  ctx.font = "500 32px 'Source Serif 4', serif";
  let y = 230;
  const rows: Array<[string, string]> = [
    ["Lifter", FEEL.LIFTER_NAME],
    ["Bodyweight", `${FEEL.BODYWEIGHT_KG}.0 kg`],
    ["Lift", LIFT_COPY[meet.lift].name],
  ];
  for (const outcome of meet.outcomes) {
    const mark = outcome.made ? outcome.weightKg.toFixed(1) : `${outcome.weightKg.toFixed(1)} x`;
    rows.push([
      `A${outcome.attempt}`,
      `${mark}   RPE ${outcome.impliedRpe.toFixed(1)}`,
    ]);
  }
  rows.push(
    ["Best", `${meet.bestKg.toFixed(1)} kg`],
    ["DOTS", meet.dots.toFixed(2)],
    ["Weight", String(meet.breakdown.weight)],
    ["Execution", String(meet.breakdown.execution)],
    ["Streak", String(meet.breakdown.streak)],
    ["Score", String(meet.breakdown.total)],
  );
  for (const [left, right] of rows) {
    line(ctx, left, right, y, canvas.width);
    y += 56;
  }
  ctx.fillRect(48, y + 8, canvas.width - 96, 2);
  ctx.font = "600 48px 'Barlow Condensed', sans-serif";
  line(
    ctx,
    meet.bombed ? "BOMB-OUT" : "TOTAL",
    meet.bombed ? "0 kg" : `${meet.totalKg.toFixed(1)} kg`,
    y + 80,
    canvas.width,
  );
  return canvas;
}

export async function shareResultsCard(meet: ArcadeMeet): Promise<void> {
  const canvas = drawResultsCard(meet);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png"),
  );
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
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "iron-amber-arcade-card.png";
  a.click();
  URL.revokeObjectURL(url);
}
