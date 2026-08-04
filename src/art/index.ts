/**
 * Lifter sprite system and the environment it stands in — public surface.
 *
 * Everything here is pure TypeScript with no React import. The React files in
 * this folder — `LifterSpriteView.tsx` and `GymSceneView.tsx` — are
 * deliberately NOT re-exported: importing either drags in Skia, and the pure
 * modules must stay importable from a plain node test run.
 */

export * from './palette';
export * from './spriteTuning';
export * from './plates';
export * from './rig';
export * from './raster';
export * from './spriteMarks';
export * from './rgba';
export * from './squatAnimation';
export * from './lifterSprite';

// The gym / environment layer (GDD §12.2 "Gym / environment art").
export * from './gymPalette';
export * from './gymProps';
export * from './gymTuning';
export * from './gymScene';
export * from './gymReadability';
