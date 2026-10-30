// Search screen: one poster grid from TMDB (or Radarr/Sonarr), a Movies/Shows filter, and
// recent searches plus trending titles while the box is empty.
import { watchLibrary } from '../data/library.js';
import {
  addRecent,
  createResultsCache,
  filterByKind,
  loadRecent,
  saveRecent,
  searchKey,
  searchTitles,
} from '../data/search.js';
import {
  SHELF_TTL_MS,
  libraryIndex,
  loadShelf,
  shelfCacheKey,
  shelvesFor,
  withLibraryStatus,
} from '../data/shelves.js';
import { $, $$, el, setStatus } from '../dom.js';
import { t } from '../i18n.js';
import { setFocus } from '../nav.js';
import { registerScreen } from '../router.js';
import { state } from '../state.js';
import { renderGrid, renderPlaceholders } from '../ui/grid.js';
import { openDetails } from './details.js';

// Searching this long after the last key keeps typing on the TV keyboard smooth.
const LIVE_SEARCH_DELAY_MS = 500;
// Shorter terms match thousands of titles; wait for something more specific.
const MIN_LIVE_CHARS = 3;
// One row of placeholder posters on the 1920 px stage.
const PLACEHOLDER_CARDS = 5;

const resultsCache = createResultsCache();
let results = [];
let errors = [];
let searching = false;
// Whether the results belong to the current term ("No results" only after a real search).
let searched = false;
let filter = 'all';
// What the cards' data-index points at: filtered results and trending, with library status.
let shown = [];
let trendingShown = [];
let trending = [];
let index = new Map();
let recent = loadRecent();
// Incremented per search so a slow, older response can't overwrite newer results.
let latestSearch = 0;
let liveTimer = null;

const term = () => $('#query').value.trim();

function renderResults() {
  shown = filterByKind(withLibraryStatus(results, index), filter);
  $('#search-filters').hidden = results.length === 0;
  for (const tab of $$('#search-filters .tab')) {
    tab.classList.toggle('selected', tab.dataset.filter === filter);
  }
  const grid = $('#search-results');
  if (searching && results.length === 0) renderPlaceholders(grid, PLACEHOLDER_CARDS);
  else renderGrid(grid, shown);
}

function renderNotice() {
  const empty = searched && !searching && shown.length === 0;
  const pending = searching ? t('search.searching') : '';
  const message = errors.join(' · ') || (empty ? t('search.noResults') : pending);
  setStatus($('#search-notice'), message, errors.length > 0);
  // Recent searches and trending only make sense before anything is typed.
  $('#search-start').hidden = Boolean(term());
}

function renderRecent() {
  const chips = $('#search-recent .chips');
  const fragment = document.createDocumentFragment();
  for (const entry of recent) {
    const chip = el('button', 'chip', entry);
    chip.dataset.nav = '';
    chip.dataset.action = 'recent';
    fragment.appendChild(chip);
  }
  chips.textContent = '';
  chips.appendChild(fragment);
  $('#search-recent').hidden = recent.length === 0;
}

function renderTrending() {
  trendingShown = withLibraryStatus(trending, index);
  $('#search-trending').hidden = trendingShown.length === 0;
  renderGrid($('#search-trending .shelf-track'), trendingShown);
}

async function runSearch(text, focusResults) {
  const searchId = ++latestSearch;
  const key = searchKey(state.config, text);
  const show = (value) => {
    if (searchId !== latestSearch) return;
    results = value.items;
    errors = value.errors;
    searched = true;
    renderResults();
    renderNotice();
    if (focusResults && shown.length) {
      setFocus($('#search-results').firstChild);
      focusResults = false;
    }
  };

  const cached = resultsCache.get(key);
  if (cached) {
    searching = false;
    show(cached);
    return;
  }
  // Earlier results stay up while the new ones load, so live typing doesn't flicker.
  searching = true;
  renderResults();
  renderNotice();
  const value = await searchTitles(state.config, text, show);
  if (searchId !== latestSearch) return;
  searching = false;
  if (value.errors.length === 0) resultsCache.set(key, value);
  // The grid already shows the last partial answer, unless that left only placeholders.
  if (results.length === 0) renderResults();
  renderNotice();
}

function clearResults() {
  latestSearch++;
  searching = false;
  results = [];
  errors = [];
  filter = 'all';
  renderResults();
  renderNotice();
}

/** Live results while typing; only with TMDB, whose search is light enough for every pause. */
function onInput() {
  clearTimeout(liveTimer);
  const text = term();
  if (!text) return clearResults();
  searched = false;
  renderNotice();
  if (!state.config.app.tmdbKey || text.length < MIN_LIVE_CHARS) return;
  liveTimer = setTimeout(() => runSearch(text, false), LIVE_SEARCH_DELAY_MS);
}

function submit() {
  clearTimeout(liveTimer);
  const text = term();
  if (!text) return;
  filter = 'all';
  recent = addRecent(recent, text);
  saveRecent(recent);
  renderRecent();
  runSearch(text, true);
}

function loadTrending() {
  const { app } = state.config;
  const shelf = shelvesFor('home', state.config).find((entry) => entry.id === 'trending');
  if (!shelf) {
    trending = [];
    renderTrending();
    return;
  }
  // Same cache entry as Home's Trending row, so this is usually instant and free.
  state.cache
    .load(
      shelfCacheKey('home', shelf.id, app),
      SHELF_TTL_MS,
      () => loadShelf(shelf, state.config),
      (items) => {
        trending = items;
        renderTrending();
      },
    )
    .catch(() => {
      // Without trending the start screen just shows recent searches.
    });
}

function open() {
  renderRecent();
  renderNotice();
  loadTrending();
  watchLibrary(state.cache, state.config, (library) => {
    index = libraryIndex(library);
    renderResults();
    renderTrending();
  }).catch(() => {
    // Library errors are shown on the Library screen; results just lack status badges.
  });
}

function openCard(card) {
  const list = card.closest('#search-trending') ? trendingShown : shown;
  openDetails(list[Number(card.dataset.index)], card);
}

function selectFilter(tab) {
  filter = tab.dataset.filter;
  renderResults();
  renderNotice();
}

function searchRecent(chip) {
  $('#query').value = chip.textContent;
  // The chips hide once there is a term; keep focus on something visible until results come.
  setFocus($('#query'));
  submit();
}

export function initSearch() {
  const input = $('#query');
  input.addEventListener('input', onInput);
  input.addEventListener('submit-input', submit);
  registerScreen('search', {
    actions: { open: openCard, filter: selectFilter, recent: searchRecent },
    onOpen: open,
  });
}
