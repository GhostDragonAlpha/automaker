# Debug API Documentation

The Debug API provides endpoints for monitoring server performance, memory usage, CPU metrics, and process tracking. These endpoints are only available in development mode or when `ENABLE_DEBUG_PANEL=true`.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Metrics Endpoints](#metrics-endpoints)
  - [GET /api/debug/metrics](#get-apidebugmetrics)
  - [POST /api/debug/metrics/start](#post-apidebugmetricsstart)
  - [POST /api/debug/metrics/stop](#post-apidebugmetricsstop)
  - [POST /api/debug/metrics/gc](#post-apidebugmetricsgc)
  - [POST /api/debug/metrics/clear](#post-apidebugmetricsclear)
- [Process Endpoints](#process-endpoints)
  - [GET /api/debug/processes](#get-apidebugprocesses)
  - [GET /api/debug/processes/summary](#get-apidebugprocessessummary)
  - [GET /api/debug/processes/:id](#get-apidebugprocessesid)
- [Agent Resource Metrics Endpoints](#agent-resource-metrics-endpoints)
  - [GET /api/debug/agents](#get-apidebugagents)
  - [GET /api/debug/agents/summary](#get-apidebugagentssummary)
  - [GET /api/debug/agents/:id/metrics](#get-apidebugagentsidmetrics)
- [Types](#types)
- [Events](#events)

---

## Overview

The Debug API is designed for development and debugging purposes. It provides:

- **Memory Monitoring**: Track heap usage, RSS, and detect memory leaks
- **CPU Monitoring**: Track CPU usage percentage and event loop lag
- **Process Tracking**: Monitor agents, terminals, CLIs, and worker processes
- **Trend Analysis**: Detect memory leaks using linear regression

### Enabling the Debug API

The Debug API is enabled when:

- `NODE_ENV !== 'production'` (development mode), OR
- `ENABLE_DEBUG_PANEL=true` environment variable is set

---

## Authentication

All debug endpoints require authentication. Requests must include a valid session token or use the standard Automaker authentication mechanism.

---

## Metrics Endpoints

### GET /api/debug/metrics

Returns the current metrics snapshot including memory, CPU, and process information.

**Response**

```json
{
  "active": true,
  "config": {
    "memoryEnabled": true,
    "cpuEnabled": true,
    "processTrackingEnabled": true,
    "collectionInterval": 1000,
    "maxDataPoints": 60,
    "leakThreshold": 1048576
  },
  "snapshot": {
    "timestamp": 1704067200000,
    "memory": {
      "timestamp": 1704067200000,
      "server": {
        "heapTotal": 104857600,
        "heapUsed": 52428800,
        "external": 5242880,
        "rss": 157286400,
        "arrayBuffers": 1048576
      }
    },
    "cpu": {
      "timestamp": 1704067200000,
      "server": {
        "percentage": 25.5,
        "user": 1000000,
        "system": 500000
      },
      "eventLoopLag": 5
    },
    "processes": [],
    "processSummary": {
      "total": 0,
      "running": 0,
      "idle": 0,
      "stopped": 0,
      "errored": 0,
      "byType": {
        "agent": 0,
        "cli": 0,
        "terminal": 0,
        "worker": 0
      }
    },
    "memoryTrend": {
      "growthRate": 1024,
      "isLeaking": false,
      "confidence": 0.85,
      "sampleCount": 30,
      "windowDuration": 30000
    }
  }
}
```

---

### POST /api/debug/metrics/start

Starts metrics collection with optional configuration overrides.

**Request Body** (optional)

```json
{
  "config": {
    "collectionInterval": 2000,
    "maxDataPoints": 100,
    "memoryEnabled": true,
    "cpuEnabled": true,
    "leakThreshold": 2097152
  }
}
```

**Configuration Limits** (enforced server-side)

| Field                | Min   | Max     | Default |
| -------------------- | ----- | ------- | ------- |
| `collectionInterval` | 100ms | 60000ms | 1000ms  |
| `maxDataPoints`      | 10    | 10000   | 60      |
| `leakThreshold`      | 1KB   | 100MB   | 1MB     |

**Response**

```json
{
  "active": true,
  "config": {
    "memoryEnabled": true,
    "cpuEnabled": true,
    "processTrackingEnabled": true,
    "collectionInterval": 2000,
    "maxDataPoints": 100,
    "leakThreshold": 2097152
  }
}
```

---

### POST /api/debug/metrics/stop

Stops metrics collection.

**Response**

```json
{
  "active": false,
  "config": {
    "memoryEnabled": true,
    "cpuEnabled": true,
    "processTrackingEnabled": true,
    "collectionInterval": 1000,
    "maxDataPoints": 60,
    "leakThreshold": 1048576
  }
}
```

---

### POST /api/debug/metrics/gc

Forces garbage collection if Node.js was started with `--expose-gc` flag.

**Response (success)**

```json
{
  "success": true,
  "message": "Garbage collection triggered"
}
```

**Response (not available)**

```json
{
  "success": false,
  "message": "Garbage collection not available (start Node.js with --expose-gc flag)"
}
```

---

### POST /api/debug/metrics/clear

Clears the metrics history buffer.

**Response**

```json
{
  "success": true,
  "message": "Metrics history cleared"
}
```

---

## Process Endpoints

### GET /api/debug/processes

Returns a list of tracked processes with optional filtering.

**Query Parameters**

| Parameter        | Type   | Description                                                                     |
| ---------------- | ------ | ------------------------------------------------------------------------------- |
| `type`           | string | Filter by process type: `agent`, `cli`, `terminal`, `worker`                    |
| `status`         | string | Filter by status: `starting`, `running`, `idle`, `stopping`, `stopped`, `error` |
| `includeStopped` | string | Set to `"true"` to include stopped processes                                    |
| `sessionId`      | string | Filter by session ID                                                            |
| `featureId`      | string | Filter by feature ID                                                            |

**Example Request**

```
GET /api/debug/processes?type=agent&status=running&includeStopped=true
```

**Response**

```json
{
  "processes": [
    {
      "id": "agent-12345",
      "pid": 1234,
      "type": "agent",
      "name": "Feature Agent",
      "status": "running",
      "startedAt": 1704067200000,
      "memoryUsage": 52428800,
      "cpuUsage": 15.5,
      "featureId": "feature-123",
      "sessionId": "session-456"
    }
  ],
  "summary": {
    "total": 5,
    "running": 2,
    "idle": 1,
    "stopped": 1,
    "errored": 1,
    "byType": {
      "agent": 2,
      "cli": 1,
      "terminal": 2,
      "worker": 0
    }
  }
}
```

---

### GET /api/debug/processes/summary

Returns summary statistics for all tracked processes.

**Response**

```json
{
  "total": 5,
  "running": 2,
  "idle": 1,
  "stopped": 1,
  "errored": 1,
  "byType": {
    "agent": 2,
    "cli": 1,
    "terminal": 2,
    "worker": 0
  }
}
```

---

### GET /api/debug/processes/:id

Returns details for a specific process.

**Path Parameters**

| Parameter | Type   | Description                     |
| --------- | ------ | ------------------------------- |
| `id`      | string | Process ID (max 256 characters) |

**Response (success)**

```json
{
  "id": "agent-12345",
  "pid": 1234,
  "type": "agent",
  "name": "Feature Agent",
  "status": "running",
  "startedAt": 1704067200000,
  "memoryUsage": 52428800,
  "cpuUsage": 15.5,
  "featureId": "feature-123",
  "sessionId": "session-456",
  "command": "node agent.js",
  "cwd": "/path/to/project"
}
```

**Response (not found)**

```json
{
  "error": "Process not found",
  "id": "non-existent-id"
}
```

**Response (invalid ID)**

```json
{
  "error": "Invalid process ID format"
}
```

---

## Agent Resource Metrics Endpoints

These endpoints provide detailed resource usage metrics for agent processes, including file I/O, tool usage, bash commands, and memory tracking.

### GET /api/debug/agents

Returns all agent processes with their detailed resource metrics.

**Response**

```json
{
  "agents": [
    {
      "id": "agent-feature-123",
      "pid": -1,
      "type": "agent",
      "name": "Feature Agent",
      "status": "running",
      "startedAt": 1704067200000,
      "featureId": "feature-123",
      "resourceMetrics": {
        "agentId": "agent-feature-123",
        "featureId": "feature-123",
        "startedAt": 1704067200000,
        "lastUpdatedAt": 1704067260000,
        "duration": 60000,
        "isRunning": true,
        "memory": {
          "startHeapUsed": 52428800,
          "currentHeapUsed": 57671680,
          "peakHeapUsed": 58720256,
          "deltaHeapUsed": 5242880,
          "samples": [...]
        },
        "fileIO": {
          "reads": 25,
          "bytesRead": 524288,
          "writes": 5,
          "bytesWritten": 10240,
          "edits": 3,
          "globs": 10,
          "greps": 8,
          "filesAccessed": ["src/index.ts", "src/utils.ts", ...]
        },
        "tools": {
          "totalInvocations": 51,
          "byTool": {
            "Read": 25,
            "Glob": 10,
            "Grep": 8,
            "Write": 5,
            "Edit": 3
          },
          "avgExecutionTime": 150,
          "totalExecutionTime": 7650,
          "failedInvocations": 1
        },
        "bash": {
          "commandCount": 5,
          "totalExecutionTime": 2500,
          "failedCommands": 0,
          "commands": [...]
        },
        "api": {
          "turns": 12,
          "totalDuration": 45000,
          "errors": 0
        }
      }
    }
  ],
  "summary": {
    "totalAgents": 3,
    "runningAgents": 1,
    "totalFileReads": 75,
    "totalFileWrites": 15,
    "totalBytesRead": 1572864,
    "totalBytesWritten": 30720,
    "totalToolInvocations": 153,
    "totalBashCommands": 12,
    "totalAPITurns": 36,
    "peakMemoryUsage": 58720256,
    "totalDuration": 180000
  }
}
```

---

### GET /api/debug/agents/summary

Returns aggregate resource usage statistics across all agent processes.

**Response**

```json
{
  "totalAgents": 3,
  "runningAgents": 1,
  "totalFileReads": 75,
  "totalFileWrites": 15,
  "totalBytesRead": 1572864,
  "totalBytesWritten": 30720,
  "totalToolInvocations": 153,
  "totalBashCommands": 12,
  "totalAPITurns": 36,
  "peakMemoryUsage": 58720256,
  "totalDuration": 180000
}
```

---

### GET /api/debug/agents/:id/metrics

Returns detailed resource metrics for a specific agent.

**Path Parameters**

| Parameter | Type   | Description                                                        |
| --------- | ------ | ------------------------------------------------------------------ |
| `id`      | string | Agent process ID (e.g., `agent-feature-123` or `chat-session-456`) |

**Response (success)**

```json
{
  "agentId": "agent-feature-123",
  "featureId": "feature-123",
  "startedAt": 1704067200000,
  "lastUpdatedAt": 1704067260000,
  "duration": 60000,
  "isRunning": true,
  "memory": {
    "startHeapUsed": 52428800,
    "currentHeapUsed": 57671680,
    "peakHeapUsed": 58720256,
    "deltaHeapUsed": 5242880,
    "samples": [
      { "timestamp": 1704067200000, "heapUsed": 52428800 },
      { "timestamp": 1704067201000, "heapUsed": 53477376 }
    ]
  },
  "fileIO": {
    "reads": 25,
    "bytesRead": 524288,
    "writes": 5,
    "bytesWritten": 10240,
    "edits": 3,
    "globs": 10,
    "greps": 8,
    "filesAccessed": ["src/index.ts", "src/utils.ts", "package.json"]
  },
  "tools": {
    "totalInvocations": 51,
    "byTool": {
      "Read": 25,
      "Glob": 10,
      "Grep": 8,
      "Write": 5,
      "Edit": 3
    },
    "avgExecutionTime": 150,
    "totalExecutionTime": 7650,
    "failedInvocations": 1
  },
  "bash": {
    "commandCount": 5,
    "totalExecutionTime": 2500,
    "failedCommands": 0,
    "commands": [
      {
        "command": "npm test",
        "exitCode": 0,
        "duration": 1500,
        "timestamp": 1704067230000
      }
    ]
  },
  "api": {
    "turns": 12,
    "inputTokens": 15000,
    "outputTokens": 8000,
    "thinkingTokens": 5000,
    "totalDuration": 45000,
    "errors": 0
  }
}
```

**Response (not found)**

```json
{
  "error": "Agent metrics not found",
  "id": "non-existent-id"
}
```

---

## Types

### TrackedProcess

```typescript
interface TrackedProcess {
  id: string; // Unique identifier
  pid?: number; // OS process ID
  type: ProcessType; // 'agent' | 'cli' | 'terminal' | 'worker'
  name: string; // Human-readable name
  status: ProcessStatus; // Current status
  startedAt: number; // Start timestamp (ms)
  stoppedAt?: number; // Stop timestamp (ms)
  memoryUsage?: number; // Memory in bytes
  cpuUsage?: number; // CPU percentage
  featureId?: string; // Associated feature
  sessionId?: string; // Associated session
  command?: string; // Command executed
  cwd?: string; // Working directory
  exitCode?: number; // Exit code (if stopped)
  error?: string; // Error message (if failed)
  resourceMetrics?: AgentResourceMetrics; // Detailed metrics for agents
}
```

### AgentResourceMetrics

```typescript
interface AgentResourceMetrics {
  agentId: string; // Agent/process ID
  sessionId?: string; // Session ID if available
  featureId?: string; // Feature ID if running a feature
  startedAt: number; // When metrics collection started
  lastUpdatedAt: number; // When metrics were last updated
  duration: number; // Duration of agent execution (ms)
  isRunning: boolean; // Whether the agent is still running
  memory: AgentMemoryMetrics;
  fileIO: FileIOMetrics;
  tools: ToolUsageMetrics;
  bash: BashMetrics;
  api: APIMetrics;
}

interface AgentMemoryMetrics {
  startHeapUsed: number; // Memory at agent start (bytes)
  currentHeapUsed: number; // Current memory (bytes)
  peakHeapUsed: number; // Peak memory during execution (bytes)
  deltaHeapUsed: number; // Memory change since start
  samples: Array<{ timestamp: number; heapUsed: number }>;
}

interface FileIOMetrics {
  reads: number; // Number of file reads
  bytesRead: number; // Total bytes read
  writes: number; // Number of file writes
  bytesWritten: number; // Total bytes written
  edits: number; // Number of file edits
  globs: number; // Number of glob operations
  greps: number; // Number of grep operations
  filesAccessed: string[]; // Unique files accessed (max 100)
}

interface ToolUsageMetrics {
  totalInvocations: number;
  byTool: Record<string, number>; // Invocations per tool name
  avgExecutionTime: number; // Average tool execution time (ms)
  totalExecutionTime: number; // Total tool execution time (ms)
  failedInvocations: number;
}

interface BashMetrics {
  commandCount: number;
  totalExecutionTime: number;
  failedCommands: number;
  commands: Array<{
    command: string;
    exitCode: number | null;
    duration: number;
    timestamp: number;
  }>;
}

interface APIMetrics {
  turns: number; // Number of API turns/iterations
  inputTokens?: number; // Input tokens used
  outputTokens?: number; // Output tokens generated
  thinkingTokens?: number; // Thinking tokens used
  totalDuration: number; // Total API call duration (ms)
  errors: number; // Number of API errors
}
```

### ProcessStatus

- `starting` - Process is starting up
- `running` - Process is actively running
- `idle` - Process is idle/waiting
- `stopping` - Process is shutting down
- `stopped` - Process has stopped normally
- `error` - Process encountered an error

### MemoryTrend

```typescript
interface MemoryTrend {
  growthRate: number; // Bytes per second
  isLeaking: boolean; // Leak detected flag
  confidence: number; // R² value (0-1)
  sampleCount: number; // Data points analyzed
  windowDuration: number; // Analysis window (ms)
}
```

---

## Events

The debug system emits the following WebSocket events:

| Event                      | Description                                         |
| -------------------------- | --------------------------------------------------- |
| `debug:metrics`            | Periodic metrics snapshot (at `collectionInterval`) |
| `debug:memory-warning`     | Memory usage exceeds 70% of heap limit              |
| `debug:memory-critical`    | Memory usage exceeds 90% of heap limit              |
| `debug:leak-detected`      | Memory leak pattern detected                        |
| `debug:process-spawned`    | New process registered                              |
| `debug:process-updated`    | Process status changed                              |
| `debug:process-stopped`    | Process stopped normally                            |
| `debug:process-error`      | Process encountered an error                        |
| `debug:high-cpu`           | CPU usage exceeds 80%                               |
| `debug:event-loop-blocked` | Event loop lag exceeds 100ms                        |

---

## Usage Example

### Starting metrics collection with custom config

```typescript
// Start with 500ms interval and 120 data points
await fetch('/api/debug/metrics/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    config: {
      collectionInterval: 500,
      maxDataPoints: 120,
    },
  }),
});

// Poll for metrics
const response = await fetch('/api/debug/metrics');
const { snapshot } = await response.json();

console.log(`Heap used: ${(snapshot.memory.server.heapUsed / 1024 / 1024).toFixed(1)} MB`);
console.log(`CPU: ${snapshot.cpu.server.percentage.toFixed(1)}%`);
```

### Monitoring for memory leaks

```typescript
const response = await fetch('/api/debug/metrics');
const { snapshot } = await response.json();

if (snapshot.memoryTrend?.isLeaking) {
  console.warn(`Memory leak detected!`);
  console.warn(`Growth rate: ${snapshot.memoryTrend.growthRate} bytes/s`);
  console.warn(`Confidence: ${(snapshot.memoryTrend.confidence * 100).toFixed(0)}%`);
}
```
