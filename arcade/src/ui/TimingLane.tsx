import type { TimingCue } from "../math/types";

type Props = {
  cues: readonly TimingCue[];
  progress: number;
  activeIndex: number;
};

export function TimingLane({ cues, progress, activeIndex }: Props) {
  return (
    <div className="col" aria-label="Timing lane">
      {cues.map((cue, i) => (
        <div key={cue.id} className="col">
          <div className="hud">
            <span>{cue.label}</span>
            <span>{i === activeIndex ? "NOW" : i < activeIndex ? "LOCKED" : "WAIT"}</span>
          </div>
          <div className="lane">
            <div
              className="window"
              style={{
                left: `${(cue.center - 0.06) * 100}%`,
                width: "12%",
              }}
            />
            <div className="needle" style={{ left: `${progress * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
