import { describe, it, expect } from 'vitest';
import { formatBytes, formatDuration, calculatePercentage } from '../src/debug';

describe('debug.ts utility functions', () => {
  describe('formatBytes', () => {
    it('should return "0 B" for zero bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('should format bytes correctly', () => {
      expect(formatBytes(1)).toBe('1 B');
      expect(formatBytes(500)).toBe('500 B');
      expect(formatBytes(1023)).toBe('1023 B');
    });

    it('should format kilobytes correctly', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(10240)).toBe('10 KB');
    });

    it('should format megabytes correctly', () => {
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
      expect(formatBytes(100 * 1024 * 1024)).toBe('100 MB');
    });

    it('should format gigabytes correctly', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
      expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
    });

    it('should format terabytes correctly', () => {
      expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1 TB');
    });

    it('should handle negative values for rate display', () => {
      expect(formatBytes(-1024)).toBe('-1 KB');
      expect(formatBytes(-1.5 * 1024 * 1024)).toBe('-1.5 MB');
    });

    it('should round to 2 decimal places', () => {
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1537)).toBe('1.5 KB');
      expect(formatBytes(1024 + 512 + 256)).toBe('1.75 KB');
    });
  });

  describe('formatDuration', () => {
    it('should format microseconds for sub-millisecond values', () => {
      expect(formatDuration(0.001)).toBe('1µs');
      expect(formatDuration(0.5)).toBe('500µs');
      expect(formatDuration(0.999)).toBe('999µs');
    });

    it('should format milliseconds for values under 1 second', () => {
      expect(formatDuration(1)).toBe('1.0ms');
      expect(formatDuration(100)).toBe('100.0ms');
      expect(formatDuration(999)).toBe('999.0ms');
      expect(formatDuration(500.5)).toBe('500.5ms');
    });

    it('should format seconds for values under 1 minute', () => {
      expect(formatDuration(1000)).toBe('1.0s');
      expect(formatDuration(1500)).toBe('1.5s');
      expect(formatDuration(59999)).toBe('60.0s');
    });

    it('should format minutes for values >= 1 minute', () => {
      expect(formatDuration(60000)).toBe('1.0m');
      expect(formatDuration(90000)).toBe('1.5m');
      expect(formatDuration(120000)).toBe('2.0m');
    });

    it('should handle edge case of exactly 1 millisecond', () => {
      expect(formatDuration(1)).toBe('1.0ms');
    });

    it('should handle zero duration', () => {
      expect(formatDuration(0)).toBe('0µs');
    });
  });

  describe('calculatePercentage', () => {
    it('should return 0 when total is 0', () => {
      expect(calculatePercentage(50, 0)).toBe(0);
      expect(calculatePercentage(0, 0)).toBe(0);
    });

    it('should calculate correct percentage', () => {
      expect(calculatePercentage(50, 100)).toBe(50);
      expect(calculatePercentage(25, 100)).toBe(25);
      expect(calculatePercentage(75, 100)).toBe(75);
    });

    it('should handle decimal percentages', () => {
      expect(calculatePercentage(1, 3)).toBeCloseTo(33.33, 1);
      expect(calculatePercentage(1, 7)).toBeCloseTo(14.29, 1);
    });

    it('should cap at 100%', () => {
      expect(calculatePercentage(150, 100)).toBe(100);
      expect(calculatePercentage(200, 100)).toBe(100);
    });

    it('should floor at 0%', () => {
      expect(calculatePercentage(-50, 100)).toBe(0);
      expect(calculatePercentage(-100, 100)).toBe(0);
    });

    it('should handle very small values', () => {
      expect(calculatePercentage(0.001, 100)).toBeCloseTo(0.001, 3);
    });

    it('should handle negative totals correctly', () => {
      // With negative total, the result can be unexpected but should be bounded
      const result = calculatePercentage(50, -100);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });
  });
});
