// GET /api/posterflix → { url, items:[{ title, img, href }] }
// Reads Posterflix's Marvel search page so the home-page promo always shows what's in that section.
// Cached at Vercel's edge for an hour; if Posterflix can't be read, items is empty and the site shows a plain banner.
const PAGE = "https://posterflix.in/search?q=marvel";
const ORIGIN = "https://posterflix.in";

const decode = (s) => String(s || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
function abs(u) {
  try {
    const x = new URL(decode(u), ORIGIN);
    // Next.js image optimizer → the original image
    if (x.pathname === "/_next/image" && x.searchParams.get("url")) return new URL(x.searchParams.get("url"), ORIGIN).href;
    return x.href;
  } catch { return ""; }
}
const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, "i")) || [])[1] || "";
function imgOf(html) {
  const tag = (html.match(/<img\b[^>]*>/i) || [])[0];
  if (!tag) return { img: "", alt: "" };
  const src = attr(tag, "src"), data = attr(tag, "data-src"), set = attr(tag, "srcset") || attr(tag, "data-srcset");
  const pick = [data, src && !src.startsWith("data:") ? src : "", set.split(",").pop()?.trim().split(/\s+/)[0]].find(Boolean) || "";
  return { img: abs(pick), alt: decode(attr(tag, "alt")) };
}

export async function GET() {
  let items = [];
  try {
    const r = await fetch(PAGE, { headers: { "user-agent": "Mozilla/5.0 (compatible; TheTimelineBot/1.0; +https://marvel-timeline.vercel.app)", accept: "text/html" }, signal: AbortSignal.timeout(8000) });
    if (r.ok) {
      const html = await r.text();
      const seen = new Set();
      for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
        const href = abs(attr(m[1], "href"));
        if (!href.startsWith(ORIGIN) || /\/search|\/cart|\/login|\/account|#/.test(href) || href === ORIGIN + "/" || seen.has(href)) continue;
        const { img, alt } = imgOf(m[2]);
        if (!/^https:\/\//.test(img) || /logo|icon|avatar|\.svg(\?|$)/i.test(img)) continue;
        const text = decode(m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
        seen.add(href);
        items.push({ title: (alt || attr(m[1], "aria-label") || attr(m[1], "title") || text || "Marvel poster").slice(0, 80), img, href });
        if (items.length >= 10) break;
      }
    }
  } catch {}
  return new Response(JSON.stringify({ url: PAGE, items }), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": items.length ? "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" : "public, max-age=60, s-maxage=300" },
  });
}
