// aaPanel should run THIS file. Code releases are separate from persistent var/.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { atomicJSON, dataDirectory, loadJSON } from './src/storage.js';
const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = dataDirectory(root);
const stateFile = path.join(dataDir, 'release-state.json');
let stopping = false;
let worker = null;
const validVersion = v => /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i.test(v || '');
function startWorker() {
  const state = loadJSON(stateFile, { active:'builtin', previous:null, staged:null });
  const active = state.active;
  const release = active === 'builtin' ? root :
    validVersion(active) ? path.join(dataDir, 'releases', active) : null;
  if (!release || !fs.existsSync(path.join(release, 'src', 'index.js'))) {
    throw new Error('Invalid active release. Restore var/release-state.json.');
  }
  const started = Date.now();
  worker = spawn(process.execPath, [path.join(release, 'src', 'index.js')], {
    cwd: root, stdio:'inherit', env: { ...process.env, MOO_SERVER_ROOT: root }
  });
  worker.once('exit', (code, signal) => {
    if (stopping) { process.exit(code || 0); return; }
    if (active !== 'builtin' && state.previous && Date.now() - started < 15000) {
      console.error(`[MooQuest] Release ${active} failed early; restoring ${state.previous}.`);
      state.active = state.previous;
      state.previous = active;
      atomicJSON(stateFile, state);
      startWorker();
      return;
    }
    process.exit(code || (signal ? 1 : 0));
  });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  if (stopping) return;
  stopping = true;
  if (worker) worker.kill(signal);
});
startWorker();
