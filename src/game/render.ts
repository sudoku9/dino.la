import Phaser from "phaser";
import { PALETTE } from "./constants";
import type { MonsterId, StructureId } from "./types";

// ---------- color helpers ----------
function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

function shade(c: number, amt: number): number {
  const r = Math.max(0, Math.min(255, ((c >> 16) & 0xff) + amt));
  const g = Math.max(0, Math.min(255, ((c >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (c & 0xff) + amt));
  return (r << 16) | (g << 8) | b;
}

export interface SceneSize {
  w: number;
  h: number;
}

export function groundY(h: number): number {
  return Math.round(h * 0.82);
}
export function gateX(w: number): number {
  return Math.round(w * 0.155);
}

// ---------- background ----------
export function drawBackground(scene: Phaser.Scene, size: SceneSize): Phaser.GameObjects.Container {
  const { w, h } = size;
  const c = scene.add.container(0, 0);
  c.setDepth(0);
  const g = scene.add.graphics();
  const gy = groundY(h);
  const horizon = Math.round(h * 0.58);

  // sky gradient
  const bands = 48;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const col = lerpColor(PALETTE.skyTop, PALETTE.skyBottom, t);
    const y0 = Math.round((horizon * t));
    const y1 = Math.round(horizon * ((i + 1) / bands));
    g.fillStyle(col, 1);
    g.fillRect(0, y0, w, Math.max(1, y1 - y0 + 1));
  }
  // lower sky fills to horizon
  g.fillStyle(PALETTE.skyBottom, 1);
  g.fillRect(0, Math.round(horizon * ((bands - 1) / bands)), w, horizon);

  // sun
  const sunX = Math.round(w * 0.62);
  const sunY = Math.round(horizon * 0.7);
  g.fillStyle(0xffe9a8, 0.28);
  g.fillCircle(sunX, sunY, 90);
  g.fillStyle(0xffe08a, 0.5);
  g.fillCircle(sunX, sunY, 62);
  g.fillStyle(0xffd76a, 1);
  g.fillCircle(sunX, sunY, 40);

  // clouds
  g.fillStyle(0xf6d9b8, 0.35);
  const cloud = (cx: number, cy: number, s: number) => {
    g.fillCircle(cx, cy, 18 * s);
    g.fillCircle(cx + 18 * s, cy - 8 * s, 14 * s);
    g.fillCircle(cx + 34 * s, cy, 16 * s);
    g.fillCircle(cx + 16 * s, cy + 5 * s, 15 * s);
  };
  cloud(Math.round(w * 0.25), Math.round(h * 0.14), 1.0);
  cloud(Math.round(w * 0.72), Math.round(h * 0.2), 0.8);
  cloud(Math.round(w * 0.48), Math.round(h * 0.08), 0.6);

  // distant mountains
  g.fillStyle(PALETTE.night, 0.9);
  g.fillTriangle(0, horizon, Math.round(w * 0.22), Math.round(horizon * 0.62), Math.round(w * 0.44), horizon);
  g.fillTriangle(Math.round(w * 0.3), horizon, Math.round(w * 0.55), Math.round(horizon * 0.5), Math.round(w * 0.82), horizon);

  // forest band on horizon
  g.fillStyle(lerpColor(PALETTE.leafDark, PALETTE.night, 0.4), 1);
  g.fillRect(0, horizon - 8, w, 22);
  for (let x = 0; x < w; x += 26) {
    g.fillTriangle(x, horizon + 12, x + 13, horizon - 26, x + 26, horizon + 12);
  }

  // ground
  const g0 = Math.round(h * 0.56);
  const gg = scene.add.graphics();
  const gbands = 20;
  for (let i = 0; i < gbands; i++) {
    const t = i / (gbands - 1);
    const col = lerpColor(lerpColor(PALETTE.leaf, PALETTE.grass, 0.4), PALETTE.leafDark, t * t);
    gg.fillStyle(col, 1);
    const y0 = Math.round(g0 + ((gy - g0) * i) / gbands);
    const y1 = Math.round(g0 + ((gy - g0) * (i + 1)) / gbands);
    gg.fillRect(0, y0, w, Math.max(1, y1 - y0 + 1));
  }
  // path where monsters walk
  gg.fillStyle(lerpColor(PALETTE.leafDark, PALETTE.leather, 0.25), 0.55);
  gg.fillRect(0, gy - 14, w, 26);
  // grass tufts
  for (let x = 20; x < w - 20; x += 34) {
    const yy = gy - 6 - ((x * 7) % 14);
    gg.fillStyle(PALETTE.leafDark, 0.8);
    gg.fillTriangle(x, yy + 8, x + 4, yy - 6, x + 8, yy + 8);
  }

  c.add(g);
  c.add(gg);
  return c;
}

// ---------- castle (left wall + gate + banners) ----------
export function drawCastle(scene: Phaser.Scene, size: SceneSize): Phaser.GameObjects.Container {
  const { w, h } = size;
  const c = scene.add.container(0, 0);
  c.setDepth(1);
  const g = scene.add.graphics();
  const gy = groundY(h);
  const wallTop = gy - Math.round(h * 0.3);
  const wallRight = gateX(w) + 40;

  // wall body
  g.fillStyle(PALETTE.stone, 1);
  g.fillRect(0, wallTop, wallRight, gy - wallTop);
  // stone texture lines
  g.lineStyle(1, shade(PALETTE.stone, -30), 0.5);
  const rowH = Math.round((gy - wallTop) / 7);
  for (let i = 1; i < 7; i++) {
    const yy = wallTop + rowH * i;
    g.lineBetween(0, yy, wallRight, yy);
  }
  for (let xx = 0; xx < wallRight; xx += 34) {
    g.lineBetween(xx, wallTop, xx, gy);
  }
  // battlements
  g.fillStyle(PALETTE.stoneLight, 1);
  for (let x = 0; x < wallRight; x += 34) {
    g.fillRect(x, wallTop - 16, 22, 16);
  }
  g.fillStyle(shade(PALETTE.stoneLight, -20), 1);
  g.fillRect(0, wallTop - 4, wallRight, 4);

  // gate
  const gw = Math.round(wallRight * 0.34);
  const gx = Math.round(wallRight - gw - 6);
  g.fillStyle(PALETTE.leather, 1);
  g.fillRect(gx, gy - Math.round(h * 0.16), gw, Math.round(h * 0.16));
  g.fillStyle(shade(PALETTE.leather, -25), 1);
  g.lineStyle(2, shade(PALETTE.leather, -40), 1);
  for (let i = 0; i < 4; i++) {
    const bx = gx + 6 + i * (gw / 4);
    g.lineBetween(bx, gy - Math.round(h * 0.16), bx, gy);
  }
  g.lineStyle(0, 0, 0);
  // iron bands
  g.fillStyle(PALETTE.stoneDark, 1);
  g.fillRect(gx, gy - Math.round(h * 0.05), gw, 6);
  g.fillRect(gx, gy - Math.round(h * 0.11), gw, 6);

  // banner
  const bannerX = 26;
  g.fillStyle(PALETTE.stoneDark, 1);
  g.fillRect(bannerX - 3, wallTop - 34, 6, 40);
  g.fillStyle(PALETTE.ember, 1);
  g.fillTriangle(bannerX + 3, wallTop - 34, bannerX + 3, wallTop - 8, bannerX + 40, wallTop - 21);
  g.fillStyle(PALETTE.gold, 1);
  g.fillCircle(bannerX + 14, wallTop - 21, 6);

  c.add(g);
  return c;
}

// ---------- the general (static, facing right) ----------
export interface GeneralParts {
  container: Phaser.GameObjects.Container;
  bow: Phaser.GameObjects.Graphics;
  bowX: number;
  bowY: number;
}

export function drawGeneral(
  scene: Phaser.Scene,
  x: number,
  feetY: number,
  scale: number
): GeneralParts {
  const c = scene.add.container(x, feetY);
  c.setDepth(2);
  const g = scene.add.graphics();
  const s = scale;

  // cape
  g.fillStyle(0x8f2f3a, 1);
  g.fillPoints(
    [
      { x: -4 * s, y: -86 * s },
      { x: -26 * s, y: -40 * s },
      { x: -34 * s, y: -8 * s },
      { x: -6 * s, y: -30 * s }
    ],
    true
  );

  // legs
  g.fillStyle(PALETTE.stoneDark, 1);
  g.fillRect(-8 * s, -30 * s, 7 * s, 30 * s);
  g.fillRect(2 * s, -30 * s, 7 * s, 30 * s);
  // boots
  g.fillStyle(PALETTE.leather, 1);
  g.fillRect(-10 * s, -6 * s, 11 * s, 6 * s);
  g.fillRect(0 * s, -6 * s, 11 * s, 6 * s);

  // torso (armor)
  g.fillStyle(PALETTE.stoneLight, 1);
  g.fillEllipse(0, -58 * s, 30 * s, 40 * s);
  g.fillStyle(PALETTE.gold, 1);
  g.fillRect(-6 * s, -70 * s, 12 * s, 8 * s);
  // belt
  g.fillStyle(PALETTE.leather, 1);
  g.fillRect(-11 * s, -46 * s, 22 * s, 5 * s);

  // head
  g.fillStyle(0xe8c39a, 1);
  g.fillCircle(6 * s, -86 * s, 10 * s);
  // helmet
  g.fillStyle(PALETTE.stoneLight, 1);
  g.fillEllipse(6 * s, -90 * s, 22 * s, 12 * s);
  // plume
  g.fillStyle(PALETTE.ember, 1);
  g.fillTriangle(8 * s, -96 * s, 16 * s, -108 * s, 12 * s, -90 * s);
  // eye
  g.fillStyle(PALETTE.ink, 1);
  g.fillCircle(11 * s, -86 * s, 1.8 * s);

  // back arm (holding bow)
  g.fillStyle(PALETTE.stoneLight, 1);
  g.fillRect(2 * s, -70 * s, 22 * s, 6 * s);

  const bow = scene.add.graphics();
  bow.setPosition(22 * s, -66 * s);
  bow.lineStyle(3 * s, PALETTE.leather, 1);
  bow.arc(0, 0, 16 * s, Phaser.Math.DegToRad(-70), Phaser.Math.DegToRad(70));
  bow.lineStyle(1 * s, 0xe8d9b0, 1);
  bow.lineBetween(16 * s * Math.cos(Phaser.Math.DegToRad(70)), -16 * s * Math.sin(Phaser.Math.DegToRad(70)), 16 * s * Math.cos(Phaser.Math.DegToRad(-70)), -16 * s * Math.sin(Phaser.Math.DegToRad(-70)));

  c.add(g);
  c.add(bow);

  return {
    container: c,
    bow,
    bowX: x + 22 * s,
    bowY: feetY - 66 * s
  };
}

// ---------- monsters ----------
export interface MonsterParts {
  wingL?: Phaser.GameObjects.Graphics;
  wingR?: Phaser.GameObjects.Graphics;
  staffGlow?: Phaser.GameObjects.Graphics;
  eyes?: Phaser.GameObjects.Graphics;
}

export interface MonsterVisual {
  container: Phaser.GameObjects.Container;
  parts: MonsterParts;
}

function roundRect(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  g.fillRoundedRect(x, y, w, h, r);
}

export function createMonsterVisual(
  scene: Phaser.Scene,
  id: MonsterId,
  seed: number
): MonsterVisual {
  const c = scene.add.container(0, 0);
  c.setDepth(3);
  const g = scene.add.graphics();
  const parts: MonsterParts = {};
  const rnd = (a: number, b: number) => a + ((seed * 2654435761 + a * 97) % 1000) / 1000 * (b - a);

  switch (id) {
    case "grunt": {
      const green = PALETTE.leaf;
      // legs
      g.fillStyle(shade(green, -30), 1);
      g.fillRect(-8, 0, 6, 14);
      g.fillRect(2, 0, 6, 14);
      // body
      g.fillStyle(green, 1);
      g.fillEllipse(0, -16, 26, 22);
      // arms
      g.fillStyle(shade(green, -15), 1);
      g.fillRect(-14, -22, 6, 12);
      g.fillRect(8, -22, 6, 12);
      // club
      g.fillStyle(PALETTE.leather, 1);
      g.fillRect(-22, -26, 6, 18);
      g.fillRect(-26, -30, 14, 8);
      // head
      g.fillStyle(green, 1);
      g.fillCircle(-14, -34, 12);
      // ears
      g.fillStyle(green, 1);
      g.fillTriangle(-20, -44, -24, -34, -14, -38);
      g.fillTriangle(-8, -44, -4, -34, -14, -38);
      // eyes
      parts.eyes = scene.add.graphics();
      parts.eyes.fillStyle(0xffe14a, 1);
      parts.eyes.fillCircle(-18, -36, 3);
      parts.eyes.fillCircle(-11, -36, 3);
      parts.eyes.fillStyle(0x1a1a1a, 1);
      parts.eyes.fillCircle(-18, -36, 1.4);
      parts.eyes.fillCircle(-11, -36, 1.4);
      c.add(parts.eyes);
      // mouth
      g.fillStyle(shade(green, -45), 1);
      g.fillRect(-20, -29, 8, 2);
      break;
    }
    case "runner": {
      const fur = PALETTE.fur;
      // legs (4)
      g.fillStyle(shade(fur, -30), 1);
      g.fillRect(-14, 0, 5, 12);
      g.fillRect(-4, 0, 5, 12);
      g.fillRect(6, 0, 5, 12);
      g.fillRect(14, 0, 5, 12);
      // body
      g.fillStyle(fur, 1);
      g.fillEllipse(0, -16, 40, 18);
      // tail
      g.fillStyle(fur, 1);
      g.fillTriangle(20, -22, 34, -30, 22, -12);
      // head
      g.fillStyle(fur, 1);
      g.fillCircle(-20, -24, 10);
      // snout
      g.fillStyle(shade(fur, 10), 1);
      g.fillEllipse(-26, -21, 10, 7);
      // ears
      g.fillStyle(shade(fur, -20), 1);
      g.fillTriangle(-16, -34, -13, -26, -22, -27);
      // eyes
      parts.eyes = scene.add.graphics();
      parts.eyes.fillStyle(0xff5a3a, 1);
      parts.eyes.fillCircle(-22, -26, 2.4);
      c.add(parts.eyes);
      break;
    }
    case "brute": {
      const brown = 0x7a5c3e;
      // legs
      g.fillStyle(shade(brown, -30), 1);
      g.fillRect(-14, 0, 10, 18);
      g.fillRect(4, 0, 10, 18);
      // body (bulky)
      g.fillStyle(brown, 1);
      g.fillEllipse(0, -30, 44, 40);
      // armor plate
      g.fillStyle(PALETTE.stoneDark, 1);
      g.fillEllipse(0, -28, 30, 20);
      // arms
      g.fillStyle(brown, 1);
      g.fillEllipse(-20, -26, 12, 22);
      g.fillEllipse(18, -26, 12, 22);
      // spiked club
      g.fillStyle(PALETTE.leather, 1);
      g.fillRect(-30, -44, 8, 22);
      g.fillStyle(PALETTE.stoneDark, 1);
      g.fillCircle(-26, -48, 10);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.fillTriangle(
          -26 + Math.cos(a) * 10,
          -48 + Math.sin(a) * 10,
          -26 + Math.cos(a) * 18,
          -48 + Math.sin(a) * 18,
          -26 + Math.cos(a + 0.4) * 10,
          -48 + Math.sin(a + 0.4) * 10
        );
      }
      // head (small)
      g.fillStyle(brown, 1);
      g.fillCircle(4, -56, 12);
      // eyes
      parts.eyes = scene.add.graphics();
      parts.eyes.fillStyle(0xffe14a, 1);
      parts.eyes.fillCircle(0, -58, 2.6);
      parts.eyes.fillCircle(8, -58, 2.6);
      c.add(parts.eyes);
      // tusks
      g.fillStyle(0xf4e3c1, 1);
      g.fillTriangle(-2, -50, -4, -44, 0, -50);
      g.fillTriangle(6, -50, 8, -44, 10, -50);
      break;
    }
    case "shield": {
      const armor = PALETTE.stoneLight;
      // legs
      g.fillStyle(shade(armor, -40), 1);
      g.fillRect(-6, 0, 6, 12);
      g.fillRect(4, 0, 6, 12);
      // body
      g.fillStyle(armor, 1);
      g.fillEllipse(0, -18, 24, 22);
      // head + helmet
      g.fillStyle(armor, 1);
      g.fillCircle(-4, -34, 10);
      g.fillStyle(PALETTE.gold, 1);
      g.fillRect(-12, -38, 16, 4);
      parts.eyes = scene.add.graphics();
      parts.eyes.fillStyle(0x1a1a1a, 1);
      parts.eyes.fillRect(-8, -34, 3, 2);
      c.add(parts.eyes);
      // shield (front, big, faces left)
      g.fillStyle(PALETTE.shield, 1);
      g.fillEllipse(-16, -18, 22, 30);
      g.fillStyle(PALETTE.gold, 1);
      g.fillEllipse(-16, -18, 12, 18);
      g.fillStyle(shade(PALETTE.shield, -25), 1);
      g.fillCircle(-16, -18, 5);
      // sword
      g.fillStyle(PALETTE.stoneDark, 1);
      g.fillRect(8, -26, 4, 18);
      g.fillStyle(PALETTE.parchment, 1);
      g.fillRect(6, -30, 8, 5);
      break;
    }
    case "sapper": {
      const green = 0x8a6a3e;
      // legs
      g.fillStyle(shade(green, -30), 1);
      g.fillRect(-8, 0, 6, 12);
      g.fillRect(2, 0, 6, 12);
      // body
      g.fillStyle(green, 1);
      g.fillEllipse(0, -14, 22, 20);
      // head
      g.fillStyle(green, 1);
      g.fillCircle(-8, -30, 11);
      parts.eyes = scene.add.graphics();
      parts.eyes.fillStyle(0xffe14a, 1);
      parts.eyes.fillCircle(-11, -31, 2.6);
      parts.eyes.fillCircle(-5, -31, 2.6);
      c.add(parts.eyes);
      // bomb carried in front
      g.fillStyle(0x23242e, 1);
      g.fillCircle(-20, -14, 12);
      g.fillStyle(PALETTE.ember, 1);
      g.fillRect(-22, -30, 4, 6);
      g.fillStyle(PALETTE.gold, 1);
      g.fillCircle(-20, -32, 3);
      g.fillStyle(shade(green, -40), 1);
      g.fillRect(-18, -6, 16, 6);
      break;
    }
    case "flyer": {
      const body = 0x5b4a8a;
      // body
      g.fillStyle(body, 1);
      g.fillEllipse(0, 0, 26, 20);
      // head
      g.fillStyle(body, 1);
      g.fillCircle(-14, -10, 11);
      // ears
      g.fillStyle(body, 1);
      g.fillTriangle(-20, -20, -24, -10, -14, -14);
      g.fillTriangle(-8, -20, -4, -10, -14, -14);
      // fangs
      g.fillStyle(0xf4e3c1, 1);
      g.fillTriangle(-20, -4, -18, -2, -16, -4);
      g.fillTriangle(-14, -4, -12, -2, -10, -4);
      // eyes
      parts.eyes = scene.add.graphics();
      parts.eyes.fillStyle(0xff3a3a, 1);
      parts.eyes.fillCircle(-17, -12, 2.6);
      parts.eyes.fillCircle(-10, -12, 2.6);
      c.add(parts.eyes);
      // wings (flapping)
      parts.wingL = scene.add.graphics();
      parts.wingL.setPosition(-4, -14);
      parts.wingL.fillStyle(shade(body, 25), 1);
      parts.wingL.fillTriangle(0, 0, -16, -30, -4, -4);
      parts.wingL.fillTriangle(0, 0, -8, -34, 2, -4);
      c.add(parts.wingL);
      parts.wingR = scene.add.graphics();
      parts.wingR.setPosition(4, -12);
      parts.wingR.fillStyle(shade(body, 15), 1);
      parts.wingR.fillTriangle(0, 0, 14, -26, 4, -3);
      c.add(parts.wingR);
      break;
    }
    case "healer": {
      const robe = 0xd8c46a;
      // body (robe)
      g.fillStyle(robe, 1);
      g.fillTriangle(-12, -2, 12, -2, 0, -34);
      g.fillEllipse(0, -28, 22, 18);
      // hood
      g.fillStyle(shade(robe, -15), 1);
      g.fillCircle(-2, -40, 12);
      g.fillStyle(shade(robe, -35), 1);
      g.fillCircle(-2, -42, 6);
      parts.eyes = scene.add.graphics();
      parts.eyes.fillStyle(0x7fd8e8, 1);
      parts.eyes.fillCircle(-5, -40, 2);
      parts.eyes.fillCircle(1, -40, 2);
      c.add(parts.eyes);
      // staff
      g.fillStyle(PALETTE.leather, 1);
      g.fillRect(12, -40, 3, 40);
      parts.staffGlow = scene.add.graphics();
      parts.staffGlow.fillStyle(PALETTE.gold, 1);
      parts.staffGlow.fillCircle(13.5, -42, 6);
      parts.staffGlow.fillStyle(0xffffff, 1);
      parts.staffGlow.fillCircle(13.5, -42, 2.5);
      c.add(parts.staffGlow);
      break;
    }
    case "boss": {
      const red = 0x7b2d3b;
      // legs
      g.fillStyle(shade(red, -30), 1);
      g.fillRect(-20, 0, 14, 24);
      g.fillRect(6, 0, 14, 24);
      // body
      g.fillStyle(red, 1);
      g.fillEllipse(0, -46, 60, 56);
      // armor
      g.fillStyle(PALETTE.stoneDark, 1);
      g.fillEllipse(0, -44, 44, 28);
      // arms
      g.fillStyle(red, 1);
      g.fillEllipse(-30, -40, 16, 30);
      g.fillEllipse(30, -40, 16, 30);
      // giant axe
      g.fillStyle(PALETTE.stoneDark, 1);
      g.fillRect(28, -86, 8, 50);
      g.fillStyle(PALETTE.shield, 1);
      g.fillEllipse(32, -92, 30, 18);
      // head
      g.fillStyle(red, 1);
      g.fillCircle(0, -80, 20);
      // horns
      g.fillStyle(0xf4e3c1, 1);
      g.fillTriangle(-8, -98, -18, -120, -2, -92);
      g.fillTriangle(8, -98, 18, -120, 2, -92);
      // eyes
      parts.eyes = scene.add.graphics();
      parts.eyes.fillStyle(0xffe14a, 1);
      parts.eyes.fillCircle(-7, -82, 4);
      parts.eyes.fillCircle(7, -82, 4);
      parts.eyes.fillStyle(0x1a1a1a, 1);
      parts.eyes.fillCircle(-7, -82, 1.8);
      parts.eyes.fillCircle(7, -82, 1.8);
      c.add(parts.eyes);
      // crown
      g.fillStyle(PALETTE.gold, 1);
      g.fillTriangle(-12, -96, -8, -108, -4, -96);
      g.fillTriangle(-5, -96, 0, -110, 5, -96);
      g.fillTriangle(4, -96, 8, -108, 12, -96);
      break;
    }
  }

  c.add(g);
  // slight per-instance tint variation
  if (seed % 3 === 1) c.setAlpha(0.96);
  return { container: c, parts };
}

