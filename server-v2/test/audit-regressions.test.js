import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world.js';
import { Auth } from '../src/auth.js';
import { requestIdentity } from '../src/request-identity.js';

function sandbox(){
  let now=200000;
  const world=new World({now:()=>now,seed:777});
  world.resources.clear();world.animals.clear();world.events=[];
  const player=world.join(null,'Auditor'),victim=world.join(null,'Enemy');
  player.x=2500;player.y=1000;player.angle=0;
  victim.x=4500;victim.y=1000;
  player.resources={wood:200,stone:200,food:200,points:0,kills:0};
  victim.resources={wood:90,stone:80,food:70,points:60,kills:0};
  return {world,player,victim,advance:()=>{now+=2000;}};
}

test('all four previously unimplemented weapon IDs have their own authorized mechanics',()=>{
  const {world,player,victim,advance}=sandbox();
  assert.equal(world.select(player.id,2,true),false,'unauthorized weapon must not be selected');
  for(const [id,damage,reach] of [[2,35,100],[4,40,125],[10,10,85],[14,0,125]]){
    player.inventory.weapons.push(id);
    assert.equal(world.select(player.id,id,true),true);
    player.x=2500;victim.x=2500+reach-10;victim.hp=100;
    advance();
    assert.equal(world.attack(player.id),true,'weapon '+id+' attacks');
    assert.equal(victim.hp,100-damage,'weapon '+id+' must not become the hammer');
    if(id===14){
      assert.equal(player.resources.wood,200+90);
      assert.equal(player.resources.stone,200+80);
      assert.equal(player.resources.food,200+70);
      assert.equal(player.resources.points,10,'steal must transfer, not mint');
      assert.equal(victim.resources.points,50);
    }
  }
  // A corrupted/unsupported weapon index must never hit with hammer stats.
  player.weaponIndex=999;
  advance();
  assert.equal(world.attack(player.id),false);
});

test('great hammer structure multiplier and great axe harvesting are server-authoritative',()=>{
  const {world,player,advance}=sandbox();
  player.inventory.weapons.push(10,2);
  world.structures.set(123,{sid:123,x:2580,y:1000,scale:50,
    type:4,id:3,owner:999,hp:350,maxHp:350});
  assert.equal(world.select(player.id,10,true),true);
  advance();assert.equal(world.attack(player.id),true);
  assert.equal(world.structures.get(123).hp,275,'great hammer: 10 x 7.5');
  world.structures.clear();
  world.resources.set(124,{sid:124,kind:'tree',type:0,x:2580,y:1000,scale:60,hp:150,maxHp:150});
  assert.equal(world.select(player.id,2,true),true);
  advance();assert.equal(world.attack(player.id),true);
  assert.equal(player.resources.wood,204,'great axe gives four wood on a resource hit');
});

test('blocked saved buildings are retained, not silently deleted, and later restored',()=>{
  const world=new World({seed:888});
  world.resources.clear();world.animals.clear();
  const accountId='00000000-0000-4000-8000-000000000001';
  const profile={version:1,hp:100,age:1,structures:[{id:3,x:2000,y:1000,hp:250}]};
  world.resources.set(111,{sid:111,kind:'stone',type:2,x:2000,y:1000,scale:85,hp:150,maxHp:150});
  const first=world.join(null,'Builder',profile,accountId);
  assert.equal(first.deferredStructures.length,1);
  assert.equal(world.persistentProfile(first).structures.length,1);
  assert.equal([...world.structures.values()].length,0);
  world.leave(first.id);
  world.resources.clear();
  const second=world.join(null,'Builder',world.persistentProfile(first),accountId);
  assert.equal(second.deferredStructures.length,0);
  assert.equal([...world.structures.values()].length,1);
  assert.equal([...world.structures.values()][0].hp,250);
});

test('registration limiter and reverse-proxy identity distinguish real user IPs',()=>{
  const auth=new Auth();
  assert.deepEqual([1,2,3,4,5].map(()=>auth.allowRegistration('ip1')),[true,true,true,false,false]);
  assert.equal(auth.allowRegistration('ip2'),true);
  const saved=process.env.MOO_TRUST_PROXY;
  try{
    process.env.MOO_TRUST_PROXY='1';
    const req=ip=>({socket:{remoteAddress:'127.0.0.1'},headers:{'x-real-ip':ip}});
    assert.equal(requestIdentity(req('203.0.113.30')).address,'203.0.113.30');
    assert.equal(requestIdentity(req('203.0.113.31')).address,'203.0.113.31');
    assert.equal(requestIdentity(req('not-an-ip')).trustedOrigin,false);
    assert.equal(requestIdentity({socket:{remoteAddress:'198.51.100.20'},
      headers:{'x-real-ip':'203.0.113.100'}}).address,'198.51.100.20');
  }finally{
    if(saved===undefined)delete process.env.MOO_TRUST_PROXY;
    else process.env.MOO_TRUST_PROXY=saved;
  }
});
