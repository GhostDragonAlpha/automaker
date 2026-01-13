/**
 * Universal AI Gateway using Vercel AI SDK
 *
 * Unified interface to ALL AI providers through Vercel's battle-tested SDK.
 * Licensed under Apache 2.0 - safe for commercial use.
 *
 * Supported Providers:
 * - OpenAI (GPT-4o, o1, o3)
 * - Anthropic (Claude)
 * - Google (Gemini)
 * - Z.AI (GLM) - via OpenAI-compatible
 * - Mistral (Mistral Large, Codestral)
 * - Cohere (Command R+)
 * - xAI (Grok)
 * - Groq (Llama, Mixtral)
 * - Azure OpenAI
 * - Amazon Bedrock
 */

import { generateText, streamText, CoreMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createMistral } from '@ai-sdk/mistral';
import { createCohere } from '@ai-sdk/cohere';
import { createXai } from '@ai-sdk/xai';
import { createGroq } from '@ai-sdk/groq';
import jwt from 'jsonwebtoken';
import { createLogger } from '@automaker/utils';
import * as fs from 'fs';
import * as path from 'path';

const logger = createLogger('UniversalGateway');

/**
 * Provider definitions
 */
interface ProviderDef {
  name: string;
  envVar: string;
  models: string[];
  factory: (apiKey: string) => any;
}

/**
 * CLI-based providers (use existing provider system, not HTTP API)
 */
const CLI_PROVIDERS = ['cursor', 'claude-cli', 'codex'];

const PROVIDERS: ProviderDef[] = [
  {
    name: 'openai',
    envVar: 'OPENAI_API_KEY',
    models: ['gpt-4o', 'gpt-4', 'gpt-3.5', 'o1', 'o3'],
    factory: (key) => createOpenAI({ apiKey: key }),
  },
  {
    name: 'anthropic',
    envVar: 'ANTHROPIC_API_KEY',
    models: ['claude'],
    factory: (key) => createAnthropic({ apiKey: key }),
  },
  {
    name: 'google',
    envVar: 'GOOGLE_API_KEY',
    models: ['gemini'],
    factory: (key) => createGoogleGenerativeAI({ apiKey: key }),
  },
  {
    name: 'mistral',
    envVar: 'MISTRAL_API_KEY',
    models: ['mistral', 'codestral'],
    factory: (key) => createMistral({ apiKey: key }),
  },
  {
    name: 'cohere',
    envVar: 'COHERE_API_KEY',
    models: ['command'],
    factory: (key) => createCohere({ apiKey: key }),
  },
  {
    name: 'xai',
    envVar: 'XAI_API_KEY',
    models: ['grok'],
    factory: (key) => createXai({ apiKey: key }),
  },
  {
    name: 'groq',
    envVar: 'GROQ_API_KEY',
    models: ['llama', 'mixtral'],
    factory: (key) => createGroq({ apiKey: key }),
  },
];

/**
 * Universal execution options
 */
export interface UniversalExecuteOptions {
  prompt: string;
  model?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

/**
 * Universal Gateway - One interface for ALL AI providers
 */
export class UniversalGateway {
  private providers = new Map<string, any>();
  private credentials: Record<string, string> = {};
  private initialized = false;

  constructor() {}

