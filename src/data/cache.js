// Memory + localStorage cache with expiry, so screens can draw saved data instantly and
// refresh it in the background (stale-while-revalidate).

const PREFIX = 'tizarr.cache.';

export function createCache({ storage = localStorage, now = Date.now } = {}) {
  const memory = new Map();

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

  function clear() {
    memory.clear();
    const keys = [];
    for (let i = 0; i < storage.length; i++) keys.push(storage.key(i));
    for (const key of keys) if (key && key.indexOf(PREFIX) === 0) storage.removeItem(key);
  }

  return { get, set, load, clear };
}
