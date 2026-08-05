/**
 * cutInTuning.ts — EVERY TUNED VALUE THE CUT-IN GATE HAS.
 *
 * CLAUDE.md, "Game Feel Values Must Be Tunable": "Keep every such value as a
 * named constant in one place. Never scatter them as magic numbers across
 * components." This is the cut-in piece's share of that one place. It is
 * registered in `src/tuning/audit.ts` as a `feel` home and re-exported from
 * `src/tuning/index.ts`, which `audit.test.ts` cross-checks in both directions,
 * so nothing here can become unreachable from the registry.
 *
 * NONE OF THESE NUMBERS HAVE BEEN PLAYED. GDD §12.1: a one-shot run delivers a
 * tunable artifact, and feel tuning happens afterwards with people playing.
 * Every value below is a starting point chosen to be legible, not a value
 * anybody has judged. The two that most need a human are called out by name in
 * their own comments: `SESSION_ALLOWANCE` and `HOLD_MS`.
 *
 * ---------------------------------------------------------------------------
 * THE TYPE-ONLY IMPORT IS DELIBERATE AND IS NOT A CYCLE
 * ---------------------------------------------------------------------------
 * `CutInMoment` is declared in `cutInGate.ts`, which imports the values here.
 * The import below is `import type`, so it is erased before anything runs and
 * there is no runtime cycle. It is worth the pointer rather than restating the
 * four ids: a `Record<CutInMoment, ...>` is TOTAL, so adding a fifth firing
 * moment to GDD §7.2's list makes every table in this file a compile error
 * until it has been given a rate, a line and a slot. That is the behaviour
 * wanted — a moment with no tuning is a moment nobody decided anything about.
 */

import type { Tier3Slot } from '../licensing/tiers';
import type { CutInMoment } from './cutInGate';

/**
 * THE GATE'S NUMBERS.
 *
 * `MAX_PER_SESSION` is not really one of them and is flagged in place: it is a
 * GDD §12.3 refusal condition wearing a constant's clothes, not a knob.
 */
