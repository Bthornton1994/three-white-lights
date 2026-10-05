import { createFloorSimState, type FloorSimContext, type FloorSimState } from '../floorSim';
import type { GymViewState } from '../ladderView';
import { floorSimPopulationFromRoster } from '../livingMembers';

/** The facility read model supplies the six inputs the floor simulation accepts. */
export function sceneContextFor(state: GymViewState): FloorSimContext {
  const gym = state.managed.gym;
  return Object.freeze({
    rung: gym.ladder.rung,
    floor: state.floor,
    barbellOwned: gym.ladder.equipment,
    sessionOwned: gym.sessionEquipment,
    capability: state.capability,
    livingPopulation: floorSimPopulationFromRoster(state.livingMembers),
  });
}

/** Reconcile population membership without re-opening the running simulation. */
export function reconcileSceneSimulation(
  context: FloorSimContext,
  sim: FloorSimState,
): FloorSimState {
  const population = new Map(context.livingPopulation.map((member) => [member.memberId, member]));
  if (population.size !== context.livingPopulation.length) {
    throw new RangeError('The scene population contains duplicate member ids.');
  }
  const survivors = sim.members.filter((member) => population.has(member.memberId));
  const present = new Set(survivors.map((member) => member.memberId));
  const additions = context.livingPopulation.filter((member) => !present.has(member.memberId));
  const typeChanged = survivors.some((member) => population.get(member.memberId)?.type !== member.type);
  if (survivors.length === sim.members.length && additions.length === 0 && !typeChanged) return sim;

  const members = survivors.map((member) => {
    const type = population.get(member.memberId)!.type;
    return type === member.type ? member : Object.freeze({ ...member, type });
  });
  if (additions.length > 0) {
    const opening = createFloorSimState(context, sim.seed);
    const openingById = new Map(opening.members.map((member) => [member.memberId, member]));
    let index = sim.members.reduce((highest, member) => Math.max(highest, member.index), -1);
    for (const entry of additions) {
      const member = openingById.get(entry.memberId)!;
      index += 1;
      members.push(Object.freeze({ ...member, index }));
    }
  }
  return Object.freeze({ ...sim, members: Object.freeze(members) });
}
