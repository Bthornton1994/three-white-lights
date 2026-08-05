/**
 * THE MAGIC-NUMBER AUDIT.
 *
 * CLAUDE.md, "Game Feel Values Must Be Tunable":
 *
 *   > Timing windows, animation curves, haptic patterns, and difficulty
 *   > thresholds are tuned by hand after the run, across roughly 30 iterations,
 *   > by actual playtesting. Keep every such value as a named constant in one
 *   > place. Never scatter them as magic numbers across components.
 *
 * That paragraph is a rule, and until this file existed it was a request for
 * most of the tree. This module is the part that is enforced: `audit.test.ts`
 * runs it over every real source file in the repository and fails the suite on
 * anything it finds.
 *
 * ---------------------------------------------------------------------------
 * THE ONE RULE
 * ---------------------------------------------------------------------------
 *
 *   A numeric literal is a violation unless it sits inside a top-level
 *   declaration whose name is SCREAMING_SNAKE_CASE, in a file this module
 *   registers as a constants home — or it is one of the structural idioms
 *   listed in `STRUCTURAL_IDIOMS` below.
 *
 * Two halves, and both are load-bearing:
 *
 *   - "inside a SCREAMING_SNAKE_CASE declaration" is what makes a number a
 *     NAMED CONSTANT. `const styles = StyleSheet.create({ fontSize: 12 })` is
 *     not one: `styles` is lower-case, so every literal in the block is
 *     reported. Neither is anything in a function body.
 *   - "in a registered file" is what makes it ONE PLACE. Without it, a
 *     component could declare `const REP_HOLD_MS = 240` at the top of itself
 *     and pass — technically a named constant, and exactly the scattering the
 *     rule exists to prevent. `SOURCE_RULES` is the closed list of files
 *     allowed to declare constants at all, and no `.tsx` file is on it.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS DELIBERATELY DOES *NOT* CHECK
 * ---------------------------------------------------------------------------
 *
 * An audit that is too strict gets suppressed, and a suppressed audit is worse
 * than none. These are the judgement calls, each one a hole somebody could
 * drive a feel value through, each one accepted on purpose:
 *
 *   1. IT CANNOT READ MEANING. It knows a literal is bare; it cannot know
 *      whether a bare `240` is a timing window or a plate diameter. So it
 *      reports every bare literal and lets the fix decide the right home — a
 *      tuning module for a feel value, the owning module for a format constant
 *      like bytes-per-pixel.
 *   2. IT DOES NOT SAY THE VALUES ARE RIGHT. No test can. GDD §12.1 is
 *      explicit that feel tuning happens afterwards, by hand, with people
 *      playing. This says only that the values are all in reach of the hand.
 *   3. IT DOES NOT POLICE THE INSIDE OF A REGISTERED BLOCK. `FATIGUE_TUNING`
 *      may hold any number it likes. Ordering and reachability guards for
 *      those live with their own modules (`liftTuning.test.ts`,
 *      `sessionTuning.test.ts`, `spriteTuning.test.ts`).
 *   4. IT DOES NOT READ TEST FILES. A test asserting `expect(x).toBe(240)` is
 *      supposed to contain the literal; that is the whole point of a test.
 *   5. HEXADECIMAL IS A BITMASK, NOT A KNOB. `0x1f` passes. Somebody could
 *      write `0x64` to smuggle a 100 past the scan. Nobody will, and the cost
 *      of the alternative is making `(c << 3) | (c >> 2)` unreadable.
 *   6. IT DOES NOT LOOK AT `tools/` OR `App.tsx`'s harness wiring beyond the
 *      same rule as everything else — there is no special case, but there is
 *      also no deeper check of build scripts.
 *
 * ---------------------------------------------------------------------------
 * WHY SEVERAL TUNING MODULES AND NOT ONE FILE
 * ---------------------------------------------------------------------------
 *
 * CLAUDE.md says "one place". This codebase has several files holding tuned
 * values — `spriteTuning.ts`, `liftTuning.ts`, `sessionTuning.ts`,
 * `cardTuning.ts`, plus blocks embedded with their mechanic such as
 * `FATIGUE_TUNING` and `RECOVERY_DAY_GUARDRAILS`. Physically concatenating
 * them was considered and rejected:
 *
 *   - `spriteTuning.ts` is loaded by the offline sprite tool in `tools/`,
 *     which has no business importing the session loop's copy strings.
 *   - Each block's comments are half its value and they are about the mechanic
 *     they belong to; a merged file would be a wall of unrelated prose.
 *   - One file is a merge magnet for every parallel builder in the run.
 *
 * "One place" is delivered instead as ONE REGISTRY, enforced two ways:
 *
 *   - `src/tuning/index.ts` re-exports every block. A playtester opens one
 *     file and can see, and reach, every knob in the game.
 *   - `SOURCE_RULES` below is the closed list of files permitted to hold one.
 *     A fifth scattering cannot appear without an edit here, and
 *     `audit.test.ts` pins this list's exact contents so the edit is visible
 *     in review rather than arriving as a quiet default.
 *
 * Purity: zero React, zero I/O, zero side effects (CLAUDE.md architecture
 * rules). The caller supplies paths and contents; `audit.test.ts` reads disk.
 */

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

export type FindingKind = 'numeric' | 'colour';

