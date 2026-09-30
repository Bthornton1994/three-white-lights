import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  checkInProgress,
  completeCheckIn,
  defaultRpeChoice,
  currentSetNumber,
  executionQualityFrom,
  plannedTemplateFor,
  prescribeSession,
  workSetsForToday,
  repConfigFor,
  type CheckInTap,
  type PartialCheckIn,
  type SessionState,
} from '../../src/game/session';
import { closeOutReadings, receiveSnapshot, type SessionServerPort } from '../../src/game/sessionClient';
import { readBestE1rmKg, readingValue, type ProgressionCache } from '../../src/game/progression';
import { repsInReserve } from '../../src/game/rpe';
import { SESSION_COPY, SESSION_TUNING, type CheckInQuestion } from '../../src/game/sessionTuning';
import type { LiftKind } from '../../src/game/meet';
import type { LiftResolution } from '../../src/game/lift';
import type { LiftEvidence, LiftEvidencePort } from '../../src/production/liftEvidence';
import type { LocalAppServerPort } from '../../src/session/localSessionServer';
import { useSession } from '../../src/session/useSession';
import { LiftPlayer } from './LiftPlayer';

export interface TrainingProps {
  readonly port: LocalAppServerPort & Partial<LiftEvidencePort>;
  readonly onExit: () => void;
  readonly onSaved: () => void;
  readonly practice?: boolean;
}

interface ReadinessRow {
  readonly question: CheckInQuestion;
  readonly options: readonly { value: string; label: string; tap: CheckInTap }[];
}

const READINESS_ROWS: readonly ReadinessRow[] = [
  { question: 'sleep', options: (['poor', 'ok', 'good'] as const).map((answer) => ({ value: answer, label: SESSION_COPY.CHECK_IN_ANSWER.sleep[answer], tap: { question: 'sleep', answer } })) },
  { question: 'soreness', options: (['sore', 'normal', 'fresh'] as const).map((answer) => ({ value: answer, label: SESSION_COPY.CHECK_IN_ANSWER.soreness[answer], tap: { question: 'soreness', answer } })) },
  { question: 'motivation', options: (['flat', 'steady', 'fired-up'] as const).map((answer) => ({ value: answer, label: SESSION_COPY.CHECK_IN_ANSWER.motivation[answer], tap: { question: 'motivation', answer } })) },
];

const ROOM_FOR_LIFT: Readonly<Record<LiftKind, string>> = {
  squat: '/rooms/squat-brace.jpg',
  bench: '/rooms/bench-brace.jpg',
  deadlift: '/rooms/deadlift-floor.jpg',
};

function ReadinessQuestions({ answers, onTap }: { readonly answers: PartialCheckIn; readonly onTap: (tap: CheckInTap) => void }) {
  return <div className="training-readiness">
    {READINESS_ROWS.map((row) => <fieldset className="training-readiness-row" key={row.question}>
      <legend>{SESSION_COPY.CHECK_IN_QUESTION[row.question]}</legend>
      <div className="training-readiness-options">
        {row.options.map((option) => <button
          type="button"
          className={`training-chip${answers[row.question] === option.value ? ' training-chip--selected' : ''}`}
          key={option.value}
          aria-pressed={answers[row.question] === option.value}
          onClick={() => onTap(option.tap)}
          data-testid={`check-in-${row.question}-${option.value}`}
        >{option.label}</button>)}
      </div>
    </fieldset>)}
  </div>;
}

function TrainingSet({ state, onResolved }: { readonly state: SessionState; readonly onResolved: (resolution: LiftResolution, evidence: LiftEvidence) => void }) {
  const config = useMemo(() => repConfigFor(state), [state.plan, state.setIndex, state.repIndex]);
  const plan = state.plan;
  if (plan === null) return null;
  return <div className="training-live">
    <div className="training-set-hud">
      <span className="training-set-number">Set {currentSetNumber(state)} <span>/ {plan.workSets}</span></span>
      <span className="training-set-load">{plan.weightKg} <span>kg</span></span>
      <div className="training-rep-progress" aria-label={`Rep ${state.repIndex + 1} of ${plan.repsPerSet}`}>
        {Array.from({ length: plan.repsPerSet }, (_, index) => <span
          key={index}
          className={`training-rep-pip${index < state.repIndex ? ' training-rep-pip--done' : index === state.repIndex ? ' training-rep-pip--live' : ''}`}
          aria-hidden="true"
        >{index < state.repIndex ? '✓' : index + 1}</span>)}
      </div>
      <span className="training-set-rpe">RPE {plan.targetRpe}</span>
    </div>
    <LiftPlayer config={config} onResolved={onResolved} />
  </div>;
}

