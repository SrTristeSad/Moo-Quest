// Authoritative data adapter: read the original shared and server files.
// Signed standalone releases carry byte-identical copies generated at build time.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repository=path.resolve(here,'../..');
const direct={
  config:path.join(repository,'shared/config.js'),
  items:path.join(repository,'shared/config/items.js'),
  store:path.join(repository,'shared/config/store.js'),
  animals:path.join(repository,'server/src/moomoo/modules/aiManager.js')
};
const packaged={
  config:path.join(here,'reference-source/config.cjs'),
  items:path.join(here,'reference-source/items.cjs'),
  store:path.join(here,'reference-source/store.cjs'),
  animals:path.join(here,'reference-source/aiManager.js')
};
const paths=Object.values(direct).every(p=>fs.existsSync(p))?direct:packaged;
for(const p of Object.values(paths))
  if(!fs.existsSync(p))throw new Error('Reference source missing: '+p);
const load=createRequire(import.meta.url);
export const config=load(paths.config);
export const items=load(paths.items);
export const store=load(paths.store);
export const {AI_TYPES}=await import(pathToFileURL(paths.animals).href);

function priceEntries(list){
  return Object.freeze(Object.fromEntries(list.filter(o=>!o.dontSell)
    .map(o=>[o.id,o.price])));
}
export const HATS=priceEntries(store.hats);
export const ACCESSORIES=priceEntries(store.accessories);
export const FREE_HATS=Object.freeze(store.hats
  .filter(o=>!o.dontSell&&o.price===0).map(o=>o.id));

const costOf=req=>{
  if(!req)return {};
  if(!Array.isArray(req)||req.length%2)throw new Error('Invalid reference req');
  const cost={};
  for(let i=0;i<req.length;i+=2)cost[req[i]]=req[i+1];
  return cost;
};
const byId=arr=>Object.freeze(Object.fromEntries(arr.map(o=>[o.id,o])));
export const SOURCE_WEAPONS=byId(items.weapons);
export const SOURCE_ITEMS=byId(items.list);
export const SOURCE_GROUPS=byId(items.groups);

export const WEAPONS=Object.freeze(Object.fromEntries(items.weapons.map(w=>{
  const projectile=w.projectile===undefined?null:items.projectiles[w.projectile];
  if(w.projectile!==undefined&&!projectile)
    throw new Error('Unknown reference projectile '+w.projectile);
  return [w.id,Object.freeze({
    damage:w.dmg??projectile?.dmg??0,
    reach:w.range,
    cooldown:w.speed,
    gather:w.gather,
    move:w.spdMult,
    knock:w.knock,
    hitSlow:w.hitSlow,
    shield:w.shield,
    structureDamage:w.sDmg,
    steal:w.steal,
    projectile:w.projectile,
    speed:projectile?.speed,
    range:projectile?.range,
    ammo:w.req?costOf(w.req):undefined,
    rec:w.rec
  })];
})));
export const RECIPES=Object.freeze(Object.fromEntries(items.list
  .filter(it=>it.group.place)
  .map(it=>[it.id,Object.freeze({
    cost:costOf(it.req),scale:it.scale,hp:it.health,
    group:it.group.id,limit:it.group.limit,
    spikeDamage:it.dmg,poisonDamage:it.pDmg,
    pps:it.pps,boost:it.boostSpeed,heal:it.healCol,
    pit:it.trap,blocker:it.blocker,spawnPoint:it.spawnPoint,
    teleport:it.teleport,turret:it.name==='turret',
    platform:it.name==='platform',
    harvest:it.name==='mine'?'stone':it.name==='sapling'?'wood':undefined
  })])));
export const FOOD=Object.freeze(Object.fromEntries(items.list
  .filter(it=>it.group.id===0).map(it=>{
    let healed;
    const patient={health:50,dmgOverTime:{},changeHealth(n){healed=n;this.health+=n;return true;}};
    if(typeof it.consume!=='function')throw new Error('Reference food has no consume()');
    it.consume(patient);
    if(!Number.isFinite(healed))throw new Error('Invalid reference food heal');
    return [it.id,Object.freeze({
      cost:costOf(it.req).food,heal:healed,
      regen:patient.dmgOverTime.dmg?-patient.dmgOverTime.dmg:undefined,
      seconds:patient.dmgOverTime.time
    })];
  })));
export const UPGRADES=new Map([
  ...items.weapons.filter(it=>it.age!==undefined)
    .map(it=>[it.id,{kind:'weapon',id:it.id,age:it.age,pre:it.pre}]),
  ...items.list.filter(it=>it.age!==undefined)
    .map(it=>[items.weapons.length+it.id,{kind:'item',id:it.id,age:it.age,pre:it.pre}])
]);
export const SPAWNS=Object.freeze(config.server.animalSpawnPlan.map(plan=>{
  const a=AI_TYPES[plan.index];
  if(!a||a.id!==plan.index)throw Error('Reference animal mismatch '+plan.index);
  return Object.freeze({
    index:plan.index,count:plan.desired,area:plan.area,
    positions:plan.positions,speed:a.speed
  });
}));
export const WILDLIFE=Object.freeze(SPAWNS.map(plan=>{
  const a=AI_TYPES[plan.index];
  return Object.freeze({
    ...plan,hp:a.health,damage:a.dmg??0,
    food:a.drop?.[0]==='food'?a.drop[1]:0,
    score:a.killScore??0,scale:a.scale,
    viewRange:a.viewRange??0,hostile:!!a.hostile,
    fixed:!!a.fixedSpawn,boss:!!a.boss
  });
}));
export const PROJECTILE_TYPES=Object.freeze(items.projectiles.map(p=>Object.freeze({...p})));
export const LEVEL_XP=age=>Math.round(300*Math.pow(1.2,Math.max(0,age-1))*10)/10;
export const MAX_AGE=config.maxAge;
export const VARIANT_THRESHOLDS=config.weaponVariants.map(v=>v.xp);
export const VARIANT_DAMAGE=config.weaponVariants.map(v=>v.val);
