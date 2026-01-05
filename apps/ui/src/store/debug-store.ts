import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Debug Panel Position - coordinates for draggable panel
 */
export interface DebugPanelPosition {
  x: number;
  y: number;
}

/**
 * Debug Panel Size - dimensions for resizable panel
 */
export interface DebugPanelSize {
  width: number;
  height: number;
}

/**
 * Debug Tab - available tabs in the debug panel
 */
export type DebugTab = 'memory' | 'cpu' | 'processes' | 'renders';

/**
 * Debug Panel Mode - floating overlay or docked to bottom
 */
export type DebugPanelMode = 'floating' | 'docked';

/**
 * Debug Panel Preferences - user customization options
 */
export interface DebugPanelPreferences {
  /** Update interval for metrics polling in milliseconds */
  updateInterval: number;
  /** Maximum data points to retain in charts (circular buffer) */
  maxDataPoints: number;
  /** Enable/disable memory monitoring */
  memoryMonitorEnabled: boolean;
  /** Enable/disable CPU monitoring */
  cpuMonitorEnabled: boolean;
  /** Enable/disable process tracking */
  processTrackingEnabled: boolean;
  /** Enable/disable render tracking */
  renderTrackingEnabled: boolean;
  /** Threshold for highlighting high-render components (renders/second) */
  renderAlertThreshold: number;
  /** Show mini chart in collapsed mode */
  showMiniChart: boolean;
}

/**
 * Default preferences for the debug panel
 */
export const DEFAULT_DEBUG_PREFERENCES: DebugPanelPreferences = {
  updateInterval: 1000, // 1 second
  maxDataPoints: 60, // 60 data points = 60 seconds of history
  memoryMonitorEnabled: true,
  cpuMonitorEnabled: true,
  processTrackingEnabled: true,
  renderTrackingEnabled: true,
  renderAlertThreshold: 10, // 10 renders/second triggers alert
  showMiniChart: true,
};

/**
 * Debug Store State
 */
export interface DebugState {
  /** Whether the debug panel is open/visible */
  isOpen: boolean;
  /** Whether the panel is minimized (collapsed view) */
  isMinimized: boolean;
  /** Panel mode: floating overlay or docked to bottom */
  panelMode: DebugPanelMode;
  /** Whether the docked panel detail view is expanded */
  isDockedExpanded: boolean;
  /** Height of the docked panel when expanded */
  dockedHeight: number;
  /** Current position of the panel (for dragging - floating mode only) */
  position: DebugPanelPosition;
  /** Current size of the panel (for resizing - floating mode only) */
  size: DebugPanelSize;
  /** Currently active tab */
  activeTab: DebugTab;
  /** User preferences */
  preferences: DebugPanelPreferences;
  /** Whether the panel is currently being dragged */
  isDragging: boolean;
  /** Whether the panel is currently being resized */
  isResizing: boolean;
}

/**
 * Debug Store Actions
 */
export interface DebugActions {
  // Panel visibility
  /** Toggle the debug panel open/closed */
  togglePanel: () => void;
  /** Set the panel open state directly */
  setOpen: (open: boolean) => void;
  /** Toggle minimized state */
  toggleMinimized: () => void;
  /** Set minimized state directly */
  setMinimized: (minimized: boolean) => void;

  // Panel mode (floating vs docked)
  /** Set panel mode */
  setPanelMode: (mode: DebugPanelMode) => void;
  /** Toggle between floating and docked mode */
  togglePanelMode: () => void;
  /** Toggle docked panel expanded state */
  toggleDockedExpanded: () => void;
  /** Set docked expanded state */
  setDockedExpanded: (expanded: boolean) => void;
  /** Set docked panel height */
  setDockedHeight: (height: number) => void;

  // Position & Size
  /** Update panel position (called during drag) */
  setPosition: (position: DebugPanelPosition) => void;
  /** Update panel size (called during resize) */
  setSize: (size: DebugPanelSize) => void;
  /** Reset position to default (top-right corner) */
  resetPosition: () => void;
  /** Reset size to default */
  resetSize: () => void;

  // Tab management
  /** Set the active tab */
  setActiveTab: (tab: DebugTab) => void;

  // Preferences
  /** Update preferences (partial update supported) */
  setPreferences: (preferences: Partial<DebugPanelPreferences>) => void;
  /** Reset preferences to defaults */
  resetPreferences: () => void;

  // Drag/Resize state (for UI feedback)
  /** Set dragging state */
  setIsDragging: (dragging: boolean) => void;
  /** Set resizing state */
  setIsResizing: (resizing: boolean) => void;

  // Reset
  /** Reset entire store to initial state */
  reset: () => void;
}

/**
 * Default position - top-right corner with offset
 */
const DEFAULT_POSITION: DebugPanelPosition = {
  x: -20, // 20px from right edge (negative = from right)
  y: 20, // 20px from top
};

