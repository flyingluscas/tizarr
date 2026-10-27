// Home, Movies and Shows: rows ("shelves") of posters that scroll sideways.
// Each shelf draws from the cache instantly and refreshes in the background on its own.
import {
  LIBRARY_TYPES,
  isTmdbShelf,
  libraryIndex,
  libraryShelf,
  loadShelf,
  shelvesFor,
  withLibraryStatus,
} from '../data/shelves.js';
import { watchLibrary } from '../data/library.js';
import { resizeTmdb } from '../data/media.js';
import { $, el, setStatus } from '../dom.js';
import { t } from '../i18n.js';
import { registerScreen } from '../router.js';
import { state } from '../state.js';
import { renderGrid } from '../ui/grid.js';
import { openDetails } from './details.js';

// Trending/popular lists change slowly; refreshing a few times a day is plenty.
const SHELF_TTL_MS = 6 * 60 * 60 * 1000;
const ROW_POSTER_SIZE = 'w185';

function createBrowseScreen(id) {
  let shelves = [];
  // Raw items per shelf, and what is currently drawn (with library status) for clicks.
  const items = {};
  const shown = {};
  let index = new Map();
  let builtFor = null;

  const root = () => $(`#${id}-shelves`);
  const notice = () => $(`#${id}-notice`);

  /** Settings that change which shelves exist or what they contain. */
  function configKey() {
    const { app, sonarr, radarr } = state.config;
    return [app.tmdbKey, app.language, app.region, sonarr.url, radarr.url].join('|');
  }

  function build() {
    shelves = shelvesFor(id, state.config);
    const fragment = document.createDocumentFragment();
    for (const shelf of shelves) {
      items[shelf.id] = [];
      const section = el('section', 'shelf');
      section.dataset.shelf = shelf.id;
      section.hidden = true;
      section.appendChild(el('h2', '', t(shelf.title)));
      section.appendChild(el('div', 'shelf-track'));
      fragment.appendChild(section);
    }
    root().textContent = '';
    root().appendChild(fragment);
    setStatus(notice(), state.config.app.tmdbKey ? '' : t('home.tmdbHint'));
  }

  function render(shelfId) {
    const section = $(`[data-shelf="${shelfId}"]`, root());
    if (!section) return;
    const list = withLibraryStatus(items[shelfId] || [], index).map((item) => ({
      ...item,
      poster: item.poster && resizeTmdb(item.poster, ROW_POSTER_SIZE),
    }));
    shown[shelfId] = list;
    section.hidden = list.length === 0;
    renderGrid($('.shelf-track', section), list);
  }

  function loadLibraryShelves() {
    watchLibrary(state.cache, state.config, (library) => {
      index = libraryIndex(library);
      for (const shelf of shelves) {
        if (LIBRARY_TYPES.includes(shelf.type)) items[shelf.id] = libraryShelf(shelf, library);
      }
      // Status badges on every shelf depend on the library, so redraw them all.
      shelves.forEach((shelf) => render(shelf.id));
    }).catch(() => {
      // Library errors are shown on the Library screen; shelves just lack badges.
    });
  }

  function loadFetchedShelves() {
    const { language, region } = state.config.app;
    for (const shelf of shelves) {
      if (LIBRARY_TYPES.includes(shelf.type)) continue;
      const key = `shelf:${id}:${shelf.id}:${language}:${region}`;
      state.cache
        .load(
          key,
          SHELF_TTL_MS,
          () => loadShelf(shelf, state.config),
          (value) => {
            items[shelf.id] = value;
            render(shelf.id);
          },
        )
        .catch(() => {
          if (isTmdbShelf(shelf)) setStatus(notice(), t('home.tmdbError'), true);
        });
    }
  }

  function open() {
    if (builtFor !== configKey()) {
      build();
      builtFor = configKey();
    }
    loadLibraryShelves();
    loadFetchedShelves();
  }

  function openCard(card) {
    const shelfId = card.closest('.shelf').dataset.shelf;
    openDetails(shown[shelfId][Number(card.dataset.index)], card);
  }

  registerScreen(id, { actions: { open: openCard }, onOpen: open });
}

export function initBrowse() {
  ['home', 'movies', 'shows'].forEach(createBrowseScreen);
}
