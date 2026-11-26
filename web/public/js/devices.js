// Product renderings in the style of the real ORVIBO devices (used whenever the admin has not uploaded a product photo).
// Every drawing is an SVG with studio lighting: soft shadow, brushed metal, glass reflections.
let N = 0;
const id = p => `${p}${++N}`;
const shadow = (cx, cy, rx, ry, o = 0.28) => { const g = id('sh'); return `<defs><radialGradient id="${g}"><stop offset="0" stop-color="#000" stop-opacity="${o}"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${g})"/>`; };
const svg = (body, vb = '0 0 200 200') => `<svg class="art" direction="ltr" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
const lin = (g, stops, x2 = 0, y2 = 1, x1 = 0, y1 = 0) => `<linearGradient id="${g}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`;
const rad = (g, stops, cx = 0.5, cy = 0.5, r = 0.5) => `<radialGradient id="${g}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient>`;

// ---------- lighting ----------
function downlight() {
  const t = id('t'), r = id('r'), l = id('l'), gl = id('g');
  return svg(`<defs>${lin(t, [[0, '#ffffff'], [0.55, '#eceef1'], [1, '#c9ccd2']], 1, 1)}${rad(r, [[0, '#3a3c42'], [0.55, '#6d7078'], [0.86, '#b9bcc3'], [1, '#e4e6ea']])}${rad(l, [[0, '#fffdf6'], [0.45, '#ffe9c2'], [1, '#e8b56a']])}${rad(gl, [[0, '#ffd7a0', 0.55], [1, '#ffd7a0', 0]])}</defs>
    ${shadow(104, 108, 92, 92, 0.22)}<circle cx="100" cy="100" r="82" fill="url(#${t})"/><circle cx="100" cy="100" r="82" fill="none" stroke="#fff" stroke-width="2" opacity=".8"/>
    <circle cx="100" cy="100" r="66" fill="#9a9da4"/><circle cx="100" cy="100" r="63" fill="url(#${r})"/>
    ${[0, 1, 2, 3, 4, 5].map(i => `<circle cx="100" cy="100" r="${56 - i * 6}" fill="none" stroke="#000" stroke-opacity=".08"/>`).join('')}
    <circle cx="100" cy="100" r="40" fill="url(#${gl})"/><circle cx="100" cy="100" r="22" fill="url(#${l})"/><circle cx="100" cy="100" r="22" fill="none" stroke="#fff" stroke-opacity=".5"/>
    <path d="M42 70 A66 66 0 0 1 100 34" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>`);
}
function spot() {
  const t = id('t'), r = id('r'), l = id('l'), hx = id('h');
  return svg(`<defs>${lin(t, [[0, '#4a4d54'], [0.5, '#1f2125'], [1, '#0f1012']], 1, 1)}${rad(r, [[0, '#050506'], [0.7, '#18191c'], [1, '#34363b']])}${rad(l, [[0, '#fff8ea'], [0.5, '#ffd9a0'], [1, '#c98a3c', 0.4]])}
    <pattern id="${hx}" width="7" height="12" patternUnits="userSpaceOnUse"><path d="M3.5 0 L7 2 L7 6 L3.5 8 L0 6 L0 2 Z" fill="none" stroke="#000" stroke-opacity=".55" stroke-width=".8"/></pattern></defs>
    ${shadow(104, 108, 90, 90, 0.25)}<circle cx="100" cy="100" r="80" fill="url(#${t})"/><circle cx="100" cy="100" r="80" fill="none" stroke="#6a6d75" stroke-width="1.5"/>
    <circle cx="100" cy="100" r="62" fill="url(#${r})"/><ellipse cx="96" cy="104" rx="44" ry="40" fill="#0b0c0e" stroke="#2a2c31" stroke-width="3"/>
    <circle cx="94" cy="106" r="25" fill="url(#${l})"/><circle cx="94" cy="106" r="25" fill="url(#${hx})" opacity=".8"/>
    <path d="M38 66 A70 70 0 0 1 96 30" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".35"/>`);
}
function strip() {
  const p = id('p'), d = id('d'), gl = id('g');
  return svg(`<defs>${lin(p, [[0, '#f2f3f5'], [0.35, '#b6b9c0'], [0.6, '#dfe1e5'], [1, '#8d9098']])}${lin(d, [[0, '#fffaf0'], [1, '#ffe3b0']])}${lin(gl, [[0, '#ffcf8a', 0.55], [1, '#ffcf8a', 0]])}</defs>
    <polygon points="18,124 182,64 182,150 18,196" fill="url(#${gl})" opacity=".8"/>
    <g transform="rotate(-20 100 100)"><rect x="6" y="88" width="188" height="26" rx="3" fill="url(#${p})"/><rect x="10" y="91" width="180" height="11" rx="2" fill="url(#${d})"/>
    <rect x="10" y="91" width="180" height="3" rx="1.5" fill="#fff" opacity=".9"/><rect x="6" y="110" width="188" height="4" fill="#000" opacity=".12"/>
    <rect x="190" y="88" width="4" height="26" fill="#9da0a7"/></g>`);
}
function track() {
  const rl = id('r'), b = id('b'), l = id('l');
  const head = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-6" y="0" width="12" height="16" rx="2" fill="#1c1d21"/><rect x="-14" y="14" width="28" height="62" rx="13" fill="url(#${b})"/>
    <ellipse cx="0" cy="76" rx="13" ry="4.5" fill="url(#${l})"/><rect x="-14" y="22" width="5" height="46" rx="2.5" fill="#fff" opacity=".1"/></g>`;
  return svg(`<defs>${lin(rl, [[0, '#3b3e45'], [0.5, '#141518'], [1, '#2a2c31']])}${lin(b, [[0, '#33363c'], [0.35, '#16171a'], [1, '#0b0c0e']], 1, 0)}${rad(l, [[0, '#fff6e2'], [0.6, '#ffd08a'], [1, '#c98a3c', 0.3]])}</defs>
    ${shadow(100, 190, 90, 8, 0.18)}<rect x="8" y="30" width="184" height="12" rx="2" fill="url(#${rl})"/><rect x="8" y="30" width="184" height="2" fill="#6e7179"/>
    ${head(52, 40, 1.05)}${head(100, 40, 1.05)}<g><rect x="130" y="40" width="56" height="10" rx="2" fill="#16171a"/><rect x="133" y="49" width="50" height="4" rx="2" fill="#fff4dc"/><rect x="133" y="49" width="50" height="4" rx="2" fill="#ffd08a" opacity=".5"/></g>
    <polygon points="40,120 64,120 80,186 24,186" fill="#ffd9a0" opacity=".12"/><polygon points="88,120 112,120 128,186 72,186" fill="#ffd9a0" opacity=".12"/>`);
}
function pendant() {
  const s = id('s'), l = id('l'), g = id('g');
  return svg(`<defs>${lin(s, [[0, '#2c2e33'], [0.4, '#4b4e56'], [0.55, '#1d1f23'], [1, '#0d0e10']], 1, 0)}${rad(l, [[0, '#fffaf0'], [0.5, '#ffdca0'], [1, '#f0b060']])}${lin(g, [[0, '#ffd9a0', 0.45], [1, '#ffd9a0', 0]])}</defs>
    <line x1="100" y1="0" x2="100" y2="70" stroke="#222" stroke-width="2"/><rect x="92" y="66" width="16" height="16" rx="3" fill="#1a1b1e"/>
    <path d="M100 80 C 72 82 52 104 46 132 L 154 132 C 148 104 128 82 100 80 Z" fill="url(#${s})"/>
    <ellipse cx="100" cy="132" rx="54" ry="10" fill="url(#${l})"/><polygon points="50,136 150,136 196,200 4,200" fill="url(#${g})"/>
    <path d="M62 116 C 70 98 82 90 96 87" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="3" stroke-linecap="round"/>`);
}
function washer() {
  const w = id('w'), b = id('b'), g = id('g');
  return svg(`<defs>${lin(w, [[0, '#d8c6b0'], [1, '#b49a7c']], 1, 0)}${lin(b, [[0, '#4b4e55'], [0.5, '#1a1b1e'], [1, '#33363c']])}${lin(g, [[0, '#ffe0b0', 0], [1, '#ffe0b0', 0.85]])}</defs>
    <rect x="0" y="0" width="200" height="200" fill="url(#${w})"/>${[20, 48, 76, 104, 132, 160, 188].map(x => `<rect x="${x}" y="0" width="2" height="200" fill="#000" opacity=".08"/>`).join('')}
    <rect x="0" y="0" width="200" height="168" fill="url(#${g})"/><rect x="10" y="166" width="180" height="16" rx="3" fill="url(#${b})"/><rect x="14" y="166" width="172" height="3" rx="1.5" fill="#fff6e0"/>`);
}

// ---------- MixPad panels ----------
function mixpadArt(model) {
  const f = id('f'), sc = id('s'), gl = id('g');
  const W = model === 'mini' ? 120 : model === '7' ? 168 : 176, H = model === 'mini' ? 120 : model === '7' ? 118 : 110, x = (200 - W) / 2, y = (200 - H) / 2;
  const tiles = model === 'mini' ? '' : [0, 1, 2, 3, 4, 5, 6, 7].slice(0, model === '7' ? 6 : 8).map(i => { const cols = model === '7' ? 3 : 4, tw = (W - 30 - (cols - 1) * 5) / cols, th = model === '7' ? 30 : 30; const cx = x + 15 + (i % cols) * (tw + 5), cy = y + 40 + Math.floor(i / cols) * (th + 6); return `<rect x="${cx}" y="${cy}" width="${tw}" height="${th}" rx="5" fill="${[0, 3, 5].includes(i) ? '#c9a25a' : '#ffffff'}" fill-opacity="${[0, 3, 5].includes(i) ? 0.9 : 0.1}"/><circle cx="${cx + 8}" cy="${cy + 9}" r="3.5" fill="#fff" opacity=".85"/><rect x="${cx + 5}" y="${cy + th - 10}" width="${tw * 0.55}" height="3" rx="1.5" fill="#fff" opacity=".7"/>`; }).join('');
  const mini = model === 'mini' ? `<text x="100" y="94" text-anchor="middle" font-family="system-ui,sans-serif" font-size="26" font-weight="300" fill="#fff">24°</text><text x="100" y="110" text-anchor="middle" font-family="system-ui,sans-serif" font-size="8" fill="#fff" opacity=".6">LIVING ROOM</text>
    ${[0, 1, 2].map(i => `<circle cx="${76 + i * 24}" cy="130" r="7" fill="#fff" fill-opacity="${i === 1 ? 0.85 : 0.18}"/>`).join('')}` : `<text x="${x + 15}" y="${y + 26}" font-family="system-ui,sans-serif" font-size="15" font-weight="300" fill="#fff">20:30</text><text x="${x + W - 15}" y="${y + 26}" text-anchor="end" font-family="system-ui,sans-serif" font-size="8" fill="#fff" opacity=".65">24° · 46%</text>`;
  return svg(`<defs>${lin(f, [[0, '#f4f5f7'], [0.5, '#c4c7cd'], [1, '#8e9199']], 1, 1)}${lin(sc, [[0, '#1a2233'], [1, '#05070b']], 1, 1)}${lin(gl, [[0, '#fff', 0.2], [0.45, '#fff', 0.03], [0.46, '#fff', 0], [1, '#fff', 0]], 1, 1)}</defs>
    ${shadow(104, y + H + 6, W * 0.55, 10, 0.3)}<rect x="${x - 4}" y="${y - 4}" width="${W + 8}" height="${H + 8}" rx="${model === 'mini' ? 14 : 12}" fill="url(#${f})"/>
    <rect x="${x}" y="${y}" width="${W}" height="${H}" rx="${model === 'mini' ? 11 : 9}" fill="#07080b"/><rect x="${x + 5}" y="${y + 5}" width="${W - 10}" height="${H - 10}" rx="6" fill="url(#${sc})"/>
    ${tiles}${mini}<rect x="${x}" y="${y}" width="${W}" height="${H}" rx="9" fill="url(#${gl})"/>`);
}

// ---------- smart locks ----------
// tall front view, also placed on the door in the photo; classes let the page light the keypad and the status ring
export function lockArt(model = 'face', opt = {}) {
  const b = id('b'), g = id('g'), h = id('h'), r = id('r'), cam = model === 'face';
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, '#'].map((k, i) => `<text x="${24 + (i % 3) * 22}" y="${cam ? 104 + Math.floor(i / 3) * 30 : 82 + Math.floor(i / 3) * 34}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="15">${k}</text>`).join('');
  return `<svg class="lockart ${opt.cls || ''}" direction="ltr" viewBox="0 0 120 420" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>${lin(b, [[0, '#4a4d54'], [0.1, '#2a2c31'], [0.5, '#1a1b1f'], [0.9, '#2b2d32'], [1, '#55585f']], 1, 0)}${lin(g, [[0, '#14161b'], [0.5, '#07080a'], [1, '#101216']], 1, 1)}
    ${lin(h, [[0, '#e7e9ed'], [0.35, '#a6a9b0'], [0.6, '#6d7078'], [1, '#c8cbd1']], 0, 1)}${rad(r, [[0, '#d9dce1'], [0.7, '#8d9098'], [1, '#55585f']])}</defs>
    <rect x="8" y="10" width="80" height="404" rx="12" fill="#000" opacity=".35" transform="translate(3 4)"/>
    <rect x="6" y="6" width="80" height="404" rx="12" fill="url(#${b})"/><rect x="6.5" y="6.5" width="79" height="403" rx="11.5" fill="none" stroke="#8a8d94" stroke-opacity=".5"/>
    <rect x="13" y="16" width="66" height="238" rx="7" fill="url(#${g})"/>
    ${cam ? `<rect x="27" y="26" width="38" height="18" rx="9" fill="#020203"/><circle cx="36" cy="35" r="5" fill="#141a2c"/><circle cx="36" cy="35" r="2.2" fill="#3c5aa8"/><circle cx="50" cy="35" r="3" fill="#2a0d10"/><circle cx="58" cy="35" r="4" fill="#141a2c"/><circle cx="58" cy="35" r="1.6" fill="#7b8fd6"/>
      <circle class="lk-camled" cx="46" cy="53" r="1.6" fill="#3b3e45"/>` : ''}
    <g class="lk-keys" fill="#fff" fill-opacity=".14">${keys}</g>
    <rect class="lk-ring" x="25" y="${cam ? 228 : 236}" width="42" height="4" rx="2" fill="#3a3d44"/>
    <path d="M13 16 L79 16 L79 70 L13 140 Z" fill="#fff" opacity=".05"/>
    <circle cx="46" cy="300" r="23" fill="url(#${r})"/><circle cx="46" cy="300" r="23" fill="none" stroke="#000" stroke-opacity=".3"/>
    <rect x="44" y="290" width="72" height="20" rx="10" fill="url(#${h})"/><rect x="44" y="290" width="72" height="5" rx="2.5" fill="#fff" opacity=".45"/>
    <circle class="lk-fp" cx="46" cy="300" r="10" fill="#0d0e11" stroke="#9ea1a8" stroke-width="1.4"/>
    ${[3, 5.5, 8].map(rr => `<circle cx="46" cy="300" r="${rr}" fill="none" stroke="#5b5e66" stroke-width=".6"/>`).join('')}
    <rect x="34" y="350" width="24" height="34" rx="5" fill="#111216" stroke="#3a3d44"/><rect x="43" y="358" width="6" height="16" rx="3" fill="#2a2c31"/>
  </svg>`;
}
function lockThumb(model) { return svg(`${shadow(100, 190, 40, 6, 0.25)}<g transform="translate(66 6) scale(.45)">${lockArt(model).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g>`); }

