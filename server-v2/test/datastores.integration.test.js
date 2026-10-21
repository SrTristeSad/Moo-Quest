import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createClient } from 'redis';
import { PostgresStorage } from '../src/database.js';
import { RedisAuth, RedisTickets, RedisPlayerTokens } from '../src/redis-services.js';
import { atomicJSON } from '../src/storage.js';
import { Updates } from '../src/updates.js';
import { createHTTP } from '../src/http.js';

const databaseURL=process.env.MOO_TEST_DATABASE_URL;
const redisURL=process.env.MOO_TEST_REDIS_URL;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('actual PostgreSQL persists administration and imports JSON only into an empty database',async t=>{
  if(!databaseURL)return t.skip('Set MOO_TEST_DATABASE_URL for live integration');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mq-pg-live-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const pool=new pg.Pool({connectionString:databaseURL});
  t.after(async()=>pool.end());
  await pool.query('DROP TABLE IF EXISTS mq_admin_state');
  const legacy={schema:1,owner:{username:'OldOwner',password:'scrypt$example'},
    settings:{title:'Recovered',motd:'backup',maxPlayers:42,maintenance:false,
      publicRegistration:false},bans:{abcd:{reason:'test'}},
    announcements:[],audit:[]};
  atomicJSON(path.join(dir,'var','config.json'),legacy);
  await assert.rejects(
    ()=>new PostgresStorage(dir,{pool,importLegacy:false}).init(),
    /MOO_IMPORT_JSON/,
    'existing owner must never disappear because migration was not requested');
  const first=await new PostgresStorage(dir,{pool,importLegacy:true}).init();
  assert.equal(first.data.owner.username,'OldOwner');
  assert.equal(first.data.settings.maxPlayers,42);
  first.data.settings.title='Saved in SQL';
  await first.audit('postgres_commit');
  const second=await new PostgresStorage(dir,{pool,importLegacy:false}).init();
  assert.equal(second.data.settings.title,'Saved in SQL');
  assert.equal(second.data.audit.at(-1).kind,'postgres_commit');
  assert.equal(second.data.bans.abcd.reason,'test');
  // Existing database content must never be replaced by an obsolete JSON.
  atomicJSON(path.join(dir,'var','config.json'),{...legacy,owner:null});
  const third=await new PostgresStorage(dir,{pool,importLegacy:true}).init();
  assert.equal(third.data.owner.username,'OldOwner');
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'var','config.json'))).owner,null,
    'PostgreSQL writes must not rewrite legacy config file');
  await pool.query('DROP TABLE mq_admin_state');
});

