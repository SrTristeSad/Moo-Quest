import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/world.js';

function arena(){
  let now=100000;
  const w=new World({seed:18,now:()=>now});
  w.resources.clear();w.animals.clear();w.structures.clear();
  const player=(name,x=1000,y=5000)=>{
    const p=w.join(null,name);p.x=x;p.y=y;p.vx=p.vy=0;
    p.motionX=p.motionY=0;return p;
  };
  return {w,player,advance(ms){now+=ms;}};
}

test('one swing independently damages two players in the same forward arc',()=>{
  const {w,player}=arena();
  const attacker=player('Attacker');
  const a=player('Opponent A',1080,4984),b=player('Opponent B',1080,5016);
  attacker.angle=0;
  assert.equal(w.attack(attacker.id),true);
  assert.equal(a.hp,75);assert.equal(b.hp,75);
  const hits=w.takeEvents().filter(e=>e.kind==='hit');
  assert.equal(hits.length,2);
  assert.deepEqual(new Set(hits.map(e=>e.to)),new Set([a.id,b.id]));
  assert.equal(attacker.lifeStats.damage,50);
  assert.ok(a.motionX>0 && b.motionX>0,'both opponents get server-owned knockback');
});

test('swing harvests all visible natural objects without removing any',()=>{
  const {w,player}=arena();const p=player('Lumberjack');p.angle=0;
  for(let i=0;i<3;i++){
    const sid=100+i;
    w.resources.set(sid,{sid,kind:'tree',type:0,x:1090,y:4980+20*i,
      scale:80,hp:150,maxHp:150});
  }
  w.resources.set(104,{sid:104,kind:'tree',type:0,x:900,y:5000,
    scale:80,hp:150,maxHp:150}); // behind the player
  assert.equal(w.attack(p.id),true);
  assert.equal(p.resources.wood,3);
  assert.equal(p.weaponXp[0],3);
  assert.equal(w.resources.size,4);
  assert.equal([...w.resources.values()].every(o=>o.hp===150),true);
  const gathers=w.takeEvents().filter(e=>e.kind==='gather');
  assert.deepEqual(gathers.map(x=>x.sid).sort(),[100,101,102]);
  assert.equal(p.xp,12);
});

test('one swing hits hostile structure, resource, and animal independently',()=>{
  const {w,player}=arena();const p=player('Sweeper');p.angle=0;
  w.structures.set(500,{sid:500,id:3,owner:999,x:1090,y:5010,
    scale:40,hp:100,maxHp:100});
  w.resources.set(501,{sid:501,kind:'stone',type:2,x:1090,y:4980,
    scale:70,hp:200,maxHp:200});
  w.animals.set(502,{sid:502,index:4,x:1080,y:5000,
    scale:84,health:300,maxHealth:300,
    hostile:true,damage:8,deadUntil:0,
    dir:0,waitLeft:0,moveLeft:0,motionX:0,motionY:0});
  assert.equal(w.attack(p.id),true);
  assert.equal(w.structures.get(500).hp,75);
  assert.equal(w.resources.get(501).hp,200);
  assert.equal(p.resources.stone,1);
  assert.equal(w.animals.get(502).health,275);
  const events=w.takeEvents();
  for(const kind of ['structure_hit','gather','animal_hit'])
    assert.equal(events.filter(e=>e.kind===kind).length,1,
      kind+' must be independently dispatched');
});

test('melee impulse respects weapon knock value and heavier animals resist more',()=>{
  const {w,player}=arena();const attacker=player('Hammer');attacker.angle=0;
  const target=player('Target',1080,5000);
  assert.equal(w.attack(attacker.id),true);
  assert.ok(Math.abs(target.motionX-300)<0.001);
  assert.ok(Math.abs(target.motionY)<0.001);
  const impulse=target.motionX;
  const {w:strong,player:make}=arena();
  const high=make('Polearm');high.weaponIndex=6;
  high.inventory.weapons=[6];high.angle=0;
  const pushed=make('Victim',1080,5000);
  assert.equal(strong.attack(high.id),true);
  assert.ok(pushed.motionX>impulse*3,
    'polearm knock should exceed hammer knock');
});

test('teammates and enemies behind the player are not accidentally hit',()=>{
  const {w,player}=arena();
  const attacker=player('Attacker'),behind=player('Behind',920,5000);
  const teammate=player('Ally',1080,5000),enemy=player('Enemy',1080,5010);
  attacker.team='A';teammate.team='A';enemy.team='B';
  attacker.angle=0;
  assert.equal(w.attack(attacker.id),true);
  assert.equal(behind.hp,100);
  assert.equal(teammate.hp,100);
  assert.equal(enemy.hp,75);
});

test('steal tool transfers only existing points, never creates resource balances',()=>{
 const {w,player}=arena();
 const thief=player('Thief'),victim=player('Victim',1080,5000);
 thief.angle=0;thief.weaponIndex=14;thief.inventory.weapons=[14];
 victim.resources.points=13;victim.resources.wood=200;
 thief.resources.points=0;thief.resources.wood=0;
 assert.equal(w.attack(thief.id),true);
 assert.equal(thief.resources.points,13);
 assert.equal(victim.resources.points,0);
 assert.equal(thief.resources.wood,0);
 assert.equal(victim.resources.wood,200);
});
