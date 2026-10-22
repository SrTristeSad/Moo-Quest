import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import https from 'node:https';
import net from 'node:net';
import { createSecureRelay } from './v2-https-relay.mjs';

function certificate(t){
  const directory=mkdtempSync(join(tmpdir(),'mooquest-relay-'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const key=join(directory,'key.pem'),cert=join(directory,'cert.pem');
  const openssl=spawnSync('openssl',['req','-x509','-nodes','-newkey','rsa:2048',
    '-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost',
    '-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{encoding:'utf8'});
  assert.equal(openssl.status,0,openssl.stderr);
  return {key:readFileSync(key),ca:readFileSync(cert)};
}
async function listen(server){
  return await new Promise((ok,fail)=>{
    server.once('error',fail);
    server.listen(0,'::',()=>{server.off('error',fail);ok(server.address().port);});
  });
}
async function stop(server){
  server.closeAllConnections?.();
  await new Promise(resolve=>server.close(resolve));
}
function raw(port,request){
  return new Promise((resolve,reject)=>{
    const socket=net.connect(port,'127.0.0.1',()=>socket.write(request));
    socket.setTimeout(4000,()=>socket.destroy(Error('timeout')));
    const chunks=[];
    socket.on('data',buffer=>chunks.push(buffer));
    socket.once('end',()=>resolve(Buffer.concat(chunks).toString('latin1')));
    socket.once('error',reject);
  });
}
test('TLS relay transports remote account API and WebSocket upgrade',async t=>{
  const {key,ca}=certificate(t);
  const requests=[];
  const secure=https.createServer({key,cert:ca},(req,res)=>{
    let body='';
    req.on('data',x=>body+=x);
    req.on('end',()=>{
      requests.push({method:req.method,url:req.url,host:req.headers.host,
        authorization:req.headers.authorization,
        te:req.headers.te,connection:req.headers.connection,body});
      res.setHeader('Content-Type','application/json');
      res.setHeader('Connection','close');
      res.end(JSON.stringify(req.url==='/ping'?{status:'ok',build:'mqv2native'}:
        {token:'test-account-token'}));
    });
  });
  secure.on('upgrade',(req,socket)=>{
    requests.push({upgrade:true,host:req.headers.host,origin:req.headers.origin,url:req.url});
    socket.end('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');
  });
  const port=await listen(secure);
  const relay=createSecureRelay({remoteHost:'localhost',remotePort:port,listenPort:0,ca});
  const local=(await relay.listen()).port;
  t.after(async()=>{await relay.close();await stop(secure);});
  const ping=await raw(local,'GET /ping HTTP/1.1\r\nHost: 127.0.0.1:8080\r\nConnection: close\r\n\r\n');
  assert.match(ping,/200 OK/);
  assert.match(ping,/mqv2native/);
  assert.equal(requests[0].host,'localhost:'+port);

  const credentials='{"username":"Tester","password":"top-secret-pass"}';
  const request='POST /api/account/login HTTP/1.1\r\nHost: 127.0.0.1:8080\r\n'
    +'Authorization: Bearer aabbcc\r\nContent-Type: application/json\r\nContent-Length: '
    +Buffer.byteLength(credentials)+'\r\nConnection: close\r\n\r\n'+credentials;
  const response=await raw(local,request);
  assert.match(response,/200 OK/);
  assert.equal(requests[1].authorization,'Bearer aabbcc');
  assert.equal(requests[1].body,credentials);

  // LuaSocket's default request headers include TE: trailers, including
  // account POST, /api/capabilities GET and the initial /ping GET.
  // Before this regression fix the relay denied ALL such requests with
  // HTTP 403 and Content-Length: 0, while Node's fetch /ping still passed.
  const luaDefault='POST /api/account/register HTTP/1.1\r\n'
    +'Host: 127.0.0.1:8080\r\n'
    +'User-Agent: LuaSocket 3.0-rc1\r\n'
    +'Connection: close, TE\r\n'
    +'TE: trailers\r\n'
    +'Accept: application/json\r\n'
    +'Accept-Encoding: identity\r\n'
    +'Content-Type: application/json\r\n'
    +'Content-Length: '+Buffer.byteLength(credentials)+'\r\n\r\n'+credentials;
  const luaResponse=await raw(local,luaDefault);
  assert.match(luaResponse,/200 OK/);
  assert.equal(requests[2].url,'/api/account/register');
  assert.equal(requests[2].body,credentials);
  assert.equal(requests[2].te,undefined,'TE is hop-by-hop and must not reach remote HTTPS');
  const luaPing=await raw(local,'GET /api/capabilities HTTP/1.1\r\n'
    +'Host: 127.0.0.1:8080\r\nConnection: close, TE\r\n'
    +'TE: trailers\r\n\r\n');
  assert.match(luaPing,/200 OK/);
  assert.equal(requests[3].te,undefined);
  assert.equal(requests[3].url,'/api/capabilities');

  const ws=await raw(local,'GET /s/LC?b=mqv2native&token=tk:abababab HTTP/1.1\r\n'
    +'Host: 127.0.0.1:8080\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
    +'Origin: http://127.0.0.1:8080\r\nSec-WebSocket-Key: SGVsbG8xMjM0NTY3ODkwIQ==\r\n'
    +'Sec-WebSocket-Version: 13\r\n\r\n');
  assert.match(ws,/101 Switching Protocols/);
  assert.equal(requests[4].origin,'https://localhost:'+port);
  assert.equal(requests[4].host,'localhost:'+port);
  assert.match(requests[4].url,/token=tk:abababab/);
});
test('relay blocks forbidden HTTP routes and rejects untrusted remote TLS',async t=>{
  const {key,ca}=certificate(t);
  let reached=0;
  const secure=https.createServer({key,cert:ca},(req,res)=>{
    reached++;res.setHeader('Connection','close');res.end('test');
  });
  const port=await listen(secure);
  const relay=createSecureRelay({remoteHost:'localhost',remotePort:port,listenPort:0});
  const local=(await relay.listen()).port;
  t.after(async()=>{await relay.close();await stop(secure);});
  const denied=await raw(local,'GET /private/.env HTTP/1.1\r\nHost: localhost:8080\r\nConnection: close\r\n\r\n');
  assert.match(denied,/403 Local relay request denied/);
  assert.equal(reached,0);
  const deniedHeader=await raw(local,'GET /ping HTTP/1.1\r\nHost: localhost:8080\r\n'
    +'X-Forwarded-For: 1.2.3.4\r\nConnection: close\r\n\r\n');
  assert.match(deniedHeader,/403 Local relay request denied/);
  assert.equal(reached,0);
  const badTe=await raw(local,'GET /ping HTTP/1.1\r\nHost: localhost:8080\r\n'
    +'TE: gzip\r\nConnection: close\r\n\r\n');
  assert.match(badTe,/403 Local relay request denied/);
  const forgedTransfer=await raw(local,'POST /api/account/login HTTP/1.1\r\n'
    +'Host: localhost:8080\r\nTransfer-Encoding: chunked\r\n'
    +'Connection: close\r\n\r\n');
  assert.match(forgedTransfer,/403 Local relay request denied/);
  assert.equal(reached,0);
  const forgedOrigin=await raw(local,'GET /s/LC?b=mqv2native&token=tk:abababab HTTP/1.1\r\n'
    +'Host: 127.0.0.1:8080\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
    +'Origin: https://malicious.example\r\nSec-WebSocket-Key: SGVsbG8xMjM0NTY3ODkwIQ==\r\n'
    +'Sec-WebSocket-Version: 13\r\n\r\n');
  assert.match(forgedOrigin,/403 Local relay request denied/);
  assert.equal(reached,0);
  const tlsError=await raw(local,'GET /ping HTTP/1.1\r\nHost: localhost:8080\r\nConnection: close\r\n\r\n');
  assert.match(tlsError,/502 TLS connection failed/);
  assert.equal(reached,0,'server routes must never receive credentials before TLS verification');
});
test('relay cannot listen on a public interface',()=>{
  assert.throws(()=>createSecureRelay({listenHost:'0.0.0.0'}),/127.0.0.1/);
  assert.throws(()=>createSecureRelay({remoteHost:'https://example.org'}),/Invalid pinned/);
});
