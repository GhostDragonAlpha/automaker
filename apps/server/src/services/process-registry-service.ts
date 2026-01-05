/**
 * Process Registry Service
 *
 * Tracks spawned agents, CLIs, and terminal processes for debugging and monitoring.
 * Emits debug events for real-time updates to connected clients.
 *
 * This service provides:
 * - Process registration and unregistration
 * - Status updates for tracked processes
 * - Integration with PerformanceMonitorService for metrics snapshots
 * - Filtering and querying of tracked processes
 * - Automatic cleanup of stopped processes after a retention period
 */

import { createLogger } from '@automaker/utils';
import type { EventEmitter } from '../lib/events.js';
import type {
  TrackedProcess,
  ProcessType,
  ProcessStatus,
  ProcessSummary,
  AgentResourceMetrics,
  FileIOOperation,
} from '@automaker/types';
import { createEmptyAgentResourceMetrics } from '@automaker/types';

const logger = createLogger('ProcessRegistry');

/**
 * Options for recording a tool invocation
 */
export interface RecordToolUseOptions {
  /** Tool name */
  toolName: string;
  /** Execution time in milliseconds */
  executionTime?: number;
  /** Whether the tool invocation failed */
  failed?: boolean;
}

/**
 * Options for recording a file operation
 */
export interface RecordFileOperationOptions {
  /** Type of file operation */
  operation: FileIOOperation;
  /** File path accessed */
  filePath: string;
  /** Bytes read or written */
  bytes?: number;
}

/**
 * Options for recording a bash command
 */
export interface RecordBashCommandOptions {
  /** Command executed */
  command: string;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Exit code (null if still running or killed) */
  exitCode: number | null;
}

/**
 * Options for registering a new process
 */
export interface RegisterProcessOptions {
  /** Unique identifier for the process */
  id: string;
  /** Process ID from the operating system (-1 if not applicable) */
  pid: number;
  /** Type of process */
  type: ProcessType;
  /** Human-readable name/label */
  name: string;
  /** Associated feature ID (for agent processes) */
  featureId?: string;
  /** Associated session ID (for agent/terminal processes) */
  sessionId?: string;
  /** Command that was executed */
  command?: string;
  /** Working directory */
  cwd?: string;
}

/**
 * Options for updating a process
 */
export interface UpdateProcessOptions {
  /** New status */
  status?: ProcessStatus;
  /** Memory usage in bytes */
  memoryUsage?: number;
  /** CPU usage percentage */
  cpuUsage?: number;
  /** Exit code (when stopping) */
  exitCode?: number;
  /** Error message */
  error?: string;
}

/**
 * Options for querying processes
 */
export interface QueryProcessOptions {
  /** Filter by process type */
  type?: ProcessType;
  /** Filter by status */
  status?: ProcessStatus;
  /** Include stopped processes (default: false) */
  includeStopped?: boolean;
  /** Filter by session ID */
  sessionId?: string;
  /** Filter by feature ID */
  featureId?: string;
}

/**
 * Configuration for the ProcessRegistryService
 */
export interface ProcessRegistryConfig {
  /** How long to keep stopped processes in the registry (ms) */
  stoppedProcessRetention: number;
  /** Interval for cleanup of old stopped processes (ms) */
  cleanupInterval: number;
  /** Maximum number of stopped processes to retain */
  maxStoppedProcesses: number;
}

const DEFAULT_CONFIG: ProcessRegistryConfig = {
  stoppedProcessRetention: 5 * 60 * 1000, // 5 minutes
  cleanupInterval: 60 * 1000, // 1 minute
  maxStoppedProcesses: 100,
};

/**
 * ProcessRegistryService - Tracks spawned processes for debugging
 *
 * This service maintains a registry of all tracked processes including:
 * - Agent sessions (AI conversations)
 * - CLI processes (one-off commands)
 * - Terminal sessions (persistent PTY sessions)
 * - Worker processes (background tasks)
 *
 * It emits events when processes are spawned, updated, or stopped,
 * allowing real-time monitoring in the debug panel.
 */
