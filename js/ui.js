// HUD, phone app, MixPad UI, lock keypad, device inspector, CCTV overlay and guided tour.
import { bus, home, set, dev, ofType, has, notify, ROOMS, INDOOR, fmtTime, changed } from './state.js';
import { renderPlan, initPlan, loadSavedProject } from './plan.js';
import { SCENES, runScene, AUTOS, TRIGGERS, addCustomRule, arm, unlockAttempt, triggerHazard, music, ringDoorbell, pressSOS, tvCameras } from './sim.js';
import { CATALOG, modelOf } from './catalog.js';
import { audio, TRACKS } from './audio.js';
import { setModel } from './devices.js';
import { breakIn, lockTamper, visitorRings, forcedDoor } from './actors.js';

export const ui = { open: null, tab: 'home', room: 'all', page: null, cctv: { single: null }, pip: null, tour: true, quality: 'balanced', fps: 0, scale: 1, yaw: 0, relock: null, onQuality: null };
const $ = s => document.querySelector(s);
const app = $('#app'), tabsEl = $('#tabs'), deviceEl = $('#device');
let hold = false, pin = '', inspected = null, rule = { trig: 'unlock', scene: 'welcome' };

// ---------- overlay management ----------
function show(kind) {
  ui.open = kind; document.exitPointerLock?.();
  deviceEl.classList.toggle('hidden', !(kind === 'phone' || kind === 'mixpad')); deviceEl.className = (kind === 'phone' || kind === 'mixpad') ? kind : 'hidden';
  $('#lockui').classList.toggle('hidden', kind !== 'lock'); $('#inspect').classList.toggle('hidden', kind !== 'inspect');
  $('#cctv').classList.toggle('hidden', kind !== 'cctv'); $('#help').classList.toggle('hidden', kind !== 'help'); $('#plan').classList.toggle('hidden', kind !== 'plan');
  document.body.classList.toggle('phone-open', kind === 'phone');
  $('#device-close').textContent = kind === 'mixpad' ? 'Leave MixPad (Esc)' : 'Close (Tab)';
}
export function closeOverlay(relock = true) { if (!ui.open) return; show(null); ui.cctv.single = null; if (relock) ui.relock?.(); }
export function openPhone(tab) { if (tab) { ui.tab = tab; ui.page = null; } show('phone'); render(); bus.emit('ui', 'phone'); }
export const cctvGrid = n => { const cols = n <= 1 ? 1 : n <= 4 ? 2 : 3; return { cols, rows: Math.max(1, Math.ceil(n / cols)) }; };
export const cctvCams = () => ofType('camera').slice(0, 9);
export function openCCTV() {
  const cams = cctvCams(), g = cctvGrid(cams.length), el = $('#cctv');
  if (!cams.length) return notify('No cameras installed', 'Add a camera in the Control Centre.', 'warn');
  el.querySelectorAll('.cam').forEach(c => c.remove()); el.style.gridTemplateColumns = `repeat(${g.cols}, 1fr)`; el.style.gridTemplateRows = `repeat(${g.rows}, 1fr)`;
  cams.forEach((c, i) => { const t = document.createElement('div'); t.className = 'cam'; t.dataset.i = i; el.insertBefore(t, $('#cctv-bar')); });
  ui.cctv.single = null; show('cctv'); el.classList.remove('single'); bus.emit('ui', 'cctv');
}
ui.openPlan = () => { show('plan'); render(); bus.emit('ui', 'plan'); };
export function toggle(kind) { if (ui.open === kind) closeOverlay(); else if (kind === 'phone') openPhone(); else if (kind === 'cctv') openCCTV(); else if (kind === 'help') openHelp(); else if (kind === 'plan') ui.openPlan(); }
bus.on('openMixPad', d => { ui.room = d.room; ui.page = null; ui.tab = home.security.alarm ? 'security' : 'home'; show('mixpad'); render(); bus.emit('ui', 'mixpad'); });
bus.on('openLockUI', () => { pin = ''; renderLock(); show('lock'); });
bus.on('inspect', d => openInspect(d));
bus.on('openCCTV', openCCTV);

// ---------- small html helpers ----------
export const sw = (on, a, extra = '') => `<button class="sw ${on ? 'on' : ''}" data-a="${a}" ${extra}></button>`;
export const chips = (items, cur, a, extra = '') => `<div class="chips">${items.map(([v, l]) => `<button class="${String(v) === String(cur) ? 'on' : ''}" data-a="${a}" data-v="${v}" ${extra}>${l}</button>`).join('')}</div>`;
const range = (i, id, v, min, max, step = 1) => `<input type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-i="${i}" data-id="${id}">`;
const COLORS = ['#ff3b3b', '#ff9a3a', '#ffe14a', '#3ddc6a', '#33d6ff', '#3a5cff', '#a04aff', '#ff3bb0'];
const head = (d, right = '') => `<div class="row"><div class="g"><b>${d.name}</b><small>${modelOf(d)?.name || ''}</small></div>${right}</div>`;

