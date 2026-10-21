import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import { Storage } from '../src/storage.js';
import { Auth } from '../src/auth.js';
import { Updates } from '../src/updates.js';
import { createHTTP } from '../src/http.js';
import { GameServer } from '../src/game.js';
import { NativeSession,unpack } from '../src/native-protocol.js';

const appRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('actual current Lua binary wire: /ping + /api/join + io-init + M -> C,D,H,a and store',async t=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mq-native-live-'));
  t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
  const storage=new Storage(tmp);
  storage.data.owner={username:'Owner',password:'hash'};
  storage.save();
  const app=createHTTP({root:appRoot,storage,auth:new Auth(),updates:new Updates(tmp,storage.dir,{manifestURL:null,publicKeyFile:null})});
  const game=new GameServer(app.server,storage);app.setGame(game);
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await game.stop();await new Promise(resolve=>app.server.close(resolve));});
  game.start();
  const base='http://127.0.0.1:'+app.server.address().port;
  const ping=await (await fetch(base+'/ping')).json();
  assert.equal(ping.build,'mqv2native');
  const join=await (await fetch(base+'/api/join',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({host:base+'/s/LC',captcha:true})})).json();
  assert.match(join.ticket,/^[a-f0-9]{36}$/);
  assert.match(join.did,/^[a-f0-9]{16,64}$/);
  const ws=new WebSocket(base.replace('http:','ws:')+'/s/LC?b='+ping.build+'&token=tk:'+join.ticket);
  const packets=[];let session=null;
  ws.on('message',(buf,binary)=>{
    assert.equal(binary,true);
    if(!session){
      const frame=unpack(buf);
      assert.equal(frame[0],'io-init');assert.equal(frame[1][3],1);assert.equal(frame[1][4],0);
      session=new NativeSession({socketId:frame[1][0],seed:frame[1][1],key:Buffer.from(frame[1][2],'hex')});
      ws.send(session.makeTestRequest('M',[{name:'LuaTester',skin:2,moofoll:false,anon:false}]));
    }else{
      const record=unpack(buf);
      const name=session.outgoing.reverse.get(record[0]);
      packets.push({name,args:record[1]});
    }
  });
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
  t.after(()=>ws.terminate());
  const until=Date.now()+4000;
  while(!['A','C','D','H','a'].every(k=>packets.some(p=>p.name===k))&&Date.now()<until)await pause(20);
  assert.ok(['A','C','D','H','a'].every(k=>packets.some(p=>p.name===k)),JSON.stringify(packets.map(p=>p.name)));
  const p=[...game.room.players.values()][0];
  assert.equal(p.name,'LuaTester');assert.equal(p.native,true);
  assert.equal(packets.find(pkt=>pkt.name==='C').args[0],p.sid);
  assert.equal(packets.find(pkt=>pkt.name==='H').args[0].length%8,0);
  const seq=1; // M was the first authenticated client packet.
  ws.send(session.makeTestRequest('9',[0],seq+1));
  await pause(200);
  assert.ok(p.vx>0);
  ws.send(session.makeTestRequest('c',[0,51,0],seq+2));
  ws.send(session.makeTestRequest('0',[],seq+3));
  const until2=Date.now()+2500;
  while(!packets.some(p=>p.name==='5')||!packets.some(p=>p.name==='0')){
    if(Date.now()>until2)break;
    await pause(20);
  }
  assert.deepEqual(packets.find(pkt=>pkt.name==='5').args,[1,51,0],
    'client c(0) equips, but incoming 5(1) updates equipped hat');
  assert.ok(packets.some(pkt=>pkt.name==='0'));

  // Real legacy shop semantics intentionally invert the operation in the
  // confirmation: c(1) buys -> 5(0) unlocks; c(0) equips -> 5(1).
  p.resources.points=50;
  ws.send(session.makeTestRequest('c',[1,57,0],seq+4));
  const waitFor=async condition=>{
    const deadline=Date.now()+2500;
    while(!condition()&&Date.now()<deadline)await pause(20);
    assert.ok(condition(),JSON.stringify(packets.slice(-15).map(x=>[x.name,x.args])));
  };
  await waitFor(()=>packets.some(pkt=>pkt.name==='5'&&pkt.args[0]===0&&pkt.args[1]===57));
  assert.equal(p.resources.points,0);
  ws.send(session.makeTestRequest('c',[0,57,0],seq+5));
  await waitFor(()=>packets.some(pkt=>pkt.name==='5'&&pkt.args[0]===1&&pkt.args[1]===57));
  assert.equal(p.hat,57);

  // The client chooses a consumable, then F triggers a server-owned heal.
  p.hp=50;p.resources.food=50;
  ws.send(session.makeTestRequest('z',[0,false],seq+6));
  ws.send(session.makeTestRequest('F',[1,0],seq+7));
  await waitFor(()=>packets.some(pkt=>pkt.name==='O'&&pkt.args[0]===p.sid&&pkt.args[1]===70));
  assert.equal(p.hp,70);assert.equal(p.resources.food,40);

  // The upgrade UI sends H with a numeric weapon index; the server issues
  // V and U only after validating its authoritative progression.
  game.room.awardXp(p.id,60);
  await waitFor(()=>packets.some(pkt=>pkt.name==='U'&&pkt.args[0]===1));
  ws.send(session.makeTestRequest('H',[1],seq+8));
  await waitFor(()=>packets.some(pkt=>pkt.name==='V'&&pkt.args[1]===1&&pkt.args[0].includes(1)));
  assert.deepEqual(p.inventory.weapons,[0,1]);
  ws.close();
  await new Promise(resolve=>ws.once('close',resolve));
});
