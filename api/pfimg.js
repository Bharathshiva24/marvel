// GET /api/pfimg?id=<poster id>[&v=<version>] → the Posterflix poster image, served from this site.
// WebGL needs images from the same origin (Posterflix doesn't send CORS headers), so the Flex
// carousel loads posters through here. Only posterflix.in/img/<id>-s.webp can be fetched.
// Cached at Vercel's edge for a day.
const ID = /^[a-z0-9-]{1,60}$/;
const V = /^[\w.-]{1,40}$/;
export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const id = q.get("id") || "", v = q.get("v") || "";
  if (!ID.test(id) || (v && !V.test(v))) return new Response("Bad id", { status: 400 });
  const src = `https://posterflix.in/img/${id}-s.webp${v ? `?v=${encodeURIComponent(v)}` : ""}`;
  try {
    const r = await fetch(src, { headers: { "user-agent": "Mozilla/5.0 (compatible; TheTimelineBot/1.0; +https://marvel-timeline.vercel.app)" } });
    const type = r.headers.get("content-type") || "";
    if (!r.ok || !/^image\//.test(type)) return new Response("Not found", { status: 404, headers: { "cache-control": "public, s-maxage=300" } });
    return new Response(r.body, { status: 200, headers: {
      "content-type": type, "cache-control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      "access-control-allow-origin": "*", "x-content-type-options": "nosniff" } });
  } catch (e) { return new Response("Upstream error", { status: 502 }); }
}
