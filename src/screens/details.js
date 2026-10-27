// Details overlay: backdrop hero with facts, ratings, season picker for shows, the Request
// button, and "More like this". Opens instantly with what the card knew, then fills in from
// the Radarr/Sonarr lookup (the same one a request needs) and TMDB recommendations.
import { SERVER_NAMES, serverReady } from '../config.js';
import { add, getSeriesById } from '../data/arr.js';
import { factsOf, ratingsBreakdown, seasonNumbers, seasonProgress } from '../data/details.js';
import { LIBRARY_CACHE_KEY } from '../data/library.js';
import { KINDS, backdropOf, buildRequestBody, httpsOnly, resizeTmdb } from '../data/media.js';
import { resolveForRequest } from '../data/resolve.js';
import { libraryIndex, withLibraryStatus } from '../data/shelves.js';
import { fetchRecommendations, fetchSeasonCounts } from '../data/tmdb.js';
import { findTrailer } from '../data/trailers.js';
import { $, el, setStatus } from '../dom.js';
import { t } from '../i18n.js';
import { closeOverlay, openOverlay, refreshScreen, registerOverlay } from '../router.js';
import { state } from '../state.js';
import { describe, markInLibrary, ratingPill, statusPill } from '../ui/card.js';
import { renderGrid } from '../ui/grid.js';
import { iconSvg } from '../ui/icons.js';
import { playTrailer } from '../ui/player.js';
import {
  closePanel,
  hideSeasons,
  isPanelOpen,
  openPanel,
  panelChoice,
  quickPick,
  setEpisodeCounts,
  setupSeasons,
  toggleSeasonRow,
} from './details-seasons.js';
import { confirmCancelAndDelete, confirmTryAnother } from './downloads.js';

const DETAILS_POSTER_SIZE = 'w342';
// Recommendations for a title rarely change.
const SIMILAR_TTL_MS = 6 * 60 * 60 * 1000;

let selected = null;
let sourceCard = null;
let similar = [];
// Unowned shows with several seasons say "Request all seasons" on the main button.
let requestsAllSeasons = false;
// { kind, titleId, title } of the owned title Details can delete / re-search.
let manageTarget = null;
let trailerId = null;
// Incremented on every open so late responses for a previous title are ignored.
let openId = 0;

const BUTTON_LABELS = {
  ready: 'details.request',
  busy: 'details.requesting',
  done: 'details.requested',
  inLibrary: 'details.inLibrary',
};
const BUTTON_ICONS = { done: 'done', inLibrary: 'done', error: 'error' };

function setRequestState(status, message = '') {
  const button = $('#d-request');
  const readyLabel = requestsAllSeasons ? 'seasons.requestAll' : BUTTON_LABELS.ready;
  $('.label', button).textContent =
    status === 'error'
      ? t('details.retry', { message })
      : t(status === 'ready' ? readyLabel : BUTTON_LABELS[status]);
  $('.icon', button).innerHTML = iconSvg(BUTTON_ICONS[status] || 'request');
  button.disabled = status === 'busy' || status === 'done' || status === 'inLibrary';
  button.classList.toggle('error', status === 'error');
}

function setText(selector, text) {
  $(selector).textContent = text;
}

function renderStatus(item) {
  const box = $('#d-status');
  box.textContent = '';
  const pill = statusPill(item);
  if (pill) box.appendChild(pill);
}

/** Before the lookup: the single ★ score the card had. After: every source we know. */
function renderRatings(item, raw) {
  const box = $('#d-ratings');
  box.textContent = '';
  const ratings = raw ? ratingsBreakdown(raw) : [];
  if (!ratings.length) {
    if (item.rating) box.appendChild(ratingPill(item.rating));
    return;
  }
  for (const rating of ratings) {
    const entry = el('span', 'd-rating');
    if (rating.label) entry.appendChild(el('span', 'd-rating-label', rating.label));
    else entry.appendChild(ratingPill(Number(rating.text)));
    if (rating.label) entry.appendChild(el('span', 'd-rating-value', rating.text));
    box.appendChild(entry);
  }
}

function setBackdrop(url) {
  const img = $('#d-backdrop');
  img.hidden = !url;
  if (url) img.src = url;
}

/** Try another release / Delete for titles already in Radarr/Sonarr. */
function showManage(item, raw) {
  const downloading = item.status === 'downloading';
  $('#d-manage').hidden = false;
  $('#d-another').hidden = !downloading;
  $('#d-delete .label').textContent = t(downloading ? 'manage.cancelDelete' : 'manage.delete');
  setStatus($('#d-manage-status'), '');
  manageTarget = { kind: item.kind, titleId: raw.id, title: item.title };
}

async function runManage(action) {
  const status = $('#d-manage-status');
  const server = SERVER_NAMES[KINDS[manageTarget.kind].server];
  try {
    if (action === 'another') {
      if (await confirmTryAnother(manageTarget, server)) setStatus(status, t('manage.searching'));
      return;
    }
    const downloading = !$('#d-another').hidden;
    if (await confirmCancelAndDelete(manageTarget, server, downloading)) {
      closeOverlay();
      refreshScreen();
    }
  } catch (error) {
    setStatus(status, error.message, true);
  }
}

function showSeasonChoice(item, raw) {
  const numbers = seasonNumbers(raw);
  setupSeasons(numbers);
  requestsAllSeasons = numbers.length > 1;
  setRequestState('ready');
  const { tmdbKey } = state.config.app;
  const tmdbId = item.tmdbId || raw.tmdbId;
  if (!tmdbKey || !tmdbId || numbers.length < 2) return;
  const id = openId;
  fetchSeasonCounts(tmdbKey, tmdbId)
    .then((counts) => {
      if (id === openId) setEpisodeCounts(counts);
    })
    .catch(() => {
      // Counts are a nice-to-have; rows still work without them.
    });
}

