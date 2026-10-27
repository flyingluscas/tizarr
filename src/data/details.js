// Pure helpers that turn a Radarr/Sonarr lookup result into what the Details page shows.

const MAX_GENRES = 3;

/** 155 → "2h 35m", 49 → "49m", 0/undefined → "". */
export function formatRuntime(minutes) {
  if (!minutes) return '';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

/** Real seasons (season 0 holds specials). */
export function seasonNumbers(result) {
  return (result.seasons || [])
    .map((season) => season.seasonNumber)
    .filter((number) => number > 0)
    .sort((a, b) => a - b);
}

/**
 * Facts line parts: year, runtime, age rating, genres, studio/network, and for shows the
 * status and season count. `t` translates the few words involved.
 */
export function factsOf(kind, result, t) {
  const parts = [
    result.year ? String(result.year) : '',
    formatRuntime(result.runtime),
    result.certification || '',
    (result.genres || []).slice(0, MAX_GENRES).join(', '),
    result.studio || result.network || '',
  ];
  if (kind === 'show') {
    if (result.status === 'continuing' || result.status === 'ended') {
      parts.push(t(`details.${result.status}`));
    }
    const count = seasonNumbers(result).length;
    if (count) parts.push(t(count === 1 ? 'details.oneSeason' : 'details.seasons', { count }));
  }
  return parts.filter(Boolean);
}

const RATING_SOURCES = [
  { key: 'imdb', label: 'IMDb', format: (value) => value.toFixed(1) },
  { key: 'rottenTomatoes', label: 'Rotten Tomatoes', format: (value) => `${Math.round(value)}%` },
  { key: 'metacritic', label: 'Metacritic', format: (value) => String(Math.round(value)) },
  { key: 'tmdb', label: 'TMDB', format: (value) => value.toFixed(1) },
];

/**
 * [{ label, text }] for every rating source present. Radarr knows IMDb, Rotten Tomatoes,
 * Metacritic and TMDB; Sonarr has a single unlabeled score (label null).
 */
export function ratingsBreakdown(result) {
  const ratings = result.ratings || {};
  const found = RATING_SOURCES.filter(
    (source) => ratings[source.key] && ratings[source.key].value > 0,
  ).map((source) => ({ label: source.label, text: source.format(ratings[source.key].value) }));
  if (!found.length && ratings.value > 0) {
    found.push({ label: null, text: ratings.value.toFixed(1) });
  }
  return found;
}

/** "S1 10/10", one per real season that has episodes, from GET /series/{id}. */
export function seasonProgress(series) {
  return (series.seasons || [])
    .filter((season) => season.seasonNumber > 0 && season.statistics)
    .filter((season) => season.statistics.episodeCount > 0)
    .map(
      (season) =>
        `S${season.seasonNumber} ${season.statistics.episodeFileCount || 0}/${season.statistics.episodeCount}`,
    );
}

/**
 * What a season choice sends to Sonarr: future episodes only, every season (the 'all'
 * preset), or the hand-picked seasons.
 */
export function seasonRequest(mode, picked, all) {
  if (mode === 'future') return { preset: 'future' };
  if (picked.length === all.length) return { preset: 'all' };
  return { picked: picked.slice().sort((a, b) => a - b) };
}
