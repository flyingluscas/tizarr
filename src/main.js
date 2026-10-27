// Entry point: wires the views together and opens the first screen.
import { isConfigValid } from './config.js';
import { $ } from './dom.js';
import { show, startNavigation } from './nav.js';
import { fitStageToWindow } from './stage.js';
import { state } from './state.js';
import { initDetails } from './views/details.js';
import { initSearch } from './views/search.js';
import { initSettings, openSettings } from './views/settings.js';

fitStageToWindow($('#stage'));
initSettings();
initSearch();
initDetails();
startNavigation();

if (isConfigValid(state.config)) show('search');
else openSettings();
