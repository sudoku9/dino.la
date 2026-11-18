export type ArrowId =
  | "normal"
  | "fire"
  | "ice"
  | "pierce"
  | "explosive"
  | "lightning";

export type AbilityId = "arrowStorm" | "frostNova" | "wallOfFlame";

export type MonsterId =
  | "grunt"
  | "runner"
  | "brute"
  | "shield"
  | "sapper"
  | "flyer"
  | "healer"
  | "boss";

export type UpgradeId =
  | "power"
  | "drawSpeed"
  | "crit"
  | "critDmg"
  | "wall"
  | "mana"
  | "manaRegen"
  | "goldGain";

export type PerkId =
  | "sharpened"
  | "critMastery"
  | "headhunter"
  | "vampiric"
  | "manaflow"
  | "quicksilver"
  | "goldlust"
  | "bulwark"
  | "fiery"
  | "frostbite"
  | "stormcaller"
  | "frozenHeart";

export interface ArrowDef {
  id: ArrowId;
  name: string;
  desc: string;
  color: number;
  damage: number; // base damage multiplier
  manaCost: number;
  unlockLevel: number;
  pierce?: boolean;
  burn?: number; // burn damage per second
  slow?: number; // slow factor (0..1)
  freeze?: number; // freeze seconds
  explodeRadius?: number;
  chain?: number; // lightning chain target count
}

export interface AbilityDef {
  id: AbilityId;
  name: string;
  desc: string;
  cooldown: number; // seconds
  unlockLevel: number;
  color: number;
}

export interface MonsterDef {
  id: MonsterId;
  name: string;
  hp: number;
  speed: number; // px/s
  damage: number; // wall damage per hit
  gold: number;
  score: number;
  kind: "ground" | "flying";
  radius: number;
  color: number;
  unlockLevel: number;
  shield?: boolean;
  healer?: boolean;
  sapper?: boolean;
  boss?: boolean;
}

export interface PerkDef {
  id: PerkId;
  name: string;
  desc: string;
}

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  desc: string;
  baseCost: number;
  maxLevel: number;
}

export interface RegionDef {
  name: string;
  from: number; // inclusive level
  to: number; // inclusive level
}

export interface Spawn {
  monster: MonsterId;
  at: number; // seconds after wave start
}

export interface LevelDef {
  index: number; // 1-based
  waves: number;
  boss: boolean;
}

// ---------- runtime ----------

export interface StatusEffects {
  burnT: number;
  burnDps: number;
  slowT: number;
  slowF: number;
  freezeT: number;
}

export interface HitDef {
  color: number;
  burn?: number;
  slow?: number;
  freeze?: number;
  chain?: number;
}

export interface MonsterRuntime {
  def: MonsterDef;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attacking: boolean;
  attackTimer: number;
  effects: StatusEffects;
  container: Phaser.GameObjects.Container;
  hpBar: Phaser.GameObjects.Graphics;
  statusGfx: Phaser.GameObjects.Graphics;
  flashT: number;
  dead: boolean;
  seed: number;
  flyPhase: number;
}

export interface ArrowRuntime {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  def: ArrowDef;
  crit: boolean;
  targets: Set<MonsterRuntime>;
  image: Phaser.GameObjects.Image;
  trail: Phaser.GameObjects.Particles.ParticleEmitter | null;
  dead: boolean;
}

export interface DerivedStats {
  damageMult: number; // global multiplier
  arrowDamageMult: number; // arrow-specific multiplier
  cooldown: number;
  critChance: number;
  critMult: number;
  goldMult: number;
  manaMax: number;
  manaRegen: number;
  wallMax: number;
}

export interface HudArrow {
  id: ArrowId;
  name: string;
  key: string;
  mana: number;
  selected: boolean;
  unlocked: boolean;
}

export interface HudAbility {
  id: AbilityId;
  name: string;
  key: string;
  remaining: number;
  cooldown: number;
  ready: boolean;
  unlocked: boolean;
}

export interface HudState {
  wallHp: number;
  wallMax: number;
  wave: number;
  totalWaves: number;
  levelLabel: string;
  score: number;
  gold: number;
  mana: number;
  manaMax: number;
  combo: number;
  comboMult: number;
  wind: number;
  arrows: HudArrow[];
  abilities: HudAbility[];
  paused: boolean;
}
