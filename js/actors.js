// Human figures: the player's avatar (seen only by the cameras), intruder and visitor scenarios.
import * as THREE from 'three';
import { scene } from './world.js';
import { home, set, dev, notify, bus } from './state.js';
import { unlockAttempt, ringDoorbell } from './sim.js';

function makeHuman({ top = 0x2d4a6a, pants = 0x22252b, skin = 0xd9a885, hood = false, box = false }) {
  const g = new THREE.Group(), mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
  const add = (geo, m, x, y, z, parent = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = false; parent.add(o); return o; };
  const mt = mat(top), mp = mat(pants), ms = mat(skin);
  add(new THREE.BoxGeometry(0.42, 0.58, 0.24), mt, 0, 1.17, 0);
  add(new THREE.SphereGeometry(0.115, 14, 10), hood ? mt : ms, 0, 1.62, 0);
  if (hood) add(new THREE.SphereGeometry(0.09, 10, 8), mat(0x101010), 0, 1.6, 0.05);
  const limb = (x, y, len, m, w = 0.13) => { const p = new THREE.Group(); p.position.set(x, y, 0); g.add(p); add(new THREE.BoxGeometry(w, len, w + 0.02), m, 0, -len / 2, 0, p); return p; };
  const parts = { lL: limb(-0.11, 0.88, 0.86, mp, 0.15), lR: limb(0.11, 0.88, 0.86, mp, 0.15), aL: limb(-0.27, 1.44, 0.6, mt, 0.11), aR: limb(0.27, 1.44, 0.6, mt, 0.11) };
  if (box) { add(new THREE.BoxGeometry(0.34, 0.26, 0.3), mat(0xb58a56), 0, 1.12, 0.28); parts.aL.rotation.x = parts.aR.rotation.x = -1.0; parts.carry = true; }
  g.userData.walk = (ph, moving) => {
    const s = moving ? Math.sin(ph) * 0.6 : 0;
    parts.lL.rotation.x = s; parts.lR.rotation.x = -s;
    if (!parts.carry) { parts.aL.rotation.x = -s * 0.8; parts.aR.rotation.x = s * 0.8; }
  };
  scene.add(g); g.visible = false; return g;
}

export const actors = [];
function actor(opts) {
  const a = { mesh: makeHuman(opts), x: 0, z: 0, active: false, path: [], speed: 1.4, ph: 0, wait: 0, name: opts.name };
  actors.push(a); return a;
}
let avatar, intruder, visitor;
export function buildActors() {
  avatar = makeHuman({ top: 0xe8e2d6, pants: 0x30343a }); avatar.visible = true; avatar.traverse(o => o.layers.set(1));
  intruder = actor({ top: 0x16171a, pants: 0x0e0f11, hood: true, name: 'intruder' });
  visitor = actor({ top: 0xc8452c, pants: 0x2a2f3a, box: true, name: 'visitor' });
}
function go(a, path, speed, done) { a.path = path.map(p => ({ x: p[0], z: p[1], wait: p[2] || 0, fn: p[3] })); a.speed = speed; a.done = done; }
function place(a, x, z, face) { a.x = x; a.z = z; a.mesh.position.set(x, 0, z); a.mesh.rotation.y = face ?? 0; a.mesh.visible = true; a.active = true; }
function leave(a) { a.active = false; a.mesh.visible = false; a.path = []; }
export const busy = () => intruder.active || visitor.active;

export function updateActors(dt, yaw, moving, t) {
  avatar.position.set(home.player.x, 0, home.player.z); avatar.rotation.y = yaw + Math.PI; avatar.userData.walk(t * 9, moving);
  for (const a of actors) {
    if (!a.active) continue;
    if (a.wait > 0) { a.wait -= dt; a.mesh.userData.walk(0, false); continue; }
    const p = a.path[0];
    if (!p) { a.mesh.userData.walk(0, false); if (a.done) { const f = a.done; a.done = null; f(); } continue; }
    const dx = p.x - a.x, dz = p.z - a.z, d = Math.hypot(dx, dz), st = a.speed * dt;
    if (d <= st) { a.x = p.x; a.z = p.z; a.path.shift(); a.wait = p.wait; p.fn?.(); }
    else { a.x += dx / d * st; a.z += dz / d * st; a.mesh.rotation.y = Math.atan2(dx, dz); }
    a.ph += dt * a.speed * 6; a.mesh.userData.walk(a.ph, true); a.mesh.position.set(a.x, 0, a.z);
  }
}

