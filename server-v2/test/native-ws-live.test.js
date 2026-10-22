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

  // Exercise the actual Lua-compatible projectile stream over binary WS.
  // Age and stage are injected by the fixture; the rules for reaching them
  // and the lack of a free unlock are independently tested in projectiles.
  p.age=6;p.upgradePoints=1;p.upgradeAge=6;p.resources.wood=20;
  ws.send(session.makeTestRequest('H',[9],seq+9));
  await waitFor(()=>packets.some(pkt=>pkt.name==='V'&&pkt.args[1]===1&&pkt.args[0].includes(9)));
  assert.ok(p.inventory.weapons.includes(9));
  ws.send(session.makeTestRequest('z',[9,true],seq+10));
  ws.send(session.makeTestRequest('D',[0],seq+11));
  // The earlier food action has its own cooldown and must finish first.
  await pause(650);
  ws.send(session.makeTestRequest('F',[1,0],seq+12));
  await waitFor(()=>packets.some(pkt=>pkt.name==='X'&&pkt.args[5]===0));
  const projectile=packets.find(pkt=>pkt.name==='X'&&pkt.args[5]===0);
  assert.equal(projectile.args.length,8);
  assert.equal(projectile.args[4],1.6);
  await waitFor(()=>packets.some(pkt=>pkt.name==='N'&&pkt.args[0]==='wood'&&pkt.args[1]===16));
  await waitFor(()=>packets.filter(pkt=>pkt.name==='X'&&pkt.args[5]===0).length>=2);
  assert.equal(p.resources.wood,12,'holding F fires again only after server cooldown');
  ws.send(session.makeTestRequest('F',[0,null],seq+13));
  const shotCount=packets.filter(pkt=>pkt.name==='X'&&pkt.args[5]===0).length;
  await pause(800);
  assert.equal(packets.filter(pkt=>pkt.name==='X'&&pkt.args[5]===0).length,shotCount,
    'releasing F stops server-controlled auto-fire');
  await waitFor(()=>packets.some(pkt=>pkt.name==='Y'&&pkt.args[0]===projectile.args[7]&&pkt.args[1]===0));

  // A server-owned defensive emplacement must produce the already supported
  // Lua M (turret turn), X (projectile), Y (impact/expiry) binary messages.
  // Deliberately stage the world fixture here; building permissions/costs
  // are separately validated in defenses.test.js.
  const towerSid=918273;
  const tower={sid:towerSid,id:17,x:2700,y:2200,scale:43,owner:p.sid,
    hp:800,maxHp:800,nextFire:0};
  game.room.animals.clear();
  game.room.structures.set(towerSid,tower);
  game.room.animals.set(918274,{sid:918274,index:2,x:2960,y:2200,homeX:2960,
    homeY:2200,dir:0,health:200,maxHealth:200,speed:0,damage:12,
    nextAttack:0,deadUntil:0,nameIndex:0,state:0});
  await waitFor(()=>packets.some(pkt=>pkt.name==='M'&&pkt.args[0]===towerSid));
  await waitFor(()=>packets.some(pkt=>pkt.name==='X'&&pkt.args[5]===1&&pkt.args[6]===1));
  const turretX=packets.find(pkt=>pkt.name==='X'&&pkt.args[5]===1&&pkt.args[6]===1);
  assert.equal(turretX.args[4],1.7);
  await waitFor(()=>packets.some(pkt=>pkt.name==='Y'&&pkt.args[0]===turretX.args[7]));
  assert.ok(game.room.animals.get(918274).health<200,
    'turret bullet must actually damage a live hostile animal on the server');
  // PRE-V2 native client's profile key P requests V(sid), expecting
  // a JSON-string p packet and thirteen-element flat F stats.
  ws.send(session.makeTestRequest('V',[p.sid],seq+14));
  await waitFor(()=>packets.some(pkt=>pkt.name==='p'&&pkt.args[0]===p.sid));
  await waitFor(()=>packets.some(pkt=>pkt.name==='F'&&pkt.args.length===13
    &&pkt.args[0]===p.sid&&pkt.args[9]===0));
  const publicProfile=JSON.parse(packets.find(pkt=>pkt.name==='p').args[1]);
  assert.equal(publicProfile.name,'LuaTester');
  assert.equal(publicProfile.guest,true);
  assert.equal(publicProfile.token,undefined);
  assert.equal(publicProfile.accountId,undefined);
  const life=packets.find(pkt=>pkt.name==='F'&&pkt.args.length===13).args;
  assert.ok(life[8]>=20,"local client's heal must appear on stats");
  // Key X sends K(0): freeze aim updates until it is toggled again.
  ws.send(session.makeTestRequest('K',[0],seq+15));
  const beforeAim=p.angle;
  ws.send(session.makeTestRequest('D',[1.2],seq+16));
  await pause(80);
  assert.equal(p.angle,beforeAim);
  ws.send(session.makeTestRequest('K',[0],seq+17));
  ws.send(session.makeTestRequest('D',[1.2],seq+18));
  await pause(80);
  assert.equal(p.angle,1.2);
  // Key E uses K(1) to toggle server-owned auto attack.
  ws.send(session.makeTestRequest('K',[1],seq+19));
  await pause(80);
  assert.equal([...game.nativeClients.values()][0].autoAttack,true);
  ws.send(session.makeTestRequest('K',[1],seq+20));
  await pause(80);
  assert.equal([...game.nativeClients.values()][0].autoAttack,false);
  ws.send(session.makeTestRequest('V',[-1],seq+21));
  await pause(50);
  assert.equal([...game.nativeClients.values()][0].watchSid,null);
  ws.close();
  await new Promise(resolve=>ws.once('close',resolve));
});
