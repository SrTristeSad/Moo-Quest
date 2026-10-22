import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {importArtwork} from './importar-artes-antigas.mjs';

function samplePng(){
 const b=Buffer.alloc(33);Buffer.from('89504e470d0a1a0a','hex').copy(b);
 b.writeUInt32BE(13,8);b.write('IHDR',12);b.writeUInt32BE(2,16);b.writeUInt32BE(2,20);
 return b;
}
test('restores authentic locations, never replaces existing user PNGs or copies other files',()=>{
 const dir=mkdtempSync(join(tmpdir(),'mq-original-art-'));
 try{
  const old=join(dir,'before-v2'),target=join(dir,'new-client');
  mkdirSync(join(old,'assets/reference/img/animals'),{recursive:true});
  mkdirSync(join(old,'assets/reference/img/weapons'),{recursive:true});
  mkdirSync(join(target,'assets/custom/img/weapons'),{recursive:true});
  const png=samplePng();
  writeFileSync(join(old,'assets/reference/img/animals/boar_1.png'),png);
  writeFileSync(join(old,'assets/reference/img/weapons/sword_1.png'),png);
  writeFileSync(join(old,'assets/reference/img/animals/bull_1.png'),'broken png');
  writeFileSync(join(old,'assets/reference/img/animals/secret.env'),'not art');
  writeFileSync(join(target,'assets/custom/img/weapons/sword_1.png'),'CURRENT');
  const before=readFileSync(join(target,'assets/custom/img/weapons/sword_1.png'));
  const result=importArtwork(old,{targetRoot:target});
  assert.equal(result.copied,1);assert.equal(result.existing,1);
  assert.equal(result.invalid,1);
  assert.deepEqual(readFileSync(join(target,'assets/custom/img/animals/boar_1.png')),png);
  assert.deepEqual(readFileSync(join(target,'assets/custom/img/weapons/sword_1.png')),before);
  const second=importArtwork(old,{targetRoot:target});
  assert.equal(second.copied,0);assert.ok(second.existing>=2);
 }finally{rmSync(dir,{force:true,recursive:true});}
});
test('does not follow symlinked category directories',t=>{
 const dir=mkdtempSync(join(tmpdir(),'mq-sprite-links-'));
 try{
  const old=join(dir,'old'),outside=join(dir,'outside'),target=join(dir,'target');
  mkdirSync(join(old,'img'),{recursive:true});mkdirSync(outside,{recursive:true});
  writeFileSync(join(outside,'cow_1.png'),samplePng());
  try{symlinkSync(outside,join(old,'img/animals'),'dir');}
  catch{t.skip('symlink creation not supported');return;}
  assert.equal(importArtwork(old,{targetRoot:target}).copied,0);
 }finally{rmSync(dir,{force:true,recursive:true});}
});
test('rejects nonexistent import folder',()=>{
 assert.throws(()=>importArtwork('/not/a/real/mooquest/image/root'),/Pasta anterior/);
});