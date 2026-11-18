import Phaser from "phaser";
import { PALETTE, TUNING } from "../game/constants";
import {
  STRUCTURES,
  abilityById,
  arrowById,
  generateEndlessWave,
  generateWaves,
  levelName,
  monsterById,
  structureById,
  unlockedAbilities,
  unlockedArrows
} from "../game/data";
import { bus } from "../game/events";
import {
  createMonsterVisual,
  createStructureVisual,
  drawBackground,
  drawCastle,
  drawGeneral,
  gateX,
  groundY,
  placeMonster,
  type GeneralParts
} from "../game/render";
import { submitScore } from "../game/save";
import {
  abilityCooldown,
  derivedStats,
  newRun,
  type MetaState,
  type RunState
} from "../game/state";
import type {
  AbilityId,
  ArrowId,
  ArrowRuntime,
  DerivedStats,
  HitDef,
  HudAbility,
  HudArrow,
  HudState,
  HudStructure,
  MonsterRuntime,
  PerkId,
  Spawn,
  StructureId,
  StructureRuntime
} from "../game/types";

const ARROW_KEYS = ["1", "2", "3", "4", "5", "6"];

export interface LevelResult {
  victory: boolean;
  level: number;
  endless: boolean;
  score: number;
  gold: number;
  wave: number;
  kills: number;
}

export class GameScene extends Phaser.Scene {
  meta: MetaState = { gold: 0, upgrades: {}, arrowLevels: {}, highestLevelReached: 0, bestScore: 0, bestEndlessWave: 0, endlessBestScore: 0 };
  run: RunState = newRun(1, false);
  stats: DerivedStats = derivedStats(this.meta, [], "normal");

  private w = 1280;
  private h = 720;
  private gy = 0;
  private gx = 0;
  private wallTop = 0;
  private general!: GeneralParts;
  private bgLayer!: Phaser.GameObjects.Container;
  private castleLayer!: Phaser.GameObjects.Container;

  private monsters: MonsterRuntime[] = [];
  private arrows: ArrowRuntime[] = [];
  private waves: Spawn[][] = [];
  private waveIndex = 0;
  private waveActive = false;
  private waveElapsed = 0;
  private spawnCursor = 0;
  private waveWallDamage = 0;
  private waveClearPending = false;
  private betweenWaves = false;

  private aiming = false;
  private aimX = 0;
  private aimY = 0;
  private trajectory: Phaser.GameObjects.Image[] = [];
  private aimLine!: Phaser.GameObjects.Graphics;

  private lastShotAt = 0;
  private cds: Record<AbilityId, number> = { arrowStorm: 0, frostNova: 0, wallOfFlame: 0 };
  private comboTimer = 0;
  private wind = 0;
  private manaRefillGuard = 0;

  private ended = false;
  private paused = false;
  private idle = true;
  private hudTimer = 0;
  private frameCount = 0;
  private prepTimer = 0;
  private interWaveTimer = 0;
  private slowmoTimer = 0;
  private timeScale = 1;
  private pendingVictory = false;
  private gameTime = 0;
  private cleanup: { p: Phaser.GameObjects.Particles.ParticleEmitter; ttl: number }[] = [];
  private structures: StructureRuntime[] = [];
  private buildMode: StructureId | null = null;
  private ghost: Phaser.GameObjects.Container | null = null;

  private flameWalls: { x: number; y0: number; y1: number; ttl: number; g: Phaser.GameObjects.Graphics }[] = [];
  private stormArrows: { x: number; y: number; t: number }[] = [];

  constructor() {
    super("GameScene");
  }