export interface Finding {
  /** Repository-relative POSIX path. */
  readonly file: string;
  /** 1-based. */
  readonly line: number;
  /** 1-based. */
  readonly column: number;
  readonly kind: FindingKind;
  /** The offending literal, verbatim. */
  readonly text: string;
  /** Top-level declaration the literal sits in, or `<module>`. */
  readonly region: string;
  readonly message: string;
}

/** One line per finding, in the shape an editor can jump to. */
export function formatFindings(findings: readonly Finding[]): string {
  return findings
    .map((f) => `${f.file}:${f.line}:${f.column}  ${f.text}  [${f.region}] ${f.message}`)
    .join('\n');
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

/**
 * What a file is allowed to contain.
 *
 * - `renderer`  — the default, and it is deliberately the default. A file
 *                 nobody has classified is a consumer: zero bare numbers, zero
 *                 colours. A component added tomorrow is audited without
 *                 anyone remembering to register it.
 * - `constants` — may declare named constant blocks. Literals are still
 *                 forbidden in its function bodies.
 * - `palette`   — a constants home that may additionally hold colour literals.
 */
export type SourceRole = 'renderer' | 'constants' | 'palette';

/**
 * What KIND of numbers a constants home holds. Not enforcement — this is the
 * label that tells a playtester which files are theirs to turn.
 *
 * - `feel`   — timing windows, curves, haptics, difficulty thresholds. Turn
 *              these. GDD §12.1 budgets roughly 30 passes over them. Every
 *              `feel` file is re-exported from `src/tuning/index.ts`, and
 *              `audit.test.ts` checks that in both directions, so `feel` and
 *              "reachable from the one place" are the same set by construction.
 * - `data`   — published charts, coefficients, equipment specs, authored
 *              drawings, fixtures. DO NOT turn these; homebrewing several of
 *              them is a GDD §12.3 refusal condition.
 * - `local`  — a module's own arithmetic: float epsilons, unit conversions,
 *              byte layouts, polynomial identities, integration resolutions.
 *              Named so they are not bare, but not knobs, so not in the index.
 *              This is the kind to be suspicious of when reviewing a new
 *              registration: it is where a feel value would hide if one were
 *              going to.
 * - `colour` — palette entries.
 */
export type ConstantsKind = 'feel' | 'data' | 'local' | 'colour';

export interface SourceRule {
  readonly role: SourceRole;
  /** Absent for `renderer`. */
  readonly kind?: ConstantsKind;
  /** Why this file is allowed to hold constants at all. */
  readonly why: string;
  /**
   * Function-shaped regions permitted to hold bare literals anyway.
   *
   * THE ESCAPE HATCH, kept as small as it can be and pinned by an exact-match
   * assertion in `audit.test.ts`. Every entry is a transcribed published
   * algorithm whose constants ARE the algorithm — naming them one by one would
   * obscure the thing being transcribed and make it harder to check against
   * its source, which is the opposite of the point.
   */
  readonly allowLiteralsIn?: readonly string[];
}

export const RENDERER_RULE: SourceRule = Object.freeze({
  role: 'renderer',
  why: 'Default. A consumer of constants, never a home for them.',
});

/**
 * THE ALLOWLIST. Every file permitted to hold a numeric literal outside the
 * structural idioms, and why.
 *
 * Keyed by repository-relative POSIX path. Anything not here is a `renderer`
 * and must be numerically clean. `audit.test.ts` asserts every path here
 * exists on disk, so a stale entry fails rather than silently widening the
 * list, and asserts no `.tsx` file is ever on it.
 */
export const SOURCE_RULES: Readonly<Record<string, SourceRule>> = Object.freeze({
  // --- the four tuning modules: what "one place" resolves to ---------------
  'src/art/spriteTuning.ts': Object.freeze({
    role: 'constants',
    kind: 'feel',
    why: 'SPRITE_TUNING — animation timing, load response, shading curves.',
  }),
  'src/game/liftTuning.ts': Object.freeze({
    role: 'constants',
    kind: 'feel',
    why: 'LIFT_TUNING / LIFT_COPY — the rep mechanic: windows, forces, haptics.',
  }),
  'src/game/sessionTuning.ts': Object.freeze({
    role: 'constants',
    kind: 'feel',
    why: 'SESSION_TUNING / SESSION_LAYOUT / SESSION_COPY — daily loop pacing.',
  }),
  'src/card/cardTuning.ts': Object.freeze({
    role: 'constants',
    kind: 'feel',
    why: 'Result-card sheet layout and the screen chrome around it.',
  }),
  'src/game/meetTuning.ts': Object.freeze({
    role: 'constants',
    kind: 'feel',
    why: 'MEET_TUNING / MEET_LAYOUT / MEET_COPY — meet-day pacing: the walk-out beat, the deliberation delay, the judging-light reveal, the judging thresholds. GDD §12.2 judges this piece on pacing, so these are the values a playtest pass moves.',
  }),
  'src/art/gymTuning.ts': Object.freeze({
    role: 'constants',
    kind: 'feel',
    why: 'GYM_* — the environment layer: room proportions, lighting, parallax, prop placement.',
  }),
  'src/shell/shellTuning.ts': Object.freeze({
    role: 'constants',
    kind: 'feel',
    why: 'SHELL_NAV / SHELL_LAYOUT / SHELL_COPY — the app shell: which beats of GDD §3.2 and §6 a navigation control may be drawn over, how long it takes to arrive, and where it sits. When a control is welcome and when it is in the way is a judgement that needs a thumb on a phone, so it is a knob rather than a constant nobody may turn.',
  }),
  'src/cutin/cutInTuning.ts': Object.freeze({
    role: 'constants',
    kind: 'feel',
    why: 'CUT_IN_TUNING / CUT_IN_ART / CUT_IN_LAYOUT / CUT_IN_COPY — the GDD §7.2 cut-in gate: how often a firing moment is allowed to interrupt, what counts as a heavy set, how long the interrupt holds, and how soon a tap dismisses it. §7.2 calls scarcity "the entire mechanic", and how scarce is scarce enough is exactly the judgement that needs a thumb on a phone. MAX_PER_SESSION lives here too and is flagged in place as NOT a knob: it is §12.3’s refusal condition, not a value to turn.',
  }),
  'src/licensing/licensingTuning.ts': Object.freeze({
    role: 'constants',
    kind: 'feel',
    why: 'PANEL / TIER_1_STRIP / SHELF / LICENSING_SCREEN / LICENSING_COPY — the GDD \u00a77.3 Tier 3 surfaces: panel proportions, the whole-number upscale a phone can show them at, and the copy that states the \u00a78.1 no-stat promise on screen.',
  }),

  // --- palettes ------------------------------------------------------------
  'src/art/palette.ts': Object.freeze({
    role: 'palette',
    kind: 'colour',
    why: 'The 5-bit sprite banks. Hues sourced from real meet software.',
  }),
  'src/art/gymPalette.ts': Object.freeze({
    role: 'palette',
    kind: 'colour',
    why: 'The two 5-bit BACKGROUND banks, kept apart from the sprite banks as the hardware did.',
  }),
  'src/card/sheetPalette.ts': Object.freeze({
    role: 'palette',
    kind: 'colour',
    why: 'The result-sheet bank, on top of the sprite banks.',
  }),
  'src/lift/liftPalette.ts': Object.freeze({
    role: 'palette',
    kind: 'colour',
    why: 'Screen chrome for the lift mechanic.',
  }),
  'src/session/sessionPalette.ts': Object.freeze({
    role: 'palette',
    kind: 'colour',
    why: 'Screen chrome for the daily loop, built on LIFT_PALETTE.',
  }),
  'src/meet/meetPalette.ts': Object.freeze({
    role: 'palette',
    kind: 'colour',
    why: 'Screen chrome for meet day, built on LIFT_PALETTE. It carries no plate colours any more: the walkout draws the SPRITE\u2019s bar (src/meet/meetHall.ts), so a competition disc is coloured once, in src/art/palette.ts, rather than in two colour spaces that could drift.',
  }),

  // --- feel blocks that live with their mechanic ---------------------------
  // Registered rather than moved: each is already a single named, frozen,
  // documented block, and `src/tuning/index.ts` re-exports it, so it is
  // reachable from the one place.
  'src/game/fatigue.ts': Object.freeze({
    role: 'constants',
    kind: 'feel',
    why: 'FATIGUE_TUNING / FATIGUE_COPY — difficulty thresholds, injury odds, window scaling.',
  }),
  'src/game/streak.ts': Object.freeze({
    role: 'constants',
    kind: 'feel',
    why: 'STREAK_DAY_BOUNDARY / RECOVERY_DAY_* — grace, guardrails, milestone days.',
    // Howard Hinnant's days_from_civil / civil_from_days, transcribed. 146097
    // is the number of days in a 400-year era and 719468 the shift to the
    // 1970 epoch; renaming them one by one would make the transcription
    // unverifiable against its published source.
    allowLiteralsIn: Object.freeze(['daysFromCivil', 'civilFromDays']),
  }),
  // --- module-local arithmetic --------------------------------------------
  // Deliberately NOT `feel`, and therefore deliberately not in the tuning
  // index: none of these is a knob. VELOCITY_GRID is the resolution an
  // integral is evaluated at, SMOOTHSTEP is the polynomial's own coefficients,
  // EPSILON is a divide-by-zero guard. Each file's block comments say which.
  'src/art/squatAnimation.ts': Object.freeze({
    role: 'constants',
    kind: 'local',
    why: 'VELOCITY_GRID, SMOOTHSTEP, SHAPE_VARIATION_STEPS. Its feel values are in SPRITE_TUNING.',
  }),
  'src/art/raster.ts': Object.freeze({
    role: 'constants',
    kind: 'local',
    why: 'EPSILON and HALF_PIXEL. Its shading curves are in SPRITE_TUNING.',
  }),
  'src/art/lifterSprite.ts': Object.freeze({
    role: 'constants',
    kind: 'local',
    why: 'DEG, the hair-cap inset and the inspection stage backdrop. Poses are in rig.ts.',
  }),

  // --- measurement bounds, not knobs ---------------------------------------
  // `CRAFT` holds the thresholds the sprite is GRADED against, most of them
  // derived at load from the decoded reference image rather than typed in. That
  // makes it `local` rather than `feel`: a playtester never turns these, and
  // putting them in the tuning index would invite someone to loosen a bound
  // instead of fixing the sprite — which is the exact move the reference
  // measurement exists to prevent.
  'src/art/craftMetrics.ts': Object.freeze({
    role: 'constants',
    kind: 'local',
    why: 'CRAFT — bar thresholds for grading sprite craft, mostly derived from the decoded reference. Feel values are in SPRITE_TUNING.',
  }),

  // --- the audio format, which is not a knob either -------------------------
  // Deliberately `local` and deliberately NOT in the tuning index. What meet
  // day sounds like is `MEET_SOUND` in `meetTuning.ts` — a registered `feel`
  // home a playtester turns. These two are the container and the arithmetic:
  // a sample rate, RIFF's byte offsets, the definition of a triangle wave.
  // Putting them in the index would invite somebody to "tune" a chunk header.
  'src/audio/wav.ts': Object.freeze({
    role: 'constants',
    kind: 'local',
    why: 'SOUND_FORMAT / WAV_LAYOUT — mono 16-bit PCM and the RIFF container. The cue recipes are MEET_SOUND.',
  }),
  'src/audio/synth.ts': Object.freeze({
    role: 'constants',
    kind: 'local',
    why: 'SYNTH_MATH — TAU, ms-per-second and the triangle waveform’s own coefficients. What a cue sounds like is MEET_SOUND.',
  }),

  // --- build configuration -------------------------------------------------
  // Not game code and not a knob, but audited anyway rather than exempted,
  // because the walk starting at the repository root is the property that makes
  // this audit hard to escape — carving a hole for "config" invites the next
  // one. `local` is the honest classification: a named constant belongs here,
  // the tuning index does not want it, and a playtester never turns it.
  'vitest.config.ts': Object.freeze({
    role: 'constants',
    kind: 'local',
    why: 'TEST_TIMEOUT_MS. A harness budget, not a game-feel value — see the comment there for why it is 30s.',
  }),

  // --- authored drawings ---------------------------------------------------
  // `rig.ts` and `spriteMarks.ts` are data files of joint coordinates. Both
  // they and `spriteTuning.ts` argue the split at length: an anchor cannot be
  // moved without redrawing the pose it names, so it is not a knob that turns
  // in isolation the way a tick count is.
  'src/art/rig.ts': Object.freeze({
    role: 'constants',
    kind: 'data',
    why: 'POSES / RIG_GEOMETRY / POSE_DEPTH_ANCHORS — hand-authored landmark drawings.',
  }),
  'src/art/spriteMarks.ts': Object.freeze({
    role: 'constants',
    kind: 'data',
    why: 'MARKS / MARK_ANCHOR_GEOMETRY — authored decal placement.',
  }),
  'src/art/gymProps.ts': Object.freeze({
    role: 'constants',
    kind: 'data',
    why: 'PROP_ART — hand-authored rack, bench, plate-tree and lamp drawings. Where they GO is gymTuning.',
  }),
  'src/card/pixelFont.ts': Object.freeze({
    role: 'constants',
    kind: 'data',
    why: 'FONT — glyph bitmaps and metrics.',
  }),

  // --- published domain data ----------------------------------------------
  // GDD §12.3 sends the work back for homebrewed RPE, e1RM or DOTS values, so
  // these must NOT be exposed to a playtester as knobs. They are registered
  // here as `data` precisely so the registry says which numbers are off limits.
  'src/game/rpe.ts': Object.freeze({
    role: 'constants',
    kind: 'data',
    why: 'RPE_PERCENT_CHART — the published Tuchscherer-style chart, plus RPE_LOADING_TUNING.',
  }),
  'src/game/dots.ts': Object.freeze({
    role: 'constants',
    kind: 'data',
    why: 'DOTS_COEFFICIENTS — the published polynomial.',
  }),
  'src/game/e1rm.ts': Object.freeze({
    role: 'constants',
    kind: 'data',
    why: 'E1RM_FORMULA — Epley, and only Epley (CLAUDE.md domain correctness).',
  }),
  'src/game/meet.ts': Object.freeze({
    role: 'constants',
    kind: 'data',
    why: 'IPF meet structure: bar and collar weights, attempt increments, jump fractions.',
  }),
  'src/game/resultCard.ts': Object.freeze({
    role: 'constants',
    kind: 'data',
    why: 'WEIGHT_CLASSES_KG and the federation sheet formats.',
  }),
  'src/art/plates.ts': Object.freeze({
    role: 'constants',
    kind: 'data',
    why: 'PLATE_SPECS — IPF competition disc diameters and weights.',
  }),
  'src/game/prng.ts': Object.freeze({
    role: 'constants',
    kind: 'data',
    why: 'MULBERRY32 — the published generator constants.',
  }),
  'src/card/sampleCards.ts': Object.freeze({
    role: 'constants',
    kind: 'data',
    why: 'Fixture meets for the card renderer. Not shipped state.',
  }),
  'src/licensing/realIp.ts': Object.freeze({
    role: 'constants',
    kind: 'data',
    why: 'REVIEWABLE_CITATIONS \u2014 the pinned inventory of real names present in the source text, with an occurrence count per row. Data about the repository, not a knob: turning a count down does not change anything except whether the suite notices.',
  }),
});

export function ruleFor(relPath: string): SourceRule {
  return SOURCE_RULES[relPath] ?? RENDERER_RULE;
}

// ---------------------------------------------------------------------------
// Stripping comments, strings, templates and regexes
// ---------------------------------------------------------------------------

const REGEX_PRECEDERS: ReadonlySet<string> = new Set([
  '',
  '(',
  ',',
  '=',
  ':',
  '[',
  '!',
  '&',
  '|',
  '?',
  ';',
  '+',
  '-',
  '*',
  '%',
  '<',
  '>',
  '~',
  '^',
  '\n',
]);

const REGEX_KEYWORDS: ReadonlySet<string> = new Set([
  'return',
  'typeof',
  'instanceof',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'case',
  'do',
  'else',
  'yield',
  'await',
  'throw',
]);

const REGEX_FLAG = /[dgimsuvy]/;
const WHITESPACE = /\s/;
const WORD_CHAR = /[\w$]/;

/**
 * Blank out everything that is not executable code, PRESERVING OFFSETS so line
 * and column numbers survive. `codeOnly(s).length === s.length` always, which
 * `audit.test.ts` asserts against every real file in the tree — a scanner bug
 * that eats code would otherwise make the whole audit quietly vacuous.
 *
 * Hand-written rather than regex-chained, because the regex version this
 * replaces (duplicated in `liftTuning.test.ts` and `sessionTuning.test.ts`)
 * had two holes a scan is worthless with:
 *
 *   - REGEX LITERALS. `/^(\d{4})-(\d{2})-(\d{2})$/` reads as four bare numbers
 *     to a scan that does not know what a regex is, so a clean file could not
 *     contain one and a dirty one could hide behind one.
 *   - TEMPLATE INTERPOLATIONS. Blanking a whole template also blanks
 *     `${x * 3}`, which is real code. `` `padding: ${16}px` `` was a hole.
 *
 * The `/`-is-a-regex decision uses the standard previous-significant-token
 * heuristic, with two TSX adjustments: `}` is not a regex preceder (it is
 * almost always the end of a JSX expression container), and `/>` never starts
 * one (it is a self-closing tag). Without those, `<A x={0} /> <B y={1} />` on
 * one line has its middle eaten as a regex body.
 */
export function codeOnly(source: string): string {
  const out: string[] = [];
  const n = source.length;
  /** Brace depths at which an open `${` is waiting for its template. */
  const templateStack: number[] = [];
  let braceDepth = 0;
  let i = 0;
  /** Last significant code character emitted, for the regex/divide decision. */
  let lastCode = '';
  /**
   * The most recent complete identifier, e.g. `return`. Survives the
   * whitespace between it and a following `/`, which is the whole point:
   * `return /\d{5}/` has a space in it.
   */
  let lastWord = '';
  /** Was the immediately preceding character part of `lastWord`? */
  let inWord = false;

  const push = (ch: string): void => {
    out.push(ch);
  };
  const blankTo = (end: number): void => {
    while (i < end && i < n) {
      push(source[i] === '\n' ? '\n' : ' ');
      i += 1;
    }
  };
  /** Consume a backslash escape, emitting one blank per consumed character. */
  const blankEscape = (): void => {
    push(' ');
    i += 1;
    if (i < n) {
      push(source[i] === '\n' ? '\n' : ' ');
      i += 1;
    }
  };
  /**
   * Walk the text part of a template literal. Stops after the closing backtick
   * or after opening a `${`. Returns true if the template is now closed.
   */
  const scanTemplateText = (): boolean => {
    while (i < n) {
      const c = source[i] ?? '';
      if (c === '\\') {
        blankEscape();
        continue;
      }
      if (c === '`') {
        push('`');
        i += 1;
        return true;
      }
      if (c === '$' && source[i + 1] === '{') {
        push('$');
        push('{');
        i += '${'.length;
        templateStack.push(braceDepth);
        braceDepth += 1;
        return false;
      }
      push(c === '\n' ? '\n' : ' ');
      i += 1;
    }
    return true;
  };

  while (i < n) {
    const ch = source[i] ?? '';
    const next = source[i + 1] ?? '';

    // --- comments ---------------------------------------------------------
    if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', i);
      blankTo(end === -1 ? n : end + '*/'.length);
      continue;
    }
    if (ch === '/' && next === '/') {
      const end = source.indexOf('\n', i);
      blankTo(end === -1 ? n : end);
      continue;
    }

    // --- quoted strings ---------------------------------------------------
    if (ch === "'" || ch === '"') {
      push(ch);
      i += 1;
      while (i < n) {
        const c = source[i] ?? '';
        if (c === '\\') {
          blankEscape();
          continue;
        }
        if (c === ch) {
          push(ch);
          i += 1;
          break;
        }
        push(c === '\n' ? '\n' : ' ');
        i += 1;
      }
      lastCode = ch;
      lastWord = '';
      inWord = false;
      continue;
    }

    // --- template literals, with `${}` left as live code -------------------
    if (ch === '`') {
      push('`');
      i += 1;
      const closed = scanTemplateText();
      if (closed) {
        lastCode = '`';
        lastWord = '';
        inWord = false;
      }
      continue;
    }

    // --- brace tracking, so `}` can resume a template ---------------------
    if (ch === '{') {
      braceDepth += 1;
      push(ch);
      i += 1;
      lastCode = ch;
      lastWord = '';
      inWord = false;
      continue;
    }
    if (ch === '}') {
      braceDepth -= 1;
      push(ch);
      i += 1;
      lastCode = ch;
      lastWord = '';
      inWord = false;
      if (templateStack[templateStack.length - 1] === braceDepth) {
        templateStack.pop();
        scanTemplateText();
      }
      continue;
    }

    // --- regex literals ---------------------------------------------------
    const couldBeRegex =
      ch === '/' &&
      next !== '>' &&
      (REGEX_PRECEDERS.has(lastCode) || REGEX_KEYWORDS.has(lastWord));
    if (couldBeRegex) {
      let j = i + 1;
      let inClass = false;
      let terminated = false;
      while (j < n) {
        const c = source[j] ?? '';
        if (c === '\\') {
          j += 1; // the backslash
          j += 1; // and whatever it escapes
          continue;
        }
        if (c === '\n') break;
        if (c === '[') inClass = true;
        else if (c === ']') inClass = false;
        else if (c === '/' && !inClass) {
          terminated = true;
          j += 1;
          break;
        }
        j += 1;
      }
      if (terminated) {
        while (j < n && REGEX_FLAG.test(source[j] ?? '')) j += 1;
        push('/');
        i += 1;
        blankTo(j - 1);
        push('/');
        i = j;
        lastCode = '/';
        lastWord = '';
        inWord = false;
        continue;
      }
    }

    push(ch);
    if (WHITESPACE.test(ch)) {
      if (ch === '\n') lastCode = '\n';
      inWord = false;
    } else {
      lastCode = ch;
      if (WORD_CHAR.test(ch)) {
        lastWord = inWord ? lastWord + ch : ch;
        inWord = true;
      } else {
        lastWord = '';
        inWord = false;
      }
    }
    i += 1;
  }

  return out.join('');
}

