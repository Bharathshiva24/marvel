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
    // Not cached: the answer differs for the admin (authed) and visitors. One R2 read per call is well inside the free tier.
    return json({ configured: true, password: passwordSet(), authed, content: { ...EMPTY, ...(saved || {}) } });
  } catch (e) {
    return json({ configured: true, password: passwordSet(), authed, content: null, error: "Couldn't read saved content.", detail: String(e && e.message || e).slice(0, 240) }, 500);
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
