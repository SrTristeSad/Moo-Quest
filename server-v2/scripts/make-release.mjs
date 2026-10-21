// Publisher-only, offline signing tool. Never run with a private signing key
// on the game VPS. Upload outputs to your own HTTPS release domain.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, sign } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const keyPath = process.env.MOO_SIGNING_PRIVATE_KEY_FILE;
const origin = process.env.MOO_RELEASE_PUBLIC_BASE;
const out = path.resolve(process.env.MOO_RELEASE_OUT || path.join(root,'release-output'));
const version = process.env.MOO_RELEASE_VERSION || JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
if (!keyPath || !origin) throw new Error('Set MOO_SIGNING_PRIVATE_KEY_FILE and MOO_RELEASE_PUBLIC_BASE');
if (!/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i.test(version)) throw new Error('Invalid release version');
const base = new URL(origin);
if (base.protocol !== 'https:' || base.username || base.password) throw new Error('Release base must use HTTPS');
const files = [];
function walk(dir) {
  for (const item of fs.readdirSync(path.join(root,dir),{withFileTypes:true})) {
    const rel = dir+'/'+item.name;
    if (item.isSymbolicLink()) throw new Error('No symlinks in signed release');
    if (item.isDirectory()) returnFiles(rel);
    else if (item.isFile() && (rel.startsWith('src/') && rel.endsWith('.js') ||
      rel.startsWith('public/') && /\.(?:html|js|css)$/.test(rel))) files.push(rel);
  }
}
function returnFiles(dir){walk(dir)}
walk('src');walk('public');
if (!files.includes('src/index.js') || !files.includes('src/world.js') || !files.includes('public/admin.html')) {
  throw new Error('Incomplete release tree');
}
files.sort();
fs.mkdirSync(path.join(out,'releases',version),{recursive:true});
const manifest = {version,notes:'MooQuest independent server release',files:[]};
for (const rel of files) {
  const contents = fs.readFileSync(path.join(root,rel));
  if(contents.length>1024*1024) throw new Error('Release file exceeds size limit: '+rel);
  const dst = path.join(out,'releases',version,rel);
  fs.mkdirSync(path.dirname(dst),{recursive:true});
  fs.copyFileSync(path.join(root,rel),dst);
  manifest.files.push({path:rel,size:contents.length,
    sha256:createHash('sha256').update(contents).digest('hex'),
    url:'/releases/'+version+'/'+rel});
}
const signature=sign(null,Buffer.from(JSON.stringify(manifest)),fs.readFileSync(keyPath)).toString('base64');
const envelope={payload:manifest,signature};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(envelope,null,2)+'\n');
console.log('Signed release '+version+' with '+manifest.files.length+' files. Upload '+out+' to '+base.origin);
console.log('Configured MOO_UPDATE_MANIFEST_URL should point to '+new URL('/manifest.json',base).href);
