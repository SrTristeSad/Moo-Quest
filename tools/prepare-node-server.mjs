// Downloads the EXACT upstream moomoo-clone commit without patching its server.
// No nativeBridge.js, custom ports, removed game checks, or replacement game logic.
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
const DEST=path.join(ROOT,"node-runtime");
const ARCHIVE_URL="https://github.com/al007ex/moomoo-clone/archive/"+BASELINE+".zip";
const exists=async p=>fs.access(p).then(()=>true,()=>false);
const log=(msg)=>process.stdout.write("[servidor original] "+msg+"\n");

async function download(){
  if(await exists(DEST)){
    if(await exists(path.join(DEST,"server","src","network","nativeBridge.js"))){
      throw Error("Pasta node-runtime antiga contem uma ponte que modificava o servidor. " +
        "Renomeie ou remova node-runtime e execute a preparacao novamente. Nada foi alterado.");
    }
    const stamped=path.join(DEST,"UPSTREAM-COMMIT.txt");
    if(!(await exists(stamped)) || (await fs.readFile(stamped,"utf8")).trim()!==BASELINE){
      throw Error("node-runtime existente sem a identificacao exata do commit-base. " +
        "Renomeie essa pasta antes de preparar; seus dados serao preservados.");
    }
    log("Servidor original ja baixado e identificado; nenhuma alteracao nos arquivos de codigo.");
    return;
  }
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),"moo-quest-source-"));
  try{
    const archive=path.join(temp,"upstream.zip");
    log("Baixando al007ex/moomoo-clone@"+BASELINE+"...");
    const res=await fetch(ARCHIVE_URL,{redirect:"follow",signal:AbortSignal.timeout(120000)});
    if(!res.ok || !res.body)throw Error("Falha ao baixar GitHub: HTTP "+res.status);
    await pipeline(Readable.fromWeb(res.body),createWriteStream(archive));
    const unpack=path.join(temp,"contents");
    const escape=p=>p.replaceAll("'","''");
    const ps="$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath '"+escape(archive)+
      "' -DestinationPath '"+escape(unpack)+"' -Force";
    const result=spawnSync("powershell.exe",["-NoProfile","-ExecutionPolicy","Bypass","-Command",ps],
      {stdio:"inherit"});
    if(result.error || result.status!==0)throw Error("PowerShell nao conseguiu extrair o ZIP.");
    const dirs=(await fs.readdir(unpack,{withFileTypes:true}))
      .filter(e=>e.isDirectory()&&e.name.startsWith("moomoo-clone-"));
    if(dirs.length!==1)throw Error("Estrutura de arquivo do upstream inesperada.");
    const source=path.join(unpack,dirs[0].name);
    if(!(await exists(path.join(source,"server","src","index.js"))))
      throw Error("O servidor original nao foi encontrado no ZIP.");
    // Copy all original source files, not a selection and not a forked bridge.
    await fs.cp(source,DEST,{recursive:true});
    await fs.writeFile(path.join(DEST,"UPSTREAM-COMMIT.txt"),BASELINE+"\n","utf8");
    log("Repositório original copiado sem modificar scripts JavaScript.");
  }finally{
    await fs.rm(temp,{recursive:true,force:true});
  }
}

async function install(){
  // npm runs in the original repo root because it uses npm workspaces.
  const installed=path.join(DEST,"node_modules","ws");
  if(await exists(installed)){
    log("Dependencias aparentam estar instaladas.");
    return;
  }
  log("Instalando dependencias do repositorio original (sem build de assets)...");
  const cmd=process.platform==="win32"?"npm.cmd":"npm";
  const r=spawnSync(cmd,["install","--omit=dev","--no-audit","--no-fund"],
    {cwd:DEST,stdio:"inherit",shell:process.platform==="win32"});
  if(r.error||r.status!==0)throw Error("npm install falhou: "+String(r.error||r.status));
}
async function checkUpstream(){
  const missing=[];
  const modules=[
    "server/src/index.js",
    "server/src/network/connection.js",
    "server/src/protocol/session.js",
    "server/src/anticheat/config.js"
  ];
  for(const p of modules)if(!(await exists(path.join(DEST,p))))missing.push(p);
  if(missing.length){
    log("ATENCAO: o commit fixado do proprio upstream nao contem:");
    for(const p of missing)log("  "+p);
    log("O codigo original importa esses arquivos; nao vou inventar nem substituir suas regras.");
    log("Precisamos de um commit original que contenha os arquivos ausentes.");
    // Keep the exact original snapshot so the missing-file issue is inspectable.
    return false;
  }
  log("Preflight de arquivos da referencia: OK.");
  return true;
}
async function main(){
  if(process.platform!=="win32")throw Error("Esta preparacao foi projetada para Windows.");
  if(Number(process.versions.node.split(".")[0])<20)throw Error("Instale Node.js 20+.");
  await download();
  const valid=await checkUpstream();
  if(!valid)throw Error("Servidor de referencia incompleto. Consulte a mensagem acima.");
  await install();
  log("Servidor original preparado, sem mudar seu codigo-fonte.");
}
main().catch(err=>{console.error("[servidor original] ERRO: "+String(err));process.exitCode=1;});
