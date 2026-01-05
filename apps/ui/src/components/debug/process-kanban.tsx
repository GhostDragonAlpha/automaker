/**
 * Process Kanban Component
 *
 * Visual board showing active agents/CLIs with status indicators.
 * Columns: Active | Idle | Stopped | Error
 */

import { useMemo, memo, useState } from 'react';
import {
  Bot,
  Terminal,
  Cpu,
  Circle,
  Clock,
  AlertCircle,
  CheckCircle2,
  Pause,
  Play,
  FileText,
  Hammer,
  ChevronDown,
  ChevronRight,
  HardDrive,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBytes, formatDuration } from '@automaker/types';
import type {
  TrackedProcess,
  ProcessType,
  ProcessStatus,
  ProcessSummary,
  AgentResourceMetrics,
} from '@automaker/types';

interface ProcessKanbanProps {
  processes: TrackedProcess[];
  summary: ProcessSummary | null;
  className?: string;
  /** Panel width for responsive layout - uses 2x2 grid when narrow */
  panelWidth?: number;
}

/**
 * Get icon for process type
 */
function getProcessIcon(type: ProcessType) {
  switch (type) {
    case 'agent':
      return <Bot className="w-3.5 h-3.5" />;
    case 'terminal':
      return <Terminal className="w-3.5 h-3.5" />;
    case 'cli':
      return <Terminal className="w-3.5 h-3.5" />;
    case 'worker':
      return <Cpu className="w-3.5 h-3.5" />;
    default:
      return <Circle className="w-3.5 h-3.5" />;
  }
}

/**
 * Get status indicator
 */
function getStatusIndicator(status: ProcessStatus) {
  switch (status) {
    case 'running':
      return <Play className="w-3 h-3 text-green-400" />;
    case 'starting':
      return <Circle className="w-3 h-3 text-blue-400 animate-pulse" />;
    case 'idle':
      return <Pause className="w-3 h-3 text-yellow-400" />;
    case 'stopping':
      return <Circle className="w-3 h-3 text-orange-400 animate-pulse" />;
    case 'stopped':
      return <CheckCircle2 className="w-3 h-3 text-muted-foreground" />;
    case 'error':
      return <AlertCircle className="w-3 h-3 text-red-400" />;
    default:
      return <Circle className="w-3 h-3" />;
  }
}

/**
 * Resource metrics display component for agent processes
 */
const ResourceMetrics = memo(function ResourceMetrics({
  metrics,
}: {
  metrics: AgentResourceMetrics;
}) {
  return (
    <div className="mt-1.5 pt-1.5 border-t border-border/50 space-y-1">
      {/* File I/O */}
      <div className="flex items-center gap-1 text-muted-foreground">
        <FileText className="w-3 h-3" />
        <span>Files:</span>
        <span className="ml-auto">
          {metrics.fileIO.reads}R / {metrics.fileIO.writes}W / {metrics.fileIO.edits}E
        </span>
      </div>

      {/* Bytes transferred */}
      {(metrics.fileIO.bytesRead > 0 || metrics.fileIO.bytesWritten > 0) && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <HardDrive className="w-3 h-3" />
          <span>I/O:</span>
          <span className="ml-auto">
            {formatBytes(metrics.fileIO.bytesRead)} read /{' '}
            {formatBytes(metrics.fileIO.bytesWritten)} written
          </span>
        </div>
      )}

      {/* Tool usage */}
      <div className="flex items-center gap-1 text-muted-foreground">
        <Hammer className="w-3 h-3" />
        <span>Tools:</span>
        <span className="ml-auto">{metrics.tools.totalInvocations} calls</span>
      </div>

      {/* API turns */}
      {metrics.api.turns > 0 && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Activity className="w-3 h-3" />
          <span>API:</span>
          <span className="ml-auto">{metrics.api.turns} turns</span>
        </div>
      )}

      {/* Bash commands */}
      {metrics.bash.commandCount > 0 && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Terminal className="w-3 h-3" />
          <span>Bash:</span>
          <span className="ml-auto">
            {metrics.bash.commandCount} cmds
            {metrics.bash.failedCommands > 0 && (
              <span className="text-red-400 ml-1">({metrics.bash.failedCommands} failed)</span>
            )}
          </span>
        </div>
      )}

      {/* Memory delta */}
      {metrics.memory.deltaHeapUsed !== 0 && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Cpu className="w-3 h-3" />
          <span>Mem delta:</span>
          <span
            className={cn(
              'ml-auto',
              metrics.memory.deltaHeapUsed > 0 ? 'text-orange-400' : 'text-green-400'
            )}
          >
            {metrics.memory.deltaHeapUsed > 0 ? '+' : ''}
            {formatBytes(metrics.memory.deltaHeapUsed)}
          </span>
        </div>
      )}
    </div>
  );
});

/**
 * Process card component - Memoized to prevent unnecessary re-renders
 */
