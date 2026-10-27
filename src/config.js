// Server settings: shape, validation and persistence on the TV (localStorage).

const STORAGE_KEY = 'tizarr.config';

export const SERVER_NAMES = { sonarr: 'Sonarr', radarr: 'Radarr' };

export function emptyServer() {
  return { url: '', apiKey: '', qualityProfileId: 0, rootFolderPath: '' };
}

export function emptyConfig() {
  return { sonarr: emptyServer(), radarr: emptyServer() };
}

export function loadConfig(storage = localStorage) {
  try {
    const config = JSON.parse(storage.getItem(STORAGE_KEY));
    if (config && config.sonarr && config.radarr) return config;
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
