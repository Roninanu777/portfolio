# Portfolio design research and options

Date: 2026-09-18. Source material: `~/Documents/job-hunt/documents/cv/Roni-Pradhan.pdf`, the tailored CV and cover letter in `~/Documents/job-hunt/cv/` and `cover_letters/`, and the candidate/behavioral profile files under `~/Documents/job-hunt/.claude/skills/job-application-assistant/`.

## 1. What the resume says the site must communicate

The strongest, most specific claims (all from your own documents):

- **Ownership at small scale.** One of two engineers on a B2B user-research platform for five years: React 18 app, Node/Express API, MongoDB, AWS serverless (Lambda, CDK, SQS, DynamoDB, CloudFront), Stripe billing.
- **The AI layer.** LLM study-builder agent (Anthropic/OpenAI, Langfuse-traced) with a tool-call dependency scheduler that orders calls by declared reads/writes. AI voice interviews on LiveKit agents (AssemblyAI + Cartesia).
- **Measured impact.** ~16% lower monthly LLM spend, traced to low-cache-hit LLM-as-a-judge eval rules and fixed with request sampling and model selection.
- **Hard migrations shipped safely.** Twilio → LiveKit across backend and frontend as one coordinated release across four repositories. Algolia → Typesense. React 18 migration. Design system rollout.
- **Platform surfaces.** Public REST API + webhooks with API-key management, developer dashboard and docs; billing and multi-seat teams; screener engine; search and matching; unmoderated research suite with the Figma OAuth app taken through vendor review to GA.
- **Open source.** Codebase Archaeology (Python, Postgres + pgvector, BM25 + RRF hybrid retrieval, tree-sitter, REST + MCP server). Year Progress Wallpaper (Next.js).

Portfolio implication: the site should *show* these surfaces, not just list bullets. Every option below therefore includes at least one live or simulated UI element (agent trace, LiveKit room, waveform, diff, API request).

Deliberately left off every page: your phone number, and any mention of availability or notice period. Included: email, GitHub, LinkedIn, IST timezone.

## 2. typesafe.ai, decoded

Verified by fetching the site's HTML and rendering it headless:

| Aspect | What they do |
|---|---|
| Canvas | Near-white `#FEFEFE`, ink `#1E1E1E` |
| Accent blocks | Hot pink `#F386A1` full-bleed section, sage `#ABBAB9` section, near-black `#1E1E1E` section |
| Display type | "Die Grotesk C" Medium (weight 500), 150 px headlines, tight leading, title case |
| Utility type | JetBrains Mono / Fragment Mono for labels, black-background tags like `[B.64]`, `String Tax` |
| Devices | Corner crop marks framing sections, dotted leaders in kickers, vertical base64 strings as marginalia, retro Mac-style system windows (clock tool, Game of Life), dithered/halftone blobs, a versioned footer ("Version 0.01") |
| Motion | Appear-on-scroll only; no 3D |
| Mood | Light "spec sheet" technical: confident declarative copy, big numbers ("193.6x Faster, 444.6x Cheaper") |

Free substitutes: Inter Tight 500 for the display face, JetBrains Mono for labels. Option A reproduces this system with your content.

## 3. Best engineer portfolios worth studying (all verified live on 2026-09-18)

