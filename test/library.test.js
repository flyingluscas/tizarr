import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyConfig } from '../src/config.js';
import { t } from '../src/i18n.js';
import {
  loadLibrary,
  movieStatus,
  queueProgress,
  seriesStatus,
  sortByAdded,
  toLibraryItem,
} from '../src/data/library.js';

test('queueProgress sums records per id', () => {
  const progress = queueProgress(
    [
      { seriesId: 1, size: 100, sizeleft: 50 },
      { seriesId: 1, size: 100, sizeleft: 0 },
      { seriesId: 2, size: 0, sizeleft: 0 },
      { size: 10, sizeleft: 10 },
    ],
    'seriesId',
  );
  assert.equal(progress.get(1), 75);
  assert.equal(progress.get(2), 0);
  assert.equal(progress.size, 2);
});

test('movieStatus', () => {
  assert.equal(movieStatus({ hasFile: true }, 40), 'downloading');
  assert.equal(movieStatus({ hasFile: true }), 'downloaded');
  assert.equal(movieStatus({ hasFile: false, isAvailable: true }), 'missing');
  assert.equal(movieStatus({ hasFile: false, isAvailable: false }), 'upcoming');
});

test('seriesStatus', () => {
  const stats = (have, total) => ({ statistics: { episodeFileCount: have, episodeCount: total } });
  assert.equal(seriesStatus(stats(10, 10), 5), 'downloading');
  assert.equal(seriesStatus(stats(10, 10)), 'downloaded');
  assert.equal(seriesStatus(stats(3, 10)), 'missing');
  assert.equal(seriesStatus(stats(0, 0)), 'upcoming');
  assert.equal(seriesStatus({}), 'upcoming');
});

test('toLibraryItem adds status, progress and episodes, and drops raw', () => {
  const raw = {
    id: 4,
    title: 'Severance',
    year: 2022,
    added: '2026-10-01T00:00:00Z',
    statistics: { episodeFileCount: 3, episodeCount: 10 },
  };
  const item = toLibraryItem('show', raw, new Map([[4, 30]]));
  assert.equal(item.status, 'downloading');
  assert.equal(item.progress, 30);
  assert.deepEqual(item.episodes, { have: 3, total: 10 });
  assert.equal(item.inLibrary, true);
  assert.equal(item.raw, null);
});

test('sortByAdded puts the newest first', () => {
  const items = [{ added: '2026-01-01' }, { added: '2026-03-01' }, { added: '' }];
  assert.deepEqual(
    sortByAdded(items).map((i) => i.added),
    ['2026-03-01', '2026-01-01', ''],
  );
});

test('loadLibrary skips blank servers silently but reports half-configured ones', async () => {
  const config = emptyConfig();
  config.radarr = {
    url: 'http://radarr.lan',
    apiKey: 'k',
    qualityProfileId: 0,
    rootFolderPath: '',
  };
  const result = await loadLibrary(config);
  assert.deepEqual(result, {
    movies: [],
    shows: [],
    errors: [t('error.notConfigured', { server: 'Radarr' })],
  });
});
