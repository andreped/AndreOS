/**
 * AssistantRegistry — the AI-awareness layer.
 *
 * Where the App Catalog says what apps *exist*, this registry says how the
 * assistant *perceives and drives* them: how to recognise an app from natural
 * language (`match`, `voiceKeywords`), what actions it can invoke
 * (`capabilities`), and what on-screen context it can read (`context`).
 *
 * Clean-architecture note: this layer depends on the App Catalog (it references
 * apps by id and reads their launchable flag / label), but the catalog never
 * depends on this. An app that ships no profile simply isn't AI-accessible.
 *
 * @typedef {Object} ActionResult
 * @property {boolean} ok
 * @property {string}  [message]
 *
 * @typedef {Object} Capability   An action the assistant can perform in an app.
 * @property {string}   id                        Unique within the app (e.g. 'openPaper').
 * @property {string}   description               Natural-language description for the LLM.
 * @property {'global'|'when-active'} scope       'when-active' actions are only offered when the app is focused.
 * @property {Object}   [params]                  Human-readable param schema, e.g. { n: 'integer (1-based)' }.
 * @property {string[]} [examples]                Few-shot example utterances.
 * @property {(args: Object, ctx: import('./ActionDispatcher.js').ActionContext) => (ActionResult|void|Promise<ActionResult|void>)} invoke
 *
 * @typedef {Object} ContextProvider
 * @property {(query: string) => string} [getContextBlock]   RAG-ready text for the LLM system prompt.
 * @property {() => Object}              [getState]          Structured snapshot of the app's UI state.
 *
 * @typedef {Object} AssistantProfile   How the assistant understands one app.
 * @property {string}          appId        The catalog app this profile describes.
 * @property {RegExp}          [match]      Resolves a spoken/typed name to this app.
 * @property {string[]}        [voiceKeywords] Keyword phrases that open this app (fast, offline layer).
 * @property {Capability[]}    [capabilities]
 * @property {ContextProvider} [context]
 * @property {() => boolean}   [ready]      True once the app's runtime API is available (for sequencing).
 */

import { appRegistry } from '../../apps/registry/AppRegistry.js';

export class AssistantRegistry {
    /** @param {import('../catalog/AppRegistry.js').AppRegistry} catalog */
    constructor(catalog = appRegistry) {
        this._catalog  = catalog;
        /** @type {Map<string, AssistantProfile>} insertion order is significant */
        this._profiles = new Map();
    }

    /**
     * Register an app's assistant profile.
     * @param {AssistantProfile} profile
     * @returns {AssistantProfile}
     */
    register(profile) {
        if (!profile?.appId) throw new Error('[AssistantRegistry] profile.appId is required');
        const normalised = { voiceKeywords: [], capabilities: [], ...profile };
        this._profiles.set(normalised.appId, normalised);
        return normalised;
    }

    /** @param {string} appId @returns {AssistantProfile|null} */
    get(appId) { return this._profiles.get(appId) ?? null; }

    /** All profiles in registration order. @returns {AssistantProfile[]} */
    all() { return [...this._profiles.values()]; }

    /** True once the app's runtime API is ready (per its `ready()` probe). */
    isReady(appId) {
        const probe = this.get(appId)?.ready;
        return probe ? !!probe() : true;
    }

    // ── Language understanding ────────────────────────────────────────────────

    /**
     * Resolve a spoken/typed app name to an app id, or null.
     * Tested in registration order; only launchable apps match.
     * @param {string} name
     * @returns {string|null}
     */
    resolveId(name) {
        const n = String(name ?? '').toLowerCase().trim();
        if (!n) return null;
        for (const p of this._profiles.values()) {
            if (this._catalog.get(p.appId)?.launchable === false) continue;
            if (p.match?.test(n)) return p.appId;
        }
        return null;
    }

    /**
     * The "open app" entries for the assistant's fast keyword layer.
     * Joins the catalog's launchable flag with each profile's voiceKeywords.
     * @returns {{ intent: 'open', args: { fileType: string }, keywords: string[] }[]}
     */
    openCommands() {
        const out = [];
        for (const p of this._profiles.values()) {
            if (this._catalog.get(p.appId)?.launchable === false) continue;
            if (p.voiceKeywords?.length) {
                out.push({ intent: 'open', args: { fileType: p.appId }, keywords: p.voiceKeywords });
            }
        }
        return out;
    }

    // ── Capability queries ────────────────────────────────────────────────────

    /**
     * Look up a single capability.
     * @param {string} appId @param {string} capId @returns {Capability|null}
     */
    capability(appId, capId) {
        return this.get(appId)?.capabilities?.find(c => c.id === capId) ?? null;
    }

    /**
     * Capabilities available in a given scope.
     * @param {{ activeAppId?: string|null }} [opts]
     * @returns {{ appId: string, capability: Capability }[]}
     */
    capabilities({ activeAppId = null } = {}) {
        const out = [];
        for (const p of this._profiles.values()) {
            for (const cap of p.capabilities ?? []) {
                if (cap.scope === 'global' || (cap.scope === 'when-active' && p.appId === activeAppId)) {
                    out.push({ appId: p.appId, capability: cap });
                }
            }
        }
        return out;
    }
}

/** Shared assistant singleton — depends on the catalog singleton. */
export const assistantRegistry = new AssistantRegistry(appRegistry);
