/**
 * Thread Pool Manager
 *
 * Manages a pool of worker threads for CPU-intensive operations.
 * Uses Node.js worker_threads for true parallel execution.
 *
 * Features:
 * - Dynamic pool sizing based on CPU cores
 * - Task queue with priority support
 * - Automatic worker recycling after N tasks
 * - Graceful shutdown
 */

import { Worker } from 'worker_threads';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ThreadPool');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const DEFAULT_POOL_SIZE = Math.max(2, os.cpus().length - 2); // Leave 2 cores for main thread and I/O
const MAX_TASKS_PER_WORKER = 100; // Recycle workers after this many tasks
const TASK_TIMEOUT_MS = 60000; // 1 minute timeout

export interface ThreadTask<T = unknown, R = unknown> {
  type: string;
  data: T;
  priority?: number; // Higher = more urgent
  timeout?: number;
  resolve: (result: R) => void;
  reject: (error: Error) => void;
}

interface WorkerState {
  worker: Worker;
  busy: boolean;
  taskCount: number;
  currentTask?: ThreadTask;
}

class ThreadPool {
  private workers: WorkerState[] = [];
  private taskQueue: ThreadTask[] = [];
  private poolSize: number;
  private workerScript: string;
  private isShuttingDown = false;

  constructor(workerScript: string, poolSize = DEFAULT_POOL_SIZE) {
    this.workerScript = workerScript;
    this.poolSize = poolSize;
  }

  /**
   * Initialize the thread pool
   */
  async initialize(): Promise<void> {
    logger.info(`Initializing thread pool with ${this.poolSize} workers`);

    for (let i = 0; i < this.poolSize; i++) {
      await this.spawnWorker();
    }

    logger.info(`Thread pool ready: ${this.workers.length} workers`);
  }

  /**
   * Spawn a new worker
   */
  private async spawnWorker(): Promise<WorkerState> {
    const worker = new Worker(this.workerScript, {
      workerData: { workerId: this.workers.length },
    });

    const state: WorkerState = {
      worker,
      busy: false,
      taskCount: 0,
    };

    worker.on('message', (result) => {
      this.handleWorkerResult(state, result);
    });

    worker.on('error', (error) => {
      logger.error(`Worker error: ${error.message}`);
      if (state.currentTask) {
        state.currentTask.reject(error);
      }
      this.recycleWorker(state);
    });

    worker.on('exit', (code) => {
      if (!this.isShuttingDown && code !== 0) {
        logger.warn(`Worker exited with code ${code}, spawning replacement`);
        this.removeWorker(state);
        this.spawnWorker();
      }
    });

    this.workers.push(state);
    return state;
  }

  /**
   * Handle result from worker
   */
  private handleWorkerResult(
    state: WorkerState,
    result: { success: boolean; data?: unknown; error?: string }
  ): void {
    const task = state.currentTask;
    if (!task) return;

    state.busy = false;
    state.currentTask = undefined;
    state.taskCount++;

    if (result.success) {
      task.resolve(result.data);
    } else {
      task.reject(new Error(result.error || 'Unknown worker error'));
    }

    // Recycle worker if it's done too many tasks
    if (state.taskCount >= MAX_TASKS_PER_WORKER) {
      this.recycleWorker(state);
    }

    // Process next task in queue
    this.processQueue();
  }

  /**
   * Recycle a worker (terminate and spawn new one)
   */
  private async recycleWorker(state: WorkerState): Promise<void> {
    this.removeWorker(state);
    await state.worker.terminate();

    if (!this.isShuttingDown) {
      await this.spawnWorker();
    }
  }

  /**
   * Remove worker from pool
   */
  private removeWorker(state: WorkerState): void {
    const index = this.workers.indexOf(state);
    if (index >= 0) {
      this.workers.splice(index, 1);
    }
  }

  /**
   * Submit a task to the thread pool
   */
  submit<T, R>(
    type: string,
    data: T,
    options: { priority?: number; timeout?: number } = {}
  ): Promise<R> {
    return new Promise((resolve, reject) => {
      if (this.isShuttingDown) {
        reject(new Error('Thread pool is shutting down'));
        return;
      }

      const task: ThreadTask<T, R> = {
        type,
        data,
        priority: options.priority || 0,
        timeout: options.timeout || TASK_TIMEOUT_MS,
        resolve: resolve as (result: unknown) => void,
        reject,
      };

      // Insert by priority (higher priority first)
      const insertIndex = this.taskQueue.findIndex((t) => (t.priority || 0) < task.priority!);
      if (insertIndex === -1) {
        this.taskQueue.push(task);
      } else {
        this.taskQueue.splice(insertIndex, 0, task);
      }

      this.processQueue();
    });
  }

  /**
   * Process the task queue
   */
  private processQueue(): void {
    if (this.taskQueue.length === 0) return;

    // Find an idle worker
    const idleWorker = this.workers.find((w) => !w.busy);
    if (!idleWorker) return;

    const task = this.taskQueue.shift();
    if (!task) return;

    idleWorker.busy = true;
    idleWorker.currentTask = task;

    // Set timeout
    const timeoutId = setTimeout(() => {
      if (idleWorker.currentTask === task) {
        task.reject(new Error(`Task timed out after ${task.timeout}ms`));
        this.recycleWorker(idleWorker);
      }
    }, task.timeout);

    // Clear timeout on completion
    const originalResolve = task.resolve;
    const originalReject = task.reject;
    task.resolve = (result) => {
      clearTimeout(timeoutId);
      originalResolve(result);
    };
    task.reject = (error) => {
      clearTimeout(timeoutId);
      originalReject(error);
    };

    // Send task to worker
    idleWorker.worker.postMessage({
      type: task.type,
      data: task.data,
    });
  }

  /**
   * Get pool statistics
   */
  getStats(): { total: number; busy: number; queued: number } {
    return {
      total: this.workers.length,
      busy: this.workers.filter((w) => w.busy).length,
      queued: this.taskQueue.length,
    };
  }

  /**
   * Shutdown the thread pool gracefully
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down thread pool...');
    this.isShuttingDown = true;

    // Reject all queued tasks
    for (const task of this.taskQueue) {
      task.reject(new Error('Thread pool shutting down'));
    }
    this.taskQueue = [];

    // Terminate all workers
    await Promise.all(this.workers.map((w) => w.worker.terminate()));
    this.workers = [];

    logger.info('Thread pool shutdown complete');
  }
}

// Singleton instance
let globalPool: ThreadPool | null = null;

/**
 * Get the global thread pool instance
 */
export function getThreadPool(): ThreadPool {
  if (!globalPool) {
    throw new Error('Thread pool not initialized. Call initializeThreadPool() first.');
  }
  return globalPool;
}

/**
 * Initialize the global thread pool
 */
export async function initializeThreadPool(poolSize?: number): Promise<ThreadPool> {
  if (globalPool) {
    return globalPool;
  }

  const workerScript = path.join(__dirname, 'generic-worker.js');
  globalPool = new ThreadPool(workerScript, poolSize);
  await globalPool.initialize();

  // Shutdown on process exit
  process.on('beforeExit', async () => {
    if (globalPool) {
      await globalPool.shutdown();
    }
  });

  return globalPool;
}

export { ThreadPool };
