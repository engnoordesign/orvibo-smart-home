// Where the content lives.
//  • On Cloudflare (the Worker in /src): content, photos and the admin account are stored on the server,
//    so the admin's changes reach every visitor.
//  • Opened as plain files (or as a preview): content is kept in this browser only.
import { DEFAULT_CONTENT } from './content.js';

const LS_CONTENT = 'dh-web-content', LS_AUTH = 'dh-web-auth', LS_SESSION = 'dh-web-session';
const clone = o => JSON.parse(JSON.stringify(o));
let mode = null;                       // 'server' | 'local'

async function api(path, opt = {}) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), opt.timeout || 8000);
  try {
    const r = await fetch('/api/' + path, { credentials: 'same-origin', ...opt, signal: ctl.signal, headers: { 'X-DH': '1', ...(opt.body && !(opt.body instanceof Blob) ? { 'Content-Type': 'application/json' } : {}), ...(opt.headers || {}) } });
    const type = r.headers.get('content-type') || '';
    const data = type.includes('json') ? await r.json() : null;
    return { ok: r.ok, status: r.status, data, json: type.includes('json') };
  } finally { clearTimeout(timer); }
}
export async function detect() {
  if (mode) return mode;
  if (location.protocol === 'file:') return (mode = 'local');
  try { const r = await api('status', { timeout: 2500 }); mode = r.json && r.data && r.data.app === 'digital-home' ? 'server' : 'local'; } catch (e) { mode = 'local'; }
  return mode;
}
export const getMode = () => mode;

// fill in anything the saved content is missing (new sections, new fields) from the defaults
export function merge(saved) {
  const base = clone(DEFAULT_CONTENT);
  if (!saved || saved.v !== 1) return base;
  const deep = (b, s) => { for (const k in s) { if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) deep(b[k], s[k]); else b[k] = s[k]; } return b; };
  const out = deep(base, saved);
  // sections added in a later version go in after the section they follow in the defaults
  DEFAULT_CONTENT.sections.forEach((s, i) => { if (out.sections.some(x => x.id === s.id)) return; const prev = DEFAULT_CONTENT.sections[i - 1], at = prev ? out.sections.findIndex(x => x.id === prev.id) : -1; out.sections.splice(at + 1, 0, clone(s)); });
  return out;
}
export async function loadContent() {
  await detect();
  if (mode === 'server') { try { const r = await api('content'); if (r.ok && r.data && r.data.content) return merge(r.data.content); } catch (e) { /* fall back */ } return merge(null); }
  try { return merge(JSON.parse(localStorage.getItem(LS_CONTENT) || 'null')); } catch (e) { return merge(null); }
}
export async function saveContent(c) {
  await detect();
  const body = JSON.stringify(c);
  if (mode === 'server') { const r = await api('content', { method: 'PUT', body }); if (!r.ok) throw new Error(r.data?.error || 'save failed'); return; }
  try { localStorage.setItem(LS_CONTENT, body); } catch (e) { throw new Error('quota'); }
}
export function resetLocal() { try { localStorage.removeItem(LS_CONTENT); } catch (e) { /* ignore */ } }

// ---------- photos: resized in the browser before they are stored ----------
export async function prepareImage(file, max = 1600, q = 0.82) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(res => c.toBlob(res, 'image/jpeg', q));
  } finally { URL.revokeObjectURL(url); }
}
export async function uploadImage(file) {
  await detect();
  const blob = await prepareImage(file, mode === 'server' ? 1600 : 1000, mode === 'server' ? 0.82 : 0.72);
  if (mode === 'server') { const r = await api('upload', { method: 'POST', body: blob, headers: { 'Content-Type': 'image/jpeg' }, timeout: 30000 }); if (!r.ok) throw new Error(r.data?.error || 'upload failed'); return r.data.url; }
  return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
}

// ---------- admin account ----------
async function pbkdf2(pass, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100000 }, key, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const localAuth = () => { try { return JSON.parse(localStorage.getItem(LS_AUTH) || 'null'); } catch (e) { return null; } };
export async function authState() {
  await detect();
  if (mode === 'server') { try { const r = await api('me'); return { mode, user: r.data?.user || null, configured: !!r.data?.configured }; } catch (e) { return { mode, user: null, configured: false }; } }
  const a = localAuth(); let s = null; try { s = sessionStorage.getItem(LS_SESSION); } catch (e) { /* ignore */ }
  return { mode, configured: !!a, user: a && s === a.user ? a.user : null };
}
export async function createLocalAccount(user, pass) {
  const salt = crypto.getRandomValues(new Uint32Array(2)).join('-');
  localStorage.setItem(LS_AUTH, JSON.stringify({ user, salt, hash: await pbkdf2(pass, salt) }));
  try { sessionStorage.setItem(LS_SESSION, user); } catch (e) { /* ignore */ }
}
export async function login(user, pass) {
  await detect();
  if (mode === 'server') { const r = await api('login', { method: 'POST', body: JSON.stringify({ user, pass }) }); if (!r.ok) throw new Error(r.data?.error || 'login failed'); return r.data.user; }
  const a = localAuth(); if (!a || a.user !== user || (await pbkdf2(pass, a.salt)) !== a.hash) throw new Error('wrong');
  try { sessionStorage.setItem(LS_SESSION, user); } catch (e) { /* ignore */ }
  return user;
}
export async function logout() { await detect(); if (mode === 'server') await api('logout', { method: 'POST' }); try { sessionStorage.removeItem(LS_SESSION); } catch (e) { /* ignore */ } }
export async function changeAccount(oldPass, user, pass) {
  await detect();
  if (mode === 'server') { const r = await api('password', { method: 'POST', body: JSON.stringify({ oldPass, user, pass }) }); if (!r.ok) throw new Error(r.data?.error || 'failed'); return; }
  const a = localAuth(); if (!a || (await pbkdf2(oldPass, a.salt)) !== a.hash) throw new Error('wrong');
  await createLocalAccount(user, pass);
}
