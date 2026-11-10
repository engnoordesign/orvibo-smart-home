// Apartment architecture, materials, furniture and sky.
import * as THREE from 'three';
import { clamp } from './state.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

export const scene = new THREE.Scene();
export const colliders = [], occluders = [], interactables = [], updaters = [];
export const dirty = { sun: true, all: true };
export const mirrors = [], hideInPhoto = [];
function mirror(geo, x, y, z, rotY) {
  const m = new Reflector(geo, { textureWidth: 1024, textureHeight: 1024, clipBias: 0.003, color: 0xb8bcc0 });
  m.position.set(x, y, z); m.rotation.y = rotY; scene.add(m); mirrors.push(m); return m;
}
export const H = 2.8;

let seed = 1234567;
export const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

export function canvasTex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// ---------- procedural textures ----------
const woodTex = canvasTex(1024, 1024, (g, w, h) => {
  const rows = 10, ph = h / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rnd() * 300;
    while (x < w) {
      const pw = 330 + rnd() * 160;
      g.fillStyle = `hsl(${27 + rnd() * 7},${30 + rnd() * 10}%,${50 + rnd() * 11}%)`;
      g.fillRect(x, r * ph, pw, ph);
      for (let i = 0; i < 16; i++) {
        g.strokeStyle = `rgba(70,40,15,${0.03 + rnd() * 0.07})`; g.lineWidth = 0.6 + rnd() * 1.4;
        const y = r * ph + rnd() * ph; g.beginPath(); g.moveTo(x, y);
        g.bezierCurveTo(x + pw * 0.3, y + rnd() * 8 - 4, x + pw * 0.6, y + rnd() * 8 - 4, x + pw, y + rnd() * 6 - 3); g.stroke();
      }
      g.strokeStyle = 'rgba(40,24,10,.45)'; g.lineWidth = 1.5; g.strokeRect(x, r * ph, pw, ph);
      x += pw;
    }
  }
});
const tileTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#d9d5cc'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1400; i++) { g.fillStyle = `hsla(${20 + rnd() * 40},${10 + rnd() * 25}%,${35 + rnd() * 55}%,${0.25 + rnd() * 0.4})`; const s = 1 + rnd() * 5; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, s, s * (0.5 + rnd() * 0.6), rnd() * 3, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(90,85,78,.7)'; g.lineWidth = 3; g.strokeRect(0, 0, w, h); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
});
const stoneTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#7d7f80'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${rnd() > 0.5 ? 255 : 0},${rnd() > 0.5 ? 255 : 0},${rnd() > 0.5 ? 255 : 0},${rnd() * 0.035})`; g.fillRect(rnd() * w, rnd() * h, 30 + rnd() * 160, 10 + rnd() * 60); }
  g.strokeStyle = 'rgba(40,40,42,.8)'; g.lineWidth = 4; g.strokeRect(0, 0, w, h);
});
const marbleTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#efece6'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = `rgba(110,105,100,${0.08 + rnd() * 0.25})`; g.lineWidth = 0.5 + rnd() * 2.5;
    let x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += rnd() * 160 - 40; y += rnd() * 120 - 60; g.lineTo(x, y); } g.stroke();
  }
});
const fabricTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) { const v = 215 + rnd() * 40 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 2, 2); }
}, 3, 3);
const artTex = canvasTex(512, 384, (g, w, h) => {
  g.fillStyle = '#ece4d6'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#7d8f7a'; g.beginPath(); g.ellipse(170, 230, 150, 110, -0.3, 0, 7); g.fill();
  g.fillStyle = '#c4703f'; g.beginPath(); g.arc(350, 150, 86, 0, 7); g.fill();
  g.fillStyle = '#2f3438'; g.fillRect(60, 60, 180, 22); g.fillRect(300, 290, 150, 14);
  g.strokeStyle = '#c9a25a'; g.lineWidth = 6; g.beginPath(); g.arc(250, 200, 120, 0.4, 3.6); g.stroke();
  g.fillStyle = '#e9c9a0'; g.beginPath(); g.ellipse(390, 300, 60, 34, 0.5, 0, 7); g.fill();
});
const art2Tex = canvasTex(256, 384, (g, w, h) => {
  g.fillStyle = '#23282b'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9; i++) { g.strokeStyle = `rgba(201,162,90,${0.25 + i * 0.08})`; g.lineWidth = 2; g.beginPath(); g.arc(128, 400 - i * 6, 60 + i * 30, Math.PI, 0); g.stroke(); }
  g.fillStyle = '#e8dcc8'; g.beginPath(); g.arc(128, 110, 34, 0, 7); g.fill();
});

