import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/world.js';

test('world creates a populated 7x7 resource map, deterministic and separated',()=>{
 const a=new World({seed:24681357}),b=new World({seed:24681357});
 const byType=t=>[...a.resources.values()].filter(x=>x.kind===t);
 const trees=byType('tree'),bushes=byType('bush');
 assert.ok(trees.length>200,'missing trees across 49 regions: '+trees.length);
 assert.ok(bushes.length>95,'missing bushes across 49 regions: '+bushes.length);
 assert.equal(byType('stone').length,32);
 assert.equal(byType('ore').length,7);
 assert.deepEqual(a.objectPacket(),b.objectPacket(),'map must remain reproducible for same seed');
 assert.equal(new Set([...a.resources.values()].map(x=>x.sid)).size,a.resources.size);
 for(const obj of trees){
   assert.ok(obj.y<12000,'trees should not appear deep in the desert');
   assert.ok(obj.y<7200-724/2-100||obj.y>7200+724/2+100,
     'tree is spawned inside the river');
 }
 for(const obj of bushes){
   assert.ok(obj.y<7200-724/2-50||obj.y>7200+724/2+50,
     'bush is spawned inside the river');
 }
});

test('water in the old client map is water in the V2 movement simulation',()=>{
 let at=30000;
 const w=new World({seed:42,now:()=>at});
 const p=w.join(null,'River'),q=w.join(null,'Land');
 p.x=520;p.y=7200;p.vx=0;p.vy=1;
 q.x=520;q.y=5000;q.vx=0;q.vy=1;
 const oldRiverY=p.y,oldLandY=q.y,oldRiverX=p.x;
 at+=100;w.tick(0.1);
 const wetDistance=p.y-oldRiverY,dryDistance=q.y-oldLandY;
 assert.ok(wetDistance>0&&wetDistance<dryDistance*0.45,
   'river must reduce movement: '+wetDistance+' vs '+dryDistance);
 assert.ok(p.x>oldRiverX,'water must have a downstream current');
});
