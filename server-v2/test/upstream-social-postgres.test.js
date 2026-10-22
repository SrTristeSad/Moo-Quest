import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import {randomBytes} from 'node:crypto';
import {PlayerAccounts} from '../src/player-accounts.js';
import {SocialService} from '../src/social.js';
import {Storage} from '../src/storage.js';
import {Auth} from '../src/auth.js';
import {Updates} from '../src/updates.js';
import {createHTTP} from '../src/http.js';

const testDb=process.env.MOO_TEST_DATABASE_URL;
const loginName=()=>('p'+randomBytes(7).toString('hex')).slice(0,19);
test('reference social flow is persistent, owner-bound and private via real PostgreSQL', {
 skip:!testDb
},async t=>{
 const pool=new pg.Pool({connectionString:testDb});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mq-reference-social-'));
 const accounts=await new PlayerAccounts(pool).init();
 const social=await new SocialService(pool).init();
 const a=await accounts.register(loginName(),'Password1234!@#');
 const b=await accounts.register(loginName(),'Password1234!@#');
 const c=await accounts.register(loginName(),'Password1234!@#');
 const tokens=new Map([
  ['a'.repeat(64),a.id],['b'.repeat(64),b.id],['c'.repeat(64),c.id]
 ]);
 const tokenService={get:async token=>tokens.get(token)||null};
 const storage=new Storage(dir);
 storage.data.owner={username:'admin',password:'unused'};
 const app=createHTTP({root:path.resolve('server-v2'),storage,auth:new Auth(),
  updates:new Updates(dir,storage.dir,{manifestURL:null,publicKeyFile:null}),
  accounts,playerTokens:tokenService,social,httpsCookies:false});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{
  await new Promise(resolve=>app.server.close(resolve));
  await pool.query('DELETE FROM mq_player_accounts WHERE id=ANY($1::uuid[])',[[a.id,b.id,c.id]]);
  await pool.end();fs.rmSync(dir,{recursive:true,force:true});
 });
 const base='http://127.0.0.1:'+app.server.address().port;
 const send=async(who,method,route,body)=>fetch(base+route,{
  method,headers:{authorization:'Bearer '+who,
    ...(body?{'content-type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const aa='a'.repeat(64),bb='b'.repeat(64),cc='c'.repeat(64);
 assert.equal((await send(cc,'GET','/api/social/friends/'+a.id)).status,403);
 assert.equal((await fetch(base+'/api/social/friends/'+a.id)).status,401);
 const created=await send(aa,'POST','/api/social/friends/'+a.id+'/requests',
   {recipientId:b.id});
 assert.equal(created.status,201);
 const request=await created.json();
 assert.equal(request.senderId,a.id);
 assert.equal((await send(aa,'POST','/api/social/friends/'+a.id+'/requests',
   {recipientId:b.id})).status,409);
 const incoming=await (await send(bb,'GET',
   '/api/social/friends/'+b.id+'/requests')).json();
 assert.equal(incoming.length,1);
 assert.equal(incoming[0].id,request.id);
 assert.equal((await send(cc,'POST',
   '/api/social/friends/'+c.id+'/requests/'+request.id,{accept:true})).status,404);
 const accepted=await send(bb,'POST','/api/social/friends/'+b.id+'/requests/'+request.id,
   {accept:true});
 assert.equal(accepted.status,200);
 const friends=await (await send(aa,'GET','/api/social/friends/'+a.id)).json();
 assert.equal(friends.length,1);
 assert.equal(friends[0].id,b.id);
 assert.equal((await send(aa,'POST','/api/chat/whisper',
   {to:c.username,text:'hello there'})).status,403);
 const msg=await send(aa,'POST','/api/chat/whisper',
   {to:b.username,text:'hello there'});
 assert.equal(msg.status,200);
 assert.ok((await msg.json()).id);
 const history=await (await send(bb,'POST','/api/chat/history',
   {kind:'whisper',with:a.username})).json();
 assert.equal(history.messages.length,1);
 assert.equal(history.messages[0].text,'hello there');
 assert.equal((await send(cc,'POST','/api/chat/history',
   {kind:'whisper',with:a.username})).status,200);
 assert.deepEqual((await (await send(cc,'POST','/api/chat/history',
   {kind:'whisper',with:a.username})).json()).messages,[]);
 const invite=await send(aa,'POST','/api/invite',{to:b.username});
 assert.equal(invite.status,201);
 const inbox=await (await send(bb,'GET','/api/invite/inbox')).json();
 assert.equal(inbox.invites.length,1);
 assert.equal(inbox.invites[0].from,a.username);
 await accounts.createClan(a.id,'CT'+randomBytes(2).toString('hex'));
 const clan=await accounts.clanOf(a.id);
 assert.ok(await accounts.joinClan(a.id,b.id,clan.tag));
 assert.equal((await send(aa,'POST','/api/chat/clan',
   {text:'team meeting'})).status,200);
 const clanHistory=await (await send(bb,'POST','/api/chat/history',
   {kind:'clan'})).json();
 assert.equal(clanHistory.messages[0].text,'team meeting');
 assert.equal((await send(cc,'POST','/api/chat/history',{kind:'clan'})).status,403);
 assert.equal((await send(aa,'DELETE','/api/social/friends/'+a.id,
   {friendId:b.id})).status,200);
 assert.equal((await send(aa,'POST','/api/invite',{to:b.username})).status,403);
});
