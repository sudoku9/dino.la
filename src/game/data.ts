import type {
  AbilityDef,
  AbilityId,
  ArrowDef,
  ArrowId,
  LevelDef,
  MonsterDef,
  MonsterId,
  PerkDef,
  PerkId,
  RegionDef,
  Spawn,
  UpgradeDef,
  UpgradeId
} from "./types";
import { PALETTE } from "./constants";

export const ARROWS: ArrowDef[] = [
  {
    id: "normal",
    name: "Normal Arrow",
    desc: "Reliable and free. Infinite ammo.",
    color: 0xf4e3c1,
    damage: 1.0,
    manaCost: 0,
    unlockLevel: 1
  },
  {
    id: "fire",
    name: "Fire Arrow",
    desc: "Ignites enemies for burning damage.",
    color: PALETTE.ember,
    damage: 0.9,
    manaCost: 12,
    unlockLevel: 2,
    burn: 14
  },
  {
    id: "ice",
    name: "Ice Arrow",
    desc: "Slows and can freeze enemies solid.",
    color: PALETTE.ice,
    damage: 0.8,
    manaCost: 12,
    unlockLevel: 4,
    slow: 0.45,
    freeze: 1.2
  },
  {
    id: "pierce",
    name: "Piercing Arrow",
    desc: "Passes through every enemy in a line.",
    color: 0xe8f0ff,
    damage: 1.0,
    manaCost: 16,
    unlockLevel: 6,
    pierce: true
  },
  {
    id: "lightning",
    name: "Storm Arrow",
    desc: "Lightning chains to nearby enemies.",
    color: 0x9be7ff,
    damage: 0.9,
    manaCost: 20,
    unlockLevel: 9,
    chain: 3
  },
  {
    id: "explosive",
    name: "Explosive Arrow",
    desc: "Detonates in an area and knocks back.",
    color: 0xffb03a,
    damage: 1.4,
    manaCost: 22,
    unlockLevel: 12,
    explodeRadius: 70
  }
];

export const ABILITIES: AbilityDef[] = [
  {
    id: "arrowStorm",
    name: "Arrow Storm",
    desc: "Rain arrows over a target area.",
    cooldown: 18,
    unlockLevel: 2,
    color: PALETTE.gold
  },
  {
    id: "frostNova",
    name: "Frost Nova",
    desc: "Freeze every enemy for 3 seconds.",
    cooldown: 24,
    unlockLevel: 5,
    color: PALETTE.ice
  },
  {
    id: "wallOfFlame",
    name: "Wall of Flame",
    desc: "A burning wall scorches all who pass.",
    cooldown: 20,
    unlockLevel: 9,
    color: PALETTE.ember
  }
];

export const MONSTERS: MonsterDef[] = [
  {
    id: "grunt",
    name: "Grunt",
    hp: 42,
    speed: 42,
    damage: 8,
    gold: 8,
    score: 10,
    kind: "ground",
    radius: 20,
    color: 0x6fae4e,
    unlockLevel: 1
  },
  {
    id: "runner",
    name: "Runner",
    hp: 26,
    speed: 95,
    damage: 6,
    gold: 9,
    score: 12,
    kind: "ground",
    radius: 17,
    color: 0xb08a4e,
    unlockLevel: 2
  },
  {
    id: "brute",
    name: "Brute",
    hp: 190,
    speed: 22,
    damage: 30,
    gold: 30,
    score: 40,
    kind: "ground",
    radius: 30,
    color: 0x7a5c3e,
    unlockLevel: 3
  },
  {
    id: "shield",
    name: "Shieldbearer",
    hp: 80,
    speed: 30,
    damage: 15,
    gold: 22,
    score: 30,
    kind: "ground",
    radius: 24,
    color: 0x8a93a3,
    unlockLevel: 4,
    shield: true
  },
  {
    id: "flyer",
    name: "Fellwing",
    hp: 36,
    speed: 72,
    damage: 10,
    gold: 16,
    score: 22,
    kind: "flying",
    radius: 18,
    color: 0x5b4a8a,
    unlockLevel: 5
  },
  {
    id: "healer",
    name: "Healer",
    hp: 64,
    speed: 34,
    damage: 4,
    gold: 26,
    score: 34,
    kind: "ground",
    radius: 20,
    color: 0xd8c46a,
    unlockLevel: 6,
    healer: true
  },
  {
    id: "sapper",
    name: "Sapper",
    hp: 48,
    speed: 56,
    damage: 60,
    gold: 34,
    score: 45,
    kind: "ground",
    radius: 20,
    color: 0xc86a2e,
    unlockLevel: 8,
    sapper: true
  },
  {
    id: "boss",
    name: "Warlord",
    hp: 1500,
    speed: 16,
    damage: 50,
    gold: 200,
    score: 500,
    kind: "ground",
    radius: 46,
    color: 0x7b2d3b,
    unlockLevel: 99,
    boss: true
  }
];

