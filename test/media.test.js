import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  backdropOf,
  buildRequestBody,
  httpsOnly,
  interleave,
  ratingOf,
  resizeTmdb,
  toItem,
} from '../src/data/media.js';

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

test('resizeTmdb swaps the TMDB size segment and leaves other URLs alone', () => {
  assert.equal(
    resizeTmdb('https://image.tmdb.org/t/p/w185/p.jpg', 'w342'),
    'https://image.tmdb.org/t/p/w342/p.jpg',
  );
  const tvdb = 'https://artworks.thetvdb.com/banners/p.jpg';
  assert.equal(resizeTmdb(tvdb, 'w342'), tvdb);
});

test('ratingOf prefers IMDb, then TMDB, then Sonarr, and ignores missing scores', () => {
  assert.equal(ratingOf({ ratings: { imdb: { value: 8.04 }, tmdb: { value: 7.5 } } }), 8);
  assert.equal(ratingOf({ ratings: { imdb: { value: 0 }, tmdb: { value: 7.46 } } }), 7.5);
  assert.equal(ratingOf({ ratings: { votes: 10, value: 8.7 } }), 8.7);
  assert.equal(ratingOf({ ratings: { value: 0 } }), null);
  assert.equal(ratingOf({}), null);
  assert.equal(toItem('movie', { title: 'X', ratings: { imdb: { value: 6.12 } } }).rating, 6.1);
});

test('buildRequestBody applies season presets and hand-picked seasons', () => {
  const show = {
    title: 'S',
    seasons: [{ seasonNumber: 0 }, { seasonNumber: 1 }, { seasonNumber: 2 }],
  };
  const latest = buildRequestBody('show', show, server, { preset: 'lastSeason' });
  assert.deepEqual(latest.addOptions, { monitor: 'lastSeason', searchForMissingEpisodes: true });
  const picked = buildRequestBody('show', show, server, { picked: [2] });
  assert.deepEqual(picked.addOptions, { monitor: 'skip', searchForMissingEpisodes: true });
  assert.deepEqual(
    picked.seasons.map((season) => season.monitored),
    [false, false, true],
  );
  assert.equal(show.seasons[2].monitored, undefined, 'lookup result is not mutated');
});

test('httpsOnly and backdropOf only pass https image URLs', () => {
  assert.equal(httpsOnly('javascript:alert(1)'), '');
  assert.equal(httpsOnly('http://x/y.jpg'), '');
  assert.equal(httpsOnly('https://x/y.jpg'), 'https://x/y.jpg');
  const images = [{ coverType: 'fanart', remoteUrl: 'https://image.tmdb.org/t/p/original/b.jpg' }];
  assert.equal(backdropOf({ images }), 'https://image.tmdb.org/t/p/w1280/b.jpg');
  assert.equal(backdropOf({ images: [{ coverType: 'fanart', remoteUrl: 'data:x' }] }), '');
  assert.equal(backdropOf({}), '');
});
