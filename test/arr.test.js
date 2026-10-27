import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { errorMessage, request } from '../src/data/arr.js';
import { t } from '../src/i18n.js';
import { fakeXhr } from './http.test.js';

const server = { url: 'http://sonarr.lan', apiKey: 'secret' };

afterEach(() => {
  delete globalThis.XMLHttpRequest;
});

test('errorMessage maps statuses and prefers the server message', () => {
  assert.equal(errorMessage(0, null), t('error.unreachable'));
  assert.equal(errorMessage(401, null), t('error.badKey'));
  assert.equal(errorMessage(400, [{ errorMessage: 'Already added' }]), 'Already added');
  assert.equal(errorMessage(500, { message: 'boom' }), 'boom');
  assert.equal(errorMessage(502, null), 'HTTP 502');
});

test('request sends the API key to the server URL', async () => {
  const Fake = (globalThis.XMLHttpRequest = fakeXhr({ status: 200, responseText: '[]' }));
  await request(server, 'GET', '/api/v3/series');
  assert.equal(Fake.last.url, 'http://sonarr.lan/api/v3/series');
  assert.equal(Fake.last.headers['X-Api-Key'], 'secret');
});

test('request rejects with a user-facing message', async () => {
  globalThis.XMLHttpRequest = fakeXhr({ status: 400, responseText: '[{"errorMessage":"Nope"}]' });
  await assert.rejects(request(server, 'GET', '/x'), { message: 'Nope' });
});
