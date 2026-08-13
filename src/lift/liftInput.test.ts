/**
 * THE STAGE MUST TAKE A PRESS AS A LIFT INPUT, NOT AS A TEXT SELECTION.
 *
 * WHY THIS FILE EXISTS: a human playtest, which is the only instrument that
 * could have found it. GDD §12.1 says nobody in this build can judge whether the
 * lift feels good; the first real players said the squat IS fun, and in the same
 * session reported that pressing on a mobile browser highlighted the surface and
 * put selection handles on it. The squat's whole input is a press-and-hold — the
 * descent — which is precisely the gesture a browser reads as "select this".
 *
 * WHAT THIS FILE CAN AND CANNOT SAY, stated first so nobody reads it as more.
 * `vitest.config.ts` is `environment: node`: nothing here renders, so this
 * cannot say the property reached a DOM node or that a real press behaved. It
 * reads the shipped source and asserts the three properties are declared on the
 * style the touch target uses. That is a REACHABILITY check, not a behaviour
 * one, and the behaviour half needs a browser probe reading computed style on
 * the real element — recorded as an open gap rather than implied to be covered.
 *
 * The three properties are checked SEPARATELY and by name because they fix
 * different halves of the bug and dropping any one leaves a working-looking
 * screen: `userSelect` stops the highlight, `touchAction` stops the browser
 * eating the gesture before the handler sees it, `WebkitTouchCallout` stops
 * iOS's press-and-hold callout. A single check for "some selection property"
 * would go green on one of three.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { codeOnly } from '../tuning/audit';

const SCREEN_PATH = path.join(__dirname, 'LiftScreen.tsx');
const SCREEN = readFileSync(SCREEN_PATH, 'utf8');
/**
 * The same source with comments and strings blanked, offsets preserved.
 *
 * COUNTING IN THE RAW SOURCE WAS WRONG AND THE FIRST RUN OF THIS FILE PROVED
 * IT: the doc comment on `PRESS_NOT_SELECT` names all three properties in
 * prose, so every count came back 2 and the guard reddened against correct
 * code. That is the "textual pin with more than one witness" shape CLAUDE.md
 * records — appearing inside the guard written to avoid it. A declaration is
 * code; a mention of one in a comment is not.
 */
const SCREEN_CODE = codeOnly(SCREEN);

/** The testID the touch target carries, so the guard names the real element. */
const TOUCH_TEST_ID = 'lift-touch';

/**
 * Every property the press fix is made of, with what each one alone leaves
 * broken. Pinned as a list so adding a fourth is an edit here rather than a
 * silent widening.
 */
const PRESS_PROPERTIES = [
  { key: 'userSelect', leaves: 'the surface highlights and selection handles appear' },
  { key: 'touchAction', leaves: 'the browser claims the gesture before the handler sees it' },
  { key: 'WebkitTouchCallout', leaves: "iOS Safari's press-and-hold callout still fires" },
] as const;

/** Slice the `stage` style object out of the stylesheet, brace-balanced. */
function stageStyleBlock(source: string): string {
  const start = source.indexOf('  stage: {');
  if (start === -1) throw new Error('the `stage` style is gone — this guard names a style that no longer exists');
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error('unbalanced braces in the `stage` style');
}

describe('a press on the lift stage is an input, not a selection', () => {
  it('puts the touch target and the stage style on the same element', () => {
    // The guard below is about `styles.stage`. If the touch target stopped
    // using it, every assertion here would be true of a style nothing presses —
    // the "reach and predicate are two axes" shape this repo keeps finding.
    const target = SCREEN.indexOf(`testID="${TOUCH_TEST_ID}"`);
    expect(target, `no element carries testID="${TOUCH_TEST_ID}"`).toBeGreaterThan(-1);
    const openingTag = SCREEN.lastIndexOf('<Pressable', target);
    expect(openingTag, 'the touch target is not a Pressable any more').toBeGreaterThan(-1);
    const tag = SCREEN.slice(openingTag, target);
    expect(tag, 'the pressed element does not use styles.stage').toContain('style={styles.stage}');
  });

  it.each(PRESS_PROPERTIES)(
    'declares $key on the pressed stage, without which $leaves',
    ({ key }) => {
      const block = stageStyleBlock(SCREEN);
      // Counted, not merely present: the spread makes this one shared object,
      // and a count pins that a second conflicting declaration has not appeared
      // beside it. CLAUDE.md's rule about textual pins with more than one
      // witness applies to source scans identically.
      const declarations = (SCREEN_CODE.match(new RegExp(`\\b${key}\\s*:`, 'g')) ?? []).length;
      expect(declarations, `${key} is declared ${declarations} times in the file`).toBe(1);
      expect(
        block.includes('PRESS_NOT_SELECT') || block.includes(key),
        `the stage style neither spreads PRESS_NOT_SELECT nor declares ${key}`,
      ).toBe(true);
      expect(SCREEN).toMatch(new RegExp(`${key}\\s*:\\s*'none'`));
    },
  );

  it('spreads the shared object rather than restating the values inline', () => {
    // Not style policing: if the stage restated them inline, the properties
    // could drift from the ones the comment documents while both look right.
    expect(stageStyleBlock(SCREEN)).toContain('...PRESS_NOT_SELECT');
    expect(SCREEN).toContain('const PRESS_NOT_SELECT = {');
  });

  it('states what this file cannot check, and the count is real', () => {
    // Non-vacuity with a count rather than a bound: three properties, and if a
    // fourth is added to the constant without a row above, this is the check
    // that notices.
    const inConstant = (SCREEN_CODE.match(/^\s+(userSelect|touchAction|WebkitTouchCallout):/gm) ?? []).length;
    expect(inConstant, 'PRESS_NOT_SELECT no longer holds exactly the pinned properties').toBe(
      PRESS_PROPERTIES.length,
    );
    // The declared gap, asserted so deleting the note reddens rather than
    // quietly removing the caveat.
    expect(SCREEN).toContain('WHAT THIS DOES NOT FIX');
  });
});
