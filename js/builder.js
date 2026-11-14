// Floor-plan editor: load an architectural plan (image) or a frame of a video, set the scale, trace the
// rooms, mark doors, windows and the entry door. The result is a layout the simulator builds a home from.
// Nothing here needs 3D, so it runs on any device.
export const ROOM_TYPES = { living: 'Living Room', kitchen: 'Kitchen', bedroom: 'Bedroom', master: 'Master Bedroom', bath: 'Bathroom', dining: 'Dining Room', office: 'Office', hall: 'Hall', other: 'Room' };
const COLORS = { living: '#c9a25a', kitchen: '#7fb8a4', bedroom: '#8fa8ff', master: '#b48cff', bath: '#63d2ff', dining: '#ffb347', office: '#9db7ff', hall: '#aab4c4', other: '#aab4c4' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Everything is kept in plan pixels (the picture's own pixels, or a 40 px = 1 m grid without a picture).
let S = null, el = null, cv = null, g = null, onDone = null, video = null, ro = null;
const fresh = () => ({ id: 'h' + Date.now().toString(36), name: '', ppm: 40, scaleSet: false, bg: null, bw: 1200, bh: 800, rooms: [], doors: [], windows: [], entry: null, tool: 'room', type: 'living', drag: null, scalePts: [], view: { k: 1, ox: 0, oy: 0 }, undo: [], msg: '' });

export function openBuilder(root, existing, done) {
  el = root; onDone = done; S = fresh();
  if (existing) {                       // re-open a saved layout on the plain grid
    Object.assign(S, { id: existing.id, name: existing.name, scaleSet: true });
    const m = 40, pad = 80; S.rooms = existing.rooms.map(r => ({ type: r.type, name: r.name || '', x0: r.x0 * m + pad, z0: r.z0 * m + pad, x1: r.x1 * m + pad, z1: r.z1 * m + pad }));
    const pt = p => ({ x: p.x * m + pad, z: p.z * m + pad, w: p.w }); S.doors = (existing.doors || []).map(pt); S.windows = (existing.windows || []).map(pt); S.entry = existing.entry ? pt(existing.entry) : null;
    S.bw = Math.max(1200, ...S.rooms.map(r => r.x1 + pad)); S.bh = Math.max(800, ...S.rooms.map(r => r.z1 + pad));
  }
  el.classList.remove('hidden'); document.documentElement.classList.add('building'); shell(); fit(); draw(); side();
}
function close() { ro?.disconnect(); ro = null; el.classList.add('hidden'); el.innerHTML = ''; document.documentElement.classList.remove('building'); if (video) { URL.revokeObjectURL(video.src); video = null; } }

function shell() {
  el.innerHTML = `<div class="bl-top"><b>HOME BUILDER</b><span class="bl-msg" id="bl-msg"></span><button data-b="cancel">Cancel</button><button class="pri" data-b="build">Build the simulation ▸</button></div>
    <div class="bl-main"><div class="bl-tools" id="bl-tools"></div><div class="bl-stage"><canvas id="bl-cv"></canvas><div class="bl-video hidden" id="bl-video"><span>Video frame</span><input type="range" id="bl-seek" min="0" max="1" step="0.01" value="0"></div></div><div class="bl-side" id="bl-side"></div></div>
    <input type="file" id="bl-img" accept="image/*" hidden><input type="file" id="bl-vid" accept="video/*" hidden>`;
  cv = el.querySelector('#bl-cv'); g = cv.getContext('2d');
  el.onclick = click; el.oninput = input; el.onchange = input;
  cv.onpointerdown = down; cv.onpointermove = move; cv.onpointerup = up; cv.onpointercancel = () => { S.drag = null; draw(); };
  el.querySelector('#bl-img').onchange = e => loadImage(e.target.files[0]); el.querySelector('#bl-vid').onchange = e => loadVideo(e.target.files[0]);
  el.querySelector('#bl-seek').oninput = e => { if (video) video.currentTime = +e.target.value; };
  ro?.disconnect(); ro = new ResizeObserver(() => { if (S && el.querySelector('.bl-stage')) { fit(); draw(); } }); ro.observe(el.querySelector('.bl-stage'));
  tools();
}
const TOOLS = [['scale', '📏', 'Set scale'], ['room', '⬛', 'Draw room'], ['door', '🚪', 'Door'], ['window', '🪟', 'Window'], ['entry', '🔐', 'Entry door'], ['erase', '🗑️', 'Erase']];
function tools() {
  el.querySelector('#bl-tools').innerHTML = `<button data-b="img">🖼️<span>Load plan image</span></button><button data-b="vid">🎞️<span>Load video</span></button><hr>` +
    TOOLS.map(([k, i, l]) => `<button class="${S.tool === k ? 'on' : ''}" data-b="tool" data-v="${k}">${i}<span>${l}</span></button>`).join('') + `<hr><button data-b="auto">✨<span>Auto-detect rooms</span></button><button data-b="autodoor">↔️<span>Doors between rooms</span></button><button data-b="undo">↩️<span>Undo</span></button>`;
}
const HINT = { scale: 'Click two points on the plan whose real distance you know (for example the two ends of a wall), then type the distance.', room: 'Drag a rectangle over each room. Edges snap to rooms you have already drawn, so shared walls line up.', door: 'Click on a wall between two rooms to put a door there.', window: 'Click on an outside wall to put a window there.', entry: 'Click on an outside wall where the front door is.', erase: 'Click a room, door or window to remove it.' };
function side() {
  const m = v => (v / S.ppm).toFixed(1), area = S.rooms.reduce((a, r) => a + (r.x1 - r.x0) * (r.z1 - r.z0), 0) / S.ppm / S.ppm;
  el.querySelector('#bl-side').innerHTML = `
    <label class="f"><span>Name of this home / project</span><input type="text" data-f="name" value="${esc(S.name)}" placeholder="e.g. Villa 12 — Mr. Ahmed"></label>
    <div class="bl-step ${S.bg ? 'ok' : ''}"><b>1 · Plan</b><p>${S.bg ? 'Picture loaded. ' : 'Load a floor-plan image, or a video and pick the frame that shows the plan. '}You can also draw on the empty grid (1 square = 1 m).</p></div>
    <div class="bl-step ${S.scaleSet ? 'ok' : ''}"><b>2 · Scale</b><p>${S.scaleSet ? `1 m = ${S.ppm.toFixed(1)} px.` : S.bg ? 'Not set yet — use “Set scale” so the rooms get their real size.' : 'Grid: 1 square = 1 m.'}</p>
      ${S.scalePts.length === 2 ? `<div class="bl-row"><input type="number" id="bl-dist" min="0.1" step="0.01" placeholder="distance in metres"><button class="pri" data-b="setscale">Apply</button></div>` : ''}</div>
    <div class="bl-step ${S.rooms.length ? 'ok' : ''}"><b>3 · Rooms</b><p>Type of the next room you draw:</p><div class="bl-types">${Object.entries(ROOM_TYPES).map(([k, n]) => `<button class="${S.type === k ? 'on' : ''}" style="--c:${COLORS[k]}" data-b="type" data-v="${k}">${n}</button>`).join('')}</div>
      ${S.rooms.map((r, i) => `<div class="bl-room"><i style="background:${COLORS[r.type]}"></i><select data-f="rtype" data-i="${i}">${Object.entries(ROOM_TYPES).map(([k, n]) => `<option value="${k}" ${r.type === k ? 'selected' : ''}>${n}</option>`).join('')}</select><input type="text" data-f="rname" data-i="${i}" value="${esc(r.name)}" placeholder="name (optional)"><span>${m(r.x1 - r.x0)} × ${m(r.z1 - r.z0)} m</span><button data-b="delroom" data-v="${i}">✕</button></div>`).join('')}</div>
    <div class="bl-step ${S.entry ? 'ok' : ''}"><b>4 · Doors and windows</b><p>${S.doors.length} door${S.doors.length === 1 ? '' : 's'}, ${S.windows.length} window${S.windows.length === 1 ? '' : 's'}, entry door ${S.entry ? 'set' : 'not set (one will be chosen for you)'}.</p></div>
    <div class="bl-step"><b>What happens next</b><p>The simulator builds the structure, basic furniture and a full ORVIBO installation in every room (${S.rooms.length} room${S.rooms.length === 1 ? '' : 's'}, ${area.toFixed(0)} m²). You can then add, remove and change every device on the live diagram.</p></div>
    <p class="bl-hint">${HINT[S.tool]}</p>`;
}
const say = t => { const m = el.querySelector('#bl-msg'); if (m) m.textContent = t; };
const snap = () => { S.undo.push(JSON.stringify({ rooms: S.rooms, doors: S.doors, windows: S.windows, entry: S.entry })); if (S.undo.length > 40) S.undo.shift(); };

// ---------- picture / video ----------
function setBg(src, w, h) { S.bg = src; S.bw = w; S.bh = h; if (!S.scaleSet) S.ppm = Math.max(8, w / 14); fit(); draw(); side(); }      // first guess: the picture is ~14 m wide
function loadImage(file) {
  if (!file) return; const img = new Image();
  img.onload = () => { setBg(img, img.naturalWidth, img.naturalHeight); el.querySelector('#bl-video').classList.add('hidden'); S.tool = S.scaleSet ? 'room' : 'scale'; tools(); side(); say('Plan loaded. Set the scale next.'); };
  img.onerror = () => say('That file could not be read as a picture.'); img.src = URL.createObjectURL(file);
}
function loadVideo(file) {
  if (!file) return; video = document.createElement('video'); video.muted = true; video.playsInline = true; video.preload = 'auto'; video.src = URL.createObjectURL(file);
  video.onloadedmetadata = () => { const s = el.querySelector('#bl-seek'); s.max = video.duration || 1; s.value = 0; el.querySelector('#bl-video').classList.remove('hidden'); video.currentTime = Math.min(0.1, video.duration || 0); };
  video.onseeked = () => { setBg(video, video.videoWidth, video.videoHeight); say('Move the slider to the frame that shows the plan best, then trace over it.'); };
  video.onerror = () => say('This video format cannot be played by the browser. Try an MP4 file.');
}

// ---------- view ----------
function fit() {
  const st = el.querySelector('.bl-stage'), dpr = Math.min(2, devicePixelRatio || 1), w = st.clientWidth, h = st.clientHeight; if (!w || !h) return;
  cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px'; S.view.dpr = dpr;
  const k = Math.min((w - 24) / S.bw, (h - 24) / S.bh); S.view.k = k; S.view.ox = (w - S.bw * k) / 2; S.view.oy = (h - S.bh * k) / 2;
}
const toPlan = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left - S.view.ox) / S.view.k, z: (e.clientY - r.top - S.view.oy) / S.view.k }; };
const px = n => n / S.view.k;                       // screen pixels → plan pixels

