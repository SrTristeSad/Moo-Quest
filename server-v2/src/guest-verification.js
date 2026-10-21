// Production guest verification via Cloudflare Turnstile Siteverify.
// Development ingress remains backwards compatible with the existing Lua
// client; enabling MOO_PUBLIC_MODE fails closed until configured correctly.
import { requestIdentity } from './request-identity.js';

const ENDPOINT='https://challenges.cloudflare.com/turnstile/v0/siteverify';
export function createGuestVerifier({
  publicMode=process.env.MOO_PUBLIC_MODE==='1',
  secret=process.env.MOO_TURNSTILE_SECRET,
  hostname=process.env.MOO_TURNSTILE_HOSTNAME,
  httpsCookies=process.env.MOO_PUBLIC_HTTPS==='1',
  fetchImpl=globalThis.fetch,
  timeoutMs=4000
}={}){
  if(publicMode){
    if(typeof secret!=='string'||secret.length<10)
      throw new Error('MOO_PUBLIC_MODE requires MOO_TURNSTILE_SECRET');
    if(typeof hostname!=='string'||!/^[a-z0-9.-]+$/i.test(hostname))
      throw new Error('MOO_PUBLIC_MODE requires MOO_TURNSTILE_HOSTNAME');
    if(!httpsCookies)
      throw new Error('MOO_PUBLIC_MODE requires MOO_PUBLIC_HTTPS=1 (HTTPS reverse proxy)');
  }
  return {
    publicMode,
    async verify(req,body){
      if(!publicMode){
        // Development guest admission must NEVER be silently exposed via
        // aaPanel reverse proxies or public listeners. Accounts use Bearer.
        const peer=req.socket?.remoteAddress;
        const loopback=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer);
        const hasProxyHeaders=['x-forwarded-for','forwarded','x-real-ip']
          .some(key=>req.headers?.[key]!==undefined);
        return loopback&&!hasProxyHeaders&&requestIdentity(req).trustedOrigin;
      }
      const token=body?.captchaToken;
      if(typeof token!=='string'||token.length<10||token.length>2048)return false;
      const identity=requestIdentity(req);
      if(!identity.trustedOrigin)return false;
      try{
        const params=new URLSearchParams({secret,response:token,remoteip:identity.address});
        const response=await fetchImpl(ENDPOINT,{
          method:'POST',
          headers:{'content-type':'application/x-www-form-urlencoded'},
          body:params,
          signal:AbortSignal.timeout(timeoutMs)
        });
        if(!response.ok)return false;
        const result=await response.json();
        return result?.success===true&&result.hostname===hostname;
      }catch(error){
        // Fail closed for network failures, timeouts and invalid JSON.
        console.error('[MooQuest] Guest verification unavailable:',error.message);
        return false;
      }
    }
  };
}
