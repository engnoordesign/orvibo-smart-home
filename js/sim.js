// Home logic: scenes, automations, security, climate, presence, energy and time.
import { bus, home, set, dev, ofType, notify, log, INDOOR, ROOMS, clamp, changed, roomAt } from './state.js';
import { audio } from './audio.js';

const lights = (room) => ofType('light').filter(l => !room || l.room === room);
const L = (id, on, bri, o = {}) => set(id, { on, ...(bri != null ? { bri } : {}), rgb: null, fade: 1.8, ...o }, 'scene');
const lightsOff = (fade = 2, except = []) => lights().forEach(l => { if (!except.includes(l.id) && l.state.on) set(l.id, { on: false, fade }, 'scene'); });
const curtains = (pos, only) => ofType('curtain').forEach(c => { if (!only || only.includes(c.id)) set(c.id, { pos }, 'scene'); });
const acs = (patch, only) => ofType('ac').forEach(a => { if (!only || only.includes(a.id)) set(a.id, patch, 'scene'); });
const tvs = (on, ch) => ofType('tv').forEach(t => set(t.id, { on, ...(ch != null ? { ch } : {}) }, 'scene'));
const isNight = () => home.time >= 18.25 || home.time < 6.5;
export function music(playing, o = {}) {
  Object.assign(home.music, { playing }, o.track != null ? { track: o.track } : {}, o.vol != null ? { vol: o.vol } : {}, o.sync != null ? { sync: o.sync } : {});
  if (o.zones) ofType('speaker').forEach(s => set(s.id, { on: o.zones === 'all' || o.zones.includes(s.id) }, 'scene'));
  bus.emit('music'); changed();
}
const comfort = () => home.season === 'summer' ? { on: true, mode: 'cool', set: 24, fan: 2 } : { on: true, mode: 'heat', set: 23, fan: 2 };

