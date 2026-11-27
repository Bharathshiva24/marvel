# MCU Codex

An interactive guide to the Marvel Cinematic Universe: a zoomable timeline, "what to watch before" guides, trailers and narration, characters and relationships, a universe map, saga breakdowns, post-credit scenes, upcoming releases and a personal watch tracker. Available in English, Hindi, Spanish, French and Japanese.

## Run it

Open `index.html` in a browser, or serve the folder with any static host (for example GitHub Pages: Settings → Pages → Deploy from branch → `main` / root).

## Files

| File | What it holds |
| --- | --- |
| `index.html` | The site: layout, styles and all interactions |
| `data.js` | Films and series, characters, relationships, watch guides, events, official trailer IDs |
| `i18n.js` | Interface text in each language |
| `images.js` | **The image lists you fill in:** posters, characters and other images |
| `image-list.csv` | Every image slot with a suggested file name, size and where it appears |

## Adding images

1. Put image files in `images/posters/`, `images/characters/` or `images/other/`.
2. Open `images.js` and type each file's path between the quotes, for example:
   ```js
   "im":"images/posters/iron-man.jpg", // Iron Man (2008)
   ```
3. Save and reload. Any slot left as `""` keeps the built-in artwork.

Sizes: posters 2:3 (600×900 or larger), characters 1:1 or 4:5 (600×600 or larger), other images as noted in `image-list.csv`.

## Notes

- Your watched titles and watchlist are saved in your browser.
- On the claude.ai-hosted version, narration uses a Claude voice and story text is translated on the fly. When opened elsewhere, narration uses the browser's best voice and story text stays in English (menus are still translated).
- Release dates are U.S. dates, checked November 2026.
- Unofficial fan guide. Marvel and all related titles and characters are trademarks of Marvel / Disney.
