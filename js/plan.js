// Control Centre: 2D floor-plan overview, full control of every device, and project customisation
// (which items are installed, which models, extra items placed by hand, bill of materials).
import { bus, home, set, dev, ofType, ROOMS, INDOOR, fmtTime, changed, notify } from './state.js';
import { SCENES } from './sim.js';
import { CATALOG, modelOf } from './catalog.js';
import { colliders } from './world.js';
import { setInstalled, addCustom, ADDABLE, setModel } from './devices.js';
import { actors } from './actors.js';
import { ui, A, devCard, ICON, secChip, alarmCard, sw, chips, closeOverlay } from './ui.js';

const $ = s => document.querySelector(s);
const KEY = 'dh-orvibo-project-v1';
export const project = { customer: '' };
export const P = { tab: 'control', sel: null, room: null, adding: null };
const listable = d => d.cat !== 'none' && !d.gone;
const everything = () => Object.values(home.devices).filter(listable);
const fixed = d => d.type === 'lock';                       // the entry lock is always part of the home
const defaults = {};                                        // id -> factory model

// ---------- persistence ----------
function snapshot() {
  const all = everything();
  return {
    v: 1, customer: project.customer,
    removed: all.filter(d => !d.custom && d.installed === false).map(d => d.id),
    models: Object.fromEntries(all.filter(d => !d.custom && defaults[d.id] && d.model !== defaults[d.id]).map(d => [d.id, d.model])),
    added: all.filter(d => d.custom && d.installed !== false).map(d => ({ ...d.custom, model: d.model })),
  };
}
let saveT = 0;
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(snapshot())); } catch (e) { /* private mode */ } }, 300); };
function apply(cfg, quiet) {
  project.customer = cfg.customer || '';
  for (const d of Object.values(home.devices)) {
    if (d.cat === 'none') continue;
    if (d.custom) { setInstalled(d, false); d.gone = true; continue; }
    setInstalled(d, fixed(d) || !(cfg.removed || []).includes(d.id));
    const m = (cfg.models || {})[d.id] || defaults[d.id];
    if (m && m !== d.model && CATALOG[d.cat]?.models.some(x => x.id === m)) { d.model = m; d.applyModel?.(modelOf(d)); }
  }
  for (const a of cfg.added || []) {
    const ex = home.devices[a.id];
    if (ex) { ex.gone = false; setInstalled(ex, true); } else addCustom(a);
  }
  layout(); save(); changed();
  if (!quiet) notify('Project loaded', `${everything().filter(d => d.installed !== false).length} items installed`, 'ok');
}
export function loadSavedProject() {
  for (const d of Object.values(home.devices)) defaults[d.id] = d.model;
  layout();
  try { const c = JSON.parse(localStorage.getItem(KEY) || 'null'); if (c && c.v === 1) apply(c, true); } catch (e) { /* ignore a damaged save */ }
}
bus.on('layout', () => { layout(); save(); }); bus.on('model', save);

const PRESETS = {
  full: ['Full showcase', () => true],
  essential: ['Essential', d => d.type === 'switch' || (d.type === 'light' && d.kind === 'down') || ['mp_liv', 'ds_entry', 'pr_living', 'cur_liv', 'ac_liv', 'ac_mas', 'th_living', 'th_master'].includes(d.id)],
  security: ['Security', d => ['contact', 'presence', 'camera', 'sos', 'hazard', 'switch'].includes(d.type) || (d.type === 'light' && d.kind === 'down') || ['mp_liv', 'valve_gas', 'valve_water'].includes(d.id)],
  comfort: ['Comfort & entertainment', d => ['light', 'curtain', 'ac', 'tv', 'speaker', 'mixpad', 'switch', 'climate'].includes(d.type) || d.id === 'fan_bath' || (d.type === 'presence' && d.room !== 'balcony')],
  none: ['Empty — start from scratch', () => false],
};

