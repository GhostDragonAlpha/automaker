/**
 * Z.AI Provider Registration
 *
 * Registers the Z.AI provider with the ProviderRegistry.
 * Auto-registers on import if ZAI_API_KEY is present.
 */

import { registerProvider } from '@automaker/providers-core';
import { ZaiQueryService } from './zai-query-service.js';

/**
 * Register Z.AI provider with the registry
 */
export function register(): void {
  registerProvider({
    name: 'zai',
    createQueryService: () => new ZaiQueryService(),
    aliases: ['glm', 'zhipu'],
    priority: 5, // Lower than Claude (10) by default
  });
}

/**
 * Auto-register if ZAI_API_KEY is available
 */
export function autoRegister(): void {
  if (process.env.ZAI_API_KEY) {
    register();
    console.log('[provider-zai] Auto-registered Z.AI provider');
  }
}
