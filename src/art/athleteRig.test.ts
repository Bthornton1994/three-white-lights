import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { createLift, stepLift, type LiftInput, type LiftState } from '../game/lift';
import { LIFT_TUNING } from '../game/liftTuning';
import { liftPresentation, type LiftPresentationState } from '../game/liftPresentation';
import { codeOnly } from '../tuning/audit';
import { PLATE_SPECS } from './plates';
import { ATHLETE_RIG } from './spriteTuning';
import {
  athleteRigInputsFrom,
  heightsPerSecond,
  plateSlotsFrom,
  rigInputPaths,
  type AthleteRigInputs,
} from './athleteRig';

// CODE ONLY — comments and strings blanked, offsets kept — so the header may
// SAY "does not receive LiftState" without the scan reading that sentence as
// the thing it bans. The ban is on code.
const RAW = readFileSync(new URL('./athleteRig.ts', import.meta.url), 'utf8');
// Two views for two questions. Import SPECIFIERS are string literals, so they
// are read from the raw source. The `LiftState` ban is on the IDENTIFIER in
// code, so it reads the code-only view — comments and strings blanked, offsets
// kept — and the header may say "does not receive LiftState" in prose without
// the scan reading that sentence as the thing it bans.
const CODE = codeOnly(RAW);
const WORK_KG = 155;

/**
 * Drive the real engine the way a player does and thread `prior` the way the
 * contract requires — the immediately preceding tick, every tick. The contract
 * is the oracle here: this file never reads `LiftState` fields itself.
 */
function playedRep(loadRatio: number, seed = 1): readonly LiftPresentationState[] {
  let state: LiftState = createLift({ kind: 'squat', loadRatio, seed });
  const views: LiftPresentationState[] = [liftPresentation(state, WORK_KG, null)];
  let guard = 0;
  while (state.phase !== 'RESOLVED' && guard < 900) {
    const next = state.tick + 1;
    let input: LiftInput | null = null;
    if (state.phase === 'BRACE' && !state.held) input = { kind: 'press' };
    else if (
      state.phase === 'DESCENT' &&
      state.held &&
      state.depth >= LIFT_TUNING.DEPTH_IDEAL.squat
    ) {
      input = { kind: 'release' };
    } else if (
      state.activeCue !== null &&
      next >= state.activeCue.idealTick &&
      next <= state.activeCue.closeTick
    ) {
      if (state.activeCue.wants === 'press' && !state.held) input = { kind: 'press' };
      else if (state.activeCue.wants === 'release' && state.held) input = { kind: 'release' };
    } else if (state.held && state.phase === 'ASCENT') {
      input = { kind: 'release' };
    }
    const prior = state;
    state = stepLift(state, input);
    views.push(liftPresentation(state, WORK_KG, prior));
    guard += 1;
  }
  return views;
}

describe('the rig binding invents no mechanical fact', () => {
  // THE GUARANTEE, AS A SOURCE SCAN. A behavioural test cannot tell a value
  // read from the contract from one re-derived beside it — both are
  // well-behaved numbers. Only the import list says where a fact came from.
  it('imports nothing from lift.ts or liftTuning.ts and never receives LiftState [the-rig-binding-invents-no-mechanical-fact]', () => {
    const imports = [...RAW.matchAll(/from '([^']+)'/g)].map((m) => m[1] ?? '');
    // THE BANS RUN FIRST, THE NON-VACUITY PIN LAST — measured on the sibling
    // scan last round: a pin ahead of the bans reddens on the count and aborts
    // before the check that names the defect can speak.
    const mechanical = imports.filter((s) => /\/game\/(lift|liftTuning)$/.test(s));
    expect(mechanical, 'mechanical modules imported by the binding').toEqual([]);
    expect(/\bLiftState\b/.test(CODE), 'LiftState named in the binding’s code').toBe(false);
    // NON-VACUITY: an empty import list satisfies both bans above.
    expect(imports, 'the contract is the one game import').toContain('../game/liftPresentation');
    expect(imports.length, 'imports the scan actually read').toBe(3);
  });
});

