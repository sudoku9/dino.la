import {
  ABILITIES,
  ARROWS,
  PERKS,
  REGIONS,
  STRUCTURES,
  UPGRADES,
  abilityById,
  arrowById,
  arrowUpgradeCost,
  levelName,
  perkById,
  regionForLevel,
  upgradeCost
} from "../game/data";
import type { LevelResult } from "../scenes/GameScene";
import type { MetaState } from "../game/state";
import type {
  AbilityId,
  ArrowId,
  HudState,
  PerkId,
  StructureId,
  UpgradeId
} from "../game/types";

export interface UiHandlers {
  onCampaign(): void;
  onEndless(): void;
  onArmory(): void;
  onSignIn(): void;
  onStartLevel(level: number): void;
  onBuyUpgrade(id: UpgradeId): void;
  onBuyArrow(id: ArrowId): void;
  onPickPerk(id: PerkId): void;
  onResume(): void;
  onQuit(): void;
  onRetry(): void;
  onNext(): void;
  onSelectArrow(id: ArrowId): void;
  onUseAbility(id: AbilityId): void;
  onSelectBuild(id: StructureId): void;
}

const ARROW_GLYPH: Record<ArrowId, string> = {
  normal: "\uD83C\uDFF9",
  fire: "\uD83D\uDD25",
  ice: "\u2744\uFE0F",
  pierce: "\uD83C\uDFAF",
  lightning: "\u26A1",
  explosive: "\uD83D\uDCA5"
};

const ABILITY_GLYPH: Record<AbilityId, string> = {
  arrowStorm: "\uD83C\uDF29\uFE0F",
  frostNova: "\uD83E\uDDCA",
  wallOfFlame: "\uD83D\uDD25"
};

let handlers: UiHandlers;

function hex(c: number): string {
  return "#" + c.toString(16).padStart(6, "0");
}

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const screens = [
  "screen-boot",
  "screen-menu",
  "screen-levels",
  "screen-armory",
  "screen-perks",
  "screen-gameover",
  "screen-pause"
];

export function init(h: UiHandlers): void {
  handlers = h;
  buildArrowBar();
  buildBuildBar();
  bindStaticButtons();
}

function buildBuildBar(): void {
  const bar = el("build-bar");
  bar.innerHTML = "";
  STRUCTURES.forEach((def) => {
    const b = document.createElement("button");
    b.className = "build-btn";
    b.dataset.structure = def.id;
    b.setAttribute("data-testid", "build-" + def.id);
    b.title = `${def.name} — ${def.desc}`;
    b.innerHTML = `<span class="glyph">${def.glyph}</span><span class="cost">${def.cost}</span>`;
    b.addEventListener("click", () => handlers.onSelectBuild(def.id));
    bar.appendChild(b);
  });
}

function bindStaticButtons(): void {
  el("btn-campaign").addEventListener("click", () => handlers.onCampaign());
  el("btn-endless").addEventListener("click", () => handlers.onEndless());
  el("btn-armory").addEventListener("click", () => handlers.onArmory());
  el("btn-signin").addEventListener("click", () => handlers.onSignIn());
  el("btn-levels-back").addEventListener("click", () => handlers.onQuit());
  el("btn-resume").addEventListener("click", () => handlers.onResume());
  el("btn-quit").addEventListener("click", () => handlers.onQuit());
  el("armory-back").addEventListener("click", () => handlers.onQuit());
  el("armory-continue").addEventListener("click", () => handlers.onNext());
}

function buildArrowBar(): void {
  const bar = el("arrow-bar");
  bar.innerHTML = "";
  ARROWS.forEach((def, i) => {
    const b = document.createElement("button");
    b.className = "arrow-btn";
    b.dataset.arrow = def.id;
    b.setAttribute("data-testid", "arrow-" + def.id);
    b.innerHTML = `
      <span class="key">${i + 1}</span>
      <span class="icon">${ARROW_GLYPH[def.id]}</span>
      <span class="mana-cost">${def.manaCost > 0 ? def.manaCost + "\uD83D\uDD2E" : "\u221E"}</span>
    `;
    b.addEventListener("click", () => handlers.onSelectArrow(def.id));
    bar.appendChild(b);
  });
}

