import type { Request, Response } from 'express';
import { setApiKey, persistApiKeyToEnv, getErrorMessage, logError } from '../common.js';
import { createLogger } from '@automaker/utils';
import type { SettingsService } from '../../../../services/settings-service.js';

const logger = createLogger('Setup');

export function createStoreApiKeyHandler(settingsService?: SettingsService) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { provider, apiKey, isOauth } = req.body as {
        provider: string;
        apiKey: string;
        isOauth?: boolean;
      };

      if (!provider || !apiKey) {
        res.status(400).json({ success: false, error: 'provider and apiKey required' });
        return;
      }

      setApiKey(provider, apiKey);

      // 1. Sync to SettingsService (Disk Persistence - settings.json)
      // This ensures the main app (UI hydration) sees the new key immediately.
      if (settingsService) {
        // Map provider names to keys in Credentials object
        // 'anthropic_oauth_token' -> 'anthropic'
        const keyMap: Record<string, 'anthropic' | 'zai' | 'openai' | 'google'> = {
          anthropic: 'anthropic',
          anthropic_oauth_token: 'anthropic',
          zai: 'zai',
          openai: 'openai',
          google: 'google',
        };

        const mappedProvider = keyMap[provider];

        if (mappedProvider) {
          await settingsService.updateCredentials({
            apiKeys: {
              [mappedProvider]: apiKey,
            },
          });
          logger.info(`[Setup] Synced ${provider} key to SettingsService`);
        }
      }

      // 2. Persist to .env (Legacy / Backup)
      if (provider === 'anthropic' || provider === 'anthropic_oauth_token') {
        // Both API key and OAuth token use ANTHROPIC_API_KEY
        process.env.ANTHROPIC_API_KEY = apiKey;
        await persistApiKeyToEnv('ANTHROPIC_API_KEY', apiKey);
        logger.info('[Setup] Stored API key as ANTHROPIC_API_KEY');
      } else if (provider === 'zai') {
        process.env.ZAI_API_KEY = apiKey;
        await persistApiKeyToEnv('ZAI_API_KEY', apiKey);
        logger.info('[Setup] Stored API key as ZAI_API_KEY');
      } else if (provider === 'openai') {
        process.env.OPENAI_API_KEY = apiKey;
        await persistApiKeyToEnv('OPENAI_API_KEY', apiKey);
        logger.info('[Setup] Stored API key as OPENAI_API_KEY');
      } else if (provider === 'google') {
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;
        await persistApiKeyToEnv('GOOGLE_GENERATIVE_AI_API_KEY', apiKey);
        logger.info('[Setup] Stored API key as GOOGLE_GENERATIVE_AI_API_KEY');
      } else {
        res.status(400).json({
          success: false,
          error: `Unsupported provider: ${provider}. Supported: anthropic, zai, openai, google.`,
        });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      logError(error, 'Store API key failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
