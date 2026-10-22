// Compatibility adapter between Moo-Quest V2 numeric cosmetic IDs and
// al007ex/moomoo-clone's Apache-2.0 accessory engine. Never accept these
// values from client packets: the World owns and validates player equipment.
import { TAIL, EFFECT, gatherBonus, hasTail, snowFactor } from './vendor/al007ex/effects.js';

function referencePlayer(p) {
  return {
    tail: Number.isSafeInteger(p?.tail) && p.tail > 0 ? { id: p.tail } : null,
    skin: p?.hat === 15 ? { coldM: true } : null
  };
}

export function referenceGatherBonus(p, resourceType) {
  return gatherBonus(referencePlayer(p), resourceType);
}

export function referenceSnowFactor(p, snowSpeed) {
  return snowFactor(referencePlayer(p), { snowSpeed });
}

export function referenceCowMultiplier(p, animalType) {
  return animalType === 0 && hasTail(referencePlayer(p), TAIL.COW_CAPE)
    ? EFFECT.cowCapeMult : 1;
}

export function referenceBleed(p) {
  return hasTail(referencePlayer(p), TAIL.DEVILS_TAIL)
    ? {damage:EFFECT.devilsTailDmg,seconds:EFFECT.devilsTailTime}
    : {damage:0,seconds:0};
}

export function referenceThornsHeal(p, damage) {
  if (!Number.isFinite(damage) || damage <= 0) return 0;
  return hasTail(referencePlayer(p), TAIL.THORNS)
    ? Math.round(damage * EFFECT.thornsHeal) : 0;
}

export function triggerDragonCape(player,now){
  if(hasTail(referencePlayer(player),TAIL.DRAGON_CAPE))
    player.dragonUntil=now+EFFECT.dragonCapeTime;
}
export function triggerSuperCape(player,now){
  if(hasTail(referencePlayer(player),TAIL.SUPER_CAPE))
    player.superUntil=now+EFFECT.superCapeTime;
}
export function referenceCapeEffects(player,now){
  const dragon=Number(player?.dragonUntil)>now?EFFECT.dragonCapeDamage:1;
  const superActive=Number(player?.superUntil)>now;
  return {
    damage:dragon*(superActive?EFFECT.superCapeDamage:1),
    speed:superActive?EFFECT.superCapeSpeed:1
  };
}