export function devCard(d) {
  const s = d.state, id = `data-id="${d.id}"`;
  switch (d.type) {
    case 'light': return `<div class="card">${head(d, sw(s.on, 'tog', id))}
      <div class="row"><label>Brightness ${s.bri}%</label>${range('bri', d.id, s.bri, 1, 100)}</div>
      <div class="row"><label>White ${s.cct} K</label>${range('cct', d.id, s.cct, 2700, 6500, 100)}</div>
      ${d.kind === 'strip' ? `<div class="row"><label>Colour</label><div class="chips">${COLORS.map(c => `<button class="swatch ${s.rgb === c ? 'on' : ''}" style="background:${c}" data-a="rgb" data-v="${c}" ${id}></button>`).join('')}<button class="swatch ${!s.rgb ? 'on' : ''}" style="background:linear-gradient(90deg,#ffb46b,#fff,#cfe2ff)" data-a="rgb" data-v="" ${id}></button></div></div>` : ''}
      <div class="row"><label>Fade time</label>${chips([[0.2, 'Instant'], [1.2, '1 s'], [3, '3 s'], [6, '6 s']], s.fade, 'fade', id)}</div></div>`;
    case 'curtain': return `<div class="card">${head(d, `<span class="chip">${s.pos}% closed</span>`)}
      <div class="row"><label>Position</label>${range('pos', d.id, s.pos, 0, 100, 5)}</div>
      <div class="row"><label></label>${chips([[0, 'Open'], [50, 'Half'], [100, 'Close']], s.pos, 'cur', id)}</div></div>`;
    case 'ac': { const c = home.climate[d.room]; return `<div class="card">${head(d, sw(s.on, 'tog', id))}
      <div class="row"><label>Room now</label><b>${c.temp.toFixed(1)} °C</b><span class="mut">· ${c.hum.toFixed(0)} % RH ${d.paused ? '· <span style="color:var(--warn)">paused — window open</span>' : d.running ? '· running' : ''}</span></div>
      <div class="row"><label>Set-point</label><button class="btn" data-a="acset" data-v="-1" ${id}>−</button><b style="font-size:20px;width:64px;text-align:center">${s.set} °C</b><button class="btn" data-a="acset" data-v="1" ${id}>+</button></div>
      <div class="row"><label>Mode</label>${chips([['cool', '❄ Cool'], ['heat', '☀ Heat'], ['dry', '💧 Dry'], ['fan', '🌀 Fan']], s.mode, 'acmode', id)}</div>
      <div class="row"><label>Fan speed</label>${chips([[1, 'Low'], [2, 'Medium'], [3, 'High']], s.fan, 'acfan', id)}</div></div>`; }
    case 'tv': return `<div class="card">${head(d, sw(s.on, 'tog', id))}
      <div class="row"><label>Channel</label>${chips(d.channels.map((n, i) => [i, n]), s.ch, 'tvch', id)}</div></div>`;
    case 'speaker': return `<div class="card"><div class="row"><div class="g"><b>${d.name}</b><span class="badge ${d.master ? '' : 's'}">${d.master ? 'MASTER' : 'SLAVE'}</span><small>${modelOf(d).name}</small></div>${sw(s.on, 'tog', id)}</div>
      <div class="row"><label>Zone volume</label>${range('vol', d.id, s.vol, 0, 100)}</div></div>`;
    case 'presence': return line(d, s.present ? '<span class="chip ok">Occupied</span>' : '<span class="chip">Vacant</span>');
    case 'climate': return line(d, `<b>${s.temp.toFixed(1)} °C</b> · ${s.hum.toFixed(0)} %`);
    case 'contact': return line(d, s.open ? '<span class="chip bad">OPEN</span>' : '<span class="chip ok">Closed</span>');
    case 'hazard': return line(d, s.alarm ? '<span class="chip bad">ALARM</span>' : '<span class="chip ok">Normal</span>');
    case 'sos': return line(d, `<button class="btn bad" data-a="sos" ${id}>Test SOS</button>`);
    case 'relay': return line(d, sw(s.on, 'tog', id));
    case 'camera': return `<div class="card">${head(d, `<span class="mut">${s.rec ? '● REC' : s.on ? 'live' : 'privacy'}</span> ${sw(s.on, 'tog', id)}`)}${feed(d)}<div class="row"><button class="btn pri" data-a="tvcam" data-v="${d.id}">Show on TV</button><button class="btn" data-a="cctv">Full screen</button></div></div>`;
    case 'lock': return lockCard();
    case 'mixpad': case 'switch': return line(d, '<span class="chip ok">Online</span>');
    default: return '';
  }
}
// Live camera picture inside the app: the render loop paints into every canvas.feed it finds.
const feedCache = {};
export const feed = d => `<div class="feedbox" data-a="page" data-v="${d.id}"><canvas class="feed" data-cam="${d.id}" width="320" height="180"></canvas><span>${d.name.toUpperCase()}${d.state.rec ? ' <i>● REC</i>' : ''}</span></div>`;
export function paintFeeds(id, source, sx, sy, sw, sh) {
  if (source) { const c = feedCache[id] ??= Object.assign(document.createElement('canvas'), { width: 320, height: 180 }); c.getContext('2d').drawImage(source, sx, sy, sw, sh, 0, 0, 320, 180); }
  for (const el of document.querySelectorAll('canvas.feed')) {
    const cid = el.dataset.cam; if (id && cid !== id) continue; const g = el.getContext('2d'), d = dev(cid);
    if (!d || d.installed === false || !d.state.on) { g.fillStyle = '#0c0f14'; g.fillRect(0, 0, 320, 180); g.fillStyle = '#7d8796'; g.font = '14px system-ui'; g.textAlign = 'center'; g.fillText('Privacy mode — camera off', 160, 94); }
    else if (feedCache[cid]) g.drawImage(feedCache[cid], 0, 0);
  }
}
const line = (d, right) => `<div class="card"><div class="row"><div class="g"><b>${d.name}</b><small>${modelOf(d)?.name || ''}</small></div>${right}</div></div>`;
function lockCard() {
  const d = dev('lock'), s = d.state;
  return `<div class="card">${head(d, `<span class="chip ${s.locked ? 'ok' : 'warn'}">${s.open ? 'Door open' : s.locked ? 'Locked' : 'Unlocked'}</span>`)}
    <div class="row"><button class="btn pri" data-a="lock" data-v="unlock">Remote unlock</button><button class="btn" data-a="lock" data-v="lock">Lock</button><button class="btn" data-a="temppin">One-time PIN</button></div>
    ${home.tempPin ? `<div class="mut">One-time visitor PIN: <b style="color:var(--gold);font-size:16px">${home.tempPin}</b> (valid for a single entry)</div>` : ''}
    <div class="mut">Users: ${home.users.map(u => u.name).join(', ')} · Owner PIN ${home.users[0].pin}</div></div>`;
}
export const secChip = () => { const s = home.security; return s.alarm ? `<span class="chip bad">ALARM</span>` : s.mode === 'disarmed' ? `<span class="chip ok">Disarmed</span>` : `<span class="chip warn">${s.exitDelay > 0 ? `Arming ${Math.ceil(s.exitDelay)}s` : s.mode === 'home' ? 'Armed Home' : 'Armed Away'}</span>`; };
export const alarmCard = () => { const a = home.security.alarm; return a ? `<div class="card alarm"><b>⚠ ${a.title}</b><div>${a.where}</div><button class="btn wide" style="background:#fff;color:#a01010;font-weight:700" data-a="arm" data-v="disarmed">Disarm &amp; silence</button></div>` : ''; };

