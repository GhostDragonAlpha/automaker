/**
 * Debug processes route handler
 *
 * GET /api/debug/processes - Get list of tracked processes
 * GET /api/debug/processes/:id - Get specific process by ID
 * POST /api/debug/processes/:id/terminate - Terminate a process
 */

import type { Request, Response } from 'express';
import type { ProcessRegistryService } from '../../../services/process-registry-service.js';
import type {
  GetProcessesRequest,
  GetProcessesResponse,
  ProcessType,
  ProcessStatus,
} from '@automaker/types';

/**
 * Create handler for GET /api/debug/processes
 * Returns list of tracked processes with optional filtering
 */
export function createGetProcessesHandler(processRegistry: ProcessRegistryService) {
  return (req: Request, res: Response) => {
    const query = req.query as {
      type?: string;
      status?: string;
      includeStopped?: string;
      sessionId?: string;
      featureId?: string;
    };

    // Build query options
    const options: GetProcessesRequest = {};

    if (query.type) {
      options.type = query.type as ProcessType;
    }

    if (query.status) {
      options.status = query.status as ProcessStatus;
    }

    if (query.includeStopped === 'true') {
      options.includeStoppedProcesses = true;
    }

    const processes = processRegistry.getProcesses({
      type: options.type,
      status: options.status,
      includeStopped: options.includeStoppedProcesses,
      sessionId: query.sessionId,
      featureId: query.featureId,
    });

    const summary = processRegistry.getProcessSummary();

    const response: GetProcessesResponse = {
      processes,
      summary,
    };

    res.json(response);
  };
}

/**
 * Validate process ID format
 * Process IDs should be non-empty strings with reasonable length
 */
function isValidProcessId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= 256;
}

/**
 * Create handler for GET /api/debug/processes/:id
 * Returns a specific process by ID
 */
export function createGetProcessHandler(processRegistry: ProcessRegistryService) {
  return (req: Request, res: Response) => {
    const { id } = req.params;

    // Validate process ID format
    if (!isValidProcessId(id)) {
      res.status(400).json({
        error: 'Invalid process ID format',
      });
      return;
    }

    const process = processRegistry.getProcess(id);

    if (!process) {
      res.status(404).json({
        error: 'Process not found',
        id,
      });
      return;
    }

    res.json(process);
  };
}

/**
 * Create handler for GET /api/debug/processes/summary
 * Returns summary statistics
 */
export function createGetSummaryHandler(processRegistry: ProcessRegistryService) {
  return (_req: Request, res: Response) => {
    const summary = processRegistry.getProcessSummary();
    res.json(summary);
  };
}

/**
 * Create handler for GET /api/debug/agents
 * Returns all agent processes with their resource metrics
 */
export function createGetAgentsHandler(processRegistry: ProcessRegistryService) {
  return (_req: Request, res: Response) => {
    const agents = processRegistry.getAgentProcessesWithMetrics();
    const summary = processRegistry.getAgentResourceSummary();

    res.json({
      agents,
      summary,
    });
  };
}

/**
 * Create handler for GET /api/debug/agents/:id/metrics
 * Returns detailed resource metrics for a specific agent
 */
export function createGetAgentMetricsHandler(processRegistry: ProcessRegistryService) {
  return (req: Request, res: Response) => {
    const { id } = req.params;

    // Validate process ID format
    if (!isValidProcessId(id)) {
      res.status(400).json({
        error: 'Invalid agent ID format',
      });
      return;
    }

    const metrics = processRegistry.getAgentMetrics(id);

    if (!metrics) {
      res.status(404).json({
        error: 'Agent metrics not found',
        id,
      });
      return;
    }

    res.json(metrics);
  };
}

/**
 * Create handler for GET /api/debug/agents/summary
 * Returns summary of resource usage across all agents
 */
export function createGetAgentSummaryHandler(processRegistry: ProcessRegistryService) {
  return (_req: Request, res: Response) => {
    const summary = processRegistry.getAgentResourceSummary();
    res.json(summary);
  };
}
