import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { LANGUAGES, setLanguage, t } from '../src/i18n.js';
import en from '../src/strings/en.js';

afterEach(() => setLanguage('en'));

test('t interpolates variables and keeps unknown placeholders', () => {
  assert.equal(t('library.episodes', { have: 3, total: 10 }), '3/10 episodes');
  assert.equal(t('library.episodes', { have: 3 }), '3/{total} episodes');
});

test('t switches language and falls back to English, then to the key', () => {
  setLanguage('pt-BR');
  assert.equal(t('nav.library'), 'Biblioteca');
  setLanguage('xx');
  assert.equal(t('nav.library'), 'Library');
  assert.equal(t('no.such.key'), 'no.such.key');
});

test('every language defines every English key', () => {
  for (const [code, { strings }] of Object.entries(LANGUAGES)) {
    const missing = Object.keys(en).filter((key) => !(key in strings));
    assert.deepEqual(missing, [], `${code} is missing keys`);
  }
});
