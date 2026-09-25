// Front door for the static site, plus the shared keepy-uppy record.
// Sends every alias host (www., the workers.dev address) and any plain-HTTP request
// to the canonical https origin with a 301, answers /api/keepy, and lets static
// assets serve everything else.
const CANONICAL_HOST = 'ronipradhan.dev';
const LOCAL = new Set(['localhost', '127.0.0.1']);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!LOCAL.has(url.hostname) && (url.hostname !== CANONICAL_HOST || url.protocol !== 'https:')) {
      url.hostname = CANONICAL_HOST;
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname.startsWith('/api/keepy')) return keepy(request, env, url);
    return env.ASSETS.fetch(request);
  },
};

// ---------------------------------------------------------------------------
// Keepy-uppy record.
//   GET  /api/keepy          -> { score, name, at }
//   POST /api/keepy/start    -> { ticket }   (a signed, single-use ticket for one round)
//   POST /api/keepy          <- { score, name, ticket }
//        201 { score, name, at } when it beats the record, 409 with the current record otherwise.
// A score is only accepted if it was possible in the time since the ticket was issued.
const MAX_KICKS_PER_SEC = 8;       // generous: a fast human manages about 5
const MAX_SCORE = 999;
const TICKET_TTL_MS = 30 * 60 * 1000;
const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} .'_-]{0,19}$/u;

async function keepy(request, env, url) {
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
  const record = async () => (await env.KEEPY.get('record', 'json')) || { score: 0, name: '', at: null };

  if (request.method === 'GET' && url.pathname === '/api/keepy') return json(await record());
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  // only the page itself may post
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== url.host) return json({ error: 'forbidden' }, 403);

  const key = await signingKey(env);
  if (url.pathname === '/api/keepy/start') {
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const ts = Date.now();
    return json({ ticket: `${id}.${ts}.${await sign(key, `${id}.${ts}`)}` });
  }
  if (url.pathname !== '/api/keepy') return json({ error: 'not found' }, 404);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  const score = Number(body.score), name = String(body.name || '').trim().replace(/\s+/g, ' '), ticket = String(body.ticket || '');
  if (!Number.isInteger(score) || score < 1 || score > MAX_SCORE) return json({ error: 'bad score' }, 400);
  if (!NAME_RE.test(name)) return json({ error: 'Use 1–20 letters, numbers or spaces.' }, 400);

  const [id, ts, sig] = ticket.split('.');
  if (!id || !ts || !sig || sig !== await sign(key, `${id}.${ts}`)) return json({ error: 'bad ticket' }, 400);
  const elapsed = Date.now() - Number(ts);
  if (!(elapsed >= 0 && elapsed <= TICKET_TTL_MS)) return json({ error: 'ticket expired' }, 400);
  if (score > 2 + (elapsed / 1000) * MAX_KICKS_PER_SEC) return json({ error: 'too fast' }, 400);
  if (await env.KEEPY.get(`used:${id}`)) return json({ error: 'ticket used' }, 400);
  await env.KEEPY.put(`used:${id}`, '1', { expirationTtl: 3600 });

  const current = await record();
  if (score <= current.score) return json(current, 409);
  const next = { score, name, at: new Date().toISOString() };
  await env.KEEPY.put('record', JSON.stringify(next));
  return json(next, 201);
}

// HMAC key for tickets, generated once and kept in KV (never sent to the browser).
let cachedKey;
async function signingKey(env) {
  if (cachedKey) return cachedKey;
  let raw = await env.KEEPY.get('secret');
  if (!raw) {
    raw = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
    await env.KEEPY.put('secret', raw);
  }
  const bytes = new Uint8Array(raw.match(/../g).map((h) => parseInt(h, 16)));
  cachedKey = await crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return cachedKey;
}
async function sign(key, text) {
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)));
  return btoa(String.fromCharCode(...mac)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
