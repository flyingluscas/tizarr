// Movies (Radarr) and shows (Sonarr): mapping API results to what the UI shows and sends.

export const KINDS = {
  movie: { server: 'radarr', lookupPath: '/api/v3/movie/lookup', addPath: '/api/v3/movie' },
  show: { server: 'sonarr', lookupPath: '/api/v3/series/lookup', addPath: '/api/v3/series' },
};

// TMDB serves several sizes; the original is megabytes, w342 is plenty for a TV card.
const TMDB_ORIGINAL = '/t/p/original/';
const TMDB_CARD_SIZE = '/t/p/w342/';

/** Only https image URLs may reach an <img> (see AGENTS.md security rules). */
export function httpsOnly(url) {
  return typeof url === 'string' && url.indexOf('https://') === 0 ? url : '';
}

// Backdrops fill a 1920 px screen behind dimmed text; 1280 px is sharp enough and much lighter.
const BACKDROP_SIZE = 'w1280';

/** Fanart from a Radarr/Sonarr result, sized for the Details backdrop. */
export function backdropOf(result) {
  const fanart = (result.images || []).find((image) => image.coverType === 'fanart');
  const url = httpsOnly(fanart && fanart.remoteUrl);
  return url && resizeTmdb(url, BACKDROP_SIZE);
}

export function posterUrl(images = []) {
  // Only remoteUrl is reachable without auth; `url` points at the *arr server.
  const poster = images.find((image) => image.coverType === 'poster' && image.remoteUrl);
  return poster ? httpsOnly(poster.remoteUrl.replace(TMDB_ORIGINAL, TMDB_CARD_SIZE)) : '';
}

/** Swaps the size segment of a TMDB image URL ("…/t/p/w185/x.jpg" → "…/t/p/w342/x.jpg"). */
export function resizeTmdb(url, size) {
  return url.replace(/\/t\/p\/\w+\//, `/t/p/${size}/`);
}

const roundRating = (value) => Math.round(value * 10) / 10;

/**
 * One 0–10 score for a Radarr/Sonarr result: IMDb when Radarr has it, else TMDB (Radarr) or
 * Sonarr's own score. Null when nobody has rated it yet.
 */
export function ratingOf(result) {
  const ratings = result.ratings || {};
  const score = [
    ratings.imdb && ratings.imdb.value,
    ratings.tmdb && ratings.tmdb.value,
    ratings.value,
  ].find((value) => typeof value === 'number' && value > 0);
  return score ? roundRating(score) : null;
}

export function toItem(kind, result) {
  return {
    kind,
    tmdbId: result.tmdbId || null,
    tvdbId: result.tvdbId || null,
    title: result.title,
    year: result.year || '',
    overview: result.overview || '',
    poster: posterUrl(result.images),
    rating: ratingOf(result),
    inLibrary: (result.id || 0) > 0,
    raw: result,
  };
}

/** Alternates two ranked lists so neither server's best matches get buried. */
export function interleave(a, b) {
  const out = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

/**
 * The add request is the lookup result plus our defaults. For shows, `seasons` is either
 * { preset } (Sonarr MonitorTypes: 'all', 'lastSeason', 'future') or { picked: [seasonNumbers] }; picked seasons use
 * Sonarr's 'skip' mode, which keeps exactly the season flags we send.
 */
export function buildRequestBody(kind, result, server, seasons = { preset: 'all' }) {
  const body = {
    ...result,
    qualityProfileId: server.qualityProfileId,
    rootFolderPath: server.rootFolderPath,
    monitored: true,
  };
  if (kind === 'show') {
    body.seasonFolder = true;
    if (seasons.picked) {
      body.seasons = (result.seasons || []).map((season) => ({
        ...season,
        monitored: seasons.picked.includes(season.seasonNumber),
      }));
      body.addOptions = { monitor: 'skip', searchForMissingEpisodes: true };
    } else {
      body.addOptions = { monitor: seasons.preset, searchForMissingEpisodes: true };
    }
  } else {
    body.minimumAvailability = 'released';
    body.addOptions = { searchForMovie: true };
  }
  return body;
}
