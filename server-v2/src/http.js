import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { passwordHash, passwordMatches, cookieToken, cookieHeader } from './auth.js';
const MIME = { css: 'text/css; charset=utf-8', js: 'application/javascript; charset=utf-8',
  html: 'text/html; charset=utf-8' };
const publicFiles = new Map([
  ['/public/style.css', 'style.css'], ['/public/app.js', 'app.js']
]);
function respond(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}
function redirect(res, dest) { res.writeHead(303, { Location: dest, 'Cache-Control': 'no-store' }); res.end(); }
function page(res, folder, filename) {
  const ext = filename.split('.').at(-1);
  const content = fs.readFileSync(path.join(folder, filename));
  respond(res, 200, content, MIME[ext] || 'text/plain; charset=utf-8');
}
async function readBody(req) {
  const chunks = []; let total = 0;
  for await (const part of req) {
    total += part.length;
    if (total > 12 * 1024) { const err = new Error('Request body too large'); err.status = 413; throw err; }
    chunks.push(part);
  }
  const data = Buffer.concat(chunks).toString('utf8');
  if (req.headers['content-type']?.startsWith('application/json')) return JSON.parse(data || '{}');
  if (req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(data));
  }
  throw Object.assign(new Error('Unsupported content type'), { status: 415 });
}
function sanitizeSettings(existing, patch) {
  if (!patch || typeof patch !== 'object') throw new Error('Invalid settings');
  const next = { ...existing };
  if ('title' in patch) {
    if (typeof patch.title !== 'string' || patch.title.length < 2 || patch.title.length > 36) throw new Error('Invalid title');
    next.title = patch.title;
  }
  if ('motd' in patch) {
    if (typeof patch.motd !== 'string' || patch.motd.length > 240) throw new Error('Invalid MOTD');
    next.motd = patch.motd;
  }
  if ('maxPlayers' in patch) {
    if (!Number.isSafeInteger(patch.maxPlayers) || patch.maxPlayers < 1 || patch.maxPlayers > 200) throw new Error('Invalid capacity');
    next.maxPlayers = patch.maxPlayers;
  }
  if ('maintenance' in patch) {
    if (typeof patch.maintenance !== 'boolean') throw new Error('Invalid maintenance mode');
    next.maintenance = patch.maintenance;
  }
  return next;
}
export function createHTTP({ root, storage, auth, updates, game = null, stopStatus = () => false,
  httpsCookies = process.env.MOO_PUBLIC_HTTPS === '1' }) {
  const publicDir = path.join(root, 'public');
  const rateKey = req => req.socket.remoteAddress || 'unknown';
  let gameRef = game;
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const logged = auth.get(cookieToken(req));
    const installed = Boolean(storage.data.owner);
    try {
      if (req.method === 'GET' && publicFiles.has(pathname)) return page(res, publicDir, publicFiles.get(pathname));
      // Compatibility ingress for the EXISTING Lua client, not the old
      // server implementation. The native binary session is first-party.
      if(req.method==='GET' && pathname==='/ping')return respond(res,200,{
        status:'ok',build:'mqv2native',servers:[{key:'LC',name:'LC',playerCount:gameRef?.room.players.size||0}]
      });
      if(req.method==='POST' && pathname==='/api/join'){
        if(!installed || !gameRef)return respond(res,503,{error:'not_installed'});
        const body=await readBody(req);
        const token=gameRef.issueTicket(req,body);
        return token?respond(res,200,token):respond(res,429,{error:'join_rejected'});
      }
      if (req.method === 'GET' && pathname === '/health') return respond(res, 200,
        { status: 'ok', version: '0.1.0', project: 'MooQuest-Own-Server' });
      if (req.method === 'GET' && pathname === '/ready') return respond(res, installed && !stopStatus() ? 200 : 503,
        { ready: installed && !stopStatus() });
      if (req.method === 'GET' && pathname === '/api/status') return respond(res, 200,
        { name: storage.data.settings.title, players: gameRef?.room.players.size ?? 0,
          capacity: storage.data.settings.maxPlayers, maintenance: storage.data.settings.maintenance,
          installed, protocol: 'mq-v2-native-compat-1', compatibility: 'experimental_not_certified' });
      if (req.method === 'GET' && pathname === '/') return redirect(res, installed ? '/admin/login' : '/setup');
      if (req.method === 'GET' && pathname === '/setup') return installed ? redirect(res, '/admin/login') : page(res, publicDir, 'setup.html');
      if (req.method === 'POST' && pathname === '/setup') {
        if (installed) return respond(res, 409, { error: 'already_installed' });
        if (++auth.setupAttempts > 5) return respond(res, 429, { error: 'restart_required' });
        const body = await readBody(req);
        if (body.code !== auth.setupCode) return respond(res, 403, { error: 'wrong_setup_code' });
        if (typeof body.username !== 'string' || !/^[a-zA-Z0-9_-]{3,24}$/.test(body.username)) {
          return respond(res, 400, { error: 'invalid_owner_name' });
        }
        const encoded = passwordHash(body.password);
        storage.data.owner = { username: body.username, password: encoded, createdAt: new Date().toISOString() };
        storage.audit('installation', { owner: body.username });
        auth.setupCode = null;
        const session = auth.issue();
        res.setHeader('Set-Cookie', cookieHeader(session.token, httpsCookies));
        return redirect(res, '/admin');
      }
      if (req.method === 'GET' && (pathname === '/admin/login' || pathname === '/login')) {
        return logged ? redirect(res, '/admin') : page(res, publicDir, 'login.html');
      }
      if (req.method === 'POST' && pathname === '/admin/login') {
        if (!installed) return redirect(res, '/setup');
        const ip = rateKey(req);
        if (auth.loginBlocked(ip)) return respond(res, 429, { error: 'too_many_attempts' });
        const body = await readBody(req);
        if (body.username !== storage.data.owner.username ||
            !passwordMatches(body.password, storage.data.owner.password)) {
          auth.recordFailure(ip);
          return respond(res, 401, { error: 'invalid_login' });
        }
        auth.failures.delete(ip);
        const session = auth.issue();
        res.setHeader('Set-Cookie', cookieHeader(session.token, httpsCookies));
        return redirect(res, '/admin');
      }
      if (pathname === '/admin' && req.method === 'GET') {
        return logged ? page(res, publicDir, 'admin.html') : redirect(res, '/admin/login');
      }
      if (pathname.startsWith('/api/admin/') || pathname === '/admin/logout') {
        if (!logged) return respond(res, 401, { error: 'unauthorized' });
        if (req.method !== 'GET' && !auth.sameCsrf(logged, req.headers['x-csrf-token'])) {
          return respond(res, 403, { error: 'invalid_csrf' });
        }
        const players = gameRef ? [...gameRef.room.players.values()] : [];
        if (req.method === 'GET' && pathname === '/api/admin/session') return respond(res, 200,
          { owner: storage.data.owner.username, csrf: logged.csrf });
        if (req.method === 'GET' && pathname === '/api/admin/status') return respond(res, 200,
          { uptimeSeconds: Math.floor(process.uptime()), title: storage.data.settings.title,
            players: players.length, maxPlayers: storage.data.settings.maxPlayers,
            maintenance: storage.data.settings.maintenance, version: '0.1.0',
            updates: updates.status() });
        if (req.method === 'GET' && pathname === '/api/admin/settings') return respond(res, 200, storage.data.settings);
        if (req.method === 'GET' && pathname === '/api/admin/players') return respond(res, 200,
          players.map(p => ({ id: p.id, name: p.name, hp: p.hp, x: Math.round(p.x), y: Math.round(p.y) })));
        if (req.method === 'GET' && pathname === '/api/admin/audit') return respond(res, 200, storage.data.audit.slice(-100).reverse());
        if (req.method === 'GET' && pathname === '/api/admin/updates') return respond(res, 200, updates.status());
        if (req.method === 'POST' && pathname === '/api/admin/settings') {
          storage.data.settings = sanitizeSettings(storage.data.settings, await readBody(req));
          storage.audit('settings_changed');
          if (gameRef) gameRef.room.maxPlayers = storage.data.settings.maxPlayers;
          return respond(res, 200, storage.data.settings);
        }
        if (req.method === 'POST' && pathname === '/api/admin/announce') {
          const body = await readBody(req);
          if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 240) return respond(res, 400, {error:'invalid_message'});
          storage.data.announcements.push({ message: body.message.trim(), at: new Date().toISOString() });
          if (storage.data.announcements.length > 100) storage.data.announcements.shift();
          storage.audit('announcement_sent');
          gameRef?.announce(body.message.trim());
          return respond(res, 200, { ok: true });
        }
        if (req.method === 'POST' && pathname === '/api/admin/players/kick') {
          const body = await readBody(req);
          if (typeof body.id !== 'string' || !gameRef?.kick(body.id)) return respond(res, 404, { error: 'unknown_player' });
          storage.audit('player_kicked', { playerId: body.id });
          return respond(res, 200, { ok: true });
        }
        if (req.method === 'POST' && pathname === '/api/admin/players/ban') {
          const body = await readBody(req);
          if (typeof body.id !== 'string' || !players.some(p => p.id === body.id)) return respond(res, 404, { error: 'unknown_player' });
          const target = players.find(p => p.id === body.id);
          if (!target.ipHash || !target.trustedOrigin) return respond(res, 400, { error: 'configure_reverse_proxy_identity' });
          storage.data.bans[target.ipHash] = { at: new Date().toISOString(), reason: String(body.reason || 'admin').slice(0, 80) };
          gameRef?.kick(body.id, 'banned');
          storage.audit('player_banned', { playerId: body.id });
          return respond(res, 200, { ok: true });
        }
        if (req.method === 'POST' && pathname === '/api/admin/updates/check') return respond(res, 200, await updates.check());
        if (req.method === 'POST' && pathname === '/api/admin/updates/stage') return respond(res, 200, await updates.stage());
        if (req.method === 'POST' && pathname === '/api/admin/updates/activate') {
          const value = updates.activate(); storage.audit('update_activated', { version: value.active });
          return respond(res, 200, { ...value, requiresAaPanelRestart: true });
        }
        if (req.method === 'POST' && pathname === '/api/admin/updates/rollback') {
          const value = updates.rollback(); storage.audit('update_rollback', { version: value.active });
          return respond(res, 200, { ...value, requiresAaPanelRestart: true });
        }
        if (req.method === 'POST' && pathname === '/admin/logout') {
          auth.revoke(cookieToken(req));
          res.setHeader('Set-Cookie', 'mq_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
          return respond(res, 200, { ok: true });
        }
      }
      return respond(res, 404, { error: 'not_found' });
    } catch (e) {
      const status = e.status || ((e instanceof SyntaxError || e.message.startsWith('Invalid')) ? 400 : 500);
      // Never leak file paths or secrets to public HTTP clients.
      if (status >= 500) console.error('[MooQuest] request failure', e);
      respond(res, status, { error: status >= 500 ? 'internal_error' : e.message });
    }
  });
  return { server, setGame: value => { gameRef = value; } };
}
