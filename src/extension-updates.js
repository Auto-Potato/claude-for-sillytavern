/** Opt-in automatic updates, independent of the host's version-upgrade updater. */
export function eligibleUpdates(items, preferences, now, isAdmin) {
    return items.filter(item => item.id.startsWith('third-party/') && item.enabled
        && (item.type !== 'global' || isAdmin) && preferences[item.id]?.enabled === true
        && now - (preferences[item.id].lastAttempt || 0) >= 86400000);
}

export function createExtensionUpdater({ request, runHook, onUpdated }) {
    const pending = new Map();
    return function update(item) {
        if (pending.has(item.id)) return pending.get(item.id);
        const task = (async () => {
            const result = await request('/api/extensions/update', {
                extensionName: item.id.replace(/^third-party/, ''), global: item.type === 'global',
            });
            if (!result.isUpToDate) {
                await runHook(item);
                onUpdated(item);
            }
            return result;
        })().finally(() => pending.delete(item.id));
        pending.set(item.id, task);
        return task;
    };
}
