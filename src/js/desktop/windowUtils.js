/**
 * Shared helpers used by both WindowManager and Taskbar.
 */

export function getWindowIcon(title) {
    if (title.includes('About'))    return '👤';
    if (title.includes('Resume'))   return '📄';
    if (title.includes('Projects')) return '📁';
    if (title.includes('Skills'))   return '⚙️';
    if (title.includes('Contact'))  return '📧';
    if (title.includes('Cast'))     return '🎮';
    return '🗂️';
}

export function getAppType(title) {
    if (title.includes('About'))    return 'about';
    if (title.includes('Resume'))   return 'resume';
    if (title.includes('Projects')) return 'projects';
    if (title.includes('Skills'))   return 'skills';
    if (title.includes('Contact'))  return 'contact';
    if (title.includes('Social'))   return 'social';
    if (title.includes('Browser'))  return 'browser';
    if (title.includes('André') || title.includes('Andre') || title.includes('Ask')) return 'chat';
    if (title.includes('Cast'))     return 'game';
    return 'unknown';
}
