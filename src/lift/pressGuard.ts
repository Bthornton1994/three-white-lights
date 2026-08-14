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
 * There are no numbers here, so nothing here is a game-feel value to tune. The
 * mechanic's timings live in `src/game/liftTuning.ts`. This is the difference
 * between the input arriving and not arriving.
 *
 * NATIVE IS UNAFFECTED. These are web CSS properties; React Native Web passes
 * them through to the DOM and the native renderers ignore them. They are
 * deliberately not behind a `Platform.OS === 'web'` branch — a conditional style
 * object makes the key set depend on where the file is read from, which would
 * turn the guard into a claim about the test environment rather than about the
 * shipped screen.
 */

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
 */
export const PRESS_NOT_SELECT = {
  userSelect: 'none',
  WebkitTouchCallout: 'none',
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
 * EVERY LIFT PRESS SURFACE IN THE REPOSITORY CARRIES BOTH OBJECTS, AND THE
 * CHECK THAT SAYS SO NAMES NO SCREEN.
 *
 * That is the whole repair, and the reason it is stated as a guarantee rather
 * than as a habit: the previous version of this fix was correct, guarded, and
 * declared on one file, and the file it was declared on was the replay harness.
 * A guard that lists its subjects stops covering the code the moment somebody
 * adds a screen, which is exactly what happened.
 *
 * `liftInput.test.ts` walks the repository, finds every `<LiftStage>`, climbs to
 * the `Pressable` around it, and requires `PRESS_NOT_TAKEN` on that element and
 * `PRESS_NOT_SELECT` on an ancestor — with the spread resolved to an import from
 * THIS module, so a local constant spelled the same does not satisfy it. A
 * fourth surface inherits the requirement by mounting a stage.
 * `@guarantee press-guard-on-every-played-surface`
 */
