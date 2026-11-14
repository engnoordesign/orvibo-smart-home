// Builds a whole simulated home from a traced floor plan: rooms (rectangles), doors, windows and the
// entry door. The demo apartment is hand-made; this file generates everything else — structure,
// basic furniture and a sensible set of ORVIBO devices in every room — from the layout data.
import * as THREE from 'three';
import { B, C, M, H, floor, wall, doorFrame, rug, TEX, makeWindow, setArea, buildSky } from './world.js';
import { home, setRooms, clamp } from './state.js';
import { emitter } from './lights.js';
import { addLight, addSwitch, addMixPad, addCurtain, addWindow, addEntry, addPresence, addClimate, addSOS, addHazard, addRelay, addCamera, addSpeaker, addTV, addAC, cove } from './devices.js';

export const ROOM_TYPES = { living: 'Living Room', kitchen: 'Kitchen', bedroom: 'Bedroom', master: 'Master Bedroom', bath: 'Bathroom', dining: 'Dining Room', office: 'Office', hall: 'Hall', other: 'Room' };
const CANON = { living: ['living', 'liv'], kitchen: ['kitchen', 'kit'], bedroom: ['bedroom', 'bed'], master: ['master', 'mas'], bath: ['bath', 'bath'] };
const T = 0.1;                     // thickness of each room's own wall shell (shared walls end up 0.2 m)
const SIDES = ['n', 's', 'w', 'e'], FACING = { n: 's', s: 'n', w: 'e', e: 'w' }, INWARD = { n: 1, s: -1, w: 1, e: -1 };
const horiz = s => s === 'n' || s === 's';
const edgeAt = (r, s) => s === 'n' ? r.z0 : s === 's' ? r.z1 : s === 'w' ? r.x0 : r.x1;
const span = (r, s) => horiz(s) ? [r.x0, r.x1] : [r.z0, r.z1];

// ---------- 1. tidy the drawn layout and work out which wall every opening belongs to ----------
export function prepareLayout(raw) {
  const rooms = raw.rooms.map(r => ({ ...r, x0: Math.min(r.x0, r.x1), x1: Math.max(r.x0, r.x1), z0: Math.min(r.z0, r.z1), z1: Math.max(r.z0, r.z1) })).filter(r => r.x1 - r.x0 >= 1.2 && r.z1 - r.z0 >= 1.2);
  if (!rooms.length) throw new Error('The layout has no rooms.');
  const mx = Math.min(...rooms.map(r => r.x0)), mz = Math.min(...rooms.map(r => r.z0)), sh = p => p && ({ ...p, x: p.x - mx, z: p.z - mz });
  const n = {};
  for (const r of rooms) {
    r.x0 -= mx; r.x1 -= mx; r.z0 -= mz; r.z1 -= mz;
    const t = ROOM_TYPES[r.type] ? r.type : 'other'; n[t] = (n[t] || 0) + 1; r.type = t;
    [r.key, r.sfx] = CANON[t] && n[t] === 1 ? CANON[t] : [t + n[t], t + n[t]];
    r.name = (r.name || '').trim() || ROOM_TYPES[t] + (n[t] > 1 ? ' ' + n[t] : '');
    r.ops = { n: [], s: [], w: [], e: [] }; r.cx = (r.x0 + r.x1) / 2; r.cz = (r.z0 + r.z1) / 2; r.w = r.x1 - r.x0; r.d = r.z1 - r.z0;
  }
  // an opening sits on every room edge that passes within 0.35 m of it
  const attach = (pt, kind, width, y0, y1) => {
    const hits = [];
    for (const r of rooms) for (const s of SIDES) {
      const [lo, hi] = span(r, s), along = horiz(s) ? pt.x : pt.z, perp = horiz(s) ? pt.z : pt.x;
      if (Math.abs(perp - edgeAt(r, s)) < 0.35 && along > lo - 0.1 && along < hi + 0.1) hits.push({ r, s });
    }
    if (!hits.length) return null;
    const first = hits[0], axisH = horiz(first.s), same = hits.filter(h => horiz(h.s) === axisH);
    const lo = Math.max(...same.map(h => span(h.r, h.s)[0])) + 0.2, hi = Math.min(...same.map(h => span(h.r, h.s)[1])) - 0.2;
    let w = Math.min(width, hi - lo); if (w < 0.6) return null;
    const c = clamp(axisH ? pt.x : pt.z, lo + w / 2, hi - w / 2), op = { a: c - w / 2, b: c + w / 2, y0, y1, kind, c, line: edgeAt(first.r, first.s), axis: axisH ? 'x' : 'z', rooms: same.map(h => h.r), sides: same.map(h => h.s) };
    for (const h of same) h.r.ops[h.s].push(op);
    return op;
  };
  const doors = (raw.doors || []).map(d => attach(sh(d), 'door', d.w || 0.9, 0, 2.1)).filter(Boolean);
  const windows = (raw.windows || []).map(w => attach(sh(w), 'window', w.w || 1.4, 0.9, 2.2)).filter(Boolean);
  // entry: must be on an outside wall; if the drawn point is not, use the longest free outside wall
  let entry = raw.entry ? attach(sh(raw.entry), 'entry', 1.0, 0, 2.1) : null;
  if (entry && entry.rooms.length > 1) { for (let i = 0; i < entry.rooms.length; i++) { const l = entry.rooms[i].ops[entry.sides[i]]; l.splice(l.indexOf(entry), 1); } entry = null; }
  if (!entry) {
    let best = null;
    for (const r of rooms) for (const s of SIDES) {
      const [lo, hi] = span(r, s), mid = (lo + hi) / 2, e = edgeAt(r, s), px = horiz(s) ? mid : e, pz = horiz(s) ? e : mid;
      const ox = px + (s === 'e' ? 0.3 : s === 'w' ? -0.3 : 0), oz = pz + (s === 's' ? 0.3 : s === 'n' ? -0.3 : 0), out = rooms.some(o => o !== r && ox > o.x0 && ox < o.x1 && oz > o.z0 && oz < o.z1);     // another room is on the other side
      if (!out && !r.ops[s].length && hi - lo >= 1.6 && (!best || (r.type === 'living' ? 100 : 0) + hi - lo > best.score)) best = { score: (r.type === 'living' ? 100 : 0) + hi - lo, pt: { x: px, z: pz } };
    }
    if (best) entry = attach(best.pt, 'entry', 1.0, 0, 2.1);
  }
  if (!entry) throw new Error('No outside wall is free for the entry door.');
  return { id: raw.id || 'custom', name: raw.name || 'Custom home', rooms, doors, windows, entry };
}

