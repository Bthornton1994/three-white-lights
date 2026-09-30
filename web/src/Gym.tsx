import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Hammer, Check, Coins, RefreshCw, Plus, X, ChevronLeft, Sparkles, ShieldCheck } from 'lucide-react';
import { type GymViewState } from '../../src/facility/ladderView';
import { floorFurnitureLayout, floorLayout, floorGridSize, furnitureItemFootprint, sessionItemFootprint, type GridPosition } from '../../src/facility/floor';
import { createFloorSimState, stepFloorSim, floorSimStateCounts, type FloorSimContext } from '../../src/facility/floorSim';
import { floorSimPopulationFromRoster } from '../../src/facility/livingMembers';
import { memberWorldPoint } from '../../src/facility/worldView';
import { ironAmberFixedUri, ironAmberSessionUri, ironAmberMemberUri } from '../../src/facility/ironAmberArt';
import { ladderEquipmentCost, ladderEquipmentMinRung, ladderIncomeRatePerHour, ladderMoveCost, nextLadderRung, type LadderEquipmentItem } from '../../src/facility/ladder';
import { sessionEquipmentCost, sessionEquipmentMinRung, type SessionEquipmentItem } from '../../src/facility/sessions';
import { managerHireCostGymBucks, managerWageRatePerBankedHour, managerAutoRepairCondition, repairCostGymBucks, conditionIncomeMultiplier, type ManagerTier, type ManagedEquipmentItem } from '../../src/facility/management';
import { EMPIRE_TUNING } from '../../src/facility/empireTuning';
import type { FacilityAction, FacilityPort } from './facilityPort';
import { Art } from './Art';

export type GymPage = 'gym' | 'build' | 'shop' | 'staff';
const rungNames: Record<string, string> = { garage: 'Garage gym', 'storage-unit': 'The storage gym', 'strip-mall-unit': 'Neighborhood gym', warehouse: 'Warehouse gym' };
const names: Record<string, string> = { 'power-bar': 'Power bar', 'comp-plates': 'Competition plates', 'flat-bench': 'Competition bench', 'squat-rack': 'Squat rack', bike: 'Exercise bike', treadmill: 'Treadmill', rower: 'Rowing machine', sled: 'Sled track', dumbbells: 'Dumbbell set', cables: 'Cable station', machines: 'Machine station', mats: 'Training mats', 'foam-rollers': 'Foam rollers', sauna: 'Sauna', 'wrist-wraps': 'Wrist wraps', belts: 'Lifting belts', sleeves: 'Knee sleeves', 'specialty-bars': 'Specialty bars' };
const managerNames: Record<ManagerTier, string> = { novice: 'Floor assistant', steady: 'Gym manager', veteran: 'Head coach' };
const number = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
const itemName = (n: string) => names[n] ?? n;

function project(position: GridPosition, width: number, height: number) {
  const x = position.x / width, y = position.y / height;
  return { left: `${48 + (x - y) * 38}%`, top: `${51 + (x + y) * 17}%` };
}

