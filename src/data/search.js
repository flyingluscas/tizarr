// Search: TMDB's multi search when a key is set (one small, ranked call), else Radarr and
// Sonarr lookups. Also the short-lived results cache and the recent searches list.
import { SERVER_NAMES, serverReady } from '../config.js';
import { lookup } from './arr.js';
import { KINDS, interleave, toItem } from './media.js';
import { searchTmdb } from './tmdb.js';

// Lookups can return 100+ titles; more cards only slow the TV down.
const MAX_RESULTS_PER_SERVER = 20;
// Enough to make going back to a search instant without holding big lookups for long.
const RESULTS_TTL_MS = 10 * 60 * 1000;
const MAX_CACHED_SEARCHES = 10;
// A short list fits on one line of chips above the results.
const MAX_RECENT = 8;
const RECENT_STORAGE_KEY = 'tizarr.recentSearches';

const normalize = (term) => term.trim().toLowerCase();

/** Same words in another case or with extra spaces count as the same search. */
export function searchKey(config, term) {
  const source = config.app.tmdbKey ? 'tmdb' : 'arr';
  return `${source}:${config.app.language}:${normalize(term)}`;
}

/** 'all' | 'movie' | 'show' */
export function filterByKind(items, filter) {
  return filter === 'all' ? items : items.filter((item) => item.kind === filter);
}

/** Newest first, no repeats (ignoring case), capped. */
export function addRecent(list, term) {
  const clean = term.trim();
  if (!clean) return list;
  const rest = list.filter((entry) => normalize(entry) !== normalize(clean));
  return [clean].concat(rest).slice(0, MAX_RECENT);
}

export function loadRecent(storage = localStorage) {
  try {
    const list = JSON.parse(storage.getItem(RECENT_STORAGE_KEY));
    return Array.isArray(list) ? list.filter((entry) => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}

export function saveRecent(list, storage = localStorage) {
  try {
    storage.setItem(RECENT_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Storage full or blocked: recent searches just aren't remembered.
  }
}

/** Last few searches in memory only: lookup results are too big for localStorage. */
export function createResultsCache({ now = Date.now } = {}) {
  const entries = new Map();
  return {
    get(key) {
      const entry = entries.get(key);
      return entry && now() < entry.expires ? entry.value : null;
    },
    set(key, value) {
      entries.delete(key);
      entries.set(key, { value, expires: now() + RESULTS_TTL_MS });
      // Maps keep insertion order, so the first key is the oldest search.
      if (entries.size > MAX_CACHED_SEARCHES) entries.delete(entries.keys().next().value);
    },
  };
}

async function lookupKind(config, kind, term) {
  const name = KINDS[kind].server;
  if (!serverReady(config[name])) return { items: [] };
  try {
    const results = await lookup(config[name], kind, term);
    return { items: results.slice(0, MAX_RESULTS_PER_SERVER).map((r) => toItem(kind, r)) };
  } catch (error) {
    return { items: [], error: `${SERVER_NAMES[name]}: ${error.message}` };
  }
}

/**
 * Radarr and Sonarr in parallel. onPartial gets { items, errors } as each server answers, so
 * fast results show without waiting for the slower server; resolves with the final value.
 */
export function searchServers(config, term, onPartial) {
  const found = { movie: { items: [] }, show: { items: [] } };
  const combined = () => ({
    items: interleave(found.movie.items, found.show.items),
    errors: [found.movie.error, found.show.error].filter(Boolean),
  });
  const side = (kind) =>
    lookupKind(config, kind, term).then((result) => {
      found[kind] = result;
      onPartial(combined());
    });
  return Promise.all([side('movie'), side('show')]).then(combined);
}

/** TMDB when a key is set (falling back to the servers if TMDB fails), else the servers. */
export async function searchTitles(config, term, onPartial) {
  if (config.app.tmdbKey) {
    try {
      const value = { items: await searchTmdb(config.app, term), errors: [] };
      onPartial(value);
      return value;
    } catch {
      // TMDB down or key revoked: the user's own servers can still answer.
    }
  }
  return searchServers(config, term, onPartial);
}
