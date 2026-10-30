// Which rows ("shelves") each browse screen shows, and how to fill them.
// TMDB shelves need the optional TMDB key; library and Radarr shelves always work.
import { serverReady } from '../config.js';
import { getRecommendations } from './arr.js';
import { interleave, toItem } from './media.js';
import { fetchList } from './tmdb.js';

const MAX_ITEMS = 20;
// Daily trending moves within hours, and TMDB list calls are small and cheap.
export const SHELF_TTL_MS = 60 * 60 * 1000;

/** Cache key for a fetched shelf; Search reuses Home's Trending through it. */
export function shelfCacheKey(screen, shelfId, app) {
  return `shelf:${screen}:${shelfId}:${app.language}:${app.region}`;
}

// TMDB genre ids differ between movies and TV for some genres.
export const GENRES = [
  { id: 'action', movie: 28, show: 10759 },
  { id: 'comedy', movie: 35, show: 35 },
  { id: 'drama', movie: 18, show: 18 },
  { id: 'scifi', movie: 878, show: 10765 },
  { id: 'animation', movie: 16, show: 16 },
  { id: 'documentary', movie: 99, show: 99 },
];

const BOTH = ['movie', 'show'];

function genreShelves(kinds) {
  return GENRES.map((genre) => ({
    id: `genre-${genre.id}`,
    title: `genre.${genre.id}`,
    type: 'genre',
    genre,
    kinds,
  }));
}

const SCREENS = {
  home: [
    { id: 'downloading', title: 'shelf.downloading', type: 'downloading', kinds: BOTH },
    { id: 'trending', title: 'shelf.trending', type: 'trending', kinds: BOTH },
    { id: 'popular-movies', title: 'shelf.popularMovies', type: 'popular', kinds: ['movie'] },
    { id: 'popular-shows', title: 'shelf.popularShows', type: 'popular', kinds: ['show'] },
    { id: 'recommended', title: 'shelf.recommended', type: 'recommended', kinds: ['movie'] },
    { id: 'recent', title: 'shelf.recent', type: 'recent', kinds: BOTH },
    { id: 'top-movies', title: 'shelf.topRatedMovies', type: 'topRated', kinds: ['movie'] },
    { id: 'top-shows', title: 'shelf.topRatedShows', type: 'topRated', kinds: ['show'] },
    ...genreShelves(BOTH),
  ],
  movies: [
    { id: 'downloading', title: 'shelf.downloading', type: 'downloading', kinds: ['movie'] },
    { id: 'trending', title: 'shelf.trending', type: 'trending', kinds: ['movie'] },
    { id: 'popular', title: 'shelf.popular', type: 'popular', kinds: ['movie'] },
    { id: 'recommended', title: 'shelf.recommended', type: 'recommended', kinds: ['movie'] },
    { id: 'top', title: 'shelf.topRated', type: 'topRated', kinds: ['movie'] },
    { id: 'recent', title: 'shelf.recent', type: 'recent', kinds: ['movie'] },
    ...genreShelves(['movie']),
  ],
  shows: [
    { id: 'downloading', title: 'shelf.downloading', type: 'downloading', kinds: ['show'] },
    { id: 'trending', title: 'shelf.trending', type: 'trending', kinds: ['show'] },
    { id: 'popular', title: 'shelf.popular', type: 'popular', kinds: ['show'] },
    { id: 'top', title: 'shelf.topRated', type: 'topRated', kinds: ['show'] },
    { id: 'recent', title: 'shelf.recent', type: 'recent', kinds: ['show'] },
    ...genreShelves(['show']),
  ],
};

const TMDB_TYPES = ['trending', 'popular', 'topRated', 'genre'];
export const LIBRARY_TYPES = ['downloading', 'recent'];

export function isTmdbShelf(shelf) {
  return TMDB_TYPES.includes(shelf.type);
}

/** Shelves for a screen; TMDB shelves only when a key is set. */
export function shelvesFor(screen, config) {
  const hasTmdb = Boolean(config.app.tmdbKey);
  return SCREENS[screen].filter((shelf) => hasTmdb || !isTmdbShelf(shelf));
}

/** Fetches a TMDB or Radarr shelf (library shelves come from libraryShelf instead). */
export async function loadShelf(shelf, config) {
  if (shelf.type === 'recommended') {
    if (!serverReady(config.radarr)) return [];
    const results = await getRecommendations(config.radarr);
    return results.slice(0, MAX_ITEMS).map((result) => ({ ...toItem('movie', result), raw: null }));
  }
  const lists = await Promise.all(
    shelf.kinds.map((kind) =>
      fetchList(config.app, shelf.type, kind, shelf.genre && shelf.genre[kind]),
    ),
  );
  return lists.length === 2 ? interleave(lists[0], lists[1]).slice(0, MAX_ITEMS) : lists[0];
}

/** Downloading / Recently added shelves, built from the already-loaded library. */
export function libraryShelf(shelf, library) {
  const byKind = { movie: library.movies, show: library.shows };
  const lists = shelf.kinds.map((kind) =>
    shelf.type === 'downloading'
      ? byKind[kind].filter((item) => item.status === 'downloading')
      : byKind[kind],
  );
  const merged = lists.length === 2 ? interleave(lists[0], lists[1]) : lists[0];
  return merged.slice(0, MAX_ITEMS);
}

/** "movie:603" → { status, progress } for everything in the library. */
export function libraryIndex(library) {
  const index = new Map();
  for (const item of library.movies.concat(library.shows)) {
    if (item.tmdbId) {
      index.set(`${item.kind}:${item.tmdbId}`, { status: item.status, progress: item.progress });
    }
  }
  return index;
}

/** Marks titles the user already has, so discovery rows show their status badge. */
export function withLibraryStatus(items, index) {
  return items.map((item) => {
    const owned = index.get(`${item.kind}:${item.tmdbId}`);
    return owned ? { ...item, ...owned, inLibrary: true } : item;
  });
}

/**
 * Shows each discovery title only in the first shelf that has it, so Trending, Popular and
 * genre rows don't repeat the same posters. Library shelves (Downloading, Recently added)
 * are the user's own titles: they are kept whole and don't hide anything elsewhere.
 */
export function uniqueAcrossShelves(shelves, itemsByShelf) {
  const seen = new Set();
  const result = {};
  for (const shelf of shelves) {
    const items = itemsByShelf[shelf.id] || [];
    if (LIBRARY_TYPES.includes(shelf.type)) {
      result[shelf.id] = items;
      continue;
    }
    result[shelf.id] = items.filter((item) => {
      if (!item.tmdbId) return true;
      const key = `${item.kind}:${item.tmdbId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return result;
}
