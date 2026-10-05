import { floorGridSize } from '../floor';
import type { LadderRung } from '../ladder';
import { projectWorld, projectedFootprint } from './camera';
import { ENVIRONMENT_GEOMETRY as D, ENVIRONMENT_STAGES as S } from './environmentData';
import { SCENE_PALETTE as P } from './scenePalette';
import { SCENE_TUNING as T } from './sceneTuning';
import { addCommand, box, circlePlane, ellipseOnFloor, gradient, sphere, tube, worldLine, worldPolygon } from './geometry';
import type { ScenePainter } from './geometry';
import type { SceneCamera, SceneCommand, WorldPoint } from './types';

function textureNoise(x:number,y:number):number{const value=Math.sin(x*T.detail.textureHashX+y*T.detail.textureHashY)*T.math.hashMultiplier;return value-Math.floor(value);}
function tileVisible(camera:SceneCamera,x:number,y:number):boolean{const point=projectWorld(camera,{x,y});const margin=D.floor.cullMargin;return point.x>-margin&&point.x<camera.viewport.width+margin&&point.y>-margin&&point.y<camera.viewport.height+margin;}
function floorTiles(painter:ScenePainter,rung:LadderRung,build:boolean):void{
 const grid=floorGridSize(rung);const stage=S[rung];
 const baseStart=painter.primitives.length;
 box(painter,{x:T.math.zero,y:T.math.zero,z:D.floor.baseZ},grid.width,grid.height,-D.floor.baseZ,{top:P.floor,front:P.floorEdge,side:P.floorDark,edge:P.floorEdge});
 for(let index=baseStart;index<painter.primitives.length;index+=T.math.one){const primitive=painter.primitives[index]!;painter.primitives[index]={...primitive,depth:D.depth.floor-T.math.one};}
 for(let y=T.math.zero;y<grid.height;y+=T.math.one){for(let x=T.math.zero;x<grid.width;x+=T.math.one){if(!tileVisible(painter.camera,x,y))continue;
  const noise=textureNoise(x,y);const material=stage.floor[Math.floor(noise*stage.floor.length)]??P.floor;const inset=T.detail.floorTileInset;
  worldPolygon(painter,[{x:x+inset,y:y+inset},{x:x+T.math.one-inset,y:y+inset},{x:x+T.math.one-inset,y:y+T.math.one-inset},{x:x+inset,y:y+T.math.one-inset}],material,P.floorMortar,T.lines.fine,T.math.one,D.depth.floor);
  for(let speck=T.math.zero;speck<T.detail.floorSpecksPerTile;speck+=T.math.one){const px=x+textureNoise(x+speck,y+T.math.half);const py=y+textureNoise(x+T.math.half,y+speck);worldLine(painter,[{x:px,y:py},{x:px+T.detail.floorScratchLength*textureNoise(px,py),y:py+T.detail.floorScratchLength*textureNoise(py,px)}],speck%T.math.two===T.math.zero?P.floorDust:P.floorEdge,T.lines.wire,T.detail.floorWearOpacity,D.depth.texture);}
  if(build)worldPolygon(painter,[{x,y},{x:x+T.math.one,y},{x:x+T.math.one,y:y+T.math.one},{x,y:y+T.math.one}],P.transparent,P.cream,T.lines.floorGrid,T.build.floorGridOpacity,D.depth.texture);
 }}
 if(stage.floorStripe){const inset=D.floor.aisleInset;worldLine(painter,[{x:inset,y:grid.height-inset},{x:grid.width-inset,y:grid.height-inset},{x:grid.width-inset,y:inset}],P.amber,D.floor.aisleStripe,T.math.half,D.depth.texture);}
}
function wallPoint(axis:'x'|'y',along:number,z:number,inset:number=T.math.zero):WorldPoint{return axis==='x'?{x:inset,y:along,z}:{x:along,y:inset,z};}
function wallQuad(painter:ScenePainter,axis:'x'|'y',along:number,z:number,width:number,height:number,fill:string,depth:number):void{worldPolygon(painter,[wallPoint(axis,along,z),wallPoint(axis,along+width,z),wallPoint(axis,along+width,z+height),wallPoint(axis,along,z+height)],fill,P.mortar,T.detail.mortar,T.math.one,depth);}
function brickWall(painter:ScenePainter,axis:'x'|'y',length:number,height:number):void{
 wallQuad(painter,axis,T.math.zero,T.math.zero,length,height,P.brickDark,D.depth.walls);
 for(let z=T.math.zero,row=T.math.zero;z<height;z+=T.detail.brickHeight,row+=T.math.one){const offset=row%T.math.two*T.detail.brickWidth/T.math.two;for(let along=-offset;along<length;along+=T.detail.brickWidth){const start=Math.max(T.math.zero,along);const width=Math.min(T.detail.brickWidth,length-start);if(width<=T.math.zero)continue;const point=wallPoint(axis,start,z);if(!tileVisible(painter.camera,point.x,point.y))continue;const noise=textureNoise(along,z);const color=D.walls.brickColors[Math.floor(noise*D.walls.brickColors.length)]??P.brick;wallQuad(painter,axis,start,z,width-T.detail.mortar,Math.min(T.detail.brickHeight,height-z)-T.detail.mortar,color,D.depth.brick);
  const margin=T.detail.mortar*T.math.two;worldLine(painter,[wallPoint(axis,start+margin,z+T.detail.brickHeight-margin),wallPoint(axis,start+width-margin,z+T.detail.brickHeight-margin)],P.brickLight,T.lines.wire,T.detail.floorWearOpacity,D.depth.brick);}}
}
function metalWall(painter:ScenePainter,axis:'x'|'y',length:number,height:number):void{
 wallQuad(painter,axis,T.math.zero,T.math.zero,length,height,P.steelFace,D.depth.walls);
 for(let along=T.math.zero;along<length;along+=D.walls.corrugationSpacing){worldLine(painter,[wallPoint(axis,along,T.math.zero),wallPoint(axis,along,height)],P.steelEdge,D.walls.corrugationWidth,T.math.one,D.depth.brick);worldLine(painter,[wallPoint(axis,along+D.walls.corrugationWidth,T.math.zero),wallPoint(axis,along+D.walls.corrugationWidth,height)],P.steelLight,T.lines.wire,T.math.half,D.depth.brick);}
}
function studioWall(painter:ScenePainter,axis:'x'|'y',length:number,height:number):void{
 wallQuad(painter,axis,T.math.zero,T.math.zero,length,height,P.plaster,D.depth.walls);
 wallQuad(painter,axis,T.math.zero,T.math.zero,length,D.walls.studioDadoHeight,P.woodEdge,D.depth.brick);
 for(let along=T.math.zero;along<length;along+=D.walls.studioPanelWidth){worldLine(painter,[wallPoint(axis,along,T.math.zero),wallPoint(axis,along,D.walls.studioDadoHeight)],P.grain,D.walls.studioJointWidth,T.math.one,D.depth.wallDetails);}
 worldLine(painter,[wallPoint(axis,T.math.zero,D.walls.studioDadoHeight),wallPoint(axis,length,D.walls.studioDadoHeight)],P.woodLight,T.lines.frame,T.math.one,D.depth.wallDetails);
}
function window(painter:ScenePainter,axis:'x'|'y',along:number,height:number):void{
 const bottom=T.detail.windowBottom;const width=T.detail.windowWidth;const paneHeight=Math.min(T.detail.windowHeight,height-bottom-D.window.frameWidth);
 const corners=[wallPoint(axis,along,bottom,D.window.recess),wallPoint(axis,along+width,bottom,D.window.recess),wallPoint(axis,along+width,bottom+paneHeight,D.window.recess),wallPoint(axis,along,bottom+paneHeight,D.window.recess)];
 const a=projectWorld(painter.camera,corners[T.math.three]!);const b=projectWorld(painter.camera,corners[T.math.one]!);
 worldPolygon(painter,corners,gradient(a,b,P.windowSky,P.window,P.windowDark),P.steelEdge,D.window.frameWidth,T.math.one,D.depth.window);
 for(let division=T.math.one;division<T.detail.windowPaneCount;division+=T.math.one){worldLine(painter,[wallPoint(axis,along+division/T.detail.windowPaneCount*width,bottom,D.window.recess),wallPoint(axis,along+division/T.detail.windowPaneCount*width,bottom+paneHeight,D.window.recess)],P.steel,D.window.paneWidth,T.math.one,D.depth.window);}
 worldLine(painter,[wallPoint(axis,along,bottom+paneHeight/T.math.two,D.window.recess),wallPoint(axis,along+width,bottom+paneHeight/T.math.two,D.window.recess)],P.steel,D.window.paneHeight,T.math.one,D.depth.window);
 const floorLight=axis==='x'?{x:D.window.lightReach/T.math.two,y:along+width/T.math.two,z:T.math.zero}:{x:along+width/T.math.two,y:D.window.lightReach/T.math.two,z:T.math.zero};
 const center=projectWorld(painter.camera,floorLight);ellipseOnFloor(painter,floorLight,T.light.warmPoolRadius,T.light.warmPoolRadius,{kind:'radial-gradient',center,radius:T.light.warmPoolRadius*painter.camera.scale,stops:[{offset:T.math.zero,color:P.amber},{offset:T.math.one,color:P.amberClear}]},T.light.warmPoolOpacity,D.depth.light);
 const beam=axis==='x'?[wallPoint(axis,along,D.window.shadeZ),wallPoint(axis,along+width,D.window.shadeZ),{x:D.window.lightReach,y:along+width+D.window.beamFan,z:T.math.zero},{x:D.window.lightReach,y:along-D.window.beamFan,z:T.math.zero}]:[wallPoint(axis,along,D.window.shadeZ),wallPoint(axis,along+width,D.window.shadeZ),{x:along+width+D.window.beamFan,y:D.window.lightReach,z:T.math.zero},{x:along-D.window.beamFan,y:D.window.lightReach,z:T.math.zero}];
 worldPolygon(painter,beam,P.amberBright,undefined,T.math.zero,T.light.beamOpacity,D.depth.light);
}
function banner(painter:ScenePainter,axis:'x'|'y',along:number):void{
 wallQuad(painter,axis,along,D.banner.z,D.banner.width,D.banner.height,P.cloth,D.depth.wallDetails);
 const center=along+D.banner.width/T.math.two;
 for(let light=T.math.zero;light<T.math.three;light+=T.math.one){sphere(painter,wallPoint(axis,center+(light-T.math.one)*D.banner.dotSpacing,D.banner.dotZ,D.banner.offsetX),D.banner.dotRadius,P.cream,D.depth.wallDetails+T.light.ambientDepth);}
 for(let line=T.math.zero;line<D.banner.label.length;line+=T.math.one){const position=projectWorld(painter.camera,wallPoint(axis,center,D.banner.labelZs[line]!,D.banner.offsetX));addCommand(painter,{kind:'text',position,text:D.banner.label[line]!,fontSize:D.banner.fontSize*painter.camera.scale,weight:'800',fill:P.cream,align:'center',rotation:axis==='x'?-Math.atan(painter.camera.floorSlope):Math.atan(painter.camera.floorSlope)},D.depth.wallDetails+T.light.ambientDepth);}
}
function plant(painter:ScenePainter,x:number,y:number):void{
 box(painter,{x:x-D.planter.potRadius,y:y-D.planter.potRadius,z:T.math.zero},D.planter.potRadius*T.math.two,D.planter.potRadius*T.math.two,D.planter.potHeight,D.woodColors);
 circlePlane(painter,{x,y,z:D.planter.potHeight},D.planter.potRadius,'z',P.foliageShade,P.potLight,T.lines.seam);
 for(let leaf=T.math.zero;leaf<T.detail.foliageLeaves;leaf+=T.math.one){const angle=leaf*D.planter.leafRotation;const radius=(T.math.half+textureNoise(leaf,x))*D.planter.leafWidth;const z=D.planter.potHeight+textureNoise(leaf,y)*D.planter.leafHeight;const root={x,y,z:D.planter.potHeight};const tip={x:x+Math.cos(angle)*D.planter.leafLength,y:y+Math.sin(angle)*D.planter.leafLength,z};tube(painter,root,tip,D.planter.stemWidth,P.foliageShade,P.foliageLight);
  const mid={x:(root.x+tip.x)/T.math.two,y:(root.y+tip.y)/T.math.two,z:(root.z+tip.z)/T.math.two+D.planter.leafBend};const left={x:mid.x+Math.cos(angle+T.math.quarterTurn)*radius,y:mid.y+Math.sin(angle+T.math.quarterTurn)*radius,z:mid.z};const right={x:mid.x-Math.cos(angle+T.math.quarterTurn)*radius,y:mid.y-Math.sin(angle+T.math.quarterTurn)*radius,z:mid.z};const points:WorldPoint[]=[];for(const [from,control,to] of [[root,left,tip],[tip,right,root]] as const){for(let step=T.math.zero;step<=T.math.curveSteps;step+=T.math.one){const u=step/T.math.curveSteps;const v=T.math.one-u;points.push({x:v*v*from.x+T.math.two*v*u*control.x+u*u*to.x,y:v*v*from.y+T.math.two*v*u*control.y+u*u*to.y,z:v*v*from.z+T.math.two*v*u*control.z+u*u*to.z});}}worldPolygon(painter,points,leaf%T.math.three===T.math.zero?P.foliageLight:P.foliage,P.foliageShade,T.lines.wire);worldLine(painter,[root,mid,tip],P.foliageLight,T.lines.wire,T.math.half);}
}
function lamp(painter:ScenePainter,x:number,y:number,height:number):void{
 const z=height-D.lamp.zBelowCap;worldLine(painter,[{x,y,z:height},{x,y,z:z+D.lamp.height}],P.steelEdge,D.lamp.wireWidth,T.math.one,D.depth.fixtures);
 const left=D.lamp.profile.map(pair=>({x:x-pair[T.math.zero]!,y,z:z+pair[T.math.one]!}));const right=D.lamp.profile.slice().reverse().map(pair=>({x:x+pair[T.math.zero]!,y,z:z+pair[T.math.one]!}));worldPolygon(painter,[...left,...right],P.steel,P.steelLight,T.lines.fine,T.math.one,D.depth.fixtures);
 circlePlane(painter,{x,y,z},D.lamp.innerRadius,'z',P.amberBright,P.amber,T.lines.fine,undefined,D.depth.fixtures+T.light.ambientDepth);
 const center=projectWorld(painter.camera,{x,y,z:T.math.zero});ellipseOnFloor(painter,{x,y,z:T.math.zero},T.light.warmPoolRadius,T.light.warmPoolRadius,{kind:'radial-gradient',center,radius:T.light.warmPoolRadius*painter.camera.scale,stops:[{offset:T.math.zero,color:P.amber},{offset:T.math.one,color:P.amberClear}]},D.lamp.poolOpacity,D.depth.light);
}

