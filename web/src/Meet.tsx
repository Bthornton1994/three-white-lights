import './gameplay.css';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { LiftPlayer } from './LiftPlayer';
import {
  ATTEMPT_NUMBERS, ATTEMPTS_PER_LIFT, LIFT_ORDER, bestSuccessfulAttempt, finalMeetTotal,
  isCallableWeightIgnoringTheCard, meetLoadingRules, type LiftKind,
} from '../../src/game/meet';
import {
  attemptConfigFor, attemptDecisionFor, attemptsOnLift, boardFor,
  flightOnDeckText, isUrgentAttempt, lastAttempt,
  lightRevealDelayMs, soundForBeat, stageLoadRatio, stakesForDecision,
  weighInFor,
  type LiveAttempt, type MeetDayEvent, type MeetDayState, type MeetRecap,
} from '../../src/game/meetDay';
import { type MeetServerPort, type MeetServerResponse } from '../../src/game/meetClient';
import type { LiftEvidencePort } from '../../src/production/liftEvidence';
import { RESULT_SHEET_LAYOUT } from './gameplayTuning';
import { resultPng } from './resultSheetCanvas';
import { SHEET_COLUMNS, SHEET_FLIGHT_SCOPE, sheetHeading, sheetValue, type SheetStatus } from './resultSheetModel';
import type { LifterServerPort } from '../../src/game/lifterClient';
import { chosenFederationIdFromCache } from '../../src/game/lifterClient';
import { kilogramMeetEntryFrom } from '../../src/game/lifterEntry';
import type { MeetServerError } from '../../src/game/meetServer';
import { MEET_COPY, MEET_ENTRY, MEET_SOUND, MEET_TUNING, type KilogramMeetEntry, type MeetDefinition } from '../../src/game/meetTuning';
import { openingCache } from '../../src/game/sessionClient';
import { placingForMeet } from '../../src/game/meetBoard';
import { buildResultCard, FLIGHT_LIFT_GROUPS, flightAttemptView, sheetColumnHeading,
  formatWeight, WEIGHT_CLASSES_KG, type ResultCard,
} from '../../src/game/resultCard';
import { flightEntriesForCard, shareableResultCard } from '../../src/game/resultFlight';
import { careerRecapLines } from '../../src/meet/careerSurface';
import { useMeetDay } from '../../src/meet/useMeetDay';
import { useHallStep } from '../../src/meet/useHallStep';
import { fileNameForCue } from '../../src/meet/soundAssets';
import { ironAmberHallPlateId, MEET_HALL_PLATE_FILES } from '../../src/meet/ironAmberHall';
import { barLoadMs, barLoadRattleSounds, braceCueDelayMs, buildWalkout, platesLandedAt,
  walkoutFrameAt, walkoutFrameIndexAt, walkoutRequestFor,
} from '../../src/meet/walkout';

export type MeetPort = MeetServerPort & Pick<LifterServerPort, 'openingProfile'> & Partial<LiftEvidencePort>;

export interface MeetProps {
  port: MeetPort;
  meet: MeetDefinition;
  onExit: () => void;
  onSaved: () => void;
  practice?: boolean;
  soundEnabled?: boolean;
  onSoundChange?: (enabled: boolean) => void;
}

type SaveState = 'ready' | 'saving' | 'failed' | 'saved' | 'refused';

function Arrow() {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" /></svg>;
}

function readEntry(port: MeetPort): { entry: KilogramMeetEntry | null; error: string | null } {
  try {
    const profile = port.openingProfile();
    const federation = chosenFederationIdFromCache(openingCache(port));
    if (profile === null) return { entry: null, error: 'Create your lifter before taking the platform.' };
    if (federation === null) return { entry: null, error: 'Choose your federation in Career before entering a meet.' };
    return { entry: kilogramMeetEntryFrom(profile, federation, MEET_ENTRY.lot), error: null };
  } catch {
    return { entry: null, error: 'Your lifter record could not be opened. Return to Career and reconnect.' };
  }
}

export function Meet(props: MeetProps) {
  const identity = useMemo(() => readEntry(props.port), [props.port]);
  if (identity.entry === null) return <section className="meet-screen meet-entry-error">
    <div className="meet-room" aria-hidden="true" />
    <div className="meet-panel"><p className="meet-eyebrow">THE PLATFORM IS WAITING</p><h1>Your lifter<br /><em>comes first.</em></h1><p>{identity.error}</p><button className="meet-primary" onClick={props.onExit}>Back to career <Arrow /></button></div>
  </section>;
  if (props.meet.rules.unit !== 'kg') return <section className="meet-screen meet-entry-error">
    <div className="meet-room" aria-hidden="true" />
    <div className="meet-panel"><p className="meet-eyebrow">MEET UNAVAILABLE</p><h1>Kilogram<br /><em>platforms.</em></h1><p>This career currently records kilogram meets. This meet cannot be recorded.</p><button className="meet-primary" onClick={props.onExit}>Back to career <Arrow /></button></div>
  </section>;
  return <RecordedMeet {...props} entry={identity.entry} />;
}

