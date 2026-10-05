/**
 * pressGuard.ts — what a lift press surface has to declare so the browser hands
 * the gesture to the game, in one place, for the three screens that press one.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A MODULE AND NOT A CONSTANT INSIDE THE SCREEN THAT FOUND THE BUG
 * ---------------------------------------------------------------------------
 * A human playtest (GDD §12.1) reported that pressing the lift surface on a
 * mobile browser handed the press to the browser's own gesture handling. The
 * fix that shipped was `PRESS_NOT_SELECT`, declared inside `LiftScreen.tsx`.
 *
 * `AppShell.tsx` mounts `LiftScreen` behind `route.surface === 'replay'`, and
 * `shellRoute.ts` builds that surface with `source: 'debug'`. So the fix landed
 * on the one lift surface no player can reach, while the two a player does
 * reach — `SetView` (GDD §3.2's daily set) and `AttemptView` (GDD §6.2's meet
 * attempt) — carried none of it. The source scan guarding it read
 * `LiftScreen.tsx` and was green throughout.
 *
 * That is the shape CLAUDE.md records as "a guard written for one hook must be
 * applied to its sibling, mechanically". The repair is not three copies of the
 * constant: it is one declaration, and a guard that discovers its subjects from
 * the tree rather than from a list somebody has to remember to extend.
 * `liftInput.test.ts` is that guard — it finds every `<LiftStage>` in `src/`,
 * walks up to the element a finger presses, and requires both objects below.
 *
 * ---------------------------------------------------------------------------
 * TWO OBJECTS AND NOT ONE, BECAUSE CSS PUTS THE TWO HALVES ON DIFFERENT NODES
 * ---------------------------------------------------------------------------
 * The three properties were shipped as a single spread on the pressed element.
 * Two of them inherit and one does not, so a single object is right for exactly
 * one of the two placements and wrong for the other:
 *
 *   - `user-select` and `-webkit-touch-callout` INHERIT. On the pressed element
 *     they reach the Skia `<canvas>` under the finger and nothing else, which
 *     is measurably the wrong target: `document.caretRangeFromPoint` at the
 *     press point returns the CANVAS node at offset 0, Blink will not start a
 *     selection inside a replaced element, and forcing `user-select: text` back
 *     onto that element leaves the same press-and-drift selecting nothing.
 *     Measured on both arms in `tools/verify-lift-press.mjs`, which reports it
 *     as a dead domain rather than as a green check.
 *
 *     What IS selectable on these screens is the copy around the stage — the
 *     prompt a thumb sits directly under. The same gesture on `session-prompt`
 *     selects "P AND HOLD TO D" out of "TAP AND HOLD TO DESCEND". So the
 *     inheriting pair goes on the SCREEN ROOT, where it reaches the text.
 *
 *   - `touch-action` does NOT inherit, and it is the half that eats input
 *     rather than merely looking wrong. It has to sit on the element the press
 *     lands in, because the browser resolves it from the hit node up the
 *     ancestor chain and a value on a sibling of that chain does nothing.
 *
 * The split is therefore a fact about CSS rather than a preference, and both
 * halves of it are checked: `liftInput.test.ts` checks the placement statically,
 * `tools/verify-lift-press.mjs` reads computed style off the live elements and
 * counts `pointercancel` under a real touch pan.
 *
 * EVERY LIFT PRESS SURFACE IN THE REPOSITORY CARRIES BOTH OBJECTS, AND THE
 * CHECK THAT SAYS SO NAMES NO SCREEN. That is the whole repair, and the reason
 * it is written as a guarantee rather than as a habit: the previous version of
 * this fix was correct, guarded, and declared on one file — and the file it was
 * declared on was the replay harness. A guard that lists its subjects stops
 * covering the code the moment somebody adds a screen, which is what happened.
 * `liftInput.test.ts` walks the repository, finds every `<LiftStage>`, climbs to
 * the `Pressable` around it, and requires `PRESS_NOT_TAKEN` on that element and
 * `PRESS_NOT_SELECT` on an ancestor — with the spread resolved to an import from
 * THIS module, so a local constant spelled the same does not satisfy it. A
 * fourth surface inherits the requirement by mounting a stage.
 * `@guarantee press-guard-on-every-played-surface`
 *
 * ---------------------------------------------------------------------------
 * WHAT IS NOT HERE, AND WHY EACH ONE IS ABSENT
 * ---------------------------------------------------------------------------
 * `-webkit-tap-highlight-color` is the other property a "the surface
 * highlighted" report could plausibly mean, and it is deliberately not added:
 * measured on the running app, every element from `session-touch` up to `BODY`
 * already computes `rgba(0, 0, 0, 0)`, because React Native Web sets it
 * globally. Adding it would be a declaration with no state of the app behind
 * it — decoration wearing the costume of a fix.
 *
 * THREE OF THE FOUR GUARDS HERE HOLD NO NUMBER, and the fourth holds one it
 * reads out of `LIFT_TUNING.FEEDBACK` rather than declaring. This paragraph
 * used to say "there are no numbers here" and that stopped being true when
 * `PRESS_WITHOUT_DELAY` landed, so it is corrected rather than left standing.
 * Every timing this module touches is still the mechanic's, in
 * `src/game/liftTuning.ts`. What this file is about is the difference between
 * the input arriving and not arriving.
 *
 * NATIVE IS UNAFFECTED. These are web CSS properties; React Native Web passes
 * them through to the DOM and the native renderers ignore them. They are
 * deliberately not behind a `Platform.OS === 'web'` branch — a conditional style
 * object makes the key set depend on where the file is read from, which would
 * turn the guard into a claim about the test environment rather than about the
 * shipped screen.
 */

