// What is already in Sonarr/Radarr, with a download status per title.
import { serverReady, SERVER_NAMES } from '../config.js';
import { t } from '../i18n.js';
import { getMovies, getQueue, getSeries } from './arr.js';
import { toItem } from './media.js';

/** Map of movieId/seriesId → download progress (0–100) from queue records. */
export function queueProgress(records, idField) {
  const totals = new Map();
  for (const record of records) {
    const id = record[idField];
    if (!id) continue;
    const total = totals.get(id) || { size: 0, left: 0 };
    total.size += record.size || 0;
    total.left += record.sizeleft || 0;
    totals.set(id, total);
  }
  const progress = new Map();
  totals.forEach((total, id) => {
    progress.set(id, total.size ? Math.round(((total.size - total.left) / total.size) * 100) : 0);
  });
  return progress;
}

export function movieStatus(movie, progress) {
  if (progress !== undefined) return 'downloading';
  if (movie.hasFile) return 'downloaded';
  return movie.isAvailable ? 'missing' : 'upcoming';
}

export function seriesStatus(series, progress) {
  const stats = series.statistics || {};
  if (progress !== undefined) return 'downloading';
  if (!stats.episodeCount) return 'upcoming';
  return stats.episodeFileCount >= stats.episodeCount ? 'downloaded' : 'missing';
}

export function toLibraryItem(kind, raw, progressById) {
  const progress = progressById.get(raw.id);
  const item = toItem(kind, raw);
  // Library entries are never requested again, so the bulky raw object is not kept/cached.
  item.raw = null;
  item.added = raw.added || '';
  item.progress = progress;
  if (kind === 'movie') {
    item.status = movieStatus(raw, progress);
  } else {
    const stats = raw.statistics || {};
    item.status = seriesStatus(raw, progress);
    item.episodes = { have: stats.episodeFileCount || 0, total: stats.episodeCount || 0 };
  }
  return item;
}

/** Newest first (ISO dates sort as strings). */
export function sortByAdded(items) {
  return items.slice().sort((a, b) => (a.added < b.added ? 1 : a.added > b.added ? -1 : 0));
}

async function loadSide(server, kind, getItems, idField) {
  const [list, queue] = await Promise.all([getItems(server), getQueue(server)]);
  const progress = queueProgress(queue, idField);
  return sortByAdded(list.map((raw) => toLibraryItem(kind, raw, progress)));
}

export const LIBRARY_CACHE_KEY = 'library';
// Short: statuses (downloading, downloaded) change often, but reopening should be instant.
const LIBRARY_TTL_MS = 2 * 60 * 1000;

/** Cached library shared by every screen (see cache.load for the callback contract). */
export function watchLibrary(cache, config, onValue) {
  return cache.load(LIBRARY_CACHE_KEY, LIBRARY_TTL_MS, () => loadLibrary(config), onValue);
}

/** { movies, shows, errors } — one failing server does not hide the other's titles. */
export async function loadLibrary(config) {
  const errors = [];
  async function side(name, kind, getItems, idField) {
    if (!serverReady(config[name])) {
      // A server left blank is simply off; a half-configured one is worth pointing out.
      if (config[name].url) errors.push(t('error.notConfigured', { server: SERVER_NAMES[name] }));
      return [];
    }
    try {
      return await loadSide(config[name], kind, getItems, idField);
    } catch (error) {
      errors.push(`${SERVER_NAMES[name]}: ${error.message}`);
      return [];
    }
  }
  const [movies, shows] = await Promise.all([
    side('radarr', 'movie', getMovies, 'movieId'),
    side('sonarr', 'show', getSeries, 'seriesId'),
  ]);
  return { movies, shows, errors };
}
