/**
 * ActionDispatcher — the single, uniform way to execute assistant actions.
 *
 * Sits in the assistant layer, between the intent resolver (which decides
 * *what* to do) and the concrete effects (windows, DOM, app runtimes). It
 * exposes OS-level primitives and a generic `runCapability()` that invokes an
 * app's declared {@link import('./AssistantRegistry.js').Capability}.
 *
 * Replaces the scattered `window.__XApp` globals and the duplicated
 * dispatch/execute switches that used to live in VoiceCommandManager.
 *
 * @typedef {Object} ActionContext   Passed to every Capability.invoke().
 * @property {(id: string) => void}       openApp
 * @property {() => void}                 closeActive
 * @property {() => void}                 minimizeActive
 * @property {() => void}                 showDesktop
 * @property {(query: string) => void}    desktopSearch
 * @property {(urlOrQuery: string) => void} browse
 * @property {(message: string, type?: 'info'|'success'|'warning'|'error') => void} notify
 */

import { assistantRegistry } from './AssistantRegistry.js';

export class ActionDispatcher {
    /**
     * @param {{
     *   windowManager: import('../../platform/windowing/WindowManager.js').WindowManager,
     *   notifications: import('../../platform/services/NotificationManager.js').NotificationManager,
     *   registry?:     import('./AssistantRegistry.js').AssistantRegistry,
     * }} opts
     */
    constructor({ windowManager, notifications, registry = assistantRegistry }) {
        this._wm       = windowManager;
        this._notify   = notifications;
        this._registry = registry;
        this._ctx      = this._buildContext();
    }

    /** The context handed to every capability invocation. @returns {ActionContext} */
    _buildContext() {
        return {
            openApp:        (id)    => this._wm.openFile(id),
            closeActive:    ()      => this.closeActive(),
            minimizeActive: ()      => this.minimizeActive(),
            showDesktop:    ()      => this._wm.showDesktop(),
            desktopSearch:  (q)     => this.desktopSearch(q),
            browse:         (q)     => this.browse(q),
            notify:         (m, t)  => this._notify.show(m, t ?? 'info'),
        };
    }

    // ── OS-level primitives ───────────────────────────────────────────────────

    openApp(id) { this._wm.openFile(id); }

    closeActive() {
        const id = this._wm.activeWindowId;
        if (id) this._wm.closeWindow(id);
        return !!id;
    }

    minimizeActive() {
        const id = this._wm.activeWindowId;
        if (id) this._wm.minimizeWindow(id);
        return !!id;
    }

    showDesktop() { this._wm.showDesktop(); }

    /** Focus the taskbar search box and type a query. */
    desktopSearch(query) {
        const input = document.querySelector('.search-input');
        if (!input) return;
        input.closest('.search-box')?.classList.add('focused');
        input.focus();
        input.value = query ?? '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /** Open the browser window and navigate to a URL or web search. */
    async browse(urlOrQuery) {
        this._wm.openFile('browser');
        await new Promise(r => setTimeout(r, 500));
        const raw = urlOrQuery ?? '';
        const url = /^https?:\/\//i.test(raw)
            ? raw
            : `https://yep.com/web?q=${encodeURIComponent(raw)}`;
        document.dispatchEvent(new CustomEvent('andreos:browser-navigate', { detail: { url } }));
    }

    // ── Capability invocation ─────────────────────────────────────────────────

    /**
     * Wait until an app's runtime API is ready (per its profile `ready()`),
     * or resolve after the timeout. No-op for apps without a readiness probe.
     * @param {string} appId
     */
    waitForApp(appId, timeoutMs = 15_000) {
        if (this._registry.isReady(appId)) return Promise.resolve();
        return new Promise(resolve => {
            const deadline = Date.now() + timeoutMs;
            const poll = () => {
                if (this._registry.isReady(appId) || Date.now() > deadline) return resolve();
                setTimeout(poll, 200);
            };
            poll();
        });
    }

    /**
     * Invoke a declared app capability by id.
     * @param {string} appId @param {string} capId @param {Object} [args]
     * @returns {Promise<import('./AssistantRegistry.js').ActionResult>}
     */
    async runCapability(appId, capId, args = {}) {
        const cap = this._registry.capability(appId, capId);
        if (!cap) {
            console.warn(`[ActionDispatcher] unknown capability ${appId}.${capId}`);
            return { ok: false, message: 'unknown capability' };
        }
        const result = await cap.invoke(args, this._ctx);
        return result ?? { ok: true };
    }
}
