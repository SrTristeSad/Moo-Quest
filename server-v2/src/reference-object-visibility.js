// Adapted V2 owner identity to the original Apache-2.0
// GameObject.visibleToPlayer() implementation, without editing vendor code.
import {GameObject} from './vendor/al007ex/gameObject.js';
const upstreamVisible=new GameObject(0).visibleToPlayer;
export function referenceObjectVisibleToPlayer(obj,viewer,players){
  if(!obj||!viewer)return true; // server/admin internal world view
  if(obj.id!==15||obj.hidden===false)return true;
  const owner=[...players.values()].find(p=>p.sid===obj.owner);
  // Detached owners are not trusted to expose hidden traps to strangers.
  return upstreamVisible.call({hideFromEnemy:true,owner:owner||null},viewer);
}
