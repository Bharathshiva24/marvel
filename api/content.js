// GET  /api/content  → the latest published content (public). Adds `authed` when an admin key is sent.
// PUT  /api/content  → publish new content (admin only). Each save is a new immutable JSON file,
//                      so visitors never get a stale cached copy.
import { put, list, del } from "@vercel/blob";
import { json, storageReady, passwordSet, isAdmin, cleanContent } from "./_lib.js";

const EMPTY = { posters: {}, characters: {}, other: {}, videos: {}, updated: "" };

async function versions() {
  const { blobs } = await list({ prefix: "content/", limit: 1000 });
  return blobs.sort((a, b) => (a.pathname < b.pathname ? 1 : -1));
}

export async function GET(request) {
  const authed = isAdmin(request);
  if (!storageReady()) return json({ configured: false, password: passwordSet(), authed, content: null });
  try {
    const [latest] = await versions();
    let content = EMPTY;
    if (latest) {
      const r = await fetch(latest.url, { cache: "no-store" });
      if (r.ok) content = { ...EMPTY, ...(await r.json()) };
    }
    return json({ configured: true, password: passwordSet(), authed, content });
  } catch (e) {
    return json({ configured: true, password: passwordSet(), authed, content: null, error: "Couldn't read saved content." }, 500);
  }
}

export async function PUT(request) {
  if (!passwordSet()) return json({ error: "ADMIN_PASSWORD is not set in Vercel." }, 503);
  if (!isAdmin(request)) return json({ error: "Wrong admin password." }, 401);
  if (!storageReady()) return json({ error: "Blob storage isn't connected to this project." }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  const content = { ...cleanContent(body), updated: new Date().toISOString() };
  const stamp = String(Date.now()).padStart(15, "0");
  await put(`content/content-${stamp}.json`, JSON.stringify(content), {
    access: "public", contentType: "application/json", addRandomSuffix: false,
  });
  // Keep the 10 most recent versions as a safety net; remove the rest.
  try {
    const old = (await versions()).slice(10).map((b) => b.url);
    if (old.length) await del(old);
  } catch {}
  return json({ ok: true, content });
}
