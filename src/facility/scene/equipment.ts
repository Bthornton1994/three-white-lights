import { projectWorld } from './camera';
import { EQUIPMENT_ASSETS as A, EQUIPMENT_DETAIL_GEOMETRY as D, EQUIPMENT_MATERIALS as M } from './equipmentData';
import { SCENE_PALETTE as P } from './scenePalette';
import { SCENE_TUNING as T } from './sceneTuning';
import { addCommand, box, circlePlane, equipmentTransform, gradient, roundedPanel, shadow, sphere, tube, worldDepth, worldLine, worldPolygon } from './geometry';
import type { ScenePainter, WorldTransform, SceneMaterial } from './geometry';
import type { EquipmentInstance, WorldPoint } from './types';

export interface EquipmentRenderOptions { readonly omitBar?: boolean; readonly elapsedSeconds?: number; readonly reducedMotion?: boolean }
export function assetPoint(tuple: readonly number[]): WorldPoint { return { x:tuple[T.math.zero]??T.math.zero,y:tuple[T.math.one]??T.math.zero,z:tuple[T.math.two]??T.math.zero }; }
function materialOf(key:string):SceneMaterial{return M[key]??M.steel!;}
function brightPoint(point:WorldPoint):WorldPoint{return{x:point.x-T.materials.steelHighlightInset,y:point.y-T.materials.steelHighlightInset,z:(point.z??T.math.zero)+T.materials.steelHighlightInset};}

export function renderWeightPlate(painter:ScenePainter,center:WorldPoint,radius:number,axis:'x'|'y'|'z',material:SceneMaterial,transform:WorldTransform,label=false):void{
  const p=transform(center);const depth=worldDepth(p);
  const thickness={x:center.x+(axis==='x'?T.materials.plateRim:T.math.zero),y:center.y+(axis==='y'?T.materials.plateRim:T.math.zero),z:(center.z??T.math.zero)+(axis==='z'?T.materials.plateRim:T.math.zero)};
  const edge=transform(thickness);const screen=projectWorld(painter.camera,p);const rim=projectWorld(painter.camera,edge);
  circlePlane(painter,center,radius,axis,material.edge,P.steelEdge,T.lines.fine,transform,depth);
  circlePlane(painter,thickness,radius,axis,gradient({x:rim.x-radius*painter.camera.scale,y:rim.y-radius*painter.camera.scale},{x:rim.x+radius*painter.camera.scale,y:rim.y+radius*painter.camera.scale},material.top,material.front,material.side),material.edge,T.lines.fine,transform,depth+T.light.ambientDepth);
  circlePlane(painter,thickness,radius*T.materials.plateInner,axis,material.front,material.top,T.lines.fine,transform,depth+T.light.ambientDepth*T.math.two);
  circlePlane(painter,thickness,radius*T.materials.hubRatio,axis,P.chrome,P.chromeShade,T.lines.seam,transform,depth+T.light.ambientDepth*T.math.three);
  circlePlane(painter,thickness,radius*T.materials.hubRatio/T.math.two,axis,P.hole,undefined,T.math.zero,transform,depth+T.light.ambientDepth*T.math.four);
  if(label){addCommand(painter,{kind:'text',position:{x:screen.x,y:screen.y+radius*painter.camera.scale*T.materials.plateLabelRatio},text:D.label.plateText,fontSize:D.label.fontSize*painter.camera.scale,weight:'700',fill:P.cream,align:'center'},depth+T.light.ambientDepth*T.math.four);}
}

export function renderBarbell(painter:ScenePainter,from:WorldPoint,to:WorldPoint,plates:readonly number[],radius:number,transform:WorldTransform):void{
  tube(painter,from,to,D.benchBar.radius*T.math.two,P.chromeShade,P.chromeBright,transform);
  for(let index=T.math.zero;index<plates.length;index+=T.math.one){const x=plates[index]!;renderWeightPlate(painter,{x,y:from.y,z:from.z},radius,'x',M.red!,transform,index===plates.length/T.math.two-T.math.one||index===plates.length-T.math.one);}
  const gripWidth=Math.abs(to.x-from.x)*T.materials.plateInner;
  const center=(from.x+to.x)/T.math.two;
  worldLine(painter,[transform({x:center-gripWidth/T.math.two,y:from.y,z:from.z}),transform({x:center+gripWidth/T.math.two,y:from.y,z:from.z})],P.chromeShade,T.lines.fine);
}

