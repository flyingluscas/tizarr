// Full-screen choice/confirmation for destructive actions. Focus starts on the first option
// (always the safe one, e.g. Cancel); Back answers null. Nothing else is reachable meanwhile.
import { $, el } from '../dom.js';
import { currentView, registerView, show } from '../nav.js';

let resolveAnswer = null;
let returnView = null;
let returnFocus = null;

function finish(answer) {
  const resolve = resolveAnswer;
  resolveAnswer = null;
  show(returnView, returnFocus && returnFocus.isConnected ? returnFocus : null);
  if (resolve) resolve(answer);
}

/**
 * ask({ title, message, options: [{ id, label, danger }] }) → Promise<id | null>.
 * Put the safe option first: it gets the initial focus.
 */
export function ask({ title, message, options }) {
  returnView = currentView();
  returnFocus = $('.focused');
  $('#dialog-title').textContent = title;
  $('#dialog-message').textContent = message || '';
  const buttons = $('#dialog-buttons');
  buttons.textContent = '';
  for (const option of options) {
    const button = el('button', option.danger ? 'danger' : '', option.label);
    button.dataset.nav = '';
    button.dataset.action = 'answer';
    button.dataset.answer = option.id;
    buttons.appendChild(button);
  }
  show('dialog', buttons.firstChild);
  return new Promise((resolve) => {
    resolveAnswer = resolve;
  });
}

export function initDialog() {
  registerView('dialog', {
    actions: { answer: (button) => finish(button.dataset.answer) },
    back: () => finish(null),
  });
}
