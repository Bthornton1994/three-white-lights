/**
 * THE ONE PLACE.
 *
 * CLAUDE.md: "Keep every such value as a named constant in one place." GDD
 * §12.1: "a playable, tunable artifact with every game-feel value exposed as a
 * named constant in one place. Feel tuning happens afterward, by hand, with
 * real people playing. Plan for roughly 30 iterations."
 *
 * This is that place. Open this file and you can see, and reach, every tuned
 * value in the game.
 *
 * ---------------------------------------------------------------------------
 * IT IS A REGISTRY, NOT A CONCATENATION, AND THAT WAS A DECISION
 * ---------------------------------------------------------------------------
 * The tuned values physically live beside the mechanics they belong to —
 * `spriteTuning.ts`, `liftTuning.ts`, `sessionTuning.ts`, `cardTuning.ts`, and
 * blocks like `FATIGUE_TUNING` and `RECOVERY_DAY_GUARDRAILS` that sit at the
 * top of their own module. Merging them into one physical file was considered
 * and rejected for three reasons:
 *
 *   1. `spriteTuning.ts` is imported by the offline sprite tool in `tools/`,
 *      which would then be pulling in the session loop's copy strings and the
 *      meet engine's rules to render a contact sheet.
 *   2. Each block's comments are half its value — several run longer than the
 *      values they explain — and they are about the mechanic they belong to. A
 *      merged file is 4000 lines of unrelated prose with numbers in it, which
 *      is harder to tune from, not easier.
 *   3. It is a merge magnet. This run has several builders working in parallel
 *      worktrees; a single tuning file collides on every one of them.
 *
 * So "one place" is delivered as one REGISTRY, and it is only worth anything
 * because it is enforced rather than asserted:
 *
 *   - `TUNING` below re-exports every block. One import reaches all of them.
 *   - `src/tuning/audit.ts` holds the closed list of files allowed to contain
 *     a bare number at all, and `audit.test.ts` runs it over the whole tree on
 *     every `vitest run`. A fifth scattering cannot appear quietly: a number
 *     put anywhere else fails the suite, naming the file, the line and the
 *     literal.
 *   - `audit.test.ts` also cross-checks the two: every module registered as a
 *     `feel` constants home must appear in `TUNING_MODULES` here, and every
 *     module here must be registered there. Neither list can drift.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS AND IS NOT IN HERE
 * ---------------------------------------------------------------------------
 * `TUNING` is the `feel` half: timing windows, animation curves, haptic
 * patterns, difficulty thresholds, layout. These are what the 30 passes move.
 *
 * `PALETTES` is colour. Separate because a colour is not turned with a
 * stopwatch, and because the sprite banks are sourced from real meet software
 * and are not ours to "balance".
 *
 * DELIBERATELY ABSENT: the published domain data. The RPE chart, the DOTS
 * coefficients, Epley's divisor, the IPF plate ladder and the meet's attempt
 * rules are NOT knobs. GDD §12.3 sends the work back for homebrewed RPE, e1RM
 * or DOTS values, so exposing them through the tuning index — where the whole
 * invitation is "turn these" — would be building the trap. They are registered
 * in `audit.ts` as `data`, which is where you look to find out that a number
 * exists and must not be moved.
 *
 * NONE OF THESE VALUES HAVE BEEN PLAYED. Every one is a starting point.
 */

