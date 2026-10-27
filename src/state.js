// Shared mutable state: the saved settings and the data cache.
import { loadConfig } from './config.js';
import { createCache } from './data/cache.js';

export const state = { config: loadConfig(), cache: createCache() };
