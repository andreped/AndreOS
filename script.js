const domCache = {
    musicToggle: null,
    sfxToggle: null,
    musicVolumeSlider: null,
    sfxVolumeSlider: null,
    desktop: null,
    windowsContainer: null,
    taskbar: null,
    taskbarItems: null,
    startButton: null,
    startMenu: null,
    desktopIcons: null,
    desktopBackground: null,
    timeElem: null,
    dateElem: null,
    particles: null
};

class DesktopPortfolio {
    constructor() {
        this.windows = [];
        this.activeWindow = null;
        this.windowCounter = 0;
        this.startMenuOpen = false;
        this.audioContext = null;
        this.musicPlaying = false;
        this.backgroundMusic = null;
        this.musicGainNode = null;
        this.sfxGainNode = null;
        this.sfxMuted = false;
        this.windowZIndex = 400;
        this.windowSwitcherOpen = false;
        this.windowSwitcherIndex = 0;
        this.windowSwitcher = null;
        this.groupedApps = new Map();
        
        this.rafId = null;
        this.isAnimating = false;
        this.pendingUpdates = new Set();
        this.throttledFunctions = new Map();
        
        domCache.musicToggle = document.getElementById('musicToggle');
        domCache.sfxToggle = document.getElementById('sfxToggle');
        domCache.musicVolumeSlider = document.getElementById('musicVolumeSlider');
        domCache.sfxVolumeSlider = document.getElementById('sfxVolumeSlider');
        domCache.desktop = document.querySelector('.desktop');
        domCache.windowsContainer = document.querySelector('.windows-container');
        domCache.taskbar = document.querySelector('.taskbar');
        domCache.taskbarItems = document.querySelector('.taskbar-items');
        domCache.startButton = document.querySelector('.start-button');
        domCache.startMenu = document.querySelector('.start-menu');
        domCache.desktopIcons = document.querySelectorAll('.desktop-icon');
        domCache.desktopBackground = document.querySelector('.desktop-background');
        domCache.timeElem = document.querySelector('.time');
        domCache.dateElem = document.querySelector('.date');
        domCache.particles = document.querySelectorAll('.particle');
        
        this.init();
    }
    
    throttle(func, delay, key) {
        if (this.throttledFunctions.has(key)) {
            clearTimeout(this.throttledFunctions.get(key));
        }
        
        this.throttledFunctions.set(key, setTimeout(() => {
            func();
            this.throttledFunctions.delete(key);
        }, delay));
    }
    
    scheduleUpdate(updateFn) {
        this.pendingUpdates.add(updateFn);
        if (!this.isAnimating) {
            this.isAnimating = true;
            this.rafId = requestAnimationFrame(() => this.processPendingUpdates());
        }
    }
    
    processPendingUpdates() {
        this.pendingUpdates.forEach(updateFn => updateFn());
        this.pendingUpdates.clear();
        this.isAnimating = false;
    }
    
    init() {
        this.updateClock();
        this.showLoadingScreen();
        this.playBootSound();
        this.initBackgroundMusic();
        
        const clockUpdate = () => {
            this.updateClock();
            setTimeout(() => requestAnimationFrame(clockUpdate), 1000);
        };
        requestAnimationFrame(clockUpdate);
        
        this.setupEventListeners();
        this.enhanceIconPerformance();
        this.enhanceTaskbarPerformance();
        this.setupKeyboardShortcuts();
        this.setupTaskbarFeatures();
    }
    
