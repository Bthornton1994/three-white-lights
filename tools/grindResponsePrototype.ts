/**
 * Session A grind-response prototype. ISOLATED. Not wired into the played
 * lift. Production `stepLift` / `LIFT_TUNING` are not imported for mutation
 * and no additive-band constant is read.
 *
 * The stepper calls the real `stepLift`, then re-integrates THE ASCENT FORCE
 * BALANCE ONLY with a surplus-compressed useful force. Charge, taps, launch,
 * descent, false-start, squat, deadlift, and every demand addend stay the
 * engine's.
 *
 * Identity: `compress = 1` is byte-identical to `stepLift` on the fields the
 * probe asserts (height, velocity, stall, outcome). The probe pins that.
 */
import {
  ascentDemand,
  ascentTimeoutTicksFor,
  benchWorkingExcess,
  isGrind,
  lifterCapacity,
  stepLift,
  type LiftInput,
  type LiftState,
  type LiftOutcome,
  type MissReason,
} from '../src/game/lift';
import {
  LIFT_COPY,
  LIFT_TUNING,
  STICK_HEIGHT_FRAC,
  STICK_WIDTH,
} from '../src/game/liftTuning';
export interface SurplusCompressSpec {
  /** Below this grindForce, useful force is unchanged. */
  readonly floorForce: number;
  /** 1 = identity. 0 = hard cap at floorForce. */
  readonly compress: number;
  /** 0 = compress everywhere. 1 = compress only at the stick gaussian peak. */
  readonly stickWeight: number;
}

export function stickGauss(height: number): number {
  const z = (height - STICK_HEIGHT_FRAC.bench) / STICK_WIDTH.bench;
  return Math.exp(-z * z);
}

export function surplusCompress(force: number, height: number, spec: SurplusCompressSpec): number {
  const f = Number.isFinite(force) && force > 0 ? force : 0;
  if (f <= spec.floorForce) return f;
  const compressed = spec.floorForce + (f - spec.floorForce) * spec.compress;
  if (spec.stickWeight <= 0) return compressed;
  const g = stickGauss(height);
  const w = spec.stickWeight * g;
  return f * (1 - w) + compressed * w;
}

/**
 * Force that holds net = 0 at a given demand. Derived from capacity, demand,
 * and GRIND_BOOST_FORCE_MAX — not a probe knob. Surplus compression with this
 * as floorForce keeps the force that prevents a stall and taxes only the rest.
 */
export function stickBreakEvenForce(demand: number, capacity: number): number {
  const boost = LIFT_TUNING.GRIND_BOOST_FORCE_MAX;
  if (!(boost > 0)) return 1;
  const need = (demand - capacity) / boost;
  if (need <= 0) return 0;
  if (need >= 1) return 1;
  return need;
}

