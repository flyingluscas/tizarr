// Trailer lookup: Radarr's YouTube id for movies, else TMDB's videos (shows, or movies without
// one). Only validated YouTube ids are ever put into the player URL.
import { tmdbVideos } from './tmdb.js';

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function isYouTubeId(id) {
  return typeof id === 'string' && YOUTUBE_ID.test(id);
}

/** Best YouTube trailer among TMDB videos: official trailer, then any trailer, then teaser. */
export function pickTrailer(videos) {
  const youtube = (videos || []).filter(
    (video) => video.site === 'YouTube' && isYouTubeId(video.key),
  );
  const ranked = [
    youtube.find((video) => video.type === 'Trailer' && video.official),
    youtube.find((video) => video.type === 'Trailer'),
    youtube.find((video) => video.type === 'Teaser'),
  ];
  const best = ranked.find(Boolean);
  return best ? best.key : null;
}

export async function findTrailer(item, raw, app) {
  if (raw && isYouTubeId(raw.youTubeTrailerId)) return raw.youTubeTrailerId;
  const tmdbId = item.tmdbId || (raw && raw.tmdbId);
  if (!app.tmdbKey || !tmdbId) return null;
  return pickTrailer(await tmdbVideos(app, item.kind, tmdbId));
}

// YouTube refuses embeds without a Referer (error 153), and the TV app runs from local files,
// which never send one. This page (gh-pages branch, served by GitHub Pages on the owner's
// domain) embeds the youtube-nocookie player from a real https origin.
const PLAYER_PAGE = 'https://flyzin.dev/tizarr/player.html';

/** Player page URL for a trailer; empty for anything that isn't a YouTube id. */
export function embedUrl(id) {
  return isYouTubeId(id) ? `${PLAYER_PAGE}?v=${id}` : '';
}