function RecordedMeet(props: MeetProps & { entry: KilogramMeetEntry }) {
  useEffect(() => { props.port.resetMeetEvidence?.(); }, [props.port]);
  const [saveState, setSaveState] = useState<SaveState>('ready');
  const [transportError, setTransportError] = useState<string | null>(null);
  const retryRef = useRef<(() => void) | null>(null);
  const notified = useRef(false);
  const reliablePort = useMemo<MeetServerPort>(() => ({
    openingSnapshot: () => props.port.openingSnapshot(),
    meetBrief: (day) => props.port.meetBrief(day),
    recordMeetResult: (day, meet, proposal, id) => new Promise<MeetServerResponse>((resolve) => {
      let busy = false;
      let settled = false;
      const send = async () => {
        if (busy || settled) return;
        busy = true;
        setSaveState('saving');
        setTransportError(null);
        try {
          const response = await props.port.recordMeetResult(day, meet, proposal, id);
          settled = true;
          retryRef.current = null;
          setSaveState(response.kind === 'recorded' ? 'saved' : 'refused');
          resolve(response);
        } catch {
          setSaveState('failed');
          setTransportError('We could not confirm this result. Your attempt sheet is still here. Retry saving when you are connected.');
        } finally {
          busy = false;
        }
      };
      retryRef.current = () => { void send(); };
      void send();
    }),
  }), [props.port]);

  const loop = useMeetDay(reliablePort, props.meet, undefined, false, props.entry, props.port.currentServerDay);
  useEffect(() => {
    if (loop.applied === null || notified.current) return;
    notified.current = true;
    props.onSaved();
  }, [loop.applied, props.onSaved]);

  return <MeetView {...props} state={loop.state} dispatch={loop.dispatch}
    recap={loop.recap} saveState={saveState} saveError={transportError}
    refusal={loop.submissionError} onRetry={() => retryRef.current?.()}
    careerLines={loop.applied === null ? [] : careerRecapLines(loop.applied.career).map((line) => line.text)} />;
}

function localResultCard(state: MeetDayState): ResultCard | null {
  if (state.phase !== 'recap' && state.phase !== 'bombed') return null;
  const entry = state.context.entry;
  const placing = placingForMeet(state.meet, entry.bodyweight.kilograms, entry.lot, state.field);
  const built = buildResultCard({
    meet: state.context.meet,
    lifter: { name: entry.name, sex: entry.sex, bodyweightKg: entry.bodyweight.kilograms, equipment: entry.equipment, division: entry.division },
    state: state.meet,
    ...(placing.place === null ? {} : { placing: placing.place }),
    field: flightEntriesForCard(state, placing.place ?? undefined),
  });
  return built.ok ? built.card : null;
}

interface MeetViewProps extends MeetProps {
  state: MeetDayState;
  dispatch: (event: MeetDayEvent) => void;
  recap: MeetRecap | null;
  saveState: SaveState;
  saveError: string | null;
  refusal: MeetServerError | null;
  onRetry: () => void;
  careerLines: readonly string[];
}

