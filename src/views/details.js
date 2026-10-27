// Details view: poster, overview and the one-click Request button.
import { add } from '../api.js';
import { $ } from '../dom.js';
import { KINDS, buildRequestBody } from '../media.js';
import { registerView, show } from '../nav.js';
import { state } from '../state.js';
import { STRINGS } from '../strings.js';
import { describe, markInLibrary } from './card.js';

let selected = null;
let sourceCard = null;

const BUTTON_LABELS = {
  ready: STRINGS.request,
  busy: STRINGS.requesting,
  done: STRINGS.requested,
  inLibrary: STRINGS.inLibrary,
};

function setRequestState(status, message = '') {
  const button = $('#d-request');
  button.textContent = status === 'error' ? STRINGS.retry + message : BUTTON_LABELS[status];
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
  show('details');
}

export function initDetails() {
  registerView('details', {
    actions: { request: requestSelected },
    back: () => show('search', sourceCard),
  });
}
