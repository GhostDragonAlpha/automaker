/**
 * Z.AI Provider - Library Implementation
 *
 * Executes queries using Z.AI (GLM) via OpenAI SDK.
 * Fully modular implementation for use in AutoMaker ecosystem.
 */
import OpenAI from 'openai';
import { createLogger } from '@automaker/utils';
import jwt from 'jsonwebtoken';
import {
  BaseProvider,
  ProviderMessage,
  ExecuteOptions,
  ModelDefinition,
  InstallationStatus,
} from '@automaker/providers-core';
import { validateBareModelId } from '@automaker/types';

// We need to define ZaiTools or import it if it exists in libs.
// For now, assuming basic ZaiTools stub or we'll need to port that too.
// Given the server file imported './zai-tools.js', we might need to copy that logic or simplify.
// To avoid compilation errors, I'll inline a basic tools interface or check if I can import it.
// Checking file listing earlier: zai-query-service.ts exists, no zai-tools.ts in libs/provider-zai/src.
// I will need to handle tools carefully. For this step, I'll assume text-only or stub tools to get it compiling,
// or port tools logic if critical.
// Note: User emphasizes "separate versions... parallel models", so core executing logic is key.

const logger = createLogger('ZaiProvider');

// Z.AI API configuration
const ZAI_API_URL = 'https://api.z.ai/api/coding/paas/v4';

// Z.AI Models definitions
export const ZAI_MODELS_DEF = [
  {
    id: 'glm-4.7',
    name: 'GLM 4.7',
    modelString: 'GLM-4.7',
    provider: 'zai',
    description: 'New Flagship - Best reasoning & coding',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsVision: true,
    supportsTools: true,
    tier: 'premium',
    default: true,
  },
  {
    id: 'glm-4-plus',
    name: 'GLM 4 Plus',
    modelString: 'GLM-4-Plus',
    provider: 'zai',
    description: 'High performance general model',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsVision: true,
    supportsTools: true,
    tier: 'premium',
  },
  {
    id: 'glm-4.6',
    name: 'GLM 4.6 (Agentic)',
    modelString: 'GLM-4.6',
    provider: 'zai',
    description: 'Optimized for agentic workflows',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsVision: true,
    supportsTools: true,
    tier: 'premium',
  },
  {
    id: 'glm-4.5-flash',
    name: 'GLM 4.5 Flash',
    modelString: 'GLM-4.5-Flash',
    provider: 'zai',
    description: 'Fast lightweight model',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsTools: true,
    tier: 'basic',
  },
] as const;

export class ZaiProvider extends BaseProvider {
  private client: OpenAI | null = null;

  // Tools handling would go here. For library version, we might need a shared Tools interface.
  // Simplifying for now to ensure clean compilation of the core provider structure.

  constructor() {
    super();
    this.initializeClient();
  }

  private initializeClient() {
    // In library context, we might rely on constructor args or env vars
    const apiKey = process.env.ZAI_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL: ZAI_API_URL,
      });
    }
  }

  private generateToken(apiKey: string): string {
    try {
      const [id, secret] = apiKey.split('.');
      if (!id || !secret) return apiKey;

      const payload = {
        api_key: id,
        exp: Date.now() + 3600 * 1000,
        timestamp: Date.now(),
      };

      const token = jwt.sign(payload, secret, {
        algorithm: 'HS256',
        header: {
          alg: 'HS256',
          sign_type: 'SIGN',
        },
      } as any);

      return token;
    } catch (error) {
      logger.error('Failed to generate Z.AI JWT token', error);
      return apiKey;
    }
  }

  getName(): string {
    return 'zai';
  }

  /**
   * Execute a query using Z.AI (OpenAI compatible)
   */
  async *executeQuery(options: ExecuteOptions): AsyncGenerator<ProviderMessage> {
    if (!this.client) {
      this.initializeClient();
      if (!this.client) {
        throw new Error('Z.AI API key not configured. Please set ZAI_API_KEY.');
      }
    }

    const apiKey = process.env.ZAI_API_KEY || '';
    if (apiKey.includes('.')) {
      const token = this.generateToken(apiKey);
      this.client = new OpenAI({
        apiKey: token,
        baseURL: ZAI_API_URL,
      });
    }

    validateBareModelId(options.model, 'ZaiProvider');

    const { prompt, model, systemPrompt, maxTurns = 20 } = options;

    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: typeof systemPrompt === 'string' ? systemPrompt : JSON.stringify(systemPrompt),
      });
    }

    if (typeof prompt === 'string') {
      messages.push({ role: 'user', content: prompt });
    } else if (Array.isArray(prompt)) {
      const textParts = prompt.filter((p) => typeof p === 'string').join('\n');
      messages.push({ role: 'user', content: textParts });
    }

    // Basic loop without tools for now (porting tools is a bigger task requiring shared types)
    // If users needs tools in library, we'd need to extract ZaiTools to a shared location.
    // For "fixing model defaults" and "parallel configs", just getting the provider logic accessible is step 1.

    try {
      const modelDef = ZAI_MODELS_DEF.find((m) => m.id === model);
      const apiModel = modelDef ? modelDef.modelString : model;

      const stream = await this.client.chat.completions.create({
        model: apiModel,
        messages,
        max_tokens: 4096,
        stream: true,
      });

      let currentContent = '';

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        const reasoning = (delta as any)?.reasoning_content || (delta as any)?.thinking;
        if (reasoning) {
          yield {
            type: 'assistant',
            message: {
              role: 'assistant',
              content: [{ type: 'text', text: `\n*Thinking: ${reasoning}*\n` }],
            },
          };
        }

        if (delta?.content) {
          currentContent += delta.content;
          yield {
            type: 'assistant',
            message: {
              role: 'assistant',
              content: [{ type: 'text', text: delta.content }],
            },
          };
        }
      }

      yield {
        type: 'result',
        subtype: 'success',
        result: currentContent,
      };
    } catch (error) {
      logger.error('Z.AI execution failed', error);
      yield {
        type: 'error',
        error: `Z.AI Error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async detectInstallation(): Promise<InstallationStatus> {
    const hasApiKey = !!process.env.ZAI_API_KEY;
    return {
      installed: true,
      method: 'sdk',
      hasApiKey,
      authenticated: hasApiKey,
    };
  }

  getAvailableModels(): ModelDefinition[] {
    return ZAI_MODELS_DEF.map((m) => ({
      ...m,
      tier: m.tier as 'basic' | 'standard' | 'premium',
    }));
  }

  supportsFeature(feature: string): boolean {
    const supportedFeatures = ['text', 'vision', 'json_mode']; // Tools removed temporarily from generic port
    return supportedFeatures.includes(feature);
  }
}
