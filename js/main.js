// Bootstrap, first-person controller and render loop.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { scene, buildWorld, colliders, occluders, interactables, updaters, dirty, updateSky, sun, mirrors, hideInPhoto, dayFactor } from './world.js';
import { buildDevices, bounceLights } from './devices.js';
import { buildActors, updateActors, actors } from './actors.js';
import { home, bus, roomAt, ofType, dev, set, clamp, notify } from './state.js';
import { tickSim, arm, runScene } from './sim.js';
import { audio } from './audio.js';
import { ui, initUI, updateHUD, toggle, closeOverlay } from './ui.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 400); camera.rotation.order = 'YXZ'; scene.add(camera);
const player = { x: 5.7, z: 10.9, yaw: 0, pitch: 0, vx: 0, vz: 0, bob: 0, moving: false };

let composer, bloom, gtao, useBloom = true;
function setupComposer() {
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  gtao = new GTAOPass(scene, camera, 1, 1); gtao.blendIntensity = 0.9; gtao.updateGtaoMaterial({ radius: 0.4, distanceExponent: 1.4, thickness: 1.2, scale: 1.15, samples: 12 }); composer.addPass(gtao);
  bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.7, 1.15); composer.addPass(bloom);
  composer.addPass(new OutputPass());
}
function applyQuality(q) {
  const dpr = window.devicePixelRatio || 1;
  // Ultra renders at least 3840 px wide internally (true 4K, supersampled on smaller screens).
  renderer.setPixelRatio(q === 'low' ? Math.min(dpr, 0.85) : q === 'ultra' ? clamp(Math.max(dpr, 3840 / innerWidth), 1, 3) : Math.min(dpr, 1.5));
  useBloom = q !== 'low'; if (gtao) gtao.enabled = q !== 'low';
  mirrors.forEach(m => m.visible = q !== 'low'); bounceLights.forEach(b => b.visible = q !== 'low');
  const res = (l, n) => { if (l.shadow.mapSize.x !== n) { l.shadow.mapSize.set(n, n); l.shadow.map?.dispose(); l.shadow.map = null; } };
  res(sun, q === 'ultra' ? 4096 : 2048); ofType('light').forEach(l => l.shadowLight && res(l.shadowLight, q === 'ultra' ? 1024 : 512)); dirty.all = true;
  resize();
}
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); composer?.setPixelRatio(renderer.getPixelRatio()); composer?.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
ui.onQuality = applyQuality;

// ---------- ray-traced photo mode (progressive path tracing of the current view) ----------
let pt = null, photoOn = false, photoEnv = null, savedEnv = null;
async function photo() {
  const box = document.getElementById('photo'), lab = document.getElementById('photo-s');
  if (photoOn) { photoOn = false; box.classList.add('hidden'); scene.environment = savedEnv; hideInPhoto.forEach(o => o.visible = true); mirrors.forEach(m => m.visible = ui.quality !== 'low'); resize(); lock(); return; }
  if (!started || ui.open) return;
  box.classList.remove('hidden'); lab.textContent = 'Preparing the ray tracer…'; document.exitPointerLock?.();
  try {
    const { WebGLPathTracer } = await import('three-gpu-pathtracer');
    if (!pt) { pt = new WebGLPathTracer(renderer); pt.bounces = 6; pt.filterGlossyFactor = 0.5; pt.dynamicLowRes = true; pt.minSamples = 1; pt.renderScale = Math.min(1, 1600 / (innerWidth * renderer.getPixelRatio())); pt.tiles.set(2, 2); }
    // a soft sky dome stands in for the pre-filtered environment while tracing
    const sky = scene.background, k = 0.25 + 2.2 * dayFactor, data = new Float32Array(4 * 8 * 4);
    for (let i = 0; i < 32; i++) data.set([sky.r * k, sky.g * k, sky.b * k, 1], i * 4);
    photoEnv?.dispose(); photoEnv = new THREE.DataTexture(data, 8, 4, THREE.RGBAFormat, THREE.FloatType); photoEnv.mapping = THREE.EquirectangularReflectionMapping; photoEnv.needsUpdate = true;
    savedEnv = scene.environment; scene.environment = photoEnv; scene.environmentIntensity = 1;
    hideInPhoto.forEach(o => o.visible = false); mirrors.forEach(m => m.visible = false);
    scene.updateMatrixWorld(true); pt.setScene(scene, camera); photoOn = true;
  } catch (e) { console.error(e); lab.textContent = 'Ray tracing is not supported on this device.'; setTimeout(() => box.classList.add('hidden'), 2500); if (savedEnv) scene.environment = savedEnv; hideInPhoto.forEach(o => o.visible = true); }
}
ui.onPhoto = photo;

