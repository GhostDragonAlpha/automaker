/**
 * Debug routes - HTTP API for debug panel and performance monitoring
 *
 * These routes are only enabled in development mode.
 */

import { Router } from 'express';
import type { EventEmitter } from '../../lib/events.js';
import { PerformanceMonitorService } from '../../services/performance-monitor-service.js';
import { ProcessRegistryService } from '../../services/process-registry-service.js';
import {
  createGetMetricsHandler,
  createStartMetricsHandler,
  createStopMetricsHandler,
  createForceGCHandler,
  createClearHistoryHandler,
} from './routes/metrics.js';
import {
  createGetProcessesHandler,
  createGetProcessHandler,
  createGetSummaryHandler,
  createGetAgentsHandler,
  createGetAgentMetricsHandler,
  createGetAgentSummaryHandler,
} from './routes/processes.js';

export interface DebugServices {
  performanceMonitor: PerformanceMonitorService;
  processRegistry: ProcessRegistryService;
}

/**
 * Create and initialize debug services
 */
export function createDebugServices(events: EventEmitter): DebugServices {
  // Create services
  const processRegistry = new ProcessRegistryService(events);
  const performanceMonitor = new PerformanceMonitorService(events);

  // Wire them together - performance monitor gets processes from registry
  performanceMonitor.setProcessProvider(processRegistry.getProcessProvider());

  // Subscribe to AutoMode events to track feature execution as processes
  // Events are wrapped in 'auto-mode:event' with the actual type in data.type
  events.subscribe((eventType, data) => {
    // Handle auto-mode:event
    if (eventType === 'auto-mode:event') {
      handleAutoModeEvent(processRegistry, data);
      return;
    }

    // Handle agent:stream events for chat sessions
    if (eventType === 'agent:stream') {
      handleAgentStreamEvent(processRegistry, data);
      return;
    }
  });

  /**
   * Handle AutoMode events for feature execution tracking
   */
  function handleAutoModeEvent(registry: ProcessRegistryService, data: unknown): void {
    const eventData = data as { type?: string; [key: string]: unknown };
    const innerType = eventData.type;

    if (innerType === 'auto_mode_feature_start') {
      const { featureId, projectPath, feature, model } = eventData as {
        featureId: string;
        projectPath: string;
        feature?: { id: string; title: string; description?: string };
        model?: string;
      };

      // Register the feature as a tracked process
      // Use -1 for pid since this isn't a real OS process
      registry.registerProcess({
        id: `agent-${featureId}`,
        pid: -1,
        type: 'agent',
        name: feature?.title || `Feature ${featureId}`,
        featureId,
        cwd: projectPath,
        command: model ? `claude ${model}` : 'claude agent',
      });

      // Initialize resource metrics
      registry.initializeAgentMetrics(`agent-${featureId}`, { featureId });

      // Mark it as running
      registry.markRunning(`agent-${featureId}`);
    } else if (innerType === 'auto_mode_feature_complete') {
      const { featureId, passes, message } = eventData as {
        featureId: string;
        passes: boolean;
        message?: string;
      };

      const processId = `agent-${featureId}`;
      if (registry.hasProcess(processId)) {
        // Finalize the metrics before marking as stopped
        registry.finalizeAgentMetrics(processId);

        if (passes) {
          registry.markStopped(processId, 0);
        } else {
          registry.markError(processId, message || 'Feature failed');
        }
      }
    } else if (innerType === 'auto_mode_error') {
      const { featureId, error } = eventData as {
        featureId?: string;
        error: string;
      };

      if (featureId) {
        const processId = `agent-${featureId}`;
        if (registry.hasProcess(processId)) {
          registry.finalizeAgentMetrics(processId);
          registry.markError(processId, error);
        }
      }
    } else if (innerType === 'auto_mode_tool_use') {
      // Track tool usage for the feature
      const { featureId, tool } = eventData as {
        featureId: string;
        tool: { name: string; input?: unknown };
      };

      const processId = `agent-${featureId}`;
      if (registry.hasProcess(processId)) {
        registry.recordToolUse(processId, { toolName: tool.name });

        // Record file operations based on tool type
        if (tool.name === 'Read' && tool.input) {
          const input = tool.input as { file_path?: string };
          if (input.file_path) {
            registry.recordFileOperation(processId, {
              operation: 'read',
              filePath: input.file_path,
            });
          }
        } else if (tool.name === 'Write' && tool.input) {
          const input = tool.input as { file_path?: string; content?: string };
          if (input.file_path) {
            registry.recordFileOperation(processId, {
              operation: 'write',
              filePath: input.file_path,
              bytes: input.content?.length,
            });
          }
        } else if (tool.name === 'Edit' && tool.input) {
          const input = tool.input as { file_path?: string; new_string?: string };
          if (input.file_path) {
            registry.recordFileOperation(processId, {
              operation: 'edit',
              filePath: input.file_path,
              bytes: input.new_string?.length,
            });
          }
        } else if (tool.name === 'Glob') {
          const input = tool.input as { path?: string };
          registry.recordFileOperation(processId, {
            operation: 'glob',
            filePath: input?.path || '.',
          });
        } else if (tool.name === 'Grep') {
          const input = tool.input as { path?: string };
          registry.recordFileOperation(processId, {
            operation: 'grep',
            filePath: input?.path || '.',
          });
        } else if (tool.name === 'Bash' && tool.input) {
          const input = tool.input as { command?: string };
          if (input.command) {
            registry.recordBashCommand(processId, {
              command: input.command,
              executionTime: 0, // Will be updated on completion
              exitCode: null,
            });
          }
        }
      }
    }
  }

  /**
   * Handle agent:stream events for chat session tracking
   */
  function handleAgentStreamEvent(registry: ProcessRegistryService, data: unknown): void {
    const eventData = data as {
      sessionId?: string;
      type?: string;
      tool?: { name: string; input?: unknown };
      [key: string]: unknown;
    };

    const { sessionId, type } = eventData;
    if (!sessionId) return;

    const processId = `chat-${sessionId}`;

    // Register chat session as a process if not already tracked
    if (!registry.hasProcess(processId) && type !== 'complete' && type !== 'error') {
      registry.registerProcess({
        id: processId,
        pid: -1,
        type: 'agent',
        name: `Chat Session`,
        sessionId,
        command: 'claude chat',
      });
      registry.initializeAgentMetrics(processId, { sessionId });
      registry.markRunning(processId);
    }

    // Handle different event types
    if (type === 'tool_use' && eventData.tool) {
      const tool = eventData.tool;
      registry.recordToolUse(processId, { toolName: tool.name });

      // Record file operations based on tool type
      if (tool.name === 'Read' && tool.input) {
        const input = tool.input as { file_path?: string };
        if (input.file_path) {
          registry.recordFileOperation(processId, {
            operation: 'read',
            filePath: input.file_path,
          });
        }
      } else if (tool.name === 'Write' && tool.input) {
        const input = tool.input as { file_path?: string; content?: string };
        if (input.file_path) {
          registry.recordFileOperation(processId, {
            operation: 'write',
            filePath: input.file_path,
            bytes: input.content?.length,
          });
        }
      } else if (tool.name === 'Edit' && tool.input) {
        const input = tool.input as { file_path?: string; new_string?: string };
        if (input.file_path) {
          registry.recordFileOperation(processId, {
            operation: 'edit',
            filePath: input.file_path,
            bytes: input.new_string?.length,
          });
        }
      } else if (tool.name === 'Glob') {
        const input = tool.input as { path?: string };
        registry.recordFileOperation(processId, {
          operation: 'glob',
          filePath: input?.path || '.',
        });
      } else if (tool.name === 'Grep') {
        const input = tool.input as { path?: string };
        registry.recordFileOperation(processId, {
          operation: 'grep',
          filePath: input?.path || '.',
        });
      } else if (tool.name === 'Bash' && tool.input) {
        const input = tool.input as { command?: string };
        if (input.command) {
          registry.recordBashCommand(processId, {
            command: input.command,
            executionTime: 0,
            exitCode: null,
          });
        }
      }
    } else if (type === 'complete') {
      if (registry.hasProcess(processId)) {
        registry.finalizeAgentMetrics(processId);
        // Keep the session as "idle" rather than "stopped" since it can receive more messages
        registry.markIdle(processId);
      }
    } else if (type === 'error') {
      if (registry.hasProcess(processId)) {
        registry.finalizeAgentMetrics(processId);
        const errorMsg = (eventData.error as string) || 'Unknown error';
        registry.markError(processId, errorMsg);
      }
    }
  }

  // Start services
  processRegistry.start();
  performanceMonitor.start();

  return {
    performanceMonitor,
    processRegistry,
  };
}

