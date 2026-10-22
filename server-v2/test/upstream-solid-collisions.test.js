import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/world.js';
import {ObjectManager} from '../src/vendor/al007ex/objectManager.js';
import {GameObject} from '../src/vendor/al007ex/gameObject.js';
import {UTILS} from '../src/vendor/al007ex/utils.js';
import {resolveSolidContact,upstreamSolidRadius} from '../src/reference-solid-collision.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<.05,`${a} != ${b}`);
test('solid tree and rock contact invokes original ObjectManager.checkCollision result',()=>{
 const manager=new ObjectManager(GameObject,[],UTILS,
   {mapScale:14400,riverWidth:724,colGrid:7},[],null);
 for(const [type,kind,radius] of [[0,'tree',60],[2,'stone',100]]){
   const source={x:1100,y:5000,scale:100,type,kind};
   const original=new GameObject(1);original.init(source.x,source.y,0,100,type,{},null);
   assert.equal(upstreamSolidRadius(source),radius);
   const p={x:900,y:5000,motionX:400,motionY:0};
   const probe={x:1000,y:5000,scale:35,xVel:400,yVel:0,isPlayer:true};
   const expected=manager.checkCollision(probe,original,1);
   assert.equal(expected,type===2);
   const result=resolveSolidContact(p,1000,5000,new Map([[1,source]]),new Map());
   near(result.x,probe.x);near(result.y,probe.y);
   near(result.motionX,probe.xVel);
   assert.equal(result.contacts,expected?1:0);
 }
});
test('spikes, mills and turrets are solid; pads and hidden pits are passable',()=>{
 const input={x:1100,y:5000,scale:50,type:4};
 const p={x:980,y:5000,motionX:400,motionY:0};
 for(const id of [6,10,13,14,17]){
   const structures=new Map([[1,{...input,id}]]);
   const result=resolveSolidContact(p,id===14?1045:1020,5000,new Map(),structures);
   assert.equal(result.contacts,1,'solid building '+id);
   near(result.x,id===14?1040:1015);
 }
 for(const id of [15,16,18,19,20,21,22]){
   const result=resolveSolidContact(p,1020,5000,new Map(),
     new Map([[1,{...input,id}]]));
   assert.equal(result.contacts,0,'pass-through object '+id);
   assert.equal(result.x,1020);
 }
});
test('V2 movement cannot enter an upstream solid mill but crosses a boost pad',()=>{
 let now=10000;
 const world=new World({seed:70,now:()=>now});
 world.resources.clear();world.structures.clear();world.animals.clear();
 const p=world.join(null,'Builder');p.x=1000;p.y=5000;p.vx=1;p.vy=0;
 world.structures.set(999,{sid:999,id:10,owner:33333,type:4,
   x:1100,y:5000,scale:45,hp:350});
 for(let i=0;i<12;i++){now+=100;world.tick(.1);}
 assert.ok(p.x<1100-35-45+1,'mill collision stops player: '+p.x);
 assert.ok(Math.hypot(p.x-1100,p.y-5000)>=80-.05);
 world.structures.clear();p.x=1000;p.y=5000;p.motionX=0;p.motionY=0;
 world.structures.set(998,{sid:998,id:16,owner:33333,type:4,
   x:1100,y:5000,scale:45,hp:350});
 for(let i=0;i<12;i++){now+=100;world.tick(.1);}
 assert.ok(p.x>1150,'boost pad does not block player: '+p.x);
});

test('raised platform crosses nearby wall but not one outside its footprint',()=>{
 const p={x:1900,y:5000,motionX:100,motionY:0};
 const wall=new Map([[1,{id:3,type:4,x:2000,y:5000,scale:50}]]);
 const normal=resolveSolidContact(p,1920,5000,new Map(),wall);
 assert.equal(normal.contacts,1);
 const raised=resolveSolidContact(p,1920,5000,new Map(),wall,{x:2105,y:5000});
 assert.equal(raised.contacts,0);
 const far=resolveSolidContact(p,1920,5000,new Map(),wall,{x:4000,y:5000});
 assert.equal(far.contacts,1);
});
