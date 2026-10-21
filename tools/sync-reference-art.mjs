// LOCAL-ONLY artwork sync. NEVER replace a valid user image with broken
// upstream data. Never invent missing copyrighted sprites.
// Priority: user-supplied assets/custom/img -> valid existing reference ->
// valid upstream image. Invalid source files are reported explicitly.
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {verifyPNG} from "./inspect-reference-png.mjs";

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const server=path.resolve(process.env.MOOQUEST_SERVER_DIR||path.join(project,"node-runtime"));
const source=path.join(server,"client","public","img");
const target=path.join(project,"assets","reference","img");
const userArt=path.join(project,"assets","custom","img");
const expected={animals:17,weapons:81,hats:55,accessories:21,resources:4,icons:2};
const required=["weapons/hammer_1.png"];
const pending=[],count={valid:0,imported:0,reused:0,user:0};

async function validPNG(location){
  try{verifyPNG(await fs.readFile(location));return true;}
  catch{return false;}
}
async function put(from,to){
  await fs.mkdir(path.dirname(to),{recursive:true});
  if(path.resolve(from)!==path.resolve(to))await fs.copyFile(from,to);
}
async function synchronize(){
  let available=0;
  for(const [category,n] of Object.entries(expected)){
    let names=[];
    try{
      names=(await fs.readdir(path.join(source,category),{withFileTypes:true}))
        .filter(f=>f.isFile()&&f.name.toLowerCase().endsWith(".png"))
        .map(f=>f.name);
    }catch{}
    // The archived source itself may be incomplete, but it must not prevent
    // using already available / user-supplied valid files.
    if(names.length!==n && names.length>0){
      console.warn("[ARTE] "+category+": encontrados "+names.length+
        " de "+n+" nomes esperados no arquivo de origem.");
    }
    const extras=new Set(names);
    // Reuse existing artwork even when the source folder was removed.
    for(const dir of [path.join(userArt,category),path.join(target,category)]){
      try{
        for(const name of await fs.readdir(dir)){
          if(name.toLowerCase().endsWith(".png"))extras.add(name);
        }
      }catch{}
    }
    for(const filename of [...extras].sort()){
      if(!/^[\w-]+\.png$/i.test(filename))continue;
      const key=category+"/"+filename;
      const dest=path.join(target,key);
      const override=path.join(userArt,key);
      const original=path.join(source,key);
      if(await validPNG(override)){
        await put(override,dest);count.user++;
      }else if(await validPNG(dest)){
        count.reused++;
      }else if(await validPNG(original)){
        await put(original,dest);count.imported++;
      }else{
        // If a previously copied source is invalid, remove the broken cache.
        // LÖVE must never be asked to decode it as if it were valid.
        await fs.rm(dest,{force:true}).catch(()=>{});
        pending.push(key);
        continue;
      }
      available++;
    }
  }
  count.valid=available;
  pending.sort();
  const report=pending.length ?
    "Arquivos .png INVALIDOS/AUSENTES no pacote upstream.\n"+
    "Forneca seus proprios PNGs validos em assets/custom/img/<categoria>/<nome>\n"+
    "ou em assets/reference/img/<categoria>/<nome>.\n"+
    "Nao sera gerado nenhum desenho substituto.\n\n"+
    pending.map(p=>"- "+p).join("\n")+"\n":
    "Todas as artes encontradas sao PNGs validos.\n";
  await fs.writeFile(path.join(project,"ARTES-PENDENTES.txt"),report);
  console.log("[ARTE] "+available+" PNGs validos; "+
    count.imported+" importados, "+count.reused+" preservados, "+
    count.user+" personalizados.");
  if(pending.length){
    console.warn("[ARTE] "+pending.length+
      " imagem(ns) do arquivo original nao sao PNGs validos:");
    for(const p of pending)console.warn("[ARTE]   "+p);
    console.warn("[ARTE] Lista completa: ARTES-PENDENTES.txt");
  }
  const blocked=required.filter(p=>pending.includes(p));
  if(blocked.length && process.env.MOOQUEST_ART_TEST_ONLY==="1"){
    console.warn("[ARTE][CI] Teste apenas do fluxo de rede e Canvas. "+
      "Sem martelo original valido, o resultado NAO prova fidelidade grafica.");
    return;
  }
  if(blocked.length){
    throw Error("A arma inicial usa "+blocked.join(", ")+
      ", arquivo invalido no repositorio de referencia. "+
      "Adicione uma ARTE PNG VERDADEIRA SUA em assets/custom/img/weapons/hammer_1.png; "+
      "nao vou criar uma imagem falsa ou iniciar o jogo com arma invisivel.");
  }
}
synchronize().catch(e=>{console.error("[ARTE] ERRO: "+e.message);process.exitCode=1;});
