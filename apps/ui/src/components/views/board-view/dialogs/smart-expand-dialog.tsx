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
import { Sparkles, Loader2, GitGraph } from 'lucide-react';
import { toast } from 'sonner';

import { Textarea } from '@/components/ui/textarea';

interface SmartExpandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: Feature | null;
  onExpand: (seedFeature: Feature, options: ExpandOptions) => Promise<void>;
}

export interface ExpandOptions {
  depth: number;
  domainContext: string;
  focusArea: string;
  externalContext?: string;
}

export function SmartExpandDialog({
  open,
  onOpenChange,
  feature,
  onExpand,
}: SmartExpandDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [depth, setDepth] = useState([1]);
  const [domainContext, setDomainContext] = useState('');
  const [focusArea, setFocusArea] = useState('');
  const [externalContext, setExternalContext] = useState('');

  const handleExpand = async () => {
    if (!feature) return;

    try {
      setIsGenerating(true);
      await onExpand(feature, {
        depth: depth[0],
        domainContext: domainContext || 'General Engineering', // Default if empty
        focusArea: focusArea || 'Structural Dependencies', // Default if empty
        externalContext: externalContext,
      });
      onOpenChange(false);
      // Reset state for next time
      setDepth([1]);
      setDomainContext('');
      setFocusArea('');
      setExternalContext('');
    } catch (error) {
      console.error('Expansion failed:', error);
      toast.error('Failed to expand knowledge graph');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!feature) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => !isGenerating && onOpenChange(val)}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-md bg-purple-500/10 text-purple-500">
              <Sparkles className="w-5 h-5" />
            </div>
            <DialogTitle>Smart Expand: {feature.title}</DialogTitle>
          </div>
          <DialogDescription>
            Use AI to crawl for structural dependencies and concepts related to this topic. The
            system will filter for "essence" and discard trivia.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Depth Slider */}
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="depth">Expansion Depth</Label>
              <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                Level {depth[0]}
              </span>
            </div>
            <Slider
              id="depth"
              min={1}
              max={3}
              step={1}
              value={depth}
              onValueChange={setDepth}
              className="py-1"
            />
            <p className="text-[10px] text-muted-foreground">
              Level 1: Direct components. Level 3: Deep nested substructures (slower).
            </p>
          </div>

          {/* Context Inputs */}
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="domain">Domain Context</Label>
              <Input
                id="domain"
                placeholder="e.g. Aerospace Engineering, Software Architecture..."
                value={domainContext}
                onChange={(e) => setDomainContext(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="focus">Focus Area</Label>
              <Input
                id="focus"
                placeholder="e.g. Physical components, Cost centers, Safety systems..."
                value={focusArea}
                onChange={(e) => setFocusArea(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="external">Source Material / Raw Data (The "Hopper")</Label>
              <Textarea
                id="external"
                placeholder="Paste raw text, specs, or download content here to shape the output..."
                value={externalContext}
                onChange={(e) => setExternalContext(e.target.value)}
                className="h-24 font-mono text-xs"
              />
            </div>
          </div>

          {/* Preview Info (Static for now) */}
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground flex items- gap-2">
            <GitGraph className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Estimated generation:{' '}
              <strong>
                {depth[0] * 5} - {depth[0] * 12} new nodes
              </strong>
              .
              <br />
              Source: Internal Knowledge Base + Synthesized Reasoning.
            </p>
          </div>
        </div>

        {/* Preview Info (Static for now) */}
        <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground flex items- gap-2">
          <GitGraph className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Estimated generation:{' '}
            <strong>
              {depth[0] * 5} - {depth[0] * 12} new nodes
            </strong>
            .
            <br />
            Source: Internal Knowledge Base + Synthesized Reasoning.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
          Cancel
        </Button>
        <Button
          onClick={handleExpand}
          disabled={isGenerating}
          className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Crawling...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate Graph
            </>
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
    </Dialog >
  );
}
