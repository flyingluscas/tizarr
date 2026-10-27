# Tizarr

Search movies and TV shows and request them in one click from your own Radarr and Sonarr, on a Samsung TV (Tizen 5.0+).

## Install

On the TV, open **TizenBrew Installer** and install from the GitHub repo `flyingluscas/tizarr`. It installs the `.wgt` from the latest release.

## Setup

On first launch, enter your Sonarr/Radarr URLs and API keys (Settings → General in each app), press **Test**, then pick the default quality profile and root folder. Settings are stored only on the TV.

## Release

`git tag v0.x.y && git push --tags`. The GitHub Action tests, packages `tizarr.wgt` and publishes the release.

## Develop

Plain ES2017, no build step (the target TV runs Chromium 63). `node test/logic.test.js` checks the pure logic.
