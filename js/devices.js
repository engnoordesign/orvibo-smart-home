// Every smart device in the apartment: 3D model, live state, hand interaction and animation.
import * as THREE from 'three';
import { scene, B, C, M, H, interactables, colliders, updaters, dirty, canvasTex, makeWindow, rnd, hideInPhoto, nearestWall } from './world.js';
export const bounceLights = [];
import { bus, home, set, dev, log, notify, fmtTime, clamp, ROOMS, roomAt, ofType, changed } from './state.js';
import { CATALOG, modelOf } from './catalog.js';
import { audio } from './audio.js';
import { runScene, unlockAttempt, pressSOS, music } from './sim.js';

const ROT = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 };
const glow = (color, i = 0) => new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: color, emissiveIntensity: i, roughness: 0.4 });
const tmpC = new THREE.Color();

function reg(id, type, room, name, state, extra = {}) {
  const cat = extra.cat || type;
  const d = { id, type, cat, room, name, state, model: CATALOG[cat]?.models[0].id, ...extra };
  home.devices[id] = d; lastReg = d; return d;
}
let lastReg = null;
// Wraps a builder so every 3D object it adds is remembered on the device (used to add / remove items from a project).
const tracked = fn => (...a) => { const n = scene.children.length; lastReg = null; const d = fn(...a) || lastReg; if (d) (d.objs ??= []).push(...scene.children.slice(n)); return d; };
function it(mesh, d, label, act) {
  mesh.userData.it = { dev: d, label, act: act || (() => bus.emit('inspect', d)) };
  interactables.push(mesh); return mesh;
}
function wallGroup(x, y, z, facing, s = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ROT[facing]; g.scale.setScalar(s); scene.add(g); return g;
}
const lb = (g, w, h, d, mat, x = 0, y = 0, z = 0) => B(w, h, d, mat, x, y, z, { parent: g, cast: false });
const used = d => bus.emit('used', d);

export function kelvin(k, out = new THREE.Color()) {
  k /= 100; let r, g, b;
  if (k <= 66) { r = 255; g = 99.47 * Math.log(k) - 161.12; b = k <= 19 ? 0 : 138.52 * Math.log(k - 10) - 305.04; }
  else { r = 329.7 * Math.pow(k - 60, -0.1332); g = 288.12 * Math.pow(k - 60, -0.0755); b = 255; }
  return out.setRGB(clamp(r, 0, 255) / 255, clamp(g, 0, 255) / 255, clamp(b, 0, 255) / 255, THREE.SRGBColorSpace);
}

// ---------------- lighting ----------------
function addLight(id, room, name, kind, cfg) {
  const d = reg(id, 'light', room, name, { on: false, bri: cfg.bri ?? 80, cct: cfg.cct ?? 3000, rgb: null, fade: 1.2 }, { cat: 'light_' + kind, kind, watts: cfg.watts ?? 36, pos: new THREE.Vector3(...cfg.pos) });
  const fmat = glow(0xffffff, 0), trim = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.5 });
  const ls = [];
  if (kind === 'down') {
    const p = new THREE.PointLight(0xffffff, 0, cfg.range ?? 0, 2); p.position.set(...cfg.pos);
    if (cfg.shadow !== false) { p.castShadow = true; p.shadow.mapSize.set(512, 512); p.shadow.bias = -0.006; p.shadow.camera.near = 0.15; p.shadow.camera.far = 9; p.shadow.autoUpdate = false; p.shadow.needsUpdate = true; d.shadowLight = p; }
    scene.add(p); ls.push([p, cfg.I ?? 15]);
    if (cfg.shadow !== false) { const b = new THREE.PointLight(0xffffff, 0, cfg.bounce ?? 2.9, 1.2); b.position.set(cfg.pos[0], 0.45, cfg.pos[2]); scene.add(b); ls.push([b, (cfg.I ?? 15) * 0.085, true]); bounceLights.push(b); }
    for (const [x, z, y] of cfg.fix) {
      it(C(0.07, 0.014, trim, x, (y ?? H) - 0.005, z, { cast: false }), d, () => `${name} — ${d.state.on ? d.state.bri + ' %' : 'off'}`, () => { set(id, { on: !d.state.on, fade: 0.8 }, 'hand'); audio.sfx('tap'); });
      C(0.048, 0.006, fmat, x, (y ?? H) - 0.014, z, { cast: false });
    }
  } else if (kind === 'spot') {
    for (const sp of cfg.spots) {
      const from = new THREE.Vector3(...sp.from), to = new THREE.Vector3(...sp.to), dist = from.distanceTo(to);
      const s = new THREE.SpotLight(0xffffff, 0, dist * 1.9, sp.angle ?? 0.5, 0.65, 2); s.position.copy(from); s.target.position.copy(to); scene.add(s, s.target);
      ls.push([s, cfg.I ?? 60]);
      const g = new THREE.Group(); g.position.copy(from); g.lookAt(to); scene.add(g);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.13, 16), trim); body.rotation.x = Math.PI / 2; g.add(body);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.01, 16), fmat); lens.rotation.x = Math.PI / 2; lens.position.z = 0.066; g.add(lens);
      if (sp.pendant) { C(0.004, H - from.y, M.black, from.x, (H + from.y) / 2, from.z, { cast: false }); body.scale.set(2.2, 1.2, 2.2); lens.scale.set(2.4, 1, 2.4); }
      else C(0.012, H - from.y, M.black, from.x, (H + from.y) / 2 + 0.02, from.z, { cast: false });
      it(body, d, () => `${name} — ${d.state.on ? d.state.bri + ' %' : 'off'}`);
    }
    if (cfg.track) { const [x0, z0, x1, z1] = cfg.track; B(Math.abs(x1 - x0) + 0.03, 0.025, Math.abs(z1 - z0) + 0.03, M.black, (x0 + x1) / 2, H - 0.013, (z0 + z1) / 2, { cast: false }); }
  } else {
    const p = new THREE.PointLight(0xffffff, 0, cfg.range ?? 3.4, 1.6); p.position.set(...cfg.pos); scene.add(p); ls.push([p, cfg.I ?? 4.5]);
    for (const [x0, z0, x1, z1, y] of cfg.segs) it(B(Math.abs(x1 - x0) + 0.025, 0.02, Math.abs(z1 - z0) + 0.025, fmat, (x0 + x1) / 2, y ?? 2.74, (z0 + z1) / 2, { cast: false }), d, () => `${name} — ${d.state.on ? d.state.bri + ' %' : 'off'}`);
  }
  d.cur = 0; d.col = kelvin(d.state.cct); d.power = 0; const phase = rnd();
  d.applyModel = m => { if (m.color != null) trim.color.set(m.color); };
  updaters.push((dt, t) => {
    const s = d.state, al = d.installed === false ? null : home.security.alarm; let tgt = s.on && d.installed !== false ? s.bri / 100 : 0, rate = dt / Math.max(0.05, performance.now() < (d.quick || 0) ? 0.15 : s.fade), cs = 4;
    if (s.rgb) tmpC.set(s.rgb); else kelvin(s.cct, tmpC);
    if (al && al.siren) {
      rate = 1; cs = 30;
      if (kind === 'strip') { tgt = Math.sin(t * 9) > 0 ? 1 : 0.04; tmpC.set(al.type === 'sos' ? 0xff9a00 : 0xff0a0a); } else { tgt = 1; kelvin(5600, tmpC); }
    } else if (home.fx.party && kind === 'strip' && s.on) { tmpC.setHSL((t * 0.22 + phase) % 1, 1, 0.5); tgt = 0.45 + 0.55 * audio.beat(); rate = 1; cs = 12; }
    d.cur += clamp(tgt - d.cur, -rate, rate); d.col.lerp(tmpC, Math.min(1, dt * cs));
    const k = Math.pow(d.cur, 1.7);
    for (const [l, I, warm] of ls) { l.intensity = I * k; l.color.copy(d.col); if (warm) { l.color.g *= 0.86; l.color.b *= 0.7; } }
    fmat.emissive.copy(d.col); fmat.emissiveIntensity = d.cur > 0.003 ? 0.5 + 6 * k : 0;
    d.power = d.watts * d.cur;
  });
  return d;
}
const cove = (x0, z0, x1, z1, i = 0.1) => [[x0 + i, z0 + i, x1 - i, z0 + i], [x0 + i, z1 - i, x1 - i, z1 - i], [x0 + i, z0 + i, x0 + i, z1 - i], [x1 - i, z0 + i, x1 - i, z1 - i]];

