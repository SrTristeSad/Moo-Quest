import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/world.js';
import {GameObject} from '../src/vendor/al007ex/gameObject.js';
import {ObjectManager} from '../src/vendor/al007ex/objectManager.js';
import {UTILS} from '../src/vendor/al007ex/utils.js';
import {resolveCreatureContact} from '../src/reference-solid-collision.js';

test('animal solid contact exactly matches original ObjectManager with actual animal scale',()=>{
 const animals=[{x:900,y:5000,scale:72,motionX:800,motionY:0}];
 const rock={sid:1,x:1100,y:5000,scale:45,type:2,kind:'stone'};
 const reference=new GameObject(rock.sid);
 reference.init(rock.x,rock.y,0,rock.scale,2,{},null);
 const original=new ObjectManager(GameObject,[reference],UTILS,
   {mapScale:14400,colGrid:7,riverWidth:724},[],null);
 const testCreature={x:1000,y:5000,scale:72,isPlayer:false,
   xVel:800,yVel:0};
 assert.equal(original.checkCollision(testCreature,reference),true);
 const actual=resolveCreatureContact(animals[0],1000,5000,
   new Map([[1,rock]]),new Map());
 assert.equal(actual.contacts,1);
 assert.ok(Math.abs(actual.x-testCreature.x)<1e-6);
 assert.ok(Math.abs(actual.motionX-testCreature.xVel)<1e-6);
 assert.equal(actual.motionX,600,'original 25-percent speed loss on impact');
});

test('live V2 wildlife cannot run through a natural boulder or a solid wall',()=>{
 let time=10000;
 const w=new World({seed:53,now:()=>time});
 w.resources.clear();w.structures.clear();
 const cow=[...w.animals.values()].find(a=>a.index===0);
 assert.ok(cow);
 w.animals.clear();w.animals.set(cow.sid,cow);
 cow.x=900;cow.y=5000;
 cow.homeX=900;cow.homeY=5000;
 cow.waitLeft=99999;cow.moveLeft=0;
 cow.motionX=2200;cow.motionY=0;
 const rock={sid:77,x:1100,y:5000,scale:45,type:2,kind:'stone'};
 w.resources.set(rock.sid,rock);
 time+=100;w.tick(.1);
 assert.ok(cow.x<=1100-cow.scale-rock.scale+0.02,
   'boulder contact prevents penetration: '+cow.x);
 assert.ok(cow.x>900,'animal should approach, not freeze completely');
 const wall={sid:78,x:1400,y:5000,scale:50,type:4,id:3};
 w.resources.clear();w.structures.set(wall.sid,wall);
 cow.x=1170;cow.y=5000;cow.motionX=3000;cow.motionY=0;
 time+=100;w.tick(.1);
 assert.ok(cow.x<=wall.x-wall.scale-cow.scale+0.02,
   'solid player-built wall blocks wildlife: '+cow.x);
});

test('boost and healing pads do not turn into artificial wildlife walls',()=>{
 const creature={x:900,y:5000,scale:72,motionX:1000,motionY:0};
 for(const id of [15,16,18,19,20,21,22]){
  const result=resolveCreatureContact(creature,1100,5000,new Map(),
    new Map([[id,{id,type:4,x:1100,y:5000,scale:50}]]));
  assert.equal(result.contacts,0,'pad '+id);
  assert.equal(result.x,1100);
 }
});
