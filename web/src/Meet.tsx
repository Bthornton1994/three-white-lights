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
import type { LifterServerPort } from '../../src/game/lifterClient';
import { chosenFederationIdFromCache } from '../../src/game/lifterClient';
import { kilogramMeetEntryFrom } from '../../src/game/lifterEntry';
import type { MeetServerError } from '../../src/game/meetServer';
import { MEET_COPY, MEET_ENTRY, MEET_SOUND, MEET_TUNING, type KilogramMeetEntry, type MeetDefinition } from '../../src/game/meetTuning';
import { openingCache } from '../../src/game/sessionClient';
import { placingForMeet } from '../../src/game/meetBoard';
import { buildResultCard, flightAttemptView, flightBestText, flightColumnHeading,
  formatWeight, WEIGHT_CLASSES_KG, RESULT_FLIGHT_TABLE_COLUMNS,
  type ResultCard, type ResultCardFlightRow, type ResultSheetColumnId,
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

export type MeetPort = MeetServerPort & Pick<LifterServerPort, 'openingProfile'>;

export interface MeetProps {
  port: MeetPort;
  meet: MeetDefinition;
  onExit: () => void;
  onSaved: () => void;
  practice?: boolean;
}

type SaveState = 'ready' | 'saving' | 'failed' | 'saved' | 'refused';
type SheetStatus = 'recorded' | 'practice' | 'unconfirmed';
type WebSheetColumnId = ResultSheetColumnId | 'lot';
const SHEET_COLUMNS: readonly WebSheetColumnId[] = ['place', 'lot', ...RESULT_FLIGHT_TABLE_COLUMNS.slice(1)];

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
    <style>{MEET_STYLES}</style><div className="meet-room" aria-hidden="true" />
    <div className="meet-panel"><p className="meet-eyebrow">THE PLATFORM IS WAITING</p><h1>Your lifter<br /><em>comes first.</em></h1><p>{identity.error}</p><button className="meet-primary" onClick={props.onExit}>Back to career <Arrow /></button></div>
  </section>;
  if (props.meet.rules.unit !== 'kg') return <section className="meet-screen meet-entry-error">
    <style>{MEET_STYLES}</style><div className="meet-room" aria-hidden="true" />
    <div className="meet-panel"><p className="meet-eyebrow">MEET UNAVAILABLE</p><h1>Kilogram<br /><em>platforms.</em></h1><p>This career currently records kilogram meets. This meet cannot be recorded.</p><button className="meet-primary" onClick={props.onExit}>Back to career <Arrow /></button></div>
  </section>;
  return <RecordedMeet {...props} entry={identity.entry} />;
}

