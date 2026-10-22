import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world.js';
test('server owns positions, speed, boundaries and life; clients only submit input', () => {
  let at=10000;
  const w = new World({ maxPlayers:2, now:()=>at });
  const a = w.join(null,'Alice');
  const b = w.join(null,'Bob');
  assert.throws(()=>w.join(null,'Third'),/server_full/);
  a.x=500;a.y=5000;b.x=540;b.y=5000;
  assert.equal(w.input(a.id,{dx:1000,dy:1,x:999999}),false);
  assert.equal(w.input(a.id,{dx:1,dy:0,x:999999}),true);
  w.tick(0.1);
  assert.equal(a.x,525);
  assert.equal(w.snapshot().players.length,2);
  assert.equal(w.attack(a.id),true);
  assert.equal(b.hp,75);
  assert.equal(w.attack(a.id),false,'attack cooldown enforced by server');
  at+=501;
  for(let i=0;i<6;i++) { assert.equal(w.attack(a.id),true);at+=501; }
  assert.equal(b.hp,0);
  assert.equal(w.input(b.id,{dx:1,dy:1}),false);
  at+=3000; w.tick(0.1);
  assert.equal(b.hp,100);
  w.leave(a.id);
  assert.equal(w.players.size,1);
});
test('inputs cannot push coordinates outside the map or move dead players',()=>{
  const w = new World(); const p=w.join(null,'Tester');
  p.x=24;p.y=24;
  w.input(p.id,{dx:-1,dy:-1});w.tick(1);
  assert.ok(p.x>=24 && p.y>=24);
  assert.equal(w.input(p.id,{dx:Infinity,dy:0}),false);
});
