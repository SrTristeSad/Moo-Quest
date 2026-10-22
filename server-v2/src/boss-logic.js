// Authoritative Crab King attack cycle. Rendering is delegated to Lua.
import { secretDistance } from './vendor/al007ex/effects.js';
const pools=[[-2500,7200,1150],[-3300,6750,750],[-3200,7750,700],
  [-1700,6900,600],[-1800,7550,600]];
const cfg={mapScale:14400,secretPool:{gorgeX0:-1500,gorgeHalf:520,
  pool:pools,waterfall:{x:-3860,y:7250,half:210}}};
const mult={1:1.5,2:.8,3:1.5,4:1.2},knock={1:1.2,2:.6,3:1.4,4:.9};
export function secretWalkable(x,y,size=14400){
  if(x>=24)return true;
  if(x>=0)return Math.abs(y-size/2)<=485;
  return size===14400&&x>=-4500&&
    secretDistance(cfg,Math.min(x+35,-1),y)<=0;
}
function segmentDistance(px,py,x,y,x2,y2){
  const dx=x2-x,dy=y2-y,len=dx*dx+dy*dy;
  const t=len?Math.max(0,Math.min(1,((px-x)*dx+(py-y)*dy)/len)):0;
  return Math.hypot(px-x-t*dx,py-y-t*dy);
}
function emit(world,attacks,duration){
  for(const a of attacks)world.events.push({kind:'boss_telegraph',
    effectKind:a.kind,x:Math.round(a.x),y:Math.round(a.y),
    radius:Math.round(a.r),duration,
    ...(a.x2===undefined?{}:{x2:Math.round(a.x2),y2:Math.round(a.y2)})});
}
function strike(world,boss,attacks,now){
  for(const a of attacks)for(const p of world.players.values()){
    if(p.hp<=0||p.x>=0)continue;
    const distance=a.kind===4?
      segmentDistance(p.x,p.y,a.x,a.y,a.x2,a.y2):
      Math.hypot(p.x-a.x,p.y-a.y);
    if(distance>a.r+35)continue;
    const dir=a.kind===4?Math.atan2(a.y2-a.y,a.x2-a.x):
      Math.atan2(p.y-a.y,p.x-a.x);
    const damage=world.protectedDamage(p,Math.round(boss.damage*(mult[a.kind]||1)),
      boss.x,boss.y);
    p.hp=Math.max(0,p.hp-damage);
    p.motionX=(p.motionX||0)+1000*knock[a.kind]*Math.cos(dir);
    p.motionY=(p.motionY||0)+1000*knock[a.kind]*Math.sin(dir);
    world.events.push({kind:'animal_attack',sid:boss.sid,to:p.id,
      hp:p.hp,damage,x:p.x,y:p.y});
    if(p.hp===0){
      p.deadUntil=now+3000;p.vx=0;p.vy=0;p.motionX=0;p.motionY=0;
      p.poison=null;p.regen=null;
      world.events.push({kind:'death',id:p.id});
    }
  }
}
export function tickCrabKing(world,boss,now,dt){
  if(boss.state!==0&&now>=boss.stateUntil){
    if(boss.state===1){boss.state=2;boss.stateUntil=now+2500;}
    else if(boss.state===2){
      boss.state=3;boss.stateUntil=now+1650;
      emit(world,[{kind:1,x:boss.x,y:boss.y,r:boss.scale+220}],1650);
    }else if(boss.state===3){
      boss.state=0;boss.stateUntil=0;
      // Do not begin a new telegraphed move on the same tick as surfacing.
      boss.bossCooldownAt=Math.max(boss.bossCooldownAt||0,now+1000);
      strike(world,boss,[{kind:1,x:boss.x,y:boss.y,r:boss.scale+220}],now);
    }
  }
  if(boss.bossAttack){
    if(now>=boss.bossAttack.until){
      strike(world,boss,boss.bossAttack.strikes,now);
      world.events.push({kind:'boss_attack',sid:boss.sid});
      boss.bossAttack=null;
    }
    return;
  }
  const raiders=[...world.players.values()].filter(p=>p.hp>0&&p.x<0&&
    Math.hypot(p.x-boss.x,p.y-boss.y)<=boss.viewRange)
    .sort((a,b)=>Math.hypot(a.x-boss.x,a.y-boss.y)-
      Math.hypot(b.x-boss.x,b.y-boss.y));
  const target=raiders[0];
  if(!target)return;
  if(boss.state===2){
    const dx=target.x-boss.x,dy=target.y-boss.y,dist=Math.hypot(dx,dy);
    if(dist>120){
      const d=Math.min(dist,boss.speed*3.2*dt);
      const x=boss.x+dx/dist*d,y=boss.y+dy/dist*d;
      if(x<-boss.scale/2&&secretDistance(cfg,x+boss.scale/2,y)<=0){
        boss.x=x;boss.y=y;boss.dir=Math.atan2(dy,dx);
      }
    }
    return;
  }
  if(boss.state!==0||now<(boss.bossCooldownAt||0))return;
  const hp=Math.max(0,Math.min(1,boss.health/boss.maxHealth));
  boss.bossCooldownAt=now+Math.round((2000+world.animalRandom()*1400)*(.6+.4*hp));
  const r=world.animalRandom();
  if(r<.15){boss.state=1;boss.stateUntil=now+700;return;}
  let duration=1150,attacks=[];
  if(r<.45&&Math.hypot(target.x-boss.x,target.y-boss.y)<boss.scale+420){
    duration=1300;attacks=[{kind:3,x:boss.x,y:boss.y,r:boss.scale+260}];
  }else if(r>=.45&&r<.75){
    duration=1600;
    const fits=(x,y)=>pools.some(([cx,cy,rad])=>
      Math.hypot(x-cx,y-cy)<=rad-66);
    for(const p of raiders)if(attacks.length<26&&fits(p.x,p.y)&&
      attacks.every(s=>Math.hypot(s.x-p.x,s.y-p.y)>264))
      attacks.push({kind:2,x:p.x,y:p.y,r:110});
    for(let n=0;n<400&&attacks.length<26;n++){
      const pool=pools[Math.floor(world.animalRandom()*pools.length)];
      const dir=world.animalRandom()*Math.PI*2;
      const rad=Math.sqrt(world.animalRandom())*pool[2];
      const x=pool[0]+Math.cos(dir)*rad,y=pool[1]+Math.sin(dir)*rad;
      if(fits(x,y)&&attacks.every(s=>Math.hypot(s.x-x,s.y-y)>264))
        attacks.push({kind:2,x,y,r:110});
    }
  }else{
    for(const p of raiders.slice(0,3)){
      const dir=Math.atan2(p.y-boss.y,p.x-boss.x);
      const len=Math.min(1800,Math.hypot(p.x-boss.x,p.y-boss.y)+600);
      attacks.push({kind:4,x:boss.x,y:boss.y,r:130,
        x2:boss.x+Math.cos(dir)*len,y2:boss.y+Math.sin(dir)*len});
    }
    if(attacks.length)boss.dir=Math.atan2(attacks[0].y2-boss.y,
      attacks[0].x2-boss.x);
  }
  if(!attacks.length)return;
  boss.bossAttack={until:now+duration,strikes:attacks};
  emit(world,attacks,duration);
}
