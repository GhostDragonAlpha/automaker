/**
 * Debug types for AutoMaker performance monitoring and debugging
 *
 * This module defines types for:
 * - Memory metrics and monitoring
 * - CPU metrics and monitoring
 * - Process tracking (agents, CLIs, terminals)
 * - Component render tracking
 * - Debug event streaming
 */

// ============================================================================
// Memory Metrics
// ============================================================================

/**
 * Memory metrics from the server (Node.js process)
 */
export interface ServerMemoryMetrics {
  /** Total heap size allocated (bytes) */
  heapTotal: number;
  /** Heap actually used (bytes) */
  heapUsed: number;
  /** V8 external memory (bytes) - memory used by C++ objects bound to JS */
  external: number;
  /** Resident Set Size - total memory allocated for the process (bytes) */
  rss: number;
  /** Array buffers memory (bytes) */
  arrayBuffers: number;
}

/**
 * Memory metrics from the browser (performance.memory API)
 * Note: Only available in Chromium-based browsers with --enable-precise-memory-info flag
 */
export interface BrowserMemoryMetrics {
  /** Total JS heap size limit (bytes) */
  jsHeapSizeLimit: number;
  /** Total allocated heap size (bytes) */
  totalJSHeapSize: number;
  /** Currently used heap size (bytes) */
  usedJSHeapSize: number;
}

/**
 * Combined memory metrics snapshot
 */
export interface MemoryMetrics {
  /** Timestamp of the measurement */
  timestamp: number;
  /** Server-side memory metrics (Node.js) */
  server?: ServerMemoryMetrics;
  /** Browser-side memory metrics */
  browser?: BrowserMemoryMetrics;
}

/**
 * Memory trend analysis for leak detection
 */
export interface MemoryTrend {
  /** Average memory growth rate (bytes/second) */
  growthRate: number;
  /** Indicates potential memory leak if growth is sustained */
  isLeaking: boolean;
  /** Confidence level of leak detection (0-1) */
  confidence: number;
  /** Number of samples used for trend analysis */
  sampleCount: number;
  /** Duration of trend analysis window (ms) */
  windowDuration: number;
}

// ============================================================================
// CPU Metrics
// ============================================================================

/**
 * CPU usage metrics from the server
 */
export interface ServerCPUMetrics {
  /** CPU usage percentage (0-100) */
  percentage: number;
  /** User CPU time (microseconds) */
  user: number;
  /** System CPU time (microseconds) */
  system: number;
}

/**
 * Combined CPU metrics snapshot
 */
export interface CPUMetrics {
  /** Timestamp of the measurement */
  timestamp: number;
  /** Server CPU metrics */
  server?: ServerCPUMetrics;
  /** Event loop lag in milliseconds (indicates event loop blocking) */
  eventLoopLag?: number;
}

// ============================================================================
// Agent Resource Metrics
// ============================================================================

/**
 * File I/O operation type
 */
export type FileIOOperation = 'read' | 'write' | 'edit' | 'delete' | 'glob' | 'grep';

/**
 * File I/O metrics for tracking agent file operations
 */
export interface FileIOMetrics {
  /** Number of file read operations */
  reads: number;
  /** Total bytes read */
  bytesRead: number;
  /** Number of file write operations */
  writes: number;
  /** Total bytes written */
  bytesWritten: number;
  /** Number of file edit operations */
  edits: number;
  /** Number of glob/search operations */
  globs: number;
  /** Number of grep/content search operations */
  greps: number;
  /** Files accessed (unique paths) */
  filesAccessed: string[];
}

/**
 * Tool usage metrics for tracking agent tool invocations
 */
export interface ToolUsageMetrics {
  /** Total tool invocations */
  totalInvocations: number;
  /** Invocations per tool name */
  byTool: Record<string, number>;
  /** Average tool execution time (ms) */
  avgExecutionTime: number;
  /** Total tool execution time (ms) */
  totalExecutionTime: number;
  /** Failed tool invocations */
  failedInvocations: number;
}

/**
 * Bash command execution metrics
 */
export interface BashMetrics {
  /** Number of bash commands executed */
  commandCount: number;
  /** Total execution time (ms) */
  totalExecutionTime: number;
  /** Number of failed commands (non-zero exit) */
  failedCommands: number;
  /** Commands executed (for debugging) */
  commands: Array<{
    command: string;
    exitCode: number | null;
    duration: number;
    timestamp: number;
  }>;
}