// ---------- plan layout: spread icons that share a spot ----------
function layout() {
  const ds = everything().filter(d => d.pos);
  for (const d of ds) d.mp = { x: d.pos.x, z: d.pos.z };
  for (let it = 0; it < 60; it++) for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) {
    const a = ds[i].mp, b = ds[j].mp; let dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    if (d >= 0.52) continue;
    if (d < 1e-4) { dx = Math.cos(i * 2.4 + j); dz = Math.sin(i * 2.4 + j); d = 1; }
    const p = (0.52 - d) / 2 / d; a.x -= dx * p; a.z -= dz * p; b.x += dx * p; b.z += dz * p;
  }
  for (const d of ds) { const r = ROOMS[d.room]?.rect; if (r) { d.mp.x = Math.max(r[0] + 0.28, Math.min(r[2] - 0.28, d.mp.x)); d.mp.z = Math.max(r[1] + 0.28, Math.min(r[3] - 0.28, d.mp.z)); } }
}

const active = d => {
  const s = d.state;
  switch (d.type) { case 'curtain': return s.pos < 50; case 'lock': return !s.locked; case 'contact': return s.open; case 'presence': return s.present; case 'hazard': return s.alarm; case 'camera': return s.on; case 'mixpad': case 'switch': case 'climate': case 'sos': return true; default: return !!s.on; }
};
const COL = { light: '#ffc65c', curtain: '#9db7ff', ac: '#63d2ff', tv: '#b48cff', speaker: '#ff9fd0', lock: '#ffb347', camera: '#c9a25a', relay: '#7fe0a8', contact: '#ff5c5c', presence: '#3ddc97', climate: '#7fd0e8', hazard: '#ff5c5c', sos: '#ff7a7a', mixpad: '#8fa8ff', switch: '#aab4c4' };
const WINDOWS = [['x', 0, 1.3, 3.1], ['x', 0, 5, 7, 'ws_bed'], ['x', 0, 9.4, 10.4], ['z', 0, 5, 8, 'ws_liv'], ['z', 12, 5.5, 8, 'ws_mas']];

function mapSVG() {
  const custom = P.tab === 'custom'; let s = `<svg id="plan-svg" viewBox="-2.3 -0.7 15 13" class="${P.adding ? 'adding' : ''}" data-a="pmap">`;
  for (const k in ROOMS) {
    const [x0, z0, x1, z1] = ROOMS[k].rect, R = ROOMS[k]; let lum = 0; ofType('light').forEach(l => { if (l.room === k) lum += l.cur || 0; });
    const occ = home.occupancy[k];
    s += `<rect class="room ${occ ? 'occ' : ''} ${P.room === k ? 'sel' : ''} ${R.outside ? 'out' : ''}" data-a="proom" data-v="${k}" x="${x0}" y="${z0}" width="${x1 - x0}" height="${z1 - z0}"/>`;
    if (!R.outside) s += `<rect class="glow" x="${x0}" y="${z0}" width="${x1 - x0}" height="${z1 - z0}" style="opacity:${Math.min(0.55, lum * 0.24).toFixed(2)}"/>`;
  }
  for (const c of colliders) {
    if (c.on === false) continue; const w = c.x1 - c.x0, d = c.z1 - c.z0;
    s += `<rect class="${c.wall || c.sill ? 'wall' : 'furn'}" x="${c.x0.toFixed(2)}" y="${c.z0.toFixed(2)}" width="${w.toFixed(2)}" height="${d.toFixed(2)}"/>`;
  }
  for (const k in ROOMS) { const [x0, , , z1] = ROOMS[k].rect, c = home.climate[k]; s += `<text class="rl" x="${x0 + 0.2}" y="${z1 - 0.22}">${ROOMS[k].name}${c ? ` · ${c.temp.toFixed(1)}° · ${c.hum.toFixed(0)}%` : ''}</text>`; }
  for (const [ax, at, a, b, id] of WINDOWS) { const o = id && dev(id).state.open; s += ax === 'x' ? `<line class="win ${o ? 'open' : ''}" x1="${a}" y1="${at}" x2="${b}" y2="${at}"/>` : `<line class="win ${o ? 'open' : ''}" x1="${at}" y1="${a}" x2="${at}" y2="${b}"/>`; }
  const lk = dev('lock'), ang = lk.cur || 0; s += `<line class="door ${lk.state.open ? 'open' : ''}" x1="5.26" y1="9" x2="${(5.26 + Math.cos(ang) * 0.9).toFixed(2)}" y2="${(9 - Math.sin(ang) * 0.9).toFixed(2)}"/>`;
  for (const d of everything()) {
    if (!d.mp) continue; const inst = d.installed !== false; if (!inst && !custom) continue;
    const on = inst && active(d), alert = inst && ((d.type === 'contact' && d.state.open) || (d.type === 'hazard' && d.state.alarm) || (d.type === 'camera' && d.state.rec));
    s += `<g class="dv ${on ? 'on' : ''} ${alert ? 'alert' : ''} ${inst ? '' : 'ghost'} ${P.sel === d.id ? 'sel' : ''}" data-a="pdev" data-id="${d.id}" transform="translate(${d.mp.x.toFixed(2)} ${d.mp.z.toFixed(2)})"><title>${d.name} — ${ROOMS[d.room].name}</title><circle r="0.22" style="--c:${COL[d.type] || '#aaa'}"/><text y="0.02">${ICON[d.type] || '•'}</text></g>`;
  }
  for (const a of actors) if (a.active) s += `<circle class="actor ${a.name}" cx="${a.x.toFixed(2)}" cy="${a.z.toFixed(2)}" r="0.2"/>`;
  const p = home.player; s += `<g transform="translate(${p.x.toFixed(2)} ${p.z.toFixed(2)}) rotate(${(-(ui.yaw || 0) * 180 / Math.PI).toFixed(0)})"><path class="me" d="M0 -0.34 L0.22 0.24 L0 0.12 L-0.22 0.24 Z"/></g>`;
  return s + '</svg>';
}

