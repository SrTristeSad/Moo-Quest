// Real network smoke test: /ping -> /api/join -> WebSocket io-init.
// It never bypasses authentication, starts a fake server, or claims gameplay.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const serverRoot=path.resolve(process.env.MOOQUEST_SERVER_DIR||path.join(root,"node-runtime"));
const base="http://127.0.0.1:8080";
const fail=reason=>{throw new Error(reason)};
const req=async (url,options={})=>{
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(6000)});
  const raw=await response.text();
  let data;
  try{data=JSON.parse(raw)}catch{fail("JSON invalid from "+url)}
  if(!response.ok)fail(url+" returned HTTP "+response.status+": "+JSON.stringify(data));
  return data;
};
async function main(){
  const requireServer=createRequire(path.join(serverRoot,"server","src","index.js"));
  const {WebSocket}=requireServer("ws");
  const ping=await req(base+"/ping");
  if(!/^[a-z0-9]+$/.test(ping.build||""))fail("server /ping returned no build");
  const grant=await req(base+"/api/join",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({host:base+"/s/LC",captcha:true})
  });
  if(!/^[a-f0-9]{36}$/.test(grant.ticket||""))fail("join did not issue a valid ticket");
  if(!/^[a-f0-9]{16,64}$/.test(grant.did||""))fail("join did not issue a device ID");
  const address="ws://127.0.0.1:8080/s/LC?b="+
    encodeURIComponent(ping.build)+"&token=tk:"+encodeURIComponent(grant.ticket);
  await new Promise((resolve,reject)=>{
    const ws=new WebSocket(address,{origin:base});
    let settled=false;
    const timer=setTimeout(()=>finish(new Error("No io-init in 8 seconds")),8000);
    function finish(error){
      if(settled)return;
      settled=true;clearTimeout(timer);
      if(ws.readyState===WebSocket.OPEN)ws.close(1000);
      else if(ws.readyState===WebSocket.CONNECTING)ws.terminate();
      error?reject(error):resolve();
    }
    ws.once("message",(data,isBinary)=>{
      if(!isBinary||!data||!data.length)return finish(new Error("First server frame is not binary io-init"));
      console.log("PASS: join ticket accepted, WebSocket connected, io-init received ("+data.length+" bytes)");
      finish();
    });
    ws.once("close",code=>finish(new Error("WebSocket closed before io-init: "+code)));
    ws.once("error",err=>finish(err));
  });
  console.log("NOTE: This does not prove Lua encryption or spawn. It only tests the same entry gate.");
}
main().catch(error=>{console.error("FAIL: "+error.message);process.exitCode=1});
