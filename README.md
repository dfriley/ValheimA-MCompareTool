# Valheim Gear Compare

Compare Valheim armor loadouts and weapons side by side at any upgrade level.

**Use it:** https://dfriley.github.io/ValheimA-MCompareTool/

- **Armor:** up to 4 loadouts. Pick a full outfit (Rag through the 1.0 Deep North sets) or mix pieces slot by slot, then set each piece's level. You get total armor, damage taken from a hit you choose, weight, movement speed, eitr regen, resistances, set bonuses (applied only when you're wearing enough pieces), and a damage-taken chart.
- **Weapons:** up to 4 weapons/shields at any level, with damage by type, the actual hit range at your skill level, stamina/eitr cost, damage per stamina, block, parry, backstab, knockback, durability and weight. Bows and crossbows let you pick ammo.
- **Past max level:** tick "Allow levels past the in-game max" to see hypothetical levels (up to 10). They use the same per-level gain and get a dashed "hypothetical" marker.

## Run it

No install needed. Open `index.html` in a browser.

The site is served by GitHub Pages straight from `master` (Settings → Pages → Deploy from a branch → `master` / root), so every push to `master` updates it.

To get a single self-contained file:

```sh
npm run build   # writes dist/valheim-gear-compare.html
```

## Data

Item stats come from [kirilloid's Valheim database](https://github.com/kirilloid/valheim) (the source behind valheim.kirilloid.ru). `src/data.js` is generated, so don't edit it by hand. After a game patch, refresh it:

```sh
npm install
git clone --depth 1 https://github.com/kirilloid/valheim.git ../kirilloid-valheim
npm run extract -- ../kirilloid-valheim
npm test
```

Full outfits are defined in `src/outfits.js`. The math lives in `src/calc.js`:

- Level value = base + per-level × (level − 1)
- Armor: `armor < dmg/2 ? dmg − armor : dmg² / (4 × armor)`. Armor doesn't reduce poison.
- Skill roll range: `[0.25 + 0.006·skill, min(0.55 + 0.006·skill, 1)]` × tooltip damage
- Stamina/eitr cost: × `(1 − 0.33·skill/100)`