function draw() {
  if (!g) return; const { k, ox, oy, dpr } = S.view, w = cv.width / dpr, h = cv.height / dpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#0d1117'; g.fillRect(0, 0, w, h); g.translate(ox, oy); g.scale(k, k);
  if (S.bg) { g.globalAlpha = S.rooms.length ? 0.75 : 1; try { g.drawImage(S.bg, 0, 0, S.bw, S.bh); } catch (e) { /* frame not ready */ } g.globalAlpha = 1; }
  else { g.fillStyle = '#141a24'; g.fillRect(0, 0, S.bw, S.bh); g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = px(1); g.beginPath(); for (let x = 0; x <= S.bw; x += S.ppm) { g.moveTo(x, 0); g.lineTo(x, S.bh); } for (let y = 0; y <= S.bh; y += S.ppm) { g.moveTo(0, y); g.lineTo(S.bw, y); } g.stroke(); }
  const rooms = S.drag?.room ? [...S.rooms, S.drag.room] : S.rooms;
  for (const r of rooms) {
    const x = Math.min(r.x0, r.x1), z = Math.min(r.z0, r.z1), rw = Math.abs(r.x1 - r.x0), rd = Math.abs(r.z1 - r.z0), c = COLORS[r.type];
    g.fillStyle = c + '55'; g.fillRect(x, z, rw, rd); g.strokeStyle = c; g.lineWidth = px(3); g.strokeRect(x, z, rw, rd);
    g.fillStyle = '#fff'; g.font = `600 ${px(13)}px system-ui`; g.textAlign = 'center'; g.shadowColor = '#000'; g.shadowBlur = 4;
    g.fillText(r.name || ROOM_TYPES[r.type], x + rw / 2, z + rd / 2 - px(2)); g.font = `${px(11.5)}px system-ui`; g.fillText(`${(rw / S.ppm).toFixed(1)} × ${(rd / S.ppm).toFixed(1)} m`, x + rw / 2, z + rd / 2 + px(13)); g.shadowBlur = 0;
  }
  const mark = (o, color, len) => { const l = len * S.ppm / 2; g.strokeStyle = color; g.lineWidth = px(7); g.lineCap = 'butt'; g.beginPath(); if (o.axis === 'x') { g.moveTo(o.x - l, o.z); g.lineTo(o.x + l, o.z); } else { g.moveTo(o.x, o.z - l); g.lineTo(o.x, o.z + l); } g.stroke(); };
  S.doors.forEach(d => mark(d, '#8a5a2b', 0.9)); S.windows.forEach(d => mark(d, '#5ab8ff', d.w || 1.4));
  if (S.entry) { mark(S.entry, '#ffd166', 1.0); g.fillStyle = '#ffd166'; g.font = `700 ${px(12)}px system-ui`; g.textAlign = 'center'; g.fillText('ENTRY', S.entry.x, S.entry.z - px(8)); }
  if (S.scalePts.length) { g.strokeStyle = '#ff4d4d'; g.fillStyle = '#ff4d4d'; g.lineWidth = px(2); g.beginPath(); S.scalePts.forEach((p, i) => i ? g.lineTo(p.x, p.z) : g.moveTo(p.x, p.z)); g.stroke(); S.scalePts.forEach(p => { g.beginPath(); g.arc(p.x, p.z, px(5), 0, 7); g.fill(); }); }
}

