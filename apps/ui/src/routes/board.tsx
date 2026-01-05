import { createFileRoute } from '@tanstack/react-router';
import { BoardView } from '@/components/views/board-view';
import { RenderProfiler } from '@/components/debug';

function ProfiledBoardView() {
  return (
    <RenderProfiler name="BoardView">
      <BoardView />
    </RenderProfiler>
  );
}

export const Route = createFileRoute('/board')({
  component: ProfiledBoardView,
});
