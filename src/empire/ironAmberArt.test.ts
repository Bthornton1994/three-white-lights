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
  ironAmberMemberMotionUri,
  ironAmberMemberUri,
  ironAmberPlateTreeUri,
  ironAmberSessionUri,
} from './ironAmberArt';
import { MEMBER_MOTION_CLIPS, MEMBER_MOTION_CLIP_SPECS, MEMBER_MOTION_PRODUCTION_TYPES, memberMotionStripStem } from './memberMotionClips';

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

  it('VL-2: the scene paintings are FLOOR_SCENE_ART_ASPECT on disk, and every fixed painting has its registered aspect', () => {
    // The camera reproduces GymScreen's `cover` fit from these numbers, so
    // a re-exported painting of another size would mis-place the floor
    // silently without this. Read off each PNG's IHDR, never trusted.
    const sizeOf = (stem: string): { readonly width: number; readonly height: number } => {
      const bytes = readFileSync(path.join(ART_DIR, `${stem}.png`));
      return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    };
    let scenes = 0;
    for (const rung of Object.keys(EMPIRE_TUNING.FLOOR_SCENE_FLOOR_SEAM_FRACTION)) {
      const size = sizeOf(ironAmberFloorUri(rung).replace('/empire-art/', '').replace('.png', ''));
      expect(size).toEqual(EMPIRE_TUNING.FLOOR_SCENE_ART_ASPECT);
      scenes += 1;
    }
    expect(scenes).toBe(EMPIRE_TUNING.LADDER_RUNGS.length);
    const stemFor: Readonly<Record<keyof typeof EMPIRE_TUNING.FLOOR_FIXED_ART_HEIGHT_OVER_WIDTH, string>> = {
      'flat-bench': 'eq-flat-bench',
      'quality-bench': 'eq-quality-bench',
      'power-bar': 'eq-power-bar',
      'comp-plates': 'eq-comp-plates',
      'plate-tree': 'eq-plate-tree',
    };
    let aspects = 0;
    for (const [key, registered] of Object.entries(EMPIRE_TUNING.FLOOR_FIXED_ART_HEIGHT_OVER_WIDTH)) {
      const stem = stemFor[key as keyof typeof stemFor];
      expect(IRON_AMBER_ART_STEMS).toContain(stem);
      const size = sizeOf(stem);
      const actual = size.height / size.width;
      // Within three percent: the knob is a drawn proportion, and the
      // paintings' sizes are not round.
      expect(Math.abs(actual - registered) / actual, `${key}: ${actual.toFixed(3)} on disk`).toBeLessThan(0.03);
      aspects += 1;
    }
    expect(aspects).toBe(Object.keys(stemFor).length);
  });

  it('VL-3: serves one strip per production type per clip, named by memberMotionStripStem, each on disk at frames × canvas', () => {
    let strips = 0;
    for (const type of MEMBER_MOTION_PRODUCTION_TYPES) {
      for (const clip of MEMBER_MOTION_CLIPS) {
        const stem = memberMotionStripStem(type, clip);
        expect(ironAmberMemberMotionUri(type, clip)).toBe(`/empire-art/${stem}.png`);
        expect(IRON_AMBER_ART_STEMS).toContain(stem);
        const bytes = readFileSync(path.join(ART_DIR, `${stem}.png`));
        expect(bytes.readUInt32BE(16), `${stem} width`).toBe(
          MEMBER_MOTION_CLIP_SPECS[clip].frames * EMPIRE_TUNING.FLOOR_MEMBER_MOTION_CANVAS_PX,
        );
        expect(bytes.readUInt32BE(20), `${stem} height`).toBe(EMPIRE_TUNING.FLOOR_MEMBER_MOTION_CANVAS_PX);
        strips += 1;
      }
    }
    // Ten since art round 2: the bench is setup, mount, press, dismount, finish.
    expect(strips).toBe(10);
    expect(ironAmberMemberMotionUri('powerlifter', 'walk')).toBe('/empire-art/member-motion-powerlifter-walk.png');
    expect(ironAmberMemberMotionUri('powerlifter', 'bench-mount')).toBe('/empire-art/member-motion-powerlifter-bench-mount.png');
  });

  it('does not import, require, or embed payloads in its own source — its one import is the sibling clip table', () => {
    const source = readFileSync(path.join(HERE, 'ironAmberArt.ts'), 'utf8');
    expect(source).not.toMatch(/\brequire\s*\(/);
    const imports = [...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(imports).toEqual(['./memberMotionClips']);
    expect(source).not.toMatch(/data:image\//);
    expect(source).not.toMatch(/https?:\/\//);
    expect(source).not.toMatch(/\.png['"]\s*\)/);
  });
});
