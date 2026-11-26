// Real-photo scenes. Each scene is a photograph of a real room; a canvas relights it live:
// the photo is multiplied by a "light map" (night ambient + daylight through the windows + every light that is on),
// then the lamps, LED lines, TV picture and AC display are added on top. Curtains are drawn as fabric over the window,
// and the front door is a slice of the photo that swings open in 3D.
//
// Zones (positions in % of the photo, set in the admin panel):
//   {t:'light', f, k?, p:[x,y], a?:[x,y], r, h?}  a lamp at p lighting the spot a; r = size of the pool; h = fixture hidden in the ceiling
//   {t:'line',  f, p:[x1,y1,x2,y2], r}             an LED line
//   {t:'area',  f, p:[x,y,w,h], th?}                LED lines already visible in the photo: the bright pixels inside the box glow
//   {t:'window', p:[x,y,w,h], c, m?, sheer?}        motorised curtain over a window (m: split | left | right | blind)
//   {t:'tv'|'ac'|'door'|'lock'|'panel', p:[x,y,w,h]}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, k) => a + (b - a) * k;
export const FIXTURES = ['down', 'spot', 'strip', 'track', 'pendant', 'washer'];
export const fixtureHasColour = f => f === 'strip' || f === 'washer';
const KIND = { down: 'pool', spot: 'beam', track: 'beam', pendant: 'pendant', washer: 'wash', strip: 'line' };

