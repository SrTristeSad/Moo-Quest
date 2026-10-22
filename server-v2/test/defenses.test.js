import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world.js';

function create(){
  let now=100000;
  const world=new World({seed:654,now:()=>now});
  world.resources.clear();world.animals.clear();world.events=[];
  const owner=world.join(null,'Builder');
  const attacker=world.join(null,'Raider');
  owner.x=2000;owner.y=2000;owner.angle=0;
  attacker.x=2400;attacker.y=2000;attacker.angle=Math.PI;
  return {world,owner,attacker,advance:ms=>{now+=ms;return now;}};
}

test('equipped wooden shield absorbs only frontal melee damage and cannot attack',()=>{
  const {world,owner,attacker,advance}=create();
  owner.age=6;owner.upgradeAge=6;owner.upgradePoints=1;
  assert.equal(world.select(owner.id,11,true),false,'shield is locked');
  assert.equal(world.upgrade(owner.id,11),true);
  assert.equal(world.select(owner.id,11,true),true);
  owner.x=2000;owner.y=2000;owner.angle=0;
  attacker.x=2070;attacker.y=2000;attacker.angle=Math.PI;
  assert.equal(world.attack(attacker.id),true);
  assert.equal(owner.hp,95,'wood shield lets through 20% of 25 melee damage');
  advance(501);
  owner.angle=Math.PI;
  assert.equal(world.attack(attacker.id),true);
  assert.equal(owner.hp,70,'attacks from behind deal the full 25 damage');
  advance(501);
  assert.equal(world.attack(owner.id),false,'shield selection must not fall back to hammer');
  assert.equal(attacker.hp,100);
});

test('shield protects frontally against player arrows but not back shots',()=>{
  const {world,owner,attacker,advance}=create();
  owner.inventory.weapons.push(11);world.select(owner.id,11,true);
  attacker.inventory.weapons.push(9);world.select(attacker.id,9,true);
  attacker.resources.wood=8;attacker.x=1000;attacker.y=2000;attacker.angle=0;
  owner.x=1170;owner.y=2000;owner.angle=Math.PI;
  assert.equal(world.attack(attacker.id),true);
  world.tick(0.1);
  assert.equal(owner.hp,95,'wood shield lets through 5 of 25 projectile damage');
  advance(601);
  owner.angle=0;
  assert.equal(world.attack(attacker.id),true);
  world.tick(0.1);
  assert.equal(owner.hp,70,'rear projectile deals the full 25');
  assert.equal(attacker.resources.wood,0);
});

test('a player must unlock and pay for turrets, limited to two structures',()=>{
  const {world,owner}=create();
  owner.resources.wood=600;owner.resources.stone=500;
  assert.equal(world.select(owner.id,17,false),false,'no turret before age 7 upgrade');
  owner.age=7;owner.upgradePoints=1;owner.upgradeAge=7;
  assert.equal(world.upgrade(owner.id,33),true);
  assert.ok(owner.inventory.items.includes(17));
  assert.equal(world.select(owner.id,17,false),true);
  assert.equal(world.place(owner.id,17),true);
  assert.equal(owner.resources.wood,400);
  assert.equal(owner.resources.stone,350);
  owner.x=2700;
  assert.equal(world.place(owner.id,17),true);
  assert.equal(owner.resources.wood,200);
  assert.equal(owner.resources.stone,200);
  owner.x=3400;
  assert.equal(world.place(owner.id,17),false,'limit 2 cannot be bypassed with extra resources');
  assert.equal(owner.resources.wood,200,'failed construction must not spend wood');
  assert.equal(world.structures.size,2);
});

test('turrets target enemies, send rotation and projectile events, then obey server cooldown',()=>{
  const {world,owner,attacker,advance}=create();
  owner.inventory.items.push(17);
  owner.resources.wood=300;owner.resources.stone=200;
  world.select(owner.id,17,false);
  assert.equal(world.place(owner.id,17),true);
  const turret=[...world.structures.values()][0];
  attacker.x=turret.x+350;attacker.y=turret.y;
  world.takeEvents();
  world.tick(0.05);
  assert.equal(world.projectiles.size,1);
  const launched=world.takeEvents();
  const shot=launched.find(e=>e.kind==='turret_shot');
  const spawn=launched.find(e=>e.kind==='projectile_spawn');
  assert.equal(shot.sid,turret.sid);
  assert.equal(spawn.type,1);
  assert.equal(spawn.layer,1);
  assert.equal(spawn.speed,1.7);
  assert.equal(world.projectiles.get(spawn.sid).sourceSid,turret.sid);
  world.tick(0.1);world.tick(0.1);
  assert.equal(attacker.hp,82,'turret projectile should damage enemy exactly once');
  assert.equal(world.projectiles.size,0);
  assert.ok(world.takeEvents().some(e=>e.kind==='projectile_end'&&e.sid===spawn.sid));
  world.tick(0.1);
  assert.equal(world.projectiles.size,0,'cooldown prevents rapid-fire');
  advance(2201);world.tick(0.05);
  assert.equal(world.projectiles.size,1,'next shot comes only after elapsed cooldown');
});

test('a turret ignores allies, does not hit its own emplacement and stops when destroyed',()=>{
  const {world,owner,attacker}=create();
  owner.inventory.items.push(17);owner.resources.wood=300;owner.resources.stone=200;
  world.select(owner.id,17,false);assert.equal(world.place(owner.id,17),true);
  const turret=[...world.structures.values()][0];
  attacker.x=turret.x+260;attacker.y=turret.y;
  assert.equal(world.createTribe(owner.id,'DEF'),true);
  assert.equal(world.requestTribe(attacker.id,'DEF'),true);
  assert.equal(world.answerTribe(owner.id,attacker.sid,true),true);
  world.tick(0.05);
  assert.equal(world.projectiles.size,0,'no targeting allied players');
  world.leaveTribe(attacker.id);
  world.tick(0.05);
  assert.equal(world.projectiles.size,1,'enemy now receives an aimed shot');
  const id=[...world.projectiles.keys()][0];
  attacker.x=turret.x+650; // allow the shot to travel without hitting the player yet
  world.tick(0.1);
  assert.ok(world.projectiles.has(id),'projectile must not collide with its own turret');
  world.structures.delete(turret.sid);
  world.projectiles.clear();
  world.tick(0.05);
  assert.equal(world.projectiles.size,0,'destroyed tower can never fire again');
});