export function Training({ port, onExit, onSaved, practice = false }: TrainingProps) {
  const [selectedRpe, setSelectedRpe] = useState(defaultRpeChoice);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [recoveredCache, setRecoveredCache] = useState<ProgressionCache | null>(null);
  const lastSubmission = useRef<Parameters<SessionServerPort['recordTrainingSession']> | null>(null);
  const savedNotice = useRef(false);
  const savedCallback = useRef(onSaved);
  savedCallback.current = onSaved;

  const sessionPort = useMemo<SessionServerPort>(() => ({
    openingSnapshot: () => port.openingSnapshot(),
    sessionBrief: (day, lift) => port.sessionBrief(day, lift),
    recordTrainingSession: async (...args) => {
      lastSubmission.current = args;
      setSaveError(null);
      try {
        const response = await port.recordTrainingSession(...args);
        if (response.kind === 'refused') setSaveError(response.message);
        return response;
      } catch {
        const message = 'Your session has not been confirmed. Reconnect and retry saving.';
        setSaveError(message);
        return { kind: 'refused', message };
      }
    },
  }), [port]);
  useEffect(() => { port.resetTrainingEvidence?.(); }, [port]);
  const loop = useSession(undefined, sessionPort, port.currentServerDay);
  const { state, dispatch } = loop;
  const cache = recoveredCache ?? loop.cache;
  const readings = state.closeOut === null ? null : closeOutReadings(cache, state.closeOut);
  const saved = cache.status === 'confirmed' && (loop.alreadyTrainedToday || recoveredCache !== null);

  useEffect(() => {
    if (state.phase !== 'close-out' || state.closeOut?.canPropose !== true || !saved || savedNotice.current) return;
    savedNotice.current = true;
    savedCallback.current();
  }, [saved, state.phase, state.closeOut]);

  const onResolved = useCallback((resolution: LiftResolution, evidence: LiftEvidence) => {
    port.setTrainingLiftEvidence?.(state.setIndex, state.repIndex, evidence);
    dispatch({ kind: 'rep-resolved', outcome: resolution.outcome, executionQuality: executionQualityFrom(resolution) });
  }, [dispatch, port, state.setIndex, state.repIndex]);

  function startSession() {
    const checkIn = completeCheckIn(state.answers);
    if (state.phase !== 'briefing' || !loop.ladderReady || checkIn === null) return;
    port.setTrainingEvidenceContext?.({ checkIn, targetRpe: selectedRpe });
    dispatch({ kind: 'choose-rpe', rpe: selectedRpe });
  }

  function retrySession() {
    port.resetTrainingEvidence?.();
    lastSubmission.current = null;
    savedNotice.current = false;
    setSaveError(null);
    setRecoveredCache(null);
    const lower = SESSION_TUNING.RPE_CHOICES.filter((rpe) => rpe < selectedRpe).at(-1);
    if (lower !== undefined) setSelectedRpe(lower);
    dispatch({ kind: 'retry' });
  }

  async function retrySave() {
    const submission = lastSubmission.current;
    if (submission === null || retrying) return;
    setRetrying(true);
    setSaveError(null);
    try {
      const response = await port.recordTrainingSession(...submission);
      if (response.kind === 'snapshot') {
        setRecoveredCache(receiveSnapshot(loop.cache, response.wire));
      } else {
        setSaveError(response.message);
      }
    } catch {
      setSaveError('Still unable to confirm this session. Reconnect and retry.');
    } finally {
      setRetrying(false);
    }
  }

  const lift = state.context.lift;
  const template = plannedTemplateFor(state);
  const preview = state.readiness === null ? null : prescribeSession(
    state.context.e1rmKg, lift, selectedRpe, state.readiness,
    workSetsForToday(state.context, selectedRpe), template.repsPerSet,
  );
  const canLowerTarget = SESSION_TUNING.RPE_CHOICES.some((rpe) => rpe < selectedRpe);
  const best = readingValue(readBestE1rmKg(loop.cache, lift));
  const alreadyTrained = loop.alreadyTrainedToday && state.phase === 'check-in';
  const closeOut = state.closeOut;
  const payoff = readings?.payoff;
  const isPr = payoff?.kind === 'e1rm' && payoff.isPr && saved;
  const pending = state.phase === 'close-out' && closeOut?.canPropose === true && !saved && (cache.status === 'pending' || retrying);
  const room = state.phase === 'set' ? '/rooms/gym-floor.png' : state.phase === 'briefing' ? ROOM_FOR_LIFT[lift] : '/rooms/gym-briefing.jpg';

  return <section className={`training-screen training-screen--${state.phase}${alreadyTrained ? ' training-screen--trained' : ''}`} data-testid="training-screen" data-phase={state.phase}>
    <div className="training-room" aria-hidden="true"><img src={room} alt="" /></div>
    <div className="training-room-shade" aria-hidden="true" />
    <header className="training-topbar">
      <button type="button" className="training-back" onClick={onExit} aria-label="Return to the gym">← <span>Gym</span></button>
      <div className="training-location"><span>IRON & AMBER</span><span>{practice ? 'PRACTICE FLOOR' : 'TRAINING FLOOR'}</span></div>
      <span className="training-mode">{practice ? 'PRACTICE' : 'DAILY SESSION'}</span>
    </header>

    {practice ? <p className="training-practice-note">Practice session · Progress stays in this practice lifter.</p> : null}

    {alreadyTrained ? <div className="training-bookend">
      <div className="training-drawer training-drawer--bookend">
        <span className="training-eyebrow">TODAY’S WORK IS IN</span>
        <h1>Session logged.</h1>
        <p>You’ve trained today. Return tomorrow for your next session, or take your lifter to the platform.</p>
        <button type="button" className="training-primary" onClick={onExit}>Back to the gym <span aria-hidden="true">↗</span></button>
      </div>
    </div> : null}

    {!alreadyTrained && state.phase === 'check-in' ? <div className="training-checkin-layout">
      <div className="training-scene-heading"><span className="training-eyebrow">THE WORK STARTS HERE</span><h1>{SESSION_COPY.LIFT_LABEL[lift]} DAY<span className="training-title-dot">.</span></h1></div>
      <div className="training-drawer training-drawer--checkin">
        <div className="training-drawer-heading"><div><span className="training-eyebrow">READINESS CHECK-IN</span><h2>How are you today?</h2></div><span className="training-checkin-count">{checkInProgress(state.answers)} / {READINESS_ROWS.length}</span></div>
        <div className="training-lift-choice" aria-label="Choose today's lift">
          {SESSION_TUNING.LIFT_ROTATION.map((option) => <button type="button" key={option} className={`training-lift-chip${option === lift ? ' training-lift-chip--selected' : ''}`} aria-pressed={option === lift} onClick={() => loop.chooseLift(option)} data-testid={`check-in-lift-${option}`}>{SESSION_COPY.LIFT_LABEL[option]}</button>)}
        </div>
        <ReadinessQuestions answers={state.answers} onTap={(tap) => dispatch({ kind: 'check-in-tap', tap })} />
        <div className="training-checkin-footer"><span>{best == null ? 'First session on this lift' : `Best ${best.toFixed(SESSION_TUNING.E1RM_DISPLAY_DECIMALS)} kg e1RM`}</span><span>Three answers. Then the work.</span></div>
        {loop.onboardingDisclosures.length > 0 ? <details className="training-disclosures"><summary>Your first training day</summary>{loop.onboardingDisclosures.map((disclosure) => <p key={disclosure.id}>{disclosure.line}</p>)}</details> : null}
      </div>
    </div> : null}

    {state.phase === 'briefing' && state.readiness !== null ? <div className="training-briefing-layout">
      <div className="training-scene-heading"><span className="training-eyebrow">{SESSION_COPY.LIFT_LABEL[lift]} · TODAY’S WORK</span><h1>{state.readiness.headline}<span className="training-title-dot">.</span></h1></div>
      <div className="training-drawer training-drawer--briefing">
        <div className="training-drawer-heading"><div><span className="training-eyebrow">YOUR PRESCRIPTION</span><h2>Choose your effort.</h2></div><span className="training-readiness-label">{state.readiness.label}</span></div>
        <div className="training-prescription"><strong>{preview?.workSets ?? template.workSets} <span>sets</span> × {preview?.repsPerSet ?? template.repsPerSet} <span>reps</span></strong><span>{preview?.weightKg} kg · {SESSION_COPY.LIFT_LABEL[lift]}</span></div>
        <p className="training-briefing-note">Your check-in and recent training shape how the bar feels. Choose a target; the load follows your lifter’s e1RM.</p>
        {state.injury !== null ? <div className="training-injury" role="status"><strong>{state.injury.headline}</strong><p>{state.injury.detail} {state.injury.reassurance}</p></div> : null}
        <div className="training-rpe-ladder" aria-label="Choose an RPE target">
          {SESSION_TUNING.RPE_CHOICES.map((rpe, index) => <button
            type="button"
            key={rpe}
            className={`training-rpe${index === SESSION_TUNING.DEFAULT_RPE_INDEX ? ' training-rpe--suggested' : ''}${selectedRpe === rpe ? ' training-rpe--selected' : ''}`}
            disabled={!loop.ladderReady}
            onClick={() => setSelectedRpe(rpe)}
            aria-pressed={selectedRpe === rpe}
            aria-label={`RPE ${rpe}, ${repsInReserve(rpe)} reps in reserve.`}
            data-testid={`session-rpe-${rpe}`}
          ><span className="training-rpe-label">RPE</span><strong>{rpe}</strong><span className="training-rpe-reserve">{repsInReserve(rpe)} left</span></button>)}
        </div>
        <div className="training-rpe-footer"><span>Reps in reserve at the end of each set</span><span>{loop.ladderReady ? 'Target selected' : 'Preparing your session…'}</span></div>
        <button type="button" className="training-primary" data-testid="session-start" disabled={!loop.ladderReady} onClick={startSession}>Start {lift} <span aria-hidden="true">↗</span></button>
      </div>
    </div> : null}

    {state.phase === 'set' ? <TrainingSet state={state} onResolved={onResolved} /> : null}

    {state.phase === 'rest' && state.plan !== null ? <div className="training-bookend" data-testid="session-rest">
      <div className="training-drawer training-drawer--rest">
        <span className="training-eyebrow">BETWEEN SETS</span><h1>Rack it. Breathe.</h1>
        <div className="training-set-progress" aria-label={`${state.setIndex} of ${state.plan.workSets} sets complete`}>{Array.from({ length: state.plan.workSets }, (_, index) => <span key={index} className={`training-set-mark${index < state.setIndex ? ' training-set-mark--done' : ''}`} aria-hidden="true">{index < state.setIndex ? '✓' : index + 1}</span>)}</div>
        <p>Next: set {currentSetNumber(state)} of {state.plan.workSets} · {state.plan.weightKg} kg</p>
        <button type="button" className="training-primary" onClick={() => dispatch({ kind: 'begin-set' })}>Next set <span aria-hidden="true">↗</span></button>
        <span className="training-rest-note">The next set begins automatically.</span>
      </div>
    </div> : null}

    {state.phase === 'close-out' && closeOut !== null && readings !== null ? <div className="training-bookend" data-testid="session-close-out">
      <div className={`training-drawer training-drawer--closeout${isPr ? ' training-drawer--pr' : ''}`}>
        <span className="training-eyebrow">{practice ? 'PRACTICE COMPLETE' : 'THE WORK IS DONE'}</span>
        <h1>{!closeOut.canPropose ? 'Nothing banked.' : isPr ? 'New e1RM.' : saved ? 'Session logged.' : 'Session complete.'}</h1>
        <p>{!closeOut.canPropose ? closeOut.subhead : saved ? isPr ? 'You beat your best estimate on this lift.' : 'Your work is recorded. Keep building.' : 'Confirming the work with your lifter’s record.'}</p>
        {payoff?.kind === 'e1rm' && payoff.valueKg !== null ? <div className="training-payoff"><span>{SESSION_COPY.LIFT_LABEL[payoff.lift]} e1RM</span><strong>{payoff.valueKg.toFixed(SESSION_TUNING.E1RM_DISPLAY_DECIMALS)}<span>kg</span></strong><span className="training-certainty">{payoff.reading.kind === 'projected' ? 'PROVISIONAL · SAVING' : payoff.reading.kind === 'stale' ? 'LAST CONFIRMED ESTIMATE' : payoff.reading.kind === 'unknown' ? 'AWAITING CONFIRMATION' : practice ? 'PRACTICE LIFTER' : 'CONFIRMED'}</span></div> : null}
        <div className="training-closeout-stats"><div><strong>{readings.streakValue ?? '—'}</strong><span>{practice ? 'Practice streak' : 'Day streak'}</span>{readings.streakDays.kind === 'projected' ? <small>Provisional</small> : null}</div><div><strong>{closeOut.goodReps}<span> / {closeOut.prescribedReps}</span></strong><span>Reps banked</span></div></div>
        <p className="training-bar-feedback">{closeOut.barSpeedText}</p>
        <div className="training-save-status" aria-live="polite">
          {pending ? <span>Saving your session…</span> : saved ? <span className="training-save-confirmed">✓ {practice ? 'Practice session recorded' : 'Saved to your lifter'}</span> : saveError !== null ? <span className="training-save-error">{saveError}</span> : closeOut.canPropose ? <span>Waiting for confirmation.</span> : null}
        </div>
        {saveError !== null && closeOut.canPropose ? <button type="button" className="training-primary" disabled={retrying} onClick={() => { void retrySave(); }}>{retrying ? 'Retrying…' : 'Retry saving'} <span aria-hidden="true">↗</span></button> : !closeOut.canPropose ? <button type="button" className="training-primary" onClick={retrySession}>{canLowerTarget ? 'Try a lighter target' : 'Try again at this target'} <span aria-hidden="true">↗</span></button> : <button type="button" className="training-primary" onClick={onExit} disabled={pending}>Back to the gym <span aria-hidden="true">↗</span></button>}
      </div>
    </div> : null}
  </section>;
}
