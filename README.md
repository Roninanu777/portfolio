# roni.pradhan — portfolio

A single-page portfolio for Roni Raj Kamal Pradhan, Senior Software Engineer. Static HTML, CSS and a few lines of vanilla JS. No build step, no framework, no dependencies beyond two Google Fonts.

Design direction: **a portfolio that feels like Roni.** The page opens on the live sky over Itanagar (the sun's real position, stars at night, the current weather), with a Blender render of Roni riding his Interceptor 650 along the ridge. Then:

- **Things I own**: every shipped product surface is a small working window on a lit stage. Play the voice interview, replay the agent run, scrub the spend chart, ship the LiveKit release, send the API request, flip billing roles, search participants, switch research methods, run the old and new invite delivery, ask Codebase Archaeology a question.
- **The ride so far**: the story as a road, from the 2020 hostel weather app to now. A headlight rides down it as you scroll.
- **Off the clock**: an Interceptor rev counter to hold (with a synthesised engine sound) and a Barça keepy-uppy game.

The alternative directions explored earlier are parked in `explorations/`.

## Layout

```
index.html          the page (all content lives here)
css/styles.css      tokens, then one block per section
js/main.js          sky, rider, story road, off-the-clock toys, then one block per work window
assets/interceptor/ Blender render: rider.webp (the hero rider)
blender/interceptor.py
                    the Interceptor 650 model and render script (see below)
assets/favicon.svg
assets/og.html      source for the social preview image
assets/og.png       rendered 1200×630 social preview
assets/Roni-Pradhan-Senior-Software-Engineer.pdf
                    public resume (no phone number); generated, do not edit by hand
resume/             resume source (resume.html), local IBM Plex fonts, build script
```

## The live sky

`js/main.js` computes the sun's altitude over Itanagar with the NOAA solar equations and colours the sky, hills, sun, moon and stars from it every 30 seconds. Weather comes from Open-Meteo (free, no key, called from the visitor's browser every 15 minutes); if that request fails the sky still works and the weather text is simply left out.

## The bike model

The hero rider sprite in `assets/interceptor/` is a stock Royal Enfield Continental GT 650, the Interceptor's café-racer twin, with a simple rider added. The scene is `blender/gt_stock.blend`, which is gitignored and never published because the bike mesh is third-party. (`blender/ic_from_gt.blend` is an abandoned attempt to convert it into an Interceptor.)

Re-render from it with:

```sh
B=/Applications/Blender.app/Contents/MacOS/Blender
$B --background blender/gt_stock.blend --python blender/render_gt_assets.py -- side assets/interceptor/rider.webp 440
```

The side render frames exactly 2.2 m × 1.8 m with the ground at the bottom edge, which is what the hero's `<image>` and headlamp beam coordinates assume. EEVEE renders black in headless sessions here, so the script uses Cycles on the CPU.

`blender/interceptor.py` is an earlier Interceptor built entirely from primitives (profiles traced from CC BY-SA photos on Wikimedia Commons by Auge=mit), kept as a fallback.

## Resume PDF

The resume lives in `resume/`. Edit `resume/resume.html`, then run:

```sh
./resume/build.sh
```

It prints the page through headless Chromium and writes two PDFs from the one source:

- `assets/Roni-Pradhan-Senior-Software-Engineer.pdf`: the public copy linked from the site. It never contains the phone number.
- `resume/out/Roni-Pradhan-Senior-Software-Engineer.pdf`: the private copy for applications, with the phone number. It is only written when a number is configured, either in the `RESUME_PHONE` environment variable or on the first line of `resume/.private`. Both `resume/.private` and `resume/out/` are gitignored.

The script then checks both files: exactly one page, and every font embedded as a real font, so applicant-tracking systems can read the text. It fails if either check breaks. Comments at the top of `resume.html` explain the layout rules that keep the text layer readable. Never edit the PDF in `assets/` directly.

## Preview locally

Open `index.html` in a browser, or serve the folder so relative paths behave exactly as in production:

```sh
python3 -m http.server 8080
# then http://localhost:8080
```

## Editing content

Everything is plain HTML in `index.html`:

- **Hero copy and buttons**: the `<header class="hero">` block.
- **Projects**: each `<article class="proj">` has a `.stage` holding the window (`.ui.win`, with a `.hd` title bar) and an `.info` block (title, `.kind`, `.cap`). Add `wide` to span the full row (Selected work) or `sm` for the gallery (Also shipped). `--tint` lights the stage and the window accents; `--tint2` adds a second glow. Interactive windows have an `id` that `js/main.js` looks up; each block there returns early if its markup is missing.
- **Timezone line**: the paragraph and live clock in the "Say hello" block (`#contact`). Keep availability and notice-period details off the public site.
- **Story**: the waypoints in `#story` ("The ride so far"). Keep them to things Roni actually said or did.
- **Experience, Stack, Education**: the `section.plain` blocks.
- **Domain**: the canonical and Open Graph URLs in `<head>` point at https://ronipradhan.dev/.

Mini-UI data (names, scores, run numbers, the cited commits, the search index, the spend curve) is illustrative, not real customer data. The spend chart's scrubber narrates events rather than numbers on purpose, so the only figure it states is the real −16%.

## Regenerate the social preview

`assets/og.html` is the source. Render it at 1200×630 with any headless browser, for example Playwright:

```sh
npx -y playwright screenshot --viewport-size=1200,630 --wait-for-timeout=1500 assets/og.html assets/og.png
```

## Deploy

Hosted on Cloudflare as the Worker `portfolio` at https://ronipradhan.dev (Cloudflare Pages is now part of Workers; static sites deploy as Workers static assets). `wrangler.jsonc` points at `dist/`, `build.sh` assembles `dist/` with only the files the site needs (no explorations, no README, no OG source), and `_headers` adds security headers and forces the resume to download.

`src/worker.js` is a ten-line front door: any request on an alias host (`www.ronipradhan.dev`, `portfolio.roni-pradhan.workers.dev`) is 301-redirected to `ronipradhan.dev`; everything else is served from the static assets. The two custom domains are declared in `wrangler.jsonc` and are created on deploy, so the domain's DNS must live on this Cloudflare account.

Two ways to ship:

- **Auto-deploy on push** (the default): `.github/workflows/deploy.yml` runs on every push to `main`, builds `dist/` and deploys with Wrangler. It needs two repository secrets under Settings → Secrets and variables → Actions: `CLOUDFLARE_ACCOUNT_ID` (already set) and `CLOUDFLARE_API_TOKEN`, an API token created from the "Edit Cloudflare Workers" template at https://dash.cloudflare.com/profile/api-tokens. The workflow fails with a clear message until the token exists.
- **From the terminal**: `./deploy.sh`. Same build, then `wrangler deploy` with your local login. Run `npx wrangler login` once per machine.

To move to a different domain: change `CANONICAL_HOST` in `src/worker.js`, the two `routes` in `wrangler.jsonc`, and the URLs in the `<head>` of `index.html`, then deploy.

## Before going live

- [x] Canonical, Open Graph and JSON-LD URLs point at https://ronipradhan.dev/.
- [ ] Check the two project links still resolve.
- [ ] Optional: add analytics (PostHog snippet) at the end of `<body>`.
- [ ] Run `./resume/build.sh` after any resume edit, then deploy, so the site copy stays current.
