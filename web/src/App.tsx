import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, Dumbbell, Home, ShoppingCart, Users, Trophy, Settings, UserRound, LogOut, ShieldCheck, ChevronLeft, Check } from 'lucide-react';
import { localSessionServer, type LocalAppServerPort } from '../../src/session/localSessionServer';
import type { MeetDefinition } from '../../src/game/meetTuning';
import type { LifterDraft } from '../../src/game/lifterProfile';
import { CAREER_FEDERATIONS, type CareerFederationId } from '../../src/career/careerTuning';
import { createProductionClient, type ProductionClient } from '../../src/production/client';
import { Gym, type GymPage } from './Gym';
import { practiceFacility, type FacilityPort } from './facilityPort';
import { Training } from './Training';
import { Career } from './Career';
import { Meet } from './Meet';
import { INTERFACE_TUNING as UI } from './interfaceTuning';
import { LIFTER_IDENTITY } from '../../src/career/careerTuning';

function saveSoundPreference(value: string) { try { localStorage.setItem('twl:preference:sound', value); } catch { /* Keep controls available with blocked device storage. */ } }

type Page = GymPage | 'train' | 'career' | 'meet' | 'settings' | 'account' | 'profile';
const nav = [{ page: 'gym', label: 'Gym', icon: Home }, { page: 'train', label: 'Train', icon: Dumbbell }, { page: 'career', label: 'Career', icon: Trophy }, { page: 'shop', label: 'Shop', icon: ShoppingCart }, { page: 'staff', label: 'Staff', icon: Users }] as const;
const allowedPages = new Set(['gym', 'shop', 'staff', 'train', 'build', 'career', 'settings', 'account', 'profile']);
function pageFromHash(): Page { const p = window.location.hash.slice(1); return allowedPages.has(p) ? p as Page : 'gym'; }

function freshPractice() { return { port: localSessionServer({ latencyMs: 0 }), facility: practiceFacility() }; }
function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={'brand' + (compact ? ' compact' : '')} aria-label="Three White Lights"><div className="brand-lights" aria-hidden="true"><i /><i /><i /></div><span>THREE WHITE LIGHTS</span></div>;
}

function Profile({ port, onDone, onCancel, practice }: { port: LocalAppServerPort; onDone: () => void; onCancel: () => void; practice: boolean }) {
  const profile = port.openingProfile();
  const [name, setName] = useState(profile?.name ?? '');
  const [bodyweight, setBodyweight] = useState(profile ? String(profile.bodyweight.kilograms) : '');
  const [sex, setSex] = useState<'male' | 'female'>(profile?.sex ?? 'male');
  const [federation, setFederation] = useState<CareerFederationId>(port.openingSnapshot().federation.id as CareerFederationId);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      if (profile) {
        const renamed = await port.editProfileName(name);
        if (renamed.kind === 'refused') { setError(renamed.detail); return; }
        const weighed = await port.editProfileBodyweight(bodyweight);
        if (weighed.kind === 'refused') { setError(weighed.detail); return; }
      } else {
        const draft: LifterDraft = { name, sex, bodyweightKgText: bodyweight };
        const result = await port.createProfile(draft, federation);
        if (result.kind === 'refused') { setError(result.detail); return; }
      }
      onDone();
    } catch { setError('Your lifter could not be saved. Check your connection and try again.'); }
    finally { setBusy(false); }
  }
  return <section className="form-screen"><div className="form-art"><img src="/rooms/gym-briefing.jpg" alt="A competition bench in the warm brick gym" /><div><p className="eyebrow">A PLACE ON THE PLATFORM</p><h1>Your story<br />starts here.</h1><p>Squat. Bench. Deadlift.<br />One lifter. A lifetime of progress.</p></div></div><form className="form-card" onSubmit={save}><button className="text-button back" type="button" onClick={onCancel}><ChevronLeft size={UI.ICON_MEDIUM} />Back</button><p className="eyebrow">{practice ? 'PRACTICE LIFTER' : 'YOUR ATHLETE'}</p><h2>{profile ? 'Athlete profile' : 'Create your lifter'}</h2><p>Your name appears on result cards. Bodyweight and sex determine your competition class and DOTS score.</p><label>Platform name<input autoComplete="nickname" maxLength={LIFTER_IDENTITY.NAME_MAX_CHARS} required value={name} onChange={e => setName(e.target.value)} placeholder="Your name" /></label><div className="field-row"><label>Bodyweight (kg)<input type="text" inputMode="decimal" required value={bodyweight} onChange={e => setBodyweight(e.target.value)} placeholder="83.0" /></label><label>Competition sex<select value={sex} onChange={e => setSex(e.target.value as 'male' | 'female')} disabled={!!profile}><option value="male">Male</option><option value="female">Female</option></select></label></div>{!profile && <><label>Federation<select value={federation} onChange={e => setFederation(e.target.value as CareerFederationId)}>{CAREER_FEDERATIONS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><p className="small-copy">Federations are fictional. Equipment and testing rules shape your career calendar.</p></>}{error && <p className="notice error" role="alert">{error}</p>}<button className="primary" disabled={busy} type="submit">{busy ? 'Saving…' : profile ? 'Save profile' : 'Create lifter'}<ArrowRight size={UI.ICON_ACTION} /></button>{practice && <p className="quiet-note">This practice lifter resets when you reload. Sign in to build a saved career.</p>}</form></section>;
}