export const CUT_IN_TUNING = Object.freeze({
  /**
   * THE HARD CAP (GDD §7.2, §12.3). NOT A KNOB. DO NOT TURN THIS.
   *
   * "Hard gate: no more than one per session" (§7.2), and §12.3 lists "cut-ins
   * firing more than once per session" as a refusal condition — a critic sends
   * the work back for it regardless of how good everything else looks.
   *
   * It is a named constant because the audit requires one and because a rule
   * with a name is greppable, NOT because a playtester should move it. Raising
   * it to 2 is not a tuning pass, it is shipping the refusal condition, and
   * `cutInGate.test.ts` pins it to 1 against the sentence in §7.2 rather than
   * reading it back out of this file.
   */
  MAX_PER_SESSION: 1,

  /**
   * "IDEALLY NOT EVERY SESSION" (GDD §7.2), AS A RATE PER MOMENT.
   *
   * The fraction of sessions in which a moment is allowed to interrupt at all.
   * One roll per moment per session, drawn at `openCutInSession` from the
   * session's seed and then fixed — so a session either lets a moment through
   * or does not, and asking twice cannot shake a different answer out of it.
   *
   * THIS IS THE KNOB THE PIECE MOST NEEDS A HUMAN FOR, and the numbers below
   * are reasoning, not evidence:
   *
   *   bomb-out              1 — terminal, rare, and §7.2's "somber
   *                             counterpart". A player who bombs out has had a
   *                             bad day at a meet they trained months for;
   *                             suppressing the one beat that acknowledges it
   *                             to save a budget nothing else is spending is
   *                             the wrong trade. THIS RATE IS NOT WHAT PROTECTS
   *                             THE BEAT — the disqualifier in `cutInGate.ts`
   *                             §4 is, because a rate cannot stop a walk-out
   *                             that arrives EARLIER from spending the slot.
   *                             Turning this down is a real tuning position;
   *                             turning it up cannot buy back a slot already
   *                             spent.
   *   third-attempt-walkout 0.5 — a meet has up to three of these and the gate
   *                             is first-come (see `cutInGate.ts` §4), so this
   *                             number is close to "the fraction of meets whose
   *                             one cut-in is the SQUAT's third attempt". Half
   *                             is a guess at where that stops feeling like the
   *                             meet always opens the same way. It is only
   *                             close and not equal because a third attempt
   *                             with NOTHING BANKED does not qualify at all —
   *                             see the disqualifier in `cutInGate.ts` §4.
   *   personal-record       0.35 — the frequent one. `session.test.ts` measures
   *                             a PR on 30 of 30 sessions at today's tuning, so
   *                             without a rate here a daily player sees this
   *                             cut-in EVERY DAY, which is exactly the "2-second
   *                             tax players resent by day 4" §7.2 describes.
   *                             The cap alone makes that survivable; this is
   *                             what makes it scarce.
   *   coach-heavy-set       0.15 — the lowest on purpose, and the reason is
   *                             ordering rather than importance: a coach line
   *                             fires DURING the sets and a PR fires at
   *                             close-out, so in any session where both are
   *                             allowed the coach line takes the slot and the
   *                             PR is refused. This number is how often that
   *                             trade is made. See `cutInGate.ts` §4 and the
   *                             GDD §11 entry it is logged under.
   *
   * A rate of 0 disables a moment entirely and 1 makes it always-allowed;
   * neither is checked against, because both are legitimate tuning positions
   * and the CAP is what the refusal condition is about.
   */
  SESSION_ALLOWANCE: Object.freeze<Record<CutInMoment, number>>({
    'third-attempt-walkout': 0.5,
    'personal-record': 0.35,
    'bomb-out': 1,
    'coach-heavy-set': 0.15,
  }),

  /**
   * WHAT MAKES A WORK SET "HEAVY" ENOUGH FOR A COACH REACTION (GDD §7.2's
   * fourth moment), as a fraction of the lifter's current e1RM.
   *
   * The same `loadRatio` the lift mechanic and the walkout already speak in, so
   * a set that draws a coach line is a set the sprite is already straining
   * under. Raise it and the coach only speaks at a genuine top single; lower it
   * and he speaks on any working set.
   */
  COACH_HEAVY_SET_LOAD_RATIO: 0.92,

  /**
   * HOW LONG A CUT-IN HOLDS BEFORE IT LEAVES ON ITS OWN, MILLISECONDS.
   *
   * It leaves on its own as well as on a tap, because an interrupt that waits
   * for permission is a modal dialog. The tap is still the point (§7.2: "Always
   * skippable — tap to dismiss. Daily players will see these hundreds of
   * times") and it beats this clock from the first frame — see
   * `DISMISS_ENABLED_AFTER_MS`.
   *
   * THE SECOND KNOB THAT NEEDS A HUMAN. §7.2's whole argument is that a cut-in
   * WORKS BECAUSE IT INTERRUPTS, and how long an interrupt may last before it
   * is a tax is not something any test in this repository can answer.
   */
  HOLD_MS: 1600,

  /**
   * How long the cut-in takes to arrive. Short: it is a cut, not a fade-up.
   *
   * THE ONLY TIMING HERE THAT DRIVES AN ANIMATION, and the reason there is no
   * `EXIT_MS` beside it. There WAS one, at 100 ms, described as "how long it
   * takes to leave, on a tap or on the hold expiring" — and that sentence was
   * false in three files. Nothing animated an exit: `CutInView` has an arrival
   * and no departure, and `CutInHost` un-mounts the overlay synchronously on
   * `setLive(null)`. The committed pixels say so too — `frames.json` records the
   * tap dismissal at `tappedAt: 14, goneAt: 26`, twelve milliseconds, which is a
   * frame and not a hundred-millisecond fade. Setting it to 0 left the whole
   * suite green and moved no pixel.
   *
   * SO IT WAS DELETED RATHER THAN WIRED, and the choice is arguable rather than
   * forced. §7.2 asks for an interrupt that CUTS in and is always skippable and
   * says nothing either way about how it leaves, so wiring an exit would have
   * been ADDING a beat nobody has asked for or played — and the obvious wiring,
   * holding the overlay mounted for a hundred milliseconds after the tap, leaves
   * a full-screen `Pressable` over the screen underneath for that long unless
   * something also turns it off, which is a new way to get "always skippable"
   * wrong. Deleting is the move that makes three sentences true and changes no
   * behaviour. If a playtest wants a fade out, it comes back as a constant with
   * an animation reading it and a captured frame showing it — not as a number
   * three comments describe and nothing performs.
   */
  ENTER_MS: 120,

  /**
   * HOW LONG BEFORE A TAP IS ACCEPTED, MILLISECONDS. ZERO, DELIBERATELY.
   *
   * This constant exists so that "there is no un-skippable window" is a value
   * somebody can see rather than an absence somebody has to notice. The obvious
   * next request — "hold it for 300 ms so the tap that dismissed the previous
   * screen does not eat the cut-in" — would be a small un-skippable window, and
   * §7.2 does not carve one out. If a playtest argues for one, this is the line
   * to move, and `cutInGate.test.ts`'s "A CUT-IN IS DISMISSIBLE ON ITS FIRST
   * FRAME" is the test that will go red and make somebody argue for it.
   *
   * AND MOVING IT NOW MOVES THE APP, which is not something this comment could
   * honestly say until recently. The only reader of this number was
   * `canDismissAt`, and the only caller of THAT was a unit test: the view's
   * `onPress` went straight to an ungated dismiss, so setting this to 300 turned
   * two tests red and changed nothing a player could feel. The tap path now goes
   * through `tapDismissCutIn` (`CutInHost.dismissByTap` holds the clock).
   */
  DISMISS_ENABLED_AFTER_MS: 0,

  /**
   * The stride between the per-moment rolls drawn from one session seed.
   *
   * Any odd stride works; this is a prime so that two moments cannot land on
   * the same state through a common factor with the generator's increment.
   * Arithmetic, not feel — but it lives here rather than in the gate because
   * the gate is a `renderer` to the magic-number audit and may hold no literal
   * at all.
   */
  SEED_MOMENT_STRIDE: 7919,

  /**
   * The stride between two days' session seeds.
   *
   * Large and coprime with `SEED_MOMENT_STRIDE`, so that day N's roll for one
   * moment cannot land on day N+1's roll for another and make consecutive days
   * rhyme. Arithmetic rather than feel, and here for the same reason as the
   * stride above: the gate may hold no literal at all.
   */
  SEED_DAY_STRIDE: 65537,

  /**
   * HOW MANY SITTINGS THE CAP REMEMBERS ACROSS A REMOUNT. NOT A KNOB EITHER.
   *
   * `cutInLedger.ts` keeps one gate session per `sessionId` for the life of the
   * process, because §12.3's refusal condition is about a SESSION and React's
   * mount lifetime is not one: `AppShell` swaps `MeetScreen` and `SessionScreen`
   * with a ternary, so leaving a meet and opening one again on the same day
   * un-mounts and re-mounts `CutInHost`. A count that lived only in that
   * component's ref would come back at zero and the sitting would get a second
   * cut-in.
   *
   * The number is a bound on the map, not a feel value. Two sittings exist per
   * day (a training day and a meet), so this is four days of foregrounded app
   * without a reload before the oldest is forgotten — and forgetting an old
   * sitting cannot hand out a second cut-in for a CURRENT one, which is the only
   * thing the cap is about. Lowering it to 1 would still be correct for the
   * played loop and is not worth the sharp edge.
   */
  REMEMBERED_SITTINGS: 8,

  /**
   * How far `cutInPreview.ts` searches for a seed whose rates allow the moment
   * it was asked to photograph. Arithmetic, not feel.
   *
   * The debug route does NOT bypass the rate roll — it looks for a session that
   * would have let the moment through anyway, so the shot is of the real gate
   * firing rather than of a special case built to be photographed. A moment
   * whose `SESSION_ALLOWANCE` is 0 has no such seed and the preview refuses,
   * which is correct: a moment that can never fire has no picture to take.
   */
  PREVIEW_SEED_LIMIT: 5000,
});

