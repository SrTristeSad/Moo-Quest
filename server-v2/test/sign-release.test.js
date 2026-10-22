import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateKeyPairSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { validateSignedRelease } from '../src/updates.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('publisher creates a valid signed manifest from new first-party source only',t=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mq-publish-test-'));
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  const { publicKey, privateKey }=generateKeyPairSync('ed25519');
  const privateFile=path.join(temp,'private.pem');
  fs.writeFileSync(privateFile,privateKey.export({type:'pkcs8',format:'pem'}));
  const env={...process.env,MOO_SIGNING_PRIVATE_KEY_FILE:privateFile,
    MOO_RELEASE_PUBLIC_BASE:'https://updates.example.com/',
    MOO_RELEASE_OUT:path.join(temp,'out')};
  const result=spawnSync(process.execPath,['scripts/make-release.mjs'],{cwd:root,env,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const json=JSON.parse(fs.readFileSync(path.join(temp,'out','manifest.json'),'utf8'));
  const v=validateSignedRelease(json, publicKey, 'https://updates.example.com/manifest.json');
  assert.equal(v.version,'0.1.0');
  assert.ok(v.files.some(f=>f.path==='src/world.js'));
  assert.ok(v.files.some(f=>f.path==='src/native-protocol.js'));
  assert.ok(v.files.some(f=>f.path==='src/vendor/al007ex/LICENSE'));
  assert.equal(fs.existsSync(path.join(temp,'out','releases','0.1.0',
    'src','vendor','al007ex','LICENSE')),true);
  assert.ok(v.files.every(f=>f.path.startsWith('src/')||f.path.startsWith('public/')));
  assert.equal(fs.existsSync(path.join(temp,'out','releases','0.1.0','src','index.js')),true);
});
