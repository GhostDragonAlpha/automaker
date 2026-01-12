/**
 * @automaker/providers-core
 *
 * Core abstractions for AI provider integration.
 * This package provides the QueryService interface and ProviderRegistry
 * to enable provider-agnostic AI operations across AutoMaker.
 */

// Core interfaces
export type { QueryOptions, QueryService, QueryResult } from './query-service.js';
export type { ProviderRegistration } from './provider-registry.js';

// Registry and factory
export { BaseProvider } from './base-provider.js';
export { ProviderRegistry, registerProvider, getQueryService } from './provider-registry.js';

// Re-export base types from @automaker/types for convenience
export type {
  ProviderConfig,
  ExecuteOptions,
  ProviderMessage,
  ModelDefinition,
  InstallationStatus,
  ValidationResult,
} from '@automaker/types';
