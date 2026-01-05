/**
 * CPU Monitor Component
 *
 * Displays CPU usage percentage with historical chart and event loop lag indicator.
 */

import { useMemo } from 'react';
import { Cpu, Activity, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CPUDataPoint, ServerCPUMetrics } from '@automaker/types';

interface CPUMonitorProps {
  history: CPUDataPoint[];
  current: ServerCPUMetrics | null;
  eventLoopLag?: number;
  className?: string;
}

/**
 * Simple sparkline chart for CPU data
 */
function CPUSparkline({ data, className }: { data: CPUDataPoint[]; className?: string }) {
  const pathD = useMemo(() => {
    if (data.length < 2) {
      return '';
    }

    const w = 200;
    const h = 40;
    const padding = 2;

    // CPU percentage is 0-100, but we'll use 0-100 as our range
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * (w - padding * 2) + padding;
      const y = h - padding - (d.percentage / 100) * (h - padding * 2);
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
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
    <svg viewBox="0 0 200 40" className={cn('w-full', className)} preserveAspectRatio="none">
      <path
        d={pathD}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-green-500"
      />
    </svg>
  );
}

/**
 * CPU usage gauge
 */
function CPUGauge({ percentage }: { percentage: number }) {
  const isHigh = percentage > 60;
  const isCritical = percentage > 80;

  return (
    <div className="relative w-16 h-16">
      {/* Background circle */}
      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="16" fill="none" strokeWidth="3" className="stroke-muted" />
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          strokeWidth="3"
          strokeDasharray={`${percentage} 100`}
          strokeLinecap="round"
          className={cn(
            'transition-all duration-300',
            isCritical ? 'stroke-red-500' : isHigh ? 'stroke-yellow-500' : 'stroke-green-500'
          )}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={cn(
            'text-sm font-mono font-bold',
            isCritical ? 'text-red-400' : isHigh ? 'text-yellow-400' : 'text-green-400'
          )}
        >
          {percentage.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

/**
 * Event loop lag indicator
 */
function EventLoopLag({ lag }: { lag?: number }) {
  if (lag === undefined) {
    return null;
  }

  const isBlocked = lag > 50;
  const isSevere = lag > 100;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-xs px-2 py-1 rounded',
        isSevere && 'bg-red-500/20 text-red-400',
        isBlocked && !isSevere && 'bg-yellow-500/20 text-yellow-400',
        !isBlocked && 'bg-muted text-muted-foreground'
      )}
    >
      {isSevere ? <AlertTriangle className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
      <span>Event Loop: {lag.toFixed(0)}ms</span>
    </div>
  );
}

export function CPUMonitor({ history, current, eventLoopLag, className }: CPUMonitorProps) {
  const percentage = current?.percentage ?? 0;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-green-500" />
          <span className="text-sm font-medium">CPU</span>
        </div>
        <EventLoopLag lag={eventLoopLag} />
      </div>

      {/* Main content */}
      <div className="flex items-center gap-4">
        {/* Gauge */}
        <CPUGauge percentage={percentage} />

        {/* Sparkline */}
        <div className="flex-1 h-10">
          <CPUSparkline data={history} />
        </div>
      </div>

      {/* Details */}
      {current && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">User: </span>
            <span>{(current.user / 1000).toFixed(1)}ms</span>
          </div>
          <div>
            <span className="text-muted-foreground">System: </span>
            <span>{(current.system / 1000).toFixed(1)}ms</span>
          </div>
        </div>
      )}
    </div>
  );
}
