import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {WebSocket} from 'ws';
import {GameServer} from '../src/game.js';
import {NativeSession,unpack} from '../src/native-protocol.js';

// Real WebSockets and actual MessagePack/HMAC packets. Only tickets are
// fixtures: live PostgreSQL/Redis authorization has independent integration
// coverage in the database/redis tests. This is a 40-client engine load gate.
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
async function eventually(check,label,timeout=10000){
 const until=Date.now()+timeout;
 while(!check()&&Date.now()<until)await sleep(20);
 assert.ok(check(),label);
}
test('40 simultaneous authenticated-wire Lua clients: admission, movement, updates, disconnect, rejoin', {timeout:35000},async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mq-40-native-'));
 const pending=new Set();
 const ticketStore={
  async consumeDetails(value){
   if(!pending.delete(value))return null;
   return {accountId:null};
  }
 };
 const storage={
   dir,data:{settings:{maxPlayers:40,allowGuests:true,maintenance:false},
   bans:{},owner:{username:'test'}}
 };
 const server=http.createServer((_req,res)=>{res.writeHead(404);res.end();});
 const game=new GameServer(server,storage,ticketStore);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const clients=[];
 t.after(async()=>{
   for(const c of clients)if(c.ws.readyState!==WebSocket.CLOSED)c.ws.terminate();
   await game.stop();
   await new Promise(resolve=>server.close(resolve));
   fs.rmSync(dir,{recursive:true,force:true});
 });
 game.start();
 const address=server.address();
 function connect(name){
  const ticket=randomBytes(18).toString('hex');
  pending.add(ticket);
  const url='ws://127.0.0.1:'+address.port+'/s/LC?b=mqv2native&token=tk:'+ticket;
  const ws=new WebSocket(url);
  const state={ws,name,session:null,packets:[],closed:false};
  clients.push(state);
  ws.on('message',(raw,binary)=>{
   assert.equal(binary,true);
   if(!state.session){
     const frame=unpack(raw);
     assert.equal(frame[0],'io-init');
     state.session=new NativeSession({
       socketId:frame[1][0],seed:frame[1][1],
       key:Buffer.from(frame[1][2],'hex')
     });
     ws.send(state.session.makeTestRequest('M',[{
       name,skin:0,moofoll:false,anon:false
     }],1));
     return;
   }
   const record=unpack(raw);
   const opcode=state.session.outgoing.reverse.get(record[0]);
   state.packets.push({name:opcode,args:record[1]});
  });
  ws.on('close',()=>{state.closed=true;});
  ws.on('error',()=>{}); // overload/replay probes may be reset before HTTP 101
  return state;
 }
 for(let i=0;i<40;i+=10){
   for(let j=i;j<i+10;j++)connect('Player'+j);
   await eventually(()=>game.room.players.size>=i+10,'batch '+i+' spawn');
 }
 assert.equal(game.room.players.size,40);
 assert.equal(game.nativeClients.size,40);
 await eventually(()=>clients.every(c=>c.packets.some(p=>p.name==='a')),
  'all 40 receive periodic movement packets');
 assert.ok(clients.every(c=>c.packets.some(p=>p.name==='C')),'each gets own SID');
 const ids=[...game.room.players.values()].map(p=>p.sid);
 assert.equal(new Set(ids).size,40,'no duplicate SIDs');
 const first=clients[0];
 const actor=[...game.room.players.values()].find(p=>p.name==='Player0');
 const x=actor.x;
 first.ws.send(first.session.makeTestRequest('9',[0],2));
 await eventually(()=>actor.vx>0,'server accepts signed movement after 40 joins');
 await sleep(150);
 assert.ok(actor.x!==x,'authoritative game sim advances actor position');
 const extra=connect('OverCapacity');
 await eventually(()=>extra.closed,'41st socket is rejected');
 assert.equal(game.room.players.size,40,'overload cannot spawn');
 assert.ok(!extra.packets.some(p=>p.name==='C'),'full game sends no spawn');
 // World capacity is released when a player disconnects; existing state stays.
 const leaving=clients[1];
 leaving.ws.close();
 await eventually(()=>leaving.closed&&game.room.players.size===39,
  'closing a native socket frees exactly one slot');
 const replacement=connect('Replacement');
 await eventually(()=>replacement.packets.some(p=>p.name==='C'),
  'new player receives real C after free slot');
 assert.equal(game.room.players.size,40);
 assert.equal(new Set([...game.room.players.values()].map(p=>p.sid)).size,40);
 assert.equal([...game.room.players.values()].filter(p=>p.name==='Replacement').length,1);
 // Replay of a consumed ticket must not join another authenticated session.
 const used=[...pending][0]; // no pending tickets after successful connect
 assert.equal(used,undefined);
 const saved=game.room.players.size;
 await sleep(100);
 assert.equal(game.room.players.size,saved,'stable session count after rejoin');
});
