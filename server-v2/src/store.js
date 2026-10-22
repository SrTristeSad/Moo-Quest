// Moo-Quest independent V2 store contract. Numeric item/price values match
// the existing Lua storefront; visual assets and legacy game scripts excluded.
// No client-supplied price, bonus or inventory state is authoritative.
export const HATS=Object.freeze({
  51:0,50:0,28:0,29:0,30:0,36:0,37:0,38:0,44:0,35:0,
  42:0,43:0,49:0,57:50,8:100,2:500,15:600,5:1000,
  4:2000,18:2000,31:2500,1:3000,10:3000,48:3000,
  6:4000,59:3500,23:4000,13:5000,9:5000,32:5000,
  7:6000,22:6000,12:6000,26:8000,60:7000,
  21:10000,46:10000,14:10000,11:10000,53:10000,
  20:12000,58:12000,27:15000,40:15000,52:15000,
  55:20000,56:20000
});
export const ACCESSORIES=Object.freeze({
  12:1000,9:1000,10:1000,3:1500,8:2000,11:2000,
  17:3000,6:3000,4:4000,5:5000,2:6000,1:8000,
  7:8000,14:10000,15:10000,20:10000,16:12000,
  13:15000,19:15000,18:20000,21:20000
});
// Not sold: 45 is punitive moderation gear and 61 is an earned boss reward.
// They cannot be bought or equipped through forged native packets.
export const FREE_HATS=Object.freeze(Object.entries(HATS)
  .filter(([,price])=>price===0).map(([id])=>Number(id)));
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
