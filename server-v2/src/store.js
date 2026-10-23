// Moo-Quest independent V2 store contract. Numeric item/price values match
// the existing Lua storefront; visual assets and legacy game scripts excluded.
// No client-supplied price, bonus or inventory state is authoritative.
// Prices and sale restrictions are read from shared/config/store.js.
// The effect runtime below is unchanged pending separate gameplay approval.
export { HATS, ACCESSORIES, FREE_HATS } from './reference-catalog.js';
export const HEAD_EFFECTS=Object.freeze({
  1:{arrow:1.3},6:{speed:0.94,damageTaken:0.75},
  7:{speed:0.96,damageDone:1.5,healthRegen:-5},
  9:{extraGold:1},12:{speed:1.16},13:{healthRegen:3},
  14:{pps:1.5},20:{attackSpeed:0.78},
  22:{speed:0.7,antiTurret:true},
  23:{poisonImmune:true},32:{ammoCost:0.5},
  40:{speed:0.3,structureDamage:3.3},
  21:{poisonDmg:5,poisonTime:6},
  46:{bullRepel:true},
  53:{speed:0.7,turret:{projectile:1,range:700,rate:2500}},
  58:{healOnHit:0.4},
  55:{damageDone:1.2,healOnHit:0.25},
  27:{killScoreMultiplier:2},52:{killGoldSteal:0.5},
  59:{speed:1.08,damageTaken:1.12},
  60:{speed:0.94,damageTaken:0.88}
});
export const TAIL_EFFECTS=Object.freeze({
  3:{extraFood:1},5:{speed:1.05},9:{extraWood:1},
  10:{extraStone:1},11:{speed:1.35,damageDone:0.2},
  15:{projectileDamageTaken:0.75},17:{healthRegen:1},
  19:{speed:1.1}
});
export function gearEffects(p){
  return {hat:HEAD_EFFECTS[p.hat]||{},tail:TAIL_EFFECTS[p.tail]||{}};
}
