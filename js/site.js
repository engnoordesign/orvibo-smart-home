// Website: product catalogue, benefits, live apartment diagram, simulator entry — and the admin panel
// that edits all of it. No 3D code is loaded here; the simulator engine is imported afterwards.
import { CATALOG } from './catalog.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KEY = 'dh-site-v1', PROJECT_KEY = 'dh-orvibo-project-v1';
const clone = o => JSON.parse(JSON.stringify(o));

// ---------- default content (everything below can be changed in the admin panel) ----------
const INFO = {
  lock: { icon: '🔐', adv: ['No keys to carry or lose: open with a fingerprint, face, code, card or the app', 'One-time visitor codes and a full history of who opened the door', 'Unlocking runs your “Welcome Home” scene; leaving can lock and arm the home', 'Tamper alarm after repeated wrong attempts'], specs: { 'Unlock methods': 'Fingerprint, PIN, card, app, mechanical key (face on Face models)', 'Remote functions': 'Remote unlock, temporary PIN, open / close history', Alerts: 'Tamper, forced opening, door left open, low battery', Power: 'Battery powered, emergency power port', Integration: 'Scenes, automations and security arming' } },
  mixpad: { icon: '📱', adv: ['One wall panel for lighting, curtains, climate, music and security', 'Built-in smart-home gateway: no separate hub box on the shelf', 'Voice control and one-touch scenes for the whole family', 'Shows the door camera when someone rings'], specs: { Role: 'Touch control panel and smart-home gateway', Control: 'Touch screen, voice, scenes, app', Shows: 'Door camera, room climate, security state, music', Installation: 'Wall mounted, mains powered', Connectivity: 'Zigbee, Wi-Fi, Bluetooth (model dependent)' } },
  switch: { icon: '🔘', adv: ['Looks and works like a premium wall switch — guests need no training', 'Every key can switch a lamp, a group of lamps or a whole scene', 'Back-lit keys are easy to find at night', 'Keeps working by hand even if the network is down'], specs: { Keys: '1, 2 or 3 gang; scene keys available', Function: 'On / off, group control, scene trigger', Installation: 'Standard wall box', Connectivity: 'Zigbee', Finishes: 'Grey, gold, white' } },
  light_down: { icon: '💡', adv: ['Smooth dimming from a soft night glow to full brightness', 'Tunable white: warm in the evening, cool and fresh in the morning', 'Fades gently instead of snapping on and off', 'Presence lighting switches it on only when someone is in the room'], specs: { Dimming: '1 – 100 %', 'Colour temperature': '2700 – 6500 K tunable white', Fade: 'Adjustable fade time', Mounting: 'Recessed ceiling', Control: 'App, MixPad, MixSwitch, scenes, automations' } },
  light_spot: { icon: '🔦', adv: ['Accent light for artwork, shelves and reading corners', 'Narrow beam creates depth and atmosphere', 'Dimmable and tunable like the rest of the SOPRO range', 'Track versions can be repositioned without rewiring'], specs: { Beam: 'Narrow accent beam', Dimming: '1 – 100 %', 'Colour temperature': '2700 – 6500 K', Mounting: 'Ceiling, pendant or magnetic track', Control: 'App, MixPad, MixSwitch, scenes' } },
  light_strip: { icon: '🌈', adv: ['Hidden indirect light that makes ceilings float', '16 million colours plus tunable white in one strip', 'Colour scenes for film nights, dinners and parties', 'Follows the music in Party mode'], specs: { Light: 'RGB + tunable white', Dimming: '1 – 100 %', Effects: 'Colour scenes, music sync', Mounting: 'Ceiling shadow gap, furniture, mirror', Control: 'App, MixPad, MixSwitch, scenes' } },
  curtain: { icon: '🪟', adv: ['Curtains open with the sunrise and close at sunset by themselves', 'Any position from 0 to 100 %', 'Quiet motor; a light pull by hand starts it', 'Part of Movie, Sleep and Leave Home scenes'], specs: { Control: 'Open, close, stop, percentage', Operation: 'Quiet motor, touch-to-start', Schedules: 'Sunrise / sunset and timed', Integration: 'Scenes, automations, voice' } },
  presence: { icon: '🧍', adv: ['Knows when a room is occupied, even if you sit still', 'Lights and climate follow you from room to room', 'Empty rooms switch off: no wasted energy', 'In Away mode any presence raises the alarm'], specs: { Detection: 'Millimetre-wave presence (PIR motion on PIR model)', Use: 'Presence lighting, climate, security', Mounting: 'Ceiling or wall', Connectivity: 'Zigbee' } },
  climate: { icon: '🌡️', adv: ['Live temperature and humidity in every room', 'Starts the air-conditioning before a room gets uncomfortable', 'Runs the bathroom fan when it gets steamy', 'History helps tune comfort and energy use'], specs: { Measures: 'Temperature and relative humidity', Use: 'Comfort climate, ventilation automations', Power: 'Battery', Connectivity: 'Zigbee' } },
  contact: { icon: '🚪', adv: ['Tells you at once when a door or window opens', 'The backbone of the perimeter alarm', 'Pauses the air-conditioning while a window is open', 'Reminds you if the entry door is left open'], specs: { Detects: 'Open / closed', Use: 'Security, energy saving, reminders', Power: 'Battery', Connectivity: 'Zigbee' } },
  sos: { icon: '🆘', adv: ['One press calls for help — ideal beside the bed and in the bathroom', 'Alerts the family on their phones immediately', 'Lights the home and unlocks the door for helpers', 'Starts the cameras recording'], specs: { Action: 'One-press emergency alert', Response: 'Phone alert, lights on, door unlocked, recording', Power: 'Battery', Connectivity: 'Zigbee' } },
  hazard: { icon: '🛟', adv: ['Smoke, gas and water leaks are caught early, even when nobody is home', 'Closes the gas or water valve automatically', 'Ventilates, lights the escape route and unlocks the door', 'Phone alert with the exact room'], specs: { Types: 'Smoke, combustible gas, water leak', Response: 'Valve shut-off, ventilation, siren, phone alert', Mounting: 'Ceiling (smoke), wall (gas), floor (leak)', Connectivity: 'Zigbee' } },
  camera: { icon: '📷', adv: ['See your home from anywhere, on the phone, the MixPad or the TV', 'Records automatically when the alarm trips', 'Privacy mode switches the camera off when you are home', 'Pops up on screen when the doorbell rings'], specs: { Video: 'Full HD with night vision', Functions: 'Live view, motion recording, privacy mode, two-way talk', Views: 'App, MixPad, TV camera wall', Connectivity: 'Wi-Fi' } },
  speaker: { icon: '🔊', adv: ['Music in every room from invisible ceiling speakers', 'All rooms in perfect sync, or a different volume in each', 'Music is part of your scenes: morning, dinner, party', 'Lowers itself when the doorbell rings'], specs: { Role: 'Slave zone speaker', Zones: 'Per-room on / off and volume', Sync: 'Follows the master host', Mounting: 'Ceiling' } },
  artist: { icon: '🎵', adv: ['The heart of the multi-room music system', 'Feeds every slave speaker in perfect sync', 'Voice alerts for alarms through the whole home', 'Hi-fi sound in the main room'], specs: { Role: 'Master music host with amplifier', Zones: 'Drives the slave speakers', Sources: 'Streaming and local sources', Integration: 'Scenes, announcements' } },
  tv: { icon: '📺', adv: ['The TV joins your scenes: Movie Night dims the lights and closes the curtains', 'No more hunting for remotes', 'Shows the security cameras on the big screen', 'Switches itself off when you leave'], specs: { Control: 'Power, channel, input through the smart remote', Integration: 'Scenes, automations, camera wall on TV' } },
  ac: { icon: '❄️', adv: ['Cool or warm the home before you arrive', 'Each room keeps its own temperature', 'Pauses when a window is open', 'Comfort automations use real room temperature'], specs: { Control: 'Mode, set-point, fan speed, schedules', Modes: 'Cool, heat, dry, fan', 'Energy saving': 'Open-window pause, empty-room switch-off', Works: 'With VRF and split systems (controller dependent)' } },
  relay: { icon: '🔌', adv: ['Makes ordinary fans, valves and pumps smart', 'Lets safety sensors shut the gas or water', 'Joins any scene or automation', 'Hidden behind the wall — nothing to see'], specs: { Controls: 'Fans, valves, fixed loads', Use: 'Ventilation, gas / water shut-off', Integration: 'Scenes, automations' } },
};
const MSPEC = {
  mixpad: { '7U': { Screen: '7 inch' }, X: { Screen: '12.3 inch, landscape' }, S: { Screen: '6 inch, with physical keys' }, M5: { Screen: '5 inch' }, Mini: { Screen: '4 inch' }, Genie: { Screen: '4 inch, voice first' } },
  lock: { V5F: { Face: '3D face recognition', Doorbell: 'Built-in video doorbell' }, S2: { Unlock: 'Fingerprint, PIN, card, app, key' }, C1: { Unlock: 'Fingerprint, PIN, app, key' } },
  switch: { GR: { Finish: 'Space grey' }, GD: { Finish: 'Champagne gold' }, WH: { Finish: 'Pearl white' } },
  camera: { PTZ: { Type: 'Indoor, pan & tilt' }, BLT: { Type: 'Outdoor, weather resistant' } },
  presence: { MM: { Sensor: 'Millimetre-wave radar' }, PIR: { Sensor: 'Passive infrared, battery' } },
};
function defaults() {
  return {
    v: 1,
    brand: { name: 'DIGITAL HOME', tagline: 'Exclusive distributor of ORVIBO smart home', accent: '#c9a25a', phone: '', whatsapp: '', email: '', address: '', hours: '' },
    hero: { kicker: 'ORVIBO · WHOLE-HOME INTELLIGENCE', title: 'A home that knows you are there.', text: 'Lighting, climate, curtains, music and security working as one system. Explore every product, see it on a live plan of a real apartment, then walk through it yourself.', cta: 'Enter the simulation', cta2: 'Explore the products' },
    sections: [
      { id: 'benefits', on: true, title: 'Why a smart home', sub: 'What changes on the first day you live with it.' },
      { id: 'products', on: true, title: 'The ORVIBO range', sub: 'Advantages, models and specifications of every item in the system.' },
      { id: 'apartment', on: true, title: 'The apartment, live', sub: 'The same apartment as the 3D simulation. Every icon is a real device: click it to control it, or open “Customise project” to choose what is installed.' },
      { id: 'simulator', on: true, title: 'Walk through it', sub: 'Step inside in first person and use everything by hand, from the MixPad or from the phone app.' },
      { id: 'contact', on: true, title: 'Talk to us', sub: 'We design, supply and install complete ORVIBO systems.' },
    ],
    benefits: [
      { icon: '🛋️', title: 'Comfort', text: 'Lights fade on as you enter, the room is already at your temperature and the curtains follow the sun.' },
      { icon: '🛡️', title: 'Security', text: 'Sensors on every opening, cameras that record by themselves and an alarm that reacts in under a second.' },
      { icon: '🌿', title: 'Energy saving', text: 'Empty rooms switch off, air-conditioning pauses when a window opens and you see the consumption live.' },
      { icon: '🎶', title: 'Entertainment', text: 'Music in every room and a cinema scene that dims the lights and starts the film with one touch.' },
      { icon: '👆', title: 'Simplicity', text: 'One app, one wall panel and normal-looking switches. Everyone in the family can use it from the first minute.' },
      { icon: '❤️', title: 'Care', text: 'Emergency buttons, smoke, gas and leak sensors look after the people you love when you are not there.' },
    ],
    products: Object.entries(CATALOG).map(([key, c]) => ({
      key, show: true, icon: INFO[key]?.icon || '•', title: c.title, blurb: c.blurb, adv: INFO[key]?.adv || [], specs: INFO[key]?.specs || {},
      models: c.models.map(m => ({ id: m.id, name: m.name, note: m.note || '', specs: (MSPEC[key] || {})[m.id] || {} })),
    })),
    sim: { quality: 'balanced', tour: true, time: 19.4, season: 'summer' },
    pin: '1234',
  };
}