function drawBoxDetail(painter:ScenePainter,instance:EquipmentInstance,transform:WorldTransform):void{
  const asset=A[instance.item];
  for(const part of asset.boxes){
    const origin=assetPoint(part.position); const material=materialOf(part.material);
    box(painter,origin,part.size[T.math.zero],part.size[T.math.one],part.size[T.math.two],material,transform);
    if(part.pad){roundedPanel(painter,{x:origin.x,y:origin.y,z:(origin.z??T.math.zero)+part.size[T.math.two]+T.math.epsilon},part.size[T.math.zero],part.size[T.math.one],T.materials.padSeamInset,material,transform);
      const inset=T.materials.padSeamInset;
      worldLine(painter,[transform({x:origin.x+inset,y:origin.y+inset,z:(origin.z??T.math.zero)+part.size[T.math.two]}),transform({x:origin.x+inset,y:origin.y+part.size[T.math.one]-inset,z:(origin.z??T.math.zero)+part.size[T.math.two]})],P.seam,T.lines.wire,T.light.highlightOpacity);}
    if(part.holes){for(let z=(origin.z??T.math.zero)+T.materials.holeSpacing;z<(origin.z??T.math.zero)+part.size[T.math.two]-T.materials.holeSpacing;z+=T.materials.holeSpacing){
      const point=transform({x:origin.x+part.size[T.math.zero],y:origin.y+part.size[T.math.one]/T.math.two,z});
      sphere(painter,brightPoint(point),T.materials.holeRadius,P.bolt,worldDepth(point),T.math.one);
      sphere(painter,point,T.materials.holeRadius,P.hole,worldDepth(point)+T.light.ambientDepth);}}
    if(part.bolts){for(const x of [origin.x+D.bolts.cornerInset,origin.x+part.size[T.math.zero]-D.bolts.cornerInset]){for(const y of [origin.y+D.bolts.cornerInset,origin.y+part.size[T.math.one]-D.bolts.cornerInset]){
      sphere(painter,transform({x,y,z:(origin.z??T.math.zero)+part.size[T.math.two]+D.bolts.zOffset}),T.materials.boltRadius,P.bolt);}}}
  }
  for(const beam of asset.beams){const colors=beam.material==='chrome'?[P.chromeShade,P.chromeBright]:beam.material==='rubber'?[P.rubber,P.rubberLight]:beam.material==='red'?[P.redShade,P.redLight]:beam.material==='wood'?[P.woodEdge,P.woodLight]:[P.steel,P.steelLight];tube(painter,assetPoint(beam.from),assetPoint(beam.to),beam.width,colors[T.math.zero]!,colors[T.math.one]!,transform);}
}

