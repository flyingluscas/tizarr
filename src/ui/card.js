// Poster card used in grids.
import { $, el } from '../dom.js';
import { t } from '../i18n.js';

/** "2022 · Show", or "2022 · 3/10 episodes" for library shows. */
export function describe(item) {
  const second = item.episodes ? t('library.episodes', item.episodes) : t(`kind.${item.kind}`);
  return [item.year, second].filter(Boolean).join(' · ');
}

function badge(item) {
  if (item.status) {
    const text = t(`status.${item.status}`, { progress: item.progress || 0 });
    return el('span', `badge status-${item.status}`, text);
  }
  return item.inLibrary ? el('span', 'badge', t('details.inLibrary')) : null;
}

export function renderCard(item, index) {
  const card = el('button', 'card');
  card.dataset.nav = '';
  card.dataset.action = 'open';
  card.dataset.index = String(index);

  if (item.poster) {
    const img = el('img');
    img.dataset.src = item.poster;
    img.alt = '';
    card.appendChild(img);
  } else {
    card.appendChild(el('div', 'noposter'));
  }
  const status = badge(item);
  if (status) card.appendChild(status);
  card.appendChild(el('div', 'title', item.title));
  card.appendChild(el('div', 'meta', describe(item)));
  return card;
}

export function markInLibrary(card) {
  if (!$('.badge', card)) {
    card.insertBefore(el('span', 'badge', t('details.inLibrary')), card.children[1]);
  }
}