// position helpers for one wall of a room: u runs along the wall, v is the distance into the room
// (lo, len) select the free stretch of that wall, given as a world coordinate along it
function placer(r, side, lo, len) {
  const dep = horiz(side) ? r.d : r.w;
  const P = (u, v) => side === 'n' ? [lo + u, r.z0 + T + v] : side === 's' ? [lo + len - u, r.z1 - T - v] : side === 'w' ? [r.x0 + T + v, lo + len - u] : [r.x1 - T - v, lo + u];
  const box = (L, h, D, mat, u, y, v, o) => { const [x, z] = P(u, v); return B(horiz(side) ? L : D, h, horiz(side) ? D : L, mat, x, y, z, o); };
  const mount = (u, y) => { const [x, z] = P(u, 0.006); return [x, y, z]; };
  return { len, dep, P, box, mount, facing: FACING[side], side };
}
// world position on the inner face of a wall, given a coordinate along it
const onWall = (r, side, along, y) => horiz(side) ? [along, y, side === 'n' ? r.z0 + T + 0.006 : r.z1 - T - 0.006] : [side === 'w' ? r.x0 + T + 0.006 : r.x1 - T - 0.006, y, along];

let L = null;
// ---------- 2. structure and furniture ----------
export function buildCustomWorld(raw) {
  L = prepareLayout(raw); buildSky();
  const e = L.entry, er = e.rooms[0], es = e.sides[0], nx = es === 'e' ? 1 : es === 'w' ? -1 : 0, nz = es === 's' ? 1 : es === 'n' ? -1 : 0;
  const ex = e.axis === 'x' ? e.c : e.line, ez = e.axis === 'x' ? e.line : e.c;
  // a small porch outside the entry door: this is where the visitor starts
  const px0 = e.axis === 'x' ? ex - 1.4 : Math.min(ex, ex + nx * 2.5), px1 = e.axis === 'x' ? ex + 1.4 : Math.max(ex, ex + nx * 2.5), pz0 = e.axis === 'x' ? Math.min(ez, ez + nz * 2.5) : ez - 1.4, pz1 = e.axis === 'x' ? Math.max(ez, ez + nz * 2.5) : ez + 1.4;
  const rooms = {}; for (const r of L.rooms) rooms[r.key] = { name: r.name, rect: [r.x0, r.z0, r.x1, r.z1], rtype: r.type };
  rooms.corridor = { name: 'Entrance', rect: [px0, pz0, px1, pz1], outside: true };
  setRooms(rooms);
  floor(px0, pz0, px1, pz1, TEX.stone(), 1.3, { color: 0x9a9690 }); B(px1 - px0 + 0.2, 0.2, pz1 - pz0 + 0.2, M.ceil, (px0 + px1) / 2, H + 0.1, (pz0 + pz1) / 2);
  if (e.axis === 'x') { wall('x', ez + nz * 2.5, px0, px1, [], 0.14, M.wallOut); wall('z', px0, pz0, pz1, [], 0.14, M.wallOut); wall('z', px1, pz0, pz1, [], 0.14, M.wallOut); }
  else { wall('z', ex + nx * 2.5, pz0, pz1, [], 0.14, M.wallOut); wall('x', pz0, px0, px1, [], 0.14, M.wallOut); wall('x', pz1, px0, px1, [], 0.14, M.wallOut); }
  B(e.axis === 'x' ? 1.0 : 0.6, 0.02, e.axis === 'x' ? 0.6 : 1.0, M.char, ex + nx * 0.5, 0.011, ez + nz * 0.5, { cast: false });

  const TEXOF = { kitchen: [TEX.tile, 1.2, { roughness: 0.35 }], bath: [TEX.stone, 1.0, { roughness: 0.4 }], hall: [TEX.tile, 1.2, { roughness: 0.35 }] };
  for (const r of L.rooms) {
    const [tex, sc, ex2] = TEXOF[r.type] || [TEX.wood, 2.6, {}];
    floor(r.x0, r.z0, r.x1, r.z1, tex(), sc, ex2); B(r.w, 0.2, r.d, M.ceil, r.cx, H + 0.1, r.cz);
    wall('x', r.z0 + T / 2, r.x0, r.x1, r.ops.n, T); wall('x', r.z1 - T / 2, r.x0, r.x1, r.ops.s, T);
    wall('z', r.x0 + T / 2, r.z0, r.z1, r.ops.w, T); wall('z', r.x1 - T / 2, r.z0, r.z1, r.ops.e, T);
    // the wall with no door or window (the longest such) takes the main furniture
    // the main furniture goes on the longest stretch of wall that has no door or window in it
    let best = null;
    for (const s of SIDES) {
      const [lo, hi] = span(r, s), cuts = r.ops[s].map(o => [o.a - 0.25, o.b + 0.25]).sort((p, q) => p[0] - q[0]); let cur = lo;
      for (const [a, b] of [...cuts, [hi, hi]]) { if (a - cur > (best ? best.len : 0)) best = { s, lo: cur, len: a - cur }; cur = Math.max(cur, b); }
    }
    r.anchor = placer(r, best.s, best.lo, best.len); r.furn = {};
    furnish(r);
  }
  for (const d of [...L.doors, e]) doorFrame(d.axis, d.line, d.a, d.b);

  const xs = [px0, px1, ...L.rooms.flatMap(r => [r.x0, r.x1])], zs = [pz0, pz1, ...L.rooms.flatMap(r => [r.z0, r.z1])];
  const bx0 = Math.min(...xs), bx1 = Math.max(...xs), bz0 = Math.min(...zs), bz1 = Math.max(...zs);
  Object.assign(home.meta, { custom: true, id: L.id, name: L.name, bounds: [bx0 - 0.3, bz0 - 0.3, bx1 + 0.3, bz1 + 0.3], center: { x: (bx0 + bx1) / 2, z: (bz0 + bz1) / 2 },
    entry: { x: ex, z: ez, nx, nz }, start: { x: ex + nx * 1.7, z: ez + nz * 1.7, yaw: Math.atan2(nx, nz) }, windows: [], breakin: null });
  setArea(home.meta.center.x, home.meta.center.z, Math.max(bx1 - bx0, bz1 - bz0) / 2 + 4);
  L.e = { ex, ez, nx, nz, er, es };
}