export const ICON = { light: '💡', curtain: '🪟', ac: '❄️', tv: '📺', speaker: '🔊', lock: '🔐', camera: '📷', relay: '🔌', contact: '🚪', presence: '🧍', climate: '🌡️', hazard: '🛟', sos: '🆘', mixpad: '📱', switch: '🔘' };
function tile(d) {
  const s = d.state, tog = ['light', 'ac', 'tv', 'speaker', 'relay'].includes(d.type);
  const on = tog ? s.on : d.type === 'curtain' ? s.pos < 50 : d.type === 'lock' ? !s.locked : d.type === 'contact' ? s.open : d.type === 'presence' ? s.present : d.type === 'hazard' ? s.alarm : false;
  const st = { light: () => s.on ? `${s.bri}% · ${s.rgb ? 'colour' : s.cct + ' K'}` : 'Off', curtain: () => s.pos === 0 ? 'Open' : s.pos === 100 ? 'Closed' : `${100 - s.pos}% open`, ac: () => s.on ? `${s.mode} · ${s.set}°C` : 'Off', tv: () => s.on ? d.channels[s.ch] : 'Off', speaker: () => s.on ? `Zone on · ${s.vol}%` : 'Zone off', lock: () => s.open ? 'Door open' : s.locked ? 'Locked' : 'Unlocked', camera: () => s.rec ? 'Recording' : s.on ? 'Live' : 'Privacy mode', relay: () => s.on ? 'On' : 'Off', contact: () => s.open ? 'Open' : 'Closed', presence: () => s.present ? 'Someone is here' : 'Nobody', climate: () => `${s.temp.toFixed(1)}°C · ${s.hum.toFixed(0)}%`, hazard: () => s.alarm ? 'ALARM' : 'Normal', sos: () => 'Ready', mixpad: () => 'Online', switch: () => 'Online' }[d.type]();
  return `<div class="tile ${on ? 'on' : ''}" data-a="page" data-v="${d.id}"><div class="ti">${ICON[d.type]}</div><b>${d.name}</b><small>${ui.room === 'all' ? ROOMS[d.room].name + ' · ' : ''}${st}</small>${tog ? `<button class="sw ${s.on ? 'on' : ''}" data-a="tog" data-id="${d.id}"></button>` : ''}</div>`;
}
function page() {
  if (ui.page === 'music') return `<div class="hdr"><button class="back" data-a="back">‹</button><b>Background music</b></div>` + TABS.music().replace('<h2>Music</h2>', '');
  const d = dev(ui.page), c = CATALOG[d.cat];
  return `<div class="hdr"><button class="back" data-a="back">‹</button><b>${d.name}</b><span class="mut">${ROOMS[d.room].name}</span></div>
    <div class="hero"><div>${ICON[d.type] || '⚙️'}</div><small>${modelOf(d)?.name || ''}</small></div>${devCard(d)}
    ${d.type === 'speaker' ? '<button class="btn pri wide" data-a="page" data-v="music">Open music player</button>' : ''}
    ${c ? `<div class="card"><b>${c.title}</b><div class="mut">${c.blurb}</div>${c.models.length > 1 ? `<div class="row"><label>Installed model</label><select data-c="model1" data-id="${d.id}">${c.models.map(m => `<option value="${m.id}" ${d.model === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}</select></div>` : ''}</div>` : ''}`;
}

// ---------- tabs ----------
const TABS = {
  home() {
    const c = home.climate[INDOOR.includes(home.player.room) ? home.player.room : 'living'], all = ui.room === 'all';
    const order = ['light', 'curtain', 'ac', 'tv', 'speaker', 'lock', 'camera', 'relay', 'contact', 'presence', 'climate', 'hazard', 'sos', 'mixpad', 'switch'];
    const ds = Object.values(home.devices).filter(d => d.installed !== false && order.includes(d.type) && (all ? !['presence', 'climate', 'contact', 'hazard', 'sos', 'switch'].includes(d.type) : d.room === ui.room)).sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
    return `<div class="hdr"><b>My Home ▾</b><span class="mut">Apartment A·1204</span><button class="plus" data-a="plan" data-v="custom" title="Add or remove devices">＋</button></div>
    <div class="env"><div><b>${home.outdoor.temp.toFixed(0)}°C</b><span>Outdoor</span></div><div><b>${c.temp.toFixed(1)}°C</b><span>Indoor</span></div><div><b>${c.hum.toFixed(0)}%</b><span>Humidity</span></div><div><b>${Math.round(home.energy)} W</b><span>Power</span></div></div>
    ${alarmCard()}
    <div class="secrow"><div class="g"><b>Security</b> ${secChip()}</div>${[['home', 'At home'], ['away', 'Away'], ['disarmed', 'Disarm']].map(([v, l]) => `<button class="${home.security.mode === v ? 'on' : ''}" data-a="arm" data-v="${v}">${l}</button>`).join('')}</div>
    <h3>Scenes</h3><div class="hscroll">${Object.entries(SCENES).map(([k, x]) => `<button class="pill" data-a="scene" data-v="${k}"><span>${x.icon}</span>${x.name}</button>`).join('')}</div>
    <div class="hscroll rooms">${[['all', 'All'], ...INDOOR.map(r => [r, ROOMS[r].name]), ['corridor', 'Entrance'], ['balcony', 'Balcony']].map(([v, l]) => `<button class="${ui.room === v ? 'on' : ''}" data-a="room" data-v="${v}">${l}</button>`).join('')}</div>
    <div class="tiles">${all ? `<div class="tile ${home.music.playing ? 'on' : ''}" data-a="page" data-v="music"><div class="ti">🎵</div><b>Background music</b><small>${home.music.playing ? '♪ ' + TRACKS[home.music.track].name : 'Stopped'}</small><button class="sw ${home.music.playing ? 'on' : ''}" data-a="play"></button></div>` : ''}${ds.map(tile).join('')}</div>`;
  },
  rooms() {
    const ds = Object.values(home.devices).filter(d => d.room === ui.room), order = ['light', 'curtain', 'ac', 'tv', 'speaker', 'lock', 'presence', 'climate', 'contact', 'hazard', 'sos', 'relay', 'camera', 'mixpad', 'switch'];
    ds.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
    return `<h2>Devices</h2>${chips([...INDOOR, 'corridor', 'balcony'].map(r => [r, ROOMS[r].name]), ui.room, 'room')}<h3>${ROOMS[ui.room].name} · ${ds.length} devices</h3><div class="cols">${ds.map(devCard).join('')}</div>`;
  },
  smart() {
    return `<h2>Scenes &amp; Automation</h2><h3>Scenes — one tap</h3><div class="cols">${Object.entries(SCENES).map(([k, s]) => `<div class="card"><div class="row"><div style="font-size:24px">${s.icon}</div><div class="g"><b>${s.name}</b><div class="mut">${s.desc}</div></div><button class="btn pri" data-a="scene" data-v="${k}">Run</button></div></div>`).join('')}</div>
    <h3>Automations — IF … THEN …</h3><div class="cols">${AUTOS.map((a, i) => `<div class="card"><div class="row"><div class="g"><b>${a.name}</b>${a.locked ? '<span class="badge s">PROTECTION</span>' : ''}</div><button class="sw ${a.on ? 'on' : ''}" data-a="auto" data-v="${i}" ${a.locked ? 'disabled' : ''}></button></div><div class="mut"><b style="color:var(--gold)">IF</b> ${a.when}<br><b style="color:var(--gold)">THEN</b> ${a.then}</div></div>`).join('')}</div>
    <h3>Create automation</h3><div class="card"><div class="row"><label>IF</label><select data-c="trig">${Object.entries(TRIGGERS).map(([k, v]) => `<option value="${k}" ${rule.trig === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div class="row"><label>THEN run</label><select data-c="rscene">${Object.entries(SCENES).map(([k, v]) => `<option value="${k}" ${rule.scene === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select></div><button class="btn pri wide" data-a="addrule">Add automation</button></div>`;
  },
  security() {
    const s = home.security;
    return `<h2>Security ${secChip()}</h2>${alarmCard()}<div class="seg">${[['disarmed', 'Disarm'], ['home', 'Arm Home'], ['away', 'Arm Away']].map(([v, l]) => `<button class="${s.mode === v ? 'on' : ''}" data-a="arm" data-v="${v}">${l}</button>`).join('')}</div>
    <div class="mut" style="margin-top:6px"><b>Home</b>: door and window sensors. <b>Away</b>: plus presence sensors, 10 s exit delay — leave the apartment before it ends.</div>
    <h3>Cameras — live</h3><div class="feeds">${ofType('camera').map(feed).join('') || '<div class="mut">No cameras installed.</div>'}</div>
    <div class="row"><button class="btn pri" data-a="cctv">Full-screen camera wall</button><button class="btn" data-a="tvcam" data-v="">${dev('tv_liv')?.state.on && dev('tv_liv').state.ch === 4 ? 'Stop cameras on TV' : 'Show cameras on TV'}</button></div>
    <h3>Smart lock</h3>${lockCard()}
    <h3>Sensors</h3><div class="cols">${[...ofType('contact'), ...ofType('presence'), ...ofType('hazard')].map(d => `<div class="kv"><span>${ROOMS[d.room].name} · ${d.name}</span>${d.type === 'contact' ? (d.state.open ? '<b style="color:var(--bad)">OPEN</b>' : 'closed') : d.type === 'presence' ? (d.state.present ? '<b style="color:var(--ok)">occupied</b>' : 'vacant') : (d.state.alarm ? '<b style="color:var(--bad)">ALARM</b>' : 'normal')}</div>`).join('')}</div>
    <h3>Test the protection — simulations</h3><div class="card"><div class="mut">Watch how ORVIBO reacts. Arm the system first to see the full response.</div>
    <div class="chips" style="margin-top:8px">${[['armbreak', '🥷 Arm Home + balcony break-in'], ['breakin', '🥷 Balcony break-in'], ['forced', '🚪 Forced entry door'], ['tamper', '🔢 PIN guessing at the lock'], ['visitor', '🔔 Visitor rings doorbell'], ['smoke', '🔥 Smoke in kitchen'], ['gas', '💨 Gas leak'], ['leak', '💧 Water leak'], ['sos', '🆘 SOS pressed']].map(([v, l]) => `<button data-a="sim" data-v="${v}">${l}</button>`).join('')}</div></div>
    <h3>Event log</h3>${home.log.slice(0, 30).map(l => `<div class="log ${l.level}"><i>${l.t}</i>${l.text}</div>`).join('')}`;
  },
  music() {
    const m = home.music, t = TRACKS[m.track];
    return `<h2>Music</h2><div class="card np"><div class="disc ${m.playing ? 'spin' : ''}"></div><b style="font-size:17px">${t.name}</b><div class="mut">${t.artist} · ${t.bpm} BPM</div>
    <div class="ctl"><button data-a="trk" data-v="-1">⏮</button><button data-a="play">${m.playing ? '⏸' : '▶'}</button><button data-a="trk" data-v="1">⏭</button></div>
    <div class="row"><label>Master volume</label>${range('mvol', '', m.vol, 0, 100)}</div></div>
    <div class="card"><div class="row"><div class="g"><b>Whole-home sync</b><small>Slave speakers follow the Artist Box master</small></div>${sw(m.sync, 'sync')}</div></div>
    <h3>Zones</h3><div class="cols">${ofType('speaker').map(devCard).join('')}</div>
    <h3>Playlist</h3>${TRACKS.map((x, i) => `<div class="kv" data-a="settrk" data-v="${i}" style="cursor:pointer"><span style="color:${i === m.track ? 'var(--gold)' : ''}">${i === m.track && m.playing ? '♪ ' : ''}${x.name}</span>${x.artist}</div>`).join('')}`;
  },
  more() {
    return `<div class="me"><div class="av">DH</div><div><b>Digital Home</b><small>Owner · My Home · ${Object.values(home.devices).filter(d => d.installed !== false).length} devices</small></div></div>
    <button class="btn pri wide" data-a="plan" data-v="control">Open Control Centre — 2D plan (F)</button><button class="btn wide" data-a="plan" data-v="custom">Customise the project — add / remove items</button><h3>Message centre</h3><div class="card">${home.log.slice(0, 6).map(l => `<div class="log ${l.level}"><i>${l.t}</i>${l.text}</div>`).join('') || '<div class="mut">No messages.</div>'}</div><h3>Time of day — ${fmtTime()}</h3><div class="card"><div class="row">${range('time', '', home.time.toFixed(2), 0, 23.99, 0.05)}</div>
    <div class="row"><label>Clock speed</label>${chips([[0, 'Paused'], [1, '1 min/s'], [10, '10 min/s'], [60, '1 h/s']], home.timeSpeed, 'speed')}</div>
    <div class="row"><label>Season</label>${chips([['summer', '☀ Summer'], ['winter', '❄ Winter']], home.season, 'season')}</div></div>
    <h3>Product configurator</h3><div class="card"><div class="mut">Choose which ORVIBO model is installed. Press <b>Q</b> on any device in the apartment to change just that one.</div>
    ${Object.entries(CATALOG).filter(([, c]) => c.models.length > 1).map(([k, c]) => { const cur = Object.values(home.devices).find(d => d.cat === k); return cur ? `<div class="row"><label>${c.title.replace('Smart ', '').replace('SOPRO ', '').slice(0, 22)}</label><select data-c="model" data-k="${k}">${c.models.map(m => `<option value="${m.id}" ${cur.model === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}</select></div>` : ''; }).join('')}</div>
    <h3>Voice assistant</h3><div class="card"><div class="row"><input type="text" id="cmd" placeholder="e.g. movie night, lights off, set 22 degrees"><button class="btn pri" data-a="cmd">Send</button></div>
    <div class="chips">${['I am home', 'Movie night', 'Show cameras on TV', 'Open the curtains', 'Play music', 'Lights off', 'Arm home', 'Good night'].map(c => `<button data-a="say" data-v="${c}">${c}</button>`).join('')}</div></div>
    <h3>Energy</h3><div class="stat"><div><b>${Math.round(home.energy)} W</b><span>now</span></div><div><b>${(home.kwh || 0).toFixed(2)}</b><span>kWh today</span></div><div><b>${ofType('ac').filter(a => a.running).length}</b><span>AC running</span></div><div><b>${Object.keys(home.devices).length}</b><span>devices</span></div></div>
    <h3>Settings</h3><div class="card"><div class="row"><label>Graphics</label>${chips([['low', 'Low'], ['balanced', 'Balanced'], ['high', 'High'], ['ultra', 'Ultra 4K']], ui.quality, 'quality')}</div>
    <div class="row"><div class="g"><b>Ray-traced photo mode</b><small>Path-traced still of the current view (key P)</small></div><button class="btn pri" data-a="photo">Render</button></div>
    <div class="row"><div class="g"><b>Voice announcements</b></div>${sw(audio.voice, 'voice')}</div><div class="row"><div class="g"><b>Guided tour objectives</b></div>${sw(ui.tour, 'tour')}</div></div>
    <div class="mut" style="text-align:center;margin:14px 0">Digital Home — exclusive ORVIBO distributor.<br>Demonstration simulator; product behaviour is illustrative.</div>`;
  },
};
const TABDEF = [['home', '🏠', 'Home'], ['smart', '✨', 'Smart'], ['security', '🛡️', 'Security'], ['more', '👤', 'Me']];

function render() {
  const ae = document.activeElement; if (hold || (ae && (app.contains(ae) || $('#plan').contains(ae)) && (ae.tagName === 'SELECT' || ae.type === 'text'))) return;
  if (ui.open === 'plan') { renderPlan(); paintFeeds(); return; }
  if (ui.open !== 'phone' && ui.open !== 'mixpad') return;
  if (!TABDEF.some(t => t[0] === ui.tab)) ui.tab = 'home';
  app.innerHTML = ui.page ? page() : TABS[ui.tab]();
  paintFeeds();
  tabsEl.innerHTML = TABDEF.map(([k, i, l]) => `<button class="${ui.tab === k ? 'on' : ''}" data-a="tab" data-v="${k}"><span>${i}</span>${l}</button>`).join('');
}
bus.on('change', render);

// ---------- actions ----------
export const A = {
  tab: v => { ui.tab = v; ui.page = null; app.scrollTop = 0; }, room: v => ui.room = v, page: v => { ui.page = v; app.scrollTop = 0; }, back: () => { ui.page = null; },
  scene: v => runScene(v, ui.open === 'mixpad' ? 'MixPad' : 'app'),
  tog: (v, id) => { const d = dev(id); set(id, { on: !d.state.on }, 'app'); if (d.type === 'speaker' && d.state.on && !home.music.playing) music(true); if (d.type === 'relay') d.auto = false; },
  rgb: (v, id) => set(id, { rgb: v || null, on: true }, 'app'), fade: (v, id) => set(id, { fade: +v }, 'app'), cur: (v, id) => set(id, { pos: +v }, 'app'),
  acset: (v, id) => set(id, { set: Math.max(16, Math.min(30, dev(id).state.set + +v)), on: true }, 'app'), acmode: (v, id) => set(id, { mode: v, on: true }, 'app'), acfan: (v, id) => set(id, { fan: +v }, 'app'),
  tvch: (v, id) => set(id, { ch: +v, on: true }, 'app'), sos: (v, id) => pressSOS(id),
  arm: v => arm(v, ui.open === 'mixpad' ? 'MixPad' : 'app'),
  lock: v => { const l = dev('lock'); if (v === 'unlock') { if (l.state.locked) unlockAttempt('app', true, 'Owner, remote'); } else set('lock', { open: false, locked: true }, 'app'); },
  temppin: () => { home.tempPin = String(100000 + Math.floor(Math.random() * 899999)); notify('One-time PIN created', home.tempPin, 'ok'); },
  cctv: () => openCCTV(),
  tvcam: v => { const tv = dev('tv_liv'), showing = tv && tv.state.on && tv.state.ch === 4 && (home.tvCam || '') === (v || ''); if (tvCameras(!showing, v || null)) notify(showing ? 'TV back to normal' : 'Cameras on the living-room TV', showing ? '' : v ? dev(v).name : 'Camera wall', 'ok'); },
  sim: v => { closeOverlay(); ({ breakin: breakIn, armbreak: () => { if (home.security.mode === 'disarmed') arm('home', 'app'); breakIn(); }, forced: forcedDoor, tamper: lockTamper, visitor: visitorRings, smoke: () => triggerHazard('smoke'), gas: () => triggerHazard('gas'), leak: () => triggerHazard('leak'), sos: () => { const b = ofType('sos')[0]; b ? pressSOS(b.id) : notify('No emergency button installed', 'Add one in the Control Centre.', 'warn'); } })[v](); },
  auto: v => { AUTOS[v].on = !AUTOS[v].on; }, addrule: () => addCustomRule(rule.trig, rule.scene),
  play: () => { const p = !home.music.playing; music(p, p && !ofType('speaker').some(s => s.state.on) ? { zones: ['spk_liv'] } : {}); },
  trk: v => music(true, { track: (home.music.track + +v + TRACKS.length) % TRACKS.length }), settrk: v => music(true, { track: +v }),
  sync: () => { const s = !home.music.sync; music(home.music.playing || s, { sync: s, ...(s ? { zones: 'all' } : {}) }); },
  speed: v => home.timeSpeed = +v, season: v => { home.season = v; notify(`Season set to ${v}`, v === 'winter' ? 'Cold outside — heating automations apply' : 'Hot outside — cooling automations apply'); },
  quality: v => { ui.quality = v; ui.onQuality?.(v); }, voice: () => audio.voice = !audio.voice, tour: () => { ui.tour = !ui.tour; renderQuests(); },
  photo: () => { closeOverlay(false); ui.onPhoto?.(); },
  cmd: () => voiceCommand($('#cmd').value), say: v => voiceCommand(v),
  setmodel: v => { setModel(inspected, v); renderInspect(); }, close: () => closeOverlay(),
};
function onClick(e) {
  const el = e.target.closest('[data-a]'); if (!el || el.disabled) return;
  A[el.dataset.a]?.(el.dataset.v, el.dataset.id, e); audio.sfx('tap'); changed(); setTimeout(render, 0);
}
const I = {
  bri: (v, id) => { dev(id).quick = performance.now() + 400; set(id, { bri: +v, on: true }, 'app'); }, cct: (v, id) => { dev(id).quick = performance.now() + 400; set(id, { cct: +v, rgb: null }, 'app'); },
  pos: (v, id) => set(id, { pos: +v }, 'app'), vol: (v, id) => set(id, { vol: +v }, 'app'), mvol: v => { home.music.vol = +v; }, time: v => { home.time = +v; },
};
const onInput = e => { const d = e.target.dataset; if (d.i) I[d.i](e.target.value, d.id); };
app.addEventListener('input', onInput); $('#plan').addEventListener('input', onInput);
const onChange = e => {
  const d = e.target.dataset;
  if (d.c === 'trig') rule.trig = e.target.value; if (d.c === 'rscene') rule.scene = e.target.value;
  if (d.c === 'model1') setModel(dev(d.id), e.target.value);
  if (d.c === 'model') { Object.values(home.devices).filter(x => x.cat === d.k).forEach(x => setModel(x, e.target.value)); notify('Model changed', CATALOG[d.k].models.find(m => m.id === e.target.value).name, 'ok'); }
  e.target.blur(); setTimeout(render, 0);
};
app.addEventListener('change', onChange); $('#plan').addEventListener('change', onChange);
$('#plan').addEventListener('keydown', e => { if (e.target.type === 'text') e.stopPropagation(); });
app.addEventListener('keydown', e => { if (e.target.type === 'text') e.stopPropagation(); if (e.key === 'Enter' && e.target.id === 'cmd') voiceCommand(e.target.value); });
for (const el of [app, tabsEl, $('#lockui'), $('#inspect'), $('#help'), $('#alarm'), $('#pip'), $('#plan')]) el.addEventListener('click', onClick);
$('#frame').addEventListener('pointerdown', () => hold = true); $('#plan').addEventListener('pointerdown', () => hold = true);
addEventListener('pointerup', () => { if (hold) { hold = false; setTimeout(render, 30); } });
$('#device-close').onclick = () => closeOverlay(); $('#cctv-close').onclick = e => { e.stopPropagation(); closeOverlay(); };
deviceEl.addEventListener('click', e => { if (e.target === deviceEl) closeOverlay(); });
for (const id of ['#lockui', '#inspect', '#help']) $(id).addEventListener('click', e => { if (e.target === $(id)) closeOverlay(); });
$('#cctv').addEventListener('click', e => {
  const c = e.target.closest('.cam'); if (!c) return; const el = $('#cctv'), i = +c.dataset.i;
  if (ui.cctv.single === i) { ui.cctv.single = null; el.classList.remove('single'); c.classList.remove('sel'); }
  else { ui.cctv.single = i; el.classList.add('single'); document.querySelectorAll('#cctv .cam').forEach(x => x.classList.toggle('sel', x === c)); }
});

// ---------- voice / text assistant ----------
export function voiceCommand(text) {
  const t = (text || '').toLowerCase().trim(); if (!t) return;
  const room = INDOOR.find(r => t.includes(r === 'bath' ? 'bath' : r === 'bedroom' ? 'guest' : r)) || (INDOOR.includes(home.player.room) ? home.player.room : 'living');
  const has = (...w) => w.some(x => t.includes(x)); let reply = null;
  const sc = [['welcome', ['i am home', "i'm home", 'welcome']], ['leave', ['leave', 'goodbye', 'going out']], ['movie', ['movie', 'cinema']], ['dinner', ['dinner']], ['party', ['party']], ['sleep', ['good night', 'sleep']], ['morning', ['good morning']], ['reading', ['reading', 'read']], ['romantic', ['romantic']], ['alloff', ['everything off', 'all off']]].find(([, w]) => has(...w));
  const num = t.match(/(\d{2})/);
  if (sc) { runScene(sc[0], 'voice'); reply = `${SCENES[sc[0]].name} scene is on.`; }
  else if (has('disarm')) { arm('disarmed', 'voice'); reply = 'Security disarmed.'; }
  else if (has('arm')) { arm(has('away') ? 'away' : 'home', 'voice'); reply = 'Security armed.'; }
  else if (has('light')) { const on = !has('off'); ofType('light').filter(l => l.room === room && (on ? l.kind === 'down' : true)).forEach(l => set(l.id, { on, fade: 1 }, 'voice')); reply = `${ROOMS[room].name} lights ${on ? 'on' : 'off'}.`; }
  else if (has('curtain', 'blind')) { const pos = has('close', 'shut') ? 100 : 0; ofType('curtain').forEach(c => set(c.id, { pos }, 'voice')); reply = `Curtains ${pos ? 'closing' : 'opening'}.`; }
  else if (has('music', 'song', 'play')) { const p = !has('stop', 'pause', 'off'); music(p, p ? { zones: [ofType('speaker').find(s => s.room === room)?.id || 'spk_liv'] } : {}); reply = p ? 'Playing music.' : 'Music stopped.'; }
  else if (has('camera') && has('tv', 'television', 'screen', 'show')) { tvCameras(!has('off', 'stop', 'hide')); reply = has('off', 'stop', 'hide') ? 'Cameras off the TV.' : 'Showing the cameras on the TV.'; }
  else if (has('tv', 'television')) { set('tv_liv', { on: !has('off') }, 'voice'); reply = 'OK.'; }
  else if (num && has('degree', 'temperature', 'set', '°')) { const a = ofType('ac').find(x => x.room === room) || dev('ac_liv'); set(a.id, { on: true, set: Math.max(16, Math.min(30, +num[1])) }, 'voice'); reply = `${a.name} set to ${num[1]} degrees.`; }
  else if (has('cool', 'hot', 'ac ', 'air')) { const a = ofType('ac').find(x => x.room === room) || dev('ac_liv'); set(a.id, { on: !has('off') }, 'voice'); reply = 'Air-conditioning ' + (has('off') ? 'off.' : 'on.'); }
  notify('Voice assistant', reply ? `“${text}” → ${reply}` : `Sorry, I did not understand “${text}”.`, reply ? 'ok' : 'warn');
  if (reply) audio.say(reply); const c = $('#cmd'); if (c) c.value = '';
}

// ---------- smart lock keypad ----------
function renderLock() {
  const m = modelOf(dev('lock')), fr = home.security.lockFreeze > 0;
  $('#lockui').innerHTML = `<div class="modal"><h2>${m.name}</h2><div class="mut">${fr ? `<span style="color:var(--bad)">Keypad frozen for ${Math.ceil(home.security.lockFreeze)} s after 5 failed attempts.</span>` : 'Choose how to open the door. ' + m.note + '.'}</div>
    <div class="lockopts" style="margin-top:12px"><button data-a="lk" data-v="fp"><span>☝️</span>Fingerprint (Owner)</button>${m.face ? '<button data-a="lk" data-v="face"><span>🙂</span>Face recognition</button>' : ''}<button data-a="lk" data-v="card"><span>💳</span>Access card</button><button data-a="lk" data-v="bad"><span>🚫</span>Unregistered finger</button><button data-a="lk" data-v="bell"><span>🔔</span>Ring doorbell</button></div>
    <div class="pin">${'●'.repeat(pin.length) || '&nbsp;'}</div>
    <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, '✓'].map(k => `<button data-a="key" data-v="${k}">${k}</button>`).join('')}</div>
    <div class="mut">Owner PIN <b>${home.users[0].pin}</b>${home.tempPin ? ` · one-time PIN <b>${home.tempPin}</b>` : ''} · any other code fails (5 failures trigger the tamper alarm)</div>
    <button class="btn wide" data-a="close">Step back</button></div>`;
}
const done = ok => { if (ok) setTimeout(() => closeOverlay(), 450); else renderLock(); };
A.lk = v => {
  if (v === 'fp') done(unlockAttempt('fingerprint', true, 'Owner'));
  if (v === 'face') done(unlockAttempt('face recognition', true, 'Owner'));
  if (v === 'card') done(unlockAttempt('card', true, 'Owner'));
  if (v === 'bad') done(unlockAttempt('fingerprint', false));
  if (v === 'bell') { ringDoorbell('You'); }
};
A.key = v => {
  if (v === '⌫') pin = pin.slice(0, -1);
  else if (v === '✓') {
    const u = home.users.find(x => x.pin === pin), temp = home.tempPin && pin === home.tempPin; pin = '';
    if (temp) home.tempPin = null;
    return done(unlockAttempt(temp ? 'one-time PIN' : 'PIN', !!(u || temp), u ? u.name : temp ? 'Visitor' : 'unknown'));
  } else if (pin.length < 8) { pin += v; audio.sfx('beep'); }
  renderLock();
};

// ---------- device inspector / model chooser ----------
function openInspect(d) { inspected = d; renderInspect(); show('inspect'); }
function renderInspect() {
  const d = inspected, c = CATALOG[d.cat], st = Object.entries(d.state).filter(([, v]) => typeof v !== 'object' || v === null);
  const fmt = (k, v) => typeof v === 'boolean' ? (v ? 'yes' : 'no') : typeof v === 'number' ? (Math.round(v * 10) / 10) + ({ temp: ' °C', hum: ' %', bri: ' %', cct: ' K', set: ' °C', vol: ' %', pos: ' % closed', fade: ' s' }[k] || '') : v ?? 'white';
  $('#inspect').innerHTML = `<div class="modal"><div class="mut">${ROOMS[d.room].name}</div><h2>${d.name}</h2>
    ${c ? `<div style="color:var(--gold);margin:2px 0 8px">${c.title}</div><div class="mut">${c.blurb}</div>` : ''}
    ${st.length ? `<h3 style="font-size:12px;letter-spacing:.12em;color:var(--mut);margin:14px 0 4px">LIVE STATE</h3>${st.map(([k, v]) => `<div class="kv"><span>${k}</span><b>${fmt(k, v)}</b></div>`).join('')}` : ''}
    ${c ? `<h3 style="font-size:12px;letter-spacing:.12em;color:var(--mut);margin:14px 0 4px">INSTALLED MODEL — CHOOSE</h3>${c.models.map(m => `<button class="model ${m.id === d.model ? 'on' : ''}" data-a="setmodel" data-v="${m.id}"><div><b>${m.name}</b>${m.note ? `<small>${m.note}</small>` : ''}</div></button>`).join('')}` : ''}
    <button class="btn pri wide" data-a="close" style="margin-top:14px">Done</button></div>`;
}
function openHelp() {
  $('#help').innerHTML = `<div class="modal"><h2>Controls</h2>${[['W A S D / arrows', 'Walk'], ['Shift', 'Run'], ['Mouse', 'Look around (click the view to capture the mouse)'], ['E or left click', 'Use the device you are looking at'], ['Q or right click', 'Inspect a device and choose its model'], ['Tab', 'Open / close the phone app'], ['F', 'Control Centre: 2D plan, full control, project customisation'], ['C', 'Security cameras (click a tile for full screen)'], ['P', 'Ray-traced photo of the current view'], ['X', 'Disarm / silence the alarm'], ['M', 'Mute sound'], ['Esc', 'Release the mouse / close a panel']].map(([k, v]) => `<div class="kv"><b>${k}</b><span>${v}</span></div>`).join('')}
    <div class="mut" style="margin-top:10px">Tip: walk up to the MixPad by the entrance or beside the master-bedroom door and press E to use it like the real panel.</div><button class="btn pri wide" data-a="close">Got it</button></div>`;
  show('help');
}

// ---------- toasts, alarm banner, PiP ----------
bus.on('notify', n => {
  const t = document.createElement('div'); t.className = 'toast ' + n.level; t.innerHTML = `<b>${n.title}</b>${n.body ? `<span>${n.body}</span>` : ''}`;
  const box = $('#toasts'); box.prepend(t); while (box.children.length > 4) box.lastChild.remove();
  setTimeout(() => t.remove(), n.level === 'alarm' ? 9000 : 5500); if (n.level !== 'alarm') audio.sfx('chime');
});
bus.on('alarm', a => { ui.pip = a.cam || null; ui.pipUntil = 0; });
bus.on('prealarm', cam => { if (!home.security.alarm && has(cam)) { ui.pip = cam; ui.pipUntil = performance.now() + 14000; } });
bus.on('alarmclear', () => { ui.pip = null; });
bus.on('doorbell', () => { if (!home.security.alarm && has('cam_entry')) { ui.pip = 'cam_entry'; ui.pipUntil = 0; } });
A.pipx = () => { ui.pip = null; home.doorbell = null; };
A.pipunlock = () => { A.lock('unlock'); ui.pip = null; home.doorbell = null; };

// ---------- guided tour ----------
const QUESTS = [
  ['unlock', 'Unlock the door with the smart lock'], ['switch', 'Press a MixSwitch by hand'], ['mixpad', 'Use a MixPad wall panel'], ['scene', 'Run a scene from the app (Tab)'],
  ['dim', 'Dim a light or change its colour'], ['ac', 'Change the air-conditioning set-point'], ['sync', 'Play music and sync all rooms'], ['curtain', 'Move a curtain'],
  ['cctv', 'Open the security cameras (C)'], ['intrusion', 'Arm the system and simulate a break-in'], ['sos', 'Press an emergency button'], ['model', 'Inspect a device (Q) and change its model'],
].map(([id, text]) => ({ id, text, done: false }));
function quest(id) { const q = QUESTS.find(x => x.id === id); if (!q || q.done) return; q.done = true; renderQuests(); if (ui.tour) { audio.sfx('scene'); if (QUESTS.every(x => x.done)) notify('Tour complete!', 'You have seen everything the ORVIBO smart home can do.', 'ok'); } }
function renderQuests() {
  const el = $('#quests'); el.classList.toggle('hidden', !ui.tour);
  const n = QUESTS.filter(q => q.done).length;
  el.innerHTML = `<h4>GUIDED TOUR · ${n}/${QUESTS.length}</h4>` + QUESTS.filter(q => !q.done).slice(0, 4).map(q => `<div class="q">${q.text}</div>`).join('') + (n === QUESTS.length ? '<div class="q done">All objectives complete</div>' : '');
}
bus.on('unlock', e => e.outside && quest('unlock')); bus.on('used', d => d.type === 'switch' && quest('switch')); bus.on('openMixPad', () => quest('mixpad'));
bus.on('scene', e => (e.src === 'app' || e.src === 'MixPad') && quest('scene')); bus.on('ui', k => k === 'cctv' && quest('cctv')); bus.on('model', () => quest('model'));
bus.on('alarm', a => { if (a.type === 'intrusion') quest('intrusion'); if (a.type === 'sos') quest('sos'); });
bus.on('music', () => home.music.sync && home.music.playing && quest('sync'));
bus.on('device', ({ d, patch, src }) => {
  if (d.type === 'light' && src === 'app' && ('bri' in patch || 'rgb' in patch || 'cct' in patch)) quest('dim');
  if (d.type === 'ac' && src === 'app' && 'set' in patch) quest('ac'); if (d.type === 'curtain' && (src === 'app' || src === 'hand')) quest('curtain');
});

// ---------- HUD (called every frame) ----------
const mm = $('#minimap'), mc = mm.getContext('2d'); let accS = 1, accM = 1, lastPrompt = '';
export function updateHUD(dt, target, yaw, actors) {
  const p = home.player, s = home.security;
  // prompt
  const txt = target && !ui.open ? target.label() : '';
  if (txt !== lastPrompt) { lastPrompt = txt; $('#prompt').innerHTML = txt ? `<b>E</b>${txt}${target.dev && CATALOG[target.dev.cat] ? '<i>Q details</i>' : ''}` : ''; $('#prompt').classList.toggle('on', !!txt); $('#crosshair').classList.toggle('hot', !!txt); }
  accS += dt; accM += dt;
  $('#hud').classList.toggle('clean', ui.open === 'cctv' || ui.open === 'plan' || !$('#photo').classList.contains('hidden'));
  if (accS > 0.3) {
    accS = 0; const r = p.room, c = home.climate[r];
    $('#status').innerHTML = `<div class="room">${ROOMS[r]?.name || 'Outside'}</div><div class="row">${fmtTime()} · ${c ? `${c.temp.toFixed(1)} °C · ${c.hum.toFixed(0)} % RH` : `outdoor ${home.outdoor.temp.toFixed(0)} °C`}</div><div class="row">${secChip()} <span class="chip">${Math.round(home.energy)} W</span> <span class="chip">${ui.fps} fps</span>${home.music.playing ? ' <span class="chip">♪</span>' : ''}</div>`;
    const al = $('#alarm');
    if (s.alarm) { al.classList.remove('hidden'); al.innerHTML = `<b>⚠ ${s.alarm.title}</b><small>${s.alarm.where}</small><button data-a="arm" data-v="disarmed">Disarm (X)</button>`; } else al.classList.add('hidden');
    if (ui.pip && !s.alarm && (ui.pipUntil ? performance.now() > ui.pipUntil : !home.doorbell)) ui.pip = null;
    if (ui.pip && !has(ui.pip)) ui.pip = null;
    const pip = $('#pip'), showPip = ui.pip && (!ui.open || ui.open === 'phone'); pip.classList.toggle('hidden', !showPip); $('#hud').classList.toggle('haspip', !!showPip);
    if (showPip) {
      $('#pip-label').innerHTML = `${dev(ui.pip).name.toUpperCase()} <span style="color:var(--bad)">● ${s.alarm ? 'REC' : 'LIVE'}</span>`;
      const b = s.alarm ? '<button class="pri" data-a="arm" data-v="disarmed">Disarm</button><button data-a="cctv">All cameras</button>' : home.doorbell ? '<button class="pri" data-a="pipunlock">Unlock door</button><button data-a="pipx">Dismiss</button>' : '<button class="pri" data-a="cctv">All cameras</button><button data-a="pipx">Dismiss</button>';
      if ($('#pip-btns').dataset.k !== b) { $('#pip-btns').innerHTML = b; $('#pip-btns').dataset.k = b; }
    }
    if (ui.open === 'cctv') document.querySelectorAll('#cctv .cam').forEach((el, i) => { const d = cctvCams()[i]; if (!d) return; el.classList.toggle('off', !d.state.on); el.innerHTML = d.state.on ? `CAM ${i + 1} · ${d.name.toUpperCase()}${d.state.rec ? '<span class="rec">● REC</span>' : ''}<span class="ts">${fmtTime()}</span>` : `CAM ${i + 1} · ${d.name} — privacy mode`; });
    if (ui.open === 'lock' && s.lockFreeze > 0) renderLock();
  }
  ui.yaw = yaw;
  if (accM > 0.1) { accM = 0; drawMap(yaw, actors); if (ui.open === 'plan' && !hold) renderPlan(true); }
}
function drawMap(yaw, actors) {
  const W = mm.width, Hh = mm.height, sc = 15.2, ox = 30, oz = 16, X = x => ox + x * sc, Z = z => oz + z * sc;
  mc.clearRect(0, 0, W, Hh);
  for (const k in ROOMS) {
    const [x0, z0, x1, z1] = ROOMS[k].rect; let lum = 0; ofType('light').forEach(l => { if (l.room === k) lum += l.cur || 0; });
    mc.fillStyle = ROOMS[k].outside ? 'rgba(255,255,255,.04)' : `rgba(255,${200 + 30 * Math.min(1, lum)},${130},${0.07 + Math.min(0.5, lum * 0.22)})`; mc.fillRect(X(x0), Z(z0), (x1 - x0) * sc, (z1 - z0) * sc);
    mc.strokeStyle = home.occupancy[k] ? '#3ddc97' : 'rgba(255,255,255,.35)'; mc.lineWidth = home.occupancy[k] ? 2 : 1; mc.strokeRect(X(x0) + 0.5, Z(z0) + 0.5, (x1 - x0) * sc - 1, (z1 - z0) * sc - 1);
  }
  ofType('contact').forEach(d => { mc.fillStyle = d.state.open ? '#ff4d4d' : '#6fd3ff'; mc.fillRect(X(d.pos.x) - 3, Z(d.pos.z) - 3, 6, 6); });
  ofType('camera').forEach(d => { mc.fillStyle = d.state.rec ? '#ff4d4d' : '#c9a25a'; mc.beginPath(); mc.arc(X(d.pos.x), Z(d.pos.z), 3, 0, 7); mc.fill(); });
  actors.forEach(a => { if (a.active) { mc.fillStyle = a.name === 'intruder' ? '#ff2020' : '#ffb347'; mc.beginPath(); mc.arc(X(a.x), Z(a.z), 4.5, 0, 7); mc.fill(); } });
  const p = home.player; mc.save(); mc.translate(X(p.x), Z(p.z)); mc.rotate(-yaw); mc.fillStyle = '#fff'; mc.beginPath(); mc.moveTo(0, -8); mc.lineTo(5.5, 6); mc.lineTo(0, 3); mc.lineTo(-5.5, 6); mc.fill(); mc.restore();
}

export function initUI() { if (!initUI.done) { initUI.done = true; initPlan(); loadSavedProject(); } renderQuests(); ui.tour = $('#opt-tour').checked; renderQuests(); }
