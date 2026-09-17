import { useEffect, useMemo, useRef, useState } from "react";
import { FEEL, LIFT_COPY, type LiftId } from "../feel.ts";
import { ILLUSTRATED_EDITION } from "../illustrated/edition.ts";
import {
  LIFT_STILLS,
  RESULTS_BACKDROP,
  RESULTS_SHEET_ART,
  TITLE_STILL,
} from "../illustrated/assets.ts";
import { ILLUSTRATED_MOTION } from "../illustrated/motion.ts";
import { applyProofToState, readProofQuery } from "../illustrated/proof.ts";
import type { ProofQuery } from "../illustrated/proof.ts";
import {
  afterJudging,
  backToLiftSelect,
  chooseLift,
  continueAfterOutcome,
  finishTiming,
  initialState,
  persistFinishedMeet,
  recordTap,
  resetToTitle,
  setAttempts,
  startTiming,
  startWalkout,
  tickTiming,
  type ArcadeState,
} from "../loop/machine.ts";
import { cuesForLift, sequenceDurationMs } from "../loop/timing.ts";
import { nudgeAttempt } from "../math/attempts.ts";
import type { JudgeColor } from "../math/types.ts";
import { walkoutProgress } from "../sprites/sheets.ts";
import { ResultsCard } from "./ResultsCard.tsx";
import { downloadResultsCard, shareResultsCard } from "./share.ts";
import {
  IllustratedArt,
  IllustratedLiftCardArt,
  IllustratedMeetStage,
  IllustratedTitleArt,
} from "./IllustratedArt.tsx";
import { IllustratedBanner } from "./IllustratedBanner.tsx";
import { TimingLane } from "./TimingLane.tsx";

const LIFTS: LiftId[] = ["squat", "bench", "deadlift"];

const WALKOUT_COPY: Record<LiftId, string> = {
  squat: "Walk out. Brace. Set the bar on the back.",
  bench: "Unrack. Settle the blades. Wait for the start.",
  deadlift: "Approach the bar. Set the hips. Wait for the pull.",
};

