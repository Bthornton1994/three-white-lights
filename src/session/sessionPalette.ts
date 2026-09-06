/**
 * Screen chrome colours for the daily session loop.
 *
 * Built ON `LIFT_PALETTE` rather than beside it: the rep is played inside this
 * loop, so the briefing and the close-out have to sit in the same room as the
 * platform. Everything shared is re-exported from there, and only the handful
 * of colours the session needs and the lift screen does not are added.
 *
 * NOT SPRITE COLOURS. Those live in `src/art/palette.ts` and are sourced from
 * real meet software.
 *
 * Strings rather than numbers on purpose, so they are outside the numeric
 * scan `sessionTuning.test.ts` runs. A colour is not a timing window and does
 * not belong in a block a playtester turns with a stopwatch.
 *
 * ---------------------------------------------------------------------------
 * A×C IRON & AMBER (Bryant-approved visual direction)
 * ---------------------------------------------------------------------------
 * Consume, do not fork. PX owns `design/gym-empire-ux-02/visual-direction/`
 * including `04-iron-amber-visual-spec.md` and `shared-assets/TOKEN-MANIFEST`.
 * Those markdown files were not on Gym Empire branch `cursor/gym-empire-ux-01-9b73`
 * at `77931ea9`. The playable chrome that branch actually paints is in
 * `src/empire/GymScreen.tsx` (CSS named colours, because that tree forbids hex
 * literals). Session A binds to that vocabulary here as hex, which is this
 * directory's palette convention.
 *
 * Named CSS → sRGB hex (CSS Color Module Level 4):
 *   black #000000 · goldenrod #DAA520 · ivory #FFFFF0
 *   darkslategray #2F4F4F · silver #C0C0C0
 *
 * Bounded decision (not PLANNER_ESCALATION): training chrome uses black /
 * goldenrod / ivory / silver. The lift STAGE and Meet Day keep `LIFT_PALETTE`
 * (cool iron #12141a, plate-safe cues). Darkslategray is Gym Empire's named-CSS
 * stand-in for a stage fill under that tree's hex scan — it is not applied as
 * the training backdrop, so Session A does not recolor frozen Meet Day or the
 * mechanic canvas.
 */
import { LIFT_PALETTE } from '../lift/liftPalette';

/** Gym Empire playable A×C tokens, consumed as hex. Not a second palette SoT for sprites. */
export const IRON_AMBER = Object.freeze({
  IRON: '#000000',
  AMBER: '#DAA520',
  IVORY: '#FFFFF0',
  MUTED: '#C0C0C0',
  STAGE_NAMED: '#2F4F4F',
  /** Lifted iron for the readiness card. Not a Gym Empire CSS name. */
  CARD: '#1A1A1A',
  CARD_EDGE: '#2A2A2A',
});

export const SESSION_PALETTE = Object.freeze({
  ...LIFT_PALETTE,

  /** Training chrome frame. LiftStage still paints `LIFT_PALETTE.BACKDROP`. */
  BACKDROP: IRON_AMBER.IRON,
  TEXT: IRON_AMBER.IVORY,
  TEXT_DIM: IRON_AMBER.MUTED,

  /** Idle chip vs the one the finger landed on. Chosen lift is amber fill. */
  CHIP: LIFT_PALETTE.PANEL,
  CHIP_EDGE: LIFT_PALETTE.PANEL_EDGE,
  CHIP_CHOSEN: IRON_AMBER.AMBER,
  CHIP_CHOSEN_EDGE: IRON_AMBER.AMBER,

  /** Readiness card on the opening decision (Screen 03 family). Copy only. */
  CARD: IRON_AMBER.CARD,
  CARD_EDGE: IRON_AMBER.CARD_EDGE,

  /** The RPE the ladder opens on — the obvious training action. */
  RPE_SUGGESTED_EDGE: IRON_AMBER.AMBER,

  /** Readiness copy. Warm when ready, quiet when grinding. */
  MODIFIER_UP: IRON_AMBER.AMBER,
  MODIFIER_LEVEL: IRON_AMBER.IVORY,
  MODIFIER_DOWN: IRON_AMBER.MUTED,

  /** The close-out's PR beat. */
  PR: IRON_AMBER.AMBER,
  PR_GLOW: '#4a3d17',

  /** Set-counter pips: done, current, still to come. */
  PIP_DONE: '#7ddc8f',
  PIP_LIVE: IRON_AMBER.AMBER,
  PIP_TODO: LIFT_PALETTE.PANEL_EDGE,

  /** Primary action (close-out, suggested RPE, chosen lift). */
  ACTION: IRON_AMBER.AMBER,
  ACTION_TEXT: IRON_AMBER.IRON,

  /** Three White Lights identity pips. */
  LIGHT: IRON_AMBER.IVORY,

  DIVIDER: LIFT_PALETTE.PANEL_EDGE,

  /**
   * How sure a progression number is (`progression.ts`'s `ProgressionReading`).
   *
   * PROVISIONAL is the caption under a number the server has not answered for
   * yet. Deliberately quiet — cool and dim, so an in-flight number reads as
   * unfinished rather than as an error. The stronger half of the signal is
   * `SESSION_BOUNDARY.PROJECTED_OPACITY` on the number itself; this only names
   * it.
   *
   * UNSYNCED is the same caption when the cache has gone stale. Warm, because
   * that one IS something being told to the player rather than a beat passing.
   */
  PROVISIONAL: '#6f7a92',
  UNSYNCED: IRON_AMBER.AMBER,
});
