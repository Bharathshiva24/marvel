// GET  /api/content  → the latest published content (public). Adds `authed` when an admin key is sent.
// PUT  /api/content  → publish new content (admin only).
// The live copy is always content/latest.json, so reading it is one cheap R2 read and never a bucket listing.
// Each save also writes a dated backup copy under content/history/.
import { r2Put, r2GetJSON } from "./_r2.js";
import { json, storageReady, passwordSet, isAdmin, cleanContent } from "./_lib.js";

const EMPTY = { posters: {}, characters: {}, other: {}, planets: {}, brand: {}, videos: {}, updated: "" };
const LATEST = "content/latest.json";

export async function GET(request) {
  const authed = isAdmin(request);
  if (!storageReady()) return json({ configured: false, password: passwordSet(), authed, content: null });
  try {
    const saved = await r2GetJSON(LATEST);
    const res = json({ configured: true, password: passwordSet(), authed, content: { ...EMPTY, ...(saved || {}) } });
    // Visitors poll this every minute; let Vercel's edge serve a copy for 30 s so R2 isn't hit on every view.
    if (!request.headers.get("x-admin-key")) res.headers.set("cache-control", "public, max-age=0, s-maxage=30, stale-while-revalidate=60");
    return res;
  } catch (e) {
    return json({ configured: true, password: passwordSet(), authed, content: null, error: "Couldn't read saved content." }, 500);
  }
}

export async function PUT(request) {
  if (!passwordSet()) return json({ error: "ADMIN_PASSWORD is not set in Vercel." }, 503);
  if (!isAdmin(request)) return json({ error: "Wrong admin password." }, 401);
  if (!storageReady()) return json({ error: "R2 storage isn't connected to this project." }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  const content = { ...cleanContent(body), updated: new Date().toISOString() };
  const text = JSON.stringify(content);
  await r2Put(LATEST, text, "application/json", "no-store");
  try { await r2Put(`content/history/content-${String(Date.now()).padStart(15, "0")}.json`, text, "application/json", "no-store"); } catch {}
  return json({ ok: true, content });
}