/**
 * Default size for the debug panel
 */
const DEFAULT_SIZE: DebugPanelSize = {
  width: 450,
  height: 350,
};

/**
 * Minimum size constraints for resize
 */
export const MIN_PANEL_SIZE: DebugPanelSize = {
  width: 350,
  height: 250,
};

/**
 * Maximum size constraints for resize (relative to viewport)
 */
export const MAX_PANEL_SIZE_RATIO = {
  width: 0.9, // 90% of viewport width
  height: 0.9, // 90% of viewport height
};

/**
 * Default height for docked panel when expanded
 */
export const DEFAULT_DOCKED_HEIGHT = 250;

/**
 * Minimum height for docked panel when expanded
 */
export const MIN_DOCKED_HEIGHT = 150;

/**
 * Maximum height ratio for docked panel (relative to viewport)
 */
export const MAX_DOCKED_HEIGHT_RATIO = 0.5; // 50% of viewport height

/**
 * Initial state for the debug store
 */
const initialState: DebugState = {
  isOpen: false,
  isMinimized: false,
  panelMode: 'docked', // Default to docked mode (VS Code style)
  isDockedExpanded: false,
  dockedHeight: DEFAULT_DOCKED_HEIGHT,
  position: DEFAULT_POSITION,
  size: DEFAULT_SIZE,
  activeTab: 'memory',
  preferences: DEFAULT_DEBUG_PREFERENCES,
  isDragging: false,
  isResizing: false,
};

/**
 * Debug Store
 *
 * Manages state for the floating debug panel including:
 * - Panel visibility (open/closed, minimized/expanded)
 * - Position and size (for dragging and resizing)
 * - Active tab selection
 * - User preferences for metrics collection
 *
 * Uses Zustand with persist middleware to save preferences across sessions.
 * Only UI-related state is persisted; runtime metrics data is stored separately.
 */
export const useDebugStore = create<DebugState & DebugActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Panel visibility
      togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),

      setOpen: (open) => set({ isOpen: open }),

      toggleMinimized: () => set((state) => ({ isMinimized: !state.isMinimized })),

      setMinimized: (minimized) => set({ isMinimized: minimized }),

      // Panel mode (floating vs docked)
      setPanelMode: (mode) => set({ panelMode: mode }),

      togglePanelMode: () =>
        set((state) => ({
          panelMode: state.panelMode === 'floating' ? 'docked' : 'floating',
        })),

      toggleDockedExpanded: () => set((state) => ({ isDockedExpanded: !state.isDockedExpanded })),

      setDockedExpanded: (expanded) => set({ isDockedExpanded: expanded }),

      setDockedHeight: (height) => set({ dockedHeight: height }),

      // Position & Size
      setPosition: (position) => set({ position }),

      setSize: (size) => set({ size }),

      resetPosition: () => set({ position: DEFAULT_POSITION }),

      resetSize: () => set({ size: DEFAULT_SIZE }),

      // Tab management
      setActiveTab: (tab) => set({ activeTab: tab }),

      // Preferences
      setPreferences: (preferences) =>
        set((state) => ({
          preferences: { ...state.preferences, ...preferences },
        })),

      resetPreferences: () => set({ preferences: DEFAULT_DEBUG_PREFERENCES }),

      // Drag/Resize state
      setIsDragging: (dragging) => set({ isDragging: dragging }),

      setIsResizing: (resizing) => set({ isResizing: resizing }),

      // Reset
      reset: () => set(initialState),
    }),
    {
      name: 'automaker-debug-panel',
      version: 2, // Bumped for new fields
      partialize: (state) => ({
        // Only persist UI preferences, not runtime state
        position: state.position,
        size: state.size,
        activeTab: state.activeTab,
        preferences: state.preferences,
        isMinimized: state.isMinimized,
        panelMode: state.panelMode,
        dockedHeight: state.dockedHeight,
        // Don't persist: isOpen, isDragging, isResizing, isDockedExpanded (runtime state)
      }),
    }
  )
);

/**
 * Selector hooks for common patterns
 */
export const selectDebugPanelOpen = (state: DebugState) => state.isOpen;
export const selectDebugPanelMinimized = (state: DebugState) => state.isMinimized;
export const selectDebugPanelMode = (state: DebugState) => state.panelMode;
export const selectDebugDockedExpanded = (state: DebugState) => state.isDockedExpanded;
export const selectDebugDockedHeight = (state: DebugState) => state.dockedHeight;
export const selectDebugPosition = (state: DebugState) => state.position;
export const selectDebugSize = (state: DebugState) => state.size;
export const selectDebugActiveTab = (state: DebugState) => state.activeTab;
export const selectDebugPreferences = (state: DebugState) => state.preferences;
