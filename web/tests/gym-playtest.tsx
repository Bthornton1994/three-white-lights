/** Development-only fixture. The production Vite entry does not import this file.
 * Seeded wallets/stages are explicit; all subsequent edits use the real reducer. */
import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createGymViewState, gymViewReduce, type GymViewState } from '../../src/facility/ladderView';
import { EMPIRE_TUNING } from '../../src/facility/empireTuning';
import { floorGridSize } from '../../src/facility/floor';
import type { LadderRung } from '../../src/facility/ladder';
import type { FacilityAction, FacilityPort, FacilityResponse } from '../src/facilityPort';
import { equipmentTarget } from '../src/gymModel';
import { Gym, type GymPage } from '../src/Gym';
import '../src/styles.css';
import './gym-fixture.css';
import F from './gym-fixture.json';

function seed(stage: LadderRung | 'capacity'): GymViewState {
  let state = createGymViewState();
  state = { ...state, managed: { ...state.managed, gym: { ...state.managed.gym, ladder: { ...state.managed.gym.ladder, gymBucks: F.seededWalletGymBucks } } } };
  if (stage === 'capacity' || stage === 'garage') return state;
  while (state.managed.gym.ladder.rung !== stage) state = gymViewReduce(state, { kind: 'move-up' });
  for (const item of EMPIRE_TUNING.LADDER_EQUIPMENT_ITEMS) if (!state.managed.gym.ladder.equipment.includes(item)) state = gymViewReduce(state, { kind: 'buy-ladder', item });
  for (const item of EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS) state = gymViewReduce(state, { kind: 'buy-session', item });
  const grid = floorGridSize(state.managed.gym.ladder.rung);
  for (const item of [...state.managed.gym.ladder.equipment, ...state.managed.gym.sessionEquipment]) {
    if (item === 'power-bar' || item === 'comp-plates' || item === 'flat-bench') continue;
    let found = false;
    for (let y = 1; y < grid.height && !found; y++) for (let x = 1; x < grid.width && !found; x++) {
      const candidate = gymViewReduce(state, { kind: 'floor-edit', target: equipmentTarget(item), expectedLayoutRevision: state.floor.layoutRevision, placement: { x, y, rotation: 0 } });
      if (!candidate.lastRefusal) { state = candidate; found = true; }
    }
  }
  state = gymViewReduce(state, { kind: 'hire-manager', tier: 'steady' });
  return state;
}

function Fixture() {
  const [stage, setStage] = useState<LadderRung | 'capacity'>('capacity');
  const [page, setPage] = useState<GymPage>('gym');
  const [inspection, inspect] = useState('');
  const fixture = useMemo(() => {
    let state = seed(stage), fail = false;
    const calls: { action: FacilityAction; key: string; replay: boolean }[] = [];
    const receipts = new Map<string, FacilityResponse>();
    const describe = () => inspect(JSON.stringify({ state, calls }));
    const port: FacilityPort = {
      openingFacility: () => state,
      async facilityAction(action, key) {
        const id = key ?? 'check-in';
        const replay = receipts.has(id);
        calls.push({ action, key: id, replay });
        if (replay) { describe(); return receipts.get(id)!; }
        if (action.kind !== 'check-in') state = gymViewReduce(state, action);
        const response: FacilityResponse = state.lastRefusal ? { kind: 'refused', message: state.lastRefusal, state } : { kind: 'saved', state };
        receipts.set(id, response); describe();
        await new Promise(resolve => setTimeout(resolve, F.acknowledgementDelayMs));
        if (fail) { fail = false; throw new Error('Explicit fixture: acknowledgement lost after commit'); }
        return response;
      },
    };
    return {
      port,
      failNext: () => { fail = true; },
      externalEdit: () => {
        state = gymViewReduce(state, { kind: 'floor-edit', target: { kind: 'furniture', item: 'power-bar' }, expectedLayoutRevision: state.floor.layoutRevision, placement: { x: 0, y: 0, rotation: 0 } }); describe();
      },
    };
  }, [stage]);
  return <div className="app">
    <header className="gym-fixture-header">
      <strong>SEEDED QA FIXTURE · synthetic wallet, no account connection</strong>
      <label>Stage fixture <select value={stage} onChange={event => { setStage(event.target.value as LadderRung | 'capacity'); setPage('gym'); inspect(''); }}>
        <option value="capacity">Capacity scenario</option>{EMPIRE_TUNING.LADDER_RUNGS.map(rung => <option key={rung} value={rung}>{rung}</option>)}
      </select></label>
      <nav>{(['gym', 'build', 'shop', 'staff'] as const).map(value => <button key={value} onClick={() => setPage(value)}>{value}</button>)}</nav>
      <details><summary>Failure fixtures</summary><button onClick={fixture.failNext}>Lose next acknowledgement</button><button onClick={fixture.externalEdit}>Commit another layout revision</button></details>
    </header>
    <main><Gym key={stage} port={fixture.port} page={page} onPage={setPage} onTrain={() => {}} onCareer={() => {}} practice soundEnabled={false} /></main>
    <output hidden id="fixture-state">{inspection}</output>
  </div>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
