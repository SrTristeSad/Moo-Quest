// Distribution boundary: release ONLY the independent server runtime.
// This is a packaging safeguard, not a legal clearance or source-code similarity test.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const allowed = {src:/\\.js$/,public:/\\.(?:js|html|css)$/};
const VENDOR_LICENSE = 'src/vendor/al007ex/LICENSE';
const VENDOR_FILES = ['src/vendor/al007ex/effects.js','src/vendor/al007ex/utils.js',
  'src/vendor/al007ex/filterchat.js','src/vendor/al007ex/nameFilter.js',
  'src/vendor/al007ex/gameObject.js','src/vendor/al007ex/limit.js',
  'src/vendor/al007ex/ai.js','src/vendor/al007ex/aiManager.js',
  'src/vendor/al007ex/projectile.js','src/vendor/al007ex/projectileManager.js',
  'src/vendor/al007ex/objectManager.js'];
const required=['src/index.js','src/world.js','src/native-protocol.js','public/admin.html'];
const REFERENCE=['config.cjs','items.cjs','store.cjs','aiManager.js','ai.js','effects.js']
  .map(n=>'src/reference-source/'+n);
function within(base, file){
  const rel=path.relative(base,file);
  return rel!=='' && rel!=='..' && !rel.startsWith('..'+path.sep) && !path.isAbsolute(rel);
}
export function auditReleaseBoundary(root,{standalone=false}={}){
  root=path.resolve(root);
  const files=[];
  for(const folder of ['src','public']){
    const base=path.join(root,folder);
    if(!fs.statSync(base).isDirectory())throw new Error('Missing release directory: '+folder);
    function walk(dir){
      for(const item of fs.readdirSync(dir,{withFileTypes:true})){
        const absolute=path.join(dir,item.name);
        const relative=path.relative(root,absolute).split(path.sep).join('/');
        if(item.isSymbolicLink())throw new Error('Symlink prohibited: '+relative);
        if(item.isDirectory()){walk(absolute);continue;}
        if(!item.isFile() ||
            !(allowed[folder].test(item.name) || relative===VENDOR_LICENSE ||
              REFERENCE.includes(relative)))
          throw new Error('Unexpected release file: '+relative);
        if(!within(base,absolute) || !within(base,fs.realpathSync(absolute)))
          throw new Error('File escapes runtime directory: '+relative);
        files.push(relative);
        if(folder==='src'){
          const code=fs.readFileSync(absolute,'utf8');
          if(relative!=='src/reference-catalog.js' && /\b(?:require\s*\(|import\s*\()/.test(code))
            throw new Error('Dynamic import or CommonJS require must be reviewed: '+relative);
          for(const match of code.matchAll(/\bfrom\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]/g)){
            const spec=match[1]||match[2];
            if(!spec.startsWith('.'))continue;
            if(!spec.endsWith('.js'))throw new Error('Non-JavaScript local import: '+relative+' -> '+spec);
            const target=path.resolve(path.dirname(absolute),spec);
            if(!within(path.join(root,'src'),target)||!fs.existsSync(target)
              ||!within(path.join(root,'src'),fs.realpathSync(target)))
              throw new Error('Legacy/external or missing import: '+relative+' -> '+spec);
          }
        }
      }
    }
    walk(base);
  }
  for(const item of required)if(!files.includes(item))
    throw new Error('Missing required standalone runtime file: '+item);
  // A vendor runtime can only be shipped together with its exact license file.
  if(VENDOR_FILES.some(f=>files.includes(f))&&!files.includes(VENDOR_LICENSE))
    throw new Error('Missing Apache-2.0 vendor license');
  if(standalone || files.includes('src/reference-source/config.cjs')){
    for(const f of REFERENCE)if(!files.includes(f))
      throw new Error('Missing standalone reference source: '+f);
  }
  files.sort();
  return files;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const files=auditReleaseBoundary(root);
  console.log('Independent V2 runtime boundary verified: '+files.length+' files; no legacy imports or bundled art.');
}