// ---------------------------------------------------------------------------
// Literal-type unions
// ---------------------------------------------------------------------------

const LITERAL_TYPE_UNION = /(?<![\w.$])\d+(?:\.\d+)?(?:\s*\|\s*\d+(?:\.\d+)?)+/g;
const DIGIT = /\d/g;

/**
 * `readonly attemptNumber: 1 | 2 | 3` is a TYPE, not a value. Nobody tunes it;
 * changing it changes what compiles.
 *
 * Blanked before the numeric scan. The pattern needs at least two members
 * joined by `|`, which no arithmetic expression is: a bitwise-or of two
 * numeric literals would be folded by hand.
 */
export function blankLiteralTypeUnions(code: string): string {
  return code.replace(LITERAL_TYPE_UNION, (m) => m.replace(DIGIT, ' '));
}

// ---------------------------------------------------------------------------
// Top-level declaration regions
// ---------------------------------------------------------------------------

export interface Region {
  readonly name: string;
  /** 0-based, inclusive. */
  readonly fromLine: number;
  /** 0-based, exclusive. */
  readonly toLine: number;
  /** The name is SCREAMING_SNAKE_CASE and the block declares no function. */
  readonly isNamedConstant: boolean;
}

const DECLARATION =
  /^(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:const|let|var|function|type|interface|class|enum)\s+([A-Za-z_$][\w$]*)/;

