/**
 * Universal AI Gateway - COMPLETE MARKET COVERAGE
 *
 * Unified interface to ALL major AI providers through Vercel AI SDK.
 * Licensed under Apache 2.0 - safe for commercial use.
 *
 * OFFICIAL VERCEL SDK PROVIDERS (17):
 * - OpenAI, Anthropic, Google, Google Vertex, Mistral, Cohere, xAI,
 * - Groq, Amazon Bedrock, Azure, Together.ai, Fireworks, DeepInfra,
 * - DeepSeek, Cerebras, Perplexity, Baseten
 *
 * OPENAI-COMPATIBLE PROVIDERS (10+):
 * - Z.AI, OpenRouter, Ollama, Replicate, Anyscale, LM Studio,
 * - Novita, SambaNova, Hyperbolic, Lepton, vLLM, etc.
 *
 * CLI-BASED PROVIDERS (3):
 * - Cursor, Codex, Claude CLI
 */

import { generateText, streamText } from 'ai';
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

// Dynamic imports for optional providers (may not be installed)
let createGoogleVertex: any;
let createTogetherAI: any;
let createFireworks: any;
let createDeepInfra: any;
let createDeepSeek: any;
let createCerebras: any;
let createPerplexity: any;
let createBaseten: any;
let createAmazonBedrock: any;
let createAzure: any;

// Try to import additional providers
try {
  createGoogleVertex = require('@ai-sdk/google-vertex').createVertex;
} catch {}
try {
  createTogetherAI = require('@ai-sdk/togetherai').createTogetherAI;
} catch {}
try {
  createFireworks = require('@ai-sdk/fireworks').createFireworks;
} catch {}
try {
  createDeepInfra = require('@ai-sdk/deepinfra').createDeepInfra;
} catch {}
try {
  createDeepSeek = require('@ai-sdk/deepseek').createDeepSeek;
} catch {}
try {
  createCerebras = require('@ai-sdk/cerebras').createCerebras;
} catch {}
try {
  createPerplexity = require('@ai-sdk/perplexity').createPerplexity;
} catch {}
try {
  createBaseten = require('@ai-sdk/baseten').createBaseten;
} catch {}
try {
  createAmazonBedrock = require('@ai-sdk/amazon-bedrock').createAmazonBedrock;
} catch {}
try {
  createAzure = require('@ai-sdk/azure').createAzure;
} catch {}

const logger = createLogger('UniversalGateway');

/**
 * Provider definition
 */
interface ProviderDef {
  name: string;
  envVar: string;
  patterns: string[]; // Model name patterns to match
  factory: (apiKey: string) => any | null;
  requiresAuth?: boolean;
}

/**
 * CLI-based providers (use existing provider system, not HTTP API)
 */
const CLI_PROVIDERS = ['cursor', 'claude-cli', 'codex'];

/**
 * All provider definitions - COMPLETE MARKET COVERAGE
 */
