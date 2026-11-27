// GET /api/posterflix → { url, items:[{ id, title, img, full, href, by, medium }] }
// Reads Posterflix's own catalog (the POSTERS list in /app/catalog.<hash>.js) and returns only the posters
// tagged "Marvel" (no DC). The page shuffles them on every load.
// Cached at Vercel's edge for an hour. If Posterflix can't be read, the last known Marvel posters are used.
const ORIGIN = "https://posterflix.in";
const PAGE = ORIGIN + "/search?q=marvel";
const UA = { "user-agent": "Mozilla/5.0 (compatible; TheTimelineBot/1.0; +https://marvel-timeline.vercel.app)" };
const FALLBACK = [
  { id: "hulk", title: "Hulk", year: "Marvel", medium: "Hyperreal minimal render" },
  { id: "captain", title: "Captain America", year: "Marvel", medium: "Arctic photo-realism" },
];
const ID = /^[a-z0-9-]{1,60}$/;

function shape(p) {
  const v = p.img_v ? `?v=${encodeURIComponent(p.img_v)}` : "";
  return {
    id: p.id, title: String(p.title || p.id).slice(0, 80),
    img: `${ORIGIN}/img/${p.id}-s.webp${v}`, full: `${ORIGIN}/img/${p.id}.webp${v}`,
    href: `${ORIGIN}/poster/${p.id}`,
    by: String(p.by || "").slice(0, 80), medium: String(p.medium || "").slice(0, 80),
    brand: String(p.year || "").slice(0, 20), marvel: String(p.year).toLowerCase() === "marvel",
  };
}

/** Pull the POSTERS array literal out of the catalog script and parse it as JSON. */
function parsePosters(js) {
  const start = js.indexOf("[", js.indexOf("POSTERS"));
  if (start < 0) return [];
  for (let end = js.indexOf("];", start); end > 0; end = js.indexOf("];", end + 2)) {
    try { return JSON.parse(js.slice(start, end + 1)); } catch {}
  }
  return [];
}

async function fromCatalog() {
  const html = await (await fetch(PAGE, { headers: UA, signal: AbortSignal.timeout(6000) })).text();
  const path = (html.match(/\/app\/catalog\.[a-f0-9]+\.js/) || [])[0];
  if (!path) return [];
  const js = await (await fetch(ORIGIN + path, { headers: UA, signal: AbortSignal.timeout(8000) })).text();
  const all = parsePosters(js).filter((p) => p && ID.test(p.id));
  return all.filter((p) => String(p.year).toLowerCase() === "marvel");
}

export async function GET() {
  let list = [], live = false;
  try { list = await fromCatalog(); live = list.length > 0; } catch {}
  if (!live) list = FALLBACK;
  const items = list.slice(0, 24).map(shape);
  return new Response(JSON.stringify({ url: PAGE, live, items }), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": live ? "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" : "public, max-age=60, s-maxage=300" },
  });
}
