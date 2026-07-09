/**
 * Sets up the interactive browser chrome inside a browser window element.
 * @param {HTMLElement} winEl    - The window's root element.
 * @param {string}      startUrl - The initial URL to navigate to.
 */
export function setupBrowserWindow(winEl, startUrl) {
    const iframe      = winEl.querySelector('.browser-iframe');
    const urlBar      = winEl.querySelector('.url-bar');
    const backBtn     = winEl.querySelector('.back-btn');
    const fwdBtn      = winEl.querySelector('.fwd-btn');
    const reloadBtn   = winEl.querySelector('.reload-btn');
    const newtabBtn   = winEl.querySelector('.newtab-btn');
    const blocked     = winEl.querySelector('.browser-blocked');
    const loading     = winEl.querySelector('.browser-loading');
    const blockedLink = winEl.querySelector('.blocked-newtab');

    if (!iframe) return;

    const nav = { history: [], index: -1 };

    const normaliseUrl = (raw) => {
        const s = raw.trim();
        if (!s) return '';
        if (/^https?:\/\//i.test(s)) return s;
        if (/^[\w-]+\.\w{2,}/.test(s)) return 'https://' + s;
        return 'https://yep.com/web?q=' + encodeURIComponent(s);
    };

    const load = (url) => {
        if (urlBar)      urlBar.value   = url;
        if (newtabBtn)   newtabBtn.href = url;
        if (blockedLink) blockedLink.href = url;
        if (blocked)  blocked.style.display = 'none';
        if (loading)  loading.style.display = 'flex';
        iframe.src = url;
        if (backBtn) backBtn.disabled = nav.index <= 0;
        if (fwdBtn)  fwdBtn.disabled  = nav.index >= nav.history.length - 1;
    };

    const navigate = (url) => {
        if (!url) return;
        nav.history = nav.history.slice(0, nav.index + 1);
        nav.history.push(url);
        nav.index = nav.history.length - 1;
        load(url);
    };

    iframe.addEventListener('load', () => {
        if (loading) loading.style.display = 'none';
        try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            const isBlocked = !doc || !doc.body || doc.body.innerHTML.trim() === '';
            if (blocked) blocked.style.display = isBlocked ? 'flex' : 'none';
        } catch (_) {
            // Cross-origin success — page loaded fine
            if (blocked) blocked.style.display = 'none';
        }
    });

    if (backBtn) backBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (nav.index > 0) { nav.index--; load(nav.history[nav.index]); }
    });

    if (fwdBtn) fwdBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (nav.index < nav.history.length - 1) { nav.index++; load(nav.history[nav.index]); }
    });

    if (reloadBtn) reloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // eslint-disable-next-line no-self-assign
        iframe.src = iframe.src;
    });

    if (urlBar) {
        urlBar.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.stopPropagation(); navigate(normaliseUrl(urlBar.value)); }
        });
        urlBar.addEventListener('click',     (e) => { e.stopPropagation(); urlBar.select(); });
        urlBar.addEventListener('mousedown', (e) => e.stopPropagation());
    }

    winEl.querySelectorAll('.bm-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            e.stopPropagation();
            navigate(chip.dataset.url);
        });
    });

    // Voice-command navigation: VoiceCommandManager dispatches this event
    const onVoiceNavigate = (e) => {
        if (!document.contains(winEl)) {
            document.removeEventListener('andreos:browser-navigate', onVoiceNavigate);
            return;
        }
        navigate(e.detail?.url ?? '');
    };
    document.addEventListener('andreos:browser-navigate', onVoiceNavigate);

    navigate(startUrl);
}