// ground a monster container at its base (feet) y
export function placeMonster(
  visual: MonsterVisual,
  x: number,
  y: number
): void {
  visual.container.setPosition(x, y);
}

// ---------- defensive structures ----------
export function createStructureVisual(
  scene: Phaser.Scene,
  id: StructureId
): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0);
  c.setDepth(3);
  const g = scene.add.graphics();

  if (id === "barricade") {
    // wooden log base
    g.fillStyle(0x6b4a2e, 1);
    g.fillRoundedRect(-26, -10, 52, 10, 3);
    g.fillStyle(0x8a6038, 1);
    g.fillRoundedRect(-24, -12, 48, 6, 2);
    // spikes pointing right (toward enemies)
    for (let i = 0; i < 4; i++) {
      const sx = -18 + i * 13;
      g.fillStyle(i % 2 === 0 ? 0xb9c0ca : 0x8a93a3, 1);
      g.fillTriangle(sx, -10, sx + 13, -10, sx + 6, -26);
    }
  } else if (id === "ballista") {
    // base
    g.fillStyle(0x5b6470, 1);
    g.fillRoundedRect(-16, -6, 32, 8, 2);
    g.fillStyle(0x3d434e, 1);
    g.fillRoundedRect(-12, -14, 8, 10, 2);
    // bow arms
    g.lineStyle(3, 0x6b4a2e, 1);
    g.arc(0, -12, 12, Phaser.Math.DegToRad(-120), Phaser.Math.DegToRad(120));
    g.lineStyle(1, 0xe8d9b0, 1);
    g.lineBetween(-12 * Math.cos(Phaser.Math.DegToRad(30)), -12 - 12 * Math.sin(Phaser.Math.DegToRad(30)), 12 * Math.cos(Phaser.Math.DegToRad(30)), -12 - 12 * Math.sin(Phaser.Math.DegToRad(30)));
    // bolt
    g.lineStyle(3, 0x8a6038, 1);
    g.lineBetween(0, -12, 18, -12);
    g.fillStyle(0xd9d9d9, 1);
    g.fillTriangle(18, -15, 18, -9, 24, -12);
  } else {
    // frost trap: ice crystal cluster
    g.fillStyle(0x9be7ff, 0.5);
    g.fillEllipse(0, -2, 44, 14);
    g.fillStyle(0x7fd8e8, 1);
    g.fillTriangle(-16, -2, -6, -2, -11, -26);
    g.fillTriangle(-4, -2, 8, -2, 2, -32);
    g.fillTriangle(8, -2, 20, -2, 14, -22);
    g.fillStyle(0xe8fbff, 1);
    g.fillTriangle(-11, -20, -8, -12, -5, -20);
    g.fillTriangle(2, -26, 5, -18, 8, -26);
  }

  c.add(g);
  return c;
}
