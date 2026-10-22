import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { World } from '../src/world.js';
import { HATS,ACCESSORIES,FREE_HATS } from '../src/store.js';

function make(){
  let at=100_000;
  const w=new World({seed:4009,now:()=>at});
  w.resources.clear();w.animals.clear();w.events=[];
  const owner=w.join(null,'Builder'),rival=w.join(null,'Rival');
  owner.x=2000;owner.y=1100;owner.angle=0;
  rival.x=6000;rival.y=1100;rival.angle=0;
  owner.resources={wood:2000,stone:2000,food:500,points:50000,kills:0};
  rival.resources={wood:2000,stone:2000,food:500,points:50000,kills:0};
  return {w,owner,rival,advance:ms=>{at+=ms;}};
}
function equip(w,p,id,accessory=false){
  assert.equal(w.shop(p.id,1,id,accessory),true,'purchase item '+id);
  assert.equal(w.shop(p.id,0,id,accessory),true,'equip item '+id);
}
function build(w,p,id,x=2000,y=1100){
  p.x=x;p.y=y;p.angle=0;
  if(!p.inventory.items.includes(id))p.inventory.items.push(id);
  w.select(p.id,0,true);
  assert.equal(w.select(p.id,id,false),true);
  assert.equal(w.place(p.id,id),true,'build '+id);
  return [...w.structures.values()].at(-1);
}