export const SCENES = {
  welcome: { name: 'Welcome Home', icon: '🏠', desc: 'Disarm, entry and living lights fade on, climate and music start.', run() {
    L('l_entry', true, 100, { fade: 0.6 }); L('l_liv_down', true, 70, { cct: 3000, fade: 2.5 }); L('l_liv_strip', true, 60, { rgb: '#ffb060', fade: 3 });
    L('l_liv_spot', true, 60, { fade: 3 }); L('l_kit_strip', true, 50, { fade: 3 });
    curtains(isNight() ? 100 : 0); acs(comfort(), ['ac_liv']);
    music(true, { track: 0, vol: 45, zones: ['spk_liv'] }); audio.say('Welcome home.');
  } },
  leave: { name: 'Leave Home', icon: '🚪', desc: 'Everything off, curtains closed, door locked and the alarm armed (Away).', run() {
    lightsOff(2.5); curtains(100); acs({ on: false }); tvs(false); music(false); set('lock', { locked: true }, 'scene'); arm('away', 'scene');
  } },
  movie: { name: 'Movie Night', icon: '🎬', desc: 'Lights dim to a blue glow, curtains close and the TV starts.', run() {
    lightsOff(3, ['l_liv_strip']); L('l_liv_strip', true, 22, { rgb: '#3344ff', fade: 3 }); curtains(100, ['cur_liv']);
    music(false); set('tv_liv', { on: true, ch: 3 }, 'scene'); acs({ ...comfort(), fan: 1 }, ['ac_liv']);
  } },
  dinner: { name: 'Dinner', icon: '🍽️', desc: 'Warm pendants over the island, soft living-room light and lounge music.', run() {
    L('l_kit_pend', true, 75, { cct: 2700 }); L('l_kit_down', true, 25, { cct: 2700 }); L('l_kit_strip', true, 70, { cct: 2700 });
    L('l_liv_down', true, 25, { cct: 2700 }); L('l_liv_spot', true, 55, { cct: 2700 }); L('l_liv_strip', true, 45, { rgb: '#ff9a4a' }); L('l_entry', false);
    tvs(false); music(true, { track: 0, vol: 40, zones: ['spk_liv', 'spk_kit'] });
  } },
  party: { name: 'Party', icon: '🎉', desc: 'Colour-cycling strips synced to the beat, music in every room.', run() {
    lights().forEach(l => l.kind === 'strip' ? L(l.id, true, 100, { rgb: '#ff00aa', fade: 0.5 }) : L(l.id, l.kind === 'spot', 50, { fade: 1 }));
    L('l_liv_down', true, 20); music(true, { track: 1, vol: 80, zones: 'all', sync: true }); home.fx.party = true;
  } },
  sleep: { name: 'Good Night', icon: '🌙', desc: 'All off with a slow fade, curtains closed, door locked, perimeter armed.', run() {
    lightsOff(4, ['l_mas_strip']); L('l_mas_strip', true, 6, { rgb: '#ff8a3a', fade: 4 }); curtains(100); tvs(false); music(false);
    acs({ on: false }, ['ac_liv', 'ac_bed']); acs({ ...comfort(), set: home.season === 'summer' ? 25 : 22, fan: 1 }, ['ac_mas']);
    set('lock', { locked: true }, 'scene'); arm('home', 'scene');
  } },
  morning: { name: 'Good Morning', icon: '☀️', desc: 'Curtains open, cool white light fades in, gentle piano in the master and kitchen.', run() {
    arm('disarmed', 'scene'); curtains(0); L('l_mas_down', true, 60, { cct: 5000, fade: 5 }); L('l_mas_strip', false); L('l_kit_down', true, 70, { cct: 4500, fade: 4 });
    L('l_bath_down', true, 80, { cct: 4500 }); L('l_bath_mirror', true, 90, { cct: 5000 });
    music(true, { track: 2, vol: 35, zones: ['spk_mas', 'spk_kit', 'spk_bath'] });
  } },
  reading: { name: 'Reading', icon: '📖', desc: 'Bright neutral spotlights over the sofa, everything else calm.', run() {
    L('l_liv_spot', true, 95, { cct: 4000 }); L('l_liv_down', true, 30, { cct: 4000 }); L('l_liv_strip', false); tvs(false); music(true, { track: 2, vol: 20, zones: ['spk_liv'] });
  } },
  romantic: { name: 'Romantic', icon: '🌹', desc: 'Rose-coloured indirect light at low level with chill music.', run() {
    lightsOff(3, ['l_liv_strip', 'l_mas_strip', 'l_liv_spot']); L('l_liv_strip', true, 40, { rgb: '#ff3b6b', fade: 3 }); L('l_mas_strip', true, 35, { rgb: '#ff3b6b', fade: 3 });
    L('l_liv_spot', true, 18, { cct: 2700, fade: 3 }); music(true, { track: 3, vol: 35, zones: ['spk_liv', 'spk_mas'] });
  } },
  alloff: { name: 'All Off', icon: '⏻', desc: 'Every light, TV and speaker off.', run() { lightsOff(1.5); tvs(false); music(false); } },
};
export function runScene(key, src = 'app') {
  const s = SCENES[key]; if (!s) return;
  if (key !== 'party') home.fx.party = false;
  s.run(); audio.sfx('scene'); log(`Scene “${s.name}” activated (${src})`); bus.emit('scene', { key, src }); changed();
}