let builtAbilityIds = "";

function buildAbilityBar(abilities: HudState["abilities"]): void {
  const sig = abilities.map((a) => a.id).join(",");
  if (sig === builtAbilityIds) return;
  builtAbilityIds = sig;
  const bar = el("ability-bar");
  bar.innerHTML = "";
  abilities.forEach((a) => {
    const def = abilityById(a.id);
    const b = document.createElement("button");
    b.className = "ability-btn";
    b.dataset.ability = a.id;
    b.setAttribute("data-testid", "ability-" + a.id);
    b.innerHTML = `
      <span class="key">${a.key}</span>
      <span class="icon">${ABILITY_GLYPH[a.id]}</span>
      <span class="mana-cost" style="color:${hex(def.color)}">${def.name.split(" ")[0]}</span>
    `;
    b.addEventListener("click", () => handlers.onUseAbility(a.id));
    bar.appendChild(b);
  });
}

// ---------- screen management ----------
export function showScreen(id: string): void {
  for (const s of screens) {
    el(s).classList.toggle("active", s === id);
  }
  el("hud").classList.add("hidden");
}

export function showGameplay(): void {
  for (const s of screens) el(s).classList.remove("active");
  el("hud").classList.remove("hidden");
}

export function hideHud(): void {
  el("hud").classList.add("hidden");
}

// ---------- menu ----------
export function renderMenu(meta: MetaState, signedIn: string | null, authAvailable: boolean): void {
  const stats = el("menu-stats");
  stats.innerHTML = `
    ${meta.highestLevelReached > 0 ? `Highest: <b>${levelName(Math.min(15, meta.highestLevelReached))}</b> &middot; ` : ""}
    Best score: <b>${meta.bestScore}</b> &middot; Gold: <b>\uD83D\uDD2E ${meta.gold}</b>
  `;
  const signIn = el("btn-signin");
  if (authAvailable) {
    signIn.style.display = "";
    signIn.textContent = signedIn ? `Signed in as ${signedIn}` : "Sign in";
  } else {
    signIn.style.display = "none";
  }
  showScreen("screen-menu");
}

// ---------- level select ----------
export function renderLevels(meta: MetaState): void {
  const grid = el("level-grid");
  grid.innerHTML = "";
  let lastRegion = "";
  for (let lvl = 1; lvl <= 15; lvl++) {
    const region = regionForLevel(lvl);
    if (region && region.name !== lastRegion) {
      lastRegion = region.name;
      const t = document.createElement("div");
      t.className = "region-title";
      t.textContent = "\u2694 " + region.name;
      grid.appendChild(t);
    }
    const unlocked = lvl <= meta.highestLevelReached + 1;
    const b = document.createElement("button");
    b.className = "level-btn" + (lvl === meta.highestLevelReached + 1 ? " current" : "") + (unlocked ? "" : " locked");
    b.setAttribute("data-testid", "level-" + lvl);
    b.innerHTML = `${lvl}${lvl % 4 === 0 ? '<span class="crown">\uD83D\uDC51</span>' : ""}`;
    b.disabled = !unlocked;
    b.addEventListener("click", () => unlocked && handlers.onStartLevel(lvl));
    grid.appendChild(b);
  }
  showScreen("screen-levels");
}