// ---------- drawing ----------
function snapEdges(v, list) { let best = v, d = px(9); for (const e of list) if (Math.abs(e - v) < d) { d = Math.abs(e - v); best = e; } return best; }
const xs = () => S.rooms.flatMap(r => [r.x0, r.x1]), zs = () => S.rooms.flatMap(r => [r.z0, r.z1]);
// nearest wall of any room: returns the point on it and whether the wall runs along x or z
function nearestEdge(p) {
  let best = null;
  for (const r of S.rooms) for (const [axis, at, lo, hi] of [['x', r.z0, r.x0, r.x1], ['x', r.z1, r.x0, r.x1], ['z', r.x0, r.z0, r.z1], ['z', r.x1, r.z0, r.z1]]) {
    const along = axis === 'x' ? p.x : p.z, perp = axis === 'x' ? p.z : p.x, c = Math.max(lo, Math.min(hi, along)), d = Math.hypot(perp - at, along - c);
    if (d < px(16) && (!best || d < best.d)) best = { d, axis, x: axis === 'x' ? c : at, z: axis === 'x' ? at : c };
  }
  return best;
}
function down(e) {
  cv.setPointerCapture(e.pointerId); const p = toPlan(e);
  if (S.tool === 'room') { const x = snapEdges(p.x, xs()), z = snapEdges(p.z, zs()); S.drag = { room: { type: S.type, name: '', x0: x, z0: z, x1: x, z1: z } }; }
  else if (S.tool === 'scale') { if (S.scalePts.length >= 2) S.scalePts = []; S.scalePts.push(p); draw(); side(); if (S.scalePts.length === 2) setTimeout(() => el.querySelector('#bl-dist')?.focus(), 30); }
  else if (S.tool === 'erase') {
    snap(); const near = (o) => Math.hypot(o.x - p.x, o.z - p.z) < px(16);
    const di = S.doors.findIndex(near), wi = S.windows.findIndex(near);
    if (S.entry && near(S.entry)) S.entry = null; else if (di >= 0) S.doors.splice(di, 1); else if (wi >= 0) S.windows.splice(wi, 1);
    else { const ri = S.rooms.findIndex(r => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1); if (ri >= 0) S.rooms.splice(ri, 1); else S.undo.pop(); }
    draw(); side();
  } else {
    const hit = nearestEdge(p); if (!hit) return say('Click closer to a wall of a room.');
    snap(); const o = { x: hit.x, z: hit.z, axis: hit.axis };
    if (S.tool === 'door') S.doors.push(o); else if (S.tool === 'window') S.windows.push({ ...o, w: 1.4 }); else S.entry = o;
    draw(); side(); say('');
  }
}
function move(e) { if (!S.drag?.room) return; const p = toPlan(e), r = S.drag.room; r.x1 = snapEdges(p.x, xs()); r.z1 = snapEdges(p.z, zs()); draw(); }
function up() {
  const r = S.drag?.room; S.drag = null; if (!r) return;
  const n = { ...r, x0: Math.min(r.x0, r.x1), x1: Math.max(r.x0, r.x1), z0: Math.min(r.z0, r.z1), z1: Math.max(r.z0, r.z1) };
  if ((n.x1 - n.x0) / S.ppm >= 1.2 && (n.z1 - n.z0) / S.ppm >= 1.2) { snap(); S.rooms.push(n); say(''); } else say('That room is smaller than 1.2 m — draw a bigger rectangle (or check the scale).');
  draw(); side();
}

