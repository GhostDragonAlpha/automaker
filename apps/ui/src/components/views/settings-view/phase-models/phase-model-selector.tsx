import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import type { AgentModel, CursorModelId } from '@automaker/types';
import { CLAUDE_MODELS, CURSOR_MODELS } from '@/components/views/board-view/shared/model-constants';

interface PhaseModelSelectorProps {
  label: string;
  description: string;
  value: AgentModel | CursorModelId;
  onChange: (model: AgentModel | CursorModelId) => void;
}

export function PhaseModelSelector({
  label,
  description,
  value,
  onChange,
}: PhaseModelSelectorProps) {
  const { enabledCursorModels } = useAppStore();

  // Filter Cursor models to only show enabled ones
  const availableCursorModels = CURSOR_MODELS.filter((model) => {
    const cursorId = model.id.replace('cursor-', '') as CursorModelId;
    return enabledCursorModels.includes(cursorId);
  });

  // Check if current value is a Claude model or Cursor model
  const isClaudeModel = (v: string) => ['haiku', 'sonnet', 'opus'].includes(v);

  return (
    <div
      className={cn(
        'p-4 rounded-xl',
        'bg-accent/20 border border-border/30',
        'hover:bg-accent/30 transition-colors'
      )}
    >
      <div className="flex flex-col gap-3">
        {/* Label and Description */}
        <div>
          <h4 className="text-sm font-medium text-foreground">{label}</h4>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>

        {/* Model Selection */}
        <div className="flex flex-wrap gap-2">
          {/* Claude Models */}
          {CLAUDE_MODELS.map((model) => {
            const isActive = value === model.id;
            return (
              <button
                key={model.id}
                onClick={() => onChange(model.id as AgentModel)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium',
                  'transition-all duration-150',
                  isActive
                    ? ['bg-brand-500/20 text-brand-500', 'border border-brand-500/40', 'shadow-sm']
                    : [
                        'bg-accent/50 text-muted-foreground',
                        'border border-transparent',
                        'hover:bg-accent hover:text-foreground',
                      ]
                )}
              >
                {model.label}
              </button>
            );
          })}

          {/* Divider if there are Cursor models */}
          {availableCursorModels.length > 0 && (
            <div className="w-px h-6 bg-border/50 mx-1 self-center" />
          )}

          {/* Cursor Models */}
          {availableCursorModels.map((model) => {
            const cursorId = model.id.replace('cursor-', '') as CursorModelId;
            const isActive = value === cursorId;
            return (
              <button
                key={model.id}
                onClick={() => onChange(cursorId)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium',
                  'transition-all duration-150',
                  isActive
                    ? [
                        'bg-purple-500/20 text-purple-400',
                        'border border-purple-500/40',
                        'shadow-sm',
                      ]
                    : [
                        'bg-accent/50 text-muted-foreground',
                        'border border-transparent',
                        'hover:bg-accent hover:text-foreground',
                      ]
                )}
                title={model.description}
              >
                {model.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
