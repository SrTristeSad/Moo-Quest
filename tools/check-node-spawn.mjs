// Authenticated guest SPAWN smoke test against the already-running ORIGINAL Node.
// Uses the ORIGINAL protocol crypto.js and generated build module. This script
// neither patches the game nor substitutes a server; it joins as a test guest
// and disconnects immediately after the real authoritative "C" packet.
// A passing Node smoke test does NOT establish that the Lua client works.
import fs from "node:fs/promises";
import path from "node:path";
import {createRequire} from "node:module";
import {pathToFileURL,fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const server=path.resolve(process.env.MOOQUEST_SERVER_DIR||path.join(root,"node-runtime"));
const dataDir=path.resolve(process.env.DATA_DIR||path.join(server,"server","data"));
const base="http://127.0.0.1:8080";
const fail=message=>{throw Error(message)};
const fromFile=p=>import(pathToFileURL(p).href);
async function json(url,options={}){
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(6000)});
  const body=await response.json();
  if(!response.ok)fail(url+" HTTP "+response.status+": "+JSON.stringify(body));
  return body;
}
async function main(){
  const requireServer=createRequire(path.join(server,"server","src","index.js"));
  const {WebSocket}=requireServer("ws");
  const msgpack=requireServer("msgpack-lite");
  const crypto=await fromFile(path.join(server,"server","src","protocol","crypto.js"));
  const ping=await json(base+"/ping");
  const params=JSON.parse(await fs.readFile(
    process.env.PROTOCOL_BUILD_FILE||path.join(dataDir,"protocol-build.json"),"utf8"));
  if(params.buildId!==ping.build)fail("Node is running a different build from protocol-build.json");
  const moduleFile=path.join(server,"dist","protocol",params.modulePath+".mjs");
  const build=await fromFile(moduleFile);
  if(build.BUILD_ID!==ping.build)fail("Generated protocol module is out of sync with /ping");
  const grant=await json(base+"/api/join",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({host:base+"/s/LC",captcha:true})
  });
  if(!/^[a-f0-9]{36}$/.test(grant.ticket||""))fail("API did not issue a 36-hex ticket");
  const address="ws://127.0.0.1:8080/s/LC?b="+
    encodeURIComponent(ping.build)+"&token=tk:"+encodeURIComponent(grant.ticket);
  const expectGatheredResources=process.env.MOOQUEST_EXPECT_ZERO_RESOURCES==="1";
  await new Promise((resolve,reject)=>{
    const ws=new WebSocket(address,{origin:base});
    let settled=false,session=null,count=0,spawnConfirmed=false,gotSelfD=false;
    const initialResources={};
    const timeout=setTimeout(()=>finish(Error("Timed out waiting for real C (spawn) packet")),10000);
    function finish(error){
      if(settled)return;
      settled=true;
      clearTimeout(timeout);
      if(ws.readyState===WebSocket.OPEN)ws.close(1000);
      else if(ws.readyState===WebSocket.CONNECTING)ws.terminate();
      error?reject(error):resolve();
    }
    ws.on("message",(incoming,isBinary)=>{
      if(settled)return;
      try{
        if(!isBinary)fail("Received non-binary game packet");
        if(!session){
          const frame=msgpack.decode(incoming);
          if(!Array.isArray(frame)||frame[0]!=="io-init")fail("First frame is not io-init");
          const [id,seed,rawHex,mode,pinned,sealMode]=frame[1]||[];
          if(mode!==1||!pinned||sealMode!==0)
            fail("Native compatibility expected pinned mode=1 and sealMode=0; got "+mode+"/"+sealMode);
          const key=build.mixKey(crypto.hexToBytes(rawHex),seed);
          const tables=crypto.buildTables(seed,build.BUILD_SALT);
          const masks=crypto.deriveMaskSeeds(key);
          session={key,tables,masks,id};
          const spawn={
            name:"MooQuest Test",moofoll:false,skin:0,anon:false
          };
          const body=msgpack.encode([tables.c2s.enc.M,[spawn],1]);
          const tag=crypto.hmacTag(key,body);
          const masked=Uint8Array.from(body);
          crypto.xorMask(masked,crypto.c2sMaskSeed(masks.c2s,tag));
          ws.send(Buffer.concat([Buffer.from(tag),Buffer.from(masked)]));
          console.log("PASS: real ticket and io-init accepted; authenticated M sent");
          return;
        }
        count++;
        const data=Uint8Array.from(incoming);
        crypto.xorMask(data,crypto.s2cMaskSeed(session.masks.s2c,count));
        const decoded=msgpack.decode(Buffer.from(data));
        const name=session.tables.s2c.dec[decoded[0]];
        if(name==="B")fail("Node rejected game session: "+String(decoded[1]?.[0]));
        if(name==="N" && expectGatheredResources){
          const [type,total]=decoded[1]||[];
          if(["wood","food","stone","points"].includes(type)){
            if(total!==0)fail("Expected ZERO gathered "+type+" at spawn, server returned "+total);
            initialResources[type]=total;
          }
        }
        if(name==="C"){
          const sid=decoded[1]?.[0];
          if(!Number.isInteger(sid)||sid<0)fail("Malformed authoritative spawn C");
          spawnConfirmed=true;
          console.log("PASS: original Node confirmed authenticated gameplay spawn C (sid="+sid+")");
          if(!expectGatheredResources)finish();
        }
        if(name==="D" && Array.isArray(decoded[1]?.[0])){
          gotSelfD=true;
        }
        // In standard (non-sandbox) mode Node deliberately does NOT emit
        // an initial N packet: resources start at zero on the server, and
        // N is sent only after gathering. Requiring four N zeros would
        // incorrectly fail an authentic no-sandbox session.
        if(expectGatheredResources && spawnConfirmed && gotSelfD){
          console.log("PASS: real Node sent C/D in standard economy; no nonzero initial N reported");
          finish();
        }
      }catch(e){finish(e)}
    });
    ws.on("error",finish);
    ws.on("close",code=>{
      if(!settled)finish(Error("WebSocket closed before spawn C: "+code));
    });
  });
  console.log("NOTE: Node spawn verified. Lua client runtime and visual parity remain separately unverified.");
}
main().catch(e=>{console.error("FAIL: "+e.message);process.exitCode=1});
