/**
 * Hook for tracking React component render performance
 *
 * Uses React Profiler API to track:
 * - Component render counts
 * - Render durations
 * - Render frequency (renders per second)
 * - High-render component detection
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ProfilerOnRenderCallback } from 'react';
import type {
  ComponentRender,
  ComponentRenderStats,
  RenderTrackingSummary,
} from '@automaker/types';
import { useDebugStore } from '@/store/debug-store';

/**
 * Maximum render records to keep per component
 */
const MAX_RENDER_RECORDS = 100;

/**
 * Time window for calculating renders per second (ms)
 */
const RENDER_RATE_WINDOW = 5000;

/**
 * Hook for tracking render performance
 */
export function useRenderTracking() {
  const isOpen = useDebugStore((state) => state.isOpen);
  const preferences = useDebugStore((state) => state.preferences);

  // Store render records per component
  const renderRecordsRef = useRef<Map<string, ComponentRender[]>>(new Map());

  // Store computed stats
  const [stats, setStats] = useState<Map<string, ComponentRenderStats>>(new Map());
  const [summary, setSummary] = useState<RenderTrackingSummary>({
    totalRenders: 0,
    uniqueComponents: 0,
    highRenderComponents: [],
    topRenderers: [],
    windowStart: Date.now(),
    windowDuration: 0,
  });

  /**
   * Create a profiler callback for a specific component
   */
  const createProfilerCallback = useCallback(
    (componentName: string): ProfilerOnRenderCallback => {
      return (
        _id: string,
        phase: 'mount' | 'update' | 'nested-update',
        actualDuration: number,
        baseDuration: number,
        startTime: number,
        commitTime: number
      ) => {
        if (!isOpen || !preferences.renderTrackingEnabled) {
          return;
        }

        const record: ComponentRender = {
          componentName,
          phase,
          actualDuration,
          baseDuration,
          startTime,
          commitTime,
        };

        // Add to records
        let records = renderRecordsRef.current.get(componentName);
        if (!records) {
          records = [];
          renderRecordsRef.current.set(componentName, records);
        }

        records.push(record);

        // Trim old records
        if (records.length > MAX_RENDER_RECORDS) {
          records.shift();
        }
      };
    },
    [isOpen, preferences.renderTrackingEnabled]
  );

  /**
   * Calculate stats for a component
   */
  const calculateComponentStats = useCallback(
    (componentName: string, records: ComponentRender[]): ComponentRenderStats => {
      const now = Date.now();
      const windowStart = now - RENDER_RATE_WINDOW;

      // Filter records in the rate calculation window
      const recentRecords = records.filter((r) => r.commitTime >= windowStart);
      const rendersPerSecond = recentRecords.length / (RENDER_RATE_WINDOW / 1000);

      // Calculate duration stats
      let totalDuration = 0;
      let maxDuration = 0;
      let minDuration = Infinity;

      for (const record of records) {
        totalDuration += record.actualDuration;
        maxDuration = Math.max(maxDuration, record.actualDuration);
        minDuration = Math.min(minDuration, record.actualDuration);
      }

      const avgDuration = records.length > 0 ? totalDuration / records.length : 0;
      const lastRender = records[records.length - 1];

      return {
        componentName,
        renderCount: records.length,
        rendersPerSecond,
        avgDuration,
        maxDuration,
        minDuration: minDuration === Infinity ? 0 : minDuration,
        totalDuration,
        isHighRender: rendersPerSecond > preferences.renderAlertThreshold,
        lastRenderAt: lastRender?.commitTime || 0,
      };
    },
    [preferences.renderAlertThreshold]
  );

  /**
   * Update all stats
   */
  const updateStats = useCallback(() => {
    const newStats = new Map<string, ComponentRenderStats>();
    let totalRenders = 0;
    const highRenderComponents: string[] = [];
    const allStats: ComponentRenderStats[] = [];
    let windowStart = Date.now();

    for (const [componentName, records] of renderRecordsRef.current.entries()) {
      if (records.length === 0) continue;

      const componentStats = calculateComponentStats(componentName, records);
      newStats.set(componentName, componentStats);
      allStats.push(componentStats);
      totalRenders += componentStats.renderCount;

      if (componentStats.isHighRender) {
        highRenderComponents.push(componentName);
      }

      // Track earliest record
      const firstRecord = records[0];
      if (firstRecord && firstRecord.commitTime < windowStart) {
        windowStart = firstRecord.commitTime;
      }
    }

    // Sort by render count to get top renderers
    const topRenderers = allStats.sort((a, b) => b.renderCount - a.renderCount).slice(0, 5);

    setStats(newStats);
    setSummary({
      totalRenders,
      uniqueComponents: newStats.size,
      highRenderComponents,
      topRenderers,
      windowStart,
      windowDuration: Date.now() - windowStart,
    });
  }, [calculateComponentStats]);

  /**
   * Clear all render records
   */
  const clearRecords = useCallback(() => {
    renderRecordsRef.current.clear();
    setStats(new Map());
    setSummary({
      totalRenders: 0,
      uniqueComponents: 0,
      highRenderComponents: [],
      topRenderers: [],
      windowStart: Date.now(),
      windowDuration: 0,
    });
  }, []);

  /**
   * Get stats for a specific component
   */
  const getComponentStats = useCallback(
    (componentName: string): ComponentRenderStats | null => {
      return stats.get(componentName) || null;
    },
    [stats]
  );

  /**
   * Get all component stats as array
   */
  const getAllStats = useCallback((): ComponentRenderStats[] => {
    return Array.from(stats.values());
  }, [stats]);

  // Periodically update stats when panel is open
  useEffect(() => {
    if (!isOpen || !preferences.renderTrackingEnabled) {
      return;
    }

    // Update stats every second
    const interval = setInterval(updateStats, 1000);
    return () => clearInterval(interval);
  }, [isOpen, preferences.renderTrackingEnabled, updateStats]);

  return {
    stats,
    summary,
    createProfilerCallback,
    updateStats,
    clearRecords,
    getComponentStats,
    getAllStats,
  };
}

/**
 * Context for sharing render tracking across components
 */
export type RenderTrackingContextType = ReturnType<typeof useRenderTracking>;
