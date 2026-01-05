/**
 * Debug Status Bar Component
 *
 * VS Code-style status bar at the bottom of the screen showing quick debug stats.
 * Clicking expands to show the full debug panel.
 */

import { memo } from 'react';
import { Bug, HardDrive, Cpu, Bot, ChevronUp, X, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebugStore } from '@/store/debug-store';
import { useDebugMetrics } from '@/hooks/use-debug-metrics';
import { formatBytes } from '@automaker/types';

interface DebugStatusBarProps {
  className?: string;
}

/**
 * Quick stat display component
 */
const QuickStat = memo(function QuickStat({
  icon,
  label,
  value,
  onClick,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-2 py-0.5 text-xs hover:bg-muted/50 rounded transition-colors',
        className
      )}
    >
      {icon}
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </button>
  );
});

export function DebugStatusBar({ className }: DebugStatusBarProps) {
  const {
    isOpen,
    isDockedExpanded,
    panelMode,
    setOpen,
    toggleDockedExpanded,
    setActiveTab,
    togglePanelMode,
  } = useDebugStore();

  const metrics = useDebugMetrics();

  // Only show in docked mode when debug is enabled
  if (panelMode !== 'docked') {
    return null;
  }

  // Don't render if debug panel is not open (toggled off with Ctrl+Shift+D)
  if (!isOpen) {
    return null;
  }

  const heapUsed = metrics.latestSnapshot?.memory.server?.heapUsed ?? 0;
  const cpuPercent = metrics.latestSnapshot?.cpu.server?.percentage ?? 0;
  const processCount = metrics.processSummary?.running ?? 0;

  return (
    <div
      className={cn(
        'flex items-center justify-between h-6 px-2 bg-muted/50 border-t border-border text-xs',
        'select-none',
        className
      )}
    >
      {/* Left side - Debug label and quick stats */}
      <div className="flex items-center gap-1">
        {/* Debug label with status indicator */}
        <button
          onClick={toggleDockedExpanded}
          className="flex items-center gap-1.5 px-2 py-0.5 hover:bg-muted rounded transition-colors"
        >
          <Bug className="w-3.5 h-3.5 text-purple-500" />
          <span className="font-medium">Debug</span>
          {metrics.isActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          )}
          <ChevronUp
            className={cn(
              'w-3 h-3 text-muted-foreground transition-transform',
              isDockedExpanded && 'rotate-180'
            )}
          />
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Quick stats */}
        <QuickStat
          icon={<HardDrive className="w-3 h-3 text-blue-400" />}
          label="Heap"
          value={formatBytes(heapUsed)}
          onClick={() => {
            setActiveTab('memory');
            if (!isDockedExpanded) toggleDockedExpanded();
          }}
        />
        <QuickStat
          icon={<Cpu className="w-3 h-3 text-yellow-400" />}
          label="CPU"
          value={`${cpuPercent.toFixed(0)}%`}
          onClick={() => {
            setActiveTab('cpu');
            if (!isDockedExpanded) toggleDockedExpanded();
          }}
        />
        <QuickStat
          icon={<Bot className="w-3 h-3 text-purple-400" />}
          label="Processes"
          value={String(processCount)}
          onClick={() => {
            setActiveTab('processes');
            if (!isDockedExpanded) toggleDockedExpanded();
          }}
        />
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-1">
        {/* Toggle to floating mode */}
        <button
          onClick={togglePanelMode}
          className="p-1 hover:bg-muted rounded transition-colors"
          title="Switch to floating mode"
        >
          <Maximize2 className="w-3 h-3 text-muted-foreground" />
        </button>
        {/* Close debug panel */}
        <button
          onClick={() => setOpen(false)}
          className="p-1 hover:bg-muted hover:text-red-400 rounded transition-colors"
          title="Close debug panel (Ctrl+Shift+D)"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

/**
 * Debug Status Bar Wrapper - Only renders in development mode
 */
export function DebugStatusBarWrapper({ className }: DebugStatusBarProps) {
  const isDev = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEBUG_PANEL === 'true';

  if (!isDev) {
    return null;
  }

  return <DebugStatusBar className={className} />;
}
