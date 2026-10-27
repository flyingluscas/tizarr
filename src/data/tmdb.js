// TMDB v3 client (optional; enabled when the user enters an API key).
import { requestJson } from './http.js';

const BASE_URL = 'https://api.themoviedb.org/3';

function get(key, path, params = {}) {
  const query = Object.keys(params)
    .map((name) => `&${name}=${encodeURIComponent(params[name])}`)
    .join('');
  return requestJson('GET', `${BASE_URL}${path}?api_key=${encodeURIComponent(key)}${query}`);
}

/** Resolves when the key works; rejects with `status` 401 when it does not. */
export function testKey(key) {
  return get(key, '/configuration');
}
