/**
 * Performance Monitor Service
 *
 * Collects and streams server-side performance metrics including:
 * - Memory usage (heap, rss, external)
 * - CPU usage (user, system, percentage)
 * - Event loop lag detection
 * - Memory leak trend analysis
 *
 * Emits debug events for real-time streaming to connected clients.
 */

import v8 from 'v8';
import { createLogger } from '@automaker/utils';
import type { EventEmitter } from '../lib/events.js';
import type {
  ServerMemoryMetrics,
  ServerCPUMetrics,
  MemoryMetrics,
  CPUMetrics,
  MemoryTrend,
  DebugMetricsConfig,
  DebugMetricsSnapshot,
  ProcessSummary,
  TrackedProcess,
} from '@automaker/types';
import { DEFAULT_DEBUG_METRICS_CONFIG, formatBytes } from '@automaker/types';

const logger = createLogger('PerformanceMonitor');

/**
 * Circular buffer for time-series data storage
 * Uses index-based ring buffer for O(1) push operations instead of O(n) shift().
 * Efficiently stores a fixed number of data points, automatically discarding old ones.
 */
class CircularBuffer<T> {
  private buffer: (T | undefined)[];
  private maxSize: number;
  private head = 0; // Write position
  private count = 0; // Number of items

  constructor(maxSize: number) {
    this.maxSize = maxSize;
    this.buffer = new Array(maxSize);
  }

  /**
   * Add item to buffer - O(1) operation
   */
  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.maxSize;
    if (this.count < this.maxSize) {
      this.count++;
    }
  }

  /**
   * Get all items in chronological order - O(n) but only called when needed
   */
  getAll(): T[] {
    if (this.count === 0) return [];

    const result: T[] = new Array(this.count);
    const start = this.count < this.maxSize ? 0 : this.head;

    for (let i = 0; i < this.count; i++) {
      const idx = (start + i) % this.maxSize;
      result[i] = this.buffer[idx] as T;
    }

    return result;
  }

  /**
   * Get most recent item - O(1)
   */
  getLast(): T | undefined {
    if (this.count === 0) return undefined;
    const idx = (this.head - 1 + this.maxSize) % this.maxSize;
    return this.buffer[idx];
  }

  /**
   * Get oldest item - O(1)
   */
  getFirst(): T | undefined {
    if (this.count === 0) return undefined;
    const start = this.count < this.maxSize ? 0 : this.head;
    return this.buffer[start];
  }

  /**
   * Get current count - O(1)
   */
  size(): number {
    return this.count;
  }

  /**
   * Clear all items - O(1)
   */
  clear(): void {
    this.head = 0;
    this.count = 0;
    // Don't reallocate array, just reset indices
  }

  /**
   * Resize buffer, preserving existing data
   */
  resize(newSize: number): void {
    const oldData = this.getAll();
    this.maxSize = newSize;
    this.buffer = new Array(newSize);
    this.head = 0;
    this.count = 0;

    // Copy over data (trim if necessary, keep most recent)
    const startIdx = Math.max(0, oldData.length - newSize);
    for (let i = startIdx; i < oldData.length; i++) {
      this.push(oldData[i]);
    }
  }
}

/**
 * Memory data point for trend analysis
 */
interface MemoryDataPoint {
  timestamp: number;
  heapUsed: number;
}

/**
 * CPU data point for tracking
 */
interface CPUDataPoint {
  timestamp: number;
  user: number;
  system: number;
}

/**
 * PerformanceMonitorService - Collects server-side performance metrics
 *
 * This service runs in the Node.js server process and periodically collects:
 * - Memory metrics from process.memoryUsage()
 * - CPU metrics from process.cpuUsage()
 * - Event loop lag using setTimeout deviation
 *
 * It streams metrics to connected clients via the event emitter and
 * analyzes memory trends to detect potential leaks.
 */
export class PerformanceMonitorService {
  private events: EventEmitter;
  private config: DebugMetricsConfig;
  private isRunning = false;
  private collectionInterval: NodeJS.Timeout | null = null;
  private eventLoopCheckInterval: NodeJS.Timeout | null = null;

  // Data storage
  private memoryHistory: CircularBuffer<MemoryDataPoint>;
  private cpuHistory: CircularBuffer<CPUDataPoint>;

