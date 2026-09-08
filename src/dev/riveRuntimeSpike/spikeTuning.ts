/**
 * spikeTuning — the Rive runtime spike's own numbers, named so they are not
 * bare and registered as `local` in `src/tuning/audit.ts`.
 *
 * `local`, NOT `feel`, on purpose: nothing here is a knob a playtester should
 * ever turn. These are the periods of synthetic sine/ease curves that stand
 * in for a rep so the RUNTIME can be exercised, plus the dev screen's own
 * layout. They describe no athlete and no mechanic, and they are deleted with
 * the spike. Registering them as `feel` would put them in
 * `src/tuning/index.ts` beside real game-feel values, which is exactly the
 * confusion the ruling separating "prove the runtime" from "prove the
 * artwork" exists to prevent.
 */

/** Shape of the synthetic feed — see `spikeSignal.ts`. */
export const SPIKE_SIGNAL = Object.freeze({
  /** One synthetic rep, ms. Short so a 60fps write stream visibly cycles. */
  REP_PERIOD_MS: 1800,
  /** Slow envelope on `strain`, ms — three reps per strain cycle. */
  STRAIN_PERIOD_MS: 5400,
  /** Where in the rep (0..1) the fake sticking point peaks. */
  GRIND_PEAK_PHASE: 0.92,
  /** Half-width of the grind spike around that peak, in rep phase. */
  GRIND_WINDOW: 0.18,
  /** Ease-in-out switches curves at this rep phase. */
  EASE_SPLIT: 0.5,
  /** `strain` sits between FLOOR and FLOOR + SPAN. */
  STRAIN_FLOOR: 0.3,
  STRAIN_SPAN: 0.7,
});

/** The stage's write cadence and box. */
export const SPIKE_STAGE = Object.freeze({
  /** 60 writes a second into the ViewModel — the rate a real rep would drive. */
  FRAME_INTERVAL_MS: 1000 / 60,
  /** Fixed stage height, dp. */
  HEIGHT: 320,
  /**
   * The test asset's one number, `health`, is authored 0..100 (its own state
   * machine reads it against that range). The synthetic 0..1 `barHeight` is
   * scaled onto it so the bar visibly drains and refills once per rep.
   */
  HEALTH_SPAN: 100,
});

/** The dev screen's chrome. Colours come from `LIFT_PALETTE`, not here. */
export const SPIKE_LAYOUT = Object.freeze({
  PADDING_TOP: 48,
  PADDING_HORIZONTAL: 16,
  HEADING_SIZE: 14,
  HEADING_GAP: 8,
  STATUS_SIZE: 12,
  STATUS_GAP: 12,
});

/**
 * The athlete acceptance harness's playback (`src/dev/athleteAcceptance/`),
 * dev-only like everything here: how long a scenario's last frame is held
 * before the next scenario starts, and how often the DOM probe is rewritten.
 * The rep itself is never timed by these — every tick is the real mechanic's,
 * replayed on `PRESENTATION_TICK_MS`.
 */
export const ACCEPTANCE_PLAYBACK = Object.freeze({
  /** Ticks the resolved frame is held so a reader (or a probe) can see the ending. */
  HOLD_TICKS_AT_END: 45,
  /** The probe text is rewritten on every this-many-th tick, and at every scenario boundary. */
  PROBE_EVERY_TICKS: 10,
  /** Widest the stage box gets, dp; the box keeps the artboard's aspect below that. */
  STAGE_MAX_HEIGHT: 520,
  PROBE_FONT_SIZE: 9,
});
