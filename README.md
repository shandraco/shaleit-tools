# shaleit.tech

Free browser tools from ShaleIT, plus the landing page for shaleit.tech.

Everything runs in the visitor's browser. No tool sends what you type or upload anywhere.

| Tool | Path | What it does |
|---|---|---|
| QR code maker | `/qr` | Web address, Wi-Fi, phone or text to a printable QR code |
| Password maker | `/password` | Strong passphrases (EFF wordlist) or random passwords |
| Image shrinker | `/image` | Resize and compress photos, strip location data |
| Contrast checker | `/contrast` | WCAG 2.2 contrast check with a one-click fix |
| PDF merger | `/pdf` | Join PDFs in any order, or extract page ranges |
| Unit converter | `/units` | Length, weight, temperature, cooking and more; accepts fractions and 5'11" |
| Favicon maker | `/favicon` | Icon pack (ICO, PNGs, manifest) from an image or a letter |

## Run locally

Plain static HTML, no build step:

```sh
cd public && python3 -m http.server 8000
```

## Deploy

Vercel project `shaleit-tech` (team Ceyther). `vercel.json` sets the security headers and redirects www to the apex.

Every `src` and `href` in `public/<tool>/index.html` must be absolute (`/qr/app.js`): Vercel serves `/qr` without a trailing slash.

## License

MIT, see [LICENSE](LICENSE). Third-party work and its licenses are listed in [THIRD-PARTY.md](THIRD-PARTY.md).

## SEO and answer engines

Each tool page has its own title, description, canonical, Open Graph and Twitter tags, JSON-LD (WebApplication, BreadcrumbList, FAQPage) and a visible "How to use it" and "Questions people ask" section. The FAQ JSON-LD must match the visible text exactly, so change both together. `public/og.png` is the shared 1200x630 share image. `robots.txt`, `sitemap.xml` and `llms.txt` live in `public/`; add a new tool to all three and to `404.html`.