// ---------------- MixSwitch ----------------
function addSwitch(id, room, name, pos, facing, btns) {
  const d = reg(id, 'switch', room, name, {}, { btns, pos: new THREE.Vector3(...pos) });
  const g = wallGroup(...pos, facing, 1.3), plate = new THREE.MeshStandardMaterial({ color: 0x54575c, roughness: 0.25, metalness: 0.5 });
  lb(g, 0.09, 0.09, 0.012, plate, 0, 0, 0.006);
  const n = btns.length, w = 0.084 / n, leds = [];
  btns.forEach((b, i) => {
    const x = (i - (n - 1) / 2) * w;
    const key = lb(g, w - 0.004, 0.082, 0.006, new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.15, metalness: 0.6 }), x, 0, 0.014);
    const led = lb(g, 0.014, 0.003, 0.002, glow(0xffffff, 0.3), x, -0.028, 0.018); leds.push(led.material);
    it(key, d, () => `MixSwitch · ${b.label}`, () => { key.position.z = 0.011; setTimeout(() => key.position.z = 0.014, 120); audio.sfx('click'); press(b); used(d); });
  });
  const isOn = b => b.scene ? false : b.curtain ? dev(b.curtain).state.pos > 50 : b.dev ? dev(b.dev).state.on : (b.lights || [b.light]).some(l => dev(l).state.on);
  function press(b) {
    if (b.scene) return runScene(b.scene, 'MixSwitch');
    if (b.curtain) return set(b.curtain, { pos: dev(b.curtain).state.pos > 50 ? 0 : 100 }, 'hand');
    if (b.dev) return set(b.dev, { on: !dev(b.dev).state.on }, 'hand');
    const on = !isOn(b); (b.lights || [b.light]).forEach(l => set(l, { on, fade: 0.7 }, 'hand'));
  }
  d.applyModel = m => plate.color.set(m.color);
  updaters.push(() => btns.forEach((b, i) => { const on = isOn(b); leds[i].emissive.set(b.scene ? 0xc9a25a : on ? 0xffa040 : 0xffffff); leds[i].emissiveIntensity = b.scene ? 1.5 : on ? 3 : 0.35; }));
}

// ---------------- MixPad ----------------
function addMixPad(id, room, name, pos, facing, model) {
  const d = reg(id, 'mixpad', room, name, {}, { pos: new THREE.Vector3(...pos) }); if (model) d.model = model;
  const g = wallGroup(...pos, facing), bodyMat = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.2, metalness: 0.6 });
  const body = lb(g, 1, 1, 0.016, bodyMat, 0, 0, 0.008);
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 320; const c = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const smat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), smat); screen.position.z = 0.0175; g.add(screen);
  it(screen, d, () => `Use ${modelOf(d).name}`, () => { audio.sfx('tap'); bus.emit('openMixPad', d); used(d); });
  d.screenMat = smat; d.tex = tex;
  d.applyModel = m => { body.scale.set(m.w, m.h, 1); screen.scale.set(m.w - 0.016, m.h - 0.016, 1); bodyMat.color.set(m.color); };
  d.applyModel(modelOf(d));
  let acc = 9;
  updaters.push(dt => {
    acc += dt; if (acc < 1) return; acc = 0;
    const al = home.security.alarm, cl = home.climate[room], s = home.security;
    const gr = c.createLinearGradient(0, 0, 512, 320); gr.addColorStop(0, al ? '#5a0a0a' : '#0b1220'); gr.addColorStop(1, al ? '#b01818' : '#1b2a3c'); c.fillStyle = gr; c.fillRect(0, 0, 512, 320);
    c.fillStyle = '#fff'; c.textAlign = 'left';
    if (al) { c.font = 'bold 44px Arial'; c.fillText('⚠ ' + al.title, 24, 130, 464); c.font = '26px Arial'; c.fillText(al.where, 24, 180, 464); c.fillText('Tap to disarm', 24, 260); }
    else {
      c.font = '300 104px Arial'; c.fillText(fmtTime(), 24, 118); c.font = '24px Arial'; c.fillStyle = '#9fb3c8';
      c.fillText(`${ROOMS[room].name}   ${cl.temp.toFixed(1)}°C   ${cl.hum.toFixed(0)}%`, 28, 160);
      c.fillStyle = s.mode === 'disarmed' ? '#3ddc97' : '#ffb347'; c.fillText(s.mode === 'disarmed' ? '● Disarmed' : s.mode === 'home' ? '● Armed Home' : '● Armed Away', 28, 196);
      ['Home', 'Away', 'Movie', 'Sleep'].forEach((n, i) => { c.fillStyle = 'rgba(255,255,255,.1)'; c.beginPath(); c.roundRect(24 + i * 118, 222, 106, 76, 14); c.fill(); c.fillStyle = '#e8eef5'; c.font = '22px Arial'; c.textAlign = 'center'; c.fillText(n, 77 + i * 118, 268); });
      if (home.music.playing) { c.textAlign = 'right'; c.fillStyle = '#c9a25a'; c.font = '22px Arial'; c.fillText('♪ playing', 488, 50); }
    }
    tex.needsUpdate = true;
  });
}

// ---------------- curtains ----------------
const pleatTex = canvasTex(256, 64, (g, w, h) => { for (let x = 0; x < w; x++) { const v = 200 + 55 * Math.sin(x / w * Math.PI * 16) | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, h); } });
function addCurtain(id, room, name, axis, at, a, b, y0, y1) {
  const d = reg(id, 'curtain', room, name, { pos: 0 }, { pos3: new THREE.Vector3(axis === 'x' ? (a + b) / 2 : at, 1.4, axis === 'x' ? at : (a + b) / 2) });
  d.pos = d.pos3;
  const mat = new THREE.MeshStandardMaterial({ color: 0xcfc6b6, roughness: 0.95, map: pleatTex }), half = (b - a) / 2, hh = y1 - y0, panels = [];
  for (const side of [0, 1]) {
    const geo = axis === 'x' ? new THREE.BoxGeometry(half, hh, 0.05) : new THREE.BoxGeometry(0.05, hh, half);
    const off = (side ? -1 : 1) * half / 2; if (axis === 'x') geo.translate(off, 0, 0); else geo.translate(0, 0, off);
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true;
    const e = side ? b : a; m.position.set(axis === 'x' ? e : at, (y0 + y1) / 2, axis === 'x' ? at : e); scene.add(m); panels.push(m);
    it(m, d, () => `Curtain — ${d.state.pos > 50 ? 'open' : 'close'} (${d.state.pos} % closed)`, () => { set(id, { pos: d.state.pos > 50 ? 0 : 100 }, 'hand'); used(d); });
  }
  if (axis === 'x') B(b - a + 0.1, 0.03, 0.05, M.black, (a + b) / 2, y1 + 0.02, at, { cast: false }); else B(0.05, 0.03, b - a + 0.1, M.black, at, y1 + 0.02, (a + b) / 2, { cast: false });
  d.cur = 0; d.applyModel = m => mat.color.set(m.color);
  let moving = false;
  updaters.push(dt => {
    const tgt = d.state.pos / 100, dl = clamp(tgt - d.cur, -dt * 0.4, dt * 0.4);
    if (Math.abs(dl) > 1e-5) { d.cur += dl; dirty.sun = true; if (!moving) { moving = true; audio.sfx('hum'); } } else moving = false;
    const s = 0.14 + 0.86 * d.cur; panels.forEach(p => axis === 'x' ? p.scale.x = s : p.scale.z = s);
  });
}

