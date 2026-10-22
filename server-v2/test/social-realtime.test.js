import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {WebSocket} from 'ws';
import {GameServer} from '../src/game.js';
import {SocialService} from '../src/social.js';

const A='00000000-0000-4000-8000-000000000001';
const B='00000000-0000-4000-8000-000000000002';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('social tickets are one-time and hashed in Redis, never account bearer tokens',async()=>{
 const stored=new Map();
 const redis={
  async set(key,val){stored.set(key,val);},
  async getDel(key){const v=stored.get(key);stored.delete(key);return v||null;}
 };
 const pool={async query(sql,args){
  if(sql.startsWith('SELECT id,username'))return {rows:[{id:args[0],username:'a'}]};
  return {rows:[],rowCount:0};
 }};
 const service=new SocialService(pool,{redis});
 const {ticket,expiresIn}=await service.issueSocketTicket(A);
 assert.match(ticket,/^[0-9a-f]{48}$/);
 assert.equal(expiresIn,30);
 assert.ok(![...stored.keys()][0].includes(ticket));
 assert.equal(await service.consumeSocketTicket(ticket),A);
 assert.equal(await service.consumeSocketTicket(ticket),null);
 assert.equal(await service.consumeSocketTicket('garbage'),null);
});

test('live social websocket sends upstream presence and invitations only to friends',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mq-social-ws-'));
 const seenInvites=[];
 const tickets=new Map([['one',A],['two',B],['fake',null]]);
 const social={
  consumeSocketTicket:async token=>{const id=tickets.get(token);tickets.delete(token);return id;},
  friendsOf:async id=>[{id:id===A?B:A,username:'friend'}],
  areFriends:async (a,b)=>[a,b].sort().join('')===[A,B].sort().join(''),
  inviteId:async (from,to)=>{seenInvites.push({from,to});return {id:'invite'};}
 };
 const storage={dir,data:{bans:{},settings:{maintenance:false,maxPlayers:60,allowGuests:true}}};
 const server=http.createServer((req,res)=>{res.statusCode=404;res.end();});
 const game=new GameServer(server,storage,null,{social});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{
  await game.stop();
  await new Promise(resolve=>server.close(resolve));
  fs.rmSync(dir,{recursive:true,force:true});
 });
 const base='ws://127.0.0.1:'+server.address().port+'/api/social/ws?t=';
 async function open(token){
  const ws=new WebSocket(base+token);
  const messages=[];
  ws.on('message',raw=>messages.push(JSON.parse(String(raw))));
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
  return {ws,messages};
 }
 const alice=await open('one');
 const bob=await open('two');
 const until=async(fn)=>{
  const end=Date.now()+2500;
  while(!fn()&&Date.now()<end)await delay(20);
  assert.ok(fn(),'social event not received');
 };
 await until(()=>alice.messages.some(x=>x.code==='FRIEND_STATUS_UPDATED'&&
   x.data.userId===B&&x.data.presence==='online'));
 await until(()=>bob.messages.some(x=>x.code==='ON_CONNECT'));
 assert.equal(bob.messages.find(x=>x.code==='ON_CONNECT').data.friends[0].presence,'online');
 alice.ws.send(JSON.stringify({code:'SEND_GAME_INVITE',data:{recipientId:B,lobbyId:'LC'}}));
 await until(()=>bob.messages.some(x=>x.code==='RECEIVE_GAME_INVITE'));
 assert.deepEqual(seenInvites,[{from:A,to:B}]);
 game.disconnectAccount(A);
 await new Promise(resolve=>alice.ws.once('close',resolve));
 assert.equal(game.socialHub.clients.has(A),false);
 bob.ws.close();
 await new Promise(resolve=>bob.ws.once('close',resolve));
 const rejected=new WebSocket(base+'one');
 const failure=await new Promise(resolve=>{
  rejected.once('error',()=>resolve('rejected'));
  rejected.once('open',()=>resolve('accepted'));
 });
 assert.equal(failure,'rejected','one-use ticket replay cannot connect');
});
