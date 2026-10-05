import { projectWorld } from './camera';
import { SCENE_TUNING as T } from './sceneTuning';
import { SCENE_PALETTE as P } from './scenePalette';
import type { SceneCamera, SceneCommand, ScenePaint, ScenePoint, ScenePrimitive, WorldPoint, SceneRotation } from './types';

export interface SceneMaterial { readonly top: string; readonly front: string; readonly side: string; readonly edge: string }
export interface ScenePainter { readonly camera: SceneCamera; readonly primitives: ScenePrimitive[]; order: number }
export type WorldTransform = (point: WorldPoint) => WorldPoint;

export function createScenePainter(camera: SceneCamera): ScenePainter { return { camera, primitives: [], order: T.math.zero }; }
export function worldDepth(point: WorldPoint): number { return point.x + point.y + (point.z ?? T.math.zero) * T.light.ambientDepth; }
export function addCommand(painter: ScenePainter, command: SceneCommand, depth: number): void {
  painter.primitives.push({ command, depth, order: painter.order }); painter.order += T.math.one;
}
export function gradient(from: ScenePoint, to: ScenePoint, light: string, middle: string, dark: string): ScenePaint {
  return { kind: 'linear-gradient', from, to, stops: [{offset: T.math.zero, color: light}, {offset: T.math.half, color: middle}, {offset: T.math.one, color: dark}] };
}
export function worldPolygon(painter: ScenePainter, points: readonly WorldPoint[], fill: ScenePaint, stroke?: ScenePaint, lineWidth: number = T.lines.fine, opacity: number = T.math.one, depth?: number): void {
  const mean = points.reduce<number>((sum, point) => sum + worldDepth(point), T.math.zero) / Math.max(T.math.one, points.length);
  addCommand(painter, {kind: 'polygon', points: points.map(point => projectWorld(painter.camera, point)), fill, stroke, lineWidth: lineWidth * painter.camera.scale, opacity}, depth ?? mean);
}
export function worldLine(painter: ScenePainter, points: readonly WorldPoint[], stroke: ScenePaint, width: number, opacity: number = T.math.one, depth?: number): void {
  const mean = points.reduce<number>((sum, point) => sum + worldDepth(point), T.math.zero) / Math.max(T.math.one, points.length);
  addCommand(painter, {kind: 'line', points: points.map(point => projectWorld(painter.camera, point)), stroke, lineWidth: Math.max(T.lines.minimumPixels, width * painter.camera.scale), opacity}, depth ?? mean);
}
export function sphere(painter: ScenePainter, center: WorldPoint, radius: number, fill: ScenePaint, depth?: number, ratio: number = T.math.one, opacity: number = T.math.one): void {
  addCommand(painter, {kind:'ellipse',center:projectWorld(painter.camera,center),radiusX:radius*painter.camera.scale,radiusY:radius*painter.camera.scale*ratio,fill,opacity},depth ?? worldDepth(center));
}
export function ellipseOnFloor(painter: ScenePainter, center: WorldPoint, radiusX: number, radiusY: number, fill: ScenePaint, opacity: number = T.math.one, depth?: number): void {
  const points: WorldPoint[] = [];
  for (let index=T.math.zero;index<T.math.circleSteps;index+=T.math.one) {
    const angle=index/T.math.circleSteps*T.math.fullTurn;
    points.push({x:center.x+Math.cos(angle)*radiusX,y:center.y+Math.sin(angle)*radiusY,z:center.z});
  }
  worldPolygon(painter,points,fill,undefined,T.math.zero,opacity,depth);
}
export function box(painter: ScenePainter, origin: WorldPoint, width: number, depth: number, height: number, material: SceneMaterial, transform: WorldTransform = identityTransform): void {
  const z=origin.z??T.math.zero;
  const corners=[{x:origin.x,y:origin.y,z},{x:origin.x+width,y:origin.y,z},{x:origin.x+width,y:origin.y+depth,z},{x:origin.x,y:origin.y+depth,z}].map(transform);
  const minX=Math.min(...corners.map(point=>point.x)); const maxX=Math.max(...corners.map(point=>point.x));
  const minY=Math.min(...corners.map(point=>point.y)); const maxY=Math.max(...corners.map(point=>point.y));
  const topZ=z+height;
  const faceA=[{x:minX,y:maxY,z},{x:maxX,y:maxY,z},{x:maxX,y:maxY,z:topZ},{x:minX,y:maxY,z:topZ}];
  const faceB=[{x:maxX,y:minY,z},{x:maxX,y:maxY,z},{x:maxX,y:maxY,z:topZ},{x:maxX,y:minY,z:topZ}];
  const top=[{x:minX,y:minY,z:topZ},{x:maxX,y:minY,z:topZ},{x:maxX,y:maxY,z:topZ},{x:minX,y:maxY,z:topZ}];
  worldPolygon(painter,faceA,gradient(projectWorld(painter.camera,faceA[T.math.three]!),projectWorld(painter.camera,faceA[T.math.zero]!),material.front,material.front,material.edge),material.edge);
  worldPolygon(painter,faceB,gradient(projectWorld(painter.camera,faceB[T.math.three]!),projectWorld(painter.camera,faceB[T.math.one]!),material.side,material.side,material.edge),material.edge);
  worldPolygon(painter,top,gradient(projectWorld(painter.camera,top[T.math.zero]!),projectWorld(painter.camera,top[T.math.two]!),material.top,material.top,material.side),material.edge);
  worldLine(painter,[top[T.math.zero]!,top[T.math.one]!,top[T.math.two]!],material.top,T.lines.fine,T.light.highlightOpacity);
}
export function identityTransform(point: WorldPoint): WorldPoint { return point; }
export function equipmentTransform(position: ScenePoint, width: number, height: number, rotation: SceneRotation): WorldTransform {
  return point => {
    if(rotation===T.math.zero)return{x:position.x+point.x,y:position.y+point.y,z:point.z};
    if(rotation===T.math.quarterTurn/T.math.degreesToRadians)return{x:position.x+height-point.y,y:position.y+point.x,z:point.z};
    if(rotation===T.math.halfTurn/T.math.degreesToRadians)return{x:position.x+width-point.x,y:position.y+height-point.y,z:point.z};
    return{x:position.x+point.y,y:position.y+width-point.x,z:point.z};
  };
}
export function tube(painter: ScenePainter, from: WorldPoint, to: WorldPoint, width: number, dark: string, light: string, transform: WorldTransform = identityTransform, depth?: number): void {
  const a=transform(from);const b=transform(to);const screenA=projectWorld(painter.camera,a);const screenB=projectWorld(painter.camera,b);
  worldLine(painter,[a,b],gradient(screenA,screenB,light,dark,dark),width,T.math.one,depth);
  const highlight={x:-T.materials.steelHighlightInset,y:-T.materials.steelHighlightInset,z:T.materials.steelHighlightInset};
  worldLine(painter,[{x:a.x+highlight.x,y:a.y+highlight.y,z:(a.z??T.math.zero)+highlight.z},{x:b.x+highlight.x,y:b.y+highlight.y,z:(b.z??T.math.zero)+highlight.z}],light,T.lines.fine,T.light.highlightOpacity,depth);
}
export function circlePlane(painter: ScenePainter, center: WorldPoint, radius: number, axis: 'x'|'y'|'z', fill: ScenePaint, stroke?: ScenePaint, width: number=T.lines.fine, transform: WorldTransform=identityTransform, depth?:number): void {
  const points:WorldPoint[]=[];
  for(let index=T.math.zero;index<T.math.circleSteps;index+=T.math.one){
    const angle=index/T.math.circleSteps*T.math.fullTurn;const a=Math.cos(angle)*radius;const b=Math.sin(angle)*radius;
    points.push(transform({x:center.x+(axis==='x'?T.math.zero:a),y:center.y+(axis==='x'?a:axis==='y'?T.math.zero:b),z:(center.z??T.math.zero)+(axis==='z'?T.math.zero:b)}));
  }
  worldPolygon(painter,points,fill,stroke,width,T.math.one,depth);
}
export function roundedPanel(painter:ScenePainter,position:WorldPoint,width:number,height:number,radius:number,material:SceneMaterial,transform:WorldTransform=identityTransform):void{
  const points:WorldPoint[]=[];
  for(let corner=T.math.zero;corner<T.math.four;corner+=T.math.one){
    const cx=position.x+(corner===T.math.zero||corner===T.math.three?radius:width-radius);
    const cy=position.y+(corner<T.math.two?radius:height-radius);
    const start=T.math.halfTurn+corner*T.math.quarterTurn;
    for(let step=T.math.zero;step<=T.math.curveSteps;step+=T.math.one){const angle=start+step/T.math.curveSteps*T.math.quarterTurn;points.push(transform({x:cx+Math.cos(angle)*radius,y:cy+Math.sin(angle)*radius,z:position.z}));}
  }
  const first=points[T.math.zero]!;const last=points[T.math.two*T.math.curveSteps]!;
  worldPolygon(painter,points,gradient(projectWorld(painter.camera,first),projectWorld(painter.camera,last),material.top,material.front,material.side),material.edge,T.lines.seam);
}
export function finishPrimitives(painter:ScenePainter):readonly SceneCommand[]{
  return painter.primitives.sort((left,right)=>left.depth-right.depth||left.order-right.order).map(primitive=>primitive.command);
}
export function shadow(painter:ScenePainter,center:WorldPoint,width:number,height:number):void{
  const offset={x:center.x+T.light.shadowOffsetX,y:center.y+T.light.shadowOffsetY,z:T.math.zero};
  ellipseOnFloor(painter,offset,width+T.materials.shadowMargin,height+T.materials.shadowMargin,{kind:'radial-gradient',center:projectWorld(painter.camera,offset),radius:Math.max(width,height)*painter.camera.scale,stops:[{offset:T.math.zero,color:P.shadow},{offset:T.math.one,color:P.shadowClear}]},T.light.shadowOpacity,-T.math.one);
  ellipseOnFloor(painter,center,width,height,{kind:'radial-gradient',center:projectWorld(painter.camera,center),radius:Math.max(width,height)*painter.camera.scale,stops:[{offset:T.math.zero,color:P.shadow},{offset:T.math.one,color:P.shadowClear}]},T.light.contactOpacity,-T.math.one);
}