// ---------------- windows / contact sensors ----------------
function addContact(id, room, name, pos, extra = {}) {
  const d = reg(id, 'contact', room, name, { open: false }, { ...extra, pos: new THREE.Vector3(...pos) });
  const m = B(0.03, 0.06, 0.03, M.plastic, ...pos, { cast: false }); B(0.02, 0.04, 0.02, M.plastic, pos[0] + (extra.dx ?? 0), pos[1], pos[2] + (extra.dz ?? 0.04), { cast: false });
  it(m, d, () => `${name} sensor — ${d.state.open ? 'OPEN' : 'closed'}`);
  return d;
}
function addWindow(id, room, name, win, extra) {
  const c = win.center, d = addContact(id, room, name, win.axis === 'x' ? [c[0], c[1] + 0.55, c[2] + 0.07] : [c[0] + (c[0] < 6 ? 0.07 : -0.07), c[1] + 0.9, c[2]], { ...extra, dx: 0, dz: 0.04 });
  d.cur = 0;
  it(win.slide, d, () => `${name} — ${d.state.open ? 'close' : 'open'}`, () => { set(id, { open: !d.state.open }, 'hand'); audio.sfx('door'); used(d); });
  updaters.push(dt => {
    const dl = clamp((d.state.open ? 1 : 0) - d.cur, -dt * 1.6, dt * 1.6); if (!dl) return; d.cur += dl; dirty.sun = true;
    if (win.axis === 'x') win.slide.position.x = win.base + win.travel * d.cur; else win.slide.position.z = win.base + win.travel * d.cur;
  });
  return d;
}

// ---------------- entry door + smart lock ----------------
function addEntry() {
  const d = reg('lock', 'lock', 'living', 'Entry Smart Lock', { locked: true, open: false }, { pos: new THREE.Vector3(6.05, 1.05, 9) });
  const ds = addContact('ds_entry', 'living', 'Entry door', [5.7, 2.14, 8.86], { cam: 'cam_entry', dz: 0, dx: 0.05 });
  const pivot = new THREE.Group(); pivot.position.set(5.26, 0, 9); scene.add(pivot);
  const leaf = B(0.88, 2.04, 0.05, new THREE.MeshStandardMaterial({ color: 0x3a2c22, roughness: 0.5 }), 0.44, 1.02, 0, { parent: pivot, occ: true });
  for (let i = 0; i < 3; i++) lb(pivot, 0.6, 0.012, 0.056, M.brass, 0.44, 0.5 + i * 0.5, 0);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2b2a2c, roughness: 0.25, metalness: 0.7 }), accMat = new THREE.MeshStandardMaterial({ color: 0xc9a25a, roughness: 0.3, metalness: 0.9 });
  const pad = glow(0x3aa0ff, 1.2), eye = glow(0x66ccff, 2);
  const out = new THREE.Group(); out.position.set(0.78, 1.05, 0.03); pivot.add(out);
  const ob = lb(out, 0.075, 0.38, 0.03, bodyMat, 0, 0.04, 0.012); lb(out, 0.05, 0.11, 0.004, pad, 0, 0.13, 0.029);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 8, 20), pad); ring.position.set(0, 0.0, 0.03); out.add(ring);
  const face = lb(out, 0.02, 0.02, 0.004, eye, 0, 0.21, 0.029);
  lb(out, 0.15, 0.022, 0.022, accMat, -0.05, -0.1, 0.045); lb(out, 0.022, 0.022, 0.04, accMat, 0.01, -0.1, 0.03);
  const inn = new THREE.Group(); inn.position.set(0.78, 1.05, -0.03); pivot.add(inn);
  lb(inn, 0.07, 0.3, 0.028, bodyMat, 0, 0.02, -0.012); lb(inn, 0.15, 0.022, 0.022, accMat, -0.05, -0.06, -0.045); lb(inn, 0.022, 0.022, 0.04, accMat, 0.01, -0.06, -0.03);
  const col = { x0: 5.2, x1: 6.2, z0: 8.94, z1: 9.06, on: true }; colliders.push(col);
  const s = d.state;
  const label = () => { const outside = home.player.z > 9; return s.open ? 'Close door' : !s.locked ? 'Open door' : outside ? `Unlock — ${modelOf(d).name}` : 'Open door (inside handle)'; };
  const act = () => {
    used(d);
    if (s.open) return set('lock', { open: false }, 'hand');
    if (!s.locked) return set('lock', { open: true }, 'hand');
    if (home.player.z > 9) bus.emit('openLockUI'); else unlockAttempt('inside', true, 'inside handle');
  };
  [leaf, ob, ...inn.children].forEach(m => it(m, d, label, act));
  d.applyModel = m => { bodyMat.color.set(m.color); accMat.color.set(m.accent); ob.scale.y = m.tall; face.visible = !!m.face; };
  let flash = 0, flashCol = 0x3aa0ff, openT = 0, lockT = 0;
  bus.on('unlock', () => { flash = 1.5; flashCol = 0x30ff80; }); bus.on('lockfail', () => { flash = 1; flashCol = 0xff3030; });
  d.cur = 0;
  updaters.push(dt => {
    if (s.locked && s.open && !s.forced) s.open = false;
    const before = d.cur; d.cur += clamp((s.open ? 1.72 : 0) - d.cur, -dt * 2.0, dt * 2.0); pivot.rotation.y = d.cur; col.on = d.cur < 1.0;
    if (d.cur !== before) { dirty.sun = true; dirty.living = true; if (d.cur === 0) { audio.sfx('door'); s.forced = false; } }
    const isOpen = d.cur > 0.06; if (isOpen !== ds.state.open) set('ds_entry', { open: isOpen }, 'sensor');
    if (s.open && d.cur >= 1.71) {
      openT += dt; const p = home.player, near = Math.abs(p.z - 9) < 1.4 && p.x > 4.5 && p.x < 6.9;
      if (openT > 4 && !near && !home.security.alarm && !d.hold) set('lock', { open: false }, 'auto');
    } else openT = 0;
    if (!s.open && d.cur === 0 && !s.locked && !home.security.alarm) { lockT += dt; if (lockT > 2.5) { set('lock', { locked: true }, 'auto'); audio.sfx('motor'); log('Door auto-locked'); } } else lockT = 0;
    flash = Math.max(0, flash - dt);
    pad.emissive.set(flash > 0 ? flashCol : home.security.lockFreeze > 0 ? 0xff3030 : 0x3aa0ff); pad.emissiveIntensity = flash > 0 ? 4 : 1.2;
  });
  return d;
}

