// First-party authoritative survival world. No copyrighted artwork, NPCs,
// map-editor or imports from the legacy game engine. Numeric packet records
// expose only the game state required by the existing Lua renderer.
import { randomUUID, randomInt } from 'node:crypto';
import { HATS, ACCESSORIES, FREE_HATS, gearEffects } from './store.js';

const TYPE={tree:0,bush:1,stone:2,ore:3};
// These definitions are independent gameplay rules; numeric IDs serve as
// presentation contracts with the installed LÖVE inventory, not imported JS.
const RECIPES={
  3:{cost:{wood:10},scale:50,hp:350,group:1,limit:30},
  4:{cost:{stone:25},scale:50,hp:800,group:1,limit:30},
  5:{cost:{stone:35},scale:52,hp:1500,group:1,limit:30},
  6:{cost:{wood:20,stone:5},scale:49,hp:300,group:2,limit:15},
  7:{cost:{wood:30,stone:10},scale:52,hp:400,group:2,limit:15},
  8:{cost:{wood:35,stone:15},scale:52,hp:600,group:2,limit:15,
    spikeDamage:30,poison:{damage:5,seconds:6}},
  9:{cost:{wood:30,stone:20},scale:52,hp:500,group:2,limit:15,spikeDamage:45},
  10:{cost:{wood:50,stone:10},scale:45,hp:350,group:3,limit:20,pps:1},
  11:{cost:{wood:60,stone:20},scale:47,hp:450,group:3,limit:20,pps:1.5},
  12:{cost:{wood:100,stone:50},scale:47,hp:750,group:3,limit:20,pps:2},
  // Server-controlled placed farming nodes: only an actual hit yields wood/stone.
  13:{cost:{wood:20,stone:100},scale:65,hp:350,group:4,limit:1,harvest:'stone'},
  14:{cost:{wood:150},scale:110,hp:350,group:11,limit:2,harvest:'wood'},
  // No map editing or NPC support: these exist only when players construct.
  15:{cost:{wood:30,stone:30},scale:50,hp:500,group:5,limit:5,pit:true},
  16:{cost:{stone:20,wood:5},scale:45,hp:150,group:6,limit:12,boost:1.5},
  19:{cost:{wood:30,food:10},scale:45,hp:400,group:9,limit:4,heal:10},
  21:{cost:{wood:30,stone:25},scale:45,hp:400,group:12,limit:3,blocker:300},
  20:{cost:{wood:100,stone:100},scale:45,hp:400,group:10,limit:1,spawnPoint:true},
  22:{cost:{wood:60,stone:60},scale:45,hp:200,group:13,limit:2,teleport:true},
  // Player-built automatic defense. Static only: no NPC or editable map.
  17:{cost:{wood:200,stone:150},scale:43,hp:800,group:7,limit:2,turret:true},
  18:{cost:{wood:20},scale:43,hp:300,group:8,limit:12,platform:true}
};
const FOOD={0:{cost:10,heal:20},1:{cost:15,heal:40},
  2:{cost:25,heal:30,regen:10,seconds:5}};
const WEAPONS={0:{damage:15,reach:85,cooldown:500},
  1:{damage:23,reach:95,cooldown:550,gather:2},
  2:{damage:35,reach:100,cooldown:550,gather:4},
  3:{damage:30,reach:115,cooldown:650},
  4:{damage:40,reach:125,cooldown:650},
  5:{damage:37,reach:150,cooldown:750},6:{damage:16,reach:120,cooldown:450},
  7:{damage:12,reach:75,cooldown:250},8:{damage:8,reach:85,cooldown:500},
  // Ranged weapons use independently designed Node mechanics. Projectile
  // indices 0/2/3/5 are the LÖVE renderer's existing visual contract.
  // Speed is world units per millisecond, matching Lua's X packet display.
  9:{damage:25,cooldown:600,projectile:0,speed:1.6,range:1000,ammo:{wood:4}},
  10:{damage:10,reach:85,cooldown:650,structureDamage:7.5},
  // Selecting this defensive item never falls back to an offensive hammer.
  11:{damage:0,reach:0,cooldown:300,shield:0.35},
  14:{damage:0,reach:125,cooldown:750,steal:250},
  12:{damage:35,cooldown:700,projectile:2,speed:2.5,range:1200,ammo:{wood:5}},
  13:{damage:30,cooldown:300,projectile:3,speed:2.0,range:1200,ammo:{wood:10}},
  15:{damage:50,cooldown:1500,projectile:5,speed:3.6,range:1400,ammo:{stone:10}}
};
// Lua sends weapon index = numeric ID, item upgrade index = 16+item ID.
const UPGRADES=new Map([
  [1,{kind:'weapon',id:1,age:2}], [3,{kind:'weapon',id:3,age:2}],
  [5,{kind:'weapon',id:5,age:2}], [6,{kind:'weapon',id:6,age:2}],
  [7,{kind:'weapon',id:7,age:2}], [8,{kind:'weapon',id:8,age:2}],
  [17,{kind:'item',id:1,age:3}], [20,{kind:'item',id:4,age:3}],
  [31,{kind:'item',id:15,age:4}], [32,{kind:'item',id:16,age:4}],
  [23,{kind:'item',id:7,age:5}], [27,{kind:'item',id:11,age:5}],
  [29,{kind:'item',id:13,age:5}], [30,{kind:'item',id:14,age:5}],
  [9,{kind:'weapon',id:9,age:6}], [10,{kind:'weapon',id:10,age:6}],
  [11,{kind:'weapon',id:11,age:6}], [14,{kind:'weapon',id:14,age:6}],
  [2,{kind:'weapon',id:2,age:8,pre:1}], [4,{kind:'weapon',id:4,age:8,pre:3}],
  [12,{kind:'weapon',id:12,age:8,pre:9}],
  // Index for the Lua item upgrade = number of weapon IDs (16) + item ID.
  [18,{kind:'item',id:2,age:7}],
  [21,{kind:'item',id:5,age:7,pre:4}],
  [33,{kind:'item',id:17,age:7}], [34,{kind:'item',id:18,age:7}],
  [35,{kind:'item',id:19,age:7}],
  [37,{kind:'item',id:21,age:7}], [38,{kind:'item',id:22,age:7}],
  [28,{kind:'item',id:12,age:8,pre:11}],
  [24,{kind:'item',id:8,age:9,pre:7}],
  [25,{kind:'item',id:9,age:9,pre:7}],
  [36,{kind:'item',id:20,age:9}],
  [13,{kind:'weapon',id:13,age:9,pre:12}],
  [15,{kind:'weapon',id:15,age:9,pre:12}]
]);
const LEVEL_XP=age=>35+age*25;
const RESOURCE_RETURN_MS=30000;
const RESOURCE_DAMAGE=25;
const finite=Number.isFinite;
function boundedName(s){return String(s||'Visitante').replace(/[^\p{L}\p{N}_ -]/gu,'').slice(0,15)||'Visitante';}
const round=n=>Math.round(n*10)/10;
function randomPlacement(size,rng,kind){
  for(let i=0;i<100;i++) {
    const x=250+Math.floor(rng()*(size-500));
    const y=250+Math.floor(rng()*(size-500));
    if(kind!=='bush'&&Math.abs(y-size/2)<500)continue;
    return {x,y};
  }
  return {x:300,y:300};
}
function seededRandom(seed){let state=seed>>>0;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/0x100000000;};}
// Closest fraction along a swept segment at which a circle is hit; unlike
// end-point tests this cannot skip a target when an arrow travels quickly.
function segmentHit(x1,y1,x2,y2,cx,cy,radius){
  const dx=x2-x1,dy=y2-y1,fx=x1-cx,fy=y1-cy;
  const length=dx*dx+dy*dy;
  if(length===0)return fx*fx+fy*fy<=radius*radius?0:null;
  const dot=fx*dx+fy*dy;
  const discriminant=dot*dot-length*(fx*fx+fy*fy-radius*radius);
  if(discriminant<0)return null;
  const entry=(-dot-Math.sqrt(discriminant))/length;
  if(entry>=0&&entry<=1)return entry;
  return fx*fx+fy*fy<=radius*radius?0:null;
}

