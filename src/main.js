// Entry point: wires the views together and opens the first screen.
import { isConfigValid } from './config.js';
import { show, startNavigation } from './nav.js';
import { state } from './state.js';
import { initDetails } from './views/details.js';
import { initSearch } from './views/search.js';
import { initSettings, openSettings } from './views/settings.js';

initSettings();
initSearch();
initDetails();
startNavigation();

if (isConfigValid(state.config)) show('search');
else openSettings();