// ---------------- sensors ----------------
function addPresence(room, x, z, id = 'pr_' + room, name = 'Presence sensor', model, y = H) {
  const H = y, d = reg(id, 'presence', room, name, { present: false }, { pos: new THREE.Vector3(x, H, z) }); if (model) d.model = model;
  const led = glow(0x30a0ff, 0.6);
  it(C(0.05, 0.022, M.plastic, x, H - 0.011, z, { cast: false }), d, () => `${name} — ${d.state.present ? 'occupied' : 'vacant'}`);
  C(0.012, 0.006, led, x, H - 0.025, z, { cast: false });
  updaters.push(() => { led.emissive.set(d.state.present ? 0x30ff70 : 0x3070ff); led.emissiveIntensity = d.state.present ? 3 : 0.5; });
}
function addClimate(room, pos, facing, id = 'th_' + room) {
  const d = reg(id, 'climate', room, 'Temp & humidity sensor', { temp: 0, hum: 0 }, { pos: new THREE.Vector3(...pos) });
  const g = wallGroup(...pos, facing); const m = lb(g, 0.065, 0.065, 0.018, M.plastic, 0, 0, 0.009); lb(g, 0.04, 0.025, 0.002, M.dark, 0, 0.008, 0.019);
  it(m, d, () => `Temp & humidity — ${d.state.temp.toFixed(1)} °C · ${d.state.hum.toFixed(0)} %`);
}
function addSOS(id, room, pos, facing) {
  const d = reg(id, 'sos', room, 'Emergency button', {}, { pos: new THREE.Vector3(...pos) });
  const g = wallGroup(...pos, facing, 1.2); lb(g, 0.08, 0.08, 0.012, M.plastic, 0, 0, 0.006);
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.014, 20), new THREE.MeshStandardMaterial({ color: 0xd61f1f, emissive: 0xff2020, emissiveIntensity: 0.5, roughness: 0.4 }));
  btn.rotation.x = Math.PI / 2; btn.position.z = 0.018; g.add(btn);
  it(btn, d, () => 'Emergency button — press for SOS', () => { pressSOS(id); used(d); });
}
function addHazard(id, room, name, pos, kind) {
  const d = reg(id, 'hazard', room, name, { alarm: false }, { pos: new THREE.Vector3(...pos), kind });
  const led = glow(0x30ff70, 0.6); let m;
  if (kind === 'smoke') { m = C(0.065, 0.03, M.plastic, pos[0], H - 0.015, pos[2], { cast: false }); C(0.01, 0.005, led, pos[0] + 0.03, H - 0.032, pos[2], { cast: false }); }
  else if (kind === 'gas') { m = B(0.07, 0.1, 0.03, M.plastic, ...pos, { cast: false }); B(0.012, 0.012, 0.004, led, pos[0], pos[1] + 0.03, pos[2] + 0.016, { cast: false }); }
  else { m = C(0.035, 0.02, M.plastic, pos[0], 0.01, pos[2], { cast: false }); C(0.008, 0.004, led, pos[0], 0.022, pos[2], { cast: false }); }
  it(m, d, () => `${name} — ${d.state.alarm ? 'ALARM' : 'normal'}`);
  updaters.push((dt, t) => { led.emissive.set(d.state.alarm ? 0xff2020 : 0x30ff70); led.emissiveIntensity = d.state.alarm ? (Math.sin(t * 12) > 0 ? 5 : 0.2) : 0.6; });
}
function addRelay(id, room, name, pos, on, shape) {
  const d = reg(id, 'relay', room, name, { on }, { pos: new THREE.Vector3(...pos) });
  const led = glow(0x30ff70, 1); let blades;
  if (shape === 'fan') {
    const m = B(0.3, 0.02, 0.3, M.plastic, pos[0], H - 0.01, pos[2], { cast: false });
    blades = new THREE.Group(); blades.position.set(pos[0], H - 0.024, pos[2]); scene.add(blades);
    for (let i = 0; i < 4; i++) { const b = lb(blades, 0.11, 0.004, 0.04, M.dark, 0.06, 0, 0); b.position.set(Math.cos(i * 1.57) * 0.06, 0, Math.sin(i * 1.57) * 0.06); b.rotation.y = -i * 1.57; }
    it(m, d, () => `${name} — ${d.state.on ? 'running' : 'off'}`, () => { set(id, { on: !d.state.on }, 'hand'); d.auto = false; audio.sfx('click'); });
  } else {
    const m = B(0.07, 0.07, 0.05, M.steel, ...pos, { cast: false }); B(0.012, 0.012, 0.004, led, pos[0], pos[1] + 0.045, pos[2], { cast: false });
    it(m, d, () => `${name} — ${d.state.on ? 'open' : 'CLOSED'}`, () => { set(id, { on: !d.state.on }, 'hand'); audio.sfx('click'); });
  }
  let sp = 0;
  updaters.push(dt => { led.emissive.set(d.state.on ? 0x30ff70 : 0xff2020); if (blades) { sp += ((d.state.on ? 14 : 0) - sp) * dt * 2; blades.rotation.y += sp * dt; } });
}

// ---------------- cameras ----------------
function addCamera(id, room, name, pos, look, outdoor) {
  const d = reg(id, 'camera', room, name, { on: true, rec: false }, { pos: new THREE.Vector3(...pos) });
  if (outdoor) d.model = 'BLT';
  const cam = new THREE.PerspectiveCamera(82, 16 / 9, 0.1, 250); cam.position.set(...pos); cam.lookAt(...look); cam.layers.enable(1); scene.add(cam); d.camera = cam;
  const g = new THREE.Group(); g.position.set(...pos); g.lookAt(...look); scene.add(g);
  const mat = new THREE.MeshStandardMaterial({ color: 0xf0f0ee, roughness: 0.35 }), led = glow(0x30a0ff, 1.5);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), mat); ball.position.z = -0.07; g.add(ball);
  const tube = lb(g, 0.07, 0.07, 0.16, mat, 0, 0, -0.09);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.02, 16), M.black); lens.rotation.x = Math.PI / 2; lens.position.z = -0.012; g.add(lens);
  const l = lb(g, 0.008, 0.008, 0.004, led, 0.03, 0.03, -0.012);
  [ball, tube].forEach(m => it(m, d, () => `${name} camera — ${!d.state.on ? 'privacy mode' : d.state.rec ? 'RECORDING' : 'live'}`, () => bus.emit('openCCTV')));
  d.applyModel = m => { mat.color.set(m.color); tube.visible = m.id === 'BLT'; ball.visible = m.id !== 'BLT'; };
  d.applyModel(modelOf(d));
  updaters.push((dt, t) => { led.emissive.set(d.state.rec ? 0xff2020 : 0x30a0ff); led.emissiveIntensity = !d.state.on ? 0 : d.state.rec ? (Math.sin(t * 8) > 0 ? 5 : 0.5) : 1.5; });
}

