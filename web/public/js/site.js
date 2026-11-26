// Digital Home website: renders every section from the managed content and drives the live photo scenes.
// Each demo is a real photo of a room that is relit live; its controls sit right under the photo, and the photo
// stays pinned on screen while the visitor adjusts, so every change is seen as it happens.
import { sprite, icon } from './icons.js';
import { loadContent } from './store.js';
import { UI, DEFAULT_CONTENT } from './content.js';
import { makePhoto, makeCRIPhoto, fixtureHasColour, TV_CHANNELS } from './photo.js';
import { deviceArt, artKey } from './devices.js';

// the official ORVIBO product photos used as live devices: where the screen and the keys are on each photo (in %)
const REAL = {
  mp: { x: { src: 'img/products/mixpad12.webp', scr: [10.8, 7, 78.4, 57], n: 10 }, '7': { src: 'img/products/mixpad7.webp', scr: [11.1, 5.8, 78, 63.2], n: 8 }, mini: { src: 'img/products/mixpad4.webp', scr: [13.9, 5.6, 70.8, 71.2], n: 4 },
    '10': { src: 'img/products/mixpad10.webp', scr: [11, 7.5, 57.2, 55.5], n: 8 }, m5: { src: 'img/products/mixpadm5.webp', scr: [8, 5, 81, 57], n: 4 } },
  // the inside face of the lock, seen from the hallway in the photo (the V5 has a video screen on this side)
  inside: { face: { src: 'img/products/lock-v5-in.webp', name: 'ORVIBO V5', scr: [4.5, 2.6, 55.5, 24] }, finger: { src: 'img/products/lock-c1-in.webp', name: 'ORVIBO C1' } },
  // the outside face with its real keypad, used as the touch keypad
  pad: { face: { src: 'img/products/lock-v5-pad.webp', cols: [33.3, 56, 78.8], rows: [55, 66, 77.2, 88.2], k: 20, extra: [['fp', 56, 18, 'fp'], ['bell', 56, 43.5, 'bell']] },
    finger: { src: 'img/products/lock-c1-pad.webp', cols: [16.4, 27.9, 37.3], rows: [9.5, 19.3, 28.4, 38.4], k: 8.5, extra: [['card', 27.9, 53.1, 'card'], ['fp', 36.5, 88.4, 'fp']] } },
};
const realLock = m => { const r = REAL.inside[m] || REAL.inside.face; return `<span class="lkwrap"><img class="lockimg" src="${r.src}" alt="${r.name}" draggable="false">${r.scr ? `<span class="lkscr" style="left:${r.scr[0]}%;top:${r.scr[1]}%;width:${r.scr[2]}%;height:${r.scr[3]}%"></span>` : ''}</span>`; };

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
const demo = (id, key, alt) => `<section class="section ${alt ? 'alt' : ''}" id="${id}"><div class="wrap">${head(C.blocks[id])}<div class="demo"><div class="stage" id="st-${key}"></div><div class="side"><div class="dock" id="dk-${key}"></div><div class="panel" id="pn-${key}"></div></div></div></div></section>`;

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
    return `<section class="section" id="cri"><div class="wrap">${head(C.blocks.cri)}<div class="demo"><div class="stage" id="st-cri"></div><div class="side">
      <div class="dock"><div class="dk-row"><span class="dk-end">${esc(tx(c.otherLabel))}</span><input type="range" min="0" max="100" value="${S.cri.x}" data-i="crix" class="crislider grow" aria-label="${L('موضع المقارنة', 'Comparison position')}"><span class="dk-end ours">${esc(tx(c.oursLabel))}</span></div>
      <div class="dk-row"><div class="chips"><button class="chip" data-a="crijump" data-v="100">${esc(tx(c.otherLabel))}</button><button class="chip" data-a="crijump" data-v="50">${L('نصف ونصف', 'Half and half')}</button><button class="chip" data-a="crijump" data-v="0">${esc(tx(c.oursLabel))}</button></div>
      <span class="dk-c"><label>${L('كاميرا بطيئة تكشف الوميض', 'Slow-motion camera (flicker)')}</label>${sw(S.cri.flicker, 'criflick')}</span></div></div>
      <div class="panel"><h3>${L('مؤشر تجسيد اللون', 'Colour rendering index')}</h3>${bar(c.ours, tx(c.oursLabel), 'ours')}${bar(c.other, tx(c.otherLabel), 'other')}
      <div class="plist">${c.points.map(pt => `<div><b>${esc(tx(pt.title))}</b><p class="desc">${esc(tx(pt.text))}</p></div>`).join('')}</div><p class="note">${esc(tx(c.note))}</p></div></div></div></div></section>`; },
  mixpad: () => demo('mixpad', 'mixpad', true),
  lock: () => demo('lock', 'lock'),
  curtain: () => demo('curtain', 'curtain', true),
  climate: () => demo('climate', 'climate'),
  remote: () => `<section class="section alt" id="remote"><div class="wrap">${head(C.blocks.remote)}<div class="phoneblk"><div class="phone"><div class="scr app" id="pn-remote"></div></div><div class="stage" id="st-remote"></div></div><div class="plist" style="margin-top:18px">${prods('remote').map(p => `<div class="card prow"><span class="thumb">${thumb(p, 'phone')}</span><div><h3>${esc(tx(p.name))}</h3><p>${esc(tx(p.desc))}</p>${specs(p)}</div></div>`).join('')}</div></div></section>`,
  catalog: () => { const ps = prods('other'); if (!ps.length) return '';
    const card = p => `<article class="prod"><div class="ph">${thumb(p, 'box')}</div><div class="in"><h3>${esc(tx(p.name))}</h3><p class="desc">${esc(tx(p.desc))}</p>${specs(p)}</div></article>`;
    const G = C.groups || {}, keys = [...Object.keys(G).filter(g => ps.some(p => p.group === g)), ...(ps.some(p => !G[p.group]) ? ['_'] : [])];
    return `<section class="section" id="catalog"><div class="wrap">${head(C.blocks.catalog)}
      ${keys.length > 1 ? `<div class="chips catchips">${keys.map(g => `<a class="chip" href="#cat-${g}">${esc(g === '_' ? L('أخرى', 'Other') : tx(G[g]))} <span class="num">${ps.filter(p => g === '_' ? !G[p.group] : p.group === g).length}</span></a>`).join('')}</div>` : ''}
      ${keys.map(g => `<div class="catgroup" id="cat-${g}">${keys.length > 1 ? `<h3 class="cath">${esc(g === '_' ? L('أخرى', 'Other') : tx(G[g]))}</h3>` : ''}<div class="grid3">${ps.filter(p => g === '_' ? !G[p.group] : p.group === g).map(card).join('')}</div></div>`).join('')}</div></section>`; },
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
  const real = REAL.mp[model] || REAL.mp.x, q = real.scr, tiles = model === 'mini' || model === 'm5' ? [sc[0], sc[2], ...dev].slice(0, 4) : [...sc, ...dev].slice(0, real.n);
  return `<div class="mpreal m-${esc(model)}"><img src="${real.src}" alt="${esc(tx(mpProd()?.name))}" draggable="false"><div class="mpscr" style="left:${q[0]}%;top:${q[1]}%;width:${q[2]}%;height:${q[3]}%"><div class="mpscreen"><div class="mphead"><b class="num">${fmtT(st.time)}</b><span>${L('غرفة النوم', 'Bedroom')} · ${st.temp.toFixed(0)}°</span></div><div class="mpgrid">${tiles.join('')}</div></div></div></div>`;
}
function dockMixpad() {
  const host = $('#dk-mixpad'); if (!host) return;
  host.innerHTML = `<div class="mpdock"><div id="mpdev">${mpScreen()}</div><div class="ctl"><b>${L('اختر اللوحة', 'Choose the panel')}</b><div class="chips">${prods('mixpad').map(x => `<button class="chip ${x.id === mpProd()?.id ? 'on' : ''}" data-a="mpsel" data-v="${esc(x.id)}">${esc(tx(x.name))}</button>`).join('')}</div>
    <p class="desc">${L('اضغط على الشاشة أو على أي جهاز في الصورة.', 'Tap the screen, or any device in the photo.')}</p></div></div>`;
  wallPanel();
}
function wallPanel() { const st = R.mixpad?.st; if (!st) return; const html = `<div class="wallmp"><b>${fmtT(st.time)}</b><span>${['down', 'track', 'pendant', 'strip'].map(f => `<i class="${st[f].on ? 'on' : ''}"></i>`).join('')}</span></div>`; R.mixpad.panel(html); if (phRoom().key === 'mixpad' && R.remote) R.remote.panel(html); }
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
  keep('mixpad', r); const d = $('#mpdev'); if (d) d.innerHTML = mpScreen(); wallPanel(); panelRemote();
}

