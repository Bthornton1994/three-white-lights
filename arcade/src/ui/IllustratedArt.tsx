import type { CSSProperties } from "react";
import type { LiftId } from "../feel.ts";
import type { Screen } from "../loop/machine.ts";
import {
  LIFT_STILLS,
  TITLE_STILL,
  cameraForScreen,
  captionForScreen,
  chipForScreen,
  kenBurnsForScreen,
  stillForScreen,
} from "../illustrated/assets.ts";
import { ILLUSTRATED_MOTION } from "../illustrated/motion.ts";
import type { JudgeColor } from "../math/types.ts";

type ArtProps = {
  src: string;
  alt: string;
  objectPosition?: string;
  scale?: number;
  kenBurns?: boolean;
  className?: string;
  file?: string;
  objectFit?: "cover" | "contain";
  tone?: "default" | "fail" | "success";
};

export function IllustratedArt({
  src,
  alt,
  objectPosition,
  scale = 1,
  kenBurns = false,
  className,
  file,
  objectFit,
  tone = "default",
}: ArtProps) {
  const style: CSSProperties = {
    objectPosition,
    objectFit,
    ["--illustrated-scale" as string]: String(scale),
    ["--illustrated-ken-burns-ms" as string]: `${ILLUSTRATED_MOTION.KEN_BURNS_DURATION_MS}ms`,
    ["--illustrated-ken-burns-scale" as string]: String(ILLUSTRATED_MOTION.KEN_BURNS_SCALE_TO),
    ["--illustrated-vignette" as string]: String(
      tone === "fail" ? ILLUSTRATED_MOTION.FAIL_VIGNETTE_OPACITY : ILLUSTRATED_MOTION.VIGNETTE_OPACITY,
    ),
    ["--illustrated-lighting" as string]: String(
      tone === "fail"
        ? ILLUSTRATED_MOTION.FAIL_LIGHTING_OPACITY
        : tone === "success"
          ? ILLUSTRATED_MOTION.SUCCESS_LIGHTING_OPACITY
          : ILLUSTRATED_MOTION.LIGHTING_AMBER_OPACITY,
    ),
  };
  const imgClass = kenBurns ? "illustrated-still illustrated-ken-burns" : "illustrated-still";
  return (
    <div
      className={`illustrated-stage illustrated-tone-${tone} ${className ?? ""}`}
      aria-hidden={alt === ""}
    >
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
  return (
    <IllustratedMeetStage lift={lift} screen="timing" progress={progress} lights={lights} />
  );
}

export function IllustratedMeetStage({
  lift,
  screen,
  progress,
  lights,
}: {
  lift: LiftId;
  screen: Screen;
  progress: number;
  lights: [JudgeColor, JudgeColor, JudgeColor];
}) {
  const still = screen === "bomb" ? TITLE_STILL : stillForScreen(screen, lift);
  const camera = cameraForScreen(screen, lift, progress);
  const showLights = screen !== "attempts" && screen !== "title" && screen !== "lift" && screen !== "results";
  const tone = screen === "failure" || screen === "bomb" ? "fail" : screen === "success" ? "success" : "default";
  const fit = screen === "timing" || screen === "judging" || screen === "walkout" ? "contain" : undefined;
  return (
    <div
      className="stage-wrap illustrated-timing-wrap"
      data-illustrated-file={still.file}
      data-illustrated-screen={screen}
      data-legacy-sprites="false"
    >
      <IllustratedArt
        src={still.src}
        alt=""
        objectPosition={camera.objectPosition}
        scale={camera.scale}
        kenBurns={kenBurnsForScreen(screen)}
        className="illustrated-timing-art"
        file={still.file}
        objectFit={fit}
        tone={tone}
      />
      {showLights ? (
        <div className="lights illustrated-stage-lights">
          {lights.map((color, i) => (
            <span key={`${color}-${i}`} className={`light ${color}`} />
          ))}
        </div>
      ) : null}
      <p className="illustrated-still-caption">{captionForScreen(screen, lift)}</p>
      {still.limited ? <span className="illustrated-chip">{chipForScreen(screen)}</span> : null}
    </div>
  );
}

/** Lift-select card still. Bench is the owner-revised mid-press PNG only. */
export function IllustratedLiftCardArt({ lift }: { lift: LiftId }) {
  const still = LIFT_STILLS[lift];
  return (
    <div className="illustrated-lift-still-wrap">
      <img
        src={still.src}
        alt=""
        data-illustrated-file={still.file}
        style={{ objectPosition: ILLUSTRATED_MOTION.LIFT_CARD_OBJECT_POSITION }}
      />
      {still.limited ? <span className="illustrated-chip">LIMITED</span> : null}
    </div>
  );
}