import { LIFT_TUNING } from '../game/liftTuning';

/**
 * The two INHERITED properties, for the root of a screen that has a lift stage
 * on it.
 *
 * Placed on the root rather than on the stage because that is where they have a
 * subject: the text. `user-select: none` stops the highlight and the selection
 * handles; `-webkit-touch-callout: none` stops iOS Safari's press-and-hold
 * callout, which is a separate gesture from selection and survives the other
 * two.
 *
 * `-webkit-touch-callout` is unreadable in Blink — `getComputedStyle` returns
 * the empty string on an element that declares it — so no browser check on this
 * engine can say whether it reached the DOM. That is a NAMED SKIPPED check in
 * `tools/verify-lift-press.mjs`, and the declaration's presence is what
 * `liftInput.test.ts` covers instead. Neither file pretends to cover the other's
 * half.
 *
 * THAT GAP STOPPED BEING THEORETICAL. A phone playtest (past GDD §12.1's first
 * one) found the callout coming back — not everywhere, but on the far side of
 * the descent: correctly suppressed for the held-down depth press, un-suppressed
 * for the drive press and the hold through lockout. Investigated rather than
 * patched blind:
 *
 *   - `tools/verify-lift-press.mjs`'s computed-style reads were taken ONCE, at
 *     BRACE, before any press. A new probe drives a real rep through every phase
 *     — DESCENT, HOLE, ASCENT, LOCKOUT, RESOLVED — and re-reads `user-select`
 *     and `touch-action` at each boundary. They never move: same values from
 *     BRACE through the next rep's BRACE. So the phase-dependent symptom is real
 *     on a phone and absent from every property this engine can read back,
 *     which narrows it to the one property that ISN'T readable here.
 *   - Measured directly, not inferred: `React.createElement`'s compiled output
 *     for `WebkitTouchCallout: 'none'` reaches the browser as the correct CSS
 *     text — `.r-WebkitTouchCallout-xxxxxxx{-webkit-touch-callout:none;}`,
 *     confirmed by calling the compiler in isolation. But
 *     `document.styleSheets[…].cssRules[…].cssText` on the LIVE page reports
 *     that same rule with an EMPTY body. Blink's `CSSStyleSheet.insertRule`
 *     parses the declaration and discards it, because Blink has never
 *     implemented the property under any name — not merely "can't read the
 *     computed value back" (the old framing) but "never stores the declaration
 *     in the first place." That is sharper evidence for the same disclosed gap,
 *     not a new one: it says nothing about WebKit, which originated the
 *     property and — unlike Blink — has a reason to keep it.
 *
 * So this remains something no engine available in this repository's tooling
 * can confirm or refute on the one property that matters. `SUPPRESS_CONTEXT_MENU`
 * below is the response: a second, CSS-independent layer that does not ask
 * Blink to store a declaration it has no record for.
 */
export const PRESS_NOT_SELECT = {
  userSelect: 'none',
  WebkitTouchCallout: 'none',
} as const;

/**
 * A JS-level second layer for the same gesture `-webkit-touch-callout` is
 * supposed to suppress: the native "Copy / Select / Look Up" callout a
 * sustained touch produces. Spread onto the SAME element as `PRESS_NOT_SELECT`
 * — `onContextMenu` bubbles, so one declaration on the screen root catches an
 * event that originated on the stage or on the copy beside it, exactly the two
 * places `PRESS_NOT_SELECT` already covers by inheritance.
 *
 * WHY A SEPARATE MECHANISM RATHER THAN A HARDER PUSH ON THE CSS PROPERTY. The
 * callout is not only a CSS-suppressible highlight; on iOS it is frequently
 * surfaced as a native `contextmenu`-equivalent gesture, and preventing that
 * DOM event is a standard, engine-independent mitigation for exactly this
 * failure mode — it does not depend on a browser's CSS property table, only on
 * the DOM Events spec every engine here implements identically. Verified
 * directly against a real dispatched `contextmenu` event in this repository's
 * one available engine (`tools/verify-lift-press.mjs`'s PROBE 3): the event
 * reaches this handler and `defaultPrevented` reads `true`, on both the stage
 * and the copy, via bubbling. That is real, engine-observable evidence for the
 * DOM half of the fix — it is not evidence about iOS's native callout, which
 * remains unverifiable here.
 *
 * EVERY LIFT PRESS SURFACE CARRIES THIS TOO, DISCOVERED THE SAME WAY THE OTHER
 * TWO OBJECTS ARE: `liftInput.test.ts` climbs from every `<LiftStage>` to its
 * ancestors and requires a spread bound to THIS export, so a fourth surface
 * inherits the requirement by mounting a stage rather than by somebody
 * remembering this file. `@guarantee context-menu-guard-on-every-played-surface`
 *
 * NOT A JSX PROP TYPE THIS PROJECT'S `react-native` TYPES DECLARE.
 * `onContextMenu` is a React Native Web extension; `@types/react-native`'s
 * `ViewProps` does not know about it, and writing it as a literal JSX
 * attribute is a `tsc` error (`Property 'onContextMenu' does not exist`).
 * Spread a typed object instead — `{...SUPPRESS_CONTEXT_MENU}` — because
 * TypeScript's excess-property check applies to object LITERALS in an
 * attribute list and not to a spread of a separately-typed value, which is
 * true today and is what lets this reach the DOM without an `any`. React
 * Native Web's own prop-forwarding list (`modules/forwardedProps`) already
 * recognises `onContextMenu` at runtime; the gap is only in this project's
 * borrowed React Native types, not in what ships.
 */
