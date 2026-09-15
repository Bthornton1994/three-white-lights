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
        const half = durationMs <= 0 ? 0 : cue.windowMs / durationMs / 2;
        const left = Math.max(0, (cue.center - half) * 100);
        const width = Math.min(100 - left, half * 2 * 100);
        return (
          <span
            key={cue.id}
            className="lane-window"
            style={{ left: `${left}%`, width: `${width}%` }}
          />
        );
      })}
      <span className="lane-needle" style={{ left: `${Math.min(100, progress * 100)}%` }} />
    </div>
  );
}
