// Downloads the original game server and repairs one unpublished config.js.
// No new server, no nativeBridge, and no edits to existing upstream JS files.
// The compatibility config is LOCAL ONLY and NOT the authors original settings.
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync, spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import net from "node:net";

const BASELINE="06f7c1ca965a7628671676c8d9a7efd3997bb5e7";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const DEST=path.join(ROOT,"node-runtime");
const ARCHIVE_URL="https://github.com/al007ex/moomoo-clone/archive/"+BASELINE+".zip";
const exists=async p=>fs.access(p).then(()=>true,()=>false);
const log=message=>console.log("[servidor original] "+message);

async function download(){
  if(await exists(DEST)){
    if(await exists(path.join(DEST,"server","src","network","nativeBridge.js"))){
      throw Error("Pasta node-runtime antiga contem uma ponte. Renomeie-a e tente novamente.");
    }
    const stamp=path.join(DEST,"UPSTREAM-COMMIT.txt");
    if(!(await exists(stamp))||(await fs.readFile(stamp,"utf8")).trim()!==BASELINE){
      throw Error("node-runtime existente de origem desconhecida: nao sobrescrevi seus arquivos.");
    }
    log("Reutilizando servidor ja baixado na tentativa anterior; nao precisa baixar novamente.");
    return;
  }
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),"moo-quest-source-"));
  try{
    const archive=path.join(temp,"upstream.zip");
    log("Baixando al007ex/moomoo-clone@"+BASELINE+"...");
    const response=await fetch(ARCHIVE_URL,{redirect:"follow",signal:AbortSignal.timeout(120000)});
    if(!response.ok||!response.body)throw Error("Download GitHub falhou: HTTP "+response.status);
    await pipeline(Readable.fromWeb(response.body),createWriteStream(archive));
    const unpack=path.join(temp,"contents");
    const escape=p=>p.replaceAll("'","''");
    const command="$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath '"+
      escape(archive)+"' -DestinationPath '"+escape(unpack)+"' -Force";
    const result=spawnSync("powershell.exe",
      ["-NoProfile","-ExecutionPolicy","Bypass","-Command",command],{stdio:"inherit"});
    if(result.error||result.status!==0)throw Error("PowerShell nao conseguiu extrair o ZIP.");
    const dirs=(await fs.readdir(unpack,{withFileTypes:true}))
      .filter(d=>d.isDirectory()&&d.name.startsWith("moomoo-clone-"));
    if(dirs.length!==1)throw Error("Estrutura do arquivo original inesperada.");
    const source=path.join(unpack,dirs[0].name);
    if(!(await exists(path.join(source,"server","src","index.js"))))
      throw Error("Servidor Node original nao encontrado no arquivo.");
    await fs.cp(source,DEST,{recursive:true});
    await fs.writeFile(path.join(DEST,"UPSTREAM-COMMIT.txt"),BASELINE+"\n");
    log("Codigo original copiado. Nenhum arquivo existente foi alterado.");
  }finally{
    await fs.rm(temp,{recursive:true,force:true,maxRetries:4,retryDelay:100});
  }
}

async function restoreUnpublishedConfig(){
  const target=path.join(DEST,"server","src","anticheat","config.js");
  const source=path.join(ROOT,"support","local-anticheat-config.js");
  if(!(await exists(source)))throw Error("Moo-Quest nao inclui support/local-anticheat-config.js");
  const current=await fs.readFile(source,"utf8");
  if(await exists(target)){
    // Existing author/custom files are never changed. Migrate ONLY the exact
    // previous Moo-Quest template, identified byte-for-byte and with our
    // explicit local-compatibility installation notice.
    const old=current
      .replace("// Native Lua cannot supply official browser bundle seals. Disable ONLY browser-specific\n// gates in this local config; other auth, sequence, HMAC, rate limits remain active.\n","")
      .replace("enforceBundle: false, // Native Lua has no browser JS bundle; LOCAL ONLY.","enforceBundle: true,")
      .replace("mode: 0, // No browser bundle to bind; keyed HMAC + ticket remain enabled.","mode: 2,");
    const existing=await fs.readFile(target,"utf8");
    const notice=path.join(DEST,"LOCAL-COMPATIBILITY-NOTICE.txt");
    if(existing===old && await exists(notice)){
      await fs.writeFile(target,current,{flag:"w"});
      log("Configuracao Moo-Quest anterior atualizada para cliente Lua nativo (APENAS localhost).");
      log("Ticket, origem, versao de build, HMAC e limites de pacotes continuam exigidos.");
    }else{
      log("anticheat/config.js existente/customizado: preservado sem substituicao.");
      if(existing.includes("enforceBundle: true") || /mode:\s*2[\s,]/.test(existing)){
        log("[AVISO] A configuracao existente exige bundle/seal de navegador; Lua pode ser recusado.");
        log("[AVISO] Nao sobrescrevi configuracao desconhecida. Consulte docs/CONFIG-LOCAL.md.");
      }
    }
    return;
  }
  await fs.mkdir(path.dirname(target),{recursive:true});
  // wx: create missing file only. NEVER overwrite a legitimate original file.
  const handle=await fs.open(target,"wx");
  try{await handle.writeFile(await fs.readFile(source));}
  finally{await handle.close();}
  const note=[
    "MOO-QUEST LOCAL DEVELOPMENT CONFIGURATION",
    "The original repository does NOT publish server/src/anticheat/config.js.",
    "One missing configuration file was added to the local installation.",
    "No other Node server source file was changed or replaced.",
    "These values are LOCAL COMPATIBILITY DEFAULTS, NOT original author values.",
    "DO NOT HOST THIS CONFIGURATION ON THE PUBLIC INTERNET.",
    "Baseline: "+BASELINE,
    ""
  ].join("\n");
  await fs.writeFile(path.join(DEST,"LOCAL-COMPATIBILITY-NOTICE.txt"),note);
  log("[CORRECAO] Reposto somente anticheat/config.js, ausente no repositorio original.");
  log("[AVISO] Configuracao de compatibilidade LOCAL; nao e a configuracao privada do autor.");
  log("[AVISO] NAO publique esse servidor na Internet com essa configuracao.");
}

