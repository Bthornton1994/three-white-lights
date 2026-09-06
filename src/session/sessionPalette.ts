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
 * A×C IRON & AMBER — CONSUME, DO NOT FORK
 * ---------------------------------------------------------------------------
 * PX owns:
 *   design/gym-empire-ux-02/visual-direction/04-iron-amber-visual-spec.md
 *   shared-assets/TOKEN-MANIFEST
 * (and the same files under `visual-direction/shared-assets/`).
 *
 * TRAINING-FIT-02 visual SoT (Session A only; bind, do not invent):
 *   design/session-a-training-fit-02/00-twl-bo-product-bar.md
 *   design/session-a-training-fit-02/01-visual-rework-diagnosis.md
 *   design/session-a-training-fit-02/02-screen-03-impl-contract.md
 *     (hard rejects V1–V8 when present)
 *   design/session-a-training-fit-02/03-developer-packet.md
 *
 * Those files are in-tree. They do not publish hex, so this table still binds
 * Gym Empire playable tokens rather than inventing a second palette. Do not
 * copy `src/empire/` here. Session A binds the tokens that branch paints:
 *
 *   `src/empire/GymScreen.tsx` — CSS named colours (that tree forbids hex)
 *   `index.ts` — html/body/#root warm iron `#1a1410`
 *
 * Named CSS → sRGB hex (CSS Color Module Level 4):
 *   black #000000 · goldenrod #DAA520 · ivory #FFFFF0
 *   darkslategray #2F4F4F · silver #C0C0C0 · gray #808080
 *
 * `sessionPalette.test.ts` re-binds automatically: if PX files or TRAINING-FIT-02
 * packets contain hex, every hex below must occur in them. They currently do
 * not publish hex, so the suite pins the GymScreen / index.ts mapping.
 *
 * Bounded decision (not PLANNER_ESCALATION): the training ROOM uses warm iron
 * void (`#1A1410`). Chrome (chips, card, action text) uses black / goldenrod /
 * ivory / gray. The lift STAGE and Meet Day keep `LIFT_PALETTE` (cool iron
 * `#12141a`, plate-safe cues). Darkslategray is Gym Empire's named-CSS stage
 * fill — it is not the training backdrop, so Session A does not recolor frozen
 * Meet Day or the mechanic canvas.
 */
import { LIFT_PALETTE } from '../lift/liftPalette';

/** Gym Empire playable A×C tokens, consumed as hex. Not a second palette SoT for sprites. */
export const IRON_AMBER = Object.freeze({
  /** GymScreen button background / FAB text — CSS `black`. */
  IRON: '#000000',
  /** index.ts html/body/#root — warm iron void. Not a CSS named colour. */
  VOID: '#1A1410',
  /** GymScreen FAB / borders / primary — CSS `goldenrod`. */
  AMBER: '#DAA520',
  /** GymScreen text / referee lights — CSS `ivory`. */
  IVORY: '#FFFFF0',
  /** GymScreen disabled text — CSS `silver`. */
  MUTED: '#C0C0C0',
  /** GymScreen stage fill — CSS `darkslategray`. Not the training backdrop. */
  STAGE_NAMED: '#2F4F4F',
  /** GymScreen disabled border — CSS `gray`. */
  GRAY: '#808080',
});

export const SESSION_PALETTE = Object.freeze({
  ...LIFT_PALETTE,

  /** Training chrome frame. LiftStage still paints `LIFT_PALETTE.BACKDROP`. */
  BACKDROP: IRON_AMBER.VOID,
  TEXT: IRON_AMBER.IVORY,
  TEXT_DIM: IRON_AMBER.MUTED,

  /** Idle chip vs the one the finger landed on. Chosen lift is amber fill. */
  CHIP: IRON_AMBER.IRON,
  CHIP_EDGE: IRON_AMBER.GRAY,
  CHIP_CHOSEN: IRON_AMBER.AMBER,
  CHIP_CHOSEN_EDGE: IRON_AMBER.AMBER,

  /** Readiness card: GymScreen inspect-style black panel on warm iron. Copy only. */
  CARD: IRON_AMBER.IRON,
  CARD_EDGE: IRON_AMBER.GRAY,

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
  PIP_TODO: IRON_AMBER.GRAY,

  /** Primary action (close-out, START, chosen lift). */
  ACTION: IRON_AMBER.AMBER,
  ACTION_TEXT: IRON_AMBER.IRON,

  /** Three White Lights identity pips. */
  LIGHT: IRON_AMBER.IVORY,

  /**
   * Athletic condensed stack for the briefing lift hero (TRAINING-FIT-02).
   * System fonts only — no Google Fonts, no unlicensed files.
   */
  TYPE_HERO: 'Impact, "Arial Narrow", "Franklin Gothic Medium", sans-serif',

  DIVIDER: IRON_AMBER.GRAY,

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
