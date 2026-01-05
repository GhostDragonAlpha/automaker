/**
 * Debug Docked Panel Component
 *
 * Expandable panel that appears above the status bar when expanded.
 * Contains the full debug interface with tabs.
 */

import { useRef, useCallback, useEffect } from 'react';
import { HardDrive, Cpu, Bot, RefreshCw, Trash2, Play, Pause, GripHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useDebugStore,
  MIN_DOCKED_HEIGHT,
  MAX_DOCKED_HEIGHT_RATIO,
  type DebugTab,
} from '@/store/debug-store';
import { useDebugMetrics } from '@/hooks/use-debug-metrics';
import { useRenderTracking } from '@/hooks/use-render-tracking';
import { MemoryMonitor } from './memory-monitor';
import { CPUMonitor } from './cpu-monitor';
import { ProcessKanban } from './process-kanban';
import { RenderTracker } from './render-tracker';
import { LeakIndicator } from './leak-indicator';
import { useRenderTrackingContext } from './render-profiler';

const TAB_CONFIG: { id: DebugTab; label: string; icon: React.ReactNode }[] = [
  { id: 'memory', label: 'Memory', icon: <HardDrive className="w-3.5 h-3.5" /> },
  { id: 'cpu', label: 'CPU', icon: <Cpu className="w-3.5 h-3.5" /> },
  { id: 'processes', label: 'Processes', icon: <Bot className="w-3.5 h-3.5" /> },
  { id: 'renders', label: 'Renders', icon: <RefreshCw className="w-3.5 h-3.5" /> },
];

interface DebugDockedPanelProps {
  className?: string;
}

export function DebugDockedPanel({ className }: DebugDockedPanelProps) {
  const {
    isOpen,
    isDockedExpanded,
    panelMode,
    dockedHeight,
    activeTab,
    setActiveTab,
    setDockedHeight,
    isResizing,
    setIsResizing,
  } = useDebugStore();

  const metrics = useDebugMetrics();
  const renderTrackingFromContext = useRenderTrackingContext();
  const localRenderTracking = useRenderTracking();
  const renderTracking = renderTrackingFromContext ?? localRenderTracking;

  // Ref for resize handling
  const panelRef = useRef<HTMLDivElement>(null);
  const resizeStartRef = useRef<{ y: number; height: number } | null>(null);

  // Handle resize start (drag from top edge)
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      resizeStartRef.current = {
        y: e.clientY,
        height: dockedHeight,
      };
    },
    [setIsResizing, dockedHeight]
  );

  // Handle resize move
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeStartRef.current) return;

      // Dragging up increases height, dragging down decreases
      const deltaY = resizeStartRef.current.y - e.clientY;
      const newHeight = resizeStartRef.current.height + deltaY;

      // Clamp to min/max bounds
      const maxHeight = window.innerHeight * MAX_DOCKED_HEIGHT_RATIO;
      const clampedHeight = Math.max(MIN_DOCKED_HEIGHT, Math.min(maxHeight, newHeight));

      setDockedHeight(clampedHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeStartRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, setIsResizing, setDockedHeight]);

  // Only show in docked mode when expanded
  if (panelMode !== 'docked' || !isDockedExpanded || !isOpen) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      className={cn(
        'flex flex-col bg-background border-t border-border',
        isResizing && 'select-none',
        className
      )}
      style={{ height: dockedHeight }}
    >
      {/* Resize handle - top edge */}
      <div
        className="h-1 cursor-ns-resize hover:bg-primary/20 transition-colors flex items-center justify-center group"
        onMouseDown={handleResizeStart}
      >
        <GripHorizontal className="w-8 h-3 text-muted-foreground/30 group-hover:text-muted-foreground/60" />
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b bg-muted/30">
        <div className="flex">
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs border-b-2 -mb-px transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary bg-background'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Right side controls */}
        <div className="ml-auto flex items-center gap-1 px-2">
          <button
            onClick={() => (metrics.isActive ? metrics.stop() : metrics.start())}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            title={metrics.isActive ? 'Stop collecting' : 'Start collecting'}
          >
            {metrics.isActive ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={metrics.clearHistory}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Clear history"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={metrics.refresh}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Refresh now"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {activeTab === 'memory' && (
          <div className="space-y-4">
            <MemoryMonitor
              history={metrics.memoryHistory}
              current={metrics.latestSnapshot?.memory.server ?? null}
              trend={metrics.memoryTrend}
            />
            <LeakIndicator trend={metrics.memoryTrend} onForceGC={metrics.forceGC} />
          </div>
        )}

        {activeTab === 'cpu' && (
          <CPUMonitor
            history={metrics.cpuHistory}
            current={metrics.latestSnapshot?.cpu.server ?? null}
            eventLoopLag={metrics.latestSnapshot?.cpu.eventLoopLag}
          />
        )}

        {activeTab === 'processes' && (
          <ProcessKanban
            processes={metrics.processes}
            summary={metrics.processSummary}
            panelWidth={window.innerWidth} // Full width in docked mode
          />
        )}

        {activeTab === 'renders' && (
          <RenderTracker
            summary={renderTracking.summary}
            stats={renderTracking.getAllStats()}
            onClear={renderTracking.clearRecords}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Debug Docked Panel Wrapper - Only renders in development mode
 */
export function DebugDockedPanelWrapper({ className }: DebugDockedPanelProps) {
  const isDev = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEBUG_PANEL === 'true';

  if (!isDev) {
    return null;
  }

  return <DebugDockedPanel className={className} />;
}
