// Poster card used in the search grid.
import { $, el } from '../dom.js';
import { STRINGS } from '../strings.js';

/** "2022 · Show" */
export function describe(item) {
  return [item.year, STRINGS[item.kind]].filter(Boolean).join(' · ');
}

function badge() {
  return el('span', 'badge', STRINGS.inLibrary);
}

export function renderCard(item, index) {
  const card = el('button', 'card');
  card.dataset.nav = '';
  card.dataset.action = 'open';
  card.dataset.index = String(index);

  if (item.poster) {
    const img = el('img');
    img.src = item.poster;
    img.alt = '';
    card.appendChild(img);
  } else {
    card.appendChild(el('div', 'noposter'));
  }
  if (item.inLibrary) card.appendChild(badge());
  card.appendChild(el('div', 'title', item.title));
  card.appendChild(el('div', 'meta', describe(item)));
  return card;
}

export function markInLibrary(card) {
  if (!$('.badge', card)) card.insertBefore(badge(), card.children[1]);
}
