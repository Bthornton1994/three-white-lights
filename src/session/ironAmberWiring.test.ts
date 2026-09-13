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
    expect(stage).toContain('meetAttemptPlateId');
    expect(stage).toContain('meet-squat-brace.jpg');
    expect(stage).toContain('meet-squat-brace-third.jpg');
    expect(stage).toContain('attemptNumber');
    expect(stage).toContain('ironAmberPlateLayout');
    expect(stage).toContain('crowdRisePx');
    expect(stage).toContain('testID={`iron-amber-plate-${plateId}`}');
    expect(stage).not.toContain('makeSpriteImage');
    expect(stage).not.toContain('GymSceneLayer');
    expect(stage).not.toContain('renderGymScene');
    expect(stage).not.toContain('TRACE_X');
    expect(stage).not.toContain('grindReadout');
    expect(stage).toContain('testID="iron-amber-stage"');
  });

  it('Meet Day hall mounts packed-platform stills, not the training garage', () => {
    const attempt = source('../meet/AttemptView.tsx');
    expect(attempt).toContain("from '../session/TrainingLiftStage'");
    expect(attempt).not.toContain("from '../lift/LiftStage'");
    expect(attempt).toContain('<LiftStage');
    expect(attempt).toContain('venue={MEET_TUNING.VENUE}');
    expect(attempt).toContain('attemptNumber={live.attemptNumber}');
    const hall = source('../meet/MeetHallView.tsx');
    expect(hall).toContain('meet-empty.jpg');
    expect(hall).toContain('meet-squat-brace.jpg');
    expect(hall).toContain('meet-squat-brace-third.jpg');
    expect(hall).toContain('meet-squat-unrack.jpg');
    expect(hall).toContain('meet-squat-unrack-third.jpg');
    expect(hall).toContain('meet-squat-walk-third.jpg');
    expect(hall).toContain('lifter?.attemptNumber');
    expect(hall).not.toContain("from '../../assets/iron-amber/gym-briefing.jpg'");
    expect(hall).not.toContain("from '../../assets/iron-amber/squat-brace.jpg'");
    expect(hall).toContain('ironAmberHallPlateId');
    expect(hall).not.toContain('makeSpriteImage');
    expect(hall).not.toContain('GymSceneLayer');
  });

  it('Check-in stays on the GDD §3.2 path, with the gym as the room', () => {
    const checkIn = source('CheckInView.tsx');
    expect(checkIn).toContain('testID="session-check-in"');
    expect(checkIn).toContain('iron-amber-check-in-gym');
    expect(checkIn).toContain('IronAmberRoom');
    expect(checkIn).toContain('testID={`check-in-${row.question}-${option.value}`}');
    expect(checkIn).toContain('CHECK_IN_LABEL_COL');
    expect(checkIn).toContain('flexDirection: \'row\'');
    expect(checkIn).toContain('check-in-disclosures');
    const screen = source('SessionScreen.tsx');
    expect(screen).toContain('<CheckInView');
    expect(screen).toContain("state.phase === 'check-in'");
  });

  it('BriefingView loads the day’s lifter plate and a gold RPE 8 chip', () => {
    const briefing = source('BriefingView.tsx');
    expect(briefing).toContain('gymTestID="iron-amber-briefing-gym"');
    expect(briefing).toContain('liftKind={lift}');
    expect(briefing).toContain('testID="session-briefing"');
    expect(briefing).toContain('testID="session-rpe-ladder"');
    expect(briefing).toContain('SESSION_PALETTE.AMBER');
    expect(briefing).toContain('RPE_SUGGESTED_EDGE');
    expect(briefing).toContain('AMBER_INK');
    expect(briefing).toContain('RPE_CHIP_FONT');
    expect(briefing).not.toContain('START BENCH');
    expect(briefing).not.toContain('session-check-in');
    const room = source('IronAmberRoom.tsx');
    expect(room).toContain('ironAmberBriefingPlate');
    expect(room).toContain('ironAmberPlateLayout');
    expect(room).toContain("from '../../assets/iron-amber/squat-brace.jpg'");
    expect(room).toContain('CARD_PAD_DRAWER');
    expect(source('CheckInView.tsx')).toContain('liftKind={lift}');
    expect(source('CheckInView.tsx')).toContain('<IronAmberCard dense');
    expect(source('CloseOutView.tsx')).toContain('liftKind={closeOut.lift}');
    expect(source('CloseOutView.tsx')).toContain('<IronAmberCard dense');
    expect(source('CloseOutView.tsx')).toContain('DRAWER_NUMBER_FONT');
    expect(source('CloseOutView.tsx')).toContain('styles.strip');
    expect(source('RestView.tsx')).not.toContain('liftKind');
    expect(source('SessionScreen.tsx')).not.toContain('liftKind');
  });

  it('the gym room docks the card above the shell pill band', () => {
    const room = source('IronAmberRoom.tsx');
    expect(room).toContain('ROOM_FOOT_CLEARANCE');
    expect(room).toContain('ROOM_BRAND_PAD_TOP');
    expect(room).toContain('justifyContent: \'flex-end\'');
    expect(room).toContain('ScrollView');
    expect(room).toContain('ironAmberGymLayout');
  });

  it('Create Lifter sits in the gym room, not on a blank espresso field', () => {
    const lifter = source('../meet/LifterScreen.tsx');
    expect(lifter).toContain('iron-amber-create-gym');
    expect(lifter).toContain('ironAmberGymLayout');
    expect(lifter).toContain('from \'../../assets/iron-amber/gym-briefing.jpg\'');
  });

  it('rest, close-out and already-trained still use the gym as the room', () => {
    expect(source('RestView.tsx')).toContain('iron-amber-rest-gym');
    expect(source('CloseOutView.tsx')).toContain('iron-amber-close-out-gym');
    expect(source('SessionScreen.tsx')).toContain('iron-amber-trained-gym');
  });
});