// ---------- load / save ----------
let cfg = defaults(), draft = false;
function merge(base, over) {
  if (!over || over.v !== 1) return base;
  for (const k of ['brand', 'hero', 'sim']) Object.assign(base[k], over[k] || {});
  for (const k of ['sections', 'benefits', 'products']) if (Array.isArray(over[k])) base[k] = over[k];
  if (over.pin) base.pin = String(over.pin);
  // products added to the simulator catalogue later still appear
  for (const d of defaults().products) if (!base.products.some(p => p.key === d.key)) base.products.push(d);
  for (const d of defaults().sections) if (!base.sections.some(s => s.id === d.id)) base.sections.push(d);
  return base;
}
let saveT = 0;
function save() { draft = true; clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* private mode */ } }, 250); }
async function load() {
  let local = null; try { local = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* ignore */ }
  if (local) { cfg = merge(defaults(), local); draft = true; return; }
  // no local edits: use the configuration published with the site, if there is one
  if (location.protocol === 'file:') return;          // opened from disk: nothing to fetch
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 1500);
    const r = await fetch('site-config.json', { signal: ctl.signal, cache: 'no-cache' }); clearTimeout(t);
    if (r.ok) { const pub = await r.json(); cfg = merge(defaults(), pub); if (pub.project && !localStorage.getItem(PROJECT_KEY)) localStorage.setItem(PROJECT_KEY, JSON.stringify(pub.project)); }
  } catch (e) { /* offline file or no published configuration */ }
}
// Keep the simulator's model lists in step with the catalogue edited here.
function syncCatalog() {
  for (const p of cfg.products) {
    const c = CATALOG[p.key]; if (!c) continue;
    c.title = p.title; c.blurb = p.blurb;
    for (const m of p.models) { const ex = c.models.find(x => x.id === m.id); if (ex) { ex.name = m.name; ex.note = m.note; } else c.models.push({ ...c.models[0], id: m.id, name: m.name, note: m.note }); }
    for (let i = c.models.length - 1; i >= 0; i--) if (c.models.length > 1 && !p.models.some(m => m.id === c.models[i].id)) c.models.splice(i, 1);
  }
}

