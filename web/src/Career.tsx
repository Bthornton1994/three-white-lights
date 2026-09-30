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
import { streakDayFromLocalWallClock } from '../../src/game/streak';

export type CareerPort = CareerServerPort & Partial<Pick<LifterServerPort, 'openingProfile'>>;

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
  const [entryError, setEntryError] = useState<string | null>(null);
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

  const loop = useCareer(reliablePort, true);
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
      const current = careerCalendarRows(openingCache(port), today())?.find((row) => row.meet.id === meetId);
      if (!current?.enterable) {
        setEntryError(current?.detail ?? 'The calendar changed. Refresh it to see the next meet.');
        return;
      }
      await onMeet(meetDefinitionFor(current.meet));
    } catch (error) {
      setEntryError(error instanceof Error ? error.message : 'The meet could not be opened. Please try again.');
    } finally {
      entryRef.current = false;
      setEntering(null);
    }
  };

  return <section className="career-screen" aria-label="Your powerlifting career">
    <style>{CAREER_STYLES}</style>
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
        {entryError && <div className="career-error" role="alert"><p>{entryError}</p><button onClick={onRefresh}>Refresh calendar <Arrow /></button></div>}
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
              {row.enterable ? <button className="career-enter" onClick={() => { void enter(row.meet.id); }} disabled={entering !== null} aria-label={`Enter ${row.meetName} on ${date.full}`}>
                {entering === row.meet.id ? 'Opening meet…' : 'Enter meet'} <Arrow />
              </button> : <span className="career-lock" aria-label="Meet unavailable"><svg aria-hidden="true" width="20" height="22" viewBox="0 0 24 24" fill="none"><rect x="5" y="10" width="14" height="11" rx="1" stroke="currentColor" strokeWidth="1.5" /><path d="M8 10V6a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="1.5" /></svg></span>}
            </article>;
          })}</div>}
        <footer className="career-footer"><span>{available ? 'YOUR NEXT PLATFORM IS OPEN.' : 'YOUR NEXT TOTAL CHANGES THE CALENDAR.'}</span><p>Best successful squat + bench + deadlift. Nine attempts. One total.</p></footer>
      </>}
    </div>
  </section>;
}