const std = (o) => new THREE.MeshStandardMaterial(o);
export const M = {
  wall: std({ color: 0xe6e0d4, roughness: 0.93 }),
  wallOut: std({ color: 0xbdb7ad, roughness: 0.95 }),
  ceil: std({ color: 0xf3f1ec, roughness: 0.95 }),
  white: std({ color: 0xf0eee9, roughness: 0.5 }),
  oak: std({ color: 0xb48d60, roughness: 0.6 }),
  walnut: std({ color: 0x5e4330, roughness: 0.55 }),
  char: std({ color: 0x2c2f33, roughness: 0.7 }),
  black: std({ color: 0x141416, roughness: 0.35, metalness: 0.4 }),
  brass: std({ color: 0xc9a25a, roughness: 0.3, metalness: 0.9 }),
  steel: std({ color: 0xb9bcc0, roughness: 0.32, metalness: 0.85 }),
  chrome: std({ color: 0xe6e8ea, roughness: 0.12, metalness: 1 }),
  greige: std({ color: 0xb5a995, roughness: 0.95, map: fabricTex }),
  cream: std({ color: 0xe6dfd0, roughness: 0.95, map: fabricTex }),
  sage: std({ color: 0x7d8f7a, roughness: 0.95, map: fabricTex }),
  terra: std({ color: 0xb8683f, roughness: 0.95, map: fabricTex }),
  sagePaint: std({ color: 0x5c6c5b, roughness: 0.9 }),
  marble: std({ color: 0xffffff, roughness: 0.22, map: marbleTex }),
  ceramic: std({ color: 0xf7f7f5, roughness: 0.15 }),
  glass: std({ color: 0xbfd8e0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false }),
  frosted: std({ color: 0xe6eef0, roughness: 0.6, transparent: true, opacity: 0.6 }),
  mirror: std({ color: 0xdfe6ea, roughness: 0.03, metalness: 1 }),
  plant: std({ color: 0x3f6b3c, roughness: 0.8 }),
  pot: std({ color: 0xd8d2c6, roughness: 0.8 }),
  frame: std({ color: 0x232427, roughness: 0.4, metalness: 0.6 }),
  plastic: std({ color: 0xf2f2f0, roughness: 0.4 }),
  dark: std({ color: 0x1c1d20, roughness: 0.5 }),
};

// ---------- primitives ----------
export function B(w, h, d, mat, x, y, z, o = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = o.cast !== false; m.receiveShadow = o.recv !== false;
  (o.parent || scene).add(m);
  if (o.collide) colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
  if (o.occ) occluders.push(m);
  return m;
}
export function C(r, h, mat, x, y, z, o = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(o.rt ?? r, r, h, o.seg || 24), mat);
  m.position.set(x, y, z); m.castShadow = o.cast !== false; m.receiveShadow = true;
  (o.parent || scene).add(m);
  if (o.collide) colliders.push({ x0: x - r, x1: x + r, z0: z - r, z1: z + r });
  return m;
}
function plane(w, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m;
}
function floor(x0, z0, x1, z1, tex, scale, extra = {}) {
  const t = tex.clone(); t.needsUpdate = true; t.repeat.set((x1 - x0) / scale, (z1 - z0) / scale);
  B(x1 - x0, 0.2, z1 - z0, std({ map: t, bumpMap: t, bumpScale: 1.2, roughness: 0.5, ...extra }), (x0 + x1) / 2, -0.1, (z0 + z1) / 2, { cast: false });
}

