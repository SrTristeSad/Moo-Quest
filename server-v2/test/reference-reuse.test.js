import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world.js';
import { UTILS } from '../src/vendor/al007ex/utils.js';
import { referenceGatherBonus, referenceSnowFactor, referenceCowMultiplier, referenceThornsHeal } from '../src/reference-bridge.js';

test('reused Apache-2.0 modules adapt numeric equipment IDs safely', () => {
  assert.equal(referenceGatherBonus({tail:9},0),1);
  assert.equal(referenceGatherBonus({tail:3},1),1);
  assert.equal(referenceGatherBonus({tail:10},2),1);
  assert.equal(referenceGatherBonus({tail:9},2),0);
  assert.equal(referenceGatherBonus({tail:0},0),0);
  assert.equal(referenceSnowFactor({hat:0,tail:0},0.75),0.75);
  assert.equal(referenceSnowFactor({hat:0,tail:12},0.75),0.875);
  assert.equal(referenceSnowFactor({hat:0,tail:6},0.75),1);
  assert.equal(referenceSnowFactor({hat:15,tail:0},0.75),1);
  assert.equal(referenceCowMultiplier({tail:8},0),1.5);
  assert.equal(referenceCowMultiplier({tail:8},1),1);
  assert.equal(referenceThornsHeal({tail:14},25),1);
  assert.equal(referenceThornsHeal({tail:0},25),0);
  assert.equal(UTILS.getAngleDist(0,Math.PI*2),0);
});

test('World harvests actual trees with imported reference Tree Cape behavior', () => {
  const world=new World({now:()=>10000});
  const player=world.join(null,'Teste');
  world.resources.clear();
  world.structures.clear();
  world.animals.clear();
  player.x=500;player.y=5000;player.angle=0;player.tail=9;
  world.resources.set(909,{sid:909,x:560,y:5000,scale:35,type:0,kind:'tree'});
  assert.equal(world.attack(player.id),true);
  assert.equal(player.resources.wood,2,'hammer gives one wood + imported tree-cape bonus');
  assert.ok(world.resources.has(909),'natural tree remains in the world');
});

test('Cow Cape increases only cow rewards in the V2 World', () => {
  const world=new World();
  const player=world.join(null,'Teste');
  player.tail=8;
  world.creditAnimalKill(player,{index:0,foodDrop:50,score:150,boss:false});
  assert.equal(player.resources.food,75);
  assert.equal(player.resources.points,225);
  world.creditAnimalKill(player,{index:1,foodDrop:20,score:100,boss:false});
  assert.equal(player.resources.food,95,'non-cow rewards retain the original value');
  assert.equal(player.resources.points,325);
});

test('Thorns healing is granted after a real melee hit, not from client state', () => {
  const world=new World({now:()=>10000});
  const attacker=world.join(null,'Atacante');
  const victim=world.join(null,'Vitima');
  world.resources.clear();world.animals.clear();world.structures.clear();
  attacker.x=500;attacker.y=5000;attacker.angle=0;attacker.hp=50;attacker.tail=14;
  victim.x=560;victim.y=5000;victim.hp=100;
  assert.equal(world.attack(attacker.id),true);
  assert.equal(victim.hp,75);
  assert.equal(attacker.hp,51);
});

test('winter cape is reflected by the server-side snow physics', () => {
  function move(tail){
    const world=new World({now:()=>10000});
    const player=world.join(null,'Neve');
    world.resources.clear();world.structures.clear();world.animals.clear();
    player.x=500;player.y=1000;player.tail=tail;
    assert.equal(world.input(player.id,{dx:1,dy:0}),true);
    world.tick(0.1);
    return player.x;
  }
  assert.ok(move(6)>move(0),'Winter Cape moves farther in snow than no accessory');
});
