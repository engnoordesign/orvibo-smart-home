// Digital Home website: renders every section from the managed content and drives the live photo scenes.
// Each demo is a real photo of a room that is relit live; its controls sit right under the photo, and the photo
// stays pinned on screen while the visitor adjusts, so every change is seen as it happens.
import { sprite, icon } from './icons.js';
import { loadContent } from './store.js';
import { UI, DEFAULT_CONTENT } from './content.js';
import { makePhoto, makeCRIPhoto, fixtureHasColour, TV_CHANNELS } from './photo.js';
import { deviceArt, artKey, lockArt } from './devices.js';

let C = null, LANG = 'ar';
try { LANG = localStorage.getItem('dh-lang') || 'ar'; } catch (e) { /* storage blocked */ }
const tx = o => (o && typeof o === 'object') ? (o[LANG] || o[LANG === 'ar' ? 'en' : 'ar'] || '') : (o || '');
const L = (ar, en) => (LANG === 'ar' ? ar : en);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const $ = s => document.querySelector(s);
const safeUrl = u => /^(https?:|data:image\/|\/api\/img\/|blob:|img\/)/i.test(u || '') && !/["'<>\\]/.test(u) ? u : '';
const lines = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);

// ---------- theme ----------
function applyTheme(t) { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
let THEME = null; try { THEME = localStorage.getItem('dh-theme'); } catch (e) { /* ignore */ }
applyTheme(THEME);
const isDark = () => THEME ? THEME === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;

// ---------- demo states (kept when the language changes) ----------
const S = {
  light: { sel: null, solo: true, room: { time: 21, down: { on: true, bri: 80, cct: 3000 }, track: { on: true, bri: 80, cct: 3500 }, pendant: { on: true, bri: 75 }, washer: { on: true, bri: 70 }, strip: { on: true, bri: 70, cct: 2700 }, spot: { on: true, bri: 80 } } },
  mixpad: { sel: null, room: { time: 20.5, track: { on: true, bri: 60, cct: 3000 }, strip: { on: true, bri: 50, cct: 2700 }, pendant: { on: true, bri: 55 } } },
  lock: { sel: null, pin: '', fails: 0, frozen: 0, locked: true, log: [], otp: null, guest: false },
  curtain: { room: { time: 9, curtain: 0 } },
  climate: { room: { time: 19.6, strip: { on: true, bri: 70, cct: 3000 }, washer: { on: true, bri: 70, cct: 2700 }, temp: 29.5 } },
  cri: { x: 50, flicker: false },
  remote: { room: { time: 20.5, down: { on: true, bri: 65, cct: 3000 }, pendant: { on: true, bri: 60 }, washer: { on: true, bri: 50, cct: 2700 } } },
};
const R = {};   // live scenes

// ---------- scenes shared by the MixPad, the phone and the hero ----------
const SCENES = {
  welcome: { ic: 'home', n: ['وصلت البيت', 'Welcome'], s: () => ({ down: { on: true, bri: 70, cct: 3000 }, strip: { on: true, bri: 60, cct: 2700, rgb: null }, pendant: { on: true, bri: 60 }, spot: { on: true, bri: 65 }, track: { on: true, bri: 55, cct: 3000 }, washer: { on: true, bri: 55, rgb: null }, tv: { on: false }, ac: { on: true, mode: 'cool', set: 24, fan: 2 } }) },
  movie: { ic: 'film', n: ['سهرة فيلم', 'Movie'], s: () => ({ down: { on: false }, spot: { on: false }, pendant: { on: false }, track: { on: false }, washer: { on: true, bri: 30, rgb: '#3b5bff' }, strip: { on: true, bri: 28, rgb: '#3b5bff' }, curtain: 100, tv: { on: true, ch: 3 }, ac: { on: true, fan: 1 } }) },
  dinner: { ic: 'plate', n: ['عشاء', 'Dinner'], s: () => ({ down: { on: true, bri: 25, cct: 2700 }, pendant: { on: true, bri: 85 }, spot: { on: true, bri: 55, cct: 2700 }, strip: { on: true, bri: 45, rgb: '#ff9a4a' }, washer: { on: true, bri: 50, rgb: null, cct: 2700 }, track: { on: true, bri: 35, cct: 2700 }, tv: { on: false } }) },
  sleep: { ic: 'moon', n: ['تصبح على خير', 'Good night'], s: () => ({ down: { on: false }, spot: { on: false }, pendant: { on: false }, track: { on: false }, washer: { on: false }, strip: { on: true, bri: 10, rgb: '#ff8a3a' }, curtain: 100, tv: { on: false }, ac: { on: true, set: 25, fan: 1 } }) },
  morning: { ic: 'sun', n: ['صباح الخير', 'Morning'], s: () => ({ curtain: 0, sheer: 0, down: { on: false }, strip: { on: false }, pendant: { on: false }, spot: { on: false }, track: { on: false }, washer: { on: false }, tv: { on: false } }) },
  alloff: { ic: 'power', n: ['إطفاء الكل', 'All off'], s: () => ({ down: { on: false }, spot: { on: false }, pendant: { on: false }, track: { on: false }, washer: { on: false }, strip: { on: false }, tv: { on: false }, ac: { on: false } }) },
};
const runScene = (room, k) => room.set(SCENES[k].s());
const FIXN = { down: ['الإضاءة الرئيسية', 'Main lights'], spot: ['السبوت الموجّه', 'Accent spot'], strip: ['الإضاءة المخفية', 'LED strip'], track: ['سبوتات التراك', 'Track spots'], pendant: ['الإضاءة المعلّقة', 'Pendants'], washer: ['الإضاءة الجانبية', 'Side lights'] };
const fixName = f => L(...FIXN[f]);
const FIX_ICON = { down: 'bulb', spot: 'spot', strip: 'strip', track: 'track', pendant: 'pendant', washer: 'washer' };
const fmtT = t => String(Math.floor(t)).padStart(2, '0') + ':' + String(Math.round((t % 1) * 60) % 60).padStart(2, '0');

// the photo and zones of a scene (the admin's, or the built-in ones)
function sceneOf(id) {
  const d = DEFAULT_CONTENT.scenes[id] || {}, s = (C.scenes && C.scenes[id]) || d;
  return { ...s, img: safeUrl(s.img) || d.img, outside: safeUrl(s.outside) || d.outside, zones: Array.isArray(s.zones) ? s.zones : d.zones || [] };
}

// ---------- page ----------
const NAV = s => tx(UI.nav[s.id]);
const head = b => `<div class="shead"><h2>${esc(tx(b.title))}</h2>${tx(b.sub) ? `<p>${esc(tx(b.sub))}</p>` : ''}</div>`;
const prods = cat => C.products.filter(p => p.cat === cat && p.on !== false);
const thumb = (p, ic) => safeUrl(p.img) ? `<img src="${esc(safeUrl(p.img))}" alt="" loading="lazy">` : artKey(p) ? deviceArt(artKey(p)) : icon(ic || p.icon || 'bulb');
const pcard = (p, act, sel, ic) => `<button class="pc ${sel ? 'on' : ''}" data-a="${act}" data-v="${esc(p.id)}"><span class="thumb">${thumb(p, ic)}</span><b>${esc(tx(p.name))}</b><small>${esc(tx(p.desc))}</small></button>`;
const pview = p => `<div class="pview">${thumb(p)}</div><h3>${esc(tx(p.name))}</h3><p class="desc">${esc(tx(p.desc))}</p>${specs(p)}`;
const specs = p => lines(tx(p.specs)).length ? `<ul class="specs">${lines(tx(p.specs)).map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : '';
const sw = (on, a, v = '', lbl = '') => `<button class="sw ${on ? 'on' : ''}" data-a="${a}" data-v="${v}" aria-pressed="${!!on}" aria-label="${esc(lbl || L('تشغيل أو إيقاف', 'On or off'))}"></button>`;
const chips = (items, cur, a) => `<div class="chips">${items.map(([v, l]) => `<button class="chip ${String(v) === String(cur) ? 'on' : ''}" data-a="${a}" data-v="${v}">${esc(l)}</button>`).join('')}</div>`;
const COLORS = ['#ff3b3b', '#ff9a3a', '#ffd84a', '#3ddc6a', '#33d6ff', '#3a5cff', '#a04aff', '#ff3bb0'];
const demo = (id, key, alt) => `<section class="section ${alt ? 'alt' : ''}" id="${id}"><div class="wrap">${head(C.blocks[id])}<div class="demo"><div class="stagecol"><div class="stage" id="st-${key}"></div><div class="dock" id="dk-${key}"></div></div><div class="panel" id="pn-${key}"></div></div></div></section>`;

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
  lighting: () => demo('lighting', 'light'),
  cri: () => { const c = C.cri, bar = (v, lbl, cls) => `<div class="crib ${cls}"><div class="row" style="justify-content:space-between"><b>${esc(lbl)}</b><span class="num">Ra ${esc(v)}${cls === 'ours' ? '+' : ''}</span></div><div class="track"><i style="width:${clamp(+v || 0, 0, 100)}%"></i></div></div>`;
    return `<section class="section" id="cri"><div class="wrap">${head(C.blocks.cri)}<div class="demo"><div class="stagecol"><div class="stage" id="st-cri"></div>
      <div class="dock"><div class="dk-row"><span class="dk-end">${esc(tx(c.otherLabel))}</span><input type="range" min="0" max="100" value="${S.cri.x}" data-i="crix" class="crislider grow" aria-label="${L('موضع المقارنة', 'Comparison position')}"><span class="dk-end ours">${esc(tx(c.oursLabel))}</span></div>
      <div class="dk-row"><div class="chips"><button class="chip" data-a="crijump" data-v="100">${esc(tx(c.otherLabel))}</button><button class="chip" data-a="crijump" data-v="50">${L('نصف ونصف', 'Half and half')}</button><button class="chip" data-a="crijump" data-v="0">${esc(tx(c.oursLabel))}</button></div>
      <span class="dk-c"><label>${L('كاميرا بطيئة تكشف الوميض', 'Slow-motion camera (flicker)')}</label>${sw(S.cri.flicker, 'criflick')}</span></div></div></div>
      <div class="panel"><h3>${L('مؤشر تجسيد اللون', 'Colour rendering index')}</h3>${bar(c.ours, tx(c.oursLabel), 'ours')}${bar(c.other, tx(c.otherLabel), 'other')}
      <div class="plist">${c.points.map(pt => `<div><b>${esc(tx(pt.title))}</b><p class="desc">${esc(tx(pt.text))}</p></div>`).join('')}</div><p class="note">${esc(tx(c.note))}</p></div></div></div></section>`; },
  mixpad: () => demo('mixpad', 'mixpad', true),
  lock: () => demo('lock', 'lock'),
  curtain: () => demo('curtain', 'curtain', true),
  climate: () => demo('climate', 'climate'),
  remote: () => `<section class="section alt" id="remote"><div class="wrap">${head(C.blocks.remote)}<div class="phoneblk"><div class="phone"><div class="scr app" id="pn-remote"></div></div><div class="stagecol"><div class="stage" id="st-remote"></div><div class="plist" style="margin-top:14px">${prods('remote').map(p => `<div class="card prow"><span class="thumb">${thumb(p, 'phone')}</span><div><h3>${esc(tx(p.name))}</h3><p>${esc(tx(p.desc))}</p>${specs(p)}</div></div>`).join('')}</div></div></div></div></section>`,
  catalog: () => { const ps = prods('other'); return ps.length ? `<section class="section" id="catalog"><div class="wrap">${head(C.blocks.catalog)}<div class="grid3">${ps.map(p => `<article class="prod"><div class="ph">${thumb(p, 'box')}</div><div class="in"><h3>${esc(tx(p.name))}</h3><p class="desc">${esc(tx(p.desc))}</p>${specs(p)}</div></article>`).join('')}</div></div></section>` : ''; },
  projects: () => { const ps = C.projects.filter(p => p.on !== false); return `<section class="section alt" id="projects"><div class="wrap">${head(C.blocks.projects)}${ps.length ? `<div class="grid3">${ps.map(p => `<button class="prod proj" data-a="proj" data-v="${esc(p.id)}"><div class="ph">${safeUrl(p.images?.[0]) ? `<img src="${esc(safeUrl(p.images[0]))}" alt="" loading="lazy">` : icon('home')}${p.sample ? `<span class="tag">${L('مثال توضيحي', 'Example')}</span>` : ''}</div><div class="in"><h3>${esc(tx(p.title))}</h3><span class="meta">${[tx(p.type), tx(p.place), p.year].filter(Boolean).map(esc).join(' · ')}</span><p class="desc">${esc(tx(p.desc)).slice(0, 150)}${tx(p.desc).length > 150 ? '…' : ''}</p></div></button>`).join('')}</div>` : `<div class="empty">${L('قريباً: صور من المشاريع التي نفّذناها.', 'Coming soon: photos from the projects we have delivered.')}</div>`}</div></section>`; },
  contact: () => { const b = C.brand, items = [['phone', L('الهاتف', 'Phone'), b.phone], ['chat', 'WhatsApp', b.whatsapp], ['mail', L('البريد', 'Email'), b.email], ['pin', L('العنوان', 'Address'), tx(b.address)], ['clock', L('ساعات العمل', 'Opening hours'), tx(b.hours)], ['globe', 'Instagram', b.instagram], ['globe', 'Facebook', b.facebook]].filter(i => i[2]);
    return `<section class="section" id="contact"><div class="wrap">${head(C.blocks.contact)}${items.length ? `<div class="contact">${items.map(([ic, l, v]) => `<div class="card">${icon(ic)}<small>${esc(l)}</small><b>${esc(v)}</b></div>`).join('')}</div>` : `<div class="empty">${esc(C.brand.name)} — ${esc(tx(C.brand.tagline))}</div>`}</div></section>`; },
};

function render() {
  document.documentElement.lang = LANG; document.documentElement.dir = LANG === 'ar' ? 'rtl' : 'ltr';
  document.title = `${C.brand.name} · ${tx(C.brand.tagline)}`;
  if (C.brand.accent) document.documentElement.style.setProperty('--accent', C.brand.accent); else document.documentElement.style.removeProperty('--accent');
  const on = C.sections.filter(s => s.on && SECTIONS[s.id]);
  $('#app').innerHTML = `
  <header class="top"><div class="wrap"><a class="logo" href="#home"><b>${esc(C.brand.name)}</b><small>${esc(tx(C.brand.tagline))}</small></a>
    <nav>${on.filter(s => s.id !== 'catalog' || prods('other').length).map(s => `<a href="#${s.id}">${esc(NAV(s))}</a>`).join('')}</nav>
    <button class="tbtn" data-a="lang">${icon('globe')}${LANG === 'ar' ? 'English' : 'العربية'}</button>
    <button class="tbtn" data-a="theme" aria-label="${L('الوضع الليلي أو النهاري', 'Dark or light mode')}">${icon(isDark() ? 'sun' : 'moon')}</button></div></header>
  <main id="home">
    <div class="wrap"><div class="hero"><div><div class="kicker">${esc(tx(C.hero.kicker))}</div><h1>${esc(tx(C.hero.title))}</h1><p>${esc(tx(C.hero.text))}</p>
      <div class="ctas"><a class="btn pri" href="#lighting">${esc(tx(C.hero.cta))}</a><a class="btn" href="#contact">${esc(tx(C.hero.cta2))}</a>${safeUrl(C.brand.simulatorUrl) ? `<a class="btn" href="${esc(safeUrl(C.brand.simulatorUrl))}" target="_blank" rel="noopener">${L('جولة ثلاثية الأبعاد', '3D walkthrough')}</a>` : ''}</div></div>
      <div class="stage" id="st-hero"></div></div></div>
    ${on.map(s => SECTIONS[s.id]()).join('')}
  </main>
  <footer><div class="wrap"><span>© ${new Date().getFullYear()} ${esc(C.brand.name)} — ${esc(tx(C.brand.tagline))}</span><a href="admin.html">${L('لوحة الإدارة', 'Admin')}</a></div></footer>
  <div id="modal" class="modal" hidden></div>`;
  mountAll();
}
const cap = (host, text, live) => host.insertAdjacentHTML('beforeend', `<span class="cap">${esc(text)}</span>${live ? `<span class="live">● ${L('مباشر', 'Live')}</span>` : ''}`);

// ============================================================================================
//  DEMOS
// ============================================================================================
let heroTimer = 0;
function mountAll() {
  for (const k in R) delete R[k];
  const hero = $('#st-hero');
  if (hero) {
    R.hero = makePhoto(hero, { scene: sceneOf('hero'), label: L('غرفة معيشة ذكية', 'Smart living room'), state: { time: 20.5 } });
    cap(hero, '', true); const capEl = hero.querySelector('.cap');
    const seq = ['welcome', 'dinner', 'movie', 'sleep', 'morning'], times = { morning: 10, welcome: 20.5, dinner: 20.5, movie: 21.5, sleep: 23 }; let i = 0;
    const step = () => { const k = seq[i++ % seq.length]; runScene(R.hero, k); R.hero.set({ time: times[k] }); capEl.textContent = L('مشهد: ', 'Scene: ') + SCENES[k].n[LANG === 'ar' ? 0 : 1]; };
    clearInterval(heroTimer); step(); heroTimer = setInterval(step, 4200);
  }
  if ($('#st-light')) mountLight();
  if ($('#st-cri')) {
    R.cri = makeCRIPhoto($('#st-cri'), { img: sceneOf('cri').img, onSplit: x => { S.cri.x = Math.round(x); const r = $('.crislider'); if (r && document.activeElement !== r) r.value = S.cri.x; } });
    R.cri.labels(`${tx(C.cri.otherLabel)} · Ra ${C.cri.other}`, `${tx(C.cri.oursLabel)} · Ra ${C.cri.ours}+`); R.cri.split(S.cri.x); R.cri.flicker(S.cri.flicker);
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
  R.light = makePhoto($('#st-light'), { scene: sceneOf('lighting'), label: L('مشهد الإضاءة', 'Lighting scene'), state: { ...S.light.room, solo: S.light.solo ? p?.fixture : null },
    onHot: f => { const q = prods('lighting').find(x => x.fixture === f); if (q) selLight(q.id); } });
  cap($('#st-light'), L('اضغط على أي مصباح في الصورة', 'Tap any light in the photo'));
  dockLight(); panelLight();
}
function selLight(id) { const p = prods('lighting').find(x => x.id === id); if (!p) return; S.light.sel = id; const f = p.fixture; R.light.set({ [f]: { on: true }, solo: S.light.solo ? f : null }); keep('light', R.light); dockLight(); panelLight(); }
function dockLight() {
  const p = lightProd(), host = $('#dk-light'); if (!host) return;
  if (!p) { host.innerHTML = `<p class="desc">${L('أضف منتجات إضاءة من لوحة الإدارة.', 'Add lighting products in the admin panel.')}</p>`; return; }
  const f = p.fixture, Lt = R.light.st[f], rgb = fixtureHasColour(f), inPhoto = R.light.hasFixture(f);
  host.innerHTML = `<div class="dk-prods" role="list">${prods('lighting').map(x => `<button role="listitem" class="dkp ${x.id === p.id ? 'on' : ''}" data-a="lsel" data-v="${esc(x.id)}"><span class="thumb">${thumb(x, FIX_ICON[x.fixture])}</span><span>${esc(tx(x.name))}</span></button>`).join('')}</div>
    ${inPhoto ? '' : `<p class="note">${L('هذا النوع غير موضوع في الصورة بعد — حدّد مكانه من لوحة الإدارة.', 'This light is not placed in the photo yet — place it in the admin panel.')}</p>`}
    <div class="dk-row"><span class="dk-c"><label>${L('التشغيل', 'Power')}</label>${sw(Lt.on, 'lpow')}</span>
      <span class="dk-c grow"><label>${L('السطوع', 'Brightness')} <b class="num" id="v-lbri">${Lt.bri}%</b></label><input type="range" min="1" max="100" value="${Lt.bri}" data-i="lbri" aria-label="${L('السطوع', 'Brightness')}"></span>
      <span class="dk-c grow"><label>${L('لون الأبيض', 'White tone')} <b class="num" id="v-lcct">${Lt.cct}K</b></label><input type="range" class="cct" min="2700" max="6500" step="100" value="${Lt.cct}" data-i="lcct" aria-label="${L('حرارة اللون', 'Colour temperature')}"></span></div>
    <div class="dk-row">${rgb ? `<span class="dk-c"><label>${L('اللون', 'Colour')}</label><span class="chips">${COLORS.map(c => `<button class="swatch ${Lt.rgb === c ? 'on' : ''}" style="background:${c}" data-a="lrgb" data-v="${c}" aria-label="${c}"></button>`).join('')}<button class="swatch ${!Lt.rgb ? 'on' : ''}" style="background:linear-gradient(90deg,#ffb46b,#fff,#cfe2ff)" data-a="lrgb" data-v="" aria-label="${L('أبيض', 'White')}"></button></span></span>` : ''}
      <span class="dk-c"><label>${L('وقت اليوم', 'Time of day')}</label>${chips([[13, L('نهار', 'Day')], [18.4, L('غروب', 'Sunset')], [21, L('ليل', 'Night')]], R.light.st.time, 'lday')}</span>
      <span class="dk-c"><label>${L('هذا المصباح وحده', 'This light alone')}</label>${sw(S.light.solo, 'lsolo')}</span></div>`;
}
function panelLight() {
  const p = lightProd(), host = $('#pn-light'); if (!host || !p) { if (host) host.innerHTML = ''; return; }
  host.innerHTML = `${pview(p)}<div class="row"><label>${L('أجواء جاهزة', 'Presets')}</label>${chips([['relax', L('استرخاء', 'Relax')], ['read', L('قراءة', 'Reading')], ['focus', L('تركيز', 'Focus')], ['night', L('ليلي', 'Night light')]], '', 'lpre')}</div>`;
}

// ---------- MixPad ----------
function mpProd() { const ps = prods('mixpad'); return ps.find(p => p.id === S.mixpad.sel) || ps[0]; }
function mountMixpad() {
  const p = mpProd(); if (p) S.mixpad.sel = p.id;
  R.mixpad = makePhoto($('#st-mixpad'), { scene: sceneOf('mixpad'), label: L('الغرفة التي تتحكم بها اللوحة', 'The room the panel controls'), state: S.mixpad.room, guest: () => S.lock.guest,
    onHot: h => mpAct(h === 'curtain' ? 'cur' : h === 'ac' ? 'ac' : h === 'tv' ? 'tv' : h === 'panel' ? 's:welcome' : 'l:' + h) });
  cap($('#st-mixpad'), L('الغرفة تستجيب لما تضغطه على اللوحة', 'The room follows what you tap on the panel'));
  dockMixpad(); panelMixpad();
}
function mpScreen() {
  const r = R.mixpad, st = r.st, model = mpProd()?.model || 'x', tile = (a, ic, name, sub, on) => `<button class="mpt ${on ? 'on' : ''}" data-a="mp" data-v="${a}">${icon(ic)}<span>${esc(name)}</span><small>${esc(sub)}</small></button>`;
  const sc = ['welcome', 'movie', 'sleep', 'alloff'].map(k => tile('s:' + k, SCENES[k].ic, SCENES[k].n[LANG === 'ar' ? 0 : 1], L('مشهد', 'Scene'), false));
  const cur = r.has('window') ? tile('cur', 'curtain', L('الستارة', 'Curtain'), st.curtain > 50 ? L('مغلقة', 'Closed') : L('مفتوحة', 'Open'), st.curtain < 50) : null;
  const dev = [...r.fixtures().map(f => tile('l:' + f, FIX_ICON[f], fixName(f), st[f].on ? st[f].bri + '%' : L('مطفأ', 'Off'), st[f].on)), cur,
    r.has('tv') ? tile('tv', 'tv', L('التلفزيون', 'TV'), st.tv.on ? (LANG === 'ar' ? TV_CHANNELS[st.tv.ch].ar : TV_CHANNELS[st.tv.ch].en) : L('مطفأ', 'Off'), st.tv.on) : null,
    r.has('tv') && st.tv.on ? tile('ch', 'film', L('القناة التالية', 'Next channel'), '', false) : null].filter(Boolean);
  const tiles = model === 'mini' ? [sc[0], sc[2], ...dev].slice(0, 4) : model === '7' ? [...sc, ...dev].slice(0, 8) : [...sc, ...dev].slice(0, 12);
  return `<div class="device m-${esc(model)}"><div class="glass"><div class="mpscreen"><div class="mphead"><b class="num">${fmtT(st.time)}</b><span>${L('غرفة النوم', 'Bedroom')} · ${st.temp.toFixed(0)}°</span></div><div class="mpgrid">${tiles.join('')}</div></div></div></div>`;
}
function dockMixpad() {
  const host = $('#dk-mixpad'); if (!host) return;
  host.innerHTML = `<div class="mpdock"><div id="mpdev">${mpScreen()}</div><div class="ctl"><b>${L('اختر اللوحة', 'Choose the panel')}</b><div class="chips">${prods('mixpad').map(x => `<button class="chip ${x.id === mpProd()?.id ? 'on' : ''}" data-a="mpsel" data-v="${esc(x.id)}">${esc(tx(x.name))}</button>`).join('')}</div>
    <p class="desc">${L('اضغط على الشاشة أو على أي جهاز في الصورة.', 'Tap the screen, or any device in the photo.')}</p></div></div>`;
  wallPanel();
}
function wallPanel() { const st = R.mixpad?.st; if (!st) return; R.mixpad.panel(`<div class="wallmp"><b>${fmtT(st.time)}</b><span>${['down', 'track', 'pendant', 'strip'].map(f => `<i class="${st[f].on ? 'on' : ''}"></i>`).join('')}</span></div>`); }
function panelMixpad() {
  const p = mpProd(), host = $('#pn-mixpad'); if (!host) return;
  host.innerHTML = `${p ? pview(p) : ''}<div class="plist">${prods('mixpad').map(x => pcard(x, 'mpsel', x.id === p?.id, 'panel')).join('')}</div>`;
}
function mpAct(v) {
  const r = R.mixpad, st = r.st;
  if (v.startsWith('s:')) runScene(r, v.slice(2));
  else if (v.startsWith('l:')) { const f = v.slice(2); if (st[f]) r.set({ [f]: { on: !st[f].on } }); }
  else if (v === 'cur') r.set({ curtain: st.curtain > 50 ? 0 : 100 });
  else if (v === 'tv') r.set({ tv: { on: !st.tv.on } });
  else if (v === 'ch') r.set({ tv: { on: true, ch: (st.tv.ch + 1) % TV_CHANNELS.length } });
  keep('mixpad', r); const d = $('#mpdev'); if (d) d.innerHTML = mpScreen(); wallPanel();
}

// ---------- the smart lock ----------
const PIN = '2580';
function lockProd() { const ps = prods('lock'); return ps.find(p => p.id === S.lock.sel) || ps[0]; }
const lockModel = () => (lockProd()?.model === 'finger' ? 'finger' : 'face');
function mountLock() {
  const p = lockProd(); if (p) S.lock.sel = p.id;
  R.lock = makePhoto($('#st-lock'), { scene: { ...sceneOf('lock'), flat: true }, label: L('باب المدخل مع القفل الذكي', 'Front door with the smart lock'), lockArt: () => lockArt(lockModel()) });
  R.lock.ready.then(() => { intercom(); R.lock.door(!S.lock.locked); });
  cap($('#st-lock'), L('باب المدخل', 'Front door'));
  dockLock(); panelLock();
}
function intercom() {
  if (!R.lock) return; const out = sceneOf('lock').outside;
  R.lock.panel(S.lock.guest ? `<div class="icam" style="background-image:url('${esc(out)}')"><i class="who"></i><em>●</em></div>` : `<div class="wallmp"><b>${fmtT(new Date().getHours() + new Date().getMinutes() / 60)}</b><span>${S.lock.locked ? '🔒' : '🔓'}</span></div>`);
}
const lockFx = (cls, ms = 1200) => { const el = R.lock?.lock(); if (!el) return; el.classList.add(cls); clearTimeout(el['t' + cls]); el['t' + cls] = setTimeout(() => el.classList.remove(cls), ms); };
const now = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
function lockLog(ar, en) { S.lock.log.unshift({ t: now(), ar, en }); S.lock.log = S.lock.log.slice(0, 12); }
function dockLock() {
  const s = S.lock, host = $('#dk-lock'); if (!host) return; const face = lockModel() === 'face';
  host.innerHTML = `<div class="lockdock"><div class="lockpad">${face ? '<span class="camdot" title="3D face camera"></span>' : ''}<div class="pinview num" aria-live="polite">${'●'.repeat(s.pin.length) || '&nbsp;'}</div>
      <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, '✓'].map(k => `<button data-a="lk" data-v="${k === '⌫' ? 'del' : k === '✓' ? 'ok' : k}" aria-label="${k}">${k}</button>`).join('')}</div>
      <button class="fp" data-a="lk" data-v="fp" aria-label="${L('البصمة', 'Fingerprint')}">${icon('fp')}</button></div>
    <div class="ctl"><div class="chips"><button class="chip" data-a="lk" data-v="fp">${L('بصمة مسجّلة', 'Registered finger')}</button>${face ? `<button class="chip" data-a="lk" data-v="face">${L('الوجه', 'Face')}</button>` : ''}<button class="chip" data-a="lk" data-v="card">${L('البطاقة', 'Card')}</button><button class="chip" data-a="lk" data-v="bad">${L('بصمة غريبة', 'Unknown finger')}</button></div>
      <div class="chips"><button class="chip" data-a="lk" data-v="bell">${icon('bell')} ${L('زائر يرن الجرس', 'Visitor rings')}</button><button class="chip" data-a="lk" data-v="remote">${icon('phone')} ${L('افتح من الهاتف', 'Open from phone')}</button><button class="chip" data-a="lk" data-v="otp">${icon('key')} ${L('رمز لمرة واحدة', 'One-time code')}</button><button class="chip" data-a="lk" data-v="lock">${icon('lock')} ${L('اقفل الآن', 'Lock now')}</button></div>
      <p class="desc">${L('الرمز التجريبي', 'Demo code')}: <b class="num">${PIN}</b>${s.otp ? ` · ${L('رمز الزائر', 'Visitor code')}: <b class="num">${s.otp}</b>` : ''}</p></div></div>`;
}
function panelLock() {
  const p = lockProd(), s = S.lock, host = $('#pn-lock'); if (!host) return;
  const status = s.frozen > Date.now() ? [L('مجمّد بعد محاولات خاطئة', 'Frozen after wrong tries'), 'var(--bad)'] : s.locked ? [L('مقفل', 'Locked'), 'var(--ok)'] : [L('مفتوح', 'Unlocked'), 'var(--info)'];
  host.innerHTML = `<div class="row"><b>${L('الحالة', 'Status')}:</b> <span class="chip" style="color:${status[1]}">${status[0]}</span><span class="desc">${L('خمس محاولات خاطئة تُطلق الإنذار.', 'Five wrong tries raise the alarm.')}</span></div>
    <div class="log">${s.log.map(l => `<div><i>${l.t}</i>${esc(LANG === 'ar' ? l.ar : l.en)}</div>`).join('') || `<div>${L('سجل الدخول يظهر هنا.', 'The entry history appears here.')}</div>`}</div>
    ${p ? pview(p) : ''}<div class="plist">${prods('lock').map(x => pcard(x, 'lksel', x.id === p?.id, 'lock')).join('')}</div>`;
}
let doorTimer = 0;
function unlock(ar, en) {
  const s = S.lock, d = R.lock; s.locked = false; s.fails = 0; d.el.classList.remove('alarm'); lockFx('ok', 2400); lockFx('awake', 2400); d.door(true); lockLog(`فُتح الباب: ${ar}`, `Door opened: ${en}`); intercom();
  clearTimeout(doorTimer); doorTimer = setTimeout(() => { d.door(false); setTimeout(() => { s.locked = true; lockLog('أُقفل الباب تلقائياً', 'Door locked automatically'); if (s.guest) { s.guest = false; d.guest(false); } intercom(); panelLock(); panelRemote(); }, 1300); }, 4600);
}
function fail(ar, en) {
  const s = S.lock, d = R.lock; s.fails++; lockFx('bad', 1400); d.flash('#ff3b3b', 0.8); lockLog(`محاولة خاطئة (${ar}) ${s.fails}/5`, `Wrong attempt (${en}) ${s.fails}/5`);
  if (s.fails >= 5) { s.fails = 0; s.frozen = Date.now() + 15000; d.el.classList.add('alarm'); lockLog('إنذار عبث! أُرسل تنبيه للهاتف', 'Tamper alarm! Phone alerted'); setTimeout(() => { d.el.classList.remove('alarm'); panelLock(); }, 15000); }
}
function lockAct(v) {
  const s = S.lock, d = R.lock; if (!d) return;
  if (s.frozen > Date.now() && !['bell', 'lock'].includes(v)) { lockFx('bad', 900); d.flash('#ff3b3b', 0.5); return panelLock(); }
  if (/^\d$/.test(v)) { if (s.pin.length < 8) s.pin += v; lockFx('awake', 5000); }
  if (v === 'del') s.pin = s.pin.slice(0, -1);
  if (v === 'ok') { const ok = s.pin === PIN || (s.otp && s.pin === s.otp); if (ok) { unlock(s.pin === PIN ? 'الرمز' : 'رمز الزائر', s.pin === PIN ? 'code' : 'visitor code'); if (s.pin === s.otp) s.otp = null; } else fail('رمز', 'code'); s.pin = ''; }
  if (v === 'fp') { lockFx('scan', 800); setTimeout(() => { unlock('البصمة', 'fingerprint'); dockLock(); panelLock(); panelRemote(); }, 800); }
  if (v === 'face') { lockFx('face', 1300); lockFx('awake', 1300); setTimeout(() => { unlock('الوجه', 'face'); dockLock(); panelLock(); panelRemote(); }, 1200); }
  if (v === 'card') unlock('البطاقة', 'card');
  if (v === 'bad') { lockFx('scan', 650); setTimeout(() => { fail('بصمة', 'finger'); panelLock(); }, 650); }
  if (v === 'bell') { s.guest = true; d.guest(true); intercom(); lockLog('زائر عند الباب — ظهرت صورته على الشاشة والهاتف', 'Visitor at the door — shown on the screen and the phone'); R.mixpad?.refresh(); }
  if (v === 'remote') unlock('من الهاتف', 'from the phone');
  if (v === 'otp') { s.otp = String(100000 + Math.floor(Math.random() * 900000)); lockLog('أُنشئ رمز زائر لمرة واحدة', 'One-time visitor code created'); }
  if (v === 'lock') { clearTimeout(doorTimer); d.door(false); s.locked = true; lockLog('أُقفل من الهاتف', 'Locked from the phone'); intercom(); }
  dockLock(); panelLock(); panelRemote();
}

// ---------- curtains ----------
function mountCurtain() {
  R.curtain = makePhoto($('#st-curtain'), { scene: sceneOf('curtain'), label: L('الستارة الذكية', 'Smart curtain'), state: S.curtain.room,
    onHot: h => { if (h === 'curtain') curAct(R.curtain.st.curtain > 50 ? 'open' : 'close'); else if (R.curtain.st[h]) { R.curtain.set({ [h]: { on: !R.curtain.st[h].on } }); keep('curtain', R.curtain); } } });
  cap($('#st-curtain'), L('اضغط على الستارة لفتحها أو إغلاقها', 'Tap the curtain to open or close it'));
  dockCurtain(); panelCurtain();
}
function dockCurtain() {
  const st = R.curtain.st, host = $('#dk-curtain'); if (!host) return; const sheer = R.curtain.zones.some(z => z.t === 'window' && z.sheer);
  host.innerHTML = `<div class="dk-row"><span class="dk-c grow"><label>${L('نسبة الإغلاق', 'Closed')} <b class="num" id="v-cpos">${st.curtain}%</b></label><input type="range" min="0" max="100" step="5" value="${st.curtain}" data-i="cpos" aria-label="${L('نسبة الإغلاق', 'Closed')}"></span>
      ${chips([['open', L('فتح', 'Open')], ['half', L('نصف', 'Half')], ['stop', L('إيقاف', 'Stop')], ['close', L('إغلاق', 'Close')]], '', 'cact')}</div>
    <div class="dk-row"><span class="dk-c grow"><label>${L('الوقت', 'Time')} <b class="num" id="v-ctime">${fmtT(st.time)}</b></label><input type="range" min="5" max="23.5" step="0.25" value="${st.time}" data-i="ctime" aria-label="${L('الوقت', 'Time')}"></span>
      ${sheer ? `<span class="dk-c"><label>${L('الستارة الشفافة', 'Sheer layer')}</label>${sw(st.sheer > 50, 'csheer')}</span>` : ''}
      <span class="dk-c"><label>${L('الإضاءة', 'Lights')}</label>${sw(R.curtain.fixtures().some(f => st[f].on), 'clights')}</span></div>`;
}
function panelCurtain() {
  const host = $('#pn-curtain'), p = prods('curtain')[0]; if (!host) return;
  host.innerHTML = `<div class="ctl"><b>${L('أتمتة', 'Automation')}</b>${chips([['sunrise', L('تُفتح مع الشروق', 'Open at sunrise')], ['sunset', L('تُغلق مع الغروب', 'Close at sunset')]], '', 'cauto')}<p class="desc">${L('شاهد الشمس تتحرك والستارة تتبعها في الصورة.', 'Watch the sun move and the curtain follow it in the photo.')}</p></div>
    ${p ? pview(p) : ''}${prods('curtain').length > 1 ? `<div class="plist">${prods('curtain').map(x => pcard(x, 'noop', false, 'curtain')).join('')}</div>` : ''}`;
}
function curAct(v) {
  const r = R.curtain; if (!r) return;
  if (v === 'open') r.set({ curtain: 0 }); if (v === 'close') r.set({ curtain: 100 }); if (v === 'half') r.set({ curtain: 50 });
  if (v === 'stop') r.set({ curtain: Math.round(r.pos()) });
  keep('curtain', r); dockCurtain(); panelRemote();
}
let sunAnim = 0;
function curAuto(v) {
  const r = R.curtain, from = r.st.time, to = v === 'sunrise' ? 6.8 : 18.6; cancelAnimationFrame(sunAnim); const t0 = performance.now();
  const step = n => { const k = Math.min(1, (n - t0) / 1800); r.set({ time: from + (to - from) * k }); const vv = $('#v-ctime'); if (vv) vv.textContent = fmtT(r.st.time); if (k < 1) sunAnim = requestAnimationFrame(step); else { r.set({ curtain: v === 'sunrise' ? 0 : 100 }); if (v === 'sunset') r.fixtures().forEach(f => r.set({ [f]: { on: true } })); keep('curtain', r); dockCurtain(); } };
  sunAnim = requestAnimationFrame(step);
}

// ---------- climate ----------
function mountClimate() {
  R.climate = makePhoto($('#st-climate'), { scene: sceneOf('climate'), label: L('المكيّف', 'Air conditioner'), state: S.climate.room, alwaysTick: true,
    onHot: h => { if (h === 'ac') clAct('acpow'); else if (h === 'curtain') { R.climate.set({ curtain: R.climate.st.curtain > 50 ? 0 : 100 }); keep('climate', R.climate); } else if (R.climate.st[h]) { R.climate.set({ [h]: { on: !R.climate.st[h].on } }); keep('climate', R.climate); } },
    onTick: (dt, st) => { const tgt = st.ac.on && st.ac.mode !== 'fan' ? st.ac.set : 30.5, rate = st.ac.on ? (st.ac.mode === 'fan' ? 0 : 0.12 + st.ac.fan * 0.08) : 0.04; const d = tgt - st.temp;
      if (rate && Math.abs(d) > 0.02) { st.temp += Math.sign(d) * Math.min(Math.abs(d), rate * dt); const e = $('#cl-temp'); if (e) e.textContent = st.temp.toFixed(1) + '°'; const o = $('#cl-ov'); if (o) o.textContent = st.temp.toFixed(1) + '°'; } return false; } });
  $('#st-climate').insertAdjacentHTML('beforeend', `<span class="cap">${L('اضغط على المكيّف في الصورة', 'Tap the AC in the photo')}</span><span class="live therm">${icon('thermo')} <b class="num" id="cl-ov">${R.climate.st.temp.toFixed(1)}°</b></span>`);
  dockClimate(); panelClimate();
}
function dockClimate() {
  const st = R.climate.st, a = st.ac, host = $('#dk-climate'); if (!host) return;
  host.innerHTML = `<div class="dk-row"><span class="dk-c"><label>${L('التشغيل', 'Power')}</label>${sw(a.on, 'acpow')}</span>
      <span class="dk-c"><label>${L('درجة الضبط', 'Set to')}</label><span class="row"><button class="chip" data-a="acset" data-v="-1" aria-label="-">−</button><span class="big num">${a.set}°</span><button class="chip" data-a="acset" data-v="1" aria-label="+">+</button></span></span>
      <span class="dk-c"><label>${L('حرارة الغرفة', 'Room now')}</label><b class="big num" id="cl-temp">${st.temp.toFixed(1)}°</b></span></div>
    <div class="dk-row"><span class="dk-c"><label>${L('الوضع', 'Mode')}</label>${chips([['cool', L('تبريد', 'Cool')], ['heat', L('تدفئة', 'Heat')], ['dry', L('تجفيف', 'Dry')], ['fan', L('مروحة', 'Fan')]], a.mode, 'acmode')}</span>
      <span class="dk-c"><label>${L('المروحة', 'Fan')}</label>${chips([[1, L('هادئة', 'Low')], [2, L('متوسطة', 'Mid')], [3, L('قوية', 'High')]], a.fan, 'acfan')}</span>
      <span class="dk-c"><label>${L('تأرجح الهواء', 'Swing')}</label>${sw(a.swing, 'acswing')}</span></div>`;
}
function panelClimate() {
  const host = $('#pn-climate'); if (!host) return;
  host.innerHTML = prods('climate').map(p => `<div class="ctl prow"><span class="thumb">${thumb(p, 'ac')}</span><div><h3>${esc(tx(p.name))}</h3><p class="desc">${esc(tx(p.desc))}</p>${specs(p)}</div></div>`).join('');
}
function clAct(a, v) {
  const r = R.climate; if (!r) return; const st = r.st;
  if (a === 'acpow') r.set({ ac: { on: !st.ac.on } }); if (a === 'acset') r.set({ ac: { on: true, set: clamp(st.ac.set + +v, 16, 30) } });
  if (a === 'acmode') r.set({ ac: { on: true, mode: v } }); if (a === 'acfan') r.set({ ac: { fan: +v } }); if (a === 'acswing') r.set({ ac: { swing: !st.ac.swing } });
  keep('climate', r); dockClimate(); panelRemote();
}

// ---------- the phone: this living room, plus the other rooms on the page ----------
function mountRemote() {
  R.remote = makePhoto($('#st-remote'), { scene: sceneOf('remote'), label: L('الغرفة التي يتحكم بها الهاتف', 'The room controlled by the phone'), state: S.remote.room, onHot: h => rmAct(h === 'curtain' ? 'cur' : 't:' + h) });
  cap($('#st-remote'), L('الصالة', 'Living room'));
  panelRemote();
}
function panelRemote() {
  const r = R.remote, host = $('#pn-remote'); if (!host || !r) return; const st = r.st, fx = r.fixtures();
  const on = fx.filter(f => st[f].on).length;
  const t = (a, ic, n, s, isOn) => `<div class="t ${isOn ? 'on' : ''}">${icon(ic)}<b>${esc(n)}</b><small>${esc(s)}</small>${sw(isOn, 'rm', a, n)}</div>`;
  const other = [
    R.lock ? t('door', 'lock', L('باب المدخل', 'Front door'), S.lock.locked ? L('مقفل', 'Locked') : L('مفتوح', 'Open'), !S.lock.locked) : '',
    R.climate ? t('bac', 'ac', L('مكيّف غرفة النوم', 'Bedroom AC'), R.climate.st.ac.on ? R.climate.st.ac.set + '°' : L('مطفأ', 'Off'), R.climate.st.ac.on) : '',
    R.mixpad && R.mixpad.has('tv') ? t('btv', 'tv', L('تلفزيون غرفة النوم', 'Bedroom TV'), R.mixpad.st.tv.on ? L('يعمل', 'On') : L('مطفأ', 'Off'), R.mixpad.st.tv.on) : '',
    R.curtain ? t('bcur', 'curtain', L('ستارة غرفة الضيوف', 'Guest room curtain'), R.curtain.st.curtain > 50 ? L('مغلقة', 'Closed') : L('مفتوحة', 'Open'), R.curtain.st.curtain < 50) : '',
  ].join('');
  host.innerHTML = `<h4>${L('منزلي', 'My home')}</h4>
    <div class="env"><div><b class="num">${R.climate ? R.climate.st.temp.toFixed(0) : 27}°</b><span>${L('غرفة النوم', 'Bedroom')}</span></div><div><b class="num">${on}</b><span>${L('أضواء تعمل', 'Lights on')}</span></div><div><b>${S.lock.locked ? L('مقفل', 'Locked') : L('مفتوح', 'Open')}</b><span>${L('الباب', 'Door')}</span></div></div>
    ${S.lock.guest ? `<div class="card2 bell">${icon('bell')} <b>${L('زائر عند الباب', 'Visitor at the door')}</b> <button class="chip" data-a="rm" data-v="door">${L('افتح', 'Open')}</button></div>` : ''}
    <div class="lbl">${L('المشاهد', 'SCENES')}</div><div class="sc">${Object.entries(SCENES).map(([k, s]) => `<button data-a="rm" data-v="s:${k}">${icon(s.ic)}${esc(s.n[LANG === 'ar' ? 0 : 1])}</button>`).join('')}</div>
    <div class="lbl">${L('الصالة', 'LIVING ROOM')}</div><div class="tl">
      ${fx.map(f => t('t:' + f, FIX_ICON[f], fixName(f), st[f].on ? st[f].bri + '%' : L('مطفأة', 'Off'), st[f].on)).join('')}
      ${r.has('window') ? t('cur', 'curtain', L('الستارة', 'Blind'), st.curtain > 50 ? L('مغلقة', 'Closed') : L('مفتوحة', 'Open'), st.curtain < 50) : ''}</div>
    ${fx.length ? `<div class="card2"><b>${L('سطوع الإضاءة', 'Brightness')}</b><input type="range" min="1" max="100" value="${st[fx[0]].bri}" data-i="rmbri" aria-label="${L('السطوع', 'Brightness')}"></div>` : ''}
    ${r.has('window') ? `<div class="card2"><b>${L('الستارة', 'Blind')}</b><input type="range" min="0" max="100" step="5" value="${st.curtain}" data-i="rmcur" aria-label="${L('الستارة', 'Blind')}"></div>` : ''}
    ${other ? `<div class="lbl">${L('غرف أخرى', 'OTHER ROOMS')}</div><div class="tl">${other}</div>` : ''}
    <div class="card2"><b>${L('وقت اليوم', 'Time of day')}</b>${chips([[13, L('نهار', 'Day')], [18.5, L('غروب', 'Sunset')], [21, L('ليل', 'Night')]], st.time, 'rmtime')}</div>`;
}
function rmAct(v) {
  const r = R.remote; if (!r) return; const st = r.st;
  if (v.startsWith('s:')) runScene(r, v.slice(2));
  else if (v.startsWith('t:')) { const f = v.slice(2); if (st[f]) r.set({ [f]: { on: !st[f].on } }); }
  else if (v === 'cur') r.set({ curtain: st.curtain > 50 ? 0 : 100 });
  else if (v === 'door') return lockAct(S.lock.locked ? 'remote' : 'lock');
  else if (v === 'bac') return clAct('acpow');
  else if (v === 'btv') return mpAct('tv');
  else if (v === 'bcur') return curAct(R.curtain.st.curtain > 50 ? 'open' : 'close');
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
const lfix = () => lightProd()?.fixture;
const ACT = {
  lang: () => { LANG = LANG === 'ar' ? 'en' : 'ar'; try { localStorage.setItem('dh-lang', LANG); } catch (e) { /* ignore */ } const y = scrollY; render(); scrollTo(0, y); },
  theme: () => { THEME = isDark() ? 'light' : 'dark'; try { localStorage.setItem('dh-theme', THEME); } catch (e) { /* ignore */ } applyTheme(THEME); const b = document.querySelector('[data-a=theme]'); if (b) b.innerHTML = icon(isDark() ? 'sun' : 'moon'); },
  lsel: v => selLight(v),
  lpow: () => { const f = lfix(); R.light.set({ [f]: { on: !R.light.st[f].on } }); keep('light', R.light); dockLight(); },
  lrgb: v => { const f = lfix(); R.light.set({ [f]: { on: true, rgb: v || null } }); keep('light', R.light); dockLight(); },
  lpre: v => { const f = lfix(), P = { relax: [35, 2700], read: [85, 4000], focus: [100, 5200], night: [8, 2700] }[v]; R.light.set({ [f]: { on: true, bri: P[0], cct: P[1], rgb: null } }); keep('light', R.light); dockLight(); },
  lday: v => { R.light.set({ time: +v }); keep('light', R.light); dockLight(); },
  lsolo: () => { S.light.solo = !S.light.solo; R.light.set({ solo: S.light.solo ? lfix() : null }); keep('light', R.light); dockLight(); },
  mpsel: v => { S.mixpad.sel = v; dockMixpad(); panelMixpad(); }, mp: v => mpAct(v),
  lksel: v => { S.lock.sel = v; const el = R.lock?.lock(); if (el) el.innerHTML = lockArt(lockModel()); dockLock(); panelLock(); }, lk: v => lockAct(v),
  cact: v => curAct(v), csheer: () => { R.curtain.set({ sheer: R.curtain.st.sheer > 50 ? 0 : 100 }); keep('curtain', R.curtain); dockCurtain(); }, cauto: v => curAuto(v),
  clights: () => { const r = R.curtain, on = !r.fixtures().some(f => r.st[f].on); r.fixtures().forEach(f => r.set({ [f]: { on } })); keep('curtain', r); dockCurtain(); },
  acpow: () => clAct('acpow'), acset: v => clAct('acset', v), acmode: v => clAct('acmode', v), acfan: v => clAct('acfan', v), acswing: () => clAct('acswing'),
  rm: v => rmAct(v), rmtime: v => { R.remote.set({ time: +v }); keep('remote', R.remote); panelRemote(); },
  proj: v => openProject(v), gal: v => { gal.i += +v + 100; drawModal(); }, mclose: () => { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; },
  criflick: () => { S.cri.flicker = !S.cri.flicker; R.cri.flicker(S.cri.flicker); const b = document.querySelector('[data-a=criflick]'); if (b) { b.classList.toggle('on', S.cri.flicker); b.setAttribute('aria-pressed', S.cri.flicker); } },
  crijump: v => { const from = S.cri.x, to = +v, t0 = performance.now(); const step = n => { const k = Math.min(1, (n - t0) / 600), e = 1 - Math.pow(1 - k, 3); R.cri.split(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); },
  noop: () => { },
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-a]'); if (!t) { if (e.target.id === 'modal') ACT.mclose(); return; }
  ACT[t.dataset.a]?.(t.dataset.v);
});
const INP = {
  lbri: v => { const f = lfix(); R.light.set({ [f]: { on: true, bri: +v } }); keep('light', R.light); $('#v-lbri').textContent = v + '%'; $('[data-a=lpow]')?.classList.add('on'); },
  lcct: v => { const f = lfix(); R.light.set({ [f]: { on: true, cct: +v, rgb: null } }); keep('light', R.light); $('#v-lcct').textContent = v + 'K'; },
  cpos: v => { R.curtain.set({ curtain: +v }); keep('curtain', R.curtain); $('#v-cpos').textContent = v + '%'; },
  ctime: v => { R.curtain.set({ time: +v }); keep('curtain', R.curtain); $('#v-ctime').textContent = fmtT(+v); },
  crix: v => { R.cri.split(+v); },
  rmbri: v => { const f = R.remote.fixtures()[0]; if (f) R.remote.set({ [f]: { on: true, bri: +v } }); keep('remote', R.remote); },
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
