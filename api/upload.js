// POST   /api/upload?kind=posters&key=im&ext=webp   (raw image body) → { url }   admin only
// DELETE /api/upload?url=<image url>                                   → { ok }    admin only
import { r2Put, r2Del, keyFromUrl } from "./_r2.js";
import { json, storageReady, isAdmin, KINDS, BRAND_KEYS, isOurBlob } from "./_lib.js";

const MAX = 4_400_000; // Vercel Functions accept request bodies up to ~4.5 MB
const EXT = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "image/avif": "avif", "image/gif": "gif" };

export async function POST(request) {
  if (!isAdmin(request)) return json({ error: "Wrong admin password." }, 401);
  if (!storageReady()) return json({ error: "R2 storage isn't connected to this project." }, 503);
  const q = new URL(request.url).searchParams;
  const kind = q.get("kind"), key = q.get("key") || "";
  const type = (request.headers.get("content-type") || "").split(";")[0].trim();
  if (!KINDS.includes(kind) || !/^[\w-]{1,60}$/.test(key)) return json({ error: "Unknown image slot." }, 400);
  if (kind === "brand" && !BRAND_KEYS.includes(key)) return json({ error: "Unknown image slot." }, 400);
  // SVG is accepted only for the logo and favicon (shown through <img>/<link>, never inlined).
  const ext = EXT[type] || (kind === "brand" && type === "image/svg+xml" ? "svg" : null);
  if (!ext) return json({ error: kind === "brand" ? "Use an SVG, PNG, WebP or JPG image." : "Use a JPG, PNG, WebP, AVIF or GIF image." }, 415);
  const buf = Buffer.from(await request.arrayBuffer());
  if (!buf.length) return json({ error: "The file is empty." }, 400);
  if (buf.length > MAX) return json({ error: "The image is larger than 4.4 MB after compression." }, 413);
  const url = await r2Put(`images/${kind}/${key}-${Date.now()}.${ext}`, buf, type);
  return json({ url });
}

export async function DELETE(request) {
  if (!isAdmin(request)) return json({ error: "Wrong admin password." }, 401);
  if (!storageReady()) return json({ error: "R2 storage isn't connected to this project." }, 503);
  const url = new URL(request.url).searchParams.get("url") || "";
  if (!isOurBlob(url) || !/\/images\//.test(url)) return json({ error: "Not an uploaded image." }, 400);
  await r2Del(keyFromUrl(url));
  return json({ ok: true });
}
