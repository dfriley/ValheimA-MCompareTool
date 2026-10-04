// Full outfits shown in the "Outfit" picker. Pieces reference armor ids in data.js.
// Capes are included only where the set has a matching cape from the same biome (troll needs it
// for the set bonus). Every slot can be swapped or cleared per loadout.
window.VH_OUTFITS = [
  { id: 'rags', name: 'Rag', biome: 'Meadows', pieces: { chest: 'ArmorRagsChest', legs: 'ArmorRagsLegs' } },
  { id: 'leather', name: 'Leather', biome: 'Meadows', pieces: { head: 'HelmetLeather', chest: 'ArmorLeatherChest', legs: 'ArmorLeatherLegs', cape: 'CapeDeerHide' } },
  { id: 'troll', name: 'Troll leather', biome: 'Black Forest', pieces: { head: 'HelmetTrollLeather', chest: 'ArmorTrollLeatherChest', legs: 'ArmorTrollLeatherLegs', cape: 'CapeTrollHide' } },
  { id: 'bear', name: 'Bear (Berserker)', biome: 'Black Forest', pieces: { head: 'HelmetBerserkerHood', chest: 'ArmorBerserkerChest', legs: 'ArmorBerserkerLegs' } },
  { id: 'bronze', name: 'Bronze', biome: 'Black Forest', pieces: { head: 'HelmetBronze', chest: 'ArmorBronzeChest', legs: 'ArmorBronzeLegs' } },
  { id: 'root', name: 'Root', biome: 'Swamp', pieces: { head: 'HelmetRoot', chest: 'ArmorRootChest', legs: 'ArmorRootLegs' } },
  { id: 'iron', name: 'Iron', biome: 'Swamp', pieces: { head: 'HelmetIron', chest: 'ArmorIronChest', legs: 'ArmorIronLegs' } },
  { id: 'fenris', name: 'Fenris', biome: 'Mountains', pieces: { head: 'HelmetFenring', chest: 'ArmorFenringChest', legs: 'ArmorFenringLegs' } },
  { id: 'wolf', name: 'Wolf', biome: 'Mountains', pieces: { head: 'HelmetDrake', chest: 'ArmorWolfChest', legs: 'ArmorWolfLegs', cape: 'CapeWolf' } },
  { id: 'lox', name: 'Lox fur', biome: 'Plains', pieces: { head: 'HelmetLox', chest: 'ArmorLoxChest', legs: 'ArmorLoxLegs', cape: 'CapeLox' } },
  { id: 'vilebone', name: 'Vilebone', biome: 'Plains', pieces: { head: 'HelmetBerserkerUndead', chest: 'ArmorBerserkerUndeadChest', legs: 'ArmorBerserkerUndeadLegs' } },
  { id: 'padded', name: 'Padded', biome: 'Plains', pieces: { head: 'HelmetPadded', chest: 'ArmorPaddedCuirass', legs: 'ArmorPaddedGreaves', cape: 'CapeLinen' } },
  { id: 'carapace', name: 'Carapace', biome: 'Mistlands', pieces: { head: 'HelmetCarapace', chest: 'ArmorCarapaceChest', legs: 'ArmorCarapaceLegs', cape: 'CapeFeather' } },
  { id: 'eitrweave', name: 'Eitr-weave', biome: 'Mistlands', pieces: { head: 'HelmetMage', chest: 'ArmorMageChest', legs: 'ArmorMageLegs', cape: 'CapeFeather' } },
  { id: 'flametal', name: 'Flametal', biome: 'Ashlands', pieces: { head: 'HelmetFlametal', chest: 'ArmorFlametalChest', legs: 'ArmorFlametalLegs', cape: 'CapeAsh' } },
  { id: 'ask', name: 'Ask', biome: 'Ashlands', pieces: { head: 'HelmetAshlandsMediumHood', chest: 'ArmorAshlandsMediumChest', legs: 'ArmorAshlandsMediumlegs', cape: 'CapeAsksvin' } },
  { id: 'embla', name: 'Embla', biome: 'Ashlands', pieces: { head: 'HelmetMage_Ashlands', chest: 'ArmorMageChest_Ashlands', legs: 'ArmorMageLegs_Ashlands', cape: 'CapeAsh' } },
  { id: 'protector', name: 'Protector', biome: 'Deep North', pieces: { head: 'HelmetDNHeavy', chest: 'ArmorDeepNorthHeavyChest', legs: 'ArmorDeepNorthHeavylegs', cape: 'CapeDeepNorth' } },
  { id: 'vanguard', name: 'Vanguard', biome: 'Deep North', pieces: { head: 'HelmetDNMediumHood', chest: 'ArmorDeepNorthMediumChest', legs: 'ArmorDeepNorthMediumlegs', cape: 'CapeDeepNorth' } },
  { id: 'caller', name: 'Caller', biome: 'Deep North', pieces: { head: 'HelmetDNMage', chest: 'ArmorDeepNorthMageChest', legs: 'ArmorDeepNorthMagelegs', cape: 'CapeDeepNorthMage' } },
];
