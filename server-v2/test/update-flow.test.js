import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { Storage } from '../src/storage.js';
import { Updates } from '../src/updates.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('full signed update: verify bytes, stage, activate and roll back',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mq-release-flow-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const {publicKey,privateKey}=generateKeyPairSync('ed25519');
  const pubFile=path.join(dir,'public.pem');
  fs.writeFileSync(pubFile,publicKey.export({format:'pem',type:'spki'}));
  const manifestURL='https://updates.example.net/manifest.json';
  const names=['src/index.js','src/http.js','src/auth.js','src/storage.js',
    'src/updates.js','src/game.js','src/world.js','src/native-protocol.js',
    'src/store.js','src/database.js','src/redis-services.js','public/admin.html',
    'public/login.html','public/setup.html','public/style.css','public/app.js'];
  const content=new Map();
  const files=names.map(name=>{
    const bytes=fs.readFileSync(path.join(root,name));
    const url='https://updates.example.net/v0.2.0/'+name;
    content.set(url,bytes);
    return {path:name,url,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  });
  const payload={version:'0.2.0',files,notes:'v2 beta'};
  content.set(manifestURL,Buffer.from(JSON.stringify({payload,
    signature:sign(null,Buffer.from(JSON.stringify(payload)),privateKey).toString('base64')})));
  const before=globalThis.fetch;
  globalThis.fetch=async url=>{
    const bytes=content.get(String(url));
    return bytes?new Response(bytes,{status:200}):new Response('missing',{status:404});
  };
  t.after(()=>{globalThis.fetch=before});
  const storage=new Storage(dir),updates=new Updates(dir,storage.dir,{manifestURL,publicKeyFile:pubFile});
  assert.equal((await updates.check()).version,'0.2.0');
  assert.equal((await updates.stage()).staged,'0.2.0');
  assert.equal(fs.readFileSync(path.join(storage.dir,'releases','0.2.0','src','world.js'),'utf8'),fs.readFileSync(path.join(root,'src','world.js'),'utf8'));
  assert.equal(updates.activate().active,'0.2.0');
  assert.equal(updates.rollback().active,'builtin');
  assert.equal(JSON.parse(fs.readFileSync(path.join(storage.dir,'release-state.json'),'utf8')).active,'builtin');
});
