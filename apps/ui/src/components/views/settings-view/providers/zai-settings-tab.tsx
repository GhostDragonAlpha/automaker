import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { getElectronAPI } from '@/lib/electron';
import { createLogger } from '@automaker/utils/logger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ZaiIcon } from '@/components/ui/provider-icon';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { ZAI_MODELS } from '@/components/views/board-view/shared/model-constants';
import { Switch } from '@/components/ui/switch';

const logger = createLogger('ZaiSettings');

export function ZaiSettingsTab() {
  const {
    apiKeys,
    setApiKeys,
    enabledZaiModels,
    zaiDefaultModel,
    setEnabledZaiModels,
    setZaiDefaultModel,
  } = useAppStore();
  const [apiKey, setApiKey] = useState(apiKeys.zai || '');
  const [isSaving, setIsSaving] = useState(false);

  // Sync state with store
  useEffect(() => {
    setApiKey(apiKeys.zai || '');
  }, [apiKeys.zai]);

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) return;
    setIsSaving(true);
    try {
      const api = getElectronAPI();
      if (!api.setup?.storeApiKey) {
        toast.error('Store API not available');
        return;
      }
      const result = await api.setup.storeApiKey('zai', apiKey);
      if (result.success) {
        setApiKeys({ ...apiKeys, zai: apiKey });
        toast.success('Z.AI API key saved successfully!');
      } else {
        toast.error(result.error || 'Failed to save API key');
      }
    } catch (e) {
      toast.error('Failed to save API key');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ZaiIcon className="w-5 h-5" />
              Z.AI Configuration
            </CardTitle>
          </div>
          <CardDescription>
            Configure Z.AI GLM-4 models for advanced reasoning and coding capabilities.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="zai-key">API Key</Label>
            <div className="flex gap-2">
              <Input
                id="zai-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
              />
              <Button onClick={handleSaveApiKey} disabled={isSaving}>
                {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : 'Save'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Required for all Z.AI models.</p>
          </div>
        </CardContent>
      </Card>

      {/* 
          TODO: Add Model Configuration UI here when we want to allow 
          enabling/disabling specific Z.AI models globally.
          For now, defaults are fine as defined in GlobalSettings.
      */}
    </div>
  );
}
