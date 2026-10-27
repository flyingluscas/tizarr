// Poster card used in grids.
import { $, el } from '../dom.js';
import { t } from '../i18n.js';
import { iconSvg } from './icons.js';

/** "2022 · Show" */
export function describe(item) {
  return [item.year, t(`kind.${item.kind}`)].filter(Boolean).join(' · ');
}

/** Library status pill ("In library", "Downloading 40%", "3/10 episodes"…), or null. */
function badge(item) {
  if (item.status) {
    const vars = { progress: item.progress || 0, ...item.episodes };
    return el('span', `badge status-${item.status}`, t(`status.${item.status}`, vars));
  }
  return item.inLibrary ? el('span', 'badge', t('details.inLibrary')) : null;
}

/** Status sits under the title, off the poster, so it never hides the poster art. */
function statusLine(item) {
  const pill = badge(item);
  if (!pill) return null;
  const line = el('div', 'status-line');
  line.appendChild(pill);
  return line;
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
  card.appendChild(poster);
  card.appendChild(el('div', 'title', item.title));
  card.appendChild(el('div', 'meta', describe(item)));
  const status = statusLine(item);
  if (status) card.appendChild(status);
  return card;
}

export function markInLibrary(card) {
  if (!$('.badge', card)) card.appendChild(statusLine({ inLibrary: true }));
}
