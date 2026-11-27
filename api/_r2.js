// Cloudflare R2 storage (S3-compatible API), replacing Vercel Blob.
// Needs these environment variables in Vercel:
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET,
//   R2_PUBLIC_URL  (the bucket's public address, e.g. https://pub-xxxx.r2.dev or https://img.example.com)
// No call here ever lists the bucket, so normal page views cost one cheap read at most.
import { AwsClient } from "aws4fetch";

const env = (k) => (process.env[k] || "").trim();
export const r2Ready = () =>
  ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL"].every((k) => env(k));

let client;
const aws = () =>
  (client ||= new AwsClient({ accessKeyId: env("R2_ACCESS_KEY_ID"), secretAccessKey: env("R2_SECRET_ACCESS_KEY"), service: "s3", region: "auto" }));
const endpoint = (key) =>
  `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com/${env("R2_BUCKET")}/${key.split("/").map(encodeURIComponent).join("/")}`;

export const publicBase = () => env("R2_PUBLIC_URL").replace(/\/+$/, "");
export const publicUrl = (key) => `${publicBase()}/${key}`;

/** True for a URL that points into our own bucket's public address. */
export function isOurUrl(v) {
  const base = publicBase();
  return Boolean(base) && typeof v === "string" && v.length < 600 && v.startsWith(base + "/") && !v.includes("..");
}
/** Bucket key for one of our public URLs, or "" if it isn't ours. */
export const keyFromUrl = (v) => (isOurUrl(v) ? decodeURIComponent(v.slice(publicBase().length + 1).split(/[?#]/)[0]) : "");

// Cloudflare's short error code (e.g. InvalidAccessKeyId, SignatureDoesNotMatch, NoSuchBucket). Never secret.
async function why(r) {
  const t = await r.text().catch(() => "");
  const pick = (tag) => (t.match(new RegExp(`<${tag}>([^<]{1,160})</${tag}>`)) || [])[1] || "";
  return [`R2 ${r.status}`, pick("Code"), pick("Message")].filter(Boolean).join(" ");
}

export async function r2Put(key, body, contentType, cacheControl = "public, max-age=31536000, immutable") {
  const r = await aws().fetch(endpoint(key), { method: "PUT", body, headers: { "content-type": contentType, "cache-control": cacheControl } });
  if (!r.ok) throw new Error(await why(r));
  return publicUrl(key);
}

/** Reads a JSON object straight from the bucket (not the public CDN), so it's never stale. null if missing. */
export async function r2GetJSON(key) {
  const r = await aws().fetch(endpoint(key), { method: "GET" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(await why(r));
  return r.json();
}

export async function r2Del(key) {
  const r = await aws().fetch(endpoint(key), { method: "DELETE" });
  if (!r.ok && r.status !== 404) throw new Error(await why(r));
}
