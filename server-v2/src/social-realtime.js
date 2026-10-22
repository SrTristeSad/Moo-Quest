// Adapted from al007ex/moomoo-clone/server/src/api/social.js (Apache-2.0).
// V2 uses a 30-second, one-use Redis ticket, never a long-term account token
// in the WebSocket URL. Presence and invites are visible to friends only.
import {WebSocketServer} from 'ws';
const isUuid=v=>typeof v==='string'&&/^[0-9a-f-]{36}$/i.test(v);
export class SocialRealtime {
 constructor(service){
  this.service=service;
  this.clients=new Map();
  this.wss=new WebSocketServer({noServer:true,maxPayload:4096,perMessageDeflate:false});
 }
 accept(req,socket,head,accountId){
  this.wss.handleUpgrade(req,socket,head,ws=>{void this.connected(ws,accountId);});
 }
 send(client,code,data){
  if(client.ws.readyState===client.ws.OPEN&&client.ws.bufferedAmount<65536)
   client.ws.send(JSON.stringify({code,data}));
 }
 statusOf(userId){
  const set=this.clients.get(userId);
  if(!set?.size)return {userId,presence:'offline',gameId:null,metadata:{}};
  return {userId,presence:'online',gameId:'LC',metadata:{}};
 }
 async changed(userId){
  const status=this.statusOf(userId);
  const friends=await this.service.friendsOf(userId);
  for(const friend of friends){
   for(const client of this.clients.get(friend.id)||[])
    this.send(client,'FRIEND_STATUS_UPDATED',status);
  }
 }
 async connected(ws,accountId){
  const state={ws,userId:accountId};
  const set=this.clients.get(accountId)||new Set();
  const initial=set.size===0;
  set.add(state);this.clients.set(accountId,set);
  ws.on('message',raw=>{
   void this.receive(state,raw).catch(()=>{if(ws.readyState===ws.OPEN)ws.close(1011);});
  });
  ws.on('close',()=>{
   set.delete(state);
   if(!set.size)this.clients.delete(accountId);
   if(!set.size)void this.changed(accountId).catch(()=>{});
  });
  ws.on('error',()=>{});
  try{
   const friends=await this.service.friendsOf(accountId);
   this.send(state,'ON_CONNECT',{friends:friends.map(f=>this.statusOf(f.id))});
   if(initial)await this.changed(accountId);
  }catch{if(ws.readyState===ws.OPEN)ws.close(1011);}
 }
 async receive(client,raw){
  let message;
  try{message=JSON.parse(String(raw));}catch{return;}
  if(!message||typeof message!=='object'||Array.isArray(message))return;
  if(message.code==='UPDATE_STATUS'){
   // Keep upstream event type, but don't accept untrusted arbitrary
   // metadata or a player-invented game server name.
   await this.changed(client.userId);return;
  }
  if(message.code!=='SEND_GAME_INVITE')return;
  const data=message.data;
  if(!data||typeof data!=='object'||!isUuid(data.recipientId))return;
  const targetId=data.recipientId;
  if(targetId===client.userId||!await this.service.areFriends(client.userId,targetId))return;
  const response=await this.service.inviteId(client.userId,targetId);
  if(!response)return;
  for(const recipient of this.clients.get(targetId)||[])
   this.send(recipient,'RECEIVE_GAME_INVITE',{
    senderId:client.userId,lobbyId:'LC',gameId:'LC',metadata:{}
   });
 }
 async close(){
  for(const ws of this.wss.clients)ws.terminate();
  await new Promise(resolve=>this.wss.close(()=>resolve()));
 }
}
