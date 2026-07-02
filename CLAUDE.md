# CLAUDE.md

Static website for **独立研究ネットワークTAGEN** (Independent Researchers Network TAGEN), hosted on GitHub Pages at `https://au-lab.github.io/tagen/`.

No build system. Open `index.html` directly in a browser to preview. Tailwind is loaded via CDN.

## Files

- **[index.html](index.html)** — markup only (structure + Tailwind classes)
- **[css/style.css](css/style.css)** — hero slideshow + `.section-title` styles
- **[js/config.js](js/config.js)** — `CONFIG` object: `heroImages`, `heroSlideshowInterval`, `newsRssUrl` / `membersRssUrl`, `projects[]`. Edit this to change site content.
- **[js/main.js](js/main.js)** — RSS fetching/rendering, config injection, slideshow

## Notes

- `applyConfig()` (main.js) injects `CONFIG` into `#hero-slides` and `#cfg-projects-grid`.
- `loadFeed()` renders note.com RSS into `#rss-feed-2` (hero, 4 items) and `#rss-feed-1` (世話人, 8 items). Requests are proxied through `api.allorigins.win` for CORS; up to 10 retries, with a retry button on failure.
- Brand colors: orange `#F58220`, blue `#0068FF`.
