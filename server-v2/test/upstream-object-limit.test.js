import test from 'node:test';
import assert from 'node:assert/strict';
import {GameObject} from '../src/vendor/al007ex/gameObject.js';
import {ConnectionLimit} from '../src/vendor/al007ex/limit.js';
import {World} from '../src/world.js';
test('original GameObject.getScale matches V2 authoritative tree/bush/stone/ore radii',()=>{
 const subject=new GameObject(55);
 for(const [type,scale,expected] of [[0,100,60],[1,100,60],
   [2,100,100],[3,100,100]]){
  subject.init(300,300,0,scale,type,{},null);
  assert.equal(subject.getScale(),expected);
 }
 const world=new World({seed:200});
 assert.ok([...world.resources.values()].some(o=>o.type===0));
 assert.ok([...world.resources.values()].some(o=>o.type===2));
});
test('original ConnectionLimit tracks concurrent sockets independently per account',()=>{
 const limit=new ConnectionLimit(4);
 const a='account-a',b='account-b';
 for(let i=0;i<4;i++)limit.up(a);
 assert.equal(limit.check(a),true);
 assert.equal(limit.check(b),false);
 limit.up(b);
 limit.down(a);
 assert.equal(limit.check(a),false);
 limit.down(b);
 assert.equal(limit.check(b),false);
 assert.equal(limit.connections.has(b),false);
});