// ---------- automations ----------
export const AUTOS = [
  { id: 'welcome', name: 'Welcome home', when: 'Door unlocked from outside by fingerprint, face, PIN or card', then: 'Disarm and run “Welcome Home”', on: true },
  { id: 'presence', name: 'Presence lighting', when: 'Presence sensor detects someone in a dark room', then: 'Lights on (dim warm night-path after 23:00); off when the room is empty', on: true },
  { id: 'comfort', name: 'Comfort climate', when: 'Occupied room leaves the 19–27 °C comfort band', then: 'Start the air-conditioning at the comfort set-point', on: true },
  { id: 'window', name: 'Open-window energy saving', when: 'A window sensor reports “open”', then: 'Pause that room’s air-conditioning until it closes', on: true },
  { id: 'humidity', name: 'Bathroom ventilation', when: 'Bathroom humidity rises above 70 %', then: 'Run the exhaust fan until it falls below 55 %', on: true },
  { id: 'sunset', name: 'Sunset / sunrise', when: 'Sunset (18:15) or sunrise (06:30)', then: 'Close curtains at dusk, open them in the morning', on: true },
  { id: 'doorbell', name: 'Doorbell', when: 'A visitor rings the smart lock', then: 'Lower the music and show the door camera on the MixPad and phone', on: true },
  { id: 'dooropen', name: 'Door left open', when: 'Entry door stays open for 20 s', then: 'Push a reminder to the phone', on: true },
  { id: 'nightarm', name: 'Night auto-arm', when: 'Clock reaches 23:30', then: 'Lock the door and arm the perimeter (Home mode)', on: false },
  { id: 'intrusion', name: 'Intrusion response', when: 'Armed and a door / window / presence sensor trips', then: 'Siren, all lights on, strips flash red, cameras record, phone alert', on: true, locked: true },
  { id: 'safety', name: 'Fire, gas and leak protection', when: 'Smoke, gas or water-leak sensor trips', then: 'Shut the valve, ventilate, light the escape route, unlock the door, alert', on: true, locked: true },
  { id: 'sos', name: 'Emergency button', when: 'SOS button is pressed', then: 'Alert the family, lights on, unlock for responders, cameras record', on: true, locked: true },
];
const auto = id => AUTOS.find(a => a.id === id)?.on;
export const TRIGGERS = {
  unlock: 'Door is unlocked', door_open: 'Entry door opens', win_open: 'Any window opens',
  'pres:living': 'Presence in Living Room', 'pres:kitchen': 'Presence in Kitchen', 'pres:bedroom': 'Presence in Guest Bedroom', 'pres:master': 'Presence in Master Bedroom', 'pres:bath': 'Presence in Bathroom',
  tv_on: 'Living-room TV turns on', 'time:7': 'Clock reaches 07:00', 'time:22': 'Clock reaches 22:00', doorbell: 'Doorbell rings',
};
export function addCustomRule(trig, scene) {
  AUTOS.push({ id: 'c' + Date.now(), name: `${TRIGGERS[trig]} → ${SCENES[scene].name}`, when: TRIGGERS[trig], then: `Run scene “${SCENES[scene].name}”`, on: true, custom: true, trig, scene });
  log('New automation created'); changed();
}
function fireCustom(trig) { AUTOS.forEach(a => { if (a.custom && a.on && a.trig === trig) runScene(a.scene, 'automation'); }); }

