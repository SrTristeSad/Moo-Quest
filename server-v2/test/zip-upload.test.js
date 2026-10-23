import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Storage} from '../src/storage.js';
import {Auth} from '../src/auth.js';
import {Updates} from '../src/updates.js';
import {createHTTP} from '../src/http.js';
import {stageTrustedZip} from '../src/zip-release.js';
import {SOURCES} from '../scripts/reference-sources.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runtime=[];
for(const folder of ['src','public']){
  for(const name of fs.readdirSync(path.join(root,folder))){
    if(!/\.(js|html|css)$/.test(name))continue;
    runtime.push({name:folder+'/'+name,data:fs.readFileSync(path.join(root,folder,name))});
  }
}
// The fixture now includes byte-identical reference modules, just like production.
for(const [origin,target] of SOURCES)runtime.push({
  name:target,data:fs.readFileSync(path.resolve(root,origin))
});
function crc32(bytes){
  let value=0xffffffff;
  for(const byte of bytes){
    value^=byte;
    for(let i=0;i<8;i++)value=(value>>>1)^((value&1)?0xedb88320:0);
  }
  return (value^0xffffffff)>>>0;
}
function makeZip(entries){
  let offset=0;const local=[],central=[];
  for(const {name,data:payload,type=0o100644} of entries){
    const data=Buffer.isBuffer(payload)?payload:Buffer.from(payload||'');
    const filename=Buffer.from(name);
    const head=Buffer.alloc(30),crc=crc32(data);
    head.writeUInt32LE(0x04034b50,0);
    head.writeUInt16LE(20,4);head.writeUInt16LE(0x800,6);
    head.writeUInt32LE(crc,14);
    head.writeUInt32LE(data.length,18);head.writeUInt32LE(data.length,22);
    head.writeUInt16LE(filename.length,26);
    const cd=Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50,0);
    cd.writeUInt16LE((3<<8)|20,4);cd.writeUInt16LE(20,6);
    cd.writeUInt16LE(0x800,8);cd.writeUInt32LE(crc,16);
    cd.writeUInt32LE(data.length,20);cd.writeUInt32LE(data.length,24);
    cd.writeUInt16LE(filename.length,28);
    cd.writeUInt32LE((type<<16)>>>0,38);
    cd.writeUInt32LE(offset,42);
    central.push(cd,filename);
    local.push(head,filename,data);
    offset+=head.length+filename.length+data.length;
  }
  const centralBuffer=Buffer.concat(central);
  const end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);
  end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);
  end.writeUInt32LE(centralBuffer.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,centralBuffer,end]);
}

test('admin ZIP stages complete server V2, excludes private data, activates and rolls back',async t=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mq-upload-'));
  t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
  const storage=new Storage(tmp),auth=new Auth();
  storage.data.owner={username:'Owner',password:'unused'};
  storage.save();
  const updates=new Updates(root,storage.dir,{manifestURL:null,publicKeyFile:null});
  const app=createHTTP({root,storage,auth,updates});
  await new Promise(ok=>app.server.listen(0,'127.0.0.1',ok));
  t.after(()=>new Promise(ok=>app.server.close(ok)));
  const base='http://127.0.0.1:'+app.server.address().port;
  const session=auth.issue(),cookie='mq_admin='+session.token;
  const upload=(bytes,headers={})=>fetch(base+'/api/admin/updates/upload-zip',{
    method:'POST',headers:{'Content-Type':'application/zip',...headers},body:bytes
  });
  const zip=makeZip([...runtime,{name:'node_modules/ignored.txt',data:'do not stage'},
    {name:'var/infrastructure.json',data:'private data must not be deployed'}]);
  assert.equal((await upload(zip)).status,401,'admin session is mandatory');
  assert.equal(updates.status().staged,null);
  assert.equal((await upload(zip,{cookie})).status,403,'CSRF is mandatory');
  const identity={cookie,'X-CSRF-Token':session.csrf};
  assert.equal((await upload(Buffer.from('not-a-zip'),identity)).status,413);
  const response=await upload(zip,identity);
  assert.equal(response.status,200,await response.clone().text());
  const result=await response.json();
  assert.match(result.staged,/^0\.1\.0-zip\.[a-z0-9.]+$/);
  assert.equal(result.upload.files,runtime.length);
  assert.match(result.upload.sha256,/^[a-f0-9]{64}$/);
  assert.equal(result.upload.authenticity,'unsigned_admin_upload');
  const release=path.join(storage.dir,'releases',result.staged);
  assert.equal(fs.existsSync(path.join(release,'src','index.js')),true);
  assert.equal(fs.existsSync(path.join(release,'var','infrastructure.json')),false);
  assert.equal(fs.existsSync(path.join(release,'node_modules')),false);
  const audit=await (await fetch(base+'/api/admin/audit',{headers:{cookie}})).json();
  assert.equal(audit[0].kind,'update_zip_staged');
  assert.equal((await upload(zip,identity)).status,422,'cannot overwrite pending release');
  const activated=await fetch(base+'/api/admin/updates/activate',{
    method:'POST',headers:{...identity,'Content-Type':'application/json'},body:'{}'});
  assert.equal(activated.status,200);
  assert.equal((await activated.json()).active,result.staged);
  const rollback=await fetch(base+'/api/admin/updates/rollback',{
    method:'POST',headers:{...identity,'Content-Type':'application/json'},body:'{}'});
  assert.equal(rollback.status,200);
  assert.equal((await rollback.json()).active,'builtin');
  assert.equal(storage.data.owner.username,'Owner');
  assert.equal(storage.data.settings.publicRegistration,false);
  assert.equal(updates.status().zipUploadSupported,true);
});

test('ZIP validator rejects missing modules, path traversal, symlink, duplicate, and invalid archives',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mq-upload-bad-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const one=runtime.find(x=>x.name==='src/index.js');
  assert.ok(one);
  await assert.rejects(stageTrustedZip(makeZip([one]),dir),/incompleto/);
  await assert.rejects(stageTrustedZip(makeZip([...runtime,
    {name:'../escape.js',data:'bad'}]),dir),/inseguro|invalid relative path/);
  await assert.rejects(stageTrustedZip(makeZip([...runtime,
    {name:'node_modules/target',data:'../private',type:0o120777}]),dir),
    /link|especial/);
  await assert.rejects(stageTrustedZip(makeZip([...runtime,one]),dir),/repetidos/);
  await assert.rejects(stageTrustedZip(Buffer.from('not-a-zip'),dir),/ZIP válido/);
  assert.equal(fs.existsSync(path.join(dir,'releases')),false,
    'unsafe archives must not create executable release folders');
});

test('discard keeps active builtin and removes staged source',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mq-zip-discard-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const updates=new Updates(root,dir,{manifestURL:null,publicKeyFile:null});
  const uploaded=await updates.uploadZip(makeZip(runtime));
  assert.ok(fs.existsSync(path.join(dir,'releases',uploaded.staged,'src','index.js')));
  const discarded=updates.discard();
  assert.equal(discarded.staged,null);
  assert.equal(discarded.active,'builtin');
  assert.equal(fs.existsSync(path.join(dir,'releases',uploaded.staged)),false);
});
