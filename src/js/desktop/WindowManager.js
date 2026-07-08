/**
 * WindowManager
 *
 * Owns all open window state: creating, closing, minimising, maximising,
 * focus management, drag/resize, task view, and window switcher (Alt+Tab).
 *
 * Emits EventBus events for Taskbar (and anything else) to react to:
 *   window:created  { id, title }
 *   window:closed   { id, title }
 *   window:minimized { id }
 *   window:restored  { id }
 *   window:focused   { id }
 *   taskbar:update   {}
 */
import { getWindowIcon }  from './windowUtils.js';
import { getWindowData }  from '../content/AppContent.js';
import { ActiveContext }  from '../system/ActiveContext.js';

/** Strip HTML tags to plain text for ActiveContext. */
function _htmlToText(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
}

/** True for content windows whose text should be loaded into ActiveContext. */
function _isContentWindow(data) {
    return !data.isBrowser && !data.isChat && !data.isGame &&
           !data.isResearch && !data.isSettings;
}

export class WindowManager {
    /**
     * @param {{
     *   domCache:            object,
     *   eventBus:            import('../core/EventBus.js').EventBus,
     *   audioManager:        import('../system/AudioManager.js').AudioManager,
     *   windowSetupHandlers: { browser: Function, chat: Function, game: Function }
     * }} opts
     */
    constructor({ domCache, eventBus, audioManager, windowSetupHandlers }) {
        this._dom             = domCache;
        this._eventBus        = eventBus;
        this._audio           = audioManager;
        this._setupHandlers   = windowSetupHandlers;

        this._windows         = [];   // { id, element, title, isMaximized, prevRect? }
        this._activeWindowId  = null;
        this._windowCounter   = 0;
        this._windowZIndex    = 400;

        // Window switcher state
        this._switcherOpen    = false;
        this._switcherIndex   = 0;
        this._switcherEl      = null;

        // RAF batching for visual updates
        this._pendingUpdates  = new Set();
        this._rafPending      = false;
    }

    // ── Public read-only accessors ────────────────────────────────────────────

    get activeWindowId() { return this._activeWindowId; }
    get windows()        { return this._windows; }

