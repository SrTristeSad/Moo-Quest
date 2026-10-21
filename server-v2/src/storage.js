// Completely independent MooQuest 2 storage; no reference-game code or art.
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export function dataDirectory(root) {
  const dir = process.env.MOO_DATA_DIR ? path.resolve(process.env.MOO_DATA_DIR) : path.join(root, 'var');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}
export function loadJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') return structuredClone(fallback);
    throw error; // Corrupt JSON is NOT silently reset, to avoid losing accounts.
  }
}
export function atomicJSON(file, obj) {
  const folder = path.dirname(file);
  fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
  const tmp = path.join(folder, '.' + path.basename(file) + '.' + randomBytes(8).toString('hex') + '.tmp');
  try {
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    fs.renameSync(tmp, file);
  } catch (e) {
    try { fs.rmSync(tmp); } catch {}
    throw e;
  }
}
export class Storage {
  constructor(root) {
    this.dir = dataDirectory(root);
    this.file = path.join(this.dir, 'config.json');
    this.data = loadJSON(this.file, {
      schema: 1, owner: null, settings: {
        title: 'MooQuest', motd: 'Bem-vindo ao mundo!', maxPlayers: 60,
        maintenance: false, publicRegistration: false
      }, bans: {}, announcements: [], audit: []
    });
    if (this.data.schema !== 1 || !this.data.settings || !this.data.bans) {
      throw new Error('Unsupported or damaged MooQuest database schema');
    }
  }
  save() { atomicJSON(this.file, this.data); }
  audit(kind, extra = {}) {
    this.data.audit.push({ at: new Date().toISOString(), kind, ...extra });
    if (this.data.audit.length > 500) this.data.audit.splice(0, this.data.audit.length - 500);
    this.save();
  }
}
