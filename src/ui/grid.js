// Renders cards into a grid in one DOM write and keeps the focused position on refresh.
import { $, el } from '../dom.js';
import { setFocus } from '../nav.js';
import { renderCard } from './card.js';
import { observeImages } from './lazy-images.js';

export function renderGrid(grid, items) {
  const focused = $('.focused', grid);
  const focusedIndex = focused ? Array.prototype.indexOf.call(grid.children, focused) : -1;

  const fragment = document.createDocumentFragment();
  items.forEach((item, index) => fragment.appendChild(renderCard(item, index)));
  grid.textContent = '';
  grid.appendChild(fragment);
  observeImages(grid);

  if (focusedIndex >= 0 && grid.children.length) {
    setFocus(grid.children[Math.min(focusedIndex, grid.children.length - 1)]);
  }
}

/** Empty, non-focusable poster boxes shown while the first results load. */
export function renderPlaceholders(grid, count) {
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const card = el('div', 'card placeholder');
    card.appendChild(el('div', 'poster'));
    card.appendChild(el('div', 'title-bar'));
    fragment.appendChild(card);
  }
  grid.textContent = '';
  grid.appendChild(fragment);
}
