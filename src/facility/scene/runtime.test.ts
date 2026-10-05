import { describe, expect, it } from 'vitest';
import { createFloorSimState, runFloorSim, stepFloorSim } from '../floorSim';
import { createGymViewState, gymViewReduce, type GymViewState } from '../ladderView';
import { EMPIRE_TUNING } from '../empireTuning';
import { reconcileSceneSimulation, sceneContextFor } from './runtime';

function funded(state: GymViewState): GymViewState {
  return {
    ...state,
    managed: {
      ...state.managed,
      gym: { ...state.managed.gym, ladder: { ...state.managed.gym.ladder, gymBucks: 1_000_000 } },
    },
  };
}

describe('shared scene lifecycle', () => {
  it('takes each simulation input from the facility read model', () => {
    const state = createGymViewState();
    const context = sceneContextFor(state);
    expect(context.floor).toBe(state.floor);
    expect(context.rung).toBe(state.managed.gym.ladder.rung);
    expect(context.barbellOwned).toBe(state.managed.gym.ladder.equipment);
    expect(context.sessionOwned).toBe(state.managed.gym.sessionEquipment);
    expect(context.capability).toBe(state.capability);
    expect(context.livingPopulation).toEqual(state.livingMembers.members.map(member => ({
      memberId: member.id, type: member.type,
    })));
  });

  it('retains the running object and all progress on check-in, purchase, and layout changes', () => {
    let state = funded(createGymViewState());
    const context = sceneContextFor(state);
    const sim = runFloorSim(createFloorSimState(context, 17), context, 137);
    expect(sim.tick).toBe(137);
    expect(sim.members.some(member => member.progress > 0 || member.timer > 0)).toBe(true);
    const changes = [
      { kind: 'advance-clock', gapSeconds: 100, mode: 'online' },
      { kind: 'buy-session', item: 'mats' },
      { kind: 'floor-remove-furniture', item: 'flat-bench' },
    ] as const;
    for (const action of changes) {
      state = gymViewReduce(state, action);
      expect(state.lastRefusal).toBeNull();
      expect(reconcileSceneSimulation(sceneContextFor(state), sim)).toBe(sim);
    }
  });

  it('keeps the same simulation when an equivalent population is reordered', () => {
    const context = sceneContextFor(createGymViewState());
    const sim = runFloorSim(createFloorSimState(context, 41), context, 61);
    const reordered = { ...context, livingPopulation: [...context.livingPopulation].reverse() };
    expect(reconcileSceneSimulation(reordered, sim)).toBe(sim);
  });

  it('adds new identities and removes departed identities while retaining survivor records and counters', () => {
    const context = sceneContextFor(createGymViewState());
    const sim = runFloorSim(createFloorSimState(context, 41), context, 61);
    expect(sim.members.length).toBeGreaterThan(1);
    const departed = context.livingPopulation[0]!;
    const newcomer = { ...departed, memberId: 'member:new-arrival' };
    const changed = { ...context, livingPopulation: [newcomer, ...context.livingPopulation.slice(1)] };
    const reconciled = reconcileSceneSimulation(changed, sim);
    expect(reconciled.tick).toBe(sim.tick);
    expect(reconciled.seed).toBe(sim.seed);
    expect(reconciled.changeovers).toBe(sim.changeovers);
    expect(reconciled.members.find(member => member.memberId === departed.memberId)).toBeUndefined();
    for (const survivor of sim.members.slice(1)) {
      expect(reconciled.members.find(member => member.memberId === survivor.memberId)).toBe(survivor);
    }
    const fresh = reconciled.members.find(member => member.memberId === newcomer.memberId)!;
    expect(fresh.state).toBe('seeking');
    expect(fresh.timer).toBe(0);
    expect(fresh.index).toBeGreaterThan(Math.max(...sim.members.map(member => member.index)));
    expect(reconcileSceneSimulation(changed, reconciled)).toBe(reconciled);
  });

  it('lets the existing interruption transition handle a removed station without a renderer reset', () => {
    const state = createGymViewState();
    const context = sceneContextFor(state);
    let sim = createFloorSimState(context, EMPIRE_TUNING.FLOOR_SIM_RENDER_SEED);
    for (let tick = 0; tick < 600 && !sim.members.some(member => member.state === 'using'); tick++) {
      sim = stepFloorSim(sim, context);
    }
    const using = sim.members.find(member => member.state === 'using')!;
    expect(using).toBeDefined();
    const cleared = gymViewReduce(state, { kind: 'floor-remove-furniture', item: 'flat-bench' });
    const changed = sceneContextFor(cleared);
    expect(reconcileSceneSimulation(changed, sim)).toBe(sim);
    const next = stepFloorSim(sim, changed);
    const interrupted = next.members.find(member => member.memberId === using.memberId)!;
    expect(interrupted.state).toBe('interrupted');
    expect(interrupted.interruptedBy).toBe('target-removed');
    expect(next.tick).toBe(sim.tick + 1);
  });

  it('preserves existing lifters through move-up and initializes only the larger roster', () => {
    const state = funded(createGymViewState());
    const context = sceneContextFor(state);
    const sim = runFloorSim(createFloorSimState(context, 23), context, 83);
    const moved = gymViewReduce(state, { kind: 'move-up' });
    expect(moved.lastRefusal).toBeNull();
    expect(moved.managed.gym.ladder.rung).not.toBe(state.managed.gym.ladder.rung);
    const nextContext = sceneContextFor(moved);
    const reconciled = reconcileSceneSimulation(nextContext, sim);
    expect(reconciled.tick).toBe(83);
    expect(reconciled.seed).toBe(23);
    expect(reconciled.members.length).toBe(nextContext.livingPopulation.length);
    expect(reconciled.members.length).toBeGreaterThan(sim.members.length);
    for (const survivor of sim.members) {
      expect(reconciled.members.find(member => member.memberId === survivor.memberId)).toBe(survivor);
    }
    expect(stepFloorSim(reconciled, nextContext).tick).toBe(84);
  });

  it('updates a changed presentation type without discarding the identity or in-flight action', () => {
    const context = sceneContextFor(createGymViewState());
    const sim = runFloorSim(createFloorSimState(context, 19), context, 44);
    const first = context.livingPopulation[0]!;
    const type: typeof first.type = first.type === 'powerlifter' ? 'casual' : 'powerlifter';
    const changed = { ...context, livingPopulation: [{ ...first, type }, ...context.livingPopulation.slice(1)] };
    const next = reconcileSceneSimulation(changed, sim);
    expect(next.members[0]).toEqual({ ...sim.members[0], type });
    expect(next.tick).toBe(sim.tick);
    expect(next.members[1]).toBe(sim.members[1]);
  });

  it('refuses duplicate population identity instead of rendering one lifter twice', () => {
    const context = sceneContextFor(createGymViewState());
    const sim = createFloorSimState(context, 0);
    expect(() => reconcileSceneSimulation({
      ...context, livingPopulation: [context.livingPopulation[0]!, context.livingPopulation[0]!],
    }, sim)).toThrow(/duplicate member ids/);
  });
});
