// Tiny DOM helpers shared by the views.

export const $ = (selector, root = document) => root.querySelector(selector);

export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function setStatus(node, text, isError = false) {
  node.textContent = text;
  node.classList.toggle('error', isError);
}