| Site | Who | Why it matters for you |
|---|---|---|
| marcuss.pro | Staff backend engineer, distributed systems + AI | Closest analogue: terminal aesthetic, git-log style work list, quantified writing ("1,001 merged PRs", "~53% smaller output"), an embedded "Ask Marcus" LLM widget. Steal: quantified rows and an agent demo. |
| brittanychiang.com | Senior frontend engineer | The canonical senior-engineer layout: sticky left bio, scrolling right column, experience rows with tech pills, project cards with a headline metric. Steal: the structure, not the slate palette (heavily cloned). |
| leerob.com | Engineer/writer (ex-Vercel, Cursor) | Writing-first with a topic index. Steal: a "Notes" index if you start writing. |
| maximeheckel.com | Frontend/WebGL | Groups work into named themes instead of a flat list. Steal: theme grouping (AI layer, real-time, platform). |
| paco.me | Interface designer/engineer, Linear | Radical text-only minimalism with a "Now" section. Steal: the Now block. |
| rauno.me | Design engineer, Vercel | A 7-line manifesto, "Craft" gallery, copy-email button, archived prior versions. Steal: manifesto tone, copy-email. |
| emilkowal.ski | Design engineer, Linear | Four projects shown deeply, hover lift, newsletter. Steal: fewer projects, deeper. |
| ped.ro | Radix co-creator | Dark editorial serif, one headline metric ("20M+ monthly downloads"). Steal: one big number. |
| jhey.dev | Jhey Tompkins, Shopify | Live Spotify/Steam widgets and a dot-matrix font. Steal: one live widget (your IST clock, a LiveKit demo). |
| antfu.me | Anthony Fu | Breadth model for prolific OSS. Less relevant unless you publish a lot. |

Dead or retired: sdras.dev, cassie.codes.

Recurring directions across these: (1) dark terminal/monospace technical, (2) dark slate Tailwind resume, (3) light editorial serif + sans, (4) light Swiss "spec sheet" (typesafe, rauno), (5) playful interactive. Directions 1 and 4 fit an AI/real-time engineer best; direction 2 reads as templated.

## 4. Content structure recommendation (independent of visual direction)

1. **Hero = thesis, not a greeting.** One line that only you could say: "Five years, two engineers, one whole platform." Name, role, location/timezone, email, GitHub, LinkedIn.
2. **Selected work grouped by theme**, each with a metric or a concrete artifact: AI layer (agent + voice), real-time (LiveKit migration), platform (API, billing, search), craft (design system, React 18).
3. **Experience** as two compact rows with dates and tech pills.
4. **Projects**: two, shown deeply, with live links (codebase-archaeology.pages.dev, year-progress-wallpaper-tau.vercel.app).
5. **Stack** as a plain list grouped Frontend / Backend / AI & real-time / Infrastructure.
6. **Now / availability** block and a versioned footer.
7. Later, optional: **Writing** (one strong post on the tool-call dependency scheduler or the LLM cost audit would outperform any design flourish with technical hiring managers).

## 5. The four options

All in `explorations/`. Open `explorations/index.html` for a launcher.

| Option | File | Thesis | Palette | Fonts | Signature element | Best for |
|---|---|---|---|---|---|---|
| A · typesafe.ai homage | `a-typesafe.html` | Light spec-sheet with color blocks | `#FEFEFE` / `#F27D98` / `#AFBBB8` / `#141414` | Inter Tight, Inter, JetBrains Mono | Retro system windows: live agent trace, LiveKit room, migration meter, IST clock | Matching your stated taste; AI-lab credibility |
| B · Trace | `b-trace.html` | Career as an observability trace | `#0B0C0F` bg, span colors sky/mint/amber/violet/rose | Geist, Geist Mono | Interactive span waterfall 2021→2026 with a details panel | LLM-ops / platform teams that live in Langfuse and Datadog |
| C · Changelog | `c-changelog.html` | Release notes of one engineer | `#FBFBF9` / ink / merged-purple `#6F42C1` / diff green + red | IBM Plex Sans, Serif, Mono | Versioned rail with migrations rendered as diffs | Calm, timeless; if you plan to write |
| D · Surfaces | `d-bento.html` | Every card is a shipped surface | `#0F1013` cards with one tint each | Instrument Sans, DM Mono | Bento of working-looking mini UIs (waveform, DAG, sparkline, API call, seats) | Showing UI craft to product-minded startups |

Known caveats: feature-level dates inside a role (B's child spans, C's version tags) are approximate; correct them from your own records. Fonts load from Google Fonts. All pages are single files with no build step, responsive to phone width, and respect reduced-motion.

## 6. Recommendation

Start from **A** for the visual system (it is the direction you asked for and it photographs best) and borrow **B's** waterfall or **D's** mini-surfaces as the "work" section inside it. Whichever wins, ship it as a static site on Cloudflare Pages (already in your stack) with a real domain, and add one written piece within the first month.