export function kelvin(k) {
  k /= 100; let r, g, b;
  if (k <= 66) { r = 255; g = 99.47 * Math.log(k) - 161.12; b = k <= 19 ? 0 : 138.52 * Math.log(k - 10) - 305.04; } else { r = 329.7 * Math.pow(k - 60, -0.1332); g = 288.12 * Math.pow(k - 60, -0.0755); b = 255; }
  return [clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)];
}
const hexRGB = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(a, 0, 1).toFixed(3)})`;
export const sunAt = t => clamp(Math.sin((t - 6) / 12.6 * Math.PI) * 3.2 + 0.1, 0, 1);

export const TV_CHANNELS = [
  { ar: 'طبيعة', en: 'Nature', glow: [255, 150, 90] }, { ar: 'رياضة', en: 'Sports', glow: [90, 200, 120] }, { ar: 'أخبار', en: 'News', glow: [90, 130, 255] },
  { ar: 'أفلام', en: 'Movies', glow: [170, 120, 255] }, { ar: 'كاميرا الباب', en: 'Door camera', glow: [170, 200, 230] },
];

export const baseState = () => ({
  time: 20.5, curtain: 0, sheer: 0, solo: null, temp: 27,
  down: { on: false, bri: 80, cct: 3000, rgb: null }, spot: { on: false, bri: 80, cct: 3000, rgb: null }, strip: { on: false, bri: 70, cct: 2700, rgb: null },
  track: { on: false, bri: 80, cct: 3500, rgb: null }, pendant: { on: false, bri: 70, cct: 2700, rgb: null }, washer: { on: false, bri: 70, cct: 3000, rgb: null },
  tv: { on: false, ch: 0, vol: 20 }, ac: { on: false, set: 24, mode: 'cool', fan: 2, swing: false },
});

// ---------- one shared animation clock: only scenes on screen are drawn ----------
const live = new Set(); let raf = 0, last = 0;
const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { const s = e.target.__scene; if (s) { s.visible = e.isIntersecting; if (s.visible) { s.dirty = true; wake(); } } }), { rootMargin: '160px' }) : null;
export function wake() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; let busy = false;
  for (const s of live) { if (!s.el.isConnected) { live.delete(s); io && io.unobserve(s.el); continue; } if (s.visible) busy = s.tick(dt, now / 1000) || busy; }
  raf = busy ? requestAnimationFrame(loop) : 0;
}
function register(el, scene) {
  // a scene rebuilt on the same element replaces the old one; it may already be on screen, so check now
  if (el.__scene) live.delete(el.__scene);
  const r = el.getBoundingClientRect(); scene.visible = !io || (r.bottom > -160 && r.top < innerHeight + 160);
  scene.el = el; el.__scene = scene; live.add(scene); if (io) io.observe(el); wake();
}

// ---------- images and the bright-pixel masks of LED lines ----------
const IMG = new Map();
export function loadImg(src) {
  if (!src) return Promise.reject(new Error('no image'));
  if (!IMG.has(src)) IMG.set(src, new Promise((ok, no) => { const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = no; i.src = src; }));
  return IMG.get(src);
}
const MASKS = new Map();
function buildMask(img, box, th = 235, dl = 10) {
  const key = img.src.slice(0, 200) + '|' + box.join(',') + '|' + th;
  if (MASKS.has(key)) return MASKS.get(key);
  let out = null;
  try {
    const W = 800, H = Math.round(800 * img.naturalHeight / img.naturalWidth), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(img, 0, 0, W, H);
    const d = c.getImageData(0, 0, W, H).data, L = new Uint8ClampedArray(W * H), S = new Float64Array((W + 1) * (H + 1));
    for (let i = 0; i < W * H; i++) L[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.55 + d[i * 4 + 2] * 0.15);
    for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += L[y * W + x]; S[(y + 1) * (W + 1) + x + 1] = S[y * (W + 1) + x + 1] + row; } }
    const R = 10, x0 = Math.floor(box[0] / 100 * W), y0 = Math.floor(box[1] / 100 * H), x1 = Math.ceil((box[0] + box[2]) / 100 * W), y1 = Math.ceil((box[1] + box[3]) / 100 * H);
    const o = c.createImageData(W, H), od = o.data;
    for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
      const ax = Math.max(0, x - R), ay = Math.max(0, y - R), bx = Math.min(W, x + R + 1), by = Math.min(H, y + R + 1);
      const mean = (S[by * (W + 1) + bx] - S[ay * (W + 1) + bx] - S[by * (W + 1) + ax] + S[ay * (W + 1) + ax]) / ((bx - ax) * (by - ay)), v = L[y * W + x];
      if (v > th && v - mean > dl) { const k = (y * W + x) * 4; od[k] = od[k + 1] = od[k + 2] = 255; od[k + 3] = clamp((v - th) / Math.max(1, 255 - th) * 1.6, 0.35, 1) * 255; }
    }
    c.clearRect(0, 0, W, H); c.putImageData(o, 0, 0); out = cv;
  } catch (e) { out = null; }   // a photo from another site cannot be read: the area just glows softly
  MASKS.set(key, out); return out;
}
function tinted(mask, col, cache) {
  const k = col.map(v => v | 0).join(','); if (cache.has(k)) return cache.get(k);
  const cv = document.createElement('canvas'); cv.width = mask.width; cv.height = mask.height; const c = cv.getContext('2d');
  c.drawImage(mask, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = css(col); c.fillRect(0, 0, cv.width, cv.height);
  const sm = document.createElement('canvas'); sm.width = Math.ceil(mask.width / 4); sm.height = Math.ceil(mask.height / 4); const sc = sm.getContext('2d');
  sc.filter = 'blur(3px)'; sc.drawImage(cv, 0, 0, sm.width, sm.height); sc.filter = 'blur(8px)'; sc.globalAlpha = 0.8; sc.drawImage(cv, 0, 0, sm.width, sm.height);
  const v = { full: cv, glow: sm }; if (cache.size > 24) cache.clear(); cache.set(k, v); return v;
}

// ---------- TV programmes, drawn live ----------
function drawTV(c, ch, x, y, w, h, t, out, guest) {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  if (ch === 0) {
    let g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#24306a'); g.addColorStop(0.5, '#f0884a'); g.addColorStop(0.56, '#3d5291'); g.addColorStop(1, '#101a36'); c.fillStyle = g; c.fillRect(x, y, w, h);
    c.fillStyle = '#ffe2a2'; c.beginPath(); c.arc(x + w * 0.62, y + h * (0.47 - 0.03 * Math.sin(t * 0.2)), h * 0.11, 0, 7); c.fill();
    for (const [k, col, amp] of [[0.38, '#4a3c6a', 0.1], [0.46, '#2a2346', 0.07]]) { c.fillStyle = col; c.beginPath(); c.moveTo(x, y + h * 0.56); for (let i = 0; i <= 24; i++) { const xx = x + w * i / 24; c.lineTo(xx, y + h * (k + amp * Math.sin(i * 0.9 + t * 0.05 + k * 9))); } c.lineTo(x + w, y + h * 0.56); c.fill(); }
    c.strokeStyle = 'rgba(255,214,160,.55)'; c.lineWidth = Math.max(1, h * 0.012);
    for (let i = 0; i < 7; i++) { const yy = y + h * (0.6 + i * 0.05), ww = w * (0.06 + 0.04 * Math.sin(t * 2 + i)); c.beginPath(); c.moveTo(x + w * 0.62 - ww, yy); c.lineTo(x + w * 0.62 + ww, yy); c.stroke(); }
  } else if (ch === 1) {
    for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#2f8f4a' : '#35a052'; c.fillRect(x + w * i / 8, y, w / 8 + 1, h); }
    c.strokeStyle = 'rgba(240,250,240,.85)'; c.lineWidth = Math.max(1, h * 0.015); c.strokeRect(x + w * 0.05, y + h * 0.08, w * 0.9, h * 0.84); c.beginPath(); c.moveTo(x + w / 2, y + h * 0.08); c.lineTo(x + w / 2, y + h * 0.92); c.stroke(); c.beginPath(); c.arc(x + w / 2, y + h / 2, h * 0.14, 0, 7); c.stroke();
    const bx = x + w * (0.5 + 0.32 * Math.sin(t * 0.9)), by = y + h * (0.5 + 0.3 * Math.sin(t * 1.3 + 1));
    for (let i = 0; i < 8; i++) { const px = x + w * (0.5 + 0.38 * Math.sin(t * 0.6 + i * 1.7)), py = y + h * (0.5 + 0.34 * Math.cos(t * 0.5 + i * 2.3)); c.fillStyle = i % 2 ? '#ff4d4d' : '#3d7dff'; c.beginPath(); c.arc(px * 0.7 + bx * 0.3, py * 0.7 + by * 0.3, h * 0.035, 0, 7); c.fill(); }
    c.fillStyle = '#fff'; c.beginPath(); c.arc(bx, by, h * 0.022, 0, 7); c.fill();
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x + w * 0.04, y + h * 0.05, w * 0.3, h * 0.14); c.fillStyle = '#fff'; c.font = `600 ${Math.max(6, h * 0.1)}px system-ui,sans-serif`; c.fillText('2 – 1', x + w * 0.07, y + h * 0.155);
  } else if (ch === 2) {
    let g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#173a74'); g.addColorStop(1, '#0d2147'); c.fillStyle = g; c.fillRect(x, y, w, h);
    c.fillStyle = 'rgba(120,170,255,.18)'; for (let i = 0; i < 6; i++) c.fillRect(x + w * (0.55 + i * 0.07), y + h * 0.12, w * 0.04, h * 0.5);
    c.fillStyle = '#e4bf9d'; c.beginPath(); c.arc(x + w * 0.3, y + h * 0.36, h * 0.12, 0, 7); c.fill(); c.fillStyle = '#1d2330'; c.beginPath(); c.ellipse(x + w * 0.3, y + h * 0.78, w * 0.16, h * 0.28, 0, Math.PI, 0); c.fill();
    c.fillStyle = '#f2f4f8'; c.fillRect(x, y + h * 0.66, w * 0.72, h * 0.13); c.fillStyle = '#c4262e'; c.fillRect(x, y + h * 0.79, w, h * 0.21);
    c.fillStyle = '#152238'; c.font = `700 ${Math.max(6, h * 0.08)}px system-ui,sans-serif`; c.fillText('SMART HOMES · TONIGHT', x + w * 0.03, y + h * 0.75);
    const msg = 'DIGITAL HOME · ORVIBO SMART LIVING · WEATHER: CLEAR TONIGHT · ', fs = Math.max(6, h * 0.11); c.font = `600 ${fs}px system-ui,sans-serif`; c.fillStyle = '#fff';
    const tw = c.measureText(msg).width, off = (t * w * 0.12) % tw; c.fillText(msg + msg + msg, x - off, y + h * 0.93);
  } else if (ch === 3) {
    c.fillStyle = '#07080f'; c.fillRect(x, y, w, h);
    for (let i = 0; i < 12; i++) { const px = x + w * ((i * 0.137 + t * 0.012 * (1 + i % 3)) % 1), py = y + h * (0.3 + 0.45 * ((i * 0.31) % 1)), r = h * (0.05 + (i % 4) * 0.035); const g = c.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `hsla(${(i * 47 + t * 8) % 360},90%,65%,.75)`); g.addColorStop(1, 'hsla(0,0%,0%,0)'); c.fillStyle = g; c.fillRect(px - r, py - r, r * 2, r * 2); }
    c.fillStyle = '#000'; c.fillRect(x, y, w, h * 0.13); c.fillRect(x, y + h * 0.87, w, h * 0.13);
  } else {
    if (out) { const s = Math.max(w / out.naturalWidth, h / out.naturalHeight); const iw = out.naturalWidth * s, ih = out.naturalHeight * s; c.filter = 'saturate(.55) contrast(1.05)'; c.drawImage(out, x + (w - iw) / 2, y + (h - ih) * 0.55, iw, ih); c.filter = 'none'; }
    else { c.fillStyle = '#273040'; c.fillRect(x, y, w, h); }
    if (guest) { c.fillStyle = 'rgba(20,24,30,.88)'; c.beginPath(); c.arc(x + w * 0.42, y + h * 0.5, h * 0.09, 0, 7); c.fill(); c.beginPath(); c.ellipse(x + w * 0.42, y + h * 0.88, w * 0.1, h * 0.28, 0, Math.PI, 0); c.fill(); }
    c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(x, y, w, h * 0.14); c.fillStyle = '#fff'; c.font = `${Math.max(6, h * 0.09)}px ui-monospace,monospace`; c.fillText('CAM · ENTRANCE', x + w * 0.03, y + h * 0.1);
    if (Math.sin(t * 5) > 0) { c.fillStyle = '#ff4d4d'; c.beginPath(); c.arc(x + w * 0.94, y + h * 0.07, h * 0.03, 0, 7); c.fill(); }
  }
  const gl = c.createLinearGradient(x, y, x + w, y + h); gl.addColorStop(0, 'rgba(255,255,255,.10)'); gl.addColorStop(0.45, 'rgba(255,255,255,0)'); c.fillStyle = gl; c.fillRect(x, y, w, h);
  c.restore();
}

// ---------- perspective: every window, TV, AC or screen may be a 4-corner shape that follows the photo ----------
// z.q = [x1,y1, x2,y2, x3,y3, x4,y4] (top-left, top-right, bottom-right, bottom-left, in %); otherwise the box z.p
export const quadOf = z => (Array.isArray(z.q) && z.q.length === 8) ? z.q : [z.p[0], z.p[1], z.p[0] + z.p[2], z.p[1], z.p[0] + z.p[2], z.p[1] + z.p[3], z.p[0], z.p[1] + z.p[3]];
// maps (u,v) in the unit square onto the quad (a projective map, so far things shrink as in the photo)
export function homography(q) {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = q, dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let a, b, c = x0, d, e, f = y0, g = 0, h = 0;
  const den = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9 || Math.abs(den) < 1e-12) { a = x1 - x0; b = x3 - x0; d = y1 - y0; e = y3 - y0; }
  else { g = (dx3 * dy2 - dx2 * dy3) / den; h = (dx1 * dy3 - dx3 * dy1) / den; a = x1 - x0 + g * x1; b = x3 - x0 + h * x3; d = y1 - y0 + g * y1; e = y3 - y0 + h * y3; }
  return (u, v) => { const w = g * u + h * v + 1; return [(a * u + b * v + c) / w, (d * u + e * v + f) / w]; };
}
const pxQuad = (z, W, H) => quadOf(z).map((v, i) => v / 100 * (i % 2 ? H : W));
// draw a flat picture (canvas) onto the quad: thin strips, each split into two exactly-mapped triangles,
// so the edges stay straight along the perspective lines with no steps
function tri(c, tex, s0, s1, s2, d0, d1, d2) {
  const den = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s2[0] - s0[0]) * (s1[1] - s0[1]); if (!den) return;
  const a = ((d1[0] - d0[0]) * (s2[1] - s0[1]) - (d2[0] - d0[0]) * (s1[1] - s0[1])) / den, b = ((d1[1] - d0[1]) * (s2[1] - s0[1]) - (d2[1] - d0[1]) * (s1[1] - s0[1])) / den;
  const cc = ((d2[0] - d0[0]) * (s1[0] - s0[0]) - (d1[0] - d0[0]) * (s2[0] - s0[0])) / den, d = ((d2[1] - d0[1]) * (s1[0] - s0[0]) - (d1[1] - d0[1]) * (s2[0] - s0[0])) / den;
  const e = d0[0] - a * s0[0] - cc * s0[1], f = d0[1] - b * s0[0] - d * s0[1];
  // grow the triangle a hair so neighbours overlap instead of leaving a seam
  const mx = (d0[0] + d1[0] + d2[0]) / 3, my = (d0[1] + d1[1] + d2[1]) / 3, g = p => { const dx = p[0] - mx, dy = p[1] - my, l = Math.hypot(dx, dy) || 1; return [p[0] + dx / l * 0.7, p[1] + dy / l * 0.7]; };
  c.save(); c.beginPath(); c.moveTo(...g(d0)); c.lineTo(...g(d1)); c.lineTo(...g(d2)); c.closePath(); c.clip();
  c.setTransform(a, b, cc, d, e, f); c.drawImage(tex, 0, 0); c.restore();
}
function drawOnQuad(c, tex, Hm, n = 40) {
  const tw = tex.width, th = tex.height, rows = 4;
  for (let i = 0; i < n; i++) for (let r = 0; r < rows; r++) {
    const u0 = i / n, u1 = (i + 1) / n, v0 = r / rows, v1 = (r + 1) / rows;
    const A = Hm(u0, v0), B = Hm(u1, v0), C2 = Hm(u1, v1), D = Hm(u0, v1), sA = [u0 * tw, v0 * th], sB = [u1 * tw, v0 * th], sC = [u1 * tw, v1 * th], sD = [u0 * tw, v1 * th];
    tri(c, tex, sA, sB, sD, A, B, D); tri(c, tex, sB, sC, sD, B, C2, D);
  }
}
const polyPath = (c, pts, W, H) => { c.beginPath(); for (let i = 0; i < pts.length; i += 2) c[i ? 'lineTo' : 'moveTo'](pts[i] / 100 * W, pts[i + 1] / 100 * H); c.closePath(); };

// ---------- curtains: pleated fabric that bunches up as it opens ----------
const rnd = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
let NOISE = null;
function noise() {
  if (NOISE) return NOISE; const cv = document.createElement('canvas'); cv.width = cv.height = 96; const c = cv.getContext('2d'), d = c.createImageData(96, 96);
  for (let i = 0; i < 96 * 96; i++) { const v = 128 + (Math.random() - 0.5) * 36 + Math.sin(i % 96 * 0.9) * 6; d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; }
  c.putImageData(d, 0, 0); NOISE = cv; return cv;
}
function fabric(c, x, y, w, h, col, folds, alpha, sheer, seed, edge, sway = 0) {
  if (w < 1 || h < 1) return;
  const n = Math.max(2, Math.round(folds)), wave = Math.min(h * 0.012, w / n * 0.25);
  c.save();
  // the outline: straight top, softly scalloped hem where each fold ends
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.lineTo(x + w, y + h - wave);
  for (let i = n; i > 0; i--) { const x0 = x + w * i / n, x1 = x + w * (i - 1) / n; c.quadraticCurveTo((x0 + x1) / 2, y + h + wave * (0.6 + rnd(seed + i) * 0.8), x1, y + h - wave); }
  c.closePath(); c.clip();
  // pleats: a smooth light-dark-light curve across every fold, folds of slightly different widths
  const g = c.createLinearGradient(x, 0, x + w, 0), lo = sheer ? 0.86 : 0.5, hi = sheer ? 1.04 : 1.1;
  let acc = 0; const ws = Array.from({ length: n }, (_, i) => 0.75 + rnd(seed * 7 + i) * 0.5), tot = ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < n; i++) {
    const a0 = acc / tot, span = ws[i] / tot; acc += ws[i];
    for (let k = 0; k <= 6; k++) { const u = k / 6, sh = lo + (hi - lo) * (0.5 - 0.5 * Math.cos(u * Math.PI * 2 + sway * Math.sin(i * 1.7 + seed))) * (0.8 + rnd(seed + i * 3) * 0.2); g.addColorStop(Math.min(1, a0 + span * u), css(col.map(v => Math.min(255, v * sh)), alpha)); }
  }
  c.fillStyle = g; c.fillRect(x, y, w, h + wave * 2);
  if (!sheer) { c.globalAlpha = 0.18; c.globalCompositeOperation = 'overlay'; c.fillStyle = c.createPattern(noise(), 'repeat'); c.fillRect(x, y, w, h + wave * 2); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; }
  // light falls off towards the top (shadow of the track) and the hem is a little heavier
  const v = c.createLinearGradient(0, y, 0, y + h); v.addColorStop(0, `rgba(0,0,0,${sheer ? 0.08 : 0.32})`); v.addColorStop(0.07, 'rgba(0,0,0,0)'); v.addColorStop(0.9, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${sheer ? 0.06 : 0.2})`);
  c.fillStyle = v; c.fillRect(x, y, w, h + wave * 2);
  // the leading edge catches a soft shadow
  if (edge) { const ex = edge > 0 ? x + w : x, e = c.createLinearGradient(ex, 0, ex - edge * Math.min(w, h * 0.04), 0); e.addColorStop(0, `rgba(0,0,0,${sheer ? 0.05 : 0.28})`); e.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = e; c.fillRect(x, y, w, h + wave * 2); }
  c.restore();
  if (!sheer) { c.fillStyle = 'rgba(40,40,44,.55)'; c.fillRect(x, y - Math.max(1.5, h * 0.006), w, Math.max(1.5, h * 0.006)); }
}
const TEX = new WeakMap();
function texFor(z, w, h) { let t = TEX.get(z); if (!t) { t = document.createElement('canvas'); TEX.set(z, t); } if (t.width !== w || t.height !== h) { t.width = w; t.height = h; } const c = t.getContext('2d'); c.clearRect(0, 0, w, h); return [t, c]; }
let LAYER = null;
function layer(W, H) { if (!LAYER) LAYER = document.createElement('canvas'); if (LAYER.width !== W || LAYER.height !== H) { LAYER.width = W; LAYER.height = H; } const c = LAYER.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H); return c; }
function drawWindow(c, z, W, H, cur, she, sway) {
  if (cur <= 0.004 && !(z.sheer && she > 0.004)) return;
  const q = pxQuad(z, W, H), Hm = homography(q), col = hexRGB(z.c) || [120, 112, 104], m = z.m || 'split';
  // flat size of the window (its longest edges)
  const w = Math.max(8, Math.round(Math.max(Math.hypot(q[2] - q[0], q[3] - q[1]), Math.hypot(q[4] - q[6], q[5] - q[7])))), h = Math.max(8, Math.round(Math.max(Math.hypot(q[6] - q[0], q[7] - q[1]), Math.hypot(q[4] - q[2], q[5] - q[3]))));
  const [tex, t] = texFor(z, Math.min(1400, w), Math.min(1400, h)), tw = tex.width, th = tex.height;
  const nf = Math.max(4, Math.round(tw / 26));
  if (z.sheer && she > 0.01) { const sw = Math.max(tw * 0.05, (tw / 2) * she); fabric(t, 0, 0, sw, th, [244, 241, 234], nf * 0.8, 0.6, true, 3, 1, sway); fabric(t, tw - sw, 0, sw, th, [244, 241, 234], nf * 0.8, 0.6, true, 4, -1, sway); }
  if (cur > 0.004) {
    if (m === 'blind') { const bh = th * cur, g = t.createLinearGradient(0, 0, 0, bh); g.addColorStop(0, css(col.map(v => v * 0.82))); g.addColorStop(1, css(col)); t.fillStyle = g; t.fillRect(0, 0, tw, bh);
      t.fillStyle = 'rgba(0,0,0,.05)'; for (let yy = 6; yy < bh; yy += Math.max(4, th / 26)) t.fillRect(0, yy, tw, 1); t.fillStyle = css(col.map(v => v * 0.5)); t.fillRect(0, bh - Math.max(2, th * 0.02), tw, Math.max(2, th * 0.02)); }
    else if (m === 'left' || m === 'right') { const pw2 = tw * (0.1 + 0.9 * cur); fabric(t, m === 'left' ? 0 : tw - pw2, 0, pw2, th, col, nf, 0.97 * Math.min(1, cur * 6), false, 1, m === 'left' ? 1 : -1, sway); }
    else { const half = (tw / 2) * (0.12 + 0.88 * cur), k = 0.97 * Math.min(1, cur * 6); fabric(t, 0, 0, half, th, col, nf / 2, k, false, 1, 1, sway); fabric(t, tw - half, 0, half, th, col, nf / 2, k, false, 2, -1, sway); }
  }
  // onto the photo, in perspective, and behind whatever stands in front of the window
  const l = layer(W, H); drawOnQuad(l, tex, Hm, Math.max(24, Math.round(w / 10)));
  if (Array.isArray(z.cut)) { l.globalCompositeOperation = 'destination-out'; l.filter = `blur(${Math.max(0.6, W / 900)}px)`; for (const poly of z.cut) { polyPath(l, poly, W, H); l.fill(); } l.filter = 'none'; l.globalCompositeOperation = 'source-over'; }
  c.drawImage(LAYER, 0, 0);
}

