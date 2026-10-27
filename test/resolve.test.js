import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { emptyConfig } from '../src/config.js';
import { resolveForRequest } from '../src/data/resolve.js';

const server = {
  url: 'http://arr.example',
  apiKey: 'test-key',
  qualityProfileId: 1,
  rootFolderPath: '/m',
};

/** Fake XHR answering by URL, recording every URL requested. */
function fakeXhrByUrl(answers, seen) {
  return class {
    open(method, url) {
      this.url = url;
    }
    setRequestHeader() {}
    send() {
      seen.push(this.url);
      const key = Object.keys(answers).find((part) => this.url.includes(part));
      this.status = 200;
      this.responseText = JSON.stringify(answers[key]);
      this.onload();
    }
  };
}

afterEach(() => {
  delete globalThis.XMLHttpRequest;
});

test('resolveForRequest returns the existing lookup result untouched', async () => {
  const raw = { title: 'X' };
  assert.equal(await resolveForRequest({ kind: 'movie', raw }, emptyConfig()), raw);
});

test('movies are looked up in Radarr by TMDB id', async () => {
  const seen = [];
  globalThis.XMLHttpRequest = fakeXhrByUrl(
    { 'movie/lookup': [{ title: 'Dune', tmdbId: 438631 }] },
    seen,
  );
  const config = { ...emptyConfig(), radarr: server };
  const raw = await resolveForRequest({ kind: 'movie', tmdbId: 438631, raw: null }, config);
  assert.equal(raw.title, 'Dune');
  assert.deepEqual(seen, ['http://arr.example/api/v3/movie/lookup?term=tmdb%3A438631']);
});

test('shows go TMDB → TVDB id → Sonarr lookup', async () => {
  const seen = [];
  globalThis.XMLHttpRequest = fakeXhrByUrl(
    { external_ids: { tvdb_id: 371980 }, 'series/lookup': [{ title: 'Severance' }] },
    seen,
  );
  const config = { ...emptyConfig(), sonarr: server };
  config.app.tmdbKey = 'tmdb-key';
  const raw = await resolveForRequest({ kind: 'show', tmdbId: 95396, raw: null }, config);
  assert.equal(raw.title, 'Severance');
  assert.ok(seen[0].includes('/tv/95396/external_ids'));
  assert.equal(seen[1], 'http://arr.example/api/v3/series/lookup?term=tvdb%3A371980');
});

test('shows that already carry a TVDB id skip TMDB', async () => {
  const seen = [];
  globalThis.XMLHttpRequest = fakeXhrByUrl({ 'series/lookup': [{ title: 'Ted Lasso' }] }, seen);
  const config = { ...emptyConfig(), sonarr: server };
  await resolveForRequest({ kind: 'show', tmdbId: 97546, tvdbId: 383203, raw: null }, config);
  assert.deepEqual(seen, ['http://arr.example/api/v3/series/lookup?term=tvdb%3A383203']);
});

test('resolveForRequest fails clearly when nothing matches', async () => {
  globalThis.XMLHttpRequest = fakeXhrByUrl({ lookup: [] }, []);
  const config = { ...emptyConfig(), radarr: server };
  await assert.rejects(resolveForRequest({ kind: 'movie', tmdbId: 1, raw: null }, config));
});
