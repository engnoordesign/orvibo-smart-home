// Bootstrap, first-person controller and render loop.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { scene, buildWorld, colliders, occluders, interactables, updaters, dirty, updateSky, sun, mirrors, hideInPhoto, dayFactor, freezeStatic, mergeStatic } from './world.js';
import { buildDevices } from './devices.js';
import { buildPool, updatePool, refreshShadows, photoLights } from './lights.js';
import { buildActors, updateActors, actors } from './actors.js';
import { home, bus, roomAt, ofType, dev, has, set, clamp, notify } from './state.js';
import { tickSim, arm, runScene } from './sim.js';
import { audio } from './audio.js';
import { focusCategory } from './plan.js';
import { ui, initUI, updateHUD, toggle, closeOverlay, cctvGrid, cctvCams, paintFeeds, refreshPlanMap } from './ui.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, stencil: false, powerPreference: 'high-performance' });
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
  // Low / Balanced / High adapt their resolution to hold a smooth frame rate.
  // Ultra renders at least 3840 px wide internally (true 4K, supersampled on smaller screens) and never scales down.
  basePR = q === 'low' ? Math.min(dpr, 1) : q === 'balanced' ? Math.min(dpr, 1.25) : q === 'ultra' ? clamp(Math.max(dpr, 3840 / innerWidth), 1, 3) : Math.min(dpr, 1.5);
  adaptive = q !== 'ultra'; resScale = 1; ceilUntil = 0;
  const rich = q === 'high' || q === 'ultra';
  useBloom = q !== 'low'; if (gtao) gtao.enabled = rich; mirrorsOn = q !== 'low';
  if (poolQ !== q) { buildPool(q); poolQ = q; }                  // number of real lights depends on the quality level
  const n = q === 'ultra' ? 4096 : q === 'low' ? 1024 : 2048;
  if (sun.shadow.mapSize.x !== n) { sun.shadow.mapSize.set(n, n); sun.shadow.map?.dispose(); sun.shadow.map = null; }
  dirty.all = true;
  resize();
}
let basePR = 1, resScale = 1, ceilUntil = 0, adaptive = true, mirrorsOn = true, good = 0, poolQ = null;
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(basePR * resScale); renderer.setSize(w, h, false); composer?.setPixelRatio(renderer.getPixelRatio()); composer?.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
ui.onQuality = applyQuality;

