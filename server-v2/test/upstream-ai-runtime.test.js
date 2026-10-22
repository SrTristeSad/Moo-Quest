import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/world.js';
import {AI_TYPES} from '../src/vendor/al007ex/aiManager.js';

test('World animal stats directly match every actually spawned upstream AI type',()=>{
 const world=new World({seed:20261022});
 const active=new Set(world.animals.values().map(a=>a.index));
 assert.deepEqual([...active].sort((a,b)=>a-b),
  [0,1,2,3,4,5,6,7,8,9,10,11,12]);
 const catalog=new Map(world.animalCatalog().map(a=>[a.id,a]));
 assert.equal(catalog.size,13);
 for(const animal of world.animals.values()){
   const original=AI_TYPES[animal.index];
   assert.ok(original);
   assert.equal(animal.maxHealth,original.health,'health '+animal.index);
   assert.equal(animal.damage,original.dmg??0,'damage '+animal.index);
   assert.equal(animal.scale,original.scale,'size '+animal.index);
   assert.equal(animal.score,original.killScore??0,'score '+animal.index);
   assert.equal(animal.foodDrop,
     original.drop?.[0]==='food'?original.drop[1]:0,'food '+animal.index);
   assert.equal(animal.viewRange,original.viewRange??0,'sight '+animal.index);
   assert.equal(animal.hostile,!!original.hostile,'hostility '+animal.index);
   assert.equal(animal.fixed,!!original.fixedSpawn,'fixed '+animal.index);
   assert.equal(animal.boss,!!original.boss,'boss '+animal.index);
 }
});
test('upstream AI movement coefficients retain original 0.00074 bull turn rate',()=>{
 const world=new World({seed:912});
 const bull=[...world.animals.values()].find(a=>a.index===2);
 world.animals.clear();world.animals.set(bull.sid,bull);
 world.resources.clear();world.structures.clear();
 const target=world.join(null,'Target');
 bull.x=1000;bull.y=5000;bull.dir=Math.PI;bull.targetDir=Math.PI;
 bull.waitLeft=1000;bull.moveLeft=0;bull.motionX=0;bull.motionY=0;
 target.x=1400;target.y=5000;
 let time=100000;
 world.now=()=>time;
 for(let k=0;k<10;k++){time+=100;world.tick(.1);}
 const before=bull.dir;
 time+=100;world.tick(.1);
 const delta=Math.abs(Math.atan2(Math.sin(bull.dir-before),
   Math.cos(bull.dir-before)));
 assert.ok(Math.abs(delta-(AI_TYPES[2].turnSpeed*1000*.1))<0.00001);
});