/**
 * API call metrics for tracking Anthropic API usage
 */
export interface APIMetrics {
  /** Number of API turns/iterations */
  turns: number;
  /** Input tokens used (if available) */
  inputTokens?: number;
  /** Output tokens generated (if available) */
  outputTokens?: number;
  /** Thinking tokens used (if available) */
  thinkingTokens?: number;
  /** Total API call duration (ms) */
  totalDuration: number;
  /** Number of API errors */
  errors: number;
}

/**
 * Memory delta tracking for an agent execution
 */
export interface AgentMemoryMetrics {
  /** Memory at agent start (bytes) */
  startHeapUsed: number;
  /** Current/latest memory (bytes) */
  currentHeapUsed: number;
  /** Peak memory during execution (bytes) */
  peakHeapUsed: number;
  /** Memory change since start (can be negative) */
  deltaHeapUsed: number;
  /** Memory samples over time for trend analysis */
  samples: Array<{ timestamp: number; heapUsed: number }>;
}

/**
 * Comprehensive agent resource metrics
 */
export interface AgentResourceMetrics {
  /** Agent/process ID */
  agentId: string;
  /** Session ID if available */
  sessionId?: string;
  /** Feature ID if running a feature */
  featureId?: string;
  /** When metrics collection started */
  startedAt: number;
  /** When metrics were last updated */
  lastUpdatedAt: number;
  /** Duration of agent execution (ms) */
  duration: number;
  /** Memory metrics */
  memory: AgentMemoryMetrics;
  /** File I/O metrics */
  fileIO: FileIOMetrics;
  /** Tool usage metrics */
  tools: ToolUsageMetrics;
  /** Bash command metrics */
  bash: BashMetrics;
  /** API call metrics */
  api: APIMetrics;
  /** Whether the agent is still running */
  isRunning: boolean;
}

/**
 * Create empty agent resource metrics
 */
export function createEmptyAgentResourceMetrics(
  agentId: string,
  options?: { sessionId?: string; featureId?: string }
): AgentResourceMetrics {
  const now = Date.now();
  const heapUsed = typeof process !== 'undefined' ? process.memoryUsage().heapUsed : 0;

  return {
    agentId,
    sessionId: options?.sessionId,
    featureId: options?.featureId,
    startedAt: now,
    lastUpdatedAt: now,
    duration: 0,
    isRunning: true,
    memory: {
      startHeapUsed: heapUsed,
      currentHeapUsed: heapUsed,
      peakHeapUsed: heapUsed,
      deltaHeapUsed: 0,
      samples: [{ timestamp: now, heapUsed }],
    },
    fileIO: {
      reads: 0,
      bytesRead: 0,
      writes: 0,
      bytesWritten: 0,
      edits: 0,
      globs: 0,
      greps: 0,
      filesAccessed: [],
    },
    tools: {
      totalInvocations: 0,
      byTool: {},
      avgExecutionTime: 0,
      totalExecutionTime: 0,
      failedInvocations: 0,
    },
    bash: {
      commandCount: 0,
      totalExecutionTime: 0,
      failedCommands: 0,
      commands: [],
    },
    api: {
      turns: 0,
      totalDuration: 0,
      errors: 0,
    },
  };
}

// ============================================================================
// Process Tracking
// ============================================================================

/**
 * Process type enumeration
 */
export type ProcessType = 'agent' | 'cli' | 'terminal' | 'worker';

/**
 * Process status enumeration
 */
export type ProcessStatus = 'starting' | 'running' | 'idle' | 'stopping' | 'stopped' | 'error';

/**
 * Information about a tracked process
 */
export interface TrackedProcess {
  /** Unique identifier for the process */
  id: string;
  /** Process ID from the operating system */
  pid: number;
  /** Type of process */
  type: ProcessType;
  /** Human-readable name/label */
  name: string;
  /** Current status */
  status: ProcessStatus;
  /** Timestamp when process was spawned */
  startedAt: number;
  /** Timestamp when process stopped (if applicable) */
  stoppedAt?: number;
  /** Memory usage in bytes (if available) */
  memoryUsage?: number;
  /** CPU usage percentage (if available) */
  cpuUsage?: number;
  /** Associated feature ID (for agent processes) */
  featureId?: string;
  /** Associated session ID (for agent processes) */
  sessionId?: string;
  /** Command that was executed */
  command?: string;
  /** Working directory */
  cwd?: string;
  /** Exit code (if process has stopped) */
  exitCode?: number;
  /** Error message (if process failed) */
  error?: string;
  /** Detailed resource metrics for agent processes */
  resourceMetrics?: AgentResourceMetrics;
}

