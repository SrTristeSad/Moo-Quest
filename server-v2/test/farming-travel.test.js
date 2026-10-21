import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world.js';
import { GameServer } from '../src/game.js';

function sandbox(){
  let at=100_000;
  const w=new World({seed:2026,now:()=>at});
  w.resources.clear();w.animals.clear();w.events=[];
  const owner=w.join(null,'Owner'),rival=w.join(null,'Rival');
  owner.x=2000;owner.y=1100;owner.angle=0;
  rival.x=10000;rival.y=1100;rival.angle=0;
  owner.resources={wood:2000,stone:2000,food:200,points:0,kills:0};
  rival.resources={wood:2000,stone:2000,food:200,points:0,kills:0};
  return {w,owner,rival,advance:ms=>{at+=ms;}};
}
function build(w,p,itemId,x=2000,y=1100){
  p.x=x;p.y=y;p.angle=0;
  if(!p.inventory.items.includes(itemId))p.inventory.items.push(itemId);
  assert.equal(w.select(p.id,itemId,false),true);
  assert.equal(w.place(p.id,itemId),true,'building item '+itemId);
  return [...w.structures.values()].at(-1);
}

test('Lua upgrade indices unlock planted nodes, teleporter and spawn pad at the correct stages',()=>{
  const {w,owner}=sandbox();
  assert.equal(w.upgrade(owner.id,29),false);
  owner.age=5;owner.upgradeAge=5;owner.upgradePoints=1;
  assert.equal(w.upgrade(owner.id,29),true);
  assert.ok(owner.inventory.items.includes(13));
  assert.equal(w.upgrade(owner.id,30),false,'only one upgrade per stage');
  const p=w.join(null,'Farmer');
  p.age=5;p.upgradeAge=5;p.upgradePoints=1;
  assert.equal(w.upgrade(p.id,30),true);
  assert.ok(p.inventory.items.includes(14));
  p.age=7;p.upgradeAge=7;p.upgradePoints=1;
  assert.equal(w.upgrade(p.id,38),true);
  assert.ok(p.inventory.items.includes(22));
  p.age=9;p.upgradeAge=9;p.upgradePoints=1;
  assert.equal(w.upgrade(p.id,36),true);
  assert.ok(p.inventory.items.includes(20));
});

test('mines and saplings provide resources only when struck, with normal weapon cooldown',()=>{
  const {w,owner,advance}=sandbox();
  for(const [itemId,key,cost] of [[13,'stone',{wood:20,stone:100}],
    [14,'wood',{wood:150}]]){
    w.structures.clear();
    const prior={...owner.resources};
    const node=build(w,owner,itemId);
    for(const [resource,amount] of Object.entries(cost)){
      assert.equal(owner.resources[resource],prior[resource]-amount);
    }
    assert.equal(node.id,itemId);
    assert.equal(node.type,4,'Lua item renderer uses item ID');
    assert.equal(w.select(owner.id,0,true),true);
    const amountBefore=owner.resources[key];
    const pointsBefore=owner.resources.points;
    advance(600);
    assert.equal(w.attack(owner.id),true);
    assert.equal(owner.resources[key],amountBefore+2);
    assert.equal(owner.resources.points,pointsBefore+1);
    assert.equal(w.attack(owner.id),false,'replayed hold packet gives no extra harvest');
    assert.ok(w.structures.has(node.sid),'harvest does not erase farming node');
    assert.ok(w.takeEvents().some(e=>e.kind==='gather'&&e.sid===node.sid&&e.key===key));
    advance(600);
  }
});

test('placement costs, ownership and group limits apply to all four buildings',()=>{
  const {w,owner}=sandbox();
  for(const id of [13,14,20,22]){
    w.structures.clear();
    const s=build(w,owner,id);
    const count=w.structureCount(owner.sid,id);
    assert.equal(count.count,1);
    assert.ok(w.structures.has(s.sid));
  }
  w.structures.clear();
  owner.resources.stone=59;
  owner.x=2100;owner.y=1100;owner.angle=0;
  w.select(owner.id,22,false);
  const wood=owner.resources.wood;
  assert.equal(w.place(owner.id,22),false);
  assert.equal(owner.resources.wood,wood,'a rejected placement never spends resources');
});

