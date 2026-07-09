/**
 * App Catalog — registers every application's OS/window metadata.
 *
 * Importing this module (side effect) makes the app catalogue available to the
 * window manager and desktop search. It contains NO assistant/AI knowledge —
 * that lives in `../assistant/`.
 *
 * Registration order is significant: it drives desktop-search order and, via
 * the assistant layer, the "open app" keyword list and the LLM prompt's app
 * list. Keep the natural app order below.
 *
 * ➕ To add a new app: create a catalog entry file and register it here.
 */
import { appRegistry } from './AppRegistry.js';
import { contentApps } from './contentApps.js';
import { browserApp }  from './browserApp.js';
import { chatApp }     from './chatApp.js';
import { gameApp }     from './gameApp.js';
import { researchApp } from './researchApp.js';
import { settingsApp } from './settingsApp.js';
import { ironflowApp } from './ironflowApp.js';

// about, resume, projects, skills, contact, social
contentApps.forEach(app => appRegistry.register(app));

appRegistry.register(browserApp);
appRegistry.register(chatApp);
appRegistry.register(gameApp);
appRegistry.register(researchApp);
appRegistry.register(settingsApp);
appRegistry.register(ironflowApp);

export { appRegistry };
