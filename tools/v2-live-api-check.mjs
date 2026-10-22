// Safe public contract probe. Sends NO usernames, passwords or account tokens.
// Requests with '{}' cannot create an account or authenticate a player.
// Logs only status, media type and allowlisted machine-readable error keys.
import { createSecureRelay } from './v2-https-relay.mjs';

const bridge=createSecureRelay({listenPort:0});
let failures=0;
try{
  const addr=await bridge.listen();
  const endpoints=[
    {path:'/ping',method:'GET'},
    {path:'/api/capabilities',method:'GET'},
    {path:'/api/status',method:'GET'},
    {path:'/api/account/register',method:'POST',body:'{}',label:'LuaSocket'},
    {path:'/api/account/register',method:'POST',body:'{}',label:'Browser',agent:'Mozilla/5.0'},
    {path:'/api/account/login',method:'POST',body:'{}',label:'LuaSocket'},
    {path:'/api/join',method:'POST',body:'{}',label:'LuaSocket'},
    {path:'/api/account/login',method:'GET',label:'LuaSocket'}
  ];
  for(const test of endpoints){
    try{
      const res=await fetch('http://127.0.0.1:'+addr.port+test.path,{
        method:test.method,body:test.body,redirect:'manual',
        signal:AbortSignal.timeout(10000),
        headers:{
          'Accept':'application/json','Accept-Encoding':'identity',
          'User-Agent':test.agent||'LuaSocket 3.0-rc1',
          ...(test.body?{'Content-Type':'application/json'}:{})
        }
      });
      const media=(res.headers.get('content-type')||'missing').split(';')[0];
      const encoding=res.headers.get('content-encoding')||'identity';
      const server=(res.headers.get('server')||'unknown').replace(/[^a-z0-9./ -]/gi,'').slice(0,60);
      const proxy=(res.headers.has('cf-ray')?'cloudflare':'unspecified');
      let parsed=false,errorKey=null,pageType='none';
      const body=await res.text();
      try{
        const data=JSON.parse(body);
        parsed=!!data&&typeof data==='object'&&!Array.isArray(data);
        errorKey=typeof data.error==='string'&&/^[a-z0-9_]{1,80}$/.test(data.error)?
          data.error:null;
        if(test.path==='/ping'&&data.build!=='mqv2native')failures++;
      }catch{
        // Only label recognized public error-template signatures. Never
        // log full HTML responses, cookies, credentials or opaque tokens.
        if(/\/cdn-cgi\/challenge-platform|cf-mitigated|Just a moment/i.test(body))
          pageType='cloudflare_challenge';
        else if(/Cloudflare Ray ID|Attention Required!.*Cloudflare|Sorry, you have been blocked/i.test(body))
          pageType='cloudflare_block';
        else if(/nginx\/\d|<title>403 Forbidden<\/title>/i.test(body))
          pageType='generic_403';
        else pageType=body.trim()?'unknown_nonjson':'empty';
      }
      const redir=[301,302,303,307,308].includes(res.status);
      if(!parsed||redir||!media.includes('json'))failures++;
      console.log('V2_PUBLIC_PROBE '+test.method+' '+test.path+
        ' agent='+(test.label||'LuaSocket')+
        ' status='+res.status+' contentType='+media+
        ' contentEncoding='+encoding+' server='+server+' edge='+proxy+' json='+parsed+
        ' pageType='+pageType+
        ' mitigated='+(res.headers.get('cf-mitigated')||'none')+
        (errorKey?' error='+errorKey:''));
    }catch(error){
      failures++;
      console.log('V2_PUBLIC_PROBE '+test.method+' '+test.path+
        ' connectionFailed='+String(error.code||error.name||'Error').slice(0,60));
    }
  }
}finally{
  await bridge.close();
}
function redirected(x){return x;}
if(failures)process.exitCode=1;
