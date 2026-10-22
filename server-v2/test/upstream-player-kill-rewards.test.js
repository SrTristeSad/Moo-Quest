import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/world.js';
import {GameServer} from '../src/game.js';
function arena(){
 let now=100000;
 const w=new World({seed:3,now:()=>now});
 w.resources.clear();w.animals.clear();w.structures.clear();
 const a=w.join(null,'A'),b=w.join(null,'B');
 a.x=1000;a.y=5000;a.angle=0;b.x=1070;b.y=5000;b.hp=25;
 return {w,a,b,advance:n=>now+=n};
}
test('upstream Player.kill age reward and Lua points message',()=>{
 const {w,a,b}=arena();b.age=3;
 w.attack(a.id);
 assert.equal(b.hp,0);assert.equal(a.resources.points,300);
 assert.equal(a.resources.kills,1);assert.equal(a.score,300);
 const list=w.takeEvents().filter(e=>e.kind==='pvp_reward');
 const sent=[];
 GameServer.prototype._nativeEvents.call({room:w,
  nativeClients:new Map([[1,{p:a,send:(name,args)=>sent.push([name,args])}]])},list);
 assert.deepEqual(sent,[['N',['points',300,1]]]);
});
test('Scavenger doubles reward; Thief Gear pays half victim gold',()=>{
 for(const [hat,age,gold,reward] of [[27,4,0,800],[52,10,501,251]]){
  const {w,a,b}=arena();a.hat=hat;b.age=age;b.resources.points=gold;
  w.attack(a.id);
  assert.equal(a.resources.points,reward);
  assert.equal(a.score,reward);
 }
});
test('projectile and poison kill payouts are each credited exactly once',()=>{
 const {w,a,b,advance}=arena();b.age=2;b.x=1160;
 w.spawnProjectile({owner:a.id,ownerSid:a.sid,team:null,
   x:1046,y:5000,dir:0,range:300,speed:1.6,damage:25,type:0});
 w.tick(.1);
 assert.equal(b.hp,0);assert.equal(a.resources.points,200);
 const c=w.join(null,'C');c.hp=4;c.age=4;c.x=1070;c.y=5000;
 c.poison={damage:5,nextAt:101000,until:103000,from:a.id};
 advance(1000);w.tick(.1);
 assert.equal(c.hp,0);assert.equal(a.resources.points,600);
 assert.equal(a.resources.kills,2);
 w.tick(.1);assert.equal(a.resources.points,600);
});
