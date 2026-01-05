import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import {
  createGetMetricsHandler,
  createStartMetricsHandler,
  createStopMetricsHandler,
  createForceGCHandler,
  createClearHistoryHandler,
} from '@/routes/debug/routes/metrics.js';
import type { PerformanceMonitorService } from '@/services/performance-monitor-service.js';
import type { DebugMetricsConfig, DebugMetricsSnapshot } from '@automaker/types';
import { DEFAULT_DEBUG_METRICS_CONFIG } from '@automaker/types';

describe('Debug Metrics Routes', () => {
  let mockPerformanceMonitor: Partial<PerformanceMonitorService>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonFn: ReturnType<typeof vi.fn>;
  let statusFn: ReturnType<typeof vi.fn>;

  const mockConfig: DebugMetricsConfig = { ...DEFAULT_DEBUG_METRICS_CONFIG };
  const mockSnapshot: DebugMetricsSnapshot = {
    timestamp: Date.now(),
    memory: {
      timestamp: Date.now(),
      server: {
        heapTotal: 100 * 1024 * 1024,
        heapUsed: 50 * 1024 * 1024,
        external: 5 * 1024 * 1024,
        rss: 150 * 1024 * 1024,
        arrayBuffers: 1 * 1024 * 1024,
      },
    },
    cpu: {
      timestamp: Date.now(),
      server: {
        percentage: 25.5,
        user: 1000,
        system: 500,
      },
      eventLoopLag: 5,
    },
    processes: [],
    processSummary: {
      total: 0,
      running: 0,
      idle: 0,
      stopped: 0,
      errored: 0,
      byType: { agent: 0, cli: 0, terminal: 0, worker: 0 },
    },
  };

  beforeEach(() => {
    jsonFn = vi.fn();
    statusFn = vi.fn(() => ({ json: jsonFn }));

    mockPerformanceMonitor = {
      getLatestSnapshot: vi.fn(() => mockSnapshot),
      getConfig: vi.fn(() => mockConfig),
      isActive: vi.fn(() => true),
      start: vi.fn(),
      stop: vi.fn(),
      updateConfig: vi.fn(),
      forceGC: vi.fn(() => true),
      clearHistory: vi.fn(),
    };

    mockReq = {
      body: {},
      query: {},
      params: {},
    };

    mockRes = {
      json: jsonFn,
      status: statusFn,
    };
  });

  describe('GET /api/debug/metrics', () => {
    it('should return current metrics snapshot', () => {
      const handler = createGetMetricsHandler(mockPerformanceMonitor as PerformanceMonitorService);
      handler(mockReq as Request, mockRes as Response);

      expect(jsonFn).toHaveBeenCalledWith({
        active: true,
        config: mockConfig,
        snapshot: mockSnapshot,
      });
    });

    it('should return undefined snapshot when no data available', () => {
      (mockPerformanceMonitor.getLatestSnapshot as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const handler = createGetMetricsHandler(mockPerformanceMonitor as PerformanceMonitorService);
      handler(mockReq as Request, mockRes as Response);

      expect(jsonFn).toHaveBeenCalledWith({
        active: true,
        config: mockConfig,
        snapshot: undefined,
      });
    });

    it('should return active status correctly', () => {
      (mockPerformanceMonitor.isActive as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const handler = createGetMetricsHandler(mockPerformanceMonitor as PerformanceMonitorService);
      handler(mockReq as Request, mockRes as Response);

      expect(jsonFn).toHaveBeenCalledWith(
        expect.objectContaining({
          active: false,
        })
      );
    });
  });

  describe('POST /api/debug/metrics/start', () => {
    it('should start metrics collection', () => {
      const handler = createStartMetricsHandler(
        mockPerformanceMonitor as PerformanceMonitorService
      );
      handler(mockReq as Request, mockRes as Response);

      expect(mockPerformanceMonitor.start).toHaveBeenCalled();
      expect(jsonFn).toHaveBeenCalledWith({
        active: true,
        config: mockConfig,
      });
    });

    it('should apply config overrides when provided', () => {
      mockReq.body = {
        config: {
          collectionInterval: 5000,
          maxDataPoints: 500,
        },
      };

      const handler = createStartMetricsHandler(
        mockPerformanceMonitor as PerformanceMonitorService
      );
      handler(mockReq as Request, mockRes as Response);

      expect(mockPerformanceMonitor.updateConfig).toHaveBeenCalledWith({
        collectionInterval: 5000,
        maxDataPoints: 500,
      });
    });

    it('should sanitize config values - clamp collectionInterval to min 100ms', () => {
      mockReq.body = {
        config: {
          collectionInterval: 10, // Below minimum of 100ms
        },
      };

      const handler = createStartMetricsHandler(
        mockPerformanceMonitor as PerformanceMonitorService
      );
      handler(mockReq as Request, mockRes as Response);

      expect(mockPerformanceMonitor.updateConfig).toHaveBeenCalledWith({
        collectionInterval: 100,
      });
    });

    it('should sanitize config values - clamp collectionInterval to max 60000ms', () => {
      mockReq.body = {
        config: {
          collectionInterval: 100000, // Above maximum of 60000ms
        },
      };

      const handler = createStartMetricsHandler(
        mockPerformanceMonitor as PerformanceMonitorService
      );
      handler(mockReq as Request, mockRes as Response);

      expect(mockPerformanceMonitor.updateConfig).toHaveBeenCalledWith({
        collectionInterval: 60000,
      });
    });

    it('should sanitize config values - clamp maxDataPoints to bounds', () => {
      mockReq.body = {
        config: {
          maxDataPoints: 5, // Below minimum of 10
        },
      };

      const handler = createStartMetricsHandler(
        mockPerformanceMonitor as PerformanceMonitorService
      );
      handler(mockReq as Request, mockRes as Response);

      expect(mockPerformanceMonitor.updateConfig).toHaveBeenCalledWith({
        maxDataPoints: 10,
      });
    });

    it('should sanitize config values - clamp maxDataPoints to max', () => {
      mockReq.body = {
        config: {
          maxDataPoints: 50000, // Above maximum of 10000
        },
      };

      const handler = createStartMetricsHandler(
        mockPerformanceMonitor as PerformanceMonitorService
      );
      handler(mockReq as Request, mockRes as Response);

      expect(mockPerformanceMonitor.updateConfig).toHaveBeenCalledWith({
        maxDataPoints: 10000,
      });
    });

    it('should ignore non-object config', () => {
      mockReq.body = {
        config: 'not-an-object',
      };

      const handler = createStartMetricsHandler(
        mockPerformanceMonitor as PerformanceMonitorService
      );
      handler(mockReq as Request, mockRes as Response);

      expect(mockPerformanceMonitor.updateConfig).not.toHaveBeenCalled();
    });

    it('should ignore empty config object', () => {
      mockReq.body = {
        config: {},
      };

      const handler = createStartMetricsHandler(
        mockPerformanceMonitor as PerformanceMonitorService
      );
      handler(mockReq as Request, mockRes as Response);

      expect(mockPerformanceMonitor.updateConfig).not.toHaveBeenCalled();
    });

    it('should only accept boolean flags as actual booleans', () => {
      mockReq.body = {
        config: {
          memoryEnabled: 'true', // String, not boolean - should be ignored
          cpuEnabled: true, // Boolean - should be accepted
        },
      };

      const handler = createStartMetricsHandler(
        mockPerformanceMonitor as PerformanceMonitorService
      );
      handler(mockReq as Request, mockRes as Response);

      expect(mockPerformanceMonitor.updateConfig).toHaveBeenCalledWith({
        cpuEnabled: true,
      });
    });
  });

  describe('POST /api/debug/metrics/stop', () => {
    it('should stop metrics collection', () => {
      const handler = createStopMetricsHandler(mockPerformanceMonitor as PerformanceMonitorService);
      handler(mockReq as Request, mockRes as Response);

      expect(mockPerformanceMonitor.stop).toHaveBeenCalled();
      expect(jsonFn).toHaveBeenCalledWith({
        active: false,
        config: mockConfig,
      });
    });
  });

  describe('POST /api/debug/metrics/gc', () => {
    it('should trigger garbage collection when available', () => {
      const handler = createForceGCHandler(mockPerformanceMonitor as PerformanceMonitorService);
      handler(mockReq as Request, mockRes as Response);

      expect(mockPerformanceMonitor.forceGC).toHaveBeenCalled();
      expect(jsonFn).toHaveBeenCalledWith({
        success: true,
        message: 'Garbage collection triggered',
      });
    });

    it('should report when garbage collection is not available', () => {
      (mockPerformanceMonitor.forceGC as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const handler = createForceGCHandler(mockPerformanceMonitor as PerformanceMonitorService);
      handler(mockReq as Request, mockRes as Response);

      expect(jsonFn).toHaveBeenCalledWith({
        success: false,
        message: 'Garbage collection not available (start Node.js with --expose-gc flag)',
      });
    });
  });

  describe('POST /api/debug/metrics/clear', () => {
    it('should clear metrics history', () => {
      const handler = createClearHistoryHandler(
        mockPerformanceMonitor as PerformanceMonitorService
      );
      handler(mockReq as Request, mockRes as Response);

      expect(mockPerformanceMonitor.clearHistory).toHaveBeenCalled();
      expect(jsonFn).toHaveBeenCalledWith({
        success: true,
        message: 'Metrics history cleared',
      });
    });
  });
});