  /**
   * Initialize the gateway
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    logger.info('[UniversalGateway] Initializing...');
    await this.loadCredentials();
    this.createProviders();
    this.initialized = true;
    logger.info(
      `[UniversalGateway] Ready with ${this.providers.size} providers: ${[...this.providers.keys()].join(', ')}`
    );
  }

  /**
   * Load credentials from credentials.json and environment
   */
  private async loadCredentials(): Promise<void> {
    const credPath = path.join(
      process.env.APPDATA || process.env.HOME || '',
      process.env.APPDATA ? 'Automaker' : '.automaker',
      'credentials.json'
    );

    // Load from credentials.json
    try {
      if (fs.existsSync(credPath)) {
        const creds = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
        if (creds.apiKeys) {
          for (const [key, value] of Object.entries(creds.apiKeys)) {
            if (value && typeof value === 'string') {
              this.credentials[key] = value.trim();
              const envVar = this.getEnvVarName(key);
              process.env[envVar] = value.trim();
              logger.info(`[UniversalGateway] Loaded ${key} from credentials.json`);
            }
          }
        }
      }
    } catch (err) {
      logger.warn('[UniversalGateway] Could not load credentials.json');
    }

    // Load from environment
    for (const provider of PROVIDERS) {
      const key = provider.name;
      if (!this.credentials[key] && process.env[provider.envVar]) {
        this.credentials[key] = process.env[provider.envVar]!.trim();
        logger.info(`[UniversalGateway] Loaded ${key} from environment`);
      }
    }

    // Also check ZAI (special handling)
    if (!this.credentials.zai && process.env.ZAI_API_KEY) {
      this.credentials.zai = process.env.ZAI_API_KEY.trim();
      logger.info('[UniversalGateway] Loaded zai from environment');
    }
  }

  private getEnvVarName(provider: string): string {
    const providerDef = PROVIDERS.find((p) => p.name === provider);
    return providerDef?.envVar || `${provider.toUpperCase()}_API_KEY`;
  }

  /**
   * Create provider instances
   */
  private createProviders(): void {
    // Standard providers
    for (const providerDef of PROVIDERS) {
      if (this.credentials[providerDef.name]) {
        this.providers.set(
          providerDef.name,
          providerDef.factory(this.credentials[providerDef.name])
        );
      }
    }

    // Z.AI (OpenAI-compatible with JWT auth)
    if (this.credentials.zai) {
      this.providers.set(
        'zai',
        createOpenAI({
          apiKey: this.generateZaiToken(this.credentials.zai),
          baseURL: 'https://open.bigmodel.cn/api/paas/v4',
        })
      );
    }

    // OpenRouter (any model via proxy)
    if (this.credentials.openrouter || process.env.OPENROUTER_API_KEY) {
      const key = this.credentials.openrouter || process.env.OPENROUTER_API_KEY!;
      this.providers.set(
        'openrouter',
        createOpenAI({
          apiKey: key,
          baseURL: 'https://openrouter.ai/api/v1',
        })
      );
    }

    // Ollama (local models)
    if (
      process.env.OLLAMA_HOST ||
      fs.existsSync('/usr/local/bin/ollama') ||
      process.platform === 'win32'
    ) {
      const host = process.env.OLLAMA_HOST || 'http://localhost:11434';
      this.providers.set(
        'ollama',
        createOpenAI({
          apiKey: 'ollama',
          baseURL: `${host}/v1`,
        })
      );
    }
  }

  /**
   * Generate Z.AI JWT token
   */
  private generateZaiToken(apiKey: string): string {
    const [id, secret] = apiKey.split('.');
    if (!id || !secret) return apiKey;

    const now = Date.now();
    const payload = { api_key: id, exp: now + 210000, timestamp: now };
    return jwt.sign(payload, secret, {
      algorithm: 'HS256',
      header: { alg: 'HS256', sign_type: 'SIGN' } as any,
    });
  }