function furnish(r) {
  const a = r.anchor, { len, dep, box, P } = a, mid = len / 2;
  if (r.type === 'living' && len >= 2.4) {
    const cw = Math.min(2.2, len - 0.5); box(cw, 0.36, 0.42, M.char, mid, 0.38, 0.26, { collide: true }); box(cw + 0.04, 0.03, 0.44, M.oak, mid, 0.575, 0.26); r.furn.console = true;
    if (dep >= 3.2 && len >= 2.8) {
      const vs = clamp(dep * 0.62, 2.3, dep - 0.9); box(2.2, 0.4, 0.9, M.greige, mid, 0.22, vs, { collide: true }); box(2.2, 0.48, 0.22, M.greige, mid, 0.62, vs + 0.36);
      box(0.5, 0.3, 0.14, M.sage, mid - 0.6, 0.62, vs + 0.18); box(0.5, 0.3, 0.14, M.terra, mid + 0.6, 0.62, vs + 0.18);
      if (vs - 1.05 > 1.0) { const [x, z] = P(mid, vs - 1.05); C(0.45, 0.04, M.marble, x, 0.38, z, { collide: true }); C(0.04, 0.36, M.brass, x, 0.18, z); const [rx, rz] = P(mid, vs - 0.6); rug(rx, rz, horiz(a.side) ? 3 : 2.2, horiz(a.side) ? 2.2 : 3, 0xcfc7b8); }
    }
  } else if ((r.type === 'bedroom' || r.type === 'master') && dep >= 2.5) {
    const bw = r.type === 'master' ? 1.8 : 1.4; if (len < bw + 0.5) return;
    box(bw, 0.28, 2.0, M.walnut, mid, 0.16, 1.05, { collide: true }); box(bw - 0.06, 0.2, 1.94, M.white, mid, 0.4, 1.05); box(bw - 0.04, 0.08, 1.25, r.type === 'master' ? M.char : M.sage, mid, 0.52, 1.4);
    box(bw * 0.38, 0.12, 0.42, M.cream, mid - bw * 0.24, 0.57, 0.36); box(bw * 0.38, 0.12, 0.42, M.cream, mid + bw * 0.24, 0.57, 0.36); box(bw + 0.3, 1.0, 0.08, M.greige, mid, 0.62, 0.05);
    if (len >= bw + 1.3) { box(0.45, 0.42, 0.4, M.oak, mid + bw / 2 + 0.35, 0.21, 0.24, { collide: true }); r.furn.night = mid + bw / 2 + 0.35; }
    r.furn.bed = bw;
  } else if (r.type === 'kitchen' && len >= 1.8) {
    const cab = new THREE.MeshStandardMaterial({ color: 0x3c4a44, roughness: 0.6 }), cl = Math.min(len - 0.3, 3.4);
    box(cl, 0.88, 0.6, cab, mid, 0.44, 0.31, { collide: true }); box(cl + 0.04, 0.04, 0.64, M.marble, mid, 0.9, 0.32); box(0.6, 0.012, 0.5, M.black, mid - cl / 2 + 0.5, 0.925, 0.32, { cast: false });
    if (dep >= 3.4 && len >= 2.6) { box(1.5, 0.86, 0.7, M.walnut, mid, 0.43, 2.0, { collide: true }); box(1.62, 0.05, 0.82, M.marble, mid, 0.885, 2.0); }
  } else if (r.type === 'bath') {
    if (len >= 1.3) { box(1.0, 0.4, 0.5, M.walnut, 0.75, 0.62, 0.26, { collide: true }); box(1.04, 0.04, 0.54, M.marble, 0.75, 0.84, 0.27); const [x, z] = P(0.75, 0.27); C(0.2, 0.1, M.ceramic, x, 0.91, z, { rt: 0.22 }); }
    if (len >= 2.3) { box(0.38, 0.4, 0.6, M.ceramic, len - 0.55, 0.2, 0.34, { collide: true }); box(0.4, 0.42, 0.18, M.ceramic, len - 0.55, 0.6, 0.1); }
  } else if (r.type === 'dining' && r.w >= 2.6 && r.d >= 2.6) {
    B(1.6, 0.05, 0.9, M.oak, r.cx, 0.74, r.cz, { collide: true }); for (const [dx, dz] of [[-0.7, -0.35], [0.7, -0.35], [-0.7, 0.35], [0.7, 0.35]]) B(0.05, 0.72, 0.05, M.black, r.cx + dx, 0.36, r.cz + dz);
  } else if (r.type === 'office' && len >= 1.8) { box(1.5, 0.04, 0.6, M.oak, mid, 0.74, 0.34, { collide: true }); box(0.04, 0.72, 0.55, M.black, mid - 0.7, 0.36, 0.34); box(0.04, 0.72, 0.55, M.black, mid + 0.7, 0.36, 0.34); }
}

