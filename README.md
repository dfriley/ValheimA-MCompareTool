# Valheim Gear Compare

Compare Valheim armor loadouts and weapons side by side at any upgrade level.

**Use it:** https://dfriley.github.io/ValheimA-MCompareTool/

- **No spoilers:** you start by picking the furthest biome you've reached. Armor, weapons, trinkets and ammo from later biomes stay hidden. Change it any time from the header.
- **Armor:** two profiles, A vs B. Each one is either a **full outfit** (pick the set and one upgrade level for every piece) or a **custom mix** (pick each piece and its level). Add a trinket to either. You get total armor, damage taken from a hit you choose (plus with the trinket's buff active), weight, movement speed, resistances, set bonuses (applied only when you're wearing enough pieces) and a damage-taken chart.
- **Weapons:** two weapons or shields at any level, with damage by type, the actual hit range at your skill level, stamina/eitr cost, damage per stamina, block, parry, backstab, knockback, durability and weight. Bows and crossbows let you pick ammo.
- **Past max level:** tick "Allow levels past the in-game max" to see levels up to 10. Items can go past their normal max with idols at the Forge of Potential (65% success per level, the item is destroyed on failure). Each extra level adds the same per-level gain.

## Accuracy notes

- Deep North items are tagged **early data** in the app. The source added them right after 1.0 launched, and guide sites list most Deep North weapons about 10% stronger. Corrections are welcome as issues.
- A few Ashlands armor weights are corrected by hand in `STAT_FIXES` (`scripts/extract-data.ts`).
- Damage taken ignores world difficulty settings, food, potions and shields.

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

Full outfits are defined in `src/outfits.js`. Which biome each item unlocks in comes from the source tier, with fixes for the ones that don't line up in `PROG_FIXES` in `scripts/extract-data.ts`. The math lives in `src/calc.js`:

- Level value = base + per-level × (level − 1)
- Armor: `armor < dmg/2 ? dmg − armor : dmg² / (4 × armor)`, applied after resistances, poison included
- Last swing of a melee combo: ×2 damage
- Bow stamina: draw drain per second × draw time, where draw time × `lerp(1, 0.2, skill/100)`
- Skill roll range: `[0.25 + 0.006·skill, min(0.55 + 0.006·skill, 1)]` × tooltip damage
- Stamina/eitr cost: × `(1 − 0.33·skill/100)`

## Credits

Item data comes from [kirilloid's Valheim database](https://github.com/kirilloid/valheim) ([valheim.kirilloid.ru](https://valheim.kirilloid.ru)). Fan-made, not affiliated with Iron Gate or Coffee Stain.
