// POST /api/stats  { sid, hit }  → { configured, views, live }
// Counts page views and people on the site right now, in an Upstash Redis database
// (Vercel → Storage → Upstash for Redis; it adds KV_REST_API_URL / KV_REST_API_TOKEN).
// One call per page load (hit: true) and one heartbeat every 2 minutes while the tab is open.
// "Live" = different browser tabs seen in the last 5 minutes.
const env = (k) => (process.env[k] || "").trim();
const REST = () => env("KV_REST_API_URL") || env("UPSTASH_REDIS_REST_URL");
const TOKEN = () => env("KV_REST_API_TOKEN") || env("UPSTASH_REDIS_REST_TOKEN");
const WINDOW = 5 * 60 * 1000;
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function POST(request) {
  if (!REST() || !TOKEN()) return json({ configured: false });
  let b = {};
  try { b = await request.json(); } catch {}
  const sid = String(b.sid || "");
  if (!/^[a-z0-9]{6,40}$/.test(sid)) return json({ error: "bad sid" }, 400);
  const now = Date.now();
  const cmds = [
    b.hit ? ["INCR", "tl:views"] : ["GET", "tl:views"],
    ["ZADD", "tl:live", String(now), sid],
    ["ZREMRANGEBYSCORE", "tl:live", "-inf", String(now - WINDOW)],
    ["ZCARD", "tl:live"],
  ];
  try {
    const r = await fetch(REST().replace(/\/+$/, "") + "/pipeline", { method: "POST", headers: { authorization: `Bearer ${TOKEN()}`, "content-type": "application/json" }, body: JSON.stringify(cmds), signal: AbortSignal.timeout(4000) });
    if (!r.ok) return json({ configured: true, error: "counter unavailable" }, 502);
    const out = await r.json();
    return json({ configured: true, views: Number(out[0]?.result || 0), live: Math.max(1, Number(out[3]?.result || 0)) });
  } catch {
    return json({ configured: true, error: "counter unavailable" }, 502);
  }
}