  // CPU tracking state
  private lastCpuUsage: NodeJS.CpuUsage | null = null;
  private lastCpuTime: number = 0;

  // Event loop lag tracking
  private lastEventLoopLag = 0;
  private eventLoopLagThreshold = 100; // ms - threshold for warning

  // Memory warning thresholds (percentage of heap limit)
  private memoryWarningThreshold = 70; // 70% of heap limit
  private memoryCriticalThreshold = 90; // 90% of heap limit
  private lastMemoryWarningTime = 0;
  private memoryWarningCooldown = 30000; // 30 seconds between warnings

  // Process tracking (will be populated by ProcessRegistryService)
  private getProcesses: () => TrackedProcess[] = () => [];

  constructor(events: EventEmitter, config?: Partial<DebugMetricsConfig>) {
    this.events = events;
    this.config = { ...DEFAULT_DEBUG_METRICS_CONFIG, ...config };
    this.memoryHistory = new CircularBuffer(this.config.maxDataPoints);
    this.cpuHistory = new CircularBuffer(this.config.maxDataPoints);

    logger.info('PerformanceMonitorService initialized');
  }

  /**
   * Set the process provider function (called by ProcessRegistryService)
   */
  setProcessProvider(provider: () => TrackedProcess[]): void {
    this.getProcesses = provider;
  }

  /**
   * Start metrics collection
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('PerformanceMonitorService is already running');
      return;
    }

    this.isRunning = true;
    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuTime = Date.now();

    // Start periodic metrics collection
    this.collectionInterval = setInterval(() => {
      this.collectAndEmitMetrics();
    }, this.config.collectionInterval);

    // Start event loop lag monitoring (more frequent for accurate detection)
    this.startEventLoopMonitoring();

    logger.info('PerformanceMonitorService started', {
      interval: this.config.collectionInterval,
    });
  }

  /**
   * Stop metrics collection
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }

    if (this.eventLoopCheckInterval) {
      clearInterval(this.eventLoopCheckInterval);
      this.eventLoopCheckInterval = null;
    }

    logger.info('PerformanceMonitorService stopped');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<DebugMetricsConfig>): void {
    const wasRunning = this.isRunning;

    if (wasRunning) {
      this.stop();
    }

    this.config = { ...this.config, ...config };

    // Resize buffers if maxDataPoints changed
    if (config.maxDataPoints) {
      this.memoryHistory.resize(config.maxDataPoints);
      this.cpuHistory.resize(config.maxDataPoints);
    }

    if (wasRunning) {
      this.start();
    }

    logger.info('PerformanceMonitorService configuration updated', config);
  }

  /**
   * Get current configuration
   */
  getConfig(): DebugMetricsConfig {
    return { ...this.config };
  }

  /**
   * Get whether monitoring is active
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Collect and emit current metrics
   */
  private collectAndEmitMetrics(): void {
    const timestamp = Date.now();
    const memoryMetrics = this.collectMemoryMetrics(timestamp);
    const cpuMetrics = this.collectCPUMetrics(timestamp);

    // Store in history
    if (this.config.memoryEnabled && memoryMetrics.server) {
      this.memoryHistory.push({
        timestamp,
        heapUsed: memoryMetrics.server.heapUsed,
      });
    }

    // Analyze memory trend
    const memoryTrend = this.analyzeMemoryTrend();

    // Get process information
    const processes = this.getProcesses();
    const processSummary = this.calculateProcessSummary(processes);

    // Build snapshot
    const snapshot: DebugMetricsSnapshot = {
      timestamp,
      memory: memoryMetrics,
      cpu: cpuMetrics,
      processes,
      processSummary,
      memoryTrend,
    };

    // Emit metrics event
    this.events.emit('debug:metrics', {
      type: 'debug:metrics',
      timestamp,
      metrics: snapshot,
    });

    // Check for memory warnings
    this.checkMemoryThresholds(memoryMetrics);

    // Check for memory leak
    if (memoryTrend && memoryTrend.isLeaking) {
      this.events.emit('debug:leak-detected', {
        type: 'debug:leak-detected',
        timestamp,
        trend: memoryTrend,
        message: `Potential memory leak detected: ${formatBytes(memoryTrend.growthRate)}/s sustained growth`,
      });
    }

    // Check for high CPU
    if (cpuMetrics.server && cpuMetrics.server.percentage > 80) {
      this.events.emit('debug:high-cpu', {
        type: 'debug:high-cpu',
        timestamp,
        cpu: cpuMetrics,
        usagePercent: cpuMetrics.server.percentage,
        threshold: 80,
        message: `High CPU usage: ${cpuMetrics.server.percentage.toFixed(1)}%`,
      });
    }
  }

