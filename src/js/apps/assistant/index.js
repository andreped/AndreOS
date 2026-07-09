/**
 * Assistant profile catalog — registers how the AI understands each app.
 *
 * Importing this module (side effect) makes every app's language matching and
 * capabilities available to the assistant. Registration order mirrors the App
 * Catalog so keyword/prompt orderings stay stable.
 *
 * ➕ To make a new app AI-accessible: add its catalog entry, then register a
 *    profile here. Apps without a profile exist in the OS but are invisible to
 *    the assistant — a clean, deliberate separation.
 */
import { assistantRegistry } from './AssistantRegistry.js';
import { contentProfiles }   from './profiles/contentApps.js';
import { browserProfile }    from './profiles/browser.js';
import { chatProfile }       from './profiles/chat.js';
import { gameProfile }       from './profiles/game.js';
import { researchProfile }   from './profiles/research.js';
import { settingsProfile }   from './profiles/settings.js';

// about, resume, projects, skills, contact, social
contentProfiles.forEach(p => assistantRegistry.register(p));

assistantRegistry.register(browserProfile);
assistantRegistry.register(chatProfile);
assistantRegistry.register(gameProfile);
assistantRegistry.register(researchProfile);
assistantRegistry.register(settingsProfile);
// (ironflow ships no profile — openable by the OS, not by the assistant.)

export { assistantRegistry };
