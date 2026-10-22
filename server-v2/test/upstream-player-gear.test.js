import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/world.js';

function arena(){
 let time=100000;
 const w=new World({seed:932,now:()=>time});
 w.resources.clear();w.animals.clear();w.structures.clear();
 const a=w.join(null,'Attacker'),b=w.join(null,'Enemy');
 a.x=1000;a.y=5000;a.angle=0;
 b.x=1070;b.y=5000;
 a.motionX=a.motionY=b.motionX=b.motionY=0;
 return {w,a,b,at:()=>time,advance:ms=>{time+=ms;}};
}
test('original Player.gather hit slow and Player.update decay affect V2 movement',()=>{
 const {w,a,advance}=arena();
 a.vx=1;
 assert.equal(w.attack(a.id),true);
 assert.equal(a.slowMult,0.7);
 advance(100);w.tick(.1);
 assert.ok(Math.abs(a.slowMult-0.78)<1e-8);
 assert.ok(a.x>1000&&a.x<1016);
 advance(1000);w.tick(.1);
 assert.ok(a.slowMult>0.78);
 for(let i=0;i<3;i++){advance(100);w.tick(.1);}
 assert.equal(a.slowMult,1);
});
test('musket fires one valid projectile and pushes owner backwards',()=>{
 const {w,a}=arena();
 a.inventory.weapons.push(15);a.weaponIndex=15;
 a.resources.stone=20;
 assert.equal(w.attack(a.id),true);
 assert.equal(a.resources.stone,10);
 assert.ok(Math.abs(a.motionX+350)<0.001);
 assert.equal(w.projectiles.size,1);
 assert.equal([...w.projectiles.values()][0].indx,5);
});
test('Turret Gear finds nearest enemy, respects 2500ms cooldown and uses original projectile 1',()=>{
 const {w,a,b,advance}=arena();
 b.x=1200;
 a.hat=53;
 advance(100);w.tick(.1);
 const shots=w.takeEvents().filter(e=>e.kind==='projectile_spawn');
 assert.equal(shots.length,1);
 assert.equal(shots[0].type,1);
 assert.equal(shots[0].speed,1.6);
 assert.equal(a.nextGearShotAt,100100+2500);
 advance(100);w.tick(.1);
 assert.equal(b.hp,75);
 assert.equal(w.takeEvents().filter(e=>e.kind==='projectile_spawn').length,0);
});
test('wearable turret never targets allies or EMP Helmet, then resumes when enemy available',()=>{
 const {w,a,b,advance}=arena();
 b.x=1200;a.hat=53;a.team='TEAM';b.team='TEAM';
 w.tick(.1);
 assert.equal(w.takeEvents().filter(e=>e.kind==='projectile_spawn').length,0);
 b.team=null;b.hat=22;
 advance(251);w.tick(.1);
 assert.equal(w.takeEvents().filter(e=>e.kind==='projectile_spawn').length,0);
 b.hat=0;
 advance(251);w.tick(.1);
 assert.equal(w.takeEvents().filter(e=>e.kind==='projectile_spawn').length,1);
});
test('Plague Mask gives six 5-damage poison pulses on melee',()=>{
 const {w,a,b,at,advance}=arena();a.hat=21;
 assert.equal(w.attack(a.id),true);
 assert.equal(b.hp,75);
 assert.equal(b.poison.damage,5);
 assert.equal(b.poison.until,at()+6000);
 advance(1000);w.tick(.1);
 assert.equal(b.hp,70);
});
test('Bull Mask suppresses unprovoked hostile targeting but not provoked pursuit',()=>{
 const {w,a}=arena();
 a.hat=46;
 const bull=[...new World({seed:4}).animals.values()].find(z=>z.index===2);
 w.animals.set(bull.sid,bull);
 bull.x=1100;bull.y=5000;bull.homeX=1100;bull.homeY=5000;
 bull.waitLeft=1;bull.moveLeft=0;bull.chargeTargetId=null;
 w.tick(.1);
 assert.equal(bull.chargeTargetId,null);
 bull.lastAttackerId=a.id;bull.waitLeft=1;bull.moveLeft=0;
 w.tick(.1);
 assert.equal(bull.chargeTargetId,a.id);
});
test('Dark Knight heals 40% actual PvP damage, Bloodthirster heals 25% and adds 20% damage',()=>{
 for(const [hat,damage,healing] of [[58,25,10],[55,30,8]]){
  const {w,a,b}=arena();a.hat=hat;a.hp=50;
  w.attack(a.id);
  assert.equal(b.hp,100-damage);
  assert.equal(a.hp,50+healing);
 }
});
