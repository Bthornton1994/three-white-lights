/**
 * ironAmberArt.test.ts — the owned-art adapter is a closed URI table, not a
 * loader. It never `require()`s a PNG, never emits a remote URL, never embeds
 * a data URI, and every stem it names exists on disk under public/empire-art.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import { FLOOR_SPRITE_FACINGS, FLOOR_SPRITE_POSES } from './floorSprites';
import {
  IRON_AMBER_ART_STEMS,
  ironAmberArtRoot,
  ironAmberArtUri,
  ironAmberFixedUri,
  ironAmberFloorPlaneUri,
  ironAmberFloorUri,
  ironAmberMemberUri,
  ironAmberPlateTreeUri,
  ironAmberSessionUri,
} from './ironAmberArt';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ART_DIR = path.join(HERE, '..', '..', 'public', 'empire-art');

describe('Iron & Amber owned-art adapter', () => {
  it('serves only root-relative PNG paths under /empire-art/', () => {
    expect(ironAmberArtRoot()).toBe('/empire-art');
    for (const stem of IRON_AMBER_ART_STEMS) {
      const uri = ironAmberArtUri(stem);
      expect(uri.startsWith('/empire-art/')).toBe(true);
      expect(uri.endsWith('.png')).toBe(true);
      expect(uri).not.toMatch(/^https?:/i);
      expect(uri).not.toMatch(/^data:/i);
    }
  });

  it('has every named stem on disk as a real PNG', () => {
    expect(existsSync(ART_DIR)).toBe(true);
    for (const stem of IRON_AMBER_ART_STEMS) {
      const file = path.join(ART_DIR, `${stem}.png`);
      expect(existsSync(file), file).toBe(true);
      const bytes = readFileSync(file);
      expect(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(
        true,
      );
    }
  });

  it('maps every rung, member pose, and baseline furniture onto owned art', () => {
    expect(ironAmberFloorUri('garage')).toBe('/empire-art/floor-garage.png');
    expect(ironAmberFloorUri('storage-unit')).toBe('/empire-art/floor-storage-unit.png');
    expect(ironAmberFloorUri('strip-mall-unit')).toBe('/empire-art/floor-strip-mall-unit.png');
    expect(ironAmberFloorUri('warehouse')).toBe('/empire-art/floor-warehouse.png');
    for (const rung of EMPIRE_TUNING.LADDER_RUNGS) {
      expect(ironAmberFloorUri(rung).startsWith('/empire-art/floor-')).toBe(true);
      expect(ironAmberFloorUri(rung).endsWith('.png')).toBe(true);
    }
    expect(ironAmberFloorPlaneUri()).toBe('/empire-art/floor-plane.png');
    for (const type of EMPIRE_TUNING.MEMBER_TYPES) {
      for (const pose of FLOOR_SPRITE_POSES) {
        for (const facing of FLOOR_SPRITE_FACINGS) {
          const uri = ironAmberMemberUri(type, pose, facing);
          expect(uri.startsWith('/empire-art/member-')).toBe(true);
          expect(uri.endsWith('.png')).toBe(true);
        }
      }
    }
    expect(ironAmberMemberUri('casual', 'stand', 'right')).toBe(
      '/empire-art/member-casual-right.png',
    );
    expect(ironAmberMemberUri('athlete', 'step-a', 'left')).toBe(
      '/empire-art/member-walk-a-left.png',
    );
    expect(ironAmberMemberUri('powerlifter', 'using-bench-b', 'right')).toBe(
      '/empire-art/member-using-bench-b-right.png',
    );
    expect(ironAmberFixedUri('flat-bench', false)).toBe('/empire-art/eq-flat-bench.png');
    expect(ironAmberFixedUri('flat-bench', true)).toBe('/empire-art/eq-quality-bench.png');
    expect(ironAmberFixedUri('power-bar', false)).toBe('/empire-art/eq-power-bar.png');
    expect(ironAmberFixedUri('comp-plates', false)).toBe('/empire-art/eq-comp-plates.png');
    expect(ironAmberPlateTreeUri()).toBe('/empire-art/eq-plate-tree.png');
    expect(ironAmberSessionUri('mats')).toBe('/empire-art/session-mats.png');
    for (const item of EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS) {
      const uri = ironAmberSessionUri(item);
      expect(uri, item).not.toBeNull();
      expect(uri?.startsWith('/empire-art/session-')).toBe(true);
    }
    expect(ironAmberFixedUri('squat-rack', false)).toBeNull();
  });

  it('does not import, require, or embed payloads in its own source', () => {
    const source = readFileSync(path.join(HERE, 'ironAmberArt.ts'), 'utf8');
    expect(source).not.toMatch(/\brequire\s*\(/);
    expect(source).not.toMatch(/\bfrom\s+['"]/);
    expect(source).not.toMatch(/data:image\//);
    expect(source).not.toMatch(/https?:\/\//);
  });
});
