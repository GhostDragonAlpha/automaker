import { createFileRoute, redirect } from '@tanstack/react-router';
import { useAppStore } from '@/store/app-store';

/**
 * World Model Route - Redirects to Kanban Board with Graph View enabled
 *
 * The graph view in the board (toggled by the three-box icon) provides
 * the same functionality as the old World Model view, so we redirect there.
 */
export const Route = createFileRoute('/world-model')({
  beforeLoad: () => {
    // Set board view mode to 'graph' before navigating
    const store = useAppStore.getState();
    store.setBoardViewMode('graph');

    // Redirect to the main board route
    throw redirect({ to: '/' });
  },
  component: () => null, // Never rendered due to redirect
});