function MeetView({ state, dispatch, recap, saveState, saveError, refusal, onRetry, careerLines, ...props }: MeetViewProps) {
  const [localSound, setLocalSound] = useState(() => { try { return localStorage.getItem('twl:preference:sound') !== 'off'; } catch { return true; } });
  const sound = props.soundEnabled ?? localSound;
  function setSound(enabled: boolean) {
    setLocalSound(enabled);
    props.onSoundChange?.(enabled);
    try { localStorage.setItem('twl:preference:sound', enabled ? 'on' : 'off'); } catch { /* Audio remains controllable with blocked device storage. */ }
  }
  const [showSheet, setShowSheet] = useState(false);
  const terminal = state.phase === 'recap' || state.phase === 'bombed';
  const last = lastAttempt(state);
  const board = useMemo(() => boardFor(state), [state]);
  const card = useMemo(() => recap === null ? localResultCard(state) : shareableResultCard(state, recap), [recap, state]);
  const sheetStatus: SheetStatus = props.practice ? 'practice' : recap === null ? 'unconfirmed' : 'recorded';
  const activeLift = state.live?.lift ?? (state.meet.phase.kind === 'awaiting-declaration' ? state.meet.phase.lift : last?.lift ?? 'squat');
  const weighIn = weighInFor(state.context.entry, WEIGHT_CLASSES_KG[state.context.entry.sex]);
  const config = useMemo(() => state.phase === 'lift' && state.live !== null ? attemptConfigFor(state) : null, [state]);

  useEffect(() => {
    for (const file of Object.values(MEET_HALL_PLATE_FILES)) {
      const preload = new Image();
      preload.src = `/rooms/${file}`;
    }
  }, []);

  useEffect(() => {
    if (state.phase !== 'bombed' || !sound) return;
    const timer = window.setTimeout(() => playSound({ kind: 'bomb-out' }), MEET_TUNING.BOMB_OUT_SILENCE_MS);
    return () => window.clearTimeout(timer);
  }, [state.phase, sound]);

  return <section className={`meet-screen meet-phase-${state.phase}`} aria-label={props.practice ? 'Practice meet' : 'Meet day'}>
    
    <div className="meet-room" aria-hidden="true" />
    <header className="meet-topline">
      <div className="meet-topline-title"><span className="meet-eyebrow">{props.practice ? 'PRACTICE PLATFORM' : 'MEET DAY'}</span><strong>{props.meet.name}</strong></div>
      <div className="meet-topline-actions"><button className="meet-sound" aria-pressed={sound} aria-label={sound ? 'Mute meet sounds' : 'Enable meet sounds'} onClick={() => setSound(!sound)}>{sound ? 'Sound on' : 'Sound off'}</button><button className="meet-exit" onClick={props.onExit} title={terminal ? 'Return to training' : 'Leave this meet. Unrecorded attempts will be discarded.'}>{terminal ? 'Back to career' : 'Leave meet'} <Arrow /></button></div>
    </header>
    <nav className="meet-lift-order" aria-label="Meet lift order">
      {LIFT_ORDER.map((lift, index) => <div className={lift === activeLift ? 'meet-lift-current' : ''} key={lift}><span>0{index + 1}</span><strong>{MEET_COPY.LIFT_LABEL[lift]}</strong><span className="meet-mini-attempts">{ATTEMPT_NUMBERS.map((number) => {
        const attempt = attemptsOnLift(state, lift).find((item) => item.attemptNumber === number);
        return <i key={number} className={attempt ? attempt.good ? 'meet-attempt-made' : 'meet-attempt-missed' : ''} aria-label={`${lift} attempt ${number}: ${attempt ? attempt.good ? 'good lift' : 'no lift' : 'not taken'}`} />;
      })}</span></div>)}
    </nav>

    {state.phase === 'weigh-in' && <div className="meet-bookend">
      <div className="meet-room-caption"><span>{props.meet.town}{props.meet.state ? `, ${props.meet.state}` : ''}</span><strong>THE PLATFORM<br />REMEMBERS.</strong><p>Nine attempts. Three lifts.<br />Make your first one count.</p></div>
      <div className="meet-panel meet-weigh-in"><p className="meet-eyebrow">{MEET_COPY.WEIGH_IN_EYEBROW}</p><h1>You made<br /><em>weight.</em></h1><p className="meet-athlete-name">{state.context.entry.name}</p>
        <dl className="meet-weigh-facts"><div><dt>BODYWEIGHT</dt><dd>{formatWeight(weighIn.bodyweightKg)} <small>kg</small></dd></div><div><dt>WEIGHT CLASS</dt><dd>{weighIn.weightClassText} <small>kg</small></dd></div></dl>
        <p className="meet-category">{state.context.entry.sex === 'male' ? "MEN'S" : "WOMEN'S"} / {state.context.entry.equipment} / {state.context.entry.division}</p><p className="meet-flavour">{weighIn.flavourText}</p>
        {props.practice && <p className="meet-practice-note">Practice progress stays with this lifter and resets when you reload.</p>}
        <button className="meet-primary" onClick={() => dispatch({ kind: 'confirm-weigh-in' })}>Declare openers <Arrow /></button>
      </div>
    </div>}

    {state.phase === 'openers' && <Openers state={state} dispatch={dispatch} />}

    {state.phase === 'attempt-select' && <AttemptSelection state={state} dispatch={dispatch} />}

    {state.phase === 'walkout' && state.live !== null && <Walkout state={state} attempt={state.live} sound={sound} />}

    {state.phase === 'lift' && config !== null && <div className="meet-lift-slot"><LiftPlayer key={`${state.live?.lift}-${state.live?.attemptNumber}`} config={config} competition onResolved={(resolution, evidence) => {
      if (state.live === null) return;
      props.port.setMeetLiftEvidence?.(state.live.lift, state.live.attemptNumber, evidence);
      dispatch({ kind: 'lift-resolved', resolution });
    }} /></div>}

    {(state.phase === 'deliberation' || state.phase === 'verdict') && last !== null && <Judging state={state} sound={sound} />}

    {terminal && <div className="meet-finish">
      <div className="meet-finish-intro" style={state.phase === 'bombed' ? { animationName: 'meet-reveal', animationFillMode: 'both', animationDelay: `${MEET_TUNING.BOMB_OUT_SILENCE_MS}ms`, animationDuration: `${MEET_TUNING.BOMB_OUT_ROW_FADE_MS}ms` } : undefined}><p className="meet-eyebrow">{state.phase === 'bombed' ? 'THE MEET ENDS HERE' : props.practice ? 'PRACTICE COMPLETE' : 'MEET COMPLETE'}</p>
        <h1>{state.phase === 'bombed' ? <>No total.<br /><em>Keep lifting.</em></> : props.practice ? <>Platform<br /><em>practice.</em></> : recap !== null ? <>On the<br /><em>record.</em></> : <>Meet<br /><em>complete.</em></>}</h1>
        {state.phase === 'bombed' ? <><p>Three attempts on the {card?.bombedLift ?? last?.lift}. None of them stood.</p><p className="meet-flavour">{MEET_COPY.BOMB_OUT_HONEST}</p><p className="meet-kept">{MEET_COPY.BOMB_OUT_KEPT}</p></> : <>
          <div className="meet-total"><strong>{recap?.totalText ?? card?.summary[0].value ?? (finalMeetTotal(state.meet) === null ? '—' : formatWeight(finalMeetTotal(state.meet) as number))}</strong><span>kg TOTAL</span></div>
          {recap?.prText && <p className="meet-total-note">{recap.prText}</p>}
          {props.practice && <p className="meet-practice-note">Recorded for this practice lifter. Reloading starts fresh.</p>}
          {card && <dl className="meet-finish-stats"><div><dt>DOTS</dt><dd>{card.summary[1].value}</dd></div><div><dt>FLIGHT PLACE</dt><dd>{card.summary[2].value}<small> / {board.fieldSize}</small></dd></div></dl>}
        </>}
        {recap && <div className="meet-why"><p className="meet-eyebrow">WHY IT MATTERS</p>{recap.whyLines.map((line) => <p key={line}>{line}</p>)}{careerLines.map((line) => <p key={line}>{line}</p>)}</div>}
      </div>
      <div className="meet-result-panel" style={state.phase === 'bombed' ? { animationName: 'meet-reveal', animationFillMode: 'both', animationDelay: `${MEET_TUNING.BOMB_OUT_SILENCE_MS + MEET_TUNING.BOMB_OUT_ROW_ORDER.ACTION * MEET_TUNING.BOMB_OUT_ROW_STAGGER_MS}ms`, animationDuration: `${MEET_TUNING.BOMB_OUT_ROW_FADE_MS}ms` } : undefined}><AttemptGrid state={state} recap={recap} />
        <SaveFeedback practice={props.practice ?? false} saveState={saveState} error={saveError} refusal={refusal} onRetry={onRetry} />
        {card ? <ResultActions card={card} status={sheetStatus} onView={() => setShowSheet(true)} /> : <p className="meet-error" role="alert">The result sheet could not be built. Your attempts are shown above.</p>}
        <button className="meet-primary" onClick={props.onExit}>Back to career <Arrow /></button>
      </div>
    </div>}

    {!terminal && state.phase !== 'lift' && state.phase !== 'weigh-in' && state.phase !== 'openers' && <details className="meet-flight">
      <summary><span>FLIGHT STANDINGS</span><span>{formatWeight(board.playerOnTheBoardKg)} kg banked <span className="meet-flight-plus">+</span></span></summary>
      <table><caption>Live totals on the board. Final placing follows total, bodyweight, and competition order.</caption><thead><tr><th scope="col">Place</th><th scope="col">Lifter</th><th scope="col">Board kg</th></tr></thead><tbody>{board.rows.map((row) => <tr key={row.id} className={row.isPlayer ? 'meet-flight-player' : ''}><td>{row.place ?? '—'}</td><th scope="row">{row.name}{row.isPlayer ? ' · YOU' : ''}</th><td>{row.bombed ? 'DQ' : formatWeight(row.onTheBoardKg)}</td></tr>)}</tbody></table>
    </details>}
    {state.lastError && <div className="meet-error" role="alert">{state.lastError.message}</div>}
    {showSheet && card && <ResultSheet card={card} status={sheetStatus} onClose={() => setShowSheet(false)} />}
  </section>;
}

