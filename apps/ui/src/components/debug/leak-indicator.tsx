/**
 * Leak Indicator Component
 *
 * Alerts when memory growth patterns exceed threshold.
 */

import { AlertTriangle, TrendingUp, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBytes } from '@automaker/types';
import type { MemoryTrend } from '@automaker/types';

interface LeakIndicatorProps {
  trend: MemoryTrend | null;
  onForceGC?: () => void;
  className?: string;
}

export function LeakIndicator({ trend, onForceGC, className }: LeakIndicatorProps) {
  if (!trend) {
    return (
      <div className={cn('p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground', className)}>
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4" />
          <span>Collecting memory data for leak analysis...</span>
        </div>
      </div>
    );
  }

  const isLeaking = trend.isLeaking;
  const isGrowing = trend.growthRate > 1024 * 100; // > 100KB/s
  const growthPerSecond = formatBytes(Math.abs(trend.growthRate));
  const confidencePercent = (trend.confidence * 100).toFixed(0);

  if (isLeaking) {
    return (
      <div className={cn('p-3 bg-red-500/10 border border-red-500/30 rounded-lg', className)}>
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-red-400 text-sm">Memory Leak Detected</div>
            <div className="text-xs text-muted-foreground mt-1 space-y-1">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>Growing at {growthPerSecond}/s</span>
              </div>
              <div>Confidence: {confidencePercent}%</div>
              <div>Samples: {trend.sampleCount}</div>
            </div>
            <div className="mt-2 text-xs text-red-300">
              Memory is consistently growing without garbage collection. This may indicate detached
              DOM nodes, event listener leaks, or objects held in closures.
            </div>
            {onForceGC && (
              <button
                onClick={onForceGC}
                className="mt-2 px-3 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors"
              >
                Force GC
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isGrowing) {
    return (
      <div className={cn('p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg', className)}>
        <div className="flex items-start gap-2">
          <TrendingUp className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-yellow-400 text-sm">Memory Growing</div>
            <div className="text-xs text-muted-foreground mt-1 space-y-1">
              <div>Rate: {growthPerSecond}/s</div>
              <div>Confidence: {confidencePercent}%</div>
            </div>
            <div className="mt-2 text-xs text-yellow-300">
              Memory is growing but not yet at leak threshold. Monitor for sustained growth.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Healthy state
  return (
    <div className={cn('p-3 bg-green-500/10 border border-green-500/30 rounded-lg', className)}>
      <div className="flex items-center gap-2">
        <Info className="w-4 h-4 text-green-400" />
        <div>
          <div className="font-medium text-green-400 text-sm">Memory Stable</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            No memory leak patterns detected ({trend.sampleCount} samples)
          </div>
        </div>
      </div>
    </div>
  );
}
