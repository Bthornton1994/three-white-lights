import { describe, expect, it } from 'vitest';
import { createFloorState, placeFloorItem, placeFloorFurniture, type FloorRotation } from './floor';
import { createFloorSimState, stepFloorSim, stepFloorSimWithObservations, withAmbientLivingPopulation, type FloorSimContext } from './floorSim';
import { EMPIRE_TUNING } from './empireTuning';

function rowerContext(): FloorSimContext {
  const empty = { ...createFloorState('garage'), furniture: {} };
  const placed = placeFloorItem(empty, ['rower'], 'rower', { x: 2, y: 0, rotation: 0 });
  if (placed.kind !== 'placed') throw new Error('rower setup failed');
  return withAmbientLivingPopulation({ rung: 'garage', floor: placed.state, barbellOwned: [], sessionOwned: ['rower'], capability: {} });
}

describe('floor rotation simulation lifecycle', () => {
  it.each([90, 180, 270] as const)('interrupts an in-use rower after %s degree rotation in place without replacing members', (rotation: FloorRotation) => {
    const context = rowerContext();
    let sim = createFloorSimState(context, 31);
    for (let tick = 0; tick < 600 && !sim.members.some(member => member.state === 'using'); tick += 1) sim = stepFloorSim(sim, context);
    const using = sim.members.find(member => member.state === 'using');
    expect(using?.target).toEqual({ kind: 'session', item: 'rower' });
    if (using === undefined) throw new Error('fixture did not reach equipment use');
    const rotated = placeFloorItem(context.floor, ['rower'], 'rower', { x: 2, y: 0, rotation });
    expect(rotated.kind).toBe('placed');
    const changed = { ...context, floor: rotated.state };
    const step = stepFloorSimWithObservations(sim, changed);
    const actor = step.state.members.find(member => member.memberId === using.memberId);
    expect(actor?.state).toBe('interrupted');
    expect(actor?.interruptedBy).toBe('target-moved');
    expect(actor?.timer).toBe(EMPIRE_TUNING.FLOOR_SIM_INTERRUPTED_BEAT_TICKS);
    expect(step.observations).toContainEqual(expect.objectContaining({ memberId: using.memberId, outcome: 'interrupted' }));
    expect(step.state.tick).toBe(sim.tick + 1);
    expect(step.state.seed).toBe(sim.seed);
    expect(step.state.members.map(member => [member.memberId, member.index, member.type])).toEqual(sim.members.map(member => [member.memberId, member.index, member.type]));
    let replanned = step.state;
    for (let tick = 0; tick < 600 && !replanned.members.some(member => member.state === 'using'); tick += 1) replanned = stepFloorSim(replanned, changed);
    expect(replanned.members.some(member => member.state === 'using' && member.targetPosition?.rotation === rotation)).toBe(true);
    expect(replanned.tick).toBeGreaterThan(step.state.tick);
    expect(replanned.members.map(member => member.memberId)).toEqual(sim.members.map(member => member.memberId));
  });
});


describe('assembled bay orientation lifecycle', () => {
  it.each(['power-bar', 'comp-plates'] as const)('interrupts the bench station when its %s rotates in place', item => {
    const owned = ['power-bar', 'comp-plates', 'flat-bench'] as const;
    const context = withAmbientLivingPopulation({ rung: 'garage', floor: createFloorState('garage'), barbellOwned: owned, sessionOwned: [], capability: {} });
    let sim = createFloorSimState(context, 31);
    for (let tick = 0; tick < 600 && !sim.members.some(member => member.state === 'using'); tick += 1) sim = stepFloorSim(sim, context);
    const using = sim.members.find(member => member.state === 'using');
    expect(using?.target).toEqual({ kind: 'training', station: 'competition-bench-bay' });
    if (using === undefined) throw new Error('fixture did not reach bay use');
    const position = context.floor.furniture[item];
    if (position === undefined) throw new Error('missing component');
    const rotated = placeFloorFurniture(context.floor, owned, item, { ...position, rotation: 180 });
    expect(rotated.kind).toBe('placed');
    const step = stepFloorSimWithObservations(sim, { ...context, floor: rotated.state });
    expect(step.state.members.find(member => member.memberId === using.memberId)).toMatchObject({ state: 'interrupted', interruptedBy: 'target-moved' });
    expect(step.state.members.map(member => member.memberId)).toEqual(sim.members.map(member => member.memberId));
    expect(step.state.tick).toBe(sim.tick + 1);
  });
});