export class ProcessRegistryService {
  private events: EventEmitter;
  private config: ProcessRegistryConfig;
  private processes: Map<string, TrackedProcess> = new Map();
  private cleanupIntervalId: NodeJS.Timeout | null = null;

  constructor(events: EventEmitter, config?: Partial<ProcessRegistryConfig>) {
    this.events = events;
    this.config = { ...DEFAULT_CONFIG, ...config };

    logger.info('ProcessRegistryService initialized');
  }

  /**
   * Start the process registry service
   * Begins periodic cleanup of old stopped processes
   */
  start(): void {
    if (this.cleanupIntervalId) {
      logger.warn('ProcessRegistryService is already running');
      return;
    }

    this.cleanupIntervalId = setInterval(() => {
      this.cleanupStoppedProcesses();
    }, this.config.cleanupInterval);

    logger.info('ProcessRegistryService started');
  }

  /**
   * Stop the process registry service
   */
  stop(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }

    logger.info('ProcessRegistryService stopped');
  }

  /**
   * Register a new process
   */
  registerProcess(options: RegisterProcessOptions): TrackedProcess {
    const now = Date.now();

    const process: TrackedProcess = {
      id: options.id,
      pid: options.pid,
      type: options.type,
      name: options.name,
      status: 'starting',
      startedAt: now,
      featureId: options.featureId,
      sessionId: options.sessionId,
      command: options.command,
      cwd: options.cwd,
    };

    this.processes.set(options.id, process);

    logger.info('Process registered', {
      id: process.id,
      type: process.type,
      name: process.name,
      pid: process.pid,
    });

    // Emit process spawned event
    this.events.emit('debug:process-spawned', {
      type: 'debug:process-spawned',
      timestamp: now,
      process,
      message: `Process ${process.name} (${process.type}) started`,
    });

    return process;
  }

  /**
   * Update an existing process
   */
  updateProcess(id: string, updates: UpdateProcessOptions): TrackedProcess | null {
    const process = this.processes.get(id);
    if (!process) {
      logger.warn('Attempted to update non-existent process', { id });
      return null;
    }

    const now = Date.now();

    // Apply updates
    if (updates.status !== undefined) {
      process.status = updates.status;

      // Set stoppedAt timestamp when process stops
      if (updates.status === 'stopped' || updates.status === 'error') {
        process.stoppedAt = now;
      }
    }

    if (updates.memoryUsage !== undefined) {
      process.memoryUsage = updates.memoryUsage;
    }

    if (updates.cpuUsage !== undefined) {
      process.cpuUsage = updates.cpuUsage;
    }

    if (updates.exitCode !== undefined) {
      process.exitCode = updates.exitCode;
    }

    if (updates.error !== undefined) {
      process.error = updates.error;
    }

    logger.debug('Process updated', {
      id,
      updates,
    });

    // Emit appropriate event based on status
    if (updates.status === 'stopped') {
      this.events.emit('debug:process-stopped', {
        type: 'debug:process-stopped',
        timestamp: now,
        process,
        message: `Process ${process.name} stopped${updates.exitCode !== undefined ? ` (exit code: ${updates.exitCode})` : ''}`,
      });
    } else if (updates.status === 'error') {
      this.events.emit('debug:process-error', {
        type: 'debug:process-error',
        timestamp: now,
        process,
        message: `Process ${process.name} encountered an error: ${updates.error || 'Unknown error'}`,
      });
    } else {
      this.events.emit('debug:process-updated', {
        type: 'debug:process-updated',
        timestamp: now,
        process,
      });
    }

    return process;
  }

  /**
   * Mark a process as running
   */
  markRunning(id: string): TrackedProcess | null {
    return this.updateProcess(id, { status: 'running' });
  }

  /**
   * Mark a process as idle
   */
  markIdle(id: string): TrackedProcess | null {
    return this.updateProcess(id, { status: 'idle' });
  }

  /**
   * Mark a process as stopping
   */
  markStopping(id: string): TrackedProcess | null {
    return this.updateProcess(id, { status: 'stopping' });
  }

  /**
   * Mark a process as stopped
   */
  markStopped(id: string, exitCode?: number): TrackedProcess | null {
    return this.updateProcess(id, { status: 'stopped', exitCode });
  }

  /**
   * Mark a process as errored
   */
  markError(id: string, error: string): TrackedProcess | null {
    return this.updateProcess(id, { status: 'error', error });
  }

  /**
   * Unregister a process (remove immediately without retention)
   */
  unregisterProcess(id: string): boolean {
    const process = this.processes.get(id);
    if (!process) {
      return false;
    }

    this.processes.delete(id);

    logger.info('Process unregistered', {
      id,
      type: process.type,
      name: process.name,
    });

    return true;
  }

  /**
   * Get a process by ID
   */
  getProcess(id: string): TrackedProcess | undefined {
    return this.processes.get(id);
  }

  /**
   * Get all tracked processes, optionally filtered
   * Optimized single-pass filtering to avoid multiple array allocations
   */
  getProcesses(options?: QueryProcessOptions): TrackedProcess[] {
    // Pre-allocate array with estimated capacity
    const result: TrackedProcess[] = [];

    // Single-pass filtering
    for (const process of this.processes.values()) {
      // Filter by type
      if (options?.type && process.type !== options.type) {
        continue;
      }

      // Filter by status
      if (options?.status && process.status !== options.status) {
        continue;
      }

      // Filter out stopped processes by default
      if (!options?.includeStopped) {
        if (process.status === 'stopped' || process.status === 'error') {
          continue;
        }
      }

      // Filter by session ID
      if (options?.sessionId && process.sessionId !== options.sessionId) {
        continue;
      }

      // Filter by feature ID
      if (options?.featureId && process.featureId !== options.featureId) {
        continue;
      }

      result.push(process);
    }

    // Sort by start time (most recent first)
    result.sort((a, b) => b.startedAt - a.startedAt);

    return result;
  }

  /**
   * Get all processes (for PerformanceMonitorService integration)
   * This is used as the process provider function
   */
  getAllProcesses(): TrackedProcess[] {
    return Array.from(this.processes.values());
  }

  /**
   * Get process provider function for PerformanceMonitorService
   */
  getProcessProvider(): () => TrackedProcess[] {
    return () => this.getAllProcesses();
  }

  /**
   * Calculate summary statistics for tracked processes
   */
  getProcessSummary(): ProcessSummary {
    const processes = this.getAllProcesses();

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
   * Get count of active (non-stopped) processes
   */
  getActiveCount(): number {
    let count = 0;
    for (const process of this.processes.values()) {
      if (process.status !== 'stopped' && process.status !== 'error') {
        count++;
      }
    }
    return count;
  }

  /**
   * Get count of processes by type
   */
  getCountByType(type: ProcessType): number {
    let count = 0;
    for (const process of this.processes.values()) {
      if (process.type === type) {
        count++;
      }
    }
    return count;
  }

  /**
   * Check if a process exists
   */
  hasProcess(id: string): boolean {
    return this.processes.has(id);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ProcessRegistryConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('ProcessRegistryService configuration updated', config);
  }

  /**
   * Get current configuration
   */
  getConfig(): ProcessRegistryConfig {
    return { ...this.config };
  }

  /**
   * Clean up old stopped processes
   */
  private cleanupStoppedProcesses(): void {
    const now = Date.now();
    const stoppedProcesses: Array<{ id: string; stoppedAt: number }> = [];

    // Find all stopped processes
    for (const [id, process] of this.processes.entries()) {
      if ((process.status === 'stopped' || process.status === 'error') && process.stoppedAt) {
        stoppedProcesses.push({ id, stoppedAt: process.stoppedAt });
      }
    }

    // Sort by stoppedAt (oldest first)
    stoppedProcesses.sort((a, b) => a.stoppedAt - b.stoppedAt);

    let removedCount = 0;

    // Remove processes that exceed retention time
    for (const { id, stoppedAt } of stoppedProcesses) {
      const age = now - stoppedAt;
      if (age > this.config.stoppedProcessRetention) {
        this.processes.delete(id);
        removedCount++;
      }
    }

    // If still over max, remove oldest stopped processes
    const remainingStoppedCount = stoppedProcesses.length - removedCount;
    if (remainingStoppedCount > this.config.maxStoppedProcesses) {
      const toRemove = remainingStoppedCount - this.config.maxStoppedProcesses;
      let removed = 0;

      for (const { id } of stoppedProcesses) {
        if (this.processes.has(id) && removed < toRemove) {
          this.processes.delete(id);
          removedCount++;
          removed++;
        }
      }
    }

    if (removedCount > 0) {
      logger.debug('Cleaned up stopped processes', { removedCount });
    }
  }

  /**
   * Clear all tracked processes
   */
  clear(): void {
    this.processes.clear();
    logger.info('All tracked processes cleared');
  }

  // ============================================================================
  // Agent Resource Metrics Tracking
  // ============================================================================

  /**
   * Initialize resource metrics for an agent process
   * Call this when an agent starts to begin tracking its resource usage
   */
  initializeAgentMetrics(
    processId: string,
    options?: { sessionId?: string; featureId?: string }
  ): AgentResourceMetrics | null {
    const process = this.processes.get(processId);
    if (!process) {
      logger.warn('Cannot initialize metrics for non-existent process', { processId });
      return null;
    }

    if (process.type !== 'agent') {
      logger.warn('Cannot initialize agent metrics for non-agent process', {
        processId,
        type: process.type,
      });
      return null;
    }

    const metrics = createEmptyAgentResourceMetrics(processId, {
      sessionId: options?.sessionId || process.sessionId,
      featureId: options?.featureId || process.featureId,
    });

    process.resourceMetrics = metrics;

    logger.debug('Agent metrics initialized', { processId });

    return metrics;
  }

  /**
   * Get resource metrics for an agent process
   */
  getAgentMetrics(processId: string): AgentResourceMetrics | undefined {
    const process = this.processes.get(processId);
    return process?.resourceMetrics;
  }

  /**
   * Record a tool invocation for an agent
   */
  recordToolUse(processId: string, options: RecordToolUseOptions): void {
    const process = this.processes.get(processId);
    if (!process?.resourceMetrics) {
      return;
    }

    const metrics = process.resourceMetrics;
    const now = Date.now();

    // Update tool metrics
    metrics.tools.totalInvocations++;
    metrics.tools.byTool[options.toolName] = (metrics.tools.byTool[options.toolName] || 0) + 1;

    if (options.executionTime !== undefined) {
      metrics.tools.totalExecutionTime += options.executionTime;
      metrics.tools.avgExecutionTime =
        metrics.tools.totalExecutionTime / metrics.tools.totalInvocations;
    }

    if (options.failed) {
      metrics.tools.failedInvocations++;
    }

    // Update memory snapshot
    this.updateMemorySnapshot(processId);

    metrics.lastUpdatedAt = now;
    metrics.duration = now - metrics.startedAt;

    logger.debug('Tool use recorded', {
      processId,
      tool: options.toolName,
      totalInvocations: metrics.tools.totalInvocations,
    });
  }

  /**
   * Record a file operation for an agent
   */
  recordFileOperation(processId: string, options: RecordFileOperationOptions): void {
    const process = this.processes.get(processId);
    if (!process?.resourceMetrics) {
      return;
    }

    const metrics = process.resourceMetrics;
    const now = Date.now();

    // Update file I/O metrics based on operation type
    switch (options.operation) {
      case 'read':
        metrics.fileIO.reads++;
        if (options.bytes) {
          metrics.fileIO.bytesRead += options.bytes;
        }
        break;
      case 'write':
        metrics.fileIO.writes++;
        if (options.bytes) {
          metrics.fileIO.bytesWritten += options.bytes;
        }
        break;
      case 'edit':
        metrics.fileIO.edits++;
        if (options.bytes) {
          metrics.fileIO.bytesWritten += options.bytes;
        }
        break;
      case 'glob':
        metrics.fileIO.globs++;
        break;
      case 'grep':
        metrics.fileIO.greps++;
        break;
    }

    // Track unique files accessed
    if (!metrics.fileIO.filesAccessed.includes(options.filePath)) {
      // Limit to 100 files to prevent memory bloat
      if (metrics.fileIO.filesAccessed.length < 100) {
        metrics.fileIO.filesAccessed.push(options.filePath);
      }
    }

    metrics.lastUpdatedAt = now;
    metrics.duration = now - metrics.startedAt;

    logger.debug('File operation recorded', {
      processId,
      operation: options.operation,
      filePath: options.filePath,
    });
  }

  /**
   * Record a bash command execution for an agent
   */
  recordBashCommand(processId: string, options: RecordBashCommandOptions): void {
    const process = this.processes.get(processId);
    if (!process?.resourceMetrics) {
      return;
    }

    const metrics = process.resourceMetrics;
    const now = Date.now();

    metrics.bash.commandCount++;
    metrics.bash.totalExecutionTime += options.executionTime;

    if (options.exitCode !== null && options.exitCode !== 0) {
      metrics.bash.failedCommands++;
    }

    // Keep only last 20 commands to prevent memory bloat
    if (metrics.bash.commands.length >= 20) {
      metrics.bash.commands.shift();
    }

    metrics.bash.commands.push({
      command: options.command.substring(0, 200), // Truncate long commands
      exitCode: options.exitCode,
      duration: options.executionTime,
      timestamp: now,
    });

    // Update memory snapshot
    this.updateMemorySnapshot(processId);

    metrics.lastUpdatedAt = now;
    metrics.duration = now - metrics.startedAt;

    logger.debug('Bash command recorded', {
      processId,
      command: options.command.substring(0, 50),
      exitCode: options.exitCode,
    });
  }

  /**
   * Record an API turn/iteration for an agent
   */
  recordAPITurn(
    processId: string,
    options?: {
      inputTokens?: number;
      outputTokens?: number;
      thinkingTokens?: number;
      duration?: number;
      error?: boolean;
    }
  ): void {
    const process = this.processes.get(processId);
    if (!process?.resourceMetrics) {
      return;
    }

    const metrics = process.resourceMetrics;
    const now = Date.now();

    metrics.api.turns++;

    if (options?.inputTokens !== undefined) {
      metrics.api.inputTokens = (metrics.api.inputTokens || 0) + options.inputTokens;
    }

    if (options?.outputTokens !== undefined) {
      metrics.api.outputTokens = (metrics.api.outputTokens || 0) + options.outputTokens;
    }

    if (options?.thinkingTokens !== undefined) {
      metrics.api.thinkingTokens = (metrics.api.thinkingTokens || 0) + options.thinkingTokens;
    }

    if (options?.duration !== undefined) {
      metrics.api.totalDuration += options.duration;
    }

    if (options?.error) {
      metrics.api.errors++;
    }

    // Update memory snapshot
    this.updateMemorySnapshot(processId);

    metrics.lastUpdatedAt = now;
    metrics.duration = now - metrics.startedAt;

    logger.debug('API turn recorded', {
      processId,
      turns: metrics.api.turns,
    });
  }

  /**
   * Update memory snapshot for an agent process
   * Takes a memory sample and updates peak/delta values
   */
  updateMemorySnapshot(processId: string): void {
    const process = this.processes.get(processId);
    if (!process?.resourceMetrics) {
      return;
    }

    const metrics = process.resourceMetrics;
    const now = Date.now();
    const heapUsed = process.memoryUsage || 0;

    // Update current heap
    metrics.memory.currentHeapUsed = heapUsed;

    // Update peak if higher
    if (heapUsed > metrics.memory.peakHeapUsed) {
      metrics.memory.peakHeapUsed = heapUsed;
    }

    // Calculate delta from start
    metrics.memory.deltaHeapUsed = heapUsed - metrics.memory.startHeapUsed;

    // Add sample (keep max 60 samples = 1 minute at 1 sample/second)
    if (metrics.memory.samples.length >= 60) {
      metrics.memory.samples.shift();
    }
    metrics.memory.samples.push({ timestamp: now, heapUsed });

    metrics.lastUpdatedAt = now;
  }

  /**
   * Mark agent metrics as completed (agent finished running)
   */
  finalizeAgentMetrics(processId: string): void {
    const process = this.processes.get(processId);
    if (!process?.resourceMetrics) {
      return;
    }

    const metrics = process.resourceMetrics;
    const now = Date.now();

    metrics.isRunning = false;
    metrics.lastUpdatedAt = now;
    metrics.duration = now - metrics.startedAt;

    // Final memory snapshot
    this.updateMemorySnapshot(processId);

    logger.debug('Agent metrics finalized', {
      processId,
      duration: metrics.duration,
      toolInvocations: metrics.tools.totalInvocations,
      fileReads: metrics.fileIO.reads,
      fileWrites: metrics.fileIO.writes,
      bashCommands: metrics.bash.commandCount,
      apiTurns: metrics.api.turns,
    });
  }

  /**
   * Get all agent processes with their resource metrics
   */
  getAgentProcessesWithMetrics(): TrackedProcess[] {
    const result: TrackedProcess[] = [];

    for (const process of this.processes.values()) {
      if (process.type === 'agent' && process.resourceMetrics) {
        result.push(process);
      }
    }

    return result.sort((a, b) => b.startedAt - a.startedAt);
  }

  /**
   * Get summary of resource usage across all running agents
   */
  getAgentResourceSummary(): {
    totalAgents: number;
    runningAgents: number;
    totalFileReads: number;
    totalFileWrites: number;
    totalBytesRead: number;
    totalBytesWritten: number;
    totalToolInvocations: number;
    totalBashCommands: number;
    totalAPITurns: number;
    peakMemoryUsage: number;
    totalDuration: number;
  } {
    const summary = {
      totalAgents: 0,
      runningAgents: 0,
      totalFileReads: 0,
      totalFileWrites: 0,
      totalBytesRead: 0,
      totalBytesWritten: 0,
      totalToolInvocations: 0,
      totalBashCommands: 0,
      totalAPITurns: 0,
      peakMemoryUsage: 0,
      totalDuration: 0,
    };

    for (const process of this.processes.values()) {
      if (process.type !== 'agent' || !process.resourceMetrics) {
        continue;
      }

      const metrics = process.resourceMetrics;
      summary.totalAgents++;

      if (metrics.isRunning) {
        summary.runningAgents++;
      }

      summary.totalFileReads += metrics.fileIO.reads;
      summary.totalFileWrites += metrics.fileIO.writes;
      summary.totalBytesRead += metrics.fileIO.bytesRead;
      summary.totalBytesWritten += metrics.fileIO.bytesWritten;
      summary.totalToolInvocations += metrics.tools.totalInvocations;
      summary.totalBashCommands += metrics.bash.commandCount;
      summary.totalAPITurns += metrics.api.turns;
      summary.totalDuration += metrics.duration;

      if (metrics.memory.peakHeapUsed > summary.peakMemoryUsage) {
        summary.peakMemoryUsage = metrics.memory.peakHeapUsed;
      }
    }

    return summary;
  }
}

// Singleton instance
let processRegistryService: ProcessRegistryService | null = null;

/**
 * Get or create the ProcessRegistryService singleton
 */
export function getProcessRegistryService(
  events?: EventEmitter,
  config?: Partial<ProcessRegistryConfig>
): ProcessRegistryService {
  if (!processRegistryService) {
    if (!events) {
      throw new Error('EventEmitter is required to initialize ProcessRegistryService');
    }
    processRegistryService = new ProcessRegistryService(events, config);
  }
  return processRegistryService;
}

/**
 * Reset the singleton (for testing)
 */
export function resetProcessRegistryService(): void {
  if (processRegistryService) {
    processRegistryService.stop();
    processRegistryService = null;
  }
}
