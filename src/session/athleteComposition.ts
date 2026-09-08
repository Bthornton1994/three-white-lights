/**
 * athleteComposition — where the room plate, the rig canvas and the HUD go on
 * a phone. Pure geometry: a function of the viewport and the HUD insets and
 * NOTHING else — not the rep, not the tick, not the bar — so the camera
 * cannot drift with play and two frames of one rep are composed identically.
 *
 * ONE RECT. The room plate and the rig canvas are the same 1152 × 1728 canvas
 * (`ATHLETE_RIG.CANVAS_PX`; the handoff's artboard is the plate's size so
 * the rig composites 1:1), so they are placed by ONE `frame` and scaled by
 * ONE `scale`. There is no second rect to stretch independently, by type.
 *
 * THE FIT RULE. The canvas span that must stay visible runs from the crown
 * at lockout minus headroom to the floor line plus footroom
 * (`ATHLETE_COMPOSITION`). The scale is chosen so that span fills the band
 * between the HUD insets exactly — the floor line lands a fixed footroom
 * above the bottom HUD on every phone, which is the floor alignment the
 * source package asks for. At that scale the canvas is wider than a portrait
 * phone, so the room bleeds off both sides symmetrically (`fit: 'cover'`);
 * on a viewport wide enough that it does not, the frame is centred with the
 * backdrop showing at the sides (`fit: 'contain'`) rather than stretched.
 * Everything under the HUD insets is canvas the artist drew for that purpose
 * (rack top above, plates and floor below); `underHud` reports how much.
 */
import { ATHLETE_COMPOSITION, ATHLETE_RIG } from '../art/spriteTuning';

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export interface HudInsets {
  /** Viewport px reserved for the HUD above the stage. */
  readonly top: number;
  /** Viewport px reserved for the HUD below the stage. */
  readonly bottom: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type FitMode = 'cover' | 'contain';

export interface AthleteComposition {
  readonly viewport: Viewport;
  readonly hud: HudInsets;
  /** THE rect: the room plate and the rig canvas are both drawn into exactly this, viewport px. */
  readonly frame: Rect;
  /** Viewport px per canvas px. One number for both axes. */
  readonly scale: number;
  readonly fit: FitMode;
  /** The band between the HUD insets, viewport px. */
  readonly band: { readonly top: number; readonly bottom: number };
  /** Canvas lines, in viewport px. */
  readonly floorY: number;
  readonly crownY: number;
  readonly lockoutBarY: number;
  readonly holeBarY: number;
  /** Canvas px that fall outside the viewport on each edge (0 where the viewport is wider). */
  readonly cropped: { readonly top: number; readonly bottom: number; readonly left: number; readonly right: number };
  /** Canvas px that sit beneath the HUD insets — drawn, but under chrome. */
  readonly underHud: { readonly top: number; readonly bottom: number };
}

export const DEFAULT_HUD_INSETS: HudInsets = Object.freeze({
  top: ATHLETE_COMPOSITION.HUD_TOP_PX,
  bottom: ATHLETE_COMPOSITION.HUD_BOTTOM_PX,
});

/** The canvas span that must stay visible between the HUD insets, canvas px. */
export function requiredSpan(): { readonly top: number; readonly bottom: number } {
  return {
    top: ATHLETE_COMPOSITION.CROWN_Y - ATHLETE_COMPOSITION.HEADROOM_PX,
    bottom: ATHLETE_COMPOSITION.FLOOR_Y + ATHLETE_COMPOSITION.FOOTROOM_PX,
  };
}

export function composeAthleteStage(viewport: Viewport, hud: HudInsets = DEFAULT_HUD_INSETS): AthleteComposition {
  const W = ATHLETE_RIG.CANVAS_PX.WIDTH;
  const H = ATHLETE_RIG.CANVAS_PX.HEIGHT;
  if (!(viewport.width > 0) || !(viewport.height > 0)) {
    throw new RangeError(`viewport must be positive, got ${viewport.width} x ${viewport.height}`);
  }
  if (!(hud.top >= 0) || !(hud.bottom >= 0)) {
    throw new RangeError(`HUD insets must be non-negative, got ${hud.top} / ${hud.bottom}`);
  }
  const band = { top: hud.top, bottom: viewport.height - hud.bottom };
  const bandHeight = band.bottom - band.top;
  if (!(bandHeight > 0)) {
    throw new RangeError(`the HUD leaves no band: ${viewport.height} - ${hud.top} - ${hud.bottom}`);
  }

  const span = requiredSpan();
  const scale = bandHeight / (span.bottom - span.top);
  const width = W * scale;
  const height = H * scale;
  const x = (viewport.width - width) / 2;
  const y = band.top - span.top * scale;
  const fit: FitMode = width >= viewport.width ? 'cover' : 'contain';

  const toViewport = (canvasY: number): number => y + canvasY * scale;
  return {
    viewport,
    hud,
    frame: { x, y, width, height },
    scale,
    fit,
    band,
    floorY: toViewport(ATHLETE_COMPOSITION.FLOOR_Y),
    crownY: toViewport(ATHLETE_COMPOSITION.CROWN_Y),
    lockoutBarY: toViewport(ATHLETE_COMPOSITION.LOCKOUT_BAR_Y),
    holeBarY: toViewport(ATHLETE_COMPOSITION.HOLE_BAR_Y),
    cropped: {
      top: Math.max(0, -y / scale),
      bottom: Math.max(0, (y + height - viewport.height) / scale),
      left: Math.max(0, -x / scale),
      right: Math.max(0, (x + width - viewport.width) / scale),
    },
    underHud: {
      top: Math.max(0, Math.min(H, (band.top - y) / scale)),
      bottom: Math.max(0, Math.min(H, (y + height - band.bottom) / scale)),
    },
  };
}
