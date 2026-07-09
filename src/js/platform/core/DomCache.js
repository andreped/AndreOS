/**
 * Builds and returns a snapshot of all frequently-accessed DOM nodes.
 * Call once after DOMContentLoaded and pass the result to sub-systems.
 */
export function buildDomCache() {
    return {
        masterToggle:       document.getElementById('masterToggle'),
        musicToggle:        document.getElementById('musicToggle'),
        sfxToggle:          document.getElementById('sfxToggle'),
        masterVolumeSlider: document.getElementById('masterVolumeSlider'),
        musicVolumeSlider:  document.getElementById('musicVolumeSlider'),
        sfxVolumeSlider:    document.getElementById('sfxVolumeSlider'),
        desktop:            document.querySelector('.desktop'),
        windowsContainer:   document.querySelector('.windows-container'),
        taskbar:            document.querySelector('.taskbar'),
        taskbarItems:       document.querySelector('.taskbar-items'),
        startButton:        document.querySelector('.start-button'),
        startMenu:          document.querySelector('.start-menu'),
        desktopIcons:       document.querySelectorAll('.desktop-icon'),
        desktopBackground:  document.querySelector('.desktop-background'),
        timeElem:           document.querySelector('.time'),
        dateElem:           document.querySelector('.date'),
        particles:          document.querySelectorAll('.particle'),
    };
}
