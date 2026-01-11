/**
 * ProviderRegistry
 *
 * Central registry for AI providers. Providers register themselves
 * with the registry, and routes use getQueryService() to get
 * the currently configured provider.
 *
 * This enables provider-agnostic AI operations throughout AutoMaker.
 */

import type { QueryService } from './query-service.js';

/**
 * Registration entry for a provider
 */
export interface ProviderRegistration {
  /** Unique name for the provider (e.g., 'claude', 'gemini') */
  name: string;
  /** Factory function to create the QueryService instance */
  createQueryService: () => QueryService;
  /** Aliases for this provider (e.g., 'anthropic' for 'claude') */
  aliases?: string[];
  /** Priority for default selection (higher = preferred) */
  priority?: number;
}

/**
 * Internal registry storage
 */
const providerRegistry = new Map<string, ProviderRegistration>();
const aliasMap = new Map<string, string>(); // alias -> provider name

/**
 * Currently active provider (cached)
 */
let activeQueryService: QueryService | null = null;
let activeProviderName: string | null = null;

/**
 * Register a provider with the registry
 *
 * Called by provider packages to make themselves available.
 *
 * @param registration - Provider registration config
 */
export function registerProvider(registration: ProviderRegistration): void {
  const name = registration.name.toLowerCase();
  providerRegistry.set(name, registration);

  // Register aliases
  if (registration.aliases) {
    for (const alias of registration.aliases) {
      aliasMap.set(alias.toLowerCase(), name);
    }
  }

  // Clear cache to allow new provider to be selected
  activeQueryService = null;
  activeProviderName = null;

  console.log(`[ProviderRegistry] Registered provider: ${name}`);
}

/**
 * Get all registered provider names
 */
export function getRegisteredProviders(): string[] {
  return Array.from(providerRegistry.keys());
}

/**
 * Check if a provider is registered
 */
export function isProviderRegistered(name: string): boolean {
  const lowerName = name.toLowerCase();
  return providerRegistry.has(lowerName) || aliasMap.has(lowerName);
}

/**
 * Get QueryService for a specific provider by name
 *
 * @param name - Provider name or alias
 * @returns QueryService instance or null if not found
 */
export function getQueryServiceByName(name: string): QueryService | null {
  const lowerName = name.toLowerCase();

  // Check direct registration
  let registration = providerRegistry.get(lowerName);

  // Check aliases
  if (!registration) {
    const resolvedName = aliasMap.get(lowerName);
    if (resolvedName) {
      registration = providerRegistry.get(resolvedName);
    }
  }

  if (registration) {
    return registration.createQueryService();
  }

  return null;
}

/**
 * Get the default QueryService
 *
 * Returns the highest-priority registered provider.
 * Caches the result for performance.
 *
 * @throws Error if no providers are registered
 */
export function getQueryService(): QueryService {
  // Return cached instance if available
  if (activeQueryService) {
    return activeQueryService;
  }

  // Find highest priority provider
  const registrations = Array.from(providerRegistry.values());

  if (registrations.length === 0) {
    throw new Error(
      'No AI providers registered. Please install a provider package:\n' +
        '  npm install @automaker/provider-claude\n' +
        '  npm install @automaker/provider-gemini\n' +
        'Or configure a custom provider.'
    );
  }

  // Sort by priority (higher first)
  registrations.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  const selected = registrations[0];
  activeProviderName = selected.name;
  activeQueryService = selected.createQueryService();

  console.log(`[ProviderRegistry] Using provider: ${activeProviderName}`);

  return activeQueryService;
}

/**
 * Get the name of the currently active provider
 */
export function getActiveProviderName(): string | null {
  return activeProviderName;
}

/**
 * Clear the provider cache (useful for testing or switching providers)
 */
export function clearProviderCache(): void {
  activeQueryService = null;
  activeProviderName = null;
}

/**
 * ProviderRegistry class for more advanced usage
 *
 * Provides a class-based API for provider management.
 */
export class ProviderRegistry {
  static register = registerProvider;
  static getQueryService = getQueryService;
  static getQueryServiceByName = getQueryServiceByName;
  static getRegisteredProviders = getRegisteredProviders;
  static isProviderRegistered = isProviderRegistered;
  static getActiveProviderName = getActiveProviderName;
  static clearCache = clearProviderCache;
}