// ---------- page ----------
let filter = 'all', engine = 'loading';
const sec = id => cfg.sections.find(s => s.id === id) || { on: false };
const head = s => `<div class="shead"><h2>${esc(s.title)}</h2>${s.sub ? `<p>${esc(s.sub)}</p>` : ''}</div>`;
const kv = o => Object.entries(o || {}).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
const enterBtn = (label, cls = 'cta') => `<button class="${cls}" data-s="enter" ${engine === 'ready' ? '' : 'disabled'}>${engine === 'error' ? '3D is not available in this browser' : engine === 'ready' ? esc(label) + ' ▸' : 'Preparing the apartment…'}</button>`;

const SECTIONS = {
  benefits: s => `<section id="benefits">${head(s)}<div class="bgrid">${cfg.benefits.map(b => `<div class="bcard"><div class="bi">${esc(b.icon)}</div><h3>${esc(b.title)}</h3><p>${esc(b.text)}</p></div>`).join('')}</div></section>`,
  products: s => {
    const list = cfg.products.filter(p => p.show !== false), shown = filter === 'all' ? list : list.filter(p => p.key === filter);
    return `<section id="products">${head(s)}
      <div class="pfilter"><button class="${filter === 'all' ? 'on' : ''}" data-s="filter" data-v="all">All products</button>${list.map(p => `<button class="${filter === p.key ? 'on' : ''}" data-s="filter" data-v="${esc(p.key)}">${esc(p.icon)} ${esc(p.title)}</button>`).join('')}</div>
      <div class="pgrid">${shown.map(p => `<article class="pcard">
        <div class="phead"><span class="pic">${esc(p.icon)}</span><div><h3>${esc(p.title)}</h3><small>${p.models.length} model${p.models.length === 1 ? '' : 's'}</small></div></div>
        <p>${esc(p.blurb)}</p>
        ${p.adv?.length ? `<ul class="adv">${p.adv.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
        <details ${filter === p.key ? 'open' : ''}><summary>Models &amp; specifications</summary>
          ${Object.keys(p.specs || {}).length ? `<table class="spec">${kv(p.specs)}</table>` : ''}
          ${p.models.map(m => `<div class="model1"><b>${esc(m.name)}</b>${m.note ? `<span>${esc(m.note)}</span>` : ''}${Object.keys(m.specs || {}).length ? `<table class="spec">${kv(m.specs)}</table>` : ''}</div>`).join('')}
        </details>
        ${CATALOG[p.key] ? `<button class="link" data-s="show" data-v="${esc(p.key)}">Show it in the apartment ↓</button>` : ''}
      </article>`).join('')}</div></section>`;
  },
  apartment: s => `<section id="apartment">${head(s)}<div id="plan-slot"></div><div class="legend"><span><i style="background:#ffc65c"></i>light on</span><span><i style="background:#3ddc97"></i>presence</span><span><i style="background:#ff5c5c"></i>open / alert</span><span><i style="background:#5ab8ff"></i>window</span><span>▲ you</span></div></section>`,
  simulator: s => `<section id="simulator"><div class="simcard">${head(s)}
      <div class="simopts"><label>Graphics <select data-s="quality">${[['low', 'Low — fastest'], ['balanced', 'Balanced'], ['high', 'High'], ['ultra', 'Ultra 4K']].map(([v, l]) => `<option value="${v}" ${cfg.sim.quality === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label><input type="checkbox" data-s="tour" ${cfg.sim.tour ? 'checked' : ''}> Guided tour</label></div>
      ${enterBtn(cfg.hero.cta, 'cta big')}
      <div class="keys">${[['W A S D', 'walk'], ['Mouse', 'look'], ['E', 'use'], ['Q', 'inspect'], ['Tab', 'phone app'], ['F', 'control centre'], ['C', 'cameras'], ['Esc', 'free the mouse']].map(([k, v]) => `<span><b>${k}</b>${v}</span>`).join('')}</div>
      <p class="fine">Runs in your browser. A computer with a mouse gives the best experience; if it feels slow, choose “Low”.</p></div></section>`,
  contact: s => {
    const b = cfg.brand, rows = [['Phone', b.phone, b.phone && `tel:${b.phone}`], ['WhatsApp', b.whatsapp, b.whatsapp && `https://wa.me/${b.whatsapp.replace(/\D/g, '')}`], ['Email', b.email, b.email && `mailto:${b.email}`], ['Address', b.address], ['Hours', b.hours]].filter(r => r[1]);
    return `<section id="contact">${head(s)}<div class="contact">${rows.map(([k, v, h]) => `<div><small>${k}</small>${h ? `<a href="${esc(h)}">${esc(v)}</a>` : `<b>${esc(v)}</b>`}</div>`).join('') || '<div><small>Contact details</small><b>Add them in the admin panel.</b></div>'}</div></section>`;
  },
};

function render() {
  const plan = $('#plan'); if (plan && !document.documentElement.classList.contains('in-sim')) document.body.appendChild(plan);   // keep the live diagram while the page is rebuilt
  const on = cfg.sections.filter(s => s.on && SECTIONS[s.id]), n = cfg.products.filter(p => p.show !== false);
  document.documentElement.style.setProperty('--acc', cfg.brand.accent || '#c9a25a'); document.title = `${cfg.brand.name} · ORVIBO Smart Home`;
  $('#site').innerHTML = `
    <nav><a class="brand" href="#top">${esc(cfg.brand.name)}</a><div class="links">${on.map(s => `<a href="#${s.id}">${esc(s.title)}</a>`).join('')}</div><button class="navcta" data-s="enter" ${engine === 'ready' ? '' : 'disabled'}>Simulation ▸</button></nav>
    <header id="top"><div class="shero"><div class="kicker">${esc(cfg.hero.kicker)}</div><h1>${esc(cfg.hero.title)}</h1><p>${esc(cfg.hero.text)}</p>
      <div class="hbtn">${enterBtn(cfg.hero.cta)}<a class="ghost" href="#products">${esc(cfg.hero.cta2)}</a></div>
      <div class="hstat"><span><b>${n.length}</b>product families</span><span><b>${n.reduce((a, p) => a + p.models.length, 0)}</b>models</span><span><b>5</b>rooms</span><span><b>70+</b>devices in the demo</span></div>
      <div class="tag">${esc(cfg.brand.tagline)}</div></div></header>
    <main>${on.map(s => SECTIONS[s.id](s)).join('')}</main>
    <footer><span>© ${new Date().getFullYear()} ${esc(cfg.brand.name)} — ${esc(cfg.brand.tagline)}</span><button class="link" data-s="admin">Admin</button></footer>`;
  if (!document.documentElement.classList.contains('in-sim')) {
    const slot = $('#plan-slot'); if (slot && plan) { slot.appendChild(plan); plan.classList.add('embedded'); plan.classList.remove('hidden'); } else if (plan) plan.classList.add('hidden');
    window.DH.bus?.emit('change');
  }
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-s]'); if (!el) return; const v = el.dataset.v;
  switch (el.dataset.s) {
    case 'enter': if (window.DH.ui) window.DH.ui.tour = !!cfg.sim.tour; window.DH.applyQuality?.(cfg.sim.quality); window.DH.enter?.(); break;
    case 'filter': filter = v; render(); break;
    case 'show': $('#apartment')?.scrollIntoView({ behavior: 'smooth' }); if (window.DH.focusCategory && !window.DH.focusCategory(v)) toast('This item is not installed in the current project', 'Switch it on under “Customise project”.'); break;
    case 'admin': openAdmin(); break;
  }
});
document.addEventListener('change', e => {
  const k = e.target.dataset?.s; if (k === 'quality') { cfg.sim.quality = e.target.value; save(); } if (k === 'tour') { cfg.sim.tour = e.target.checked; save(); }
});
const toast = (title, body) => window.DH.bus?.emit('notify', { title, body, level: 'info' });