// ---------------- audio zones ----------------
function addSpeaker(id, room, name, pos, artist, extra = []) {
  const d = reg(id, 'speaker', room, name, { on: false, vol: 60 }, { cat: artist ? 'artist' : 'speaker', master: !!artist, pos: new THREE.Vector3(...pos) });
  const ring = glow(0xc9a25a, 0), mat = new THREE.MeshStandardMaterial({ color: artist ? 0x5a3f2c : 0xf2f0ea, roughness: 0.5 });
  const label = () => `${name} — ${d.state.on ? (home.music.playing ? 'playing' : 'zone on') : 'zone off'}`;
  const act = () => { set(id, { on: !d.state.on }, 'hand'); if (d.state.on && !home.music.playing) music(true); audio.sfx('tap'); used(d); };
  if (artist) {
    it(B(0.36, 0.2, 0.2, mat, ...pos), d, label, act); B(0.3, 0.14, 0.01, M.char, pos[0], pos[1], pos[2] - 0.101, { cast: false }); B(0.3, 0.008, 0.012, ring, pos[0], pos[1] - 0.085, pos[2] - 0.101, { cast: false });
  } else for (const dx of (d.pair = [[0, 0], ...extra])) {
    it(C(0.11, 0.012, mat, pos[0] + dx[0], H - 0.006, pos[2] + dx[1], { cast: false }), d, label, act);
    C(0.09, 0.004, M.dark, pos[0] + dx[0], H - 0.014, pos[2] + dx[1], { cast: false });
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.005, 6, 32), ring); r.rotation.x = Math.PI / 2; r.position.set(pos[0] + dx[0], H - 0.014, pos[2] + dx[1]); scene.add(r);
  }
  d.applyModel = m => mat.color.set(m.color);
  updaters.push(() => { ring.emissiveIntensity = d.state.on && home.music.playing ? 1 + 3 * audio.beat() : d.state.on ? 0.6 : 0; });
}

// ---------------- TV ----------------
const CH = ['News 24', 'Planet Earth', 'Sports Live', 'Cinema', '📷 Security cameras'];
export const TV_CAM = 4;
function drawTV(g, w, h, ch, t) {
  if (ch === 0) {
    g.fillStyle = '#12305a'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d4a8a'; g.fillRect(0, 0, w, h * 0.72);
    g.fillStyle = '#e8c9a8'; g.beginPath(); g.arc(w * 0.3, h * 0.36 + Math.sin(t * 2) * 2, 34, 0, 7); g.fill(); g.fillStyle = '#26303f'; g.fillRect(w * 0.3 - 52, h * 0.47, 104, 80);
    g.fillStyle = '#fff'; g.font = 'bold 26px Arial'; g.fillText('SMART HOMES ON THE RISE', w * 0.48, h * 0.34, w * 0.48); g.font = '18px Arial'; g.fillText('Automation market grows again', w * 0.48, h * 0.44);
    g.fillStyle = '#c21d1d'; g.fillRect(0, h * 0.78, w, h * 0.12); g.fillStyle = '#fff'; g.font = '20px Arial'; g.fillText('BREAKING  ·  Digital Home brings ORVIBO whole-home intelligence  ·  Weather: clear skies tonight  ·', w - (t * 90) % (w * 2.2), h * 0.86);
  } else if (ch === 1) {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffb36b'); gr.addColorStop(0.6, '#f0705a'); gr.addColorStop(1, '#3a2a4a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffe9b0'; g.beginPath(); g.arc(w * 0.7, h * 0.42, 40, 0, 7); g.fill();
    for (let k = 0; k < 3; k++) { g.fillStyle = ['#5a3d5c', '#3d2c48', '#241a30'][k]; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 16) g.lineTo(x, h * (0.62 + k * 0.1) + Math.sin(x * 0.012 * (k + 1) + t * 0.3 * (k + 1)) * 26); g.lineTo(w, h); g.fill(); }
  } else if (ch === 2) {
    g.fillStyle = '#1f7a3a'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3; g.strokeRect(20, 20, w - 40, h - 40); g.beginPath(); g.moveTo(w / 2, 20); g.lineTo(w / 2, h - 20); g.stroke(); g.beginPath(); g.arc(w / 2, h / 2, 46, 0, 7); g.stroke();
    for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? '#e33' : '#39f'; g.beginPath(); g.arc(w / 2 + Math.sin(t * 0.7 + i * 1.9) * w * 0.36, h / 2 + Math.cos(t * 0.9 + i * 2.7) * h * 0.32, 7, 0, 7); g.fill(); }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 2 + Math.sin(t * 1.3) * w * 0.3, h / 2 + Math.cos(t * 1.7) * h * 0.25, 4, 0, 7); g.fill();
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(24, 24, 150, 30); g.fillStyle = '#fff'; g.font = 'bold 18px Arial'; g.fillText('HOME 2 – 1 AWAY', 32, 45);
  } else {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h); const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#0a1a3a'); gr.addColorStop(1, '#3a0a2a'); g.fillStyle = gr; g.fillRect(0, h * 0.12, w, h * 0.76);
    for (let i = 0; i < 26; i++) { const x = (i * 97 + t * (20 + i * 3)) % w, y = h * 0.2 + ((i * 53) % (h * 0.6)); g.fillStyle = `hsla(${(i * 40 + t * 20) % 360},90%,65%,.55)`; g.beginPath(); g.arc(x, y, 6 + (i % 5) * 5, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,.85)'; g.font = 'italic 22px Georgia'; g.fillText('“The city never sleeps…”', w * 0.3, h * 0.82);
  }
}
function addTV(id, room, name, pos, facing, w) {
  const d = reg(id, 'tv', room, name, { on: false, ch: 0, vol: 30 }, { pos: new THREE.Vector3(...pos), channels: CH });
  const g = wallGroup(...pos, facing), hgt = w * 9 / 16;
  const body = lb(g, w + 0.03, hgt + 0.03, 0.03, M.black, 0, 0, 0.015);
  const cv = document.createElement('canvas'); cv.width = 480; cv.height = 270; const c = cv.getContext('2d'); c.textBaseline = 'middle';
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ color: 0x050505, toneMapped: false });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), mat); scr.position.z = 0.031; g.add(scr);
  const p = new THREE.PointLight(0x88aaff, 0, 4.5, 2); p.position.set(0, 0, 0.6); g.add(p);
  const act = () => { set(id, { on: !d.state.on }, 'hand'); audio.sfx('ir'); used(d); };
  it(scr, d, () => `${name} — ${d.state.on ? CH[d.state.ch] + ' (turn off)' : 'turn on'}`, act); it(body, d, () => name, act);
  let acc = 0, was = false;
  updaters.push((dt, t) => {
    if (!d.state.on) { if (was) { mat.map = null; mat.color.set(0x050505); mat.needsUpdate = true; p.intensity = 0; was = false; } return; }
    // channel 4 shows the live camera wall rendered by the main loop (home.camTex)
    const want = d.state.ch === TV_CAM && home.camTex ? home.camTex : tex;
    if (!was || mat.map !== want) { mat.map = want; mat.color.set(0xffffff); mat.needsUpdate = true; was = true; }
    if (want !== tex) { p.intensity = 1.2; p.color.set(0xbfd0ff); return; }
    acc += dt; if (acc < 0.08) return; acc = 0; drawTV(c, 480, 270, d.state.ch, t); tex.needsUpdate = true;
    p.intensity = 1.6 + Math.sin(t * 7) * 0.3 + Math.sin(t * 13) * 0.2; p.color.set([0x7799ff, 0xffa070, 0x70ff90, 0xaa80ff][d.state.ch] || 0xbfd0ff);
  });
}