function Openers({ state, dispatch }: { state: MeetDayState; dispatch: (event: MeetDayEvent) => void }) {
  const [drafts, setDrafts] = useState<Record<LiftKind, string>>(() => ({ squat: String(state.openersKg.squat), bench: String(state.openersKg.bench), deadlift: String(state.openersKg.deadlift) }));
  const [error, setError] = useState<string | null>(null);
  const rules = meetLoadingRules(state.meet);
  const edit = (lift: LiftKind, value: string) => { setError(null); setDrafts((current) => ({ ...current, [lift]: value })); };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    for (const lift of LIFT_ORDER) {
      if (!isCallableWeightIgnoringTheCard(Number(drafts[lift]), lift, rules)) {
        setError(`${MEET_COPY.LIFT_LABEL[lift]} needs a legal bar weight in ${formatWeight(rules.declarationIncrement)} kg increments.`);
        return;
      }
    }
    for (const lift of LIFT_ORDER) dispatch({ kind: 'set-opener', lift, weightKg: Number(drafts[lift]) });
    dispatch({ kind: 'confirm-openers' });
  };
  return <div className="meet-bookend meet-openers-bookend"><div className="meet-room-caption"><span>YOUR ATTEMPT CARD</span><strong>GET INTO<br />THE MEET.</strong><p>These are the weights you can build on.<br />After each opener, the bar only goes up.</p></div><form className="meet-panel meet-openers" onSubmit={submit}>
    <p className="meet-eyebrow">{MEET_COPY.OPENERS_EYEBROW}</p><h1>Start<br /><em>with intent.</em></h1><p className="meet-flavour">Suggested from your current training. The call is yours.</p>
    <div className="meet-opener-rows">{LIFT_ORDER.map((lift) => <div className="meet-opener-row" key={lift}><label htmlFor={`meet-opener-${lift}`}><strong>{MEET_COPY.LIFT_LABEL[lift]}</strong><span>{Number(drafts[lift]) === state.openersKg[lift] && !state.openerOverridden[lift] ? 'suggested opener' : 'your call'}</span></label><div className="meet-stepper">
      <button type="button" aria-label={`Decrease ${lift} opener by ${rules.declarationIncrement} kilograms`} disabled={!isCallableWeightIgnoringTheCard(Number(drafts[lift]) - rules.declarationIncrement, lift, rules)} onClick={() => edit(lift, String(Number(drafts[lift]) - rules.declarationIncrement))}>−</button>
      <input id={`meet-opener-${lift}`} type="number" inputMode="decimal" min={rules.barAndCollarsWeight[lift]} step={rules.declarationIncrement} value={drafts[lift]} onChange={(event) => edit(lift, event.target.value)} aria-label={`${lift} opening attempt in kilograms`} /><span>kg</span>
      <button type="button" aria-label={`Increase ${lift} opener by ${rules.declarationIncrement} kilograms`} onClick={() => edit(lift, String(Number(drafts[lift]) + rules.declarationIncrement))}>+</button>
    </div></div>)}</div>
    {error && <p className="meet-error" role="alert">{error}</p>}
    <p className="meet-opener-note">Three attempts per lift. Your best successful squat, bench, and deadlift make your total.</p>
    <button className="meet-primary" type="submit">Take the platform <Arrow /></button>
  </form></div>;
}