function bikeDetails(painter:ScenePainter,transform:WorldTransform,options:EquipmentRenderOptions):void{
  const wheel=assetPoint(D.bike.wheel);
  renderWeightPlate(painter,wheel,D.bike.wheelRadius,'x',M.rubber!,transform);
  const phase=options.reducedMotion?T.math.zero:(options.elapsedSeconds??T.math.zero)*T.motion.bikeFrequency;
  const crank=assetPoint(D.bike.crank);
  for(let side=T.math.zero;side<T.math.two;side+=T.math.one){const angle=phase+side*T.math.halfTurn;const endpoint={x:crank.x+(side-T.math.half)*D.bike.pedalLength,y:crank.y+Math.cos(angle)*D.bike.crankRadius,z:(crank.z??T.math.zero)+Math.sin(angle)*D.bike.crankRadius};tube(painter,{...crank,x:endpoint.x},endpoint,T.lines.frame,P.chromeShade,P.chromeBright,transform);tube(painter,endpoint,{...endpoint,x:endpoint.x+D.bike.pedalLength},T.lines.frame,P.rubber,P.rubberLight,transform);}
  for(let spoke=T.math.zero;spoke<D.rower.fanBlades;spoke+=T.math.one){const angle=spoke/D.rower.fanBlades*T.math.fullTurn+phase;worldLine(painter,[transform(wheel),transform({x:wheel.x,y:wheel.y+Math.cos(angle)*D.bike.wheelRadius,z:(wheel.z??T.math.zero)+Math.sin(angle)*D.bike.wheelRadius})],P.steelLight,T.lines.wire,T.light.highlightOpacity);}
}
function rowerDetails(painter:ScenePainter,transform:WorldTransform):void{
  const wheel=assetPoint(D.rower.wheel);renderWeightPlate(painter,wheel,D.rower.radius,'x',M.rubber!,transform);
  for(let spoke=T.math.zero;spoke<D.rower.fanBlades;spoke+=T.math.one){const angle=spoke/D.rower.fanBlades*T.math.fullTurn;worldLine(painter,[transform(wheel),transform({x:wheel.x,y:wheel.y+Math.cos(angle)*D.rower.radius,z:(wheel.z??T.math.zero)+Math.sin(angle)*D.rower.radius})],P.steelLight,T.lines.wire);}
  tube(painter,assetPoint(D.rower.handleFrom),assetPoint(D.rower.handleTo),T.lines.frame,P.rubber,P.rubberLight,transform);
}
function plateTreeDetails(painter:ScenePainter,transform:WorldTransform):void{
  for(let index=T.math.zero;index<D.plateTree.positions.length;index+=T.math.one){renderWeightPlate(painter,assetPoint(D.plateTree.positions[index]!),D.plateTree.radii[index]!, 'x',materialOf(D.plateTree.materials[index]!),transform);}
}
function treadmillDetails(painter:ScenePainter,transform:WorldTransform):void{
  const screen=assetPoint(D.treadmill.display);box(painter,screen,D.treadmill.displaySize[T.math.zero]!,D.treadmill.displaySize[T.math.one]!,D.treadmill.displaySize[T.math.two]!,M.rubber!,transform);
  const center=transform({x:screen.x+D.treadmill.displaySize[T.math.zero]!/T.math.two,y:screen.y+D.treadmill.displaySize[T.math.one]!/T.math.two,z:(screen.z??T.math.zero)+D.treadmill.displaySize[T.math.two]!});
  addCommand(painter,{kind:'text',position:projectWorld(painter.camera,center),text:'TWL',fontSize:D.label.fontSize*painter.camera.scale,weight:'700',align:'center',fill:P.amber},worldDepth(center));
  const belt=A.treadmill.boxes[T.math.one]!;
  for(let y=belt.position[T.math.one]+D.treadmill.stripeSpacing;y<belt.position[T.math.one]+belt.size[T.math.one];y+=D.treadmill.stripeSpacing){worldLine(painter,[transform({x:belt.position[T.math.zero],y,z:belt.position[T.math.two]+belt.size[T.math.two]}),transform({x:belt.position[T.math.zero]+belt.size[T.math.zero],y,z:belt.position[T.math.two]+belt.size[T.math.two]})],P.rubberLight,D.treadmill.stripeWidth);}
}
function dumbbellDetails(painter:ScenePainter,transform:WorldTransform):void{
  for(let row=T.math.zero;row<D.dumbbells.zs.length;row+=T.math.one){for(const x of D.dumbbells.xs){
    const y=D.dumbbells.ys[row]!;const z=D.dumbbells.zs[row]!;tube(painter,{x:x-D.dumbbells.barWidth/T.math.two,y,z},{x:x+D.dumbbells.barWidth/T.math.two,y,z},T.lines.frame,P.chromeShade,P.chromeBright,transform);
    for(const offset of [-D.dumbbells.barWidth/T.math.two,D.dumbbells.barWidth/T.math.two])renderWeightPlate(painter,{x:x+offset,y,z},D.dumbbells.headRadius,'x',M.rubber!,transform);
  }}
}
function selectorDetails(painter:ScenePainter,transform:WorldTransform,item:'cables'|'machines'):void{
  const towers=item==='cables'?[A.cables.boxes[T.math.one]!,A.cables.boxes[T.math.two]!]:[A.machines.boxes[T.math.one]!];
  for(const tower of towers){const x=tower.position[T.math.zero]+tower.size[T.math.zero]/T.math.two-D.selectors.width/T.math.two;const y=tower.position[T.math.one]+tower.size[T.math.one];
    for(let plate=T.math.zero;plate<D.selectors.count;plate+=T.math.one){box(painter,{x,y,z:D.selectors.bottom+plate*D.selectors.spacing},D.selectors.width,D.selectors.depth,D.selectors.thickness,M.rubber!,transform);}
    tube(painter,{x:x+D.selectors.width/T.math.two,y:y+D.selectors.depth/T.math.two,z:D.selectors.bottom},{x:x+D.selectors.width/T.math.two,y:y+D.selectors.depth/T.math.two,z:tower.size[T.math.two]},T.lines.seam,P.chromeShade,P.chromeBright,transform);
  }
}
function rollerDetails(painter:ScenePainter,transform:WorldTransform):void{
  for(const tuple of D.roller.centers){const center=assetPoint(tuple);tube(painter,{...center,z:(center.z??T.math.zero)-D.roller.height/T.math.two},{...center,z:(center.z??T.math.zero)+D.roller.height/T.math.two},D.roller.radius*T.math.two,P.blueShade,P.blueLight,transform);
    for(let rib=T.math.zero;rib<D.roller.ribs;rib+=T.math.one){circlePlane(painter,{...center,z:(center.z??T.math.zero)-D.roller.height/T.math.two+rib*D.roller.ribSpacing},D.roller.radius,'z',P.blue, P.blueLight,T.lines.wire,transform);}}
}
function saunaDetails(painter:ScenePainter,transform:WorldTransform):void{
  const asset=A.sauna;
  for(const part of asset.boxes){if(part.material!=='wood')continue;for(let slat=T.math.zero;slat<part.size[T.math.two];slat+=D.sauna.slatSpacing){worldLine(painter,[transform({x:part.position[T.math.zero],y:part.position[T.math.one]+part.size[T.math.one],z:part.position[T.math.two]+slat}),transform({x:part.position[T.math.zero]+part.size[T.math.zero],y:part.position[T.math.one]+part.size[T.math.one],z:part.position[T.math.two]+slat})],P.grain,D.sauna.slatWidth);}}
  const glass=assetPoint(D.sauna.glassFrom);const width=D.sauna.glassSize[T.math.zero]!;const height=D.sauna.glassSize[T.math.two]!;
  worldPolygon(painter,[transform(glass),transform({...glass,x:glass.x+width}),transform({...glass,x:glass.x+width,z:(glass.z??T.math.zero)+height}),transform({...glass,z:(glass.z??T.math.zero)+height})],P.glass,P.steelLight,T.lines.seam);
  box(painter,assetPoint(D.sauna.heater),D.sauna.heaterSize[T.math.zero]!,D.sauna.heaterSize[T.math.one]!,D.sauna.heaterSize[T.math.two]!,M.rubber!,transform);
}
function accessories(painter:ScenePainter,transform:WorldTransform,item:EquipmentInstance['item']):void{
  if(item==='wrist-wraps'){for(const tuple of D.wraps.centers){const center=assetPoint(tuple);renderWeightPlate(painter,center,D.wraps.radius,'z',M.red!,transform);worldLine(painter,[transform(center),transform({...center,y:center.y+D.wraps.strapLength})],P.cloth,T.lines.frame);}}
  if(item==='sleeves'){for(const tuple of D.sleeves.centers){const center=assetPoint(tuple);tube(painter,center,{...center,z:(center.z??T.math.zero)+D.sleeves.height},D.sleeves.radius*T.math.two,P.rubber,P.rubberLight,transform);circlePlane(painter,{...center,z:(center.z??T.math.zero)+D.sleeves.height},D.sleeves.radius,'z',P.hole,P.seam,T.lines.fine,transform);}}
  if(item==='belts'){for(const x of D.belts.xs){const points=[{x,y:D.belts.y,z:D.belts.top},{x:x-D.belts.width/T.math.two,y:D.belts.y,z:D.belts.top-D.belts.width},{x:x-D.belts.width/T.math.two,y:D.belts.y,z:D.belts.bottom},{x:x+D.belts.width/T.math.two,y:D.belts.y,z:D.belts.bottom},{x:x+D.belts.width/T.math.two,y:D.belts.y,z:D.belts.top-D.belts.width}];worldPolygon(painter,points.map(transform),P.woodEdge,P.grain,T.lines.seam);box(painter,{x:x-D.belts.width/T.math.two,y:D.belts.y,z:D.belts.buckleZ},D.belts.width,T.lines.seam,D.belts.width/T.math.two,M.steel!,transform);}}
}
function sledDetails(painter:ScenePainter,transform:WorldTransform):void{
  const pad=A.sled.boxes[T.math.zero]!;
  for(let y=D.sled.laneMarkInterval;y<pad.size[T.math.one];y+=D.sled.laneMarkInterval){worldLine(painter,[transform({x:pad.position[T.math.zero],y,z:pad.position[T.math.two]+pad.size[T.math.two]}),transform({x:pad.position[T.math.zero]+pad.size[T.math.zero],y,z:pad.position[T.math.two]+pad.size[T.math.two]})],P.cream,T.lines.seam,T.math.half);}
  for(const z of D.sled.plateLevels){renderWeightPlate(painter,{...assetPoint(D.sled.plateCenter),z},D.sled.plateRadius,'z',M.rubber!,transform);}
}