import * as CARD_TUNING from '../card/cardTuning';
import * as SPRITE_TUNING_MODULE from '../art/spriteTuning';
import { LIFT_COPY, LIFT_TUNING } from '../game/liftTuning';
import {
  CHECK_IN_QUESTIONS,
  SESSION_COPY,
  SESSION_LAYOUT,
  SESSION_PREVIEW,
  SESSION_PROGRESSION_GUARD,
  SESSION_TUNING,
} from '../game/sessionTuning';
import {
  MEET_COPY,
  MEET_ENTRY,
  MEET_LAYOUT,
  MEET_LOCAL,
  MEET_PREVIEW,
  MEET_SOUND,
  MEET_TUNING,
} from '../game/meetTuning';
import { FATIGUE_COPY, FATIGUE_TUNING } from '../game/fatigue';
import {
  RECOVERY_DAY_GUARDRAILS,
  STREAK_DAY_BOUNDARY,
  STREAK_MILESTONE_DAYS,
} from '../game/streak';
import { RECOVERY_ENTITLEMENT } from '../game/streakEntitlement';
import {
  GYM_CLEAR_BAND,
  GYM_CONTACT_SHADOW,
  GYM_CROWD,
  GYM_FLOOR_PLAN,
  GYM_LIFT_STAGE,
  GYM_LIGHTING,
  GYM_PARALLAX,
  GYM_PROPS_MEET,
  GYM_PROPS_TRAINING,
  GYM_READABILITY,
  GYM_ROOM,
  GYM_STAGE_CHROME,
  GYM_VENUE,
  GYM_WALL_PAINT,
} from '../art/gymTuning';
import {
  COLORWAY_RAMP,
  LICENSING_COPY,
  LICENSING_SCREEN,
  PANEL,
  PANEL_TEXT,
  RAMP_STEPS,
  SHELF,
  TIER_1_STRIP,
} from '../licensing/licensingTuning';
import {
  CUT_IN_ART,
  CUT_IN_COPY,
  CUT_IN_LAYOUT,
  CUT_IN_PANEL,
  CUT_IN_TUNING,
} from '../cutin/cutInTuning';
import { SHELL_COPY, SHELL_LAYOUT, SHELL_NAV } from '../shell/shellTuning';
import { PALETTE_BANKS, PAL, RAMPS } from '../art/palette';
import { GYM, GYM_BANKS, GYM_RAMPS } from '../art/gymPalette';
import { SHEET, SHEET_BANK } from '../card/sheetPalette';
import { LIFT_PALETTE } from '../lift/liftPalette';
import { SESSION_PALETTE } from '../session/sessionPalette';
import { MEET_PALETTE } from '../meet/meetPalette';
import { EMPIRE_TUNING, EMPIRE_TUNING_CLASSIFICATION } from '../empire/empireTuning';

/**
 * Every hand-tuned block in the game, grouped by the thing it tunes.
 *
 * The grouping is by MECHANIC, not by file, because that is how a tuning pass
 * is actually run: someone plays a rep and wants the rep's numbers, or plays a
 * session and wants the session's.
 */
