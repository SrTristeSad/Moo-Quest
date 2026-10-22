import test from 'node:test';
import assert from 'node:assert/strict';
import {World,PROJECTILE_TYPES} from '../src/world.js';
import {Projectile} from '../src/vendor/al007ex/projectile.js';
import {ProjectileManager} from '../src/vendor/al007ex/projectileManager.js';
import {EFFECT} from '../src/vendor/al007ex/effects.js';
import {referenceCapeEffects} from '../src/reference-bridge.js';

function arena(){
 let at=100000;
 const w=new World({seed:614,now:()=>at});
 w.resources.clear();w.animals.clear();w.structures.clear();
 const a=w.join(null,'Attacker'),b=w.join(null,'Target');
 a.x=1000;a.y=5000;a.angle=0;
 b.x=1070;b.y=5000;b.angle=Math.PI;
 a.motionX=a.motionY=b.motionX=b.motionY=0;
 return {w,a,b,time:()=>at,advance:n=>(at+=n)};
}
test('world really instantiates upstream ProjectileManager and recycles inactive Projectile',()=>{
 const {w,a}=arena();
 assert.ok(w.projectileManager instanceof ProjectileManager);
 const sid=w.spawnProjectile({owner:a.id,ownerSid:a.sid,team:null,
   x:1000,y:4500,dir:0,range:1000,speed:1.6,damage:28,type:0});
 const proj=w.projectiles.get(sid);
 assert.ok(proj instanceof Projectile);
 assert.equal(proj.indx,0);
 assert.equal(proj.scale,PROJECTILE_TYPES[0].scale);
 assert.equal(proj.dmg,28);
 assert.equal(w.projectilePool.length,1);
 w.projectiles.delete(sid);proj.active=false;
 const next=w.spawnProjectile({owner:a.id,ownerSid:a.sid,team:null,
   x:2000,y:4500,dir:1,range:300,speed:2.5,damage:35,type:2});
 assert.notEqual(next,sid);
 assert.strictEqual(w.projectiles.get(next),proj);
 assert.equal(proj.indx,2);assert.equal(proj.dmg,35);
 assert.equal(proj.scale,PROJECTILE_TYPES[2].scale);
 assert.equal(w.projectilePool.length,1);
});
test('Dragon Cape grants exactly 5 seconds of +5% damage after a PvP melee hit',()=>{
 const {w,a,b,time,advance}=arena();a.tail=2;
 assert.equal(w.attack(a.id),true);
 assert.equal(b.hp,75);
 assert.equal(a.dragonUntil,time()+EFFECT.dragonCapeTime);
 assert.equal(referenceCapeEffects(a,time()).damage,EFFECT.dragonCapeDamage);
 advance(400);
 assert.equal(w.attack(a.id),true);
 assert.equal(b.hp,49);
 advance(EFFECT.dragonCapeTime+1);
 assert.equal(referenceCapeEffects(a,time()).damage,1);
});
test('Super Cape grants ten seconds of damage and movement after PvP kill',()=>{
 const {w,a,b,time,advance}=arena();a.tail=1;b.hp=25;
 assert.equal(w.attack(a.id),true);assert.equal(b.hp,0);
 assert.equal(a.superUntil,time()+EFFECT.superCapeTime);
 assert.equal(referenceCapeEffects(a,time()).damage,EFFECT.superCapeDamage);
 assert.equal(referenceCapeEffects(a,time()).speed,EFFECT.superCapeSpeed);
 const next=w.join(null,'Next');next.x=1070;next.y=5000;
 advance(400);assert.equal(w.attack(a.id),true);
 assert.equal(next.hp,74,'the second hit carries boosted damage');
 advance(EFFECT.superCapeTime+1);
 assert.equal(referenceCapeEffects(a,time()).speed,1);
 assert.equal(referenceCapeEffects(a,time()).damage,1);
});
test('Super Cape triggers from server-authorized ranged and poison PvP kills',()=>{
 const {w,a,b,time,advance}=arena();a.tail=1;b.x=1160;b.hp=20;
 const sid=w.spawnProjectile({owner:a.id,ownerSid:a.sid,team:null,
   x:1046,y:5000,dir:0,range:300,speed:1.6,damage:25,type:0});
 w.tick(.1);
 assert.equal(b.hp,0);
 assert.equal(a.superUntil,time()+EFFECT.superCapeTime);
 assert.ok(!w.projectiles.has(sid));
 const c=w.join(null,'Poisoned');c.x=1070;c.y=5000;c.hp=4;
 c.poison={damage:5,until:time()+3000,nextAt:time()+1000,from:a.id};
 advance(1000);w.tick(.1);
 assert.equal(c.hp,0);
 assert.equal(a.superUntil,time()+EFFECT.superCapeTime);
});
test('temporary cape combat boosts reset on respawn',()=>{
 const {w,a,time}=arena();a.tail=1;
 a.superUntil=time()+10000;a.dragonUntil=time()+5000;
 a.hp=0;a.deadUntil=time();
 assert.equal(w.respawn(a.id),true);
 assert.equal(a.superUntil,0);assert.equal(a.dragonUntil,0);
 assert.equal(referenceCapeEffects(a,time()).damage,1);
 assert.equal(referenceCapeEffects(a,time()).speed,1);
});
