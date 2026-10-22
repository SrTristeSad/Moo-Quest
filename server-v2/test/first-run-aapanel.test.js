import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInfrastructureInstaller, normalizeSetup, savedInfrastructure } from '../setup-server.js';
import { atomicJSON } from '../src/storage.js';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const form=()=>({code:'123456',pgHost:'127.0.0.1',pgPort:5432,pgDatabase:'mooquest',
  pgUser:'mooquest',pgPassword:'fake-strong-password',pgTls:false,
  redisHost:'127.0.0.1',redisPort:6379,redisDatabase:0,
  redisPassword:'redis-password',redisUsername:'',redisTls:false,
  adminUsername:'Admin',adminPassword:'long-password-for-test'});
test('first-run input normalizes encoded credentials and rejects unsafe remote plaintext',()=>{
  const good=normalizeSetup(form());
  assert.ok(good.databaseURL.includes('postgresql://mooquest:'));
  assert.ok(good.redisURL.includes('redis://:'));
  assert.ok(!good.databaseURL.includes('fake-strong-password@'),
    'URL password must be escaped where needed');
  const bad={...form(),pgHost:'db.example.com'};
  assert.throws(()=>normalizeSetup(bad),/exige TLS/);
  bad.pgTls=true;bad.redisHost='redis.example.com';
  assert.throws(()=>normalizeSetup(bad),/exige TLS/);
  assert.throws(()=>normalizeSetup({...form(),pgDatabase:'db;DROP TABLE'}),
    /invalido/);
  assert.throws(()=>normalizeSetup({...form(),redisDatabase:999}),
    /fora de 0 a 15/);
});
test('first launch offers /setup with isolated code, tests two services and completes once',async t=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mq-first-run-'));
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  fs.mkdirSync(path.join(temp,'public'));
  for(const ext of ['html','js'])fs.copyFileSync(
    path.join(project,'public','setup-infrastructure.'+ext),
    path.join(temp,'public','setup-infrastructure.'+ext));
  let testsPg=0,testsRedis=0,installs=0,activated=null;
  const drivers={
    postgres:async url=>{testsPg++;assert.ok(url.startsWith('postgresql://'));return {database:'mooquest'};},
    redis:async url=>{testsRedis++;assert.ok(url.startsWith('redis://'));return {connected:true};},
    initialize:async (root,urls,owner)=>{
      installs++;
      assert.equal(root,temp);
      assert.equal(owner.username,'Admin');
      assert.equal(owner.password,'long-password-for-test');
      atomicJSON(path.join(temp,'var','infrastructure.json'),{schema:1,...urls});
      return {configured:true};
    }
  };
  let activation;
  const completed=new Promise(resolve=>activation=resolve);
  const installer=createInfrastructureInstaller({root:temp,code:'123456',drivers,
    onInstalled:urls=>{activated=urls;activation();}});
  const addr=await installer.listen(0);
  const base='http://127.0.0.1:'+addr.port;
  t.after(()=>{if(installer.server.listening)installer.server.close();});
  const html=await fetch(base+'/setup');
  assert.equal(html.status,200);
  assert.equal(html.headers.get('x-frame-options'),'DENY');
  const text=await html.text();
  assert.match(text,/PostgreSQL/);
  assert.ok(!text.includes('123456'),'setup code is not sent in HTML');
  const post=(route,payload)=>fetch(base+route,{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  assert.equal((await post('/setup/test-postgres',{...form(),code:'000000'})).status,403);
  assert.equal((await post('/setup/test-postgres',form())).status,200);
  assert.equal((await post('/setup/test-redis',form())).status,200);
  assert.equal(testsPg,1);assert.equal(testsRedis,1);
  const done=await post('/setup/install',form());
  assert.equal(done.status,200);
  assert.equal((await done.json()).ok,true);
  await completed;
  assert.equal(installs,1);
  assert.equal(testsPg,2);assert.equal(testsRedis,2);
  assert.ok(activated?.databaseURL);
  const saved=savedInfrastructure(temp);
  assert.equal(saved.schema,1);
  assert.equal(fs.statSync(path.join(temp,'var','infrastructure.json')).mode&0o077,0);
  fs.chmodSync(path.join(temp,'var','infrastructure.json'),0o644);
  assert.throws(()=>savedInfrastructure(temp),/permissions/);
});
test('wrong setup token is throttled and never initializes a database',async t=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mq-setup-limit-'));
  t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
  const installer=createInfrastructureInstaller({root:tmp,code:'123456',drivers:{
    postgres:()=>{throw new Error('should not connect');},
    redis:()=>{throw new Error('should not connect');},
    initialize:()=>{throw new Error('should not initialize');}
  }});
  const addr=await installer.listen(0);
  t.after(()=>installer.server.close());
  const url='http://127.0.0.1:'+addr.port+'/setup/test-redis';
  const send=()=>fetch(url,{method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({...form(),code:'000000'})});
  for(let i=0;i<5;i++)assert.equal((await send()).status,403);
  assert.equal((await send()).status,429);
});