test('actual Redis persists sessions across Auth instances, throttles logins and consumes tickets once',async t=>{
  if(!redisURL)return t.skip('Set MOO_TEST_REDIS_URL for live integration');
  const client=createClient({url:redisURL});
  client.on('error',()=>{});
  await client.connect();
  t.after(async()=>client.quit());
  const prefix='mq:integration:'+randomUUID()+':';
  const admin=new RedisAuth(client,{prefix});
  const secondAdmin=new RedisAuth(client,{prefix});
  // The distributed limiter is atomic across concurrent API workers.
  const attempts=await Promise.all(Array.from({length:6},
    ()=>admin.allowRegistration('203.0.113.10')));
  assert.equal(attempts.filter(Boolean).length,3);
  assert.equal(await admin.allowRegistration('203.0.113.11'),true);
  assert.ok((await client.ttl(admin.key('registration','203.0.113.10')))>0);
  const session=await admin.issue();
  assert.deepEqual(await secondAdmin.get(session.token),{csrf:session.csrf});
  assert.equal(secondAdmin.sameCsrf(await admin.get(session.token),session.csrf),true);
  const key=admin.key('session',session.token);
  assert.ok((await client.ttl(key))>0);
  await secondAdmin.revoke(session.token);
  assert.equal(await admin.get(session.token),null);
  for(let i=0;i<5;i++)await admin.recordFailure('127.0.0.1');
  assert.equal(await secondAdmin.loginBlocked('127.0.0.1'),true);
  await admin.clearFailure('127.0.0.1');
  assert.equal(await secondAdmin.loginBlocked('127.0.0.1'),false);
  const tickets=new RedisTickets(client,{prefix});
  const ipHash='c'.repeat(64);
  const ticket=await tickets.issue(ipHash);
  assert.match(ticket,/^[0-9a-f]{36}$/);
  assert.equal(await tickets.consume(ticket,'d'.repeat(64)),false,
    'wrong address consumes the token without granting a connection');
  assert.equal(await tickets.consume(ticket,ipHash),false);
  const next=await tickets.issue(ipHash);
  const results=await Promise.all([tickets.consume(next,ipHash),tickets.consume(next,ipHash)]);
  assert.deepEqual(results.sort(),[false,true],'GETDEL enforces single use across calls');
  for(let i=2;i<8;i++)assert.ok(await tickets.issue(ipHash));
  assert.equal(await tickets.issue(ipHash),null,'ninth ticket within ten seconds blocked');
  const accountId=randomUUID();
  const playerTokens=new RedisPlayerTokens(client,{prefix});
  const token=await playerTokens.issue(accountId);
  const accountTicket=await tickets.issue('d'.repeat(64),accountId);
  assert.ok(accountTicket,'account ticket issued under original session revision');
  await playerTokens.revoke(token.token);
  assert.equal(await playerTokens.get(token.token),null);
  assert.equal(await tickets.consumeDetails(accountTicket,'d'.repeat(64)),null,
    'logout invalidates pending account entry tickets');
  const nextToken=await playerTokens.issue(accountId);
  const renewed=await tickets.issue('d'.repeat(64),accountId);
  assert.deepEqual(await tickets.consumeDetails(renewed,'d'.repeat(64)),
    {accountId},'a freshly authenticated ticket uses the new revision');
  await playerTokens.revoke(nextToken.token);
  const rkey=prefix+'ticket-rate:'+(await import('node:crypto')).createHash('sha256').update(ipHash).digest('hex');
  assert.ok((await client.ttl(rkey))>0);
  // Delete only namespaced integration keys; never flush a shared Redis DB.
  const keys=await client.keys(prefix+'*');
  if(keys.length)await client.del(keys);
});

test('HTTP setup and session cookies work against live PostgreSQL and Redis',async t=>{
  if(!databaseURL||!redisURL)return t.skip('Set both MOO_TEST URLs for live integration');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mq-http-db-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const pool=new pg.Pool({connectionString:databaseURL});
  t.after(async()=>pool.end());
  await pool.query('DROP TABLE IF EXISTS mq_admin_state');
  const storage=await new PostgresStorage(dir,{pool}).init();
  const client=createClient({url:redisURL});
  client.on('error',()=>{});
  await client.connect();
  t.after(async()=>client.quit());
  const prefix='mq:integration:'+randomUUID()+':';
  const auth=new RedisAuth(client,{prefix});
  const updates=new Updates(dir,storage.dir,{manifestURL:null,publicKeyFile:null});
  const app=createHTTP({root,storage,auth,updates,httpsCookies:false});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>app.server.close(resolve)));
  const base='http://127.0.0.1:'+app.server.address().port;
  const form=(values)=>({method:'POST',redirect:'manual',
    headers:{'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams(values)});
  assert.equal((await fetch(base+'/ready')).status,503);
  const response=await fetch(base+'/setup',form({code:auth.setupCode,
    username:'SQLAdmin',password:'strong-password-for-postgres'}));
  assert.equal(response.status,303);
  const cookie=response.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(base+'/ready')).status,200);
  const adminSession=await (await fetch(base+'/api/admin/session',{headers:{cookie}})).json();
  assert.equal(adminSession.owner,'SQLAdmin');
  assert.ok(adminSession.csrf);
  const newer=await new PostgresStorage(dir,{pool}).init();
  assert.equal(newer.data.owner.username,'SQLAdmin');
  assert.equal(newer.data.audit[0].kind,'installation');
  const logout=await fetch(base+'/admin/logout',{method:'POST',headers:{
    cookie,'content-type':'application/json','x-csrf-token':adminSession.csrf},body:'{}'});
  assert.equal(logout.status,200);
  assert.equal((await fetch(base+'/api/admin/session',{headers:{cookie}})).status,401);
  const keys=await client.keys(prefix+'*');
  if(keys.length)await client.del(keys);
  await pool.query('DROP TABLE mq_admin_state');
});
