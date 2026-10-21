// Independently implemented binary transport for interoperability with the
// existing Moo-Quest Lua client. Public MessagePack/HMAC formats, no upstream
// game engine, assets, client-side obfuscation or browser attestation code.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const REQUEST_NAMES = ['M','D','9','e','F','z','H','K','L','N','b','P','Q','c','6','S','0'];
const RESPONSE_NAMES = ['A','B','C','D','E','a','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','X','Y','Z','g','1','2','3','4','5','6','7','8','9','0'];
const UINT = 0x100000000;
function tableFor(names, seed) {
  let state = seed >>> 0;
  function random() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / UINT;
  }
  const numbers = names.map((_, i) => i);
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }
  const forward = new Map(), reverse = new Map();
  for (let i=0; i<names.length; i++) {
    forward.set(names[i], numbers[i]); reverse.set(numbers[i], names[i]);
  }
  return { forward, reverse };
}

// Bounded MessagePack subset: nil, booleans, 32-bit signed/unsigned integers,
// IEEE-754 doubles, UTF-8 strings, arrays and string-keyed objects.
// No extension types, arbitrary deserialization, prototypes or functions.
export function pack(value) {
  const parts=[];
  function put(v,depth) {
    if(depth>20) throw new Error('msgpack depth');
    if(v==null) { parts.push(Buffer.from([0xc0])); return; }
    if(typeof v==='boolean') { parts.push(Buffer.from([v?0xc3:0xc2])); return; }
    if(typeof v==='number') {
      if(!Number.isFinite(v)) throw new Error('nonfinite msgpack number');
      if(Number.isInteger(v) && v>=0 && v<128) { parts.push(Buffer.from([v])); return; }
      if(Number.isInteger(v) && v>=-32 && v<0) {parts.push(Buffer.from([v+256]));return;}
      if(Number.isInteger(v) && v>=0 && v<=0xffffffff) {
        const b=Buffer.alloc(5);b[0]=0xce;b.writeUInt32BE(v,1);parts.push(b);return;
      }
      if(Number.isInteger(v) && v>=-0x80000000 && v<0) {
        const b=Buffer.alloc(5);b[0]=0xd2;b.writeInt32BE(v,1);parts.push(b);return;
      }
      const b=Buffer.alloc(9);b[0]=0xcb;b.writeDoubleBE(v,1);parts.push(b);return;
    }
    if(typeof v==='string') {
      const data=Buffer.from(v,'utf8'),size=data.length;
      if(size>65535) throw new Error('msgpack string too long');
      if(size<32) parts.push(Buffer.from([0xa0|size]));
      else if(size<=255)parts.push(Buffer.from([0xd9,size]));
      else {const header=Buffer.alloc(3);header[0]=0xda;header.writeUInt16BE(size,1);parts.push(header);}
      parts.push(data);return;
    }
    if(Array.isArray(v)) {
      if(v.length>65535)throw new Error('array too large');
      if(v.length<16)parts.push(Buffer.from([0x90|v.length]));
      else {const h=Buffer.alloc(3);h[0]=0xdc;h.writeUInt16BE(v.length,1);parts.push(h);}
      for(const element of v)put(element,depth+1);return;
    }
    if(typeof v==='object' && Object.getPrototypeOf(v)===Object.prototype){
      const entries=Object.entries(v);
      if(entries.length>65535)throw new Error('map too large');
      if(entries.length<16)parts.push(Buffer.from([0x80|entries.length]));
      else {const h=Buffer.alloc(3);h[0]=0xde;h.writeUInt16BE(entries.length,1);parts.push(h);}
      for(const [k,x] of entries){put(k,depth+1);put(x,depth+1);}return;
    }
    throw new Error('unsupported msgpack value');
  }
  put(value,0);return Buffer.concat(parts);
}
export function unpack(raw) {
  const b=Buffer.from(raw);if(b.length>65536)throw new Error('oversized frame');
  let at=0;
  function need(n){if(at+n>b.length)throw new Error('truncated MessagePack');const offset=at;at+=n;return offset;}
  function read(depth){
    if(depth>20)throw new Error('msgpack depth');
    const op=b[need(1)];
    if(op<=0x7f)return op;if(op>=0xe0)return op-256;
    if((op&0xe0)===0xa0)return b.subarray(need(op&31),at).toString('utf8');
    if(op>=0x90&&op<=0x9f)return array(op&15,depth);
    if(op>=0x80&&op<=0x8f)return map(op&15,depth);
    switch(op){
      case 0xc0:return null;case 0xc2:return false;case 0xc3:return true;
      case 0xcc:return b.readUInt8(need(1));case 0xcd:return b.readUInt16BE(need(2));
      case 0xce:return b.readUInt32BE(need(4));
      case 0xd0:return b.readInt8(need(1));case 0xd1:return b.readInt16BE(need(2));
      case 0xd2:return b.readInt32BE(need(4));
      case 0xcb:return b.readDoubleBE(need(8));
      case 0xd9:return b.subarray(need(b[need(1)]),at).toString('utf8');
      case 0xda:return b.subarray(need(b.readUInt16BE(need(2))),at).toString('utf8');
      case 0xdb:return b.subarray(need(b.readUInt32BE(need(4))),at).toString('utf8');
      case 0xdc:return array(b.readUInt16BE(need(2)),depth);
      case 0xde:return map(b.readUInt16BE(need(2)),depth);
      default:throw new Error(`unknown MessagePack tag ${op}`);
    }
  }
  function array(n,depth){if(n>8192)throw new Error('array bound');const a=[];for(let i=0;i<n;i++)a.push(read(depth+1));return a;}
  function map(n,depth){if(n>512)throw new Error('map bound');const o=Object.create(null);for(let i=0;i<n;i++){const k=read(depth+1);if(typeof k!=='string'||!k||['__proto__','constructor','prototype'].includes(k))throw new Error('unsafe map key');o[k]=read(depth+1);}return o;}
  const result=read(0);if(at!==b.length)throw new Error('trailing MessagePack');return result;
}

