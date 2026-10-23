// Publisher-only, offline signing tool. Never run with a private signing key
// on the game VPS. Upload outputs to your own HTTPS release domain.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, sign } from 'node:crypto';
import { auditReleaseBoundary } from './check-release-boundary.mjs';
import {copyReferenceSources} from './reference-sources.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const keyPath = process.env.MOO_SIGNING_PRIVATE_KEY_FILE;
const origin = process.env.MOO_RELEASE_PUBLIC_BASE;
const out = path.resolve(process.env.MOO_RELEASE_OUT || path.join(root,'release-output'));
const version = process.env.MOO_RELEASE_VERSION || JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
if (!keyPath || !origin) throw new Error('Set MOO_SIGNING_PRIVATE_KEY_FILE and MOO_RELEASE_PUBLIC_BASE');
if (!/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i.test(version)) throw new Error('Invalid release version');
const base = new URL(origin);
if (base.protocol !== 'https:' || base.username || base.password) throw new Error('Release base must use HTTPS');
const staging=fs.mkdtempSync(path.join(root,'reference-release-staging-'));
try {
  fs.cpSync(path.join(root,'src'),path.join(staging,'src'),{recursive:true});
  fs.cpSync(path.join(root,'public'),path.join(staging,'public'),{recursive:true});
  const sources=copyReferenceSources(staging);
  console.log('Verified reference sources: '+sources.map(s=>s.target+'='+s.sha256).join(', '));
  const files=auditReleaseBoundary(staging,{standalone:true});
fs.mkdirSync(path.join(out,'releases',version),{recursive:true});
const manifest = {version,notes:'MooQuest independent server release',files:[]};
for (const rel of files) {
  const contents = fs.readFileSync(path.join(staging,rel));
  if(contents.length>1024*1024) throw new Error('Release file exceeds size limit: '+rel);
  const dst = path.join(out,'releases',version,rel);
  fs.mkdirSync(path.dirname(dst),{recursive:true});
  fs.copyFileSync(path.join(staging,rel),dst);
  manifest.files.push({path:rel,size:contents.length,
    sha256:createHash('sha256').update(contents).digest('hex'),
    url:'/releases/'+version+'/'+rel});
}
const signature=sign(null,Buffer.from(JSON.stringify(manifest)),fs.readFileSync(keyPath)).toString('base64');
const envelope={payload:manifest,signature};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(envelope,null,2)+'\n');
console.log('Signed release '+version+' with '+manifest.files.length+' files. Upload '+out+' to '+base.origin);
console.log('Configured MOO_UPDATE_MANIFEST_URL should point to '+new URL('/manifest.json',base).href);
} finally {
  fs.rmSync(staging,{recursive:true,force:true});
}
