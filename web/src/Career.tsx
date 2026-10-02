import './gameplay.css';
import { useMemo, useRef, useState } from 'react';
import type { CareerServerPort, CareerServerResponse } from '../../src/game/careerClient';
import { careerLifterFromCache } from '../../src/game/careerClient';
import { meetDefinitionFor } from '../../src/game/careerMeet';
import { federationName } from '../../src/game/lifterEntry';
import type { LifterServerPort } from '../../src/game/lifterClient';
import type { MeetDefinition } from '../../src/game/meetTuning';
import { openingCache } from '../../src/game/sessionClient';
import { careerCalendarRows } from '../../src/meet/careerSurface';
import { useCareer } from '../../src/meet/useCareer';
import type { CareerFederationId } from '../../src/career/careerTuning';
import { formatWeight } from '../../src/game/resultCard';
import { asStreakDay, streakDayFromLocalWallClock } from '../../src/game/streak';

export type CareerPort = CareerServerPort & Partial<Pick<LifterServerPort, 'openingProfile'>> & { readonly currentServerDay?: () => number };

export interface CareerProps {
  port: CareerPort;
  onMeet: (meet: MeetDefinition) => void | Promise<void>;
  onExit?: () => void;
}

function today() {
  const clock = new Date();
  return streakDayFromLocalWallClock({
    year: clock.getFullYear(), month: clock.getMonth() + 1,
    day: clock.getDate(), hour: clock.getHours(),
  });
}

