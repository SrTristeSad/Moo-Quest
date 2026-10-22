// Player-to-player contact uses the original Apache-2.0
// ObjectManager.checkCollision() on short-lived V2 player projections.
// Owner, PVP damage, input, and persistence remain server-authoritative.
import {ObjectManager} from './vendor/al007ex/objectManager.js';
import {GameObject} from './vendor/al007ex/gameObject.js';
import {UTILS} from './vendor/al007ex/utils.js';

const COLLIDER=new ObjectManager(GameObject,[],UTILS,
  {mapScale:14400,colGrid:7,riverWidth:724},[],null);
const RADIUS=35;

export function resolveReferencePlayerPairs(players,canOccupy=()=>true){
  const alive=[...players.values()].filter(p=>p.hp>0&&
    Number.isFinite(p.x)&&Number.isFinite(p.y));
  let collisions=0;
  // The reference resolves pairs once per update in player-roster order.
  for(let i=0;i<alive.length;i++)for(let j=i+1;j<alive.length;j++){
    const first=alive[i],second=alive[j];
    const dx=first.x-second.x,dy=first.y-second.y;
    const separation=Math.hypot(dx,dy);
    if(separation>RADIUS*2)continue;
    const a={x:first.x,y:first.y,scale:RADIUS,isPlayer:true};
    const b={x:second.x,y:second.y,scale:RADIUS,isPlayer:true};
    if(!COLLIDER.checkCollision(a,b,1))continue;
    collisions++;
    const okA=canOccupy(first,a.x,a.y);
    const okB=canOccupy(second,b.x,b.y);
    if(okA&&okB){
      first.x=a.x;first.y=a.y;second.x=b.x;second.y=b.y;
      continue;
    }
    // The reference can push a character outside a wall or map. When one
    // member is blocked by static geometry, put the entire displacement on
    // the other if its new position is valid, otherwise retain the safe pair.
    const angle=separation>1e-8?Math.atan2(dy,dx):0;
    const step=Math.max(0,RADIUS*2-separation);
    const sx=Math.cos(angle)*step,sy=Math.sin(angle)*step;
    if(!okA&&canOccupy(second,second.x-sx,second.y-sy)){
      second.x-=sx;second.y-=sy;
    }else if(!okB&&canOccupy(first,first.x+sx,first.y+sy)){
      first.x+=sx;first.y+=sy;
    }
  }
  return collisions;
}
