// Remote-control navigation: focus handling, arrow movement, Enter/Back and view switching.
// Each view registers its click actions and Back behaviour; this module routes keys to them.
// Views flagged `sidebar` also let focus move into the persistent #sidebar.
import { $, $$ } from './dom.js';

const KEY = {
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  ENTER: 13,
  ESC: 27, // Back when testing in a desktop browser
  BACK: 10009,
  IME_DONE: 65376,
  IME_CANCEL: 65385,
};

// Moving sideways costs more than moving straight, so focus prefers aligned elements.
const SIDE_WEIGHT = 2;

const views = {};
// Actions available from any view (e.g. sidebar entries).
const globalActions = {};
let current = null;

export function exitApp() {
  if (window.tizen) tizen.application.getCurrentApplication().exit();
}

/** actions: { [data-action]: (element) => void }, back: () => void, sidebar: boolean */
export function registerView(id, { actions = {}, back = exitApp, sidebar = false } = {}) {
  views[id] = { actions, back, sidebar };
}

export function registerGlobalActions(actions) {
  Object.assign(globalActions, actions);
}

export function setFocus(target) {
  if (!target) return;
  for (const node of $$('.focused')) node.classList.remove('focused');
  target.classList.add('focused');
  target.scrollIntoView({ block: 'nearest' });
}

export function show(id, focusTarget) {
  for (const view of $$('.view')) view.classList.toggle('active', view.id === id);
  current = id;
  setFocus(focusTarget || $(`#${id} [data-nav]`));
}

function center(node) {
  const rect = node.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Focuses the nearest visible element in the pressed direction. */
function move(key) {
  const own = `#${current} [data-nav]`;
  const selector = views[current].sidebar ? `${own}, #sidebar [data-nav]` : own;
  const candidates = $$(selector).filter((node) => node.offsetParent !== null);
  const focused = $('.focused');
  if (!focused || !candidates.includes(focused)) return setFocus(candidates[0]);

  const from = center(focused);
  const horizontal = key === KEY.LEFT || key === KEY.RIGHT;
  let best = null;
  let bestScore = Infinity;
  for (const node of candidates) {
    if (node === focused) continue;
    const to = center(node);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const ahead = { [KEY.LEFT]: -dx, [KEY.RIGHT]: dx, [KEY.UP]: -dy, [KEY.DOWN]: dy }[key];
    if (ahead <= 1) continue;
    const score = ahead + SIDE_WEIGHT * Math.abs(horizontal ? dy : dx);
    if (score < bestScore) {
      bestScore = score;
      best = node;
    }
  }
  setFocus(best);
}

/** Leaving a text field fires `submit-input` on it when the user confirmed. */
function finishTyping(input, submit) {
  input.blur();
  if (submit) input.dispatchEvent(new Event('submit-input'));
}

function onKeyDown(event) {
  const key = event.keyCode;
  const active = document.activeElement;
  const typing = active && active.tagName === 'INPUT';
  const focused = $('.focused');

  if (key === KEY.IME_DONE || key === KEY.IME_CANCEL) {
    if (typing) finishTyping(active, key === KEY.IME_DONE);
  } else if (key === KEY.ENTER) {
    if (typing) finishTyping(active, true);
    else if (focused && focused.tagName === 'INPUT')
      focused.focus(); // opens the TV keyboard
    else if (focused) focused.click();
  } else if (key >= KEY.LEFT && key <= KEY.DOWN) {
    if (typing && (key === KEY.LEFT || key === KEY.RIGHT)) return; // moves the text cursor
    if (typing) active.blur();
    move(key);
  } else if (key === KEY.BACK || key === KEY.ESC) {
    if (typing) active.blur();
    else views[current].back();
  } else {
    return;
  }
  event.preventDefault();
}

function onClick(event) {
  const target = event.target.closest('[data-nav]');
  if (!target) return;
  setFocus(target);
  const name = target.dataset.action;
  const action = views[current].actions[name] || globalActions[name];
  if (action) action(target);
}

export function startNavigation() {
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('click', onClick);
}
