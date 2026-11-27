// One-time copy of everything from Vercel Blob into Cloudflare R2.
//
// Run on your own computer, from the repo folder:
//   npm install
//   BLOB_READ_WRITE_TOKEN=...  R2_ACCOUNT_ID=...  R2_ACCESS_KEY_ID=...  R2_SECRET_ACCESS_KEY=...  \
//   R2_BUCKET=...  R2_PUBLIC_URL=https://pub-xxxx.r2.dev  node scripts/migrate-blob-to-r2.mjs
//
// It finds the newest saved content file, copies every image it points to into R2 under the
// same path, rewrites the links to the R2 address and saves the result as content/latest.json.
// It also copies each signed-in visitor's watchlist. Safe to run more than once.
//
// While the Blob store is paused, the listing step can fail. Then pass the newest content file's
// address yourself (Vercel → Storage → your Blob store → Browser → content/ → copy URL):
//   CONTENT_URL=https://xxxx.public.blob.vercel-storage.com/content/content-....json  node scripts/migrate-blob-to-r2.mjs
import { list } from "@vercel/blob";
import { r2Put, r2Ready, publicUrl } from "../api/_r2.js";

if (!r2Ready()) { console.error("Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_PUBLIC_URL first."); process.exit(1); }
const BLOB = /^https:\/\/[\w.-]+\.public\.blob\.vercel-storage\.com\//;
const pathOf = (u) => decodeURIComponent(new URL(u).pathname.slice(1));

async function listAll(prefix) {
  const out = []; let cursor;
  do { const r = await list({ prefix, cursor, limit: 1000 }); out.push(...r.blobs); cursor = r.hasMore ? r.cursor : undefined; } while (cursor);
  return out;
}
async function copy(url, cacheControl) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download failed (${r.status})`);
  return r2Put(pathOf(url), Buffer.from(await r.arrayBuffer()), r.headers.get("content-type") || "application/octet-stream", cacheControl);
}

// 1. Find the newest content file.
let contentUrl = process.env.CONTENT_URL, users = [];
if (!contentUrl) {
  try {
    const all = await listAll("");
    const content = all.filter((b) => b.pathname.startsWith("content/")).sort((a, b) => (a.pathname < b.pathname ? 1 : -1));
    contentUrl = content[0]?.url;
    users = all.filter((b) => b.pathname.startsWith("users/"));
  } catch (e) {
    console.error("Couldn't list the Blob store (it may still be paused):", e.message, "\nSet CONTENT_URL and run again — see the top of this file.");
    process.exit(1);
  }
}
if (!contentUrl) { console.log("No saved content in Blob — nothing to migrate."); process.exit(0); }
const content = await (await fetch(contentUrl)).json();

// 2. Copy every image and swap its link.
let ok = 0; const failed = [];
for (const [kind, map] of Object.entries(content)) {
  if (!map || typeof map !== "object" || kind === "videos") continue;
  for (const [key, url] of Object.entries(map)) {
    if (typeof url !== "string" || !BLOB.test(url)) continue;
    try { map[key] = await copy(url); ok++; console.log("✓", kind, key); }
    catch (e) { failed.push(`${kind}/${key}`); delete map[key]; console.log("✗", kind, key, e.message); }
  }
}
await r2Put("content/latest.json", JSON.stringify(content), "application/json", "no-store");
console.log(`\nImages copied: ${ok}. Saved ${publicUrl("content/latest.json")}`);
if (failed.length) console.log(`Couldn't copy ${failed.length} (re-upload these in /admin): ${failed.join(", ")}`);

// 3. Watchlists: keep the newest file per user as users/<hash>.json.
const newest = {};
for (const b of users) { const id = b.pathname.split("/")[1]; if (!newest[id] || b.pathname > newest[id].pathname) newest[id] = b; }
for (const [id, b] of Object.entries(newest)) {
  try { const r = await fetch(b.url); if (r.ok) await r2Put(`users/${id}.json`, await r.text(), "application/json", "no-store"); } catch {}
}
if (users.length) console.log(`Watchlists copied: ${Object.keys(newest).length}`);
