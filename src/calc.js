// Stat math for armor loadouts and weapons. Pure functions, no DOM.
// Formulas follow the game code as documented in kirilloid's calculator (src/model/combat.ts).
(function (root) {
  const MOD_MULT = {
    normal: 1, immune: 0, ignore: 1,
    veryResistant: 0.25, resistant: 0.5, slightlyResistant: 0.75,
    slightlyWeak: 1.25, weak: 1.5, veryWeak: 2,
  };
  // Resistances beat weaknesses; among the same kind the stronger one wins.
  const MOD_RANK = {
    normal: 0, ignore: 0, slightlyWeak: 1, weak: 2, veryWeak: 3,
    slightlyResistant: 4, resistant: 5, veryResistant: 6, immune: 7,
  };
  const COMBAT_TYPES = ['blunt', 'slash', 'pierce', 'fire', 'frost', 'lightning', 'poison', 'spirit'];
  const TOOL_TYPES = ['chop', 'pickaxe'];
  // Armor reduces every combat damage type, poison included (tool damage never hits players).
  const ARMOR_APPLIES = new Set(['blunt', 'slash', 'pierce', 'fire', 'frost', 'lightning', 'poison', 'spirit']);
  const SLOTS = ['head', 'chest', 'legs', 'cape'];

  /** Value of a [base, perLevel] pair at quality level `lvl` (1-based). */
  const atLevel = (pair, lvl) => pair[0] + pair[1] * (lvl - 1);

  function strongerMod(a, b) {
    if (!a) return b;
    return MOD_RANK[b] > MOD_RANK[a] ? b : a;
  }

  /** Valheim armor formula: flat reduction for small hits, quadratic falloff for big ones. */
  function armorReduce(damage, armor) {
    if (damage <= 0) return 0;
    return armor < damage / 2 ? damage - armor : (damage * damage) / (armor * 4);
  }

  /**
   * loadout: { slots: { head: {id, lvl} | null, chest, legs, cape }, trinket?: id }
   * data: { armorById, sets }
   */
  function loadoutStats(loadout, data) {
    const out = {
      armor: 0, weight: 0, moveSpeed: 0, eitrRegen: 0,
      stamina: {}, resist: {}, sets: [], effects: [], pieces: [], hypothetical: false,
    };
    const setCount = {};
    for (const slot of SLOTS) {
      const pick = loadout.slots[slot];
      if (!pick) continue;
      const item = data.armorById[pick.id];
      if (!item) continue;
      const lvl = pick.lvl;
      const armor = atLevel(item.armor, lvl);
      const durability = item.durability[0] == null ? null : atLevel(item.durability, lvl);
      out.pieces.push({ slot, item, lvl, armor, durability, hypothetical: lvl > item.maxLvl });
      if (lvl > item.maxLvl) out.hypothetical = true;
      out.armor += armor;
      out.weight += item.weight;
      out.moveSpeed += item.moveSpeed;
      out.eitrRegen += item.eitrRegen || 0;
      for (const [k, v] of Object.entries(item.stamina || {})) out.stamina[k] = (out.stamina[k] || 0) + v;
      for (const [type, mod] of Object.entries(item.resist || {})) addResist(out.resist, type, mod, item.name);
      if (item.effect) out.effects.push({ ...item.effect, source: item.name });
      if (item.set) setCount[item.set] = (setCount[item.set] || 0) + 1;
    }
    if (loadout.trinket && data.armorById[loadout.trinket]) {
      const item = data.armorById[loadout.trinket];
      out.trinket = { item, adrenaline: item.adrenaline?.max ?? null, effect: item.adrenaline?.effect ?? null };
      out.weight += item.weight;
    }
    for (const [setId, count] of Object.entries(setCount)) {
      const set = data.sets[setId];
      if (!set) continue;
      const active = count >= set.pieces && !set.disabled;
      out.sets.push({ set, count, active });
      if (!active) continue;
      for (const [type, mod] of Object.entries(set.damageModifiers || {})) {
        addResist(out.resist, type, mod, `${set.name} set bonus`);
      }
    }
    return out;
  }

  /** Stats while the trinket's adrenaline buff is running (extra armor and resistances). */
  function withTrinketBuff(stats) {
    const eff = stats.trinket?.effect;
    if (!eff || (!eff.armor && !eff.damageModifiers)) return null;
    const resist = {};
    for (const [t, r] of Object.entries(stats.resist)) resist[t] = { mod: r.mod, sources: [...r.sources] };
    for (const [t, mod] of Object.entries(eff.damageModifiers || {})) addResist(resist, t, mod, `${stats.trinket.item.name} (active)`);
    return { ...stats, armor: stats.armor + (eff.armor || 0), resist };
  }

  function addResist(resist, type, mod, source) {
    const cur = resist[type] || { mod: null, sources: [] };
    cur.mod = strongerMod(cur.mod, mod);
    cur.sources.push({ mod, source });
    resist[type] = cur;
  }

  /** Damage a single hit of `amount` `type` damage deals to a loadout (no shield, no block). */
  function damageTaken(amount, type, stats) {
    const mod = stats.resist[type]?.mod || 'normal';
    const afterRes = amount * MOD_MULT[mod];
    return ARMOR_APPLIES.has(type) ? armorReduce(afterRes, stats.armor) : afterRes;
  }

  /** Skill-based damage roll range: [min, max] multipliers at weapon skill 0-100. */
  function skillRange(skill) {
    return [0.25 + 0.006 * skill, Math.min(0.55 + 0.006 * skill, 1)];
  }
  const staminaFactor = (skill) => 1 - (0.33 * skill) / 100;
  const lerp = (a, b, t) => a + (b - a) * t;
  /** Full bow draw takes this fraction of the listed draw time at a given Bows skill. */
  const drawTimeFactor = (skill) => lerp(1, 0.2, skill / 100);
  /** Crossbow / staff reload takes this fraction of the listed reload time. */
  const reloadTimeFactor = (skill) => lerp(1, 0.5, skill / 100);

  /**
   * pick: { id, lvl, ammo? }   data: { weaponById, ammoById }
   */
  function weaponStats(pick, skill, data) {
    const w = data.weaponById[pick.id];
    if (!w) return null;
    const lvl = pick.lvl;
    const dmg = {};
    const types = new Set([...Object.keys(w.damage[0]), ...Object.keys(w.damage[1])]);
    for (const t of types) {
      const v = atLevel([w.damage[0][t] || 0, w.damage[1][t] || 0], lvl);
      if (v) dmg[t] = v;
    }
    const ammo = isRanged(w) && pick.ammo ? data.ammoById[pick.ammo] : null;
    if (ammo) for (const [t, v] of Object.entries(ammo.damage)) dmg[t] = (dmg[t] || 0) + v;

    const combat = COMBAT_TYPES.reduce((s, t) => s + (dmg[t] || 0), 0);
    const tool = TOOL_TYPES.reduce((s, t) => s + (dmg[t] || 0), 0);
    const [lo, hi] = skillRange(skill);
    const sf = staminaFactor(skill);
    const attacks = w.attacks.map((a, i) => {
      const hit = combat * a.mul;
      // Draw stamina drains per second while drawing; the draw itself gets faster with skill.
      const drawTime = a.drawTime ? a.drawTime * drawTimeFactor(skill) : undefined;
      const reloadTime = a.reloadTime ? a.reloadTime * reloadTimeFactor(skill) : undefined;
      const stamina = (a.stamina || 0) * sf + (drawTime ? drawTime * a.drawStamina : 0) + (a.reloadStamina || 0);
      const eitr = (a.eitr || 0) * sf + (a.reloadEitr || 0);
      const avg = hit * (lo + hi) / 2;
      // The last swing of a melee combo deals double damage.
      const finisher = a.type === 'melee' && a.chain > 1 ? { hitNumber: a.chain, hit: hit * 2 } : null;
      return {
        label: i === 0 ? 'Primary' : 'Secondary',
        mul: a.mul,
        hit,
        range: [hit * lo, hit * hi],
        stamina,
        eitr,
        healthPercent: a.healthPercent || 0,
        perCost: stamina > 0 ? avg / stamina : eitr > 0 ? avg / eitr : null,
        costUnit: stamina > 0 ? 'stamina' : eitr > 0 ? 'eitr' : null,
        drawTime,
        reloadTime,
        finisher,
        projectiles: a.reloadTime ? 1 : a.projectiles || 1,
      };
    });
    const block = atLevel(w.block, lvl);
    return {
      w, lvl, ammo, dmg, combat, tool,
      range: [combat * lo, combat * hi],
      attacks,
      block,
      parry: block * w.parryBonus,
      parryForce: atLevel(w.parryForce, lvl),
      durability: atLevel(w.durability, lvl),
      hypothetical: lvl > w.maxLvl,
    };
  }

  const isRanged = (w) => w.skill === 'Bows' || w.skill === 'Crossbows';
  const ammoTypeFor = (w) => (w.skill === 'Crossbows' ? 'bolt' : w.skill === 'Bows' ? 'arrow' : null);

  const api = {
    MOD_MULT, COMBAT_TYPES, TOOL_TYPES, SLOTS,
    atLevel, armorReduce, loadoutStats, withTrinketBuff, damageTaken, skillRange, staminaFactor, drawTimeFactor, weaponStats,
    isRanged, ammoTypeFor, strongerMod,
  };
  root.VH_CALC = api;
})(typeof window !== 'undefined' ? window : globalThis);
