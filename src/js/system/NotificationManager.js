/**
 * NotificationManager
 *
 * Owns the notification centre panel, toast queue, and live progress cards.
 * No dependency on any other AndreOS module — entirely self-contained.
 */
export class NotificationManager {
    constructor() {
        this._ncUnread = 0;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /** Full notification: persists in NC + shows a toast. */
    push(title, message, icon = 'ℹ️', type = 'info', onClick = null) {
        const list = document.getElementById('ncList');
        if (list) {
            const empty = list.querySelector('.nc-empty');
            if (empty) empty.remove();

            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const item = document.createElement('div');
            item.className = 'nc-item';
            item.innerHTML = `
                <div class="nc-item-icon">${icon}</div>
                <div class="nc-item-body">
                    <div class="nc-item-title">${title}</div>
                    <div class="nc-item-msg">${message}</div>
                    <div class="nc-item-time">${time}</div>
                </div>
                <button class="nc-item-dismiss" title="Dismiss">✕</button>
            `;
            item.querySelector('.nc-item-dismiss').addEventListener('click', () => {
                item.classList.add('nc-item-out');
                setTimeout(() => {
                    item.remove();
                    if (!list.querySelector('.nc-item')) {
                        list.innerHTML = '<div class="nc-empty">No new notifications</div>';
                    }
                }, 250);
            });
            list.prepend(item);
        }

        this._ncUnread++;
        this._updateBadge();
        this._showToast(icon, title, message, type, onClick);
    }

    /** Convenience shorthand — icon chosen by type. */
    show(message, type = 'info') {
        const iconMap = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };
        this.push('AndreOS', message, iconMap[type] ?? 'ℹ️', type);
    }

    /** Creates a live (progress) card in the NC. */
    createLive(id, title, message, icon = '⬇️') {
        const list = document.getElementById('ncList');
        if (!list) return;
        list.querySelector('.nc-empty')?.remove();
        document.getElementById(`nc-live-${id}`)?.remove();

        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const item = document.createElement('div');
        item.className = 'nc-item nc-item-live';
        item.id = `nc-live-${id}`;
        item.innerHTML = `
            <div class="nc-item-icon">${icon}</div>
            <div class="nc-item-body">
                <div class="nc-item-title">${title}</div>
                <div class="nc-item-msg">${message}</div>
                <div class="nc-live-progress">
                    <div class="nc-live-bar"><div class="nc-live-fill" style="width:0%"></div></div>
                    <span class="nc-live-pct">0%</span>
                </div>
                <div class="nc-item-time">${time}</div>
            </div>
            <button class="nc-item-dismiss" title="Dismiss">✕</button>
        `;
        item.querySelector('.nc-item-dismiss').addEventListener('click', () => {
            item.classList.add('nc-item-out');
            setTimeout(() => {
                item.remove();
                if (!list.querySelector('.nc-item')) {
                    list.innerHTML = '<div class="nc-empty">No new notifications</div>';
                }
            }, 250);
        });
        list.prepend(item);
        this._ncUnread++;
        this._updateBadge();
        this._showToast(icon, title, `${message} — check notifications for progress.`, 'info');
    }

    /** Updates progress percentage and message on a live card. */
    updateLive(id, pct, message) {
        const item  = document.getElementById(`nc-live-${id}`);
        if (!item) return;
        const fill  = item.querySelector('.nc-live-fill');
        const pctEl = item.querySelector('.nc-live-pct');
        const msgEl = item.querySelector('.nc-item-msg');
        if (fill)  fill.style.width  = Math.min(100, pct) + '%';
        if (pctEl) pctEl.textContent = pct + '%';
        if (msgEl && message) msgEl.textContent = message;
    }

    /** Converts a live card to a completed card and fires a toast. */
    completeLive(id, title, message, icon = '✅', type = 'success', onClick = null) {
        const item = document.getElementById(`nc-live-${id}`);
        if (!item) { this.push(title, message, icon, type, onClick); return; }

        item.querySelector('.nc-live-progress')?.remove();
        const iconEl  = item.querySelector('.nc-item-icon');
        const titleEl = item.querySelector('.nc-item-title');
        const msgEl   = item.querySelector('.nc-item-msg');
        const timeEl  = item.querySelector('.nc-item-time');
        if (iconEl)  iconEl.textContent  = icon;
        if (titleEl) titleEl.textContent = title;
        if (msgEl)   msgEl.textContent   = message;
        if (timeEl)  timeEl.textContent  = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        item.classList.remove('nc-item-live');

        this._ncUnread++;
        this._updateBadge();
        this._showToast(icon, title, message, type, onClick);
    }

    /** Toggles the notification centre panel open/closed. */
    toggleCenter() {
        const panel = document.getElementById('notificationCenter');
        if (!panel) return;
        const isOpen = panel.classList.contains('nc-open');
        if (isOpen) {
            panel.classList.remove('nc-open');
            document.getElementById('nc-backdrop')?.remove();
        } else {
            panel.classList.add('nc-open');
            this._ncUnread = 0;
            this._updateBadge();

            // Mobile: add a tappable backdrop behind the panel
            if (window.innerWidth <= 768) {
                const bd = document.createElement('div');
                bd.id = 'nc-backdrop';
                bd.style.cssText = 'position:fixed;inset:0;z-index:4999;background:rgba(0,0,0,0.4)';
                bd.addEventListener('click', () => this.toggleCenter());
                document.body.appendChild(bd);
            }

            setTimeout(() => {
                const closeOutside = (e) => {
                    if (!panel.contains(e.target) && !e.target.closest('.notification-button')) {
                        panel.classList.remove('nc-open');
                        document.getElementById('nc-backdrop')?.remove();
                        document.removeEventListener('click', closeOutside);
                    }
                };
                document.addEventListener('click', closeOutside);
            }, 50);
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    _updateBadge() {
        const badge = document.getElementById('ncBadge');
        if (!badge) return;
        if (this._ncUnread > 0) {
            badge.textContent = this._ncUnread > 9 ? '9+' : this._ncUnread;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    _showToast(icon, title, message, type = 'info', onClick = null) {
        const toast = document.createElement('div');
        toast.className = `nc-toast nc-toast-${type}`;
        if (onClick) toast.style.cursor = 'pointer';
        toast.innerHTML = `
            <div class="nc-toast-icon">${icon}</div>
            <div class="nc-toast-body">
                <div class="nc-toast-title">${title}</div>
                <div class="nc-toast-msg">${message}</div>
            </div>
            <button class="nc-toast-close">✕</button>
        `;
        if (onClick) {
            toast.addEventListener('click', (e) => {
                if (!e.target.closest('.nc-toast-close')) { onClick(); toast.remove(); }
            });
        }
        toast.querySelector('.nc-toast-close').addEventListener('click', (e) => {
            e.stopPropagation();
            toast.remove();
        });
        document.body.appendChild(toast);
        const existing = document.querySelectorAll('.nc-toast').length;
        toast.style.bottom = (70 + (existing - 1) * 90) + 'px';
        setTimeout(() => {
            toast.classList.add('nc-toast-out');
            setTimeout(() => toast.remove(), 350);
        }, 5000);
    }
}