/**
 * WHICH TIER 3 SLOT EACH MOMENT LEADS WITH (GDD §7.3).
 *
 * All four are `portrait` today, and that is a decision rather than a
 * placeholder: §7.2 says the thing a cut-in carries is "a hand-drawn shot of a
 * lifter's FACE under a maximal attempt", and a wordmark or a product shot on
 * the interrupt beat would be an advert, which is a different screen and a
 * different argument (§8.3A). The table is per-moment anyway so that a later
 * pass can give the coach beat a different lead without touching the gate.
 */
export const CUT_IN_ART = Object.freeze({
  SLOT: Object.freeze<Record<CutInMoment, Tier3Slot>>({
    'third-attempt-walkout': 'portrait',
    'personal-record': 'portrait',
    'bomb-out': 'portrait',
    'coach-heavy-set': 'portrait',
  }),

  /**
   * WHOSE FACE, UNTIL THERE IS A PLAYER IDENTITY TO ASK.
   *
   * An id into `LICENSING_CATALOGUE.entries`, which is populated with FICTIONAL
   * PLACEHOLDERS ONLY (GDD §7.3, §12.3; `partners.ts`). There is no character
   * system yet, so the wiring passes this; when there is one, this becomes the
   * fallback and the caller passes the lifter's own entry.
   *
   * It is an id and not an entry so that this module does not import the
   * catalogue — the gate stays free of the licensing table and takes the
   * identity as data, which is the whole point of §7.3 being a data change.
   */
  DEFAULT_IDENTITY_ID: 'ilse-vondrak',

  /** The coach is a different face from the lifter's. Also a placeholder id. */
  COACH_IDENTITY_ID: 'teodor-kessling',
});

