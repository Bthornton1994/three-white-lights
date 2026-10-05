import type { FloorSimMember } from '../floorSim';
import type { MemberType } from '../members';
import { projectWorld } from './camera';
import { ANATOMY_GEOMETRY as A, STANDING_POSE, STATION_POSES, type JointName } from './anatomyData';
import { EQUIPMENT_ASSETS as E, EQUIPMENT_DETAIL_GEOMETRY as D, EQUIPMENT_MATERIALS as M } from './equipmentData';
import { assetPoint, renderBarbell, renderWeightPlate } from './equipment';
import { SCENE_PALETTE as P } from './scenePalette';
import { SCENE_TUNING as T } from './sceneTuning';
import { addCommand, equipmentTransform, gradient, identityTransform, shadow, sphere, tube, worldDepth, worldLine } from './geometry';
import type { ScenePainter, WorldTransform } from './geometry';
import type { EquipmentInstance, ScenePoint, WorldPoint } from './types';

type Pose=Record<JointName,WorldPoint>;
type BodyColors={readonly bulk:number;readonly height:number;readonly skin:readonly string[];readonly shirt:readonly string[];readonly shorts:readonly string[]};
export interface ActorRenderOptions {readonly elapsedSeconds:number;readonly reducedMotion?:boolean;readonly tickAlpha?:number;readonly equipment?:EquipmentInstance;readonly staff?:boolean;readonly staffPosition?:ScenePoint}
function mixPoint(a:WorldPoint,b:WorldPoint,amount:number):WorldPoint{return{x:a.x+(b.x-a.x)*amount,y:a.y+(b.y-a.y)*amount,z:(a.z??T.math.zero)+((b.z??T.math.zero)-(a.z??T.math.zero))*amount};}
function transformPose(pose:Pose,transform:WorldTransform):Pose{return Object.fromEntries(Object.entries(pose).map(([key,point])=>[key,transform(point)])) as Pose;}
function clonePose(item?:EquipmentInstance['item']):Pose{const source=item===undefined?STANDING_POSE:STATION_POSES[item];return Object.fromEntries(Object.entries(source).map(([key,tuple])=>[key,assetPoint(tuple)])) as Pose;}
function adjust(pose:Pose,names:readonly JointName[],delta:WorldPoint):void{for(const name of names){const point=pose[name];pose[name]={x:point.x+delta.x,y:point.y+delta.y,z:(point.z??T.math.zero)+(delta.z??T.math.zero)};}}

