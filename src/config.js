// App and server settings: shape, validation and persistence on the TV (localStorage).

const STORAGE_KEY = 'tizarr.config';

export const SERVER_NAMES = { sonarr: 'Sonarr', radarr: 'Radarr' };

export function emptyServer() {
  return { url: '', apiKey: '', qualityProfileId: 0, rootFolderPath: '' };
}

// Regions offered for TMDB trending/popular lists. Labels live in strings (region.XX).
export const REGIONS = ['BR', 'US', 'PT', 'GB', 'CA', 'ES'];

export function emptyApp() {
  return { language: 'en', region: 'BR', tmdbKey: '' };
}

export function emptyConfig() {
  return { app: emptyApp(), sonarr: emptyServer(), radarr: emptyServer() };
}

/** Fills in defaults so configs saved by older versions keep working. */
function withDefaults(config) {
  const defaults = emptyConfig();
  return {
    app: { ...defaults.app, ...config.app },
    sonarr: { ...defaults.sonarr, ...config.sonarr },
    radarr: { ...defaults.radarr, ...config.radarr },
  };
}

export function loadConfig(storage = localStorage) {
  try {
    const config = JSON.parse(storage.getItem(STORAGE_KEY));
    if (config && typeof config === 'object') return withDefaults(config);
  } catch {
    // Corrupt or missing value: start from scratch.
  }
  return emptyConfig();
}

export function saveConfig(config, storage = localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/** A server is usable once it has a URL, a key and both request defaults. */
export function serverReady(server) {
  return Boolean(
    server && server.url && server.apiKey && server.qualityProfileId && server.rootFolderPath,
  );
}

export function isConfigValid(config) {
  return Boolean(config) && (serverReady(config.sonarr) || serverReady(config.radarr));
}

/** Accepts what people type on a remote: "sonarr.lan/" → "http://sonarr.lan". */
export function normalizeUrl(url) {
  const trimmed = (url || '').trim().replace(/\/+$/, '');
  if (trimmed && !/^https?:\/\//i.test(trimmed)) return `http://${trimmed}`;
  return trimmed;
}
