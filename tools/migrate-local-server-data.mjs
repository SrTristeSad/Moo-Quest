// One-time LOCAL data migration only. Never commit, upload, overwrite or
// transmit accounts, server keys, bans or protocol build information.
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const legacy=path.join(root,"node-runtime","server","data");
const own=path.join(root,"server","data");
const exists=async p=>fs.stat(p).then(s=>s.isDirectory(),()=>false);
try {
  if(await exists(own)){
    console.log("[DADOS] servidor proprio ja possui estado. Nenhum arquivo pessoal foi alterado.");
  }else if(await exists(legacy)){
    await fs.mkdir(path.dirname(own),{recursive:true});
    await fs.cp(legacy,own,{recursive:true,force:false,errorOnExist:true});
    console.log("[DADOS] contas e build migrados LOCALMENTE de node-runtime/server/data para server/data.");
    console.log("[DADOS] copia original preservada; nenhum arquivo pessoal foi publicado.");
  }else{
    console.log("[DADOS] nao existem dados antigos; o Node criara estado local novo.");
  }
}catch(err){
  console.error("[DADOS] ERRO: "+err.message);
  process.exitCode=1;
}
