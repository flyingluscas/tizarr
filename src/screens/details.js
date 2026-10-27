// Details overlay: backdrop hero with facts, ratings, season picker for shows, the Request
// button, and "More like this". Opens instantly with what the card knew, then fills in from
// the Radarr/Sonarr lookup (the same one a request needs) and TMDB recommendations.
import { SERVER_NAMES, serverReady } from '../config.js';
import { add, getSeriesById } from '../data/arr.js';
import { factsOf, ratingsBreakdown, seasonNumbers, seasonProgress } from '../data/details.js';
import { LIBRARY_CACHE_KEY } from '../data/library.js';
import {
  KINDS,
  SEASON_PRESETS,
  backdropOf,
  buildRequestBody,
  httpsOnly,
  resizeTmdb,
} from '../data/media.js';
import { resolveForRequest } from '../data/resolve.js';
import { libraryIndex, withLibraryStatus } from '../data/shelves.js';
import { fetchRecommendations } from '../data/tmdb.js';
import { $, $$, el } from '../dom.js';
import { t } from '../i18n.js';
import { openOverlay, registerOverlay } from '../router.js';
import { state } from '../state.js';
import { describe, markInLibrary, ratingPill, statusPill } from '../ui/card.js';
import { renderGrid } from '../ui/grid.js';
import { iconSvg } from '../ui/icons.js';

const DETAILS_POSTER_SIZE = 'w342';
// Recommendations for a title rarely change.
const SIMILAR_TTL_MS = 6 * 60 * 60 * 1000;

let selected = null;
let sourceCard = null;
let similar = [];
// { preset } or { picked: [seasonNumbers] }, passed to buildRequestBody.
let seasonChoice = { preset: 'all' };
let pickedSeasons = [];
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
  $('.label', button).textContent =
    status === 'error' ? t('details.retry', { message }) : t(BUTTON_LABELS[status]);
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

function chip(label, action, value, isSelected) {
  const node = el('button', 'chip', label);
  node.dataset.nav = '';
  node.dataset.action = action;
  node.dataset.value = String(value);
  node.classList.toggle('selected', isSelected);
  return node;
}

function renderSeasonPicker(raw) {
  const numbers = seasonNumbers(raw);
  const picker = $('#d-picker');
  picker.hidden = numbers.length === 0;
  if (!numbers.length) return;
  seasonChoice = { preset: 'all' };
  pickedSeasons = numbers.slice();

  const presets = $('#d-presets');
  presets.textContent = '';
  for (const preset of SEASON_PRESETS.concat('pick')) {
    presets.appendChild(chip(t(`seasons.${preset}`), 'preset', preset, preset === 'all'));
  }
  const list = $('#d-season-list');
  list.textContent = '';
  list.hidden = true;
  for (const number of numbers) {
    list.appendChild(chip(t('seasons.season', { number }), 'season', number, true));
  }
}

function selectPreset(node) {
  const preset = node.dataset.value;
  seasonChoice = preset === 'pick' ? { picked: pickedSeasons } : { preset };
  for (const other of $$('#d-presets .chip')) other.classList.toggle('selected', other === node);
  $('#d-season-list').hidden = preset !== 'pick';
}

function toggleSeason(node) {
  const number = Number(node.dataset.value);
  const on = !node.classList.contains('selected');
  node.classList.toggle('selected', on);
  pickedSeasons = on
    ? pickedSeasons.concat(number).sort((a, b) => a - b)
    : pickedSeasons.filter((value) => value !== number);
  seasonChoice = { picked: pickedSeasons };
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

/** Fills facts, ratings, backdrop, seasons and status once Radarr/Sonarr answers. */
async function enrich(item, id) {
  const server = state.config[KINDS[item.kind].server];
  if (!serverReady(server)) {
    renderSimilar(item, item.tmdbId, id);
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
    if (item.inLibrary) setRequestState('inLibrary');
    else if (item.kind === 'show') renderSeasonPicker(raw);
    renderSimilar(item, item.tmdbId || raw.tmdbId, id);
    await renderProgress(item, raw, id);
  } catch {
    // Lookup failed: keep the basic info; pressing Request reports the error.
    renderSimilar(item, item.tmdbId, id);
  }
}

async function requestSelected() {
  const item = selected;
  const name = KINDS[item.kind].server;
  const server = state.config[name];
  if (!serverReady(server)) {
    setRequestState('error', t('error.notConfigured', { server: SERVER_NAMES[name] }));
    return;
  }
  if (seasonChoice.picked && !seasonChoice.picked.length) {
    setRequestState('error', t('seasons.pickOne'));
    return;
  }
  setRequestState('busy');
  try {
    const raw = await resolveForRequest(item, state.config);
    item.raw = raw;
    if (raw.id > 0) {
      item.inLibrary = true;
    } else {
      await add(server, item.kind, buildRequestBody(item.kind, raw, server, seasonChoice));
      item.inLibrary = true;
      state.cache.invalidate(LIBRARY_CACHE_KEY);
    }
    if (sourceCard) markInLibrary(sourceCard);
    $('#d-picker').hidden = true;
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
  $('#d-picker').hidden = true;
  seasonChoice = { preset: 'all' };
  setRequestState(item.inLibrary ? 'inLibrary' : 'ready');

  openOverlay('details', sourceCard);
  $('#details').scrollTop = 0;
  enrich(item, id);
}

function openSimilar(card) {
  openDetails(similar[Number(card.dataset.index)], null);
}

export function initDetails() {
  registerOverlay('details', {
    actions: {
      request: requestSelected,
      preset: selectPreset,
      season: toggleSeason,
      open: openSimilar,
    },
  });
}
