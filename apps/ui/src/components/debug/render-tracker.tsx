/**
 * Render Tracker Component
 *
 * Displays component render statistics and highlights frequently re-rendering components.
 */

import { RefreshCw, AlertTriangle, TrendingUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDuration } from '@automaker/types';
import type { ComponentRenderStats, RenderTrackingSummary } from '@automaker/types';

interface RenderTrackerProps {
  summary: RenderTrackingSummary;
  stats: ComponentRenderStats[];
  onClear?: () => void;
  className?: string;
}

/**
 * Component stats row
 */
function ComponentStatsRow({ stats }: { stats: ComponentRenderStats }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 p-2 rounded text-xs',
        stats.isHighRender ? 'bg-red-500/10 border border-red-500/30' : 'bg-muted/30'
      )}
    >
      {/* Component name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {stats.isHighRender && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
          <span className={cn('font-medium truncate', stats.isHighRender && 'text-red-400')}>
            {stats.componentName}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-muted-foreground shrink-0">
        <div className="flex items-center gap-1" title="Render count">
          <RefreshCw className="w-3 h-3" />
          <span>{stats.renderCount}</span>
        </div>
        <div className="flex items-center gap-1" title="Renders per second">
          <TrendingUp className="w-3 h-3" />
          <span className={cn(stats.isHighRender && 'text-red-400')}>
            {stats.rendersPerSecond.toFixed(1)}/s
          </span>
        </div>
        <div className="flex items-center gap-1" title="Average duration">
          <Clock className="w-3 h-3" />
          <span>{formatDuration(stats.avgDuration)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Summary stats
 */
function SummaryStats({ summary }: { summary: RenderTrackingSummary }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div className="p-2 bg-muted/30 rounded">
        <div className="text-lg font-bold">{summary.totalRenders}</div>
        <div className="text-xs text-muted-foreground">Total Renders</div>
      </div>
      <div className="p-2 bg-muted/30 rounded">
        <div className="text-lg font-bold">{summary.uniqueComponents}</div>
        <div className="text-xs text-muted-foreground">Components</div>
      </div>
      <div
        className={cn(
          'p-2 rounded',
          summary.highRenderComponents.length > 0 ? 'bg-red-500/20' : 'bg-muted/30'
        )}
      >
        <div
          className={cn(
            'text-lg font-bold',
            summary.highRenderComponents.length > 0 && 'text-red-400'
          )}
        >
          {summary.highRenderComponents.length}
        </div>
        <div className="text-xs text-muted-foreground">High Render</div>
      </div>
    </div>
  );
}

export function RenderTracker({ summary, stats, onClear, className }: RenderTrackerProps) {
  // Sort by render count (highest first)
  const sortedStats = [...stats].sort((a, b) => b.renderCount - a.renderCount);
  const topStats = sortedStats.slice(0, 10);

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-medium">Render Tracker</span>
        </div>
        {onClear && (
          <button
            onClick={onClear}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted"
          >
            Clear
          </button>
        )}
      </div>

      {/* Summary */}
      <SummaryStats summary={summary} />

      {/* High render warnings */}
      {summary.highRenderComponents.length > 0 && (
        <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-xs">
          <div className="flex items-center gap-1 text-red-400 font-medium mb-1">
            <AlertTriangle className="w-3 h-3" />
            <span>High render rate detected</span>
          </div>
          <div className="text-muted-foreground">{summary.highRenderComponents.join(', ')}</div>
        </div>
      )}

      {/* Component list */}
      <div className="space-y-1 max-h-[200px] overflow-y-auto">
        {topStats.length > 0 ? (
          topStats.map((s) => <ComponentStatsRow key={s.componentName} stats={s} />)
        ) : (
          <div className="text-center text-xs text-muted-foreground py-4">
            <p>No render data yet.</p>
            <p className="mt-1">Wrap components with RenderProfiler to track renders.</p>
          </div>
        )}
      </div>
    </div>
  );
}