export const TUNING = Object.freeze({
  /**
   * THE REP. Depth window, drive window, force balance, haptics, the cue ring.
   * The first thing to tune and the thing GDD §12.1 says cannot be judged
   * without a hand on a phone.
   */
  rep: Object.freeze({ LIFT_TUNING, LIFT_COPY }),

  /**
   * THE SPRITE. Frame timing, load response, strain and pitch ladders, bar
   * bend, chalk, shading. Runs on the same 60 Hz clock as the rep.
   */
  sprite: Object.freeze({
    TICK_HZ: SPRITE_TUNING_MODULE.TICK_HZ,
    TICK_MS: SPRITE_TUNING_MODULE.TICK_MS,
    RESOLUTION: SPRITE_TUNING_MODULE.RESOLUTION,
    QUANTISE: SPRITE_TUNING_MODULE.QUANTISE,
    BAR: SPRITE_TUNING_MODULE.BAR,
    LOAD_PRESETS: SPRITE_TUNING_MODULE.LOAD_PRESETS,
    LOAD_RANGE: SPRITE_TUNING_MODULE.LOAD_RANGE,
    TIMING: SPRITE_TUNING_MODULE.TIMING,
    DESCENT: SPRITE_TUNING_MODULE.DESCENT,
    STICK: SPRITE_TUNING_MODULE.STICK,
    BAR_PATH: SPRITE_TUNING_MODULE.BAR_PATH,
    BEND: SPRITE_TUNING_MODULE.BEND,
    STRAIN: SPRITE_TUNING_MODULE.STRAIN,
    PITCH: SPRITE_TUNING_MODULE.PITCH,
    DEFORM_FOLLOW: SPRITE_TUNING_MODULE.DEFORM_FOLLOW,
    SHADING: SPRITE_TUNING_MODULE.SHADING,
    SHADOW: SPRITE_TUNING_MODULE.SHADOW,
    CHALK: SPRITE_TUNING_MODULE.CHALK,
    BRACE_SETTLE_DEPTH: SPRITE_TUNING_MODULE.BRACE_SETTLE_DEPTH,
  }),

  /**
   * THE ROOM. What the lift happens in: how far back the wall is, where the
   * lamps hang, how much of the frame the platform takes, which prop stands
   * where, and how fast each layer slides under a camera nothing pans yet.
   *
   * GDD §12.2 grades this on readability at phone scale, so `GYM_READABILITY`
   * is here too — but read its comment before turning anything in it. It is the
   * definition of the measurement, not a difficulty setting, and loosening it
   * turns the suite red rather than green.
   */
  gym: Object.freeze({
    GYM_ROOM,
    GYM_WALL_PAINT,
    GYM_FLOOR_PLAN,
    GYM_LIGHTING,
    GYM_CROWD,
    GYM_PARALLAX,
    GYM_PROPS_TRAINING,
    GYM_PROPS_MEET,
    GYM_VENUE,
    GYM_CLEAR_BAND,
    GYM_CONTACT_SHADOW,
    GYM_LIFT_STAGE,
    GYM_STAGE_CHROME,
    GYM_READABILITY,
  }),

  /**
   * THE DAILY SESSION. Beat durations, the check-in, the RPE ladder, screen
   * layout, close-out copy. Judged against Duolingo (GDD §12.2), so the
   * durations here are the ones that decide whether it feels flabby.
   */
  session: Object.freeze({
    SESSION_TUNING,
    SESSION_LAYOUT,
    SESSION_COPY,
    SESSION_PREVIEW,
    SESSION_PROGRESSION_GUARD,
    CHECK_IN_QUESTIONS,
  }),

  /**
   * MEET DAY. The walk-out beat, the "judges deliberating" delay, the
   * light-reveal stagger, the bomb-out silence, and the four thresholds that
   * decide when a call is close. GDD §12.2 judges this piece against broadcast
   * footage of a third-attempt walkout and says to judge PACING AND SOUND —
   * which is exactly what `MEET_TUNING` and `MEET_SOUND` are, and none of it
   * has been played or heard.
   *
   * `MEET_TUNING.HAPTICS` is in here too, so the three things a meet beat is
   * made of — how long it holds, what it feels like, what it sounds like — are
   * all reachable from this one file. Turning `MEET_SOUND` means re-running
   * `node tools/sound.mjs`; the suite fails if you forget.
   */
  meet: Object.freeze({
    MEET_TUNING,
    MEET_SOUND,
    MEET_LAYOUT,
    MEET_COPY,
    MEET_LOCAL,
    MEET_ENTRY,
    MEET_PREVIEW,
  }),

  /**
   * FATIGUE AND INJURY. Difficulty thresholds — deliberately game-feel rather
   * than physiology (CLAUDE.md), so these are meant to be moved until the day
   * after a hard session feels right, not until they match a study.
   *
   * GDD §3.4/§12.3: this surfaces as bar speed, window width and readiness
   * copy. There is no meter and nothing here may become one.
   */
  fatigue: Object.freeze({ FATIGUE_TUNING, FATIGUE_COPY }),

  /**
   * THE STREAK AND RECOVERY DAYS. GDD §4.2's guardrails and free-earning path.
   * §12.3: a player who shows up every day must never feel penalised, so these
   * are tuned for forgiveness first.
   */
  streak: Object.freeze({
    STREAK_DAY_BOUNDARY,
    RECOVERY_DAY_GUARDRAILS,
    STREAK_MILESTONE_DAYS,
  }),

  /**
   * WHAT FUNDS A STREAK SAVE, since GDD §4.2's Option 1 ruling: a rolling
   * entitlement of covered days per window, rather than a balance the lifter
   * holds. Its own group rather than a row of `streak` because it lives in its
   * own module, and it lives in its own module because the monotonicity
   * property the whole piece exists for is a property of THIS arithmetic.
   *
   * TURN THESE FREELY. `streakEntitlement.test.ts` re-checks the property
   * across a grid of window lengths and entitlement sizes, so moving them
   * cannot move the property — only how forgiving the game feels, which is
   * exactly what a playtester is for.
   */
  streakEntitlement: Object.freeze({
    RECOVERY_ENTITLEMENT,
  }),

  /**
   * THE IDENTITY TIER SURFACES (GDD §7.3). The shop shelf and character
   * select: panel proportions in card pixels, the screen chrome around them in
   * points, and the copy that states §8.1's no-stat promise where a player can
   * read it rather than only where a test can.
   *
   * `PANEL.W` and `SHELF.COLUMNS` are joined at the hip to the phone: the sheet
   * can only be drawn at whole multiples (§7.1), and the current pair is the
   * widest that still doubles inside a 390pt viewport. Move either and re-shoot
   * before believing the result.
   */
  licensing: Object.freeze({
    PANEL,
    TIER_1_STRIP,
    PANEL_TEXT,
    SHELF,
    RAMP_STEPS,
    COLORWAY_RAMP,
    LICENSING_SCREEN,
    LICENSING_COPY,
  }),

  /**
   * THE CUT-IN GATE (GDD §7.2). How often the game is allowed to interrupt the
   * player, and for how long.
   *
   * `SESSION_ALLOWANCE` is the one to turn first and the one most likely to be
   * wrong. §7.2 gives a hard rule and a soft one — "no more than one per
   * session, ideally not every session" — and only the hard one is a number the
   * document states. The soft one is four rates guessed at by reading the
   * paragraph, and §7.2's own failure case ("a 2-second tax that players resent
   * by day 4") is a feeling, not a threshold. Turn these after four days of
   * play, not after one.
   *
   * `MAX_PER_SESSION` IS IN THIS BLOCK AND IS NOT A KNOB. GDD §12.3 lists
   * "cut-ins firing more than once per session" as a refusal condition. It is
   * here because the audit requires every number to have a home, not because it
   * is yours to move; its own comment says so at length.
   *
   * `CUT_IN_PANEL` is the interrupt's own grid in CARD PIXELS — a different unit
   * from `CUT_IN_LAYOUT`, which is logical points. Its proportions are the least
   * evidenced numbers in the block: the cut-in composes its own shape rather
   * than borrowing the shop panel's, so how wide and how tall an interrupt
   * should be is a judgement nobody in this run made with a phone in their hand.
   */
  cutIn: Object.freeze({ CUT_IN_TUNING, CUT_IN_ART, CUT_IN_PANEL, CUT_IN_LAYOUT, CUT_IN_COPY }),

  /**
   * THE APP SHELL. The one control that carries a player between the daily loop
   * (GDD §3.2) and meet day (GDD §6), and the rules about when it may be on
   * screen at all.
   *
   * `SHELL_NAV.SESSION_PHASES` and `MEET_PHASES` are the ones to turn first and
   * the ones most likely to be wrong: they are a guess at when a navigation
   * control is welcome and when it is in the way, and nobody has held the phone
   * yet. `set` and `rest` are excluded on the argument that a mis-tap during a
   * live rep costs the rep — if that turns out to be over-cautious, this is the
   * line to move.
   */
  shell: Object.freeze({ SHELL_NAV, SHELL_LAYOUT, SHELL_COPY }),

  /**
   * THE RESULT CARD. Sheet layout in card pixels, plus `CARD_SCREEN`, the
   * React Native chrome around it in logical points. The two are different
   * units and the block comments say which is which.
   */
  card: Object.freeze({
    CARD: CARD_TUNING.CARD,
    CONTENT: CARD_TUNING.CONTENT,
    MASTHEAD: CARD_TUNING.MASTHEAD,
    LIFTER_STRIP: CARD_TUNING.LIFTER_STRIP,
    LIFTER_META_LADDER: CARD_TUNING.LIFTER_META_LADDER,
    GRID: CARD_TUNING.GRID,
    TOTAL_BLOCK: CARD_TUNING.TOTAL_BLOCK,
    SCORE_BLOCKS: CARD_TUNING.SCORE_BLOCKS,
    BARBELL: CARD_TUNING.BARBELL,
    FOOTER: CARD_TUNING.FOOTER,
    CARD_LABELS: CARD_TUNING.CARD_LABELS,
    CARD_SCREEN: CARD_TUNING.CARD_SCREEN,
  }),

  /**
   * THE IDLE LAYER (GDD §5), from the parallel session's build.
   *
   * An idle economy is nothing but rates: passive Gym Bucks and Training IQ,
   * the offline-earnings cap, NPC output by tier and tenure, and the expansion
   * cost curves. §5.1 asks for a 30-to-60-second check-in that "rewards
   * check-ins without punishing a 10-hour gap", and where that balance sits is
   * settled by playing rather than derived — so it belongs here with the other
   * things the 30 passes move.
   *
   * `EMPIRE_TUNING_CLASSIFICATION` comes with it and is the more interesting
   * half: the block labels its own entries `knob` / `budget` / `refusal` /
   * `structural`, so a tuner can see which numbers are theirs to turn and which
   * are GDD §12.3 refusal conditions wearing the same shape. Exposed here
   * deliberately — the invitation of this file is "turn these", and the
   * classification is what stops that invitation reaching a value that is not
   * a knob.
   */
  empire: Object.freeze({ EMPIRE_TUNING, EMPIRE_TUNING_CLASSIFICATION }),
});

