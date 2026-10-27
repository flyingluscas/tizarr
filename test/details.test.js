import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  factsOf,
  formatRuntime,
  ratingsBreakdown,
  seasonNumbers,
  seasonProgress,
} from '../src/data/details.js';

const t = (key, vars) => (vars ? `${key}:${vars.count}` : key);

test('formatRuntime', () => {
  assert.equal(formatRuntime(155), '2h 35m');
  assert.equal(formatRuntime(120), '2h');
  assert.equal(formatRuntime(49), '49m');
  assert.equal(formatRuntime(0), '');
});

test('factsOf lists movie facts and caps genres', () => {
  const movie = {
    year: 2021,
    runtime: 155,
    certification: 'PG-13',
    genres: ['Science Fiction', 'Adventure', 'Drama', 'Action'],
    studio: 'Legendary Pictures',
  };
  assert.deepEqual(factsOf('movie', movie, t), [
    '2021',
    '2h 35m',
    'PG-13',
    'Science Fiction, Adventure, Drama',
    'Legendary Pictures',
  ]);
});

test('factsOf adds status and season count for shows', () => {
  const show = {
    year: 2022,
    network: 'Apple TV',
    status: 'continuing',
    seasons: [{ seasonNumber: 0 }, { seasonNumber: 1 }, { seasonNumber: 2 }],
  };
  assert.deepEqual(factsOf('show', show, t), [
    '2022',
    'Apple TV',
    'details.continuing',
    'details.seasons:2',
  ]);
  assert.deepEqual(factsOf('show', { seasons: [{ seasonNumber: 1 }] }, t), ['details.oneSeason:1']);
});

test('ratingsBreakdown keeps the sources that exist', () => {
  const radarr = {
    ratings: {
      imdb: { value: 8 },
      tmdb: { value: 7.785 },
      metacritic: { value: 74 },
      rottenTomatoes: { value: 83 },
      trakt: { value: 8.1 },
    },
  };
  assert.deepEqual(ratingsBreakdown(radarr), [
    { label: 'IMDb', text: '8.0' },
    { label: 'Rotten Tomatoes', text: '83%' },
    { label: 'Metacritic', text: '74' },
    { label: 'TMDB', text: '7.8' },
  ]);
  assert.deepEqual(ratingsBreakdown({ ratings: { votes: 10, value: 8.6 } }), [
    { label: null, text: '8.6' },
  ]);
  assert.deepEqual(ratingsBreakdown({}), []);
});

test('seasonNumbers skips specials and sorts', () => {
  assert.deepEqual(
    seasonNumbers({ seasons: [{ seasonNumber: 2 }, { seasonNumber: 0 }, { seasonNumber: 1 }] }),
    [1, 2],
  );
});

test('seasonProgress shows real seasons with episodes', () => {
  const series = {
    seasons: [
      { seasonNumber: 0, statistics: { episodeFileCount: 0, episodeCount: 2 } },
      { seasonNumber: 1, statistics: { episodeFileCount: 0, episodeCount: 0 } },
      { seasonNumber: 4, statistics: { episodeFileCount: 3, episodeCount: 10 } },
    ],
  };
  assert.deepEqual(seasonProgress(series), ['S4 3/10']);
});
