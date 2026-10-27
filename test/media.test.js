import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRequestBody, interleave, toItem } from '../src/data/media.js';

const movie = {
  title: 'Dune',
  year: 2021,
  overview: 'Spice.',
  tmdbId: 438631,
  images: [
    { coverType: 'fanart', remoteUrl: 'https://image.tmdb.org/t/p/original/f.jpg' },
    { coverType: 'poster', remoteUrl: 'https://image.tmdb.org/t/p/original/p.jpg' },
  ],
};
const server = { url: 'http://r', apiKey: 'k', qualityProfileId: 4, rootFolderPath: '/movies' };

test('toItem maps a lookup result to a display item', () => {
  const item = toItem('movie', movie);
  assert.equal(item.kind, 'movie');
  assert.equal(item.title, 'Dune');
  assert.equal(item.year, 2021);
  assert.equal(item.inLibrary, false);
  assert.equal(item.raw, movie);
});

test('toItem uses a card-sized TMDB poster', () => {
  assert.equal(toItem('movie', movie).poster, 'https://image.tmdb.org/t/p/w342/p.jpg');
});

test('toItem ignores posters that need *arr auth or are missing', () => {
  assert.equal(toItem('show', { title: 'X' }).poster, '');
  const local = { title: 'X', images: [{ coverType: 'poster', url: '/local.jpg' }] };
  assert.equal(toItem('show', local).poster, '');
});

test('toItem flags titles already in the library', () => {
  assert.equal(toItem('show', { title: 'X', id: 5 }).inLibrary, true);
});

test('interleave alternates and keeps leftovers', () => {
  assert.deepEqual(interleave([1, 2, 3], ['a']), [1, 'a', 2, 3]);
  assert.deepEqual(interleave([], ['a', 'b']), ['a', 'b']);
});

test('buildRequestBody adds movie defaults without mutating the result', () => {
  const body = buildRequestBody('movie', movie, server);
  assert.equal(body.tmdbId, 438631);
  assert.equal(body.qualityProfileId, 4);
  assert.equal(body.rootFolderPath, '/movies');
  assert.equal(body.monitored, true);
  assert.equal(body.minimumAvailability, 'released');
  assert.deepEqual(body.addOptions, { searchForMovie: true });
  assert.equal(movie.qualityProfileId, undefined);
});

test('buildRequestBody adds show defaults', () => {
  const body = buildRequestBody('show', { title: 'S', tvdbId: 9 }, server);
  assert.equal(body.tvdbId, 9);
  assert.equal(body.seasonFolder, true);
  assert.deepEqual(body.addOptions, { monitor: 'all', searchForMissingEpisodes: true });
});
