// Illustrated scenes that react to the controls: a living room (every light type, curtains, TV, AC)
// and a front door with the smart lock. Drawn in SVG so they stay sharp on every screen.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let UID = 0;
export function kelvin(k) {
  k /= 100; let r, g, b;
  if (k <= 66) { r = 255; g = 99.47 * Math.log(k) - 161.12; b = k <= 19 ? 0 : 138.52 * Math.log(k - 10) - 305.04; } else { r = 329.7 * Math.pow(k - 60, -0.1332); g = 288.12 * Math.pow(k - 60, -0.0755); b = 255; }
  return `rgb(${clamp(r, 0, 255) | 0},${clamp(g, 0, 255) | 0},${clamp(b, 0, 255) | 0})`;
}
const sunAt = t => clamp(Math.sin((t - 6) / 12.6 * Math.PI) * 3.2 + 0.1, 0, 1);

// ---------- one shared animation clock: scenes only animate while they are on screen ----------
const live = new Set(); let raf = 0, last = 0;
const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { e.target.__scene && (e.target.__scene.visible = e.isIntersecting); if (e.isIntersecting) wake(); }), { rootMargin: '120px' }) : null;
function wake() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; let busy = false;
  for (const s of live) if (s.visible) busy = s.tick(dt, now / 1000) || busy;
  raf = busy ? requestAnimationFrame(loop) : 0;
}
function register(el, scene) { scene.visible = !io; el.__scene = scene; live.add(scene); io ? io.observe(el) : wake(); }

// ---------- light fixtures: geometry of the fixture and of the light it throws ----------
// shapes: [tag, attrs, gradient ('r' radial, 'd' fades downwards, 'u' fades upwards), strength]
const FIX = {
  down: { rgb: false, shapes: [250, 400, 550].flatMap(x => [['polygon', { points: `${x - 10},44 ${x + 10},44 ${x + 100},452 ${x - 100},452` }, 'd', 0.5], ['ellipse', { cx: x, cy: 448, rx: 112, ry: 28 }, 'r', 0.95], ['ellipse', { cx: x, cy: 150, rx: 52, ry: 100 }, 'r', 0.35]]),
    draw: () => [250, 400, 550].map(x => `<ellipse cx="${x}" cy="40" rx="15" ry="5" class="fx-trim"/><ellipse cx="${x}" cy="41" rx="10" ry="3" class="fx-lens"/>`).join('') },
  spot: { rgb: false, shapes: [['polygon', { points: '650,38 662,38 698,200 572,200' }, 'd', 0.35], ['ellipse', { cx: 635, cy: 196, rx: 64, ry: 60 }, 'r', 1]],
    draw: () => `<rect x="645" y="22" width="22" height="6" rx="2" class="fx-body"/><path d="M650 28 L662 28 L664 40 L648 40 Z" class="fx-body"/><ellipse cx="656" cy="40" rx="7" ry="2.4" class="fx-lens"/>` },
  strip: { rgb: true, shapes: [['rect', { x: 100, y: 70, width: 600, height: 170 }, 'd', 0.9], ['polygon', { points: '100,70 700,70 660,44 140,44' }, 'u', 0.6]],
    draw: () => `<rect x="100" y="68" width="600" height="4" rx="2" class="fx-lens"/>` },
  track: { rgb: false, shapes: [280, 360, 440, 520].flatMap(x => [['polygon', { points: `${x - 6},60 ${x + 6},60 ${x + 40},250 ${x - 40},250` }, 'd', 0.32], ['ellipse', { cx: x, cy: 232, rx: 38, ry: 64 }, 'r', 0.85]]),
    draw: () => `<rect x="236" y="50" width="328" height="5" rx="2.5" class="fx-body"/>` + [280, 360, 440, 520].map(x => `<rect x="${x - 5}" y="54" width="10" height="9" rx="2" class="fx-body"/><ellipse cx="${x}" cy="63" rx="5" ry="1.8" class="fx-lens"/>`).join('') },
  pendant: { rgb: false, shapes: [['circle', { cx: 200, cy: 284, r: 100 }, 'r', 0.75], ['ellipse', { cx: 200, cy: 462, rx: 90, ry: 19 }, 'r', 0.75], ['polygon', { points: '166,292 234,292 292,462 108,462' }, 'd', 0.32]],
    draw: () => `<line x1="200" y1="0" x2="200" y2="262" class="fx-cord"/><path d="M180 262 L220 262 L240 293 L160 293 Z" class="fx-body"/><ellipse cx="200" cy="293" rx="40" ry="5" class="fx-lens"/>` },
  washer: { rgb: true, shapes: [['rect', { x: 338, y: 140, width: 214, height: 238 }, 'u', 0.85], ['ellipse', { cx: 445, cy: 386, rx: 130, ry: 12 }, 'r', 0.4]],
    draw: () => `<rect x="338" y="373" width="214" height="5" rx="2" class="fx-lens"/>` },
};
export const FIXTURES = Object.keys(FIX);
export const fixtureHasColour = f => !!FIX[f]?.rgb;

