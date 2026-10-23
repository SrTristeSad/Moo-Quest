import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {copyReferenceSources,PACKAGED_REFERENCE_PATHS,SOURCES} from '../scripts/reference-sources.mjs';
import {auditReleaseBoundary} from '../scripts/check-release-boundary.mjs';
import {validateSignedRelease} from '../src/updates.js';
import * as catalog from '../src/reference-catalog.js';
import {createRequire} from 'node:module';
import {AI_TYPES as legacyAI} from '../../server/src/moomoo/modules/aiManager.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const load=createRequire(import.meta.url);
const upstreamConfig=load('../../shared/config.js');
const upstreamItems=load('../../shared/config/items.js');
const upstreamStore=load('../../shared/config/store.js');

const toCost=req=>Object.fromEntries((req||[]).filter((_,i)=>i%2===0)
  .map((key,i)=>[key,req[i*2+1]]));
const keysEqual=(actual,expected)=>assert.deepEqual(
  Object.keys(actual).map(Number).sort((a,b)=>a-b),
  expected.map(o=>o.id).sort((a,b)=>a-b));

test('every weapon field and numeric variant is sourced from shared/config',()=>{
  keysEqual(catalog.WEAPONS,upstreamItems.weapons);
  for(const w of upstreamItems.weapons){
    const item=catalog.WEAPONS[w.id];
    assert.equal(item.damage,w.dmg??upstreamItems.projectiles[w.projectile]?.dmg??0);
    assert.equal(item.reach,w.range);
    assert.equal(item.cooldown,w.speed);
    assert.equal(item.gather,w.gather);
    assert.equal(item.move,w.spdMult);
    assert.equal(item.knock,w.knock);
    assert.equal(item.hitSlow,w.hitSlow);
    assert.equal(item.shield,w.shield);
    assert.equal(item.structureDamage,w.sDmg);
    assert.equal(item.steal,w.steal);
    assert.equal(item.projectile,w.projectile);
    assert.equal(item.speed,upstreamItems.projectiles[w.projectile]?.speed);
    assert.equal(item.range,upstreamItems.projectiles[w.projectile]?.range);
    assert.deepEqual(item.ammo,w.req?toCost(w.req):undefined);
    assert.equal(item.rec,w.rec);
  }
  assert.deepEqual(catalog.PROJECTILE_TYPES,upstreamItems.projectiles);
  assert.deepEqual(catalog.VARIANT_THRESHOLDS,upstreamConfig.weaponVariants.map(v=>v.xp));
  assert.deepEqual(catalog.VARIANT_DAMAGE,upstreamConfig.weaponVariants.map(v=>v.val));
});

test('each build recipe, wall and mill limit is imported without fallback figures',()=>{
  const built=upstreamItems.list.filter(it=>it.group.place);
  keysEqual(catalog.RECIPES,built);
  for(const item of built){
    const r=catalog.RECIPES[item.id];
    assert.deepEqual(r.cost,toCost(item.req),item.name);
    assert.equal(r.hp,item.health,item.name);
    assert.equal(r.scale,item.scale,item.name);
    assert.equal(r.group,item.group.id,item.name);
    assert.equal(r.limit,item.group.limit,item.name);
    assert.equal(r.pps,item.pps,item.name);
    assert.equal(r.spikeDamage,item.dmg,item.name);
    assert.equal(r.poisonDamage,item.pDmg,item.name);
  }
  assert.equal(catalog.RECIPES[3].hp,380);
  assert.equal(catalog.RECIPES[4].hp,900);
  assert.equal(catalog.RECIPES[10].limit,200);
  assert.equal(catalog.RECIPES[11].hp,500);
  assert.equal(catalog.RECIPES[12].hp,800);
});

