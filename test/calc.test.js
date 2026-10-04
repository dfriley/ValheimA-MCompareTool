import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ['src/data.js', 'src/outfits.js', 'src/calc.js']) vm.runInContext(readFileSync(f, 'utf8'), ctx);
const { VH_DATA: D, VH_OUTFITS: OUTFITS, VH_CALC: C } = ctx.window;
const data = {
  armorById: Object.fromEntries(D.armors.map((a) => [a.id, a])),
  weaponById: Object.fromEntries(D.weapons.map((w) => [w.id, w])),
  ammoById: Object.fromEntries(D.ammo.map((a) => [a.id, a])),
  sets: D.sets,
};
const outfit = (id, lvl) => {
  const o = OUTFITS.find((x) => x.id === id);
  return { slots: Object.fromEntries(C.SLOTS.map((s) => [s, o.pieces[s] ? { id: o.pieces[s], lvl } : null])) };
};

test('every outfit piece exists in the data and sits in the right slot', () => {
  for (const o of OUTFITS) for (const [slot, id] of Object.entries(o.pieces)) {
    assert.ok(data.armorById[id], `${o.id}: missing ${id}`);
    assert.equal(data.armorById[id].slot, slot, `${o.id}: ${id} is not a ${slot}`);
  }
});

test('armor scales per level', () => {
  // Fenris: 10 base, +2 per level -> 16 per piece at level 4, 3 pieces
  const s = C.loadoutStats(outfit('fenris', 4), data);
  assert.equal(s.armor, 48);
  const p = C.loadoutStats(outfit('padded', 1), data);
  assert.equal(p.armor, 26 * 3 + 1); // + linen cape
});

test('set bonus needs the full set and adds its resistances', () => {
  const full = C.loadoutStats(outfit('fenris', 1), data);
  assert.equal(full.sets[0].active, true);
  assert.equal(full.resist.fire.mod, 'resistant');
  assert.equal(full.resist.frost.mod, 'resistant'); // from the coat itself

  const mixed = outfit('fenris', 1);
  mixed.slots.chest = { id: 'ArmorPaddedCuirass', lvl: 1 };
  const m = C.loadoutStats(mixed, data);
  assert.equal(m.sets[0].count, 2);
  assert.equal(m.sets[0].active, false);
  assert.equal(m.resist.fire, undefined);

  const troll = outfit('troll', 1);
  assert.equal(C.loadoutStats(troll, data).sets[0].active, true);
  troll.slots.cape = null;
  assert.equal(C.loadoutStats(troll, data).sets[0].active, false, 'troll bonus needs the cape');
});

test('resistance beats weakness when both apply', () => {
  assert.equal(C.strongerMod('weak', 'resistant'), 'resistant');
  assert.equal(C.strongerMod('resistant', 'slightlyWeak'), 'resistant');
  assert.equal(C.strongerMod('slightlyWeak', 'veryWeak'), 'veryWeak');
});

test('armor formula matches the game', () => {
  assert.equal(C.armorReduce(100, 20), 80);          // armor < dmg/2: flat
  assert.equal(C.armorReduce(100, 50), 50);          // boundary: 100^2 / 200
  assert.equal(C.armorReduce(100, 100), 25);         // quadratic
  const s = C.loadoutStats(outfit('fenris', 4), data);
  assert.equal(C.damageTaken(100, 'fire', s), C.armorReduce(50, 48)); // halved by fire resist first
  assert.equal(C.damageTaken(40, 'poison', s), C.armorReduce(40, 48)); // armor reduces poison too
});

