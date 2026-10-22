// Restores user-supplied PNGs from a prior Moo-Quest installation.
// No downloads, fabricated sprites, overwrites, privileged filesystem access,
// or copying of credentials/code. Only recognized artwork directories.
import {existsSync,lstatSync,readdirSync,readFileSync,copyFileSync,mkdirSync} from 'node:fs';
import {resolve,join,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';

const CATEGORIES=['animals','weapons','hats','accessories','resources','icons'];
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const PATHS=[
  'assets/custom/img','assets/reference/img',
  'node-runtime/client/public/img','client/public/img','client/img',
  'public/img','img','.'
];
function directory(path){
  if(!existsSync(path))return false;
  try{const meta=lstatSync(path);return meta.isDirectory()&&!meta.isSymbolicLink();}
  catch{return false;}
}
function validPng(file){
  try{
    const stat=lstatSync(file);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size<33||stat.size>16*1024*1024)return false;
    const b=readFileSync(file);
    return b.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))&&
      b.toString('ascii',12,16)==='IHDR'&&
      b.readUInt32BE(16)>0&&b.readUInt32BE(16)<=8192&&
      b.readUInt32BE(20)>0&&b.readUInt32BE(20)<=8192;
  }catch{return false;}
}
export function importArtwork(sourcePath,{targetRoot=ROOT}={}){
  if(typeof sourcePath!=='string'||!sourcePath.trim())throw Error('Informe a pasta anterior.');
  const source=resolve(sourcePath.trim().replace(/^"(.*)"$/,'$1'));
  const target=resolve(targetRoot,'assets','custom','img');
  if(!directory(source))throw Error('Pasta anterior inexistente ou nao permitida.');
  const result={copied:0,existing:0,invalid:0,examples:[],sources:[]};
  for(const rel of PATHS){
    const sourceImg=resolve(source,rel);
    if(!directory(sourceImg)||sourceImg===target)continue;
    const copies=[];
    for(const category of CATEGORIES){
      const folder=join(sourceImg,category);
      if(!directory(folder))continue;
      for(const entry of readdirSync(folder,{withFileTypes:true})){
        if(!entry.isFile()||! /^[a-z0-9_-]+\.png$/i.test(entry.name))continue;
        const from=join(folder,entry.name);
        const to=join(target,category,entry.name);
        if(!validPng(from)){result.invalid++;continue;}
        if(existsSync(to)){result.existing++;continue;}
        mkdirSync(dirname(to),{recursive:true});
        copyFileSync(from,to);
        copies.push(category+'/'+entry.name);
        result.copied++;
        if(result.examples.length<8)result.examples.push(category+'/'+entry.name);
      }
    }
    if(copies.length)result.sources.push(rel);
  }
  return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const source=process.argv.slice(2).join(' ');
    if(!source){console.error('Uso: node tools/importar-artes-antigas.mjs "C:\\pasta\\do\\cliente-antigo"');process.exitCode=1;}
    else {
      const r=importArtwork(source);
      console.log('Artes restauradas: '+r.copied+' PNG(s).');
      console.log('Ja existentes (preservadas): '+r.existing+'.');
      console.log('Invalidas (ignoradas): '+r.invalid+'.');
      if(r.sources.length)console.log('Pastas utilizadas: '+r.sources.join(', '));
      if(r.examples.length)console.log('Exemplos: '+r.examples.join(', '));
      if(r.copied===0)console.log('Nenhuma imagem nova encontrada. A instalacao antiga precisa conter os arquivos PNG reais nas subpastas animals/, weapons/, hats/, etc.');
      console.log('Reabra o cliente apos importar para recarregar as imagens.');
    }
  }catch(error){console.error('[ERRO] '+error.message);process.exitCode=1;}
}