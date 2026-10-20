// Prepares a local Node.js server from the FIXED al007ex/moomoo-clone baseline.
// The project intentionally does not vendor or redistribute its client-official files.
// Requires Node.js 20+ and PowerShell (Windows). Internet needed ONLY on first setup.
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const BASELINE="06f7c1ca965a7628671676c8d9a7efd3997bb5e7";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const RUNTIME=path.join(ROOT,"node-runtime");
const serverIndex=path.join(RUNTIME,"server","src","index.js");
const upstreamUrl=`https://github.com/al007ex/moomoo-clone/archive/${BASELINE}.zip`;
const exists=async p=>fs.access(p).then(()=>true,()=>false);
const log=msg=>process.stdout.write("[Moo-Quest Node] "+msg+"\n");
const fail=msg=>{throw new Error(msg);};

async function downloadBaseline(){
  if (await exists(serverIndex)){
    log("Existing Node server found. Checking adapter.");
    return;
  }
  if (await exists(RUNTIME)) fail("Incomplete node-runtime directory. Remove it and rerun PREPARAR-SERVIDOR.bat.");
  const temporary=await fs.mkdtemp(path.join(os.tmpdir(),"mooquest-upstream-"));
  try {
    const archive=path.join(temporary,"upstream.zip");
    log("Downloading open-source server baseline "+BASELINE+"...");
    const response=await fetch(upstreamUrl,{redirect:"follow",signal:AbortSignal.timeout(120000)});
    if(!response.ok||!response.body)fail("GitHub archive HTTP "+response.status);
    await pipeline(Readable.fromWeb(response.body),createWriteStream(archive));
    const folder=path.join(temporary,"expanded");
    const psArg="`$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath '"+archive.replaceAll("'","''")+"' -DestinationPath '"+folder.replaceAll("'","''")+"' -Force";
    const unpack=spawnSync("powershell.exe",["-NoProfile","-ExecutionPolicy","Bypass","-Command",psArg],{stdio:"inherit",windowsHide:false});
    if(unpack.error||unpack.status!==0)fail("Cannot extract ZIP. Check PowerShell: "+String(unpack.error||unpack.status));
    const children=await fs.readdir(folder,{withFileTypes:true});
    const match=children.find(d=>d.isDirectory()&&d.name.startsWith("moomoo-clone-"));
    if(!match)fail("Unexpected upstream archive layout");
    const source=path.join(folder,match.name);
    await fs.mkdir(RUNTIME,{recursive:true});
    await fs.cp(path.join(source,"server"),path.join(RUNTIME,"server"),{recursive:true});
    await fs.cp(path.join(source,"shared"),path.join(RUNTIME,"shared"),{recursive:true});
    if(await exists(path.join(source,"LICENSE")))await fs.copyFile(path.join(source,"LICENSE"),path.join(RUNTIME,"LICENSE"));
    await fs.writeFile(path.join(RUNTIME,"UPSTREAM-COMMIT.txt"),BASELINE+"\n","utf8");
    log("Copied original reconstructed Node server and shared game configs.");
    log("Official proprietary client and artwork have NOT been copied.");
  }finally{
    await fs.rm(temporary,{recursive:true,force:true});
  }
}

async function applyNativeBridge(){
  const bridgeSource=path.join(ROOT,"node-bridge","nativeBridge.js");
  const bridgeTarget=path.join(RUNTIME,"server","src","network","nativeBridge.js");
  if(!(await exists(bridgeSource)))fail("node-bridge/nativeBridge.js missing");
  await fs.copyFile(bridgeSource,bridgeTarget);
  let source=await fs.readFile(serverIndex,"utf8");
  const importLine='import { startNativeBridge } from "./network/nativeBridge.js";';
  const importAnchor='import { createConnectionHandler } from "./network/connection.js";';
  if(!source.includes(importLine)){
    if(!source.includes(importAnchor))fail("Original index.js changed; expected import anchor missing.");
    source=source.replace(importAnchor,importAnchor+"\n"+importLine);
  }
  const startAnchor="server.listen(PORT, HOST, () => {";
  const block='// Moo-Quest Lua native bridge: standalone, loopback-only TCP for desktop clients.\n'+
    'if (process.env.MOOQUEST_NATIVE !== "0") {\n'+
    '    startNativeBridge({ games, accounts, moderation, chat, log,\n'+
    '        port: Number(process.env.MOOQUEST_NATIVE_PORT || 17017) });\n'+
    '}\n\n';
  if(!source.includes("// Moo-Quest Lua native bridge:")){
    if(!source.includes(startAnchor))fail("Original index.js changed; expected listener anchor missing.");
    source=source.replace(startAnchor,block+startAnchor);
  }
  await fs.writeFile(serverIndex,source,"utf8");
  log("Native Lua adapter installed, sharing the original Node Game instances.");
}

async function installDependencies(){
  const prefix=path.join(RUNTIME,"server");
  const modules=path.join(prefix,"node_modules");
  if(await exists(path.join(modules,"msgpack-lite")) && await exists(path.join(modules,"ws"))){
    log("Node.js dependencies already available.");
    return;
  }
  log("Installing Node server dependencies (npm install --omit=dev)...");
  const exe=process.platform==="win32"?"npm.cmd":"npm";
  const result=spawnSync(exe,["install","--omit=dev","--no-audit","--no-fund"],{cwd:prefix,stdio:"inherit",shell:process.platform==="win32"});
  if(result.error||result.status!==0)fail("npm install failed: "+String(result.error||result.status));
}

async function main(){
  if(Number(process.versions.node.split(".")[0])<20)fail("Node.js 20+ is required.");
  if(process.platform!=="win32")fail("PREPARAR-SERVIDOR.bat currently supports Windows. This is not an online deployer.");
  await downloadBaseline();
  const recorded=await fs.readFile(path.join(RUNTIME,"UPSTREAM-COMMIT.txt"),"utf8");
  if(recorded.trim()!==BASELINE)fail("Unexpected server baseline. Move aside node-runtime and retry.");
  await applyNativeBridge();
  await installDependencies();
  log("READY. Start INICIAR-WINDOWS.bat to play with the original Node server.");
}
main().catch(error=>{console.error("[Moo-Quest Node] ERROR: "+String(error.stack||error));process.exitCode=1;});
