/**
 * Taskbar
 *
 * Manages taskbar item DOM, window grouping, previews, and context menus.
 * Listens to window lifecycle events via EventBus and calls back into
 * WindowManager for user-initiated actions (click, context menu).
 *
 * App identity (type + icon) arrives on the window lifecycle events, sourced
 * from the App Registry — the taskbar never guesses it from the title.
 */

export class Taskbar {
    /**
     * @param {{ domCache: object, eventBus: import('../core/EventBus.js').EventBus, windowManager: import('../windowing/WindowManager.js').WindowManager }} opts
     */
    constructor({ domCache, eventBus, windowManager }) {
        this._dom           = domCache;
        this._eventBus      = eventBus;
        this._windowManager = windowManager;
        this._groupedApps   = new Map(); // appType → { element, windows: string[], title }

        this._subscribeToEvents();
    }

    /** Apply will-change / GPU-compositing hints to the taskbar element. */
    enhance() {
        const { taskbar } = this._dom;
        if (!taskbar) return;
        taskbar.classList.add('enhanced');
        taskbar.style.willChange       = 'backdrop-filter, box-shadow';
        taskbar.style.transform        = 'translateZ(0)';
        taskbar.style.backfaceVisibility = 'hidden';
    }

    // ── EventBus subscriptions ────────────────────────────────────────────────

    _subscribeToEvents() {
        const eb = this._eventBus;
        eb.on('window:created',   ({ id, title, appType, icon, iconSvg }) => this._addItem(id, title, appType, icon, iconSvg));
        eb.on('window:closed',    ({ id })         => this._removeItem(id));
        eb.on('window:minimized', ({ id })         => this._setItemState(id, true));
        eb.on('window:restored',  ({ id })         => this._setItemState(id, false));
        eb.on('window:focused',   ()               => this._syncActiveState());
        eb.on('taskbar:update',   ()               => this._syncActiveState());
    }

    // ── Private: add / remove / state ────────────────────────────────────────

    _addItem(windowId, title, appType, icon, iconSvg) {
        const taskbarItems = this._dom.taskbarItems;
        if (!taskbarItems) return;

        const existingGroup = this._groupedApps.get(appType);

        if (existingGroup?.windows.length > 0) {
            existingGroup.windows.push(windowId);
            this._updateGroup(appType);
            existingGroup.element.dataset.windowId = existingGroup.windows.join(',');
        } else {
            const item = document.createElement('div');
            item.className = 'taskbar-item';
            item.dataset.windowId = windowId;
            item.dataset.appType  = appType;

            const iconMarkup = iconSvg
                ? `<img src="${iconSvg}" alt="" aria-hidden="true">`
                : '';

            item.innerHTML = `
                <span class="taskbar-icon">${iconMarkup}</span>
                <span class="taskbar-title">${title}</span>
                <div class="window-preview hidden">
                    <div class="preview-thumbnail"></div>
                    <div class="preview-title">${title}</div>
                </div>
            `;

            this._groupedApps.set(appType, { element: item, windows: [windowId], title });
            this._setupItemEvents(item, windowId, appType);

            item.style.opacity   = '0';
            item.style.transform = 'translateY(10px) scale(0.8)';
            taskbarItems.appendChild(item);
            requestAnimationFrame(() => {
                item.style.transition = 'all 0.4s cubic-bezier(0.4,0,0.2,1)';
                item.style.opacity    = '1';
                item.style.transform  = 'translateY(0) scale(1)';
            });
        }

        this._syncActiveState();
    }

    _removeItem(windowId) {
        const appType = this._findAppTypeForWindow(windowId);
        if (!appType) return;

        const group = this._groupedApps.get(appType);
        if (!group) return;

        group.windows = group.windows.filter(id => id !== windowId);

        if (group.windows.length === 0) {
            group.element.style.transition = 'all 0.3s cubic-bezier(0.4,0,0.2,1)';
            group.element.style.opacity    = '0';
            group.element.style.transform  = 'translateY(10px) scale(0.8)';
            setTimeout(() => group.element.parentNode?.removeChild(group.element), 300);
            this._groupedApps.delete(appType);
        } else {
            this._updateGroup(appType);
        }
    }

    _setItemState(windowId, isMinimized) {
        const appType = this._findAppTypeForWindow(windowId);
        if (!appType) return;
        const group = this._groupedApps.get(appType);
        if (!group) return;

        const wm     = this._windowManager;
        const allMin = group.windows.every(id => {
            const win = wm.getWindow(id);
            return win?.element.style.display === 'none';
        });

        group.element.classList.toggle('minimized', allMin);
        this._syncActiveState();
    }

    _syncActiveState() {
        const wm = this._windowManager;
        this._groupedApps.forEach((group, appType) => {
            const living = group.windows.filter(id => !!wm.getWindow(id));
            group.windows = living;

            if (living.length === 0) {
                group.element.remove();
                this._groupedApps.delete(appType);
                return;
            }

            const isActive  = living.some(id => id === wm.activeWindowId && wm.getWindow(id)?.element.style.display !== 'none');
            const allMin    = living.every(id => wm.getWindow(id)?.element.style.display === 'none');

            group.element.classList.toggle('active',    isActive);
            group.element.classList.toggle('minimized', allMin);

            const titleSpan = group.element.querySelector('.taskbar-title');
            if (titleSpan) {
                titleSpan.textContent = living.length > 1
                    ? `${group.title} (${living.length})`
                    : group.title;
                group.element.classList.toggle('grouped', living.length > 1);
            }
        });

        const { startButton, startMenu } = this._dom;
        // handled by the orchestrator, but keep the button state in sync
        if (startButton && startMenu) {
            startButton.classList.toggle('active', startMenu.classList.contains('active'));
        }
    }

