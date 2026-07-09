/**
 * ActiveContext — the on-screen context broker.
 *
 * Tracks which app window is currently focused and delegates to that app's
 * declared context provider (its assistant profile's `context`). The window
 * manager sets the active app on focus; chat.js reads getContextBlock(query)
 * when building the LLM system prompt.
 *
 * Each app owns how it exposes context: static content apps chunk their own
 * rendered text, the Research app exposes the paper being viewed, and apps with
 * no provider contribute nothing. Nothing here knows about any specific app.
 */
import { assistantRegistry } from '../registry/AssistantRegistry.js';

let _activeAppId = null;

export const ActiveContext = {
    /** Called by the window manager when a window gains focus. */
    setActiveApp(appId) { _activeAppId = appId ?? null; },

    /**
     * Clear the active app. When an id is given, only clears if it is the
     * currently active one (so closing a background window is a no-op).
     */
    clearActiveApp(appId) {
        if (!appId || _activeAppId === appId) _activeAppId = null;
    },

    /**
     * LLM-ready context block for the focused app, or '' when there is none.
     * @param {string} query — the user's message, used for passage retrieval
     * @returns {string}
     */
    getContextBlock(query = '') {
        const provider = assistantRegistry.get(_activeAppId)?.context;
        return provider?.getContextBlock ? provider.getContextBlock(query) : '';
    },
};
