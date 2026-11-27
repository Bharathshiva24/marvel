// GET /api/fetch?url=<https image url>  → the image bytes   admin only
// Lets the admin paste an image *address* copied from another site; the browser can't read
// those directly because of CORS, so the server fetches it once and hands the bytes back.
import { json, isAdmin } from "./_lib.js";

const MAX = 15_000_000;
const PRIVATE = /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|\[?f[cd][0-9a-f]{2}:)/i;

export async function GET(request) {
  if (!isAdmin(request)) return json({ error: "Wrong admin password." }, 401);
  let u;
  try { u = new URL(new URL(request.url).searchParams.get("url") || ""); } catch { return json({ error: "That isn't a valid link." }, 400); }
  if (u.protocol !== "https:" || PRIVATE.test(u.hostname) || /\.(internal|local)$/i.test(u.hostname)) return json({ error: "Use a public https image link." }, 400);
  let r;
  try {
    r = await fetch(u, { redirect: "follow", signal: AbortSignal.timeout(12000), headers: { "user-agent": "Mozilla/5.0 (TheTimeline admin image import)", accept: "image/*" } });
  } catch { return json({ error: "Couldn't reach that link." }, 502); }
  if (!r.ok) return json({ error: `That link returned ${r.status}.` }, 502);
  const type = (r.headers.get("content-type") || "").split(";")[0].trim();
  if (!/^image\/(jpeg|png|webp|avif|gif)$/.test(type)) return json({ error: "That link isn't a JPG, PNG, WebP, AVIF or GIF image." }, 415);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX) return json({ error: "That image is larger than 15 MB." }, 413);
  return new Response(buf, { headers: { "content-type": type, "cache-control": "no-store" } });
}
