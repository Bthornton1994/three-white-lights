import { laneWindowPercent } from "../loop/timing.ts";
import type { TimingCue } from "../math/types.ts";

type Props = {
  cues: TimingCue[];
  progress: number;
  durationMs: number;
};

export function TimingLane({ cues, progress, durationMs }: Props) {
  return (
    <div className="lane" aria-hidden="true">
      {cues.map((cue) => {
        const band = laneWindowPercent(cue, durationMs);
        return (
          <span
            key={cue.id}
            className="lane-window"
            style={{ left: `${band.leftPct}%`, width: `${band.widthPct}%` }}
          />
        );
      })}
      <span className="lane-needle" style={{ left: `${Math.min(100, progress * 100)}%` }} />
    </div>
  );
}