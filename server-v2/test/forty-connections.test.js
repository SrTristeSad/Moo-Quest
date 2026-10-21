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
import {NativeSession,unpack} from '../src/native-protocol.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('40 concurrent native clients: verified ingress path, cap, real movement and clean disconnect',async t=>{
  const previous=process.env.MOO_TRUST_PROXY;
  process.env.MOO_TRUST_PROXY='1'; // local test reverse proxy with 40 distinct IPs
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mq-40-ws-'));
  const clients=[];
  const storage=new Storage(dir);
  storage.data.owner={username:'admin',password:'hash'};
  storage.data.settings.maxPlayers=40;
  // This test simulates a verified admission gateway; it must not rely
  // on insecure development captcha:true from remote reverse-proxy IPs.
  const guestVerifier={publicMode:true,verify:async()=>true};
  const app=createHTTP({root,storage,auth:new Auth(),guestVerifier,
    updates:new Updates(dir,storage.dir,{
    manifestURL:null,publicKeyFile:null})});
  const game=new GameServer(app.server,storage);
  app.setGame(game);
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  game.start();
  t.after(async()=>{
    await game.stop();
    await new Promise(resolve=>app.server.close(resolve));
    fs.rmSync(dir,{recursive:true,force:true});
    if(previous===undefined)delete process.env.MOO_TRUST_PROXY;
    else process.env.MOO_TRUST_PROXY=previous;
  });
  const base='http://127.0.0.1:'+app.server.address().port;
  const headers=index=>({'content-type':'application/json',
    'x-real-ip':'203.0.113.'+(index+1)});
  const join=async index=>{
    const response=await fetch(base+'/api/join',{
      method:'POST',headers:headers(index),
      body:JSON.stringify({host:base+'/s/LC',captcha:true})});
    assert.equal(response.status,200,'join #'+index);
    return (await response.json()).ticket;
  };
  const tickets=await Promise.all(Array.from({length:40},(_,i)=>join(i)));
  assert.equal(new Set(tickets).size,40,'issued single-use tickets are unique');

  const ready=Array.from({length:40},()=>false);
  const connected=await Promise.all(tickets.map(async(token,index)=>{
    const ws=new WebSocket(base.replace('http:','ws:')+
      '/s/LC?b=mqv2native&token=tk:'+token,{
      headers:{'x-real-ip':'203.0.113.'+(index+1)}
    });
    clients.push(ws);
    let session=null;
    ws.on('error',()=>{});
    ws.on('message',(buffer,binary)=>{
      assert.equal(binary,true);
      const packet=unpack(buffer);
      if(!session){
        assert.equal(packet[0],'io-init');
        session=new NativeSession({socketId:packet[1][0],seed:packet[1][1],
          key:Buffer.from(packet[1][2],'hex')});
        ws.send(session.makeTestRequest('M',[{name:'Player_'+index,skin:2}],1));
      }else if(session.outgoing.reverse.get(packet[0])==='C'){
        ready[index]=true;
      }
    });
    await new Promise((resolve,reject)=>{
      ws.once('open',resolve);ws.once('error',reject);
    });
    return ws;
  }));
  assert.equal(connected.length,40);
  const deadline=Date.now()+10_000;
  while(ready.some(yes=>!yes)&&Date.now()<deadline)
    await new Promise(resolve=>setTimeout(resolve,25));
  assert.equal(ready.filter(Boolean).length,40,'all native clients completed spawn');
  assert.equal(game.room.players.size,40,'capacity under parallel login');
  assert.equal((await fetch(base+'/api/status')).status,200);
  const busy=await fetch(base+'/api/join',{method:'POST',headers:headers(45),
    body:JSON.stringify({host:base+'/s/LC',captcha:true})});
  assert.equal(busy.status,429,'full server rejects ticket before WebSocket handshake');
  const ids=new Set([...game.room.players.values()].map(p=>p.sid));
  assert.equal(ids.size,40,'unique session numeric IDs');
  for(const ws of clients)ws.close();
  const until=Date.now()+5000;
  while(game.room.players.size&&Date.now()<until)
    await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(game.room.players.size,0,'all players fully disconnected');
});