  /**
   * Collect memory metrics from Node.js process
   */
  private collectMemoryMetrics(timestamp: number): MemoryMetrics {
    if (!this.config.memoryEnabled) {
      return { timestamp };
    }

    const usage = process.memoryUsage();
    const serverMetrics: ServerMemoryMetrics = {
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external,
      rss: usage.rss,
      arrayBuffers: usage.arrayBuffers,
    };

    return {
      timestamp,
      server: serverMetrics,
    };
  }

  /**
   * Collect CPU metrics from Node.js process
   */
  private collectCPUMetrics(timestamp: number): CPUMetrics {
    if (!this.config.cpuEnabled) {
      return { timestamp };
    }

    const currentCpuUsage = process.cpuUsage();
    const currentTime = Date.now();

    let serverMetrics: ServerCPUMetrics | undefined;

    if (this.lastCpuUsage) {
      // Calculate CPU usage since last measurement
      const userDiff = currentCpuUsage.user - this.lastCpuUsage.user;
      const systemDiff = currentCpuUsage.system - this.lastCpuUsage.system;
      const timeDiff = (currentTime - this.lastCpuTime) * 1000; // Convert to microseconds

      // Calculate percentage (CPU usage is in microseconds)
      // For multi-core systems, this can exceed 100%
      const percentage = timeDiff > 0 ? ((userDiff + systemDiff) / timeDiff) * 100 : 0;

      serverMetrics = {
        percentage: Math.min(100, percentage), // Cap at 100% for single-core representation
        user: userDiff,
        system: systemDiff,
      };

      // Store in history
      this.cpuHistory.push({
        timestamp,
        user: userDiff,
        system: systemDiff,
      });
    }

    this.lastCpuUsage = currentCpuUsage;
    this.lastCpuTime = currentTime;

    return {
      timestamp,
      server: serverMetrics,
      eventLoopLag: this.lastEventLoopLag,
    };
  }

  /**
   * Start event loop lag monitoring
   * Uses setTimeout deviation to detect when the event loop is blocked
   */
  private startEventLoopMonitoring(): void {
    const checkInterval = 100; // Check every 100ms

    const measureLag = () => {
      if (!this.isRunning) return;

      const start = Date.now();

      // setImmediate runs after I/O events, giving us event loop lag
      setImmediate(() => {
        const lag = Date.now() - start;
        this.lastEventLoopLag = lag;

        // Emit warning if lag exceeds threshold
        if (lag > this.eventLoopLagThreshold) {
          this.events.emit('debug:event-loop-blocked', {
            type: 'debug:event-loop-blocked',
            timestamp: Date.now(),
            lag,
            threshold: this.eventLoopLagThreshold,
            message: `Event loop blocked for ${lag}ms`,
          });
        }
      });
    };

    this.eventLoopCheckInterval = setInterval(measureLag, checkInterval);
  }

  /**
   * Analyze memory trend for leak detection
   */
  private analyzeMemoryTrend(): MemoryTrend | undefined {
    const history = this.memoryHistory.getAll();
    if (history.length < 10) {
      return undefined; // Need at least 10 samples for meaningful analysis
    }

    const first = history[0];
    const last = history[history.length - 1];
    const windowDuration = last.timestamp - first.timestamp;

    if (windowDuration === 0) {
      return undefined;
    }

    // Calculate linear regression for growth rate
    const n = history.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      const x = history[i].timestamp - first.timestamp;
      const y = history[i].heapUsed;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    // Slope of linear regression (bytes per millisecond)
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const growthRate = slope * 1000; // Convert to bytes per second

    // Calculate R² for confidence
    const meanY = sumY / n;
    let ssRes = 0;
    let ssTot = 0;
    const intercept = (sumY - slope * sumX) / n;

    for (let i = 0; i < n; i++) {
      const x = history[i].timestamp - first.timestamp;
      const y = history[i].heapUsed;
      const yPred = slope * x + intercept;
      ssRes += (y - yPred) ** 2;
      ssTot += (y - meanY) ** 2;
    }

    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
    const confidence = Math.max(0, Math.min(1, rSquared));

    // Consider it a leak if:
    // 1. Growth rate exceeds threshold
    // 2. R² is high (indicating consistent growth, not just fluctuation)
    const isLeaking =
      growthRate > this.config.leakThreshold && confidence > 0.7 && windowDuration > 30000; // At least 30 seconds of data

    return {
      growthRate,
      isLeaking,
      confidence,
      sampleCount: n,
      windowDuration,
    };
  }

