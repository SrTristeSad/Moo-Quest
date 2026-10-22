import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/world.js';
function fight({xp=0,tail=0,victimHat=0,health=100}={}){
 let clock=10000;const w=new World({now:()=>clock}),a=w.join(null,'A'),b=w.join(null,'B');
 w.resources.clear();w.structures.clear();w.animals.clear();
 a.x=500;a.y=5000;a.angle=0;a.weaponXp['0']=xp;a.tail=tail;
 b.x=560;b.y=5000;b.hat=victimHat;b.hp=health;
 return {w,a,b,clock:t=>clock=t};
}
test('variants compute actual damage and withhold unowned emerald',()=>{
 for(const [xp,variant,damage] of [[0,0,25],[3000,1,28],[7000,2,30],
   [12000,3,30],[30000,3,30]]){
  const {w,a,b}=fight({xp});
  assert.equal(w.weaponVariant(a),variant);
  assert.equal(w.attack(a.id),true);
  assert.equal(b.hp,100-damage);
 }
});
test('Ruby poison has five ticks, expires, and never attacks its owner',()=>{
 const {w,a,b,clock}=fight({xp:12000});
 w.attack(a.id);assert.equal(b.hp,70);assert.equal(b.poison.damage,5);
 clock(11000);w.tick(.1);assert.equal(b.hp,65);
 clock(15000);w.tick(.1);assert.equal(b.hp,45);
 assert.equal(b.poison,null);assert.equal(a.hp,100);
});
test('immune player cannot be poisoned or bled',()=>{
 for(const props of [{xp:12000},{tail:20}]){
  const {w,a,b}=fight({...props,victimHat:23});
  w.attack(a.id);assert.equal(b.poison,null);
 }
});
test('Devils Tail causes precisely two bleed ticks',()=>{
 const {w,a,b,clock}=fight({tail:20});
 w.attack(a.id);assert.equal(b.hp,75);assert.equal(b.poison.damage,4);
 clock(12000);w.tick(.1);assert.equal(b.hp,67);
 assert.equal(b.poison,null);
});
test('poison fatality credits only one player kill',()=>{
 const {w,a,b,clock}=fight({xp:12000,health:34});
 w.attack(a.id);assert.equal(b.hp,4);
 clock(11000);w.tick(.1);assert.equal(b.hp,0);assert.equal(a.resources.kills,1);
 w.tick(.1);assert.equal(a.resources.kills,1);
});
