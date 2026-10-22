import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world.js';
import { Projectile } from '../src/vendor/al007ex/projectile.js';

test('new V2 arrows are instances of unmodified upstream Projectile',()=>{
 const world=new World({seed:71,now:()=>100000});
 world.animals.clear();world.resources.clear();world.structures.clear();
 const a=world.join(null,'Archer');a.x=1000;a.y=4000;a.angle=0;
 a.inventory.weapons.push(9);a.resources.wood=20;
 assert.equal(world.select(a.id,9,true),true);
 assert.equal(world.attack(a.id),true);
 const arrow=[...world.projectiles.values()][0];
 assert.ok(arrow instanceof Projectile);
 assert.equal(arrow.indx,0);
 assert.equal(arrow.speed,1.6);
 assert.equal(arrow.range,1000);
 assert.equal(arrow.damage,25);
 assert.equal(arrow.dmg,25);
 assert.equal(arrow.skipMov,false);
 world.tick(.1);
 assert.ok(Math.abs(arrow.x-1160)<.1);
 assert.equal(arrow.range,840);
});
test('original Projectile.update respects range capping and V2 emits one end',()=>{
 const world=new World({seed:73,now:()=>100000});
 world.animals.clear();world.resources.clear();world.structures.clear();
 const a=world.join(null,'Archer');a.x=1000;a.y=4000;
 const sid=world.spawnProjectile({
  owner:a.id,ownerSid:a.sid,team:null,
  x:1000,y:4000,dir:0,range:50,speed:1.6,damage:25,type:0
 });
 const a0=world.projectiles.get(sid);
 assert.ok(a0 instanceof Projectile);
 world.tick(.1);
 assert.equal(world.projectiles.has(sid),false);
 assert.equal(world.takeEvents().filter(e=>e.kind==='projectile_end'&&e.sid===sid).length,1);
});
