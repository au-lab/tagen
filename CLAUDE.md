# CLAUDE.md

Static website for **独立研究ネットワークTAGEN** (Independent Researchers Network TAGEN), hosted on GitHub Pages at `https://au-lab.github.io/tagen/`.

Tailwind CSS v4 is compiled locally via `@tailwindcss/cli` (no CDN). Open `index.html` directly in a browser to preview; rebuild the CSS after changing markup classes or `src/input.css`.

## Build

- `npm install` — install `@tailwindcss/cli` (dev dependency; `node_modules/` is gitignored)
- `npm run build:css` — one-off minified build: `src/input.css` → `css/style.css`
- `npm run watch:css` — rebuild on change while developing

`src/input.css` imports Tailwind and holds the hand-written styles (hero slideshow, `.section-title`); it `@source`s `index.html` and `js/**/*.js` so classes added dynamically in JS are detected. `css/style.css` is the generated output that `index.html` loads — don't edit it by hand.

## Files

- **[index.html](index.html)** — markup only (structure + Tailwind classes)
- **[src/input.css](src/input.css)** — Tailwind entry + hero slideshow / `.section-title` styles (edit this)
- **[css/style.css](css/style.css)** — generated Tailwind output (do not edit)
- **[js/config.js](js/config.js)** — `CONFIG` object: `heroImages`, `heroSlideshowInterval`, `newsRssUrl` / `membersRssUrl`, `projects[]`. Edit this to change site content.
- **[js/main.js](js/main.js)** — RSS fetching/rendering, config injection, slideshow

## Notes

- `applyConfig()` (main.js) injects `CONFIG` into `#hero-slides` and `#cfg-projects-grid`.
- `loadFeed()` renders note.com RSS into `#rss-feed-2` (hero, 4 items) and `#rss-feed-1` (世話人, 8 items). Requests are proxied through `api.allorigins.win` for CORS; up to 10 retries, with a retry button on failure.
- Brand colors: orange `#F58220`, blue `#0068FF`.
