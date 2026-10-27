import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { errorMessage, request } from '../src/api.js';
import { STRINGS } from '../src/strings.js';

const server = { url: 'http://sonarr.lan', apiKey: 'secret' };

/** Minimal XMLHttpRequest stand-in that answers with the given outcome. */
function fakeXhr(outcome) {
  return class {
    headers = {};
    open(method, url) {
      Object.assign(this, { method, url });
    }
    setRequestHeader(name, value) {
      this.headers[name] = value;
    }
    send(body) {
      fakeXhr.last = { ...this, body };
      if (outcome === 'error' || outcome === 'timeout') return this[`on${outcome}`]();
      Object.assign(this, outcome);
      this.onload();
    }
  };
}

afterEach(() => {
  delete globalThis.XMLHttpRequest;
});

test('errorMessage prefers the server message', () => {
  assert.equal(errorMessage(400, [{ errorMessage: 'Already added' }]), 'Already added');
  assert.equal(errorMessage(500, { message: 'boom' }), 'boom');
  assert.equal(errorMessage(502, null), 'HTTP 502');
});

test('request sends the API key and JSON body', async () => {
  globalThis.XMLHttpRequest = fakeXhr({ status: 201, responseText: '{"id":7}' });
  const data = await request(server, 'POST', '/api/v3/series', { title: 'S' });
  assert.deepEqual(data, { id: 7 });
  assert.equal(fakeXhr.last.url, 'http://sonarr.lan/api/v3/series');
  assert.equal(fakeXhr.last.headers['X-Api-Key'], 'secret');
  assert.equal(fakeXhr.last.body, '{"title":"S"}');
});

test('request maps 401 to an invalid key message', async () => {
  globalThis.XMLHttpRequest = fakeXhr({ status: 401, responseText: '' });
  await assert.rejects(request(server, 'GET', '/x'), { message: STRINGS.badKey });
});

test('request reports server errors', async () => {
  globalThis.XMLHttpRequest = fakeXhr({ status: 400, responseText: '[{"errorMessage":"Nope"}]' });
  await assert.rejects(request(server, 'GET', '/x'), { message: 'Nope' });
});

test('request reports network failures and timeouts as unreachable', async () => {
  for (const outcome of ['error', 'timeout']) {
    globalThis.XMLHttpRequest = fakeXhr(outcome);
    await assert.rejects(request(server, 'GET', '/x'), { message: STRINGS.unreachable });
  }
});
