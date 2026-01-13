/**
 * AI Gateway - Unified entry point for all AI operations
 *
 * This module provides a single, parallel-safe gateway for all AI calls.
 * It handles:
 * - Credential loading (single source of truth)
 * - Provider/model routing based on settings
 * - Parallel execution (stateless, no blocking)
 * - Audit logging
 *
 * Usage:
 *   import { aiGateway } from './services/ai-gateway.js';
 *
 *   // Stream response
 *   for await (const msg of aiGateway.execute({ prompt, model, cwd })) { ... }
 *
 *   // Simple text response
 *   const text = await aiGateway.executeText({ prompt, model });
 */

import { ProviderFactory } from '../providers/provider-factory.js';
import { SettingsService } from './settings-service.js';
import { resolveModelString } from '@automaker/model-resolver';
import { createLogger } from '@automaker/utils';
import type { ExecuteOptions, ProviderMessage } from '@automaker/types';
import { universalGateway } from './universal-gateway.js';
import * as path from 'path';
import * as fs from 'fs';

const logger = createLogger('AIGateway');

/**
 * Credential sources in order of precedence
 */
type CredentialSource = 'credentials.json' | '.env' | 'environment';

interface LoadedCredential {
  key: string;
  source: CredentialSource;
}

/**
 * Options for gateway execution
 */
export interface GatewayOptions extends Omit<ExecuteOptions, 'model' | 'cwd'> {
  /** Model identifier (e.g., 'glm-4.7', 'claude-sonnet-4', or 'default') */
  model?: string;
  /** Working directory (defaults to process.cwd()) */
  cwd?: string;
}

/**
 * AIGateway - Single entry point for all AI operations
 *
 * Supports parallel execution across multiple providers/models simultaneously.
 * Each call is stateless and independent.
 */
