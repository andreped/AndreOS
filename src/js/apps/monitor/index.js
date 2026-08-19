import { render } from './content.js';
import { setupMonitorWindow } from './window.js';
import { monitorContext } from './context.js';

/** @type {import('../registry/AppRegistry.js').AppManifest} */
export const catalog = {
    id: 'monitor', name: 'System Monitor', title: 'System Monitor', icon: '📊', iconSvg: new URL('../../../../assets/icons/monitor.svg', import.meta.url).href, kind: 'content',
    window: { width: 640, height: 620, render, setup: (el) => setupMonitorWindow(el) },
    searchable: true,
    search: { icon: '📊', subtitle: 'Real-time CPU & GPU load', keywords: 'system monitor cpu gpu load performance activity utilization' },
};

/** @type {import('../../assistant/registry/AssistantRegistry.js').AssistantProfile} */
export const profile = {
    appId: 'monitor',
    context: monitorContext,
    match: /system monitor|cpu|gpu|utili[sz]ation|performance monitor|systemovervåk|ytelse/,
    voiceKeywords: [
        'system monitor', 'monitor', 'cpu', 'gpu', 'performance', 'activity monitor',
        'systemovervåking', 'ytelse', 'ressurser',
    ],
};