test('independent storefront prices agree with every available Lua store entry',()=>{
  const catalog=readFileSync(fileURLToPath(new URL('../../src/game/store_catalog.lua',import.meta.url)),'utf8');
  const [hatBody,tailBody]=catalog.split('Store.accessories=');
  const extract=(body)=>Object.fromEntries([...body.matchAll(/\{id=(\d+),name="[^"]+",price=(\d+),[^\n]*dontSell=false/g)]
    .map(m=>[Number(m[1]),Number(m[2])]));
  const luaHats=extract(hatBody),luaTails=extract(tailBody);
  assert.deepEqual(HATS,luaHats);
  assert.deepEqual(ACCESSORIES,luaTails);
  assert.ok(FREE_HATS.includes(50));
  assert.ok(!Object.hasOwn(HATS,61));
  assert.ok(!Object.hasOwn(HATS,45));
});

test('shop prices/ownership are server verified; forged IDs, negative balance and duplicates fail',()=>{
  const {w,owner,rival}=make();
  assert.ok(owner.ownedHats.has(50),'all free catalog hats unlocked at spawn');
  assert.equal(w.shop(owner.id,0,50,false),true);
  assert.equal(w.shop(owner.id,1,50,false),false,'no repurchase free hats');
  assert.equal(w.shop(owner.id,1,61,false),false,'earned item not sold');
  assert.equal(w.shop(owner.id,1,45,false),false,'restricted item not sold');
  assert.equal(w.shop(owner.id,1,999999,false),false);
  const cash=owner.resources.points;
  assert.equal(w.shop(owner.id,0,12,false),false,'equip requires ownership');
  assert.equal(w.shop(owner.id,1,12,false),true);
  assert.equal(owner.resources.points,cash-6000);
  assert.equal(w.shop(owner.id,1,12,false),false);
  assert.equal(w.shop(owner.id,0,12,false),true);
  assert.equal(owner.hat,12);
  assert.equal(w.shop(rival.id,0,12,false),false,'ownership is per player');
  assert.equal(w.shop(owner.id,0,10,true),false);
  assert.equal(w.shop(owner.id,1,10,true),true);
  assert.equal(w.shop(owner.id,0,10,true),true);
  assert.equal(owner.tail,10);
  owner.resources.points=0;
  assert.equal(w.shop(owner.id,1,9,false),false);
  assert.equal(owner.resources.points,0);
});

test('boost and soldier helmets alter movement and damage; switching to none removes bonuses',()=>{
  const {w,owner,rival}=make();
  equip(w,owner,12);
  owner.vx=1;owner.vy=0;
  w.tick(0.1);
  assert.equal(owner.x,2013.92,'snow acceleration times +16% movement bonus');
  owner.x=2000;owner.vx=0;
  owner.hat=0;
  rival.x=2070;rival.y=1100;rival.angle=Math.PI;
  equip(w,owner,6);
  owner.angle=0;
  const hp=owner.hp;
  w.attack(rival.id);
  assert.equal(owner.hp,hp-19,'25 damage * 0.75 rounded to 19');
  owner.hat=0;
  rival.lastAttack=0;
  w.attack(rival.id);
  assert.equal(owner.hp,hp-19-25);
});

test('miner helmet and gathering capes increase real pickups with correct native-compatible totals',()=>{
  const {w,owner,advance}=make();
  const resource=(sid,kind,x=2090)=>{
    const o={sid,kind,x,y:1100,scale:50,hp:500,maxHp:500};
    w.resources.set(sid,o);return o;
  };
  equip(w,owner,9);
  equip(w,owner,9,true);
  owner.resources.wood=0;owner.resources.points=0;
  const tree=resource(99901,'tree');
  w.attack(owner.id);
  assert.equal(owner.resources.wood,2);
  assert.equal(owner.resources.points,1);
  assert.ok(w.takeEvents().some(e=>e.kind==='gather'&&e.sid===tree.sid&&e.amount===2&&e.points===1));
  w.resources.clear();
  advance(501);
  owner.resources.points=1000;
  equip(w,owner,10,true);
  const rock=resource(99902,'stone');
  owner.resources.stone=0;
  w.attack(owner.id);
  assert.equal(owner.resources.stone,2);
  assert.ok(w.takeEvents().some(e=>e.kind==='gather'&&e.sid===rock.sid&&e.amount===2));
});

test('ranged headgear changes range, speed and deducted ammo, never trusting packet values',()=>{
  const {w,owner,advance}=make();
  owner.inventory.weapons.push(9);
  w.select(owner.id,9,true);
  equip(w,owner,1);
  owner.resources.wood=20;
  w.attack(owner.id);
  const first=[...w.projectiles.values()][0];
  assert.equal(first.speed,1.6*1.3);
  assert.equal(first.range,1000*1.3);
  assert.equal(owner.resources.wood,16);
  advance(700);
  equip(w,owner,32);
  w.attack(owner.id);
  const second=[...w.projectiles.values()][1];
  assert.equal(second.speed,1.6);
  assert.equal(second.range,1000);
  assert.equal(owner.resources.wood,14,'half of 4 wood, paid once on server');
  assert.equal(w.takeEvents().filter(e=>e.kind==='projectile_spawn').length,2);
});

test('anti-venom equipment suppresses poison without nullifying the initial spike hit',()=>{
  const {w,owner,rival,advance}=make();
  const spikes=build(w,owner,8);
  equip(w,rival,23);
  rival.x=spikes.x;rival.y=spikes.y;
  w.tick(0.05);
  assert.equal(rival.hp,70);
  assert.equal(rival.poison,null);
  rival.x=spikes.x+400;
  advance(4000);w.tick(0.05);
  assert.equal(rival.hp,70);
});

test('passive healer and windmill hats accrue once per real second and stop when unequipped',()=>{
  const {w,owner,advance}=make();
  equip(w,owner,13);
  owner.hp=50;
  advance(1000);w.tick(0.05);
  assert.equal(owner.hp,53);
  owner.hat=0;
  advance(1000);w.tick(0.05);
  assert.equal(owner.hp,53);
  equip(w,owner,14);
  const old=owner.resources.points;
  advance(2000);w.tick(0.05);
  assert.equal(owner.resources.points,old+3);
  w.tick(0.05);
  assert.equal(owner.resources.points,old+3,'multiple updates at same timestamp add nothing');
});

test('anti-turret gear blocks target acquisition, not attacks by players',()=>{
  const {w,owner,rival}=make();
  w.structures.set(999,{sid:999,id:17,x:2000,y:1100,scale:43,owner:owner.sid,
    hp:800,maxHp:800,nextFire:0});
  rival.x=2300;rival.y=1100;
  equip(w,rival,22);
  w.tick(0.05);
  assert.equal(w.projectiles.size,0);
  rival.hat=0;w.tick(0.05);
  assert.equal(w.projectiles.size,1);
});

test('the age-seven platform is priced, has a limit and permits only local raised wall crossing',()=>{
  const {w,owner,rival,advance}=make();
  assert.equal(w.upgrade(owner.id,34),false);
  owner.age=7;owner.upgradeAge=7;owner.upgradePoints=1;
  assert.equal(w.upgrade(owner.id,34),true);
  assert.ok(owner.inventory.items.includes(18));
  const wall=build(w,owner,3,2000);
  const platform=build(w,owner,18,2105);
  assert.deepEqual(w.structureCount(owner.sid,18),{group:8,count:1});
  assert.equal(platform.scale,43);
  const before=owner.resources.wood;
  assert.equal(w.place(owner.id,18),false,'overlapping pad rejected');
  assert.equal(owner.resources.wood,before);
  owner.x=5000;owner.y=3500; // Do not collide with the builder during platform crossing
  rival.x=platform.x;rival.y=platform.y;rival.vx=-1;rival.vy=0;
  for(let i=0;i<12;i++)w.tick(0.1);
  assert.ok(rival.x<wall.x-75,'can walk across nearby wall on platform');
  advance(1500);
  rival.x=wall.x-90;rival.y=wall.y;rival.vx=1;rival.vy=0;
  w.tick(0.1);
  assert.equal(rival.x,wall.x-90,'raised state expired away from platform');
});

test('projectile cape mitigates projectile damage but not ordinary melee',()=>{
  const {w,owner,rival,advance}=make();
  equip(w,rival,15,true);
  rival.x=1180;rival.y=1100;owner.x=1000;owner.y=1100;owner.angle=0;
  owner.inventory.weapons.push(9);w.select(owner.id,9,true);
  owner.resources.wood=20;
  w.attack(owner.id);w.tick(0.1);
  assert.equal(rival.hp,81,'25 projectile damage *0.75 rounds to 19');
  advance(700);
  owner.x=1110;owner.y=1100;w.select(owner.id,0,true);
  owner.angle=0;
  w.attack(owner.id);
  assert.equal(rival.hp,56,'melee ignores projectile-specific cape defense');
});