function RecordedMeet(props: MeetProps & { entry: KilogramMeetEntry }) {
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

  const loop = useMeetDay(reliablePort, props.meet, undefined, false, props.entry);
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
  const [sound, setSound] = useState(true);
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
    <style>{MEET_STYLES}</style>
    <div className="meet-room" aria-hidden="true" />
    <header className="meet-topline">
      <div className="meet-topline-title"><span className="meet-eyebrow">{props.practice ? 'PRACTICE PLATFORM' : 'MEET DAY'}</span><strong>{props.meet.name}</strong></div>
      <div className="meet-topline-actions"><button className="meet-sound" aria-pressed={sound} aria-label={sound ? 'Mute meet sounds' : 'Enable meet sounds'} onClick={() => setSound((enabled) => !enabled)}>{sound ? 'Sound on' : 'Sound off'}</button><button className="meet-exit" onClick={props.onExit} title={terminal ? 'Return to training' : 'Leave this meet. Unrecorded attempts will be discarded.'}>{terminal ? 'Back to career' : 'Leave meet'} <Arrow /></button></div>
    </header>
    <nav className="meet-lift-order" aria-label="Meet lift order">
      {LIFT_ORDER.map((lift, index) => <div className={lift === activeLift ? 'meet-lift-current' : ''} key={lift}><span>0{index + 1}</span><strong>{MEET_COPY.LIFT_LABEL[lift]}</strong><span className="meet-mini-attempts">{ATTEMPT_NUMBERS.map((number) => {
        const attempt = attemptsOnLift(state, lift).find((item) => item.attemptNumber === number);
        return <i key={number} className={attempt ? attempt.good ? 'meet-attempt-made' : 'meet-attempt-missed' : ''} aria-label={`${lift} attempt ${number}: ${attempt ? attempt.good ? 'good lift' : 'no lift' : 'not taken'}`} />;
      })}</span></div>)}
    </nav>

    {state.phase === 'weigh-in' && <div className="meet-bookend">
      <div className="meet-room-caption"><span>{props.meet.town}{props.meet.state ? `, ${props.meet.state}` : ''}</span><strong>THE PLATFORM<br />REMEMBERS.</strong><p>Nine attempts. Three lifts.<br />Make your first one count.</p></div>
      <div className="meet-panel meet-weigh-in"><p className="meet-eyebrow">01 / WEIGH-IN</p><h1>You made<br /><em>weight.</em></h1><p className="meet-athlete-name">{state.context.entry.name}</p>
        <dl className="meet-weigh-facts"><div><dt>BODYWEIGHT</dt><dd>{formatWeight(weighIn.bodyweightKg)} <small>kg</small></dd></div><div><dt>WEIGHT CLASS</dt><dd>{weighIn.weightClassText} <small>kg</small></dd></div></dl>
        <p className="meet-category">{state.context.entry.sex === 'male' ? "MEN'S" : "WOMEN'S"} / {state.context.entry.equipment} / {state.context.entry.division}</p><p className="meet-flavour">{weighIn.flavourText}</p>
        {props.practice && <p className="meet-practice-note">Practice progress stays with this lifter and resets when you reload.</p>}
        <button className="meet-primary" onClick={() => dispatch({ kind: 'confirm-weigh-in' })}>Declare openers <Arrow /></button>
      </div>
    </div>}

    {state.phase === 'openers' && <Openers state={state} dispatch={dispatch} />}

    {state.phase === 'attempt-select' && <AttemptSelection state={state} dispatch={dispatch} />}

    {state.phase === 'walkout' && state.live !== null && <Walkout state={state} attempt={state.live} sound={sound} />}

    {state.phase === 'lift' && config !== null && <div className="meet-lift-slot"><LiftPlayer key={`${state.live?.lift}-${state.live?.attemptNumber}`} config={config} competition onResolved={(resolution) => dispatch({ kind: 'lift-resolved', resolution })} /></div>}

    {(state.phase === 'deliberation' || state.phase === 'verdict') && last !== null && <Judging state={state} sound={sound} />}

    {terminal && <div className="meet-finish">
      <div className="meet-finish-intro" style={state.phase === 'bombed' ? { animationName: 'meet-reveal', animationFillMode: 'both', animationDelay: `${MEET_TUNING.BOMB_OUT_SILENCE_MS}ms`, animationDuration: `${MEET_TUNING.BOMB_OUT_ROW_FADE_MS}ms` } : undefined}><p className="meet-eyebrow">{state.phase === 'bombed' ? 'THE MEET ENDS HERE' : props.practice ? 'PRACTICE COMPLETE' : 'MEET COMPLETE'}</p>
        <h1>{state.phase === 'bombed' ? <>No total.<br /><em>Keep lifting.</em></> : props.practice ? <>Platform<br /><em>practice.</em></> : recap !== null ? <>On the<br /><em>record.</em></> : <>Meet<br /><em>complete.</em></>}</h1>
        {state.phase === 'bombed' ? <><p>Three attempts on the {card?.bombedLift ?? last?.lift}. None of them stood.</p><p className="meet-flavour">{MEET_COPY.BOMB_OUT_HONEST}</p><p className="meet-kept">{MEET_COPY.BOMB_OUT_KEPT}</p></> : <>
          <div className="meet-total"><strong>{recap?.totalText ?? card?.summary[0].value ?? (finalMeetTotal(state.meet) === null ? '—' : formatWeight(finalMeetTotal(state.meet) as number))}</strong><span>kg TOTAL</span></div>
          {recap?.prText && <p className="meet-total-note">{recap.prText}</p>}
          {props.practice && <p className="meet-practice-note">Recorded for this practice lifter. Reloading starts fresh.</p>}
          {card && <dl className="meet-finish-stats"><div><dt>DOTS</dt><dd>{card.summary[1].value}</dd></div><div><dt>PLACE</dt><dd>{card.summary[2].value}<small> / {board.fieldSize}</small></dd></div></dl>}
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
    <p className="meet-eyebrow">02 / OPENING ATTEMPTS</p><h1>Start<br /><em>with intent.</em></h1><p className="meet-flavour">Suggested from your current training. The call is yours.</p>
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

function sheetValue(row: ResultCardFlightRow, id: WebSheetColumnId): string {
  if (id === 'lot') return row.lotText;
  const attempt = flightAttemptView(row, id);
  if (attempt !== null) return attempt.signedText || '—';
  const best = flightBestText(row, id);
  if (best !== null) return best;
  switch (id) {
    case 'place': return row.placeText;
    case 'lifter': return row.name;
    case 'bodyweight': return row.bodyweightText;
    case 'total': return row.totalText;
    case 'dots': return row.dotsText;
    default: return '—';
  }
}

function sheetHeading(id: WebSheetColumnId): string {
  return id === 'lot' ? 'Lot' : flightColumnHeading(id);
}

function ResultSheet({ card, status, onClose }: { card: ResultCard; status: SheetStatus; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
    return () => { dialog.current?.close(); previous?.focus(); };
  }, [onClose]);
  return <dialog ref={dialog} className="meet-sheet-overlay" aria-label="Meet result sheet" onCancel={(event) => { event.preventDefault(); onClose(); }}><header className="meet-sheet-toolbar"><span>YOUR RESULT SHEET</span><button autoFocus onClick={onClose}>Back to recap ×</button></header><div className="meet-sheet-scroll"><article className="meet-paper"><header><p>{card.meet.federation}</p><h2>{card.meet.name}</h2><div><span>{card.meet.dateText}</span><span>{card.meet.locationText}</span></div></header><div className="meet-paper-category"><strong>FLIGHT RESULTS</strong><span>YOUR CATEGORY · {card.lifter.categoryText} / KG</span></div><div className="meet-paper-table-wrap"><table><caption>Published results with signed attempts. Negative values indicate a no lift.</caption><thead><tr><th rowSpan={2} scope="col">Place</th><th rowSpan={2} scope="col">Lot</th><th rowSpan={2} scope="col" className="meet-paper-name">Lifter</th><th rowSpan={2} scope="col">Wt kg</th><th colSpan={4} scope="colgroup">SQUAT</th><th colSpan={4} scope="colgroup">BENCH</th><th colSpan={4} scope="colgroup">DEADLIFT</th><th rowSpan={2} scope="col">TOTAL</th><th rowSpan={2} scope="col">DOTS</th></tr><tr>{LIFT_ORDER.flatMap((lift) => ['1', '2', '3', 'Best'].map((heading) => <th key={`${lift}-${heading}`} scope="col">{heading}</th>))}</tr></thead><tbody>{card.field.map((row) => <tr key={row.id}>{SHEET_COLUMNS.map((id) => <td key={id} className={`${id === 'lifter' ? 'meet-paper-name' : ''} ${(id === 'lot' ? false : flightAttemptView(row, id)?.struckThrough) ? 'meet-paper-miss' : ''} ${id === 'total' ? 'meet-paper-total' : ''}`}>{sheetValue(row, id)}</td>)}</tr>)}</tbody></table></div><footer><span>THREE WHITE LIGHTS · GAME COMPETITION</span><span>{status === 'practice' ? 'PRACTICE RESULT' : status === 'unconfirmed' ? 'UNCONFIRMED RESULT' : 'RECORDED RESULT'}</span></footer></article><p className="meet-sheet-hint">Swipe the sheet to inspect every attempt. The PNG includes the complete table.</p><ResultActions card={card} status={status} /></div></dialog>;
}

const SHEET_EXPORT = Object.freeze({
  width: 1600, height: 1060, margin: 58, mastheadY: 94, meetY: 151,
  metaY: 193, categoryY: 252, tableY: 286, headerHeight: 54, rowHeight: 62,
  footerY: 988, paper: '#f7f1e4', ink: '#211d17', muted: '#675e4d', rule: '#a49881',
  columns: Object.freeze([52, 46, 230, 84, 71, 71, 71, 76, 71, 71, 71, 76, 71, 71, 71, 76, 94, 106]),
});

async function resultPng(card: ResultCard, status: SheetStatus): Promise<Blob> {
  const sheet = SHEET_EXPORT;
  const canvas = document.createElement('canvas');
  canvas.width = sheet.width; canvas.height = sheet.height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('This browser could not create the result image.');
  ctx.fillStyle = sheet.paper; ctx.fillRect(0, 0, sheet.width, sheet.height);
  ctx.fillStyle = sheet.ink; ctx.textAlign = 'center';
  ctx.font = '700 38px Georgia, serif'; ctx.fillText(card.meet.federation, sheet.width / 2, sheet.mastheadY, sheet.width - 2 * sheet.margin);
  ctx.font = '700 28px Arial, sans-serif'; ctx.fillText(card.meet.name, sheet.width / 2, sheet.meetY, sheet.width - 2 * sheet.margin);
  ctx.font = '19px Arial, sans-serif'; ctx.fillStyle = sheet.muted; ctx.textAlign = 'left'; ctx.fillText(card.meet.dateText, sheet.margin, sheet.metaY);
  ctx.textAlign = 'right'; ctx.fillText(card.meet.locationText, sheet.width - sheet.margin, sheet.metaY, sheet.width / 2);
  const line = (y: number, heavy = false) => { ctx.strokeStyle = sheet.rule; ctx.lineWidth = heavy ? 2 : 1; ctx.beginPath(); ctx.moveTo(sheet.margin, y); ctx.lineTo(sheet.width - sheet.margin, y); ctx.stroke(); };
  line(sheet.metaY + 18, true); line(sheet.metaY + 23);
  ctx.textAlign = 'left'; ctx.fillStyle = sheet.ink; ctx.font = '700 20px Arial, sans-serif'; ctx.fillText('FLIGHT RESULTS', sheet.margin, sheet.categoryY);
  ctx.textAlign = 'right'; ctx.fillStyle = sheet.muted; ctx.font = '14px Arial, sans-serif'; ctx.fillText(`YOUR CATEGORY · ${card.lifter.categoryText} / KG`, sheet.width - sheet.margin, sheet.categoryY, (sheet.width - 2 * sheet.margin) / 2);
  const totalWidth = sheet.columns.reduce((sum, width) => sum + width, 0);
  const scale = (sheet.width - 2 * sheet.margin) / totalWidth;
  const xs: number[] = [sheet.margin];
  sheet.columns.forEach((width) => xs.push((xs[xs.length - 1] ?? sheet.margin) + width * scale));
  const cell = (text: string, col: number, y: number, bold: boolean, left = false) => {
    const x = xs[col] ?? sheet.margin;
    const width = ((sheet.columns[col] ?? 70) * scale);
    ctx.textAlign = left ? 'left' : 'center';
    ctx.fillStyle = sheet.ink; ctx.font = `${bold ? '700' : '400'} 17px Arial, sans-serif`;
    ctx.fillText(text, left ? x + 8 : x + width / 2, y, width - 12);
  };
  ctx.fillStyle = '#e8dfcc'; ctx.fillRect(sheet.margin, sheet.tableY, sheet.width - 2 * sheet.margin, sheet.headerHeight);
  const headings = SHEET_COLUMNS;
  for (let col = 0; col < headings.length; col += 1) {
    const id = headings[col];
    if (!id) continue;
    const isAttemptOrBest = col >= 4 && col <= 15;
    cell(sheetHeading(id), col, sheet.tableY + (isAttemptOrBest ? 43 : 33), true, id === 'lifter');
  }
  LIFT_ORDER.forEach((lift, index) => {
    const start = xs[4 + index * 4] ?? sheet.margin;
    const end = xs[8 + index * 4] ?? start;
    ctx.textAlign = 'center'; ctx.font = '700 15px Arial, sans-serif'; ctx.fillText(MEET_COPY.LIFT_LABEL[lift], (start + end) / 2, sheet.tableY + 19);
  });
  line(sheet.tableY, true); line(sheet.tableY + sheet.headerHeight, true);
  card.field.forEach((row, rowIndex) => {
    const y = sheet.tableY + sheet.headerHeight + rowIndex * sheet.rowHeight;
    if (rowIndex % 2 === 1) { ctx.fillStyle = '#eee6d5'; ctx.fillRect(sheet.margin, y, sheet.width - 2 * sheet.margin, sheet.rowHeight); }
    headings.forEach((id, col) => cell(sheetValue(row, id), col, y + 37, id === 'total', id === 'lifter'));
    line(y + sheet.rowHeight);
  });
  const bottom = sheet.tableY + sheet.headerHeight + card.field.length * sheet.rowHeight;
  [4, 8, 12, 16].forEach((col) => { const x = xs[col] ?? sheet.margin; ctx.beginPath(); ctx.moveTo(x, sheet.tableY); ctx.lineTo(x, bottom); ctx.stroke(); });
  ctx.fillStyle = sheet.muted; ctx.font = '15px Arial, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('Negative attempts indicate a no lift. Total is the sum of the best successful attempt in each lift.', sheet.margin, bottom + 35);
  line(sheet.footerY - 28); ctx.font = '14px Arial, sans-serif'; ctx.fillText('THREE WHITE LIGHTS · GAME COMPETITION', sheet.margin, sheet.footerY);
  ctx.textAlign = 'right'; ctx.fillText(status === 'practice' ? 'PRACTICE RESULT' : status === 'unconfirmed' ? 'UNCONFIRMED RESULT' : 'RECORDED RESULT', sheet.width - sheet.margin, sheet.footerY);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('The result image could not be exported.')), 'image/png'));
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
    URL.revokeObjectURL(url);
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

