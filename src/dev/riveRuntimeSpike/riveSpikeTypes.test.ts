import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { SPIKE_RIV_ASSET_RELATIVE_PATH } from './riveSpikeTypes';

const STAGES = ['RiveSpikeStage.native.tsx', 'RiveSpikeStage.web.tsx'] as const;

describe('the spike asset path is written down once and required as a literal', () => {
  // Metro refuses `require(someVariable)`, so both stages carry the path as a
  // string literal — which means the documented constant can drift from what
  // is actually required. This pins the two together, in both directions.
  it('both platform stages require exactly the documented asset path', () => {
    for (const stage of STAGES) {
      const source = readFileSync(new URL(`./${stage}`, import.meta.url), 'utf8');
      const literal = `require('${SPIKE_RIV_ASSET_RELATIVE_PATH}')`;
      expect(source.includes(literal), `${stage} requires ${SPIKE_RIV_ASSET_RELATIVE_PATH}`).toBe(true);
      // And not the constant — a `require(SPIKE_RIV_ASSET_RELATIVE_PATH)` is
      // the bundle-time failure this test exists to keep out.
      expect(source.includes('require(SPIKE_RIV_ASSET_RELATIVE_PATH)'), `${stage} requires a variable`).toBe(false);
    }
  });

  it('the placeholder asset exists at that path, so the require resolves at bundle time', () => {
    const bytes = readFileSync(new URL(`./${SPIKE_RIV_ASSET_RELATIVE_PATH}`, import.meta.url));
    expect(bytes.length).toBeGreaterThan(0);
    // And it is the DELIBERATE placeholder, not a real Rive file: Rive's format
    // opens with the bytes 'RIVE'. If someone drops a real asset here, this
    // reddens so the ADR's spike section gets re-measured rather than read stale.
    expect(bytes.subarray(0, 4).toString('latin1'), 'a real .riv arrived — re-measure the spike').not.toBe('RIVE');
  });
});
