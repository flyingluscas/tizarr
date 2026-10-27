// Poster card used in grids.
import { $, el } from '../dom.js';
import { t } from '../i18n.js';
import { iconSvg } from './icons.js';

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

/** "★ 7.8" pill; the star is a fixed SVG, the number goes in as text. */
export function ratingPill(rating) {
  const pill = el('span', 'rating');
  const star = el('span', 'icon');
  star.innerHTML = iconSvg('star');
  pill.appendChild(star);
  pill.appendChild(document.createTextNode(rating.toFixed(1)));
  return pill;
}

export function renderCard(item, index) {
  const card = el('button', 'card');
  card.dataset.nav = '';
  card.dataset.action = 'open';
  card.dataset.index = String(index);

  // Poster box: rating pill on top, status strip along the bottom, so they never overlap.
  const poster = el('div', 'poster');
  if (item.poster) {
    const img = el('img');
    img.dataset.src = item.poster;
    img.alt = '';
    poster.appendChild(img);
  }
  if (item.rating) poster.appendChild(ratingPill(item.rating));
  const status = badge(item);
  if (status) poster.appendChild(status);
  card.appendChild(poster);
  card.appendChild(el('div', 'title', item.title));
  card.appendChild(el('div', 'meta', describe(item)));
  return card;
}

export function markInLibrary(card) {
  if (!$('.badge', card))
    $('.poster', card).appendChild(el('span', 'badge', t('details.inLibrary')));
}