  /**
   * Check memory thresholds and emit warnings
   */
  private checkMemoryThresholds(memory: MemoryMetrics): void {
    if (!memory.server) return;

    const now = Date.now();
    if (now - this.lastMemoryWarningTime < this.memoryWarningCooldown) {
      return; // Don't spam warnings
    }

    // Get V8 heap statistics for limit
    const heapStats = v8.getHeapStatistics();
    const heapLimit = heapStats.heap_size_limit;
    const usagePercent = (memory.server.heapUsed / heapLimit) * 100;

    if (usagePercent >= this.memoryCriticalThreshold) {
      this.lastMemoryWarningTime = now;
      this.events.emit('debug:memory-critical', {
        type: 'debug:memory-critical',
        timestamp: now,
        memory,
        usagePercent,
        threshold: this.memoryCriticalThreshold,
        message: `Critical memory usage: ${usagePercent.toFixed(1)}% of heap limit`,
      });
    } else if (usagePercent >= this.memoryWarningThreshold) {
      this.lastMemoryWarningTime = now;
      this.events.emit('debug:memory-warning', {
        type: 'debug:memory-warning',
        timestamp: now,
        memory,
        usagePercent,
        threshold: this.memoryWarningThreshold,
        message: `High memory usage: ${usagePercent.toFixed(1)}% of heap limit`,
      });
    }
  }

  /**
   * Calculate process summary from tracked processes
   */
  private calculateProcessSummary(processes: TrackedProcess[]): ProcessSummary {
    const summary: ProcessSummary = {
      total: processes.length,
      running: 0,
      idle: 0,
      stopped: 0,
      errored: 0,
      byType: {
        agent: 0,
        cli: 0,
        terminal: 0,
        worker: 0,
      },
    };

    for (const process of processes) {
      // Count by status
      switch (process.status) {
        case 'running':
        case 'starting':
          summary.running++;
          break;
        case 'idle':
          summary.idle++;
          break;
        case 'stopped':
        case 'stopping':
          summary.stopped++;
          break;
        case 'error':
          summary.errored++;
          break;
      }

      // Count by type
      if (process.type in summary.byType) {
        summary.byType[process.type]++;
      }
    }

    return summary;
  }

  /**
   * Get latest metrics snapshot
   */
  getLatestSnapshot(): DebugMetricsSnapshot | null {
    const timestamp = Date.now();
    const lastMemory = this.memoryHistory.getLast();

    if (!lastMemory) {
      return null;
    }

    const memoryMetrics = this.collectMemoryMetrics(timestamp);
    const cpuMetrics = this.collectCPUMetrics(timestamp);
    const memoryTrend = this.analyzeMemoryTrend();
    const processes = this.getProcesses();
    const processSummary = this.calculateProcessSummary(processes);

    return {
      timestamp,
      memory: memoryMetrics,
      cpu: cpuMetrics,
      processes,
      processSummary,
      memoryTrend,
    };
  }

  /**
   * Get memory history for charting
   */
  getMemoryHistory(): MemoryDataPoint[] {
    return this.memoryHistory.getAll();
  }

  /**
   * Get CPU history for charting
   */
  getCPUHistory(): CPUDataPoint[] {
    return this.cpuHistory.getAll();
  }

  /**
   * Force a garbage collection (if --expose-gc flag is used)
   * Returns true if GC was triggered, false if not available
   */
  forceGC(): boolean {
    if (global.gc) {
      global.gc();
      logger.info('Forced garbage collection');
      return true;
    }
    logger.warn('Garbage collection not available (start with --expose-gc flag)');
    return false;
  }

  /**
   * Clear collected history
   */
  clearHistory(): void {
    this.memoryHistory.clear();
    this.cpuHistory.clear();
    logger.info('Performance history cleared');
  }
}
