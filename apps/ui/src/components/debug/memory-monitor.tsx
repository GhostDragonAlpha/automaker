/**
 * Memory Monitor Component
 *
 * Displays real-time heap usage with a line chart showing historical data.
 */

import { useMemo, memo } from 'react';
import { HardDrive, TrendingUp, TrendingDown, Minus, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBytes } from '@automaker/types';
import type { MemoryDataPoint, MemoryTrend, ServerMemoryMetrics } from '@automaker/types';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

/** Tooltip explanations for memory metrics */
const METRIC_TOOLTIPS = {
  heap: 'JavaScript heap memory - memory used by V8 engine for JavaScript objects and data',
  rss: 'Resident Set Size - total memory allocated for the process including code, stack, and heap',
  external: 'Memory used by C++ objects bound to JavaScript objects (e.g., Buffers)',
  arrayBuffers: 'Memory allocated for ArrayBuffer and SharedArrayBuffer objects',
} as const;

interface MemoryMonitorProps {
  history: MemoryDataPoint[];
  current: ServerMemoryMetrics | null;
  trend: MemoryTrend | null;
  className?: string;
}

/**
 * Simple sparkline chart for memory data - Memoized to prevent unnecessary re-renders
 */
const MemorySparkline = memo(function MemorySparkline({
  data,
  className,
}: {
  data: MemoryDataPoint[];
  className?: string;
}) {
  const { pathD, width, height } = useMemo(() => {
    if (data.length < 2) {
      return { pathD: '', width: 200, height: 40 };
    }

    const w = 200;
    const h = 40;
    const padding = 2;

    const values = data.map((d) => d.heapUsed);
    const max = Math.max(...values) * 1.1; // Add 10% headroom
    const min = Math.min(...values) * 0.9;
    const range = max - min || 1;

    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * (w - padding * 2) + padding;
      const y = h - padding - ((d.heapUsed - min) / range) * (h - padding * 2);
      return `${x},${y}`;
    });

    return {
      pathD: `M ${points.join(' L ')}`,
      width: w,
      height: h,
    };
  }, [data]);

  if (data.length < 2) {
    return (
      <div
        className={cn(
          'h-10 flex items-center justify-center text-muted-foreground text-xs',
          className
        )}
      >
        Collecting data...
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn('w-full', className)}
      preserveAspectRatio="none"
    >
      <path
        d={pathD}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-blue-500"
      />
    </svg>
  );
});

/**
 * Label with optional tooltip - Memoized
 */
const MetricLabel = memo(function MetricLabel({
  label,
  tooltip,
}: {
  label: string;
  tooltip?: string;
}) {
  if (!tooltip) {
    return <span className="text-muted-foreground">{label}</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground cursor-help inline-flex items-center gap-1">
            {label}
            <HelpCircle className="w-3 h-3 opacity-50" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[250px] z-[10000]">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

/**
 * Memory usage bar - Memoized to prevent unnecessary re-renders
 */
const MemoryBar = memo(function MemoryBar({
  used,
  total,
  label,
  tooltip,
}: {
  used: number;
  total: number;
  label: string;
  tooltip?: string;
}) {
  const percentage = total > 0 ? (used / total) * 100 : 0;
  const isHigh = percentage > 70;
  const isCritical = percentage > 90;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <MetricLabel label={label} tooltip={tooltip} />
        <span
          className={cn(isCritical && 'text-red-400', isHigh && !isCritical && 'text-yellow-400')}
        >
          {formatBytes(used)} / {formatBytes(total)}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full transition-all duration-300 rounded-full',
            isCritical ? 'bg-red-500' : isHigh ? 'bg-yellow-500' : 'bg-blue-500'
          )}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
});

/**
 * Trend indicator - Memoized to prevent unnecessary re-renders
 */
const TrendIndicator = memo(function TrendIndicator({ trend }: { trend: MemoryTrend | null }) {
  if (!trend) {
    return null;
  }

  const isGrowing = trend.growthRate > 1024 * 100; // > 100KB/s
  const isShrinking = trend.growthRate < -1024 * 100; // < -100KB/s
  const isStable = !isGrowing && !isShrinking;

  return (
    <div
      className={cn(
        'flex items-center gap-1 text-xs px-2 py-0.5 rounded-full',
        trend.isLeaking && 'bg-red-500/20 text-red-400',
        isGrowing && !trend.isLeaking && 'bg-yellow-500/20 text-yellow-400',
        isShrinking && 'bg-green-500/20 text-green-400',
        isStable && !trend.isLeaking && 'bg-muted text-muted-foreground'
      )}
    >
      {trend.isLeaking ? (
        <>
          <TrendingUp className="w-3 h-3" />
          <span>Leak detected</span>
        </>
      ) : isGrowing ? (
        <>
          <TrendingUp className="w-3 h-3" />
          <span>{formatBytes(Math.abs(trend.growthRate))}/s</span>
        </>
      ) : isShrinking ? (
        <>
          <TrendingDown className="w-3 h-3" />
          <span>{formatBytes(Math.abs(trend.growthRate))}/s</span>
        </>
      ) : (
        <>
          <Minus className="w-3 h-3" />
          <span>Stable</span>
        </>
      )}
    </div>
  );
});

export function MemoryMonitor({ history, current, trend, className }: MemoryMonitorProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium">Memory</span>
        </div>
        <TrendIndicator trend={trend} />
      </div>

      {/* Current values */}
      {current ? (
        <div className="space-y-3">
          {/* Heap with integrated sparkline */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <MetricLabel label="Heap" tooltip={METRIC_TOOLTIPS.heap} />
              <span
                className={cn(
                  (current.heapUsed / current.heapTotal) * 100 > 90 && 'text-red-400',
                  (current.heapUsed / current.heapTotal) * 100 > 70 &&
                    (current.heapUsed / current.heapTotal) * 100 <= 90 &&
                    'text-yellow-400'
                )}
              >
                {formatBytes(current.heapUsed)} / {formatBytes(current.heapTotal)}
              </span>
            </div>
            {/* Sparkline chart for heap history */}
            <div className="h-8 bg-muted/30 rounded overflow-hidden">
              <MemorySparkline data={history} className="h-full" />
            </div>
          </div>

          {/* RSS bar */}
          <MemoryBar
            used={current.rss}
            total={current.heapTotal * 1.5}
            label="RSS"
            tooltip={METRIC_TOOLTIPS.rss}
          />

          {/* Additional metrics with tooltips */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <MetricLabel label="External:" tooltip={METRIC_TOOLTIPS.external} />
              <span className="ml-auto">{formatBytes(current.external)}</span>
            </div>
            <div className="flex items-center gap-1">
              <MetricLabel label="Buffers:" tooltip={METRIC_TOOLTIPS.arrayBuffers} />
              <span className="ml-auto">{formatBytes(current.arrayBuffers)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center text-xs text-muted-foreground py-2">No data available</div>
      )}
    </div>
  );
}
