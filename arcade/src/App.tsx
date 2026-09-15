import { useEffect, useMemo, useRef, useState } from "react";
import { FEEL, type LiftId } from "./feel";
import {
  afterJudging,
  backToLiftSelect,
  chooseLift,
  continueAfterOutcome,
  finishTiming,
  initialState,
  openResults,
  recordTap,
  resetToTitle,
  setAttempts,
  startTiming,
  startWalkout,
  type ArcadeState,
} from "./loop/machine";
import { cuesForLift, sequenceDurationMs } from "./loop/timing";
import { nudgeAttempt } from "./math/attempts";
import { ResultsCard } from "./ui/ResultsCard";
import { shareResultsCard } from "./ui/share";
import { SpriteStage } from "./ui/SpriteStage";
import { TimingLane } from "./ui/TimingLane";

const LIFTS: LiftId[] = ["squat", "bench", "deadlift"];

function haptic(ms: number): void {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(ms);
  }
}

export function App() {
  const [state, setState] = useState<ArcadeState>(initialState);
  const [clock, setClock] = useState(0);
  const started = useRef(0);
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (state.screen !== "timing") {
      return;
    }
    started.current = performance.now();
    let frame = 0;
    const tick = (now: number): void => {
      const duration = state.lift ? sequenceDurationMs(state.lift) : 1;
      const elapsed = now - started.current;
      setClock(elapsed);
      if (elapsed >= duration) {
        setState((s) => finishTiming(s));
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [state.screen, state.lift, state.currentAttempt]);

  useEffect(() => {
    if (state.screen === "walkout") {
      const id = window.setTimeout(() => setState((s) => startTiming(s)), FEEL.TIMING_MS.walkout);
      return () => window.clearTimeout(id);
    }
    if (state.screen === "judging") {
      const id = window.setTimeout(() => setState((s) => afterJudging(s)), FEEL.TIMING_MS.judging);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [state.screen]);

  const lift = state.lift ?? "squat";
  const weight = state.attemptsKg[state.currentAttempt - 1] ?? FEEL.MIN_ATTEMPT_KG;
  const duration = sequenceDurationMs(lift);
  const progress = state.screen === "timing" ? Math.min(1, clock / duration) : state.screen === "success" ? 1 : 0.15;
  const cues = useMemo(() => cuesForLift(lift, state.hiddenFatigue), [lift, state.hiddenFatigue]);
  const activeIndex = cues.findIndex((cue) => progress < cue.center + 0.12);
  const lights = state.lastOutcome?.lights ?? ["off", "off", "off"];

  const tap = (): void => {
    if (state.screen !== "timing" || !state.lift) {
      return;
    }
    const index = cues.findIndex((_, i) => state.pendingGrades[i] === undefined);
    if (index < 0) {
      return;
    }
    haptic(FEEL.HAPTIC_MS.hit);
    setState((s) => recordTap(s, index, clock));
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.code === "Space" || event.key === "Enter") {
        event.preventDefault();
        tap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <main className="app">
      <header className="mast">
        <span className="kicker">{FEEL.FEDERATION}</span>
        <h1>{FEEL.TITLE}</h1>
      </header>

      {state.screen === "title" ? (
        <section className="panel">
          <p className="lede">
            One lift. Three attempts. Timing is the sport. Fatigue stays hidden and
            shows up in bar speed and a tighter window.
          </p>
          <SpriteStage
            lift="squat"
            progress={0.2}
            weightKg={180}
            e1rmKg={180}
            screen="title"
          />
          <button className="primary" type="button" onClick={() => setState(backToLiftSelect())}>
            Step on the platform
          </button>
        </section>
      ) : null}

      {state.screen === "lift" ? (
        <section className="panel">
          <h2>Choose a lift</h2>
          <div className="row">
            {LIFTS.map((id) => (
              <button key={id} className="lift" type="button" onClick={() => setState(chooseLift(state, id))}>
                {id}
              </button>
            ))}
          </div>
          <div className="col">
            {LIFTS.map((id) => (
              <SpriteStage
                key={id}
                lift={id}
                progress={id === "deadlift" ? 0.9 : 0.5}
                weightKg={FEEL.DEFAULT_E1RM_KG[id]}
                e1rmKg={FEEL.DEFAULT_E1RM_KG[id]}
                screen="timing"
              />
            ))}
          </div>
        </section>
      ) : null}

      {state.screen === "attempts" ? (
        <section className="panel">
          <h2>{lift} attempts</h2>
          <p className="hint">Weights may not go down. 2.5 kg plates. e1RM {state.e1rmKg} kg.</p>
          {state.attemptsKg.map((kg, i) => (
            <div className="attempt-card" key={i}>
              <span>A{i + 1}</span>
              <strong className="weight">{kg.toFixed(1)}</strong>
              <div className="row">
                <button
                  className="step"
                  type="button"
                  aria-label={`Lower attempt ${i + 1}`}
                  onClick={() =>
                    setState(setAttempts(state, nudgeAttempt(state.attemptsKg, i as 0 | 1 | 2, -1)))
                  }
                >
                  −
                </button>
                <button
                  className="step"
                  type="button"
                  aria-label={`Raise attempt ${i + 1}`}
                  onClick={() =>
                    setState(setAttempts(state, nudgeAttempt(state.attemptsKg, i as 0 | 1 | 2, 1)))
                  }
                >
                  +
                </button>
              </div>
            </div>
          ))}
          <SpriteStage lift={lift} progress={0.1} weightKg={state.attemptsKg[0] ?? 20} e1rmKg={state.e1rmKg} screen="attempts" />
          <button className="primary" type="button" onClick={() => setState(startWalkout(state))}>
            Load the first attempt
          </button>
        </section>
      ) : null}

      {state.screen === "walkout" ||
      state.screen === "timing" ||
      state.screen === "judging" ||
      state.screen === "success" ||
      state.screen === "failure" ||
      state.screen === "transition" ||
      state.screen === "bomb" ? (
        <section className="panel">
          <div className="hud">
            <span>
              {lift} · attempt {state.currentAttempt}
            </span>
            <span>{weight.toFixed(1)} kg</span>
          </div>
          <SpriteStage
            lift={lift}
            progress={progress}
            weightKg={weight}
            e1rmKg={state.e1rmKg}
            screen={state.screen}
            lights={state.screen === "walkout" || state.screen === "timing" ? ["off", "off", "off"] : lights}
          />
          <div className="lights" aria-label="Judge lights">
            {(state.screen === "walkout" || state.screen === "timing" ? ["off", "off", "off"] : lights).map(
              (color, i) => (
                <span key={i} className={color}>
                  {color === "white" ? "W" : color === "red" ? "R" : "·"}
                </span>
              ),
            )}
          </div>

          {state.screen === "timing" ? (
            <>
              <TimingLane
                cues={cues}
                progress={progress}
                activeIndex={activeIndex < 0 ? cues.length : activeIndex}
              />
              <button className="primary" type="button" onClick={tap}>
                {cues[state.pendingGrades.length]?.label ?? "HOLD"}
              </button>
              <p className="hint">Tap in the amber window. Fatigue is not a bar — it shrinks that window.</p>
            </>
          ) : null}

          {state.screen === "walkout" ? <p className="lede">Walkout. Set the back. Wait for the cue.</p> : null}
          {state.screen === "judging" ? <p className="lede">Judges deliberating.</p> : null}
          {state.screen === "success" ? (
            <>
              <h2>Good lift</h2>
              <p className="lede">{state.lastOutcome?.cue}</p>
              <p className="hint">Implied RPE {state.lastOutcome?.impliedRpe.toFixed(1)}</p>
              <button className="primary" type="button" onClick={() => setState(continueAfterOutcome(state))}>
                {state.currentAttempt === 3 ? "See the card" : "Next attempt"}
              </button>
            </>
          ) : null}
          {state.screen === "failure" ? (
            <>
              <h2>No lift</h2>
              <p className="lede">{state.lastOutcome?.cue}</p>
              <button className="primary" type="button" onClick={() => setState(continueAfterOutcome(state))}>
                Continue
              </button>
            </>
          ) : null}
          {state.screen === "transition" ? (
            <>
              <h2>Change plates</h2>
              <p className="lede">
                Attempt {state.currentAttempt} is {state.attemptsKg[state.currentAttempt - 1]?.toFixed(1)} kg.
                The next window is {state.hiddenFatigue > 0.3 ? "tighter" : "still honest"}.
              </p>
              <button className="primary" type="button" onClick={() => setState(startWalkout(state))}>
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
              <button className="primary" type="button" onClick={() => setState(openResults(state))}>
                Open the card
              </button>
            </>
          ) : null}
        </section>
      ) : null}

      {state.screen === "results" && state.meet ? (
        <section className="panel">
          <ResultsCard meet={state.meet} ref={cardRef} />
          <p className="hint">Arcade skill {state.meet.score}. Not a federation total.</p>
          <button
            className="primary"
            type="button"
            onClick={() => {
              if (cardRef.current) {
                void shareResultsCard(cardRef.current, "iron-amber-arcade-card.png");
              }
            }}
          >
            Share card
          </button>
          <button className="ghost" type="button" onClick={() => setState(resetToTitle())}>
            Another lift
          </button>
        </section>
      ) : null}
    </main>
  );
}
