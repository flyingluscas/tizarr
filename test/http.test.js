import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { requestJson } from '../src/data/http.js';

/** Minimal XMLHttpRequest stand-in that answers with the given outcome. */
export function fakeXhr(outcome) {
  const Fake = class {
    headers = {};
    open(method, url) {
      Object.assign(this, { method, url });
    }
    setRequestHeader(name, value) {
      this.headers[name] = value;
    }
    send(body) {
      Fake.last = { ...this, body };
      if (outcome === 'error' || outcome === 'timeout') return this[`on${outcome}`]();
      Object.assign(this, outcome);
      this.onload();
    }
  };
  return Fake;
}

afterEach(() => {
  delete globalThis.XMLHttpRequest;
});

test('requestJson sends headers and a JSON body', async () => {
  const Fake = (globalThis.XMLHttpRequest = fakeXhr({ status: 201, responseText: '{"id":7}' }));
  const data = await requestJson('POST', 'http://x/y', { headers: { A: '1' }, body: { b: 2 } });
  assert.deepEqual(data, { id: 7 });
  assert.equal(Fake.last.url, 'http://x/y');
  assert.equal(Fake.last.headers.A, '1');
  assert.equal(Fake.last.headers['Content-Type'], 'application/json');
  assert.equal(Fake.last.body, '{"b":2}');
});

test('requestJson rejects with status and parsed body', async () => {
  globalThis.XMLHttpRequest = fakeXhr({ status: 400, responseText: '{"message":"no"}' });
  await assert.rejects(requestJson('GET', 'http://x'), { status: 400, data: { message: 'no' } });
});

test('requestJson reports network failures and timeouts as status 0', async () => {
  for (const outcome of ['error', 'timeout']) {
    globalThis.XMLHttpRequest = fakeXhr(outcome);
    await assert.rejects(requestJson('GET', 'http://x'), { status: 0 });
  }
});