// ---------- TV programmes (animated while the TV is on) ----------
const TV = { x: 352, y: 190, w: 186, h: 105 };
const CHANNELS = [
  { ar: 'طبيعة', en: 'Nature', glow: '#ffb070' }, { ar: 'رياضة', en: 'Sports', glow: '#58d68d' }, { ar: 'أخبار', en: 'News', glow: '#5a8dff' },
  { ar: 'أفلام', en: 'Movies', glow: '#b07dff' }, { ar: 'كاميرا الباب', en: 'Door camera', glow: '#9fd3ff' },
];
export const TV_CHANNELS = CHANNELS;
function tvMarkup(p) {
  const { x, y, w, h } = TV;
  return `<g clip-path="url(#${p}tvclip)">
    <g data-ch="0"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${p}tvsky)"/><circle data-sun cx="${x + 140}" cy="${y + 40}" r="14" fill="#fff1c2"/>
      <path data-hill1 d="M${x - 40} ${y + 80} Q ${x + 30} ${y + 50} ${x + 90} ${y + 78} T ${x + 230} ${y + 70} L ${x + 260} ${y + h} L ${x - 40} ${y + h} Z" fill="#5d4a7a"/>
      <path data-hill2 d="M${x - 40} ${y + 92} Q ${x + 50} ${y + 70} ${x + 120} ${y + 92} T ${x + 260} ${y + 88} L ${x + 260} ${y + h} L ${x - 40} ${y + h} Z" fill="#33284a"/></g>
    <g data-ch="1"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#2f8f4a"/><rect x="${x + 8}" y="${y + 8}" width="${w - 16}" height="${h - 16}" fill="none" stroke="#e9f5ec" stroke-width="1.5"/><line x1="${x + w / 2}" y1="${y + 8}" x2="${x + w / 2}" y2="${y + h - 8}" stroke="#e9f5ec" stroke-width="1.5"/><circle cx="${x + w / 2}" cy="${y + h / 2}" r="14" fill="none" stroke="#e9f5ec" stroke-width="1.5"/>
      ${[0, 1, 2, 3, 4, 5].map(i => `<circle data-pl="${i}" r="3.4" fill="${i % 2 ? '#ff5a5a' : '#4f8dff'}"/>`).join('')}<circle data-ball r="2.4" fill="#fff"/><rect x="${x + 6}" y="${y + 6}" width="54" height="13" rx="2" fill="rgba(0,0,0,.55)"/><text x="${x + 10}" y="${y + 16}" font-size="9" fill="#fff" font-family="sans-serif">2 – 1</text></g>
    <g data-ch="2"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#183a6b"/><rect x="${x}" y="${y}" width="${w}" height="${h * 0.72}" fill="#24508f"/><circle cx="${x + 56}" cy="${y + 40}" r="13" fill="#e8c4a4"/><rect x="${x + 36}" y="${y + 53}" width="40" height="23" rx="6" fill="#20252f"/><rect x="${x + 96}" y="${y + 22}" width="76" height="8" rx="2" fill="#e9eef7"/><rect x="${x + 96}" y="${y + 36}" width="58" height="6" rx="2" fill="#a9b9d4"/>
      <rect x="${x}" y="${y + h - 18}" width="${w}" height="18" fill="#c4262e"/><text data-ticker x="${x}" y="${y + h - 5.5}" font-size="10" fill="#fff" font-family="sans-serif">DIGITAL HOME · ORVIBO SMART LIVING · WEATHER: CLEAR TONIGHT · DIGITAL HOME · ORVIBO SMART LIVING ·</text></g>
    <g data-ch="3"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#090b14"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => `<circle data-bk="${i}" r="${6 + (i % 4) * 4}" fill="hsl(${(i * 47) % 360} 85% 62%)" opacity=".45"/>`).join('')}<rect x="${x}" y="${y}" width="${w}" height="14" fill="#000"/><rect x="${x}" y="${y + h - 14}" width="${w}" height="14" fill="#000"/></g>
    <g data-ch="4"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#1c2330"/><path d="M${x} ${y + h} L${x + 60} ${y + 30} L${x + 126} ${y + 30} L${x + w} ${y + h} Z" fill="#2b3444"/><rect x="${x + 76}" y="${y + 24}" width="34" height="58" fill="#5a4330"/><circle cx="${x + 104}" cy="${y + 56}" r="1.6" fill="#c9a25a"/>
      <g data-guest opacity="0"><circle cx="${x + 70}" cy="${y + 52}" r="8" fill="#e0b48f"/><rect x="${x + 60}" y="${y + 60}" width="20" height="40" rx="6" fill="#c8452c"/></g>
      <text x="${x + 6}" y="${y + 12}" font-size="8" fill="#fff" font-family="monospace">CAM · ENTRANCE</text><circle data-rec cx="${x + w - 12}" cy="${y + 9}" r="3" fill="#ff4d4d"/></g>
  </g>`;
}

