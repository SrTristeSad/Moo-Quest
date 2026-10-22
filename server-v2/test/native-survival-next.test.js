import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world.js';

// Regression coverage for actual LÖVE interaction semantics, with no NPCs,
// map editor or dependency on the legacy game engine.
test('food selection heals only when wounded and costs the server-owned amount',()=>{
  let at=10000;
  const world=new World({seed:77,now:()=>at});
  const p=world.join(null,'LÖVE Player');
  p.hp=55;p.resources.food=30;
  assert.equal(world.consume(p.id,0),false,'food must be selected');
  assert.equal(world.select(p.id,0,false),true);
  assert.equal(world.attack(p.id),true);
  assert.equal(p.hp,75);
  assert.equal(p.resources.food,20);
  assert.ok(world.takeEvents().some(e=>e.kind==='heal'&&e.hp===75));
  assert.equal(world.attack(p.id),false,'attack cooldown is enforced');
  at+=501;p.hp=100;
  assert.equal(world.attack(p.id),false,'do not spend food when already full');
  assert.equal(p.resources.food,20);
  at+=501;p.hp=80;p.resources.food=9;
  assert.equal(world.attack(p.id),false,'no heal without food');
  assert.equal(p.hp,80);
});

test('XP levels and upgrade selection use Lua numeric action indices',()=>{
  let at=20000;
  const w=new World({seed:15,now:()=>at});
  const p=w.join(null,'XP'),target=w.join(null,'Target');
  assert.equal(w.upgrade(p.id,1),false,'weapons cannot be unlocked before gaining a level');
  assert.equal(w.awardXp(p.id,60),true);
  assert.equal(p.age,2);
  assert.equal(p.upgradePoints,1);
  assert.equal(p.upgradeAge,2);
  assert.equal(w.upgrade(p.id,1),true);
  assert.deepEqual(p.inventory.weapons,[1],'chosen axe REPLACES starting hammer');
  assert.equal(p.weaponIndex,1);
  assert.equal(p.upgradePoints,0);
  assert.equal(p.upgradeAge,3);
  assert.equal(w.upgrade(p.id,3),false,'no extra stage-two choice');
  assert.equal(w.select(p.id,1,true),true);
  p.x=1000;p.y=1000;p.angle=0;target.x=1090;target.y=1000;
  assert.equal(w.attack(p.id),true);
  assert.equal(target.hp,77,'weapon damage is authoritative');
  at+=600;target.x=900;target.y=1000;
  assert.equal(w.attack(p.id),true);
  assert.equal(target.hp,77,'cannot hit a player behind you');
  // Item upgrade offsets match the existing Lua upgrade UI: 16+item ID.
  w.awardXp(p.id,150);
  assert.ok(p.age>=3);
  assert.ok(p.upgradePoints>0);
  assert.equal(w.upgrade(p.id,20),true);
  assert.ok(p.inventory.items.includes(4));
  assert.ok(w.takeEvents().some(e=>e.kind==='upgrade'&&e.equipmentKind==='item'&&e.id===4));
});

test('natural tree stays solid and visible after unlimited valid hits',()=>{
 let at=30000;const w=new World({seed:59,now:()=>at});
 const p=w.join(null,'Lumberjack');
 const obj=[...w.resources.values()].find(v=>v.kind==='tree');
 for(const [sid] of w.resources)if(sid!==obj.sid)w.resources.delete(sid);
 p.x=obj.x-170;p.y=obj.y;p.angle=0;
 const startHp=obj.hp;
 for(let i=0;i<12;i++){assert.equal(w.attack(p.id),true);at+=501;}
 assert.equal(p.resources.wood,12);
 assert.equal(w.resources.get(obj.sid),obj);
 assert.equal(obj.hp,startHp);
 assert.equal(w.depleted.has(obj.sid),false);
 assert.ok(!w.takeEvents().some(e=>e.kind==='destroy'&&e.sid===obj.sid));
 p.x=obj.x-180;p.y=obj.y;p.vx=1;p.vy=0;
 w.tick(0.1);
 assert.ok(Math.hypot(p.x-obj.x,p.y-obj.y)>=35+obj.scale*.6);
});

test('building damage and spikes are server-side, cannot hurt allies',()=>{
  let at=100000;
  const w=new World({seed:59,now:()=>at});
  const a=w.join(null,'Architect'),b=w.join(null,'Raider');
  a.resources.wood=100;a.resources.stone=100;
  w.select(a.id,3,false);
  let built=false;
  for(let x=1000;x<8000&&!built;x+=400){a.x=x;a.y=1000;a.angle=0;built=w.place(a.id,3);}
  assert.equal(built,true);
  const wall=[...w.structures.values()][0];
  a.x=8000;a.y=8000;
  b.x=wall.x-125;b.y=wall.y;b.angle=0;
  wall.hp=15;
  assert.equal(w.attack(b.id),true);
  assert.equal(w.structures.has(wall.sid),false);
  const events=w.takeEvents();
  assert.ok(events.some(e=>e.kind==='structure_hit'&&e.sid===wall.sid));
  assert.ok(events.some(e=>e.kind==='destroy'&&e.sid===wall.sid));
  w.select(a.id,6,false);
  built=false;
  for(let x=1500;x<8000&&!built;x+=400){a.x=x;a.y=1300;a.angle=0;built=w.place(a.id,6);}
  assert.equal(built,true);
  const spike=[...w.structures.values()].find(o=>o.id===6);
  b.x=spike.x;b.y=spike.y;
  at+=501;w.tick(0.05);
  assert.equal(b.hp,90);
  at+=100;w.tick(0.05);
  assert.equal(b.hp,90,'no tick-spam damage inside cooldown');
  assert.equal(w.createTribe(a.id,'SAFE'),true);
  assert.equal(w.requestTribe(b.id,'SAFE'),true);
  assert.equal(w.answerTribe(a.id,b.sid,true),true);
  at+=1100;w.tick(0.05);
  assert.equal(b.hp,90,'tribe members are protected against friendly spikes');
});

test('bush berries remain available without deleting their parent bush',()=>{
 let at=42000;const w=new World({seed:59,now:()=>at});
 const p=w.join(null,'Berry Picker');
 const bush=[...w.resources.values()].find(o=>o.kind==='bush');
 for(const [sid] of w.resources)if(sid!==bush.sid)w.resources.delete(sid);
 p.x=bush.x-125;p.y=bush.y;p.angle=0;
 for(let i=0;i<12;i++){assert.equal(w.attack(p.id),true);at+=501;}
 assert.equal(p.resources.food,12);
 assert.equal(w.resources.get(bush.sid),bush);
 assert.equal(bush.type,1);
 assert.equal(bush.hp,bush.maxHp);
 assert.equal(w.depleted.size,0);
 assert.ok(!w.takeEvents().some(e=>e.kind==='bush_empty'||e.kind==='destroy'));
});
