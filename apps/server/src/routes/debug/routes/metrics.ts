/**
 * Debug metrics route handler
 *
 * GET /api/debug/metrics - Get current metrics snapshot
 * POST /api/debug/metrics/start - Start metrics collection
 * POST /api/debug/metrics/stop - Stop metrics collection
 */

import type { Request, Response } from 'express';
import type { PerformanceMonitorService } from '../../../services/performance-monitor-service.js';
import type { StartDebugMetricsRequest, DebugMetricsResponse } from '@automaker/types';

/**
 * Create handler for GET /api/debug/metrics
 * Returns current metrics snapshot
 */
export function createGetMetricsHandler(performanceMonitor: PerformanceMonitorService) {
  return (_req: Request, res: Response) => {
    const snapshot = performanceMonitor.getLatestSnapshot();
    const config = performanceMonitor.getConfig();
    const active = performanceMonitor.isActive();

    const response: DebugMetricsResponse = {
      active,
      config,
      snapshot: snapshot ?? undefined,
    };

    res.json(response);
  };
}

/**
 * Validate and sanitize debug metrics config values
 * Prevents DoS via extreme configuration values
 */
function sanitizeConfig(
  config: Partial<import('@automaker/types').DebugMetricsConfig>
): Partial<import('@automaker/types').DebugMetricsConfig> {
  const sanitized: Partial<import('@automaker/types').DebugMetricsConfig> = {};

  // Collection interval: min 100ms, max 60s (prevents CPU exhaustion)
  if (typeof config.collectionInterval === 'number') {
    sanitized.collectionInterval = Math.min(
      60000,
      Math.max(100, Math.floor(config.collectionInterval))
    );
  }

  // Max data points: min 10, max 10000 (prevents memory exhaustion)
  if (typeof config.maxDataPoints === 'number') {
    sanitized.maxDataPoints = Math.min(10000, Math.max(10, Math.floor(config.maxDataPoints)));
  }

  // Leak threshold: min 1KB, max 100MB (reasonable bounds)
  if (typeof config.leakThreshold === 'number') {
    sanitized.leakThreshold = Math.min(
      100 * 1024 * 1024,
      Math.max(1024, Math.floor(config.leakThreshold))
    );
  }

  // Boolean flags - only accept actual booleans
  if (typeof config.memoryEnabled === 'boolean') {
    sanitized.memoryEnabled = config.memoryEnabled;
  }
  if (typeof config.cpuEnabled === 'boolean') {
    sanitized.cpuEnabled = config.cpuEnabled;
  }
  if (typeof config.processTrackingEnabled === 'boolean') {
    sanitized.processTrackingEnabled = config.processTrackingEnabled;
  }

  return sanitized;
}

/**
 * Create handler for POST /api/debug/metrics/start
 * Starts metrics collection with optional config overrides
 */
export function createStartMetricsHandler(performanceMonitor: PerformanceMonitorService) {
  return (req: Request, res: Response) => {
    const body = req.body as StartDebugMetricsRequest | undefined;

    // Update config if provided (with validation)
    if (body?.config && typeof body.config === 'object') {
      const sanitizedConfig = sanitizeConfig(body.config);
      if (Object.keys(sanitizedConfig).length > 0) {
        performanceMonitor.updateConfig(sanitizedConfig);
      }
    }

    // Start collection
    performanceMonitor.start();

    const response: DebugMetricsResponse = {
      active: true,
      config: performanceMonitor.getConfig(),
    };

    res.json(response);
  };
}

/**
 * Create handler for POST /api/debug/metrics/stop
 * Stops metrics collection
 */
export function createStopMetricsHandler(performanceMonitor: PerformanceMonitorService) {
  return (_req: Request, res: Response) => {
    performanceMonitor.stop();

    const response: DebugMetricsResponse = {
      active: false,
      config: performanceMonitor.getConfig(),
    };

    res.json(response);
  };
}

/**
 * Create handler for POST /api/debug/metrics/gc
 * Forces garbage collection if available
 */
export function createForceGCHandler(performanceMonitor: PerformanceMonitorService) {
  return (_req: Request, res: Response) => {
    const success = performanceMonitor.forceGC();

    res.json({
      success,
      message: success
        ? 'Garbage collection triggered'
        : 'Garbage collection not available (start Node.js with --expose-gc flag)',
    });
  };
}

/**
 * Create handler for POST /api/debug/metrics/clear
 * Clears metrics history
 */
export function createClearHistoryHandler(performanceMonitor: PerformanceMonitorService) {
  return (_req: Request, res: Response) => {
    performanceMonitor.clearHistory();

    res.json({
      success: true,
      message: 'Metrics history cleared',
    });
  };
}