    _updateGroup(appType) {
        const group = this._groupedApps.get(appType);
        if (!group) return;
        const titleSpan = group.element.querySelector('.taskbar-title');
        if (titleSpan) {
            if (group.windows.length > 1) {
                titleSpan.textContent = `${group.title} (${group.windows.length})`;
                group.element.classList.add('grouped');
            } else {
                titleSpan.textContent = group.title;
                group.element.classList.remove('grouped');
            }
        }
    }

    _findAppTypeForWindow(windowId) {
        for (const [appType, group] of this._groupedApps) {
            if (group.windows.includes(windowId)) return appType;
        }
        return null;
    }

    // ── Private: event wiring per item ────────────────────────────────────────

    _setupItemEvents(item, _initialWindowId, appType) {
        // Click
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const group = this._groupedApps.get(appType);
            if (!group?.windows.length) return;

            if (group.windows.length === 1) {
                const id  = group.windows[0];
                const win = this._windowManager.getWindow(id);
                if (!win) return;
                if (win.element.style.display === 'none') {
                    this._windowManager.restoreWindow(id);
                    this._windowManager.setActiveWindow(id);
                } else if (this._windowManager.activeWindowId === id) {
                    this._windowManager.minimizeWindow(id);
                } else {
                    this._windowManager.setActiveWindow(id);
                }
            } else {
                this._showGroupSwitcher(appType, e);
            }
        });

        // Hover preview
        let hoverTimeout;
        item.addEventListener('mouseenter', () => {
            hoverTimeout = setTimeout(() => this._showPreview(item, appType), 500);
        });
        item.addEventListener('mouseleave', () => {
            clearTimeout(hoverTimeout);
            this._hidePreview(item);
        });

        // Context menu
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const group = this._groupedApps.get(appType);
            if (group?.windows[0]) this._showWindowContextMenu(e, group.windows[0]);
        });
    }

    _showPreview(item, appType) {
        const preview = item.querySelector('.window-preview');
        const group   = this._groupedApps.get(appType);
        if (!group || !preview) return;
        const win = this._windowManager.getWindow(group.windows[0]);
        if (win) {
            const thumbnail = preview.querySelector('.preview-thumbnail');
            thumbnail.innerHTML = `
                <div class="mini-window">
                    <div class="mini-header">${win.title}</div>
                    <div class="mini-content">${win.icon ?? '🗂️'}</div>
                </div>
            `;
        }
        preview.classList.remove('hidden');
    }

    _hidePreview(item) {
        item.querySelector('.window-preview')?.classList.add('hidden');
    }

    _showGroupSwitcher(appType, event) {
        const group = this._groupedApps.get(appType);
        if (!group || group.windows.length <= 1) return;

        const switcher = document.createElement('div');
        switcher.className = 'taskbar-group-switcher';
        switcher.innerHTML = `
            <div class="group-switcher-content">
                ${group.windows.map(winId => {
                    const win = this._windowManager.getWindow(winId);
                    return `
                        <div class="group-window-item" data-window-id="${winId}">
                            <div class="group-window-preview">${win?.icon ?? '🗂️'}</div>
                            <div class="group-window-title">${win?.title ?? ''}</div>
                            <div class="group-window-close" data-action="close">×</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        const rect = event.currentTarget.getBoundingClientRect();
        switcher.style.cssText = `position:fixed;bottom:60px;left:${rect.left}px;z-index:10000;`;
        document.body.appendChild(switcher);

        switcher.addEventListener('click', (e) => {
            const item      = e.target.closest('.group-window-item');
            const closeBtn  = e.target.closest('.group-window-close');
            if (!item) return;
            const winId = item.dataset.windowId;
            if (closeBtn) {
                e.stopPropagation();
                this._windowManager.closeWindow(winId);
            } else {
                this._windowManager.setActiveWindow(winId);
            }
            switcher.remove();
        });

        setTimeout(() => {
            document.addEventListener('click', function close(e) {
                if (!switcher.contains(e.target)) { switcher.remove(); document.removeEventListener('click', close); }
            });
        }, 100);
    }

    _showWindowContextMenu(event, windowId) {
        const menu = document.createElement('div');
        menu.className = 'taskbar-context-menu';
        menu.style.cssText = `
            position:fixed; top:${event.clientY - 60}px; left:${event.clientX}px;
            background:rgba(20,20,20,0.95); backdrop-filter:blur(20px);
            border:1px solid rgba(255,255,255,0.2); border-radius:8px;
            padding:8px 0; z-index:10000; box-shadow:0 8px 24px rgba(0,0,0,0.4);
            color:white; font-size:13px; min-width:120px;
        `;

        const items = [
            { text: 'Restore',  fn: () => this._windowManager.setActiveWindow(windowId) },
            { text: 'Minimize', fn: () => this._windowManager.minimizeWindow(windowId) },
            { text: 'Close',    fn: () => this._windowManager.closeWindow(windowId) },
        ];

        items.forEach(({ text, fn }) => {
            const el = document.createElement('div');
            el.textContent = text;
            el.style.cssText = 'padding:8px 16px;cursor:pointer;transition:background 0.2s ease;';
            el.addEventListener('mouseenter', () => { el.style.background = 'rgba(255,255,255,0.1)'; });
            el.addEventListener('mouseleave', () => { el.style.background = 'transparent'; });
            el.addEventListener('click', () => { fn(); menu.remove(); });
            menu.appendChild(el);
        });

        document.body.appendChild(menu);
        setTimeout(() => {
            document.addEventListener('click', function remove() {
                menu.remove(); document.removeEventListener('click', remove);
            });
        }, 100);
    }
}