function standingPose(member:FloorSimMember,options:ActorRenderOptions):Pose{
  const pose=clonePose();const moving=member.next!==null&&(member.state==='seeking'||member.state==='leaving');
  const phase=options.reducedMotion?T.math.zero:options.elapsedSeconds*T.motion.walkFrequency+member.index*T.motion.phaseSpread;
  const stride=moving?Math.sin(phase)*T.motion.walkStride:T.math.zero;const bob=moving?Math.abs(Math.cos(phase))*T.motion.walkBob:T.math.zero;
  for(const side of ['L','R'] as const){const sign=side==='L'?T.math.one:-T.math.one;const legLift=moving?Math.max(T.math.zero,Math.sin(phase+(side==='L'?T.math.zero:T.math.halfTurn)))*T.motion.walkLift:T.math.zero;
    adjust(pose,[`ankle${side}`,`toe${side}`],{x:T.math.zero,y:stride*sign,z:legLift});
    adjust(pose,[`knee${side}`],{x:T.math.zero,y:stride*sign*A.walk.kneeSwing,z:legLift*T.math.half});
    adjust(pose,[`elbow${side}`,`hand${side}`],{x:T.math.zero,y:-stride*sign*A.walk.armSwing/T.motion.walkStride,z:T.math.zero});}
  const body=A.bodyTypes[member.type];for(const joint of Object.keys(pose) as JointName[]){const point=pose[joint];pose[joint]={...point,z:(point.z??T.math.zero)*body.height+bob};}
  if(member.state==='queuing'||member.state==='interrupted'){const sway=options.reducedMotion?T.math.zero:Math.sin(options.elapsedSeconds*T.motion.queueFrequency+member.index)*T.motion.queueShift;adjust(pose,['head','neck','shoulderL','shoulderR'],{x:sway,y:T.math.zero,z:T.math.zero});
    pose.handL=mixPoint(pose.shoulderR,pose.hipR,T.math.half);pose.handR=mixPoint(pose.shoulderL,pose.hipL,T.math.half);pose.elbowL={...pose.elbowL,y:A.body.frontDepth};pose.elbowR={...pose.elbowR,y:A.body.frontDepth};}
  if(options.staff){pose.handL=assetPoint(A.staff.handL);pose.handR=assetPoint(A.staff.handR);pose.elbowL=assetPoint(A.staff.elbowL);pose.elbowR=assetPoint(A.staff.elbowR);adjust(pose,['head'],{x:T.math.zero,y:T.math.zero,z:-A.staff.headReadLower});}
  const alpha=options.reducedMotion?T.math.zero:Math.min(T.math.one,member.progress+(options.tickAlpha??T.math.zero)*T.motion.interpolationTicks);
  const point=options.staffPosition??{x:member.cell.x+T.math.half+(member.next===null?T.math.zero:(member.next.x-member.cell.x)*alpha),y:member.cell.y+T.math.half+(member.next===null?T.math.zero:(member.next.y-member.cell.y)*alpha)};
  const direction=!moving||member.next===null?A.walk.turnDefault:Math.atan2(member.next.x-member.cell.x,-(member.next.y-member.cell.y));
  const cosine=Math.cos(direction);const sine=Math.sin(direction);
  return transformPose(pose,p=>({x:point.x+p.x*cosine-p.y*sine,y:point.y+p.x*sine+p.y*cosine,z:p.z}));
}