const PROVIDERS: ProviderDef[] = [
  // === TIER 1: Major Cloud Providers ===
  {
    name: 'openai',
    envVar: 'OPENAI_API_KEY',
    patterns: ['gpt', 'o1-', 'o3-', 'dall-e', 'whisper', 'tts'],
    factory: (k) => createOpenAI({ apiKey: k }),
  },
  {
    name: 'anthropic',
    envVar: 'ANTHROPIC_API_KEY',
    patterns: ['claude'],
    factory: (k) => createAnthropic({ apiKey: k }),
  },
  {
    name: 'google',
    envVar: 'GOOGLE_API_KEY',
    patterns: ['gemini'],
    factory: (k) => createGoogleGenerativeAI({ apiKey: k }),
  },
  {
    name: 'google-vertex',
    envVar: 'GOOGLE_APPLICATION_CREDENTIALS',
    patterns: ['vertex'],
    factory: (k) => createGoogleVertex?.(),
  },

  // === TIER 2: Enterprise & Specialized ===
  {
    name: 'azure',
    envVar: 'AZURE_API_KEY',
    patterns: ['azure'],
    factory: (k) => createAzure?.({ apiKey: k }),
  },
  {
    name: 'bedrock',
    envVar: 'AWS_ACCESS_KEY_ID',
    patterns: ['bedrock', 'amazon', 'titan'],
    factory: (k) => createAmazonBedrock?.(),
  },
  {
    name: 'mistral',
    envVar: 'MISTRAL_API_KEY',
    patterns: ['mistral', 'codestral', 'pixtral'],
    factory: (k) => createMistral({ apiKey: k }),
  },
  {
    name: 'cohere',
    envVar: 'COHERE_API_KEY',
    patterns: ['command', 'embed', 'rerank'],
    factory: (k) => createCohere({ apiKey: k }),
  },

  // === TIER 3: Fast Inference ===
  {
    name: 'groq',
    envVar: 'GROQ_API_KEY',
    patterns: ['groq'],
    factory: (k) => createGroq({ apiKey: k }),
  },
  {
    name: 'cerebras',
    envVar: 'CEREBRAS_API_KEY',
    patterns: ['cerebras'],
    factory: (k) => createCerebras?.({ apiKey: k }),
  },
  {
    name: 'fireworks',
    envVar: 'FIREWORKS_API_KEY',
    patterns: ['fireworks', 'accounts/fireworks'],
    factory: (k) => createFireworks?.({ apiKey: k }),
  },

  // === TIER 4: Specialized/Research ===
  {
    name: 'xai',
    envVar: 'XAI_API_KEY',
    patterns: ['grok'],
    factory: (k) => createXai({ apiKey: k }),
  },
  {
    name: 'perplexity',
    envVar: 'PERPLEXITY_API_KEY',
    patterns: ['pplx', 'perplexity', 'sonar'],
    factory: (k) => createPerplexity?.({ apiKey: k }),
  },
  {
    name: 'deepseek',
    envVar: 'DEEPSEEK_API_KEY',
    patterns: ['deepseek'],
    factory: (k) => createDeepSeek?.({ apiKey: k }),
  },
  {
    name: 'deepinfra',
    envVar: 'DEEPINFRA_API_KEY',
    patterns: ['deepinfra'],
    factory: (k) => createDeepInfra?.({ apiKey: k }),
  },
  {
    name: 'together',
    envVar: 'TOGETHER_API_KEY',
    patterns: ['together', 'togethercomputer'],
    factory: (k) => createTogetherAI?.({ apiKey: k }),
  },
  {
    name: 'baseten',
    envVar: 'BASETEN_API_KEY',
    patterns: ['baseten'],
    factory: (k) => createBaseten?.({ apiKey: k }),
  },
];

/**
 * OpenAI-compatible providers (use createOpenAI with custom baseURL)
 */
const OPENAI_COMPATIBLE: {
  name: string;
  envVar: string;
  baseURL: string;
  patterns: string[];
  tokenGen?: (k: string) => string;
}[] = [
  {
    name: 'zai',
    envVar: 'ZAI_API_KEY',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    patterns: ['glm', 'zai', 'zhipu'],
    tokenGen: generateZaiToken,
  },
  {
    name: 'openrouter',
    envVar: 'OPENROUTER_API_KEY',
    baseURL: 'https://openrouter.ai/api/v1',
    patterns: ['openrouter/'],
  },
  {
    name: 'ollama',
    envVar: 'OLLAMA_HOST',
    baseURL: 'http://localhost:11434/v1',
    patterns: ['ollama/'],
  },
  {
    name: 'replicate',
    envVar: 'REPLICATE_API_KEY',
    baseURL: 'https://openai-proxy.replicate.com/v1',
    patterns: ['replicate/'],
  },
  {
    name: 'anyscale',
    envVar: 'ANYSCALE_API_KEY',
    baseURL: 'https://api.endpoints.anyscale.com/v1',
    patterns: ['anyscale/'],
  },
  {
    name: 'novita',
    envVar: 'NOVITA_API_KEY',
    baseURL: 'https://api.novita.ai/v3/openai',
    patterns: ['novita/'],
  },
  {
    name: 'sambanova',
    envVar: 'SAMBANOVA_API_KEY',
    baseURL: 'https://api.sambanova.ai/v1',
    patterns: ['sambanova/'],
  },
  {
    name: 'hyperbolic',
    envVar: 'HYPERBOLIC_API_KEY',
    baseURL: 'https://api.hyperbolic.xyz/v1',
    patterns: ['hyperbolic/'],
  },
  {
    name: 'lepton',
    envVar: 'LEPTON_API_KEY',
    baseURL: 'https://llama3-1-405b.lepton.run/api/v1',
    patterns: ['lepton/'],
  },
  {
    name: 'lmstudio',
    envVar: 'LMSTUDIO_HOST',
    baseURL: 'http://localhost:1234/v1',
    patterns: ['lmstudio/'],
  },
];

/**
 * Generate Z.AI JWT token
 */
function generateZaiToken(apiKey: string): string {
  const [id, secret] = apiKey.split('.');
  if (!id || !secret) return apiKey;
  const now = Date.now();
  return jwt.sign({ api_key: id, exp: now + 210000, timestamp: now }, secret, {
    algorithm: 'HS256',
    header: { alg: 'HS256', sign_type: 'SIGN' } as any,
  });
}

