// Adapter invoking al007ex/moomoo-clone's original ObjectManager
// checkItemLocation() and GameObject.getScale() on authoritative V2 resources.
// This module does not change the original Apache-2.0 source in vendor/.
import { GameObject } from './vendor/al007ex/gameObject.js';
import { ObjectManager } from './vendor/al007ex/objectManager.js';
import { UTILS } from './vendor/al007ex/utils.js';
const TYPE=Object.freeze({tree:0,bush:1,stone:2,ore:3});
const nativeGetScale=new GameObject(0).getScale;
export function referenceNaturalPlacementClear(resources,{x,y,scale,itemId,size}){
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(scale)||
     scale<=0||!Number.isFinite(size)||size<=0)return false;
  const view=[];
  for(const o of resources.values()){
    const type=Number.isSafeInteger(o.type)?o.type:TYPE[o.kind];
    if(!Number.isFinite(o.x)||!Number.isFinite(o.y)||
       !Number.isFinite(o.scale)||o.scale<=0||type===undefined)continue;
    view.push({active:true,x:o.x,y:o.y,scale:o.scale,type,
      isItem:false,colDiv:1,getScale:nativeGetScale});
  }
  const manager=new ObjectManager(GameObject,view,UTILS,
    {mapScale:size,riverWidth:724,colGrid:7},[],null);
  // V2 validates its broader river no-build boundary separately.
  return manager.checkItemLocation(x,y,scale,1,itemId,true,null);
}