function AttemptSelection({ state, dispatch }: { state: MeetDayState; dispatch: (event: MeetDayEvent) => void }) {
  const decision = attemptDecisionFor(state.meet, state.context.previousBestByLiftKg);
  if (decision === null) return <div className="meet-panel"><p className="meet-error" role="alert">The next attempt could not be read. Leave the meet to return to your lifter record.</p></div>;
  return <div className="meet-choice"><div className="meet-choice-heading"><p className="meet-eyebrow">{MEET_COPY.LIFT_LABEL[decision.lift]} / ATTEMPT {decision.attemptNumber} OF {ATTEMPTS_PER_LIFT}</p><h1>{decision.floorRaisedByMiss ? <>The bar<br /><em>stays heavy.</em></> : <>Your next<br /><em>call.</em></>}</h1><p className="meet-flavour">{decision.floorText}</p><div className="meet-floor"><span>LIGHTEST LEGAL CALL</span><strong>{formatWeight(decision.floorKg)} <small>kg</small></strong><span>{decision.bankedKg === null ? 'Nothing banked on this lift.' : `${formatWeight(decision.bankedKg)} kg banked on this lift.`}</span></div>{decision.bombWarningText && <p className="meet-bomb-warning">{decision.bombWarningText}</p>}</div>
    <div className="meet-options">{decision.options.map((option) => <button key={option.id} className={`meet-option ${option.isPrAttempt ? 'meet-option-pr' : ''}`} onClick={() => dispatch({ kind: 'declare', weightKg: option.weightKg })}>
      <span className="meet-option-label">{option.label}</span><strong>{formatWeight(option.weightKg)} <small>kg</small></strong><span className="meet-option-delta">{option.deltaKg === 0 ? 'Same weight. Another chance.' : `+${formatWeight(option.deltaKg)} kg`}</span><p>{option.why}</p>{option.prNote && <span className="meet-pr-note">{option.prNote}</span>}
      <ul className="meet-stakes">{stakesForDecision(state, decision, option).map((stake) => <li key={stake.kind}>{stake.text}</li>)}</ul><span className="meet-option-action">Declare {formatWeight(option.weightKg)} kg <Arrow /></span>
    </button>)}</div>
  </div>;
}

function playSound(beat: Parameters<typeof soundForBeat>[0]) {
  const cue = soundForBeat(beat);
  if (cue === null) return;
  const player = new Audio(`/sound/${fileNameForCue(cue)}`);
  player.volume = Math.min(1, MEET_SOUND.MASTER_GAIN * MEET_SOUND.CUES[cue].gain);
  void player.play().catch(() => {});
}

