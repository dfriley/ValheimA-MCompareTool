(function () {
  const D = window.VH_DATA;
  const OUTFITS = window.VH_OUTFITS;
  const C = window.VH_CALC;
  const BIOMES = D.biomes; // index + 1 = progression step
  const SERIES = ['var(--s1)', 'var(--s2)'];
  const OVER_MAX_CAP = 10;
  const SLOT_LABEL = { head: 'Head', chest: 'Chest', legs: 'Legs', cape: 'Cape' };
  // The outfit most players are wearing by the end of each biome; used for the starting comparison.
  const MAIN_OUTFIT = { 1: 'leather', 2: 'bronze', 3: 'iron', 4: 'wolf', 5: 'padded', 6: 'carapace', 7: 'flametal', 8: 'protector' };
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
  const outfitById = Object.fromEntries(OUTFITS.map((o) => [o.id, o]));
  for (const o of OUTFITS) o.prog = Math.max(...Object.values(o.pieces).map((id) => data.armorById[id].prog));

  // ---------- state ----------
  const STORE_KEY = 'vh-compare-v2';
  let state = load() || { progress: null, tab: 'armor', overMax: false, hit: { amount: 90, type: 'slash' }, skill: 50 };
  let gateOpen = !state.progress;

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (!s || !s.progress || !Array.isArray(s.profiles) || !Array.isArray(s.weapons)) return null;
      return s;
    } catch { return null; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  }

  const unlocked = (x) => x && x.prog <= state.progress;
  const maxFor = (item) => (state.overMax ? Math.max(item.maxLvl, OVER_MAX_CAP) : item.maxLvl);
  const clampLvl = (item, lvl) => Math.max(1, Math.min(lvl, maxFor(item)));
  const outfitMax = (o) => Math.max(...Object.values(o.pieces).map((id) => maxFor(data.armorById[id])));
  const outfitRealMax = (o) => Math.max(...Object.values(o.pieces).map((id) => data.armorById[id].maxLvl));

  function slotsFromOutfit(outfitId, lvl) {
    const o = outfitById[outfitId];
    const slots = {};
    for (const s of C.SLOTS) {
      const id = o.pieces[s];
      slots[s] = id ? { id, lvl: clampLvl(data.armorById[id], lvl) } : null;
    }
    return slots;
  }
  const profileSlots = (p) => (p.mode === 'outfit' ? slotsFromOutfit(p.outfit, p.lvl) : p.slots);
  const profileLoadout = (p) => ({ slots: profileSlots(p), trinket: p.trinket });

  function autoName(p) {
    if (p.mode === 'outfit') return `${outfitById[p.outfit].name} ★${p.lvl}`;
    const pieces = C.SLOTS.map((s) => p.slots[s]).filter(Boolean);
    return pieces.length ? 'Custom mix' : 'Nothing equipped';
  }
  const displayName = (p) => p.name.trim() || autoName(p);

  /** Last biome's best one-hander at max level vs this biome's at level 1, in the first weapon line that has one. */
  function defaultWeapons(P) {
    const combat = (w) => C.weaponStats({ id: w.id, lvl: 1 }, 0, data).combat;
    const oneHanders = D.weapons.filter((w) => w.kind === 'weapon' && w.hands === 'primary' && w.prog <= P && combat(w) > 0);
    for (const skill of ['Axes', 'Swords', 'Clubs', 'Spears', 'Knives']) {
      const line = oneHanders.filter((w) => w.skill === skill).sort((a, b) => a.prog - b.prog || combat(a) - combat(b));
      if (!line.some((w) => w.prog === P)) continue;
      const best = line[line.length - 1];
      const prev = line.filter((w) => w.prog < P).pop() || line[line.length - 2] || best;
      return [{ id: prev.id, lvl: prev.maxLvl }, { id: best.id, lvl: 1 }];
    }
    const line = oneHanders.sort((a, b) => a.prog - b.prog || combat(a) - combat(b));
    const best = line[line.length - 1];
    const prev = line[line.length - 2] || best;
    return [{ id: prev.id, lvl: prev.maxLvl }, { id: best.id, lvl: 1 }];
  }

  function defaultsFor(P) {
    const curId = MAIN_OUTFIT[P];
    const prevId = P === 1 ? 'rags' : MAIN_OUTFIT[P - 1];
    const prevLvl = outfitRealMax(outfitById[prevId]);
    return {
      profiles: [
        { name: '', mode: 'outfit', outfit: prevId, lvl: prevLvl, slots: slotsFromOutfit(prevId, prevLvl), trinket: null },
        { name: '', mode: 'outfit', outfit: curId, lvl: 1, slots: slotsFromOutfit(curId, 1), trinket: null },
      ],
      weapons: defaultWeapons(P),
    };
  }

  /** Drop anything past the player's progress (after lowering it) and keep levels in range. */
  function sanitize() {
    const P = state.progress;
    for (const p of state.profiles) {
      if (!unlocked(outfitById[p.outfit])) p.outfit = MAIN_OUTFIT[P];
      p.lvl = Math.max(1, Math.min(p.lvl, outfitMax(outfitById[p.outfit])));
      for (const s of C.SLOTS) {
        const pick = p.slots[s];
        if (!pick) continue;
        const item = data.armorById[pick.id];
        if (!unlocked(item)) p.slots[s] = null;
        else pick.lvl = clampLvl(item, pick.lvl);
      }
      if (p.trinket && !unlocked(data.armorById[p.trinket])) p.trinket = null;
      // A custom mix that lost every piece falls back to the outfit view instead of showing nothing.
      if (p.mode === 'custom' && !C.SLOTS.some((s) => p.slots[s])) p.mode = 'outfit';
    }
    const fallback = defaultWeapons(P);
    state.weapons.forEach((w, i) => {
      if (!unlocked(data.weaponById[w.id])) state.weapons[i] = fallback[i];
      else w.lvl = clampLvl(data.weaponById[w.id], w.lvl);
      if (w.ammo && !unlocked(data.ammoById[w.ammo])) w.ammo = undefined;
    });
  }

  function setProgress(P) {
    const first = !state.profiles;
    state.progress = P;
    if (first) Object.assign(state, defaultsFor(P));
    else sanitize();
    gateOpen = false;
  }

  // ---------- small render helpers ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, d = 1) => {
    if (n == null || Number.isNaN(n)) return '–';
    const r = Math.round(n * 10 ** d) / 10 ** d;
    return r.toLocaleString('en-US', { maximumFractionDigits: d });
  };
  const pct = (n, d = 0) => `${n > 0 ? '+' : ''}${fmt(n * 100, d)}%`;
  const dt = (type) => `--dt: var(--d-${type})`;

  function delta(val, base, { higherIsBetter = true, digits = 1, asPct = false } = {}) {
    if (base == null || val == null) return '';
    const diff = val - base;
    if (Math.abs(diff) < 1e-9) return '<span class="delta same">same</span>';
    const good = higherIsBetter ? diff > 0 : diff < 0;
    const sign = diff > 0 ? '+' : '−';
    const txt = asPct ? `${sign}${fmt(Math.abs(diff) * 100, digits)} pts` : `${sign}${fmt(Math.abs(diff), digits)}`;
    const rel = !asPct && base !== 0 ? ` (${sign}${fmt(Math.abs(diff / base) * 100, 0)}%)` : '';
    return `<span class="delta ${good ? 'up' : 'down'}">${txt}${rel}</span>`;
  }

  /** One-of-N level picker. Only the chosen level is lit. */
  function levelPicker(idPrefix, realMax, max, lvl, attrs, label) {
    let html = `<div class="lvls" role="radiogroup" aria-label="${label}">`;
    for (let q = 1; q <= max; q++) {
      const over = q > realMax;
      html += `<button type="button" role="radio" id="${idPrefix}-q${q}" class="lvl${q === lvl ? ' on' : ''}${over ? ' over' : ''}"
        ${attrs} data-lvl="${q}" aria-checked="${q === lvl}" tabindex="${q === lvl ? 0 : -1}"
        title="${over ? `Level ${q} (past the in-game max of ${realMax})` : `Level ${q}`}">${q}</button>`;
    }
    return html + '</div>';
  }

  function biomeGrouped(items, selected, label = (x) => esc(x.name)) {
    const groups = {};
    for (const x of items) if (unlocked(x)) (groups[x.prog] ||= []).push(x);
    return Object.keys(groups).sort((a, b) => a - b).map((k) => `<optgroup label="${BIOMES[k - 1]}">` +
      groups[k].map((x) => `<option value="${x.id}"${x.id === selected ? ' selected' : ''}>${label(x)}</option>`).join('') +
      '</optgroup>').join('');
  }

  // ---------- progress gate ----------
  function renderGate() {
    const cur = state.progress;
    return `<section class="gate" aria-labelledby="gate-title">
      <h2 id="gate-title">How far have you made it?</h2>
      <p>Pick the furthest biome you've reached. Armor, weapons and trinkets from later biomes stay hidden, so nothing gets spoiled. You can change this any time.</p>
      <ol class="biome-grid">${BIOMES.map((b, i) => `<li><button type="button" class="biome${cur === i + 1 ? ' on' : ''}" id="prog-${i + 1}" data-action="set-progress" data-prog="${i + 1}">
        <span class="step">${i + 1}</span><span class="bname">${b}</span></button></li>`).join('')}</ol>
      ${cur ? `<button type="button" class="btn" id="gate-cancel" data-action="gate-cancel">Keep ${BIOMES[cur - 1]}</button>` : ''}
    </section>`;
  }

  // ---------- armor tab ----------
  const armorBySlot = {};
  for (const a of D.armors) (armorBySlot[a.slot] ||= []).push(a);

  function profileCard(p, i) {
    const letter = 'AB'[i];
    const isOutfit = p.mode === 'outfit';
    let body = '';
    if (isOutfit) {
      const o = outfitById[p.outfit];
      body = `<label class="field"><span>Outfit</span>
          <select id="pf${i}-outfit" data-action="pf-outfit" data-idx="${i}">${biomeGrouped(OUTFITS, p.outfit)}</select></label>
        <div class="field"><span>Upgrade level</span>${levelPicker(`pf${i}`, outfitRealMax(o), outfitMax(o), p.lvl, `data-action="pf-lvl" data-idx="${i}"`, 'Upgrade level for every piece')}</div>
        <ul class="pieces">${C.SLOTS.filter((s) => o.pieces[s]).map((s) => `<li><span>${SLOT_LABEL[s]}</span>${esc(data.armorById[o.pieces[s]].name)}</li>`).join('')}</ul>`;
    } else {
      body = C.SLOTS.map((s) => {
        const pick = p.slots[s];
        const item = pick && data.armorById[pick.id];
        return `<div class="slot">
          <label class="slot-label" for="pf${i}-${s}">${SLOT_LABEL[s]}</label>
          <select id="pf${i}-${s}" data-action="pf-slot" data-idx="${i}" data-slot="${s}">
            <option value=""${pick ? '' : ' selected'}>— none —</option>${biomeGrouped(armorBySlot[s], pick?.id)}</select>
          ${item ? `<div class="slot-lvl">${levelPicker(`pf${i}-${s}`, item.maxLvl, maxFor(item), pick.lvl, `data-action="pf-slot-lvl" data-idx="${i}" data-slot="${s}"`, `${SLOT_LABEL[s]} level`)}</div>` : ''}
        </div>`;
      }).join('');
    }
    const trinkets = armorBySlot.trinket.filter(unlocked);
    const trinketField = `<label class="field"><span>Trinket</span>
      <select id="pf${i}-trinket" data-action="pf-trinket" data-idx="${i}"${trinkets.length ? '' : ' disabled'}>
        <option value=""${p.trinket ? '' : ' selected'}>${trinkets.length ? '— none —' : 'None unlocked yet'}</option>${biomeGrouped(armorBySlot.trinket, p.trinket)}</select></label>`;

    return `<section class="card" style="--series:${SERIES[i]}" aria-label="Profile ${letter}">
      <div class="card-head">
        <span class="badge">${letter}</span>
        <input type="text" id="pf${i}-name" aria-label="Profile ${letter} name" value="${esc(p.name)}" placeholder="${esc(autoName(p))}" data-action="pf-name" data-idx="${i}">
      </div>
      <div class="seg" role="radiogroup" aria-label="Profile ${letter} mode">
        <button type="button" role="radio" id="pf${i}-mode-outfit" class="${isOutfit ? 'on' : ''}" aria-checked="${isOutfit}" data-action="pf-mode" data-idx="${i}" data-mode="outfit">Full outfit</button>
        <button type="button" role="radio" id="pf${i}-mode-custom" class="${isOutfit ? '' : 'on'}" aria-checked="${!isOutfit}" data-action="pf-mode" data-idx="${i}" data-mode="custom">Custom mix</button>
      </div>
      ${body}
      ${trinketField}
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

  function describeEffect(e) {
    const out = [];
    if (e.healthUpfront) out.push(`+${e.healthUpfront} health instantly`);
    if (e.staminaUpfront) out.push(`+${e.staminaUpfront} stamina instantly`);
    if (e.eitrUpfront) out.push(`+${e.eitrUpfront} eitr instantly`);
    if (e.armor) out.push(`+${e.armor} armor`);
    for (const [skill, v] of Object.entries(e.skillModifiers || {})) out.push(`${skill} +${v}`);
    if (e.healthRegen) out.push(`Health regen ${pct(e.healthRegen - 1)}`);
    if (e.staminaRegen) out.push(`Stamina regen ${pct(e.staminaRegen - 1)}`);
    if (e.eitrRegen) out.push(`Eitr regen ${pct(e.eitrRegen - 1)}`);
    for (const k of ['runStamina', 'jumpStamina', 'attackStamina', 'dodgeStamina', 'blockStamina', 'swimStamina']) {
      if (e[k]) out.push(`${k.replace('Stamina', '')} stamina ${pct(e[k])}`);
    }
    if (e.moveSpeed) out.push(`Move speed ${pct(e.moveSpeed)}`);
    if (e.swimSpeed) out.push(`Swim speed ${pct(e.swimSpeed)}`);
    if (e.parryBonus) out.push(`Parry bonus ${pct(e.parryBonus)}`);
    for (const [t, v] of Object.entries(e.damageValueModifiers || {})) out.push(`${t} damage ${pct(v)}`);
    for (const [t, m] of Object.entries(e.damageModifiers || {})) out.push(`${MOD_LABEL[m]} to ${t}`);
    if (e.fallDamage === 0) out.push('No fall damage');
    if (e.windMovementModifier) out.push('Faster with tailwind');
    return out;
  }

  function setLines(sets) {
    if (!sets.length) return '<span class="none">No set pieces</span>';
    return sets.map(({ set, count, active }) => {
      const perks = describeEffect(set);
      return `<span class="setline ${active ? 'active' : 'partial'}"><b>${esc(set.name || set.id)}</b> ${count}/${set.pieces} pieces · ${active ? 'active' : 'not active'}${perks.length ? `<span class="sub">${perks.join(' · ')}</span>` : ''}</span>`;
    }).join('');
  }

  function trinketCell(t) {
    if (!t) return '<span class="none">None</span>';
    const fx = t.effect ? describeEffect(t.effect) : [];
    return `${esc(t.item.name)}<span class="sub">Fills at ${t.adrenaline} adrenaline${t.effect?.time ? ` · lasts ${t.effect.time}s` : ''}</span>
      ${fx.length ? `<ul class="plain">${fx.map((f) => `<li>${f}</li>`).join('')}</ul>` : ''}`;
  }

  function armorStats() {
    return state.profiles.map((p) => C.loadoutStats(profileLoadout(p), data));
  }

  function armorResults(stats) {
    const b = 1; // deltas show on profile B, measured against A
    const base = stats[0];
    const { amount, type } = state.hit;
    const taken = stats.map((s) => C.damageTaken(amount, type, s));
    const head = `<thead><tr><th scope="col">Stat</th>${state.profiles.map((p, i) =>
      `<th scope="col" style="--series:${SERIES[i]}"><span class="badge sm">${'AB'[i]}</span>${esc(displayName(p))}${stats[i].hypothetical ? '<span class="hypo">hypothetical</span>' : ''}${stats[i].pieces.some((x) => x.item.unverified) ? EARLY_TAG : ''}</th>`).join('')}</tr></thead>`;
    const row = (label, cells, cls = '') => `<tr class="${cls}"><th scope="row">${label}</th>${cells.join('')}</tr>`;
    const d = (i, ...args) => (i === b ? delta(...args) : '');
    const rows = [];
    rows.push(row('Total armor', stats.map((s, i) => `<td><span class="num">${fmt(s.armor)}</span>${d(i, s.armor, base.armor)}</td>`), 'big'));
    rows.push(row(`Damage taken<span class="sub">${fmt(amount, 0)} ${type} hit</span>`, taken.map((t, i) => {
      const buff = C.withTrinketBuff(stats[i]);
      const buffLine = buff ? `<span class="sub">${fmt(C.damageTaken(amount, type, buff))} with ${esc(stats[i].trinket.item.name)} active</span>` : '';
      return `<td><span class="num">${fmt(t)}</span>${d(i, t, taken[0], { higherIsBetter: false })}<span class="sub">${fmt(amount > 0 ? (1 - t / amount) * 100 : 0, 0)}% blocked by armor</span>${buffLine}</td>`;
    }), 'big'));
    rows.push(row('Weight', stats.map((s, i) => `<td><span class="num">${fmt(s.weight)}</span>${d(i, s.weight, base.weight, { higherIsBetter: false })}</td>`)));
    rows.push(row('Movement speed', stats.map((s, i) => `<td><span class="num">${pct(s.moveSpeed)}</span>${d(i, s.moveSpeed, base.moveSpeed, { asPct: true })}</td>`)));
    if (stats.some((s) => s.eitrRegen)) {
      rows.push(row('Eitr regen', stats.map((s, i) => `<td><span class="num">${pct(s.eitrRegen)}</span>${d(i, s.eitrRegen, base.eitrRegen, { asPct: true })}</td>`)));
    }
    rows.push(row('Resistances', stats.map((s) => `<td>${resistChips(s.resist)}</td>`)));
    rows.push(row('Set bonus', stats.map((s) => `<td>${setLines(s.sets)}</td>`)));
    rows.push(row('Trinket', stats.map((s) => `<td>${trinketCell(s.trinket)}</td>`)));
    rows.push(row('Stamina effects', stats.map((s) => {
      const items = Object.entries(s.stamina).filter(([, v]) => v);
      return `<td>${items.length ? `<ul class="plain">${items.map(([k, v]) => `<li>${STAMINA_LABEL[k] || k} ${pct(v)}</li>`).join('')}</ul>` : '<span class="none">None</span>'}</td>`;
    })));
    rows.push(row('Item effects', stats.map((s) => {
      const fx = s.effects.flatMap((e) => describeEffect(e).map((x) => `${x} <span class="sub">${esc(e.source)}</span>`));
      return `<td>${fx.length ? `<ul class="plain">${fx.map((f) => `<li>${f}</li>`).join('')}</ul>` : '<span class="none">None</span>'}</td>`;
    })));
    rows.push(`<tr class="group"><th colspan="3">Piece by piece</th></tr>`);
    for (const slot of C.SLOTS) {
      rows.push(row(SLOT_LABEL[slot], stats.map((s) => {
        const p = s.pieces.find((x) => x.slot === slot);
        if (!p) return '<td><span class="none">—</span></td>';
        return `<td>${esc(p.item.name)} <span class="num">★${p.lvl}</span>${p.hypothetical ? '<span class="hypo">past max</span>' : ''}
          <span class="sub">${fmt(p.armor)} armor · ${p.durability == null ? '∞' : fmt(p.durability, 0)} durability · ${fmt(p.item.weight)} wt</span></td>`;
      })));
    }
    return `<div class="table-scroll"><table class="ledger">${head}<tbody>${rows.join('')}</tbody></table></div>`;
  }

  function niceStep(max) {
    const raw = max / 5;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const n = raw / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
  }

  function damageChart(stats) {
    const { amount, type } = state.hit;
    const W = 640, H = 260, L = 44, R = 16, T = 12, B = 34;
    const xMax = Math.max(200, Math.ceil((amount * 1.5) / 50) * 50);
    const curves = stats.map((s) => Array.from({ length: 81 }, (_, k) => {
      const x = (xMax * k) / 80;
      return [x, C.damageTaken(x, type, s)];
    }));
    const yMaxRaw = Math.max(1, ...curves.flat().map((p) => p[1]));
    const step = niceStep(yMaxRaw);
    const yMax = Math.ceil(yMaxRaw / step) * step;
    const sx = (x) => L + (x / xMax) * (W - L - R);
    const sy = (y) => T + (1 - y / yMax) * (H - T - B);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Damage taken versus incoming ${type} hit size for both profiles">`;
    for (let y = 0; y <= yMax + 1e-9; y += step) {
      svg += `<line x1="${L}" x2="${W - R}" y1="${sy(y)}" y2="${sy(y)}" stroke="var(--line)" stroke-width="1"/>`;
      svg += `<text x="${L - 6}" y="${sy(y) + 4}" text-anchor="end">${fmt(y, 0)}</text>`;
    }
    const xStep = niceStep(xMax);
    for (let x = 0; x <= xMax + 1e-9; x += xStep) svg += `<text x="${sx(x)}" y="${H - B + 16}" text-anchor="middle">${fmt(x, 0)}</text>`;
    svg += `<text x="${(L + W - R) / 2}" y="${H - 4}" text-anchor="middle">incoming ${type} hit</text>`;
    svg += `<line x1="${sx(amount)}" x2="${sx(amount)}" y1="${T}" y2="${H - B}" stroke="var(--muted)" stroke-dasharray="3 4" stroke-width="1"/>`;
    curves.forEach((pts, i) => {
      const path = pts.map((p, k) => `${k ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join('');
      svg += `<path d="${path}" fill="none" stroke="${SERIES[i]}" stroke-width="2.5" stroke-linejoin="round"/>`;
      svg += `<circle cx="${sx(amount)}" cy="${sy(C.damageTaken(amount, type, stats[i]))}" r="4.5" fill="${SERIES[i]}" stroke="var(--surface)" stroke-width="1.5"/>`;
    });
    svg += '</svg>';
    const legend = state.profiles.map((p, i) => `<span style="--series:${SERIES[i]}"><i></i>${'AB'[i]} · ${esc(displayName(p))}</span>`).join('');
    return `<div class="chart-box">${svg}<div class="legend">${legend}</div></div>`;
  }

  const EARLY_TAG = '<span class="hypo early" title="Deep North stats come from early data and may not match the game">early data</span>';
  function earlyNote() {
    if (state.progress < 8) return '';
    return `<p class="banner">Deep North stats come from data published right after 1.0 launched. Guide sites list most Deep North weapons about 10% stronger, and a few armor values differ. Treat anything tagged <span class="hypo early">early data</span> as a rough guide and check the in-game tooltip.</p>`;
  }

  function renderArmor() {
    const stats = armorStats();
    const types = ['blunt', 'slash', 'pierce', 'fire', 'frost', 'lightning', 'poison', 'spirit'];
    return `
      ${earlyNote()}
      <div class="pair">${state.profiles.map(profileCard).join('<div class="vs" aria-hidden="true">vs</div>')}</div>
      <div class="toolbar">
        <div class="field">
          <span>Incoming hit: <output id="hit-out">${fmt(state.hit.amount, 0)}</output></span>
          <input type="range" id="hit-amount" min="5" max="400" step="5" value="${state.hit.amount}" data-action="hit-amount" aria-label="Incoming hit damage">
        </div>
        <label class="field"><span>Damage type</span>
          <select id="hit-type" data-action="hit-type">${types.map((t) => `<option value="${t}"${t === state.hit.type ? ' selected' : ''}>${t}</option>`).join('')}</select>
        </label>
      </div>
      <div id="armor-results">${armorResults(stats)}</div>
      <h2>Damage taken by hit size</h2>
      <p class="note">How much of a single ${state.hit.type} hit gets through each profile, no shield or block. Armor shaves a flat amount off small hits and loses ground as hits grow, which is why the lines bend upward.</p>
      <div id="armor-chart">${damageChart(stats)}</div>`;
  }

  // ---------- weapons tab ----------
  const SKILL_ORDER = ['Axes', 'Swords', 'Clubs', 'Knives', 'Spears', 'Polearms', 'Fists', 'Bows', 'Crossbows', 'Elemental magic', 'Blood magic', 'Pickaxes', 'Shields'];
  const weaponGroups = {};
  for (const w of D.weapons) (weaponGroups[w.skill] ||= []).push(w);
  for (const g of Object.values(weaponGroups)) g.sort((a, b) => a.prog - b.prog || a.tier - b.tier);

  function weaponOptions(selected) {
    const order = [...SKILL_ORDER, ...Object.keys(weaponGroups).filter((k) => !SKILL_ORDER.includes(k))];
    return order.map((k) => {
      const list = (weaponGroups[k] || []).filter(unlocked);
      if (!list.length) return '';
      return `<optgroup label="${k}">` + list.map((w) =>
        `<option value="${w.id}"${w.id === selected ? ' selected' : ''}>${esc(w.name)} · ${w.biome}</option>`).join('') + '</optgroup>';
    }).join('');
  }

  function ammoOptions(w, selected) {
    const type = C.ammoTypeFor(w);
    const list = D.ammo.filter((a) => a.type === type && unlocked(a)).sort((a, b) => a.prog - b.prog);
    return `<option value=""${selected ? '' : ' selected'}>No ${type} (weapon only)</option>` + list.map((a) => {
      const total = Object.values(a.damage).reduce((x, y) => x + y, 0);
      return `<option value="${a.id}"${a.id === selected ? ' selected' : ''}>${esc(a.name)} · ${fmt(total, 0)}</option>`;
    }).join('');
  }

  function weaponCard(pick, i) {
    const w = data.weaponById[pick.id];
    const letter = 'AB'[i];
    return `<section class="card" style="--series:${SERIES[i]}" aria-label="Weapon ${letter}">
      <div class="card-head"><span class="badge">${letter}</span><span class="card-title">${esc(w.name)}</span></div>
      <label class="field"><span>Weapon</span>
        <select id="wp${i}-id" data-action="wp-id" data-idx="${i}">${weaponOptions(pick.id)}</select>
      </label>
      <div class="field"><span>Upgrade level</span>${levelPicker(`wp${i}`, w.maxLvl, maxFor(w), pick.lvl, `data-action="wp-lvl" data-idx="${i}"`, `Weapon ${letter} level`)}</div>
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
    const d = (i, ...args) => (i === 1 ? delta(...args) : '');
    const head = `<thead><tr><th scope="col">Stat</th>${stats.map((s, i) =>
      `<th scope="col" style="--series:${SERIES[i]}"><span class="badge sm">${'AB'[i]}</span>${esc(s.w.name)} <span class="num">★${s.lvl}</span>${s.hypothetical ? '<span class="hypo">hypothetical</span>' : ''}${s.w.unverified ? EARLY_TAG : ''}${s.ammo ? `<span class="sub">+ ${esc(s.ammo.name)}</span>` : ''}</th>`).join('')}</tr></thead>`;
    const row = (label, cells, cls = '') => `<tr class="${cls}"><th scope="row">${label}</th>${cells.join('')}</tr>`;
    const rows = [];
    rows.push(row('Damage per hit<span class="sub">tooltip value</span>', stats.map((s, i) => {
      const bar = Object.entries(s.dmg).filter(([t, v]) => v && C.COMBAT_TYPES.includes(t))
        .map(([t, v]) => `<span style="${dt(t)};width:${(v / maxCombat) * 100}%" title="${t} ${fmt(v)}"></span>`).join('');
      return `<td><span class="num">${fmt(s.combat)}</span>${d(i, s.combat, base.combat)}<div class="dbar" aria-hidden="true">${bar}</div></td>`;
    }), 'big'));
    rows.push(row('Damage types', stats.map((s) => `<td>${dmgChips(Object.fromEntries(Object.entries(s.dmg).filter(([t]) => C.COMBAT_TYPES.includes(t))))}</td>`)));
    rows.push(row(`Real hit range<span class="sub">at skill ${state.skill}</span>`, stats.map((s, i) =>
      `<td><span class="num">${fmt(s.range[0], 0)}–${fmt(s.range[1], 0)}</span>${d(i, (s.range[0] + s.range[1]) / 2, (base.range[0] + base.range[1]) / 2)}</td>`)));
    if (stats.some((s) => s.tool)) {
      rows.push(row('Tool damage<span class="sub">chop / pickaxe</span>', stats.map((s) => {
        const t = Object.fromEntries(Object.entries(s.dmg).filter(([k]) => C.TOOL_TYPES.includes(k)));
        return `<td>${dmgChips(t)}${s.w.toolTier ? `<span class="sub">tool tier ${s.w.toolTier}</span>` : ''}</td>`;
      })));
    }
    const maxAttacks = Math.max(...stats.map((s) => s.attacks.length));
    for (let a = 0; a < maxAttacks; a++) {
      rows.push(`<tr class="group"><th colspan="3">${a === 0 ? 'Primary attack' : 'Secondary attack'}</th></tr>`);
      const baseAtk = base.attacks[a];
      rows.push(row('Hit', stats.map((s, i) => {
        const at = s.attacks[a];
        if (!at) return '<td><span class="none">—</span></td>';
        return `<td><span class="num">${fmt(at.hit)}</span>${baseAtk ? d(i, at.hit, baseAtk.hit) : ''}${at.mul !== 1 ? `<span class="sub">×${fmt(at.mul, 2)} multiplier</span>` : ''}${at.projectiles > 1 ? `<span class="sub">${at.projectiles} projectiles</span>` : ''}${at.finisher ? `<span class="sub">Combo hit ${at.finisher.hitNumber}: <b class="num">${fmt(at.finisher.hit)}</b> (double damage)</span>` : ''}</td>`;
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
        return `<td><span class="num">${parts.join(' + ') || 'free'}</span>${bcost && cost && baseAtk.costUnit === at.costUnit ? d(i, cost, bcost, { higherIsBetter: false }) : ''}${at.drawTime ? `<span class="sub">${fmt(at.drawTime)}s full draw</span>` : ''}${at.reloadTime ? `<span class="sub">${fmt(at.reloadTime)}s reload</span>` : ''}</td>`;
      })));
      rows.push(row('Damage per point', stats.map((s, i) => {
        const at = s.attacks[a];
        if (!at || at.perCost == null) return '<td><span class="none">—</span></td>';
        const b = baseAtk && baseAtk.costUnit === at.costUnit ? baseAtk.perCost : null;
        return `<td><span class="num">${fmt(at.perCost)}</span>${b != null ? d(i, at.perCost, b) : ''}<span class="sub">avg damage per ${at.costUnit}</span></td>`;
      })));
    }
    rows.push(`<tr class="group"><th colspan="3">Defense & handling</th></tr>`);
    rows.push(row('Block armor', stats.map((s, i) => `<td><span class="num">${fmt(s.block)}</span>${d(i, s.block, base.block)}</td>`)));
    rows.push(row('Parry block armor', stats.map((s, i) => `<td><span class="num">${fmt(s.parry)}</span>${d(i, s.parry, base.parry)}<span class="sub">×${fmt(s.w.parryBonus, 1)} parry bonus</span></td>`)));
    rows.push(row('Parry force', stats.map((s, i) => `<td><span class="num">${fmt(s.parryForce)}</span>${d(i, s.parryForce, base.parryForce)}</td>`)));
    rows.push(row('Backstab', stats.map((s, i) => `<td><span class="num">×${fmt(s.w.backstab)}</span>${d(i, s.w.backstab, base.w.backstab)}</td>`)));
    rows.push(row('Knockback', stats.map((s, i) => `<td><span class="num">${fmt(s.w.knockback)}</span>${d(i, s.w.knockback, base.w.knockback)}</td>`)));
    rows.push(row('Durability', stats.map((s, i) => `<td><span class="num">${fmt(s.durability, 0)}</span>${d(i, s.durability, base.durability, { digits: 0 })}</td>`)));
    rows.push(row('Weight', stats.map((s, i) => `<td><span class="num">${fmt(s.w.weight)}</span>${d(i, s.w.weight, base.w.weight, { higherIsBetter: false })}</td>`)));
    rows.push(row('Movement speed', stats.map((s, i) => `<td><span class="num">${pct(s.w.moveSpeed)}</span>${d(i, s.w.moveSpeed, base.w.moveSpeed, { asPct: true })}</td>`)));
    rows.push(row('Hands', stats.map((s) => `<td>${{ primary: 'One-handed', both: 'Two-handed', secondary: 'Off-hand', bow: 'Two-handed (ranged)', either: 'Either hand' }[s.w.hands] || s.w.hands}<span class="sub">${s.w.skill} · ${s.w.biome}</span></td>`)));
    return `<div class="table-scroll"><table class="ledger">${head}<tbody>${rows.join('')}</tbody></table></div>`;
  }

  function renderWeapons() {
    return `
      ${earlyNote()}
      <div class="pair">${state.weapons.map(weaponCard).join('<div class="vs" aria-hidden="true">vs</div>')}</div>
      <div class="toolbar">
        <div class="field">
          <span>Weapon skill level: <output id="skill-out">${state.skill}</output></span>
          <input type="range" id="skill" min="0" max="100" step="1" value="${state.skill}" data-action="skill" aria-label="Weapon skill level">
        </div>
        <p class="note toolbar-note">The tooltip number is the most a hit can roll. Your skill sets the actual roll range and trims stamina and eitr cost by up to 33%. Bow and crossbow damage adds the ammo you pick.</p>
      </div>
      <div id="weapon-results">${weaponResults()}</div>`;
  }

  // ---------- render + events ----------
  const app = document.getElementById('app');
  const chrome = ['tabs', 'controls'].map((id) => document.getElementById(id));

  function render() {
    const focusId = document.activeElement?.id;
    chrome.forEach((el) => { el.hidden = gateOpen; });
    if (gateOpen) {
      app.innerHTML = renderGate();
    } else {
      document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === state.tab)));
      document.getElementById('over-max').checked = state.overMax;
      document.getElementById('progress-name').textContent = BIOMES[state.progress - 1];
      app.innerHTML = state.tab === 'armor' ? renderArmor() : renderWeapons();
    }
    if (focusId) document.getElementById(focusId)?.focus();
    save();
  }

  // Lightweight refresh for sliders and name typing, so the control being used isn't replaced.
  function renderResultsOnly() {
    if (state.tab === 'armor') {
      const stats = armorStats();
      document.getElementById('armor-results').innerHTML = armorResults(stats);
      document.getElementById('armor-chart').innerHTML = damageChart(stats);
      document.getElementById('hit-out').textContent = fmt(state.hit.amount, 0);
    } else {
      document.getElementById('weapon-results').innerHTML = weaponResults();
      document.getElementById('skill-out').textContent = state.skill;
    }
    save();
  }

  function onAction(el) {
    const a = el.dataset.action;
    const i = +el.dataset.idx;
    const p = state.profiles?.[i];
    switch (a) {
      case 'set-progress': setProgress(+el.dataset.prog); break;
      case 'gate-cancel': gateOpen = false; break;
      case 'change-progress': gateOpen = true; break;
      case 'tab': state.tab = el.dataset.tab; break;
      case 'over-max': state.overMax = el.checked; sanitize(); break;
      case 'reset': Object.assign(state, defaultsFor(state.progress)); break;
      case 'pf-name': p.name = el.value; return renderResultsOnly();
      case 'pf-mode': {
        const mode = el.dataset.mode;
        if (mode === p.mode) return;
        if (mode === 'custom') p.slots = slotsFromOutfit(p.outfit, p.lvl);
        p.mode = mode;
        break;
      }
      case 'pf-outfit':
        p.outfit = el.value;
        p.lvl = Math.min(p.lvl, outfitMax(outfitById[p.outfit]));
        break;
      case 'pf-lvl': p.lvl = +el.dataset.lvl; break;
      case 'pf-slot': {
        const s = el.dataset.slot;
        const prev = p.slots[s]?.lvl || 1;
        p.slots[s] = el.value ? { id: el.value, lvl: clampLvl(data.armorById[el.value], prev) } : null;
        break;
      }
      case 'pf-slot-lvl': p.slots[el.dataset.slot].lvl = +el.dataset.lvl; break;
      case 'pf-trinket': p.trinket = el.value || null; break;
      case 'hit-amount': state.hit.amount = +el.value; return renderResultsOnly();
      case 'hit-type': state.hit.type = el.value; break;
      case 'wp-id': state.weapons[i] = { id: el.value, lvl: clampLvl(data.weaponById[el.value], state.weapons[i].lvl) }; break;
      case 'wp-lvl': state.weapons[i].lvl = +el.dataset.lvl; break;
      case 'wp-ammo': state.weapons[i].ammo = el.value || undefined; break;
      case 'skill': state.skill = +el.value; return renderResultsOnly();
      default: return;
    }
    render();
  }

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('button[data-action]');
    if (el) onAction(el);
  });
  document.addEventListener('change', (ev) => {
    if (ev.target.matches('select[data-action], input[type="checkbox"][data-action]')) onAction(ev.target);
  });
  document.addEventListener('input', (ev) => {
    if (ev.target.matches('input[type="range"][data-action], input[type="text"][data-action]')) onAction(ev.target);
  });
  // Arrow keys move through a radio group, like native radio buttons.
  document.addEventListener('keydown', (ev) => {
    const el = ev.target.closest?.('[role="radio"]');
    if (!el || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(ev.key)) return;
    const radios = [...el.parentElement.querySelectorAll('[role="radio"]')];
    const step = ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 1;
    const next = radios[(radios.indexOf(el) + step + radios.length) % radios.length];
    ev.preventDefault();
    next.focus();
    next.click();
  });

  const src = D.source;
  document.getElementById('source').innerHTML =
    `Item data from <a href="${src.repo}" target="_blank" rel="noopener">kirilloid's Valheim database</a> (commit ${esc(src.commit.slice(0, 7))}, pulled ${esc(src.extracted)}). ` +
    'Levels with a dashed outline go past the normal crafting max and use the same per-level gain. ' +
    'Numbers are what the game calculates before world difficulty modifiers, food and other buffs. ' +
    'Fan-made tool, not affiliated with Iron Gate or Coffee Stain. Valheim is a trademark of Iron Gate AB.';

  if (state.progress) sanitize();
  render();
})();
