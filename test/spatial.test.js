import assert from 'node:assert/strict';
import { test } from 'node:test';
import { moveScore, pickNext } from '../src/spatial.js';

const rect = (left, top, width, height) => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
});

test('moveScore ignores targets that are not in the pressed direction', () => {
  const from = rect(100, 100, 100, 50);
  assert.equal(moveScore('down', from, rect(100, 0, 100, 50)), null);
  assert.equal(moveScore('right', from, rect(0, 100, 50, 50)), null);
});

test('a wide field directly below beats a narrow button closer to the center', () => {
  // Settings: a chip on the right, then a row with a wide TMDB field and a Test button.
  const chip = rect(1400, 300, 150, 60);
  const field = rect(412, 420, 1190, 70);
  const button = rect(1620, 420, 170, 70);
  assert.equal(pickNext('down', chip, [button, field]), 1);
});

test('aligned targets win over diagonal ones', () => {
  const from = rect(0, 0, 100, 100);
  const below = rect(0, 200, 100, 100);
  const diagonal = rect(150, 120, 100, 100);
  assert.equal(pickNext('down', from, [diagonal, below]), 1);
});

test('pickNext returns -1 when nothing is in that direction', () => {
  assert.equal(pickNext('up', rect(0, 0, 10, 10), [rect(0, 50, 10, 10)]), -1);
});
