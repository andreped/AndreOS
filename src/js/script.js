import { buildDomCache }        from './core/DomCache.js';
import { EventBus }             from './core/EventBus.js';
import { NotificationManager }  from './system/NotificationManager.js';
import { AudioManager }         from './system/AudioManager.js';
import { WindowManager }        from './desktop/WindowManager.js';
import { Taskbar }              from './desktop/Taskbar.js';
import { Desktop }              from './desktop/Desktop.js';
import { setupBrowserWindow }   from './windows/BrowserWindow.js';
import { setupChatWindow }      from './windows/ChatWindow.js';
import { setupGameWindow }      from './windows/GameWindow.js';

class DesktopPortfolio {
    constructor() {
        this.dom           = buildDomCache();
        this.eventBus      = new EventBus();
        this.notifications = new NotificationManager();
        this.audio         = new AudioManager(this.dom);

        this.windowManager = new WindowManager({
            domCache:            this.dom,
            eventBus:            this.eventBus,
            audioManager:        this.audio,
            windowSetupHandlers: {
                browser: setupBrowserWindow,
                chat:    setupChatWindow,
                game:    setupGameWindow,
            },
        });

        this.taskbar = new Taskbar({
            domCache:      this.dom,
            eventBus:      this.eventBus,
            windowManager: this.windowManager,
        });

        this.desktop = new Desktop({
            domCache:   this.dom,
            openFileCb: (fileType) => this.windowManager.openFile(fileType),
        });

        this.startMenuOpen = false;

        this.init();
    }

    // ── Compat shims for window.__AndreOSApp (used by chat.js) ────────────────
    openFile(fileType)             { return this.windowManager.openFile(fileType); }
    createLiveNotification(...a)   { return this.notifications.createLive(...a); }
    updateLiveNotification(...a)   { return this.notifications.updateLive(...a); }
    completeLiveNotification(...a) { return this.notifications.completeLive(...a); }

    init() {
        this.updateClock();
        this.showLoadingScreen();
        this.audio.init();

        const clockUpdate = () => {
            this.updateClock();
            setTimeout(() => requestAnimationFrame(clockUpdate), 1000);
        };
        requestAnimationFrame(clockUpdate);

        this.setupEventListeners();
        this.desktop.enhanceIconPerformance();
        this.taskbar.enhance();
        this.setupKeyboardShortcuts();
        this.setupTaskbarFeatures();
    }
    
    // ── Taskbar features (search, task view, notification, clock) ────────────