function Account({ client, onDone, onBack, configError }: { client: ProductionClient | null; onDone: () => void; onBack: () => void; configError: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!client || busy) return; setBusy(true); setError('');
    try {
      await client.signIn(email, password);
      onDone();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign in could not be completed. Try again.'); }
    finally { setBusy(false); }
  }
  return <section className="form-screen"><div className="form-art"><img src="/rooms/gym-briefing.jpg" alt="Amber light falling across the gym" /><div><Brand /><h1>Earn every rep.<br />Keep every win.</h1><p>Your lifter, gym, and meet results.<br />Ready wherever you train.</p></div></div><form className="form-card account-form" onSubmit={submit}><button className="text-button back" type="button" onClick={onBack}><ChevronLeft size={UI.ICON_MEDIUM} />Back to gym</button><p className="eyebrow">CLOSED BETA</p><h2>Welcome back</h2><p>Sign in with your invited account to save your career.</p><label>Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label><label>Password<input type="password" autoComplete="current-password" minLength={1} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" /></label>{configError && <p className="notice error" role="alert">{configError}</p>}{error && <p className="notice error" role="alert">{error}</p>}<button className="primary" disabled={busy || !client} type="submit">{busy ? 'Connecting…' : 'Sign in'}<ArrowRight size={UI.ICON_ACTION} /></button><div className="account-note"><ShieldCheck size={UI.ICON_MEDIUM} /><span>Invited accounts can save progress. Practice remains separate.</span></div></form></section>;
}

