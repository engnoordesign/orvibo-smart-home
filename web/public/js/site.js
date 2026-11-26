// Digital Home website: renders every section from the managed content and drives the live scenes.
import { sprite, icon } from './icons.js';
import { loadContent } from './store.js';
import { UI } from './content.js';
import { makeRoom, makeDoor, makeCRI, fixtureHasColour, TV_CHANNELS } from './scenes.js';

let C = null, LANG = 'ar';
try { LANG = localStorage.getItem('dh-lang') || 'ar'; } catch (e) { /* storage blocked */ }
const tx = o => (o && typeof o === 'object') ? (o[LANG] || o[LANG === 'ar' ? 'en' : 'ar'] || '') : (o || '');
const L = (ar, en) => (LANG === 'ar' ? ar : en);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const $ = s => document.querySelector(s);
const safeUrl = u => /^(https?:|data:image\/|\/api\/img\/|blob:)/i.test(u || '') ? u : '';
const lines = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);

// ---------- theme ----------
function applyTheme(t) { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
let THEME = null; try { THEME = localStorage.getItem('dh-theme'); } catch (e) { /* ignore */ }
applyTheme(THEME);
const isDark = () => THEME ? THEME === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;

// ---------- demo states (kept when the language changes) ----------
const S = {
  light: { sel: null, solo: true, room: { time: 21, down: { on: true, bri: 80, cct: 3000 } } },
  mixpad: { sel: null, room: { time: 20.5, down: { on: true, bri: 60, cct: 3000 }, strip: { on: true, bri: 50, cct: 2700 } } },
  lock: { sel: null, pin: '', fails: 0, frozen: 0, locked: true, log: [], otp: null, guest: false },
  curtain: { room: { time: 9, curtain: 0 } },
  climate: { room: { time: 20, down: { on: true, bri: 35, cct: 2700 }, strip: { on: true, bri: 35, cct: 2700 }, temp: 29.5 } },
  cri: { x: 50, flicker: false },
  remote: { room: { time: 20.5, down: { on: true, bri: 65, cct: 3000 }, pendant: { on: true, bri: 60 }, strip: { on: true, bri: 45, cct: 2700 } } },
};
const R = {};   // live scene objects

// ---------- scenes shared by the MixPad, the phone and the hero ----------
const SCENES = {
  welcome: { ic: 'home', n: ['وصلت البيت', 'Welcome'], s: () => ({ down: { on: true, bri: 70, cct: 3000 }, strip: { on: true, bri: 60, cct: 2700, rgb: null }, pendant: { on: true, bri: 60 }, spot: { on: true, bri: 65 }, track: { on: false }, washer: { on: false }, tv: { on: false }, ac: { on: true, mode: 'cool', set: 24, fan: 2 } }) },
  movie: { ic: 'film', n: ['سهرة فيلم', 'Movie'], s: () => ({ down: { on: false }, spot: { on: false }, pendant: { on: false }, track: { on: false }, washer: { on: true, bri: 30, rgb: '#3b5bff' }, strip: { on: true, bri: 22, rgb: '#3b5bff' }, curtain: 100, tv: { on: true, ch: 3 }, ac: { on: true, fan: 1 } }) },
  dinner: { ic: 'plate', n: ['عشاء', 'Dinner'], s: () => ({ down: { on: true, bri: 25, cct: 2700 }, pendant: { on: true, bri: 85 }, spot: { on: true, bri: 55, cct: 2700 }, strip: { on: true, bri: 45, rgb: '#ff9a4a' }, washer: { on: false }, track: { on: false }, tv: { on: false } }) },
  sleep: { ic: 'moon', n: ['تصبح على خير', 'Good night'], s: () => ({ down: { on: false }, spot: { on: false }, pendant: { on: false }, track: { on: false }, washer: { on: false }, strip: { on: true, bri: 8, rgb: '#ff8a3a' }, curtain: 100, tv: { on: false }, ac: { on: true, set: 25, fan: 1 } }) },
  morning: { ic: 'sun', n: ['صباح الخير', 'Morning'], s: () => ({ curtain: 0, sheer: 0, down: { on: true, bri: 60, cct: 5000 }, strip: { on: false }, pendant: { on: false }, spot: { on: false }, washer: { on: false }, tv: { on: false } }) },
  alloff: { ic: 'power', n: ['إطفاء الكل', 'All off'], s: () => ({ down: { on: false }, spot: { on: false }, pendant: { on: false }, track: { on: false }, washer: { on: false }, strip: { on: false }, tv: { on: false }, ac: { on: false } }) },
};
const runScene = (room, k) => room.set(SCENES[k].s());

// ---------- page ----------
const NAV = s => tx(UI.nav[s.id]);
const head = b => `<div class="shead"><h2>${esc(tx(b.title))}</h2>${tx(b.sub) ? `<p>${esc(tx(b.sub))}</p>` : ''}</div>`;
const prods = cat => C.products.filter(p => p.cat === cat && p.on !== false);
const pcard = (p, act, sel, ic) => `<button class="pc ${sel ? 'on' : ''}" data-a="${act}" data-v="${esc(p.id)}"><span class="thumb">${safeUrl(p.img) ? `<img src="${esc(safeUrl(p.img))}" alt="">` : icon(ic || p.icon || 'bulb')}</span><b>${esc(tx(p.name))}</b><small>${esc(tx(p.desc))}</small></button>`;
const specs = p => lines(tx(p.specs)).length ? `<ul class="specs">${lines(tx(p.specs)).map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : '';
const sw = (on, a, v = '') => `<button class="sw ${on ? 'on' : ''}" data-a="${a}" data-v="${v}" aria-pressed="${!!on}" aria-label="${L('تشغيل أو إيقاف', 'On or off')}"></button>`;
const chips = (items, cur, a) => `<div class="chips">${items.map(([v, l]) => `<button class="chip ${String(v) === String(cur) ? 'on' : ''}" data-a="${a}" data-v="${v}">${esc(l)}</button>`).join('')}</div>`;
const COLORS = ['#ff3b3b', '#ff9a3a', '#ffd84a', '#3ddc6a', '#33d6ff', '#3a5cff', '#a04aff', '#ff3bb0'];
const FIX_ICON = { down: 'bulb', spot: 'spot', strip: 'strip', track: 'track', pendant: 'pendant', washer: 'washer' };

const SECTIONS = {
  about: () => `<section class="section" id="about"><div class="wrap">${head({ title: C.about.title })}<div class="about"><p class="body">${esc(tx(C.about.body))}</p>
    <div class="cards">${C.about.points.map(p => `<div class="card">${icon(p.icon)}<h3>${esc(tx(p.title))}</h3><p>${esc(tx(p.text))}</p></div>`).join('')}</div></div>
    ${C.about.stats && C.about.stats.length ? `<div class="stats">${C.about.stats.map(s => `<div><b class="num">${esc(s.n)}</b><span>${esc(tx(s.label))}</span></div>`).join('')}</div>` : ''}</div></section>`,
  orvibo: () => { const o = C.orvibo; return `<section class="section alt" id="orvibo"><div class="wrap">${head({ title: o.title, sub: o.body })}
    <div class="cards three">${o.advantages.map(a => `<div class="card">${icon(a.icon)}<h3>${esc(tx(a.title))}</h3><p>${esc(tx(a.text))}</p></div>`).join('')}</div>
    <h3 style="margin-top:34px;font-size:22px">${esc(tx(o.compareTitle))}</h3>
    <div class="cmpwrap"><table class="cmp"><thead><tr><th></th>${o.columns.map(c => `<th>${esc(tx(c))}</th>`).join('')}</tr></thead><tbody>
    ${o.rows.map(r => `<tr><th>${esc(tx(r.label))}</th>${r.cells.map(([n, t]) => `<td><span class="dots" aria-label="${n}/3">${[1, 2, 3].map(i => `<i class="${i <= n ? 'f' : ''}"></i>`).join('')}</span>${esc(tx(t))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="note">${esc(tx(o.compareNote))}</p></div></section>`; },
  lighting: () => `<section class="section" id="lighting"><div class="wrap">${head(C.blocks.lighting)}<div class="demo"><div><div class="stage" id="st-light"></div></div><div class="panel" id="pn-light"></div></div></div></section>`,
  cri: () => { const c = C.cri, bar = (v, lbl, cls) => `<div class="crib ${cls}"><div class="row" style="justify-content:space-between"><b>${esc(lbl)}</b><span class="num">Ra ${esc(v)}${cls === 'ours' ? '+' : ''}</span></div><div class="track"><i style="width:${clamp(+v || 0, 0, 100)}%"></i></div></div>`;
    return `<section class="section" id="cri"><div class="wrap">${head(C.blocks.cri)}<div class="demo"><div><div class="stage" id="st-cri"></div><input type="range" min="4" max="96" value="50" data-i="crix" class="crislider" aria-label="${L('موضع المقارنة', 'Comparison position')}"></div>
      <div class="panel"><h3>${L('مؤشر تجسيد اللون', 'Colour rendering index')}</h3>${bar(c.ours, tx(c.oursLabel), 'ours')}${bar(c.other, tx(c.otherLabel), 'other')}
      <div class="row"><label>${L('كاميرا بطيئة', 'Slow-motion camera')}</label>${sw(S.cri.flicker, 'criflick')}<span class="desc">${L('تكشف الوميض', 'reveals flicker')}</span></div>
      <div class="chips"><button class="chip" data-a="crijump" data-v="96">${esc(tx(c.otherLabel))}</button><button class="chip" data-a="crijump" data-v="50">${L('نصف ونصف', 'Half and half')}</button><button class="chip" data-a="crijump" data-v="4">${esc(tx(c.oursLabel))}</button></div>
      <div class="plist">${c.points.map(pt => `<div><b>${esc(tx(pt.title))}</b><p class="desc">${esc(tx(pt.text))}</p></div>`).join('')}</div><p class="note">${esc(tx(c.note))}</p></div></div></div></section>`; },
  mixpad: () => `<section class="section alt" id="mixpad"><div class="wrap">${head(C.blocks.mixpad)}<div class="demo"><div><div class="stage" id="st-mixpad"></div></div><div class="panel" id="pn-mixpad"></div></div></div></section>`,
  lock: () => `<section class="section" id="lock"><div class="wrap">${head(C.blocks.lock)}<div class="demo"><div><div class="stage" id="st-lock"></div></div><div class="panel" id="pn-lock"></div></div></div></section>`,
  curtain: () => `<section class="section alt" id="curtain"><div class="wrap">${head(C.blocks.curtain)}<div class="demo"><div><div class="stage" id="st-curtain"></div></div><div class="panel" id="pn-curtain"></div></div></div></section>`,
  climate: () => `<section class="section" id="climate"><div class="wrap">${head(C.blocks.climate)}<div class="demo"><div><div class="stage" id="st-climate"></div></div><div class="panel" id="pn-climate"></div></div></div></section>`,
  remote: () => `<section class="section alt" id="remote"><div class="wrap">${head(C.blocks.remote)}<div class="phoneblk"><div class="phone"><div class="scr app" id="pn-remote"></div></div><div><div class="stage" id="st-remote"></div><div class="plist" style="margin-top:14px">${prods('remote').map(p => `<div class="card"><h3>${esc(tx(p.name))}</h3><p>${esc(tx(p.desc))}</p>${specs(p)}</div>`).join('')}</div></div></div></div></section>`,
  catalog: () => { const ps = prods('other'); return ps.length ? `<section class="section" id="catalog"><div class="wrap">${head(C.blocks.catalog)}<div class="grid3">${ps.map(p => `<article class="prod"><div class="ph">${safeUrl(p.img) ? `<img src="${esc(safeUrl(p.img))}" alt="" loading="lazy">` : icon(p.icon || 'box')}</div><div class="in"><h3>${esc(tx(p.name))}</h3><p class="desc">${esc(tx(p.desc))}</p>${specs(p)}</div></article>`).join('')}</div></div></section>` : ''; },
  projects: () => { const ps = C.projects.filter(p => p.on !== false); return `<section class="section alt" id="projects"><div class="wrap">${head(C.blocks.projects)}${ps.length ? `<div class="grid3">${ps.map(p => `<button class="prod proj" data-a="proj" data-v="${esc(p.id)}"><div class="ph">${safeUrl(p.images?.[0]) ? `<img src="${esc(safeUrl(p.images[0]))}" alt="" loading="lazy">` : icon('home')}${p.sample ? `<span class="tag">${L('مثال توضيحي', 'Example')}</span>` : ''}</div><div class="in"><h3>${esc(tx(p.title))}</h3><span class="meta">${[tx(p.type), tx(p.place), p.year].filter(Boolean).map(esc).join(' · ')}</span><p class="desc">${esc(tx(p.desc)).slice(0, 150)}${tx(p.desc).length > 150 ? '…' : ''}</p></div></button>`).join('')}</div>` : `<div class="empty">${L('قريباً: صور من المشاريع التي نفّذناها.', 'Coming soon: photos from the projects we have delivered.')}</div>`}</div></section>`; },
  contact: () => { const b = C.brand, items = [['phone', L('الهاتف', 'Phone'), b.phone], ['chat', 'WhatsApp', b.whatsapp], ['mail', L('البريد', 'Email'), b.email], ['pin', L('العنوان', 'Address'), tx(b.address)], ['clock', L('ساعات العمل', 'Opening hours'), tx(b.hours)], ['globe', 'Instagram', b.instagram], ['globe', 'Facebook', b.facebook]].filter(i => i[2]);
    return `<section class="section" id="contact"><div class="wrap">${head(C.blocks.contact)}${items.length ? `<div class="contact">${items.map(([ic, l, v]) => `<div class="card">${icon(ic)}<small>${esc(l)}</small><b>${esc(v)}</b></div>`).join('')}</div>` : `<div class="empty">${esc(C.brand.name)} — ${esc(tx(C.brand.tagline))}</div>`}</div></section>`; },
};

function render() {
  document.documentElement.lang = LANG; document.documentElement.dir = LANG === 'ar' ? 'rtl' : 'ltr';
  document.title = `${C.brand.name} · ${tx(C.brand.tagline)}`;
  document.documentElement.style.setProperty('--accent', C.brand.accent || '');
  if (!C.brand.accent) document.documentElement.style.removeProperty('--accent');
  const on = C.sections.filter(s => s.on && SECTIONS[s.id]);
  $('#app').innerHTML = `
  <header class="top"><div class="wrap"><a class="logo" href="#home"><b>${esc(C.brand.name)}</b><small>${esc(tx(C.brand.tagline))}</small></a>
    <nav>${on.filter(s => s.id !== 'catalog' || prods('other').length).map(s => `<a href="#${s.id}">${esc(NAV(s))}</a>`).join('')}</nav>
    <button class="tbtn" data-a="lang">${icon('globe')}${LANG === 'ar' ? 'English' : 'العربية'}</button>
    <button class="tbtn" data-a="theme" aria-label="${L('الوضع الليلي أو النهاري', 'Dark or light mode')}">${icon(isDark() ? 'sun' : 'moon')}</button></div></header>
  <main id="home">
    <div class="wrap"><div class="hero"><div><div class="kicker">${esc(tx(C.hero.kicker))}</div><h1>${esc(tx(C.hero.title))}</h1><p>${esc(tx(C.hero.text))}</p>
      <div class="ctas"><a class="btn pri" href="#lighting">${esc(tx(C.hero.cta))}</a><a class="btn" href="#contact">${esc(tx(C.hero.cta2))}</a>${C.brand.simulatorUrl ? `<a class="btn" href="${esc(safeUrl(C.brand.simulatorUrl))}" target="_blank" rel="noopener">${L('جولة ثلاثية الأبعاد', '3D walkthrough')}</a>` : ''}</div></div>
      <div class="stage" id="st-hero"><span class="cap" id="herocap"></span></div></div></div>
    ${on.map(s => SECTIONS[s.id]()).join('')}
  </main>
  <footer><div class="wrap"><span>© ${new Date().getFullYear()} ${esc(C.brand.name)} — ${esc(tx(C.brand.tagline))}</span><a href="admin.html">${L('لوحة الإدارة', 'Admin')}</a></div></footer>
  <div id="modal" class="modal" hidden></div>`;
  mountAll();
}

// ============================================================================================
//  DEMOS
// ============================================================================================
let heroTimer = 0;
function mountAll() {
  for (const k in R) delete R[k];
  // hero: the room cycles through a few scenes on its own
  const hero = $('#st-hero');
  if (hero) {
    R.hero = makeRoom(hero, { label: L('غرفة معيشة ذكية', 'Smart living room'), state: { time: 20.5 } });
    hero.insertAdjacentHTML('beforeend', `<span class="cap" id="herocap"></span><span class="live">● ${L('مباشر', 'Live')}</span>`);
    const seq = ['welcome', 'dinner', 'movie', 'sleep', 'morning'], times = { morning: 9.5, welcome: 20.5, dinner: 20.5, movie: 21.5, sleep: 23 }; let i = 0;
    const step = () => { const k = seq[i++ % seq.length]; runScene(R.hero, k); R.hero.set({ time: times[k] }); const cap = $('#herocap'); if (cap) cap.textContent = L('مشهد: ', 'Scene: ') + SCENES[k].n[LANG === 'ar' ? 0 : 1]; };
    clearInterval(heroTimer); step(); heroTimer = setInterval(step, 4200);
  }
  if ($('#st-light')) mountLight();
  if ($('#st-cri')) {
    // ordinary light on the left, ORVIBO on the right of the divider
    R.cri = makeCRI($('#st-cri'), { label: L('مقارنة جودة اللون', 'Colour quality comparison'), onSplit: x => { const r = $('.crislider'); if (r && document.activeElement !== r) r.value = Math.round(x / 8); S.cri.x = Math.round(x / 8); } });
    const lo = `${tx(C.cri.otherLabel)} · Ra ${C.cri.other}`, hi = `${tx(C.cri.oursLabel)} · Ra ${C.cri.ours}+`;
    R.cri.labels(lo, hi); R.cri.split(S.cri.x * 8); R.cri.flicker(S.cri.flicker);
  }
  if ($('#st-mixpad')) mountMixpad();
  if ($('#st-lock')) mountLock();
  if ($('#st-curtain')) mountCurtain();
  if ($('#st-climate')) mountClimate();
  if ($('#st-remote')) mountRemote();
}
const keep = (key, room) => { S[key].room = JSON.parse(JSON.stringify(room.st)); };

// ---------- lighting collection ----------
function lightProd() { const ps = prods('lighting'); return ps.find(p => p.id === S.light.sel) || ps[0]; }
function mountLight() {
  const p = lightProd(); if (p) S.light.sel = p.id;
  R.light = makeRoom($('#st-light'), { label: L('مشهد الإضاءة', 'Lighting scene'), state: { ...S.light.room, solo: S.light.solo ? p?.fixture : null }, focus: () => lightProd()?.fixture,
    onHot: h => { const q = prods('lighting').find(x => x.fixture === h); if (q) { selLight(q.id); } } });
  $('#st-light').insertAdjacentHTML('beforeend', `<span class="cap">${L('اضغط على أي مصباح في الصورة', 'Tap any light in the picture')}</span>`);
  panelLight();
}
function selLight(id) { const p = prods('lighting').find(x => x.id === id); if (!p) return; S.light.sel = id; const f = p.fixture; R.light.set({ [f]: { on: true }, solo: S.light.solo ? f : null }); keep('light', R.light); panelLight(); }
function panelLight() {
  const p = lightProd(), host = $('#pn-light'); if (!host) return;
  if (!p) { host.innerHTML = `<p class="desc">${L('أضف منتجات إضاءة من لوحة الإدارة.', 'Add lighting products in the admin panel.')}</p>`; return; }
  const f = p.fixture, Lt = R.light.st[f], rgb = fixtureHasColour(f);
  host.innerHTML = `<div class="plist">${prods('lighting').map(x => pcard(x, 'lsel', x.id === p.id, FIX_ICON[x.fixture])).join('')}</div>
    <div class="ctl"><h3>${esc(tx(p.name))}</h3><p class="desc">${esc(tx(p.desc))}</p>${specs(p)}
      <div class="row"><label>${L('التشغيل', 'Power')}</label>${sw(Lt.on, 'lpow')}</div>
      <div class="row"><label>${L('السطوع', 'Brightness')}</label><input type="range" min="1" max="100" value="${Lt.bri}" data-i="lbri" aria-label="${L('السطوع', 'Brightness')}"><span class="val num" id="v-lbri">${Lt.bri}%</span></div>
      <div class="row"><label>${L('لون الأبيض', 'White tone')}</label><input type="range" min="2700" max="6500" step="100" value="${Lt.cct}" data-i="lcct" aria-label="${L('حرارة اللون', 'Colour temperature')}"><span class="val num" id="v-lcct">${Lt.cct}K</span></div>
      ${rgb ? `<div class="row"><label>${L('اللون', 'Colour')}</label><div class="chips">${COLORS.map(c => `<button class="swatch ${Lt.rgb === c ? 'on' : ''}" style="background:${c}" data-a="lrgb" data-v="${c}" aria-label="${c}"></button>`).join('')}<button class="swatch ${!Lt.rgb ? 'on' : ''}" style="background:linear-gradient(90deg,#ffb46b,#fff,#cfe2ff)" data-a="lrgb" data-v="" aria-label="${L('أبيض', 'White')}"></button></div></div>` : ''}
      <div class="row"><label>${L('أجواء جاهزة', 'Presets')}</label>${chips([['relax', L('استرخاء', 'Relax')], ['read', L('قراءة', 'Reading')], ['focus', L('تركيز', 'Focus')], ['night', L('ليلي', 'Night light')]], '', 'lpre')}</div>
      <div class="row"><label>${L('وقت اليوم', 'Time of day')}</label>${chips([[13, L('نهار', 'Day')], [18.4, L('غروب', 'Sunset')], [21, L('ليل', 'Night')]], R.light.st.time, 'lday')}</div>
      <div class="row"><label>${L('عرض المصباح وحده', 'Show it alone')}</label>${sw(S.light.solo, 'lsolo')}</div></div>`;
}

// ---------- MixPad ----------
function mpProd() { const ps = prods('mixpad'); return ps.find(p => p.id === S.mixpad.sel) || ps[0]; }
function mountMixpad() {
  const p = mpProd(); if (p) S.mixpad.sel = p.id;
  R.mixpad = makeRoom($('#st-mixpad'), { label: L('الغرفة التي تتحكم بها اللوحة', 'The room the panel controls'), state: S.mixpad.room, onHot: h => { mpAct(h === 'curtain' ? 'cur' : h === 'ac' ? 'ac' : h === 'tv' ? 'tv' : 'l:' + h); } });
  $('#st-mixpad').insertAdjacentHTML('beforeend', `<span class="cap">${L('الغرفة تستجيب لما تضغطه على اللوحة', 'The room follows what you tap on the panel')}</span>`);
  panelMixpad();
}
function mpScreen() {
  const r = R.mixpad.st, model = mpProd()?.model || 'x', tile = (a, ic, name, sub, on) => `<button class="mpt ${on ? 'on' : ''}" data-a="mp" data-v="${a}">${icon(ic)}<span>${esc(name)}</span><small>${esc(sub)}</small></button>`;
  const now = new Date(), hh = String(Math.floor(r.time)).padStart(2, '0') + ':' + String(Math.round((r.time % 1) * 60)).padStart(2, '0');
  const lt = (f, n) => tile('l:' + f, FIX_ICON[f], n, r[f].on ? r[f].bri + '%' : L('مطفأ', 'Off'), r[f].on);
  const scenes = ['welcome', 'movie', 'sleep', 'alloff'].map(k => tile('s:' + k, SCENES[k].ic, SCENES[k].n[LANG === 'ar' ? 0 : 1], L('مشهد', 'Scene'), false));
  const all = [...scenes, lt('down', L('الإضاءة', 'Lights')), lt('strip', L('المخفية', 'Strip')), lt('pendant', L('المعلّقة', 'Pendant')), tile('cur', 'curtain', L('الستارة', 'Curtain'), r.curtain > 50 ? L('مغلقة', 'Closed') : L('مفتوحة', 'Open'), r.curtain < 50),
    tile('ac', 'ac', L('المكيّف', 'AC'), r.ac.on ? r.ac.set + '°' : L('مطفأ', 'Off'), r.ac.on), tile('acu', 'up', L('درجة +', 'Temp +'), r.ac.set + '°', false), tile('acd', 'down', L('درجة −', 'Temp −'), r.ac.set + '°', false), tile('tv', 'tv', L('التلفزيون', 'TV'), r.tv.on ? L('يعمل', 'On') : L('مطفأ', 'Off'), r.tv.on)];
  const tiles = model === 'mini' ? [scenes[0], scenes[2], lt('down', L('الإضاءة', 'Lights')), tile('cur', 'curtain', L('الستارة', 'Curtain'), r.curtain > 50 ? L('مغلقة', 'Closed') : L('مفتوحة', 'Open'), r.curtain < 50)] : model === '7' ? all.slice(0, 8) : all;
  return `<div class="device ${model === 'mini' ? 'mini light' : model === '7' ? 'm7' : ''}"><div class="mpscreen"><div class="mphead"><b class="num">${hh}</b><span>${L('الصالة', 'Living room')} · ${r.temp.toFixed(1)}°</span></div><div class="mpgrid">${tiles.join('')}</div></div></div>`;
}
function panelMixpad() {
  const p = mpProd(), host = $('#pn-mixpad'); if (!host) return;
  host.innerHTML = `<div id="mpdev">${mpScreen()}</div>${p ? `<div class="ctl"><h3>${esc(tx(p.name))}</h3><p class="desc">${esc(tx(p.desc))}</p>${specs(p)}</div>` : ''}<div class="plist">${prods('mixpad').map(x => pcard(x, 'mpsel', x.id === p?.id, 'panel')).join('')}</div>`;
}
function mpAct(v) {
  const r = R.mixpad, st = r.st;
  if (v.startsWith('s:')) runScene(r, v.slice(2));
  else if (v.startsWith('l:')) { const f = v.slice(2); if (st[f]) r.set({ [f]: { on: !st[f].on } }); }
  else if (v === 'cur') r.set({ curtain: st.curtain > 50 ? 0 : 100 });
  else if (v === 'ac') r.set({ ac: { on: !st.ac.on } });
  else if (v === 'acu' || v === 'acd') r.set({ ac: { on: true, set: clamp(st.ac.set + (v === 'acu' ? 1 : -1), 16, 30) } });
  else if (v === 'tv') r.set({ tv: { on: !st.tv.on } });
  keep('mixpad', r); const d = $('#mpdev'); if (d) d.innerHTML = mpScreen();
}

// ---------- the smart lock ----------
const PIN = '2580';
function lockProd() { const ps = prods('lock'); return ps.find(p => p.id === S.lock.sel) || ps[0]; }
function mountLock() {
  const p = lockProd(); if (p) S.lock.sel = p.id;
  R.lock = makeDoor($('#st-lock'), { label: L('باب المدخل مع القفل الذكي', 'Front door with the smart lock') });
  R.lock.set({ face: (p?.model || 'face') === 'face', guest: S.lock.guest });
  $('#st-lock').insertAdjacentHTML('beforeend', `<span class="cap">${L('باب المدخل', 'Front door')}</span>`);
  panelLock();
}
const now = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
function lockLog(ar, en) { S.lock.log.unshift({ t: now(), ar, en }); S.lock.log = S.lock.log.slice(0, 12); }
function panelLock() {
  const p = lockProd(), s = S.lock, host = $('#pn-lock'); if (!host) return;
  const face = (p?.model || 'face') === 'face', status = s.frozen > Date.now() ? [L('مجمّد بعد محاولات خاطئة', 'Frozen after wrong tries'), 'bad'] : s.locked ? [L('مقفل', 'Locked'), 'ok'] : [L('مفتوح', 'Unlocked'), ''];
  host.innerHTML = `<div class="lockui"><div class="lockface">${face ? '<span class="camdot"></span>' : ''}<div class="pinview num" aria-live="polite">${'●'.repeat(s.pin.length) || '&nbsp;'}</div>
      <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, '✓'].map(k => `<button data-a="lk" data-v="${k === '⌫' ? 'del' : k === '✓' ? 'ok' : k}" aria-label="${k}">${k}</button>`).join('')}</div>
      <button class="fp" data-a="lk" data-v="fp" aria-label="${L('البصمة', 'Fingerprint')}">${icon('fp')}</button></div>
    <div class="ctl"><div class="row"><b>${L('الحالة', 'Status')}:</b> <span class="chip ${status[1] === 'bad' ? '' : ''}" style="${status[1] === 'bad' ? 'color:var(--bad)' : status[1] === 'ok' ? 'color:var(--ok)' : ''}">${status[0]}</span></div>
      <div class="chips"><button class="chip" data-a="lk" data-v="fp">${L('بصمة مسجّلة', 'Registered finger')}</button>${face ? `<button class="chip" data-a="lk" data-v="face">${L('الوجه', 'Face')}</button>` : ''}<button class="chip" data-a="lk" data-v="card">${L('البطاقة', 'Card')}</button><button class="chip" data-a="lk" data-v="bad">${L('بصمة غريبة', 'Unknown finger')}</button></div>
      <div class="chips"><button class="chip" data-a="lk" data-v="bell">${icon('bell')} ${L('زائر يرن الجرس', 'Visitor rings')}</button><button class="chip" data-a="lk" data-v="remote">${icon('phone')} ${L('افتح من الهاتف', 'Open from phone')}</button><button class="chip" data-a="lk" data-v="otp">${icon('key')} ${L('رمز لمرة واحدة', 'One-time code')}</button><button class="chip" data-a="lk" data-v="lock">${icon('lock')} ${L('اقفل الآن', 'Lock now')}</button></div>
      <p class="desc">${L('الرمز التجريبي', 'Demo code')}: <b class="num">${PIN}</b>${s.otp ? ` · ${L('رمز الزائر', 'Visitor code')}: <b class="num">${s.otp}</b>` : ''} · ${L('خمس محاولات خاطئة تُطلق الإنذار.', 'Five wrong tries raise the alarm.')}</p>
      <div class="log">${s.log.map(l => `<div><i>${l.t}</i>${esc(LANG === 'ar' ? l.ar : l.en)}</div>`).join('') || `<div>${L('سجل الدخول يظهر هنا.', 'The entry history appears here.')}</div>`}</div></div></div>
    ${p ? `<div class="ctl"><h3>${esc(tx(p.name))}</h3><p class="desc">${esc(tx(p.desc))}</p>${specs(p)}</div>` : ''}<div class="plist">${prods('lock').map(x => pcard(x, 'lksel', x.id === p?.id, 'lock')).join('')}</div>`;
}
let doorTimer = 0;
function unlock(ar, en) {
  const s = S.lock, d = R.lock; s.locked = false; s.fails = 0; d.set({ alarm: false }); d.flash('#3ddc6a'); d.open(true); lockLog(`فُتح الباب: ${ar}`, `Door opened: ${en}`);
  clearTimeout(doorTimer); doorTimer = setTimeout(() => { d.open(false); setTimeout(() => { s.locked = true; lockLog('أُقفل الباب تلقائياً', 'Door locked automatically'); if (s.guest) { s.guest = false; d.set({ guest: false }); } panelLock(); }, 1400); }, 4200);
}
function fail(ar, en) {
  const s = S.lock, d = R.lock; s.fails++; d.flash('#ff3b3b'); lockLog(`محاولة خاطئة (${ar}) ${s.fails}/5`, `Wrong attempt (${en}) ${s.fails}/5`);
  if (s.fails >= 5) { s.fails = 0; s.frozen = Date.now() + 15000; d.set({ alarm: true }); lockLog('إنذار عبث! أُرسل تنبيه للهاتف', 'Tamper alarm! Phone alerted'); setTimeout(() => { d.set({ alarm: false }); panelLock(); }, 15000); }
}
function lockAct(v) {
  const s = S.lock, d = R.lock; if (!d) return;
  if (s.frozen > Date.now() && !['bell', 'lock'].includes(v)) { d.flash('#ff3b3b', 0.6); return panelLock(); }
  if (/^\d$/.test(v)) { if (s.pin.length < 8) s.pin += v; d.keys(); }
  if (v === 'del') s.pin = s.pin.slice(0, -1);
  if (v === 'ok') { const ok = s.pin === PIN || (s.otp && s.pin === s.otp); if (ok) { unlock(s.pin === PIN ? 'الرمز' : 'رمز الزائر', s.pin === PIN ? 'code' : 'visitor code'); if (s.pin === s.otp) s.otp = null; } else fail('رمز', 'code'); s.pin = ''; }
  if (v === 'fp') { d.scan(); setTimeout(() => { unlock('البصمة', 'fingerprint'); panelLock(); }, 800); }
  if (v === 'face') { d.scan(1.2); setTimeout(() => { unlock('الوجه', 'face'); panelLock(); }, 1200); }
  if (v === 'card') unlock('البطاقة', 'card');
  if (v === 'bad') { d.scan(0.6); setTimeout(() => { fail('بصمة', 'finger'); panelLock(); }, 650); }
  if (v === 'bell') { s.guest = true; d.set({ guest: true }); lockLog('زائر عند الباب — ظهرت صورته على الهاتف', 'Visitor at the door — shown on the phone'); }
  if (v === 'remote') unlock('من الهاتف', 'from the phone');
  if (v === 'otp') { s.otp = String(100000 + Math.floor(Math.random() * 900000)); lockLog('أُنشئ رمز زائر لمرة واحدة', 'One-time visitor code created'); }
  if (v === 'lock') { clearTimeout(doorTimer); d.open(false); s.locked = true; lockLog('أُقفل من الهاتف', 'Locked from the phone'); }
  panelLock();
}

// ---------- curtains ----------
function mountCurtain() {
  R.curtain = makeRoom($('#st-curtain'), { label: L('الستارة الذكية', 'Smart curtain'), state: S.curtain.room, fixtures: [], onHot: h => { if (h === 'curtain') curAct(R.curtain.st.curtain > 50 ? 'open' : 'close'); } });
  $('#st-curtain').insertAdjacentHTML('beforeend', `<span class="cap">${L('اضغط على الستارة لفتحها أو إغلاقها', 'Tap the curtain to open or close it')}</span>`);
  panelCurtain();
}
const fmtT = t => String(Math.floor(t)).padStart(2, '0') + ':' + String(Math.round((t % 1) * 60) % 60).padStart(2, '0');
function panelCurtain() {
  const st = R.curtain.st, host = $('#pn-curtain'), p = prods('curtain')[0]; if (!host) return;
  host.innerHTML = `<div class="ctl"><div class="row"><label>${L('نسبة الإغلاق', 'Closed')}</label><input type="range" min="0" max="100" step="5" value="${st.curtain}" data-i="cpos" aria-label="${L('نسبة الإغلاق', 'Closed')}"><span class="val num" id="v-cpos">${st.curtain}%</span></div>
    ${chips([['open', L('فتح', 'Open')], ['half', L('نصف', 'Half')], ['stop', L('إيقاف', 'Stop')], ['close', L('إغلاق', 'Close')]], '', 'cact')}
    <div class="row"><label>${L('الستارة الشفافة', 'Sheer layer')}</label>${sw(st.sheer > 50, 'csheer')}</div>
    <div class="row"><label>${L('الوقت', 'Time')}</label><input type="range" min="5" max="23" step="0.25" value="${st.time}" data-i="ctime" aria-label="${L('الوقت', 'Time')}"><span class="val num" id="v-ctime">${fmtT(st.time)}</span></div>
    <div class="row"><label>${L('أتمتة', 'Automation')}</label>${chips([['sunrise', L('تُفتح مع الشروق', 'Open at sunrise')], ['sunset', L('تُغلق مع الغروب', 'Close at sunset')]], '', 'cauto')}</div></div>
    ${p ? `<div class="ctl"><h3>${esc(tx(p.name))}</h3><p class="desc">${esc(tx(p.desc))}</p>${specs(p)}</div>` : ''}
    ${prods('curtain').length > 1 ? `<div class="plist">${prods('curtain').map(x => pcard(x, 'noop', false, 'curtain')).join('')}</div>` : ''}`;
}
function curAct(v) {
  const r = R.curtain; if (!r) return;
  if (v === 'open') r.set({ curtain: 0 }); if (v === 'close') r.set({ curtain: 100 }); if (v === 'half') r.set({ curtain: 50 });
  if (v === 'stop') r.set({ curtain: Math.round(r.pos()) });
  keep('curtain', r); panelCurtain();
}
let sunAnim = 0;
function curAuto(v) {
  const r = R.curtain, from = r.st.time, to = v === 'sunrise' ? 6.6 : 18.4; cancelAnimationFrame(sunAnim); const t0 = performance.now();
  const step = now => { const k = Math.min(1, (now - t0) / 1600); r.set({ time: from + (to - from) * k }); const vv = $('#v-ctime'); if (vv) vv.textContent = fmtT(r.st.time); if (k < 1) sunAnim = requestAnimationFrame(step); else { r.set({ curtain: v === 'sunrise' ? 0 : 100 }); keep('curtain', r); panelCurtain(); } };
  sunAnim = requestAnimationFrame(step);
}

// ---------- climate & TV ----------
function mountClimate() {
  R.climate = makeRoom($('#st-climate'), { label: L('المكيّف والتلفزيون', 'AC and TV'), state: S.climate.room, fixtures: ['down', 'strip'], alwaysTick: true, guest: () => S.lock.guest,
    onHot: h => { if (h === 'ac') clAct('acpow'); if (h === 'tv') clAct('tvpow'); },
    onTick: (dt, st) => { const tgt = st.ac.on ? st.ac.set : 30.5, rate = st.ac.on ? (st.ac.mode === 'fan' ? 0.02 : (0.12 + st.ac.fan * 0.08)) : 0.04; if (st.ac.on && st.ac.mode === 'fan') return false; const d = tgt - st.temp; if (Math.abs(d) > 0.02) { st.temp += Math.sign(d) * Math.min(Math.abs(d), rate * dt); const e = $('#cl-temp'); if (e) e.textContent = st.temp.toFixed(1) + '°'; } return false; } });
  $('#st-climate').insertAdjacentHTML('beforeend', `<span class="cap">${L('اضغط على المكيّف أو التلفزيون في الصورة', 'Tap the AC or the TV in the picture')}</span>`);
  panelClimate();
}
function panelClimate() {
  const st = R.climate.st, a = st.ac, t = st.tv, host = $('#pn-climate'); if (!host) return;
  host.innerHTML = `<div class="ctl"><h3>${icon('ac')} ${L('المكيّف', 'Air conditioner')}</h3>
      <div class="row"><label>${L('التشغيل', 'Power')}</label>${sw(a.on, 'acpow')}<span class="desc">${L('حرارة الغرفة', 'Room')} <b class="num" id="cl-temp">${st.temp.toFixed(1)}°</b></span></div>
      <div class="row"><label>${L('درجة الضبط', 'Set to')}</label><button class="chip" data-a="acset" data-v="-1" aria-label="-">−</button><span class="big num">${a.set}°</span><button class="chip" data-a="acset" data-v="1" aria-label="+">+</button></div>
      <div class="row"><label>${L('الوضع', 'Mode')}</label>${chips([['cool', L('تبريد', 'Cool')], ['heat', L('تدفئة', 'Heat')], ['dry', L('تجفيف', 'Dry')], ['fan', L('مروحة', 'Fan')]], a.mode, 'acmode')}</div>
      <div class="row"><label>${L('المروحة', 'Fan')}</label>${chips([[1, L('هادئة', 'Low')], [2, L('متوسطة', 'Mid')], [3, L('قوية', 'High')]], a.fan, 'acfan')}</div>
      <div class="row"><label>${L('تأرجح الهواء', 'Swing')}</label>${sw(a.swing, 'acswing')}</div></div>
    <div class="ctl"><h3>${icon('tv')} ${L('التلفزيون (الريموت الذكي)', 'TV (smart remote)')}</h3>
      <div class="row"><label>${L('التشغيل', 'Power')}</label>${sw(t.on, 'tvpow')}</div>
      <div class="row"><label>${L('القناة', 'Channel')}</label>${chips(TV_CHANNELS.map((c, i) => [i, LANG === 'ar' ? c.ar : c.en]), t.ch, 'tvch')}</div>
      <div class="row"><label>${L('الصوت', 'Volume')}</label><button class="chip" data-a="tvvol" data-v="-5">−</button><span class="val num">${t.vol}</span><button class="chip" data-a="tvvol" data-v="5">+</button></div></div>
    ${prods('climate').map(p => `<div class="ctl"><h3>${esc(tx(p.name))}</h3><p class="desc">${esc(tx(p.desc))}</p>${specs(p)}</div>`).join('')}`;
}
function clAct(a, v) {
  const r = R.climate, st = r.st; if (!r) return;
  if (a === 'acpow') r.set({ ac: { on: !st.ac.on } }); if (a === 'acset') r.set({ ac: { on: true, set: clamp(st.ac.set + +v, 16, 30) } });
  if (a === 'acmode') r.set({ ac: { on: true, mode: v } }); if (a === 'acfan') r.set({ ac: { fan: +v } }); if (a === 'acswing') r.set({ ac: { swing: !st.ac.swing } });
  if (a === 'tvpow') r.set({ tv: { on: !st.tv.on } }); if (a === 'tvch') r.set({ tv: { on: true, ch: +v } }); if (a === 'tvvol') r.set({ tv: { vol: clamp(st.tv.vol + +v, 0, 100) } });
  keep('climate', r); panelClimate();
}

// ---------- the phone ----------
function mountRemote() {
  R.remote = makeRoom($('#st-remote'), { label: L('الغرفة التي يتحكم بها الهاتف', 'The room controlled by the phone'), state: S.remote.room, onHot: h => rmAct(h === 'curtain' ? 'cur' : h === 'ac' ? 'acpow' : h === 'tv' ? 'tvpow' : 't:' + h) });
  panelRemote();
}
function panelRemote() {
  const st = R.remote.st, host = $('#pn-remote'); if (!host) return;
  const on = ['down', 'spot', 'strip', 'track', 'pendant', 'washer'].filter(f => st[f].on).length;
  const t = (a, ic, n, s, isOn, sw2) => `<div class="t ${isOn ? 'on' : ''}">${icon(ic)}<b>${esc(n)}</b><small>${esc(s)}</small>${sw2 ? sw(isOn, 'rm', a) : ''}</div>`;
  host.innerHTML = `<h4>${L('منزلي', 'My home')}</h4>
    <div class="env"><div><b class="num">${R.climate ? R.climate.st.temp.toFixed(0) : 27}°</b><span>${L('الحرارة', 'Indoor')}</span></div><div><b class="num">${on}</b><span>${L('أضواء تعمل', 'Lights on')}</span></div><div><b>${st.ac.on ? st.ac.set + '°' : L('مطفأ', 'Off')}</b><span>${L('المكيّف', 'AC')}</span></div></div>
    <div class="lbl">${L('المشاهد', 'SCENES')}</div><div class="sc">${Object.entries(SCENES).map(([k, s]) => `<button data-a="rm" data-v="s:${k}">${icon(s.ic)}${esc(s.n[LANG === 'ar' ? 0 : 1])}</button>`).join('')}</div>
    <div class="lbl">${L('الأجهزة', 'DEVICES')}</div><div class="tl">
      ${t('t:down', 'bulb', L('الإضاءة الرئيسية', 'Main lights'), st.down.on ? st.down.bri + '%' : L('مطفأة', 'Off'), st.down.on, true)}
      ${t('t:strip', 'strip', L('الإضاءة المخفية', 'Strip'), st.strip.on ? L('تعمل', 'On') : L('مطفأة', 'Off'), st.strip.on, true)}
      ${t('t:pendant', 'pendant', L('المعلّقة', 'Pendant'), st.pendant.on ? L('تعمل', 'On') : L('مطفأة', 'Off'), st.pendant.on, true)}
      ${t('t:spot', 'spot', L('سبوت اللوحة', 'Art spot'), st.spot.on ? L('يعمل', 'On') : L('مطفأ', 'Off'), st.spot.on, true)}
      ${t('cur', 'curtain', L('الستارة', 'Curtain'), st.curtain > 50 ? L('مغلقة', 'Closed') : L('مفتوحة', 'Open'), st.curtain < 50, true)}
      ${t('tvpow', 'tv', L('التلفزيون', 'TV'), st.tv.on ? (LANG === 'ar' ? TV_CHANNELS[st.tv.ch].ar : TV_CHANNELS[st.tv.ch].en) : L('مطفأ', 'Off'), st.tv.on, true)}</div>
    <div class="card2"><b>${L('سطوع الإضاءة', 'Brightness')}</b><input type="range" min="1" max="100" value="${st.down.bri}" data-i="rmbri" aria-label="${L('السطوع', 'Brightness')}"></div>
    <div class="card2"><b>${L('الستارة', 'Curtain')}</b><input type="range" min="0" max="100" step="5" value="${st.curtain}" data-i="rmcur" aria-label="${L('الستارة', 'Curtain')}"></div>
    <div class="card2"><div class="row" style="justify-content:space-between"><b>${L('المكيّف', 'AC')}</b>${sw(st.ac.on, 'rm', 'acpow')}</div><div class="row" style="justify-content:center"><button class="chip" data-a="rm" data-v="acd">−</button><span class="big num">${st.ac.set}°</span><button class="chip" data-a="rm" data-v="acu">+</button></div></div>
    <div class="card2"><b>${L('القناة', 'Channel')}</b>${chips(TV_CHANNELS.map((c, i) => [i, LANG === 'ar' ? c.ar : c.en]), st.tv.ch, 'rmch')}</div>`;
}
function rmAct(v) {
  const r = R.remote, st = r.st; if (!r) return;
  if (v.startsWith('s:')) runScene(r, v.slice(2));
  else if (v.startsWith('t:')) { const f = v.slice(2); if (st[f]) r.set({ [f]: { on: !st[f].on } }); }
  else if (v === 'cur') r.set({ curtain: st.curtain > 50 ? 0 : 100 });
  else if (v === 'acpow') r.set({ ac: { on: !st.ac.on } });
  else if (v === 'acu' || v === 'acd') r.set({ ac: { on: true, set: clamp(st.ac.set + (v === 'acu' ? 1 : -1), 16, 30) } });
  else if (v === 'tvpow') r.set({ tv: { on: !st.tv.on } });
  keep('remote', r); panelRemote();
}

// ---------- projects gallery ----------
let gal = { id: null, i: 0 };
function openProject(id) { gal = { id, i: 0 }; drawModal(); }
function drawModal() {
  const p = C.projects.find(x => x.id === gal.id), m = $('#modal'); if (!p) return;
  const imgs = (p.images || []).map(safeUrl).filter(Boolean), img = imgs[gal.i % Math.max(1, imgs.length)];
  m.hidden = false; m.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-label="${esc(tx(p.title))}"><button class="x" data-a="mclose" aria-label="${L('إغلاق', 'Close')}">✕</button>
    ${img ? `<div class="gal"><img src="${esc(img)}" alt="">${imgs.length > 1 ? `<button class="pv" data-a="gal" data-v="-1" aria-label="${L('السابقة', 'Previous')}">‹</button><button class="nx" data-a="gal" data-v="1" aria-label="${L('التالية', 'Next')}">›</button>` : ''}</div>` : ''}
    <div class="in"><h3 style="font-size:24px">${esc(tx(p.title))}</h3><span class="desc">${[tx(p.type), tx(p.place), p.year].filter(Boolean).map(esc).join(' · ')}${imgs.length > 1 ? ` · ${gal.i % imgs.length + 1}/${imgs.length}` : ''}</span><p style="margin:6px 0 0">${esc(tx(p.desc))}</p>
    ${tx(p.devices) ? `<p class="desc"><b>${L('الأجهزة المستخدمة', 'Devices used')}:</b> ${esc(tx(p.devices))}</p>` : ''}</div></div>`;
  m.querySelector('.x').focus();
}

// ============================================================================================
//  EVENTS
// ============================================================================================
const ACT = {
  lang: () => { LANG = LANG === 'ar' ? 'en' : 'ar'; try { localStorage.setItem('dh-lang', LANG); } catch (e) { /* ignore */ } const y = scrollY; render(); scrollTo(0, y); },
  theme: () => { THEME = isDark() ? 'light' : 'dark'; try { localStorage.setItem('dh-theme', THEME); } catch (e) { /* ignore */ } applyTheme(THEME); const b = document.querySelector('[data-a=theme]'); if (b) b.innerHTML = icon(isDark() ? 'sun' : 'moon'); },
  lsel: v => selLight(v),
  lpow: () => { const f = lightProd().fixture; R.light.set({ [f]: { on: !R.light.st[f].on } }); keep('light', R.light); panelLight(); },
  lrgb: v => { const f = lightProd().fixture; R.light.set({ [f]: { on: true, rgb: v || null } }); keep('light', R.light); panelLight(); },
  lpre: v => { const f = lightProd().fixture, P = { relax: [35, 2700], read: [85, 4000], focus: [100, 5200], night: [8, 2700] }[v]; R.light.set({ [f]: { on: true, bri: P[0], cct: P[1], rgb: null } }); keep('light', R.light); panelLight(); },
  lday: v => { R.light.set({ time: +v }); keep('light', R.light); panelLight(); },
  lsolo: () => { S.light.solo = !S.light.solo; R.light.set({ solo: S.light.solo ? lightProd().fixture : null }); if (!S.light.solo) runScene(R.light, 'welcome'); keep('light', R.light); panelLight(); },
  mpsel: v => { S.mixpad.sel = v; panelMixpad(); }, mp: v => mpAct(v),
  lksel: v => { S.lock.sel = v; R.lock.set({ face: (lockProd()?.model || 'face') === 'face' }); panelLock(); }, lk: v => lockAct(v),
  cact: v => curAct(v), csheer: () => { R.curtain.set({ sheer: R.curtain.st.sheer > 50 ? 0 : 100 }); keep('curtain', R.curtain); panelCurtain(); }, cauto: v => curAuto(v),
  acpow: () => clAct('acpow'), acset: v => clAct('acset', v), acmode: v => clAct('acmode', v), acfan: v => clAct('acfan', v), acswing: () => clAct('acswing'), tvpow: () => clAct('tvpow'), tvch: v => clAct('tvch', v), tvvol: v => clAct('tvvol', v),
  rm: v => rmAct(v), rmch: v => { R.remote.set({ tv: { on: true, ch: +v } }); keep('remote', R.remote); panelRemote(); },
  proj: v => openProject(v), gal: v => { gal.i += +v + 100; drawModal(); }, mclose: () => { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; },
  criflick: () => { S.cri.flicker = !S.cri.flicker; R.cri.flicker(S.cri.flicker); const b = document.querySelector('[data-a=criflick]'); if (b) { b.classList.toggle('on', S.cri.flicker); b.setAttribute('aria-pressed', S.cri.flicker); } },
  crijump: v => { const from = S.cri.x * 8, to = +v * 8, t0 = performance.now(); const step = n => { const k = Math.min(1, (n - t0) / 600), e = 1 - Math.pow(1 - k, 3); R.cri.split(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); },
  noop: () => { },
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-a]'); if (!t) { if (e.target.id === 'modal') ACT.mclose(); return; }
  ACT[t.dataset.a]?.(t.dataset.v);
});
const INP = {
  lbri: v => { const f = lightProd().fixture; R.light.set({ [f]: { on: true, bri: +v } }); keep('light', R.light); $('#v-lbri').textContent = v + '%'; },
  lcct: v => { const f = lightProd().fixture; R.light.set({ [f]: { on: true, cct: +v, rgb: null } }); keep('light', R.light); $('#v-lcct').textContent = v + 'K'; },
  cpos: v => { R.curtain.set({ curtain: +v }); keep('curtain', R.curtain); $('#v-cpos').textContent = v + '%'; },
  ctime: v => { R.curtain.set({ time: +v }); keep('curtain', R.curtain); $('#v-ctime').textContent = fmtT(+v); },
  crix: v => { R.cri.split(+v * 8); },
  rmbri: v => { R.remote.set({ down: { on: true, bri: +v } }); keep('remote', R.remote); },
  rmcur: v => { R.remote.set({ curtain: +v }); keep('remote', R.remote); },
};
document.addEventListener('input', e => { const i = e.target.dataset?.i; if (i && INP[i]) INP[i](e.target.value); });
document.addEventListener('change', e => { const i = e.target.dataset?.i; if (i === 'rmbri' || i === 'rmcur') panelRemote(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal')?.hidden) ACT.mclose(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { const b = document.querySelector('[data-a=theme]'); if (b && !THEME) b.innerHTML = icon(isDark() ? 'sun' : 'moon'); });

// ---------- start ----------
(async () => {
  sprite();
  C = await loadContent();
  render();
  window.DHWEB = { C, R, S, ACT };
})();