/**
 * Universal execution options
 */
export interface UniversalExecuteOptions {
  prompt: string;
  model?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Universal Gateway - One interface for ALL AI providers
 */
export class UniversalGateway {
  private providers = new Map<string, any>();
  private credentials: Record<string, string> = {};
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    logger.info('[UniversalGateway] Initializing...');
    await this.loadCredentials();
    this.createProviders();
    this.initialized = true;
    const count = this.providers.size;
    logger.info(
      `[UniversalGateway] Ready with ${count} providers: ${[...this.providers.keys()].join(', ')}`
    );
  }

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
              process.env[this.getEnvVar(key)] = value.trim();
              logger.info(`[UniversalGateway] Loaded ${key} from credentials.json`);
            }
          }
        }
      }
    } catch {}

    // Load from environment
    for (const p of [...PROVIDERS, ...OPENAI_COMPATIBLE]) {
      if (!this.credentials[p.name] && process.env[p.envVar]) {
        this.credentials[p.name] = process.env[p.envVar]!.trim();
        logger.info(`[UniversalGateway] Loaded ${p.name} from environment`);
      }
    }
  }

  private getEnvVar(name: string): string {
    const p = [...PROVIDERS, ...OPENAI_COMPATIBLE].find((x) => x.name === name);
    return p?.envVar || `${name.toUpperCase().replace(/-/g, '_')}_API_KEY`;
  }

  private createProviders(): void {
    // Official SDK providers
    for (const p of PROVIDERS) {
      const key = this.credentials[p.name];
      if (key || !p.requiresAuth) {
        try {
          const instance = p.factory(key || '');
          if (instance) this.providers.set(p.name, instance);
        } catch {}
      }
    }

    // OpenAI-compatible providers
    for (const p of OPENAI_COMPATIBLE) {
      const key = this.credentials[p.name] || process.env[p.envVar];
      if (key || p.name === 'ollama' || p.name === 'lmstudio') {
        const apiKey = p.tokenGen ? p.tokenGen(key || '') : key || 'none';
        const baseURL =
          p.name === 'ollama'
            ? (process.env.OLLAMA_HOST || 'http://localhost:11434') + '/v1'
            : p.name === 'lmstudio'
              ? (process.env.LMSTUDIO_HOST || 'http://localhost:1234') + '/v1'
              : p.baseURL;
        this.providers.set(p.name, createOpenAI({ apiKey, baseURL }));
      }
    }
  }

  private getProviderForModel(model: string): {
    provider: any;
    modelId: string;
    providerName: string;
  } {
    const lower = model.toLowerCase();

    // Check official providers
    for (const p of PROVIDERS) {
      if (p.patterns.some((pat) => lower.includes(pat))) {
        return { provider: this.providers.get(p.name), modelId: model, providerName: p.name };
      }
    }

    // Check OpenAI-compatible
    for (const p of OPENAI_COMPATIBLE) {
      if (p.patterns.some((pat) => lower.includes(pat))) {
        // For Z.AI, uppercase the model
        const id = p.name === 'zai' ? model.toUpperCase() : model;
        return { provider: this.providers.get(p.name), modelId: id, providerName: p.name };
      }
    }

    // CLI providers - return null provider
    if (CLI_PROVIDERS.some((c) => lower.includes(c))) {
      return { provider: null, modelId: model, providerName: 'cli' };
    }

    // Default fallback: OpenRouter if available, else first provider
    if (this.providers.has('openrouter')) {
      return {
        provider: this.providers.get('openrouter'),
        modelId: model,
        providerName: 'openrouter',
      };
    }
    const first = [...this.providers.entries()][0];
    if (first) return { provider: first[1], modelId: model, providerName: first[0] };

    throw new Error(`No provider available for model: ${model}`);
  }

  isCLIProvider(model: string): boolean {
    const lower = model.toLowerCase();
    return CLI_PROVIDERS.some((c) => lower.includes(c));
  }

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
      logger.error(`[UniversalGateway] [${callId}] ERROR in ${Date.now() - start}ms`, err);
      throw err;
    }
  }

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
      for await (const chunk of stream.textStream) yield chunk;
      logger.info(`[UniversalGateway] [${callId}] DONE in ${Date.now() - start}ms`);
    } catch (err) {
      logger.error(`[UniversalGateway] [${callId}] ERROR in ${Date.now() - start}ms`, err);
      throw err;
    }
  }

  getAvailableProviders(): string[] {
    return [...this.providers.keys()];
  }

  isProviderAvailable(name: string): boolean {
    return this.providers.has(name);
  }
}

export const universalGateway = new UniversalGateway();
