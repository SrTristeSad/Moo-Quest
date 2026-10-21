import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Storage} from '../src/storage.js';
import {Auth} from '../src/auth.js';
import {Updates} from '../src/updates.js';
import {createHTTP} from '../src/http.js';
import {createGuestVerifier} from '../src/guest-verification.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('public HTTP entry rejects captcha:true alone; verifier required for guests, not logged-in accounts',async t=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mq-public-http-'));
  const storage=new Storage(temp);storage.data.owner={username:'admin',password:'hash'};
  const seen=[];
  const guestVerifier=createGuestVerifier({publicMode:true,
    secret:'test-provider-secret',hostname:'game.example.test',httpsCookies:true,
    fetchImpl:async(_url,options)=>{
      seen.push(options.body.get('response'));
      return {ok:true,json:async()=>({success:options.body.get('response')==='verified-token-1234',
        hostname:'game.example.test'})};
    }});
  const app=createHTTP({root,storage,auth:new Auth(),
    guestVerifier,playerTokens:{get:async()=> '00000000-0000-4000-8000-000000000111'},
    updates:new Updates(temp,storage.dir,{manifestURL:null,publicKeyFile:null})});
  const tickets=[];
  app.setGame({room:{players:{size:0}},issueTicket:async(_req,body,accountId)=>{
    tickets.push({body,accountId});
    return {ticket:'test',did:'a'.repeat(32)};
  }});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{
    await new Promise(resolve=>app.server.close(resolve));
    fs.rmSync(temp,{recursive:true,force:true});
  });
  const url='http://127.0.0.1:'+app.server.address().port+'/api/join';
  const post=(body,headers={})=>fetch(url,{method:'POST',
    headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
  const base={host:'https://game.example.test/s/LC',captcha:true};
  assert.equal((await post(base)).status,403);
  assert.equal((await post({...base,captchaToken:'forged-captcha-token'})).status,403);
  assert.equal(tickets.length,0,'rejected requests never reached ticket issuer');
  assert.equal((await post({...base,captchaToken:'verified-token-1234'})).status,200);
  assert.equal(seen.length,2);
  assert.equal(tickets[0].accountId,null);
  const authenticated=await post({host:base.host},{
    authorization:'Bearer '+('b'.repeat(64))});
  assert.equal(authenticated.status,200);
  assert.equal(tickets[1].accountId,'00000000-0000-4000-8000-000000000111');
  assert.equal(seen.length,2,'registered users are not forced to solve a guest CAPTCHA');
});
