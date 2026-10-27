// Settings view: server URL + API key, connection test, and request defaults.
import { testConnection } from '../api.js';
import { SERVER_NAMES, emptyServer, isConfigValid, normalizeUrl, saveConfig } from '../config.js';
import { $, $$, el, setStatus } from '../dom.js';
import { exitApp, registerView, show } from '../nav.js';
import { state } from '../state.js';
import { STRINGS } from '../strings.js';

// Edited copy of the config; only replaces state.config on Save.
let draft = null;

const section = (name) => $(`.server[data-server="${name}"]`);
const serverOf = (node) => node.closest('.server').dataset.server;

function readForm(name) {
  const node = section(name);
  draft[name].url = normalizeUrl($('[data-field="url"]', node).value);
  draft[name].apiKey = $('[data-field="apiKey"]', node).value.trim();
}

/** Renders selectable options; keeps the saved choice if still offered, else picks the first. */
function renderChips(name, field, options) {
  const server = draft[name];
  const box = $(`.chips[data-field="${field}"]`, section(name));
  if (!options.some((option) => option.value === server[field])) {
    server[field] = options.length ? options[0].value : emptyServer()[field];
  }
  const fragment = document.createDocumentFragment();
  for (const option of options) {
    const chip = el('button', 'chip', option.label);
    chip.classList.toggle('selected', option.value === server[field]);
    chip.dataset.nav = '';
    chip.dataset.action = 'chip';
    chip.dataset.value = String(option.value);
    fragment.appendChild(chip);
  }
  box.textContent = '';
  box.appendChild(fragment);
}

async function testServer(name) {
  readForm(name);
  const status = $('.status', section(name));
  setStatus(status, STRINGS.testing);
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
    setStatus(status, STRINGS.connected);
  } catch (error) {
    setStatus(status, error.message, true);
  }
}

function selectChip(chip) {
  const box = chip.parentNode;
  const field = box.dataset.field;
  const value = chip.dataset.value;
  draft[serverOf(chip)][field] = field === 'qualityProfileId' ? Number(value) : value;
  for (const other of $$('.chip', box)) other.classList.toggle('selected', other === chip);
}

function save() {
  Object.keys(SERVER_NAMES).forEach(readForm);
  if (!isConfigValid(draft)) {
    setStatus($('#settings-status'), STRINGS.saveInvalid, true);
    return;
  }
  state.config = draft;
  saveConfig(draft);
  show('search');
}

export function openSettings() {
  draft = JSON.parse(JSON.stringify(state.config));
  setStatus($('#settings-status'), '');
  for (const name of Object.keys(SERVER_NAMES)) {
    const node = section(name);
    $('[data-field="url"]', node).value = draft[name].url;
    $('[data-field="apiKey"]', node).value = draft[name].apiKey;
    setStatus($('.status', node), '');
    if (draft[name].url && draft[name].apiKey) testServer(name); // reloads the option chips
  }
  show('settings');
}

export function initSettings() {
  registerView('settings', {
    actions: { test: (button) => testServer(serverOf(button)), chip: selectChip, save },
    back: () => (isConfigValid(state.config) ? show('search') : exitApp()),
  });
}
