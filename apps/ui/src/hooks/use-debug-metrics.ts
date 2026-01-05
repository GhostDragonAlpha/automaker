/**
 * Hook for consuming debug metrics from the server
 *
 * Provides real-time metrics data including:
 * - Memory usage (server-side)
 * - CPU usage (server-side)
 * - Tracked processes
 * - Memory leak detection
 *
 * Uses polling for metrics data with configurable interval.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet, apiPost } from '@/lib/api-fetch';
import { useDebugStore } from '@/store/debug-store';
import type {
  DebugMetricsSnapshot,
  DebugMetricsResponse,
  MemoryDataPoint,
  CPUDataPoint,
  TrackedProcess,
  ProcessSummary,
  MemoryTrend,
  BrowserMemoryMetrics,
} from '@automaker/types';

/**
 * Maximum data points to store in history buffers
 */
const MAX_HISTORY_POINTS = 60;

/**
 * Browser memory metrics (from Chrome's performance.memory API)
 */
interface BrowserMetrics {
  memory?: BrowserMemoryMetrics;
  available: boolean;
}

/**
 * Get browser memory metrics (Chrome only)
 */
function getBrowserMemoryMetrics(): BrowserMetrics {
  // performance.memory is Chrome-specific
  const perf = performance as Performance & {
    memory?: {
      jsHeapSizeLimit: number;
      totalJSHeapSize: number;
      usedJSHeapSize: number;
    };
  };

  if (!perf.memory) {
    return { available: false };
  }

  return {
    available: true,
    memory: {
      jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
      totalJSHeapSize: perf.memory.totalJSHeapSize,
      usedJSHeapSize: perf.memory.usedJSHeapSize,
    },
  };
}

/**
 * Debug metrics state
 */
export interface DebugMetricsState {
  /** Whether metrics collection is active */
  isActive: boolean;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Latest metrics snapshot from server */
  latestSnapshot: DebugMetricsSnapshot | null;
  /** Memory history for charting */
  memoryHistory: MemoryDataPoint[];
  /** CPU history for charting */
  cpuHistory: CPUDataPoint[];
  /** Tracked processes */
  processes: TrackedProcess[];
  /** Process summary */
  processSummary: ProcessSummary | null;
  /** Memory trend analysis */
  memoryTrend: MemoryTrend | null;
  /** Browser-side memory metrics */
  browserMetrics: BrowserMetrics;
}

/**
 * Debug metrics actions
 */
export interface DebugMetricsActions {
  /** Start metrics collection */
  start: () => Promise<void>;
  /** Stop metrics collection */
  stop: () => Promise<void>;
  /** Force garbage collection (if available) */
  forceGC: () => Promise<{ success: boolean; message: string }>;
  /** Clear history */
  clearHistory: () => Promise<void>;
  /** Refresh metrics immediately */
  refresh: () => Promise<void>;
}

/**
 * Hook for consuming debug metrics
 */
export function useDebugMetrics(): DebugMetricsState & DebugMetricsActions {
  const preferences = useDebugStore((state) => state.preferences);
  const isOpen = useDebugStore((state) => state.isOpen);

  const [state, setState] = useState<DebugMetricsState>({
    isActive: false,
    isLoading: true,
    error: null,
    latestSnapshot: null,
    memoryHistory: [],
    cpuHistory: [],
    processes: [],
    processSummary: null,
    memoryTrend: null,
    browserMetrics: { available: false },
  });

  // Use ref to store history to avoid re-renders during updates
  const memoryHistoryRef = useRef<MemoryDataPoint[]>([]);
  const cpuHistoryRef = useRef<CPUDataPoint[]>([]);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetch metrics from server
   */
  const fetchMetrics = useCallback(async () => {
    try {
      const response = await apiGet<DebugMetricsResponse>('/api/debug/metrics');

      // Get browser metrics
      const browserMetrics = getBrowserMemoryMetrics();

      if (response.snapshot) {
        const snapshot = response.snapshot;

        // Add to history buffers
        if (snapshot.memory.server) {
          const memoryPoint: MemoryDataPoint = {
            timestamp: snapshot.timestamp,
            heapUsed: snapshot.memory.server.heapUsed,
            heapTotal: snapshot.memory.server.heapTotal,
            rss: snapshot.memory.server.rss,
          };

          memoryHistoryRef.current.push(memoryPoint);
          if (memoryHistoryRef.current.length > MAX_HISTORY_POINTS) {
            memoryHistoryRef.current.shift();
          }
        }

        if (snapshot.cpu.server) {
          const cpuPoint: CPUDataPoint = {
            timestamp: snapshot.timestamp,
            percentage: snapshot.cpu.server.percentage,
            eventLoopLag: snapshot.cpu.eventLoopLag,
          };

          cpuHistoryRef.current.push(cpuPoint);
          if (cpuHistoryRef.current.length > MAX_HISTORY_POINTS) {
            cpuHistoryRef.current.shift();
          }
        }

        setState((prev) => ({
          ...prev,
          isActive: response.active,
          isLoading: false,
          error: null,
          latestSnapshot: snapshot,
          memoryHistory: [...memoryHistoryRef.current],
          cpuHistory: [...cpuHistoryRef.current],
          processes: snapshot.processes,
          processSummary: snapshot.processSummary,
          memoryTrend: snapshot.memoryTrend || null,
          browserMetrics,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isActive: response.active,
          isLoading: false,
          browserMetrics,
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch metrics',
      }));
    }
  }, []);

  /**
   * Start metrics collection
   */
  const start = useCallback(async () => {
    try {
      await apiPost<DebugMetricsResponse>('/api/debug/metrics/start');
      await fetchMetrics();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to start metrics',
      }));
    }
  }, [fetchMetrics]);

  /**
   * Stop metrics collection
   */
  const stop = useCallback(async () => {
    try {
      await apiPost<DebugMetricsResponse>('/api/debug/metrics/stop');
      setState((prev) => ({
        ...prev,
        isActive: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to stop metrics',
      }));
    }
  }, []);

  /**
   * Force garbage collection
   */
  const forceGC = useCallback(async () => {
    try {
      const response = await apiPost<{ success: boolean; message: string }>(
        '/api/debug/metrics/gc'
      );
      return response;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to trigger GC',
      };
    }
  }, []);

  /**
   * Clear metrics history
   */
  const clearHistory = useCallback(async () => {
    try {
      await apiPost('/api/debug/metrics/clear');
      memoryHistoryRef.current = [];
      cpuHistoryRef.current = [];
      setState((prev) => ({
        ...prev,
        memoryHistory: [],
        cpuHistory: [],
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to clear history',
      }));
    }
  }, []);

  /**
   * Refresh metrics immediately
   */
  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    await fetchMetrics();
  }, [fetchMetrics]);

  // Set up polling when debug panel is open and monitoring is enabled
  useEffect(() => {
    if (!isOpen || !preferences.memoryMonitorEnabled) {
      // Clear polling when panel is closed or monitoring disabled
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    // Initial fetch
    fetchMetrics();

    // Set up polling interval
    pollingIntervalRef.current = setInterval(fetchMetrics, preferences.updateInterval);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [isOpen, preferences.memoryMonitorEnabled, preferences.updateInterval, fetchMetrics]);

  return {
    ...state,
    start,
    stop,
    forceGC,
    clearHistory,
    refresh,
  };
}