// ---------- automatic room detection (best effort, for clean plans with solid walls) ----------
function autoDetect() {
  if (!S.bg) return say('Load a floor-plan picture first.');
  const sc = Math.min(1, 420 / S.bw), w = Math.round(S.bw * sc), h = Math.round(S.bh * sc), c = document.createElement('canvas'); c.width = w; c.height = h;
  const cx = c.getContext('2d', { willReadFrequently: true }); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(S.bg, 0, 0, w, h);
  let data; try { data = cx.getImageData(0, 0, w, h).data; } catch (e) { return say('The browser does not allow reading this picture.'); }
  const n = w * h, gray = new Float32Array(n); let mean = 0; for (let i = 0; i < n; i++) { gray[i] = data[i * 4] * 0.3 + data[i * 4 + 1] * 0.59 + data[i * 4 + 2] * 0.11; mean += gray[i]; } mean /= n;
  const wallRaw = new Uint8Array(n); let cnt = 0; for (let i = 0; i < n; i++) if (gray[i] < Math.min(140, mean * 0.62)) { wallRaw[i] = 1; cnt++; }
  // square min / max filters (erode / dilate), separable
  const pass = (src, r, isMax) => { const t = new Uint8Array(n), o = new Uint8Array(n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = isMax ? 0 : 1; for (let d = -r; d <= r; d++) { const xx = x + d; const s = xx < 0 || xx >= w ? 0 : src[y * w + xx]; if (isMax ? s : !s) { v = isMax ? 1 : 0; break; } } t[y * w + x] = v; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = isMax ? 0 : 1; for (let d = -r; d <= r; d++) { const yy = y + d; const s = yy < 0 || yy >= h ? 0 : t[yy * w + x]; if (isMax ? s : !s) { v = isMax ? 1 : 0; break; } } o[y * w + x] = v; }
    return o; };
  const cell = S.ppm * sc, r1 = Math.max(1, Math.round(cell * 0.05)); let wall = pass(pass(wallRaw, r1, false), r1, true);      // drop thin lines (furniture, text, door swings)
  let kept = 0; for (let i = 0; i < n; i++) kept += wall[i]; if (kept < cnt * 0.3) wall = wallRaw;                                  // the plan is drawn with thin lines: keep them all
  const r2 = Math.max(2, Math.round(cell * 0.65)), closed = pass(wall, r2, true);                                                   // close the door gaps
  const lab = new Int32Array(n), found = []; let id = 0; const stack = [];
  for (let i = 0; i < n; i++) {
    if (closed[i] || lab[i]) continue; id++; let x0 = w, x1 = 0, y0 = h, y1 = 0, a = 0, border = false; stack.push(i); lab[i] = id;
    while (stack.length) { const j = stack.pop(), x = j % w, y = (j - x) / w; a++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border = true;
      for (const k of [j - 1, j + 1, j - w, j + w]) { if (k < 0 || k >= n || lab[k] || closed[k]) continue; if ((k === j - 1 && x === 0) || (k === j + 1 && x === w - 1)) continue; lab[k] = id; stack.push(k); } }
    const bw = x1 - x0 + 1 + 2 * r2, bh = y1 - y0 + 1 + 2 * r2, m2 = bw * bh / cell / cell;
    if (!border && m2 >= 2.5 && m2 < 200 && a / ((x1 - x0 + 1) * (y1 - y0 + 1)) > 0.55) found.push({ x0: (x0 - r2) / sc, z0: (y0 - r2) / sc, x1: (x1 + 1 + r2) / sc, z1: (y1 + 1 + r2) / sc, m2 });
  }
  if (!found.length) return say('No closed rooms were found. This works on clean plans with solid, dark walls — otherwise trace the rooms by hand.');
  snap(); found.sort((p, q) => q.m2 - p.m2); const order = ['living', 'master', 'kitchen', 'bedroom', 'dining', 'bedroom', 'office'];
  let big = 0; S.rooms = found.slice(0, 14).map(f => ({ type: f.m2 < 6.5 ? 'bath' : order[big++] || 'other', name: '', x0: f.x0, z0: f.z0, x1: f.x1, z1: f.z1 }));
  // make neighbours share one wall line
  const merge = (key) => { const v = [...new Set(S.rooms.flatMap(r => key === 'x' ? [r.x0, r.x1] : [r.z0, r.z1]))].sort((a, b) => a - b), tol = S.ppm * 0.35, map = new Map(); let grp = [];
    for (const val of [...v, Infinity]) { if (grp.length && val - grp[grp.length - 1] > tol) { const avg = grp.reduce((a, b) => a + b, 0) / grp.length; grp.forEach(x => map.set(x, avg)); grp = []; } grp.push(val); }
    for (const r of S.rooms) if (key === 'x') { r.x0 = map.get(r.x0); r.x1 = map.get(r.x1); } else { r.z0 = map.get(r.z0); r.z1 = map.get(r.z1); } };
  merge('x'); merge('z'); draw(); side();
  say(`${S.rooms.length} rooms detected. Check their sizes and types, then add the doors and windows.`);
}
function autoDoors() {
  if (S.rooms.length < 2) return say('Draw at least two rooms first.'); snap(); let n = 0; const tol = S.ppm * 0.2;
  for (let i = 0; i < S.rooms.length; i++) for (let j = i + 1; j < S.rooms.length; j++) {
    const a = S.rooms[i], b = S.rooms[j];
    for (const [axis, at, lo, hi] of [['z', a.x1, Math.max(a.z0, b.z0), Math.min(a.z1, b.z1), Math.abs(a.x1 - b.x0)], ['z', a.x0, Math.max(a.z0, b.z0), Math.min(a.z1, b.z1), Math.abs(a.x0 - b.x1)], ['x', a.z1, Math.max(a.x0, b.x0), Math.min(a.x1, b.x1), Math.abs(a.z1 - b.z0)], ['x', a.z0, Math.max(a.x0, b.x0), Math.min(a.x1, b.x1), Math.abs(a.z0 - b.z1)]].filter(t => t[4] < tol)) {
      if (hi - lo < S.ppm * 1.3) continue; const o = { axis, x: axis === 'x' ? (lo + hi) / 2 : at, z: axis === 'x' ? at : (lo + hi) / 2 };
      if (!S.doors.some(d => Math.hypot(d.x - o.x, d.z - o.z) < S.ppm)) { S.doors.push(o); n++; }
    }
  }
  draw(); side(); say(n ? `${n} door${n === 1 ? '' : 's'} added between touching rooms. Erase the ones that are not real.` : 'No touching rooms without a door were found.');
}