    setupTaskbarFeatures() {
        const searchInput = document.querySelector('.search-input');
        const searchBox   = document.querySelector('.search-box');

        if (searchInput) {
            searchInput.addEventListener('focus', () => searchBox.classList.add('focused'));
            searchInput.addEventListener('blur',  () => searchBox.classList.remove('focused'));
            searchInput.addEventListener('input', (e) => {
                if (e.target.value.length > 0) this._performSearch(e.target.value.toLowerCase());
            });
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.target.value.trim()) this._executeSearch(e.target.value.trim());
            });
        }

        document.querySelector('.task-view-button')?.addEventListener('click', () => {
            const opened = this.windowManager.showTaskView();
            if (!opened) this.notifications.show('No open windows', 'info');
        });

        document.querySelector('.notification-button')?.addEventListener('click', () => {
            this.notifications.toggleCenter();
        });

        document.querySelector('.hidden-icons-chevron')?.addEventListener('click', () => {
            this.notifications.show('Hidden icons toggled', 'info');
        });

        document.querySelector('.clock')?.addEventListener('click', () => {
            this.notifications.show(`Today: ${new Date().toDateString()}`, 'info');
        });

        document.querySelector('.taskbar')?.addEventListener('contextmenu', (e) => {
            if (e.target === e.currentTarget) {
                e.preventDefault();
                this._showDesktopContextMenu(e);
            }
        });
    }

    _performSearch(query) {
        // Filter searchable items — results could power a future search UI
        const items = [
            'About Me', 'Resume', 'Projects', 'Skills',
            'Contact', 'Social', 'Browser', 'Ask André', 'Cast Arena',
        ];
        return items.filter(name => name.toLowerCase().includes(query));
    }

    _executeSearch(query) {
        this._performSearch(query);
        const searchInput = document.querySelector('.search-input');
        if (searchInput) { searchInput.blur(); searchInput.value = ''; }
    }

    _showDesktopContextMenu(event) {
        const menu = document.createElement('div');
        menu.className = 'taskbar-context-menu';
        menu.innerHTML = `
            <div class="context-menu-item" data-action="task-manager">Task Manager</div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="settings">Taskbar settings</div>
            <div class="context-menu-item" data-action="show-desktop">Show desktop</div>
        `;
        menu.style.cssText = `
            position:fixed; bottom:60px; left:${event.clientX}px;
            background:rgba(32,32,32,0.95); backdrop-filter:blur(20px);
            border:1px solid rgba(255,255,255,0.2); border-radius:6px;
            padding:4px 0; z-index:10000; min-width:180px; color:white; font-size:13px;
        `;
        document.body.appendChild(menu);
        menu.addEventListener('click', (e) => {
            switch (e.target.dataset.action) {
                case 'task-manager': this.notifications.show('Task Manager would open here', 'info'); break;
                case 'settings':     this.notifications.show('Taskbar settings would open here', 'info'); break;
                case 'show-desktop': this.windowManager.showDesktop(); break;
            }
            menu.remove();
        });
        setTimeout(() => {
            document.addEventListener('click', function rm(e) {
                if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', rm); }
            });
        }, 100);
    }

    // ── Keyboard shortcuts ────────────────────────────────────────────────────

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Tab') {
                e.preventDefault();
                this.windowManager.handleWindowSwitching(e.shiftKey);
            }
            if (e.ctrlKey && e.code === 'Space') {
                e.preventDefault();
                this.toggleStartMenu();
            }
            if (e.ctrlKey && e.key === 'w') {
                e.preventDefault();
                const id = this.windowManager.activeWindowId;
                if (id) this.windowManager.closeWindow(id);
            }
            if (e.ctrlKey && e.key === 'd') {
                e.preventDefault();
                this.windowManager.showDesktop();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                this._handleEscapeKey();
            }
            if (e.key === 'Tab' && !e.ctrlKey && !e.target.matches('input, textarea')) {
                e.preventDefault();
                const opened = this.windowManager.showTaskView();
                if (!opened) this.notifications.show('No open windows', 'info');
            }
            if (this.windowManager.switcherOpen && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                e.preventDefault();
                this.windowManager.handleWindowSwitching(e.key === 'ArrowLeft');
            }
            if (this.windowManager.switcherOpen && e.key === 'Enter') {
                e.preventDefault();
                this.windowManager.finishWindowSwitching();
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === 'Control' && this.windowManager.switcherOpen) {
                this.windowManager.finishWindowSwitching();
            }
        });
    }

    _handleEscapeKey() {
        if (this.windowManager.switcherOpen) {
            this.windowManager.finishWindowSwitching();
            return;
        }
        if (this.startMenuOpen) {
            this.closeStartMenu();
            return;
        }
        const taskViewOverlay = document.querySelector('.task-view-overlay');
        if (taskViewOverlay) { taskViewOverlay.remove(); return; }

        document.querySelectorAll('.taskbar-context-menu, .context-menu').forEach(m => m.remove());

        const id = this.windowManager.activeWindowId;
        if (id) this.windowManager.closeWindow(id);
    }

    // ── Start menu & desktop events ───────────────────────────────────────────

    setupEventListeners() {
        this.dom.startButton?.addEventListener('click', () => this.toggleStartMenu());

        this.dom.startMenu?.addEventListener('click', (e) => {
            const item = e.target.closest('.start-menu-item');
            if (item) {
                this.windowManager.openFile(item.dataset.action);
                this.toggleStartMenu();
            }
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.start-button') && !e.target.closest('.start-menu')) {
                this.closeStartMenu();
            }
        });

        this.dom.desktopBackground?.addEventListener('click', () => {
            this.desktop.deselectAllIcons();
        });
    }

    toggleStartMenu() {
        this.startMenuOpen = !this.startMenuOpen;
        this.dom.startMenu?.classList.toggle('active', this.startMenuOpen);
    }

    closeStartMenu() {
        this.dom.startMenu?.classList.remove('active');
        this.startMenuOpen = false;
    }

    // ── Clock ─────────────────────────────────────────────────────────────────

    updateClock() {
        const now = new Date();
        if (this.dom.timeElem) this.dom.timeElem.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (this.dom.dateElem) this.dom.dateElem.textContent = now.toLocaleDateString();
    }

    // ── Boot & loading screen ─────────────────────────────────────────────────

    showLoadingScreen() {
        const messages = [
            'Initializing system…',
            'Loading user profile…',
            'Preparing desktop environment…',
            'Loading applications…',
            'Configuring audio system…',
            'Setting up user interface…',
            'Finalizing startup…',
            'Welcome to AndreOS',
        ];

        let idx = 0;
        const statusText = document.querySelector('.status-text');
        if (!statusText) return;

        const interval = setInterval(() => {
            if (idx < messages.length - 1) {
                statusText.textContent = messages[idx++];
            } else {
                clearInterval(interval);
                statusText.textContent = messages[messages.length - 1];
            }
        }, 400);

        setTimeout(() => {
            clearInterval(interval);
            statusText.textContent = 'Ready to start…';

            setTimeout(() => {
                const screen = document.querySelector('.loading-screen');
                if (screen) {
                    screen.classList.add('hidden');
                    screen.style.display = 'none';
                    screen.style.pointerEvents = 'none';
                }
                setTimeout(() => {
                    this.desktop.animateIcons();
                    this.desktop.setupIconListeners();
                    window.__desktopReady = true;
                    document.dispatchEvent(new CustomEvent('andreos:desktop-ready'));
                }, 300);

                this.audio.startMusic();
            }, 500);
        }, 3200);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.desktopPortfolio = new DesktopPortfolio();
    window.__AndreOSApp     = window.desktopPortfolio;
});

