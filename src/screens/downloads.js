// Downloads screen: what Radarr/Sonarr are downloading (one row per title, refreshed every few
// seconds while visible), with Try another release / Cancel and delete, and the episodes
// airing in the next two weeks.
import { SERVER_NAMES } from '../config.js';
import {
  cancelAndDelete,
  formatSize,
  formatTimeLeft,
  loadDownloads,
  loadUpcoming,
  tryAnotherRelease,
} from '../data/downloads.js';
import { LIBRARY_CACHE_KEY } from '../data/library.js';
import { KINDS, resizeTmdb } from '../data/media.js';
import { $, el, setStatus } from '../dom.js';
import { currentLanguage, t } from '../i18n.js';
import { setFocus } from '../nav.js';
import { registerScreen } from '../router.js';
import { state } from '../state.js';
import { ask } from '../ui/dialog.js';
import { observeImages } from '../ui/lazy-images.js';

// Live progress without hammering the servers; only runs while the screen is visible.
const REFRESH_MS = 5000;
const THUMB_SIZE = 'w185';

let items = [];
let timer = null;
// Set while a dialog or action is in progress, so a refresh doesn't redraw underneath it.
let busy = false;

const isVisible = () => $('#downloads').classList.contains('active');

function describeProgress(item) {
  const parts = [t(`downloads.status.${item.status}`)];
  if (item.status === 'downloading') parts.push(`${item.progress}%`);
  if (item.left) parts.push(t('downloads.left', { size: formatSize(item.left) }));
  if (item.timeLeft) parts.push(formatTimeLeft(item.timeLeft));
  return parts.join(' · ');
}

const rowKey = (item) => `${item.kind}:${item.titleId}`;

/** Text and bar that change between refreshes; the poster never does. */
function updateRow(row, item, index) {
  row.dataset.index = String(index);
  const subtitle = item.episodes
    ? t('seasons.episodes', { count: item.episodes })
    : String(item.year || '');
  $('.download-kind', row).textContent = [subtitle, t(`kind.${item.kind}`)]
    .filter(Boolean)
    .join(' · ');
  $('.progress span', row).style.width = `${item.progress}%`;
  $('.download-progress', row).textContent = describeProgress(item);
}

function createRow(item) {
  const row = el('button', 'download-row');
  row.dataset.nav = '';
  row.dataset.action = 'download';
  row.dataset.key = rowKey(item);
  const thumb = el('div', 'thumb');
  if (item.poster) {
    const img = el('img');
    img.dataset.src = resizeTmdb(item.poster, THUMB_SIZE);
    img.alt = '';
    thumb.appendChild(img);
  }
  row.appendChild(thumb);
  const info = el('div', 'download-info');
  info.appendChild(el('div', 'title', item.title));
  info.appendChild(el('div', 'meta download-kind'));
  const bar = el('div', 'progress');
  bar.appendChild(el('span'));
  info.appendChild(bar);
  info.appendChild(el('div', 'meta download-progress'));
  row.appendChild(info);
  return row;
}

/**
 * Updates rows in place, keyed by title, so posters aren't recreated (and reloaded) on every
 * refresh; rows are only added or removed when downloads start or finish. Moving an existing
 * node keeps it focused and keeps its image.
 */
function renderList(result) {
  const list = $('#downloads-list');
  const existing = new Map();
  for (const row of Array.from(list.children)) existing.set(row.dataset.key, row);
  items = result.items;
  const fresh = [];
  items.forEach((item, index) => {
    let row = existing.get(rowKey(item));
    existing.delete(rowKey(item));
    if (!row) {
      row = createRow(item);
      fresh.push(row);
    }
    updateRow(row, item, index);
    list.appendChild(row);
  });
  // Rows left over belong to finished/removed downloads.
  const lostFocus = Array.from(existing.values()).some((row) => row.classList.contains('focused'));
  existing.forEach((row) => row.remove());
  if (fresh.length) observeImages(list);
  if (lostFocus && list.firstChild) setFocus(list.firstChild);

  const message = result.errors.join(' · ') || (items.length ? '' : t('downloads.empty'));
  setStatus($('#downloads-notice'), message, result.errors.length > 0);
}