// ---------- events ----------
function click(e) {
  const b = e.target.closest('[data-b]'); if (!b) return; const v = b.dataset.v;
  switch (b.dataset.b) {
    case 'cancel': close(); break;
    case 'img': el.querySelector('#bl-img').click(); break; case 'vid': el.querySelector('#bl-vid').click(); break;
    case 'tool': S.tool = v; S.scalePts = []; tools(); side(); draw(); break;
    case 'type': S.type = v; S.tool = 'room'; tools(); side(); break;
    case 'delroom': snap(); S.rooms.splice(+v, 1); draw(); side(); break;
    case 'undo': { const u = S.undo.pop(); if (u) { Object.assign(S, JSON.parse(u)); draw(); side(); } break; }
    case 'auto': autoDetect(); break; case 'autodoor': autoDoors(); break;
    case 'setscale': { const d = +el.querySelector('#bl-dist').value, [p, q] = S.scalePts; if (!(d > 0)) return say('Type the real distance in metres.'); S.ppm = Math.hypot(q.x - p.x, q.z - p.z) / d; S.scaleSet = true; S.scalePts = []; S.tool = 'room'; tools(); draw(); side(); say('Scale set. Now draw the rooms.'); break; }
    case 'build': build(); break;
  }
}
function input(e) {
  const f = e.target.dataset.f, i = +e.target.dataset.i; if (!f) return;
  if (f === 'name') S.name = e.target.value; if (f === 'rname') { S.rooms[i].name = e.target.value; draw(); }
  if (f === 'rtype' && e.type === 'change') { S.rooms[i].type = e.target.value; draw(); side(); }
}
function build() {
  if (!S.rooms.length) return say('Draw at least one room first.');
  const m = S.ppm, x0 = Math.min(...S.rooms.map(r => r.x0)), z0 = Math.min(...S.rooms.map(r => r.z0)), spanX = (Math.max(...S.rooms.map(r => r.x1)) - x0) / m, spanZ = (Math.max(...S.rooms.map(r => r.z1)) - z0) / m;
  if (S.bg && !S.scaleSet) return say('Set the scale first (tool “Set scale”), otherwise the rooms will have the wrong size.');
  if (spanX > 60 || spanZ > 60) return say(`The home would be ${spanX.toFixed(0)} × ${spanZ.toFixed(0)} m. Please check the scale.`);
  const r2 = v => Math.round(v * 100) / 100, pt = p => ({ x: r2((p.x - x0) / m), z: r2((p.z - z0) / m), ...(p.w ? { w: p.w } : {}) });
  const layout = { v: 1, id: S.id, name: S.name.trim() || 'Custom home', rooms: S.rooms.map(r => ({ type: r.type, name: r.name.trim(), x0: r2((r.x0 - x0) / m), z0: r2((r.z0 - z0) / m), x1: r2((r.x1 - x0) / m), z1: r2((r.z1 - z0) / m) })), doors: S.doors.map(pt), windows: S.windows.map(pt), entry: S.entry ? pt(S.entry) : null };
  close(); onDone(layout);
}