// ---------------- air-conditioning ----------------
function addAC(id, room, name, pos, facing) {
  const d = reg(id, 'ac', room, name, { on: false, mode: 'cool', set: 24, fan: 2 }, { pos: new THREE.Vector3(...pos) });
  const g = wallGroup(...pos, facing); const body = lb(g, 0.95, 0.27, 0.2, M.plastic, 0, 0, 0.1); lb(g, 0.9, 0.05, 0.02, M.dark, 0, -0.1, 0.19);
  const flap = new THREE.Group(); flap.position.set(0, -0.135, 0.18); g.add(flap); lb(flap, 0.88, 0.008, 0.08, M.plastic, 0, 0, 0.04);
  const led = glow(0x30d0ff, 0); lb(g, 0.05, 0.012, 0.004, led, 0.36, 0.02, 0.202);
  const N = 70, geo = new THREE.BufferGeometry(), arr = new Float32Array(N * 3), life = new Float32Array(N);
  for (let i = 0; i < N; i++) life[i] = rnd();
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const pm = new THREE.PointsMaterial({ color: 0x9fdcff, size: 0.014, transparent: true, opacity: 0, depthWrite: false });
  const pts = new THREE.Points(geo, pm); pts.frustumCulled = false; g.add(pts); hideInPhoto.push(pts);
  it(body, d, () => `${name} — ${d.state.on ? `${d.state.mode} ${d.state.set} °C${d.paused ? ' (paused: window open)' : ''}` : 'off'}`, () => { set(id, { on: !d.state.on }, 'hand'); audio.sfx('beep'); used(d); });
  let open = 0;
  updaters.push(dt => {
    const run = d.state.on && !d.paused; open += clamp((run ? 1 : 0) - open, -dt, dt); flap.rotation.x = open * 0.9;
    const col = d.state.mode === 'heat' ? 0xff9050 : d.state.mode === 'fan' ? 0xffffff : 0x70d0ff;
    led.emissive.set(d.paused ? 0xffb030 : col); led.emissiveIntensity = d.state.on ? 3 : 0; pm.color.set(col); pm.opacity = open * 0.4;
    if (open <= 0) return; const sp = 0.4 + d.state.fan * 0.35;
    for (let i = 0; i < N; i++) {
      life[i] += dt * sp * 0.5; if (life[i] > 1) life[i] = 0; const l = life[i], sx = ((i * 37) % 100) / 100 - 0.5;
      arr[i * 3] = sx * 0.85 + Math.sin(l * 6 + i) * 0.04; arr[i * 3 + 1] = -0.14 - l * 1.3 - l * l * 0.5; arr[i * 3 + 2] = 0.2 + l * 1.5;
    }
    geo.attributes.position.needsUpdate = true;
  });
}

function addShower() {
  const d = reg('shower', 'shower', 'bath', 'Shower', { on: false }, { cat: 'none', pos: new THREE.Vector3(11.56, 2.0, 0.5) });
  const hit = B(0.3, 0.3, 0.3, new THREE.MeshBasicMaterial({ visible: false }), 11.6, 1.9, 0.5, { cast: false });
  it(hit, d, () => `Shower — turn ${d.state.on ? 'off' : 'on'} (raises humidity)`, () => { set('shower', { on: !d.state.on }, 'hand'); audio.sfx('click'); used(d); });
  const N = 120, geo = new THREE.BufferGeometry(), arr = new Float32Array(N * 3), life = new Float32Array(N); for (let i = 0; i < N; i++) life[i] = rnd();
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const pm = new THREE.PointsMaterial({ color: 0xffffff, size: 0.05, transparent: true, opacity: 0, depthWrite: false }); const pts = new THREE.Points(geo, pm); pts.frustumCulled = false; scene.add(pts); hideInPhoto.push(pts);
  let k = 0;
  updaters.push(dt => {
    k += clamp((d.state.on ? 1 : 0) - k, -dt * 0.5, dt * 0.5); pm.opacity = k * 0.35; if (k <= 0) return;
    for (let i = 0; i < N; i++) {
      life[i] += dt * 0.35; if (life[i] > 1) life[i] = 0; const l = life[i], water = i % 2 === 0;
      if (water) { arr[i * 3] = 11.56 + (((i * 13) % 10) / 10 - 0.5) * 0.18; arr[i * 3 + 1] = 2.05 - ((l * 5) % 1) * 1.5; arr[i * 3 + 2] = 0.5 + (((i * 7) % 10) / 10 - 0.5) * 0.18; }
      else { arr[i * 3] = 11.4 + Math.sin(i + l * 3) * 0.5; arr[i * 3 + 1] = 0.6 + l * 2.1; arr[i * 3 + 2] = 1.2 + Math.cos(i * 1.7 + l * 2) * 0.9; }
    }
    geo.attributes.position.needsUpdate = true;
  });
}

addLight = tracked(addLight);
addSwitch = tracked(addSwitch);
addMixPad = tracked(addMixPad);
addCurtain = tracked(addCurtain);
addContact = tracked(addContact);
addWindow = tracked(addWindow);
addEntry = tracked(addEntry);
addPresence = tracked(addPresence);
addClimate = tracked(addClimate);
addSOS = tracked(addSOS);
addHazard = tracked(addHazard);
addRelay = tracked(addRelay);
addCamera = tracked(addCamera);
addSpeaker = tracked(addSpeaker);
addTV = tracked(addTV);
addAC = tracked(addAC);
addShower = tracked(addShower);

