const W = 800;
const H = 600;
const WATER_Y = 176;
const DOCK_Y = 150;

const PAL = {
  y: '#ffd23f', b: '#2074d5', r: '#ef4056',
  w: '#f7f3e8', dim: '#9fb3c8', ink: '#0a1626', wood: '#a9713d',
};

const SPECIES = [
  ['Sardina', 0, 15, '#9fd8df', 0.55, 60, 30],
  ['Mojarra', 40, 25, '#ffd166', 0.7, 65, 22],
  ['Cirujano', 90, 35, '#48cae4', 0.8, 75, 14],
  ['Pargo', 150, 55, '#e76f51', 1, 80, 10],
  ['Pez globo', 220, 75, '#c77dff', 0.95, 60, 7],
  ['Dorado', 280, 100, '#ffd23f', 1.25, 100, 6],
  ['Pez espada', 360, 140, '#8ecae6', 1.6, 115, 4],
  ['Anguila', 430, 180, '#95d5b2', 1.7, 85, 3],
  ['Pez linterna', 600, 300, '#ff6b6b', 1.3, 65, 3.2],
  ['Manta dorada', 720, 450, '#ffd700', 1.9, 75, 2.2],
];

const ZONES = [
  [0, 'ARRECIFE', PAL.y], [150, 'CORAL OSCURO', '#ff8c61'],
  [300, 'ZONA CREPUSCULAR', '#b88cff'], [500, 'ABISMO ELÉCTRICO', '#63f2d0'],
  [700, 'FOSA DORADA', '#ffd700'],
];
const BOSS_D = 820;

const UPGRADES = {
  d: { n: 'LÍNEA PROFUNDA', d: 'Más fondo y resistencia', c: [30, 70, 150], m: [360, 520, 700, 900] },
  l: { n: 'CEBO DE LUJO', d: 'Atrae peces más raros', c: [40, 90, 190] },
  c: { n: 'MANOS FRÍAS', d: 'Capturas más fáciles', c: [40, 90, 190] },
};

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const KEY_SCORES = 'hook-26-scores';
const KEY_REC = 'hook-26-records';
const C = Phaser.Math.Clamp, B = Phaser.Math.Between;
const SQ = 'square', SW = 'sawtooth', TL = 'triangle', SI = 'sine';
const EO = 'Cubic.easeOut', EI = 'Cubic.easeIn', SB = 'Sine.easeInOut', BO = 'Back.easeOut', SO = 'Sine.easeOut', QI = 'Quad.easeIn';
const CN = [523, 659, 784, 1047];

// DO NOT replace existing keys — they match the physical arcade cabinet wiring.
// To add local testing shortcuts, append extra keys to any array.
const CABINET_KEYS = {
  P1_U: ['w'],
  P1_D: ['s'],
  P1_L: ['a'],
  P1_R: ['d'],
  P1_1: ['u'],
  P1_2: ['i'],
  P1_3: ['o'],
  P1_4: ['j'],
  P1_5: ['k'],
  P1_6: ['l'],
  P2_U: ['ArrowUp'],
  P2_D: ['ArrowDown'],
  P2_L: ['ArrowLeft'],
  P2_R: ['ArrowRight'],
  P2_1: ['r'],
  P2_2: ['t'],
  P2_3: ['y'],
  P2_4: ['f'],
  P2_5: ['g'],
  P2_6: ['h'],
  START1: ['Enter'],
  START2: ['2'],
};

const KEYBOARD_TO_ARCADE = {};
for (const [arcadeCode, keys] of Object.entries(CABINET_KEYS)) {
  for (const key of keys) {
    KEYBOARD_TO_ARCADE[normalizeIncomingKey(key)] = arcadeCode;
  }
}

const config = {
  type: Phaser.AUTO,
  width: W,
  height: H,
  parent: 'game-root',
  backgroundColor: '#0a1626',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: W,
    height: H,
  },
  scene: { create, update },
};

new Phaser.Game(config);

function create() {
  const s = this;
  s.state = {
    phase: 'menu', t: 0, paused: false,
    coins: 0, casts: 5, runMax: 0, best: null, catches: 0, combo: 0,
    up: { d: 0, l: 0, c: 0 },
    scores: [], records: { d: 0, l: 0 },
    hook: { x: 250, y: WATER_Y + 40, depth: 0 },
    fish: [], jellies: [], eels: [],
    crab: null, crabCd: 8, crabWarn: 0,
    spawnT: 0.4, jellyT: 2, eelT: 3, invuln: 0, lineHp: 2, stun: 0,
    cast: null, bite: null, mg: null, cut: false,
    newRecShown: false, poseTimer: 0, zmax: -1, bossT: 0,
    shop: { i: 0 }, entry: null,
    blinkT: 2, blink: 0,
  };

  buildTextures(s);
  buildBackground(s);
  buildWater(s);
  buildDock(s);
  buildMacaw(s);
  buildLine(s);
  buildDepthMap(s);
  buildHud(s);
  buildMenu(s);
  buildShop(s);
  buildMinigameUi(s);
  buildGameOver(s);
  buildPause(s);
  createControls(s);

  s.lineG.setDepth(6);
  loadAll(s);
  showMenu(s, true);
}

function update(time, delta) {
  const s = this;
  const st = s.state;
  if (!st) return;
  const dt = st.paused ? 0 : Math.min(delta, 50) / 1000;
  st.t += dt;

  macawTick(s, dt);
  waterTick(s, dt);
  hookTick(s, dt);

  if (st.paused) {
    if (once(s, ['START1', 'START2'])) togglePause(s);
    return;
  }

  switch (st.phase) {
    case 'menu':
      if (once(s, ['START1', 'START2', 'P1_1', 'P2_1'])) {
        sfx(s, 'select');
        startMusic(s);
        showMenu(s, false);
        toDock(s, true);
      }
      break;
    case 'dock':
      dockUpdate(s);
      break;
    case 'cast':
      castUpdate(s, dt);
      break;
    case 'sink':
      sinkUpdate(s, dt);
      if (once(s, ['START1', 'START2'])) togglePause(s);
      break;
    case 'bite':
      biteUpdate(s, dt);
      break;
    case 'boss':
      bossUpdate(s, dt);
      if (once(s, ['START1', 'START2'])) togglePause(s);
      break;
    case 'mg':
      mgUpdate(s, dt);
      if (once(s, ['START1', 'START2'])) togglePause(s);
      break;
    case 'shop':
      shopUpdate(s, dt);
      break;
    case 'over':
      overUpdate(s);
      break;
  }
}

function createControls(scene) {
  scene.controls = { held: Object.create(null), pressed: Object.create(null) };

  const onKeyDown = (event) => {
    const key = normalizeIncomingKey(event.key);
    if (!key) return;
    const arcadeCode = KEYBOARD_TO_ARCADE[key];
    if (!arcadeCode) return;
    if (!scene.controls.held[arcadeCode]) {
      scene.controls.pressed[arcadeCode] = true;
    }
    scene.controls.held[arcadeCode] = true;
  };

  const onKeyUp = (event) => {
    const key = normalizeIncomingKey(event.key);
    if (!key) return;
    const arcadeCode = KEYBOARD_TO_ARCADE[key];
    if (!arcadeCode) return;
    scene.controls.held[arcadeCode] = false;
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  scene.events.once('shutdown', () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  });
}

function normalizeIncomingKey(key) {
  if (typeof key !== 'string' || key.length === 0) return '';
  if (key === ' ') return 'space';
  return key.toLowerCase();
}

function isHeld(s, code) {
  return s.controls.held[code] === true;
}

function once(s, codes) {
  for (const code of codes) {
    if (s.controls.pressed[code]) {
      s.controls.pressed[code] = false;
      return true;
    }
  }
  return false;
}

function axisX(s) {
  let ax = 0;
  if (isHeld(s, 'P1_L') || isHeld(s, 'P2_L')) ax -= 1;
  if (isHeld(s, 'P1_R') || isHeld(s, 'P2_R')) ax += 1;
  return ax;
}

function axisY(s) {
  let ay = 0;
  if (isHeld(s, 'P1_U') || isHeld(s, 'P2_U')) ay -= 1;
  if (isHeld(s, 'P1_D') || isHeld(s, 'P2_D')) ay += 1;
  return ay;
}

function getStorage() {
  if (window.platanusArcadeStorage) return window.platanusArcadeStorage;
  return {
    async get(key) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw === null ? { found: false, value: null } : { found: true, value: JSON.parse(raw) };
      } catch { return { found: false, value: null }; }
    },
    async set(key, value) {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
  };
}

async function storageGet(key) { return getStorage().get(key); }
async function storageSet(key, value) { return getStorage().set(key, value); }

async function loadAll(s) {
  try {
    const r = await storageGet(KEY_REC);
    if (r.found && r.value && typeof r.value === 'object') {
      s.state.records = {
        d: typeof r.value.d === 'number' ? r.value.d : 0,
        l: typeof r.value.l === 'number' ? r.value.l : 0,
      };
    }
  } catch {}
  try {
    const r = await storageGet(KEY_SCORES);
    if (r.found && Array.isArray(r.value)) {
      s.state.scores = r.value.filter((e) => e && typeof e.n === 'string' && typeof e.s === 'number').slice(0, 5);
    }
  } catch {}
  refreshTexts(s);
  s.hud.recT.setText('RÉCORD ' + s.state.records.d + ' m');
}

function saveRecords(s) {
  storageSet(KEY_REC, s.state.records).catch(() => {});
}

function T(s, x, y, str, size, color, origin) {
  return s.add.text(x, y, str, {
    fontFamily: 'monospace', fontSize: size + 'px', color, fontStyle: 'bold',
  }).setOrigin(origin === undefined ? 0.5 : origin);
}

