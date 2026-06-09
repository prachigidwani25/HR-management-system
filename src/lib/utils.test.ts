import { describe, it, expect } from 'vitest';
import { getLocalDateString, parseLocalDate } from './utils';

describe('Date Utilities', () => {
  describe('getLocalDateString', () => {
    it('should format a date object as YYYY-MM-DD in local time', () => {
      const date = new Date(2026, 5, 9); // June 9, 2026 (month is 0-indexed)
      expect(getLocalDateString(date)).toBe('2026-06-09');
    });

    it('should handle single digit days and months correctly', () => {
      const date = new Date(2026, 0, 5); // January 5, 2026
      expect(getLocalDateString(date)).toBe('2026-01-05');
    });
  });

  describe('parseLocalDate', () => {
    it('should parse a YYYY-MM-DD string into a local midnight Date object', () => {
      const dateStr = '2026-12-25';
      const parsed = parseLocalDate(dateStr);
      
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(11); // December (0-indexed)
      expect(parsed.getDate()).toBe(25);
      expect(parsed.getHours()).toBe(0);
      expect(parsed.getMinutes()).toBe(0);
    });
  });
});
