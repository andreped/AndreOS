/**
 * Static content apps — About, Resume, Projects, Skills, Contact, Social.
 *
 * Catalog entries only: identity, icon, window spec, and search presence.
 * How the assistant recognises these apps lives separately in
 * `../assistant/profiles/contentApps.js`.
 */
import {
    getAboutContent, getResumeContent, getProjectsContent,
    getSkillsContent, getContactContent, getSocialContent,
} from '../../content/AppContent.js';

/**
 * @param {object} cfg
 * @returns {import('./AppRegistry.js').AppManifest}
 */
function contentApp(cfg) {
    return {
        id:    cfg.id,
        name:  cfg.name,
        title: cfg.title,
        icon:  cfg.icon,
        kind:  'content',
        window: { width: cfg.width, height: cfg.height, render: cfg.render },
        searchable: !!cfg.search,
        search:     cfg.search,
    };
}

/** @type {import('./AppRegistry.js').AppManifest[]} */
export const contentApps = [
    contentApp({
        id: 'about', name: 'About Me', title: 'About Me.txt', icon: '👤',
        width: 600, height: 500, render: getAboutContent,
        search: { icon: '👤', subtitle: 'Who André Pedersen is', keywords: 'about andre pedersen background bio profile' },
    }),
    contentApp({
        id: 'resume', name: 'Resume', title: 'Resume.pdf', icon: '📄',
        width: 700, height: 600, render: getResumeContent,
        search: { icon: '📄', subtitle: 'Work experience, education, certifications', keywords: 'resume cv work job experience degree dips sintef ntnu' },
    }),
    contentApp({
        id: 'projects', name: 'Projects', title: 'Projects', icon: '📁',
        width: 800, height: 600, render: getProjectsContent,
        search: { icon: '📁', subtitle: 'Open-source and research projects', keywords: 'projects github open source software' },
    }),
    contentApp({
        id: 'skills', name: 'Skills', title: 'Skills.exe', icon: '⚙️',
        width: 700, height: 500, render: getSkillsContent,
        // Not surfaced in desktop search (matches previous behaviour).
    }),
    contentApp({
        id: 'contact', name: 'Contact', title: 'Contact.txt', icon: '✉️',
        width: 500, height: 400, render: getContactContent,
        search: { icon: '✉️', subtitle: 'Get in touch with André', keywords: 'contact email reach out message' },
    }),
    contentApp({
        id: 'social', name: 'Social Links', title: 'Social Links', icon: '🔗',
        width: 600, height: 500, render: getSocialContent,
        search: { icon: '🔗', subtitle: 'GitHub, LinkedIn, Google Scholar and more', keywords: 'social github linkedin twitter scholar publications links' },
    }),
];