async function validateFiles(){
  const files=[
    "server/src/index.js",
    "server/src/network/connection.js",
    "server/src/protocol/session.js",
    "server/src/anticheat/config.js"
  ];
  for(const file of files)
    if(!(await exists(path.join(DEST,file))))throw Error("Arquivo essencial ausente: "+file);
  const target=path.join(DEST,"server","src","anticheat","config.js");
  const syntax=spawnSync(process.execPath,["--check",target],{cwd:DEST,stdio:"inherit"});
  if(syntax.error||syntax.status!==0)throw Error("Config.js invalido para Node.js.");
  const mod=await import(pathToFileURL(target).href);
  const c=mod.ANTICHEAT_CONFIG;
  for(const key of ["connection","rateLimits","telemetry","transport","storage"])
    if(!c||!c[key])throw Error("ANTICHEAT_CONFIG sem "+key);
  log("Verificacao de modulos locais: OK.");
}

async function installDependencies(){
  const packageJson=path.join(DEST,"package.json");
  if(!(await exists(packageJson)))throw Error("package.json original nao encontrado");
  const installed=path.join(DEST,"node_modules","ws");
  if(await exists(installed)){
    log("Dependencias do Node ja instaladas.");
    return;
  }
  log("Instalando dependencias do servidor Node original...");
  const npm=process.platform==="win32"?"npm.cmd":"npm";
  const result=spawnSync(npm,["install","--omit=dev","--no-audit","--no-fund"],
    {cwd:DEST,stdio:"inherit",shell:process.platform==="win32"});
  if(result.error||result.status!==0)
    throw Error("npm install falhou: "+String(result.error||result.status));
}

async function smokeTest(){
  // Start the ORIGINAL Node entrypoint briefly on a separate local ephemeral port.
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),"moo-quest-smoke-"));
  const reserve=net.createServer();
  await new Promise((resolve,reject)=>{
    reserve.once("error",reject);
    reserve.listen(0,"127.0.0.1",resolve);
  });
  const port=reserve.address().port;
  await new Promise(resolve=>reserve.close(resolve));
  let logs="";
  const child=spawn(process.execPath,["server/src/index.js"],{
    cwd:DEST,
    env:{...process.env,HOST:"127.0.0.1",PORT:String(port),DATA_DIR:temp},
    stdio:["ignore","pipe","pipe"],windowsHide:true
  });
  const append=chunk=>{logs=(logs+String(chunk)).slice(-8000);};
  child.stdout.on("data",append);
  child.stderr.on("data",append);
  let success=false;
  try{
    for(let i=0;i<70;i++){
      if(child.exitCode!==null)break;
      try{
        const response=await fetch("http://127.0.0.1:"+port+"/ping",
          {signal:AbortSignal.timeout(600)});
        if(response.status===200){
          const body=await response.json();
          if(body.status==="ok"&&body.build){success=true;break;}
        }
      }catch{}
      await delay(200);
    }
    if(!success)throw Error("Servidor original nao respondeu /ping. Logs:\n"+logs);
    log("[OK] Servidor Node original INICIOU e respondeu /ping no localhost.");
  }finally{
    child.kill();
    await delay(500);
    await fs.rm(temp,{recursive:true,force:true,maxRetries:6,retryDelay:250});
  }
}

async function main(){
  if(process.platform!=="win32")
    throw Error("Este preparador foi projetado para Windows.");
  if(Number(process.versions.node.split(".")[0])<20)
    throw Error("Instale Node.js 20 ou superior.");
  await download();
  await restoreUnpublishedConfig();
  await validateFiles();
  await installDependencies();
  await smokeTest();
  log("[OK] SERVIDOR NODE ORIGINAL PREPARADO. Apenas config ausente foi reposto.");
  log("OBS: cliente Lua ainda precisa validar o protocolo para entrar na partida.");
}
main().catch(error=>{
  console.error("[servidor original] ERRO: "+String(error));
  process.exitCode=1;
});