const ProcessCard = memo(function ProcessCard({ process }: { process: TrackedProcess }) {
  const [expanded, setExpanded] = useState(false);

  const runtime = useMemo(() => {
    const end = process.stoppedAt || Date.now();
    return end - process.startedAt;
  }, [process.startedAt, process.stoppedAt]);

  const isActive = process.status === 'running' || process.status === 'starting';
  const isError = process.status === 'error';
  const hasMetrics = process.type === 'agent' && process.resourceMetrics;

  return (
    <div
      className={cn(
        'p-2 rounded-md border text-xs',
        isError && 'border-red-500/50 bg-red-500/10',
        isActive && !isError && 'border-green-500/50 bg-green-500/10',
        !isActive && !isError && 'border-border bg-muted/30'
      )}
    >
      {/* Header */}
      <div
        className={cn('flex items-center gap-1.5 mb-1', hasMetrics && 'cursor-pointer')}
        onClick={() => hasMetrics && setExpanded(!expanded)}
      >
        {hasMetrics &&
          (expanded ? (
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          ))}
        {getProcessIcon(process.type)}
        <span className="font-medium truncate flex-1">{process.name}</span>
        {getStatusIndicator(process.status)}
      </div>

      {/* Basic Details */}
      <div className="space-y-0.5 text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{formatDuration(runtime)}</span>
          {hasMetrics && (
            <span className="ml-auto text-purple-400">
              {process.resourceMetrics!.tools.totalInvocations} tools
            </span>
          )}
        </div>

        {process.memoryUsage !== undefined && (
          <div className="flex justify-between">
            <span>Memory:</span>
            <span>{formatBytes(process.memoryUsage)}</span>
          </div>
        )}

        {process.cpuUsage !== undefined && (
          <div className="flex justify-between">
            <span>CPU:</span>
            <span>{process.cpuUsage.toFixed(1)}%</span>
          </div>
        )}

        {process.error && (
          <div className="text-red-400 mt-1 truncate" title={process.error}>
            {process.error}
          </div>
        )}
      </div>

      {/* Expanded resource metrics */}
      {hasMetrics && expanded && <ResourceMetrics metrics={process.resourceMetrics!} />}
    </div>
  );
});

/**
 * Column component - Memoized to prevent unnecessary re-renders
 */
const ProcessColumn = memo(function ProcessColumn({
  title,
  processes,
  count,
  colorClass,
}: {
  title: string;
  processes: TrackedProcess[];
  count: number;
  colorClass: string;
}) {
  return (
    <div className="flex-1 min-w-0">
      {/* Column header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium">{title}</span>
        <span className={cn('text-xs px-1.5 py-0.5 rounded', colorClass)}>{count}</span>
      </div>

      {/* Cards */}
      <div className="space-y-1.5">
        {processes.length > 0 ? (
          processes.map((process) => <ProcessCard key={process.id} process={process} />)
        ) : (
          <div className="text-xs text-muted-foreground text-center py-2">No processes</div>
        )}
      </div>
    </div>
  );
});

/** Threshold width for switching to 2x2 grid layout */
const NARROW_THRESHOLD = 450;

export function ProcessKanban({ processes, summary, className, panelWidth }: ProcessKanbanProps) {
  // Determine if we should use narrow (2x2) layout
  const isNarrow = panelWidth !== undefined && panelWidth < NARROW_THRESHOLD;

  // Group processes by status
  const grouped = useMemo(() => {
    const active: TrackedProcess[] = [];
    const idle: TrackedProcess[] = [];
    const stopped: TrackedProcess[] = [];
    const errored: TrackedProcess[] = [];

    for (const process of processes) {
      switch (process.status) {
        case 'running':
        case 'starting':
          active.push(process);
          break;
        case 'idle':
          idle.push(process);
          break;
        case 'stopped':
        case 'stopping':
          stopped.push(process);
          break;
        case 'error':
          errored.push(process);
          break;
      }
    }

    return { active, idle, stopped, errored };
  }, [processes]);

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header with summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-medium">Processes</span>
        </div>
        {summary && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Total: {summary.total}</span>
            {summary.byType.agent > 0 && (
              <span className="text-purple-400">{summary.byType.agent} agents</span>
            )}
            {summary.byType.terminal > 0 && (
              <span className="text-blue-400">{summary.byType.terminal} terminals</span>
            )}
          </div>
        )}
      </div>

      {/* Kanban board - 2x2 grid when narrow, 4-column when wide */}
      <div className={cn('grid gap-2', isNarrow ? 'grid-cols-2' : 'grid-cols-4')}>
        <ProcessColumn
          title="Active"
          processes={grouped.active}
          count={summary?.running ?? grouped.active.length}
          colorClass="bg-green-500/20 text-green-400"
        />
        <ProcessColumn
          title="Idle"
          processes={grouped.idle}
          count={summary?.idle ?? grouped.idle.length}
          colorClass="bg-yellow-500/20 text-yellow-400"
        />
        <ProcessColumn
          title="Stopped"
          processes={grouped.stopped}
          count={summary?.stopped ?? grouped.stopped.length}
          colorClass="bg-muted text-muted-foreground"
        />
        <ProcessColumn
          title="Error"
          processes={grouped.errored}
          count={summary?.errored ?? grouped.errored.length}
          colorClass="bg-red-500/20 text-red-400"
        />
      </div>
    </div>
  );
}
