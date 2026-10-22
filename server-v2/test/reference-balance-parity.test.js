import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/world.js';

function room(seed=101){
 let time=120000;
 const w=new World({seed,now:()=>time});
 w.resources.clear();w.structures.clear();w.animals.clear();
 return {w,advance(ms){time+=ms;}};
}

test('reference first age requires 300 XP, not the old V2 threshold of 60',()=>{
 const {w}=room();const p=w.join(null,'Leveler');
 assert.equal(p.age,1);
 assert.equal(p.maxXp,300);
 w.awardXp(p.id,299);assert.equal(p.age,1);
 w.awardXp(p.id,1);
 assert.equal(p.age,2);
 assert.equal(p.maxXp,360);
 assert.equal(p.upgradePoints,1);
});
test('reference starter hammer and melee weapons use original combat values',()=>{
 let at=200000;const w=new World({seed:4,now:()=>at});
 w.resources.clear();w.animals.clear();
 const a=w.join(null,'Attacker'),b=w.join(null,'Defender');
 a.x=1000;a.y=5000;a.angle=0;b.x=1098;b.y=5000;
 assert.equal(w.attack(a.id),true);
 assert.equal(b.hp,75,'hammer deals 25 when enemy edge within 65');
 at+=299;
 assert.equal(w.attack(a.id),false,'300 ms hammer cooldown');
 at+=1;
 assert.equal(w.attack(a.id),true);
 assert.equal(b.hp,50);
 a.inventory.weapons=[3];a.weaponIndex=3;
 b.x=1140;b.hp=100;at+=300;
 assert.equal(w.attack(a.id),true);
 assert.equal(b.hp,65,'short sword deals 35 within range 110');
});
test('gold ore yields five points and never becomes stone; regular stones only yield stone',()=>{
 const {w,advance}=room(150);
 const p=w.join(null,'Miner');p.x=1000;p.y=5000;p.angle=0;
 const ore={sid:9000,kind:'ore',type:3,x:1090,y:5000,scale:85,hp:300,maxHp:300};
 w.resources.set(ore.sid,ore);
 assert.equal(w.attack(p.id),true);
 assert.equal(p.resources.points,5);
 assert.equal(p.resources.stone,0);
 assert.equal(p.score,5);
 assert.equal(p.xp,4);
 assert.equal(p.weaponXp[0],5);
 assert.equal(w.resources.has(ore.sid),true);
 w.resources.clear();advance(300);
 w.resources.set(9001,{...ore,sid:9001,kind:'stone',type:2});
 assert.equal(w.attack(p.id),true);
 assert.equal(p.resources.stone,1);
 assert.equal(p.resources.points,5,'stone should not produce free gold');
 assert.equal(p.weaponXp[0],6);
});
test('weapon-specific experience persists safely and maps to variant metadata',()=>{
 const {w}=room(16);const p=w.join(null,'Smith');
 p.weaponXp[0]=3000;
 assert.equal(w.weaponVariant(p),1);
 assert.equal(w.playerUpdates()[1][3],1);
 p.weaponXp[0]=7500;
 assert.equal(w.weaponVariant(p),2);
 p.weaponXp[0]=12500;
 assert.equal(w.weaponVariant(p),3);
 p.weaponXp[0]=31000;
 assert.equal(w.weaponVariant(p),3,'emerald is membership-locked');
 const saved=w.persistentProfile(p);
 const q=w.join(null,'Restored',saved,'account');
 assert.equal(q.weaponXp[0],31000);
 assert.equal(w.weaponVariant(q),3);
});
test('weapon weight and build stance affect authoritative speed',()=>{
 const {w,advance}=room(170);
 w.players.clear();
 const create=(name,weaponIndex,buildIndex)=>{
  const p=w.join(null,name);p.x=500;p.y=5000;p.vx=1;p.vy=0;
  p.weaponIndex=weaponIndex;p.buildIndex=buildIndex;return p;
 };
 const base=create('Hammer',0,-1),sword=create('Sword',3,-1);
 const dagger=create('Dagger',7,-1),building=create('Builder',0,3);
 advance(100);w.tick(0.1);
 assert.ok(sword.x<base.x,'short sword slows movement');
 assert.ok(dagger.x>base.x,'dagger speeds movement');
 assert.ok(building.x<base.x,'building placement slows movement');
});
