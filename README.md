# Tizarr

Search movies and TV shows and request them in one click from your own Radarr and Sonarr, on a
Samsung TV (Tizen 5.0+).

## Install

On the TV, open **TizenBrew Installer** and install from the GitHub repo `flyingluscas/tizarr`.
It installs the `.wgt` from the latest release.

## Setup

On first launch, enter your Sonarr/Radarr URLs and API keys (Settings → General in each app),
press **Test**, then pick the default quality profile and root folder. Settings are stored only
on the TV.

## Development

Requires Node 22.

```sh
npm ci
npm run check     # lint, format check, tests
npm run build     # bundle into dist/ (open dist/index.html in a browser; Escape = Back)
```

See [AGENTS.md](AGENTS.md) for the rules, code organization and release process.