function calendarDate(iso: string): { day: string; month: string; full: string } {
  const date = new Date(`${iso}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return { day: '—', month: '', full: iso };
  return {
    day: date.toLocaleDateString('en', { day: '2-digit', timeZone: 'UTC' }),
    month: date.toLocaleDateString('en', { month: 'short', timeZone: 'UTC' }),
    full: date.toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
  };
}

function Arrow() {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" /></svg>;
}

export function Career(props: CareerProps) {
  const [revision, setRevision] = useState(0);
  return <CareerCalendar key={revision} {...props} onRefresh={() => setRevision((value) => value + 1)} />;
}

function CareerCalendar({ port, onMeet, onExit, onRefresh }: CareerProps & { onRefresh: () => void }) {
  const [transportError, setTransportError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [selected, setSelected] = useState<CareerFederationId | null>(null);
  const [entering, setEntering] = useState<string | null>(null);
  const [entryError, setEntryError] = useState<{ meetId: string; message: string } | null>(null);
  const retryRef = useRef<(() => void) | null>(null);
  const flightRef = useRef<Promise<CareerServerResponse> | null>(null);
  const entryRef = useRef(false);

  // A transport failure leaves the original proposal pending. A deliberate
  // retry sends the same proposal rather than asking the hook to choose twice.
  const reliablePort = useMemo<CareerServerPort>(() => ({
    openingSnapshot: () => port.openingSnapshot(),
    chooseFederation: (proposal, id) => {
      if (flightRef.current !== null) return flightRef.current;
      const flight = new Promise<CareerServerResponse>((resolve) => {
        let busy = false;
        let settled = false;
        const send = async () => {
          if (busy || settled) return;
          busy = true;
          setRetrying(true);
          setTransportError(null);
          try {
            const response = await port.chooseFederation(proposal, id);
            settled = true;
            retryRef.current = null;
            flightRef.current = null;
            setRetrying(false);
            resolve(response);
          } catch {
            setTransportError('We could not confirm your federation. Your choice is still waiting to be saved.');
            setRetrying(false);
          } finally {
            busy = false;
          }
        };
        retryRef.current = () => { void send(); };
        void send();
      });
      flightRef.current = flight;
      return flight;
    },
  }), [port]);

  const loop = useCareer(reliablePort, true, port.currentServerDay);
  const lifter = careerLifterFromCache(loop.cache);
  const profile = port.openingProfile?.();
  const best = lifter?.bestTotalKg;
  const federation = lifter === null ? null : federationName(lifter.federationId);
  const available = loop.rows?.find((row) => row.enterable);

  const enter = async (meetId: string) => {
    if (entryRef.current) return;
    entryRef.current = true;
    setEntering(meetId);
    setEntryError(null);
    try {
      // Read the current snapshot again at entry, through the same eligibility
      // read model that built the calendar. No second gate is authored here.
      const current = careerCalendarRows(openingCache(port), port.currentServerDay === undefined ? today() : asStreakDay(port.currentServerDay()))?.find((row) => row.meet.id === meetId);
      if (!current?.enterable) {
        setEntryError({ meetId, message: current?.detail ?? 'The calendar changed. Refresh it to see the next meet.' });
        return;
      }
      await onMeet(meetDefinitionFor(current.meet));
    } catch (error) {
      setEntryError({ meetId, message: error instanceof Error ? error.message : 'The meet could not be opened. Please try again.' });
    } finally {
      entryRef.current = false;
      setEntering(null);
    }
  };

  return <section className="career-screen" aria-label="Your powerlifting career">
    
    <div className="career-room" aria-hidden="true" />
    <header className="career-topline">
      <span className="career-brand">CAREER <span>/</span> THREE WHITE LIGHTS</span>
      {onExit && <button className="career-back" onClick={onExit}>Back to training <Arrow /></button>}
    </header>
    <div className="career-content">
      <div className="career-heading">
        <div>
          <p className="career-eyebrow">{loop.phase === 'choosing' ? 'CHOOSE YOUR FEDERATION' : 'THE COMPETITION CALENDAR'}</p>
          <h1>{loop.phase === 'choosing' ? <>Your name.<br /><em>Your platform.</em></> : <>A total<br /><em>worth chasing.</em></>}</h1>
          <p className="career-intro">{loop.phase === 'choosing'
            ? 'Choose the rules you lift under. Then train, put a total on the board, and earn your way to the next meet.'
            : `${profile?.name ? `${profile.name}. ` : ''}One platform at a time. Your competition total opens the way forward.`}</p>
        </div>
        {loop.phase === 'calendar' && <aside className="career-athlete" aria-label="Your competition standing">
          <p className="career-eyebrow">BEST COMPETITION TOTAL</p>
          <strong>{best == null ? '—' : formatWeight(best)}<small>{best == null ? '' : 'kg'}</small></strong>
          <p>{best == null ? 'Your first total is waiting.' : 'Earned on the platform.'}</p>
          {federation && <span>{federation}</span>}
        </aside>}
      </div>

      {(transportError || loop.refusal) && <div className="career-error" role="alert">
        <p>{transportError ?? loop.refusal}</p>
        {transportError && <button onClick={() => retryRef.current?.()} disabled={retrying}>{retrying ? 'Connecting…' : 'Retry saving choice'} <Arrow /></button>}
      </div>}

      {loop.phase === 'choosing' ? <div className="career-federations" aria-label="Federations">
        {loop.options.map((option, index) => <button
          className={`career-federation ${selected === option.id ? 'career-selected' : ''}`}
          key={option.id}
          disabled={loop.inFlight}
          onClick={() => { setSelected(option.id); loop.choose(option.id); }}
          aria-label={`Choose ${option.name}, ${option.rulesetText}`}
        >
          <span className="career-choice-index">0{index + 1}</span>
          <span className="career-choice-rules">{option.rulesetText}</span>
          <strong>{option.name}</strong>
          <span className="career-choice-action">{loop.inFlight && selected === option.id ? 'Saving your choice…' : 'Lift under these rules'} <Arrow /></span>
        </button>)}
        <p className="career-choice-note">Your federation sets the equipment and testing category. Competition results keep the choice on your record.</p>
      </div> : <>
        <div className="career-calendar-label"><span>THE ROAD AHEAD</span><span>{loop.rows?.length ?? 0} COMPETITION TIERS</span></div>
        {loop.rows === null ? <div className="career-empty" role="status"><h2>Your calendar is waiting.</h2><p>We have not received your competition record yet.</p><button className="career-enter" onClick={onRefresh}>Refresh record <Arrow /></button></div>
          : loop.rows.length === 0 ? <div className="career-empty"><h2>No meets in this window.</h2><p>Refresh the calendar to check the next competition dates.</p><button className="career-enter" onClick={onRefresh}>Refresh calendar <Arrow /></button></div>
          : <div className="career-calendar">{loop.rows.map((row, index) => {
            const date = calendarDate(row.dateIso);
            return <article className={`career-event ${row.enterable ? 'career-event-open' : ''} ${row.locked ? 'career-event-ceiling' : ''}`} key={row.meet.id}>
              <div className="career-event-date" aria-label={date.full}><strong>{date.day}</strong><span>{date.month}</span></div>
              <div className="career-event-info">
                <p className="career-event-tier"><span>0{index + 1}</span> {row.tierLabel}{row.badge && <span className="career-badge">{row.badge}</span>}</p>
                <h2>{row.meetName}</h2>
                <p className="career-event-gate">{row.qualifyingLine}</p>
                {row.detail && <p className="career-event-detail">{row.detail}</p>}
              </div>
              {row.enterable ? <button className="career-enter" onClick={() => { void enter(row.meet.id); }} disabled={entering !== null} aria-label={`Enter ${row.meetName} on ${date.full}`} aria-describedby={entryError?.meetId === row.meet.id ? `entry-error-${row.meet.id}` : undefined}>
                {entering === row.meet.id ? 'Opening meet…' : 'Enter meet'} <Arrow />
              </button> : <span className="career-lock" aria-label="Meet unavailable"><svg aria-hidden="true" width="20" height="22" viewBox="0 0 24 24" fill="none"><rect x="5" y="10" width="14" height="11" rx="1" stroke="currentColor" strokeWidth="1.5" /><path d="M8 10V6a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="1.5" /></svg></span>}
              {entryError?.meetId === row.meet.id ? <div className="career-error career-entry-feedback" id={`entry-error-${row.meet.id}`} role="alert"><p>{entryError.message}</p><button onClick={onRefresh}>Refresh calendar <Arrow /></button></div> : null}
            </article>;
          })}</div>}
        <footer className="career-footer"><span>{available ? 'YOUR NEXT PLATFORM IS OPEN.' : 'YOUR NEXT TOTAL CHANGES THE CALENDAR.'}</span><p>Best successful squat + bench + deadlift. Nine attempts. One total.</p></footer>
      </>}
    </div>
  </section>;
}



export default Career;
