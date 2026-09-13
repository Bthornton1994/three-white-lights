import { describe, expect, it } from 'vitest';

import { IRON_AMBER } from '../game/sessionTuning';
import { MEET_LAYOUT } from '../game/meetTuning';
import { ironAmberHallLayout, ironAmberHallPlateId } from './ironAmberHall';

const PHONE_W = 390;
const PHONE_H = 844;

describe('Iron & Amber meet hall stills', () => {
  it('an empty platform is the gym, never a lifter plate', () => {
    expect(ironAmberHallPlateId('squat', 'SET', true)).toBe('gym-briefing');
    expect(ironAmberHallPlateId(null, null, true)).toBe('gym-briefing');
  });

  it('the step and the unrack are not the settled brace', () => {
    expect(ironAmberHallPlateId('squat', 'STEP', false)).toBe('squat-drive');
    expect(ironAmberHallPlateId('squat', 'UNRACK', false)).toBe('squat-drive');
    expect(ironAmberHallPlateId('squat', 'SET', false)).toBe('squat-brace');
    expect(ironAmberHallPlateId('squat', 'HUSH', false)).toBe('squat-brace');
    expect(ironAmberHallPlateId('bench', 'STEP', false)).toBe('bench-press');
    expect(ironAmberHallPlateId('bench', 'SET', false)).toBe('bench-brace');
    expect(ironAmberHallPlateId('deadlift', 'LOAD', false)).toBe('deadlift-floor');
    expect(ironAmberHallPlateId('deadlift', 'STEP', false)).toBe('deadlift-knee');
    expect(ironAmberHallPlateId('deadlift', 'HUSH', false)).toBe('deadlift-lockout');
  });

  it('a missing pose is the settled still, so deliberation and a no-lift match', () => {
    expect(ironAmberHallPlateId('squat', null, false)).toBe('squat-brace');
    const settled = ironAmberHallLayout(PHONE_W, PHONE_H, 'squat-brace', 0, 0, 0);
    const omitted = ironAmberHallLayout(PHONE_W, PHONE_H, 'squat-brace', 0, 0, 0);
    expect(omitted).toEqual(settled);
  });

  it('crowd rise and a step pan actually move the cover rect', () => {
    const calm = ironAmberHallLayout(PHONE_W, PHONE_H, 'squat-brace', 0, 0, 0);
    const hushRise = MEET_LAYOUT.HALL_WALK_SHIFT;
    const urgent = ironAmberHallLayout(PHONE_W, PHONE_H, 'squat-brace', 0, hushRise, 0);
    const stepped = ironAmberHallLayout(PHONE_W, PHONE_H, 'squat-drive', 2, 0, 0);
    expect(urgent.width).toBeGreaterThan(calm.width);
    expect(stepped.left).not.toBe(calm.left);
  });

  it('cover still fills a phone after a pan', () => {
    const layout = ironAmberHallLayout(PHONE_W, PHONE_H, 'squat-drive', 2, 8, 6);
    expect(layout.width).toBeGreaterThanOrEqual(PHONE_W);
    expect(layout.height).toBeGreaterThanOrEqual(PHONE_H);
    expect(layout.width).toBeLessThan(IRON_AMBER.PLATE_SRC_W * 2);
    expect(layout.left).toBeLessThanOrEqual(0);
    expect(layout.top).toBeLessThanOrEqual(0);
    expect(layout.left + layout.width).toBeGreaterThanOrEqual(PHONE_W);
    expect(layout.top + layout.height).toBeGreaterThanOrEqual(PHONE_H);
  });
});
