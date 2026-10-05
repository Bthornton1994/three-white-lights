import { useEffect, useRef, useState } from 'react';
import { Hammer, Check, Coins, RefreshCw, RotateCw, X, Undo2, Dumbbell, Trophy, ShieldCheck, Package, Wrench } from 'lucide-react';
import { type GymViewState } from '../../src/facility/ladderView';
import { floorFurnitureLayout, floorLayout, floorGridSize, type GridPosition } from '../../src/facility/floor';
import { ladderEquipmentCost, ladderEquipmentMinRung, ladderIncomeRatePerHour, ladderMoveCost, nextLadderRung, type LadderEquipmentItem } from '../../src/facility/ladder';
import { sessionEquipmentCost, sessionEquipmentMinRung, type SessionEquipmentItem } from '../../src/facility/sessions';
import { managerHireCostGymBucks, managerWageRatePerBankedHour, managerAutoRepairCondition, repairCostGymBucks, conditionIncomeMultiplier, type ManagerTier, type ManagedEquipmentItem } from '../../src/facility/management';
import { stationLevels, stationUpgradeCostGymBucks, type StationUpgradeAxis } from '../../src/facility/stationCapability';
import { competitionBenchBay, COMPETITION_BENCH_BAY } from '../../src/facility/trainingStation';
import { EMPIRE_TUNING } from '../../src/facility/empireTuning';
import type { SceneActivityCounts } from '../../src/facility/scene/types';
import type { FacilityAction, FacilityPort } from './facilityPort';
import { INTERFACE_TUNING as UI } from './interfaceTuning';
import { GYM_INTERACTION_TUNING as T } from './gymInteractionTuning';
import { GYM_ITEM_NAMES as names, GYM_RUNG_NAMES as rungNames, openingPlacement, placementFootprint, placementMessage, placementRefusal, rotatePlacement, type GymPlacement } from './gymModel';
import { EquipmentPreview, GymWorld } from './GymWorld';
import './gym.css';

export type GymPage = 'gym' | 'build' | 'shop' | 'staff';
const MANAGER_NAMES: Record<ManagerTier, string> = { novice: 'Floor assistant', steady: 'Gym manager', veteran: 'Head coach' };
const UPGRADE_COPY: Record<StationUpgradeAxis, {name: string; detail: string}> = {
  capacity: { name: 'Second bench', detail: 'Adds another usable competition bench beside this one.' },
  throughput: { name: 'Plate tree', detail: 'Shortens plate changeover between users. Sets keep their full duration.' },
  quality: { name: 'Competition pads', detail: 'Improves the station experience and appeal to gym members.' },
};
const format = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: T.ZERO }).format(value);
interface Retry { readonly action: FacilityAction; readonly key: string; readonly success: string; readonly clearDraft: boolean }

