// Season choice for show requests on Details: the main button requests every season; "Choose
// seasons" opens a panel with quick picks (All / Latest / Future only) and one checkable row
// per season, whose Request button counts the picks.
import { seasonRequest } from '../data/details.js';
import { $, $$, el } from '../dom.js';
import { t } from '../i18n.js';
import { setFocus } from '../nav.js';
import { iconSvg } from '../ui/icons.js';

const QUICK_PICKS = ['all', 'lastSeason', 'future'];

let seasons = [];
let picked = [];
// 'picked' (rows decide) or 'future' (only episodes airing from now on).
let mode = 'picked';
let episodeCounts = new Map();

function chip(label, action, value) {
  const node = el('button', 'chip', label);
  node.dataset.nav = '';
  node.dataset.action = action;
  node.dataset.value = value;
  return node;
}

function requestLabel() {
  if (mode === 'future') return t('seasons.requestFuture');
  if (picked.length === seasons.length) return t('seasons.requestAll');
  return picked.length === 1
    ? t('seasons.requestOne')
    : t('seasons.requestCount', { count: picked.length });
}

function render() {
  for (const node of $$('#d-quick .chip')) {
    const value = node.dataset.value;
    const active =
      value === 'future'
        ? mode === 'future'
        : mode === 'picked' &&
          (value === 'all'
            ? picked.length === seasons.length
            : picked.length === 1 && picked[0] === seasons[seasons.length - 1]);
    node.classList.toggle('selected', active);
  }
  for (const row of $$('#d-season-rows .season-row')) {
    const on = mode === 'picked' && picked.includes(Number(row.dataset.value));
    row.classList.toggle('checked', on);
    row.classList.toggle('muted', mode === 'future');
    $('.check', row).innerHTML = on ? iconSvg('done') : '';
  }
  $('#d-panel-request .label').textContent = requestLabel();
}

/** Prepares the panel for a show that is not in the library yet. */
export function setupSeasons(numbers) {
  seasons = numbers;
  picked = numbers.slice();
  mode = 'picked';
  episodeCounts = new Map();

  const quick = $('#d-quick');
  quick.textContent = '';
  for (const pick of QUICK_PICKS) quick.appendChild(chip(t(`seasons.${pick}`), 'quick', pick));

  const rows = $('#d-season-rows');
  rows.textContent = '';
  for (const number of numbers) {
    const row = el('button', 'season-row');
    row.dataset.nav = '';
    row.dataset.action = 'seasonRow';
    row.dataset.value = String(number);
    row.appendChild(el('span', 'check'));
    row.appendChild(el('span', '', t('seasons.season', { number })));
    row.appendChild(el('span', 'count'));
    rows.appendChild(row);
  }
  $('#d-choose').hidden = numbers.length < 2;
  render();
}

/** Episode counts from TMDB, when available. */
export function setEpisodeCounts(counts) {
  episodeCounts = counts;
  for (const row of $$('#d-season-rows .season-row')) {
    const count = episodeCounts.get(Number(row.dataset.value));
    $('.count', row).textContent = count ? t('seasons.episodes', { count }) : '';
  }
}

export function hideSeasons() {
  $('#d-choose').hidden = true;
  $('#d-panel').hidden = true;
  $('#d-actions').hidden = false;
}

export function isPanelOpen() {
  return !$('#d-panel').hidden;
}

export function openPanel() {
  $('#d-panel').hidden = false;
  $('#d-actions').hidden = true;
  setFocus($('#d-season-rows .season-row'));
}

export function closePanel() {
  $('#d-panel').hidden = true;
  $('#d-actions').hidden = false;
  setFocus($('#d-choose'));
}

export function quickPick(node) {
  const pick = node.dataset.value;
  if (pick === 'future') {
    mode = 'future';
  } else {
    mode = 'picked';
    picked = pick === 'all' ? seasons.slice() : [seasons[seasons.length - 1]];
  }
  render();
}

export function toggleSeasonRow(row) {
  const number = Number(row.dataset.value);
  if (mode === 'future') {
    // Touching a season leaves "future only" and starts a hand-picked selection.
    mode = 'picked';
    picked = [number];
  } else {
    picked = picked.includes(number)
      ? picked.filter((value) => value !== number)
      : picked.concat(number);
  }
  render();
}

/** The choice to send, or null when nothing is selected. */
export function panelChoice() {
  if (mode === 'picked' && !picked.length) return null;
  return seasonRequest(mode, picked, seasons);
}
