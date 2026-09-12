# Portfolio site

Static site. No build step, no dependencies, no package manager. Open `index.html`
in a browser and it works — locally or hosted.

## Layout

```
site/
  index.html                          home: hero, project grid, about
  projects/
    ddpm-diffusion-models.html        the 501 case study
  assets/
    css/base.css                      design tokens + base layer (edit colours here)
    css/home.css                      home page only
    css/project.css                   case-study components
    js/site.js                        theme toggle, scroll reveal, slide viewer
    js/diffusion-lab.js               the interactive forward-diffusion figure
    files/                            report PDF, both decks as PDF, notebook
    img/slides-intro/  slide-01.jpg … 29 rendered slides
    img/slides-math/   slide-01.jpg … 22 rendered slides
    vendor/katex/                     maths rendering, vendored so it works offline
```

## Adding a project

1. Copy `projects/ddpm-diffusion-models.html` to `projects/<your-slug>.html`.
2. Copy one `<article class="card">` block in `index.html`, point it at the new file.
3. Drop any PDFs or images into `assets/files/` and `assets/img/`.

Placeholder cards in `index.html` carry `class="card card--draft"` — delete that
class once a real write-up exists behind them.

## Re-rendering slides from a `.pptx`

```bash
soffice --headless --convert-to pdf --outdir . deck.pptx
pdftoppm -jpeg -jpegopt quality=82 -scale-to-x 1280 -scale-to-y -1 deck.pdf slide
```

Then set `data-slides-count` on the viewer to the number of slides produced.

## Publishing to GitHub Pages

```bash
git init && git add . && git commit -m "portfolio"
git branch -M main
git remote add origin https://github.com/YimingCao-Eric/<repo>.git
git push -u origin main
```

Then in the repo: **Settings → Pages → Source: deploy from branch → `main` / root**.
The site appears at `https://yimingcao-eric.github.io/<repo>/`.

Since every path in the site is relative, it works from a subdirectory without
any config changes.

## Notes

- Colours live as CSS custom properties at the top of `assets/css/base.css`.
  Change `--accent` and the whole site follows, in both light and dark.
- Dark mode follows the OS by default; the header toggle overrides it and
  remembers the choice in `localStorage`.
- KaTeX is vendored rather than loaded from a CDN so the maths still renders
  offline and the site has no external dependencies.

## Chinese mirror (中文版)

Every page has a Simplified-Chinese twin under `zh/` with the same file name
(`zh/index.html`, `zh/projects/<slug>.html`). The **中文 / EN** button in the header links
between the two; `assets/js/site.js` remembers the last choice in `localStorage`
(`yc-lang`) and, on a page that declares a `<link rel="alternate" hreflang=…>`, hops to the
remembered language automatically. Default (no choice yet) is English.

The interactive figures are shared between both versions: their user-visible strings go
through `I18N.t("English", "中文")` (defined in `site.js`), which picks by `<html lang>`.
When you add a project, create both pages and keep the `hreflang` links pointing at each other.

## Planned projects ("On the drawing board")

Ideas that are scoped but not started live in `projects/planned-<slug>.html` (and `zh/projects/…`),
generated from the outlines in `E:\workSpace\project ideas`. Each card on the home page and each
page carries two stamps:

```html
created <time datetime="2026-09-12">2026-09-12</time> · updated <time datetime="2026-09-12" data-updated>2026-09-12</time>
```

When you revise an outline, change the `data-updated` `<time>` (both the `datetime` attribute and
the text) on the page and on its home-page card — in both languages. The `created` stamp never
changes. Status words on the card (`Next up` / `Parked` / `Recorded`) are plain text in the
`.status` span.