// ---------- 3. devices: a sensible ORVIBO set in every room (all of it can be changed afterwards) ----------
export function buildCustomDevices() {
  const { ex, ez, nx, nz, er, es } = L.e; let cam = null;
  for (const r of L.rooms) {
    const s = r.sfx, k = r.key, a = r.anchor, cosy = ['living', 'bedroom', 'master', 'dining', 'office'].includes(r.type), first = Object.values(CANON).some(c => c[1] === s);
    const id = base => first ? base : `${base}_${s}`;
    const fnx = Math.max(1, Math.round(r.w / 2.2)), fnz = Math.max(1, Math.round(r.d / 2.2)), fix = [];
    for (let i = 0; i < fnx; i++) for (let j = 0; j < fnz; j++) fix.push([r.x0 + r.w * (i + 0.5) / fnx, r.z0 + r.d * (j + 0.5) / fnz]);
    addLight(`l_${s}_down`, k, `${r.name} downlights`, 'down', { pos: [r.cx, 2.4, r.cz], I: clamp(8 + r.w * r.d * 0.45, 9, 19), watts: 9 * fix.length, fix, cct: r.type === 'kitchen' || r.type === 'bath' ? 4000 : 3000 });
    const btns = [{ label: 'Downlights', light: `l_${s}_down` }];
    if (cosy || r.type === 'kitchen') { addLight(`l_${s}_strip`, k, `${r.name} shadow-line strip`, 'strip', { pos: [r.cx, 2.5, r.cz], I: 4.5, range: Math.max(r.w, r.d) / 2 + 1, watts: Math.round(5 * (r.w + r.d)), segs: cove(r.x0, r.z0, r.x1, r.z1, 0.2) }); btns.push({ label: 'Shadow-line strip', light: `l_${s}_strip` }); }
    addPresence(k, r.cx + 0.35, r.cz + 0.25);

    // windows, their sensors and a curtain on the first one
    let wi = 0;
    for (const sd of SIDES) for (const op of r.ops[sd]) {
      if (op.kind !== 'window' || op.done) continue; op.done = true;
      const at = edgeAt(r, sd) + INWARD[sd] * T / 2, wid = `ws_${s}${wi ? '_' + (wi + 1) : ''}`;
      addWindow(wid, k, `${r.name} window${wi ? ' ' + (wi + 1) : ''}`, makeWindow(op.axis, at, op.a, op.b, 0.9, 2.2), { ac: `ac_${s}`, cam: 'cam_liv', sgn: INWARD[sd] });
      home.meta.windows.push([op.axis, op.line, op.a, op.b, wid]);
      if (!home.meta.breakin && op.rooms.length === 1) home.meta.breakin = { id: wid, x: op.axis === 'x' ? op.c : op.line, z: op.axis === 'x' ? op.line : op.c, nx: op.axis === 'z' ? -INWARD[sd] : 0, nz: op.axis === 'x' ? -INWARD[sd] : 0, cx: r.cx, cz: r.cz };
      if (!wi && cosy) { addCurtain(`cur_${s}`, k, `${r.name} curtain`, op.axis, edgeAt(r, sd) + INWARD[sd] * (T + 0.1), op.a - 0.25, op.b + 0.25, 0.5, 2.5); btns.push({ label: 'Curtain', curtain: `cur_${s}` }); }
      wi++;
    }
    // wall switch, temperature sensor and (main rooms) a MixPad beside the room's door
    let sd = SIDES.find(x => r.ops[x].some(o => o.kind !== 'window')), op = sd && r.ops[sd].find(o => o.kind !== 'window');
    if (r === er) { sd = es; op = L.entry; }
    let side = sd || a.side, p0, dir = 1;
    if (op) { const [, hi] = span(r, side); dir = op.b + 1.1 < hi ? 1 : -1; p0 = dir > 0 ? op.b + 0.3 : op.a - 0.3; } else { const [lo, hi] = span(r, side); p0 = (lo + hi) / 2; }
    addSwitch(`sw_${s}`, k, `${r.name} MixSwitch`, onWall(r, side, p0, 1.35), FACING[side], btns.slice(0, 3));
    addClimate(k, onWall(r, side, p0 + dir * 0.3, 1.5), FACING[side]);
    if (r.type === 'living' || r.type === 'master') addMixPad(`mp_${s}`, k, `${r.name} MixPad`, onWall(r, side, p0 + dir * 0.65, 1.42), FACING[side], r.type === 'living' ? 'X' : undefined);

    if (cosy && a.len >= 1.6) addAC(`ac_${s}`, k, `${r.name} AC`, a.mount(a.len / 2, 2.5), a.facing);
    if ((r.type === 'living' || r.type === 'master') && a.len >= 2.4 && !(r.type === 'master' && r.furn.bed)) addTV(`tv_${s}`, k, `${r.name} TV`, a.mount(a.len / 2, 1.45), a.facing, Math.min(1.6, a.len - 1));
    if (r.type === 'living' && r.furn.console) { const [x, z] = a.P(a.len / 2 + 0.75, 0.26); addSpeaker(`spk_${s}`, k, 'Artist Box (master)', [x, 0.69, z], true); }
    else if (r.type !== 'hall' && r.type !== 'other') addSpeaker(`spk_${s}`, k, `${r.name} ceiling speaker`, [r.cx - 0.5, H, r.cz - 0.4]);
    if (r.type === 'living' || r.type === 'kitchen') { const cid = r.type === 'living' ? id('cam_liv') : id('cam_kit'); addCamera(cid, k, r.name, [r.x0 + 0.4, 2.55, r.z0 + 0.4], [r.cx + 0.4, 0.9, r.cz + 0.4]); cam = cam || cid; }
    if (r.type === 'kitchen') { addHazard(id('hz_smoke'), k, 'Smoke sensor', [r.cx - 0.4, H, r.cz + 0.4], 'smoke'); addHazard(id('hz_gas'), k, 'Gas sensor', a.mount(0.35, 1.5), 'gas'); addRelay(id('valve_gas'), k, 'Gas valve', a.mount(0.8, 1.12), true); }
    if (r.type === 'bath') { addRelay(`fan_${s}`, k, 'Exhaust fan', [r.cx + 0.5, H, r.cz - 0.4], false, 'fan'); addHazard(id('hz_leak'), k, 'Water-leak sensor', [r.cx, 0, r.cz + 0.4], 'leak'); addRelay(id('valve_water'), k, 'Water valve', a.mount(0.25, 0.35), true); addSOS(`sos_${s}`, k, a.mount(a.len - 0.3, 0.95), a.facing); }
    if (r.type === 'master' || r.type === 'bedroom') addSOS(`sos_${s}`, k, a.mount(r.furn.night ? r.furn.night : a.len - 0.3, 0.95), a.facing);
    if (r.type === 'living' || r.type === 'master' || r.type === 'bedroom') addHazard(`hz_smoke_${s}`, k, 'Smoke sensor', [r.cx - 0.6, H, r.cz - 0.5], 'smoke');
  }
  // entry door with the smart lock, its light, the porch light and the entrance camera
  const rot = es === 's' ? 0 : es === 'n' ? Math.PI : es === 'e' ? Math.PI / 2 : -Math.PI / 2, e = L.entry, wc = edgeAt(er, es) + INWARD[es] * T / 2;
  const hinge = es === 's' ? [e.a + 0.06, wc] : es === 'n' ? [e.b - 0.06, wc] : es === 'e' ? [wc, e.b - 0.06] : [wc, e.a + 0.06];
  addEntry({ x: hinge[0], z: hinge[1], rot, room: er.key });
  const ix = ex - nx * 0.9, iz = ez - nz * 0.9;
  addLight('l_entry', er.key, 'Entry downlight', 'down', { pos: [ix, 2.45, iz], I: 5, range: 3.4, shadow: false, watts: 9, fix: [[ix, iz]] });
  emitter({ position: new THREE.Vector3(ex + nx * 1.2, 2.5, ez + nz * 1.2), distance: 6, room: 'corridor', intensity: 8, max: 8, color: new THREE.Color(0xffe2bd) });
  C(0.09, 0.012, new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: 0xffe2bd, emissiveIntensity: 5 }), ex + nx * 1.2, H - 0.006, ez + nz * 1.2, { cast: false });
  addCamera('cam_entry', 'corridor', 'Entrance', [ex + nx * 2.2 + nz * 1.0, 2.55, ez + nz * 2.2 + nx * 1.0], [ex, 1.0, ez], true);
}