test('a single-use spawn pad respawns the dead owner on it and then disappears',()=>{
  const {w,owner,advance}=sandbox();
  const pad=build(w,owner,20);
  owner.native=true;owner.hp=0;owner.deadUntil=103000;
  assert.equal(w.respawn(owner.id),false,'respawn cooldown remains authoritative');
  advance(3000);
  assert.equal(w.respawn(owner.id),true);
  assert.deepEqual([owner.x,owner.y],[pad.x,pad.y]);
  assert.equal(owner.hp,owner.maxHp);
  assert.equal(w.structures.has(pad.sid),false);
  assert.deepEqual(w.structureCount(owner.sid,20),{group:10,count:0});
  assert.ok(w.takeEvents().some(e=>e.kind==='destroy'&&e.sid===pad.sid&&e.id===20));
  assert.equal(w.respawn(owner.id),false,'alive players cannot respawn again');
});

test('a blocked spawn pad stays intact while respawn uses another safe landing',()=>{
  const {w,owner,rival,advance}=sandbox();
  const pad=build(w,owner,20);
  rival.x=pad.x;rival.y=pad.y;
  owner.hp=0;owner.deadUntil=103000;advance(3000);
  assert.equal(w.respawn(owner.id),true);
  assert.notDeepEqual([owner.x,owner.y],[pad.x,pad.y]);
  assert.equal(w.structures.has(pad.sid),true);
  assert.equal(w.landingClear(owner.x,owner.y,owner.sid),true);
});

test('any live player can use portal; landing is server-selected, safe and rate-limited',()=>{
  const {w,owner,rival,advance}=sandbox();
  const portal=build(w,owner,22);
  rival.x=portal.x;rival.y=portal.y;rival.vx=0;rival.vy=0;
  w.tick(0.05);
  assert.notDeepEqual([rival.x,rival.y],[portal.x,portal.y]);
  assert.equal(w.landingClear(rival.x,rival.y,rival.sid),true);
  assert.equal(rival.vx,0);
  assert.equal(w.takeEvents().filter(e=>e.kind==='teleport').length,1);
  const teleported=[rival.x,rival.y];
  rival.x=portal.x;rival.y=portal.y;
  advance(200);w.tick(0.05);
  assert.deepEqual([rival.x,rival.y],[portal.x,portal.y],
    'portal cannot be triggered again before the cooldown');
  assert.equal(w.takeEvents().filter(e=>e.kind==='teleport').length,0);
  advance(4000);w.tick(0.05);
  assert.notDeepEqual([rival.x,rival.y],[portal.x,portal.y]);
  assert.notDeepEqual([rival.x,rival.y],teleported);
});

test('native presentation syncs food construction costs, removal counts and teleport coordinates',()=>{
  const {w,owner}=sandbox();
  const sent=[];
  const state={p:owner,send:(name,args)=>sent.push([name,args])};
  const server=Object.create(GameServer.prototype);
  server.room=w;server.nativeClients=new Map([['client',state]]);
  server._nativeBroadcast=(name,args)=>sent.push([name,args]);
  const pad=build(w,owner,20);
  server._nativeEvents(w.takeEvents());
  assert.ok(sent.some(([name,args])=>name==='S'&&args[0]===10&&args[1]===1));
  sent.length=0;
  w.structures.delete(pad.sid);
  server._nativeEvents([{kind:'destroy',sid:pad.sid,owner:owner.sid,id:20}]);
  assert.ok(sent.some(([name,args])=>name==='Q'&&args[0]===pad.sid));
  assert.ok(sent.some(([name,args])=>name==='S'&&args[0]===10&&args[1]===0));
  sent.length=0;
  server._nativeEvents([{kind:'teleport',player:owner.id,sid:owner.sid,x:700,y:900}]);
  assert.ok(sent.some(([name,args])=>name==='D'&&args[0][1]===owner.sid));
  sent.length=0;
  build(w,owner,19,2600,1100);
  server._nativeEvents(w.takeEvents());
  assert.ok(sent.some(([name,args])=>name==='N'&&args[0]==='food'));
});
