import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {auditReleaseBoundary} from '../scripts/check-release-boundary.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
test('real V2 release can be packaged without importing legacy server files',()=>{
  const files=auditReleaseBoundary(path.resolve(here,'..'));
  assert.ok(files.includes('src/index.js'));
  assert.ok(files.includes('src/guest-verification.js'));
  assert.ok(files.every(p=>p.startsWith('src/')||p.startsWith('public/')));
});
test('release boundary fails closed on legacy imports, binary art, and symlinks',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'mq-v2-boundary-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for(const dir of ['src','public'])fs.mkdirSync(path.join(root,dir));
  for(const f of ['index.js','world.js','native-protocol.js'])
    fs.writeFileSync(path.join(root,'src',f),'export const value=1;\n');
  fs.writeFileSync(path.join(root,'public','admin.html'),'<title>Admin</title>\n');
  assert.equal(auditReleaseBoundary(root).length,4);
  const entry=path.join(root,'src','index.js');
  fs.writeFileSync(entry,"import '../../server/src/index.js';\n");
  assert.throws(()=>auditReleaseBoundary(root),/Legacy\/external or missing import/);
  fs.writeFileSync(entry,"import './world.js';\n");
  assert.equal(auditReleaseBoundary(root).length,4);
  fs.writeFileSync(path.join(root,'public','borrowed.png'),'not an asset to publish');
  assert.throws(()=>auditReleaseBoundary(root),/Unexpected release file/);
  fs.unlinkSync(path.join(root,'public','borrowed.png'));
  try{
    fs.symlinkSync(entry,path.join(root,'src','borrowed.js'));
    assert.throws(()=>auditReleaseBoundary(root),/Symlink prohibited/);
  }catch(error){
    if(error.code!=='EPERM'&&error.code!=='EACCES')throw error;
  }
});
