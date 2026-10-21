// Native MooQuest V2 wire protocol: JSON messages over /play WebSocket.
// Explicitly NOT the copied MooMoo transport; existing Lua client requires
// a separately audited V2 protocol adapter in a future phase.
import { WebSocketServer } from 'ws';
import { createHmac, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { isIP } from 'node:net';
import { World } from './world.js';
export class GameServer {
  constructor(httpServer, storage) {
    this.storage = storage;
    const keyFile = path.join(storage.dir, 'mod-secret.key');
    if (!fs.existsSync(keyFile)) fs.writeFileSync(keyFile, randomBytes(32), { mode: 0o600, flag: 'wx' });
    this.banKey = fs.readFileSync(keyFile);
    this.room = new World({ maxPlayers: storage.data.settings.maxPlayers });
    this.wss = new WebSocketServer({ noServer: true, maxPayload: 2048, perMessageDeflate: false });
    this.online = new Map();
    this.loop = null;
    this.counter = 0;
    httpServer.on('upgrade', (req, socket, head) => {
      let location;
      try { location = new URL(req.url, 'http://localhost'); }
      catch { socket.destroy(); return; }
      if (location.pathname !== '/play' || this.storage.data.settings.maintenance ||
          this.room.players.size >= this.room.maxPlayers) { socket.destroy(); return; }
      const origin = req.headers.origin;
      if (origin) {
        try { if (new URL(origin).host !== req.headers.host) { socket.destroy(); return; } }
        catch { socket.destroy(); return; }
      }
      const peer = req.socket.remoteAddress || 'unknown';
      const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer);
      // aaPanel/Nginx must explicitly overwrite X-Real-IP. Ignore forwarded
      // headers from any non-loopback peer, even if a caller forges them.
      const forwarded = process.env.MOO_TRUST_PROXY === '1' && loopback ?
        String(req.headers['x-real-ip'] || '') : '';
      const address = forwarded && isIP(forwarded) ? forwarded : peer;
      const trustedOrigin = !(loopback && process.env.MOO_TRUST_PROXY === '1' && !isIP(forwarded));
      const ipHash = createHmac('sha256', this.banKey).update(address).digest('hex');
      if (this.storage.data.bans[ipHash]) { socket.destroy(); return; }
      this.wss.handleUpgrade(req, socket, head, ws => this.connect(ws, ipHash, trustedOrigin));
    });
  }
  connect(ws, ipHash, trustedOrigin) {
    let me = null;
    let messages = 0;
    let bucketAt = Date.now();
    ws.send(JSON.stringify({ kind: 'hello', protocol: 'mq-v2-alpha', tickRate: 30 }));
    ws.on('message', raw => {
      const now = Date.now();
      if (now - bucketAt > 1000) { bucketAt = now; messages = 0; }
      if (++messages > 30) { ws.close(1008, 'rate_limited'); return; }
      let payload;
      try { payload = JSON.parse(String(raw)); }
      catch { ws.close(1003, 'invalid_json'); return; }
      if (!payload || typeof payload !== 'object') return;
      if (payload.kind === 'join' && !me) {
        try {
          me = this.room.join(ws, payload.name);
          me.ipHash = ipHash;
          me.trustedOrigin = trustedOrigin;
          this.online.set(me.id, ws);
          ws.send(JSON.stringify({ kind: 'joined', id: me.id, x: me.x, y: me.y }));
        } catch { ws.close(1008, 'server_full'); }
      } else if (me && payload.kind === 'input') this.room.input(me.id, payload);
      else if (me && payload.kind === 'attack') this.room.attack(me.id);
    });
    ws.on('close', () => { if (me) { this.online.delete(me.id); this.room.leave(me.id); } });
    ws.on('error', () => {});
  }
  start() {
    if (this.loop) return;
    let last = Date.now();
    this.loop = setInterval(() => {
      const now = Date.now(); const dt = Math.min(0.1, (now - last) / 1000); last = now;
      this.room.tick(dt);
      this.counter++;
      if (this.counter % 3 !== 0) return;
      const world = JSON.stringify(this.room.snapshot());
      const events = JSON.stringify({ kind: 'events', list: this.room.takeEvents() });
      for (const ws of this.online.values()) {
        if (ws.readyState !== ws.OPEN) continue;
        if (ws.bufferedAmount > 512_000) { ws.terminate(); continue; }
        ws.send(world); ws.send(events);
      }
    }, 1000 / 30);
  }
  announce(message) {
    const text = JSON.stringify({ kind: 'announcement', message: String(message).slice(0, 240) });
    for (const ws of this.online.values()) if (ws.readyState === ws.OPEN) ws.send(text);
  }
  kick(id, reason = 'admin') { const ws = this.online.get(id); if (!ws) return false; ws.close(1008, String(reason).slice(0, 100)); return true; }
  async stop() {
    clearInterval(this.loop); this.loop = null;
    for (const ws of this.wss.clients) ws.terminate();
    await new Promise(resolve => this.wss.close(() => resolve()));
  }
}
