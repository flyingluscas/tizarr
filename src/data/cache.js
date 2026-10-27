// Memory + localStorage cache with expiry, so screens can draw saved data instantly and
// refresh it in the background (stale-while-revalidate).

// Bump when the shape of cached data changes (e.g. items gain a field), so values saved by
// an older version are dropped instead of being shown without the new field.
const CACHE_VERSION = 5;
const BASE = 'tizarr.cache.';
const PREFIX = `${BASE}v${CACHE_VERSION}.`;

function storageKeys(storage) {
  const keys = [];
  for (let i = 0; i < storage.length; i++) keys.push(storage.key(i));
  return keys.filter(Boolean);
}

export function createCache({ storage = localStorage, now = Date.now } = {}) {
  const memory = new Map();
  for (const key of storageKeys(storage)) {
    if (key.indexOf(BASE) === 0 && key.indexOf(PREFIX) !== 0) storage.removeItem(key);
  }

  function read(key) {
    if (memory.has(key)) return memory.get(key);
    try {
      const entry = JSON.parse(storage.getItem(PREFIX + key));
      if (entry) memory.set(key, entry);
      return entry;
    } catch {
      return null;
    }
  }

  /** { value, fresh } or null when nothing is cached. */
  function get(key) {
    const entry = read(key);
    return entry ? { value: entry.value, fresh: now() < entry.expires } : null;
  }

  function set(key, value, ttlMs) {
    const entry = { value, expires: now() + ttlMs };
    memory.set(key, entry);
    try {
      storage.setItem(PREFIX + key, JSON.stringify(entry));
    } catch {
      // Storage full: keep the memory copy only.
    }
  }

  /**
   * Calls onValue with the cached value right away (if any), then again with fresh data when
   * the cached value is missing or expired. Rejects only when nothing could be shown.
   */
  async function load(key, ttlMs, loader, onValue) {
    const cached = get(key);
    if (cached) onValue(cached.value);
    if (cached && cached.fresh) return;
    try {
      const value = await loader();
      set(key, value, ttlMs);
      onValue(value);
    } catch (error) {
      if (!cached) throw error;
    }
  }

  function invalidate(key) {
    memory.delete(key);
    storage.removeItem(PREFIX + key);
  }

  function clear() {
    memory.clear();
    for (const key of storageKeys(storage)) if (key.indexOf(PREFIX) === 0) storage.removeItem(key);
  }

  return { get, set, load, invalidate, clear };
}
