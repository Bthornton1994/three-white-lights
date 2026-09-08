/**
 * The composed stage, pinned as source (it imports `react-native`, which
 * vitest cannot parse): one frame, two absoluteFill layers, the room drawn
 * only from `roomAsset.ts`, no painted scene, the box measured rather than
 * assumed, the real `AthleteStage` mounted exactly once.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { codeOnly } from '../tuning/audit';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RAW = readFileSync(path.join(HERE, 'AthleteComposedStage.tsx'), 'utf8');
const CODE = codeOnly(RAW);

describe('AthleteComposedStage — one frame for the room and the rig', () => {
  it('composes from composeAthleteStage on the measured box (or the box it is handed), never from the rep', () => {
    expect(RAW).toContain("from './athleteComposition'");
    expect(CODE).toMatch(/composeAthleteStage\(box, hud\)/);
    expect(CODE).toContain('onLayout');
    expect(CODE).not.toContain('useWindowDimensions');
    // The rep is passed THROUGH to the stage and read by nothing here.
    expect(CODE).not.toMatch(/\bstate\.[a-zA-Z]/);
    expect(CODE).not.toMatch(/\bhistory\.[a-zA-Z]/);
  });

  it('draws both layers absoluteFill inside the single frame view, and mounts the real AthleteStage once', () => {
    expect((RAW.match(/testID="athlete-composed-frame"/g) ?? []).length, 'one frame').toBe(1);
    expect((RAW.match(/StyleSheet\.absoluteFill/g) ?? []).length, 'room, room-missing marker, rig').toBe(3);
    expect((RAW.match(/<AthleteStage /g) ?? []).length, 'one stage').toBe(1);
    expect(RAW).toContain("from './AthleteStage'");
    // The frame is positioned by the composition's numbers and nothing else.
    expect(CODE).toMatch(/left: frame\.x, top: frame\.y, width: frame\.width, height: frame\.height/);
    expect(CODE).not.toMatch(/transform:/);
  });

  it('the room comes from roomAsset.ts alone; while it is missing the marker is drawn and no painted scene ever is', () => {
    expect(RAW).toContain("from './roomAsset'");
    expect(RAW).toContain('testID="room-asset-missing"');
    expect(CODE).toMatch(/ROOM_ASSET === null/);
    // Code only: the header NAMES what it refuses (the plates module, the jpgs); the code touches none of it.
    expect(CODE).not.toMatch(/ironAmberPlates|require\(/);
    expect(RAW).not.toMatch(/from '[^']*ironAmberPlates'/);
    expect(RAW).not.toMatch(/iron-amber\/[a-z-]+\.jpg/);
    // NON-VACUITY: the prose does mention the refused module, so the code-only view is what passed.
    expect(RAW).toContain('ironAmberPlates');
  });
});
