import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/world.js';
import {GameObject} from '../src/vendor/al007ex/gameObject.js';
import {ObjectManager} from '../src/vendor/al007ex/objectManager.js';
import {UTILS} from '../src/vendor/al007ex/utils.js';
import {referenceNaturalPlacementClear} from '../src/reference-object-placement.js';

function sandbox(){
 const world=new World({seed:12,now:()=>10000});
 world.resources.clear();world.structures.clear();world.animals.clear();
 const player=world.join(null,'Builder');
 player.x=2000;player.y=5000;player.angle=0;
 player.resources.wood=1000;player.resources.stone=1000;
 return {world,player};
}
test('V2 placement matches direct original ObjectManager placement decision',()=>{
 const source=[new GameObject(1),new GameObject(2)];
 source[0].init(2000,5000,0,100,0,{},null);
 source[1].init(3000,5000,0,100,2,{},null);
 const manager=new ObjectManager(GameObject,source,UTILS,
   {mapScale:14400,colGrid:7,riverWidth:724},[],null);
 const values=new Map(source.map(o=>[o.sid,{x:o.x,y:o.y,
    type:o.type,scale:o.scale,kind:o.type===0?'tree':'stone'}]));
 for(const [x,expected] of [[2109,false],[2110,true],[3149,false],
   [3150,true],[5000,true]]){
   assert.equal(manager.checkItemLocation(x,5000,50,1,4,true,null),expected);
   assert.equal(referenceNaturalPlacementClear(values,
     {x,y:5000,scale:50,itemId:4,size:14400}),expected);
 }
});
test('real V2 accepts building by tree canopy but rejects the same rock radius',()=>{
 const {world,player}=sandbox();
 player.inventory.items.push(4);world.select(player.id,4,false);
 world.resources.set(8001,{sid:8001,x:2220,y:5000,type:0,
   kind:'tree',scale:100});
 assert.equal(world.place(player.id,4),true);
 world.structures.clear();world.resources.clear();
 world.resources.set(8002,{sid:8002,x:2220,y:5000,type:2,
   kind:'stone',scale:100});
 const before=player.resources.stone;
 assert.equal(world.place(player.id,4),false);
 assert.equal(player.resources.stone,before);
});
test('account-owned structure blocked by rock stays deferred, not destroyed',()=>{
 const {world,player}=sandbox();
 const save=world.persistentProfile(player);
 save.structures=[{id:4,x:2200,y:5000,hp:800}];
 const owner=world.join(null,'Returning',null,'00000000-0000-4000-8000-000000000001');
 world.resources.set(8003,{sid:8003,x:2250,y:5000,type:2,
   kind:'stone',scale:90});
 world.restoreProfile(owner,save);
 assert.ok(owner.deferredStructures.some(s=>s.id===4&&s.x===2200));
 assert.equal([...world.structures.values()].filter(o=>o.owner===owner.sid).length,0);
});