// ---------- input ----------
const keys = new Set(); let started = false, target = null, muted = false;
const locked = () => document.pointerLockElement === canvas;
const isTouch = matchMedia('(pointer: coarse)').matches && 'ontouchstart' in window;
function lock() { if (isTouch || ui.open || !started) return; try { const p = canvas.requestPointerLock(); p?.catch?.(() => { }); } catch (e) { /* drag-look fallback stays available */ } }
ui.relock = lock;
function interact() { if (target && !ui.open) target.act(); }
function inspect() { if (target && !ui.open && target.dev) { bus.emit('inspect', target.dev); } }

addEventListener('keydown', e => {
  if (!started) return;
  const k = e.key.toLowerCase();
  if (k === 'tab') { e.preventDefault(); if (ui.open && ui.open !== 'phone') closeOverlay(); else toggle('phone'); return; }
  if (photoOn) { if (k === 'p' || k === 'escape') photo(); return; }
  if (k === 'p' && !ui.open) { photo(); return; }
  if (k === 'escape') { if (ui.open) closeOverlay(); return; }
  if (ui.open) { if (k === 'c' && ui.open === 'cctv') closeOverlay(); if (k === 'h' && ui.open === 'help') closeOverlay(); if (k === 'x') arm('disarmed', 'shortcut'); return; }
  keys.add(k);
  if (k === 'e') interact(); if (k === 'q') inspect(); if (k === 'c') toggle('cctv'); if (k === 'h') toggle('help');
  if (k === 'x' && (home.security.alarm || home.security.mode !== 'disarmed')) arm('disarmed', 'shortcut');
  if (k === 'm') { muted = !muted; audio.setMaster(muted ? 0 : 0.8); notify(muted ? 'Sound muted' : 'Sound on'); }
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
let drag = null;
canvas.addEventListener('mousedown', e => {
  if (!started || ui.open || photoOn) return;
  if (!locked()) { lock(); drag = { x: e.clientX, y: e.clientY, moved: false }; return; }
  if (e.button === 0) interact(); if (e.button === 2) inspect();
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mouseup', e => { if (drag && !drag.moved && !locked() && e.button === 0) interact(); drag = null; });
addEventListener('mousemove', e => {
  if (ui.open || !started) return;
  let dx = 0, dy = 0;
  if (locked()) { dx = e.movementX; dy = e.movementY; }
  else if (drag) { dx = e.clientX - drag.x; dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true; dx *= 1.6; dy *= 1.6; }
  player.yaw -= dx * 0.0022; player.pitch = clamp(player.pitch - dy * 0.0022, -1.45, 1.45);
});

// touch controls
const stick = { x: 0, y: 0 };
if (isTouch) {
  document.body.classList.add('touch');
  const st = document.getElementById('stick'), knob = document.getElementById('knob');
  const mv = e => { const r = st.getBoundingClientRect(), t = e.targetTouches[0]; let x = (t.clientX - r.left - 60) / 60, y = (t.clientY - r.top - 60) / 60; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } stick.x = x; stick.y = y; knob.style.transform = `translate(${x * 35}px,${y * 35}px)`; e.preventDefault(); };
  st.addEventListener('touchstart', mv, { passive: false }); st.addEventListener('touchmove', mv, { passive: false });
  st.addEventListener('touchend', () => { stick.x = stick.y = 0; knob.style.transform = ''; });
  let last = null;
  canvas.addEventListener('touchstart', e => { const t = e.changedTouches[0]; last = { id: t.identifier, x: t.clientX, y: t.clientY }; }, { passive: true });
  canvas.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (last && t.identifier === last.id) { player.yaw -= (t.clientX - last.x) * 0.005; player.pitch = clamp(player.pitch - (t.clientY - last.y) * 0.005, -1.45, 1.45); last.x = t.clientX; last.y = t.clientY; } e.preventDefault(); }, { passive: false });
  document.querySelectorAll('#touch button').forEach(b => b.addEventListener('click', () => ({ use: interact, info: inspect, app: () => toggle('phone'), cam: () => toggle('cctv') })[b.dataset.t]()));
}

// ---------- movement & collision ----------
function collide(p) {
  const R = 0.27;
  for (let pass = 0; pass < 2; pass++) for (const c of colliders) {
    if (c.on === false) continue;
    const nx = clamp(p.x, c.x0, c.x1), nz = clamp(p.z, c.z0, c.z1), dx = p.x - nx, dz = p.z - nz, d2 = dx * dx + dz * dz;
    if (d2 >= R * R) continue;
    if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x = nx + dx / d * R; p.z = nz + dz / d * R; }
    else { const l = p.x - c.x0, r = c.x1 - p.x, t = p.z - c.z0, b = c.z1 - p.z, m = Math.min(l, r, t, b); if (m === l) p.x = c.x0 - R; else if (m === r) p.x = c.x1 + R; else if (m === t) p.z = c.z0 - R; else p.z = c.z1 + R; }
  }
}
function move(dt) {
  let f = 0, s = 0;
  if (!ui.open) {
    if (keys.has('w') || keys.has('arrowup')) f += 1; if (keys.has('s') || keys.has('arrowdown')) f -= 1;
    if (keys.has('d')) s += 1; if (keys.has('a')) s -= 1;
    if (keys.has('arrowleft')) player.yaw += dt * 1.9; if (keys.has('arrowright')) player.yaw -= dt * 1.9;
    f -= stick.y; s += stick.x;
  }
  const l = Math.hypot(f, s); if (l > 1) { f /= l; s /= l; }
  const sp = keys.has('shift') ? 4.6 : 2.5, sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  const tx = (-sin * f + cos * s) * sp, tz = (-cos * f - sin * s) * sp, k = Math.min(1, dt * 10);
  player.vx += (tx - player.vx) * k; player.vz += (tz - player.vz) * k;
  player.x += player.vx * dt; player.z += player.vz * dt; collide(player);
  const v = Math.hypot(player.vx, player.vz); player.moving = v > 0.4; if (player.moving) player.bob += dt * v * 3.2;
  camera.position.set(player.x, 1.66 + Math.sin(player.bob) * 0.022, player.z); camera.rotation.set(player.pitch, player.yaw, 0);
  home.player.x = player.x; home.player.z = player.z; home.player.room = roomAt(player.x, player.z) || home.player.room;
}

