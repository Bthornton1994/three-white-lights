/**
 * Lifter sprite system — public surface.
 *
 * Everything here is pure TypeScript with no React import. The only React file
 * in this folder is `LifterSpriteView.tsx`, which is deliberately NOT
 * re-exported: importing it drags in Skia, and the pure modules must stay
 * importable from a plain node test run.
 */

export * from './palette';
export * from './spriteTuning';
export * from './plates';
export * from './rig';
export * from './raster';
export * from './rgba';
export * from './squatAnimation';
export * from './lifterSprite';