// ---------- security ----------
let fails = 0;
export function arm(mode, src = 'app') {
  const s = home.security;
  if (mode === 'disarmed') {
    const had = s.alarm; s.mode = 'disarmed'; s.exitDelay = 0; clearAlarm();
    notify(had ? 'Alarm cancelled — system disarmed' : 'Security disarmed', '', 'ok'); audio.sfx('ok');
  } else {
    const open = ofType('contact').filter(c => c.state.open).map(c => c.name);
    s.mode = mode; s.exitDelay = mode === 'away' ? 10 : 0;
    notify(mode === 'away' ? 'Arming Away — 10 s exit delay' : 'Armed Home — perimeter protected', open.length ? 'Warning: open — ' + open.join(', ') : '', open.length ? 'warn' : 'ok');
    audio.sfx('beep');
  }
  bus.emit('security', { mode, src }); changed();
}
export function raiseAlarm(type, where, cam) {
  const s = home.security; if (s.alarm && s.alarm.type === type) return;
  const T = { intrusion: 'INTRUSION DETECTED', tamper: 'LOCK TAMPER ALARM', sos: 'SOS — EMERGENCY BUTTON', smoke: 'SMOKE DETECTED', gas: 'GAS LEAK DETECTED', leak: 'WATER LEAK DETECTED' }[type];
  s.alarm = { type, where, title: T, siren: type !== 'leak', cam, t: performance.now() };
  audio.siren(s.alarm.siren); notify(T, where, 'alarm');
  ofType('camera').forEach(c => set(c.id, { rec: true, on: true }, 'auto'));
  if (type === 'intrusion' || type === 'tamper') {
    tvs(false); music(false); home.fx.party = false; set('lock', { locked: true }, 'auto');
    audio.say('Warning. Intrusion detected. The owner and security have been notified.');
  }
  if (type === 'smoke' || type === 'gas') {
    set('valve_gas', { on: false }, 'auto'); set('fan_bath', { on: true }, 'auto'); acs({ on: false });
    set('lock', { locked: false }, 'auto'); curtains(0);
    audio.say(type === 'gas' ? 'Danger. Gas leak in the kitchen. The gas valve has been closed.' : 'Fire alarm. Smoke detected in the kitchen. Please leave the apartment.');
  }
  if (type === 'leak') { set('valve_water', { on: false }, 'auto'); audio.say('Water leak detected in the bathroom. The water valve has been closed.'); }
  if (type === 'sos') { set('lock', { locked: false }, 'auto'); audio.say('Emergency button pressed. Calling your emergency contacts.'); }
  bus.emit('alarm', s.alarm); changed();
}
export function clearAlarm() {
  const s = home.security; if (!s.alarm) return;
  s.alarm = null; audio.siren(false);
  ofType('camera').forEach(c => set(c.id, { rec: false }, 'auto'));
  ofType('hazard').forEach(h => set(h.id, { alarm: false }, 'auto'));
  bus.emit('alarmclear'); changed();
}
export function triggerHazard(kind) {
  const id = { smoke: 'hz_smoke', gas: 'hz_gas', leak: 'hz_leak' }[kind];
  set(id, { alarm: true }, 'sim');
  raiseAlarm(kind, kind === 'leak' ? 'Master Bathroom floor sensor' : 'Kitchen sensor', kind === 'leak' ? null : 'cam_kit');
}
export function pressSOS(id) { const d = dev(id); audio.sfx('beep'); raiseAlarm('sos', `${d.name} — ${ROOMS[d.room].name}`, 'cam_liv'); }

// Unlock attempt at the smart lock. Returns true when the door opens.
export function unlockAttempt(method, ok, who = 'Owner') {
  const s = home.security;
  if (s.lockFreeze > 0) { audio.sfx('fail'); notify('Lock is frozen', `Keypad disabled for ${Math.ceil(s.lockFreeze)} s after repeated failures`, 'warn'); return false; }
  if (!ok) {
    fails++; audio.sfx('fail'); log(`Failed unlock attempt (${method}) — ${fails}/5`, 'warn'); bus.emit('lockfail', { fails });
    if (fails >= 5) { fails = 0; s.lockFreeze = 60; raiseAlarm('tamper', '5 failed attempts at the entry door', 'cam_entry'); }
    return false;
  }
  fails = 0; audio.sfx('ok'); setTimeout(() => audio.sfx('motor'), 250);
  const outside = home.player.room === 'corridor' && method !== 'app';
  if (s.mode !== 'disarmed' && method !== 'inside') arm('disarmed', 'lock');
  log(`Door unlocked by ${method} (${who})`);
  set('lock', { locked: false, open: true }, 'user');
  bus.emit('unlock', { method, who, outside }); fireCustom('unlock');
  if (outside && auto('welcome')) setTimeout(() => runScene('welcome', 'automation'), 900);
  return true;
}
export function ringDoorbell(who = 'Visitor') {
  home.doorbell = { who, t: performance.now() }; audio.sfx('bell');
  notify('Doorbell', `${who} is at the door`, 'info'); bus.emit('doorbell', home.doorbell); fireCustom('doorbell'); changed();
}

// ---------- device-event driven rules ----------
bus.on('device', ({ id, d, patch, prev, src }) => {
  const s = home.security;
  if (d.type === 'light' && src !== 'auto') d.auto = false;
  if (d.type === 'contact' && 'open' in patch && patch.open !== prev.open) {
    if (patch.open) {
      log(`${d.name} opened`);
      fireCustom(id === 'ds_entry' ? 'door_open' : 'win_open');
      if (s.mode !== 'disarmed' && s.exitDelay <= 0 && !s.alarm) raiseAlarm('intrusion', `${d.name} opened while armed`, d.cam);
      if (auto('window') && d.ac) { const a = dev(d.ac); if (a.state.on) { a.paused = true; notify('Air-conditioning paused', `${d.name} is open`, 'info'); } }
    } else {
      log(`${d.name} closed`);
      if (d.ac && dev(d.ac).paused) { dev(d.ac).paused = false; notify('Air-conditioning resumed', `${d.name} closed`, 'info'); }
    }
  }
  if (d.type === 'tv' && id === 'tv_liv' && patch.on && !prev.on) fireCustom('tv_on');
  if (d.type === 'ac' && patch.on === false) d.paused = false;
});

