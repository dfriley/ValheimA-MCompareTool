(function () {
  const D = window.VH_DATA;
  const OUTFITS = window.VH_OUTFITS;
  const C = window.VH_CALC;
  const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)'];
  const MAX_COLUMNS = 4;
  const OVER_MAX_CAP = 10;
  const SLOT_LABEL = { head: 'Head', chest: 'Chest', legs: 'Legs', cape: 'Cape' };
  const BIOMES = ['Starter', 'Meadows', 'Black Forest', 'Swamp', 'Mountains', 'Plains', 'Mistlands', 'Ashlands', 'Deep North', 'Endgame'];
  const MOD_LABEL = {
    immune: 'immune', veryResistant: 'very resistant', resistant: 'resistant', slightlyResistant: 'slightly resistant',
    slightlyWeak: 'slightly weak', weak: 'weak', veryWeak: 'very weak',
  };
  const STAMINA_LABEL = {
    attack: 'Attack stamina', block: 'Block stamina', dodge: 'Dodge stamina', run: 'Run stamina',
    sneak: 'Sneak stamina', swim: 'Swim stamina', home: 'Stamina at home', jump: 'Jump stamina',
  };

  const data = {
    armorById: Object.fromEntries(D.armors.map((a) => [a.id, a])),
    weaponById: Object.fromEntries(D.weapons.map((w) => [w.id, w])),
    ammoById: Object.fromEntries(D.ammo.map((a) => [a.id, a])),
    sets: D.sets,
  };

  // ---------- state ----------
  const outfitById = Object.fromEntries(OUTFITS.map((o) => [o.id, o]));
  const fromOutfit = (id, lvl) => {
    const o = outfitById[id];
    const slots = {};
    for (const s of C.SLOTS) {
      const itemId = o.pieces[s];
      slots[s] = itemId ? { id: itemId, lvl: Math.min(lvl, data.armorById[itemId].maxLvl) } : null;
    }
    return slots;
  };

  function defaultState() {
    const mixed = fromOutfit('fenris', 4);
    mixed.chest = { id: 'ArmorPaddedCuirass', lvl: 1 };
    return {
      tab: 'armor',
      overMax: false,
      hit: { amount: 90, type: 'slash' },
      skill: 50,
      loadouts: [
        { name: 'Fenris ★4', slots: fromOutfit('fenris', 4) },
        { name: 'Padded ★1', slots: fromOutfit('padded', 1) },
        { name: 'Fenris + padded chest', slots: mixed },
      ],
      weapons: [
        { id: 'AxeIron', lvl: 4 },
        { id: 'AxeBlackMetal', lvl: 1 },
      ],
    };
  }

  const STORE_KEY = 'vh-compare-v1';
  let state = load() || defaultState();
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!Array.isArray(s.loadouts) || !Array.isArray(s.weapons)) return null;
      return { ...defaultState(), ...s };
    } catch { return null; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  }

  const maxFor = (item) => (state.overMax ? Math.max(item.maxLvl, OVER_MAX_CAP) : item.maxLvl);
  const clampLvl = (item, lvl) => Math.max(1, Math.min(lvl, maxFor(item)));

  // ---------- helpers ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, d = 1) => {
    if (n == null || Number.isNaN(n)) return '–';
    const r = Math.round(n * 10 ** d) / 10 ** d;
    return r.toLocaleString('en-US', { maximumFractionDigits: d });
  };
  const pct = (n, d = 0) => `${n > 0 ? '+' : ''}${fmt(n * 100, d)}%`;
  const dt = (type) => `--dt: var(--d-${type})`;

  /** Delta badge vs the first column. higherIsBetter decides colour. */
  function delta(val, base, { higherIsBetter = true, unit = '', digits = 1, asPct = false } = {}) {
    if (base == null || val == null) return '';
    const diff = val - base;
    if (Math.abs(diff) < 1e-9) return '<span class="delta same">=</span>';
    const good = higherIsBetter ? diff > 0 : diff < 0;
    const txt = asPct ? `${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff) * 100, digits)} pts` : `${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff), digits)}${unit}`;
    const rel = !asPct && base !== 0 ? ` (${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff / base) * 100, 0)}%)` : '';
    return `<span class="delta ${good ? 'up' : 'down'}">${txt}${rel}</span>`;
  }

  function pips(idPrefix, item, lvl, action, idx, slot) {
    const max = maxFor(item);
    let html = `<div class="pips" role="group" aria-label="Upgrade level">`;
    for (let q = 1; q <= max; q++) {
      const over = q > item.maxLvl;
      html += `<button type="button" id="${idPrefix}-q${q}" class="pip${q <= lvl ? ' on' : ''}${over ? ' over' : ''}"
        data-action="${action}" data-idx="${idx}"${slot ? ` data-slot="${slot}"` : ''} data-lvl="${q}"
        aria-pressed="${q === lvl}" title="${over ? `Level ${q} (past in-game max of ${item.maxLvl})` : `Level ${q}`}">${q}</button>`;
    }
    return html + '</div>';
  }

  // ---------- armor tab ----------
  const armorBySlot = {};
  for (const a of D.armors) (armorBySlot[a.slot] ||= []).push(a);

  function armorOptions(slot, selected) {
    const groups = {};
    for (const a of armorBySlot[slot] || []) (groups[a.biome] ||= []).push(a);
    let html = `<option value=""${selected ? '' : ' selected'}>— none —</option>`;
    for (const b of BIOMES) {
      if (!groups[b]) continue;
      html += `<optgroup label="${b}">` + groups[b].map((a) =>
        `<option value="${a.id}"${a.id === selected ? ' selected' : ''}>${esc(a.name)} · ${fmt(a.armor[0])}–${fmt(C.atLevel(a.armor, a.maxLvl))}</option>`).join('') + '</optgroup>';
    }
    return html;
  }

  function matchingOutfit(lo) {
    return OUTFITS.find((o) => C.SLOTS.every((s) => (o.pieces[s] || null) === (lo.slots[s]?.id || null)))?.id || '';
  }

  function outfitOptions(selected) {
    let html = `<option value=""${selected ? '' : ' selected'}>Custom mix</option>`;
    for (const b of BIOMES) {
      const os = OUTFITS.filter((o) => o.biome === b);
      if (!os.length) continue;
      html += `<optgroup label="${b}">` + os.map((o) => `<option value="${o.id}"${o.id === selected ? ' selected' : ''}>${esc(o.name)}</option>`).join('') + '</optgroup>';
    }
    return html;
  }

  function loadoutCard(lo, i) {
    const outfit = matchingOutfit(lo);
    const items = C.SLOTS.map((s) => lo.slots[s] && data.armorById[lo.slots[s].id]).filter(Boolean);
    const levels = C.SLOTS.map((s) => lo.slots[s]?.lvl).filter(Boolean);
    const allLvl = levels.length && levels.every((l) => l === levels[0]) ? levels[0] : 0;
    const maxAll = items.length ? Math.max(...items.map(maxFor)) : 4;
    const fake = { maxLvl: Math.max(...items.map((x) => x.maxLvl), 1) };
    let allPips = '<div class="pips" role="group" aria-label="Set every piece to level">';
    for (let q = 1; q <= maxAll; q++) {
      const over = q > fake.maxLvl;
      allPips += `<button type="button" id="lo${i}-all-q${q}" class="pip${q <= allLvl ? ' on' : ''}${over ? ' over' : ''}" data-action="lo-all" data-idx="${i}" data-lvl="${q}" aria-pressed="${q === allLvl}" title="Set every piece to level ${q}">${q}</button>`;
    }
    allPips += '</div>';

    const slots = C.SLOTS.map((s) => {
      const pick = lo.slots[s];
      const item = pick && data.armorById[pick.id];
      return `<div class="slot">
        <label class="slot-label" for="lo${i}-${s}">${SLOT_LABEL[s]}</label>
        <select id="lo${i}-${s}" data-action="lo-slot" data-idx="${i}" data-slot="${s}">${armorOptions(s, pick?.id)}</select>
        ${item ? `<div class="lvl">${pips(`lo${i}-${s}`, item, pick.lvl, 'lo-lvl', i, s)}</div>` : ''}
      </div>`;
    }).join('');

    return `<section class="card" style="--series:${SERIES[i]}" aria-label="Loadout ${i + 1}">
      <div class="card-head">
        <span class="tag">${i === 0 ? 'Baseline' : `Loadout ${String.fromCharCode(65 + i)}`}</span>
        <input type="text" id="lo${i}-name" aria-label="Loadout name" value="${esc(lo.name)}" data-action="lo-name" data-idx="${i}">
        ${state.loadouts.length > 1 ? `<button type="button" class="btn ghost" id="lo${i}-rm" data-action="lo-rm" data-idx="${i}" aria-label="Remove loadout">✕</button>` : ''}
      </div>
      <label class="field"><span>Outfit</span>
        <select id="lo${i}-outfit" data-action="lo-outfit" data-idx="${i}">${outfitOptions(outfit)}</select>
      </label>
      <div class="field"><span>All pieces to level</span>${allPips}</div>
      ${slots}
    </section>`;
  }

  function resistChips(resist) {
    const entries = Object.entries(resist).filter(([, r]) => r.mod && r.mod !== 'normal');
    if (!entries.length) return '<span class="none">None</span>';
    return '<div class="chips">' + entries.map(([type, r]) => {
      const weak = /weak/i.test(r.mod);
      const title = r.sources.map((s) => `${s.source}: ${MOD_LABEL[s.mod] || s.mod}`).join('\n');
      return `<span class="chip${weak ? ' weak' : ''}" style="${dt(type)}" title="${esc(title)}"><b>${type}</b> ${MOD_LABEL[r.mod]}</span>`;
    }).join('') + '</div>';
  }

  function setLines(sets) {
    if (!sets.length) return '<span class="none">No set pieces</span>';
    return sets.map(({ set, count, active }) => {
      const perks = describeEffect(set);
      return `<span class="setline ${active ? 'active' : 'partial'}"><b>${esc(set.name || set.id)}</b> ${count}/${set.pieces}${active ? ' · active' : ' · inactive'}${perks.length ? `<span class="sub">${perks.join(' · ')}</span>` : ''}</span>`;
    }).join('');
  }

  function describeEffect(e) {
    const out = [];
    for (const [skill, v] of Object.entries(e.skillModifiers || {})) out.push(`${skill} +${v}`);
    if (e.healthRegen) out.push(`Health regen ${pct(e.healthRegen - 1)}`);
    if (e.staminaRegen) out.push(`Stamina regen ${pct(e.staminaRegen - 1)}`);
    if (e.eitrRegen) out.push(`Eitr regen ${pct(e.eitrRegen - 1)}`);
    for (const k of ['runStamina', 'jumpStamina', 'attackStamina', 'dodgeStamina']) {
      if (e[k]) out.push(`${k.replace('Stamina', '')} stamina ${pct(e[k])}`);
    }
    for (const [t, v] of Object.entries(e.damageValueModifiers || {})) out.push(`${t} damage ${pct(v)}`);
    for (const [t, m] of Object.entries(e.damageModifiers || {})) out.push(`${MOD_LABEL[m]} to ${t}`);
    if (e.fallDamage === 0) out.push('No fall damage');
    if (e.windMovementModifier) out.push('Faster with tailwind');
    return out;
  }

  function armorResults() {
    const stats = state.loadouts.map((lo) => C.loadoutStats(lo, data));
    const base = stats[0];
    const { amount, type } = state.hit;
    const taken = stats.map((s) => C.damageTaken(amount, type, s));
    const head = `<thead><tr><th scope="col">Stat</th>${state.loadouts.map((lo, i) =>
      `<th scope="col" style="--series:${SERIES[i]}"><span class="sw"></span>${esc(lo.name)}${stats[i].hypothetical ? '<span class="hypo">hypothetical</span>' : ''}</th>`).join('')}</tr></thead>`;

    const row = (label, cells, cls = '') => `<tr class="${cls}"><th scope="row">${label}</th>${cells.join('')}</tr>`;
    const rows = [];
    rows.push(row('Total armor', stats.map((s, i) => `<td><span class="num">${fmt(s.armor)}</span>${i ? delta(s.armor, base.armor) : ''}</td>`), 'big'));
    rows.push(row(`Damage taken<span class="sub">${fmt(amount, 0)} ${type} hit</span>`, taken.map((t, i) =>
      `<td><span class="num">${fmt(t)}</span>${i ? delta(t, taken[0], { higherIsBetter: false }) : ''}<span class="sub">${fmt(amount > 0 ? (1 - t / amount) * 100 : 0, 0)}% mitigated</span></td>`), 'big'));
    rows.push(row('Weight', stats.map((s, i) => `<td><span class="num">${fmt(s.weight)}</span>${i ? delta(s.weight, base.weight, { higherIsBetter: false }) : ''}</td>`)));
    rows.push(row('Movement speed', stats.map((s, i) => `<td><span class="num">${pct(s.moveSpeed)}</span>${i ? delta(s.moveSpeed, base.moveSpeed, { asPct: true }) : ''}</td>`)));
    rows.push(row('Eitr regen', stats.map((s, i) => `<td><span class="num">${pct(s.eitrRegen)}</span>${i ? delta(s.eitrRegen, base.eitrRegen, { asPct: true }) : ''}</td>`)));
    rows.push(row('Resistances', stats.map((s) => `<td>${resistChips(s.resist)}</td>`)));
    rows.push(row('Set bonus', stats.map((s) => `<td>${setLines(s.sets)}</td>`)));
    rows.push(row('Stamina effects', stats.map((s) => {
      const items = Object.entries(s.stamina).filter(([, v]) => v);
      return `<td>${items.length ? `<ul class="plain">${items.map(([k, v]) => `<li>${STAMINA_LABEL[k] || k} ${pct(v)}</li>`).join('')}</ul>` : '<span class="none">None</span>'}</td>`;
    })));
    rows.push(row('Item effects', stats.map((s) => {
      const fx = s.effects.flatMap((e) => describeEffect(e).map((d) => `${d} <span class="sub">${esc(e.source)}</span>`));
      return `<td>${fx.length ? `<ul class="plain">${fx.map((f) => `<li>${f}</li>`).join('')}</ul>` : '<span class="none">None</span>'}</td>`;
    })));
    rows.push(`<tr class="group"><th colspan="${stats.length + 1}">Piece by piece</th></tr>`);
    for (const slot of C.SLOTS) {
      rows.push(row(SLOT_LABEL[slot], stats.map((s) => {
        const p = s.pieces.find((x) => x.slot === slot);
        if (!p) return '<td><span class="none">—</span></td>';
        return `<td>${esc(p.item.name)} <span class="num">★${p.lvl}</span>${p.hypothetical ? '<span class="hypo">past max</span>' : ''}
          <span class="sub">${fmt(p.armor)} armor · ${p.durability == null ? '∞' : fmt(p.durability, 0)} durability · ${fmt(p.item.weight)} wt</span></td>`;
      })));
    }
    return { html: `<div class="table-scroll"><table class="ledger">${head}<tbody>${rows.join('')}</tbody></table></div>`, stats };
  }

  function damageChart(stats) {
    const { amount, type } = state.hit;
    const W = 640, H = 260, L = 44, R = 16, T = 12, B = 34;
    const xMax = Math.max(200, Math.ceil((amount * 1.5) / 50) * 50);
    const curves = stats.map((s) => {
      const pts = [];
      for (let k = 0; k <= 80; k++) {
        const x = (xMax * k) / 80;
        pts.push([x, C.damageTaken(x, type, s)]);
      }
      return pts;
    });
    const yMaxRaw = Math.max(1, ...curves.flat().map((p) => p[1]));
    const step = niceStep(yMaxRaw);
    const yMax = Math.ceil(yMaxRaw / step) * step;
    const sx = (x) => L + (x / xMax) * (W - L - R);
    const sy = (y) => T + (1 - y / yMax) * (H - T - B);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Damage taken versus incoming ${type} hit size for each loadout">`;
    for (let y = 0; y <= yMax + 1e-9; y += step) {
      svg += `<line x1="${L}" x2="${W - R}" y1="${sy(y)}" y2="${sy(y)}" stroke="var(--line)" stroke-width="1"/>`;
      svg += `<text x="${L - 6}" y="${sy(y) + 4}" text-anchor="end">${fmt(y, 0)}</text>`;
    }
    const xStep = niceStep(xMax);
    for (let x = 0; x <= xMax + 1e-9; x += xStep) {
      svg += `<text x="${sx(x)}" y="${H - B + 16}" text-anchor="middle">${fmt(x, 0)}</text>`;
    }
    svg += `<text x="${(L + W - R) / 2}" y="${H - 4}" text-anchor="middle">incoming ${type} hit</text>`;
    svg += `<line x1="${sx(amount)}" x2="${sx(amount)}" y1="${T}" y2="${H - B}" stroke="var(--muted)" stroke-dasharray="3 4" stroke-width="1"/>`;
    curves.forEach((pts, i) => {
      const d = pts.map((p, k) => `${k ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join('');
      svg += `<path d="${d}" fill="none" stroke="${SERIES[i]}" stroke-width="2.5" stroke-linejoin="round"/>`;
      const t = C.damageTaken(amount, type, stats[i]);
      svg += `<circle cx="${sx(amount)}" cy="${sy(t)}" r="4.5" fill="${SERIES[i]}" stroke="var(--surface)" stroke-width="1.5"/>`;
    });
    svg += '</svg>';
    const legend = state.loadouts.map((lo, i) => `<span style="--series:${SERIES[i]}"><i></i>${esc(lo.name)}</span>`).join('');
    return `<div class="chart-box">${svg}<div class="legend">${legend}</div></div>`;
  }

  function niceStep(max) {
    const raw = max / 5;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const n = raw / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
  }

  function renderArmor() {
    const cards = state.loadouts.map(loadoutCard).join('') +
      (state.loadouts.length < MAX_COLUMNS ? `<button type="button" class="add-card" id="lo-add" data-action="lo-add">+ Add loadout</button>` : '');
    const { html, stats } = armorResults();
    const types = ['blunt', 'slash', 'pierce', 'fire', 'frost', 'lightning', 'poison', 'spirit'];
    return `
      <div class="cards">${cards}</div>
      <div class="toolbar">
        <div class="field">
          <span>Incoming hit: <output id="hit-out">${fmt(state.hit.amount, 0)}</output></span>
          <input type="range" id="hit-amount" min="5" max="400" step="5" value="${state.hit.amount}" data-action="hit-amount" aria-label="Incoming hit damage">
        </div>
        <label class="field"><span>Damage type</span>
          <select id="hit-type" data-action="hit-type">${types.map((t) => `<option value="${t}"${t === state.hit.type ? ' selected' : ''}>${t}</option>`).join('')}</select>
        </label>
      </div>
      <div id="armor-results">${html}</div>
      <h2>Damage taken by hit size</h2>
      <p class="note">How much of a single ${state.hit.type} hit gets through each loadout, no shield or block. Armor shaves a flat amount off small hits and loses ground as hits grow, which is why the lines bend upward.</p>
      <div id="armor-chart">${damageChart(stats)}</div>`;
  }

  // ---------- weapons tab ----------
  const SKILL_ORDER = ['Axes', 'Swords', 'Clubs', 'Knives', 'Spears', 'Polearms', 'Fists', 'Bows', 'Crossbows', 'Elemental magic', 'Blood magic', 'Pickaxes', 'Shields'];
  const weaponGroups = {};
  for (const w of D.weapons) (weaponGroups[w.skill] ||= []).push(w);
  for (const g of Object.values(weaponGroups)) g.sort((a, b) => a.tier - b.tier);

  function weaponOptions(selected) {
    const order = [...SKILL_ORDER, ...Object.keys(weaponGroups).filter((k) => !SKILL_ORDER.includes(k))];
    return order.filter((k) => weaponGroups[k]).map((k) => `<optgroup label="${k}">` + weaponGroups[k].map((w) =>
      `<option value="${w.id}"${w.id === selected ? ' selected' : ''}>${esc(w.name)} · ${w.biome}</option>`).join('') + '</optgroup>').join('');
  }

  function ammoOptions(w, selected) {
    const type = C.ammoTypeFor(w);
    const list = D.ammo.filter((a) => a.type === type).sort((a, b) => a.tier - b.tier);
    return `<option value=""${selected ? '' : ' selected'}>No ${type} (weapon only)</option>` + list.map((a) => {
      const total = Object.values(a.damage).reduce((x, y) => x + y, 0);
      return `<option value="${a.id}"${a.id === selected ? ' selected' : ''}>${esc(a.name)} · ${fmt(total, 0)}</option>`;
    }).join('');
  }

  function weaponCard(pick, i) {
    const w = data.weaponById[pick.id];
    return `<section class="card" style="--series:${SERIES[i]}" aria-label="Weapon ${i + 1}">
      <div class="card-head">
        <span class="tag">${i === 0 ? 'Baseline' : `Weapon ${String.fromCharCode(65 + i)}`}</span>
        <span style="flex:1"></span>
        ${state.weapons.length > 1 ? `<button type="button" class="btn ghost" id="wp${i}-rm" data-action="wp-rm" data-idx="${i}" aria-label="Remove weapon">✕</button>` : ''}
      </div>
      <label class="field"><span>Weapon</span>
        <select id="wp${i}-id" data-action="wp-id" data-idx="${i}">${weaponOptions(pick.id)}</select>
      </label>
      <div class="field"><span>Upgrade level</span>${pips(`wp${i}`, w, pick.lvl, 'wp-lvl', i)}</div>
      ${C.isRanged(w) ? `<label class="field"><span>Ammo</span><select id="wp${i}-ammo" data-action="wp-ammo" data-idx="${i}">${ammoOptions(w, pick.ammo)}</select></label>` : ''}
    </section>`;
  }

  function dmgChips(dmg) {
    const entries = Object.entries(dmg).filter(([, v]) => v);
    if (!entries.length) return '<span class="none">None</span>';
    return '<div class="chips">' + entries.map(([t, v]) => `<span class="chip" style="${dt(t)}"><b>${t}</b> ${fmt(v)}</span>`).join('') + '</div>';
  }

  function weaponResults() {
    const stats = state.weapons.map((p) => C.weaponStats(p, state.skill, data));
    const base = stats[0];
    const maxCombat = Math.max(1, ...stats.map((s) => s.combat));
    const head = `<thead><tr><th scope="col">Stat</th>${stats.map((s, i) =>
      `<th scope="col" style="--series:${SERIES[i]}"><span class="sw"></span>${esc(s.w.name)} <span class="num">★${s.lvl}</span>${s.hypothetical ? '<span class="hypo">hypothetical</span>' : ''}${s.ammo ? `<span class="sub">+ ${esc(s.ammo.name)}</span>` : ''}</th>`).join('')}</tr></thead>`;
    const row = (label, cells, cls = '') => `<tr class="${cls}"><th scope="row">${label}</th>${cells.join('')}</tr>`;
    const rows = [];
    rows.push(row('Damage per hit<span class="sub">tooltip value</span>', stats.map((s, i) => {
      const bar = Object.entries(s.dmg).filter(([t, v]) => v && C.COMBAT_TYPES.includes(t))
        .map(([t, v]) => `<span style="${dt(t)};width:${(v / maxCombat) * 100}%" title="${t} ${fmt(v)}"></span>`).join('');
      return `<td><span class="num">${fmt(s.combat)}</span>${i ? delta(s.combat, base.combat) : ''}<div class="dbar" aria-hidden="true">${bar}</div></td>`;
    }), 'big'));
    rows.push(row('Damage types', stats.map((s) => `<td>${dmgChips(Object.fromEntries(Object.entries(s.dmg).filter(([t]) => C.COMBAT_TYPES.includes(t))))}</td>`)));
    rows.push(row(`Real hit range<span class="sub">at skill ${state.skill}</span>`, stats.map((s, i) =>
      `<td><span class="num">${fmt(s.range[0], 0)}–${fmt(s.range[1], 0)}</span>${i ? delta((s.range[0] + s.range[1]) / 2, (base.range[0] + base.range[1]) / 2) : ''}</td>`)));
    if (stats.some((s) => s.tool)) {
      rows.push(row('Tool damage<span class="sub">chop / pickaxe</span>', stats.map((s) => {
        const t = Object.fromEntries(Object.entries(s.dmg).filter(([k]) => C.TOOL_TYPES.includes(k)));
        return `<td>${dmgChips(t)}${s.w.toolTier ? `<span class="sub">tool tier ${s.w.toolTier}</span>` : ''}</td>`;
      })));
    }
    const maxAttacks = Math.max(...stats.map((s) => s.attacks.length));
    for (let a = 0; a < maxAttacks; a++) {
      rows.push(`<tr class="group"><th colspan="${stats.length + 1}">${a === 0 ? 'Primary attack' : 'Secondary attack'}</th></tr>`);
      const baseAtk = base.attacks[a];
      rows.push(row('Hit', stats.map((s, i) => {
        const at = s.attacks[a];
        if (!at) return '<td><span class="none">—</span></td>';
        return `<td><span class="num">${fmt(at.hit)}</span>${at.mul !== 1 ? `<span class="sub">×${fmt(at.mul, 2)} multiplier</span>` : ''}${at.projectiles > 1 ? `<span class="sub">${at.projectiles} projectiles</span>` : ''}${i && baseAtk ? delta(at.hit, baseAtk.hit) : ''}</td>`;
      })));
      rows.push(row(`Cost<span class="sub">at skill ${state.skill}</span>`, stats.map((s, i) => {
        const at = s.attacks[a];
        if (!at) return '<td><span class="none">—</span></td>';
        const parts = [];
        if (at.stamina) parts.push(`${fmt(at.stamina)} stamina`);
        if (at.eitr) parts.push(`${fmt(at.eitr)} eitr`);
        if (at.healthPercent) parts.push(`${fmt(at.healthPercent * 100, 0)}% health`);
        const cost = at.stamina || at.eitr;
        const bcost = baseAtk && (baseAtk.stamina || baseAtk.eitr);
        return `<td><span class="num">${parts.join(' + ') || 'free'}</span>${i && bcost && cost && baseAtk.costUnit === at.costUnit ? delta(cost, bcost, { higherIsBetter: false }) : ''}${at.drawTime ? `<span class="sub">${fmt(at.drawTime)}s full draw</span>` : ''}${at.reloadTime ? `<span class="sub">${fmt(at.reloadTime)}s reload</span>` : ''}</td>`;
      })));
      rows.push(row('Damage per point', stats.map((s, i) => {
        const at = s.attacks[a];
        if (!at || at.perCost == null) return '<td><span class="none">—</span></td>';
        const b = baseAtk && baseAtk.costUnit === at.costUnit ? baseAtk.perCost : null;
        return `<td><span class="num">${fmt(at.perCost)}</span> <span class="sub">avg damage per ${at.costUnit}</span>${i && b != null ? delta(at.perCost, b) : ''}</td>`;
      })));
    }
    rows.push(`<tr class="group"><th colspan="${stats.length + 1}">Defense & handling</th></tr>`);
    rows.push(row('Block armor', stats.map((s, i) => `<td><span class="num">${fmt(s.block)}</span>${i ? delta(s.block, base.block) : ''}</td>`)));
    rows.push(row('Parry block armor', stats.map((s, i) => `<td><span class="num">${fmt(s.parry)}</span><span class="sub">×${fmt(s.w.parryBonus, 1)} parry bonus</span>${i ? delta(s.parry, base.parry) : ''}</td>`)));
    rows.push(row('Parry force', stats.map((s, i) => `<td><span class="num">${fmt(s.parryForce)}</span>${i ? delta(s.parryForce, base.parryForce) : ''}</td>`)));
    rows.push(row('Backstab', stats.map((s, i) => `<td><span class="num">×${fmt(s.w.backstab)}</span>${i ? delta(s.w.backstab, base.w.backstab) : ''}</td>`)));
    rows.push(row('Knockback', stats.map((s, i) => `<td><span class="num">${fmt(s.w.knockback)}</span>${i ? delta(s.w.knockback, base.w.knockback) : ''}</td>`)));
    rows.push(row('Durability', stats.map((s, i) => `<td><span class="num">${fmt(s.durability, 0)}</span>${i ? delta(s.durability, base.durability, { digits: 0 }) : ''}</td>`)));
    rows.push(row('Weight', stats.map((s, i) => `<td><span class="num">${fmt(s.w.weight)}</span>${i ? delta(s.w.weight, base.w.weight, { higherIsBetter: false }) : ''}</td>`)));
    rows.push(row('Movement speed', stats.map((s, i) => `<td><span class="num">${pct(s.w.moveSpeed)}</span>${i ? delta(s.w.moveSpeed, base.w.moveSpeed, { asPct: true }) : ''}</td>`)));
    rows.push(row('Hands', stats.map((s) => `<td>${{ primary: 'One-handed', both: 'Two-handed', secondary: 'Off-hand', bow: 'Two-handed (ranged)', either: 'Either hand' }[s.w.hands] || s.w.hands}<span class="sub">${s.w.skill} · ${s.w.biome}</span></td>`)));
    return `<div class="table-scroll"><table class="ledger">${head}<tbody>${rows.join('')}</tbody></table></div>`;
  }

  function renderWeapons() {
    const cards = state.weapons.map(weaponCard).join('') +
      (state.weapons.length < MAX_COLUMNS ? `<button type="button" class="add-card" id="wp-add" data-action="wp-add">+ Add weapon</button>` : '');
    return `
      <div class="cards">${cards}</div>
      <div class="toolbar">
        <div class="field">
          <span>Weapon skill level: <output id="skill-out">${state.skill}</output></span>
          <input type="range" id="skill" min="0" max="100" step="1" value="${state.skill}" data-action="skill" aria-label="Weapon skill level">
        </div>
        <p class="note" style="margin:0;flex:2 1 280px">The tooltip number is the most a hit can roll. Your skill sets the actual roll range and trims stamina and eitr cost by up to 33%. Bow and crossbow damage adds the ammo you pick.</p>
      </div>
      <div id="weapon-results">${weaponResults()}</div>`;
  }

  // ---------- render + events ----------
  const app = document.getElementById('app');
  function render() {
    const focusId = document.activeElement?.id;
    document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === state.tab)));
    document.getElementById('over-max').checked = state.overMax;
    app.innerHTML = state.tab === 'armor' ? renderArmor() : renderWeapons();
    if (focusId) document.getElementById(focusId)?.focus();
    save();
  }
  // Lightweight refresh for sliders, so dragging isn't interrupted by a full re-render.
  function renderResultsOnly() {
    if (state.tab === 'armor') {
      const { html, stats } = armorResults();
      document.getElementById('armor-results').innerHTML = html;
      document.getElementById('armor-chart').innerHTML = damageChart(stats);
      document.getElementById('hit-out').textContent = fmt(state.hit.amount, 0);
    } else {
      document.getElementById('weapon-results').innerHTML = weaponResults();
      document.getElementById('skill-out').textContent = state.skill;
    }
    save();
  }

  function clampAll() {
    for (const lo of state.loadouts) for (const s of C.SLOTS) {
      const p = lo.slots[s];
      if (p) p.lvl = clampLvl(data.armorById[p.id], p.lvl);
    }
    for (const w of state.weapons) w.lvl = clampLvl(data.weaponById[w.id], w.lvl);
  }

  function onAction(el, ev) {
    const a = el.dataset.action;
    const i = +el.dataset.idx;
    const lo = state.loadouts[i];
    switch (a) {
      case 'tab': state.tab = el.dataset.tab; break;
      case 'over-max': state.overMax = el.checked; clampAll(); break;
      case 'lo-name': lo.name = el.value; return renderResultsOnly(); // leave the input alone while typing
      case 'lo-outfit': {
        if (!el.value) return render();
        const lvls = C.SLOTS.map((s) => lo.slots[s]?.lvl).filter(Boolean);
        const keep = lvls.length ? Math.max(...lvls) : 1;
        lo.slots = fromOutfit(el.value, keep);
        for (const s of C.SLOTS) if (lo.slots[s]) lo.slots[s].lvl = clampLvl(data.armorById[lo.slots[s].id], keep);
        break;
      }
      case 'lo-slot': {
        const s = el.dataset.slot;
        const prev = lo.slots[s]?.lvl || 1;
        lo.slots[s] = el.value ? { id: el.value, lvl: clampLvl(data.armorById[el.value], prev) } : null;
        break;
      }
      case 'lo-lvl': lo.slots[el.dataset.slot].lvl = +el.dataset.lvl; break;
      case 'lo-all':
        for (const s of C.SLOTS) if (lo.slots[s]) lo.slots[s].lvl = clampLvl(data.armorById[lo.slots[s].id], +el.dataset.lvl);
        break;
      case 'lo-add': {
        const last = state.loadouts[state.loadouts.length - 1];
        state.loadouts.push({ name: `Loadout ${String.fromCharCode(65 + state.loadouts.length)}`, slots: structuredClone(last.slots) });
        break;
      }
      case 'lo-rm': state.loadouts.splice(i, 1); break;
      case 'hit-amount': state.hit.amount = +el.value; return renderResultsOnly();
      case 'hit-type': state.hit.type = el.value; break;
      case 'wp-id': {
        const w = data.weaponById[el.value];
        state.weapons[i] = { id: el.value, lvl: clampLvl(w, state.weapons[i].lvl) };
        break;
      }
      case 'wp-lvl': state.weapons[i].lvl = +el.dataset.lvl; break;
      case 'wp-ammo': state.weapons[i].ammo = el.value || undefined; break;
      case 'wp-add': state.weapons.push({ ...state.weapons[state.weapons.length - 1] }); break;
      case 'wp-rm': state.weapons.splice(i, 1); break;
      case 'skill': state.skill = +el.value; return renderResultsOnly();
      case 'reset': state = defaultState(); break;
      default: return;
    }
    render();
  }

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('button[data-action]');
    if (el) onAction(el, ev);
  });
  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.matches('select[data-action], input[type="checkbox"][data-action]')) onAction(el, ev);
  });
  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.matches('input[type="range"][data-action], input[type="text"][data-action]')) onAction(el, ev);
  });

  const src = D.source;
  document.getElementById('source').innerHTML =
    `Item data from <a href="${src.repo}" target="_blank" rel="noopener">kirilloid's Valheim database</a> (commit ${esc(src.commit.slice(0, 7))}, pulled ${esc(src.extracted)}). ` +
    `Levels shown with a dashed outline are past the in-game max and extrapolated with the same per-level gain.`;

  render();
})();