    setupTaskbarFeatures() {
        const searchInput = document.querySelector('.search-input');
        const searchBox = document.querySelector('.search-box');
        
        if (searchInput) {
            searchInput.addEventListener('focus', () => {
                searchBox.classList.add('focused');
            });
            
            searchInput.addEventListener('blur', () => {
                searchBox.classList.remove('focused');
            });
            
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                if (query.length > 0) {
                    this.performSearch(query);
                }
            });
            
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                    this.executeSearch(e.target.value.trim());
                }
            });
        }
        
        const taskViewButton = document.querySelector('.task-view-button');
        if (taskViewButton) {
            taskViewButton.addEventListener('click', () => {
                this.showTaskView();
            });
        }
        
        const notificationButton = document.querySelector('.notification-button');
        if (notificationButton) {
            notificationButton.addEventListener('click', () => {
                this.showNotificationCenter();
            });
        }
        
        const hiddenIconsChevron = document.querySelector('.hidden-icons-chevron');
        if (hiddenIconsChevron) {
            hiddenIconsChevron.addEventListener('click', () => {
                this.toggleHiddenIcons();
            });
        }
        
        const clock = document.querySelector('.clock');
        if (clock) {
            clock.addEventListener('click', () => {
                this.showCalendar();
            });
        }
        
        const taskbar = document.querySelector('.taskbar');
        if (taskbar) {
            taskbar.addEventListener('contextmenu', (e) => {
                if (e.target === taskbar) {
                    e.preventDefault();
                    this.showTaskbarContextMenu(e);
                }
            });
        }
    }
    
    performSearch(query) {
        const searchableItems = [
            { name: 'About Me', action: () => this.openFile('about') },
            { name: 'Resume', action: () => this.openFile('resume') },
            { name: 'Projects', action: () => this.openFile('projects') },
            { name: 'Skills', action: () => this.openFile('skills') },
            { name: 'Contact', action: () => this.openFile('contact') },
            { name: 'Social', action: () => this.openFile('social') },
            { name: 'Browser', action: () => this.openFile('browser') }
        ];
        
        const results = searchableItems.filter(item => 
            item.name.toLowerCase().includes(query)
        );
    }
    
    executeSearch(query) {
        this.performSearch(query);
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            searchInput.blur();
            searchInput.value = '';
        }
    }
    
    showTaskView() {
        if (this.windows.length === 0) {
            this.showNotification('No open windows', 'info');
            return;
        }
        
        const taskView = document.createElement('div');
        taskView.className = 'task-view-overlay';
        taskView.innerHTML = `
            <div class="task-view-container">
                <div class="task-view-header">
                    <h2>Task View</h2>
                    <button class="task-view-close">×</button>
                </div>
                <div class="task-view-grid">
                    ${this.windows.map(win => `
                        <div class="task-view-item" data-window-id="${win.id}">
                            <div class="task-view-thumbnail">
                                <div class="task-view-window-preview">
                                    ${this.getWindowIcon(win.title)}
                                </div>
                            </div>
                            <div class="task-view-title">${win.title}</div>
                            <div class="task-view-close-btn">×</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        document.body.appendChild(taskView);
        
        taskView.querySelector('.task-view-close').addEventListener('click', () => {
            taskView.remove();
        });
        
        taskView.addEventListener('click', (e) => {
            const item = e.target.closest('.task-view-item');
            const closeBtn = e.target.closest('.task-view-close-btn');
            
            if (closeBtn && item) {
                e.stopPropagation();
                const windowId = item.dataset.windowId;
                this.closeWindow(windowId);
                item.remove();
                
                if (this.windows.length === 0) {
                    taskView.remove();
                }
            } else if (item) {
                const windowId = item.dataset.windowId;
                this.setActiveWindow(windowId);
                taskView.remove();
            }
        });
        
        document.addEventListener('keydown', function onEscape(e) {
            if (e.key === 'Escape') {
                taskView.remove();
                document.removeEventListener('keydown', onEscape);
            }
        });
        
        taskView.addEventListener('click', (e) => {
            if (e.target === taskView) {
                taskView.remove();
            }
        });
    }
    
    showNotificationCenter() {
        this.showNotification('Notification Center opened', 'info');
    }
    
    toggleHiddenIcons() {
        this.showNotification('Hidden icons toggled', 'info');
    }
    
    showCalendar() {
        const now = new Date();
        this.showNotification(`Today: ${now.toDateString()}`, 'info');
    }
    
    showTaskbarContextMenu(event) {
        const menu = document.createElement('div');
        menu.className = 'taskbar-context-menu';
        menu.innerHTML = `
            <div class="context-menu-item" data-action="task-manager">Task Manager</div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="settings">Taskbar settings</div>
            <div class="context-menu-item" data-action="show-desktop">Show desktop</div>
        `;
        
        menu.style.cssText = `
            position: fixed;
            bottom: 60px;
            left: ${event.clientX}px;
            background: rgba(32, 32, 32, 0.95);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 6px;
            padding: 4px 0;
            z-index: 10000;
            min-width: 180px;
            color: white;
            font-size: 13px;
        `;
        
        document.body.appendChild(menu);
        
        menu.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            switch (action) {
                case 'task-manager':
                    this.showNotification('Task Manager would open here', 'info');
                    break;
                case 'settings':
                    this.showNotification('Taskbar settings would open here', 'info');
                    break;
                case 'show-desktop':
                    this.showDesktop();
                    break;
            }
            menu.remove();
        });
        
        setTimeout(() => {
            document.addEventListener('click', function removeMenu(e) {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', removeMenu);
                }
            });
        }, 100);
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `windows-notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-message">${message}</div>
            </div>
        `;
        
        notification.style.cssText = `
            position: fixed;
            bottom: 70px;
            right: 20px;
            background: rgba(32, 32, 32, 0.95);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 6px;
            padding: 12px 16px;
            color: white;
            font-size: 13px;
            z-index: 10001;
            max-width: 300px;
            animation: notificationSlideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'notificationSlideOut 0.3s ease';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Tab') {
                e.preventDefault();
                this.handleWindowSwitching(e.shiftKey);
            }
            
            if (e.ctrlKey && e.code === 'Space') {
                e.preventDefault();
                this.toggleStartMenu();
            }
            
            if (e.ctrlKey && e.key === 'w') {
                e.preventDefault();
                if (this.activeWindow) {
                    this.closeWindow(this.activeWindow);
                }
            }
            
            if (e.ctrlKey && e.key === 'd') {
                e.preventDefault();
                this.showDesktop();
            }
            
            if (e.key === 'Escape') {
                e.preventDefault();
                this.handleEscapeKey();
            }
            
            if (e.key === 'Tab' && !e.ctrlKey && !e.target.matches('input, textarea')) {
                e.preventDefault();
                this.showTaskView();
            }
            
            if (this.windowSwitcherOpen && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                e.preventDefault();
                this.handleWindowSwitching(e.key === 'ArrowLeft');
            }
            
            if (this.windowSwitcherOpen && e.key === 'Enter') {
                e.preventDefault();
                this.finishWindowSwitching();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            if (e.key === 'Control' && this.windowSwitcherOpen) {
                this.finishWindowSwitching();
            }
        });
    }
    
    handleWindowSwitching(reverse = false) {
        const visibleWindows = this.windows.filter(win => 
            win.element.style.display !== 'none'
        );
        
        if (visibleWindows.length < 2) return;
        
        if (!this.windowSwitcherOpen) {
            this.showWindowSwitcher(visibleWindows);
            this.windowSwitcherOpen = true;
            this.windowSwitcherIndex = reverse ? visibleWindows.length - 1 : 1;
        } else {
            if (reverse) {
                this.windowSwitcherIndex = (this.windowSwitcherIndex - 1 + visibleWindows.length) % visibleWindows.length;
            } else {
                this.windowSwitcherIndex = (this.windowSwitcherIndex + 1) % visibleWindows.length;
            }
        }
        
        this.updateWindowSwitcherSelection(visibleWindows);
    }
    
    showWindowSwitcher(windows) {
        this.windowSwitcher = document.createElement('div');
        this.windowSwitcher.className = 'window-switcher';
        this.windowSwitcher.innerHTML = `
            <div class="switcher-container">
                <div class="switcher-header">
                    <h3>Switch Windows (Ctrl+Tab)</h3>
                    <p>Use arrow keys or Ctrl+Tab to navigate, Enter to select</p>
                </div>
                <div class="switcher-windows">
                    ${windows.map((win, index) => `
                        <div class="switcher-window ${index === 0 ? 'selected' : ''}" data-window-id="${win.id}">
                            <div class="switcher-preview">
                                <div class="preview-content">
                                    ${this.getWindowIcon(win.title)}
                                </div>
                            </div>
                            <div class="switcher-title">${win.title}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        document.body.appendChild(this.windowSwitcher);
    }
    
    updateWindowSwitcherSelection(windows) {
        const switcherWindows = this.windowSwitcher.querySelectorAll('.switcher-window');
        switcherWindows.forEach((el, index) => {
            el.classList.toggle('selected', index === this.windowSwitcherIndex);
        });
        
        const selectedWindow = windows[this.windowSwitcherIndex];
        if (selectedWindow) {
            this.previewWindow(selectedWindow.id);
        }
    }
    
    finishWindowSwitching() {
        const visibleWindows = this.windows.filter(win => 
            win.element.style.display !== 'none'
        );
        
        if (this.windowSwitcherIndex < visibleWindows.length) {
            this.setActiveWindow(visibleWindows[this.windowSwitcherIndex].id);
        }
        
        if (this.windowSwitcher) {
            this.windowSwitcher.remove();
            this.windowSwitcher = null;
        }
        
        this.windowSwitcherOpen = false;
        this.windowSwitcherIndex = 0;
    }
    
    previewWindow(windowId) {
        const window = this.windows.find(win => win.id === windowId);
        if (window) {
            window.element.style.zIndex = 1300;
            window.element.style.opacity = '0.8';
            
            setTimeout(() => {
                if (!this.windowSwitcherOpen) {
                    window.element.style.opacity = '1';
                }
            }, 200);
        }
    }
    
    handleEscapeKey() {
        if (this.windowSwitcherOpen) {
            this.finishWindowSwitching();
            return;
        }
        
        if (this.startMenuOpen) {
            this.closeStartMenu();
            return;
        }
        
        const taskViewOverlay = document.querySelector('.task-view-overlay');
        if (taskViewOverlay) {
            taskViewOverlay.remove();
            return;
        }
        
        const contextMenus = document.querySelectorAll('.taskbar-context-menu, .context-menu');
        if (contextMenus.length > 0) {
            contextMenus.forEach(menu => menu.remove());
            return;
        }
    }
    
    showDesktop() {
        const hasVisibleWindows = this.windows.some(win => 
            win.element.style.display !== 'none'
        );
        
        if (hasVisibleWindows) {
            this.windows.forEach(win => {
                if (win.element.style.display !== 'none') {
                    this.minimizeWindow(win.id);
                }
            });
        } else {
            this.windows.forEach(win => {
                if (win.element.style.display === 'none') {
                    win.element.style.display = 'block';
                    this.animateWindowRestore(win.element);
                    this.updateTaskbarItemState(win.id, false);
                }
            });
        }
    }
    
    getAppType(title) {
        if (title.includes('About')) return 'about';
        if (title.includes('Resume')) return 'resume';
        if (title.includes('Projects')) return 'projects';
        if (title.includes('Skills')) return 'skills';
        if (title.includes('Contact')) return 'contact';
        if (title.includes('Social')) return 'social';
        return 'unknown';
    }
    
    initBackgroundMusic() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.musicGainNode = this.audioContext.createGain();
            this.musicGainNode.gain.value = (domCache.musicVolumeSlider ? domCache.musicVolumeSlider.value : 30) / 100;
            this.musicGainNode.connect(this.audioContext.destination);
            this.sfxGainNode = this.audioContext.createGain();
            this.sfxGainNode.gain.value = (domCache.sfxVolumeSlider ? domCache.sfxVolumeSlider.value : 60) / 100;
            this.sfxGainNode.connect(this.audioContext.destination);
            this.setupAudioControls();
        } catch (error) {
            this.setupAudioControls();
        }
    }
    
    createAmbientMusic() {
        if (!this.audioContext) return;
        
        const happyScale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];
        const cheerfulChords = [
            [261.63, 329.63, 392.00],
            [392.00, 493.88, 587.33],
            [440.00, 523.25, 659.25],
            [349.23, 440.00, 523.25]
        ];
        
        const createMelodyNote = (delay = 0) => {
            setTimeout(() => {
                if (!this.musicPlaying) return;
                
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                const filter = this.audioContext.createBiquadFilter();
                
                oscillator.connect(filter);
                filter.connect(gainNode);
                gainNode.connect(this.musicGainNode);
                
                const noteIndex = Math.floor(Math.random() * happyScale.length);
                const frequency = happyScale[noteIndex];
                
                oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
                oscillator.type = 'triangle'; 
                
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(1800, this.audioContext.currentTime); 
                
                gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.035, this.audioContext.currentTime + 0.2);
                gainNode.gain.linearRampToValueAtTime(0.025, this.audioContext.currentTime + 1);
                gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 1.8);
                
                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 1.8);
                
                setTimeout(() => {
                    if (this.musicPlaying) {
                        createMelodyNote(300 + Math.random() * 700); 
                    }
                }, 1200 + Math.random() * 800);
            }, delay);
        };
        
        const createChordPad = (chordIndex, delay = 0) => {
            setTimeout(() => {
                if (!this.musicPlaying) return;
                
                const chord = cheerfulChords[chordIndex % cheerfulChords.length];
                
                chord.forEach((frequency, i) => {
                    const oscillator = this.audioContext.createOscillator();
                    const gainNode = this.audioContext.createGain();
                    const filter = this.audioContext.createBiquadFilter();
                    
                    oscillator.connect(filter);
                    filter.connect(gainNode);
                    gainNode.connect(this.musicGainNode);
                    
                    oscillator.frequency.setValueAtTime(frequency * 0.5, this.audioContext.currentTime); 
                    oscillator.type = 'sine'; 
                    
                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(1000, this.audioContext.currentTime);
                    
                    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                    gainNode.gain.linearRampToValueAtTime(0.012, this.audioContext.currentTime + 0.5);
                    gainNode.gain.linearRampToValueAtTime(0.01, this.audioContext.currentTime + 3);
                    gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 4);
                    
                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + 4);
                });
                
                setTimeout(() => {
                    if (this.musicPlaying) {
                        createChordPad((chordIndex + 1) % cheerfulChords.length, 0);
                    }
                }, 4000); 
            }, delay);
        };
        
        const createSparkle = (delay = 0) => {
            setTimeout(() => {
                if (!this.musicPlaying) return;
                
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                const filter = this.audioContext.createBiquadFilter();
                
                oscillator.connect(filter);
                filter.connect(gainNode);
                gainNode.connect(this.musicGainNode);
                
                const sparkleNotes = [783.99, 880.00, 987.77, 1046.50, 1174.66]; 
                const sparkleFreq = sparkleNotes[Math.floor(Math.random() * sparkleNotes.length)];
                
                oscillator.frequency.setValueAtTime(sparkleFreq, this.audioContext.currentTime);
                oscillator.type = 'sine';
                
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(2500, this.audioContext.currentTime);
                
                gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.02, this.audioContext.currentTime + 0.1);
                gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.6);
                
                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.6);
                
                setTimeout(() => {
                    if (this.musicPlaying) {
                        createSparkle(0);
                    }
                }, 2000 + Math.random() * 3000); 
            }, delay);
        };
        
        const createRhythm = (delay = 0) => {
            setTimeout(() => {
                if (!this.musicPlaying) return;
                
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                const filter = this.audioContext.createBiquadFilter();
                
                oscillator.connect(filter);
                filter.connect(gainNode);
                gainNode.connect(this.musicGainNode);
                
                oscillator.frequency.setValueAtTime(130.81, this.audioContext.currentTime); 
                oscillator.type = 'triangle';
                
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(300, this.audioContext.currentTime);
                
                gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.015, this.audioContext.currentTime + 0.05);
                gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.3);
                
                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.3);
                
                setTimeout(() => {
                    if (this.musicPlaying) {
                        createRhythm(0);
                    }
                }, 2400); 
            }, delay);
        };
        
        if (this.musicPlaying) {
            createMelodyNote(0);           
            createChordPad(0, 800);        
            createSparkle(1600);           
            createRhythm(2400);            
            
            setTimeout(() => {
                if (this.musicPlaying) {
                    createMelodyNote(Math.random() * 600);
                }
            }, 2000);
        }
    }
    
    setupAudioControls() {
        const musicToggle = domCache.musicToggle;
        const sfxToggle = domCache.sfxToggle;
        const musicVolumeSlider = domCache.musicVolumeSlider;
        const sfxVolumeSlider = domCache.sfxVolumeSlider;
        const volumeTrayIcon = document.getElementById('volumeTrayIcon');
        const volumePopup = document.getElementById('volumePopup');

        // Restore persisted settings before wiring events
        this.applyAudioSettings(this.loadAudioSettings());

        // Music toggle
        if (musicToggle) {
            musicToggle.addEventListener('click', () => this.toggleMusic());
        }

        // SFX toggle
        if (sfxToggle) {
            sfxToggle.addEventListener('click', () => this.toggleSfx());
        }

        // Music slider
        if (musicVolumeSlider) {
            this.updateSliderTrack(musicVolumeSlider);
            this.updatePct('musicPct', musicVolumeSlider.value);
            musicVolumeSlider.addEventListener('input', (e) => {
                const v = e.target.value / 100;
                this.updateSliderTrack(e.target);
                this.updatePct('musicPct', e.target.value);
                if (this.musicGainNode && this.musicPlaying) {
                    this.musicGainNode.gain.value = v;
                }
                this.saveAudioSettings();
            });
        }

        // SFX slider
        if (sfxVolumeSlider) {
            this.updateSliderTrack(sfxVolumeSlider);
            this.updatePct('sfxPct', sfxVolumeSlider.value);
            sfxVolumeSlider.addEventListener('input', (e) => {
                const v = e.target.value / 100;
                this.updateSliderTrack(e.target);
                this.updatePct('sfxPct', e.target.value);
                if (this.sfxGainNode && !this.sfxMuted) {
                    this.sfxGainNode.gain.value = v;
                }
                this.saveAudioSettings();
            });
        }

        // Tray popup open/close
        if (volumeTrayIcon && volumePopup) {
            volumeTrayIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                volumePopup.classList.toggle('open');
            });
            document.addEventListener('click', (e) => {
                if (!volumePopup.contains(e.target) && e.target !== volumeTrayIcon) {
                    volumePopup.classList.remove('open');
                }
            });
        }
    }

    updatePct(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = Math.round(value) + '%';
    }

    toggleSfx() {
        this.sfxMuted = !this.sfxMuted;
        const sfxToggle = domCache.sfxToggle;
        const sfxVolumeSlider = domCache.sfxVolumeSlider;
        if (sfxToggle) {
            sfxToggle.classList.toggle('muted', this.sfxMuted);
        }
        if (this.sfxGainNode) {
            this.sfxGainNode.gain.value = this.sfxMuted
                ? 0
                : (sfxVolumeSlider ? sfxVolumeSlider.value / 100 : 0.6);
        }
        this.saveAudioSettings();
    }

    updateSliderTrack(slider) {
        const pct = slider.value / slider.max * 100;
        slider.style.background = `linear-gradient(to right,
            rgba(255, 107, 107, 0.9) 0%,
            rgba(78, 205, 196, 0.9) ${pct}%,
            rgba(255, 255, 255, 0.15) ${pct}%,
            rgba(255, 255, 255, 0.15) 100%)`;
    }

    saveAudioSettings() {
        try {
            const musicVolumeSlider = domCache.musicVolumeSlider;
            const sfxVolumeSlider = domCache.sfxVolumeSlider;
            localStorage.setItem('andreOS_audio', JSON.stringify({
                musicVolume: musicVolumeSlider ? Number(musicVolumeSlider.value) : 30,
                sfxVolume:   sfxVolumeSlider   ? Number(sfxVolumeSlider.value)   : 60,
                musicMuted:  !this.musicPlaying,
                sfxMuted:    this.sfxMuted
            }));
        } catch (e) { /* localStorage unavailable */ }
    }

    loadAudioSettings() {
        try {
            const raw = localStorage.getItem('andreOS_audio');
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) { return null; }
    }

    applyAudioSettings(settings) {
        if (!settings) return;
        const musicVolumeSlider = domCache.musicVolumeSlider;
        const sfxVolumeSlider   = domCache.sfxVolumeSlider;
        const musicToggle       = domCache.musicToggle;
        const sfxToggle         = domCache.sfxToggle;

        if (musicVolumeSlider) {
            musicVolumeSlider.value = settings.musicVolume;
            this.updateSliderTrack(musicVolumeSlider);
            this.updatePct('musicPct', settings.musicVolume);
            if (this.musicGainNode) {
                this.musicGainNode.gain.value = settings.musicMuted ? 0 : settings.musicVolume / 100;
            }
        }

        if (sfxVolumeSlider) {
            sfxVolumeSlider.value = settings.sfxVolume;
            this.updateSliderTrack(sfxVolumeSlider);
            this.updatePct('sfxPct', settings.sfxVolume);
            if (this.sfxGainNode) {
                this.sfxGainNode.gain.value = settings.sfxMuted ? 0 : settings.sfxVolume / 100;
            }
        }

        // Mute states
        this.sfxMuted = !!settings.sfxMuted;
        if (sfxToggle) sfxToggle.classList.toggle('muted', this.sfxMuted);

        if (settings.musicMuted) {
            // Don't call stopMusic (suspends audioContext); just reflect the UI state
            this.musicPlaying = false;
            if (musicToggle) {
                musicToggle.classList.remove('playing');
                musicToggle.classList.add('muted');
            }
            const trayIcon = document.getElementById('volumeTrayIcon');
            if (trayIcon) trayIcon.textContent = '🔇';
        }
    }

    startMusic() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => {
                this.createAmbientMusic();
            }).catch(error => {
                console.error('Failed to resume audio context:', error);
            });
        }
        
        this.musicPlaying = true;
        const musicToggle = domCache.musicToggle;
        const desktop = domCache.desktop;
        
        if (musicToggle) {
            musicToggle.classList.add('playing');
            musicToggle.classList.remove('muted');
        }
        const volumeTrayIcon = document.getElementById('volumeTrayIcon');
        if (volumeTrayIcon) volumeTrayIcon.textContent = '🎵';
        this.saveAudioSettings();
        
        if (desktop) {
            desktop.classList.add('music-playing');
        }
        
        if (this.audioContext && this.audioContext.state === 'running') {
            this.createAmbientMusic();
        }
        
        this.addSoundEffect('play');
    }
    
    stopMusic() {
        this.musicPlaying = false;
        const musicToggle = domCache.musicToggle;
        const desktop = domCache.desktop;
        
        if (musicToggle) {
            musicToggle.classList.remove('playing');
            musicToggle.classList.add('muted');
        }
        const volumeTrayIconStop = document.getElementById('volumeTrayIcon');
        if (volumeTrayIconStop) volumeTrayIconStop.textContent = '🔇';
        if (desktop) {
            desktop.classList.remove('music-playing');
        }
        
        if (this.audioContext) {
            this.audioContext.suspend();
        }
        
        this.addSoundEffect('stop');
    }

    toggleMusic() {
        if (this.musicPlaying) {
            this.stopMusic();
        } else {
            this.startMusic();
        }
    }
    
    setVolume(volume) {
        // Legacy helper — prefer direct slider input handlers
        if (this.musicGainNode) this.musicGainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
    
    makeDraggable(element) {
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let initialX = 0;
        let initialY = 0;
        
        const onMouseDown = (e) => {
            if (e.target.closest('.audio-btn') || e.target.closest('.volume-slider')) {
                return;
            }
            
            isDragging = true;
            element.classList.add('dragging');
            
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = element.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
            
            if (getComputedStyle(element).position !== 'absolute') {
                element.style.position = 'fixed';
                element.style.left = initialX + 'px';
                element.style.top = initialY + 'px';
                element.style.right = 'auto';
                element.style.bottom = 'auto';
            }
            
            e.preventDefault();
        };
        
        const onMouseMove = (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            let newX = initialX + deltaX;
            let newY = initialY + deltaY;
            
            const rect = element.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            newX = Math.max(0, Math.min(newX, viewportWidth - rect.width));
            newY = Math.max(0, Math.min(newY, viewportHeight - rect.height));
            
            element.style.left = newX + 'px';
            element.style.top = newY + 'px';
        };
        
        const onMouseUp = () => {
            if (isDragging) {
                isDragging = false;
                element.classList.remove('dragging');
            }
        };
        
        element.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        
        const onTouchStart = (e) => {
            if (e.target.closest('.audio-btn') || e.target.closest('.volume-slider')) {
                return;
            }
            
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            onMouseDown(mouseEvent);
        };
        
        const onTouchMove = (e) => {
            if (!isDragging) return;
            
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            onMouseMove(mouseEvent);
            e.preventDefault();
        };
        
        const onTouchEnd = () => {
            onMouseUp();
        };
        
        element.addEventListener('touchstart', onTouchStart, { passive: false });
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);
    }
    
    showPowerOnScreen() {
        const powerOnScreen = document.querySelector('.power-on-screen');
        const powerButton = document.querySelector('.power-button');
        
        if (powerButton) {
            powerButton.addEventListener('click', () => {
                this.startBootSequence();
            });
        }
    }
    
    startBootSequence() {
        const powerButtonContainer = document.querySelector('.power-button-container');
        const bootSequence = document.querySelector('.boot-sequence');
        
        if (powerButtonContainer) {
            powerButtonContainer.style.display = 'none';
        }
        
        if (bootSequence) {
            bootSequence.style.display = 'block';
        }
        
        this.playPowerOnSound();
        
        setTimeout(() => {
            this.startLoadingDots();
        }, 2000);
        
        setTimeout(() => {
            this.transitionToLoadingScreen();
        }, 4500);
    }
    
    startLoadingDots() {
        const loadingDots = document.querySelector('.loading-dots');
        if (!loadingDots) return;
        
        let dotCount = 1;
        const dotInterval = setInterval(() => {
            let dots = '';
            for (let i = 0; i < dotCount; i++) {
                dots += '.';
            }
            loadingDots.textContent = dots;
            dotCount = dotCount >= 4 ? 1 : dotCount + 1;
        }, 300);
        
        setTimeout(() => {
            clearInterval(dotInterval);
            loadingDots.textContent = 'OK';
        }, 1500);
    }
    
    transitionToLoadingScreen() {
        const powerOnScreen = document.querySelector('.power-on-screen');
        const loadingScreen = document.querySelector('.loading-screen');
        
        if (powerOnScreen) {
            powerOnScreen.classList.add('hidden');
            setTimeout(() => {
                powerOnScreen.style.display = 'none';
            }, 500);
        }
        
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
            setTimeout(() => {
                this.showLoadingScreen();
                this.playBootSound();
            }, 500);
        }
    }
    
    playPowerOnSound() {
        if (this.audioContext) {
            try {
                const now = this.audioContext.currentTime;
                
                const osc = this.audioContext.createOscillator();
                const gain = this.audioContext.createGain();
                
                osc.connect(gain);
                gain.connect(this.sfxGainNode || this.audioContext.destination);
                
                osc.frequency.setValueAtTime(80, now);
                osc.frequency.exponentialRampToValueAtTime(200, now + 0.3);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.6);
                
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.1, now + 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
                
                osc.type = 'sine';
                osc.start(now);
                osc.stop(now + 0.8);
            } catch (error) {
                console.log('Audio context not available for power-on sound');
            }
        }
    }

    showLoadingScreen() {
        const loadingMessages = [
            'Initializing system...',
            'Loading user profile...',
            'Preparing desktop environment...',
            'Loading applications...',
            'Configuring audio system...',
            'Setting up user interface...',
            'Finalizing startup...',
            'Welcome to AndreOS'
        ];
        
        let messageIndex = 0;
        const statusText = document.querySelector('.status-text');
        
        if (!statusText) return;

        const messageInterval = setInterval(() => {
            if (messageIndex < loadingMessages.length - 1) {
                statusText.textContent = loadingMessages[messageIndex];
                messageIndex++;
            } else {
                clearInterval(messageInterval);
                statusText.textContent = loadingMessages[loadingMessages.length - 1];
            }
        }, 400);

        setTimeout(() => {
            clearInterval(messageInterval);
            statusText.textContent = 'Ready to start...';
            
            setTimeout(() => {
                const loadingScreen = document.querySelector('.loading-screen');
                if (loadingScreen) {
                    loadingScreen.classList.add('hidden');
                    loadingScreen.style.display = 'none';
                    loadingScreen.style.pointerEvents = 'none';
                }
                
                setTimeout(() => {
                    this.animateDesktopIcons();
                    setTimeout(() => {
                        this.setupDesktopIconListeners();
                    }, 1000);
                }, 300);

                this.startMusic();
            }, 500);
        }, 3200);
    }
    
    playBootSound() {
        if (this.audioContext) {
            try {
                const now = this.audioContext.currentTime;
                const osc1 = this.audioContext.createOscillator();
                const gain1 = this.audioContext.createGain();
                osc1.connect(gain1);
                gain1.connect(this.sfxGainNode || this.audioContext.destination);
                osc1.frequency.setValueAtTime(349.23, now);
                osc1.type = 'sine';
                gain1.gain.setValueAtTime(0, now);
                gain1.gain.linearRampToValueAtTime(0.08, now + 0.1);
                gain1.gain.linearRampToValueAtTime(0, now + 0.6);
                osc1.start(now);
                osc1.stop(now + 0.6);
                const osc2 = this.audioContext.createOscillator();
                const gain2 = this.audioContext.createGain();
                osc2.connect(gain2);
                gain2.connect(this.sfxGainNode || this.audioContext.destination);
                osc2.frequency.setValueAtTime(440.00, now + 0.3);
                osc2.type = 'sine';
                gain2.gain.setValueAtTime(0, now + 0.3);
                gain2.gain.linearRampToValueAtTime(0.08, now + 0.4);
                gain2.gain.linearRampToValueAtTime(0, now + 0.9);
                osc2.start(now + 0.3);
                osc2.stop(now + 0.9);
                const osc3 = this.audioContext.createOscillator();
                const gain3 = this.audioContext.createGain();
                osc3.connect(gain3);
                gain3.connect(this.sfxGainNode || this.audioContext.destination);
                osc3.frequency.setValueAtTime(587.33, now + 0.6);
                osc3.type = 'sine';
                gain3.gain.setValueAtTime(0, now + 0.6);
                gain3.gain.linearRampToValueAtTime(0.1, now + 0.7);
                gain3.gain.linearRampToValueAtTime(0, now + 1.4);
                osc3.start(now + 0.6);
                osc3.stop(now + 1.4);
            } catch (error) {
                console.log('Boot sound not available:', error);
            }
        }
    }
    
    setupDesktopIconListeners() {
        const desktopIconsParent = document.querySelector('.desktop-icons');
        if (!desktopIconsParent) return;
        if (desktopIconsParent._delegated) return;
        desktopIconsParent.addEventListener('click', (e) => {
            const icon = e.target.closest('.desktop-icon');
            if (icon) {
                e.preventDefault();
                e.stopPropagation();
                this.selectIcon(icon);
                this.openFile(icon.dataset.file);
            }
        });
        desktopIconsParent._delegated = true;
    }
    
    animateDesktopIcons() {
        const icons = document.querySelectorAll('.desktop-icon');
        
        icons.forEach((icon, index) => {
            icon.style.opacity = '0';
            icon.style.transform = 'translateY(20px)';
            icon.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
            icon.style.pointerEvents = 'auto'; 
            icon.style.cursor = 'pointer'; 
            icon.style.zIndex = '300'; 
            
            setTimeout(() => {
                icon.style.opacity = '1';
                icon.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }
    
    setupEventListeners() {
        const startButton = domCache.startButton;
        if (startButton) {
            startButton.addEventListener('click', () => {
                this.toggleStartMenu();
            });
        }
        if (domCache.startMenu) {
            domCache.startMenu.addEventListener('click', (e) => {
                const item = e.target.closest('.start-menu-item');
                if (item) {
                    this.openFile(item.dataset.action);
                    this.toggleStartMenu();
                }
            });
        }
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.start-button') && !e.target.closest('.start-menu')) {
                this.closeStartMenu();
            }
        });
        if (domCache.desktopBackground) {
            domCache.desktopBackground.addEventListener('click', () => {
                this.deselectAllIcons();
            });
        }
    }
    
    selectIcon(icon) {
        this.deselectAllIcons();
        icon.classList.add('selected');
        
        this.createRippleEffect(icon);
    }
    
    createRippleEffect(element) {
        const ripple = document.createElement('div');
        ripple.style.position = 'absolute';
        ripple.style.borderRadius = '50%';
        ripple.style.background = 'rgba(255, 255, 255, 0.3)';
        ripple.style.transform = 'scale(0)';
        ripple.style.animation = 'ripple 0.6s linear';
        ripple.style.left = '50%';
        ripple.style.top = '50%';
        ripple.style.width = '100px';
        ripple.style.height = '100px';
        ripple.style.marginLeft = '-50px';
        ripple.style.marginTop = '-50px';
        ripple.style.pointerEvents = 'none';
        
        element.style.position = 'relative';
        element.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }
    
    deselectAllIcons() {
        document.querySelectorAll('.desktop-icon').forEach(icon => {
            icon.classList.remove('selected');
        });
    }
    
    toggleStartMenu() {
        const startMenu = domCache.startMenu;
        this.startMenuOpen = !this.startMenuOpen;
        
        if (this.startMenuOpen) {
            startMenu.classList.add('active');
        } else {
            startMenu.classList.remove('active');
        }
    }
    
    closeStartMenu() {
        const startMenu = domCache.startMenu;
        if (startMenu) {
            startMenu.classList.remove('active');
        }
        this.startMenuOpen = false;
    }
    
    openFile(fileType) {
        const windowData = this.getWindowData(fileType);
        if (windowData) {
            this.createWindow(windowData);
        }
    }
    
    getWindowData(fileType) {
        const windowData = {
            about: {
                title: "About Me.txt",
                content: this.getAboutContent(),
                width: 600,
                height: 500
            },
            resume: {
                title: "Resume.pdf",
                content: this.getResumeContent(),
                width: 700,
                height: 600
            },
            projects: {
                title: "Projects",
                content: this.getProjectsContent(),
                width: 800,
                height: 600
            },
            skills: {
                title: "Skills.exe",
                content: this.getSkillsContent(),
                width: 700,
                height: 500
            },
            contact: {
                title: "Contact.txt",
                content: this.getContactContent(),
                width: 500,
                height: 400
            },
            social: {
                title: "Social Links",
                content: this.getSocialContent(),
                width: 600,
                height: 500
            }
        };
        
        // Browser is handled specially — isBrowser flag triggers different window creation
        windowData['browser'] = {
            title: 'Browser',
            isBrowser: true,
            startUrl: 'https://yep.com',
            content: this.getBrowserContent(),
            width: 960,
            height: 680
        };

        return windowData[fileType] || null;
    }
    
    getBrowserContent() {
        return `
            <div class="browser-chrome">
                <div class="browser-toolbar">
                    <button class="nav-btn back-btn" title="Back">&#8592;</button>
                    <button class="nav-btn fwd-btn" title="Forward">&#8594;</button>
                    <button class="nav-btn reload-btn" title="Reload">&#8635;</button>
                    <input class="url-bar" type="text" spellcheck="false" placeholder="Enter a URL or search...">
                    <a class="nav-btn newtab-btn" href="#" target="_blank" rel="noopener noreferrer" title="Open in new tab">&#8599;</a>
                </div>
                <div class="browser-bookmarks">
                    <button class="bm-chip" data-url="https://andreped.dev">&#127968; My Site</button>
                    <button class="bm-chip" data-url="https://yep.com">&#128269; Yep</button>
                    <button class="bm-chip" data-url="https://en.wikipedia.org/wiki/Artificial_intelligence">&#128218; Wikipedia</button>
                    <button class="bm-chip" data-url="https://www.vg.no">&#128240; VG</button>
                    <button class="bm-chip" data-url="https://andreped-aeropath.hf.space">&#129978; AeroPath</button>
                    <button class="bm-chip" data-url="https://andreped-lynos.hf.space">&#129704; LyNoS</button>
                    <button class="bm-chip" data-url="https://andreped-livermask.hf.space">&#128138; livermask</button>
                </div>
                <div class="browser-viewport">
                    <iframe class="browser-iframe"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        referrerpolicy="no-referrer"></iframe>
                    <div class="browser-blocked">
                        <div class="blocked-icon">&#128683;</div>
                        <p>This site doesn&#39;t allow embedding.</p>
                        <a class="blocked-newtab" href="#" target="_blank" rel="noopener noreferrer">Open in new tab &#8599;</a>
                    </div>
                    <div class="browser-loading">
                        <div class="browser-spinner"></div>
                    </div>
                </div>
            </div>
        `;
    }

    getAboutContent() {
        return `
            <div class="content-section">
                <h2>About Me</h2>
                <p>Hi, I'm André Pedersen — a Senior AI Engineer and researcher with a PhD in Medical Technology from NTNU. I'm passionate about building practical, real-world AI solutions that make a difference, particularly in healthcare. I currently work at DIPS AS in Oslo, Norway, where I develop AI-augmented software for the Norwegian healthcare system.</p>

                <h3>Background</h3>
                <p>I hold an MSc in Applied Physics and Mathematics (specializing in Machine Learning & Statistics) from UiT: The Arctic University of Norway, and a PhD in Medical Technology focused on Artificial Intelligence for Computational Pathology from NTNU, Trondheim. Over eight years of experience in software engineering and applied machine learning have taken me from summer internships at SINTEF to leading production AI deployments used across Norwegian hospitals.</p>

                <h3>What I Do</h3>
                <ul>
                    <li>End-to-end AI development — from model design and validation to scalable cloud deployment</li>
                    <li>Generative AI &amp; large multimodal models for clinical applications</li>
                    <li>Deep learning for medical imaging (segmentation, classification, registration)</li>
                    <li>Fullstack development with React-TypeScript, .NET, and Python</li>
                    <li>Cloud-native infrastructure on Azure with Docker, Kubernetes, and Argo CD</li>
                    <li>Open-source software: CLI tools, Python packages, C++ desktop applications</li>
                </ul>

                <h3>Research</h3>
                <p>I have 30+ peer-reviewed publications, 500+ citations, and an h-index of 15. My research spans computational pathology, brain tumour segmentation, high-performance medical image computing, semi-supervised learning, and natural language processing. I have also co-supervised five Master's students and contributed technically to five PhD projects at NTNU.</p>

                <h3>Philosophy</h3>
                <p>I believe the best technology is invisible — it just works, reliably, for the people who need it most. I aim to bridge the gap between cutting-edge research and production systems, and I'm always looking for the next interesting problem to solve.</p>
            </div>
        `;
    }
    
    getResumeContent() {
        return `
            <div class="content-section">
                <h2>Resume</h2>

                <h3>Experience</h3>

                <div style="margin-bottom: 20px;">
                    <h4>Senior AI Engineer</h4>
                    <p><strong>DIPS AS, Development</strong> | May 2025 – Present &nbsp;·&nbsp; Oslo, Norway</p>
                    <ul>
                        <li>Augmenting healthcare software solutions with AI across Norwegian hospitals.</li>
                        <li>Launched <em>Pasientsamtale</em> into production at Western Norway RHF — speech-to-summary/schema at low latency with high accuracy.</li>
                        <li>Contributed to DIPS' first cloud-based application, DIPS AI, serving as the foundation for all AI solutions at DIPS.</li>
                        <li>Launched DIPS AI into production in two out of four Norwegian health regions.</li>
                        <li>Fullstack development with React-TypeScript, .NET, Python, Azure Speech/OpenAI/DevOps, Docker, Kubernetes, and Argo CD.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 20px;">
                    <h4>Senior Machine Learning Engineer</h4>
                    <p><strong>Sopra Steria, Applications</strong> | Oct. 2023 – May 2025 &nbsp;·&nbsp; Trondheim, Norway</p>
                    <ul>
                        <li>Data scientist/engineer developing a chatbot for Equinor using Azure OpenAI, Vanna, Azure AI Search, React, and PostgreSQL.</li>
                        <li>Tech Lead on a research project with the UNICAN team at St. Olavs Hospital &amp; NTNU — no-code AI solutions for digital pathology.</li>
                        <li>Team Lead for an LLM-based prototype for environmental grading of buildings (Autility), managing three summer interns.</li>
                        <li>Contributed to open-source GenAI projects: Vanna (20k+ stars) and semantic-router (3k+ stars).</li>
                    </ul>
                </div>

                <div style="margin-bottom: 20px;">
                    <h4>Research Scientist</h4>
                    <p><strong>SINTEF, Health Research</strong> | May 2022 – Nov. 2023 &nbsp;·&nbsp; Trondheim, Norway</p>
                    <ul>
                        <li>Key contributor to FastPathology — an open-source C++/Qt5 platform for deep learning in digital pathology.</li>
                        <li>DevOps responsible for Raidionics — open clinical software for automatic brain tumour segmentation and clinical report generation.</li>
                        <li>Developed an open software plugin for cloud-based deployment of AI solutions for digital pathology.</li>
                        <li>Built 4 Gradio demo applications for AI-based medical 3D image segmentation hosted on Hugging Face Spaces.</li>
                        <li>Developed gradient-accumulator (Python/TensorFlow 2) and co-developed torchstain (PyTorch/TF/NumPy stain normalisation).</li>
                    </ul>
                </div>

                <div style="margin-bottom: 20px;">
                    <h4>Research Scientist (MSc period)</h4>
                    <p><strong>SINTEF, Health Research</strong> | Jan. 2019 – May 2022 &nbsp;·&nbsp; Trondheim, Norway</p>
                    <ul>
                        <li>Led a SINTEF-funded project for code-free development and deployment of deep segmentation models for computational pathology.</li>
                        <li>Contributed to multiple funding applications; several achieved funding from the Norwegian Research Council.</li>
                        <li>Statistical analysis and method development for brain tumour MRI segmentation, NLP, and cancer treatment studies.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 20px;">
                    <h4>Summer Internship</h4>
                    <p><strong>SINTEF, Health Research</strong> | Jun. 2018 – Aug. 2018 &nbsp;·&nbsp; Trondheim, Norway</p>
                    <ul>
                        <li>Implemented algorithms and trained AI models for 3D semantic segmentation of medical volumetric CT data using TensorFlow.</li>
                    </ul>
                </div>

                <h3>Education</h3>

                <div style="margin-bottom: 20px;">
                    <h4>PhD in Medical Technology — AI for Computational Pathology</h4>
                    <p><strong>Norwegian University of Science and Technology (NTNU)</strong> | Oct. 2019 – Oct. 2023 &nbsp;·&nbsp; Trondheim, Norway</p>
                    <p>Defended Nov. 2024. Published 17 journal articles, 1 conference paper, and 1 book chapter during the thesis period.</p>
                </div>

                <div style="margin-bottom: 20px;">
                    <h4>MSc in Applied Physics and Mathematics — Machine Learning &amp; Statistics</h4>
                    <p><strong>UiT: The Arctic University of Norway</strong> | Aug. 2014 – Jun. 2019 &nbsp;·&nbsp; Tromsø, Norway</p>
                    <p>Industry project with SINTEF on AI for cancer diagnostics; contributed to a peer-reviewed journal publication.</p>
                </div>

                <h3>Selected Certifications</h3>
                <ul>
                    <li><strong>Microsoft Certified: Azure AI Engineer Associate</strong> — Microsoft (May 2024)</li>
                    <li><strong>Microsoft Certified: Azure Data Scientist Associate</strong> — Microsoft (May 2024)</li>
                    <li><strong>Microsoft Certified: Azure Data Fundamentals</strong> — Microsoft (Jan. 2024)</li>
                    <li><strong>Machine Learning in Production</strong> — DeepLearning.AI / Coursera (May 2024)</li>
                    <li><strong>Generative AI with Large Language Models</strong> — DeepLearning.AI / Coursera (Jan. 2024)</li>
                    <li><strong>TensorFlow Developer Certificate</strong> — Google (Jan. 2023)</li>
                </ul>

                <h3>Teaching</h3>
                <ul>
                    <li><strong>Supervisor</strong> — NTNU/SINTEF (Jan. 2020 – Present): technical contributor to 5 PhD projects; (co-)supervisor of 5 MSc students in Computer Science.</li>
                    <li><strong>Student Teaching Assistant</strong> — UiT (Aug. 2017 – Nov. 2018): led Python programming workshops for FYS-1001 (Mechanics) and FYS-2006 (Signal Processing).</li>
                </ul>
            </div>
        `;
    }
    
    getProjectsContent() {
        return `
            <div class="content-section">
                <h2>Projects</h2>
                <p>A selection of open-source and research projects I've built or significantly contributed to:</p>

                <div class="projects-grid">
                    <div class="project-card">
                        <h4>DIPS AI &amp; Pasientsamtale</h4>
                        <p>DIPS' first cloud-based AI platform, now live in two of four Norwegian health regions. Pasientsamtale delivers speech-to-summary/schema at production scale in Western Norway RHF.</p>
                        <div class="project-tech">
                            <span class="tech-tag">Azure OpenAI</span>
                            <span class="tech-tag">Azure Speech</span>
                            <span class="tech-tag">React-TypeScript</span>
                            <span class="tech-tag">.NET</span>
                            <span class="tech-tag">Kubernetes</span>
                        </div>
                    </div>

                    <div class="project-card">
                        <h4>FastPathology</h4>
                        <p>Open-source C++/Qt5 desktop platform for deep learning-based research and clinical decision support in digital pathology. Published in IEEE Access (2021).</p>
                        <div class="project-tech">
                            <span class="tech-tag">C++</span>
                            <span class="tech-tag">Qt5</span>
                            <span class="tech-tag">FAST</span>
                            <span class="tech-tag">Deep Learning</span>
                            <span class="tech-tag">Digital Pathology</span>
                        </div>
                    </div>

                    <div class="project-card">
                        <h4>Raidionics</h4>
                        <p>Open-source clinical software for automatic pre- and postoperative brain tumour segmentation and standardised clinical report generation. Actively maintained DevOps.</p>
                        <div class="project-tech">
                            <span class="tech-tag">Python</span>
                            <span class="tech-tag">Medical Imaging</span>
                            <span class="tech-tag">Segmentation</span>
                            <span class="tech-tag">CI/CD</span>
                        </div>
                    </div>

                    <div class="project-card">
                        <h4>H2G-Net</h4>
                        <p>Multi-resolution cascaded CNN for breast cancer region segmentation in gigapixel histopathological whole slide images. Dice coefficient of 0.933 on independent test set. Published in Frontiers in Medicine (2022).</p>
                        <div class="project-tech">
                            <span class="tech-tag">PyTorch</span>
                            <span class="tech-tag">Computer Vision</span>
                            <span class="tech-tag">WSI Segmentation</span>
                            <span class="tech-tag">Deep Learning</span>
                        </div>
                    </div>

                    <div class="project-card">
                        <h4>gradient-accumulator</h4>
                        <p>Python package enabling gradient accumulation in TensorFlow 2 — fills a key gap for training large models on limited GPU memory. Available on PyPI.</p>
                        <div class="project-tech">
                            <span class="tech-tag">Python</span>
                            <span class="tech-tag">TensorFlow 2</span>
                            <span class="tech-tag">Open Source</span>
                            <span class="tech-tag">PyPI</span>
                        </div>
                    </div>

                    <div class="project-card">
                        <h4>torchstain</h4>
                        <p>Python package for rapid stain normalisation of histopathological images, supporting PyTorch, TensorFlow, and NumPy backends. Co-developed with EIDOS Lab.</p>
                        <div class="project-tech">
                            <span class="tech-tag">Python</span>
                            <span class="tech-tag">PyTorch</span>
                            <span class="tech-tag">TensorFlow</span>
                            <span class="tech-tag">Histopathology</span>
                        </div>
                    </div>

                    <div class="project-card">
                        <h4>livermask</h4>
                        <p>Open-source command-line tool for automatic liver segmentation from CT volumes using a pre-trained deep learning model.</p>
                        <div class="project-tech">
                            <span class="tech-tag">Python</span>
                            <span class="tech-tag">TensorFlow</span>
                            <span class="tech-tag">CT Segmentation</span>
                            <span class="tech-tag">CLI Tool</span>
                        </div>
                    </div>

                    <div class="project-card">
                        <h4>Open-Source Contributions</h4>
                        <p>Contributed to large community GenAI projects: Vanna (20k+ GitHub stars) — AI-powered SQL generation; semantic-router (3k+ stars) — semantic routing for LLM pipelines.</p>
                        <div class="project-tech">
                            <span class="tech-tag">GenAI</span>
                            <span class="tech-tag">LLM</span>
                            <span class="tech-tag">Python</span>
                            <span class="tech-tag">Open Source</span>
                        </div>
                    </div>
                </div>

                <p style="margin-top:16px;">Full list of publications, datasets, and demos available at <a href="https://andreped.dev" target="_blank" style="color:var(--accent-primary)">andreped.dev</a> and <a href="https://github.com/andreped" target="_blank" style="color:var(--accent-primary)">github.com/andreped</a>.</p>
            </div>
        `;
    }
    
    getSkillsContent() {
        return `
            <div class="content-section">
                <h2>Technical Skills</h2>
                <p>Eight-plus years of hands-on experience across research, engineering, and production deployments.</p>

                <div class="skills-grid">
                    <div class="skill-category">
                        <h4>Programming Languages</h4>
                        <ul>
                            <li>Python (primary)</li>
                            <li>C++ (Qt5, FAST)</li>
                            <li>C# / .NET</li>
                            <li>JavaScript / TypeScript</li>
                            <li>Dart</li>
                        </ul>
                    </div>

                    <div class="skill-category">
                        <h4>AI &amp; Machine Learning</h4>
                        <ul>
                            <li>Deep Learning (TensorFlow 2, PyTorch)</li>
                            <li>Computer Vision &amp; Medical Imaging</li>
                            <li>Generative AI &amp; Large Language Models</li>
                            <li>Semantic Segmentation &amp; Classification</li>
                            <li>Natural Language Processing</li>
                            <li>Semi-supervised &amp; Self-supervised Learning</li>
                        </ul>
                    </div>

                    <div class="skill-category">
                        <h4>Cloud &amp; Infrastructure</h4>
                        <ul>
                            <li>Microsoft Azure (OpenAI, Speech, AI Search, DevOps)</li>
                            <li>Docker &amp; Kubernetes</li>
                            <li>Argo CD (GitOps)</li>
                            <li>CI/CD Pipelines</li>
                            <li>GitHub Actions</li>
                        </ul>
                    </div>

                    <div class="skill-category">
                        <h4>Web &amp; Fullstack</h4>
                        <ul>
                            <li>React + TypeScript</li>
                            <li>ASP.NET / .NET</li>
                            <li>REST APIs</li>
                            <li>Gradio (ML demos)</li>
                            <li>PostgreSQL</li>
                        </ul>
                    </div>

                    <div class="skill-category">
                        <h4>Research &amp; Data</h4>
                        <ul>
                            <li>Statistical Analysis &amp; Experimental Design</li>
                            <li>Scientific Writing (30+ publications)</li>
                            <li>Peer Review (Medical Image Analysis, Nature Sci. Reports, …)</li>
                            <li>Grant Writing &amp; Funding Applications</li>
                            <li>PhD &amp; MSc Supervision</li>
                        </ul>
                    </div>

                    <div class="skill-category">
                        <h4>Tools &amp; Practices</h4>
                        <ul>
                            <li>Git &amp; GitHub</li>
                            <li>Azure OpenAI &amp; Vanna (RAG/SQL)</li>
                            <li>Hugging Face Spaces</li>
                            <li>Agile / Scrum</li>
                            <li>Open-source OSS development</li>
                        </ul>
                    </div>
                </div>

                <div class="skills-section" style="margin-top:16px;">
                    <h3>Microsoft Certifications</h3>
                    <ul>
                        <li>Azure AI Engineer Associate (May 2024)</li>
                        <li>Azure Data Scientist Associate (May 2024)</li>
                        <li>Azure Data Fundamentals (Jan. 2024)</li>
                    </ul>
                </div>
            </div>
        `;
    }
    
    getContactContent() {
        return `
            <div class="content-section">
                <h2>Contact</h2>
                <p>Feel free to reach out for collaborations, research discussions, or just to say hi. I'm most responsive via LinkedIn and email.</p>

                <div class="contact-info">
                    <div class="contact-item">
                        <div class="contact-icon">📧</div>
                        <div class="contact-details">
                            <h4>Email</h4>
                            <p><a href="mailto:andrped94@gmail.com" style="color:inherit">andrped94@gmail.com</a></p>
                        </div>
                    </div>

                    <div class="contact-item">
                        <div class="contact-icon">📱</div>
                        <div class="contact-details">
                            <h4>Phone</h4>
                            <p>(+47) 955 24 208</p>
                        </div>
                    </div>

                    <div class="contact-item">
                        <div class="contact-icon">📍</div>
                        <div class="contact-details">
                            <h4>Location</h4>
                            <p>Trondheim / Oslo, Norway</p>
                        </div>
                    </div>

                    <div class="contact-item">
                        <div class="contact-icon">🌐</div>
                        <div class="contact-details">
                            <h4>Website</h4>
                            <p><a href="https://andreped.dev" target="_blank" style="color:inherit">andreped.dev</a></p>
                        </div>
                    </div>
                </div>

                <h3>Let's Connect</h3>
                <p>Whether you're interested in AI for healthcare, open-source collaboration, or want to discuss research — I'd love to hear from you. I typically reply to emails within a day or two.</p>
            </div>
        `;
    }
    
    getSocialContent() {
        return `
            <div class="content-section">
                <h2>Social &amp; Links</h2>
                <p>Find me across these platforms:</p>

                <div class="social-links">
                    <a href="https://github.com/andreped" class="social-link" target="_blank">
                        <div class="social-icon github">💻</div>
                        <div class="social-details">
                            <h4>GitHub</h4>
                            <p>github.com/andreped</p>
                            <small>Open-source projects, tools, and research code</small>
                        </div>
                    </a>

                    <a href="https://www.linkedin.com/in/andr%C3%A9-pedersen" class="social-link" target="_blank">
                        <div class="social-icon linkedin">💼</div>
                        <div class="social-details">
                            <h4>LinkedIn</h4>
                            <p>linkedin.com/in/andré-pedersen</p>
                            <small>Professional updates and network</small>
                        </div>
                    </a>

                    <a href="https://scholar.google.com/citations?user=U20zUHQAAAAJ" class="social-link" target="_blank">
                        <div class="social-icon">🎓</div>
                        <div class="social-details">
                            <h4>Google Scholar</h4>
                            <p>30+ publications · 500+ citations · h-index 15</p>
                            <small>Full publication list and citation metrics</small>
                        </div>
                    </a>

                    <a href="https://www.researchgate.net/profile/andre-pedersen/" class="social-link" target="_blank">
                        <div class="social-icon">🔬</div>
                        <div class="social-details">
                            <h4>ResearchGate</h4>
                            <p>researchgate.net/profile/andre-pedersen</p>
                            <small>Research profile and preprints</small>
                        </div>
                    </a>

                    <a href="https://andreped.dev" class="social-link" target="_blank">
                        <div class="social-icon">🌐</div>
                        <div class="social-details">
                            <h4>Personal Website</h4>
                            <p>andreped.dev</p>
                            <small>News, demos, CV, and full research portfolio</small>
                        </div>
                    </a>

                    <a href="mailto:andrped94@gmail.com" class="social-link" target="_blank">
                        <div class="social-icon email">📧</div>
                        <div class="social-details">
                            <h4>Email</h4>
                            <p>andrped94@gmail.com</p>
                            <small>Direct contact for opportunities and collaborations</small>
                        </div>
                    </a>
                </div>
            </div>
        `;
    }

    setupBrowserWindow(winEl, startUrl) {
        const iframe    = winEl.querySelector('.browser-iframe');
        const urlBar    = winEl.querySelector('.url-bar');
        const backBtn   = winEl.querySelector('.back-btn');
        const fwdBtn    = winEl.querySelector('.fwd-btn');
        const reloadBtn = winEl.querySelector('.reload-btn');
        const newtabBtn = winEl.querySelector('.newtab-btn');
        const blocked   = winEl.querySelector('.browser-blocked');
        const loading   = winEl.querySelector('.browser-loading');
        const blockedLink = winEl.querySelector('.blocked-newtab');

        if (!iframe) return;

        const nav = { history: [], index: -1 };

        const normaliseUrl = (raw) => {
            const s = raw.trim();
            if (!s) return '';
            if (/^https?:\/\//i.test(s)) return s;
            // looks like a domain
            if (/^[\w-]+\.\w{2,}/.test(s)) return 'https://' + s;
            // treat as search query
            return 'https://yep.com/web?q=' + encodeURIComponent(s);
        };

        const navigate = (url) => {
            if (!url) return;
            // Truncate forward history on new navigation
            nav.history = nav.history.slice(0, nav.index + 1);
            nav.history.push(url);
            nav.index = nav.history.length - 1;
            load(url);
        };

        const load = (url) => {
            if (urlBar) urlBar.value = url;
            if (newtabBtn) newtabBtn.href = url;
            if (blockedLink) blockedLink.href = url;
            if (blocked) blocked.style.display = 'none';
            if (loading) loading.style.display = 'flex';
            iframe.src = url;
            updateNavButtons();
        };

        const updateNavButtons = () => {
            if (backBtn) backBtn.disabled = nav.index <= 0;
            if (fwdBtn)  fwdBtn.disabled  = nav.index >= nav.history.length - 1;
        };

        // Detect blocked (X-Frame-Options / CSP frame-ancestors)
        iframe.addEventListener('load', () => {
            if (loading) loading.style.display = 'none';
            try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                const isBlocked = !doc || !doc.body || doc.body.innerHTML.trim() === '';
                if (blocked) blocked.style.display = isBlocked ? 'flex' : 'none';
            } catch (e) {
                // Cross-origin success — page loaded fine
                if (blocked) blocked.style.display = 'none';
            }
        });

        // Navigation buttons
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
            iframe.src = iframe.src; // eslint-disable-line no-self-assign
        });

        // URL bar
        if (urlBar) {
            urlBar.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.stopPropagation(); navigate(normaliseUrl(urlBar.value)); }
            });
            urlBar.addEventListener('click', (e) => { e.stopPropagation(); urlBar.select(); });
            urlBar.addEventListener('mousedown', (e) => e.stopPropagation());
        }

        // Bookmark chips
        winEl.querySelectorAll('.bm-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                navigate(chip.dataset.url);
            });
        });

        // Initial load
        navigate(startUrl);
    }

    createWindow(windowData) {
        const windowId = `window-${++this.windowCounter}`;
        const window = document.createElement('div');
        window.className = 'window opening';
        window.id = windowId;
        
        const offset = this.windows.length * 30;
        const left = 100 + offset;
        const top = 50 + offset;
        
        window.style.left = `${left}px`;
        window.style.top = `${top}px`;
        window.style.width = `${windowData.width}px`;
        window.style.height = `${windowData.height}px`;
        
        window.style.transform = 'scale(0.3) rotate(-5deg) translateZ(0)';
        window.style.opacity = '0';
        window.style.willChange = 'transform, opacity';
        
        window.innerHTML = `
            <div class="window-header">
                <div class="window-title">${windowData.title}</div>
                <div class="window-controls">
                    <div class="window-control minimize" data-action="minimize">−</div>
                    <div class="window-control maximize" data-action="maximize">□</div>
                    <div class="window-control close" data-action="close">×</div>
                </div>
            </div>
            <div class="window-content">
                ${windowData.content}
            </div>
            <div class="window-resize-handle"></div>
        `;
        
        const windowsContainer = domCache.windowsContainer;
        if (!windowsContainer) return;
        if (windowData.isBrowser) window.classList.add('browser-window');
        windowsContainer.appendChild(window);
        
        this.scheduleUpdate(() => {
            window.style.transform = 'scale(1) rotate(0deg) translateZ(0)';
            window.style.opacity = '1';
            
            setTimeout(() => {
                window.style.willChange = 'auto';
                window.classList.remove('opening');
            }, 600);
        });
        
        this.windows.push({
            id: windowId,
            element: window,
            title: windowData.title,
            isMaximized: false
        });
        
        this.setActiveWindow(windowId);
        
        this.addTaskbarItem(windowId, windowData.title);
        
        this.setupWindowListeners(window, windowId);
        this.makeWindowDraggable(window);
        this.makeWindowResizable(window, windowId);
        if (windowData.isBrowser) {
            this.setupBrowserWindow(window, windowData.startUrl || 'https://andreped.dev');
        }
        this.addSoundEffect('open');
    }
    
    addRippleEffect(element, event) {
        const ripple = document.createElement('span');
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;
        
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.classList.add('ripple-effect');
        
        element.appendChild(ripple);
        
        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, 600);
    }
    
    enhanceIconPerformance() {
        const icons = document.querySelectorAll('.desktop-icon');
        icons.forEach(icon => {
            icon.style.willChange = 'transform';
            icon.style.backfaceVisibility = 'hidden';
            icon.style.transform = 'translateZ(0)';
            
            if (!icon._hoverEnhanced) {
                icon.addEventListener('mouseenter', () => {
                    this.scheduleUpdate(() => {
                        icon.style.transform = 'scale(1.1) translateZ(0)';
                    });
                });
                
                icon.addEventListener('mouseleave', () => {
                    this.scheduleUpdate(() => {
                        icon.style.transform = 'scale(1) translateZ(0)';
                    });
                });
                
                icon._hoverEnhanced = true;
            }
            
            if (!icon._rippleEnhanced) {
                icon.addEventListener('click', (e) => {
                    this.addRippleEffect(icon, e);
                });
                icon._rippleEnhanced = true;
            }
        });
    }
    
    
    enhanceTaskbarPerformance() {
        const taskbar = domCache.taskbar;
        if (taskbar) {
            taskbar.classList.add('enhanced');
            taskbar.style.willChange = 'backdrop-filter, box-shadow';
            taskbar.style.transform = 'translateZ(0)';
            taskbar.style.backfaceVisibility = 'hidden';
        }
        
        const taskbarItems = document.querySelectorAll('.taskbar-item');
        taskbarItems.forEach(item => {
            item.style.willChange = 'transform, background-color';
            item.style.transform = 'translateZ(0)';
            item.style.backfaceVisibility = 'hidden';
        });
    }
    
    setupWindowListeners(window, windowId) {
        window.querySelectorAll('.window-control').forEach(control => {
            control.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = control.dataset.action;
                
                switch (action) {
                    case 'close':
                        this.closeWindow(windowId);
                        break;
                    case 'minimize':
                        this.minimizeWindow(windowId);
                        break;
                    case 'maximize':
                        this.toggleMaximizeWindow(windowId);
                        break;
                }
            });
        });
        
        window.addEventListener('click', () => {
            this.setActiveWindow(windowId);
        });
    }
    
    makeWindowDraggable(window) {
        let isDragging = false;
        let startX, startY, startLeft, startTop;
        
        const header = window.querySelector('.window-header');
        
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.window-control')) return;
            
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseInt(window.style.left, 10);
            startTop = parseInt(window.style.top, 10);
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            
            e.preventDefault();
        });
        
        function onMouseMove(e) {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            window.style.left = `${startLeft + deltaX}px`;
            window.style.top = `${startTop + deltaY}px`;
        }
        
        function onMouseUp() {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }
    }
    
    makeWindowResizable(window, windowId) {
        const resizeHandle = window.querySelector('.window-resize-handle');
        if (!resizeHandle) return;
        resizeHandle.style.position = 'absolute';
        resizeHandle.style.width = '18px';
        resizeHandle.style.height = '18px';
        resizeHandle.style.right = '2px';
        resizeHandle.style.bottom = '2px';
        resizeHandle.style.cursor = 'nwse-resize';
        resizeHandle.style.zIndex = '420';
        resizeHandle.style.background = 'rgba(102,126,234,0.15)';
        resizeHandle.style.borderRadius = '4px';
        resizeHandle.style.display = 'block';
        let isResizing = false;
        let startX, startY, startWidth, startHeight;
        resizeHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = parseInt(window.style.width, 10);
            startHeight = parseInt(window.style.height, 10);
            document.body.style.userSelect = 'none';
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
        const onMouseMove = (e) => {
            if (!isResizing) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            window.style.width = Math.max(400, startWidth + dx) + 'px';
            window.style.height = Math.max(300, startHeight + dy) + 'px';
        };
        const onMouseUp = () => {
            isResizing = false;
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }
    
    setActiveWindow(windowId) {
        this.windows.forEach(win => {
            win.element.style.zIndex = this.windowZIndex;
            win.element.classList.remove('active-window');
        });
        
        const window = this.windows.find(win => win.id === windowId);
        if (window) {
            this.windowZIndex += 1;
            window.element.style.zIndex = this.windowZIndex;
            window.element.classList.add('active-window');
            this.activeWindow = windowId;
            
            const windowIndex = this.windows.findIndex(win => win.id === windowId);
            if (windowIndex > -1) {
                const [movedWindow] = this.windows.splice(windowIndex, 1);
                this.windows.push(movedWindow);
            }
            
            this.updateTaskbar();
            this.addWindowFocusEffect(window.element);
        }
    }
    
    addWindowFocusEffect(windowElement) {
        windowElement.style.transition = 'box-shadow 0.3s ease, transform 0.3s ease';
        windowElement.style.boxShadow = `
            0 20px 60px rgba(0, 0, 0, 0.3),
            0 0 0 1px rgba(255, 255, 255, 0.1),
            0 0 20px rgba(102, 126, 234, 0.2)
        `;
        windowElement.style.transform = 'scale(1.01)';
        
        setTimeout(() => {
            windowElement.style.transform = 'scale(1)';
        }, 300);
    }
    
    closeWindow(windowId) {
        const windowIndex = this.windows.findIndex(win => win.id === windowId);
        if (windowIndex !== -1) {
            const window = this.windows[windowIndex];
            
            this.removeTaskbarItem(windowId);
            
            window.element.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            window.element.style.transform = 'scale(0)';
            window.element.style.opacity = '0';
            
            setTimeout(() => {
                window.element.remove();
            }, 300);
            
            this.windows.splice(windowIndex, 1);
            
            if (this.windows.length > 0) {
                this.setActiveWindow(this.windows[this.windows.length - 1].id);
            } else {
                this.activeWindow = null;
            }
            
            this.addSoundEffect('close');
        }
    }
    
    addSoundEffect(type) {
        const soundIndicator = document.createElement('div');

        const trayIcon = document.getElementById('volumeTrayIcon');
        let indicatorTop = '10px';
        let indicatorLeft = '50%';
        let useLeft = false;

        if (trayIcon) {
            const rect = trayIcon.getBoundingClientRect();
            indicatorTop = (rect.top - 30) + 'px';
            indicatorLeft = (rect.left + rect.width / 2 - 12) + 'px';
            useLeft = true;
        }

        soundIndicator.style.position = 'fixed';
        soundIndicator.style.top = indicatorTop;
        if (useLeft) {
            soundIndicator.style.left = indicatorLeft;
            soundIndicator.style.right = 'auto';
        } else {
            soundIndicator.style.right = '80px';
        }
        soundIndicator.style.width = '24px';
        soundIndicator.style.height = '24px';
        soundIndicator.style.borderRadius = '50%';
        soundIndicator.style.zIndex = '1100';
        soundIndicator.style.animation = 'soundPulse 0.8s ease';
        soundIndicator.style.pointerEvents = 'none';
        soundIndicator.style.display = 'flex';
        soundIndicator.style.alignItems = 'center';
        soundIndicator.style.justifyContent = 'center';
        soundIndicator.style.fontSize = '12px';
        
        switch(type) {
            case 'open':
                soundIndicator.style.background = 'linear-gradient(135deg, #4caf50, #81c784)';
                soundIndicator.textContent = '▶';
                break;
            case 'close':
                soundIndicator.style.background = 'linear-gradient(135deg, #f44336, #e57373)';
                soundIndicator.textContent = '✕';
                break;
            case 'play':
                soundIndicator.style.background = 'linear-gradient(135deg, #ff6b6b, #4ecdc4)';
                soundIndicator.textContent = '♪';
                break;
            case 'stop':
                soundIndicator.style.background = 'linear-gradient(135deg, #95a5a6, #bdc3c7)';
                soundIndicator.textContent = '⏹';
                break;
            default:
                soundIndicator.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
                soundIndicator.textContent = '●';
        }
        
        soundIndicator.style.color = 'white';
        soundIndicator.style.fontWeight = 'bold';
        soundIndicator.style.textShadow = '0 1px 2px rgba(0,0,0,0.5)';
        
        document.body.appendChild(soundIndicator);
        
        
        if (this.audioContext && this.musicPlaying) {
            this.createSoundEffect(type);
        }
        
        setTimeout(() => {
            soundIndicator.remove();
        }, 800);
    }
    
    createSoundEffect(type) {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.sfxGainNode || this.audioContext.destination);
        
        let frequency;
        let duration = 0.2;
        
        switch(type) {
            case 'open':
                frequency = 800;
                break;
            case 'close':
                frequency = 400;
                break;
            case 'play':
                frequency = 600;
                duration = 0.3;
                break;
            case 'stop':
                frequency = 300;
                duration = 0.3;
                break;
            default:
                frequency = 500;
        }
        
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }
    
    minimizeWindow(windowId) {
        const window = this.windows.find(win => win.id === windowId);
        if (window) {
            window.element.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
            window.element.style.transform = 'scale(0.1) translateY(200px)';
            window.element.style.opacity = '0';
            
            setTimeout(() => {
                window.element.style.display = 'none';
                window.element.style.transform = '';
                window.element.style.opacity = '';
                window.element.style.transition = '';
            }, 400);
            
            this.updateTaskbarItemState(windowId, true);
            
            if (this.activeWindow === windowId) {
                const visibleWindow = this.windows.find(win => 
                    win.id !== windowId && win.element.style.display !== 'none'
                );
                
                if (visibleWindow) {
                    this.setActiveWindow(visibleWindow.id);
                } else {
                    this.activeWindow = null;
                }
            }
            
            this.updateTaskbar();
            this.addSoundEffect('minimize');
        }
    }
    
    toggleMaximizeWindow(windowId) {
        const win = this.windows.find(w => w.id === windowId);
        if (!win) return;
        const window = win.element;
        if (win.isMaximized) {
            if (win.prevRect) {
                window.style.left = win.prevRect.left;
                window.style.top = win.prevRect.top;
                window.style.width = win.prevRect.width;
                window.style.height = win.prevRect.height;
            }
            window.classList.remove('maximized');
            win.isMaximized = false;
        } else {
            win.prevRect = {
                left: window.style.left,
                top: window.style.top,
                width: window.style.width,
                height: window.style.height
            };
            window.style.left = '0px';
            window.style.top = '0px';
            window.style.width = '100vw';
            window.style.height = 'calc(100vh - 56px)';
            window.classList.add('maximized');
            win.isMaximized = true;
        }
    }
    
    addTaskbarItem(windowId, title) {
        const taskbarItems = domCache.taskbarItems;
        const appType = this.getAppType(title);
        const existingGroup = this.groupedApps.get(appType);
        
        if (existingGroup && existingGroup.windows.length > 0) {
            existingGroup.windows.push(windowId);
            this.updateTaskbarGroup(appType);
            
            existingGroup.element.dataset.windowId = existingGroup.windows.join(',');
        } else {
            const taskbarItem = document.createElement('div');
            taskbarItem.className = 'taskbar-item';
            taskbarItem.dataset.windowId = windowId;
            taskbarItem.dataset.appType = appType;
            
            const icon = this.getWindowIcon(title);
            taskbarItem.innerHTML = `
                <span class="taskbar-icon">${icon}</span>
                <span class="taskbar-title">${title}</span>
                <div class="window-preview hidden">
                    <div class="preview-thumbnail"></div>
                    <div class="preview-title">${title}</div>
                </div>
            `;
            
            this.groupedApps.set(appType, {
                element: taskbarItem,
                windows: [windowId],
                title: title
            });
            
            this.setupTaskbarItemEvents(taskbarItem, windowId, appType);
            
            taskbarItem.style.opacity = '0';
            taskbarItem.style.transform = 'translateY(10px) scale(0.8)';
            taskbarItems.appendChild(taskbarItem);
            
            setTimeout(() => {
                taskbarItem.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                taskbarItem.style.opacity = '1';
                taskbarItem.style.transform = 'translateY(0) scale(1)';
            }, 50);
        }
        
        this.updateTaskbar();
    }
    
    setupTaskbarItemEvents(taskbarItem, windowId, appType) {
        taskbarItem.addEventListener('click', (e) => {
            e.preventDefault();
            const group = this.groupedApps.get(appType);
            
            if (!group || group.windows.length === 0) return;
            
            if (group.windows.length === 1) {
                const actualWindowId = group.windows[0];
                const window = this.windows.find(win => win.id === actualWindowId);
                if (window) {
                    if (window.element.style.display === 'none') {
                        window.element.style.display = 'block';
                        this.updateTaskbarItemState(actualWindowId, false);
                        this.animateWindowRestore(window.element);
                        this.setActiveWindow(actualWindowId);
                    } else if (this.activeWindow === actualWindowId) {
                        this.minimizeWindow(actualWindowId);
                    } else {
                        this.setActiveWindow(actualWindowId);
                    }
                }
            } else {
                this.showWindowGroupSwitcher(appType, e);
            }
        });
        
        let hoverTimeout;
        taskbarItem.addEventListener('mouseenter', (e) => {
            hoverTimeout = setTimeout(() => {
                this.showWindowPreview(taskbarItem, appType);
            }, 500);
        });
        
        taskbarItem.addEventListener('mouseleave', () => {
            clearTimeout(hoverTimeout);
            this.hideWindowPreview(taskbarItem);
        });
        
        taskbarItem.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showTaskbarContextMenu(e, group.windows[0], appType);
        });
    }
    
    showWindowPreview(taskbarItem, appType) {
        const preview = taskbarItem.querySelector('.window-preview');
        const group = this.groupedApps.get(appType);
        
        if (group && preview) {
            const window = this.windows.find(win => win.id === group.windows[0]);
            if (window) {
                const thumbnail = preview.querySelector('.preview-thumbnail');
                thumbnail.innerHTML = `
                    <div class="mini-window">
                        <div class="mini-header">${window.title}</div>
                        <div class="mini-content">${this.getWindowIcon(window.title)}</div>
                    </div>
                `;
            }
            
            preview.classList.remove('hidden');
        }
    }
    
    hideWindowPreview(taskbarItem) {
        const preview = taskbarItem.querySelector('.window-preview');
        if (preview) {
            preview.classList.add('hidden');
        }
    }
    
    showWindowGroupSwitcher(appType, event) {
        const group = this.groupedApps.get(appType);
        if (!group || group.windows.length <= 1) return;
        
        const switcher = document.createElement('div');
        switcher.className = 'taskbar-group-switcher';
        switcher.innerHTML = `
            <div class="group-switcher-content">
                ${group.windows.map(winId => {
                    const win = this.windows.find(w => w.id === winId);
                    return `
                        <div class="group-window-item" data-window-id="${winId}">
                            <div class="group-window-preview">
                                ${this.getWindowIcon(win.title)}
                            </div>
                            <div class="group-window-title">${win.title}</div>
                            <div class="group-window-close" data-action="close">×</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        const rect = event.currentTarget.getBoundingClientRect();
        switcher.style.cssText = `
            position: fixed;
            bottom: 60px;
            left: ${rect.left}px;
            z-index: 10000;
        `;
        
        document.body.appendChild(switcher);
        
        switcher.addEventListener('click', (e) => {
            const windowItem = e.target.closest('.group-window-item');
            const closeBtn = e.target.closest('.group-window-close');
            
            if (closeBtn) {
                e.stopPropagation();
                const windowId = windowItem.dataset.windowId;
                this.closeWindow(windowId);
                switcher.remove();
            } else if (windowItem) {
                const windowId = windowItem.dataset.windowId;
                this.setActiveWindow(windowId);
                switcher.remove();
            }
        });
        
        setTimeout(() => {
            document.addEventListener('click', function closeGroupSwitcher(e) {
                if (!switcher.contains(e.target)) {
                    switcher.remove();
                    document.removeEventListener('click', closeGroupSwitcher);
                }
            });
        }, 100);
    }
    
    updateTaskbarGroup(appType) {
        const group = this.groupedApps.get(appType);
        if (!group) return;
        
        const activeWindows = group.windows.filter(winId => 
            this.windows.find(w => w.id === winId)
        );
        
        group.windows = activeWindows;
        
        if (activeWindows.length === 0) {
            group.element.remove();
            this.groupedApps.delete(appType);
        } else if (activeWindows.length > 1) {
            group.element.classList.add('grouped');
            const titleSpan = group.element.querySelector('.taskbar-title');
            if (titleSpan) {
                titleSpan.textContent = `${group.title} (${activeWindows.length})`;
            }
        } else {
            group.element.classList.remove('grouped');
            const titleSpan = group.element.querySelector('.taskbar-title');
            if (titleSpan) {
                titleSpan.textContent = group.title;
            }
        }
    }
    
    updateTaskbarItemState(windowId, isMinimized) {
        const window = this.windows.find(win => win.id === windowId);
        if (!window) return;
        
        const appType = this.getAppType(window.title);
        const group = this.groupedApps.get(appType);
        
        if (group && group.element) {
            const groupWindows = group.windows.map(winId => 
                this.windows.find(win => win.id === winId)
            ).filter(win => win);
            
            const allMinimized = groupWindows.every(win => 
                win.element.style.display === 'none'
            );
            
            if (allMinimized) {
                group.element.classList.add('minimized');
            } else {
                group.element.classList.remove('minimized');
            }
        }
        
        this.updateTaskbar();
    }
    
    removeTaskbarItem(windowId) {
        const window = this.windows.find(win => win.id === windowId);
        if (!window) return;
        
        const appType = this.getAppType(window.title);
        const group = this.groupedApps.get(appType);
        
        if (group) {
            group.windows = group.windows.filter(id => id !== windowId);
            
            if (group.windows.length === 0) {
                if (group.element) {
                    group.element.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                    group.element.style.opacity = '0';
                    group.element.style.transform = 'translateY(10px) scale(0.8)';
                    
                    setTimeout(() => {
                        if (group.element.parentNode) {
                            group.element.remove();
                        }
                    }, 300);
                }
                this.groupedApps.delete(appType);
            } else {
                this.updateTaskbarGroup(appType);
            }
        }
    }
    
    getWindowIcon(title) {
        if (title.includes('About')) return '👤';
        if (title.includes('Resume')) return '📄';
        if (title.includes('Projects')) return '📁';
        if (title.includes('Skills')) return '⚙️';
        if (title.includes('Contact')) return '📧';
        if (title.includes('Social')) return '🌐';
        return '📋'; 
    }
    
    animateWindowRestore(windowElement) {
        windowElement.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        windowElement.style.transform = 'scale(0.9) translateY(20px)';
        windowElement.style.opacity = '0.8';
        
        setTimeout(() => {
            windowElement.style.transform = 'scale(1) translateY(0)';
            windowElement.style.opacity = '1';
            
            setTimeout(() => {
                windowElement.style.transition = '';
            }, 400);
        }, 50);
    }
    
    showTaskbarContextMenu(event, windowId) {
        const menu = document.createElement('div');
        menu.className = 'taskbar-context-menu';
        menu.style.cssText = `
            position: fixed;
            top: ${event.clientY - 60}px;
            left: ${event.clientX}px;
            background: rgba(20, 20, 20, 0.95);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            padding: 8px 0;
            z-index: 10000;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
            color: white;
            font-size: 13px;
            min-width: 120px;
        `;
        
        const menuItems = [
            { text: 'Restore', action: () => this.setActiveWindow(windowId) },
            { text: 'Minimize', action: () => this.minimizeWindow(windowId) },
            { text: 'Close', action: () => this.closeWindow(windowId) }
        ];
        
        menuItems.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.textContent = item.text;
            menuItem.style.cssText = `
                padding: 8px 16px;
                cursor: pointer;
                transition: background 0.2s ease;
            `;
            
            menuItem.addEventListener('mouseenter', () => {
                menuItem.style.background = 'rgba(255, 255, 255, 0.1)';
            });
            
            menuItem.addEventListener('mouseleave', () => {
                menuItem.style.background = 'transparent';
            });
            
            menuItem.addEventListener('click', () => {
                item.action();
                document.body.removeChild(menu);
            });
            
            menu.appendChild(menuItem);
        });
        
        document.body.appendChild(menu);
        
        setTimeout(() => {
            document.addEventListener('click', function removeMenu() {
                if (document.body.contains(menu)) {
                    document.body.removeChild(menu);
                }
                document.removeEventListener('click', removeMenu);
            });
        }, 100);
    }
    
    updateTaskbar() {
        this.groupedApps.forEach((group, appType) => {
            if (!group.element) return;
            
            const groupWindows = group.windows.map(winId => 
                this.windows.find(win => win.id === winId)
            ).filter(win => win);
            
            if (groupWindows.length === 0) {
                group.element.remove();
                this.groupedApps.delete(appType);
                return;
            }
            
            group.windows = groupWindows.map(win => win.id);
            
            const hasActiveWindow = groupWindows.some(win => 
                this.activeWindow === win.id && win.element.style.display !== 'none'
            );
            
            const allMinimized = groupWindows.every(win => 
                win.element.style.display === 'none'
            );
            
            if (hasActiveWindow) {
                group.element.classList.add('active');
                group.element.classList.remove('minimized');
            } else {
                group.element.classList.remove('active');
            }
            
            if (allMinimized) {
                group.element.classList.add('minimized');
            } else {
                group.element.classList.remove('minimized');
            }
            
            const titleSpan = group.element.querySelector('.taskbar-title');
            if (titleSpan) {
                if (groupWindows.length > 1) {
                    titleSpan.textContent = `${group.title} (${groupWindows.length})`;
                    group.element.classList.add('grouped');
                } else {
                    titleSpan.textContent = group.title;
                    group.element.classList.remove('grouped');
                }
            }
        });
        
        const startButton = domCache.startButton;
        const startMenu = domCache.startMenu;
        if (startButton && startMenu) {
            if (this.startMenuOpen) {
                startButton.classList.add('active');
            } else {
                startButton.classList.remove('active');
            }
        }
    }
    
    updateClock() {
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateString = now.toLocaleDateString();
        if (domCache.timeElem) domCache.timeElem.textContent = timeString;
        if (domCache.dateElem) domCache.dateElem.textContent = dateString;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.desktopPortfolio = new DesktopPortfolio();
});
