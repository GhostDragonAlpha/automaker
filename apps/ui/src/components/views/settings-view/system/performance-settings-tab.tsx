import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertCircle, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function PerformanceSettingsTab() {
  const { performanceSettings, setPerformanceSettings, reset } = useAppStore();

  const handleVirtualizationChange = (checked: boolean) => {
    setPerformanceSettings({ graphVirtualization: checked });
  };

  const handleEdgeCullingChange = (checked: boolean) => {
    setPerformanceSettings({ graphEdgeCulling: checked });
  };

  const handleThresholdChange = (value: number[]) => {
    setPerformanceSettings({ graphEdgeCullingThreshold: value[0] });
  };

  const handleLogLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setPerformanceSettings({ maxLogLines: value });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight">Performance & Memory</h2>
        <p className="text-muted-foreground">
          Manage application performance and memory usage for large projects.
        </p>
      </div>

      <div className="space-y-6">
        {/* Graph Performance Card */}
        <Card>
          <CardHeader>
            <CardTitle>Graph Visualization</CardTitle>
            <CardDescription>
              Optimize rendering performance for large dependency graphs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Virtualization Toggle */}
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="virtualization" className="text-base font-medium">
                  Node Virtualization
                </Label>
                <p className="text-sm text-muted-foreground">
                  Only render nodes currently visible in the viewport. Greatly improves performance
                  for large graphs.
                </p>
              </div>
              <Switch
                id="virtualization"
                checked={performanceSettings.graphVirtualization}
                onCheckedChange={handleVirtualizationChange}
              />
            </div>

            {/* Edge Culling Toggle */}
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="edge-culling" className="text-base font-medium">
                  Edge Culling
                </Label>
                <p className="text-sm text-muted-foreground">
                  Hide connections to off-screen nodes to reduce rendering overhead.
                </p>
              </div>
              <Switch
                id="edge-culling"
                checked={performanceSettings.graphEdgeCulling}
                onCheckedChange={handleEdgeCullingChange}
              />
            </div>

            {/* Edge Threshold Slider */}
            <div className="space-y-4 pt-2">
              <div className="flex justify-between">
                <Label htmlFor="threshold" className="text-base font-medium">
                  Edge Culling Threshold
                </Label>
                <span className="text-sm font-mono text-muted-foreground">
                  {performanceSettings.graphEdgeCullingThreshold} edges
                </span>
              </div>
              <Slider
                id="threshold"
                min={100}
                max={2000}
                step={50}
                value={[performanceSettings.graphEdgeCullingThreshold]}
                onValueChange={handleThresholdChange}
                disabled={!performanceSettings.graphEdgeCulling}
              />
              <p className="text-sm text-muted-foreground">
                Maximum number of edges to render before aggressive culling kicks in. Lower values
                improve FPS.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Memory Protection Card */}
        <Card>
          <CardHeader>
            <CardTitle>Memory Protection</CardTitle>
            <CardDescription>Control memory usage for long-running sessions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Log Limit Input */}
            <div className="space-y-2">
              <Label htmlFor="log-limit" className="text-base font-medium">
                Maximum Log Lines
              </Label>
              <div className="flex items-center gap-4">
                <Input
                  id="log-limit"
                  type="number"
                  min="1000"
                  max="100000"
                  value={performanceSettings.maxLogLines}
                  onChange={handleLogLimitChange}
                  className="max-w-[150px]"
                />
                <span className="text-sm text-muted-foreground">lines</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Limits the number of execution log lines kept in memory per feature. Old logs are
                discarded.
              </p>
            </div>

            <Alert variant="default" className="bg-muted/50 border-none">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Memory Tip</AlertTitle>
              <AlertDescription>
                Running fully locally with Local LLMs (Ollama) typically requires 16GB+ RAM. Using
                cloud providers (Claude, OpenAI) offloads most memory usage.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
