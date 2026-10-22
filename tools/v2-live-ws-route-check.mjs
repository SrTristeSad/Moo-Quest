// Check the public WebSocket route using a deliberately invalid ticket.
// Never use a real account, login, bearer token, or valid session ticket.
// A socket reset without HTTP status indicates that the request can reach
// the Node.js upgrade handler, which rejects unknown tickets by design.
import net from 'node:net';
import {randomBytes} from 'node:crypto';
import {createSecureRelay} from './v2-https-relay.mjs';

const bridge=createSecureRelay({listenPort:0});
let socket;
try{
  const addr=await bridge.listen();
  const status=await new Promise((resolve,reject)=>{
    socket=net.connect(addr.port,'127.0.0.1');
    socket.setTimeout(9000,()=>socket.destroy(Error('timeout')));
    let first='';
    socket.on('connect',()=>{
      const key=randomBytes(16).toString('base64');
      socket.write('GET /s/LC?b=mqv2native&token=tk:'+'0'.repeat(36)+
        ' HTTP/1.1\r\nHost: 127.0.0.1:8080\r\n'+
        'Upgrade: websocket\r\nConnection: Upgrade\r\n'+
        'Origin: http://127.0.0.1:8080\r\n'+
        'Sec-WebSocket-Key: '+key+'\r\n'+
        'Sec-WebSocket-Version: 13\r\n\r\n');
    });
    socket.on('data',chunk=>{
      first+=(chunk.toString('latin1')).slice(0,512);
      if(first.length>=11){socket.destroy();resolve(first.match(/^HTTP\/1\.[01] (\d{3})/)?.[1]||'non-http');}
    });
    socket.once('close',()=>resolve('socket-closed-without-status'));
    socket.once('error',err=>reject(err));
  });
  console.log('V2_WS_INVALID_TICKET_PROBE status='+status+
    ' (no credentials; 101 would be a SECURITY FAILURE)');
  if(status==='101')process.exitCode=1;
  if(['403','404','301','302','503'].includes(status))process.exitCode=2;
}catch(error){
  console.log('V2_WS_INVALID_TICKET_PROBE transport='+String(error.code||error.name||'error'));
  process.exitCode=3;
}finally{
  socket?.destroy();
  await bridge.close();
}
