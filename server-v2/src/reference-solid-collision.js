// V2 collision bridge: invokes the original upstream ObjectManager
// checkCollision() and GameObject.getScale() for authoritative solid objects.
// This adapter deliberately excludes enemy damage, poison, trap triggers,
// teleports and healing: World.tick owns all these gameplay events.
import {ObjectManager} from './vendor/al007ex/objectManager.js';
import {GameObject} from './vendor/al007ex/gameObject.js';
import {UTILS} from './vendor/al007ex/utils.js';

const WORLD_SCALE=14400;
const PLAYER_SCALE=35;
const OBJECT_TYPES=Object.freeze({tree:0,bush:1,stone:2,ore:3});
// Original shared item catalogue (Apache-2.0 reference), IDs 15,16,18-22
// are explicitly ignoreCollision; all other V2 building types are solid.
const NON_SOLID=new Set([15,16,18,19,20,21,22]);
const COLLISION_DIV=Object.freeze({14:.5});
const manager=new ObjectManager(GameObject,[],UTILS,
  {mapScale:WORLD_SCALE,colGrid:7,riverWidth:724},[],null);
const getScale=new GameObject(0).getScale;

function asOriginal(obj,isItem){
  const type=Number.isSafeInteger(obj.type)?obj.type:OBJECT_TYPES[obj.kind];
  if(type===undefined||!Number.isFinite(obj.x)||!Number.isFinite(obj.y)||
    !Number.isFinite(obj.scale)||obj.scale<=0)return null;
  return {
    active:true,x:obj.x,y:obj.y,type,scale:obj.scale,
    isItem,colDiv:isItem?(COLLISION_DIV[obj.id]||1):(obj.colDiv||1),
    ignoreCollision:false,getScale
  };
}
export function upstreamSolidRadius(obj,building=false){
  const original=asOriginal(obj,building);
  return original?original.getScale():0;
}
// Preserve V2's exit-from-overlap behavior for restored player positions:
// never force a player back inside a solid resource when already escaping.
export function resolveSolidContact(player,x,y,resources,structures,raisedOrigin=null){
  if(!Number.isFinite(x)||!Number.isFinite(y))return null;
  const probe={x,y,scale:PLAYER_SCALE,xVel:player.motionX||0,
    yVel:player.motionY||0,isPlayer:true};
  let contacts=0;
  for(const [source,isItem] of [[resources,false],[structures,true]]){
    for(const obj of source.values()){
      if(isItem&&NON_SOLID.has(obj.id))continue;
      // The original V2 raised-platform mechanic allows stepping over
      // nearby walls (IDs 3..5) only while standing near that platform.
      if(isItem&&raisedOrigin&&[3,4,5].includes(obj.id)&&
        Math.hypot(x-raisedOrigin.x,y-raisedOrigin.y)<200)continue;
      const solid=asOriginal(obj,isItem);
      if(!solid)continue;
      const radius=PLAYER_SCALE+solid.getScale();
      const oldDist=Math.hypot(player.x-solid.x,player.y-solid.y);
      const dist=Math.hypot(probe.x-solid.x,probe.y-solid.y);
      // Ignore pre-existing penetrations (e.g., data restored from a save)
      // and only resolve a new approach to the boundary.
      if(oldDist<radius-0.0001||dist>=radius||dist>=oldDist-0.0001)continue;
      if(manager.checkCollision(probe,solid,1))contacts++;
    }
  }
  return {x:probe.x,y:probe.y,motionX:probe.xVel,motionY:probe.yVel,contacts};
}

export function originalStaticSpotClear(player,x,y,resources,structures,raisedOrigin=null){
  if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  for(const [source,isItem] of [[resources,false],[structures,true]]){
    for(const obj of source.values()){
      if(isItem&&NON_SOLID.has(obj.id))continue;
      if(isItem&&raisedOrigin&&[3,4,5].includes(obj.id)&&
        Math.hypot(x-raisedOrigin.x,y-raisedOrigin.y)<200)continue;
      const collider=asOriginal(obj,isItem);
      if(!collider)continue;
      const min=PLAYER_SCALE+collider.getScale();
      const newDist=Math.hypot(x-obj.x,y-obj.y);
      const originalDist=Math.hypot(player.x-obj.x,player.y-obj.y);
      if(newDist<min-0.0001&&newDist<originalDist-0.0001)return false;
    }
  }
  return true;
}
