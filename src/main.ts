import Phaser from "phaser";
import { init, type OhMyGame } from "./ohmygame/client.js";
import { GameScene, type LevelResult } from "./scenes/GameScene";
import { ARROWS, PERKS, UPGRADES, arrowUpgradeCost, upgradeCost } from "./game/data";
import { bus } from "./game/events";
import { defaultMeta, type MetaState } from "./game/state";
import { loadMeta, saveMeta, setGame, submitScore } from "./game/save";
import * as ui from "./ui/ui";
import type { ArrowId, HudState, PerkId, UpgradeId } from "./game/types";

let meta: MetaState = defaultMeta();
let campaignPerks: PerkId[] = [];
let lastResult: LevelResult | null = null;
let mode: "menu" | "levels" | "armory" | "victory" | "perks" | "defeat" | "level" = "menu";
let armoryAfter = false;
let scene: GameScene | null = null;
let gameApi: OhMyGame | null = null;

function startLevel(level: number, endless: boolean, perks: PerkId[]): void {
  if (!scene) return;
  scene.meta = meta;
  scene.startLevel(level, endless, perks);
  ui.showGameplay();
  mode = "level";
}

function renderMenu(): void {
  const player = gameApi?.auth?.player;
  ui.renderMenu(meta, player?.name ?? null, gameApi?.auth?.available ?? false);
  mode = "menu";
}

function pickPerkOptions(): PerkId[] {
  const pool = PERKS.filter((p) => !campaignPerks.includes(p.id)).map((p) => p.id);
  const out: PerkId[] = [];
  while (out.length < 3 && pool.length) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

function applyBuyUpgrade(id: UpgradeId): void {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) return;
  const lvl = meta.upgrades[id] ?? 0;
  const cost = upgradeCost(def, lvl);
  if (lvl >= def.maxLevel || meta.gold < cost) return;
  meta.gold -= cost;
  meta.upgrades[id] = lvl + 1;
  saveMeta(meta);
  ui.renderArmory(meta);
}

function applyBuyArrow(id: ArrowId): void {
  const def = ARROWS.find((a) => a.id === id);
  if (!def || def.id === "normal") return;
  const lvl = meta.arrowLevels[id] ?? 0;
  const cost = arrowUpgradeCost(lvl);
  if (meta.gold < cost) return;
  meta.gold -= cost;
  meta.arrowLevels[id] = lvl + 1;
  saveMeta(meta);
  ui.renderArmory(meta);
}

// ---------- UI handlers ----------
ui.init({
  onCampaign() {
    campaignPerks = [];
    ui.renderLevels(meta);
    mode = "levels";
  },
  onEndless() {
    campaignPerks = [];
    startLevel(Math.max(1, meta.highestLevelReached + 1), true, []);
  },
  onArmory() {
    armoryAfter = false;
    ui.renderArmory(meta);
    mode = "armory";
  },
  async onSignIn() {
    if (!gameApi?.auth?.available) return;
    try {
      await gameApi.auth.signIn();
      renderMenu();
    } catch (err) {
      console.error("sign in failed", err);
    }
  },
  onStartLevel(level: number) {
    startLevel(level, false, campaignPerks);
  },
  onBuyUpgrade(id) {
    applyBuyUpgrade(id);
  },
  onBuyArrow(id) {
    applyBuyArrow(id);
  },
  onPickPerk(id) {
    campaignPerks.push(id);
    armoryAfter = true;
    ui.renderArmory(meta);
    mode = "armory";
  },
  onResume() {
    scene?.setPaused(false);
    ui.showGameplay();
  },
  onQuit() {
    campaignPerks = [];
    scene?.setPaused(false);
    ui.hideHud();
    renderMenu();
  },
  onRetry() {
    if (!lastResult) return;
    campaignPerks = [];
    startLevel(lastResult.level, lastResult.endless, []);
  },
  onNext() {
    if (mode === "victory") {
      ui.renderPerks(pickPerkOptions());
      mode = "perks";
    } else if (mode === "armory") {
      if (armoryAfter && lastResult) {
        startLevel(lastResult.level + 1, false, campaignPerks);
      } else {
        ui.renderLevels(meta);
        mode = "levels";
      }
    }
  },
  onSelectArrow(id) {
    scene?.selectArrow(id);
  },
  onUseAbility(id) {
    scene?.useAbility(id);
  },
  onSelectBuild(id) {
    scene?.selectBuild(id);
  }
});

