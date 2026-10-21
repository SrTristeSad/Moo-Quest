// Independent, original server-authoritative arena simulation (alpha).
import { randomUUID, randomInt } from 'node:crypto';
export class World {
  constructor({ size = 4096, maxPlayers = 60, now = () => Date.now() } = {}) {
    this.size = size;
    this.maxPlayers = maxPlayers;
    this.now = now;
    this.players = new Map();
    this.events = [];
    this.tickNumber = 0;
  }
  join(socket, name) {
    if (this.players.size >= this.maxPlayers) throw new Error('server_full');
    const player = {
      id: randomUUID(), name: String(name || 'Visitante').replace(/[^\p{L}\p{N}_ -]/gu, '').slice(0, 18) || 'Visitante',
      x: randomInt(180, this.size - 180), y: randomInt(180, this.size - 180),
      hp: 100, vx: 0, vy: 0, lastAttack: 0, deadUntil: 0, socket, ipHash: null
    };
    this.players.set(player.id, player);
    this.events.push({ kind: 'join', id: player.id, name: player.name });
    return player;
  }
  leave(id) {
    if (this.players.delete(id)) this.events.push({ kind: 'leave', id });
  }
  input(id, value) {
    const p = this.players.get(id);
    if (!p || p.hp <= 0 || !value || typeof value !== 'object') return false;
    const dx = Number(value.dx), dy = Number(value.dy);
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > 1 || Math.abs(dy) > 1) return false;
    const length = Math.hypot(dx, dy);
    p.vx = length > 1 ? dx / length : dx;
    p.vy = length > 1 ? dy / length : dy;
    return true;
  }
  attack(id) {
    const p = this.players.get(id);
    const now = this.now();
    if (!p || p.hp <= 0 || now - p.lastAttack < 500) return false;
    p.lastAttack = now;
    let victim = null, distance = 85;
    for (const other of this.players.values()) {
      if (other.id === p.id || other.hp <= 0 || now < other.deadUntil) continue;
      const d = Math.hypot(other.x - p.x, other.y - p.y);
      if (d < distance) { victim = other; distance = d; }
    }
    if (victim) {
      victim.hp = Math.max(0, victim.hp - 15);
      this.events.push({ kind: 'hit', from: p.id, to: victim.id, damage: 15, hp: victim.hp });
      if (victim.hp === 0) {
        victim.deadUntil = now + 3000;
        victim.vx = 0; victim.vy = 0;
        this.events.push({ kind: 'death', id: victim.id });
      }
    }
    return true;
  }
  tick(dt) {
    const step = Math.min(0.10, Math.max(0, dt));
    const now = this.now();
    for (const p of this.players.values()) {
      if (p.hp === 0 && p.deadUntil && now >= p.deadUntil) {
        p.hp = 100; p.deadUntil = 0;
        p.x = randomInt(180, this.size - 180); p.y = randomInt(180, this.size - 180);
        this.events.push({ kind: 'respawn', id: p.id, x: p.x, y: p.y });
      }
      if (p.hp > 0) {
        p.x = Math.max(24, Math.min(this.size - 24, p.x + p.vx * 250 * step));
        p.y = Math.max(24, Math.min(this.size - 24, p.y + p.vy * 250 * step));
      }
    }
    this.tickNumber++;
  }
  snapshot() {
    return { kind: 'world', tick: this.tickNumber, size: this.size,
      players: [...this.players.values()].map(p => ({ id: p.id, name: p.name,
        x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, hp: p.hp })) };
  }
  takeEvents() { return this.events.splice(0); }
}
