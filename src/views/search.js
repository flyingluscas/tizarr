// Search view: queries Radarr and Sonarr in parallel and shows one poster grid.
import { lookup } from '../api.js';
import { SERVER_NAMES, serverReady } from '../config.js';
import { $, setStatus } from '../dom.js';
import { KINDS, interleave, toItem } from '../media.js';
import { registerView, setFocus } from '../nav.js';
import { state } from '../state.js';
import { STRINGS } from '../strings.js';
import { renderCard } from './card.js';
import { openDetails } from './details.js';
import { openSettings } from './settings.js';

// Lookups can return 100+ titles; more cards only slow the TV down.
const MAX_RESULTS_PER_SERVER = 20;

let items = [];
// Incremented per search so a slow, older response can't overwrite newer results.
let latestSearch = 0;

async function lookupKind(kind, term) {
  const name = KINDS[kind].server;
  const server = state.config[name];
  if (!serverReady(server)) return { items: [] };
  try {
    const results = await lookup(server, kind, term);
    return { items: results.slice(0, MAX_RESULTS_PER_SERVER).map((r) => toItem(kind, r)) };
  } catch (error) {
    return { items: [], error: `${SERVER_NAMES[name]}: ${error.message}` };
  }
}

function renderResults() {
  const grid = $('#results');
  const fragment = document.createDocumentFragment();
  items.forEach((item, index) => fragment.appendChild(renderCard(item, index)));
  grid.textContent = '';
  grid.appendChild(fragment);
  if (items.length) setFocus(grid.firstChild);
}

async function search() {
  const term = $('#query').value.trim();
  if (!term) return;
  const searchId = ++latestSearch;
  const notice = $('#notice');
  setStatus(notice, STRINGS.searching);

  const [movies, shows] = await Promise.all([lookupKind('movie', term), lookupKind('show', term)]);
  if (searchId !== latestSearch) return;

  items = interleave(movies.items, shows.items);
  const errors = [movies.error, shows.error].filter(Boolean);
  setStatus(
    notice,
    errors.join(' · ') || (items.length ? '' : STRINGS.noResults),
    errors.length > 0,
  );
  renderResults();
}

function openCard(card) {
  openDetails(items[Number(card.dataset.index)], card);
}

export function initSearch() {
  $('#query').addEventListener('submit-input', search);
  registerView('search', { actions: { open: openCard, settings: openSettings } });
}
