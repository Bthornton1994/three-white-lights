import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { SPIKE_BOUND_PROPERTY, SPIKE_RIV_ASSET_RELATIVE_PATH } from './riveSpikeTypes';

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
      // Both write the one property the file exposes, by the shared name.
      expect(source.includes('SPIKE_BOUND_PROPERTY'), `${stage} binds the documented property`).toBe(true);
    }
    expect(SPIKE_BOUND_PROPERTY).toBe('health');
  });

  it('the asset at that path is a real Rive file whose hash the provenance record names', () => {
    const bytes = readFileSync(new URL(`./${SPIKE_RIV_ASSET_RELATIVE_PATH}`, import.meta.url));
    expect(bytes.length).toBeGreaterThan(0);
    // Rive's format opens with the bytes 'RIVE'. Until 2026-09-08 this test
    // pinned the OPPOSITE — that the path held the deliberate placeholder —
    // and reddened on purpose when a real asset arrived so §7 was re-measured.
    // It was; this is the other side of that pin.
    expect(bytes.subarray(0, 4).toString('latin1')).toBe('RIVE');
    const provenance = readFileSync(new URL('../../../assets/dev/THIRD-PARTY-RIVE-ASSETS.md', import.meta.url), 'utf8');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    expect(provenance.includes(sha256), 'the bytes shipped are the bytes the licence record describes').toBe(true);
  });

  it('the deliberate placeholder still exists for the error path, and is still not a Rive file', () => {
    const bytes = readFileSync(new URL('../../../assets/dev/rive-spike.riv', import.meta.url));
    expect(bytes.length).toBeGreaterThan(0);
    expect(bytes.subarray(0, 4).toString('latin1')).not.toBe('RIVE');
  });
});
