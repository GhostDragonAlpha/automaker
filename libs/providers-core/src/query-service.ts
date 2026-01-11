/**
 * QueryService Interface
 *
 * Abstraction layer for simple AI query operations.
 * This allows routes to make AI calls without directly depending on
 * a specific provider SDK (e.g., @anthropic-ai/claude-agent-sdk).
 *
 * Each provider package implements this interface.
 */

/**
 * Options for query operations
 */
export interface QueryOptions {
  /** Model to use (optional, uses provider default if not specified) */
  model?: string;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature for sampling (0-1) */
  temperature?: number;
  /** System prompt to prepend */
  systemPrompt?: string;
  /** Abort controller for cancellation */
  abortController?: AbortController;
  /** Optional timeout in milliseconds */
  timeout?: number;
}

/**
 * Result from a query operation
 */
export interface QueryResult {
  /** The generated text response */
  text: string;
  /** Token usage statistics (if available) */
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  /** Model that was used */
  model?: string;
}

/**
 * QueryService interface - the abstraction layer for AI queries
 *
 * Providers implement this interface to enable provider-agnostic
 * AI operations throughout AutoMaker.
 */
export interface QueryService {
  /**
   * Get the provider name (e.g., 'claude', 'gemini', 'aider')
   */
  getName(): string;

  /**
   * Simple one-shot query returning the text response
   * For use cases like title generation, description enhancement, etc.
   *
   * @param prompt - The user prompt
   * @param options - Optional query configuration
   * @returns Promise resolving to the text response
   */
  simpleQuery(prompt: string, options?: QueryOptions): Promise<string>;

  /**
   * Streaming query for longer responses
   *
   * @param prompt - The user prompt
   * @param options - Optional query configuration
   * @yields Text chunks as they arrive
   */
  streamQuery(prompt: string, options?: QueryOptions): AsyncGenerator<string>;

  /**
   * Full query with metadata
   *
   * @param prompt - The user prompt
   * @param options - Optional query configuration
   * @returns Promise resolving to result with text and metadata
   */
  query(prompt: string, options?: QueryOptions): Promise<QueryResult>;

  /**
   * Check if the provider is available and configured
   */
  isAvailable(): Promise<boolean>;
}
