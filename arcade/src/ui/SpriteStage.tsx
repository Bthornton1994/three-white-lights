import { useEffect, useRef } from "react";
import { FEEL, type LiftId } from "../feel";
import type { JudgeColor } from "../math/types";
import { blitToCanvas } from "../sprites/canvas";
import { renderArcadeFrame } from "../sprites/render";

type Props = {
  lift: LiftId;
  progress: number;
  weightKg: number;
  e1rmKg: number;
  screen: string;
  lights?: readonly (JudgeColor | "off")[];
};

export function SpriteStage(props: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  const { lift, progress, weightKg, e1rmKg, screen, lights } = props;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) {
      return;
    }
    const frame = renderArcadeFrame({
      lift,
      progress,
      weightKg,
      e1rmKg,
      screen,
      ...(lights ? { lights } : {}),
    });
    const parentWidth = canvas.parentElement?.clientWidth ?? FEEL.STAGE_W * 3;
    const scale = Math.max(
      2,
      Math.min(FEEL.STAGE_SCALE_MAX, Math.floor(parentWidth / FEEL.STAGE_W)),
    );
    blitToCanvas(frame, canvas, scale);
  }, [lift, progress, weightKg, e1rmKg, screen, lights]);

  return (
    <div className="stage-wrap" aria-hidden="true">
      <canvas ref={ref} width={FEEL.STAGE_W} height={FEEL.STAGE_H} />
    </div>
  );
}
