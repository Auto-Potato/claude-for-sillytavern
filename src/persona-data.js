// Pure persona view helpers (no host imports), shared by the panel and tests.

/** Persona list for the views: sorted by name, stable for the same data. */
export function personaList(personas, descriptions, current) {
    return Object.entries(personas || {})
        .map(([avatar, name]) => ({ avatar, name: String(name || '未命名'), description: descriptions?.[avatar]?.description || '', current: avatar === current }))
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
}

/** First character shown when an avatar image cannot load. */
export const initialOf = name => Array.from(String(name || '?').trim())[0] || '?';