/**
 * THE CUT-IN'S OWN GRID, in CARD PIXELS.
 *
 * DIFFERENT UNIT FROM `CUT_IN_LAYOUT` BELOW, which is React Native logical
 * points. These are 1x pixels on the same grid `renderResultCard.ts` and
 * `renderPanels.ts` work in, upscaled by a whole number for display (GDD §7.1,
 * nearest neighbour throughout). `licensingTuning.ts` draws the same line for
 * `PANEL` and says why.
 *
 * ---------------------------------------------------------------------------
 * WHY THE CUT-IN HAS ITS OWN SHAPE INSTEAD OF BORROWING `PANEL`
 * ---------------------------------------------------------------------------
 * It used to mount `renderPanel`, which is the character-select / shop
 * composition: a bordered 82x132 card carrying the Tier 3 art, the Tier 3
 * caption, the Tier 2 name tag, the Tier 1 colorway strip and the Tier 1 build
 * label, all at once. That is right for a shelf a player is choosing from and
 * wrong for an interrupt: for both identities the gate can reach the caption and
 * the name tag are the same string, so the beat printed the same name twice with
 * "COMPACT BUILD" under it — and `tier1.build` is required on every entry with a
 * non-empty label for every value, so NO row in `partners.ts` could have removed
 * that line. GDD §7.2's promise that the art pass is "a row in the identity
 * table and not a rewiring" was false for as long as the cut-in read the panel.
 *
 * So the cut-in composes its own grid from `tier3Of` — the same §7.3 witness the
 * panel goes through — and prints ONE line of identity text. The numbers below
 * are that grid.
 *
 * NONE OF THEM HAVE BEEN LOOKED AT ON A PHONE. Proportion is a judgement and
 * §12.1 says this run cannot make it.
 */