// ============================================================================================
//  ROOM
// ============================================================================================
export function makeRoom(host, opts = {}) {
  const p = 'r' + (++UID) + '-';
  const st = {
    time: 20.5, solo: null,
    down: { on: false, bri: 80, cct: 3000 }, spot: { on: false, bri: 85, cct: 3500 }, strip: { on: false, bri: 70, cct: 3000, rgb: null },
    track: { on: false, bri: 75, cct: 4000 }, pendant: { on: false, bri: 70, cct: 2700 }, washer: { on: false, bri: 70, cct: 3000, rgb: null },
    curtain: 0, sheer: 0, tv: { on: false, ch: 0, vol: 20 }, ac: { on: false, mode: 'cool', set: 24, fan: 2, swing: false }, temp: 28.5,
    ...(opts.state || {}),
  };
  const cur = { curtain: st.curtain, sheer: st.sheer };
  const grad = (id, kind) => kind === 'r'
    ? `<radialGradient id="${p}${id}"><stop offset="0" stop-opacity="1"/><stop offset=".45" stop-opacity=".55"/><stop offset="1" stop-opacity="0"/></radialGradient>`
    : `<linearGradient id="${p}${id}" x1="0" y1="${kind === 'd' ? 0 : 1}" x2="0" y2="${kind === 'd' ? 1 : 0}"><stop offset="0" stop-opacity=".95"/><stop offset="1" stop-opacity="0"/></linearGradient>`;
  const fixGrads = FIXTURES.map(f => ['r', 'd', 'u'].map(k => grad(f + k, k)).join('')).join('');
  const cutGrads = ['r', 'd', 'u'].map(k => grad('cut' + k, k)).join('');
  const shapes = (f, cut) => FIX[f].shapes.map(([tag, a, g, k]) => `<${tag} ${Object.entries(a).map(([n, v]) => `${n}="${v}"`).join(' ')} fill="url(#${p}${cut ? 'cut' + g : f + g})" data-k="${k}"/>`).join('');
  const planks = Array.from({ length: 13 }, (_, i) => { const xb = 100 + i * 50; return `<line x1="${xb}" y1="380" x2="${(xb - 400) * 1.333 + 400}" y2="500"/>`; }).join('');
  const slats = Array.from({ length: 21 }, (_, i) => `<rect x="${336 + i * 10.4}" y="76" width="6" height="302" rx="1"/>`).join('');
  const city = Array.from({ length: 9 }, (_, i) => { const bx = 122 + i * 20, bh = 40 + ((i * 37) % 70); return `<rect x="${bx}" y="${330 - bh}" width="18" height="${bh}" fill="#141a26"/>` + Array.from({ length: Math.floor(bh / 12) }, (_, j) => (i + j) % 3 ? `<rect x="${bx + 4 + (j % 2) * 6}" y="${334 - bh + j * 12}" width="3.5" height="4" class="${p}cw" fill="#ffd78a"/>` : '').join(''); }).join('');
  host.innerHTML = `<svg class="scene" viewBox="0 0 800 500" role="img" aria-label="${opts.label || 'room'}">
  <defs>
    ${fixGrads}${cutGrads}
    <linearGradient id="${p}wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ece6dc"/><stop offset="1" stop-color="#dcd3c5"/></linearGradient>
    <linearGradient id="${p}side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c9c0b2"/><stop offset="1" stop-color="#ddd5c8"/></linearGradient>
    <linearGradient id="${p}floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b68b5e"/><stop offset="1" stop-color="#946a44"/></linearGradient>
    <linearGradient id="${p}sky" x1="0" y1="0" x2="0" y2="1"><stop data-sky0 offset="0" stop-color="#0b1022"/><stop data-sky1 offset="1" stop-color="#25335a"/></linearGradient>
    <linearGradient id="${p}tvsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb46b"/><stop offset=".7" stop-color="#e2677a"/><stop offset="1" stop-color="#3b2a4a"/></linearGradient>
    <linearGradient id="${p}beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1cf" stop-opacity=".7"/><stop offset="1" stop-color="#fff1cf" stop-opacity="0"/></linearGradient>
    <pattern id="${p}pleat" width="14" height="10" patternUnits="userSpaceOnUse"><rect width="14" height="10" fill="#cdbb9f"/><rect width="5" height="10" fill="#b9a585"/><rect x="9" width="2" height="10" fill="#dccbb1"/></pattern>
    <clipPath id="${p}tvclip"><rect x="${TV.x}" y="${TV.y}" width="${TV.w}" height="${TV.h}" rx="2"/></clipPath>
    <clipPath id="${p}win"><rect x="120" y="125" width="180" height="205"/></clipPath>
    <mask id="${p}dark" maskUnits="userSpaceOnUse" x="0" y="0" width="800" height="500"><rect width="800" height="500" fill="#fff"/><rect x="120" y="125" width="180" height="205" fill="#000"/><rect x="${TV.x}" y="${TV.y}" width="${TV.w}" height="${TV.h}" fill="#000"/>
      ${FIXTURES.map(f => `<g data-cut="${f}" style="opacity:0">${shapes(f, true)}</g>`).join('')}<g data-cut="tv" style="opacity:0"><ellipse cx="445" cy="260" rx="200" ry="150" fill="url(#${p}cutr)"/></g></mask>
  </defs>
  <!-- outside, seen through the window -->
  <g clip-path="url(#${p}win)"><rect x="120" y="125" width="180" height="205" fill="url(#${p}sky)"/><circle data-sunc cx="250" cy="170" r="16" fill="#fff4cf"/>${city}</g>
  <!-- the room -->
  <polygon points="0,0 800,0 700,70 100,70" fill="#f1ece4"/>
  <polygon points="0,0 100,70 100,380 0,500" fill="url(#${p}side)"/><polygon points="800,0 700,70 700,380 800,500" fill="url(#${p}side)"/>
  <path d="M100 70 H700 V380 H100 Z M120 125 V330 H300 V125 Z" fill="url(#${p}wall)" fill-rule="evenodd"/>
  <polygon points="100,380 700,380 800,500 0,500" fill="url(#${p}floor)"/><g stroke="#7c5636" stroke-opacity=".35" stroke-width="1">${planks}</g>
  <rect x="330" y="72" width="230" height="308" fill="#6b4b33"/><g fill="#86613f">${slats}</g>
  <rect x="114" y="119" width="192" height="217" fill="none" stroke="#3a3f47" stroke-width="6"/><line x1="210" y1="125" x2="210" y2="330" stroke="#3a3f47" stroke-width="4"/>
  <rect x="582" y="140" width="106" height="110" fill="#2a2d33"/><rect x="588" y="146" width="94" height="98" fill="#efe6d6"/><circle cx="618" cy="190" r="24" fill="#c8693d"/><rect x="630" y="200" width="44" height="34" fill="#4a6b5f"/><path d="M596 230 Q 630 172 676 214" fill="none" stroke="#c9a25a" stroke-width="3"/>
  <ellipse cx="440" cy="452" rx="250" ry="40" fill="#cbbfae"/>
  <rect x="340" y="330" width="210" height="42" rx="3" fill="#2f3237"/><rect x="340" y="330" width="210" height="4" fill="#b89a6e"/>
  <g data-hot="tv" style="cursor:pointer"><rect x="${TV.x - 4}" y="${TV.y - 4}" width="${TV.w + 8}" height="${TV.h + 8}" rx="3" fill="#0e1014"/></g>
  <ellipse cx="450" cy="447" rx="88" ry="18" fill="#3a2a1e"/><ellipse cx="450" cy="441" rx="88" ry="16" fill="#e8e1d6"/><rect x="438" y="456" width="24" height="26" fill="#3a2a1e"/>
  <path d="M60 500 L60 410 Q60 386 90 386 L250 386 Q280 386 280 410 L280 500 Z" fill="#7d8f7a"/><path d="M76 500 L76 432 Q76 418 96 418 L244 418 Q264 418 264 432 L264 500 Z" fill="#8fa38b"/>
  <ellipse cx="672" cy="372" rx="22" ry="7" fill="#3c3530"/><path d="M652 372 L656 340 L688 340 L692 372 Z" fill="#d9d2c6"/>
  <g fill="#4e7a4c"><ellipse cx="660" cy="300" rx="12" ry="38" transform="rotate(-20 660 300)"/><ellipse cx="684" cy="296" rx="11" ry="40" transform="rotate(18 684 296)"/><ellipse cx="672" cy="286" rx="10" ry="46"/></g>
  <!-- AC unit above the window -->
  <g data-hot="ac" style="cursor:pointer"><rect x="140" y="78" width="138" height="34" rx="8" fill="#f4f5f6" stroke="#c9cdd2"/><rect x="146" y="104" width="126" height="3" fill="#dfe2e6"/>
    <path data-flap d="M148 112 L270 112" stroke="#b5bbc3" stroke-width="3" stroke-linecap="round"/></g>
  <!-- curtains -->
  <rect x="104" y="114" width="212" height="5" rx="2" fill="#2f3237"/>
  <g data-hot="curtain" style="cursor:pointer"><rect data-sheer x="120" y="119" width="0" height="216" fill="#fffaf0" opacity=".42"/><rect data-cl x="106" y="119" width="20" height="222" fill="url(#${p}pleat)"/><rect data-cr x="294" y="119" width="20" height="222" fill="url(#${p}pleat)"/></g>
  <!-- night: one dark layer; every light cuts a soft hole in it -->
  <rect data-darkness width="800" height="500" fill="#04060c" opacity="0" mask="url(#${p}dark)"/>
  <!-- light, added on top -->
  <g style="mix-blend-mode:screen" pointer-events="none">
    <polygon data-beam points="122,332 300,332 430,500 160,500" fill="url(#${p}beam)" opacity="0"/>
    ${FIXTURES.map(f => `<g data-glow="${f}" style="opacity:0">${shapes(f, false)}</g>`).join('')}
    <ellipse data-tvglow cx="445" cy="262" rx="210" ry="150" fill="url(#${p}tvglow)" style="opacity:0"/>
    <g data-air fill="none" stroke-width="3" stroke-linecap="round" stroke-dasharray="7 12" opacity="0">${[160, 190, 222, 254].map((x, i) => `<path d="M${x} 116 q ${(i - 1.5) * 6} 40 ${(i - 1.5) * 18} 90 t ${(i - 1.5) * 10} 70"/>`).join('')}</g>
  </g>
  <!-- emissive things stay bright at night -->
  ${tvMarkup(p)}<rect data-tvoff x="${TV.x}" y="${TV.y}" width="${TV.w}" height="${TV.h}" fill="#0b0d11"/><path d="M${TV.x} ${TV.y} L${TV.x + 60} ${TV.y} L${TV.x} ${TV.y + 60} Z" fill="#fff" opacity=".04"/>
  <text data-acdisp x="262" y="99" font-size="11" font-family="sans-serif" fill="#3aa0ff" text-anchor="end" opacity="0">24°</text><circle data-acled cx="150" cy="96" r="2.2" fill="#3aa0ff" opacity="0"/>
  ${FIXTURES.map(f => `<g data-fx="${f}" data-hot="${f}" style="cursor:pointer">${FIX[f].draw()}</g>`).join('')}
  <g data-ring fill="none" stroke="#c9a25a" stroke-width="2.5" stroke-dasharray="6 5" opacity="0"><rect rx="10"/></g>
</svg>`;
  const svg = host.querySelector('svg'), q = s => svg.querySelector(s);
  const el = {
    dark: q('[data-darkness]'), beam: q('[data-beam]'), tvoff: q('[data-tvoff]'), tvglow: q('[data-tvglow]'), air: q('[data-air]'), flap: q('[data-flap]'), acd: q('[data-acdisp]'), acled: q('[data-acled]'),
    cl: q('[data-cl]'), cr: q('[data-cr]'), sheer: q('[data-sheer]'), sky0: q('[data-sky0]'), sky1: q('[data-sky1]'), sun: q('[data-sunc]'), cw: svg.querySelectorAll('.' + p + 'cw'), ring: q('[data-ring]'), ringR: q('[data-ring] rect'), tvcut: q('[data-cut="tv"]'),
    ch: [...svg.querySelectorAll('[data-ch]')],
  };
  const fx = {}; for (const f of FIXTURES) fx[f] = { glow: q(`[data-glow="${f}"]`), cut: q(`[data-cut="${f}"]`), body: q(`[data-fx="${f}"]`), stops: [...svg.querySelectorAll(`#${p}${f}r stop, #${p}${f}d stop, #${p}${f}u stop`)] };
  if (opts.fixtures) for (const f of FIXTURES) if (!opts.fixtures.includes(f)) fx[f].body.style.display = 'none';
  svg.addEventListener('click', e => { const h = e.target.closest('[data-hot]'); if (h && opts.onHot) opts.onHot(h.dataset.hot); });

  function lightColor(L) { return L.rgb || kelvin(L.cct); }
  function apply() {
    const day = sunAt(st.time), dusk = clamp(1 - Math.abs(sunAt(st.time) - 0.25) / 0.25, 0, 1) * (st.time > 12 ? 1 : 0.6);
    // sky through the window
    const sky = day > 0.6 ? ['#6fb0ea', '#cfe7fb'] : dusk > 0.3 ? ['#f08a4b', '#7a5a8e'] : ['#0b1022', '#25335a'];
    el.sky0.setAttribute('stop-color', sky[0]); el.sky1.setAttribute('stop-color', sky[1]);
    el.sun.setAttribute('cy', 330 - day * 170); el.sun.setAttribute('fill', day > 0.25 ? '#fff4cf' : '#e9edf7'); el.sun.setAttribute('r', day > 0.25 ? 16 : 9);
    el.cw.forEach(w => w.setAttribute('opacity', (1 - day) * 0.9));
    const closed = cur.curtain / 100, inside = day * (1 - closed * 0.93) * (cur.sheer > 50 ? 0.75 : 1);
    el.dark.setAttribute('opacity', (0.88 * (1 - inside)).toFixed(3));
    el.beam.setAttribute('opacity', (day * (1 - closed) * (cur.sheer > 50 ? 0.45 : 1) * 0.8).toFixed(3));
    for (const f of FIXTURES) {
      const L = st[f], on = L.on && (!st.solo || st.solo === f) && (!opts.fixtures || opts.fixtures.includes(f)), k = on ? Math.pow(L.bri / 100, 0.8) : 0, c = lightColor(L);
      fx[f].glow.style.opacity = (k * 0.85).toFixed(3); fx[f].cut.style.opacity = k.toFixed(3);
      fx[f].stops.forEach(s => { s.style.stopColor = c; });
      fx[f].body.classList.toggle('lit', on); fx[f].body.style.setProperty('--lc', c);
    }
    // TV
    const tv = st.tv; el.tvoff.style.opacity = tv.on ? 0 : 1; el.tvglow.style.opacity = tv.on ? 0.3 : 0; el.tvcut.style.opacity = tv.on ? 0.55 : 0;
    el.ch.forEach(g => { g.style.display = tv.on && +g.dataset.ch === tv.ch ? '' : 'none'; });
    tvGlow.forEach(s => { s.style.stopColor = CHANNELS[tv.ch].glow; });
    // AC
    const ac = st.ac, col = { cool: '#6ec3ff', heat: '#ff9a5a', dry: '#6fe0c8', fan: '#e7ecf2' }[ac.mode];
    el.air.style.opacity = ac.on ? 0.9 : 0; el.air.setAttribute('stroke', col); el.air.style.setProperty('--spd', (1.6 - ac.fan * 0.35) + 's'); el.air.classList.toggle('flow', ac.on);
    el.flap.style.transform = ac.on ? 'rotate(14deg)' : 'rotate(0deg)'; el.flap.classList.toggle('swing', ac.on && ac.swing);
    el.acd.textContent = ac.set + '°'; el.acd.style.opacity = ac.on ? 1 : 0; el.acd.setAttribute('fill', col); el.acled.style.opacity = ac.on ? 1 : 0; el.acled.setAttribute('fill', col);
    // focus ring around the selected fixture
    const f = opts.focus && opts.focus(); if (f && fx[f]) { const b = fx[f].body.getBBox(); el.ringR.setAttribute('x', b.x - 10); el.ringR.setAttribute('y', b.y - 10); el.ringR.setAttribute('width', b.width + 20); el.ringR.setAttribute('height', b.height + 20); el.ring.style.opacity = 1; } else el.ring.style.opacity = 0;
  }
  // a glow gradient for the TV (coloured per channel)
  const defs = svg.querySelector('defs'); defs.insertAdjacentHTML('beforeend', `<radialGradient id="${p}tvglow"><stop offset="0" stop-opacity=".9"/><stop offset="1" stop-opacity="0"/></radialGradient>`);
  const tvGlow = [...svg.querySelectorAll(`#${p}tvglow stop`)];
  // per-frame: curtain motor, TV programmes
  const tvEl = { sun: q('[data-sun]'), h1: q('[data-hill1]'), h2: q('[data-hill2]'), pl: [...svg.querySelectorAll('[data-pl]')], ball: q('[data-ball]'), tick: q('[data-ticker]'), bk: [...svg.querySelectorAll('[data-bk]')], rec: q('[data-rec]'), guest: q('[data-guest]') };
  const scene = {
    tick(dt, t) {
      let busy = false;
      for (const k of ['curtain', 'sheer']) { const d = st[k] - cur[k]; if (Math.abs(d) > 0.05) { cur[k] += clamp(d, -dt * 28, dt * 28); busy = true; } else cur[k] = st[k]; }
      if (busy || cur.dirty) { cur.dirty = false; const w = 20 + (95 - 20) * (cur.curtain / 100); el.cl.setAttribute('width', w); el.cr.setAttribute('x', 314 - w); el.cr.setAttribute('width', w); el.sheer.setAttribute('width', 180 * (cur.sheer / 100)); apply(); }
      if (st.tv.on) {
        busy = true; const { x, y, w, h } = TV;
        if (st.tv.ch === 0) { tvEl.sun.setAttribute('cx', x + 30 + ((t * 8) % (w - 20))); tvEl.h1.setAttribute('transform', `translate(${-((t * 6) % 60)} 0)`); tvEl.h2.setAttribute('transform', `translate(${-((t * 12) % 80)} 0)`); }
        if (st.tv.ch === 1) { tvEl.pl.forEach((c, i) => { c.setAttribute('cx', x + w / 2 + Math.sin(t * 0.9 + i * 1.7) * 70); c.setAttribute('cy', y + h / 2 + Math.cos(t * 1.1 + i * 2.3) * 30); }); tvEl.ball.setAttribute('cx', x + w / 2 + Math.sin(t * 1.6) * 75); tvEl.ball.setAttribute('cy', y + h / 2 + Math.cos(t * 2.1) * 32); }
        if (st.tv.ch === 2) tvEl.tick.setAttribute('x', x + w - ((t * 40) % 600));
        if (st.tv.ch === 3) tvEl.bk.forEach((c, i) => { c.setAttribute('cx', x + ((i * 37 + t * (8 + i * 2)) % (w + 30)) - 15); c.setAttribute('cy', y + 20 + ((i * 29) % (h - 40)) + Math.sin(t + i) * 6); });
        if (st.tv.ch === 4) { tvEl.rec.setAttribute('opacity', Math.sin(t * 6) > 0 ? 1 : 0.2); tvEl.guest.setAttribute('opacity', opts.guest && opts.guest() ? 1 : 0); }
      }
      if (st.ac.on || opts.alwaysTick) busy = true;
      if (opts.onTick) opts.onTick(dt, st) && (busy = true);
      return busy;
    },
  };
  register(host, scene);
  const api = {
    st, svg,
    set(patch) { for (const k in patch) { if (patch[k] && typeof patch[k] === 'object' && !Array.isArray(patch[k]) && st[k] && typeof st[k] === 'object') Object.assign(st[k], patch[k]); else st[k] = patch[k]; } cur.dirty = true; apply(); wake(); },
    refresh() { cur.dirty = true; apply(); wake(); },
    pos() { return cur.curtain; },
    jump() { cur.curtain = st.curtain; cur.sheer = st.sheer; cur.dirty = true; scene.tick(0, 0); apply(); },
  };
  api.jump();
  return api;
}

