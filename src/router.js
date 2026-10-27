// Screen switching: sidebar screens, the Details overlay, and where Back goes.
import { $, $$ } from './dom.js';
import { exitApp, registerGlobalActions, registerView, setFocus, show } from './nav.js';

const onOpenHandlers = {};
let currentScreen = null;
// Card to refocus when the overlay closes.
let overlayReturnFocus = null;

/** Back on a screen: first jump to the sidebar, then exit from there. */
function backFromScreen() {
  const active = $('#sidebar .active');
  if ($('#sidebar .focused')) exitApp();
  else setFocus(active);
}

export function registerScreen(id, { actions, onOpen } = {}) {
  onOpenHandlers[id] = onOpen;
  registerView(id, { actions, sidebar: true, back: backFromScreen });
}

export function openScreen(id) {
  currentScreen = id;
  for (const item of $$('#sidebar [data-screen]')) {
    item.classList.toggle('active', item.dataset.screen === id);
  }
  // Render first so the initial focus lands on real content.
  if (onOpenHandlers[id]) onOpenHandlers[id]();
  show(id);
}

/** Overlays (Details) cover the current screen but keep the sidebar reachable. */
/** Re-opens the current screen so it reloads its data (e.g. after deleting a title). */
export function refreshScreen() {
  openScreen(currentScreen);
}

export function registerOverlay(id, { actions, back = closeOverlay } = {}) {
  registerView(id, { actions, sidebar: true, back });
}

export function openOverlay(id, returnFocus) {
  overlayReturnFocus = returnFocus;
  show(id);
}

export function closeOverlay() {
  const target = overlayReturnFocus && overlayReturnFocus.isConnected ? overlayReturnFocus : null;
  show(currentScreen, target);
}

export function initRouter() {
  registerGlobalActions({ go: (item) => openScreen(item.dataset.screen) });
}
