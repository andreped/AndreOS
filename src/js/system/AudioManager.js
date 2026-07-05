/**
 * AudioManager
 *
 * Owns the Web Audio API context, background music synthesis, SFX,
 * volume controls, and settings persistence.
 */
export class AudioManager {
    constructor(dom) {
        this._dom           = dom;
        this.audioContext   = null;
        this.musicPlaying   = false;
        this.masterGainNode = null;
        this.masterMuted    = false;
        this.musicGainNode  = null;
        this.sfxGainNode    = null;
        this.sfxMuted       = false;
    }

    /** Initialise AudioContext and wire up UI controls. */
    init() {
        try {
            this.audioContext   = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGainNode = this.audioContext.createGain();
            this.masterGainNode.gain.value = (this._dom.masterVolumeSlider?.value ?? 80) / 100;
            this.masterGainNode.connect(this.audioContext.destination);
            this.musicGainNode = this.audioContext.createGain();
            this.musicGainNode.gain.value = (this._dom.musicVolumeSlider?.value ?? 30) / 100;
            this.musicGainNode.connect(this.masterGainNode);
            this.sfxGainNode = this.audioContext.createGain();
            this.sfxGainNode.gain.value = (this._dom.sfxVolumeSlider?.value ?? 60) / 100;
            this.sfxGainNode.connect(this.masterGainNode);
        } catch (_) { /* audio unavailable */ }

        this._setupControls();
        this._setupGestureUnlock();
    }

    /** Resume AudioContext after the first user gesture, then start music if flagged. */
    _setupGestureUnlock() {
        const unlock = () => {
            if (this.audioContext?.state === 'suspended') {
                this.audioContext.resume().then(() => {
                    this.playBootSound();
                    if (this.musicPlaying) this.createAmbientMusic();
                }).catch(() => {});
            }
        };
        document.addEventListener('click',      unlock, { once: true });
        document.addEventListener('keydown',    unlock, { once: true });
        document.addEventListener('touchstart', unlock, { once: true });
    }

    startMusic() {
        this.musicPlaying = true;
        const { musicToggle, desktop } = this._dom;
        musicToggle?.classList.add('playing');
        musicToggle?.classList.remove('muted');
        const tray = document.getElementById('volumeTrayIcon');
        if (tray) tray.textContent = '🎵';
        this._saveSettings();
        desktop?.classList.add('music-playing');
        if (this.audioContext?.state === 'running') this.createAmbientMusic();
        this.addSoundEffect('play');
    }

    stopMusic() {
        this.musicPlaying = false;
        const { musicToggle, desktop } = this._dom;
        musicToggle?.classList.remove('playing');
        musicToggle?.classList.add('muted');
        const tray = document.getElementById('volumeTrayIcon');
        if (tray) tray.textContent = '🔇';
        desktop?.classList.remove('music-playing');
        this.audioContext?.suspend();
        this.addSoundEffect('stop');
        this._saveSettings();
    }

    toggleMusic() {
        if (this.musicPlaying) {
            this.stopMusic();
        } else {
            if (this.audioContext?.state === 'suspended') {
                this.audioContext.resume().catch(() => {});
            }
            this.startMusic();
        }
    }

    toggleSfx() {
        this.sfxMuted = !this.sfxMuted;
        this._dom.sfxToggle?.classList.toggle('muted', this.sfxMuted);
        if (this.sfxGainNode) {
            this.sfxGainNode.gain.value = this.sfxMuted
                ? 0
                : (this._dom.sfxVolumeSlider?.value ?? 60) / 100;
        }
        this._saveSettings();
    }

    /** Shows a floating visual indicator near the volume tray and plays a short sound. */
    addSoundEffect(type) {
        const trayIcon = document.getElementById('volumeTrayIcon');
        let top  = '10px';
        let left = null;

        if (trayIcon) {
            const rect = trayIcon.getBoundingClientRect();
            top  = (rect.top - 30) + 'px';
            left = (rect.left + rect.width / 2 - 12) + 'px';
        }

        const indicator = document.createElement('div');
        indicator.style.cssText = `
            position:fixed; top:${top}; ${left ? `left:${left}; right:auto;` : 'right:80px;'}
            width:24px; height:24px; border-radius:50%; z-index:1100;
            animation:soundPulse 0.8s ease; pointer-events:none;
            display:flex; align-items:center; justify-content:center;
            font-size:12px; color:white; font-weight:bold; text-shadow:0 1px 2px rgba(0,0,0,0.5);
        `;

        const styles = {
            open:  ['linear-gradient(135deg,#4caf50,#81c784)',  '▶'],
            close: ['linear-gradient(135deg,#f44336,#e57373)',  '✕'],
            play:  ['linear-gradient(135deg,#ff6b6b,#4ecdc4)',  '♪'],
            stop:  ['linear-gradient(135deg,#95a5a6,#bdc3c7)',  '⏹'],
        };
        const [bg, text] = styles[type] ?? ['linear-gradient(135deg,#667eea,#764ba2)', '●'];
        indicator.style.background = bg;
        indicator.textContent = text;

        document.body.appendChild(indicator);
        if (this.audioContext && this.musicPlaying) this._playSoundEffect(type);
        setTimeout(() => indicator.remove(), 800);
    }