// ============================================================================================
//  FRONT DOOR WITH THE SMART LOCK
// ============================================================================================
export function makeDoor(host, opts = {}) {
  const p = 'd' + (++UID) + '-';
  const st = { open: 0, target: 0, led: 'idle', face: true, guest: false, alarm: false };
  host.innerHTML = `<svg class="scene" viewBox="0 0 800 500" role="img" aria-label="${opts.label || 'door'}">
  <defs>
    <linearGradient id="${p}wall" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#cfc8bd"/><stop offset=".5" stop-color="#e3ddd3"/><stop offset="1" stop-color="#cfc8bd"/></linearGradient>
    <linearGradient id="${p}wood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5b4130"/><stop offset=".5" stop-color="#6e503b"/><stop offset="1" stop-color="#553c2c"/></linearGradient>
    <linearGradient id="${p}in" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe2b0"/><stop offset="1" stop-color="#c98a4d"/></linearGradient>
    <radialGradient id="${p}lamp"><stop offset="0" stop-color="#fff1d2" stop-opacity=".9"/><stop offset="1" stop-color="#fff1d2" stop-opacity="0"/></radialGradient>
    <radialGradient id="${p}glow"><stop offset="0" stop-color="#ffd59a" stop-opacity=".85"/><stop offset="1" stop-color="#ffd59a" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="800" height="420" fill="url(#${p}wall)"/><rect y="420" width="800" height="80" fill="#8c8780"/><g stroke="#77726b" stroke-width="1">${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<line x1="${i * 120 - 40}" y1="420" x2="${i * 160 - 160}" y2="500"/>`).join('')}</g>
  <circle cx="400" cy="30" r="170" fill="url(#${p}lamp)"/><ellipse cx="400" cy="12" rx="40" ry="6" fill="#f6efe2"/>
  <rect x="610" y="150" width="110" height="140" fill="#2a2d33"/><rect x="616" y="156" width="98" height="128" fill="#e8dfd0"/><path d="M626 270 L660 200 L690 250 L704 230 L710 270 Z" fill="#7d8f7a"/>
  <rect x="300" y="420" width="200" height="46" fill="#3a3632" rx="4"/>
  <!-- the opening and what is behind the door -->
  <rect x="300" y="70" width="200" height="350" fill="url(#${p}in)"/><rect x="420" y="250" width="70" height="170" fill="#7d8f7a" opacity=".6"/><ellipse cx="400" cy="70" rx="160" ry="110" fill="url(#${p}glow)" data-inlight opacity="0"/>
  <rect x="288" y="60" width="224" height="362" fill="none" stroke="#3b2c21" stroke-width="12"/>
  <g data-leaf style="transform-origin:300px 0">
    <rect x="300" y="70" width="200" height="350" fill="url(#${p}wood)"/>
    <rect x="320" y="92" width="160" height="140" rx="4" fill="none" stroke="#3f2d20" stroke-width="3" opacity=".6"/><rect x="320" y="252" width="160" height="148" rx="4" fill="none" stroke="#3f2d20" stroke-width="3" opacity=".6"/>
    <g data-lock>
      <rect x="452" y="180" width="38" height="150" rx="8" fill="#1d1e21"/><rect x="455" y="183" width="32" height="144" rx="6" fill="#2a2c31"/>
      <circle data-cam cx="471" cy="196" r="3.5" fill="#0d0e10" stroke="#555"/><circle data-camled cx="471" cy="196" r="1.4" fill="#4fd1ff"/>
      ${[0, 1, 2, 3].map(r => [0, 1, 2].map(c => `<rect data-key x="${460 + c * 8.6}" y="${210 + r * 11}" width="6" height="7" rx="1.5" fill="#3a3d44"/>`).join('')).join('')}
      <circle data-fp cx="471" cy="276" r="9" fill="#17181b" stroke="#3a3d44" stroke-width="2"/><circle data-fpring cx="471" cy="276" r="12" fill="none" stroke="#4fd1ff" stroke-width="2" opacity="0"/>
      <rect data-led x="462" y="300" width="18" height="3" rx="1.5" fill="#4fd1ff"/>
      <rect x="430" y="314" width="56" height="9" rx="4.5" fill="#c9a25a"/>
    </g>
  </g>
  <g data-visitor opacity="0" style="transition:opacity .5s"><circle cx="228" cy="250" r="24" fill="#e0b48f"/><path d="M190 420 L196 300 Q228 274 260 300 L266 420 Z" fill="#c8452c"/><rect x="236" y="330" width="46" height="38" rx="3" fill="#b58a56"/></g>
  <rect data-alarm width="800" height="500" fill="#ff2020" opacity="0" pointer-events="none"/>
