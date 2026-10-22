import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/world.js';

function isolated(seed=123){
 let time=100000;
 const w=new World({seed,now:()=>time});
 w.resources.clear();w.structures.clear();w.animals.clear();
 return {w,advance(ms){time+=ms;}};
}

test('new primary replaces hammer, secondary leaves primary intact, evolved primary replaces predecessor',()=>{
 const {w}=isolated();
 const p=w.join(null,'Upgrader');
 p.age=2;p.upgradeAge=2;p.upgradePoints=1;
 assert.equal(w.upgrade(p.id,3),true);
 assert.deepEqual(p.inventory.weapons,[3]);
 assert.equal(p.weaponIndex,3);
 assert.equal(w.select(p.id,0,true),false);
 assert.equal(w.upgrade(p.id,1),false,'cannot buy two age-two primaries');
 p.age=6;p.upgradeAge=6;p.upgradePoints=1;
 assert.equal(w.upgrade(p.id,9),true);
 assert.deepEqual(p.inventory.weapons,[3,9],'secondary bow remains separate');
 p.age=8;p.upgradeAge=8;p.upgradePoints=1;
 assert.equal(w.upgrade(p.id,4),true);
 assert.deepEqual(p.inventory.weapons,[9,4],'katana replaces short sword, retains bow');
 assert.ok(!p.inventory.weapons.includes(3));
});

test('river rightward current is visible even with no movement keys held',()=>{
 const {w,advance}=isolated(19);
 const p=w.join(null,'Swimmer');
 p.x=500;p.y=w.size/2;p.vx=0;p.vy=0;
 let lastDrift=0;
 for(let i=0;i<10;i++){
   const before=p.x;advance(100);w.tick(0.1);lastDrift=p.x-before;
 }
 assert.ok(p.x>=540,'current must visibly displace a swimmer in one second: '+p.x);
 const upstream=p.x;
 p.vx=-1;advance(100);w.tick(0.1);
 assert.ok(p.x>upstream,'reference current can overpower swimming left');
 assert.ok(p.x-upstream<lastDrift,'left input must reduce rightward drift');
 p.y=5000;p.vx=0;
 const dry=p.x;advance(100);w.tick(0.1);
 assert.ok(p.x>dry,'momentum persists briefly after leaving water');
});

test('wolf and bull pursue at realistic speeds within their species aggro range',()=>{
 const {w,advance}=isolated(93);
 const wolf=[...new World({seed:93}).animals.values()].find(a=>a.index===4);
 const bull=[...new World({seed:93}).animals.values()].find(a=>a.index===2);
 for(const a of [wolf,bull]){
   w.animals.clear();w.animals.set(a.sid,a);
   a.x=1000;a.y=1600;a.homeX=1000;a.homeY=1600;
   a.dir=0;a.targetDir=0;a.motionX=0;a.motionY=0;a.waitLeft=1000;
   const p=w.join(null,'Target');p.x=1500;p.y=1600;p.vx=0;p.vy=0;
   for(let i=0;i<12;i++){advance(100);w.tick(0.1);}
   assert.ok(a.x>1020,a.index+' fails to charge after wait: '+a.x);
   assert.ok(a.x<1200,a.index+' should not teleport');
   w.leave(p.id);
 }
});

test('cows and pigs do not chase nearby peaceful players',()=>{
 const {w,advance}=isolated(7);
 const cow={sid:30000,index:0,x:1000,y:5000,homeX:1000,homeY:5000,
   dir:Math.PI,speed:65,scale:72,damage:0,health:500,maxHealth:500,
   hostile:false,viewRange:0,nextAttack:0,deadUntil:0,state:0};
 w.animals.set(cow.sid,cow);
 const p=w.join(null,'Harmless');p.x=1160;p.y=5000;
 advance(100);w.tick(0.1);
 assert.ok(cow.x<=1000,'a non-hostile cow must not pursue a player');
});

test('attack checks target body radius and facing instead of arbitrary center distance',()=>{
 let at=20000;const w=new World({seed:89,now:()=>at});
 w.resources.clear();w.animals.clear();
 const p=w.join(null,'Attacker'),target=w.join(null,'Victim');
 p.x=1000;p.y=5000;p.angle=0;
 target.x=1099;target.y=5000;
 assert.equal(w.attack(p.id),true);
 assert.ok(target.hp<100,'target edge must be within the hammer reach');
 const hp=target.hp;
 at+=600;p.angle=Math.PI;
 assert.equal(w.attack(p.id),true);
 assert.equal(target.hp,hp,'player behind the attacker must not take damage');
});

test('old registered profiles with hammer and sword are migrated on login',()=>{
 const {w}=isolated(26);
 const p=w.join(null,'Returning player');
 const snapshot=w.persistentProfile(p);
 snapshot.age=3;snapshot.hp=100;snapshot.inventory.weapons=[0,3,9];
 snapshot.weaponIndex=0;
 const r=w.join(null,'Registered',snapshot,'account-id');
 assert.deepEqual(r.inventory.weapons,[3,9]);
 assert.equal(r.weaponIndex,3);
 const saved=w.persistentProfile(r);
 assert.deepEqual(saved.inventory.weapons,[3,9],
   'subsequent saves must not reintroduce the hammer');
});

test('legacy server-owned animal records without scale never become NaN',()=>{
 const {w,advance}=isolated(12);
 const a={sid:919,index:2,x:2000,y:4000,dir:0,homeX:2000,homeY:4000,
   health:200,maxHealth:200,speed:0,damage:12,nextAttack:0,deadUntil:0};
 w.animals.set(a.sid,a);
 advance(100);w.tick(0.1);
 assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.y));
 assert.equal(a.x,2000);assert.equal(a.y,4000);
});