function renderUpcoming(episodes) {
  const box = $('#downloads-upcoming');
  box.textContent = '';
  const format = { weekday: 'short', day: 'numeric', month: 'short' };
  for (const episode of episodes) {
    const row = el('div', 'upcoming-row');
    // Focusable so the remote can scroll down through the list.
    row.dataset.nav = '';
    const date = new Date(episode.airDate).toLocaleDateString(currentLanguage(), format);
    row.appendChild(el('span', 'upcoming-date', date));
    row.appendChild(
      el('span', '', [episode.series, episode.code, episode.title].filter(Boolean).join(' · ')),
    );
    box.appendChild(row);
  }
  $('#downloads-no-upcoming').hidden = episodes.length > 0;
}

async function refresh() {
  if (busy) return;
  try {
    renderList(await loadDownloads(state.config));
  } catch (error) {
    setStatus($('#downloads-notice'), error.message, true);
  }
}

/** Timer tick: stops itself once the user has left the screen. */
function tick() {
  if (isVisible()) {
    refresh();
    return;
  }
  clearInterval(timer);
  timer = null;
}

// Runs before the screen is shown (see router.openScreen), so no visibility check here.
function open() {
  refresh();
  loadUpcoming(state.config).then(renderUpcoming, () => renderUpcoming([]));
  if (!timer) timer = setInterval(tick, REFRESH_MS);
}

/** Choice, then confirmation, then the action. Exported for Details. */
export async function manageDownload(item) {
  const server = SERVER_NAMES[KINDS[item.kind].server];
  const choice = await ask({
    title: t('manage.chooseTitle', { title: item.title }),
    options: [
      { id: 'cancel', label: t('dialog.cancel') },
      { id: 'another', label: t('manage.tryAnother') },
      { id: 'delete', label: t('manage.cancelDelete'), danger: true },
    ],
  });
  if (choice === 'another') return confirmTryAnother(item, server);
  if (choice === 'delete') return confirmCancelAndDelete(item, server);
  return false;
}

export async function confirmTryAnother(item, server) {
  const answer = await ask({
    title: t('manage.tryAnotherTitle', { title: item.title }),
    message: t('manage.tryAnotherMessage', { server }),
    options: [
      { id: 'cancel', label: t('dialog.cancel') },
      { id: 'go', label: t('manage.tryAnother') },
    ],
  });
  if (answer !== 'go') return false;
  await tryAnotherRelease(state.config, item.kind, item.titleId);
  state.cache.invalidate(LIBRARY_CACHE_KEY);
  return true;
}

export async function confirmCancelAndDelete(item, server, downloading = true) {
  const answer = await ask({
    title: t(downloading ? 'manage.cancelDeleteTitle' : 'manage.deleteTitle', {
      title: item.title,
    }),
    message: t(downloading ? 'manage.cancelDeleteMessage' : 'manage.deleteMessage', { server }),
    options: [
      { id: 'cancel', label: t('dialog.cancel') },
      {
        id: 'go',
        label: t(downloading ? 'manage.cancelDelete' : 'manage.delete'),
        danger: true,
      },
    ],
  });
  if (answer !== 'go') return false;
  await cancelAndDelete(state.config, item.kind, item.titleId);
  state.cache.invalidate(LIBRARY_CACHE_KEY);
  return true;
}

async function onRow(row) {
  const item = items[Number(row.dataset.index)];
  busy = true;
  try {
    await manageDownload(item);
  } catch (error) {
    setStatus($('#downloads-notice'), error.message, true);
  } finally {
    busy = false;
    refresh();
  }
}

export function initDownloads() {
  registerScreen('downloads', { actions: { download: onRow }, onOpen: open });
}
