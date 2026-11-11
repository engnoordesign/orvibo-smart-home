// Light pool. The apartment has ~35 light sources, but only a handful matter from where you stand.
// Devices describe their light as cheap "emitters"; a small fixed set of real lights is handed to
// the emitters that matter most each frame. The shader cost stays constant and low, and nothing
// ever recompiles while you walk around.
import * as THREE from 'three';
import { scene } from './world.js';

export const emitters = [];
export function emitter(o) {
  const e = { type: 'point', shadow: false, bounce: false, position: new THREE.Vector3(), target: new THREE.Vector3(), distance: 0, decay: 2, angle: 0.5, penumbra: 0.65, intensity: 0, color: new THREE.Color(1, 1, 1), room: null, max: 10, slot: null, ...o };
  emitters.push(e); return e;
}

const pool = { ps: [], pp: [], sp: [] }; let rich = false;
const SIZES = { low: [1, 4, 2], balanced: [2, 6, 3], high: [3, 9, 5], ultra: [5, 14, 7] };

export function buildPool(q) {
  for (const k in pool) { for (const s of pool[k]) { scene.remove(s.light); if (s.light.target) scene.remove(s.light.target); s.light.shadow?.map?.dispose(); s.light.dispose(); } pool[k] = []; }
  for (const e of emitters) e.slot = null;
  const [ps, pp, sp] = SIZES[q] || SIZES.balanced; rich = q === 'high' || q === 'ultra';
  for (let i = 0; i < ps; i++) {
    const l = new THREE.PointLight(0xffffff, 0, 0, 2); l.castShadow = true; l.shadow.mapSize.setScalar(q === 'ultra' ? 1024 : 512);
    l.shadow.bias = -0.006; l.shadow.camera.near = 0.15; l.shadow.camera.far = 9; l.shadow.autoUpdate = false; scene.add(l); pool.ps.push({ light: l, em: null });
  }
  for (let i = 0; i < pp; i++) { const l = new THREE.PointLight(0xffffff, 0, 3, 2); scene.add(l); pool.pp.push({ light: l, em: null }); }
  for (let i = 0; i < sp; i++) { const l = new THREE.SpotLight(0xffffff, 0, 4, 0.5, 0.65, 2); scene.add(l, l.target); pool.sp.push({ light: l, em: null }); }
}

function bind(s, e, kind) {
  if (s.em && s.em.slot === s) s.em.slot = null;
  s.em = e; e.slot = s; const l = s.light;
  l.position.copy(e.position); l.decay = e.decay;
  if (kind === 'ps') { l.distance = e.distance; l.shadow.needsUpdate = true; }
  else if (kind === 'pp') l.distance = e.shadow ? 2.7 : e.distance;      // a far room's main light, without shadows, is kept inside its room
  else { l.target.position.copy(e.target); l.target.updateMatrixWorld(); l.angle = e.angle; l.penumbra = e.penumbra; l.distance = e.distance; }
}
function assign(slots, want, kind) {
  const keep = new Set(want), free = [];
  for (const s of slots) { if (s.em && s.em.slot === s && keep.has(s.em)) keep.delete(s.em); else free.push(s); }
  for (const e of keep) { const s = free.pop(); if (!s) break; bind(s, e, kind); }
  for (const s of free) { if (s.em && s.em.slot === s) s.em.slot = null; s.em = null; s.light.intensity = 0; }
  for (const s of slots) if (s.em) { s.light.intensity = s.em.intensity * (kind === 'pp' && s.em.shadow ? 0.5 : 1); s.light.color.copy(s.em.color); }
}

const A = [], Bq = [], Cq = [];
export function updatePool(cam, room) {
  A.length = Bq.length = Cq.length = 0;
  for (const e of emitters) {
    if (e.intensity <= e.max * 0.004 || (e.bounce && !rich)) { e.score = 0; continue; }
    const d2 = cam.distanceToSquared(e.position);
    e.score = (e.room === room ? 3 : 1 / (1 + 0.06 * d2)) * Math.sqrt(e.intensity / e.max) * (e.slot ? 1.35 : 1);   // small bonus keeps assignments stable
    (e.type === 'spot' ? Cq : e.shadow ? A : Bq).push(e);
  }
  const by = (a, b) => b.score - a.score;
  A.sort(by); const main = A.slice(0, pool.ps.length); for (let i = pool.ps.length; i < A.length; i++) Bq.push(A[i]);
  Bq.sort(by); Cq.sort(by);
  assign(pool.ps, main, 'ps'); assign(pool.pp, Bq.slice(0, pool.pp.length), 'pp'); assign(pool.sp, Cq.slice(0, pool.sp.length), 'sp');
}
// Re-render the (static) shadow maps: all of them, or only the ones lighting one room.
export function refreshShadows(room) { for (const s of pool.ps) if (s.em && (!room || s.em.room === room)) s.light.shadow.needsUpdate = true; }

// The path tracer wants every lit source, not just the pooled ones.
let extra = [];
export function photoLights(on) {
  for (const l of extra) { scene.remove(l); if (l.target) scene.remove(l.target); l.dispose(); } extra = [];
  if (!on) return;
  for (const e of emitters) {
    if (e.slot || e.bounce || e.intensity <= e.max * 0.004) continue;
    const l = e.type === 'spot' ? new THREE.SpotLight(e.color, e.intensity, e.distance, e.angle, e.penumbra, e.decay) : new THREE.PointLight(e.color, e.intensity, e.distance, e.decay);
    l.position.copy(e.position); if (l.target) { l.target.position.copy(e.target); scene.add(l.target); } scene.add(l); extra.push(l);
  }
}
