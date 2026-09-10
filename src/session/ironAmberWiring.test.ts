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

  it('TrainingLiftStage mounts the continuous squat scene, not squat JPEGs', () => {
    const stage = source('TrainingLiftStage.tsx');
    // Schematic arm still draws SquatScene; athlete arm is gated and fail-closed.
    // Kind routing lives in selectTrainingStageArm (kind passed as props.state.config.kind).
    expect(stage).toContain("from './SquatScene'");
    expect(stage).toContain("from './trainingStageSelect'");
    expect(stage).toContain('selectTrainingStageArm');
    expect(stage).toContain("case 'schematic'");
    expect(stage).toContain('<SquatScene');
    expect(stage).not.toContain("from '../../assets/iron-amber/squat-brace.jpg'");
    expect(stage).not.toContain('makeSpriteImage');
    expect(stage).not.toContain('GymSceneLayer');
    expect(stage).not.toContain('TRACE_X');
    expect(stage).toContain('testID="iron-amber-stage"');
  });

  it('SquatScene is a persistent Skia rig driven by squatPoseFrom', () => {
    const scene = source('SquatScene.tsx');
    expect(scene).toContain('squatPoseFrom');
    expect(scene).toContain('testID="squat-scene"');
    expect(scene).not.toContain('ironAmberPlateFor');
    expect(scene).not.toContain('.jpg');
    expect(scene).not.toContain('cueRing');
    expect(scene).not.toContain('TRACE_X');
  });

  it('SetView overlays HUD on the plate instead of stacking a debug header above it', () => {
    const setView = source('SetView.tsx');
    expect(setView).toContain('styles.hudScrim');
    expect(setView).toContain('styles.hud');
    expect(setView).toContain('pointerEvents="none"');
    expect(setView).toContain('styles.command');
    expect(setView).toContain('styles.commandScrim');
    expect(setView).not.toContain('styles.header');
  });

  it('SessionScreen does not mount the check-in questionnaire on the played path', () => {
    const screen = source('SessionScreen.tsx');
    expect(screen).not.toContain('CheckInView');
    expect(screen).not.toContain('session-check-in');
    expect(screen).toContain('onChooseLift={chooseLift}');
  });

  it('CloseOutView uses the gym plate behind the payoff card', () => {
    const closeOut = source('CloseOutView.tsx');
    expect(closeOut).toContain("from '../../assets/iron-amber/gym-briefing.jpg'");
    expect(closeOut).toContain('testID="iron-amber-close-out-gym"');
    expect(closeOut).toContain('testID="session-close-out"');
    expect(closeOut).toContain('testID="close-out-action"');
  });

  it('Meet Day still draws the sprite LiftStage, not the training plates', () => {
    const attempt = source('../meet/AttemptView.tsx');
    expect(attempt).toContain("from '../lift/LiftStage'");
    expect(attempt).not.toContain('TrainingLiftStage');
    expect(attempt).not.toContain('iron-amber');
  });

  it('BriefingView loads the gym plate behind the readiness card', () => {
    const briefing = source('BriefingView.tsx');
    expect(briefing).toContain("from '../../assets/iron-amber/gym-briefing.jpg'");
    expect(briefing).toContain('testID="iron-amber-briefing-gym"');
    expect(briefing).toContain('testID="session-briefing"');
    expect(briefing).toContain('testID="session-rpe-ladder"');
    expect(briefing).toContain('briefing-lift-');
    expect(briefing).not.toContain('session-check-in');
    expect(briefing).not.toContain('check-in-lift');
  });
});
