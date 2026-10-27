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
- All user-facing text goes in `src/strings.js`.
- Every magic number gets a named constant with a short reason.

### Lightweight and fast

- This runs on a 2019 TV with a slow CPU and Chromium 63. Performance is a feature.
- No runtime dependencies. Adding one needs a very strong reason and the owner's approval.
- No frameworks, no virtual DOM, no state libraries, no CSS frameworks. Plain DOM APIs.
- Prefer the simplest design that works. No heavy architecture.
- Build DOM lists with a `DocumentFragment` and insert once. Avoid layout thrashing (reading
  layout inside write loops).
- Keep network payloads and images small (e.g. TMDB `w342` posters, capped result counts).
- Watch the bundle size (`dist/app.js`, ~8 KB today). Justify any big jump.

### Tizen 5.0 compatibility (Chromium 63)

- Write modern JavaScript; esbuild lowers syntax to `chrome63`. It does **not** polyfill APIs.
- Do not use APIs newer than Chromium 63, e.g. `Array.prototype.flat/flatMap/at`,
  `String.prototype.replaceAll`, `Object.fromEntries`, `Promise.allSettled`,
  `Element.replaceChildren`, `AbortController`, `ResizeObserver`, `structuredClone`,
  `loading="lazy"`. ESLint blocks the common ones (`eslint.config.js`); check others on MDN.
- CSS is not lowered either: no flexbox `gap`, no `aspect-ratio`, no `:is()/:where()`, no
  container queries. Use margins.
- Use XHR (`src/api.js`), not `fetch`, for timeouts without `AbortController`.

### Security

- Never commit API keys, URLs of private servers or other secrets. The repo is public. Users
  enter their settings on the TV; they are stored in `localStorage` only.

### Testing

- Every change to logic (`src/media.js`, `src/config.js`, `src/api.js`, or new pure code)
  comes with tests in `test/`, using the built-in `node:test` and `node:assert/strict`.
- Keep pure logic out of view modules so it can be tested without a DOM.
- `npm run check` (lint, format check, tests) must pass before every commit; CI runs it on
  every pull request and push to `main`.
- When touching the build, `index.html`, `tizen/` or `scripts/`, also run `npm run validate`
  (builds `dist/` and checks required files, Chromium-compatible syntax and the version).
- UI changes: also verify in a browser (`npm run build`, then open `dist/index.html`; Escape
  acts as the Back key) and say what you checked.

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

| Command          | What it does                                    |
| ---------------- | ----------------------------------------------- |
| `npm ci`         | Install dev tools (Node 22, see `.nvmrc`)       |
| `npm run check`  | Everything CI runs; must pass before committing |
| `npm test`       | Unit tests only                                 |
| `npm run lint`   | ESLint                                          |
| `npm run format` | Prettier (write)                                |
| `npm run build`  | Bundle `src/` into `dist/`                      |

## How the code is organized

```
src/
  main.js           entry point: initializes views, opens the first screen
  strings.js        all UI text
  dom.js            $, $$, el, setStatus helpers
  config.js         settings shape, validation, localStorage persistence (pure + testable)
  media.js          movie/show kinds, mapping lookup results, request bodies (pure)
  api.js            Sonarr/Radarr v3 client (XHR, X-Api-Key, 15 s timeout)
  state.js          the only shared mutable state (saved config)
  nav.js            remote navigation: focus, arrows, Enter, Back, view switching
  views/
    settings.js     server URL/key, Test, default profile and root folder
    search.js       parallel lookups, poster grid
    details.js      overview and Request button
    card.js         poster card component
  index.html        markup for all views
  style.css         1920×1080 TV layout
tizen/
  config.xml        Tizen manifest (version is injected from package.json at build)
  icon.png          app icon
scripts/
  build.js          esbuild bundle → dist/
  validate.js       checks on dist/
  sign.exp          signs dist/ into a .wgt in CI (Tizen CLI prompts need expect)
test/               node:test unit tests
```

Patterns to follow:

- **Views** export `initX()` (registers with `registerView`) and, if needed, `openX()`.
  Views never import each other in cycles; shared UI pieces go in their own module (like
  `card.js`).
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
