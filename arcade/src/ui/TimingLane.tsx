import { laneWindowPercent } from "../loop/timing";
import type { TimingCue } from "../math/types";

type Props = {
  cues: readonly TimingCue[];
  progress: number;
  activeIndex: number;
  durationMs: number;
};

export function TimingLane({ cues, progress, activeIndex, durationMs }: Props) {
  return (
    <div className="col" aria-label="Timing lane">
      {cues.map((cue, i) => {
        const band = laneWindowPercent(cue, durationMs);
        return (
          <div key={cue.id} className="col">
            <div className="hud">
              <span>{cue.label}</span>
              <span>{i === activeIndex ? "NOW" : i < activeIndex ? "LOCKED" : "WAIT"}</span>
            </div>
            <div className="lane">
              <div
                className="window"
                style={{
                  left: `${band.leftPct}%`,
                  width: `${band.widthPct}%`,
                }}
              />
              <div className="needle" style={{ left: `${progress * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
