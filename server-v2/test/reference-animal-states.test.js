import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/world.js';

function make(){
 let time=150000;
 const w=new World({seed:20261022,now:()=>time});
 w.resources.clear();w.structures.clear();
 w.animals.clear();
 return {w,tick(ms=100){time+=ms;w.tick(ms/1000)}};
}

test('bull waits before charge and cannot instantly snap its facing',()=>{
 const {w,tick}=make();
 const source=new World({seed:20261022});
 const a=[...source.animals.values()].find(x=>x.index===2);
 w.animals.set(a.sid,a);
 a.x=1000;a.y=5000;a.dir=Math.PI;a.targetDir=Math.PI;
 a.waitLeft=1000;a.moveLeft=0;a.motionX=0;a.motionY=0;
 const player=w.join(null,'Target');player.x=1400;player.y=5000;
 tick(100);
 assert.equal(a.chargeTargetId,null,'bull must wait before acquiring a target');
 assert.equal(a.x,1000,'no charging movement during initial wait');
 for(let i=0;i<9;i++)tick(100);
 assert.equal(a.chargeTargetId,player.id,'visible player selected after waiting');
 const before=a.dir;
 tick(100);
 const turned=Math.abs(Math.atan2(Math.sin(a.dir-before),Math.cos(a.dir-before)));
 assert.ok(turned<=0.074001,'turn bounded by 0.00074 rad/ms');
 assert.ok(turned>=0.07,'bull should gradually start turning');
 assert.ok(a.x<1000,'bull initially moves in previous facing direction, not teleporting toward player');
});

test('pacific cow begins fleeing when actually struck; no automatic pursuit',()=>{
 const {w,tick}=make();
 const source=new World({seed:412});
 const cow=[...source.animals.values()].find(a=>a.index===0);
 w.animals.set(cow.sid,cow);
 cow.x=1080;cow.y=5000;cow.waitLeft=1000;
 const player=w.join(null,'Attacker');
 player.x=1000;player.y=5000;player.angle=0;
 assert.equal(w.attack(player.id),true);
 assert.equal(cow.runFromId,player.id);
 assert.equal(cow.chargeTargetId,null);
 const before=cow.x;
 tick(100);
 assert.ok(cow.x>before,'cow runs away from attacker, it does not chase him');
});
