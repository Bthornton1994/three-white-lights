import type { GridPosition, GridSize } from '../floor';
import type { FloorSimContext, FloorSimState, FloorSimMemberState } from '../floorSim';
import type { ManagedEquipmentItem, ManagedGym } from '../management';

export interface ScenePoint { readonly x: number; readonly y: number }
export interface WorldPoint extends ScenePoint { readonly z?: number }
export type SceneRotation = 0 | 90 | 180 | 270;
export interface SceneGradientStop { readonly offset: number; readonly color: string }
export type ScenePaint = string | {
  readonly kind: 'linear-gradient'; readonly from: ScenePoint; readonly to: ScenePoint;
  readonly stops: readonly SceneGradientStop[];
} | {
  readonly kind: 'radial-gradient'; readonly center: ScenePoint; readonly radius: number;
  readonly stops: readonly SceneGradientStop[];
};
interface CommandStyle { readonly opacity?: number; readonly lineWidth?: number }
export type SceneCommand =
  | (CommandStyle & { readonly kind: 'polygon'; readonly points: readonly ScenePoint[]; readonly fill?: ScenePaint; readonly stroke?: ScenePaint })
  | (CommandStyle & { readonly kind: 'line'; readonly points: readonly ScenePoint[]; readonly stroke: ScenePaint })
  | (CommandStyle & { readonly kind: 'ellipse'; readonly center: ScenePoint; readonly radiusX: number; readonly radiusY: number; readonly rotation?: number; readonly fill?: ScenePaint; readonly stroke?: ScenePaint })
  | (CommandStyle & { readonly kind: 'text'; readonly position: ScenePoint; readonly text: string; readonly fontSize: number; readonly fill: ScenePaint; readonly fontFamily?: string; readonly weight?: string; readonly align?: 'left' | 'center' | 'right'; readonly rotation?: number });
export interface SceneCamera {
  readonly grid: GridSize; readonly viewport: GridSize; readonly scale: number;
  readonly origin: ScenePoint; readonly floorSlope: number; readonly verticalScale: number;
  readonly focus: ScenePoint; readonly zoom: number; readonly pan: ScenePoint;
}
export interface SceneCameraOptions { readonly zoom?: number; readonly pan?: ScenePoint; readonly focus?: ScenePoint; readonly fitAll?: boolean }
export interface SceneEntity {
  readonly id: string; readonly kind: 'equipment' | 'member' | 'staff' | 'preview';
  readonly item?: ManagedEquipmentItem; readonly memberId?: string; readonly activity?: FloorSimMemberState;
  readonly position: ScenePoint; readonly footprint?: GridSize; readonly rotation?: SceneRotation;
  readonly hitPolygon: readonly ScenePoint[]; readonly depth: number;
  readonly label: string; readonly source?: 'primary' | 'expansion';
}
export interface SceneActivityCounts {
  readonly training: number; readonly waiting: number; readonly walking: number;
  readonly leaving: number; readonly interrupted: number; readonly stranded: number;
  readonly staff: number; readonly total: number;
}
export interface ScenePreview {
  readonly item: ManagedEquipmentItem; readonly position: GridPosition; readonly footprint: GridSize;
  readonly rotation?: SceneRotation; readonly valid: boolean;
}
export interface GymSceneInput {
  readonly context: FloorSimContext; readonly sim: FloorSimState; readonly managed?: ManagedGym;
  readonly elapsedSeconds: number; readonly tickAlpha?: number; readonly selected?: string | null;
  readonly preview?: ScenePreview | null; readonly build?: boolean; readonly reducedMotion?: boolean;
}
export interface GymSceneFrame {
  readonly commands: readonly SceneCommand[]; readonly entities: readonly SceneEntity[];
  readonly counts: SceneActivityCounts; readonly camera: SceneCamera; readonly tick: number;
}
export interface ScenePrimitive { readonly command: SceneCommand; readonly depth: number; readonly order: number }
export interface EquipmentInstance {
  readonly item: ManagedEquipmentItem; readonly position: GridPosition; readonly footprint: GridSize;
  readonly rotation: SceneRotation; readonly source?: 'primary' | 'expansion'; readonly condition?: number;
}
