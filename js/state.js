// Central state store + event bus for the simulated home.
export const bus = {
  _m: {},
  on(e, f) { (this._m[e] ??= []).push(f); },
  emit(e, d) { (this._m[e] || []).slice().forEach(f => f(d)); },
};

// Room rectangles: [x0, z0, x1, z1] in metres.
export const ROOMS = {
  living:   { name: 'Living Room',     rect: [0, 4, 7, 9] },
  kitchen:  { name: 'Kitchen',         rect: [0, 0, 4, 4] },
  bedroom:  { name: 'Guest Bedroom',   rect: [4, 0, 8, 4] },
  master:   { name: 'Master Bedroom',  rect: [7, 4, 12, 9] },
  bath:     { name: 'Master Bathroom', rect: [8, 0, 12, 4] },
  corridor: { name: 'Building Corridor', rect: [3, 9, 9, 11.6], outside: true },
  balcony:  { name: 'Balcony',         rect: [-1.6, 4.6, 0, 8.4], outside: true },
};
export const INDOOR = ['living', 'kitchen', 'bedroom', 'master', 'bath'];

export function roomAt(x, z) {
  for (const k in ROOMS) {
    const r = ROOMS[k].rect;
    if (x >= r[0] && x < r[2] && z >= r[1] && z < r[3]) return k;
  }
  return null;
}

export const home = {
  time: 19.4,            // hours, 0..24
  timeSpeed: 1,          // simulated minutes per real second
  season: 'summer',
  outdoor: { temp: 33, hum: 40 },
  devices: {},
  climate: {},           // room -> {temp, hum}
  occupancy: {},         // room -> bool
  security: { mode: 'disarmed', alarm: null, exitDelay: 0, lockFreeze: 0 },
  music: { playing: false, track: 0, vol: 70, sync: false },
  fx: { party: false },
  log: [],
  energy: 0,
  doorbell: null,        // {t} while a visitor is ringing
  player: { room: 'corridor', x: 0, z: 0 },
  users: [
    { name: 'Owner', fp: true, face: true, pin: '2580', card: true },
    { name: 'Family', fp: true, face: false, pin: '1122', card: false },
  ],
  tempPin: null,
};
for (const r of INDOOR) { home.climate[r] = { temp: 28.5, hum: 48 }; home.occupancy[r] = false; }

export function fmtTime(t = home.time) {
  const h = Math.floor(t) % 24, m = Math.floor((t % 1) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

let pending = false;
export function changed() {
  if (pending) return;
  pending = true;
  queueMicrotask(() => { pending = false; bus.emit('change'); });
}

// Patch a device's state. `src` tells automations who did it (hand / app / scene / auto / sim).
export function set(id, patch, src = 'app') {
  const d = home.devices[id];
  if (!d) { console.warn('unknown device', id); return; }
  // A device that is not installed in this project is invisible to the smart system:
  // physical changes (a window opened by hand) still happen, but nothing is reported.
  if (d.installed === false) { if (src === 'hand' || src === 'sim' || src === 'sensor') Object.assign(d.state, patch); return; }
  const prev = { ...d.state };
  Object.assign(d.state, patch);
  bus.emit('device', { id, d, patch, prev, src });
  changed();
}
export const dev = id => home.devices[id];
export const ofType = (t, all) => Object.values(home.devices).filter(d => d.type === t && (all || d.installed !== false));
export const has = id => !!home.devices[id] && home.devices[id].installed !== false;
export const installed = () => Object.values(home.devices).filter(d => d.installed !== false);

export function log(text, level = 'info') {
  home.log.unshift({ t: fmtTime(), text, level });
  if (home.log.length > 80) home.log.pop();
  changed();
}
export function notify(title, body = '', level = 'info') {
  log(title + (body ? ' — ' + body : ''), level);
  bus.emit('notify', { title, body, level });
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