async function renderProgress(item, raw, id) {
  if (item.kind !== 'show' || !(raw.id > 0)) return;
  const series = await getSeriesById(state.config.sonarr, raw.id);
  if (id === openId) setText('#d-progress', seasonProgress(series).join(' · '));
}

function renderSimilar(item, tmdbId, id) {
  const { app } = state.config;
  const section = $('#d-similar');
  section.hidden = true;
  if (!app.tmdbKey || !tmdbId) return;
  const key = `similar:${item.kind}:${tmdbId}:${app.language}`;
  state.cache
    .load(
      key,
      SIMILAR_TTL_MS,
      () => fetchRecommendations(app, item.kind, tmdbId),
      (items) => {
        if (id !== openId) return;
        const library = state.cache.get(LIBRARY_CACHE_KEY);
        similar = withLibraryStatus(items, library ? libraryIndex(library.value) : new Map());
        section.hidden = similar.length === 0;
        renderGrid($('.shelf-track', section), similar);
      },
    )
    .catch(() => {
      // No recommendations: the section just stays hidden.
    });
}

/** Shows the Trailer button once a trailer is found (Radarr first, then TMDB). */
function showTrailer(item, raw, id) {
  findTrailer(item, raw, state.config.app)
    .then((found) => {
      if (id !== openId || !found) return;
      trailerId = found;
      $('#d-trailer').hidden = false;
    })
    .catch(() => {
      // No trailer: the button stays hidden.
    });
}

/** Fills facts, ratings, backdrop, seasons and status once Radarr/Sonarr answers. */
async function enrich(item, id) {
  const server = state.config[KINDS[item.kind].server];
  if (!serverReady(server)) {
    renderSimilar(item, item.tmdbId, id);
    showTrailer(item, null, id);
    return;
  }
  try {
    const raw = await resolveForRequest(item, state.config);
    if (id !== openId) return;
    item.raw = raw;
    if (raw.id > 0) item.inLibrary = true;
    setText('#d-facts', factsOf(item.kind, raw, t).join(' · '));
    renderRatings(item, raw);
    if (!item.overview) setText('#d-overview', raw.overview || '');
    if (!$('#d-backdrop').src || $('#d-backdrop').hidden) setBackdrop(backdropOf(raw));
    renderStatus(item);
    if (item.inLibrary) {
      setRequestState('inLibrary');
      if (raw.id > 0) showManage(item, raw);
    } else if (item.kind === 'show') showSeasonChoice(item, raw);
    renderSimilar(item, item.tmdbId || raw.tmdbId, id);
    showTrailer(item, raw, id);
    await renderProgress(item, raw, id);
  } catch {
    // Lookup failed: keep the basic info; pressing Request reports the error.
    renderSimilar(item, item.tmdbId, id);
    showTrailer(item, null, id);
  }
}

/** Requests the selected title; for shows `seasons` comes from the panel (default: all). */
async function requestSelected(seasons = { preset: 'all' }) {
  const item = selected;
  const name = KINDS[item.kind].server;
  const server = state.config[name];
  if (!serverReady(server)) {
    setRequestState('error', t('error.notConfigured', { server: SERVER_NAMES[name] }));
    return;
  }
  setRequestState('busy');
  try {
    const raw = await resolveForRequest(item, state.config);
    item.raw = raw;
    if (raw.id > 0) {
      item.inLibrary = true;
    } else {
      await add(server, item.kind, buildRequestBody(item.kind, raw, server, seasons));
      item.inLibrary = true;
      state.cache.invalidate(LIBRARY_CACHE_KEY);
    }
    if (sourceCard) markInLibrary(sourceCard);
    hideSeasons();
    setRequestState(raw.id > 0 ? 'inLibrary' : 'done');
  } catch (error) {
    setRequestState('error', error.message);
  }
}

/** Opens Details for an item. `card` is where Back returns; null keeps the current one. */
export function openDetails(item, card) {
  selected = item;
  if (card) sourceCard = card;
  const id = ++openId;

  $('#d-poster').src = httpsOnly(item.poster && resizeTmdb(item.poster, DETAILS_POSTER_SIZE));
  setBackdrop(httpsOnly(item.backdrop));
  setText('#d-title', item.title);
  setText('#d-facts', describe(item));
  setText('#d-overview', item.overview);
  setText('#d-progress', '');
  renderRatings(item, null);
  renderStatus(item);
  hideSeasons();
  $('#d-manage').hidden = true;
  $('#d-trailer').hidden = true;
  trailerId = null;
  requestsAllSeasons = false;
  setRequestState(item.inLibrary ? 'inLibrary' : 'ready');

  openOverlay('details', sourceCard);
  $('#details').scrollTop = 0;
  enrich(item, id);
}

function requestFromPanel() {
  const choice = panelChoice();
  if (!choice) {
    $('#d-panel-request .label').textContent = t('seasons.pickOne');
    return;
  }
  closePanel();
  requestSelected(choice);
}

function openSimilar(card) {
  openDetails(similar[Number(card.dataset.index)], null);
}

export function initDetails() {
  registerOverlay('details', {
    actions: {
      request: () => requestSelected(),
      choose: openPanel,
      quick: quickPick,
      seasonRow: toggleSeasonRow,
      panelRequest: requestFromPanel,
      closePanel,
      trailer: () => playTrailer(trailerId),
      tryAnother: () => runManage('another'),
      deleteTitle: () => runManage('delete'),
      open: openSimilar,
    },
    // Back closes the season panel first, then Details.
    back: () => (isPanelOpen() ? closePanel() : closeOverlay()),
  });
}
