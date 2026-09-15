import { useEffect, useMemo, useRef, useState } from "react";
import { FEEL, LIFT_COPY, type LiftId } from "../feel.ts";
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
import { LIFT_SHEETS, SCENE } from "../sprites/sheets.ts";
import { ResultsCard } from "./ResultsCard.tsx";
import { shareResultsCard } from "./share.ts";
import { SpriteStage } from "./SpriteStage.tsx";
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
  const started = useRef(0);
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setState((s) => ({ ...s, sessionStreak: initialState(storage()).sessionStreak }));
  }, []);

  useEffect(() => {
    persistFinishedMeet(state, storage());
  }, [state.screen, state.sessionStreak, state.meet]);

  useEffect(() => {
    if (state.screen !== "timing") {
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
  }, [state.screen, state.lift, state.currentAttempt]);

  useEffect(() => {
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
  }, [state.screen]);

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
      : state.screen === "success" || state.screen === "judging"
        ? 1
        : state.screen === "failure" || state.screen === "bomb"
          ? 0.75
          : 0.12;
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

  return (
    <main className="arcade-root">
      {state.screen === "title" ? <TitleScreen onStart={primary} streak={state.sessionStreak} /> : null}

      {state.screen === "lift" ? (
        <section className="arcade-screen">
          <img className="title-art" src={SCENE.platform} alt="" />
          <div className="title-veil" />
          <div className="panel">
            <p className="kicker">{FEEL.FEDERATION}</p>
            <h2>Choose a lift</h2>
            <p className="hint">Each lift has its own timing. Fatigue stays hidden.</p>
            <div className="lift-grid">
              {LIFTS.map((id) => (
                <button
                  key={id}
                  className="lift-card"
                  type="button"
                  onClick={() => setState((s) => chooseLift(s, id))}
                >
                  <img src={LIFT_SHEETS[id].frames[id === "deadlift" ? 0 : 2]} alt="" />
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
        <section className="arcade-screen">
          <SpriteStage
            lift={lift}
            screen={state.screen}
            progress={0.08}
            clockMs={0}
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

      {state.screen === "walkout" ||
      state.screen === "timing" ||
      state.screen === "judging" ||
      state.screen === "success" ||
      state.screen === "failure" ||
      state.screen === "transition" ||
      state.screen === "bomb" ? (
        <section className="arcade-screen">
          <SpriteStage
            lift={lift}
            screen={state.screen}
            progress={progress}
            clockMs={state.timingElapsedMs}
            lights={lights}
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
        <section className="arcade-screen">
          <img className="title-art" src={SCENE.platform} alt="" />
          <div className="title-veil" />
          <div className="panel">
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
            <ResultsCard meet={state.meet} ref={cardRef} />
            <div className="stack">
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
    <section className="arcade-screen">
      <img className="title-art" src={SCENE.title} alt="" />
      <div className="title-veil" />
      <div className="title-copy">
        <p className="kicker">{FEEL.FEDERATION}</p>
        <h1>Three White Lights</h1>
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
