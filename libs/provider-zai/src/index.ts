/**
 * @automaker/provider-zai
 *
 * Z.AI GLM provider for AutoMaker.
 * Uses OpenAI-compatible API to communicate with Z.AI's GLM models.
 *
 * This module auto-registers with the ProviderRegistry on import
 * if ZAI_API_KEY environment variable is set.
 */

export { ZaiQueryService, ZAI_MODELS, type ZaiModel } from './zai-query-service.js';
export { register, autoRegister } from './register.js';

// Re-export for convenience
export type { QueryService, QueryOptions, QueryResult } from '@automaker/providers-core';

// Auto-register on import
import { autoRegister } from './register.js';
autoRegister();