// ---------- admin panel ----------
let tab = 'general', unlocked = false, pIdx = 0;
const get = path => path.split('.').reduce((o, k) => o?.[k], cfg);
function setPath(path, val) { const ks = path.split('.'), last = ks.pop(), o = ks.reduce((x, k) => x[k], cfg); o[last] = val; }
const fText = (label, path, ph = '') => `<label class="f"><span>${label}</span><input type="text" data-p="${path}" value="${esc(get(path))}" placeholder="${esc(ph)}"></label>`;
const fArea = (label, path, kind = '', rows = 3) => { let v = get(path); if (kind === 'lines') v = (v || []).join('\n'); if (kind === 'kv') v = Object.entries(v || {}).map(([k, x]) => `${k}: ${x}`).join('\n'); return `<label class="f"><span>${label}</span><textarea rows="${rows}" data-p="${path}" data-k="${kind}">${esc(v)}</textarea></label>`; };
const fCheck = (label, path) => `<label class="f chk"><input type="checkbox" data-p="${path}" ${get(path) !== false && get(path) ? 'checked' : ''}><span>${label}</span></label>`;
const ops = (path, i, n) => `<span class="ops"><button data-op="up" data-p="${path}" data-i="${i}" ${i === 0 ? 'disabled' : ''}>↑</button><button data-op="down" data-p="${path}" data-i="${i}" ${i === n - 1 ? 'disabled' : ''}>↓</button><button data-op="del" data-p="${path}" data-i="${i}">✕</button></span>`;