// ---------- per-frame simulation ----------
const lastSeen = {}; let acc1 = 0, doorOpenT = 0, lastHour = home.time;
export function tickSim(dt, actors = []) {
  const s = home.security, prevT = home.time;
  home.time = (home.time + dt * home.timeSpeed / 60) % 24;
  const crossed = h => (prevT < h && home.time >= h) || (prevT > home.time && (h > prevT || h <= home.time));
  if (auto('sunset')) {
    if (crossed(18.25)) { curtains(100); notify('Sunset', 'Curtains closed automatically', 'info'); }
    if (crossed(6.5)) { curtains(0); notify('Sunrise', 'Curtains opened automatically', 'info'); }
  }
  if (auto('nightarm') && crossed(23.5) && s.mode === 'disarmed') { set('lock', { locked: true }, 'auto'); arm('home', 'automation'); }
  if (crossed(7)) fireCustom('time:7'); if (crossed(22)) fireCustom('time:22');

  // arming countdown & lock freeze
  if (s.exitDelay > 0) { const b = Math.ceil(s.exitDelay); s.exitDelay -= dt; if (Math.ceil(s.exitDelay) !== b) { audio.sfx('count'); changed(); } if (s.exitDelay <= 0) { notify('System armed (Away)', 'Perimeter and presence sensors active', 'ok'); audio.sfx('ok'); } }
  if (s.lockFreeze > 0) s.lockFreeze -= dt;
  if (home.doorbell && performance.now() - home.doorbell.t > 30000) { home.doorbell = null; changed(); }

  // presence
  const now = performance.now() / 1000, here = {};
  here[home.player.room] = true; actors.forEach(a => { if (a.active) here[roomAt(a.x, a.z)] = true; });
  for (const r of INDOOR) {
    if (here[r]) lastSeen[r] = now;
    const present = here[r] || (lastSeen[r] != null && now - lastSeen[r] < 5);
    if (present !== home.occupancy[r]) {
      home.occupancy[r] = present; set('pr_' + r, { present }, 'sensor'); bus.emit('presence', { room: r, present });
      if (present) {
        fireCustom('pres:' + r);
        if (s.mode === 'away' && s.exitDelay <= 0 && !s.alarm) raiseAlarm('intrusion', `Presence detected in ${ROOMS[r].name}`, 'cam_liv');
      }
      presenceLighting(r, present);
    }
  }

  acc1 += dt;
  if (acc1 >= 0.5) { slowTick(acc1); acc1 = 0; }
  const lk = dev('lock');
  if (lk?.state.open) { doorOpenT += dt; if (doorOpenT > 20 && doorOpenT - dt <= 20 && auto('dooropen')) notify('Entry door left open', 'Opened 20 seconds ago', 'warn'); } else doorOpenT = 0;
  lastHour = home.time;
}

function presenceLighting(r, present) {
  if (!auto('presence') || home.security.alarm) return;
  const ls = lights(r), main = dev({ living: 'l_liv_down', kitchen: 'l_kit_down', bedroom: 'l_bed_down', master: 'l_mas_down', bath: 'l_bath_down' }[r]);
  if (present) {
    const cur = ofType('curtain').find(c => c.room === r);
    const dark = isNight() || r === 'bath' || (cur && cur.state.pos > 70);
    if (dark && !ls.some(l => l.state.on)) {
      const late = home.time >= 23 || home.time < 6;
      set(main.id, { on: true, bri: late ? 15 : 80, cct: late ? 2700 : 3500, rgb: null, fade: 1.2 }, 'auto'); main.auto = true;
      if (r === 'living') { set('l_entry', { on: true, bri: late ? 15 : 80, fade: 1.2 }, 'auto'); dev('l_entry').auto = true; }
    }
  } else ls.forEach(l => { if (l.auto && l.state.on) { set(l.id, { on: false, fade: 3 }, 'auto'); l.auto = false; } });
}