const MEET_STYLES = `
.meet-screen{position:relative;isolation:isolate;display:flex;flex-direction:column;min-height:100%;height:100%;overflow:auto;background:#17130f;color:#f5ecdb;font-family:var(--font-body,Arial,sans-serif)}.meet-room{position:absolute;inset:0;z-index:-2;background:linear-gradient(90deg,#17100bbe,#17100b36 50%,#17100b80),url('/rooms/meet-empty.jpg') center/cover no-repeat;pointer-events:none}.meet-screen button{font:inherit;cursor:pointer}.meet-screen button:disabled{cursor:default;opacity:.5}.meet-screen button:focus-visible,.meet-screen input:focus-visible,.meet-screen summary:focus-visible{outline:3px solid #efc173;outline-offset:4px}.meet-topline{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:19px 32px;background:#17120fea;border-bottom:1px solid #edc98c24;flex:none}.meet-topline-title{display:flex;align-items:center;gap:18px;min-width:0}.meet-eyebrow{font-size:9px;letter-spacing:.19em;font-weight:700;line-height:1.5;margin:0 0 14px;color:#d5a663}.meet-topline-title .meet-eyebrow{margin:0;flex:none}.meet-topline-title strong{font-size:11px;font-weight:500;color:#c4b7a3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.meet-topline-actions{display:flex;align-items:center;gap:20px;flex:none}.meet-sound,.meet-exit{background:transparent;border:0;color:#bdab92;font-size:10px!important;min-height:30px;padding:0}.meet-sound{color:#887860}.meet-exit{display:flex;gap:12px;align-items:center}.meet-lift-order{display:grid;grid-template-columns:repeat(3,1fr);background:#1c1611e8;border-bottom:1px solid #e6c18a22;padding:12px 32px;gap:24px;flex:none}.meet-lift-order>div{display:flex;align-items:center;gap:10px;color:#776b58;font-size:9px;letter-spacing:.12em;min-width:0}.meet-lift-order strong{font-size:10px;font-weight:600}.meet-lift-current strong{color:#dfb67a}.meet-lift-current>span:first-child{color:#c18d4a}.meet-mini-attempts{margin-left:auto;display:flex;gap:4px}.meet-mini-attempts i{display:block;width:5px;height:5px;border-radius:50%;background:#645a4b}.meet-mini-attempts i.meet-attempt-made{background:#eee9d8;box-shadow:0 0 5px #eee9d850}.meet-mini-attempts i.meet-attempt-missed{background:#a85442}.meet-bookend{display:grid;grid-template-columns:1fr minmax(350px,430px);align-items:end;gap:36px;flex:1;min-height:550px;padding:45px 56px 50px;max-width:1500px;width:100%;box-sizing:border-box;margin:auto}.meet-room-caption{align-self:center;color:#d5c6ae}.meet-room-caption>span{font-size:9px;letter-spacing:.24em;color:#c09f69;text-transform:uppercase}.meet-room-caption>strong{display:block;font-family:var(--font-display,'Arial Narrow',Impact,sans-serif);font-size:clamp(45px,5vw,75px);line-height:.99;font-weight:700;letter-spacing:-.025em;margin:24px 0}.meet-room-caption p{color:#b9a98f;font-size:13px;line-height:1.7}.meet-panel{background:#21180fee;border:1px solid #c49b6050;padding:30px;box-shadow:0 15px 60px #0005}.meet-screen h1{font-family:var(--font-display,'Arial Narrow',Impact,sans-serif);font-size:clamp(42px,4.4vw,62px);line-height:.96;letter-spacing:-.025em;font-weight:800;text-transform:uppercase;margin:0}.meet-screen h1 em{font-style:normal;color:#d5a663}.meet-panel>p:not(.meet-eyebrow){font-size:12px;line-height:1.6}.meet-athlete-name{margin:17px 0;color:#eddec5;font-size:13px!important}.meet-weigh-facts{display:grid;grid-template-columns:1fr 1fr;gap:24px;padding:16px 0;margin:0;border-block:1px solid #d3ab6728}.meet-weigh-facts dt,.meet-finish-stats dt{font-size:8px;letter-spacing:.14em;color:#9b886e;margin-bottom:8px}.meet-weigh-facts dd{font-family:var(--font-display,'Arial Narrow',Impact,sans-serif);font-size:38px;line-height:1;margin:0;color:#f5e7cf}.meet-weigh-facts small{font-family:var(--font-body,Arial,sans-serif);font-size:11px;color:#b4a085}.meet-category{font-size:8px!important;letter-spacing:.13em;color:#a38d6e;margin:16px 0 13px}.meet-flavour{color:#b9a68a;line-height:1.6;font-size:12px}.meet-primary{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:46px;padding:13px 17px;width:100%;background:#d5a663;color:#25180e;border:1px solid #e8c283;font-size:11px!important;font-weight:700!important}.meet-primary:hover{background:#e4b875}.meet-practice-note{color:#ceae7b;font-size:11px;line-height:1.6}.meet-weigh-in .meet-primary{margin-top:22px}.meet-opener-rows{margin:24px 0 14px}.meet-opener-row{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:14px 0;border-top:1px solid #cfa05c25}.meet-opener-row:last-child{border-bottom:1px solid #cfa05c25}.meet-opener-row label{display:flex;flex-direction:column;gap:6px;flex:1}.meet-opener-row label strong{font-size:10px;letter-spacing:.11em}.meet-opener-row label span{font-size:9px;color:#9a8466}.meet-stepper{display:flex;align-items:center;border:1px solid #b795623f;background:#16100d}.meet-stepper button{border:0;background:transparent;color:#dfb67a;font-size:20px;min-height:42px;width:36px;padding:0}.meet-stepper input{color:#f4e6d0;font:600 16px var(--font-body,Arial,sans-serif);background:transparent;border:0;text-align:right;width:65px;min-width:0;outline:none;padding:5px 1px;appearance:textfield}.meet-stepper input::-webkit-inner-spin-button,.meet-stepper input::-webkit-outer-spin-button{-webkit-appearance:none}.meet-stepper>span{font-size:9px;color:#ad9676;padding:0 6px}.meet-opener-note{font-size:10px!important;color:#90795b;line-height:1.65;margin:10px 0 19px}.meet-choice{display:grid;grid-template-columns:minmax(260px,.8fr) minmax(0,1.2fr);gap:45px;align-items:center;flex:1;max-width:1120px;width:100%;box-sizing:border-box;padding:40px 40px 30px;margin:auto}.meet-choice-heading .meet-flavour{max-width:300px;margin:21px 0}.meet-floor{border-top:1px solid #cda36742;padding-top:20px;display:flex;flex-direction:column;gap:11px}.meet-floor>span{font-size:9px;letter-spacing:.12em;color:#ae9470}.meet-floor>span:last-child{font-size:11px;letter-spacing:0;color:#beab8d}.meet-floor strong{font-family:var(--font-display,'Arial Narrow',Impact,sans-serif);font-size:41px;font-weight:600;color:#e4bd81}.meet-floor small{font-size:13px;font-family:var(--font-body,Arial,sans-serif);font-weight:400;color:#b39366}.meet-options{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:stretch}.meet-option{text-align:left;display:flex;flex-direction:column;background:#241a11f2;border:1px solid #bb94544d;color:#e9dcc6;padding:24px 20px;min-width:0}.meet-option:hover{border-color:#d6aa68;background:#332416}.meet-option-pr{border-color:#e4b76d;box-shadow:inset 0 2px #c6974b}.meet-option-label{font-size:9px;letter-spacing:.15em;color:#cca263;font-weight:700}.meet-option>strong{font-family:var(--font-display,'Arial Narrow',Impact,sans-serif);font-size:51px;font-weight:600;line-height:1;margin:22px 0 6px;white-space:nowrap}.meet-option small{font-size:12px;font-family:var(--font-body,Arial,sans-serif);color:#b2966e;font-weight:400}.meet-option-delta{font-size:10px;color:#b29266}.meet-option>p{font-size:11px;line-height:1.65;color:#bba689;margin:20px 0 12px;min-height:54px}.meet-pr-note{font-size:10px!important;color:#e7ba73!important;line-height:1.5;letter-spacing:.02em}.meet-stakes{padding:11px 0 0;margin:0 0 24px;list-style:none;border-top:1px solid #c09a5830;color:#bcaa8d;font-size:10px;line-height:1.6}.meet-stakes li{margin:5px 0}.meet-option-action{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:10px;color:#e6bc7d;margin-top:auto;border-top:1px solid #c09a5830;padding-top:16px}.meet-bomb-warning{color:#daa181;font-size:11px;line-height:1.6;margin:17px 0 0;border-left:2px solid #9b5c3b;padding-left:11px}.meet-lift-slot{position:relative;flex:1;min-height:0;overflow:hidden}.meet-walkout{position:relative;isolation:isolate;flex:1;min-height:430px;overflow:hidden;display:flex;align-items:center;justify-content:center}.meet-walkout-art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 54%;z-index:-3}.meet-walkout-scrim{position:absolute;inset:0;background:linear-gradient(180deg,#1c100947,#1c100919 34%,#1c1009a6);z-index:-2}.meet-platform-call{text-align:center;align-self:flex-start;margin-top:34px;padding:20px 22px;background:#17100b6b;backdrop-filter:blur(2px);min-width:250px}.meet-platform-call h1{font-size:90px;color:#f7ead3;line-height:1}.meet-platform-call h1 small{font:13px var(--font-body,Arial,sans-serif);color:#d2b98f;letter-spacing:0;margin-left:7px}.meet-platform-call>span{display:block;font-size:9px;letter-spacing:.22em;color:#c49b61;margin-top:16px}.meet-platform-call>p:not(.meet-eyebrow){font-size:11px;color:#ccae82;margin-top:14px}.meet-walkout-bottom{position:absolute;bottom:25px;left:32px;right:32px;display:flex;justify-content:space-between;gap:15px;font-size:10px;letter-spacing:.1em;color:#dac3a0}.meet-judging{flex:1;min-height:410px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:36px 24px;background:#17100bcf}.meet-lamps{display:flex;gap:22px;margin:24px 0 32px}.meet-lamp{width:72px;height:72px;border-radius:50%;border:1px solid #baa17828;background:#171410;display:flex;align-items:center;justify-content:center;box-shadow:0 7px 12px #0007,inset 0 0 0 5px #0f0e0c}.meet-lamp i{width:52px;height:52px;border-radius:50%;background:#29261f;box-shadow:inset 0 2px 8px #000}.meet-lamp-white i{background:#f7f4e7;box-shadow:0 0 22px #fff4ca44,inset 0 0 8px #fff}.meet-lamp-red i{background:#b54e36;box-shadow:0 0 18px #bd442525,inset 0 0 8px #dd6943}.meet-lamp-white,.meet-lamp-red{animation:meet-reveal both}.meet-judging h1{font-size:56px;color:#eedcc0}.meet-judging-verdict h1,.meet-judging-verdict .meet-judge-copy{animation:meet-reveal both}.meet-judge-copy{font-size:12px;color:#ad9776;line-height:1.6;max-width:400px;margin-top:20px}.meet-flight{flex:none;background:#19130eee;border-top:1px solid #c1985a32;color:#b59d7a;font-size:10px;padding:0 32px}.meet-flight summary{display:flex;align-items:center;justify-content:space-between;gap:20px;cursor:pointer;list-style:none;min-height:42px;font-size:9px;letter-spacing:.11em}.meet-flight summary::-webkit-details-marker{display:none}.meet-flight summary>span:last-child{letter-spacing:0;font-size:10px}.meet-flight-plus{display:inline-block;margin-left:15px;font-size:16px}.meet-flight[open] .meet-flight-plus{transform:rotate(45deg)}.meet-flight table{border-collapse:collapse;width:100%;margin-bottom:18px;text-align:left}.meet-flight th,.meet-flight td{padding:9px 5px;border-bottom:1px solid #c29c5b22;font-weight:400}.meet-flight th:last-child,.meet-flight td:last-child{text-align:right}.meet-flight-player{color:#dfb77b}.meet-flight caption,.meet-attempt-grid caption,.meet-paper caption{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}.meet-finish{display:grid;grid-template-columns:minmax(260px,1fr) minmax(360px,1fr);gap:60px;max-width:1060px;width:100%;margin:auto;box-sizing:border-box;padding:44px 40px 36px;align-items:center;flex:1}.meet-finish-intro h1{font-size:66px}.meet-finish-intro>p:not(.meet-eyebrow){font-size:12px;line-height:1.7;color:#c0aa88;max-width:350px}.meet-total{display:flex;align-items:baseline;gap:14px;margin-top:25px}.meet-total strong{font-family:var(--font-display,'Arial Narrow',Impact,sans-serif);font-size:92px;line-height:1;font-weight:600;letter-spacing:-.025em;color:#f1e2c8}.meet-total>span{font-size:10px;letter-spacing:.13em;color:#d0a15c}.meet-total-note{font-size:9px!important;letter-spacing:.16em;color:#d1a65f!important;margin:9px 0 0}.meet-finish-stats{display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:280px;border-top:1px solid #cda36740;padding-top:20px;margin:25px 0 0}.meet-finish-stats dd{font-family:var(--font-display,'Arial Narrow',Impact,sans-serif);font-size:32px;line-height:1;margin:0;color:#dfcaa8}.meet-finish-stats small{font-size:14px;font-family:var(--font-body,Arial,sans-serif);color:#aa9170}.meet-why{margin-top:27px;padding-left:14px;border-left:1px solid #cca46450}.meet-why .meet-eyebrow{font-size:8px;margin-bottom:8px}.meet-why>p:not(.meet-eyebrow){font-size:10px;color:#bda382;line-height:1.6;margin:3px 0}.meet-kept{font-size:11px!important;color:#d4b583!important;border-left:1px solid #cda36750;padding-left:14px;margin-top:23px}.meet-result-panel{background:#21180fef;border:1px solid #c49b6040;padding:24px}.meet-attempt-grid table{border-collapse:collapse;width:100%;margin:16px 0 10px;font-variant-numeric:tabular-nums}.meet-attempt-grid th,.meet-attempt-grid td{text-align:right;padding:15px 6px;border-bottom:1px solid #b68c482e;font-size:12px;font-weight:400;white-space:nowrap}.meet-attempt-grid th:first-child{text-align:left;padding-left:0;font-size:9px;font-weight:600;letter-spacing:.04em}.meet-attempt-grid thead th{color:#9f815b;font-size:9px}.meet-attempt-grid th>span{display:block;margin-top:5px;font-size:7px;letter-spacing:.08em;color:#d2a768}.meet-grid-good{color:#ecddc4}.meet-grid-miss{color:#a67257;text-decoration:line-through}.meet-grid-best{color:#dfb97c;font-weight:600!important}.meet-save-status{font-size:8px;letter-spacing:.09em;line-height:1.6;color:#9d8665;margin:16px 0 18px}.meet-save-confirmed{color:#c2ae80}.meet-save-error{background:#3c241bb3;border:1px solid #ad6f443f;padding:13px;margin:17px 0;color:#ddb79a}.meet-save-error>strong{font-size:11px}.meet-save-error p{font-size:10px;line-height:1.6;margin:8px 0}.meet-save-small{color:#aa8466}.meet-error{font-size:11px!important;background:#4b291dc4;color:#e8baa0!important;padding:12px;line-height:1.6;margin:12px 0}.meet-result-actions{margin:16px 0}.meet-secondary{display:flex;justify-content:space-between;align-items:center;gap:13px;background:transparent;border:1px solid #a5824e4a;color:#d4b27d;font-size:10px!important;padding:12px;min-height:43px}.meet-secondary:hover{background:#c2984f12;border-color:#c0985b}.meet-view-sheet{width:100%;margin-bottom:10px}.meet-export-buttons{display:grid;grid-template-columns:1fr 1fr;gap:10px}.meet-export-feedback{font-size:10px;color:#b69a73;line-height:1.5;margin:10px 0}.meet-entry-error{align-items:center;justify-content:center;padding:30px;box-sizing:border-box}.meet-entry-error .meet-panel{max-width:400px}.meet-entry-error .meet-primary{margin-top:23px}.meet-sheet-overlay{margin:0;width:100%;height:100%;max-width:none;max-height:none;border:0;padding:0;position:fixed;inset:0;z-index:100;background:#18130f;display:flex;flex-direction:column;overflow:hidden;color:#2f291e}.meet-sheet-toolbar{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:18px 28px;border-bottom:1px solid #d9b07135;background:#20170f;flex:none}.meet-sheet-toolbar>span{font-size:9px;letter-spacing:.17em;color:#c1a16c}.meet-sheet-toolbar button{border:0;background:transparent;color:#e0ba7f;font-size:11px;min-height:35px;cursor:pointer}.meet-sheet-scroll{padding:25px 28px 40px;overflow:auto;flex:1;min-height:0}.meet-paper{background:#f7f1e4;color:#211d17;min-height:620px;padding:35px 35px 20px;box-sizing:border-box;max-width:1480px;margin:auto;display:flex;flex-direction:column}.meet-paper>header{border-bottom:3px double #85745a;padding:0 0 20px;text-align:center}.meet-paper>header>p{font:700 27px Georgia,serif;margin:0 0 13px}.meet-paper h2{font-size:17px;margin:0 0 18px;font-weight:600}.meet-paper header>div{display:flex;justify-content:space-between;font-size:10px;color:#665b46;gap:20px;text-align:left}.meet-paper-category{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 0 16px;font-size:11px}.meet-paper-category>span{font-size:8px;color:#746851;letter-spacing:.08em}.meet-paper-table-wrap{overflow:auto}.meet-paper table{border-collapse:collapse;font-variant-numeric:tabular-nums;width:100%;min-width:1000px;font-size:10px;color:#251f16}.meet-paper thead{background:#e8dfcc}.meet-paper th,.meet-paper td{padding:10px 4px;white-space:nowrap;text-align:center;border-bottom:1px solid #c5b89f;font-weight:400}.meet-paper thead th{font-weight:600;font-size:9px}.meet-paper thead tr:first-child th{border-top:2px solid #b5a286}.meet-paper thead tr:last-child th{border-bottom:2px solid #b5a286}.meet-paper tbody tr:nth-child(even){background:#eee6d5}.meet-paper .meet-paper-name{text-align:left;min-width:133px;padding-left:8px}.meet-paper .meet-paper-total{font-weight:700}.meet-paper-miss{color:#72624c}.meet-paper th:nth-child(5),.meet-paper td:nth-child(5),.meet-paper td:nth-child(9),.meet-paper td:nth-child(13),.meet-paper td:nth-child(17){border-left:1px solid #c5b89f}.meet-paper footer{display:flex;justify-content:space-between;gap:20px;font-size:8px;letter-spacing:.04em;color:#76664c;border-top:1px solid #bbaa8a;margin-top:auto;padding-top:14px}.meet-sheet-hint{font-size:11px;color:#b9a181;text-align:center;line-height:1.6}.meet-sheet-scroll>.meet-result-actions{max-width:420px;margin:18px auto 0}.meet-phase-lift{overflow:hidden}.meet-phase-lift .meet-lift-order{padding-block:9px}.meet-phase-walkout .meet-room{display:none}@keyframes meet-reveal{from{opacity:0}to{opacity:1}}
@media(max-width:650px){.meet-topline{padding:11px 17px;gap:10px}.meet-topline-title{display:block;min-width:0;flex:1}.meet-topline-title .meet-eyebrow{font-size:8px;letter-spacing:.12em;margin-bottom:3px}.meet-topline-title strong{display:block;font-size:9px;max-width:176px}.meet-topline-actions{gap:12px}.meet-sound{font-size:8px!important}.meet-exit{font-size:9px!important;gap:6px}.meet-exit svg{width:14px}.meet-lift-order{padding:12px 17px;gap:15px}.meet-lift-order>div{gap:7px;font-size:7px;letter-spacing:.07em}.meet-lift-order strong{font-size:8px}.meet-mini-attempts{gap:3px;margin-left:auto}.meet-mini-attempts i{width:4px;height:4px}.meet-bookend{display:flex;flex-direction:column;align-items:stretch;justify-content:flex-end;gap:0;min-height:0;padding:0 17px 22px;flex:1}.meet-room-caption{align-self:stretch;padding:32px 5px 100px}.meet-room-caption>span{font-size:8px;letter-spacing:.18em}.meet-room-caption>strong{font-size:40px;line-height:.98;margin:17px 0}.meet-room-caption p{font-size:10px;line-height:1.6;display:none}.meet-panel{padding:22px 21px;background:#21180fee}.meet-screen h1{font-size:43px}.meet-eyebrow{font-size:8px;letter-spacing:.16em;margin-bottom:13px}.meet-weigh-in h1{font-size:42px}.meet-panel>p:not(.meet-eyebrow){font-size:11px;line-height:1.55}.meet-athlete-name{margin:13px 0}.meet-weigh-facts{padding:13px 0;gap:19px}.meet-weigh-facts dt{font-size:7px;letter-spacing:.1em;margin-bottom:7px}.meet-weigh-facts dd{font-size:31px}.meet-weigh-facts small{font-size:10px}.meet-category{font-size:7px!important;letter-spacing:.09em;margin:13px 0 10px}.meet-primary{min-height:46px;font-size:10px!important;padding:13px 14px}.meet-weigh-in .meet-primary{margin-top:18px}.meet-practice-note{font-size:10px!important}.meet-openers-bookend .meet-room-caption{padding:30px 5px 61px}.meet-openers-bookend .meet-room-caption>strong{font-size:35px}.meet-openers{padding:19px 18px}.meet-openers h1{font-size:38px}.meet-openers .meet-flavour{font-size:10px!important;margin:13px 0}.meet-opener-rows{margin:17px 0 12px}.meet-opener-row{padding:11px 0;gap:8px}.meet-opener-row label strong{font-size:9px}.meet-opener-row label span{font-size:8px}.meet-stepper button{min-height:42px;width:33px;font-size:18px}.meet-stepper input{font-size:15px;width:58px}.meet-stepper>span{font-size:8px;padding:0 5px}.meet-opener-note{font-size:9px!important;line-height:1.55;margin:10px 0 15px}.meet-choice{display:block;padding:25px 18px 18px;flex:1;min-height:0}.meet-choice-heading h1{font-size:44px}.meet-choice-heading .meet-flavour{font-size:11px;line-height:1.6;margin:15px 0;max-width:none}.meet-floor{display:grid;grid-template-columns:1fr auto;gap:5px 12px;padding-top:14px}.meet-floor>span{font-size:7px;letter-spacing:.09em;align-self:center}.meet-floor>strong{grid-column:2;grid-row:1/3;font-size:33px}.meet-floor small{font-size:10px}.meet-floor>span:last-child{font-size:9px;letter-spacing:0}.meet-bomb-warning{font-size:10px;margin:13px 0 0}.meet-options{gap:10px;margin-top:20px}.meet-option{padding:17px 12px;min-height:300px}.meet-option-label{font-size:8px;letter-spacing:.08em}.meet-option>strong{font-size:42px;margin:17px 0 6px}.meet-option small{font-size:10px}.meet-option-delta{font-size:8px;line-height:1.45;min-height:23px}.meet-option>p{font-size:10px;line-height:1.55;margin:11px 0;min-height:61px}.meet-pr-note{font-size:9px!important}.meet-stakes{font-size:9px;line-height:1.5;padding-top:8px;margin-bottom:16px}.meet-stakes li{margin:4px 0}.meet-option-action{font-size:8px;padding-top:12px;gap:5px;line-height:1.5}.meet-option-action svg{width:15px;flex:none}.meet-walkout{min-height:0}.meet-platform-call{margin-top:22px;padding:17px 20px;min-width:214px}.meet-platform-call h1{font-size:76px}.meet-platform-call .meet-eyebrow{font-size:8px}.meet-platform-call>span{font-size:8px;letter-spacing:.16em;margin-top:14px}.meet-walkout-bottom{left:18px;right:18px;bottom:20px;font-size:8px;letter-spacing:.05em}.meet-judging{min-height:0;padding:30px 18px}.meet-lamps{gap:15px;margin:28px 0 31px}.meet-lamp{width:65px;height:65px}.meet-lamp i{width:47px;height:47px}.meet-judging h1{font-size:44px}.meet-judge-copy{font-size:11px;max-width:300px;line-height:1.6;margin-top:18px}.meet-flight{padding:0 18px}.meet-flight summary{min-height:43px;font-size:8px;letter-spacing:.08em}.meet-flight summary>span:last-child{font-size:9px}.meet-flight th,.meet-flight td{padding:9px 2px;font-size:10px}.meet-finish{display:block;padding:25px 17px 22px;flex:1}.meet-finish-intro h1{font-size:45px;line-height:.94}.meet-finish-intro>.meet-eyebrow{margin-bottom:12px}.meet-total{margin-top:20px;gap:12px}.meet-total strong{font-size:75px}.meet-total>span{font-size:9px;letter-spacing:.09em}.meet-total-note{font-size:8px!important;margin:6px 0 0}.meet-finish-stats{border-top:0;display:flex;gap:26px;margin:17px 0 0;padding:0}.meet-finish-stats dt{font-size:7px;margin-bottom:5px}.meet-finish-stats dd{font-size:25px}.meet-finish-stats small{font-size:11px}.meet-why{margin-top:18px;padding-left:10px}.meet-why .meet-eyebrow{font-size:7px;margin-bottom:6px}.meet-why>p:not(.meet-eyebrow){font-size:9px;line-height:1.5;margin:2px 0}.meet-result-panel{padding:18px 15px;margin-top:25px}.meet-attempt-grid .meet-eyebrow{margin:0;font-size:8px}.meet-attempt-grid table{margin:10px 0}.meet-attempt-grid th,.meet-attempt-grid td{padding:12px 4px;font-size:11px}.meet-attempt-grid th:first-child{font-size:8px}.meet-attempt-grid thead th{font-size:8px}.meet-attempt-grid th>span{font-size:6px;margin-top:4px}.meet-save-status{font-size:7px;margin:13px 0 15px;letter-spacing:.06em}.meet-result-actions{margin:13px 0}.meet-secondary{font-size:9px!important;padding:11px 10px;gap:7px}.meet-export-buttons{gap:8px}.meet-export-feedback{font-size:9px;margin:8px 0}.meet-save-error{padding:11px;margin:13px 0}.meet-save-error>strong{font-size:10px}.meet-save-error p{font-size:9px}.meet-finish-intro>p:not(.meet-eyebrow){font-size:11px;line-height:1.7;max-width:none}.meet-kept{font-size:10px!important;margin-top:15px}.meet-sheet-toolbar{padding:12px 17px}.meet-sheet-toolbar>span{font-size:8px}.meet-sheet-toolbar button{font-size:10px}.meet-sheet-scroll{padding:17px 12px 28px}.meet-paper{padding:23px 18px 17px;min-height:480px}.meet-paper>header>p{font-size:21px}.meet-paper h2{font-size:14px;line-height:1.4;margin-bottom:15px}.meet-paper header>div{font-size:8px;line-height:1.5;gap:14px}.meet-paper-category{display:block;font-size:9px;line-height:1.5;padding:16px 0 12px}.meet-paper-category>span{display:block;margin-top:5px;font-size:7px}.meet-paper footer{display:block;font-size:7px;line-height:1.7;margin-top:90px}.meet-paper footer>span{display:block}.meet-sheet-hint{font-size:10px}.meet-sheet-scroll>.meet-result-actions{margin-top:16px}.meet-phase-lift .meet-topline{padding-block:10px}.meet-phase-lift .meet-lift-order{padding-block:9px}}
@media(max-height:740px) and (max-width:650px){.meet-room-caption{padding-bottom:35px;padding-top:20px}.meet-room-caption>strong{font-size:31px;margin:12px 0}.meet-openers-bookend .meet-room-caption{padding-bottom:24px;padding-top:18px}.meet-openers-bookend .meet-room-caption>strong{font-size:29px}.meet-panel{padding:19px}.meet-weigh-in h1{font-size:38px}}

@media(max-width:650px){
.meet-bookend{position:relative;padding-bottom:18px}.meet-room-caption{position:absolute;left:22px;right:22px;top:28px;padding:0;z-index:-1}.meet-openers-bookend .meet-room-caption{padding:0}.meet-panel{padding:19px 20px}.meet-weigh-in h1{font-size:38px}.meet-weigh-in h1 br,.meet-openers h1 br,.meet-choice-heading h1 br,.meet-finish-intro h1 br{display:none}.meet-weigh-in h1 em:before,.meet-openers h1 em:before,.meet-choice-heading h1 em:before,.meet-finish-intro h1 em:before{content:' '}.meet-weigh-in .meet-athlete-name{margin:10px 0 8px}.meet-weigh-in .meet-category{margin:10px 0 8px}.meet-weigh-in .meet-flavour{margin:10px 0 0;font-size:10px!important;line-height:1.6}.meet-weigh-in .meet-primary{margin-top:14px}.meet-weigh-in .meet-practice-note{margin:8px 0 0;font-size:9px!important;line-height:1.5}.meet-openers{padding:18px}.meet-openers .meet-eyebrow{margin-bottom:8px}.meet-openers h1{font-size:35px}.meet-openers .meet-flavour{margin:10px 0;font-size:10px!important}.meet-opener-rows{margin:12px 0 14px}.meet-opener-row{padding:4px 0}.meet-opener-note{display:none}.meet-choice-heading h1{font-size:36px}.meet-choice-heading .meet-eyebrow{margin-bottom:9px}.meet-choice-heading .meet-flavour{font-size:10px;margin:12px 0;line-height:1.5}.meet-choice{padding-top:21px}.meet-options{margin-top:16px}.meet-option{min-height:0;padding:16px 12px}.meet-option>strong{margin-top:14px;font-size:41px}.meet-option>p{min-height:48px;margin:10px 0;font-size:10px;line-height:1.5}.meet-stakes{font-size:9px;line-height:1.5;margin-bottom:13px}.meet-option-delta{min-height:20px}.meet-bomb-warning{font-size:9px;line-height:1.5;margin-top:11px}.meet-finish-intro{position:relative}.meet-finish-intro h1{font-size:36px}.meet-finish-intro .meet-total{margin-top:16px;gap:8px;max-width:210px}.meet-finish-intro .meet-total strong{font-size:65px}.meet-finish-intro .meet-total>span{font-size:8px;letter-spacing:.05em}.meet-finish-intro .meet-finish-stats{position:absolute;right:0;top:87px;gap:17px;margin:0}.meet-finish-intro .meet-finish-stats dt{font-size:7px}.meet-finish-intro .meet-finish-stats dd{font-size:23px}.meet-finish-intro .meet-finish-stats small{font-size:10px}.meet-finish-intro .meet-practice-note{margin:10px 0 0;font-size:9px;line-height:1.5}.meet-finish-intro .meet-why{margin-top:16px}.meet-result-panel{margin-top:19px;padding:17px 14px}.meet-result-panel .meet-result-actions{display:grid;grid-template-columns:1fr 2.15fr;gap:7px;margin:12px 0}.meet-result-panel .meet-view-sheet{margin:0;height:44px}.meet-result-panel .meet-export-buttons{gap:7px}.meet-result-panel .meet-secondary{font-size:8px!important;padding:10px 8px;gap:5px;min-width:0}.meet-result-panel .meet-secondary svg{width:14px;flex:none}.meet-result-panel .meet-export-feedback{grid-column:1/-1;margin:0}.meet-result-panel .meet-primary{position:sticky;bottom:0}.meet-attempt-grid th,.meet-attempt-grid td{padding-block:11px}.meet-finish-intro .meet-kept{font-size:10px!important}.meet-finish-intro>p:not(.meet-eyebrow){font-size:10px}
}
@media(max-height:740px) and (max-width:650px){.meet-room-caption{top:18px}.meet-room-caption>strong{font-size:29px}.meet-openers-bookend .meet-room-caption>strong{font-size:28px}.meet-openers-bookend .meet-room-caption{top:18px}}

@media(prefers-reduced-motion:reduce){.meet-lamp-white,.meet-lamp-red,.meet-judging-verdict h1,.meet-judging-verdict .meet-judge-copy{animation:none}}
`;

export default Meet;
