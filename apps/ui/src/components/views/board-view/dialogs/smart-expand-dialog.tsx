import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Feature } from '@/store/app-store';
import { Sparkles, Loader2, GitGraph, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { getHttpApiClient } from '@/lib/http-api-client';
import { AnalysisSuggestion } from '@/lib/electron';

interface SmartExpandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: Feature | null;
  projectPath?: string;
  onExpand?: (seedFeature: Feature, options: any) => Promise<void>; // Legacy prop, kept for compatibility
  onFeaturesCreated?: () => void;
}

export function SmartExpandDialog({
  open,
  onOpenChange,
  feature,
  projectPath,
  onFeaturesCreated,
}: SmartExpandDialogProps) {
  const [step, setStep] = useState<'configure' | 'preview'>('configure');
  const [isGenerating, setIsGenerating] = useState(false);

  // Configuration State
  const [count, setCount] = useState([5]);
  const [domainContext, setDomainContext] = useState('');
  const [focusArea, setFocusArea] = useState('');
  const [externalContext, setExternalContext] = useState('');
  const [subspecTemplate, setSubspecTemplate] = useState('');

  // Preview State
  const [generatedTasks, setGeneratedTasks] = useState<AnalysisSuggestion[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  const handleGenerate = async () => {
    if (!feature || !projectPath) {
      toast.error('Missing project context');
      return;
    }

    try {
      setIsGenerating(true);
      const api = getHttpApiClient();

      const result = await api.ideation.generateSubtasks(
        projectPath,
        feature.description || feature.title || '',
        count[0],
        {
          domainContext,
          focusArea,
          externalContext,
          subspecTemplate: subspecTemplate || undefined,
        }
      );

      if (result.success && result.suggestions) {
        setGeneratedTasks(result.suggestions);
        // Auto-select all by default
        setSelectedTaskIds(new Set(result.suggestions.map((s) => s.id)));
        setStep('preview');
      } else {
        toast.error(result.error || 'Failed to generate subtasks');
      }
    } catch (error) {
      console.error('Generation failed:', error);
      toast.error('Failed to generate subtasks');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmSpawn = async () => {
    if (!projectPath || !feature) return;

    try {
      setIsGenerating(true);
      const api = getHttpApiClient();
      const tasksToCreate = generatedTasks.filter((t) => selectedTaskIds.has(t.id));

      if (tasksToCreate.length === 0) {
        toast.error('No tasks selected');
        setIsGenerating(false);
        return;
      }

      let createdCount = 0;

      // Create features sequentially or in parallel? Parallel is faster but might hit rate limits/locks.
      // Let's do sequential for safety and correct ordering if needed.
      for (const task of tasksToCreate) {
        const result = await api.features.create(projectPath, {
          title: task.title,
          description: task.description,
          category: feature.category, // Inherit category from parent
          priority: task.priority || 3, // Default to low priority
          status: 'backlog', // Correct status
          dependencies: [feature.id], // Link to parent as dependency!
          branchName: feature.branchName, // Inherit branch from parent
        } as any);

        if (result.success) {
          createdCount++;
        } else {
          console.error('Failed to create subtask:', task.title, result.error);
        }
      }

      toast.success(`Successfully spawned ${createdCount} subtasks`);
      onOpenChange(false);
      onFeaturesCreated?.();

      // Reset state
      setStep('configure');
      setGeneratedTasks([]);
      setExternalContext('');
    } catch (error) {
      console.error('Spawn failed:', error);
      toast.error('Failed to create features');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleTaskSelection = (id: string) => {
    const newSet = new Set(selectedTaskIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedTaskIds(newSet);
  };

  if (!feature) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => !isGenerating && onOpenChange(val)}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-md bg-purple-500/10 text-purple-500">
              <Sparkles className="w-5 h-5" />
            </div>
            <DialogTitle>
              {step === 'configure' ? `Smart Expand: ${feature.title}` : 'Select Subtasks to Spawn'}
            </DialogTitle>
          </div>
          <DialogDescription>
            {step === 'configure'
              ? 'Use AI to break down this feature into a network of actionable subtasks.'
              : 'Review the generated subtasks. Uncheck any you do not want to create.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'configure' ? (
          <div className="grid gap-6 py-4">
            {/* Count Slider */}
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="count">Number of Subtasks</Label>
                <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                  {count[0]} items
                </span>
              </div>
              <Slider
                id="count"
                min={1}
                max={20}
                step={1}
                value={count}
                onValueChange={setCount}
                className="py-1"
              />
            </div>

            {/* Context Inputs */}
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="domain">Domain Context</Label>
                <Input
                  id="domain"
                  placeholder="e.g. Backend Architecture, UI Design..."
                  value={domainContext}
                  onChange={(e) => setDomainContext(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="focus">Focus Area</Label>
                <Input
                  id="focus"
                  placeholder="e.g. Security, Performance, Accessibility..."
                  value={focusArea}
                  onChange={(e) => setFocusArea(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="external">Source Material / Raw Data</Label>
                <Textarea
                  id="external"
                  placeholder="Paste requirements, specs, or detailed goal description..."
                  value={externalContext}
                  onChange={(e) => setExternalContext(e.target.value)}
                  className="h-24 font-mono text-xs"
                />
              </div>
            </div>

            {!projectPath && (
              <div className="flex items-center gap-2 p-3 text-amber-600 bg-amber-50 rounded-md text-xs">
                <AlertCircle className="w-4 h-4" />
                Project path not found. Cannot generate tasks.
              </div>
            )}
          </div>
        ) : (
          <div className="py-4 space-y-2">
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="text-xs text-muted-foreground">{selectedTaskIds.size} selected</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => {
                  if (selectedTaskIds.size === generatedTasks.length) {
                    setSelectedTaskIds(new Set());
                  } else {
                    setSelectedTaskIds(new Set(generatedTasks.map((t) => t.id)));
                  }
                }}
              >
                {selectedTaskIds.size === generatedTasks.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {generatedTasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    selectedTaskIds.has(task.id)
                      ? 'bg-purple-50/50 border-purple-200 dark:border-purple-800'
                      : 'bg-muted/20 border-transparent hover:border-border'
                  }`}
                >
                  <Checkbox
                    id={task.id}
                    checked={selectedTaskIds.has(task.id)}
                    onCheckedChange={() => toggleTaskSelection(task.id)}
                    className="mt-1"
                  />
                  <div className="grid gap-1.5 flex-1">
                    <Label
                      htmlFor={task.id}
                      className="font-medium leading-none cursor-pointer flex items-center justify-between"
                    >
                      {task.title}
                      <span
                        className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${
                          task.priority === 'high'
                            ? 'bg-red-100 text-red-700'
                            : task.priority === 'low'
                              ? 'bg-slate-100 text-slate-700'
                              : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {task.priority || 'medium'}
                      </span>
                    </Label>
                    <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 'preview' && (
            <Button variant="ghost" onClick={() => setStep('configure')} disabled={isGenerating}>
              Back to Config
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            Cancel
          </Button>

          {step === 'configure' ? (
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !projectPath}
              className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Plan...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Subtasks
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleConfirmSpawn}
              disabled={isGenerating || selectedTaskIds.size === 0}
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Spawning...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Spawn {selectedTaskIds.size} Tasks
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