/**
 * Stop debug services
 */
export function stopDebugServices(services: DebugServices): void {
  services.performanceMonitor.stop();
  services.processRegistry.stop();
}

/**
 * Create debug routes
 */
export function createDebugRoutes(services: DebugServices): Router {
  const router = Router();
  const { performanceMonitor, processRegistry } = services;

  // Metrics routes
  router.get('/metrics', createGetMetricsHandler(performanceMonitor));
  router.post('/metrics/start', createStartMetricsHandler(performanceMonitor));
  router.post('/metrics/stop', createStopMetricsHandler(performanceMonitor));
  router.post('/metrics/gc', createForceGCHandler(performanceMonitor));
  router.post('/metrics/clear', createClearHistoryHandler(performanceMonitor));

  // Process routes
  router.get('/processes', createGetProcessesHandler(processRegistry));
  router.get('/processes/summary', createGetSummaryHandler(processRegistry));
  router.get('/processes/:id', createGetProcessHandler(processRegistry));

  // Agent resource metrics routes
  router.get('/agents', createGetAgentsHandler(processRegistry));
  router.get('/agents/summary', createGetAgentSummaryHandler(processRegistry));
  router.get('/agents/:id/metrics', createGetAgentMetricsHandler(processRegistry));

  return router;
}

// Re-export services for use elsewhere
export { PerformanceMonitorService } from '../../services/performance-monitor-service.js';
export { ProcessRegistryService } from '../../services/process-registry-service.js';
