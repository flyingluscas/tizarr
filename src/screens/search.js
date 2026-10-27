// Search screen: queries Radarr and Sonarr in parallel and shows one poster grid.
import { lookup } from '../data/arr.js';
import { KINDS, interleave, toItem } from '../data/media.js';
import { SERVER_NAMES, serverReady } from '../config.js';
import { $, setStatus } from '../dom.js';
import { t } from '../i18n.js';
import { setFocus } from '../nav.js';
import { registerScreen } from '../router.js';
import { state } from '../state.js';
import { renderGrid } from '../ui/grid.js';
import { openDetails } from './details.js';

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

async function search() {
  const term = $('#query').value.trim();
  if (!term) return;
  const searchId = ++latestSearch;
  const notice = $('#search-notice');
  setStatus(notice, t('search.searching'));

  const [movies, shows] = await Promise.all([lookupKind('movie', term), lookupKind('show', term)]);
  if (searchId !== latestSearch) return;

  items = interleave(movies.items, shows.items);
  const errors = [movies.error, shows.error].filter(Boolean);
  const message = errors.join(' · ') || (items.length ? '' : t('search.noResults'));
  setStatus(notice, message, errors.length > 0);
  const grid = $('#search-results');
  renderGrid(grid, items);
  if (items.length) setFocus(grid.firstChild);
}

function openCard(card) {
  openDetails(items[Number(card.dataset.index)], card);
}

export function initSearch() {
  $('#query').addEventListener('submit-input', search);
  registerScreen('search', { actions: { open: openCard } });
}
