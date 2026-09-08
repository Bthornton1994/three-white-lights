/**
 * athleteRig — the frozen mechanics contract, packaged for a rig's ViewModel.
 *
 * ---------------------------------------------------------------------------
 * THE ONE SEAM THE PRODUCTION ATHLETE BINDS TO
 * ---------------------------------------------------------------------------
 * Input is `LiftPresentationState` from `src/game/liftPresentation.ts` — the
 * mechanics lane's handoff (`src/game/LIFT-PRESENTATION.md`, PR #48 at
 * `20bda71d`). Output is the flat record of named inputs the `.riv` exposes
 * (`docs/design/ATHLETE-ASSET-PIPELINE.md` §11). Nothing in between is a
 * mechanic: this module re-derives no velocity, no grind, no strain, no
 * outcome and no load. It renames, converts units, and unrolls one list into
 * fixed slots. That is the whole job, and it is deliberately small.
 *
 *     @guarantee the-rig-binding-invents-no-mechanical-fact
 *
 * THE BINDING READS ONLY THE CONTRACT. It imports nothing from `lift.ts` or
 * `liftTuning.ts` — not a constant, not a threshold, not a type — and it does
 * not receive `LiftState`. A mechanical fact the rig needs and the contract
 * does not carry is a request to the mechanics lane (contract doc §10), never
 * a number computed here from something adjacent. `athleteRig.test.ts` scans
 * this file's imports for exactly that, and the witness in
 * `guaranteeTags.test.ts` records the mutant that reddens it.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS CONVERTED, AND WHY EACH CONVERSION IS PRESENTATION
 * ---------------------------------------------------------------------------
 * - `barVelocity` arrives in height units per TICK (`PRESENTATION_TICK_MS`)
 *   and leaves in heights per SECOND — a real unit, like `barTiltDeg` in
 *   degrees, so a rig authored against it survives a tick-rate retune. It is
 *   NOT normalised to -1..1: a normaliser is a second definition of "fast",
 *   which is the mistake the request doc §2 records twice.
 * - `commandGlow` is derived from `command.cueProgress` and `command.held`.
 *   The contract calls `cueProgress` a timing window, "not a target ring
 *   mandate" — how prominent the cue reads is a visual decision, made here.
 * - `load.discs` (a list) becomes `PLATE_SLOTS_PER_SIDE` fixed `{ size, on }`
 *   pairs, inboard-first, each `size` an index into the plates ladder. A
 *   ViewModel scalar cannot hold a list. Overflow is COUNTED, never hidden.
 * - Bar pose offsets (`barForwardPx`, `barLateralPx`, `barBendPx`) pass through
 *   in the sim's sprite-px unit. The contract says "scale them in the
 *   renderer" — the rig IS the renderer, and the artist scales in the editor.
 *
 * Every other field is a rename. `barHeight` is the primary driver and is
 * passed through untouched: the contract says drive the rig from it, not from
 * phase names, and this module does not disagree.
 */
import { ATHLETE_RIG } from './spriteTuning';
import { PLATE_SPECS } from './plates';
import {
  PRESENTATION_TICK_MS,
  type LiftEffortBand,
  type LiftPlateDisc,
  type LiftPresentationState,
} from '../game/liftPresentation';

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** One authored plate slot on a sleeve. `size` indexes `PLATE_SPECS`, inboard first. */
export interface RigPlateSlot {
  readonly on: boolean;
  /** Index into `PLATE_SPECS` (0 = 25 kg). Meaningless when `on` is false. */
  readonly size: number;
}

/**
 * The named inputs the production `.riv` exposes. Field names are the
 * ViewModel property paths, verbatim — a renamed input is a silent no-op in
 * both Rive runtimes, so the names live in one place and the test pins them.
 */
