import type { LadderRung } from '../ladder';
import { SCENE_PALETTE as P } from './scenePalette';
export const ENVIRONMENT_STAGES:Readonly<Record<LadderRung,{readonly wallHeight:number;readonly wall:string;readonly floor:readonly string[];readonly windowStep:number;readonly columnStep:number;readonly beamStep:number;readonly lampStep:number;readonly floorStripe:boolean}>>=Object.freeze({
 garage:{wallHeight:3.15,wall:'brick',floor:[P.floorDark,P.floor,P.floorLight,P.floorWarm],windowStep:5.2,columnStep:4.1,beamStep:4.0,lampStep:4.4,floorStripe:false},
 'storage-unit':{wallHeight:3.35,wall:'corrugated',floor:[P.floorDark,P.floor,P.floorLight,P.floor],windowStep:7.2,columnStep:4.6,beamStep:4.6,lampStep:5.1,floorStripe:true},
 'strip-mall-unit':{wallHeight:3.7,wall:'studio',floor:[P.floorDark,P.floor,P.floorLight,P.floorWarm],windowStep:4.8,columnStep:5.2,beamStep:5.2,lampStep:5.4,floorStripe:false},
 warehouse:{wallHeight:4.8,wall:'brick',floor:[P.floorDark,P.floor,P.floorLight,P.floor],windowStep:6.7,columnStep:5.8,beamStep:6.8,lampStep:6.8,floorStripe:true},
});
export const ENVIRONMENT_GEOMETRY=Object.freeze({
 depth:{floor:-3000,texture:-2999,light:-2500,walls:-2000,brick:-1999,window:-1998,wallDetails:-1997,fixtures:-1000},
 floor:{cullMargin:100,chipRadius:.012,chipOpacity:.35,baseZ:-.16,scratchX:.72,scratchY:.86,wearScale:.36,edgeWidth:.15,aisleStripe:.045,aisleInset:.12,markInterval:3},
 walls:{thickness:.13,baseboardHeight:.17,capHeight:.14,capWidth:.17,brickShadeValues:[.22,.51,.76],brickColors:[P.brickDark,P.brick,P.brickLight],corrugationSpacing:.15,corrugationWidth:.026,beamZOffset:.2,wallBoltZs:[.4,1.4,2.4],shelfZ:1.25,shelfDepth:.32,shelfThickness:.07,studioDadoHeight:.63,studioPanelWidth:.92,studioJointWidth:.023,trussHeight:.35,trussWidth:.095},
 window:{first:.8,paneWidth:.065,paneHeight:.05,frameWidth:.08,recess:.023,lightReach:4.7,beamFan:.54,lightInset:.1,sillDepth:.19,sillThickness:.09,sillZ:.77,shadeZ:.68},
 banner:{width:1.02,height:1.64,z:1.08,first:3.35,dotZ:2.27,dotRadius:.062,dotSpacing:.16,labelZs:[1.98,1.69,1.42],fontSize:.18,label:['THREE','WHITE','LIGHTS'],offsetX:.018},
 lamp:{width:.35,height:.2,shoulder:.14,neck:.07,profile:[[0,.2],[.07,.2],[.09,.17],[.12,.12],[.19,.05],[.3,0],[.35,0]],zBelowCap:.36,wireWidth:.017,innerRadius:.25,poolOpacity:.19},
 planter:{positions:[[-.28,1.0],[-.25,4.8],[1.8,-.28],[5.9,-.28]],potRadius:.2,potHeight:.42,potBottom:.16,leafHeight:.83,leafWidth:.21,stemWidth:.013,leafLength:.44,leafBend:.14,leafRotation:2.39,leafTiers:3},
 roomDetail:{posterWidth:.65,posterHeight:.88,posterZ:1.32,posterText:['STRONGER','PEOPLE','BRIGHTER','DAYS'],posterFont:.105,posterGap:.16,crateWidth:.52,crateHeight:.61,crateDepth:.46,crateZ:.01,crateSlats:4,shelfItems:4,bottleRadius:.055,bottleHeight:.23,shelfPlantX:.26},
 steelColors:{top:P.steelLight,front:P.steelFace,side:P.steel,edge:P.steelEdge},woodColors:{top:P.woodLight,front:P.wood,side:P.woodEdge,edge:P.grain},
});
