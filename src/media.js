// Movies (Radarr) and shows (Sonarr): mapping API results to what the UI shows and sends.

export const KINDS = {
  movie: { server: 'radarr', lookupPath: '/api/v3/movie/lookup', addPath: '/api/v3/movie' },
  show: { server: 'sonarr', lookupPath: '/api/v3/series/lookup', addPath: '/api/v3/series' },
};

// TMDB serves several sizes; the original is megabytes, w342 is plenty for a TV card.
const TMDB_ORIGINAL = '/t/p/original/';
const TMDB_CARD_SIZE = '/t/p/w342/';

function posterUrl(images = []) {
  // Only remoteUrl is reachable without auth; `url` points at the *arr server.
  const poster = images.find((image) => image.coverType === 'poster' && image.remoteUrl);
  return poster ? poster.remoteUrl.replace(TMDB_ORIGINAL, TMDB_CARD_SIZE) : '';
}

export function toItem(kind, result) {
  return {
    kind,
    title: result.title,
    year: result.year || '',
    overview: result.overview || '',
    poster: posterUrl(result.images),
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

/** The add request is the lookup result plus our one-click defaults. */
export function buildRequestBody(kind, result, server) {
  const body = {
    ...result,
    qualityProfileId: server.qualityProfileId,
    rootFolderPath: server.rootFolderPath,
    monitored: true,
  };
  if (kind === 'show') {
    body.seasonFolder = true;
    body.addOptions = { monitor: 'all', searchForMissingEpisodes: true };
  } else {
    body.minimumAvailability = 'released';
    body.addOptions = { searchForMovie: true };
  }
  return body;
}
