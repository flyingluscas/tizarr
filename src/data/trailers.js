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

/**
 * Privacy-friendlier embed (no cookies until playback). Controls are hidden: the remote stays
 * with Tizarr, and Back closes the player.
 */
export function embedUrl(id) {
  if (!isYouTubeId(id)) return '';
  return (
    `https://www.youtube-nocookie.com/embed/${id}` +
    '?autoplay=1&controls=0&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&fs=0'
  );
}