// Walls with openings. ops: [{a,b,y0,y1}] along the wall axis.
function wall(axis, at, s0, s1, ops = [], t = 0.16, mat = M.wall) {
  const seg = (a, b, y0, y1) => {
    if (b - a < 0.01 || y1 - y0 < 0.01) return;
    const o = { collide: y0 < 1.0, occ: true };
    if (axis === 'x') B(b - a, y1 - y0, t, mat, (a + b) / 2, (y0 + y1) / 2, at, o);
    else B(t, y1 - y0, b - a, mat, at, (y0 + y1) / 2, (a + b) / 2, o);
  };
  let cur = s0;
  for (const op of ops.slice().sort((p, q) => p.a - q.a)) {
    seg(cur, op.a, 0, H); seg(op.a, op.b, 0, op.y0); seg(op.a, op.b, op.y1, H); cur = op.b;
  }
  seg(cur, s1, 0, H);
}
function doorFrame(axis, at, a, b, top = 2.1) {
  const f = M.walnut, t = 0.2, w = 0.06;
  if (axis === 'x') { B(w, top, t, f, a + w / 2, top / 2, at); B(w, top, t, f, b - w / 2, top / 2, at); B(b - a, w, t, f, (a + b) / 2, top - w / 2, at); }
  else { B(t, top, w, f, at, top / 2, a + w / 2); B(t, top, w, f, at, top / 2, b - w / 2); B(t, w, b - a, f, at, top - w / 2, (a + b) / 2); }
}

// Window with one fixed and one sliding glass pane. Returns the sliding pane + its travel.
export function makeWindow(axis, at, a, b, y0, y1, glass = M.glass) {
  const f = M.frame, w = 0.05, t = 0.12, mid = (a + b) / 2, hh = y1 - y0, yc = (y0 + y1) / 2;
  const bar = (len, vertical, pos) => {
    if (axis === 'x') return vertical ? B(w, hh, t, f, pos, yc, at) : B(len, w, t, f, mid, pos, at);
    return vertical ? B(t, hh, w, f, at, yc, pos) : B(t, w, len, f, at, pos, mid);
  };
  bar(0, true, a + w / 2); bar(0, true, b - w / 2); bar(0, true, mid); bar(b - a, false, y0 + w / 2); bar(b - a, false, y1 - w / 2);
  const half = (b - a) / 2 - w;
  const mk = (c, off) => {
    const m = axis === 'x' ? B(half, hh - 2 * w, 0.012, glass, c, yc, at + off, { cast: false }) : B(0.012, hh - 2 * w, half, glass, at + off, yc, c, { cast: false });
    m.renderOrder = 2; return m;
  };
  mk((a + mid) / 2, -0.02);
  const slide = mk((mid + b) / 2, 0.02);
  return { slide, axis, travel: -(half + w * 0.4), base: axis === 'x' ? slide.position.x : slide.position.z, center: [axis === 'x' ? (mid + b) / 2 : at, yc, axis === 'x' ? at : (mid + b) / 2] };
}

// ---------- sky, sun, city ----------
export const sun = new THREE.DirectionalLight(0xfff1dd, 0);
export const hemi = new THREE.HemisphereLight(0xcfe2ff, 0x8a7f72, 0.1);
let cityMat;
const cNight = new THREE.Color(0x05070f), cDay = new THREE.Color(0x8fc4ee), cDusk = new THREE.Color(0xe58a58), cTmp = new THREE.Color();
export let dayFactor = 0;

export function updateSky(t) {
  const a = (t - 6) / 12.6 * Math.PI, elev = Math.sin(a);
  dayFactor = clamp(elev * 3.5 + 0.15, 0, 1);
  sun.position.set(6 + Math.cos(a) * 40, Math.max(elev, 0.03) * 34 + 1.5, 4.5 + 12);
  sun.intensity = clamp(elev * 4, 0, 1) * 3.4;
  sun.color.set(0xff9350).lerp(cTmp.set(0xfff3e2), clamp(elev * 2.2, 0, 1));
  const tw = clamp(1 - Math.abs(elev - 0.02) / 0.3, 0, 1);
  scene.background.copy(cNight).lerp(cDay, dayFactor).lerp(cDusk, tw * 0.55);
  hemi.intensity = 0.05 + 0.42 * dayFactor;
  scene.environmentIntensity = 0.05 + 0.28 * dayFactor;
  if (cityMat) cityMat.emissiveIntensity = 1.6 * (1 - dayFactor);
}