function haptic(ms: number): void {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(ms);
  }
}

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function ArcadeApp() {
  const [state, setState] = useState<ArcadeState>(() => initialState(null));
  const [proof, setProof] = useState<ProofQuery>({ screen: null, freeze: false, lift: null });
  const [presentMs, setPresentMs] = useState(0);
  const started = useRef(0);
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const q = readProofQuery();
    setProof(q);
    if (q.screen) {
      setState(applyProofToState(initialState(storage()), window.location.search));
      return;
    }
    setState((s) => ({ ...s, sessionStreak: initialState(storage()).sessionStreak }));
  }, []);

  useEffect(() => {
    if (proof.screen) {
      return;
    }
    persistFinishedMeet(state, storage());
  }, [state.screen, state.sessionStreak, state.meet, proof.screen]);

  useEffect(() => {
    if (state.screen !== "timing") {
      return;
    }
    if (proof.freeze) {
      return;
    }
    started.current = performance.now();
    let frame = 0;
    const tick = (now: number): void => {
      const duration = state.lift ? sequenceDurationMs(state.lift) : 1;
      const elapsed = now - started.current;
      if (elapsed >= duration) {
        setState((s) => finishTiming(tickTiming(s, elapsed)));
        return;
      }
      setState((s) => tickTiming(s, elapsed));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [state.screen, state.lift, state.currentAttempt, proof.freeze]);

  useEffect(() => {
    if (proof.freeze) {
      setPresentMs(state.timingElapsedMs);
      return;
    }
    const animated =
      state.screen === "walkout" ||
      state.screen === "timing" ||
      state.screen === "judging" ||
      state.screen === "success" ||
      state.screen === "failure" ||
      state.screen === "transition" ||
      state.screen === "bomb";
    if (!animated) {
      setPresentMs(0);
      return;
    }
    const origin = performance.now();
    let frame = 0;
    const tick = (now: number): void => {
      setPresentMs(now - origin);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [state.screen, state.currentAttempt, proof.freeze]);

  useEffect(() => {
    if (proof.freeze) {
      return;
    }
    const delay = reducedMotion() ? 80 : undefined;
    if (state.screen === "walkout") {
      const id = window.setTimeout(
        () => setState((s) => startTiming(s)),
        delay ?? FEEL.TIMING_MS.walkout,
      );
      return () => window.clearTimeout(id);
    }
    if (state.screen === "judging") {
      const id = window.setTimeout(
        () => setState((s) => afterJudging(s)),
        delay ?? FEEL.TIMING_MS.judging,
      );
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [state.screen, proof.freeze]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.code !== "Space" && event.code !== "Enter") {
        return;
      }
      event.preventDefault();
      primary();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const lift = state.lift ?? "squat";
  const weight = state.attemptsKg[state.currentAttempt - 1] ?? FEEL.MIN_ATTEMPT_KG;
  const duration = sequenceDurationMs(lift);
  const progress =
    state.screen === "timing"
      ? Math.min(1, state.timingElapsedMs / duration)
      : state.screen === "walkout" || state.screen === "transition"
        ? walkoutProgress(presentMs, FEEL.TIMING_MS.walkout)
        : state.screen === "success" || state.screen === "judging"
          ? 1
          : state.screen === "failure" || state.screen === "bomb"
            ? 0.75
            : 0.12;
  const clockMs = state.screen === "timing" ? state.timingElapsedMs : presentMs;
  const cues = useMemo(
    () => cuesForLift(lift, state.hiddenFatigue),
    [lift, state.hiddenFatigue],
  );
  const nextCue = cues.find((_, i) => state.pendingGrades[i] === undefined);
  const lights: [JudgeColor, JudgeColor, JudgeColor] =
    state.screen === "walkout" || state.screen === "timing"
      ? ["off", "off", "off"]
      : (state.lastOutcome?.lights ?? ["off", "off", "off"]);

  const tap = (): void => {
    if (state.screen !== "timing" || !state.lift) {
      return;
    }
    const index = cues.findIndex((_, i) => state.pendingGrades[i] === undefined);
    if (index < 0) {
      return;
    }
    haptic(FEEL.HAPTIC_MS.hit);
    setState((s) => recordTap(s, index, s.timingElapsedMs));
  };

  const primary = (): void => {
    if (state.screen === "title") {
      setState(backToLiftSelect(storage()));
      return;
    }
    if (state.screen === "attempts") {
      setState((s) => startWalkout(s));
      return;
    }
    if (state.screen === "timing") {
      tap();
      return;
    }
    if (state.screen === "success" || state.screen === "failure") {
      const next = continueAfterOutcome(state);
      persistFinishedMeet(next, storage());
      setState(next);
      return;
    }
    if (state.screen === "transition") {
      setState((s) => startWalkout(s));
      return;
    }
    if (state.screen === "bomb") {
      setState((s) => ({ ...s, screen: "results" }));
      return;
    }
  };

  const meetStage =
    state.screen === "walkout" ||
    state.screen === "timing" ||
    state.screen === "judging" ||
    state.screen === "success" ||
    state.screen === "failure" ||
    state.screen === "transition" ||
    state.screen === "bomb";

  return (
    <main
      className="arcade-root illustrated-edition"
      data-legacy-sprites="false"
      data-visual-shell="illustrated"
    >
      <IllustratedBanner />
      {state.screen === "title" ? <TitleScreen onStart={primary} streak={state.sessionStreak} /> : null}

      {state.screen === "lift" ? (
        <section className="arcade-screen" data-proof-screen="lift">
          <IllustratedArt
            src={RESULTS_BACKDROP.src}
            alt=""
            objectPosition={ILLUSTRATED_MOTION.RESULTS_BACKDROP_POSITION}
            kenBurns
            file={RESULTS_BACKDROP.file}
          />
          <div className="title-veil" />
          <div className="panel">
            <p className="kicker">{FEEL.FEDERATION}</p>
            <h2>Choose a lift</h2>
            <p className="hint">
              Each lift has its own timing. Fatigue stays hidden. Select cards stay Fable stills —
              the attempt itself uses existing arcade frames.
            </p>
            <div className="lift-grid">
              {LIFTS.map((id) => (
                <button
                  key={id}
                  className="lift-card illustrated-lift-card"
                  type="button"
                  onClick={() => setState((s) => chooseLift(s, id))}
                >
                  <IllustratedLiftCardArt lift={id} />
                  <span>
                    <b>{LIFT_COPY[id].name}</b>
                    {LIFT_COPY[id].cue}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {state.screen === "attempts" ? (
        <section className="arcade-screen" data-proof-screen="attempts" data-illustrated-file={LIFT_STILLS[lift].file}>
          <IllustratedMeetStage
            lift={lift}
            screen="attempts"
            progress={0.08}
            lights={["off", "off", "off"]}
            weightKg={state.attemptsKg[0] ?? 20}
            e1rmKg={state.e1rmKg}
          />
          <div className="panel">
            <p className="kicker">{LIFT_COPY[lift].checks}</p>
            <h2>{LIFT_COPY[lift].name} attempts</h2>
            <p className="hint">Weights may not go down. 2.5 kg plates. e1RM {state.e1rmKg} kg.</p>
            <div className="attempt-list">
              {state.attemptsKg.map((kg, i) => (
                <div className="attempt-row" key={i}>
                  <em>A{i + 1}</em>
                  <strong className="weight">{kg.toFixed(1)}</strong>
                  <div className="stepper">
                    <button
                      type="button"
                      aria-label={`Lower attempt ${i + 1}`}
                      onClick={() =>
                        setState((s) =>
                          setAttempts(s, nudgeAttempt(s.attemptsKg, i as 0 | 1 | 2, -1)),
                        )
                      }
                    >
                      −
                    </button>
                    <button
                      type="button"
                      aria-label={`Raise attempt ${i + 1}`}
                      onClick={() =>
                        setState((s) =>
                          setAttempts(s, nudgeAttempt(s.attemptsKg, i as 0 | 1 | 2, 1)),
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" type="button" onClick={primary}>
              Load the bar
            </button>
          </div>
        </section>
      ) : null}

      {meetStage ? (
        <section className="arcade-screen" data-proof-screen={state.screen}>
          <IllustratedMeetStage
            lift={lift}
            screen={state.screen}
            progress={progress}
            lights={lights}
            clockMs={clockMs}
            weightKg={weight}
            e1rmKg={state.e1rmKg}
          />
          <div className="panel">
            <div className="hud">
              <span>
                {LIFT_COPY[lift].name} · attempt {state.currentAttempt}
              </span>
              <strong>{weight.toFixed(1)} kg</strong>
            </div>

            {state.screen === "timing" ? (
              <>
                <TimingLane cues={cues} progress={progress} durationMs={duration} />
                <button className="btn btn-primary" type="button" onClick={tap}>
                  {nextCue?.label ?? "HOLD"}
                </button>
                <p className="hint">Tap in the amber window. Fatigue is not a bar — it shrinks that window.</p>
              </>
            ) : null}

            {state.screen === "walkout" ? (
              <p className="lede">{WALKOUT_COPY[lift]}</p>
            ) : null}
            {state.screen === "judging" ? <p className="lede">Judges deliberating.</p> : null}

            {state.screen === "success" ? (
              <>
                <h2>Good lift</h2>
                <p className="lede">{state.lastOutcome?.cue}</p>
                <p className="hint">Implied RPE {state.lastOutcome?.impliedRpe.toFixed(1)}</p>
                <button className="btn btn-primary" type="button" onClick={primary}>
                  {state.currentAttempt === 3 ? "See the card" : "Next attempt"}
                </button>
              </>
            ) : null}

            {state.screen === "failure" ? (
              <>
                <h2>No lift</h2>
                <p className="lede">{state.lastOutcome?.cue}</p>
                <button className="btn btn-primary" type="button" onClick={primary}>
                  Continue
                </button>
              </>
            ) : null}

            {state.screen === "transition" ? (
              <>
                <h2>Change plates</h2>
                <p className="lede">
                  Attempt {state.currentAttempt} is{" "}
                  {state.attemptsKg[state.currentAttempt - 1]?.toFixed(1)} kg. The next window is{" "}
                  {state.hiddenFatigue > 0.3 ? "tighter" : "still honest"}.
                </p>
                <button className="btn btn-primary" type="button" onClick={primary}>
                  Walk out
                </button>
              </>
            ) : null}

            {state.screen === "bomb" ? (
              <>
                <h2>Bomb-out</h2>
                <p className="lede">
                  Three misses. The total is zero. That is the sport — somber, not a joke game-over.
                </p>
                <button className="btn btn-primary" type="button" onClick={primary}>
                  Open the card
                </button>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      {state.screen === "results" && state.meet ? (
        <section className="arcade-screen" data-proof-screen="results">
          <IllustratedArt
            src={RESULTS_BACKDROP.src}
            alt=""
            objectPosition={ILLUSTRATED_MOTION.RESULTS_BACKDROP_POSITION}
            kenBurns
            file={RESULTS_BACKDROP.file}
          />
          <div className="title-veil" />
          <div className="panel illustrated-results-panel">
            <p className="kicker">{FEEL.FEDERATION}</p>
            <h2>{state.meet.bombed ? "No total" : "Three white lights"}</h2>
            <div className="score-row">
              <div>
                <span>Weight</span>
                <b>{state.meet.breakdown.weight}</b>
              </div>
              <div>
                <span>Execution</span>
                <b>{state.meet.breakdown.execution}</b>
              </div>
              <div>
                <span>Streak</span>
                <b>{state.meet.breakdown.streak}</b>
              </div>
              <div>
                <span>Total</span>
                <b>{state.meet.breakdown.total}</b>
              </div>
            </div>
            <div className="illustrated-results-wrap">
              <div className="illustrated-results-portrait">
                <img src={RESULTS_SHEET_ART.src} alt="" data-illustrated-file={RESULTS_SHEET_ART.file} />
                <span className="illustrated-chip">LIMITED — no dedicated results-card art</span>
              </div>
              <ResultsCard meet={state.meet} ref={cardRef} />
            </div>
            <div className="stack results-actions">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => {
                  void shareResultsCard(state.meet!);
                }}
              >
                Share card
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => {
                  void downloadResultsCard(state.meet!);
                }}
              >
                Download PNG
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setState(resetToTitle(storage()))}
              >
                Another lift
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function TitleScreen({ onStart, streak }: { onStart: () => void; streak: number }) {
  return (
    <section className="arcade-screen" data-proof-screen="title">
      <IllustratedTitleArt />
      <div className="title-veil" />
      {TITLE_STILL.limited ? (
        <span className="illustrated-chip illustrated-chip-title">LIMITED — landscape still, letterboxed on phone</span>
      ) : null}
      <div className="title-copy">
        <p className="kicker">{FEEL.FEDERATION}</p>
        <h1>Three White Lights</h1>
        <p className="illustrated-edition-name">{ILLUSTRATED_EDITION.NAME}</p>
        <p className="lede">
          One lift. Three attempts. Timing is the sport. Fatigue stays hidden and shows up in bar
          speed.
        </p>
        <div className="lights" aria-hidden="true">
          <span className="light white" />
          <span className="light white" />
          <span className="light white" />
        </div>
        {streak > 0 ? <p className="hint">Arcade streak {streak}</p> : null}
        <button className="btn btn-primary" type="button" onClick={onStart}>
          Step onto the platform
        </button>
      </div>
    </section>
  );
}