// Optional Google sign-in so visitors can keep their watchlist and watched titles across devices.
// GET    /api/me   → { clientId, user, data }          (user is null when signed out)
// POST   /api/me   { credential }  → signs in with a Google ID token, sets a session cookie
// PUT    /api/me   { l:[], w:[] }  → saves the signed-in user's lists
// DELETE /api/me   → signs out
import { createHmac, timingSafeEqual } from "node:crypto";
import { put, list, del } from "@vercel/blob";
import { storageReady } from "./_lib.js";

const CLIENT_ID = () => process.env.GOOGLE_CLIENT_ID || "";
const SECRET = () => process.env.SESSION_SECRET || process.env.BLOB_READ_WRITE_TOKEN || "";
const COOKIE = "tl_s";
const MAX_AGE = 60 * 60 * 24 * 60; // 60 days
const ID_RE = /^[\w-]{1,40}$/;

const b64 = (s) => Buffer.from(s).toString("base64url");
const sign = (v) => createHmac("sha256", SECRET()).update(v).digest("base64url");
const userKey = (sub) => createHmac("sha256", SECRET()).update("user:" + sub).digest("hex").slice(0, 40);

function reply(data, status = 200, cookie) {
  const h = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
  if (cookie !== undefined) h["set-cookie"] = cookie;
  return new Response(JSON.stringify(data), { status, headers: h });
}
const cookieFor = (val, age) => `${COOKIE}=${val}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`;

function session(request) {
  const m = (request.headers.get("cookie") || "").match(/(?:^|;\s*)tl_s=([\w-]+\.[\w-]+)/);
  if (!m || !SECRET()) return null;
  const [p, s] = m[1].split(".");
  const a = Buffer.from(s), b = Buffer.from(sign(p));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const u = JSON.parse(Buffer.from(p, "base64url").toString());
    return u.exp > Date.now() / 1000 ? u : null;
  } catch { return null; }
}

async function load(u) {
  const { blobs } = await list({ prefix: `users/${userKey(u.sub)}/`, limit: 100 });
  blobs.sort((a, b) => (a.pathname < b.pathname ? 1 : -1));
  if (!blobs[0]) return { data: { l: [], w: [] }, blobs };
  const r = await fetch(blobs[0].url, { cache: "no-store" });
  return { data: r.ok ? await r.json() : { l: [], w: [] }, blobs };
}
const clean = (a) => [...new Set((Array.isArray(a) ? a : []).filter((x) => typeof x === "string" && ID_RE.test(x)))].slice(0, 500);
const pub = (u) => ({ name: u.name, email: u.email, picture: u.picture });

export async function GET(request) {
  const clientId = CLIENT_ID(), u = session(request);
  if (!u || !storageReady()) return reply({ clientId, user: null });
  try { const { data } = await load(u); return reply({ clientId, user: pub(u), data }); }
  catch { return reply({ clientId, user: pub(u), data: null, error: "Couldn't load your lists." }, 500); }
}

export async function POST(request) {
  if (!CLIENT_ID() || !SECRET()) return reply({ error: "Google sign-in isn't set up yet." }, 503);
  let credential = "";
  try { ({ credential } = await request.json()); } catch {}
  if (typeof credential !== "string" || credential.length > 4096) return reply({ error: "Missing Google credential." }, 400);
  // Google's tokeninfo endpoint checks the signature and expiry; we check the audience and issuer.
  const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential), { cache: "no-store" });
  if (!r.ok) return reply({ error: "Google couldn't verify that sign-in." }, 401);
  const t = await r.json();
  if (t.aud !== CLIENT_ID() || !["accounts.google.com", "https://accounts.google.com"].includes(t.iss) || !t.sub || +t.exp < Date.now() / 1000)
    return reply({ error: "Google couldn't verify that sign-in." }, 401);
  const u = { sub: t.sub, email: t.email || "", name: (t.name || t.given_name || t.email || "").slice(0, 80), picture: /^https:\/\/[\w.-]+\.googleusercontent\.com\//.test(t.picture || "") ? t.picture : "", exp: Math.floor(Date.now() / 1000) + MAX_AGE };
  const p = b64(JSON.stringify(u));
  let data = { l: [], w: [] };
  try { if (storageReady()) data = (await load(u)).data; } catch {}
  return reply({ clientId: CLIENT_ID(), user: pub(u), data }, 200, cookieFor(`${p}.${sign(p)}`, MAX_AGE));
}

export async function PUT(request) {
  const u = session(request);
  if (!u) return reply({ error: "Sign in to save your lists." }, 401);
  if (!storageReady()) return reply({ error: "Storage isn't connected." }, 503);
  let body = {};
  try { body = await request.json(); } catch {}
  const data = { l: clean(body.l), w: clean(body.w), updated: new Date().toISOString() };
  const { blobs } = await load(u);
  await put(`users/${userKey(u.sub)}/${Date.now()}.json`, JSON.stringify(data), { access: "public", contentType: "application/json", addRandomSuffix: true, cacheControlMaxAge: 60 });
  const old = blobs.slice(2).map((b) => b.url); // keep a couple of recent versions
  if (old.length) await del(old).catch(() => {});
  return reply({ ok: true, data });
}

export async function DELETE() {
  return reply({ ok: true }, 200, cookieFor("", 0));
}
