/**
 * Desktop
 *
 * Manages desktop icon animation, selection, hover effects, and
 * click delegation. Stateless with respect to windows.
 */
export class Desktop {
    /**
     * @param {{ domCache: object, openFileCb: (fileType: string) => void }} opts
     */
    constructor({ domCache, openFileCb }) {
        this._dom        = domCache;
        this._openFileCb = openFileCb;
    }

    /** Animate icons in on desktop reveal. Also wires the click delegate. */
    animateIcons() {
        document.querySelectorAll('.desktop-icon').forEach((icon, index) => {
            icon.style.opacity    = '0';
            icon.style.transform  = 'translateY(20px)';
            icon.style.transition = 'all 0.6s cubic-bezier(0.4,0,0.2,1)';
            icon.style.pointerEvents = 'auto';
            icon.style.cursor     = 'pointer';
            icon.style.zIndex     = '300';
            setTimeout(() => {
                icon.style.opacity   = '1';
                icon.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }

    /** Wire a single delegated click listener on the icons container. */
    setupIconListeners() {
        const container = document.querySelector('.desktop-icons');
        if (!container || container._delegated) return;
        container.addEventListener('click', (e) => {
            const icon = e.target.closest('.desktop-icon');
            if (!icon) return;
            e.preventDefault();
            e.stopPropagation();
            this.selectIcon(icon);
            this._openFileCb(icon.dataset.file);
        });
        container._delegated = true;

        const desktop = document.querySelector('.desktop');
        if (desktop && !desktop._deselDelegated) {
            desktop.addEventListener('click', (e) => {
                if (!e.target.closest('.desktop-icon')) {
                    this.deselectAllIcons();
                }
            });
            desktop._deselDelegated = true;
        }
    }

    selectIcon(icon) {
        this.deselectAllIcons();
        icon.classList.add('selected');
        this._createRippleEffect(icon);
    }

    deselectAllIcons() {
        document.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('selected'));
    }

    /** Apply GPU-compositing hints and hover/ripple effects to all icons. */
    enhanceIconPerformance() {
        document.querySelectorAll('.desktop-icon').forEach(icon => {
            Object.assign(icon.style, {
                willChange:          'transform',
                backfaceVisibility:  'hidden',
                transform:           'translateZ(0)',
            });

            if (!icon._hoverEnhanced) {
                icon.addEventListener('mouseenter', () => {
                    icon.style.transform = 'scale(1.1) translateZ(0)';
                });
                icon.addEventListener('mouseleave', () => {
                    icon.style.transform = 'scale(1) translateZ(0)';
                });
                icon._hoverEnhanced = true;
            }

            if (!icon._rippleEnhanced) {
                icon.addEventListener('click', (e) => this._addRippleEffect(icon, e));
                icon._rippleEnhanced = true;
            }
        });
    }

    // ── Private ───────────────────────────────────────────────────────────────

    _createRippleEffect(element) {
        const ripple = document.createElement('div');
        Object.assign(ripple.style, {
            position:    'absolute',
            borderRadius:'50%',
            background:  'rgba(255,255,255,0.3)',
            transform:   'scale(0)',
            animation:   'ripple 0.6s linear',
            left: '50%', top: '50%',
            width: '100px', height: '100px',
            marginLeft: '-50px', marginTop: '-50px',
            pointerEvents: 'none',
        });
        element.style.position = 'relative';
        element.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    }

    _addRippleEffect(element, event) {
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const ripple = document.createElement('span');
        ripple.style.width  = ripple.style.height = size + 'px';
        ripple.style.left   = (event.clientX - rect.left - size / 2) + 'px';
        ripple.style.top    = (event.clientY - rect.top  - size / 2) + 'px';
        ripple.classList.add('ripple-effect');
        element.appendChild(ripple);
        setTimeout(() => ripple.parentNode?.removeChild(ripple), 600);
    }
}