// ---------- AC unit ----------
const AC_COL = { cool: [140, 205, 255], heat: [255, 165, 100], dry: [150, 235, 220], fan: [225, 232, 240] };
function drawACBody(c, z, W, H, k) {
  // the flap swings open along the bottom of the unit
  const Hm = homography(pxQuad(z, W, H)), P = (u, v) => Hm(u, v);
  const quad = (v0, v1, col) => { const a = P(0.05, v0), b = P(0.95, v0), d = P(0.95, v1), e = P(0.05, v1); c.fillStyle = col; c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.lineTo(...d); c.lineTo(...e); c.closePath(); c.fill(); };
  quad(0.8, 0.8 + 0.11 * k, `rgba(25,28,34,${0.72 * k})`); quad(0.8 + 0.11 * k, 0.8 + 0.15 * k, `rgba(255,255,255,${0.5 * k})`);
}
function drawACFlow(c, z, W, H, ac, t, k) {
  const Hm = homography(pxQuad(z, W, H)), col = AC_COL[ac.mode] || AC_COL.cool, L = Hm(0, 1), R = Hm(1, 1), T = Hm(0, 0);
  const h = Math.hypot(L[0] - T[0], L[1] - T[1]), len = h * (3 + ac.fan * 1.2), ang = (ac.swing ? Math.sin(t * 0.9) * 0.4 : 0.12) + 0.05;
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 44; i++) {
    const ph = ((t * (0.18 + ac.fan * 0.06) + rnd(i)) % 1), u = 0.06 + 0.88 * rnd(i + 40), base = Hm(u, 0.95), drift = Math.sin(t * 0.9 + i * 1.3) * h * 0.2 * ph;
    const px = base[0] + Math.sin(ang) * len * ph + drift, py = base[1] + len * ph * Math.cos(ang), r = h * (0.25 + 0.9 * ph), a = 0.05 * k * Math.sin(Math.PI * Math.min(1, ph * 1.05));
    c.save(); c.translate(px, py); c.rotate(-ang * 0.6); c.scale(0.55, 1.6);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, css(col, a)); g.addColorStop(0.55, css(col, a * 0.35)); g.addColorStop(1, css(col, 0)); c.fillStyle = g; c.fillRect(-r, -r, r * 2, r * 2); c.restore();
  }
  c.restore();
  const d = Hm(0.83, 0.52); c.save(); c.globalAlpha = k; c.fillStyle = css(col); c.shadowColor = css(col); c.shadowBlur = h * 0.25; c.font = `600 ${Math.max(7, h * 0.26)}px system-ui,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(ac.set) + '°', d[0], d[1]); c.restore();
  void R;
}

// ============================================================================================
//  makePhoto: one live photo scene
// ============================================================================================
export function makePhoto(host, opts = {}) {
  const scene = opts.scene || {}, zones = Array.isArray(scene.zones) ? scene.zones : [];
  const st = Object.assign(baseState(), JSON.parse(JSON.stringify(opts.state || {})));
  for (const f of FIXTURES) st[f] = Object.assign(baseState()[f], (opts.state || {})[f] || {});
  st.tv = Object.assign(baseState().tv, (opts.state || {}).tv || {}); st.ac = Object.assign(baseState().ac, (opts.state || {}).ac || {});
  host.classList.add('photo'); host.innerHTML = `<canvas class="ph-cv" role="img" aria-label="${opts.label || ''}"></canvas><div class="ph-dom"></div><div class="ph-load">…</div>`;
  const cv = host.querySelector('.ph-cv'), ctx = cv.getContext('2d'), dom = host.querySelector('.ph-dom');
  const lm = document.createElement('canvas'), lx = lm.getContext('2d');
  const has = t => zones.some(z => z.t === t), hasWin = has('window');
  const lit = FIXTURES.reduce((o, f) => (o[f] = { I: 0, c: [255, 200, 150] }, o), {});
  let img = null, out = null, masks = [], cur = st.curtain / 100, she = st.sheer / 100, curV = 0, sway = 0, tm = st.time, tvK = st.tv.on ? 1 : 0, acK = st.ac.on ? 1 : 0, chShow = st.tv.ch, chK = 1, flashC = null, flashT = 0, lastDraw = 0, guestOn = false;
  const tvTex = document.createElement('canvas');
  const tcache = new Map();

  const target = f => { const L = st[f]; if (!L || !L.on || (st.solo && st.solo !== f)) return 0; return Math.pow(clamp(L.bri, 1, 100) / 100, 0.8); };
  const colourOf = f => { const L = st[f]; return (L.rgb && hexRGB(L.rgb)) || kelvin(L.cct || 3000); };

  // ---- the parts that are DOM elements: door, lock, wall panel, hotspots ----
  function buildDom() {
    let html = '';
    const door = zones.find(z => z.t === 'door'), lock = zones.find(z => z.t === 'lock');
    if (door && img) {
      const [x, y, w, h] = door.p, pt = lock && lock.patch, patch = pt ? `<i class="ph-patch" style="left:${(pt[0] - x) / w * 100}%;top:${(pt[1] - y) / h * 100}%;width:${pt[2] / w * 100}%;height:${pt[3] / h * 100}%;background-image:url('${img.src}');background-size:${100 / pt[2] * 100}% ${100 / pt[3] * 100}%;background-position:${(pt[0] + pt[4]) / (100 - pt[2]) * 100}% ${pt[1] / (100 - pt[3]) * 100}%"></i>` : '', inLock = lock ? `<div class="ph-lock" style="left:${(lock.p[0] - x) / w * 100}%;top:${(lock.p[1] - y) / h * 100}%;width:${lock.p[2] / w * 100}%;height:${lock.p[3] / h * 100}%">${opts.lockArt ? opts.lockArt() : ''}</div>` : '';
      html += `<div class="ph-door ${door.hinge === 'l' ? 'hl' : ''}" style="left:${x}%;top:${y}%;width:${w}%;height:${h}%"><div class="ph-out" style="${scene.outside ? `background-image:url('${scene.outside}')` : ''}"></div>
        <div class="ph-leaf" style="background-image:url('${img.src}');background-size:${100 / w * 100}% ${100 / h * 100}%;background-position:${x / Math.max(0.01, 100 - w) * 100}% ${y / Math.max(0.01, 100 - h) * 100}%"><i class="ph-shade"></i>${patch}${inLock}</div></div>`;
    } else if (lock) html += `<div class="ph-lock" style="left:${lock.p[0]}%;top:${lock.p[1]}%;width:${lock.p[2]}%;height:${lock.p[3]}%">${opts.lockArt ? opts.lockArt() : ''}</div>`;
    zones.filter(z => z.t === 'panel').forEach((z, i) => { html += `<div class="ph-panel" data-pi="${i}" style="left:${z.p[0]}%;top:${z.p[1]}%;width:${z.p[2]}%;height:${z.p[3]}%"><img src="${opts.panelImg || 'img/products/mixpad4-wall.webp'}" alt="MixPad" draggable="false"><div class="ph-scr"></div></div>`; });
    // tap targets
    const seen = new Set();
    zones.forEach(z => {
      let key = z.t === 'light' || z.t === 'line' || z.t === 'area' ? z.f : z.t === 'window' ? 'curtain' : z.t; if (!opts.onHot || z.t === 'door' || z.t === 'lock' && door) return;
      let l, t, w, h;
      if (z.t === 'light') { l = z.p[0] - 3; t = z.p[1] - 4; w = 6; h = 8; }
      else if (z.t === 'line') { l = Math.min(z.p[0], z.p[2]) - 1.5; t = Math.min(z.p[1], z.p[3]) - 2.5; w = Math.abs(z.p[2] - z.p[0]) + 3; h = Math.abs(z.p[3] - z.p[1]) + 5; }
      else [l, t, w, h] = z.p;
      html += `<button class="ph-hot ${seen.has(key) ? 'dup' : ''}" data-hot="${key}" style="left:${l}%;top:${t}%;width:${w}%;height:${h}%" aria-label="${key}"><i></i></button>`; seen.add(key);
    });
    dom.innerHTML = html; skewPanels();
    dom.querySelectorAll('.ph-hot').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); opts.onHot(b.dataset.hot); }));
    if (lastPanel != null) api.panel(lastPanel);
    host.classList.toggle('dooropen', !!doorOpen);
  }
  let lastPanel = null, doorOpen = false;
  // a CSS matrix3d that lays a box of size w×h onto four points (used for screens on a wall seen at an angle)
  function skewPanels() {
    const r = host.getBoundingClientRect(); if (!r.width) return;
    dom.querySelectorAll('.ph-panel').forEach((el, i) => {
      const z = zones.filter(q => q.t === 'panel')[i]; if (!z || !z.q) { el.style.transform = ''; return; }
      const w = z.p[2] / 100 * r.width, h = z.p[3] / 100 * r.height, q = z.q.map((v, k) => v / 100 * (k % 2 ? r.height : r.width) - (k % 2 ? z.p[1] / 100 * r.height : z.p[0] / 100 * r.width));
      const Hm = homography(q), [x0, y0] = Hm(0, 0), [x1, y1] = Hm(1, 0), [x3, y3] = Hm(0, 1), [x2, y2] = Hm(1, 1);
      // solve the projective map from the unit square (same formulas as homography), then scale by the box size
      const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3, den = dx1 * dy2 - dx2 * dy1 || 1e-9;
      const g = (dx3 * dy2 - dx2 * dy3) / den, hh = (dx1 * dy3 - dx3 * dy1) / den, a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3;
      el.style.transformOrigin = '0 0';
      el.style.transform = `matrix3d(${a / w},${d / w},0,${g / w},${b / h},${e / h},0,${hh / h},0,0,1,0,${x0},${y0},0,1)`;
    });
  }

  // ---- light map: what light reaches each part of the room ----
  function lightmap(W, H, t) {
    const s = sunAt(tm), warm = clamp((s - 0.1) / 0.6, 0, 1);
    const block = hasWin ? (1 - 0.86 * cur) * (1 - 0.3 * she) : 1, d = s * block;
    const day = [1, 0.8 + 0.2 * warm, 0.62 + 0.38 * warm];
    const amb = [0.075 + d * day[0] * 0.95, 0.09 + d * day[1] * 0.95, 0.135 + d * day[2] * 0.9];
    lx.globalCompositeOperation = 'source-over'; lx.fillStyle = css(amb.map(v => clamp(v, 0, 1) * 255)); lx.fillRect(0, 0, W, H);
    lx.globalCompositeOperation = 'lighter';
    // daylight pouring in through each window
    if (s > 0.02) zones.filter(z => z.t === 'window').forEach(z => {
      const k = s * (1 - 0.9 * cur) * (1 - 0.3 * she) * 0.35, cx = (z.p[0] + z.p[2] / 2) / 100 * W, cy = (z.p[1] + z.p[3] / 2) / 100 * H, r = Math.max(z.p[2], z.p[3]) / 100 * W * 1.1;
      const g = lx.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, css(day.map(v => v * 255), k)); g.addColorStop(1, css([255, 255, 255], 0)); lx.fillStyle = g; lx.fillRect(0, 0, W, H);
    });
    let bounce = [0, 0, 0];
    for (const z of zones) {
      if (z.t === 'tv' && tvK > 0.01) { const g0 = TV_CHANNELS[chShow % TV_CHANNELS.length].glow, fl = tvK * (0.85 + 0.15 * Math.sin(t * 3.1) * Math.sin(t * 1.7)), cx = (z.p[0] + z.p[2] / 2) / 100 * W, cy = (z.p[1] + z.p[3] * 0.8) / 100 * H, r = z.p[2] / 100 * W * 2.8;
        const g = lx.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, css(g0, 0.55 * fl)); g.addColorStop(1, css(g0, 0)); lx.fillStyle = g; lx.fillRect(0, 0, W, H); continue; }
      if (!(z.t === 'light' || z.t === 'line' || z.t === 'area')) continue;
      const L = lit[z.f]; if (!L || L.I < 0.004) continue;
      const I = L.I, c = L.c, r = (z.r || 10) / 100 * W, kind = z.k || (z.t === 'line' ? 'line' : z.t === 'area' ? 'area' : KIND[z.f] || 'pool');
      bounce = bounce.map((v, i) => v + c[i] * I * 0.05);
      if (z.t === 'area') {
        const m = masks.find(q => q.z === z);
        if (m && m.mask) { const tm = tinted(m.mask, c, tcache); lx.globalAlpha = clamp(I * 1.4, 0, 1); for (let i = 0; i < 2; i++) lx.drawImage(tm.glow, 0, 0, W, H); lx.globalAlpha = 1; }
        const [x, y, w, h] = z.p, cx = (x + w / 2) / 100 * W, cy = (y + h) / 100 * H, rr = Math.max(w, h) / 100 * W * 0.8, g = lx.createRadialGradient(cx, cy, 0, cx, cy, rr);
        g.addColorStop(0, css(c, 0.45 * I)); g.addColorStop(1, css(c, 0)); lx.fillStyle = g; lx.fillRect(0, 0, W, H); continue;
      }
      if (kind === 'line') {
        const [x1, y1, x2, y2] = z.p.map((v, i) => v / 100 * (i % 2 ? H : W)), dir = z.up ? -1 : 1;
        for (const [wd, a, off] of [[r * 1.6, 0.18, r * 0.7], [r * 0.8, 0.35, r * 0.35], [r * 0.25, 0.6, 0]]) { lx.strokeStyle = css(c, a * I); lx.lineWidth = wd; lx.lineCap = 'round'; lx.beginPath(); lx.moveTo(x1, y1 + off * dir); lx.lineTo(x2, y2 + off * dir); lx.stroke(); }
        continue;
      }
      const px = z.p[0] / 100 * W, py = z.p[1] / 100 * H, a = z.a || [z.p[0], Math.min(98, z.p[1] + (kind === 'wash' || kind === 'lamp' ? 8 : 30))], ax = a[0] / 100 * W, ay = a[1] / 100 * H;
      const radial = (cx, cy, rx, ry, al) => { lx.save(); lx.translate(cx, cy); lx.scale(1, ry / rx); const g = lx.createRadialGradient(0, 0, 0, 0, 0, rx); [[0, 1], [0.18, 0.88], [0.36, 0.64], [0.54, 0.38], [0.72, 0.17], [0.88, 0.05], [1, 0]].forEach(([o, k]) => g.addColorStop(o, css(c, al * k))); lx.fillStyle = g; lx.fillRect(-rx, -rx, rx * 2, rx * 2); lx.restore(); };
      const cone = (wTop, wBot, al) => { const dx = ax - px, dy = ay - py, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, g = lx.createLinearGradient(px, py, ax, ay); g.addColorStop(0, css(c, al)); g.addColorStop(1, css(c, al * 0.25));
        lx.fillStyle = g; lx.beginPath(); lx.moveTo(px + nx * wTop, py + ny * wTop); lx.lineTo(ax + nx * wBot, ay + ny * wBot); lx.lineTo(ax - nx * wBot, ay - ny * wBot); lx.lineTo(px - nx * wTop, py - ny * wTop); lx.closePath(); lx.fill(); };
      if (kind === 'pool') { cone(r * 0.2, r * 0.9, (z.h ? 0.05 : 0.08) * I); radial(ax, ay, r * 1.4, r * 0.95, 1.0 * I); radial(px, py, r * 0.6, r * 0.5, 0.35 * I); radial((px + ax) / 2, (py + ay) / 2, r * 2.2, r * 1.8, 0.32 * I); }
      else if (kind === 'beam') { cone(r * 0.1, r * 0.6, 0.1 * I); radial(ax, ay, r * 0.8, r * 0.9, 1.0 * I); radial(px, py, r * 0.25, r * 0.25, 0.4 * I); }
      else if (kind === 'pendant') { radial(px, py, r * 0.75, r * 0.7, 0.65 * I); radial(ax, ay, r, r * 0.55, 0.7 * I); cone(r * 0.3, r * 0.9, 0.12 * I); }
      else if (kind === 'lamp') { radial(px, py, r, r * 1.05, 0.75 * I); radial(ax, ay, r * 0.8, r * 0.4, 0.35 * I); }
      else { radial(px, py + r * 0.5, r * 0.8, r * 1.6, 1.0 * I); radial(ax, ay, r * 0.9, r * 0.45, 0.4 * I); radial(px, py, r * 0.3, r * 0.3, 0.6 * I); }
    }
    if (bounce.some(v => v > 0)) { lx.fillStyle = css(bounce.map(v => Math.min(255, v))); lx.fillRect(0, 0, W, H); }
    lx.globalCompositeOperation = 'source-over';
  }

  // ---- full frame ----
  function draw(t) {
    if (!img) return;
    const W = cv.width, H = cv.height; if (!W || !H) return;
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.filter = 'none';
    ctx.drawImage(img, 0, 0, W, H);
    if (scene.flat) { if (flashC && flashT > 0) { ctx.fillStyle = css(flashC, 0.22 * flashT); ctx.fillRect(0, 0, W, H); } lastDraw = t; return; }
    // objects that sit in the room (lit by the room light)
    for (const z of zones) {
      if (z.t === 'window') drawWindow(ctx, z, W, H, cur, she, sway);
      if (z.t === 'ac' && acK > 0.01) drawACBody(ctx, z, W, H, acK);
      if (z.t === 'area') { const m = masks.find(q => q.z === z); if (m && m.mask && lit[z.f].I < 0.5) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 1 - lit[z.f].I * 2; ctx.drawImage(tinted(m.mask, [150, 150, 156], tcache).full, 0, 0, W, H); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } }
    }
    // relight
    const LW = 360, LH = Math.max(1, Math.round(LW * H / W)); if (lm.width !== LW || lm.height !== LH) { lm.width = LW; lm.height = LH; }
    lightmap(LW, LH, t);
    ctx.globalCompositeOperation = 'multiply'; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(lm, 0, 0, W, H);
    // what shines on its own: lamps, LED lines, screens
    ctx.globalCompositeOperation = 'lighter';
    for (const z of zones) {
      if (!(z.t === 'light' || z.t === 'line' || z.t === 'area')) continue;
      const L = lit[z.f]; if (!L || L.I < 0.004) continue;
      const I = L.I, c = L.c, r = (z.r || 10) / 100 * W;
      if (z.t === 'area') { const m = masks.find(q => q.z === z); if (m && m.mask) { const tm = tinted(m.mask, c.map(v => Math.min(255, v * 1.0)), tcache); ctx.globalAlpha = clamp(I * 1.1, 0, 1); ctx.drawImage(tm.full, 0, 0, W, H); ctx.globalAlpha = clamp(I * 0.55, 0, 1); ctx.drawImage(tm.glow, 0, 0, W, H); ctx.globalAlpha = 1; } continue; }
      if (z.t === 'line') { const [x1, y1, x2, y2] = z.p.map((v, i) => v / 100 * (i % 2 ? H : W)); ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = css(c.map(v => Math.min(255, v * 0.9 + 40)), 0.9 * I); ctx.shadowColor = css(c, I); ctx.shadowBlur = W * 0.012; ctx.lineWidth = Math.max(1.5, W * 0.0025); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore(); continue; }
      if (z.h) continue;
      const px = z.p[0] / 100 * W, py = z.p[1] / 100 * H, kind = z.k || KIND[z.f] || 'pool', core = kind === 'lamp' ? r * 0.35 : kind === 'pendant' ? r * 0.16 : r * 0.09;
      let g = ctx.createRadialGradient(px, py, 0, px, py, core); g.addColorStop(0, css([255, 250, 240], 0.95 * I)); g.addColorStop(0.35, css(c, 0.7 * I)); g.addColorStop(1, css(c, 0)); ctx.fillStyle = g; ctx.fillRect(px - core, py - core, core * 2, core * 2);
      const halo = core * 4; g = ctx.createRadialGradient(px, py, 0, px, py, halo); g.addColorStop(0, css(c, 0.16 * I)); g.addColorStop(1, css(c, 0)); ctx.fillStyle = g; ctx.fillRect(px - halo, py - halo, halo * 2, halo * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const z of zones) {
      if (z.t === 'tv' && tvK > 0.01) {
        // the picture is drawn flat, then laid on the screen in perspective; it fades in like a real panel
        const q = pxQuad(z, W, H), tw = Math.max(32, Math.round(Math.hypot(q[2] - q[0], q[3] - q[1]))), th = Math.max(18, Math.round(Math.hypot(q[6] - q[0], q[7] - q[1])));
        if (tvTex.width !== tw || tvTex.height !== th) { tvTex.width = tw; tvTex.height = th; }
        const tc = tvTex.getContext('2d'), gst = opts.guest ? opts.guest() : false; drawTV(tc, chShow % TV_CHANNELS.length, 0, 0, tw, th, t, out, gst);
        if (chK < 1) { tc.globalAlpha = 1 - chK; tc.fillStyle = '#05070b'; tc.fillRect(0, 0, tw, th); tc.globalAlpha = 1; }
        ctx.save(); ctx.globalAlpha = Math.pow(tvK, 1.5) * 0.97; drawOnQuad(ctx, tvTex, homography(q), 16); ctx.restore();
      }
      if (z.t === 'ac' && acK > 0.01) drawACFlow(ctx, z, W, H, st.ac, t, acK);
    }
    if (flashC && flashT > 0) { ctx.fillStyle = css(flashC, 0.22 * flashT); ctx.fillRect(0, 0, W, H); }
    lastDraw = t;
  }

  // ---- animation: lights fade, curtains travel, the TV and AC move ----
  const scn = {
    dirty: true,
    tick(dt, t) {
      let moving = false;
      const kf = 1 - Math.exp(-dt * 4.2);
      for (const f of FIXTURES) { const L = lit[f], to = target(f), c = colourOf(f);
        if (Math.abs(L.I - to) > 0.002) { L.I += (to - L.I) * kf; moving = true; } else L.I = to;
        for (let i = 0; i < 3; i++) { if (Math.abs(L.c[i] - c[i]) > 0.6) { L.c[i] += (c[i] - L.c[i]) * kf; moving = true; } else L.c[i] = c[i]; } }
      // the curtain motor accelerates, travels, then slows down before it stops
      const ct = st.curtain / 100, dist = ct - cur;
      if (Math.abs(dist) > 0.0015) { const vmax = 0.26, acc = 0.45, want = Math.sign(dist) * Math.min(vmax, Math.sqrt(2 * acc * Math.abs(dist)));
        curV += clamp(want - curV, -acc * dt, acc * dt); cur += curV * dt; if (Math.sign(ct - cur) !== Math.sign(dist)) { cur = ct; curV = 0; } moving = true; }
      else { cur = ct; curV = 0; }
      sway += (Math.abs(curV) * 2.2 - sway) * (1 - Math.exp(-dt * 3)); if (sway > 0.002) moving = true;
      const sh = st.sheer / 100; if (Math.abs(she - sh) > 0.001) { she += clamp(sh - she, -dt * 0.3, dt * 0.3); moving = true; }
      if (Math.abs(tm - st.time) > 0.005) { tm += (st.time - tm) * (1 - Math.exp(-dt * 2.6)); moving = true; } else tm = st.time;
      const tvTo = st.tv.on ? 1 : 0, acTo = st.ac.on ? 1 : 0;
      if (Math.abs(tvK - tvTo) > 0.004) { tvK += clamp(tvTo - tvK, -dt * 1.6, dt * 1.6); moving = true; } else tvK = tvTo;
      if (Math.abs(acK - acTo) > 0.004) { acK += clamp(acTo - acK, -dt * 0.9, dt * 0.9); moving = true; } else acK = acTo;
      if (chShow !== st.tv.ch) { chK -= dt * 5; if (chK <= 0) { chShow = st.tv.ch; chK = 0; } moving = true; } else if (chK < 1) { chK = Math.min(1, chK + dt * 4); moving = true; }
      if (flashT > 0) { flashT = Math.max(0, flashT - dt * 1.6); moving = true; }
      const ext = opts.onTick ? opts.onTick(dt, st) : false;
      const anim = (tvK > 0.01 && has('tv')) || (acK > 0.01 && has('ac'));
      if (moving || this.dirty || (anim && t - lastDraw > 0.033)) { this.dirty = false; draw(t); }
      return moving || anim || ext || !!opts.alwaysTick || this.dirty;
    },
  };

  // ---- size the canvas to the element ----
  function fit() {
    const r = host.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.min(1600, Math.round(r.width * dpr))), h = Math.max(1, Math.round(w * (img ? img.naturalHeight / img.naturalWidth : 2 / 3)));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; scn.dirty = true; wake(); }
    skewPanels();
  }
  const ro = 'ResizeObserver' in window ? new ResizeObserver(fit) : null; ro ? ro.observe(host) : addEventListener('resize', fit);

  const ready = loadImg(scene.img).then(im => {
    img = im; host.style.aspectRatio = `${im.naturalWidth} / ${im.naturalHeight}`; host.classList.add('ready');
    masks = zones.filter(z => z.t === 'area').map(z => ({ z, mask: buildMask(im, z.p, z.th || 235) }));
    buildDom(); fit(); scn.dirty = true; wake();
  }).catch(() => { host.classList.add('broken'); const l = host.querySelector('.ph-load'); if (l) l.textContent = '⚠'; });
  if (scene.outside) loadImg(scene.outside).then(im => { out = im; }).catch(() => { });
  else loadImg('img/entrance-outside.jpg').then(im => { out = im; }).catch(() => { });

  function merge(dst, src) { for (const k in src) { const v = src[k]; if (v && typeof v === 'object' && !Array.isArray(v) && dst[k] && typeof dst[k] === 'object') merge(dst[k], v); else dst[k] = v; } }
  const api = {
    st, el: host, dom, ready, zones,
    has: t => has(t), hasFixture: f => zones.some(z => z.f === f && (z.t === 'light' || z.t === 'line' || z.t === 'area')),
    fixtures: () => FIXTURES.filter(f => api.hasFixture(f)),
    set(p) { merge(st, p); st.curtain = clamp(+st.curtain || 0, 0, 100); st.sheer = clamp(+st.sheer || 0, 0, 100); scn.dirty = true; wake(); return api; },
    refresh() { scn.dirty = true; wake(); }, pos: () => cur * 100,
    jump() { cur = st.curtain / 100; she = st.sheer / 100; tm = st.time; tvK = st.tv.on ? 1 : 0; acK = st.ac.on ? 1 : 0; chShow = st.tv.ch; chK = 1; for (const f of FIXTURES) { lit[f].I = target(f); lit[f].c = colourOf(f).slice(); } scn.dirty = true; wake(); },
    flash(col, k = 1) { flashC = hexRGB(col) || [255, 255, 255]; flashT = k; scn.dirty = true; wake(); },
    door(open) { doorOpen = !!open; host.classList.toggle('dooropen', doorOpen); },
    panel(html) { lastPanel = html; dom.querySelectorAll('.ph-scr').forEach(s => { s.innerHTML = html; }); },
    lock: () => dom.querySelector('.ph-lock'),
    guest(on) { guestOn = !!on; host.classList.toggle('guest', guestOn); scn.dirty = true; wake(); },
  };
  register(host, scn);
  api.jump();
  return api;
}

// ============================================================================================
//  The colour-quality comparison on a real photo
// ============================================================================================
export function makeCRIPhoto(host, opts = {}) {
  host.classList.add('photo', 'cri');
  host.innerHTML = `<img class="cri-a" alt="" src="${opts.img}"><div class="cri-b"><img alt="" src="${opts.img}"><i class="cri-flick"></i></div>
    <div class="cri-line"><b></b></div><span class="cri-l lo"></span><span class="cri-l hi"></span>`;
  const b = host.querySelector('.cri-b'), line = host.querySelector('.cri-line'), first = host.querySelector('img');
  first.addEventListener('load', () => { host.style.aspectRatio = `${first.naturalWidth} / ${first.naturalHeight}`; host.classList.add('ready'); });
  let x = 50;
  const split = v => { x = clamp(v, 0, 100); b.style.clipPath = `inset(0 ${100 - x}% 0 0)`; line.style.left = x + '%'; opts.onSplit && opts.onSplit(x); };
  let drag = false;
  const at = e => { const r = host.getBoundingClientRect(); split((e.clientX - r.left) / r.width * 100); };
  host.addEventListener('pointerdown', e => { drag = true; host.setPointerCapture?.(e.pointerId); at(e); });
  host.addEventListener('pointermove', e => { if (drag) at(e); });
  host.addEventListener('pointerup', () => { drag = false; }); host.addEventListener('pointercancel', () => { drag = false; });
  split(50);
  return { split, labels(lo, hi) { host.querySelector('.lo').textContent = lo; host.querySelector('.hi').textContent = hi; }, flicker(on) { host.classList.toggle('flick', !!on); } };
}