function Room({ state, build, selected, onSelect, onTile }: { state: GymViewState; build: boolean; selected: string | null; onSelect: (item: string) => void; onTile: (position: GridPosition) => void }) {
  const gym = state.managed.gym;
  const grid = floorGridSize(gym.ladder.rung);
  const context = useMemo<FloorSimContext>(() => ({ rung: gym.ladder.rung, floor: state.floor, barbellOwned: gym.ladder.equipment, sessionOwned: gym.sessionEquipment, capability: state.capability, livingPopulation: floorSimPopulationFromRoster(state.livingMembers) }), [state.floor, state.capability, state.livingMembers, gym]);
  const [sim, setSim] = useState(() => createFloorSimState(context, EMPIRE_TUNING.FLOOR_SIM_RENDER_SEED));
  const contextRef = useRef(context);
  contextRef.current = context;
  useEffect(() => { setSim(createFloorSimState(context, EMPIRE_TUNING.FLOOR_SIM_RENDER_SEED)); }, [context]);
  useEffect(() => {
    const timer = window.setInterval(() => { if (!document.hidden) setSim(s => stepFloorSim(s, contextRef.current)); }, 100);
    return () => clearInterval(timer);
  }, []);
  const counts = floorSimStateCounts(sim);
  const furniture = floorFurnitureLayout(state.floor, gym.ladder.equipment);
  const stations = floorLayout(state.floor);
  const itemSize = (footprint: { width: number; height: number }) => Math.min(30, 15 + Math.max(footprint.width, footprint.height) * 2);
  return <div className={'gym-room' + (build ? ' is-building' : '')}>
    <img className="gym-room-background" src="/rooms/gym-floor.png" alt="Warm brick garage gym with an amber sunset and open floor" fetchPriority="high" />
    <div className="gym-room-vignette" />
    <div className="room-sign" aria-hidden="true"><span>STRONGER PEOPLE.</span><span>BRIGHTER DAYS.</span><i>● ● ●</i></div>
    {build && <div className="floor-grid" aria-label="Gym placement grid">{Array.from({ length: grid.width * grid.height }, (_, i) => {
      const p = { x: i % grid.width, y: Math.floor(i / grid.width) };
      return <button key={i} style={project({ x: p.x + .5, y: p.y + .5 }, grid.width, grid.height)} onClick={() => onTile(p)} aria-label={`Place ${selected ? itemName(selected) : 'equipment'} at column ${p.x + 1}, row ${p.y + 1}`} />;
    })}</div>}
    {[...furniture, ...stations].map(row => {
      const fixed = furniture.some(f => f.item === row.item);
      const src = fixed ? ironAmberFixedUri(row.item, false) : ironAmberSessionUri(row.item);
      if (!src) return null;
      const p = { x: row.position.x + row.footprint.width / 2, y: row.position.y + row.footprint.height / 2 };
      return <button key={row.item} className={'room-equipment' + (selected === row.item ? ' selected' : '')} style={{ ...project(p, grid.width, grid.height), width: `${itemSize(row.footprint)}%`, zIndex: Math.round(p.x + p.y) + 10 }} onClick={() => onSelect(row.item)} aria-label={`Inspect ${itemName(row.item)}`}>
        <Art src={src} label={itemName(row.item)} /><span className="equipment-tag">{itemName(row.item)}</span>
      </button>;
    })}
    {!build && sim.members.map(member => {
      const facing = member.next && member.next.x < member.cell.x ? 'left' : 'right';
      const frame = Math.floor(sim.tick / 3) % 2 === 0 ? 'a' : 'b';
      const pose = member.state === 'using' ? `using-${member.target?.kind === 'training' ? 'bench' : 'bar'}-${frame}` : member.next ? `step-${frame}` : 'stand';
      const p = memberWorldPoint(member);
      return <Art key={member.memberId} src={ironAmberMemberUri(member.type, pose, facing)} className="room-member" style={{ ...project(p, grid.width, grid.height), zIndex: Math.round(p.x + p.y) + 10 }} />;
    })}
    <div className="room-activity"><span className="status-dot" />{sim.members.length ? `${counts.using} training · ${counts.queuing} waiting` : 'Your space. Your start.'}</div>
  </div>;
}

