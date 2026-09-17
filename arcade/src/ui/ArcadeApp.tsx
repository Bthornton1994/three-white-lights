import { useEffect, useRef, useState } from "react";
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
  currentWeightKg,
  initialState,
  judgingDurationMs,
  nudgeSportAttempt,
  persistFinishedMeet,
  queueInput,
  resetToTitle,
  setAttempts,
  stageLights,
  startPlay,
  startWalkout,
  stepPlay,
  walkoutDurationMs,
  type SportState,
} from "../sport/machine.ts";
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

const LIFTS: LiftId[] = ["squat", "bench", "deadlift"];

const WALKOUT_COPY: Record<LiftId, string> = {
  squat: "Walk out. Brace. Set the bar on the back.",
  bench: "Unrack. Settle the blades. Wait for the start.",
  deadlift: "Approach the bar. Set the hips. Wait for the pull.",
};

const LIFT_FACULTY: Record<LiftId, string> = {
  squat: "Brace. Controlled descent. Depth. Drive the hole. Grind. Lockout.",
  bench: "Lower under control. Pause. Press on the command. Keep tapping.",
  deadlift: "Pull. Keep pulling. Lockout. Hold until down. Early release fails.",
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
  const [state, setState] = useState<SportState>(() => initialState(null));
  const [proof, setProof] = useState<ProofQuery>({ screen: null, freeze: false, lift: null });
  const [presentMs, setPresentMs] = useState(0);
  const cardRef = useRef<HTMLElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const heldRef = useRef(false);

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
    if (proof.screen) return;
    persistFinishedMeet(state, storage());
  }, [state.screen, state.sessionStreak, state.meet, proof.screen]);

  useEffect(() => {
    if (state.screen !== "play") return;
    if (proof.freeze) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number): void => {
      const dt = Math.min(100, now - last);
      last = now;
      const next = stepPlay(stateRef.current, dt);
      if (next !== stateRef.current) {
        stateRef.current = next;
        setState(next);
      }
      if (next.screen === "play") frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [state.screen, state.currentAttempt, proof.freeze]);

  useEffect(() => {
    if (proof.freeze) {
      setPresentMs(state.presentMs);
      return;
    }
    const animated =
      state.screen === "walkout" ||
      state.screen === "play" ||
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
    const loop = (now: number): void => {
      setPresentMs(now - origin);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [state.screen, state.currentAttempt, proof.freeze, state.presentMs]);

  useEffect(() => {
    if (proof.freeze) return;
    const delay = reducedMotion() ? 80 : undefined;
    if (state.screen === "walkout") {
      const id = window.setTimeout(
        () => setState((s) => startPlay(s)),
        delay ?? walkoutDurationMs(state),
      );
      return () => window.clearTimeout(id);
    }
    if (state.screen === "judging") {
      const id = window.setTimeout(
        () => setState((s) => afterJudging(s)),
        delay ?? judgingDurationMs(state),
      );
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [state.screen, proof.freeze, state.currentAttempt]);

  useEffect(() => {
    const onDown = (event: KeyboardEvent): void => {
      if (event.code !== "Space" && event.code !== "Enter") return;
      event.preventDefault();
      if (event.repeat) return;
      if (stateRef.current.screen === "play") {
        press();
        return;
      }
      primary();
    };
    const onUp = (event: KeyboardEvent): void => {
      if (event.code !== "Space" && event.code !== "Enter") return;
      if (stateRef.current.screen === "play") {
        event.preventDefault();
        release();
      }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  });

  const lift = state.lift ?? "squat";
  const weight = currentWeightKg(state);
  const lights = stageLights(state);
  const view = state.presentation;
  const clockMs = state.screen === "play" ? state.presentMs : presentMs;
  const walkProgress =
    state.screen === "walkout" || state.screen === "transition"
      ? walkoutProgress(presentMs, walkoutDurationMs(state))
      : view
        ? view.kind === "deadlift"
          ? view.barHeight
          : view.depth
        : 0.12;

  const press = (): void => {
    if (stateRef.current.screen !== "play") return;
    if (heldRef.current) return;
    heldRef.current = true;
    haptic(FEEL.HAPTIC_MS.hit);
    const next = queueInput(stateRef.current, "press");
    stateRef.current = next;
    setState(next);
  };

  const release = (): void => {
    if (!heldRef.current) return;
    heldRef.current = false;
    if (stateRef.current.screen !== "play") return;
    const next = queueInput(stateRef.current, "release");
    stateRef.current = next;
    setState(next);
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
    state.screen === "play" ||
    state.screen === "judging" ||
    state.screen === "success" ||
    state.screen === "failure" ||
    state.screen === "transition" ||
    state.screen === "bomb";

  const commandLive = Boolean(view?.command.pressCommandLive || view?.command.lockoutHoldLive);
  const padLabel = view?.command.pressCommandLive
    ? "PRESS"
    : view?.command.lockoutHoldLive
      ? "HOLD"
      : state.prompt || "HOLD / TAP";

  return (
    <main
      className="arcade-root illustrated-edition"
      data-legacy-sprites="false"
      data-visual-shell="illustrated"
      data-sport-source={ILLUSTRATED_EDITION.MECHANICS_SHA}
      data-screen={state.screen}
      data-lift-kind={state.lift ?? ""}
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
              Each lift is a different faculty — not a different timer. Select cards stay Fable
              stills. The attempt is the A0 mechanic.
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
                    {LIFT_FACULTY[id]}
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
            weightKg={state.attemptsKg[0] ?? 25}
            e1rmKg={state.e1rmKg}
          />
          <div className="panel">
            <p className="kicker">{LIFT_FACULTY[lift]}</p>
            <h2>{LIFT_COPY[lift].name} attempts</h2>
            <p className="hint">
              Openers from e1RM. Weights may not go down. 2.5 kg plates. e1RM {state.e1rmKg} kg.
            </p>
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
                          setAttempts(s, nudgeSportAttempt(s.lift ?? lift, s.attemptsKg, i as 0 | 1 | 2, -1)),
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
                          setAttempts(s, nudgeSportAttempt(s.lift ?? lift, s.attemptsKg, i as 0 | 1 | 2, 1)),
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
        <section className="arcade-screen meet-play-screen" data-proof-screen={state.screen}>
          <IllustratedMeetStage
            lift={lift}
            screen={state.screen}
            progress={walkProgress}
            lights={lights}
            clockMs={clockMs}
            weightKg={weight}
            e1rmKg={state.e1rmKg}
            presentation={view}
          />
          <div className="panel">
            <div className="hud">
              <span>
                {LIFT_COPY[lift].name} · attempt {state.currentAttempt}
              </span>
              <strong>{weight.toFixed(1)} kg</strong>
            </div>
            {view ? (
              <p className="sport-meta" data-effort={view.effortBand}>
                {view.phase}
                {view.grindIntensity > 0.5 ? " · GRIND" : ""}
                {view.command.pressCommandLive ? " · PRESS COMMAND" : ""}
                {view.command.lockoutHoldLive ? " · HOLD LOCKOUT" : ""}
              </p>
            ) : null}

            {state.screen === "play" ? (
              <>
                <p className={`lede sport-prompt${commandLive ? " command-live" : ""}`} data-prompt={state.prompt}>
                  {state.prompt}
                </p>
                <button
                  className="btn btn-primary hold-pad"
                  type="button"
                  data-held={heldRef.current ? "true" : "false"}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    press();
                  }}
                  onPointerUp={(event) => {
                    event.preventDefault();
                    release();
                  }}
                  onPointerCancel={() => release()}
                  onPointerLeave={() => {
                    if (heldRef.current) release();
                  }}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  {padLabel}
                </button>
                <p className="hint">
                  Hold and tap — this is the lift, not a two-window timer. Fatigue stays hidden and
                  shows up in bar speed.
                </p>
              </>
            ) : null}

            {state.screen === "walkout" ? <p className="lede">{WALKOUT_COPY[lift]}</p> : null}
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
                  {state.attemptsKg[state.currentAttempt - 1]?.toFixed(1)} kg.{" "}
                  {state.feel.barSpeedText}
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
          One lift. Three attempts. Squat, bench, and deadlift are different faculties — depth,
          pause-and-press, lockout hold. Fatigue stays hidden and shows up in bar speed.
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
