import { getIronFlowContent } from '../../content/AppContent.js';

/**
 * IronFlow is openable programmatically but is not surfaced by name to the
 * assistant or desktop search (matches previous behaviour, and it ships no
 * assistant profile).
 * @type {import('./AppRegistry.js').AppManifest}
 */
export const ironflowApp = {
    id:    'ironflow',
    name:  'IronFlow',
    title: 'IronFlow',
    icon:  '🏋️',
    kind:  'ironflow',
    window: { width: 420, height: 780, render: getIronFlowContent },
    launchable: false,
    searchable: false,
};
