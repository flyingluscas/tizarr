// Details overlay: poster, overview and the one-click Request button.
import { add } from '../data/arr.js';
import { KINDS, buildRequestBody } from '../data/media.js';
import { $ } from '../dom.js';
import { t } from '../i18n.js';
import { openOverlay, registerOverlay } from '../router.js';
import { state } from '../state.js';
import { describe, markInLibrary } from '../ui/card.js';

let selected = null;
let sourceCard = null;

const BUTTON_LABELS = {
  ready: 'details.request',
  busy: 'details.requesting',
  done: 'details.requested',
  inLibrary: 'details.inLibrary',
};

function setRequestState(status, message = '') {
  const button = $('#d-request');
  button.textContent =
    status === 'error' ? t('details.retry', { message }) : t(BUTTON_LABELS[status]);
  button.disabled = status === 'busy' || status === 'done' || status === 'inLibrary';
  button.classList.toggle('error', status === 'error');
}

async function requestSelected() {
  const item = selected;
  const server = state.config[KINDS[item.kind].server];
  setRequestState('busy');
  try {
    await add(server, item.kind, buildRequestBody(item.kind, item.raw, server));
    item.inLibrary = true;
    markInLibrary(sourceCard);
    setRequestState('done');
  } catch (error) {
    setRequestState('error', error.message);
  }
}

export function openDetails(item, card) {
  selected = item;
  sourceCard = card;
  $('#d-poster').src = item.poster;
  $('#d-title').textContent = item.title;
  $('#d-meta').textContent = describe(item);
  $('#d-overview').textContent = item.overview;
  setRequestState(item.inLibrary ? 'inLibrary' : 'ready');
  openOverlay('details', card);
}

export function initDetails() {
  registerOverlay('details', { actions: { request: requestSelected } });
}
