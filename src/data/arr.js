// Sonarr/Radarr v3 client. Errors are rejected with a translated, user-facing message.
import { t } from '../i18n.js';
import { requestJson } from './http.js';
import { KINDS } from './media.js';

export function errorMessage(status, data) {
  if (status === 0) return t('error.unreachable');
  if (status === 401) return t('error.badKey');
  if (Array.isArray(data) && data.length && data[0].errorMessage) return data[0].errorMessage;
  if (data && data.message) return data.message;
  return `HTTP ${status}`;
}

export function request(server, method, path, body) {
  return requestJson(method, server.url + path, {
    headers: { 'X-Api-Key': server.apiKey },
    body,
  }).catch((error) => {
    throw new Error(errorMessage(error.status, error.data));
  });
}

/** Verifies the server and returns the options for the request defaults. */
export async function testConnection(server) {
  await request(server, 'GET', '/api/v3/system/status');
  const [profiles, folders] = await Promise.all([
    request(server, 'GET', '/api/v3/qualityprofile'),
    request(server, 'GET', '/api/v3/rootfolder'),
  ]);
  return { profiles, folders };
}

export function lookup(server, kind, term) {
  return request(server, 'GET', `${KINDS[kind].lookupPath}?term=${encodeURIComponent(term)}`);
}

export function add(server, kind, body) {
  return request(server, 'POST', KINDS[kind].addPath, body);
}

/** One series with per-season download statistics (lookups don't include them). */
export function getSeriesById(server, id) {
  return request(server, 'GET', `/api/v3/series/${id}`);
}

export function getMovies(server) {
  return request(server, 'GET', '/api/v3/movie');
}

export function getSeries(server) {
  return request(server, 'GET', '/api/v3/series');
}

/** Radarr's suggestions based on the user's library (its Discover page). */
export function getRecommendations(server) {
  return request(server, 'GET', '/api/v3/importlist/movie?includeRecommendations=true');
}

// The queue is paged; one large page covers any home setup.
const QUEUE_PAGE_SIZE = 200;

export async function getQueue(server) {
  const page = await request(server, 'GET', `/api/v3/queue?pageSize=${QUEUE_PAGE_SIZE}`);
  return page.records || [];
}
