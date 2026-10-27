// Sonarr/Radarr v3 HTTP client. XHR instead of fetch: Chromium 63 has no AbortController,
// and XHR gives us a timeout for free.
import { KINDS } from './media.js';
import { STRINGS } from './strings.js';

const TIMEOUT_MS = 15000;

export function errorMessage(status, data) {
  if (Array.isArray(data) && data.length && data[0].errorMessage) return data[0].errorMessage;
  if (data && data.message) return data.message;
  return `HTTP ${status}`;
}

export function request(server, method, path, body) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, server.url + path);
    xhr.timeout = TIMEOUT_MS;
    xhr.setRequestHeader('X-Api-Key', server.apiKey);
    if (body) xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // Non-JSON body (e.g. an HTML error page).
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(xhr.status === 401 ? STRINGS.badKey : errorMessage(xhr.status, data)));
    };
    xhr.onerror = xhr.ontimeout = () => reject(new Error(STRINGS.unreachable));
    xhr.send(body ? JSON.stringify(body) : null);
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
