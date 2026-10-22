// Public reachability probe of the /s/LC WebSocket upgrade path.
// No real credentials or valid tickets. One deliberately invalid token
// proves whether a reverse proxy returns HTTP (403/404/502), or the Node
// game closes the connection before upgrade (expected for an invalid ticket).
import tls from 'node:tls';
import {randomBytes} from 'node:crypto';

function probe({hostname='app.snusnu.com.br',port=443,timeout=8000}={}){
  return new Promise(resolve=>{
    let settled=false;
    let received=Buffer.alloc(0),tlsOk=false;
    const socket=tls.connect({
      host:hostname,port,servername:hostname,ALPNProtocols:['http/1.1'],
      rejectUnauthorized:true,minVersion:'TLSv1.2'
    });
    function end(result){
      if(settled)return;
      settled=true;
      socket.destroy();
      resolve(result);
    }
    socket.setTimeout(timeout,()=>end({state:'timeout',tlsOk}));
    socket.once('secureConnect',()=>{
      tlsOk=socket.authorized;
      if(!tlsOk)return end({state:'tls_untrusted'});
      const challenge=randomBytes(16).toString('base64');
      const invalidTicket='0'.repeat(36);
      socket.write([
        'GET /s/LC?b=mqv2native&token=tk:'+invalidTicket+' HTTP/1.1',
        'Host: '+hostname,
        'Connection: Upgrade',
        'Upgrade: websocket',
        'Sec-WebSocket-Version: 13',
        'Sec-WebSocket-Key: '+challenge,
        'Origin: https://'+hostname,
        'User-Agent: MooQuest-Diagnostic-InvalidTicket',
        '',''
      ].join('\r\n'));
    });
    socket.on('data',chunk=>{
      received=Buffer.concat([received,chunk]);
      if(received.length>4096)return end({state:'oversized_http_response',tlsOk});
      const firstLine=received.toString('latin1').split('\r\n',1)[0];
      if(!firstLine.startsWith('HTTP/'))return end({state:'not_http',tlsOk});
      const match=/^HTTP\/1\.[01] (\d{3}) /.exec(firstLine);
      if(match){
        const status=Number(match[1]);
        if(status===101)return end({state:'security_failure_invalid_ticket_accepted',status,tlsOk});
        return end({state:'upstream_http_rejection',status,tlsOk});
      }
    });
    socket.once('end',()=>end({
      state:received.length?'closed_with_http_fragment':'closed_without_http_response',tlsOk
    }));
    socket.once('close',()=>end({
      state:received.length?'closed_with_http_fragment':'closed_without_http_response',tlsOk
    }));
    socket.once('error',error=>end({
      state:'socket_error',reason:String(error.code||error.name||'Error').slice(0,40),tlsOk
    }));
  });
}
const outcome=await probe();
console.log('V2_PUBLIC_WS_PROBE '+JSON.stringify(outcome));
if(outcome.state==='security_failure_invalid_ticket_accepted' ||
   outcome.state==='tls_untrusted')process.exitCode=1;