/**
 * Colour, separately.
 *
 * `PAL` and `RAMPS` are the 5-bit sprite banks; `SHEET` is the printed-paper
 * bank the result card adds; `LIFT_PALETTE` and `SESSION_PALETTE` are screen
 * chrome, as strings, deliberately outside the numeric scans.
 */
export const PALETTES = Object.freeze({
  sprite: Object.freeze({ PAL, RAMPS, PALETTE_BANKS }),
  gym: Object.freeze({ GYM, GYM_RAMPS, GYM_BANKS }),
  sheet: Object.freeze({ SHEET, SHEET_BANK }),
  liftScreen: LIFT_PALETTE,
  sessionScreen: SESSION_PALETTE,
  meetScreen: MEET_PALETTE,
});

/**
 * Where each group physically lives.
 *
 * Machine-readable on purpose: `audit.test.ts` checks this against
 * `SOURCE_RULES` in `audit.ts` in both directions, so a module cannot be
 * registered as a tuning home without appearing here, and a path cannot be
 * listed here without being a registered home. Repository-relative POSIX.
 */
export const TUNING_MODULES: Readonly<Record<keyof typeof TUNING, string>> = Object.freeze({
  rep: 'src/game/liftTuning.ts',
  sprite: 'src/art/spriteTuning.ts',
  gym: 'src/art/gymTuning.ts',
  session: 'src/game/sessionTuning.ts',
  fatigue: 'src/game/fatigue.ts',
  streak: 'src/game/streak.ts',
  streakEntitlement: 'src/game/streakEntitlement.ts',
  card: 'src/card/cardTuning.ts',
  meet: 'src/game/meetTuning.ts',
  licensing: 'src/licensing/licensingTuning.ts',
  cutIn: 'src/cutin/cutInTuning.ts',
  shell: 'src/shell/shellTuning.ts',
  empire: 'src/empire/empireTuning.ts',
});

/** Where each palette physically lives. Same cross-check as above. */
export const PALETTE_MODULES: Readonly<Record<keyof typeof PALETTES, string>> = Object.freeze({
  sprite: 'src/art/palette.ts',
  gym: 'src/art/gymPalette.ts',
  sheet: 'src/card/sheetPalette.ts',
  liftScreen: 'src/lift/liftPalette.ts',
  sessionScreen: 'src/session/sessionPalette.ts',
  meetScreen: 'src/meet/meetPalette.ts',
});