</svg>`;
  const svg = host.querySelector('svg'), q = s => svg.querySelector(s);
  const el = { leaf: q('[data-leaf]'), inl: q('[data-inlight]'), keys: [...svg.querySelectorAll('[data-key]')], fpr: q('[data-fpring]'), led: q('[data-led]'), cam: q('[data-camled]'), visitor: q('[data-visitor]'), alarm: q('[data-alarm]'), camBody: q('[data-cam]') };
  let flash = 0, flashCol = '#4fd1ff', keyGlow = 0, scan = 0;
  const scene = {
    tick(dt, t) {
      let busy = false;
      const d = st.target - st.open; if (Math.abs(d) > 0.002) { st.open += clamp(d, -dt * 1.3, dt * 1.3); busy = true; } else st.open = st.target;
      const s = 1 - 0.78 * st.open, k = 0.1 * st.open;
      el.leaf.setAttribute('transform', `matrix(${s} ${k} 0 1 ${300 * (1 - s)} ${-300 * k})`); el.inl.setAttribute('opacity', st.open);
      flash = Math.max(0, flash - dt); keyGlow = Math.max(0, keyGlow - dt * 0.5); scan = Math.max(0, scan - dt);
      const ledCol = st.alarm ? (Math.sin(t * 10) > 0 ? '#ff3b3b' : '#4a1010') : flash > 0 ? flashCol : '#4fd1ff';
      el.led.setAttribute('fill', ledCol); el.keys.forEach(kk => kk.setAttribute('fill', keyGlow > 0 ? `rgba(79,209,255,${0.35 + keyGlow * 0.6})` : '#3a3d44'));
      el.fpr.setAttribute('opacity', scan > 0 ? 0.4 + 0.6 * Math.abs(Math.sin(t * 9)) : flash > 0 ? 1 : 0); el.fpr.setAttribute('stroke', flash > 0 ? flashCol : '#4fd1ff');
      el.cam.setAttribute('fill', st.face ? (scan > 0 ? '#ffffff' : '#4fd1ff') : '#333'); el.camBody.style.display = st.face ? '' : 'none'; el.cam.style.display = st.face ? '' : 'none';
      el.visitor.setAttribute('opacity', st.guest ? 1 : 0); el.alarm.setAttribute('opacity', st.alarm ? (Math.sin(t * 8) > 0 ? 0.18 : 0.02) : 0);
      return busy || flash > 0 || keyGlow > 0 || scan > 0 || st.alarm;
    },
  };
  register(host, scene);
  return {
    st,
    open(on) { st.target = on ? 1 : 0; wake(); },
    flash(col, secs = 1.4) { flashCol = col; flash = secs; wake(); },
    keys() { keyGlow = 1; wake(); },
    scan(secs = 0.9) { scan = secs; wake(); },
    set(patch) { Object.assign(st, patch); wake(); },
  };
}

// ============================================================================================
//  COLOUR QUALITY: the same still life under a high-Ra light and under an ordinary budget light
// ============================================================================================
export function makeCRI(host, opts = {}) {
  const p = 'c' + (++UID) + '-';
  const SW = ['#c4867a', '#b0925a', '#8fa046', '#6aa67a', '#5fa3a3', '#6b8fc4', '#8f7cbf', '#b27aa8', '#d1202f'];
  const rose = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><circle r="17" fill="#b5121f"/><circle r="12" fill="#d61f2c"/><path d="M-8 -2 Q 0 -14 8 -2 Q 0 6 -8 -2Z" fill="#8f0c18"/><circle r="4" fill="#a3101c"/></g>`;
  const life = `
    <rect width="800" height="300" fill="url(#${p}wall)"/><rect y="300" width="800" height="150" fill="url(#${p}wood)"/><rect y="298" width="800" height="6" fill="#5e4129"/>
    <rect x="318" y="34" width="164" height="190" fill="#2b2420"/><rect x="326" y="42" width="148" height="174" fill="#d7e3e8"/>
    <ellipse cx="400" cy="214" rx="64" ry="34" fill="#2a4a6a"/><ellipse cx="400" cy="128" rx="34" ry="44" fill="#e2a582"/><path d="M366 120 Q 368 78 400 76 Q 434 78 436 122 Q 424 96 400 96 Q 378 96 366 120Z" fill="#3b2418"/>
    <ellipse cx="388" cy="126" rx="4" ry="2.6" fill="#3b2418"/><ellipse cx="413" cy="126" rx="4" ry="2.6" fill="#3b2418"/><path d="M390 150 Q 400 157 411 150" stroke="#b5443f" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="378" cy="140" rx="6" ry="4" fill="#e98f7c" opacity=".55"/><ellipse cx="422" cy="140" rx="6" ry="4" fill="#e98f7c" opacity=".55"/>
    <path d="M60 450 L110 330 L330 330 L360 450 Z" fill="#1f8a8a"/><path d="M110 330 L330 330 L318 352 L120 352 Z" fill="#17716f"/>
    <path d="M150 330 Q 140 270 156 230 L196 230 Q 212 270 202 330 Z" fill="#f2f0ea"/><ellipse cx="176" cy="230" rx="20" ry="5" fill="#dedad1"/>
    <g fill="#2f7d32"><path d="M170 230 Q 140 190 120 196 Q 150 205 166 236Z"/><path d="M184 230 Q 214 186 236 190 Q 206 202 188 236Z"/><path d="M176 228 Q 176 170 164 140" stroke="#2f7d32" stroke-width="3" fill="none"/><path d="M178 228 Q 190 170 206 150" stroke="#2f7d32" stroke-width="3" fill="none"/><path d="M176 228 Q 160 186 136 168" stroke="#2f7d32" stroke-width="3" fill="none"/></g>
    ${rose(164, 136, 1.1)}${rose(206, 148)}${rose(136, 166, 0.9)}${rose(188, 112, 0.85)}
    <ellipse cx="470" cy="392" rx="120" ry="22" fill="#e9e3d8"/><path d="M350 360 Q 470 440 590 360 Z" fill="#f4f0e8"/><ellipse cx="470" cy="360" rx="120" ry="18" fill="#fbf8f2"/>
    <path d="M384 352 Q 420 300 470 312" stroke="#e8c12a" stroke-width="16" fill="none" stroke-linecap="round"/>
    <circle cx="430" cy="340" r="26" fill="#c3121c"/><path d="M430 316 q 4 -10 10 -12" stroke="#4a3020" stroke-width="3" fill="none"/><ellipse cx="420" cy="332" rx="7" ry="4" fill="#fff" opacity=".25"/>
    <circle cx="482" cy="336" r="24" fill="#f07b12"/><circle cx="526" cy="344" r="20" fill="#5fae2c"/><circle cx="462" cy="352" r="20" fill="#d8201f"/>
    ${[[548, 326], [560, 336], [572, 326], [554, 348], [566, 348], [560, 360], [578, 340]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#5b2a6e"/>`).join('')}
    <rect x="618" y="318" width="160" height="104" rx="6" fill="#fbfaf7" stroke="#d8d3c8"/>${SW.map((c, i) => `<rect x="${628 + (i % 5) * 29}" y="${328 + Math.floor(i / 5) * 46}" width="24" height="24" rx="3" fill="${c}"/><text x="${640 + (i % 5) * 29}" y="${364 + Math.floor(i / 5) * 46}" font-size="9" text-anchor="middle" fill="#5a5a5a" font-family="sans-serif">R${i + 1}</text>`).join('')}`;
  host.innerHTML = `<svg class="scene" viewBox="0 0 800 450" role="img" aria-label="${opts.label || 'colour comparison'}" style="touch-action:pan-y">
  <defs>
    <linearGradient id="${p}wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#efe9df"/><stop offset="1" stop-color="#ddd3c4"/></linearGradient>
    <linearGradient id="${p}wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a6a42"/><stop offset="1" stop-color="#6f4a2c"/></linearGradient>
    <radialGradient id="${p}lamp"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <!-- an ordinary LED: weak deep red, a green-blue cast, flatter colours -->
    <filter id="${p}cheap" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0.62"/><feColorMatrix type="matrix" values="0.80 0.15 0.05 0 0  0.09 0.87 0.05 0 0.01  0.05 0.13 0.86 0 0.03  0 0 0 1 0"/><feComponentTransfer><feFuncR type="linear" slope="0.95"/><feFuncG type="linear" slope="0.98"/><feFuncB type="linear" slope="1.02"/></feComponentTransfer></filter>
    <pattern id="${p}bands" width="800" height="36" patternUnits="userSpaceOnUse"><rect width="800" height="18" fill="#000" opacity=".22"/></pattern>
    <clipPath id="${p}left"><rect data-cl x="0" y="0" width="400" height="450"/></clipPath><clipPath id="${p}right"><rect data-cr x="400" y="0" width="400" height="450"/></clipPath>
    <g id="${p}life">${life}</g>
  </defs>
  <g clip-path="url(#${p}right)"><use href="#${p}life"/>${[200, 600].map(x => `<circle cx="${x}" cy="-10" r="90" fill="url(#${p}lamp)"/>`).join('')}</g>
  <g clip-path="url(#${p}left)"><use href="#${p}life" filter="url(#${p}cheap)"/>${[[200, '#f3ffe8'], [600, '#e9f1ff']].map(([x, c]) => `<circle cx="${x}" cy="-10" r="90" fill="url(#${p}lamp)" style="mix-blend-mode:normal"/><circle cx="${x}" cy="-10" r="60" fill="${c}" opacity=".18"/>`).join('')}
    <rect data-bands width="800" height="486" y="-36" fill="url(#${p}bands)" opacity="0"/></g>
  <g data-div style="cursor:ew-resize"><rect data-hit x="380" y="0" width="40" height="450" fill="transparent"/><line data-ln x1="400" y1="0" x2="400" y2="450" stroke="#fff" stroke-width="3"/>
    <g data-knob transform="translate(400 225)"><circle r="20" fill="#fff" stroke="rgba(0,0,0,.25)"/><path d="M-7 -6 L-13 0 L-7 6 M7 -6 L13 0 L7 6" stroke="#333" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></g>
  <g font-family="sans-serif" font-size="15" font-weight="600"><rect data-tl x="14" y="14" rx="10" height="30" fill="rgba(10,12,16,.62)"/><text data-tlt x="26" y="34" fill="#fff"></text><rect data-tr y="14" rx="10" height="30" fill="rgba(10,12,16,.62)"/><text data-trt y="34" fill="#ffe4a8" text-anchor="end"></text></g>
