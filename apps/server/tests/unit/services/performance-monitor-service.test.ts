import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PerformanceMonitorService } from '@/services/performance-monitor-service.js';
import { createEventEmitter } from '@/lib/events.js';
import type { EventEmitter } from '@/lib/events.js';
import type { TrackedProcess, DebugMetricsConfig } from '@automaker/types';
import { DEFAULT_DEBUG_METRICS_CONFIG } from '@automaker/types';

// Mock the logger to prevent console output during tests
vi.mock('@automaker/utils', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('PerformanceMonitorService', () => {
  let service: PerformanceMonitorService;
  let events: EventEmitter;

  beforeEach(() => {
    vi.useFakeTimers();
    events = createEventEmitter();
    service = new PerformanceMonitorService(events);
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const config = service.getConfig();
      expect(config.collectionInterval).toBe(DEFAULT_DEBUG_METRICS_CONFIG.collectionInterval);
      expect(config.maxDataPoints).toBe(DEFAULT_DEBUG_METRICS_CONFIG.maxDataPoints);
      expect(config.memoryEnabled).toBe(DEFAULT_DEBUG_METRICS_CONFIG.memoryEnabled);
      expect(config.cpuEnabled).toBe(DEFAULT_DEBUG_METRICS_CONFIG.cpuEnabled);
    });

    it('should accept custom configuration on initialization', () => {
      const customConfig: Partial<DebugMetricsConfig> = {
        collectionInterval: 5000,
        maxDataPoints: 500,
        memoryEnabled: false,
      };

      const customService = new PerformanceMonitorService(events, customConfig);
      const config = customService.getConfig();

      expect(config.collectionInterval).toBe(5000);
      expect(config.maxDataPoints).toBe(500);
      expect(config.memoryEnabled).toBe(false);
      expect(config.cpuEnabled).toBe(DEFAULT_DEBUG_METRICS_CONFIG.cpuEnabled);

      customService.stop();
    });

    it('should not be running initially', () => {
      expect(service.isActive()).toBe(false);
    });
  });

  describe('start/stop', () => {
    it('should start metrics collection', () => {
      service.start();
      expect(service.isActive()).toBe(true);
    });

    it('should stop metrics collection', () => {
      service.start();
      expect(service.isActive()).toBe(true);

      service.stop();
      expect(service.isActive()).toBe(false);
    });

    it('should not start again if already running', () => {
      service.start();
      const isActive1 = service.isActive();

      service.start(); // Should log warning but not throw
      const isActive2 = service.isActive();

      expect(isActive1).toBe(true);
      expect(isActive2).toBe(true);
    });

    it('should handle stop when not running', () => {
      // Should not throw
      expect(() => service.stop()).not.toThrow();
    });
  });

  describe('configuration updates', () => {
    it('should update configuration', () => {
      service.updateConfig({ collectionInterval: 2000 });
      expect(service.getConfig().collectionInterval).toBe(2000);
    });

    it('should restart collection if running when config is updated', () => {
      service.start();
      expect(service.isActive()).toBe(true);

      service.updateConfig({ collectionInterval: 5000 });

      // Should still be running after config update
      expect(service.isActive()).toBe(true);
      expect(service.getConfig().collectionInterval).toBe(5000);
    });

    it('should resize data buffers when maxDataPoints changes', () => {
      // Start and collect some data
      service.start();

      // Collect multiple data points
      for (let i = 0; i < 50; i++) {
        vi.advanceTimersByTime(service.getConfig().collectionInterval);
      }

      // Reduce max data points
      service.updateConfig({ maxDataPoints: 10 });

      const history = service.getMemoryHistory();
      expect(history.length).toBeLessThanOrEqual(10);
    });
  });

  describe('metrics collection', () => {
    it('should emit debug:metrics event on collection', () => {
      const callback = vi.fn();
      events.subscribe(callback);

      service.start();
      vi.advanceTimersByTime(service.getConfig().collectionInterval);

      expect(callback).toHaveBeenCalled();
      const [eventType, eventData] = callback.mock.calls[0];
      expect(eventType).toBe('debug:metrics');
      expect(eventData).toHaveProperty('timestamp');
      expect(eventData).toHaveProperty('metrics');
    });

    it('should collect memory metrics when memoryEnabled is true', () => {
      const callback = vi.fn();
      events.subscribe(callback);

      service.start();
      vi.advanceTimersByTime(service.getConfig().collectionInterval);

      const [, eventData] = callback.mock.calls[0];
      expect(eventData.metrics.memory.server).toBeDefined();
      expect(eventData.metrics.memory.server.heapUsed).toBeGreaterThan(0);
      expect(eventData.metrics.memory.server.heapTotal).toBeGreaterThan(0);
    });

    it('should not collect memory metrics when memoryEnabled is false', () => {
      const customService = new PerformanceMonitorService(events, { memoryEnabled: false });
      const callback = vi.fn();
      events.subscribe(callback);

      customService.start();
      vi.advanceTimersByTime(customService.getConfig().collectionInterval);

      const [, eventData] = callback.mock.calls[0];
      expect(eventData.metrics.memory.server).toBeUndefined();

      customService.stop();
    });

    it('should collect CPU metrics when cpuEnabled is true', () => {
      const callback = vi.fn();
      events.subscribe(callback);

      service.start();
      vi.advanceTimersByTime(service.getConfig().collectionInterval);
      vi.advanceTimersByTime(service.getConfig().collectionInterval);

      // Need at least 2 collections for CPU diff
      const lastCall = callback.mock.calls[callback.mock.calls.length - 1];
      const [, eventData] = lastCall;
      expect(eventData.metrics.cpu.server).toBeDefined();
    });

    it('should track event loop lag', () => {
      const callback = vi.fn();
      events.subscribe(callback);

      service.start();
      vi.advanceTimersByTime(service.getConfig().collectionInterval);

      const [, eventData] = callback.mock.calls[0];
      expect(eventData.metrics.cpu.eventLoopLag).toBeDefined();
    });
  });

  describe('memory history', () => {
    it('should return empty history initially', () => {
      const history = service.getMemoryHistory();
      expect(history).toEqual([]);
    });

    it('should accumulate memory history over time', () => {
      service.start();

      // Collect multiple data points
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(service.getConfig().collectionInterval);
      }

      const history = service.getMemoryHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    it('should limit history to maxDataPoints', () => {
      const maxPoints = 10;
      const customService = new PerformanceMonitorService(events, { maxDataPoints: maxPoints });
      customService.start();

      // Collect more data points than max
      for (let i = 0; i < maxPoints + 10; i++) {
        vi.advanceTimersByTime(customService.getConfig().collectionInterval);
      }

      const history = customService.getMemoryHistory();
      expect(history.length).toBeLessThanOrEqual(maxPoints);

      customService.stop();
    });
  });

  describe('CPU history', () => {
    it('should return empty CPU history initially', () => {
      const history = service.getCPUHistory();
      expect(history).toEqual([]);
    });

    it('should accumulate CPU history over time', () => {
      service.start();

      // Collect multiple data points (need at least 2 for CPU diff)
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(service.getConfig().collectionInterval);
      }

      const history = service.getCPUHistory();
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('process provider', () => {
    it('should use provided process provider', () => {
      const mockProcesses: TrackedProcess[] = [
        {
          id: 'test-1',
          type: 'agent',
          name: 'TestAgent',
          status: 'running',
          startedAt: Date.now(),
        },
        {
          id: 'test-2',
          type: 'terminal',
          name: 'TestTerminal',
          status: 'idle',
          startedAt: Date.now(),
        },
      ];

      const provider = vi.fn(() => mockProcesses);
      service.setProcessProvider(provider);

      const callback = vi.fn();
      events.subscribe(callback);

      service.start();
      vi.advanceTimersByTime(service.getConfig().collectionInterval);

      const [, eventData] = callback.mock.calls[0];
      expect(eventData.metrics.processes).toEqual(mockProcesses);
      expect(eventData.metrics.processSummary.total).toBe(2);
      expect(eventData.metrics.processSummary.running).toBe(1);
      expect(eventData.metrics.processSummary.idle).toBe(1);
      expect(eventData.metrics.processSummary.byType.agent).toBe(1);
      expect(eventData.metrics.processSummary.byType.terminal).toBe(1);
    });
  });

  describe('getLatestSnapshot', () => {
    it('should return null when no data collected', () => {
      const snapshot = service.getLatestSnapshot();
      expect(snapshot).toBeNull();
    });

    it('should return snapshot after data collection', () => {
      service.start();
      vi.advanceTimersByTime(service.getConfig().collectionInterval);

      const snapshot = service.getLatestSnapshot();
      expect(snapshot).not.toBeNull();
      expect(snapshot).toHaveProperty('timestamp');
      expect(snapshot).toHaveProperty('memory');
      expect(snapshot).toHaveProperty('cpu');
      expect(snapshot).toHaveProperty('processes');
      expect(snapshot).toHaveProperty('processSummary');
    });
  });

  describe('clearHistory', () => {
    it('should clear all history', () => {
      service.start();

      // Collect some data
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(service.getConfig().collectionInterval);
      }

      expect(service.getMemoryHistory().length).toBeGreaterThan(0);

      service.clearHistory();

      expect(service.getMemoryHistory().length).toBe(0);
      expect(service.getCPUHistory().length).toBe(0);
    });
  });

  describe('forceGC', () => {
    it('should return false when gc is not available', () => {
      const originalGc = global.gc;
      global.gc = undefined;

      const result = service.forceGC();
      expect(result).toBe(false);

      // Restore
      global.gc = originalGc;
    });

    it('should return true and call gc when available', () => {
      const mockGc = vi.fn();
      global.gc = mockGc;

      const result = service.forceGC();
      expect(result).toBe(true);
      expect(mockGc).toHaveBeenCalled();

      // Cleanup
      global.gc = undefined;
    });
  });

  describe('memory trend analysis', () => {
    it('should not calculate trend with insufficient data', () => {
      service.start();

      // Collect only a few data points
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(service.getConfig().collectionInterval);
      }

      const snapshot = service.getLatestSnapshot();
      // Trend requires at least 10 samples
      expect(snapshot?.memoryTrend).toBeUndefined();
    });

    it('should calculate trend with sufficient data', () => {
      service.start();

      // Collect enough data points for trend analysis
      for (let i = 0; i < 15; i++) {
        vi.advanceTimersByTime(service.getConfig().collectionInterval);
      }

      const snapshot = service.getLatestSnapshot();
      expect(snapshot?.memoryTrend).toBeDefined();
      expect(snapshot?.memoryTrend).toHaveProperty('growthRate');
      expect(snapshot?.memoryTrend).toHaveProperty('isLeaking');
      expect(snapshot?.memoryTrend).toHaveProperty('confidence');
      expect(snapshot?.memoryTrend).toHaveProperty('sampleCount');
    });
  });

  describe('process summary calculation', () => {
    it('should correctly categorize processes by status', () => {
      const mockProcesses: TrackedProcess[] = [
        { id: '1', type: 'agent', name: 'A1', status: 'running', startedAt: Date.now() },
        { id: '2', type: 'agent', name: 'A2', status: 'starting', startedAt: Date.now() },
        { id: '3', type: 'terminal', name: 'T1', status: 'idle', startedAt: Date.now() },
        { id: '4', type: 'terminal', name: 'T2', status: 'stopped', startedAt: Date.now() },
        { id: '5', type: 'cli', name: 'C1', status: 'stopping', startedAt: Date.now() },
        { id: '6', type: 'worker', name: 'W1', status: 'error', startedAt: Date.now() },
      ];

      service.setProcessProvider(() => mockProcesses);

      const callback = vi.fn();
      events.subscribe(callback);

      service.start();
      vi.advanceTimersByTime(service.getConfig().collectionInterval);

      const [, eventData] = callback.mock.calls[0];
      const summary = eventData.metrics.processSummary;

      expect(summary.total).toBe(6);
      expect(summary.running).toBe(2); // running + starting
      expect(summary.idle).toBe(1);
      expect(summary.stopped).toBe(2); // stopped + stopping
      expect(summary.errored).toBe(1);
      expect(summary.byType.agent).toBe(2);
      expect(summary.byType.terminal).toBe(2);
      expect(summary.byType.cli).toBe(1);
      expect(summary.byType.worker).toBe(1);
    });
  });
});