export function renderEquipment(painter:ScenePainter,instance:EquipmentInstance,options:EquipmentRenderOptions={}):void{
  const asset=A[instance.item];const transform=equipmentTransform(instance.position,asset.size[T.math.zero],asset.size[T.math.one],instance.rotation);
  const bases=asset.boxes.filter(part=>part.position[T.math.two]<=T.materials.groundedBaseMaximumZ);
  const contactPoints=bases.flatMap(part=>[{x:part.position[T.math.zero],y:part.position[T.math.one]},{x:part.position[T.math.zero]+part.size[T.math.zero],y:part.position[T.math.one]+part.size[T.math.one]}]).map(transform);
  const minX=contactPoints.length===T.math.zero?instance.position.x:Math.min(...contactPoints.map(point=>point.x));const minY=contactPoints.length===T.math.zero?instance.position.y:Math.min(...contactPoints.map(point=>point.y));
  const maxX=contactPoints.length===T.math.zero?instance.position.x+instance.footprint.width:Math.max(...contactPoints.map(point=>point.x));const maxY=contactPoints.length===T.math.zero?instance.position.y+instance.footprint.height:Math.max(...contactPoints.map(point=>point.y));
  shadow(painter,{x:(minX+maxX)/T.math.two,y:(minY+maxY)/T.math.two,z:T.math.zero},(maxX-minX)/T.math.two,(maxY-minY)/T.math.two);
  drawBoxDetail(painter,instance,transform);
  if(instance.item==='flat-bench'&&!options.omitBar)renderBarbell(painter,assetPoint(D.benchBar.from),assetPoint(D.benchBar.to),D.benchBar.plates,D.benchBar.plateRadius,transform);
  if(instance.item==='squat-rack'&&!options.omitBar)renderBarbell(painter,assetPoint(D.rackBar.from),assetPoint(D.rackBar.to),D.rackBar.plates,D.rackBar.plateRadius,transform);
  if(instance.item==='comp-plates')plateTreeDetails(painter,transform);
  if(instance.item==='bike')bikeDetails(painter,transform,options);
  if(instance.item==='rower')rowerDetails(painter,transform);
  if(instance.item==='treadmill')treadmillDetails(painter,transform);
  if(instance.item==='dumbbells')dumbbellDetails(painter,transform);
  if(instance.item==='cables'||instance.item==='machines')selectorDetails(painter,transform,instance.item);
  if(instance.item==='foam-rollers')rollerDetails(painter,transform);
  if(instance.item==='sauna')saunaDetails(painter,transform);
  if(instance.item==='wrist-wraps'||instance.item==='belts'||instance.item==='sleeves')accessories(painter,transform,instance.item);
  if(instance.item==='sled')sledDetails(painter,transform);
  if(instance.condition!==undefined&&instance.condition<T.materials.wearThreshold){const p=transform({x:asset.size[T.math.zero]/T.math.two,y:asset.size[T.math.one]/T.math.two,z:asset.height});sphere(painter,p,T.build.markerRadius,P.amber);addCommand(painter,{kind:'text',position:projectWorld(painter.camera,p),text:'!',fontSize:D.label.fontSize*painter.camera.scale,weight:'700',fill:P.steelEdge,align:'center'},worldDepth(p)+T.light.ambientDepth);}
}