const SCREAMING_SNAKE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

const DECLARES_FUNCTION = /=>|\bfunction\b/;

const MODULE_REGION = '<module>';

/**
 * Split stripped code into top-level declarations.
 *
 * Line-based and column-0 anchored, which is exactly right AFTER `codeOnly`: a
 * `const` at column 0 inside a blanked comment or string has been turned into
 * spaces and cannot open a region.
 *
 * A SCREAMING_SNAKE region that declares a function is NOT a constants home.
 * `export const CLAMP = (x: number) => x * 3` would otherwise let arbitrary
 * code hide behind a shouty name.
 */
export function declarationRegions(code: string): readonly Region[] {
  const lines = code.split('\n');
  const starts: { name: string; from: number }[] = [{ name: MODULE_REGION, from: 0 }];
  lines.forEach((line, index) => {
    const name = DECLARATION.exec(line)?.[1];
    if (name !== undefined) starts.push({ name, from: index });
  });

  return starts.map((start, index) => {
    const toLine = starts[index + 1]?.from ?? lines.length;
    const body = lines.slice(start.from, toLine).join('\n');
    return {
      name: start.name,
      fromLine: start.from,
      toLine,
      isNamedConstant: SCREAMING_SNAKE.test(start.name) && !DECLARES_FUNCTION.test(body),
    };
  });
}