export function App() {
  const [page, setPage] = useState<Page>(pageFromHash);
  const [practiceState, setPracticeState] = useState(freshPractice);
  const [client, setClient] = useState<ProductionClient | null>(null);
  const [ready, setReady] = useState(false);
  const [configError, setConfigError] = useState('');
  const [, setRevision] = useState(0);
  const [meet, setMeet] = useState<MeetDefinition | null>(null);
  const [restartPrompt, setRestartPrompt] = useState(false);
  const [sound, setSound] = useState(() => { try { return localStorage.getItem('twl:preference:sound') !== 'off'; } catch { return true; } });
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const main = useRef<HTMLElement>(null);
  const accountId = useRef<string | null>(null);
  const practice = !client?.user;
  const port = practice ? practiceState.port : client!.port;
  const facility: FacilityPort = practice ? practiceState.facility : client!.port;
  const snapshot = port.openingSnapshot();
  const profile = port.openingProfile();
  useEffect(() => {
    let active = true, unsubscribe: (() => void) | undefined;
    createProductionClient().then(result => {
      if (!active) return;
      setClient(result); accountId.current = result?.user?.id ?? null; if (!result) setConfigError('Saved play is unavailable in this build. You can still explore the practice gym.');
      unsubscribe = result?.subscribe(() => { if (active) {
        const nextId = result.user?.id ?? null;
        if (accountId.current !== nextId) { setMeet(null); accountId.current = nextId; }
        setRevision(r => r + 1);
      } });
      setReady(true);
    }).catch(() => { if (active) { setConfigError('We could not connect to your saved gym. Reopen the app to try again, or use practice.'); setReady(true); } });
    return () => { active = false; unsubscribe?.(); };
  }, []);
  useEffect(() => { const onHash = () => { if (allowedPages.has(window.location.hash.slice(1))) setPage(pageFromHash()); }; window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash); }, []);
  useEffect(() => { main.current?.focus({ preventScroll: true }); }, [page]);
  function go(next: Page) { setPage(next); if (next !== 'meet') history.replaceState(null, '', `#${next}`); window.scrollTo(0, 0); }
  async function entered(next: MeetDefinition) {
    if (!port.openingProfile()) { go('profile'); return; }
    if (!practice) await client!.enterCareerMeet(next);
    setMeet(next); setPage('meet');
  }
  function saved() { setRevision(r => r + 1); }
  async function signOut() {
    if (!client || signingOut) return;
    setSigningOut(true); setSignOutError('');
    try { await client.signOut(); }
    catch { setSignOutError('This device is signed out. We could not confirm the server logout.'); }
    finally { setPracticeState(freshPractice()); saved(); setSigningOut(false); go('gym'); }
  }
  const isLiftScreen = page === 'train' || page === 'meet';
  let content: ReactNode;
  if (!ready) content = <div className="loading-screen"><Brand /><div className="loading-lights"><i /><i /><i /></div><p>Opening the gym…</p></div>;
  else if (['gym', 'shop', 'staff', 'build'].includes(page)) content = <Gym key={practice ? 'practice' : client?.user?.id} port={facility} page={page as GymPage} onPage={go} onTrain={() => go('train')} onCareer={() => go(profile ? 'career' : 'profile')} lifterName={profile?.name} practice={practice} />;
  else if (page === 'train') content = <Training key={practice ? 'practice' : client?.user?.id} port={port} onExit={() => go('gym')} onSaved={saved} practice={practice} />;
  else if (page === 'career') content = profile ? <Career key={practice ? 'practice' : client?.user?.id} port={port} onMeet={entered} onExit={() => go('gym')} /> : <Profile port={port} onDone={() => { saved(); go('career'); }} onCancel={() => go('gym')} practice={practice} />;
  else if (page === 'meet' && meet) content = <Meet port={port} meet={meet} onExit={() => go('career')} onSaved={saved} practice={practice} soundEnabled={sound} onSoundChange={enabled => { setSound(enabled); saveSoundPreference(enabled ? 'on' : 'off'); }} />;
  else if (page === 'profile') content = <Profile port={port} onDone={() => { saved(); go('career'); }} onCancel={() => go('gym')} practice={practice} />;
  else if (page === 'account') content = <Account client={client} configError={configError} onDone={() => { saved(); go('gym'); }} onBack={() => go('gym')} />;
  else content = <section className="settings-screen"><div className="settings-heading"><p className="eyebrow">MAKE YOURSELF AT HOME</p><h1>Gym settings</h1></div><div className="panel"><h2>{profile?.name ?? 'Your athlete'}</h2><p>{practice ? 'You are exploring a disposable practice gym.' : `Signed in as ${client?.user?.email ?? 'your account'}.`}</p><button className="secondary" onClick={() => go('profile')}><UserRound size={UI.ICON_ACTION} />{profile ? 'Edit athlete profile' : 'Create a lifter'}</button>{practice && <button className="primary" onClick={() => go('account')}>Sign in to save<ArrowRight size={UI.ICON_ACTION} /></button>}</div><div className="panel"><h3>Meet audio</h3><div className="setting-row"><p>Referee lights, bar sounds, and the crowd.</p><button className="toggle" aria-pressed={sound} onClick={() => { setSound(!sound); saveSoundPreference(sound ? 'off' : 'on'); }}>{sound ? <><Check size={UI.ICON_SMALL} />On</> : 'Off'}</button></div><p className="small-copy">Lift cues also use visible text. Motion follows your device’s reduced motion preference.</p></div>{practice ? <div className="panel"><h3>A fresh start</h3><p>Restarting clears this practice gym and lifter. Saved accounts are unaffected.</p>{restartPrompt ? <div className="button-row"><button className="secondary" onClick={() => setRestartPrompt(false)}>Cancel</button><button className="primary" onClick={() => { setPracticeState(freshPractice()); setRestartPrompt(false); go('gym'); }}>Confirm restart</button></div> : <button className="secondary" onClick={() => setRestartPrompt(true)}>Restart practice</button>}</div> : <button className="secondary signout" disabled={signingOut} onClick={() => void signOut()}><LogOut size={UI.ICON_ACTION} />{signingOut ? 'Signing out…' : 'Sign out'}</button>}<p className="quiet-note">Three White Lights · Iron & Amber<br />No paid performance boosts. Every total comes from the platform.</p></section>;
  return <div className={'app' + (isLiftScreen ? ' app-lift' : '')}>
    <a className="skip-link" href="#main-content">Skip to game</a>
    <header className="app-header">{isLiftScreen ? <Brand /> : <button className="brand-button" onClick={() => go('gym')}><Brand /></button>}{!isLiftScreen && <nav className="desktop-nav" aria-label="Main navigation">{nav.map(({ page: p, label, icon: Icon }) => <button key={p} className={page === p || page === 'build' && p === 'gym' ? 'active' : ''} onClick={() => go(p)}><Icon size={UI.ICON_MEDIUM} />{label}</button>)}</nav>}<div className="header-actions" hidden={isLiftScreen}><button className="account-button" onClick={() => go(practice ? 'account' : 'profile')}><UserRound size={UI.ICON_SMALL} /><span>{practice ? 'Sign in' : profile?.name ?? 'Your athlete'}</span></button>{!isLiftScreen && <button className="icon-button" aria-label="Settings" onClick={() => go('settings')}><Settings size={UI.ICON_ACTION} /></button>}</div></header>
    {ready && !isLiftScreen && practice && <div className="practice-banner"><span>Practice gym</span><button onClick={() => go('account')}>Sign in to save<ArrowRight size={UI.ICON_TINY} /></button></div>}
    <main id="main-content" ref={main} tabIndex={-1} className="app-main">{signOutError && <p className="notice error" role="alert">{signOutError}</p>}{content}</main>
    {!isLiftScreen && ready && <nav className="mobile-nav" aria-label="Main navigation">{nav.map(({ page: p, label, icon: Icon }) => <button key={p} aria-current={page === p ? 'page' : undefined} className={page === p || page === 'build' && p === 'gym' ? 'active' : ''} onClick={() => go(p)}><Icon size={UI.ICON_NAV} /><span>{label}</span></button>)}</nav>}
    {!isLiftScreen && ready && <footer className="app-footer"><span>THREE WHITE LIGHTS</span><span>STRONGER PEOPLE. BRIGHTER DAYS.</span><span>{practice ? 'Practice mode' : 'Saved career'}</span></footer>}
  </div>;
}