describe('athleteRigInputsFrom carries the contract to the rig', () => {
  it('drives a whole squat and barHeight is continuous, falling then rising', () => {
    const views = playedRep(0.8);
    const inputs = views.map(athleteRigInputsFrom);
    // NON-VACUITY, then the fact that separates continuity from a phase swap.
    expect(inputs.length, 'ticks driven through the real engine').toBeGreaterThan(30);
    expect(views.at(-1)?.outcome, 'the driven rep made it').toBe('good-lift');
    const heights = inputs.map((i) => i.barHeight);
    expect(new Set(heights.map((h) => h.toFixed(3))).size, 'distinct heights').toBeGreaterThan(20);
    expect(Math.min(...heights)).toBeLessThan(0.6);
    expect(Math.max(...heights)).toBeGreaterThan(0.9);
  });

  it('barVelocity is the contract’s Δheight in heights per second, signed by direction', () => {
    const views = playedRep(0.8);
    const descent = views.filter((v) => v.phase === 'DESCENT' && v.motionSampleValid);
    const ascent = views.filter((v) => v.phase === 'ASCENT' && v.motionSampleValid);
    expect(descent.length, 'descent ticks with a valid motion sample').toBeGreaterThan(10);
    expect(ascent.length, 'ascent ticks with a valid motion sample').toBeGreaterThan(10);

    // The first DESCENT tick may legitimately read 0 (the contract says so:
    // the phase switches before the depth increment runs). Every later one
    // must fall.
    for (const v of descent.slice(1)) {
      expect(athleteRigInputsFrom(v).barVelocity, `descent tick ${v.tick}`).toBeLessThan(0);
    }
    expect(ascent.some((v) => athleteRigInputsFrom(v).barVelocity > 0), 'the bar rose').toBe(true);

    // Unit: exactly the contract's per-tick value scaled by the shared clock —
    // not normalised, not clamped, not re-derived from barHeight.
    const sample = descent[3]!;
    expect(athleteRigInputsFrom(sample).barVelocity).toBe(heightsPerSecond(sample.barVelocity));
    expect(heightsPerSecond(1)).toBeCloseTo(ATHLETE_RIG.MS_PER_SECOND / (1000 / 60), 6);
  });

  it('an unpaired snapshot says so rather than reading as rest', () => {
    const unpaired = athleteRigInputsFrom(playedRep(0.8)[0]!);
    expect(unpaired.motionSampleValid).toBe(false);
    expect(unpaired.barVelocity).toBe(0);
    const paired = playedRep(0.8).filter((v) => v.motionSampleValid);
    expect(paired.length, 'paired ticks').toBeGreaterThan(30);
  });

  it('mirrors load.discs into fixed slots, inboard first, and counts overflow instead of hiding it', () => {
    const view = playedRep(0.8)[0]!;
    const inputs = athleteRigInputsFrom(view);
    expect(inputs.plates.length).toBe(ATHLETE_RIG.PLATE_SLOTS_PER_SIDE);
    expect(inputs.totalKg).toBe(WORK_KG);

    const on = inputs.plates.filter((p) => p.on);
    expect(on.length, 'lit slots equal the contract’s discs').toBe(view.load.discs.length);
    expect(on.length, 'a 155 kg bar shows plates at all').toBeGreaterThan(0);
    on.forEach((slot, i) => {
      expect(PLATE_SPECS[slot.size]?.kg, `slot ${i} kg`).toBe(view.load.discs[i]?.kg);
    });
    // Inboard first means non-increasing kg along the sleeve.
    for (let i = 1; i < on.length; i += 1) {
      expect(PLATE_SPECS[on[i]!.size]!.kg).toBeLessThanOrEqual(PLATE_SPECS[on[i - 1]!.size]!.kg);
    }
    expect(inputs.platesOverflow).toBe(0);

    // Overflow is reported, never silently truncated: nine 25s on one sleeve.
    const nine = Array.from({ length: 9 }, () => ({ kg: 25, hue: 'RED' as const, diameterMm: 450 }));
    const unrolled = plateSlotsFrom(nine);
    expect(unrolled.plates.filter((p) => p.on).length).toBe(ATHLETE_RIG.PLATE_SLOTS_PER_SIDE);
    expect(unrolled.platesOverflow).toBe(9 - ATHLETE_RIG.PLATE_SLOTS_PER_SIDE);
  });

  it('a disc the ladder does not know is an error, not a blank slot', () => {
    expect(() => plateSlotsFrom([{ kg: 33, hue: 'RED', diameterMm: 450 }])).toThrow(RangeError);
  });

  it('passes grind, strain, band and outcome through without redefining them', () => {
    const views = playedRep(1.0);
    const inputs = views.map(athleteRigInputsFrom);
    // MOVES: a limit rep grinds somewhere, and the binding shows exactly where
    // the contract says it does — no more, no less.
    const contractGrinding = views.filter((v) => v.grindIntensity > 0).length;
    const rigGrinding = inputs.filter((i) => i.grindIntensity > 0).length;
    expect(contractGrinding, 'the limit rep grinds at all').toBeGreaterThan(0);
    expect(rigGrinding).toBe(contractGrinding);
    views.forEach((v, i) => {
      expect(inputs[i]!.strain).toBe(v.strain);
      expect(inputs[i]!.effortBand).toBe(v.effortBand);
    });
    expect(inputs.at(-1)!.complete).toBe(true);
    expect(inputs.at(-1)!.outcome).toBe(views.at(-1)!.outcome);
    expect(inputs[0]!.outcome, 'a live rep has no outcome yet').toBe('none');
  });

  it('commandGlow peaks at the cue’s ideal instant and is full while held', () => {
    const views = playedRep(0.8);
    const cued = views.filter((v) => v.command.cueProgress !== null && !v.command.held);
    expect(cued.length, 'ticks with an armed cue and the finger up').toBeGreaterThan(0);
    const glows = cued.map((v) => ({ cue: v.command.cueProgress!, glow: athleteRigInputsFrom(v).commandGlow }));
    const nearest = glows.reduce((a, b) => (Math.abs(b.cue - 1) < Math.abs(a.cue - 1) ? b : a));
    expect(Math.max(...glows.map((g) => g.glow))).toBe(nearest.glow);
    const held = views.find((v) => v.command.held);
    expect(held, 'a held tick exists').toBeDefined();
    expect(athleteRigInputsFrom(held!).commandGlow).toBe(1);
  });

  it('is pure — the same contract tick maps to the same record', () => {
    const view = playedRep(0.8)[25]!;
    expect(athleteRigInputsFrom(view)).toEqual(athleteRigInputsFrom(view));
  });

  it('names every ViewModel path the .riv must expose, from the record itself', () => {
    const paths = rigInputPaths();
    const record: AthleteRigInputs = athleteRigInputsFrom(playedRep(0.8)[0]!);
    const scalarKeys = Object.keys(record).filter((k) => k !== 'plates');
    expect(paths.length).toBe(scalarKeys.length + 2 * ATHLETE_RIG.PLATE_SLOTS_PER_SIDE);
    expect(paths).toContain('barHeight');
    expect(paths).toContain('plates/0/on');
    expect(paths).toContain(`plates/${ATHLETE_RIG.PLATE_SLOTS_PER_SIDE - 1}/size`);
    expect(new Set(paths).size, 'no duplicate paths').toBe(paths.length);
  });
});