// ---------------------------------------------------------------------------
// The structural idioms
// ---------------------------------------------------------------------------

/**
 * THE ALLOWLIST OF LITERALS THAT ARE NOT MAGIC NUMBERS.
 *
 * The audit is worthless if it is either so strict it gets suppressed or so
 * loose it passes anything. Every entry below is a number whose value is fixed
 * by the language, the number system or the pixel grid — not by taste. "Would
 * a playtester ever want to turn this?" is the question each one had to answer
 * no to.
 *
 * THE PROPERTY-VALUE CARVE-OUT, which is where most of the judgement went.
 * `2` had to be allowed: `rgb[2]`, `index % 2`, `pass < 2`, `x / 2` to centre
 * and `[0, 1, 2].map` are all over this codebase and every one is structure.
 * Allowing it everywhere, which is what the two older scans in
 * `liftTuning.test.ts` and `sessionTuning.test.ts` do, also allows
 * `letterSpacing: 2` — a typographic decision, and a real one that was sitting
 * in `ResultCardScreen.tsx` when this was written. So the conditional idioms
 * (`2`, `10`, `100`) are switched OFF in a property-value position: a number
 * being assigned to a named field is a value, not a shape. `0` and `1` stay on
 * everywhere, because `flex: 1` and `opacity: 1` are identities.
 *
 * Deliberately NOT allowed, though each was considered:
 *
 *   - `1000` for seconds-to-milliseconds. A duration written in seconds inside
 *     a component is already the bug.
 *   - Any float at all. There is no float whose value the language fixes.
 *   - `-1` as a sentinel. The sign is not part of the literal, so `-1` reads
 *     as `1` and is allowed; that is a known and accepted limit.
 *   - `3` for three attempts or three white lights. It is a rule of the sport,
 *     it lives in `meet.ts` as `ATTEMPTS_PER_LIFT` and `JUDGE_COUNT`, and a
 *     scan that allowed it would let a third of the meet engine go unnamed.
 */
