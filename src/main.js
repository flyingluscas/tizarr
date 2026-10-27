// Entry point: applies settings, wires the screens together and opens the first one.
import { isConfigValid } from './config.js';
import { $ } from './dom.js';
import { setLanguage, translatePage } from './i18n.js';
import { startNavigation } from './nav.js';
import { initRouter, openScreen } from './router.js';
import { initDetails } from './screens/details.js';
import { initLibrary } from './screens/library.js';
import { initSearch } from './screens/search.js';
import { initSettings } from './screens/settings.js';
import { fitStageToWindow } from './stage.js';
import { state } from './state.js';
import { renderIcons } from './ui/icons.js';

fitStageToWindow($('#stage'));
setLanguage(state.config.app.language);
translatePage();
renderIcons();

initRouter();
initSettings();
initSearch();
initLibrary();
initDetails();
startNavigation();

openScreen(isConfigValid(state.config) ? 'library' : 'settings');
