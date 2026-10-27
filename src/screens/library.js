// Library screen: what is already in Radarr/Sonarr, with download status.
import { loadLibrary } from '../data/library.js';
import { $, $$, setStatus } from '../dom.js';
import { t } from '../i18n.js';
import { registerScreen } from '../router.js';
import { state } from '../state.js';
import { renderGrid } from '../ui/grid.js';
import { openDetails } from './details.js';

// Short: statuses (downloading, downloaded) change often, but reopening should be instant.
const LIBRARY_TTL_MS = 2 * 60 * 1000;

let tab = 'movie';
let library = null;

function currentItems() {
  if (!library) return [];
  return tab === 'movie' ? library.movies : library.shows;
}

function render() {
  for (const button of $$('#library .tab')) {
    button.classList.toggle('selected', button.dataset.tab === tab);
  }
  const items = currentItems();
  const notice = $('#library-notice');
  const errors = library ? library.errors : [];
  setStatus(
    notice,
    errors.join(' · ') || (items.length ? '' : t('library.empty')),
    errors.length > 0,
  );
  renderGrid($('#library-grid'), items);
}

function load() {
  if (!library) setStatus($('#library-notice'), t('library.loading'));
  state.cache
    .load(
      'library',
      LIBRARY_TTL_MS,
      () => loadLibrary(state.config),
      (value) => {
        library = value;
        render();
      },
    )
    .catch((error) => setStatus($('#library-notice'), error.message, true));
}

function selectTab(button) {
  tab = button.dataset.tab;
  render();
}

function openCard(card) {
  openDetails(currentItems()[Number(card.dataset.index)], card);
}

/** Drops in-memory data so the next open reloads (e.g. after settings change). */
export function resetLibrary() {
  library = null;
}

export function initLibrary() {
  registerScreen('library', { actions: { tab: selectTab, open: openCard }, onOpen: load });
}
