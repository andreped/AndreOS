/**
 * Apps module entry point.
 *
 * Importing this registers BOTH layers (side effects) and re-exports their
 * registries:
 *   • App Catalog     (`./catalog`)   — what apps exist and how they render.
 *   • Assistant layer (`./assistant`) — how the AI recognises and drives them.
 *
 * The catalog is imported first so the assistant layer (which depends on it)
 * always sees a populated catalogue.
 */
import { appRegistry }       from './catalog/index.js';
import { assistantRegistry } from './assistant/index.js';

export { appRegistry, assistantRegistry };