// ---------- ray-traced photo mode (progressive path tracing of the current view) ----------
let pt = null, photoOn = false, photoEnv = null, savedEnv = null;
async function photo() {
  const box = document.getElementById('photo'), lab = document.getElementById('photo-s');
  if (photoOn) { photoOn = false; photoLights(false); box.classList.add('hidden'); scene.environment = savedEnv; hideInPhoto.forEach(o => o.visible = true); mirrors.forEach(m => m.visible = ui.quality !== 'low'); resize(); lock(); return; }
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
    photoLights(true); scene.updateMatrixWorld(true); pt.setScene(scene, camera); photoOn = true;
  } catch (e) { console.error(e); lab.textContent = 'Ray tracing is not supported on this device.'; setTimeout(() => box.classList.add('hidden'), 2500); if (savedEnv) scene.environment = savedEnv; photoLights(false); hideInPhoto.forEach(o => o.visible = true); }
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
  if (k === 'f' && !photoOn && (!ui.open || ui.open === 'plan' || ui.open === 'phone')) { toggle('plan'); return; }
  if (photoOn) { if (k === 'p' || k === 'escape') photo(); return; }
  if (k === 'p' && !ui.open) { photo(); return; }
  if (k === 'escape') { if (ui.open) closeOverlay(); return; }
  if (ui.open && ui.open !== 'phone') { if (k === 'c' && ui.open === 'cctv') closeOverlay(); if (k === 'h' && ui.open === 'help') closeOverlay(); if (k === 'x') arm('disarmed', 'shortcut'); return; }
  keys.add(k);
  if (k === 'e') interact(); if (k === 'q') inspect(); if (k === 'c') toggle('cctv'); if (k === 'h') toggle('help');
  if (k === 'x' && (home.security.alarm || home.security.mode !== 'disarmed')) arm('disarmed', 'shortcut');
  if (k === 'm') { muted = !muted; audio.setMaster(muted ? 0 : 0.8); notify(muted ? 'Sound muted' : 'Sound on'); }
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
let drag = null;
canvas.addEventListener('mousedown', e => {
  if (!started || photoOn || (ui.open && ui.open !== 'phone')) return;
  if (!locked()) { lock(); drag = { x: e.clientX, y: e.clientY, moved: false }; return; }
  if (e.button === 0) interact(); if (e.button === 2) inspect();
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mouseup', e => { if (drag && !drag.moved && !locked() && e.button === 0) interact(); drag = null; });
addEventListener('mousemove', e => {
  if (!started || (ui.open && ui.open !== 'phone')) return;
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
  document.querySelectorAll('#touch button').forEach(b => b.addEventListener('click', () => ({ use: interact, info: inspect, app: () => toggle('phone'), cam: () => toggle('cctv'), map: () => toggle('plan') })[b.dataset.t]()));
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
  if (!ui.open || ui.open === 'phone') {
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
  camera.position.set(player.x, 1.66 + Math.sin(player.bob) * 0.022, player.z); const ks = 1 - Math.exp(-dt * 30); lookY += (player.yaw - lookY) * ks; lookP += (player.pitch - lookP) * ks;   // light smoothing of the view
  camera.rotation.set(lookP, lookY, 0);
  home.player.x = player.x; home.player.z = player.z; home.player.room = roomAt(player.x, player.z) || home.player.room;
}

const ray = new THREE.Raycaster(); ray.far = 2.9; const center = new THREE.Vector2(0, 0); let pickList = null, pickN = 0, lookY = 0, lookP = 0;
bus.on('teleport', p => { player.x = p.x; player.z = p.z; player.vx = player.vz = 0; if (p.yaw != null) player.yaw = lookY = p.yaw; if (p.pitch != null) player.pitch = lookP = clamp(p.pitch, -1.2, 1.2); });
function pick() {
  if (!pickList || pickN !== interactables.length) { pickList = [...interactables, ...occluders]; pickN = interactables.length; }
  ray.setFromCamera(center, camera); target = null;
  for (const hit of ray.intersectObjects(pickList, false)) {
    let o = hit.object; while (o && !o.userData.it) o = o.parent; const it = o ? o.userData.it : null;
    if (it && it.dev && it.dev.installed === false) continue;      // removed from this project: not there
    target = it; break;
  }
}

// ---------- render ----------
const doorRT = new THREE.WebGLRenderTarget(320, 200); let frame = 0;
// Camera wall for the TVs (texture) and for the live pictures inside the app (copied from the canvas).
const camRT = new THREE.WebGLRenderTarget(640, 360); camRT.scissorTest = true; home.camTex = camRT.texture; let camTick = 0, feedTick = 0;
function renderTvCameras() {
  if (!ofType('tv').some(t => t.state.on && t.state.ch === 4)) return;
  const cams = cctvCams().filter(c => c.state.on); if (!cams.length) return;
  const one = home.tvCam && has(home.tvCam) && dev(home.tvCam).state.on ? dev(home.tvCam) : cams.length === 1 ? cams[0] : null;
  let d, x = 0, y = 0, w = 640, h = 360;
  if (one) d = one; else { const g = cctvGrid(Math.min(cams.length, 4)), i = camTick++ % Math.min(cams.length, 4); d = cams[i]; w = 640 / g.cols; h = 360 / g.rows; x = (i % g.cols) * w; y = 360 - (Math.floor(i / g.cols) + 1) * h; }
  camRT.viewport.set(x, y, w, h); camRT.scissor.set(x, y, w, h);
  d.camera.aspect = w / h; d.camera.updateProjectionMatrix(); renderer.setRenderTarget(camRT); renderer.render(scene, d.camera); renderer.setRenderTarget(null);
}
function renderAppFeeds(h) {
  const els = document.querySelectorAll('canvas.feed'); if (!els.length) return;
  const ids = [...new Set([...els].map(e => e.dataset.cam))].filter(id => has(id) && dev(id).state.on); if (!ids.length) return;
  const d = dev(ids[feedTick++ % ids.length]), pr = renderer.getPixelRatio(), fw = Math.min(320, innerWidth), fh = fw * 9 / 16;
  renderer.setRenderTarget(null); renderer.setScissorTest(true); renderer.setViewport(0, 0, fw, fh); renderer.setScissor(0, 0, fw, fh);
  d.camera.aspect = 16 / 9; d.camera.updateProjectionMatrix(); renderer.render(scene, d.camera);
  renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, h);
  const cv = renderer.domElement, sw = Math.floor(fw * pr), sh = Math.floor(fh * pr);
  paintFeeds(d.id, cv, 0, cv.height - sh, sw, sh);
}
function render() {
  const w = innerWidth, h = innerHeight, cams = cctvCams(), grid = cctvGrid(cams.length);
  if (ui.open === 'cctv') {
    renderer.setScissorTest(true);
    cams.forEach((d, i) => {
      if (ui.cctv.single != null && ui.cctv.single !== i) return;
      const single = ui.cctv.single === i, vw = single ? w : w / grid.cols, vh = single ? h : h / grid.rows, x = single ? 0 : (i % grid.cols) * vw, y = single ? 0 : h - (Math.floor(i / grid.cols) + 1) * vh;
      renderer.setViewport(x, y, vw, vh); renderer.setScissor(x, y, vw, vh);
      if (!d.state.on) { renderer.clear(); return; }
      d.camera.aspect = vw / vh; d.camera.updateProjectionMatrix(); renderer.render(scene, d.camera);
    });
    renderer.setScissorTest(false); renderer.setViewport(0, 0, w, h); return;
  }
  // door camera on the MixPad screens while the bell rings
  const ring = !!home.doorbell;
  for (const mp of ofType('mixpad')) { const want = ring ? doorRT.texture : mp.tex; if (mp.screenMat.map !== want) { mp.screenMat.map = want; mp.screenMat.needsUpdate = true; } }
  if (ring && has('cam_entry') && frame % 3 === 0) { const c = dev('cam_entry').camera; c.aspect = 1.6; c.updateProjectionMatrix(); renderer.setRenderTarget(doorRT); renderer.render(scene, c); renderer.setRenderTarget(null); }
  if (frame % 2 === 0) renderTvCameras();
  if (ui.open && frame % 3 === 0) renderAppFeeds(h);     // drawn first, then covered by the main picture
  if (useBloom) composer.render(); else renderer.render(scene, camera);
  if (ui.pip && has(ui.pip) && (!ui.open || ui.open === 'phone')) {
    const r = document.getElementById('pip').getBoundingClientRect(), c = dev(ui.pip).camera;
    if (r.width) {
      renderer.setRenderTarget(null); renderer.setScissorTest(true);
      renderer.setViewport(r.left, h - r.bottom, r.width, r.height); renderer.setScissor(r.left, h - r.bottom, r.width, r.height);
      c.aspect = r.width / r.height; c.updateProjectionMatrix(); renderer.render(scene, c);
      renderer.setScissorTest(false); renderer.setViewport(0, 0, w, h);
    }
  }
}

const clock = { last: performance.now(), elapsedTime: 0, getDelta() { const n = performance.now(), d = (n - this.last) / 1000; this.last = n; this.elapsedTime += d; return d; } };
let lastSun = -1, fAcc = 0, fN = 0, lastSky = -1, raf = 0, errors = 0, gfx = false, welcomed = false;
const cctvRef = new THREE.Vector3(3.5, 1.6, 6.5);

function frameStep() {
  const raw = clock.getDelta(), dt = Math.min(raw, 0.05), t = clock.elapsedTime; frame++;
  if (photoOn) { pt.renderSample(); document.getElementById('photo-s').textContent = `${Math.floor(pt.samples)} samples per pixel`; return; }
  // keep the walk-through smooth: measure the real frame rate and adapt the render resolution (gently, to avoid hitches)
  if (raw < 0.5) { fAcc += raw; fN++; }
  if (fAcc >= 1) {
    const fps = fN / fAcc; ui.fps = Math.round(fps); fAcc = 0; fN = 0;
    if (adaptive && ui.open !== 'cctv' && !document.hidden) {
      if (fps < 40 && resScale > 0.5) { resScale = Math.max(0.5, resScale - (fps < 24 ? 0.2 : 0.1)); ceilUntil = t + 60; good = 0; resize(); }
      else if (fps > 57 && resScale < 1 && t > ceilUntil) { if (++good >= 10) { resScale = Math.min(1, resScale + 0.1); good = 0; resize(); } } else good = 0;
    }
    ui.scale = resScale;
  }
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
  for (const u of updaters) u(dt, t);
  if (home.time !== lastSky) { lastSky = home.time; updateSky(home.time); }
  if (frame % 12 === 0) for (const m of mirrors) m.visible = mirrorsOn && !photoOn && roomAt(m.position.x + (m.position.x < 7.5 ? -0.3 : 0.3), m.position.z) === home.player.room;
  updatePool(ui.open === 'cctv' ? cctvRef : camera.position, ui.open === 'cctv' ? 'living' : home.player.room);
  if (Math.abs(home.time - lastSun) > 0.03) { lastSun = home.time; dirty.sun = true; }
  if (dirty.all) { refreshShadows(); dirty.all = false; dirty.living = false; dirty.sun = true; }
  if (dirty.living) { refreshShadows('living'); dirty.living = false; }
  if (dirty.sun) { sun.shadow.needsUpdate = true; dirty.sun = false; }
  render();
}
function loop() {
  if (!started) return; raf = requestAnimationFrame(loop);
  try { frameStep(); errors = 0; }
  catch (e) {                                   // never let one bad frame freeze the simulator
    console.error(e); if (photoOn) { try { photo(); } catch (x) { /* ignore */ } }
    if (++errors > 30) { exitSim(); notify('The 3D view stopped', 'Something went wrong while drawing. Try entering again with Low graphics.', 'warn'); }
  }
}

// The browser can take the graphics context away (driver reset, too many tabs): recover instead of going black.
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); cancelAnimationFrame(raf); notify('Graphics were reset by the browser', 'Recovering…', 'warn'); });
canvas.addEventListener('webglcontextrestored', () => { if (ui.quality !== 'low') { ui.quality = 'low'; applyQuality('low'); } dirty.all = true; if (started) { clock.last = performance.now(); raf = requestAnimationFrame(loop); } notify('3D view recovered', 'Graphics were set to Low for stability.', 'ok'); });

