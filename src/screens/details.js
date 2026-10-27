// Details overlay: poster, overview and the one-click Request button.
import { add } from '../data/arr.js';
import { SERVER_NAMES, serverReady } from '../config.js';
import { LIBRARY_CACHE_KEY } from '../data/library.js';
import { KINDS, buildRequestBody, resizeTmdb } from '../data/media.js';
import { resolveForRequest } from '../data/resolve.js';
import { $ } from '../dom.js';
import { t } from '../i18n.js';
import { openOverlay, registerOverlay } from '../router.js';
import { state } from '../state.js';
import { describe, markInLibrary, ratingPill } from '../ui/card.js';
import { iconSvg } from '../ui/icons.js';

const DETAILS_POSTER_SIZE = 'w342';

let selected = null;
let sourceCard = null;

const BUTTON_LABELS = {
  ready: 'details.request',
  busy: 'details.requesting',
  done: 'details.requested',
  inLibrary: 'details.inLibrary',
};

const BUTTON_ICONS = { done: 'done', inLibrary: 'done', error: 'error' };

function setRequestState(status, message = '') {
  const button = $('#d-request');
  $('.label', button).textContent =
    status === 'error' ? t('details.retry', { message }) : t(BUTTON_LABELS[status]);
  $('.icon', button).innerHTML = iconSvg(BUTTON_ICONS[status] || 'request');
  button.disabled = status === 'busy' || status === 'done' || status === 'inLibrary';
  button.classList.toggle('error', status === 'error');
}

async function requestSelected() {
  const item = selected;
  const name = KINDS[item.kind].server;
  const server = state.config[name];
  if (!serverReady(server)) {
    setRequestState('error', t('error.notConfigured', { server: SERVER_NAMES[name] }));
    return;
  }
  setRequestState('busy');
  try {
    // Titles from discovery rows are looked up in Radarr/Sonarr first.
    const raw = await resolveForRequest(item, state.config);
    item.raw = raw;
    if (raw.id > 0) {
      item.inLibrary = true;
    } else {
      await add(server, item.kind, buildRequestBody(item.kind, raw, server));
      item.inLibrary = true;
      state.cache.invalidate(LIBRARY_CACHE_KEY);
    }
    markInLibrary(sourceCard);
    setRequestState(raw.id > 0 ? 'inLibrary' : 'done');
  } catch (error) {
    setRequestState('error', error.message);
  }
}

export function openDetails(item, card) {
  selected = item;
  sourceCard = card;
  // Rows use small posters; Details shows a sharper one.
  $('#d-poster').src = item.poster && resizeTmdb(item.poster, DETAILS_POSTER_SIZE);
  $('#d-title').textContent = item.title;
  const meta = $('#d-meta');
  meta.textContent = describe(item);
  if (item.rating) meta.insertBefore(ratingPill(item.rating), meta.firstChild);
  $('#d-overview').textContent = item.overview;
  setRequestState(item.inLibrary ? 'inLibrary' : 'ready');
  openOverlay('details', card);
}

export function initDetails() {
  registerOverlay('details', { actions: { request: requestSelected } });
}
