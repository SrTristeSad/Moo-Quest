import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { requestIdentity } from './request-identity.js';
import { createGuestVerifier } from './guest-verification.js';
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
  if ('publicRegistration' in patch) {
    if (typeof patch.publicRegistration !== 'boolean') throw new Error('Invalid publicRegistration');
    next.publicRegistration = patch.publicRegistration;
  }
  return next;
}
export function createHTTP({ root, storage, auth, updates, game = null,
  accounts=null,playerTokens=null,guestVerifier=createGuestVerifier(),stopStatus = () => false,
  httpsCookies = process.env.MOO_PUBLIC_HTTPS === '1' }) {
  const publicDir = path.join(root, 'public');
  const rateKey = req => requestIdentity(req).address;
  let gameRef = game;
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
    const pathname = new URL(req.url, 'http://localhost').pathname;
    try {
      const logged = await auth.get(cookieToken(req));
      const installed = Boolean(storage.data.owner);
      if (req.method === 'GET' && publicFiles.has(pathname)) return page(res, publicDir, publicFiles.get(pathname));
      // Compatibility ingress for the EXISTING Lua client, not the old
      // server implementation. The native binary session is first-party.
      if(req.method==='GET' && pathname==='/ping')return respond(res,200,{
        status:'ok',build:'mqv2native',servers:[{key:'LC',name:'LC',playerCount:gameRef?.room.players.size||0}]
      });
      if(req.method==='GET' && pathname==='/api/capabilities')return respond(res,200,{
        build:'mqv2native',registeredAccounts:true,
        persistentClans:true,
        guestAdmission:guestVerifier.publicMode?'verified_challenge':'direct_loopback_only',
        tlsRequiredForRemote:true,
        mode:guestVerifier.publicMode?'public':'local_development'
      });
      if(req.method==='POST' && pathname==='/api/join'){
        if(!installed || !gameRef)return respond(res,503,{error:'not_installed'});
        const body=await readBody(req);
        const authorization=req.headers.authorization;
        let accountId=null;
        if(authorization!==undefined){
          const match=/^Bearer ([a-f0-9]{64})$/.exec(authorization);
          accountId=match&&playerTokens?await playerTokens.get(match[1]):null;
          if(!accountId)return respond(res,401,{error:'invalid_player_token'});
        }
        // A boolean captcha field from an untrusted client is not proof.
        // In public mode, the guest must pass provider-side verification
        // before any single-use WebSocket admission ticket is issued.
        if(!accountId && !await guestVerifier.verify(req,body))
          return respond(res,403,{error:'guest_verification_failed'});
        const token=await gameRef.issueTicket(req,body,accountId);
        return token?respond(res,200,token):respond(res,429,{error:'join_rejected'});
      }
      if(pathname.startsWith('/api/account/')){
        if(!installed||!accounts||!playerTokens)return respond(res,503,{error:'accounts_unavailable'});
        if(req.method==='POST'&&pathname==='/api/account/register'){
          if(!storage.data.settings.publicRegistration)return respond(res,403,{error:'registration_disabled'});
          if(!(await auth.allowRegistration(rateKey(req))))
            return respond(res,429,{error:'registration_rate_limited'});
          const body=await readBody(req);
          const result=await accounts.register(body.username,body.password);
          return respond(res,201,{id:result.id,username:result.username});
        }
        if(req.method==='POST'&&pathname==='/api/account/login'){
          const key='account:'+rateKey(req);
          if(await auth.loginBlocked(key))return respond(res,429,{error:'too_many_attempts'});
          const body=await readBody(req);
          const result=await accounts.authenticate(body.username,body.password);
          if(!result){
            await auth.recordFailure(key);
            return respond(res,401,{error:'invalid_credentials'});
          }
          await auth.clearFailure(key);
          const session=await playerTokens.issue(result.id);
          return respond(res,200,{...session,id:result.id,username:result.username});
        }
        const bearer=/^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization||'');
        const token=bearer?.[1],accountId=token?await playerTokens.get(token):null;
        if(!accountId)return respond(res,401,{error:'invalid_player_token'});
        if(req.method==='GET'&&
            (pathname==='/api/account/me'||pathname==='/api/account/progress')){
          const user=await accounts.load(accountId);
          if(!user)return respond(res,401,{error:'invalid_player_token'});
          if(pathname==='/api/account/me')
            return respond(res,200,{id:user.id,username:user.username,
              clan:user.clan?.tag||null});
          // This is a *persisted* snapshot; live world data can be newer.
          const p=user.profile||{};
          const resources=p.resources||{};
          return respond(res,200,{id:user.id,username:user.username,
            snapshot:'last_committed',online:[...gameRef?.room?.players?.values?.()||[]]
              .some(player=>player.accountId===accountId),
            clan:user.clan?.tag||null,
            age:Number(p.age)||1,xp:Number(p.xp)||0,
            resources:Object.fromEntries(['wood','stone','food','points','kills']
              .map(key=>[key,Number(resources[key])||0])),
            ownedWeapons:Array.isArray(p.inventory?.weapons)?p.inventory.weapons:[],
            buildingCount:Array.isArray(p.structures)?p.structures.length:0});
        }
        if(req.method==='POST'&&pathname==='/api/account/logout'){
          await playerTokens.revoke(token);
          gameRef?.disconnectAccount?.(accountId);
          return respond(res,200,{ok:true});
        }
        return respond(res,404,{error:'not_found'});
      }
      if (req.method === 'GET' && pathname === '/health') return respond(res, 200,
        { status: 'ok', version: '0.1.0', project: 'MooQuest-Own-Server' });
      if (req.method === 'GET' && pathname === '/ready'){
        const healthy=installed&&!stopStatus()&&
          (typeof auth.isHealthy!=='function'||auth.isHealthy())&&
          (typeof storage.isHealthy!=='function'||await storage.isHealthy());
        return respond(res,healthy?200:503,{ready:healthy});
      }
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
        await storage.audit('installation', { owner: body.username });
        auth.setupCode = null;
        const session = await auth.issue();
        res.setHeader('Set-Cookie', cookieHeader(session.token, httpsCookies));
        return redirect(res, '/admin');
      }
      if (req.method === 'GET' && (pathname === '/admin/login' || pathname === '/login')) {
        return logged ? redirect(res, '/admin') : page(res, publicDir, 'login.html');
      }
      if (req.method === 'POST' && pathname === '/admin/login') {
        if (!installed) return redirect(res, '/setup');
        const ip = rateKey(req);
        if (await auth.loginBlocked(ip)) return respond(res, 429, { error: 'too_many_attempts' });
        const body = await readBody(req);
        if (body.username !== storage.data.owner.username ||
            !passwordMatches(body.password, storage.data.owner.password)) {
          await auth.recordFailure(ip);
          return respond(res, 401, { error: 'invalid_login' });
        }
        await auth.clearFailure(ip);
        const session = await auth.issue();
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
          await storage.audit('settings_changed');
          if (gameRef) gameRef.room.maxPlayers = storage.data.settings.maxPlayers;
          return respond(res, 200, storage.data.settings);
        }
        if (req.method === 'POST' && pathname === '/api/admin/announce') {
          const body = await readBody(req);
          if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 240) return respond(res, 400, {error:'invalid_message'});
          storage.data.announcements.push({ message: body.message.trim(), at: new Date().toISOString() });
          if (storage.data.announcements.length > 100) storage.data.announcements.shift();
          await storage.audit('announcement_sent');
          gameRef?.announce(body.message.trim());
          return respond(res, 200, { ok: true });
        }
        if (req.method === 'POST' && pathname === '/api/admin/players/kick') {
          const body = await readBody(req);
          if (typeof body.id !== 'string' || !gameRef?.kick(body.id)) return respond(res, 404, { error: 'unknown_player' });
          await storage.audit('player_kicked', { playerId: body.id });
          return respond(res, 200, { ok: true });
        }
        if (req.method === 'POST' && pathname === '/api/admin/players/ban') {
          const body = await readBody(req);
          if (typeof body.id !== 'string' || !players.some(p => p.id === body.id)) return respond(res, 404, { error: 'unknown_player' });
          const target = players.find(p => p.id === body.id);
          if (!target.ipHash || !target.trustedOrigin) return respond(res, 400, { error: 'configure_reverse_proxy_identity' });
          storage.data.bans[target.ipHash] = { at: new Date().toISOString(), reason: String(body.reason || 'admin').slice(0, 80) };
          gameRef?.kick(body.id, 'banned');
          await storage.audit('player_banned', { playerId: body.id });
          return respond(res, 200, { ok: true });
        }
        if (req.method === 'POST' && pathname === '/api/admin/updates/check') return respond(res, 200, await updates.check());
        if (req.method === 'POST' && pathname === '/api/admin/updates/stage') return respond(res, 200, await updates.stage());
        if (req.method === 'POST' && pathname === '/api/admin/updates/activate') {
          const value = updates.activate(); await storage.audit('update_activated', { version: value.active });
          return respond(res, 200, { ...value, requiresAaPanelRestart: true });
        }
        if (req.method === 'POST' && pathname === '/api/admin/updates/rollback') {
          const value = updates.rollback(); await storage.audit('update_rollback', { version: value.active });
          return respond(res, 200, { ...value, requiresAaPanelRestart: true });
        }
        if (req.method === 'POST' && pathname === '/admin/logout') {
          await auth.revoke(cookieToken(req));
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
  // Limit slow HTTP clients; WebSocket upgrades use their own transport.
  server.requestTimeout=30_000;
  server.headersTimeout=15_000;
  server.keepAliveTimeout=5_000;
  return { server, setGame: value => { gameRef = value; } };
}