function buildSky() {
  scene.background = new THREE.Color(0x05070f);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 90 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04; sun.shadow.autoUpdate = false;
  sun.target.position.set(6, 0, 4.5); scene.add(sun, sun.target, hemi);
  // Distant skyline (the apartment is on a high floor).
  const winTex = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let y = 4; y < h; y += 8) for (let x = 4; x < w; x += 8) if (rnd() > 0.55) { g.fillStyle = rnd() > 0.3 ? '#ffd9a0' : '#bfe0ff'; g.fillRect(x, y, 4, 5); }
  });
  cityMat = std({ color: 0x1a1d24, roughness: 0.8, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 1.5 });
  for (let i = 0; i < 70; i++) {
    const ang = rnd() * Math.PI * 2, dist = 45 + rnd() * 90, w = 8 + rnd() * 14, hgt = 20 + rnd() * 75;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, w), cityMat);
    m.position.set(6 + Math.cos(ang) * dist, -40 + hgt / 2, 4.5 + Math.sin(ang) * dist); scene.add(m);
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), std({ color: 0x0c0e12, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -40; scene.add(ground);
}

// ---------- the apartment ----------
export function buildWorld() {
  buildSky();
  const O = 0.22; // outer wall thickness
  // floors
  floor(0, 4, 7, 9, woodTex, 2.6);
  floor(0, 0, 4, 4, tileTex, 1.2, { roughness: 0.35 });
  floor(4, 0, 8, 4, woodTex, 2.6);
  floor(7, 4, 12, 9, woodTex, 2.6);
  floor(8, 0, 12, 4, stoneTex, 1.0, { roughness: 0.4 });
  floor(3, 9, 9, 11.6, stoneTex, 1.3, { color: 0x9a9690 });
  // ceilings / roof
  B(12.4, 0.2, 9.4, M.ceil, 6, H + 0.1, 4.5);
  B(6.2, 0.2, 2.7, M.ceil, 6, H + 0.1, 10.35);
  // outer walls
  wall('x', 0, 0, 12, [{ a: 1.3, b: 3.1, y0: 1.05, y1: 2.2 }, { a: 5, b: 7, y0: 0.9, y1: 2.3 }, { a: 9.4, b: 10.4, y0: 1.6, y1: 2.25 }], O);
  wall('x', 9, 0, 12, [{ a: 5.2, b: 6.2, y0: 0, y1: 2.1 }], O);
  wall('z', 0, 0, 9, [{ a: 5, b: 8, y0: 0.3, y1: 2.4 }], O);
  wall('z', 12, 0, 9, [{ a: 5.5, b: 8, y0: 0.8, y1: 2.3 }], O);
  // inner walls
  wall('x', 4, 0, 12, [{ a: 0.8, b: 3.4, y0: 0, y1: 2.4 }, { a: 5, b: 5.9, y0: 0, y1: 2.1 }, { a: 10.9, b: 11.7, y0: 0, y1: 2.1 }]);
  wall('z', 4, 0, 4);
  wall('z', 8, 0, 4);
  wall('z', 7, 4, 9, [{ a: 4.6, b: 5.5, y0: 0, y1: 2.1 }]);
  doorFrame('x', 4, 5, 5.9); doorFrame('x', 4, 10.9, 11.7); doorFrame('z', 7, 4.6, 5.5); doorFrame('x', 9, 5.2, 6.2);
  // corridor shell
  wall('x', 11.6, 3, 9, [], O, M.wallOut); wall('z', 3, 9, 11.6, [], O, M.wallOut); wall('z', 9, 9, 11.6, [], O, M.wallOut);
  B(1.0, 0.02, 0.6, M.char, 5.7, 0.011, 9.5, { cast: false });           // doormat
  const sign = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#1d2024'; g.fillRect(0, 0, w, h); g.fillStyle = '#c9a25a'; g.font = '600 54px Georgia'; g.textAlign = 'center';
    g.fillText('DIGITAL HOME', w / 2, 96); g.fillStyle = '#e8e4da'; g.font = '26px Arial'; g.fillText('ORVIBO Smart Living Experience', w / 2, 146);
    g.fillStyle = '#8b9096'; g.font = '22px Arial'; g.fillText('Apartment  A · 1204', w / 2, 200);
  });
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.65), new THREE.MeshStandardMaterial({ map: sign, roughness: 0.4 }));
  sg.position.set(4.2, 1.6, 9.12); scene.add(sg);
  C(0.2, 0.45, M.pot, 8.3, 0.225, 9.6, { collide: true }); leafy(8.3, 0.45, 9.6, 0.9);
  // fixed windows (kitchen, bath)
  makeWindow('x', 0, 1.3, 3.1, 1.05, 2.2); makeWindow('x', 0, 9.4, 10.4, 1.6, 2.25, M.frosted);
  // balcony
  B(1.5, 0.2, 3.6, M.wallOut, -0.85, -0.1, 6.5); B(0.03, 1.0, 3.6, M.glass, -1.58, 0.55, 6.5, { cast: false });
  B(0.05, 0.05, 3.6, M.steel, -1.58, 1.07, 6.5); B(1.5, 1.0, 0.03, M.glass, -0.85, 0.55, 4.72, { cast: false }); B(1.5, 1.0, 0.03, M.glass, -0.85, 0.55, 8.28, { cast: false });
  C(0.22, 0.4, M.pot, -1.2, 0.2, 5.1); leafy(-1.2, 0.4, 5.1, 0.8);

  living(); kitchen(); bedroom(); master(); bath();
}

