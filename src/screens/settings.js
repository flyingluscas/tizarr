// Settings screen: language/region/TMDB key, and per server URL + API key, connection test
// and request defaults. Edits go to a draft that only replaces the config on Save.
import {
  REGIONS,
  SERVER_NAMES,
  emptyConfig,
  isConfigValid,
  normalizeUrl,
  saveConfig,
} from '../config.js';
import { testConnection } from '../data/arr.js';
import { testKey } from '../data/tmdb.js';
import { $, $$, el, setStatus } from '../dom.js';
import { LANGUAGES, setLanguage, t, translatePage } from '../i18n.js';
import { openScreen, registerScreen } from '../router.js';
import { state } from '../state.js';
import { resetLibrary } from './library.js';
import { checkForUpdates, installUpdate, renderUpdates } from './settings-updates.js';

let draft = null;

// Fields stored as numbers; everything else is a string.
const NUMBER_FIELDS = ['qualityProfileId'];

const group = (name) => $(`.settings-group[data-group="${name}"]`);
const groupOf = (node) => node.closest('.settings-group').dataset.group;
const input = (name, field) => $(`[data-field="${field}"]`, group(name));

function readForm() {
  draft.app.tmdbKey = input('app', 'tmdbKey').value.trim();
  for (const name of Object.keys(SERVER_NAMES)) {
    draft[name].url = normalizeUrl(input(name, 'url').value);
    draft[name].apiKey = input(name, 'apiKey').value.trim();
  }
}

/** Renders selectable options; keeps the saved choice if still offered, else picks the first. */
function renderChips(name, field, options) {
  const values = draft[name];
  if (!options.some((option) => option.value === values[field])) {
    values[field] = options.length ? options[0].value : emptyConfig()[name][field];
  }
  const fragment = document.createDocumentFragment();
  for (const option of options) {
    const chip = el('button', 'chip', option.label);
    chip.classList.toggle('selected', option.value === values[field]);
    chip.dataset.nav = '';
    chip.dataset.action = 'chip';
    chip.dataset.value = String(option.value);
    fragment.appendChild(chip);
  }
  const box = $(`.chips[data-field="${field}"]`, group(name));
  box.textContent = '';
  box.appendChild(fragment);
}

function selectChip(chip) {
  const box = chip.parentNode;
  const field = box.dataset.field;
  const value = chip.dataset.value;
  draft[groupOf(chip)][field] = NUMBER_FIELDS.includes(field) ? Number(value) : value;
  for (const other of $$('.chip', box)) other.classList.toggle('selected', other === chip);
}

async function testServer(name) {
  readForm();
  const status = $('.status', group(name));
  setStatus(status, t('settings.testing'));
  try {
    const { profiles, folders } = await testConnection(draft[name]);
    renderChips(
      name,
      'qualityProfileId',
      profiles.map((profile) => ({ value: profile.id, label: profile.name })),
    );
    renderChips(
      name,
      'rootFolderPath',
      folders.map((folder) => ({ value: folder.path, label: folder.path })),
    );
    setStatus(status, t('settings.connected'));
  } catch (error) {
    setStatus(status, error.message, true);
  }
}

async function testTmdb() {
  readForm();
  const status = $('.status', group('app'));
  setStatus(status, t('settings.testing'));
  try {
    await testKey(draft.app.tmdbKey);
    setStatus(status, t('settings.connected'));
  } catch (error) {
    setStatus(status, t(error.status === 0 ? 'error.unreachable' : 'error.badKey'), true);
  }
}

function save() {
  readForm();
  if (!isConfigValid(draft)) {
    setStatus($('#settings-status'), t('settings.saveInvalid'), true);
    return;
  }
  state.config = draft;
  saveConfig(draft);
  // Server or language changes invalidate everything fetched so far.
  state.cache.clear();
  resetLibrary();
  setLanguage(draft.app.language);
  translatePage();
  openScreen('library');
}

function fillForm() {
  draft = JSON.parse(JSON.stringify(state.config));
  setStatus($('#settings-status'), '');
  renderChips(
    'app',
    'language',
    Object.keys(LANGUAGES).map((code) => ({ value: code, label: LANGUAGES[code].label })),
  );
  renderChips(
    'app',
    'region',
    REGIONS.map((code) => ({ value: code, label: t(`region.${code}`) })),
  );
  input('app', 'tmdbKey').value = draft.app.tmdbKey;
  setStatus($('.status', group('app')), '');
  for (const name of Object.keys(SERVER_NAMES)) {
    input(name, 'url').value = draft[name].url;
    input(name, 'apiKey').value = draft[name].apiKey;
    setStatus($('.status', group(name)), '');
    if (draft[name].url && draft[name].apiKey) testServer(name); // reloads the option chips
  }
}

export function initSettings() {
  registerScreen('settings', {
    actions: {
      test: (button) => testServer(groupOf(button)),
      testTmdb,
      chip: selectChip,
      save,
      checkUpdate: checkForUpdates,
      installUpdate,
    },
    onOpen: () => {
      fillForm();
      renderUpdates();
    },
  });
}
