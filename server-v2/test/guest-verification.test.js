import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuestVerifier } from '../src/guest-verification.js';

const request={
  socket:{remoteAddress:'198.51.100.44'},headers:{}
};
const options={publicMode:true,secret:'abc123-secret-no-real',
  hostname:'game.example.test',httpsCookies:true};

test('public admission must reject missing configuration and missing challenge',async()=>{
  assert.throws(()=>createGuestVerifier({publicMode:true,secret:'',
    hostname:'game.example.test',httpsCookies:true}),/MOO_TURNSTILE_SECRET/);
  assert.throws(()=>createGuestVerifier({...options,hostname:''}),
    /MOO_TURNSTILE_HOSTNAME/);
  assert.throws(()=>createGuestVerifier({...options,httpsCookies:false}),
    /MOO_PUBLIC_HTTPS/);
  const verifier=createGuestVerifier({...options,
    fetchImpl:async()=>{throw Error('must not call provider without token');}});
  assert.equal(await verifier.verify(request,{captcha:true}),false);
  assert.equal(await verifier.verify(request,{captcha:true,captchaToken:'short'}),false);
});

test('public guest token is verified server-side, bound to remote IP and exact hostname',async()=>{
  let calls=0;
  const verifier=createGuestVerifier({...options,fetchImpl:async(url,init)=>{
    calls++;
    assert.equal(url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    assert.equal(init.method,'POST');
    assert.equal(init.body.get('secret'),options.secret);
    assert.equal(init.body.get('remoteip'),request.socket.remoteAddress);
    assert.equal(init.body.get('response'),'dummy-valid-turnstile-token');
    assert.ok(init.signal);
    return {ok:true,json:async()=>({success:true,hostname:options.hostname})};
  }});
  assert.equal(await verifier.verify(request,{captcha:true,captchaToken:'dummy-valid-turnstile-token'}),true);
  assert.equal(calls,1);
  const wrongHost=createGuestVerifier({...options,
    fetchImpl:async()=>({ok:true,json:async()=>({success:true,hostname:'elsewhere.example'})})});
  assert.equal(await wrongHost.verify(request,{captchaToken:'dummy-valid-turnstile-token'}),false);
  const rejected=createGuestVerifier({...options,
    fetchImpl:async()=>({ok:true,json:async()=>({success:false,hostname:options.hostname})})});
  assert.equal(await rejected.verify(request,{captchaToken:'dummy-valid-turnstile-token'}),false);
  const unreachable=createGuestVerifier({...options,
    fetchImpl:async()=>{throw new Error('simulated outage');}});
  assert.equal(await unreachable.verify(request,{captchaToken:'dummy-valid-turnstile-token'}),false);
});

test('development guest verification leaves current Lua ingress contract unchanged',async()=>{
  const verifier=createGuestVerifier({publicMode:false});
  assert.equal(await verifier.verify(request,{captcha:true}),true);
});
