import { TUNING } from "./constants";
import { arrowById } from "./data";
import type {
  AbilityId,
  ArrowId,
  DerivedStats,
  PerkId,
  UpgradeId
} from "./types";

export interface MetaState {
  gold: number;
  upgrades: Partial<Record<UpgradeId, number>>;
  arrowLevels: Partial<Record<ArrowId, number>>;
  highestLevelReached: number; // count of campaign levels completed (0 = none)
  bestScore: number;
  bestEndlessWave: number;
  endlessBestScore: number;
}

export function defaultMeta(): MetaState {
  return {
    gold: 0,
    upgrades: {},
    arrowLevels: {},
    highestLevelReached: 0,
    bestScore: 0,
    bestEndlessWave: 0,
    endlessBestScore: 0
  };
}

export interface RunState {
  level: number;
  endless: boolean;
  wave: number;
  totalWaves: number;
  gold: number;
  score: number;
  combo: number;
  comboMax: number;
  wallHp: number;
  wallMax: number;
  mana: number;
  manaMax: number;
  selectedArrow: ArrowId;
  abilities: AbilityId[];
  perks: PerkId[];
  kills: number;
}

export function newRun(level: number, endless: boolean): RunState {
  return {
    level,
    endless,
    wave: 0,
    totalWaves: endless ? Infinity : (level === 0 ? Infinity : 0),
    gold: 0,
    score: 0,
    combo: 0,
    comboMax: 0,
    wallHp: TUNING.wallMaxBase,
    wallMax: TUNING.wallMaxBase,
    mana: TUNING.manaMaxBase,
    manaMax: TUNING.manaMaxBase,
    selectedArrow: "normal",
    abilities: [],
    perks: [],
    kills: 0
  };
}

function up(meta: MetaState, id: UpgradeId): number {
  return meta.upgrades[id] ?? 0;
}

export function derivedStats(
  meta: MetaState,
  perks: PerkId[],
  arrow: ArrowId
): DerivedStats {
  const has = (p: PerkId) => perks.includes(p);
  const power = 1 + 0.08 * up(meta, "power");
  const sharp = has("sharpened") ? 1.15 : 1;
  const arrowLevel = meta.arrowLevels[arrow] ?? 0;
  const arrowMult = (1 + 0.12 * arrowLevel) * arrowById(arrow).damage;

  const cooldown =
    TUNING.shotCooldownBase *
    (1 - 0.06 * up(meta, "drawSpeed")) *
    (has("quicksilver") ? 0.85 : 1);

  const critChance =
    TUNING.critChanceBase + 0.03 * up(meta, "crit") + (has("headhunter") ? 0.1 : 0);

  const critMult =
    TUNING.critMultBase + 0.1 * up(meta, "critDmg") + (has("critMastery") ? 0.3 : 0);

  const goldMult =
    (1 + 0.08 * up(meta, "goldGain")) * (has("goldlust") ? 1.25 : 1);

  const manaMax = TUNING.manaMaxBase + 10 * up(meta, "mana");

  const manaRegen =
    TUNING.manaRegenBase *
    (1 + 0.06 * up(meta, "manaRegen")) *
    (has("manaflow") ? 1.25 : 1);

  const wallMax =
    TUNING.wallMaxBase + 15 * up(meta, "wall") + (has("bulwark") ? 40 : 0);

  return {
    damageMult: power * sharp,
    arrowDamageMult: arrowMult,
    cooldown,
    critChance,
    critMult,
    goldMult,
    manaMax,
    manaRegen,
    wallMax
  };
}

export function abilityCooldown(id: AbilityId, perks: PerkId[]): number {
  let cd = 18;
  if (id === "arrowStorm") cd = 18;
  if (id === "frostNova") cd = 24;
  if (id === "wallOfFlame") cd = 20;
  if (id === "arrowStorm" && perks.includes("stormcaller")) cd *= 0.7;
  if (id === "frostNova" && perks.includes("frozenHeart")) cd *= 0.7;
  return cd;
}
