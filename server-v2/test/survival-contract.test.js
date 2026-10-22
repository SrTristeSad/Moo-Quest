import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/world.js';

test('survival server emits real Lua presentation structure; no NPC or map editor',()=>{
  const w=new World({seed:12,now:()=>15000});
  assert.equal(w.size,14400);
  const p=w.join(null,'Lua');
  assert.ok(w.resources.size>80);
  const chunks=w.initialPackets(p);
  assert.equal(chunks[0][0],'A');
  assert.deepEqual(chunks[1],['C',[p.sid]]);
  const D=chunks.find(([name])=>name==='D')[1][0];
  assert.equal(D.length,17);assert.equal(D[2],'Lua');
  assert.equal(D[3],p.x);assert.equal(D[8],35);
  const H=chunks.find(([name])=>name==='H')[1][0];
  assert.equal(H.length,w.resources.size*8);
  assert.deepEqual(chunks.find(([name])=>name==='a')[1][0].length,4);
  assert.deepEqual(chunks.find(([name])=>name==='V')[1],[p.inventory.weapons,1]);
  assert.equal(w.tribes.size,0);
  assert.ok(!Object.hasOwn(w,'npcs') && !Object.hasOwn(w,'mapEditor'));
});

test('gather, build, costs, grouping and free/paid gear remain authoritative',()=>{
  let at=10000;const w=new World({now:()=>at,seed:55});
  const a=w.join(null,'Builder'),b=w.join(null,'Member');
  const tree=[...w.resources.values()].find(o=>o.kind==='tree');
  a.x=tree.x-170;a.y=tree.y;a.angle=0;
  assert.equal(w.attack(a.id),true);
  assert.ok(a.resources.wood>0 && a.resources.points===0,
    'resource count must arise from server collision, not client declaration');
  assert.equal(w.attack(a.id),false);
  assert.equal(w.select(a.id,999,false),false);
  assert.equal(w.shop(a.id,1,57,false),false,'gold requirement enforced');
  a.resources.points=50;
  assert.equal(w.shop(a.id,1,57,false),true);
  assert.equal(a.resources.points,0);
  assert.equal(w.shop(a.id,0,57,false),true);
  assert.equal(a.hat,57);
  assert.equal(w.createTribe(a.id,'TREE'),true);
  assert.equal(w.requestTribe(b.id,'TREE'),true);
  assert.equal(w.answerTribe(a.id,b.sid,true),true);
  assert.equal(b.team,'TREE');
  assert.equal(w.leaveTribe(a.id),true);
  assert.equal(w.tribes.get('TREE').owner,b.id);
  a.resources.wood=100;a.resources.stone=50;
  assert.equal(w.place(a.id,3),false,'cannot construct without choosing inventory slot');
  assert.equal(w.select(a.id,3,false),true);
  // Choose a valid point away from seeded resources.
  let found=false;
  for(let x=1000;x<8000&&!found;x+=400){
    a.x=x;a.y=1000;a.angle=0;
    found=w.place(a.id,3);
  }
  assert.equal(found,true);
  assert.equal(a.resources.wood,90);
  const wall=[...w.structures.values()][0];
  assert.equal(wall.id,3);assert.equal(wall.owner,a.sid);
  assert.ok(w.objectPacket().length%8===0);
  assert.equal(w.place(a.id,3),false,'two walls must not overlap');
  assert.equal(w.input(a.id,{dx:1,dy:0,x:10000000}),true);
  assert.equal(w.players.get(a.id).x,a.x);
});

test('death requires explicit native respawn; local alpha stays separate',()=>{
  let now=10000;const w=new World({now:()=>now,seed:3});
  const attacker=w.join(null,'A'),victim=w.join(null,'B');
  victim.native=true;
  attacker.x=2000;attacker.y=2000;victim.x=2030;victim.y=2000;
  for(let i=0;i<7;i++){assert.equal(w.attack(attacker.id),true);now+=501;}
  assert.equal(victim.hp,0);
  now+=4000;w.tick(0.1);
  assert.equal(victim.hp,0,'native client must receive C only after Play');
  assert.equal(w.respawn(victim.id),true);assert.equal(victim.hp,100);
});

test('wildlife remains server-controlled, can damage player, and uses Lua I layout',()=>{
  let t=30000;const w=new World({now:()=>t,seed:16});
  const p=w.join(null,'Wildlife');p.native=true;
  const hostile=[...w.animals.values()].find(a=>a.damage>0);
  for(const a of w.animals.values())if(a!==hostile){a.x=12000;a.y=12000;}
  hostile.x=1000;hostile.y=1000;
  hostile.waitLeft=0;hostile.moveLeft=1200;
  hostile.chargeTargetId=p.id;
  p.x=1000;p.y=1001;
  const native=w.animalPacket();
  assert.equal(native.length,2);
  assert.equal(native[0].length,w.animals.size*8);
  w.tick(0.05);
  assert.ok(p.hp<100);
  assert.ok(w.takeEvents().some(x=>x.kind==='animal_attack'));
  // Client cannot forge enemy positions or damage; AI uses its own clock.
  const before=hostile.health;
  assert.equal(w.input(p.id,{dx:10,dy:10}),false);
  assert.equal(hostile.health,before);
});