export function Gym({ port, page, onPage, onTrain, onCareer, lifterName, practice, soundEnabled = true }: {
  port: FacilityPort; page: GymPage; onPage: (page: GymPage) => void; onTrain: () => void; onCareer: () => void;
  lifterName?: string; practice: boolean; soundEnabled?: boolean;
}) {
  const [state, setState] = useState<GymViewState>(() => port.openingFacility());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<ManagedEquipmentItem | null>(null);
  const [draft, setDraft] = useState<GymPlacement | null>(null);
  const [catalog, setCatalog] = useState('all');
  const [retry, setRetry] = useState<Retry | null>(null);
  const [counts, setCounts] = useState<SceneActivityCounts | null>(null);
  const busyRef = useRef(false);
  const audio = useRef<AudioContext | null>(null);
  const mounted = useRef(true);
  const feedbackEnabled = useRef(soundEnabled); feedbackEnabled.current = soundEnabled;
  const gym = state.managed.gym, ladder = gym.ladder;
  const owned: ManagedEquipmentItem[] = [...ladder.equipment, ...gym.sessionEquipment];
  const placed = [...floorFurnitureLayout(state.floor, ladder.equipment), ...floorLayout(state.floor)];
  const next = nextLadderRung(ladder.rung), nextCost = next ? ladderMoveCost(next) : null;
  const income = ladderIncomeRatePerHour(ladder.rung) * conditionIncomeMultiplier(state.managed);
  const levels = stationLevels(state.capability, COMPETITION_BENCH_BAY);
  const bay = competitionBenchBay(state.floor, ladder.equipment, levels.capacity);
  const reason = placementRefusal(state, draft);
  const grid = floorGridSize(ladder.rung);
  const inspected = selected ?? 'flat-bench';
  const inspectedCondition = state.managed.condition[inspected];
  const rungIndex = (EMPIRE_TUNING.LADDER_RUNGS as readonly string[]).indexOf(ladder.rung);
  const shopItems = [
    ...EMPIRE_TUNING.LADDER_EQUIPMENT_ITEMS.map(item => ({ item, family: 'barbell', cost: ladderEquipmentCost(item), min: ladderEquipmentMinRung(item) })),
    ...EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS.map(item => ({ item, family: 'training', cost: sessionEquipmentCost(item), min: sessionEquipmentMinRung(item) })),
  ];
  function prepareAudio() {
    if (!soundEnabled) return;
    try { audio.current ??= new AudioContext(); void audio.current.resume(); } catch { /* Visible save feedback is always available. */ }
  }
  function placementTone() {
    if (!feedbackEnabled.current || document.hidden || !audio.current || audio.current.state !== 'running') return;
    const context = audio.current, oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(T.FEEDBACK_FREQUENCY, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(T.FEEDBACK_END_FREQUENCY, context.currentTime + T.FEEDBACK_DURATION_SECONDS);
    gain.gain.setValueAtTime(T.FEEDBACK_VOLUME, context.currentTime);
    gain.gain.linearRampToValueAtTime(T.ZERO, context.currentTime + T.FEEDBACK_DURATION_SECONDS);
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + T.FEEDBACK_DURATION_SECONDS);
  }
  async function act(action: FacilityAction, success = '', clearDraft = false, key: string = crypto.randomUUID()) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    if (success) { setError(''); setNotice(''); setRetry(null); prepareAudio(); }
    try {
      const outcome = await port.facilityAction(action, key);
      if (!mounted.current) return;
      if (outcome.kind === 'refused') { if (outcome.state) setState(outcome.state); setError(placementMessage(outcome.message)); setRetry(null); }
      else {
        setState(outcome.state);
        if (outcome.state.lastRefusal) { setError(placementMessage(outcome.state.lastRefusal)); setRetry(null); }
        else if (success) { setNotice(success); setRetry(null); if (clearDraft) { setDraft(null); placementTone(); } }
      }
    } catch {
      if (mounted.current) {
        setError('Your change could not be confirmed. Check your connection and retry.');
        if (success) setRetry({ action, key, success, clearDraft });
      }
    } finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }
  useEffect(() => {
    mounted.current = true; setState(port.openingFacility());
    const timer = window.setInterval(() => { if (!document.hidden && !busyRef.current) void act({ kind: 'check-in' }); }, UI.FACILITY_REFRESH_MS);
    return () => { mounted.current = false; clearInterval(timer); void audio.current?.close(); audio.current = null; };
  }, [port]);
  useEffect(() => { if (page !== 'build') setDraft(null); }, [page]);
  function pick(item: ManagedEquipmentItem) {
    setSelected(item);
    if (page === 'build' && (!draft || draft.target.item !== item)) setDraft(openingPlacement(state, item));
  }
  function edit(item = inspected) { setSelected(item); setDraft(openingPlacement(state, item)); onPage('build'); }
  function position(value: GridPosition) { setDraft(current => current ? { ...current, position: value } : current); }
  function cancel() { setDraft(null); setNotice('Placement cancelled.'); }
  function place() {
    if (!draft?.position || reason !== null) return;
    void act({ kind: 'floor-edit', expectedLayoutRevision: draft.expectedLayoutRevision, target: draft.target, placement: { ...draft.position, rotation: draft.rotation } }, `${names[draft.target.item]} placed.`, true);
  }
  const footprint = draft ? placementFootprint(draft) : null;
  const title = page === 'build' ? 'Build your gym' : page === 'shop' ? 'Equipment shop' : page === 'staff' ? 'Your team' : rungNames[ladder.rung];
  return <section className={'gym-screen page-' + page} aria-label={page === 'gym' ? 'Your gym' : page} data-layout-revision={state.floor.layoutRevision}>
    <div className="gym-scene-column">
      <div className="gym-scene-heading"><div><p className="eyebrow">{lifterName ? `${lifterName}'S HOME GYM` : 'THREE WHITE LIGHTS'}</p><h1>{title}</h1></div><div className="wallet"><Coins size={UI.ICON_ACTION} /><b>{format(ladder.gymBucks)}</b><span>Gym Bucks</span></div></div>
      <div className="world-shell"><GymWorld state={state} port={port} build={page === 'build'} selected={selected} draft={draft} onPick={pick} onPosition={position} onCancel={cancel} onCounts={setCounts} />
        <div className="world-activity" aria-live="off"><span>{counts ? `${counts.training} training · ${counts.waiting} waiting` : 'Opening the floor…'}</span><span>{counts ? `${counts.total} members` : ''}</span></div>
      </div>
      <div className="gym-floor-caption"><span>{rungNames[ladder.rung]} · {grid.width} × {grid.height} floor</span><span>{placed.length} placed</span></div>
      {page === 'gym' && <div className="gym-primary-actions"><button className="primary" onClick={onTrain}><Dumbbell size={UI.ICON_ACTION} />Train today</button><button className="secondary" onClick={onCareer}><Trophy size={UI.ICON_ACTION} />{lifterName ? 'Find a meet' : 'Create your lifter'}</button><button className="secondary" onClick={() => edit()}><Hammer size={UI.ICON_ACTION} />Build gym</button></div>}
    </div>
    <div className="gym-control-column">
      {error && <div className="notice error" role="alert">{error}{retry && <button className="secondary" disabled={busy} onClick={() => void act(retry.action, retry.success, retry.clearDraft, retry.key)}>Retry change</button>}</div>}
      {notice && <div className="notice" role="status">{notice}</div>}
      {busy && <p className="gym-saving" role="status">Confirming your gym…</p>}
      {page === 'gym' && <>
        <div className="panel gym-inspector"><EquipmentPreview item={inspected} /><div><p className="eyebrow">{placed.some(row => row.item === inspected) ? 'ON YOUR FLOOR' : 'IN STORAGE'}</p><h2>{names[inspected]}</h2><p>{inspectedCondition === undefined ? 'Ready for your floor.' : `${Math.round(inspectedCondition * T.PERCENT)}% condition`}</p></div><button className="icon-button" aria-label="Move selected equipment" onClick={() => edit()}><Hammer size={UI.ICON_ACTION} /></button></div>
        {inspected === 'flat-bench' && <div className="panel station-panel"><div className="station-title"><h3>Competition bench bay</h3><span>{bay.complete ? `${bay.benches.length} usable ${bay.benches.length === T.ONE ? 'bench' : 'benches'}` : 'Place your bar, plates and bench'}</span></div>{EMPIRE_TUNING.STATION_UPGRADE_AXES.map(axis => {
          const bought = levels[axis] > T.ZERO, cost = stationUpgradeCostGymBucks(axis);
          return <div className="station-upgrade" key={axis}><div><b>{UPGRADE_COPY[axis].name}</b><p>{UPGRADE_COPY[axis].detail}</p></div><button className="secondary" aria-label={bought ? `${UPGRADE_COPY[axis].name} installed` : `Buy ${UPGRADE_COPY[axis].name} for ${format(cost)} Gym Bucks`} disabled={busy || bought || !bay.complete || ladder.gymBucks < cost} onClick={() => void act({ kind: 'upgrade-station', station: COMPETITION_BENCH_BAY, axis }, `${UPGRADE_COPY[axis].name} installed.`)}>{bought ? <Check size={UI.ICON_MEDIUM} /> : format(cost)}</button></div>;
        })}</div>}
        <div className="gym-economy"><div><span>Gym income</span><b>{format(income)} <small>/ hr</small></b></div><button className="secondary" aria-label="Collect earned gym income" disabled={busy} onClick={() => void act({ kind: 'check-in' }, 'Earned income collected.')}><RefreshCw size={UI.ICON_ACTION} />Collect</button></div>
        {next && <div className="panel gym-expansion"><p className="eyebrow">YOUR NEXT SPACE</p><h3>{rungNames[next]}</h3><p>A larger floor for the community you are building.</p><progress aria-label="Savings toward next gym" value={ladder.gymBucks} max={nextCost ?? T.ONE} /><div><span>{format(ladder.gymBucks)} / {format(nextCost ?? T.ZERO)} Gym Bucks</span><button className="secondary" disabled={busy || ladder.gymBucks < (nextCost ?? Infinity)} onClick={() => void act({ kind: 'move-up' }, 'Welcome to your new gym.')}>Move in</button></div></div>}
        <p className="quiet-note">{practice ? 'Practice resets on reload. Sign in to keep your gym and career.' : 'Saved to your account. Offline earnings follow your gym’s capped window.'}</p>
      </>}
      {page === 'build' && <div className="panel build-drawer">
        <div className="build-drawer-heading"><div><p className="eyebrow">OWNED EQUIPMENT</p><h2>{draft ? names[draft.target.item] : 'Choose an item'}</h2></div><button className="icon-button" aria-label="Exit Build mode" onClick={() => { cancel(); onPage('gym'); }}><X size={UI.ICON_ACTION} /></button></div>
        <div className="gym-inventory" aria-label="Owned equipment">{owned.map(item => <button key={item} aria-label={`Select ${names[item]}`} aria-pressed={draft?.target.item === item} onClick={() => { setSelected(item); setDraft(openingPlacement(state, item)); }}><EquipmentPreview item={item} /><span>{names[item]}</span><small>{placed.some(row => row.item === item) ? 'On floor' : 'Storage'}</small></button>)}</div>
        <p className={'placement-validation' + (reason && reason !== 'choose-position' ? ' invalid' : '')} role="status">{draft ? placementMessage(reason) : 'Select equipment on the floor or from your inventory.'}</p>
        <div className="build-main-actions"><button className="secondary" disabled={!draft || busy} onClick={() => setDraft(current => current ? rotatePlacement(current) : current)}><RotateCw size={UI.ICON_MEDIUM} />Rotate{draft ? ` ${draft.rotation}°` : ''}</button><button className="secondary" disabled={!draft || busy} onClick={cancel}>Cancel</button><button className="primary" disabled={!draft || reason !== null || busy} onClick={place}><Check size={UI.ICON_MEDIUM} />Place item</button></div>
        <div className="build-secondary-actions"><button className="text-button" disabled={!draft || busy || !placed.some(row => row.item === draft.target.item)} onClick={() => draft && void act({ kind: 'floor-edit', expectedLayoutRevision: draft.expectedLayoutRevision, target: draft.target, placement: null }, `${names[draft.target.item]} returned to storage.`, true)}><Package size={UI.ICON_MEDIUM} />Return to storage</button><button className="text-button" disabled={busy || !state.floor.lastLayoutEdit || state.floor.lastLayoutEdit.appliedRevision !== state.floor.layoutRevision} onClick={() => void act({ kind: 'floor-undo', expectedLayoutRevision: state.floor.layoutRevision }, 'Last layout edit undone.', true)}><Undo2 size={UI.ICON_MEDIUM} />Undo last edit</button></div>
        <details className="build-coordinate-details"><summary>Keyboard and exact placement</summary><p>Choose an item, then use arrow keys on the floor, or enter a column and row.</p><div className="coordinate-fields"><label>Column<input type="number" min={T.ONE} max={grid.width} value={(draft?.position?.x ?? T.ZERO) + T.ONE} disabled={!draft} onChange={event => position({ x: Number(event.target.value) - T.ONE, y: draft?.position?.y ?? T.ZERO })} /></label><label>Row<input type="number" min={T.ONE} max={grid.height} value={(draft?.position?.y ?? T.ZERO) + T.ONE} disabled={!draft} onChange={event => position({ x: draft?.position?.x ?? T.ZERO, y: Number(event.target.value) - T.ONE })} /></label></div><p>{footprint ? `${footprint.width} × ${footprint.height} footprint · ${draft?.rotation}°` : 'Choose equipment first.'}</p></details>
      </div>}
      {page === 'shop' && <><div className="gym-shop-heading"><h2>Put it to work.</h2><p>Buy equipment, then place it on your floor.</p><div className="segmented" aria-label="Equipment category">{[['all', 'All'], ['barbell', 'Barbell'], ['training', 'Training']].map(([value, label]) => <button key={value} aria-pressed={catalog === value} className={catalog === value ? 'active' : ''} onClick={() => setCatalog(value!)}>{label}</button>)}</div></div><div className="gym-shop-list">{shopItems.filter(item => catalog === 'all' || item.family === catalog).map(({ item, family, cost, min }) => {
        const has = owned.includes(item), locked = (EMPIRE_TUNING.LADDER_RUNGS as readonly string[]).indexOf(min) > rungIndex;
        return <article className="gym-shop-item" key={item}><EquipmentPreview item={item} /><div><h3>{names[item]}</h3><p>{locked ? `Opens in ${rungNames[min]}` : has ? placed.some(row => row.item === item) ? 'On your floor' : 'Ready in storage' : `${format(cost)} Gym Bucks`}</p></div>{has ? <button className="secondary" aria-label={`Place ${names[item]}`} onClick={() => edit(item)}>Place</button> : <button className="primary" disabled={busy || locked || ladder.gymBucks < cost} aria-label={`Buy ${names[item]} for ${format(cost)} Gym Bucks`} onClick={() => void act(family === 'barbell' ? { kind: 'buy-ladder', item: item as LadderEquipmentItem } : { kind: 'buy-session', item: item as SessionEquipmentItem }, `${names[item]} added to storage. Place it in Build mode.`)}>{locked ? 'Locked' : 'Buy'}</button>}</article>;
      })}</div></>}
      {page === 'staff' && <><div className="gym-shop-heading"><h2>Care for the floor.</h2><p>Your manager appears in the gym. Hire costs, wages and repair thresholds follow the same facility rules.</p></div>{EMPIRE_TUNING.MANAGER_TIERS.map(tier => {
        const hired = state.managed.manager?.tier === tier, cost = managerHireCostGymBucks(tier);
        return <article className="panel gym-staff-card" key={tier}><ShieldCheck size={UI.ICON_STAFF} /><div><h3>{MANAGER_NAMES[tier]}</h3><p>{format(cost)} to hire · {format(managerWageRatePerBankedHour(tier))}/hr wage</p><small>Repairs below {Math.round(managerAutoRepairCondition(tier) * T.PERCENT)}% condition.</small></div><button className="secondary" disabled={busy || state.managed.manager !== null || ladder.gymBucks < cost} onClick={() => void act({ kind: 'hire-manager', tier }, `${MANAGER_NAMES[tier]} hired.`)}>{hired ? 'Hired' : 'Hire'}</button></article>;
      })}{state.managed.manager && <button className="secondary" disabled={busy} onClick={() => void act({ kind: 'dismiss-manager' }, 'Manager dismissed.')}>Dismiss current manager</button>}<div className="panel gym-maintenance"><h3>Equipment care</h3>{owned.map(item => {
        const condition = state.managed.condition[item] ?? T.ONE, cost = repairCostGymBucks(state.managed, item);
        return <div className="gym-repair-row" key={item}><div><b>{names[item]}</b><span>{Math.round(condition * T.PERCENT)}% condition · {format(cost)} Gym Bucks</span></div><button className="secondary" aria-label={`Repair ${names[item]}`} disabled={busy || condition >= T.ONE || ladder.gymBucks < cost} onClick={() => void act({ kind: 'repair-item', item }, `${names[item]} repaired.`)}><Wrench size={UI.ICON_MEDIUM} />Repair</button></div>;
      })}</div></>}
    </div>
  </section>;
}
