import { timingSafeEqual } from "node:crypto";

export const KINDS = ["posters", "characters", "other"];
export const VIDEO_TYPES = ["trailer", "teaser", "bts", "clip"];

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export const storageReady = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
export const passwordSet = () => Boolean(process.env.ADMIN_PASSWORD);

export function isAdmin(request) {
  const expected = process.env.ADMIN_PASSWORD || "";
  const given = request.headers.get("x-admin-key") || "";
  if (!expected || !given) return false;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const KEY_RE = /^[\w-]{1,60}$/;
const isBlobUrl = (v) => typeof v === "string" && v.length < 600 && /^https:\/\/[\w.-]+\.public\.blob\.vercel-storage\.com\//.test(v);

/** Keep only well-formed fields so nothing unexpected is ever served to visitors. */
export function cleanContent(body) {
  const out = { posters: {}, characters: {}, other: {}, videos: {} };
  for (const kind of KINDS) {
    const src = body && typeof body[kind] === "object" ? body[kind] : {};
    for (const [k, v] of Object.entries(src).slice(0, 600)) if (KEY_RE.test(k) && isBlobUrl(v)) out[kind][k] = v;
  }
  const vids = body && typeof body.videos === "object" ? body.videos : {};
  for (const [id, list] of Object.entries(vids).slice(0, 200)) {
    if (!KEY_RE.test(id) || !Array.isArray(list)) continue;
    const clean = list
      .filter((v) => v && typeof v.yt === "string" && /^[\w-]{11}$/.test(v.yt))
      .slice(0, 24)
      .map((v) => ({ t: VIDEO_TYPES.includes(v.t) ? v.t : "clip", yt: v.yt, l: String(v.l || "").slice(0, 80) }));
    if (clean.length) out.videos[id] = clean;
  }
  return out;
}

export const isOurBlob = isBlobUrl;
