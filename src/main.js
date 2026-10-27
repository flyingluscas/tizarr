// Entry point: applies settings, wires the screens together and opens the first one.
import { isConfigValid } from './config.js';
import { $ } from './dom.js';
import { setLanguage, translatePage } from './i18n.js';
import { startNavigation } from './nav.js';
import { initRouter, openScreen } from './router.js';
import { initBrowse } from './screens/browse.js';
import { initDetails } from './screens/details.js';
import { initDownloads } from './screens/downloads.js';
import { initLibrary } from './screens/library.js';
import { initSearch } from './screens/search.js';
import { initSettings } from './screens/settings.js';
import { fitStageToWindow } from './stage.js';
import { state } from './state.js';
import { initDialog } from './ui/dialog.js';
import { renderIcons } from './ui/icons.js';

fitStageToWindow($('#stage'));
setLanguage(state.config.app.language);
translatePage();
renderIcons();

initRouter();
initSettings();
initBrowse();
initSearch();
initLibrary();
initDetails();
initDownloads();
initDialog();
startNavigation();

openScreen(isConfigValid(state.config) ? 'home' : 'settings');