function leafy(x, y, z, s = 1) {
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 8, 6), M.plant);
    m.scale.set(0.6, 1.6 + rnd(), 0.25); m.position.set(x + (rnd() - 0.5) * 0.3 * s, y + 0.3 * s + rnd() * 0.5 * s, z + (rnd() - 0.5) * 0.3 * s);
    m.rotation.set(rnd() - 0.5, rnd() * 3, rnd() - 0.5); m.castShadow = true; scene.add(m);
  }
}
function rug(x, z, w, d, color) { B(w, 0.015, d, std({ color, roughness: 1, map: fabricTex }), x, 0.008, z, { cast: false }); }
function picture(tex, w, h, x, y, z, rotY) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; scene.add(g);
  B(w + 0.06, h + 0.06, 0.03, M.black, 0, 0, 0, { parent: g });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std({ map: tex, roughness: 0.8 })); p.position.z = 0.017; g.add(p);
}
function bed(x0, z0, w, d, headAxis, fabric) {
  // headAxis: '+x' or '+z' (side where the headboard sits)
  const cx = x0 + w / 2, cz = z0 + d / 2;
  B(w, 0.28, d, M.walnut, cx, 0.16, cz, { collide: true });
  B(w - 0.06, 0.2, d - 0.06, M.white, cx, 0.4, cz);
  if (headAxis === '+z') {
    B(w - 0.04, 0.08, d * 0.62, fabric, cx, 0.52, z0 + d * 0.33);
    B(w * 0.38, 0.12, 0.42, M.cream, cx - w * 0.24, 0.57, z0 + d - 0.32); B(w * 0.38, 0.12, 0.42, M.cream, cx + w * 0.24, 0.57, z0 + d - 0.32);
  } else {
    B(w * 0.62, 0.08, d - 0.04, fabric, x0 + w * 0.33, 0.52, cz);
    B(0.42, 0.12, d * 0.6, M.cream, x0 + w - 0.32, 0.57, cz);
  }
}