const ray = new THREE.Raycaster(); ray.far = 2.9; const center = new THREE.Vector2(0, 0); let pickList = null;
function pick() {
  pickList ??= [...interactables, ...occluders];
  ray.setFromCamera(center, camera); const hit = ray.intersectObjects(pickList, false)[0]; target = null;
  if (!hit) return; let o = hit.object; while (o && !o.userData.it) o = o.parent; target = o ? o.userData.it : null;
}

// ---------- render ----------
const doorRT = new THREE.WebGLRenderTarget(320, 200); let frame = 0;
function render() {
  const w = innerWidth, h = innerHeight, cams = ofType('camera');
  if (ui.open === 'cctv') {
    renderer.setScissorTest(true);
    cams.forEach((d, i) => {
      if (ui.cctv.single != null && ui.cctv.single !== i) return;
      const single = ui.cctv.single === i, vw = single ? w : w / 2, vh = single ? h : h / 2, x = single ? 0 : (i % 2) * vw, y = single ? 0 : (i < 2 ? vh : 0);
      renderer.setViewport(x, y, vw, vh); renderer.setScissor(x, y, vw, vh);
      if (!d.state.on) { renderer.clear(); return; }
      d.camera.aspect = vw / vh; d.camera.updateProjectionMatrix(); renderer.render(scene, d.camera);
    });
    renderer.setScissorTest(false); renderer.setViewport(0, 0, w, h); return;
  }
  // door camera on the MixPad screens while the bell rings
  const ring = !!home.doorbell;
  for (const mp of ofType('mixpad')) { const want = ring ? doorRT.texture : mp.tex; if (mp.screenMat.map !== want) { mp.screenMat.map = want; mp.screenMat.needsUpdate = true; } }
  if (ring && frame % 3 === 0) { const c = dev('cam_entry').camera; c.aspect = 1.6; c.updateProjectionMatrix(); renderer.setRenderTarget(doorRT); renderer.render(scene, c); renderer.setRenderTarget(null); }
  if (useBloom) composer.render(); else renderer.render(scene, camera);
  if (ui.pip && !ui.open) {
    const r = document.getElementById('pip').getBoundingClientRect(), c = dev(ui.pip).camera;
    if (r.width) {
      renderer.setRenderTarget(null); renderer.setScissorTest(true);
      renderer.setViewport(r.left, h - r.bottom, r.width, r.height); renderer.setScissor(r.left, h - r.bottom, r.width, r.height);
      c.aspect = r.width / r.height; c.updateProjectionMatrix(); renderer.render(scene, c);
      renderer.setScissorTest(false); renderer.setViewport(0, 0, w, h);
    }
  }
}