export const CUT_IN_PANEL = Object.freeze({
  /**
   * Grid width.
   *
   * SIZED BY THE PHONE, the same argument `PANEL.W` makes. `cutInScaleFor`
   * picks the largest whole upscale that fits `availableWidth - SCREEN_PAD * 2`
   * and caps at `CUT_IN_LAYOUT.MAX_SCALE`, so on a 390pt viewport the usable
   * width is 342 and 114 is the widest grid that still TRIPLES. One pixel wider
   * and the interrupt drops to 2x. Change this and re-shoot
   * `tools/capture-cutin.mjs` before believing anything.
   *
   * It is a MINIMUM, not a cap: `renderCutIn` widens the grid rather than crop
   * a drawing or a caption that does not fit. A licensed portrait wider than
   * this makes the cut-in wider and the on-screen upscale smaller, which is
   * visible, rather than silently losing the left and right of a partner's face.
   *
   * AND THAT WIDENING IS THE WHOLE OVERFLOW REMEDY HERE, which is the second
   * half of the "no Tier 2 at all" cost `cutInArt.ts` states. A shelf panel with
   * a too-long name prints `tier2.shortName` instead; a cut-in has no Tier 2, so
   * a too-long CAPTION wraps to `CAPTION_LINES`, then overflows visibly, then
   * widens this grid — and a wider grid is a smaller upscale on the phone. The
   * cost of a long licensed caption lands on the SIZE of the interrupt rather
   * than on a shorter string.
   */
  W: 114,
  /** Inset from the grid edge to any content. */
  PAD: 4,
  /**
   * The bright rule along the top and bottom edge — the "cut" of a cut-in.
   *
   * The whole of this piece's chrome, and deliberately almost nothing: GDD §7.2
   * cuts cut-in ART from the early prototypes, so what is drawn here is a
   * ground, two rules and a well. There is no drawing in this file and
   * `cutInArt.test.ts` reads it to check.
   */
  EDGE_RULE: 1,
  /**
   * Height of the well the Tier 3 drawing sits in.
   *
   * Also a minimum — a taller drawing makes a taller well. 66 is three times
   * the 22-row placeholder portraits in `partners.ts`, so today's art lands at
   * 3x inside it and the face is the biggest thing on the interrupt, which is
   * what §7.2 says a cut-in is for.
   */
  ART_H: 66,
  /**
   * Largest whole upscale the drawing is stamped at inside the well.
   *
   * Whole numbers only and floored at 1 (GDD §7.1). Its own value rather than
   * `PANEL.ART_MAX_SCALE` because a cut-in is a full-screen interrupt and a
   * shelf panel is a thumbnail; they should not have to move together.
   */
  ART_MAX_SCALE: 4,
  /** Gap between the bottom of the well and the identity line. */
  CAPTION_GAP: 5,
  /**
   * Whole upscale of the identity line. Fractional scaling is forbidden
   * everywhere in this codebase (GDD §7.1) and `drawText` rounds anyway.
   */
  CAPTION_SCALE: 1,
  /**
   * How many lines the identity text may wrap to before it starts overflowing
   * visibly.
   *
   * A LICENSED WORDMARK IS NOT TRUNCATABLE — `renderPanels.ts`'s `wrapToWidth`
   * makes the same argument for the shelf — so a caption too long for this many
   * lines is appended to the last one and overruns where somebody can see it,
   * rather than being cut off where nobody can. Every portrait caption in
   * `partners.ts` fits on ONE line at today's width; this is the headroom for a
   * longer name.
   */
  CAPTION_LINES: 2,
  /** Vertical pitch between two wrapped identity lines, before `CAPTION_SCALE`. */
  CAPTION_PITCH: 9,
});

/**
 * THE OVERLAY'S LAYOUT, in logical points.
 *
 * Points rather than card pixels: the Tier 3 grid inside is `cutInArt.ts`'s and
 * is scaled in whole numbers (GDD §7.1). These are the chrome around it.
 */
export const CUT_IN_LAYOUT = Object.freeze({
  /** How much of the screen behind is left visible. A cut-in interrupts. */
  SCRIM_OPACITY: 0.88,
  SCREEN_PAD: 24,
  /** Between the drawing and the line under it. */
  ROW_GAP: 16,
  LINE_FONT: 22,
  HINT_FONT: 11,
  LETTER_SPACING: 2,
  HINT_OPACITY: 0.55,
  /** The whole-number upscale ceiling for the cut-in grid inside the overlay. */
  MAX_SCALE: 3,
});

/**
 * THE COPY. One line per moment, plus the skip hint.
 *
 * SHORT AND UNBRANDED. Every string here is scanned by `src/licensing/realIp.ts`
 * as renderable content (GDD §12.3), so no federation, brand or athlete name
 * may appear in any of them, ever.
 *
 * `SKIP_HINT` is printed rather than implied. §7.2: "Daily players will see
 * these hundreds of times" — a player who does not know the screen is tappable
 * waits it out, which is the tax the skippability rule exists to remove.
 */
export const CUT_IN_COPY = Object.freeze({
  LINE: Object.freeze<Record<CutInMoment, string>>({
    'third-attempt-walkout': 'LAST ONE',
    'personal-record': 'NOBODY HAS SEEN YOU DO THIS',
    'bomb-out': 'THAT IS THE MEET',
    'coach-heavy-set': 'THAT MOVED',
  }),
  SKIP_HINT: 'TAP TO SKIP',
});