function living() {
  rug(2.75, 7.25, 3.4, 2.3, 0xcfc7b8);
  // TV feature wall (south)
  B(3.6, 2.5, 0.05, M.walnut, 2.6, 1.3, 8.86);
  for (let i = 0; i < 30; i++) B(0.035, 2.5, 0.035, M.oak, 0.86 + i * 0.12, 1.3, 8.82, { cast: false });
  B(2.4, 0.36, 0.42, M.char, 2.6, 0.38, 8.66, { collide: true }); B(2.44, 0.03, 0.44, M.oak, 2.6, 0.575, 8.66);
  // sofa (L-shaped, facing the TV)
  B(2.5, 0.4, 0.95, M.greige, 2.65, 0.22, 5.95, { collide: true }); B(2.5, 0.48, 0.24, M.greige, 2.65, 0.62, 5.58);
  B(0.95, 0.4, 0.85, M.greige, 1.87, 0.22, 6.8, { collide: true });
  B(0.2, 0.56, 0.95, M.greige, 3.98, 0.38, 5.95); B(0.2, 0.56, 1.8, M.greige, 1.32, 0.38, 6.35, { collide: true });
  B(0.5, 0.3, 0.14, M.sage, 2.1, 0.62, 5.78).rotation.x = -0.25; B(0.5, 0.3, 0.14, M.terra, 3.4, 0.62, 5.78).rotation.x = -0.25; B(0.45, 0.28, 0.14, M.cream, 2.75, 0.6, 5.78).rotation.x = -0.25;
  // coffee tables
  C(0.48, 0.04, M.marble, 3.15, 0.38, 7.3, { collide: true }); C(0.04, 0.36, M.brass, 3.15, 0.18, 7.3);
  C(0.3, 0.035, M.walnut, 3.7, 0.3, 7.75); C(0.03, 0.28, M.brass, 3.7, 0.14, 7.75);
  C(0.07, 0.16, M.pot, 3.05, 0.48, 7.2, { rt: 0.05 });
  // lounge chair by the window
  const ch = new THREE.Group(); ch.position.set(0.95, 0, 7.95); ch.rotation.y = 0.75; scene.add(ch);
  B(0.75, 0.3, 0.75, M.sage, 0, 0.3, 0, { parent: ch }); B(0.75, 0.5, 0.16, M.sage, 0, 0.62, -0.3, { parent: ch });
  B(0.1, 0.2, 0.75, M.sage, -0.36, 0.5, 0, { parent: ch }); B(0.1, 0.2, 0.75, M.sage, 0.36, 0.5, 0, { parent: ch });
  colliders.push({ x0: 0.5, x1: 1.4, z0: 7.5, z1: 8.4 });
  C(0.2, 0.5, M.pot, 0.5, 0.25, 4.5, { collide: true }); leafy(0.5, 0.5, 4.5, 1.3);
  // entry console + mirror (east wall)
  B(0.3, 0.05, 1.1, M.walnut, 6.76, 0.82, 6.9, { collide: true }); B(0.03, 0.8, 0.03, M.brass, 6.66, 0.4, 6.4); B(0.03, 0.8, 0.03, M.brass, 6.66, 0.4, 7.4);
  const mir = C(0.42, 0.02, M.mirror, 6.9, 1.55, 6.9, { seg: 48 }); mir.rotation.z = Math.PI / 2;
  const mr = C(0.45, 0.015, M.brass, 6.905, 1.55, 6.9, { seg: 48 }); mr.rotation.z = Math.PI / 2;
  mirror(new THREE.CircleGeometry(0.415, 48), 6.888, 1.55, 6.9, -Math.PI / 2);
  C(0.06, 0.22, M.terra, 6.76, 0.96, 6.6, { rt: 0.04 });
  picture(artTex, 1.15, 0.86, 4.2, 1.55, 4.1, 0);
  // shoe bench by the door
  B(0.9, 0.42, 0.36, M.oak, 4.55, 0.21, 8.7, { collide: true }); B(0.86, 0.06, 0.34, M.greige, 4.55, 0.45, 8.7);
}