// ---------- curtains, climate, app ----------
function curtainMotor() {
  const m = id('m'), t = id('t'), c = id('c');
  return svg(`<defs>${lin(m, [[0, '#ffffff'], [0.5, '#e4e6ea'], [1, '#b5b8bf']])}${lin(t, [[0, '#e9eaed'], [1, '#a9acb3']])}${lin(c, [[0, '#8b7d70'], [0.5, '#b2a395'], [1, '#7e7064']], 1, 0)}</defs>
    <rect x="10" y="40" width="180" height="12" rx="3" fill="url(#${t})"/><rect x="128" y="18" width="62" height="34" rx="14" fill="url(#${m})"/><circle cx="176" cy="35" r="3" fill="#7fd1ff"/><rect x="134" y="22" width="40" height="4" rx="2" fill="#fff" opacity=".9"/>
    <g>${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${18 + i * 14}" y="52" width="14" height="140" fill="url(#${c})"/>`).join('')}</g>
    <rect x="18" y="52" width="112" height="140" fill="#000" opacity=".05"/>${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<circle cx="${25 + i * 14}" cy="49" r="3" fill="#cfd1d6"/>`).join('')}`);
}
function acPanel() {
  const f = id('f'), s = id('s');
  return svg(`<defs>${lin(f, [[0, '#ffffff'], [1, '#c9ccd2']], 1, 1)}${lin(s, [[0, '#182030'], [1, '#06080c']], 1, 1)}</defs>${shadow(104, 172, 70, 8, 0.3)}
    <rect x="34" y="34" width="132" height="132" rx="14" fill="url(#${f})"/><rect x="42" y="42" width="116" height="116" rx="9" fill="url(#${s})"/>
    <text x="100" y="108" text-anchor="middle" font-family="system-ui,sans-serif" font-size="38" font-weight="200" fill="#fff">24°</text>
    <text x="100" y="126" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" fill="#8fd0ff">COOL · AUTO</text>
    ${[0, 1, 2, 3].map(i => `<circle cx="${70 + i * 20}" cy="142" r="4" fill="#fff" fill-opacity="${i === 0 ? 0.9 : 0.25}"/>`).join('')}<path d="M42 42 L158 42 L158 70 L42 120 Z" fill="#fff" opacity=".05"/>`);
}
function irRemote() {
  const b = id('b'), t = id('t');
  return svg(`<defs>${lin(b, [[0, '#3a3d44'], [0.5, '#121316'], [1, '#050506']], 1, 0)}${rad(t, [[0, '#4a4d55'], [1, '#0a0b0d']], 0.4, 0.3)}</defs>${shadow(100, 158, 64, 10, 0.32)}
    <path d="M44 92 L44 140 C 44 156 156 156 156 140 L156 92 Z" fill="url(#${b})"/><ellipse cx="100" cy="92" rx="56" ry="15" fill="url(#${t})"/>
    <ellipse cx="100" cy="132" rx="54" ry="6" fill="none" stroke="#7fd1ff" stroke-opacity=".5" stroke-width="1.5"/><ellipse cx="86" cy="88" rx="20" ry="4" fill="#fff" opacity=".12"/>`);
}
function phoneApp() {
  const f = id('f');
  return svg(`<defs>${lin(f, [[0, '#2b2d33'], [1, '#0d0e11']], 1, 1)}</defs>${shadow(104, 190, 50, 7, 0.28)}<rect x="58" y="12" width="88" height="176" rx="16" fill="url(#${f})"/><rect x="62" y="16" width="80" height="168" rx="12" fill="#0f1420"/>
    <rect x="86" y="20" width="32" height="7" rx="3.5" fill="#000"/><text x="70" y="46" font-family="system-ui,sans-serif" font-size="9" font-weight="600" fill="#fff">My home</text>
    ${[0, 1, 2, 3, 4, 5].map(i => `<rect x="${68 + (i % 2) * 36}" y="${56 + Math.floor(i / 2) * 38}" width="32" height="32" rx="7" fill="${i === 0 || i === 3 ? '#c9a25a' : '#fff'}" fill-opacity="${i === 0 || i === 3 ? 0.9 : 0.1}"/>`).join('')}`);
}
function glassSwitch() {
  const f = id('f'), g = id('g');
  return svg(`<defs>${lin(f, [[0, '#2b2e34'], [1, '#0c0d10']], 1, 1)}${lin(g, [[0, '#fff', 0.18], [0.5, '#fff', 0.02], [0.51, '#fff', 0], [1, '#fff', 0]], 1, 1)}</defs>${shadow(104, 176, 74, 8, 0.3)}
    <rect x="28" y="28" width="144" height="144" rx="12" fill="#b9a27a"/><rect x="31" y="31" width="138" height="138" rx="10" fill="url(#${f})"/>
    ${[0, 1, 2].map(i => `<rect x="${36 + i * 44.5}" y="36" width="40" height="128" rx="5" fill="#fff" fill-opacity=".03" stroke="#fff" stroke-opacity=".06"/><circle cx="${56 + i * 44.5}" cy="150" r="2.4" fill="${i === 1 ? '#ffd27a' : '#7fd1ff'}"/>`).join('')}
    <rect x="31" y="31" width="138" height="138" rx="10" fill="url(#${g})"/>`);
}
function presence() {
  const b = id('b'), w = id('w');
  return svg(`<defs>${rad(b, [[0, '#ffffff'], [0.8, '#e6e8ec'], [1, '#b8bbc2']], 0.4, 0.35)}${rad(w, [[0, '#2b3242'], [1, '#0b0d12']], 0.4, 0.35)}</defs>${shadow(100, 150, 70, 12, 0.25)}
    <ellipse cx="100" cy="112" rx="72" ry="34" fill="#d8dade"/><ellipse cx="100" cy="104" rx="72" ry="34" fill="url(#${b})"/><ellipse cx="100" cy="100" rx="30" ry="14" fill="url(#${w})"/><ellipse cx="92" cy="96" rx="10" ry="3.5" fill="#fff" opacity=".3"/>`);
}
function thermo() {
  const b = id('b');
  return svg(`<defs>${lin(b, [[0, '#ffffff'], [1, '#d5d8dd']], 1, 1)}</defs>${shadow(104, 162, 56, 7, 0.28)}<rect x="48" y="48" width="104" height="104" rx="18" fill="url(#${b})"/><rect x="58" y="58" width="84" height="66" rx="5" fill="#dfe3d8"/>
    <text x="100" y="92" text-anchor="middle" font-family="system-ui,sans-serif" font-size="24" fill="#2b2f36">24.5°</text><text x="100" y="114" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="#2b2f36">48%</text>`);
}
function contact() {
  const b = id('b');
  return svg(`<defs>${lin(b, [[0, '#ffffff'], [1, '#cfd2d8']], 1, 1)}</defs>${shadow(100, 156, 70, 7, 0.25)}<rect x="40" y="48" width="70" height="102" rx="12" fill="url(#${b})"/><rect x="120" y="66" width="40" height="84" rx="10" fill="url(#${b})"/><circle cx="75" cy="66" r="3" fill="#7fd1ff"/>`);
}
function smoke() {
  const b = id('b');
  return svg(`<defs>${rad(b, [[0, '#ffffff'], [0.85, '#e2e4e8'], [1, '#b5b8bf']], 0.4, 0.35)}</defs>${shadow(104, 108, 84, 84, 0.2)}<circle cx="100" cy="100" r="76" fill="url(#${b})"/><circle cx="100" cy="100" r="50" fill="none" stroke="#c4c7cd" stroke-width="2"/>
    ${Array.from({ length: 24 }, (_, i) => { const a = i / 24 * Math.PI * 2; return `<rect x="-1.5" y="-7" width="3" height="14" rx="1.5" fill="#b0b3ba" transform="translate(${100 + Math.cos(a) * 62} ${100 + Math.sin(a) * 62}) rotate(${a * 180 / Math.PI + 90})"/>`; }).join('')}<circle cx="100" cy="100" r="12" fill="#eceef1" stroke="#c4c7cd"/><circle cx="100" cy="100" r="3" fill="#62d26f"/>`);
}
function camera() {
  const b = id('b'), l = id('l');
  return svg(`<defs>${lin(b, [[0, '#ffffff'], [1, '#cdd0d6']], 1, 1)}${rad(l, [[0, '#3a5490'], [0.4, '#0d1220'], [1, '#000']], 0.4, 0.35)}</defs>${shadow(100, 178, 52, 8, 0.28)}
    <rect x="80" y="140" width="40" height="34" rx="6" fill="#e9ebee"/><ellipse cx="100" cy="174" rx="44" ry="8" fill="#dfe1e5"/>
    <rect x="52" y="34" width="96" height="104" rx="26" fill="url(#${b})"/><rect x="62" y="48" width="76" height="70" rx="20" fill="#0d0e11"/><circle cx="100" cy="83" r="20" fill="url(#${l})"/><circle cx="93" cy="77" r="5" fill="#fff" opacity=".25"/><circle cx="124" cy="60" r="2.5" fill="#62d26f"/>`);
}
function sos() {
  const b = id('b'), r = id('r');
  return svg(`<defs>${rad(b, [[0, '#ffffff'], [1, '#c9ccd2']], 0.4, 0.35)}${rad(r, [[0, '#ff6b5e'], [1, '#c4262e']], 0.4, 0.35)}</defs>${shadow(104, 112, 76, 76, 0.22)}<circle cx="100" cy="100" r="68" fill="url(#${b})"/><circle cx="100" cy="100" r="40" fill="url(#${r})"/>
    <text x="100" y="108" text-anchor="middle" font-family="system-ui,sans-serif" font-size="22" font-weight="700" fill="#fff">SOS</text>`);
}