// ---------- boot: build the apartment (no drawing yet) ----------
function boot() {
  const cfg = (window.DH && window.DH.sim) || {};
  if (cfg.quality) ui.quality = cfg.quality; if (cfg.time != null) home.time = +cfg.time; if (cfg.season) home.season = cfg.season; if (cfg.tour != null) ui.tour = !!cfg.tour;
  buildWorld(); const stat = mergeStatic(); freezeStatic(); buildDevices(); buildActors();
  home.player.x = player.x; home.player.z = player.z; home.player.room = 'corridor';
  ui.site = true; initUI(); home.log.length = 0;
  console.info(`Apartment built: ${stat.before} static meshes merged into ${stat.after}`);
}
// Graphics are prepared the first time the simulation is entered, so the website itself stays light.
function initGraphics() {
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  setupComposer(); applyQuality(ui.quality); updateSky(home.time);
  updatePool(camera.position, home.player.room);
  try { renderer.compile(scene, camera); } catch (e) { /* shaders compile lazily instead */ }
  gfx = true;
}
async function enterSim() {
  if (started) return;
  document.documentElement.classList.add('in-sim'); document.getElementById('sim').classList.remove('hidden'); document.getElementById('hud').classList.remove('hidden');
  ui.site = false; ui.dockPlan?.(false);
  if (!gfx) { document.getElementById('sim-loading').classList.remove('hidden'); await new Promise(r => setTimeout(r, 30)); initGraphics(); document.getElementById('sim-loading').classList.add('hidden'); }
  audio.init(); resize(); initUI();
  started = true; clock.last = performance.now(); fAcc = fN = 0; lock(); raf = requestAnimationFrame(loop);
  if (!welcomed) { welcomed = true; setTimeout(() => notify('Welcome to apartment A·1204', 'Walk to the door and press E on the smart lock to unlock it.', 'info'), 600); }
}
function exitSim() {
  if (!started) return;
  if (photoOn) photo(); started = false; cancelAnimationFrame(raf); keys.clear(); closeOverlay(false); document.exitPointerLock?.();
  audio.setMusic(0, false); audio.siren(false);
  document.documentElement.classList.remove('in-sim'); document.getElementById('sim').classList.add('hidden');
  ui.site = true; ui.dockPlan?.(true);
}
ui.enterSim = enterSim; ui.exitSim = exitSim;
document.getElementById('exit-sim').addEventListener('click', exitSim);

// While only the website is showing, the home keeps living at a slow tick so the 2D diagram is real.
let siteT = 0;
setInterval(() => {
  if (started || document.hidden || !ui.site) return;
  siteT += 0.2; tickSim(0.2, actors); updateActors(0.2, 0, false, siteT); for (const u of updaters) u(0.2, siteT);
  refreshPlanMap();
}, 200);


// handy for demos and automated tests
window.SIM = { stats: () => { renderer.info.autoReset = false; renderer.info.reset(); render(); const r = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, programs: renderer.info.programs.length }; renderer.info.autoReset = true; return r; }, toggle, home, set, dev, player, runScene, arm, bus, ui, camera, renderer, scene, photo, enterSim, exitSim, get pt() { return pt; }, get started() { return started; } };
if (window.DH) Object.assign(window.DH, { enter: enterSim, exit: exitSim, applyQuality: q => { ui.quality = q; if (gfx) applyQuality(q); }, focusCategory, bus, home, ui });
try { boot(); window.DH?.onReady?.(); } catch (e) { console.error(e); window.DH?.onError?.(e); }
