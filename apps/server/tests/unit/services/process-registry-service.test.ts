import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ProcessRegistryService,
  getProcessRegistryService,
  resetProcessRegistryService,
} from '@/services/process-registry-service.js';
import { createEventEmitter } from '@/lib/events.js';
import type { EventEmitter } from '@/lib/events.js';
import type { TrackedProcess, ProcessType, ProcessStatus } from '@automaker/types';

// Mock the logger to prevent console output during tests
vi.mock('@automaker/utils', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('ProcessRegistryService', () => {
  let service: ProcessRegistryService;
  let events: EventEmitter;

  beforeEach(() => {
    vi.useFakeTimers();
    events = createEventEmitter();
    service = new ProcessRegistryService(events);
    resetProcessRegistryService();
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const config = service.getConfig();
      expect(config.stoppedProcessRetention).toBe(5 * 60 * 1000);
      expect(config.cleanupInterval).toBe(60 * 1000);
      expect(config.maxStoppedProcesses).toBe(100);
    });

    it('should accept custom configuration', () => {
      const customService = new ProcessRegistryService(events, {
        stoppedProcessRetention: 10000,
        maxStoppedProcesses: 50,
      });

      const config = customService.getConfig();
      expect(config.stoppedProcessRetention).toBe(10000);
      expect(config.maxStoppedProcesses).toBe(50);
      expect(config.cleanupInterval).toBe(60 * 1000);

      customService.stop();
    });
  });

  describe('start/stop', () => {
    it('should start the service', () => {
      expect(() => service.start()).not.toThrow();
    });

    it('should stop the service', () => {
      service.start();
      expect(() => service.stop()).not.toThrow();
    });

    it('should not start again if already running', () => {
      service.start();
      // Should log warning but not throw
      expect(() => service.start()).not.toThrow();
    });
  });

  describe('process registration', () => {
    it('should register a new process', () => {
      const process = service.registerProcess({
        id: 'test-1',
        pid: 1234,
        type: 'agent',
        name: 'TestAgent',
      });

      expect(process.id).toBe('test-1');
      expect(process.pid).toBe(1234);
      expect(process.type).toBe('agent');
      expect(process.name).toBe('TestAgent');
      expect(process.status).toBe('starting');
      expect(process.startedAt).toBeDefined();
    });

    it('should register a process with all optional fields', () => {
      const process = service.registerProcess({
        id: 'test-2',
        pid: 5678,
        type: 'terminal',
        name: 'TestTerminal',
        featureId: 'feature-123',
        sessionId: 'session-456',
        command: 'bash',
        cwd: '/home/user',
      });

      expect(process.featureId).toBe('feature-123');
      expect(process.sessionId).toBe('session-456');
      expect(process.command).toBe('bash');
      expect(process.cwd).toBe('/home/user');
    });

    it('should emit debug:process-spawned event on registration', () => {
      const callback = vi.fn();
      events.subscribe(callback);

      service.registerProcess({
        id: 'test-3',
        pid: 111,
        type: 'cli',
        name: 'TestCLI',
      });

      expect(callback).toHaveBeenCalled();
      const [eventType, eventData] = callback.mock.calls[0];
      expect(eventType).toBe('debug:process-spawned');
      expect(eventData.process.id).toBe('test-3');
    });
  });

  describe('process retrieval', () => {
    beforeEach(() => {
      // Register test processes
      service.registerProcess({
        id: 'p1',
        pid: 1,
        type: 'agent',
        name: 'Agent1',
        featureId: 'f1',
        sessionId: 's1',
      });
      service.registerProcess({
        id: 'p2',
        pid: 2,
        type: 'terminal',
        name: 'Terminal1',
        sessionId: 's1',
      });
      service.registerProcess({ id: 'p3', pid: 3, type: 'cli', name: 'CLI1', featureId: 'f2' });
    });

    it('should get a process by ID', () => {
      const process = service.getProcess('p1');
      expect(process).toBeDefined();
      expect(process?.name).toBe('Agent1');
    });

    it('should return undefined for non-existent process', () => {
      const process = service.getProcess('non-existent');
      expect(process).toBeUndefined();
    });

    it('should check if process exists', () => {
      expect(service.hasProcess('p1')).toBe(true);
      expect(service.hasProcess('non-existent')).toBe(false);
    });

    it('should get all processes without filters', () => {
      const processes = service.getProcesses({ includeStopped: true });
      expect(processes.length).toBe(3);
    });

    it('should filter by type', () => {
      const agents = service.getProcesses({ type: 'agent', includeStopped: true });
      expect(agents.length).toBe(1);
      expect(agents[0].type).toBe('agent');
    });

    it('should filter by session ID', () => {
      const sessionProcesses = service.getProcesses({ sessionId: 's1', includeStopped: true });
      expect(sessionProcesses.length).toBe(2);
    });

    it('should filter by feature ID', () => {
      const featureProcesses = service.getProcesses({ featureId: 'f1', includeStopped: true });
      expect(featureProcesses.length).toBe(1);
      expect(featureProcesses[0].id).toBe('p1');
    });

    it('should exclude stopped processes by default', () => {
      service.markStopped('p1');
      const processes = service.getProcesses();
      expect(processes.length).toBe(2);
      expect(processes.find((p) => p.id === 'p1')).toBeUndefined();
    });

    it('should include stopped processes when requested', () => {
      service.markStopped('p1');
      const processes = service.getProcesses({ includeStopped: true });
      expect(processes.length).toBe(3);
    });

    it('should sort processes by start time (most recent first)', () => {
      // Re-register processes with different timestamps
      service.clear();

      // Register p1 at time 0
      service.registerProcess({ id: 'p1', pid: 1, type: 'agent', name: 'Agent1' });

      // Advance time and register p2
      vi.advanceTimersByTime(1000);
      service.registerProcess({ id: 'p2', pid: 2, type: 'terminal', name: 'Terminal1' });

      // Advance time and register p3
      vi.advanceTimersByTime(1000);
      service.registerProcess({ id: 'p3', pid: 3, type: 'cli', name: 'CLI1' });

      const processes = service.getProcesses({ includeStopped: true });
      // p3 was registered last (most recent), so it should be first
      expect(processes[0].id).toBe('p3');
      expect(processes[1].id).toBe('p2');
      expect(processes[2].id).toBe('p1');
    });
  });

  describe('process status updates', () => {
    let process: TrackedProcess;

    beforeEach(() => {
      process = service.registerProcess({
        id: 'test-proc',
        pid: 100,
        type: 'agent',
        name: 'TestProcess',
      });
    });

    it('should update process status', () => {
      const updated = service.updateProcess('test-proc', { status: 'running' });
      expect(updated?.status).toBe('running');
    });

    it('should update memory usage', () => {
      const updated = service.updateProcess('test-proc', { memoryUsage: 1024 * 1024 });
      expect(updated?.memoryUsage).toBe(1024 * 1024);
    });

    it('should update CPU usage', () => {
      const updated = service.updateProcess('test-proc', { cpuUsage: 45.5 });
      expect(updated?.cpuUsage).toBe(45.5);
    });

    it('should return null for non-existent process', () => {
      const updated = service.updateProcess('non-existent', { status: 'running' });
      expect(updated).toBeNull();
    });

    it('should set stoppedAt when status is stopped', () => {
      const updated = service.markStopped('test-proc');
      expect(updated?.stoppedAt).toBeDefined();
    });

    it('should set stoppedAt when status is error', () => {
      const updated = service.markError('test-proc', 'Something went wrong');
      expect(updated?.stoppedAt).toBeDefined();
      expect(updated?.error).toBe('Something went wrong');
    });
  });

  describe('status shortcut methods', () => {
    beforeEach(() => {
      service.registerProcess({
        id: 'test-proc',
        pid: 100,
        type: 'agent',
        name: 'TestProcess',
      });
    });

    it('should mark process as running', () => {
      const updated = service.markRunning('test-proc');
      expect(updated?.status).toBe('running');
    });

    it('should mark process as idle', () => {
      const updated = service.markIdle('test-proc');
      expect(updated?.status).toBe('idle');
    });

    it('should mark process as stopping', () => {
      const updated = service.markStopping('test-proc');
      expect(updated?.status).toBe('stopping');
    });

    it('should mark process as stopped with exit code', () => {
      const updated = service.markStopped('test-proc', 0);
      expect(updated?.status).toBe('stopped');
      expect(updated?.exitCode).toBe(0);
    });

    it('should mark process as error with message', () => {
      const updated = service.markError('test-proc', 'Process crashed');
      expect(updated?.status).toBe('error');
      expect(updated?.error).toBe('Process crashed');
    });
  });

  describe('event emissions', () => {
    let callback: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      callback = vi.fn();
      events.subscribe(callback);
      service.registerProcess({
        id: 'test-proc',
        pid: 100,
        type: 'agent',
        name: 'TestProcess',
      });
      callback.mockClear();
    });

    it('should emit debug:process-stopped when stopped', () => {
      service.markStopped('test-proc', 0);

      expect(callback).toHaveBeenCalled();
      const [eventType] = callback.mock.calls[0];
      expect(eventType).toBe('debug:process-stopped');
    });

    it('should emit debug:process-error when errored', () => {
      service.markError('test-proc', 'Error message');

      expect(callback).toHaveBeenCalled();
      const [eventType, eventData] = callback.mock.calls[0];
      expect(eventType).toBe('debug:process-error');
      expect(eventData.message).toContain('Error message');
    });

    it('should emit debug:process-updated for other status changes', () => {
      service.markRunning('test-proc');

      expect(callback).toHaveBeenCalled();
      const [eventType] = callback.mock.calls[0];
      expect(eventType).toBe('debug:process-updated');
    });
  });

  describe('process unregistration', () => {
    it('should unregister an existing process', () => {
      service.registerProcess({
        id: 'test-proc',
        pid: 100,
        type: 'agent',
        name: 'TestProcess',
      });

      const result = service.unregisterProcess('test-proc');
      expect(result).toBe(true);
      expect(service.getProcess('test-proc')).toBeUndefined();
    });

    it('should return false for non-existent process', () => {
      const result = service.unregisterProcess('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('process summary', () => {
    beforeEach(() => {
      service.registerProcess({ id: 'p1', pid: 1, type: 'agent', name: 'A1' });
      service.registerProcess({ id: 'p2', pid: 2, type: 'agent', name: 'A2' });
      service.registerProcess({ id: 'p3', pid: 3, type: 'terminal', name: 'T1' });
      service.registerProcess({ id: 'p4', pid: 4, type: 'cli', name: 'C1' });
      service.registerProcess({ id: 'p5', pid: 5, type: 'worker', name: 'W1' });

      // Update statuses
      service.markRunning('p1');
      service.markIdle('p2');
      service.markStopped('p3');
      service.markError('p4', 'error');
      service.markRunning('p5');
    });

    it('should calculate correct summary statistics', () => {
      const summary = service.getProcessSummary();

      expect(summary.total).toBe(5);
      expect(summary.running).toBe(2); // p1 running, p5 running
      expect(summary.idle).toBe(1); // p2 idle
      expect(summary.stopped).toBe(1); // p3 stopped
      expect(summary.errored).toBe(1); // p4 error
    });

    it('should count processes by type', () => {
      const summary = service.getProcessSummary();

      expect(summary.byType.agent).toBe(2);
      expect(summary.byType.terminal).toBe(1);
      expect(summary.byType.cli).toBe(1);
      expect(summary.byType.worker).toBe(1);
    });
  });

  describe('active count', () => {
    beforeEach(() => {
      service.registerProcess({ id: 'p1', pid: 1, type: 'agent', name: 'A1' });
      service.registerProcess({ id: 'p2', pid: 2, type: 'agent', name: 'A2' });
      service.registerProcess({ id: 'p3', pid: 3, type: 'terminal', name: 'T1' });

      service.markRunning('p1');
      service.markStopped('p2');
      service.markIdle('p3');
    });

    it('should return count of active processes', () => {
      expect(service.getActiveCount()).toBe(2); // p1 running, p3 idle
    });

    it('should return count by type', () => {
      expect(service.getCountByType('agent')).toBe(2);
      expect(service.getCountByType('terminal')).toBe(1);
      expect(service.getCountByType('cli')).toBe(0);
    });
  });

  describe('process provider', () => {
    it('should return a process provider function', () => {
      service.registerProcess({ id: 'p1', pid: 1, type: 'agent', name: 'A1' });

      const provider = service.getProcessProvider();
      expect(typeof provider).toBe('function');

      const processes = provider();
      expect(processes.length).toBe(1);
      expect(processes[0].id).toBe('p1');
    });

    it('should return all processes including stopped', () => {
      service.registerProcess({ id: 'p1', pid: 1, type: 'agent', name: 'A1' });
      service.registerProcess({ id: 'p2', pid: 2, type: 'agent', name: 'A2' });
      service.markStopped('p2');

      const provider = service.getProcessProvider();
      const processes = provider();

      expect(processes.length).toBe(2);
    });
  });

  describe('cleanup', () => {
    it('should clean up old stopped processes', () => {
      // Register and stop a process
      service.registerProcess({ id: 'p1', pid: 1, type: 'agent', name: 'A1' });
      service.markStopped('p1');

      // Start service to enable cleanup
      service.start();

      // Advance time past retention period
      vi.advanceTimersByTime(6 * 60 * 1000); // 6 minutes (past default 5 min retention)

      // Process should be cleaned up
      expect(service.getProcess('p1')).toBeUndefined();
    });

    it('should enforce max stopped processes limit', () => {
      const customService = new ProcessRegistryService(events, {
        maxStoppedProcesses: 3,
        cleanupInterval: 1000,
      });

      // Register and stop more processes than max
      for (let i = 0; i < 5; i++) {
        customService.registerProcess({ id: `p${i}`, pid: i, type: 'agent', name: `A${i}` });
        customService.markStopped(`p${i}`);
      }

      customService.start();

      // Trigger cleanup
      vi.advanceTimersByTime(1000);

      // Should only have max stopped processes
      const allProcesses = customService.getAllProcesses();
      expect(allProcesses.length).toBeLessThanOrEqual(3);

      customService.stop();
    });
  });

  describe('configuration update', () => {
    it('should update configuration', () => {
      service.updateConfig({ maxStoppedProcesses: 200 });
      expect(service.getConfig().maxStoppedProcesses).toBe(200);
    });
  });

  describe('clear', () => {
    it('should clear all tracked processes', () => {
      service.registerProcess({ id: 'p1', pid: 1, type: 'agent', name: 'A1' });
      service.registerProcess({ id: 'p2', pid: 2, type: 'terminal', name: 'T1' });

      service.clear();

      expect(service.getAllProcesses().length).toBe(0);
    });
  });

  describe('singleton pattern', () => {
    beforeEach(() => {
      resetProcessRegistryService();
    });

    afterEach(() => {
      resetProcessRegistryService();
    });

    it('should create singleton instance', () => {
      const instance1 = getProcessRegistryService(events);
      const instance2 = getProcessRegistryService();

      expect(instance1).toBe(instance2);
    });

    it('should throw if no events provided on first call', () => {
      expect(() => getProcessRegistryService()).toThrow();
    });

    it('should reset singleton', () => {
      const instance1 = getProcessRegistryService(events);
      resetProcessRegistryService();
      const instance2 = getProcessRegistryService(events);

      expect(instance1).not.toBe(instance2);
    });
  });
});