export interface AthleteRigInputs {
  readonly lift: LiftPresentationState['kind'];
  readonly phase: LiftPresentationState['phase'];
  /** 0 = hole/floor, 1 = lockout. THE driver. */
  readonly barHeight: number;
  /** Heights per second, signed. +rise / -descend. 0 is rest only if `motionSampleValid`. */
  readonly barVelocity: number;
  readonly motionSampleValid: boolean;
  /** The ascent force integrator, heights per second. Stall/grind reads this. */
  readonly integratorVelocity: number;
  readonly strain: number;
  readonly grindIntensity: number;
  readonly effortBand: LiftEffortBand;
  readonly barTiltDeg: number;
  readonly barForwardPx: number;
  readonly barLateralPx: number;
  readonly barBendPx: number;
  readonly commandGlow: number;
  readonly held: boolean;
  readonly pressCommandLive: boolean;
  readonly lockoutHoldLive: boolean;
  readonly chalk: number;
  readonly depthAchieved: boolean;
  readonly lockedOut: boolean;
  readonly complete: boolean;
  /** `'none'` until the rep resolves — a ViewModel enum has no null. */
  readonly outcome: NonNullable<LiftPresentationState['outcome']> | 'none';
  readonly missReason: NonNullable<LiftPresentationState['missReason']> | 'none';
  readonly totalKg: number;
  /** `PLATE_SLOTS_PER_SIDE` entries, inboard first. Mirror for the far sleeve. */
  readonly plates: readonly RigPlateSlot[];
  /** Discs the sleeve could not show. Non-zero is a finding, not a style. */
  readonly platesOverflow: number;
  readonly seed: number;
}

/** Ladder index of a disc, by kg — the contract carries kg, the rig wants a slot size. */
export function plateLadderIndex(disc: LiftPlateDisc): number {
  const index = PLATE_SPECS.findIndex((spec) => spec.kg === disc.kg);
  if (index < 0) {
    throw new RangeError(`plate of ${disc.kg} kg is not on the PLATE_SPECS ladder`);
  }
  return index;
}

/** Unroll `load.discs` into the fixed slots, inboard first; count what does not fit. */
export function plateSlotsFrom(
  discs: readonly LiftPlateDisc[],
): { readonly plates: readonly RigPlateSlot[]; readonly platesOverflow: number } {
  const slots: RigPlateSlot[] = [];
  for (let i = 0; i < ATHLETE_RIG.PLATE_SLOTS_PER_SIDE; i += 1) {
    const disc = discs[i];
    slots.push(
      disc === undefined ? { on: false, size: 0 } : { on: true, size: plateLadderIndex(disc) },
    );
  }
  return {
    plates: slots,
    platesOverflow: Math.max(0, discs.length - ATHLETE_RIG.PLATE_SLOTS_PER_SIDE),
  };
}

/** Height units per tick -> heights per second, on the clock the contract exports. */
export function heightsPerSecond(perTick: number): number {
  return (perTick * ATHLETE_RIG.MS_PER_SECOND) / PRESENTATION_TICK_MS;
}

/**
 * Cue prominence, 0..1. Full while the finger is down; otherwise a peak at
 * the cue's ideal instant (`cueProgress === 1`) falling off either side; zero
 * with no cue armed. A visual reading of a timing window — not the window.
 */
export function commandGlowFrom(view: LiftPresentationState): number {
  if (view.command.held) return 1;
  const cue = view.command.cueProgress;
  if (cue === null) return 0;
  return clamp01(1 - Math.abs(cue - 1));
}