</svg>`;
  const svg = host.querySelector('svg'), q = s => svg.querySelector(s);
  const el = { cl: q('[data-cl]'), cr: q('[data-cr]'), ln: q('[data-ln]'), knob: q('[data-knob]'), hit: q('[data-hit]'), bands: q('[data-bands]'), tl: q('[data-tl]'), tlt: q('[data-tlt]'), tr: q('[data-tr]'), trt: q('[data-trt]') };
  const st = { x: 400, flicker: false };
  function labels(left, right) {
    el.tlt.textContent = left; el.trt.textContent = right;
    const wl = el.tlt.getComputedTextLength ? el.tlt.getComputedTextLength() : 140, wr = el.trt.getComputedTextLength ? el.trt.getComputedTextLength() : 140;
    el.tl.setAttribute('width', wl + 24); el.tr.setAttribute('width', wr + 24); el.tr.setAttribute('x', 786 - wr - 24); el.trt.setAttribute('x', 774);
  }
  function split(x) { st.x = clamp(x, 30, 770); el.cl.setAttribute('width', st.x); el.cr.setAttribute('x', st.x); el.cr.setAttribute('width', 800 - st.x); el.ln.setAttribute('x1', st.x); el.ln.setAttribute('x2', st.x); el.knob.setAttribute('transform', `translate(${st.x} 225)`); el.hit.setAttribute('x', st.x - 20); opts.onSplit && opts.onSplit(st.x); }
  const toX = e => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()).x; };
  let drag = false;
  svg.addEventListener('pointerdown', e => { drag = true; svg.setPointerCapture(e.pointerId); split(toX(e)); });
  svg.addEventListener('pointermove', e => { if (drag) split(toX(e)); });
  svg.addEventListener('pointerup', () => { drag = false; }); svg.addEventListener('pointercancel', () => { drag = false; });
  const scene = { tick(dt, t) { if (!st.flicker) { el.bands.setAttribute('opacity', 0); return false; } el.bands.setAttribute('opacity', 1); el.bands.setAttribute('y', -36 + ((t * 60) % 36)); return true; } };
  register(host, scene);
  split(st.x);
  return { st, split, labels, flicker(on) { st.flicker = on; wake(); } };
}
