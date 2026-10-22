import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world.js';
import { GameServer } from '../src/game.js';

function sandbox(){
  let now=100_000;
  const world=new World({seed:2468,now:()=>now});
  world.resources.clear();world.animals.clear();world.events=[];
  const owner=world.join(null,'Owner'),enemy=world.join(null,'Enemy');
  owner.x=2000;owner.y=1100;owner.angle=0;
  enemy.x=4000;enemy.y=1100;enemy.angle=0;
  owner.resources={wood:2000,stone:2000,food:300,points:0,kills:0};
  enemy.resources={wood:2000,stone:2000,food:300,points:0,kills:0};
  return {world,owner,enemy,advance:ms=>{now+=ms;return now;}};
}
function build(world,owner,id,x=2000,y=1100){
  owner.x=x;owner.y=y;owner.angle=0;
  if(!owner.inventory.items.includes(id))owner.inventory.items.push(id);
  world.select(owner.id,0,true);
  assert.equal(world.select(owner.id,id,false),true);
  assert.equal(world.place(owner.id,id),true,'build '+id);
  return [...world.structures.values()].at(-1);
}

test('Lua progression exposes castle wall, cheese, poison and spinning spikes at proper ages',()=>{
  const {world,owner}=sandbox();
  assert.equal(world.upgrade(owner.id,21),false);
  owner.age=7;owner.upgradeAge=7;owner.upgradePoints=1;
  assert.equal(world.upgrade(owner.id,21),false,'castle wall requires stone wall');
  owner.inventory.items.push(4);
  assert.equal(world.upgrade(owner.id,21),true);
  assert.ok(owner.inventory.items.includes(5));
  assert.equal(world.upgrade(owner.id,18),false,'single decision at each stage');
  const consumer=world.join(null,'Consumer');
  consumer.age=7;consumer.upgradeAge=7;consumer.upgradePoints=1;
  assert.equal(world.upgrade(consumer.id,18),true);
  assert.ok(consumer.inventory.items.includes(2));
  for(const [id,index] of [[8,24],[9,25]]){
    const defender=world.join(null,'Defender'+id);
    defender.age=9;defender.upgradeAge=9;defender.upgradePoints=1;
    assert.equal(world.upgrade(defender.id,index),false,'advanced spikes require greater spikes');
    defender.inventory.items.push(7);
    assert.equal(world.upgrade(defender.id,index),true);
    assert.ok(defender.inventory.items.includes(id));
  }
});

test('castle wall costs stone, withstands damage, and shares group-one limit',()=>{
  const {world,owner}=sandbox();
  const before=owner.resources.stone;
  const wall=build(world,owner,5);
  assert.equal(wall.hp,1500);
  assert.equal(owner.resources.stone,before-35);
  assert.deepEqual(world.structureCount(owner.sid,5),{group:1,count:1});
  const first=owner.resources.stone;
  assert.equal(world.place(owner.id,5),false,'overlapping placement cannot consume stone');
  assert.equal(owner.resources.stone,first);
});

test('advanced spike variants damage only enemies and obey server-side hit cooldown',()=>{
  for(const [id,damage] of [[8,30],[9,45]]){
    const {world,owner,enemy,advance}=sandbox();
    const spike=build(world,owner,id);
    world.takeEvents();
    enemy.x=spike.x;enemy.y=spike.y;enemy.vx=enemy.vy=0;
    world.tick(0.05);
    assert.equal(enemy.hp,100-damage,'item '+id+' impact damage');
    world.tick(0.05);
    assert.equal(enemy.hp,100-damage,'no damage each frame');
    const hits=world.takeEvents().filter(e=>e.kind==='hit'&&e.to===enemy.id);
    assert.equal(hits.length,1);
    const {world:friends,owner:a,enemy:b}=sandbox();
    const safe=build(friends,a,id);
    friends.createTribe(a.id,'DEF');
    friends.requestTribe(b.id,'DEF');
    friends.answerTribe(a.id,b.sid,true);
    b.x=safe.x;b.y=safe.y;b.vx=b.vy=0;
    advance(100);
    friends.tick(0.05);
    assert.equal(b.hp,100,'allies must not be damaged or poisoned');
    assert.equal(b.poison,null);
  }
});

test('poison ticks by elapsed seconds after leaving trap and cannot kill twice',()=>{
  const {world,owner,enemy,advance}=sandbox();
  const spike=build(world,owner,8);
  world.takeEvents();
  enemy.x=spike.x;enemy.y=spike.y;enemy.hp=34;
  world.tick(0.05);
  assert.equal(enemy.hp,4);
  assert.ok(enemy.poison);
  enemy.x=spike.x+300;enemy.y=spike.y;
  advance(999);world.tick(0.05);
  assert.equal(enemy.hp,4);
  advance(1);world.tick(0.05);
  assert.equal(enemy.hp,0);
  assert.equal(enemy.poison,null);
  assert.ok(enemy.deadUntil>0);
  assert.equal(world.takeEvents().filter(e=>e.kind==='death'&&e.id===enemy.id).length,1);
  advance(1000);world.tick(0.05);
  assert.equal(world.takeEvents().filter(e=>e.kind==='death'&&e.id===enemy.id).length,0);
});