function scrub(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Number(value.toFixed(LIFT_TUNING.PRECISION_DECIMALS));
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function missResolution(
  state: LiftState,
  reason: MissReason,
): NonNullable<LiftState['resolution']> {
  return {
    outcome: 'miss',
    missReason: reason,
    peakHeight: scrub(state.peakHeight),
    depthAchieved: state.depthAchieved,
    ascentTicks: state.ascentTicks,
    stallTicks: state.stallTicks,
    timings: state.timings.map((t) => ({ ...t })),
    headline: LIFT_COPY.OUTCOME.miss,
    detail: LIFT_COPY.MISS_REASON[reason],
  };
}

function outcomeResolution(
  state: LiftState,
  outcome: LiftOutcome,
): NonNullable<LiftState['resolution']> {
  return {
    outcome,
    missReason: null,
    peakHeight: scrub(state.peakHeight),
    depthAchieved: state.depthAchieved,
    ascentTicks: state.ascentTicks,
    stallTicks: state.stallTicks,
    timings: state.timings.map((t) => ({ ...t })),
    headline: LIFT_COPY.OUTCOME[outcome],
    detail: '',
  };
}

/**
 * One tick. `spec = null` is the current engine. `compress = 1` is also the
 * current engine, and is what the identity pin uses.
 */
export function stepLiftPrototype(
  prev: LiftState,
  input: LiftInput | null,
  spec: SurplusCompressSpec | null,
): LiftState {
  const next = stepLift(prev, input);
  if (spec === null) return next;
  if (prev.config.kind !== 'bench') return next;
  if (prev.phase !== 'ASCENT') return next;

  const useful = surplusCompress(next.grindForce, prev.height, spec);
  const load = prev.config.loadRatio;
  const capacity = lifterCapacity(prev.config);
  const touchShortfall = 1 - (Number.isFinite(prev.touchQuality) ? prev.touchQuality : 0);
  const demand = ascentDemand(
    prev.height,
    load,
    'bench',
    prev.extraDepth,
    touchShortfall,
    benchWorkingExcess(prev.config),
  );
  const drive = capacity - prev.stallCapacityLoss + LIFT_TUNING.GRIND_BOOST_FORCE_MAX * useful;
  const netForce = scrub(drive - demand);
  const targetVelocity = netForce * LIFT_TUNING.VELOCITY_PER_NET_FORCE;
  const velocity = scrub(
    clamp(
      prev.velocity + (targetVelocity - prev.velocity) * LIFT_TUNING.VELOCITY_RESPONSE,
      -LIFT_TUNING.MAX_SINK_VELOCITY,
      LIFT_TUNING.MAX_RISE_VELOCITY,
    ),
  );
  const height = scrub(
    clamp(prev.height + velocity, -LIFT_TUNING.ASCENT_COLLAPSE_DROP, 1),
  );
  const peakHeight = height > prev.peakHeight ? height : prev.peakHeight;
  const depth = scrub(clamp(1 - height, 0, LIFT_TUNING.DEPTH_COLLAPSE.bench));

  let stallCapacityLoss = prev.stallCapacityLoss;
  if (velocity <= LIFT_TUNING.STALL_DECAY_VELOCITY) {
    stallCapacityLoss = scrub(
      Math.min(
        LIFT_TUNING.STALL_CAPACITY_DECAY_MAX,
        stallCapacityLoss + LIFT_TUNING.STALL_CAPACITY_DECAY_PER_TICK,
      ),
    );
  }
  let stallTicks = prev.stallTicks;
  let lastStallPulseTick = prev.lastStallPulseTick;
  const events = next.events.filter((e) => e.kind !== 'stall-pulse' && e.kind !== 'lockout');
  const tick = next.tick;
  if (velocity < LIFT_TUNING.GRIND_STALL_VELOCITY) {
    stallTicks += 1;
    if (tick - lastStallPulseTick >= LIFT_TUNING.STALL_PULSE_PERIOD_TICKS) {
      lastStallPulseTick = tick;
      events.push({ kind: 'stall-pulse', tick });
    }
  }

  const ascentTicks = next.ascentTicks;
  const timeout = ascentTimeoutTicksFor(prev.config);

  if (height >= 1) {
    events.push({ kind: 'lockout', tick });
    const locked: LiftState = {
      ...next,
      phase: 'LOCKOUT',
      phaseTick: 0,
      height: 1,
      depth: 0,
      velocity: 0,
      peakHeight: peakHeight > 1 ? 1 : peakHeight,
      netForce,
      stallTicks,
      stallCapacityLoss,
      lastStallPulseTick,
      activeCue: null,
      events,
      resolution: null,
    };
    return locked;
  }

  if (peakHeight - height >= LIFT_TUNING.ASCENT_COLLAPSE_DROP) {
    const collapsed: LiftState = {
      ...next,
      phase: 'RESOLVED',
      phaseTick: 0,
      height,
      depth,
      velocity,
      peakHeight,
      netForce,
      stallTicks,
      stallCapacityLoss,
      lastStallPulseTick,
      events,
      resolution: null,
    };
    const resolution = missResolution(collapsed, 'stalled');
    events.push({ kind: 'resolved', tick });
    return { ...collapsed, resolution, events };
  }

  if (ascentTicks >= timeout) {
    const timed: LiftState = {
      ...next,
      phase: 'RESOLVED',
      phaseTick: 0,
      height,
      depth,
      velocity,
      peakHeight,
      netForce,
      stallTicks,
      stallCapacityLoss,
      lastStallPulseTick,
      events,
      resolution: null,
    };
    const resolution = missResolution(timed, 'timeout');
    events.push({ kind: 'resolved', tick });
    return { ...timed, resolution, events };
  }

  return {
    ...next,
    phase: 'ASCENT',
    phaseTick: prev.phase === 'ASCENT' ? prev.phaseTick + 1 : next.phaseTick,
    height,
    depth,
    velocity,
    peakHeight,
    netForce,
    stallTicks,
    stallCapacityLoss,
    lastStallPulseTick,
    events,
    resolution: null,
  };
}

/** Apply the prototype through lockout so grind/good-lift classification is real. */
export function resolvePrototypeLockout(state: LiftState): LiftState {
  if (state.phase !== 'LOCKOUT' || state.resolution !== null) return state;
  if (state.config.kind !== 'bench') return state;
  const outcome: LiftOutcome = !state.depthAchieved
    ? 'miss'
    : isGrind(state.stallTicks, state.ascentTicks)
      ? 'grind'
      : 'good-lift';
  if (outcome === 'miss') {
    return { ...state, resolution: missResolution(state, 'no-depth') };
  }
  return { ...state, resolution: outcomeResolution(state, outcome) };
}