/**
 * Summary of all tracked processes
 */
export interface ProcessSummary {
  /** Total number of tracked processes */
  total: number;
  /** Number of currently running processes */
  running: number;
  /** Number of idle processes */
  idle: number;
  /** Number of stopped processes */
  stopped: number;
  /** Number of errored processes */
  errored: number;
  /** Breakdown by process type */
  byType: Record<ProcessType, number>;
}

// ============================================================================
// Render Tracking
// ============================================================================

/**
 * Render phase from React Profiler
 */
export type RenderPhase = 'mount' | 'update' | 'nested-update';

/**
 * Information about a component render
 */
export interface ComponentRender {
  /** Component name/identifier */
  componentName: string;
  /** Render phase */
  phase: RenderPhase;
  /** Actual render duration (ms) */
  actualDuration: number;
  /** Base render duration (ms) - time to render without memoization */
  baseDuration: number;
  /** Start time of the render */
  startTime: number;
  /** Commit time */
  commitTime: number;
}

/**
 * Aggregated render statistics for a component
 */
export interface ComponentRenderStats {
  /** Component name */
  componentName: string;
  /** Total number of renders in the tracking window */
  renderCount: number;
  /** Renders per second */
  rendersPerSecond: number;
  /** Average render duration (ms) */
  avgDuration: number;
  /** Maximum render duration (ms) */
  maxDuration: number;
  /** Minimum render duration (ms) */
  minDuration: number;
  /** Total time spent rendering (ms) */
  totalDuration: number;
  /** Whether this component exceeds the render threshold */
  isHighRender: boolean;
  /** Last render timestamp */
  lastRenderAt: number;
}

/**
 * Render tracking summary
 */
export interface RenderTrackingSummary {
  /** Total renders tracked */
  totalRenders: number;
  /** Number of unique components tracked */
  uniqueComponents: number;
  /** Components exceeding render threshold */
  highRenderComponents: string[];
  /** Top 5 most frequently rendered components */
  topRenderers: ComponentRenderStats[];
  /** Tracking window start time */
  windowStart: number;
  /** Tracking window duration (ms) */
  windowDuration: number;
}

// ============================================================================
// Combined Metrics
// ============================================================================

/**
 * Complete debug metrics snapshot
 */
export interface DebugMetricsSnapshot {
  /** Timestamp of the snapshot */
  timestamp: number;
  /** Memory metrics */
  memory: MemoryMetrics;
  /** CPU metrics */
  cpu: CPUMetrics;
  /** List of tracked processes */
  processes: TrackedProcess[];
  /** Process summary */
  processSummary: ProcessSummary;
  /** Memory trend analysis */
  memoryTrend?: MemoryTrend;
}

/**
 * Debug metrics configuration
 */
export interface DebugMetricsConfig {
  /** Enable memory monitoring */
  memoryEnabled: boolean;
  /** Enable CPU monitoring */
  cpuEnabled: boolean;
  /** Enable process tracking */
  processTrackingEnabled: boolean;
  /** Metrics collection interval (ms) */
  collectionInterval: number;
  /** Number of data points to retain */
  maxDataPoints: number;
  /** Memory leak detection threshold (bytes/second sustained growth) */
  leakThreshold: number;
}

/**
 * Default debug metrics configuration
 */
export const DEFAULT_DEBUG_METRICS_CONFIG: DebugMetricsConfig = {
  memoryEnabled: true,
  cpuEnabled: true,
  processTrackingEnabled: true,
  collectionInterval: 1000,
  maxDataPoints: 60,
  leakThreshold: 1024 * 1024, // 1MB/second sustained growth indicates potential leak
};

// ============================================================================
// Debug Events
// ============================================================================

/**
 * Debug event types for real-time streaming
 */
export type DebugEventType =
  | 'debug:metrics'
  | 'debug:memory-warning'
  | 'debug:memory-critical'
  | 'debug:leak-detected'
  | 'debug:process-spawned'
  | 'debug:process-updated'
  | 'debug:process-stopped'
  | 'debug:process-error'
  | 'debug:high-cpu'
  | 'debug:event-loop-blocked';

/**
 * Base debug event interface
 */