const clock = { last: performance.now(), elapsedTime: 0, getDelta() { const n = performance.now(), d = (n - this.last) / 1000; this.last = n; this.elapsedTime += d; return d; } }; let lastSun = -1; let fpsN = 0, fpsT = 0, fpsDone = false;
function loop() {
  requestAnimationFrame(loop);
  const raw = clock.getDelta(), dt = Math.min(raw, 0.05), t = clock.elapsedTime; frame++;
  if (photoOn) { try { pt.renderSample(); } catch (e) { console.error(e); photo(); } document.getElementById('photo-s').textContent = `${Math.floor(pt.samples)} samples per pixel`; return; }
  if (started) {
    // one-time automatic quality fallback for slower graphics hardware
    if (!fpsDone && !ui.open) { fpsN++; fpsT += raw; if (fpsT > 4) { fpsDone = true; if (fpsN / fpsT < 26 && ui.quality !== 'low') { ui.quality = 'low'; applyQuality('low'); notify('Graphics set to Low', 'For a smoother walk-through on this device. Change it in the app under More.', 'info'); } } }
    move(dt); tickSim(dt, actors); updateActors(dt, player.yaw, player.moving, t);
    if (frame % 2 === 0) pick();
    // what the listener hears from the multi-room system
    let lvl = 0, inRoom = false;
    if (home.music.playing) for (const sp of ofType('speaker')) {
      if (!sp.state.on) continue; const same = sp.room === home.player.room, d = Math.hypot(sp.pos.x - player.x, sp.pos.z - player.z);
      lvl = Math.max(lvl, sp.state.vol / 100 * (same ? 1 / (1 + 0.07 * d * d) : 0.2 / (1 + 0.05 * d * d))); inRoom ||= same;
    }
    audio.setMusic(lvl * home.music.vol / 100 * (home.music.ducked ? 0.25 : 1) * 0.9, !inRoom);
    updateHUD(dt, target, player.yaw, actors);
  } else { // slow orbiting preview behind the start screen
    camera.position.set(3.4 + Math.sin(t * 0.15) * 1.2, 1.7, 6.6 + Math.cos(t * 0.15) * 0.8); camera.rotation.set(-0.05, t * 0.12, 0);
  }
  for (const u of updaters) u(dt, t);
  updateSky(home.time);
  if (Math.abs(home.time - lastSun) > 0.03) { lastSun = home.time; dirty.sun = true; }
  if (dirty.all) { ofType('light').forEach(l => { if (l.shadowLight) l.shadowLight.shadow.needsUpdate = true; }); dirty.all = false; dirty.sun = true; }
  if (dirty.living) { dev('l_liv_down').shadowLight.shadow.needsUpdate = true; dirty.living = false; }
  if (dirty.sun) { sun.shadow.needsUpdate = true; dirty.sun = false; }
  render();
}

// ---------- boot ----------
function boot() {
  buildWorld(); buildDevices(); buildActors();
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  setupComposer(); applyQuality(ui.quality); initUI(); updateSky(home.time);
  // a welcoming preview behind the title card
  set('l_liv_down', { on: true, bri: 55 }, 'boot'); set('l_liv_strip', { on: true, bri: 70, rgb: '#ffb060' }, 'boot'); set('l_liv_spot', { on: true, bri: 70 }, 'boot'); set('l_kit_strip', { on: true }, 'boot');
  home.log.length = 0;
  loop();
  const btn = document.getElementById('enter'); btn.disabled = false; btn.textContent = 'Enter the apartment';
  btn.onclick = () => {
    audio.init(); ui.tour = document.getElementById('opt-tour').checked; initUI();
    ofType('light').forEach(l => set(l.id, { on: false, fade: 0.2 }, 'boot')); home.log.length = 0;
    document.getElementById('start').classList.add('hidden'); document.getElementById('hud').classList.remove('hidden');
    started = true; lock();
    setTimeout(() => notify('Welcome to apartment A·1204', 'Walk to the door and press E on the smart lock to unlock it.', 'info'), 600);
  };
}
try { boot(); } catch (e) { console.error(e); document.getElementById('enter').textContent = 'WebGL error — see console'; }

// handy for demos and automated tests
window.SIM = { home, set, dev, player, runScene, arm, bus, ui, camera, renderer, scene, photo, get pt() { return pt; } };