function stationPose(member:FloorSimMember,options:ActorRenderOptions):{pose:Pose;transform:WorldTransform;phase:number}{
  const equipment=options.equipment!;const pose=clonePose(equipment.item);const asset=E[equipment.item];
  const phase=options.reducedMotion?T.math.zero:options.elapsedSeconds*T.motion.useFrequency+member.index*T.motion.phaseSpread;
  const rep=(Math.sin(phase)+T.math.one)/T.math.two;
  if(equipment.item==='flat-bench'){const benchPhase=options.reducedMotion?T.math.zero:options.elapsedSeconds*T.motion.benchFrequency+member.index*T.motion.phaseSpread;const travel=(Math.sin(benchPhase)+T.math.one)/T.math.two;pose.handL={...pose.handL,z:A.bench.handLow+travel*A.bench.handTravel};pose.handR={...pose.handR,z:pose.handL.z};adjust(pose,['elbowL','elbowR'],{x:T.math.zero,y:T.math.zero,z:travel*A.bench.elbowTravel});}
  if(equipment.item==='squat-rack'){const squatPhase=options.reducedMotion?T.math.zero:options.elapsedSeconds*T.motion.squatFrequency+member.index*T.motion.phaseSpread;const down=(Math.sin(squatPhase)+T.math.one)/T.math.two;
    adjust(pose,['head','neck','shoulderL','shoulderR','elbowL','elbowR','handL','handR'],{x:T.math.zero,y:down*A.squat.shoulderForward,z:-down*A.squat.drop});adjust(pose,['hipL','hipR'],{x:T.math.zero,y:down*A.squat.hipBack,z:-down*A.squat.drop});adjust(pose,['kneeL','kneeR'],{x:T.math.zero,y:-down*A.squat.kneeForward,z:T.math.zero});}
  if(equipment.item==='rower'){const rowPhase=options.reducedMotion?T.math.zero:options.elapsedSeconds*T.motion.rowFrequency+member.index*T.motion.phaseSpread;const extension=(Math.sin(rowPhase)+T.math.one)/T.math.two;adjust(pose,['hipL','hipR'],{x:T.math.zero,y:extension*A.rower.hipTravel,z:T.math.zero});adjust(pose,['head','neck','shoulderL','shoulderR','elbowL','elbowR'],{x:T.math.zero,y:extension*A.rower.shoulderTravel,z:T.math.zero});adjust(pose,['handL','handR'],{x:T.math.zero,y:extension*A.rower.handTravel,z:T.math.zero});adjust(pose,['kneeL','kneeR'],{x:T.math.zero,y:T.math.zero,z:(T.math.one-extension)*A.rower.kneeLift});}
  if(equipment.item==='bike'){const bikePhase=options.reducedMotion?T.math.zero:options.elapsedSeconds*T.motion.bikeFrequency;const crank=assetPoint(D.bike.crank);for(const side of ['L','R'] as const){const sideIndex=side==='L'?T.math.zero:T.math.one;const angle=bikePhase+sideIndex*T.math.halfTurn;const foot={x:A.bike.pedalX[sideIndex]!,y:crank.y+Math.cos(angle)*D.bike.crankRadius,z:(crank.z??T.math.zero)+Math.sin(angle)*D.bike.crankRadius};pose[`ankle${side}`]=foot;pose[`toe${side}`]={x:foot.x,y:foot.y+A.bike.toeOffsetY,z:(foot.z??T.math.zero)+A.bike.toeOffsetZ};adjust(pose,[`knee${side}`],{x:T.math.zero,y:Math.cos(angle)*A.bike.kneeTravel,z:Math.sin(angle)*A.bike.kneeLift});}}
  if(equipment.item==='treadmill'||equipment.item==='sled'){const stride=options.reducedMotion?T.math.zero:Math.sin(options.elapsedSeconds*T.motion.walkFrequency+member.index)*T.motion.walkStride;for(const side of ['L','R'] as const){const sign=side==='L'?T.math.one:-T.math.one;adjust(pose,[`ankle${side}`,`toe${side}`],{x:T.math.zero,y:stride*sign,z:Math.max(T.math.zero,stride*sign)*T.motion.walkLift/T.motion.walkStride});adjust(pose,[`knee${side}`],{x:T.math.zero,y:stride*sign*A.walk.kneeSwing,z:T.math.zero});}}
  if(equipment.item==='dumbbells'||equipment.item==='power-bar'){adjust(pose,['handL','handR'],{x:T.math.zero,y:-rep*A.curls.handBack,z:rep*A.curls.handLift});}
  if(equipment.item==='cables'){adjust(pose,['handL','handR','elbowL','elbowR'],{x:T.math.zero,y:rep*A.cable.handTravel,z:T.math.zero});adjust(pose,['head','neck','shoulderL','shoulderR'],{x:T.math.zero,y:rep*A.cable.shoulderBack,z:T.math.zero});}
  if(equipment.item==='machines'){adjust(pose,['handL','handR'],{x:T.math.zero,y:rep*A.machine.handTravel,z:T.math.zero});adjust(pose,['elbowL','elbowR'],{x:T.math.zero,y:rep*A.machine.elbowTravel,z:T.math.zero});}
  if(equipment.item==='mats'){adjust(pose,['head','neck','shoulderL','shoulderR','handL','handR'],{x:T.math.zero,y:-rep*A.recovery.stretchTravel,z:T.math.zero});}
  if(equipment.item==='foam-rollers'){adjust(pose,['hipL','hipR','kneeL','kneeR'],{x:T.math.zero,y:rep*A.recovery.stretchTravel,z:rep*A.recovery.rollerLift});}
  if(equipment.item==='wrist-wraps'||equipment.item==='belts'||equipment.item==='sleeves'||equipment.item==='comp-plates'||equipment.item==='specialty-bars'){adjust(pose,['handL','handR'],{x:T.math.zero,y:Math.sin(phase)*A.recovery.wrapHands,z:T.math.zero});}
  const transform=equipmentTransform(equipment.position,asset.size[T.math.zero],asset.size[T.math.one],equipment.rotation);
  return{pose:transformPose(pose,transform),transform,phase};
}

