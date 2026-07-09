/**
 * Minimal publish/subscribe event bus for cross-module communication.
 * Prevents direct circular dependencies between WindowManager ↔ Taskbar etc.
 */
export class EventBus {
    constructor() {
        this._listeners = Object.create(null);
    }

    /** Subscribe to an event. Returns `this` for chaining. */
    on(event, cb) {
        (this._listeners[event] ??= []).push(cb);
        return this;
    }

    /** Unsubscribe a previously registered callback. */
    off(event, cb) {
        if (this._listeners[event]) {
            this._listeners[event] = this._listeners[event].filter(l => l !== cb);
        }
    }

    /** Emit an event, synchronously calling all registered listeners. */
    emit(event, data) {
        (this._listeners[event] ?? []).slice().forEach(cb => cb(data));
    }
}
