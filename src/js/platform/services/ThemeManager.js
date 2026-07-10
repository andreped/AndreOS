/**
 * ThemeManager — applies the user's Appearance choice to the whole OS.
 *
 * The preference lives in Settings under `theme` ('light' | 'dark' | 'system').
 * We resolve it to a concrete `light`/`dark` value and write it to
 * `<html data-theme="…">`, which every app reads through the CSS design tokens
 * defined at the top of styles.css.
 *
 * Light is the default. 'system' follows the OS `prefers-color-scheme`.
 */
import { getTheme, saveSettings } from './Settings.js';

const THEME_CHANGE_EVENT = 'andreos:theme-change';

let mediaQuery = null;

function resolve(pref) {
    if (pref === 'system') {
        return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return pref === 'dark' ? 'dark' : 'light';
}

/** Write the resolved theme onto <html>. Called on boot and whenever it changes. */
export function applyTheme(pref = getTheme()) {
    const resolved = resolve(pref);
    document.documentElement.setAttribute('data-theme', resolved);
    return resolved;
}

/** Persist a new preference and apply it immediately. */
export function setTheme(pref) {
    saveSettings({ theme: pref });
    const resolved = applyTheme(pref);
    document.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { pref, resolved } }));
    watchSystem(pref);
    return resolved;
}

/** Keep the theme in sync with the OS when the user picked 'system'. */
function watchSystem(pref) {
    if (!window.matchMedia) return;
    if (!mediaQuery) mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.onchange = (pref === 'system')
        ? () => { applyTheme('system'); document.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { pref: 'system', resolved: resolve('system') } })); }
        : null;
}

/** Initialise on boot: apply the stored preference and wire up system tracking. */
export function initTheme() {
    const pref = getTheme();
    applyTheme(pref);
    watchSystem(pref);
    return pref;
}

export { THEME_CHANGE_EVENT };