test('food, upgrade eligibility, store prices and animal spawn counts equal source',()=>{
  const food=upstreamItems.list.filter(it=>it.group.id===0);
  keysEqual(catalog.FOOD,food);
  for(const item of food){
    const f=catalog.FOOD[item.id];
    assert.equal(f.cost,toCost(item.req).food);
    const patient={dmgOverTime:{},changeHealth(v){this.healed=v;this.health=50+v;return true;},health:50};
    item.consume(patient);
    assert.equal(f.heal,patient.healed);
    assert.equal(f.regen,patient.dmgOverTime.dmg?-patient.dmgOverTime.dmg:undefined);
    assert.equal(f.seconds,patient.dmgOverTime.time);
  }
  const expectedUpgrades=[
    ...upstreamItems.weapons.filter(o=>o.age!==undefined)
      .map(o=>[o.id,{kind:'weapon',id:o.id,age:o.age,pre:o.pre}]),
    ...upstreamItems.list.filter(o=>o.age!==undefined)
      .map(o=>[upstreamItems.weapons.length+o.id,{kind:'item',id:o.id,age:o.age,pre:o.pre}])
  ];
  assert.deepEqual([...catalog.UPGRADES],expectedUpgrades);
  for(const [arr,map] of [[upstreamStore.hats,catalog.HATS],
    [upstreamStore.accessories,catalog.ACCESSORIES]]){
    const sale=arr.filter(o=>!o.dontSell);
    keysEqual(map,sale);
    for(const it of sale)assert.equal(map[it.id],it.price,it.name);
    for(const it of arr.filter(o=>o.dontSell))assert.equal(map[it.id],undefined);
  }
  assert.deepEqual(catalog.FREE_HATS,upstreamStore.hats.filter(o=>
    !o.dontSell&&o.price===0).map(o=>o.id));
  assert.equal(catalog.MAX_AGE,upstreamConfig.maxAge);
  assert.deepEqual(catalog.AI_TYPES,legacyAI);
  for(let i=0;i<upstreamConfig.server.animalSpawnPlan.length;i++){
    const expected=upstreamConfig.server.animalSpawnPlan[i];
    const actual=catalog.SPAWNS[i];
    assert.equal(actual.index,expected.index);
    assert.equal(actual.count,expected.desired);
    assert.equal(actual.area,expected.area);
    assert.deepEqual(actual.positions,expected.positions);
  }
  for(const spawn of catalog.WILDLIFE){
    const animal=legacyAI[spawn.index];
    assert.equal(spawn.hp,animal.health);
    assert.equal(spawn.damage,animal.dmg??0);
    assert.equal(spawn.scale,animal.scale);
    assert.equal(spawn.viewRange,animal.viewRange??0);
    assert.equal(spawn.food,animal.drop?.[0]==='food'?animal.drop[1]:0);
  }
});

test('signed update isolates and loads source-byte-identical references',async t=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mq-catalog-isolated-'));
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  fs.cpSync(path.join(root,'src'),path.join(temp,'src'),{recursive:true});
  fs.cpSync(path.join(root,'public'),path.join(temp,'public'),{recursive:true});
  const sources=copyReferenceSources(temp);
  assert.equal(sources.length,SOURCES.length);
  for(const {origin,target,sha256} of sources){
    const sourcePath=path.resolve(root,'..',origin);
    const bytes=fs.readFileSync(path.join(temp,target));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),sha256);
    assert.deepEqual(bytes,fs.readFileSync(sourcePath));
  }
  const paths=auditReleaseBoundary(temp,{standalone:true});
  for(const filename of PACKAGED_REFERENCE_PATHS)assert.ok(paths.includes(filename));
  assert.ok(paths.includes('src/reference-catalog.js'));
  const files=paths.map(rel=>{
    const bytes=fs.readFileSync(path.join(temp,rel));
    return {path:rel,size:bytes.length,sha256:createHash('sha256').update(bytes)
      .digest('hex'),url:'/releases/9.0.0/'+rel};
  });
  const {publicKey,privateKey}=generateKeyPairSync('ed25519');
  const payload={version:'9.0.0',notes:'test-only',files};
  const envelope={payload,signature:sign(null,Buffer.from(JSON.stringify(payload)),
    privateKey).toString('base64')};
  assert.equal(validateSignedRelease(envelope,publicKey,'https://example.org/manifest.json').version,
    '9.0.0');
  // No shared/ or server/ exists in this directory.
  assert.equal(fs.existsSync(path.join(temp,'shared')),false);
  assert.equal(fs.existsSync(path.join(temp,'server')),false);
  // Run actual native Node module resolution from the isolated runtime root.
  const standalone=await import(pathToFileURL(path.join(temp,'src/reference-catalog.js')).href);
  assert.deepEqual(standalone.RECIPES,catalog.RECIPES);
  assert.deepEqual(standalone.WEAPONS,catalog.WEAPONS);
  assert.deepEqual(standalone.HATS,catalog.HATS);
  assert.deepEqual(standalone.ACCESSORIES,catalog.ACCESSORIES);
  assert.deepEqual(standalone.WILDLIFE,catalog.WILDLIFE);
});
