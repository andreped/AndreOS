/**
 * Apps module entry point — one place that registers every app.
 *
 * Each app is a self-contained folder exporting a `catalog` entry (OS/window
 * metadata) and, if it's AI-accessible, a `profile` (how the assistant drives
 * it). This file wires them into the two registries:
 *   • AppRegistry       — the App Catalog (what apps exist, how they render).
 *   • AssistantRegistry — the AI layer (recognise + act). Apps with no profile
 *     stay invisible to the assistant.
 *
 * Registration order is significant: it drives desktop-search order, the
 * "open app" keyword list, and the LLM prompt's app list. Keep the natural
 * order below.
 *
 * ➕ To add an app: create `apps/<app>/index.js` (+ optional window.js) and add
 *    it to the list below.
 */
import { appRegistry }       from './registry/AppRegistry.js';
import { assistantRegistry } from '../assistant/registry/AssistantRegistry.js';

import * as about    from './about/index.js';
import * as resume   from './resume/index.js';
import * as projects from './projects/index.js';
import * as skills   from './skills/index.js';
import * as contact  from './contact/index.js';
import * as social   from './social/index.js';
import * as browser  from './browser/index.js';
import * as chat     from './chat/index.js';
import * as game     from './game/index.js';
import * as research from './research/index.js';
import * as settings from './settings/index.js';
import * as ironflow from './ironflow/index.js';

/** Registration order = natural app order. */
const apps = [
    about, resume, projects, skills, contact, social,
    browser, chat, game, research, settings, ironflow,
];

for (const app of apps) {
    appRegistry.register(app.catalog);
    if (app.profile) assistantRegistry.register(app.profile);
}

export { appRegistry, assistantRegistry };
