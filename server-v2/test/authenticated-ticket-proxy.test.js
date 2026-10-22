import test from 'node:test';
import assert from 'node:assert/strict';
import {RedisTickets} from '../src/redis-services.js';

const accountId='ab12ef34-5678-4bcd-9e01-234567890abc';
function fakeRedis(){
  const values=new Map(),writes=[];
  return {
    writes,values,
    async eval(_script,{keys}){
      const key=keys[0],value=Number(values.get(key)||0)+1;
      values.set(key,String(value));
      return value;
    },
    async get(key){return values.get(key)??null;},
    async getDel(key){
      const value=values.get(key)??null; values.delete(key);return value;
    },
    async set(key,value,options){
      writes.push({key,options});
      if(options?.NX&&values.has(key))return null;
      values.set(key,value);return 'OK';
    }
  };
}
test('authenticated single-use Redis ticket survives reverse proxy origin-IP drift',async()=>{
  const redis=fakeRedis(),tickets=new RedisTickets(redis);
  const token=await tickets.issue('join-cloudflare-ip-hash',accountId);
  assert.match(token,/^[a-f0-9]{36}$/);
  assert.deepEqual(await tickets.consumeDetails(token,'websocket-cloudflare-ip-hash'),
    {accountId});
  assert.equal(await tickets.consumeDetails(token,'join-cloudflare-ip-hash'),null,
    'GETDEL burns an authenticated ticket on the first attempt');
  assert.equal(redis.writes[0].options.EX,30,'ticket expiry unchanged');
  assert.equal(redis.writes[0].options.NX,true,'cannot overwrite token');
});
test('guest tickets remain bound to exact source IP and are still one-use',async()=>{
  const redis=fakeRedis(),tickets=new RedisTickets(redis);
  const mismatch=await tickets.issue('guest-original',null);
  assert.equal(await tickets.consumeDetails(mismatch,'guest-different'),null);
  assert.equal(await tickets.consumeDetails(mismatch,'guest-original'),null);
  const same=await tickets.issue('guest-original',null);
  assert.deepEqual(await tickets.consumeDetails(same,'guest-original'),{accountId:null});
});
test('revoking account ticket generation still blocks issued authenticated tickets',async()=>{
  const redis=fakeRedis(),tickets=new RedisTickets(redis);
  const token=await tickets.issue('origin-one',accountId);
  redis.values.set('mq:v2:ticket-revision:'+accountId,'1');
  assert.equal(await tickets.consumeDetails(token,'origin-two'),null,
    'account logout/all-sessions revocation remains effective');
  assert.equal(await tickets.consumeDetails(token,'origin-one'),null);
});
test('tampered/malformed Redis ticket data fails closed',async()=>{
  const redis=fakeRedis(),tickets=new RedisTickets(redis);
  const token=await tickets.issue('some-ip',accountId);
  redis.values.set('mq:v2:ticket:'+token,'{malformed');
  assert.equal(await tickets.consumeDetails(token,'some-ip'),null);
  const token2=await tickets.issue('some-ip',accountId);
  redis.values.set('mq:v2:ticket:'+token2,JSON.stringify({
    ipHash:'some-ip',accountId:'not-a-uuid',revision:'0'}));
  assert.equal(await tickets.consumeDetails(token2,'some-ip'),null);
});