export const PERKS: PerkDef[] = [
  { id: "sharpened", name: "Sharpened Tips", desc: "+15% arrow damage." },
  { id: "critMastery", name: "Critical Mastery", desc: "+30% critical damage." },
  { id: "headhunter", name: "Headhunter", desc: "+10% critical chance." },
  { id: "vampiric", name: "Vampiric", desc: "Kills repair 3 wall HP." },
  { id: "manaflow", name: "Manaflow", desc: "+25% mana regeneration." },
  { id: "quicksilver", name: "Quicksilver", desc: "Shoot 15% faster." },
  { id: "goldlust", name: "Goldlust", desc: "+25% gold from kills." },
  { id: "bulwark", name: "Bulwark", desc: "+40 max wall HP." },
  { id: "fiery", name: "Fiery Touch", desc: "All arrows also ignite enemies." },
  { id: "frostbite", name: "Frostbite", desc: "All arrows also slow enemies." },
  { id: "stormcaller", name: "Stormcaller", desc: "Arrow Storm cooldown -30%." },
  { id: "frozenHeart", name: "Frozen Heart", desc: "Frost Nova cooldown -30%." }
];

export const UPGRADES: UpgradeDef[] = [
  { id: "power", name: "Bow Power", desc: "+8% arrow damage", baseCost: 60, maxLevel: 20 },
  { id: "drawSpeed", name: "Quick Draw", desc: "Shoot 6% faster", baseCost: 50, maxLevel: 15 },
  { id: "crit", name: "Eagle Eye", desc: "+3% critical chance", baseCost: 70, maxLevel: 15 },
  { id: "critDmg", name: "Deadeye", desc: "+10% critical damage", baseCost: 65, maxLevel: 15 },
  { id: "wall", name: "Fortify Gate", desc: "+15 max wall HP", baseCost: 45, maxLevel: 20 },
  { id: "mana", name: "Deep Reserves", desc: "+10 max mana", baseCost: 50, maxLevel: 15 },
  { id: "manaRegen", name: "Wellspring", desc: "+6% mana regen", baseCost: 55, maxLevel: 15 },
  { id: "goldGain", name: "Treasury", desc: "+8% gold from kills", baseCost: 60, maxLevel: 15 }
];

export const ARROW_UPGRADE_COST_BASE = 80;
export const ARROW_UPGRADE_DMG_STEP = 0.12; // +12% damage per arrow level

export const REGIONS: RegionDef[] = [
  { name: "Grasslands", from: 1, to: 4 },
  { name: "Dark Forest", from: 5, to: 8 },
  { name: "Frozen Peaks", from: 9, to:12 },
  { name: "Citadel", from: 13, to: 15 }
];

export const CAMPAIGN_LEVELS: LevelDef[] = [];
for (let i = 1; i <= 15; i++) {
  const boss = i === 4 || i === 8 || i === 12 || i === 15;
  let waves = 3;
  if (i >= 5) waves = 4;
  if (i >= 13) waves = 5;
  if (boss) waves = Math.max(waves, 4);
  if (i === 15) waves = 5;
  CAMPAIGN_LEVELS.push({ index: i, waves, boss });
}

export function regionForLevel(level: number): RegionDef | undefined {
  return REGIONS.find((r) => level >= r.from && level <= r.to);
}

