import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCache } from '../src/data/cache.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    key: (i) => Array.from(data.keys())[i],
    get length() {
      return data.size;
    },
  };
}

function setup() {
  const clock = { time: 1000 };
  const storage = memoryStorage();
  const cache = createCache({ storage, now: () => clock.time });
  return { clock, storage, cache };
}

test('get reports freshness by TTL', () => {
  const { clock, cache } = setup();
  cache.set('a', 1, 100);
  assert.deepEqual(cache.get('a'), { value: 1, fresh: true });
  clock.time += 100;
  assert.deepEqual(cache.get('a'), { value: 1, fresh: false });
  assert.equal(cache.get('missing'), null);
});

test('values survive a new cache instance (localStorage)', () => {
  const { storage, cache } = setup();
  cache.set('a', { x: 1 }, 100);
  const again = createCache({ storage, now: () => 1000 });
  assert.deepEqual(again.get('a'), { value: { x: 1 }, fresh: true });
});

test('load shows cached data first and skips the network when fresh', async () => {
  const { cache } = setup();
  cache.set('a', 'cached', 100);
  const seen = [];
  await cache.load(
    'a',
    100,
    () => assert.fail('should not load'),
    (v) => seen.push(v),
  );
  assert.deepEqual(seen, ['cached']);
});

test('load refreshes stale data after showing it', async () => {
  const { clock, cache } = setup();
  cache.set('a', 'old', 100);
  clock.time += 200;
  const seen = [];
  await cache.load(
    'a',
    100,
    async () => 'new',
    (v) => seen.push(v),
  );
  assert.deepEqual(seen, ['old', 'new']);
  assert.deepEqual(cache.get('a'), { value: 'new', fresh: true });
});

test('load keeps stale data on refresh errors and rejects when nothing is cached', async () => {
  const { clock, cache } = setup();
  const fail = async () => {
    throw new Error('down');
  };
  await assert.rejects(
    cache.load('none', 100, fail, () => {}),
    { message: 'down' },
  );
  cache.set('a', 'old', 100);
  clock.time += 200;
  const seen = [];
  await cache.load('a', 100, fail, (v) => seen.push(v));
  assert.deepEqual(seen, ['old']);
});

test('invalidate drops one entry from memory and storage', () => {
  const { storage, cache } = setup();
  cache.set('a', 1, 100);
  cache.set('b', 2, 100);
  cache.invalidate('a');
  assert.equal(cache.get('a'), null);
  assert.equal(createCache({ storage, now: () => 1000 }).get('a'), null);
  assert.deepEqual(cache.get('b'), { value: 2, fresh: true });
});

test('clear removes only cache entries', () => {
  const { storage, cache } = setup();
  storage.setItem('tizarr.config', '{}');
  cache.set('a', 1, 100);
  cache.clear();
  assert.equal(cache.get('a'), null);
  assert.equal(storage.getItem('tizarr.config'), '{}');
});

test('entries saved by an older cache version are dropped on start', () => {
  const { storage } = setup();
  storage.setItem('tizarr.cache.library', '{"value":1,"expires":9999}');
  storage.setItem('tizarr.config', '{}');
  const cache = createCache({ storage, now: () => 1000 });
  assert.equal(storage.getItem('tizarr.cache.library'), null);
  assert.equal(storage.getItem('tizarr.config'), '{}');
  cache.set('a', 1, 100);
  assert.deepEqual(createCache({ storage, now: () => 1000 }).get('a'), { value: 1, fresh: true });
});
