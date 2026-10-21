import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Storage } from '../src/storage.js';
import { Auth } from '../src/auth.js';
import { Updates } from '../src/updates.js';
import { createHTTP } from '../src/http.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function launch(t) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mq-http-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const store=new Storage(dir), auth=new Auth(), updates=new Updates(dir,store.dir,{
    manifestURL:null,publicKeyFile:null
  });
  const app=createHTTP({root,storage:store,auth,updates,httpsCookies:false});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>app.server.close(resolve)));
  return {base:'http://127.0.0.1:'+app.server.address().port,auth,store};
}
test('setup needs console code, admin controls need cookie and CSRF',async t=>{
  const {base,auth,store}=await launch(t);
  const req=async (route,options={})=>fetch(base+route,{redirect:'manual',...options});
  assert.equal((await req('/ready')).status,503);
  assert.equal((await req('/setup')).status,200);
  let r=await req('/setup',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({code:'000000',username:'Owner',password:'very-secure-password-123'})});
  assert.equal(r.status,403);
  r=await req('/setup',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({code:auth.setupCode,username:'Owner',password:'very-secure-password-123'})});
  assert.equal(r.status,303);
  assert.equal(store.data.owner.username,'Owner');
  assert.equal((await req('/ready')).status,200);
  assert.equal((await req('/setup')).status,303);
  assert.equal((await req('/admin')).status,303);
  assert.equal((await req('/api/admin/settings')).status,401);
  const cookie=r.headers.get('set-cookie').split(';')[0];
  const session=(await (await req('/api/admin/session',{headers:{cookie}})).json());
  assert.match(session.csrf,/^[0-9a-f]+$/);
  let update=await req('/api/admin/settings',{method:'POST',headers:{cookie,'content-type':'application/json','x-csrf-token':'wrong'},body:JSON.stringify({maxPlayers:42})});
  assert.equal(update.status,403);
  update=await req('/api/admin/settings',{method:'POST',headers:{cookie,'content-type':'application/json','x-csrf-token':session.csrf},body:JSON.stringify({maxPlayers:42,maintenance:true})});
  assert.equal(update.status,200);
  assert.equal(store.data.settings.maxPlayers,42);
  assert.equal(store.data.settings.maintenance,true);
  assert.equal((await req('/api/admin/players',{headers:{cookie}})).status,200);
  assert.equal((await req('/api/admin/audit',{headers:{cookie}})).status,200);
  assert.equal((await req('/public/app.js')).status,200);
  assert.equal((await req('/var/config.json')).status,404);
  const logout=await req('/admin/logout',{method:'POST',headers:{cookie,'x-csrf-token':session.csrf,'content-type':'application/json'},body:'{}'});
  assert.equal(logout.status,200);
  assert.equal((await req('/api/admin/session',{headers:{cookie}})).status,401);
});
test('credential stuffing is limited after five failed owner logins',async t=>{
  const {base,auth,store}=await launch(t);
  store.data.owner={username:'Owner',password:'bad'};
  for(let n=0;n<5;n++) {
    const r=await fetch(base+'/admin/login',{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'Owner',password:'wrong'})});
    assert.equal(r.status,401);
  }
  const r=await fetch(base+'/admin/login',{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'Owner',password:'wrong'})});
  assert.equal(r.status,429);
});