function screenCapsule(painter:ScenePainter,a:WorldPoint,b:WorldPoint,radiusA:number,radiusB:number,colors:readonly string[],outline=true):void{
  const start=projectWorld(painter.camera,a);const end=projectWorld(painter.camera,b);const angle=Math.atan2(end.y-start.y,end.x-start.x);const points:ScenePoint[]=[];const ra=radiusA*painter.camera.scale;const rb=radiusB*painter.camera.scale;
  for(let step=T.math.zero;step<=T.math.curveSteps;step+=T.math.one){const phase=angle+T.math.quarterTurn+step/T.math.curveSteps*T.math.halfTurn;points.push({x:start.x+Math.cos(phase)*ra,y:start.y+Math.sin(phase)*ra});}
  for(let step=T.math.zero;step<=T.math.curveSteps;step+=T.math.one){const phase=angle-T.math.quarterTurn+step/T.math.curveSteps*T.math.halfTurn;points.push({x:end.x+Math.cos(phase)*rb,y:end.y+Math.sin(phase)*rb});}
  const center={x:(start.x+end.x)/T.math.two,y:(start.y+end.y)/T.math.two};const cross={x:Math.cos(angle+T.math.quarterTurn)*ra,y:Math.sin(angle+T.math.quarterTurn)*ra};
  addCommand(painter,{kind:'polygon',points,fill:gradient({x:center.x-cross.x,y:center.y-cross.y},{x:center.x+cross.x,y:center.y+cross.y},colors[T.math.zero]!,colors[T.math.one]!,colors[T.math.two]!),stroke:outline?colors[T.math.two]:undefined,lineWidth:T.anatomy.outline*painter.camera.scale},(worldDepth(a)+worldDepth(b))/T.math.two);
}
function muscle(painter:ScenePainter,a:WorldPoint,b:WorldPoint,radius:number,colors:readonly string[]):void{
  const highlight=mixPoint(a,b,A.muscle.midpoint);const screen=projectWorld(painter.camera,highlight);const top={x:screen.x-radius*painter.camera.scale,y:screen.y-radius*painter.camera.scale};
  addCommand(painter,{kind:'ellipse',center:screen,radiusX:radius*painter.camera.scale*A.muscle.highlightWidth,radiusY:radius*painter.camera.scale,rotation:Math.atan2(projectWorld(painter.camera,b).y-projectWorld(painter.camera,a).y,projectWorld(painter.camera,b).x-projectWorld(painter.camera,a).x)-T.math.quarterTurn,fill:gradient(top,screen,colors[T.math.zero]!,colors[T.math.one]!,colors[T.math.one]!),opacity:A.muscle.shadeOpacity},worldDepth(highlight)+T.light.ambientDepth);
}
function drawTorso(painter:ScenePainter,pose:Pose,colors:BodyColors,bulk:number):void{
  const shoulderL=projectWorld(painter.camera,pose.shoulderL);const shoulderR=projectWorld(painter.camera,pose.shoulderR);const hipL=projectWorld(painter.camera,pose.hipL);const hipR=projectWorld(painter.camera,pose.hipR);const neck=projectWorld(painter.camera,pose.neck);
  const centerShoulder={x:(shoulderL.x+shoulderR.x)/T.math.two,y:(shoulderL.y+shoulderR.y)/T.math.two};const centerHip={x:(hipL.x+hipR.x)/T.math.two,y:(hipL.y+hipR.y)/T.math.two};
  const sl={x:centerShoulder.x+(shoulderL.x-centerShoulder.x)*A.body.torsoChestWidth*bulk,y:shoulderL.y};const sr={x:centerShoulder.x+(shoulderR.x-centerShoulder.x)*A.body.torsoChestWidth*bulk,y:shoulderR.y};
  const hl={x:centerHip.x+(hipL.x-centerHip.x)*A.body.torsoHipWidth*bulk,y:hipL.y+T.anatomy.outline*painter.camera.scale};const hr={x:centerHip.x+(hipR.x-centerHip.x)*A.body.torsoHipWidth*bulk,y:hipR.y+T.anatomy.outline*painter.camera.scale};
  const vertices=[sl,{x:(sl.x+hl.x)/T.math.two-A.body.waistInset*painter.camera.scale,y:(sl.y+hl.y)/T.math.two},hl,{x:centerHip.x,y:centerHip.y+A.body.hemDrop*painter.camera.scale},hr,{x:(sr.x+hr.x)/T.math.two+A.body.waistInset*painter.camera.scale,y:(sr.y+hr.y)/T.math.two},sr,{x:neck.x,y:neck.y+A.body.shoulderDrop*painter.camera.scale}];
  const points:ScenePoint[]=[];
  for(let index=T.math.zero;index<vertices.length;index+=T.math.one){const prior=vertices[(index-T.math.one+vertices.length)%vertices.length]!;const vertex=vertices[index]!;const next=vertices[(index+T.math.one)%vertices.length]!;const start={x:(prior.x+vertex.x)/T.math.two,y:(prior.y+vertex.y)/T.math.two};const end={x:(vertex.x+next.x)/T.math.two,y:(vertex.y+next.y)/T.math.two};for(let step=T.math.zero;step<=T.math.curveSteps;step+=T.math.one){const u=step/T.math.curveSteps;const v=T.math.one-u;points.push({x:v*v*start.x+T.math.two*v*u*vertex.x+u*u*end.x,y:v*v*start.y+T.math.two*v*u*vertex.y+u*u*end.y});}}
  const depth=(worldDepth(pose.shoulderL)+worldDepth(pose.shoulderR)+worldDepth(pose.hipL)+worldDepth(pose.hipR))/T.math.four;
  addCommand(painter,{kind:'polygon',points,fill:gradient(sl,hr,colors.shirt[T.math.zero]!,colors.shirt[T.math.one]!,colors.shirt[T.math.two]!),stroke:colors.shirt[T.math.two],lineWidth:T.anatomy.outline*painter.camera.scale},depth);
  const seamY=(centerShoulder.y+centerHip.y)/T.math.two;
  addCommand(painter,{kind:'line',points:[{x:(sl.x+hl.x)/T.math.two,y:seamY},{x:centerHip.x,y:seamY+A.body.chestBend*painter.camera.scale},{x:(sr.x+hr.x)/T.math.two,y:seamY}],stroke:colors.shirt[T.math.two]!,lineWidth:T.anatomy.muscleEdge*painter.camera.scale,opacity:A.muscle.shadeOpacity},depth+T.light.ambientDepth);
  const logo=mixPoint(mixPoint(pose.shoulderL,pose.shoulderR,T.math.half),mixPoint(pose.hipL,pose.hipR,T.math.half),A.body.shirtLogoZ);
  for(let light=T.math.zero;light<T.math.three;light+=T.math.one){sphere(painter,{x:logo.x+(light-T.math.one)*A.body.shirtLogoGap,y:logo.y+A.body.frontDepth,z:logo.z},A.body.shirtLogoRadius,P.cream,depth+T.light.ambientDepth*T.math.two);}
}
function drawHead(painter:ScenePainter,pose:Pose,colors:BodyColors,bulk:number):void{
  const head=pose.head;const center=projectWorld(painter.camera,head);const radius=T.anatomy.headRadius*Math.sqrt(bulk)*painter.camera.scale;const depth=worldDepth(head);
  addCommand(painter,{kind:'ellipse',center,radiusX:radius*A.face.headWidth,radiusY:radius*A.face.headHeight,fill:gradient({x:center.x-radius,y:center.y-radius},{x:center.x+radius,y:center.y+radius},colors.skin[T.math.zero]!,colors.skin[T.math.one]!,colors.skin[T.math.two]!),stroke:colors.skin[T.math.two],lineWidth:T.anatomy.outline*painter.camera.scale},depth);
  addCommand(painter,{kind:'ellipse',center:{x:center.x,y:center.y-A.face.hairTopOffset*painter.camera.scale},radiusX:radius*A.face.hairWidth,radiusY:radius*A.face.hairHeight,fill:gradient({x:center.x-radius,y:center.y-radius},{x:center.x+radius,y:center.y},P.hairLight,P.hair,P.hair),stroke:P.hair,lineWidth:T.anatomy.outline*painter.camera.scale},depth+T.light.ambientDepth);
  for(const lock of A.face.hairLockPositions){sphere(painter,{x:head.x+lock[T.math.zero]!,y:head.y+A.face.hairFront,z:(head.z??T.math.zero)-lock[T.math.one]!},A.face.hairLockRadius,P.hair,depth+T.light.ambientDepth*T.math.two);}
  sphere(painter,{x:head.x-A.face.earOffset,y:head.y+A.body.frontDepth,z:(head.z??T.math.zero)+A.face.earZ},A.face.earRadius,colors.skin[T.math.one]!,depth+T.light.ambientDepth*T.math.two);
  sphere(painter,{x:head.x+A.face.noseOffset,y:head.y+A.body.frontDepth,z:(head.z??T.math.zero)+A.face.noseZ},A.face.noseRadius,colors.skin[T.math.zero]!,depth+T.light.ambientDepth*T.math.two);
  addCommand(painter,{kind:'ellipse',center:{x:center.x+A.face.beardOffset*painter.camera.scale,y:center.y+A.face.jawOffset*painter.camera.scale},radiusX:A.face.beardWidth*painter.camera.scale,radiusY:A.face.beardHeight*painter.camera.scale,fill:P.beard},depth+T.light.ambientDepth*T.math.three);
  sphere(painter,{x:head.x+A.face.eyeOffset,y:head.y+A.body.frontDepth,z:(head.z??T.math.zero)+A.face.eyeZ},A.face.eyeRadius,P.hair,depth+T.light.ambientDepth*T.math.four);
}
function drawShoes(painter:ScenePainter,ankle:WorldPoint,toe:WorldPoint,colors:BodyColors):void{
  const sock=mixPoint(ankle,{...ankle,z:(ankle.z??T.math.zero)+T.anatomy.sockHeight},T.math.one);screenCapsule(painter,ankle,sock,A.muscle.ankle,A.muscle.lowerLeg*A.shoe.sockWhiteRatio,[P.sock,P.cream,P.muted]);
  const soleAnkle={...ankle,z:(ankle.z??T.math.zero)-A.shoe.soleHeight};const soleToe={...toe,z:(toe.z??T.math.zero)-A.shoe.soleHeight};screenCapsule(painter,soleAnkle,soleToe,A.shoe.heelRadius,A.shoe.toeRadius,[P.shoeSole,P.shoeSole,P.shoe]);screenCapsule(painter,ankle,toe,A.shoe.heelRadius,A.shoe.toeRadius,[P.shoeLight,P.shoe,P.shoe]);
  for(let lace=T.math.zero;lace<A.shoe.laceCount;lace+=T.math.one){const point=mixPoint(ankle,toe,(lace+T.math.one)/(A.shoe.laceCount+T.math.one));worldLine(painter,[{x:point.x-A.shoe.laceWidth,y:point.y,z:(point.z??T.math.zero)+A.shoe.soleHeight},{x:point.x+A.shoe.laceWidth,y:point.y,z:(point.z??T.math.zero)+A.shoe.soleHeight}],P.cream,T.lines.wire);}
}
function drawBody(painter:ScenePainter,pose:Pose,type:MemberType|'staff'):void{
  const colors=A.bodyTypes[type];const bulk=colors.bulk;
  const ground=mixPoint(pose.ankleL,pose.ankleR,T.math.half);shadow(painter,{...ground,z:T.math.zero},T.anatomy.actorShadowX*bulk,T.anatomy.actorShadowY);
  for(const side of ['L','R'] as const){const hip=pose[`hip${side}`];const knee=pose[`knee${side}`];const ankle=pose[`ankle${side}`];
    screenCapsule(painter,hip,knee,A.muscle.upperLeg*bulk,A.muscle.upperLeg*bulk* T.math.half,colors.skin);muscle(painter,hip,knee,A.muscle.upperLeg*bulk,colors.skin);
    screenCapsule(painter,knee,ankle,A.muscle.lowerLeg*bulk,A.muscle.ankle,colors.skin);muscle(painter,knee,ankle,A.muscle.lowerLeg*bulk,colors.skin);
    screenCapsule(painter,hip,mixPoint(hip,knee,A.body.shortLength),A.muscle.shorts*bulk,A.muscle.shorts*bulk,colors.shorts);
    drawShoes(painter,ankle,pose[`toe${side}`],colors);
  }
  const hipCenter=mixPoint(pose.hipL,pose.hipR,T.math.half);screenCapsule(painter,pose.hipL,pose.hipR,A.body.hipClothRadius*bulk,A.body.hipClothRadius*bulk,colors.shorts);
  for(const side of ['L','R'] as const){const shoulder=pose[`shoulder${side}`];const elbow=pose[`elbow${side}`];
    screenCapsule(painter,shoulder,elbow,A.muscle.upperArm*bulk,A.muscle.forearm*bulk,colors.skin);muscle(painter,shoulder,elbow,A.muscle.upperArm*bulk,colors.skin);
    screenCapsule(painter,shoulder,mixPoint(shoulder,elbow,A.body.shirtSleeve),A.muscle.sleeve*bulk,A.muscle.upperArm*bulk,colors.shirt);
  }
  screenCapsule(painter,pose.neck,pose.head,T.anatomy.neckRadius,T.anatomy.neckRadius,colors.skin);
  drawTorso(painter,pose,colors,bulk);
  worldLine(painter,[{...hipCenter,x:hipCenter.x-A.body.waistInset,z:(hipCenter.z??T.math.zero)+A.body.hemDrop},{...hipCenter,x:hipCenter.x+A.body.waistInset,z:(hipCenter.z??T.math.zero)+A.body.hemDrop}],P.woodLight,T.lines.fine);
  for(const side of ['L','R'] as const){const elbow=pose[`elbow${side}`];const hand=pose[`hand${side}`];
    screenCapsule(painter,elbow,hand,A.muscle.forearm*bulk,A.muscle.wrist,colors.skin);muscle(painter,elbow,hand,A.muscle.forearm*bulk,colors.skin);
    sphere(painter,hand,T.anatomy.handRadius,gradient(projectWorld(painter.camera,{...hand,x:hand.x-T.anatomy.handRadius}),projectWorld(painter.camera,{...hand,x:hand.x+T.anatomy.handRadius}),colors.skin[T.math.zero]!,colors.skin[T.math.one]!,colors.skin[T.math.two]!));
  }
  drawHead(painter,pose,colors,bulk);
}
function drawHeldEquipment(painter:ScenePainter,pose:Pose,instance:EquipmentInstance):void{
  if(instance.item==='flat-bench'||instance.item==='squat-rack'){const asset=E[instance.item];const transform=equipmentTransform(instance.position,asset.size[T.math.zero],asset.size[T.math.one],instance.rotation);const authored=STATION_POSES[instance.item];const hands=pose.handL;const original=transform(assetPoint(authored.handL));const lift=(hands.z??T.math.zero)-(original.z??T.math.zero);const data=instance.item==='flat-bench'?D.benchBar:D.rackBar;const from=assetPoint(data.from);const to=assetPoint(data.to);const handLocal=assetPoint(authored.handL);
    const barFrom={x:from.x,y:handLocal.y,z:(handLocal.z??T.math.zero)+lift};const barTo={x:to.x,y:handLocal.y,z:barFrom.z};renderBarbell(painter,barFrom,barTo,data.plates,data.plateRadius,transform);
  }
  if(instance.item==='dumbbells'){for(const hand of [pose.handL,pose.handR]){tube(painter,{...hand,x:hand.x-A.curls.weightSpan/T.math.two},{...hand,x:hand.x+A.curls.weightSpan/T.math.two},T.lines.frame,P.chromeShade,P.chromeBright);for(const sign of [-T.math.one,T.math.one])renderWeightPlate(painter,{...hand,x:hand.x+sign*A.curls.weightSpan/T.math.two},A.curls.weightRadius,'x',M.rubber!,identityTransform);}}
  if(instance.item==='rower'){tube(painter,pose.handL,pose.handR,A.rower.handleRadius,P.rubber,P.rubberLight);const anchor=equipmentTransform(instance.position,E.rower.size[T.math.zero],E.rower.size[T.math.one],instance.rotation)(assetPoint(D.rower.wheel));worldLine(painter,[anchor,mixPoint(pose.handL,pose.handR,T.math.half)],P.chrome,T.lines.wire);}
  if(instance.item==='cables'){const transform=equipmentTransform(instance.position,E.cables.size[T.math.zero],E.cables.size[T.math.one],instance.rotation);for(const [hand,anchor] of [[pose.handL,E.cables.beams[T.math.zero]!.from],[pose.handR,E.cables.beams[T.math.one]!.from]] as const){worldLine(painter,[transform(assetPoint(anchor)),hand],P.chrome,T.lines.wire);sphere(painter,hand,A.cable.gripRadius,P.rubber);}}
}
function drawCue(painter:ScenePainter,member:FloorSimMember,pose:Pose):void{
  if(member.state!=='interrupted'&&member.strandedAt===null&&member.state!=='queuing')return;
  const head=pose.head;const anchor={x:head.x,y:head.y,z:(head.z??T.math.zero)+A.cue.depthOffset};const point=projectWorld(painter.camera,anchor);const warning=member.strandedAt!==null||member.state==='interrupted';
  addCommand(painter,{kind:'ellipse',center:point,radiusX:A.cue.bubbleWidth*painter.camera.scale/T.math.two,radiusY:A.cue.bubbleHeight*painter.camera.scale/T.math.two,fill:warning?P.amberShade:P.steelEdge,stroke:warning?P.amber:P.steelLight,lineWidth:T.lines.fine*painter.camera.scale},worldDepth(anchor)+A.cue.depthOffset);
  addCommand(painter,{kind:'text',position:{x:point.x,y:point.y+A.cue.iconZ*painter.camera.scale},text:warning?(member.interruptedBy==='target-moved'?'↻':'!'):'···',fontSize:A.cue.fontSize*painter.camera.scale,weight:'700',align:'center',fill:warning?P.ivory:P.amber},worldDepth(anchor)+A.cue.depthOffset+T.light.ambientDepth);
}

export function renderMember(painter:ScenePainter,member:FloorSimMember,options:ActorRenderOptions):{readonly position:ScenePoint;readonly head:ScenePoint;readonly depth:number;readonly bodyEnd:number;readonly heldEnd:number}{
  const using=member.state==='using'&&options.equipment!==undefined;const pose=using?stationPose(member,options).pose:standingPose(member,options);
  drawBody(painter,pose,options.staff?'staff':member.type);const bodyEnd=painter.primitives.length;if(using)drawHeldEquipment(painter,pose,options.equipment!);const heldEnd=painter.primitives.length;drawCue(painter,member,pose);
  const position=mixPoint(pose.ankleL,pose.ankleR,T.math.half);return{position,head:projectWorld(painter.camera,pose.head),depth:worldDepth(position),bodyEnd,heldEnd};
}
