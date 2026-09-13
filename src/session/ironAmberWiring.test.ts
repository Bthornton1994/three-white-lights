import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function source(file: string): string {
  return readFileSync(path.join(HERE, file), 'utf8');
}

describe('Iron & Amber training path wiring', () => {
  it('SetView mounts the training plates, not the sprite LiftStage module', () => {
    const setView = source('SetView.tsx');
    expect(setView).toContain("from './TrainingLiftStage'");
    expect(setView).not.toContain("from '../lift/LiftStage'");
    expect(setView).toContain('<LiftStage');
    expect(setView).not.toContain('makeSpriteImage');
    expect(setView).not.toContain('GymSceneLayer');
  });

  it('TrainingLiftStage loads owned plates and does not raster the sprite gym', () => {
    const stage = source('TrainingLiftStage.tsx');
    expect(stage).toContain("from '../../assets/iron-amber/deadlift-floor.jpg'");
    expect(stage).toContain("from '../../assets/iron-amber/squat-brace.jpg'");
    expect(stage).toContain("from '../../assets/iron-amber/bench-brace.jpg'");
    expect(stage).toContain('ironAmberPlateFor');
    expect(stage).toContain('testID={`iron-amber-plate-${plateId}`}');
    expect(stage).not.toContain('makeSpriteImage');
    expect(stage).not.toContain('GymSceneLayer');
    expect(stage).not.toContain('renderGymScene');
    expect(stage).not.toContain('TRACE_X');
    expect(stage).not.toContain('grindReadout');
    expect(stage).toContain('testID="iron-amber-stage"');
  });

  it('Meet Day still draws the sprite LiftStage, not the training plates', () => {
    const attempt = source('../meet/AttemptView.tsx');
    expect(attempt).toContain("from '../lift/LiftStage'");
    expect(attempt).not.toContain('TrainingLiftStage');
    expect(attempt).not.toContain('iron-amber');
  });

  it('Check-in stays on the GDD §3.2 path, with the gym as the room', () => {
    const checkIn = source('CheckInView.tsx');
    expect(checkIn).toContain('testID="session-check-in"');
    expect(checkIn).toContain('iron-amber-check-in-gym');
    expect(checkIn).toContain('IronAmberRoom');
    expect(checkIn).toContain('testID={`check-in-${row.question}-${option.value}`}');
    const screen = source('SessionScreen.tsx');
    expect(screen).toContain('<CheckInView');
    expect(screen).toContain("state.phase === 'check-in'");
  });

  it('BriefingView loads the gym plate behind the readiness card', () => {
    const briefing = source('BriefingView.tsx');
    expect(briefing).toContain('gymTestID="iron-amber-briefing-gym"');
    expect(briefing).toContain('testID="session-briefing"');
    expect(briefing).toContain('testID="session-rpe-ladder"');
    expect(briefing).not.toContain('session-check-in');
  });

  it('the gym room docks the card above the shell pill band', () => {
    const room = source('IronAmberRoom.tsx');
    expect(room).toContain('ROOM_FOOT_CLEARANCE');
    expect(room).toContain('ROOM_BRAND_PAD_TOP');
    expect(room).toContain('justifyContent: \'flex-end\'');
    expect(room).toContain('ScrollView');
  });

  it('rest, close-out and already-trained still use the gym as the room', () => {
    expect(source('RestView.tsx')).toContain('iron-amber-rest-gym');
    expect(source('CloseOutView.tsx')).toContain('iron-amber-close-out-gym');
    expect(source('SessionScreen.tsx')).toContain('iron-amber-trained-gym');
  });
});
