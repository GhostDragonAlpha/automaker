/**
 * Execute Query - Unified provider-agnostic query execution
 *
 * This module provides a single entry point for executing AI queries that routes
 * through the ProviderFactory. It enables the model selector to work with any
 * provider (Z.AI, Claude, Cursor, etc.) without hardcoding SDK dependencies.
 *
 * Usage:
 *   import { executeQuery } from '../lib/execute-query.js';
 *   for await (const msg of executeQuery({ prompt, model, cwd })) { ... }
 */

import { ProviderFactory } from '../providers/provider-factory.js';
import { resolveModelString } from '@automaker/model-resolver';
import { createLogger } from '@automaker/utils';
import type { ExecuteOptions, ProviderMessage } from '@automaker/types';

const logger = createLogger('ExecuteQuery');

/**
 * Options for executeQuery - extends base ExecuteOptions with convenience fields.
 * Makes `model` and `cwd` optional with sensible defaults.
 */
export interface QueryOptions extends Omit<ExecuteOptions, 'model' | 'cwd'> {
  /** Model identifier (e.g., 'glm-4.5-flash', 'claude-sonnet-4-20250514', or 'default') */
  model?: string;
  /** Working directory (defaults to process.cwd()) */
  cwd?: string;
}

/**
 * Execute a query using the appropriate provider based on model ID.
 *
 * This is the unified entry point for all AI queries. It:
 * 1. Resolves the model string (handles aliases like 'default', 'opus', etc.)
 * 2. Gets the provider instance from ProviderFactory based on model
 * 3. Streams responses using the provider's executeQuery method
 *
 * @param options Query options including prompt, model, cwd, etc.
 * @yields ProviderMessage objects from the AI response stream
 */
export async function* executeQuery(options: QueryOptions): AsyncGenerator<ProviderMessage> {
  const { model: modelInput = 'default', cwd = process.cwd(), ...restOptions } = options;

  // Resolve the model string (handles 'default', 'opus', etc.)
  const resolvedModel = resolveModelString(modelInput);

  // Get the provider name for this model
  const providerName = ProviderFactory.getProviderForModelName(resolvedModel);

  logger.info(`[executeQuery] Routing to provider: ${providerName}, model: ${resolvedModel}`);

  // Get the provider instance
  const provider = ProviderFactory.getProviderByName(providerName);

  if (!provider) {
    throw new Error(
      `Provider '${providerName}' not found. Available providers: ${ProviderFactory.getRegisteredProviderNames().join(', ')}`
    );
  }

  // Execute the query through the provider
  const executeOptions: ExecuteOptions = {
    ...restOptions,
    model: resolvedModel,
    cwd,
  };

  logger.debug(`[executeQuery] Calling ${providerName}.executeQuery with model: ${resolvedModel}`);

  // Yield all messages from the provider stream
  yield* provider.executeQuery(executeOptions);
}

/**
 * Execute a simple text query and return the accumulated text response.
 *
 * Convenience wrapper for cases where you just need the final text output.
 *
 * @param options Query options
 * @returns The accumulated text response
 */
export async function executeTextQuery(options: QueryOptions): Promise<string> {
  let responseText = '';

  for await (const msg of executeQuery(options)) {
    if (msg.type === 'assistant' && msg.message?.content) {
      for (const block of msg.message.content) {
        if (block.type === 'text' && block.text) {
          responseText += block.text;
        }
      }
    }
    // Also capture final result text
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
 * Check if a provider is available and properly configured.
 *
 * @param providerName Provider name (e.g., 'zai', 'claude', 'cursor')
 * @returns True if the provider is available
 */
export async function isProviderAvailable(providerName: string): Promise<boolean> {
  const provider = ProviderFactory.getProviderByName(providerName);
  if (!provider) return false;

  try {
    const status = await provider.detectInstallation();
    return status.installed && (status.authenticated ?? true);
  } catch (error) {
    logger.warn(`[executeQuery] Provider '${providerName}' detection failed:`, error);
    return false;
  }
}