  /**
   * Get provider for a model
   */
  private getProviderForModel(model: string): {
    provider: any;
    modelId: string;
    providerName: string;
  } {
    const lower = model.toLowerCase();

    // OpenAI
    if (lower.includes('gpt') || lower.includes('o1-') || lower.includes('o3-')) {
      return { provider: this.providers.get('openai'), modelId: model, providerName: 'openai' };
    }

    // Anthropic
    if (lower.includes('claude')) {
      return {
        provider: this.providers.get('anthropic'),
        modelId: model,
        providerName: 'anthropic',
      };
    }

    // Google
    if (lower.includes('gemini')) {
      return { provider: this.providers.get('google'), modelId: model, providerName: 'google' };
    }

    // Z.AI
    if (lower.includes('glm') || lower.startsWith('zai')) {
      return {
        provider: this.providers.get('zai'),
        modelId: model.toUpperCase(),
        providerName: 'zai',
      };
    }

    // Mistral
    if (lower.includes('mistral') || lower.includes('codestral')) {
      return { provider: this.providers.get('mistral'), modelId: model, providerName: 'mistral' };
    }

    // Cohere
    if (lower.includes('command')) {
      return { provider: this.providers.get('cohere'), modelId: model, providerName: 'cohere' };
    }

    // xAI (Grok)
    if (lower.includes('grok')) {
      return { provider: this.providers.get('xai'), modelId: model, providerName: 'xai' };
    }

    // Groq
    if (lower.includes('llama') || lower.includes('mixtral')) {
      return { provider: this.providers.get('groq'), modelId: model, providerName: 'groq' };
    }

    // Ollama (local)
    if (
      this.providers.has('ollama') &&
      (lower.includes('llama') || lower.includes('codellama') || lower.includes('deepseek'))
    ) {
      return { provider: this.providers.get('ollama'), modelId: model, providerName: 'ollama' };
    }

    // Cursor (CLI-based - returns null provider, handled by legacy system)
    if (lower.includes('cursor') || lower.includes('composer')) {
      return { provider: null, modelId: model, providerName: 'cursor' };
    }

    // Codex (CLI-based)
    if (lower.includes('codex')) {
      return { provider: null, modelId: model, providerName: 'codex' };
    }

    // OpenRouter fallback
    if (this.providers.has('openrouter')) {
      return {
        provider: this.providers.get('openrouter'),
        modelId: model,
        providerName: 'openrouter',
      };
    }

    // Default to first available
    const first = [...this.providers.entries()][0];
    if (first) {
      return { provider: first[1], modelId: model, providerName: first[0] };
    }

    throw new Error(`No provider available for model: ${model}`);
  }

  /**
   * Check if a model uses a CLI-based provider (requires legacy ProviderFactory)
   */
  isCLIProvider(model: string): boolean {
    const lower = model.toLowerCase();
    return (
      CLI_PROVIDERS.some((p) => lower.includes(p)) ||
      lower.includes('cursor') ||
      lower.includes('composer') ||
      lower.includes('codex')
    );
  }

  /**
   * Execute text generation (non-streaming)
   */
  async generateText(options: UniversalExecuteOptions): Promise<string> {
    if (!this.initialized) await this.init();

    const { provider, modelId, providerName } = this.getProviderForModel(options.model || 'gpt-4o');
    if (!provider) throw new Error(`Provider not configured for: ${options.model}`);

    const callId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const start = Date.now();
    logger.info(`[UniversalGateway] [${callId}] START: ${modelId} via ${providerName}`);

    try {
      const result = await generateText({
        model: provider(modelId),
        prompt: options.prompt,
        system: options.systemPrompt,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
      });
      logger.info(`[UniversalGateway] [${callId}] END: OK in ${Date.now() - start}ms`);
      return result.text;
    } catch (err) {
      logger.error(`[UniversalGateway] [${callId}] END: ERROR in ${Date.now() - start}ms`, err);
      throw err;
    }
  }

  /**
   * Execute streaming text generation
   */
  async *streamText(options: UniversalExecuteOptions): AsyncGenerator<string> {
    if (!this.initialized) await this.init();

    const { provider, modelId, providerName } = this.getProviderForModel(options.model || 'gpt-4o');
    if (!provider) throw new Error(`Provider not configured for: ${options.model}`);

    const callId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const start = Date.now();
    logger.info(`[UniversalGateway] [${callId}] STREAM: ${modelId} via ${providerName}`);

    try {
      const stream = await streamText({
        model: provider(modelId),
        prompt: options.prompt,
        system: options.systemPrompt,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
      });

      for await (const chunk of stream.textStream) {
        yield chunk;
      }
      logger.info(`[UniversalGateway] [${callId}] DONE in ${Date.now() - start}ms`);
    } catch (err) {
      logger.error(`[UniversalGateway] [${callId}] ERROR in ${Date.now() - start}ms`, err);
      throw err;
    }
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): string[] {
    return [...this.providers.keys()];
  }

  /**
   * Check if a specific provider is available
   */
  isProviderAvailable(name: string): boolean {
    return this.providers.has(name);
  }
}

/**
 * Singleton instance
 */
export const universalGateway = new UniversalGateway();
