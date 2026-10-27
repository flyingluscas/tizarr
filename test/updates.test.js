import assert from 'node:assert/strict';
import { test } from 'node:test';
import { interpretMessage, isNewer, parseVersion } from '../src/data/updates.js';

test('parseVersion accepts tags and plain versions', () => {
  assert.deepEqual(parseVersion('v0.4.2'), [0, 4, 2]);
  assert.deepEqual(parseVersion('1.10.0'), [1, 10, 0]);
  assert.deepEqual(parseVersion(null), [0]);
});

test('isNewer compares numerically', () => {
  assert.equal(isNewer('0.4.10', '0.4.9'), true);
  assert.equal(isNewer('v1.0.0', '0.9.9'), true);
  assert.equal(isNewer('0.4.2', '0.4.2'), false);
  assert.equal(isNewer('0.4.1', '0.4.2'), false);
});

test('interpretMessage maps installer service messages', () => {
  assert.deepEqual(interpretMessage({ type: 4, payload: 'installStatus.fetching' }), {
    kind: 'status',
    text: 'installStatus.fetching',
  });
  assert.deepEqual(interpretMessage({ type: 3, payload: 'boom' }), { kind: 'error', text: 'boom' });
  assert.deepEqual(
    interpretMessage({ type: 1, payload: { response: 0, result: 'ok\nspend time' } }),
    {
      kind: 'done',
      text: '',
    },
  );
  const failed = 'app_id[Tizarr0001] install failed[118, -12], reason: Check certificate error';
  assert.deepEqual(
    interpretMessage({ type: 1, payload: { response: 0, result: `x\n${failed}\n` } }),
    {
      kind: 'error',
      text: failed,
    },
  );
  assert.equal(interpretMessage({ type: 2, payload: [] }), null);
});
