/**
 * Debug Components
 *
 * Exports all debug-related UI components for the debug panel.
 * Supports both floating overlay and docked (VS Code-style) modes.
 */

// Floating mode panel
export { DebugPanel, DebugPanelWrapper } from './debug-panel';

// Docked mode components (VS Code-style)
export { DebugStatusBar, DebugStatusBarWrapper } from './debug-status-bar';
export { DebugDockedPanel, DebugDockedPanelWrapper } from './debug-docked-panel';

// Shared components
export { MemoryMonitor } from './memory-monitor';
export { CPUMonitor } from './cpu-monitor';
export { ProcessKanban } from './process-kanban';
export { RenderTracker } from './render-tracker';
export { LeakIndicator } from './leak-indicator';
export {
  RenderProfiler,
  RenderTrackingProvider,
  useRenderTrackingContext,
  withRenderProfiler,
} from './render-profiler';
