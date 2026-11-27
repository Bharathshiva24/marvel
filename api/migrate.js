// POST /api/migrate  (admin only) → copies images and watchlists from the old Vercel Blob store into R2.
// Safe to run again: anything already copied is skipped, so if it stops partway just press the button again.
// Optional JSON body { from: "<url of a content-….json file in Blob>" } when Blob can't be listed.
import { list } from "@vercel/blob";
import { r2Put, r2GetJSON } from "./_r2.js";
import { json, storageReady, isAdmin, KINDS } from "./_lib.js";

export const maxDuration = 300;
const BLOB = /^https:\/\/[\w.-]+\.public\.blob\.vercel-storage\.com\//;
const pathOf = (u) => decodeURIComponent(new URL(u).pathname.slice(1));

async function listAll(prefix) {
  const out = []; let cursor;
  do { const r = await list({ prefix, cursor, limit: 1000 }); out.push(...r.blobs); cursor = r.hasMore ? r.cursor : undefined; } while (cursor);
  return out;
}

export async function POST(request) {
  if (!isAdmin(request)) return json({ error: "Wrong admin password." }, 401);
  if (!storageReady()) return json({ error: "R2 isn't set up yet." }, 503);
  let from = "";
  try { from = String((await request.json()).from || "").trim(); } catch {}
  if (from && !BLOB.test(from)) return json({ error: "That link isn't a Vercel Blob address." }, 400);

  // 1. Find the newest saved content in Blob.
  let blobs = [];
  if (!from) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return json({ error: "BLOB_READ_WRITE_TOKEN isn't set in Vercel, so the old store can't be found. Paste the content file link instead." }, 400);
    try { blobs = await listAll(""); }
    catch (e) { return json({ error: "Vercel Blob refused the request (the store may still be paused): " + String(e.message || e).slice(0, 160) }, 502); }
    const latest = blobs.filter((b) => b.pathname.startsWith("content/")).sort((a, b) => (a.pathname < b.pathname ? 1 : -1))[0];
    if (!latest) return json({ error: "No saved content found in Vercel Blob." }, 404);
    from = latest.url;
  }
  const res = await fetch(from, { cache: "no-store" });
  if (!res.ok) return json({ error: `Couldn't download the saved content from Blob (${res.status}). The store may still be paused.` }, 502);
  const old = await res.json();

  // 2. Start from what's already in R2 and copy what's missing.
  const cur = (await r2GetJSON("content/latest.json")) || {};
  const out = { posters: {}, characters: {}, other: {}, planets: {}, brand: {}, videos: {}, ...cur };
  for (const k of KINDS) out[k] = { ...(out[k] || {}) };
  if (!Object.keys(out.videos || {}).length && old.videos) out.videos = old.videos;

  const jobs = [];
  for (const kind of KINDS) for (const [key, url] of Object.entries(old[kind] || {})) if (typeof url === "string" && BLOB.test(url) && !out[kind][key]) jobs.push({ kind, key, url });
  const failed = []; let copied = 0, i = 0;
  const started = Date.now();
  async function worker() {
    while (i < jobs.length && Date.now() - started < 240_000) {
      const j = jobs[i++];
      try {
        const r = await fetch(j.url);
        if (!r.ok) throw new Error(String(r.status));
        out[j.kind][j.key] = await r2Put(pathOf(j.url), Buffer.from(await r.arrayBuffer()), r.headers.get("content-type") || "image/webp");
        copied++;
      } catch (e) { failed.push(`${j.kind}/${j.key} (${e.message})`); }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  out.updated = new Date().toISOString();
  await r2Put("content/latest.json", JSON.stringify(out), "application/json", "no-store");

  // 3. Watchlists (only when Blob could be listed): newest file per user → users/<id>.json
  let lists = 0;
  const newest = {};
  for (const b of blobs) if (b.pathname.startsWith("users/")) { const id = b.pathname.split("/")[1]; if (!newest[id] || b.pathname > newest[id].pathname) newest[id] = b; }
  for (const [id, b] of Object.entries(newest)) {
    try { if (await r2GetJSON(`users/${id}.json`)) continue; const r = await fetch(b.url); if (r.ok) { await r2Put(`users/${id}.json`, await r.text(), "application/json", "no-store"); lists++; } } catch {}
  }

  const left = jobs.length - copied - failed.length;
  return json({ ok: true, found: jobs.length, copied, failed, left, lists });
}
