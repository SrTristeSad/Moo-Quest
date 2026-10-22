import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateKeyPairSync, sign, createHash } from 'node:crypto';
import { Storage } from '../src/storage.js';
import { Auth, passwordHash, passwordMatches } from '../src/auth.js';
import { Updates, validateSignedRelease } from '../src/updates.js';

function temp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'moo-own-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
test('setup passwords use scrypt and cannot be compared without salt', () => {
  const a = passwordHash('password-long-enough-123');
  const b = passwordHash('password-long-enough-123');
  assert.notEqual(a, b);
  assert.ok(passwordMatches('password-long-enough-123', a));
  assert.equal(passwordMatches('incorrect-password', a), false);
  assert.throws(() => passwordHash('short'));
  assert.equal(passwordMatches('test', 'bad'), false);
});
test('CSRF, token TTL and login brute-force restrictions', () => {
  const auth = new Auth();
  assert.match(auth.setupCode, /^[0-9]{6}$/);
  const s = auth.issue();
  const current = auth.get(s.token);
  assert.ok(current);
  assert.equal(auth.sameCsrf(current, s.csrf), true);
  assert.equal(auth.sameCsrf(current, s.csrf.slice(1)), false);
  assert.equal(auth.get('garbage'), null);
  for (let i = 0; i < 5; i++) auth.recordFailure('127.0.0.1');
  assert.equal(auth.loginBlocked('127.0.0.1'), true);
  auth.revoke(s.token);
  assert.equal(auth.get(s.token), null);
});
test('private settings are atomically saved; corrupted state is rejected', t => {
  const root = temp(t);
  const store = new Storage(root);
  store.data.owner = { username: 'admin', password: 'hash' };
  store.audit('installed');
  const next = new Storage(root);
  assert.equal(next.data.owner.username, 'admin');
  assert.equal(next.data.audit[0].kind, 'installed');
  assert.deepEqual(fs.readdirSync(path.join(root,'var')).filter(x=>x.endsWith('.tmp')), []);
  fs.writeFileSync(path.join(root,'var','config.json'), '{broken-json');
  assert.throws(() => new Storage(root));
});
test('update only accepts genuine Ed25519 releases from configured HTTPS origin', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const origin = 'https://release.example.org/manifest.json';
  const files = ['src/index.js','src/http.js','src/auth.js','src/storage.js',
    'src/updates.js','src/zip-release.js','src/game.js','src/world.js','src/native-protocol.js',
    'src/store.js','src/database.js','src/redis-services.js','src/player-accounts.js',
    'src/request-identity.js','src/guest-verification.js','public/admin.html',
    'public/login.html','public/setup.html','public/style.css','public/app.js']
    .map(p => ({ path: p, url: '/build/' + p, size: 4, sha256: createHash('sha256').update('test').digest('hex') }));
  const payload = { version: '0.2.0', files, notes: 'Atualização oficial' };
  const encode = object => ({payload:object,
    signature:sign(null,Buffer.from(JSON.stringify(object)),privateKey).toString('base64')});
  assert.equal(validateSignedRelease(encode(payload), publicKey, origin).version,'0.2.0');
  const badSignature = encode(payload);
  badSignature.payload.notes = 'ALTERED';
  assert.throws(()=>validateSignedRelease(badSignature, publicKey, origin), /signature/);
  assert.throws(()=>validateSignedRelease(encode({ ...payload, files:[...files,{...files[0],path:'../var/config.json'}]}),publicKey,origin),/Forbidden/);
  assert.throws(()=>validateSignedRelease(encode({ ...payload, files:files.map((f,i)=>i===0?{...f,url:'https://evil.example.com/code.js'}:f)}),publicKey,origin),/origin/);
  assert.throws(()=>validateSignedRelease(encode(payload),publicKey,'http://release.example.org/manifest.json'),/HTTPS/);
});
test('a signed release must be staged before activation or rollback', t => {
  const root = temp(t);
  const store = new Storage(root);
  const updates = new Updates(root,store.dir,{manifestURL:null, publicKeyFile:null});
  assert.equal(updates.status().active,'builtin');
  assert.throws(()=>updates.activate(), /No staged/);
  assert.throws(()=>updates.rollback(), /No earlier/);
  assert.equal(updates.status().configured,false);
});
