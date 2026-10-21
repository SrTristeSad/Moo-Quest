// Find the REAL protocol-build.json of the Node instance responding /ping.
// Prints only the matching absolute file path to stdout for INICIAR-WINDOWS.bat.
// Never edits a build, changes keys, or generates replacement data.
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const server=path.resolve(process.env.MOOQUEST_SERVER_DIR||path.join(root,"node-runtime"));
const candidates=[];
const found=new Set();
function add(file){
  if(!file)return;
  const absolute=path.resolve(file);
  const key=process.platform==="win32"?absolute.toLowerCase():absolute;
  if(!found.has(key)){found.add(key);candidates.push(absolute);}
}
add(process.env.MOOQUEST_BUILD_FILE);
add(process.env.PROTOCOL_BUILD_FILE);
if(process.env.DATA_DIR)add(path.join(process.env.DATA_DIR,"protocol-build.json"));
add(path.join(server,"server","data","protocol-build.json"));
add(path.join(root,"node-runtime","server","data","protocol-build.json"));
add(path.join(root,"server","data","protocol-build.json"));

try {
  const response=await fetch("http://127.0.0.1:8080/ping",
    {signal:AbortSignal.timeout(3000)});
  if(!response.ok)throw Error("Servidor nao respondeu HTTP 200 em /ping.");
  const ping=await response.json();
  if(typeof ping.build!=="string"||!/^[a-z0-9]+$/i.test(ping.build))
    throw Error("Servidor ativo nao informou um build valido em /ping.");
  const mismatch=[];
  for(const candidate of candidates){
    let data;
    try{data=JSON.parse(await fs.readFile(candidate,"utf8"));}
    catch{continue;}
    if(data.buildId===ping.build && Array.isArray(data.constants) &&
      data.constants.length===8){
      console.log(candidate);
      process.exit(0);
    }
    mismatch.push(candidate);
  }
  throw Error(
    "Nao foi encontrado o protocol-build.json do Node ativo (build "+
    ping.build+"). Pode haver OUTRA copia do servidor rodando na porta 8080. "+
    "Feche a janela do Node antigo e abra INICIAR-WINDOWS.bat novamente. "+
    "Se usar outro DATA_DIR, informe MOOQUEST_BUILD_FILE apontando para "+
    "o arquivo original gerado pelo servidor. "+
    (mismatch.length?"Outros builds encontrados em: "+mismatch.join("; "):""));
} catch(error){
  console.error("[BUILD] ERRO: "+error.message);
  process.exitCode=1;
}