// ---------------- placement ----------------
export function buildDevices() {
  // SOPRO lighting
  addLight('l_liv_down', 'living', 'Living downlights', 'down', { pos: [3.4, 2.4, 6.4], I: 17, watts: 54, fix: [[1.4, 5.3], [3.5, 5.3], [5.6, 5.3], [1.4, 7.7], [3.5, 7.7], [5.6, 7.3]] });
  addLight('l_liv_spot', 'living', 'Living spotlights', 'spot', { pos: [4.2, 2.7, 5.2], I: 55, watts: 30, track: [2.4, 5.25, 6.4, 5.25], spots: [{ from: [4.2, 2.72, 5.25], to: [4.2, 1.5, 4.1] }, { from: [3.0, 2.72, 5.25], to: [2.9, 0.4, 6.6], angle: 0.55 }, { from: [6.3, 2.72, 5.25], to: [6.9, 1.3, 6.9], angle: 0.45 }] });
  addLight('l_liv_strip', 'living', 'Living shadow-line strip', 'strip', { pos: [3.5, 2.5, 6.5], I: 5.5, range: 4, watts: 40, segs: [...cove(0, 4, 7, 9), [0.9, 8.8, 4.3, 8.8, 0.07]] });
  addLight('l_entry', 'living', 'Entry downlight', 'down', { pos: [5.7, 2.45, 8.2], I: 5, range: 3.4, shadow: false, watts: 9, fix: [[5.7, 8.3]] });
  addLight('l_kit_down', 'kitchen', 'Kitchen downlights', 'down', { pos: [2, 2.4, 1.9], I: 13, watts: 36, cct: 4000, fix: [[1.2, 1.2], [2.8, 1.2], [1.2, 3.1], [2.8, 3.1]] });
  addLight('l_kit_pend', 'kitchen', 'Island pendants', 'spot', { pos: [2.45, 1.9, 2.45], I: 22, watts: 16, spots: [{ from: [2.1, 1.85, 2.45], to: [2.1, 0.9, 2.45], angle: 0.85, pendant: true }, { from: [2.8, 1.85, 2.45], to: [2.8, 0.9, 2.45], angle: 0.85, pendant: true }] });
  addLight('l_kit_strip', 'kitchen', 'Under-cabinet strip', 'strip', { pos: [1.0, 1.3, 1.8], I: 2.2, range: 2.4, watts: 14, segs: [[0.44, 0.75, 0.44, 3.25, 1.465]] });
  addLight('l_bed_down', 'bedroom', 'Bedroom downlights', 'down', { pos: [6, 2.4, 2], I: 13, watts: 36, fix: [[5.2, 1.0], [6.9, 1.0], [5.2, 3.0], [6.9, 3.0]] });
  addLight('l_bed_strip', 'bedroom', 'Bedroom shadow-line strip', 'strip', { pos: [6, 2.5, 2], I: 4, range: 3, watts: 24, segs: cove(4, 0, 8, 4) });
  addLight('l_mas_down', 'master', 'Master downlights', 'down', { pos: [9.5, 2.4, 6.2], I: 16, watts: 45, fix: [[8.2, 5.1], [10.8, 5.1], [8.2, 7.6], [10.8, 7.6]] });
  addLight('l_mas_spot', 'master', 'Bedside reading spots', 'spot', { pos: [9.6, 2.7, 7.3], I: 40, watts: 16, spots: [{ from: [9.1, 2.72, 7.5], to: [9.1, 0.6, 8.4], angle: 0.4 }, { from: [10.1, 2.72, 7.5], to: [10.1, 0.6, 8.4], angle: 0.4 }] });
  addLight('l_mas_strip', 'master', 'Master shadow-line strip', 'strip', { pos: [9.6, 2.45, 6.8], I: 5, range: 3.6, watts: 34, segs: [...cove(7, 4, 12, 9), [8.35, 8.74, 10.85, 8.74, 1.38]] });
  addLight('l_bath_down', 'bath', 'Bathroom downlights', 'down', { pos: [10, 2.4, 2], I: 13, watts: 27, cct: 4000, fix: [[9.3, 1.2], [10.8, 1.2], [9.3, 3.0], [10.8, 3.0]] });
  addLight('l_bath_mirror', 'bath', 'Mirror light', 'strip', { pos: [8.7, 1.7, 1.6], I: 2.6, range: 2.6, watts: 12, cct: 4500, segs: [[8.11, 0.98, 8.11, 2.22, 2.02], [8.11, 0.98, 8.11, 2.22, 1.08]] });

  // building corridor light (not a smart device — always on)
  const cl = new THREE.PointLight(0xffe2bd, 9, 7, 2); cl.position.set(6, 2.5, 10.3); scene.add(cl);
  for (const x of [4.6, 7.4]) C(0.09, 0.012, glow(0xffe2bd, 5), x, H - 0.006, 10.3, { cast: false });

  // MixPad panels & MixSwitches
  addMixPad('mp_liv', 'living', 'Living MixPad', [6.915, 1.42, 8.35], 'w');
  addMixPad('mp_mas', 'master', 'Master MixPad', [7.085, 1.42, 5.8], 'e');
  addMixPad('mp_x', 'living', 'Living MixPad X (home hub)', [6.915, 1.47, 5.95], 'w', 'X');
  addSwitch('sw_entry', 'living', 'Entry scene switch', [6.915, 1.42, 8.0], 'w', [{ label: 'Welcome Home scene', scene: 'welcome' }, { label: 'Leave Home scene', scene: 'leave' }]);
  addSwitch('sw_liv', 'living', 'Living MixSwitch', [6.35, 1.35, 4.085], 's', [{ label: 'Downlights', lights: ['l_liv_down', 'l_entry'] }, { label: 'Spotlights', light: 'l_liv_spot' }, { label: 'Shadow-line strip', light: 'l_liv_strip' }]);
  addSwitch('sw_kit', 'kitchen', 'Kitchen MixSwitch', [3.915, 1.35, 3.6], 'w', [{ label: 'Downlights', light: 'l_kit_down' }, { label: 'Island pendants', light: 'l_kit_pend' }, { label: 'Under-cabinet strip', light: 'l_kit_strip' }]);
  addSwitch('sw_bed', 'bedroom', 'Bedroom MixSwitch', [6.2, 1.35, 3.915], 'n', [{ label: 'Downlights', light: 'l_bed_down' }, { label: 'Shadow-line strip', light: 'l_bed_strip' }, { label: 'Curtain', curtain: 'cur_bed' }]);
  addSwitch('sw_mas', 'master', 'Master MixSwitch', [7.085, 1.42, 6.08], 'e', [{ label: 'Downlights', light: 'l_mas_down' }, { label: 'Reading spots', light: 'l_mas_spot' }, { label: 'Shadow-line strip', light: 'l_mas_strip' }]);
  addSwitch('sw_mas_bed', 'master', 'Bedside scene switch', [8.3, 0.95, 8.845], 'n', [{ label: 'Good Night scene', scene: 'sleep' }, { label: 'Good Morning scene', scene: 'morning' }, { label: 'Curtain', curtain: 'cur_mas' }]);
  addSwitch('sw_bath', 'bath', 'Bathroom MixSwitch', [10.6, 1.35, 3.915], 'n', [{ label: 'Downlights', light: 'l_bath_down' }, { label: 'Mirror light', light: 'l_bath_mirror' }, { label: 'Exhaust fan', dev: 'fan_bath' }]);

  // openings
  addEntry();
  addWindow('ws_liv', 'living', 'Living balcony window', makeWindow('z', 0, 5, 8, 0.3, 2.4), { ac: 'ac_liv', cam: 'cam_bal' });
  addWindow('ws_bed', 'bedroom', 'Guest bedroom window', makeWindow('x', 0, 5, 7, 0.9, 2.3), { ac: 'ac_bed', cam: 'cam_liv' });
  addWindow('ws_mas', 'master', 'Master bedroom window', makeWindow('z', 12, 5.5, 8, 0.8, 2.3), { ac: 'ac_mas', cam: 'cam_liv' });
  addCurtain('cur_liv', 'living', 'Living curtain', 'z', 0.2, 4.75, 8.25, 0.06, 2.6);
  addCurtain('cur_bed', 'bedroom', 'Bedroom curtain', 'x', 0.2, 4.75, 7.25, 0.7, 2.5);
  addCurtain('cur_mas', 'master', 'Master curtain', 'z', 11.8, 5.25, 8.25, 0.5, 2.5);

  // sensors
  addPresence('living', 3.5, 6.5); addPresence('kitchen', 2.0, 2.2); addPresence('bedroom', 6.0, 2.0); addPresence('master', 9.5, 6.5); addPresence('bath', 10.0, 2.0);
  addClimate('living', [6.7, 1.5, 4.085], 's'); addClimate('kitchen', [3.915, 1.5, 3.3], 'w'); addClimate('bedroom', [4.085, 1.5, 3.7], 'e'); addClimate('master', [11.885, 1.5, 4.7], 'w'); addClimate('bath', [10.3, 1.5, 3.915], 'n');
  addSOS('sos_mas', 'master', [10.9, 0.95, 8.845], 'n'); addSOS('sos_bath', 'bath', [11.885, 0.95, 2.7], 'w');
  addHazard('hz_smoke', 'kitchen', 'Smoke sensor', [2.0, H, 1.2], 'smoke'); addHazard('hz_gas', 'kitchen', 'Gas sensor', [0.3, 1.5, 0.13], 'gas'); addHazard('hz_leak', 'bath', 'Water-leak sensor', [8.75, 0, 2.7], 'leak');
  addRelay('fan_bath', 'bath', 'Exhaust fan', [10.9, H, 1.0], false, 'fan'); addRelay('valve_gas', 'kitchen', 'Gas valve', [1.2, 1.12, 0.14], true); addRelay('valve_water', 'bath', 'Water valve', [8.14, 0.35, 2.55], true);
  // extra safety & perimeter sensors
  addPresence('balcony', -0.14, 6.5, 'pr_balcony', 'Outdoor motion sensor', 'PIR', 2.5);
  addHazard('hz_smoke_liv', 'living', 'Smoke sensor', [4.7, H, 6.9], 'smoke'); addHazard('hz_smoke_mas', 'master', 'Smoke sensor', [9.5, H, 5.5], 'smoke');
  addHazard('hz_leak_kit', 'kitchen', 'Water-leak sensor', [2.2, 0, 0.86], 'leak'); addSOS('sos_bed', 'bedroom', [7.915, 0.95, 1.05], 'w');
  addShower();

  // cameras
  addCamera('cam_entry', 'corridor', 'Entrance', [7.9, 2.55, 11.3], [5.7, 1.0, 9.2], true);
  addCamera('cam_liv', 'living', 'Living room', [0.35, 2.6, 4.3], [4.6, 0.9, 7.6]);
  addCamera('cam_bal', 'balcony', 'Balcony', [-0.2, 2.5, 4.85], [-0.7, 0.8, 7.6], true);
  addCamera('cam_kit', 'kitchen', 'Kitchen', [3.75, 2.6, 3.75], [1.0, 0.8, 0.8]);

  // music
  addSpeaker('spk_liv', 'living', 'Artist Box (master)', [3.45, 0.69, 8.66], true);
  addSpeaker('spk_kit', 'kitchen', 'Kitchen ceiling speaker', [2.0, H, 2.6]); addSpeaker('spk_bed', 'bedroom', 'Bedroom ceiling speaker', [6.0, H, 2.6]);
  addSpeaker('spk_mas', 'master', 'Master ceiling speakers', [8.6, H, 6.3], false, [[2, 0]]); addSpeaker('spk_bath', 'bath', 'Bathroom ceiling speaker', [10.0, H, 2.6]);
  for (const x of [1.4, 5.6]) { C(0.11, 0.012, M.white, x, H - 0.006, 6.5, { cast: false }); C(0.09, 0.004, M.dark, x, H - 0.014, 6.5, { cast: false }); }

  // TV + climate
  addTV('tv_liv', 'living', 'Living TV', [2.6, 1.5, 8.79], 'n', 1.65); addTV('tv_mas', 'master', 'Master TV', [9.3, 1.45, 4.085], 's', 1.2);
  addAC('ac_liv', 'living', 'Living AC', [6.92, 2.5, 6.9], 'w'); addAC('ac_bed', 'bedroom', 'Bedroom AC', [7.92, 2.5, 2.9], 'w'); addAC('ac_mas', 'master', 'Master AC', [11.0, 2.5, 4.085], 's');
}

