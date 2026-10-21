// Standalone original Node.js backend. Does not import legacy MooMoo server.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgresStorage } from './database.js';
import { RedisAuth, RedisTickets, connectRedis } from './redis-services.js';
import { Updates } from './updates.js';
import { createHTTP } from './http.js';
import { GameServer } from './game.js';

const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = process.env.MOO_SERVER_ROOT ? path.resolve(process.env.MOO_SERVER_ROOT) : moduleRoot;
// Fail startup when required infrastructure is unavailable; never start a
// public server with empty fallback admin state or in-memory sessions.
const storage = await new PostgresStorage(root).init();
let redis;
try { redis = await connectRedis(); }
catch(error) { await storage.close(); throw error; }
const auth = new RedisAuth(redis);
const updates = new Updates(root, storage.dir);
let stopping = false;
const app = createHTTP({ root: moduleRoot, storage, auth, updates, stopStatus: () => stopping });
const game = new GameServer(app.server, storage, new RedisTickets(redis));
app.setGame(game);
const host = process.env.MOO_HOST || '127.0.0.1';
const port = Number(process.env.MOO_PORT || 8100);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('Invalid MOO_PORT');
app.server.listen(port, host, () => {
  console.log(`[MooQuest Own Server] http://${host}:${port}`);
  if (!storage.data.owner) {
    console.log('---------------------------------------------');
    console.log('CÓDIGO DE INSTALAÇÃO: ' + auth.setupCode);
    console.log('Abra /setup. Nunca envie o código a terceiros.');
    console.log('---------------------------------------------');
  } else console.log('Painel administrativo: /admin');
  game.start();
});
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`[MooQuest] ${signal}: encerrando partidas e servidor.`);
  const deadline = setTimeout(() => process.exit(1), 7000);
  deadline.unref();
  try {
    await game.stop();
    await new Promise(resolve => app.server.close(resolve));
    await redis.quit();
    await storage.close();
    clearTimeout(deadline);
    process.exit(0);
  } catch (err) { console.error(err); process.exit(1); }
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
