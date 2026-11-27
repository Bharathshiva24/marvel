// GET /api/og → the social preview image (Open Graph / Twitter card) chosen in /admin.
// Link-preview crawlers don't run JavaScript, so the page's meta tags point here and this
// serves the current upload, or the built-in image when there isn't one.
import { r2GetJSON, isOurUrl } from "./_r2.js";
import { storageReady } from "./_lib.js";

const fallback = (request) => Response.redirect(new URL("/og-default.png", request.url), 302);

export async function GET(request) {
  if (!storageReady()) return fallback(request);
  try {
    const c = await r2GetJSON("content/latest.json");
    const u = c && c.brand && c.brand.social;
    if (!isOurUrl(u)) return fallback(request);
    const r = await fetch(u);
    if (!r.ok) return fallback(request);
    return new Response(await r.arrayBuffer(), {
      headers: { "content-type": r.headers.get("content-type") || "image/jpeg", "cache-control": "public, max-age=300, s-maxage=600" },
    });
  } catch {
    return fallback(request);
  }
}
