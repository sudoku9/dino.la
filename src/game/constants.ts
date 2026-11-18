// Central palette (mirrored in src/style.css CSS variables).
export const PALETTE = {
  ink: 0x2b1a2e, // deep plum ink (text / outlines)
  parchment: 0xf4e3c1,
  parchmentDark: 0xd9bf94,
  gold: 0xf0b429,
  goldLight: 0xffd76a,
  ember: 0xe4572e, // fire
  emberDark: 0xb33a1c,
  ice: 0x7fd8e8,
  iceDark: 0x3f9fb0,
  leaf: 0x4c9a52,
  leafDark: 0x2f6b37,
  grass: 0x5ca358,
  stone: 0x5b6470,
  stoneLight: 0x8a93a3,
  stoneDark: 0x3d434e,
  night: 0x1b1f3a,
  skyTop: 0x2a2450,
  skyMid: 0x7a4a6e,
  skyBottom: 0xf0a04a,
  blood: 0xc62828,
  white: 0xffffff,
  shield: 0x9aa4b2,
  leather: 0x6b4a2e,
  fur: 0x8c6a46,
};

// Game tuning. Values are pixels/second unless noted.
export const TUNING = {
  // physics
  gravity: 1000,
  windMax: 150, // max horizontal wind acceleration (px/s^2)
  arrowSpeedFull: 1150, // arrow launch speed at full power
  arrowSpeedMin: 420,
  arrowRadius: 7, // collision radius

  // shooting
  shotCooldownBase: 0.42, // seconds between shots (scaled by draw speed upgrade)

  // mana
  manaMaxBase: 100,
  manaRegenBase: 11, // mana per second

  // wall
  wallMaxBase: 300,

  // crit
  critChanceBase: 0.1,
  critMultBase: 2.0,

  // combo
  comboWindow: 2.6, // seconds to keep the combo alive
  comboMaxMult: 3.0, // max combo gold/score multiplier
  comboStep: 0.1, // multiplier gained per kill

  // gold
  loseGoldKeep: 0.6, // fraction of run gold kept on defeat

  // monsters stop here to attack the gate
  gateXFactor: 0.155, // fraction of width
  groundYFactor: 0.82, // fraction of height for the ground line

  // perks / status
  freezeSlowFactor: 0.0,
  burnDuration: 3.0,
  burnDps: 12,
  slowFactor: 0.5,
  slowDuration: 2.5,

  // waves
  wavePrepSeconds: 2.0,
};

export const ARROW_COUNT = 6;
