import { createFileRoute } from '@tanstack/react-router';
import { WorldModelView } from '@/components/views/world-model-view';

export const Route = createFileRoute('/world-model')({
  component: WorldModelView,
});