export class NativeSession {
  constructor({ seed=randomBytes(4).readUInt32BE(0), key=randomBytes(16), socketId=randomBytes(8).toString('hex') }={}) {
    this.seed=seed>>>0;
    this.key=Buffer.from(key);
    if(this.key.length!==16 || !/^[0-9a-f]{16}$/.test(socketId))throw new Error('invalid native key');
    this.socketId=socketId;this.sequence=0;
    // Legacy unpinned mode is intentionally limited. No fake browser-seal
    // responses and no proprietary bootstrap build file are needed.
    // The Lua client derives the legacy table seed from the transport seed.
    const tableSeed=(this.seed^0x9e3779b1)>>>0;
    this.incoming=tableFor(REQUEST_NAMES,tableSeed);
    this.outgoing=tableFor(RESPONSE_NAMES,(tableSeed^0x85ebca6b)>>>0);
  }
  handshake(){return pack(['io-init',[this.socketId,this.seed,this.key.toString('hex'),1,0,0]]);}
  encode(name,args=[]){
    const id=this.outgoing.forward.get(name);
    if(id===undefined || !Array.isArray(args)||args.length>16)throw new Error('unsupported native packet');
    return pack([id,args]);
  }
  decode(bytes) {
    const frame=Buffer.from(bytes);
    if(frame.length<7||frame.length>2048)throw new Error('packet length');
    const tag=frame.subarray(0,6),body=frame.subarray(6);
    const wanted=createHmac('sha256',this.key).update(body).digest().subarray(0,6);
    if(!timingSafeEqual(tag,wanted))throw new Error('bad packet MAC');
    const data=unpack(body);
    if(!Array.isArray(data)||data.length!==3||!Number.isInteger(data[0])||!Array.isArray(data[1])||data[1].length>16||data[2]!==this.sequence+1) throw new Error('malformed packet sequence');
    const name=this.incoming.reverse.get(data[0]);
    if(!name)throw new Error('unknown native packet');
    this.sequence=data[2];
    return {name,args:data[1]};
  }
  // Strictly for cross-implementation tests: constructs a client->server frame.
  makeTestRequest(name,args=[],sequence=this.sequence+1){
    const id=this.incoming.forward.get(name);
    if(id===undefined)throw new Error('unknown test packet');
    const body=pack([id,args,sequence]);
    return Buffer.concat([createHmac('sha256',this.key).update(body).digest().subarray(0,6),body]);
  }
}
export const NATIVE_VERSION='mq-v2-native-compat-1';
