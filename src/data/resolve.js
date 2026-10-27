// Turns a title from a discovery row (TMDB or Radarr recommendations) into the Radarr/Sonarr
// lookup result needed to request it.
import { t } from '../i18n.js';
import { lookup } from './arr.js';
import { KINDS } from './media.js';
import { tvdbIdFor } from './tmdb.js';

export async function resolveForRequest(item, config) {
  if (item.raw) return item.raw;
  const server = config[KINDS[item.kind].server];
  let term = `tmdb:${item.tmdbId}`;
  if (item.kind === 'show') {
    // Sonarr looks shows up by TVDB id, which TMDB knows.
    const tvdbId = config.app.tmdbKey ? await tvdbIdFor(config.app.tmdbKey, item.tmdbId) : null;
    if (!tvdbId) throw new Error(t('error.notFound'));
    term = `tvdb:${tvdbId}`;
  }
  const results = await lookup(server, item.kind, term);
  if (!results || !results.length) throw new Error(t('error.notFound'));
  return results[0];
}
