import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocket} from 'ws';
import {Storage} from '../src/storage.js';
import {Auth} from '../src/auth.js';
import {Updates} from '../src/updates.js';
import {createHTTP} from '../src/http.js';
import {GameServer} from '../src/game.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const input={host:'http://127.0.0.1:8080/s/LC',captcha:true};
const accountId='00000000-0000-4000-8000-000000000333';

async function launch(t){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mq-guests-toggle-'));
  t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
  const storage=new Storage(tmp);
  storage.data.owner={username:'Owner',password:'not-tested-here'};
  storage.save();
  const auth=new Auth();
  const updates=new Updates(tmp,storage.dir,{manifestURL:null,publicKeyFile:null});
  let verified=0;
  const guestVerifier={publicMode:true,verify:async()=>{verified++;return true;}};
  const playerTokens={get:async token=>token==='b'.repeat(64)?accountId:null};
  const app=createHTTP({root,storage,auth,updates,guestVerifier,playerTokens});
  let serial=0;
  const tickets=new Map();
  const ticketStore={
    issue:async(ipHash,id)=>{
      const token=(++serial).toString(16).padStart(36,'0');
      tickets.set(token,{ipHash,accountId:id});
      return token;
    },
    consumeDetails:async(token,hash)=>{
      const claim=tickets.get(token);tickets.delete(token);
      return claim?.ipHash===hash?{accountId:claim.accountId}:null;
    }
  };
  const game=new GameServer(app.server,storage,ticketStore);
  app.setGame(game);
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{
    await game.stop();
    await new Promise(resolve=>app.server.close(resolve));
  });
  const base='http://127.0.0.1:'+app.server.address().port;
  const admin=auth.issue(),cookie='mq_admin='+admin.token;
  const request=(endpoint,opts={})=>fetch(base+endpoint,{redirect:'manual',...opts});
  const join=(bearer=false)=>request('/api/join',{
    method:'POST',
    headers:{'content-type':'application/json',
      ...(bearer?{authorization:'Bearer '+('b'.repeat(64))}:{})},
    body:JSON.stringify(input)
  });
  const update=(patch,csrf=admin.csrf)=>request('/api/admin/settings',{
    method:'POST',
    headers:{cookie,'x-csrf-token':csrf,'content-type':'application/json'},
    body:JSON.stringify(patch)
  });
  function open(ticket){
    const ws=new WebSocket(base.replace('http:','ws:')+
      '/s/LC?b=mqv2native&token=tk:'+ticket);
    ws.on('error',()=>{});
    t.after(()=>ws.terminate());
    return ws;
  }
  return {tmp,storage,app,game,join,update,request,open,cookie,
    getVerifyCount:()=>verified};
}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const until=async condition=>{
  for(let n=0;n<80;n++){
    if(condition())return;
    await wait(20);
  }
  assert.fail('Timed out waiting for guest policy transition');
};

test('Admin can disable/enable guests independently from registration and maintenance',async t=>{
  const {tmp,storage,join,update,request,cookie,getVerifyCount}=await launch(t);
  const initial=(await (await request('/api/capabilities')).json());
  assert.equal(initial.guestEnabled,true);
  assert.equal(initial.guestAdmission,'verified_challenge');
  assert.equal(initial.registrationEnabled,false);
  assert.equal((await join()).status,200);

  const invalid=await update({allowGuests:'false'});
  assert.equal(invalid.status,400);
  assert.equal(storage.data.settings.allowGuests,true);
  assert.equal((await update({allowGuests:false},'incorrect')).status,403);
  assert.equal(storage.data.settings.allowGuests,true);
  const changed=await update({allowGuests:false,publicRegistration:true});
  assert.equal(changed.status,200);
  const changedJson=await changed.json();
  assert.equal(changedJson.allowGuests,false);
  assert.equal(changedJson.publicRegistration,true);

  const disabled=await join(),disabledBody=await disabled.json();
  assert.equal(disabled.status,403);
  assert.deepEqual(disabledBody,{error:'guests_disabled'});
  const verifyBefore=getVerifyCount();
  assert.equal((await join()).status,403);
  assert.equal(getVerifyCount(),verifyBefore,'Turnstile is not called for forbidden guests');
  const capability=(await (await request('/api/capabilities')).json());
  assert.equal(capability.guestEnabled,false);
  assert.equal(capability.guestAdmission,'disabled');
  assert.equal(capability.registrationEnabled,true);
  assert.equal((await join(true)).status,200,'account admission remains available');

  const persisted=new Storage(tmp);
  assert.equal(persisted.data.settings.allowGuests,false);
  assert.equal(persisted.data.settings.publicRegistration,true);
  const audit=(await (await request('/api/admin/audit',{headers:{cookie}})).json());
  assert.equal(audit[0].kind,'settings_changed');
  assert.equal(audit[0].allowGuests,false);
  assert.equal((await update({allowGuests:true,publicRegistration:false})).status,200);
  assert.equal((await join()).status,200,'guest mode can be re-enabled');
  assert.equal((await (await request('/api/capabilities')).json()).registrationEnabled,false);
});

test('Turning guest mode off closes current anonymous WS, invalidates outstanding tickets but not authenticated WS',async t=>{
  const {game,join,update,open}=await launch(t);
  const guestTicket=(await (await join()).json()).ticket;
  const savedTicket=(await (await join()).json()).ticket;
  const accountTicket=(await (await join(true)).json()).ticket;
  const guest=open(guestTicket),account=open(accountTicket);
  await Promise.all([
    new Promise((resolve,reject)=>{guest.once('open',resolve);guest.once('error',reject);}),
    new Promise((resolve,reject)=>{account.once('open',resolve);account.once('error',reject);})
  ]);
  assert.equal(game.nativeClients.size,2);
  const changed=await update({allowGuests:false});
  assert.equal(changed.status,200);
  await until(()=>guest.readyState===WebSocket.CLOSED);
  assert.equal(account.readyState,WebSocket.OPEN,
    'authenticated WS stays open after disabling guest mode');
  assert.equal([...game.nativeClients.values()].some(x=>!x.grantedAccountId&&
    x.ws.readyState===WebSocket.OPEN),false);
  // Tickets issued while guests were permitted must never authorize an
  // upgrade after admin disables guests, even if not expired yet.
  const oldTicket=open(savedTicket);
  await until(()=>oldTicket.readyState===WebSocket.CLOSED);
  assert.equal(account.readyState,WebSocket.OPEN);
  assert.equal((await join(true)).status,200);
  await update({allowGuests:true});
  const newTicket=(await (await join()).json()).ticket;
  const again=open(newTicket);
  await new Promise((resolve,reject)=>{again.once('open',resolve);again.once('error',reject);});
  assert.equal(again.readyState,WebSocket.OPEN);
});
