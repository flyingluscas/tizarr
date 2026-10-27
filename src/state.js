// The only shared mutable state: the saved server settings.
import { loadConfig } from './config.js';

export const state = { config: loadConfig() };