const CAREER_STYLES = `
.career-screen{position:relative;isolation:isolate;min-height:100%;background:#17130f;color:#f5ecdb;overflow:auto;font-family:var(--font-body,Arial,sans-serif)}
.career-room{position:absolute;inset:0;z-index:-2;background:linear-gradient(90deg,rgba(18,14,10,.97),rgba(18,14,10,.78)),url('/rooms/meet-empty.jpg') center/cover no-repeat;pointer-events:none}
.career-screen button{font:inherit;cursor:pointer}.career-screen button:disabled{cursor:wait;opacity:.62}.career-screen button:focus-visible{outline:3px solid #efc173;outline-offset:4px}.career-topline{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:24px 38px;border-bottom:1px solid #f6d9a520}.career-brand{font-size:10px;letter-spacing:.15em;color:#bcb09d;font-weight:700}.career-brand span{padding:0 8px;color:#b17d3f}.career-back{display:flex;align-items:center;gap:12px;background:transparent;border:0;color:#dacbb4;font-size:11px!important}.career-content{max-width:1150px;margin:auto;padding:42px 38px 32px}.career-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:32px;margin-bottom:40px}.career-eyebrow{font-size:10px;letter-spacing:.22em;color:#d2a05b;margin:0 0 15px;font-weight:700}.career-heading h1{font-family:var(--font-display,'Arial Narrow',Impact,sans-serif);font-weight:800;letter-spacing:-.035em;font-size:clamp(46px,6.3vw,78px);line-height:.96;text-transform:uppercase;margin:0}.career-heading h1 em{font-style:normal;color:#d4a55e}.career-intro{color:#baad9a;font-size:13px;line-height:1.6;max-width:390px;margin:18px 0 0}.career-athlete{min-width:235px;padding:18px 0 8px 30px;border-left:1px solid #b7955c45}.career-athlete strong{font-family:var(--font-display,'Arial Narrow',Impact,sans-serif);font-weight:700;font-size:58px;line-height:1}.career-athlete small{font-family:var(--font-body,Arial,sans-serif);font-weight:400;font-size:14px;padding-left:9px;color:#baa991}.career-athlete>p:not(.career-eyebrow){color:#b8aa94;font-size:12px;margin:7px 0 18px}.career-athlete>span{font-size:10px;color:#d5c4aa;text-transform:uppercase;letter-spacing:.13em}.career-calendar-label{display:flex;justify-content:space-between;gap:20px;color:#a39480;font-size:9px;letter-spacing:.16em;font-weight:700;padding:0 0 14px;border-bottom:1px solid #f6d9a530}.career-calendar{display:grid;gap:0}.career-event{display:flex;align-items:center;gap:23px;padding:20px 16px 20px 0;border-bottom:1px solid #f6d9a522;min-width:0}.career-event-open{background:linear-gradient(90deg,#c18d4020,transparent 85%);border-left:2px solid #d4a55e;padding-left:18px;margin-top:12px;border-top:1px solid #d4a55e42;border-bottom-color:#d4a55e42}.career-event-date{width:52px;flex:none;display:flex;flex-direction:column;text-align:center}.career-event-date strong{font-family:var(--font-display,'Arial Narrow',Impact,sans-serif);font-size:36px;line-height:1;font-weight:600;color:#ecdfc9}.career-event-date span{font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:#a59681;margin-top:5px}.career-event-info{flex:1;min-width:0}.career-event-tier{font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:#b9a88e;margin:0 0 7px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.career-event-tier>span:first-child{color:#826b4e}.career-badge{font-size:8px;border:1px solid #d2a05b65;color:#ddb574;padding:3px 6px;letter-spacing:.12em}.career-event h2{font-size:16px;font-weight:600;letter-spacing:-.02em;line-height:1.25;margin:0 0 5px}.career-event-gate{font-size:11px;color:#aa9b84;margin:0;line-height:1.5}.career-event-detail{font-size:11px;color:#a38c73;line-height:1.5;margin:5px 0 0}.career-enter{display:flex;align-items:center;justify-content:space-between;gap:18px;flex:none;background:#d4a55e;border:1px solid #e7c181;padding:13px 17px;color:#21170f;font-size:11px!important;font-weight:700!important;min-height:44px}.career-lock{display:flex;justify-content:center;align-items:center;width:44px;color:#76664f}.career-event-ceiling{opacity:.74}.career-footer{display:flex;justify-content:space-between;gap:18px;align-items:center;margin-top:24px}.career-footer>span{font-size:9px;letter-spacing:.12em;color:#c09557}.career-footer p{color:#857865;font-size:10px;line-height:1.5;margin:0}.career-error{border:1px solid #b0755660;background:#3e261dc0;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:18px}.career-error p{font-size:12px;line-height:1.5;margin:0;color:#f1ceb6}.career-error button{display:flex;align-items:center;gap:14px;flex:none;border:1px solid #dfad74;background:transparent;color:#edc28d;font-size:11px;padding:10px 12px;min-height:44px}.career-empty{padding:32px 0}.career-empty h2{font-size:25px}.career-empty p{font-size:13px;color:#c4b399}.career-federations{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.career-federation{text-align:left;border:1px solid #bba17340;background:#282016c0;color:#f5ecdb;padding:22px 18px;display:flex;flex-direction:column;min-height:236px;transition:background .2s,border-color .2s}.career-federation:hover,.career-selected{border-color:#d4a55e;background:#503719}.career-choice-index{color:#a47c46;font-size:11px;letter-spacing:.1em;margin-bottom:33px}.career-choice-rules{font-size:9px;letter-spacing:.1em;color:#d4a55e;margin-bottom:10px}.career-federation strong{font-family:var(--font-display,'Arial Narrow',Impact,sans-serif);font-size:28px;line-height:1.05;font-weight:600;min-height:62px}.career-choice-action{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:10px;line-height:1.4;color:#b8a48b;margin-top:22px}.career-choice-note{grid-column:1/-1;color:#9e8e76;font-size:11px;line-height:1.6;margin:10px 0 0}
@media(max-width:650px){.career-topline{padding:18px 20px;gap:10px}.career-brand{font-size:8px;letter-spacing:.12em}.career-brand span{padding:0 4px}.career-back{font-size:10px!important;gap:7px}.career-back svg{width:15px}.career-content{padding:28px 20px 26px}.career-heading{display:block;margin-bottom:27px}.career-heading h1{font-size:49px;line-height:.96}.career-eyebrow{font-size:9px;margin-bottom:13px}.career-intro{font-size:12px;line-height:1.55;margin-top:14px;max-width:310px}.career-athlete{border-left:0;border-top:1px solid #b7955c30;min-width:0;padding:14px 0 0;margin-top:22px;display:grid;grid-template-columns:1fr auto;gap:4px 14px}.career-athlete .career-eyebrow{grid-column:1;margin:0;align-self:end;font-size:8px}.career-athlete strong{grid-column:2;grid-row:1/4;font-size:43px;align-self:center}.career-athlete small{font-size:12px;padding-left:5px}.career-athlete>p:not(.career-eyebrow){margin:3px 0;font-size:10px}.career-athlete>span{font-size:8px;letter-spacing:.09em}.career-calendar-label{font-size:8px;letter-spacing:.13em}.career-event{gap:14px;padding:16px 4px 16px 0;flex-wrap:wrap;position:relative}.career-event-open{padding:16px 12px;margin-top:10px}.career-event-date{width:38px}.career-event-date strong{font-size:31px}.career-event-date span{font-size:8px}.career-event-info{min-width:calc(100% - 70px)}.career-event h2{font-size:14px;padding-right:16px}.career-event-tier{font-size:8px;gap:8px;margin-bottom:6px}.career-event-gate,.career-event-detail{font-size:10px;line-height:1.5}.career-badge{font-size:7px;padding:2px 5px}.career-event .career-enter{margin-left:52px;width:calc(100% - 52px);padding:11px 14px;font-size:10px!important}.career-lock{position:absolute;right:0;top:38px;width:26px}.career-lock svg{width:15px}.career-footer{display:block;margin-top:20px}.career-footer>span{font-size:8px}.career-footer p{margin-top:9px;font-size:9px}.career-error{display:block;padding:12px}.career-error p{font-size:11px}.career-error button{margin-top:10px;width:100%;justify-content:space-between}.career-federations{grid-template-columns:repeat(2,1fr);gap:10px}.career-federation{padding:17px 14px;min-height:203px}.career-choice-index{margin-bottom:24px;font-size:9px}.career-choice-rules{font-size:8px}.career-federation strong{font-size:25px;min-height:52px}.career-choice-action{font-size:9px;margin-top:18px}.career-choice-note{font-size:10px}}
@media(prefers-reduced-motion:reduce){.career-federation{transition:none}}
`;

export default Career;
