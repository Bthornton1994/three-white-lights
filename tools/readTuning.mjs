/**
 * readTuning.mjs — READ A TUNING VALUE OUT OF ITS SOURCE, RATHER THAN TYPE IT
 * AGAIN INTO A TOOL.
 *
 * ===========================================================================
 * WHY THIS EXISTS, AND WHY IT IS NOT THE OPPOSITE OF `capture-meet.mjs`'S RULE
 * ===========================================================================
 * Two different things get restated in this directory and only one of them
 * should be.
 *
 *   A LIST OF WHAT THE APP CONTAINS — the beat names, the four firing moments,
 *   the line each one prints — is restated ON PURPOSE. Those tools are a second,
 *   independent statement of what the piece is supposed to hold, and a capture
 *   that agreed with a broken module by construction would be worth nothing.
 *   Nothing here changes that.
 *
 *   A NUMBER A CHECK COMPARES AGAINST is a different animal. It is not a second
 *   opinion about anything; it is the same fact, typed twice, and the second
 *   copy silently stops being true. `tools/capture-cutin.mjs` held
 *   `AUTO_DISMISS_MS = 1720` by hand and asked "did the tap beat the hold?"
 *   against it — so on a build whose real hold was 10 ms the question would
 *   still have been answered yes. The bound was measured against a number the
 *   app had stopped using.
 *
 * So: a number a check STEERS BY or COMPARES AGAINST is read from source here.
 * A name a check IDENTIFIES the app by stays transcribed in the tool.
 *
 * ===========================================================================
 * A PARSER THAT HAS STOPPED MATCHING AGREES WITH EVERY FILE
 * ===========================================================================
 * Every reader below returns `null` when it finds nothing, and `null` is
 * indistinguishable from "the value is missing" at the call site — which is how
 * a check that reads a constant becomes a check that reads nothing. So every
 * consumer must call `parserSelfTest()` and FAIL on it, and must fail on a
 * `null` read rather than substituting a default. `SELF_TEST_FIXTURE` is the
 * source text the readers are known to handle, including the two shapes that
 * have caught a regression before: a property whose name is a SUFFIX of another
 * one, and the last entry of an inline block, which has no trailing comma.
 *
 * These are the same three readers `tools/verify-shell-route.mjs` grew inline.
 * That file is not changed here — it is another piece's instrument and its
 * copies are cross-checked against the source by a check of its own — but new
 * readers belong in one place rather than a fourth.
 */

/** The number a `NAME: <number>,` property is given anywhere in `source`. */
export function numberInSource(source, name) {
  const found = new RegExp(`(?:^|[^A-Za-z0-9_$])${name}\\s*:\\s*(-?[0-9]+(?:\\.[0-9]+)?)\\s*[,}\\)]`).exec(
    source,
  );
  return found === null ? null : Number(found[1]);
}

/**
 * The number a property called `key` is given INSIDE the braces of the named
 * block, or `null`.
 *
 * `numberInSource` answers with the first match in the whole file, which is
 * right for a `SCREAMING_CASE` tuning property and useless for `'bomb-out'`,
 * which appears in half a dozen unrelated tables.
 */
export function numberInBlock(source, blockName, key) {
  const at = source.search(new RegExp(`(?:^|[^A-Za-z0-9_$])${blockName}\\s*[:=]`, 'm'));
  if (at < 0) return null;
  const open = source.indexOf('{', at);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // TERMINATED BY `,` OR BY A CLOSING BRACE. The last entry of an inline
        // block has no comma after it, and requiring one is what made an
        // earlier copy of this reader answer `null` for a real value.
        const found = new RegExp(
          `(?:^|[^A-Za-z0-9_$])'?${escaped}'?\\s*:\\s*(-?[0-9]+(?:\\.[0-9]+)?)\\s*[,}\\)]`,
        ).exec(source.slice(open, i + 1));
        return found === null ? null : Number(found[1]);
      }
    }
  }
  return null;
}

/** The single-quoted string a `NAME: '<text>',` property is given, or `null`. */
export function stringInSource(source, name) {
  const found = new RegExp(`(?:^|[^A-Za-z0-9_$])${name}\\s*:\\s*'((?:[^'\\\\]|\\\\.)*)'`).exec(source);
  return found === null ? null : found[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
}

/**
 * A source text the readers are KNOWN to handle, with the traps in it.
 *
 * `SUB_HOLD_MS` must not answer a question about `HOLD_MS`; `deadlift` has no
 * trailing comma; `'bomb-out'` is quoted and hyphenated, which is the shape the
 * cut-in allowance table is written in.
 */
export const SELF_TEST_FIXTURE = `
  SUB_HOLD_MS: 99,
  HOLD_MS: 1600,
  ALLOWANCE: Object.freeze({
    'third-attempt-walkout': 0.5,
    'bomb-out': 1,
  }),
  STARTING: Object.freeze({ squat: 180, deadlift: 220 }),
  A_LINE: 'High. The hips never got under.',
`;

/**
 * Does this module still read the fixture correctly? Returns a list of
 * complaints; empty means the parser is live.
 *
 * A CONSUMER MUST FAIL ON A NON-EMPTY RESULT. The whole hazard of reading a
 * constant out of source is that a regex which no longer matches reports
 * `null`, and a `null` treated as "not configured" is a check that has quietly
 * stopped asking anything.
 */
export function parserSelfTest() {
  const f = SELF_TEST_FIXTURE;
  const want = [
    ['numberInSource HOLD_MS', numberInSource(f, 'HOLD_MS'), 1600],
    ['numberInSource SUB_HOLD_MS', numberInSource(f, 'SUB_HOLD_MS'), 99],
    ['numberInBlock ALLOWANCE bomb-out', numberInBlock(f, 'ALLOWANCE', 'bomb-out'), 1],
    ['numberInBlock ALLOWANCE walkout', numberInBlock(f, 'ALLOWANCE', 'third-attempt-walkout'), 0.5],
    ['numberInBlock STARTING deadlift (no trailing comma)', numberInBlock(f, 'STARTING', 'deadlift'), 220],
    ['stringInSource A_LINE', stringInSource(f, 'A_LINE'), 'High. The hips never got under.'],
    ['numberInSource on a name that is not there', numberInSource(f, 'NOT_PRESENT_MS'), null],
    ['stringInSource on a name that is not there', stringInSource(f, 'NOT_PRESENT'), null],
  ];
  return want
    .filter(([, got, expected]) => got !== expected)
    .map(([what, got, expected]) => `${what}: read ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
}