export function Gym({ port, page, onPage, onTrain, practice }: { port: FacilityPort; page: GymPage; onPage: (page: GymPage) => void; onTrain: () => void; practice: boolean }) {
  const [state, setState] = useState(() => port.openingFacility());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [position, setPosition] = useState<GridPosition | null>(null);
  const [catalog, setCatalog] = useState('all');
  const busyRef = useRef(false);
  const gym = state.managed.gym;
  const ladder = gym.ladder;
  const owned = [...ladder.equipment, ...gym.sessionEquipment];
  const next = nextLadderRung(ladder.rung);
  const nextCost = next ? ladderMoveCost(next) : null;
  async function act(action: FacilityAction, success?: string) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const outcome = await port.facilityAction(action, crypto.randomUUID());
      if (outcome.kind === 'refused') { if (outcome.state) setState(outcome.state); setError(outcome.message); }
      else { setState(outcome.state); if (outcome.state.lastRefusal) setError(outcome.state.lastRefusal.replaceAll('-', ' ')); else setNotice(success ?? 'Gym updated.'); }
    } catch { setError('Your gym could not be saved. Check your connection and try again.'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  useEffect(() => {
    setState(port.openingFacility());
    const timer = window.setInterval(() => { if (!document.hidden && !busyRef.current) void act({ kind: 'check-in' }); }, 60000);
    return () => clearInterval(timer);
  }, [port]);
  function place() {
    if (!selected || !position) return;
    const furniture = (EMPIRE_TUNING.LADDER_EQUIPMENT_ITEMS as readonly string[]).includes(selected);
    void act(furniture ? { kind: 'floor-place-furniture', item: selected as LadderEquipmentItem, position } : { kind: 'floor-place', item: selected as SessionEquipmentItem, position }, `${itemName(selected)} placed.`);
    setPosition(null);
  }
  const selectedCondition = selected ? state.managed.condition[selected as ManagedEquipmentItem] : undefined;
  const income = ladderIncomeRatePerHour(ladder.rung) * conditionIncomeMultiplier(state.managed);
  const title = page === 'shop' ? 'Make room for more.' : page === 'staff' ? 'Good people. Great gym.' : page === 'build' ? 'Build your gym.' : rungNames[ladder.rung];
  const rungIndex = (EMPIRE_TUNING.LADDER_RUNGS as readonly string[]).indexOf(ladder.rung);
  const shopItems = [...EMPIRE_TUNING.LADDER_EQUIPMENT_ITEMS.map(item => ({ item, family: 'barbell', cost: ladderEquipmentCost(item), min: ladderEquipmentMinRung(item), src: ironAmberFixedUri(item, false) })), ...EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS.map(item => ({ item, family: 'training', cost: sessionEquipmentCost(item), min: sessionEquipmentMinRung(item), src: ironAmberSessionUri(item) }))];
  return <section className={'gym-screen page-' + page} aria-label={page === 'gym' ? 'Your gym' : page}>
    <div className="gym-scene-column">
      <div className="gym-scene-heading"><div><p className="eyebrow">{page === 'gym' ? 'FROM THE GROUND UP' : 'YOUR GYM, YOUR WAY'}</p><h1>{title}</h1></div><div className="wallet"><Coins size={18} /><b>{number(ladder.gymBucks)}</b><span>Gym Bucks</span></div></div>
      <Room state={state} build={page === 'build'} selected={selected} onSelect={setSelected} onTile={p => setPosition(p)} />
      {page === 'gym' && <button className="build-float secondary" onClick={() => { setSelected('flat-bench'); onPage('build'); }}><Hammer size={17} />Build gym</button>}
      <div className="scene-caption"><span>IRON & AMBER / {rungNames[ladder.rung]?.toUpperCase()}</span><span>● ● ●</span></div>
    </div>
    <div className="gym-control-column">
      {error && <div className="notice error" role="alert">{error}</div>}
      {notice && <div className="notice" role="status">{notice}</div>}
      {page === 'gym' && <>
        <div className="panel gym-welcome"><p className="eyebrow">THE WORK STARTS HERE</p><h2>Build a gym.<br />Become a lifter.</h2><p>A small room, a loaded bar, and the next rep. Train the big three and earn your place on the platform.</p><button className="primary" onClick={onTrain}>Train today<ArrowRight size={18} /></button></div>
        <div className="panel inspect-panel"><div className="panel-icon"><Art src={ironAmberFixedUri(selected ?? 'flat-bench', false) ?? '/empire-art/eq-flat-bench.png'} label="Equipment" /></div><div><p className="eyebrow">{selected ? 'ON THE FLOOR' : 'STARTER EQUIPMENT'}</p><h3>{itemName(selected ?? 'flat-bench')}</h3><p>{selectedCondition === undefined ? 'Your first competition bench is ready.' : `${Math.round(selectedCondition * 100)}% condition`}</p></div><button className="icon-button" aria-label="Move selected equipment" onClick={() => { if (!selected) setSelected('flat-bench'); onPage('build'); }}><Hammer size={18} /></button></div>
        <div className="stats-panel"><div><span>Gym income</span><b>{number(income)} <small>/ hr</small></b></div><div><span>On your floor</span><b>{owned.length}<small> items</small></b></div><button aria-label="Collect earned gym income" disabled={busy} onClick={() => void act({ kind: 'check-in' }, 'Earned income collected.')}><RefreshCw size={18} /></button></div>
        {next && <div className="panel expansion-panel"><p className="eyebrow">YOUR NEXT CHAPTER</p><h3>{rungNames[next]}</h3><p>More floor space. More possibilities.</p><div className="expansion-progress"><i style={{ width: `${Math.min(100, ladder.gymBucks / (nextCost ?? 1) * 100)}%` }} /></div><div className="expansion-cost"><span>{number(ladder.gymBucks)} / {number(nextCost ?? 0)} Gym Bucks</span><button className="text-button" disabled={busy || ladder.gymBucks < (nextCost ?? Infinity)} onClick={() => void act({ kind: 'move-up' }, 'Welcome to your new gym.')}>Move in<ArrowRight size={14} /></button></div></div>}
        <p className="quiet-note">{practice ? 'Practice is disposable. Sign in to keep your gym and career.' : 'Your gym earns while you’re away, with up to 12 hours of offline income.'}</p>
      </>}
      {page === 'build' && <>
        <button className="text-button back" onClick={() => onPage('gym')}><ChevronLeft size={17} />Back to gym</button>
        <div className="panel"><p className="eyebrow">BUILD MODE</p><h2>{selected ? itemName(selected) : 'Choose equipment'}</h2><p>Select an owned item, then choose a clear tile on your gym floor.</p><div className="owned-items">{owned.filter(i => i !== 'squat-rack').map(i => <button key={i} className={'owned-item' + (selected === i ? ' active' : '')} onClick={() => { setSelected(i); setPosition(null); }}><Art src={ironAmberFixedUri(i, false) ?? ironAmberSessionUri(i) ?? '/empire-art/eq-flat-bench.png'} /><span>{itemName(i)}</span>{selected === i && <Check size={16} />}</button>)}</div><label className="eyebrow">PLACEMENT</label><div className="coordinate-fields"><label>Column<input type="number" min={1} max={floorGridSize(ladder.rung).width} value={(position?.x ?? 0) + 1} onChange={e => setPosition({ x: Number(e.target.value) - 1, y: position?.y ?? 0 })} /></label><label>Row<input type="number" min={1} max={floorGridSize(ladder.rung).height} value={(position?.y ?? 0) + 1} onChange={e => setPosition({ x: position?.x ?? 0, y: Number(e.target.value) - 1 })} /></label></div><div className="button-row"><button className="secondary" onClick={() => onPage('gym')}>Cancel</button><button className="primary" disabled={!selected || !position || busy} onClick={place}><Plus size={17} />Place item</button></div>{selected && <button className="text-button remove-action" disabled={busy} onClick={() => void act((EMPIRE_TUNING.LADDER_EQUIPMENT_ITEMS as readonly string[]).includes(selected) ? { kind: 'floor-remove-furniture', item: selected as LadderEquipmentItem } : { kind: 'floor-remove', item: selected as SessionEquipmentItem }, 'Equipment returned to storage.')}><X size={14} />Return to storage</button>}</div>
      </>}
      {page === 'shop' && <><div className="shop-heading"><p className="eyebrow">INVEST IN THE WORK</p><h2>Equipment shop</h2><p>Own it, place it, put it to work.</p><div className="segmented" aria-label="Equipment category">{[['all', 'All'], ['barbell', 'Barbell'], ['training', 'Training']].map(([value, label]) => <button key={value} aria-pressed={catalog === value} className={catalog === value ? 'active' : ''} onClick={() => setCatalog(value!)}>{label}</button>)}</div></div><div className="shop-list">{shopItems.filter(i => catalog === 'all' || i.family === catalog).map(({ item, family, cost, min, src }) => {
        const has = owned.includes(item), locked = (EMPIRE_TUNING.LADDER_RUNGS as readonly string[]).indexOf(min) > rungIndex;
        return <article className="shop-item" key={item}><div className="shop-art">{src ? <Art src={src} label={itemName(item)} /> : <Hammer size={36} />}</div><div className="shop-item-copy"><h3>{itemName(item)}</h3><p>{locked ? `Opens in ${rungNames[min]}` : family === 'barbell' ? 'Build your big three' : 'A stronger training floor'}</p><b className="cost"><Coins size={12} />{number(cost)}</b></div><button className={has ? 'secondary' : 'primary'} disabled={busy || has || locked || ladder.gymBucks < cost} aria-label={has ? `${itemName(item)} owned` : `Buy ${itemName(item)} for ${number(cost)} Gym Bucks`} onClick={() => void act(family === 'barbell' ? { kind: 'buy-ladder', item: item as LadderEquipmentItem } : { kind: 'buy-session', item: item as SessionEquipmentItem }, `${itemName(item)} added to storage. Place it in Build mode.`)}>{has ? <Check size={17} /> : locked ? 'Locked' : 'Buy'}</button></article>;
      })}</div></>}
      {page === 'staff' && <><div className="shop-heading"><p className="eyebrow">KEEP THE FLOOR MOVING</p><h2>Your team</h2><p>Managers maintain equipment and keep the work going. Hire costs and hourly wages are quoted before you choose.</p></div>{EMPIRE_TUNING.MANAGER_TIERS.map(tier => {
        const hired = state.managed.manager?.tier === tier, cost = managerHireCostGymBucks(tier);
        return <article className="panel staff-card" key={tier}><div className="staff-avatar"><ShieldCheck size={29} /></div><div><h3>{managerNames[tier]}</h3><p>{number(cost)} to hire · {number(managerWageRatePerBankedHour(tier))}/hr wage</p><p className="small-copy">Repairs below {Math.round(managerAutoRepairCondition(tier) * 100)}% condition.</p></div><button className={hired ? 'secondary' : 'primary'} disabled={busy || hired || ladder.gymBucks < cost} onClick={() => void act({ kind: 'hire-manager', tier }, `${managerNames[tier]} hired.`)}>{hired ? 'Hired' : 'Hire'}</button></article>;
      })}{state.managed.manager && <button className="secondary" disabled={busy} onClick={() => void act({ kind: 'dismiss-manager' }, 'Manager dismissed.')}>Dismiss current manager</button>}<div className="panel maintenance"><p className="eyebrow">EQUIPMENT CARE</p><h3>A floor worth training on.</h3>{owned.map(item => {
        const condition = state.managed.condition[item as ManagedEquipmentItem];
        if (condition === undefined) return null;
        const cost = repairCostGymBucks(state.managed, item as ManagedEquipmentItem);
        return <div className="repair-row" key={item}><div><b>{itemName(item)}</b><span>{Math.round(condition * 100)}% condition</span></div><button className="secondary" disabled={busy || condition >= 1 || ladder.gymBucks < cost} onClick={() => void act({ kind: 'repair-item', item: item as ManagedEquipmentItem }, `${itemName(item)} repaired.`)}>{condition >= 1 ? 'Ready' : `Repair · ${number(cost)}`}</button></div>;
      })}</div></>}
      {busy && <div className="saving-indicator" role="status"><span className="status-dot" />{practice ? 'Updating gym…' : 'Saving your gym…'}</div>}
    </div>
  </section>;
}
