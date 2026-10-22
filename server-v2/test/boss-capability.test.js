import test from 'node:test';
import assert from 'node:assert/strict';
import {GameServer} from '../src/game.js';
import {NativeSession} from '../src/native-protocol.js';

test('new client advertises W support with appended Y request',()=>{
 const session=new NativeSession({seed:99,key:Buffer.alloc(16,3),
   socketId:'0123456789abcdef'});
 assert.equal(session.incoming.forward.get('V'),17);
 assert.equal(session.incoming.forward.get('Y'),18);
 assert.equal(session.outgoing.forward.get('W'),38);
 assert.equal(session.decode(session.makeTestRequest('Y',[1])).name,'Y');
});
test('old clients never receive W packet; new clients get full warning',()=>{
 const old=[],fresh=[];
 const server={nativeClients:new Map([
   [1,{p:{id:'old'},supportsBossWarnings:false,
     send:(name,args)=>old.push([name,args])}],
   [2,{p:{id:'new'},supportsBossWarnings:true,
     send:(name,args)=>fresh.push([name,args])}]
 ])};
 GameServer.prototype._nativeEvents.call(server,[{
   kind:'boss_telegraph',effectKind:4,x:-2500,y:7200,radius:130,
   duration:1150,x2:-1800,y2:7300
 }]);
 assert.equal(old.length,0);
 assert.deepEqual(fresh,[['W',[4,-2500,7200,130,1150,-1800,7300]]]);
});
