import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { emptyConfig } from '../src/config.js';
import {
  addRecent,
  createResultsCache,
  filterByKind,
  loadRecent,
  saveRecent,
  searchKey,
  searchTitles,
} from '../src/data/search.js';

/** Answers each GET by the first route whose text appears in the URL; anything else fails. */
function fakeRoutes(routes, calls = []) {
  return class {
    open(method, url) {
      Object.assign(this, { method, url });
    }
    setRequestHeader() {}
    send() {
      calls.push(this.url);
      const route = Object.keys(routes).find((part) => this.url.indexOf(part) !== -1);
      if (!route || this.method !== 'GET') return this.onerror();
      Object.assign(this, { status: 200, responseText: JSON.stringify(routes[route]) });
      this.onload();
    }
  };
}

afterEach(() => {
  delete globalThis.XMLHttpRequest;
});

function serversConfig(tmdbKey = '') {
  const config = emptyConfig();
  config.app.tmdbKey = tmdbKey;
  const server = { apiKey: 'test-key', qualityProfileId: 1, rootFolderPath: '/media' };
  config.radarr = { ...server, url: 'http://radarr.example' };
  config.sonarr = { ...server, url: 'http://sonarr.example' };
  return config;
}

const memoryStorage = () => {
  const data = {};
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => (data[k] = v) };
};

test('searchKey ignores case and spaces, and separates TMDB from server results', () => {
  const config = emptyConfig();
  assert.equal(searchKey(config, ' The Bear '), searchKey(config, 'the bear'));
  const withTmdb = emptyConfig();
  withTmdb.app.tmdbKey = 'test-key';
  assert.notEqual(searchKey(withTmdb, 'the bear'), searchKey(config, 'the bear'));
});

test('filterByKind keeps all, movies or shows', () => {
  const items = [{ kind: 'movie' }, { kind: 'show' }];
  assert.equal(filterByKind(items, 'all').length, 2);
  assert.deepEqual(filterByKind(items, 'show'), [{ kind: 'show' }]);
});

test('addRecent puts the newest first, drops repeats and caps the list', () => {
  assert.deepEqual(addRecent(['dune', 'alien'], ' Alien '), ['Alien', 'dune']);
  assert.deepEqual(addRecent(['dune'], '  '), ['dune']);
  const many = Array.from({ length: 8 }, (_, i) => `t${i}`);
  assert.deepEqual(addRecent(many, 'new').slice(-1), ['t6']);
});

test('recent searches survive a round trip and ignore broken storage', () => {
  const storage = memoryStorage();
  saveRecent(['dune'], storage);
  assert.deepEqual(loadRecent(storage), ['dune']);
  storage.setItem('tizarr.recentSearches', '{not json');
  assert.deepEqual(loadRecent(storage), []);
});

test('results cache expires and keeps only the latest searches', () => {
  let clock = 0;
  const cache = createResultsCache({ now: () => clock });
  cache.set('a', 1);
  assert.equal(cache.get('a'), 1);
  clock = 10 * 60 * 1000;
  assert.equal(cache.get('a'), null);
  for (let i = 0; i < 11; i++) cache.set(`k${i}`, i);
  assert.equal(cache.get('k0'), null);
  assert.equal(cache.get('k10'), 10);
});

test('searchTitles uses TMDB when a key is set, without touching the servers', async () => {
  const calls = [];
  globalThis.XMLHttpRequest = fakeRoutes(
    {
      '/search/multi': {
        results: [{ media_type: 'tv', id: 1, name: 'The Bear', poster_path: '/b.jpg' }],
      },
    },
    calls,
  );
  const partials = [];
  const result = await searchTitles(serversConfig('test-key'), 'bear', (v) => partials.push(v));
  assert.deepEqual(
    result.items.map((item) => [item.kind, item.title]),
    [['show', 'The Bear']],
  );
  assert.equal(partials.length, 1);
  assert.ok(calls.every((url) => url.indexOf('api.themoviedb.org') !== -1));
});

test('searchTitles falls back to the servers when TMDB fails, reporting each answer', async () => {
  globalThis.XMLHttpRequest = fakeRoutes({
    '/movie/lookup': [{ title: 'Alien', tmdbId: 348, images: [] }],
    '/series/lookup': [{ title: 'Alien: Earth', tvdbId: 9, images: [] }],
  });
  const partials = [];
  const result = await searchTitles(serversConfig('test-key'), 'alien', (v) => partials.push(v));
  assert.deepEqual(
    result.items.map((item) => item.title),
    ['Alien', 'Alien: Earth'],
  );
  assert.deepEqual(result.errors, []);
  assert.equal(partials.length, 2);
  assert.equal(partials[0].items.length, 1);
});

test('searchTitles keeps one server’s titles when the other fails', async () => {
  globalThis.XMLHttpRequest = fakeRoutes({
    '/movie/lookup': [{ title: 'Alien', tmdbId: 348, images: [] }],
  });
  const result = await searchTitles(serversConfig(), 'alien', () => {});
  assert.deepEqual(
    result.items.map((item) => item.title),
    ['Alien'],
  );
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /^Sonarr: /);
});
