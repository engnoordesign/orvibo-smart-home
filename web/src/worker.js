// Digital Home website — Cloudflare Worker.
// Serves the static site (public/) and a small API that stores the site content, the photos and the
// admin account in a KV namespace bound as CONTENT.
//
// Admin account: set the secrets ADMIN_USER and ADMIN_PASSWORD on the Worker. After signing in, the
// admin can change them from the panel; the new ones are stored (hashed) in KV and take precedence.

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const SESSION_HOURS = 12, MAX_CONTENT = 2_000_000, MAX_IMAGE = 8_000_000;

async function hmac(key, msg) { const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return b64u(await crypto.subtle.sign('HMAC', k, enc.encode(msg))); }
async function pbkdf2(pass, salt) { const k = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']); return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 }, k, 256)); }
// compare without leaking timing: HMAC both sides with a random key
async function same(a, b) { const k = hex(crypto.getRandomValues(new Uint8Array(16))); return (await hmac(k, String(a))) === (await hmac(k, String(b))); }

async function secret(env) {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  let s = await env.CONTENT.get('auth:secret');
  if (!s) { s = hex(crypto.getRandomValues(new Uint8Array(32))); await env.CONTENT.put('auth:secret', s); }
  return s;
}
async function account(env) {
  const stored = env.CONTENT ? await env.CONTENT.get('auth:account', 'json') : null;
  if (stored && stored.user && stored.hash) return { kind: 'stored', ...stored };
  if (env.ADMIN_USER && env.ADMIN_PASSWORD) return { kind: 'env', user: env.ADMIN_USER };
  return null;
}
async function checkPassword(env, acc, pass) { return acc.kind === 'stored' ? same(await pbkdf2(pass, acc.salt), acc.hash) : same(pass, env.ADMIN_PASSWORD); }
async function sessionUser(req, env) {
  const m = (req.headers.get('cookie') || '').match(/(?:^|;\s*)dh_s=([^;]+)/); if (!m) return null;
  const [user64, exp, sig] = decodeURIComponent(m[1]).split('.'); if (!user64 || !exp || !sig || Date.now() > +exp) return null;
  const acc = await account(env); if (!acc) return null;
  const user = atob(user64.replace(/-/g, '+').replace(/_/g, '/'));
  // the account version is signed too, so changing the password signs everyone out
  const good = await hmac(await secret(env), `${user64}.${exp}.${acc.salt || 'env'}`);
  return (await same(good, sig)) && user === acc.user ? user : null;
}
async function cookieFor(env, user, acc) {
  const exp = Date.now() + SESSION_HOURS * 3600e3, user64 = b64u(enc.encode(user)), sig = await hmac(await secret(env), `${user64}.${exp}.${acc.salt || 'env'}`);
  return `dh_s=${encodeURIComponent(`${user64}.${exp}.${sig}`)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`;
}
async function tooMany(env, ip) { const n = +(await env.CONTENT.get('rl:' + ip) || 0); return n >= 10; }
async function failed(env, ip) { const k = 'rl:' + ip, n = +(await env.CONTENT.get(k) || 0) + 1; await env.CONTENT.put(k, String(n), { expirationTtl: 900 }); }

async function api(req, env, path) {
  const method = req.method;
  if (path === 'status') return json({ app: 'digital-home', storage: !!env.CONTENT });
  if (!env.CONTENT) return json({ error: 'storage not connected: add a KV binding named CONTENT' }, 503);
  // every change must come from this site's own pages (blocks cross-site requests)
  if (method !== 'GET' && req.headers.get('x-dh') !== '1') return json({ error: 'forbidden' }, 403);

  if (path === 'content' && method === 'GET') return json({ content: await env.CONTENT.get('content', 'json') });
  if (path === 'me') { const acc = await account(env); return json({ configured: !!acc, user: await sessionUser(req, env) }); }
  if (path === 'login' && method === 'POST') {
    const ip = req.headers.get('cf-connecting-ip') || 'x';
    if (await tooMany(env, ip)) return json({ error: 'locked' }, 429);
    const acc = await account(env); if (!acc) return json({ error: 'not configured' }, 503);
    let body; try { body = await req.json(); } catch (e) { return json({ error: 'invalid' }, 400); }
    const ok = (await same(String(body.user || ''), acc.user)) & (await checkPassword(env, acc, String(body.pass || '')));
    if (!ok) { await failed(env, ip); return json({ error: 'invalid' }, 401); }
    return json({ user: acc.user }, 200, { 'set-cookie': await cookieFor(env, acc.user, acc) });
  }
  if (path === 'logout' && method === 'POST') return json({ ok: true }, 200, { 'set-cookie': 'dh_s=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0' });
  if (path.startsWith('img/') && method === 'GET') {
    const { value, metadata } = await env.CONTENT.getWithMetadata('img:' + path.slice(4), 'arrayBuffer');
    if (!value) return new Response('not found', { status: 404 });
    return new Response(value, { headers: { 'content-type': metadata?.type || 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable' } });
  }

  // ---------- everything below needs the admin ----------
  const user = await sessionUser(req, env); if (!user) return json({ error: 'unauthorized' }, 401);
  if (path === 'content' && method === 'PUT') {
    const text = await req.text(); if (text.length > MAX_CONTENT) return json({ error: 'content too large' }, 413);
    let data; try { data = JSON.parse(text); } catch (e) { return json({ error: 'invalid json' }, 400); }
    if (!data || data.v !== 1) return json({ error: 'invalid content' }, 400);
    await env.CONTENT.put('content', JSON.stringify(data)); return json({ ok: true });
  }
  if (path === 'upload' && method === 'POST') {
    const type = (req.headers.get('content-type') || '').split(';')[0];
    if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) return json({ error: 'only images' }, 415);
    const buf = await req.arrayBuffer(); if (buf.byteLength > MAX_IMAGE) return json({ error: 'image too large' }, 413);
    const id = hex(crypto.getRandomValues(new Uint8Array(12)));
    await env.CONTENT.put('img:' + id, buf, { metadata: { type } }); return json({ url: '/api/img/' + id });
  }
  if (path.startsWith('img/') && method === 'DELETE') { await env.CONTENT.delete('img:' + path.slice(4)); return json({ ok: true }); }
  if (path === 'password' && method === 'POST') {
    let body; try { body = await req.json(); } catch (e) { return json({ error: 'invalid' }, 400); }
    const acc = await account(env); if (!(await checkPassword(env, acc, String(body.oldPass || '')))) return json({ error: 'wrong' }, 401);
    const nu = String(body.user || '').trim(), np = String(body.pass || '');
    if (!nu || np.length < 8) return json({ error: 'username required and password of at least 8 characters' }, 400);
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    const next = { user: nu, salt, hash: await pbkdf2(np, salt) };
    await env.CONTENT.put('auth:account', JSON.stringify(next));
    return json({ ok: true }, 200, { 'set-cookie': await cookieFor(env, nu, next) });
  }
  return json({ error: 'not found' }, 404);
}

const SECURITY = {
  'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'x-frame-options': 'SAMEORIGIN',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      try { const r = await api(req, env, url.pathname.slice(5)); for (const [k, v] of Object.entries(SECURITY)) r.headers.set(k, v); return r; }
      catch (e) { return json({ error: 'server error' }, 500); }
    }
    const res = await env.ASSETS.fetch(req), out = new Response(res.body, res);
    for (const [k, v] of Object.entries(SECURITY)) out.headers.set(k, v);
    if (url.pathname.endsWith('admin.html')) out.headers.set('cache-control', 'no-store');
    return out;
  },
};
