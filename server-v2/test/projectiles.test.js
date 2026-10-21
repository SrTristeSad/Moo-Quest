import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world.js';

function scenario(){
  let at=100000;
  const w=new World({seed:71,now:()=>at});
  w.resources.clear();w.animals.clear();w.events=[];
  const shooter=w.join(null,'Archer'),enemy=w.join(null,'Target');
  shooter.x=1000;shooter.y=1300;shooter.angle=0;
  enemy.x=1160;enemy.y=1300;
  shooter.resources.wood=50;
  return {w,shooter,enemy,advance:ms=>{at+=ms;return at;}};
}
test('bows must be unlocked at the correct age and selected by the owner',()=>{
  const {w,shooter}=scenario();
  assert.equal(w.select(shooter.id,9,true),false);
  shooter.age=5;shooter.upgradeAge=6;shooter.upgradePoints=1;
  assert.equal(w.upgrade(shooter.id,9),false);
  shooter.age=6;
  assert.equal(w.upgrade(shooter.id,9),true);
  assert.equal(w.upgrade(shooter.id,9),false);
  assert.ok(shooter.inventory.weapons.includes(9));
  assert.equal(w.select(shooter.id,9,true),true);
  assert.equal(shooter.weaponIndex,9);
  shooter.inventory.items.includes(3)&&w.select(shooter.id,3,false);
  assert.equal(shooter.buildIndex,3);
  assert.equal(w.select(shooter.id,3,false),true,'same build item must toggle off');
  assert.equal(shooter.buildIndex,-1);
  assert.equal(w.select(shooter.id,9,true),true);
});

test('authoritative swept arrow hits a player once, even across a fast tick',()=>{
  const {w,shooter,enemy,advance}=scenario();
  shooter.inventory.weapons.push(9);
  w.select(shooter.id,9,true);
  shooter.resources.wood=8;
  assert.equal(w.attack(shooter.id),true);
  assert.equal(shooter.resources.wood,4);
  assert.equal(w.projectiles.size,1);
  const events=w.takeEvents();
  const born=events.find(e=>e.kind==='projectile_spawn');
  assert.ok(born);assert.equal(born.type,0);assert.equal(born.speed,1.6);
  assert.equal(w.attack(shooter.id),false,'cooldown prevents shooting twice');
  w.tick(0.1);
  assert.equal(enemy.hp,75,'sweep must hit target between two positions');
  assert.equal(w.projectiles.size,0,'hit projectile removed from simulation');
  const after=w.takeEvents();
  assert.equal(after.filter(e=>e.kind==='hit'&&e.to===enemy.id).length,1);
  assert.ok(after.some(e=>e.kind==='projectile_end'&&e.sid===born.sid));
  advance(601);assert.equal(w.attack(shooter.id),true);
  assert.equal(shooter.resources.wood,0);
  advance(601);assert.equal(w.attack(shooter.id),false,'cannot create a free projectile without ammo');
  assert.equal(w.projectiles.size,1,'last legitimate arrow remains');
});

test('allied players cannot be injured by ranged weapons',()=>{
  const {w,shooter,enemy}=scenario();
  shooter.inventory.weapons.push(9);w.select(shooter.id,9,true);
  w.createTribe(shooter.id,'ALL');
  w.requestTribe(enemy.id,'ALL');
  w.answerTribe(shooter.id,enemy.sid,true);
  const hp=enemy.hp;
  assert.equal(w.attack(shooter.id),true);
  w.tick(0.1);
  assert.equal(enemy.hp,hp,'friendly arrow must not damage');
  assert.equal(w.projectiles.size,1,'arrow continues past ally');
  w.tick(0.1);
  assert.equal(enemy.hp,hp);
});

test('walls intercept arrows, protect their own team and can be destroyed by enemies',()=>{
  const {w,shooter,enemy,advance}=scenario();
  shooter.inventory.weapons.push(9);w.select(shooter.id,9,true);
  const wall={sid:4321,id:3,x:1160,y:1300,scale:50,hp:20,maxHp:20,owner:enemy.sid};
  w.structures.set(wall.sid,wall);
  enemy.x=1450;
  assert.equal(w.attack(shooter.id),true);
  w.tick(0.1);
  assert.equal(w.structures.has(wall.sid),false,'enemy wall should be destroyed');
  assert.ok(w.takeEvents().some(e=>e.kind==='destroy'&&e.sid===4321));
  // Own wall blocks an arrow but takes no damage.
  wall.owner=shooter.sid;wall.hp=20;
  w.structures.set(wall.sid,wall);
  advance(601);
  assert.equal(w.attack(shooter.id),true);
  w.tick(0.1);
  assert.equal(wall.hp,20);
  assert.equal(w.projectiles.size,0);
});

test('arrows expire without clients setting the projectile damage or travel range',()=>{
  const {w,shooter}=scenario();
  shooter.inventory.weapons.push(9);w.select(shooter.id,9,true);
  assert.equal(w.attack(shooter.id),true);
  const sid=[...w.projectiles.keys()][0];
  for(let n=0;n<12;n++)w.tick(0.1);
  assert.equal(w.projectiles.has(sid),false);
  const events=w.takeEvents();
  assert.equal(events.filter(e=>e.kind==='projectile_end'&&e.sid===sid).length,1);
});
