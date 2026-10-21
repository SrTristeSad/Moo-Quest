// Privileged release staging. Never execute arbitrary URLs, scripts or ZIPs.
// Only Ed25519-signed manifests using the deployment owner's pinned key.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, verify } from 'node:crypto';
import { atomicJSON, loadJSON } from './storage.js';

const VERSION = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i;
const FILE = /^(?:src\/[a-zA-Z0-9_/-]+\.js|public\/[a-zA-Z0-9_.-]+\.(?:html|js|css))$/;
const REQUIRED = ['src/index.js','src/http.js','src/auth.js','src/storage.js',
  'src/updates.js','src/game.js','src/world.js','src/native-protocol.js','public/admin.html','public/login.html',
  'public/setup.html','public/style.css','public/app.js'];
const MAX_BYTES = 12 * 1024 * 1024;

export function validateSignedRelease(envelope, publicKey, manifestURL) {
  if (!publicKey) throw new Error('Configure MOO_UPDATE_PUBLIC_KEY_FILE before checking releases');
  if (!envelope || typeof envelope !== 'object' || !envelope.payload ||
      typeof envelope.signature !== 'string') throw new Error('Malformed update manifest');
  const payload = envelope.payload;
  const sig = Buffer.from(envelope.signature, 'base64');
  if (sig.length !== 64 || !verify(null, Buffer.from(JSON.stringify(payload)), publicKey, sig)) {
    throw new Error('Release signature is missing or invalid');
  }
  if (!VERSION.test(payload.version || '')) throw new Error('Invalid release version');
  if (!Array.isArray(payload.files) || payload.files.length > 60 || payload.files.length < REQUIRED.length) {
    throw new Error('Invalid release file count');
  }
  const origin = new URL(manifestURL);
  if (origin.protocol !== 'https:') throw new Error('Updates must use HTTPS');
  const seen = new Set();
  let bytes = 0;
  for (const file of payload.files) {
    if (!FILE.test(file.path || '') || file.path.includes('..') || file.path.includes('//') || seen.has(file.path)) {
      throw new Error('Forbidden or duplicate update file');
    }
    seen.add(file.path);
    if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > 1024 * 1024 ||
        !/^[0-9a-f]{64}$/.test(file.sha256 || '')) throw new Error('Invalid file descriptor');
    const url = new URL(file.url, origin);
    if (url.origin !== origin.origin || url.protocol !== 'https:' || url.username || url.password) {
      throw new Error('Update file must share configured HTTPS origin');
    }
    bytes += file.size;
  }
  if (bytes > MAX_BYTES || REQUIRED.some(f => !seen.has(f))) throw new Error('Incomplete or oversized release');
  return payload;
}

async function boundedFetch(url, maxBytes) {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15_000),
    headers: { 'User-Agent': 'MooQuest-Own-Release-Updater' } });
  if (!response.ok) throw new Error(`Update source returned HTTP ${response.status}`);
  const reader = response.body.getReader();
  let total = 0; const parts = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error('Update exceeds maximum download size');
      parts.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(parts);
}

export class Updates {
  constructor(root, dataDir, { manifestURL = process.env.MOO_UPDATE_MANIFEST_URL,
      publicKeyFile = process.env.MOO_UPDATE_PUBLIC_KEY_FILE } = {}) {
    this.root = root; this.dataDir = dataDir;
    this.manifestURL = manifestURL;
    this.publicKeyFile = publicKeyFile;
    this.stateFile = path.join(dataDir, 'release-state.json');
    this.state = loadJSON(this.stateFile, { active: 'builtin', previous: null, staged: null });
    this.checked = null;
  }
  status() { return { ...this.state, available: this.checked?.version || null,
    configured: Boolean(this.manifestURL && this.publicKeyFile) }; }
  async check() {
    if (!this.manifestURL || !this.publicKeyFile) throw new Error('Release channel/signing key not configured');
    const key = fs.readFileSync(this.publicKeyFile, 'utf8');
    const bytes = await boundedFetch(this.manifestURL, 128 * 1024);
    const manifest = JSON.parse(bytes.toString('utf8'));
    this.checked = validateSignedRelease(manifest, key, this.manifestURL);
    return { version: this.checked.version, files: this.checked.files.length,
      notes: String(this.checked.notes || '').slice(0, 500) };
  }
  async stage() {
    // Check immediately before staging: no stale unsigned file descriptors.
    await this.check();
    const payload = this.checked;
    const stageDir = path.join(this.dataDir, 'releases', payload.version);
    if (fs.existsSync(stageDir)) throw new Error('Release already staged; use another signed version');
    fs.mkdirSync(stageDir, { recursive: true, mode: 0o700 });
    try {
      for (const file of payload.files) {
        const response = await boundedFetch(new URL(file.url, this.manifestURL), file.size);
        if (response.length !== file.size || createHash('sha256').update(response).digest('hex') !== file.sha256) {
          throw new Error('Downloaded update hash mismatch: ' + file.path);
        }
        const dst = path.join(stageDir, file.path);
        fs.mkdirSync(path.dirname(dst), { recursive: true, mode: 0o700 });
        fs.writeFileSync(dst, response, { flag: 'wx', mode: 0o600 });
      }
      this.state.staged = payload.version;
      atomicJSON(this.stateFile, this.state);
      return this.status();
    } catch (error) {
      fs.rmSync(stageDir, { recursive: true, force: true });
      throw error;
    }
  }
  activate() {
    if (!this.state.staged || !VERSION.test(this.state.staged)) throw new Error('No staged signed update');
    const dir = path.join(this.dataDir, 'releases', this.state.staged);
    if (!REQUIRED.every(f => fs.existsSync(path.join(dir, f)))) throw new Error('Staged release incomplete');
    this.state.previous = this.state.active;
    this.state.active = this.state.staged;
    this.state.staged = null;
    atomicJSON(this.stateFile, this.state);
    return this.status(); // aaPanel restart intentionally remains manual.
  }
  rollback() {
    if (!this.state.previous) throw new Error('No earlier release to restore');
    [this.state.active, this.state.previous] = [this.state.previous, this.state.active];
    atomicJSON(this.stateFile, this.state);
    return this.status();
  }
}