function slowTick(dt) {
  // outdoor climate
  const dayS = Math.sin((home.time - 9) / 24 * Math.PI * 2);
  home.outdoor.temp = (home.season === 'summer' ? 31 : 10) + 4 * dayS; home.outdoor.hum = home.season === 'summer' ? 38 : 60;
  const adj = { kitchen: 'living', bath: 'master' };
  let watts = 14; // hubs, panels, sensors on standby
  for (const r of INDOOR) {
    const c = home.climate[r], a = ofType('ac').find(x => x.room === r);
    const win = ofType('contact').some(w => w.room === r && w.state.open && w.id !== 'ds_entry');
    c.temp += (home.outdoor.temp - c.temp) * (0.004 + (win ? 0.035 : 0)) * dt;
    if (adj[r]) c.temp += (home.climate[adj[r]].temp - c.temp) * 0.03 * dt;
    let humT = 47 + (win ? (home.outdoor.hum - 47) * 0.6 : 0), humR = 0.03;
    if (a) {
      a.running = a.state.on && !a.paused;
      if (a.running) {
        const p = [0.1, 0.17, 0.26][a.state.fan - 1] * dt, diff = c.temp - a.state.set; let load = 0.25;
        if (a.state.mode === 'cool' && diff > 0) { c.temp -= Math.min(diff, p); load = 1; }
        if (a.state.mode === 'heat' && diff < 0) { c.temp += Math.min(-diff, p); load = 1; }
        if (a.state.mode === 'cool' || a.state.mode === 'dry') humT -= 6;
        watts += (a.state.mode === 'fan' ? 60 : 350 + 900 * load * (0.5 + a.state.fan / 4));
      }
      if (auto('comfort') && home.occupancy[r] && !a.state.on && !win) {
        if (home.season === 'summer' && c.temp > 27) { set(a.id, comfort(), 'auto'); notify('Comfort climate', `${ROOMS[r].name} is ${c.temp.toFixed(1)} °C — cooling to 24 °C`, 'info'); }
        if (home.season === 'winter' && c.temp < 19) { set(a.id, comfort(), 'auto'); notify('Comfort climate', `${ROOMS[r].name} is ${c.temp.toFixed(1)} °C — heating to 23 °C`, 'info'); }
      }
    }
    if (r === 'bath') {
      const sh = dev('shower'), fan = dev('fan_bath');
      if (sh.state.on) { humT = 96; humR = 0.09; c.temp += (30 - c.temp) * 0.01 * dt; }
      if (fan.state.on) { humT = Math.min(humT, sh.state.on ? 80 : 44); humR = sh.state.on ? 0.09 : 0.12; watts += 25; }
      if (auto('humidity')) {
        if (c.hum > 70 && !fan.state.on) { set('fan_bath', { on: true }, 'auto'); fan.auto = true; notify('Bathroom ventilation', `Humidity ${c.hum.toFixed(0)} % — exhaust fan on`, 'info'); }
        if (c.hum < 55 && fan.state.on && fan.auto && !home.security.alarm) { set('fan_bath', { on: false }, 'auto'); fan.auto = false; }
      }
    }
    c.hum += (humT - c.hum) * humR * dt; c.hum = clamp(c.hum, 20, 99);
    const th = dev('th_' + r); if (th) { th.state.temp = c.temp; th.state.hum = c.hum; }
  }
  lights().forEach(l => watts += l.power || 0);
  ofType('tv').forEach(t => { if (t.state.on) watts += 110; });
  if (home.music.playing) ofType('speaker').forEach(sp => { if (sp.state.on) watts += 18; });
  home.energy = watts; home.kwh = (home.kwh || 0) + watts * dt * home.timeSpeed / 3600 / 1000;
  changed();
}

bus.on('doorbell', () => { if (auto('doorbell') && home.music.playing) { home.music.ducked = true; setTimeout(() => { home.music.ducked = false; }, 12000); } });