export const STRUCTURAL_IDIOMS: readonly string[] = Object.freeze([
  '0 and 1 — index, identity, off-by-one, `flex: 1`, `opacity: 1`, `strokeWidth: 1`.',
  '2 — a pair, a parity, a third index, a halving. NOT as a property value.',
  '100 immediately after `*` or `/` — per-cent to fraction. The published RPE chart prints per-cent.',
  '10 immediately before `**` — the radix in a round-to-N-decimals idiom.',
  'A literal after `<<`, `>>` or `>>>` — a shift width is a property of the encoding.',
  'Hexadecimal, binary and octal — bitmasks. `0x1f` is the 5-bit channel mask.',
  'Numeric literal types — `1 | 2 | 3` is a type, not a value.',
]);

const NUMERIC_LITERAL =
  /(?<![\w.$])(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\d[\d_]*(?:\.[\d_]+)?(?:[eE][+-]?\d+)?|\.\d[\d_]*(?:[eE][+-]?\d+)?)n?/g;

const ALWAYS_STRUCTURAL: ReadonlySet<string> = new Set(['0', '1']);
const RADIX_PREFIXED = /^0[xXbBoO]/;
const SHIFT_OPERATORS: ReadonlySet<string> = new Set(['<<', '>>', '>>>']);
const OPERATOR_CHAR = /[*/<>]/;

