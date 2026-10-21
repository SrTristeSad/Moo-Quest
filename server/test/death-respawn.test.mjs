import test from "node:test";
import assert from "node:assert/strict";
import {Player} from "../src/moomoo/modules/player.js";
import {handlePacket} from "../src/network/packets.js";

test("real Node Player.kill sends P and existing WebSocket M respawns with C",()=>{
  const packets=[];
  const server={send(socket,name,...args){packets.push({socket,name,args})}};
  const player=new Player(
    "native-test",42,{}, {},{}, {},[],[],{},[],[],server,()=>{},()=>{});
  player.alive=true;
  player.points=55;
  player.age=3;
  player.kill(null,null,false);
  assert.equal(player.alive,false);
  assert.deepEqual(packets.at(-1),{socket:"native-test",name:"P",args:[]},
    "The death screen must be triggered only by authoritative Node P");
  // The actual network handler permits a new M on the SAME connection
  // after death. Avoid introducing separate/offline respawn rules.
  player.attrCache=new Map();
  player.anticheat={
    invalid(_name,reason){throw Error(reason)},
    onGameStart(){this.started=true}
  };
  player.setUserData=data=>{player.name=data.name};
  let spawned=0;
  player.spawn=()=>{spawned++;player.alive=true};
  player.send=(name,...args)=>packets.push({socket:"native-test",name,args});
  handlePacket({game:{key:"LC"}},player,"M",
    [{name:"Lua",skin:2,moofoll:false,anon:false}]);
  assert.equal(spawned,1);
  assert.equal(player.alive,true);
  assert.equal(player.anticheat.started,true);
  assert.deepEqual(packets.at(-1),{socket:"native-test",name:"C",args:[42]});
  handlePacket({game:{key:"LC"}},player,"M",
    [{name:"Lua",skin:2,moofoll:false,anon:false}]);
  assert.equal(spawned,1,"Node refuses an extra M when player is still alive");
});