let onIntrusion = null;
bus.on('alarm', a => { if (intruder.active && a.type === 'intrusion' && onIntrusion) { const f = onIntrusion; onIntrusion = null; f(); } });
// --- Scenario 1: burglar forces the balcony window ---
export function breakIn() {
  if (busy()) return notify('A simulation is already running', '', 'warn');
  const armed = home.security.mode !== 'disarmed';
  notify('Simulation started', 'An intruder is climbing onto the balcony…', 'warn');
  place(intruder, -1.1, 5.2);
  let fled = false;
  const flee = () => {
    if (fled) return; fled = true;
    go(intruder, [[0.7, 5.0], [0.7, 7.2], [-0.8, 7.2], [-1.2, 5.0]], 3.4, () => {
      leave(intruder); set('ws_liv', { open: false }, 'sim');
      notify('Intruder fled', 'The siren, lights and cameras drove the intruder away. A video clip was saved to the cloud.', 'ok');
    });
  };
  onIntrusion = () => { intruder.wait = 0; setTimeout(flee, 2500); };
  go(intruder, [
    [-0.7, 7.2, 1.2], [-0.45, 7.2, 0.9, () => set('ws_liv', { open: true }, 'sim')],
    [0.7, 7.2, 0.4], [0.7, 5.0], [4.6, 4.8], [5.4, 7.4, 4],
  ], 1.3, () => {
    if (fled) return;
    if (!home.security.alarm) {
      notify('No alarm was raised', armed ? '' : 'The system was disarmed, so the intruder walked in unnoticed. Arm “Home” or “Away” and try again.', 'warn');
      go(intruder, [[4.6, 4.8], [0.7, 5.0], [0.7, 7.2], [-0.8, 7.2], [-1.2, 5.0]], 1.6, () => { leave(intruder); set('ws_liv', { open: false }, 'sim'); });
    }
  });
}

// --- Scenario 2: someone guesses PIN codes at the door ---
export function lockTamper() {
  if (busy()) return notify('A simulation is already running', '', 'warn');
  if (dev('lock').state.open) return notify('Close the entry door first', '', 'warn');
  notify('Simulation started', 'A stranger is trying PIN codes at the entry door…', 'warn');
  place(intruder, 3.6, 11.0);
  const tries = []; for (let i = 0; i < 5; i++) tries.push([5.85, 9.55 + (i % 2) * 0.01, 1.1, () => unlockAttempt('PIN', false, 'unknown')]);
  go(intruder, [[5.85, 9.6, 0.8], ...tries, [5.85, 9.6, 1.5], [3.5, 11.1]], 1.5, () => leave(intruder));
}

// --- Scenario 3: courier rings the bell ---
export function visitorRings() {
  if (busy()) return notify('A simulation is already running', '', 'warn');
  place(visitor, 3.6, 10.9);
  go(visitor, [[5.75, 9.75, 0.3, () => { visitor.mesh.rotation.y = Math.PI; ringDoorbell('Courier with a parcel'); }], [5.75, 9.76, 22], [3.5, 11.0]], 1.4, () => { leave(visitor); home.doorbell = null; });
}
// --- Scenario 4: forced entry through the door while armed ---
export function forcedDoor() {
  if (busy()) return notify('A simulation is already running', '', 'warn');
  notify('Simulation started', 'Someone is forcing the entry door…', 'warn');
  place(intruder, 3.6, 11.0);
  go(intruder, [[5.7, 9.7, 1.2, () => { const l = dev('lock'); l.state.forced = true; set('lock', { open: true, forced: true }, 'sim'); }], [5.7, 8.2, 3], [5.7, 9.7], [3.5, 11.1]], 1.6, () => leave(intruder));
}
