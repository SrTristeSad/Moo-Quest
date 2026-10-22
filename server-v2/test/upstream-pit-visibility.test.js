import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/world.js';
import {GameServer} from '../src/game.js';
import {GameObject} from '../src/vendor/al007ex/gameObject.js';
import {referenceObjectVisibleToPlayer} from '../src/reference-object-visibility.js';

function sandbox(){
  const world=new World({seed:740,now:()=>100_000});
  world.resources.clear();world.animals.clear();world.structures.clear();
  const owner=world.join(null,'Owner');
  const friend=world.join(null,'Friend');
  const enemy=world.join(null,'Enemy');
  owner.x=2000;owner.y=5000;owner.angle=0;
  friend.x=3000;friend.y=5000;
  enemy.x=3100;enemy.y=5000;
  owner.resources.wood=1000;owner.resources.stone=1000;
  owner.inventory.items.push(15);
  world.select(owner.id,15,false);
  assert.equal(world.place(owner.id,15),true);
  const pit=[...world.structures.values()][0];
  world.takeEvents();
  return {world,owner,friend,enemy,pit};
}
function includesSid(packet,sid){
  for(let i=0;i<packet.length;i+=8)if(packet[i]===sid)return true;
  return false;
}
test('original GameObject visibleToPlayer controls private traps in V2',()=>{
  const {world,owner,friend,enemy,pit}=sandbox();
  assert.equal(pit.hidden,true);
  assert.equal(includesSid(world.objectPacket(owner),pit.sid),true);
  assert.equal(includesSid(world.objectPacket(enemy),pit.sid),false);
  assert.equal(world.snapshot(enemy).objects.some(o=>o.sid===pit.sid),false);
  assert.equal(world.snapshot(owner).objects.some(o=>o.sid===pit.sid),true);
  assert.equal(world.eventsFor(enemy,[{kind:'build',sid:pit.sid,id:15,owner:owner.sid}]).length,0);
  assert.equal(includesSid(world.initialPackets(enemy).find(([n])=>n==='H')[1][0],pit.sid),false);
  const original=new GameObject(pit.sid);
  original.init(pit.x,pit.y,0,pit.scale,4,{id:15,hideFromEnemy:true},owner);
  assert.equal(referenceObjectVisibleToPlayer(pit,enemy,world.players),original.visibleToPlayer(enemy));
  assert.equal(world.createTribe(owner.id,'TRAPS'),true);
  assert.equal(world.requestTribe(friend.id,'TRAPS'),true);
  assert.equal(world.answerTribe(owner.id,friend.sid,true),true);
  assert.equal(includesSid(world.objectPacket(friend),pit.sid),true);
  assert.equal(includesSid(world.objectPacket(enemy),pit.sid),false);
  friend.x=3000;friend.y=5000;
  enemy.x=pit.x;enemy.y=pit.y;
  world.tick(.05);
  assert.equal(pit.hidden,false);
  assert.equal(world.takeEvents().filter(e=>e.kind==='structure_revealed'&&e.sid===pit.sid).length,1);
  assert.equal(includesSid(world.objectPacket(enemy),pit.sid),true);
  assert.equal(world.snapshot(enemy).objects.some(o=>o.sid===pit.sid),true);
  world.tick(.05);
  assert.equal(world.takeEvents().filter(e=>e.kind==='structure_revealed').length,0);
});
test('native builder and reveal events never broadcast undiscovered traps',()=>{
  const {world,owner,enemy,pit}=sandbox();
  let byId=new Map([[owner.id,[]],[enemy.id,[]]]);
  const states=[owner,enemy].map(p=>({p,send:(name,args)=>byId.get(p.id).push([name,args])}));
  const server={room:world,nativeClients:new Map(states.map((s,i)=>[i,s])),
    _nativeBroadcast:()=>{}};
  GameServer.prototype._nativeEvents.call(server,[{kind:'build',sid:pit.sid,owner:owner.sid,id:15}]);
  assert.equal(byId.get(owner.id).some(([n])=>n==='H'),true);
  assert.equal(byId.get(enemy.id).some(([n])=>n==='H'),false);
  pit.hidden=false;
  GameServer.prototype._nativeEvents.call(server,[{kind:'structure_revealed',sid:pit.sid}]);
  assert.equal(byId.get(enemy.id).filter(([n])=>n==='H').length,1);
});
test('revealed hidden-state is serialized and restored only for the owner',()=>{
  const {world,owner,pit}=sandbox();
  owner.accountId='00000000-0000-4000-8000-000000000001';
  pit.hidden=false;
  const saved=world.persistentProfile(owner);
  assert.deepEqual(saved.structures[0].hidden,false);
  const restored=new World({seed:741,now:()=>100_000});
  restored.resources.clear();restored.structures.clear();restored.animals.clear();
  const p=restored.join(null,'Account',saved,owner.accountId);
  const loaded=[...restored.structures.values()][0];
  assert.equal(loaded.hidden,false);
  assert.equal(restored.objectVisibleToPlayer(loaded,restored.join(null,'Stranger')),true);
});
