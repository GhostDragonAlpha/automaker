/**
 * RenderProfiler Component
 *
 * A wrapper component that uses React.Profiler to track render performance
 * of wrapped components. Data is collected and displayed in the Debug Panel's
 * Render Tracker tab.
 *
 * Usage:
 * ```tsx
 * <RenderProfiler name="BoardView">
 *   <BoardView />
 * </RenderProfiler>
 * ```
 */

import {
  Profiler,
  createContext,
  useContext,
  type ReactNode,
  type ProfilerOnRenderCallback,
} from 'react';
import { useRenderTracking, type RenderTrackingContextType } from '@/hooks/use-render-tracking';

/**
 * Context for sharing render tracking across the app
 */
const RenderTrackingContext = createContext<RenderTrackingContextType | null>(null);

/**
 * Hook to access render tracking context
 */
export function useRenderTrackingContext(): RenderTrackingContextType | null {
  return useContext(RenderTrackingContext);
}

/**
 * Provider component that enables render tracking throughout the app
 */
export function RenderTrackingProvider({ children }: { children: ReactNode }) {
  const renderTracking = useRenderTracking();

  return (
    <RenderTrackingContext.Provider value={renderTracking}>
      {children}
    </RenderTrackingContext.Provider>
  );
}

/**
 * Props for RenderProfiler component
 */
interface RenderProfilerProps {
  /** Name of the component being profiled (displayed in Render Tracker) */
  name: string;
  /** Children to render and profile */
  children: ReactNode;
}

/**
 * RenderProfiler wraps a component with React.Profiler to track render performance.
 *
 * When the Debug Panel is open and render tracking is enabled, this component
 * records render data including:
 * - Render count
 * - Render duration (actual and base)
 * - Render phase (mount/update/nested-update)
 * - Render frequency (renders per second)
 *
 * The data appears in the Debug Panel's "Renders" tab.
 */
export function RenderProfiler({ name, children }: RenderProfilerProps) {
  const renderTracking = useContext(RenderTrackingContext);

  // If no context available, just render children without profiling
  if (!renderTracking) {
    return <>{children}</>;
  }

  const onRender: ProfilerOnRenderCallback = renderTracking.createProfilerCallback(name);

  return (
    <Profiler id={name} onRender={onRender}>
      {children}
    </Profiler>
  );
}

/**
 * Higher-order component version of RenderProfiler
 *
 * Usage:
 * ```tsx
 * const ProfiledComponent = withRenderProfiler(MyComponent, 'MyComponent');
 * ```
 */
export function withRenderProfiler<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  name: string
): React.FC<P> {
  const ProfiledComponent: React.FC<P> = (props) => (
    <RenderProfiler name={name}>
      <WrappedComponent {...props} />
    </RenderProfiler>
  );

  ProfiledComponent.displayName = `RenderProfiler(${name})`;

  return ProfiledComponent;
}