function kitchen() {
  const cab = std({ color: 0x3c4a44, roughness: 0.6 });
  B(3.2, 0.88, 0.6, cab, 1.6, 0.44, 0.41, { collide: true }); B(3.24, 0.04, 0.64, M.marble, 1.6, 0.9, 0.42);
  B(0.6, 0.88, 2.7, cab, 0.41, 0.44, 2.05, { collide: true }); B(0.64, 0.04, 2.7, M.marble, 0.42, 0.9, 2.05);
  B(0.35, 0.75, 2.6, cab, 0.29, 1.85, 2.0); B(0.35, 0.75, 0.9, cab, 3.5, 1.9, 0.29);
  for (let i = 0; i < 5; i++) B(0.012, 0.6, 0.012, M.brass, 0.475, 1.82, 0.95 + i * 0.52, { cast: false });
  B(1.9, 0.5, 0.02, std({ color: 0xe9e4d8, roughness: 0.3 }), 0.13, 1.17, 2.0, { cast: false });
  B(0.6, 0.012, 0.5, M.black, 0.75, 0.925, 0.42, { cast: false });                    // hob
  B(0.6, 0.12, 0.48, M.steel, 0.75, 1.75, 0.36); B(0.26, 0.9, 0.26, M.steel, 0.75, 2.3, 0.26); // hood
  B(0.55, 0.02, 0.4, M.steel, 2.2, 0.915, 0.42, { cast: false }); C(0.015, 0.28, M.chrome, 2.2, 1.05, 0.2); B(0.03, 0.03, 0.16, M.chrome, 2.2, 1.19, 0.27);
  B(0.72, 2.0, 0.68, M.steel, 3.6, 1.0, 0.46, { collide: true }); B(0.02, 1.0, 0.03, M.black, 3.3, 1.2, 0.81);
  // island + stools
  B(1.5, 0.86, 0.7, M.walnut, 2.45, 0.43, 2.45, { collide: true }); B(1.62, 0.05, 0.82, M.marble, 2.45, 0.885, 2.45);
  for (const x of [2.1, 2.8]) { C(0.17, 0.05, M.greige, x, 0.66, 3.12, { collide: true }); C(0.02, 0.64, M.brass, x, 0.32, 3.12); C(0.14, 0.015, M.brass, x, 0.01, 3.12); }
  C(0.11, 0.07, M.pot, 2.9, 0.945, 2.4, { rt: 0.14 }); for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), i % 2 ? M.terra : std({ color: 0xd8a23a })); f.position.set(2.86 + i * 0.03, 1.0, 2.38 + (i % 2) * 0.05); scene.add(f); }
}

function bedroom() {
  rug(5.4, 2.3, 1.2, 1.8, 0xd9d2c4);
  bed(5.95, 1.5, 2.0, 1.4, '+x', M.sage);
  B(0.08, 1.0, 1.6, M.greige, 7.88, 0.6, 2.2);                                    // headboard
  B(0.42, 0.45, 0.42, M.oak, 7.7, 0.225, 1.2, { collide: true }); C(0.07, 0.2, M.pot, 7.7, 0.55, 1.2, { rt: 0.05 });
  B(1.5, 0.04, 0.6, M.oak, 4.95, 0.74, 0.45, { collide: true }); B(0.04, 0.72, 0.55, M.black, 4.25, 0.36, 0.45); B(0.04, 0.72, 0.55, M.black, 5.65, 0.36, 0.45);
  B(0.56, 0.34, 0.02, M.black, 4.85, 1.08, 0.24); B(0.04, 0.14, 0.04, M.black, 4.85, 0.83, 0.24); B(0.2, 0.01, 0.14, M.black, 4.85, 0.765, 0.26);
  B(0.42, 0.06, 0.42, M.terra, 4.95, 0.46, 1.0, { collide: true }); B(0.42, 0.42, 0.05, M.terra, 4.95, 0.7, 1.2); C(0.02, 0.44, M.black, 4.95, 0.22, 1.0);
  B(0.58, 2.3, 1.9, M.white, 4.38, 1.15, 2.6, { collide: true }); B(0.01, 2.2, 0.01, M.char, 4.675, 1.15, 2.6); B(0.02, 0.3, 0.02, M.brass, 4.69, 1.1, 2.5); B(0.02, 0.3, 0.02, M.brass, 4.69, 1.1, 2.7);
  picture(art2Tex, 0.5, 0.75, 6.9, 1.6, 3.9, Math.PI);
}