// ---- project customisation: remove / restore / add items ----
export function setInstalled(d, on) {
  d.installed = on; (d.objs || []).forEach(o => { if (!o.isLight) o.visible = on; });
  if (!on) { if ('on' in d.state && d.type !== 'relay') d.state.on = false; if (d.type === 'presence') d.state.present = false; if (d.type === 'camera') d.state.rec = false; }
  bus.emit('layout'); changed();
}
const ADDABLE = {
  presence: { label: 'Presence sensor', icon: '🧍', mount: 'ceiling' }, pir: { label: 'Motion sensor (PIR)', icon: '🏃', mount: 'ceiling' },
  climate: { label: 'Temp & humidity sensor', icon: '🌡️', mount: 'wall', y: 1.5 }, sos: { label: 'Emergency button', icon: '🆘', mount: 'wall', y: 0.95 },
  smoke: { label: 'Smoke sensor', icon: '🔥', mount: 'ceiling' }, leak: { label: 'Water-leak sensor', icon: '💧', mount: 'floor' },
  camera: { label: 'Smart camera', icon: '📷', mount: 'wall', y: 2.5 }, mixpad: { label: 'MixPad panel', icon: '📱', mount: 'wall', y: 1.42 },
  mixpadx: { label: 'MixPad X', icon: '🖥️', mount: 'wall', y: 1.47 }, switch: { label: 'MixSwitch', icon: '🔘', mount: 'wall', y: 1.35 },
  speaker: { label: 'Ceiling speaker', icon: '🔊', mount: 'ceiling' },
};
export { ADDABLE };
let customN = 0;
// Place a new item where the user clicked on the plan. Wall items snap to the nearest wall.
export function addCustom(spec) {
  const a = ADDABLE[spec.kind]; if (!a) return null;
  let { x, z } = spec, facing = spec.facing, w = null;
  if (a.mount === 'wall') {
    w = nearestWall(x, z); if (!w || w.d > 3) return null;
    x = w.x; z = w.z; facing = w.facing;
  }
  const n = { e: [0.3, 0], w: [-0.3, 0], s: [0, 0.3], n: [0, -0.3] }[facing] || [0, 0];
  const room = roomAt(x + n[0], z + n[1]); if (!room || room === 'corridor' || (room === 'balcony' && !['pir', 'camera'].includes(spec.kind))) return null;
  const id = spec.id || `x_${spec.kind}_${Date.now().toString(36)}${customN++}`, R = ROOMS[room].rect, rn = ROOMS[room].name;
  let d;
  switch (spec.kind) {
    case 'presence': d = addPresence(room, x, z, id, 'Presence sensor'); break;
    case 'pir': d = addPresence(room, x, z, id, 'Motion sensor', 'PIR', room === 'balcony' ? 2.5 : H); break;
    case 'climate': d = addClimate(room, [x, a.y, z], facing, id); break;
    case 'sos': d = addSOS(id, room, [x, a.y, z], facing); break;
    case 'smoke': d = addHazard(id, room, 'Smoke sensor', [x, H, z], 'smoke'); break;
    case 'leak': d = addHazard(id, room, 'Water-leak sensor', [x, 0, z], 'leak'); break;
    case 'camera': d = addCamera(id, room, `${rn} (added)`, [x + n[0] * 0.5, a.y, z + n[1] * 0.5], [(R[0] + R[2]) / 2, 0.9, (R[1] + R[3]) / 2], room === 'balcony'); break;
    case 'mixpad': d = addMixPad(id, room, `${rn} MixPad`, [x, a.y, z], facing); break;
    case 'mixpadx': d = addMixPad(id, room, `${rn} MixPad X`, [x, a.y, z], facing, 'X'); break;
    case 'switch': {
      const ls = ofType('light').filter(l => l.room === room).slice(0, 3);
      d = addSwitch(id, room, `${rn} MixSwitch`, [x, a.y, z], facing, ls.length ? ls.map(l => ({ label: l.name, light: l.id })) : [{ label: 'Welcome Home scene', scene: 'welcome' }, { label: 'Leave Home scene', scene: 'leave' }]); break;
    }
    case 'speaker': d = addSpeaker(id, room, `${rn} ceiling speaker`, [x, H, z]); break;
  }
  if (!d) return null;
  d.custom = { kind: spec.kind, x: spec.x, z: spec.z, id };
  if (spec.model && CATALOG[d.cat]?.models.some(m => m.id === spec.model)) { d.model = spec.model; d.applyModel?.(modelOf(d)); }
  bus.emit('layout'); changed(); return d;
}

export function setModel(d, modelId) {
  d.model = modelId; const m = modelOf(d); d.applyModel?.(m);
  log(`${d.name} → ${m.name}`); bus.emit('model', d);
}
