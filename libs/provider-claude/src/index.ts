/**
 * @automaker/provider-claude
 *
 * Claude/Anthropic provider for AutoMaker.
 * Wraps @anthropic-ai/claude-agent-sdk to provide QueryService implementation.
 *
 * This module auto-registers with the ProviderRegistry on import.
 */

export { ClaudeQueryService } from './claude-query-service.js';
export { register, autoRegister } from './register.js';

// Re-export for convenience
export type { QueryService, QueryOptions, QueryResult } from '@automaker/providers-core';

// Auto-register on import
import { autoRegister } from './register.js';
autoRegister();
