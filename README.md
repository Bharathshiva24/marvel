# The Timeline

An interactive guide to the Marvel Cinematic Universe: a zoomable timeline, "what to watch before" guides, an in-page trailer player and narration, characters and relationships, a universe map, saga breakdowns, post-credit scenes, upcoming releases and a personal watch tracker. Interface in English, Hindi, Spanish, French and Japanese.

**Admin panel:** `/admin` — upload posters, character images and artwork, and add YouTube videos. Changes go live on the site without a redeploy.

## One-time setup on Vercel

The admin panel stores everything in a **Cloudflare R2** bucket.

1. **Cloudflare → R2** → create a bucket, then in its **Settings** turn on **Public Development URL** (or connect a custom domain). Copy that address.
2. **R2 → Manage API tokens → Create API token** with *Object Read & Write* on that bucket. Copy the Access Key ID and Secret Access Key.
3. In Vercel, **Settings → Environment Variables** (Production, Preview and Development), add:
   `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`, and `ADMIN_PASSWORD`.
4. **Deployments → ⋯ → Redeploy**, then open `https://<your-site>/admin` and sign in.

Moving from Vercel Blob: run `scripts/migrate-blob-to-r2.mjs` once (instructions at the top of the file). Keep `BLOB_READ_WRITE_TOKEN` set (or copy its value into `SESSION_SECRET`) so signed-in visitors keep their watchlists.

## How content flows

| Source | Used for | Priority |
| --- | --- | --- |
| Admin panel (Cloudflare R2) | Images and YouTube videos added at `/admin` | Highest |
| `images.js` in this repo | Image paths you add by hand | Used when the admin panel has none |
| Built-in artwork / trailer IDs in `data.js` | Everything else | Fallback |

The public site checks for new admin content when a page opens, every minute while it's open, and when the tab comes back into view. Each save also keeps a dated backup copy in the bucket.

## Files

| Path | What it holds |
| --- | --- |
| `index.html` | The public site |
| `admin.html` | The admin panel (served at `/admin`) |
| `api/content.js` | Read/publish site content (images + videos) |
| `api/upload.js` | Upload/delete images (admin only) |
| `ui.js` | Shared custom dropdown component |
| `data.js` | Films and series, characters, relationships, watch guides, events, built-in trailer IDs |
| `i18n.js` | Interface text in each language |
| `images.js` / `image-list.csv` | Optional hand-maintained image paths and the full slot list |

## Notes

- Uploads are resized and compressed in the browser (WebP) before upload; the per-file limit is about 4.4 MB after compression.
- Story text translation and the Claude narration voice are available when the page runs inside Claude. On Vercel the menus are translated, story text stays in English, and narration uses the browser's best voice.
- Watched titles and the watchlist are saved in each visitor's browser.
- Unofficial fan guide. Marvel and all related titles and characters are trademarks of Marvel / Disney.
