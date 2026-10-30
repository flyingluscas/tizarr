import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyConfig } from '../src/config.js';
import {
  isTmdbShelf,
  libraryIndex,
  libraryShelf,
  shelvesFor,
  uniqueAcrossShelves,
  withLibraryStatus,
} from '../src/data/shelves.js';

const library = {
  movies: [
    { kind: 'movie', tmdbId: 1, status: 'downloading', progress: 40 },
    { kind: 'movie', tmdbId: 2, status: 'downloaded' },
  ],
  shows: [{ kind: 'show', tmdbId: 3, status: 'missing' }],
  errors: [],
};

test('shelvesFor hides TMDB shelves without a key', () => {
  const config = emptyConfig();
  const without = shelvesFor('home', config);
  assert.ok(without.length > 0);
  assert.ok(without.every((shelf) => !isTmdbShelf(shelf)));
  config.app.tmdbKey = 'test-key';
  assert.ok(shelvesFor('home', config).some(isTmdbShelf));
});

test('Movies and Shows screens only use their own kind', () => {
  const config = emptyConfig();
  config.app.tmdbKey = 'test-key';
  assert.ok(shelvesFor('movies', config).every((shelf) => shelf.kinds.join() === 'movie'));
  assert.ok(shelvesFor('shows', config).every((shelf) => shelf.kinds.join() === 'show'));
});

test('libraryShelf builds Downloading and Recently added', () => {
  const downloading = libraryShelf({ type: 'downloading', kinds: ['movie', 'show'] }, library);
  assert.deepEqual(
    downloading.map((item) => item.tmdbId),
    [1],
  );
  const recent = libraryShelf({ type: 'recent', kinds: ['movie', 'show'] }, library);
  assert.deepEqual(
    recent.map((item) => item.tmdbId),
    [1, 3, 2],
  );
});

test('withLibraryStatus marks owned titles by kind and TMDB id', () => {
  const index = libraryIndex(library);
  const items = [
    { kind: 'movie', tmdbId: 1, inLibrary: false },
    { kind: 'show', tmdbId: 1, inLibrary: false },
  ];
  const [owned, other] = withLibraryStatus(items, index);
  assert.deepEqual(owned, {
    kind: 'movie',
    tmdbId: 1,
    inLibrary: true,
    status: 'downloading',
    progress: 40,
  });
  assert.equal(other.inLibrary, false);
  assert.equal(items[0].inLibrary, false, 'input items are not mutated');
});

test('uniqueAcrossShelves keeps each title in its first discovery shelf only', () => {
  const shelves = [
    { id: 'downloading', type: 'downloading' },
    { id: 'trending', type: 'trending' },
    { id: 'popular', type: 'popular' },
    { id: 'recent', type: 'recent' },
  ];
  const movie = (tmdbId) => ({ kind: 'movie', tmdbId });
  const result = uniqueAcrossShelves(shelves, {
    downloading: [movie(1)],
    trending: [movie(1), movie(2), { kind: 'show', tmdbId: 2 }],
    popular: [movie(2), movie(3), { kind: 'movie', tmdbId: null }],
    recent: [movie(2)],
  });
  const ids = (list) => list.map((item) => `${item.kind}:${item.tmdbId}`);
  assert.deepEqual(ids(result.downloading), ['movie:1']);
  assert.deepEqual(ids(result.trending), ['movie:1', 'movie:2', 'show:2']);
  assert.deepEqual(ids(result.popular), ['movie:3', 'movie:null']);
  assert.deepEqual(ids(result.recent), ['movie:2']);
});
