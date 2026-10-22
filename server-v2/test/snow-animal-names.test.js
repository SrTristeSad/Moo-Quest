import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/world.js';

test('V2 animal catalog gives bulls fixed labels and cow/pig unique names',()=>{
  const w=new World({seed:936});
  const expected={2:'Bull',3:'Bully',4:'Wolf',5:'Quack',6:'MOOSTAFA',
    7:'Treasure',8:'MOOFIE',9:'Boar',10:'Yeti',
    11:'Crab King',12:'Sheep'};
  const catalog=new Map(w.animalCatalog().map(x=>[x.id,x]));
  assert.equal(catalog.size,13);
  for(const [id,name] of Object.entries(expected)){
    assert.equal(catalog.get(Number(id)).name,name);
  }
  for(const id of [0,1])assert.equal(catalog.get(id).name,undefined);
  for(const a of w.animals.values()){
    if(a.index===0||a.index===1)
      assert.ok(a.nameIndex>=0&&a.nameIndex<44);
    else assert.equal(a.nameIndex,-1,
      'fixed animal '+a.index+' must not show Sid');
  }
  const p=w.join(null,'Tester');
  const first=w.initialPackets(p)[0];
  assert.equal(first[0],'A');
  assert.equal(first[1][0].animals.find(x=>x.id===2).name,'Bull');
  assert.equal(first[1][0].animals.find(x=>x.id===3).name,'Bully');
});

test('north snow slows regular player 25%, Snowball halves penalty and Winter Cape cancels it',()=>{
  let at=180000;
  const w=new World({seed:36,now:()=>at});
  // Isolate terrain movement speed from any animals/nearby structures.
  w.animals.clear();w.resources.clear();
  const create=(name,y,tail=null)=>{
    const p=w.join(null,name);p.x=500;p.y=y;p.vx=1;p.vy=0;
    p.tail=tail;return p;
  };
  const land=create('Land',4200);
  const snow=create('Snow',1200);
  const edge=create('Edge',2400);
  const beyond=create('Beyond',2400.01);
  const ball=create('Snowball',1200,12);
  const cape=create('Cape',1200,6);
  at+=100;w.tick(0.1);
  const dist=p=>p.x-500;
  assert.ok(Math.abs(dist(land)-25)<0.01);
  assert.ok(Math.abs(dist(snow)-18.75)<0.01);
  assert.ok(Math.abs(dist(edge)-18.75)<0.01);
  assert.ok(Math.abs(dist(beyond)-25)<0.01);
  assert.ok(Math.abs(dist(ball)-21.875)<0.01);
  assert.ok(Math.abs(dist(cape)-25)<0.01);
});

test('the Lua rendered snow biome is north, never the central river',()=>{
  const w=new World({seed:202});
  assert.equal(w.size,14400);
  assert.equal(w.animalCatalog().find(a=>a.id===4).name,'Wolf');
  assert.ok([...w.animals.values()].filter(a=>a.index===4).every(a=>a.y<=2400));
  assert.ok([...w.animals.values()].filter(a=>a.index===10).every(a=>a.y<=2400));
});