const ADMIN = {
  general: () => `<h3>Brand</h3>${fText('Company name', 'brand.name')}${fText('Tagline', 'brand.tagline')}<label class="f"><span>Accent colour</span><input type="color" data-p="brand.accent" value="${esc(cfg.brand.accent)}"></label>
    <h3>Hero (top of the page)</h3>${fText('Small heading', 'hero.kicker')}${fText('Main headline', 'hero.title')}${fArea('Introduction', 'hero.text')}${fText('Main button', 'hero.cta')}${fText('Second button', 'hero.cta2')}
    <h3>Contact</h3>${fText('Phone', 'brand.phone', '+…')}${fText('WhatsApp number', 'brand.whatsapp', '+…')}${fText('Email', 'brand.email')}${fText('Address', 'brand.address')}${fText('Opening hours', 'brand.hours')}`,
  sections: () => `<h3>Sections of the main page</h3><p class="hint">Switch sections on or off, rename them and change their order.</p>${cfg.sections.map((s, i) => `<div class="item"><div class="ihead">${fCheck(`<b>${esc(s.id)}</b>`, `sections.${i}.on`)}<span class="ops"><button data-op="up" data-p="sections" data-i="${i}" ${i === 0 ? 'disabled' : ''}>↑</button><button data-op="down" data-p="sections" data-i="${i}" ${i === cfg.sections.length - 1 ? 'disabled' : ''}>↓</button></span></div>${fText('Title', `sections.${i}.title`)}${fArea('Subtitle', `sections.${i}.sub`, '', 2)}</div>`).join('')}`,
  benefits: () => `<h3>Smart-home benefits</h3>${cfg.benefits.map((b, i) => `<div class="item"><div class="ihead"><b>${esc(b.icon)} ${esc(b.title)}</b>${ops('benefits', i, cfg.benefits.length)}</div>${fText('Icon (emoji)', `benefits.${i}.icon`)}${fText('Title', `benefits.${i}.title`)}${fArea('Text', `benefits.${i}.text`, '', 2)}</div>`).join('')}<button class="add" data-op="add" data-p="benefits">+ Add a benefit</button>`,
  products: () => {
    pIdx = Math.min(pIdx, cfg.products.length - 1); const p = cfg.products[pIdx], base = `products.${pIdx}`;
    return `<h3>Product catalogue</h3><label class="f"><span>Product</span><select data-adm="pick">${cfg.products.map((x, i) => `<option value="${i}" ${i === pIdx ? 'selected' : ''}>${esc(x.icon)} ${esc(x.title)}${x.show === false ? ' (hidden)' : ''}</option>`).join('')}</select></label>
      <div class="row2"><button class="add" data-op="addproduct">+ New product</button>${CATALOG[p.key] ? '' : `<button class="add danger" data-op="delproduct">Delete this product</button>`}</div>
      ${p ? `<div class="item">${fCheck('Show on the website', `${base}.show`)}${fText('Icon (emoji)', `${base}.icon`)}${fText('Name', `${base}.title`)}${fArea('Description', `${base}.blurb`)}${fArea('Advantages — one per line', `${base}.adv`, 'lines', 5)}${fArea('Specifications — one “Name: value” per line', `${base}.specs`, 'kv', 5)}</div>
      <h3>Models</h3>${p.models.map((m, i) => `<div class="item"><div class="ihead"><b>${esc(m.name)}</b>${ops(`${base}.models`, i, p.models.length)}</div>${fText('Model name', `${base}.models.${i}.name`)}${fText('Short note', `${base}.models.${i}.note`)}${fArea('Model specifications — “Name: value” per line', `${base}.models.${i}.specs`, 'kv', 3)}</div>`).join('')}<button class="add" data-op="add" data-p="${base}.models">+ Add a model</button>
      ${CATALOG[p.key] ? '<p class="hint">This product is used in the simulator: its models appear in the configurator there.</p>' : '<p class="hint">This product is shown in the catalogue only.</p>'}` : ''}`;
  },
  simulator: () => `<h3>Simulator defaults</h3><label class="f"><span>Graphics quality</span><select data-p="sim.quality">${['low', 'balanced', 'high', 'ultra'].map(v => `<option ${cfg.sim.quality === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    ${fCheck('Guided tour on by default', 'sim.tour')}<label class="f"><span>Time of day at start (0 – 24 h)</span><input type="number" min="0" max="23.9" step="0.1" data-p="sim.time" value="${cfg.sim.time}"></label>
    <label class="f"><span>Season</span><select data-p="sim.season">${['summer', 'winter'].map(v => `<option ${cfg.sim.season === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <p class="hint">Time and season apply the next time the page is opened.</p>
    <h3>Installed equipment</h3><p class="hint">Which devices are in the apartment, their models and any items you add are set on the live diagram, under “Customise project”. They are saved with this configuration.</p><button class="add" data-op="equip">Open the equipment editor</button>`,
  data: () => `<h3>Publish</h3><p class="hint">Changes are saved in this browser straight away. To make them the default for every visitor, download the configuration and place the file <b>site-config.json</b> next to index.html on the web server (or commit it to the repository).</p>
    <button class="add" data-op="export">Download site-config.json</button><button class="add" data-op="import">Import a configuration</button>
    <h3>Reset</h3><button class="add danger" data-op="reset">Discard my changes in this browser</button>
    <h3>Admin PIN</h3>${fText('PIN', 'pin')}<p class="hint">The PIN only keeps casual visitors out of this panel. It is not real security: anyone with access to the files can change the site.</p>`,
};
function openAdmin() {
  $('#admin').classList.remove('hidden'); document.body.classList.add('admin-open');
  if (!unlocked) { $('#admin').innerHTML = `<div class="apanel"><div class="ahead"><b>Admin</b><button data-op="close">✕</button></div><div class="abody"><h3>Enter the admin PIN</h3><input type="password" id="pin" inputmode="numeric" autocomplete="off"><button class="add" data-op="unlock">Unlock</button><p class="hint">Default PIN: 1234 — change it under “Data”.</p></div></div>`; setTimeout(() => $('#pin')?.focus(), 30); return; }
  renderAdmin();
}
function renderAdmin() {
  const body = $('#admin .abody'), top = body ? body.scrollTop : 0;
  $('#admin').innerHTML = `<div class="apanel"><div class="ahead"><b>Admin panel</b><span class="saved">${draft ? 'saved in this browser' : 'published version'}</span><button data-op="close">✕</button></div>
    <div class="atabs">${[['general', 'General'], ['sections', 'Sections'], ['benefits', 'Benefits'], ['products', 'Products'], ['simulator', 'Simulator'], ['data', 'Data']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-op="tab" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="abody">${ADMIN[tab]()}</div></div>`;
  $('#admin .abody').scrollTop = top;
}
let renderT = 0; const later = () => { clearTimeout(renderT); renderT = setTimeout(() => { syncCatalog(); render(); }, 300); };
$('#admin').addEventListener('input', e => {
  const t = e.target, p = t.dataset.p; if (!p) return;
  let v = t.type === 'checkbox' ? t.checked : t.type === 'number' ? +t.value : t.value;
  if (t.dataset.k === 'lines') v = t.value.split('\n').map(x => x.trim()).filter(Boolean);
  if (t.dataset.k === 'kv') v = Object.fromEntries(t.value.split('\n').map(l => l.split(/:(.*)/s)).filter(a => a[0].trim() && a[1] != null).map(a => [a[0].trim(), a[1].trim()]));
  setPath(p, v); save(); later();
});
$('#admin').addEventListener('change', e => { if (e.target.dataset.adm === 'pick') { pIdx = +e.target.value; renderAdmin(); } else if (e.target.tagName === 'SELECT' || e.target.type === 'checkbox') renderAdmin(); });
$('#admin').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && e.target.id === 'pin') $('#admin [data-op=unlock]').click(); });
$('#admin').addEventListener('click', e => {
  const el = e.target.closest('[data-op]'); if (!el) return; const op = el.dataset.op, path = el.dataset.p, i = +el.dataset.i, arr = path ? get(path) : null;
  const dl = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; a.click(); };
  switch (op) {
    case 'close': $('#admin').classList.add('hidden'); document.body.classList.remove('admin-open'); return;
    case 'unlock': if ($('#pin').value === String(cfg.pin)) { unlocked = true; renderAdmin(); } else { $('#pin').value = ''; $('#pin').placeholder = 'Wrong PIN'; } return;
    case 'tab': tab = el.dataset.v; break;
    case 'up': [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; break;
    case 'down': [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; break;
    case 'del': if (arr.length > 1 || path === 'benefits') arr.splice(i, 1); break;
    case 'add': arr.push(path === 'benefits' ? { icon: '✨', title: 'New benefit', text: '' } : { id: 'm' + Date.now().toString(36), name: 'New model', note: '', specs: {} }); break;
    case 'addproduct': cfg.products.push({ key: 'c' + Date.now().toString(36), show: true, icon: '📦', title: 'New product', blurb: '', adv: [], specs: {}, models: [{ id: 'm1', name: 'Model 1', note: '', specs: {} }] }); pIdx = cfg.products.length - 1; break;
    case 'delproduct': cfg.products.splice(pIdx, 1); pIdx = 0; break;
    case 'equip': $('#admin').classList.add('hidden'); document.body.classList.remove('admin-open'); $('#apartment')?.scrollIntoView({ behavior: 'smooth' }); document.querySelector('#plan [data-a=ptab][data-v=custom]')?.click(); return;
    case 'export': { let project = null; try { project = JSON.parse(localStorage.getItem(PROJECT_KEY) || 'null'); } catch (x) { /* none */ } dl('site-config.json', JSON.stringify({ ...cfg, project }, null, 1)); return; }
    case 'import': { const f = document.createElement('input'); f.type = 'file'; f.accept = '.json,application/json'; f.onchange = () => f.files[0]?.text().then(t => { try { const o = JSON.parse(t); if (o.v !== 1) throw 0; cfg = merge(defaults(), o); if (o.project) localStorage.setItem(PROJECT_KEY, JSON.stringify(o.project)); save(); syncCatalog(); render(); renderAdmin(); toast('Configuration imported', o.project ? 'Reload the page to apply the equipment list.' : ''); } catch (x) { toast('That file is not a site configuration', ''); } }); f.click(); return; }
    case 'reset': if (confirm('Discard all changes made in this browser and return to the published version?')) { localStorage.removeItem(KEY); location.reload(); } return;
  }
  save(); syncCatalog(); render(); renderAdmin();
});

// ---------- start ----------
window.DH = { sim: cfg.sim, onReady() { engine = 'ready'; render(); }, onError() { engine = 'error'; render(); } };
(async () => {
  await load(); window.DH.sim = cfg.sim; syncCatalog(); render();
  if (location.hash === '#admin') openAdmin();
  // load the simulator engine after the page has painted, so the site itself appears instantly
  setTimeout(() => import('./main.js').catch(e => { console.error(e); window.DH.onError(); }), 60);
})();
