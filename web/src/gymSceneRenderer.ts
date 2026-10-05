import { buildGymSceneFrame, SCENE_TUNING as T, type GymSceneFrame, type GymSceneInput, type SceneCamera, type SceneCommand, type ScenePaint } from '../../src/facility/scene';

export interface GymSceneRenderer {
  draw(input: GymSceneInput, camera: SceneCamera): GymSceneFrame;
  drawFrame(frame: GymSceneFrame): void;
  dispose(): void;
}

function canvasPaint(context: CanvasRenderingContext2D, paint: ScenePaint): string | CanvasGradient {
  if (typeof paint === 'string') return paint;
  const gradient = paint.kind === 'linear-gradient'
    ? context.createLinearGradient(paint.from.x, paint.from.y, paint.to.x, paint.to.y)
    : context.createRadialGradient(paint.center.x, paint.center.y, T.math.zero, paint.center.x, paint.center.y, Math.max(T.math.epsilon, paint.radius));
  for (const stop of paint.stops) gradient.addColorStop(stop.offset, stop.color);
  return gradient;
}

function renderCommand(context: CanvasRenderingContext2D, command: SceneCommand): void {
  context.save();
  context.globalAlpha = command.opacity ?? T.math.one;
  context.lineWidth = command.lineWidth ?? T.lines.minimumPixels;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  if (command.kind === 'text') {
    context.fillStyle = canvasPaint(context, command.fill);
    context.font = `${command.weight ?? '500'} ${command.fontSize}px ${command.fontFamily ?? 'Arial, sans-serif'}`;
    context.textAlign = command.align ?? 'left';
    context.textBaseline = 'middle';
    context.translate(command.position.x, command.position.y);
    context.rotate(command.rotation ?? T.math.zero);
    context.fillText(command.text, T.math.zero, T.math.zero);
    context.restore();
    return;
  }
  context.beginPath();
  if (command.kind === 'ellipse') {
    context.ellipse(command.center.x, command.center.y, Math.max(T.math.zero, command.radiusX), Math.max(T.math.zero, command.radiusY), command.rotation ?? T.math.zero, T.math.zero, T.math.fullTurn);
  } else {
    const first = command.points[T.math.zero];
    if (first !== undefined) {
      context.moveTo(first.x, first.y);
      for (const point of command.points.slice(T.math.one)) context.lineTo(point.x, point.y);
      if (command.kind === 'polygon') context.closePath();
    }
  }
  if (command.kind !== 'line' && command.fill !== undefined) {
    context.fillStyle = canvasPaint(context, command.fill);
    context.fill();
  }
  if (command.stroke !== undefined) {
    context.strokeStyle = canvasPaint(context, command.stroke);
    context.stroke();
  }
  context.restore();
}

export function createGymSceneRenderer(canvas: HTMLCanvasElement): GymSceneRenderer {
  const context = canvas.getContext('2d', { alpha: true });
  if (context === null) throw new Error('The gym scene needs a Canvas 2D context.');
  let disposed = false;
  function drawFrame(frame: GymSceneFrame): void {
    if (disposed) return;
    const ratio = Math.min(T.renderer.maximumPixelRatio, Math.max(T.renderer.baselinePixelRatio, globalThis.devicePixelRatio ?? T.renderer.baselinePixelRatio));
    const width = Math.round(frame.camera.viewport.width * ratio);
    const height = Math.round(frame.camera.viewport.height * ratio);
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    canvas.style.width = `${frame.camera.viewport.width}px`;
    canvas.style.height = `${frame.camera.viewport.height}px`;
    context!.setTransform(ratio, T.math.zero, T.math.zero, ratio, T.math.zero, T.math.zero);
    context!.clearRect(T.math.zero, T.math.zero, frame.camera.viewport.width, frame.camera.viewport.height);
    for (const command of frame.commands) renderCommand(context!, command);
  }
  return {
    draw(input, camera) { const frame = buildGymSceneFrame(input, camera); drawFrame(frame); return frame; },
    drawFrame,
    dispose() { disposed = true; context.clearRect(T.math.zero, T.math.zero, canvas.width, canvas.height); },
  };
}
