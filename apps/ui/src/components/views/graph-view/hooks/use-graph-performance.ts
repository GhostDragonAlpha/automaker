/**
 * Graph Performance Optimization Hook
 *
 * Provides performance optimizations for large graphs in React Flow:
 * - Node virtualization (only render visible nodes)
 * - Edge culling (hide edges for offscreen nodes)
 * - Debounced updates for rapid changes
 * - Render batching
 *
 * Usage:
 *   const { optimizedNodes, optimizedEdges } = useGraphPerformance(nodes, edges, viewport);
 */

import { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { Node, Edge, Viewport, useReactFlow } from '@xyflow/react';
import { useDebounceValue } from 'usehooks-ts';

// Configuration
const VIRTUALIZATION_ENABLED = true;
const VIEWPORT_PADDING = 200; // Extra pixels to render outside viewport
const EDGE_CULLING_THRESHOLD = 500; // Max edges to render, cull rest
const BATCH_UPDATE_DELAY_MS = 16; // ~60fps

interface ViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Calculate viewport bounds in graph coordinates
 */
function getViewportBounds(
  viewport: Viewport,
  containerWidth: number,
  containerHeight: number,
  padding: number = VIEWPORT_PADDING
): ViewportBounds {
  const scale = viewport.zoom;
  const minX = (-viewport.x - padding) / scale;
  const maxX = (-viewport.x + containerWidth + padding) / scale;
  const minY = (-viewport.y - padding) / scale;
  const maxY = (-viewport.y + containerHeight + padding) / scale;

  return { minX, maxX, minY, maxY };
}

/**
 * Check if a node is within viewport bounds
 */
function isNodeInViewport<T>(
  node: Node<T>,
  bounds: ViewportBounds,
  nodeWidth: number = 200,
  nodeHeight: number = 100
): boolean {
  const x = node.position.x;
  const y = node.position.y;

  return (
    x + nodeWidth >= bounds.minX &&
    x <= bounds.maxX &&
    y + nodeHeight >= bounds.minY &&
    y <= bounds.maxY
  );
}

/**
 * Hook for graph performance optimizations
 */
export function useGraphPerformance<NodeData = unknown, EdgeData = unknown>(
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[],
  options: {
    containerWidth?: number;
    containerHeight?: number;
    enableVirtualization?: boolean;
    enableEdgeCulling?: boolean;
  } = {}
) {
  const {
    containerWidth = 1200,
    containerHeight = 800,
    enableVirtualization = VIRTUALIZATION_ENABLED,
    enableEdgeCulling = true,
  } = options;

  const reactFlow = useReactFlow();
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });

  // Track viewport changes with debounce for performance
  const [debouncedViewport] = useDebounceValue(viewport, BATCH_UPDATE_DELAY_MS);

  // Update viewport on move
  useEffect(() => {
    const onViewportChange = () => {
      const vp = reactFlow.getViewport();
      setViewport(vp);
    };

    // Initial viewport
    onViewportChange();

    // React Flow doesn't expose viewport change event directly
    // We use a polling approach with requestAnimationFrame for smooth updates
    let rafId: number;
    const pollViewport = () => {
      onViewportChange();
      rafId = requestAnimationFrame(pollViewport);
    };

    // Only poll when virtualization is enabled (otherwise not needed)
    if (enableVirtualization) {
      rafId = requestAnimationFrame(pollViewport);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [reactFlow, enableVirtualization]);

  // Calculate visible node IDs based on viewport
  const visibleNodeIds = useMemo(() => {
    if (!enableVirtualization) {
      return new Set(nodes.map((n) => n.id));
    }

    const bounds = getViewportBounds(debouncedViewport, containerWidth, containerHeight);
    const visible = new Set<string>();

    for (const node of nodes) {
      if (isNodeInViewport(node, bounds)) {
        visible.add(node.id);
      }
    }

    return visible;
  }, [nodes, debouncedViewport, containerWidth, containerHeight, enableVirtualization]);

  // Optimized nodes - mark offscreen nodes as hidden
  const optimizedNodes = useMemo(() => {
    if (!enableVirtualization) {
      return nodes;
    }

    return nodes.map((node) => ({
      ...node,
      hidden: !visibleNodeIds.has(node.id),
    }));
  }, [nodes, visibleNodeIds, enableVirtualization]);

  // Optimized edges - cull edges for hidden nodes
  const optimizedEdges = useMemo(() => {
    if (!enableEdgeCulling) {
      return edges;
    }

    // First filter: only show edges where at least one node is visible
    let filteredEdges = edges.filter(
      (edge) => visibleNodeIds.has(edge.source) || visibleNodeIds.has(edge.target)
    );

    // Second filter: limit total edge count for performance
    if (filteredEdges.length > EDGE_CULLING_THRESHOLD) {
      // Prioritize edges where both nodes are visible
      const priorityEdges = filteredEdges.filter(
        (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
      );

      const remainingSlots = EDGE_CULLING_THRESHOLD - priorityEdges.length;
      const otherEdges = filteredEdges
        .filter((edge) => !(visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)))
        .slice(0, Math.max(0, remainingSlots));

      filteredEdges = [...priorityEdges, ...otherEdges];
    }

    return filteredEdges;
  }, [edges, visibleNodeIds, enableEdgeCulling]);

  // Statistics for debugging
  const stats = useMemo(
    () => ({
      totalNodes: nodes.length,
      visibleNodes: visibleNodeIds.size,
      totalEdges: edges.length,
      visibleEdges: optimizedEdges.length,
      virtualizationActive: enableVirtualization && nodes.length > 50,
      edgeCullingActive: enableEdgeCulling && edges.length > EDGE_CULLING_THRESHOLD,
    }),
    [
      nodes.length,
      visibleNodeIds.size,
      edges.length,
      optimizedEdges.length,
      enableVirtualization,
      enableEdgeCulling,
    ]
  );

  return {
    optimizedNodes,
    optimizedEdges,
    visibleNodeIds,
    stats,
    viewport: debouncedViewport,
  };
}

/**
 * Hook for batched node updates
 * Collects rapid node updates and applies them in batches for performance
 */
export function useBatchedNodeUpdates<T>(
  onNodesChange: (changes: T[]) => void,
  batchDelay: number = BATCH_UPDATE_DELAY_MS
) {
  const pendingChanges = useRef<T[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const batchedOnNodesChange = useCallback(
    (changes: T[]) => {
      pendingChanges.current.push(...changes);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        if (pendingChanges.current.length > 0) {
          onNodesChange(pendingChanges.current);
          pendingChanges.current = [];
        }
        timeoutRef.current = null;
      }, batchDelay);
    },
    [onNodesChange, batchDelay]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return batchedOnNodesChange;
}

/**
 * Hook to measure actual frame rate
 */
export function useFrameRateMonitor() {
  const [fps, setFps] = useState(60);
  const frameTimesRef = useRef<number[]>([]);

  useEffect(() => {
    let rafId: number;
    let lastTime = performance.now();

    const measureFrame = () => {
      const now = performance.now();
      const delta = now - lastTime;
      lastTime = now;

      frameTimesRef.current.push(delta);

      // Keep last 60 frame times
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift();
      }

      // Calculate FPS every 10 frames
      if (frameTimesRef.current.length % 10 === 0) {
        const avgFrameTime =
          frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
        setFps(Math.round(1000 / avgFrameTime));
      }

      rafId = requestAnimationFrame(measureFrame);
    };

    rafId = requestAnimationFrame(measureFrame);

    return () => cancelAnimationFrame(rafId);
  }, []);

  return fps;
}
