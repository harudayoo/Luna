import { describe, expect, it } from 'vitest';

import { badgeLabel, freshSince } from '../../resources/js/lib/notifications';

const notice = (id: string, read = false) => ({
    id,
    kind: 'leave_logged',
    title: id,
    body: '',
    module: 'people',
    read,
    ago: '1m',
});

describe('freshSince', () => {
    it('picks unread notices not seen before, in order', () => {
        const items = [notice('c'), notice('b', true), notice('a')];

        expect(freshSince(items, new Set(['a'])).map((n) => n.id)).toEqual([
            'c',
        ]);
    });

    it('finds nothing when everything was already seen', () => {
        expect(freshSince([notice('a')], new Set(['a']))).toEqual([]);
    });
});

describe('badgeLabel', () => {
    it('shows the count up to 9, then 9+', () => {
        expect([1, 9, 10, 42].map(badgeLabel)).toEqual(['1', '9', '9+', '9+']);
    });
});
