// LOCAL-ONLY sprite loader for the JavaScript client reference.
// Uses assets already downloaded from al007ex/moomoo-clone; does not bundle
// copyrighted sprites in Moo-Quest Git history or publish them online.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const server=path.resolve(process.env.MOOQUEST_SERVER_DIR||path.join(project,"node-runtime"));
const source=path.join(server,"client","public","img");
const target=path.join(project,"assets","reference","img");
const expected={animals:17,weapons:81,hats:55,accessories:21,resources:4,icons:2};
const categories=Object.keys(expected);
async function main(){
  const info=await fs.stat(source).catch(()=>null);
  if(!info||!info.isDirectory())
    throw Error("Artes da referencia nao encontradas em "+source+
      ". Prepare primeiro o servidor Node original; nao vou gerar substitutos.");
  let count=0;
  for(const category of categories){
    const input=path.join(source,category);
    const st=await fs.stat(input).catch(()=>null);
    if(!st||!st.isDirectory())
      throw Error("Falta a pasta original de sprites: "+category);
    const sprites=(await fs.readdir(input,{withFileTypes:true}))
      .filter(item=>item.isFile()&&item.name.toLowerCase().endsWith(".png"));
    if(sprites.length!==expected[category])
      throw Error("Pacote original incompleto em "+category+": "+sprites.length+
        " PNGs encontrados; esperado "+expected[category]+". Nao criar substitutos.");
    await fs.mkdir(path.join(target,category),{recursive:true});
    for(const item of sprites){
      const from=path.join(input,item.name);
      const to=path.join(target,category,item.name);
      await fs.copyFile(from,to);
      count++;
    }
  }
  if(count!==180)throw Error("Pacote local de arte incompleto: "+count+" de 180 PNGs");
  console.log("[ARTE] "+count+" imagens originais copiadas para assets/reference/img (uso local).");
  console.log("[ARTE] Pasta ignorada pelo Git. Nao publicar nem redistribuir sem licenca.");
}
main().catch(err=>{console.error("[ARTE] ERRO: "+err.message);process.exitCode=1});
