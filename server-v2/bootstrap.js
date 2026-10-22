// aaPanel should run THIS file. Code releases are separate from persistent var/.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { atomicJSON, dataDirectory, loadJSON } from './src/storage.js';
import { createInfrastructureInstaller, savedInfrastructure } from './setup-server.js';
const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = dataDirectory(root);
const stateFile = path.join(dataDir, 'release-state.json');
let stopping = false;
let worker = null;
let installer = null;
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
      async function bootstrap(){
  // First launch: run the guided setup instead of crashing on absent URLs.
  // Existing installations with explicit environment variables are untouched.
  if(!process.env.MOO_DATABASE_URL||!process.env.MOO_REDIS_URL){
    const saved=savedInfrastructure(root);
    if(saved){
      process.env.MOO_DATABASE_URL ||= saved.databaseURL;
      process.env.MOO_REDIS_URL ||= saved.redisURL;
    }
  }
  if(!process.env.MOO_DATABASE_URL||!process.env.MOO_REDIS_URL){
    const port=Number(process.env.MOO_PORT||process.env.PORT||8100);
    if(!Number.isSafeInteger(port)||port<1||port>65535)
      throw new Error('Invalid MOO_PORT');
    const host=process.env.MOO_HOST||'127.0.0.1';
    installer=createInfrastructureInstaller({root,onInstalled:urls=>{
      process.env.MOO_DATABASE_URL=urls.databaseURL;
      process.env.MOO_REDIS_URL=urls.redisURL;
      installer=null;
      startWorker();
    }});
    await installer.listen(port,host);
    console.log('[MooQuest] PRIMEIRA INSTALACAO - abra /setup pelo dominio do aaPanel.');
    console.log('[MooQuest] Codigo de instalacao: '+installer.code);
    console.log('[MooQuest] Informe as credenciais de PostgreSQL e Redis no instalador.');
    return;
  }
  startWorker();
}
await bootstrap();
      return;
    }
    process.exit(code || (signal ? 1 : 0));
  });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  if (stopping) return;
  stopping = true;
  if (worker) worker.kill(signal);
  if (installer) installer.server.close();
});
startWorker();