// ---------- bus wiring ----------
bus.on("hud", (payload) => ui.updateHud(payload as HudState));
bus.on("banner", (payload) => {
  const p = payload as { title: string; sub: string };
  ui.showBanner(p.title, p.sub);
});
bus.on("toast", (payload) => ui.showToast((payload as { text: string }).text));
bus.on("pause", (paused) => {
  if (paused) ui.showScreen("screen-pause");
  else ui.showGameplay();
});

bus.on("levelEnd", (payload) => {
  const r = payload as LevelResult;
  lastResult = r;
  if (r.victory) {
    meta.gold += r.gold;
    if (!r.endless) {
      meta.highestLevelReached = Math.max(meta.highestLevelReached, r.level);
    }
    meta.bestScore = Math.max(meta.bestScore, r.score);
  } else {
    meta.gold += Math.round(r.gold * 0.6);
    meta.bestScore = Math.max(meta.bestScore, r.score);
    if (r.endless) {
      meta.bestEndlessWave = Math.max(meta.bestEndlessWave, r.wave);
      meta.endlessBestScore = Math.max(meta.endlessBestScore, r.score);
      void submitScore("endless", r.score);
    }
    campaignPerks = [];
  }
  saveMeta(meta);
  ui.renderResult(r, meta);
  mode = r.victory ? "victory" : "defeat";
});

// ---------- boot (non-blocking) ----------
let phaserGame: Phaser.Game | null = null;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    p.then((v) => {
      clearTimeout(timer);
      resolve(v);
    }).catch(() => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

function startGame(): void {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game-container",
    width: 1280,
    height: 720,
    backgroundColor: "#1b1f3a",
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [GameScene]
  });
  phaserGame = game;

  game.events.once(Phaser.Core.Events.READY, () => {
    scene = game.scene.getScene("GameScene") as GameScene;
  });

  // Show the menu right away so the game never blocks on game services.
  renderMenu();
}

async function initSdk(): Promise<void> {
  try {
    const host = location.hostname;
    const isLocal =
      host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
    const api = await withTimeout(init(isLocal ? { allowLocalhost: true } : {}), 5000);
    if (!api) return;
    gameApi = api;
    setGame(api);

    const loaded = await withTimeout(loadMeta(), 3000);
    if (loaded) {
      meta = {
        ...defaultMeta(),
        ...loaded,
        upgrades: loaded.upgrades ?? {},
        arrowLevels: loaded.arrowLevels ?? {}
      };
    }
    renderMenu();
  } catch (err) {
    console.warn("Game services unavailable; playing locally.", err);
  }
}

async function boot(): Promise<void> {
  startGame();
  void initSdk();
}

// test-only bridge for the playtest harness (does not affect gameplay)
(globalThis as unknown as Record<string, unknown>).__OHMYGAME_PLAYTEST__ = {
  snapshot: () => ({ meta, mode, campaignPerks, sceneReady: !!scene, scene: scene?.debug() ?? null }),
  reset: async () => {
    meta = defaultMeta();
    campaignPerks = [];
    await saveMeta(meta);
    renderMenu();
    return { ok: true };
  },
  step: (ms: number) => {
    if (!scene) return { stepped: false };
    let remaining = ms;
    while (remaining > 0) {
      const d = Math.min(16, remaining);
      scene.update(0, d);
      remaining -= d;
    }
    return { stepped: true, scene: scene.debug() };
  }
};

boot();