/** Pure. One contract tick in, one rig-input record out. Re-simulates nothing. */
export function athleteRigInputsFrom(view: LiftPresentationState): AthleteRigInputs {
  const { plates, platesOverflow } = plateSlotsFrom(view.load.discs);
  return {
    lift: view.kind,
    phase: view.phase,
    barHeight: view.barHeight,
    barVelocity: heightsPerSecond(view.barVelocity),
    motionSampleValid: view.motionSampleValid,
    integratorVelocity: heightsPerSecond(view.integratorVelocity),
    strain: view.strain,
    grindIntensity: view.grindIntensity,
    effortBand: view.effortBand,
    barTiltDeg: view.barTiltDeg,
    barForwardPx: view.barForwardPx,
    barLateralPx: view.barLateralPx,
    barBendPx: view.barBendPx,
    commandGlow: commandGlowFrom(view),
    held: view.command.held,
    pressCommandLive: view.command.pressCommandLive,
    lockoutHoldLive: view.command.lockoutHoldLive,
    chalk: view.chalkPuff,
    depthAchieved: view.depthAchieved,
    lockedOut: view.lockedOut,
    complete: view.complete,
    outcome: view.outcome ?? 'none',
    missReason: view.missReason ?? 'none',
    totalKg: view.load.totalKg,
    plates,
    platesOverflow,
    seed: view.seed,
  };
}

/** What a rig input is, in the ViewModel's own type vocabulary. */
export type RigInputType = 'number' | 'boolean' | 'enum';

/**
 * One ViewModel property the `.riv` must expose: its path, its type, and —
 * for an enum — every value the binding can ever write to it, which the
 * authored enum must carry or the write is a silent no-op at runtime.
 */
export type RigInputSpec =
  | { readonly path: string; readonly type: 'number' }
  | { readonly path: string; readonly type: 'boolean' }
  | { readonly path: string; readonly type: 'enum'; readonly values: readonly string[] };

/** A spec entry carrying the value the binding writes this tick. */
export type RigInputValue =
  | { readonly path: string; readonly type: 'number'; readonly value: number }
  | { readonly path: string; readonly type: 'boolean'; readonly value: boolean }
  | { readonly path: string; readonly type: 'enum'; readonly values: readonly string[]; readonly value: string };

// THE ENUM VALUE SETS ARE EXHAUSTIVE BY CONSTRUCTION, NOT BY CARE. Each is a
// `Record` keyed on the contract's own union type, so a member the contract
// adds is a compile error here until it is listed, and a member listed here
// that the contract does not have is an excess-property error. No runtime
// list is copied from `lift.ts` — the binding still imports only the contract.
const LIFT_VALUES: Record<LiftPresentationState['kind'], true> = {
  squat: true,
  bench: true,
  deadlift: true,
};
const PHASE_VALUES: Record<LiftPresentationState['phase'], true> = {
  BRACE: true,
  DESCENT: true,
  HOLE: true,
  ASCENT: true,
  LOCKOUT: true,
  RESOLVED: true,
};
const EFFORT_BAND_VALUES: Record<LiftEffortBand, true> = {
  easy: true,
  normal: true,
  hard: true,
  grind: true,
  failing: true,
};
const OUTCOME_VALUES: Record<AthleteRigInputs['outcome'], true> = {
  'good-lift': true,
  grind: true,
  miss: true,
  none: true,
};
const MISS_REASON_VALUES: Record<AthleteRigInputs['missReason'], true> = {
  'no-depth': true,
  buried: true,
  stalled: true,
  timeout: true,
  dropped: true,
  none: true,
};

function enumInput(path: string, value: string, set: Record<string, true>): RigInputValue {
  return { path, type: 'enum', values: Object.keys(set), value };
}

/**
 * The entries one record key contributes. A `switch` over `keyof
 * AthleteRigInputs` with a `never` default, so a field added to the record
 * cannot be forgotten here — the stage writers and the `.riv` schema diff
 * both read this and nothing else.
 */
