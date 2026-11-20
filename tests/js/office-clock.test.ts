import { describe, expect, it } from 'vitest';
import { officeHm, officeTime } from '../../resources/js/lib/office-clock';

/** The clock beside "Log time by hand": office time (Asia/Manila), whatever zone the device is in. */
describe('officeTime', () => {
    const at = new Date('2026-11-20T07:42:07Z'); // 3:42:07 PM in Manila

    it('reads the office time to the minute', () => {
        expect(officeTime(at)).toBe('3:42 PM');
    });

    it('adds the seconds for a live clock', () => {
        expect(officeTime(at, true)).toBe('3:42:07 PM');
    });
});

/** "Now" beside Start and End: the value a time input takes. */
describe('officeHm', () => {
    it('gives the office time as HH:MM, 24 hours', () => {
        expect(officeHm(new Date('2026-11-20T07:42:07Z'))).toBe('15:42');
        expect(officeHm(new Date('2026-11-20T00:05:00Z'))).toBe('08:05');
    });

    it('reads 00, not 24, just after midnight', () => {
        expect(officeHm(new Date('2026-11-19T16:05:00Z'))).toBe('00:05');
    });
});
