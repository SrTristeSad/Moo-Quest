import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';

export function passwordHash(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    throw new Error('A senha deve ter de 12 a 128 caracteres.');
  }
  const salt = randomBytes(16).toString('hex');
  return 'scrypt$' + salt + '$' + scryptSync(password, salt, 64).toString('hex');
}
export function passwordMatches(password, encoded) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const parts = String(encoded || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt' || !/^[0-9a-f]{32}$/.test(parts[1]) ||
      !/^[0-9a-f]{128}$/.test(parts[2])) return false;
  const expected = Buffer.from(parts[2], 'hex');
  return timingSafeEqual(scryptSync(password, parts[1], 64), expected);
}
const digest = token => createHash('sha256').update(token).digest('hex');
export class Auth {
  constructor() {
    this.sessions = new Map();
    this.failures = new Map();
    this.setupCode = String(randomInt(100000, 1000000));
    // Setup code is output in terminal only, never in web content or the API.
    this.setupAttempts = 0;
  }
  loginBlocked(key) {
    const record = this.failures.get(key);
    if (!record || record.until < Date.now()) { this.failures.delete(key); return false; }
    return record.count >= 5;
  }
  recordFailure(key) {
    const now = Date.now();
    const old = this.failures.get(key);
    const record = old && old.until > now ? old : { count: 0, until: now + 10 * 60_000 };
    record.count++;
    this.failures.set(key, record);
  }
  issue() {
    const token = randomBytes(32).toString('hex');
    const csrf = randomBytes(24).toString('hex');
    this.sessions.set(digest(token), { csrf, expires: Date.now() + 8 * 3600_000 });
    return { token, csrf };
  }
  get(token) {
    if (!/^[0-9a-f]{64}$/.test(token || '')) return null;
    const key = digest(token);
    const session = this.sessions.get(key);
    if (!session || session.expires < Date.now()) { this.sessions.delete(key); return null; }
    return session;
  }
  revoke(token) { if (token) this.sessions.delete(digest(token)); }
  clearFailure(key){this.failures.delete(key);}
  sameCsrf(session, supplied) {
    if (!session || typeof supplied !== 'string') return false;
    const a = Buffer.from(session.csrf), b = Buffer.from(supplied);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
export function cookieToken(req) {
  const match = /(?:^|;\s*)mq_admin=([0-9a-f]{64})(?=;|$)/.exec(req.headers.cookie || '');
  return match?.[1] || '';
}
export function cookieHeader(token, secure = false) {
  return `mq_admin=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${secure ? '; Secure' : ''}`;
}
