import test from 'node:test';
import assert from 'node:assert/strict';
import {filter_chat} from '../src/vendor/al007ex/filterchat.js';

test('unmodified upstream chat filter limits length and strips non-ASCII characters',()=>{
 assert.equal(filter_chat('123'.repeat(20)).length,30);
 assert.equal(filter_chat('oi\u00e9!?'), 'oi!?');
 assert.equal(filter_chat('123 456'), '123 456');
});
test('unmodified upstream filter retains its original Mo* masking behavior',()=>{
 assert.equal(filter_chat('fuck'),'Mooo');
 assert.equal(filter_chat('hello fuck'),'Moooo Mooo');
});
