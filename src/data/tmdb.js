// TMDB v3 client (optional; enabled when the user enters an API key). Only the key, language
// and region are sent, and only to api.themoviedb.org.
import { requestJson } from './http.js';

const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_URL = 'https://image.tmdb.org/t/p/';
// Row posters are 240 px wide; w185 would be upscaled and blurry on a TV.
const ROW_POSTER_SIZE = 'w342';
const BACKDROP_SIZE = 'w1280';
// One page is 20 titles, enough for a row.
const MAX_ITEMS = 20;

const LANGUAGE_CODES = { en: 'en-US', 'pt-BR': 'pt-BR' };
const TMDB_KIND = { movie: 'movie', show: 'tv' };

export function tmdbUrl(key, path, params = {}) {
  const query = Object.keys(params)
    .filter((name) => params[name] !== undefined && params[name] !== '')
    .map((name) => `&${name}=${encodeURIComponent(params[name])}`)
    .join('');
  return `${BASE_URL}${path}?api_key=${encodeURIComponent(key)}${query}`;
}

function get(key, path, params) {
  return requestJson('GET', tmdbUrl(key, path, params));
}

/** Resolves when the key works; rejects with `status` 401 when it does not. */
export function testKey(key) {
  return get(key, '/configuration');
}

/** Path and params for a list type ('trending' | 'popular' | 'topRated' | 'genre'). */
export function listRequest(type, kind, { genreId, language, region } = {}) {
  const tv = TMDB_KIND[kind];
  const params = { language: LANGUAGE_CODES[language] || LANGUAGE_CODES.en, region };
  if (type === 'trending') return { path: `/trending/${tv}/week`, params };
  if (type === 'popular') return { path: `/${tv}/popular`, params };
  if (type === 'topRated') return { path: `/${tv}/top_rated`, params };
  return {
    path: `/discover/${tv}`,
    params: { ...params, with_genres: genreId, sort_by: 'popularity.desc' },
  };
}

export function fromTmdb(kind, result) {
  const date = result.release_date || result.first_air_date || '';
  return {
    kind,
    tmdbId: result.id,
    title: result.title || result.name,
    year: date.slice(0, 4),
    overview: result.overview || '',
    poster: result.poster_path ? `${IMAGE_URL}${ROW_POSTER_SIZE}${result.poster_path}` : '',
    backdrop: result.backdrop_path ? `${IMAGE_URL}${BACKDROP_SIZE}${result.backdrop_path}` : '',
    rating:
      result.vote_count > 0 && result.vote_average > 0
        ? Math.round(result.vote_average * 10) / 10
        : null,
    inLibrary: false,
    // Resolved through Radarr/Sonarr only when the user requests it (see resolve.js).
    raw: null,
  };
}

export async function fetchList(app, type, kind, genreId) {
  const { path, params } = listRequest(type, kind, {
    genreId,
    language: app.language,
    region: app.region,
  });
  const data = await get(app.tmdbKey, path, params);
  return (data.results || [])
    .filter((result) => result.poster_path)
    .slice(0, MAX_ITEMS)
    .map((result) => fromTmdb(kind, result));
}

/** "More like this" for a title. */
export async function fetchRecommendations(app, kind, tmdbId) {
  const language = LANGUAGE_CODES[app.language] || LANGUAGE_CODES.en;
  const data = await get(app.tmdbKey, `/${TMDB_KIND[kind]}/${tmdbId}/recommendations`, {
    language,
  });
  return (data.results || [])
    .filter((result) => result.poster_path)
    .slice(0, MAX_ITEMS)
    .map((result) => fromTmdb(kind, result));
}

/** Map of season number → episode count (Sonarr doesn't know them before a show is added). */
export async function fetchSeasonCounts(key, tmdbId) {
  const show = await get(key, `/tv/${tmdbId}`);
  const counts = new Map();
  for (const season of show.seasons || []) counts.set(season.season_number, season.episode_count);
  return counts;
}

/** TVDB id for a TMDB show (Sonarr looks shows up by TVDB id). */
export async function tvdbIdFor(key, tmdbId) {
  const ids = await get(key, `/tv/${tmdbId}/external_ids`);
  return ids.tvdb_id || null;
}