function makeGrad(s, key, w, h, stops) {
  if (s.textures.exists(key)) s.textures.remove(key);
  const tex = s.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  for (const [p, c] of stops) g.addColorStop(p, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  tex.refresh();
}

function texFromGraphics(s, key, w, h, draw) {
  if (s.textures.exists(key)) s.textures.remove(key);
  const g = s.make.graphics({ add: false });
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function tintOf(str) {
  return parseInt(str.slice(1), 16);
}
const TY = tintOf(PAL.y), TR = tintOf(PAL.r), TB = tintOf(PAL.b);

function buildTextures(s) {
  texFromGraphics(s, 'fishT', 48, 24, (g) => {
    g.fillStyle(0xffffff);
    g.fillEllipse(22, 12, 34, 16);
    g.fillTriangle(36, 4, 47, 12, 36, 20);
    g.fillTriangle(15, 4, 22, 0, 26, 4);
  });
  texFromGraphics(s, 'fishEye', 8, 8, (g) => {
    g.fillStyle(0xffffff);
    g.fillCircle(4, 4, 4);
    g.fillStyle(0x14202e);
    g.fillCircle(5, 4, 2);
  });
  texFromGraphics(s, 'hookT', 18, 28, (g) => {
    g.lineStyle(2.5, 0xe8ecef, 1);
    g.beginPath();
    g.moveTo(9, 0);
    g.lineTo(9, 17);
    g.arc(6, 17, 6, 0, Math.PI, false);
    g.strokePath();
    g.fillStyle(0xe8ecef);
    g.fillTriangle(9, 0, 5, 4, 9, 6);
  });
  texFromGraphics(s, 'coin', 14, 14, (g) => {
    g.fillStyle(TY);
    g.fillCircle(7, 7, 6.5);
    g.fillStyle(0xdf9c11);
    g.fillCircle(7, 7, 3.5);
  });
  texFromGraphics(s, 'wing', 46, 92, (g) => {
    g.fillStyle(TY);
    g.fillEllipse(23, 14, 24, 28);
    g.fillStyle(TB);
    g.fillEllipse(23, 38, 19, 26);
    g.fillEllipse(12, 42, 12, 24);
    g.fillEllipse(34, 42, 12, 24);
    g.fillStyle(TR);
    g.fillEllipse(23, 64, 15, 24);
    g.fillEllipse(14, 72, 9, 18);
    g.fillEllipse(32, 72, 9, 18);
  });
  texFromGraphics(s, 'feather', 14, 64, (g) => {
    g.fillStyle(0xffffff);
    g.fillEllipse(7, 32, 13, 62);
  });
  texFromGraphics(s, 'beak', 36, 24, (g) => {
    g.fillStyle(0xd9772f);
    g.fillTriangle(2, 4, 34, 11, 4, 15);
    g.fillStyle(0x30201a);
    g.fillTriangle(4, 14, 22, 15, 12, 22);
  });
  texFromGraphics(s, 'crest', 14, 22, (g) => {
    g.fillStyle(0xffffff);
    g.fillEllipse(7, 11, 12, 20);
  });
  texFromGraphics(s, 'rod', 8, 108, (g) => {
    g.fillStyle(0xd7b26b);
    g.fillRect(2, 6, 4, 92);
    g.fillStyle(0x8d5524);
    g.fillRect(0, 96, 8, 12);
    g.fillStyle(0xf7f3e8);
    g.fillRect(3, 4, 2, 6);
  });
  texFromGraphics(s, 'crabT', 34, 24, (g) => {
    g.fillStyle(0xe0563c);
    g.fillEllipse(17, 13, 20, 13);
    g.fillTriangle(4, 8, 13, 6, 10, 14);
    g.fillTriangle(30, 8, 21, 6, 24, 14);
    g.lineStyle(2, 0xe0563c, 1);
    g.lineBetween(8, 18, 4, 23);
    g.lineBetween(13, 20, 11, 24);
    g.lineBetween(21, 20, 23, 24);
    g.lineBetween(26, 18, 30, 23);
    g.fillStyle(0x14202e);
    g.fillCircle(13, 11, 1.6);
    g.fillCircle(21, 11, 1.6);
  });
  texFromGraphics(s, 'jellyT', 28, 40, (g) => {
    g.fillStyle(0xe29ad4, 0.9);
    g.fillEllipse(14, 12, 24, 20);
    g.lineStyle(2, 0xe29ad4, 0.8);
    g.lineBetween(8, 21, 6, 36);
    g.lineBetween(14, 22, 14, 38);
    g.lineBetween(20, 21, 22, 36);
    g.fillStyle(0xffd9f2, 0.8);
    g.fillCircle(9, 10, 2.5);
    g.fillCircle(19, 10, 2.5);
  });
}

function buildBackground(s) {
  makeGrad(s, 'sky', 4, WATER_Y, [
    [0, '#3fa7d6'], [0.5, '#9fd8f0'], [0.78, '#ffe9b0'], [1, '#ffd9a0'],
  ]);
  s.add.image(W / 2, WATER_Y / 2, 'sky').setDisplaySize(W + 2, WATER_Y + 2).setDepth(0);

  s.add.circle(120, 84, 64, 0xffe066, 0.12).setDepth(1);
  s.add.circle(120, 84, 48, 0xffe066, 0.25).setDepth(1);
  s.add.circle(120, 84, 34, 0xfff3b0, 0.95).setDepth(1);

  s.add.polygon(150, WATER_Y, [-95, 0, 95, 0, 34, -16, -28, -24], 0x1a5f6b).setOrigin(0, 0).setDepth(1);
  s.add.polygon(345, WATER_Y, [-60, 0, 60, 0, 20, -12, -18, -16], 0x17606b).setOrigin(0, 0).setDepth(1);

  for (const [cx, cy, sc] of [[250, 58, 1], [560, 40, 0.7], [700, 78, 0.55]]) {
    const c = s.add.container(cx, cy).setDepth(1);
    c.add(s.add.ellipse(-18, 0, 44 * sc, 16 * sc, 0xffffff, 0.85));
    c.add(s.add.ellipse(6, -7 * sc, 34 * sc, 14 * sc, 0xffffff, 0.85));
    c.add(s.add.ellipse(22, 2, 26 * sc, 12 * sc, 0xffffff, 0.85));
    s.tweens.add({ targets: c, x: cx + 24, duration: 7000, yoyo: true, repeat: -1, ease: SB });
  }
}

function buildWater(s) {
  makeGrad(s, 'wgrad', 4, H - WATER_Y, [
    [0, '#3fc9c0'], [0.22, '#1d8bb5'], [0.5, '#0d3a66'], [0.8, '#081c3a'], [1, '#040d1f'],
  ]);
  s.add.image(W / 2, WATER_Y + (H - WATER_Y) / 2, 'wgrad').setDisplaySize(W + 2, H - WATER_Y + 4).setDepth(2);

  s.raysG = s.add.graphics().setDepth(3);
  s.wavesG = s.add.graphics().setDepth(8);
  s.overlay = s.add.rectangle(W / 2, WATER_Y + (H - WATER_Y) / 2, W, H - WATER_Y, 0x030d1c, 0).setDepth(7);

  s.snow = [];
  for (let i = 0; i < 26; i++) {
    const p = s.add.rectangle(
      Math.random() * W, WATER_Y + 20 + Math.random() * (H - WATER_Y - 40),
      2, 2, 0xbcd4e6, 0.3,
    ).setDepth(3);
    s.snow.push(p);
  }
}

function waterTick(s, dt) {
  const st = s.state;
  const g = s.wavesG;
  g.clear();
  const t = st.t;
  const wy = (x) => WATER_Y + Math.sin(x * 0.02 + t * 1.6) * 3 + Math.sin(x * 0.045 - t * 2.2) * 2;
  g.fillStyle(0xdff6f9, 0.22);
  g.beginPath();
  g.moveTo(0, WATER_Y + 12);
  for (let x = 0; x <= W; x += 25) {
    g.lineTo(x, wy(x));
  }
  g.lineTo(W, WATER_Y + 12);
  g.closePath();
  g.fillPath();
  g.lineStyle(2, 0xffffff, 0.4);
  g.beginPath();
  g.moveTo(0, WATER_Y + Math.sin(t * 1.6) * 3);
  for (let x = 0; x <= W; x += 25) {
    g.lineTo(x, wy(x));
  }
  g.strokePath();

  for (let i = 0; i < 4; i++) {
    g.fillStyle(0xfff3b0, 0.14 + Math.sin(t * 2.4 + i * 1.3) * 0.12);
    g.fillEllipse(88 + i * 22 + Math.sin(t * 1.1 + i) * 6, WATER_Y + 7, 24 - i * 4, 3);
  }

  const d = st.phase === 'sink' || st.phase === 'bite' || st.phase === 'mg' || st.phase === 'boss' ? st.hook.depth : 0;
  s.overlay.setAlpha(C(d / 900, 0, 1) * 0.72);

  const rayA = C(1 - d / 320, 0, 1) * 0.16;
  if (rayA > 0.01) {
    s.raysG.clear();
    for (let i = 0; i < 3; i++) {
      const x0 = 190 + i * 190 + Math.sin(t * 0.5 + i) * 14;
      s.raysG.fillStyle(0xfff6d8, rayA * (1 - i * 0.2));
      s.raysG.fillTriangle(x0 - 14, WATER_Y, x0 + 14, WATER_Y, x0 - 46 + i * 18, WATER_Y + 150);
    }
  } else {
    s.raysG.clear();
  }

  const snowA = C((d - 320) / 450, 0, 0.32);
  for (const p of s.snow) {
    p.alpha = snowA;
    if (snowA > 0) {
      p.y += (9 + (d / 900) * 26) * dt;
      p.x += Math.sin(t + p.y * 0.05) * 8 * dt;
      if (p.y > H - 12) { p.y = WATER_Y + 16; p.x = Math.random() * W; }
    }
  }
}

function buildDock(s) {
  const c = s.add.container(0, 0).setDepth(9);
  for (const px of [500, 612, 724]) {
    c.add(s.add.rectangle(px, DOCK_Y + 62, 13, 110, 0x5e3a20));
    c.add(s.add.rectangle(px, DOCK_Y + 118, 13, 14, 0x3f2814));
  }
  c.add(s.add.rectangle(635, DOCK_Y + 8, 340, 18, 0xa9713d));
  c.add(s.add.rectangle(635, DOCK_Y, 340, 5, 0xc99157));
  for (let i = 0; i < 6; i++) {
    c.add(s.add.rectangle(485 + i * 60, DOCK_Y + 13, 3, 16, 0x7c5228));
  }
  c.add(s.add.rectangle(762, DOCK_Y - 18, 3, 40, 0x7f5539));
  c.add(s.add.rectangle(748, DOCK_Y - 34, 26, 6, TY));
  c.add(s.add.rectangle(748, DOCK_Y - 28, 26, 4, TB));
  c.add(s.add.rectangle(748, DOCK_Y - 24, 26, 4, TR));
  c.add(s.add.ellipse(588, DOCK_Y + 2, 56, 8, 0x2a1810, 0.25));
}

const POSES = {
  IDLE: { rod: -0.5, tail: 0, head: 0, lean: 0, eye: 1, wing: 0, tailSp: 0, y: 0 },
  CAST: { rod: -1.1, tail: 0.3, head: -0.08, lean: -0.08, eye: 0.7, wing: 0.35, tailSp: 0, y: 0 },
  FISHING: { rod: -0.62, tail: 0, head: 0, lean: 0.04, eye: 1.05, wing: 0, tailSp: 0, y: 0 },
  BITE: { rod: -0.98, tail: -0.4, head: 0.14, lean: 0.12, eye: 1.55, wing: -0.25, tailSp: 0.15, y: -3 },
  CATCH: { rod: 0.38, tail: -0.12, head: -0.16, lean: -0.1, eye: 1.35, wing: 0.5, tailSp: 0.55, y: -6 },
  FAIL: { rod: -0.22, tail: 0.32, head: 0.24, lean: 0.16, eye: 0.6, wing: 0.1, tailSp: 0, y: 3 },
  VICTORY: { rod: 0.2, tail: -0.2, head: -0.12, lean: -0.05, eye: 1.35, wing: 0.95, tailSp: 0.6, y: -5 },
  BUY: { rod: -0.4, tail: -0.1, head: -0.1, lean: 0, eye: 1.2, wing: 0.6, tailSp: 0.35, y: -4 },
};

function buildMacaw(s) {
  const m = {};
  m.root = s.add.container(588, DOCK_Y).setDepth(9);

  m.tailC = s.add.container(16, -26);
  m.feathers = [];
  for (let i = 0; i < 3; i++) {
    const f = s.add.image(0, 0, 'feather').setOrigin(0.5, 0.06).setRotation(-0.3 + i * 0.3);
    f.setTint([TY, TB, TR][i]);
    m.feathers.push(f);
    m.tailC.add(f);
  }
  m.root.add(m.tailC);

  m.root.add(s.add.rectangle(-7, -6, 5, 13, 0x8d99ae));
  m.root.add(s.add.rectangle(6, -4, 5, 13, 0x8d99ae));

  m.bodyC = s.add.container(0, -44);
  m.bodyC.add(s.add.ellipse(0, 0, 48, 42, TY));
  m.bodyC.add(s.add.ellipse(-5, 9, 30, 22, 0xffe9a3));

  m.wingC = s.add.container(10, -10);
  m.wingC.add(s.add.image(0, 0, 'wing').setOrigin(0.5, 0.1));
  m.bodyC.add(m.wingC);

  m.headC = s.add.container(-9, -38);
  m.headC.add(s.add.circle(0, 0, 23, TY));
  const crestTs = [TR, TB, TY];
  for (let i = 0; i < 3; i++) {
    m.headC.add(
      s.add.image(2 - i * 5, -21, 'crest').setOrigin(0.5, 1).setRotation(-0.55 + i * 0.3).setTint(crestTs[i]).setScale(0.8 - i * 0.15),
    );
  }
  m.headC.add(s.add.ellipse(-6, 4, 24, 21, 0xf8eeda));
  m.headC.add(s.add.image(-28, 5, 'beak').setFlipX(true));

  m.eyeC = s.add.container(-9, -5);
  m.eyeC.add(s.add.circle(0, 0, 7, 0xffffff));
  m.pupil = s.add.circle(-1.5, 0.5, 3.2, 0x14202e);
  m.eyeC.add(m.pupil);
  m.eyeC.add(s.add.circle(-3, -1.8, 1.4, 0xffffff));
  m.headC.add(m.eyeC);

  m.bodyC.add(m.headC);
  m.root.add(m.bodyC);

  m.rodC = s.add.container(12, -58);
  m.rod = s.add.image(0, 0, 'rod').setOrigin(0.5, 0.95);
  m.rodC.add(m.rod);
  m.rodTip = s.add.circle(0, -100, 2, 0xffffff, 0);
  m.rodC.add(m.rodTip);
  m.root.add(m.rodC);

  m.pose = { ...POSES.IDLE };
  m.stateName = 'IDLE';
  s.mw = m;
}

function macawState(s, name) {
  const m = s.mw;
  m.stateName = name;
  const p = POSES[name];
  for (const k in POSES.IDLE) m.pose[k] = p[k];
}

function macawTick(s, dt) {
  const st = s.state;
  const m = s.mw;
  const t = st.t;
  if (st.poseTimer > 0) {
    st.poseTimer -= dt;
    if (st.poseTimer <= 0) {
      macawState(s, st.phase === 'sink' ? 'FISHING' : 'IDLE');
    }
  }
  const p = m.pose;
  const k = Math.min(1, dt * 9);

  m.root.y = DOCK_Y + p.y + Math.sin(t * 1.8) * 1.5;
  m.bodyC.scaleY = 1 + Math.sin(t * 2.2) * 0.02;
  m.bodyC.rotation += (p.lean - m.bodyC.rotation) * k;
  m.rodC.rotation += (p.rod - m.rodC.rotation) * Math.min(1, dt * 14);
  m.wingC.rotation += (p.wing + Math.sin(t * 2) * 0.03 - m.wingC.rotation) * k;

  let look = 0;
  if (st.phase === 'sink' || st.phase === 'mg' || st.phase === 'bite' || st.phase === 'boss') {
    look = C((st.hook.x - 588) / 1400, -0.2, 0.1);
  }
  m.headC.rotation += (p.head + look - m.headC.rotation) * k;
  m.pupil.x = -1.5 + look * 12;

  m.tailC.rotation = p.tail + Math.sin(t * 1.4) * 0.08 + (p.tailSp ? Math.sin(t * 13) * 0.12 * p.tailSp : 0);
  for (let i = 0; i < 3; i++) {
    const spread = p.tailSp ? Math.sin(t * 13 + i) * 0.22 * p.tailSp : 0;
    m.feathers[i].rotation = -0.3 + i * 0.3 + spread;
  }

  st.blinkT -= dt;
  if (st.blinkT <= 0) { st.blinkT = 2.2 + Math.random() * 2.8; st.blink = 0.13; }
  if (st.blink > 0) st.blink -= dt;
  const eyeS = st.blink > 0 ? 0.12 : p.eye;
  m.eyeC.scaleX += (eyeS - m.eyeC.scaleX) * Math.min(1, dt * 18);
  m.eyeC.scaleY += (eyeS - m.eyeC.scaleY) * Math.min(1, dt * 18);
}

function rodTipPos(s) {
  const mtx = s.mw.rodTip.getWorldTransformMatrix();
  return { x: mtx.tx, y: mtx.ty };
}

function buildLine(s) {
  s.lineG = s.add.graphics();
  s.hookS = s.add.image(-100, -100, 'hookT').setDepth(5).setVisible(false);
  s.bead = s.add.circle(-100, -100, 3.5, TR).setDepth(5).setVisible(false);
  s.state.lineOn = false;

  s.crabS = s.add.image(-100, -100, 'crabT').setDepth(5).setVisible(false);
  s.crabBarBg = s.add.rectangle(-100, -100, 46, 5, 0x0a1626, 0.8).setDepth(5).setVisible(false);
  s.crabBar = s.add.rectangle(-100, -100, 42, 3, TY).setDepth(5).setVisible(false);
  s.warnT = T(s, -100, -100, '!', 26, PAL.r).setDepth(6).setVisible(false);
  s.hookHint = s.add.circle(-100, -100, 21, 0, 0).setStrokeStyle(2, TY).setDepth(6).setVisible(false);
}

function depthY(d) {
  const top = WATER_Y + 36;
  return top + (H - 62 - top) * Math.pow(C(d / 900, 0, 1), 0.8);
}

function buildDepthMap(s) {
  const c = s.add.container(0, 0).setDepth(6).setVisible(false);
  s.depthC = c;
  c.add(s.add.rectangle(24, (depthY(0) + depthY(900)) / 2, 2, depthY(900) - depthY(0), 0xd8f3ff, 0.28));
  for (const z of ZONES) {
    const y = depthY(z[0]);
    c.add(s.add.rectangle(24, y, 12, 2, tintOf(z[2]), 0.8));
    c.add(T(s, 34, y, z[0] + 'm', 9, z[2], 0).setAlpha(0.78));
  }
  const y = depthY(BOSS_D);
  s.bossMark = s.add.rectangle(24, y, 16, 3, 0xffd700, 1).setAlpha(0.25);
  s.bossLabel = T(s, 34, y, '???', 9, '#ffd700', 0).setAlpha(0.45);
  c.add([s.bossMark, s.bossLabel]);
  s.depthPin = s.add.triangle(16, depthY(0), 0, 0, 9, 5, 0, 10, 0xffffff).setDepth(7);
  c.add(s.depthPin);
}

function lineDraw(s) {
  const st = s.state;
  const g = s.lineG;
  g.clear();
  if (!st.lineOn) return;
  const tip = rodTipPos(s);
  const hx = st.hook.x;
  const hy = st.hook.y - 10;
  const tense = st.phase === 'bite' || st.phase === 'mg' || st.phase === 'reel' || st.phase === 'boss';
  const sag = tense ? 2 : Math.hypot(hx - tip.x, hy - tip.y) * 0.1;
  const mx = (tip.x + hx) / 2;
  const my = (tip.y + hy) / 2 + sag;
  g.lineStyle(1.6, 0xf5f0e6, 0.85);
  g.beginPath();
  g.moveTo(tip.x, tip.y);
  for (let i = 1; i <= 8; i++) {
    const q = i / 8;
    const r = 1 - q;
    g.lineTo(r * r * tip.x + 2 * r * q * mx + q * q * hx, r * r * tip.y + 2 * r * q * my + q * q * hy);
  }
  g.strokePath();
}

function buildHud(s) {
  s.hudC = s.add.container(0, 0).setDepth(10);
  s.hud = {};
  s.hud.coinI = s.add.image(24, 22, 'coin');
  s.hud.coinT = T(s, 38, 22, '0', 20, PAL.y, 0);
  s.hud.hooks = [];
  for (let i = 0; i < 5; i++) {
    const hk = s.add.image(140 + i * 26, 22, 'hookT').setScale(0.6);
    s.hud.hooks.push(hk);
  }
  s.hud.depthT = T(s, W - 20, 22, '', 24, PAL.w, 1);
  s.hud.recT = T(s, W - 20, 46, '', 11, PAL.dim, 1);
  s.hud.runT = T(s, 326, 22, '', 11, PAL.dim);
  s.hud.trail = [0, 1, 2, 3].map((i) => s.add.circle(363 + i * 15, 22, 4, 0x38404d).setStrokeStyle(1, TY, 0.55));
  s.hud.lineT = T(s, 350, 43, '', 11, PAL.w);
  s.hud.promptT = T(s, W / 2, H - 24, '', 15, PAL.dim).setAlpha(0);
  s.hudC.add([s.hud.coinI, s.hud.coinT, ...s.hud.hooks, s.hud.depthT, s.hud.recT, s.hud.runT, ...s.hud.trail, s.hud.lineT, s.hud.promptT]);
  s.tweens.add({ targets: s.hud.promptT, alpha: { from: 0.25, to: 0.9 }, duration: 700, yoyo: true, repeat: -1 });
}

function updateCoinsHud(s) {
  const st = s.state;
  s.hud.coinT.setText('' + st.coins);
  s.tweens.killTweensOf(s.hud.coinT);
  s.hud.coinT.setScale(1.35);
  s.tweens.add({ targets: s.hud.coinT, scale: 1, duration: 220, ease: BO });
}

function updateHooksHud(s) {
  const st = s.state;
  s.hud.hooks.forEach((hk, i) => {
    hk.setTint(i < st.casts ? 0xffffff : 0x38404d);
    hk.setAlpha(i < st.casts ? 1 : 0.5);
  });
}

function updateRunHud(s) {
  const st = s.state;
  s.hud.runT.setText(st.catches >= 4 ? 'KRAKEN LOCALIZADO' : 'RASTRO' + (st.combo > 1 ? ' x' + st.combo : ''));
  s.hud.runT.setColor(st.catches >= 4 ? PAL.y : PAL.dim);
  s.hud.trail.forEach((p, i) => p.setVisible(st.catches < 4).setFillStyle(i < st.catches ? TY : 0x38404d));
  s.bossLabel.setText(st.catches >= 4 ? 'KRAKEN' : '???').setAlpha(st.catches >= 4 ? 1 : 0.45);
  s.bossMark.setAlpha(st.catches >= 4 ? 1 : 0.25);
  s.hud.lineT.setText(st.lineOn ? 'LÍNEA ' + '◆'.repeat(st.lineHp) : '');
}

function setPrompt(s, str) {
  s.hud.promptT.setText(str);
}

function popText(s, x, y, str, color, size, hold) {
  const t = T(s, x, y, str, size || 22, color || PAL.w).setDepth(12).setStroke('#071526', 2);
  t.setScale(0.4);
  s.tweens.add({
    targets: t, scale: 1, duration: 110, ease: BO,
    onComplete: () => {
      s.tweens.add({
        targets: t, y: y - 26, alpha: 0, duration: 850, delay: hold || 240, ease: EO,
        onComplete: () => t.destroy(),
      });
    },
  });
}

function splashFX(s, x, big) {
  const n = big ? 10 : 6;
  for (let i = 0; i < n; i++) {
    const p = s.add.circle(x + B(-6, 6), WATER_Y + 4, B(2, 4), 0xdff6f9, 0.9).setDepth(8);
    s.tweens.add({
      targets: p,
      x: p.x + B(-34, 34),
      y: WATER_Y - B(8, big ? 44 : 26),
      alpha: 0, duration: B(280, 460), ease: EO,
      onComplete: () => p.destroy(),
    });
  }
  const ring = s.add.ellipse(x, WATER_Y + 2, 20, 8, 0xffffff, 0).setDepth(8).setStrokeStyle(2, 0xdff6f9, 0.9);
  s.tweens.add({
    targets: ring, scaleX: big ? 5 : 3.2, scaleY: 2.2, alpha: 0, duration: 420, ease: EO,
    onComplete: () => ring.destroy(),
  });
}

function coinsFly(s, x, y, total) {
  const n = C(3 + Math.floor(total / 40), 3, 9);
  for (let i = 0; i < n; i++) {
    const c = s.add.image(x + B(-20, 20), y + B(-14, 14), 'coin').setDepth(12);
    s.tweens.add({
      targets: c, x: 30, y: 22, scale: 0.7, duration: 480, delay: 120 + i * 55, ease: EI,
      onComplete: () => { c.destroy(); if (i === n - 1) { sfx(s, 'coin'); updateCoinsHud(s); } },
    });
  }
}

function burstFX(s, x, y, color, n, spread) {
  for (let i = 0; i < n; i++) {
    const p = s.add.rectangle(x, y, 4, 4, color, 1).setDepth(12);
    const a = Math.random() * Math.PI * 2;
    const d = B(18, spread || 44);
    s.tweens.add({
      targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, angle: B(-90, 90),
      duration: B(240, 420), onComplete: () => p.destroy(),
    });
  }
}

function spawnFish(s) {
  const st = s.state;
  const d = st.hook.depth;
  const pool = SPECIES.filter((f) => f[1] <= d + 40);
  const ws = pool.map((f) => f[6] * (f[2] >= 300 ? (1 + st.up.l * 1.1) : f[2] >= 45 ? (1 + st.up.l * 0.5) : 1));
  let tw = 0;
  for (const w of ws) tw += w;
  let r = Math.random() * tw;
  let pick = pool[0];
  for (let i = 0; i < pool.length; i++) {
    r -= ws[i];
    if (r <= 0) { pick = pool[i]; break; }
  }
  const dir = Math.random() < 0.5 ? 1 : -1;
  const fd = C(d + B(-65, 65), 18, 790);
  const y = depthY(fd);
  const x = dir > 0 ? -40 : W + 40;
  const tc = tintOf(pick[3]);
  const sc = pick[4];
  const body = s.add.image(0, 0, 'fishT').setFlipX(dir < 0).setTint(tc).setScale(sc);
  const eye = s.add.image(-13 * sc * (dir < 0 ? -1 : 1), -3 * sc, 'fishEye').setScale(sc);
  const c = s.add.container(x, y, [body, eye]).setDepth(4);
  const leg = pick[2] >= 300;
  const shiny = Math.random() < 0.1 + st.up.l * 0.04;
  const glow = leg ? s.add.container(0, 0, [
    s.add.circle(0, 0, 34 * sc, 0xffe28a, 0.18),
    s.add.circle(0, 0, 16 * sc, 0xffffff, 0.32),
  ]).setDepth(3) : shiny ? s.add.container(0, 0, [
    s.add.circle(0, 0, 24 * sc, 0xffffff, 0.22),
    s.add.circle(0, 0, 11 * sc, 0xfffae0, 0.5),
  ]).setDepth(3) : null;
  const fval = Math.round(pick[2] * (shiny ? (leg ? 2 : 1.5) : 1));
  const fish = {
    c, body, glow, d: fd, sp: pick[5], dir, val: fval, name: shiny ? pick[0] + ' ✦' : pick[0], tint: tc,
    r: 13 * sc + 6, seed: Math.random() * 10, frozen: false, leg, shiny,
  };
  if (glow) {
    s.tweens.add({ targets: glow, alpha: { from: 0.12, to: 0.4 }, duration: 560, yoyo: true, repeat: -1 });
    s.tweens.add({ targets: glow, scale: { from: 0.92, to: 1.08 }, duration: 760, yoyo: true, repeat: -1, ease: SB });
  }
  st.fish.push(fish);
}

function updateFishes(s, dt) {
  const st = s.state;
  for (let i = st.fish.length - 1; i >= 0; i--) {
    const f = st.fish[i];
    if (!frozenAll(st) && !f.frozen) {
      f.c.x += f.dir * f.sp * dt;
      f.c.y = depthY(f.d) + Math.sin(st.t * 2 + f.seed) * 6;
      f.body.rotation = Math.sin(st.t * 6 + f.seed) * 0.07;
    }
    if (f.glow) f.glow.setPosition(f.c.x, f.c.y);
    if (f.c.x < -70 || f.c.x > W + 70) {
      destroyFish(s, i);
    }
  }
}

function frozenAll(st) {
  return st.phase === 'bite' || st.phase === 'mg';
}

function destroyFish(s, i) {
  const f = s.state.fish[i];
  if (f.glow) f.glow.destroy();
  f.c.destroy();
  s.state.fish.splice(i, 1);
}

function spawnJelly(s) {
  const st = s.state;
  const fromLeft = Math.random() < 0.5;
  const d = C(st.hook.depth + B(-55, 55), 300, 790);
  const c = s.add.container(fromLeft ? -30 : W + 30, depthY(d))
    .setDepth(4)
    .add(s.add.image(0, 0, 'jellyT'));
  s.tweens.add({ targets: c, scaleY: 1.15, duration: 700, yoyo: true, repeat: -1, ease: SB });
  st.jellies.push({ c, d, seed: Math.random() * 10, dir: fromLeft ? 1 : -1 });
}

function updateJellies(s, dt) {
  const st = s.state;
  for (let i = st.jellies.length - 1; i >= 0; i--) {
    const j = st.jellies[i];
    j.c.x += j.dir * 34 * dt;
    j.c.y = depthY(j.d) + Math.sin(st.t * 1.5 + j.seed) * 7;
    if (Math.hypot(j.c.x - st.hook.x, j.c.y - st.hook.y) < 24) {
      j.c.destroy();
      st.jellies.splice(i, 1);
      if (st.phase === 'sink') {
        popText(s, st.hook.x, st.hook.y - 50, '¡MEDUSA!', PAL.r, 22);
        lineCut(s);
        return;
      }
      continue;
    }
    if (j.c.x < -60 || j.c.x > W + 60) {
      j.c.destroy();
      st.jellies.splice(i, 1);
    }
  }
}

function spawnEel(s) {
  const st = s.state;
  const left = Math.random() < 0.5;
  const d = C(st.hook.depth + B(-45, 45), 500, 810);
  const glow = s.add.ellipse(0, 0, 86, 24, 0x7fffd4, 0.2);
  const body = s.add.image(0, 0, 'fishT').setScale(1.7, 0.55).setTint(0x7fffd4).setFlipX(!left);
  const c = s.add.container(left ? 54 : W - 54, depthY(d), [glow, body]).setDepth(5).setAlpha(0.25);
  st.eels.push({ c, d, dir: left ? 1 : -1, t: 0.75, dash: false });
  sfx(s, 'eel');
}

function updateEels(s, dt) {
  const st = s.state;
  for (let i = st.eels.length - 1; i >= 0; i--) {
    const e = st.eels[i];
    e.c.y = depthY(e.d);
    e.t -= dt;
    if (!e.dash) {
      e.c.alpha = 0.2 + Math.abs(Math.sin(st.t * 18)) * 0.7;
      if (e.t <= 0) { e.dash = true; e.c.alpha = 1; sfx(s, 'zap'); }
    } else {
      e.c.x += e.dir * (470 + st.catches * 35) * dt;
      if (!e.hit && Math.hypot(e.c.x - st.hook.x, e.c.y - st.hook.y) < 34) {
        e.hit = true;
        if (st.phase === 'sink' && st.stun <= 0) {
          st.stun = 1.3;
          sfx(s, 'zap');
          s.cameras.main.shake(180, 0.007);
          popText(s, st.hook.x, st.hook.y - 40, '¡ANGUILA!', 0x7fffd4, 20);
          const fl = s.add.rectangle(st.hook.x, st.hook.y, 30, 30, 0x7fffd4, 0.5).setDepth(5);
          s.tweens.add({ targets: fl, scale: 2.4, alpha: 0, duration: 420, onComplete: () => fl.destroy() });
        }
      }
    }
    if (e.c.x < -100 || e.c.x > W + 100) { e.c.destroy(); st.eels.splice(i, 1); }
  }
}

function toDock(s, fresh) {
  const st = s.state;
  if (fresh) {
    st.coins = 0;
    st.casts = 5;
    st.up = { d: 0, l: 0, c: 0 };
    st.runMax = 0;
    st.best = null;
    st.catches = 0;
    st.combo = 0;
    st.zmax = -1;
    st.newRecShown = false;
  }
  st.phase = 'dock';
  st.hook.depth = 0;
  s.hudC.setVisible(true);
  updateCoinsHud(s);
  updateHooksHud(s);
  updateRunHud(s);
  s.hud.depthT.setText('');
  s.depthC.setVisible(false);
  macawState(s, 'IDLE');
  if (fresh) {
    setPrompt(s, 'OBJETIVO: CAPTURA 4 PECES PARA LOCALIZAR AL KRAKEN');
    popText(s, W / 2, 250, 'CAPTURA 4 PECES', PAL.y, 27, 2200);
    s.time.delayedCall(2300, () => { if (st.phase === 'dock') setPrompt(s, 'B1 LANZAR · B2 TIENDA'); });
  } else setPrompt(s, st.catches >= 4 ? 'B1 INICIAR CAZA FINAL · B2 TIENDA' : 'B1 LANZAR · B2 TIENDA');
}

function dockUpdate(s) {
  if (once(s, ['P1_1', 'P2_1'])) {
    startCast(s);
  } else if (once(s, ['P1_2', 'P2_2'])) {
    shopOpen(s);
  }
}

function startCast(s) {
  const st = s.state;
  st.casts -= 1;
  updateHooksHud(s);
  setPrompt(s, '');
  st.phase = 'cast';
  st.cast = { t: 0, launched: false, fly: 0 };
  st.hook = { x: -100, y: -100, depth: 0 };
  st.lineHp = 2 + st.up.d;
  st.deepestCast = 0;
  st.atLimit = false;
  st.bossStarted = false;
  st.aim = 0;
  s.hookHint.setVisible(false);
  s.hookS.setVisible(false);
  s.bead.setVisible(false);
  macawState(s, 'CAST');
  sfx(s, 'cast');
}

function castUpdate(s, dt) {
  const st = s.state;
  const c = st.cast;
  c.t += dt;
  if (c.t >= 0.22 && !c.launched) {
    c.launched = true;
    s.mw.pose.rod = -0.02;
    s.mw.pose.tail = -0.25;
    const tip = rodTipPos(s);
    c.from = tip;
    c.fly = 0;
  }
  if (c.launched) {
    c.fly += dt / 0.34;
    const p = Math.min(1, c.fly);
    const tx = 250;
    const ty = WATER_Y + 2;
    st.hook.x = c.from.x + (tx - c.from.x) * p;
    st.hook.y = c.from.y + (ty - c.from.y) * p - 70 * Math.sin(Math.PI * p);
    if (!s.hookS.visible) {
      s.hookS.setVisible(true);
      s.bead.setVisible(true);
      st.lineOn = true;
    }
    if (p >= 1) {
      splashFX(s, 250, false);
      sfx(s, 'splash');
      st.hook.y = WATER_Y + 34;
      st.phase = 'sink';
      st.spawnT = 0.6;
      st.jellyT = 1.4 + Math.random() * 1.8;
      st.eelT = 1.8 + Math.random() * 2.2;
      st.crabCd = 1.1 + Math.random() * 1.4;
      st.crab = null;
      st.invuln = 0.8;
      s.depthC.setVisible(true);
      updateRunHud(s);
      setPrompt(s, st.catches >= 4 ? 'BAJA A 820m · SOBREVIVE · KRAKEN' : 'ACÉRCATE AL PEZ · B1 ENGANCHAR');
      macawState(s, 'FISHING');
    }
  }
}

function sinkUpdate(s, dt) {
  const st = s.state;
  const hook = st.hook;
  const maxD = st.catches >= 4 ? 900 : UPGRADES.d.m[st.up.d];
  const stund = st.stun > 0;
  if (stund) st.stun -= dt;
  const ay = stund ? 0 : axisY(s);
  const vy = ay > 0 ? 76 : ay < 0 ? -92 : 12;
  hook.depth = C(hook.depth + vy * (st.crab ? 0.45 : 1) * dt, 0, maxD);
  st.deepestCast = Math.max(st.deepestCast, hook.depth);
  st.runMax = Math.max(st.runMax, Math.round(hook.depth));
  s.hud.depthT.setText(Math.round(hook.depth) + ' / ' + maxD + ' m');
  s.depthPin.y = depthY(hook.depth);

  if (!st.newRecShown && st.records.d >= 50 && hook.depth > st.records.d) {
    st.newRecShown = true;
    newDepthBanner(s);
  }

  hook.x = C(hook.x + (stund ? 0 : axisX(s)) * 265 * dt, 60, 505);
  hook.y = depthY(hook.depth);
  if (stund) s.hookS.setAlpha(0.35 + Math.abs(Math.sin(st.t * 30)) * 0.65).setTint(0x7fffd4);
  else s.hookS.setAlpha(1).setTint(0xffffff);

  let zone = 0;
  for (let i = 1; i < ZONES.length; i++) if (hook.depth >= ZONES[i][0]) zone = i;
  if (zone > st.zmax) {
    st.zmax = zone;
    if (zone > 0) { popText(s, W / 2, 208, ZONES[zone][1], ZONES[zone][2], 21); sfx(s, 'record'); }
  }

  if (st.catches < 4) {
    st.spawnT -= dt;
    if (st.spawnT <= 0 && st.fish.length < 8) {
      spawnFish(s);
      st.spawnT = 0.75 + Math.random() * 0.7;
    }
  }

  if (hook.depth >= 300) {
    st.jellyT -= dt;
    if (st.jellyT <= 0 && st.jellies.length < 3) {
      spawnJelly(s);
      st.jellyT = (2.6 + Math.random() * 3 * Math.max(0.45, 1 - hook.depth / 1000)) / (1 + st.catches * 0.16);
    }
    updateJellies(s, dt);
    if (st.phase !== 'sink') return;
  }

  if (hook.depth >= 500) {
    st.eelT -= dt;
    if (st.eelT <= 0 && st.eels.length < 2) {
      spawnEel(s);
      st.eelT = (3.4 + Math.random() * 3) / (1 + st.catches * 0.14);
    }
    updateEels(s, dt);
    if (st.phase !== 'sink') return;
  }

  if (hook.depth >= 150 && !st.crab && st.crabWarn <= 0) {
    st.crabCd -= dt * (0.6 + hook.depth / 700 + st.catches * 0.18);
    if (st.crabCd <= 0) {
      st.crabWarn = 0.85;
      st.crabCd = 9 + Math.random() * 7;
      sfx(s, 'crab');
      s.warnT.setPosition(hook.x, hook.y - 30).setVisible(true).setAlpha(1);
      s.tweens.add({ targets: s.warnT, alpha: 0.2, duration: 120, yoyo: true, repeat: 4 });
    }
  }

  if (st.crabWarn > 0) {
    st.crabWarn -= dt;
    s.warnT.setPosition(hook.x, hook.y - 30);
    if (st.crabWarn <= 0) {
      s.warnT.setVisible(false);
      st.crab = { t: 2.5, mx: 2.5, sh: 0, need: 280 + hook.depth * 0.12, px: hook.x };
      s.crabS.setVisible(true);
      popText(s, hook.x, hook.y - 44, '¡CANGREJO!', PAL.r, 16);
    }
  }

  if (st.crab) {
    st.crab.t -= dt;
    st.crab.sh += Math.abs(hook.x - st.crab.px);
    st.crab.px = hook.x;
    if (st.crab.sh >= st.crab.need) {
      crabOff(s);
    } else if (st.crab.t <= 0) {
      lineCut(s);
      return;
    }
  }

  st.invuln -= dt;
  const hookPress = once(s, ['P1_1', 'P2_1']);
  let aim = -1, hit = -1, nearD = 1e9;
  if (!st.crab && st.invuln <= 0) {
    for (let i = 0; i < st.fish.length; i++) {
      const f = st.fish[i];
      const d = Math.hypot(f.c.x - hook.x, f.c.y - hook.y);
      if (d < f.r + 34 && d < nearD) { aim = i; nearD = d; }
      if (d < f.r + 11) hit = i;
    }
  }
  if (aim >= 0) {
    const f = st.fish[aim];
    const ready = hit >= 0;
    s.hookHint.setPosition(f.c.x, f.c.y).setScale((f.r + 12) / 21).setStrokeStyle(2, ready ? 0x70e000 : TY).setVisible(true);
    if (st.aim !== (ready ? 2 : 1)) setPrompt(s, ready ? '¡B1 AHORA!' : 'ACÉRCATE MÁS · B1 ENGANCHAR');
    st.aim = ready ? 2 : 1;
    if (hookPress) {
      if (ready) { s.hookHint.setVisible(false); startBite(s, hit); return; }
      f.sp *= 1.7;
      f.dir = f.c.x < hook.x ? -1 : 1;
      popText(s, hook.x, hook.y - 25, '¡FALLASTE!', PAL.r, 15);
      sfx(s, 'fail');
    }
  } else {
    s.hookHint.setVisible(false);
    if (st.aim) setPrompt(s, st.catches >= 4 ? 'BAJA A 820m · SOBREVIVE · KRAKEN' : 'ACÉRCATE AL PEZ · B1 ENGANCHAR');
    st.aim = 0;
  }

  updateFishes(s, dt);

  if (Math.random() < dt * 1.6) {
    const b = s.add.circle(hook.x + B(-6, 6), hook.y, B(1.5, 3), 0xcfeef7, 0.5).setDepth(5);
    s.tweens.add({
      targets: b, y: b.y - B(30, 70), alpha: 0, duration: B(700, 1200),
      onComplete: () => b.destroy(),
    });
  }

  if (st.catches >= 4 && hook.depth >= BOSS_D && !st.bossStarted) {
    startBoss(s);
    return;
  }

  if (hook.depth >= maxD && !st.atLimit) {
    st.atLimit = true;
    popText(s, W / 2, 240, st.catches >= 4 ? 'ALGO ENORME SE ACERCA...' : 'LÍMITE DE LA LÍNEA', st.catches >= 4 ? PAL.y : PAL.dim, 20);
  }
  if (hook.depth < maxD - 8) st.atLimit = false;
  if (st.deepestCast > 18 && hook.depth <= 1 && ay < 0) {
    reelEmpty(s, 'RECOGIDA');
  }
}

function newDepthBanner(s) {
  const st = s.state;
  sfx(s, 'record');
  popText(s, W / 2, 250, '¡NUEVA PROFUNDIDAD!', PAL.y, 30);
  burstFX(s, W / 2, 250, TY, 10, 70);
  macawState(s, 'VICTORY');
  st.poseTimer = 1.2;
}

function startBoss(s) {
  const st = s.state;
  st.bossStarted = true;
  st.phase = 'boss';
  st.bossT = 0;
  for (let i = st.fish.length - 1; i >= 0; i--) destroyFish(s, i);
  for (const j of st.jellies) j.c.destroy();
  for (const e of st.eels) e.c.destroy();
  st.jellies = [];
  st.eels = [];
  st.crab = null;
  st.crabWarn = 0;
  s.warnT.setVisible(false);
  s.crabS.setVisible(false);
  s.crabBarBg.setVisible(false);
  s.crabBar.setVisible(false);
  const cy = depthY(BOSS_D);
  const aura = s.add.circle(W + 90, cy, 96, 0xffd700, 0.14).setDepth(3);
  const tent = s.add.graphics().setDepth(4);
  const body = s.add.ellipse(0, 0, 108, 76, 0x2e0a4a).setDepth(5);
  const hood = s.add.ellipse(0, -8, 88, 58, 0x51158a).setDepth(5);
  const hornL = s.add.triangle(-30, -28, 0, 0, 14, 0, 4, -20, 0x7a2da0).setDepth(5);
  const hornR = s.add.triangle(30, -28, 0, 0, 14, 0, 10, -20, 0x7a2da0).setDepth(5).setAngle(28);
  const eyeW = s.add.circle(-22, -6, 13, 0xffffff).setDepth(6);
  const eyeG = s.add.circle(-21, -6, 8, 0xffd700).setDepth(6);
  const eyeK = s.add.circle(-20, -6, 3.4, 0x0a0a0a).setDepth(6);
  const c = s.add.container(W + 90, cy, [tent, body, hood, hornL, hornR, eyeW, eyeG, eyeK]).setDepth(5);
  const f = { c, body, glow: aura, tent, d: BOSS_D, sp: 0, dir: -1, val: 1000, name: 'Kraken dorado', r: 58, seed: 0, frozen: true, leg: true, boss: true, tint: 0xffd700 };
  st.fish.push(f);
  s.tweens.add({ targets: aura, alpha: { from: 0.08, to: 0.28 }, duration: 560, yoyo: true, repeat: -1 });
  s.tweens.add({ targets: aura, scale: { from: 0.94, to: 1.1 }, duration: 900, yoyo: true, repeat: -1, ease: SB });
  s.tweens.add({ targets: eyeG, scale: { from: 0.85, to: 1.15 }, duration: 480, yoyo: true, repeat: -1 });
  setPrompt(s, '¡KRAKEN DORADO!');
  sfx(s, 'legendary');
  s.cameras.main.shake(400, 0.008);
  popText(s, W / 2, 250, '¡KRAKEN DORADO!', PAL.y, 34, 1600);
  s.tweens.add({ targets: c, x: hookBossX(st), duration: 1050, ease: EO });
}

function hookBossX(st) { return C(st.hook.x + 92, 180, 500); }

function bossUpdate(s, dt) {
  const st = s.state;
  st.bossT += dt;
  const f = st.fish[0];
  if (!f) return;
  const by = depthY(BOSS_D) + Math.sin(st.t * 3) * 12;
  f.c.y = by;
  f.glow.setPosition(f.c.x, by);
  f.body.rotation = Math.sin(st.t * 5) * 0.06;
  const g = f.tent;
  g.clear();
  g.lineStyle(6, 0x4a1670, 1);
  for (let k = -3; k <= 3; k++) {
    if (k === 0) continue;
    const bx = k * 12, by2 = 24;
    g.beginPath();
    g.moveTo(bx, by2);
    for (let j = 1; j <= 5; j++) {
      const ty = by2 + j * 15;
      const tx = bx + Math.sin(st.t * 5 + j * 0.8 + k) * (5 + j * 2);
      g.lineTo(tx, ty);
    }
    g.strokePath();
  }
  if (st.bossT > 1.35) startBite(s, 0);
}

function startBite(s, idx) {
  const st = s.state;
  const f = st.fish[idx];
  st.fish.splice(idx, 1);
  st.bite = { f, t: 0 };
  st.crabWarn = 0;
  s.warnT.setVisible(false);
  st.phase = 'bite';
  st.aim = 0;
  s.hookHint.setVisible(false);
  macawState(s, 'BITE');
  sfx(s, 'bite');
  s.cameras.main.shake(130, 0.005);
  popText(s, f.c.x, f.c.y - 26, f.boss ? '¡LUCHA FINAL!' : '¡PICADA!', f.boss ? PAL.y : PAL.w, f.boss ? 26 : 20);
}

function biteUpdate(s, dt) {
  const st = s.state;
  st.bite.t += dt;
  updateFishes(s, dt);
  if (st.bite.t >= 0.6) {
    mgStart(s);
  }
}

function crabOff(s) {
  const st = s.state;
  const cr = s.crabS;
  sfx(s, 'shake');
  s.tweens.add({
    targets: cr, x: cr.x + 90, y: cr.y + 60, angle: 160, alpha: 0, duration: 450, ease: QI,
    onComplete: () => { cr.setAlpha(1).setAngle(0).setVisible(false); },
  });
  popText(s, st.hook.x, st.hook.y - 40, '¡FUERA!', PAL.w, 15);
  st.crab = null;
  st.invuln = 1.1;
  s.crabBarBg.setVisible(false);
  s.crabBar.setVisible(false);
}

function lineCut(s) {
  const st = s.state;
  if (st.cut) return;
  st.cut = true;
  st.combo = 0;
  updateRunHud(s);
  st.phase = 'reel';
  st.crab = null;
  sfx(s, 'cut');
  s.cameras.main.shake(200, 0.008);
  s.crabS.setVisible(false);
  s.crabBarBg.setVisible(false);
  s.crabBar.setVisible(false);
  s.warnT.setVisible(false);
  s.hookHint.setVisible(false);
  popText(s, st.hook.x, st.hook.y - 30, '¡LÍNEA ROTA!', PAL.r, 24);
  st.lineOn = false;
  s.hookS.setVisible(false);
  s.bead.setVisible(false);
  macawState(s, 'FAIL');
  s.time.delayedCall(1100, () => endCast(s, false));
}

function reelEmpty(s, msg) {
  const st = s.state;
  st.phase = 'reel';
  popText(s, st.hook.x, st.hook.y - 26, msg || 'SIN PICADA', PAL.dim, 18);
  reelUp(s, () => endCast(s, false));
}

function reelUp(s, done) {
  const st = s.state;
  let n = 0;
  const ev = s.time.addEvent({
    delay: 70, repeat: 7, callback: () => {
      sfx(s, 'reel');
      n++;
      if (n >= 8) ev.remove();
    },
  });
  s.tweens.add({
    targets: st.hook, y: WATER_Y + 6, duration: 420, ease: EI,
    onComplete: () => {
      s.hookS.setVisible(false);
      s.bead.setVisible(false);
      st.lineOn = false;
      done();
    },
  });
}

function failCatch(s) {
  const st = s.state;
  const f = st.bite.f;
  st.combo = 0;
  updateRunHud(s);
  mgHide(s);
  sfx(s, 'fail');
  popText(s, f.c.x, f.c.y - 24, '¡SE FUE!', PAL.r, 26);
  f.frozen = false;
  s.tweens.add({
    targets: f.c, x: f.c.x + (f.dir > 0 ? 1 : -1) * 640, duration: 320, ease: EI,
    onComplete: () => {
      if (f.glow) f.glow.destroy();
      f.c.destroy();
    },
  });
  macawState(s, 'FAIL');
  st.phase = 'reel';
  reelUp(s, () => endCast(s, false));
}

function caughtCatch(s) {
  const st = s.state;
  const f = st.bite.f;
  mgHide(s);
  st.phase = 'reel';
  const fc = f.c;
  s.tweens.add({
    targets: st.hook, y: WATER_Y + 18, duration: 480, ease: EI,
    onUpdate: () => {
      fc.x = st.hook.x - 10 * f.dir;
      fc.y = st.hook.y - 6;
      if (f.glow) f.glow.setPosition(fc.x, fc.y);
    },
    onComplete: () => {
      splashFX(s, st.hook.x, false);
      macawState(s, 'CATCH');
      if (f.leg) {
        legendaryFX(s);
      } else {
        sfx(s, 'catch');
      }
      popText(s, 588, DOCK_Y - 96, '¡ATRAPADO!', PAL.w, 24);
      st.combo++;
      if (!f.boss) st.catches++;
      const reward = f.boss ? f.val : Math.round(f.val * (1 + (st.combo - 1) * 0.25));
      popText(s, 588, DOCK_Y - 66, f.name + '  +' + reward + (st.combo > 1 ? '  x' + st.combo : ''), PAL.y, 18);
      st.coins += reward;
      if (!st.best || reward > st.best.val) st.best = { val: reward, name: f.name };
      updateRunHud(s);
      if (!f.boss) clueFX(s);
      coinsFly(s, 500, DOCK_Y - 60, reward);
      s.tweens.add({
        targets: fc, x: 512, y: DOCK_Y - 58, scale: 1.35, duration: 430, ease: SO,
        onUpdate: () => { if (f.glow) f.glow.setPosition(fc.x, fc.y); },
        onComplete: () => {
          if (f.leg) {
            st.records.l += 1;
            saveRecords(s);
          }
          s.time.delayedCall(1250, () => {
            if (f.glow) f.glow.destroy();
            fc.destroy();
            endCast(s, f.boss ? 'boss' : true);
          });
        },
      });
    },
  });
}

function clueFX(s) {
  const n = s.state.catches;
  if (n < 4) {
    popText(s, W / 2, 250, 'RASTRO DEL KRAKEN ' + n + '/4', PAL.y, 24, 1800);
    sfx(s, 'record');
    return;
  }
  const dark = s.add.rectangle(W / 2, H / 2, W, H, 0x020611, 0.72).setDepth(11);
  s.tweens.add({ targets: dark, alpha: 0, duration: 1500, delay: 550, onComplete: () => dark.destroy() });
  s.tweens.add({ targets: [s.bossMark, s.bossLabel], alpha: { from: 0.2, to: 1 }, duration: 180, yoyo: true, repeat: 4 });
  s.cameras.main.shake(520, 0.011);
  sfx(s, 'legendary');
  popText(s, W / 2, 220, '¡KRAKEN LOCALIZADO!', PAL.y, 36, 2600);
  popText(s, W / 2, 270, 'PRÓXIMO LANZAMIENTO: CAZA FINAL', PAL.w, 17, 2600);
}

function legendaryFX(s) {
  sfx(s, 'legendary');
  s.cameras.main.shake(320, 0.009);
  const flash = s.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0.85).setDepth(14);
  s.tweens.add({ targets: flash, alpha: 0, duration: 480, onComplete: () => flash.destroy() });
  const dark = s.add.rectangle(W / 2, H / 2, W, H, 0x04070f, 0.5).setDepth(13);
  s.tweens.add({ targets: dark, alpha: 0, duration: 1600, onComplete: () => dark.destroy() });
  popText(s, W / 2, 240, '¡LEGENDARIO!', PAL.y, 40);
  for (const [col, n] of [[TY, 12], [TB, 8], [TR, 8]]) {
    burstFX(s, W / 2, 240, col, n, 110);
  }
}

function endCast(s, won) {
  const st = s.state;
  const a = s.audio;
  if (a) { a.mmode = 'trop'; a.mint = 190; }
  for (let i = st.fish.length - 1; i >= 0; i--) destroyFish(s, i);
  for (const j of st.jellies) j.c.destroy();
  for (const e of st.eels) e.c.destroy();
  st.jellies = [];
  st.eels = [];
  st.bite = null;
  st.mg = null;
  st.crab = null;
  st.crabWarn = 0;
  s.crabS.setVisible(false);
  s.crabBarBg.setVisible(false);
  s.crabBar.setVisible(false);
  s.warnT.setVisible(false);
  s.hookHint.setVisible(false);
  s.hookS.setVisible(false);
  s.bead.setVisible(false);
  st.lineOn = false;
  st.cut = false;
  s.lineG.clear();
  s.hud.depthT.setText('');
  s.depthC.setVisible(false);
  updateRunHud(s);
  macawState(s, 'IDLE');
  if (won === 'boss') {
    st.phase = 'wait';
    s.time.delayedCall(550, () => overShow(s, true));
  } else if (st.casts <= 0) {
    st.phase = 'wait';
    s.time.delayedCall(500, () => overShow(s, false));
  } else {
    st.phase = 'dock';
    setPrompt(s, st.catches >= 4 ? 'B1 INICIAR CAZA FINAL · B2 TIENDA' : 'B1 LANZAR · B2 TIENDA');
  }
}

function hookTick(s, dt) {
  const st = s.state;
  s.hookS.setPosition(st.hook.x, st.hook.y);
  s.bead.setPosition(st.hook.x, st.hook.y - 12);
  lineDraw(s);

  if (st.crab && st.lineOn) {
    const tip = rodTipPos(s);
    const cx = tip.x + (st.hook.x - tip.x) * 0.62;
    const cy = tip.y + (st.hook.y - tip.y) * 0.62 + 14;
    s.crabS.setPosition(cx, cy).setAngle(Math.sin(st.t * 20) * 8);
    s.crabBarBg.setPosition(st.hook.x, st.hook.y + 26).setVisible(true);
    s.crabBar.setVisible(true);
    const fr = st.crab.t / st.crab.mx;
    s.crabBar.setPosition(st.hook.x - 21 + 42 * (1 - fr) / 2, st.hook.y + 26);
    s.crabBar.setDisplaySize(42 * fr, 3);
    s.crabBar.setFillStyle(fr < 0.35 ? TR : TY);
  } else if (st.crabWarn > 0 && st.lineOn) {
    s.warnT.setPosition(st.hook.x, st.hook.y - 30);
  }
}

function buildMinigameUi(s) {
  const c = s.add.container(0, 0).setDepth(16).setVisible(false);
  const TX = 646, Y0 = 252, Y1 = 548, MID = (Y0 + Y1) / 2;
  s.mgUI = { c, tx: TX, y0: Y0, y1: Y1 };

  c.add(s.add.rectangle(TX, MID, 70, Y1 - Y0 + 10, 0x0d1b2a, 0.9).setStrokeStyle(2, 0x3a5a7a, 1));
  s.mgUI.title = T(s, TX, Y0 - 30, '¡MANTÉN EL INDICADOR SOBRE EL PEZ!', 12, PAL.w);
  s.mgUI.hint = T(s, TX, Y1 + 26, 'TOCA B1 PARA SUBIR', 11, PAL.dim);
  c.add([s.mgUI.title, s.mgUI.hint]);

  s.mgUI.progBg = s.add.rectangle(TX - 62, MID, 16, Y1 - Y0, 0x12233a, 0.9).setStrokeStyle(1, 0x3a5a7a);
  s.mgUI.progF = s.add.rectangle(TX - 62, Y1, 10, 10, 0x70e000).setOrigin(0.5, 1);
  s.mgUI.escBg = s.add.rectangle(TX + 62, MID, 16, Y1 - Y0, 0x12233a, 0.9).setStrokeStyle(1, 0x3a5a7a);
  s.mgUI.escF = s.add.rectangle(TX + 62, Y0, 10, 10, TR).setOrigin(0.5, 0);
  c.add([s.mgUI.progBg, s.mgUI.progF, s.mgUI.escBg, s.mgUI.escF]);

  s.mgUI.zone = s.add.rectangle(TX, MID, 58, 90, 0x90e0a0, 0.3).setStrokeStyle(2, TY);
  s.mgUI.fishB = s.add.image(0, 0, 'fishT');
  s.mgUI.fishE = s.add.image(-12, -3, 'fishEye');
  s.mgUI.krak = s.add.graphics();
  s.mgUI.krak.fillStyle(0x51158a, 1); s.mgUI.krak.fillCircle(0, 0, 15);
  s.mgUI.krak.fillStyle(0xffd700, 1); s.mgUI.krak.fillCircle(-5, -2, 5);
  s.mgUI.krak.fillStyle(0x0a0a0a, 1); s.mgUI.krak.fillCircle(-4, -2, 2);
  s.mgUI.krak.lineStyle(2.5, 0x4a1670, 1);
  for (let t = -2; t <= 2; t++) { s.mgUI.krak.beginPath(); s.mgUI.krak.moveTo(t * 5, 11); s.mgUI.krak.lineTo(t * 5 + Math.sin(t) * 3, 25); s.mgUI.krak.strokePath(); }
  s.mgUI.krak.setVisible(false);
  s.mgUI.fishI = s.add.container(TX, MID, [s.mgUI.fishB, s.mgUI.fishE, s.mgUI.krak]);
  s.mgUI.tent = s.add.graphics().setDepth(17).setVisible(false);
  c.add([s.mgUI.zone, s.mgUI.fishI]);
}

function mgStart(s) {
  const st = s.state;
  const f = st.bite.f;
  const v = f.val;
  const boss = !!f.boss;
  const heat = boss ? 1 : 1 + st.catches * 0.09;
  const zone = (boss ? 58 : C(46 + f.body.scaleX * 30, 52, 88) / heat) * (1 + 0.09 * st.up.c);
  const zw = boss ? 64 : C(35 + f.body.scaleX * 22, 46, 64);
  const sp = (boss ? 245 : Math.min(190 + v * 0.55, 420) * heat) * (1 - 0.13 * st.up.c);
  const er = (boss ? 0.39 : (0.36 + v * 0.0008) * heat) * (1 - 0.12 * st.up.c);
  const mid = (s.mgUI.y0 + s.mgUI.y1) / 2;
  st.mg = { fy: mid, ftg: mid, ft: 0.3, fv: B(-90, 90), seed: Math.random() * 8, py: mid, pv: 0, prog: 0, esc: boss ? 0.1 : 0.22, sp, zone, zw, er, lastOv: false, boss, stage: 0, atk: 0, atkT: boss ? 4.5 : 0, slamT: 0 };
  const sc = boss ? 1.35 : C(f.body.scaleX * 0.82, 0.58, 1.18);
  const flip = f.boss || f.body.flipX;
  s.mgUI.fishB.setTint(f.tint).setScale(sc).setFlipX(flip);
  s.mgUI.fishE.setScale(sc).setPosition((flip ? 13 : -13) * sc, -3 * sc);
  s.mgUI.fishB.setVisible(!boss);
  s.mgUI.fishE.setVisible(!boss);
  s.mgUI.krak.setVisible(boss).setScale(boss ? 1.2 : 1);
  s.mgUI.zone.setDisplaySize(zw, zone);
  s.mgUI.title.setText(boss ? 'KRAKEN: 3 FASES DE FURIA' : '¡MANTÉN EL INDICADOR SOBRE EL PEZ!').setColor(boss ? PAL.y : PAL.w);
  s.mgUI.hint.setText(boss ? 'B1 SUBE · NO PIERDAS TENSIÓN' : 'TOCA B1 PARA SUBIR');
  s.mgUI.c.setVisible(true);
  macawState(s, 'BITE');
  st.phase = 'mg';
}

function mgHide(s) {
  s.mgUI.c.setVisible(false);
  s.mgUI.tent.setVisible(false);
}

function mgUpdate(s, dt) {
  const st = s.state;
  const m = st.mg;
  const ui = s.mgUI;

  if (once(s, ['P1_1', 'P2_1'])) {
    m.pv = m.atk > 0 ? 345 : -345;
    sfx(s, 'tap');
  }
  m.pv += 950 * dt;
  m.py += m.pv * dt;
  const yMin = ui.y0 + m.zone / 2 + 4;
  const yMax = ui.y1 - m.zone / 2 - 4;
  if (m.py < yMin) { m.py = yMin; m.pv = Math.max(0, m.pv); }
  if (m.py > yMax) { m.py = yMax; m.pv = Math.min(0, m.pv); }

  m.ft -= dt;
  if (m.boss) {
    if (m.ft <= 0) {
      m.ftg = B(ui.y0 + 22, ui.y1 - 22);
      m.ft = 0.48 + Math.random() * 0.8 - m.stage * 0.1;
    }
    const dy = m.ftg - m.fy;
    const rage = 1 + m.stage * 0.18;
    m.fy += C(dy, -m.sp * rage * dt, m.sp * rage * dt) + Math.sin(st.t * 10) * m.sp * 0.12 * dt;
    if (m.atk > 0) m.atk -= dt;
    m.atkT -= dt;
    if (m.atkT <= 0) {
      m.atkT = 5 + Math.random() * 2.5 - m.stage * 0.25;
      m.atk = 1.0;
      m.py = ui.y1 - m.zone / 2 - 4;
      m.pv = 0;
      m.slamT = 0.45;
      s.cameras.main.shake(220, 0.01);
      sfx(s, 'cut');
      popText(s, ui.tx, ui.y0 - 58, '¡TENTÁCULO!', PAL.r, 16);
    }
    if (m.slamT > 0) {
      m.slamT -= dt;
      const ph = 0.45 - Math.max(0, m.slamT);
      let p = ph < 0.15 ? ph / 0.15 : 1 - (ph - 0.15) / 0.3;
      p = C(p, 0, 1);
      const ox = ui.tx + 120, oy = ui.y0 - 10, ex = ui.tx, ey = m.py;
      const g = ui.tent;
      g.clear().setVisible(true);
      g.lineStyle(7, 0x4a1670, 1);
      g.beginPath();
      for (let i = 0; i <= 8; i++) {
        const t = (i / 8) * p;
        const wx = ox + (ex - ox) * t, wy = oy + (ey - oy) * t + Math.sin(st.t * 14 + t * 6) * 7 * t;
        if (i === 0) g.moveTo(wx, wy); else g.lineTo(wx, wy);
      }
      g.strokePath();
      const tx2 = ox + (ex - ox) * p, ty2 = oy + (ey - oy) * p + Math.sin(st.t * 14 + p * 6) * 7 * p;
      g.fillStyle(0x5a1d8a, 1); g.fillCircle(tx2, ty2, 7);
      g.fillStyle(0x7a2da0, 1); g.fillCircle(tx2, ty2, 3.5);
    } else ui.tent.setVisible(false);
  } else {
    if (m.ft <= 0) {
      m.fv += B(-m.sp, m.sp);
      m.ft = 0.18 + Math.random() * 0.38;
    }
    m.fv += Math.sin(st.t * 5.3 + m.seed) * m.sp * 0.9 * dt;
    m.fv = C(m.fv, -m.sp, m.sp);
    m.fy += m.fv * dt;
  }
  if (m.fy < ui.y0 + 14 || m.fy > ui.y1 - 14) {
    m.fy = C(m.fy, ui.y0 + 14, ui.y1 - 14);
    m.fv *= -0.82;
  }

  const ov = Math.abs(m.fy - m.py) < 12 + m.zone / 2;
  if (ov !== m.lastOv) {
    m.lastOv = ov;
    sfx(s, 'tick');
  }
  m.prog = C(m.prog + (ov ? (m.boss ? 0.22 : 0.23) : -0.1) * dt, 0, 1);
  m.esc = C(m.esc + (ov ? -0.5 : m.er) * dt, 0, 1);
  const a = s.audio;
  if (a && a.mmode) { a.mmode = 'tense'; a.mint = Math.max(60, 200 - m.esc * 130); }

  if (m.boss && m.prog >= (m.stage + 1) / 3 && m.stage < 2) {
    m.stage++;
    m.zone *= 0.9;
    ui.zone.setDisplaySize(m.zw, m.zone);
    m.ftg = m.fy < (ui.y0 + ui.y1) / 2 ? ui.y1 - 20 : ui.y0 + 20;
    m.ft = 0.18;
    s.cameras.main.shake(220, 0.009);
    popText(s, ui.tx, ui.y0 - 58, 'FURIA ' + (m.stage + 1) + '/3', PAL.r, 16);
    sfx(s, 'cut');
  }

  ui.zone.setPosition(ui.tx, m.py);
  ui.zone.setFillStyle(ov ? 0xa8f0b2 : 0x6a8f7a, ov ? 0.42 : 0.28);
  ui.fishI.setPosition(ui.tx, m.fy).setRotation(m.boss ? Math.sin(st.t * 8) * 0.15 : C(m.fv / 650, -0.32, 0.32));
  ui.progF.setDisplaySize(10, Math.max(4, (ui.y1 - ui.y0 - 4) * m.prog));
  ui.progF.setFillStyle(m.prog > 0.8 ? TY : 0x70e000);
  ui.escF.setDisplaySize(10, Math.max(4, (ui.y1 - ui.y0 - 4) * m.esc));

  s.mw.pose.rod = POSES.BITE.rod + (ov ? 0.1 + Math.sin(st.t * 18) * 0.09 : -0.04);

  if (m.prog >= 1) { caughtCatch(s); return; }
  if (m.esc >= 1) { failCatch(s); return; }
}

function buildShop(s) {
  const c = s.add.container(0, 0).setDepth(18).setVisible(false);
  s.shopUI = { c };
  c.add(s.add.rectangle(W / 2, H / 2, W, H, 0x0a1626, 0.78));
  c.add(s.add.rectangle(W / 2, 320, 490, 350, 0x10233a, 0.97).setStrokeStyle(3, TB));
  c.add(T(s, W / 2, 168, 'TIENDA', 30, PAL.y));
  s.shopUI.coinsT = T(s, W / 2, 202, '', 16, PAL.w);
  c.add(s.shopUI.coinsT);

  s.shopUI.rows = [];
  const keys = ['d', 'l', 'c'];
  for (let i = 0; i < 3; i++) {
    const y = 254 + i * 68;
    const u = UPGRADES[keys[i]];
    const row = {};
    row.selR = s.add.rectangle(W / 2, y, 440, 58, 0xffffff, 0.04).setStrokeStyle(2, TR).setVisible(false);
    row.nameT = T(s, W / 2 - 206, y - 8, u.n, 17, PAL.w, 0);
    row.descT = T(s, W / 2 - 206, y + 12, u.d, 11, PAL.dim, 0);
    row.pips = [];
    for (let j = 0; j < 3; j++) {
      const p = s.add.rectangle(W / 2 + 96 + j * 22, y, 15, 11, 0x38404d);
      row.pips.push(p);
    }
    row.priceT = T(s, W / 2 + 190, y, '', 17, PAL.y);
    c.add([row.selR, row.nameT, row.descT, ...row.pips, row.priceT]);
    s.shopUI.rows.push(row);
  }
  c.add(T(s, W / 2, 472, 'SUBE/BAJE ELIGE · B1 COMPRAR · B2 SALIR', 12, PAL.dim));
}

function shopRefresh(s) {
  const st = s.state;
  s.shopUI.coinsT.setText('MONEDAS: ' + st.coins);
  const keys = ['d', 'l', 'c'];
  keys.forEach((k, i) => {
    const row = s.shopUI.rows[i];
    const lvl = st.up[k];
    row.selR.setVisible(st.shop.i === i);
    row.pips.forEach((p, j) => p.setFillStyle(j < lvl ? TY : 0x38404d));
    row.priceT.setText(lvl >= 3 ? 'MÁX' : '' + UPGRADES[k].c[lvl]);
    row.priceT.setColor(lvl >= 3 ? PAL.dim : PAL.y);
  });
}

function shopOpen(s) {
  const st = s.state;
  st.phase = 'shop';
  st.shop.i = 0;
  setPrompt(s, '');
  shopRefresh(s);
  s.shopUI.c.setVisible(true);
  sfx(s, 'click');
}

function shopClose(s) {
  s.shopUI.c.setVisible(false);
  s.state.phase = 'dock';
  setPrompt(s, 'B1 LANZAR · B2 TIENDA');
}

function shopUpdate(s) {
  const st = s.state;
  if (once(s, ['P1_U', 'P2_U'])) { st.shop.i = (st.shop.i + 2) % 3; sfx(s, 'click'); shopRefresh(s); }
  if (once(s, ['P1_D', 'P2_D'])) { st.shop.i = (st.shop.i + 1) % 3; sfx(s, 'click'); shopRefresh(s); }
  if (once(s, ['P1_2', 'P2_2', 'START1', 'START2'])) { sfx(s, 'select'); shopClose(s); return; }
  if (once(s, ['P1_1', 'P2_1'])) {
    const keys = ['d', 'l', 'c'];
    const k = keys[st.shop.i];
    const lvl = st.up[k];
    if (lvl >= 3) { sfx(s, 'click'); return; }
    const cost = UPGRADES[k].c[lvl];
    const row = s.shopUI.rows[st.shop.i];
    if (st.coins >= cost) {
      st.coins -= cost;
      st.up[k] = lvl + 1;
      sfx(s, 'buy');
      burstFX(s, W / 2 + 190, 254 + st.shop.i * 68, TY, 7, 40);
      popText(s, W / 2, 254 + st.shop.i * 68 - 30, '¡NIVEL ' + (lvl + 1) + '!', PAL.y, 18);
      macawState(s, 'BUY');
      st.poseTimer = 0.9;
      updateCoinsHud(s);
      shopRefresh(s);
    } else {
      sfx(s, 'fail');
      s.tweens.add({
        targets: row.priceT, x: W / 2 + 184, duration: 50, yoyo: true, repeat: 3,
        onComplete: () => row.priceT.setX(W / 2 + 190),
      });
    }
  }
}

function buildMenu(s) {
  const c = s.add.container(0, 0).setDepth(15).setVisible(false);
  s.menuC = c;
  c.add(T(s, 252, 72, "PESCAO'", 100, PAL.y).setStroke('#13293d', 10));
  c.add(T(s, 252, 138, 'L A   G U A C A M A Y A   P E S C A D O R A', 13, PAL.w).setStroke('#13293d', 3));
  let x = 163;
  for (const [col, wd] of [[PAL.y, 74], [PAL.b, 48], [PAL.r, 48]]) {
    const r = s.add.rectangle(x + wd / 2, 160, wd, 7, tintOf(col));
    x += wd + 4;
    c.add(r);
    s.tweens.add({ targets: r, alpha: { from: 0.55, to: 1 }, duration: 900, yoyo: true, repeat: -1 });
  }
  const pressT = T(s, 252, 230, 'PULSA START', 20, PAL.w);
  c.add(pressT);
  s.tweens.add({ targets: pressT, alpha: { from: 0.2, to: 1 }, duration: 550, yoyo: true, repeat: -1 });
  c.add(T(s, 252, 266, '4 PECES → LOCALIZA AL KRAKEN → VENCE', 12, PAL.y).setStroke('#13293d', 2));
  c.add(T(s, 252, 292, 'MEJORES CAPTURAS', 13, PAL.y));
  s.menuList = T(s, 252, 316, '', 14, PAL.w, 0.5).setOrigin(0.5, 0);
  c.add(s.menuList);
  s.menuRec = T(s, 252, 442, '', 12, PAL.dim);
  c.add(s.menuRec);
  c.add(T(s, 252, 462, '¡CANGREJOS CORTAN LA LÍNEA! AGÍTATE', 11, PAL.r));
  c.add(T(s, 252, 486, 'W/S PROFUNDIDAD · A/D MOVER · B1 CAPTURAR · B2 TIENDA', 11, PAL.dim));
}

function refreshTexts(s) {
  const st = s.state;
  const list = st.scores.length
    ? st.scores.map((e, i) => (i + 1) + '. ' + e.n + '  ' + e.s).join('\n')
    : 'AÚN NO HAY RÉCORDS';
  s.menuList.setText(list);
  s.boardList.setText(list);
  s.menuRec.setText('PROFUNDIDAD MÁX: ' + st.records.d + ' m   ·   LEGENDARIOS: ' + st.records.l);
}

function showMenu(s, show) {
  s.menuC.setVisible(show);
  if (show) {
    s.state.phase = 'menu';
    s.hudC.setVisible(false);
    macawState(s, 'IDLE');
    refreshTexts(s);
  }
}

function buildGameOver(s) {
  const c = s.add.container(0, 0).setDepth(20).setVisible(false);
  s.overC = c;
  c.add(s.add.rectangle(W / 2, H / 2, W, H, 0x04070f, 0.86));
  s.overTitle = T(s, W / 2, 128, 'FIN DE LA PARTIDA', 34, PAL.r);
  c.add(s.overTitle);
  s.overStats = T(s, W / 2, 186, '', 15, PAL.w);
  c.add(s.overStats);

  s.entryTitle = T(s, W / 2, 250, '¡ENTRE LAS MEJORES! TUS INICIALES', 13, PAL.y);
  s.entryLetters = [];
  s.entrySel = s.add.rectangle(W / 2 - 44, 300, 42, 56, 0xffffff, 0.06).setStrokeStyle(2, TY);
  for (let i = 0; i < 3; i++) {
    const t = T(s, W / 2 - 44 + i * 44, 300, 'A', 38, PAL.w);
    s.entryLetters.push(t);
  }
  const entryHint = T(s, W / 2, 340, 'JOYSTICK CAMBIA · B1 CONFIRMA', 11, PAL.dim);
  c.add([s.entryTitle, s.entrySel, ...s.entryLetters, entryHint]);

  c.add(T(s, W / 2, 386, 'MEJORES CAPTURAS', 13, PAL.y));
  s.boardList = T(s, W / 2, 410, '', 14, PAL.w).setOrigin(0.5, 0);
  c.add(s.boardList);
  c.add(T(s, W / 2, H - 26, 'START PARA CONTINUAR', 12, PAL.dim));
}

function overShow(s, victory) {
  const st = s.state;
  st.phase = 'over';
  st.records.d = Math.max(st.records.d, st.runMax);
  saveRecords(s);
  s.hud.recT.setText('RÉCORD ' + st.records.d + ' m');

  s.overTitle.setText(victory ? '¡KRAKEN CAPTURADO!' : 'FIN DE LA PARTIDA').setColor(victory ? PAL.y : PAL.r);
  const lines = [
    (victory ? 'VICTORIA · ' : '') + 'MONEDAS: ' + st.coins,
    st.best ? 'MEJOR CAPTURA: ' + st.best.name + ' +' + st.best.val : 'MEJOR CAPTURA: —',
    'PROFUNDIDAD: ' + st.runMax + ' m' + (!victory && st.catches >= 4 ? ' · EL KRAKEN ESCAPÓ' : ''),
  ];
  s.overStats.setText(lines.join('\n'));

  const minScore = st.scores.length ? st.scores[st.scores.length - 1].s : 0;
  const qualify = st.coins > 0 && (st.scores.length < 5 || st.coins > minScore);
  st.entry = qualify ? { col: 0, ch: [0, 0, 0] } : null;
  s.entryTitle.setVisible(qualify);
  s.entrySel.setVisible(qualify);
  s.entryLetters.forEach((t) => t.setVisible(qualify));
  updateEntryLetters(s);
  refreshTexts(s);
  s.overC.setVisible(true);
  if (!qualify) sfx(s, victory ? 'legendary' : 'gameover');
}

function updateEntryLetters(s) {
  const st = s.state;
  if (!st.entry) return;
  st.entry.ch.forEach((v, i) => {
    s.entryLetters[i].setText(CHARSET[v]);
    s.entryLetters[i].setColor(i === st.entry.col ? PAL.y : PAL.w);
  });
  s.entrySel.setX(W / 2 - 44 + st.entry.col * 44);
}

function overUpdate(s) {
  const st = s.state;
  if (st.entry) {
    const e = st.entry;
    if (once(s, ['P1_U', 'P2_U'])) { e.ch[e.col] = (e.ch[e.col] + 35) % 36; sfx(s, 'click'); updateEntryLetters(s); }
    if (once(s, ['P1_D', 'P2_D'])) { e.ch[e.col] = (e.ch[e.col] + 1) % 36; sfx(s, 'click'); updateEntryLetters(s); }
    if (once(s, ['P1_L', 'P2_L'])) { e.col = (e.col + 2) % 3; sfx(s, 'click'); updateEntryLetters(s); }
    if (once(s, ['P1_R', 'P2_R'])) { e.col = (e.col + 1) % 3; sfx(s, 'click'); updateEntryLetters(s); }
    if (once(s, ['P1_1', 'P2_1', 'START1', 'START2'])) {
      sfx(s, 'select');
      const name = e.ch.map((v) => CHARSET[v]).join('');
      st.scores.push({ n: name, s: st.coins });
      st.scores.sort((a, b) => b.s - a.s);
      st.scores = st.scores.slice(0, 5);
      storageSet(KEY_SCORES, st.scores).catch(() => {});
      st.entry = null;
      s.entryTitle.setVisible(false);
      s.entrySel.setVisible(false);
      s.entryLetters.forEach((t) => t.setVisible(false));
      refreshTexts(s);
      sfx(s, 'buy');
    }
    return;
  }
  if (once(s, ['START1', 'START2', 'P1_1', 'P2_1'])) {
    sfx(s, 'click');
    s.overC.setVisible(false);
    showMenu(s, true);
  }
}

function buildPause(s) {
  const c = s.add.container(0, 0).setDepth(25).setVisible(false);
  s.pauseC = c;
  c.add(s.add.rectangle(W / 2, H / 2, W, H, 0x04070f, 0.6));
  c.add(T(s, W / 2, H / 2 - 16, 'PAUSA', 46, PAL.y));
  c.add(T(s, W / 2, H / 2 + 34, 'START PARA CONTINUAR', 14, PAL.dim));
}

function togglePause(s) {
  const st = s.state;
  st.paused = !st.paused;
  s.pauseC.setVisible(st.paused);
  if (st.paused) { s.tweens.pauseAll(); s.time.paused = true; }
  else { s.tweens.resumeAll(); s.time.paused = false; }
}

function ensureAudio(s) {
  if (s.audio) return;
  try {
    const ctx = s.sound.context;
    const out = ctx.createGain();
    out.gain.value = 0.5;
    out.connect(ctx.destination);
    const mus = ctx.createGain();
    mus.gain.value = 0.75;
    mus.connect(out);
    s.audio = { ctx, out, mus };
  } catch { s.audio = null; }
}

function tone(s, bus, type, f0, f1, dur, vol, delay) {
  const a = s.audio;
  if (!a) return;
  const t = a.ctx.currentTime + (delay || 0);
  const o = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(bus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function sfx(s, name) {
  ensureAudio(s);
  const a = s.audio;
  if (!a) return;
  const O = a.out;
  const tn = (t, f0, f1, d, v, dl) => tone(s, O, t, f0, f1, d, v, dl);
  try {
    switch (name) {
      case 'click': tn(SQ, 900, 600, 0.05, 0.06); break;
      case 'select': tn(SQ, 620, 1240, 0.1, 0.08); break;
      case 'cast': tn(SW, 180, 880, 0.2, 0.09); break;
      case 'splash':
        tn(SW, 420, 90, 0.3, 0.12);
        tn(TL, 300, 700, 0.12, 0.05, 0.03);
        break;
      case 'bite':
        tn(SQ, 880, 880, 0.07, 0.1);
        tn(SQ, 660, 660, 0.08, 0.1, 0.09);
        break;
      case 'tap': tn(SI, 640, 560, 0.04, 0.05); break;
      case 'tick': tn(SI, 1320, 1320, 0.035, 0.05); break;
      case 'reel': tn(SQ, 1500, 1100, 0.03, 0.04); break;
      case 'coin':
        tn(SQ, 988, 988, 0.06, 0.07);
        tn(SQ, 1319, 1319, 0.09, 0.07, 0.06);
        break;
      case 'catch':
        CN.forEach((f, i) => tn(TL, f, f, 0.1, 0.09, i * 0.08));
        break;
      case 'legendary':
        [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tn(TL, f, f, 0.12, 0.1, i * 0.09));
        tn(SI, 72, 40, 0.5, 0.18);
        break;
      case 'fail': tn(SW, 380, 110, 0.45, 0.11); break;
      case 'cut':
        tn(SQ, 1400, 300, 0.07, 0.14);
        tn(SQ, 1200, 240, 0.07, 0.12, 0.05);
        break;
      case 'shake': tn(TL, 480, 940, 0.08, 0.09); break;
      case 'crab':
        tn(SQ, 210, 190, 0.05, 0.1);
        tn(SQ, 210, 190, 0.05, 0.1, 0.08);
        break;
      case 'eel': tn(SW, 90, 420, 0.32, 0.07); break;
      case 'zap':
        tn(SQ, 1200, 90, 0.13, 0.12);
        tn(SW, 760, 180, 0.16, 0.07, 0.04);
        break;
      case 'buy':
        tn(SQ, 700, 700, 0.06, 0.08);
        tn(SQ, 1050, 1050, 0.1, 0.08, 0.07);
        break;
      case 'record':
        CN.forEach((f, i) => tn(TL, f, f, 0.11, 0.1, i * 0.1));
        break;
      case 'gameover':
        [330, 262, 196].forEach((f, i) => tn(TL, f, f, 0.22, 0.1, i * 0.24));
        break;
    }
  } catch {}
}

function startMusic(s) {
  ensureAudio(s);
  const a = s.audio;
  if (!a || a.music) return;
  a.music = true;
  a.mmode = 'trop';
  a.mstep = 0;
  a.mint = 190;
  try {
    const ctx = a.ctx;
    const pf = ctx.createBiquadFilter();
    pf.type = 'lowpass'; pf.frequency.value = 720; pf.Q.value = 0.8;
    const pg = ctx.createGain(); pg.gain.value = 0.06;
    pf.connect(pg); pg.connect(a.mus);
    for (const d of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = SW; o.frequency.value = 165; o.detune.value = d;
      o.connect(pf); o.start();
    }
    const perc = [1, 0, 0, 1, 0, 1, 0, 1];
    const bass = [131, 0, 0, 131, 98, 0, 110, 0];
    const mel = [392, 440, 0, 523, 0, 440, 494, 392];
    const harm = [0, 0, 587, 0, 659, 0, 0, 587];
    const tBass = [49, 0, 49, 0, 41, 0, 49, 0];
    const tMel = [0, 233, 0, 261, 0, 0, 311, 0];
    const mk = (type, f0, f1, dur, vol) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, ctx.currentTime);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), ctx.currentTime + dur);
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.connect(g); g.connect(a.mus);
      o.start(); o.stop(ctx.currentTime + dur + 0.02);
    };
    const step = () => {
      const i = a.mstep % 8;
      const tense = a.mmode === 'tense';
      const bn = tense ? tBass[i] : bass[i];
      if (bn) mk(SI, bn, bn, 0.32, 0.24);
      if (perc[i]) mk('square', 1900, 500, 0.05, 0.09);
      const mn = tense ? tMel[i] : mel[i];
      if (mn) mk(TL, mn, mn, 0.26, 0.16);
      if (!tense && harm[i]) mk(TL, harm[i], harm[i], 0.3, 0.08);
      a.mstep++;
      s.time.delayedCall(a.mint, step);
    };
    s.time.delayedCall(250, step);
  } catch {}
}