test('weapon damage per level and ammo', () => {
  const ironAxe = C.weaponStats({ id: 'AxeIron', lvl: 4 }, 100, data);
  assert.equal(ironAxe.dmg.slash, 60 + 5 * 3);
  assert.equal(ironAxe.dmg.chop, 50 + 3 * 3);
  assert.equal(ironAxe.combat, 75);
  assert.deepEqual([...ironAxe.range], [75 * 0.85, 75]);
  assert.equal(ironAxe.attacks[1].hit, 75 * 1.5);

  const hypothetical = C.weaponStats({ id: 'AxeIron', lvl: 5 }, 50, data);
  assert.equal(hypothetical.hypothetical, true);
  assert.equal(hypothetical.dmg.slash, 80);

  const bm = C.weaponStats({ id: 'AxeBlackMetal', lvl: 1 }, 0, data);
  assert.equal(bm.combat, 100);
  assert.ok(Math.abs(bm.range[0] - 25) < 1e-9 && Math.abs(bm.range[1] - 55) < 1e-9);

  const bow = C.weaponStats({ id: 'BowFineWood', lvl: 1, ammo: 'ArrowIron' }, 0, data);
  assert.equal(bow.combat, 32 + 42);
});

test('trinket buff adds armor only while active', () => {
  const lo = outfit('iron', 1);
  lo.trinket = 'TrinketIronHealth';
  const s = C.loadoutStats(lo, data);
  assert.equal(s.armor, 14 * 3);
  assert.equal(s.trinket.adrenaline, 65);
  const buffed = C.withTrinketBuff(s);
  assert.equal(buffed.armor, 14 * 3 + 20);

  lo.trinket = 'TrinketSilverResist';
  const crystal = C.withTrinketBuff(C.loadoutStats(lo, data));
  assert.equal(crystal.resist.slash.mod, 'slightlyResistant');

  lo.trinket = 'TrinketBronzeStamina';
  assert.equal(C.withTrinketBuff(C.loadoutStats(lo, data)), null);
});

test('every item has a progression biome between 1 and 8', () => {
  for (const x of [...D.armors, ...D.weapons, ...D.ammo]) {
    assert.ok(x.prog >= 1 && x.prog <= 8, `${x.id} prog ${x.prog}`);
  }
  assert.equal(data.armorById.HelmetFenring.prog, 4);
  assert.equal(data.armorById.HelmetTrollLeather.prog, 2);
});

test('bow stamina is draw time x drain, and the draw speeds up with skill', () => {
  // Finewood bow: 6 stamina/s over a 2.5s draw at skill 0
  const bow0 = C.weaponStats({ id: 'BowFineWood', lvl: 1 }, 0, data).attacks[0];
  assert.equal(bow0.drawTime, 2.5);
  assert.equal(bow0.stamina, 15);
  const bow100 = C.weaponStats({ id: 'BowFineWood', lvl: 1 }, 100, data).attacks[0];
  assert.ok(Math.abs(bow100.drawTime - 0.5) < 1e-9);
  assert.ok(Math.abs(bow100.stamina - 3) < 1e-9);
});

test('reload costs are counted (Dundr recharge eitr, crossbow reload stamina)', () => {
  const dundr = C.weaponStats({ id: 'StaffLightning', lvl: 1 }, 0, data).attacks[0];
  assert.equal(dundr.eitr, 25);
  const xbow = C.weaponStats({ id: 'CrossbowArbalest', lvl: 1 }, 0, data).attacks[0];
  assert.equal(xbow.stamina, 1);
  assert.equal(xbow.reloadTime, 3.5);
});

test('melee combo finisher hits for double', () => {
  const axe = C.weaponStats({ id: 'AxeIron', lvl: 1 }, 0, data);
  assert.deepEqual({ ...axe.attacks[0].finisher }, { hitNumber: 3, hit: 120 });
  assert.equal(axe.attacks[1].finisher, null); // secondary is a single heavy hit
});

test('Ashlands weight fixes are applied and Deep North is flagged', () => {
  assert.equal(data.armorById.ArmorFlametalChest.weight, 10);
  assert.equal(data.armorById.ArmorAshlandsMediumChest.weight, 5);
  assert.equal(data.armorById.HelmetDNHeavy.unverified, true);
  assert.equal(data.weaponById.SwordGold.unverified, true);
  assert.equal(data.armorById.HelmetPadded.unverified, undefined);
});
