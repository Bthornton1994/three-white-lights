/**
 * WHAT HAPPENS TO A REFUSED MEET SUBMISSION.
 *
 * ===========================================================================
 * WHY THIS FILE READS SOURCE INSTEAD OF RENDERING
 * ===========================================================================
 * `useMeetDay` is a React hook and this repository has no renderer in its test
 * environment — no `@testing-library/react-native`, no `react-test-renderer`.
 * Standing one up to assert one field is more machinery than the claim is worth
 * and would be a different piece of work.
 *
 * SO THIS IS A SOURCE SCAN AND IT SAYS SO. It is a weaker instrument than
 * rendering the hook, and the weakness is specific: it can show that the refusal
 * is KEPT, and it cannot show that anything renders it. Nothing does. That is
 * stated in `useMeetDay.ts` at the site, in `meetServer.ts`'s note on
 * `applyMeetResult`, and in GDD §11's open pound-meet item, and this file does
 * not claim otherwise.
 *
 * WHAT IT BUYS, which is the property that was actually broken: restore
 * `if (!result.ok) return current;` and this file goes red. That line dropped
 * every refusal on the floor — no recap, no explanation, no route back except
 * `restart()`, for a player who had just taken nine attempts — and it dropped
 * them somewhere no test and no screen could see afterwards.
 *
 * ===========================================================================
 * AND IT PINS THE RETRY DECISION, WHICH IS A JUDGEMENT AND NOT AN OVERSIGHT
 * ===========================================================================
 * `submittedRef.current = key` is set BEFORE `applyMeetResult` is called, so a
 * refusal is final for this meet until `restart()`. Moving it after the call, so
 * that only a success marks the meet submitted, looks kinder and is worse: every
 * refusal `applyMeetResult` can return is a pure function of inputs that do not
 * change while the meet sits in `recap`/`bombed`, so the retry recomputes the
 * same answer once per render, forever, with the screen still empty.
 *
 * That reasoning stops holding the day this becomes a real `fetch`, because a
 * transport failure IS retryable. The pin exists so that change is deliberate.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const HOOK_PATH = fileURLToPath(new URL('./useMeetDay.ts', import.meta.url));
const SOURCE = readFileSync(HOOK_PATH, 'utf8');

const SERVER_PATH = fileURLToPath(new URL('../game/meetServer.ts', import.meta.url));

/**
 * Every member of `MeetServerErrorCode`, read out of the module that declares
 * it.
 *
 * A TYPE UNION HAS NO RUNTIME VALUE, so this is a source scan of the union's own
 * declaration rather than an import.
 *
 * COMMENTS ARE STRIPPED BEFORE THE TERMINATOR IS LOOKED FOR, not after: every
 * arm of that union carries a doc comment and several contain a semicolon, so
 * searching the raw text for `;` ends the declaration inside prose and finds
 * half the codes. The control assertion at the call site is what caught that.
 */
function meetServerErrorCodes(): readonly string[] {
  const source = readFileSync(SERVER_PATH, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  const start = source.indexOf('export type MeetServerErrorCode =');
  if (start < 0) throw new Error('useMeetDay.test: MeetServerErrorCode is not declared where expected');
  const end = source.indexOf(';', start);
  if (end < 0) throw new Error('useMeetDay.test: MeetServerErrorCode has no terminator');
  return [...source.slice(start, end).matchAll(/'([A-Z_]+)'/g)].map((match) => match[1] ?? '');
}

describe('a refused meet submission is disclosed rather than dropped', () => {
  it('keeps the error instead of returning the cache unchanged and forgetting it', () => {
    expect(SOURCE).toContain('setSubmissionError(result.error)');
    // The exact line that used to be the whole handler. Its return is still
    // there — a refusal must not advance the cache — but it no longer stands
    // alone.
    expect(SOURCE).not.toMatch(/if \(!result\.ok\) return current;/);
  });

  it('hands the error out of the hook, so a screen has something to read', () => {
    expect(SOURCE).toMatch(/readonly submissionError: MeetServerError \| null;/);
    expect(SOURCE).toMatch(/return \{[^}]*submissionError[^}]*\};/s);
  });

  it('clears it on restart, so a fresh meet does not open holding the last refusal', () => {
    expect(SOURCE).toMatch(/const restart = useCallback\(\(\) => \{[\s\S]*?setSubmissionError\(null\);[\s\S]*?\}/);
  });

  it('does not retry: the meet is marked submitted BEFORE the call, not after', () => {
    const markIndex = SOURCE.indexOf('submittedRef.current = key;');
    const callIndex = SOURCE.indexOf('applyMeetResult(');
    expect(markIndex).toBeGreaterThan(-1);
    expect(callIndex).toBeGreaterThan(-1);
    expect(markIndex).toBeLessThan(callIndex);
  });

  it('says at the site what the refusals are, so an editor of this file finds them', () => {
    // The disclosure existed in `meetServer.ts` and in the GDD and NOT here,
    // which is the one place somebody changing this effect is looking.
    //
    // READ OFF `MeetServerErrorCode` RATHER THAN LISTED. This used to be a
    // hand-written array of six, which was complete on the day it was written
    // and silently incomplete the moment a seventh code was added — and two were
    // added. The union is the source; the disclosure has to cover all of it.
    const codes = meetServerErrorCodes();
    expect(codes.length).toBeGreaterThan(0);
    // The control: the scan must be finding the real union, not an empty match.
    expect(codes).toContain('UNSUPPORTED_MEET_UNIT');
    for (const code of codes) {
      expect(SOURCE, code).toContain(code);
    }
  });
});
