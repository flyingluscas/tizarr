import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { emptyConfig } from '../src/config.js';
import {
  cancelAndDelete,
  formatSize,
  formatTimeLeft,
  groupQueue,
  toUpcoming,
  tryAnotherRelease,
} from '../src/data/downloads.js';

test('formatSize', () => {
  assert.equal(formatSize(1288490188), '1.2 GB');
  assert.equal(formatSize(524288000), '500 MB');
  assert.equal(formatSize(1000), '1 MB');
  assert.equal(formatSize(0), '');
});

test('formatTimeLeft', () => {
  assert.equal(formatTimeLeft('1.02:03:04'), '1d 2h');
  assert.equal(formatTimeLeft('02:03:04'), '2h 3m');
  assert.equal(formatTimeLeft('00:12:30'), '12m');
  assert.equal(formatTimeLeft('00:00:30'), '<1m');
  assert.equal(formatTimeLeft(null), '');
});

test("groupQueue merges a show's episodes into one entry", () => {
  const series = { title: 'Lupin', year: 2021, images: [] };
  const records = [
    { id: 1, seriesId: 26, status: 'queued', size: 100, sizeleft: 100, series, episode: {} },
    {
      id: 2,
      seriesId: 26,
      status: 'downloading',
      size: 100,
      sizeleft: 50,
      timeleft: '00:10:00',
      series,
      episode: {},
    },
    { id: 3, seriesId: 26, status: 'queued', size: 0, sizeleft: 0, series, episode: {} },
  ];
  const [group] = groupQueue('show', records);
  assert.equal(group.title, 'Lupin');
  assert.equal(group.status, 'downloading');
  assert.equal(group.progress, 25);
  assert.equal(group.episodes, 3);
  assert.equal(group.timeLeft, '00:10:00');
  assert.deepEqual(group.queueIds, [1, 2, 3]);
});

test('groupQueue flags warnings and ignores records without a title', () => {
  const records = [
    {
      id: 1,
      movieId: 5,
      status: 'downloading',
      trackedDownloadStatus: 'warning',
      movie: { title: 'X' },
    },
    { id: 2, status: 'queued' },
  ];
  const groups = groupQueue('movie', records);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].status, 'warning');
  assert.equal(groups[0].progress, 0);
});

test('toUpcoming sorts by air date and formats episode codes', () => {
  const upcoming = toUpcoming([
    {
      series: { title: 'B' },
      seasonNumber: 1,
      episodeNumber: 3,
      airDateUtc: '2026-11-02T00:00:00Z',
    },
    {
      series: { title: 'A' },
      seasonNumber: 2,
      episodeNumber: 10,
      title: 'Ten',
      airDateUtc: '2026-11-01T00:00:00Z',
    },
    { series: { title: 'C' }, seasonNumber: 1, episodeNumber: 1 },
  ]);
  assert.deepEqual(
    upcoming.map((episode) => `${episode.series} ${episode.code}`),
    ['A S2E10', 'B S1E03'],
  );
});

/** Records every request; answers the queue GET with the given records. */
function fakeServer(queue, calls) {
  return class {
    open(method, url) {
      Object.assign(this, { method, url });
    }
    setRequestHeader() {}
    send(body) {
      calls.push(
        `${this.method} ${this.url.replace('http://sonarr.example', '')}${body ? ` ${body}` : ''}`,
      );
      this.status = 200;
      this.responseText = this.method === 'GET' ? JSON.stringify({ records: queue }) : '';
      this.onload();
    }
  };
}

afterEach(() => {
  delete globalThis.XMLHttpRequest;
});

const config = () => ({
  ...emptyConfig(),
  sonarr: {
    url: 'http://sonarr.example',
    apiKey: 'test-key',
    qualityProfileId: 1,
    rootFolderPath: '/tv',
  },
});
const queue = [
  { id: 7, seriesId: 26 },
  { id: 8, seriesId: 26 },
  { id: 9, seriesId: 99 },
];

test("tryAnotherRelease blocklists only that title's downloads", async () => {
  const calls = [];
  globalThis.XMLHttpRequest = fakeServer(queue, calls);
  assert.equal(await tryAnotherRelease(config(), 'show', 26), 2);
  assert.equal(
    calls[1],
    'DELETE /api/v3/queue/bulk?removeFromClient=true&blocklist=true&skipRedownload=false {"ids":[7,8]}',
  );
});

test('cancelAndDelete removes downloads without blocklisting, then the title with files', async () => {
  const calls = [];
  globalThis.XMLHttpRequest = fakeServer(queue, calls);
  await cancelAndDelete(config(), 'show', 26);
  assert.deepEqual(calls.slice(1), [
    'DELETE /api/v3/queue/bulk?removeFromClient=true&blocklist=false&skipRedownload=false {"ids":[7,8]}',
    'DELETE /api/v3/series/26?deleteFiles=true&addImportListExclusion=false',
  ]);
});