export class AIGateway {
  private initialized = false;
  private settingsService: SettingsService | null = null;
  private credentials: Record<string, LoadedCredential> = {};
  private dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir =
      dataDir || process.env.APPDATA
        ? path.join(process.env.APPDATA!, 'Automaker')
        : path.join(process.env.HOME || '', '.automaker');
  }

  /**
   * Initialize the gateway - call once at server startup
   */
  async init(): Promise<void> {
    if (this.initialized) {
      logger.warn('[AIGateway] Already initialized, skipping');
      return;
    }

    logger.info('[AIGateway] Initializing...');

    // Initialize settings service for reading credentials.json
    this.settingsService = new SettingsService(this.dataDir);

    // Load credentials with clear precedence
    await this.loadCredentials();

    this.initialized = true;
    logger.info('[AIGateway] Initialized successfully');
  }

  /**
   * Load credentials with strict precedence:
   * 1. credentials.json (user configured via UI)
   * 2. .env file (already loaded by dotenv)
   * 3. Environment variables (fallback)
   */
  private async loadCredentials(): Promise<void> {
    const providers = ['zai', 'anthropic', 'openai', 'google'] as const;

    for (const provider of providers) {
      const envVarName = this.getEnvVarName(provider);
      let credential: LoadedCredential | null = null;

      // 1. Try credentials.json first
      if (this.settingsService) {
        try {
          const creds = await this.settingsService.getCredentials();
          const key = creds.apiKeys?.[provider as keyof typeof creds.apiKeys];
          if (key && key.trim()) {
            credential = { key: key.trim(), source: 'credentials.json' };
          }
        } catch (err) {
          // credentials.json doesn't exist or is invalid - continue
        }
      }

      // 2. Fall back to environment variable (includes .env via dotenv)
      if (!credential) {
        const envKey = process.env[envVarName];
        if (envKey && envKey.trim()) {
          // Determine if it came from .env or system env
          // (We can't truly distinguish, but .env is loaded first)
          credential = { key: envKey.trim(), source: 'environment' };
        }
      }

      if (credential) {
        this.credentials[provider] = credential;
        const masked = this.maskKey(credential.key);
        logger.info(`[AIGateway] ${provider}: ${masked} (from ${credential.source})`);

        // CRITICAL: Sync to process.env so providers that read from env vars get the correct key.
        // This fixes the "Ghost Key" issue where stale shell env vars override credentials.json.
        process.env[envVarName] = credential.key;
        logger.info(`[AIGateway] Synced ${provider} to ${envVarName}`);
      }
    }
  }

  /**
   * Map provider name to environment variable name
   */
  private getEnvVarName(provider: string): string {
    const mapping: Record<string, string> = {
      zai: 'ZAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      openai: 'OPENAI_API_KEY',
      google: 'GOOGLE_API_KEY',
    };
    return mapping[provider] || `${provider.toUpperCase()}_API_KEY`;
  }

  /**
   * Mask API key for logging (show first 4 and last 4 chars)
   */
  private maskKey(key: string): string {
    if (key.length <= 8) return '****';
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  }

  /**
   * Execute a query using the appropriate provider.
   *
   * This is stateless and parallel-safe - multiple calls can run simultaneously
   * with different providers/models.
   *
   * @param options Query options including prompt, model, cwd, etc.
   * @yields ProviderMessage objects from the AI response stream
   */
  async *execute(options: GatewayOptions): AsyncGenerator<ProviderMessage> {
    if (!this.initialized) {
      throw new Error('[AIGateway] Not initialized. Call init() first.');
    }

    const { model: modelInput = 'default', cwd = process.cwd(), ...restOptions } = options;

    // Resolve model string (handles 'default', 'opus', 'sonnet', etc.)
    const resolvedModel = resolveModelString(modelInput);

    // Get provider name for this model
    const providerName = ProviderFactory.getProviderForModelName(resolvedModel);

    // Audit: Start timing
    const startTime = Date.now();
    const callId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

    logger.info(`[AIGateway] [${callId}] START: ${resolvedModel} via ${providerName}`);

    // Get provider instance (stateless lookup)
    const provider = ProviderFactory.getProviderByName(providerName);

    if (!provider) {
      logger.error(`[AIGateway] [${callId}] FAIL: Provider '${providerName}' not found`);
      throw new Error(
        `[AIGateway] Provider '${providerName}' not found. Available: ${ProviderFactory.getRegisteredProviderNames().join(', ')}`
      );
    }

    // Build execute options
    const executeOptions: ExecuteOptions = {
      ...restOptions,
      model: resolvedModel,
      cwd,
    };

    // Execute and yield with audit tracking
    let messageCount = 0;
    let hasError = false;

    try {
      for await (const msg of provider.executeQuery(executeOptions)) {
        messageCount++;
        if (msg.type === 'error') {
          hasError = true;
        }
        yield msg;
      }
    } finally {
      // Audit: Log completion
      const elapsed = Date.now() - startTime;
      const status = hasError ? 'ERROR' : 'OK';
      logger.info(`[AIGateway] [${callId}] END: ${status} in ${elapsed}ms (${messageCount} msgs)`);
    }
  }

  /**
   * Execute a query and return the accumulated text response.
   *
   * Convenience method for cases where you just need the final text.
   *
   * @param options Query options
   * @returns The accumulated text response
   */
  async executeText(options: GatewayOptions): Promise<string> {
    let responseText = '';

    for await (const msg of this.execute(options)) {
      if (msg.type === 'assistant' && msg.message?.content) {
        for (const block of msg.message.content) {
          if (block.type === 'text' && block.text) {
            responseText += block.text;
          }
        }
      }
      // Capture final result text
      if (
        msg.type === 'result' &&
        msg.subtype === 'success' &&
        typeof (msg as any).result === 'string'
      ) {
        responseText = (msg as any).result;
      }
    }

    return responseText;
  }

  /**
   * Check if a provider is available and configured.
   *
   * @param providerName Provider name (e.g., 'zai', 'claude', 'cursor')
   * @returns True if the provider is available
   */
  async isProviderAvailable(providerName: string): Promise<boolean> {
    const provider = ProviderFactory.getProviderByName(providerName);
    if (!provider) return false;

    try {
      const status = await provider.detectInstallation();
      return status.installed && (status.authenticated ?? true);
    } catch (error) {
      logger.warn(`[AIGateway] Provider '${providerName}' detection failed:`, error);
      return false;
    }
  }

  /**
   * Get credential info for a provider (masked for security)
   */
  getCredentialInfo(provider: string): {
    configured: boolean;
    source: CredentialSource | null;
    masked: string;
  } {
    const cred = this.credentials[provider];
    if (!cred) {
      return { configured: false, source: null, masked: '' };
    }
    return {
      configured: true,
      source: cred.source,
      masked: this.maskKey(cred.key),
    };
  }
}

/**
 * Singleton instance - use this throughout the application
 */
export const aiGateway = new AIGateway();
