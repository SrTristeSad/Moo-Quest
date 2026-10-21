// Resolve the caller identity consistently for HTTP and WebSocket ingress.
// A proxy header is trusted only when explicitly enabled AND supplied by
// the local reverse proxy; direct client-supplied X-Real-IP is ignored.
import { isIP } from 'node:net';

export function requestIdentity(req){
  const peer=req.socket.remoteAddress||'unknown';
  const loopback=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer);
  const fromProxy=process.env.MOO_TRUST_PROXY==='1'&&loopback;
  const header=fromProxy?String(req.headers['x-real-ip']||''):'';
  const forwarded=header&&isIP(header)?header:null;
  return {
    address:forwarded||peer,
    trustedOrigin:!fromProxy||Boolean(forwarded)
  };
}
