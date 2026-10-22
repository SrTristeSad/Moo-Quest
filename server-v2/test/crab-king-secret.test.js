import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/world.js';
import {secretWalkable,tickCrabKing} from '../src/boss-logic.js';
import {NativeSession,unpack} from '../src/native-protocol.js';

function pool(){
 let time=10000;
 const w=new World({now:()=>time});
 w.resources.clear();w.structures.clear();
 const crab=[...w.animals.values()].find(a=>a.index===11);
 const p=w.join(null,'Raider');
 p.x=-2200;p.y=7200;p.hp=1000;p.maxHp=1000;p.motionX=0;p.motionY=0;
 return {w,crab,p,clock:n=>time=n};
}
test('real secret west basin is traversable only through the river corridor',()=>{
 assert.equal(secretWalkable(-2500,7200),true);
 assert.equal(secretWalkable(-2500,1000),false);
 assert.equal(secretWalkable(15,7200),true);
 assert.equal(secretWalkable(15,3000),false);
 const {w,p}=pool();
 p.x=24;p.y=7200;p.motionX=-600;
 w.tick(.1);assert.ok(p.x<24);
 p.x=24;p.y=3000;p.motionX=-600;
 w.tick(.1);assert.equal(p.x,24);
});
test('Crab King lives inside the reference pool and cannot be hit underwater',()=>{
 const {w,p,crab}=pool();
 assert.equal(crab.x,-2500);
 assert.equal(crab.y,7200);
 p.angle=Math.PI;crab.state=2;crab.stateUntil=50000;
 const hp=crab.health;
 w.attack(p.id);
 assert.equal(crab.health,hp);
});
test('Crab returns from dive with a visible splash telegraph',()=>{
 const {w,crab,clock}=pool();
 crab.state=1;crab.stateUntil=10700;
 clock(10700);w.tick(.1);assert.equal(crab.state,2);
 crab.stateUntil=12000;
 clock(12000);w.tick(.1);assert.equal(crab.state,3);
 assert.ok(w.takeEvents().some(e=>e.kind==='boss_telegraph'&&e.effectKind===1));
 clock(13650);w.tick(.1);assert.equal(crab.state,0);
});
test('Crab telegraphs before it inflicts damage',()=>{
 const {w,p,crab}=pool();
 crab.bossAttack={until:11000,strikes:[{kind:3,x:crab.x,y:crab.y,r:540}]};
 tickCrabKing(w,crab,10000,.1);
 assert.equal(p.hp,1000);
 tickCrabKing(w,crab,11000,.1);
 assert.ok(p.hp<1000);
});
test('W warning is a V2 append-only wire event',()=>{
 const session=new NativeSession({socketId:'0123456789abcdef',seed:123,
    key:Buffer.alloc(16,7)});
 const record=unpack(session.encode('W',[3,-2500,7200,540,1300]));
 assert.deepEqual(record[1],[3,-2500,7200,540,1300]);
});
