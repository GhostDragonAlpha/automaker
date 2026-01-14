/**
 * Parallel Feature Executor
 *
 * Enables processing multiple features simultaneously with Z.AI.
 * Uses a semaphore pattern to limit concurrent API calls.
 *
 * Features:
 * - Configurable concurrency limit
 * - Priority queue for urgent features
 * - Rate limiting to avoid API throttling
 * - Progress tracking and cancellation
 */

import { createLogger } from '@automaker/utils';
import { EventEmitter } from 'events';

const logger = createLogger('ParallelExecutor');

// Configuration
const DEFAULT_CONCURRENCY = 3; // Max parallel Z.AI calls
const MIN_DELAY_BETWEEN_CALLS_MS = 100; // Rate limiting

export interface FeatureTask {
  featureId: string;
  projectPath: string;
  model?: string;
  priority?: number;
  onProgress?: (progress: { status: string; percent: number }) => void;
}

export interface ExecutionResult {
  featureId: string;
  success: boolean;
  output?: string;
  error?: string;
  durationMs: number;
}

type FeatureExecutorFn = (task: FeatureTask) => Promise<ExecutionResult>;

class ParallelFeatureExecutor extends EventEmitter {
  private concurrency: number;
  private running: Map<string, { task: FeatureTask; abortController: AbortController }> = new Map();
  private queue: FeatureTask[] = [];
  private executor: FeatureExecutorFn | null = null;
  private lastCallTime = 0;
  private isProcessing = false;

  constructor(concurrency = DEFAULT_CONCURRENCY) {
    super();
    this.concurrency = concurrency;
  }

  /**
   * Set the executor function
   */
  setExecutor(executor: FeatureExecutorFn): void {
    this.executor = executor;
  }

  /**
   * Set concurrency limit
   */
  setConcurrency(concurrency: number): void {
    this.concurrency = Math.max(1, Math.min(10, concurrency));
    logger.info(`Concurrency set to ${this.concurrency}`);
  }

  /**
   * Get current concurrency limit
   */
  getConcurrency(): number {
    return this.concurrency;
  }

  /**
   * Submit a feature for processing
   */
  async submit(task: FeatureTask): Promise<ExecutionResult> {
    return new Promise((resolve, reject) => {
      // Wrap task with promise callbacks
      const wrappedTask = {
        ...task,
        _resolve: resolve,
        _reject: reject,
      } as FeatureTask & { _resolve: (r: ExecutionResult) => void; _reject: (e: Error) => void };

      // Insert by priority
      const insertIndex = this.queue.findIndex((t) => (t.priority || 0) < (task.priority || 0));
      if (insertIndex === -1) {
        this.queue.push(wrappedTask);
      } else {
        this.queue.splice(insertIndex, 0, wrappedTask);
      }

      this.emit('queued', { featureId: task.featureId, queueLength: this.queue.length });
      this.processQueue();
    });
  }

  /**
   * Submit multiple features and wait for all to complete
   */
  async submitBatch(tasks: FeatureTask[]): Promise<ExecutionResult[]> {
    const promises = tasks.map((task) => this.submit(task));
    return Promise.all(promises);
  }

  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0 && this.running.size < this.concurrency) {
      const task = this.queue.shift() as FeatureTask & {
        _resolve: (r: ExecutionResult) => void;
        _reject: (e: Error) => void;
      };

      if (!task) break;

      // Rate limiting
      const now = Date.now();
      const elapsed = now - this.lastCallTime;
      if (elapsed < MIN_DELAY_BETWEEN_CALLS_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_DELAY_BETWEEN_CALLS_MS - elapsed));
      }
      this.lastCallTime = Date.now();

      // Start execution
      const abortController = new AbortController();
      this.running.set(task.featureId, { task, abortController });

      this.emit('started', { featureId: task.featureId, running: this.running.size });

      // Execute in background
      this.executeTask(task, abortController.signal)
        .then((result) => {
          task._resolve(result);
          this.emit('completed', result);
        })
        .catch((error) => {
          const result: ExecutionResult = {
            featureId: task.featureId,
            success: false,
            error: error.message,
            durationMs: 0,
          };
          task._resolve(result); // Still resolve, not reject
          this.emit('failed', result);
        })
        .finally(() => {
          this.running.delete(task.featureId);
          this.processQueue();
        });
    }

    this.isProcessing = false;
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: FeatureTask, _signal: AbortSignal): Promise<ExecutionResult> {
    if (!this.executor) {
      throw new Error('No executor set. Call setExecutor() first.');
    }

    const startTime = Date.now();

    try {
      const result = await this.executor(task);
      return {
        ...result,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        featureId: task.featureId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Cancel a running or queued feature
   */
  cancel(featureId: string): boolean {
    // Check if in queue
    const queueIndex = this.queue.findIndex((t) => t.featureId === featureId);
    if (queueIndex >= 0) {
      const task = this.queue[queueIndex] as FeatureTask & {
        _resolve?: (r: ExecutionResult) => void;
        _reject?: (e: Error) => void;
      };
      this.queue.splice(queueIndex, 1);

      // Settle the promise so callers don't hang
      if (task._resolve) {
        task._resolve({
          featureId,
          success: false,
          error: 'Cancelled before execution',
          durationMs: 0,
        });
      }

      this.emit('cancelled', { featureId, wasRunning: false });
      return true;
    }

    // Check if running
    const runningTask = this.running.get(featureId);
    if (runningTask) {
      runningTask.abortController.abort();
      this.running.delete(featureId);
      this.emit('cancelled', { featureId, wasRunning: true });
      return true;
    }

    return false;
  }

  /**
   * Cancel all running and queued features
   */
  cancelAll(): void {
    // Cancel all queued - settle their promises first
    for (const task of this.queue) {
      const queuedTask = task as FeatureTask & {
        _resolve?: (r: ExecutionResult) => void;
      };
      if (queuedTask._resolve) {
        queuedTask._resolve({
          featureId: task.featureId,
          success: false,
          error: 'Cancelled before execution',
          durationMs: 0,
        });
      }
      this.emit('cancelled', { featureId: task.featureId, wasRunning: false });
    }
    this.queue = [];

    // Cancel all running
    for (const [featureId, { abortController }] of this.running) {
      abortController.abort();
      this.emit('cancelled', { featureId, wasRunning: true });
    }
    this.running.clear();

    this.emit('all-cancelled');
  }

  /**
   * Get status
   */
  getStatus(): { running: number; queued: number; concurrency: number } {
    return {
      running: this.running.size,
      queued: this.queue.length,
      concurrency: this.concurrency,
    };
  }

  /**
   * Get list of feature IDs currently processing
   */
  getRunningFeatures(): string[] {
    return Array.from(this.running.keys());
  }
}

// Singleton instance
let globalExecutor: ParallelFeatureExecutor | null = null;

/**
 * Get the global parallel executor instance
 */
export function getParallelExecutor(): ParallelFeatureExecutor {
  if (!globalExecutor) {
    globalExecutor = new ParallelFeatureExecutor();
    logger.info('Parallel feature executor initialized');
  }
  return globalExecutor;
}

/**
 * Initialize with custom concurrency
 */
export function initializeParallelExecutor(concurrency?: number): ParallelFeatureExecutor {
  if (!globalExecutor) {
    globalExecutor = new ParallelFeatureExecutor(concurrency);
    logger.info(
      `Parallel feature executor initialized with concurrency ${concurrency || DEFAULT_CONCURRENCY}`
    );
  } else if (concurrency) {
    globalExecutor.setConcurrency(concurrency);
  }
  return globalExecutor;
}

export { ParallelFeatureExecutor };
