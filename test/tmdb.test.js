import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fromSearchResults, fromTmdb, listRequest, tmdbUrl } from '../src/data/tmdb.js';

test('tmdbUrl encodes the key and skips empty params', () => {
  assert.equal(
    tmdbUrl('k y', '/movie/popular', { language: 'pt-BR', region: '', page: undefined }),
    'https://api.themoviedb.org/3/movie/popular?api_key=k%20y&language=pt-BR',
  );
});

test('listRequest maps list types, kinds and language codes', () => {
  assert.deepEqual(listRequest('trending', 'show', { language: 'en', region: 'BR' }), {
    path: '/trending/tv/day',
    params: { language: 'en-US', region: 'BR' },
  });
  assert.equal(listRequest('topRated', 'movie').path, '/movie/top_rated');
  assert.deepEqual(listRequest('genre', 'movie', { genreId: 28, language: 'pt-BR' }), {
    path: '/discover/movie',
    params: { language: 'pt-BR', region: undefined, with_genres: 28, sort_by: 'popularity.desc' },
  });
});

test('fromTmdb maps movies and shows to items', () => {
  const movie = fromTmdb('movie', {
    id: 1,
    title: 'Dune',
    release_date: '2021-09-15',
    overview: 'Spice.',
    poster_path: '/p.jpg',
  });
  assert.deepEqual(movie, {
    kind: 'movie',
    tmdbId: 1,
    title: 'Dune',
    year: '2021',
    overview: 'Spice.',
    poster: 'https://image.tmdb.org/t/p/w342/p.jpg',
    backdrop: '',
    rating: null,
    inLibrary: false,
    raw: null,
  });
  const show = fromTmdb('show', { id: 2, name: 'Severance', first_air_date: '2022-02-18' });
  assert.equal(show.title, 'Severance');
  assert.equal(show.year, '2022');
  assert.equal(show.poster, '');
});

test('fromTmdb rounds the TMDB score and skips unrated titles', () => {
  assert.equal(fromTmdb('movie', { id: 1, vote_average: 7.849, vote_count: 900 }).rating, 7.8);
  assert.equal(fromTmdb('movie', { id: 1, vote_average: 0, vote_count: 0 }).rating, null);
});

test('fromSearchResults keeps movies and shows with posters, in TMDB order', () => {
  const items = fromSearchResults([
    { media_type: 'person', id: 1, name: 'Someone', profile_path: '/p.jpg' },
    { media_type: 'tv', id: 2, name: 'Show', poster_path: '/s.jpg', first_air_date: '2020-01-01' },
    { media_type: 'movie', id: 3, title: 'No poster' },
    { media_type: 'movie', id: 4, title: 'Movie', poster_path: '/m.jpg' },
  ]);
  assert.deepEqual(
    items.map((item) => [item.kind, item.tmdbId]),
    [
      ['show', 2],
      ['movie', 4],
    ],
  );
});