function Walkout({ state, attempt, sound }: { state: MeetDayState; attempt: LiveAttempt; sound: boolean }) {
  const rules = meetLoadingRules(state.meet);
  const ratio = stageLoadRatio(state.context, attempt.lift, attempt.weightKg);
  const request = useMemo(() => walkoutRequestFor(attempt, rules.barAndCollarsWeight[attempt.lift], ratio), [attempt, ratio, rules]);
  const sequence = useMemo(() => buildWalkout(request), [request]);
  const sampleFrame = useCallback((elapsed: number) => walkoutFrameIndexAt(sequence, elapsed), [sequence]);
  const index = useHallStep(sampleFrame, sequence.beatMs, null);
  const frame = sequence.frames[index] ?? walkoutFrameAt(sequence, sequence.beatMs);
  const plateId = ironAmberHallPlateId(attempt.lift, frame.stage, false, attempt.attemptNumber);
  const samplePlates = useCallback((elapsed: number) => platesLandedAt(elapsed, request.plateCount), [request]);
  const landed = useHallStep(samplePlates, barLoadMs(request.plateCount), null);
  const lastRattle = useRef<number | null>(null);
  useEffect(() => {
    if (!sound || landed <= 0 || !barLoadRattleSounds(Date.now(), lastRattle.current)) return;
    lastRattle.current = Date.now();
    playSound({ kind: 'bar-plate' });
  }, [landed, sound]);
  useEffect(() => {
    if (!sound) return;
    const timers = [window.setTimeout(() => playSound({ kind: 'walkout-call', urgent: isUrgentAttempt(attempt) }), MEET_TUNING.WALKOUT_WEIGHT_HOLD_MS)];
    const brace = braceCueDelayMs(sequence);
    if (brace !== null) timers.push(window.setTimeout(() => playSound({ kind: 'walkout-brace' }), brace));
    return () => timers.forEach(window.clearTimeout);
  }, [attempt, sequence, sound]);
  const onDeck = flightOnDeckText(state);
  return <div className="meet-walkout" role="status" aria-live="polite"><img className="meet-walkout-art" src={`/rooms/${MEET_HALL_PLATE_FILES[plateId]}`} alt="" /><div className="meet-walkout-scrim" /><div className="meet-platform-call"><p className="meet-eyebrow">{MEET_COPY.LIFT_LABEL[attempt.lift]} / ATTEMPT {attempt.attemptNumber} OF {ATTEMPTS_PER_LIFT}</p><h1>{formatWeight(attempt.weightKg)}<small>kg</small></h1><span>{frame.stage === 'LOAD' ? 'LOADING THE BAR' : frame.stage === 'HUSH' ? 'THE PLATFORM IS YOURS' : 'WALK IT OUT'}</span>{attempt.bombRisk ? <p className="meet-bomb-warning">Nothing banked. This is the lift.</p> : attempt.isPrAttempt ? <p className="meet-pr-note">A competition best is on the bar.</p> : attempt.attemptNumber === ATTEMPTS_PER_LIFT ? <p>Last attempt. Make it yours.</p> : null}</div><div className="meet-walkout-bottom"><span>{state.context.entry.name}</span><span>{onDeck ? `ON DECK · ${onDeck}` : `LOT ${state.context.entry.lot}`}</span></div></div>;
}

function Judging({ state, sound }: { state: MeetDayState; sound: boolean }) {
  const attempt = lastAttempt(state);
  const verdict = state.phase === 'verdict';
  useEffect(() => {
    if (!sound || !verdict || attempt === null) return;
    const timers = attempt.lights.map((light, index) => window.setTimeout(() => playSound({ kind: 'light', light }), lightRevealDelayMs(index)));
    timers.push(window.setTimeout(() => playSound({ kind: 'verdict', good: attempt.good }), lightRevealDelayMs(attempt.lights.length - 1) + MEET_TUNING.LIGHT_FADE_MS));
    return () => timers.forEach(window.clearTimeout);
  }, [verdict, attempt, sound]);
  if (attempt === null) return null;
  const feedbackDelay = lightRevealDelayMs(attempt.lights.length - 1) + MEET_TUNING.FEEDBACK_REVEAL_DELAY_MS;
  return <div className={`meet-judging ${verdict ? 'meet-judging-verdict' : ''}`} role="status" aria-live="polite"><p className="meet-eyebrow">{MEET_COPY.LIFT_LABEL[attempt.lift]} / {formatWeight(attempt.weightKg)} kg</p><div className="meet-lamps" aria-label={verdict ? attempt.lightsText : 'Judges deliberating'}>{attempt.lights.map((light, index) => <span key={index} className={`meet-lamp ${verdict ? `meet-lamp-${light}` : ''}`} style={{ animationDelay: `${lightRevealDelayMs(index)}ms`, animationDuration: `${MEET_TUNING.LIGHT_FADE_MS}ms` }}><i /></span>)}</div><h1 style={verdict ? { animationDelay: `${lightRevealDelayMs(attempt.lights.length - 1) + MEET_TUNING.LIGHT_FADE_MS}ms`, animationDuration: `${MEET_TUNING.LIGHT_FADE_MS}ms` } : undefined}>{verdict ? attempt.good ? 'GOOD LIFT' : 'NO LIFT' : <>The room<br /><em>goes quiet.</em></>}</h1><p className="meet-judge-copy" style={verdict ? { animationDelay: `${feedbackDelay}ms`, animationDuration: `${MEET_TUNING.FEEDBACK_FADE_MS}ms` } : undefined}>{verdict ? `${attempt.lightsText} ${attempt.feedbackText}` : 'Judges deliberating.'}</p></div>;
}

