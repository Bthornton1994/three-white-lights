import { useEffect, useRef } from "react";
import type { LiftId } from "../feel.ts";
import type { LiftPresentationState } from "../game/liftPresentation.ts";
import type { JudgeColor } from "../math/types.ts";
import { SPRITE_EDITION } from "../sprites/edition.ts";
import { SCENE, visualEffort } from "../sprites/sheets.ts";
import { STAGE, anchorFromSrc, contactWorld, placeAnchor } from "../sprites/anchors.ts";
import { frameSrcFromPresentation, poseFromPresentation } from "../sport/frames.ts";
import type { Screen } from "../sport/machine.ts";

type Props = {
  lift: LiftId;
  screen: Screen;
  clockMs: number;
  lights: [JudgeColor, JudgeColor, JudgeColor];
  weightKg: number;
  e1rmKg: number;
  presentation: LiftPresentationState | null;
};

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dw: number,
  dh: number,
  posX = 0.5,
  posY = 0.42,
): void {
  const scale = Math.max(dw / img.width, dh / img.height);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = Math.round((img.width - sw) * posX);
  const sy = Math.round((img.height - sh) * posY);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, sx, sy, Math.round(sw), Math.round(sh), 0, 0, dw, dh);
}

const imageCache = new Map<string, HTMLImageElement>();

function loadImage(src: string): Promise<HTMLImageElement> {
  const hit = imageCache.get(src);
  if (hit && hit.complete && hit.naturalWidth > 0) return Promise.resolve(hit);
  return new Promise((resolve, reject) => {
    const img = hit ?? new Image();
    img.decoding = "sync";
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`sprite missing: ${src}`));
    if (!hit) {
      img.src = src;
      imageCache.set(src, img);
    }
  });
}

export function SpriteStage({
  lift,
  screen,
  clockMs,
  lights,
  weightKg,
  e1rmKg,
  presentation,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const effort = visualEffort(weightKg, e1rmKg);
  const src = frameSrcFromPresentation(lift, screen, presentation, clockMs, effort);
  const anchor = anchorFromSrc(src);
  const dest = placeAnchor(anchor);
  const world = contactWorld(anchor);
  const pose = poseFromPresentation(presentation, screen);
  const frameName = src.split("/").pop() ?? "";
  const showLights = screen !== "title" && screen !== "lift" && screen !== "attempts";
  const strain = presentation?.strain ?? 0;
  const grind = presentation?.grindIntensity ?? 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let cancelled = false;
    void Promise.all([loadImage(SCENE.platform), loadImage(src)]).then(([platform, lifter]) => {
      if (cancelled || !canvasRef.current) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, STAGE.width, STAGE.height);
      drawCover(ctx, platform, STAGE.width, STAGE.height);
      ctx.drawImage(lifter, dest.x, dest.y);
    });
    return () => {
      cancelled = true;
    };
  }, [src, dest.x, dest.y]);

  return (
    <div
      className="stage-wrap sprite-world-wrap"
      aria-hidden="true"
      data-sprite-stage="true"
      data-preview-build={SPRITE_EDITION.PREVIEW_BUILD}
      data-sport-source={SPRITE_EDITION.MECHANICS_SHA}
      data-presentation-base={SPRITE_EDITION.BASE_SHA}
      data-lift-phase={presentation?.phase ?? ""}
      data-bar-height={presentation ? presentation.barHeight.toFixed(3) : ""}
      data-lift-depth={presentation ? presentation.depth.toFixed(3) : ""}
      data-strain={strain.toFixed(3)}
      data-grind={grind.toFixed(3)}
      data-anim-frame={frameName}
      data-anim-pose={pose}
      data-contact-x={anchor.contactX}
      data-contact-y={anchor.contactY}
      data-world-y={world.y}
      data-dest-y={dest.y}
      data-command-press={presentation?.command.pressCommandLive ? "true" : "false"}
      data-command-lockout={presentation?.command.lockoutHoldLive ? "true" : "false"}
      style={{
        ["--strain" as string]: String(strain),
        ["--grind" as string]: String(grind),
      }}
    >
      <canvas
        ref={canvasRef}
        className="sprite-world"
        width={STAGE.width}
        height={STAGE.height}
        data-stage-w={STAGE.width}
        data-stage-h={STAGE.height}
      />
      {showLights ? (
        <div className="lights sprite-stage-lights">
          {lights.map((color, i) => (
            <span key={`${color}-${i}`} className={`light ${color}`} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