const ART = {
  down: downlight, spot, strip, track, pendant, washer,
  'mixpad-x': () => mixpadArt('x'), 'mixpad-7': () => mixpadArt('7'), 'mixpad-mini': () => mixpadArt('mini'),
  'lock-face': () => lockThumb('face'), 'lock-finger': () => lockThumb('finger'),
  curtain: curtainMotor, ac: acPanel, ir: irRemote, app: phoneApp,
  switch: glassSwitch, presence, thermo, contact, flame: smoke, camera, sos,
};
export const ART_NAMES = Object.keys(ART);
// which drawing suits a product
export function artKey(p) {
  if (!p) return null;
  if (p.art && ART[p.art]) return p.art;
  if (p.cat === 'lighting') return ART[p.fixture] ? p.fixture : 'down';
  if (p.cat === 'mixpad') return 'mixpad-' + (['x', '7', 'mini'].includes(p.model) ? p.model : 'x');
  if (p.cat === 'lock') return 'lock-' + (p.model === 'finger' ? 'finger' : 'face');
  if (p.cat === 'curtain') return 'curtain';
  if (p.cat === 'climate') return p.model === 'ir' || p.id === 'p_ir' ? 'ir' : 'ac';
  if (p.cat === 'remote') return 'app';
  return ART[p.icon] ? p.icon : null;
}
export const deviceArt = key => (ART[key] ? ART[key]() : '');