// ---------- side panel ----------
const row = d => `<div class="prow" data-a="pdev" data-id="${d.id}"><span class="pi">${ICON[d.type] || '•'}</span><div class="g"><b>${d.name}</b><small>${modelOf(d)?.name || ''}</small></div>${['light', 'ac', 'tv', 'speaker', 'relay', 'camera'].includes(d.type) ? sw(d.state.on, 'tog', `data-id="${d.id}"`) : `<span class="chip ${active(d) ? 'ok' : ''}">${d.type === 'curtain' ? d.state.pos + '%' : d.type === 'contact' ? (d.state.open ? 'open' : 'closed') : d.type === 'presence' ? (d.state.present ? 'occupied' : 'vacant') : d.type === 'climate' ? d.state.temp.toFixed(1) + '°' : d.type === 'lock' ? (d.state.locked ? 'locked' : 'unlocked') : 'ok'}</span>`}</div>`;
const modelSel = d => { const c = CATALOG[d.cat]; return c && c.models.length > 1 ? `<select data-c="model1" data-id="${d.id}">${c.models.map(m => `<option value="${m.id}" ${d.model === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}</select>` : `<span class="mut">${modelOf(d)?.name || ''}</span>`; };

function controlSide() {
  const d = P.sel && dev(P.sel);
  if (d && d.installed !== false) {
    const c = CATALOG[d.cat];
    return `<div class="hdr"><button class="back" data-a="pback">‹</button><b>${d.name}</b><span class="mut">${ROOMS[d.room].name}</span></div>${devCard(d)}
      <div class="card">${c ? `<b>${c.title}</b><div class="mut">${c.blurb}</div>` : ''}<div class="row"><label>Installed model</label>${modelSel(d)}</div>
      <div class="row"><button class="btn pri" data-a="pgo" data-id="${d.id}">Walk there in 3D</button>${fixed(d) ? '' : `<button class="btn" data-a="pinst" data-id="${d.id}">Remove from project</button>`}</div></div>`;
  }
  if (P.room) {
    const k = P.room, c = home.climate[k], ds = everything().filter(x => x.room === k && x.installed !== false), ls = ds.filter(x => x.type === 'light');
    return `<div class="hdr"><button class="back" data-a="pback">‹</button><b>${ROOMS[k].name}</b><span class="mut">${ds.length} items</span></div>
      ${c ? `<div class="stat"><div><b>${c.temp.toFixed(1)}°C</b><span>temperature</span></div><div><b>${c.hum.toFixed(0)}%</b><span>humidity</span></div><div><b>${home.occupancy[k] ? 'Yes' : 'No'}</b><span>occupied</span></div><div><b>${ls.filter(l => l.state.on).length}/${ls.length}</b><span>lights on</span></div></div>` : ''}
      <div class="row" style="margin:10px 0"><button class="btn pri" data-a="plights" data-v="1">Lights on</button><button class="btn" data-a="plights" data-v="0">Lights off</button>${INDOOR.includes(k) ? `<button class="btn" data-a="pgoroom" data-v="${k}">Walk there in 3D</button>` : ''}</div>
      ${ds.map(row).join('') || '<div class="mut">Nothing installed in this room. Open “Customise” to add items.</div>'}`;
  }
  const inst = everything().filter(x => x.installed !== false);
  return `${alarmCard()}<div class="stat"><div><b>${inst.length}</b><span>items</span></div><div><b>${ofType('light').filter(l => l.state.on).length}</b><span>lights on</span></div><div><b>${Math.round(home.energy)} W</b><span>power</span></div><div><b>${home.outdoor.temp.toFixed(0)}°</b><span>outdoor</span></div></div>
    <h3>Whole home</h3><div class="chips"><button data-a="pall" data-v="lon">All lights on</button><button data-a="pall" data-v="loff">All lights off</button><button data-a="pall" data-v="copen">Open curtains</button><button data-a="pall" data-v="cclose">Close curtains</button><button data-a="pall" data-v="acoff">All AC off</button><button data-a="cctv">Cameras</button></div>
    <h3>Rooms</h3>${[...INDOOR, 'balcony'].map(k => { const c = home.climate[k], n = ofType('light').filter(l => l.room === k && l.state.on).length; return `<div class="prow" data-a="proom" data-v="${k}"><span class="pi">${home.occupancy[k] ? '🟢' : '⚪'}</span><div class="g"><b>${ROOMS[k].name}</b><small>${c ? `${c.temp.toFixed(1)} °C · ${c.hum.toFixed(0)} % · ` : ''}${n} light${n === 1 ? '' : 's'} on</small></div><span class="mut">›</span></div>`; }).join('')}
    <div class="mut" style="margin-top:12px">Click a room or an icon on the plan. Click a selected icon again to switch it. The plan is live: it follows what happens in the apartment.</div>`;
}

function bom() {
  const m = new Map();
  for (const d of everything()) { if (d.installed === false) continue; const name = modelOf(d)?.name || d.name, k = (CATALOG[d.cat]?.title || 'Other') + '|' + name; m.set(k, (m.get(k) || 0) + (d.qty || 1)); }
  return [...m.entries()].map(([k, q]) => { const [cat, name] = k.split('|'); return { cat, name, q }; }).sort((a, b) => a.cat.localeCompare(b.cat) || a.name.localeCompare(b.name));
}
function customSide() {
  const groups = [...INDOOR, 'balcony', 'corridor'].map(k => [k, everything().filter(d => d.room === k)]).filter(([, l]) => l.length), list = bom();
  return `<div class="card"><div class="row"><label>Customer / project</label><input type="text" data-c="cust" value="${project.customer.replace(/"/g, '&quot;')}" placeholder="e.g. Villa 12 — Mr. Ahmed"></div>
      <div class="mut">Everything here is saved in this browser and can be exported as a project file.</div></div>
    <h3>Start from a package</h3><div class="chips">${Object.entries(PRESETS).map(([k, [l]]) => `<button data-a="preset" data-v="${k}">${l}</button>`).join('')}</div>
    <h3>Add an item ${P.adding ? `<span class="chip warn">click on the plan to place the ${ADDABLE[P.adding].label}</span>` : ''}</h3>
    <div class="chips">${Object.entries(ADDABLE).map(([k, a]) => `<button class="${P.adding === k ? 'on' : ''}" data-a="padd" data-v="${k}">${a.icon} ${a.label}</button>`).join('')}</div>
    <div class="mut" style="margin-top:6px">Wall items snap to the nearest wall; ceiling and floor items go exactly where you click. Click any icon on the plan to remove or restore it.</div>
    <h3>Installed items</h3>${groups.map(([k, l]) => `<div class="card"><b>${ROOMS[k].name}</b>${l.map(d => `<div class="prow ${d.installed === false ? 'off' : ''}"><button class="sw ${d.installed !== false ? 'on' : ''}" data-a="pinst" data-id="${d.id}" ${fixed(d) ? 'disabled' : ''}></button><span class="pi">${ICON[d.type] || '•'}</span><div class="g"><b>${d.name}${d.custom ? ' <span class="badge">ADDED</span>' : ''}</b>${modelSel(d)}</div></div>`).join('')}</div>`).join('')}
    <h3>Bill of materials — ${list.reduce((n, x) => n + x.q, 0)} pieces</h3><div class="card">${list.map(x => `<div class="kv"><span>${x.name}</span><b>× ${x.q}</b></div>`).join('')}</div>
    <div class="chips"><button data-a="pexp" data-v="csv">Download list (CSV)</button><button data-a="pexp" data-v="copy">Copy list</button><button data-a="pexp" data-v="json">Export project</button><button data-a="pimp">Import project</button><button data-a="preset" data-v="full">Reset</button></div>`;
}

let lastSide = '';
export function renderPlan(mapOnly) {
  if (ui.open !== 'plan') return;
  $('#plan-map').innerHTML = mapSVG();
  if (mapOnly) return;
  $('#plan-top').innerHTML = `<div class="brand">CONTROL CENTRE</div><span class="mut">${fmtTime()}${project.customer ? ' · ' + project.customer : ''}</span>${secChip()}
    <div class="seg">${[['disarmed', 'Disarm'], ['home', 'Arm Home'], ['away', 'Arm Away']].map(([v, l]) => `<button class="${home.security.mode === v ? 'on' : ''}" data-a="arm" data-v="${v}">${l}</button>`).join('')}</div>
    <div class="hscroll">${Object.entries(SCENES).map(([k, x]) => `<button class="pill" data-a="scene" data-v="${k}"><span>${x.icon}</span>${x.name}</button>`).join('')}</div>
    <button class="btn pri" data-a="close">Back to apartment (F)</button>`;
  const side = `<div class="seg ptabs">${[['control', 'Control'], ['custom', 'Customise project']].map(([v, l]) => `<button class="${P.tab === v ? 'on' : ''}" data-a="ptab" data-v="${v}">${l}</button>`).join('')}</div>` + (P.tab === 'custom' ? customSide() : controlSide());
  if (side !== lastSide) { $('#plan-side').innerHTML = side; lastSide = side; }
}

function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }

export function initPlan() {
  Object.assign(A, {
    plan: v => { if (v) P.tab = v; ui.openPlan(); },
    ptab: v => { P.tab = v; P.adding = null; }, pback: () => { P.sel = null; P.room = null; },
    proom: (v, id, e) => { if (P.adding) return A.pmap(v, id, e); P.room = v; P.sel = null; if (P.tab === 'custom') P.tab = 'control'; },
    pdev: (v, id) => {
      const d = dev(id); if (P.adding) return;
      if (P.tab === 'custom') { if (!fixed(d)) A.pinst(v, id); return; }
      if (P.sel === id && 'on' in d.state && d.type !== 'camera') set(id, { on: !d.state.on }, 'app');
      else if (P.sel === id && d.type === 'curtain') set(id, { pos: d.state.pos > 50 ? 0 : 100 }, 'app');
      P.sel = id; P.room = null;
    },
    pmap: (v, id, e) => {
      if (!P.adding) return; const svg = $('#plan-svg'), pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const q = pt.matrixTransform(svg.getScreenCTM().inverse()), d = addCustom({ kind: P.adding, x: q.x, z: q.y });
      if (d) { notify('Item added', `${d.name} — ${ROOMS[d.room].name}`, 'ok'); P.adding = null; }
      else notify('Cannot place it there', 'Click inside a room (wall items need a wall nearby).', 'warn');
    },
    padd: v => { P.adding = P.adding === v ? null : v; },
    pinst: (v, id) => {
      const d = dev(id); if (fixed(d)) return; const on = d.installed === false;
      setInstalled(d, on); if (d.custom && !on) { d.gone = true; layout(); } if (P.sel === id && !on) P.sel = null;
      notify(on ? 'Item restored' : 'Item removed from the project', d.name, on ? 'ok' : 'info');
    },
    preset: v => { for (const d of everything()) { if (d.custom) { setInstalled(d, false); d.gone = true; } else setInstalled(d, fixed(d) || PRESETS[v][1](d)); } P.sel = null; layout(); notify('Package applied', PRESETS[v][0], 'ok'); },
    plights: v => ofType('light').filter(l => l.room === P.room).forEach(l => set(l.id, { on: v === '1', fade: 1 }, 'app')),
    pall: v => {
      if (v === 'lon' || v === 'loff') ofType('light').forEach(l => set(l.id, { on: v === 'lon', fade: 1.2 }, 'app'));
      if (v === 'copen' || v === 'cclose') ofType('curtain').forEach(c => set(c.id, { pos: v === 'copen' ? 0 : 100 }, 'app'));
      if (v === 'acoff') ofType('ac').forEach(a => set(a.id, { on: false }, 'app'));
    },
    pgo: (v, id) => {
      const d = dev(id), r = ROOMS[INDOOR.includes(d.room) ? d.room : 'living'].rect, cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2;
      let dx = cx - d.pos.x, dz = cz - d.pos.z; const l = Math.hypot(dx, dz) || 1, k = Math.min(1.4, l); dx = dx / l * k; dz = dz / l * k;
      const x = Math.max(r[0] + 0.5, Math.min(r[2] - 0.5, d.pos.x + dx)), z = Math.max(r[1] + 0.5, Math.min(r[3] - 0.5, d.pos.z + dz));
      const hx = d.pos.x - x, hz = d.pos.z - z; closeOverlay(); bus.emit('teleport', { x, z, yaw: Math.atan2(-hx, -hz), pitch: Math.atan2(d.pos.y - 1.66, Math.hypot(hx, hz) || 1) });
    },
    pgoroom: v => { const r = ROOMS[v].rect; closeOverlay(); bus.emit('teleport', { x: (r[0] + r[2]) / 2, z: (r[1] + r[3]) / 2 + 0.6 }); },
    pexp: v => {
      const list = bom(), name = (project.customer || 'orvibo-project').replace(/[^\w\-]+/g, '_');
      const txt = `Digital Home — ORVIBO project${project.customer ? ' — ' + project.customer : ''}\n` + list.map(x => `${x.q} × ${x.name}`).join('\n');
      if (v === 'csv') download(name + '.csv', '﻿Category,Product,Quantity\n' + list.map(x => `"${x.cat}","${x.name}",${x.q}`).join('\n'), 'text/csv');
      if (v === 'json') download(name + '.json', JSON.stringify(snapshot(), null, 1), 'application/json');
      if (v === 'copy') { navigator.clipboard?.writeText(txt).then(() => notify('List copied', `${list.length} product lines`, 'ok'), () => notify('Copy is not available here', 'Use “Download list” instead.', 'warn')); }
    },
    pimp: () => { const f = document.createElement('input'); f.type = 'file'; f.accept = '.json,application/json'; f.onchange = () => f.files[0]?.text().then(t => { try { apply(JSON.parse(t)); } catch (e) { notify('That file is not a project file', '', 'warn'); } }); f.click(); },
  });
  $('#plan').addEventListener('change', e => { if (e.target.dataset.c === 'cust') { project.customer = e.target.value; save(); } });
}
