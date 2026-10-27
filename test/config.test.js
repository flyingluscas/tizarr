import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  emptyApp,
  emptyConfig,
  emptyServer,
  isConfigValid,
  loadConfig,
  normalizeUrl,
  saveConfig,
  serverReady,
} from '../src/config.js';

const ready = { url: 'http://r', apiKey: 'k', qualityProfileId: 4, rootFolderPath: '/m' };

function memoryStorage() {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
}

test('serverReady needs url, key and both defaults', () => {
  assert.equal(serverReady(ready), true);
  assert.equal(serverReady({ ...ready, qualityProfileId: 0 }), false);
  assert.equal(serverReady({ ...ready, rootFolderPath: '' }), false);
  assert.equal(serverReady(undefined), false);
});

test('isConfigValid needs at least one ready server', () => {
  assert.equal(isConfigValid(emptyConfig()), false);
  assert.equal(isConfigValid({ sonarr: emptyServer(), radarr: ready }), true);
  assert.equal(isConfigValid(null), false);
});

test('normalizeUrl fixes what people type on a remote', () => {
  assert.equal(normalizeUrl(' sonarr.lan/ '), 'http://sonarr.lan');
  assert.equal(normalizeUrl('https://x.y:8989//'), 'https://x.y:8989');
  assert.equal(normalizeUrl(''), '');
});

test('loadConfig round-trips and recovers from bad data', () => {
  const storage = memoryStorage();
  assert.deepEqual(loadConfig(storage), emptyConfig());
  const config = { app: emptyApp(), sonarr: ready, radarr: emptyServer() };
  saveConfig(config, storage);
  assert.deepEqual(loadConfig(storage), config);
  storage.setItem('tizarr.config', '{not json');
  assert.deepEqual(loadConfig(storage), emptyConfig());
});

test('loadConfig fills in defaults for configs saved by older versions', () => {
  const storage = memoryStorage();
  storage.setItem('tizarr.config', JSON.stringify({ sonarr: ready, radarr: emptyServer() }));
  assert.deepEqual(loadConfig(storage), { app: emptyApp(), sonarr: ready, radarr: emptyServer() });
});
