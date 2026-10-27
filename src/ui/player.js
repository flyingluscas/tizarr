// Full-screen trailer player (YouTube embed). The iframe never takes focus, so the remote's
// keys stay with Tizarr: Back closes the player and returns where it was opened.
import { embedUrl } from '../data/trailers.js';
import { $ } from '../dom.js';
import { currentView, registerView, show } from '../nav.js';

let returnView = null;
let returnFocus = null;

function close() {
  // Unloading the iframe stops playback and sound.
  $('#player-frame').src = 'about:blank';
  show(returnView, returnFocus && returnFocus.isConnected ? returnFocus : null);
}

export function playTrailer(youtubeId) {
  const url = embedUrl(youtubeId);
  if (!url) return;
  returnView = currentView();
  returnFocus = $('.focused');
  $('#player-frame').src = url;
  show('player');
}

export function initPlayer() {
  registerView('player', { back: close });
}