function AttemptGrid({ state, recap }: { state: MeetDayState; recap: MeetRecap | null }) {
  return <div className="meet-attempt-grid"><p className="meet-eyebrow">YOUR ATTEMPT CARD / KG</p><table><caption>Successful attempts count toward your total. Missed attempts are struck through.</caption><thead><tr><th scope="col">Lift</th><th scope="col">1</th><th scope="col">2</th><th scope="col">3</th><th scope="col">Best</th></tr></thead><tbody>{LIFT_ORDER.map((lift) => {
    const best = bestSuccessfulAttempt(state.meet.lifts[lift]);
    const callOut = recap?.rows.find((row) => row.lift === lift)?.callOut;
    return <tr key={lift}><th scope="row">{MEET_COPY.LIFT_LABEL[lift]}{callOut && <span>{callOut.text}</span>}</th>{ATTEMPT_NUMBERS.map((number) => {
      const attempt = attemptsOnLift(state, lift).find((row) => row.attemptNumber === number);
      return <td className={attempt?.good === false ? 'meet-grid-miss' : attempt?.good === true ? 'meet-grid-good' : ''} key={number}><span aria-label={attempt ? `${formatWeight(attempt.weightKg)} kilograms, ${attempt.good ? 'good lift' : 'no lift'}` : 'Not taken'}>{attempt ? formatWeight(attempt.weightKg) : '—'}</span></td>;
    })}<td className="meet-grid-best">{best === null ? '—' : formatWeight(best)}</td></tr>;
  })}</tbody></table></div>;
}

function SaveFeedback({ practice, saveState, error, refusal, onRetry }: { practice: boolean; saveState: SaveState; error: string | null; refusal: MeetServerError | null; onRetry: () => void }) {
  if (saveState === 'saved') return <p className="meet-save-status meet-save-confirmed" role="status">{practice ? '✓ PRACTICE RESULT RECORDED · RESETS ON RELOAD' : '✓ RESULT CONFIRMED ON YOUR CAREER RECORD'}</p>;
  if (saveState === 'failed' || refusal !== null) return <div className="meet-save-error" role="alert"><strong>{refusal === null ? 'Result awaiting confirmation' : 'Result was not recorded'}</strong><p>{error ?? refusal?.message}</p>{refusal === null && <button className="meet-secondary" onClick={onRetry}>Retry saving <Arrow /></button>}<p className="meet-save-small">The sheet below is marked unconfirmed until your result is accepted.</p></div>;
  return <p className="meet-save-status" role="status">SAVING YOUR RESULT…</p>;
}

