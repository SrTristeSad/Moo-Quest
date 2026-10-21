import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {createClient} from 'redis';
import {WebSocket} from 'ws';
import {Storage} from '../src/storage.js';
import {Auth} from '../src/auth.js';
import {RedisAuth,RedisTickets,RedisPlayerTokens} from '../src/redis-services.js';
import {PlayerAccounts} from '../src/player-accounts.js';
import {Updates} from '../src/updates.js';
import {createHTTP} from '../src/http.js';
import {GameServer} from '../src/game.js';
import {NativeSession,unpack} from '../src/native-protocol.js';

const pgURL=process.env.MOO_TEST_DATABASE_URL,redisURL=process.env.MOO_TEST_REDIS_URL;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function launch(t){
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'moo-registered-'));
  const pool=new pg.Pool({connectionString:pgURL});
  const accounts=await new PlayerAccounts(pool).init();
  const redis=createClient({url:redisURL});redis.on('error',()=>{});
  await redis.connect();
  const prefix='mq:player-test:'+randomUUID()+':';
  const cleanupUsers=[];
  const store=new Storage(temp);store.data.owner={username:'admin',password:'hash'};
  store.data.settings.publicRegistration=true;
  const auth=new RedisAuth(redis,{prefix});
  const playerTokens=new RedisPlayerTokens(redis,{prefix});
  const updates=new Updates(temp,store.dir,{manifestURL:null,publicKeyFile:null});
  const app=createHTTP({root,storage:store,auth,updates,accounts,playerTokens,httpsCookies:false});
  const game=new GameServer(app.server,store,new RedisTickets(redis,{prefix}),{accounts});
  app.setGame(game);
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
  game.start();
  t.after(async()=>{
    // Shut down network and flush active profiles BEFORE closing either
    // database. Node's after() hooks execute in registration order.
    await game.stop();
    await new Promise(r=>app.server.close(r));
    await accounts.flush();
    for(const username of cleanupUsers)
      await pool.query('DELETE FROM mq_player_accounts WHERE username_key=$1',
        [username.toLowerCase()]);
    const keys=await redis.keys(prefix+'*');
    if(keys.length)await redis.del(keys);
    await redis.quit();
    await pool.end();
    fs.rmSync(temp,{recursive:true,force:true});
  });
  const base='http://127.0.0.1:'+app.server.address().port;
  const post=async(route,body,headers={})=>fetch(base+route,{
    method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
  return {base,accounts,redis,game,store,post,playerTokens,pool,cleanupUsers};
}
async function enter(base,ticket,name='ClaimedWithoutProof'){
  const ws=new WebSocket(base.replace('http:','ws:')+'/s/LC?b=mqv2native&token=tk:'+ticket);
  const packets=[];let session=null;
  ws.on('message',(raw,binary)=>{
    assert.equal(binary,true);
    if(!session){
      const record=unpack(raw);
      assert.equal(record[0],'io-init');
      session=new NativeSession({socketId:record[1][0],seed:record[1][1],
        key:Buffer.from(record[1][2],'hex')});
      ws.send(session.makeTestRequest('M',[{name,skin:2,moofoll:false,anon:false}]));
    }else{
      const r=unpack(raw),n=session.outgoing.reverse.get(r[0]);
      packets.push({name:n,args:r[1]});
    }
  });
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
  const until=Date.now()+4000;
  while(!packets.some(p=>p.name==='C')&&Date.now()<until)await sleep(10);
  assert.ok(packets.some(p=>p.name==='C'),'native handshake completed');
  return {ws,packets};
}

test('PostgreSQL player account + Redis token protects persistent progress across native reconnects',async t=>{
  if(!pgURL||!redisURL)return t.skip('live PostgreSQL + Redis only');
  const {base,accounts,game,store,post,cleanupUsers}=await launch(t);
  const username='Player'+randomUUID().slice(0,8);
  cleanupUsers.push(username);
  store.data.settings.publicRegistration=false;
  assert.equal((await post('/api/account/register',{username,password:'strong-player-password'})).status,403);
  store.data.settings.publicRegistration=true;
  let response=await post('/api/account/register',{username,password:'strong-player-password'});
  assert.equal(response.status,201);
  const registered=await response.json();
  assert.match(registered.id,/^[0-9a-f-]{36}$/);
  assert.equal((await post('/api/account/register',{username:username.toLowerCase(),password:'new-password-123456'})).status,409);
  assert.equal((await post('/api/account/login',{username,password:'wrong-password'})).status,401);
  response=await post('/api/account/login',{username,password:'strong-player-password'});
  assert.equal(response.status,200);
  const authorized=await response.json();
  assert.match(authorized.token,/^[a-f0-9]{64}$/);
  const head={authorization:'Bearer '+authorized.token};
  assert.equal((await fetch(base+'/api/account/me',{headers:head})).status,200);
  assert.equal((await fetch(base+'/api/account/me',{headers:{authorization:'Bearer '+('1'.repeat(64))}})).status,401);
  const request={host:base+'/s/LC',captcha:true,did:'c'.repeat(32)};
  assert.equal((await post('/api/join',request,{authorization:'Bearer '+('1'.repeat(64))})).status,401);
  let join=await (await post('/api/join',request,head)).json();
  const first=await enter(base,join.ticket);
  t.after(()=>first.ws.terminate());
  const p=[...game.room.players.values()][0];
  assert.equal(p.name,username,'forged Lua display name cannot impersonate a registered account');
  assert.equal(p.accountId,registered.id);
  p.resources.wood=87;p.resources.points=300;p.xp=13;p.age=4;p.hp=78;
  p.ownedHats.add(57);p.hat=57;p.inventory.items.push(16);
  first.ws.close();
  await new Promise(resolve=>first.ws.once('close',resolve));
  const deadline=Date.now()+3000;
  while(game.activeAccounts.has(registered.id)&&Date.now()<deadline)await sleep(10);
  assert.equal(game.activeAccounts.has(registered.id),false);
  const persisted=await accounts.load(registered.id);
  assert.equal(persisted.profile.resources.wood,87);
  assert.equal(persisted.profile.hat,57);
  join=await (await post('/api/join',request,head)).json();
  const second=await enter(base,join.ticket);
  t.after(()=>second.ws.terminate());
  const restored=[...game.room.players.values()][0];
  assert.equal(restored.name,username);
  assert.equal(restored.resources.wood,87);
  assert.equal(restored.resources.points,300);
  assert.equal(restored.age,4);
  assert.equal(restored.hp,78);
  assert.equal(restored.hat,57);
  assert.ok(restored.inventory.items.includes(16));
  assert.ok(second.packets.some(x=>x.name==='5'&&x.args[1]===57));
  assert.equal((await post('/api/account/logout',{},head)).status,200);
  assert.equal((await post('/api/join',request,head)).status,401);
});

test('invalid legacy DID does not become an authenticated account; dead character loses survival state',async t=>{
  if(!pgURL||!redisURL)return t.skip('live PostgreSQL + Redis only');
  const {base,accounts,post,game,cleanupUsers}=await launch(t);
  const username='Player'+randomUUID().slice(0,8);
  cleanupUsers.push(username);
  const user=await accounts.register(username,'correct-account-password');
  const guestRequest={host:base+'/s/LC',captcha:true,did:user.id.replaceAll('-','')};
  const guest=await (await post('/api/join',guestRequest)).json();
  const session=await enter(base,guest.ticket,'GuestName');
  t.after(()=>session.ws.terminate());
  const p=[...game.room.players.values()][0];
  assert.equal(p.name,'GuestName');
  assert.equal(p.accountId,null);
  assert.equal((await accounts.load(user.id)).profile.version,undefined);
  // Expired/dead save restores cosmetics but cannot skip the game death reset.
  const registered=await accounts.load(user.id);
  await accounts.save(registered.id,{version:1,hp:0,age:19,xp:90,
    resources:{wood:10000,points:9999},ownedHats:[0,57],hat:57});
  const reloaded=game.room.join(null,username,(await accounts.load(user.id)).profile);
  assert.equal(reloaded.age,1);
  assert.equal(reloaded.resources.wood,0);
  assert.equal(reloaded.hat,57);
});