export function renderEnvironment(painter:ScenePainter,rung:LadderRung,build=false):void{
 const grid=floorGridSize(rung);const stage=S[rung];const height=stage.wallHeight;
 floorTiles(painter,rung,build);
 for(const axis of ['x','y'] as const){const length=axis==='x'?grid.height:grid.width;
  if(stage.wall==='corrugated'&&axis==='x')metalWall(painter,axis,length,height);else if(stage.wall==='studio')studioWall(painter,axis,length,height);else brickWall(painter,axis,length,height);
  for(let along=D.window.first;along+T.detail.windowWidth<length;along+=stage.windowStep)window(painter,axis,along,height);
  if(length>D.banner.first+D.banner.width)banner(painter,axis,D.banner.first);
  for(let along=T.math.zero;along<length;along+=stage.columnStep){const point=wallPoint(axis,along,T.math.zero);box(painter,{...point,x:point.x-D.walls.thickness/T.math.two,y:point.y-D.walls.thickness/T.math.two},D.walls.thickness,D.walls.thickness,height,D.steelColors);}
  const top=axis==='x'?{x:-D.walls.capWidth,y:T.math.zero,z:height}:{x:T.math.zero,y:-D.walls.capWidth,z:height};box(painter,top,axis==='x'?D.walls.capWidth:length,axis==='x'?length:D.walls.capWidth,D.walls.capHeight,D.steelColors);
 }
 if(rung==='warehouse'){for(let along=stage.beamStep;along<grid.height;along+=stage.beamStep){const top=height-D.walls.beamZOffset;worldLine(painter,[{x:T.math.zero,y:along,z:top},{x:grid.width,y:along,z:top}],P.steelLight,D.walls.trussWidth,T.math.one,D.depth.fixtures);worldLine(painter,[{x:T.math.zero,y:along,z:top-D.walls.trussHeight},{x:grid.width,y:along,z:top-D.walls.trussHeight}],P.steel,D.walls.trussWidth,T.math.one,D.depth.fixtures);for(let x=T.math.zero;x<grid.width;x+=stage.beamStep){worldLine(painter,[{x,y:along,z:top},{x:Math.min(grid.width,x+stage.beamStep/T.math.two),y:along,z:top-D.walls.trussHeight},{x:Math.min(grid.width,x+stage.beamStep),y:along,z:top}],P.steelLight,T.lines.frame,T.math.one,D.depth.fixtures);}}}
 for(let along=stage.lampStep/T.math.two;along<grid.width;along+=stage.lampStep)lamp(painter,along,T.math.one,height);
 for(const tuple of D.planter.positions){const x=tuple[T.math.zero]!;const y=tuple[T.math.one]!;if(x<grid.width&&y<grid.height)plant(painter,x,y);}
 const floorLogo=projectWorld(painter.camera,{x:grid.width-D.banner.width,y:grid.height-D.banner.width,z:T.math.zero});
 addCommand(painter,{kind:'text',position:floorLogo,text:'T W L',fontSize:D.banner.fontSize*painter.camera.scale,weight:'800',fill:P.floorMortar,align:'center',rotation:Math.atan(painter.camera.floorSlope),opacity:T.math.half},D.depth.texture);
}

export function sceneBackdrop(camera:SceneCamera):SceneCommand{return{kind:'polygon',points:[{x:T.math.zero,y:T.math.zero},{x:camera.viewport.width,y:T.math.zero},{x:camera.viewport.width,y:camera.viewport.height},{x:T.math.zero,y:camera.viewport.height}],fill:gradient({x:T.math.zero,y:T.math.zero},{x:camera.viewport.width,y:camera.viewport.height},P.backdrop,P.void,P.floorEdge)};}
