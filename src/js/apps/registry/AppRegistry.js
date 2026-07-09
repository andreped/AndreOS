/**
 * AppRegistry — the App Catalog. The single source of truth for what apps
 * *exist* in the OS and how they render: identity, icon, window spec, and
 * desktop-search presence.
 *
 * Clean-architecture note: this is the OS/catalog layer. It knows NOTHING about
 * the assistant or AI. The window manager, desktop, and search read from here.
 * The assistant layer (`../assistant/`) depends on this catalog — never the
 * other way around.
 *
 * @typedef {'content'|'browser'|'chat'|'game'|'ironflow'|'research'|'settings'} AppKind
 *
 * @typedef {Object} WindowSpec
 * @property {number}   width
 * @property {number}   height
 * @property {() => string} render   Returns the window's HTML content (called fresh on each open).
 * @property {string}  [startUrl]    Browser apps only.
 *
 * @typedef {Object} SearchSpec
 * @property {string}  subtitle
 * @property {string}  keywords      Space-separated search terms.
 * @property {string}  [icon]        Overrides the app icon in search results.
 *
 * @typedef {Object} AppManifest    A catalog entry — pure OS/window metadata.
 * @property {string}     id         Stable key (e.g. 'research'). Also the window "fileType".
 * @property {string}     name       Human label (e.g. 'Research').
 * @property {string}     title      Window title-bar text.
 * @property {string}     icon       Emoji icon.
 * @property {AppKind}    kind
 * @property {WindowSpec} window
 * @property {boolean}    [launchable]  Can be opened by name. Default true.
 * @property {boolean}    [searchable]  Appears in desktop search. Default = launchable.
 * @property {SearchSpec} [search]      Desktop-search metadata (required when searchable).
 */

export class AppRegistry {
    constructor() {
        /** @type {Map<string, AppManifest>} insertion order is significant */
        this._apps = new Map();
    }

    /**
     * Register a catalog entry.
     * @param {AppManifest} manifest
     * @returns {AppManifest}
     */
    register(manifest) {
        if (!manifest?.id) throw new Error('[AppRegistry] manifest.id is required');
        if (this._apps.has(manifest.id)) {
            console.warn(`[AppRegistry] "${manifest.id}" already registered — overwriting`);
        }
        const normalised = {
            launchable: true,
            searchable: manifest.searchable ?? (manifest.launchable ?? true),
            ...manifest,
        };
        this._apps.set(normalised.id, normalised);
        return normalised;
    }

    /** @param {string} id @returns {AppManifest|null} */
    get(id) { return this._apps.get(id) ?? null; }

    /** @param {string} id */
    has(id) { return this._apps.has(id); }

    /** All catalog entries in registration order. @returns {AppManifest[]} */
    all() { return [...this._apps.values()]; }

    /** Apps that can be opened by name. @returns {AppManifest[]} */
    launchable() { return this.all().filter(a => a.launchable !== false); }

    /** Apps shown in desktop search. @returns {AppManifest[]} */
    searchable() { return this.all().filter(a => a.searchable); }

    /**
     * Produce the legacy window-data object consumed by WindowManager.
     * @param {string} id
     * @returns {object|null}
     */
    toWindowData(id) {
        const m = this.get(id);
        if (!m) return null;
        const base = {
            title:   m.title,
            content: m.window.render(),
            width:   m.window.width,
            height:  m.window.height,
            setup:   m.window.setup,
        };
        switch (m.kind) {
            case 'browser':  return { ...base, isBrowser: true, startUrl: m.window.startUrl };
            case 'chat':     return { ...base, isChat: true };
            case 'game':     return { ...base, isGame: true };
            case 'ironflow': return { ...base, isIronFlow: true };
            case 'research': return { ...base, isResearch: true };
            case 'settings': return { ...base, isSettings: true };
            default:         return base;
        }
    }

    /** Human label for an app id (falls back to the id itself). */
    label(id) { return this.get(id)?.name ?? id; }

    /** Map of id → label for all launchable apps. */
    labels() {
        return Object.fromEntries(this.launchable().map(m => [m.id, m.name]));
    }
}

/** Shared catalog singleton. */
export const appRegistry = new AppRegistry();
