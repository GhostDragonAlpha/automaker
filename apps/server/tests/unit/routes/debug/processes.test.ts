import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import {
  createGetProcessesHandler,
  createGetProcessHandler,
  createGetSummaryHandler,
} from '@/routes/debug/routes/processes.js';
import type { ProcessRegistryService } from '@/services/process-registry-service.js';
import type { TrackedProcess, ProcessSummary } from '@automaker/types';

describe('Debug Processes Routes', () => {
  let mockProcessRegistry: Partial<ProcessRegistryService>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonFn: ReturnType<typeof vi.fn>;
  let statusFn: ReturnType<typeof vi.fn>;

  const mockProcesses: TrackedProcess[] = [
    {
      id: 'process-1',
      pid: 1234,
      type: 'agent',
      name: 'Agent 1',
      status: 'running',
      startedAt: Date.now() - 60000,
      featureId: 'feature-1',
      sessionId: 'session-1',
    },
    {
      id: 'process-2',
      pid: 5678,
      type: 'terminal',
      name: 'Terminal 1',
      status: 'idle',
      startedAt: Date.now() - 30000,
      sessionId: 'session-1',
    },
    {
      id: 'process-3',
      pid: 9012,
      type: 'cli',
      name: 'CLI 1',
      status: 'stopped',
      startedAt: Date.now() - 120000,
      stoppedAt: Date.now() - 60000,
      exitCode: 0,
    },
  ];

  const mockSummary: ProcessSummary = {
    total: 3,
    running: 1,
    idle: 1,
    stopped: 1,
    errored: 0,
    byType: {
      agent: 1,
      cli: 1,
      terminal: 1,
      worker: 0,
    },
  };

  beforeEach(() => {
    jsonFn = vi.fn();
    statusFn = vi.fn(() => ({ json: jsonFn }));

    mockProcessRegistry = {
      getProcesses: vi.fn(() => mockProcesses),
      getProcess: vi.fn((id: string) => mockProcesses.find((p) => p.id === id)),
      getProcessSummary: vi.fn(() => mockSummary),
    };

    mockReq = {
      body: {},
      query: {},
      params: {},
    };

    mockRes = {
      json: jsonFn,
      status: statusFn,
    };
  });

  describe('GET /api/debug/processes', () => {
    it('should return list of processes with summary', () => {
      const handler = createGetProcessesHandler(mockProcessRegistry as ProcessRegistryService);
      handler(mockReq as Request, mockRes as Response);

      expect(mockProcessRegistry.getProcesses).toHaveBeenCalled();
      expect(mockProcessRegistry.getProcessSummary).toHaveBeenCalled();
      expect(jsonFn).toHaveBeenCalledWith({
        processes: mockProcesses,
        summary: mockSummary,
      });
    });

    it('should pass type filter to service', () => {
      mockReq.query = { type: 'agent' };

      const handler = createGetProcessesHandler(mockProcessRegistry as ProcessRegistryService);
      handler(mockReq as Request, mockRes as Response);

      expect(mockProcessRegistry.getProcesses).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'agent',
        })
      );
    });

    it('should pass status filter to service', () => {
      mockReq.query = { status: 'running' };

      const handler = createGetProcessesHandler(mockProcessRegistry as ProcessRegistryService);
      handler(mockReq as Request, mockRes as Response);

      expect(mockProcessRegistry.getProcesses).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'running',
        })
      );
    });

    it('should pass includeStopped flag when set to "true"', () => {
      mockReq.query = { includeStopped: 'true' };

      const handler = createGetProcessesHandler(mockProcessRegistry as ProcessRegistryService);
      handler(mockReq as Request, mockRes as Response);

      expect(mockProcessRegistry.getProcesses).toHaveBeenCalledWith(
        expect.objectContaining({
          includeStopped: true,
        })
      );
    });

    it('should not pass includeStopped when not "true"', () => {
      mockReq.query = { includeStopped: 'false' };

      const handler = createGetProcessesHandler(mockProcessRegistry as ProcessRegistryService);
      handler(mockReq as Request, mockRes as Response);

      expect(mockProcessRegistry.getProcesses).toHaveBeenCalledWith(
        expect.objectContaining({
          includeStopped: undefined,
        })
      );
    });

    it('should pass sessionId filter to service', () => {
      mockReq.query = { sessionId: 'session-1' };

      const handler = createGetProcessesHandler(mockProcessRegistry as ProcessRegistryService);
      handler(mockReq as Request, mockRes as Response);

      expect(mockProcessRegistry.getProcesses).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-1',
        })
      );
    });

    it('should pass featureId filter to service', () => {
      mockReq.query = { featureId: 'feature-1' };

      const handler = createGetProcessesHandler(mockProcessRegistry as ProcessRegistryService);
      handler(mockReq as Request, mockRes as Response);

      expect(mockProcessRegistry.getProcesses).toHaveBeenCalledWith(
        expect.objectContaining({
          featureId: 'feature-1',
        })
      );
    });

    it('should handle multiple filters', () => {
      mockReq.query = {
        type: 'agent',
        status: 'running',
        sessionId: 'session-1',
        includeStopped: 'true',
      };

      const handler = createGetProcessesHandler(mockProcessRegistry as ProcessRegistryService);
      handler(mockReq as Request, mockRes as Response);

      expect(mockProcessRegistry.getProcesses).toHaveBeenCalledWith({
        type: 'agent',
        status: 'running',
        sessionId: 'session-1',
        includeStopped: true,
        featureId: undefined,
      });
    });
  });

  describe('GET /api/debug/processes/:id', () => {
    it('should return a specific process by ID', () => {
      mockReq.params = { id: 'process-1' };

      const handler = createGetProcessHandler(mockProcessRegistry as ProcessRegistryService);
      handler(mockReq as Request, mockRes as Response);

      expect(mockProcessRegistry.getProcess).toHaveBeenCalledWith('process-1');
      expect(jsonFn).toHaveBeenCalledWith(mockProcesses[0]);
    });

    it('should return 404 for non-existent process', () => {
      mockReq.params = { id: 'non-existent' };
      (mockProcessRegistry.getProcess as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

      const handler = createGetProcessHandler(mockProcessRegistry as ProcessRegistryService);
      handler(mockReq as Request, mockRes as Response);

      expect(statusFn).toHaveBeenCalledWith(404);
      expect(jsonFn).toHaveBeenCalledWith({
        error: 'Process not found',
        id: 'non-existent',
      });
    });

    it('should return 400 for empty process ID', () => {
      mockReq.params = { id: '' };

      const handler = createGetProcessHandler(mockProcessRegistry as ProcessRegistryService);
      handler(mockReq as Request, mockRes as Response);

      expect(statusFn).toHaveBeenCalledWith(400);
      expect(jsonFn).toHaveBeenCalledWith({
        error: 'Invalid process ID format',
      });
    });

    it('should return 400 for process ID exceeding max length', () => {
      mockReq.params = { id: 'a'.repeat(257) };

      const handler = createGetProcessHandler(mockProcessRegistry as ProcessRegistryService);
      handler(mockReq as Request, mockRes as Response);

      expect(statusFn).toHaveBeenCalledWith(400);
      expect(jsonFn).toHaveBeenCalledWith({
        error: 'Invalid process ID format',
      });
    });

    it('should accept process ID at max length', () => {
      mockReq.params = { id: 'a'.repeat(256) };
      (mockProcessRegistry.getProcess as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

      const handler = createGetProcessHandler(mockProcessRegistry as ProcessRegistryService);
      handler(mockReq as Request, mockRes as Response);

      // Should pass validation but process not found
      expect(statusFn).toHaveBeenCalledWith(404);
    });
  });

  describe('GET /api/debug/processes/summary', () => {
    it('should return process summary', () => {
      const handler = createGetSummaryHandler(mockProcessRegistry as ProcessRegistryService);
      handler(mockReq as Request, mockRes as Response);

      expect(mockProcessRegistry.getProcessSummary).toHaveBeenCalled();
      expect(jsonFn).toHaveBeenCalledWith(mockSummary);
    });

    it('should return correct counts', () => {
      const customSummary: ProcessSummary = {
        total: 10,
        running: 5,
        idle: 2,
        stopped: 2,
        errored: 1,
        byType: {
          agent: 4,
          cli: 3,
          terminal: 2,
          worker: 1,
        },
      };

      (mockProcessRegistry.getProcessSummary as ReturnType<typeof vi.fn>).mockReturnValue(
        customSummary
      );

      const handler = createGetSummaryHandler(mockProcessRegistry as ProcessRegistryService);
      handler(mockReq as Request, mockRes as Response);

      expect(jsonFn).toHaveBeenCalledWith(customSummary);
    });
  });
});
