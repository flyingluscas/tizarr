// UI translations. Markup uses data-i18n / data-i18n-placeholder; code uses t().
import { $$ } from './dom.js';
import en from './strings/en.js';
import ptBR from './strings/pt-BR.js';

export const LANGUAGES = {
  en: { label: 'English', strings: en },
  'pt-BR': { label: 'Português (Brasil)', strings: ptBR },
};

let strings = en;

export function setLanguage(code) {
  strings = (LANGUAGES[code] || LANGUAGES.en).strings;
}

/** t('status.partial', { have: 3, total: 10 }) → "3/10 episodes". Falls back to English. */
export function t(key, vars) {
  const text = strings[key] ?? en[key] ?? key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? vars[name] : match));
}

export function translatePage(root = document) {
  for (const node of $$('[data-i18n]', root)) node.textContent = t(node.dataset.i18n);
  for (const node of $$('[data-i18n-placeholder]', root)) {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  }
}