test('re-contact with poison spike does not suppress scheduled poison ticks',()=>{
  const {world,owner,enemy,advance}=sandbox();
  const spike=build(world,owner,8);
  world.takeEvents();
  enemy.x=spike.x;enemy.y=spike.y;enemy.vx=enemy.vy=0;
  world.tick(0.05);
  assert.equal(enemy.hp,70);
  advance(850);world.tick(0.05);
  assert.equal(enemy.hp,40,'second contact costs 30');
  advance(150);world.tick(0.05);
  assert.equal(enemy.hp,35,'initial poison tick not postponed by re-contact');
});

test('poison after leaving a trap has a finite duration and never stacks',()=>{
  const {world,owner,enemy,advance}=sandbox();
  const spike=build(world,owner,8);
  enemy.x=spike.x;enemy.y=spike.y;
  world.tick(0.05);
  enemy.x=spike.x+400;enemy.y=spike.y;
  advance(6000);world.tick(0.05);
  assert.equal(enemy.hp,40,'six poison ticks of five each');
  assert.equal(enemy.poison,null);
  advance(10000);world.tick(0.05);
  assert.equal(enemy.hp,40,'expired poison never reapplies off-trap');
  assert.equal(world.takeEvents().filter(e=>e.kind==='hit'&&e.to===enemy.id).length,2,
    'one direct impact and one elapsed poison update');
});

test('cheese consumes exactly 25 food, heals 30 now and 10 each second for five seconds',()=>{
  const {world,owner,advance}=sandbox();
  owner.inventory.items.push(2);
  owner.hp=10;
  world.select(owner.id,2,false);
  assert.equal(world.attack(owner.id),true);
  assert.equal(owner.hp,40);
  assert.equal(owner.resources.food,275);
  assert.ok(owner.regen);
  advance(999);world.tick(0.05);
  assert.equal(owner.hp,40);
  advance(1001);world.tick(0.05);
  assert.equal(owner.hp,60);
  advance(3000);world.tick(0.05);
  assert.equal(owner.hp,90);
  assert.equal(owner.regen,null);
  assert.equal(owner.resources.food,275,'periodic heal is not charged each tick');
});

test('cheese cannot over-heal, and ongoing recovery clears on respawn',()=>{
  const {world,owner,advance}=sandbox();
  owner.inventory.items.push(2);owner.hp=75;
  world.select(owner.id,2,false);
  assert.equal(world.attack(owner.id),true);
  assert.equal(owner.hp,100);
  advance(1000);world.tick(0.05);
  assert.equal(owner.hp,100);
  assert.equal(owner.regen,null);
  owner.hp=10;
  advance(500);assert.equal(world.attack(owner.id),true);
  assert.ok(owner.regen);
  owner.hp=0;owner.deadUntil=105000;owner.native=true;
  advance(3500);
  assert.equal(world.respawn(owner.id),true);
  assert.equal(owner.regen,null);
  assert.equal(owner.poison,null);
  advance(2000);world.tick(0.05);
  assert.equal(owner.hp,100);
});

test('enemy cannot exploit player farm to obtain resources, but can break it',()=>{
  const {world,owner,enemy}=sandbox();
  const farm=build(world,owner,14);
  world.takeEvents();
  enemy.x=farm.x-90;enemy.y=farm.y;enemy.angle=0;
  const before={...enemy.resources};
  assert.equal(world.attack(enemy.id),true);
  assert.equal(farm.hp,325,'enemy hammer must damage owner\'s sapling');
  assert.equal(enemy.resources.wood,before.wood,'hostile farm cannot print wood');
  assert.equal(world.takeEvents().filter(e=>e.kind==='gather'&&e.player===enemy.id).length,0);
});

test('native Lua receives impact/poison and periodic cheese healing in health packet O',()=>{
  const {world,owner,enemy,advance}=sandbox();
  const sent=[];
  const states=[owner,enemy].map(p=>({p,send:(name,args)=>sent.push([name,args])}));
  const game=Object.create(GameServer.prototype);
  game.room=world;game.nativeClients=new Map(states.map((x,i)=>[i,x]));
  game._nativeBroadcast=(name,args)=>sent.push([name,args]);
  const spike=build(world,owner,8);
  world.takeEvents();enemy.x=spike.x;enemy.y=spike.y;
  world.tick(0.05);game._nativeEvents(world.takeEvents());
  assert.ok(sent.some(([name,args])=>name==='O'&&args[0]===enemy.sid&&args[1]===70));
  sent.length=0;
  enemy.x=spike.x+400;
  advance(1000);world.tick(0.05);game._nativeEvents(world.takeEvents());
  assert.ok(sent.some(([name,args])=>name==='O'&&args[0]===enemy.sid&&args[1]===65));
  sent.length=0;
  owner.inventory.items.push(2);owner.hp=20;owner.resources.food=50;
  world.select(owner.id,0,true);world.select(owner.id,2,false);advance(500);
  assert.equal(world.attack(owner.id),true);
  game._nativeEvents(world.takeEvents());
  assert.ok(sent.some(([name,args])=>name==='N'&&args[0]==='food'&&args[1]===25));
  sent.length=0;
  advance(1000);world.tick(0.05);game._nativeEvents(world.takeEvents());
  assert.ok(sent.some(([name,args])=>name==='O'&&args[0]===owner.sid&&args[1]===60));
});
