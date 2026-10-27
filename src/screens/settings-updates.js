// The Updates block of Settings and the sidebar's "Update available" note.
import { installLatest, installedVersion, isNewer, latestVersion } from '../data/updates.js';
import { $, setStatus } from '../dom.js';
import { t } from '../i18n.js';
import { state } from '../state.js';

// Check GitHub at most once a day on startup.
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
// Status ids sent by TizenBrew Installer that we have text for.
const KNOWN_STATUSES = ['fetching', 'resigning', 'parsing', 'installing', 'installed'];

let latest = null;

function updateAvailable() {
  const installed = installedVersion();
  return Boolean(latest && installed && isNewer(latest, installed));
}

export function renderUpdates() {
  const installed = installedVersion();
  $('#update-version').textContent = t('updates.version', {
    installed: installed || t('updates.dev'),
    latest: latest || '—',
  });
  const button = $('#update-install');
  button.hidden = !updateAvailable();
  $('.label', button).textContent = t('updates.install', { version: latest });
  $('#update-badge').hidden = !updateAvailable();
}

export async function checkForUpdates() {
  const status = $('#update-status');
  setStatus(status, t('updates.checking'));
  try {
    latest = await latestVersion();
    state.cache.set('latestVersion', latest, CHECK_INTERVAL_MS);
    setStatus(status, updateAvailable() ? '' : t('updates.upToDate'));
  } catch {
    setStatus(status, t('error.unreachable'), true);
  }
  renderUpdates();
}

export function checkForUpdatesDaily() {
  state.cache
    .load('latestVersion', CHECK_INTERVAL_MS, latestVersion, (version) => {
      latest = version;
      renderUpdates();
    })
    .catch(() => {
      // Offline or rate-limited: try again next start.
    });
}

function statusText(statusId) {
  const name = statusId.split('.').pop();
  return KNOWN_STATUSES.includes(name) ? t(`updates.status.${name}`) : t('updates.status.working');
}

export async function installUpdate(button) {
  const status = $('#update-status');
  if (!window.tizen) {
    setStatus(status, t('updates.tvOnly'), true);
    return;
  }
  button.disabled = true;
  setStatus(status, t('updates.status.working'));
  try {
    await installLatest((statusId) => setStatus(status, statusText(statusId)));
    setStatus(status, t('updates.status.installed'));
  } catch (error) {
    setStatus(status, t('updates.failed', { message: error.message }), true);
    button.disabled = false;
  }
}
