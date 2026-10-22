import test from 'node:test';
import assert from 'node:assert/strict';
import {filter_chat} from '../src/vendor/al007ex/filterchat.js';

test('ported upstream in-game chat filter stays ASCII and 30 chars',()=>{
 assert.equal(filter_chat('abc'.repeat(20)).length,30);
 assert.equal(filter_chat('oi\u00e9!?'), 'oi!?');
 assert.equal(filter_chat('hello world'), 'hello world');
});
test('upstream filter masks profane words instead of trusting native text',()=>{
 const filtered=filter_chat('hello fuck');
 assert.notEqual(filtered,'hello fuck');
 assert.match(filtered,/^hello Mo+/);
});
