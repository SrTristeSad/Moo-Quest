// Create byte-for-byte copies of original reference modules for isolated
// signed releases. No manually maintained tables or source rewriting.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const SOURCES=Object.freeze([
  ['../shared/config.js','src/reference-source/config.cjs'],
  ['../shared/config/items.js','src/reference-source/items.cjs'],
  ['../shared/config/store.js','src/reference-source/store.cjs'],
  ['../server/src/moomoo/modules/aiManager.js','src/reference-source/aiManager.js'],
  ['../server/src/moomoo/modules/ai.js','src/reference-source/ai.js'],
  ['../server/src/moomoo/modules/effects.js','src/reference-source/effects.js']
]);
export const PACKAGED_REFERENCE_PATHS=SOURCES.map(([,target])=>target);
export function copyReferenceSources(destination){
  const result=[];
  for(const [origin,target] of SOURCES){
    const src=path.resolve(root,origin),dest=path.join(destination,target);
    if(!fs.statSync(src).isFile())throw new Error('Reference file missing: '+src);
    fs.mkdirSync(path.dirname(dest),{recursive:true});
    fs.copyFileSync(src,dest);
    const from=fs.readFileSync(src),to=fs.readFileSync(dest);
    const sha256=b=>createHash('sha256').update(b).digest('hex');
    if(sha256(from)!==sha256(to))throw new Error('Reference copy changed: '+origin);
    result.push({origin:origin.replace(/^\.\.\//,''),target,sha256:sha256(to)});
  }
  return result;
}
