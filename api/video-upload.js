// POST /api/video-upload  { type, size }  → { put, url }   admin only
// Returns a 15-minute signed link so the admin page can upload the home-page background video straight to R2.
// The bucket's CORS policy must allow PUT from this site (see README).
import { r2PresignPut, publicUrl } from "./_r2.js";
import { json, storageReady, isAdmin } from "./_lib.js";

const TYPES = { "video/mp4": "mp4", "video/webm": "webm" };
const MAX = 80 * 1024 * 1024;

export async function POST(request) {
  if (!isAdmin(request)) return json({ error: "Wrong admin password." }, 401);
  if (!storageReady()) return json({ error: "R2 storage isn't connected to this project." }, 503);
  let body = {};
  try { body = await request.json(); } catch {}
  const ext = TYPES[body.type];
  if (!ext) return json({ error: "Use an MP4 or WebM video." }, 415);
  if (!(body.size > 0) || body.size > MAX) return json({ error: "The video must be under 80 MB." }, 413);
  const key = `images/other/hero_video-${Date.now()}.${ext}`;
  return json({ put: await r2PresignPut(key), url: publicUrl(key), type: body.type });
}
