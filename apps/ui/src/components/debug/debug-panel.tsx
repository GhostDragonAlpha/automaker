/**
 * Debug Panel Component
 *
 * Main container for the floating debug overlay with:
 * - Draggable positioning
 * - Resizable panels
 * - Tab-based navigation
 * - Minimize/maximize states
 */

import { useRef, useCallback, useEffect } from 'react';
import {
  Bug,
  X,
  Minimize2,
  Maximize2,
  HardDrive,
  Cpu,
  Bot,
  RefreshCw,
  Trash2,
  Play,
  Pause,
  GripHorizontal,
  PanelBottom,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useDebugStore,
  MIN_PANEL_SIZE,
  MAX_PANEL_SIZE_RATIO,
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
  { id: 'memory', label: 'Memory', icon: <HardDrive className="w-4 h-4" /> },
  { id: 'cpu', label: 'CPU', icon: <Cpu className="w-4 h-4" /> },
  { id: 'processes', label: 'Processes', icon: <Bot className="w-4 h-4" /> },
  { id: 'renders', label: 'Renders', icon: <RefreshCw className="w-4 h-4" /> },
];

interface DebugPanelProps {
  className?: string;
}

export function DebugPanel({ className }: DebugPanelProps) {
  const {
    isOpen,
    isMinimized,
    position,
    size,
    activeTab,
    setOpen,
    toggleMinimized,
    setPosition,
    setSize,
    togglePanelMode,
    setActiveTab,
    isDragging,
    setIsDragging,
    isResizing,
    setIsResizing,
  } = useDebugStore();

  const metrics = useDebugMetrics();
  const renderTrackingFromContext = useRenderTrackingContext();
  const localRenderTracking = useRenderTracking();
  // Use context if available (when wrapped in RenderTrackingProvider), otherwise use local
  const renderTracking = renderTrackingFromContext ?? localRenderTracking;

  // Refs for drag handling
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(
    null
  );

  // Calculate actual position (handle negative values for right-edge positioning)
  const actualPosition = useCallback(() => {
    if (!panelRef.current) return { x: position.x, y: position.y };

    const rect = panelRef.current.getBoundingClientRect();
    const windowWidth = window.innerWidth;

    // If x is negative, position from right edge
    const x = position.x < 0 ? windowWidth + position.x - rect.width : position.x;

    return { x, y: position.y };
  }, [position]);

  // Handle drag start
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;

      e.preventDefault();
      setIsDragging(true);

      const rect = panelRef.current?.getBoundingClientRect();
      if (!rect) return;

      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        posX: rect.left,
        posY: rect.top,
      };
    },
    [setIsDragging]
  );

  // Handle resize start
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);

      resizeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        width: size.width,
        height: size.height,
      };
    },
    [setIsResizing, size]
  );

  // Handle drag move
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current || !panelRef.current) return;

      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;

      const newX = dragStartRef.current.posX + deltaX;
      const newY = dragStartRef.current.posY + deltaY;

      // Clamp to window bounds
      const rect = panelRef.current.getBoundingClientRect();
      const clampedX = Math.max(0, Math.min(window.innerWidth - rect.width, newX));
      const clampedY = Math.max(0, Math.min(window.innerHeight - rect.height, newY));

      setPosition({ x: clampedX, y: clampedY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, setIsDragging, setPosition]);

  // Handle resize move
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeStartRef.current) return;

      const deltaX = e.clientX - resizeStartRef.current.x;
      const deltaY = e.clientY - resizeStartRef.current.y;

      const newWidth = resizeStartRef.current.width + deltaX;
      const newHeight = resizeStartRef.current.height + deltaY;

      // Clamp to min/max bounds
      const maxWidth = window.innerWidth * MAX_PANEL_SIZE_RATIO.width;
      const maxHeight = window.innerHeight * MAX_PANEL_SIZE_RATIO.height;

      const clampedWidth = Math.max(MIN_PANEL_SIZE.width, Math.min(maxWidth, newWidth));
      const clampedHeight = Math.max(MIN_PANEL_SIZE.height, Math.min(maxHeight, newHeight));

      setSize({ width: clampedWidth, height: clampedHeight });
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
  }, [isResizing, setIsResizing, setSize]);

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  const pos = actualPosition();

  return (
    <div
      ref={panelRef}
      className={cn(
        'fixed z-[9999] bg-background/95 backdrop-blur-sm border rounded-lg shadow-xl',
        'flex flex-col overflow-hidden',
        isDragging && 'cursor-grabbing select-none',
        isResizing && 'cursor-nwse-resize select-none',
        className
      )}
      style={{
        left: pos.x,
        top: pos.y,
        width: isMinimized ? 200 : size.width,
        height: isMinimized ? 'auto' : size.height,
      }}
    >
      {/* Header - Draggable */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-2 border-b bg-muted/50',
          'cursor-grab select-none',
          isDragging && 'cursor-grabbing'
        )}
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-medium">Debug</span>
          {metrics.isActive && (
            <span
              className="w-2 h-2 rounded-full bg-green-500 animate-pulse"
              title="Collecting metrics"
            />
          )}
          {/* Dock to bottom */}
          <button
            onClick={togglePanelMode}
            className="p-1 rounded hover:bg-muted"
            title="Dock to bottom"
          >
            <PanelBottom className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          {/* Toggle collection */}
          <button
            onClick={() => (metrics.isActive ? metrics.stop() : metrics.start())}
            className="p-1 rounded hover:bg-muted"
            title={metrics.isActive ? 'Stop collecting' : 'Start collecting'}
          >
            {metrics.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          {/* Minimize */}
          <button
            onClick={toggleMinimized}
            className="p-1 rounded hover:bg-muted"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          {/* Close */}
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded hover:bg-muted hover:text-red-400"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Minimized state - just show quick stats */}
      {isMinimized ? (
        <div className="p-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Heap:</span>
            <span>
              {metrics.latestSnapshot?.memory.server
                ? `${(metrics.latestSnapshot.memory.server.heapUsed / 1024 / 1024).toFixed(0)}MB`
                : '-'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">CPU:</span>
            <span>
              {metrics.latestSnapshot?.cpu.server
                ? `${metrics.latestSnapshot.cpu.server.percentage.toFixed(0)}%`
                : '-'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Processes:</span>
            <span>{metrics.processSummary?.running ?? 0}</span>
          </div>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex border-b">
            {TAB_CONFIG.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-xs border-b-2 -mb-px transition-colors',
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
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
                panelWidth={size.width}
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

          {/* Footer with actions */}
          <div className="flex items-center justify-between px-3 py-1.5 border-t bg-muted/30 text-xs text-muted-foreground">
            <span>
              {metrics.isLoading
                ? 'Loading...'
                : metrics.error
                  ? `Error: ${metrics.error}`
                  : `Updated ${new Date().toLocaleTimeString()}`}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={metrics.clearHistory}
                className="flex items-center gap-1 hover:text-foreground"
                title="Clear history"
              >
                <Trash2 className="w-3 h-3" />
              </button>
              <button
                onClick={metrics.refresh}
                className="flex items-center gap-1 hover:text-foreground"
                title="Refresh now"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Resize handle - bottom right corner */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize flex items-center justify-center hover:bg-muted/50 rounded-tl"
            onMouseDown={handleResizeStart}
            title="Drag to resize"
          >
            <GripHorizontal className="w-3 h-3 rotate-[-45deg] text-muted-foreground/50" />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Debug Panel Wrapper - Only renders in development mode and floating mode
 */
export function DebugPanelWrapper() {
  const panelMode = useDebugStore((s) => s.panelMode);

  // Only show in development mode
  const isDev = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEBUG_PANEL === 'true';

  // Only show in floating mode
  if (!isDev || panelMode !== 'floating') {
    return null;
  }

  return <DebugPanel />;
}
