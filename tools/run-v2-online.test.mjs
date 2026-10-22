import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { findLove, launchOnlineClient } from './run-v2-online.mjs';

test('Windows executable lookup uses official LÖVE paths without a shell',()=>{
  const win={ProgramFiles:'C:\\Program Files',
    'ProgramFiles(x86)':'C:\\Program Files (x86)'};
  assert.equal(findLove({rootDir:'C:\\Game',
    env:win,exists:p=>p.endsWith('love.exe')}),'C:\\Game/love.exe'.replaceAll('/',requireMaybeSep()));
  assert.equal(findLove({rootDir:'/games/client',env:{},exists:()=>false}),'love.exe');
});
function requireMaybeSep(){return process.platform==='win32'?'\\':'/';}

test('launcher starts LÖVE after confirmed V2 HTTPS bridge, without PowerShell',async()=>{
  let started=false,closed=false,fetchURL,entry;
  const relay={
    async listen(){started=true;return {port:8080};},
    async close(){closed=true;}
  };
  const fakeProcess=new EventEmitter();
  fakeProcess.exitCode=null;
  fakeProcess.killed=false;
  fakeProcess.kill=()=>{fakeProcess.killed=true;};
  const code=await launchOnlineClient({
    createRelay:()=>relay,
    httpFetch:async(url,options)=>{
      fetchURL=url;
      assert.equal(started,true);
      assert.equal(options.redirect,'error');
      return {status:200,json:async()=>({build:'mqv2native'})};
    },
    executable:'/mock/love.exe',
    spawnProcess:(exe,args,options)=>{
      entry={exe,args,options};
      process.nextTick(()=>{fakeProcess.exitCode=0;fakeProcess.emit('exit',0,null);});
      return fakeProcess;
    },
    env:{CUSTOM_SAFE:'1'}
  });
  assert.equal(code,0);
  assert.equal(fetchURL,'http://127.0.0.1:8080/ping');
  assert.equal(entry.exe,'/mock/love.exe');
  assert.equal(entry.options.shell,false);
  assert.equal(entry.options.env.MOOQUEST_REQUIRE_V2,'1');
  assert.equal(entry.options.env.MOOQUEST_V2_ONLINE,'1');
  assert.equal(entry.options.env.CUSTOM_SAFE,'1');
  assert.equal(entry.args.length,1);
  assert.equal(closed,true);
});

test('unexpected remote API refuses to spawn LÖVE, always closes local TLS relay',async()=>{
  let spawns=0,closed=false;
  await assert.rejects(launchOnlineClient({
    createRelay:()=>({listen:async()=>{},close:async()=>{closed=true;}}),
    httpFetch:async()=>({status:200,json:async()=>({build:'wrong-server'})}),
    executable:'/mock/love.exe',
    spawnProcess:()=>{spawns++;throw Error('should not launch');}
  }),/Servidor remoto inesperado/);
  assert.equal(spawns,0);
  assert.equal(closed,true);
});

test('missing LÖVE closes the bridge and fails with actionable error',async()=>{
  let closed=false;
  const fakeProcess=new EventEmitter();
  fakeProcess.killed=false;
  fakeProcess.exitCode=null;
  fakeProcess.kill=()=>{fakeProcess.killed=true;};
  await assert.rejects(launchOnlineClient({
    createRelay:()=>({listen:async()=>{},close:async()=>{closed=true;}}),
    httpFetch:async()=>({status:200,json:async()=>({build:'mqv2native'})}),
    executable:'nonexistent-love.exe',
    spawnProcess:()=>{
      process.nextTick(()=>fakeProcess.emit('error',Object.assign(Error('ENOENT'),{code:'ENOENT'})));
      return fakeProcess;
    }
  }),/Nao foi possivel abrir LÖVE 2D/);
  assert.equal(closed,true);
});