export class World {
  constructor({ size=14400,maxPlayers=60,now=()=>Date.now(),seed=24681357 }={}) {
    this.size=size;this.maxPlayers=maxPlayers;this.now=now;
    this.players=new Map();this.events=[];this.tickNumber=0;
    this.resources=new Map();this.depleted=new Map();this.structures=new Map();this.tribes=new Map();
    this.reservedTribeTags=new Set();
    this.animals=new Map();this.animalRandom=seededRandom(seed^0xfedcba98);
    this.projectiles=new Map();this.nextProjectileSid=1;
    this.nextObjectSid=1;this.nextPlayerSid=0;
    const rng=seededRandom(seed);
    // Stable procedural resources, not an editable or NPC-driven map.
    for(const [kind,count,scale,health] of [
      ['tree',48,150,150],['bush',24,85,100],['stone',24,85,200],['ore',7,85,300]]) {
      for(let i=0;i<count;i++) {
        const {x,y}=randomPlacement(size,rng,kind);
        const sid=this.nextObjectSid++;
        this.resources.set(sid,{sid,kind,type:TYPE[kind],x,y,scale,hp:health,maxHp:health,owner:null});
      }
    }
    // Wildlife is part of the existing survival game; these are not NPCs,
    // quests or editable map actors. Combat/movement is authoritative.
    const templates=[
      {type:0,count:5,hp:130,speed:75,damage:0},
      {type:1,count:4,hp:155,speed:65,damage:0},
      {type:2,count:3,hp:280,speed:90,damage:12},
      {type:3,count:2,hp:370,speed:85,damage:18},
      {type:9,count:3,hp:190,speed:85,damage:10}
    ];
    let animalId=30000;
    for(const template of templates)for(let i=0;i<template.count;i++){
      const {x,y}=randomPlacement(size,rng,'animal');
      const sid=animalId++;
      this.animals.set(sid,{sid,index:template.type,x,y,homeX:x,homeY:y,
        dir:rng()*Math.PI*2,health:template.hp,maxHealth:template.hp,
        speed:template.speed,damage:template.damage,nextAttack:0,deadUntil:0,
        nameIndex:0,state:0});
    }
  }
  join(socket,name,profile=null,accountId=null){
    if(this.players.size>=this.maxPlayers)throw new Error('server_full');
    const used=new Set([...this.players.values()].map(p=>p.sid));
    let sid=0;while(used.has(sid))sid++;
    const p={id:randomUUID(),sid,name:boundedName(name),
      x:randomInt(180,this.size-180),y:randomInt(180,this.size-180),
      hp:100,maxHp:100,vx:0,vy:0,angle:0,skinColor:0,accountId,
      lastAttack:0,deadUntil:0,socket,ipHash:null,
      xp:0,age:1,upgradePoints:0,upgradeAge:2,maxXp:LEVEL_XP(1),
      native:false,team:null,hat:0,tail:0,
      ownedHats:new Set([0,...FREE_HATS]),ownedAccessories:new Set([0]),
      resources:{wood:0,stone:0,food:0,points:0,kills:0},
      inventory:{weapons:[0],items:[0,3,6,10]},weaponIndex:0,buildIndex:-1,score:0,
      rootedUntil:0,nextHealAt:0,nextTeleportAt:0,poison:null,regen:null,
      lastGearRegenAt:this.now(),raisedUntil:0,raisedOrigin:null,
       lastGeneratorAt:this.now(),generatorRemainder:0,deferredStructures:[]};
    this.players.set(p.id,p);
    if(profile)this.restoreProfile(p,profile);
    this.events.push({kind:'join',id:p.id,sid:p.sid,name:p.name});return p;
  }
  // Compact whitelisted snapshot. SQL never accepts state supplied by the
  // client. Combat stays live in RAM; only registered accounts get snapshots.
  persistentProfile(p){
    return {version:1,hp:p.hp,x:p.x,y:p.y,age:p.age,xp:p.xp,
      upgradePoints:p.upgradePoints,upgradeAge:p.upgradeAge,
      resources:{...p.resources},score:p.score,
      inventory:{weapons:[...p.inventory.weapons],items:[...p.inventory.items]},
      ownedHats:[...p.ownedHats],ownedAccessories:[...p.ownedAccessories],
      hat:p.hat,tail:p.tail,weaponIndex:p.weaponIndex,skinColor:p.skinColor,
      // Structures are saved only for an authenticated account; disconnected
      // structures disappear from the live world, then restore on login.
      structures:[
        ...[...this.structures.values()].filter(o=>o.owner===p.sid)
          .map(o=>({id:o.id,x:o.x,y:o.y,hp:o.hp})),
        ...(p.deferredStructures||[])
      ].slice(0,150)};
  }
  restoreProfile(p,data){
    if(!data||data.version!==1||typeof data!=='object')return;
    const number=(v,min,max,def)=>Number.isSafeInteger(v)&&v>=min&&v<=max?v:def;
    const ids=(values,allowed,max,required)=>[
      ...new Set([...(required||[]),
        ...(Array.isArray(values)?values.slice(0,max):[])
          .filter(n=>Number.isSafeInteger(n)&&allowed(n))])].slice(0,max);
    p.ownedHats=new Set(ids(data.ownedHats,n=>n===0||Object.hasOwn(HATS,n),100,[0,...FREE_HATS]));
    p.ownedAccessories=new Set(ids(data.ownedAccessories,
      n=>n===0||Object.hasOwn(ACCESSORIES,n),50,[0]));
    p.hat=p.ownedHats.has(data.hat)?data.hat:0;
    p.tail=p.ownedAccessories.has(data.tail)?data.tail:0;
    p.skinColor=number(data.skinColor,0,9,0);
    // A dead character cannot escape the normal death reset by logging out:
    // unlocked store cosmetics survive, survival-level progression does not.
    if(!Number.isFinite(data.hp)||data.hp<=0)return;
    p.hp=number(data.hp,1,p.maxHp,p.maxHp);
    p.age=number(data.age,1,20,1);
    p.maxXp=LEVEL_XP(p.age);
    p.xp=number(data.xp,0,p.maxXp-1,0);
    p.upgradePoints=number(data.upgradePoints,0,8,0);
    p.upgradeAge=number(data.upgradeAge,2,20,2);
    p.resources=Object.fromEntries(Object.keys(p.resources).map(key=>
      [key,number(data.resources?.[key],0,1_000_000_000,0)]));
    p.score=number(data.score,0,1_000_000_000,0);
    p.inventory.weapons=ids(data.inventory?.weapons,
      n=>Object.hasOwn(WEAPONS,n),16,[0]);
    p.inventory.items=ids(data.inventory?.items,
      n=>Object.hasOwn(FOOD,n)||Object.hasOwn(RECIPES,n),40,[0,3,6,10]);
    p.weaponIndex=p.inventory.weapons.includes(data.weaponIndex)?data.weaponIndex:0;
    const x=data.x,y=data.y;
    if(this.landingClear(x,y,p.sid)){p.x=x;p.y=y;}
    // All values below are server-generated snapshots, but still validate
    // them as potentially corrupted data before reintroducing collision.
    if(p.accountId&&Array.isArray(data.structures)){
      for(const saved of data.structures.slice(0,150)){
        if(!Number.isSafeInteger(saved?.id)||!Object.hasOwn(RECIPES,saved.id))continue;
        const recipe=RECIPES[saved.id];
        if(!Number.isFinite(saved.x)||!Number.isFinite(saved.y)||
          !Number.isSafeInteger(saved.hp)||saved.hp<1||saved.hp>recipe.hp)continue;
        const {x,y}=saved,scale=recipe.scale;
        if(x<scale||x>this.size-scale||y<scale||y>this.size-scale||
          Math.abs(y-this.size/2)<470)continue;
        const count=[...this.structures.values()].filter(o=>o.owner===p.sid&&
          RECIPES[o.id]?.group===recipe.group).length+
          p.deferredStructures.filter(o=>RECIPES[o.id]?.group===recipe.group).length;
        if(count>=recipe.limit)continue;
        const blocked=[...this.structures.values(),...this.resources.values()].some(o=>
          Math.hypot(x-o.x,y-o.y)<scale+(o.scale||50)*0.7)||
          [...this.players.values()].some(other=>other!==p&&other.hp>0&&
          Math.hypot(x-other.x,y-other.y)<scale+30);
        if(blocked){
          // Do not erase a purchased building merely because another player
          // or a respawned resource occupies its saved position.
          p.deferredStructures.push({id:saved.id,x,y,hp:saved.hp});
          continue;
        }
        const sid=this.nextObjectSid++;
        this.structures.set(sid,{sid,x,y,scale,type:4,id:saved.id,
          owner:p.sid,ownerAccountId:p.accountId,
          hp:saved.hp,maxHp:recipe.hp,createdAt:this.now(),nextFire:0});
      }
    }
  }
  leave(id){
    const p=this.players.get(id);if(!p)return;
    this.players.delete(id);
    if(p.team){
      const tribe=this.tribes.get(p.team);
      if(tribe){
        tribe.members.delete(id);
        if(tribe.persistent){
          if(tribe.owner===id)tribe.owner=null;
          if(!tribe.members.size)this.tribes.delete(p.team);
        }else if(!tribe.members.size)this.tribes.delete(p.team);
        else if(tribe.owner===id)tribe.owner=tribe.members.values().next().value;
      }
    }
    for(const [key,o] of this.structures)if(o.owner===p.sid){
      this.structures.delete(key);
      this.events.push({kind:'destroy',sid:o.sid,owner:o.owner,id:o.id});
    }
    this.events.push({kind:'leave',id:p.id,sid:p.sid});
  }
  input(id,value){
    const p=this.players.get(id);if(!p||p.hp<=0||!value||typeof value!=='object')return false;
    const dx=Number(value.dx),dy=Number(value.dy);
    if(!finite(dx)||!finite(dy)||Math.abs(dx)>1||Math.abs(dy)>1)return false;
    const size=Math.hypot(dx,dy);p.vx=size>1?dx/size:dx;p.vy=size>1?dy/size:dy;
    return true;
  }
  direction(id,angle){
    const p=this.players.get(id);if(!p||p.hp<=0)return false;
    if(angle==null){p.vx=0;p.vy=0;return true;}
    if(!finite(angle)||Math.abs(angle)>1000)return false;
    p.vx=Math.cos(angle);p.vy=Math.sin(angle);return true;
  }
  aim(id,angle){const p=this.players.get(id);if(!p||!finite(angle)||Math.abs(angle)>1000)return false;p.angle=angle;return true;}
  select(id,index,weapon){
    const p=this.players.get(id);if(!p||p.hp<=0||!Number.isSafeInteger(index))return false;
    if(weapon===true){if(!p.inventory.weapons.includes(index)||!Object.hasOwn(WEAPONS,index))return false;p.weaponIndex=index;p.buildIndex=-1;}
    else {if(!p.inventory.items.includes(index))return false;
      // Clicking the selected construction/food slot again returns to weapon.
      p.buildIndex=p.buildIndex===index?-1:index;
    }
    return true;
  }
  shop(id,action,itemId,accessory){
    const p=this.players.get(id);if(!p||p.hp<=0||!Number.isSafeInteger(itemId))return false;
    const prices=accessory?ACCESSORIES:HATS;
    const owned=accessory?p.ownedAccessories:p.ownedHats;
    if(action===1){
      if(!Object.hasOwn(prices,itemId)||owned.has(itemId)||p.resources.points<prices[itemId])return false;
      p.resources.points-=prices[itemId];owned.add(itemId);
      this.events.push({kind:'purchase',player:p.id,id:itemId,accessory:!!accessory});return true;
    }
    if(action===0&& (itemId===0||owned.has(itemId))){
      if(accessory)p.tail=itemId;else p.hat=itemId;
      this.events.push({kind:'equip',player:p.id,id:itemId,accessory:!!accessory});return true;
    }
    return false;
  }
  createTribe(id,name){
    const p=this.players.get(id);
    if(!p||p.team||typeof name!=='string'||!/^[A-Za-z0-9]{1,7}$/.test(name)||
      this.tribes.has(name)||this.reservedTribeTags.has(name))return false;
    this.tribes.set(name,{owner:id,members:new Set([id]),requests:new Set()});p.team=name;
    this.events.push({kind:'tribe_created',name,sid:p.sid});return true;
  }
  // A SQL-verified membership is reapplied to the ephemeral online roster.
  // Offline owners are never replaced or impersonated by random members.
  restoreClan(p,clan){
    if(!p?.accountId||!clan?.tag||!/^[A-Za-z0-9]{1,7}$/.test(clan.tag)||
      !clan.ownerAccountId||p.team)return false;
    let tribe=this.tribes.get(clan.tag);
    if(tribe&&(!tribe.persistent||
      tribe.ownerAccountId!==clan.ownerAccountId))return false;
    if(!tribe){
      tribe={owner:null,ownerAccountId:clan.ownerAccountId,persistent:true,
        members:new Set(),requests:new Set()};
      this.tribes.set(clan.tag,tribe);
      this.events.push({kind:'tribe_created',name:clan.tag,sid:null});
    }
    tribe.members.add(p.id);
    p.team=clan.tag;
    if(p.accountId===clan.ownerAccountId)tribe.owner=p.id;
    this.reservedTribeTags.add(clan.tag);
    return true;
  }
  disbandTribe(name){
    const tribe=this.tribes.get(name);
    if(!tribe?.persistent)return false;
    for(const id of tribe.members){
      const p=this.players.get(id);
      if(p)p.team=null;
    }
    this.tribes.delete(name);
    this.reservedTribeTags.delete(name);
    this.events.push({kind:'tribe_deleted',name});
    return true;
  }
  leaveTribe(id){
    const p=this.players.get(id);if(!p||!p.team)return false;
    const name=p.team,tribe=this.tribes.get(name);p.team=null;
    tribe?.members.delete(id);
    if(!tribe?.members.size){this.tribes.delete(name);this.events.push({kind:'tribe_deleted',name});}
    else if(tribe.owner===id)tribe.owner=tribe.members.values().next().value;
    this.events.push({kind:'tribe_left',name,sid:p.sid});return true;
  }
  requestTribe(id,name){
    const p=this.players.get(id),tribe=this.tribes.get(name);if(!p||p.team||!tribe)return false;
    tribe.requests.add(id);this.events.push({kind:'tribe_request',name,from:p.sid,to:tribe.owner});return true;
  }
  answerTribe(id,requestedSid,allow){
    const owner=this.players.get(id);const tribe=owner?.team&&this.tribes.get(owner.team);
    if(!tribe||tribe.owner!==id)return false;
    const p=[...this.players.values()].find(p=>p.sid===requestedSid);
    if(!p||!tribe.requests.delete(p.id))return false;
    if(allow&&!p.team){tribe.members.add(p.id);p.team=owner.team;this.events.push({kind:'tribe_joined',name:p.team,sid:p.sid});}
    return true;
  }
  structureCount(ownerSid,itemId){
    const group=RECIPES[itemId]?.group;
    if(group===undefined)return null;
    return {group,count:[...this.structures.values()].filter(o=>
      o.owner===ownerSid&&RECIPES[o.id]?.group===group).length};
  }
  place(id,itemId){
    const p=this.players.get(id),recipe=RECIPES[itemId];
    if(!p||p.hp<=0||!recipe||!p.inventory.items.includes(itemId)||p.buildIndex!==itemId)return false;
    if([...this.structures.values()].filter(o=>o.owner===p.sid&&RECIPES[o.id]?.group===recipe.group).length+
      (p.deferredStructures||[]).filter(o=>RECIPES[o.id]?.group===recipe.group).length>=recipe.limit)return false;
    if(Object.entries(recipe.cost).some(([k,n])=>p.resources[k]<n))return false;
    const x=p.x+Math.cos(p.angle)*95,y=p.y+Math.sin(p.angle)*95,scale=recipe.scale;
    if(x<scale||x>this.size-scale||y<scale||y>this.size-scale||Math.abs(y-this.size/2)<470)return false;
    for(const o of [...this.structures.values(),...this.resources.values()]){
      if(Math.hypot(x-o.x,y-o.y)<scale+(o.scale||50)*0.7)return false;
    }
    // Placement cannot trap a player or bypass a rival's building blocker.
    // The sapling has a large visual canopy but a narrow trunk collision.
    // Using its entire sprite radius made placement impossible at 95 units.
    const footprint=itemId===14?scale*0.5:scale;
    if([...this.players.values()].some(other=>other.hp>0&&
      Math.hypot(x-other.x,y-other.y)<footprint+30))return false;
    if([...this.structures.values()].some(block=>{
      const owner=[...this.players.values()].find(other=>other.sid===block.owner);
      return RECIPES[block.id]?.blocker &&
        block.owner!==p.sid && !(p.team&&owner?.team===p.team) &&
        Math.hypot(x-block.x,y-block.y)<RECIPES[block.id].blocker;
    }))return false;
    for(const [k,n] of Object.entries(recipe.cost))p.resources[k]-=n;
    const sid=this.nextObjectSid++;
    this.structures.set(sid,{sid,x,y,scale,type:4,id:itemId,owner:p.sid,
      ownerAccountId:p.accountId||null,
      hp:recipe.hp,maxHp:recipe.hp,createdAt:this.now(),nextFire:0});
    this.events.push({kind:'build',sid,owner:p.sid,id:itemId,x,y});return true;
  }
  consume(id,itemId){
    const p=this.players.get(id),food=FOOD[itemId];
    if(!p||p.hp<=0||!food||p.buildIndex!==itemId||
       !p.inventory.items.includes(itemId)||p.resources.food<food.cost||p.hp>=p.maxHp)return false;
    p.resources.food-=food.cost;
    const amount=Math.min(food.heal,p.maxHp-p.hp);
    p.hp+=amount;
    // A new serving refreshes the duration instead of stacking heal ticks.
    if(food.regen){
      const now=this.now();
      p.regen={nextAt:now+1000,until:now+food.seconds*1000,amount:food.regen};
    }
    this.events.push({kind:'heal',player:id,sid:p.sid,amount,hp:p.hp,x:p.x,y:p.y});
    return true;
  }
  awardXp(id,amount){
    const p=this.players.get(id);
    if(!p||p.hp<=0||!Number.isSafeInteger(amount)||amount<1)return false;
    p.xp+=amount;
    while(p.xp>=p.maxXp&&p.age<20){
      p.xp-=p.maxXp;p.age++;p.maxXp=LEVEL_XP(p.age);
      if([2,3,4,5,6,7,8,9].includes(p.age))p.upgradePoints++;
    }
    this.events.push({kind:'progress',player:id,xp:p.xp,maxXp:p.maxXp,age:p.age,
      points:p.upgradePoints,upgradeAge:p.upgradeAge});
    return true;
  }
  upgrade(id,index){
    const p=this.players.get(id),rule=UPGRADES.get(index);
    if(!p||p.hp<=0||!rule||p.upgradePoints<1||p.age<rule.age||p.upgradeAge!==rule.age)return false;
    const group=rule.kind==='weapon'?p.inventory.weapons:p.inventory.items;
    if(group.includes(rule.id)||rule.pre!==undefined&&!group.includes(rule.pre))return false;
    if(rule.kind==='weapon'&&!Object.hasOwn(WEAPONS,rule.id))return false;
    if(rule.kind==='item'&&!Object.hasOwn(RECIPES,rule.id)&&!Object.hasOwn(FOOD,rule.id))return false;
    // One selection per stage. Older paths remain available to players who
    // choose melee rather than ranged at age six.
    group.push(rule.id);p.upgradePoints--;
    p.upgradeAge=({2:3,3:4,4:5,5:6,6:7,7:8,8:9})[rule.age]??20;
    this.events.push({kind:'upgrade',player:id,equipmentKind:rule.kind,id:rule.id,
      points:p.upgradePoints,upgradeAge:p.upgradeAge});
    return true;
  }
  // Shield absorption applies only to frontal incoming damage while the
  // defensive equipment is selected. Client packets cannot set damage.
  protectedDamage(target,raw,sourceX,sourceY,kind='normal'){
    let amount=raw;
    const {hat,tail}=gearEffects(target);
    const shield=WEAPONS[target.weaponIndex]?.shield;
    if(shield&&Number.isFinite(sourceX)&&Number.isFinite(sourceY)){
      const direction=Math.atan2(sourceY-target.y,sourceX-target.x);
      if(Math.cos(direction-target.angle)>=0.25)
        amount=Math.max(0,Math.round(raw*(1-shield)));
    }
    amount*=hat.damageTaken??1;
    if(kind==='projectile')amount*=tail.projectileDamageTaken??1;
    return Math.max(0,Math.round(amount));
  }
  spawnProjectile({owner,ownerSid,team,x,y,dir,range,speed,damage,type,layer=0,
    sourceSid=null,ammo={}}){
    const sid=this.nextProjectileSid++;
    this.projectiles.set(sid,{sid,owner,ownerSid,team,x,y,dir,range,speed,damage,type,layer,sourceSid});
    this.events.push({kind:'projectile_spawn',sid,player:owner,x,y,dir,range,speed,type,layer,ammo});
    return sid;
  }
  attack(id){
    const p=this.players.get(id),time=this.now();
    if(!p||p.hp<=0)return false;
    // Never let an unsupported client-side weapon silently behave as a hammer.
    const weapon=WEAPONS[p.weaponIndex];
    if(!weapon)return false;
    const {hat,tail}=gearEffects(p);
    if(time-p.lastAttack<weapon.cooldown*(hat.attackSpeed??1))return false;
    if(p.buildIndex>=3){p.lastAttack=time;return this.place(id,p.buildIndex);}
    if(p.buildIndex>=0){p.lastAttack=time;return this.consume(id,p.buildIndex);}
    if(weapon.projectile!==undefined){
      const ammo=Object.fromEntries(Object.entries(weapon.ammo)
        .map(([k,v])=>[k,Math.max(1,Math.ceil(v*(hat.ammoCost??1)))]));
      if(!Object.entries(ammo).every(([k,v])=>p.resources[k]>=v))return false;
      for(const [k,v] of Object.entries(ammo))p.resources[k]-=v;
      p.lastAttack=time;
      const x=p.x+Math.cos(p.angle)*46,y=p.y+Math.sin(p.angle)*46;
      this.spawnProjectile({owner:p.id,ownerSid:p.sid,team:p.team,x,y,dir:p.angle,
        range:weapon.range*(hat.arrow??1),speed:weapon.speed*(hat.arrow??1),
        damage:Math.max(0,Math.round(weapon.damage*(hat.damageDone??1)*
          (tail.damageDone??1))),type:weapon.projectile,ammo});
      return true;
    }
    if(weapon.shield)return false; // Defensive selection cannot damage wildlife.
    p.lastAttack=time;
    let victim=null,distance=weapon.reach;
    for(const other of this.players.values()){
      if(other.id===p.id||other.hp<=0||other.team&&other.team===p.team||time<other.deadUntil)continue;
      const d=Math.hypot(other.x-p.x,other.y-p.y);
      const angle=Math.atan2(other.y-p.y,other.x-p.x);
      if(d<distance&&Math.cos(angle-p.angle)>=0.15){victim=other;distance=d;}
    }
    if(victim){
      const attackDamage=Math.max(0,Math.round(weapon.damage*(hat.damageDone??1)*
        (tail.damageDone??1)));
      const damage=this.protectedDamage(victim,attackDamage,p.x,p.y);
      victim.hp=Math.max(0,victim.hp-damage);
      if(weapon.steal){
        // A contact-only non-damaging tool: transfer existing resources rather
        // than minting any. No other player-selected resource count is trusted.
        let remaining=weapon.steal;
        for(const key of ['wood','stone','food','points']){
          const taken=Math.min(remaining,victim.resources[key]);
          if(taken>0){
            victim.resources[key]-=taken;p.resources[key]+=taken;
            this.events.push({kind:'steal',from:p.id,to:victim.id,key,amount:taken});
            remaining-=taken;
          }
          if(!remaining)break;
        }
      }
      this.events.push({kind:'hit',from:p.id,to:victim.id,damage,hp:victim.hp,x:victim.x,y:victim.y});
      if(victim.hp===0){victim.deadUntil=time+3000;victim.vx=0;victim.vy=0;p.resources.kills++;p.score+=100;this.events.push({kind:'death',id:victim.id,killer:p.id});this.awardXp(p.id,40);}
      return true;
    }
    // Server-owned wildlife combat. Only hit animals in the forward arc,
    // never accept animal identity, health or damage reported by the client.
    let animal=null,animalDistance=Math.max(weapon.reach,115);
    for(const a of this.animals.values()){
      if(a.health<=0)continue;
      const d=Math.hypot(a.x-p.x,a.y-p.y);
      if(d>=animalDistance)continue;
      const direction=Math.atan2(a.y-p.y,a.x-p.x);
      if(Math.cos(direction-p.angle)<0.15)continue;
      animal=a;animalDistance=d;
    }
    if(animal){
      const damage=Math.max(0,Math.round(weapon.damage*(hat.damageDone??1)*
        (tail.damageDone??1)));
      animal.health=Math.max(0,animal.health-damage);
      this.events.push({kind:'animal_hit',sid:animal.sid,from:p.id,x:animal.x,y:animal.y,damage});
      if(!animal.health){
        animal.deadUntil=time+15000;
        p.resources.food+=30;p.resources.points+=20;p.score+=20;
        this.events.push({kind:'animal_down',sid:animal.sid,player:p.id});
        this.awardXp(p.id,30);
      }
      return true;
    }
    // Planted mine and sapling yields come from real forward-arc attacks.
    let farm=null,farmDistance=205;
    for(const obj of this.structures.values()){
      if(!RECIPES[obj.id]?.harvest)continue;
      const farmOwner=[...this.players.values()].find(other=>other.sid===obj.owner);
      if(obj.owner!==p.sid&&!(p.team&&farmOwner?.team===p.team))continue;
      const d=Math.hypot(obj.x-p.x,obj.y-p.y);
      if(d>=farmDistance)continue;
      const direction=Math.atan2(obj.y-p.y,obj.x-p.x);
      if(Math.cos(direction-p.angle)<0.25)continue;
      farm=obj;farmDistance=d;
    }
    if(farm){
      const key=RECIPES[farm.id].harvest;
      const amount=2*(weapon.gather??1)+(key==='wood'?(tail.extraWood??0):(tail.extraStone??0));
      const points=1+(hat.extraGold??0);
      p.resources[key]+=amount;p.resources.points+=points;p.score+=points;
      this.events.push({kind:'gather',sid:farm.sid,player:p.id,key,amount,points});
      this.awardXp(p.id,8);
      return true;
    }
    // Buildings belong to the world, not the request. Friendly players never
    // strike structures built by their own tribe; the server measures both
    // collision and damage and broadcasts destruction to every client.
    let targetStructure=null,structureDistance=Math.max(weapon.reach,85)+25;
    for(const obj of this.structures.values()){
      const owner=[...this.players.values()].find(other=>other.sid===obj.owner);
      if(obj.owner===p.sid || (p.team && owner?.team===p.team))continue;
      const d=Math.hypot(obj.x-p.x,obj.y-p.y);
      if(d>=structureDistance+obj.scale*0.35)continue;
      const direction=Math.atan2(obj.y-p.y,obj.x-p.x);
      if(Math.cos(direction-p.angle)<0.15)continue;
      targetStructure=obj;structureDistance=d;
    }
    if(targetStructure){
      const damage=Math.max(0,Math.round(weapon.damage*(hat.damageDone??1)*
        (tail.damageDone??1)*(hat.structureDamage??1)*(weapon.structureDamage??1)));
      targetStructure.hp=Math.max(0,targetStructure.hp-damage);
      this.events.push({kind:'structure_hit',sid:targetStructure.sid,dir:p.angle,
        x:targetStructure.x,y:targetStructure.y,damage});
      if(targetStructure.hp===0){
        this.structures.delete(targetStructure.sid);
        this.events.push({kind:'destroy',sid:targetStructure.sid,
          owner:targetStructure.owner,id:targetStructure.id});
      }
      return true;
    }
    // Resource collection has a wide harvest arc independent of client
    // coordinates; players cannot claim the amount or manipulate node health.
    let resource=null,best=205;
    for(const obj of this.resources.values()){
      // Picked bushes remain as fruitless bushes until server-side regrowth.
      if(obj.kind==='bush'&&obj.type===5)continue;
      const d=Math.hypot(obj.x-p.x,obj.y-p.y);
      if(d>best)continue;
      const angle=Math.atan2(obj.y-p.y,obj.x-p.x);
      if(Math.cos(angle-p.angle)<0.25)continue;
      resource=obj;best=d;
    }
    if(resource){
      const key=resource.kind==='tree'?'wood':resource.kind==='bush'?'food':'stone';
      const bonus=key==='wood'?(tail.extraWood??0):
        key==='stone'?(tail.extraStone??0):(tail.extraFood??0);
      const amount=(resource.kind==='ore'?4:2)*(weapon.gather??1)+bonus;
      const points=1+(hat.extraGold??0);
      p.resources[key]+=amount;p.resources.points+=points;p.score+=points;
      resource.hp=Math.max(0,resource.hp-RESOURCE_DAMAGE);
      this.events.push({kind:'gather',sid:resource.sid,player:p.id,key,amount,points});
      this.awardXp(p.id,8);
      if(resource.hp===0){
        if(resource.kind==='bush'){
          resource.type=5;
          resource.regrowAt=time+RESOURCE_RETURN_MS;
          this.events.push({kind:'bush_empty',sid:resource.sid});
        }else{
          this.resources.delete(resource.sid);
          this.depleted.set(resource.sid,{obj:resource,at:time+RESOURCE_RETURN_MS});
          this.events.push({kind:'destroy',sid:resource.sid});
        }
      }
    }
    return true;
  }
  // Never land inside solid geometry, other players, or the central river.
  landingClear(x,y,playerSid){
    if(!finite(x)||!finite(y)||x<80||x>this.size-80||
      y<80||y>this.size-80||Math.abs(y-this.size/2)<470)return false;
    for(const p of this.players.values()){
      if(p.hp>0&&p.sid!==playerSid&&Math.hypot(p.x-x,p.y-y)<80)return false;
    }
    for(const o of this.resources.values()){
      if(Math.hypot(o.x-x,o.y-y)<o.scale+35)return false;
    }
    for(const o of this.structures.values()){
      if([16,18,19,20,21,22].includes(o.id))continue;
      if(Math.hypot(o.x-x,o.y-y)<o.scale+35)return false;
    }
    return true;
  }
  randomLanding(playerSid){
    for(let i=0;i<128;i++){
      const x=randomInt(180,this.size-180),y=randomInt(180,this.size-180);
      if(this.landingClear(x,y,playerSid))return {x,y};
    }
    return null;
  }
  respawn(id){
    const p=this.players.get(id);if(!p||p.hp!==0||this.now()<p.deadUntil)return false;
    p.hp=p.maxHp;p.deadUntil=0;
    const pad=[...this.structures.values()].find(o=>o.owner===p.sid&&o.id===20);
    const atPad=pad&&this.landingClear(pad.x,pad.y,p.sid)?
      {x:pad.x,y:pad.y}:null;
    const destination=atPad||this.randomLanding(p.sid);
    p.x=destination?.x??randomInt(180,this.size-180);
    p.y=destination?.y??randomInt(180,this.size-180);
    if(atPad){
      this.structures.delete(pad.sid);
      this.events.push({kind:'destroy',sid:pad.sid,owner:pad.owner,id:pad.id});
    }
    p.resources={wood:0,stone:0,food:0,points:0,kills:0};p.score=0;p.buildIndex=-1;p.weaponIndex=0;
    p.inventory={weapons:[0],items:[0,3,6,10]};p.xp=0;p.age=1;
    p.maxXp=LEVEL_XP(1);p.upgradePoints=0;p.upgradeAge=2;
    p.vx=0;p.vy=0;p.lastAttack=0;p.rootedUntil=0;p.nextHealAt=0;
    p.poison=null;p.regen=null;
    p.nextTeleportAt=this.now()+3000;
    p.lastGearRegenAt=this.now();p.raisedUntil=0;p.raisedOrigin=null;
    p.lastGeneratorAt=this.now();p.generatorRemainder=0;
    this.events.push({kind:'respawn',id:p.id,sid:p.sid,x:p.x,y:p.y});return true;
  }
  tick(dt){
    const step=Math.min(0.1,Math.max(0,Number(dt)||0)),at=this.now();
    for(const obj of this.resources.values()){
      if(obj.kind==='bush'&&obj.type===5&&at>=obj.regrowAt){
        obj.type=TYPE.bush;obj.hp=obj.maxHp;obj.regrowAt=null;
        this.events.push({kind:'bush_ready',sid:obj.sid});
      }
    }
    for(const [sid,entry] of this.depleted){
      if(at<entry.at)continue;
      const obj=entry.obj;
      // Never spawn a resource inside a live player or a placed structure.
      const blocked=[...this.players.values()].some(p=>p.hp>0&&Math.hypot(p.x-obj.x,p.y-obj.y)<obj.scale+35)||
        [...this.structures.values()].some(s=>Math.hypot(s.x-obj.x,s.y-obj.y)<obj.scale+s.scale);
      if(blocked){entry.at=at+2000;continue;}
      obj.hp=obj.maxHp;this.resources.set(sid,obj);this.depleted.delete(sid);
      this.events.push({kind:'resource_return',sid});
    }
    for(const a of this.animals.values()){
      if(a.health<=0){
        if(at>=a.deadUntil){a.health=a.maxHealth;a.x=a.homeX;a.y=a.homeY;this.events.push({kind:'animal_return',sid:a.sid});}
        continue;
      }
      let target=null,best=480;
      if(a.damage>0)for(const p of this.players.values()){
        if(p.hp<=0)continue;
        const dist=Math.hypot(a.x-p.x,a.y-p.y);
        if(dist<best){best=dist;target=p;}
      }
      if(target)a.dir=Math.atan2(target.y-a.y,target.x-a.x);
      else if(this.animalRandom()<step*0.4)a.dir+=this.animalRandom()-0.5;
      const speed=a.speed*(target?1.15:0.5)*step;
      a.x=Math.max(60,Math.min(this.size-60,a.x+Math.cos(a.dir)*speed));
      a.y=Math.max(60,Math.min(this.size-60,a.y+Math.sin(a.dir)*speed));
      if(target&&best<80&&at>=a.nextAttack){
        a.nextAttack=at+1100;
        const damage=this.protectedDamage(target,a.damage,a.x,a.y);
        target.hp=Math.max(0,target.hp-damage);
        this.events.push({kind:'animal_attack',sid:a.sid,to:target.id,hp:target.hp,damage,x:target.x,y:target.y});
        if(target.hp===0){target.deadUntil=at+3000;target.vx=0;target.vy=0;this.events.push({kind:'death',id:target.id});}
      }
    }
    for(const p of this.players.values()){
      if(p.hp===0&&p.deadUntil&&at>=p.deadUntil&&!p.native)this.respawn(p.id);
      if(p.hp<=0)continue;
      const boosted=[...this.structures.values()].some(o=>o.id===16&&
        Math.hypot(p.x-o.x,p.y-o.y)<o.scale+32);
      const {hat,tail}=gearEffects(p);
      const speed=at<p.rootedUntil?0:250*(boosted?1.5:1)*
        (hat.speed??1)*(tail.speed??1);
      const x=Math.max(24,Math.min(this.size-24,p.x+p.vx*speed*step));
      const y=Math.max(24,Math.min(this.size-24,p.y+p.vy*speed*step));
      // Platforms provide a short, local raised state for crossing a
      // nearby wall. It expires away from the platform: no global phasing.
      const platform=[...this.structures.values()].find(o=>o.id===18&&
        Math.hypot(p.x-o.x,p.y-o.y)<o.scale+36);
      if(platform){
        p.raisedUntil=at+1200;
        p.raisedOrigin={x:platform.x,y:platform.y};
      }
      const raised=at<p.raisedUntil&&p.raisedOrigin&&
        Math.hypot(x-p.raisedOrigin.x,y-p.raisedOrigin.y)<200;
      const blocking=[...this.structures.values()].some(o=>[3,4,5].includes(o.id)&&
        Math.hypot(x-o.x,y-o.y)<o.scale+30&&!raised);
      if(!blocking){p.x=x;p.y=y;}
      for(const trap of this.structures.values()){
        if(![6,7,8,9].includes(trap.id))continue;
        const owner=[...this.players.values()].find(other=>other.sid===trap.owner);
        if(trap.owner===p.sid || (p.team && owner?.team===p.team))continue;
        if(Math.hypot(p.x-trap.x,p.y-trap.y)>trap.scale+24)continue;
        if(at<(trap.nextDamage?.[p.id]||0))continue;
        if(!trap.nextDamage)trap.nextDamage=Object.create(null);
        trap.nextDamage[p.id]=at+850;
        const recipe=RECIPES[trap.id];
        // The existing V2 basic spikes retain their balancing.
        const raw=recipe.spikeDamage??(trap.id===7?15:10);
        const amount=this.protectedDamage(p,raw,trap.x,trap.y);
        p.hp=Math.max(0,p.hp-amount);
        if(p.hp>0&&recipe.poison&&!hat.poisonImmune){
          // Re-entering a poison spike refreshes its expiry but cannot
          // postpone a pending tick indefinitely.
          p.poison={until:at+recipe.poison.seconds*1000,
            nextAt:p.poison?.nextAt??at+1000,
            damage:recipe.poison.damage,from:owner?.id||null};
        }
        this.events.push({kind:'hit',from:owner?.id||null,to:p.id,
          damage:amount,hp:p.hp,x:p.x,y:p.y});
        if(p.hp===0){
          p.deadUntil=at+3000;p.vx=0;p.vy=0;
          p.poison=null;p.regen=null;
          this.events.push({kind:'death',id:p.id,killer:owner?.id||null});
        }
        break;
      }
      if(p.hp<=0)continue;
      // Healing pads only affect living owners and tribe allies. Pit traps
      // immobilize hostile players for a bounded interval; per-trap cooldown
      // prevents repeated activation every simulation tick.
      for(const pad of this.structures.values()){
        const spec=RECIPES[pad.id];
        if(!spec || (!spec.pit && !spec.heal))continue;
        if(Math.hypot(p.x-pad.x,p.y-pad.y)>pad.scale+24)continue;
        const owner=[...this.players.values()].find(other=>other.sid===pad.owner);
        const ally=pad.owner===p.sid||Boolean(p.team&&owner?.team===p.team);
        if(spec.pit&&!ally){
          pad.trapCooldown??=new Map();
          if(at>=(pad.trapCooldown.get(p.id)||0)){
            pad.trapCooldown.set(p.id,at+4000);
            p.rootedUntil=Math.max(p.rootedUntil,at+1200);
            this.events.push({kind:'trap',player:p.id,sid:pad.sid,until:p.rootedUntil});
          }
        }
        if(spec.heal&&ally&&p.hp<p.maxHp&&at>=p.nextHealAt){
          const amount=Math.min(spec.heal,p.maxHp-p.hp);
          p.hp+=amount;p.nextHealAt=at+1000;
          this.events.push({kind:'heal',player:p.id,sid:p.sid,amount,hp:p.hp,x:p.x,y:p.y});
        }
      }
      // Periodic status effects use elapsed wall-clock seconds, not tick
      // counts. Missed ticks can recover at most the fixed effect duration.
      if(p.poison&&hat.poisonImmune)p.poison=null;
      if(p.poison){
        const dot=p.poison;
        const until=Math.min(at,dot.until);
        const pulses=Math.max(0,Math.min(6,Math.floor((until-dot.nextAt)/1000)+1));
        if(pulses){
          const damage=Math.min(p.hp,pulses*dot.damage);
          p.hp-=damage;dot.nextAt+=pulses*1000;
          this.events.push({kind:'hit',from:dot.from,to:p.id,
            damage,hp:p.hp,x:p.x,y:p.y});
          if(p.hp===0){
            p.deadUntil=at+3000;p.vx=0;p.vy=0;
            this.events.push({kind:'death',id:p.id,killer:dot.from});
            p.poison=null;p.regen=null;
          }
        }
        if(p.poison&&at>=dot.until)p.poison=null;
      }
      if(p.hp<=0)continue;
      // Passive equipment recovery/drain is measured by real elapsed
      // seconds and bounded to prevent gaining extra healing from FPS.
      const gearSeconds=Math.max(0,Math.min(5,
        Math.floor((at-p.lastGearRegenAt)/1000)));
      if(gearSeconds){
        p.lastGearRegenAt+=gearSeconds*1000;
        const perSecond=(hat.healthRegen??0)+(tail.healthRegen??0);
        if(perSecond>0&&p.hp<p.maxHp){
          const amount=Math.min(p.maxHp-p.hp,gearSeconds*perSecond);
          p.hp+=amount;
          this.events.push({kind:'heal',player:p.id,sid:p.sid,
            amount,hp:p.hp,x:p.x,y:p.y});
        }else if(perSecond<0){
          const damage=Math.min(p.hp,-perSecond*gearSeconds);
          p.hp-=damage;
          this.events.push({kind:'hit',from:null,to:p.id,
            damage,hp:p.hp,x:p.x,y:p.y});
          if(p.hp===0){
            p.deadUntil=at+3000;p.vx=0;p.vy=0;p.poison=null;p.regen=null;
            this.events.push({kind:'death',id:p.id});
          }
        }
      }
      if(p.hp<=0)continue;
      if(p.regen){
        const regen=p.regen;
        const until=Math.min(at,regen.until);
        const pulses=Math.max(0,Math.min(5,Math.floor((until-regen.nextAt)/1000)+1));
        if(pulses){
          regen.nextAt+=pulses*1000;
          const amount=Math.min(p.maxHp-p.hp,pulses*regen.amount);
          if(amount>0){
            p.hp+=amount;
            this.events.push({kind:'heal',player:p.id,sid:p.sid,
              amount,hp:p.hp,x:p.x,y:p.y});
          }
        }
        if(at>=regen.until||p.hp>=p.maxHp)p.regen=null;
      }
      // The Node server decides destination; cooldown prevents portal loops.
      if(at>=p.nextTeleportAt){
        const portal=[...this.structures.values()].find(o=>o.id===22&&
          Math.hypot(p.x-o.x,p.y-o.y)<o.scale+24);
        if(portal){
          const destination=this.randomLanding(p.sid);
          if(destination){
            p.x=destination.x;p.y=destination.y;p.vx=0;p.vy=0;
            p.nextTeleportAt=at+4000;
            this.events.push({kind:'teleport',player:p.id,sid:p.sid,x:p.x,y:p.y});
          }
        }
      }
      // Resource generators use elapsed wall-clock time, not the number of
      // ticks a VPS happens to execute. Keep fractional output and bound
      // a single delayed tick to five seconds of accrual (no idle farming).
      const elapsed=Math.max(0,Math.min(5,(at-p.lastGeneratorAt)/1000));
      p.lastGeneratorAt=at;
      const rate=(hat.pps??0)+[...this.structures.values()].reduce((sum,o)=>
        sum+(o.owner===p.sid?(RECIPES[o.id]?.pps||0):0),0);
      p.generatorRemainder+=elapsed*rate;
      const income=Math.floor(p.generatorRemainder);
      if(income>0){
        p.generatorRemainder-=income;
        p.resources.points+=income;p.score+=income;
        this.events.push({kind:'income',player:p.id,amount:income});
      }
    }
    this.fireTurrets(at);
    this.advanceProjectiles(step,at);
    this.tickNumber++;
  }
  // Turrets are player-built structures, not NPCs. Targets, attack cadence,
  // team protection and projectile damage are all computed by the server.
  fireTurrets(at){
    for(const turret of this.structures.values()){
      if(turret.id!==17||at<(turret.nextFire||0))continue;
      const owner=[...this.players.values()].find(p=>p.sid===turret.owner);
      if(!owner)continue;
      let victim=null,best=700;
      for(const p of this.players.values()){
        if(p.id===owner.id||p.hp<=0||owner.team&&p.team===owner.team||
          gearEffects(p).hat.antiTurret)continue;
        const distance=Math.hypot(p.x-turret.x,p.y-turret.y);
        if(distance>=best)continue;
        best=distance;victim=p;
      }
      for(const a of this.animals.values()){
        if(a.health<=0||a.damage<=0)continue;
        const distance=Math.hypot(a.x-turret.x,a.y-turret.y);
        if(distance>=best)continue;
        best=distance;victim=a;
      }
      if(!victim)continue;
      const dir=Math.atan2(victim.y-turret.y,victim.x-turret.x);
      turret.nextFire=at+2200;
      const x=turret.x+Math.cos(dir)*55,y=turret.y+Math.sin(dir)*55;
      this.events.push({kind:'turret_shot',sid:turret.sid,dir});
      this.spawnProjectile({owner:owner.id,ownerSid:owner.sid,team:owner.team,
        x,y,dir,range:700,speed:1.7,damage:18,type:1,layer:1,
        sourceSid:turret.sid});
    }
  }
  advanceProjectiles(step,at){
    for(const [sid,arrow] of this.projectiles){
      const distance=Math.min(arrow.range,arrow.speed*1000*step);
      const nx=arrow.x+distance*Math.cos(arrow.dir);
      const ny=arrow.y+distance*Math.sin(arrow.dir);
      let first=null;
      const offer=(kind,target,t)=>{
        if(t!==null&&(!first||t<first.t))first={kind,target,t};
      };
      for(const p of this.players.values()){
        if(p.id===arrow.owner||p.hp<=0||arrow.team&&p.team===arrow.team)continue;
        offer('player',p,segmentHit(arrow.x,arrow.y,nx,ny,p.x,p.y,34));
      }
      for(const animal of this.animals.values()){
        if(animal.health<=0)continue;
        offer('animal',animal,segmentHit(arrow.x,arrow.y,nx,ny,animal.x,animal.y,42));
      }
      for(const structure of this.structures.values()){
        // Automatic defenses must not collide with the structure from which
        // their projectile originated, even at zero distance.
        if(structure.sid===arrow.sourceSid)continue;
        offer('structure',structure,segmentHit(arrow.x,arrow.y,nx,ny,
          structure.x,structure.y,Math.max(15,structure.scale*0.6)));
      }
      for(const resource of this.resources.values()){
        offer('resource',resource,segmentHit(arrow.x,arrow.y,nx,ny,
          resource.x,resource.y,Math.max(20,resource.scale*0.47)));
      }
      const travelled=distance*(first?.t??1);
      arrow.x+=travelled*Math.cos(arrow.dir);
      arrow.y+=travelled*Math.sin(arrow.dir);
      arrow.range-=travelled;
      let end=Boolean(first)||arrow.range<=0||
        arrow.x<0||arrow.x>this.size||arrow.y<0||arrow.y>this.size;
      if(first){
        const {kind,target}=first;
        const shooter=this.players.get(arrow.owner);
        if(kind==='player'){
          const damage=this.protectedDamage(target,arrow.damage,arrow.x,arrow.y,'projectile');
          target.hp=Math.max(0,target.hp-damage);
          this.events.push({kind:'hit',from:arrow.owner,to:target.id,
            damage,hp:target.hp,x:target.x,y:target.y});
          if(target.hp===0){
            target.deadUntil=at+3000;target.vx=0;target.vy=0;
            if(shooter){shooter.resources.kills++;shooter.score+=100;this.awardXp(shooter.id,40);}
            this.events.push({kind:'death',id:target.id,killer:arrow.owner});
          }
        }else if(kind==='animal'){
          target.health=Math.max(0,target.health-arrow.damage);
          this.events.push({kind:'animal_hit',sid:target.sid,from:arrow.owner,
            x:target.x,y:target.y,damage:arrow.damage});
          if(target.health===0){
            target.deadUntil=at+15000;
            if(shooter){shooter.resources.food+=30;shooter.resources.points+=20;
              shooter.score+=20;this.awardXp(shooter.id,30);}
            this.events.push({kind:'animal_down',sid:target.sid,player:arrow.owner});
          }
        }else if(kind==='structure'){
          const owner=[...this.players.values()].find(p=>p.sid===target.owner);
          if(target.owner!==arrow.ownerSid&&!(arrow.team&&owner?.team===arrow.team)){
            target.hp=Math.max(0,target.hp-arrow.damage);
            this.events.push({kind:'structure_hit',sid:target.sid,dir:arrow.dir,
              x:target.x,y:target.y,damage:arrow.damage});
            if(target.hp===0){
              this.structures.delete(target.sid);
              this.events.push({kind:'destroy',sid:target.sid,
                owner:target.owner,id:target.id});
            }
          }
        }
        // Trees/rocks and friendly structures stop arrows, but never award
        // resources or friendly-fire damage from a projectile.
      }
      if(end){
        this.projectiles.delete(sid);
        this.events.push({kind:'projectile_end',sid});
      }
    }
  }
  snapshot(){
    return {kind:'world',tick:this.tickNumber,size:this.size,
      players:[...this.players.values()].map(p=>({id:p.id,name:p.name,x:round(p.x),y:round(p.y),hp:p.hp})),
      objects:[...this.resources.values(),...this.structures.values()].map(o=>({sid:o.sid,x:o.x,y:o.y,type:o.type,id:o.id??null,owner:o.owner??null}))};
  }
  takeEvents(){return this.events.splice(0);}
  animalPacket(){return [
    [...this.animals.values()].filter(a=>a.health>0).flatMap(a=>[
      a.sid,a.index,round(a.x),round(a.y),Math.round(a.dir*100),a.health,a.nameIndex,a.state]),
    [...this.animals.values()].filter(a=>a.health<=0).map(a=>a.sid)
  ];}
  allObjects(){return [...this.resources.values(),...this.structures.values()];}
  objectPacket(){return this.allObjects().flatMap(o=>[o.sid,round(o.x),round(o.y),0,o.scale,o.type,o.id??null,o.owner??null]);}
  playerData(p){return [p.id,p.sid,p.name,round(p.x),round(p.y),p.angle,p.hp,p.maxHp,35,p.skinColor,null,null,null,null,0,false,false];}
  playerUpdates(){
    const pos=[],attrs=[];
    for(const p of this.players.values()){
      if(p.hp<=0)continue;
      pos.push(p.sid,round(p.x),round(p.y),Math.round(p.angle*100));
      attrs.push(p.sid,p.buildIndex,p.weaponIndex,0,p.team,p.team===null?false:this.tribes.get(p.team)?.owner===p.id,p.hat,p.tail,0,0);
    }
    return [pos,attrs,[]];
  }
  leaderboard(){return [...this.players.values()].filter(p=>p.hp>0).sort((a,b)=>b.score-a.score).slice(0,10).flatMap(p=>[p.sid,p.name,p.score]);}
  // Logical presentation events, encoded by a separately tested transport.
  initialPackets(p){
    return [['A',[{teams:[...this.tribes].map(([sid,v])=>({sid,owner:this.players.get(v.owner)?.sid,clan:false})),animals:[]}]],
      ['C',[p.sid]],...([...this.players.values()].filter(other=>other.hp>0).map(other=>['D',[this.playerData(other),other===p]])),
      ['H',[this.objectPacket()]],['I',this.animalPacket()],['a',this.playerUpdates()],
      ...Object.entries(p.resources).map(([k,n])=>['N',[k,n,1]]),
      ['V',[p.inventory.weapons,1]],['V',[p.inventory.items,0]],
      ['T',[p.xp,p.maxXp,p.age]],['U',[p.upgradePoints,p.upgradeAge]],['G',[this.leaderboard()]]];
  }
}
