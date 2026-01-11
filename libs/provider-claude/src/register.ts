/**
 * Provider Registration
 *
 * Registers the Claude provider with the ProviderRegistry.
 * Auto-registers on import if ANTHROPIC_API_KEY is present.
 */

import { registerProvider } from '@automaker/providers-core';
import { ClaudeQueryService } from './claude-query-service.js';

let registered = false;

/**
 * Manually register the Claude provider
 */
export function register(): void {
  if (registered) return;

  registerProvider({
    name: 'claude',
    aliases: ['anthropic'],
    priority: 100, // High priority - Claude is the default when available
    createQueryService: () => new ClaudeQueryService(),
  });

  registered = true;
}

/**
 * Auto-registration function (called on import)
 * Only registers if ANTHROPIC_API_KEY is available
 */
export function autoRegister(): void {
  if (process.env.ANTHROPIC_API_KEY) {
    register();
    console.log('[provider-claude] Auto-registered Claude provider');
  }
}
