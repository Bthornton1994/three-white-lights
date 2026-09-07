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
    expect(stage).toContain('grindReadout');
    expect(stage).toContain('testID="iron-amber-stage"');
  });

  it('SetView overlays HUD on the plate instead of stacking a debug header above it', () => {
    const setView = source('SetView.tsx');
    expect(setView).toContain('styles.hudScrim');
    expect(setView).toContain('styles.hud');
    expect(setView).toContain('pointerEvents="none"');
    expect(setView).not.toContain('styles.header');
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
    expect(briefing).not.toContain('session-check-in');
  });
});
