# AGENTS.md

Instructions for anyone changing this repo, human or AI agent. Read this before writing code.

## What this is

Tizarr is a Samsung TV app (Tizen 5.0+) for searching movies and shows and requesting them in
one click from the user's own Radarr and Sonarr. It is a static web app: no backend, no
framework. It ships as `tizarr.wgt` and is installed on the TV with TizenBrew Installer from
the latest GitHub release.

## Rules

### Code quality

- Code is written for humans first. Someone who has never seen the repo must be able to find
  and understand any feature quickly. Never leave code messier than you found it.
- Keep the structure: one module per concern, small functions, clear names. If a file starts
  doing two jobs, split it.
- Follow the patterns already in the codebase before inventing new ones (see "How the code is
  organized"). Consistency beats personal preference.
- Comments explain _why_ (a constraint, a gotcha, a non-obvious choice), never _what_ the
  next line does.
- No dead code, no commented-out code, no speculative "for later" abstractions.
- All user-facing text goes in `src/strings/en.js` and `src/strings/pt-BR.js` (same keys;
  a test enforces it). Use `t('key')` in code and `data-i18n` in markup.
- Every magic number gets a named constant with a short reason.

### Lightweight and fast

- This runs on a 2019 TV with a slow CPU and Chromium 63. Performance is a feature.
- No runtime dependencies. Adding one needs a very strong reason and the owner's approval.
- No frameworks, no virtual DOM, no state libraries, no CSS frameworks. Plain DOM APIs.
- Prefer the simplest design that works. No heavy architecture.
- Build DOM lists with a `DocumentFragment` and insert once. Avoid layout thrashing (reading
  layout inside write loops).
- Keep network payloads and images small (e.g. TMDB `w342` posters, capped result counts).
- Watch the bundle size (`dist/app.js`, ~20 KB today). Justify any big jump.

### Tizen 5.0 compatibility (Chromium 63)

- Write modern JavaScript; esbuild lowers syntax to `chrome63`. It does **not** polyfill APIs.
- Do not use APIs newer than Chromium 63, e.g. `Array.prototype.flat/flatMap/at`,
  `String.prototype.replaceAll`, `Object.fromEntries`, `Promise.allSettled`,
  `Element.replaceChildren`, `AbortController`, `ResizeObserver`, `structuredClone`,
  `loading="lazy"`. ESLint blocks the common ones (`eslint.config.js`); check others on MDN.
- CSS is not lowered either: no flexbox `gap`, no `aspect-ratio`, no `:is()/:where()`, no
  container queries. Use margins.
- Use XHR (`src/data/http.js`), not `fetch`, for timeouts without `AbortController`.

### Security

This repo is public and most of its code is written by AI agents. Anyone can install the app
and point it at their own servers. Treat every change as something a stranger will run on
their TV with their API keys in it.

#### Secrets and personal data

- Never commit secrets: API keys, tokens, passwords, certificates or keystores (`*.p12`,
  `*.pwd`), `.env` files, or anything copied from a real config.
- Never commit details that identify the owner's setup: LAN IPs, hostnames (e.g. `*.lan`),
  usernames, emails, server URLs or library contents.
- Tests and examples use obviously fake values (`'test-key'`, `http://sonarr.example`).
- Before every commit, check the staged diff (`git diff --cached`) for key-like strings, IPs
  and private hostnames.
- If a secret ever reaches git (even in a later-reverted commit), stop and tell the owner so
  it can be rotated. Deleting it in a new commit is not enough: history is public.
- Never put secrets in commit messages, PR or issue text, release notes or CI logs.

#### Protecting the people who install it

- Each server's API key is sent only to that server's own configured URL; the TMDB key only to
  `api.themoviedb.org`. Keys are stored only in the TV's `localStorage` and never logged.
- No telemetry, analytics, crash reporting, ads or calls to any other third party. Adding a
  new network destination needs the owner's approval.
- The app may only add titles (`POST` movie/series). Anything that deletes, unmonitors or
  changes settings on a user's server needs explicit owner approval.
- API key fields stay masked (`type="password"`); never display a saved key in plain text.
- Do not add Tizen privileges in `tizen/config.xml` without approval. `<access origin="*">`
  is required because users' servers can be anywhere; do not widen anything else.

#### Code safety

- Data from Sonarr, Radarr or TMDB (titles, overviews, error messages) is untrusted: render it
  with `textContent` / `el()`, never `innerHTML`. `innerHTML` is only for fixed strings in the
  code (like the icons in `src/ui/icons.js`).
- Only put `https:` URLs (or URLs on the user's configured server) into `src`; never use
  `javascript:` or `data:` URLs built from API data.
- No `eval`, `new Function`, string `setTimeout`, or loading scripts/code from the network at
  runtime. Everything the app runs ships inside the signed `.wgt`.

#### Supply chain and CI

- No runtime dependencies. New dev dependencies need approval; always commit the lockfile and
  install with `npm ci`.
- Pin third-party GitHub Actions to a full commit SHA, give workflows the least `permissions`
  they need, and never echo secrets.
- The signing certificate (`TIZEN_AUTHOR_P12`) is never exported, printed or replaced.

### Testing

- Every change to logic (`src/data/*`, `src/config.js`, `src/i18n.js`, or new pure code)
  comes with tests in `test/`, using the built-in `node:test` and `node:assert/strict`.
- Keep pure logic out of view modules so it can be tested without a DOM.
- `npm run check` (lint, format check, tests) must pass before every commit; CI runs it on
  every pull request and push to `main`.
- When touching the build, `index.html`, `tizen/` or `scripts/`, also run `npm run validate`
  (builds `dist/` and checks required files, Chromium-compatible syntax and the version).
- UI changes: also verify in a browser with `npm run dev` (open `http://<this machine>:5173`
  from any device on the LAN; arrows, Enter, Escape = Back; DevTools device mode at
  1920×1080 for TV fidelity) and say what you checked.

### Git and releases

- Commits use Conventional Commits: `feat:`, `fix:`, `refactor:`, `perf:`, `test:`,
  `docs:`, `chore:`, `ci:`. Imperative subject, 72 characters max, body explains why if needed.
- Commits must **never** include `Co-Authored-By` trailers or any AI attribution.
- One logical change per commit.
- Agents may commit, push to `main` and cut releases on their own once `npm run check` passes.
- Releases are GitHub releases. Publishing one with a new tag `vX.Y.Z` (patch = fixes,
  minor = features) triggers `.github/workflows/release.yml`, which builds, validates, signs
  and attaches `tizarr.wgt` to it. The tag is the app version; `package.json` stays at
  `0.0.0`. From the CLI: `gh release create vX.Y.Z --generate-notes`. Drafts do not trigger
  the workflow; it runs when the release is published.
- Releases must be signed: Tizen 5.0 rejects unsigned packages and TizenBrew Installer only
  re-signs on Tizen 7+. CI signs with the Tizen CLI (`scripts/sign.exp`) using the repo
  secrets `TIZEN_AUTHOR_P12` (base64) and `TIZEN_AUTHOR_PASSWORD`. Never replace that author
  certificate: the TV refuses updates signed by a different one.

## Commands

| Command            | What it does                                                 |
| ------------------ | ------------------------------------------------------------ |
| `npm ci`           | Install dev tools (Node 22, see `.nvmrc`)                    |
| `npm run dev`      | Dev server on `0.0.0.0:5173` with rebuild + live reload      |
| `npm run check`    | Lint, format check, tests; must pass before committing       |
| `npm test`         | Unit tests only                                              |
| `npm run lint`     | ESLint                                                       |
| `npm run format`   | Prettier (write)                                             |
| `npm run build`    | Bundle `src/` into `dist/`                                   |
| `npm run validate` | Build and check `dist/` (files, syntax for Chromium 63, ver) |

## How the code is organized

```
src/
  main.js             entry point: settings → translations → screens → first screen
  config.js           settings shape (app + servers), validation, persistence (pure)
  state.js            the only shared mutable state: saved config + data cache
  i18n.js             t(), setLanguage(), translatePage()
  strings/            en.js, pt-BR.js
  dom.js              $, $$, el, setStatus helpers
  stage.js            scales the fixed 1920×1080 canvas to the window
  nav.js              remote navigation: focus, arrows, Enter, Back, view switching
  router.js           sidebar screens, Details overlay, where Back goes
  data/
    http.js           JSON over XHR with timeout
    arr.js            Sonarr/Radarr v3 client (translated errors)
    tmdb.js           TMDB v3 client (optional key)
    media.js          movie/show kinds, mapping lookup results, request bodies (pure)
    library.js        library + queue → items with status (pure helpers + loader)
    cache.js          memory + localStorage cache with TTL, stale-while-revalidate
  ui/
    card.js           poster card with status badge
    grid.js           renders cards in one DOM write, keeps focus on refresh
    lazy-images.js    loads <img data-src> near the viewport (IntersectionObserver)
    icons.js          inline Lucide SVG icons, rendered into <span data-icon>
  screens/
    settings.js       language, region, TMDB key; per server URL/key, Test, defaults
    search.js         parallel lookups, poster grid
    library.js        Movies | Shows tabs with status
    details.js        overlay: overview and Request button
  fonts/              Roboto variable font (woff2, latin) + its OFL license
  index.html          markup for all screens (text via data-i18n)
  style.css           1920×1080 TV layout
tizen/
  config.xml          Tizen manifest (version is injected at build)
  icon.png            app icon
scripts/
  build.js            esbuild bundle → dist/ (`--dev`: watch + serve + live reload, in dist-dev/)
  validate.js         checks on dist/
  sign.exp            signs dist/ into a .wgt in CI (Tizen CLI prompts need expect)
test/                 node:test unit tests
```

Patterns to follow:

- **Screens** export `initX()`, which calls `registerScreen(id, { actions, onOpen })`
  (sidebar screens) or `registerOverlay` (Details). Open them with `openScreen(id)` /
  `openOverlay(id, returnFocus)`. Back on a screen focuses the sidebar, then exits.
  Screens never import each other in cycles; shared UI goes in `src/ui/`.
- **Data** that screens show goes through `state.cache.load(key, ttl, loader, onValue)` so
  reopening is instant; clear the cache when settings change.
- **Images** in lists use `data-src` + `observeImages()`, never `src` directly.
- **Icons:** `<span class="icon" data-icon="name"></span>` next to a `<span data-i18n>` label
  (never put `data-i18n` on an element that also holds an icon; it would erase it). New icons:
  copy the SVG's inner elements from Lucide into `src/ui/icons.js`.
- **Font:** Roboto is bundled; do not load web fonts at runtime.
- **Navigation:** focusable elements carry `data-nav`; clickable ones add
  `data-action="name"`, handled by the view's `actions` map. `nav.js` picks the nearest
  element in the arrow direction, so layout order is navigation order.
- **Text inputs** fire a `submit-input` event when the user confirms (Enter or the TV
  keyboard's Done).
- **Remote keys:** arrows 37–40, Enter 13, Back 10009, IME Done 65376 / Cancel 65385.

## APIs used

Sonarr and Radarr v3, header `X-Api-Key`: `system/status`, `qualityprofile`, `rootfolder`,
`series/lookup` / `movie/lookup`, `POST series` / `POST movie`. Both servers send
`Access-Control-Allow-Origin: *`, so the app calls them directly.