    playBootSound() {
        if (!this.audioContext) return;
        try {
            const now = this.audioContext.currentTime;
            [[349.23, 0], [440.00, 0.3], [587.33, 0.6]].forEach(([freq, offset]) => {
                const osc  = this.audioContext.createOscillator();
                const gain = this.audioContext.createGain();
                osc.connect(gain);
                gain.connect(this.sfxGainNode ?? this.audioContext.destination);
                osc.frequency.setValueAtTime(freq, now + offset);
                osc.type = 'sine';
                gain.gain.setValueAtTime(0, now + offset);
                gain.gain.linearRampToValueAtTime(0.08, now + offset + 0.1);
                gain.gain.linearRampToValueAtTime(0, now + offset + 0.6);
                osc.start(now + offset);
                osc.stop(now + offset + 0.8);
            });
        } catch (_) {}
    }

    playPowerOnSound() {
        if (!this.audioContext) return;
        try {
            const now  = this.audioContext.currentTime;
            const osc  = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            osc.connect(gain);
            gain.connect(this.sfxGainNode ?? this.audioContext.destination);
            osc.frequency.setValueAtTime(80, now);
            osc.frequency.exponentialRampToValueAtTime(200, now + 0.3);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.6);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.1, now + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
            osc.type = 'sine';
            osc.start(now);
            osc.stop(now + 0.8);
        } catch (_) {}
    }

    createAmbientMusic() {
        if (!this.audioContext) return;

        const happyScale      = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];
        const cheerfulChords  = [
            [261.63, 329.63, 392.00],
            [392.00, 493.88, 587.33],
            [440.00, 523.25, 659.25],
            [349.23, 440.00, 523.25],
        ];

        const createMelodyNote = (delay = 0) => {
            setTimeout(() => {
                if (!this.musicPlaying) return;
                const osc    = this.audioContext.createOscillator();
                const gain   = this.audioContext.createGain();
                const filter = this.audioContext.createBiquadFilter();
                osc.connect(filter); filter.connect(gain); gain.connect(this.musicGainNode);
                osc.frequency.setValueAtTime(happyScale[Math.floor(Math.random() * happyScale.length)], this.audioContext.currentTime);
                osc.type = 'triangle';
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(1800, this.audioContext.currentTime);
                gain.gain.setValueAtTime(0, this.audioContext.currentTime);
                gain.gain.linearRampToValueAtTime(0.035, this.audioContext.currentTime + 0.2);
                gain.gain.linearRampToValueAtTime(0.025, this.audioContext.currentTime + 1);
                gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 1.8);
                osc.start(this.audioContext.currentTime);
                osc.stop(this.audioContext.currentTime + 1.8);
                setTimeout(() => { if (this.musicPlaying) createMelodyNote(300 + Math.random() * 700); }, 1200 + Math.random() * 800);
            }, delay);
        };

        const createChordPad = (chordIndex, delay = 0) => {
            setTimeout(() => {
                if (!this.musicPlaying) return;
                cheerfulChords[chordIndex % cheerfulChords.length].forEach((freq) => {
                    const osc    = this.audioContext.createOscillator();
                    const gain   = this.audioContext.createGain();
                    const filter = this.audioContext.createBiquadFilter();
                    osc.connect(filter); filter.connect(gain); gain.connect(this.musicGainNode);
                    osc.frequency.setValueAtTime(freq * 0.5, this.audioContext.currentTime);
                    osc.type = 'sine';
                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(1000, this.audioContext.currentTime);
                    gain.gain.setValueAtTime(0, this.audioContext.currentTime);
                    gain.gain.linearRampToValueAtTime(0.012, this.audioContext.currentTime + 0.5);
                    gain.gain.linearRampToValueAtTime(0.01, this.audioContext.currentTime + 3);
                    gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 4);
                    osc.start(this.audioContext.currentTime);
                    osc.stop(this.audioContext.currentTime + 4);
                });
                setTimeout(() => { if (this.musicPlaying) createChordPad((chordIndex + 1) % cheerfulChords.length, 0); }, 4000);
            }, delay);
        };

        const createSparkle = (delay = 0) => {
            setTimeout(() => {
                if (!this.musicPlaying) return;
                const osc    = this.audioContext.createOscillator();
                const gain   = this.audioContext.createGain();
                const filter = this.audioContext.createBiquadFilter();
                osc.connect(filter); filter.connect(gain); gain.connect(this.musicGainNode);
                const sparkleNotes = [783.99, 880.00, 987.77, 1046.50, 1174.66];
                osc.frequency.setValueAtTime(sparkleNotes[Math.floor(Math.random() * sparkleNotes.length)], this.audioContext.currentTime);
                osc.type = 'sine';
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(2500, this.audioContext.currentTime);
                gain.gain.setValueAtTime(0, this.audioContext.currentTime);
                gain.gain.linearRampToValueAtTime(0.02, this.audioContext.currentTime + 0.1);
                gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.6);
                osc.start(this.audioContext.currentTime);
                osc.stop(this.audioContext.currentTime + 0.6);
                setTimeout(() => { if (this.musicPlaying) createSparkle(0); }, 2000 + Math.random() * 3000);
            }, delay);
        };

        const createRhythm = (delay = 0) => {
            setTimeout(() => {
                if (!this.musicPlaying) return;
                const osc    = this.audioContext.createOscillator();
                const gain   = this.audioContext.createGain();
                const filter = this.audioContext.createBiquadFilter();
                osc.connect(filter); filter.connect(gain); gain.connect(this.musicGainNode);
                osc.frequency.setValueAtTime(130.81, this.audioContext.currentTime);
                osc.type = 'triangle';
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(300, this.audioContext.currentTime);
                gain.gain.setValueAtTime(0, this.audioContext.currentTime);
                gain.gain.linearRampToValueAtTime(0.015, this.audioContext.currentTime + 0.05);
                gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.3);
                osc.start(this.audioContext.currentTime);
                osc.stop(this.audioContext.currentTime + 0.3);
                setTimeout(() => { if (this.musicPlaying) createRhythm(0); }, 2400);
            }, delay);
        };

        if (this.musicPlaying) {
            createMelodyNote(0);
            createChordPad(0, 800);
            createSparkle(1600);
            createRhythm(2400);
            setTimeout(() => { if (this.musicPlaying) createMelodyNote(Math.random() * 600); }, 2000);
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    toggleMaster() {
        this.masterMuted = !this.masterMuted;
        this._dom.masterToggle?.classList.toggle('muted', this.masterMuted);
        if (this.masterGainNode) {
            this.masterGainNode.gain.value = this.masterMuted
                ? 0
                : (this._dom.masterVolumeSlider?.value ?? 80) / 100;
        }
        this._saveSettings();
    }

    _setupControls() {
        const { masterToggle, musicToggle, sfxToggle, masterVolumeSlider, musicVolumeSlider, sfxVolumeSlider } = this._dom;
        const volumeTrayIcon = document.getElementById('volumeTrayIcon');
        const volumePopup    = document.getElementById('volumePopup');

        this._applySettings(this._loadSettings());

        if (masterToggle)      masterToggle.addEventListener('click', () => this.toggleMaster());
        if (musicToggle)       musicToggle.addEventListener('click',  () => this.toggleMusic());
        if (sfxToggle)         sfxToggle.addEventListener('click',    () => this.toggleSfx());

        if (masterVolumeSlider) {
            this._updateSliderTrack(masterVolumeSlider);
            this._updatePct('masterPct', masterVolumeSlider.value);
            masterVolumeSlider.addEventListener('input', (e) => {
                this._updateSliderTrack(e.target);
                this._updatePct('masterPct', e.target.value);
                if (this.masterGainNode && !this.masterMuted) {
                    this.masterGainNode.gain.value = e.target.value / 100;
                }
                this._saveSettings();
            });
        }

        if (musicVolumeSlider) {
            this._updateSliderTrack(musicVolumeSlider);
            this._updatePct('musicPct', musicVolumeSlider.value);
            musicVolumeSlider.addEventListener('input', (e) => {
                this._updateSliderTrack(e.target);
                this._updatePct('musicPct', e.target.value);
                if (this.musicGainNode && this.musicPlaying) {
                    this.musicGainNode.gain.value = e.target.value / 100;
                }
                this._saveSettings();
            });
        }

        if (sfxVolumeSlider) {
            this._updateSliderTrack(sfxVolumeSlider);
            this._updatePct('sfxPct', sfxVolumeSlider.value);
            sfxVolumeSlider.addEventListener('input', (e) => {
                this._updateSliderTrack(e.target);
                this._updatePct('sfxPct', e.target.value);
                if (this.sfxGainNode && !this.sfxMuted) {
                    this.sfxGainNode.gain.value = e.target.value / 100;
                }
                this._saveSettings();
            });
        }

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

        const ncClearAll = document.getElementById('ncClearAll');
        if (ncClearAll) {
            ncClearAll.addEventListener('click', () => {
                const list = document.getElementById('ncList');
                if (list) list.innerHTML = '<div class="nc-empty">No new notifications</div>';
            });
        }
    }

    _updateSliderTrack(slider) {
        const pct = slider.value / slider.max * 100;
        slider.style.background = `linear-gradient(to right,
            rgba(255,107,107,0.9) 0%,
            rgba(78,205,196,0.9) ${pct}%,
            rgba(255,255,255,0.15) ${pct}%,
            rgba(255,255,255,0.15) 100%)`;
    }

    _updatePct(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = Math.round(value) + '%';
    }

    _saveSettings() {
        try {
            const { masterVolumeSlider, musicVolumeSlider, sfxVolumeSlider } = this._dom;
            localStorage.setItem('andreOS_audio', JSON.stringify({
                masterVolume: masterVolumeSlider ? Number(masterVolumeSlider.value) : 80,
                musicVolume:  musicVolumeSlider  ? Number(musicVolumeSlider.value)  : 30,
                sfxVolume:    sfxVolumeSlider    ? Number(sfxVolumeSlider.value)    : 60,
                masterMuted:  this.masterMuted,
                musicMuted:   !this.musicPlaying,
                sfxMuted:     this.sfxMuted,
            }));
        } catch (_) {}
    }

    _loadSettings() {
        try {
            const raw = localStorage.getItem('andreOS_audio');
            return raw ? JSON.parse(raw) : null;
        } catch (_) { return null; }
    }

    _applySettings(settings) {
        if (!settings) return;
        const { masterVolumeSlider, musicVolumeSlider, sfxVolumeSlider, masterToggle, musicToggle, sfxToggle } = this._dom;

        if (masterVolumeSlider && settings.masterVolume != null) {
            masterVolumeSlider.value = settings.masterVolume;
            this._updateSliderTrack(masterVolumeSlider);
            this._updatePct('masterPct', settings.masterVolume);
            if (this.masterGainNode) {
                this.masterGainNode.gain.value = settings.masterMuted ? 0 : settings.masterVolume / 100;
            }
        }

        this.masterMuted = !!settings.masterMuted;
        masterToggle?.classList.toggle('muted', this.masterMuted);

        if (musicVolumeSlider) {
            musicVolumeSlider.value = settings.musicVolume;
            this._updateSliderTrack(musicVolumeSlider);
            this._updatePct('musicPct', settings.musicVolume);
            if (this.musicGainNode) {
                this.musicGainNode.gain.value = settings.musicMuted ? 0 : settings.musicVolume / 100;
            }
        }

        if (sfxVolumeSlider) {
            sfxVolumeSlider.value = settings.sfxVolume;
            this._updateSliderTrack(sfxVolumeSlider);
            this._updatePct('sfxPct', settings.sfxVolume);
            if (this.sfxGainNode) {
                this.sfxGainNode.gain.value = settings.sfxMuted ? 0 : settings.sfxVolume / 100;
            }
        }

        this.sfxMuted = !!settings.sfxMuted;
        sfxToggle?.classList.toggle('muted', this.sfxMuted);

        if (settings.musicMuted) {
            this.musicPlaying = false;
            musicToggle?.classList.remove('playing');
            musicToggle?.classList.add('muted');
            const tray = document.getElementById('volumeTrayIcon');
            if (tray) tray.textContent = '🔇';
        }
    }

    _playSoundEffect(type) {
        if (!this.audioContext) return;
        const osc  = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.connect(gain);
        gain.connect(this.sfxGainNode ?? this.audioContext.destination);
        const freqMap = { open: 800, close: 400, play: 600, stop: 300 };
        const durMap  = { play: 0.3, stop: 0.3 };
        osc.frequency.setValueAtTime(freqMap[type] ?? 500, this.audioContext.currentTime);
        osc.type = 'sine';
        const dur = durMap[type] ?? 0.2;
        gain.gain.setValueAtTime(0, this.audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + dur);
        osc.start(this.audioContext.currentTime);
        osc.stop(this.audioContext.currentTime + dur);
    }
}