export function unlockedArrows(highestLevelReached: number): ArrowId[] {
  return ARROWS.filter((a) => a.unlockLevel <= highestLevelReached + 1).map((a) => a.id);
}

export function unlockedAbilities(highestLevelReached: number): AbilityId[] {
  return ABILITIES.filter((a) => a.unlockLevel <= highestLevelReached + 1).map((a) => a.id);
}

export function arrowById(id: ArrowId): ArrowDef {
  return ARROWS.find((a) => a.id === id)!;
}
export function monsterById(id: MonsterId): MonsterDef {
  return MONSTERS.find((m) => m.id === id)!;
}
export function abilityById(id: AbilityId): AbilityDef {
  return ABILITIES.find((a) => a.id === id)!;
}
export function perkById(id: PerkId): PerkDef {
  return PERKS.find((p) => p.id === id)!;
}

// ---------------- wave generation ----------------

const WEIGHT: Record<MonsterId, number> = {
  grunt: 10,
  runner: 6,
  brute: 3,
  shield: 4,
  sapper: 2,
  flyer: 5,
  healer: 2,
  boss: 1
};

function rosterForLevel(level: number): MonsterId[] {
  const all: MonsterId[] = [];
  for (const m of MONSTERS) {
    if (m.id === "boss") continue;
    if (m.unlockLevel <= level) all.push(m.id);
  }
  return all.length ? all : ["grunt"];
}

function pickWeighted(roster: MonsterId[]): MonsterId {
  let total = 0;
  for (const id of roster) total += WEIGHT[id];
  let r = Math.random() * total;
  for (const id of roster) {
    r -= WEIGHT[id];
    if (r <= 0) return id;
  }
  return roster[roster.length - 1];
}

export function generateWaves(level: number): Spawn[][] {
  const def = CAMPAIGN_LEVELS.find((l) => l.index === level)!;
  const waves: Spawn[][] = [];
  const roster = rosterForLevel(level);
  const spacing = Math.max(0.5, 1.35 - level * 0.04);

  for (let w = 1; w <= def.waves; w++) {
    const spawns: Spawn[] = [];
    if (def.boss && w === def.waves) {
      // Boss + escort wave
      spawns.push({ monster: "boss", at: 1.0 });
      const escorts = 2 + Math.floor(level / 3);
      for (let e = 0; e < escorts; e++) {
        spawns.push({ monster: pickWeighted(roster), at: 0.2 + e * 1.4 });
        spawns.push({ monster: pickWeighted(roster), at: 4.0 + e * 1.4 });
      }
    } else {
      let budget = 9 + level * 2 + w * 4;
      let t = 0.3;
      while (budget > 0) {
        const id = pickWeighted(roster);
        budget -= WEIGHT[id];
        spawns.push({ monster: id, at: t });
        t += spacing * (0.75 + Math.random() * 0.5);
      }
    }
    waves.push(spawns);
  }
  return waves;
}

export function levelName(level: number): string {
  const region = regionForLevel(level);
  return region ? `${region.name} · Level ${level}` : `Level ${level}`;
}

export function generateEndlessWave(waveNum: number): Spawn[] {
  const level = Math.min(15, Math.floor(waveNum * 0.7) + 1);
  const roster = rosterForLevel(level);
  const spacing = Math.max(0.4, 1.1 - level * 0.03);
  let budget = 12 + waveNum * 5;
  const spawns: Spawn[] = [];
  let t = 0.3;
  while (budget > 0) {
    const id = pickWeighted(roster);
    budget -= WEIGHT[id];
    spawns.push({ monster: id, at: t });
    t += spacing * (0.75 + Math.random() * 0.5);
  }
  if (waveNum % 5 === 0) {
    spawns.unshift({ monster: "boss", at: 1.5 });
  }
  return spawns;
}

export function upgradeCost(def: UpgradeDef, currentLevel: number): number {
  return Math.round(def.baseCost * (currentLevel + 1));
}

export function arrowUpgradeCost(currentLevel: number): number {
  return Math.round(ARROW_UPGRADE_COST_BASE * (currentLevel + 1));
}
