// Tested against the actual reconstructed Node packet handler and catalog.
// Real client Lua sends these packet shapes; Node authoritatively applies
// costs, ownership and tribe membership. No fictitious game content.
import test from "node:test";
import assert from "node:assert/strict";
import {handlePacket} from "../src/network/packets.js";
import {ClanManager} from "../src/moomoo/modules/clanManager.js";

function harness(){
  const sent=[];
  const broadcasts=[];
  const player={
    id:"local",sid:7,name:"Owner",alive:true,points:2100,
    skins:{51:1},tails:{},skinIndex:0,tailIndex:0,skin:null,tail:null,
    team:null,isOwner:false,tribeCooldown:0,clanTag:null,
    joinRequests:new Set(),
    anticheat:{invalid(name,why){throw Error("Rejected "+name+": "+why)}},
    send(name,...args){sent.push({name,args})},
    addResource(index,delta){assert.equal(index,3);this.points+=delta}
  };
  const server={broadcast(name,...args){broadcasts.push({name,args})}};
  const game={key:"LC",players:[player],server};
  game.clan_manager=new ClanManager(game.players,server);
  const ctx={game,accounts:{data:{clans:{}}}};
  return {ctx,player,sent,broadcasts};
}
test("real server charges correct gold for Straw Hat, acknowledges purchase/equip/unequip",()=>{
  const {ctx,player,sent}=harness();
  handlePacket(ctx,player,"c",[1,2,0]);
  assert.equal(player.points,1600);
  assert.equal(player.skins[2],1);
  assert.deepEqual(sent.at(-1),{name:"5",args:[0,2,0]});
  handlePacket(ctx,player,"c",[0,2,0]);
  assert.equal(player.skinIndex,2);
  assert.equal(player.skin.name,"Straw Hat");
  assert.deepEqual(sent.at(-1),{name:"5",args:[1,2,0]});
  handlePacket(ctx,player,"c",[0,0,0]);
  assert.equal(player.skinIndex,0);
  assert.deepEqual(sent.at(-1),{name:"5",args:[1,0,0]});
  handlePacket(ctx,player,"c",[1,2,0]);
  assert.equal(player.points,1600,"Cannot buy a paid item twice");
});
test("real server charges and equips Tree Cape accessory",()=>{
  const {ctx,player,sent}=harness();
  handlePacket(ctx,player,"c",[1,9,1]);
  assert.equal(player.points,1100);
  assert.equal(player.tails[9],1);
  assert.deepEqual(sent.at(-1),{name:"5",args:[0,9,1]});
  handlePacket(ctx,player,"c",[0,9,1]);
  assert.equal(player.tailIndex,9);
  assert.equal(player.tail.name,"Tree Cape");
  assert.deepEqual(sent.at(-1),{name:"5",args:[1,9,1]});
});
test("tribe creation/leave matches L/N packet callbacks and server authority",()=>{
  const {ctx,player,sent,broadcasts}=harness();
  handlePacket(ctx,player,"L",["CITest"]);
  assert.equal(player.team,"CITest");
  assert.equal(player.isOwner,true);
  assert.equal(broadcasts.at(-1).name,"g");
  assert.equal(sent.find(p=>p.name==="3").args[0],"CITest");
  assert.ok(sent.some(p=>p.name==="4"),"Original owner receives tribe member list");
  player.tribeCooldown=0; // real server tick reduces the 200ms cooldown
  handlePacket(ctx,player,"N",[]);
  assert.equal(player.team,null);
  assert.equal(player.isOwner,false);
  assert.equal(broadcasts.at(-1).name,"1");
  assert.deepEqual(sent.at(-1),{name:"3",args:[null,false]});
});