// ---------- the smart lock ----------
const PIN = '2580';
function lockProd() { const ps = prods('lock'); return ps.find(p => p.id === S.lock.sel) || ps[0]; }
const lockModel = () => (lockProd()?.model === 'finger' ? 'finger' : 'face');
function mountLock() {
  const p = lockProd(); if (p) S.lock.sel = p.id;
  R.lock = makePhoto($('#st-lock'), { scene: { ...sceneOf('lock'), flat: true }, label: L('باب المدخل مع القفل الذكي', 'Front door with the smart lock'), lockArt: () => realLock(lockModel()) });
  R.lock.ready.then(() => { intercom(); R.lock.door(!S.lock.locked); });
  cap($('#st-lock'), L('باب المدخل', 'Front door'));
  dockLock(); panelLock();
}
function intercom() {
  if (!R.lock) return; const out = sceneOf('lock').outside, cam = `<div class="icam" style="background-image:url('${esc(out)}')"><i class="who"></i><em>●</em></div>`, t = fmtT(new Date().getHours() + new Date().getMinutes() / 60);
  R.lock.panel(S.lock.guest ? cam : `<div class="wallmp"><b>${t}</b><span>${S.lock.locked ? '🔒' : '🔓'}</span></div>`);
  if (phRoom().key === 'lock' && R.remote && R.remote !== R.lock) R.remote.panel(S.lock.guest ? cam : `<div class="wallmp"><b>${t}</b><span>${S.lock.locked ? '🔒' : '🔓'}</span></div>`);
  for (const scr of [R.lock.lock()?.querySelector('.lkscr'), phRoom().key === 'lock' ? R.remote?.lock()?.querySelector('.lkscr') : null]) if (scr) scr.innerHTML = S.lock.guest ? cam : !S.lock.locked ? `<div class="lkmsg ok">✓<small>${L('أهلاً', 'Welcome')}</small></div>` : `<div class="lkmsg"><small>${t}</small></div>`;
}
const lockFx = (cls, ms = 1200) => { for (const el of [R.lock?.lock(), phRoom().key === 'lock' ? R.remote?.lock() : null]) { if (!el) continue; el.classList.add(cls); clearTimeout(el['t' + cls]); el['t' + cls] = setTimeout(() => el.classList.remove(cls), ms); } };
const now = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
function lockLog(ar, en) { S.lock.log.unshift({ t: now(), ar, en }); S.lock.log = S.lock.log.slice(0, 12); }
function dockLock() {
  const s = S.lock, host = $('#dk-lock'); if (!host) return; const m = lockModel(), face = m === 'face', P = REAL.pad[m];
  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'], LBL = { del: '⌫', ok: '✓' };
  host.innerHTML = `<div class="lockdock"><div class="padcol"><div class="pinview num" aria-live="polite">${'●'.repeat(s.pin.length) || '&nbsp;'}</div>
      <div class="lockpad2 m-${m}"><img src="${P.src}" alt="${esc(tx(lockProd()?.name))}" draggable="false">
        ${KEYS.map((k, i) => `<button class="k" style="left:${P.cols[i % 3]}%;top:${P.rows[i / 3 | 0]}%;width:${P.k}%" data-a="lk" data-v="${k}" aria-label="${LBL[k] || k}"></button>`).join('')}
        ${P.extra.map(([v, x, y, n]) => `<button class="k big" style="left:${x}%;top:${y}%;width:${P.k * 1.5}%" data-a="lk" data-v="${v}" aria-label="${n}"></button>`).join('')}</div>
      <small class="desc">${L('اضغط على أزرار القفل نفسه', 'Press the keys on the lock itself')}</small></div>
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
  const kb = document.querySelector(`.lockpad2 [data-v="${v}"]`); if (kb) { kb.classList.add('hit'); setTimeout(() => kb.classList.remove('hit'), 450); }
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

// ---------- the phone: an app in the style of ORVIBO Home ----------
// Home screen: rooms, scenes and device cards. Tapping a card opens that device's control screen at once;
// the round button on a card switches it on or off without opening it. The photo beside the phone shows the
// room chosen in the app, and every change also reaches that room's own section on the page.
const ROOMS = [
  { id: 'living', key: 'remote', n: ['الصالة', 'Living room'] },
  { id: 'master', key: 'mixpad', n: ['غرفة النوم', 'Bedroom'] },
  { id: 'guest', key: 'climate', n: ['غرفة الضيوف', 'Guest room'] },
  { id: 'suite', key: 'curtain', n: ['الجناح', 'Suite'] },
  { id: 'entry', key: 'lock', n: ['المدخل', 'Entrance'] },
];
const SCN_OF = { remote: 'remote', mixpad: 'mixpad', climate: 'climate', curtain: 'curtain', lock: 'lock' };
const PH = { at: 'living', dev: null, enter: false };
const phRoom = () => ROOMS.find(r => r.id === PH.at) || ROOMS[0];
const roomState = key => key === 'remote' ? S.remote.room : (R[key] ? JSON.parse(JSON.stringify(R[key].st)) : S[key]?.room);
function mountRemote() {
  const rm = phRoom(), host = $('#st-remote'); if (!host) return;
  if (rm.key === 'lock') {
    R.remote = makePhoto(host, { scene: { ...sceneOf('lock'), flat: true }, label: L(...rm.n), lockArt: () => realLock(lockModel()) });
    R.remote.ready.then(() => { R.remote.door(!S.lock.locked); R.remote.guest(S.lock.guest); intercom(); });
  } else {
    R.remote = makePhoto(host, { scene: sceneOf(SCN_OF[rm.key]), label: L(...rm.n), state: roomState(rm.key),
      onHot: h => phOpen(h === 'curtain' ? 'cur' : h === 'ac' ? 'ac' : h === 'tv' ? 'tv' : h === 'panel' ? null : 'l:' + h) });
  }
  cap(host, L(...rm.n));
  panelRemote();
}
// change a device in the room shown on the phone, and in that room's own section
function phApply(patch) {
  const rm = phRoom(); R.remote.set(patch);
  if (rm.key === 'remote') { keep('remote', R.remote); return; }
  const main = R[rm.key]; if (main) { main.set(patch); keep(rm.key, main); } else S[rm.key].room = JSON.parse(JSON.stringify(R.remote.st));
  if (rm.key === 'mixpad') { const d = $('#mpdev'); if (d) d.innerHTML = mpScreen(); wallPanel(); }
  if (rm.key === 'climate') dockClimate(); if (rm.key === 'curtain') dockCurtain();
}
function phDevices() {
  const rm = phRoom(), r = R.remote; if (!r) return [];
  if (rm.key === 'lock') return [{ id: 'lock', ic: 'lock', n: tx(lockProd()?.name) || L('القفل الذكي', 'Smart lock'), s: S.lock.locked ? L('مقفل', 'Locked') : L('مفتوح', 'Unlocked'), on: !S.lock.locked, pw: false },
    { id: 'cam', ic: 'camera', n: L('جرس الباب', 'Doorbell'), s: S.lock.guest ? L('زائر عند الباب', 'Visitor at the door') : L('لا أحد', 'No one'), on: S.lock.guest, pw: false }];
  const st = r.st, list = r.fixtures().map(f => ({ id: 'l:' + f, ic: FIX_ICON[f], n: fixName(f), s: st[f].on ? st[f].bri + '%' : L('مطفأ', 'Off'), on: st[f].on, pw: true }));
  if (r.has('window')) { const op = 100 - Math.round(st.curtain); list.push({ id: 'cur', ic: 'curtain', n: rm.id === 'living' ? L('الستارة الرول', 'Roller blind') : L('الستارة', 'Curtain'), s: op >= 99 ? L('مفتوحة', 'Open') : op <= 1 ? L('مغلقة', 'Closed') : L(`مفتوحة ${op}%`, `${op}% open`), on: op > 1, pw: true }); }
  if (r.has('ac')) list.push({ id: 'ac', ic: 'ac', n: L('المكيّف', 'Air conditioner'), s: st.ac.on ? `${modeName(st.ac.mode)} · ${st.ac.set}°` : L('مطفأ', 'Off'), on: st.ac.on, pw: true });
  if (r.has('tv')) list.push({ id: 'tv', ic: 'tv', n: L('التلفزيون', 'TV'), s: st.tv.on ? (LANG === 'ar' ? TV_CHANNELS[st.tv.ch].ar : TV_CHANNELS[st.tv.ch].en) : L('مطفأ', 'Off'), on: st.tv.on, pw: true });
  if (rm.key === 'climate') list.push({ id: 'th', ic: 'thermo', n: L('الحرارة والرطوبة', 'Temperature'), s: `${(R.climate?.st.temp ?? st.temp).toFixed(1)}° · 48%`, on: true, pw: false });
  return list;
}
const modeName = m => ({ cool: L('تبريد', 'Cool'), heat: L('تدفئة', 'Heat'), dry: L('تجفيف', 'Dry'), fan: L('مروحة', 'Fan') }[m] || m);
const clock = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
function panelRemote() {
  const host = $('#pn-remote'); if (!host || !R.remote) return; const rm = phRoom();
  if (rm.key === 'lock') { R.remote.door(!S.lock.locked); R.remote.guest(S.lock.guest); }
  else if (rm.key !== 'remote' && R[rm.key]) { const m = R[rm.key].st; R.remote.set({ ...['down', 'spot', 'strip', 'track', 'pendant', 'washer'].reduce((o, f) => (o[f] = { ...m[f] }, o), {}), curtain: m.curtain, sheer: m.sheer, tv: { ...m.tv }, ac: { ...m.ac }, time: m.time }); }
  if (rm.key === 'mixpad') wallPanel();
  const bar = `<div class="sbar"><b class="num">${clock()}</b><span>●●● ᯤ ▮</span></div>`;
  host.innerHTML = bar + (PH.dev ? phDevice() : phHome());
  const pg = host.querySelector('.pg'); if (pg && PH.enter) { pg.classList.add('enter'); PH.enter = false; }
}
function phHome() {
  const rm = phRoom(), devs = phDevices(), lightsOn = ROOMS.filter(x => x.key !== 'lock').reduce((n, x) => { const st = x.key === 'remote' ? S.remote.room : (R[x.key]?.st || S[x.key]?.room); return n + ['down', 'spot', 'strip', 'track', 'pendant', 'washer'].filter(f => st?.[f]?.on).length; }, 0);
  return `<div class="pg home">
    <div class="ahead"><h4>${L('منزلي', 'My Home')} <small>▾</small></h4><span class="aplus">＋</span></div>
    <div class="env"><div><b class="num">${R.climate ? R.climate.st.temp.toFixed(1) : '27.0'}°</b><span>${L('داخل البيت', 'Indoor')}</span></div><div><b class="num">${lightsOn}</b><span>${L('أضواء تعمل', 'Lights on')}</span></div><div><b>${S.lock.locked ? L('مقفل', 'Locked') : L('مفتوح', 'Open')}</b><span>${L('الباب', 'Door')}</span></div></div>
    ${S.lock.guest ? `<button class="card2 bell" data-a="ph" data-v="open:cam">${icon('bell')} <b>${L('زائر عند الباب', 'Visitor at the door')}</b><span class="chip">${L('عرض', 'View')}</span></button>` : ''}
    <div class="lbl">${L('المشاهد', 'Scenes')}</div><div class="scr-x">${Object.entries(SCENES).map(([k, sc]) => `<button class="scn" data-a="ph" data-v="scene:${k}">${icon(sc.ic)}<span>${esc(sc.n[LANG === 'ar' ? 0 : 1])}</span></button>`).join('')}</div>
    <div class="rooms">${ROOMS.map(x => `<button class="${x.id === rm.id ? 'on' : ''}" data-a="ph" data-v="room:${x.id}">${esc(L(...x.n))}</button>`).join('')}</div>
    <div class="dgrid">${devs.map(d => `<div class="dcard ${d.on ? 'on' : ''}" data-a="ph" data-v="open:${d.id}" role="button" tabindex="0" aria-label="${esc(d.n)}">
      <span class="dic">${icon(d.ic)}</span>${d.pw ? `<button class="dpw ${d.on ? 'on' : ''}" data-a="ph" data-v="pow:${d.id}" aria-label="${L('تشغيل أو إيقاف', 'On or off')}">${icon('power')}</button>` : ''}
      <b>${esc(d.n)}</b><small>${esc(d.s)}</small></div>`).join('')}</div>
    <p class="ahint">${L('اضغط على أي جهاز لفتح شاشة التحكم به', 'Tap any device to open its controls')}</p></div>
    <nav class="tabs"><span class="on">${icon('home')}${L('الرئيسية', 'Home')}</span><span>${icon('spark')}${L('المشاهد', 'Scenes')}</span><span>${icon('shield')}${L('الأمان', 'Security')}</span><span>${icon('user')}${L('حسابي', 'Me')}</span></nav>`;
}
function phDevice() {
  const id = PH.dev, rm = phRoom(), r = R.remote, st = r.st, d = phDevices().find(x => x.id === id) || { n: '', on: false };
  const top = (pw) => `<div class="dtop"><button class="back" data-a="ph" data-v="back" aria-label="${L('رجوع', 'Back')}">‹</button><div><b>${esc(d.n)}</b><small>${esc(L(...rm.n))}</small></div>${pw ? `<button class="bigpw ${d.on ? 'on' : ''}" data-a="ph" data-v="pow:${id}" aria-label="${L('تشغيل أو إيقاف', 'On or off')}">${icon('power')}</button>` : '<span></span>'}</div>`;
  if (id.startsWith('l:')) {
    const f = id.slice(2), Lt = st[f], col = fixtureHasColour(f);
    return `<div class="pg dev">${top(true)}
      <div class="vwrap"><div class="vbar ${Lt.on ? '' : 'off'}" data-drag="bri" style="--v:${Lt.on ? Lt.bri : 0}%;--lc:${Lt.rgb || kelvinCss(Lt.cct)}"><i></i><span class="num" id="ph-bri">${Lt.on ? Lt.bri + '%' : L('مطفأ', 'Off')}</span></div></div>
      <div class="dsec"><label>${L('حرارة اللون', 'Colour temperature')} <b class="num" id="ph-cct">${Lt.cct}K</b></label><input class="cctbar" type="range" min="2700" max="6500" step="100" value="${Lt.cct}" data-i="phcct" aria-label="${L('حرارة اللون', 'Colour temperature')}"></div>
      ${col ? `<div class="dsec"><label>${L('اللون', 'Colour')}</label><div class="sws">${COLORS.map(c => `<button class="swatch ${Lt.rgb === c ? 'on' : ''}" style="background:${c}" data-a="ph" data-v="rgb:${c}" aria-label="${c}"></button>`).join('')}<button class="swatch ${!Lt.rgb ? 'on' : ''}" style="background:linear-gradient(90deg,#ffb46b,#fff,#cfe2ff)" data-a="ph" data-v="rgb:" aria-label="${L('أبيض', 'White')}"></button></div></div>` : ''}
      <div class="dsec"><label>${L('أوضاع جاهزة', 'Modes')}</label><div class="modes">${[['relax', 'moon', L('استرخاء', 'Relax')], ['read', 'bulb', L('قراءة', 'Reading')], ['focus', 'sun', L('تركيز', 'Focus')], ['night', 'moon', L('ليلي', 'Night')]].map(([k, ic, n]) => `<button data-a="ph" data-v="pre:${k}">${icon(ic)}<span>${n}</span></button>`).join('')}</div></div></div>`;
  }
  if (id === 'cur') {
    const op = 100 - Math.round(st.curtain), blind = (rm.zone = r.zones.find(z => z.t === 'window'))?.m === 'blind';
    return `<div class="pg dev">${top(false)}
      <div class="curvis ${blind ? 'blind' : ''}" style="--c:${(rm.zone && rm.zone.c) || '#8a7c70'};--k:${st.curtain / 100}"><i class="sky"></i><i class="l"></i><i class="r"></i><span class="num" id="ph-cur">${op}%</span></div>
      <div class="dsec"><label>${L('نسبة الفتح', 'Open')}</label><input type="range" min="0" max="100" step="1" value="${op}" data-i="phcur" aria-label="${L('نسبة الفتح', 'Open')}"></div>
      <div class="cbtns"><button data-a="ph" data-v="cur:open">${L('فتح', 'Open')}</button><button data-a="ph" data-v="cur:stop">${L('إيقاف', 'Pause')}</button><button data-a="ph" data-v="cur:close">${L('إغلاق', 'Close')}</button></div>
      <div class="dsec"><label>${L('أتمتة', 'Automation')}</label><div class="modes two"><button data-a="ph" data-v="cur:open">${icon('sun')}<span>${L('تُفتح مع الشروق', 'Open at sunrise')}</span></button><button data-a="ph" data-v="cur:close">${icon('moon')}<span>${L('تُغلق مع الغروب', 'Close at sunset')}</span></button></div></div></div>`;
  }
  if (id === 'ac') {
    const a = st.ac, room = (R.climate?.st.temp ?? st.temp), k = (a.set - 16) / 14;
    return `<div class="pg dev">${top(true)}
      <div class="dial ${a.on ? '' : 'off'} m-${a.mode}" style="--k:${k}"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="80" class="track"/><circle cx="100" cy="100" r="80" class="prog" pathLength="100" style="stroke-dasharray:${(k * 75).toFixed(1)} 100"/></svg>
        <div><small>${a.on ? modeName(a.mode) : L('مطفأ', 'Off')}</small><b class="num">${a.set}<sup>°C</sup></b><small>${L('الغرفة', 'Room')} <span class="num" id="ph-room">${room.toFixed(1)}°</span></small></div></div>
      <div class="cbtns"><button data-a="ph" data-v="set:-1" aria-label="-">−</button><button data-a="ph" data-v="set:1" aria-label="+">+</button></div>
      <div class="dsec"><label>${L('الوضع', 'Mode')}</label><div class="modes">${[['cool', 'ac'], ['heat', 'sun'], ['dry', 'leaf'], ['fan', 'fan']].map(([m, ic]) => `<button class="${a.mode === m ? 'on' : ''}" data-a="ph" data-v="mode:${m}">${icon(ic)}<span>${modeName(m)}</span></button>`).join('')}</div></div>
      <div class="dsec"><label>${L('سرعة المروحة', 'Fan speed')}</label><div class="seg">${[[1, L('هادئة', 'Low')], [2, L('متوسطة', 'Mid')], [3, L('قوية', 'High')]].map(([v, n]) => `<button class="${a.fan === v ? 'on' : ''}" data-a="ph" data-v="fan:${v}">${n}</button>`).join('')}</div></div>
      <div class="dsec row2"><label>${L('تأرجح الهواء', 'Swing')}</label>${sw(a.swing, 'ph', 'swing')}</div></div>`;
  }
  if (id === 'tv') {
    const t = st.tv;
    return `<div class="pg dev">${top(true)}
      <div class="remote2"><div class="seg">${TV_CHANNELS.map((c, i) => `<button class="${t.ch === i && t.on ? 'on' : ''}" data-a="ph" data-v="ch:${i}">${esc(LANG === 'ar' ? c.ar : c.en)}</button>`).join('')}</div>
        <div class="dpad"><button data-a="ph" data-v="chs:-1" aria-label="${L('القناة السابقة', 'Previous channel')}">▲</button><button data-a="ph" data-v="vol:-5" aria-label="-">◀</button><span>OK</span><button data-a="ph" data-v="vol:5" aria-label="+">▶</button><button data-a="ph" data-v="chs:1" aria-label="${L('القناة التالية', 'Next channel')}">▼</button></div>
        <div class="dsec row2"><label>${L('الصوت', 'Volume')}</label><b class="num">${t.vol}</b></div></div></div>`;
  }
  if (id === 'th') { const room = (R.climate?.st.temp ?? st.temp);
    return `<div class="pg dev">${top(false)}<div class="dial off"><div><small>${L('الحرارة الآن', 'Now')}</small><b class="num">${room.toFixed(1)}<sup>°C</sup></b><small>${L('الرطوبة', 'Humidity')} 48%</small></div></div>
      <p class="ahint">${L('عند تجاوز 26° يشغّل المكيّف تلقائياً.', 'Above 26° it switches the AC on automatically.')}</p></div>`; }
  if (id === 'lock' || id === 'cam') {
    const out = sceneOf('lock').outside, s = S.lock;
    return `<div class="pg dev">${top(false)}
      ${s.guest || id === 'cam' ? `<div class="camv" style="background-image:url('${esc(out)}')">${s.guest ? '<i class="who"></i>' : ''}<em>● LIVE</em></div>` : ''}
      <button class="lockbig ${s.locked ? '' : 'open'}" data-a="ph" data-v="${s.locked ? 'unlock' : 'lock'}">${icon(s.locked ? 'lock' : 'key')}<b>${s.locked ? L('اضغط للفتح', 'Tap to unlock') : L('اضغط للقفل', 'Tap to lock')}</b><small>${s.locked ? L('الباب مقفل', 'The door is locked') : L('الباب مفتوح', 'The door is open')}</small></button>
      <div class="modes two"><button data-a="ph" data-v="otp">${icon('key')}<span>${L('رمز لمرة واحدة', 'One-time code')}</span></button><button data-a="ph" data-v="bell">${icon('bell')}<span>${L('تجربة الجرس', 'Test the bell')}</span></button></div>
      ${s.otp ? `<p class="ahint">${L('رمز الزائر', 'Visitor code')}: <b class="num">${s.otp}</b></p>` : ''}
      <div class="dsec"><label>${L('سجل الدخول', 'History')}</label><div class="log">${s.log.slice(0, 6).map(l => `<div><i>${l.t}</i>${esc(LANG === 'ar' ? l.ar : l.en)}</div>`).join('') || `<div>${L('لا توجد أحداث بعد', 'No events yet')}</div>`}</div></div></div>`;
  }
  return phHome();
}
const kelvinCss = k => { const c = k <= 3000 ? [255, 190, 120] : k <= 4200 ? [255, 228, 196] : k <= 5200 ? [255, 246, 236] : [214, 230, 255]; return `rgb(${c})`; };
function phAct(v) {
  const r = R.remote; if (!r) return; const st = r.st, [k, a] = [v.split(':')[0], v.slice(v.indexOf(':') + 1)];
  if (k === 'room') { PH.at = a; PH.dev = null; mountRemote(); return; }
  if (k === 'open') { if (a) { PH.dev = a; PH.enter = true; } return panelRemote(); }
  if (k === 'back') { PH.dev = null; return panelRemote(); }
  if (k === 'scene') { phApply(SCENES[a].s()); }
  if (k === 'pow') {
    if (a.startsWith('l:')) { const f = a.slice(2); phApply({ [f]: { on: !st[f].on } }); }
    if (a === 'cur') phApply({ curtain: st.curtain > 50 ? 0 : 100 });
    if (a === 'ac') phApply({ ac: { on: !st.ac.on } }); if (a === 'tv') phApply({ tv: { on: !st.tv.on } });
  }
  const f = PH.dev && PH.dev.startsWith('l:') ? PH.dev.slice(2) : null;
  if (k === 'rgb' && f) phApply({ [f]: { on: true, rgb: a || null } });
  if (k === 'pre' && f) { const P = { relax: [35, 2700], read: [85, 4000], focus: [100, 5200], night: [8, 2700] }[a]; phApply({ [f]: { on: true, bri: P[0], cct: P[1], rgb: null } }); }
  if (k === 'cur') phApply({ curtain: a === 'open' ? 0 : a === 'close' ? 100 : Math.round(r.pos()) });
  if (k === 'set') phApply({ ac: { on: true, set: clamp(st.ac.set + +a, 16, 30) } });
  if (k === 'mode') phApply({ ac: { on: true, mode: a } }); if (k === 'fan') phApply({ ac: { fan: +a } }); if (k === 'swing') phApply({ ac: { swing: !st.ac.swing } });
  if (k === 'ch') phApply({ tv: { on: true, ch: +a } }); if (k === 'chs') phApply({ tv: { on: true, ch: (st.tv.ch + +a + TV_CHANNELS.length) % TV_CHANNELS.length } }); if (k === 'vol') phApply({ tv: { vol: clamp(st.tv.vol + +a, 0, 100) } });
  if (k === 'unlock') return lockAct('remote'); if (k === 'lock') return lockAct('lock'); if (k === 'otp') return lockAct('otp'); if (k === 'bell') return lockAct('bell');
  panelRemote();
}
// the tall brightness bar: drag up and down, like the app
let vdrag = null;
document.addEventListener('pointerdown', e => { const b = e.target.closest?.('.vbar[data-drag]'); if (!b) return; vdrag = b; b.setPointerCapture?.(e.pointerId); vmove(e); });
document.addEventListener('pointermove', e => { if (vdrag) vmove(e); });
document.addEventListener('pointerup', () => { if (vdrag) { vdrag = null; panelRemote(); } });
function vmove(e) {
  const r = vdrag.getBoundingClientRect(), v = clamp(Math.round((r.bottom - e.clientY) / r.height * 100), 1, 100), f = PH.dev?.slice(2); if (!f) return;
  vdrag.style.setProperty('--v', v + '%'); vdrag.classList.remove('off'); const t = $('#ph-bri'); if (t) t.textContent = v + '%';
  phApply({ [f]: { on: true, bri: v } });
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
  lksel: v => { S.lock.sel = v; const el = R.lock?.lock(); if (el) el.innerHTML = realLock(lockModel()); intercom(); dockLock(); panelLock(); }, lk: v => lockAct(v),
  cact: v => curAct(v), csheer: () => { R.curtain.set({ sheer: R.curtain.st.sheer > 50 ? 0 : 100 }); keep('curtain', R.curtain); dockCurtain(); }, cauto: v => curAuto(v),
  clights: () => { const r = R.curtain, on = !r.fixtures().some(f => r.st[f].on); r.fixtures().forEach(f => r.set({ [f]: { on } })); keep('curtain', r); dockCurtain(); },
  acpow: () => clAct('acpow'), acset: v => clAct('acset', v), acmode: v => clAct('acmode', v), acfan: v => clAct('acfan', v), acswing: () => clAct('acswing'),
  ph: v => phAct(v),
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
  phcct: v => { const f = PH.dev?.slice(2); if (!f) return; phApply({ [f]: { on: true, cct: +v, rgb: null } }); const t = $('#ph-cct'); if (t) t.textContent = v + 'K'; },
  phcur: v => { phApply({ curtain: 100 - +v }); const t = $('#ph-cur'); if (t) t.textContent = v + '%'; const c = $('.curvis'); if (c) c.style.setProperty('--k', (100 - +v) / 100); },
};
document.addEventListener('input', e => { const i = e.target.dataset?.i; if (i && INP[i]) INP[i](e.target.value); });
document.addEventListener('change', e => { const i = e.target.dataset?.i; if (i === 'phcct' || i === 'phcur') panelRemote(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal')?.hidden) ACT.mclose(); if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.dcard')) { e.preventDefault(); e.target.click(); } });
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { const b = document.querySelector('[data-a=theme]'); if (b && !THEME) b.innerHTML = icon(isDark() ? 'sun' : 'moon'); });

// ---------- start ----------
(async () => {
  sprite();
  C = await loadContent();
  render();
  window.DHWEB = { C, R, S, ACT };
})();