function rigInputsForKey(key: keyof AthleteRigInputs, inputs: AthleteRigInputs): readonly RigInputValue[] {
  switch (key) {
    case 'lift':
      return [enumInput(key, inputs.lift, LIFT_VALUES)];
    case 'phase':
      return [enumInput(key, inputs.phase, PHASE_VALUES)];
    case 'effortBand':
      return [enumInput(key, inputs.effortBand, EFFORT_BAND_VALUES)];
    case 'outcome':
      return [enumInput(key, inputs.outcome, OUTCOME_VALUES)];
    case 'missReason':
      return [enumInput(key, inputs.missReason, MISS_REASON_VALUES)];
    case 'barHeight':
    case 'barVelocity':
    case 'integratorVelocity':
    case 'strain':
    case 'grindIntensity':
    case 'barTiltDeg':
    case 'barForwardPx':
    case 'barLateralPx':
    case 'barBendPx':
    case 'commandGlow':
    case 'chalk':
    case 'totalKg':
    case 'platesOverflow':
    case 'seed':
      return [{ path: key, type: 'number', value: inputs[key] }];
    case 'motionSampleValid':
    case 'held':
    case 'pressCommandLive':
    case 'lockoutHoldLive':
    case 'depthAchieved':
    case 'lockedOut':
    case 'complete':
      return [{ path: key, type: 'boolean', value: inputs[key] }];
    case 'plates':
      // Nested-path grammar: `plates/<i>/on`, `plates/<i>/size`.
      return inputs.plates.flatMap((slot, i): readonly RigInputValue[] => [
        { path: `plates/${i}/on`, type: 'boolean', value: slot.on },
        { path: `plates/${i}/size`, type: 'number', value: slot.size },
      ]);
    default: {
      const unhandled: never = key;
      throw new Error(`rig input without a ViewModel entry: ${String(unhandled)}`);
    }
  }
}

/**
 * Every write a stage makes this tick — path, type and value — in record
 * order. Both production stages loop over this rather than naming paths
 * themselves, so the list the `.riv` is checked against and the list the
 * runtime is written with are one list.
 */
export function rigInputValues(inputs: AthleteRigInputs): readonly RigInputValue[] {
  const out: RigInputValue[] = [];
  for (const key of Object.keys(inputs) as (keyof AthleteRigInputs)[]) {
    out.push(...rigInputsForKey(key, inputs));
  }
  return out;
}

/**
 * Every ViewModel property the `.riv` must expose, typed, derived from the
 * record itself so the list and the type cannot drift. This is what
 * `src/art/rivContract.ts` diffs an authored asset against.
 */
export function rigInputSpec(): readonly RigInputSpec[] {
  return rigInputValues(athleteRigInputsFrom(EMPTY_VIEW)).map((input): RigInputSpec =>
    input.type === 'enum'
      ? { path: input.path, type: 'enum', values: input.values }
      : { path: input.path, type: input.type },
  );
}

/** The paths alone — `rigInputSpec()` without the types. */
export function rigInputPaths(): readonly string[] {
  return rigInputSpec().map((input) => input.path);
}

/**
 * A structurally complete, mechanically empty contract value — for deriving
 * the path list above without driving the engine. Not a fixture for
 * behaviour; the tests drive the real engine through `liftPresentation`.
 */
const EMPTY_VIEW: LiftPresentationState = {
  kind: 'squat',
  phase: 'BRACE',
  tick: 0,
  phaseTick: 0,
  barHeight: 1,
  depth: 0,
  barVelocity: 0,
  motionSampleValid: false,
  integratorVelocity: 0,
  peakHeight: 1,
  netForce: 0,
  strain: 0,
  grindIntensity: 0,
  effortBand: 'easy',
  stallTicks: 0,
  ascentTicks: 0,
  depthAchieved: false,
  extraDepth: 0,
  chalkPuff: 0,
  barForwardPx: 0,
  barLateralPx: 0,
  barTiltDeg: 0,
  barBendPx: 0,
  load: { totalKg: 0, barKg: 0, loadRatio: 0, discs: [], remainderKg: 0 },
  command: { held: false, cueProgress: null, pressCommandLive: false, lockoutHoldLive: false },
  lastTiming: null,
  events: [],
  resolution: null,
  outcome: null,
  missReason: null,
  lockedOut: false,
  complete: false,
  chestApproach: null,
  benchGrind: null,
  seed: 0,
};
