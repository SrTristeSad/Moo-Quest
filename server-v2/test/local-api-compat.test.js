import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/world.js';

test("V2 exposes every wildlife type used by the pre-V2 local client's spawn plan",()=>{
  const w=new World({seed:42});
  const counts=new Map();
  for(const a of w.animals.values())counts.set(a.index,(counts.get(a.index)||0)+1);
  for(const [index,count] of [[0,10],[1,8],[12,6],[2,5],[3,2],
    [4,6],[5,4],[9,4],[10,2],[6,1],[7,1],[8,1],[11,1]]){
      assert.equal(counts.get(index),count,'incorrect wildlife spawn count for '+index);
    }
  assert.equal(w.animals.size,51);
  const metadata=w.animalCatalog();
  assert.equal(metadata.length,13);
  for(const a of w.animals.values()){
    const descriptor=metadata.find(d=>d.id===a.index);
    assert.ok(descriptor&&descriptor.src&&descriptor.scale>0);
    if(a.area==='snow')assert.ok(a.y<=2400);
    if(a.area==='river')assert.ok(Math.abs(a.y-7200)<=350);
  }
  const p=w.join(null,'Human');
  const greeting=w.initialPackets(p)[0];
  assert.equal(greeting[0],'A');
  assert.equal(greeting[1][0].animals.length,13);
  assert.equal(w.animalPacket()[0].length,51*8);
});
test('wildlife death awards the real type score and tracks life stats',()=>{
  let now=60000;
  const w=new World({seed:9,now:()=>now});
  const p=w.join(null,'Collector');
  const wolf=[...w.animals.values()].find(a=>a.index===4);
  for(const [sid,a] of w.animals)if(a!==wolf)w.animals.delete(sid);
  p.x=wolf.x-40;p.y=wolf.y;p.angle=0;
  wolf.health=10;
  assert.equal(w.attack(p.id),true);
  assert.equal(wolf.health,0);
  assert.equal(p.resources.food,200);
  assert.equal(p.resources.points,500);
  assert.equal(p.lifeStats.animalDamage,10);
  assert.equal(p.lifeStats.animals,1);
  assert.equal(p.lifeStats.gold,500);
  assert.ok(w.takeEvents().some(e=>e.kind==='animal_down'&&e.sid===wolf.sid));
});
test('account life stats do not survive a completed death/respawn',()=>{
 let now=1000;const w=new World({now:()=>now,seed:1});
 const p=w.join(null,'player');p.native=true;
 p.lifeStats.kills=4;p.lifeStats.damage=500;
 p.hp=0;p.deadUntil=now+3000;now+=3001;
 assert.equal(w.respawn(p.id),true);
 assert.equal(p.lifeStats.kills,0);
 assert.equal(p.lifeStats.damage,0);
});

test('original Tribe Q packet can remove members only by their current owner',()=>{
 const w=new World({seed:18});
 const owner=w.join(null,'Owner'),other=w.join(null,'Another'),guest=w.join(null,'Guest');
 assert.equal(w.createTribe(owner.id,'TEAM'),true);
 assert.equal(w.requestTribe(other.id,'TEAM'),true);
 assert.equal(w.answerTribe(owner.id,other.sid,true),true);
 assert.equal(w.requestTribe(guest.id,'TEAM'),true);
 assert.equal(w.answerTribe(owner.id,guest.sid,true),true);
 assert.equal(w.kickTribe(other.id,guest.sid),false,'non-owner cannot kick');
 assert.equal(w.kickTribe(owner.id,owner.sid),false,'cannot kick self');
 assert.equal(w.kickTribe(owner.id,guest.sid),true);
 assert.equal(guest.team,null);
 assert.equal(w.kickTribe(owner.id,guest.sid),false);
 assert.equal(w.tribes.get('TEAM').members.has(guest.id),false);
 assert.equal(w.tribes.get('TEAM').members.has(owner.id),true);
});
