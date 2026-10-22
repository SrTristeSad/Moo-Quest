import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world.js';

function sandbox(){
  let at=100_000;
  const w=new World({seed:999,now:()=>at});
  w.resources.clear();w.animals.clear();w.events=[];
  const owner=w.join(null,'Builder'),rival=w.join(null,'Rival');
  owner.x=2000;owner.y=1100;owner.angle=0;
  rival.x=2500;rival.y=1100;rival.angle=0;
  owner.resources={wood:1000,stone:1000,food:300,points:0,kills:0};
  rival.resources={wood:1000,stone:1000,food:300,points:0,kills:0};
  return {w,owner,rival,advance:ms=>{at+=ms;return at;}};
}
function build(w,p,id,x=2000,y=1100){
  if(!p.inventory.items.includes(id))p.inventory.items.push(id);
  p.x=x;p.y=y;p.angle=0;
  assert.equal(w.select(p.id,id,false),true);
  assert.equal(w.place(p.id,id),true,`item ${id} should build when owned, with enough resources`);
  return [...w.structures.values()].at(-1);
}

test('stage four offers traps and boosts through existing Lua upgrade IDs',()=>{
  const {w,owner}=sandbox();
  assert.equal(w.upgrade(owner.id,32),false,'cannot take boost before age four');
  owner.age=4;owner.upgradeAge=4;owner.upgradePoints=1;
  assert.equal(w.upgrade(owner.id,32),true);
  assert.ok(owner.inventory.items.includes(16));
  assert.equal(w.upgrade(owner.id,31),false,'one choice per age');
  assert.equal(owner.upgradeAge,5);
  const [second]=[w.join(null,'Second')];
  second.age=4;second.upgradeAge=4;second.upgradePoints=1;
  assert.equal(w.upgrade(second.id,31),true,'pit trap must be selectable separately');
  assert.ok(second.inventory.items.includes(15));
});

test('boost pad increases movement speed only when a live player stands on it',()=>{
  const {w,owner,rival}=sandbox();
  const pad=build(w,owner,16);
  rival.x=pad.x;rival.y=pad.y;rival.vx=1;rival.vy=0;
  w.tick(0.1);
  assert.equal(rival.x,pad.x+28.125,'snow boost is speed 250 * 1.5 * 0.75 * 100ms');
  rival.x=pad.x+500;rival.y=pad.y;
  w.tick(0.1);
  assert.equal(rival.x,pad.x+518.75,'off-pad snow uses terrain factor 0.75');
});

test('pit trap temporarily roots enemies, cannot root owner/tribe allies or re-trigger each tick',()=>{
  const {w,owner,rival,advance}=sandbox();
  const pit=build(w,owner,15);
  assert.equal(owner.rootedUntil,0);
  rival.x=pit.x;rival.y=pit.y;rival.vx=1;
  w.tick(0.05);
  const caughtX=rival.x;
  assert.ok(rival.rootedUntil>100_000);
  assert.equal(w.takeEvents().filter(e=>e.kind==='trap').length,1);
  advance(100);w.tick(0.1);
  assert.equal(rival.x,caughtX,'rooted player cannot walk through trap');
  assert.equal(w.takeEvents().filter(e=>e.kind==='trap').length,0);
  advance(1250);w.tick(0.1);
  assert.ok(rival.x>caughtX,'player can escape before trap re-arms');
  assert.equal(owner.rootedUntil,0);
  const {w:friends,owner:a,rival:b}=sandbox();
  const safe=build(friends,a,15);
  assert.equal(friends.createTribe(a.id,'TEAM'),true);
  assert.equal(friends.requestTribe(b.id,'TEAM'),true);
  assert.equal(friends.answerTribe(a.id,b.sid,true),true);
  b.x=safe.x;b.y=safe.y;friends.tick(0.1);
  assert.equal(b.rootedUntil,0,'tribe members cannot be rooted');
});

test('healing pad heals allies once per second, never enemies or full-health players',()=>{
  const {w,owner,rival,advance}=sandbox();
  const pad=build(w,owner,19);
  owner.x=pad.x;owner.y=pad.y;owner.hp=65;
  rival.x=pad.x;rival.y=pad.y;rival.hp=50;
  w.tick(0.05);
  assert.equal(owner.hp,75);assert.equal(rival.hp,50);
  advance(999);w.tick(0.05);
  assert.equal(owner.hp,75,'no per-tick healing exploit');
  advance(1);w.tick(0.05);
  assert.equal(owner.hp,85);
  assert.equal(w.takeEvents().filter(e=>e.kind==='heal').length,2);
  w.createTribe(owner.id,'CARE');w.requestTribe(rival.id,'CARE');
  w.answerTribe(owner.id,rival.sid,true);
  advance(1000);w.tick(0.05);
  assert.equal(rival.hp,60,'authorized tribe ally is healed');
  owner.hp=100;advance(1000);w.tick(0.05);
  assert.equal(owner.hp,100,'health cannot exceed maximum');
});

test('building blocker prevents enemy construction without spending any materials',()=>{
  const {w,owner,rival}=sandbox();
  const blocker=build(w,owner,21);
  rival.x=blocker.x+105;rival.y=blocker.y;rival.angle=0;
  rival.inventory.items.push(4);
  w.select(rival.id,4,false);
  const before=rival.resources.stone;
  assert.equal(w.place(rival.id,4),false);
  assert.equal(rival.resources.stone,before);
  // Owner and allies may construct in their own protected area.
  w.createTribe(owner.id,'AREA');w.requestTribe(rival.id,'AREA');
  w.answerTribe(owner.id,rival.sid,true);
  assert.equal(w.place(rival.id,4),true,'ally can build outside physical collision');
  assert.equal(rival.resources.stone,before-25);
});

test('mill income is elapsed-time based, fractional, capped during stalls, and per owner',()=>{
  const {w,owner,rival,advance}=sandbox();
  // Each structure has an individual value. The world is authoritative.
  for(const [sid,id] of [[9101,10],[9102,11],[9103,12]]){
    w.structures.set(sid,{sid,id,owner:owner.sid,x:3000+sid,y:1100,scale:45,hp:400});
  }
  w.tick(0.05);
  assert.equal(owner.resources.points,0);
  advance(2000);w.tick(0.05);
  assert.equal(owner.resources.points,9,'1 + 1.5 + 2 gold/s, for 2 seconds');
  assert.equal(rival.resources.points,0,'no income leak across owners');
  advance(100);w.tick(0.05);
  assert.equal(owner.resources.points,9,'no free gold from extra ticks');
  advance(1000);w.tick(0.05);
  assert.equal(owner.resources.points,13,'fractional gold is preserved');
  advance(60000);w.tick(0.05);
  assert.equal(owner.resources.points,36,'60-second stalled tick limited to 5-second gain');
  const gain=w.takeEvents().filter(e=>e.kind==='income');
  assert.ok(gain.length>=3);
});

test('Lua item group counts combine different wall and mill grades',()=>{
  const {w,owner,rival}=sandbox();
  rival.x=10000;rival.y=10000;
  build(w,owner,3);
  build(w,owner,4,2400,1100);
  build(w,owner,10,2800,1100);
  build(w,owner,11,3200,1100);
  assert.deepEqual(w.structureCount(owner.sid,3),{group:1,count:2});
  assert.deepEqual(w.structureCount(owner.sid,4),{group:1,count:2});
  assert.deepEqual(w.structureCount(owner.sid,10),{group:3,count:2});
  assert.deepEqual(w.structureCount(owner.sid,11),{group:3,count:2});
  assert.equal(w.structureCount(owner.sid,999),null);
});
