// Manual ZIP uploads are privileged source-code deployments, NOT a sandbox.
// Require authenticated admin + CSRF at the HTTP boundary. Import only the
// first-party src/*.js and public/*.html|css|js runtime tree from a trusted
// MooQuest V2 installation ZIP; never extract archive paths directly.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import yauzl from 'yauzl';

const MAX_ZIP=16*1024*1024;
const MAX_ENTRIES=8000;
const MAX_UNCOMPRESSED=128*1024*1024; // all archive entries, even skipped ones
const MAX_SOURCE=12*1024*1024;
const MAX_FILE=1024*1024;
const SAFE_FILE=/^(?:src\/[a-zA-Z0-9_/-]+\.js|src\/reference-source\/(?:config|items|store)\.cjs|src\/vendor\/al007ex\/LICENSE|public\/[a-zA-Z0-9_.-]+\.(?:html|js|css))$/;
const REQUIRED=[
  'src/index.js','src/http.js','src/auth.js','src/storage.js',
  'src/updates.js','src/zip-release.js','src/game.js','src/world.js',
  'src/native-protocol.js','src/store.js','src/database.js',
  'src/redis-services.js','src/player-accounts.js','src/request-identity.js',
  'src/guest-verification.js','public/admin.html','public/login.html',
  'public/setup.html','public/style.css','public/app.js'
];

function validatedPath(name,entry){
  if(typeof name!=='string'||name.length>240||name.includes('\\')||
     name.includes('\0')||name.startsWith('/')||name.includes('//')||
     /(?:^|\/)\.\.?\//.test(name)||name.split('/').some(x=>x==='..')||
     /^[a-z]:/i.test(name))
    throw new Error('Arquivo ZIP contém caminho inseguro');
  // Executable filesystem links, not just .. traversal, are prohibited.
  const type=(entry.externalFileAttributes>>>16)&0o170000;
  if(type===0o120000 || (type!==0 && type!==0o100000 && type!==0o040000))
    throw new Error('ZIP contém link ou entrada especial');
  if(!name.endsWith('/') && type===0o040000)
    throw new Error('ZIP declara diretório como arquivo');
}

function openZip(buffer){
  return new Promise((resolve,reject)=>{
    yauzl.fromBuffer(buffer,{lazyEntries:true,autoClose:false,validateEntrySizes:true},
      (error,zip)=>error?reject(error):resolve(zip));
  });
}
function scan(zip){
  return new Promise((resolve,reject)=>{
    let settled=false,count=0,total=0;
    const entries=[],seen=new Set();
    function fail(err){
      if(settled)return;settled=true;reject(err);
    }
    zip.on('error',fail);
    zip.on('entry',entry=>{
      if(settled)return;
      try{
        if(++count>MAX_ENTRIES)throw Error('ZIP contém arquivos demais');
        validatedPath(entry.fileName,entry);
        const key=entry.fileName.toLowerCase();
        if(seen.has(key))throw Error('ZIP contém caminhos repetidos');
        seen.add(key);
        total+=entry.uncompressedSize;
        if(total>MAX_UNCOMPRESSED)throw Error('ZIP descompactado excede limite');
        entries.push(entry);
        zip.readEntry();
      }catch(error){fail(error);}
    });
    zip.once('end',()=>{if(!settled){settled=true;resolve(entries);}});
    zip.readEntry();
  });
}

async function readEntry(zip,entry){
  const stream=await new Promise((resolve,reject)=>
    zip.openReadStream(entry,(err,value)=>err?reject(err):resolve(value)));
  const chunks=[];let count=0;
  for await(const chunk of stream){
    count+=chunk.length;
    if(count>MAX_FILE){stream.destroy();throw Error('Arquivo de código excede limite');}
    chunks.push(chunk);
  }
  if(count!==entry.uncompressedSize)throw Error('Arquivo ZIP com tamanho incorreto');
  return Buffer.concat(chunks,count);
}

function choosePrefix(entries){
  // ZIP exported by aaPanel normally has no prefix, GitHub and some ZIP
  // generators place all files inside one root directory.
  const candidates=entries.filter(e=>e.fileName==='src/index.js' ||
    /^[a-zA-Z0-9_.-]+\/src\/index\.js$/.test(e.fileName));
  if(candidates.length!==1)throw Error('ZIP não é um pacote de servidor V2 reconhecido');
  const prefix=candidates[0].fileName.slice(0,-'src/index.js'.length);
  return prefix;
}

export async function stageTrustedZip(buffer,dataDir){
  if(!Buffer.isBuffer(buffer)||buffer.length<22||buffer.length>MAX_ZIP||
      buffer.readUInt32LE(0)!==0x04034b50)
    throw Error('Envie um ZIP válido do MooQuest V2 com até 16 MB');
  const archive=await openZip(buffer);
  try{
    const entries=await scan(archive);
    const prefix=choosePrefix(entries);
    const targets=[];
    let sum=0;
    const seen=new Set();
    for(const entry of entries){
      const full=entry.fileName;
      if(!full.startsWith(prefix))continue;
      const relative=full.slice(prefix.length);
      if(!SAFE_FILE.test(relative)||relative.includes('..')||
         relative.includes('//')||relative.endsWith('/'))continue;
      if(seen.has(relative))throw Error('Arquivos duplicados no release');
      seen.add(relative);
      if(entry.uncompressedSize>MAX_FILE)throw Error('Arquivo excede limite');
      sum+=entry.uncompressedSize;
      if(sum>MAX_SOURCE)throw Error('Release excede 12 MB descompactado');
      targets.push({entry,relative});
    }
    for(const required of REQUIRED)
      if(!seen.has(required))throw Error('ZIP do servidor incompleto: '+required);
    if(seen.has('src/reference-catalog.js')) {
      for(const file of ['config.cjs','items.cjs','store.cjs',
        'aiManager.js','ai.js','effects.js'].map(n=>'src/reference-source/'+n))
        if(!seen.has(file))throw Error('ZIP missing reference source: '+file);
    }
    if([...seen].some(f=>f.startsWith('src/vendor/al007ex/')&&f.endsWith('.js'))&&
       !seen.has('src/vendor/al007ex/LICENSE'))
      throw Error('ZIP deve incluir licença Apache-2.0 dos módulos importados');
    const release='0.1.0-zip.'+Date.now().toString(36)+'.'+randomBytes(4).toString('hex');
    const dir=path.join(dataDir,'releases',release);
    fs.mkdirSync(dir,{recursive:true,mode:0o700});
    const sha256=createHash('sha256').update(buffer).digest('hex');
    try{
      for(const {entry,relative} of targets){
        const bytes=await readEntry(archive,entry);
        const file=path.join(dir,relative);
        fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
        fs.writeFileSync(file,bytes,{flag:'wx',mode:0o600});
      }
      return {version:release,files:targets.length,sha256,source:'admin_zip'};
    }catch(error){
      fs.rmSync(dir,{recursive:true,force:true});
      throw error;
    }
  }finally{
    archive.close();
  }
}