  create(): void {
    this.w = this.scale.width;
    this.h = this.scale.height;
    this.gy = groundY(this.h);
    this.gx = gateX(this.w);
    this.wallTop = this.gy - Math.round(this.h * 0.3);
    this.ended = false;
    this.paused = false;
    this.idle = true;

    this.makeTextures();
    this.drawWorld();
    this.bindInput();

    this.scale.on("resize", this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.onResize, this);
    });
  }

  // ---------------- setup ----------------
  private makeTextures(): void {
    if (!this.textures.exists("pixel")) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 4, 4);
      g.generateTexture("pixel", 4, 4);
      g.destroy();
    }
    if (!this.textures.exists("arrow")) {
      const ag = this.make.graphics({ x: 0, y: 0 }, false);
      ag.fillStyle(0xffffff, 1);
      ag.fillRect(0, 2, 24, 3);
      ag.fillTriangle(24, 0, 24, 7, 33, 3.5);
      ag.generateTexture("arrow", 34, 8);
      ag.destroy();
    }
  }

  private drawWorld(): void {
    this.bgLayer = drawBackground(this, { w: this.w, h: this.h });
    this.castleLayer = drawCastle(this, { w: this.w, h: this.h });
    this.general = drawGeneral(this, 62, this.wallTop, Math.max(0.9, this.h / 720));
    this.aimLine = this.add.graphics();
    this.aimLine.setDepth(10);
  }

  private onResize = (): void => {
    this.w = this.scale.width;
    this.h = this.scale.height;
    this.gy = groundY(this.h);
    this.gx = gateX(this.w);
    this.wallTop = this.gy - Math.round(this.h * 0.3);
    // redraw static scenery layers only (never touch monsters / arrows)
    this.bgLayer?.destroy(true);
    this.castleLayer?.destroy(true);
    this.general.container?.destroy(true);
    this.bgLayer = drawBackground(this, { w: this.w, h: this.h });
    this.castleLayer = drawCastle(this, { w: this.w, h: this.h });
    this.general = drawGeneral(this, 62, this.wallTop, Math.max(0.9, this.h / 720));
    for (const m of this.monsters) {
      m.y = m.def.kind === "flying" ? this.gy - 140 : this.laneY(m.lane);
      m.container.y = m.y;
    }
    for (const s of this.structures) {
      s.y = this.laneY(s.lane);
      s.container.y = s.y;
    }
    this.pushHud();
  };

  private bindInput(): void {
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => this.onPointerUp(p));

    this.input.keyboard?.on("keydown", (ev: KeyboardEvent) => this.onKey(ev));
  }

  private onKey(ev: KeyboardEvent): void {
    const key = ev.key.toLowerCase();
    if (ARROW_KEYS.includes(key)) {
      const idx = ARROW_KEYS.indexOf(key);
      const unlocked = this.unlockedArrows();
      const id = unlocked[idx];
      if (id) this.selectArrow(id);
      return;
    }
    if (key === "escape") {
      this.setBuildMode(null);
      return;
    }
    if (key === "q") this.useAbility(this.run.abilities[0]);
    if (key === "e") this.useAbility(this.run.abilities[1]);
    if (key === "p" || key === " ") {
      this.togglePause();
      ev.preventDefault();
    }
  }

  // ---------------- public control (called by UI) ----------------
  public selectArrow(id: ArrowId): void {
    if (!this.unlockedArrows().includes(id)) return;
    this.run.selectedArrow = id;
    this.pushHud();
  }

  public useAbility(id: AbilityId | undefined): void {
    if (!id || this.paused || this.ended || this.idle) return;
    if (this.cds[id] > 0) return;
    const def = abilityById(id);
    this.cds[id] = abilityCooldown(id, this.run.perks);
    if (id === "arrowStorm") this.castArrowStorm();
    if (id === "frostNova") this.castFrostNova();
    if (id === "wallOfFlame") this.castWallOfFlame();
    this.toast(`${def.name}!`);
  }

  public togglePause(): void {
    if (this.ended || this.idle) return;
    this.paused = !this.paused;
    this.pushHud();
    bus.emit("pause", this.paused);
  }

  public setPaused(v: boolean): void {
    this.paused = v;
    this.pushHud();
  }

  public debug(): object {
    return {
      waveIndex: this.waveIndex,
      waveActive: this.waveActive,
      idle: this.idle,
      paused: this.paused,
      ended: this.ended,
      time: Math.round(this.time.now),
      monsters: this.monsters.length,
      arrows: this.arrows.length,
      wind: this.wind,
      frames: this.frameCount,
      loopRunning: this.game.loop.running,
      hidden: (typeof document !== "undefined" && document.hidden) || false,
      gameTime: Math.round(this.gameTime * 100) / 100,
      prepTimer: Math.round(this.prepTimer * 100) / 100,
      interWave: Math.round(this.interWaveTimer * 100) / 100,
      gold: this.run.gold,
      structures: this.structures.length,
      buildMode: this.buildMode
    };
  }

  // ---------------- level / wave flow ----------------
  public startLevel(level: number, endless: boolean, perks: PerkId[] = []): void {
    this.clearBattlefield();
    this.run = newRun(level, endless);
    this.run.perks = perks;
    this.run.abilities = unlockedAbilities(this.meta.highestLevelReached).slice(-2);
    this.stats = derivedStats(this.meta, this.run.perks, this.run.selectedArrow);
    this.run.manaMax = this.stats.manaMax;
    this.run.mana = this.stats.manaMax;
    this.run.wallMax = this.stats.wallMax;
    this.run.wallHp = this.stats.wallMax;
    this.run.totalWaves = endless ? Infinity : (generateWaves(level).length);
    this.waves = endless ? [] : generateWaves(level);
    this.waveIndex = 0;
    this.cds = { arrowStorm: 0, frostNova: 0, wallOfFlame: 0 };
    this.comboTimer = 0;
    this.monsters = [];
    this.arrows = [];
    this.flameWalls = [];
    this.stormArrows = [];
    this.ended = false;
    this.idle = false;
    this.waveActive = false;
    this.betweenWaves = false;
    this.waveClearPending = false;

    this.prepTimer = TUNING.wavePrepSeconds;
    this.timeScale = 1;
    this.slowmoTimer = 0;
    this.interWaveTimer = 0;
    this.pendingVictory = false;
    this.showBanner(endless ? "ENDLESS MODE" : levelName(level), "Ready...");
    this.pushHud();
  }

  private startWave(w: number): void {
    if (this.ended) return;
    this.waveIndex = w;
    this.waveActive = true;
    this.waveElapsed = 0;
    this.spawnCursor = 0;
    this.waveWallDamage = 0;
    this.waveClearPending = false;
    this.betweenWaves = false;
    // randomize wind each wave
    this.wind = Math.round((Math.random() * 2 - 1) * TUNING.windMax);
    this.showBanner(`Wave ${w}${this.run.totalWaves !== Infinity ? ` / ${this.run.totalWaves}` : ""}`, "");
    this.pushHud();
  }

  private currentSpawns(): Spawn[] {
    if (this.run.endless) {
      return this.waves[0] ?? [];
    }
    return this.waves[this.waveIndex - 1] ?? [];
  }

  private ensureEndlessWave(): void {
    if (!this.run.endless || this.waves.length > 0) return;
    this.waves.push(generateEndlessWave(this.waveIndex));
  }

  private laneY(lane: number): number {
    return this.gy - 64 + lane * 32;
  }

  private spawnMonster(id: MonsterRuntime["def"]["id"]): void {
    const def = monsterById(id);
    const visual = createMonsterVisual(this, id, Math.floor(Math.random() * 1000));
    const x = this.w + 50;
    const lane = def.kind === "flying" ? -1 : Math.floor(Math.random() * 3);
    const y = def.kind === "flying" ? this.gy - 140 : this.laneY(lane);
    placeMonster(visual, x, y);
    const hpBar = this.add.graphics();
    hpBar.setDepth(4);
    const statusGfx = this.add.graphics();
    statusGfx.setDepth(4);
    const m: MonsterRuntime = {
      def,
      x,
      y,
      lane,
      hp: def.hp * (id === "boss" ? 1 + Math.floor(this.run.level / 5) * 0.5 : 1),
      maxHp: 0,
      attacking: false,
      attackTimer: 0,
      targetBarricade: null,
      effects: { burnT: 0, burnDps: 0, slowT: 0, slowF: 0, freezeT: 0 },
      container: visual.container,
      hpBar,
      statusGfx,
      flashT: 0,
      dead: false,
      seed: Math.random() * 100,
      flyPhase: Math.random() * Math.PI * 2
    };
    m.maxHp = m.hp;
    visual.container.setData("parts", visual.parts);
    this.monsters.push(m);
  }

  // ---------------- update ----------------
  update(_time: number, delta: number): void {
    this.frameCount++;
    if (this.paused || this.ended || this.idle) return;
    const dt = (Math.min(delta, 50) / 1000) * this.timeScale;
    this.gameTime += dt;

    // dt-driven timers (robust even when frames are throttled)
    if (this.slowmoTimer > 0) {
      this.slowmoTimer -= dt;
      if (this.slowmoTimer <= 0) this.timeScale = 1;
    }
    if (this.prepTimer > 0) {
      this.prepTimer -= dt;
      if (this.prepTimer <= 0) this.startWave(1);
    }
    if (this.interWaveTimer > 0) {
      this.interWaveTimer -= dt;
      if (this.interWaveTimer <= 0) this.advanceAfterWave();
    }
    for (let i = this.cleanup.length - 1; i >= 0; i--) {
      this.cleanup[i].ttl -= dt;
      if (this.cleanup[i].ttl <= 0) {
        this.cleanup[i].p.destroy();
        this.cleanup.splice(i, 1);
      }
    }

    // mana regen
    this.run.mana = Math.min(this.stats.manaMax, this.run.mana + this.stats.manaRegen * dt);

    // cooldowns
    for (const id of Object.keys(this.cds) as AbilityId[]) {
      if (this.cds[id] > 0) this.cds[id] = Math.max(0, this.cds[id] - dt);
    }

    // combo timer
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.run.combo = 0;
    }

    // waves
    if (this.waveActive) {
      this.waveElapsed += dt;
      this.ensureEndlessWave();
      const spawns = this.currentSpawns();
      while (this.spawnCursor < spawns.length && spawns[this.spawnCursor].at <= this.waveElapsed) {
        this.spawnMonster(spawns[this.spawnCursor].monster);
        this.spawnCursor++;
      }
      if (this.spawnCursor >= spawns.length && this.monsters.length === 0 && !this.waveClearPending) {
        this.waveClearPending = true;
        this.onWaveClear();
      }
    }

    this.updateArrows(dt);
    this.updateMonsters(dt);
    this.updateStructures(dt);
    this.updateAimPreview();
    this.updateFlameWalls(dt);
    this.updateStormArrows(dt);

    // HUD throttle
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      this.pushHud();
    }
  }

  // ---------------- aiming ----------------
  private onPointerDown(p: Phaser.Input.Pointer): void {
    if (this.paused || this.ended || this.idle) return;
    if (this.buildMode) {
      const lane = Phaser.Math.Clamp(Math.round((p.y - (this.gy - 64)) / 32), 0, 2);
      const x = Phaser.Math.Clamp(p.x, this.gx + 55, this.w - 50);
      if (this.placeStructure(this.buildMode, lane, x)) {
        this.setBuildMode(null);
      }
      return;
    }
    if (p.x > this.gx - 10) {
      this.aiming = true;
      this.aimX = p.x;
      this.aimY = p.y;
      this.updateAimPreview();
    }
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    if (this.buildMode && this.ghost) {
      const lane = Phaser.Math.Clamp(Math.round((p.y - (this.gy - 64)) / 32), 0, 2);
      const x = Phaser.Math.Clamp(p.x, this.gx + 55, this.w - 50);
      this.ghost.setPosition(x, this.laneY(lane));
      this.ghost.setVisible(true);
      return;
    }
    this.aimX = p.x;
    this.aimY = p.y;
  }

  private onPointerUp(_p: Phaser.Input.Pointer): void {
    if (!this.aiming) return;
    this.aiming = false;
    if (this.gameTime - this.lastShotAt < this.stats.cooldown) return;
    const dx = this.aimX - this.general.bowX;
    const dy = this.aimY - this.general.bowY;
    const dist = Math.hypot(dx, dy);
    if (dist < 20) return;
    const angle = Math.atan2(dy, dx);
    const maxDist = Math.min(this.w, this.h) * 0.85;
    const power = Phaser.Math.Clamp(dist / maxDist, 0.22, 1);
    this.fireArrow(angle, power);
  }

  private updateAimPreview(): void {
    this.aimLine.clear();
    for (const t of this.trajectory) t.destroy();
    this.trajectory = [];
    if (!this.aiming) return;
    const dx = this.aimX - this.general.bowX;
    const dy = this.aimY - this.general.bowY;
    const dist = Math.hypot(dx, dy);
    if (dist < 20) return;
    const angle = Math.atan2(dy, dx);
    const maxDist = Math.min(this.w, this.h) * 0.85;
    const power = Phaser.Math.Clamp(dist / maxDist, 0.22, 1);
    const pts = this.simulateTrajectory(this.general.bowX, this.general.bowY, angle, power);
    const arrow = this.run.selectedArrow;
    const col = arrowById(arrow).color;
    for (let i = 0; i < pts.length; i++) {
      if (i % 2 !== 0) continue;
      const img = this.add.image(pts[i].x, pts[i].y, "pixel");
      img.setScale(1.4);
      img.setTint(col);
      img.setAlpha(0.75 - i / (pts.length * 2));
      img.setDepth(9);
      this.trajectory.push(img);
    }
    // aim line from bow
    this.aimLine.lineStyle(2, 0xffffff, 0.4);
    this.aimLine.lineBetween(this.general.bowX, this.general.bowY, this.aimX, this.aimY);
  }

  private simulateTrajectory(bx: number, by: number, angle: number, power: number): { x: number; y: number }[] {
    const speed = TUNING.arrowSpeedMin + (TUNING.arrowSpeedFull - TUNING.arrowSpeedMin) * power;
    let vx = Math.cos(angle) * speed;
    let vy = Math.sin(angle) * speed;
    let x = bx;
    let y = by;
    const pts: { x: number; y: number }[] = [];
    const step = 1 / 60;
    for (let i = 0; i < 90; i++) {
      x += vx * step;
      y += vy * step;
      vy += TUNING.gravity * step;
      vx += this.wind * step;
      pts.push({ x, y });
      if (y > this.gy + 8) break;
      if (x < 0 || x > this.w + 60) break;
    }
    return pts;
  }

  // ---------------- arrows ----------------
  private fireArrow(angle: number, power: number): void {
    const def = arrowById(this.run.selectedArrow);
    if (def.manaCost > 0 && this.run.mana < def.manaCost) {
      this.toast("Not enough mana!");
      return;
    }
    this.run.mana -= def.manaCost;
    this.lastShotAt = this.gameTime;

    const speed = TUNING.arrowSpeedMin + (TUNING.arrowSpeedFull - TUNING.arrowSpeedMin) * power;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const x = this.general.bowX;
    const y = this.general.bowY;
    const crit = Math.random() < this.stats.critChance;

    const img = this.add.image(x, y, "arrow");
    img.setTint(def.color);
    img.setDepth(5);
    img.setRotation(angle);

    let trail: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
    if (def.id !== "normal") {
      trail = this.add.particles(0, 0, "pixel", {
        speed: 12,
        lifespan: 220,
        scale: { start: 1.4, end: 0 },
        quantity: 1,
        frequency: 28,
        tint: def.color,
        blendMode: Phaser.BlendModes.ADD
      });
      trail.setDepth(4);
      trail.startFollow(img);
    }

    const damage = 18 * this.stats.damageMult * this.stats.arrowDamageMult * (crit ? this.stats.critMult : 1);

    const arrow: ArrowRuntime = {
      x,
      y,
      vx,
      vy,
      damage,
      def,
      crit,
      targets: new Set(),
      image: img,
      trail,
      dead: false
    };
    this.arrows.push(arrow);

    // launch flash particles
    this.burst(x, y, def.color, 5, 60);
    this.cameras.main.shake(20, 0.01);
  }

  private updateArrows(dt: number): void {
    for (const a of this.arrows) {
      if (a.dead) continue;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.vy += TUNING.gravity * dt;
      a.vx += this.wind * dt;
      a.image.setPosition(a.x, a.y);
      a.image.setRotation(Math.atan2(a.vy, a.vx));

      // out of bounds
      if (a.y > this.gy + 10 || a.x < -20 || a.x > this.w + 60) {
        this.killArrow(a, false);
        continue;
      }

      // collision
      let hit = false;
      for (const m of this.monsters) {
        if (m.dead || a.targets.has(m)) continue;
        const r = m.def.radius + TUNING.arrowRadius;
        const mx = m.container.x;
        const my = m.container.y - m.def.radius * 0.5;
        if (Math.hypot(a.x - mx, a.y - my) < r) {
          this.applyArrowHit(a, m);
          if (a.def.pierce || a.def.explodeRadius) {
            a.targets.add(m);
            if (a.def.pierce) continue; // keep flying
            // explosive: detonate and stop
            hit = true;
            this.killArrow(a, false);
            break;
          }
          hit = true;
          this.killArrow(a, false);
          break;
        }
      }
      if (hit && a.def.explodeRadius) {
        this.explodeAt(a.x, a.y, a.def.explodeRadius, a.damage, a.def);
      }
    }
    this.arrows = this.arrows.filter((a) => !a.dead);
  }

  private applyArrowHit(a: ArrowRuntime, m: MonsterRuntime): void {
    // A frozen shieldbearer lowers its shield; explosive arrows blow through.
    const shieldUp = m.def.shield && m.effects.freezeT <= 0 && !a.def.explodeRadius;
    if (shieldUp && !this.isSteepArrow(a)) {
      // fire arrows still splash and ignite through the shield
      if (a.def.burn) {
        m.effects.burnT = Math.max(m.effects.burnT, TUNING.burnDuration);
        m.effects.burnDps = Math.max(m.effects.burnDps, a.def.burn);
      }
      this.burst(m.container.x - 16, m.container.y - 20, 0xcfd6e0, 6, 90);
      this.floatText(m.container.x - 20, m.container.y - 44, "BLOCKED", 0xcfd6e0);
      return;
    }
    this.damageMonster(m, a.damage, a.crit, a.def);
  }

  private isSteepArrow(a: ArrowRuntime): boolean {
    // a steeply descending arrow (high arc) falls over the top of the shield
    return Math.atan2(a.vy, a.vx) > Math.PI / 6;
  }

  private killArrow(a: ArrowRuntime, silent: boolean): void {
    if (a.dead) return;
    a.dead = true;
    a.image.destroy();
    if (a.trail) {
      a.trail.stop();
      a.trail.destroy();
    }
    if (!silent && a.def.id === "normal") {
      // small ground puff
    }
  }

  private explodeAt(x: number, y: number, radius: number, damage: number, def: HitDef): void {
    this.burst(x, y, 0xffb03a, 18, 140);
    this.cameras.main.shake(60, 0.03);
    for (const m of this.monsters) {
      if (m.dead) continue;
      const mx = m.container.x;
      const my = m.container.y - m.def.radius * 0.5;
      if (Math.hypot(x - mx, y - my) < radius + m.def.radius) {
        this.damageMonster(m, damage, false, def);
        // knockback
        const dir = Math.sign(mx - x) || 1;
        m.x += dir * 16;
        m.container.x += dir * 16;
      }
    }
  }

  // ---------------- lightning chain ----------------
  private chainLightning(from: MonsterRuntime, count: number, damage: number): void {
    const hit: MonsterRuntime[] = [from];
    let current = from;
    for (let i = 0; i < count; i++) {
      let best: MonsterRuntime | null = null;
      let bestD = 180;
      for (const m of this.monsters) {
        if (m.dead || hit.includes(m)) continue;
        const d = Math.hypot(m.container.x - current.container.x, m.container.y - current.container.y);
        if (d < bestD) {
          bestD = d;
          best = m;
        }
      }
      if (!best) break;
      this.drawLightning(current.container.x, current.container.y - current.def.radius * 0.5, best.container.x, best.container.y - best.def.radius * 0.5);
      this.damageMonster(best, damage * 0.7, false, { color: 0x9be7ff });
      hit.push(best);
      current = best;
    }
  }

  private drawLightning(x1: number, y1: number, x2: number, y2: number): void {
    const g = this.add.graphics();
    g.setDepth(8);
    g.lineStyle(2, 0x9be7ff, 1);
    let cx = x1;
    let cy = y1;
    const segs = 6;
    for (let i = 0; i < segs; i++) {
      const t = (i + 1) / segs;
      const nx = Phaser.Math.Linear(x1, x2, t) + (Math.random() * 20 - 10);
      const ny = Phaser.Math.Linear(y1, y2, t) + (Math.random() * 20 - 10);
      g.lineBetween(cx, cy, nx, ny);
      cx = nx;
      cy = ny;
    }
    this.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() });
  }

  // ---------------- damage / death ----------------
  private damageMonster(m: MonsterRuntime, amount: number, crit: boolean, def: HitDef): void {
    if (m.dead) return;
    m.hp -= amount;
    m.flashT = 0.1;
    // apply arrow status effects
    if (def.burn) {
      m.effects.burnT = TUNING.burnDuration;
      m.effects.burnDps = Math.max(m.effects.burnDps, def.burn);
    }
    if (def.slow) {
      m.effects.slowT = TUNING.slowDuration;
      m.effects.slowF = def.slow;
    }
    if (def.freeze) {
      m.effects.freezeT = def.freeze;
    }
    // perk statuses
    if (this.run.perks.includes("fiery") && !def.burn) {
      m.effects.burnT = Math.max(m.effects.burnT, 2);
      m.effects.burnDps = Math.max(m.effects.burnDps, 10);
    }
    if (this.run.perks.includes("frostbite") && !def.slow) {
      m.effects.slowT = Math.max(m.effects.slowT, 1.6);
      m.effects.slowF = 0.7;
    }
    this.burst(m.container.x, m.container.y - m.def.radius * 0.5, def.color, crit ? 8 : 4, crit ? 120 : 80);
    this.floatText(m.container.x, m.container.y - m.def.radius * 2, String(Math.round(amount)), crit ? 0xffd76a : 0xffffff);
    if (def.chain) this.chainLightning(m, def.chain, amount);
    if (m.hp <= 0) this.killMonster(m);
  }

  private killMonster(m: MonsterRuntime): void {
    if (m.dead) return;
    m.dead = true;
    this.run.kills++;
    this.run.combo++;
    this.comboTimer = TUNING.comboWindow;
    if (this.run.combo > this.run.comboMax) this.run.comboMax = this.run.combo;
    const mult = this.comboMult();
    const gold = Math.round(m.def.gold * this.stats.goldMult * mult);
    const score = Math.round(m.def.score * mult);
    this.run.gold += gold;
    this.run.score += score;

    // sapper explodes on death (friendly fire)
    if (m.def.sapper) {
      this.explodeAt(m.container.x, m.container.y - 10, 80, 50, m.def);
    }
    // vampiric perk
    if (this.run.perks.includes("vampiric")) {
      this.run.wallHp = Math.min(this.run.wallMax, this.run.wallHp + 3);
    }

    this.burst(m.container.x, m.container.y - m.def.radius * 0.5, m.def.color, 16, 140);
    this.cameras.main.shake(m.def.boss ? 120 : 30, m.def.boss ? 0.05 : 0.02);
    if (m.def.boss) {
      this.cameras.main.flash(120, 255, 255, 255);
      this.timeScale = 0.3;
      this.slowmoTimer = 0.35;
    }
    this.floatText(m.container.x, m.container.y - m.def.radius * 2 - 14, `+${gold}`, PALETTE.gold);

    m.container.destroy();
    m.hpBar.destroy();
    m.statusGfx.destroy();
  }

  private comboMult(): number {
    return Math.min(TUNING.comboMaxMult, 1 + this.run.combo * TUNING.comboStep);
  }

  private floatText(x: number, y: number, str: string, color: number): void {
    const t = this.add.text(x, y, str, {
      fontFamily: "Georgia, serif",
      fontSize: "16px",
      color: "#" + color.toString(16).padStart(6, "0"),
      stroke: "#1b1f3a",
      strokeThickness: 2
    });
    t.setOrigin(0.5, 1);
    t.setDepth(12);
    this.tweens.add({
      targets: t,
      y: y - 26,
      alpha: 0,
      duration: 650,
      ease: "Cubic.easeOut",
      onComplete: () => t.destroy()
    });
  }

  private burst(x: number, y: number, color: number, count: number, speed: number): void {
    const p = this.add.particles(x, y, "pixel", {
      speed: { min: speed * 0.4, max: speed },
      angle: { min: 0, max: 360 },
      lifespan: { min: 150, max: 380 },
      scale: { start: 1.6, end: 0 },
      quantity: count,
      tint: color,
      emitting: false,
      blendMode: Phaser.BlendModes.NORMAL
    });
    p.setDepth(7);
    p.explode(count);
    this.cleanup.push({ p, ttl: 0.5 });
  }

  // ---------------- monsters ----------------
  private updateMonsters(dt: number): void {
    const healRadius = 90;
    for (const m of this.monsters) {
      if (m.dead) continue;
      // status effects
      const e = m.effects;
      if (e.freezeT > 0) {
        e.freezeT -= dt;
      }
      if (e.burnT > 0) {
        e.burnT -= dt;
        m.hp -= e.burnDps * dt;
        if (Math.random() < 0.2) {
          this.burst(m.container.x, m.container.y - m.def.radius, PALETTE.ember, 1, 40);
        }
        if (m.hp <= 0) {
          this.killMonster(m);
          continue;
        }
      }
      if (e.slowT > 0) {
        e.slowT -= dt;
      }

      // flash
      if (m.flashT > 0) {
        m.flashT -= dt;
        m.container.setAlpha(0.6);
      } else {
        m.container.setAlpha(1);
      }

      // movement
      if (e.freezeT <= 0) {
        const speed = m.def.speed * (e.slowT > 0 ? e.slowF : 1);
        if (!m.attacking) {
          // stop at a barricade blocking this lane
          let barricade: StructureRuntime | null = null;
          if (m.lane >= 0) {
            for (const s of this.structures) {
              if (s.dead || s.def.id !== "barricade" || s.lane !== m.lane) continue;
              if (s.x < m.x && m.x - s.x < 30) {
                barricade = s;
                break;
              }
            }
          }
          if (barricade) {
            m.targetBarricade = barricade;
            barricade.hp -= m.def.damage * dt;
            this.burst(m.container.x - 8, m.container.y - 20, 0x8a6038, 1, 30);
            if (barricade.hp <= 0) {
              this.destroyStructure(barricade);
              m.targetBarricade = null;
            }
          } else {
            m.targetBarricade = null;
            const targetX = this.gx;
            if (m.x > targetX) {
              m.x -= speed * dt;
              m.container.x = m.x;
            } else {
              m.attacking = true;
              m.attackTimer = m.def.sapper ? 0 : 0.6;
            }
          }
        }
      }

      // flyer hover
      if (m.def.kind === "flying") {
        m.flyPhase += dt * 6;
        m.container.y = m.y + Math.sin(m.flyPhase) * 6;
        const parts = m.container.getData("parts") as { wingL?: Phaser.GameObjects.Graphics; wingR?: Phaser.GameObjects.Graphics };
        if (parts?.wingL) parts.wingL.rotation = Math.sin(m.flyPhase * 1.4) * 0.6;
        if (parts?.wingR) parts.wingR.rotation = -Math.sin(m.flyPhase * 1.4) * 0.6;
      } else {
        // walk bob
        m.container.y = m.y + Math.abs(Math.sin(m.flyPhase * 2)) * -2;
      }

      // healer aura
      if (m.def.healer && !m.attacking) {
        m.attackTimer += dt;
        if (m.attackTimer > 2) {
          m.attackTimer = 0;
          this.burst(m.container.x, m.container.y - 40, 0xd8c46a, 6, 50);
          for (const o of this.monsters) {
            if (o.dead || o === m) continue;
            if (Math.hypot(o.container.x - m.container.x, o.container.y - m.container.y) < healRadius) {
              o.hp = Math.min(o.maxHp, o.hp + 8);
            }
          }
        }
      }

      // attack wall
      if (m.attacking) {
        m.attackTimer -= dt;
        if (m.attackTimer <= 0) {
          if (m.def.sapper) {
            // sapper detonates against the wall
            this.burst(m.container.x, m.container.y - 12, PALETTE.ember, 22, 160);
            this.cameras.main.shake(100, 0.05);
            this.damageWall(m.def.damage);
            m.container.destroy();
            m.hpBar.destroy();
            m.statusGfx.destroy();
            m.dead = true;
            continue;
          }
          m.attackTimer = 0.7;
          this.damageWall(m.def.damage);
          this.burst(m.container.x - 6, m.container.y - 20, PALETTE.blood, 3, 40);
        }
      }

      // hp bar + status overlay
      this.drawHpBar(m);
      this.drawStatus(m);
    }
    this.monsters = this.monsters.filter((m) => !m.dead);
  }

  private drawHpBar(m: MonsterRuntime): void {
    const g = m.hpBar;
    g.clear();
    const w = m.def.boss ? 70 : 34;
    const x = m.container.x - w / 2;
    const y = m.container.y - m.def.radius * 2.4 - 6;
    g.fillStyle(0x1b1f3a, 0.7);
    g.fillRect(x - 1, y - 1, w + 2, 6);
    g.fillStyle(0x3a3f52, 1);
    g.fillRect(x, y, w, 4);
    const ratio = Math.max(0, m.hp / m.maxHp);
    const col = ratio > 0.5 ? PALETTE.leaf : ratio > 0.25 ? PALETTE.gold : PALETTE.ember;
    g.fillStyle(col, 1);
    g.fillRect(x, y, w * ratio, 4);
  }

  private drawStatus(m: MonsterRuntime): void {
    const g = m.statusGfx;
    g.clear();
    const e = m.effects;
    const cx = m.container.x;
    const cy = m.container.y - m.def.radius * 0.5;
    if (e.freezeT > 0) {
      g.fillStyle(0x9be7ff, 0.4);
      g.fillCircle(cx, cy, m.def.radius + 7);
      g.fillStyle(0xdff7ff, 0.95);
      const r = m.def.radius;
      g.fillTriangle(cx - r * 0.5, cy - 2, cx - r * 0.1, cy - 2, cx - r * 0.3, cy - 14);
      g.fillTriangle(cx + r * 0.1, cy - 4, cx + r * 0.5, cy - 4, cx + r * 0.3, cy - 18);
      g.fillTriangle(cx - r * 0.15, cy + 2, cx + r * 0.2, cy + 2, cx, cy - 10);
    } else if (e.slowT > 0) {
      g.fillStyle(0xbfe9f2, 0.24);
      g.fillCircle(cx, cy, m.def.radius + 4);
    }
  }

  private damageWall(amount: number): void {
    this.run.wallHp -= amount;
    this.waveWallDamage += amount;
    this.cameras.main.shake(40, 0.03);
    this.cameras.main.flash(80, 200, 40, 40);
    if (this.run.wallHp <= 0) {
      this.run.wallHp = 0;
      this.onDefeat();
    }
  }

  // ---------------- abilities ----------------
  private castFrostNova(): void {
    this.cameras.main.flash(160, 127, 216, 232);
    this.cameras.main.shake(80, 0.04);
    const ring = this.add.graphics();
    ring.setDepth(8);
    ring.lineStyle(5, 0xdff7ff, 1);
    ring.strokeCircle(this.gx, this.gy - 60, 24);
    this.tweens.add({
      targets: ring,
      alpha: 0,
      scale: 9,
      duration: 500,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy()
    });
    this.burst(this.gx, this.gy - 60, PALETTE.ice, 60, 220);
    this.burst(this.gx, this.gy - 60, 0xdff7ff, 30, 140);
    for (const m of this.monsters) {
      if (m.dead) continue;
      m.effects.freezeT = 3;
    }
  }

  private castArrowStorm(): void {
    // target the area around the monster closest to the wall
    let target: MonsterRuntime | null = null;
    for (const m of this.monsters) {
      if (m.dead) continue;
      if (!target || m.x < target.x) target = m;
    }
    const cx = target ? target.x : this.gx + 160;
    const cy = target ? target.y : this.gy;
    this.cameras.main.shake(60, 0.03);
    const ring = this.add.graphics();
    ring.setDepth(2);
    ring.fillStyle(PALETTE.gold, 0.22);
    ring.fillCircle(cx, cy - 30, 130);
    ring.lineStyle(2, PALETTE.gold, 0.85);
    ring.strokeCircle(cx, cy - 30, 130);
    this.tweens.add({ targets: ring, alpha: 0, duration: 900, onComplete: () => ring.destroy() });
    for (let i = 0; i < 26; i++) {
      this.stormArrows.push({ x: cx + (Math.random() * 260 - 130), y: cy - 30 - Math.random() * 110, t: i * 0.08 });
    }
    this.burst(cx, cy - 40, PALETTE.gold, 24, 160);
  }

  private updateStormArrows(dt: number): void {
    for (let i = this.stormArrows.length - 1; i >= 0; i--) {
      const s = this.stormArrows[i];
      s.t -= dt;
      if (s.t <= 0) {
        // arrow strikes
        this.burst(s.x, s.y, PALETTE.gold, 4, 80);
        const img = this.add.image(s.x, s.y, "arrow").setTint(PALETTE.gold).setRotation(Math.PI / 2).setDepth(5);
        this.tweens.add({ targets: img, alpha: 0, y: img.y + 14, duration: 350, onComplete: () => img.destroy() });
        for (const m of this.monsters) {
          if (m.dead) continue;
          if (Math.hypot(m.container.x - s.x, m.container.y - s.y) < 60) {
            this.damageMonster(m, 20 * this.stats.damageMult, false, { color: PALETTE.gold });
          }
        }
        this.stormArrows.splice(i, 1);
      }
    }
  }

  private castWallOfFlame(): void {
    const x = this.gx + 130;
    const g = this.add.graphics();
    g.setDepth(2);
    this.flameWalls.push({ x, y0: this.wallTop - 40, y1: this.gy, ttl: 6, g });
    this.cameras.main.shake(40, 0.03);
    this.burst(x, this.gy - 20, PALETTE.ember, 24, 160);
  }

  private updateFlameWalls(dt: number): void {
    for (let i = this.flameWalls.length - 1; i >= 0; i--) {
      const fw = this.flameWalls[i];
      fw.ttl -= dt;
      fw.g.clear();
      fw.g.fillStyle(PALETTE.ember, 0.35);
      fw.g.fillRect(fw.x - 10, fw.y0, 20, fw.y1 - fw.y0);
      for (let y = fw.y0; y < fw.y1; y += 14) {
        fw.g.fillStyle(Math.random() < 0.5 ? PALETTE.ember : PALETTE.gold, 0.9);
        fw.g.fillCircle(fw.x + (Math.random() * 12 - 6), y, 5);
      }
      if (Math.random() < 0.4) {
        this.burst(fw.x, fw.y1 - 10, PALETTE.ember, 1, 30);
      }
      // burn enemies passing through
      for (const m of this.monsters) {
        if (m.dead) continue;
        if (Math.abs(m.container.x - fw.x) < 18) {
          m.effects.burnT = 0.5;
          m.effects.burnDps = 30;
        }
      }
      if (fw.ttl <= 0) {
        fw.g.destroy();
        this.flameWalls.splice(i, 1);
      }
    }
  }

  // ---------------- defensive structures ----------------
  public setBuildMode(id: StructureId | null): void {
    this.buildMode = id;
    this.clearGhost();
    if (id) {
      this.ghost = createStructureVisual(this, id);
      this.ghost.setDepth(15);
      this.ghost.setAlpha(0.6);
      this.ghost.setVisible(false);
    }
    this.pushHud();
  }

  public selectBuild(id: StructureId): void {
    if (this.buildMode === id) {
      this.setBuildMode(null);
      return;
    }
    const def = structureById(id);
    if (this.run.gold < def.cost) {
      this.toast("Not enough gold!");
      return;
    }
    this.setBuildMode(id);
  }

  private clearGhost(): void {
    if (this.ghost) {
      this.ghost.destroy();
      this.ghost = null;
    }
  }

  private placeStructure(id: StructureId, lane: number, x: number): boolean {
    const def = structureById(id);
    if (this.run.gold < def.cost) {
      this.toast("Not enough gold!");
      return false;
    }
    for (const s of this.structures) {
      if (!s.dead && s.lane === lane && Math.abs(s.x - x) < 46) {
        this.toast("Too close to another structure");
        return false;
      }
    }
    this.run.gold -= def.cost;
    const visual = createStructureVisual(this, id);
    const y = this.laneY(lane);
    visual.setPosition(x, y);
    const hpBar = this.add.graphics();
    hpBar.setDepth(4);
    const s: StructureRuntime = {
      def,
      lane,
      x,
      y,
      hp: def.hp,
      maxHp: def.hp,
      cooldown: 0,
      container: visual,
      hpBar,
      dead: false
    };
    this.structures.push(s);
    this.burst(x, y - 12, def.color, 8, 80);
    this.pushHud();
    return true;
  }

  private destroyStructure(s: StructureRuntime): void {
    if (s.dead) return;
    s.dead = true;
    this.burst(s.x, s.y - 12, s.def.color, 14, 120);
    s.container.destroy();
    s.hpBar.destroy();
  }

  private drawBolt(x1: number, y1: number, x2: number, y2: number): void {
    const g = this.add.graphics();
    g.setDepth(8);
    g.lineStyle(3, 0xe8d9b0, 1);
    g.lineBetween(x1, y1, x2, y2);
    this.tweens.add({ targets: g, alpha: 0, duration: 180, onComplete: () => g.destroy() });
  }

  private drawStructureHpBar(s: StructureRuntime): void {
    const g = s.hpBar;
    g.clear();
    if (s.hp >= s.maxHp) return;
    const w = 30;
    const x = s.x - w / 2;
    const y = s.y - 40;
    g.fillStyle(0x1b1f3a, 0.7);
    g.fillRect(x - 1, y - 1, w + 2, 5);
    g.fillStyle(0x3a3f52, 1);
    g.fillRect(x, y, w, 3);
    g.fillStyle(PALETTE.gold, 1);
    g.fillRect(x, y, w * Math.max(0, s.hp / s.maxHp), 3);
  }

  private updateStructures(dt: number): void {
    for (const s of this.structures) {
      if (s.dead) continue;
      s.cooldown -= dt;

      if (s.def.id === "ballista") {
        if (s.cooldown <= 0) {
          let best: MonsterRuntime | null = null;
          let bestD = 620;
          for (const m of this.monsters) {
            if (m.dead || m.lane !== s.lane) continue;
            const d = m.x - s.x;
            if (d > 0 && d < bestD) {
              bestD = d;
              best = m;
            }
          }
          if (best) {
            s.cooldown = 2.0;
            this.drawBolt(s.x, s.y - 18, best.container.x, best.container.y - best.def.radius * 0.5);
            this.burst(best.container.x, best.container.y - best.def.radius * 0.5, 0xd9d9d9, 4, 70);
            this.damageMonster(best, 30, false, { color: 0xd9d9d9 });
          }
        }
      } else if (s.def.id === "barricade") {
        for (const m of this.monsters) {
          if (m.dead || m.lane !== s.lane) continue;
          if (Math.abs(m.x - s.x) < 34) {
            m.hp -= 15 * dt;
            if (Math.random() < 0.3) {
              this.burst(m.container.x, m.container.y - m.def.radius, 0xd9d9d9, 1, 40);
            }
            if (m.hp <= 0) this.killMonster(m);
          }
        }
      } else if (s.def.id === "frostTrap") {
        for (const m of this.monsters) {
          if (m.dead || m.lane !== s.lane) continue;
          if (Math.abs(m.x - s.x) < 44) {
            m.effects.slowT = Math.max(m.effects.slowT, 0.35);
            m.effects.slowF = 0.35;
          }
        }
      }

      this.drawStructureHpBar(s);
    }
    this.structures = this.structures.filter((s) => !s.dead);
  }

  // ---------------- wave / level end ----------------
  private onWaveClear(): void {
    this.waveActive = false;
    const perfect = this.waveWallDamage === 0;
    const bonus = perfect ? 40 + this.waveIndex * 10 : 20;
    this.run.gold += Math.round(bonus * this.stats.goldMult);
    this.run.score += perfect ? 200 : 100;
    if (perfect) {
      this.run.mana = Math.min(this.stats.manaMax, this.run.mana + 25);
    }
    this.showBanner(perfect ? "Perfect Wave!" : "Wave Cleared", perfect ? `+${Math.round(bonus * this.stats.goldMult)} gold bonus` : `+${bonus} gold`);
    this.betweenWaves = true;
    this.pendingVictory = !this.run.endless && this.waveIndex >= this.run.totalWaves;
    this.interWaveTimer = 1.6;
  }

  private advanceAfterWave(): void {
    if (this.ended) return;
    if (this.pendingVictory) {
      this.onVictory();
      return;
    }
    if (this.run.endless) {
      this.waves.shift();
      this.waves.push(generateEndlessWave(this.waveIndex + 1));
    }
    this.startWave(this.waveIndex + 1);
  }

  private onVictory(): void {
    if (this.ended) return;
    this.ended = true;
    this.idle = true;
    this.burst(this.general.bowX, this.general.bowY, PALETTE.gold, 30, 200);
    const result: LevelResult = {
      victory: true,
      level: this.run.level,
      endless: this.run.endless,
      score: this.run.score,
      gold: this.run.gold,
      wave: this.waveIndex,
      kills: this.run.kills
    };
    bus.emit("levelEnd", result);
  }

  private onDefeat(): void {
    if (this.ended) return;
    this.ended = true;
    this.idle = true;
    this.cameras.main.shake(200, 0.06);
    this.cameras.main.flash(200, 120, 20, 20);
    const result: LevelResult = {
      victory: false,
      level: this.run.level,
      endless: this.run.endless,
      score: this.run.score,
      gold: this.run.gold,
      wave: this.waveIndex,
      kills: this.run.kills
    };
    bus.emit("levelEnd", result);
  }

  // ---------------- helpers ----------------
  private unlockedArrows(): ArrowId[] {
    return unlockedArrows(this.meta.highestLevelReached);
  }

  private showBanner(title: string, sub: string): void {
    bus.emit("banner", { title, sub });
  }

  private toast(text: string): void {
    bus.emit("toast", { text });
  }

  private clearBattlefield(): void {
    for (const m of this.monsters) {
      m.container.destroy();
      m.hpBar.destroy();
      m.statusGfx.destroy();
    }
    for (const a of this.arrows) {
      a.image.destroy();
      a.trail?.destroy();
    }
    for (const fw of this.flameWalls) fw.g.destroy();
    for (const c of this.cleanup) c.p.destroy();
    for (const s of this.structures) {
      s.container.destroy();
      s.hpBar.destroy();
    }
    this.cleanup = [];
    this.monsters = [];
    this.arrows = [];
    this.flameWalls = [];
    this.stormArrows = [];
    this.structures = [];
    this.clearGhost();
    this.buildMode = null;
    for (const t of this.trajectory) t.destroy();
    this.trajectory = [];
    this.aimLine.clear();
  }

  private pushHud(): void {
    if (this.ended || this.idle) return;
    const arrows: HudArrow[] = [];
    const unlocked = this.unlockedArrows();
    const all = ["normal", "fire", "ice", "pierce", "lightning", "explosive"] as ArrowId[];
    all.forEach((id, i) => {
      const def = arrowById(id);
      arrows.push({
        id,
        name: def.name,
        key: String(i + 1),
        mana: def.manaCost,
        selected: this.run.selectedArrow === id,
        unlocked: unlocked.includes(id)
      });
    });

    const abilities: HudAbility[] = [];
    this.run.abilities.forEach((id, i) => {
      const def = abilityById(id);
      abilities.push({
        id,
        name: def.name,
        key: i === 0 ? "Q" : "E",
        remaining: this.cds[id],
        cooldown: abilityCooldown(id, this.run.perks),
        ready: this.cds[id] <= 0,
        unlocked: true
      });
    });

    const structures: HudStructure[] = STRUCTURES.map((def) => ({
      id: def.id,
      name: def.name,
      cost: def.cost,
      glyph: def.glyph,
      affordable: this.run.gold >= def.cost
    }));

    const state: HudState = {
      wallHp: Math.max(0, this.run.wallHp),
      wallMax: this.run.wallMax,
      wave: this.waveIndex,
      totalWaves: this.run.totalWaves === Infinity ? -1 : this.run.totalWaves,
      levelLabel: this.run.endless ? "ENDLESS" : levelName(this.run.level),
      score: this.run.score,
      gold: this.run.gold,
      mana: this.run.mana,
      manaMax: this.run.manaMax,
      combo: this.run.combo,
      comboMult: this.comboMult(),
      wind: this.wind,
      arrows,
      abilities,
      structures,
      buildMode: this.buildMode,
      paused: this.paused
    };
    bus.emit("hud", state);
  }
}
