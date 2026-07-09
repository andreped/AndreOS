import { getIronFlowContent } from '../../content/AppContent.js';
import { setupIronFlowWindow } from './window.js';

/**
 * IronFlow is openable programmatically but is not surfaced by name to the
 * assistant or desktop search (it ships no assistant profile).
 * @type {import('../registry/AppRegistry.js').AppManifest}
 */
export const catalog = {
    id: 'ironflow', name: 'IronFlow', title: 'IronFlow', icon: '🏋️', kind: 'ironflow',
    window: { width: 420, height: 780, render: getIronFlowContent, setup: (el) => setupIronFlowWindow(el) },
    launchable: false,
    searchable: false,
};
