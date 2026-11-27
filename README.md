# MCU Codex

An interactive guide to the Marvel Cinematic Universe: a zoomable timeline, "what to watch before" guides, an in-page trailer player and narration, characters and relationships, a universe map, saga breakdowns, post-credit scenes, upcoming releases and a personal watch tracker. Interface in English, Hindi, Spanish, French and Japanese.

**Admin panel:** `/admin` — upload posters, character images and artwork, and add YouTube videos. Changes go live on the site without a redeploy.

## One-time setup on Vercel

The admin panel stores everything in **Vercel Blob**. In your Vercel project:

1. **Storage → Create Database → Blob** → create a store and **connect it to this project** (this adds `BLOB_READ_WRITE_TOKEN` automatically).
2. **Settings → Environment Variables** → add `ADMIN_PASSWORD` with a long, unique password (Production, Preview and Development).
3. **Deployments → ⋯ → Redeploy** so the new settings take effect.
4. Open `https://<your-site>/admin` and sign in.

## How content flows

| Source | Used for | Priority |
| --- | --- | --- |
| Admin panel (Vercel Blob) | Images and YouTube videos added at `/admin` | Highest |
| `images.js` in this repo | Image paths you add by hand | Used when the admin panel has none |
| Built-in artwork / trailer IDs in `data.js` | Everything else | Fallback |

The public site checks for new admin content when a page opens, every minute while it's open, and when the tab comes back into view. Each save is published as a new version; the last 10 are kept.

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