    /** Returns the window record for a given id, or undefined. */
    getWindow(id) {
        return this._windows.find(w => w.id === id);
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /** Opens an app by file-type key. Prevents duplicate chat windows. */
    openFile(fileType) {
        if (fileType === 'chat') {
            const existing = this._windows.find(w => w.title === 'Ask André');
            if (existing) { this.setActiveWindow(existing.id); return; }
        }
        const data = getWindowData(fileType);
        if (data) this.createWindow(data);
    }

    createWindow(windowData) {
        const id     = `window-${++this._windowCounter}`;
        const offset = this._windows.length * 30;
        const left   = 100 + offset;
        const top    = 50  + offset;

        const el = document.createElement('div');
        el.className = 'window opening';
        el.id        = id;
        el.style.cssText = `
            left:${left}px; top:${top}px;
            width:${windowData.width}px; height:${windowData.height}px;
            transform:scale(0.3) rotate(-5deg) translateZ(0);
            opacity:0; will-change:transform,opacity;
        `;
        el.innerHTML = `
            <div class="window-header">
                <div class="window-title">${windowData.title}</div>
                <div class="window-controls">
                    <div class="window-control minimize" data-action="minimize">−</div>
                    <div class="window-control maximize" data-action="maximize">□</div>
                    <div class="window-control close"    data-action="close">×</div>
                </div>
            </div>
            <div class="window-content">${windowData.content}</div>
            <div class="window-resize-handle"></div>
        `;

        if (windowData.isBrowser)  el.classList.add('browser-window');
        if (windowData.isChat)     el.classList.add('chat-window-wrap');
        if (windowData.isGame)     el.classList.add('game-window-wrap');
        if (windowData.isIronFlow) el.classList.add('game-window-wrap');

        this._dom.windowsContainer?.appendChild(el);

        this._scheduleUpdate(() => {
            el.style.transform = 'scale(1) rotate(0deg) translateZ(0)';
            el.style.opacity   = '1';
            setTimeout(() => {
                el.style.willChange = 'auto';
                el.classList.remove('opening');
            }, 600);
        });

        this._windows.push({ id, element: el, title: windowData.title, isMaximized: false,
            _plainText: _isContentWindow(windowData) ? _htmlToText(windowData.content) : '' });
        this.setActiveWindow(id);

        this._setupWindowControls(el, id);
        this._makeWindowDraggable(el);
        this._makeWindowResizable(el);

        if (windowData.isBrowser)   this._setupHandlers.browser(el, windowData.startUrl ?? 'https://andreped.dev');
        if (windowData.isChat)      this._setupHandlers.chat(el);
        if (windowData.isGame)      this._setupHandlers.game(el);
        if (windowData.isResearch)  this._setupHandlers.research(el);
        if (windowData.isSettings)  this._setupHandlers.settings(el);
        if (windowData.isIronFlow)  this._setupHandlers.ironflow(el);

        this._audio.addSoundEffect('open');
        this._eventBus.emit('window:created', { id, title: windowData.title });
    }

    closeWindow(id) {
        const idx = this._windows.findIndex(w => w.id === id);
        if (idx === -1) return;

        const win = this._windows[idx];
        this._eventBus.emit('window:closed', { id, title: win.title });

        // Clear app context if this was the context window
        if (win._plainText) ActiveContext.clearAppContent();

        win.element.style.transition = 'all 0.3s cubic-bezier(0.4,0,0.2,1)';
        win.element.style.transform  = 'scale(0)';
        win.element.style.opacity    = '0';
        setTimeout(() => win.element.remove(), 300);

        this._windows.splice(idx, 1);

        if (this._windows.length > 0) {
            this.setActiveWindow(this._windows[this._windows.length - 1].id);
        } else {
            this._activeWindowId = null;
        }

        this._audio.addSoundEffect('close');
    }

    minimizeWindow(id) {
        const win = this.getWindow(id);
        if (!win) return;

        win.element.style.transition = 'all 0.4s cubic-bezier(0.4,0,0.2,1)';
        win.element.style.transform  = 'scale(0.1) translateY(200px)';
        win.element.style.opacity    = '0';
        setTimeout(() => {
            win.element.style.display    = 'none';
            win.element.style.transform  = '';
            win.element.style.opacity    = '';
            win.element.style.transition = '';
        }, 400);

        this._eventBus.emit('window:minimized', { id });

        if (this._activeWindowId === id) {
            const next = this._windows.find(w => w.id !== id && w.element.style.display !== 'none');
            this._activeWindowId = next?.id ?? null;
        }

        this._audio.addSoundEffect('minimize');
        this._eventBus.emit('taskbar:update', {});
    }

    restoreWindow(id) {
        const win = this.getWindow(id);
        if (!win) return;
        win.element.style.display = 'block';
        this._animateRestore(win.element);
        this._eventBus.emit('window:restored', { id });
    }

    toggleMaximizeWindow(id) {
        const win = this.getWindow(id);
        if (!win) return;
        const el     = win.element;
        const maxBtn = el.querySelector('.window-control.maximize');

        if (win.isMaximized) {
            if (win.prevRect) {
                el.style.left   = win.prevRect.left;
                el.style.top    = win.prevRect.top;
                el.style.width  = win.prevRect.width;
                el.style.height = win.prevRect.height;
            }
            el.classList.remove('maximized');
            win.isMaximized = false;
            if (maxBtn) maxBtn.textContent = '□';
        } else {
            win.prevRect = { left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height };
            el.style.left   = '0px';
            el.style.top    = '0px';
            el.style.width  = '100vw';
            el.style.height = 'calc(100vh - 56px)';
            el.classList.add('maximized');
            win.isMaximized = true;
            if (maxBtn) maxBtn.textContent = '❐';
        }
    }

    setActiveWindow(id) {
        this._windows.forEach(w => {
            w.element.style.zIndex = this._windowZIndex;
            w.element.classList.remove('active-window');
        });

        const win = this.getWindow(id);
        if (win) {
            this._windowZIndex++;
            win.element.style.zIndex = this._windowZIndex;
            win.element.classList.add('active-window');
            this._activeWindowId = id;

            // Update active context for the assistant
            if (win._plainText) {
                ActiveContext.setAppContent(win.title, win._plainText);
            }

            // Bubble active window to top of array (for "last window" logic)
            const idx = this._windows.indexOf(win);
            if (idx > -1) {
                this._windows.splice(idx, 1);
                this._windows.push(win);
            }

            this._applyFocusEffect(win.element);
            this._eventBus.emit('window:focused', { id });
        }
        this._eventBus.emit('taskbar:update', {});
    }

    showDesktop() {
        const hasVisible = this._windows.some(w => w.element.style.display !== 'none');
        if (hasVisible) {
            this._windows.forEach(w => { if (w.element.style.display !== 'none') this.minimizeWindow(w.id); });
        } else {
            this._windows.forEach(w => {
                if (w.element.style.display === 'none') {
                    this.restoreWindow(w.id);
                    this.setActiveWindow(w.id);
                }
            });
        }
    }

    showTaskView(onCloseCallback) {
        if (this._windows.length === 0) return false;

        const overlay = document.createElement('div');
        overlay.className = 'task-view-overlay';
        overlay.innerHTML = `
            <div class="task-view-container">
                <div class="task-view-header">
                    <h2>Task View</h2>
                    <button class="task-view-close">×</button>
                </div>
                <div class="task-view-grid">
                    ${this._windows.map(win => `
                        <div class="task-view-item" data-window-id="${win.id}">
                            <div class="task-view-thumbnail">
                                <div class="task-view-window-preview">${getWindowIcon(win.title)}</div>
                            </div>
                            <div class="task-view-title">${win.title}</div>
                            <div class="task-view-close-btn">×</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const remove = () => { overlay.remove(); onCloseCallback?.(); };
        overlay.querySelector('.task-view-close').addEventListener('click', remove);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) { remove(); return; }
            const item     = e.target.closest('.task-view-item');
            const closeBtn = e.target.closest('.task-view-close-btn');
            if (!item) return;
            const winId = item.dataset.windowId;
            if (closeBtn) {
                e.stopPropagation();
                this.closeWindow(winId);
                item.remove();
                if (this._windows.length === 0) remove();
            } else {
                this.setActiveWindow(winId);
                remove();
            }
        });

        document.addEventListener('keydown', function onEsc(e) {
            if (e.key === 'Escape') { remove(); document.removeEventListener('keydown', onEsc); }
        });

        return true;
    }

    // ── Window switcher (Ctrl+Tab) ────────────────────────────────────────────

    get switcherOpen() { return this._switcherOpen; }

    handleWindowSwitching(reverse = false) {
        const visible = this._windows.filter(w => w.element.style.display !== 'none');
        if (visible.length < 2) return;

        if (!this._switcherOpen) {
            this._showSwitcher(visible);
            this._switcherOpen  = true;
            this._switcherIndex = reverse ? visible.length - 1 : 1;
        } else {
            if (reverse) {
                this._switcherIndex = (this._switcherIndex - 1 + visible.length) % visible.length;
            } else {
                this._switcherIndex = (this._switcherIndex + 1) % visible.length;
            }
        }
        this._updateSwitcherSelection(visible);
    }

    finishWindowSwitching() {
        const visible = this._windows.filter(w => w.element.style.display !== 'none');
        if (this._switcherIndex < visible.length) {
            this.setActiveWindow(visible[this._switcherIndex].id);
        }
        this._switcherEl?.remove();
        this._switcherEl   = null;
        this._switcherOpen = false;
        this._switcherIndex = 0;
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    _setupWindowControls(el, id) {
        el.querySelectorAll('.window-control').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                switch (btn.dataset.action) {
                    case 'close':    this.closeWindow(id); break;
                    case 'minimize': this.minimizeWindow(id); break;
                    case 'maximize': this.toggleMaximizeWindow(id); break;
                }
            });
        });
        el.addEventListener('click', () => this.setActiveWindow(id));
    }

    _makeWindowDraggable(el) {
        const header = el.querySelector('.window-header');
        let isDragging = false, startX, startY, startLeft, startTop;

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.window-control')) return;
            isDragging = true;
            startX = e.clientX; startY = e.clientY;
            startLeft = parseInt(el.style.left, 10);
            startTop  = parseInt(el.style.top,  10);
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup',   onUp);
            e.preventDefault();
        });

        const onMove = (e) => {
            if (!isDragging) return;
            el.style.left = `${startLeft + e.clientX - startX}px`;
            el.style.top  = `${startTop  + e.clientY - startY}px`;
        };
        const onUp = () => {
            isDragging = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup',   onUp);
        };
    }

    _makeWindowResizable(el) {
        const handle = el.querySelector('.window-resize-handle');
        if (!handle) return;
        Object.assign(handle.style, {
            position: 'absolute', width: '18px', height: '18px',
            right: '2px', bottom: '2px', cursor: 'nwse-resize',
            zIndex: '420', background: 'rgba(102,126,234,0.15)',
            borderRadius: '4px', display: 'block',
        });

        let isResizing = false, startX, startY, startW, startH;

        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            isResizing = true;
            startX = e.clientX; startY = e.clientY;
            startW = parseInt(el.style.width,  10);
            startH = parseInt(el.style.height, 10);
            document.body.style.userSelect = 'none';
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup',   onUp);
        });

        const onMove = (e) => {
            if (!isResizing) return;
            el.style.width  = Math.max(400, startW + e.clientX - startX) + 'px';
            el.style.height = Math.max(300, startH + e.clientY - startY) + 'px';
        };
        const onUp = () => {
            isResizing = false;
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup',   onUp);
        };
    }

    _applyFocusEffect(el) {
        el.style.transition  = 'box-shadow 0.3s ease, transform 0.3s ease';
        el.style.boxShadow   = '0 20px 60px rgba(0,0,0,0.3),0 0 0 1px rgba(255,255,255,0.1),0 0 20px rgba(102,126,234,0.2)';
        el.style.transform   = 'scale(1.01)';
        setTimeout(() => { el.style.transform = 'scale(1)'; }, 300);
    }

    _animateRestore(el) {
        el.style.transition = 'all 0.4s cubic-bezier(0.4,0,0.2,1)';
        el.style.transform  = 'scale(0.9) translateY(20px)';
        el.style.opacity    = '0.8';
        setTimeout(() => {
            el.style.transform = 'scale(1) translateY(0)';
            el.style.opacity   = '1';
            setTimeout(() => { el.style.transition = ''; }, 400);
        }, 50);
    }

    _showSwitcher(windows) {
        this._switcherEl = document.createElement('div');
        this._switcherEl.className = 'window-switcher';
        this._switcherEl.innerHTML = `
            <div class="switcher-container">
                <div class="switcher-header">
                    <h3>Switch Windows (Ctrl+Tab)</h3>
                    <p>Use arrow keys or Ctrl+Tab to navigate, Enter to select</p>
                </div>
                <div class="switcher-windows">
                    ${windows.map((win, i) => `
                        <div class="switcher-window ${i === 0 ? 'selected' : ''}" data-window-id="${win.id}">
                            <div class="switcher-preview">
                                <div class="preview-content">${getWindowIcon(win.title)}</div>
                            </div>
                            <div class="switcher-title">${win.title}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(this._switcherEl);
    }

    _updateSwitcherSelection(windows) {
        this._switcherEl?.querySelectorAll('.switcher-window').forEach((el, i) => {
            el.classList.toggle('selected', i === this._switcherIndex);
        });
        const target = windows[this._switcherIndex];
        if (target) {
            target.element.style.zIndex  = 1300;
            target.element.style.opacity = '0.8';
            setTimeout(() => {
                if (!this._switcherOpen) target.element.style.opacity = '1';
            }, 200);
        }
    }

    _scheduleUpdate(fn) {
        this._pendingUpdates.add(fn);
        if (!this._rafPending) {
            this._rafPending = true;
            requestAnimationFrame(() => {
                this._pendingUpdates.forEach(f => f());
                this._pendingUpdates.clear();
                this._rafPending = false;
            });
        }
    }
}
