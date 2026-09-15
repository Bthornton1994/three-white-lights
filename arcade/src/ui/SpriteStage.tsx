import type { LiftId } from "../feel.ts";
import type { Screen } from "../loop/machine.ts";
import type { JudgeColor } from "../math/types.ts";
import { SCENE, frameSrcFor, visualEffort } from "../sprites/sheets.ts";

type Props = {
  lift: LiftId;
  screen: Screen;
  progress: number;
  clockMs: number;
  lights: [JudgeColor, JudgeColor, JudgeColor];
  weightKg: number;
  e1rmKg: number;
};

export function SpriteStage({ lift, screen, progress, clockMs, lights, weightKg, e1rmKg }: Props) {
  const src = frameSrcFor(lift, screen, progress, clockMs, visualEffort(weightKg, e1rmKg));
  const showLights = screen !== "title" && screen !== "lift" && screen !== "attempts";
  return (
    <div className="stage-wrap" aria-hidden="true">
      <img className="stage-bg" src={SCENE.platform} alt="" />
      <img className="stage-lifter" src={src} alt="" />
      {showLights ? (
        <div className="lights" style={{ position: "absolute", top: 16, left: 0, right: 0 }}>
          {lights.map((color, i) => (
            <span key={`${color}-${i}`} className={`light ${color}`} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
