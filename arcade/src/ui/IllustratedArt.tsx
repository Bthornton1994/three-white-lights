import type { CSSProperties } from "react";
import type { LiftId } from "../feel.ts";
import { LIFT_STILLS, TITLE_STILL } from "../illustrated/assets.ts";
import { ILLUSTRATED_MOTION, timingCamera } from "../illustrated/motion.ts";
import type { JudgeColor } from "../math/types.ts";

type ArtProps = {
  src: string;
  alt: string;
  objectPosition?: string;
  scale?: number;
  kenBurns?: boolean;
  className?: string;
  file?: string;
};

export function IllustratedArt({
  src,
  alt,
  objectPosition,
  scale = 1,
  kenBurns = false,
  className,
  file,
}: ArtProps) {
  const style: CSSProperties = {
    objectPosition,
    ["--illustrated-scale" as string]: String(scale),
    ["--illustrated-ken-burns-ms" as string]: `${ILLUSTRATED_MOTION.KEN_BURNS_DURATION_MS}ms`,
    ["--illustrated-ken-burns-scale" as string]: String(ILLUSTRATED_MOTION.KEN_BURNS_SCALE_TO),
    ["--illustrated-vignette" as string]: String(ILLUSTRATED_MOTION.VIGNETTE_OPACITY),
    ["--illustrated-lighting" as string]: String(ILLUSTRATED_MOTION.LIGHTING_AMBER_OPACITY),
  };
  const imgClass = kenBurns ? "illustrated-still illustrated-ken-burns" : "illustrated-still";
  return (
    <div className={`illustrated-stage ${className ?? ""}`} aria-hidden={alt === ""}>
      <img
        className={imgClass}
        src={src}
        alt={alt}
        style={style}
        data-illustrated-file={file}
      />
      <div className="illustrated-lighting" />
      <div className="illustrated-vignette" />
    </div>
  );
}

export function IllustratedTitleArt() {
  return (
    <IllustratedArt
      src={TITLE_STILL.src}
      alt=""
      kenBurns
      className="illustrated-title-art"
      file={TITLE_STILL.file}
    />
  );
}

export function IllustratedTimingStage({
  lift,
  progress,
  lights,
}: {
  lift: LiftId;
  progress: number;
  lights: [JudgeColor, JudgeColor, JudgeColor];
}) {
  const still = LIFT_STILLS[lift];
  const camera = timingCamera(lift, progress);
  return (
    <div className="stage-wrap illustrated-timing-wrap" data-illustrated-file={still.file}>
      <IllustratedArt
        src={still.src}
        alt=""
        objectPosition={camera.objectPosition}
        scale={camera.scale}
        className="illustrated-timing-art"
        file={still.file}
      />
      <div className="lights illustrated-stage-lights">
        {lights.map((color, i) => (
          <span key={`${color}-${i}`} className={`light ${color}`} />
        ))}
      </div>
      {still.limited ? <span className="illustrated-chip">LIMITED — still, not frames</span> : null}
    </div>
  );
}
