import { useSyncExternalStore } from 'react';

/*
 * The theme is owned by the Orchid City kit: <html data-theme="light|dark">, saved in
 * localStorage as "ocs-theme" (OS setting until the user picks one), switched by the
 * ThemeToggle, announced with the "ocs:theme" event. app.blade.php sets it before paint.
 */
export type ResolvedAppearance = 'light' | 'dark';

const read = (): ResolvedAppearance =>
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-theme') === 'dark'
        ? 'dark'
        : 'light';

const subscribe = (callback: () => void) => {
    document.addEventListener('ocs:theme', callback);

    return () => document.removeEventListener('ocs:theme', callback);
};

export function useAppearance(): {
    readonly resolvedAppearance: ResolvedAppearance;
} {
    const resolvedAppearance = useSyncExternalStore(
        subscribe,
        read,
        () => 'light' as const,
    );

    return { resolvedAppearance } as const;
}
