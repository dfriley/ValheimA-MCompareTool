/**
 * Pulls armor / weapon / ammo / set-bonus data out of kirilloid's Valheim
 * database (https://github.com/kirilloid/valheim) and writes src/data.js.
 *
 * Usage:
 *   git clone --depth 1 https://github.com/kirilloid/valheim.git ../kirilloid-valheim
 *   npx tsx scripts/extract-data.ts ../kirilloid-valheim
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const src = resolve(process.argv[2] ?? '../kirilloid-valheim');
const here = dirname(fileURLToPath(import.meta.url));
const load = (p: string) => import(pathToFileURL(resolve(src, p)).href);

const { items: rawArmors } = await load('src/data/armors.ts');
const { items: rawWeapons } = await load('src/data/weapons.ts');
const { arrows: rawAmmo } = await load('src/data/arrows.ts');
const { SkillType } = await load('src/model/skills.ts');
const en: Record<string, string> = JSON.parse(readFileSync(resolve(src, 'public/lang/en.json'), 'utf8'));
const commit = (() => {
  try {
    const head = readFileSync(resolve(src, '.git/HEAD'), 'utf8').trim();
    return head.startsWith('ref:') ? readFileSync(resolve(src, '.git', head.slice(5)), 'utf8').trim() : head;
  } catch { return 'unknown'; }
})();

// Names missing or wrong in the source translations.
const NAME_FIXES: Record<string, string> = {
  ArmorDeepNorthHeavyChest: 'Breastplate of the Protector',
  ArmorDeepNorthHeavylegs: 'Trousers of the Protector',
  HelmetDNHeavy: 'Helmet of the Protector',
  ArmorDeepNorthMediumChest: 'Chestpiece of the Vanguard',
  ArmorDeepNorthMediumlegs: 'Trousers of the Vanguard',
  HelmetDNMediumHood: 'Hood of the Vanguard',
  ArmorDeepNorthMageChest: 'Robes of the Caller',
  ArmorDeepNorthMagelegs: 'Trousers of the Caller',
  HelmetDNMage: 'Headdress of the Caller',
  HelmetPointyHat: 'Pointy hat',
  THSwordGold: 'Nord Greatsword',
  THSwordGold_BloodLightning: 'Thunderblood Greatsword',
  THSwordGold_FrostFire: 'Frostfire Greatsword',
  SwordGold_BloodLightning: 'Thunderblood Sword',
  AxeBerzerkr: 'Berserkir Axes',
};
const nameOf = (id: string) => NAME_FIXES[id] ?? en[id] ?? id;

const SLOT: Record<string, string> = { head: 'head', body: 'chest', legs: 'legs', shoulders: 'cape', trinket: 'trinket' };

// Progression index (1 = Meadows ... 8 = Deep North) drives the spoiler filter. The source "tier"
// mostly matches the biome you get an item in; these are the ones that don't.
const BIOMES = ['Meadows', 'Black Forest', 'Swamp', 'Mountains', 'Plains', 'Mistlands', 'Ashlands', 'Deep North'];
const PROG_FIXES: Record<string, number> = {
  ArmorTrollLeatherLegs: 2, ArmorTrollLeatherChest: 2, HelmetTrollLeather: 2, CapeTrollHide: 2,
  ArmorFenringLegs: 4, ArmorFenringChest: 4, HelmetFenring: 4,
  CrossbowArbalest: 6,
  HelmetDverger: 6,
};
// Stats the source has wrong, checked against several 1.0 guide sites (Oct 2026). The source lists
// these chest/helmet pieces at weight 1.
const STAT_FIXES: Record<string, Record<string, unknown>> = {
  ArmorFlametalChest: { weight: 10 },
  HelmetFlametal: { weight: 3 },
  ArmorAshlandsMediumChest: { weight: 5 },
  ArmorAshlandsMediumlegs: { weight: 5 },
  ArmorMageChest_Ashlands: { weight: 5 },
};
// Deep North was added to the source as a first pass right after 1.0 launched. Guide sites list most
// Deep North weapons about 10% stronger and several armor values differ, so the app flags them.
const UNVERIFIED_PROG = 8;

const progOf = (id: string, tier: number) => PROG_FIXES[id] ?? Math.min(8, Math.max(1, tier));
const biomeOf = (id: string, tier: number) => BIOMES[progOf(id, tier) - 1];

// Cosmetic clothing / dev items that just clutter the pickers.
const SKIP_ARMOR = /^(ArmorDress\d|ArmorTunic\d|HelmetHat\d|CapeTest|HelmetOdin|CapeOdin)/;
const SKIP_WEAPON = new Set([
  'Tankard', 'TankardOdin', 'TankardAnniversary', 'Tankard_dvergr', 'Sparkler', 'Lantern', 'Lantern_DN',
  'TorchMist', 'SwordCheat', 'SledgeCheat', 'PickaxeStone', 'SwordIronFire', 'AxeEarly', 'ShieldKnight',
  'ShieldIronSquare', 'AtgeirWood', 'AxeWood', 'BattleaxeWood', 'KnifeWood', 'MaceWood', 'SledgeWood',
  'SpearWood', 'SwordWood', 'THSwordWood',
]);

const skillName = (s: number | null) => s == null ? 'Misc' : (en[`ui.skillType.${SkillType[s]}`] ?? SkillType[s]);
const trimDmg = (d: Record<string, number> | undefined) =>
  d ? Object.fromEntries(Object.entries(d).filter(([, v]) => v)) : {};
const pair = (v: number | number[] | undefined): [number, number] =>
  Array.isArray(v) ? [v[0], v[1]] : [v ?? 0, 0];

// Set bonuses are keyed by effect id (berserker + vilebone share a set name).
const effectInfo = (e: any) => {
  const out: any = { id: e.id, name: en[`ui.effect.${e.id}`] ?? null };
  for (const k of ['damageModifiers', 'healthRegen', 'staminaRegen', 'eitrRegen', 'runStamina', 'jumpStamina',
    'attackStamina', 'dodgeStamina', 'blockStamina', 'swimStamina', 'damageValueModifiers', 'fallDamage',
    'windMovementModifier', 'moveSpeed', 'swimSpeed', 'armor', 'parryBonus', 'time',
    'healthUpfront', 'staminaUpfront', 'eitrUpfront']) {
    if (e[k] != null) out[k] = e[k];
  }
  if (e.skillModifiers) {
    out.skillModifiers = Object.fromEntries(Object.entries(e.skillModifiers).map(([k, v]) => [skillName(+k), v]));
  }
  if (e.disabled) out.disabled = true;
  return out;
};

const sets: Record<string, any> = {};
const armors = rawArmors
  .filter((a: any) => SLOT[a.slot] && a.tier >= 0 && !SKIP_ARMOR.test(a.id))
  .map((a: any) => {
    let set: string | undefined;
    if (a.set) {
      const idx = a.set.bonus.findIndex(Boolean);
      const eff = a.set.bonus[idx];
      set = eff.id;
      sets[set] ??= { ...effectInfo(eff), pieces: idx + 1, items: [] };
      sets[set].items.push(a.id);
    }
    return {
      id: a.id,
      name: nameOf(a.id),
      slot: SLOT[a.slot],
      tier: a.tier,
      prog: progOf(a.id, a.tier),
      biome: biomeOf(a.id, a.tier),
      armor: a.armor,
      maxLvl: a.maxLvl,
      weight: a.weight,
      durability: a.durability.map((v: number) => (v === Infinity ? null : v)),
      moveSpeed: a.moveSpeed,
      ...(a.damageModifiers && { resist: a.damageModifiers }),
      ...(a.staminaModifiers && { stamina: a.staminaModifiers }),
      ...(a.eitrRegen && { eitrRegen: a.eitrRegen }),
      ...(a.effect && { effect: effectInfo(a.effect) }),
      ...(a.adrenaline && { adrenaline: { max: a.adrenaline.max, effect: effectInfo(a.adrenaline.effect) } }),
      ...(set && { set }),
      ...(progOf(a.id, a.tier) >= UNVERIFIED_PROG && { unverified: true }),
      ...STAT_FIXES[a.id],
    };
  });

const weapons = rawWeapons
  .filter((w: any) => (w.type === 'weapon' || w.type === 'shield') && !SKIP_WEAPON.has(w.id) && w.tier >= 0)
  .map((w: any) => ({
    id: w.id,
    name: nameOf(w.id),
    kind: w.type,
    skill: w.type === 'shield' ? 'Shields' : skillName(w.skill),
    hands: w.slot,
    tier: w.tier,
    prog: progOf(w.id, w.tier),
    biome: biomeOf(w.id, w.tier),
    maxLvl: w.maxLvl,
    weight: w.weight,
    moveSpeed: w.moveSpeed,
    damage: w.damage ? [trimDmg(w.damage[0]), trimDmg(w.damage[1])] : [{}, {}],
    block: pair(w.block),
    parryForce: pair(w.parryForce),
    parryBonus: w.parryBonus,
    ...(progOf(w.id, w.tier) >= UNVERIFIED_PROG && { unverified: true }),
    knockback: w.knockback ?? 0,
    backstab: w.backstab ?? 1,
    durability: w.durability,
    ...(w.damageModifiers && { resist: w.damageModifiers }),
    attacks: (w.attacks ?? []).map((at: any) => ({
      animation: at.animation,
      type: at.type,
      stamina: at.stamina ?? 0,
      ...(at.eitr && { eitr: at.eitr }),
      ...(at.healthPercent && { healthPercent: at.healthPercent }),
      mul: at.mul?.damage ?? 1,
      ...(at.chain && { chain: at.chain }),
      ...(at.draw && { drawStamina: at.draw.stamina, drawTime: at.draw.duration }),
      ...(at.reload && { reloadTime: at.reload.time }),
      ...(at.reload?.stamina && { reloadStamina: at.reload.stamina }),
      ...(at.reload?.eitr && { reloadEitr: at.reload.eitr }),
      ...(at.number && at.number > 1 && { projectiles: at.number }),
    })),
  }));

const ammo = rawAmmo
  .filter((a: any) => a.type === 'arrow' || a.type === 'bolt')
  .map((a: any) => ({ id: a.id, name: nameOf(a.id), type: a.type, tier: a.tier, prog: progOf(a.id, a.tier), damage: trimDmg(a.damage) }));

const data = {
  source: { repo: 'https://github.com/kirilloid/valheim', commit, extracted: new Date().toISOString().slice(0, 10) },
  biomes: BIOMES, armors, sets, weapons, ammo,
};
const out = resolve(here, '../src/data.js');
writeFileSync(out, `// Generated by scripts/extract-data.ts. Do not edit by hand.\nwindow.VH_DATA = ${JSON.stringify(data)};\n`);
console.log(`wrote ${out}: ${armors.length} armor, ${weapons.length} weapons/shields, ${ammo.length} ammo, ${Object.keys(sets).length} set bonuses`);
