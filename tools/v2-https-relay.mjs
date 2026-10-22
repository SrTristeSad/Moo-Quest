// Moo-Quest V2 Windows TLS bridge.
// The Lua client speaks HTTP/ws ONLY to 127.0.0.1. This process enforces
// verified HTTPS/WSS for every byte sent to the pinned game domain.
// It never persists or logs credentials, access/refresh tokens or join tickets.
import net from 'node:net';
import tls from 'node:tls';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const MAX_HEADER=16384;
const HEAD_TIMEOUT=8000;
const TLS_TIMEOUT=10000;
const MAX_CONNECTIONS=64;
const ALLOWED=[
  /^\/ping$/,
  /^\/api\/(?:status|capabilities|join)$/,
  /^\/api\/account\/[a-z0-9-]+$/,
  /^\/s\/LC(?:\?[^ \r\n]{0,768})?$/
];
function bad(socket,status,text){
  if(socket.destroyed)return;
  socket.end('HTTP/1.1 '+status+' '+text+'\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
}
function parsedRequest(header,remoteHost,remotePort){
  const lines=header.toString('latin1').split('\r\n');
  const line=/^(GET|POST) (\/[^ ]*) HTTP\/1\.1$/.exec(lines.shift()||'');
  if(!line||!ALLOWED.some(test=>test.test(line[2])))return null;
  const route=line[2],websocket=route.startsWith('/s/LC');
  if(websocket&&(line[1]!=='GET'||!route.includes('?')))return null;
  if(!websocket&&route.startsWith('/api/account/')&& !['GET','POST'].includes(line[1]))return null;
  const headers=[];let hosts=0,origins=0,authorization=0;
  let localOrigin=null;
  for(const item of lines){
    if(item==='')continue;
    const found=/^([A-Za-z][A-Za-z0-9-]*):[ \t]*(.*)$/.exec(item);
    if(!found||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(found[2]))return null;
    const [whole,name,value]=found,key=name.toLowerCase();
    if(key==='host'){hosts++;continue;}
    if(key==='origin'){origins++;localOrigin=value;continue;}
    if(key==='authorization')authorization++;
    // LuaSocket adds "TE: trailers" to all HTTP/1.1 requests by default,
    // even when the caller sets Connection: close. TE is hop-by-hop, so
    // accept exactly that harmless default and STRIP it before forwarding.
    // Other TE values and the Transfer-Encoding/Trailer headers stay denied.
    if(key==='te'){
      if(websocket||value.trim().toLowerCase()!=='trailers')return null;
      continue;
    }
    if(key==='connection'&&!websocket){
      // Node's built-in fetch uses keep-alive, while LuaSocket uses
      // close or close, TE. Each request gets its own TLS connection:
      // normalize these harmless variants to Connection: close.
      if(!/^(?:close|keep-alive)(?:,\s*te)?$/i.test(value.trim()))return null;
      headers.push('Connection: close');
      continue;
    }
    if(['proxy-authorization','proxy-connection','forwarded','x-forwarded-for',
      'x-forwarded-host','x-forwarded-proto','x-real-ip','transfer-encoding',
      'content-encoding','expect','trailer'].includes(key))return null;
    if(!websocket&&['upgrade','sec-websocket-key','sec-websocket-version'].includes(key))
      return null;
    if(websocket&&key==='content-length')return null;
    headers.push(name+': '+value);
  }
  if(hosts!==1||origins>1||authorization>1)return null;
  // Web browsers cannot forge Origin: do not let a local web page use the
  // relay to bypass the remote server's cross-site WebSocket safeguards.
  const allowedLocalOrigin=['http://127.0.0.1:8080','http://localhost:8080'];
  if(origins&& !allowedLocalOrigin.includes(localOrigin))return null;
  if(websocket&&origins!==1)return null;
  if(websocket&&!headers.some(h=>/^Upgrade:\s*websocket$/i.test(h)))return null;
  // LuaSocket uses a localhost Host/Origin. Never forward those headers to
  // the remote service: an exact HTTPS origin is required for WebSocket.
  const authority=remotePort===443?remoteHost:remoteHost+':'+remotePort;
  const out=[line[1]+' '+route+' HTTP/1.1','Host: '+authority,
    ...(websocket?['Origin: https://'+authority]:[]),...headers,'',''];
  return {header:Buffer.from(out.join('\r\n'),'latin1'),route,websocket};
}
export function createSecureRelay({
  remoteHost='app.snusnu.com.br',remotePort=443,
  listenPort=8080,listenHost='127.0.0.1',ca
}={}){
  if(!/^[a-z0-9.-]+$/i.test(remoteHost)||
     !Number.isInteger(remotePort)||remotePort<1||remotePort>65535)
    throw Error('Invalid pinned TLS destination');
  if(listenHost!=='127.0.0.1'||!Number.isInteger(listenPort)||
     listenPort<0||listenPort>65535)
    throw Error('Relay must be bound to 127.0.0.1 only');
  let count=0;
  const sockets=new Set();
  const server=net.createServer(client=>{
    if(++count>MAX_CONNECTIONS){count--;bad(client,503,'Busy');return;}
    sockets.add(client);
    let incoming=Buffer.alloc(0),started=false,upstream;
    client.setTimeout(HEAD_TIMEOUT);
    client.once('close',()=>{
      count--;sockets.delete(client);
      if(upstream&&!upstream.destroyed)upstream.destroy();
    });
    client.once('error',()=>{});
    client.on('timeout',()=>client.destroy());
    function start(request,remainder){
      started=true;
      client.setTimeout(0);
      upstream=tls.connect({
        host:remoteHost,port:remotePort,servername:remoteHost,
        rejectUnauthorized:true,minVersion:'TLSv1.2',
        ALPNProtocols:['http/1.1'],
        ...(ca?{ca}:{})
      });
      upstream.setTimeout(TLS_TIMEOUT);
      upstream.once('secureConnect',()=>{
        if(!upstream.authorized){
          bad(client,502,'TLS certificate rejected');
          upstream.destroy();return;
        }
        upstream.setTimeout(0);
        upstream.write(request.header);
        if(remainder.length)upstream.write(remainder);
        client.pipe(upstream);
        upstream.pipe(client);
      });
      upstream.on('error',()=>{
        // Deliberately do not leak tokens or the full requested URL.
        if(!client.destroyed)bad(client,502,'TLS connection failed');
        client.destroySoon?.();
      });
      upstream.on('timeout',()=>upstream.destroy(Error('TLS handshake timeout')));
      upstream.once('close',()=>{
        if(!client.destroyed)client.end();
      });
    }
    client.on('data',function read(chunk){
      if(started)return;
      incoming=Buffer.concat([incoming,chunk]);
      if(incoming.length>MAX_HEADER+65536){bad(client,431,'Request too large');return;}
      const pos=incoming.indexOf('\r\n\r\n');
      if(pos===-1){
        if(incoming.length>MAX_HEADER)bad(client,431,'Request header too large');
        return;
      }
      if(pos+4>MAX_HEADER){bad(client,431,'Request header too large');return;}
      const req=parsedRequest(incoming.subarray(0,pos+4),remoteHost,remotePort);
      if(!req){bad(client,403,'Local relay request denied');return;}
      client.off('data',read);
      // No request body/ticket reaches the network until secureConnect.
      // pipe() resumes the socket only after the TLS identity is verified.
      client.pause();
      start(req,incoming.subarray(pos+4));
    });
  });
  server.on('error',()=>{});
  return {
    server,
    async listen(){
      await new Promise((ok,fail)=>{
        server.once('error',fail);
        server.listen(listenPort,listenHost,()=>{
          server.off('error',fail);ok();
        });
      });
      return server.address();
    },
    async close(){
      for(const socket of sockets)socket.destroy();
      if(server.listening)await new Promise(ok=>server.close(ok));
    }
  };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const relay=createSecureRelay();
  process.on('SIGINT',()=>relay.close().then(()=>process.exit(0)));
  process.on('SIGTERM',()=>relay.close().then(()=>process.exit(0)));
  relay.listen().then(()=>{
    console.log('[MooQuest V2] Relay local 127.0.0.1:8080 -> https://app.snusnu.com.br:443');
    console.log('[MooQuest V2] TLS certificate verification: REQUIRED');
    console.log('[MooQuest V2] Ctrl+C para encerrar. Nenhuma credencial e impressa.');
  }).catch(err=>{
    console.error('[MooQuest V2] Nao foi possivel iniciar relay:',err.code||err.message);
    process.exitCode=1;
  });
}