export interface DebugEventBase {
  /** Event type */
  type: DebugEventType;
  /** Event timestamp */
  timestamp: number;
}

/**
 * Metrics update event
 */
export interface DebugMetricsEvent extends DebugEventBase {
  type: 'debug:metrics';
  /** The metrics snapshot */
  metrics: DebugMetricsSnapshot;
}

/**
 * Memory warning event (heap usage exceeds threshold)
 */
export interface DebugMemoryWarningEvent extends DebugEventBase {
  type: 'debug:memory-warning' | 'debug:memory-critical';
  /** Current memory usage */
  memory: MemoryMetrics;
  /** Usage percentage */
  usagePercent: number;
  /** Threshold that was exceeded */
  threshold: number;
  /** Warning message */
  message: string;
}

/**
 * Memory leak detected event
 */
export interface DebugLeakDetectedEvent extends DebugEventBase {
  type: 'debug:leak-detected';
  /** Memory trend analysis */
  trend: MemoryTrend;
  /** Warning message */
  message: string;
}

/**
 * Process lifecycle events
 */
export interface DebugProcessEvent extends DebugEventBase {
  type:
    | 'debug:process-spawned'
    | 'debug:process-updated'
    | 'debug:process-stopped'
    | 'debug:process-error';
  /** Process information */
  process: TrackedProcess;
  /** Additional message */
  message?: string;
}

/**
 * High CPU usage event
 */
export interface DebugHighCPUEvent extends DebugEventBase {
  type: 'debug:high-cpu';
  /** CPU metrics */
  cpu: CPUMetrics;
  /** Usage percentage */
  usagePercent: number;
  /** Threshold that was exceeded */
  threshold: number;
  /** Warning message */
  message: string;
}

/**
 * Event loop blocked event
 */
export interface DebugEventLoopBlockedEvent extends DebugEventBase {
  type: 'debug:event-loop-blocked';
  /** Event loop lag in milliseconds */
  lag: number;
  /** Threshold that was exceeded */
  threshold: number;
  /** Warning message */
  message: string;
}

/**
 * Union type of all debug events
 */
export type DebugEvent =
  | DebugMetricsEvent
  | DebugMemoryWarningEvent
  | DebugLeakDetectedEvent
  | DebugProcessEvent
  | DebugHighCPUEvent
  | DebugEventLoopBlockedEvent;

// ============================================================================
// API Types
// ============================================================================

/**
 * Request to start debug metrics collection
 */
export interface StartDebugMetricsRequest {
  /** Configuration overrides */
  config?: Partial<DebugMetricsConfig>;
}

/**
 * Response from debug metrics endpoint
 */
export interface DebugMetricsResponse {
  /** Whether metrics collection is active */
  active: boolean;
  /** Current configuration */
  config: DebugMetricsConfig;
  /** Latest metrics snapshot */
  snapshot?: DebugMetricsSnapshot;
}

/**
 * Request to get process list
 */
export interface GetProcessesRequest {
  /** Filter by process type */
  type?: ProcessType;
  /** Filter by status */
  status?: ProcessStatus;
  /** Include stopped processes */
  includeStoppedProcesses?: boolean;
}

/**
 * Response from process list endpoint
 */
export interface GetProcessesResponse {
  /** List of processes */
  processes: TrackedProcess[];
  /** Summary statistics */
  summary: ProcessSummary;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Circular buffer entry for time-series data
 */
export interface TimeSeriesDataPoint<T> {
  /** Timestamp */
  timestamp: number;
  /** Data value */
  value: T;
}

/**
 * Memory data point for charts
 */
export interface MemoryDataPoint {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  rss?: number;
}

/**
 * CPU data point for charts
 */
export interface CPUDataPoint {
  timestamp: number;
  percentage: number;
  eventLoopLag?: number;
}

/**
 * Format bytes to human-readable string
 * @param bytes - Number of bytes (can be negative for rate display)
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const absBytes = Math.abs(bytes);
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(absBytes) / Math.log(k));
  const sign = bytes < 0 ? '-' : '';
  return `${sign}${parseFloat((absBytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format duration to human-readable string
 * @param ms - Duration in milliseconds
 * @returns Formatted string (e.g., "1.5s", "150ms")
 */
export function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Calculate percentage with bounds
 * @param value - Current value
 * @param total - Total/max value
 * @returns Percentage (0-100)
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.min(100, Math.max(0, (value / total) * 100));
}