function master() {
  B(4.8, H, 0.03, M.sagePaint, 9.5, H / 2, 8.87, { cast: false });
  rug(9.6, 6.9, 3.2, 2.6, 0xd4ccbd);
  bed(8.7, 6.7, 1.8, 2.1, '+z', M.char);
  B(2.6, 1.05, 0.09, M.greige, 9.6, 0.82, 8.8); for (let i = 1; i < 5; i++) B(0.01, 1.0, 0.1, M.char, 8.3 + i * 0.52, 0.82, 8.8, { cast: false });
  for (const x of [8.3, 10.9]) { B(0.5, 0.4, 0.42, M.walnut, x, 0.22, 8.6, { collide: true }); B(0.52, 0.02, 0.44, M.marble, x, 0.43, 8.6); }
  C(0.06, 0.24, M.brass, 8.3, 0.56, 8.65, { rt: 0.02 });
  B(1.3, 0.4, 0.4, M.cream, 9.6, 0.22, 6.35, { collide: true }); B(0.03, 0.2, 0.03, M.brass, 9.0, 0.1, 6.35); B(0.03, 0.2, 0.03, M.brass, 10.2, 0.1, 6.35);
  B(0.6, 2.4, 2.5, M.white, 7.4, 1.2, 7.6, { collide: true }); for (let i = 1; i < 4; i++) B(0.01, 2.3, 0.012, M.char, 7.705, 1.2, 6.35 + i * 0.625);
  B(1.7, 0.42, 0.4, M.walnut, 9.3, 0.3, 4.3, { collide: true }); B(1.74, 0.02, 0.42, M.oak, 9.3, 0.52, 4.3);
  C(0.08, 0.26, M.pot, 8.65, 0.66, 4.3, { rt: 0.05 });
  C(0.18, 0.45, M.pot, 11.5, 0.225, 8.5, { collide: true }); leafy(11.5, 0.45, 8.5, 1.1);
}

function bath() {
  B(0.5, 0.4, 1.4, M.walnut, 8.34, 0.62, 1.6, { collide: true }); B(0.54, 0.04, 1.44, M.marble, 8.35, 0.84, 1.6);
  C(0.2, 0.1, M.ceramic, 8.38, 0.91, 1.6, { rt: 0.22 }); C(0.012, 0.2, M.chrome, 8.2, 0.96, 1.6); B(0.12, 0.02, 0.02, M.chrome, 8.26, 1.05, 1.6);
  const mi = B(0.012, 0.9, 1.2, M.mirror, 8.095, 1.55, 1.6, { cast: false }); mi.receiveShadow = false; mirror(new THREE.PlaneGeometry(1.2, 0.9), 8.103, 1.55, 1.6, Math.PI / 2);
  B(0.38, 0.4, 0.6, M.ceramic, 9.65, 0.2, 0.5, { collide: true }); B(0.4, 0.42, 0.18, M.ceramic, 9.65, 0.6, 0.22); B(0.36, 0.03, 0.42, M.ceramic, 9.65, 0.42, 0.56);
  B(0.85, 0.58, 1.9, M.ceramic, 11.46, 0.29, 1.3, { collide: true }); B(0.7, 0.02, 1.75, std({ color: 0x9fc3cc, roughness: 0.08 }), 11.46, 0.5, 1.3, { cast: false });
  C(0.012, 1.0, M.chrome, 11.86, 1.6, 0.5); B(0.3, 0.012, 0.012, M.chrome, 11.72, 2.1, 0.5); C(0.1, 0.02, M.chrome, 11.56, 2.08, 0.5);
  B(0.5, 0.03, 0.03, M.brass, 9.0, 1.1, 3.9); B(0.46, 0.5, 0.02, M.cream, 9.0, 0.86, 3.89);
  rug(9.2, 1.6, 0.6, 0.9, 0xcfd5d2);
}