/** The operator glued to the left of `index`, ignoring spaces. */
function operatorBefore(code: string, index: number): string {
  let i = index - 1;
  while (i >= 0 && WHITESPACE.test(code[i] ?? '')) i -= 1;
  const end = i + 1;
  while (i >= 0 && OPERATOR_CHAR.test(code[i] ?? '')) i -= 1;
  return code.slice(i + 1, end);
}

/** The operator glued to the right of `index`, ignoring spaces. */
function operatorAfter(code: string, index: number): string {
  let i = index;
  while (i < code.length && WHITESPACE.test(code[i] ?? '')) i += 1;
  const start = i;
  while (i < code.length && OPERATOR_CHAR.test(code[i] ?? '')) i += 1;
  return code.slice(start, i);
}

/**
 * Is the literal at `index` the value of a named property — `letterSpacing: 2`?
 *
 * Detected as "the previous non-space character is a colon", which also catches
 * the else-branch of a ternary. That is the intended behaviour: `cond ? a : 240`
 * is as much a hidden value as `delay: 240`.
 */
function isPropertyValue(code: string, index: number): boolean {
  let i = index - 1;
  while (i >= 0 && WHITESPACE.test(code[i] ?? '')) i -= 1;
  return code[i] === ':';
}

/** Does this literal, at this position in this code, fall under an idiom? */
export function isStructuralIdiom(code: string, index: number, text: string): boolean {
  if (ALWAYS_STRUCTURAL.has(text)) return true;
  if (RADIX_PREFIXED.test(text)) return true;

  const before = operatorBefore(code, index);
  if (SHIFT_OPERATORS.has(before)) return true;

  // The conditional idioms are off in a property-value position. See the note
  // on STRUCTURAL_IDIOMS.
  if (isPropertyValue(code, index)) return false;

  const after = operatorAfter(code, index + text.length);
  if (text === '2') return true;
  if (text === '100' && (before === '*' || before === '/')) return true;
  if (text === '10' && after === '**') return true;
  return false;
}

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

/**
 * A colour literal belongs in a palette module. Everywhere else it is a
 * hard-coded hue no theme pass can reach, and no test that reads `LIFT_PALETTE`
 * can see.
 *
 * Scanned against the source with comments blanked but STRINGS INTACT, because
 * a colour in this codebase is a string. `codeOnly` erases every one of them,
 * which is why the numeric scan and this one cannot share an input.
 */