export const SUPPRESS_CONTEXT_MENU = {
  onContextMenu: (event: { readonly preventDefault: () => void }): void => {
    event.preventDefault();
  },
} as const;

/**
 * The one property that does NOT inherit, for the element a finger presses.
 *
 * Without it a React Native Web `Pressable` computes `touch-action:
 * manipulation` — its own default, which is what an element has when nobody
 * adds anything, not a partial fix. Measured on the played session surface at
 * that default: a 20px finger drift during a press-and-hold produces one
 * `pointercancel`, which is the browser announcing it has claimed the pointer
 * and the app will hear no more about the gesture. The squat's whole input is a
 * press-and-hold, so that is the descent being taken away mid-rep.
 */
export const PRESS_NOT_TAKEN = {
  touchAction: 'none',
} as const;

/**
 * THE FOURTH GUARD, AND THE ONE THAT WAS SWALLOWING WHOLE INPUTS RATHER THAN
 * DECORATING THEM.
 *
 * React Native Web's `Pressable` schedules `onPressIn` behind
 * `PressResponder`'s `DEFAULT_PRESS_DELAY_MS` — 50 ms — and a press released
 * before that timer fires produces NO `onPressIn` AT ALL. Measured on the
 * played session surface, driving a real bench rep to the press command and
 * then tapping five times at the same cadence with only the contact duration
 * varied: 40 ms taps counted ZERO, 120 ms taps counted four, 250 ms taps
 * counted three and the rep locked out. The mechanic was fine throughout —
 * `lift.test.ts` counts a tap the instant it arrives — and the screen was
 * never handing it one.
 *
 * WHY IT MATTERS MORE THAN THE OTHER THREE HERE. The 2026-08-25 ruling makes
 * bench's answer "rapid tapping to exert as much force as possible", and
 * `PRESS_BURST_TAP_REFRACTORY_TICKS` puts the mechanic's own floor at 50 ms
 * BETWEEN counted taps — a rate a player reaches with contacts far shorter
 * than 50 ms each. So the harder somebody mashed, the more of their taps the
 * screen threw away, which inverts the whole point of a saturating force curve
 * (mashing is supposed to CAP, not to fail).
 *
 * NOT A ROBOT-ONLY PROBLEM, and that is why it is fixed rather than worked
 * around in the driver. `PressResponder` applies the delay in
 * `onResponderGrant`, which is the path a TOUCH takes as much as a mouse; the
 * only caller that skips it is the keyboard one. A thumb loses the same taps.
 *
 * THE VALUE IS `LIFT_TUNING.FEEDBACK.PRESS_IN_DELAY_MS` and not a literal here,
 * because it is a duration and this module's own header says it holds none —
 * the other three guards are structural declarations. That header is corrected
 * above rather than left standing.
 *
 * SPREAD, NOT WRITTEN AS A JSX ATTRIBUTE, for exactly the reason
 * `SUPPRESS_CONTEXT_MENU` is: `delayPressIn` is a React Native Web prop that
 * this project's borrowed React Native types do not declare (`PressableProps`
 * has `unstable_pressDelay` and no `delayPressIn`), so a literal attribute is a
 * `tsc` error while a spread of a separately-typed object is not. React Native
 * Web's `Pressable` reads `delayPressIn` and hands it to `PressResponder` as
 * `delayPressStart`; the gap is in the types, not in what ships.
 *
 * ON THE PRESS TARGET, NOT ON AN ANCESTOR. It is a prop of the `Pressable`
 * whose responder is being configured — it neither inherits nor bubbles, so it
 * sits where `PRESS_NOT_TAKEN` sits and not where `PRESS_NOT_SELECT` does.
 * `@guarantee no-press-surface-swallows-a-fast-tap`
 */
export const PRESS_WITHOUT_DELAY = {
  delayPressIn: LIFT_TUNING.FEEDBACK.PRESS_IN_DELAY_MS,
} as const;
