// Smoke test for a REAL installed local Node server, not a simulated game.
// Prerequisite: PREPARAR-SERVIDOR.bat and running INICIAR-WINDOWS.bat server.
// Run: node tools/check-node-connection.mjs
// The original reconstructed Node.js Game handles spawn and movement.
import net from "node:net";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const installed=path.join(root,"node-runtime","server","package.json");
const requireFromServer=createRequire(installed);
let msgpack;
try { msgpack=requireFromServer("msgpack-lite"); }
catch (error) {
  console.error("msgpack-lite indisponivel. Rode PREPARAR-SERVIDOR.bat primeiro.");
  process.exit(2);
}
const timeoutMs=12000;
const socket=net.createConnection({port:17017,host:"127.0.0.1"});
let receive=Buffer.alloc(0);
let sid=null,initialX=null,moved=false,sawWorld=false,sawPlayer=false;
let sawServerTick=false,packetCount=0,closed=false;
const timer=setTimeout(()=>finish(false,"timeout esperando spawn e movimento do Node.js"),timeoutMs);
function send(type,args) {
  const body=msgpack.encode([type,args]);
  const head=Buffer.allocUnsafe(4);
  head.writeUInt32BE(body.length,0);
  socket.write(Buffer.concat([head,body]));
}
function finish(ok,reason) {
  if (closed) return;
  closed=true;
  clearTimeout(timer);
  socket.destroy();
  const prefix=ok?"OK":"ERRO";
  console.log("["+prefix+"] "+reason);
  console.log("Pacotes recebidos: "+packetCount+", sid="+String(sid)+", spawn="+sawPlayer+", tick="+sawServerTick);
  process.exitCode=ok?0:1;
}
socket.on("connect",()=>{
  console.log("Conectado a ponte TCP 127.0.0.1:17017");
  send("M",[{name:"MooQuestTest",skin:0,moofoll:false,anon:false}]);
});
socket.on("data",chunk=>{
  if (closed) return;
  receive=Buffer.concat([receive,chunk]);
  if(receive.length>2*1024*1024) return finish(false,"excesso de dados recebidos");
  while(receive.length>=4){
    const n=receive.readUInt32BE(0);
    if(n<1||n>1024*1024)return finish(false,"frame invalido");
    if(receive.length<n+4)break;
    const data=receive.subarray(4,4+n);
    receive=receive.subarray(4+n);
    let payload;
    try {payload=msgpack.decode(data);}
    catch(err){return finish(false,"MessagePack invalido: "+String(err));}
    if(!Array.isArray(payload)||payload[0]!=="event")return finish(false,"envelope inesperado");
    packetCount++;
    const name=payload[1],args=payload[2];
    if(name==="A") sawWorld=true;
    if(name==="C"){
      sid=args[0];
      send("9",[0]); // original movement packet, no proxy-side simulation
      send("D",[0]);
    }
    if(name==="D" && Array.isArray(args[0]) && args[0][1]===sid){
      sawPlayer=true;
      if(initialX===null) initialX=args[0][3];
    }
    if(name==="a" && Array.isArray(args[0])){
      sawServerTick=true;
      const positions=args[0];
      for(let i=0;i+3<positions.length;i+=4){
        if(positions[i]===sid && initialX!==null && positions[i+1]>initialX+1){
          moved=true;
        }
      }
    }
    if(sawWorld&&sawPlayer&&sawServerTick&&moved){
      return finish(true,"servidor original criou jogador e confirmou movimento por pacotes reais");
    }
  }
});
socket.on("error",error=>finish(false,error.message+" (execute o servidor Node.js primeiro)"));
socket.on("close",()=>{if(!closed)finish(false,"servidor encerrou a conexao antes do teste terminar");});