function ResultSheet({ card, status, onClose }: { card: ResultCard; status: SheetStatus; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const current = dialog.current;
    if (current && !current.open) current.showModal();
    return () => { current?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={dialog} className="meet-sheet-overlay" aria-label="Meet result sheet" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <header className="meet-sheet-toolbar"><span>YOUR RESULT SHEET</span><button autoFocus onClick={onClose}>Back to recap ×</button></header>
    <div className="meet-sheet-scroll"><article className="meet-paper">
      <header><p>{card.meet.federation}</p><h2>{card.meet.name}</h2><div><span>{card.meet.dateText}</span><span>{card.meet.locationText}</span></div></header>
      <div className="meet-paper-category"><strong>FLIGHT RESULTS / KG</strong><span>{SHEET_FLIGHT_SCOPE}</span></div>
      <p className="meet-paper-athlete"><strong>{card.lifter.name}</strong><span>YOUR CATEGORY · {card.lifter.categoryText} kg</span></p>
      <div className="meet-paper-table-wrap"><table><caption>Game flight results across weight classes with signed attempts. Negative values indicate a no lift.</caption><thead><tr><th rowSpan={2} scope="col">Flight place</th><th rowSpan={2} scope="col">Lot</th><th rowSpan={2} scope="col" className="meet-paper-name">Lifter</th><th rowSpan={2} scope="col">Wt kg</th>{FLIGHT_LIFT_GROUPS.map((group) => <th key={group.headingId} colSpan={group.attempts.length + 1} scope="colgroup">{sheetColumnHeading(group.headingId).toUpperCase()}</th>)}<th rowSpan={2} scope="col">TOTAL</th><th rowSpan={2} scope="col">DOTS</th></tr><tr>{FLIGHT_LIFT_GROUPS.flatMap((group) => [...group.attempts, group.bestId].map((id) => <th key={id} scope="col">{sheetHeading(id)}</th>))}</tr></thead><tbody>{card.field.map((row) => <tr key={row.id} className={row.isPlayer ? 'meet-paper-player' : undefined}>{SHEET_COLUMNS.map((id) => id === 'lifter' ? <th key={id} scope="row" className="meet-paper-name">{sheetValue(row, id)}{row.isPlayer && <small>YOU</small>}</th> : <td key={id} className={`${(id === 'lot' ? false : flightAttemptView(row, id)?.struckThrough) ? 'meet-paper-miss' : ''} ${id === 'total' ? 'meet-paper-total' : ''}`}>{sheetValue(row, id)}</td>)}</tr>)}</tbody></table></div>
      <div className="meet-paper-cards">{card.field.map((row) => <section className={`meet-paper-lifter${row.isPlayer ? ' meet-paper-player' : ''}`} key={row.id} aria-label={`${row.name} result`}>
        <header><div><span className="meet-paper-place">FLIGHT {row.placeText}{row.isPlayer ? ' · YOU' : ''}</span><h3>{row.name}</h3></div><span className="meet-paper-lot">LOT {row.lotText}</span></header>
        <p className="meet-paper-bodyweight">Bodyweight {row.bodyweightText} kg{row.isPlayer && <span>{card.lifter.categoryText} kg</span>}</p>
        <table><caption>{row.name}: attempts in kilograms; negative values are no lifts.</caption><thead><tr><th scope="col">Lift</th><th scope="col">1</th><th scope="col">2</th><th scope="col">3</th><th scope="col">Best</th></tr></thead><tbody>{FLIGHT_LIFT_GROUPS.map((group) => <tr key={group.headingId}><th scope="row">{sheetColumnHeading(group.headingId)}</th>{[...group.attempts, group.bestId].map((id) => <td key={id} className={flightAttemptView(row, id)?.struckThrough ? 'meet-paper-miss' : undefined}>{sheetValue(row, id)}</td>)}</tr>)}</tbody></table>
        <dl><div><dt>TOTAL</dt><dd>{row.totalText}<small> kg</small></dd></div><div><dt>DOTS</dt><dd>{row.dotsText}</dd></div></dl>
      </section>)}</div>
      <p className="meet-paper-note">Negative attempts indicate a no lift. Flight placing compares totals across weight classes.</p>
      <footer><span>THREE WHITE LIGHTS · GAME COMPETITION</span><span>{status === 'practice' ? 'PRACTICE RESULT' : status === 'unconfirmed' ? 'UNCONFIRMED RESULT' : 'RECORDED RESULT'}</span></footer>
    </article><p className="meet-sheet-hint">All nine attempts, each best, total and DOTS. Download the PNG for the complete flight table.</p><ResultActions card={card} status={status} /></div>
  </dialog>;
}

function ResultActions({ card, status, onView }: { card: ResultCard; status: SheetStatus; onView?: () => void }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const filename = `${card.lifter.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${status}-result.png`;
  useEffect(() => {
    let live = true;
    setBlob(null);
    void resultPng(card, status).then((image) => { if (live) setBlob(image); }).catch((error) => { if (live) setFeedback(error instanceof Error ? error.message : 'The image could not be prepared.'); });
    return () => { live = false; };
  }, [card, status]);
  const download = () => {
    if (blob === null) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), RESULT_SHEET_LAYOUT.downloadUrlLifetimeMs);
    setFeedback('Your PNG result sheet has been downloaded.');
  };
  const share = async () => {
    if (blob === null || busy) return;
    const file = new File([blob], filename, { type: 'image/png' });
    if (!navigator.share || !navigator.canShare?.({ files: [file] })) { download(); return; }
    setBusy(true); setFeedback(null);
    try { await navigator.share({ files: [file], title: `${card.lifter.name} · ${card.meet.name}` }); }
    catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setFeedback('Sharing was unavailable. You can download the PNG instead.'); }
    finally { setBusy(false); }
  };
  return <div className="meet-result-actions">{onView && <button className="meet-secondary meet-view-sheet" onClick={onView} aria-label="View the complete result sheet">Result sheet <Arrow /></button>}<div className="meet-export-buttons"><button className="meet-secondary" onClick={download} disabled={blob === null}>{blob === null ? 'Preparing PNG…' : 'Download PNG'} <svg aria-hidden="true" width="17" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4" stroke="currentColor" strokeWidth="1.7" /></svg></button><button className="meet-secondary" onClick={() => { void share(); }} disabled={blob === null || busy}>{busy ? 'Sharing…' : 'Share result'} <Arrow /></button></div>{feedback && <p className="meet-export-feedback" role="status">{feedback}</p>}</div>;
}



export default Meet;
