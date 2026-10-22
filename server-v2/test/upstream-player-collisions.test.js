import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/world.js';
import {GameObject} from '../src/vendor/al007ex/gameObject.js';
import {ObjectManager} from '../src/vendor/al007ex/objectManager.js';
import {UTILS} from '../src/vendor/al007ex/utils.js';
import {resolveReferencePlayerPairs} from '../src/reference-player-collision.js';

function room(){
  const w=new World({seed:987,now:()=>10000});
  w.resources.clear();w.structures.clear();w.animals.clear();
  const a=w.join(null,'Alice'),b=w.join(null,'Bob');
  a.x=500;a.y=5000;b.x=540;b.y=5000;
  a.vx=a.vy=b.vx=b.vy=0;
  a.motionX=a.motionY=b.motionX=b.motionY=0;
  return {w,a,b};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<.0001,`${a} != ${b}`);
test('two players collide using the exact original ObjectManager contact positions',()=>{
  const {w,a,b}=room();
  const reference=new ObjectManager(GameObject,[],UTILS,
    {mapScale:14400,colGrid:7,riverWidth:724},[],null);
  const pa={x:500,y:5000,scale:35,isPlayer:true};
  const pb={x:540,y:5000,scale:35,isPlayer:true};
  assert.equal(reference.checkCollision(pa,pb),true);
  assert.equal(resolveReferencePlayerPairs(w.players),1);
  near(a.x,pa.x);near(a.y,pa.y);near(b.x,pb.x);near(b.y,pb.y);
  assert.equal(Math.hypot(a.x-b.x,a.y-b.y),70);
  assert.equal(resolveReferencePlayerPairs(w.players),1);
  near(a.x,pa.x);near(b.x,pb.x);
});
test('dynamic players separate in real world tick and remain controlled by server',()=>{
  const {w,a,b}=room();
  w.tick(.1);
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=69.999);
  assert.ok(a.x<500&&b.x>540);
  assert.equal(a.hp,100);assert.equal(b.hp,100);
  const [positions,attributes]=w.playerUpdates();
  assert.equal(positions.length,8);
  assert.equal(attributes.length,20);
});
test('dead players are non-solid and cannot displace living players',()=>{
  const {w,a,b}=room();
  b.hp=0;b.deadUntil=20000;
  const old={x:a.x,y:a.y};
  w.tick(.1);
  near(a.x,old.x);near(a.y,old.y);
});
test('static edge pins one player and redirects entire overlap to the other',()=>{
  const {w,a,b}=room();
  a.x=24;b.x=65;
  const pos={x:a.x,y:a.y};
  const collisions=resolveReferencePlayerPairs(w.players,(p,x,y)=>x>=24&&x<=14376&&y>=24&&y<=14376);
  assert.equal(collisions,1);
  near(a.x,pos.x);
  assert.ok(b.x>=94,'only the free player is pushed past the overlap');
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=69.999);
});
test('contact preserves heading, velocity, teams and does not damage a player',()=>{
  const {w,a,b}=room();
  a.motionX=300;b.motionX=-100;
  a.team='ABC';b.team='ABC';
  a.angle=1.2;b.angle=2.3;
  resolveReferencePlayerPairs(w.players);
  assert.equal(a.motionX,300);assert.equal(b.motionX,-100);
  assert.equal(a.angle,1.2);assert.equal(b.angle,2.3);
  assert.equal(a.hp,100);assert.equal(b.hp,100);
  assert.equal(a.team,b.team);
});