// ---------- armory ----------
export function renderArmory(meta: MetaState): void {
  el("armory-gold").textContent = "\uD83D\uDD2E " + meta.gold;

  const ul = el("upgrade-list");
  ul.innerHTML = "";
  UPGRADES.forEach((def) => {
    const lvl = meta.upgrades[def.id] ?? 0;
    const cost = upgradeCost(def, lvl);
    const maxed = lvl >= def.maxLevel;
    const row = document.createElement("div");
    row.className = "upgrade-row";
    row.innerHTML = `
      <div class="info">
        <div class="name">${def.name} <span style="color:var(--gold-light)">Lv ${lvl}</span></div>
        <div class="desc">${def.desc}</div>
      </div>
    `;
    const buy = document.createElement("button");
    buy.className = "btn btn-primary buy";
    buy.textContent = maxed ? "MAX" : "\uD83D\uDD2E " + cost;
    buy.disabled = maxed || meta.gold < cost;
    buy.setAttribute("data-testid", "upgrade-" + def.id);
    buy.addEventListener("click", () => handlers.onBuyUpgrade(def.id));
    row.appendChild(buy);
    ul.appendChild(row);
  });

  const al = el("arrow-upgrade-list");
  al.innerHTML = "";
  ARROWS.forEach((def) => {
    if (def.id === "normal") return;
    const lvl = meta.arrowLevels[def.id] ?? 0;
    const cost = arrowUpgradeCost(lvl);
    const unlocked = def.unlockLevel <= meta.highestLevelReached + 1;
    const row = document.createElement("div");
    row.className = "upgrade-row";
    row.innerHTML = `
      <div class="info">
        <div class="name">${ARROW_GLYPH[def.id]} ${def.name} <span style="color:var(--gold-light)">Lv ${lvl}</span></div>
        <div class="desc">${unlocked ? "+12% damage per level" : "Locked"}</div>
      </div>
    `;
    const buy = document.createElement("button");
    buy.className = "btn btn-primary buy";
    buy.textContent = unlocked ? "\uD83D\uDD2E " + cost : "\uD83D\uDD12";
    buy.disabled = !unlocked || meta.gold < cost;
    buy.setAttribute("data-testid", "arrow-up-" + def.id);
    buy.addEventListener("click", () => handlers.onBuyArrow(def.id));
    row.appendChild(buy);
    al.appendChild(row);
  });

  showScreen("screen-armory");
}

// ---------- perks ----------
export function renderPerks(perkIds: PerkId[]): void {
  const list = el("perk-list");
  list.innerHTML = "";
  perkIds.forEach((id) => {
    const def = perkById(id);
    const card = document.createElement("div");
    card.className = "perk-card";
    card.setAttribute("data-testid", "perk-" + id);
    card.innerHTML = `<div class="perk-name">${def.name}</div><div class="perk-desc">${def.desc}</div>`;
    card.addEventListener("click", () => handlers.onPickPerk(id));
    list.appendChild(card);
  });
  showScreen("screen-perks");
}

// ---------- result ----------
export function renderResult(result: LevelResult, meta: MetaState): void {
  const title = el("result-title");
  title.textContent = result.victory ? "Victory!" : "The Gate Has Fallen";
  el("result-stats").innerHTML = `
    <div class="stat"><div class="v">${result.score}</div><div class="k">Score</div></div>
    <div class="stat"><div class="v">\uD83D\uDD2E ${result.gold}</div><div class="k">Gold</div></div>
    <div class="stat"><div class="v">${result.wave}</div><div class="k">Waves Survived</div></div>
    <div class="stat"><div class="v">${result.kills}</div><div class="k">Kills</div></div>
    <div class="stat"><div class="v">${meta.highestLevelReached}</div><div class="k">Progress</div></div>
    <div class="stat"><div class="v">${meta.bestScore}</div><div class="k">Best Score</div></div>
  `;
  const actions = el("result-actions");
  actions.innerHTML = "";
  const b = document.createElement("button");
  b.className = "btn btn-primary";
  b.textContent = result.victory ? "Claim Boon \u2192" : "Retry";
  b.setAttribute("data-testid", "btn-result-primary");
  b.addEventListener("click", () => (result.victory ? handlers.onNext() : handlers.onRetry()));
  actions.appendChild(b);
  const b2 = document.createElement("button");
  b2.className = "btn";
  b2.textContent = "Menu";
  b2.setAttribute("data-testid", "btn-result-menu");
  b2.addEventListener("click", () => handlers.onQuit());
  actions.appendChild(b2);
  showScreen("screen-gameover");
}

