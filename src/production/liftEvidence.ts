import type { ReadinessCheckIn } from '../game/fatigue';
import type { LiftConfig } from '../game/lift';
import type { LiftKind } from '../game/meet';
/** Inputs recorded around the unchanged native engine. */
export interface LiftEvidence {
  readonly config: LiftConfig;
  readonly events: readonly { readonly tick: number; readonly kind: 'press' | 'release' | 'clear-grip' }[];
  readonly resolvedTick: number;
}
export interface TrainingEvidenceContext { readonly checkIn: ReadinessCheckIn; readonly targetRpe: number }
export interface TrainingLiftEvidence { readonly setIndex: number; readonly repIndex: number; readonly evidence: LiftEvidence }
export interface MeetLiftEvidence { readonly lift: LiftKind; readonly ordinal: 1 | 2 | 3; readonly evidence: LiftEvidence }
export interface LiftEvidencePort {
  setTrainingEvidenceContext(context: TrainingEvidenceContext): void;
  setTrainingLiftEvidence(setIndex: number, repIndex: number, evidence: LiftEvidence): void;
  resetTrainingEvidence(): void;
  setMeetLiftEvidence(lift: LiftKind, ordinal: 1 | 2 | 3, evidence: LiftEvidence): void;
  resetMeetEvidence(): void;
  currentServerDay(): number;
}
