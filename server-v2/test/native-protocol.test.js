import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { NativeSession,pack,unpack,NATIVE_VERSION } from '../src/native-protocol.js';

test('MessagePack preserves Lua-compatible primitive values, map, arrays and null slots',()=>{
  const samples=[null,0,-1,-255,65535,4294967295,Math.PI,true,false,'Café',
    [],[1,null,3],{name:'Teste',skin:5,live:true},[null,null,null,17]];
  for(const item of samples)assert.deepEqual(JSON.parse(JSON.stringify(unpack(pack(item)))),item);
  assert.throws(()=>unpack(Buffer.from([0x91,0xa5,0x61])),/truncated/);
  assert.throws(()=>unpack(Buffer.from([0x80,0x00])),/trailing/);
  assert.throws(()=>pack({unsafe:Number.NaN}),/nonfinite/);
  assert.throws(()=>unpack(pack(Object.fromEntries([['__proto__',null],['constructor',12]]))),/unsafe map key/);
});

test('native binary wire: io-init six fields, keyed MAC, sequence replay rejection',()=>{
  const key=Buffer.alloc(16,0xab);
  const session=new NativeSession({seed:12345,key,socketId:'0123456789abcdef'});
  assert.equal(NATIVE_VERSION,'mq-v2-native-compat-1');
  assert.deepEqual(unpack(session.handshake()),['io-init',[
    '0123456789abcdef',12345,key.toString('hex'),1,0,0
  ]]);
  const first=session.makeTestRequest('M',[{name:'Lua',skin:1}]);
  const parsed=session.decode(first);
  assert.equal(parsed.name,'M');assert.equal(parsed.args[0].name,'Lua');
  assert.throws(()=>session.decode(first),/sequence/);
  const second=session.makeTestRequest('D',[Math.PI/3],2);
  assert.equal(session.decode(second).name,'D');
  const forged=Buffer.from(session.makeTestRequest('9',[1],3));
  forged[forged.length-1]^=1;
  assert.throws(()=>session.decode(forged),/MAC/);
  assert.deepEqual(unpack(session.encode('C',[12]))[1],[12]);
  assert.throws(()=>session.encode('q',[5,[]]),/unsupported/);
  assert.equal(session.decode(session.makeTestRequest('V',[5],3)).name,'V');
  assert.deepEqual(unpack(session.encode('p',[5,'{"name":"Lua"}']))[1],
    [5,'{"name":"Lua"}']);
  assert.equal(unpack(session.encode('F',[5,0,0,0,0,0,0,0,0,0,0,null,100]))[1].length,13);
});

test('transport contract: all legacy Lua action names have unique seeded IDs',()=>{
  const a=new NativeSession({seed:777,key:Buffer.alloc(16,1)});
  assert.equal(a.incoming.forward.size,18);
  assert.equal(a.outgoing.forward.size,39);
  assert.equal(new Set(a.incoming.forward.values()).size,18);
  assert.equal(new Set(a.outgoing.forward.values()).size,39);
  assert.equal(a.incoming.forward.get('V'),17);
  assert.equal(a.outgoing.forward.get('p'),36);
  assert.equal(a.outgoing.forward.get('F'),37);
  assert.equal(a.outgoing.forward.get('W'),38);
  assert.ok(a.outgoing.forward.has('H'));
  assert.ok(a.outgoing.forward.has('P'));
  assert.ok(a.outgoing.forward.has('5'));
  const body=pack([a.incoming.forward.get('0'),[],1]);
  const frame=Buffer.concat([createHmac('sha256',a.key).update(body).digest().subarray(0,6),body]);
  assert.equal(a.decode(frame).name,'0');
});
