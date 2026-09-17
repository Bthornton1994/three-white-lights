import type { CSSProperties } from "react";
import type { LiftId } from "../feel.ts";
import type { Screen } from "../loop/machine.ts";
import type { LiftPresentationState } from "../game/liftPresentation.ts";
import {
  LIFT_STILLS,
  TITLE_STILL,
  cameraForScreen,
  captionForScreen,
  chipForScreen,
  kenBurnsForScreen,
  stillForScreen,
  usesArcadeFrames,
} from "../illustrated/assets.ts";
import { ILLUSTRATED_MOTION } from "../illustrated/motion.ts";
import type { JudgeColor } from "../math/types.ts";
import { SCENE, frameSrcFor, poseForScreen, squatDepth01, squatDepthPhase, visualEffort } from "../sprites/sheets.ts";
import type { SquatDepthPhase } from "../sprites/sheets.ts";
import {
  frameSrcFromPresentation,
  poseFromPresentation,
  squatDepthFromView,
  squatDepthPhaseFromView,
} from "../sport/frames.ts";

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
    <IllustratedMeetStage lift={lift} screen="play" progress={progress} lights={lights} />
  );
}

export function IllustratedMeetStage({
  lift,
  screen,
  progress,
  lights,
  clockMs = 0,
  weightKg = 20,
  e1rmKg = 180,
  presentation = null,
}: {
  lift: LiftId;
  screen: Screen;
  progress: number;
  lights: [JudgeColor, JudgeColor, JudgeColor];
  clockMs?: number;
  weightKg?: number;
  e1rmKg?: number;
  presentation?: LiftPresentationState | null;
}) {
  const still = screen === "bomb" ? TITLE_STILL : stillForScreen(screen, lift);
  const camera = cameraForScreen(screen, lift, progress);
  const showLights = screen !== "attempts" && screen !== "title" && screen !== "lift" && screen !== "results";
  const tone = screen === "failure" || screen === "bomb" ? "fail" : screen === "success" ? "success" : "default";
  const fit = screen === "timing" || screen === "play" || screen === "judging" || screen === "walkout" ? "contain" : undefined;
  const animated = usesArcadeFrames(screen);
  const effort = visualEffort(weightKg, e1rmKg);
  const live = presentation !== null && (screen === "play" || screen === "judging");
  const athleteSrc = animated
    ? live
      ? frameSrcFromPresentation(lift, screen, presentation, clockMs, effort)
      : frameSrcFor(lift, screen, progress, clockMs, effort)
    : null;
  const pose = live ? poseFromPresentation(presentation, screen) : poseForScreen(screen, lift, progress);
  const frameName = athleteSrc ? athleteSrc.split("/").pop() ?? athleteSrc : "";
  const showDepthGauge =
    lift === "squat" &&
    animated &&
    (screen === "walkout" || screen === "timing" || screen === "play" || screen === "judging");
  const depth01 = showDepthGauge
    ? live
      ? squatDepthFromView(presentation)
      : squatDepth01(screen, progress)
    : 0;
  const depthPhase: SquatDepthPhase = showDepthGauge
    ? live
      ? squatDepthPhaseFromView(presentation, screen)
      : squatDepthPhase(screen, progress)
    : "stand";
  const strain = presentation?.strain ?? 0;
  const grind = presentation?.grindIntensity ?? 0;
  return (
    <div
      className={`stage-wrap illustrated-timing-wrap${animated ? " illustrated-animated-stage" : ""}`}
      data-illustrated-file={still.file}
      data-illustrated-screen={screen}
      data-legacy-sprites="false"
      data-anim-runtime={animated ? "sprite-frames" : "still"}
      data-anim-lift={lift}
      data-anim-src={athleteSrc ?? ""}
      data-anim-frame={frameName}
      data-anim-pose={pose}
      data-anim-effort={effort}
      data-squat-depth={showDepthGauge ? depth01.toFixed(3) : ""}
      data-squat-depth-phase={showDepthGauge ? depthPhase : ""}
      data-lift-phase={presentation?.phase ?? ""}
      data-bar-height={presentation ? presentation.barHeight.toFixed(3) : ""}
      data-lift-depth={presentation ? presentation.depth.toFixed(3) : ""}
      data-strain={presentation ? strain.toFixed(3) : ""}
      data-grind={presentation ? grind.toFixed(3) : ""}
      data-outcome={presentation?.outcome ?? ""}
      data-command-press={presentation?.command.pressCommandLive ? "true" : "false"}
      data-command-lockout={presentation?.command.lockoutHoldLive ? "true" : "false"}
      data-sport-source="288db32c"
      style={{
        ["--strain" as string]: String(strain),
        ["--grind" as string]: String(grind),
      }}
    >
      {animated ? (
        <>
          <img className="stage-bg" src={SCENE.platform} alt="" />
          <div className="stage-slot">
            <img
              className="stage-lifter illustrated-athlete"
              src={athleteSrc ?? ""}
              alt=""
              data-anim-frame={frameName}
            />
            {showDepthGauge ? <SquatDepthGauge depth={depth01} phase={depthPhase} /> : null}
          </div>
          <div className={`illustrated-stage illustrated-tone-${tone}`} aria-hidden="true">
            <div className="illustrated-lighting" />
            <div className="illustrated-vignette" />
          </div>
        </>
      ) : (
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
      )}
      {showLights ? (
        <div className="lights illustrated-stage-lights">
          {lights.map((color, i) => (
            <span key={`${color}-${i}`} className={`light ${color}`} />
          ))}
        </div>
      ) : null}
      <p className="illustrated-still-caption">{captionForScreen(screen, lift)}</p>
      <span className="illustrated-chip">{chipForScreen(screen)}</span>
    </div>
  );
}

/** Compact squat depth gauge. Lives in the stage slot, beside the lifter. */
function SquatDepthGauge({ depth, phase }: { depth: number; phase: SquatDepthPhase }) {
  const clamped = Math.min(1, Math.max(0, depth));
  return (
    <div
      className="squat-depth-gauge"
      aria-hidden="true"
      data-squat-depth-phase={phase}
      data-squat-depth={clamped.toFixed(3)}
    >
      <span className="squat-depth-gauge-label">DEPTH</span>
      <div className="squat-depth-body">
        <div className="squat-depth-legend">
          <span className="squat-depth-tick squat-depth-tick-stand">Stand</span>
          <span className="squat-depth-tick squat-depth-tick-down">Drop</span>
          <span className="squat-depth-tick squat-depth-tick-ascent">Drive</span>
          <span className="squat-depth-target">Legal</span>
        </div>
        <div className="squat-depth-track">
          <span className="squat-depth-band" />
          <span
            className="squat-depth-marker"
            style={{ ["--squat-depth" as string]: String(clamped) }}
            data-squat-depth-marker="true"
          />
        </div>
      </div>
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
