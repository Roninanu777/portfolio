# roni.pradhan — portfolio

A single-page portfolio for Roni Raj Kamal Pradhan, Senior Software Engineer. Static HTML, CSS and a few lines of vanilla JS. No build step, no framework, no dependencies beyond two Google Fonts.

Design direction: **"Surfaces"** — a bento grid where every card is a working-looking miniature of a product surface actually shipped (voice interview, agent tool-call DAG, spend sparkline, API request, billing seats, search, heatmap). The three alternative directions explored before choosing this one are parked in `explorations/`.

## Layout

```
index.html          the page (all content lives here)
css/styles.css      tokens, layout, one block per card
js/main.js          IST clock, year-progress dots, copy-email button, footer year
assets/favicon.svg
assets/og.html      source for the social preview image
assets/og.png       rendered 1200×630 social preview
assets/Roni-Pradhan-Senior-Software-Engineer.pdf
                    public resume (no phone number); generated, do not edit by hand
explorations/       the four original design drafts + DESIGN-RESEARCH.md
```

## Resume PDF

The downloadable resume is generated from `~/Documents/job-hunt/documents/cv/source/resume.html`. Running that folder's `build.sh` writes two files from the one source: the full resume (with phone) into the job-hunt folder for applications, and a public copy without the phone number into `assets/` here. To update the resume on the site, edit the HTML source there and rebuild; never edit the PDF in `assets/` directly.

## Preview locally

Open `index.html` in a browser, or serve the folder so relative paths behave exactly as in production:

```sh
python3 -m http.server 8080
# then http://localhost:8080
```

## Editing content

Everything is plain HTML in `index.html`:

- **Hero copy and buttons**: the `<header class="hero">` block.
- **Cards**: each `<article class="card">` has an eyebrow, a title, a mini UI (`.ui`), and a caption (`.cap`). Card size is set by the `c3`…`c7` and `r2` classes (12-column grid). The tint is the inline `--tint` variable.
- **Timezone line**: the caption of the "Where I work" card. Keep availability and notice-period details off the public site.
- **Experience, Stack, Education**: the `section.plain` blocks.
- **Domain**: the canonical and Open Graph URLs in `<head>` point at the workers.dev address; change them when you add a custom domain.

Mini-UI data (names, scores, run numbers, the cited commit) is illustrative, not real customer data.

## Regenerate the social preview

`assets/og.html` is the source. Render it at 1200×630 with any headless browser, for example Playwright:

```sh
npx -y playwright screenshot --viewport-size=1200,630 --wait-for-timeout=1500 assets/og.html assets/og.png
```

## Deploy

Hosted on Cloudflare as the Worker `portfolio`, live at https://portfolio.roni-pradhan.workers.dev (Cloudflare Pages is now part of Workers; static sites deploy as Workers static assets). `wrangler.jsonc` points at `dist/`, `build.sh` assembles `dist/` with only the files the site needs (no explorations, no README, no OG source), and `_headers` adds security headers and forces the resume to download.

Two ways to ship:

- **Auto-deploy on push** (the default): `.github/workflows/deploy.yml` runs on every push to `main`, builds `dist/` and deploys with Wrangler. It needs two repository secrets under Settings → Secrets and variables → Actions: `CLOUDFLARE_ACCOUNT_ID` (already set) and `CLOUDFLARE_API_TOKEN`, an API token created from the "Edit Cloudflare Workers" template at https://dash.cloudflare.com/profile/api-tokens. The workflow fails with a clear message until the token exists.
- **From the terminal**: `./deploy.sh`. Same build, then `wrangler deploy` with your local login. Run `npx wrangler login` once per machine.

To add a custom domain: dashboard → the Worker → Settings → Domains & Routes → add the domain (it must be on your Cloudflare account), then replace the workers.dev URL in the `<head>` of `index.html` with it and redeploy.

## Before going live

- [x] Canonical, Open Graph and JSON-LD URLs point at the workers.dev address; update them when a custom domain is added.
- [ ] Check the two project links still resolve.
- [ ] Optional: add analytics (PostHog snippet) at the end of `<body>`.
- [ ] Rebuild the resume PDF after any resume edit so the site copy stays current.