const COLOUR_LITERAL = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\brgba?\s*\(/g;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /(^|[^:])\/\/[^\n]*/g;
const NON_NEWLINE = /[^\n]/g;

/** `codeOnly`, but keeping string contents. Comments still go. */
export function withoutComments(source: string): string {
  return source
    .replace(BLOCK_COMMENT, (m) => m.replace(NON_NEWLINE, ' '))
    .replace(LINE_COMMENT, (m, keep: string) => keep + ' '.repeat(m.length - keep.length));
}

/**
 * THE COMPLEMENT OF `withoutComments`: the comments, and nothing else.
 *
 * Every other scanner in this repository reads a file with its comments blanked,
 * which is right for asking what the CODE does and leaves one thing unasked —
 * whether the prose next to it still describes that code. A comment that has
 * gone false is invisible to every check in the tree, and prose is what the next
 * reader acts on. `cutInWiring.test.ts` uses this to hold one module's comments
 * to its own architecture.
 *
 * SAME LENGTH AND SAME LINE BREAKS AS THE INPUT, exactly like `withoutComments`,
 * so a match index in the output is a real line number in the file. Code is
 * blanked to spaces rather than removed.
 *
 * BLOCK COMMENTS FIRST, then line comments on what the block pass left behind —
 * the same order and the same reason as `withoutComments`. A double slash inside
 * a block comment is prose, not a second comment, and a `://` in a URL is
 * neither (`LINE_COMMENT` refuses a preceding colon).
 *
 * WHAT IT CANNOT DO, stated rather than discovered: a `//` inside a STRING
 * LITERAL is read as a comment and its tail is kept. That is the same blind spot
 * `withoutComments` has from the other side — it blanks the same tail — and both
 * inherit it from doing this with regular expressions instead of a parser.
 */
export function onlyComments(source: string): string {
  const out = [...source.replace(NON_NEWLINE, ' ')];
  const paste = (text: string, at: number): void => {
    for (let i = 0; i < text.length; i += 1) out[at + i] = text[i] ?? ' ';
  };
  for (const match of source.matchAll(BLOCK_COMMENT)) paste(match[0], match.index);
  const blocksGone = source.replace(BLOCK_COMMENT, (m) => m.replace(NON_NEWLINE, ' '));
  for (const match of blocksGone.matchAll(LINE_COMMENT)) {
    const skip = (match[1] ?? '').length;
    paste(match[0].slice(skip), match.index + skip);
  }
  return out.join('');
}

// ---------------------------------------------------------------------------
// The audit
// ---------------------------------------------------------------------------

const NEWLINE = '\n';

function lineColumn(text: string, index: number): { line: number; column: number } {
  const upto = text.slice(0, index);
  const lastBreak = upto.lastIndexOf(NEWLINE);
  return { line: upto.split(NEWLINE).length, column: index - lastBreak };
}

const RENDERER_ADVICE =
  'bare number in a consumer. Move it into a tuning module — src/tuning/index.ts lists every one — and import it.';
const CONSTANTS_ADVICE =
  'bare number outside a named constant block. Put it in a SCREAMING_SNAKE_CASE declaration in this file, or in a tuning module.';
const COLOUR_ADVICE =
  'colour literal outside a palette module. Add it to the palette and import it.';

/** Audit one file. `relPath` is repository-relative POSIX and picks the rule. */
export function auditSource(relPath: string, source: string): readonly Finding[] {
  const rule = ruleFor(relPath);
  const findings: Finding[] = [];

  const code = blankLiteralTypeUnions(codeOnly(source));
  const regions = declarationRegions(code);
  const regionAt = (line1: number): Region | undefined =>
    regions.find((r) => line1 - 1 >= r.fromLine && line1 - 1 < r.toLine);

  // --- numeric ------------------------------------------------------------
  for (const match of code.matchAll(NUMERIC_LITERAL)) {
    const text = match[0];
    if (isStructuralIdiom(code, match.index, text)) continue;
    const { line, column } = lineColumn(code, match.index);
    const region = regionAt(line);
    const regionName = region?.name ?? MODULE_REGION;

    if (rule.role !== 'renderer') {
      if (region?.isNamedConstant === true) continue;
      if (rule.allowLiteralsIn?.includes(regionName) === true) continue;
    }

    findings.push({
      file: relPath,
      line,
      column,
      kind: 'numeric',
      text,
      region: regionName,
      message: rule.role === 'renderer' ? RENDERER_ADVICE : CONSTANTS_ADVICE,
    });
  }

  // --- colour -------------------------------------------------------------
  if (rule.role !== 'palette') {
    const visible = withoutComments(source);
    for (const match of visible.matchAll(COLOUR_LITERAL)) {
      const { line, column } = lineColumn(visible, match.index);
      findings.push({
        file: relPath,
        line,
        column,
        kind: 'colour',
        text: match[0],
        region: regionAt(line)?.name ?? MODULE_REGION,
        message: COLOUR_ADVICE,
      });
    }
  }

  return findings;
}

/** Audit a whole tree. `files` is `[relPath, source]` pairs. */
export function auditTree(files: readonly (readonly [string, string])[]): readonly Finding[] {
  return files.flatMap(([relPath, source]) => auditSource(relPath, source));
}

const SOURCE_EXTENSION = /\.tsx?$/;
const TEST_FILE = /\.test\.tsx?$/;
const VENDORED = /(?:^|\/)node_modules\//;

/**
 * Files this audit refuses to read.
 *
 * Tests are supposed to contain literals — asserting `toBe(240)` is the point.
 * Everything else is audited, including files added after this was written,
 * because the default role is `renderer`.
 */
export function isAudited(relPath: string): boolean {
  if (!SOURCE_EXTENSION.test(relPath)) return false;
  if (TEST_FILE.test(relPath)) return false;
  if (VENDORED.test(relPath)) return false;
  return true;
}
