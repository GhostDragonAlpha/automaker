/**
 * Cluster Manager for AutoMaker Server
 *
 * Enables multi-core CPU utilization by spawning worker processes.
 * The master process manages workers and restarts them on crash.
 * Workers share the port via OS-level load balancing.
 *
 * Usage:
 *   import { initCluster } from './cluster-manager.js';
 *   initCluster(() => { startServer(); });
 */

import cluster from 'cluster';
import os from 'os';
import { createLogger } from './utils/logger.js';

const logger = createLogger('Cluster');

// Configuration
const CLUSTER_ENABLED = process.env.CLUSTER_MODE === 'true';
const WORKER_COUNT = parseInt(process.env.WORKER_COUNT || '0', 10) || os.cpus().length;
const RESTART_DELAY_MS = 1000;

// Track worker restarts to prevent rapid restart loops
const workerRestarts = new Map<number, number>();
const MAX_RESTARTS_PER_MINUTE = 5;

/**
 * Initialize cluster mode if enabled.
 * In cluster mode, the master spawns workers that each run the server.
 *
 * @param startWorker - Function to start the server (called in each worker)
 * @returns true if this process should continue (worker or non-cluster), false if master
 */
export function initCluster(startWorker: () => void): boolean {
  // Skip cluster mode if disabled or in development
  if (!CLUSTER_ENABLED) {
    logger.info('Cluster mode disabled, running single-process');
    startWorker();
    return true;
  }

  if (cluster.isPrimary) {
    logger.info(`Master process ${process.pid} starting ${WORKER_COUNT} workers`);

    // Fork workers
    for (let i = 0; i < WORKER_COUNT; i++) {
      forkWorker();
    }

    // Handle worker exit - restart with exponential backoff
    cluster.on('exit', (worker, code, signal) => {
      const workerId = worker.id;
      const exitReason = signal ? `signal ${signal}` : `code ${code}`;

      if (code !== 0) {
        logger.warn(`Worker ${workerId} (PID ${worker.process.pid}) died (${exitReason})`);

        // Check restart rate limiting
        const now = Date.now();
        const lastRestarts = workerRestarts.get(workerId) || 0;

        if (lastRestarts >= MAX_RESTARTS_PER_MINUTE) {
          logger.error(`Worker ${workerId} restarted too many times, not restarting`);
          return;
        }

        workerRestarts.set(workerId, lastRestarts + 1);

        // Clear restart count after 1 minute
        setTimeout(() => {
          workerRestarts.set(workerId, Math.max(0, (workerRestarts.get(workerId) || 0) - 1));
        }, 60000);

        // Restart with delay
        setTimeout(() => {
          logger.info(`Restarting worker ${workerId}...`);
          forkWorker();
        }, RESTART_DELAY_MS);
      } else {
        logger.info(`Worker ${workerId} exited gracefully`);
      }
    });

    // Handle graceful shutdown
    const shutdown = () => {
      logger.info('Master shutting down, terminating workers...');
      for (const id in cluster.workers) {
        cluster.workers[id]?.kill('SIGTERM');
      }
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    return false; // Master doesn't run server code
  } else {
    // Worker process - run the server
    logger.info(`Worker ${cluster.worker?.id} (PID ${process.pid}) started`);
    startWorker();
    return true;
  }
}

/**
 * Fork a new worker process
 */
function forkWorker(): void {
  const worker = cluster.fork();

  // Handle worker messages (for inter-process communication if needed)
  worker.on('message', (msg: { type: string; data?: unknown }) => {
    if (msg.type === 'broadcast') {
      // Broadcast message to all workers
      for (const id in cluster.workers) {
        if (cluster.workers[id] !== worker) {
          cluster.workers[id]?.send(msg);
        }
      }
    }
  });
}

/**
 * Check if this process is the master/primary
 */
export function isMaster(): boolean {
  return cluster.isPrimary;
}

/**
 * Get the current worker ID (0 if not in cluster mode or if master)
 */
export function getWorkerId(): number {
  return cluster.worker?.id || 0;
}

/**
 * Get total worker count
 */
export function getWorkerCount(): number {
  return CLUSTER_ENABLED ? WORKER_COUNT : 1;
}

/**
 * Broadcast a message to all workers (call from any worker)
 */
export function broadcastToWorkers(data: unknown): void {
  if (cluster.isWorker && process.send) {
    process.send({ type: 'broadcast', data });
  }
}
