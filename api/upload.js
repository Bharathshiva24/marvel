// POST   /api/upload?kind=posters&key=im&ext=webp   (raw image body) → { url }   admin only
// DELETE /api/upload?url=<blob url>                                   → { ok }    admin only
import { put, del } from "@vercel/blob";
import { json, storageReady, isAdmin, KINDS, isOurBlob } from "./_lib.js";

const MAX = 4_400_000; // Vercel Functions accept request bodies up to ~4.5 MB
const EXT = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "image/avif": "avif", "image/gif": "gif" };

export async function POST(request) {
  if (!isAdmin(request)) return json({ error: "Wrong admin password." }, 401);
  if (!storageReady()) return json({ error: "Blob storage isn't connected to this project." }, 503);
  const q = new URL(request.url).searchParams;
  const kind = q.get("kind"), key = q.get("key") || "";
  const type = (request.headers.get("content-type") || "").split(";")[0].trim();
  if (!KINDS.includes(kind) || !/^[\w-]{1,60}$/.test(key)) return json({ error: "Unknown image slot." }, 400);
  if (!EXT[type]) return json({ error: "Use a JPG, PNG, WebP, AVIF or GIF image." }, 415);
  const buf = Buffer.from(await request.arrayBuffer());
  if (!buf.length) return json({ error: "The file is empty." }, 400);
  if (buf.length > MAX) return json({ error: "The image is larger than 4.4 MB after compression." }, 413);
  const blob = await put(`images/${kind}/${key}-${Date.now()}.${EXT[type]}`, buf, {
    access: "public", contentType: type, addRandomSuffix: false, cacheControlMaxAge: 31536000,
  });
  return json({ url: blob.url });
}

export async function DELETE(request) {
  if (!isAdmin(request)) return json({ error: "Wrong admin password." }, 401);
  if (!storageReady()) return json({ error: "Blob storage isn't connected to this project." }, 503);
  const url = new URL(request.url).searchParams.get("url") || "";
  if (!isOurBlob(url) || !/\/images\//.test(url)) return json({ error: "Not an uploaded image." }, 400);
  await del(url);
  return json({ ok: true });
}
