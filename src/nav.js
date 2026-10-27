// Remote-control navigation: focus handling, arrow movement, Enter/Back and view switching.
// Each view registers its click actions and Back behaviour; this module routes keys to them.
// Views flagged `sidebar` also let focus move into the persistent #sidebar.
import { $, $$ } from './dom.js';
import { pickNext } from './spatial.js';

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

// Keep the focused element this far (design px) from the top/bottom edge of its screen.
const SCROLL_MARGIN = 160;

/**
 * Scrolls the screen so the focused element sits comfortably inside it, and all the way to the
 * top/bottom at the first/last element so headings and footers are not cut off. The stage is
 * CSS-scaled, so rect distances are converted back to unscaled scroll pixels.
 */
function scrollIntoComfort(target) {
  const view = target.closest('.view');
  if (!view) return;
  const items = $$('[data-nav]', view).filter((node) => node.offsetParent !== null);
  if (target === items[0]) {
    view.scrollTop = 0;
    return;
  }
  if (target === items[items.length - 1]) {
    view.scrollTop = view.scrollHeight;
    return;
  }
  const viewRect = view.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  const scale = viewRect.height / view.clientHeight || 1;
  const above = (rect.top - viewRect.top) / scale - SCROLL_MARGIN;
  const below = (viewRect.bottom - rect.bottom) / scale - SCROLL_MARGIN;
  if (above < 0) view.scrollTop += above;
  else if (below < 0) view.scrollTop -= below;
}

export function setFocus(target) {
  if (!target) return;
  for (const node of $$('.focused')) node.classList.remove('focused');
  target.classList.add('focused');
  scrollIntoComfort(target);
}

export function show(id, focusTarget) {
  for (const view of $$('.view')) view.classList.toggle('active', view.id === id);
  current = id;
  setFocus(focusTarget || $(`#${id} [data-nav]`));
}

const DIRECTIONS = { [KEY.LEFT]: 'left', [KEY.RIGHT]: 'right', [KEY.UP]: 'up', [KEY.DOWN]: 'down' };

/** Focuses the nearest visible element in the pressed direction (see spatial.js). */
function move(key) {
  const own = `#${current} [data-nav]`;
  const selector = views[current].sidebar ? `${own}, #sidebar [data-nav]` : own;
  const candidates = $$(selector).filter((node) => node.offsetParent !== null);
  const focused = $('.focused');
  if (!focused || !candidates.includes(focused)) return setFocus(candidates[0]);

  const others = candidates.filter((node) => node !== focused);
  const rects = others.map((node) => node.getBoundingClientRect());
  const next = pickNext(DIRECTIONS[key], focused.getBoundingClientRect(), rects);
  if (next >= 0) setFocus(others[next]);
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