// ---------- HUD ----------
export function updateHud(state: HudState): void {
  const wallFill = el("wall-fill");
  wallFill.style.width = Math.max(0, (state.wallHp / state.wallMax) * 100) + "%";
  el("wall-text").textContent = `${Math.round(state.wallHp)}/${state.wallMax}`;

  el("hud-wave").textContent = `WAVE ${state.wave}${state.totalWaves > 0 ? `/${state.totalWaves}` : ""}`;
  el("hud-score").textContent = `SCORE ${state.score}`;
  el("hud-gold").textContent = `\uD83D\uDD2E ${state.gold}`;
  el("hud-combo").textContent = `x${state.comboMult.toFixed(1)}`;
  const windTxt = state.wind === 0 ? "WIND 0" : `WIND ${state.wind > 0 ? "\u2192" : "\u2190"} ${Math.abs(state.wind)}`;
  el("hud-wind").textContent = windTxt;

  const mf = el("mana-fill");
  mf.style.width = Math.max(0, (state.mana / state.manaMax) * 100) + "%";
  el("mana-text").textContent = `${Math.round(state.mana)}/${state.manaMax}`;

  // arrows
  document.querySelectorAll<HTMLElement>(".arrow-btn").forEach((b) => {
    const id = b.dataset.arrow as ArrowId;
    const info = state.arrows.find((a) => a.id === id);
    if (!info) return;
    b.classList.toggle("selected", info.selected);
    b.classList.toggle("locked", !info.unlocked);
  });

  // build bar
  document.querySelectorAll<HTMLElement>(".build-btn").forEach((b) => {
    const id = b.dataset.structure as StructureId;
    const info = state.structures.find((s) => s.id === id);
    if (!info) return;
    b.classList.toggle("unaffordable", !info.affordable);
    b.classList.toggle("building", state.buildMode === id);
  });

  // abilities
  buildAbilityBar(state.abilities);
  document.querySelectorAll<HTMLElement>(".ability-btn").forEach((b) => {
    const id = b.dataset.ability as AbilityId;
    const info = state.abilities.find((a) => a.id === id);
    if (!info) return;
    b.classList.toggle("locked", !info.unlocked);
    const cd = b.querySelector(".cooldown");
    if (info.ready) {
      cd?.remove();
      b.classList.add("ready");
    } else {
      b.classList.remove("ready");
      let c = b.querySelector(".cooldown") as HTMLElement | null;
      if (!c) {
        c = document.createElement("div");
        c.className = "cooldown";
        c.innerHTML = `<div class="cd-num"></div><div class="cd-bar"><div class="cd-fill"></div></div>`;
        b.appendChild(c);
      }
      c.querySelector(".cd-num")!.textContent = Math.ceil(info.remaining) + "s";
      const fill = c.querySelector(".cd-fill") as HTMLElement;
      fill.style.width = Math.max(0, Math.min(100, (1 - info.remaining / info.cooldown) * 100)) + "%";
    }
  });
}

// ---------- transient ----------
let bannerTimer = 0;
export function showBanner(title: string, sub: string): void {
  el("banner").classList.remove("hidden");
  el("banner-title").textContent = title;
  el("banner-sub").textContent = sub;
  window.clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => el("banner").classList.add("hidden"), 1600);
}

let toastTimer = 0;
export function showToast(text: string): void {
  const t = el("toast");
  t.classList.remove("hidden");
  t.textContent = text;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.add("hidden"), 1300);
}

export { hex, ABILITIES, PERKS };
